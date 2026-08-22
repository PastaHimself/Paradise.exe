import test from "node:test";
import assert from "node:assert/strict";
import {
  WATCHER_BEHAVIOR,
  EVIDENCE_KIND,
  createWatcherEvidenceState,
  observeWatcherEvidence,
  tickWatcherEvidence,
  beginWatcherSearch,
  advanceWatcherSearch,
  predictWatcherInterception,
  chooseEvidenceDrivenBehavior,
  hasWatcherAttackEvidence,
  evaluateRepositionFairness,
  computeSightEvidenceStrength,
  approximateWatcherEvidenceLocation,
  getWatcherEvidenceReactionDelayTicks,
} from "../addon/Genshin X Craft BP/scripts/watcher_evidence_model.js";
import {
  ADAPTIVE_TACTIC,
  chooseAdaptiveTactic,
  createAdaptiveProfile,
  recordAdaptiveTactic,
} from "../addon/Genshin X Craft BP/scripts/watcher_adaptive_profile.js";

function location(x, y = 64, z = 0) {
  return { x, y, z };
}

test("suspicion increases from legitimate evidence", () => {
  const state = createWatcherEvidenceState(0);
  observeWatcherEvidence(state, {
    kind: EVIDENCE_KIND.Sound,
    location: location(8, 64, 3),
    strength: 0.55,
  }, 20);
  assert.ok(state.suspicion > 0);
  assert.equal(state.lastKnownPosition.x, 8);
});

test("suspicion decays without evidence", () => {
  const state = createWatcherEvidenceState(0);
  observeWatcherEvidence(state, {
    kind: EVIDENCE_KIND.Sound,
    location: location(4),
    strength: 1,
  }, 0);
  const before = state.suspicion;
  tickWatcherEvidence(state, 20 * 20);
  assert.ok(state.suspicion < before);
});

test("brief visual contact does not create permanent confirmed tracking", () => {
  const state = createWatcherEvidenceState(0);
  observeWatcherEvidence(state, {
    kind: EVIDENCE_KIND.Sight,
    location: location(10),
    strength: 1,
    contactTicks: 5,
  }, 5);
  assert.equal(state.confirmed, false);
  assert.ok(state.suspicion < 90);
  tickWatcherEvidence(state, 20 * 12);
  assert.equal(state.confirmed, false);
});

test("last-known position remains fixed after visual contact is lost", () => {
  const state = createWatcherEvidenceState(0);
  observeWatcherEvidence(state, {
    kind: EVIDENCE_KIND.Sight,
    location: location(12, 64, 5),
    strength: 1,
    contactTicks: 20,
  }, 20);
  const fixed = { ...state.lastKnownPosition };
  tickWatcherEvidence(state, 60, { currentPlayerLocation: location(40, 64, 40) });
  assert.deepEqual(state.lastKnownPosition, fixed);
});

test("sound updates investigation origin without consuming current player position", () => {
  const state = createWatcherEvidenceState(0);
  observeWatcherEvidence(state, {
    kind: EVIDENCE_KIND.Sound,
    location: location(-7, 64, 9),
    strength: 0.8,
  }, 30);
  tickWatcherEvidence(state, 50, { currentPlayerLocation: location(80, 64, 80) });
  assert.deepEqual(state.lastKnownPosition, location(-7, 64, 9));
  assert.notDeepEqual(state.lastKnownPosition, location(80, 64, 80));
});

test("search confidence decreases over time", () => {
  const state = createWatcherEvidenceState(0);
  observeWatcherEvidence(state, {
    kind: EVIDENCE_KIND.Sight,
    location: location(0),
    strength: 1,
    contactTicks: 20,
  }, 20);
  beginWatcherSearch(state, 40);
  const before = state.searchConfidence;
  tickWatcherEvidence(state, 40 + 20 * 10);
  assert.ok(state.searchConfidence < before);
});

test("failed search eventually disengages", () => {
  const state = createWatcherEvidenceState(0);
  observeWatcherEvidence(state, {
    kind: EVIDENCE_KIND.Sound,
    location: location(0),
    strength: 0.7,
  }, 0);
  beginWatcherSearch(state, 20);
  const decision = advanceWatcherSearch(state, 20 * 50, [], () => 0.5);
  assert.equal(decision.behavior, WATCHER_BEHAVIOR.Disengage);
});

test("search avoids immediately repeating the same location", () => {
  const state = createWatcherEvidenceState(0);
  observeWatcherEvidence(state, {
    kind: EVIDENCE_KIND.Sound,
    location: location(0),
    strength: 0.8,
  }, 0);
  beginWatcherSearch(state, 20);
  const first = advanceWatcherSearch(state, 25, [location(3), location(6)], () => 0);
  const second = advanceWatcherSearch(state, 30, [location(3), location(6)], () => 0);
  assert.notDeepEqual(second.target, first.target);
});

test("route prediction can deliberately fail", () => {
  const state = createWatcherEvidenceState(0);
  observeWatcherEvidence(state, {
    kind: EVIDENCE_KIND.Sight,
    location: location(0),
    strength: 1,
    contactTicks: 20,
    movementDirection: { x: 1, z: 0 },
  }, 20);
  const prediction = predictWatcherInterception(state, {
    routeConfidence: 0.8,
    distance: 16,
    failureChance: 0.25,
  }, () => 0.05);
  assert.equal(prediction.success, false);
  assert.equal(prediction.deliberateFailure, true);
});

test("route prediction remains approximate when it succeeds", () => {
  const state = createWatcherEvidenceState(0);
  observeWatcherEvidence(state, {
    kind: EVIDENCE_KIND.Sight,
    location: location(0),
    strength: 1,
    contactTicks: 20,
    movementDirection: { x: 1, z: 0 },
  }, 20);
  const prediction = predictWatcherInterception(state, {
    routeConfidence: 0.8,
    distance: 16,
    failureChance: 0.1,
    uncertainty: 4,
  }, () => 0.8);
  assert.equal(prediction.success, true);
  assert.notEqual(prediction.location.z, 0);
});

test("teleport fairness blocks excessive repeated repositioning", () => {
  const deniedBudget = evaluateRepositionFairness({
    directorPhase: "buildup",
    protectedRelief: false,
    visibleFromPlayer: false,
    strongLineOfSight: false,
    destinationDistance: 40,
    minSafeDistance: 24,
    budgetRemaining: 0,
    patternRepeated: false,
    physicallyValid: true,
  });
  assert.equal(deniedBudget.allowed, false);
  assert.equal(deniedBudget.reason, "budget");

  const deniedPattern = evaluateRepositionFairness({
    directorPhase: "buildup",
    protectedRelief: false,
    visibleFromPlayer: false,
    strongLineOfSight: false,
    destinationDistance: 40,
    minSafeDistance: 24,
    budgetRemaining: 1,
    patternRepeated: true,
    physicallyValid: true,
  });
  assert.equal(deniedPattern.allowed, false);
  assert.equal(deniedPattern.reason, "repeated_pattern");
});

test("relief suppresses aggressive behavior", () => {
  const state = createWatcherEvidenceState(0);
  state.suspicion = 100;
  state.confirmed = true;
  const behavior = chooseEvidenceDrivenBehavior(state, {
    directorPhase: "relief",
    safeRoom: false,
    currentTick: 50,
  });
  assert.equal(behavior, WATCHER_BEHAVIOR.Disengage);
});

test("damaging ambush requires valid fresh evidence", () => {
  const state = createWatcherEvidenceState(0);
  assert.equal(hasWatcherAttackEvidence(state, 10), false);

  observeWatcherEvidence(state, {
    kind: EVIDENCE_KIND.Sound,
    location: location(4),
    strength: 0.9,
  }, 20);
  assert.equal(hasWatcherAttackEvidence(state, 30), true);
  assert.equal(hasWatcherAttackEvidence(state, 20 * 20), false);
});

test("multiplayer evidence state does not leak between players", () => {
  const a = createWatcherEvidenceState(0);
  const b = createWatcherEvidenceState(0);
  observeWatcherEvidence(a, {
    kind: EVIDENCE_KIND.Sound,
    location: location(12),
    strength: 0.8,
  }, 20);
  assert.equal(b.suspicion, 0);
  assert.equal(b.lastKnownPosition, undefined);
});

test("safe-room protection forces disengagement", () => {
  const state = createWatcherEvidenceState(0);
  state.suspicion = 100;
  state.confirmed = true;
  const behavior = chooseEvidenceDrivenBehavior(state, {
    directorPhase: "peak",
    safeRoom: true,
    currentTick: 50,
  });
  assert.equal(behavior, WATCHER_BEHAVIOR.Disengage);
});

test("flashlight evidence is useful but weaker than sustained direct sight", () => {
  const lightState = createWatcherEvidenceState(0);
  observeWatcherEvidence(lightState, {
    kind: EVIDENCE_KIND.Flashlight,
    location: location(5),
    strength: 1,
  }, 20);

  const sightState = createWatcherEvidenceState(0);
  observeWatcherEvidence(sightState, {
    kind: EVIDENCE_KIND.Sight,
    location: location(5),
    strength: 1,
    contactTicks: 20,
  }, 20);

  assert.ok(lightState.suspicion > 0);
  assert.ok(lightState.suspicion < sightState.suspicion);
  assert.equal(lightState.confirmed, false);
});

test("evidence decay is incremental across repeated ticks", () => {
  const state = createWatcherEvidenceState(0);
  observeWatcherEvidence(state, {
    kind: EVIDENCE_KIND.Sound,
    location: location(0),
    strength: 1,
  }, 0);
  tickWatcherEvidence(state, 20 * 5);
  const afterFive = state.suspicion;
  tickWatcherEvidence(state, 20 * 10);
  const afterTen = state.suspicion;
  const firstDrop = 28 - afterFive;
  const secondDrop = afterFive - afterTen;
  assert.ok(Math.abs(firstDrop - secondDrop) < 0.01);
});


test("darkness distance and sneaking reduce sight evidence confidence", () => {
  const clear = computeSightEvidenceStrength({
    distance: 8,
    maxDistance: 96,
    lightLevel: 15,
    sneaking: false,
    obstructed: false,
  });
  const difficult = computeSightEvidenceStrength({
    distance: 72,
    maxDistance: 96,
    lightLevel: 2,
    sneaking: true,
    obstructed: false,
  });
  const blocked = computeSightEvidenceStrength({
    distance: 8,
    maxDistance: 96,
    lightLevel: 15,
    sneaking: false,
    obstructed: true,
  });
  assert.ok(clear > difficult);
  assert.ok(difficult > 0);
  assert.equal(blocked, 0);
});

test("fresh evidence interrupts an old search state", () => {
  const state = createWatcherEvidenceState(0);
  observeWatcherEvidence(state, {
    kind: EVIDENCE_KIND.Sound,
    location: location(0),
    strength: 0.8,
  }, 0);
  beginWatcherSearch(state, 20);
  observeWatcherEvidence(state, {
    kind: EVIDENCE_KIND.Sound,
    location: location(12),
    strength: 0.9,
  }, 40);
  assert.notEqual(state.behavior, WATCHER_BEHAVIOR.Search);
  assert.equal(state.searchStartedTick, -999999);
});


test("adaptive tactics penalize immediate repetition", () => {
  const profile = createAdaptiveProfile(0);
  const first = chooseAdaptiveTactic(profile, { phase: "observe", tick: 100 }, () => 0);
  assert.equal(first, ADAPTIVE_TACTIC.PeripheralWatch);
  recordAdaptiveTactic(profile, first, 100);
  const second = chooseAdaptiveTactic(profile, { phase: "observe", tick: 101 }, () => 0);
  assert.notEqual(second, first);
  assert.equal(second, ADAPTIVE_TACTIC.ShadowPursuit);
});

test("fresh faint sound produces investigation without instant aggression", () => {
  const state = createWatcherEvidenceState(0);
  observeWatcherEvidence(state, {
    kind: EVIDENCE_KIND.Sound,
    location: location(7, 64, -3),
    strength: 0.25,
  }, 20);
  const behavior = chooseEvidenceDrivenBehavior(state, {
    directorPhase: "buildup",
    safeRoom: false,
    currentTick: 21,
  });
  assert.equal(behavior, WATCHER_BEHAVIOR.Investigate);
  assert.ok(state.suspicion < 45);
  assert.equal(state.confirmed, false);
});

test("route hints are snapshotted with evidence and cannot follow later Director updates", () => {
  const state = createWatcherEvidenceState(0);
  const hints = [location(4, 64, 4), location(8, 64, 8)];
  observeWatcherEvidence(state, {
    kind: EVIDENCE_KIND.Sound,
    location: location(2, 64, 2),
    strength: 0.7,
    routeHints: hints,
  }, 20);
  hints[0].x = 99;
  hints.push(location(100, 64, 100));
  assert.deepEqual(state.routeHints, [location(4, 64, 4), location(8, 64, 8)]);
  tickWatcherEvidence(state, 80, { directorRouteHints: [location(200, 64, 200)] });
  assert.deepEqual(state.routeHints, [location(4, 64, 4), location(8, 64, 8)]);
});


test("approximate evidence locations are uncertain but bounded", () => {
  const source = location(10, 64, 20);
  const approximate = approximateWatcherEvidenceLocation(source, 4, () => 0.75);
  assert.notDeepEqual(approximate, source);
  assert.ok(Math.hypot(approximate.x - source.x, approximate.z - source.z) <= 4.0001);
  assert.equal(approximate.y, source.y);
});


test("strong sound evidence receives a shorter bounded reaction delay", () => {
  const weak = getWatcherEvidenceReactionDelayTicks(EVIDENCE_KIND.Sound, 0.2, () => 0.5);
  const strong = getWatcherEvidenceReactionDelayTicks(EVIDENCE_KIND.Sound, 1, () => 0.5);
  const flashlight = getWatcherEvidenceReactionDelayTicks(EVIDENCE_KIND.Flashlight, 0.5, () => 0.5);
  assert.ok(strong < weak);
  assert.ok(strong >= 20 && strong <= 80);
  assert.ok(weak >= 20 && weak <= 100);
  assert.ok(flashlight >= strong);
});
