"""Regression tests for the shipped binary scene masks."""
from pathlib import Path
import unittest
from repair_scene_structures import BASE, build_plan, patch_cells, scene_updates
from validate_mcstructures import LittleEndianNBTReader

ROOT = Path(__file__).resolve().parents[2]


class SceneStructureTests(unittest.TestCase):
    def test_exact_authored_cells(self):
        for name, changes in scene_updates().items():
            data = (ROOT / BASE / (name + ".mcstructure")).read_bytes()
            root = LittleEndianNBTReader(data).read_root()
            sx, sy, sz = root["size"]
            structure = root["structure"]
            palette = structure["palette"]["default"]["block_palette"]
            for (x, y, z), (block, facing) in changes.items():
                entry = palette[structure["block_indices"][0][(x * sy + y) * sz + z]]
                self.assertEqual(entry["name"], block, (name, x, y, z))
                if facing:
                    self.assertEqual(entry["states"]["minecraft:cardinal_direction"], facing)
            self.assertEqual(set(structure["block_indices"][1]), {-1})
            self.assertEqual(patch_cells(data, changes), data)

    def test_repair_is_idempotent(self):
        self.assertTrue(all(entry["action"] == "unchanged" for entry in build_plan(ROOT).summary()))

    def test_outside_bounds_rejected(self):
        data = (ROOT / BASE / "heaven/reflection_pool.mcstructure").read_bytes()
        with self.assertRaises(ValueError):
            patch_cells(data, {(12, 0, 0): ("minecraft:air", None)})


if __name__ == "__main__":
    unittest.main()
