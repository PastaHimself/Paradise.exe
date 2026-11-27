"""Behavioral regression tests for the guarded shared geometry migration."""

import csv
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from common import BP, RP, json_bytes, read_json
from geometry_reuse import build_shared_reuse_plan, plan_digest
from scaffold import Conflict, atomic_write
from scaffold_provenance import COLUMNS, INDEX


class GeometryReuseTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.owner = "geometry.paradise.sh_fixture_a"
        self.duplicate = "geometry.paradise.sh_fixture_b"
        self.owner_path = self.model(self.owner)
        self.duplicate_path = self.model(self.duplicate)
        self.owner_block = self.block(self.owner)
        self.duplicate_block = self.block(self.duplicate)
        index = self.root / INDEX
        index.parent.mkdir(parents=True)
        with index.open("w", newline="", encoding="utf-8") as stream:
            writer = csv.DictWriter(stream, COLUMNS, lineterminator="\n")
            writer.writeheader()
            for name in (self.owner, self.duplicate):
                writer.writerow({"ticket": 0, "asset": "fixture", "block_id": self.block_id(name),
                                 "geo_runtime": name, "status": "verified", "vanilla_path": "vanilla.png"})
            writer.writerow({"ticket": 1, "asset": "breaker", "status": "deferred"})

    def write(self, relative, document):
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(json_bytes(document))
        return path

    def model(self, name, size=1):
        return self.write(RP / "models/blocks" / f"{name}.geo.json", {
            "format_version": "1.12.0", "minecraft:geometry": [{
                "description": {"identifier": name, "texture_width": 16, "texture_height": 16},
                "bones": [{"name": "fixture", "cubes": [{"origin": [0, 0, 0], "size": [size, 1, 1], "uv": [0, 0]}]}],
            }],
        })

    @staticmethod
    def block_id(name):
        return "paradise:" + name.removeprefix("geometry.paradise.")

    def block(self, name):
        block_id = self.block_id(name)
        return self.write(BP / "blocks" / f"{block_id.replace(':', '__')}.json", {
            "minecraft:block": {"description": {"identifier": block_id}, "components": {
                "minecraft:geometry": {"identifier": name, "bone_visibility": {"fixture": True}},
                "minecraft:material_instances": {"*": {"texture": block_id}},
                "minecraft:collision_box": False, "minecraft:light_emission": 7,
            }, "permutations": [{"condition": "q.block_state('test')", "components": {
                "minecraft:geometry": name, "minecraft:light_emission": 13,
            }}]},
        })

    def snapshot(self):
        return {path.relative_to(self.root): path.read_bytes() for path in self.root.rglob("*") if path.is_file()}

    def test_exact_equivalence_dry_run_apply_and_idempotence(self):
        before = self.snapshot()
        plan, mapping, count = build_shared_reuse_plan(self.root)
        self.assertEqual(mapping, {self.duplicate: self.owner})
        self.assertEqual(count, 1)
        self.assertEqual(self.snapshot(), before)
        self.assertEqual(plan_digest(plan), plan_digest(build_shared_reuse_plan(self.root)[0]))
        plan.apply()
        self.assertFalse(self.duplicate_path.exists())
        self.assertEqual(self.owner_path.read_bytes(), before[self.owner_path.relative_to(self.root)])
        expected = json.loads(before[self.duplicate_block.relative_to(self.root)])
        block = expected["minecraft:block"]
        block["components"]["minecraft:geometry"]["identifier"] = self.owner
        block["permutations"][0]["components"]["minecraft:geometry"] = self.owner
        self.assertEqual(read_json(self.duplicate_block), expected)
        with (self.root / INDEX).open(newline="", encoding="utf-8") as stream:
            rows = list(csv.DictReader(stream))
        self.assertEqual([row["geo_runtime"] for row in rows], [self.owner, self.owner, ""])
        self.assertEqual(rows[1]["vanilla_path"], "vanilla.png")
        self.assertEqual(rows[2]["status"], "deferred")
        repeat, remaining, rows_updated = build_shared_reuse_plan(self.root)
        self.assertEqual((remaining, rows_updated, repeat.summary()), ({}, 0, []))

    def test_differing_model_is_not_migrated(self):
        self.model(self.duplicate, size=2)
        before = self.snapshot()
        plan, mapping, _ = build_shared_reuse_plan(self.root)
        self.assertEqual(mapping, {})
        plan.apply()
        self.assertEqual(self.snapshot(), before)

    def test_unexpected_reference_blocks_all_writes(self):
        self.write(RP / "entity/test.json", {"geometry": {"default": self.duplicate}})
        before = self.snapshot()
        with self.assertRaisesRegex(Conflict, "Unexpected shared geometry reference"):
            build_shared_reuse_plan(self.root)
        self.assertEqual(self.snapshot(), before)

    def test_missing_index_reference_blocks_all_writes(self):
        index = self.root / INDEX
        index.write_text("\n".join(index.read_text().splitlines()[:2]) + "\n")
        before = self.snapshot()
        with self.assertRaisesRegex(Conflict, "Not every redundant geometry"):
            build_shared_reuse_plan(self.root)
        self.assertEqual(self.snapshot(), before)

    def test_owner_changed_after_planning_is_rejected(self):
        plan, _, _ = build_shared_reuse_plan(self.root)
        self.owner_path.write_bytes(self.owner_path.read_bytes() + b"\n")
        before = self.snapshot()
        with self.assertRaisesRegex(Conflict, "File changed during scaffold"):
            plan.apply()
        self.assertEqual(self.snapshot(), before)

    def test_partial_apply_rolls_back_updates_and_removals(self):
        third = "geometry.paradise.sh_fixture_c"
        third_path = self.model(third)
        self.block(third)
        with (self.root / INDEX).open("a", newline="", encoding="utf-8") as stream:
            csv.DictWriter(stream, COLUMNS, lineterminator="\n").writerow({
                "block_id": self.block_id(third), "geo_runtime": third, "status": "verified",
            })
        plan, _, _ = build_shared_reuse_plan(self.root)
        before = self.snapshot()
        original_unlink = Path.unlink

        def fail_last(path, *args, **kwargs):
            if path == third_path:
                raise OSError("fixture deletion failure")
            return original_unlink(path, *args, **kwargs)

        with patch.object(Path, "unlink", fail_last), self.assertRaisesRegex(OSError, "fixture deletion failure"):
            plan.apply()
        self.assertEqual(self.snapshot(), before)


if __name__ == "__main__":
    unittest.main()
