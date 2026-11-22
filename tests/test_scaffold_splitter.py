import csv
import json
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DECOR = Path("3d model *DECORATION*/paradise_exe_v2")
CONDUIT = ROOT / DECOR / "shared/conduit_straight/conduit_straight.geo.json"
FIXTURE = ROOT / DECOR / "yellow_halls/fluorescent_fixture/yellow_halls_fluorescent_fixture.geo.json"
QUARTZ = "resource_pack/textures/blocks/quartz_bricks.png"


class StaticScaffoldTests(unittest.TestCase):
    def setUp(self):
        scratch = tempfile.TemporaryDirectory()
        self.addCleanup(scratch.cleanup)
        self.root = Path(scratch.name)
        for pack in ("BP", "RP"):
            manifest = self.root / f"addon/{pack}/manifest.json"
            manifest.parent.mkdir(parents=True)
            manifest.write_bytes((ROOT / f"addon/{pack}/manifest.json").read_bytes())
        tile = (ROOT / "addon/RP/textures/blocks/quartz_bricks.png").read_bytes()
        source = self.root / QUARTZ
        source.parent.mkdir(parents=True)
        source.write_bytes(tile)
        (self.root / "atlas.png").write_bytes(tile)
        self.index = self.root / DECOR / "asset-index.csv"
        self.index.parent.mkdir(parents=True)
        self.index.write_bytes((ROOT / DECOR / "asset-index.csv").read_bytes())
        self.base = {
            "texture": "atlas.png",
            "provenance": [{"vanilla_path": QUARTZ}],
            "index": {"ticket": 0, "asset": "scaffold test"},
        }

    def call(self, rows, mode, status=0, *args):
        spec = self.root / "spec.json"
        spec.write_text(json.dumps({"vanilla_root": ".", "blocks": rows}))
        result = subprocess.run(["python3", str(ROOT / "tools/ai/cli.py"), "--root",
                                 str(self.root), "scaffold", "--spec", str(spec), mode,
                                 "--limit", "100", "--json", *args],
                                capture_output=True, text=True, timeout=30)
        self.assertEqual(result.returncode, status, result.stdout + result.stderr)
        report = json.loads(result.stdout)
        self.assertEqual(report["status"], status)
        return report

    def block(self, name):
        return json.loads((self.root / f"addon/BP/blocks/{name.replace(':', '__')}.json").read_text())

    def model(self, name):
        return json.loads((self.root / f"addon/RP/models/blocks/{name.replace(':', '__')}.geo.json").read_text()
                          )["minecraft:geometry"][0]

    def test_real_exports_dry_run_apply_and_reapply(self):
        conduit = {**self.base, "id": "paradise:sh_conduit_straight", "model": str(CONDUIT),
                   "collision_box": False, "rotation": "C", "rotation_offset": 90.0,
                   "display_name": "Conduit", "sound": "metal", "batch": "shared"}
        lamp = {**self.base, "id": "paradise:yh_fluorescent", "model": str(FIXTURE),
                "geometry_mode": "S", "rotation": "C", "collision_box": False,
                "light_emission": 13, "display_name": "Fixture", "sound": "stone", "batch": "shared"}
        variant = {**lamp, "id": "paradise:yh_fluorescent_dark",
                   "geometry_owner": lamp["id"], "light_emission": 0}
        rows = [conduit, lamp, variant]
        original_index = self.index.read_bytes()
        originals = [p.read_bytes() for p in (CONDUIT, FIXTURE)]
        preview = self.call(rows, "--dry-run", 0, "--batch", "shared")
        self.assertFalse((self.root / "addon/BP/blocks").exists())
        self.assertEqual(self.index.read_bytes(), original_index)
        self.assertEqual(self.call(rows, "--apply")["items"], preview["items"])
        placements = {entry["id"]: entry for entry in preview["placements"]["items"]}
        segments = placements[lamp["id"]]["segments"]
        self.assertEqual([segment["cell"] for segment in segments], [[0, 0, 0], [0, 0, 1]])
        self.assertEqual([segment["offsets"] for segment in segments], [
            {"north": [0, 0, 0], "east": [1, 0, 0], "south": [0, 0, 1], "west": [0, 0, 0]},
            {"north": [0, 0, 1], "east": [0, 0, 0], "south": [0, 0, 0], "west": [1, 0, 0]},
        ])
        unique = set()
        for segment in placements[conduit["id"]]["segments"] + segments:
            block = self.block(segment["id"])
            self.assertEqual(block["format_version"], "1.26.50")
            data = block["minecraft:block"]
            self.assertEqual(len(data["permutations"]), 4)
            trait = data["description"]["traits"]["minecraft:placement_direction"]
            self.assertEqual(trait["enabled_states"], ["minecraft:cardinal_direction"])
            self.assertIsInstance(trait["y_rotation_offset"], float)
            component = data["components"]
            self.assertIs(component["minecraft:collision_box"], False)
            self.assertEqual(component["minecraft:tags"], ["paradise:static_decor"])
            occlusion = component["minecraft:material_instances"]["*"]["ambient_occlusion"]
            self.assertIsInstance(occlusion, float)
            self.assertEqual(occlusion, 1.0)
            geo = self.model(segment["id"])
            geometry_id = geo["description"]["identifier"]
            self.assertEqual(component["minecraft:geometry"], geometry_id)
            self.assertTrue(geometry_id.startswith("geometry.paradise."))
            self.assertNotIn(geometry_id, unique)
            unique.add(geometry_id)
            for bone in geo["bones"]:
                for cube in bone["cubes"]:
                    for origin, size, lo, hi in zip(cube["origin"], cube["size"], (-8, 0, -8), (8, 16, 8)):
                        self.assertLessEqual(lo, origin)
                        self.assertLessEqual(origin + size, hi)
        first, second = [self.model(segment["id"])["bones"][0]["cubes"][0] for segment in segments]
        self.assertNotIn("south", first["uv"])
        self.assertNotIn("north", second["uv"])
        self.assertAlmostEqual(sum(cube["uv"]["east"]["uv_size"][0] for cube in (first, second)), 7)
        self.assertAlmostEqual(sum(abs(cube["uv"]["up"]["uv_size"][0]) for cube in (first, second)), 7)
        for segment in placements[variant["id"]]["segments"]:
            self.assertIn(segment["geometry"], unique)
            self.assertEqual(self.block(segment["id"])["minecraft:block"]["components"]["minecraft:light_emission"], 0)
        with self.index.open(newline="") as stream:
            records = list(csv.DictReader(stream))
        self.assertEqual(sum(row["status"] == "deferred" for row in records), 6)
        self.assertEqual(sum(row["status"] == "verified" for row in records), 5)
        self.assertEqual({item["action"] for item in self.call(rows, "--apply")["items"]}, {"unchanged"})
        self.assertEqual([p.read_bytes() for p in (CONDUIT, FIXTURE)], originals)
        rp_blocks = json.loads((self.root / "addon/RP/blocks.json").read_text())
        self.assertEqual(rp_blocks[conduit["id"]]["sound"], "metal")
        self.assertEqual(rp_blocks[segments[0]["id"]]["sound"], "stone")

    def test_dry_run_conflicts_and_tall_collision(self):
        row = {**self.base, "id": "paradise:test", "model": str(CONDUIT)}
        tall = [{"min": [0, 0, 0], "max": [16, 24, 16]}]
        for rows in ([row, row], [{**row, "provenance": []}], [{**row, "texture": "absent.png"}],
                     [{**row, "state_count": 5}], [{**row, "rotation": "C", "rotation_offset": 360}],
                     [{**row, "model": str(FIXTURE)}], [{**row, "collision_box": tall}]):
            with self.subTest(rows=rows):
                self.call(rows, "--dry-run", 1)
        self.assertFalse((self.root / "addon/BP/blocks").exists())
        self.call([{**row, "collision_box": tall, "allow_tall_collision": True}], "--apply")
        self.assertEqual(self.block(row["id"])["minecraft:block"]["components"]["minecraft:collision_box"], tall)
        duplicate = self.root / "addon/RP/models/duplicate.geo.json"
        duplicate.write_text(json.dumps({"minecraft:geometry": [self.model(row["id"])]}))
        conflict = self.call([row], "--dry-run", 1)
        self.assertIn("Geometry ID already defined", conflict["error"])

    def test_preview_texture_uses_configured_stable_fallback(self):
        preview_path = "resource_pack/textures/blocks/polished_calcite_bricks.png"
        row = {**self.base, "id": "paradise:seams", "model": str(CONDUIT),
               "provenance": [{"vanilla_path": preview_path}]}
        self.call([row], "--dry-run", 1)
        row["provenance"][0]["fallback"] = QUARTZ
        preview = self.call([row], "--dry-run")
        self.assertIn(preview_path, preview["warnings"][0])
        self.call([row], "--apply")
        with self.index.open(newline="") as stream:
            applied = next(item for item in csv.DictReader(stream) if item["block_id"] == row["id"])
        self.assertEqual((applied["status"], applied["vanilla_path"]), ("substituted", QUARTZ))
