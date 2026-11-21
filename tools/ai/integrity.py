"""Cross-pack reference integrity beyond the legacy validators.

Covers references the existing validators do not: particles, spawned entities,
spawned items, structure IDs, BP entity <-> RP client entity pairing, loot
table paths, item icons vs item_texture.json, lang keys, and subpack folders.
Errors mean a referenced definition or file is missing; warnings are leads
(unreferenced definitions) that still need human or in-game confirmation.
"""

import re
from collections import Counter
from pathlib import Path

from common import BP, RP, read_json, strings
from structures import structure_id

ID_RE = re.compile(r"^[a-z][a-z0-9_]*:[a-z0-9_./-]+$")
# Dotted identifiers without a colon: sound events (paradise.stalker.roar),
# geometry/animation/controller IDs (geometry.flashlight).
DOTTED_RE = re.compile(r"^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$")
SOUND_SUFFIXES = (".ogg", ".wav", ".fsb", ".mcogg")


def referenced_identifiers(root, index):
    found = set(index.get("identifiers", []))
    for pack in (BP, RP):
        directory = root / pack
        if not directory.is_dir():
            continue
        for path in sorted(directory.rglob("*.json")):
            try:
                doc = read_json(path)
            except ValueError:
                continue
            for value in strings(doc):
                if ID_RE.match(value) or DOTTED_RE.match(value):
                    found.add(value)
    return found


def lang_keys(path):
    keys = {}
    if path.is_file():
        for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                key, _, value = line.partition("=")
                keys[key.strip()] = value.strip()
    return keys


def integrity(root, index):
    errors = []
    warnings = []
    counts = {}
    bp, rp = root / BP, root / RP
    referenced = referenced_identifiers(root, index)

    def error(message):
        errors.append(message)

    def warn(message):
        warnings.append(message)

    # Particles: defined in RP/particles, referenced from scripts or JSON.
    particles = {}
    for path in sorted((rp / "particles").rglob("*.json")) if (rp / "particles").is_dir() else []:
        try:
            doc = read_json(path)
        except ValueError as exc:
            error(f"{path.relative_to(root).as_posix()}: unparsable particle JSON: {exc}")
            continue
        name = doc.get("particle_effect", {}).get("description", {}).get("identifier")
        if isinstance(name, str):
            particles[name] = path.relative_to(root).as_posix()
    counts["particles_defined"] = len(particles)
    for row in index["rows"]:
        if row["kind"] == "particle" and not row["name"].startswith("minecraft:") and row["name"] not in particles:
            error(f"{row['file']}:{row['line']}: missing particle definition {row['name']}")
    for name, relative in sorted(particles.items()):
        if name not in referenced:
            warn(f"{relative}: particle {name} is never referenced by any observed literal")
    counts["particle_references"] = sum(1 for row in index["rows"] if row["kind"] == "particle")

    # Entities: spawnEntity literals vs BP definitions; BP <-> RP client pairing.
    bp_entities = {}
    entities_dir = bp / "entities"
    for path in sorted(entities_dir.rglob("*.json")) if entities_dir.is_dir() else []:
        try:
            doc = read_json(path)
        except ValueError as exc:
            error(f"{path.relative_to(root).as_posix()}: unparsable entity JSON: {exc}")
            continue
        entity = doc.get("minecraft:entity")
        if not isinstance(entity, dict):
            continue
        name = entity.get("description", {}).get("identifier")
        if isinstance(name, str) and ID_RE.match(name):
            bp_entities[name] = (path.relative_to(root).as_posix(), entity)
    counts["behavior_entities"] = len(bp_entities)
    client_entities = set()
    entity_dir = rp / "entity"
    for path in sorted(entity_dir.rglob("*.entity.json")) if entity_dir.is_dir() else []:
        try:
            doc = read_json(path)
        except ValueError:
            continue
        client = doc.get("minecraft:client_entity")
        name = client.get("description", {}).get("identifier") if isinstance(client, dict) else None
        if isinstance(name, str) and ID_RE.match(name):
            client_entities.add(name)
    counts["client_entities"] = len(client_entities)
    for row in index["rows"]:
        if row["kind"] == "entity" and not row["name"].startswith("minecraft:") and row["name"] not in bp_entities:
            error(f"{row['file']}:{row['line']}: spawnEntity references missing entity {row['name']}")
    counts["entity_spawn_references"] = sum(1 for row in index["rows"] if row["kind"] == "entity")
    for name, (relative, entity) in sorted(bp_entities.items()):
        if not name.startswith("minecraft:") and name not in client_entities:
            warn(f"{relative}: custom entity {name} has no RP client entity")
        loot = entity.get("components", {}).get("minecraft:loot", {})
        table = loot.get("table") if isinstance(loot, dict) else None
        if isinstance(table, str) and not (bp / table).is_file():
            error(f"{relative}: missing loot table {table}")
    for name in sorted(client_entities):
        if not name.startswith("minecraft:") and name not in bp_entities:
            warn(f"RP client entity {name} has no BP entity definition")

    # Items: ItemStack literals vs BP items; icons vs item_texture.json; lang keys.
    bp_items = {}
    items_dir = bp / "items"
    item_texture = {}
    item_texture_path = rp / "textures/item_texture.json"
    if item_texture_path.is_file():
        item_texture = read_json(item_texture_path).get("texture_data", {})
    for path in sorted(items_dir.rglob("*.json")) if items_dir.is_dir() else []:
        try:
            doc = read_json(path)
        except ValueError as exc:
            error(f"{path.relative_to(root).as_posix()}: unparsable item JSON: {exc}")
            continue
        item = doc.get("minecraft:item")
        if not isinstance(item, dict):
            continue
        name = item.get("description", {}).get("identifier")
        if isinstance(name, str) and ID_RE.match(name):
            bp_items[name] = (path.relative_to(root).as_posix(), item)
    counts["behavior_items"] = len(bp_items)
    for row in index["rows"]:
        if row["kind"] == "item" and not row["name"].startswith("minecraft:") and row["name"] not in bp_items:
            error(f"{row['file']}:{row['line']}: ItemStack references missing item {row['name']}")
    counts["item_references"] = sum(1 for row in index["rows"] if row["kind"] == "item")
    bp_lang = lang_keys(bp / "texts/en_US.lang")
    for name, (relative, item) in sorted(bp_items.items()):
        components = item.get("components", {})
        icon = components.get("minecraft:icon")
        if isinstance(icon, str) and ":" in icon and not icon.startswith("minecraft:") and icon not in item_texture:
            error(f"{relative}: item icon {icon} has no item_texture.json entry")
        display = components.get("minecraft:display_name", {})
        value = display.get("value") if isinstance(display, dict) else None
        if isinstance(value, str) and value not in bp_lang:
            warn(f"{relative}: display name key {value} is missing from BP texts/en_US.lang")
    for key in sorted(item_texture):
        if ":" in key and not key.startswith("minecraft:") and key not in referenced:
            warn(f"textures/item_texture.json: item texture {key} is never referenced by any observed literal")
    counts["item_texture_entries"] = len(item_texture)

    # Structures: referenced IDs vs .mcstructure files.
    structures_dir = bp / "structures"
    structure_files = {}
    if structures_dir.is_dir():
        for path in sorted(structures_dir.rglob("*.mcstructure")):
            structure_files[structure_id(path.relative_to(structures_dir))] = path.relative_to(root).as_posix()
    counts["structure_files"] = len(structure_files)
    referenced_structures = {row["name"] for row in index["rows"] if row["kind"] == "structure"}
    referenced_structures |= {value for value in referenced if "/" in value.split(":", 1)[-1]}
    for name in sorted(referenced_structures):
        if not name.startswith("minecraft:") and name not in structure_files:
            error(f"structure reference {name} has no .mcstructure file under BP/structures")
    for name, relative in sorted(structure_files.items()):
        if name not in referenced_structures:
            warn(f"{relative}: structure {name} is never referenced by any observed literal")
    counts["structure_references"] = len(referenced_structures)

    # Sound events: defined keys vs observed playSound references.
    sound_defs_path = rp / "sounds/sound_definitions.json"
    sound_defs = {}
    if sound_defs_path.is_file():
        doc = read_json(sound_defs_path)
        definitions = doc.get("sound_definitions", doc)
        if isinstance(definitions, dict):
            sound_defs = definitions
    counts["sound_definitions"] = len(sound_defs)
    for name in sorted(sound_defs):
        if not name.startswith("minecraft:") and name not in referenced:
            warn(f"sounds/sound_definitions.json: sound event {name} is never referenced by any observed literal")
    counts["sound_references"] = sum(1 for row in index["rows"] if row["kind"] == "sound")

    # Subpacks and language files declared by manifests.
    rp_manifest = read_json(rp / "manifest.json")
    subpacks = {entry.get("folder_name") for entry in rp_manifest.get("subpacks", []) if isinstance(entry, dict)}
    subpack_dir = rp / "subpacks"
    if subpack_dir.is_dir():
        on_disk = {path.name for path in subpack_dir.iterdir() if path.is_dir()}
        for folder in sorted(subpacks):
            if folder not in on_disk:
                error(f"RP manifest subpack {folder!r} has no subpacks/{folder} directory")
        for folder in sorted(on_disk - subpacks):
            warn(f"subpacks/{folder} is not declared in the RP manifest")
    counts["subpacks"] = len(subpacks)
    for pack, base in ((BP, bp), (RP, rp)):
        manifest = read_json(base / "manifest.json")
        languages_path = base / "texts/languages.json"
        if languages_path.is_file():
            for language in read_json(languages_path):
                if not (base / "texts" / f"{language}.lang").is_file():
                    error(f"{pack}: texts/{language}.lang declared in languages.json is missing")
    return {"errors": errors, "warnings": warnings, "counts": counts}
