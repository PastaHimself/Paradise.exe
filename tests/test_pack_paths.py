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
        geometry_ids = set()
        for geometry_path in sorted((ROOT / "addon/RP/models/blocks").rglob("*.geo.json")):
            document = json.loads(geometry_path.read_text())
            for geometry in document.get("minecraft:geometry", []):
                identifier = geometry.get("description", {}).get("identifier")
                if identifier:
                    geometry_ids.add(identifier)

        missing = []
        for path in sorted((ROOT / "addon/BP/blocks").glob("*.json")):
            document = json.loads(path.read_text())
            geometry = document["minecraft:block"]["components"]["minecraft:geometry"]
            identifier = geometry if isinstance(geometry, str) else geometry.get("identifier")
            if identifier not in geometry_ids:
                missing.append((path.name, identifier))
        self.assertEqual(missing, [])


if __name__ == "__main__":
    unittest.main()
