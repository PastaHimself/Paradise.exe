import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = path.join(ROOT, "tools", "audio_assets.json");

function readManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
}

test("audio manifest records every supplied pack and the 127-file target", () => {
  const manifest = readManifest();
  assert.equal(manifest.schema_version, 1);
  assert.equal(manifest.required_total_files, 127);
  assert.deepEqual(
    manifest.packs.map((pack) => [pack.id, pack.expected_file_count]),
    [
      ["wind", 3],
      ["old_locations", 10],
      ["footsteps", 40],
      ["entity", 30],
      ["ghost_voices", 33],
      ["echoes", 11],
    ],
  );
});

test("unverified wind files are present in the audit manifest but cannot be runtime-ready", () => {
  const manifest = readManifest();
  const wind = manifest.assets.filter((asset) => asset.pack === "wind");
  assert.equal(wind.length, 3);
  assert.ok(wind.every((asset) => asset.license_status === "license_blocked"));
  assert.ok(wind.every((asset) => asset.derivative_encoding_allowed === false));
  assert.ok(wind.every((asset) => asset.output_path === null));
});
