import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WATCHER_PATH = path.join(ROOT, "addon", "Genshin X Craft BP", "scripts", "watcher_stalker.js");

test("watcher targeted cues use the per-player audio adapter", () => {
  const source = fs.readFileSync(WATCHER_PATH, "utf8");

  assert.equal(source.includes("player.dimension.playSound"), false);
  assert.match(source, /tryPlayForOnePlayer\(\s*player,\s*[\"']watcher:/);
});
