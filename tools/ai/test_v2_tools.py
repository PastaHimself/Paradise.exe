"""Tests for the V2 AI dev-tools: slice, audit, integrity, prune, preflight, scaffold extensions."""

import json
import subprocess
import tempfile
import unittest
import zipfile
from io import BytesIO
from pathlib import Path

from common import BP, ROOT, RP, read_json


class V2ToolTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        # Snapshot tracked 0.3 fixtures so every write stays away from the working packs.
        archive = subprocess.run(["git", "archive", "--format=zip", "HEAD", "addon", "docs/audio-licenses.md", "tools/audio_assets.json"],
                                 cwd=ROOT, check=True, capture_output=True).stdout
        with zipfile.ZipFile(BytesIO(archive)) as files:
            files.extractall(self.root)

    def call_cli(self, *arguments, status=0):
        result = subprocess.run(
            ["python3", str(ROOT / "tools/ai/cli.py"), "--root", str(self.root), *arguments],
            cwd=self.root, capture_output=True, text=True, timeout=120,
        )
        self.assertEqual(result.returncode, status, result.stdout + result.stderr)
        report = json.loads(result.stdout)
        self.assertEqual(report["status"], status)
        self.assertEqual(report["ok"], status == 0)
        return report

    def write_json(self, relative, data):
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data), encoding="utf-8")

    def test_slice_symbol_range_and_usage_errors(self):
        report = self.call_cli("slice", "--file", "watcher_stalker.js", "--symbol", "loadProfileMemory")
        self.assertTrue(report["file"].endswith("watcher_stalker.js"))
        self.assertEqual(report["symbol"], "loadProfileMemory")
        numbers = [line["n"] for line in report["lines"]]
        self.assertEqual(numbers, list(range(report["start"], report["end"] + 1)))
        self.assertIn("function loadProfileMemory", report["lines"][0]["text"])
        self.assertEqual(report["total_lines"], len((self.root / report["file"]).read_text().splitlines()))
        ranged = self.call_cli("slice", "--file", "main.js", "--start", "1", "--end", "3")
        self.assertEqual([line["n"] for line in ranged["lines"]], [1, 2, 3])
        self.call_cli("slice", "--file", "paradise", status=2)
        self.call_cli("slice", "--file", "main.js", "--start", "5", "--end", "2", status=2)
        self.call_cli("slice", "--file", "main.js", "--symbol", "noSuchSymbolHere", status=2)

    def test_inspect_new_kinds(self):
        for kind, minimum in (("store", 50), ("export", 100), ("api", 100), ("particle", 1),
                              ("entity", 1), ("item", 1), ("structure", 0)):
            report = self.call_cli("inspect", "--kind", kind, "--limit", "500")
            self.assertGreaterEqual(report["total"], minimum, kind)
        api = self.call_cli("inspect", "--kind", "api", "--query", "system.runInterval", "--limit", "500")
        self.assertEqual(api["total"], 26)
        self.assertTrue(all(row["name"] == "@minecraft/server.system.runInterval" for row in api["items"]))

    def test_audit_flags_beta_pins_engine_and_script_dimensions(self):
        # Exercise the below-target warning independently of HEAD's actual engine floor.
        manifest = read_json(self.root / BP / "manifest.json")
        manifest["header"]["min_engine_version"] = [1, 26, 20]
        self.write_json(BP / "manifest.json", manifest)
        report = self.call_cli("audit", "--limit", "500", status=1)
        manifest_messages = [finding["message"] for finding in report["checks"]["manifest"]["warnings"]]
        self.assertTrue(any("@minecraft/server" in message and "beta" in message for message in manifest_messages))
        self.assertTrue(any("@minecraft/server-ui" in message and "beta" in message for message in manifest_messages))
        self.assertTrue(any("min_engine_version" in message and "1.26.50" in message for message in manifest_messages))
        stable_gap = next(finding for finding in report["checks"]["scripts"]["warnings"]
                          if "world.beforeEvents.chatSend" in finding["message"])
        self.assertEqual(stable_gap["count"], 7)
        dimensions = report["checks"]["dimensions"]
        self.assertEqual(dimensions["info"]["script_registered"], 7)
        self.assertEqual(len(dimensions["warnings"]), 7)
        self.assertTrue(all("registerCustomDimension" in finding["message"] for finding in dimensions["warnings"]))
        formats = report["checks"]["formats"]
        self.assertEqual(formats["info"]["classes"]["content"]["1.10.0"], 23)
        self.assertEqual(formats["info"]["classes"]["content"]["1.16.100"], 9)
        self.assertEqual(formats["info"]["geometry_files"], 3)
        only = self.call_cli("audit", "--check", "dimensions", "--limit", "500", status=1)
        self.assertEqual(set(only["checks"]), {"dimensions"})
        self.call_cli("audit", "--check", "bogus", status=2)
        self.call_cli("audit", "--target", "not-a-version", status=2)

    def test_audit_dimension_height_rules(self):
        self.write_json(BP / "dimensions/legacy.json", {
            "format_version": "1.26.0",
            "minecraft:dimension": {"description": {"identifier": "paradise:legacy"},
                                    "components": {"minecraft:dimension_bounds": {"min": -64, "max": 320}}},
        })
        self.write_json(BP / "dimensions/too_tall.json", {
            "format_version": "1.26.50",
            "minecraft:dimension": {"description": {"identifier": "paradise:too_tall"},
                                    "components": {"minecraft:dimension_height": {"min_y": -64, "height_range": 512}}},
        })
        self.write_json(BP / "dimensions/out_of_range.json", {
            "format_version": "1.26.50",
            "minecraft:dimension": {"description": {"identifier": "paradise:out_of_range"},
                                    "components": {"minecraft:dimension_height": {"min_y": -600, "height_range": 64}}},
        })
        report = self.call_cli("audit", "--check", "dimensions", "--limit", "500", status=1)
        messages = [finding["message"] for finding in report["checks"]["dimensions"]["errors"]]
        self.assertTrue(any("minecraft:dimension_bounds" in message and "min_y = min" in message for message in messages))
        self.assertTrue(any("outside absolute range" in message for message in messages))
        warnings = [finding["message"] for finding in report["checks"]["dimensions"]["warnings"]]
        self.assertTrue(any("no-experiment" in message for message in warnings))

    def test_integrity_clean_on_head_addon_and_detects_missing_entity(self):
        clean = self.call_cli("validate", "--skip-typecheck", "--limit", "500")
        self.assertEqual(clean["checks"]["integrity"]["errors"], 0)
        self.assertEqual(clean["checks"]["integrity"]["warnings"], 0)
        scripts = self.root / BP / "scripts"
        patched = False
        for path in sorted(scripts.glob("*.js")):
            text = path.read_text()
            if 'spawnEntity("paradise:watcher"' in text:
                path.write_text(text.replace('spawnEntity("paradise:watcher"', 'spawnEntity("paradise:ghost"', 1))
                patched = True
                break
        self.assertTrue(patched, "fixture should contain spawnEntity(\"paradise:watcher\"")
        broken = self.call_cli("validate", "--skip-typecheck", "--limit", "500", status=1)
        errors = [row["message"] for row in broken["diagnostics"]["items"]
                  if row["check"] == "integrity" and row["severity"] == "error"]
        self.assertTrue(any("paradise:ghost" in message for message in errors))

    def test_prune_dry_run_plans_and_apply_only_deletes_unreferenced(self):
        flashlight = self.root / RP / "textures/items/flashlight_off.png"
        (self.root / RP / "textures/blocks/unused_thing.png").write_bytes(flashlight.read_bytes())
        (self.root / RP / "textures/blocks/used_thing.png").write_bytes(flashlight.read_bytes())
        main = self.root / BP / "scripts/main.js"
        main.write_text(main.read_text() + '\nconst __usedTexture = "textures/blocks/used_thing";\n')
        plan = self.call_cli("prune", "--limit", "10")
        self.assertEqual(plan["mode"], "dry-run")
        self.assertEqual(plan["action"], "plan")
        self.assertGreater(plan["total_files"], 2000)
        self.assertGreater(plan["total_bytes"], 0)
        everything = self.call_cli("prune", "--scope", "all", "--limit", "10")
        self.assertEqual(everything["scopes"], ["fogs", "models", "particles", "sounds", "textures"])
        self.assertIn("textures", everything["groups"])
        self.assertEqual(everything["groups"]["sounds"]["files"], 0)
        self.assertTrue((self.root / RP / "textures/blocks/unused_thing.png").exists())
        applied = self.call_cli("prune", "--apply", "--limit", "10")
        self.assertEqual(applied["action"], "applied")
        self.assertFalse((self.root / RP / "textures/blocks/unused_thing.png").exists())
        self.assertTrue((self.root / RP / "textures/blocks/used_thing.png").exists())
        deleted = {row["path"] for row in applied["deleted"]["items"]}
        self.assertNotIn((RP / "textures/blocks/used_thing.png").as_posix(), deleted)
        second = self.call_cli("prune", "--limit", "500")
        self.assertNotIn((RP / "textures/blocks/unused_thing.png").as_posix(),
                         {row["path"] for row in second["items"]})

    def test_scaffold_extended_fields_filters_and_repeat(self):
        self.write_json("tile.geo.json", {
            "format_version": "1.12.0",
            "minecraft:geometry": [{"description": {"identifier": "geometry.tile"}, "bones": []}],
        })
        base = {"model": "tile.geo.json", "geometry": "geometry.tile",
                "texture_path": "textures/blocks/quartz_bricks"}
        spec = {"blocks": [
            {**base, "id": "paradise:tile_a", "batch": "kit_a", "collision_box": {"width": 0.5, "height": 1.0},
             "selection_box": True, "light_emission": 14, "friction": 0.6, "sound": "stone",
             "display_name": "Test Tile A", "materials": {"up": "grass_side"}, "rp_block": {"sound": "stone"}},
            {**base, "id": "paradise:tile_b", "batch": "kit_b"},
        ]}
        spec_path = self.root / "spec.json"
        spec_path.write_text(json.dumps(spec), encoding="utf-8")
        planned = self.call_cli("scaffold", "--spec", str(spec_path), "--batch", "kit_a")
        paths = {row["path"] for row in planned["items"]}
        self.assertTrue(any("paradise__tile_a.json" in path for path in paths))
        self.assertFalse(any("paradise__tile_b.json" in path for path in paths))
        self.assertFalse((self.root / BP / "blocks").exists())
        self.call_cli("scaffold", "--spec", str(spec_path), "--batch", "kit_a", "--apply")
        block = read_json(self.root / BP / "blocks/paradise__tile_a.json")["minecraft:block"]["components"]
        self.assertEqual(block["minecraft:collision_box"], {"origin": [-0.25, 0, -0.25], "size": [0.5, 1.0, 0.5]})
        self.assertIs(block["minecraft:selection_box"], True)
        self.assertEqual(block["minecraft:light_emission"], 14)
        self.assertEqual(block["minecraft:friction"], 0.6)
        self.assertEqual(block["minecraft:sound"], "stone")
        self.assertEqual(block["minecraft:material_instances"]["up"]["texture"], "grass_side")
        lang = (self.root / RP / "texts/en_US.lang").read_text()
        self.assertIn("tile.paradise:tile_a.name=Test Tile A", lang)
        rp_blocks = read_json(self.root / RP / "blocks.json")
        self.assertEqual(rp_blocks["paradise:tile_a"], {"sound": "stone"})
        again = self.call_cli("scaffold", "--spec", str(spec_path), "--batch", "kit_a", "--apply")
        self.assertEqual({row["action"] for row in again["items"]}, {"unchanged"})
        by_ids = self.call_cli("scaffold", "--spec", str(spec_path), "--ids", "paradise:tile_b")
        id_paths = {row["path"] for row in by_ids["items"]}
        self.assertTrue(any("paradise__tile_b.json" in path for path in id_paths))
        self.assertFalse(any("paradise__tile_a.json" in path for path in id_paths))
        self.call_cli("scaffold", "--spec", str(spec_path), "--ids", "paradise:missing", status=2)

    def test_preflight_gate_and_require_v2(self):
        report = self.call_cli("preflight", "--skip-typecheck", "--limit", "500")
        self.assertEqual(report["gate"], "pass")
        self.assertIn("integrity", report["checks"])
        self.assertGreater(report["v2_audit"]["findings"]["total"], 0)
        strict = self.call_cli("preflight", "--skip-typecheck", "--require-v2", "--limit", "10", status=1)
        self.assertEqual(strict["gate"], "fail")


if __name__ == "__main__":
    unittest.main()
