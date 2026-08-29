import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const manifestUrl = new URL("../docs/audio/paradise-sound-assets.json", import.meta.url);

test("audio manifest is traceable, compressed, and within budget", async () => {
  const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
  assert.ok(Array.isArray(manifest.assets));
  assert.ok(manifest.assets.length >= 20);

  const targets = new Set();
  let totalBudgetedBytes = 0;
  for (const asset of manifest.assets) {
    assert.ok(asset.sourceArchive);
    assert.ok(asset.sourcePath);
    assert.ok(asset.targetPath.endsWith(".ogg"), asset.targetPath);
    assert.ok(asset.cueId);
    assert.ok(asset.profile === "positional" || asset.profile === "ambience");
    assert.ok(asset.licenseUrl);
    assert.ok(asset.credit);
    assert.equal(targets.has(asset.targetPath), false, asset.targetPath);
    targets.add(asset.targetPath);
    totalBudgetedBytes += Number(asset.estimatedBytes || 0);
  }

  assert.ok(Number.isInteger(manifest.totalBudgetBytes));
  assert.ok(totalBudgetedBytes <= manifest.totalBudgetBytes || totalBudgetedBytes === 0);
  assert.equal(targets.size, manifest.assets.length);
});
