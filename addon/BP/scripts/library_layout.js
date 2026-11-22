/**
 * Library spatial plan (rework): grand multi-aisle layout, furniture zones,
 * signs and lamps. Pure data so walkability can be tested without a runtime.
 */

import {
  LIBRARY_LIGHT,
  LIBRARY_SHELF,
  hashCoords,
  isCross,
} from "./library_decor_model.js";

/** Two long shelf banks face the centre aisle; outer bays hold reading zones. */
export const SHELF_BANKS = Object.freeze([
  Object.freeze({ x: 4, side: "west" }),
  Object.freeze({ x: 11, side: "east" }),
]);

/** Vanilla bookshelf anchors that must survive in the arrival chunk. */
export const PROTECTED_BOOKSHELVES = Object.freeze([[3, 2], [11, 2], [11, 9]]);

/** Reserved restricted bay, arrival chunk only. */
export const ALCOVE = Object.freeze({ minX: 10, maxX: 13, minY: 65, maxY: 68, minZ: 12, maxZ: 14 });

/** Arrival chunks sit on the 1000-block visit grid along z=0. */
export function isArrivalChunk(cx, cz) {
  if (cz !== 0) return false;
  const ox = cx * 16;
  const base = Math.ceil(ox / 1000) * 1000;
  return base >= ox && base <= ox + 15;
}

export function isAlcoveCell(cx, cz, x, y, z) {
  return isArrivalChunk(cx, cz)
    && x >= ALCOVE.minX && x <= ALCOVE.maxX
    && y >= ALCOVE.minY && y <= ALCOVE.maxY
    && z >= ALCOVE.minZ && z <= ALCOVE.maxZ;
}

export function isProtectedBookshelf(cx, cz, x, z) {
  if (!isArrivalChunk(cx, cz)) return false;
  return PROTECTED_BOOKSHELVES.some(([bx, bz]) => bx === x && bz === z);
}

/**
 * Walking lanes: the four-wide centre cross (x7..8 / z7..8) plus the two
 * two-wide side aisles at x2..3 and x12..13. Nothing is placed in them.
 */
export function isWalkLane(x, z) {
  return isCross(x, z) || (x >= 2 && x <= 3) || (x >= 12 && x <= 13);
}

export function shelfTierState(x, z, tier) {
  const bucket = hashCoords(x + tier * 17, z, 0x5348454c) % 100;
  if (bucket < 58) return "full";
  if (bucket < 86) return "sparse";
  return "empty";
}

/** Shelf cells with one-cell window gaps and mid-bank ladders. */
export function shelfCells(cx, cz, variant) {
  const cells = [];
  for (const bank of SHELF_BANKS) {
    for (let z = 2; z <= 13; z++) {
      if (isCross(bank.x, z)) continue;
      if (z === 6 || z === 10) continue; // ladder / window gaps
      if (bank.x === 11 && z === 11) continue; // restricted-bay partition
      if (isAlcoveCell(cx, cz, bank.x, 65, z)) continue;
      if (isProtectedBookshelf(cx, cz, bank.x, z)) continue;
      if (hashCoords(bank.x, z, 0x474150) % 9 === 0) continue; // occasional open bay
      for (const tier of [65, 67, 69]) {
        if (tier === 69 && hashCoords(bank.x, z, 0x54494552) % 3 === 0) continue; // missing top tier
        cells.push({ x: bank.x, z, tier, state: shelfTierState(bank.x, z, tier), side: bank.side });
      }
      if (variant === 2) {
        const inner = bank.x === 4 ? 6 : 9;
        if (!isCross(inner, z)) {
          cells.push({ x: inner, z, tier: 65, state: "sparse", side: bank.side });
        }
      }
    }
  }
  return cells;
}

/** One fallen shelf per nine chunks, angled off the bank without closing an aisle. */
export function fallenShelf(cx, cz) {
  if (hashCoords(cx, cz, 0x46414c4c) % 9 !== 0) return null;
  const west = hashCoords(cx, cz, 0x53494445) % 2 === 0;
  const z = 3 + (hashCoords(cx, cz, 0x5a) % 9);
  if (isCross(4, z) || isCross(11, z)) return null;
  return { x: west ? 4 : 11, z, facing: west ? "east" : "west" };
}

/** Reading tables, carrels, chairs, carts and ladders in the outer bays. */
export function furniture(cx, cz, variant) {
  const plan = [];
  const footprints = {
    carrel: [[0, 0], [1, 0], [0, 1], [1, 1]],
    table: [[0, 0], [1, 0]],
    chair: [[0, 0]],
    cart: [[0, 0]],
    ladder: [[0, 0]],
    crate: [[0, 0]],
  };
  const push = (kind, x, z, facing) => {
    for (const [dx, dz] of footprints[kind]) {
      const cx0 = x + dx;
      const cz0 = z + dz;
      if (cx0 < 0 || cx0 > 15 || cz0 < 0 || cz0 > 15) return;
      if (isWalkLane(cx0, cz0)) return;
      if (isAlcoveCell(cx, cz, cx0, 65, cz0)) return;
      if (isAlcoveCell(cx, cz, cx0, 68, cz0)) return;
    }
    plan.push({ kind, x, z, facing });
  };

  // Outer reading bays, flush to the x=0 / x=15 walls, outside the side aisles.
  push("carrel", 0, 2, "east");
  push("carrel", 14, 2, "west");
  push("carrel", 0, 12, "east");
  push("carrel", 14, 12, "west");
  push("table", 0, 5, "east");
  push("table", 14, 5, "west");
  push("table", 0, 9, "east");
  push("table", 14, 9, "west");
  push("chair", 0, 4, "east");
  push("chair", 15, 4, "west");

  // Centre reading cluster between the shelf banks; x7..8 stays open.
  push("table", 5, 3, "east");
  push("table", 9, 3, "west");
  push("table", 5, 11, "east");
  push("table", 9, 11, "west");
  push("cart", 6, 5, "east");
  push("cart", 9, 5, "west");
  push("ladder", 4, 6, "east");
  push("ladder", 11, 10, "west");

  if (variant === 3) {
    push("crate", 0, 14, "east");
  }
  return plan;
}

export function furnitureBlock(kind) {
  switch (kind) {
    case "carrel": return ["paradise:lib_study_carrel_x0_y0_z0", "paradise:lib_study_carrel_x0_y1_z0", "paradise:lib_study_carrel_x1_y0_z0", "paradise:lib_study_carrel_x1_y1_z0"];
    case "table": return ["paradise:lib_reading_table_x0_y0_z0", "paradise:lib_reading_table_x1_y0_z0"];
    case "chair": return ["paradise:lib_reading_chair"];
    case "cart": return ["paradise:lib_rolling_book_cart_x0_y0_z0", "paradise:lib_rolling_book_cart_x0_y1_z0"];
    case "ladder": return ["paradise:lib_tall_library_ladder"];
    case "crate": return ["paradise:lib_dust_covered_crate"];
    default: return [];
  }
}

/** Desk lamp and open ledger dressing for a reading table. */
export function tableDressing(x, z, lit) {
  return [
    { block: lit ? LIBRARY_LIGHT.deskLit : LIBRARY_LIGHT.deskUnlit, x, y: 67, z },
    { block: "paradise:lib_open_ledger", x: x + 1, y: 67, z },
    { block: "paradise:lib_loose_papers", x, y: 67, z: z + 1 },
  ];
}

/** Warm aisle lamps at the bank ends, unlit on the low-power variant. */
export function aisleLamps(variant) {
  const anchors = [
    { x: 5, z: 4 }, { x: 10, z: 4 }, { x: 5, z: 11 }, { x: 10, z: 11 },
  ];
  return anchors.map((anchor, index) => ({
    ...anchor,
    lit: variant !== 3 || index % 2 === 0,
    y: 72,
  }));
}

/** Static signs, one per function, kept off the walking lanes. */
export function signs(cx, cz, variant) {
  const plan = [
    { kind: "reading", x: 1, y: 66, z: 7, facing: "east" },
    { kind: "returns", x: 14, y: 66, z: 7, facing: "west" },
    { kind: "exit", x: 14, y: 66, z: 13, facing: "west" },
  ];
  if (isArrivalChunk(cx, cz)) {
    plan.push({ kind: "restricted", x: 10, y: 66, z: 11, facing: "south" });
  }
  if (variant === 2) {
    plan.push({ kind: "reading", x: 1, y: 66, z: 9, facing: "east" });
  }
  return plan;
}

export function signBlocks(kind) {
  switch (kind) {
    case "reading": return ["paradise:lib_reading_room_sign_x0_y0_z0", "paradise:lib_reading_room_sign_x1_y0_z0"];
    case "returns": return ["paradise:lib_returns_sign_x0_y0_z0", "paradise:lib_returns_sign_x1_y0_z0"];
    case "restricted": return ["paradise:lib_restricted_sign_x0_y0_z0", "paradise:lib_restricted_sign_x1_y0_z0"];
    default: return ["paradise:lib_exit_texture_x0_y0_z0", "paradise:lib_exit_texture_x1_y0_z0"];
  }
}

export function shelfBlocks(state) {
  return LIBRARY_SHELF[state] || LIBRARY_SHELF.full;
}

/** Ceiling beams every four cells; flush with the acoustic ceiling. */
export function ceilingBeams() {
  const cells = [];
  for (const z of [4, 12]) {
    for (let x = 0; x < 16; x++) cells.push({ x, z });
  }
  return cells;
}
