#!/usr/bin/env python3
"""Repository-wide static validation for the Paradise.exe Bedrock add-on."""

from __future__ import annotations

import argparse
import json
import re
import sys
import uuid
from pathlib import Path
from typing import Any, Iterable


BP_NAME = "Genshin X Craft BP"
RP_NAME = "Genshin X Craft RP"
IMPORT_RE = re.compile(
    r"(?:import\s+(?:[^;]*?\s+from\s+)?|export\s+[^;]*?\s+from\s+)[\"']([^\"']+)[\"']"
)
STRUCTURE_RE = re.compile(
    r"scheduleStructurePlacement\s*\([^;]*?[\"']([a-z0-9_.-]+:[A-Za-z0-9_./-]+)[\"']",
    re.DOTALL,
)
TEXTURE_PATH_RE = re.compile(r"^textures/[A-Za-z0-9_./-]+$")


class AddonValidator:
    def __init__(self, root: Path):
        self.root = root.resolve()
        self.bp = self.root / "addon" / BP_NAME
        self.rp = self.root / "addon" / RP_NAME
        self.errors: list[str] = []
        self.warnings: list[str] = []
        self.counts: dict[str, int] = {
            "json_files": 0,
            "javascript_files": 0,
            "mcstructure_files": 0,
            "png_files": 0,
            "sound_files": 0,
            "checked_relative_imports": 0,
            "checked_structure_references": 0,
            "checked_texture_references": 0,
            "checked_sound_references": 0,
        }
        self.json_documents: dict[Path, Any] = {}

    def run(self) -> dict[str, Any]:
        self._check_pack_roots()
        if self.errors:
            return self._result()

        self._parse_all_json()
        self._check_manifests()
        self._check_script_imports()
        self._check_structure_references()
        self._check_texture_references()
        self._check_sound_references()
        self._check_binary_assets()
        return self._result()

    def _result(self) -> dict[str, Any]:
        return {
            "ok": not self.errors,
            "errors": self.errors,
            "warnings": self.warnings,
            "counts": self.counts,
        }

    def _rel(self, path: Path) -> str:
        try:
            return path.resolve().relative_to(self.root).as_posix()
        except ValueError:
            return str(path)

    def _error(self, message: str) -> None:
        self.errors.append(message)

    def _warn(self, message: str) -> None:
        self.warnings.append(message)

    def _check_pack_roots(self) -> None:
        if not self.bp.is_dir():
            self._error(f"Missing behavior pack directory: {self._rel(self.bp)}")
        if not self.rp.is_dir():
            self._error(f"Missing resource pack directory: {self._rel(self.rp)}")

    def _parse_all_json(self) -> None:
        for path in sorted((self.root / "addon").rglob("*.json")):
            self.counts["json_files"] += 1
            try:
                self.json_documents[path] = json.loads(path.read_text(encoding="utf-8-sig"))
            except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
                self._error(f"Invalid JSON {self._rel(path)}: {exc}")

    @staticmethod
    def _valid_version(value: Any) -> bool:
        return (
            isinstance(value, list)
            and len(value) == 3
            and all(isinstance(part, int) and not isinstance(part, bool) and part >= 0 for part in value)
        )

    def _check_uuid(self, value: Any, label: str, seen: set[str]) -> None:
        if not isinstance(value, str):
            self._error(f"{label} must be a UUID string")
            return
        try:
            parsed = str(uuid.UUID(value))
        except (ValueError, AttributeError):
            self._error(f"{label} is not a valid UUID: {value!r}")
            return
        if parsed in seen:
            self._error(f"Duplicate UUID in pack manifests: {value}")
        seen.add(parsed)

    def _manifest(self, pack: Path) -> dict[str, Any] | None:
        path = pack / "manifest.json"
        doc = self.json_documents.get(path)
        if not isinstance(doc, dict):
            if path.exists() and path not in self.json_documents:
                return None
            self._error(f"Missing or invalid manifest: {self._rel(path)}")
            return None
        return doc

    def _check_manifest_shape(self, pack: Path, manifest: dict[str, Any], seen: set[str]) -> None:
        label = self._rel(pack / "manifest.json")
        if manifest.get("format_version") != 2:
            self._error(f"{label}: format_version must be 2")

        header = manifest.get("header")
        if not isinstance(header, dict):
            self._error(f"{label}: header must be an object")
            return
        self._check_uuid(header.get("uuid"), f"{label} header.uuid", seen)
        if not self._valid_version(header.get("version")):
            self._error(f"{label}: header.version must be a three-integer array")
        if not self._valid_version(header.get("min_engine_version")):
            self._error(f"{label}: header.min_engine_version must be a three-integer array")

        modules = manifest.get("modules")
        if not isinstance(modules, list) or not modules:
            self._error(f"{label}: modules must be a non-empty array")
            return
        for index, module in enumerate(modules):
            if not isinstance(module, dict):
                self._error(f"{label}: modules[{index}] must be an object")
                continue
            self._check_uuid(module.get("uuid"), f"{label} modules[{index}].uuid", seen)
            if not self._valid_version(module.get("version")):
                self._error(f"{label}: modules[{index}].version must be a three-integer array")

    def _check_manifests(self) -> None:
        bp_manifest = self._manifest(self.bp)
        rp_manifest = self._manifest(self.rp)
        if bp_manifest is None or rp_manifest is None:
            return

        seen: set[str] = set()
        self._check_manifest_shape(self.bp, bp_manifest, seen)
        self._check_manifest_shape(self.rp, rp_manifest, seen)

        bp_modules = bp_manifest.get("modules", [])
        script_modules = [m for m in bp_modules if isinstance(m, dict) and m.get("type") == "script"]
        if not script_modules:
            self._error("Behavior pack manifest must contain a script module")
        for module in script_modules:
            entry = module.get("entry")
            if not isinstance(entry, str) or not entry:
                self._error("Behavior pack script module must define a non-empty entry")
                continue
            entry_path = self.bp / entry
            if not entry_path.is_file():
                self._error(f"Behavior pack script entry does not exist: {self._rel(entry_path)}")

        rp_header = rp_manifest.get("header", {})
        rp_uuid = rp_header.get("uuid")
        rp_version = rp_header.get("version")
        matching = False
        for dep in bp_manifest.get("dependencies", []):
            if not isinstance(dep, dict) or dep.get("uuid") != rp_uuid:
                continue
            matching = dep.get("version") == rp_version
            if not matching:
                self._error(
                    "Behavior-pack resource-pack dependency version does not match "
                    f"the RP header: dependency={dep.get('version')!r}, rp={rp_version!r}"
                )
            break
        else:
            self._error("Behavior-pack resource-pack dependency is missing from BP manifest")

        rp_modules = rp_manifest.get("modules", [])
        if not any(isinstance(m, dict) and m.get("type") == "resources" for m in rp_modules):
            self._error("Resource pack manifest must contain a resources module")

        for subpack in rp_manifest.get("subpacks", []):
            if not isinstance(subpack, dict):
                self._error("Resource pack subpack entries must be objects")
                continue
            folder = subpack.get("folder_name")
            if not isinstance(folder, str) or not folder:
                self._error("Resource pack subpack folder_name must be a non-empty string")
                continue
            directory = self.rp / "subpacks" / folder
            if not directory.is_dir():
                self._error(f"Resource pack subpack directory is missing: {self._rel(directory)}")

    def _iter_javascript(self) -> Iterable[Path]:
        scripts = self.bp / "scripts"
        if not scripts.is_dir():
            self._error(f"Missing scripts directory: {self._rel(scripts)}")
            return []
        paths = sorted(scripts.rglob("*.js"))
        self.counts["javascript_files"] = len(paths)
        return paths

    @staticmethod
    def _resolve_import(source: Path, specifier: str) -> list[Path]:
        target = source.parent / specifier
        candidates = [target]
        if target.suffix == "":
            candidates.extend([target.with_suffix(".js"), target / "index.js"])
        return candidates

    def _check_script_imports(self) -> None:
        for path in self._iter_javascript():
            try:
                source = path.read_text(encoding="utf-8")
            except (OSError, UnicodeDecodeError) as exc:
                self._error(f"Cannot read JavaScript {self._rel(path)}: {exc}")
                continue
            for specifier in IMPORT_RE.findall(source):
                if not specifier.startswith("."):
                    continue
                self.counts["checked_relative_imports"] += 1
                if not any(candidate.is_file() for candidate in self._resolve_import(path, specifier)):
                    self._error(
                        f"Missing relative JavaScript import in {self._rel(path)}: {specifier}"
                    )

    @staticmethod
    def _structure_path(bp: Path, identifier: str) -> Path | None:
        if ":" not in identifier:
            return None
        namespace, relative = identifier.split(":", 1)
        if not namespace or not relative or ".." in Path(relative).parts:
            return None
        return bp / "structures" / namespace / f"{relative}.mcstructure"

    def _check_structure_references(self) -> None:
        for path in self._iter_javascript():
            try:
                source = path.read_text(encoding="utf-8")
            except (OSError, UnicodeDecodeError):
                continue
            for identifier in STRUCTURE_RE.findall(source):
                self.counts["checked_structure_references"] += 1
                target = self._structure_path(self.bp, identifier)
                if target is None or not target.is_file():
                    target_label = self._rel(target) if target else identifier
                    self._error(
                        f"Missing structure reference in {self._rel(path)}: {identifier} -> {target_label}"
                    )

        structures = self.bp / "structures"
        if structures.is_dir():
            files = list(structures.rglob("*.mcstructure"))
            self.counts["mcstructure_files"] = len(files)
            for path in files:
                if path.stat().st_size == 0:
                    self._error(f"Empty mcstructure file: {self._rel(path)}")

    @staticmethod
    def _walk_strings(value: Any) -> Iterable[str]:
        if isinstance(value, str):
            yield value
        elif isinstance(value, list):
            for item in value:
                yield from AddonValidator._walk_strings(item)
        elif isinstance(value, dict):
            for item in value.values():
                yield from AddonValidator._walk_strings(item)

    def _resolve_texture(self, value: str) -> Path | None:
        if not TEXTURE_PATH_RE.match(value) or ".." in Path(value).parts:
            return None
        base = self.rp / value
        for suffix in (".png", ".tga", ".jpg", ".jpeg"):
            candidate = Path(f"{base}{suffix}")
            if candidate.is_file():
                return candidate
        return None

    def _check_texture_references(self) -> None:
        for path, doc in self.json_documents.items():
            if self.rp not in path.parents:
                continue
            for value in self._walk_strings(doc):
                if not TEXTURE_PATH_RE.match(value):
                    continue
                self.counts["checked_texture_references"] += 1
                if self._resolve_texture(value) is None:
                    kind = "Particle texture" if "particles" in path.parts else "Texture reference"
                    self._error(f"{kind} missing in {self._rel(path)}: {value}")

    def _check_sound_references(self) -> None:
        definitions = [
            path for path in self.json_documents
            if self.rp in path.parents and path.name in {"sound_definitions.json", "sounds.json"}
        ]
        for path in definitions:
            doc = self.json_documents[path]
            if path.name != "sound_definitions.json" or not isinstance(doc, dict):
                continue
            defs = doc.get("sound_definitions", doc)
            if not isinstance(defs, dict):
                continue
            for definition in defs.values():
                if not isinstance(definition, dict):
                    continue
                sounds = definition.get("sounds", [])
                if not isinstance(sounds, list):
                    continue
                for sound in sounds:
                    value = sound.get("name") if isinstance(sound, dict) else sound
                    if not isinstance(value, str) or not value or value.startswith("event:"):
                        continue
                    self.counts["checked_sound_references"] += 1
                    base = self.rp / value
                    candidates = [Path(f"{base}{suffix}") for suffix in (".ogg", ".wav", ".fsb")]
                    if not any(candidate.is_file() for candidate in candidates):
                        self._error(f"Sound reference missing in {self._rel(path)}: {value}")

    def _check_binary_assets(self) -> None:
        for path in sorted((self.root / "addon").rglob("*.png")):
            self.counts["png_files"] += 1
            try:
                header = path.read_bytes()[:8]
            except OSError as exc:
                self._error(f"Cannot read PNG {self._rel(path)}: {exc}")
                continue
            if header != b"\x89PNG\r\n\x1a\n":
                self._error(f"Invalid PNG signature: {self._rel(path)}")

        sound_paths: list[Path] = []
        for suffix in ("*.ogg", "*.wav", "*.fsb"):
            sound_paths.extend((self.root / "addon").rglob(suffix))
        self.counts["sound_files"] = len(sound_paths)
        for path in sound_paths:
            try:
                if path.stat().st_size == 0:
                    self._error(f"Empty sound asset: {self._rel(path)}")
            except OSError as exc:
                self._error(f"Cannot inspect sound asset {self._rel(path)}: {exc}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Validate the full Paradise.exe Bedrock add-on")
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--report", type=Path)
    args = parser.parse_args(argv)

    result = AddonValidator(args.root).run()
    report = json.dumps(result, indent=2, sort_keys=True)
    print(report)

    if args.report:
        report_path = args.report if args.report.is_absolute() else args.root / args.report
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(report + "\n", encoding="utf-8")

    return 0 if result["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
