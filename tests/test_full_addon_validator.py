import json
import tempfile
import unittest
from pathlib import Path

from tools.validate_addon import AddonValidator


class AddonValidatorTests(unittest.TestCase):
    def make_pack_pair(self, root: Path) -> tuple[Path, Path]:
        bp = root / "addon" / "Genshin X Craft BP"
        rp = root / "addon" / "Genshin X Craft RP"
        (bp / "scripts").mkdir(parents=True)
        (bp / "structures" / "paradise" / "demo").mkdir(parents=True)
        (rp / "textures" / "particle" / "paradise").mkdir(parents=True)
        (rp / "particles").mkdir(parents=True)
        (rp / "subpacks" / "vhs_off").mkdir(parents=True)
        (rp / "subpacks" / "vhs_on").mkdir(parents=True)

        rp_uuid = "11111111-1111-4111-8111-111111111111"
        rp_version = [1, 0, 0]
        (bp / "manifest.json").write_text(json.dumps({
            "format_version": 2,
            "header": {
                "name": "BP",
                "uuid": "22222222-2222-4222-8222-222222222222",
                "version": [1, 0, 0],
                "min_engine_version": [1, 21, 80],
            },
            "modules": [{
                "type": "script",
                "uuid": "33333333-3333-4333-8333-333333333333",
                "version": [1, 0, 0],
                "language": "javascript",
                "entry": "scripts/main.js",
            }],
            "dependencies": [{"uuid": rp_uuid, "version": rp_version}],
        }), encoding="utf-8")
        (rp / "manifest.json").write_text(json.dumps({
            "format_version": 2,
            "header": {
                "name": "RP",
                "uuid": rp_uuid,
                "version": rp_version,
                "min_engine_version": [1, 21, 80],
            },
            "modules": [{
                "type": "resources",
                "uuid": "44444444-4444-4444-8444-444444444444",
                "version": [1, 0, 0],
            }],
            "subpacks": [
                {"folder_name": "vhs_off", "name": "VHS Off", "memory_tier": 1},
                {"folder_name": "vhs_on", "name": "VHS On", "memory_tier": 1},
            ],
        }), encoding="utf-8")
        (bp / "scripts" / "main.js").write_text('import "./visual.js";\n', encoding="utf-8")
        (bp / "scripts" / "visual.js").write_text(
            'scheduleStructurePlacement("x", "paradise:demo/room", dimension, location);\n',
            encoding="utf-8",
        )
        (bp / "structures" / "paradise" / "demo" / "room.mcstructure").write_bytes(b"NBT")
        (rp / "textures" / "particle" / "paradise" / "dust.png").write_bytes(b"\x89PNG\r\n\x1a\n")
        (rp / "particles" / "dust.json").write_text(json.dumps({
            "format_version": "1.10.0",
            "particle_effect": {
                "description": {
                    "identifier": "paradise:dust",
                    "basic_render_parameters": {
                        "material": "particles_blend",
                        "texture": "textures/particle/paradise/dust",
                    },
                },
                "components": {},
            },
        }), encoding="utf-8")
        return bp, rp

    def test_valid_pack_pair_passes_core_checks(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.make_pack_pair(root)
            result = AddonValidator(root).run()
            self.assertEqual(result["errors"], [])
            self.assertGreaterEqual(result["counts"]["json_files"], 3)
            self.assertGreaterEqual(result["counts"]["javascript_files"], 2)

    def test_invalid_json_is_reported_with_path(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            bp, _ = self.make_pack_pair(root)
            broken = bp / "entities" / "broken.json"
            broken.parent.mkdir(parents=True)
            broken.write_text('{"minecraft:entity":', encoding="utf-8")
            result = AddonValidator(root).run()
            self.assertTrue(any("entities/broken.json" in error for error in result["errors"]))

    def test_missing_relative_script_import_is_error(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            bp, _ = self.make_pack_pair(root)
            (bp / "scripts" / "main.js").write_text('import "./missing.js";\n', encoding="utf-8")
            result = AddonValidator(root).run()
            self.assertTrue(any("missing.js" in error for error in result["errors"]))

    def test_behavior_pack_dependency_must_match_resource_pack(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            bp, _ = self.make_pack_pair(root)
            manifest_path = bp / "manifest.json"
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            manifest["dependencies"][0]["version"] = [9, 9, 9]
            manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
            result = AddonValidator(root).run()
            self.assertTrue(any("resource-pack dependency" in error.lower() for error in result["errors"]))

    def test_particle_texture_reference_must_exist(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            _, rp = self.make_pack_pair(root)
            (rp / "textures" / "particle" / "paradise" / "dust.png").unlink()
            result = AddonValidator(root).run()
            self.assertTrue(any("particle texture" in error.lower() for error in result["errors"]))

    def test_structure_reference_must_resolve_to_mcstructure(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            bp, _ = self.make_pack_pair(root)
            (bp / "structures" / "paradise" / "demo" / "room.mcstructure").unlink()
            result = AddonValidator(root).run()
            self.assertTrue(any("structure reference" in error.lower() for error in result["errors"]))


if __name__ == "__main__":
    unittest.main()
