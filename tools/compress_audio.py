#!/usr/bin/env python3
"""Encode cleared audio to the repository's single Ogg Vorbis profiles.

The command intentionally fails closed for missing source files, unknown
licenses, and absent derivative-encoding permission. It writes through an
atomic temporary file and validates the encoded stream with ffprobe.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any


PROFILE_ARGS = {
    "ambience": ["-q:a", "3", "-ar", "44100", "-ac", "2"],
    "voice_entity": ["-q:a", "4", "-ar", "44100", "-ac", "1"],
    "footstep_stinger": ["-q:a", "3", "-ar", "44100", "-ac", "1"],
}


class CompressionError(RuntimeError):
    pass


def run_checked(command: list[str]) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(command, check=True, text=True, capture_output=True)
    except FileNotFoundError as error:
        raise CompressionError(f"required executable is missing: {command[0]}") from error
    except subprocess.CalledProcessError as error:
        detail = (error.stderr or error.stdout or "").strip()
        raise CompressionError(f"command failed: {' '.join(command)}\n{detail}") from error


def probe(path: Path, ffprobe: str) -> dict[str, Any]:
    result = run_checked([
        ffprobe,
        "-v",
        "error",
        "-show_streams",
        "-show_format",
        "-of",
        "json",
        str(path),
    ])
    return json.loads(result.stdout)


def source_path_for(asset: dict[str, Any], project_root: Path) -> Path:
    path = project_root / str(asset["source_path"])
    if not path.exists():
        raise CompressionError(f"{asset['id']}: source is not staged: {asset['source_path']}")
    return path


def validate_license(asset: dict[str, Any]) -> None:
    if asset.get("license_status") != "cleared":
        raise CompressionError(
            f"{asset['id']}: compression blocked by license_status={asset.get('license_status')!r}"
        )
    if asset.get("derivative_encoding_allowed") is not True:
        raise CompressionError(f"{asset['id']}: derivative encoding is not permitted")
    if not asset.get("output_path"):
        raise CompressionError(f"{asset['id']}: cleared asset has no output_path")


def output_path_for(asset: dict[str, Any], project_root: Path) -> Path:
    return project_root / str(asset["output_path"])


def profile_args(asset: dict[str, Any]) -> list[str]:
    profile = str(asset.get("codec_profile", ""))
    try:
        return PROFILE_ARGS[profile]
    except KeyError as error:
        raise CompressionError(f"{asset['id']}: unknown codec_profile={profile!r}") from error


def validate_encoded_output(asset: dict[str, Any], output: Path, ffprobe: str) -> None:
    report = probe(output, ffprobe)
    streams = [stream for stream in report.get("streams", []) if stream.get("codec_type") == "audio"]
    if len(streams) != 1:
        raise CompressionError(f"{asset['id']}: output must contain exactly one audio stream")
    stream = streams[0]
    if stream.get("codec_name") != "vorbis":
        raise CompressionError(f"{asset['id']}: output codec is not Vorbis")
    duration = float(stream.get("duration") or report.get("format", {}).get("duration") or 0)
    if duration <= 0:
        raise CompressionError(f"{asset['id']}: encoded duration is not positive")
    expected_channels = 1 if asset.get("codec_profile") in {"voice_entity", "footstep_stinger"} else 2
    if int(stream.get("channels") or 0) != expected_channels:
        raise CompressionError(f"{asset['id']}: expected {expected_channels} channels")
    if int(stream.get("sample_rate") or 0) != 44100:
        raise CompressionError(f"{asset['id']}: expected 44100 Hz")


def compress_asset(asset: dict[str, Any], project_root: Path, ffmpeg: str, ffprobe: str, force: bool, check_only: bool) -> dict[str, Any]:
    validate_license(asset)
    source = source_path_for(asset, project_root)
    output = output_path_for(asset, project_root)
    if output.exists() and not force and not check_only:
        raise CompressionError(f"{asset['id']}: output exists; pass --force to replace it")
    source_report = probe(source, ffprobe)
    source_duration = float(source_report.get("format", {}).get("duration") or 0)
    if source_duration <= 0:
        raise CompressionError(f"{asset['id']}: source duration is not positive")

    result = {
        "id": asset["id"],
        "source": str(source),
        "output": str(output),
        "source_duration_seconds": source_duration,
        "status": "checked" if check_only else "encoded",
    }
    if check_only:
        return result

    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(prefix=f".{output.stem}.", suffix=".tmp.ogg", dir=output.parent, delete=False) as handle:
        temporary = Path(handle.name)
    try:
        run_checked([
            ffmpeg,
            "-nostdin",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(source),
            "-vn",
            "-map_metadata",
            "-1",
            "-c:a",
            "libvorbis",
            *profile_args(asset),
            "-y",
            str(temporary),
        ])
        validate_encoded_output(asset, temporary, ffprobe)
        os.replace(temporary, output)
    finally:
        temporary.unlink(missing_ok=True)
    return result


def load_manifest(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise CompressionError("manifest root must be an object")
    return value


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=Path("tools/audio_assets.json"))
    parser.add_argument("--project-root", type=Path, default=Path("."))
    parser.add_argument("--asset-id", action="append", dest="asset_ids")
    parser.add_argument("--ffmpeg", default="ffmpeg")
    parser.add_argument("--ffprobe", default="ffprobe")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--check-only", action="store_true")
    args = parser.parse_args()

    try:
        manifest = load_manifest(args.manifest)
        assets = manifest.get("assets", [])
        selected = [asset for asset in assets if not args.asset_ids or asset.get("id") in args.asset_ids]
        if args.asset_ids:
            known_ids = {asset.get("id") for asset in assets}
            unknown = set(args.asset_ids) - known_ids
            if unknown:
                raise CompressionError(f"unknown asset ids: {', '.join(sorted(unknown))}")
        if not selected:
            raise CompressionError("no assets selected")
        project_root = args.project_root.resolve()
        results = [compress_asset(asset, project_root, args.ffmpeg, args.ffprobe, args.force, args.check_only) for asset in selected]
    except (OSError, json.JSONDecodeError, CompressionError) as error:
        print(f"audio compression blocked: {error}", file=sys.stderr)
        return 1

    print(json.dumps({"ok": True, "assets": results}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
