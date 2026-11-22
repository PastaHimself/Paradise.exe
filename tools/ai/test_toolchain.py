"""Integration tests for the safety and output contracts of the CLI."""

import hashlib
import json
import subprocess
import tempfile
import unittest
import zipfile
from io import BytesIO
from pathlib import Path

from common import BP, ROOT, RP


class ToolchainTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        # Snapshot tracked 0.3 fixtures to keep all writes away from the working packs.
        archive = subprocess.run(["git", "archive", "--format=zip", "HEAD", "addon", "docs/audio-licenses.md", "tools/audio_assets.json"],
                                 cwd=ROOT, check=True, capture_output=True).stdout
        with zipfile.ZipFile(BytesIO(archive)) as files:
            files.extractall(self.root)
        self.spec = self.root / "spec.json"

    def call_cli(self, *arguments, status=0):
        result = subprocess.run(
            ["python3", str(ROOT / "tools/ai/cli.py"), "--root", str(self.root), *arguments],
            cwd=self.root, capture_output=True, text=True, timeout=60,
        )
        self.assertEqual(result.returncode, status, result.stdout + result.stderr)
        report = json.loads(result.stdout)
        self.assertEqual(report["status"], status)
        self.assertEqual(report["ok"], status == 0)
        return report

    def write_spec(self, data):
        self.spec.write_text(json.dumps(data), encoding="utf-8")

    def test_batch_preview_apply_and_repeat(self):
        model = self.root / "tile.geo.json"
        model.write_text(json.dumps({
            "format_version": "1.12.0",
            "minecraft:geometry": [{"description": {"identifier": "geometry.tile"}, "bones": []}],
        }), encoding="utf-8")
        texture = self.root / "tile.png"
        texture.write_bytes((self.root / RP / "textures/blocks/quartz_bricks.png").read_bytes())
        self.assertEqual(self.call_cli("catalog", "--directory", ".", "--query", "geometry.tile")["total"], 1)

        row = {"id": "paradise:tile", "model": "tile.geo.json", "geometry": "geometry.tile", "texture": "tile.png",
               "provenance": [{"vanilla_path": "resource_pack/textures/blocks/quartz_bricks.png"}]}
        variant = {**row, "id": "paradise:tile_variant", "geometry_owner": "paradise:tile"}
        vanilla = self.root / "resource_pack/textures/blocks/quartz_bricks.png"
        vanilla.parent.mkdir(parents=True)
        vanilla.write_bytes(texture.read_bytes())
        self.write_spec({"vanilla_root": ".", "blocks": [row, variant], "dimensions": [{"id": "paradise:test_void"}]})
        arguments = ("scaffold", "--spec", str(self.spec))
        preview = self.call_cli(*arguments)
        self.assertEqual(preview["total"], 8)
        self.assertFalse((self.root / BP / "blocks").exists())
        self.assertEqual(self.call_cli(*arguments, "--apply")["items"], preview["items"])
        second = self.call_cli(*arguments, "--apply")
        self.assertEqual({item["action"] for item in second["items"]}, {"unchanged"})
        self.assertEqual(self.call_cli("validate", "--skip-typecheck")["checks"]["cross_links"]["errors"], 0)

        texture.write_bytes((self.root / RP / "textures/blocks/concrete_gray.png").read_bytes())
        self.call_cli(*arguments, "--apply", status=1)
        (self.root / RP / "textures/blocks/paradise__tile.png").unlink()
        report = self.call_cli("validate", "--skip-typecheck", status=1)
        self.assertTrue(any("missing block texture" in row["message"] for row in report["diagnostics"]["items"]))

    def test_package_is_clean_atomic_and_repeatable(self):
        output = self.root / "artifacts/test.mcaddon"
        (self.root / RP / "textures/unused.bbmodel").write_text("local export", encoding="utf-8")
        arguments = ("package", "--skip-typecheck", "--output", str(output))
        self.assertEqual(self.call_cli(*arguments)["excluded"]["total"], 1)
        self.assertFalse(output.exists())
        self.assertEqual(self.call_cli(*arguments, "--apply")["action"], "published")
        digest = hashlib.sha256(output.read_bytes()).digest()
        with zipfile.ZipFile(output) as archive:
            with zipfile.ZipFile(BytesIO(archive.read("Paradise_RP.mcpack"))) as pack:
                self.assertIn("manifest.json", pack.namelist())
                self.assertNotIn("textures/unused.bbmodel", pack.namelist())
        self.assertEqual(self.call_cli(*arguments, "--apply")["action"], "unchanged")
        output.write_bytes(b"existing unrelated archive")
        self.call_cli(*arguments, "--apply", status=1)
        self.assertEqual(output.read_bytes(), b"existing unrelated archive")
        self.call_cli(*arguments, "--apply", "--replace")
        self.assertEqual(hashlib.sha256(output.read_bytes()).digest(), digest)

    def test_validation_reports_broken_live_references(self):
        flashlight = self.root / BP / "scripts/player_light.js"
        flashlight.write_text(flashlight.read_text().replace(
            '"paradise.flashlight.switch"', '"paradise.flashlight.missing"'))
        biomes = self.root / RP / "biomes_client.json"
        biomes.write_text(biomes.read_text().replace("paradise:dark_fog", "paradise:missing_fog"))
        result = self.call_cli("validate", "--skip-typecheck", status=1)
        errors = [row["message"] for row in result["diagnostics"]["items"] if row["severity"] == "error"]
        self.assertTrue(any("missing sound paradise.flashlight.missing" in error for error in errors))
        self.assertTrue(any("missing fog paradise:missing_fog" in error for error in errors))
        manifest = self.root / BP / "manifest.json"
        data = json.loads(manifest.read_text())
        data["modules"] = None
        manifest.write_text(json.dumps(data))
        self.assertEqual(self.call_cli("validate", "--skip-typecheck", status=1)["checks"]["addon"]["errors"], 1)

    def test_dimension_collision_and_argument_error(self):
        self.write_spec({"dimensions": [{"id": "paradise:yellow_halls"}]})
        self.call_cli("scaffold", "--spec", str(self.spec), status=1)
        self.call_cli("inspect", "--limit", "0", status=2)
        self.assertFalse((self.root / BP / "dimensions").exists())


if __name__ == "__main__":
    unittest.main()
