#!/usr/bin/env python3
"""Validate the audio audit manifest without touching or copying source audio."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from math import ceil
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


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
    "license_name",
    "attribution_text",
    "redistribution_allowed",
    "derivative_encoding_allowed",
    "evidence_path",
}
LICENSE_AUTHORITY_FIELDS = (
    "license_status",
    "source_url",
    "author",
    "license_name",
    "attribution_text",
    "redistribution_allowed",
    "derivative_encoding_allowed",
    "evidence_path",
)
ALLOWED_LICENSE_STATUSES = {"cleared", "license_blocked", "pending_source"}


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


def asset_output_paths(asset: dict[str, Any]) -> list[str]:
    """Return every encoded output path, supporting the legacy singular field."""

    output_paths = asset.get("output_paths")
    if isinstance(output_paths, list):
        return [path for path in output_paths if isinstance(path, str) and path]
    output_path = asset.get("output_path")
    return [output_path] if isinstance(output_path, str) and output_path else []


def _inside_project(project_root: Path, raw_path: Any) -> Path | None:
    if not isinstance(raw_path, str) or not raw_path.strip():
        return None
    candidate = (project_root / raw_path).resolve()
    try:
        candidate.relative_to(project_root)
    except ValueError:
        return None
    return candidate


def _valid_url(value: Any) -> bool:
    if not isinstance(value, str) or not value.strip():
        return False
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def _number(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    return numeric if numeric > 0 else None


def _expected_channels(asset: dict[str, Any]) -> int:
    return 1 if asset.get("codec_profile") in {"voice_entity", "footstep_stinger"} else 2


def _probe_encoded_output(asset: dict[str, Any], output: Path, ffprobe: str) -> list[str]:
    asset_id = asset.get("id", "<unknown>")
    try:
        result = subprocess.run(
            [
                ffprobe,
                "-v",
                "error",
                "-show_streams",
                "-show_format",
                "-of",
                "json",
                str(output),
            ],
            check=True,
            text=True,
            capture_output=True,
        )
    except FileNotFoundError:
        return [f"{asset_id}: required executable is missing: {ffprobe}"]
    except subprocess.CalledProcessError as error:
        detail = (error.stderr or error.stdout or "").strip()
        return [f"{asset_id}: ffprobe rejected {output}: {detail}"]
    try:
        report = json.loads(result.stdout)
    except json.JSONDecodeError as error:
        return [f"{asset_id}: ffprobe returned invalid JSON: {error}"]

    streams = [stream for stream in report.get("streams", []) if stream.get("codec_type") == "audio"]
    if len(streams) != 1:
        return [f"{asset_id}: output must contain exactly one audio stream: {output}"]
    stream = streams[0]
    errors: list[str] = []
    if stream.get("codec_name") != "vorbis":
        errors.append(f"{asset_id}: output codec is not Vorbis: {output}")
    duration = _number(stream.get("duration") or report.get("format", {}).get("duration"))
    if duration is None:
        errors.append(f"{asset_id}: encoded duration is not positive: {output}")
    if int(stream.get("channels") or 0) != _expected_channels(asset):
        errors.append(f"{asset_id}: output has the wrong channel count: {output}")
    if int(stream.get("sample_rate") or 0) != 44100:
        errors.append(f"{asset_id}: output must be 44100 Hz: {output}")
    return errors


def validate_manifest(
    manifest: dict[str, Any],
    project_root: Path,
    require_complete: bool = False,
    ffprobe: str = "ffprobe",
) -> dict[str, Any]:
    project_root = project_root.resolve()
    resource_pack_root = (project_root / "addon" / "Genshin X Craft RP").resolve()
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

    compression = manifest.get("compression")
    if not isinstance(compression, dict):
        errors.append("compression must be an object")
        compression = {}
    max_bed_segment = _number(compression.get("max_bed_segment_seconds"))
    if max_bed_segment is None:
        errors.append("compression.max_bed_segment_seconds must be positive")
    crossfade_ms = compression.get("loop_crossfade_milliseconds", 0)
    if isinstance(crossfade_ms, bool) or not isinstance(crossfade_ms, (int, float)) or crossfade_ms < 0:
        errors.append("compression.loop_crossfade_milliseconds must be non-negative")
        crossfade_ms = 0
    elif max_bed_segment is not None and crossfade_ms >= max_bed_segment * 1000:
        errors.append("compression.loop_crossfade_milliseconds must be shorter than a bed segment")
    max_encoded_size = compression.get("max_encoded_size_bytes")
    if max_encoded_size is not None and (
        isinstance(max_encoded_size, bool)
        or not isinstance(max_encoded_size, int)
        or max_encoded_size <= 0
    ):
        errors.append("compression.max_encoded_size_bytes must be a positive integer when present")

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
        if not isinstance(expected_count, int) or isinstance(expected_count, bool) or expected_count < 1:
            errors.append(f"{pack_id}: expected_file_count must be a positive integer")
        else:
            expected_total += expected_count
        status = pack.get("license_status")
        if status not in ALLOWED_LICENSE_STATUSES:
            errors.append(f"{pack_id}: unknown license_status={status!r}")
        if status == "license_blocked" and pack.get("derivative_encoding_allowed") is not False:
            errors.append(f"{pack_id}: blocked pack must prohibit derivative encoding")
        for boolean_field in ("redistribution_allowed", "derivative_encoding_allowed"):
            if not isinstance(pack.get(boolean_field), bool):
                errors.append(f"{pack_id}: {boolean_field} must be boolean")
        if status == "cleared":
            for field in ("author", "license_name", "attribution_text"):
                if not isinstance(pack.get(field), str) or not pack[field].strip():
                    errors.append(f"{pack_id}: cleared pack requires {field}")
            if not _valid_url(pack.get("source_url")):
                errors.append(f"{pack_id}: cleared pack requires an http(s) source_url")
            evidence = _inside_project(project_root, pack.get("evidence_path"))
            if evidence is None:
                errors.append(f"{pack_id}: cleared pack requires an evidence_path inside the project")
            elif not evidence.is_file():
                errors.append(f"{pack_id}: license evidence is missing: {pack.get('evidence_path')}")
        elif pack.get("source_url") is not None and not _valid_url(pack.get("source_url")):
            errors.append(f"{pack_id}: source_url must be an http(s) URL when provided")
        if pack.get("evidence_path") is not None and _inside_project(project_root, pack.get("evidence_path")) is None:
            errors.append(f"{pack_id}: evidence_path must stay inside the project")

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
        for authoritative_field in LICENSE_AUTHORITY_FIELDS:
            if asset.get(authoritative_field) != pack.get(authoritative_field):
                errors.append(f"{asset_id}: {authoritative_field} disagrees with pack {pack_id}")
        checksum = asset.get("source_sha256")
        if not isinstance(checksum, str) or not SHA256_RE.fullmatch(checksum):
            errors.append(f"{asset_id}: source_sha256 must be a lowercase SHA-256")
        if not isinstance(asset.get("scenario_tags"), list) or not asset["scenario_tags"]:
            errors.append(f"{asset_id}: scenario_tags must be non-empty")

        source_path = asset.get("source_path")
        resolved_source = _inside_project(project_root, source_path)
        if resolved_source is None:
            errors.append(f"{asset_id}: source_path must stay inside project")

        output_path = asset.get("output_path")
        if output_path is not None and not isinstance(output_path, str):
            errors.append(f"{asset_id}: output_path must be a string or null")
        raw_output_paths = asset.get("output_paths")
        if raw_output_paths is not None and not isinstance(raw_output_paths, list):
            errors.append(f"{asset_id}: output_paths must be an array when present")
        elif isinstance(raw_output_paths, list):
            for path in raw_output_paths:
                if not isinstance(path, str) or not path:
                    errors.append(f"{asset_id}: output_paths must contain non-empty strings")
        output_paths = asset_output_paths(asset)
        if output_path and output_paths and output_paths[0] != output_path:
            errors.append(f"{asset_id}: output_path must match the first output_paths entry")
        for output in output_paths:
            resolved_output = _inside_project(project_root, output)
            if resolved_output is None:
                errors.append(f"{asset_id}: output path must stay inside project: {output}")
            elif resource_pack_root not in resolved_output.parents or resolved_output.suffix.lower() != ".ogg":
                errors.append(f"{asset_id}: output path must be an .ogg inside the resource pack: {output}")

        status = asset.get("license_status")
        if status == "license_blocked":
            if output_paths:
                errors.append(f"{asset_id}: blocked asset cannot have encoded outputs")
            if asset.get("derivative_encoding_allowed") is not False:
                errors.append(f"{asset_id}: blocked asset must prohibit derivative encoding")
        if status == "cleared":
            for field in ("source_url", "author", "license_name", "attribution_text"):
                if not isinstance(asset.get(field), str) or not asset[field].strip():
                    errors.append(f"{asset_id}: cleared asset requires {field}")
            if not _valid_url(asset.get("source_url")):
                errors.append(f"{asset_id}: cleared asset requires an http(s) source_url")
            evidence = _inside_project(project_root, asset.get("evidence_path"))
            if evidence is None:
                errors.append(f"{asset_id}: cleared asset requires an evidence_path inside the project")
            elif not evidence.is_file():
                errors.append(f"{asset_id}: license evidence is missing: {asset.get('evidence_path')}")
            if resolved_source is None or not source_path or not output_paths:
                errors.append(f"{asset_id}: cleared asset needs source_path and at least one output path")

        if resolved_source is not None and not resolved_source.exists():
            if isinstance(source_path, str) and source_path:
                warnings.append(f"{asset_id}: source is not staged at {source_path}")
        elif resolved_source is not None and resolved_source.is_file() and isinstance(checksum, str) and SHA256_RE.fullmatch(checksum):
            actual_checksum = file_sha256(resolved_source)
            if actual_checksum != checksum:
                errors.append(
                    f"{asset_id}: source_sha256 mismatch (manifest {checksum}, actual {actual_checksum})"
                )

        duration = asset.get("duration_seconds")
        if duration is not None and _number(duration) is None:
            errors.append(f"{asset_id}: duration_seconds must be positive when present")
        segment_durations = asset.get("segment_durations_seconds")
        if segment_durations is not None:
            if not isinstance(segment_durations, list) or any(_number(value) is None for value in segment_durations):
                errors.append(f"{asset_id}: segment_durations_seconds must contain positive numbers")
            elif len(segment_durations) != len(output_paths):
                errors.append(f"{asset_id}: segment durations must match encoded output count")
            elif asset.get("role") == "looping_bed" and max_bed_segment is not None:
                if any(float(value) > max_bed_segment + 0.05 for value in segment_durations):
                    errors.append(f"{asset_id}: a looping-bed segment exceeds max_bed_segment_seconds")
        if asset.get("role") == "looping_bed" and max_bed_segment is not None and _number(duration) is not None:
            expected_segments = max(1, ceil(float(duration) / max_bed_segment))
            if output_paths and len(output_paths) != expected_segments:
                errors.append(
                    f"{asset_id}: expected {expected_segments} encoded bed segments, found {len(output_paths)}"
                )
            if expected_segments > 1 and output_paths and asset.get("loop_crossfade_milliseconds") != crossfade_ms:
                errors.append(f"{asset_id}: loop crossfade declaration does not match compression settings")
        if "segment_count" in asset and asset.get("segment_count") != len(output_paths):
            errors.append(f"{asset_id}: segment_count does not match encoded output count")

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
            if not isinstance(asset, dict):
                continue
            if asset.get("license_status") != "cleared":
                errors.append(f"{asset.get('id', '<unknown>')}: asset is not license-cleared")
            for output_path in asset_output_paths(asset):
                resolved_output = _inside_project(project_root, output_path)
                if resolved_output is None or not resolved_output.is_file():
                    errors.append(f"{asset.get('id', '<unknown>')}: compressed output is missing: {output_path}")
                elif max_encoded_size is not None and resolved_output.stat().st_size > max_encoded_size:
                    errors.append(
                        f"{asset.get('id', '<unknown>')}: compressed output exceeds max_encoded_size_bytes: {output_path}"
                    )
                else:
                    errors.extend(_probe_encoded_output(asset, resolved_output, ffprobe))

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
    parser.add_argument("--ffprobe", default="ffprobe")
    parser.add_argument("--json", action="store_true", dest="as_json")
    args = parser.parse_args()

    try:
        report = validate_manifest(
            load_manifest(args.manifest),
            args.project_root.resolve(),
            args.require_complete,
            args.ffprobe,
        )
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
