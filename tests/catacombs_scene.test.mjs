import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DRESS,
  PIECE_SEGMENTS,
  SIDE_ORDER,
  archFor,
  burialFor,
  candleFor,
  cellRoll,
  floorBlock,
  lampFor,
  sealedDoorwayPlan,
  segmentsFor,
  selectJunction,
  junctionCandidates,
  rotatePiece,
  sideInset,
  wallBlock,
  wallRunOffsets,
} from "../addon/BP/scripts/catacombs_scene.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test("wall surfaces follow the 76/14/10 split", () => {
  const counts = { clean: 0, cracked: 0, damp: 0 };
  for (let x = 0; x < 60; x++) {
    for (let z = 0; z < 60; z++) {
      const block = wallBlock(x, z);
      if (block === DRESS.wallClean) counts.clean += 1;
      else if (block === DRESS.wallCracked) counts.cracked += 1;
      else if (block === DRESS.wallDamp) counts.damp += 1;
      else assert.fail(`unexpected wall ${block}`);
    }
  }
  const total = counts.clean + counts.cracked + counts.damp;
  assert.ok(counts.clean / total > 0.7 && counts.clean / total < 0.82, "clean near 76%");
  assert.ok(counts.cracked / total > 0.1 && counts.cracked / total < 0.18, "cracked near 14%");
  assert.ok(counts.damp / total > 0.06 && counts.damp / total < 0.14, "damp near 10%");
});

test("floors use uneven tiles 12%, puddles 4% and base 84%", () => {
  let base = 0;
  let uneven = 0;
  let puddle = 0;
  for (let x = 0; x < 80; x++) {
    for (let z = 0; z < 80; z++) {
      const block = floorBlock(x, z);
      if (block === DRESS.floorBase) base += 1;
      else if (block === DRESS.floorDamp) uneven += 1;
      else if (block === DRESS.puddle) puddle += 1;
      else assert.fail(`unexpected floor ${block}`);
    }
  }
  const total = base + uneven + puddle;
  assert.ok(base / total > 0.8);
  assert.ok(uneven / total > 0.08 && uneven / total < 0.16);
  assert.ok(puddle / total > 0.02 && puddle / total < 0.07);
});

test("light slots cycle lit, unlit, sconce and cage", () => {
  assert.deepEqual(lampFor(0), { block: DRESS.candleLit, light: 9 });
  assert.deepEqual(lampFor(1), { block: DRESS.candleOut, light: 0 });
  assert.deepEqual(lampFor(2), { block: DRESS.lampSconce, light: 10 });
  assert.deepEqual(lampFor(3), { block: DRESS.lampLit, light: 8 });
  assert.deepEqual(lampFor(4), lampFor(0));
  assert.equal(candleFor(10), DRESS.candleLit);
  assert.equal(candleFor(90), DRESS.candleOut);
});

test("burial objects are drawn from the allowed set", () => {
  const seen = new Set();
  for (let roll = 0; roll < 100; roll++) seen.add(burialFor(roll));
  assert.ok(seen.size >= 5);
  assert.ok(!seen.has("minecraft:air"));
});

test("arches only occupy the overhead band", () => {
  assert.equal(archFor(0), DRESS.arch);
  assert.equal(archFor(2), DRESS.lowArch);
  assert.equal(archFor(1), null);
});

test("junction selection prefers corridors after index 6 and never the ends", () => {
  const cells = [];
  for (let i = 0; i < 20; i++) {
    cells.push({
      x: i % 4,
      z: Math.floor(i / 4),
      role: "corridor",
      pathIndex: i,
      closedSides: i === 8 ? ["south", "north"] : ["north"],
      degree: i === 8 ? 3 : 1,
    });
  }
  const choice = selectJunction(cells, 20);
  assert.equal(choice?.cell.pathIndex, 8);
  assert.equal(choice?.side, "south");

  assert.equal(selectJunction(cells, 16)?.cell.pathIndex, 8);
  assert.equal(selectJunction(cells, 12), null, "the last six path cells stay clear");
  assert.equal(selectJunction([], 20), null);

  const excluded = new Set(["0:2"]);
  assert.notEqual(selectJunction(cells, 20, excluded)?.cell.pathIndex, 8, "excluded hosts are skipped");
});

test("sealed doorway reserves both wall layers and keeps the approach clear", () => {
  const base = { x: 100, z: 200 };
  for (const side of SIDE_ORDER) {
    const plan = sealedDoorwayPlan(base, side);
    assert.equal(plan.plane.length, 3);
    for (const point of plan.plane) assert.ok(point.y >= 65 && point.y <= 67);
    assert.equal(plan.clue.y, 66);
    assert.equal(plan.sconce.y, 67);
    assert.equal(plan.warning.y, 67);
    assert.deepEqual(plan.approach.map((p) => p.y), [65, 65]);
    for (const point of plan.flatFloor) assert.equal(point.y, 64);
    assert.equal(plan.futureOpening.length, 6);
    assert.equal(plan.adjacentReserve.length, 6);
    // The approach sits on the room side of the wall plane.
    const inset = sideInset(side, 1);
    const run = wallRunOffsets(side, 1);
    assert.deepEqual(plan.approach[0], {
      x: base.x + run.dx + inset.dx,
      y: 65,
      z: base.z + run.dz + inset.dz,
    });
  }
});

test("cell hashing is deterministic and bounded", () => {
  assert.equal(cellRoll(4, 9, 7), cellRoll(4, 9, 7));
  assert.notEqual(cellRoll(4, 9, 7), cellRoll(4, 9, 8));
  for (let x = 0; x < 16; x++) {
    for (let z = 0; z < 16; z++) {
      const roll = cellRoll(x, z);
      assert.ok(roll >= 0 && roll < 100);
    }
  }
});

test("every dress id and staged segment exists in the behavior pack", () => {
  const ids = new Set();
  for (const value of Object.values(DRESS)) ids.add(value);
  for (const segments of Object.values(PIECE_SEGMENTS)) {
    for (const [, , , id] of segments) ids.add(id);
  }
  const missing = [...ids].filter((id) => !existsSync(
    path.join(ROOT, "addon/BP/blocks", `paradise__${id.replace("paradise:", "")}.json`),
  ));
  assert.deepEqual(missing, []);
});

test("multi-cell pieces expose every segment including the top", () => {
  for (const key of ["arch", "sealedDoorway", "cluePanel", "boneShelf", "passageFrame"]) {
    const segments = segmentsFor(DRESS[key]);
    assert.equal(segments.length, 4, key);
    assert.deepEqual(segments.map(([dx, dy]) => [dx, dy]), [[0, 0], [0, 1], [1, 0], [1, 1]], key);
    assert.equal(segments[0][3], DRESS[key]);
  }
  for (const key of ["lampLit", "lampOut", "lampRusted", "lampSconce", "cornerPier", "pillar"]) {
    assert.equal(segmentsFor(DRESS[key]).length, 2, key);
  }
  assert.deepEqual(segmentsFor(DRESS.niche), [[0, 0, 0, DRESS.niche]]);
});


test("junction path indexing uses coordinates rather than object identity", () => {
  const cells = Array.from({length: 17}, (_, x) => ({
    x, z: 0, role: "corridor", links: new Set(["a", "b"]),
  }));
  const path = cells.map(({x,z}) => ({x,z}));
  const candidates = junctionCandidates(cells, path, () => ["north","south"]);
  const choice = selectJunction(candidates, path.length);
  assert.equal(choice.cell.pathIndex, 6);
  assert.equal(choice.side, "south", "outer north wall is not an internal future shortcut");
});

test("junction fallback chooses an internal off-path corridor, never a functional room", () => {
  const cells = [
    { x: 0, z: 0, role: "corridor", degree: 2, pathIndex: -1, closedSides: ["north", "west"] },
    { x: 2, z: 1, role: "loot", degree: 2, pathIndex: -1, closedSides: ["south"] },
    { x: 3, z: 2, role: "corridor", degree: 2, pathIndex: -1, closedSides: ["east"] },
  ];
  assert.equal(selectJunction(cells, 12).cell.x, 3);
});

test("all four wall orientations rotate every segment within its original wall plane", () => {
  for (const side of SIDE_ORDER) {
    const parts = rotatePiece(DRESS.sealedDoorway, side);
    assert.equal(parts.length, 4);
    assert.equal(new Set(parts.map(p => `${p.x}:${p.y}:${p.z}`)).size, 4);
    assert.ok(parts.every(p => p.x >= 0 && p.x <= 1 && p.z >= 0 && p.z <= 1));
    assert.ok(parts.every(p => side === "north" || side === "south" ? p.z === 0 : p.x === 0));
  }
});
