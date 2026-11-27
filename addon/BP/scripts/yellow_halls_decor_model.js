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
  if (roll < 95) return corner || (vent && y === 66) ? "peeling" : "stained";
  return vent || (corner && y === 67) ? "water_damaged" : "stained";
}

/** Floor state: worn along the connected route, dark stain on the shoulder. */
export function selectFloorState(x, z, options = {}) {
  if (options.onRoute === true) {
    return hashCoords(x, z, 11) % 4 === 0 ? "worn_path" : "base";
  }
  return hashCoords(x, z, 23) % 20 === 0 ? "dark_stain" : "base";
}

/** True when a block cell belongs to one of the connected two-wide corridors. */
export function isRouteBlockPosition(maze, x, z, minX, minZ) {
  const localX = Math.floor(x - minX);
  const localZ = Math.floor(z - minZ);
  if (localX < 0 || localZ < 0 || localX >= maze.length * 8 || localZ >= maze.length * 8) return false;

  const cellX = Math.floor(localX / 8);
  const cellZ = Math.floor(localZ / 8);
  const cell = maze[cellX]?.[cellZ];
  if (!cell) return false;

  const dx = localX - cellX * 8;
  const dz = localZ - cellZ * 8;
  return (
    ((dx === 3 || dx === 4) && ((cell.north && dz <= 4) || (cell.south && dz >= 3))) ||
    ((dz === 3 || dz === 4) && ((cell.west && dx <= 4) || (cell.east && dx >= 3)))
  );
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

export function isBaySceneCell(patchX, patchZ, cellX, cellZ) {
  if (patchX !== 1 || patchZ !== 0) return false;
  return BAYS.some((bay) => Math.floor(bay.x / 8) === cellX && Math.floor(bay.z / 8) === cellZ);
}

export function isTurnBaffleEligible(patchX, patchZ, cellX, cellZ, cell) {
  if (!isOrthogonalTurn(cell)) return false;
  const isPatchPortal =
    (cellX === DOORWAY_CELL && (cellZ === 0 || cellZ === 3)) ||
    (cellZ === DOORWAY_CELL && (cellX === 0 || cellX === 3));
  if (isPatchPortal) return false;
  if (!isBaySceneCell(patchX, patchZ, cellX, cellZ)) return true;
  return patchX === 1 && patchZ === 0 && cellX === 1 && cellZ === 2;
}

export function isTurnBafflePosition(patchX, patchZ, maze, cellX, cellZ, blockX, blockZ, minX, minZ) {
  const cell = maze[cellX]?.[cellZ];
  if (!cell || !isTurnBaffleEligible(patchX, patchZ, cellX, cellZ, cell)) return false;
  const regions = planTurnBaffleRegions(cell, minX + cellX * 8, minZ + cellZ * 8);
  return regions.some((region) =>
    blockX >= region.minX &&
    blockX <= region.maxX &&
    blockZ >= region.minZ &&
    blockZ <= region.maxZ);
}

export function isProtectedMazeLoopEdge(x, z, direction, patchX, patchZ) {
  const next = neighbor(x, z, direction);
  const inBounds = (cellX, cellZ) => cellX >= 0 && cellZ >= 0 && cellX < 4 && cellZ < 4;
  const isReservedCell = (cellX, cellZ) =>
    MOTIF_INNER_CELLS.some((cell) => cell.x === cellX && cell.z === cellZ) ||
    isBaySceneCell(patchX, patchZ, cellX, cellZ);
  return (
    !inBounds(x, z) ||
    !inBounds(next.x, next.z) ||
    isReservedCell(x, z) ||
    isReservedCell(next.x, next.z)
  );
}

export function isModuleCellEligible(maze, patchX, patchZ, cellX, cellZ, options = {}) {
  const cell = maze[cellX]?.[cellZ];
  if (!cell || options.escape === true) return false;
  if (isBaySceneCell(patchX, patchZ, cellX, cellZ) || isOrthogonalTurn(cell)) return false;
  if (
    (cellX === DOORWAY_CELL && (cellZ === 0 || cellZ === 3)) ||
    (cellZ === DOORWAY_CELL && (cellX === 0 || cellX === 3))
  ) return false;
  const degree = DIRECTIONS.filter((direction) => cell[direction] === true).length;
  if (options.deadEndOnly === true && degree !== 1) return false;
  for (const direction of options.requiredClosedSides || []) {
    if (cell[direction] === true) return false;
  }
  for (const direction of options.requiredOpenSides || []) {
    if (cell[direction] !== true) return false;
  }
  if (options.requiresClosedSouth === true && cell.south) return false;
  return true;
}

export function moduleWorldBounds(spec, cellX, cellZ, patchMinX, patchMinZ, groundY = 64) {
  const origin = {
    x: patchMinX + cellX * 8 + spec.offset.x,
    y: groundY + spec.offset.y,
    z: patchMinZ + cellZ * 8 + spec.offset.z,
  };
  return {
    origin,
    minX: origin.x + spec.bounds.minX,
    maxX: origin.x + spec.bounds.maxX,
    minY: origin.y + spec.bounds.minY,
    maxY: origin.y + spec.bounds.maxY,
    minZ: origin.z + spec.bounds.minZ,
    maxZ: origin.z + spec.bounds.maxZ,
  };
}

export function boundsOverlap(left, right) {
  return (
    left.minX <= right.maxX &&
    left.maxX >= right.minX &&
    left.minY <= right.maxY &&
    left.maxY >= right.minY &&
    left.minZ <= right.maxZ &&
    left.maxZ >= right.minZ
  );
}

export function isBoundsClear(bounds, reservedBounds) {
  return reservedBounds.every((reserved) => !boundsOverlap(bounds, reserved));
}

export function orderModuleCandidates(candidates, seed) {
  return candidates.slice().sort((left, right) => {
    const difference =
      hashCoords(left.cx, left.cz, seed) - hashCoords(right.cx, right.cz, seed);
    return difference || left.cx - right.cx || left.cz - right.cz;
  });
}

/** Raised carpet is placed one block in from a corner only when both walls meet. */
export function planRaisedCarpetCorners(maze, minX, minZ) {
  const placements = [];
  const corners = [
    { first: "north", second: "west", dx: 1, dz: 1, facing: "north" },
    { first: "north", second: "east", dx: 6, dz: 1, facing: "east" },
    { first: "south", second: "east", dx: 6, dz: 6, facing: "south" },
    { first: "south", second: "west", dx: 1, dz: 6, facing: "west" },
  ];
  for (let cellX = 0; cellX < maze.length; cellX++) {
    for (let cellZ = 0; cellZ < maze[cellX].length; cellZ++) {
      const cell = maze[cellX][cellZ];
      for (const corner of corners) {
        if (cell[corner.first] || cell[corner.second]) continue;
        const x = minX + cellX * 8 + corner.dx;
        const z = minZ + cellZ * 8 + corner.dz;
        const roll = hashCoords(x, z, 29) % 20;
        placements.push({
          x,
          y: 65,
          z,
          facing: corner.facing,
          state: roll === 0 ? "dark" : hashCoords(x, z, 31) % 4 === 0 ? "worn" : "base",
        });
      }
    }
  }
  return placements;
}

function patchHash32(value) {
  let number = value | 0;
  number ^= number >>> 16;
  number = Math.imul(number, 0x7feb352d);
  number ^= number >>> 15;
  number = Math.imul(number, 0x846ca68b);
  number ^= number >>> 16;
  return number >>> 0;
}

function patchNoise(patchX, patchZ, runSeed) {
  const mixed =
    Math.imul(patchX | 0, 0x8da6b343) ^
    Math.imul(patchZ | 0, 0xd8163841) ^
    Math.imul(runSeed | 0, 0x9e3779b1) ^
    0x5f3759df;
  return patchHash32(mixed);
}

function patchRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pure, seed-stable 4×4 maze generation for deterministic qualification. */
export function generatePatchMaze(patchX, patchZ, runSeed) {
  const size = 4;
  const rng = patchRandom(patchNoise(patchX, patchZ, runSeed));
  const cells = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => ({ north: false, south: false, east: false, west: false })),
  );
  cells[DOORWAY_CELL][0].north = true;
  cells[DOORWAY_CELL][size - 1].south = true;
  cells[size - 1][DOORWAY_CELL].east = true;
  cells[0][DOORWAY_CELL].west = true;

  const visited = new Set();
  const key = (x, z) => `${x},${z}`;
  const getUnvisitedNeighbors = (x, z) => {
    const neighbors = [];
    if (x > 0 && !visited.has(key(x - 1, z))) neighbors.push({ x: x - 1, z, dir: "west" });
    if (x < size - 1 && !visited.has(key(x + 1, z))) neighbors.push({ x: x + 1, z, dir: "east" });
    if (z > 0 && !visited.has(key(x, z - 1))) neighbors.push({ x, z: z - 1, dir: "north" });
    if (z < size - 1 && !visited.has(key(x, z + 1))) neighbors.push({ x, z: z + 1, dir: "south" });
    return neighbors;
  };
  const openWall = (x, z, direction) => {
    const next = neighbor(x, z, direction);
    cells[x][z][direction] = true;
    cells[next.x][next.z][OPPOSITE[direction]] = true;
  };

  const startX = Math.floor(rng() * size);
  const startZ = Math.floor(rng() * size);
  const stack = [{ x: startX, z: startZ }];
  visited.add(key(startX, startZ));
  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const neighbors = getUnvisitedNeighbors(current.x, current.z);
    if (neighbors.length === 0) {
      stack.pop();
      continue;
    }
    const next = neighbors[Math.floor(rng() * neighbors.length)];
    openWall(current.x, current.z, next.dir);
    visited.add(key(next.x, next.z));
    stack.push(next);
  }

  for (let x = 0; x < size; x++) {
    for (let z = 0; z < size; z++) {
      if (x < size - 1 && rng() < 0.06 && !isProtectedMazeLoopEdge(x, z, "east", patchX, patchZ)) {
        openWall(x, z, "east");
        if (reachable(cells, size, DOORWAY_CELL, 0).size !== size * size) {
          cells[x][z].east = false;
          cells[x + 1][z].west = false;
        }
      }
      if (z < size - 1 && rng() < 0.06 && !isProtectedMazeLoopEdge(x, z, "south", patchX, patchZ)) {
        openWall(x, z, "south");
        if (reachable(cells, size, DOORWAY_CELL, 0).size !== size * size) {
          cells[x][z].south = false;
          cells[x][z + 1].north = false;
        }
      }
    }
  }

  const motif = applyCorridorMotif(cells, size, patchX, patchZ, runSeed);
  return motif.applied ? motif.cells : cells;
}

const DIRECTIONS = Object.freeze(["north", "south", "east", "west"]);

export function isOrthogonalTurn(cell) {
  const connected = DIRECTIONS.filter((direction) => cell?.[direction] === true);
  if (connected.length !== 2) return false;
  return (
    (connected.includes("north") && connected.includes("east")) ||
    (connected.includes("east") && connected.includes("south")) ||
    (connected.includes("south") && connected.includes("west")) ||
    (connected.includes("west") && connected.includes("north"))
  );
}

/** Two opaque wall regions for the N→E turn, rotated to the cell's links. */
export function planTurnBaffleRegions(cell, cellMinX, cellMinZ, cellSize = 8) {
  const connected = DIRECTIONS.filter((direction) => cell?.[direction] === true);
  if (!isOrthogonalTurn(cell) || cellSize !== 8) return [];

  const pair = connected.slice().sort().join(",");
  const rotations = new Map([
    ["east,north", 0],
    ["east,south", 1],
    ["south,west", 2],
    ["north,west", 3],
  ]);
  const rotation = rotations.get(pair);
  if (rotation === undefined) return [];

  const templates = [
    { minX: 1, maxX: 2, minZ: 2, maxZ: 5 },
    { minX: 5, maxX: 6, minZ: 1, maxZ: 2 },
  ];
  return templates.map((region) => {
    const points = [
      [region.minX, region.minZ],
      [region.maxX, region.minZ],
      [region.minX, region.maxZ],
      [region.maxX, region.maxZ],
    ].map(([x, z]) => {
      let nextX = x;
      let nextZ = z;
      for (let turn = 0; turn < rotation; turn++) {
        [nextX, nextZ] = [cellSize - 1 - nextZ, nextX];
      }
      return [nextX, nextZ];
    });
    const xs = points.map(([x]) => x);
    const zs = points.map(([, z]) => z);
    return {
      minX: cellMinX + Math.min(...xs),
      maxX: cellMinX + Math.max(...xs),
      minZ: cellMinZ + Math.min(...zs),
      maxZ: cellMinZ + Math.max(...zs),
    };
  });
}

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
export function applyCorridorMotif(cells, size, patchX, patchZ, runSeed = 0) {
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

  const reserveArchive = patchX === 1 && patchZ === 0 && size > 2;
  if (reserveArchive) {
    keep[2][1].south = false;
    keep[2][2].north = false;
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
  const edgeSeed = patchNoise(patchX, patchZ, runSeed);
  const edgeScore = (edge) => hashCoords(
    edge.x * size + edge.z,
    edge.dir === "east" ? 1 : 2,
    edgeSeed,
  );
  candidates.sort((left, right) =>
    edgeScore(left) - edgeScore(right) ||
    left.x - right.x ||
    left.z - right.z ||
    left.dir.localeCompare(right.dir),
  );

  const parent = Array.from({ length: size * size }, (_, index) => index);
  const rank = new Uint8Array(size * size);
  const cellIndex = (x, z) => x * size + z;
  const findRoot = (value) => {
    if (parent[value] !== value) parent[value] = findRoot(parent[value]);
    return parent[value];
  };
  const union = (left, right) => {
    let leftRoot = findRoot(left);
    let rightRoot = findRoot(right);
    if (leftRoot === rightRoot) return false;
    if (rank[leftRoot] < rank[rightRoot]) [leftRoot, rightRoot] = [rightRoot, leftRoot];
    parent[rightRoot] = leftRoot;
    if (rank[leftRoot] === rank[rightRoot]) rank[leftRoot] += 1;
    return true;
  };

  for (let x = 0; x < size; x++) {
    for (let z = 0; z < size; z++) {
      if (x < size - 1 && keep[x][z].east) union(cellIndex(x, z), cellIndex(x + 1, z));
      if (z < size - 1 && keep[x][z].south) union(cellIndex(x, z), cellIndex(x, z + 1));
    }
  }

  let repaired = 0;
  for (const candidate of candidates) {
    if (reserveArchive && candidate.x === 2 && candidate.z === 1 && candidate.dir === "south") continue;
    const next = neighbor(candidate.x, candidate.z, candidate.dir);
    if (frozen.has(`${candidate.x},${candidate.z}`) || frozen.has(`${next.x},${next.z}`)) continue;
    if (!union(cellIndex(candidate.x, candidate.z), cellIndex(next.x, next.z))) continue;
    keep[candidate.x][candidate.z][candidate.dir] = true;
    keep[next.x][next.z][OPPOSITE[candidate.dir]] = true;
    repaired += 1;
  }
  const seen = reachable(keep, size, DOORWAY_CELL, 0);
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
  // The two-block maintenance plate occupies X28..29; keep its end cap adjacent.
  { id: "conduit_end_cap", x: 30, y: 67, z: 6, variant: "iron" },
  { id: "fuse_cabinet", x: 26, y: 65, z: 6, variant: "plain" },
  { id: "return_air_vent", x: 12, y: 67, z: 17, variant: "iron" },
]);

/**
 * Structure side masks derived from the primary .mcstructure palette layer.
 * A side is reserved when the structure writes into either occupied player
 * cell (Y65/Y66) of the two-block-wide corridor opening on that side.
 */
export const MODULE_CLEARANCE = Object.freeze({
  service_recess: Object.freeze({
    requiredClosedSides: Object.freeze(["south"]),
    requiredOpenSides: Object.freeze([]),
  }),
  ceiling_failure: Object.freeze({
    requiredClosedSides: Object.freeze([]),
    requiredOpenSides: Object.freeze([]),
  }),
  maintenance_nook: Object.freeze({
    requiredClosedSides: Object.freeze(["south", "east"]),
    requiredOpenSides: Object.freeze([]),
  }),
  dead_end_landmark: Object.freeze({
    requiredClosedSides: Object.freeze(["south", "east", "west"]),
    requiredOpenSides: Object.freeze(["north"]),
  }),
});

export function advancePatchSeeds(patchSeeds, dirtyPatches, patchX, patchZ, radius, protectedPatches, defaultSeed = 0) {
  let changed = 0;
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      const nextX = patchX + dx;
      const nextZ = patchZ + dz;
      const key = `${nextX}:${nextZ}`;
      if (protectedPatches.has(key)) continue;
      patchSeeds.set(key, ((patchSeeds.get(key) ?? defaultSeed) + 1) | 0);
      dirtyPatches.add(key);
      changed += 1;
    }
  }
  return changed;
}

/** Floor props in the wall lanes; frontage stays clear on the route. */
export const FLOOR_PROPS = Object.freeze([
  { id: "abandoned_desk", x: 25, y: 65, z: 20, facing: "north", alternates: [{ x: 29, z: 22 }] },
  { id: "filing_cabinet", x: 1, y: 65, z: 5, facing: "east" },
  { id: "folding_chair", x: 13, y: 65, z: 22, facing: "north" },
  { id: "water_cooler", x: 13, y: 65, z: 5, facing: "north" },
  { id: "overturned_wastebasket", x: 14, y: 65, z: 21, facing: "north" },
  { id: "stacked_cardboard_boxes", x: 29, y: 65, z: 19, facing: "east" },
  { id: "small_debris", x: 2, y: 65, z: 20, facing: "north" },
  { id: "small_debris_charred", x: 3, y: 65, z: 9, facing: "north", alternates: [{ x: 1, z: 9 }] },
]);

/** Wall-lane clutter that must never sit on the route columns. */
export const WALL_PROPS = Object.freeze([
  { id: "corridor_poster_normal", x: 9, y: 65, z: 6, facing: "north" },
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
  // The facing points into the room, opposite the decorated wall.
  if (bay.facing === "north") return cell.south === true;
  return cell.north === true;
}

export function bayDoorAnchor(bay, isPortal) {
  if (!isPortal) return { x: bay.x, y: bay.y, z: bay.z };
  const inwardZ = bay.facing === "north" ? 6 : 17;
  return { x: bay.x - 2, y: bay.y, z: inwardZ };
}
