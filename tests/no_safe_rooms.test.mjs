import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const productionFiles = [
  "addon/Genshin X Craft BP/scripts/paradise_horror_state.js",
  "addon/Genshin X Craft BP/scripts/horror_events_v2.js",
  "addon/Genshin X Craft BP/scripts/paradise_horror_experience.js",
  "addon/Genshin X Craft BP/scripts/watcher_stalker.js",
  "addon/Genshin X Craft BP/scripts/watcher_stalker_visibility_model.js",
  "addon/Genshin X Craft BP/scripts/destructive_horror_events.js",
  "addon/Genshin X Craft BP/scripts/harmful_player_events.js",
  "addon/Genshin X Craft BP/scripts/paradise_debug.js",
];

test("production horror code contains no safe-room mechanics", () => {
  for (const relativePath of productionFiles) {
    const source = fs.readFileSync(path.join(root, relativePath), "utf8");
    assert.doesNotMatch(source, /safe[ _-]?room/i, relativePath);
    assert.doesNotMatch(source, /paradise_safe_room/i, relativePath);
  }
});

test("the event loop no longer imports or calls a safe-room gate", () => {
  const source = fs.readFileSync(
    path.join(root, "addon/Genshin X Craft BP/scripts/horror_events_v2.js"),
    "utf8",
  );
  assert.doesNotMatch(source, /isPlayerInSafeRoom|safe_room|safeRoom/i);
});

test("secondary horror modules do not depend on removed safe-room exports", () => {
  for (const relativePath of productionFiles.slice(-3)) {
    const source = fs.readFileSync(path.join(root, relativePath), "utf8");
    assert.doesNotMatch(source, /isPlayerInSafeRoom|safe_room|safeRoom/i, relativePath);
  }
});
