"""Migrate exactly identical shared block geometry without changing block identities."""

import copy
import csv
import json
import re
from collections import defaultdict
from hashlib import sha256
from io import StringIO

from common import BP, RP, json_bytes, parse_json
from scaffold import Conflict, Plan, checked_path
from scaffold_provenance import COLUMNS, INDEX


SHARED_PREFIX = "geometry.paradise.sh_"
FIXTURE_PREFIX = "geometry.paradise.yh_fluorescent_fixture_"
GEOMETRY_ID = re.compile(rb"geometry\.[A-Za-z0-9_.-]+")


def signature(document):
    """Compare every authored field except the one geometry identifier."""
    if not isinstance(document, dict) or not isinstance(document.get("minecraft:geometry"), list):
        return None
    entries = document["minecraft:geometry"]
    if len(entries) != 1:
        return None
    normalized = copy.deepcopy(document)
    name = normalized["minecraft:geometry"][0]["description"].pop("identifier")
    if not isinstance(name, str):
        raise ValueError("Geometry identifier must be a string")
    return name, json.dumps(normalized, sort_keys=True, separators=(",", ":"), allow_nan=False)


def model_inventory(root):
    models = {}
    all_names = set()
    for path in sorted((root / RP / "models").rglob("*.json")):
        relative = path.relative_to(root)
        content = checked_path(root, relative).read_bytes()
        document = parse_json(content, relative.as_posix())
        for entry in document.get("minecraft:geometry", []):
            name = entry.get("description", {}).get("identifier")
            if not isinstance(name, str):
                continue
            if name in all_names and name.startswith((SHARED_PREFIX, FIXTURE_PREFIX)):
                raise Conflict(f"Duplicate geometry identifier: {name}")
            all_names.add(name)
        value = signature(document)
        if value is not None:
            name, shape = value
            if name.startswith(SHARED_PREFIX) or re.fullmatch(re.escape(FIXTURE_PREFIX) + r"x\d+_y\d+_z\d+", name):
                models[name] = (relative, content, shape)
    return models


def shared_mapping(models):
    groups = defaultdict(list)
    for name, (_, _, shape) in models.items():
        groups[shape].append(name)
    mapping = {}
    for members in groups.values():
        shared = sorted(name for name in members if name.startswith(SHARED_PREFIX))
        if not shared:
            continue
        fixture_owners = sorted(set(members) - set(shared)) if all(name.startswith("geometry.paradise.sh_fixture_") for name in shared) else []
        owner = fixture_owners[0] if fixture_owners else min(shared, key=lambda name: (len(name), name))
        for name in shared:
            if name != owner:
                mapping[name] = owner
    return dict(sorted(mapping.items()))


def references(content, removed):
    return {match.group().decode("ascii") for match in GEOMETRY_ID.finditer(content)} & removed


def replace_block_geometry(document, mapping):
    block = document.get("minecraft:block")
    if not isinstance(block, dict):
        raise Conflict("Only registered Bedrock block definitions may be migrated")
    block_id = block.get("description", {}).get("identifier", "")
    if not block_id.startswith("paradise:sh_"):
        raise Conflict(f"Shared geometry is referenced by a non-shared block: {block_id}")
    updates = []
    components = [block.get("components", {})]
    components.extend(permutation.get("components", {}) for permutation in block.get("permutations", []))
    for component in components:
        geometry = component.get("minecraft:geometry")
        if isinstance(geometry, str) and geometry in mapping:
            component["minecraft:geometry"] = mapping[geometry]
            updates.append(geometry)
        elif isinstance(geometry, dict) and geometry.get("identifier") in mapping:
            name = geometry["identifier"]
            geometry["identifier"] = mapping[name]
            updates.append(name)
    return block_id, updates


def build_shared_reuse_plan(root):
    models = model_inventory(root)
    mapping = shared_mapping(models)
    plan = Plan(root)
    if not mapping:
        return plan, mapping, 0
    removed = set(mapping)
    deletions = {models[name][0] for name in removed}
    for owner in sorted(set(mapping.values())):
        relative, content, _ = models[owner]
        plan.add(relative, content)

    # Only generated shared BP block components may change. Any other live
    # reference, even in a script or an unexpected JSON field, blocks removal.
    block_updates = {}
    for pack in (BP, RP):
        for path in sorted((root / pack).rglob("*")):
            if not path.is_file() or path.suffix.lower() not in {".json", ".js", ".ts", ".mcfunction", ".lang", ".mcstructure", ".txt"}:
                continue
            relative = path.relative_to(root)
            if relative in deletions:
                continue
            content = checked_path(root, relative).read_bytes()
            hits = references(content, removed)
            if not hits:
                continue
            if not relative.is_relative_to(BP / "blocks") or path.suffix != ".json":
                raise Conflict(f"Unexpected shared geometry reference in {relative}: {sorted(hits)}")
            document = parse_json(content, relative.as_posix())
            block_id, updates = replace_block_geometry(document, mapping)
            after = json_bytes(document)
            if not updates or references(after, removed):
                raise Conflict(f"Unmigrated geometry reference in {relative}")
            plan.add(relative, after, merge_from=content)
            block_updates[block_id] = set(updates)

    index = plan.content(INDEX)
    if index is None:
        raise Conflict("The asset index is required for shared geometry migration")
    reader = csv.DictReader(StringIO(index.decode("utf-8"), newline=""))
    if tuple(reader.fieldnames or ()) != COLUMNS:
        raise Conflict("Unexpected asset-index header")
    output = StringIO(newline="")
    writer = csv.DictWriter(output, COLUMNS, lineterminator="\n")
    writer.writeheader()
    seen = set()
    updated_rows = 0
    for row in reader:
        old = row["geo_runtime"]
        if old in mapping:
            if row["status"] == "deferred" or old not in block_updates.get(row["block_id"], set()):
                raise Conflict(f"Asset index does not match registered block: {row['block_id']} / {old}")
            row["geo_runtime"] = mapping[old]
            seen.add((row["block_id"], old))
            updated_rows += 1
        writer.writerow(row)
    expected = {(block_id, name) for block_id, names in block_updates.items() for name in names}
    if seen != expected or {name for _, name in seen} != removed:
        raise Conflict("Not every redundant geometry has an indexed block reference")
    new_index = output.getvalue().encode("utf-8")
    if references(new_index, removed):
        raise Conflict("Unmigrated geometry reference in the asset index")
    plan.add(INDEX, new_index, merge_from=index)

    for name in mapping:
        relative, content, shape = models[name]
        if models[mapping[name]][2] != shape:
            raise Conflict(f"Non-identical geometry: {name}")
        plan.remove_verified(relative, expected=content)
    return plan, mapping, updated_rows


def plan_digest(plan):
    """Bind approval to exact source and destination bytes, including owners."""
    entries = [(path.as_posix(), sha256(before).hexdigest() if before is not None else None,
                sha256(after).hexdigest() if after is not None else None)
               for path, (before, after) in sorted(plan.files.items())]
    return sha256(json.dumps(entries, separators=(",", ":")).encode()).hexdigest()
