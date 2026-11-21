"""Plan (dry-run by default) and optionally apply removal of unreferenced RP assets.

Never touches a referenced file: candidates come from the same reference scan
as `assets`/`integrity`, and --apply re-runs the scan and deletes only files
that are still unreferenced at apply time. Textures are the default scope;
sounds, particles, models, and fogs are opt-in because their references can be
dynamic in-game.
"""

from pathlib import Path

from common import RP, page, read_json
from checks import texture_candidates
from integrity import SOUND_SUFFIXES, referenced_identifiers
from scaffold import definitions

SCOPES = ("textures", "sounds", "particles", "models", "fogs")


def collect(root, args, index):
    scopes = set()
    for scope in args.scope or ["textures"]:
        scopes.update(SCOPES if scope == "all" else (scope,))
    referenced = referenced_identifiers(root, index)
    candidates = []
    groups = {}

    def add_group(scope, items):
        groups[scope] = {"files": len(items), "bytes": sum(item["bytes"] for item in items)}
        candidates.extend({**item, "scope": scope} for item in items)

    if "textures" in scopes:
        matched, found = texture_candidates(root, index["textures"])
        items = [item for item in found if args.include_subpacks or item["scope"] == "."]
        add_group("textures", items)
        groups["textures"]["matched"] = matched
    if "sounds" in scopes:
        rp_sounds = root / RP / "sounds"
        referenced_sound_files = set()
        defs_path = rp_sounds / "sound_definitions.json"
        if defs_path.is_file():
            sound_defs_doc = read_json(defs_path).get("sound_definitions", {})
            for definition in sound_defs_doc.values():
                if not isinstance(definition, dict):
                    continue
                for entry in definition.get("sounds", []):
                    name = entry.get("name") if isinstance(entry, dict) else entry
                    if not isinstance(name, str):
                        continue
                    for suffix in SOUND_SUFFIXES:
                        candidate = root / RP / f"{name}{suffix}"
                        if candidate.is_file():
                            referenced_sound_files.add(candidate.relative_to(root).as_posix())
        items = []
        for path in sorted(rp_sounds.rglob("*")) if rp_sounds.is_dir() else []:
            if path.is_file() and path.suffix.lower() in SOUND_SUFFIXES:
                relative = path.relative_to(root).as_posix()
                if relative not in referenced_sound_files:
                    items.append({"path": relative, "bytes": path.stat().st_size})
        add_group("sounds", items)
    if "particles" in scopes or "fogs" in scopes or "models" in scopes:
        for scope, directory, key, root_key in (
            ("particles", root / RP / "particles", "particle_effect", "description"),
            ("fogs", root / RP / "fogs", "minecraft:fog_settings", "description"),
            ("models", root / RP / "models", "minecraft:geometry", None),
        ):
            if scope not in scopes or not directory.is_dir():
                continue
            if scope == "models":
                defined = {}
                for path in sorted(directory.rglob("*.json")):
                    try:
                        doc = read_json(path)
                    except ValueError:
                        continue
                    for entry in doc.get("minecraft:geometry", []) if isinstance(doc, dict) else []:
                        name = entry.get("description", {}).get("identifier") if isinstance(entry, dict) else None
                        if isinstance(name, str):
                            defined.setdefault(name, []).append(path.relative_to(root))
            else:
                defined = definitions(root, directory.relative_to(root), key)
            items = []
            for name, paths in sorted(defined.items()):
                if name in referenced:
                    continue
                for path in paths:
                    full = root / path
                    if full.is_file():
                        items.append({"path": path.as_posix(), "bytes": full.stat().st_size, "id": name})
            add_group(scope, items)
    total_files = len(candidates)
    total_bytes = sum(item["bytes"] for item in candidates)
    return {
        "scopes": sorted(scopes),
        "groups": groups,
        "total_files": total_files,
        "total_bytes": total_bytes,
        "candidates": sorted(candidates, key=lambda item: (item["scope"], item["path"])),
    }


def prune(root, args, index):
    if index["errors"]:
        raise ValueError("Fix JavaScript parse errors before pruning; refusing to plan on a broken index")
    plan = collect(root, args, index)
    report = {
        "mode": "apply" if args.apply else "dry-run",
        "scopes": plan["scopes"],
        "groups": plan["groups"],
        "total_files": plan["total_files"],
        "total_bytes": plan["total_bytes"],
        "savings_bytes": plan["total_bytes"],
        **page(plan["candidates"], args),
    }
    if not args.apply:
        report["action"] = "plan"
        return False, report
    # Re-verify at apply time: only files still unreferenced right now are removed.
    fresh = collect(root, args, index)
    fresh_paths = {item["path"] for item in fresh["candidates"]}
    deleted, skipped = [], []
    for item in plan["candidates"]:
        if item["path"] not in fresh_paths:
            skipped.append({**item, "reason": "became referenced during apply"})
            continue
        path = root / item["path"]
        if path.is_symlink() or not path.is_file():
            skipped.append({**item, "reason": "not a regular file"})
            continue
        path.unlink()
        deleted.append(item)
    report.update({
        "action": "applied",
        "deleted": page(deleted, args),
        "skipped": page(skipped, args),
    })
    return False, report
