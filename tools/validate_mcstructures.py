#!/usr/bin/env python3
"""Parse and sanity-check every Bedrock .mcstructure in the add-on.

Bedrock .mcstructure files are uncompressed little-endian NBT. This validator
checks the binary container and the invariants that matter before Minecraft is
asked to load a structure: dimensions, palette shape, block-index layer lengths,
palette-index bounds, and non-air block count.
"""

from __future__ import annotations

import argparse
import json
import math
import struct
import sys
from pathlib import Path
from typing import Any, Mapping


TAG_END = 0
TAG_BYTE = 1
TAG_SHORT = 2
TAG_INT = 3
TAG_LONG = 4
TAG_FLOAT = 5
TAG_DOUBLE = 6
TAG_BYTE_ARRAY = 7
TAG_STRING = 8
TAG_LIST = 9
TAG_COMPOUND = 10
TAG_INT_ARRAY = 11
TAG_LONG_ARRAY = 12

TAG_NAMES = {
    TAG_END: "TAG_End",
    TAG_BYTE: "TAG_Byte",
    TAG_SHORT: "TAG_Short",
    TAG_INT: "TAG_Int",
    TAG_LONG: "TAG_Long",
    TAG_FLOAT: "TAG_Float",
    TAG_DOUBLE: "TAG_Double",
    TAG_BYTE_ARRAY: "TAG_Byte_Array",
    TAG_STRING: "TAG_String",
    TAG_LIST: "TAG_List",
    TAG_COMPOUND: "TAG_Compound",
    TAG_INT_ARRAY: "TAG_Int_Array",
    TAG_LONG_ARRAY: "TAG_Long_Array",
}

AIR_BLOCKS = {"minecraft:air", "minecraft:cave_air", "minecraft:void_air", "air"}
DEFAULT_MAX_SIZE = (64, 96, 64)
DEFAULT_MAX_VOLUME = 262_144
DEFAULT_MAX_NON_AIR_BLOCKS = 50_000


class MCStructureError(RuntimeError):
    """Raised when a Bedrock structure is malformed or outside safe limits."""


class LittleEndianNBTReader:
    def __init__(self, payload: bytes) -> None:
        self.payload = payload
        self.offset = 0

    def remaining(self) -> int:
        return len(self.payload) - self.offset

    def read_exact(self, count: int, label: str) -> bytes:
        if count < 0:
            raise MCStructureError(f"negative length while reading {label}")
        end = self.offset + count
        if end > len(self.payload):
            raise MCStructureError(f"truncated NBT while reading {label}")
        data = self.payload[self.offset:end]
        self.offset = end
        return data

    def read_u8(self) -> int:
        return self.read_exact(1, "u8")[0]

    def read_i8(self) -> int:
        return struct.unpack("<b", self.read_exact(1, "i8"))[0]

    def read_i16(self) -> int:
        return struct.unpack("<h", self.read_exact(2, "i16"))[0]

    def read_i32(self) -> int:
        return struct.unpack("<i", self.read_exact(4, "i32"))[0]

    def read_i64(self) -> int:
        return struct.unpack("<q", self.read_exact(8, "i64"))[0]

    def read_f32(self) -> float:
        return struct.unpack("<f", self.read_exact(4, "f32"))[0]

    def read_f64(self) -> float:
        return struct.unpack("<d", self.read_exact(8, "f64"))[0]

    def read_string(self) -> str:
        length = self.read_i16()
        if length < 0:
            raise MCStructureError("NBT string length is negative")
        try:
            return self.read_exact(length, "string").decode("utf-8", errors="strict")
        except UnicodeDecodeError as exc:
            raise MCStructureError(f"invalid UTF-8 in NBT string: {exc}") from exc

    def read_root(self) -> dict[str, Any]:
        tag_type = self.read_u8()
        if tag_type != TAG_COMPOUND:
            actual = TAG_NAMES.get(tag_type, str(tag_type))
            raise MCStructureError(f"root tag must be TAG_Compound, got {actual}")
        self.read_string()  # root name is normally empty for mcstructure files
        root = self.read_compound_payload("root")
        if self.remaining() > 0:
            root["__trailing_bytes__"] = self.remaining()
        return root

    def read_compound_payload(self, label: str) -> dict[str, Any]:
        result: dict[str, Any] = {}
        while True:
            tag_type = self.read_u8()
            if tag_type == TAG_END:
                return result
            name = self.read_string()
            result[name] = self.read_payload(tag_type, f"{label}.{name}")

    def read_list_payload(self, label: str) -> list[Any]:
        element_type = self.read_u8()
        length = self.read_i32()
        if length < 0:
            raise MCStructureError(f"{label} has negative list length")
        return [self.read_payload(element_type, f"{label}[{index}]") for index in range(length)]

    def read_payload(self, tag_type: int, label: str) -> Any:
        if tag_type == TAG_BYTE:
            return self.read_i8()
        if tag_type == TAG_SHORT:
            return self.read_i16()
        if tag_type == TAG_INT:
            return self.read_i32()
        if tag_type == TAG_LONG:
            return self.read_i64()
        if tag_type == TAG_FLOAT:
            return self.read_f32()
        if tag_type == TAG_DOUBLE:
            return self.read_f64()
        if tag_type == TAG_BYTE_ARRAY:
            length = self.read_i32()
            if length < 0:
                raise MCStructureError(f"{label} has negative byte-array length")
            return self.read_exact(length, label)
        if tag_type == TAG_STRING:
            return self.read_string()
        if tag_type == TAG_LIST:
            return self.read_list_payload(label)
        if tag_type == TAG_COMPOUND:
            return self.read_compound_payload(label)
        if tag_type == TAG_INT_ARRAY:
            length = self.read_i32()
            if length < 0:
                raise MCStructureError(f"{label} has negative int-array length")
            return [self.read_i32() for _ in range(length)]
        if tag_type == TAG_LONG_ARRAY:
            length = self.read_i32()
            if length < 0:
                raise MCStructureError(f"{label} has negative long-array length")
            return [self.read_i64() for _ in range(length)]
        actual = TAG_NAMES.get(tag_type, str(tag_type))
        raise MCStructureError(f"unsupported NBT tag {actual} at {label}")


def require_mapping(value: Any, label: str) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise MCStructureError(f"missing or invalid {label}: expected compound")
    return value


def require_int_list(value: Any, label: str, expected_len: int | None = None) -> list[int]:
    if not isinstance(value, list):
        raise MCStructureError(f"missing or invalid {label}: expected list of integers")
    result: list[int] = []
    for index, item in enumerate(value):
        if isinstance(item, bool) or not isinstance(item, int):
            raise MCStructureError(f"{label}[{index}] must be an integer")
        result.append(int(item))
    if expected_len is not None and len(result) != expected_len:
        raise MCStructureError(f"{label} must contain exactly {expected_len} integers")
    return result


def parse_palette(value: Any) -> list[str]:
    if not isinstance(value, list) or not value:
        raise MCStructureError("structure.palette.default.block_palette must be a non-empty list")

    names: list[str] = []
    for index, raw_entry in enumerate(value):
        entry = require_mapping(raw_entry, f"block_palette[{index}]")
        name = entry.get("name")
        if not isinstance(name, str) or not name:
            raise MCStructureError(f"block_palette[{index}].name must be a non-empty string")
        states = entry.get("states", {})
        if not isinstance(states, Mapping):
            raise MCStructureError(f"block_palette[{index}].states must be a compound")
        for state_name, state_value in states.items():
            if not isinstance(state_name, str) or not state_name:
                raise MCStructureError(f"block_palette[{index}] contains an invalid state name")
            if isinstance(state_value, float) and not math.isfinite(state_value):
                raise MCStructureError(
                    f"block_palette[{index}].states[{state_name!r}] contains a non-finite number"
                )
        names.append(name)
    return names


def validate_mcstructure_bytes(
    payload: bytes,
    *,
    max_size: tuple[int, int, int] = DEFAULT_MAX_SIZE,
    max_volume: int = DEFAULT_MAX_VOLUME,
    max_non_air_blocks: int = DEFAULT_MAX_NON_AIR_BLOCKS,
) -> dict[str, Any]:
    if len(payload) < 8:
        raise MCStructureError("file is too small to be a valid .mcstructure NBT payload")

    root = LittleEndianNBTReader(payload).read_root()
    warnings: list[str] = []
    trailing = root.pop("__trailing_bytes__", 0)
    if trailing:
        warnings.append(f"file contains {trailing} trailing bytes after the root compound")

    format_version = root.get("format_version")
    if isinstance(format_version, bool) or not isinstance(format_version, int) or format_version <= 0:
        raise MCStructureError("format_version must be a positive integer")

    size = require_int_list(root.get("size"), "size", 3)
    if any(value <= 0 for value in size):
        raise MCStructureError("size values must be positive")
    if any(value > limit for value, limit in zip(size, max_size)):
        raise MCStructureError(
            f"structure size {size[0]}x{size[1]}x{size[2]} exceeds the "
            f"{max_size[0]}x{max_size[1]}x{max_size[2]} Bedrock safety envelope"
        )

    volume = size[0] * size[1] * size[2]
    if volume > max_volume:
        raise MCStructureError(f"structure volume {volume} exceeds max volume {max_volume}")

    origin = require_int_list(root.get("structure_world_origin", [0, 0, 0]), "structure_world_origin", 3)

    structure = require_mapping(root.get("structure"), "structure")
    raw_layers = structure.get("block_indices")
    if not isinstance(raw_layers, list) or not raw_layers:
        raise MCStructureError("structure.block_indices must be a non-empty list of layers")

    layers: list[list[int]] = []
    for layer_index, raw_layer in enumerate(raw_layers):
        layer = require_int_list(raw_layer, f"structure.block_indices[{layer_index}]")
        if len(layer) != volume:
            raise MCStructureError(
                f"structure.block_indices[{layer_index}] length {len(layer)} does not match volume {volume}"
            )
        layers.append(layer)

    palette_root = require_mapping(structure.get("palette"), "structure.palette")
    default_palette = require_mapping(palette_root.get("default"), "structure.palette.default")
    palette_names = parse_palette(default_palette.get("block_palette"))
    palette_size = len(palette_names)

    block_position_data = default_palette.get("block_position_data", {})
    if block_position_data is not None and not isinstance(block_position_data, Mapping):
        raise MCStructureError("structure.palette.default.block_position_data must be a compound")

    for layer_index, layer in enumerate(layers):
        for block_index, palette_index in enumerate(layer):
            if palette_index < -1:
                raise MCStructureError(
                    f"layer {layer_index} block {block_index} has invalid negative palette index {palette_index}"
                )
            if palette_index >= palette_size:
                raise MCStructureError(
                    f"layer {layer_index} block {block_index} references palette index {palette_index}, "
                    f"but palette has {palette_size} entries"
                )

    primary = layers[0]
    non_air_blocks = sum(
        1
        for palette_index in primary
        if palette_index >= 0 and palette_names[palette_index] not in AIR_BLOCKS
    )
    if non_air_blocks == 0:
        raise MCStructureError("no non-air primary blocks found in .mcstructure")
    if non_air_blocks > max_non_air_blocks:
        raise MCStructureError(
            f"non-air block count {non_air_blocks} exceeds maximum {max_non_air_blocks}"
        )

    return {
        "format_version": format_version,
        "size": size,
        "origin": origin,
        "volume": volume,
        "layers": len(layers),
        "palette_size": palette_size,
        "non_air_blocks": non_air_blocks,
        "block_position_data_entries": len(block_position_data or {}),
        "warnings": warnings,
    }


def validate_mcstructure_file(path: Path) -> dict[str, Any]:
    try:
        payload = path.read_bytes()
    except OSError as exc:
        raise MCStructureError(f"unable to read file: {exc}") from exc
    return validate_mcstructure_bytes(payload)


def validate_structure_tree(root: Path) -> dict[str, Any]:
    root = root.resolve()
    structure_root = root / "addon" / "Genshin X Craft BP" / "structures"
    errors: list[str] = []
    warnings: list[str] = []
    structures: list[dict[str, Any]] = []

    if not structure_root.is_dir():
        return {
            "ok": False,
            "structure_count": 0,
            "structures": [],
            "errors": [f"Missing structures directory: {structure_root}"],
            "warnings": [],
        }

    files = sorted(structure_root.rglob("*.mcstructure"))
    if not files:
        errors.append("No .mcstructure files were found")

    for path in files:
        relative = path.relative_to(root).as_posix()
        try:
            metadata = validate_mcstructure_file(path)
        except MCStructureError as exc:
            errors.append(f"{relative}: {exc}")
            continue

        entry = {"path": relative, **metadata}
        structures.append(entry)
        for warning in metadata.get("warnings", []):
            warnings.append(f"{relative}: {warning}")

    return {
        "ok": not errors,
        "structure_count": len(files),
        "validated_structure_count": len(structures),
        "structures": structures,
        "errors": errors,
        "warnings": warnings,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Validate every Bedrock .mcstructure file in Paradise.exe")
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--report", type=Path)
    args = parser.parse_args(argv)

    result = validate_structure_tree(args.root)
    report = json.dumps(result, indent=2, sort_keys=True)
    print(report)

    if args.report:
        report_path = args.report if args.report.is_absolute() else args.root / args.report
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(report + "\n", encoding="utf-8")

    return 0 if result["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
