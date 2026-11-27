import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const dimensionPlanUrl = new URL("../addon/BP/scripts/paradise_dimension_plan.js", import.meta.url);
const dimensionPlan = readFileSync(dimensionPlanUrl, "utf8");

function extractFunction(name) {
  const start = dimensionPlan.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist in the movement implementation`);
  const end = dimensionPlan.indexOf("\n}\n", start);
  assert.notEqual(end, -1, `${name} must have a complete function body`);
  return dimensionPlan.slice(start, end + 2);
}

const movementContext = {
  horizontalDistance(left, right) {
    return Math.hypot(left.x - right.x, left.z - right.z);
  },
};

vm.runInNewContext(
  [
    extractFunction("resetMovementSamples"),
    extractFunction("sampleMovement"),
    extractFunction("isMovementSampleCurrent"),
    extractFunction("shouldEnterStaircaseFromFall"),
    "globalThis.movement = { resetMovementSamples, sampleMovement, isMovementSampleCurrent, shouldEnterStaircaseFromFall };",
  ].join("\n\n"),
  movementContext,
);

const {
  resetMovementSamples,
  sampleMovement,
  isMovementSampleCurrent,
  shouldEnterStaircaseFromFall,
} = movementContext.movement;

test("cross-dimension Y drops establish a new baseline and cannot trigger the Staircase", () => {
  const state = {
    lastDimensionId: undefined,
    lastLocation: undefined,
    lastMoveTick: 0,
    highestRecentY: undefined,
    fireRunTicks: 8,
    endlessFastClimbTicks: 5,
    endlessQuietTicks: 4,
    endlessBrightTicks: 3,
  };

  const overworldSample = sampleMovement(
    state,
    "minecraft:overworld",
    { x: 7.5, y: 77, z: 7.5 },
    321939,
  );
  assert.equal(overworldSample.dy, 0);
  assert.equal(shouldEnterStaircaseFromFall(state, { x: 7.5, y: 77, z: 7.5 }, overworldSample.dy), false);

  resetMovementSamples(
    state,
    "catacombs:catacomb_mazes",
    { x: 7.5, y: 65, z: 7.5 },
    321944,
  );
  assert.equal(state.lastLocation.y, 65, "the dimension-change event baselines the destination coordinate");
  assert.equal(state.highestRecentY, 65, "the fall-height baseline also starts in the destination dimension");
  assert.equal(state.fireRunTicks, 0);
  assert.equal(state.endlessFastClimbTicks, 0);
  assert.equal(state.endlessQuietTicks, 0);
  assert.equal(state.endlessBrightTicks, 0);

  const catacombsSample = sampleMovement(
    state,
    "catacombs:catacomb_mazes",
    { x: 7.5, y: 65, z: 7.5 },
    321944,
  );
  assert.equal(catacombsSample.dy, 0);
  assert.equal(shouldEnterStaircaseFromFall(state, { x: 7.5, y: 65, z: 7.5 }, catacombsSample.dy), false);

  const staircaseSample = sampleMovement(
    state,
    "paradise:endless_staircase",
    { x: 7.5, y: 65, z: 7.5 },
    321954,
  );
  assert.equal(staircaseSample.dy, 0, "the next dimension transition also starts from a clean sample");
  assert.equal(shouldEnterStaircaseFromFall(state, { x: 7.5, y: 65, z: 7.5 }, staircaseSample.dy), false);

  const staleState = {
    lastDimensionId: "minecraft:overworld",
    lastLocation: { x: 7.5, y: 77, z: 7.5 },
    lastMoveTick: 321939,
    highestRecentY: 77,
  };
  const staleOverworldSample = sampleMovement(
    staleState,
    "minecraft:overworld",
    { x: 7.5, y: 65, z: 7.5 },
    321944,
  );
  assert.equal(staleOverworldSample.dy, -12);
  assert.equal(
    shouldEnterStaircaseFromFall(staleState, { x: 7.5, y: 65, z: 7.5 }, staleOverworldSample.dy),
    true,
    "the stale pre-event sample reproduces the original false fall decision",
  );
  resetMovementSamples(
    staleState,
    "catacombs:catacomb_mazes",
    { x: 7.5, y: 65, z: 7.5 },
    321944,
  );
  assert.equal(
    isMovementSampleCurrent(staleState, "minecraft:overworld", "minecraft:overworld"),
    false,
    "the queued Overworld fall is invalidated even if the player handle still reports the old dimension",
  );

  assert.match(
    dimensionPlan,
    /if \(fromId && toId && fromId !== toId\) \{\s*const destination = event\.toLocation \? copyLocation\(event\.toLocation\) : undefined;\s*resetMovementSamples\(getMistakeState\(playerId\), toId, destination, currentTick\(\)\);/,
    "the dimension-change event must baseline movement from its destination location",
  );
  assert.match(dimensionPlan, /sampleMovement\(state, dimensionId, location, tick\)/);
  assert.match(
    dimensionPlan,
    /if \(!isMovementSampleCurrent\(state, fallDimensionId, dimensionIdOf\(player\)\)\) return;/,
    "a deferred fall route must be cancelled if the player changes dimensions after sampling",
  );
});

test("a 12-block fall within the same dimension still triggers the Staircase", () => {
  const state = {
    lastDimensionId: undefined,
    lastLocation: undefined,
    lastMoveTick: 0,
    highestRecentY: undefined,
  };

  const start = { x: 4.5, y: 80, z: 4.5 };
  resetMovementSamples(state, "minecraft:overworld", start, 100);

  const landing = { x: 4.5, y: 68, z: 4.5 };
  const fallSample = sampleMovement(state, "minecraft:overworld", landing, 105);
  assert.equal(fallSample.dy, -12);
  assert.equal(shouldEnterStaircaseFromFall(state, landing, fallSample.dy), true);
});
