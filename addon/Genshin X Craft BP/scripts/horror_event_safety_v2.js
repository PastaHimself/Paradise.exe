function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function floorLocation(location) {
  return {
    x: Math.floor(finite(location?.x)),
    y: Math.floor(finite(location?.y)),
    z: Math.floor(finite(location?.z)),
  };
}

function normalizedHorizontal(vector, fallback) {
  const x = finite(vector?.x, fallback.x);
  const z = finite(vector?.z, fallback.z);
  const length = Math.hypot(x, z);
  if (length < 0.0001) return { ...fallback };
  return { x: x / length, y: 0, z: z / length };
}

function locationKey(location) {
  return `${location.x},${location.y},${location.z}`;
}

function pushUnique(points, seen, location) {
  const floored = floorLocation(location);
  const key = locationKey(floored);
  if (seen.has(key) || points.length >= 64) return;
  seen.add(key);
  points.push(floored);
}

function centerOrder(half) {
  const values = [0];
  for (let distance = 1; distance <= half; distance++) values.push(-distance, distance);
  return values;
}

const GRAVITY_BLOCKS = new Set([
  'minecraft:sand', 'minecraft:red_sand', 'minecraft:gravel',
  'minecraft:suspicious_sand', 'minecraft:suspicious_gravel',
  'minecraft:dragon_egg', 'minecraft:anvil', 'minecraft:chipped_anvil', 'minecraft:damaged_anvil',
  ...[
    'white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray',
    'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black',
  ].map((color) => `minecraft:${color}_concrete_powder`),
]);

const CASCADE_UNSAFE_TARGETS = new Set([
  ...GRAVITY_BLOCKS,
  'minecraft:glass', 'minecraft:tinted_glass', 'minecraft:ice', 'minecraft:packed_ice', 'minecraft:blue_ice',
  'minecraft:redstone_torch', 'minecraft:redstone_wall_torch',
]);

const SUPPORT_DEPENDENT_FRAGMENTS = Object.freeze([
  'torch', 'lantern', 'ladder', 'vine', 'rail', 'redstone', 'tripwire', 'lever', 'button',
  'pressure_plate', 'carpet', 'snow_layer', 'flower', 'sapling', 'mushroom', 'crop', 'wheat',
  'carrot', 'potato', 'beetroot', 'stem', 'sugar_cane', 'cactus', 'bamboo', 'pointed_dripstone',
  'hanging_roots', 'glow_lichen', 'sculk_vein', 'candle', 'sign', 'banner', 'bell',
  'amethyst_cluster', '_bud', 'coral', 'sea_pickle', 'turtle_egg', 'frogspawn', '_door',
  'trapdoor', 'fence_gate', 'wall_skull', 'wall_head', 'flower_pot', 'brewing_stand', 'lectern',
]);

/**
 * Returns true when removing/replacing a target could trigger vanilla neighbor updates
 * outside the event's explicit block budget.
 */
export function hasCascadeRisk(targetTypeId, neighbors = []) {
  const targetId = String(targetTypeId || '');
  if (CASCADE_UNSAFE_TARGETS.has(targetId)) return true;

  for (const neighbor of neighbors || []) {
    const id = String(neighbor?.typeId || '');
    if (neighbor?.isLiquid || id === 'minecraft:water' || id === 'minecraft:flowing_water' || id === 'minecraft:lava' || id === 'minecraft:flowing_lava') {
      return true;
    }
    if (GRAVITY_BLOCKS.has(id)) return true;
    if (SUPPORT_DEPENDENT_FRAGMENTS.some((fragment) => id.includes(fragment))) return true;
  }
  return false;
}

/**
 * Atomically reserves exactly `requiredCount` unique targets. If a full set cannot
 * be obtained, the reservation set is left unchanged.
 */
export function reserveExactTargets(targets, reserved, requiredCount) {
  const required = Math.max(0, Math.floor(finite(requiredCount)));
  if (required === 0) return [];
  const chosen = [];
  const localKeys = new Set();
  for (const target of targets || []) {
    const location = target?.location;
    if (!location) continue;
    const key = locationKey(floorLocation(location));
    if (reserved?.has(key) || localKeys.has(key)) continue;
    localKeys.add(key);
    chosen.push(target);
    if (chosen.length >= required) break;
  }
  if (chosen.length !== required) return [];
  if (reserved) for (const key of localKeys) reserved.add(key);
  return chosen;
}

/** Returns true when an entity AABB overlaps a single block cell. */
export function aabbIntersectsBlockCell(aabb, location) {
  if (!aabb?.center || !aabb?.extent || !location) return true;
  const cell = floorLocation(location);
  const min = {
    x: finite(aabb.center.x) - Math.abs(finite(aabb.extent.x)),
    y: finite(aabb.center.y) - Math.abs(finite(aabb.extent.y)),
    z: finite(aabb.center.z) - Math.abs(finite(aabb.extent.z)),
  };
  const max = {
    x: finite(aabb.center.x) + Math.abs(finite(aabb.extent.x)),
    y: finite(aabb.center.y) + Math.abs(finite(aabb.extent.y)),
    z: finite(aabb.center.z) + Math.abs(finite(aabb.extent.z)),
  };
  return max.x > cell.x && min.x < cell.x + 1
    && max.y > cell.y && min.y < cell.y + 1
    && max.z > cell.z && min.z < cell.z + 1;
}

/**
 * Restores a saved world mutation only after its chunk is available.
 * A changed block is treated as an intentional player/world edit and is never overwritten.
 */
export function tryRestoreRecord(record, adapter = {}) {
  if (!record || record.restored) return 'done';
  try {
    if (!adapter.isLoaded?.(record.location)) return 'pending';
    const current = adapter.getBlock?.(record.location);
    if (!current) return 'pending';

    if (record.expectedTypeIds && !record.expectedTypeIds.has(current.typeId)) {
      record.restored = true;
      record.abandoned = true;
      return 'abandoned';
    }

    if (record.permutation) {
      if (typeof adapter.setPermutation !== 'function') return 'pending';
      adapter.setPermutation(record.location, record.permutation);
    } else if (record.restoreTypeId) {
      if (typeof adapter.setType !== 'function') return 'pending';
      adapter.setType(record.location, record.restoreTypeId);
    } else {
      record.restored = true;
      return 'abandoned';
    }

    record.restored = true;
    return 'restored';
  } catch (_error) {
    return 'pending';
  }
}

export function isLocationClearOfPlayers(location, dimensionId, players, radius = 3) {
  const r2 = Math.max(0, finite(radius, 3)) ** 2;
  for (const player of players || []) {
    if (!player || player.dimensionId !== dimensionId) continue;
    const dx = finite(player.location?.x) - finite(location?.x);
    const dy = finite(player.location?.y) - finite(location?.y);
    const dz = finite(player.location?.z) - finite(location?.z);
    if (dx * dx + dy * dy + dz * dz <= r2) return false;
  }
  return true;
}

/**
 * Generates a deliberately small set of candidate cells for an authored geometry.
 * Candidates are ordered center-first so low block budgets produce centered shapes.
 */
export function geometryCandidates(center, geometry, basis = {}, radius = 4) {
  const origin = floorLocation(center);
  const forward = normalizedHorizontal(basis.forward, { x: 0, y: 0, z: 1 });
  const right = normalizedHorizontal(basis.right, { x: -forward.z, y: 0, z: forward.x });
  const r = Math.max(1, Math.min(6, Math.floor(finite(radius, 4))));
  const points = [];
  const seen = new Set();

  const offset = (base, a, aScale, b, bScale, y = 0) => ({
    x: base.x + a.x * aScale + b.x * bScale,
    y: base.y + y,
    z: base.z + a.z * aScale + b.z * bScale,
  });

  switch (geometry) {
    case 'wall': {
      const half = Math.min(3, r);
      const sideOrder = centerOrder(half);
      const yOrder = [0, 1, -1, 2];
      for (const y of yOrder) for (const side of sideOrder) pushUnique(points, seen, offset(origin, right, side, forward, 0, y));
      break;
    }
    case 'ceiling':
    case 'floor':
    case 'surface': {
      const half = geometry === 'floor' ? Math.min(2, r) : Math.min(3, r);
      const order = centerOrder(half);
      for (const f of order) for (const side of order) pushUnique(points, seen, offset(origin, forward, f, right, side, 0));
      break;
    }
    case 'path': {
      const length = Math.min(6, r + 2);
      const forwardOrder = [0, 1, -1];
      for (let f = 2; f <= length; f++) forwardOrder.push(f);
      for (const f of forwardOrder) for (const side of [0, -1, 1]) pushUnique(points, seen, offset(origin, forward, f, right, side, 0));
      break;
    }
    case 'doorway': {
      const half = Math.min(3, r);
      const order = centerOrder(half);
      for (const f of order) for (const side of order) for (const y of [0, 1, -1, 2]) pushUnique(points, seen, offset(origin, forward, f, right, side, y));
      break;
    }
    case 'light': {
      const half = Math.min(1, r);
      const order = centerOrder(half);
      for (const y of [0, 1, -1, 2, -2]) for (const f of order) for (const side of order) pushUnique(points, seen, offset(origin, forward, f, right, side, y));
      break;
    }
    default:
      pushUnique(points, seen, origin);
      break;
  }

  return points;
}
