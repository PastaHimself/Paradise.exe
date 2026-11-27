import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DAIS_RESERVE,
  EXIT_FRAMES,
  FLOOR_Y,
  PIECE_SEGMENTS,
  POOL,
  REST,
  isDaisReserved,
  exitFrames,
  poolEdging,
  poolPlanters,
  restStationPlan,
  restStations,
  visitLandmarks,
  visitReservations,
  coveredChunks,
  rectanglesIntersect,
  segmentsFor,
} from "../addon/BP/scripts/heaven_scene.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test("the fixed rest displays are twenty blocks west and ten blocks apart", () => {
  const stations = restStations(100, 50);
  assert.deepEqual(stations.map((s) => [s.id, s.offsetX]), [["clean", -20], ["disturbed", -20]]);
  assert.deepEqual(stations.map(s => s.z), [52, 62]);
  assert.notEqual(REST.clean.bench, REST.disturbed.bench);
  assert.notEqual(REST.clean.sign, REST.disturbed.sign);
});

test("each rest station keeps the approach and bed/chest slots", () => {
  const plan = restStationPlan(10, 20, REST.clean);
  const bench = plan.find((p) => p.block === REST.clean.bench);
  const chest = plan.find((p) => p.block === REST.clean.chest);
  const sign = plan.find((p) => p.block === REST.clean.sign);
  assert.equal(bench.y, FLOOR_Y + 1);
  assert.equal(chest.y, FLOOR_Y + 1);
  assert.equal(sign.z, 25);
  for (const entry of plan) assert.ok(entry.y >= FLOOR_Y && entry.y <= FLOOR_Y + 3);
});

test("the disturbed twin adds footprints but no extra furniture", () => {
  const clean = restStationPlan(10, 20, REST.clean, false);
  const disturbed = restStationPlan(10, 20, REST.disturbed, true);
  assert.ok(disturbed.length > clean.length);
  assert.ok(disturbed.some((p) => p.block === REST.disturbed.footprints));
  assert.ok(!clean.some((p) => p.block === REST.disturbed.footprints));
});

test("pool edging keeps the north pedestrian opening and wraps the rim", () => {
  const cells = poolEdging(0, 0, 12);
  assert.equal(cells.length, 42);
  assert.equal(new Set(cells.map((c) => `${c.x}:${c.z}`)).size, 42);
  for (const cell of cells) {
    assert.ok(cell.x === 0 || cell.x === 11 || cell.z === 0 || cell.z === 11);
    assert.equal(cell.y, FLOOR_Y + 1);
  }
  assert.ok(!cells.some((c) => c.z === 0 && (c.x === 5 || c.x === 6)));
  assert.equal(poolPlanters(0, 0).length, 4);
});

test("the temple dais stays reserved and empty", () => {
  assert.deepEqual({ ...DAIS_RESERVE }, { minX: 10, maxX: 13, minY: 3, maxY: 6, minZ: 10, maxZ: 13 });
  for (const x of [10, 11, 12, 13]) {
    for (const y of [3, 4, 5, 6]) {
      for (const z of [10, 11, 12, 13]) {
        assert.equal(isDaisReserved(x, y, z), true);
      }
    }
  }
  assert.equal(isDaisReserved(9, 4, 11), false);
  assert.equal(isDaisReserved(11, 7, 11), false);
});

test("exit frames are anchored in the temple", () => {
  const frames = exitFrames(100, 60);
  assert.deepEqual(frames.map((f) => f.x), [103, 110]);
  assert.equal(frames[0].block, EXIT_FRAMES.open);
  assert.equal(frames[1].block, EXIT_FRAMES.final);
  assert.ok(EXIT_FRAMES.open !== EXIT_FRAMES.final);
});

test("every rest, pool and exit piece resolves to existing block ids", () => {
  const ids = new Set();
  for (const station of Object.values(REST)) for (const id of Object.values(station)) ids.add(id);
  for (const id of Object.values(POOL)) ids.add(id);
  for (const id of Object.values(EXIT_FRAMES)) ids.add(id);
  for (const segments of Object.values(PIECE_SEGMENTS)) for (const [, , , id] of segments) ids.add(id);
  const missing = [...ids].filter((id) => !existsSync(
    path.join(ROOT, "addon/BP/blocks", `paradise__${id.replace("paradise:", "")}.json`),
  ));
  assert.deepEqual(missing, []);
});

test("multi-cell rest pieces expand to their full segment set", () => {
  assert.equal(segmentsFor(REST.clean.bench).length, 2);
  assert.equal(segmentsFor(REST.clean.sign).length, 4);
  assert.equal(segmentsFor(REST.disturbed.sign).length, 4);
  assert.equal(segmentsFor(EXIT_FRAMES.open).length, 4);
  assert.equal(segmentsFor(POOL.planter).length, 5);
  assert.deepEqual(segmentsFor(REST.clean.table), [[0, 0, 0, REST.clean.table]]);
});

test("the altar dais stays reserved at [10..13,3..6,10..13]", () => {
  assert.equal(isDaisReserved(10, 3, 10), true);
  assert.equal(isDaisReserved(13, 6, 13), true);
  assert.equal(isDaisReserved(9, 3, 10), false);
  assert.equal(isDaisReserved(10, 7, 10), false);
  assert.equal(isDaisReserved(10, 3, 14), false);
});

test("fixed scene reservations cover actual chunks without demanding new generation", () => {
  const [clean, disturbed, pool, temple] = visitLandmarks(1000);
  assert.deepEqual([clean.x, clean.z, disturbed.x, disturbed.z], [980, 2, 980, 12]);
  assert.deepEqual([pool.x + 2, pool.z + 3, temple.x, temple.z], [992, 22, 1016, 16]);
  assert.ok(coveredChunks(temple).length > 1);
  assert.ok(visitReservations(1000).some(rect => rectanglesIntersect(rect, { x: 1000, z: 5, width: 1, depth: 1 })));
  assert.ok(visitReservations(1000).some(rect => rectanglesIntersect(rect, { x: 1009, z: 10, width: 1, depth: 1 })));
  assert.ok(!visitReservations(1000).some(rect => rectanglesIntersect(rect, { x: 1060, z: 60, width: 1, depth: 1 })));
  assert.ok(!rectanglesIntersect(clean, disturbed));
});
