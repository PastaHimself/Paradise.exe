import test from "node:test";
import assert from "node:assert/strict";
import {
  canTeleportStalker,
  recordStalkerTeleport,
  clearStalkerTeleportGovernors,
  resetStalkerTeleportBudget,
} from "../addon/Genshin X Craft BP/scripts/stalker_teleport_governor.js";

function baseFixture() {
  const entity = { id: "watcher-a", location: { x: 0, y: 64, z: 0 } };
  const player = { id: "player-a", location: { x: 100, y: 64, z: 0 } };
  const state = { entityId: entity.id, phase: "observe", phaseChangedTick: 0 };
  return { entity, player, state };
}

test("governor rejects repositioning during protected relief", () => {
  clearStalkerTeleportGovernors();
  const { entity, player, state } = baseFixture();
  const result = canTeleportStalker({
    entity,
    player,
    state,
    phase: "observe",
    currentTick: 1000,
    fromLocation: entity.location,
    toLocation: { x: 60, y: 64, z: 0 },
    directorPhase: "relief",
    protectedRelief: true,
    physicallyValid: true,
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "relief");
});

test("governor rejects non-setup teleport while directly visible", () => {
  clearStalkerTeleportGovernors();
  const { entity, player, state } = baseFixture();
  const result = canTeleportStalker({
    entity,
    player,
    state,
    phase: "observe",
    currentTick: 1000,
    fromLocation: entity.location,
    toLocation: { x: 60, y: 64, z: 0 },
    visible: true,
    physicallyValid: true,
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "visible");
});

test("governor penalizes the same reposition pattern across encounters", () => {
  clearStalkerTeleportGovernors();
  const { entity, player, state } = baseFixture();
  const first = canTeleportStalker({
    entity,
    player,
    state,
    phase: "observe",
    currentTick: 1000,
    fromLocation: entity.location,
    toLocation: { x: 60, y: 64, z: 0 },
    patternKey: "rear:40",
    physicallyValid: true,
  });
  assert.equal(first.allowed, true);
  recordStalkerTeleport({
    entity,
    player,
    state,
    phase: "observe",
    currentTick: 1000,
    allowed: true,
    patternKey: "rear:40",
  });

  resetStalkerTeleportBudget(entity, "new-encounter");
  state.phaseChangedTick = 2000;
  const second = canTeleportStalker({
    entity,
    player,
    state,
    phase: "observe",
    currentTick: 2000,
    fromLocation: { x: 60, y: 64, z: 0 },
    toLocation: { x: 140, y: 64, z: 0 },
    patternKey: "rear:40",
    physicallyValid: true,
  });
  assert.equal(second.allowed, false);
  assert.equal(second.reason, "repeated_pattern");
});

test("search phase permits two spaced hidden repositions but blocks a third", () => {
  clearStalkerTeleportGovernors();
  const { entity, player, state } = baseFixture();
  state.phase = "search";
  state.phaseChangedTick = 100;

  for (const [index, tick] of [1000, 1300].entries()) {
    const result = canTeleportStalker({
      entity,
      player,
      state,
      phase: "search",
      currentTick: tick,
      fromLocation: { x: index * 10, y: 64, z: 0 },
      toLocation: { x: 55 - index * 8, y: 64, z: 16 + index * 10 },
      patternKey: `search-${index}`,
      physicallyValid: true,
    });
    assert.equal(result.allowed, true);
    recordStalkerTeleport({
      entity,
      player,
      state,
      phase: "search",
      currentTick: tick,
      allowed: true,
      patternKey: `search-${index}`,
    });
  }

  const third = canTeleportStalker({
    entity,
    player,
    state,
    phase: "search",
    currentTick: 1600,
    fromLocation: { x: 10, y: 64, z: 0 },
    toLocation: { x: 45, y: 64, z: -24 },
    patternKey: "search-2",
    physicallyValid: true,
  });
  assert.equal(third.allowed, false);
  assert.equal(third.reason, "budget");
});

test("governor derives and reuses an implicit reposition pattern key", () => {
  clearStalkerTeleportGovernors();
  const { entity, player, state } = baseFixture();
  const first = canTeleportStalker({
    entity,
    player,
    state,
    phase: "observe",
    reason: "scheduled-observe",
    currentTick: 1000,
    fromLocation: entity.location,
    toLocation: { x: 60, y: 64, z: 0 },
    physicallyValid: true,
  });
  assert.equal(first.allowed, true);
  assert.ok(first.patternKey);
  recordStalkerTeleport({
    entity,
    player,
    state,
    phase: "observe",
    currentTick: 1000,
    allowed: true,
    patternKey: first.patternKey,
  });

  resetStalkerTeleportBudget(entity, "new-encounter");
  state.phaseChangedTick = 2000;
  const second = canTeleportStalker({
    entity,
    player,
    state,
    phase: "observe",
    reason: "scheduled-observe",
    currentTick: 2000,
    fromLocation: { x: 60, y: 64, z: 0 },
    toLocation: { x: 140, y: 64, z: 0 },
    physicallyValid: true,
  });
  assert.equal(second.allowed, false);
  assert.equal(second.reason, "repeated_pattern");
});
