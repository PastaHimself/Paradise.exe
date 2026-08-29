import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("VHS state keeps its Bedrock and player-config dependencies", () => {
  const source = read("addon/Genshin X Craft BP/scripts/paradise_horror_state.js");
  assert.match(source, /import \{ system \} from "@minecraft\/server";/);
  assert.match(source, /import \{ isVhsEnabled, onVhsPreferenceChanged \} from "\.\/player_config\.js";/);
  assert.match(source, /system\.currentTick/);
  assert.match(source, /isVhsEnabled\(player\)/);
  assert.match(source, /onVhsPreferenceChanged\(/);
});

test("major and minor event decisions expose the same caller fields", () => {
  const source = read("addon/Genshin X Craft BP/scripts/horror_events_v2.js");
  assert.match(source, /: \{ allowed: true, reason: "minor_event", beatId: undefined \}/);
  assert.match(source, /reason: experienceDecision\.reason/);
  assert.match(source, /experienceDecision\.beatId/);
});

test("Watcher calls psychological helpers with their declared arity", () => {
  const source = read("addon/Genshin X Craft BP/scripts/watcher_stalker.js");
  assert.doesNotMatch(source, /isPsychologicalDecisionAllowed\(player, profile, currentTick, false\)/);
  assert.doesNotMatch(source, /choosePsychologicalEncounterOutcome\(profile, currentTick, false\)/);
  assert.doesNotMatch(source, /triggerPsychologicalAppearance\(player, profile, currentTick, outcome, false\)/);
});
