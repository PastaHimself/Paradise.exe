import tempfile
import unittest
from pathlib import Path

from tools.validate_audio_manifest import validate_manifest


def base_pack(status="cleared", derivative=True, redistribution=True):
    return {
        "id": "test_pack",
        "display_name": "Test Pack",
        "expected_file_count": 1,
        "license_status": status,
        "redistribution_allowed": redistribution,
        "derivative_encoding_allowed": derivative,
    }


def base_asset(status="cleared", derivative=True, redistribution=True, checksum="0" * 64):
    return {
        "id": "test_asset",
        "pack": "test_pack",
        "source_path": "missing.wav",
        "source_sha256": checksum,
        "role": "one_shot",
        "pool": "test",
        "scenario_tags": ["test"],
        "intensity_tier": "omen",
        "codec_profile": "voice_entity",
        "output_path": "out.ogg",
        "license_status": status,
        "source_url": None,
        "author": None,
        "attribution_text": None,
        "redistribution_allowed": redistribution,
        "derivative_encoding_allowed": derivative,
        "evidence_path": None,
    }


class AudioManifestTests(unittest.TestCase):
    def test_asset_cannot_upgrade_a_blocked_pack(self):
        manifest = {
            "schema_version": 1,
            "required_total_files": 1,
            "packs": [base_pack(status="license_blocked", derivative=False, redistribution=False)],
            "assets": [base_asset()],
        }
        report = validate_manifest(manifest, Path("."), require_complete=True)
        self.assertFalse(report["ok"])
        self.assertTrue(any("disagrees with pack" in error for error in report["errors"]))

    def test_staged_source_hash_mismatch_is_an_error(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source.wav"
            source.write_bytes(b"actual")
            manifest = {
                "schema_version": 1,
                "required_total_files": 1,
                "packs": [base_pack()],
                "assets": [
                    {
                        **base_asset(),
                        "source_path": "source.wav",
                        "source_sha256": "0" * 64,
                    }
                ],
            }
            report = validate_manifest(manifest, root, require_complete=False)
            self.assertFalse(report["ok"])
            self.assertTrue(any("source_sha256 mismatch" in error for error in report["errors"]))


if __name__ == "__main__":
    unittest.main()
