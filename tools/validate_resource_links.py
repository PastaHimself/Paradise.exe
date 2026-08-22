#!/usr/bin/env python3
"""Validate semantic links between custom Bedrock resource-pack identifiers."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Iterable


RP_NAME = "Genshin X Craft RP"


def walk_strings(value: Any) -> Iterable[str]:
    if isinstance(value, str):
        yield value
    elif isinstance(value, list):
        for item in value:
            yield from walk_strings(item)
    elif isinstance(value, dict):
        for item in value.values():
            yield from walk_strings(item)


def load_json(path: Path, errors: list[str], root: Path) -> Any | None:
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        errors.append(f"Invalid JSON {path.relative_to(root).as_posix()}: {exc}")
        return None


def client_description(doc: Any) -> dict[str, Any] | None:
    if not isinstance(doc, dict):
        return None
    for key in ("minecraft:client_entity", "minecraft:attachable"):
        section = doc.get(key)
        if not isinstance(section, dict):
            continue
        description = section.get("description")
        if isinstance(description, dict):
            return description
    return None


def collect_definitions(rp: Path, root: Path, errors: list[str]) -> dict[str, set[str]]:
    definitions = {
        "geometry": set(),
        "animation": set(),
        "animation_controller": set(),
        "render_controller": set(),
    }

    for path in sorted(rp.rglob("*.json")):
        doc = load_json(path, errors, root)
        if not isinstance(doc, dict):
            continue

        geometries = doc.get("minecraft:geometry")
        if isinstance(geometries, list):
            for geometry in geometries:
                if not isinstance(geometry, dict):
                    continue
                description = geometry.get("description")
                identifier = description.get("identifier") if isinstance(description, dict) else None
                if isinstance(identifier, str) and identifier:
                    definitions["geometry"].add(identifier)

        animations = doc.get("animations")
        if isinstance(animations, dict):
            definitions["animation"].update(
                key for key in animations if isinstance(key, str) and key.startswith("animation.")
            )

        controllers = doc.get("animation_controllers")
        if isinstance(controllers, dict):
            definitions["animation_controller"].update(
                key for key in controllers if isinstance(key, str) and key.startswith("controller.animation.")
            )

        render_controllers = doc.get("render_controllers")
        if isinstance(render_controllers, dict):
            definitions["render_controller"].update(
                key for key in render_controllers if isinstance(key, str) and key.startswith("controller.render.")
            )

    return definitions


def validate_resource_links(root: Path) -> dict[str, Any]:
    root = root.resolve()
    rp = root / "addon" / RP_NAME
    errors: list[str] = []
    warnings: list[str] = []
    counts = {
        "custom_client_entities": 0,
        "geometry_definitions": 0,
        "animation_definitions": 0,
        "animation_controller_definitions": 0,
        "render_controller_definitions": 0,
        "checked_geometry_references": 0,
        "checked_animation_references": 0,
        "checked_animation_controller_references": 0,
        "checked_render_controller_references": 0,
    }

    if not rp.is_dir():
        return {"ok": False, "errors": [f"Missing resource pack: {rp}"], "warnings": [], "counts": counts}

    definitions = collect_definitions(rp, root, errors)
    counts["geometry_definitions"] = len(definitions["geometry"])
    counts["animation_definitions"] = len(definitions["animation"])
    counts["animation_controller_definitions"] = len(definitions["animation_controller"])
    counts["render_controller_definitions"] = len(definitions["render_controller"])

    entity_root = rp / "entity"
    attachable_root = rp / "attachables"
    client_files: list[Path] = []
    if entity_root.is_dir():
        client_files.extend(sorted(entity_root.rglob("*.json")))
    if attachable_root.is_dir():
        client_files.extend(sorted(attachable_root.rglob("*.json")))

    for path in client_files:
        doc = load_json(path, errors, root)
        description = client_description(doc)
        if not description:
            continue

        identifier = description.get("identifier")
        if not isinstance(identifier, str) or not identifier:
            continue
        if identifier.startswith("minecraft:"):
            # Vanilla client entities/attachables may intentionally resolve
            # geometry, animation, and controller identifiers from the base RP.
            continue

        counts["custom_client_entities"] += 1
        relative = path.relative_to(root).as_posix()

        geometries = description.get("geometry", {})
        if isinstance(geometries, dict):
            for reference in geometries.values():
                if not isinstance(reference, str) or not reference.startswith("geometry."):
                    continue
                counts["checked_geometry_references"] += 1
                if reference not in definitions["geometry"]:
                    errors.append(f"Missing geometry reference in {relative}: {reference}")

        animations = description.get("animations", {})
        if isinstance(animations, dict):
            for reference in animations.values():
                if not isinstance(reference, str):
                    continue
                if reference.startswith("animation."):
                    counts["checked_animation_references"] += 1
                    if reference not in definitions["animation"]:
                        errors.append(f"Missing animation reference in {relative}: {reference}")
                elif reference.startswith("controller.animation."):
                    counts["checked_animation_controller_references"] += 1
                    if reference not in definitions["animation_controller"]:
                        errors.append(f"Missing animation controller reference in {relative}: {reference}")

        render_controllers = description.get("render_controllers", [])
        for reference in walk_strings(render_controllers):
            if not reference.startswith("controller.render."):
                continue
            counts["checked_render_controller_references"] += 1
            if reference not in definitions["render_controller"]:
                errors.append(f"Missing render controller reference in {relative}: {reference}")

    return {"ok": not errors, "errors": errors, "warnings": warnings, "counts": counts}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Validate Bedrock resource-pack semantic identifier links")
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--report", type=Path)
    args = parser.parse_args(argv)

    result = validate_resource_links(args.root)
    report = json.dumps(result, indent=2, sort_keys=True)
    print(report)

    if args.report:
        report_path = args.report if args.report.is_absolute() else args.root / args.report
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(report + "\n", encoding="utf-8")

    return 0 if result["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
