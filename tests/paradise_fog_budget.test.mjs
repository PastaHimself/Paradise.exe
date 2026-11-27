import test from "node:test";
import assert from "node:assert/strict";

import { applyFogLayer, getFogRuntimeStats } from "../addon/BP/scripts/paradise_fog_runtime.js";
import {
  clampVisualY,
  particleYInDimension,
  getVisualBudget,
  isVisualYInBounds,
  shouldPlaceLeaf,
  WORLD_MAX_Y,
  WORLD_MIN_Y,
} from "../addon/BP/scripts/paradise_visual_budget.js";

const DIMENSION_TAG = "paradise_dimension_atmosphere";
const CONFIG_TAG = "paradise_config_fog_override";

function makeFogSettings(log, options = {}) {
  /** @type {Map<string, string | undefined>} */
  const stack = new Map(options.initial ?? []);
  return {
    stack,
    remove(tag) {
      log.push(`remove:${tag}`);
      if (options.throwOnRemove) throw new Error("remove failed");
      const had = stack.has(tag);
      stack.delete(tag);
      return had;
    },
    push(fogId, tag) {
      log.push(`push:${fogId}:${tag}`);
      if (options.throwOnPush) throw new Error("push failed");
      stack.set(tag, fogId);
      return true;
    },
  };
}

function makePlayer({ fog, commandResult = { successCount: 1 }, name = "Steve" } = {}) {
  const commands = [];
  const player = {
    name,
    commands,
    dimension: {
      runCommand(command) {
        commands.push(command);
        return commandResult;
      },
    },
  };
  if (fog) player.fogSettings = fog;
  return player;
}

function baseline() {
  return getFogRuntimeStats();
}

function deltaStats(before) {
  const after = getFogRuntimeStats();
  return {
    commandApplied: after.commandApplied - before.commandApplied,
    componentApplied: after.componentApplied - before.componentApplied,
    failures: after.failures - before.failures,
    lastFailure: after.lastFailure,
  };
}

test("fog component path applies before any command and never stacks", () => {
  const log = [];
  const fog = makeFogSettings(log);
  const player = makePlayer({ fog });
  const before = baseline();

  assert.equal(applyFogLayer(player, "paradise:yellow_halls_fog", DIMENSION_TAG), true);
  assert.equal(applyFogLayer(player, "paradise:library_fog", DIMENSION_TAG), true);

  assert.deepEqual(log, [
    `remove:${DIMENSION_TAG}`,
    `push:paradise:yellow_halls_fog:${DIMENSION_TAG}`,
    `remove:${DIMENSION_TAG}`,
    `push:paradise:library_fog:${DIMENSION_TAG}`,
  ]);
  assert.deepEqual(player.commands, [], "/fog must not run when the component works");
  assert.equal(fog.stack.get(DIMENSION_TAG), "paradise:library_fog");

  const stats = deltaStats(before);
  assert.equal(stats.componentApplied, 2);
  assert.equal(stats.commandApplied, 0);
  assert.equal(stats.failures, 0);
});

test("fog falls back to /fog when the component is unavailable", () => {
  const player = makePlayer();
  const before = baseline();

  assert.equal(applyFogLayer(player, "paradise:heaven_fog", DIMENSION_TAG), true);
  assert.deepEqual(player.commands, [
    `fog @a[name="Steve"] remove ${DIMENSION_TAG}`,
    `fog @a[name="Steve"] push paradise:heaven_fog ${DIMENSION_TAG}`,
  ]);

  const stats = deltaStats(before);
  assert.equal(stats.commandApplied, 1);
  assert.equal(stats.failures, 0);
});

test("fog falls back to /fog when remove or push throws", () => {
  for (const options of [{ throwOnRemove: true }, { throwOnPush: true }]) {
    const log = [];
    const player = makePlayer({ fog: makeFogSettings(log, options) });
    const before = baseline();

    assert.equal(applyFogLayer(player, "paradise:catacombs_fog", DIMENSION_TAG), true);
    assert.equal(player.commands.length, 2, "command fallback must still apply the layer");

    const stats = deltaStats(before);
    assert.equal(stats.componentApplied, 0);
    assert.equal(stats.commandApplied, 1);
    assert.equal(stats.failures, 0);
  }
});

test("fog keeps other packs' layers and a separate config override on top", () => {
  const log = [];
  const fog = makeFogSettings(log, {
    initial: [
      ["other_pack_fog", "other:pack_fog"],
      [CONFIG_TAG, "paradise:clear_fog"],
    ],
  });
  const player = makePlayer({ fog });

  applyFogLayer(player, "paradise:flat_flower_fog", DIMENSION_TAG);

  assert.equal(fog.stack.get("other_pack_fog"), "other:pack_fog");
  assert.equal(fog.stack.get(CONFIG_TAG), "paradise:clear_fog");
  assert.equal(fog.stack.get(DIMENSION_TAG), "paradise:flat_flower_fog");
  // Config override is applied second, so the dimension pass must not touch it.
  assert.ok(!log.includes(`remove:${CONFIG_TAG}`));
  assert.ok(!log.includes(`remove:other_pack_fog`));
});

test("two players in the same dimension keep independent fog stacks", () => {
  const playerALog = [];
  const playerBLog = [];
  const playerAFog = makeFogSettings(playerALog);
  const playerBFog = makeFogSettings(playerBLog);
  const playerA = makePlayer({ fog: playerAFog, name: "Alice" });
  const playerB = makePlayer({ fog: playerBFog, name: "Bob" });

  applyFogLayer(playerA, "paradise:yellow_halls_fog", DIMENSION_TAG);
  applyFogLayer(playerB, "paradise:library_fog", DIMENSION_TAG);
  applyFogLayer(playerA, "paradise:flat_flower_fog", DIMENSION_TAG);

  assert.equal(playerAFog.stack.get(DIMENSION_TAG), "paradise:flat_flower_fog");
  assert.equal(playerBFog.stack.get(DIMENSION_TAG), "paradise:library_fog");
  assert.deepEqual(playerA.commands, []);
  assert.deepEqual(playerB.commands, []);
  assert.equal(playerALog.filter((entry) => entry === `remove:${DIMENSION_TAG}`).length, 2);
  assert.equal(playerBLog.filter((entry) => entry === `remove:${DIMENSION_TAG}`).length, 1);
});

test("two command-fallback players receive only their own name-scoped fog commands", () => {
  const playerA = makePlayer({ name: "Alice" });
  const playerB = makePlayer({ name: "Bob" });

  applyFogLayer(playerA, "paradise:yellow_halls_fog", DIMENSION_TAG);
  applyFogLayer(playerB, "paradise:library_fog", DIMENSION_TAG);

  assert.deepEqual(playerA.commands, [
    `fog @a[name="Alice"] remove ${DIMENSION_TAG}`,
    `fog @a[name="Alice"] push paradise:yellow_halls_fog ${DIMENSION_TAG}`,
  ]);
  assert.deepEqual(playerB.commands, [
    `fog @a[name="Bob"] remove ${DIMENSION_TAG}`,
    `fog @a[name="Bob"] push paradise:library_fog ${DIMENSION_TAG}`,
  ]);
});

test("fog counts a command that reports no affected player as a failure", () => {
  const player = makePlayer({ commandResult: { successCount: 0 } });
  const before = baseline();

  assert.equal(applyFogLayer(player, "paradise:dark_fog", DIMENSION_TAG), false);

  const stats = deltaStats(before);
  assert.equal(stats.commandApplied, 0);
  assert.equal(stats.failures, 1);
  assert.match(stats.lastFailure, /no affected player/);
});

test("fog rejects a missing player or tag without touching the world", () => {
  const before = baseline();

  assert.equal(applyFogLayer(null, "paradise:dark_fog", DIMENSION_TAG), false);
  assert.equal(applyFogLayer(makePlayer(), "paradise:dark_fog", ""), false);

  const stats = deltaStats(before);
  assert.equal(stats.failures, 2);
});

test("visual budget falls back to the Low tier on unknown or throwing clients", () => {
  const low = getVisualBudget(undefined);
  assert.equal(low.particleBurst, 0);
  assert.equal(low.particleRadius, 10);

  const throwing = {
    get clientSystemInfo() {
      throw new Error("client info unavailable");
    },
  };
  assert.deepEqual(getVisualBudget(throwing), low);

  assert.deepEqual(getVisualBudget({ clientSystemInfo: { memoryTier: 0 } }), low);
  assert.equal(getVisualBudget({ clientSystemInfo: { memoryTier: 2 } }).particleRadius, 17);
  assert.equal(getVisualBudget({ clientSystemInfo: { memoryTier: 4 } }).particleRadius, 29);
});

test("visual Y clamping keeps decoration inside the vanilla build height", () => {
  assert.deepEqual([WORLD_MIN_Y, WORLD_MAX_Y], [-64, 319]);

  assert.equal(clampVisualY(-1000), WORLD_MIN_Y + 1);
  assert.equal(clampVisualY(1000), WORLD_MAX_Y - 1);
  assert.equal(clampVisualY(319), WORLD_MAX_Y - 1);
  assert.equal(clampVisualY(-64), WORLD_MIN_Y + 1);
  assert.equal(clampVisualY(64.9), 64);
  assert.equal(clampVisualY(Number.NaN), WORLD_MIN_Y + 1);

  assert.equal(isVisualYInBounds(WORLD_MIN_Y), true);
  assert.equal(isVisualYInBounds(WORLD_MAX_Y), true);
  assert.equal(isVisualYInBounds(WORLD_MIN_Y - 1), false);
  assert.equal(isVisualYInBounds(WORLD_MAX_Y + 1), false);
  assert.equal(isVisualYInBounds(Number.NaN), false);
});

test("leaf cleanup skips the Low tier and out-of-band positions", () => {
  const low = getVisualBudget(undefined);
  const mid = getVisualBudget({ clientSystemInfo: { memoryTier: 2 } });

  assert.equal(shouldPlaceLeaf(low, 64), false);
  assert.equal(shouldPlaceLeaf(mid, 64), true);
  assert.equal(shouldPlaceLeaf(mid, 400), false);
  assert.equal(shouldPlaceLeaf(undefined, 64), false);
  assert.equal(shouldPlaceLeaf(undefined, 400), false);
});

test("malformed memory tiers never increase the low-memory particle budget", () => {
  for (const memoryTier of [NaN, Infinity, -Infinity, -1, 5, 2.5, "4", null, undefined]) {
    assert.equal(getVisualBudget({ clientSystemInfo: { memoryTier } }).particleBurst, 0);
  }
});

test("particle samples outside the live height range are skipped, not stacked at its edges", () => {
  const dimension = { heightRange: { min: 0, max: 128 } };
  assert.equal(particleYInDimension(0, dimension), 0);
  assert.equal(particleYInDimension(127.9, dimension), 127.9);
  for (const y of [-1, 128, 320, Infinity, NaN]) assert.equal(particleYInDimension(y, dimension), undefined);
  assert.equal(particleYInDimension(319.5, {}), 319.5);
  assert.equal(particleYInDimension(320, {}), undefined);
});

test("fog fallback rejects an unconfirmed push result", () => {
  for (const commandResult of [null, {}, { successCount: NaN }, { successCount: Infinity }]) {
    assert.equal(applyFogLayer(makePlayer({ commandResult }), "paradise:dark_fog", DIMENSION_TAG), false);
  }
});
