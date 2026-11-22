import test from "node:test";
import assert from "node:assert/strict";

import {
  BRIDGE_ROWS,
  STAIR_DECOR,
  START_Y,
  TREAD_COLUMN_OFFSETS,
  WORLD_MAX_Y,
  isBridgeRow,
  isChippedRow,
  isLegalRow,
  lampBlock,
  lampLight,
  plateBlock,
  remotePlacements,
  scenePlacements,
  sceneryFor,
  serviceDoorBlock,
  signBlock,
  stairY,
  stationIndex,
  stationY,
  stationZ,
} from "../addon/BP/scripts/endless_staircase_scene.js";

test("the stair rises one block per row and stops at the world ceiling", () => {
  assert.equal(stairY(0), START_Y);
  assert.equal(stairY(12), START_Y + 12);
  assert.equal(isLegalRow(255), true);
  assert.equal(stairY(255), WORLD_MAX_Y);
  assert.equal(isLegalRow(256), false);
  assert.equal(isLegalRow(-1), false);
  assert.equal(isLegalRow(Number.NaN), false);
});

test("both walk columns share the same tread row", () => {
  assert.deepEqual([...TREAD_COLUMN_OFFSETS], [0, -1]);
  for (const z of [0, 12, 96, 200]) {
    assert.equal(stairY(z), START_Y + z);
  }
});

test("station maths keeps the 12-step rhythm", () => {
  assert.equal(stationIndex(0), 0);
  assert.equal(stationIndex(11), 0);
  assert.equal(stationIndex(12), 1);
  assert.equal(stationZ(3), 36);
  assert.equal(stationY(3), START_Y + 36);
  assert.equal(isChippedRow(7), true);
  assert.equal(isChippedRow(11), false);
  assert.equal(isChippedRow(18), true);
});

test("lamp states follow the k mod 4 cycle with matching emissions", () => {
  const expected = [
    [STAIR_DECOR.lampNormal, 11],
    [STAIR_DECOR.lampNormal, 11],
    [STAIR_DECOR.lampRed, 7],
    [STAIR_DECOR.lampDead, 0],
    [STAIR_DECOR.lampNormal, 11],
  ];
  expected.forEach(([block, light], k) => {
    assert.equal(lampBlock(k), block, `block at k=${k}`);
    assert.equal(lampLight(k), light, `light at k=${k}`);
  });
});

test("landing plates progress through numbered, peeling, blank and repeated", () => {
  assert.equal(plateBlock(0), STAIR_DECOR.landingPlate);
  assert.equal(plateBlock(3), STAIR_DECOR.landingPlate);
  assert.equal(plateBlock(4), STAIR_DECOR.landingPlatePeeling);
  assert.equal(plateBlock(7), STAIR_DECOR.landingPlatePeeling);
  assert.equal(plateBlock(8), STAIR_DECOR.landingPlateBlank);
  assert.equal(plateBlock(11), STAIR_DECOR.landingPlateBlank);
  assert.equal(plateBlock(12), STAIR_DECOR.landingPlateRepeated);
  assert.equal(plateBlock(31), STAIR_DECOR.landingPlateRepeated);
});

test("direction signs cycle forward, down and right", () => {
  assert.equal(signBlock(0), STAIR_DECOR.signForward);
  assert.equal(signBlock(1), STAIR_DECOR.signDown);
  assert.equal(signBlock(2), STAIR_DECOR.signRight);
  assert.equal(signBlock(3), STAIR_DECOR.signForward);
});

test("the bridge is staged only at rows 96 and 192", () => {
  assert.deepEqual([...BRIDGE_ROWS], [96, 192]);
  assert.equal(isBridgeRow(96), true);
  assert.equal(isBridgeRow(192), true);
  assert.equal(isBridgeRow(288), false, "the old 24-step interval row must not place");
  assert.equal(sceneryFor(96), "bridge");
  assert.equal(sceneryFor(192), "bridge");
  assert.equal(sceneryFor(288), null);
  assert.equal(sceneryFor(240), "buttress");
  assert.equal(sceneryFor(48), "landing");
});

test("scenery never schedules above the world ceiling", () => {
  assert.equal(sceneryFor(252), "support");
  assert.equal(sceneryFor(255), null);
  assert.equal(sceneryFor(256), null);
  assert.deepEqual(scenePlacements(1000, 256), []);
  assert.deepEqual(remotePlacements(1000, 256), []);
});

test("scene placements keep the walk columns clear and the guard mounted", () => {
  const lane = 2000;
  for (const z of [0, 7, 12, 96, 155, 255]) {
    const placements = scenePlacements(lane, z);
    for (const entry of placements) {
      assert.ok(!(entry.x === lane || entry.x === lane - 1), `walk column blocked at z=${z} x=${entry.x}`);
      assert.ok(entry.y >= -64 && entry.y <= WORLD_MAX_Y, `y ${entry.y} out of bounds at z=${z}`);
    }
    const guard = placements.find((entry) => entry.z === z && entry.x === lane + 1 && entry.y === stairY(z));
    assert.equal(guard?.block, STAIR_DECOR.guard, `guard missing at z=${z}`);
  }
});

test("each landing builds tiles, a plate, a lamp and a step light", () => {
  const lane = 0;
  const placements = scenePlacements(lane, 24); // k=2, red lamp station
  const has = (x, y, z, block) => placements.some((e) => e.x === x && e.y === y && e.z === z && e.block === block);

  for (let x = lane - 5; x <= lane - 3; x++) {
    for (let dz = 0; dz <= 1; dz++) {
      assert.ok(has(x, stationY(2), stationZ(2) + dz, STAIR_DECOR.landingTiles), `tile ${x}/${dz}`);
    }
  }
  assert.ok(has(lane - 5, stationY(2) + 2, stationZ(2) + 1, plateBlock(2)));
  assert.ok(has(lane - 3, stationY(2) + 2, stationZ(2) + 1, STAIR_DECOR.lampRed));
  assert.ok(has(lane + 1, stationY(2), stationZ(2) - 1, STAIR_DECOR.stepLight));
});

test("service doors alternate on the thirds and hatches stay off the walk", () => {
  const doors = [];
  for (let k = 0; k < 12; k++) {
    const door = serviceDoorBlock(k);
    if (door) doors.push(door);
  }
  assert.ok(doors.length >= 4);
  assert.ok(doors.includes(STAIR_DECOR.chainedDoor));
  assert.ok(doors.includes(STAIR_DECOR.emergencyDoor));

  for (let z = 0; z <= 120; z += 12) {
    for (const entry of scenePlacements(500, z)) {
      if (entry.block === STAIR_DECOR.chainedDoor || entry.block === STAIR_DECOR.emergencyDoor) {
        assert.ok(entry.x <= 500 - 3, "doors belong behind the walk");
      }
    }
  }
});

test("remote ledge decor stays east of the shaft", () => {
  const lane = 3000;
  for (let z = 0; z <= 240; z += 7) {
    for (const entry of remotePlacements(lane, z)) {
      assert.ok(entry.x >= lane + 8, `remote decor at x=${entry.x}`);
      assert.ok(entry.y <= WORLD_MAX_Y);
    }
  }
});
