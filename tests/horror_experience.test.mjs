import test from "node:test";
import assert from "node:assert/strict";
import {
  HORROR_PHASE,
  createHorrorExperienceCoordinator,
} from "./paradise_horror_experience.js";

const player = (id) => ({ id });

test("keeps horror phases and cooldowns isolated per player", () => {
  const coordinator = createHorrorExperienceCoordinator({
    serverMajorPeakLimit: 2,
    defaultMinimumQuietTicks: 0,
  });
  const alice = player("alice");
  const bob = player("bob");

  const aliceBeat = coordinator.requestHorrorBeat(alice, {
    source: "watcher",
    family: "watcher_linked",
    currentTick: 10,
    buildupTicks: 20,
    peakTicks: 10,
    reliefTicks: 30,
  });
  const bobBeat = coordinator.requestHorrorBeat(bob, {
    source: "library",
    family: "environmental",
    currentTick: 10,
    buildupTicks: 20,
    peakTicks: 10,
    reliefTicks: 30,
  });

  assert.equal(aliceBeat.allowed, true);
  assert.equal(bobBeat.allowed, true);
  assert.equal(coordinator.getSnapshot(alice, 10).phase, HORROR_PHASE.Buildup);
  assert.equal(coordinator.getSnapshot(bob, 10).phase, HORROR_PHASE.Buildup);
  assert.equal(coordinator.requestHorrorBeat(alice, { source: "second", currentTick: 11 }).allowed, false);
  assert.equal(coordinator.getSnapshot(bob, 11).activeBeat.source, "library");
});

test("moves a beat through peak and relief, then returns to quiet", () => {
  const coordinator = createHorrorExperienceCoordinator({ defaultMinimumQuietTicks: 0 });
  const alice = player("alice");
  const result = coordinator.requestHorrorBeat(alice, {
    source: "watcher",
    currentTick: 100,
    buildupTicks: 5,
    peakTicks: 4,
    reliefTicks: 8,
  });

  assert.equal(result.allowed, true);
  assert.equal(coordinator.getSnapshot(alice, 104).phase, HORROR_PHASE.Buildup);
  assert.equal(coordinator.getSnapshot(alice, 105).phase, HORROR_PHASE.Peak);
  assert.equal(coordinator.getSnapshot(alice, 109).phase, HORROR_PHASE.Relief);
  assert.equal(coordinator.getSnapshot(alice, 117).phase, HORROR_PHASE.Quiet);
});

test("cleans up a player without changing another player's state", () => {
  const coordinator = createHorrorExperienceCoordinator({ defaultMinimumQuietTicks: 0 });
  const alice = player("alice");
  const bob = player("bob");
  coordinator.requestHorrorBeat(alice, { source: "watcher", currentTick: 1 });
  coordinator.requestHorrorBeat(bob, { source: "library", currentTick: 1 });

  assert.equal(coordinator.clearHorrorExperience("alice", "player_left"), true);
  assert.equal(coordinator.getSnapshot(alice, 2).activeBeat, undefined);
  assert.equal(coordinator.getSnapshot(bob, 2).activeBeat.source, "library");
});
