/**
 * Pure selection rules for the Yellow Halls static renovation.
 *
 * Everything here is deterministic in its inputs so a patch repaints
 * identically after a rebuild, and so the rules are testable without a world.
 */

export const WALLPAPER_STATES = Object.freeze(["clean", "stained", "peeling", "water_damaged"]);
export const CARPET_STATES = Object.freeze(["base", "worn_path", "dark_stain"]);
export const CEILING_STATES = Object.freeze(["intact", "cracked"]);
export const FIXTURE_STATES = Object.freeze(["lit", "dim", "burned_out", "missing_tube"]);

export const FIXTURE_LIGHT = Object.freeze({ lit: 13, dim: 7, burned_out: 0, missing_tube: 6 });

const WEAR_SALT = 0x5948;

export function hash32(value) {
  let n = value | 0;
  n ^= n >>> 16;
  n = Math.imul(n, 0x7feb352d);
  n ^= n >>> 15;
  n = Math.imul(n, 0x846ca68b);
  n ^= n >>> 16;
  return n >>> 0;
}

export function hashCoords(x, z, salt = 0) {
  return hash32(
    Math.imul(x | 0, 0x8da6b343) ^
      Math.imul(z | 0, 0xd8163841) ^
      Math.imul(salt | 0, 0x9e3779b1),
  );
}

/** Target ratios: clean 68, stained 17, peeling 10, water-damaged 5. */
export function wearRoll(x, y, z) {
  return hashCoords(x, z, (y | 0) ^ WEAR_SALT) % 100;
}

/**
 * Wall state for one wall cell. Peeling only survives at corners or under a
 * vent and water damage only next to a vent wall or a corner at head height;
 * every rejected wear roll remaps to stained so the clean/stain split stays
 * inside the documented band.
 */
export function selectWallpaperState(x, y, z, options = {}) {
  const corner = options.isCorner === true;
  const vent = options.nearVent === true;
  const roll = wearRoll(x, y, z);
  if (roll < 68) return "clean";
  if (roll < 85) return "stained";
  if (roll < 95) return corner || vent ? "peeling" : "stained";
  return vent || corner ? "water_damaged" : "stained";
}

/** Floor state: worn along the connected route, dark stain on the shoulder. */
export function selectFloorState(x, z, options = {}) {
  if (options.onRoute === true) {
    return hashCoords(x, z, 11) % 4 === 0 ? "worn_path" : "base";
  }
  return hashCoords(x, z, 23) % 20 === 0 ? "dark_stain" : "base";
}

/** Every twentieth intact ceiling tile is cracked; failures come from the module. */
export function selectCeilingState(x, z) {
  return hashCoords(x, z, 17) % 20 === 0 ? "cracked" : "intact";
}

/**
 * Recessed fixture positions for one corridor leg. Fixtures sit every four
 * blocks along the leg axis; the turn-adjacent fixture is dim, and every second
 * leg burns one out while the neighbours inside four blocks stay lit.
 */
export function planLegFixtures(length, legOrdinal, options = {}) {
  const span = Math.max(0, Math.floor(Number(length) || 0));
  const ordinal = Math.max(0, Math.floor(Number(legOrdinal) || 0));
  const plan = [];
  for (let offset = 2; offset <= span - 2; offset += 4) {
    const atTurn = offset + 4 > span - 2;
    let state = "lit";
    if (atTurn) state = "dim";
    else if (ordinal % 2 === 1 && plan.length === 1) state = "burned_out";
    plan.push({ offset, state, axis: options.axis === "x" ? "x" : "z" });
  }
  return plan;
}

export function fixtureLight(state) {
  return FIXTURE_LIGHT[state] ?? 0;
}

export const DOORWAY_CELL = 1;

/** Ordered chain that guarantees two early turns in patch (1, 0). */
export const MOTIF_CHAIN = Object.freeze([
  { x: 0, z: 1, dir: "east" },
  { x: 1, z: 1, dir: "south" },
  { x: 1, z: 2, dir: "east" },
]);

export const MOTIF_INNER_CELLS = Object.freeze([{ x: 1, z: 1 }, { x: 1, z: 2 }]);

const OPPOSITE = Object.freeze({ north: "south", south: "north", east: "west", west: "east" });

/** @returns {{ x: number, z: number }} */
export function neighbor(x, z, dir) {
  if (dir === "north") return { x, z: z - 1 };
  if (dir === "south") return { x, z: z + 1 };
  if (dir === "east") return { x: x + 1, z };
  return { x: x - 1, z };
}

const DIRECTIONS = Object.freeze(["north", "south", "east", "west"]);

function links(cells, size) {
  let count = 0;
  for (let x = 0; x < size; x++) {
    for (let z = 0; z < size; z++) {
      const cell = cells[x][z];
      for (const dir of DIRECTIONS) {
        if (cell[dir]) count += 1;
      }
    }
  }
  return count;
}

function reachable(cells, size, startX, startZ) {
  const seen = new Set();
  seen.add(`${startX},${startZ}`);
  const stack = [{ x: startX, z: startZ }];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) break;
    const cell = cells[current.x][current.z];
    for (const dir of DIRECTIONS) {
      if (!cell[dir]) continue;
      const next = neighbor(current.x, current.z, dir);
      if (next.x < 0 || next.z < 0 || next.x >= size || next.z >= size) continue;
      const key = `${next.x},${next.z}`;
      if (seen.has(key)) continue;
      seen.add(key);
      stack.push(next);
    }
  }
  return seen;
}

function closeAllBut(cells, x, z, keep) {
  const cell = cells[x][z];
  const closed = [];
  for (const dir of DIRECTIONS) {
    if (keep.includes(dir) || !cell[dir]) continue;
    cell[dir] = false;
    const next = neighbor(x, z, dir);
    if (cells[next.x] && cells[next.x][next.z]) cells[next.x][next.z][OPPOSITE[dir]] = false;
    closed.push(dir);
  }
  return closed;
}

/**
 * Carve the recurring right-angle motif into an ordinary patch. The chain is
 * seeded first, the two inner cells are reduced to degree 2, and the result is
 * only accepted when every cell is still reachable from the arrival doorway.
 */
export function applyCorridorMotif(cells, size, patchX, patchZ) {
  if (cells.length !== size) return { cells, applied: false, reason: "size" };
  const before = links(cells, size);
  const keep = cells.map((column) => column.map((cell) => ({ ...cell })));

  for (const link of MOTIF_CHAIN) {
    const { x, z, dir } = link;
    if (x >= size || z >= size) return { cells, applied: false, reason: "outside" };
    keep[x][z][dir] = true;
    const next = neighbor(x, z, dir);
    if (next.x < 0 || next.z < 0 || next.x >= size || next.z >= size) {
      return { cells, applied: false, reason: "outside" };
    }
    keep[next.x][next.z][OPPOSITE[dir]] = true;
  }

  const kept = new Map();
  for (const inner of MOTIF_INNER_CELLS) {
    const { x, z } = inner;
    if (x >= size || z >= size) continue;
    const outbound = MOTIF_CHAIN.filter((link) => link.x === x && link.z === z).map((link) => link.dir);
    const inbound = MOTIF_CHAIN.filter((link) => {
      const target = neighbor(link.x, link.z, link.dir);
      return target.x === x && target.z === z;
    }).map((link) => OPPOSITE[link.dir]);
    kept.set(`${x},${z}`, closeAllBut(keep, x, z, [...outbound, ...inbound]));
  }

  // Repair: walk the remaining legal neighbour pairs in a seeded order and open
  // the ones that join a reached cell to an unreached one. The two inner cells
  // stay out of the repair set so their right angles survive.
  const frozen = new Set();
  for (const inner of MOTIF_INNER_CELLS) frozen.add(`${inner.x},${inner.z}`);
  const candidates = [];
  for (let x = 0; x < size; x++) {
    for (let z = 0; z < size; z++) {
      if (x < size - 1) candidates.push({ x, z, dir: "east" });
      if (z < size - 1) candidates.push({ x, z, dir: "south" });
    }
  }
  candidates.sort(
    (a, b) => hashCoords(a.x, a.z, a.dir === "east" ? 41 : 43) - hashCoords(b.x, b.z, b.dir === "east" ? 41 : 43),
  );
  let seen = reachable(keep, size, DOORWAY_CELL, 0);
  let repaired = 0;
  for (const candidate of candidates) {
    if (seen.size === size * size) break;
    const next = neighbor(candidate.x, candidate.z, candidate.dir);
    if (frozen.has(`${candidate.x},${candidate.z}`) || frozen.has(`${next.x},${next.z}`)) continue;
    const inside = seen.has(`${candidate.x},${candidate.z}`);
    const otherInside = seen.has(`${next.x},${next.z}`);
    if (inside === otherInside) continue;
    keep[candidate.x][candidate.z][candidate.dir] = true;
    keep[next.x][next.z][OPPOSITE[candidate.dir]] = true;
    repaired += 1;
    seen = reachable(keep, size, DOORWAY_CELL, 0);
  }
  if (seen.size < size * size) return { cells, applied: false, reason: "disconnected" };
  const after = links(keep, size);
  return {
    cells: keep,
    applied: true,
    reason: "ok",
    closedLinks: before - after,
    repairedLinks: repaired,
    closedSides: [...kept.values()].flat(),
  };
}

/** Eight authored scenery bays in patch-local coordinates (Y absolute). */
export const BAYS = Object.freeze([
  { bay: 1, x: 3, y: 65, z: 7, facing: "north", prop: "closed_office_door", sign: null },
  { bay: 2, x: 11, y: 65, z: 7, facing: "north", prop: "bricked_up_door", sign: null },
  { bay: 3, x: 19, y: 65, z: 7, facing: "north", prop: "closed_office_door", sign: "stairwell", signX: 20, signZ: 6 },
  { bay: 4, x: 27, y: 65, z: 7, facing: "north", prop: "maintenance_hatch", sign: "maintenance", signX: 28, signZ: 6 },
  { bay: 5, x: 3, y: 65, z: 16, facing: "south", prop: "bricked_up_door", sign: null },
  { bay: 6, x: 11, y: 65, z: 16, facing: "south", prop: "closed_office_door", sign: null, ventX: 12, ventZ: 17 },
  { bay: 7, x: 19, y: 65, z: 16, facing: "south", prop: null, sign: "archive", signX: 19, signZ: 17, archive: true },
  { bay: 8, x: 27, y: 65, z: 16, facing: "south", prop: "closed_office_door", sign: "exit", signX: 28, signZ: 17 },
]);

/** Breaker reservation: solid back plane plus an empty front volume. */
export const BREAKER_MOUNT = Object.freeze({
  backMin: [22, 66, 16],
  backMax: [23, 67, 16],
  frontMin: [22, 65, 17],
  frontMax: [23, 67, 18],
  patchX: 1,
  patchZ: 0,
});

/** Service conduit run around bay 3/4 and the fuse cabinet below it. */
export const CONDUIT_RUN = Object.freeze([
  { id: "conduit_straight", x: 25, y: 67, z: 6, variant: "iron" },
  { id: "conduit_elbow", x: 26, y: 67, z: 6, variant: "iron" },
  { id: "wall_junction", x: 27, y: 67, z: 6, variant: "iron" },
  { id: "conduit_end_cap", x: 29, y: 67, z: 6, variant: "iron" },
  { id: "fuse_cabinet", x: 26, y: 65, z: 6, variant: "plain" },
  { id: "return_air_vent", x: 12, y: 67, z: 17, variant: "iron" },
]);

/** Floor props in the wall lanes; frontage stays clear on the route. */
export const FLOOR_PROPS = Object.freeze([
  { id: "abandoned_desk", x: 25, y: 65, z: 20, facing: "north" },
  { id: "filing_cabinet", x: 1, y: 65, z: 5, facing: "east" },
  { id: "folding_chair", x: 10, y: 65, z: 20, facing: "north" },
  { id: "water_cooler", x: 13, y: 65, z: 5, facing: "north" },
  { id: "overturned_wastebasket", x: 9, y: 65, z: 18, facing: "north" },
  { id: "stacked_cardboard_boxes", x: 29, y: 65, z: 19, facing: "east" },
  { id: "small_debris", x: 2, y: 65, z: 20, facing: "north" },
  { id: "small_debris_charred", x: 3, y: 65, z: 9, facing: "north" },
]);

/** Wall-lane clutter that must never sit on the route columns. */
export const WALL_PROPS = Object.freeze([
  { id: "corridor_poster_normal", x: 9, y: 65, z: 6, facing: "north" },
  { id: "archive_directional_arrow", x: 17, y: 67, z: 17, facing: "north" },
  { id: "archive_sign", x: 19, y: 67, z: 17, facing: "north" },
  { id: "stairwell_sign_normal", x: 20, y: 67, z: 6, facing: "north" },
  { id: "maintenance_sign_normal", x: 28, y: 67, z: 6, facing: "north" },
  { id: "exit_sign_normal", x: 28, y: 67, z: 17, facing: "north" },
  { id: "return_air_vent", x: 12, y: 67, z: 17, facing: "north" },
]);

/** Distance in blocks between two lattice points. */
export function manhattan(ax, az, bx, bz) {
  return Math.abs(ax - bx) + Math.abs(az - bz);
}

/**
 * True when a corridor bay face is a live portal, which pushes its fake door to
 * the next inward parallel wall as the ticket requires.
 */
export function bayFaceIsPortal(cells, bay) {
  const cellX = Math.floor(bay.x / 8);
  const cellZ = Math.floor(bay.z / 8);
  const cell = cells[cellX]?.[cellZ];
  if (!cell) return false;
  if (bay.facing === "north") return cell.north === true;
  return cell.south === true;
}

export function bayDoorAnchor(bay, isPortal) {
  if (!isPortal) return { x: bay.x, y: bay.y, z: bay.z };
  const inwardZ = bay.facing === "north" ? 6 : 17;
  return { x: bay.x + 1, y: bay.y, z: inwardZ };
}
