import tempfile
import unittest
import zipfile
from pathlib import Path

from tools.package_mcaddon import package_mcaddon


class PackageMcaddonTests(unittest.TestCase):
    def test_package_contains_two_mcpacks_with_root_manifests(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            bp = root / "Behavior Pack"
            rp = root / "Resource Pack"
            out = root / "build" / "Paradise.exe.mcaddon"

            bp.mkdir(parents=True)
            rp.mkdir(parents=True)
            (bp / "manifest.json").write_text('{"format_version":2}', encoding="utf-8")
            (bp / "scripts").mkdir()
            (bp / "scripts" / "main.js").write_text("export {};", encoding="utf-8")
            (rp / "manifest.json").write_text('{"format_version":2}', encoding="utf-8")
            (rp / "textures").mkdir()
            (rp / "textures" / "sample.txt").write_text("x", encoding="utf-8")

            result = package_mcaddon(bp, rp, out)

            self.assertEqual(result, out)
            self.assertTrue(out.is_file())

            with zipfile.ZipFile(out) as addon_zip:
                self.assertEqual(
                    sorted(addon_zip.namelist()),
                    ["Paradise_BP.mcpack", "Paradise_RP.mcpack"],
                )

                for pack_name in ("Paradise_BP.mcpack", "Paradise_RP.mcpack"):
                    pack_bytes = addon_zip.read(pack_name)
                    nested_path = root / pack_name
                    nested_path.write_bytes(pack_bytes)
                    with zipfile.ZipFile(nested_path) as pack_zip:
                        self.assertIn("manifest.json", pack_zip.namelist())
                        self.assertNotIn("Behavior Pack/manifest.json", pack_zip.namelist())
                        self.assertNotIn("Resource Pack/manifest.json", pack_zip.namelist())


if __name__ == "__main__":
    unittest.main()
