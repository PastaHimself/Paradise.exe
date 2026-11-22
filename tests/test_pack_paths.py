import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SEGMENT_LIMIT = 59


class PackPathTests(unittest.TestCase):
    """Bedrock caps a pack path segment; Blockception fails CI above the limit."""

    def test_every_pack_path_segment_fits_the_client_limit(self):
        offenders = []
        for path in (ROOT / "addon").rglob("*"):
            if not path.is_file():
                continue
            for part in path.relative_to(ROOT / "addon").parts:
                if len(part) > SEGMENT_LIMIT:
                    offenders.append((len(part), path.relative_to(ROOT).as_posix()))
                    break
        self.assertEqual(offenders, [], f"Path segments over {SEGMENT_LIMIT} characters: {offenders[:5]}")

    def test_block_files_declare_the_target_format_and_identifier(self):
        blocks = sorted((ROOT / "addon/BP/blocks").glob("*.json"))
        self.assertGreater(len(blocks), 0)
        for path in blocks:
            document = json.loads(path.read_text())
            self.assertEqual(document["format_version"], "1.26.50", path.name)
            identifier = document["minecraft:block"]["description"]["identifier"]
            self.assertTrue(identifier.startswith("paradise:"), path.name)
            self.assertEqual(path.name, identifier.replace(":", "__") + ".json", path.name)

    def test_every_block_has_a_matching_geometry_file(self):
        missing = []
        for path in sorted((ROOT / "addon/BP/blocks").glob("*.json")):
            document = json.loads(path.read_text())
            geometry = document["minecraft:block"]["components"]["minecraft:geometry"]
            expected = ROOT / "addon/RP/models/blocks" / path.name.replace(".json", ".geo.json")
            if not expected.exists():
                missing.append((path.name, geometry))
        self.assertEqual(missing, [])


if __name__ == "__main__":
    unittest.main()
