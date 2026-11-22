import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  BRIDGE_ROWS,
  GUARD_OFFSET,
  LANDING_GUARD_OFFSET,
  LANDING_INNER_OFFSET,
  LANDING_OUTER_OFFSET,
  STAIR_DECOR,
  START_Y,
  TREAD_COLUMN_OFFSETS,
  WALL_OFFSET,
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
  wallPlacements,
} from "../addon/BP/scripts/endless_staircase_scene.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const LANE = 2000;

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
  assert.equal(WALL_OFFSET, -2);
  assert.equal(GUARD_OFFSET, 1);
  assert.equal(LANDING_INNER_OFFSET, 2);
  assert.equal(LANDING_OUTER_OFFSET, 3);
  assert.equal(LANDING_GUARD_OFFSET, 3);
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

test("nothing is staged above the world ceiling", () => {
  assert.equal(sceneryFor(255), null);
  assert.equal(sceneryFor(256), null);
  assert.deepEqual(scenePlacements(1000, 256), []);
  assert.deepEqual(remotePlacements(1000, 256), []);
});

test("every emitted decor id exists in the behavior pack", () => {
  const missing = Object.values(STAIR_DECOR).filter((id) => !existsSync(
    path.join(ROOT, "addon/BP/blocks", `paradise__${id.replace("paradise:", "")}.json`),
  ));
  assert.deepEqual(missing, []);
});

test("every row carries solid wall backing behind the walk", () => {
  for (const z of [0, 7, 13, 96, 200]) {
    const wall = wallPlacements(LANE, z);
    assert.equal(wall.length, 3, `wall rows at z=${z}`);
    for (const [index, entry] of wall.entries()) {
      assert.equal(entry.x, LANE + WALL_OFFSET);
      assert.equal(entry.y, stairY(z) + index);
      assert.ok([STAIR_DECOR.crackedConcrete, STAIR_DECOR.dampWall].includes(entry.block));
    }
  }
  const top = wallPlacements(LANE, 255);
  assert.ok(top.length >= 1);
  assert.ok(top.every((entry) => entry.y <= WORLD_MAX_Y));
});

test("the guard line sits at L+1 on ordinary rows and opens at landings", () => {
  for (const z of [7, 13, 155]) {
    const placements = scenePlacements(LANE, z);
    const guard = placements.find((entry) => entry.x === LANE + GUARD_OFFSET && entry.y === stairY(z) + 1);
    assert.equal(guard?.block, STAIR_DECOR.guardSloped, `sloped guard missing at z=${z}`);
  }
  for (const z of [0, 12, 24, 96]) {
    const placements = scenePlacements(LANE, z);
    assert.equal(
      placements.some((entry) => entry.x === LANE + GUARD_OFFSET && entry.z === z && entry.block === STAIR_DECOR.guardPost),
      false,
      `station row ${z} must open onto its landing`,
    );
  }
});

test("guard posts rise above the rail every four rows", () => {
  const placements = scenePlacements(LANE, 8);
  const has = (x, y, block) => placements.some((entry) => entry.x === x && entry.y === y && entry.z === 8 && entry.block === block);
  assert.ok(has(LANE + GUARD_OFFSET, stairY(8) + 1, STAIR_DECOR.guardPost));
  assert.ok(has(LANE + GUARD_OFFSET, stairY(8) + 2, STAIR_DECOR.guardPostTop));
});

test("chipped rows replace the west tread instead of floating a spare", () => {
  const placements = scenePlacements(LANE, 7);
  assert.ok(placements.some((entry) => entry.x === LANE - 1 && entry.y === stairY(7) && entry.block === STAIR_DECOR.chippedTread));
  for (const entry of placements) {
    if (entry.block === STAIR_DECOR.chippedTread) assert.equal(entry.x, LANE - 1);
  }
});

test("each landing is a supported two-by-two platform with an outer guard", () => {
  const lane = 0;
  const z = 24; // k=2, red lamp station
  const placements = scenePlacements(lane, z);
  const has = (x, y, cellZ, block) => placements.some(
    (entry) => entry.x === x && entry.y === y && entry.z === cellZ && entry.block === block,
  );

  for (let x = lane + LANDING_INNER_OFFSET; x <= lane + LANDING_OUTER_OFFSET; x++) {
    for (let dz = 0; dz <= 1; dz++) {
      assert.ok(has(x, stationY(2), stationZ(2) + dz, STAIR_DECOR.landingTiles), `tile ${x}/${dz}`);
    }
  }
  assert.ok(has(lane + WALL_OFFSET, stationY(2) + 2, stationZ(2) + 1, plateBlock(2)));
  assert.ok(has(lane + WALL_OFFSET, stationY(2) + 2, stationZ(2), STAIR_DECOR.lampRed));
  assert.ok(has(lane + LANDING_INNER_OFFSET, stationY(2) + 1, stationZ(2), STAIR_DECOR.stepLight));

  for (let dy = 1; dy <= 2; dy += 1) {
    assert.ok(has(lane + LANDING_OUTER_OFFSET, stationY(2) - dy, stationZ(2) + 1, STAIR_DECOR.supportBeam));
  }
  for (const dz of [0, 1]) {
    assert.ok(has(lane + LANDING_GUARD_OFFSET, stationY(2) + 1, stationZ(2) + dz, STAIR_DECOR.guard));
    assert.ok(has(lane + LANDING_GUARD_OFFSET, stationY(2) + 2, stationZ(2) + dz, STAIR_DECOR.guardTop));
  }
});

test("service doors alternate on the thirds and mount flush to the wall", () => {
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
        assert.equal(entry.x, 500 + WALL_OFFSET, "doors belong in the wall plane");
      }
    }
  }
});

test("no decor is staged in the void east of the guard line", () => {
  assert.deepEqual(remotePlacements(3000, 0), []);
  assert.deepEqual(remotePlacements(3000, 240), []);
  for (let z = 0; z <= 255; z += 1) {
    for (const entry of scenePlacements(3000, z)) {
      assert.ok(entry.x <= 3000 + LANDING_GUARD_OFFSET, `floating piece at x=${entry.x} z=${entry.z}`);
      assert.ok(entry.y >= -64 && entry.y <= WORLD_MAX_Y, `y ${entry.y} out of bounds`);
      if (entry.role === "tread") continue;
      assert.ok(!(entry.x === 3000 || entry.x === 3000 - 1), `walk column blocked at z=${z}`);
    }
  }
});
