import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as layout from "../addon/BP/scripts/library_layout.js";
import { isCross, shelfStateFor } from "../addon/BP/scripts/library_decor_model.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ARRIVAL = [62, 0];
const RESTRICTED = [63, 0];
const READING = [62, -1];
const WEST = [61, 0];
const PLAIN = [40, 7];

describe("Library room assignments and protected volumes", () => {
  it("derives all four roles from the 1000-block visit grid", () => {
    for (const [visit, arrivalX] of [[0, 0], [1, 62], [2, 125], [3, 187]]) {
      assert.equal(layout.isArrivalChunk(arrivalX, 0), true, `visit ${visit}`);
      assert.equal(layout.isReadingRoom(arrivalX, -1), true);
      assert.equal(layout.isRestrictedRoom(arrivalX + 1, 0), true);
      assert.equal(layout.isWestRoom(arrivalX - 1, 0), true);
      assert.equal(layout.isArrivalChunk(arrivalX, 1), false);
    }
    assert.equal(layout.isArrivalChunk(...PLAIN), false);
    assert.equal(layout.isArrivalChunk(63, 0), false);
  });

  it("reserves the archive volume in the east room only", () => {
    assert.deepEqual(layout.ALCOVE, { minX: 10, maxX: 13, minY: 65, maxY: 68, minZ: 12, maxZ: 14 });
    assert.equal(layout.isAlcoveCell(...RESTRICTED, 10, 65, 12), true);
    assert.equal(layout.isAlcoveCell(...RESTRICTED, 13, 68, 14), true);
    assert.equal(layout.isAlcoveCell(...RESTRICTED, 10, 69, 13), false);
    assert.equal(layout.isAlcoveCell(...ARRIVAL, 10, 65, 12), false);
    assert.equal(layout.isAlcoveCell(...READING, 10, 65, 12), false);
  });

  it("protects all four travel pads, their signs and the spawn buffer at chunk edges", () => {
    for (const [cx, cz, x, z] of [
      [62, 0, 8, 8], [62, -1, 8, 8], [63, 0, 0, 0], [62, 0, 0, 0],
      [62, 0, 8, 0], [62, 0, 11, 2],
    ]) {
      assert.equal(layout.isConnectionReservation(cx, cz, x, 65, z), true, `${cx},${cz}:${x},${z}`);
    }
    assert.equal(layout.isConnectionReservation(63, 0, 0, 64, 0), true);
    assert.equal(layout.isConnectionReservation(62, -1, 8, 65, 10), true);
    assert.equal(layout.isConnectionReservation(63, 0, 0, 68, 0), false);
    assert.equal(layout.isConnectionReservation(63, 0, 8, 65, 4), false);
    assert.equal(layout.isConnectionReservation(...PLAIN, 8, 65, 8), false);
  });

  it("preserves three vanilla bookshelf functional anchors on the arrival chunk", () => {
    assert.deepEqual(layout.PROTECTED_BOOKSHELVES, [[3, 2], [11, 2], [11, 9]]);
    for (const [x, z] of layout.PROTECTED_BOOKSHELVES) {
      assert.equal(layout.isProtectedBookshelf(...ARRIVAL, x, z), true);
      assert.equal(layout.shelfCells(...ARRIVAL, 0).some((cell) => cell.x === x && cell.z === z), false);
      assert.equal(layout.isProtectedBookshelf(...READING, x, z), false);
    }
  });
});

describe("Library corridor and shelf geometry", () => {
  it("keeps the complete two-block public cross and west room's three-block aisle open", () => {
    for (let x = 0; x < 16; x += 1) {
      for (let z = 0; z < 16; z += 1) {
        assert.equal(isCross(x, z), x === 7 || x === 8 || z === 7 || z === 8);
        assert.equal(layout.isWalkLane(x, z, true), isCross(x, z) || (x >= 3 && x <= 5));
      }
    }
    for (const [cx, cz] of [ARRIVAL, RESTRICTED, READING, WEST, PLAIN]) {
      for (const cell of layout.shelfCells(cx, cz, 3)) {
        assert.equal(isCross(cell.x, cell.z), false, JSON.stringify(cell));
        assert.equal(layout.isAlcoveCell(cx, cz, cell.x, cell.tier, cell.z), false);
        assert.equal(layout.isConnectionReservation(cx, cz, cell.x, cell.tier, cell.z), false);
      }
    }
  });

  it("uses x3/x11 and west x2/x6, fixed tiers and z modulo six", () => {
    for (const [cx, cz, allowed] of [
      [...READING, [3, 11]], [...RESTRICTED, [3, 11]], [...PLAIN, [3, 11]], [...WEST, [2, 6]],
    ]) {
      const cells = layout.shelfCells(cx, cz, 1);
      assert.ok(cells.length > 0);
      for (const cell of cells) {
        assert.ok(allowed.includes(cell.x), JSON.stringify(cell));
        assert.ok([65, 67, 69].includes(cell.tier));
        assert.ok((cell.z >= 1 && cell.z <= 6) || (cell.z >= 9 && cell.z <= 14));
        assert.equal(cell.state, shelfStateFor(cell.z));
      }
      assert.equal(cells.some((cell) => cell.tier > 69), false);
    }
    assert.deepEqual([0, 1, 2, 3, 4, 5].map((z) => layout.shelfTierState(3, z, 65)),
      ["full", "full", "sparse", "sparse", "full", "empty"]);
  });

  it("places the fallen shelf only west of arrival, clear of the aisle", () => {
    assert.deepEqual(layout.fallenShelf(...WEST), { x: 1, z: 4, facing: "west" });
    assert.equal(layout.fallenShelf(...ARRIVAL), null);
    assert.equal(layout.fallenShelf(...READING), null);
    assert.equal(layout.isWalkLane(1, 4, true), false);
    assert.equal(layout.isWalkLane(2, 5, true), false);
  });

  it("places the reading and restricted furniture outside the cross and document reserve", () => {
    assert.deepEqual(layout.furniture(...PLAIN, 0), []);
    assert.deepEqual(layout.furniture(...ARRIVAL, 0), []);
    assert.ok(layout.furniture(...READING, 0).some((item) => item.kind === "table" && item.x === 1 && item.z === 10));
    assert.ok(layout.furniture(...RESTRICTED, 0).some((item) => item.kind === "staffDoor" && item.z === 11));
    for (const [cx, cz] of [READING, RESTRICTED]) {
      for (const item of layout.furniture(cx, cz, 0)) {
        assert.equal(isCross(item.x, item.z), false);
        assert.equal(layout.isAlcoveCell(cx, cz, item.x, 65, item.z), false);
      }
    }
  });
});

describe("Library fixture and registry references", () => {
  it("uses fixed pairs at Y72, with alternate lights only in the low-power room", () => {
    assert.deepEqual(layout.aisleLamps(false), [
      { x: 4, z: 4, y: 72, lit: true }, { x: 10, z: 4, y: 72, lit: true },
      { x: 4, z: 11, y: 72, lit: true }, { x: 11, z: 11, y: 72, lit: true },
    ]);
    assert.deepEqual(layout.aisleLamps(true).map((lamp) => lamp.lit), [true, false, true, false]);
  });

  it("positions the static restricted and reading signs without a riddle/card trigger", () => {
    assert.deepEqual(layout.signs(...ARRIVAL), []);
    assert.ok(layout.signs(...READING).some((sign) => sign.kind === "reading"));
    assert.ok(layout.signs(...RESTRICTED).some((sign) => sign.kind === "restricted" && sign.y === 69));
    assert.ok(layout.signs(...RESTRICTED).some((sign) => sign.kind === "exit"));
  });

  it("uses only registered existing block IDs and explicit offsets for split assets", () => {
    const text = readFileSync(path.join(ROOT, "addon/BP/scripts/library_layout.js"), "utf8")
      + readFileSync(path.join(ROOT, "addon/BP/scripts/library_decor.js"), "utf8");
    const ids = [...new Set(text.match(/paradise:[a-z0-9_]+/g) ?? [])];
    assert.ok(ids.length > 30);
    assert.deepEqual(ids.filter((id) => !existsSync(path.join(ROOT, "addon/BP/blocks", `${id.replace(":", "__")}.json`))), []);
    for (const kind of ["carrel", "table", "cart", "ladder", "lockedCabinet", "staffDoor"]) {
      for (const id of layout.furnitureBlock(kind)) assert.match(id, /_x\d+_y\d+_z\d+$/);
    }
    assert.deepEqual(layout.furnitureBlock("ladder"), [
      "paradise:lib_tall_library_ladder_x0_y0_z0",
      "paradise:lib_tall_library_ladder_x0_y1_z0",
    ]);
  });
});
