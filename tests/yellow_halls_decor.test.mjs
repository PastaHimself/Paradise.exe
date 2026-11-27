import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { describe, it } from "node:test";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

import * as model from "../addon/BP/scripts/yellow_halls_decor_model.js";

const serverMock = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@minecraft/server") {
      return {
        url: "data:text/javascript,export const BlockPermutation = { resolve: (typeId, states) => ({ typeId, states }) };",
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});
const { applyYellowHallsDressing, applyYellowHallsScenery, applyYellowHallsSurfaces, applyYellowHallsFixtures, applyYellowHallsTurnBaffles, collectWallCells, placeSegments, PROP_IDS, CARPET, CARPET_CORNERS, WALLPAPER } = await import(
  "../addon/BP/scripts/yellow_halls_decor.js"
);
serverMock.deregister();

function recordingDimension() {
  const writes = [];
  return {
    writes,
    getBlock(position) {
      return {
        setPermutation(permutation) {
          writes.push({ ...position, ...permutation });
        },
      };
    },
  };
}

function hasTwoWidePortalConnectivity(patchX, patchZ, maze) {
  const patchSize = 32;
  const cellSize = 8;
  const blocked = new Uint8Array(patchSize * patchSize);
  const setBlocked = (x, z) => {
    if (x >= 0 && x < patchSize && z >= 0 && z < patchSize) blocked[z * patchSize + x] = 1;
  };

  for (let cellX = 0; cellX < maze.length; cellX++) {
    for (let cellZ = 0; cellZ < maze[cellX].length; cellZ++) {
      const cell = maze[cellX][cellZ];
      const minX = cellX * cellSize;
      const minZ = cellZ * cellSize;
      for (let offset = 0; offset < cellSize; offset++) {
        if (!cell.north || offset < 3 || offset > 4) setBlocked(minX + offset, minZ);
        if (!cell.south || offset < 3 || offset > 4) setBlocked(minX + offset, minZ + 7);
        if (!cell.west || offset < 3 || offset > 4) setBlocked(minX, minZ + offset);
        if (!cell.east || offset < 3 || offset > 4) setBlocked(minX + 7, minZ + offset);
      }

      if (model.isTurnBaffleEligible(patchX, patchZ, cellX, cellZ, cell)) {
        for (const region of model.planTurnBaffleRegions(cell, minX, minZ)) {
          for (let x = region.minX; x <= region.maxX; x++) {
            for (let z = region.minZ; z <= region.maxZ; z++) setBlocked(x, z);
          }
        }
      }
    }
  }

  const isTwoByTwoClear = (x, z) => {
    if (x < 0 || z < 0 || x + 1 >= patchSize || z + 1 >= patchSize) return false;
    return blocked[z * patchSize + x] === 0 &&
      blocked[z * patchSize + x + 1] === 0 &&
      blocked[(z + 1) * patchSize + x] === 0 &&
      blocked[(z + 1) * patchSize + x + 1] === 0;
  };

  const start = [11, 0];
  if (!isTwoByTwoClear(...start)) return false;
  const visited = new Uint8Array((patchSize - 1) * (patchSize - 1));
  const queue = [start];
  const indexOf = (x, z) => z * (patchSize - 1) + x;
  visited[indexOf(...start)] = 1;
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  for (let head = 0; head < queue.length; head++) {
    const [x, z] = queue[head];
    for (const [dx, dz] of directions) {
      const nextX = x + dx;
      const nextZ = z + dz;
      if (!isTwoByTwoClear(nextX, nextZ)) continue;
      const nextIndex = indexOf(nextX, nextZ);
      if (visited[nextIndex] === 1) continue;
      visited[nextIndex] = 1;
      queue.push([nextX, nextZ]);
    }
  }

  return [[11, 30], [0, 11], [30, 11]].every(([x, z]) => visited[indexOf(x, z)] === 1);
}

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function seededCells(size, seed = 7) {
  const cells = [];
  for (let x = 0; x < size; x += 1) {
    cells[x] = [];
    for (let z = 0; z < size; z += 1) {
      cells[x][z] = { north: false, south: false, east: false, west: false };
    }
  }
  // A spanning corridor plus the four patch portals.
  for (let x = 0; x < size - 1; x += 1) {
    cells[x][3].east = true;
    cells[x + 1][3].west = true;
  }
  for (let z = 0; z < size - 1; z += 1) {
    cells[0][z].south = true;
    cells[0][z + 1].north = true;
  }
  cells[1][0].north = true;
  cells[1][size - 1].south = true;
  cells[size - 1][1].east = true;
  cells[0][1].west = true;
  // Fill the rest so the graph stays connected the way a generated patch is.
  for (let x = 0; x < size; x += 1) {
    for (let z = 0; z < size; z += 1) {
      if ((x * 31 + z * 17 + seed) % 5 !== 0) continue;
      if (x < size - 1) {
        cells[x][z].east = true;
        cells[x + 1][z].west = true;
      }
      if (z < size - 1) {
        cells[x][z].south = true;
        cells[x][z + 1].north = true;
      }
    }
  }
  return cells;
}

function reachableCount(cells, size) {
  const seen = new Set(["1,0"]);
  const stack = [[1, 0]];
  while (stack.length > 0) {
    const [x, z] = stack.pop();
    const cell = cells[x][z];
    for (const [open, nx, nz] of [
      [cell.north, x, z - 1],
      [cell.south, x, z + 1],
      [cell.west, x - 1, z],
      [cell.east, x + 1, z],
    ]) {
      if (!open || nx < 0 || nz < 0 || nx >= size || nz >= size) continue;
      const key = `${nx},${nz}`;
      if (seen.has(key)) continue;
      seen.add(key);
      stack.push([nx, nz]);
    }
  }
  return seen.size;
}

function shortestCellPath(cells, start, target) {
  const queue = [{ point: start, path: [start] }];
  const visited = new Set([`${start[0]},${start[1]}`]);
  const directions = [
    ["north", 0, -1],
    ["south", 0, 1],
    ["east", 1, 0],
    ["west", -1, 0],
  ];
  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head];
    if (current.point[0] === target[0] && current.point[1] === target[1]) return current.path;
    const [x, z] = current.point;
    for (const [direction, dx, dz] of directions) {
      if (!cells[x][z][direction]) continue;
      const next = [x + dx, z + dz];
      if (next[0] < 0 || next[1] < 0 || next[0] >= cells.length || next[1] >= cells.length) continue;
      const key = `${next[0]},${next[1]}`;
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push({ point: next, path: [...current.path, next] });
    }
  }
  return undefined;
}

function degrees(cells, size) {
  const result = [];
  for (let x = 0; x < size; x += 1) {
    for (let z = 0; z < size; z += 1) {
      const cell = cells[x][z];
      result.push([cell.north, cell.south, cell.east, cell.west].filter(Boolean).length);
    }
  }
  return result;
}

describe("yellow halls wear surfaces", () => {
  it("covers both interior wall faces without painting across open portals", () => {
    const maze = [
      [{ north: false, south: true, east: true, west: false }, { north: true, south: false, east: false, west: false }],
      [{ north: false, south: false, east: false, west: true }, { north: false, south: false, east: false, west: false }],
    ];
    const wallCells = new Set(collectWallCells(maze, -32, -16).map(({ x, z }) => `${x},${z}`));
    for (const [x, z] of [[7, 2], [8, 2], [2, 7], [2, 8], [7, 11], [8, 11]]) {
      assert.ok(wallCells.has(`${x - 32},${z - 16}`), `missing wall at ${x},${z}`);
    }
    for (const [x, z] of [[7, 3], [8, 3], [7, 4], [8, 4], [3, 7], [3, 8], [4, 7], [4, 8]]) {
      assert.ok(!wallCells.has(`${x - 32},${z - 16}`), `blocked portal at ${x},${z}`);
    }
  });

  it("keeps the entire floor carpeted and confines route wear to the connected strips", () => {
    const dimension = recordingDimension();
    const cell = { north: true, south: false, east: true, west: false };
    applyYellowHallsSurfaces(dimension, 0, 0, [[cell]], -8, -8);
    const floor = new Map(dimension.writes.filter(({ y }) => y === 64)
      .map(({ x, z, typeId }) => [`${x},${z}`, typeId]));
    assert.equal(floor.size, 64);
    for (let x = 0; x < 8; x++) {
      for (let z = 0; z < 8; z++) {
        const onRoute = (x >= 3 && x <= 4 && z <= 4) || (z >= 3 && z <= 4 && x >= 3);
        assert.equal(floor.get(`${x - 8},${z - 8}`),
          CARPET[model.selectFloorState(x - 8, z - 8, { onRoute })]);
      }
    }
    assert.ok(dimension.writes.filter(({ typeId }) => Object.values(WALLPAPER).includes(typeId))
      .every(({ y }) => y >= 65 && y <= 67));
  });

  it("does not paint water damage below the top wall layer away from vents", () => {
    for (let x = 0; x < 32; x++) {
      for (let z = 0; z < 32; z++) {
        for (const y of [65, 66]) {
          assert.notEqual(model.selectWallpaperState(x, y, z, { isCorner: true }), "water_damaged");
        }
      }
    }
  });

  it("only allows vent-driven peeling immediately below the vent", () => {
    for (let x = -24; x <= 24; x++) {
      for (let z = -24; z <= 24; z++) {
        for (const y of [65, 66, 67]) {
          const state = model.selectWallpaperState(x, y, z, { nearVent: true });
          if (state === "peeling") assert.equal(y, 66, `vent peeling at ${x},${y},${z}`);
        }
      }
    }
  });

  it("places raised carpet corners only where both adjoining walls are closed", () => {
    const closed = { north: false, south: false, east: false, west: false };
    const corners = model.planRaisedCarpetCorners([[closed]], 0, 0);
    assert.deepEqual(corners.map(({ x, z, facing }) => [x, z, facing]), [
      [1, 1, "north"], [6, 1, "east"], [6, 6, "south"], [1, 6, "west"],
    ]);
    assert.ok(corners.every(({ state }) => ["base", "worn", "dark"].includes(state)));
    const openNorth = model.planRaisedCarpetCorners([[
      { north: true, south: false, east: false, west: false },
    ]], 0, 0);
    assert.deepEqual(openNorth.map(({ x, z }) => [x, z]), [[6, 6], [1, 6]]);
  });

  it("places all rotated turn baffles without entering the two-wide route", () => {
    const cell = { north: true, east: true, south: false, west: false };
    const regions = model.planTurnBaffleRegions(cell, 0, 0);
    assert.deepEqual(regions, [
      { minX: 1, maxX: 2, minZ: 2, maxZ: 5 },
      { minX: 5, maxX: 6, minZ: 1, maxZ: 2 },
    ]);
    const dimension = recordingDimension();
    assert.equal(applyYellowHallsTurnBaffles(dimension, 0, 0, [[cell]], 0, 0).placed, 36);
    assert.equal(dimension.writes.length, 36);
    assert.ok(dimension.writes.every(({ typeId, y }) => typeId === "minecraft:yellow_concrete" && y >= 65 && y <= 67));
    const excluded = recordingDimension();
    assert.equal(applyYellowHallsTurnBaffles(
      excluded,
      0,
      0,
      [[cell]],
      0,
      0,
      { excludedCells: new Set(["0,0"]) },
    ).placed, 0);
    assert.equal(excluded.writes.length, 0);
    const rotateBlockIndex = ([x, z], turns) => {
      for (let turn = 0; turn < turns; turn++) [x, z] = [7 - z, x];
      return [x, z];
    };
    const rotatePoint = ([x, z], turns) => {
      for (let turn = 0; turn < turns; turn++) [x, z] = [8 - z, x];
      return [x, z];
    };
    const baseRoute = new Set();
    for (let z = 0; z <= 4; z++) for (let x = 3; x <= 4; x++) baseRoute.add(`${x},${z}`);
    for (let x = 3; x <= 7; x++) for (let z = 3; z <= 4; z++) baseRoute.add(`${x},${z}`);
    const turns = [
      { cell: { north: true, east: true }, rotation: 0 },
      { cell: { east: true, south: true }, rotation: 1 },
      { cell: { south: true, west: true }, rotation: 2 },
      { cell: { west: true, north: true }, rotation: 3 },
    ];
    for (const turn of turns) {
      const baffles = model.planTurnBaffleRegions(turn.cell, 0, 0);
      const route = new Set([...baseRoute].map((key) => {
        const [x, z] = key.split(",").map(Number);
        const point = rotateBlockIndex([x, z], turn.rotation);
        return `${point[0]},${point[1]}`;
      }));
      const startCells = [[3, 0], [4, 0]].map((point) => rotateBlockIndex(point, turn.rotation));
      const exitCells = [[7, 3], [7, 4]].map((point) => rotateBlockIndex(point, turn.rotation));
      const reachable = new Set(startCells.map(([x, z]) => `${x},${z}`));
      const queue = startCells.map(([x, z]) => [x, z]);
      while (queue.length > 0) {
        const [x, z] = queue.shift();
        for (const [nextX, nextZ] of [[x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]]) {
          const key = `${nextX},${nextZ}`;
          if (!route.has(key) || reachable.has(key)) continue;
          reachable.add(key);
          queue.push([nextX, nextZ]);
        }
      }
      for (const [x, z] of exitCells) assert.ok(reachable.has(`${x},${z}`));
      for (const { minX, maxX, minZ, maxZ } of baffles) {
        for (let x = minX; x <= maxX; x++) {
          for (let z = minZ; z <= maxZ; z++) assert.ok(!route.has(`${x},${z}`));
        }
      }
      for (let startIndex = 0; startIndex <= 10; startIndex++) {
        const start = rotatePoint([3.5 + startIndex / 10, 0.5], turn.rotation);
        for (let endIndex = 0; endIndex <= 10; endIndex++) {
          const end = rotatePoint([7.5, 3.5 + endIndex / 10], turn.rotation);
          let blockedSightline = false;
          for (let step = 0; step <= 200; step++) {
            const ratio = step / 200;
            const x = Math.floor(start[0] + (end[0] - start[0]) * ratio);
            const z = Math.floor(start[1] + (end[1] - start[1]) * ratio);
            if (baffles.some((region) =>
              x >= region.minX && x <= region.maxX && z >= region.minZ && z <= region.maxZ)) {
              blockedSightline = true;
              break;
            }
          }
          assert.equal(blockedSightline, true, `direct sightline remains open for rotation ${turn.rotation}, aperture ${startIndex}/${endIndex}`);
        }
      }
    }
  });

  it("keeps all turn cells and bay cells out of extra maze loops", () => {
    assert.equal(model.isProtectedMazeLoopEdge(1, 1, "east", 0, 0), true);
    assert.equal(model.isProtectedMazeLoopEdge(2, 1, "south", 1, 0), true);
    assert.equal(model.isProtectedMazeLoopEdge(0, 0, "east", 1, 0), true);
    assert.equal(model.isProtectedMazeLoopEdge(0, 3, "east", 1, 0), false);
  });

  it("excludes bay scenes, baffle turns and escapes from scheduled module cells", () => {
    const maze = seededCells(4);
    for (const cellZ of [0, 2]) {
      for (let cellX = 0; cellX < 4; cellX++) {
        assert.equal(model.isBaySceneCell(1, 0, cellX, cellZ), true);
        assert.equal(model.isModuleCellEligible(maze, 1, 0, cellX, cellZ), false);
      }
    }
    assert.equal(model.isModuleCellEligible(maze, 0, 0, 1, 1), false);
    assert.equal(model.isModuleCellEligible(maze, 0, 0, 0, 0, { escape: true }), false);
    const candidates = [{ cx: 2, cz: 3 }, { cx: 0, cz: 1 }, { cx: 3, cz: 2 }];
    assert.deepEqual(
      model.orderModuleCandidates(candidates, 12),
      model.orderModuleCandidates(candidates.slice().reverse(), 12),
    );
  });

  it("reserves every structure-mask side that narrows a two-wide module opening", () => {
    const createMaze = (openSide) => {
      const maze = Array.from({ length: 4 }, () =>
        Array.from({ length: 4 }, () => ({ north: false, south: false, east: false, west: false })),
      );
      maze[2][1][openSide] = true;
      return maze;
    };
    const deadEnd = {
      deadEndOnly: true,
      requiredClosedSides: model.MODULE_CLEARANCE.dead_end_landmark.requiredClosedSides,
      requiredOpenSides: model.MODULE_CLEARANCE.dead_end_landmark.requiredOpenSides,
    };
    const maintenance = {
      requiredClosedSides: model.MODULE_CLEARANCE.maintenance_nook.requiredClosedSides,
    };
    for (const side of ["north", "south", "east", "west"]) {
      assert.equal(
        model.isModuleCellEligible(createMaze(side), 0, 0, 2, 1, deadEnd),
        side === "north",
        `dead_end_landmark must only use a north-only dead end, got ${side}`,
      );
      assert.equal(
        model.isModuleCellEligible(createMaze(side), 0, 0, 2, 1, maintenance),
        side === "north" || side === "west",
        `maintenance_nook must keep its east and south structure faces closed, got ${side}`,
      );
    }
    assert.deepEqual(model.MODULE_CLEARANCE.service_recess.requiredClosedSides, ["south"]);
    assert.deepEqual(model.MODULE_CLEARANCE.ceiling_failure.requiredClosedSides, []);
    assert.deepEqual(model.MODULE_CLEARANCE.maintenance_nook.requiredClosedSides, ["south", "east"]);
    assert.deepEqual(model.MODULE_CLEARANCE.dead_end_landmark.requiredClosedSides, ["south", "east", "west"]);
    assert.deepEqual(model.MODULE_CLEARANCE.dead_end_landmark.requiredOpenSides, ["north"]);
    const generatorSource = readFileSync(path.join(ROOT, "addon/BP/scripts/yellow_halls.js"), "utf8");
    assert.match(generatorSource, /\.\.\.yellowHallsModel\.MODULE_CLEARANCE\.dead_end_landmark/);
    assert.match(generatorSource, /requiredClosedSides: spec\.requiredClosedSides/);
    assert.match(generatorSource, /requiredOpenSides: spec\.requiredOpenSides/);
  });

  it("advances only unoccupied patch seeds and retains dirty state for the follow-up build", () => {
    const seeds = new Map([["-1:0", 4], ["0:0", 7]]);
    const dirty = new Set();
    const protectedPatches = new Set(["0:0"]);
    const changed = model.advancePatchSeeds(seeds, dirty, -1, 0, 1, protectedPatches, 0);

    assert.equal(changed, 8);
    assert.equal(seeds.get("-1:0"), 5);
    assert.equal(seeds.get("0:0"), 7);
    assert.equal(dirty.has("-1:0"), true);
    assert.equal(dirty.has("0:0"), false);
    assert.equal(seeds.get("-2:-1"), 1);
    assert.equal(dirty.has("-2:-1"), true);
  });

  it("keeps a block-level two-block-wide walking strip connected between all four portals", () => {
    for (const [patchX, patchZ] of [[0, 0], [1, 0], [-1, -1], [0, -1]]) {
      for (let seed = 0; seed < 100; seed++) {
        const maze = model.generatePatchMaze(patchX, patchZ, seed);
        assert.equal(
          hasTwoWidePortalConnectivity(patchX, patchZ, maze),
          true,
          `two-wide route disconnected at patch ${patchX}:${patchZ}, seed ${seed}`,
        );
      }
    }
  });

  it("keeps Yellow Halls generation patch-scoped and single-flight during multiplayer transitions", () => {
    const generatorSource = readFileSync(path.join(ROOT, "addon/BP/scripts/yellow_halls.js"), "utf8");
    assert.match(generatorSource, /patchSeeds: new Map\(\)/);
    assert.match(generatorSource, /queueYellowHallsPatchBuild\(state\.patchJobs, key/);
    assert.doesNotMatch(generatorSource, /state\.runSeed\s*=/);
    assert.doesNotMatch(generatorSource, /state\.generatedPatches\.clear\(\)/);
    assert.doesNotMatch(generatorSource, /state\.patchJobs\.delete\(key\)/);
    assert.match(generatorSource, /cancelVisualJobs\(`yellow-halls:\$\{patchX\}:\$\{patchZ\}`\)/);
    assert.match(generatorSource, /world\.getAllPlayers\(\)/);
  });

  it("rejects module cells on all four portals and uses inclusive bounds for the arrival buffer", () => {
    const maze = seededCells(4);
    for (const [cellX, cellZ] of [[1, 0], [1, 3], [0, 1], [3, 1]]) {
      assert.equal(model.isModuleCellEligible(maze, 0, 0, cellX, cellZ), false);
    }
    const spawnBuffer = { minX: -3, maxX: 3, minY: 65, maxY: 67, minZ: -3, maxZ: 3 };
    const deadEnd = model.moduleWorldBounds({
      offset: { x: 0, y: 1, z: 2 },
      bounds: { minX: 0, maxX: 7, minY: 0, maxY: 3, minZ: 0, maxZ: 5 },
    }, 0, 0, 0, 0);
    const ceilingFailure = model.moduleWorldBounds({
      offset: { x: 0, y: 2, z: 0 },
      bounds: { minX: 0, maxX: 7, minY: 0, maxY: 2, minZ: 0, maxZ: 7 },
    }, 0, 0, 0, 0);
    const serviceRecess = model.moduleWorldBounds({
      offset: { x: 0, y: 1, z: 5 },
      bounds: { minX: 0, maxX: 7, minY: 0, maxY: 3, minZ: 0, maxZ: 2 },
    }, 1, 1, 0, 0);
    const maintenanceNook = model.moduleWorldBounds({
      offset: { x: 0, y: 1, z: 4 },
      bounds: { minX: 0, maxX: 7, minY: 0, maxY: 3, minZ: 0, maxZ: 3 },
    }, 0, 0, 0, 0);
    assert.deepEqual(deadEnd.origin, { x: 0, y: 65, z: 2 });
    assert.deepEqual(ceilingFailure.origin, { x: 0, y: 66, z: 0 });
    assert.equal(model.boundsOverlap(deadEnd, spawnBuffer), true);
    assert.equal(model.boundsOverlap(ceilingFailure, spawnBuffer), true);
    assert.equal(model.isBoundsClear(deadEnd, [spawnBuffer]), false);
    assert.equal(model.isBoundsClear(ceilingFailure, [spawnBuffer]), false);
    assert.equal(model.isBoundsClear(serviceRecess, [spawnBuffer]), true);
    assert.equal(model.boundsOverlap(maintenanceNook, spawnBuffer), false);
  });

  it("keeps the authored Bay 6 motif baffle but protects the other bay footprints", () => {
    const turn = { north: true, east: true, south: false, west: false };
    assert.equal(model.isTurnBaffleEligible(1, 0, 1, 2, turn), true);
    assert.equal(model.isTurnBaffleEligible(1, 0, 2, 2, turn), false);
    assert.equal(model.isTurnBaffleEligible(1, 0, 3, 0, turn), false);
    assert.equal(model.isTurnBaffleEligible(0, 0, 1, 2, turn), true);
    assert.equal(model.isTurnBaffleEligible(0, 0, 1, 0, turn), false);
    assert.equal(model.isTurnBaffleEligible(0, 0, 1, 3, turn), false);
    assert.equal(model.isTurnBaffleEligible(0, 0, 0, 1, turn), false);
    assert.equal(model.isTurnBaffleEligible(0, 0, 3, 1, turn), false);
    const maze = [[turn]];
    assert.equal(model.isTurnBafflePosition(0, 0, maze, 0, 0, 1, 2, 0, 0), true);
    assert.equal(model.isTurnBafflePosition(0, 0, maze, 0, 0, 3, 3, 0, 0), false);
  });

  it("generates connected, repeatable patches with preserved portals and reserved turns", () => {
    for (let seed = 0; seed < 1000; seed++) {
      const first = model.generatePatchMaze(1, 0, seed);
      const second = model.generatePatchMaze(1, 0, seed);
      assert.deepEqual(first, second, `seed ${seed}`);
      assert.equal(reachableCount(first, 4), 16, `seed ${seed}`);
      assert.equal(first[1][0].north, true);
      assert.equal(first[1][3].south, true);
      assert.equal(first[3][1].east, true);
      assert.equal(first[0][1].west, true);
      for (const { x, z } of model.MOTIF_INNER_CELLS) {
        assert.equal(degrees(first, 4)[x * 4 + z], 2, `seed ${seed}, cell ${x},${z}`);
      }
    }
  });

  it("measures target wear rolls and actual remapped wallpaper output across 1,000 generated patches", () => {
    const target = { clean: 0, stained: 0, peeling: 0, water_damaged: 0 };
    const actual = { clean: 0, stained: 0, peeling: 0, water_damaged: 0 };
    const stateByTypeId = new Map(Object.entries(WALLPAPER).map(([state, typeId]) => [typeId, state]));

    for (let seed = 0; seed < 1000; seed++) {
      const dimension = recordingDimension();
      const maze = model.generatePatchMaze(1, 0, seed);
      applyYellowHallsSurfaces(dimension, 1, 0, maze, 32, 0);
      const wallWrites = dimension.writes.filter((write) => stateByTypeId.has(write.typeId));
      assert.ok(wallWrites.length > 0, `no wallpaper writes for seed ${seed}`);

      for (const write of wallWrites) {
        const roll = model.wearRoll(write.x, write.y, write.z);
        const targetState = roll < 68 ? "clean" : roll < 85 ? "stained" : roll < 95 ? "peeling" : "water_damaged";
        target[targetState] += 1;
        actual[stateByTypeId.get(write.typeId)] += 1;
      }
    }

    const ratio = (counts, state) => counts[state] / Object.values(counts).reduce((total, count) => total + count, 0);
    assert.ok(ratio(target, "clean") > 0.665 && ratio(target, "clean") < 0.685, JSON.stringify(target));
    assert.ok(ratio(target, "stained") > 0.165 && ratio(target, "stained") < 0.19, JSON.stringify(target));
    assert.ok(ratio(target, "peeling") > 0.095 && ratio(target, "peeling") < 0.115, JSON.stringify(target));
    assert.ok(ratio(target, "water_damaged") > 0.035 && ratio(target, "water_damaged") < 0.055, JSON.stringify(target));

    assert.ok(ratio(actual, "clean") > 0.66 && ratio(actual, "clean") < 0.69, JSON.stringify(actual));
    assert.ok(ratio(actual, "stained") > 0.24 && ratio(actual, "stained") < 0.29, JSON.stringify(actual));
    assert.ok(ratio(actual, "peeling") > 0.04 && ratio(actual, "peeling") < 0.07, JSON.stringify(actual));
    assert.ok(ratio(actual, "water_damaged") > 0.003 && ratio(actual, "water_damaged") < 0.02, JSON.stringify(actual));
  });

  it("only allows peeling and water damage next to a corner or a vent", () => {
    for (let x = 0; x < 30; x += 1) {
      for (let y = 64; y <= 67; y += 1) {
        for (let z = 0; z < 30; z += 1) {
          const state = model.selectWallpaperState(x, y, z, { isCorner: false, nearVent: false });
          assert.ok(state === "clean" || state === "stained", `${x},${y},${z} -> ${state}`);
        }
      }
    }
  });

  it("wears the floor along the route and stains only the shoulder", () => {
    for (let x = 0; x < 32; x += 1) {
      for (let z = 0; z < 32; z += 1) {
        const route = model.selectFloorState(x, z, { onRoute: true });
        assert.ok(route === "base" || route === "worn_path");
        const shoulder = model.selectFloorState(x, z, { onRoute: false });
        assert.ok(shoulder === "base" || shoulder === "dark_stain");
      }
    }
  });

  it("cracks about one ceiling tile in twenty", () => {
    let cracked = 0;
    let total = 0;
    for (let x = 0; x < 64; x += 1) {
      for (let z = 0; z < 64; z += 1) {
        total += 1;
        if (model.selectCeilingState(x, z) === "cracked") cracked += 1;
      }
    }
    assert.ok(cracked / total > 0.02 && cracked / total < 0.09, `${cracked}/${total}`);
  });

  it("places eligible raised corners at Y65 and preserves the arrival spawn buffer", () => {
    const closed = { north: false, south: false, east: false, west: false };
    const normal = recordingDimension();
    applyYellowHallsSurfaces(normal, 1, 0, [[closed]], 32, 0);
    const normalCorners = normal.writes.filter(({ typeId, y }) =>
      Object.values(CARPET_CORNERS).includes(typeId) && y === 65);
    assert.equal(normalCorners.length, 4);
    assert.deepEqual(normalCorners.map(({ x, z, states }) =>
      [x - 32, z, states["minecraft:cardinal_direction"]]).sort(),
      [[1, 1, "north"], [1, 6, "west"], [6, 1, "east"], [6, 6, "south"]]);

    const arrival = recordingDimension();
    applyYellowHallsSurfaces(arrival, 0, 0, [[closed]], 0, 0);
    const arrivalCorners = arrival.writes.filter(({ typeId }) => Object.values(CARPET_CORNERS).includes(typeId));
    assert.equal(arrivalCorners.length, 3);
    assert.ok(arrivalCorners.every(({ x, z }) => !(x >= -3 && x <= 3 && z >= -3 && z <= 3)));
  });
});

describe("yellow halls fixture chain", () => {
  it("places a fixture every four blocks and dims the turn-adjacent one", () => {
    const plan = model.planLegFixtures(8, 0, { axis: "z" });
    assert.deepEqual(plan.map((entry) => entry.offset), [2, 6]);
    assert.equal(plan[plan.length - 1].state, "dim");
    assert.equal(plan[0].axis, "z");
  });

  it("burns out at most one fixture per even length leg", () => {
    for (let ordinal = 0; ordinal < 6; ordinal += 1) {
      const plan = model.planLegFixtures(16, ordinal, { axis: "x" });
      const burned = plan.filter((entry) => entry.state === "burned_out");
      assert.ok(burned.length <= 1);
      if (ordinal % 2 === 1) assert.equal(burned.length, 1);
      else assert.equal(burned.length, 0);
    }
  });

  it("matches the declared light emissions", () => {
    assert.equal(model.fixtureLight("lit"), 13);
    assert.equal(model.fixtureLight("dim"), 7);
    assert.equal(model.fixtureLight("burned_out"), 0);
    assert.equal(model.fixtureLight("missing_tube"), 6);
  });

  it("plans a full straight run so every second leg's burned fixture is flanked by lit fixtures", () => {
    const maze = Array.from({ length: 4 }, () =>
      Array.from({ length: 4 }, () => ({ north: false, south: false, east: false, west: false })),
    );
    for (const z of [0, 2]) {
      for (let x = 0; x < 2; x++) {
        maze[x][z].east = true;
        maze[x + 1][z].west = true;
      }
    }
    const dimension = recordingDimension();
    const result = applyYellowHallsFixtures(dimension, 0, 0, maze, 0, 0);
    const secondLeg = result.plan.filter((fixture) => fixture.z === 19);
    assert.deepEqual(secondLeg.map(({ x, state }) => [x, state]), [
      [1, "lit"], [5, "burned_out"], [9, "lit"], [13, "lit"], [17, "lit"], [21, "dim"],
    ]);
    assert.equal(result.placed, 24);
  });
});

describe("yellow halls corridor motif", () => {
  const size = 4;

  it("keeps every cell reachable and both inner cells at degree two", () => {
    const cells = seededCells(size);
    const motif = model.applyCorridorMotif(cells, size, 1, 0);
    assert.equal(motif.applied, true, motif.reason);
    assert.equal(reachableCount(motif.cells, size), size * size);
    for (const { x, z } of model.MOTIF_INNER_CELLS) {
      const degree = degrees(motif.cells, size)[x * size + z];
      assert.equal(degree, 2, `${x},${z} degree ${degree}`);
    }
  });

  it("preserves the four patch portals", () => {
    const cells = seededCells(size);
    const motif = model.applyCorridorMotif(cells, size, 1, 0);
    assert.equal(motif.cells[1][0].north, true);
    assert.equal(motif.cells[1][size - 1].south, true);
    assert.equal(motif.cells[size - 1][1].east, true);
    assert.equal(motif.cells[0][1].west, true);
  });

  it("keeps the entry-to-far-opening line of sight broken and computes connected shortest portal routes", () => {
    const portals = [[1, 0], [1, 3], [3, 1], [0, 1]];
    for (let seed = 0; seed < 100; seed += 1) {
      const maze = model.generatePatchMaze(1, 0, seed);
      assert.equal(
        maze[1][0].south && maze[1][1].south && maze[1][2].south,
        false,
        `north/south sightline remains open at seed ${seed}`,
      );
      assert.equal(
        maze[0][1].east && maze[1][1].east && maze[2][1].east,
        false,
        `west/east sightline remains open at seed ${seed}`,
      );
      for (let left = 0; left < portals.length; left += 1) {
        for (let right = left + 1; right < portals.length; right += 1) {
          const path = shortestCellPath(maze, portals[left], portals[right]);
          assert.ok(path, `portal route missing for seed ${seed}: ${left} -> ${right}`);
          assert.ok(path.length <= 16, `shortest route exceeds cell count at seed ${seed}`);
        }
      }
    }
  });

  it("reserves the archive blind wall without disconnecting the early corridor", () => {
    const cells = Array.from({ length: size }, (_, x) =>
      Array.from({ length: size }, (_, z) => ({
        north: z > 0, south: z < size - 1, east: x < size - 1, west: x > 0,
      })),
    );
    const motif = model.applyCorridorMotif(cells, size, 1, 0);
    assert.equal(motif.applied, true, motif.reason);
    assert.equal(motif.cells[2][2].north, false);
    assert.equal(motif.cells[2][1].south, false);
    assert.equal(motif.cells[2][2].west, true);
    assert.equal(reachableCount(motif.cells, size), size * size);
  });

  it("repairs a snake patch whose inner cells are the only shortcut", () => {
    const cells = [];
    for (let x = 0; x < size; x += 1) {
      cells[x] = [];
      for (let z = 0; z < size; z += 1) cells[x][z] = { north: false, south: false, east: false, west: false };
    }
    const order = [];
    for (let x = 0; x < size; x += 1) {
      for (let step = 0; step < size; step += 1) {
        order.push([x, x % 2 === 0 ? step : size - 1 - step]);
      }
    }
    for (let index = 0; index < order.length - 1; index += 1) {
      const [ax, az] = order[index];
      const [bx, bz] = order[index + 1];
      if (bx === ax + 1) {
        cells[ax][az].east = true;
        cells[bx][bz].west = true;
      } else if (bx === ax - 1) {
        cells[ax][az].west = true;
        cells[bx][bz].east = true;
      } else if (bz === az + 1) {
        cells[ax][az].south = true;
        cells[bx][bz].north = true;
      } else {
        cells[ax][az].north = true;
        cells[bx][bz].south = true;
      }
    }
    const motif = model.applyCorridorMotif(cells, size, 1, 0);
    assert.equal(motif.applied, true, motif.reason);
    assert.equal(reachableCount(motif.cells, size), size * size);
    for (const { x, z } of model.MOTIF_INNER_CELLS) {
      assert.equal(degrees(motif.cells, size)[x * size + z], 2);
    }
  });

  it("rejects a malformed grid without mutating its input", () => {
    const cells = Array.from({ length: size - 1 }, () => []);
    const motif = model.applyCorridorMotif(cells, size, 1, 0);
    assert.equal(motif.applied, false);
    assert.equal(motif.reason, "size");
    assert.equal(motif.cells, cells);
  });

  it("uses a deterministic, patch-seeded shuffle for connectivity repair", () => {
    const a = model.applyCorridorMotif(seededCells(size), size, 1, 0, 17);
    const b = model.applyCorridorMotif(seededCells(size), size, 1, 0, 17);
    const c = model.applyCorridorMotif(seededCells(size), size, 1, 0, 18);
    assert.deepEqual(a.cells, b.cells);
    assert.equal(a.closedLinks, b.closedLinks);
    assert.notDeepEqual(a.cells, c.cells);
    assert.equal(reachableCount(c.cells, size), size * size);
  });
});

describe("yellow halls block registry", () => {
  const source = readFileSync(path.join(ROOT, "addon/BP/scripts/yellow_halls_decor.js"), "utf8");
  const ids = [...new Set(source.match(/paradise:[a-z0-9_]+/g) ?? [])].sort();

  it("keeps every referenced block id under the file-name limit", () => {
    for (const id of ids) {
      const name = `${id.replace(":", "__")}.json`;
      assert.ok(name.length <= 59, `${name} is ${name.length} characters`);
    }
  });

  it("references only block ids that exist in the behavior pack", () => {
    const missing = ids.filter(
      (id) => !existsSync(path.join(ROOT, "addon/BP/blocks", `${id.replace(":", "__")}.json`)),
    );
    assert.deepEqual(missing, []);
  });
});

describe("yellow halls dressing writer", () => {
  const source = readFileSync(path.join(ROOT, "addon/BP/scripts/yellow_halls_decor.js"), "utf8");

  it("keeps all eight bay props out of live portal columns across 1,000 generated seeds", () => {
    const portalCounts = new Map(model.BAYS.map((bay) => [bay.bay, 0]));

    for (let seed = 0; seed < 1000; seed++) {
      const cells = model.generatePatchMaze(1, 0, seed);
      const dimension = recordingDimension();
      applyYellowHallsScenery(dimension, 1, 0, cells, 32, 0);

      for (const bay of model.BAYS) {
        const isPortal = model.bayFaceIsPortal(cells, bay);
        const anchor = model.bayDoorAnchor(bay, isPortal);
        if (isPortal) {
          portalCounts.set(bay.bay, portalCounts.get(bay.bay) + 1);
          assert.equal(anchor.x, bay.x - 2, `bay ${bay.bay} x offset, seed ${seed}`);
          assert.equal(anchor.z, bay.facing === "north" ? 6 : 17, `bay ${bay.bay} z offset, seed ${seed}`);
        } else {
          assert.deepEqual(anchor, { x: bay.x, y: bay.y, z: bay.z }, `bay ${bay.bay}, seed ${seed}`);
        }

        if (!bay.prop) continue;
        const firstSegment = PROP_IDS[bay.prop][0].id;
        assert.ok(dimension.writes.some((write) =>
          write.x === 32 + anchor.x &&
          write.y === anchor.y &&
          write.z === anchor.z &&
          write.typeId === firstSegment), `bay ${bay.bay} placement for seed ${seed}`);
        if (isPortal) {
          assert.equal(dimension.writes.some((write) =>
            write.x === 32 + bay.x &&
            write.y === bay.y &&
            write.z === bay.z &&
            write.typeId === firstSegment), false, `bay ${bay.bay} occupied the portal column for seed ${seed}`);
        }
      }
    }

    assert.equal(portalCounts.get(2), 0);
    assert.equal(portalCounts.get(7), 0);
  });

  it("places all eight authored bays, their signs and the archive arrow", () => {
    const cells = Array.from({ length: 4 }, () =>
      Array.from({ length: 4 }, () => ({ north: false, south: false, east: false, west: false })),
    );
    const dimension = recordingDimension();
    applyYellowHallsScenery(dimension, 1, 0, cells, 32, 0);
    for (const bay of model.BAYS) {
      if (bay.prop) {
        const anchor = model.bayDoorAnchor(bay, false);
        const expected = PROP_IDS[bay.prop][0].id;
        assert.ok(dimension.writes.some((write) =>
          write.x === 32 + anchor.x && write.y === anchor.y && write.z === anchor.z && write.typeId === expected),
        `bay ${bay.bay} prop`);
      }
      if (bay.sign) {
        const segments = PROP_IDS[`${bay.sign}_sign`];
        for (const segment of segments) {
          assert.ok(dimension.writes.some((write) =>
            write.x >= 32 + bay.signX &&
            write.x <= 32 + bay.signX + 1 &&
            write.y === bay.y + 2 &&
            write.z === bay.signZ &&
            write.typeId === segment.id),
          `bay ${bay.bay} sign segment ${segment.id}`);
        }
      }
    }
    assert.equal(dimension.writes.filter((write) =>
      write.typeId.startsWith("paradise:yh_archive_directional_arrow_")).length, 2);
  });

  it("rotates and rebases the actual sign segments for every cardinal heading", () => {
    const entry = PROP_IDS.archive_sign;
    const base = { x: -32, y: 67, z: -16 };
    for (const [facing, offsets] of [
      ["north", [[0, 0], [1, 0]]],
      ["east", [[0, 0], [0, 1]]],
      ["south", [[1, 0], [0, 0]]],
      ["west", [[0, 1], [0, 0]]],
    ]) {
      const dimension = recordingDimension();
      assert.equal(placeSegments(dimension, entry, base, facing), 2);
      assert.deepEqual(dimension.writes.map(({ x, y, z, typeId, states }) =>
        [x - base.x, y, z - base.z, typeId, states["minecraft:cardinal_direction"]]),
        offsets.map(([x, z], index) => [x, base.y, z, entry[index].id, facing]));
    }
  });

  it("writes the normal poster once and does not overwrite the archive arrow or vent", () => {
    const cells = Array.from({ length: 4 }, () =>
      Array.from({ length: 4 }, () => ({ north: false, south: false, east: false, west: false })),
    );
    const dimension = recordingDimension();
    applyYellowHallsScenery(dimension, 1, 0, cells, 32, 0);
    const count = (prefix) => dimension.writes.filter((write) => write.typeId.startsWith(prefix)).length;
    assert.equal(count("paradise:yh_poster_normal_"), 2);
    assert.equal(count("paradise:yh_archive_directional_arrow_"), 2);
    assert.equal(count("paradise:yh_return_air_vent"), 1);
  });

  it("keeps the maintenance sign clear of the conduit end cap and adds bay-one frame trim", () => {
    const cells = Array.from({ length: 4 }, () =>
      Array.from({ length: 4 }, () => ({ north: false, south: false, east: false, west: false })),
    );
    const dimension = recordingDimension();
    applyYellowHallsScenery(dimension, 1, 0, cells, 32, 0);
    const at = (x, y, z) => dimension.writes.filter((write) => write.x === x && write.y === y && write.z === z);
    assert.equal(at(62, 67, 6).length, 1);
    assert.equal(at(62, 67, 6)[0].typeId, "paradise:sh_conduit_end_cap_iron_x0_y0_z0");
    assert.ok(at(61, 67, 6).some((write) => write.typeId === "paradise:yh_maint_sign_normal_x1_y0_z0"));
    for (const x of [34, 37]) {
      assert.ok(at(x, 65, 7).some((write) => write.typeId === "paradise:sh_door_frame_trim_iron_x0_y0_z0"));
      assert.ok(at(x, 66, 7).some((write) => write.typeId === "paradise:sh_door_frame_trim_iron_x0_y1_z0"));
    }
    const chair = model.FLOOR_PROPS.find((prop) => prop.id === "folding_chair");
    const basket = model.FLOOR_PROPS.find((prop) => prop.id === "overturned_wastebasket");
    assert.ok(chair && basket);
    assert.notDeepEqual([chair.x, chair.z - 1], [basket.x, basket.z], "north-facing chair frontage must remain clear");
    assert.ok(at(32 + chair.x, chair.y, chair.z).some((write) => write.typeId === "paradise:yh_folding_chair"));
    const positions = dimension.writes.map(({ x, y, z }) => `${x},${y},${z}`);
    assert.equal(new Set(positions).size, positions.length, "scenery must not write two props into one block");
  });

  it("keeps baffles clear of authored bay, breaker and prop placements across 100 seeds", () => {
    for (let seed = 0; seed < 100; seed++) {
      const dimension = recordingDimension();
      applyYellowHallsDressing(dimension, 1, 0, model.generatePatchMaze(1, 0, seed), 32, 0);
      const writesByPosition = new Map();
      for (const write of dimension.writes) {
        const key = `${write.x},${write.y},${write.z}`;
        const writes = writesByPosition.get(key) ?? [];
        writes.push(write.typeId);
        writesByPosition.set(key, writes);
      }
      const overwrittenBaffles = [...writesByPosition].filter(([, writes]) =>
        writes.includes("minecraft:yellow_concrete") && writes.length > 1);
      assert.deepEqual(overwrittenBaffles, [], `seed ${seed}`);
    }
  });

  it("keeps every authored floor-prop segment off the two-wide route across 1,000 seeds", () => {
    for (let seed = 0; seed < 1000; seed++) {
      const maze = model.generatePatchMaze(1, 0, seed);
      const dimension = recordingDimension();
      applyYellowHallsScenery(dimension, 1, 0, maze, 32, 0);

      for (const prop of model.FLOOR_PROPS) {
        const segments = PROP_IDS[prop.id];
        const segmentIds = new Set(segments.map((segment) => segment.id));
        const propWrites = dimension.writes.filter((write) => segmentIds.has(write.typeId));
        assert.equal(propWrites.length, segments.length, `${prop.id} missing for seed ${seed}`);
        for (const write of propWrites) {
          assert.equal(
            model.isRouteBlockPosition(maze, write.x, write.z, 32, 0),
            false,
            `${prop.id} blocks the route at ${write.x},${write.y},${write.z} for seed ${seed}`,
          );
        }
      }
    }
  });

  it("uses the authored bay and prop Y instead of the patch floor", () => {
    for (const bay of model.BAYS) assert.equal(bay.y, 65);
    for (const prop of model.FLOOR_PROPS) assert.equal(prop.y, 65);
    assert.match(source, /anchor\.y/);
    assert.match(source, /prop\.y/);
    assert.doesNotMatch(source, /groundY \+ 2/);
  });

  it("drives the ceiling chain from planLegFixtures", () => {
    assert.match(source, /planLegFixtures/);
    assert.match(source, /state: "dim"/);
    const plan = model.planLegFixtures(8, 1, { axis: "z" });
    assert.deepEqual(plan.map((entry) => [entry.offset, entry.state]), [[2, "lit"], [6, "dim"]]);
  });

  it("reserves the breaker back plane and clears its front volume", () => {
    const mount = model.BREAKER_MOUNT;
    assert.deepEqual(mount.backMin, [22, 66, 16]);
    assert.deepEqual(mount.backMax, [23, 67, 16]);
    assert.deepEqual(mount.frontMin, [22, 65, 17]);
    assert.deepEqual(mount.frontMax, [23, 67, 18]);
    assert.match(source, /WALLPAPER\.water_damaged/);
    const cells = Array.from({ length: 4 }, () =>
      Array.from({ length: 4 }, () => ({ north: false, south: false, east: false, west: false })),
    );
    const dimension = recordingDimension();
    applyYellowHallsScenery(dimension, 1, 0, cells, 32, 0);
    for (let x = 22; x <= 23; x++) {
      for (let y = 66; y <= 67; y++) {
        assert.ok(dimension.writes.some((write) =>
          write.x === 32 + x && write.y === y && write.z === 16 &&
          write.typeId === WALLPAPER.water_damaged));
      }
      for (let y = 65; y <= 67; y++) {
        for (let z = 17; z <= 18; z++) {
          assert.ok(dimension.writes.some((write) =>
            write.x === 32 + x && write.y === y && write.z === z && write.typeId === "minecraft:air"));
        }
      }
    }
  });

  it("references only existing block ids from the writer", () => {
    const ids = [...new Set(source.match(/paradise:[a-z0-9_]+/g) ?? [])];
    const missing = ids.filter((id) => !existsSync(
      path.join(ROOT, "addon/BP/blocks", `paradise__${id.replace("paradise:", "")}.json`),
    ));
    assert.deepEqual(missing, []);
  });
});
