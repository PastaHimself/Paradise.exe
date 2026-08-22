#!/usr/bin/env python3
"""Package the Paradise Bedrock behavior/resource packs into an installable .mcaddon."""

from __future__ import annotations

import argparse
import io
import shutil
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BP = ROOT / "addon" / "Genshin X Craft BP"
DEFAULT_RP = ROOT / "addon" / "Genshin X Craft RP"
DEFAULT_OUTPUT = ROOT / "artifacts" / "Paradise.exe.mcaddon"


def _validate_pack(pack_dir: Path, label: str) -> None:
    if not pack_dir.is_dir():
        raise FileNotFoundError(f"{label} directory does not exist: {pack_dir}")
    manifest = pack_dir / "manifest.json"
    if not manifest.is_file():
        raise FileNotFoundError(f"{label} is missing manifest.json: {manifest}")


def _pack_bytes(pack_dir: Path) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for source in sorted(pack_dir.rglob("*")):
            if not source.is_file():
                continue
            relative = source.relative_to(pack_dir).as_posix()
            archive.write(source, relative)
    return buffer.getvalue()


def package_mcaddon(bp_dir: Path, rp_dir: Path, output: Path) -> Path:
    bp_dir = Path(bp_dir)
    rp_dir = Path(rp_dir)
    output = Path(output)

    _validate_pack(bp_dir, "Behavior pack")
    _validate_pack(rp_dir, "Resource pack")

    output.parent.mkdir(parents=True, exist_ok=True)
    temp_output = output.with_suffix(output.suffix + ".tmp")

    try:
        with zipfile.ZipFile(temp_output, "w", compression=zipfile.ZIP_STORED) as addon:
            addon.writestr("Paradise_BP.mcpack", _pack_bytes(bp_dir))
            addon.writestr("Paradise_RP.mcpack", _pack_bytes(rp_dir))
        temp_output.replace(output)
    finally:
        if temp_output.exists():
            temp_output.unlink()

    return output


def verify_mcaddon(path: Path) -> None:
    path = Path(path)
    with zipfile.ZipFile(path) as addon:
        expected = {"Paradise_BP.mcpack", "Paradise_RP.mcpack"}
        actual = set(addon.namelist())
        if actual != expected:
            raise ValueError(f"Unexpected .mcaddon contents: {sorted(actual)}")

        temp_dir = path.parent / ".mcaddon_verify"
        if temp_dir.exists():
            shutil.rmtree(temp_dir)
        temp_dir.mkdir(parents=True)
        try:
            for name in sorted(expected):
                nested = temp_dir / name
                nested.write_bytes(addon.read(name))
                with zipfile.ZipFile(nested) as pack:
                    names = set(pack.namelist())
                    if "manifest.json" not in names:
                        raise ValueError(f"{name} does not contain manifest.json at pack root")
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bp", type=Path, default=DEFAULT_BP)
    parser.add_argument("--rp", type=Path, default=DEFAULT_RP)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    output = package_mcaddon(args.bp, args.rp, args.output)
    verify_mcaddon(output)
    print(f"Built installable Bedrock add-on: {output}")
    print(f"Size: {output.stat().st_size} bytes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
