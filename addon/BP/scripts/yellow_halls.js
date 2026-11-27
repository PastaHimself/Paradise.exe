import {
  BlockPermutation,
  BlockVolume,
  CommandPermissionLevel,
  CustomCommandStatus,
  ItemStack,
  WeatherType,
  system,
  world,
} from "@minecraft/server";
import { maybePlayYellowHallsAudio } from "./horror_audio.js";
import { getCachedPlayers } from "./paradise_tick_cache.js";
import {
  cancelVisualJobs,
  hashCoords as visualHashCoords,
  scheduleStructurePlacement,
} from "./paradise_visual_jobs.js";
import {
  queueYellowHallsPatchBuild,
  resolveSavedReturnDestination,
} from "./yellow_halls_lifecycle.js";
import {
  createYellowHallsPadReservations,
  isPositionReserved,
  scanYellowHallsPadMarkers,
  subtractReservedVolumes,
} from "./yellow_halls_pad_reservations.js";
import { applyYellowHallsDressing } from "./yellow_halls_decor.js";
import * as yellowHallsModel from "./yellow_halls_decor_model.js";
import {
  selectVisualModuleIndex,
  shouldRebuildGeneratedPatch,
} from "./paradise_visual_geometry.js";
import {
  VHS_TIER,
  canTrigger,
  clearRuleState,
  getOrCreateRuleState,
  pickRememberedLocation,
  rememberLocation,
  requestRuleVhs,
  tryBeginRuleScare,
  safeAddEffect,
  safePlaySound,
  safeSpawnParticle,
  safeTitle,
  sampleMotion,
  verifiedPlayerTeleport,
  setStandingSign,
} from "./dimension_horror_rules.js";

const DIMENSION_ID = "paradise:yellow_halls";
const ENTER_COMMAND_ID = "p:enter_yellow_halls";
const CHAT_ENTER_COMMAND = "!enter_yellow_halls";

const PATCH_SIZE = 32;
const ACTIVE_PATCH_RADIUS = 1;
const WORLD_GENERATION_SEED = 0;
const MAINTENANCE_INTERVAL_TICKS = 20;
const PROXIMITY_CHECK_TICKS = 5;
const WEATHER_REFRESH_TICKS = 20 * 60 * 5;
const FLICKER_MIN_GAP_TICKS = 80;
const FLICKER_MAX_GAP_TICKS = 260;
const FLICKER_BURST_MIN_TICKS = 3;
const FLICKER_BURST_MAX_TICKS = 10;
const ENTRY_RETRY_ATTEMPTS = 10;
const ENTRY_RETRY_TICKS = 4;

const ENTRY_CENTER = { x: 0, y: 64, z: 0 };
const ENTRY_TELEPORT_Y = 66;

const GROUND_Y = 64;
const WALL_BOTTOM_Y = 64;
const WALL_TOP_Y = 67;
const CEILING_Y = 68;

const CELLS_PER_SIDE = 4;
const CELL_SIZE = 8;
const DOORWAY_CELL = 1;
const DOOR_START = 3;
const DOOR_END = 4;

const ESCAPE_MIN_DISTANCE = 192;
const ESCAPE_MAX_DISTANCE = 320;
const SPAWN_CLEAR_RADIUS = 3;

const MOB_SPAWN_RADIUS = 24;
const MOB_DENSITY_RADIUS = 48;
const MAX_MOBS_PER_PLAYER = 7;

const BLOCK = {
  air: "minecraft:air",
  yellowConcrete: "minecraft:yellow_concrete",
  yellowTerracotta: "minecraft:yellow_terracotta",
  smoothSandstone: "minecraft:smooth_sandstone",
  birchPlanks: "minecraft:birch_planks",
  seaLantern: "minecraft:sea_lantern",
  strippedBirchLog: "minecraft:stripped_birch_log",
  yellowCarpet: "minecraft:yellow_carpet",
  whiteCarpet: "minecraft:white_carpet",
  stonePressurePlate: "minecraft:stone_pressure_plate",
  wallSign: "minecraft:birch_wall_sign",
  standingSign: "minecraft:birch_sign",
  woodenButton: "minecraft:wooden_button",
  chest: "minecraft:chest",
  lightBlock0: "minecraft:light_block_0",
  grassBlock: "minecraft:grass_block",
  blackConcrete: "minecraft:black_concrete",
};

const WALL_BLOCKS = [
  BLOCK.yellowConcrete,
  BLOCK.yellowTerracotta,
  BLOCK.smoothSandstone,
];

const ALLOWED_ENTITY_IDS = new Set([
  "minecraft:item",
  "minecraft:player",
  "minecraft:xp_orb",
  "minecraft:zombie",
  "minecraft:husk",
  "minecraft:enderman",
]);

const MOB_IDS = ["minecraft:zombie", "minecraft:husk", "minecraft:enderman"];

const YELLOW_HALLS_MODULES = Object.freeze([
  {
    id: "paradise:yellow_halls/service_recess",
    depth: 3,
    ceiling: false,
    deadEndOnly: false,
    offset: { x: 0, y: 1, z: 5 },
    bounds: { minX: 0, maxX: 7, minY: 0, maxY: 3, minZ: 0, maxZ: 2 },
    ...yellowHallsModel.MODULE_CLEARANCE.service_recess,
  },
  {
    id: "paradise:yellow_halls/ceiling_failure",
    depth: 8,
    ceiling: true,
    deadEndOnly: false,
    offset: { x: 0, y: 2, z: 0 },
    bounds: { minX: 0, maxX: 7, minY: 0, maxY: 2, minZ: 0, maxZ: 7 },
    ...yellowHallsModel.MODULE_CLEARANCE.ceiling_failure,
  },
  {
    id: "paradise:yellow_halls/maintenance_nook",
    depth: 4,
    ceiling: false,
    deadEndOnly: false,
    offset: { x: 0, y: 1, z: 4 },
    bounds: { minX: 0, maxX: 7, minY: 0, maxY: 3, minZ: 0, maxZ: 3 },
    ...yellowHallsModel.MODULE_CLEARANCE.maintenance_nook,
  },
  {
    id: "paradise:yellow_halls/dead_end_landmark",
    depth: 6,
    ceiling: false,
    deadEndOnly: true,
    offset: { x: 0, y: 1, z: 2 },
    bounds: { minX: 0, maxX: 7, minY: 0, maxY: 3, minZ: 0, maxZ: 5 },
    ...yellowHallsModel.MODULE_CLEARANCE.dead_end_landmark,
  },
]);

const LOOT_TABLE = [
  { type: "minecraft:bread", count: 1 },
  { type: "minecraft:candle", count: 1 },
  { type: "minecraft:compass", count: 1 },
  { type: "minecraft:paper", count: 2 },
  { type: "minecraft:torch", count: 4 },
];

const ENTRY_PATCH = getPatchCoordsFromBlockPos(ENTRY_CENTER);

const state = {
  bootstrapPromise: null,
  bootstrapReady: false,
  maintenanceRunning: false,
  generatedPatches: new Map(),
  dirtyPatches: new Set(),
  patchJobs: new Map(),
  patchSeeds: new Map(),
  playerConnectionPadAnchors: new Map(),
  connectionPadAnchors: new Map(),
  connectionPadReservations: new Map(),
  connectionPadScannedPatches: new Set(),
  connectionPadScanPromises: new Map(),
  returnPoints: new Map(),
  activeEscapes: new Map(),
  pendingEscapes: new Set(),
  nextWeatherRefreshTick: 0,
  flickerOn: false,
  nextFlickerTick: FLICKER_MIN_GAP_TICKS,
  flickerRestoreTick: 0,
  flickeredLights: new Map(),
  confidenceRules: new Map(),
};

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toBlockPos(location) {
  return {
    x: Math.floor(location.x),
    y: Math.floor(location.y),
    z: Math.floor(location.z),
  };
}

function addVec(location, dx = 0, dy = 0, dz = 0) {
  return {
    x: location.x + dx,
    y: location.y + dy,
    z: location.z + dz,
  };
}

function getYellowHallsDimension() {
  return world.getDimension(/** @type {any} */ (DIMENSION_ID));
}

function isYellowHallsDimension(dimension) {
  return !!dimension && dimension.id === DIMENSION_ID;
}

function getPatchKey(patchX, patchZ) {
  return `${patchX}:${patchZ}`;
}

function recordConnectionPadAnchor(location) {
  const anchor = toBlockPos(location);
  const anchorKey = `${anchor.x}:${anchor.y}:${anchor.z}`;
  if (state.connectionPadAnchors.has(anchorKey)) return;
  state.connectionPadAnchors.set(anchorKey, anchor);

  for (const reservation of createYellowHallsPadReservations(anchor)) {
    const minPatchX = Math.floor(reservation.minX / PATCH_SIZE);
    const maxPatchX = Math.floor(reservation.maxX / PATCH_SIZE);
    const minPatchZ = Math.floor(reservation.minZ / PATCH_SIZE);
    const maxPatchZ = Math.floor(reservation.maxZ / PATCH_SIZE);
    const reservationKey = `${reservation.minX}:${reservation.minY}:${reservation.minZ}:${reservation.maxX}:${reservation.maxY}:${reservation.maxZ}`;
    for (let patchX = minPatchX; patchX <= maxPatchX; patchX++) {
      for (let patchZ = minPatchZ; patchZ <= maxPatchZ; patchZ++) {
        const key = getPatchKey(patchX, patchZ);
        let reservations = state.connectionPadReservations.get(key);
        if (!reservations) {
          reservations = new Map();
          state.connectionPadReservations.set(key, reservations);
        }
        reservations.set(reservationKey, reservation);
      }
    }
  }
}

function refreshPlayerConnectionPadAnchor(player, force = false) {
  if (!player?.id || !player.location || player.dimension?.id !== DIMENSION_ID) return;
  const current = state.playerConnectionPadAnchors.get(player.id);
  const next = toBlockPos(player.location);
  const movedBeyondAnchor = !current ||
    ((next.x - current.x) ** 2 + (next.z - current.z) ** 2) > 96 * 96;
  if (!force && !movedBeyondAnchor) return;
  state.playerConnectionPadAnchors.set(player.id, next);
  recordConnectionPadAnchor(next);
}

function runYellowHallsPadMarkerScan(dimension, bounds) {
  return new Promise((resolve, reject) => {
    try {
      system.runJob((function* () {
        try {
          resolve(yield* scanYellowHallsPadMarkers(dimension, bounds));
        } catch (error) {
          reject(error);
        }
      })());
    } catch (error) {
      reject(error);
    }
  });
}

async function scanExistingConnectionPads(dimension, patchX, patchZ) {
  const patchKey = getPatchKey(patchX, patchZ);
  if (state.connectionPadScannedPatches.has(patchKey)) return;
  const pendingScan = state.connectionPadScanPromises.get(patchKey);
  if (pendingScan) {
    await pendingScan;
    return;
  }

  const bounds = getPatchBounds(patchX, patchZ);
  const yLevels = new Set([GROUND_Y, GROUND_Y + 1, GROUND_Y + 2, GROUND_Y + 3, GROUND_Y + 4]);
  for (const anchor of state.connectionPadAnchors.values()) {
    for (let y = anchor.y - 1; y <= anchor.y + 1; y++) yLevels.add(y);
  }
  const scanPromise = runYellowHallsPadMarkerScan(dimension, {
    ...bounds,
    minY: GROUND_Y,
    maxY: GROUND_Y + 4,
    yLevels: [...yLevels],
  });
  state.connectionPadScanPromises.set(patchKey, scanPromise);
  try {
    const scan = await scanPromise;
    for (const anchor of scan.anchors) recordConnectionPadAnchor(anchor);
    if (scan.complete) {
      state.connectionPadScannedPatches.add(patchKey);
    } else {
      console.warn(`[Yellow Halls] Connection-pad marker scan had ${scan.unreadable} unreadable cells in patch ${patchKey}; it will retry.`);
    }
  } finally {
    if (state.connectionPadScanPromises.get(patchKey) === scanPromise) {
      state.connectionPadScanPromises.delete(patchKey);
    }
  }
}

function refreshActivePlayerConnectionPadAnchors() {
  try {
    for (const player of world.getAllPlayers()) refreshPlayerConnectionPadAnchor(player);
  } catch (error) {
    console.warn("[Yellow Halls] Could not refresh active connection-pad anchors.", error);
  }
}

function getCachedConnectionPadReservations(patchX, patchZ) {
  return [...(state.connectionPadReservations.get(getPatchKey(patchX, patchZ))?.values() ?? [])];
}

async function getConnectionPadReservations(dimension, patchX, patchZ) {
  refreshActivePlayerConnectionPadAnchors();
  await scanExistingConnectionPads(dimension, patchX, patchZ);
  return getCachedConnectionPadReservations(patchX, patchZ);
}

function createPadProtectedDimension(dimension, reservations) {
  return {
    id: dimension.id,
    getBlock(location) {
      if (isPositionReserved(location, reservations)) return undefined;
      return dimension.getBlock(location);
    },
    setBlockType(location, typeId) {
      if (isPositionReserved(location, reservations)) return false;
      return dimension.setBlockType(location, typeId);
    },
    fillBlocks(volume, block, options) {
      const minimum = volume.getMin();
      const maximum = volume.getMax();
      const regions = subtractReservedVolumes({
        minX: minimum.x,
        maxX: maximum.x,
        minY: minimum.y,
        maxY: maximum.y,
        minZ: minimum.z,
        maxZ: maximum.z,
      }, reservations);
      let result;
      for (const region of regions) {
        result = dimension.fillBlocks(
          new BlockVolume(
            { x: region.minX, y: region.minY, z: region.minZ },
            { x: region.maxX, y: region.maxY, z: region.maxZ },
          ),
          block,
          options,
        );
      }
      return result;
    },
  };
}

function getPatchSeed(patchX, patchZ) {
  return state.patchSeeds.get(getPatchKey(patchX, patchZ)) ?? WORLD_GENERATION_SEED;
}

function getPatchCoordsFromBlockPos(position) {
  const block = toBlockPos(position);
  return {
    patchX: Math.floor(block.x / PATCH_SIZE),
    patchZ: Math.floor(block.z / PATCH_SIZE),
  };
}

function markPatchDirtyAt(location) {
  if (!location) return;
  const { patchX, patchZ } = getPatchCoordsFromBlockPos(location);
  state.dirtyPatches.add(getPatchKey(patchX, patchZ));
}

function getPatchBounds(patchX, patchZ) {
  const minX = patchX * PATCH_SIZE;
  const minZ = patchZ * PATCH_SIZE;
  return {
    minX,
    minZ,
    maxX: minX + PATCH_SIZE - 1,
    maxZ: minZ + PATCH_SIZE - 1,
  };
}

function getCellBounds(patchX, patchZ, cellX, cellZ) {
  const patchMinX = patchX * PATCH_SIZE;
  const patchMinZ = patchZ * PATCH_SIZE;
  return {
    cellMinX: patchMinX + cellX * CELL_SIZE,
    cellMinZ: patchMinZ + cellZ * CELL_SIZE,
    cellMaxX: patchMinX + (cellX + 1) * CELL_SIZE - 1,
    cellMaxZ: patchMinZ + (cellZ + 1) * CELL_SIZE - 1,
  };
}

function hash32(value) {
  let n = value | 0;
  n ^= n >>> 16;
  n = Math.imul(n, 0x7feb352d);
  n ^= n >>> 15;
  n = Math.imul(n, 0x846ca68b);
  n ^= n >>> 16;
  return n >>> 0;
}

function noise2D(x, z, runSeed = WORLD_GENERATION_SEED) {
  const mixed =
    Math.imul(x | 0, 0x8da6b343) ^
    Math.imul(z | 0, 0xd8163841) ^
    Math.imul(runSeed | 0, 0x9e3779b1) ^
    0x5f3759df;
  return hash32(mixed);
}

function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWallBlock(patchX, patchZ, cx, cz, runSeed) {
  const idx = noise2D(patchX * 31 + cx, patchZ * 37 + cz, runSeed) % WALL_BLOCKS.length;
  return WALL_BLOCKS[idx];
}

function setBlockSafe(dimension, location, typeId) {
  try {
    dimension.setBlockType(toBlockPos(location), typeId);
    return true;
  } catch (error) {
    return false;
  }
}

function setBlockPermutationSafe(block, permutation) {
  if (!block) return false;
  try {
    const actual =
      typeof permutation === "string"
        ? BlockPermutation.resolve(permutation)
        : permutation;
    block.setPermutation(actual);
    return true;
  } catch (error) {
    return false;
  }
}

function resolvePermutation(typeId, states) {
  try {
    return BlockPermutation.resolve(typeId, states);
  } catch (error) {
    return BlockPermutation.resolve(BLOCK.air);
  }
}

function clearArea(dimension, center, radius, minY, maxY) {
  const loc = toBlockPos(center);
  try {
    dimension.fillBlocks(
      new BlockVolume(
        { x: loc.x - radius, y: minY, z: loc.z - radius },
        { x: loc.x + radius, y: maxY, z: loc.z + radius }
      ),
      BLOCK.air
    );
  } catch (error) {
    // Ignore.
  }
}

function countConnections(cell) {
  let c = 0;
  if (cell.north) c++;
  if (cell.south) c++;
  if (cell.east) c++;
  if (cell.west) c++;
  return c;
}

function renderCellWall(dimension, cellMinX, cellMinZ, cellMaxX, cellMaxZ, wallBlock, isVertical, isStart, hasDoorway) {
  if (isVertical) {
    if (!hasDoorway) {
      try {
        dimension.fillBlocks(
          new BlockVolume({ x: cellMinX, y: WALL_BOTTOM_Y, z: cellMinZ }, { x: cellMinX, y: WALL_TOP_Y, z: cellMaxZ }),
          wallBlock
        );
      } catch (e) {}
    } else {
      if (DOOR_START > 0) {
        try {
          dimension.fillBlocks(
            new BlockVolume({ x: cellMinX, y: WALL_BOTTOM_Y, z: cellMinZ }, { x: cellMinX, y: WALL_TOP_Y, z: cellMinZ + DOOR_START - 1 }),
            wallBlock
          );
        } catch (e) {}
      }
      if (DOOR_END < CELL_SIZE - 1) {
        try {
          dimension.fillBlocks(
            new BlockVolume({ x: cellMinX, y: WALL_BOTTOM_Y, z: cellMinZ + DOOR_END + 1 }, { x: cellMinX, y: WALL_TOP_Y, z: cellMaxZ }),
            wallBlock
          );
        } catch (e) {}
      }
    }
  } else {
    if (!hasDoorway) {
      try {
        dimension.fillBlocks(
          new BlockVolume({ x: cellMinX, y: WALL_BOTTOM_Y, z: cellMinZ }, { x: cellMaxX, y: WALL_TOP_Y, z: cellMinZ }),
          wallBlock
        );
      } catch (e) {}
    } else {
      if (DOOR_START > 0) {
        try {
          dimension.fillBlocks(
            new BlockVolume({ x: cellMinX, y: WALL_BOTTOM_Y, z: cellMinZ }, { x: cellMinX + DOOR_START - 1, y: WALL_TOP_Y, z: cellMinZ }),
            wallBlock
          );
        } catch (e) {}
      }
      if (DOOR_END < CELL_SIZE - 1) {
        try {
          dimension.fillBlocks(
            new BlockVolume({ x: cellMinX + DOOR_END + 1, y: WALL_BOTTOM_Y, z: cellMinZ }, { x: cellMaxX, y: WALL_TOP_Y, z: cellMinZ }),
            wallBlock
          );
        } catch (e) {}
      }
    }
  }
}

function placePatchLights(dimension, patchX, patchZ, maze, patchMinX, patchMinZ, runSeed) {
  for (let cx = 0; cx < CELLS_PER_SIDE; cx++) {
    for (let cz = 0; cz < CELLS_PER_SIDE; cz++) {
      const cell = maze[cx][cz];
      const cellMinX = patchMinX + cx * CELL_SIZE;
      const cellMinZ = patchMinZ + cz * CELL_SIZE;
      const midX = cellMinX + Math.floor(CELL_SIZE / 2);
      const midZ = cellMinZ + Math.floor(CELL_SIZE / 2);

      const isEscapeCell = isEscapeCellForAnyPlayer(patchX, patchZ, cx, cz);
      if (isEscapeCell) continue;

      const cellRng = mulberry32(noise2D(patchX * 17 + cx, patchZ * 19 + cz, runSeed));
      if (cellRng() < 0.62) {
        setBlockSafe(dimension, { x: midX, y: CEILING_Y, z: midZ }, BLOCK.seaLantern);
      }
      if (cellRng() < 0.3) {
        setBlockSafe(dimension, { x: midX - 2, y: CEILING_Y, z: midZ }, BLOCK.seaLantern);
      }
      if (cellRng() < 0.3) {
        setBlockSafe(dimension, { x: midX + 2, y: CEILING_Y, z: midZ }, BLOCK.seaLantern);
      }
    }
  }
}

function isEscapeCellForAnyPlayer(patchX, patchZ, cx, cz) {
  for (const escape of state.activeEscapes.values()) {
    if (escape.patchX === patchX && escape.patchZ === patchZ && escape.cellX === cx && escape.cellZ === cz) {
      return true;
    }
  }
  return false;
}

function placeDecorations(dimension, patchX, patchZ, maze, patchMinX, patchMinZ, staticDressing = false, runSeed = WORLD_GENERATION_SEED) {
  for (let cx = 0; cx < CELLS_PER_SIDE; cx++) {
    for (let cz = 0; cz < CELLS_PER_SIDE; cz++) {
      if (isEscapeCellForAnyPlayer(patchX, patchZ, cx, cz)) continue;

      const cellMinX = patchMinX + cx * CELL_SIZE;
      const cellMinZ = patchMinZ + cz * CELL_SIZE;
      const cellMaxX = cellMinX + CELL_SIZE - 1;
      const cellMaxZ = cellMinZ + CELL_SIZE - 1;
      const rng = mulberry32(noise2D(patchX * 13 + cx, patchZ * 11 + cz, runSeed));

      // Corner pillars
      if (rng() < 0.4) {
        setBlockSafe(dimension, { x: cellMinX, y: GROUND_Y + 1, z: cellMinZ }, BLOCK.strippedBirchLog);
        setBlockSafe(dimension, { x: cellMinX, y: GROUND_Y + 2, z: cellMinZ }, BLOCK.strippedBirchLog);
      }
      if (rng() < 0.4) {
        setBlockSafe(dimension, { x: cellMaxX, y: GROUND_Y + 1, z: cellMaxZ }, BLOCK.strippedBirchLog);
        setBlockSafe(dimension, { x: cellMaxX, y: GROUND_Y + 2, z: cellMaxZ }, BLOCK.strippedBirchLog);
      }

      // Carpet
      if (!staticDressing && rng() < 0.15) {
        const carpetType = rng() < 0.5 ? BLOCK.yellowCarpet : BLOCK.whiteCarpet;
        const carpetX = cellMinX + 2 + Math.floor(rng() * 4);
        const carpetZ = cellMinZ + 2 + Math.floor(rng() * 4);
        setBlockSafe(dimension, { x: carpetX, y: GROUND_Y + 1, z: carpetZ }, carpetType);
      }

      // Cracked floor tiles
      if (!staticDressing && rng() < 0.2) {
        const crackX = cellMinX + 1 + Math.floor(rng() * 6);
        const crackZ = cellMinZ + 1 + Math.floor(rng() * 6);
        setBlockSafe(dimension, { x: crackX, y: GROUND_Y, z: crackZ }, BLOCK.yellowTerracotta);
      }

      // Surface-only decay: at most one wall swap and one ceiling accent per cell.
      // This stays under 32 additional single-block writes per 32x32 patch.
      if (!staticDressing && rng() < 0.72) {
        const cell = maze[cx][cz];
        const closed = [];
        if (!cell.north) closed.push("north");
        if (!cell.south) closed.push("south");
        if (!cell.west) closed.push("west");
        if (!cell.east) closed.push("east");
        if (closed.length > 0) {
          const side = closed[Math.floor(rng() * closed.length)];
          const offset = 2 + Math.floor(rng() * 4);
          const stainBlock = rng() < 0.65 ? BLOCK.yellowTerracotta : BLOCK.smoothSandstone;
          const stain =
            side === "north" ? { x: cellMinX + offset, y: GROUND_Y + 2, z: cellMinZ } :
            side === "south" ? { x: cellMinX + offset, y: GROUND_Y + 2, z: cellMaxZ } :
            side === "west" ? { x: cellMinX, y: GROUND_Y + 2, z: cellMinZ + offset } :
            { x: cellMaxX, y: GROUND_Y + 2, z: cellMinZ + offset };
          setBlockSafe(dimension, stain, stainBlock);
        }
      }

      if (!staticDressing && rng() < 0.36) {
        const panelX = cellMinX + 2 + Math.floor(rng() * 4);
        const panelZ = cellMinZ + 2 + Math.floor(rng() * 4);
        setBlockSafe(
          dimension,
          { x: panelX, y: CEILING_Y, z: panelZ },
          rng() < 0.72 ? BLOCK.blackConcrete : BLOCK.strippedBirchLog,
        );
      }
    }
  }
}

async function scheduleYellowHallsModule(dimension, patchX, patchZ, maze, patchMinX, patchMinZ, runSeed, padReservations = []) {
  // Half the generated patches receive one authored focal module. The exact
  // choice and cell are deterministic for a run, so refreshes remain stable.
  const seed = visualHashCoords(patchX, patchZ, runSeed);
  if (seed % 2 !== 0) return;

  const spec = YELLOW_HALLS_MODULES[selectVisualModuleIndex(seed, YELLOW_HALLS_MODULES.length, 1)];
  const reservedBounds = [
    ...(patchX === ENTRY_PATCH.patchX && patchZ === ENTRY_PATCH.patchZ
      ? [{ minX: -3, maxX: 3, minY: 65, maxY: 67, minZ: -3, maxZ: 3 }]
      : []),
    ...padReservations,
  ];
  const candidates = [];
  for (let cx = 0; cx < CELLS_PER_SIDE; cx++) {
    for (let cz = 0; cz < CELLS_PER_SIDE; cz++) {
      if (!yellowHallsModel.isModuleCellEligible(maze, patchX, patchZ, cx, cz, {
        escape: isEscapeCellForAnyPlayer(patchX, patchZ, cx, cz),
        deadEndOnly: spec.deadEndOnly === true,
        requiredClosedSides: spec.requiredClosedSides,
        requiredOpenSides: spec.requiredOpenSides,
      })) continue;
      candidates.push({ cx, cz });
    }
  }
  if (candidates.length === 0) return;

  const orderedCandidates = yellowHallsModel.orderModuleCandidates(candidates, seed >>> 4);
  for (const candidate of orderedCandidates) {
    if (!yellowHallsModel.isModuleCellEligible(maze, patchX, patchZ, candidate.cx, candidate.cz, {
      escape: isEscapeCellForAnyPlayer(patchX, patchZ, candidate.cx, candidate.cz),
      deadEndOnly: spec.deadEndOnly === true,
      requiredClosedSides: spec.requiredClosedSides,
      requiredOpenSides: spec.requiredOpenSides,
    })) continue;
    const placement = yellowHallsModel.moduleWorldBounds(
      spec,
      candidate.cx,
      candidate.cz,
      patchMinX,
      patchMinZ,
      GROUND_Y,
    );
    if (!yellowHallsModel.isBoundsClear(placement, reservedBounds)) continue;
    await getConnectionPadReservations(dimension, patchX, patchZ);
    const isPlacementAllowed = () => {
      if (isEscapeCellForAnyPlayer(patchX, patchZ, candidate.cx, candidate.cz)) return false;
      refreshActivePlayerConnectionPadAnchors();
      const currentReservations = getCachedConnectionPadReservations(patchX, patchZ);
      const allReservations = [
        ...(patchX === ENTRY_PATCH.patchX && patchZ === ENTRY_PATCH.patchZ
          ? [{ minX: -3, maxX: 3, minY: 65, maxY: 67, minZ: -3, maxZ: 3 }]
          : []),
        ...currentReservations,
      ];
      return yellowHallsModel.isBoundsClear(placement, allReservations);
    };
    if (!isPlacementAllowed()) continue;
    const placed = await scheduleStructurePlacement(
      `yellow-halls:${runSeed}:${patchX}:${patchZ}`,
      spec.id,
      dimension,
      placement.origin,
      {
        owner: `yellow-halls:${patchX}:${patchZ}`,
        isPlacementAllowed,
      },
    );
    if (placed) return true;
    await getConnectionPadReservations(dimension, patchX, patchZ);
    if (!isPlacementAllowed()) continue;
    throw new Error(`Yellow Halls module placement did not complete: ${spec.id} at patch ${patchX}:${patchZ}.`);
  }
  return false;
}

function placeHazards(dimension, patchX, patchZ, maze, patchMinX, patchMinZ, runSeed) {
  for (let cx = 0; cx < CELLS_PER_SIDE; cx++) {
    for (let cz = 0; cz < CELLS_PER_SIDE; cz++) {
      if (isEscapeCellForAnyPlayer(patchX, patchZ, cx, cz)) continue;

      const cellMinX = patchMinX + cx * CELL_SIZE;
      const cellMinZ = patchMinZ + cz * CELL_SIZE;
      const rng = mulberry32(noise2D(patchX * 23 + cx, patchZ * 29 + cz, runSeed));

      // Pressure plates
      if (rng() < 0.06) {
        const plateX = cellMinX + 2 + Math.floor(rng() * 4);
        const plateZ = cellMinZ + 2 + Math.floor(rng() * 4);
        const overlapsTurnBaffle = yellowHallsModel.isTurnBafflePosition(
          patchX,
          patchZ,
          maze,
          cx,
          cz,
          plateX,
          plateZ,
          patchMinX,
          patchMinZ,
        );
        if (!overlapsTurnBaffle) {
          setBlockSafe(dimension, { x: plateX, y: GROUND_Y + 1, z: plateZ }, BLOCK.stonePressurePlate);
        }
      }

      // Fake exit signs on walls
      if (rng() < 0.16) {
        const cell = maze[cx][cz];
        const dirs = [];
        if (!cell.north) dirs.push({ dx: 0, dz: -1, facing: 3 });
        if (!cell.south) dirs.push({ dx: 0, dz: 1, facing: 2 });
        if (!cell.west) dirs.push({ dx: -1, dz: 0, facing: 5 });
        if (!cell.east) dirs.push({ dx: 1, dz: 0, facing: 4 });

        if (dirs.length > 0) {
          const dir = dirs[Math.floor(rng() * dirs.length)];
          const signX = cellMinX + 3 + Math.floor(rng() * 2);
          const signZ = cellMinZ + 3 + Math.floor(rng() * 2);
          let signPos;
          if (dir.dx !== 0) {
            signPos = { x: cellMinX + (dir.dx > 0 ? CELL_SIZE - 1 : 0), y: GROUND_Y + 2, z: signZ };
          } else {
            signPos = { x: signX, y: GROUND_Y + 2, z: cellMinZ + (dir.dz > 0 ? CELL_SIZE - 1 : 0) };
          }

          const block = dimension.getBlock(toBlockPos(signPos));
          if (block) {
            const perm = resolvePermutation(BLOCK.wallSign, { facing_direction: dir.facing });
            if (setBlockPermutationSafe(block, perm)) {
              try {
                const signComp = block.getComponent("minecraft:sign");
                if (signComp && typeof signComp.setText === "function") {
                  signComp.setText("EXIT");
                  if (typeof signComp.setWaxed === "function") {
                    signComp.setWaxed(true);
                  }
                }
              } catch (e) {}
            }
          }
        }
      }
    }
  }
}

function placeChests(dimension, patchX, patchZ, maze, patchMinX, patchMinZ, runSeed) {
  for (let cx = 0; cx < CELLS_PER_SIDE; cx++) {
    for (let cz = 0; cz < CELLS_PER_SIDE; cz++) {
      if (isEscapeCellForAnyPlayer(patchX, patchZ, cx, cz)) continue;

      const cell = maze[cx][cz];
      const connections = countConnections(cell);
      if (connections > 2 || yellowHallsModel.isOrthogonalTurn(cell)) continue;

      const cellMinX = patchMinX + cx * CELL_SIZE;
      const cellMinZ = patchMinZ + cz * CELL_SIZE;
      const rng = mulberry32(noise2D(patchX * 41 + cx, patchZ * 43 + cz, runSeed));

      if (rng() < 0.12) {
        const chestX = cellMinX + 2 + Math.floor(rng() * 4);
        const chestZ = cellMinZ + 2 + Math.floor(rng() * 4);
        const chestPos = toBlockPos({ x: chestX, y: GROUND_Y + 1, z: chestZ });

        setBlockSafe(dimension, chestPos, BLOCK.chest);

        try {
          const block = dimension.getBlock(chestPos);
          if (block) {
            const invComp = block.getComponent("minecraft:inventory");
            const container = invComp ? invComp.container : undefined;
            if (container) {
              for (const loot of LOOT_TABLE) {
                if (rng() < 0.5) {
                  const item = new ItemStack(loot.type, loot.count);
                  if (typeof container.addItem === "function") {
                    container.addItem(item);
                  } else {
                    for (let slot = 0; slot < container.size; slot++) {
                      if (!container.getItem(slot)) {
                        container.setItem(slot, item);
                        break;
                      }
                    }
                  }
                }
              }
            }
          }
        } catch (e) {
          // Chest inventory may not be available.
        }
      }
    }
  }
}

function paintPatch(dimension, patchX, patchZ, options = {}) {
  const { minX, minZ, maxX, maxZ } = getPatchBounds(patchX, patchZ);
  const runSeed = options.runSeed ?? getPatchSeed(patchX, patchZ);
  const maze = yellowHallsModel.generatePatchMaze(patchX, patchZ, runSeed);
  const areaId = `yh_${patchX}_${patchZ}`;
  cancelVisualJobs(`yellow-halls:${patchX}:${patchZ}`);

  const from = { x: minX - 2, y: GROUND_Y, z: minZ - 2 };
  const to = { x: maxX + 2, y: CEILING_Y, z: maxZ + 2 };

  return withTickingArea(dimension, areaId, from, to, async () => {
    const padReservations = await getConnectionPadReservations(dimension, patchX, patchZ);
    const writeDimension = createPadProtectedDimension(dimension, padReservations);

    // Clear to air
    writeDimension.fillBlocks(new BlockVolume({ x: minX, y: GROUND_Y, z: minZ }, { x: maxX, y: CEILING_Y, z: maxZ }), BLOCK.air);

    // Floor
    writeDimension.fillBlocks(new BlockVolume({ x: minX, y: GROUND_Y, z: minZ }, { x: maxX, y: GROUND_Y, z: maxZ }), BLOCK.birchPlanks);

    // Ceiling
    writeDimension.fillBlocks(new BlockVolume({ x: minX, y: CEILING_Y, z: minZ }, { x: maxX, y: CEILING_Y, z: maxZ }), BLOCK.birchPlanks);

    // Walls
    for (let cx = 0; cx < CELLS_PER_SIDE; cx++) {
      for (let cz = 0; cz < CELLS_PER_SIDE; cz++) {
        const cell = maze[cx][cz];
        const cellMinX = minX + cx * CELL_SIZE;
        const cellMinZ = minZ + cz * CELL_SIZE;
        const cellMaxX = cellMinX + CELL_SIZE - 1;
        const cellMaxZ = cellMinZ + CELL_SIZE - 1;
        const wallBlock = pickWallBlock(patchX, patchZ, cx, cz, runSeed);

        renderCellWall(writeDimension, cellMinX, cellMinZ, cellMaxX, cellMaxZ, wallBlock, false, true, cell.north);
        renderCellWall(writeDimension, cellMinX, cellMaxZ, cellMaxX, cellMaxZ, wallBlock, false, false, cell.south);
        renderCellWall(writeDimension, cellMinX, cellMinZ, cellMinX, cellMaxZ, wallBlock, true, true, cell.west);
        renderCellWall(writeDimension, cellMaxX, cellMinZ, cellMaxX, cellMaxZ, wallBlock, true, false, cell.east);
      }
    }

    // Static renovation pass: wallpapers, carpet, acoustic ceiling, the
    // multi-state fixture chain, the eight authored bays, the service conduit
    // run and the reserved breaker mount.
    const excludedBaffleCells = new Set();
    if (patchX === ENTRY_PATCH.patchX && patchZ === ENTRY_PATCH.patchZ) {
      excludedBaffleCells.add("0,0");
    }
    for (let cx = 0; cx < CELLS_PER_SIDE; cx++) {
      for (let cz = 0; cz < CELLS_PER_SIDE; cz++) {
        if (isEscapeCellForAnyPlayer(patchX, patchZ, cx, cz)) {
          excludedBaffleCells.add(`${cx},${cz}`);
        }
      }
    }
    applyYellowHallsDressing(writeDimension, patchX, patchZ, maze, minX, minZ, {
      groundY: GROUND_Y,
      ceilingY: CEILING_Y,
      excludedCells: excludedBaffleCells,
    });

    // Lights, decorations, hazards, chests
    placePatchLights(writeDimension, patchX, patchZ, maze, minX, minZ, runSeed);
    placeDecorations(writeDimension, patchX, patchZ, maze, minX, minZ, true, runSeed);
    placeHazards(writeDimension, patchX, patchZ, maze, minX, minZ, runSeed);
    placeChests(writeDimension, patchX, patchZ, maze, minX, minZ, runSeed);
    await scheduleYellowHallsModule(dimension, patchX, patchZ, maze, minX, minZ, runSeed, padReservations);

    const finalReservations = await getConnectionPadReservations(dimension, patchX, patchZ);
    const finalWriteDimension = createPadProtectedDimension(dimension, finalReservations);
    applySpecialSitesForPatch(finalWriteDimension, patchX, patchZ, options);
  });
}

async function withTickingArea(dimension, areaId, from, to, work) {
  const manager = world.tickingAreaManager;
  if (!manager || typeof manager.createTickingArea !== "function") {
    return work();
  }
  await manager.createTickingArea(areaId, { dimension, from, to });
  try {
    return await work();
  } finally {
    try {
      manager.removeTickingArea(areaId);
    } catch (error) {}
  }
}

function getPatchJob(dimension, patchX, patchZ, options = {}) {
  const key = getPatchKey(patchX, patchZ);
  return queueYellowHallsPatchBuild(state.patchJobs, key, options, async (buildOptions) => {
    const buildSeed = getPatchSeed(patchX, patchZ);
    const current = state.generatedPatches.get(key);
    if (!shouldRebuildGeneratedPatch(current, buildSeed, buildOptions.force, state.dirtyPatches.has(key))) {
      return false;
    }
    state.dirtyPatches.delete(key);
    try {
      await paintPatch(dimension, patchX, patchZ, { ...buildOptions, runSeed: buildSeed });
      state.generatedPatches.set(key, { lastBuiltTick: system.currentTick, runSeed: buildSeed });
      if (state.dirtyPatches.has(key) || buildSeed !== getPatchSeed(patchX, patchZ)) {
        system.run(() => {
          void getPatchJob(dimension, patchX, patchZ).catch(() => {});
        });
      }
      return true;
    } catch (error) {
      state.dirtyPatches.add(key);
      console.warn(`[Yellow Halls] Patch build failed at ${patchX}:${patchZ}.`, error);
      return false;
    }
  });
}

function buildEscapeRoom(dimension, escape) {
  const { cellMinX, cellMinZ, cellMaxX, cellMaxZ } = getCellBounds(escape.patchX, escape.patchZ, escape.cellX, escape.cellZ);

  // Clear cell
  try {
    dimension.fillBlocks(new BlockVolume({ x: cellMinX, y: GROUND_Y, z: cellMinZ }, { x: cellMaxX, y: WALL_TOP_Y, z: cellMaxZ }), BLOCK.air);
  } catch (e) {}

  // Floor with cracked path
  dimension.fillBlocks(new BlockVolume({ x: cellMinX, y: GROUND_Y, z: cellMinZ }, { x: cellMaxX, y: GROUND_Y, z: cellMaxZ }), BLOCK.birchPlanks);
  for (let x = cellMinX + 2; x <= cellMinX + 5; x++) {
    for (let z = cellMinZ + 1; z <= cellMaxZ - 1; z++) {
      if ((x + z) % 3 === 0) {
        setBlockSafe(dimension, { x, y: GROUND_Y, z }, BLOCK.yellowTerracotta);
      }
    }
  }

  // Ceiling
  dimension.fillBlocks(new BlockVolume({ x: cellMinX, y: CEILING_Y, z: cellMinZ }, { x: cellMaxX, y: CEILING_Y, z: cellMaxZ }), BLOCK.birchPlanks);

  // Hallway walls (east and west sides)
  const hallLeftX = cellMinX + 2;
  const hallRightX = cellMinX + 5;
  try {
    dimension.fillBlocks(new BlockVolume({ x: cellMinX, y: WALL_BOTTOM_Y, z: cellMinZ }, { x: hallLeftX - 1, y: WALL_TOP_Y, z: cellMaxZ }), BLOCK.yellowConcrete);
    dimension.fillBlocks(new BlockVolume({ x: hallRightX + 1, y: WALL_BOTTOM_Y, z: cellMinZ }, { x: cellMaxX, y: WALL_TOP_Y, z: cellMaxZ }), BLOCK.yellowConcrete);
    // Back wall (south)
    dimension.fillBlocks(new BlockVolume({ x: hallLeftX, y: WALL_BOTTOM_Y, z: cellMaxZ }, { x: hallRightX, y: WALL_TOP_Y, z: cellMaxZ }), BLOCK.yellowConcrete);
  } catch (e) {}

  // Wrong light pattern: only on left side, every other block, some missing
  for (let z = cellMinZ + 1; z <= cellMaxZ - 1; z += 2) {
    if ((z + escape.patchX + escape.patchZ) % 5 !== 0) {
      setBlockSafe(dimension, { x: hallLeftX, y: CEILING_Y, z }, BLOCK.seaLantern);
    }
  }

  // Carpet path (center of hallway leading to door)
  const carpetX = hallLeftX + 1;
  for (let z = cellMinZ + 1; z <= cellMaxZ - 1; z++) {
    setBlockSafe(dimension, { x: carpetX, y: GROUND_Y + 1, z }, BLOCK.yellowCarpet);
  }

  // Button on back wall (facing north = facing_direction 2)
  const buttonPos = { x: carpetX, y: GROUND_Y + 2, z: cellMaxZ };
  const block = dimension.getBlock(toBlockPos(buttonPos));
  if (block) {
    const perm = resolvePermutation(BLOCK.woodenButton, { facing_direction: 2 });
    if (setBlockPermutationSafe(block, perm)) {
      escape.buttonLocation = buttonPos;
    }
  }

  // Static exit wayfinding on the right wall. It is paint and shell only: the
  // button, the reversed sign and their approach keep priority.
  const exitSignX = hallRightX;
  const exitSignZ = cellMinZ + 6;
  const exitSegments = [{ dx: 0, key: "x0_y0_z0" }, { dx: 1, key: "x1_y0_z0" }];
  for (const segment of exitSegments) {
    const exitBlock = dimension.getBlock(toBlockPos({ x: exitSignX + segment.dx, y: WALL_TOP_Y, z: exitSignZ }));
    if (!exitBlock) continue;
    const permutation = resolvePermutation(`paradise:yh_exit_sign_normal_${segment.key}`, {
      "minecraft:cardinal_direction": "west",
    });
    setBlockPermutationSafe(exitBlock, permutation);
  }

  // Reversed sign near the door
  const signPos = { x: hallLeftX, y: GROUND_Y + 2, z: cellMaxZ - 1 };
  const signBlock = dimension.getBlock(toBlockPos(signPos));
  if (signBlock) {
    const signPerm = resolvePermutation(BLOCK.wallSign, { facing_direction: 5 });
    if (setBlockPermutationSafe(signBlock, signPerm)) {
      try {
        const signComp = signBlock.getComponent("minecraft:sign");
        if (signComp && typeof signComp.setText === "function") {
          signComp.setText("TIXE");
          if (typeof signComp.setWaxed === "function") {
            signComp.setWaxed(true);
          }
        }
      } catch (e) {}
    }
  }
}

function applySpecialSitesForPatch(dimension, patchX, patchZ, options = {}) {
  if (patchX === ENTRY_PATCH.patchX && patchZ === ENTRY_PATCH.patchZ) {
    const loc = toBlockPos(ENTRY_CENTER);
    const r = SPAWN_CLEAR_RADIUS;
    clearArea(dimension, ENTRY_CENTER, SPAWN_CLEAR_RADIUS, GROUND_Y, CEILING_Y);
    try {
      dimension.fillBlocks(
        new BlockVolume({ x: loc.x - r, y: GROUND_Y, z: loc.z - r }, { x: loc.x + r, y: GROUND_Y, z: loc.z + r }),
        BLOCK.birchPlanks
      );
      dimension.fillBlocks(
        new BlockVolume({ x: loc.x - r, y: CEILING_Y, z: loc.z - r }, { x: loc.x + r, y: CEILING_Y, z: loc.z + r }),
        BLOCK.birchPlanks
      );
    } catch (e) {}
  }

  for (const [playerId, escape] of state.activeEscapes.entries()) {
    if (state.pendingEscapes.has(playerId) && !options.includePendingEscapePlayerIds?.has(playerId)) continue;
    if (escape.patchX !== patchX || escape.patchZ !== patchZ) continue;
    buildEscapeRoom(dimension, escape);
  }
}

function chooseEscapeLocation(origin, playerId) {
  const occupiedPatches = new Set();
  for (const [otherPlayerId, escape] of state.activeEscapes.entries()) {
    if (otherPlayerId === playerId) continue;
    occupiedPatches.add(getPatchKey(escape.patchX, escape.patchZ));
  }

  try {
    for (const otherPlayer of world.getAllPlayers()) {
      if (otherPlayer.id === playerId || otherPlayer.dimension?.id !== DIMENSION_ID) continue;
      const otherPatch = getPatchCoordsFromBlockPos(otherPlayer.location);
      for (let dx = -ACTIVE_PATCH_RADIUS; dx <= ACTIVE_PATCH_RADIUS; dx++) {
        for (let dz = -ACTIVE_PATCH_RADIUS; dz <= ACTIVE_PATCH_RADIUS; dz++) {
          occupiedPatches.add(getPatchKey(otherPatch.patchX + dx, otherPatch.patchZ + dz));
        }
      }
    }
  } catch (error) {
    console.warn("[Yellow Halls] Could not inspect other players while reserving an escape patch.", error);
  }

  const base = toBlockPos(origin);

  for (let attempt = 0; attempt < 24; attempt++) {
    const distance = randomInt(ESCAPE_MIN_DISTANCE, ESCAPE_MAX_DISTANCE);
    const angle = Math.random() * Math.PI * 2;

    let x = base.x + Math.round(Math.cos(angle) * distance);
    let z = base.z + Math.round(Math.sin(angle) * distance);
    let patchX = Math.floor(x / PATCH_SIZE);
    let patchZ = Math.floor(z / PATCH_SIZE);
    const key = getPatchKey(patchX, patchZ);

    if (occupiedPatches.has(key)) continue;
    if (patchX === ENTRY_PATCH.patchX && patchZ === ENTRY_PATCH.patchZ) continue;

    const bounds = getPatchBounds(patchX, patchZ);
    const safeMargin = 2;
    x = clamp(x, bounds.minX + safeMargin, bounds.maxX - safeMargin);
    z = clamp(z, bounds.minZ + safeMargin, bounds.maxZ - safeMargin);

    const cellX = Math.floor((x - bounds.minX) / CELL_SIZE);
    const cellZ = Math.floor((z - bounds.minZ) / CELL_SIZE);

    return {
      location: { x, y: GROUND_Y + 1, z },
      patchX,
      patchZ,
      cellX: clamp(cellX, 0, CELLS_PER_SIDE - 1),
      cellZ: clamp(cellZ, 0, CELLS_PER_SIDE - 1),
    };
  }

  for (let offset = 0; offset < 64; offset += 1) {
    const fallbackX = base.x + ESCAPE_MIN_DISTANCE + offset * PATCH_SIZE;
    const fallbackZ = base.z;
    const patchX = Math.floor(fallbackX / PATCH_SIZE);
    const patchZ = Math.floor(fallbackZ / PATCH_SIZE);
    const key = getPatchKey(patchX, patchZ);
    if (occupiedPatches.has(key) || (patchX === ENTRY_PATCH.patchX && patchZ === ENTRY_PATCH.patchZ)) continue;
    const bounds = getPatchBounds(patchX, patchZ);
    return {
      location: { x: fallbackX, y: GROUND_Y + 1, z: fallbackZ },
      patchX,
      patchZ,
      cellX: clamp(Math.floor((fallbackX - bounds.minX) / CELL_SIZE), 0, CELLS_PER_SIDE - 1),
      cellZ: clamp(Math.floor((fallbackZ - bounds.minZ) / CELL_SIZE), 0, CELLS_PER_SIDE - 1),
    };
  }

  throw new Error("Unable to reserve a unique Yellow Halls escape patch.");
}

function assignEscape(playerId, origin) {
  const choice = chooseEscapeLocation(origin, playerId);
  choice.runSeed = getPatchSeed(choice.patchX, choice.patchZ);
  state.activeEscapes.set(playerId, choice);
  return choice;
}

async function ensureTerrainAroundLocation(location, radiusPatches = ACTIVE_PATCH_RADIUS, options = {}) {
  const { patchX, patchZ } = getPatchCoordsFromBlockPos(location);
  for (let dx = -radiusPatches; dx <= radiusPatches; dx++) {
    for (let dz = -radiusPatches; dz <= radiusPatches; dz++) {
      await getPatchJob(getYellowHallsDimension(), patchX + dx, patchZ + dz, options);
    }
  }
}

async function prepareEscapeSite(playerId, options = {}) {
  const escape = state.activeEscapes.get(playerId);
  if (!escape) return;
  const needsForce = escape.buttonLocation === undefined;
  const patchOptions = { force: needsForce };
  if (options.includePendingEscape === true) {
    patchOptions.includePendingEscapePlayerIds = new Set([playerId]);
  }
  await getPatchJob(getYellowHallsDimension(), escape.patchX, escape.patchZ, patchOptions);
}

async function bootstrapYellowHallsWorld() {
  if (!state.bootstrapPromise) {
    state.bootstrapPromise = (async () => {
      const dimension = getYellowHallsDimension();
      try {
        await ensureTerrainAroundLocation(ENTRY_CENTER, 1, { force: true });
      } catch (error) {
        // Entry can still work without the first patch fully painted. The
        // maintenance loop retries terrain generation around active players.
      }
      setCalmWeather(dimension);
      state.nextWeatherRefreshTick = system.currentTick + WEATHER_REFRESH_TICKS;
      state.bootstrapReady = true;
    })().catch((error) => {
      state.bootstrapPromise = null;
      throw error;
    });
  }
  return state.bootstrapPromise;
}

function waitTicks(ticks) {
  return new Promise((resolve) => {
    system.runTimeout(() => resolve(), ticks);
  });
}

function setCalmWeather(dimension) {
  try {
    dimension.setWeather(WeatherType.Clear, 20 * 60 * 20);
  } catch (error) {}
}

function getSavedReturnPoint(playerId) {
  return state.returnPoints.get(playerId);
}

function storeReturnPoint(playerId, fromDimension, fromLocation) {
  state.returnPoints.set(playerId, {
    dimensionId: fromDimension.id,
    location: { x: fromLocation.x, y: fromLocation.y, z: fromLocation.z },
  });
}

function getActiveEscape(playerId) {
  return state.activeEscapes.get(playerId);
}

async function escapePlayerFromYellowHalls(player) {
  if (!player || state.pendingEscapes.has(player.id)) return false;

  const escape = getActiveEscape(player.id);
  const returnDestination = resolveSavedReturnDestination(getSavedReturnPoint(player.id));
  if (!escape || !returnDestination) return false;

  state.pendingEscapes.add(player.id);

  try {
    escape.buttonLocation = undefined;
    const rebuilt = await getPatchJob(getYellowHallsDimension(), escape.patchX, escape.patchZ, {
      force: true,
    });
    if (!rebuilt) throw new Error("Escape patch rebuild did not complete.");

    const targetDimension = world.getDimension(returnDestination.dimensionId);
    const returned = await verifiedPlayerTeleport(player, returnDestination.location, {
      dimension: targetDimension,
      checkForBlocks: false,
      keepVelocity: false,
    }, { attempts: 8, retryTicks: 4, maxDistance: 64 });
    if (!returned) {
      throw new Error("Return teleport verification failed.");
    }
    return true;
  } catch (error) {
    await prepareEscapeSite(player.id, { includePendingEscape: true });
    return false;
  } finally {
    state.pendingEscapes.delete(player.id);
  }
}

function getYellowConfidenceState(playerId) {
  return getOrCreateRuleState(state.confidenceRules, playerId, () => ({
    pressure: 0,
    straightTicks: 0,
    sprintTicks: 0,
    fakeExitTrust: 0,
    recentLocations: [],
    cooldowns: new Map(),
  }));
}

function mutateNearbyYellowWarningSigns(dimension, player, ruleState, text = "WALK") {
  if (!canTrigger(ruleState, "sign-mutate", 20 * 12)) return;
  const base = toBlockPos(player.location);
  const options = [
    { x: base.x + 2, y: GROUND_Y + 1, z: base.z },
    { x: base.x - 2, y: GROUND_Y + 1, z: base.z },
    { x: base.x, y: GROUND_Y + 1, z: base.z + 2 },
    { x: base.x, y: GROUND_Y + 1, z: base.z - 2 },
  ];
  const choice = options[Math.floor(Math.random() * options.length)];
  setStandingSign(dimension, choice, text, BLOCK.standingSign);
}

function clearYellowPatchNeighborhood(playerLocation, playerId, radius = 1) {
  const { patchX, patchZ } = getPatchCoordsFromBlockPos(playerLocation);
  const protectedPatches = new Set();

  for (const escape of state.activeEscapes.values()) {
    protectedPatches.add(getPatchKey(escape.patchX, escape.patchZ));
  }

  try {
    for (const otherPlayer of world.getAllPlayers()) {
      if (otherPlayer.id === playerId || otherPlayer.dimension?.id !== DIMENSION_ID) continue;
      const otherPatch = getPatchCoordsFromBlockPos(otherPlayer.location);
      for (let dx = -ACTIVE_PATCH_RADIUS; dx <= ACTIVE_PATCH_RADIUS; dx++) {
        for (let dz = -ACTIVE_PATCH_RADIUS; dz <= ACTIVE_PATCH_RADIUS; dz++) {
          protectedPatches.add(getPatchKey(otherPatch.patchX + dx, otherPatch.patchZ + dz));
        }
      }
    }
  } catch (error) {
    return { patchX, patchZ, changed: 0 };
  }

  const changed = yellowHallsModel.advancePatchSeeds(
    state.patchSeeds,
    state.dirtyPatches,
    patchX,
    patchZ,
    radius,
    protectedPatches,
    WORLD_GENERATION_SEED,
  );
  return { patchX, patchZ, changed };
}

function warnYellowConfidence(player, dimension, ruleState) {
  if (!canTrigger(ruleState, "warning", 20 * 10)) return;
  safePlaySound(dimension, "ambient.cave", player.location, { volume: 0.6, pitch: 0.55 });
  safeSpawnParticle(dimension, "minecraft:basic_smoke_particle", addVec(player.location, 0, 0.8, 0));
  requestRuleVhs(player, VHS_TIER.Low, 20 * 5, "yellow-confidence-warning");
  mutateNearbyYellowWarningSigns(dimension, player, ruleState, Math.random() < 0.5 ? "WALK" : "TOO SURE");
}

function punishYellowConfidence(player, dimension, ruleState) {
  const scareDecision = tryBeginRuleScare(player, ruleState, "consequence", 20 * 45, {
    source: "dimension_scare:yellow_confidence_loop",
    intensity: 4,
    minimumQuietTicks: 20 * 45,
    buildupTicks: 20 * 4,
    peakTicks: 20 * 8,
    reliefTicks: 20 * 20,
    globalCooldownTicks: 20 * 60,
    playerCooldownTicks: 20 * 70,
  });
  if (!scareDecision.allowed) return;
  ruleState.pressure = Math.max(0, ruleState.pressure - 9);
  const remembered = pickRememberedLocation(ruleState, addVec(ENTRY_CENTER, 0, 2, 0));
  clearYellowPatchNeighborhood(player.location, player.id, 1);
  safeTitle(player, "The halls correct you.", "Walk as if the walls are listening.", 45);
  safeAddEffect(player, "minecraft:blindness", 45, { amplifier: 0, showParticles: false });
  requestRuleVhs(player, VHS_TIER.High, 20 * 8, "yellow-confidence-loop");
  mutateNearbyYellowWarningSigns(dimension, player, ruleState, "NOT THAT WAY");
  system.run(() => {
    void (async () => {
      try {
        const moved = await verifiedPlayerTeleport(player, {
          x: remembered.x,
          y: ENTRY_TELEPORT_Y,
          z: remembered.z,
        }, {
          dimension,
          checkForBlocks: false,
          keepVelocity: false,
        }, { attempts: 6, retryTicks: 3, maxDistance: 48 });
        if (moved) await ensureTerrainAroundLocation(player.location, 1);
      } catch (error) {
        console.warn("[Yellow Halls] Confidence correction failed.", error);
      }
    })();
  });
}

function updateYellowConfidenceRule(dimension, player) {
  if (state.pendingEscapes.has(player.id)) return;
  const ruleState = getYellowConfidenceState(player.id);
  const motion = sampleMotion(ruleState, player.location);
  rememberLocation(ruleState, player.location, 7);

  const isSprinting = motion.horizontalSpeed >= 0.17;
  const isWalkingOrStill = motion.horizontalSpeed <= 0.10;

  if (isSprinting) {
    ruleState.sprintTicks += motion.dt;
    ruleState.pressure += 1.2;
  } else {
    ruleState.sprintTicks = Math.max(0, ruleState.sprintTicks - motion.dt * 2);
  }

  if (motion.straight && motion.horizontalDistance > 0.6) {
    ruleState.straightTicks += motion.dt;
    ruleState.pressure += 0.5;
  } else {
    ruleState.straightTicks = Math.max(0, ruleState.straightTicks - motion.dt);
  }

  if (isWalkingOrStill) {
    ruleState.pressure = Math.max(0, ruleState.pressure - 0.9);
  }

  if (ruleState.pressure >= 7 || ruleState.sprintTicks >= 20) {
    warnYellowConfidence(player, dimension, ruleState);
  }

  if (ruleState.pressure >= 18 || ruleState.sprintTicks >= 55 || ruleState.straightTicks >= 80) {
    punishYellowConfidence(player, dimension, ruleState);
  }
}

function clearStateForLeavingPlayer(playerId) {
  state.pendingEscapes.delete(playerId);
  state.activeEscapes.delete(playerId);
  state.returnPoints.delete(playerId);
  state.playerConnectionPadAnchors.delete(playerId);
  clearRuleState(state.confidenceRules, playerId);
}

function isEscapeButtonLocation(playerId, location) {
  const escape = getActiveEscape(playerId);
  if (!escape || !escape.buttonLocation) return false;
  const block = toBlockPos(location);
  const btn = toBlockPos(escape.buttonLocation);
  return block.x === btn.x && block.y === btn.y && block.z === btn.z;
}

function isNearEscapeButton(playerId, location, radius = 3) {
  const escape = getActiveEscape(playerId);
  if (!escape || !escape.buttonLocation) return false;
  const dx = location.x - (escape.buttonLocation.x + 0.5);
  const dy = location.y - (escape.buttonLocation.y + 0.5);
  const dz = location.z - (escape.buttonLocation.z + 0.5);
  return dx * dx + dy * dy + dz * dz <= radius * radius;
}

function handlePlayerInteractWithBlock(event) {
  const player = event.player;
  const block = event.block;
  if (!player || !block || !isYellowHallsDimension(player.dimension)) return;
  if (state.pendingEscapes.has(player.id)) return;

  // Fake exit signs teleport player back to entry
  if (block.typeId.endsWith('_wall_sign') || block.typeId.endsWith('_sign')) {
    try {
      const signComp = block.getComponent("minecraft:sign");
      if (signComp && signComp.getText && signComp.getText() === "EXIT") {
        system.run(() => {
          try {
            const ruleState = getYellowConfidenceState(player.id);
          ruleState.fakeExitTrust = (ruleState.fakeExitTrust || 0) + 1;
          ruleState.pressure += 4;
          warnYellowConfidence(player, player.dimension, ruleState);
          player.sendMessage("The exit loops back on itself...");
          } catch (e) {}
          void verifiedPlayerTeleport(player, addVec(ENTRY_CENTER, 0, 2, 0), {
            dimension: player.dimension,
            checkForBlocks: false,
          }, { attempts: 6, retryTicks: 3, maxDistance: 48 });
        });
      }
    } catch (e) {}
    return;
  }

  // Escape button
  if (isEscapeButtonLocation(player.id, block.location)) {
    system.run(() => {
      void escapePlayerFromYellowHalls(player).catch(() => {});
    });
  }
}

function handlePlayerBreakBlock(event) {
  const player = event.player;
  const block = event.block;
  if (!player || !block || !isYellowHallsDimension(player.dimension)) return;

  if (isEscapeButtonLocation(player.id, block.location)) {
    event.cancel = true;
    return;
  }

  // Preserve the old self-repair behavior without repainting every active patch
  // on a timer. Only a patch that was actually modified is regenerated.
  markPatchDirtyAt(block.location);
}

function handlePlayerPlaceBlock(event) {
  const player = event.player;
  const block = event.block;
  if (!player || !block || !isYellowHallsDimension(player.dimension)) return;
  markPatchDirtyAt(block.location);
}

function handleBlockExplode(event) {
  if (!event?.block || !isYellowHallsDimension(event.dimension)) return;
  markPatchDirtyAt(event.block.location);
}

function handlePlayerDimensionChange(event) {
  const player = event.player;
  if (!player) return;

  const enteredYellowHalls =
    event.toDimension && event.toDimension.id === DIMENSION_ID &&
    event.fromDimension && event.fromDimension.id !== DIMENSION_ID;

  const leftYellowHalls =
    event.fromDimension && event.fromDimension.id === DIMENSION_ID &&
    event.toDimension && event.toDimension.id !== DIMENSION_ID;

  if (enteredYellowHalls) {
    clearStateForLeavingPlayer(player.id);
    storeReturnPoint(player.id, event.fromDimension, event.fromLocation);
    refreshPlayerConnectionPadAnchor(player, true);
    const origin = event.toLocation ? event.toLocation : ENTRY_CENTER;
    assignEscape(player.id, origin);

    try {
      player.sendMessage("§cHint: §7A hidden button somewhere in the halls is your escape. The halls dislike running feet.");
    } catch (error) {}

    system.run(() => {
      void ensureTerrainAroundLocation(origin, 1).catch((error) => {
        console.warn("[Yellow Halls] Entry terrain preparation failed.", error);
      });
      try {
        setStandingSign(event.toDimension, { x: ENTRY_CENTER.x + 2, y: GROUND_Y + 1, z: ENTRY_CENTER.z }, "WALK\nTHE MAZE\nCOUNTS\nSTEPS", BLOCK.standingSign);
      } catch (_error) {}
      void prepareEscapeSite(player.id).catch(() => {});
    });
    return;
  }

  if (leftYellowHalls) {
    clearStateForLeavingPlayer(player.id);
  }
}

function handleEntitySpawn(event) {
  const entity = event.entity;
  if (!entity || !entity.isValid || !entity.dimension || entity.dimension.id !== DIMENSION_ID) return;
  if (ALLOWED_ENTITY_IDS.has(entity.typeId)) return;

  system.run(() => {
    try {
      entity.remove();
    } catch (error) {}
  });
}

async function maintainYellowHallsWorld() {
  if (state.maintenanceRunning || !state.bootstrapReady) return;

  const dimension = getYellowHallsDimension();
  const players = dimension.getPlayers();

  if (!players.length) {
    if (state.flickerOn || state.flickeredLights.size > 0) {
      restoreFlickeredLights(dimension);
      state.nextFlickerTick = system.currentTick + randomInt(FLICKER_MIN_GAP_TICKS, FLICKER_MAX_GAP_TICKS);
    }
    if (system.currentTick >= state.nextWeatherRefreshTick) {
      setCalmWeather(dimension);
      state.nextWeatherRefreshTick = system.currentTick + WEATHER_REFRESH_TICKS;
    }
    return;
  }

  state.maintenanceRunning = true;

  try {
    if (system.currentTick >= state.nextWeatherRefreshTick) {
      setCalmWeather(dimension);
      state.nextWeatherRefreshTick = system.currentTick + WEATHER_REFRESH_TICKS;
    }

    for (const player of players) {
      if (!player || !isYellowHallsDimension(player.dimension)) continue;

      refreshPlayerConnectionPadAnchor(player);
      await ensureTerrainAroundLocation(player.location, ACTIVE_PATCH_RADIUS);

      // Remove stray entities
      try {
        const nearbyEntities = dimension.getEntities({ location: player.location, maxDistance: 48 });
        for (const entity of nearbyEntities) {
          if (entity.typeId === "minecraft:player") continue;
          if (ALLOWED_ENTITY_IDS.has(entity.typeId)) continue;
          try {
            entity.remove();
          } catch (e) {}
        }
      } catch (e) {}

      // Spawn mobs if density is low
      spawnMobsIfNeeded(dimension, player);

      // Check pressure plate traps
      checkPressurePlates(dimension, player);

      // Flicker lights
      flickerLightsNearPlayer(dimension, player);

      // Rule: the maze punishes confidence. Sprinting and straight-line certainty bend the halls.
      updateYellowConfidenceRule(dimension, player);
      maybePlayYellowHallsAudio(player, {
        confidencePressure: getYellowConfidenceState(player.id).pressure,
      });

      const escape = getActiveEscape(player.id);
      if (escape && !state.pendingEscapes.has(player.id)) {
        if (escape.buttonLocation === undefined) {
          await prepareEscapeSite(player.id);
        }
      }
    }
  } finally {
    state.maintenanceRunning = false;
  }
}

function spawnMobsIfNeeded(dimension, player) {
  try {
    const nearby = dimension.getEntities({ location: player.location, maxDistance: MOB_DENSITY_RADIUS });
    let mobCount = 0;
    for (const entity of nearby) {
      if (MOB_IDS.includes(entity.typeId)) mobCount++;
    }
    if (mobCount >= MAX_MOBS_PER_PLAYER) return;

    for (let i = 0; i < 2; i++) {
      if (mobCount >= MAX_MOBS_PER_PLAYER) break;
      const angle = Math.random() * Math.PI * 2;
      const distance = 10 + Math.random() * 20;
      const x = Math.floor(player.location.x + Math.cos(angle) * distance);
      const z = Math.floor(player.location.z + Math.sin(angle) * distance);
      const mobId = MOB_IDS[Math.floor(Math.random() * MOB_IDS.length)];
      try {
        dimension.spawnEntity(mobId, { x, y: GROUND_Y + 1, z });
        mobCount++;
      } catch (e) {}
    }
  } catch (e) {}
}

function checkPressurePlates(dimension, player) {
  try {
    const blockPos = toBlockPos(player.location);
    blockPos.y = GROUND_Y + 1;
    const block = dimension.getBlock(blockPos);
    if (block && block.typeId === BLOCK.stonePressurePlate) {
      // Spawn a husk nearby as a trap
      const offsetX = randomInt(-2, 2);
      const offsetZ = randomInt(-2, 2);
      try {
        dimension.spawnEntity("minecraft:husk", {
          x: blockPos.x + offsetX,
          y: GROUND_Y + 1,
          z: blockPos.z + offsetZ,
        });
      } catch (e) {}
    }
  } catch (e) {}
}

function restoreFlickeredLights(dimension) {
  for (const [posKey, originalPermutation] of state.flickeredLights.entries()) {
    const [x, y, z] = posKey.split(":").map(Number);
    const position = { x, y, z };
    try {
      if (typeof dimension.isChunkLoaded === "function" && !dimension.isChunkLoaded(position)) {
        continue;
      }
      const block = dimension.getBlock(position);
      if (block && setBlockPermutationSafe(block, originalPermutation)) {
        state.flickeredLights.delete(posKey);
      }
    } catch (_error) {}
  }
  state.flickerOn = false;
}

function flickerLightsNearPlayer(dimension, player) {
  const now = system.currentTick;

  // A light from an earlier burst may have been in an unloaded chunk when its
  // restore window elapsed. Retry loaded pending entries without discarding the
  // positions that are still unavailable.
  if (!state.flickerOn && state.flickeredLights.size > 0) {
    restoreFlickeredLights(dimension);
  }

  if (state.flickerOn) {
    if (now < state.flickerRestoreTick) return;
    restoreFlickeredLights(dimension);
    state.nextFlickerTick = now + randomInt(FLICKER_MIN_GAP_TICKS, FLICKER_MAX_GAP_TICKS);
    return;
  }

  if (now < state.nextFlickerTick) return;

  const px = Math.floor(player.location.x);
  const pz = Math.floor(player.location.z);
  const targetCount = randomInt(1, 3);
  let disabled = 0;

  for (let attempt = 0; attempt < 18 && disabled < targetCount; attempt++) {
    const position = {
      x: px + randomInt(-12, 12),
      y: CEILING_Y,
      z: pz + randomInt(-12, 12),
    };
    try {
      if (typeof dimension.isChunkLoaded === "function" && !dimension.isChunkLoaded(position)) {
        continue;
      }
      const block = dimension.getBlock(position);
      if (!block || block.typeId !== BLOCK.seaLantern) continue;
      const posKey = `${position.x}:${position.y}:${position.z}`;
      if (state.flickeredLights.has(posKey)) continue;
      state.flickeredLights.set(posKey, block.permutation);
      setBlockPermutationSafe(block, BLOCK.air);
      disabled++;
    } catch (_error) {}
  }

  if (disabled > 0) {
    const burstTicks = randomInt(FLICKER_BURST_MIN_TICKS, FLICKER_BURST_MAX_TICKS);
    state.flickerOn = true;
    state.flickerRestoreTick = now + burstTicks;
    system.runTimeout(() => {
      try {
        if (!state.flickerOn) return;
        restoreFlickeredLights(dimension);
        state.nextFlickerTick = system.currentTick + randomInt(FLICKER_MIN_GAP_TICKS, FLICKER_MAX_GAP_TICKS);
      } catch (_error) {}
    }, burstTicks);
  } else {
    state.nextFlickerTick = now + randomInt(20, 60);
  }
}

function handleEscapeProximity() {
  if (!state.bootstrapReady) return;
  const dimension = getYellowHallsDimension();
  const players = dimension.getPlayers();

  for (const player of players) {
    if (!player || !isYellowHallsDimension(player.dimension)) continue;
    if (state.pendingEscapes.has(player.id)) continue;

    if (isNearEscapeButton(player.id, player.location)) {
      system.run(() => {
        void escapePlayerFromYellowHalls(player).catch(() => {});
      });
    }
  }
}

async function enterYellowHalls(player) {
  if (!player) return false;
  if (isYellowHallsDimension(player.dimension)) return false;

  let lastError = undefined;

  for (let attempt = 0; attempt < ENTRY_RETRY_ATTEMPTS; attempt++) {
    try {
      await bootstrapYellowHallsWorld();

      const dimension = getYellowHallsDimension();
      const entered = await verifiedPlayerTeleport(
        player,
        { x: ENTRY_CENTER.x, y: ENTRY_TELEPORT_Y, z: ENTRY_CENTER.z },
        {
          dimension,
          checkForBlocks: false,
          keepVelocity: false,
          facingLocation: addVec(ENTRY_CENTER, 1, 0, 0),
        },
        { attempts: 8, retryTicks: 4, maxDistance: 48 },
      );
      if (!entered) {
        throw new Error("Yellow Halls teleport verification failed.");
      }

      system.run(() => {
        void ensureTerrainAroundLocation(ENTRY_CENTER, 1).catch((error) => {
          console.warn("[Yellow Halls] Post-entry terrain preparation failed.", error);
        });
      });
      return true;
    } catch (error) {
      lastError = error;
      await waitTicks(ENTRY_RETRY_TICKS);
    }
  }

  throw lastError || new Error("Yellow Halls entry failed.");
}

function runYellowHallsEntryCommand(player) {
  void enterYellowHalls(player).then((entered) => {
    if (!entered) {
      try {
        player.sendMessage("Yellow Halls entry failed. Try again in a moment.");
      } catch (error) {}
    }
  }).catch((error) => {
    try {
      player.sendMessage(`Yellow Halls entry failed: ${String(error)}`);
    } catch (_error) {}
  });
}

function getCommandSourcePlayer(origin) {
  const candidates = [
    origin && origin.sourceEntity,
    origin && origin.initiator,
    origin && origin.source,
  ];

  for (const candidate of candidates) {
    if (candidate && candidate.typeId === "minecraft:player") {
      return candidate;
    }
  }

  const players = getCachedPlayers();
  return players.length === 1 ? players[0] : undefined;
}

function registerStartupHooks(event) {
  try {
    event.dimensionRegistry.registerCustomDimension(DIMENSION_ID);
  } catch (error) {}

  try {
    event.customCommandRegistry.registerCommand(
      {
        name: ENTER_COMMAND_ID,
        description: "Enter the Yellow Halls",
        permissionLevel: CommandPermissionLevel.Any,
        cheatsRequired: false,
        mandatoryParameters: [],
        optionalParameters: [],
      },
      (origin) => {
        system.run(() => {
          const source = getCommandSourcePlayer(origin);
          if (!source || source.typeId !== "minecraft:player") {
            return;
          }
          runYellowHallsEntryCommand(source);
        });
        return { status: CustomCommandStatus.Success, message: "Entering Yellow Halls..." };
      }
    );
  } catch (error) {}
}

function handleChatEnterCommand(event) {
  const message = String(event.message || "").trim().toLowerCase();
  if (message !== CHAT_ENTER_COMMAND) return;
  event.cancel = true;

  system.run(() => {
    const sender = event.sender;
    if (!sender || sender.typeId !== "minecraft:player") return;
    try {
      sender.sendMessage("Entering Yellow Halls...");
    } catch (error) {}
    runYellowHallsEntryCommand(sender);
  });
}

world.afterEvents.worldLoad.subscribe(() => {
  system.run(() => {
    void bootstrapYellowHallsWorld().catch(() => {});
  });
});

world.afterEvents.playerDimensionChange.subscribe(handlePlayerDimensionChange);
world.afterEvents.playerLeave.subscribe((event) => clearStateForLeavingPlayer(event.playerId));
world.afterEvents.playerInteractWithBlock.subscribe(handlePlayerInteractWithBlock);
world.beforeEvents.playerBreakBlock.subscribe(handlePlayerBreakBlock);
world.afterEvents.playerPlaceBlock.subscribe(handlePlayerPlaceBlock);
world.afterEvents.blockExplode.subscribe(handleBlockExplode);
world.beforeEvents.chatSend.subscribe(handleChatEnterCommand);
world.afterEvents.entitySpawn.subscribe(handleEntitySpawn);

system.beforeEvents.startup.subscribe(registerStartupHooks);

system.run(() => {
  void bootstrapYellowHallsWorld().catch(() => {});
});

system.runInterval(() => {
  void maintainYellowHallsWorld().catch(() => {});
}, MAINTENANCE_INTERVAL_TICKS);

system.runInterval(() => {
  handleEscapeProximity();
}, PROXIMITY_CHECK_TICKS);

export { enterYellowHalls };
