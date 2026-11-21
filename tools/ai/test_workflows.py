"""Exercise navigation, version planning, staged assets, and captured diagnostics."""

import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from common import BP, ROOT, RP, read_json


class WorkflowTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        for pack in (BP, RP):
            path = self.root / pack / "manifest.json"
            path.parent.mkdir(parents=True)
            path.write_bytes((ROOT / pack / "manifest.json").read_bytes())

    def call_cli(self, *arguments, status=0):
        result = subprocess.run(
            ["python3", str(ROOT / "tools/ai/cli.py"), "--root", str(self.root), *arguments],
            cwd=self.root, capture_output=True, text=True, timeout=30,
        )
        self.assertEqual(result.returncode, status, result.stdout + result.stderr)
        report = json.loads(result.stdout)
        self.assertEqual(report["status"], status)
        self.assertEqual(report["ok"], status == 0)
        return report

    def write_json(self, relative, data):
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data), encoding="utf-8")

    def git(self, *arguments):
        subprocess.run(["git", "-C", str(self.root), *arguments], check=True, capture_output=True)

    def test_refs_and_deleted_script_impact(self):
        scripts = self.root / BP / "scripts"
        scripts.mkdir()
        (scripts / "main.js").write_text('import "./relay.js";\n')
        (scripts / "relay.js").write_text('export { id } from "./target.js";\n')
        (scripts / "target.js").write_text('import "./relay.js";\nexport const id = "test:one";\n'
                                           'export const message = `prefix-test:one:${id}`;\n')
        self.write_json(RP / "entity/one.json", {"minecraft:client_entity": {
            "description": {"identifier": "test:one"}, "test:one": ["other"]}})
        result = self.call_cli("refs", "test:one")
        self.assertEqual(result["counts"], {"js-literal": 1, "json-key": 1, "json-value": 1})
        self.assertTrue(any(row.get("definition") for row in result["items"]))
        self.assertEqual(self.call_cli("refs", "prefix-test:one", "--contains")["counts"], {"js-literal": 1})

        impact = self.call_cli("impact", "--file", "target.js")
        self.assertEqual([row["depth"] for row in impact["items"]], [0, 1, 2])
        self.assertTrue(all(row["entry_reachable"] for row in impact["items"]))
        self.git("init", "-q")
        self.git("add", ".")
        self.git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid",
                 "commit", "-m", "Fixture")
        (scripts / "target.js").unlink()
        impact = self.call_cli("impact", "--base", "HEAD", status=1)
        self.assertEqual(impact["unresolved_imports"]["total"], 1)
        self.assertEqual(impact["items"][2]["file"], (BP / "scripts/main.js").as_posix())

    def test_folder_import_requires_unambiguous_pair_and_is_repeatable(self):
        self.write_json("exports/tile.geo.json", {
            "format_version": "1.12.0",
            "minecraft:geometry": [{"description": {"identifier": "geometry.tile"}, "bones": []}],
        })
        args = ("scaffold", "--from-directory", "exports", "--namespace", "decor")
        self.assertEqual(self.call_cli(*args, status=1)["paired_blocks"], 0)
        texture = ROOT / RP / "textures/items/flashlight_off.png"
        (self.root / "exports/tile.png").write_bytes(texture.read_bytes())
        self.assertEqual(self.call_cli(*args)["paired_blocks"], 1)
        self.assertFalse((self.root / BP / "blocks").exists())
        self.call_cli(*args, "--apply")
        second = self.call_cli(*args, "--apply")
        self.assertEqual({row["action"] for row in second["items"]}, {"unchanged"})
        self.assertEqual(read_json(self.root / BP / "blocks/decor__tile.json")
                         ["minecraft:block"]["description"]["identifier"], "decor:tile")

    def test_paired_manifest_versions_and_dependency_stay_in_sync(self):
        bp_path, rp_path = (self.root / pack / "manifest.json" for pack in (BP, RP))
        initial_bp = read_json(bp_path)
        args = ("manifest", "--bp-version", "2.0.0", "--rp-version", "2.0.0", "--engine", "1.26.50")
        preview = self.call_cli(*args)
        self.assertEqual(preview["versions"]["bp_rp_dependency"]["after"], [2, 0, 0])
        self.assertEqual(read_json(bp_path), initial_bp)
        self.call_cli(*args, "--apply")
        self.assertEqual(read_json(bp_path)["header"]["uuid"], initial_bp["header"]["uuid"])
        self.assertEqual(read_json(bp_path)["dependencies"][0]["version"], read_json(rp_path)["header"]["version"])
        self.assertTrue(all(module["version"] == [2, 0, 0] for module in read_json(bp_path)["modules"]))
        self.assertEqual({row["action"] for row in self.call_cli(*args, "--apply")["items"]}, {"unchanged"})
        self.call_cli("manifest", "--rp-version", "1.0.0", "--apply", status=1)

    def test_structure_filters_observed_blocks(self):
        path = BP / "structures/paradise/catacombs/collapsed_crypt.mcstructure"
        target = self.root / path
        target.parent.mkdir(parents=True)
        target.write_bytes((ROOT / path).read_bytes())
        result = self.call_cli("structures", "--block", "minecraft:bone_block", "--check-blocks")
        self.assertEqual(result["blocks"]["items"][0]["by_layer"], [2, 0])
        self.assertEqual(self.call_cli("structures", "--block", "minecraft:bedrock")["total"], 0)

    def test_cpu_profile_self_and_inclusive_times(self):
        self.write_json("session.cpuprofile", {
            "nodes": [
                {"id": 1, "children": [2], "callFrame": {"functionName": "(root)"}},
                {"id": 2, "children": [3], "callFrame": {"functionName": "pulse", "url": "main.js", "lineNumber": 4}},
                {"id": 3, "callFrame": {"functionName": "update", "url": "worker.js", "lineNumber": 8}},
            ], "samples": [2, 3], "timeDeltas": [70, 30],
        })
        ranked = self.call_cli("profile", "session.cpuprofile", "--file", ".js")
        self.assertEqual(ranked["sampled_us"], 100)
        self.assertEqual(ranked["items"][0]["self_us"], 70)
        self.assertEqual(ranked["items"][0]["total_us"], 100)
        self.assertEqual(ranked["items"][1]["line"], 9)

    def test_blockception_delta_retains_duplicate_regressions(self):
        issue = {"severity": 1, "file": "pack/entity.json", "code": "unresolved", "message": "Missing ID"}
        self.write_json("base.json", {"diagnostics": [{**issue, "range": {"start": {"line": 3}}}]})
        self.write_json("current.json", {"diagnostics": [issue, issue]})
        report = self.call_cli("diagnostics", "--current", "current.json", "--baseline", "base.json", status=1)
        self.assertEqual(report["added"]["items"][0]["count"], 1)
        self.assertEqual(report["resolved"]["total"], 0)


if __name__ == "__main__":
    unittest.main()
