"""Audit the packs for Paradise.exe V2 (Bedrock 1.26.50) readiness.

Read-only. Findings are aggregated by (severity, message) with counts and a
bounded list of locations so a future agent gets exact file:line pointers
without verbose per-file spam. Grounded rules live in v2_target.json.
"""

import re
from collections import Counter, defaultdict
from pathlib import Path

from common import BP, RP, page, read_json

TARGET = read_json(Path(__file__).with_name("v2_target.json"))
CHECKS = ("manifest", "formats", "dimensions", "entities", "blocks", "scripts")
SEMVER = re.compile(r"^(\d+)\.(\d+)\.(\d+)$")
ID_RE = re.compile(r"^[a-z][a-z0-9_]*:[a-z0-9_./-]+$")


def version_tuple(value):
    if isinstance(value, list) and len(value) == 3 and all(type(part) is int for part in value):
        return tuple(value)
    if isinstance(value, str):
        match = SEMVER.match(value)
        if match:
            return tuple(int(part) for part in match.groups())
    return None


class Findings:
    """Aggregate findings by (severity, message) with bounded locations."""

    def __init__(self, examples):
        self.examples = examples
        self.rows = {}

    def add(self, check, severity, message, file=None, line=None):
        key = (severity, message)
        row = self.rows.setdefault(key, {"check": check, "severity": severity, "message": message,
                                         "count": 0, "locations": []})
        row["count"] += 1
        if file is not None and len(row["locations"]) < self.examples:
            row["locations"].append({"file": file, **({"line": line} if line is not None else {})})

    def split(self):
        errors = [row for row in self.rows.values() if row["severity"] == "error"]
        warnings = [row for row in self.rows.values() if row["severity"] == "warning"]
        return errors, warnings

    @property
    def any(self):
        return bool(self.rows)


def pack_json(root):
    for pack in (BP, RP):
        directory = root / pack
        if not directory.is_dir():
            continue
        for path in sorted(directory.rglob("*.json")):
            yield pack, path


def check_manifest(root, target, tparts, findings):
    info = {}
    for pack in (BP, RP):
        path = root / pack / "manifest.json"
        manifest = read_json(path)
        relative = path.relative_to(root).as_posix()
        engine = version_tuple(manifest.get("header", {}).get("min_engine_version"))
        if engine is None:
            findings.add("manifest", "error", f"{relative}: min_engine_version is not a version array")
        elif engine < tparts:
            findings.add("manifest", "warning",
                         f"{pack.name} min_engine_version {'.'.join(map(str, engine))} is below the V2 target {target}; bump to {target}",
                         relative)
        elif engine > tparts:
            findings.add("manifest", "error",
                         f"{relative}: min_engine_version {'.'.join(map(str, engine))} is newer than the target {target}",
                         relative)
        info[f"{pack.name}_min_engine_version"] = list(engine) if engine else None
        if pack == RP:
            capabilities = manifest.get("capabilities", [])
            known = set(TARGET["known_rp_capabilities"])
            for capability in capabilities:
                if capability not in known:
                    findings.add("manifest", "warning",
                                 f"{relative}: capability {capability!r} is not a known stable capability at {target}",
                                 relative)
            info["capabilities"] = capabilities
    bp = read_json(root / BP / "manifest.json")
    scripts = [module for module in bp.get("modules", []) if module.get("type") == "script"]
    if not scripts:
        findings.add("manifest", "error", "BP manifest has no script module")
    else:
        info["script_entries"] = [module.get("entry") for module in scripts]
    if tparts >= (1, 26, 50):
        stable = TARGET["stable_script_api"]
        beta_only = set(TARGET["beta_only_at_target"])
        for dependency in bp.get("dependencies", []):
            module = dependency.get("module_name")
            if not isinstance(module, str) or not module.startswith("@minecraft/"):
                continue
            declared = dependency.get("version")
            if module in stable:
                if declared != stable[module] and declared != "beta":
                    findings.add("manifest", "warning",
                                 f"{module} is pinned to {declared}; stable at {target} is {stable[module]}",
                                 (root / BP / "manifest.json").relative_to(root).as_posix())
                elif declared == "beta":
                    findings.add("manifest", "warning",
                                 f"{module} is pinned to \"beta\"; pin the stable {stable[module]} for the {target} release",
                                 (root / BP / "manifest.json").relative_to(root).as_posix())
            elif module in beta_only:
                findings.add("manifest", "warning",
                             f"{module} has no stable release at {target}; it stays beta-only",
                             (root / BP / "manifest.json").relative_to(root).as_posix())
            else:
                findings.add("manifest", "warning",
                             f"{module} is not in the known stable map for {target}; verify it is stable before release",
                             (root / BP / "manifest.json").relative_to(root).as_posix())
        info["script_api_dependencies"] = {dep.get("module_name"): dep.get("version")
                                           for dep in bp.get("dependencies", []) if "module_name" in dep}
    experiments = Counter()
    for pack, path in pack_json(root):
        try:
            doc = read_json(path)
        except ValueError:
            continue
        stack = [doc]
        while stack:
            value = stack.pop()
            if isinstance(value, dict):
                if "experiments" in value:
                    experiments[path.relative_to(root).as_posix()] += 1
                stack.extend(value.values())
            elif isinstance(value, list):
                stack.extend(value)
    for relative in sorted(experiments):
        findings.add("manifest", "warning",
                     f"experimental toggles present; V2 targets zero experimental toggles at {target}", relative)
    return info


def check_formats(root, target, tparts, findings):
    distribution = defaultdict(Counter)
    geometry = unversioned = 0
    for pack, path in pack_json(root):
        relative = path.relative_to(root).as_posix()
        try:
            doc = read_json(path)
        except ValueError as error:
            findings.add("formats", "error", f"unparsable JSON: {error}", relative)
            continue
        if not isinstance(doc, dict):
            continue
        value = doc.get("format_version")
        if path.name == "manifest.json":
            distribution["manifest"][repr(value)] += 1
            if value != 2:
                findings.add("formats", "error", "manifest format_version must be the integer 2", relative)
            continue
        if "models" in path.relative_to(root / pack).parts and path.name.endswith(".geo.json"):
            geometry += 1
            distribution["geometry"][repr(value)] += 1
            continue
        if value is None:
            unversioned += 1
            distribution["unversioned"]["none"] += 1
            continue
        parsed = version_tuple(value)
        if parsed is None:
            findings.add("formats", "error", f"format_version {value!r} is not MAJOR.MINOR.PATCH", relative)
            continue
        text = f"{parsed[0]}.{parsed[1]}.{parsed[2]}"
        distribution["content"][text] += 1
        if parsed > tparts:
            findings.add("formats", "error",
                         f"format_version {text} is newer than the target engine {target}", relative)
        elif parsed < tparts:
            findings.add("formats", "warning",
                         f"format_version {text} is below the V2 target {target}", relative)
        if path.name == "sound_definitions.json" and parsed < tparts:
            note = TARGET["sound_at_1_26_50"]
            findings.add("formats", "warning",
                         f"sound_definitions.json at {text}: bumping to {target} flips {note['field']} "
                         f"to {note['default_at_1_26_50'] if 'default_at_1_26_50' in note else 'true'} by default; review looping/streamed sounds",
                         relative)
    info = {"classes": {name: dict(counter) for name, counter in sorted(distribution.items())},
            "geometry_files": geometry, "unversioned_files": unversioned}
    return info


def check_dimensions(root, target, tparts, findings, index):
    info = {"json_dimensions": 0, "script_registered": 0}
    spec = TARGET["dimension"]
    directory = root / BP / "dimensions"
    json_ids = {}
    if directory.is_dir():
        for path in sorted(directory.rglob("*.json")):
            relative = path.relative_to(root).as_posix()
            try:
                doc = read_json(path)
            except ValueError as error:
                findings.add("dimensions", "error", f"unparsable JSON: {error}", relative)
                continue
            dimension = doc.get("minecraft:dimension")
            if not isinstance(dimension, dict):
                findings.add("dimensions", "error", f"{relative}: missing minecraft:dimension", relative)
                continue
            name = dimension.get("description", {}).get("identifier")
            if not isinstance(name, str) or not ID_RE.match(name) or name.startswith("minecraft:"):
                findings.add("dimensions", "error", f"{relative}: invalid dimension identifier {name!r}", relative)
                continue
            json_ids[name] = relative
            info["json_dimensions"] += 1
            components = dimension.get("components", {})
            if spec["legacy_component"] in components:
                findings.add("dimensions", "error",
                             f"{name}: legacy {spec['legacy_component']} must be replaced at format_version {target} by "
                             f"{spec['component']} with min_y = min and height_range = max - min",
                             relative)
            height = components.get(spec["component"], {})
            low = height.get("min_y", spec["defaults"]["min_y"])
            span = height.get("height_range", spec["defaults"]["height_range"])
            absolute = spec["absolute"]
            no_exp = spec["no_experiment"]
            if type(low) is not int or type(span) is not int:
                findings.add("dimensions", "error", f"{name}: min_y and height_range must be integers", relative)
                continue
            if not absolute["min_y_min"] <= low <= absolute["min_y_max"]:
                findings.add("dimensions", "error",
                             f"{name}: min_y {low} outside absolute range {absolute['min_y_min']}..{absolute['min_y_max']}", relative)
            if not absolute["height_range_min"] <= span <= absolute["height_range_max"]:
                findings.add("dimensions", "error",
                             f"{name}: height_range {span} outside absolute range {absolute['height_range_min']}..{absolute['height_range_max']}",
                             relative)
            if low % 16 or span % 16:
                findings.add("dimensions", "warning", f"{name}: min_y/height_range should be multiples of 16", relative)
            if low < no_exp["min_y_min"] or low + span > no_exp["top_max"] or span > no_exp["height_range_max"]:
                findings.add("dimensions", "warning",
                             f"{name}: height {low}..{low + span - 1} exceeds the no-experiment default "
                             f"{no_exp['min_y_min']}..{no_exp['top_max'] - 1}; at {target} custom dimension JSON is stable, keep default heights",
                             relative)
    registered = [row for row in index["rows"] if row["kind"] == "dimension" and row.get("resolved")]
    info["script_registered"] = len(registered)
    for row in registered:
        if row["name"] in json_ids:
            findings.add("dimensions", "error",
                         f"{row['name']}: registered both in scripts and in {json_ids[row['name']]}",
                         row["file"], row["line"])
        else:
            findings.add("dimensions", "warning",
                         f"script-registered custom dimension {row['name']}; at {target} prefer a JSON dimension file "
                         f"with {spec['component']} and drop the registerCustomDimension startup call",
                         row["file"], row["line"])
    return info


def check_entities(root, target, tparts, findings):
    schema = TARGET["entity_schema_at_1_26_50"]
    info = {"behavior_entities": 0, "client_entities": 0}
    bp_entities = {}
    for path in sorted((root / BP / "entities").rglob("*.json")) if (root / BP / "entities").is_dir() else []:
        relative = path.relative_to(root).as_posix()
        try:
            doc = read_json(path)
        except ValueError as error:
            findings.add("entities", "error", f"unparsable JSON: {error}", relative)
            continue
        entity = doc.get("minecraft:entity")
        if not isinstance(entity, dict):
            findings.add("entities", "error", f"{relative}: missing minecraft:entity", relative)
            continue
        name = entity.get("description", {}).get("identifier")
        if not isinstance(name, str) or not ID_RE.match(name):
            findings.add("entities", "error", f"{relative}: invalid entity identifier {name!r}", relative)
            continue
        bp_entities[name] = (relative, doc)
        info["behavior_entities"] += 1
        components = entity.get("components", {})
        if not isinstance(components, dict):
            components = {}
        loot = components.get("minecraft:loot", {})
        table = loot.get("table") if isinstance(loot, dict) else None
        if isinstance(table, str) and not (root / BP / table).is_file():
            findings.add("entities", "error", f"{name}: missing loot table {table}", relative)
        parsed = version_tuple(doc.get("format_version"))
        if parsed is not None and parsed >= tparts:
            ranged = components.get(schema["ranged_attack_requires_field"]["component"])
            if isinstance(ranged, dict) and schema["ranged_attack_requires_field"]["field"] not in ranged:
                findings.add("entities", "error",
                             f"{name}: {schema['ranged_attack_requires_field']['component']} requires "
                             f"{schema['ranged_attack_requires_field']['field']} at format_version {target}", relative)
            projectile = components.get("minecraft:projectile")
            if isinstance(projectile, dict):
                if projectile.get("isolated_physics") is True:
                    findings.add("entities", "error",
                                 f"{name}: minecraft:projectile isolated_physics=true is a content error at {target}",
                                 relative)
                if "multiple_targets" not in projectile:
                    findings.add("entities", "warning",
                                 f"{name}: minecraft:projectile multiple_targets defaults to false at format_version {target}; "
                                 f"set it explicitly", relative)
            for component in schema["stricter_components"]:
                if component in components:
                    findings.add("entities", "warning",
                                 f"{name}: {component} uses a stricter schema at format_version {target}; validate before release",
                                 relative)
    client_entities = {}
    for path in sorted((root / RP / "entity").rglob("*.entity.json")) if (root / RP / "entity").is_dir() else []:
        relative = path.relative_to(root).as_posix()
        try:
            doc = read_json(path)
        except ValueError as error:
            findings.add("entities", "error", f"unparsable JSON: {error}", relative)
            continue
        client = doc.get("minecraft:client_entity")
        name = client.get("description", {}).get("identifier") if isinstance(client, dict) else None
        if isinstance(name, str):
            client_entities[name] = relative
            info["client_entities"] += 1
    for name, (relative, _doc) in sorted(bp_entities.items()):
        if not name.startswith("minecraft:") and name not in client_entities:
            findings.add("entities", "warning",
                         f"custom entity {name} has no RP client entity; it will be invisible", relative)
    for name, relative in sorted(client_entities.items()):
        if not name.startswith("minecraft:") and name not in bp_entities:
            findings.add("entities", "warning",
                         f"RP client entity {name} has no BP entity definition", relative)
    return info


def check_blocks(root, target, tparts, findings):
    info = {"behavior_blocks": 0, "rp_blocks_json": False}
    directory = root / BP / "blocks"
    if directory.is_dir():
        for path in sorted(directory.rglob("*.json")):
            relative = path.relative_to(root).as_posix()
            try:
                doc = read_json(path)
            except ValueError as error:
                findings.add("blocks", "error", f"unparsable JSON: {error}", relative)
                continue
            block = doc.get("minecraft:block")
            if not isinstance(block, dict):
                findings.add("blocks", "error", f"{relative}: missing minecraft:block", relative)
                continue
            name = block.get("description", {}).get("identifier")
            if not isinstance(name, str) or not ID_RE.match(name) or name.startswith("minecraft:"):
                findings.add("blocks", "error", f"{relative}: invalid block identifier {name!r}", relative)
                continue
            info["behavior_blocks"] += 1
            components = block.get("components", {})
            if not isinstance(components, dict) or not components:
                findings.add("blocks", "error", f"{name}: minecraft:block has no components", relative)
    rp_blocks = root / RP / "blocks.json"
    if rp_blocks.is_file():
        info["rp_blocks_json"] = True
        try:
            doc = read_json(rp_blocks)
            parsed = version_tuple(doc.get("format_version"))
            if parsed is None:
                findings.add("blocks", "error", "RP blocks.json format_version must be MAJOR.MINOR.PATCH",
                             rp_blocks.relative_to(root).as_posix())
            elif parsed > tparts:
                findings.add("blocks", "error", f"RP blocks.json format_version {parsed} is newer than {target}",
                             rp_blocks.relative_to(root).as_posix())
        except ValueError as error:
            findings.add("blocks", "error", f"unparsable RP blocks.json: {error}",
                         rp_blocks.relative_to(root).as_posix())
    return info


def check_scripts(root, target, tparts, findings, index):
    info = {}
    if tparts >= (1, 26, 50):
        stable = TARGET["stable_script_api"]
        beta_only = set(TARGET["beta_only_at_target"])
        for module in sorted(index["modules"]):
            if module in stable:
                continue
            if module in beta_only:
                findings.add("scripts", "warning", f"{module} has no stable release at {target}; it stays beta-only")
            else:
                findings.add("scripts", "warning",
                             f"{module} is not in the known stable map for {target}; verify stability before release")
    api_usage = Counter(row["name"] for row in index["rows"] if row["kind"] == "api")
    info["api_usage"] = dict(sorted(api_usage.items(), key=lambda item: (-item[1], item[0]))[:40])
    info["api_usage_total"] = sum(api_usage.values())
    schedules = Counter(row["name"] for row in index["rows"] if row["kind"] == "schedule")
    info["schedules"] = dict(sorted(schedules.items()))
    for flag in TARGET["api_flags"]:
        if flag["match"] == "event":
            rows = [row for row in index["rows"] if row["kind"] == "event" and row["name"] == flag["name"]]
        elif flag["match"] == "kind":
            rows = [row for row in index["rows"] if row["kind"] == flag["name"]]
        else:
            continue
        for row in rows:
            findings.add("scripts", flag["severity"], f"{row['name']}: {flag['reason']}" if flag["match"] == "event"
                         else flag["reason"] + f" ({row['name']})", row["file"], row["line"])
    return info


def audit(root, args, index):
    target = args.target or TARGET["target_engine"]
    parsed = version_tuple(target)
    if parsed is None:
        raise ValueError(f"--target must be MAJOR.MINOR.PATCH, received {target!r}")
    selected = args.check or list(CHECKS)
    unknown = set(selected) - set(CHECKS)
    if unknown:
        raise ValueError(f"Unknown audit checks: {sorted(unknown)}; choose from {list(CHECKS)}")
    findings = Findings(args.examples)
    checks = {}
    runners = {
        "manifest": lambda: check_manifest(root, target, parsed, findings),
        "formats": lambda: check_formats(root, target, parsed, findings),
        "dimensions": lambda: check_dimensions(root, target, parsed, findings, index),
        "entities": lambda: check_entities(root, target, parsed, findings),
        "blocks": lambda: check_blocks(root, target, parsed, findings),
        "scripts": lambda: check_scripts(root, target, parsed, findings, index),
    }
    for name in selected:
        info = runners[name]()
        errors, warnings = findings.split()
        checks[name] = {"errors": [row for row in errors if row["check"] == name],
                        "warnings": [row for row in warnings if row["check"] == name],
                        "info": info}
    errors, warnings = findings.split()
    flat = sorted(errors + warnings, key=lambda row: (row["severity"] != "error", row["check"], row["message"]))
    issues = bool(flat)
    return issues, {
        "target": {"engine": target, "stable_script_api": TARGET["stable_script_api"] if parsed >= (1, 26, 50) else {}},
        "checks": checks,
        "findings": page(flat, args),
    }
