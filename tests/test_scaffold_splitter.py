import csv
import json
import subprocess
import tempfile
import unittest
from collections import Counter
from copy import deepcopy
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
        # The committed index grows with every accepted batch, so assertions
        # compare against the baseline carried into the scratch checkout.
        self.baseline = self.status_counts()
        self.base = {
            "texture": "atlas.png",
            "provenance": [{"vanilla_path": QUARTZ}],
            "index": {"ticket": 0, "asset": "scaffold test"},
        }

    def status_counts(self):
        with self.index.open(newline="") as stream:
            records = list(csv.DictReader(stream))
        counts = {}
        for row in records:
            counts[row["status"]] = counts.get(row["status"], 0) + 1
        return counts

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
        deferred = sum(row["status"] == "deferred" for row in records)
        verified = sum(row["status"] == "verified" for row in records)
        self.assertEqual(deferred, self.baseline.get("deferred", 0))
        self.assertEqual(verified, self.baseline.get("verified", 0) + 5)
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

    def test_rotated_library_assets_keep_source_cubes_and_exact_cell_footprints(self):
        from tools.ai.scaffold_geometry import (
            CELL_MAX,
            CELL_MIN,
            read_cubes,
            stage_cells,
            translated,
        )

        assets = [
            ("fallen_shelf", [0, 0, 0.1],
             [(0, 0, 0), (0, 0, 1), (1, 0, 0), (1, 0, 1)],
             {(0, 0, 1)}),
            ("tall_library_ladder", [0, 0, 0],
             [(0, 0, 0), (0, 1, 0)], set()),
        ]

        def cube_signature(cube):
            return json.dumps({key: value for key, value in cube.items()
                               if key not in ("origin", "pivot")}, sort_keys=True)

        for slug, bias, expected_cells, anchor_cells in assets:
            with self.subTest(asset=slug):
                asset_dir = ROOT / DECOR / "library" / slug
                source_path = asset_dir / f"library_{slug}.geo.json"
                model = json.loads(source_path.read_text())["minecraft:geometry"][0]
                recorded_bounds = json.loads((asset_dir / "transformed_bounds.json").read_text())
                # The recorded authoring bounds use positive Z rotation; staging uses Bedrock's runtime convention.
                source_bounds = list(read_cubes(model, positive_z_rotation=True))
                source_min = [min(row[2][axis] for row in source_bounds) for axis in range(3)]
                source_max = [max(row[3][axis] for row in source_bounds) for axis in range(3)]
                for axis in range(3):
                    self.assertAlmostEqual(source_min[axis], recorded_bounds["min"][axis], places=6)
                    self.assertAlmostEqual(source_max[axis], recorded_bounds["max"][axis], places=6)

                with self.assertRaisesRegex(ValueError, "Rotated cube crosses a 16-unit plane"):
                    stage_cells(model, True)

                cells, shift = stage_cells(model, True, preserve_rotated_cubes=True,
                                           translation_bias=bias)
                self.assertEqual(list(cells), expected_cells)
                source_cubes = [cube for bone in model["bones"] for cube in bone.get("cubes", [])]
                remaining = list(source_cubes)
                output_signatures = []

                for cell, segment in cells.items():
                    delta = [shift[axis] - 16 * cell[axis] for axis in range(3)]
                    for bone_index, source_bone in enumerate(model["bones"]):
                        segment_bone = segment["bones"][bone_index]
                        self.assertEqual(segment_bone.get("rotation"), source_bone.get("rotation"))
                        self.assertEqual(segment_bone.get("pivot"),
                                         translated(source_bone.get("pivot", [0, 0, 0]), delta))
                        for cube in segment_bone.get("cubes", []):
                            signature = cube_signature(cube)
                            def matches_source(source_cube):
                                if cube_signature(source_cube) != signature:
                                    return False
                                if translated(source_cube["origin"], delta) != cube["origin"]:
                                    return False
                                if "pivot" in source_cube or any(source_cube.get("rotation", [])):
                                    return translated(source_cube.get("pivot", [0, 0, 0]), delta) == cube.get("pivot")
                                return True

                            match_index = next((index for index, source_cube in enumerate(remaining)
                                                if matches_source(source_cube)), None)
                            self.assertIsNotNone(match_index, f"unexpected or duplicated source cube: {cube}")
                            source_cube = remaining.pop(match_index)
                            self.assertEqual(cube["origin"], translated(source_cube["origin"], delta))
                            if "pivot" in source_cube or any(source_cube.get("rotation", [])):
                                self.assertEqual(cube.get("pivot"),
                                                 translated(source_cube.get("pivot", [0, 0, 0]), delta))
                            output_signatures.append(signature)

                    anchors = [bone for bone in segment["bones"] if bone.get("neverRender") is True]
                    if cell in anchor_cells:
                        self.assertEqual(len(anchors), 1)
                        self.assertEqual(anchors[0]["cubes"][0]["origin"], [0, 1, 0])
                        self.assertEqual(anchors[0]["cubes"][0]["size"], [1, 1, 1])
                    else:
                        self.assertEqual(anchors, [])

                    segment_cubes = list(read_cubes(segment))
                    mins = [min(row[2][axis] for row in segment_cubes) for axis in range(3)]
                    maxs = [max(row[3][axis] for row in segment_cubes) for axis in range(3)]
                    self.assertTrue(all(size <= 30 + 1e-6 for size in
                                        (maxs[axis] - mins[axis] for axis in range(3))))
                    self.assertTrue(all(lower - 1e-6 <= mins[axis] <= maxs[axis] <= upper + 1e-6
                                        for axis, (lower, upper) in enumerate(
                                            [(-14, 30), (-14, 30), (-14, 30)])))
                    center = [(mins[axis] + maxs[axis]) / 2 for axis in range(3)]
                    center_offset = [center[0], center[1] - 8, center[2]]
                    self.assertLessEqual(max(abs(value) for value in center_offset), 7 + 1e-6)
                    overlap = [max(0, min(maxs[axis], CELL_MAX[axis]) - max(mins[axis], CELL_MIN[axis]))
                               for axis in range(3)]
                    self.assertTrue(all(value >= 1 - 1e-6 for value in overlap))

                    if slug == "fallen_shelf":
                        runtime_path = ROOT / "addon/RP/models/blocks" / (
                            f"paradise__lib_fallen_shelf_x{cell[0]}_y{cell[1]}_z{cell[2]}.geo.json"
                        )
                        runtime_model = json.loads(runtime_path.read_text())["minecraft:geometry"][0]
                        expected_model = deepcopy(segment)
                        expected_model["description"]["identifier"] = (
                            f"geometry.paradise.lib_fallen_shelf_x{cell[0]}_y{cell[1]}_z{cell[2]}"
                        )
                        self.assertEqual(runtime_model, expected_model)

                self.assertEqual(remaining, [], "every authored source cube must appear exactly once")
                self.assertEqual(Counter(output_signatures),
                                 Counter(cube_signature(cube) for cube in source_cubes))
