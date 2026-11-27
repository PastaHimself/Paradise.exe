import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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
  isLegalTreadRow,
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
  assert.equal(isLegalTreadRow(-28), true);
  assert.equal(isLegalTreadRow(-29), false);
  assert.equal(isLegalTreadRow(256), false);
});

test("both walk columns share the same tread row", () => {
  assert.deepEqual([...TREAD_COLUMN_OFFSETS], [0, -1]);
  assert.equal(WALL_OFFSET, -3);
  assert.equal(GUARD_OFFSET, 1);
  assert.equal(LANDING_INNER_OFFSET, -3);
  assert.equal(LANDING_OUTER_OFFSET, -5);
  assert.equal(LANDING_GUARD_OFFSET, -6);
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

test("regular and chipped treads use the schema-valid ascending two-box collision profile", () => {
  const expectedCollisionBoxes = [
    { origin: [-8, 0, -8], size: [16, 8, 16] },
    { origin: [-8, 8, 0], size: [16, 8, 8] },
  ];
  for (const file of [
    "paradise__es_stair_tread.json",
    "paradise__es_chipped_stair_tread_geometry.json",
  ]) {
    const path = new URL(`../addon/BP/blocks/${file}`, import.meta.url);
    const block = JSON.parse(readFileSync(path, "utf8"));
    assert.deepEqual(
      block["minecraft:block"].components["minecraft:collision_box"],
      expectedCollisionBoxes,
      file,
    );
  }
});

test("wall backing stays at L-3 except for open landing access", () => {
  for (let z = 0; z <= 255; z++) {
    const wall = wallPlacements(LANE, z);
    assert.ok(wall.length > 0);
    assert.ok(wall.every((entry) => entry.x === LANE - 3 && entry.block === STAIR_DECOR.crackedConcrete));
    if (z % 12 <= 1) assert.equal(wall.length, 1);
  }
});

test("primary guard never opens at stations and posts repeat every four rows", () => {
  for (let z = 0; z < 254; z++) {
    const guard = scenePlacements(LANE, z).filter((entry) => entry.role === "guard");
    assert.equal(guard.length, 2);
    assert.ok(guard.every((entry) => entry.x === LANE + 1));
    assert.equal(guard[0].block, z % 4 === 0 ? STAIR_DECOR.guardPost : STAIR_DECOR.guard);
  }
});

test("western station landings preserve the ascending main route", () => {
  for (let k = 0; k < 21; k++) {
    const t = stationZ(k), y = stationY(k);
    const cells = [...scenePlacements(LANE, t), ...scenePlacements(LANE, t + 1)];
    for (let x = LANE - 5; x <= LANE - 3; x++) {
      for (let dz = 0; dz <= 1; dz++) {
        assert.ok(cells.some((entry) => entry.x === x && entry.y === y && entry.z === t + dz && entry.block === STAIR_DECOR.landingTiles));
      }
    }
    assert.ok(cells.some((entry) => entry.x === LANE - 2 && entry.y === y && entry.z === t && entry.block === STAIR_DECOR.landingTiles));
    assert.ok(cells.some((entry) => entry.x === LANE - 3 && entry.y === y + 2 && entry.z === t + 1 && entry.block === lampBlock(k)));
    if (k < 4) assert.ok(cells.some((entry) => entry.role === "number" && entry.text === String(k + 1).padStart(2, "0")));
  }
});

test("service door selector uses the exact six-station cycle", () => {
  assert.deepEqual(Array.from({ length: 6 }, (_, k) => serviceDoorBlock(k)), [
    STAIR_DECOR.emergencyDoor, null, null, STAIR_DECOR.chainedDoor, null, null,
  ]);
});

test("row-owned placements are unique, bounded, and keep the shaft and both treads open", () => {
  let remoteCount = 0;
  for (let z = 0; z <= 255; z++) {
    const scene = scenePlacements(LANE, z);
    const remote = remotePlacements(LANE, z);
    remoteCount += remote.length;
    const coordinates = new Set();
    for (const entry of [...scene, ...remote]) {
      const key = `${entry.x}:${entry.y}:${entry.z}`;
      assert.ok(!coordinates.has(key), key);
      coordinates.add(key);
      assert.equal(entry.z, z);
      assert.ok(entry.y >= -64 && entry.y <= WORLD_MAX_Y);
      assert.ok(entry.x < LANE - 1 || entry.x > LANE);
      assert.ok(entry.x < LANE + 2 || entry.x > LANE + 7);
    }
    assert.ok(remote.every((entry) => entry.x >= LANE + 8 && entry.x <= LANE + 10));
  }
  assert.ok(remoteCount > 0);
});
