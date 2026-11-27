import { BlockPermutation } from "@minecraft/server";
import {
  LIBRARY_LIGHT,
  LIBRARY_SURFACE,
  hashCoords,
  isCross,
} from "./library_decor_model.js";
import {
  aisleLamps,
  fallenShelf,
  furniture,
  furnitureBlock,
  isAlcoveCell,
  isConnectionReservation,
  isProtectedBookshelf,
  isReadingRoom,
  isRestrictedApproachCell,
  isRestrictedRoom,
  isWestRoom,
  shelfBlocks,
  shelfCells,
  signs,
  signBlocks,
  tableDressing,
} from "./library_layout.js";

const PROTECTED_PREFIXES = [
  "minecraft:stone_pressure_plate",
  "minecraft:oak_pressure_plate",
  "minecraft:spruce_pressure_plate",
  "minecraft:birch_pressure_plate",
  "minecraft:acacia_pressure_plate",
  "minecraft:chest",
  "minecraft:bed",
  "minecraft:sign",
  "minecraft:standing_sign",
  "minecraft:wall_sign",
  "minecraft:bookshelf",
];

const FALLEN_SHELF_WEST_OFFSETS = {
  "paradise:lib_fallen_shelf_x0_y0_z0": [0, 0, 1],
  "paradise:lib_fallen_shelf_x0_y0_z1": [1, 0, 1],
  "paradise:lib_fallen_shelf_x1_y0_z0": [0, 0, 0],
  "paradise:lib_fallen_shelf_x1_y0_z1": [1, 0, 0],
};

function currentBlock(dimension, x, y, z) {
  try {
    return dimension.getBlock({ x, y, z });
  } catch (_error) {
    return undefined;
  }
}

function isProtected(block) {
  const id = block?.typeId || "";
  return PROTECTED_PREFIXES.some((prefix) => id === prefix || id.startsWith(prefix));
}

function place(dimension, typeId, x, y, z, facing = undefined) {
  const block = currentBlock(dimension, x, y, z);
  if (!block || isProtected(block)) return false;
  try {
    block.setPermutation(BlockPermutation.resolve(
      typeId,
      facing ? { "minecraft:cardinal_direction": facing } : {},
    ));
    return true;
  } catch (_error) {
    return false;
  }
}

function segmentOffsets(id) {
  const match = /_x(\d+)_y(\d+)_z(\d+)$/.exec(id);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : [0, 0, 0];
}

function placeSegments(dimension, ids, x, y, z, facing, cx, cz, offsetsById = undefined) {
  const locations = ids.map((id) => {
    const [dx, dy, dz] = offsetsById?.[id] ?? segmentOffsets(id);
    return { id, x: x + dx, y: y + dy, z: z + dz };
  });
  if (locations.some((cell) => isConnectionReservation(cx, cz, cell.x - cx * 16, cell.y, cell.z - cz * 16)
    || isAlcoveCell(cx, cz, cell.x - cx * 16, cell.y, cell.z - cz * 16)
    || isRestrictedApproachCell(cx, cz, cell.x - cx * 16, cell.y, cell.z - cz * 16)
    || (cell.y <= 71 && isCross(cell.x - cx * 16, cell.z - cz * 16)))) {
    return 0;
  }
  if (locations.some((cell) => isProtected(currentBlock(dimension, cell.x, cell.y, cell.z)))) return 0;
  return locations.reduce((count, cell) => count + (place(dimension, cell.id, cell.x, cell.y, cell.z, facing) ? 1 : 0), 0);
}

/** Floors are parquet at Y64, with a thin runner at Y65 in public lanes. */
export function applyLibrarySurfaces(dimension, ox, oz, _variant, cx = 0, cz = 0) {
  const writes = { floor: 0, runner: 0, wall: 0, ceiling: 0 };
  for (let localX = 0; localX < 16; localX += 1) {
    for (let localZ = 0; localZ < 16; localZ += 1) {
      const x = ox + localX;
      const z = oz + localZ;
      if (!isConnectionReservation(cx, cz, localX, 64, localZ)) {
        if (place(dimension, LIBRARY_SURFACE.parquet, x, 64, z)) writes.floor += 1;
      }
      if (isCross(localX, localZ)
        && !isConnectionReservation(cx, cz, localX, 65, localZ)
        && place(dimension, LIBRARY_SURFACE.runner, x, 65, z)) writes.runner += 1;
      if (place(dimension, "minecraft:oak_planks", x, 73, z)) writes.ceiling += 1;
    }
  }

  const wall = (localX, localZ) => {
    if (isCross(localX, localZ)) return;
    for (let y = 65; y <= 71; y += 1) {
      if (isConnectionReservation(cx, cz, localX, y, localZ)
        || isAlcoveCell(cx, cz, localX, y, localZ)) continue;
      const typeId = y === 65 ? LIBRARY_SURFACE.baseboard
        : y >= 68 && y <= 70 && hashCoords(localX, localZ, 97) % 8 === 0
          ? LIBRARY_SURFACE.plaster : LIBRARY_SURFACE.paneling;
      if (place(dimension, typeId, ox + localX, y, oz + localZ)) writes.wall += 1;
    }
  };
  for (let localX = 0; localX < 16; localX += 1) {
    wall(localX, 0);
    wall(localX, 15);
  }
  for (let localZ = 1; localZ < 15; localZ += 1) {
    wall(0, localZ);
    wall(15, localZ);
  }
  return writes;
}

export function applyLibraryShelves(dimension, ox, oz, variant, cx = 0, cz = 0) {
  let placed = 0;
  for (const cell of shelfCells(cx, cz, variant)) {
    placed += placeSegments(dimension, shelfBlocks(cell.state), ox + cell.x, cell.tier, oz + cell.z, undefined, cx, cz);
  }
  const fallen = fallenShelf(cx, cz);
  if (fallen && !isConnectionReservation(cx, cz, fallen.x, 65, fallen.z)) {
    placed += placeSegments(dimension, Object.keys(FALLEN_SHELF_WEST_OFFSETS),
      ox + fallen.x, 65, oz + fallen.z, fallen.facing, cx, cz, FALLEN_SHELF_WEST_OFFSETS);
  }
  for (const x of isWestRoom(cx, cz) ? [2, 6] : [3, 11]) {
    for (const z of [0, 15]) {
      placed += placeSegments(dimension, shelfBlocks("endcap"), ox + x, 65, oz + z, undefined, cx, cz);
    }
  }
  if (isReadingRoom(cx, cz)) {
    for (const [x, z, id] of [
      [3, 0, "paradise:lib_shelf_number_plate_01"],
      [11, 0, "paradise:lib_shelf_number_plate_02"],
      [11, 15, "paradise:lib_shelf_number_plate_03"],
    ]) placed += placeSegments(dimension, [id], ox + x, 67, oz + z, undefined, cx, cz);
  }
  for (const [x, z] of [[3, 2], [11, 2], [11, 9]]) {
    if (isProtectedBookshelf(cx, cz, x, z)) {
      placed += place(dimension, "minecraft:bookshelf", ox + x, 65, oz + z) ? 1 : 0;
    }
  }
  return placed;
}

export function applyLibraryFurniture(dimension, ox, oz, variant, cx = 0, cz = 0) {
  let placed = 0;
  for (const item of furniture(cx, cz, variant)) {
    const ids = furnitureBlock(item.kind);
    placed += placeSegments(dimension, ids, ox + item.x, 65, oz + item.z, item.facing, cx, cz);
    if (item.kind === "table") {
      for (const entry of tableDressing(ox + item.x, oz + item.z, true)) {
        placed += placeSegments(dimension, [entry.block], entry.x, entry.y, entry.z, undefined, cx, cz);
      }
    }
  }
  if (isReadingRoom(cx, cz)) {
    placed += placeSegments(dimension, ["paradise:lib_bookends"], ox + 3, 67, oz + 12, undefined, cx, cz);
  }
  if (isRestrictedRoom(cx, cz)) {
    placed += placeSegments(dimension, ["paradise:lib_book_return_slot_x0_y0_z0"], ox + 14, 66, oz + 2, "west", cx, cz);
    placed += placeSegments(dimension, ["paradise:lib_tall_divider_x0_y0_z0", "paradise:lib_tall_divider_x0_y1_z0", "paradise:lib_tall_divider_x1_y0_z0", "paradise:lib_tall_divider_x1_y1_z0"], ox + 14, 65, oz + 4, "west", cx, cz);
  }
  return placed;
}

export function applyLibraryLights(dimension, ox, oz, _variant, cx = 0, cz = 0) {
  let placed = 0;
  const lowPower = isRestrictedRoom(cx, cz);
  for (const lamp of aisleLamps(lowPower)) {
    placed += placeSegments(dimension, lamp.lit ? LIBRARY_LIGHT.lit : LIBRARY_LIGHT.unlit,
      ox + lamp.x, lamp.y, oz + lamp.z, "north", cx, cz);
    placed += place(dimension, "minecraft:iron_bars", ox + lamp.x, 73, oz + lamp.z) ? 1 : 0;
  }
  placed += placeSegments(dimension, [
    "paradise:sh_fixture_lit_x0_y0_z0",
    "paradise:sh_fixture_lit_x0_y0_z1",
  ], ox + 2, 73, oz + 10, "north", cx, cz);
  for (const [x, z] of [[4, 4], [11, 11], [10, 13]]) {
    if (place(dimension, "minecraft:glowstone", ox + x, 73, oz + z)) placed += 1;
  }
  return placed;
}

export function applyLibrarySigns(dimension, ox, oz, variant, cx = 0, cz = 0) {
  let placed = 0;
  for (const sign of signs(cx, cz)) {
    placed += placeSegments(dimension, signBlocks(sign.kind), ox + sign.x, sign.y, oz + sign.z, sign.facing, cx, cz);
  }
  return placed;
}

/** Keep the document reserve empty while exposing a permanently lit static frame. */
export function applyLibraryRestrictedBay(dimension, ox, oz, cx = 0, cz = 0) {
  if (!isRestrictedRoom(cx, cz)) return 0;
  let placed = 0;
  for (let x = 10; x <= 13; x += 1) {
    for (let z = 12; z <= 14; z += 1) {
      if (place(dimension, "minecraft:polished_deepslate", ox + x, 64, oz + z)) placed += 1;
      for (let y = 65; y <= 68; y += 1) {
        if (place(dimension, "minecraft:air", ox + x, y, oz + z)) placed += 1;
      }
    }
  }
  for (const x of [9, 14]) {
    placed += placeSegments(dimension, [
      "paradise:lib_restricted_archive_gate_x0_y0_z0",
      "paradise:lib_restricted_archive_gate_x0_y1_z0",
    ], ox + x, 65, oz + 10, "south", cx, cz);
  }
  return placed;
}

export function applyLibraryDressing(dimension, ox, oz, variant, cx = 0, cz = 0) {
  return {
    surfaces: applyLibrarySurfaces(dimension, ox, oz, variant, cx, cz),
    shelves: applyLibraryShelves(dimension, ox, oz, variant, cx, cz),
    furniture: applyLibraryFurniture(dimension, ox, oz, variant, cx, cz),
    lights: applyLibraryLights(dimension, ox, oz, variant, cx, cz),
    signs: applyLibrarySigns(dimension, ox, oz, variant, cx, cz),
    restricted: applyLibraryRestrictedBay(dimension, ox, oz, cx, cz),
  };
}
