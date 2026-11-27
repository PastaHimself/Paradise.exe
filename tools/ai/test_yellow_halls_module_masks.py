"""Verify Yellow Halls module placement guards against actual structure writes."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))

from validate_mcstructures import LittleEndianNBTReader, parse_palette  # noqa: E402


MODULES = {
    "service_recess": {
        "offset": (0, 1, 5),
        "required_closed_sides": {"south"},
    },
    "ceiling_failure": {
        "offset": (0, 2, 0),
        "required_closed_sides": set(),
    },
    "maintenance_nook": {
        "offset": (0, 1, 4),
        "required_closed_sides": {"south", "east"},
    },
    "dead_end_landmark": {
        "offset": (0, 1, 2),
        "required_closed_sides": {"south", "east", "west"},
    },
}

OPENING_CELLS = {
    "north": lambda x, y, z: z == 0 and x in (3, 4) and y in (65, 66),
    "south": lambda x, y, z: z == 7 and x in (3, 4) and y in (65, 66),
    "west": lambda x, y, z: x == 0 and z in (3, 4) and y in (65, 66),
    "east": lambda x, y, z: x == 7 and z in (3, 4) and y in (65, 66),
}


def occupied_cells(module_name: str, offset: tuple[int, int, int]) -> set[tuple[int, int, int]]:
    path = ROOT / "addon/BP/structures/paradise/yellow_halls" / f"{module_name}.mcstructure"
    root = LittleEndianNBTReader(path.read_bytes()).read_root()
    size_x, size_y, size_z = root["size"]
    primary = root["structure"]["block_indices"][0]
    palette = parse_palette(root["structure"]["palette"]["default"]["block_palette"])
    offset_x, offset_y, offset_z = offset
    occupied: set[tuple[int, int, int]] = set()

    for local_y in range(size_y):
        for local_z in range(size_z):
            for local_x in range(size_x):
                # Bedrock structure lists are Z-fastest, then Y, then X.
                index = (local_x * size_y + local_y) * size_z + local_z
                palette_index = primary[index]
                if palette_index < 0 or palette[palette_index] in {
                    "minecraft:air",
                    "minecraft:cave_air",
                    "minecraft:void_air",
                    "minecraft:structure_void",
                }:
                    continue
                occupied.add((
                    offset_x + local_x,
                    64 + offset_y + local_y,
                    offset_z + local_z,
                ))
    return occupied


class YellowHallsModuleMaskTests(unittest.TestCase):
    def test_every_player_height_side_write_is_reserved(self) -> None:
        for module_name, spec in MODULES.items():
            with self.subTest(module=module_name):
                occupied = occupied_cells(module_name, spec["offset"])
                blocked_sides = {
                    side
                    for side, matches in OPENING_CELLS.items()
                    if any(matches(x, y, z) for x, y, z in occupied)
                }
                self.assertLessEqual(
                    blocked_sides,
                    spec["required_closed_sides"],
                    f"{module_name} narrows unreserved side(s): "
                    f"{sorted(blocked_sides - spec['required_closed_sides'])}",
                )

    def test_ceiling_failure_only_overhangs_openings_above_player_height(self) -> None:
        occupied = occupied_cells("ceiling_failure", MODULES["ceiling_failure"]["offset"])
        for side, matches in OPENING_CELLS.items():
            self.assertFalse(
                any(matches(x, y, z) for x, y, z in occupied),
                f"ceiling_failure blocks the occupied-height {side} opening",
            )

    def test_module_structures_have_expected_dimensions_and_origin(self) -> None:
        expected = {
            "service_recess": (8, 4, 3),
            "ceiling_failure": (8, 3, 8),
            "maintenance_nook": (8, 4, 4),
            "dead_end_landmark": (8, 4, 6),
        }
        for module_name, dimensions in expected.items():
            path = ROOT / "addon/BP/structures/paradise/yellow_halls" / f"{module_name}.mcstructure"
            root = LittleEndianNBTReader(path.read_bytes()).read_root()
            with self.subTest(module=module_name):
                self.assertEqual(tuple(root["size"]), dimensions)
                self.assertEqual(root.get("structure_world_origin", [0, 0, 0]), [0, 0, 0])


if __name__ == "__main__":
    unittest.main()
