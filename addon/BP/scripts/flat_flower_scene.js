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
  [16, 33, 36, 37], // X16..33 Z36..37
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
  { block: "paradise:ff_standalone_garden_gate", x: 9, z: 16, facing: "east" },
  { block: "paradise:ff_abandoned_bench", x: 7, z: 19, facing: "east" },
  { block: "paradise:ff_broken_picket_fence", x: 15, z: 21, facing: "north" },
  { block: "paradise:ff_collapsed_trellis", x: 18, z: 18, facing: "west" },
  { block: "paradise:ff_overturned_planter", x: 10, z: 21, facing: "north" },
  { block: "paradise:ff_rusted_watering_can_x0_y0_z0", x: 6, z: 17, facing: "east" },
  { block: "paradise:ff_empty_flowerbed", x: 6, z: 22, facing: "north" },
  { block: "paradise:ff_low_stone_border", x: 13, z: 13, facing: "north" },
  { block: "paradise:ff_loose_paving_stone", x: 9, z: 13, facing: "north" },
  { block: "paradise:ff_sun_bleached_notice", x: 12, z: 13, facing: "north" },
]);

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
  let h = (x | 0) * 374761393 + (z | 0) * 668265263 + SCENE_SEED;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return Math.abs(h) % 100;
}

/** Ground block for a scene column, or null outside the authored scene. */
export function sceneGround(x, z) {
  if (!inScene(x, z)) return null;
  if (isScenePath(x, z)) return SCENE_GROUND.path;
  const roll = sceneRoll(x, z);
  if (roll < 55) return SCENE_GROUND.shortGrass;
  if (roll < 75) return SCENE_GROUND.flattened;
  if (roll < 90) return SCENE_GROUND.dry;
  return SCENE_GROUND.bare;
}

/** Flower/debris block for a scene column, or null for bare soil and paths. */
export function sceneFlower(x, z) {
  if (!inScene(x, z) || isScenePath(x, z)) return null;
  const ground = sceneGround(x, z);
  const roll = sceneRoll(x, z);

  if (inRect(x, z, SCENE_ZONES.dense)) {
    return roll < 70 ? SCENE_FLOWERS.dense : SCENE_FLOWERS.barePatch;
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
    return ground === SCENE_GROUND.bare ? SCENE_FLOWERS.barePatch : null;
  }

  if (ground === SCENE_GROUND.bare) return SCENE_FLOWERS.barePatch;
  return null;
}

/** True when the patch owns the landmark anchor and should place it. */
export function landmarkInPatch(landmark, minX, minZ, maxX, maxZ) {
  return landmark.x >= minX && landmark.x <= maxX && landmark.z >= minZ && landmark.z <= maxZ;
}
