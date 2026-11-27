import {
  AISLE_LIGHT_ANCHORS,
  LIBRARY_LIGHT,
  LIBRARY_SHELF,
  isCross,
  shelfStateFor,
} from "./library_decor_model.js";

export const SHELF_BANKS = Object.freeze([3, 11]);
export const PROTECTED_BOOKSHELVES = Object.freeze([[3, 2], [11, 2], [11, 9]]);
export const ALCOVE = Object.freeze({ minX: 10, maxX: 13, minY: 65, maxY: 68, minZ: 12, maxZ: 14 });
const CHUNK_SIZE = 16;
const VISIT_GRID_SPACING = 1000;

export function isArrivalChunk(cx, cz) {
  if (cz !== 0) return false;
  const start = cx * CHUNK_SIZE;
  const visit = Math.max(0, Math.ceil(start / VISIT_GRID_SPACING));
  return visit * VISIT_GRID_SPACING <= start + CHUNK_SIZE - 1;
}

export function isRestrictedRoom(cx, cz) {
  return isArrivalChunk(cx - 1, cz);
}

export function isReadingRoom(cx, cz) {
  return isArrivalChunk(cx, cz + 1);
}

export function isWestRoom(cx, cz) {
  return isArrivalChunk(cx + 1, cz);
}

export function isAlcoveCell(cx, cz, x, y, z) {
  return isRestrictedRoom(cx, cz)
    && x >= ALCOVE.minX && x <= ALCOVE.maxX
    && y >= ALCOVE.minY && y <= ALCOVE.maxY
    && z >= ALCOVE.minZ && z <= ALCOVE.maxZ;
}

export function isRestrictedApproachCell(cx, cz, x, y, z) {
  return isRestrictedRoom(cx, cz)
    && x >= 11 && x <= 12
    && y >= 65 && y <= 67
    && z >= 9 && z <= 11;
}

export function isProtectedBookshelf(cx, cz, x, z) {
  return isArrivalChunk(cx, cz)
    && PROTECTED_BOOKSHELVES.some(([bx, bz]) => bx === x && bz === z);
}

/** Includes the pad support layer, the pressure plate, sign and standing space. */
export function isConnectionReservation(cx, cz, localX, y, localZ) {
  if (y < 64 || y > 67) return false;
  const x = cx * CHUNK_SIZE + localX;
  const z = cz * CHUNK_SIZE + localZ;
  const firstVisit = Math.max(0, Math.floor((x - 16) / VISIT_GRID_SPACING));
  for (let visit = firstVisit; visit <= firstVisit + 2; visit += 1) {
    const anchorX = visit * VISIT_GRID_SPACING;
    if (y >= 65 && Math.abs(x - anchorX) <= 3 && Math.abs(z) <= 3) return true;
    for (const [dx, dz] of [[8, 0], [-8, 0], [0, 8], [0, -8]]) {
      const padX = anchorX + dx;
      if (y <= 66 && Math.abs(x - padX) <= 1 && Math.abs(z - dz) <= 1) return true;
      if (y <= 65 && x === padX && z === dz + 2) return true;
    }
  }
  return false;
}

export function isWalkLane(x, z, westRoom = false) {
  return isCross(x, z) || (westRoom && x >= 3 && x <= 5);
}

export function shelfTierState(_x, z, _tier) {
  return shelfStateFor(z);
}

export function shelfCells(cx, cz, _variant) {
  const cells = [];
  const rows = isWestRoom(cx, cz) ? [2, 6] : SHELF_BANKS;
  for (const x of rows) {
    for (const z of [1, 2, 3, 4, 5, 6, 9, 10, 11, 12, 13, 14]) {
      if (isWalkLane(x, z, isWestRoom(cx, cz))) continue;
      if (isAlcoveCell(cx, cz, x, 65, z)) continue;
      if (isRestrictedApproachCell(cx, cz, x, 65, z)) continue;
      if (isWestRoom(cx, cz) && x === 2 && (z === 4 || z === 5)) continue;
      if (isReadingRoom(cx, cz) && x === 3 && z === 12) continue;
      if (isProtectedBookshelf(cx, cz, x, z)) continue;
      if (isConnectionReservation(cx, cz, x, 65, z)) continue;
      for (const tier of [65, 67, 69]) {
        cells.push({ x, z, tier, state: shelfTierState(x, z, tier) });
      }
    }
  }
  return cells;
}

export function fallenShelf(cx, cz) {
  return isWestRoom(cx, cz) ? { x: 1, z: 4, facing: "west" } : null;
}

/** Coordinates are chunk-local; furniture is confined to the wall-side rooms. */
export function furniture(cx, cz, _variant) {
  if (isReadingRoom(cx, cz)) {
    return [
      { kind: "carrel", x: 1, z: 2, facing: "east" },
      { kind: "table", x: 1, z: 10, facing: "east" },
      { kind: "chair", x: 2, z: 9, facing: "north" },
      { kind: "cabinet", x: 1, z: 12, facing: "east" },
      { kind: "ladder", x: 12, z: 13, facing: "west" },
      { kind: "crate", x: 14, z: 2, facing: "west" },
    ];
  }
  if (isRestrictedRoom(cx, cz)) {
    return [
      { kind: "cart", x: 13, z: 5, facing: "west" },
      { kind: "lockedCabinet", x: 14, z: 3, facing: "west" },
      { kind: "staffDoor", x: 14, z: 11, facing: "west" },
    ];
  }
  return [];
}

export function furnitureBlock(kind) {
  switch (kind) {
    case "carrel": return ["paradise:lib_study_carrel_x0_y0_z0", "paradise:lib_study_carrel_x0_y1_z0", "paradise:lib_study_carrel_x1_y0_z0", "paradise:lib_study_carrel_x1_y1_z0"];
    case "table": return ["paradise:lib_reading_table_x0_y0_z0", "paradise:lib_reading_table_x1_y0_z0"];
    case "chair": return ["paradise:lib_reading_chair"];
    case "cart": return ["paradise:lib_rolling_book_cart_x0_y0_z0", "paradise:lib_rolling_book_cart_x0_y1_z0"];
    case "ladder": return ["paradise:lib_tall_library_ladder_x0_y0_z0", "paradise:lib_tall_library_ladder_x0_y1_z0"];
    case "crate": return ["paradise:lib_dust_covered_crate"];
    case "cabinet": return ["paradise:lib_index_card_drawer_cabinet"];
    case "lockedCabinet": return ["paradise:lib_locked_document_cabinet_x0_y0_z0", "paradise:lib_locked_document_cabinet_x0_y1_z0"];
    case "staffDoor": return ["paradise:lib_staff_door_x0_y0_z0", "paradise:lib_staff_door_x0_y1_z0"];
    default: return [];
  }
}

export function tableDressing(x, z, lit) {
  return [
    { block: "paradise:lib_open_ledger", x, y: 66, z },
    { block: "paradise:lib_loose_papers", x: x + 1, y: 66, z },
    { block: "paradise:lib_book_stacks", x, y: 66, z: z + 1 },
    { block: lit ? LIBRARY_LIGHT.deskLit : LIBRARY_LIGHT.deskUnlit, x: x + 2, y: 66, z: z + 2 },
  ];
}

export function aisleLamps(lowPower = false) {
  return AISLE_LIGHT_ANCHORS.slice(0, 4).map(({ x, z }, index) => ({
    x,
    z,
    y: 72,
    lit: !lowPower || index % 2 === 0,
  }));
}

export function signs(cx, cz) {
  if (isReadingRoom(cx, cz)) return [{ kind: "reading", x: 1, y: 67, z: 9, facing: "east" }];
  if (isRestrictedRoom(cx, cz)) return [
    { kind: "returns", x: 14, y: 68, z: 2, facing: "west" },
    { kind: "restricted", x: 11, y: 69, z: 10, facing: "south" },
    { kind: "exit", x: 13, y: 68, z: 14, facing: "south" },
  ];
  return [];
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

export function ceilingBeams() {
  return [4, 12].flatMap((z) => Array.from({ length: 16 }, (_value, x) => ({ x, z })));
}
