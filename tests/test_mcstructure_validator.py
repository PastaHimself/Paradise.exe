import struct
import tempfile
import unittest
from pathlib import Path

from tools.validate_mcstructures import MCStructureError, validate_mcstructure_bytes, validate_structure_tree


TAG_END = 0
TAG_INT = 3
TAG_STRING = 8
TAG_LIST = 9
TAG_COMPOUND = 10


def nbt_string(value: str) -> bytes:
    data = value.encode("utf-8")
    return struct.pack("<h", len(data)) + data


def named_tag(tag_type: int, name: str, payload: bytes) -> bytes:
    return bytes([tag_type]) + nbt_string(name) + payload


def int_tag(name: str, value: int) -> bytes:
    return named_tag(TAG_INT, name, struct.pack("<i", value))


def string_tag(name: str, value: str) -> bytes:
    return named_tag(TAG_STRING, name, nbt_string(value))


def int_list_tag(name: str, values: list[int]) -> bytes:
    payload = bytes([TAG_INT]) + struct.pack("<i", len(values))
    payload += b"".join(struct.pack("<i", value) for value in values)
    return named_tag(TAG_LIST, name, payload)


def compound_tag(name: str, payload: bytes) -> bytes:
    return named_tag(TAG_COMPOUND, name, payload + bytes([TAG_END]))


def list_of_int_lists_tag(name: str, layers: list[list[int]]) -> bytes:
    payload = bytes([TAG_LIST]) + struct.pack("<i", len(layers))
    for layer in layers:
        payload += bytes([TAG_INT]) + struct.pack("<i", len(layer))
        payload += b"".join(struct.pack("<i", value) for value in layer)
    return named_tag(TAG_LIST, name, payload)


def block_palette_tag(names: list[str]) -> bytes:
    payload = bytes([TAG_COMPOUND]) + struct.pack("<i", len(names))
    for name in names:
        entry = string_tag("name", name)
        entry += compound_tag("states", b"")
        entry += int_tag("version", 17959425)
        entry += bytes([TAG_END])
        payload += entry
    return named_tag(TAG_LIST, "block_palette", payload)


def build_mcstructure(
    *,
    size: tuple[int, int, int] = (1, 1, 1),
    layers: list[list[int]] | None = None,
    palette: list[str] | None = None,
) -> bytes:
    volume = size[0] * size[1] * size[2]
    palette = palette or ["minecraft:stone"]
    layers = layers or [[0] * volume, [-1] * volume]

    default_palette = block_palette_tag(palette)
    default_palette += compound_tag("block_position_data", b"")
    palette_payload = compound_tag("default", default_palette)

    structure_payload = list_of_int_lists_tag("block_indices", layers)
    structure_payload += compound_tag("palette", palette_payload)

    root_payload = int_tag("format_version", 1)
    root_payload += int_list_tag("size", list(size))
    root_payload += int_list_tag("structure_world_origin", [0, 0, 0])
    root_payload += compound_tag("structure", structure_payload)
    root_payload += bytes([TAG_END])

    return bytes([TAG_COMPOUND]) + nbt_string("") + root_payload


class MCStructureValidatorTests(unittest.TestCase):
    def test_valid_minimal_structure_is_accepted(self):
        report = validate_mcstructure_bytes(build_mcstructure())
        self.assertEqual(report["size"], [1, 1, 1])
        self.assertEqual(report["volume"], 1)
        self.assertEqual(report["non_air_blocks"], 1)
        self.assertEqual(report["palette_size"], 1)
        self.assertEqual(report["layers"], 2)

    def test_root_must_be_compound(self):
        with self.assertRaisesRegex(MCStructureError, "root tag"):
            validate_mcstructure_bytes(bytes([TAG_INT]) + nbt_string("") + struct.pack("<i", 1))

    def test_block_index_layer_length_must_match_volume(self):
        payload = build_mcstructure(size=(2, 1, 1), layers=[[0], [-1]])
        with self.assertRaisesRegex(MCStructureError, "does not match volume"):
            validate_mcstructure_bytes(payload)

    def test_palette_index_must_be_in_range(self):
        payload = build_mcstructure(layers=[[4], [-1]], palette=["minecraft:stone"])
        with self.assertRaisesRegex(MCStructureError, "palette index"):
            validate_mcstructure_bytes(payload)

    def test_structure_size_must_stay_inside_bedrock_safety_envelope(self):
        payload = build_mcstructure(size=(65, 1, 1))
        with self.assertRaisesRegex(MCStructureError, "64x96x64"):
            validate_mcstructure_bytes(payload)

    def test_structure_must_contain_a_non_air_primary_block(self):
        payload = build_mcstructure(layers=[[-1], [-1]])
        with self.assertRaisesRegex(MCStructureError, "no non-air"):
            validate_mcstructure_bytes(payload)

    def test_structure_tree_reports_every_mcstructure(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            structures = root / "addon" / "Genshin X Craft BP" / "structures" / "paradise" / "test"
            structures.mkdir(parents=True)
            (structures / "one.mcstructure").write_bytes(build_mcstructure())
            (structures / "two.mcstructure").write_bytes(build_mcstructure(size=(2, 1, 1)))

            report = validate_structure_tree(root)

            self.assertTrue(report["ok"])
            self.assertEqual(report["structure_count"], 2)
            self.assertEqual(len(report["structures"]), 2)
            self.assertEqual(report["errors"], [])


if __name__ == "__main__":
    unittest.main()
