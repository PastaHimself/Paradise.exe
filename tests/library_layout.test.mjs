import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as layout from "../addon/BP/scripts/library_layout.js";
import { RESTRICTED_RESERVE, isCross } from "../addon/BP/scripts/library_decor_model.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ARRIVAL = [62, 0];
const PLAIN = [40, 7];

const FOOTPRINTS = {
  carrel: [[0, 0], [1, 0], [0, 1], [1, 1]],
  table: [[0, 0], [1, 0]],
  chair: [[0, 0]],
  cart: [[0, 0]],
  ladder: [[0, 0]],
  crate: [[0, 0]],
};

describe("library arrival chunk", () => {
  it("detects the 1000-block visit grid and nothing else", () => {
    assert.equal(layout.isArrivalChunk(...ARRIVAL), true);
    assert.equal(layout.isArrivalChunk(0, 0), true);
    assert.equal(layout.isArrivalChunk(125, 0), true);
    assert.equal(layout.isArrivalChunk(63, 0), false);
    assert.equal(layout.isArrivalChunk(62, 1), false);
  });

  it("reserves exactly the documented restricted bay", () => {
    assert.deepEqual(
      [layout.ALCOVE.minX, layout.ALCOVE.minY, layout.ALCOVE.minZ],
      RESTRICTED_RESERVE.min,
    );
    assert.deepEqual(
      [layout.ALCOVE.maxX, layout.ALCOVE.maxY, layout.ALCOVE.maxZ],
      RESTRICTED_RESERVE.max,
    );
    assert.equal(layout.isAlcoveCell(...ARRIVAL, 10, 65, 12), true);
    assert.equal(layout.isAlcoveCell(...ARRIVAL, 13, 68, 14), true);
    assert.equal(layout.isAlcoveCell(...ARRIVAL, 9, 65, 12), false);
    assert.equal(layout.isAlcoveCell(...PLAIN, 10, 65, 12), false);
  });

  it("protects the three vanilla bookshelf anchors only on arrival", () => {
    for (const [x, z] of layout.PROTECTED_BOOKSHELVES) {
      assert.equal(layout.isProtectedBookshelf(...ARRIVAL, x, z), true);
      assert.equal(layout.isProtectedBookshelf(...PLAIN, x, z), false);
    }
    assert.equal(layout.isProtectedBookshelf(...ARRIVAL, 4, 2), false);
  });
});

describe("library walkability", () => {
  it("keeps the four-lane cross and side aisles as walk lanes", () => {
    for (let i = 0; i < 16; i += 1) {
      assert.equal(layout.isWalkLane(7, i), true);
      assert.equal(layout.isWalkLane(8, i), true);
      assert.equal(layout.isWalkLane(i, 7), true);
      assert.equal(layout.isWalkLane(i, 8), true);
      assert.equal(layout.isWalkLane(2, i), true);
      assert.equal(layout.isWalkLane(3, i), true);
      assert.equal(layout.isWalkLane(12, i), true);
      assert.equal(layout.isWalkLane(13, i), true);
      if (!isCross(4, i)) assert.equal(layout.isWalkLane(4, i), false);
      if (!isCross(11, i)) assert.equal(layout.isWalkLane(11, i), false);
    }
  });

  it("never raises a shelf in a walk lane, the bay or an anchor", () => {
    for (const variant of [1, 2, 3]) {
      for (const [cx, cz] of [ARRIVAL, PLAIN]) {
        for (const cell of layout.shelfCells(cx, cz, variant)) {
          assert.equal(layout.isWalkLane(cell.x, cell.z), false, `${cell.x},${cell.z}`);
          assert.equal(layout.isAlcoveCell(cx, cz, cell.x, 65, cell.z), false);
          assert.equal(layout.isProtectedBookshelf(cx, cz, cell.x, cell.z), false);
          assert.ok([65, 67, 69].includes(cell.tier));
        }
      }
    }
  });

  it("leaves the arrival bay visibly emptier than a plain room", () => {
    const arrival = layout.shelfCells(...ARRIVAL, 1).length;
    const plain = layout.shelfCells(...PLAIN, 1).length;
    assert.ok(arrival < plain, `${arrival} !< ${plain}`);
  });

  it("keeps furniture footprints out of every walk lane", () => {
    for (const variant of [1, 2, 3]) {
      for (const [cx, cz] of [ARRIVAL, PLAIN, [0, 0]]) {
        for (const item of layout.furniture(cx, cz, variant)) {
          const footprint = FOOTPRINTS[item.kind];
          assert.ok(footprint, item.kind);
          for (const [dx, dz] of footprint) {
            assert.equal(layout.isWalkLane(item.x + dx, item.z + dz), false, `${item.kind}@${item.x + dx},${item.z + dz}`);
            assert.equal(layout.isAlcoveCell(cx, cz, item.x + dx, 65, item.z + dz), false);
          }
        }
      }
    }
  });

  it("keeps the centre cross clear of tables, carts and ladders", () => {
    for (const item of layout.furniture(...PLAIN, 1)) {
      for (const [dx, dz] of FOOTPRINTS[item.kind]) {
        assert.equal(isCross(item.x + dx, item.z + dz), false);
      }
    }
  });

  it("angles a fallen shelf off the bank, never across a lane", () => {
    for (let cx = -8; cx <= 8; cx += 1) {
      const fallen = layout.fallenShelf(cx, 0);
      if (!fallen) continue;
      assert.ok([4, 11].includes(fallen.x));
      assert.equal(layout.isWalkLane(fallen.x, fallen.z), false);
      assert.equal(layout.isAlcoveCell(cx, 0, fallen.x, 65, fallen.z), false);
    }
  });
});

describe("library dressing plan", () => {
  it("mounts signs on solid walls and off the shelf banks", () => {
    for (const [cx, cz] of [ARRIVAL, PLAIN]) {
      const plan = layout.signs(cx, cz, 1);
      assert.ok(plan.length === 3 || plan.length === 4, String(plan.length));
      for (const sign of plan) {
        assert.ok(sign.x === 1 || sign.x === 14 || sign.kind === "restricted", JSON.stringify(sign));
        assert.ok(sign.y >= 65 && sign.y <= 68);
      }
    }
    assert.equal(layout.signs(...ARRIVAL, 1).some((s) => s.kind === "restricted"), true);
    assert.equal(layout.signs(...PLAIN, 1).some((s) => s.kind === "restricted"), false);
  });

  it("hangs lamps below the ceiling on the low-power alternate", () => {
    const lamps = layout.aisleLamps(3);
    assert.ok(lamps.length >= 4);
    for (const [index, lamp] of lamps.entries()) {
      assert.equal(lamp.y, 72);
      assert.equal(lamp.lit, index % 2 === 0);
      assert.equal(layout.isWalkLane(lamp.x, lamp.z), false);
    }
    for (const lamp of layout.aisleLamps(1)) assert.equal(lamp.lit, true);
  });

  it("samples full, sparse and empty tiers deterministically", () => {
    const seen = new Set();
    for (let x = 0; x < 16; x += 1) {
      for (let z = 0; z < 16; z += 1) {
        for (const tier of [65, 67, 69]) seen.add(layout.shelfTierState(x, z, tier));
      }
    }
    assert.deepEqual([...seen].sort(), ["empty", "full", "sparse"]);
    assert.equal(
      layout.shelfTierState(4, 3, 65),
      layout.shelfTierState(4, 3, 65),
    );
  });

  it("registers only block ids that exist in the behavior pack", () => {
    const source = readFileSync(path.join(ROOT, "addon/BP/scripts/library_layout.js"), "utf8");
    const ids = [...new Set(source.match(/paradise:[a-z0-9_]+/g) ?? [])].sort();
    assert.ok(ids.length > 20);
    const missing = ids.filter((id) => !existsSync(
      path.join(ROOT, "addon/BP/blocks", `${id.replace(":", "__")}.json`),
    ));
    assert.deepEqual(missing, []);
  });

  it("encodes cell offsets in every multi-cell segment id", () => {
    for (const kind of ["carrel", "table", "cart"]) {
      const ids = layout.furnitureBlock(kind);
      assert.ok(ids.length > 1, kind);
      for (const id of ids) assert.match(id, /_x\d+_y\d+_z\d+$/);
    }
    for (const state of ["full", "sparse", "empty"]) {
      for (const id of layout.shelfBlocks(state)) assert.match(id, /_x\d+_y\d+_z\d+$/);
    }
  });
});
