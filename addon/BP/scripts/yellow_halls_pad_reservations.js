const PAD_OFFSETS = Object.freeze([
  { key: "yellow-stairwell", dx: 10, dz: 0 },
  { key: "yellow-archive", dx: -10, dz: 0 },
  { key: "yellow-buried", dx: 0, dz: -10 },
]);

const PAD_SUPPORT_OFFSETS = Object.freeze({
  "minecraft:stone_bricks": { dx: -10, dz: 0 },
  "minecraft:bookshelf": { dx: 10, dz: 0 },
  "minecraft:cracked_stone_bricks": { dx: 0, dz: 10 },
});

/**
 * @typedef {{ minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number, yLevels?: number[] }} BlockBounds
 */

/**
 * @param {{ x: number, y: number, z: number }} location
 * @returns {BlockBounds[]}
 */
export function createYellowHallsPadReservations(location) {
  const anchor = {
    x: Math.floor(location.x),
    y: Math.floor(location.y),
    z: Math.floor(location.z),
  };
  const minY = anchor.y - 1;
  const maxY = anchor.y + 1;
  const reservations = [];

  for (const pad of PAD_OFFSETS) {
    const centerX = anchor.x + pad.dx;
    const centerZ = anchor.z + pad.dz;
    reservations.push({
      minX: centerX - 1,
      maxX: centerX + 1,
      minY,
      maxY,
      minZ: centerZ - 1,
      maxZ: centerZ + 1,
    });
    reservations.push({
      minX: centerX,
      maxX: centerX,
      minY,
      maxY,
      minZ: centerZ + 2,
      maxZ: centerZ + 2,
    });

    if (pad.dx !== 0) {
      reservations.push({
        minX: Math.min(anchor.x, centerX),
        maxX: Math.max(anchor.x, centerX),
        minY,
        maxY,
        minZ: anchor.z,
        maxZ: anchor.z + 1,
      });
    } else {
      reservations.push({
        minX: anchor.x,
        maxX: anchor.x + 1,
        minY,
        maxY,
        minZ: Math.min(anchor.z, centerZ),
        maxZ: Math.max(anchor.z, centerZ),
      });
    }
  }

  return reservations;
}

/**
 * Recover the anchor from one of the native connection-pad signs.
 *
 * @param {string} label
 * @param {{ x: number, y: number, z: number }} signLocation
 * @returns {{ x: number, y: number, z: number } | undefined}
 */
export function inferYellowHallsPadAnchor(label, signLocation) {
  switch (String(label).trim()) {
    case "STAIRWELL":
      return { x: signLocation.x - 10, y: signLocation.y, z: signLocation.z - 2 };
    case "ARCHIVE":
      return { x: signLocation.x + 10, y: signLocation.y, z: signLocation.z - 2 };
    case "DOWN":
      return { x: signLocation.x, y: signLocation.y, z: signLocation.z + 8 };
    default:
      return undefined;
  }
}

/**
 * Scan one patch for existing native connection-pad markers. A missing block
 * or unavailable sign component makes the scan incomplete so callers can retry
 * after the relevant chunks become readable. The generator yields after each
 * bounded group of block reads so Bedrock can resume it on a later tick.
 *
 * @param {{ getBlock: (location: { x: number, y: number, z: number }) => ({ typeId: string, getComponent?: (componentId: string) => ({ getText?: () => string } | undefined) } | undefined) }} dimension
 * @param {BlockBounds} bounds
 * @param {number} [readsPerBatch=192]
 * @returns {Generator<void, { anchors: { x: number, y: number, z: number }[], unreadable: number, complete: boolean }, void>}
 */
export function* scanYellowHallsPadMarkers(dimension, bounds, readsPerBatch = 192) {
  const anchors = [];
  const anchorKeys = new Set();
  let unreadable = 0;
  let readsSinceYield = 0;
  const batchSize = Number.isInteger(readsPerBatch) && readsPerBatch > 0 ? readsPerBatch : 192;
  const addAnchor = (anchor) => {
    const key = `${anchor.x}:${anchor.y}:${anchor.z}`;
    if (anchorKeys.has(key)) return;
    anchorKeys.add(key);
    anchors.push(anchor);
  };
  const readBlock = function* (location) {
    let block;
    try {
      block = dimension.getBlock(location);
      if (!block) unreadable += 1;
    } catch (error) {
      unreadable += 1;
    }

    readsSinceYield += 1;
    if (readsSinceYield >= batchSize) {
      readsSinceYield = 0;
      yield;
    }
    return block;
  };

  const yLevels = bounds.yLevels
    ? [...new Set(bounds.yLevels.filter((value) => Number.isInteger(value)))].sort((left, right) => left - right)
    : Array.from({ length: bounds.maxY - bounds.minY + 1 }, (_, index) => bounds.minY + index);

  for (let x = bounds.minX; x <= bounds.maxX; x++) {
    for (let z = bounds.minZ; z <= bounds.maxZ + 2; z++) {
      for (const y of yLevels) {
        const signBlock = yield* readBlock({ x, y, z });
        if (signBlock?.typeId === "minecraft:oak_sign") {
          if (typeof signBlock.getComponent !== "function") {
            unreadable += 1;
          } else {
            let sign;
            try {
              sign = signBlock.getComponent("minecraft:sign");
            } catch (error) {
              unreadable += 1;
              continue;
            }
            if (!sign || typeof sign.getText !== "function") {
              unreadable += 1;
            } else {
              try {
                const anchor = inferYellowHallsPadAnchor(sign.getText(), { x, y, z });
                if (anchor) addAnchor(anchor);
              } catch (error) {
                unreadable += 1;
              }
            }
          }
        }

        if (signBlock?.typeId === "minecraft:stone_pressure_plate") {
          const support = yield* readBlock({ x, y: y - 1, z });
          const offset = support ? PAD_SUPPORT_OFFSETS[support.typeId] : undefined;
          if (!offset) continue;

          let completeFootprint = true;
          for (let dx = -1; dx <= 1 && completeFootprint; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
              const supportBlock = yield* readBlock({ x: x + dx, y: y - 1, z: z + dz });
              if (!supportBlock) {
                completeFootprint = false;
                break;
              }
              if (supportBlock.typeId !== support.typeId) {
                completeFootprint = false;
                break;
              }
            }
          }
          if (completeFootprint) {
            addAnchor({ x: x + offset.dx, y, z: z + offset.dz });
          }
        }
      }
    }
  }

  return { anchors, unreadable, complete: unreadable === 0 };
}

/**
 * @param {BlockBounds} left
 * @param {BlockBounds} right
 */
export function boundsOverlap(left, right) {
  return left.minX <= right.maxX && left.maxX >= right.minX &&
    left.minY <= right.maxY && left.maxY >= right.minY &&
    left.minZ <= right.maxZ && left.maxZ >= right.minZ;
}

/**
 * @param {{ x: number, y: number, z: number }} location
 * @param {BlockBounds[]} reservations
 */
export function isPositionReserved(location, reservations) {
  return reservations.some((bounds) =>
    location.x >= bounds.minX && location.x <= bounds.maxX &&
    location.y >= bounds.minY && location.y <= bounds.maxY &&
    location.z >= bounds.minZ && location.z <= bounds.maxZ,
  );
}

/**
 * Subtract inclusive reserved boxes from an inclusive fill box. Returned boxes
 * are pairwise disjoint and cover every unreserved cell exactly once.
 *
 * @param {BlockBounds} source
 * @param {BlockBounds[]} reservations
 * @returns {BlockBounds[]}
 */
export function subtractReservedVolumes(source, reservations) {
  let regions = [{ ...source }];

  for (const reservation of reservations) {
    const nextRegions = [];
    for (const region of regions) {
      if (!boundsOverlap(region, reservation)) {
        nextRegions.push(region);
        continue;
      }

      const intersection = {
        minX: Math.max(region.minX, reservation.minX),
        maxX: Math.min(region.maxX, reservation.maxX),
        minY: Math.max(region.minY, reservation.minY),
        maxY: Math.min(region.maxY, reservation.maxY),
        minZ: Math.max(region.minZ, reservation.minZ),
        maxZ: Math.min(region.maxZ, reservation.maxZ),
      };

      if (region.minX < intersection.minX) {
        nextRegions.push({ ...region, maxX: intersection.minX - 1 });
      }
      if (intersection.maxX < region.maxX) {
        nextRegions.push({ ...region, minX: intersection.maxX + 1 });
      }

      const middleX = { ...region, minX: intersection.minX, maxX: intersection.maxX };
      if (region.minY < intersection.minY) {
        nextRegions.push({ ...middleX, maxY: intersection.minY - 1 });
      }
      if (intersection.maxY < region.maxY) {
        nextRegions.push({ ...middleX, minY: intersection.maxY + 1 });
      }

      const middleY = { ...middleX, minY: intersection.minY, maxY: intersection.maxY };
      if (region.minZ < intersection.minZ) {
        nextRegions.push({ ...middleY, maxZ: intersection.minZ - 1 });
      }
      if (intersection.maxZ < region.maxZ) {
        nextRegions.push({ ...middleY, minZ: intersection.maxZ + 1 });
      }
    }
    regions = nextRegions;
    if (regions.length === 0) break;
  }

  return regions;
}
