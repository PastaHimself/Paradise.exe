#!/usr/bin/env python3
"""Build per-file audio manifest records from a local staging directory.

Expected layout is either ``tools/audio-staging/<pack id>/`` or
``tools/audio-staging/<pack display name>/``. The command never marks a pack
clearer than its existing pack-level license record and refuses to write a
partial manifest unless ``--allow-partial`` is explicit.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any


AUDIO_SUFFIXES = {".wav", ".mp3", ".ogg", ".flac", ".m4a", ".aiff", ".aac"}
PACK_DEFAULTS = {
    "wind": {"role": "looping_bed", "pool": "wind", "tags": ["open", "wind", "ambient"], "codec": "ambience", "intensity": "quiet"},
    "old_locations": {"role": "looping_bed", "pool": "old_locations", "tags": ["interior", "ambient", "looping_bed"], "codec": "ambience", "intensity": "quiet"},
    "footsteps": {"role": "one_shot", "pool": "footsteps", "tags": ["footstep", "reaction", "surface"], "codec": "footstep_stinger", "intensity": "reaction"},
    "entity": {"role": "one_shot", "pool": "entity", "tags": ["entity", "omen", "one_shot"], "codec": "voice_entity", "intensity": "omen"},
    "ghost_voices": {"role": "one_shot", "pool": "ghost_voices", "tags": ["voice", "ghost", "omen"], "codec": "voice_entity", "intensity": "buildup"},
    "echoes": {"role": "one_shot", "pool": "echoes", "tags": ["echo", "stinger", "scenario"], "codec": "footstep_stinger", "intensity": "scenario"},
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def duration(path: Path, ffprobe: str) -> float | None:
    if shutil.which(ffprobe) is None:
        return None
    try:
        result = subprocess.run(
            [ffprobe, "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
            check=True,
            text=True,
            capture_output=True,
        )
        value = float(result.stdout.strip())
        return value if value > 0 else None
    except (OSError, ValueError, subprocess.CalledProcessError):
        return None


def slug(value: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")
    return value or "asset"


def locate_pack(staging_root: Path, pack: dict[str, Any]) -> Path | None:
    candidates = [staging_root / str(pack["id"]), staging_root / str(pack["display_name"])]
    for candidate in candidates:
        if candidate.is_dir():
            return candidate
    return None


def staged_files(directory: Path) -> list[Path]:
    return sorted(
        path for path in directory.rglob("*")
        if path.is_file() and path.suffix.lower() in AUDIO_SUFFIXES
    )


def encoded_outputs(
    pack_id: str,
    asset_id: str,
    role: str,
    duration_seconds: float | None,
    compression: dict[str, Any],
    cleared: bool,
) -> tuple[list[str], list[float]]:
    if not cleared:
        return [], []
    base = f"addon/Genshin X Craft RP/sounds/paradise_audio/{pack_id}/{asset_id}"
    max_segment = float(compression.get("max_bed_segment_seconds") or 0)
    if role != "looping_bed" or not duration_seconds or max_segment <= 0:
        return [f"{base}.ogg"], [duration_seconds] if duration_seconds else []
    segment_count = max(1, math.ceil(duration_seconds / max_segment))
    if segment_count == 1:
        return [f"{base}.ogg"], [duration_seconds]
    durations = [
        min(max_segment, max(0.0, duration_seconds - index * max_segment))
        for index in range(segment_count)
    ]
    paths = [f"{base}_segment_{index + 1:03d}.ogg" for index in range(segment_count)]
    return paths, durations


def build_assets(manifest: dict[str, Any], project_root: Path, staging_root: Path, ffprobe: str, allow_partial: bool) -> list[dict[str, Any]]:
    assets: list[dict[str, Any]] = []
    missing_packs: list[str] = []
    for pack in manifest.get("packs", []):
        pack_id = str(pack["id"])
        pack_dir = locate_pack(staging_root, pack)
        if pack_dir is None:
            missing_packs.append(pack_id)
            continue
        files = staged_files(pack_dir)
        expected = int(pack["expected_file_count"])
        if len(files) != expected:
            raise ValueError(f"{pack_id}: staged {len(files)} files, expected {expected}")
        defaults = PACK_DEFAULTS[pack_id]
        compression = manifest.get("compression", {})
        for index, source in enumerate(files, start=1):
            relative_source = source.relative_to(project_root).as_posix()
            stem = slug(source.stem)
            asset_id = f"{pack_id}_{index:03d}_{stem}"
            cleared = pack.get("license_status") == "cleared" and pack.get("derivative_encoding_allowed") is True
            source_duration = duration(source, ffprobe)
            output_paths, segment_durations = encoded_outputs(
                pack_id,
                asset_id,
                defaults["role"],
                source_duration,
                compression,
                cleared,
            )
            assets.append({
                "id": asset_id,
                "pack": pack_id,
                "source_path": relative_source,
                "source_sha256": sha256(source),
                "role": defaults["role"],
                "pool": defaults["pool"],
                "scenario_tags": defaults["tags"],
                "intensity_tier": defaults["intensity"],
                "codec_profile": defaults["codec"],
                "output_path": output_paths[0] if output_paths else None,
                "output_paths": output_paths,
                "license_status": pack.get("license_status"),
                "source_url": pack.get("source_url"),
                "author": pack.get("author"),
                "license_name": pack.get("license_name"),
                "attribution_text": pack.get("attribution_text"),
                "redistribution_allowed": pack.get("redistribution_allowed"),
                "derivative_encoding_allowed": pack.get("derivative_encoding_allowed"),
                "evidence_path": pack.get("evidence_path"),
                "duration_seconds": source_duration,
                "segment_count": len(output_paths),
                "segment_durations_seconds": segment_durations,
                "loop_crossfade_milliseconds": compression.get("loop_crossfade_milliseconds", 0),
                "loop_start_seconds": None,
                "loop_end_seconds": None,
            })
    if missing_packs and not allow_partial:
        raise ValueError(f"missing staged packs: {', '.join(missing_packs)}")
    return assets


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=Path("tools/audio_assets.json"))
    parser.add_argument("--project-root", type=Path, default=Path("."))
    parser.add_argument("--staging-root", type=Path, default=Path("tools/audio-staging"))
    parser.add_argument("--ffprobe", default="ffprobe")
    parser.add_argument("--allow-partial", action="store_true")
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()

    try:
        project_root = args.project_root.resolve()
        with args.manifest.open("r", encoding="utf-8") as handle:
            manifest = json.load(handle)
        assets = build_assets(manifest, project_root, (project_root / args.staging_root).resolve(), args.ffprobe, args.allow_partial)
        manifest["assets"] = assets
        all_cleared = all(asset.get("license_status") == "cleared" for asset in assets)
        manifest["status"] = (
            "ready_for_compression"
            if len(assets) == int(manifest["required_total_files"]) and all_cleared
            else "blocked_pending_sources"
        )
        payload = json.dumps(manifest, indent=2, ensure_ascii=False) + "\n"
        if args.write:
            args.manifest.write_text(payload, encoding="utf-8")
        else:
            print(payload)
        return 0
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"audio manifest staging failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
