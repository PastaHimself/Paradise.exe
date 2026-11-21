"""Plan and apply a batch of additive Bedrock JSON and asset changes."""

import os
import re
import stat
from contextlib import contextmanager
from pathlib import Path
from tempfile import NamedTemporaryFile

from common import BP, RP, json_bytes, parse_json, read_json


TEXTURE_SUFFIXES = (".png", ".tga", ".jpg", ".jpeg")


IDENTIFIER = re.compile(r"[a-z][a-z0-9_]*:[a-z0-9_.-]+")
GEOMETRY = re.compile(r"geometry\.[A-Za-z0-9_.-]+")
RENDER_METHODS = {
    "opaque", "double_sided", "blend", "alpha_test", "alpha_test_single_sided",
    "blend_to_opaque", "alpha_test_to_opaque", "alpha_test_single_sided_to_opaque",
}


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


def block_assets(root, spec, plan):
    defines = definitions(root, BP / "blocks", "minecraft:block")
    models = {}
    for path in sorted((root / RP / "models").rglob("*.json")):
        for name in geometries(read_json(path)):
            if isinstance(name, str):
                models.setdefault(name, []).append(path.relative_to(root))
    atlas_path = RP / "textures/terrain_texture.json"
    atlas_file = checked_path(root, atlas_path)
    atlas_bytes = atlas_file.read_bytes() if atlas_file.exists() else None
    atlas = parse_json(atlas_bytes, atlas_file.name) if atlas_bytes is not None else {
        "resource_pack_name": "Paradise.exe RP", "texture_name": "atlas.terrain", "texture_data": {},
    }
    entries = atlas.get("texture_data")
    if not isinstance(entries, dict):
        raise ValueError("Terrain atlas must contain a texture_data object")
    before_count = len(entries)
    blocks = []
    names = set()
    for row in spec:
        fields(row, {"id", "geometry"}, {"model", "texture", "texture_path", "render_method"})
        name = row["id"]
        slug = identifier(name)
        if name in names:
            raise Conflict(f"Repeated block in batch: {name}")
        names.add(name)
        geometry = row["geometry"]
        if not isinstance(geometry, str) or not GEOMETRY.fullmatch(geometry):
            raise ValueError(f"Invalid geometry identifier: {geometry!r}")
        if "model" in row:
            source = source_path(root, row["model"])
            source_bytes = source.read_bytes()
            exported = geometries(parse_json(source_bytes, source.name))
            if (geometry not in exported or
                    any(not isinstance(item, str) or not GEOMETRY.fullmatch(item) for item in exported) or
                    len(exported) != len(set(exported))):
                raise ValueError(f"{source.name} must export {geometry} and contain unique geometry IDs")
            target = RP / f"models/blocks/{slug}.geo.json"
            existing = models.get(geometry, [])
            if len(existing) == 1 and plan.content(existing[0]) == source_bytes:
                target = existing[0]
            for item in exported:
                if any(path != target for path in models.get(item, [])):
                    raise Conflict(f"Geometry ID already defined: {item}")
                models[item] = [target]
            plan.add(target, source_bytes)
        elif len(models.get(geometry, [])) != 1:
            raise Conflict(f"Expected one existing model for {geometry}; supply model source if absent")

        if ("texture" in row) == ("texture_path" in row):
            raise ValueError(f"{name} requires exactly one of texture and texture_path")
        if "texture" in row:
            source = source_path(root, row["texture"])
            suffix = source.suffix.lower()
            if suffix not in TEXTURE_SUFFIXES:
                raise ValueError(f"Unsupported texture suffix: {suffix}")
            content = source.read_bytes()
            if suffix == ".png" and not content.startswith(b"\x89PNG\r\n\x1a\n"):
                raise ValueError(f"Invalid PNG signature: {source.name}")
            texture = f"textures/blocks/{slug}"
            plan.add(RP / f"{texture}{suffix}", content)
        else:
            texture = row["texture_path"]
            if (not isinstance(texture, str) or not re.fullmatch(r"textures/[a-zA-Z0-9_./ -]+", texture)
                    or any(part in {"", ".", ".."} for part in texture.split("/"))):
                raise ValueError(f"Invalid extensionless resource texture path: {texture!r}")
            if not any(plan.content(RP / f"{texture}{suffix}") is not None
                       for suffix in TEXTURE_SUFFIXES):
                raise Conflict(f"Missing base RP texture {texture}")
        render = row.get("render_method", "opaque")
        if not isinstance(render, str) or render not in RENDER_METHODS:
            raise ValueError(f"Invalid render_method {render!r}; choose from {sorted(RENDER_METHODS)}")
        entry = {"textures": texture}
        if slug in entries and entries[slug] != entry:
            raise Conflict(f"Different atlas entry already exists: {slug}")
        entries[slug] = entry
        blocks.append((BP / f"blocks/{slug}.json", name, {
            "format_version": "1.21.80",
            "minecraft:block": {
                "description": {"identifier": name},
                "components": {
                    "minecraft:geometry": geometry,
                    "minecraft:material_instances": {"*": {"texture": slug, "render_method": render}},
                },
            },
        }))
    if len(entries) != before_count:
        plan.add(atlas_path, json_bytes(atlas), merge_from=atlas_bytes)
    else:
        plan.add(atlas_path, atlas_bytes, merge_from=atlas_bytes)
    for relative, name, doc in blocks:
        add_document(root, plan, defines, relative, name, doc)


def dimension_assets(root, spec, plan, index):
    existing = definitions(root, BP / "dimensions", "minecraft:dimension")
    scripts = {row["name"] for row in index["rows"] if row["kind"] == "dimension" and row["resolved"]}
    names = set()
    for row in spec:
        fields(row, {"id"}, {"min_y", "height_range", "biome"})
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
    fields(spec, set(), {"blocks", "dimensions"})
    blocks, dimensions = rows(spec, "blocks"), rows(spec, "dimensions")
    plan = Plan(root)
    if blocks:
        block_assets(root, blocks, plan)
    warnings = []
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
