#!/usr/bin/env python3
"""Validate the audio audit manifest without touching or copying source audio."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any


SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
REQUIRED_ASSET_FIELDS = {
    "id",
    "pack",
    "source_path",
    "source_sha256",
    "role",
    "pool",
    "scenario_tags",
    "intensity_tier",
    "codec_profile",
    "output_path",
    "license_status",
    "source_url",
    "author",
    "attribution_text",
    "redistribution_allowed",
    "derivative_encoding_allowed",
    "evidence_path",
}


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_manifest(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise ValueError("manifest root must be an object")
    return value


def validate_manifest(manifest: dict[str, Any], project_root: Path, require_complete: bool = False) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []
    packs = manifest.get("packs")
    assets = manifest.get("assets")

    if manifest.get("schema_version") != 1:
        errors.append("schema_version must be 1")
    if not isinstance(packs, list) or not packs:
        errors.append("packs must be a non-empty array")
        packs = []
    if not isinstance(assets, list):
        errors.append("assets must be an array")
        assets = []

    pack_by_id: dict[str, dict[str, Any]] = {}
    expected_total = 0
    for pack in packs:
        if not isinstance(pack, dict):
            errors.append("every pack must be an object")
            continue
        pack_id = str(pack.get("id", ""))
        if not pack_id or pack_id in pack_by_id:
            errors.append(f"duplicate or empty pack id: {pack_id!r}")
            continue
        pack_by_id[pack_id] = pack
        expected_count = pack.get("expected_file_count")
        if not isinstance(expected_count, int) or expected_count < 1:
            errors.append(f"{pack_id}: expected_file_count must be a positive integer")
        else:
            expected_total += expected_count
        if pack.get("license_status") == "license_blocked" and pack.get("derivative_encoding_allowed") is not False:
            errors.append(f"{pack_id}: blocked pack must prohibit derivative encoding")

    if manifest.get("required_total_files") != expected_total:
        errors.append(
            f"required_total_files={manifest.get('required_total_files')} does not match pack total {expected_total}"
        )

    seen_asset_ids: set[str] = set()
    counts: dict[str, int] = {pack_id: 0 for pack_id in pack_by_id}
    for asset in assets:
        if not isinstance(asset, dict):
            errors.append("every asset must be an object")
            continue
        asset_id = str(asset.get("id", ""))
        if not asset_id or asset_id in seen_asset_ids:
            errors.append(f"duplicate or empty asset id: {asset_id!r}")
        seen_asset_ids.add(asset_id)
        missing = REQUIRED_ASSET_FIELDS - set(asset)
        if missing:
            errors.append(f"{asset_id}: missing fields: {', '.join(sorted(missing))}")
        pack_id = asset.get("pack")
        pack = pack_by_id.get(pack_id)
        if pack is None:
            errors.append(f"{asset_id}: unknown pack {pack_id!r}")
            continue
        counts[pack_id] += 1
        checksum = asset.get("source_sha256")
        if not isinstance(checksum, str) or not SHA256_RE.fullmatch(checksum):
            errors.append(f"{asset_id}: source_sha256 must be a lowercase SHA-256")
        if not isinstance(asset.get("scenario_tags"), list) or not asset["scenario_tags"]:
            errors.append(f"{asset_id}: scenario_tags must be non-empty")
        if asset.get("license_status") == "license_blocked":
            if asset.get("output_path") is not None:
                errors.append(f"{asset_id}: blocked asset cannot have an output_path")
            if asset.get("derivative_encoding_allowed") is not False:
                errors.append(f"{asset_id}: blocked asset must prohibit derivative encoding")
        if asset.get("license_status") == "cleared":
            if not asset.get("source_path") or not asset.get("output_path"):
                errors.append(f"{asset_id}: cleared asset needs source_path and output_path")
        source_path = asset.get("source_path")
        if isinstance(source_path, str) and source_path:
            resolved_source = project_root / source_path
            if not resolved_source.exists():
                warnings.append(f"{asset_id}: source is not staged at {source_path}")
            elif isinstance(checksum, str) and SHA256_RE.fullmatch(checksum):
                actual_checksum = file_sha256(resolved_source)
                if actual_checksum != checksum:
                    errors.append(
                        f"{asset_id}: source_sha256 mismatch (manifest {checksum}, actual {actual_checksum})"
                    )

    for pack_id, pack in pack_by_id.items():
        actual = counts.get(pack_id, 0)
        expected = int(pack.get("expected_file_count", 0) or 0)
        if actual != expected:
            message = f"{pack_id}: manifest has {actual} assets but requires {expected}"
            if require_complete:
                errors.append(message)
            else:
                warnings.append(message)

    if require_complete:
        for asset in assets:
            if asset.get("license_status") != "cleared":
                errors.append(f"{asset.get('id', '<unknown>')}: asset is not license-cleared")
            output_path = asset.get("output_path")
            if output_path and not (project_root / output_path).exists():
                errors.append(f"{asset.get('id', '<unknown>')}: compressed output is missing")

    return {
        "ok": not errors,
        "errors": errors,
        "warnings": warnings,
        "pack_asset_counts": counts,
        "asset_count": len(assets),
        "required_total_files": manifest.get("required_total_files"),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=Path("tools/audio_assets.json"))
    parser.add_argument("--project-root", type=Path, default=Path("."))
    parser.add_argument("--require-complete", action="store_true")
    parser.add_argument("--json", action="store_true", dest="as_json")
    args = parser.parse_args()

    try:
        report = validate_manifest(load_manifest(args.manifest), args.project_root.resolve(), args.require_complete)
    except (OSError, ValueError, json.JSONDecodeError) as error:
        report = {"ok": False, "errors": [str(error)], "warnings": []}

    if args.as_json:
        print(json.dumps(report, indent=2, sort_keys=True))
    else:
        for warning in report.get("warnings", []):
            print(f"warning: {warning}", file=sys.stderr)
        for error in report.get("errors", []):
            print(f"error: {error}", file=sys.stderr)
        print("audio manifest: " + ("ready" if report.get("ok") else "invalid"))
    return 0 if report.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
