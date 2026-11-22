/**
 * Library static dressing writer (rework). Rules live in `library_layout.js`
 * and `library_decor_model.js`.
 */

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
  isProtectedBookshelf,
  shelfBlocks,
  shelfCells,
  signBlocks,
  signs,
  tableDressing,
} from "./library_layout.js";

/** Native blocks that belong to travel pads, chests or the vanilla anchors. */
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

function place(dimension, typeId, x, y, z, facing) {
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

/** Place each segment at the cell offsets encoded in its `_xN_yN_zN` suffix. */
function placeSegments(dimension, ids, x, y, z, facing) {
  let placed = 0;
  for (const id of ids) {
    const match = /_x(\d+)_y(\d+)_z(\d+)$/.exec(id);
    const dx = match ? Number(match[1]) : 0;
    const dy = match ? Number(match[2]) : 0;
    const dz = match ? Number(match[3]) : 0;
    if (place(dimension, id, x + dx, y + dy, z + dz, facing)) placed += 1;
  }
  return placed;
}

/** Floor, ceiling and the paneled wall shell with cracked plaster. */
export function applyLibrarySurfaces(dimension, ox, oz, variant, cx = 0, cz = 0) {
  const writes = { floor: 0, wall: 0, ceiling: 0 };
  for (let localX = 0; localX < 16; localX++) {
    for (let localZ = 0; localZ < 16; localZ++) {
      const x = ox + localX;
      const z = oz + localZ;
      const reserved = isAlcoveCell(cx, cz, localX, 65, localZ);
      if (reserved) continue;

      const floor = isCross(localX, localZ)
        ? LIBRARY_SURFACE.runner
        : LIBRARY_SURFACE.parquet;
      if (place(dimension, floor, x, 64, z, null)) writes.floor += 1;

      const ceiling = hashCoords(localX, localZ, 31) % 5 === 0
        ? LIBRARY_SURFACE.paneling
        : "minecraft:oak_planks";
      if (place(dimension, ceiling, x, 73, z, null)) writes.ceiling += 1;
    }
  }

  // Ceiling beams flush with the ceiling, every eight cells.
  for (const z of [4, 12]) {
    for (let localX = 0; localX < 16; localX++) {
      if (place(dimension, "minecraft:dark_oak_log", ox + localX, 73, oz + z, null)) writes.ceiling += 1;
    }
  }

  // Two-wide doorways line up with the cross so rooms connect cleanly.
  const shell = (x, z, open) => {
    if (open) return;
    for (let y = 65; y <= 71; y++) {
      const typeId = y === 65
        ? LIBRARY_SURFACE.baseboard
        : (y >= 68 && hashCoords(x, z, 97) % 8 === 0
          ? LIBRARY_SURFACE.plaster
          : LIBRARY_SURFACE.paneling);
      if (place(dimension, typeId, x, y, z, null)) writes.wall += 1;
    }
  };
  for (let localX = 0; localX < 16; localX++) {
    const open = localX === 7 || localX === 8;
    shell(ox + localX, oz, open);
    shell(ox + localX, oz + 15, open);
  }
  for (let localZ = 1; localZ < 15; localZ++) {
    const open = localZ === 7 || localZ === 8;
    shell(ox, oz + localZ, open);
    shell(ox + 15, oz + localZ, open);
  }

  // Restricted-bay partition at z11 with a two-wide doorway at x12..13.
  for (let localX = 9; localX <= 15; localX++) {
    const doorway = localX === 12 || localX === 13;
    for (let y = 65; y <= 71; y++) {
      if (doorway && y <= 66) continue;
      const typeId = y === 65 ? LIBRARY_SURFACE.baseboard : LIBRARY_SURFACE.paneling;
      if (place(dimension, typeId, ox + localX, y, oz + 11, null)) writes.wall += 1;
    }
  }
  return writes;
}

/** Tall flush banks, tier gaps, endcaps and the single fallen shelf. */
export function applyLibraryShelves(dimension, ox, oz, variant, cx = 0, cz = 0) {
  let placed = 0;
  for (const cell of shelfCells(cx, cz, variant)) {
    placed += placeSegments(dimension, shelfBlocks(cell.state), ox + cell.x, cell.tier, oz + cell.z, cell.side);
  }

  const fallen = fallenShelf(cx, cz);
  if (fallen && !isAlcoveCell(cx, cz, fallen.x, 65, fallen.z)) {
    if (place(dimension, "paradise:lib_fallen_shelf", ox + fallen.x, 65, oz + fallen.z, fallen.facing)) {
      placed += 1;
    }
  }

  // Endcaps anchor every bank end to the floor.
  for (const x of [4, 11]) {
    for (const z of [1, 14]) {
      if (isProtectedBookshelf(cx, cz, x, z)) continue;
      placed += placeSegments(dimension, ["paradise:lib_shelf_endcap_x0_y0_z0", "paradise:lib_shelf_endcap_x0_y1_z0"], ox + x, 65, oz + z, null);
    }
  }
  return placed;
}

/** Reading zones: carrels, tables, chairs, carts, ladders and desk clutter. */
export function applyLibraryFurniture(dimension, ox, oz, variant, cx = 0, cz = 0) {
  let placed = 0;
  for (const item of furniture(cx, cz, variant)) {
    const ids = furnitureBlock(item.kind);
    placed += placeSegments(dimension, ids, ox + item.x, 65, oz + item.z, item.facing);
    if (item.kind === "table") {
      const lit = variant !== 3;
      for (const entry of tableDressing(ox + item.x, oz + item.z, lit)) {
        if (place(dimension, entry.block, entry.x, entry.y, entry.z, null)) placed += 1;
      }
    }
  }
  // A returns trolley and a book stack sit beside the returns sign.
  placed += placeSegments(dimension, ["paradise:lib_book_stacks"], ox + 14, 65, oz + 6, "west");
  placed += placeSegments(dimension, ["paradise:lib_bookends"], ox + 3, 65, oz + 4, null);
  return placed;
}

/** Warm aisle lamps and their dim/low-power alternates. */
export function applyLibraryLights(dimension, ox, oz, variant) {
  let placed = 0;
  for (const lamp of aisleLamps(variant)) {
    const ids = lamp.lit ? LIBRARY_LIGHT.lit : LIBRARY_LIGHT.unlit;
    placed += placeSegments(dimension, ids, ox + lamp.x, lamp.y, oz + lamp.z, "west");
    if (place(dimension, "minecraft:glowstone", ox + lamp.x, 73, oz + lamp.z, null)) placed += 1;
  }
  return placed;
}

/** Static wayfinding, including the restricted sign at the reserved bay. */
export function applyLibrarySigns(dimension, ox, oz, variant, cx = 0, cz = 0) {
  let placed = 0;
  for (const sign of signs(cx, cz, variant)) {
    placed += placeSegments(dimension, signBlocks(sign.kind), ox + sign.x, sign.y, oz + sign.z, sign.facing);
  }
  return placed;
}

/** Run every library static pass for a generated chunk. */
export function applyLibraryDressing(dimension, ox, oz, variant, cx = 0, cz = 0) {
  return {
    surfaces: applyLibrarySurfaces(dimension, ox, oz, variant, cx, cz),
    shelves: applyLibraryShelves(dimension, ox, oz, variant, cx, cz),
    furniture: applyLibraryFurniture(dimension, ox, oz, variant, cx, cz),
    lights: applyLibraryLights(dimension, ox, oz, variant),
    signs: applyLibrarySigns(dimension, ox, oz, variant, cx, cz),
  };
}
