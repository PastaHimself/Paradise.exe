/**
 * Library static dressing writer. Rules live in `library_decor_model.js`.
 */

import { BlockPermutation } from "@minecraft/server";
import {
  LIBRARY_SURFACE,
  LIBRARY_LIGHT,
  LIBRARY_SHELF,
  isCross,
  isReserved,
  isPlasterPanel,
  isShelfEndcap,
  shelfStateFor,
  shelfRowsFor,
  aisleLightStateFor,
  AISLE_LIGHT_ANCHORS,
  hashCoords,
} from "./library_decor_model.js";

function placeSegments(dimension, ids, x, y, z) {
  let placed = 0;
  for (let index = 0; index < ids.length; index++) {
    if (place(dimension, ids[index], x, y + index, z, null)) placed += 1;
  }
  return placed;
}

function place(dimension, typeId, x, y, z, facing) {
  try {
    const block = dimension.getBlock({ x, y, z });
    if (!block) return false;
    block.setPermutation(BlockPermutation.resolve(typeId, facing ? { "minecraft:cardinal_direction": facing } : {}));
    return true;
  } catch (error) {
    return false;
  }
}

/** Write the library surfaces for one 16x16 chunk. */
export function applyLibrarySurfaces(dimension, ox, oz, variant) {
  const writes = { floor: 0, wall: 0, ceiling: 0 };
  for (let localX = 0; localX < 16; localX++) {
    for (let localZ = 0; localZ < 16; localZ++) {
      const x = ox + localX;
      const z = oz + localZ;
      if (isReserved(localX, 64, localZ)) {
        placeSegments(dimension, LIBRARY_SHELF.endcap, x, 64, z);
        continue;
      }
      const floor = isCross(localX, localZ) ? LIBRARY_SURFACE.runner : LIBRARY_SURFACE.parquet;
      if (place(dimension, floor, x, 64, z, null)) writes.floor += 1;
      if (isCross(localX, localZ)) continue;
      const ceilingState = hashCoords(localX, localZ, 31) % 6 === 0;
      if (place(dimension, ceilingState ? LIBRARY_SURFACE.paneling : "minecraft:oak_planks", x, 73, z, null)) {
        writes.ceiling += 1;
      }
    }
  }
  // Wall band, baseboard and plaster on the north and west shells.
  for (let localX = 0; localX < 16; localX++) {
    for (let localZ of [0, 15]) {
      for (let y = 65; y <= 71; y++) {
        const typeId = y === 65 ? LIBRARY_SURFACE.baseboard : LIBRARY_SURFACE.paneling;
        if (place(dimension, typeId, ox + localX, y, oz + localZ, null)) writes.wall += 1;
      }
    }
  }
  for (let localZ = 0; localZ < 16; localZ++) {
    for (let localX of [0, 15]) {
      for (let y = 65; y <= 71; y++) {
        const typeId = y === 65 ? LIBRARY_SURFACE.baseboard : LIBRARY_SURFACE.paneling;
        if (place(dimension, typeId, ox + localX, y, oz + localZ, null)) writes.wall += 1;
      }
    }
  }
  for (let localX = 0; localX < 16; localX++) {
    for (let localZ = 0; localZ < 16; localZ++) {
      if (isCross(localX, localZ)) continue;
      for (let y = 68; y <= 70; y++) {
        if (!isPlasterPanel(localX, y, localZ)) continue;
        if (place(dimension, LIBRARY_SURFACE.plaster, ox + localX, y, oz + localZ, null)) writes.wall += 1;
      }
    }
  }
  return writes;
}

/** Shelf tiers and endcaps, plus the variant-2 three-block aisle rows. */
export function applyLibraryShelves(dimension, ox, oz, variant) {
  let placed = 0;
  for (const rowX of shelfRowsFor(variant)) {
    for (let localZ = 0; localZ < 16; localZ++) {
      if (isCross(rowX, localZ)) continue;
      const x = ox + rowX;
      const z = oz + localZ;
      if (isShelfEndcap(localZ)) {
        placed += placeSegments(dimension, LIBRARY_SHELF.endcap, x, 65, z);
        continue;
      }
      if (localZ < 1 || localZ > 14) continue;
      const state = shelfStateFor(localZ);
      for (const y of [65, 67, 69]) {
        placed += placeSegments(dimension, LIBRARY_SHELF[state], x, y, z);
      }
    }
  }
  return placed;
}

/** Aisle light pairs and their lit low-power alternate pattern. */
export function applyLibraryLights(dimension, ox, oz, lowPower) {
  let placed = 0;
  AISLE_LIGHT_ANCHORS.forEach((anchor, index) => {
    const state = aisleLightStateFor(index, lowPower);
    const ids = state === "lit" ? LIBRARY_LIGHT.lit : LIBRARY_LIGHT.unlit;
    for (let segment = 0; segment < ids.length; segment++) {
      const x = ox + anchor.x + segment;
      if (place(dimension, ids[segment], x, 72, oz + anchor.z, "west")) placed += 1;
    }
    // Vanilla glowstone keeps at least four block light on the cross.
    if (place(dimension, "minecraft:glowstone", ox + anchor.x, 73, oz + anchor.z, null)) placed += 1;
  });
  return placed;
}

/** Run every library static pass for a generated chunk. */
export function applyLibraryDressing(dimension, ox, oz, variant) {
  const lowPower = variant === 3;
  return {
    surfaces: applyLibrarySurfaces(dimension, ox, oz, variant),
    shelves: applyLibraryShelves(dimension, ox, oz, variant),
    lights: applyLibraryLights(dimension, ox, oz, lowPower),
  };
}
