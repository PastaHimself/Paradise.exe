import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const watcherUrl = new URL("../addon/Genshin X Craft BP/scripts/watcher_stalker.js", import.meta.url);

test("Watcher keeps the intended encounter phases and evidence gates", async () => {
  const source = await readFile(watcherUrl, "utf8");
  for (const phase of ["Observe", "Shadow", "Pressure", "Ambush", "Vanish"]) {
    assert.match(source, new RegExp(`\\b${phase}\\b`));
  }
  assert.match(source, /observeAdaptiveFlashlight/);
  assert.match(source, /observeAdaptiveLook/);
  assert.match(source, /observeAdaptiveRoute/);
  assert.match(source, /hasAttackEvidencePolicy/);
  assert.match(source, /canResolveAdaptiveAmbushDamage/);
  assert.match(source, /horrorExperienceCoordinator\.requestHorrorBeat/);
  assert.match(source, /settleWatcherHorrorBeat/);
  assert.match(source, /experienceBeatId/);
});

test("Watcher has no safe-room bypass or safe-room encounter path", async () => {
  const source = await readFile(watcherUrl, "utf8");
  assert.doesNotMatch(source, /safe[ _-]?room|safeRoom|SafeRoom|isPlayerInSafeRoom/i);
});


test("Watcher releases coordinator state when players leave or die", async () => {
  const source = await readFile(watcherUrl, "utf8");
  assert.match(source, /clearHorrorExperience\(playerId, "player_left"\)/);
  assert.match(source, /clearHorrorExperience\(deadPlayer\.id, "player_died"\)/);
  assert.match(source, /completeHorrorBeat/);
  assert.match(source, /cancelHorrorBeat/);
});
