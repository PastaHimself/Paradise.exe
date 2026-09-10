import unittest

from tools.stage_audio_manifest import encoded_outputs


class AudioStagingTests(unittest.TestCase):
    def test_long_bed_is_planned_as_bounded_outputs(self):
        outputs, durations = encoded_outputs(
            "old_locations",
            "old_locations_001_halls",
            "looping_bed",
            17.0,
            {"max_bed_segment_seconds": 8},
            True,
        )

        self.assertEqual(outputs, [
            "addon/Genshin X Craft RP/sounds/paradise_audio/old_locations/old_locations_001_halls_segment_001.ogg",
            "addon/Genshin X Craft RP/sounds/paradise_audio/old_locations/old_locations_001_halls_segment_002.ogg",
            "addon/Genshin X Craft RP/sounds/paradise_audio/old_locations/old_locations_001_halls_segment_003.ogg",
        ])
        self.assertEqual(durations, [8, 8, 1])

    def test_blocked_pack_never_gets_output_paths(self):
        self.assertEqual(
            encoded_outputs("wind", "wind_001", "looping_bed", 46.0, {"max_bed_segment_seconds": 8}, False),
            ([], []),
        )


if __name__ == "__main__":
    unittest.main()
