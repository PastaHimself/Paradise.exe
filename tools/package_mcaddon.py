#!/usr/bin/env python3
"""Package the Paradise Bedrock behavior/resource packs into an installable .mcaddon."""

from __future__ import annotations

import argparse
import io
import tempfile
from collections.abc import Callable
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


def _pack_bytes(pack_dir: Path, include: Callable[[Path], bool]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for source in sorted(pack_dir.rglob("*")):
            if not source.is_file():
                continue
            relative = source.relative_to(pack_dir)
            if include(relative):
                _write_entry(archive, relative.as_posix(), source.read_bytes(), zipfile.ZIP_DEFLATED)
    return buffer.getvalue()


def _write_entry(archive: zipfile.ZipFile, name: str, content: bytes, compression: int) -> None:
    # Fixed ZIP metadata makes unchanged pack content produce identical bytes.
    entry = zipfile.ZipInfo(name)
    entry.create_system = 3
    entry.external_attr = 0o100644 << 16
    archive.writestr(entry, content, compress_type=compression, compresslevel=9)


def package_mcaddon(
    bp_dir: Path, rp_dir: Path, output: Path, *, include: Callable[[Path], bool] | None = None,
) -> Path:
    bp_dir = Path(bp_dir)
    rp_dir = Path(rp_dir)
    output = Path(output)

    _validate_pack(bp_dir, "Behavior pack")
    _validate_pack(rp_dir, "Resource pack")

    output.parent.mkdir(parents=True, exist_ok=True)
    if include is None:
        include = lambda relative: True
    with tempfile.TemporaryDirectory(dir=output.parent) as directory:
        temp_output = Path(directory) / output.name
        with zipfile.ZipFile(temp_output, "w") as addon:
            _write_entry(addon, "Paradise_BP.mcpack", _pack_bytes(bp_dir, include), zipfile.ZIP_STORED)
            _write_entry(addon, "Paradise_RP.mcpack", _pack_bytes(rp_dir, include), zipfile.ZIP_STORED)
        verify_mcaddon(temp_output)
        temp_output.replace(output)

    return output


def verify_mcaddon(path: Path) -> None:
    with zipfile.ZipFile(path) as addon:
        expected = {"Paradise_BP.mcpack", "Paradise_RP.mcpack"}
        actual = addon.namelist()
        if len(actual) != len(expected) or set(actual) != expected:
            raise ValueError(f"Unexpected .mcaddon contents: {sorted(actual)}")
        for name in sorted(expected):
            with zipfile.ZipFile(io.BytesIO(addon.read(name))) as pack:
                if "manifest.json" not in pack.namelist():
                    raise ValueError(f"{name} does not contain manifest.json at pack root")
                corrupt = pack.testzip()
                if corrupt:
                    raise ValueError(f"{name} has a corrupt member: {corrupt}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bp", type=Path, default=DEFAULT_BP)
    parser.add_argument("--rp", type=Path, default=DEFAULT_RP)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    output = package_mcaddon(args.bp, args.rp, args.output)
    print(f"Built installable Bedrock add-on: {output}")
    print(f"Size: {output.stat().st_size} bytes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
