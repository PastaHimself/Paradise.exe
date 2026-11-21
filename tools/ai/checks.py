"""Reuse repository validators and check the links introduced by the toolkit."""

import re
import subprocess

from common import BP, IMAGE_SUFFIXES, RP, read_json, strings
from validate_addon import AddonValidator
from validate_audio_manifest import load_manifest, validate_manifest
from validate_mcstructures import validate_structure_tree
from validate_resource_links import validate_resource_links


def tree_key(value, name):
    if isinstance(value, dict):
        for key, entry in value.items():
            if key == name:
                yield entry
            yield from tree_key(entry, name)
    elif isinstance(value, list):
        for entry in value:
            yield from tree_key(entry, name)


def documents(documents_by_path, root, directory):
    for path, doc in sorted(documents_by_path.items()):
        if path.is_relative_to(root / directory) and isinstance(doc, dict):
            yield path, doc


def cross_links(root, docs, index):
    issues = set()
    geometry = set()
    fog = set()
    sounds = set()
    counts = {"block_geometry": 0, "block_material": 0, "fog": 0, "sound": 0}

    def check(kind, name, choices, where):
        counts[kind] += 1
        if name not in choices:
            issues.add(f"{where}: missing {kind} {name}")

    for path, doc in documents(docs, root, RP):
        if path.is_relative_to(root / RP / "models"):
            for description in tree_key(doc.get("minecraft:geometry", []), "description"):
                if isinstance(description, dict) and isinstance(description.get("identifier"), str):
                    geometry.add(description["identifier"])
        if path.name == "sound_definitions.json":
            definitions = doc.get("sound_definitions", doc)
            if isinstance(definitions, dict):
                sounds.update(definitions)
        if path.is_relative_to(root / RP / "fogs"):
            description = doc.get("minecraft:fog_settings", {}).get("description", {})
            if isinstance(description.get("identifier"), str):
                fog.add(description["identifier"])

    atlas = docs.get(root / RP / "textures/terrain_texture.json", {})
    textures = atlas.get("texture_data", {})
    for path, doc in documents(docs, root, BP / "blocks"):
        block = doc.get("minecraft:block", {})
        name = block.get("description", {}).get("identifier")
        if not isinstance(name, str) or ":" not in name or name.startswith("minecraft:"):
            continue
        namespace, _ = name.split(":", 1)
        relative = path.relative_to(root).as_posix()
        for value in tree_key(block, "minecraft:geometry"):
            target = value.get("identifier") if isinstance(value, dict) else value
            if isinstance(target, str) and target.startswith("geometry.") and not target.startswith("geometry.minecraft."):
                check("block_geometry", target, geometry, relative)
        for instances in tree_key(block, "minecraft:material_instances"):
            if not isinstance(instances, dict):
                continue
            for material in instances.values():
                target = material.get("texture") if isinstance(material, dict) else None
                if not isinstance(target, str) or not target.startswith(f"{namespace}__"):
                    continue
                check("block_material", target, textures, relative)
                entry = textures.get(target)
                if isinstance(entry, dict):
                    for texture in strings(entry.get("textures")):
                        if not texture.startswith("textures/"):
                            continue
                        counts["block_material"] += 1
                        if not any((root / RP / f"{texture}{suffix}").is_file() for suffix in IMAGE_SUFFIXES):
                            issues.add(f"{relative}: missing block texture {texture}")

    for path, doc in documents(docs, root, RP):
        if path.name == "biomes_client.json":
            for name in tree_key(doc, "fog_identifier"):
                if isinstance(name, str) and ":" in name and not name.startswith("minecraft:"):
                    check("fog", name, fog, path.relative_to(root).as_posix())
    for row in index["rows"]:
        name = row["name"]
        where = f"{row['file']}:{row['line']}"
        if row["kind"] == "fog" and not name.startswith("minecraft:"):
            check("fog", name, fog, where)
        if row["kind"] == "sound" and name.startswith(("paradise.", "horror_recovery_ui_assets.")):
            check("sound", name, sounds, where)
    return {"errors": sorted(issues), "counts": counts}


def api_check(root, docs, index, run_types):
    tool = root / "node_modules/typescript/lib/tsc.js"
    if run_types and not tool.is_file():
        raise ValueError("TypeScript is missing; run npm install --ignore-scripts --no-audit --no-fund")
    manifest = docs.get(root / BP / "manifest.json", {})
    dependencies = {
        dep["module_name"]: dep.get("version")
        for dep in manifest.get("dependencies", [])
        if isinstance(dep, dict) and isinstance(dep.get("module_name"), str)
    }
    versions = {}
    errors = []
    for module in sorted(set(index["modules"]) | set(dependencies)):
        if not re.fullmatch(r"@minecraft/[a-z0-9_-]+", module):
            continue
        declared = dependencies.get(module)
        if not isinstance(declared, str) or not declared:
            errors.append(f"{module} requires a BP manifest dependency with a version string")
            continue
        if not run_types:
            continue
        manifest_path = root / "node_modules" / module / "package.json"
        if not manifest_path.is_file():
            raise ValueError(f"Script API typings for {module} are missing; install the version declared by the BP")
        installed = load_manifest(manifest_path)["version"]
        versions[module] = {"manifest": declared, "npm": installed}
        npm_beta = re.match(r"^(\d+\.\d+\.\d+-beta)(?:\.|$)", installed)
        if declared and declared not in {installed, npm_beta[1] if npm_beta else None, "beta" if npm_beta else None}:
            errors.append(f"{module} declares {declared} but installed typings are {installed}")
    typecheck = "blocked" if run_types else "skipped"
    if run_types and not errors:
        typecheck = "run"
        process = subprocess.run(
            ["node", str(tool), "--project", "tsconfig.json", "--noEmit", "--incremental", "false", "--pretty", "false"],
            cwd=root, capture_output=True, text=True, timeout=120,
        )
        if process.returncode:
            output = process.stdout.strip() or process.stderr.strip()
            if process.returncode < 0 or not output:
                raise ValueError(f"TypeScript terminated with status {process.returncode}")
            errors.extend(output.splitlines())
    return {"errors": errors, "counts": {"imports": len(index["modules"])}, "versions": versions,
            "typecheck": typecheck}


def validate(root, args, index):
    addon = AddonValidator(root)
    result = {
        "addon": addon.run(),
        "resource_links": validate_resource_links(root),
        "structures": validate_structure_tree(root),
        "audio": validate_manifest(load_manifest(root / "tools/audio_assets.json"), root, args.release_audio),
        "javascript": {"errors": index["errors"], "counts": {"files": index["files"]}},
    }
    # Legacy validators own malformed JSON reporting. Only inspect well-formed pack data.
    if not result["addon"]["errors"]:
        result["cross_links"] = cross_links(root, addon.json_documents, index)
        result["api"] = api_check(root, addon.json_documents, index, not args.skip_typecheck)
    else:
        result["cross_links"] = {"skipped": "Resolve add-on diagnostics first"}
        result["api"] = {"skipped": "Resolve add-on diagnostics first"}
    return result


def texture_candidates(root, script_textures):
    """Find bitmap paths with no exact reference observed in tracked pack formats."""
    rp = root / RP
    scopes = [rp, *sorted(path for path in (rp / "subpacks").glob("*") if path.is_dir())]
    references = set(script_textures)
    for directory in (root / BP, rp):
        for path in sorted(directory.rglob("*.json")):
            doc = read_json(path)
            if path.is_relative_to(rp) and path.name.endswith(".texture_set.json"):
                scope = next(scope for scope in reversed(scopes) if path.is_relative_to(scope))
                base_color = path.relative_to(scope).as_posix().removesuffix(".texture_set.json")
                references.add(base_color)
                for value in strings(doc):
                    if "/" not in value:
                        references.add((path.parent.relative_to(scope) / value).as_posix())
            for value in strings(doc):
                if value.startswith("textures/"):
                    references.add(value)
    matched = 0
    candidates = []
    for scope in scopes:
        for path in sorted((scope / "textures").rglob("*")):
            if not path.is_file() or path.suffix.lower() not in IMAGE_SUFFIXES:
                continue
            key = path.relative_to(scope).as_posix()
            if key in references or key.rsplit(".", 1)[0] in references:
                matched += 1
            else:
                candidates.append({"path": path.relative_to(root).as_posix(),
                                   "scope": scope.relative_to(rp).as_posix(), "bytes": path.stat().st_size})
    return matched, candidates
