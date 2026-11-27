// Static Flat Flower scene definitions (Ticket 3). Pure data and hashing helpers
// so the painted world layout can be tested without a Bedrock runtime.

export const SCENE_SEED = 0x464c4154;

/** Inclusive world-space rectangles: [minX, maxX, minZ, maxZ]. */
export const SCENE_PATHS = Object.freeze([
  [0, 1, 2, 4], // arrival path X0..1 Z2..4
  [0, 5, 3, 4], // bend across X0..5 Z3..4
  [4, 5, 5, 15], // X4..5 Z5..15
  [4, 17, 14, 15], // cross X4..17 Z14..15
  [16, 17, 16, 23], // spur X16..17 Z16..23
  [16, 17, 24, 37], // gazebo to tree X16..17 Z24..37
  // Stop at X31: the authored tree owns its native stone wall at X32, and
  // the two-wide approach continues along X30..31 into the west entrance.
  [16, 31, 36, 37], // X16..31 Z36..37
  [30, 31, 36, 45], // tree approach X30..31 Z36..45
  [36, 37, 22, 33], // true north branch
  [18, 31, 44, 45], // west decoy branch
  [43, 55, 40, 41], // east decoy branch
  [30, 31, 32, 46], // tree ring west
  [43, 44, 32, 46], // tree ring east
  [30, 44, 32, 33], // tree ring north
  [30, 44, 45, 46], // tree ring south
]);

export const SCENE_ZONES = Object.freeze({
  dense: [3, 11, 20, 39],
  sparse: [22, 30, 27, 34],
  rows: [45, 53, 25, 35],
});

export const SCENE_GROUND = Object.freeze({
  shortGrass: "paradise:ff_field_ground_short_grass",
  flattened: "paradise:ff_field_ground_flattened_grass",
  dry: "paradise:ff_field_ground_dry_grass",
  bare: "paradise:ff_field_ground_bare_soil",
  path: "paradise:ff_field_ground_worn_footpath",
});

export const SCENE_FLOWERS = Object.freeze({
  dense: "paradise:ff_dense_flower_cluster",
  sparse: "paradise:ff_sparse_flower_cluster",
  bent: "paradise:ff_bent_flower_stems",
  wilted: "paradise:ff_wilted_flowers",
  rows: "paradise:ff_uniform_flower_rows",
  barePatch: "paradise:ff_bare_flower_patch",
});

/** Scene landmarks are placed once from the patch that contains their anchor. */
export const SCENE_LANDMARKS = Object.freeze([
  { id: "paradise:flat_flower/ruined_gazebo", x: 12, y: 65, z: 18 },
  { id: "paradise:flat_flower/lone_tree", x: 32, y: 65, z: 34 },
  { id: "paradise:flat_flower/flower_ring", x: 8, y: 65, z: 48 },
  { id: "paradise:flat_flower/distant_marker", x: 49, y: 65, z: 53 },
]);

/** One true route marker and two decoys of equal post height, distinct heads. */
export const SCENE_MARKERS = Object.freeze([
  {
    id: "true",
    segments: Object.freeze(["paradise:ff_true_route_marker_x0_y0_z0", "paradise:ff_true_route_marker_x0_y1_z0"]),
    x: 38,
    z: 22,
    trueRoute: true,
  },
  {
    id: "decoy_one",
    segments: Object.freeze(["paradise:ff_decoy_marker_one_x0_y0_z0", "paradise:ff_decoy_marker_one_x0_y1_z0"]),
    x: 18,
    z: 43,
    trueRoute: false,
  },
  {
    id: "decoy_two",
    segments: Object.freeze(["paradise:ff_decoy_marker_two_x0_y0_z0", "paradise:ff_decoy_marker_two_x0_y1_z0"]),
    x: 55,
    z: 42,
    trueRoute: false,
  },
]);

/**
 * Garden remnants around the ruined gazebo. Every piece sits in a wall/lawn
 * lane clear of the two-block footpaths and the gazebo footprint.
 */
export const SCENE_GARDEN_PROPS = Object.freeze([
  { block: "paradise:ff_standalone_garden_gate", x: 8, y: 65, z: 17, facing: "north" },
  { block: "paradise:ff_broken_picket_fence", x: 7, y: 65, z: 18, facing: "north" },
  { block: "paradise:ff_broken_picket_fence", x: 11, y: 65, z: 18, facing: "north" },
  { block: "paradise:ff_sun_bleached_notice", x: 11, y: 66, z: 18, facing: "north" },
  { block: "paradise:ff_abandoned_bench", x: 14, y: 65, z: 28, facing: "east" },
  { block: "paradise:ff_rusted_watering_can_x0_y0_z0", x: 13, y: 65, z: 29, facing: "north" },
  { block: "paradise:ff_empty_flowerbed", x: 12, y: 65, z: 26, facing: "north" },
  { block: "paradise:ff_empty_flowerbed", x: 13, y: 65, z: 26, facing: "north" },
  { block: "paradise:ff_loose_paving_stone", x: 15, y: 65, z: 24, facing: "north" },
  { block: "paradise:ff_loose_paving_stone", x: 18, y: 65, z: 27, facing: "north" },
  { block: "paradise:ff_collapsed_trellis", x: 21, y: 65, z: 29, facing: "north" },
  { block: "paradise:ff_overturned_planter", x: 22, y: 65, z: 30, facing: "north" },
  // The west-side weathered post ledger slot (20,45) occupies the two-wide
  // decoy path itself; leave that path clear pending a revised supported slot.
  { block: "paradise:ff_weathered_post_x0_y0_z0", x: 49, y: 65, z: 42, facing: "north" },
  { block: "paradise:ff_weathered_post_x0_y1_z0", x: 49, y: 66, z: 42, facing: "north" },
]);

const GAZEBO_ORIGIN = Object.freeze({ x: 12, y: 65, z: 18 });
const TREE_ORIGIN = Object.freeze({ x: 32, y: 65, z: 34 });

export const SCENE_LANDMARK_DRESS = Object.freeze([
  ...[1, 10].flatMap((x) => [1, 10].flatMap((z) => [0, 2, 4].flatMap((y) => [
    { block: "paradise:ff_ruined_gazebo_post_x0_y0_z0", x: GAZEBO_ORIGIN.x + x, y: GAZEBO_ORIGIN.y + y, z: GAZEBO_ORIGIN.z + z, facing: "north", landmark: SCENE_LANDMARKS[0].id },
    { block: "paradise:ff_ruined_gazebo_post_x0_y1_z0", x: GAZEBO_ORIGIN.x + x, y: GAZEBO_ORIGIN.y + y + 1, z: GAZEBO_ORIGIN.z + z, facing: "north", landmark: SCENE_LANDMARKS[0].id },
    { block: "paradise:ff_ruined_gazebo_post_x1_y1_z0", x: GAZEBO_ORIGIN.x + x + 1, y: GAZEBO_ORIGIN.y + y + 1, z: GAZEBO_ORIGIN.z + z, facing: "north", landmark: SCENE_LANDMARKS[0].id },
  ]))),
  ...[2, 3, 8, 9].map((x, index) => ({
    block: index % 2 === 0 ? "paradise:ff_ruined_gazebo_rail_x0_y0_z0" : "paradise:ff_ruined_gazebo_rail_x1_y0_z0",
    x: GAZEBO_ORIGIN.x + x, y: 66, z: 19, facing: "north", landmark: SCENE_LANDMARKS[0].id,
  })),
  { block: "paradise:ff_ruined_gazebo_roof", x: 13, y: 71, z: 19, facing: "north", landmark: SCENE_LANDMARKS[0].id },
  { block: "paradise:ff_ruined_gazebo_roof", x: 21, y: 71, z: 28, facing: "south", landmark: SCENE_LANDMARKS[0].id },
  ...[ [0, 0, 3], [1, 0, 3], [0, 0, 4], [1, 0, 4] ].map(([x, y, z]) => ({
    block: `paradise:ff_lone_tree_surround_x${x}_y${y}_z${z - 3}`,
    x: TREE_ORIGIN.x + x, y: TREE_ORIGIN.y + y, z: TREE_ORIGIN.z + z,
    facing: "north", landmark: SCENE_LANDMARKS[1].id,
  })),
  { block: "paradise:ff_low_stone_border", x: 35, y: 65, z: 34, facing: "north", landmark: SCENE_LANDMARKS[1].id },
  { block: "paradise:ff_low_stone_border", x: 39, y: 65, z: 44, facing: "north", landmark: SCENE_LANDMARKS[1].id },
]);

export const SCENE_STRUCTURE_SIZES = Object.freeze({
  "paradise:flat_flower/ruined_gazebo": [12, 8, 12],
  "paradise:flat_flower/lone_tree": [11, 12, 11],
  "paradise:flat_flower/flower_ring": [9, 2, 9],
  "paradise:flat_flower/distant_marker": [7, 11, 7],
});

/** Gardener's route marker: exactly one true head and two equal-height decoys. */
export function markerTopY(baseY) {
  return baseY + 1;
}

export const SCENE_BOUNDS = Object.freeze({ minX: 0, maxX: 55, minZ: 2, maxZ: 53 });

export function inScene(x, z) {
  return x >= SCENE_BOUNDS.minX && x <= SCENE_BOUNDS.maxX
    && z >= SCENE_BOUNDS.minZ && z <= SCENE_BOUNDS.maxZ;
}

export function inRect(x, z, rect) {
  return x >= rect[0] && x <= rect[1] && z >= rect[2] && z <= rect[3];
}

export function isScenePath(x, z) {
  for (const rect of SCENE_PATHS) {
    if (inRect(x, z, rect)) return true;
  }
  return false;
}

/** Deterministic 0..99 roll per column, matching the visual hash seed. */
export function sceneRoll(x, z) {
  let value = Math.imul(x | 0, 0x8da6b343)
    ^ Math.imul(z | 0, 0xd8163841)
    ^ Math.imul(SCENE_SEED, 0x9e3779b1);
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return (value >>> 0) % 100;
}

/** Ground block for a scene column, or null outside the authored scene. */
export function sceneGround(x, z) {
  if (!inScene(x, z)) return null;
  if (isScenePath(x, z)) return SCENE_GROUND.path;
  if ((x >= 23 && x <= 25 && z >= 29 && z <= 31)
    || (inRect(x, z, SCENE_ZONES.rows)
      && !((z === 26 || z === 29 || z === 32) && x >= 45 && (x - 45) % 3 === 0))) {
    return SCENE_FLOWERS.barePatch;
  }
  const roll = sceneRoll(x, z);
  if (roll < 55) return SCENE_GROUND.shortGrass;
  if (roll < 75) return SCENE_GROUND.flattened;
  if (roll < 90) return SCENE_GROUND.dry;
  return SCENE_GROUND.bare;
}

/** Flower/debris block for a scene column, or null for bare soil and paths. */
export function sceneFlower(x, z) {
  if (!inScene(x, z) || isScenePath(x, z)) return null;
  const roll = sceneRoll(x, z);

  if (inRect(x, z, SCENE_ZONES.dense)) {
    return roll < 70 ? SCENE_FLOWERS.dense : null;
  }

  if (inRect(x, z, SCENE_ZONES.sparse)) {
    if (roll < 25) return SCENE_FLOWERS.sparse;
    if (roll < 35) return SCENE_FLOWERS.bent;
    if (roll < 40) return SCENE_FLOWERS.wilted;
    return null;
  }

  if (inRect(x, z, SCENE_ZONES.rows)) {
    if ((z === 26 || z === 29 || z === 32) && x >= 45 && (x - 45) % 3 === 0) {
      return SCENE_FLOWERS.rows;
    }
    return null;
  }
  return null;
}

export function sceneStructurePatches(landmark, patchSize = 32) {
  const [sizeX, , sizeZ] = SCENE_STRUCTURE_SIZES[landmark.id];
  const result = [];
  for (let x = Math.floor(landmark.x / patchSize); x <= Math.floor((landmark.x + sizeX - 1) / patchSize); x++) {
    for (let z = Math.floor(landmark.z / patchSize); z <= Math.floor((landmark.z + sizeZ - 1) / patchSize); z++) {
      result.push(`${x}:${z}`);
    }
  }
  return result;
}

export function isAuthoredScenePatch(patchX, patchZ) {
  return patchX >= 0 && patchX <= 1 && patchZ >= 0 && patchZ <= 1;
}

/** Split the patch into rectangles that do not touch any protected native pad. */
export function unreservedPatchRectangles(minX, minZ, maxX, maxZ, protectedCenters) {
  if (protectedCenters.length === 0) return [[minX, maxX, minZ, maxZ]];
  const rectangles = [];
  let previousRuns = new Map();
  for (let z = minZ; z <= maxZ; z++) {
    const runs = new Map();
    let start = null;
    for (let x = minX; x <= maxX + 1; x++) {
      const reserved = x > maxX || protectedCenters.some((center) =>
        Math.abs(x - center.x) <= 1 && Math.abs(z - center.z) <= 1
        || x === center.x && z === center.z + 2);
      if (!reserved && start === null) start = x;
      if (reserved && start !== null) {
        const key = `${start}:${x - 1}`;
        const previous = previousRuns.get(key);
        if (previous) {
          previous[3] = z;
          runs.set(key, previous);
        } else {
          runs.set(key, [start, x - 1, z, z]);
        }
        start = null;
      }
    }
    for (const [key, rect] of previousRuns) {
      if (!runs.has(key)) rectangles.push(rect);
    }
    previousRuns = runs;
  }
  rectangles.push(...previousRuns.values());
  return rectangles;
}

/** True when the patch owns the landmark anchor and should place it. */
export function landmarkInPatch(landmark, minX, minZ, maxX, maxZ) {
  return landmark.x >= minX && landmark.x <= maxX && landmark.z >= minZ && landmark.z <= maxZ;
}
