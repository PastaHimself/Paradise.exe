import unittest

from tools.generate_sound_definitions import build_sound_definitions


class SoundDefinitionGenerationTests(unittest.TestCase):
    def test_semantic_sound_definition_includes_all_encoded_segments(self):
        manifest = {
            "packs": [
                {
                    "id": "wind",
                    "runtime_sound_ids": ["paradise.ambient.wind.open"],
                }
            ],
            "assets": [
                {
                    "pack": "wind",
                    "license_status": "cleared",
                    "output_paths": [
                        "addon/Genshin X Craft RP/sounds/paradise_audio/wind/wind_001_segment_001.ogg",
                        "addon/Genshin X Craft RP/sounds/paradise_audio/wind/wind_001_segment_002.ogg",
                    ],
                }
            ],
        }

        definitions = build_sound_definitions(manifest)

        self.assertEqual(
            definitions["paradise.ambient.wind.open"]["sounds"],
            [
                {"name": "sounds/paradise_audio/wind/wind_001_segment_001"},
                {"name": "sounds/paradise_audio/wind/wind_001_segment_002"},
            ],
        )


if __name__ == "__main__":
    unittest.main()
