#!/usr/bin/env python3
"""Generate semantic Bedrock sound definitions from encoded manifest outputs."""

from __future__ import annotations

import argparse
import json
import os
import re
import tempfile
from pathlib import Path
from typing import Any

try:
    from tools.validate_audio_manifest import asset_output_paths, load_manifest, validate_manifest
except ModuleNotFoundError:  # Direct ``python tools/<script>.py`` invocation.
    from validate_audio_manifest import asset_output_paths, load_manifest, validate_manifest


RESOURCE_PACK_PREFIX = "addon/Genshin X Craft RP/"
DEFAULT_RUNTIME_REGISTRY = Path("addon/Genshin X Craft BP/scripts/paradise_generated_audio_registry.js")


def _sound_name(output_path: str) -> str:
    normalized = output_path.replace("\\", "/")
    if normalized.startswith(RESOURCE_PACK_PREFIX):
        normalized = normalized[len(RESOURCE_PACK_PREFIX):]
    if normalized.lower().endswith(".ogg"):
        normalized = normalized[:-4]
    return normalized


def build_sound_definitions(manifest: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Build only definitions backed by cleared manifest outputs."""

    assets = manifest.get("assets", [])
    definitions: dict[str, dict[str, Any]] = {}
    for pack in manifest.get("packs", []):
        if not isinstance(pack, dict):
            continue
        runtime_sound_ids = pack.get("runtime_sound_ids", [])
        if not isinstance(runtime_sound_ids, list):
            continue
        paths: list[str] = []
        for asset in assets:
            if not isinstance(asset, dict) or asset.get("pack") != pack.get("id"):
                continue
            if asset.get("license_status") != "cleared":
                continue
            paths.extend(asset_output_paths(asset))
        sound_names = sorted({_sound_name(path) for path in paths})
        if not sound_names:
            continue
        sounds = [{"name": name} for name in sound_names]
        for sound_id in runtime_sound_ids:
            if isinstance(sound_id, str) and sound_id:
                definitions[sound_id] = {"category": "ambient", "sounds": sounds}
    return definitions


def _ready_sound_definitions(manifest: dict[str, Any], project_root: Path) -> dict[str, dict[str, Any]]:
    definitions = build_sound_definitions(manifest)
    ready: dict[str, dict[str, Any]] = {}
    assets = manifest.get("assets", [])
    for pack in manifest.get("packs", []):
        if not isinstance(pack, dict):
            continue
        runtime_sound_ids = pack.get("runtime_sound_ids", [])
        pack_assets = [
            asset for asset in assets
            if isinstance(asset, dict) and asset.get("pack") == pack.get("id")
        ]
        expected_count = pack.get("expected_file_count")
        if not isinstance(expected_count, int) or len(pack_assets) != expected_count:
            continue
        if any(asset.get("license_status") != "cleared" for asset in pack_assets):
            continue
        output_paths = [
            path
            for asset in pack_assets
            if asset.get("license_status") == "cleared"
            for path in asset_output_paths(asset)
        ]
        if not output_paths or not all((project_root / path).is_file() for path in output_paths):
            continue
        for sound_id in runtime_sound_ids:
            if sound_id in definitions:
                ready[sound_id] = definitions[sound_id]
    return ready


def _load_sound_document(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        document = json.load(handle)
    if not isinstance(document, dict):
        raise ValueError("sound definition root must be an object")
    if not isinstance(document.get("sound_definitions"), dict):
        raise ValueError("sound_definitions must be an object")
    return document


def _write_json_atomic(path: Path, document: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        mode="w",
        encoding="utf-8",
        prefix=f".{path.stem}.",
        suffix=".tmp",
        dir=path.parent,
        delete=False,
    ) as handle:
        temporary = Path(handle.name)
        json.dump(document, handle, indent=2, ensure_ascii=False)
        handle.write("\n")
    try:
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def _load_runtime_ids(path: Path) -> list[str]:
    with path.open("r", encoding="utf-8") as handle:
        source = handle.read()
    match = re.search(r"GENERATED_AUDIO_READY_IDS\s*=\s*Object\.freeze\((\[[\s\S]*?\])\)", source)
    if not match:
        raise ValueError("generated audio registry has no GENERATED_AUDIO_READY_IDS export")
    value = json.loads(match.group(1))
    if not isinstance(value, list) or any(not isinstance(item, str) for item in value):
        raise ValueError("generated audio registry IDs must be a string array")
    return value


def _write_runtime_registry(path: Path, sound_ids: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    content = (
        "/** Generated by tools/generate_sound_definitions.py; do not edit manually. */\n"
        "export const GENERATED_AUDIO_READY_IDS = Object.freeze("
        + json.dumps(sorted(sound_ids), indent=2)
        + ");\n"
    )
    with tempfile.NamedTemporaryFile(
        mode="w",
        encoding="utf-8",
        prefix=f".{path.stem}.",
        suffix=".tmp",
        dir=path.parent,
        delete=False,
    ) as handle:
        temporary = Path(handle.name)
        handle.write(content)
    try:
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=Path("tools/audio_assets.json"))
    parser.add_argument(
        "--sound-definitions",
        type=Path,
        default=Path("addon/Genshin X Craft RP/sounds/sound_definitions.json"),
    )
    parser.add_argument("--runtime-registry", type=Path, default=DEFAULT_RUNTIME_REGISTRY)
    parser.add_argument("--project-root", type=Path, default=Path("."))
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--require-complete", action="store_true")
    args = parser.parse_args()

    try:
        manifest = load_manifest(args.manifest)
        report = validate_manifest(manifest, args.project_root.resolve(), args.require_complete)
        if args.require_complete and not report["ok"]:
            raise ValueError("audio manifest is not release-ready")
        document = _load_sound_document(args.sound_definitions)
        expected = _ready_sound_definitions(manifest, args.project_root.resolve())
        if args.require_complete:
            missing_runtime_ids = sorted(
                sound_id
                for pack in manifest.get("packs", [])
                if isinstance(pack, dict)
                for sound_id in pack.get("runtime_sound_ids", [])
                if sound_id not in expected
            )
            if missing_runtime_ids:
                raise ValueError(
                    "runtime sound definitions have no encoded outputs: "
                    + ", ".join(missing_runtime_ids)
                )
        existing = document["sound_definitions"]
        mismatches = [
            sound_id
            for sound_id, definition in expected.items()
            if existing.get(sound_id) != definition
        ]
        if args.check and mismatches:
            raise ValueError(f"sound definitions are stale: {', '.join(sorted(mismatches))}")
        expected_runtime_ids = sorted(expected)
        existing_runtime_ids = _load_runtime_ids(args.runtime_registry)
        if args.check and existing_runtime_ids != expected_runtime_ids:
            raise ValueError("generated audio runtime registry is stale")
        if args.write:
            existing.update(expected)
            _write_json_atomic(args.sound_definitions, document)
            _write_runtime_registry(args.runtime_registry, expected_runtime_ids)
        print(json.dumps({"ok": True, "generated": expected_runtime_ids, "updated": sorted(mismatches)}, indent=2))
        return 0
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"sound definition generation blocked: {error}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
