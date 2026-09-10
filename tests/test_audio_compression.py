import unittest
from pathlib import Path

from tools.compress_audio import CompressionError, _segment_specs


class AudioCompressionTests(unittest.TestCase):
    def test_looping_bed_specs_match_declared_segment_limit(self):
        asset = {
            "id": "bed",
            "role": "looping_bed",
            "segment_durations_seconds": [8, 8, 1],
            "loop_crossfade_milliseconds": 500,
        }
        paths = [Path(f"segment_{index}.ogg") for index in range(3)]

        specs = _segment_specs(
            asset,
            17.0,
            {"max_bed_segment_seconds": 8, "loop_crossfade_milliseconds": 500},
            paths,
        )

        self.assertEqual([(start, duration) for _path, start, duration in specs], [(0, 8), (8, 8), (16, 1)])

    def test_looping_bed_rejects_missing_crossfade_declaration(self):
        asset = {
            "id": "bed",
            "role": "looping_bed",
            "segment_durations_seconds": [8, 1],
            "loop_crossfade_milliseconds": 0,
        }

        with self.assertRaisesRegex(CompressionError, "crossfade"):
            _segment_specs(
                asset,
                9.0,
                {"max_bed_segment_seconds": 8, "loop_crossfade_milliseconds": 500},
                [Path("segment_1.ogg"), Path("segment_2.ogg")],
            )


if __name__ == "__main__":
    unittest.main()
