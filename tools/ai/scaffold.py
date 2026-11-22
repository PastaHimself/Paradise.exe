"""Plan and apply a batch of additive Bedrock JSON and asset changes."""

import os
import re
import stat
from contextlib import contextmanager
from pathlib import Path
from tempfile import NamedTemporaryFile

from common import BP, RP, json_bytes, parse_json, read_json
from scaffold_geometry import CELL_MIN, inside, placement_offsets, stage_cells, vector
from scaffold_provenance import asset_records, update_index, verify_atlas, verify_existing_tile


TEXTURE_SUFFIXES = (".png", ".tga", ".jpg", ".jpeg")


IDENTIFIER = re.compile(r"[a-z][a-z0-9_]*:[a-z0-9_.-]+")
GEOMETRY = re.compile(r"geometry\.[A-Za-z0-9_.-]+")
RENDER_METHODS = {
    "opaque", "double_sided", "blend", "alpha_test", "alpha_test_single_sided",
    "blend_to_opaque", "alpha_test_to_opaque", "alpha_test_single_sided_to_opaque",
}
BLOCK_OPTIONAL = {"model", "texture", "texture_path", "render_method", "collision_box", "selection_box",
                  "light_emission", "light_dampening", "friction", "sound", "display_name", "materials",
                  "rp_block", "batch", "rotation", "rotation_offset", "state_count", "geometry_mode",
                  "geometry_owner", "source_geometry", "allow_tall_collision",
                  "provenance", "vanilla_root", "index"}
DIMENSION_OPTIONAL = {"min_y", "height_range", "biome", "batch"}
MATERIAL_FACES = {"*", "up", "down", "north", "south", "east", "west", "side"}


def box_component(value, field, allow_tall=False):
    if type(value) is bool:
        return value
    maximum_y = 24 if allow_tall else 16
    if isinstance(value, list) and value and field == "collision_box":
        for box in value:
            if not isinstance(box, dict) or set(box) != {"min", "max"}:
                raise ValueError("Collision arrays require min/max objects")
            lo = vector(box["min"], 3, "box min")
            hi = vector(box["max"], 3, "box max")
            if not inside(lo, hi, (0, 0, 0), (16, maximum_y, 16), epsilon=0) or any(a >= b for a, b in zip(lo, hi)):
                raise ValueError(f"Out-of-bounds {field}: {box!r}")
        return value
    if isinstance(value, dict):
        # Keep accepting the toolkit's older shorthand as input.
        if value.keys() <= {"width", "height"}:
            width, height = vector([value.get("width", 1), value.get("height", 1)], 2, field)
            value = {"origin": [-width / 2, 0, -width / 2], "size": [width, height, width]}
        if value.keys() <= {"origin", "size"}:
            lo = vector(value.get("origin", [-8, 0, -8]), 3, "box origin")
            size = vector(value.get("size", [16, 16, 16]), 3, "box size")
            hi = [a + b for a, b in zip(lo, size)]
            if all(n > 0 for n in size) and inside(lo, hi, CELL_MIN, (8, maximum_y, 8), epsilon=0):
                return {"origin": lo, "size": size}
    raise ValueError(f"Invalid {field}: {value!r}")

def light_component(value, field, maximum):
    if type(value) is not int or not 0 <= value <= maximum:
        raise ValueError(f"{field} must be an integer 0..{maximum}, received {value!r}")
    return value


def lang_set(root, plan, relative, entries):
    path = checked_path(root, relative)
    old = path.read_bytes() if path.exists() else None
    lines = old.decode("utf-8").splitlines() if old is not None else []
    updates = dict(entries)
    for index, line in enumerate(lines):
        key, separator, _ = line.partition("=")
        if separator and key in updates:
            lines[index] = f"{key}={updates.pop(key)}"
    lines.extend(f"{key}={value}" for key, value in updates.items())
    plan.add(relative, ("\n".join(lines) + "\n").encode("utf-8"), merge_from=old)


def rp_blocks_merge(plan, entries):
    if not entries:
        return
    relative = RP / "blocks.json"
    old = plan.content(relative)
    doc = parse_json(old, relative.name) if old is not None else {"format_version": "1.19.30"}
    if not isinstance(doc, dict):
        raise ValueError("RP blocks.json must be a JSON object")
    doc.setdefault("format_version", "1.19.30")
    for name, value in entries:
        if name in doc and doc[name] != value:
            raise Conflict(f"RP blocks.json already has a different entry for {name}")
        doc[name] = value
    plan.add(relative, json_bytes(doc), merge_from=old)


class Conflict(ValueError):
    pass


def identifier(value):
    if not isinstance(value, str) or not IDENTIFIER.fullmatch(value) or value.startswith("minecraft:"):
        raise ValueError(f"Expected a custom namespaced identifier, received {value!r}")
    namespace, name = value.split(":")
    if name in {".", ".."}:
        raise ValueError(f"Invalid identifier {value!r}")
    return f"{namespace}__{name}"


def checked_path(root, relative):
    path = root / relative
    if not path.is_relative_to(root) or ".." in path.relative_to(root).parts:
        raise ValueError(f"Path must stay inside the repo: {relative}")
    current = root
    for part in path.relative_to(root).parts:
        current /= part
        if current.is_symlink():
            raise ValueError(f"Symbolic link in write path: {current.relative_to(root)}")
    return path


def source_path(root, value):
    if not isinstance(value, str):
        raise ValueError("Asset source must be a path string")
    path = Path(value)
    return path if path.is_absolute() else root / path


def rows(doc, key):
    result = doc.get(key, [])
    if not isinstance(result, list) or any(not isinstance(row, dict) for row in result):
        raise ValueError(f"{key} must be an array of objects")
    return result


def fields(row, required, optional):
    missing = required - row.keys()
    unknown = row.keys() - required - optional
    if missing or unknown:
        raise ValueError(f"Missing fields {sorted(missing)}; unknown fields {sorted(unknown)}")


def geometries(doc):
    return [
        entry.get("description", {}).get("identifier")
        for entry in doc.get("minecraft:geometry", [])
    ] if isinstance(doc, dict) else []


def definitions(root, directory, key):
    result = {}
    for path in sorted((root / directory).rglob("*.json")):
        value = read_json(path).get(key, {}).get("description", {}).get("identifier")
        if isinstance(value, str):
            result.setdefault(value, []).append(path.relative_to(root))
    return result


def add_document(root, plan, existing, relative, name, document):
    for path in existing.get(name, []):
        if path != relative:
            raise Conflict(f"{name} already defined at {path.as_posix()}")
    path = checked_path(root, relative)
    if path.exists():
        if read_json(path) != document:
            raise Conflict(f"Existing JSON differs: {relative.as_posix()}")
        plan.add(relative, path.read_bytes())
    else:
        plan.add(relative, json_bytes(document))


class Plan:
    def __init__(self, root):
        self.root = root
        self.files = {}
        self.placements = []

    def add(self, relative, content, *, merge_from=None):
        path = checked_path(self.root, relative)
        before = path.read_bytes() if path.exists() else None
        if before is not None and before != content and before != merge_from:
            raise Conflict(f"Existing asset differs: {relative.as_posix()}")
        if merge_from is not None and before != merge_from:
            raise Conflict(f"File changed during planning: {relative.as_posix()}")
        if relative in self.files and self.files[relative][1] != content:
            raise Conflict(f"Batch proposes two versions of {relative.as_posix()}")
        self.files[relative] = (before, content)

    def content(self, relative):
        if relative in self.files:
            return self.files[relative][1]
        path = checked_path(self.root, relative)
        return path.read_bytes() if path.is_file() else None

    def summary(self):
        return [
            {"path": path.as_posix(), "action": "unchanged" if before == after else "update" if before is not None else "create"}
            for path, (before, after) in sorted(self.files.items())
        ]

    def apply(self):
        saved = []
        try:
            for relative, (before, after) in self.files.items():
                if before == after:
                    continue
                path = checked_path(self.root, relative)
                current = path.read_bytes() if path.exists() else None
                if current != before:
                    raise Conflict(f"File changed during scaffold: {relative.as_posix()}")
                atomic_write(path, after)
                saved.append((path, before))
        except (Exception, KeyboardInterrupt):
            for path, previous in reversed(saved):
                if previous is None:
                    path.unlink()
                else:
                    atomic_write(path, previous)
            raise


@contextmanager
def scaffold_lock(root, enabled):
    if not enabled:
        yield
        return
    lock = root / ".paradise-ai-scaffold.lock"
    try:
        lock.mkdir()
    except FileExistsError as exc:
        raise Conflict("Scaffold lock exists at .paradise-ai-scaffold.lock") from exc
    try:
        yield
    finally:
        lock.rmdir()


def atomic_write(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    mode = stat.S_IMODE(path.stat().st_mode) if path.exists() else 0o644
    temporary = None
    try:
        with NamedTemporaryFile(dir=path.parent, delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(content)
        temporary.chmod(mode)
        os.replace(temporary, path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def runtime_id(name):
    namespace, path = name.split(":")
    return "geometry.paradise." + (path if namespace == "paradise" else identifier(name))


def load_models(root):
    result = {}
    for path in sorted((root / RP / "models").rglob("*.json")):
        for name in geometries(read_json(path)):
            if isinstance(name, str):
                result.setdefault(name, []).append(path.relative_to(root))
    return result


def stage_block_models(root, plan, models, row, name):
    mode = row.get("geometry_mode", "1")
    if mode not in ("1", "S"):
        raise ValueError("geometry_mode must be 1 or S")
    explicit = row.get("geometry")
    if "model" not in row:
        if mode == "S" or "geometry_owner" in row or "source_geometry" in row:
            raise ValueError("Splitting or selecting a source requires model")
        if not isinstance(explicit, str) or len(models.get(explicit, [])) != 1 or explicit == "geometry.unknown":
            raise ValueError(f"Expected one existing runtime geometry: {explicit}")
        existing = models[explicit][0]
        model = next(g for g in parse_json(plan.content(existing), existing.name)["minecraft:geometry"]
                     if g["description"]["identifier"] == explicit)
        stage_cells(model, False)
        return [(name, (0, 0, 0), explicit)], (0, 0, 0), existing.as_posix()

    source = source_path(root, row["model"])
    document = read_json(source)
    exported = geometries(document)
    if (not exported or any(not isinstance(item, str) or not GEOMETRY.fullmatch(item) for item in exported)
            or len(exported) != len(set(exported))):
        raise ValueError(f"Invalid or repeated geometry IDs in {source.name}")
    source_id = row.get("source_geometry", explicit if explicit in exported else None)
    if source_id is None and len(exported) == 1:
        source_id = exported[0]
    if source_id not in exported:
        raise ValueError(f"Select a source_geometry exported by {source.name}")
    if "source_geometry" not in row and explicit is not None and explicit not in exported and explicit != runtime_id(name):
        raise ValueError(f"Geometry {explicit!r} is neither a source ID nor the canonical runtime ID")
    owner = row.get("geometry_owner", name)
    identifier(owner)
    model = document["minecraft:geometry"][exported.index(source_id)]
    cells, shift = stage_cells(model, mode == "S")
    staged = []
    for cell, segment in cells.items():
        suffix = "" if mode != "S" else "_x{}_y{}_z{}".format(*cell)
        block_name = name + suffix
        geometry = runtime_id(owner + suffix)
        target = RP / f"models/blocks/{identifier(owner + suffix)}.geo.json"
        if any(path != target for path in models.get(geometry, [])):
            raise Conflict(f"Geometry ID already defined: {geometry}")
        segment["description"]["identifier"] = geometry
        content = {"format_version": document["format_version"], "minecraft:geometry": [segment]}
        plan.add(target, json_bytes(content))
        models[geometry] = [target]
        staged.append((block_name, cell, geometry))
    return staged, shift, str(row["model"])


def bp_rotation(row):
    mode = row.get("rotation", "F")
    offset = row.get("rotation_offset", 0)
    if mode not in ("F", "C") or type(offset) not in (int, float) or offset not in (0, 90, 180, 270):
        raise ValueError("rotation must be F or C and rotation_offset must be 0, 90, 180 or 270")
    count = 4 if mode == "C" else 1
    configured_count = row.get("state_count", count)
    if type(configured_count) is not int or configured_count != count or (mode == "F" and offset != 0):
        raise ValueError(f"Rotation {mode} requires exactly {count} state(s) and a valid offset")
    if mode == "F":
        return {}, []
    trait = {"traits": {"minecraft:placement_direction": {
        "enabled_states": ["minecraft:cardinal_direction"], "y_rotation_offset": float(offset),
    }}}
    permutations = [
        {"condition": f"q.block_state('minecraft:cardinal_direction') == '{direction}'",
         "components": {"minecraft:transformation": {"rotation": [0, angle, 0]}}}
        for direction, angle in (("north", 0), ("east", -90), ("south", 180), ("west", 90))
    ]
    return trait, permutations


def block_texture(root, plan, row, slug, vanilla_root):
    if ("texture" in row) == ("texture_path" in row):
        raise ValueError("Specify exactly one of texture and texture_path")
    if "texture" in row:
        source = source_path(root, row["texture"])
        if source.suffix.lower() != ".png":
            raise ValueError("Verified atlas imports use PNG")
        content = source.read_bytes()
        if not content.startswith(b"\x89PNG\r\n\x1a\n"):
            raise ValueError(f"Invalid PNG signature: {source.name}")
        content, records, warnings = verify_atlas(content, row.get("provenance"), vanilla_root)
        texture = f"textures/blocks/{slug}"
        target = RP / f"{texture}.png"
        plan.add(target, content)
        return texture, target.as_posix(), str(row["texture"]), records, warnings
    texture = row["texture_path"]
    if (not isinstance(texture, str) or not re.fullmatch(r"textures/[a-zA-Z0-9_./ -]+", texture)
            or any(part in {"", ".", ".."} for part in texture.split("/"))):
        raise ValueError("Provide an extensionless resource texture path")
    choices = [RP / f"{texture}{suffix}" for suffix in TEXTURE_SUFFIXES]
    matches = [(path, data) for path in choices if (data := plan.content(path)) is not None]
    if len(matches) != 1:
        raise ValueError(f"Expected one base RP texture at {texture}")
    path, content = matches[0]
    if "provenance" in row:
        verified, records, warnings = verify_atlas(content, row["provenance"], vanilla_root)
        if verified != content:
            raise ValueError("Use texture import mode to write a substituted atlas")
    else:
        records, warnings = verify_existing_tile(path.relative_to(RP).as_posix(), content), []
    return texture, path.as_posix(), path.as_posix(), records, warnings


def block_properties(row, name):
    components = {"minecraft:tags": ["paradise:static_decor"]}
    tall = row.get("allow_tall_collision", False)
    if type(tall) is not bool:
        raise ValueError("allow_tall_collision must be boolean")
    for key in ("collision_box", "selection_box"):
        if key in row:
            components[f"minecraft:{key}"] = box_component(row[key], key, tall and key == "collision_box")
    for key in ("light_emission", "light_dampening"):
        if key in row:
            components[f"minecraft:{key}"] = light_component(row[key], key, 15)
    if "friction" in row:
        friction = row["friction"]
        if type(friction) not in (int, float) or not 0 <= friction <= 1:
            raise ValueError(f"{name}: friction must be a number 0..1")
        components["minecraft:friction"] = float(friction)
    override = row.get("rp_block", {})
    if not isinstance(override, dict):
        raise ValueError("rp_block must be an object")
    sound = row.get("sound", override.get("sound"))
    if sound is not None:
        if not isinstance(sound, str) or not re.fullmatch(r"[a-z0-9_.-]+", sound):
            raise ValueError(f"{name}: invalid block sound {sound!r}")
        if "sound" in override and override["sound"] != sound:
            raise ValueError("BP and RP block sounds must match")
        components["minecraft:sound"] = sound
        override = {**override, "sound": sound}
    return components, override


def block_assets(root, spec, plan, vanilla_root):
    defines = definitions(root, BP / "blocks", "minecraft:block")
    models = load_models(root)
    atlas_path = RP / "textures/terrain_texture.json"
    atlas_bytes = plan.content(atlas_path)
    atlas = parse_json(atlas_bytes, atlas_path.name) if atlas_bytes is not None else {
        "resource_pack_name": "Paradise.exe RP", "texture_name": "atlas.terrain", "texture_data": {},
    }
    entries = atlas.get("texture_data")
    if not isinstance(entries, dict):
        raise ValueError("Terrain atlas must contain a texture_data object")
    before_count = len(entries)
    names, emitted = set(), set()
    records, warnings = [], []
    lang_entries, rp_entries = [], []
    for row in spec:
        name = row.get("id")
        try:
            fields(row, {"id"}, BLOCK_OPTIONAL | {"geometry"})
            slug = identifier(name)
            if name in names:
                raise ValueError(f"Repeated block in batch: {name}")
            names.add(name)
            trait, permutations = bp_rotation(row)
            staged, shift, source = stage_block_models(root, plan, models, row, name)
            offsets = placement_offsets([cell for _, cell, _ in staged], bool(trait))
            base = source_path(root, row["vanilla_root"]) if "vanilla_root" in row else vanilla_root
            texture, target, atlas_source, tiles, audit = block_texture(root, plan, row, slug, base)
            warnings.extend(audit)
            render = row.get("render_method", "opaque")
            if not isinstance(render, str) or render not in RENDER_METHODS:
                raise ValueError(f"Invalid render_method {render!r}")
            entry = {"textures": texture}
            if slug in entries and entries[slug] != entry:
                raise ValueError(f"Different atlas entry already exists: {slug}")
            entries[slug] = entry
            material = row.get("materials", {})
            if not isinstance(material, dict) or not material.keys() <= MATERIAL_FACES:
                raise ValueError("materials must be a face-to-terrain-key map")
            faces = {"*": slug, **material}
            if any(not isinstance(key, str) or key not in entries for key in faces.values()):
                raise ValueError("Block material refers to a missing terrain key")
            for key in faces.values():
                path = entries[key].get("textures") if isinstance(entries[key], dict) else None
                if isinstance(path, str) and not any(plan.content(RP / f"{path}{ext}") is not None
                                                      for ext in TEXTURE_SUFFIXES):
                    raise ValueError(f"Missing bitmap for terrain key {key}: {path}")
            instances = {face: {"texture": key, "render_method": render, "ambient_occlusion": 1.0}
                         for face, key in faces.items()}
            components, rp_block = block_properties(row, name)
            display = row.get("display_name")
            if display is not None and (not isinstance(display, str) or not display.strip() or "\n" in display or "\r" in display):
                raise ValueError("display_name must be a non-empty single line")
            segments = []
            for block_id, cell, geometry in staged:
                if block_id in emitted:
                    raise ValueError(f"Repeated emitted block ID: {block_id}")
                emitted.add(block_id)
                block = {
                    "description": {"identifier": block_id, **trait},
                    "components": {**components, "minecraft:geometry": geometry, "minecraft:material_instances": instances},
                }
                if permutations:
                    block["permutations"] = permutations
                relative = BP / f"blocks/{identifier(block_id)}.json"
                add_document(root, plan, defines, relative, block_id, {
                    "format_version": "1.26.50", "minecraft:block": block,
                })
                if display is not None:
                    lang_entries.append((f"tile.{block_id}.name", display))
                if rp_block:
                    rp_entries.append((block_id, rp_block))
                records.extend(asset_records(row.get("index", {}), block_id, source, geometry, atlas_source, target, tiles))
                segments.append({"id": block_id, "geometry": geometry, "cell": cell, "offsets": offsets[cell]})
            plan.placements.append({"id": name, "translation": shift, "segments": segments})
        except (ValueError, OSError, TypeError, KeyError, AttributeError) as error:
            raise Conflict(f"{name}: {error}") from error
    if len(entries) != before_count:
        plan.add(atlas_path, json_bytes(atlas), merge_from=atlas_bytes)
    else:
        plan.add(atlas_path, atlas_bytes, merge_from=atlas_bytes)
    if lang_entries:
        lang_set(root, plan, RP / "texts/en_US.lang", lang_entries)
    rp_blocks_merge(plan, rp_entries)
    update_index(plan, records)
    return warnings

def dimension_assets(root, spec, plan, index):
    existing = definitions(root, BP / "dimensions", "minecraft:dimension")
    scripts = {row["name"] for row in index["rows"] if row["kind"] == "dimension" and row["resolved"]}
    names = set()
    for row in spec:
        fields(row, {"id"}, DIMENSION_OPTIONAL)
        name = row["id"]
        slug = identifier(name)
        if name in scripts or name in names:
            raise Conflict(f"Dimension already registered in scripts or repeated in batch: {name}")
        names.add(name)
        low = row.get("min_y", -64)
        height = row.get("height_range", 384)
        if (type(low) is not int or type(height) is not int or low % 16 or height % 16
                or low < -512 or not 16 <= height <= 1024 or low + height > 512):
            raise ValueError(f"Invalid min_y or height_range for {name}")
        components = {
            "minecraft:generation": {"generator_type": "void"},
            "minecraft:dimension_height": {"min_y": low, "height_range": height},
        }
        if "biome" in row:
            biome = row["biome"]
            if not isinstance(biome, str) or not IDENTIFIER.fullmatch(biome):
                raise ValueError(f"Invalid biome ID: {biome!r}")
            components["minecraft:default_biome"] = {"biome": biome}
        add_document(root, plan, existing, BP / f"dimensions/{slug}.json", name, {
            "format_version": "1.26.50",
            "minecraft:dimension": {"description": {"identifier": name}, "components": components},
        })


def build_plan(root, spec, script_index):
    if not isinstance(spec, dict):
        raise ValueError("Batch spec must be a JSON object")
    fields(spec, set(), {"blocks", "dimensions", "vanilla_root"})
    blocks, dimensions = rows(spec, "blocks"), rows(spec, "dimensions")
    plan = Plan(root)
    warnings = []
    if blocks:
        root_path = source_path(root, spec["vanilla_root"]) if "vanilla_root" in spec else None
        warnings.extend(block_assets(root, blocks, plan, root_path))
    if dimensions:
        index = script_index()
        if index["errors"]:
            raise Conflict("Fix JavaScript parse errors before scaffolding dimensions")
        dimension_assets(root, dimensions, plan, index)
        version = read_json(root / BP / "manifest.json")["header"]["min_engine_version"]
        if tuple(version) < (1, 26, 50):
            warnings.append("Dimension JSON requires Bedrock 1.26.50; BP currently declares " + ".".join(map(str, version)))
    return plan, warnings


def catalog(root, directory, texture_directory):
    model_root = (root / directory).resolve()
    texture_root = (root / (texture_directory or directory)).resolve()
    if not model_root.is_dir() or not texture_root.is_dir():
        raise ValueError("Model and texture directories must exist")

    def display(path):
        return path.relative_to(root).as_posix() if path.is_relative_to(root) else str(path)

    textures = {}
    for path in sorted(texture_root.rglob("*")):
        if path.is_file() and path.suffix.lower() in TEXTURE_SUFFIXES:
            textures.setdefault(path.stem.casefold(), []).append(display(path))
    models = []
    errors = []
    for path in sorted(model_root.rglob("*.geo.json")):
        try:
            exported = geometries(read_json(path))
            if not exported or any(not isinstance(name, str) or not GEOMETRY.fullmatch(name) for name in exported):
                raise ValueError("expected valid Bedrock geometry identifiers")
            if len(exported) != len(set(exported)):
                raise ValueError("geometry identifiers repeat")
        except (ValueError, TypeError, AttributeError) as error:
            errors.append({"file": display(path), "message": str(error)})
            continue
        stem = path.name.removesuffix(".geo.json").casefold()
        models.append({"model": display(path), "geometries": exported, "textures": textures.get(stem, [])})
    return models, errors


def blocks_from_exports(root, directory, texture_directory, namespace, render_method):
    """Require one Bedrock geometry and one texture per export stem."""
    identifier(f"{namespace}:example")
    models, errors = catalog(root, directory, texture_directory)
    blocks = []
    seen_ids = set()
    for model in models:
        stem = Path(model["model"]).name.removesuffix(".geo.json").casefold()
        name = f"{namespace}:{stem}"
        try:
            identifier(name)
            if len(model["geometries"]) != 1 or len(model["textures"]) != 1:
                raise ValueError("Expected one geometry and one matching texture")
            geometry, = model["geometries"]
            if name in seen_ids:
                raise ValueError("Generated block ID is repeated")
            texture = model["textures"][0]
            sidecar = source_path(root, texture + ".provenance.json")
            options = read_json(sidecar) if sidecar.is_file() else {}
            fields(options, {"provenance", "vanilla_root"}, {"rotation", "geometry_mode", "index"})
        except ValueError as error:
            errors.append({**model, "message": str(error)})
            continue
        seen_ids.add(name)
        blocks.append({"id": name, "model": model["model"], "geometry": geometry,
                       "texture": texture, "render_method": render_method, **options})
    if not models and not errors:
        errors.append({"file": str(directory), "message": "No .geo.json exports found"})
    return {"blocks": blocks}, errors
