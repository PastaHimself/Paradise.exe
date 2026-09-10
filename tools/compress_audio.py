#!/usr/bin/env python3
"""Encode cleared audio to the repository's single Ogg Vorbis profiles.

The command intentionally fails closed for missing source files, unknown
licenses, invalid provenance, and absent derivative-encoding permission. It
writes through atomic temporary files and validates every encoded stream with
ffprobe.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import tempfile
from math import ceil
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

try:
    from tools.validate_audio_manifest import asset_output_paths, validate_manifest
except ModuleNotFoundError:  # Direct ``python tools/<script>.py`` invocation.
    from validate_audio_manifest import asset_output_paths, validate_manifest


PROFILE_ARGS = {
    "ambience": ["-q:a", "3", "-ar", "44100", "-ac", "2"],
    "voice_entity": ["-q:a", "4", "-ar", "44100", "-ac", "1"],
    "footstep_stinger": ["-q:a", "3", "-ar", "44100", "-ac", "1"],
}


class CompressionError(RuntimeError):
    pass


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


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
    try:
        value = json.loads(result.stdout)
    except json.JSONDecodeError as error:
        raise CompressionError(f"ffprobe returned invalid JSON for {path}: {error}") from error
    if not isinstance(value, dict):
        raise CompressionError(f"ffprobe returned a non-object for {path}")
    return value


def source_path_for(asset: dict[str, Any], project_root: Path) -> Path:
    path = (project_root / str(asset["source_path"])).resolve()
    try:
        path.relative_to(project_root.resolve())
    except ValueError as error:
        raise CompressionError(f"{asset['id']}: source_path must stay inside project") from error
    if not path.is_file():
        raise CompressionError(f"{asset['id']}: source is not staged: {asset['source_path']}")
    return path


def validate_license(asset: dict[str, Any]) -> None:
    if asset.get("license_status") != "cleared":
        raise CompressionError(
            f"{asset['id']}: compression blocked by license_status={asset.get('license_status')!r}"
        )
    if asset.get("derivative_encoding_allowed") is not True:
        raise CompressionError(f"{asset['id']}: derivative encoding is not permitted")
    if not asset_output_paths(asset):
        raise CompressionError(f"{asset['id']}: cleared asset has no output paths")
    if not isinstance(asset.get("source_url"), str):
        raise CompressionError(f"{asset['id']}: cleared asset has no source_url")
    source_url = urlparse(asset["source_url"])
    if source_url.scheme not in {"http", "https"} or not source_url.netloc:
        raise CompressionError(f"{asset['id']}: source_url must be an http(s) URL")
    for field in ("author", "license_name", "attribution_text", "evidence_path"):
        if not isinstance(asset.get(field), str) or not asset[field].strip():
            raise CompressionError(f"{asset['id']}: cleared asset has no {field}")


def output_paths_for(asset: dict[str, Any], project_root: Path) -> list[Path]:
    paths: list[Path] = []
    resource_pack_root = (project_root / "addon" / "Genshin X Craft RP").resolve()
    for raw_path in asset_output_paths(asset):
        path = (project_root / raw_path).resolve()
        try:
            path.relative_to(resource_pack_root)
        except ValueError as error:
            raise CompressionError(f"{asset['id']}: output path must stay inside the resource pack") from error
        if path.suffix.lower() != ".ogg":
            raise CompressionError(f"{asset['id']}: output path must use .ogg: {raw_path}")
        paths.append(path)
    return paths


def profile_args(asset: dict[str, Any]) -> list[str]:
    profile = str(asset.get("codec_profile", ""))
    try:
        return PROFILE_ARGS[profile]
    except KeyError as error:
        raise CompressionError(f"{asset['id']}: unknown codec_profile={profile!r}") from error


def _audio_stream(report: dict[str, Any], asset_id: str) -> tuple[dict[str, Any], float]:
    streams = [stream for stream in report.get("streams", []) if stream.get("codec_type") == "audio"]
    if len(streams) != 1:
        raise CompressionError(f"{asset_id}: output must contain exactly one audio stream")
    stream = streams[0]
    try:
        duration = float(stream.get("duration") or report.get("format", {}).get("duration") or 0)
    except (TypeError, ValueError):
        duration = 0
    return stream, duration


def validate_encoded_output(
    asset: dict[str, Any],
    output: Path,
    ffprobe: str,
    expected_duration: float | None = None,
    max_segment_seconds: float | None = None,
    max_size_bytes: int | None = None,
) -> float:
    if max_size_bytes is not None and output.stat().st_size > max_size_bytes:
        raise CompressionError(f"{asset['id']}: encoded output exceeds max_encoded_size_bytes: {output}")
    stream, duration = _audio_stream(probe(output, ffprobe), asset["id"])
    if stream.get("codec_name") != "vorbis":
        raise CompressionError(f"{asset['id']}: output codec is not Vorbis")
    if duration <= 0:
        raise CompressionError(f"{asset['id']}: encoded duration is not positive")
    expected_channels = 1 if asset.get("codec_profile") in {"voice_entity", "footstep_stinger"} else 2
    if int(stream.get("channels") or 0) != expected_channels:
        raise CompressionError(f"{asset['id']}: expected {expected_channels} channels")
    if int(stream.get("sample_rate") or 0) != 44100:
        raise CompressionError(f"{asset['id']}: expected 44100 Hz")
    if expected_duration is not None and abs(duration - expected_duration) > 0.25:
        raise CompressionError(
            f"{asset['id']}: encoded duration {duration:.3f}s differs from declared {expected_duration:.3f}s"
        )
    if max_segment_seconds is not None and duration > max_segment_seconds + 0.25:
        raise CompressionError(f"{asset['id']}: encoded segment exceeds max_bed_segment_seconds")
    return duration


def _segment_specs(
    asset: dict[str, Any],
    source_duration: float,
    compression: dict[str, Any],
    output_paths: list[Path],
) -> list[tuple[Path, float, float]]:
    if not output_paths:
        raise CompressionError(f"{asset['id']}: no output paths declared")
    max_segment = float(compression.get("max_bed_segment_seconds") or 0)
    if asset.get("role") != "looping_bed":
        if len(output_paths) != 1:
            raise CompressionError(f"{asset['id']}: one-shot assets must have exactly one output")
        return [(output_paths[0], 0.0, source_duration)]
    if max_segment <= 0:
        raise CompressionError("compression.max_bed_segment_seconds must be positive")
    expected_count = max(1, ceil(source_duration / max_segment))
    if len(output_paths) != expected_count:
        raise CompressionError(
            f"{asset['id']}: expected {expected_count} encoded bed segments, found {len(output_paths)}"
        )
    declared_durations = asset.get("segment_durations_seconds")
    if not isinstance(declared_durations, list) or len(declared_durations) != expected_count:
        raise CompressionError(f"{asset['id']}: segment_durations_seconds must match the encoded outputs")
    specs: list[tuple[Path, float, float]] = []
    for index, output in enumerate(output_paths):
        start = index * max_segment
        remaining = source_duration - start
        segment_duration = min(max_segment, remaining)
        try:
            declared = float(declared_durations[index])
        except (TypeError, ValueError) as error:
            raise CompressionError(f"{asset['id']}: invalid declared segment duration") from error
        if abs(declared - segment_duration) > 0.25:
            raise CompressionError(f"{asset['id']}: declared segment duration does not match the source")
        if segment_duration <= 0 or segment_duration > max_segment + 0.001:
            raise CompressionError(f"{asset['id']}: segment duration is outside the declared limit")
        specs.append((output, start, segment_duration))
    crossfade_ms = compression.get("loop_crossfade_milliseconds", 0)
    if expected_count > 1 and asset.get("loop_crossfade_milliseconds") != crossfade_ms:
        raise CompressionError(f"{asset['id']}: loop crossfade declaration does not match compression settings")
    return specs


def _crossfade_filter(asset: dict[str, Any], segment_duration: float, segment_count: int, crossfade_ms: float) -> str | None:
    if asset.get("role") != "looping_bed" or segment_count <= 1 or crossfade_ms <= 0:
        return None
    fade_seconds = min(crossfade_ms / 1000.0, segment_duration / 2.0)
    fade_start = max(0.0, segment_duration - fade_seconds)
    # The finite fallback plays adjacent encoded segments. Fading both ends
    # keeps the handoff bounded on runtimes that cannot crossfade handles.
    return f"afade=t=in:st=0:d={fade_seconds:.3f},afade=t=out:st={fade_start:.3f}:d={fade_seconds:.3f}"


def compress_asset(
    asset: dict[str, Any],
    project_root: Path,
    ffmpeg: str,
    ffprobe: str,
    force: bool,
    check_only: bool,
    verify_output: bool = False,
    compression: dict[str, Any] | None = None,
) -> dict[str, Any]:
    validate_license(asset)
    project_root = project_root.resolve()
    source = source_path_for(asset, project_root)
    expected_checksum = str(asset.get("source_sha256", ""))
    actual_checksum = file_sha256(source)
    if expected_checksum != actual_checksum:
        raise CompressionError(
            f"{asset['id']}: source_sha256 mismatch (manifest {expected_checksum}, actual {actual_checksum})"
        )
    output_paths = output_paths_for(asset, project_root)
    source_report = probe(source, ffprobe)
    try:
        source_duration = float(source_report.get("format", {}).get("duration") or 0)
    except (TypeError, ValueError):
        source_duration = 0
    if source_duration <= 0:
        raise CompressionError(f"{asset['id']}: source duration is not positive")
    declared_duration = asset.get("duration_seconds")
    if declared_duration is not None:
        try:
            declared_duration = float(declared_duration)
        except (TypeError, ValueError) as error:
            raise CompressionError(f"{asset['id']}: invalid declared duration_seconds") from error
        if abs(source_duration - declared_duration) > 0.25:
            raise CompressionError(
                f"{asset['id']}: source duration {source_duration:.3f}s differs from declared {declared_duration:.3f}s"
            )
    compression = compression or {}
    specs = _segment_specs(asset, source_duration, compression, output_paths)
    max_size = compression.get("max_encoded_size_bytes")
    max_size = int(max_size) if isinstance(max_size, int) and not isinstance(max_size, bool) else None

    result = {
        "id": asset["id"],
        "source": str(source),
        "outputs": [str(output) for output in output_paths],
        "output": str(output_paths[0]),
        "source_duration_seconds": source_duration,
        "status": "verified" if check_only and verify_output else "checked" if check_only else "encoded",
    }
    if check_only:
        if verify_output:
            for output, _start, segment_duration in specs:
                if not output.is_file():
                    raise CompressionError(f"{asset['id']}: compressed output is missing: {output}")
                validate_encoded_output(
                    asset,
                    output,
                    ffprobe,
                    expected_duration=segment_duration,
                    max_segment_seconds=float(compression.get("max_bed_segment_seconds") or 0)
                    if asset.get("role") == "looping_bed" else None,
                    max_size_bytes=max_size,
                )
        return result

    for output in output_paths:
        if output.exists() and not force:
            raise CompressionError(f"{asset['id']}: output exists; pass --force to replace it")

    temporary_outputs: list[tuple[Path, Path]] = []
    try:
        for output, start, segment_duration in specs:
            output.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.NamedTemporaryFile(
                prefix=f".{output.stem}.",
                suffix=".tmp.ogg",
                dir=output.parent,
                delete=False,
            ) as handle:
                temporary = Path(handle.name)
            temporary_outputs.append((temporary, output))
            command = [
                ffmpeg,
                "-nostdin",
                "-hide_banner",
                "-loglevel",
                "error",
                "-ss",
                f"{start:.6f}",
                "-i",
                str(source),
                "-t",
                f"{segment_duration:.6f}",
                "-vn",
                "-map_metadata",
                "-1",
                "-c:a",
                "libvorbis",
                *profile_args(asset),
            ]
            audio_filter = _crossfade_filter(
                asset,
                segment_duration,
                len(specs),
                float(compression.get("loop_crossfade_milliseconds") or 0),
            )
            if audio_filter:
                command.extend(["-af", audio_filter])
            command.extend(["-y", str(temporary)])
            run_checked(command)
            validate_encoded_output(
                asset,
                temporary,
                ffprobe,
                expected_duration=segment_duration,
                max_segment_seconds=float(compression.get("max_bed_segment_seconds") or 0)
                if asset.get("role") == "looping_bed" else None,
                max_size_bytes=max_size,
            )
        for temporary, output in temporary_outputs:
            os.replace(temporary, output)
    finally:
        for temporary, _output in temporary_outputs:
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
    parser.add_argument("--verify-output", action="store_true")
    parser.add_argument("--cleared-only", action="store_true")
    args = parser.parse_args()

    try:
        manifest = load_manifest(args.manifest)
        project_root = args.project_root.resolve()
        report = validate_manifest(manifest, project_root, require_complete=False, ffprobe=args.ffprobe)
        if not report["ok"]:
            raise CompressionError("manifest validation failed: " + "; ".join(report["errors"]))
        assets = manifest.get("assets", [])
        selected = [
            asset for asset in assets
            if (not args.asset_ids or asset.get("id") in args.asset_ids)
            and (not args.cleared_only or asset.get("license_status") == "cleared")
        ]
        if args.asset_ids:
            known_ids = {asset.get("id") for asset in assets}
            unknown = set(args.asset_ids) - known_ids
            if unknown:
                raise CompressionError(f"unknown asset ids: {', '.join(sorted(unknown))}")
        if not selected:
            if args.cleared_only:
                print(json.dumps({"ok": True, "assets": [], "status": "no_cleared_assets"}, indent=2))
                return 0
            raise CompressionError("no assets selected")
        results = [
            compress_asset(
                asset,
                project_root,
                args.ffmpeg,
                args.ffprobe,
                args.force,
                args.check_only,
                args.verify_output,
                manifest.get("compression", {}),
            )
            for asset in selected
        ]
    except (OSError, json.JSONDecodeError, CompressionError) as error:
        print(f"audio compression blocked: {error}", file=sys.stderr)
        return 1

    print(json.dumps({"ok": True, "assets": results}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
