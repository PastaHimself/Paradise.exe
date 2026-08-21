import {
  BlockVolume,
  CommandPermissionLevel,
  CustomCommandStatus,
  WeatherType,
  system,
  world,
} from "@minecraft/server";
import {
  VHS_TIER,
  canTrigger,
  requestRuleVhs,
  safeActionBar,
  safePlaySound,
  sampleMotion,
  verifiedPlayerTeleport,
} from "./dimension_horror_rules.js";
import { getCachedPlayerById } from "./paradise_tick_cache.js";
import { hashCoords as visualHashCoords, scheduleStructurePlacement } from "./paradise_visual_jobs.js";

const DIMENSION_ID = "paradise:burning_highway";
const ENTER_COMMAND_ID = "p:enter_burning_highway";
const CHAT_ENTER_COMMAND = "!enter_burning_highway";

// Geometry
const HIGHWAY_LENGTH = 400;
const RUN_DISTANCE_MIN = 260;
const RUN_DISTANCE_MAX = 380;
const HIGHWAY_WIDTH = 7;
const HALF_WIDTH = Math.floor(HIGHWAY_WIDTH / 2);
const ROAD_Y = 64;
const LAVA_Y = 63;
const WALL_HEIGHT = 3;
const WALL_TOP_Y = ROAD_Y + WALL_HEIGHT; // 67
const CEILING_Y = ROAD_Y + 6; // 70
const LANE_SPACING = 1000;
const FINISH_RADIUS = 3;
const FINISH_STILL_REQUIRED_TICKS = 20 * 2;
const FINISH_SPRINT_RESET_SPEED = 0.13;
const DETOUR_SPACING = 55;
const DETOUR_FIRST_Z = 35;
const DETOUR_LENGTH = 16;
const DETOUR_BLOCKADE_LENGTH = 2;
const BRANCH_SPACING = 80;
const BRANCH_LENGTH = 20;
const BRANCH_SHIFT = HIGHWAY_WIDTH + 2;
const START_Z = 0;
const SAFE_START_PAD_LENGTH = 10;
const SAFE_START_PAD_HALF_WIDTH = HALF_WIDTH;

// Collapse
const COLLAPSE_TICK_INTERVAL = 2; // fast baseline pressure; catch-up logic keeps lava near runners
const FIRE_WARNING_DISTANCE = 1;
const UNSTABLE_CHANCE = 0;
const UNSTABLE_DELAY_TICKS = 30; // 1.5 seconds
const LAVA_START_DELAY_SECONDS = 7;
const LAVA_CHASE_GAP_BLOCKS = 7;
const MAX_COLLAPSE_ROWS_PER_STEP = 5;
const LAVA_START_DELAY_TICKS = LAVA_START_DELAY_SECONDS * 20;
const COLLAPSE_START_Z = -8;

// Run overlay
const RUN_OVERLAY_TITLE_TOKEN = "PARADISE_RUN_SHOW";
const RUN_OVERLAY_STAY_TICKS = 40;

// Geysers
const GEYSER_INTERVAL_TICKS = 60;
const GEYSER_DURATION_TICKS = 40;
const GEYSER_COUNT_PER_BURST = 3;

// Static obstacles
const OBSTACLE_FIRST_Z = 22;
const OBSTACLE_MIN_SPACING = 14;
const OBSTACLE_MAX_SPACING = 24;
const OBSTACLE_SAFE_FINISH_GAP = 14;

// Maintenance
const MAINTENANCE_INTERVAL_TICKS = 5;
const ENTITY_CLEANUP_RADIUS = 48;

// Burning Highway watcher chase
// Disabled for this build: the Burning Highway should not spawn or preserve the running stalker entity.
const BURNING_HIGHWAY_WATCHER_ENABLED = false;
const HIGHWAY_RIB_SPACING = 28;
const HIGHWAY_SCENERY = Object.freeze({
  tunnelRib: "paradise:burning_highway/tunnel_rib",
  overpass: "paradise:burning_highway/overpass_ruin",
  lavafall: "paradise:burning_highway/lavafall_frame",
  wreck: "paradise:burning_highway/wreck_cluster",
});
const WATCHER_TYPE_ID = "paradise:watcher";
const WATCHER_SEQUENCE_TAG = "paradise_burning_highway_watcher";
const WATCHER_RUN_ANIM_STATE = 2;
const WATCHER_START_BEHIND_Z = 7;
const WATCHER_START_DELAY_TICKS = 20 * 2;
const WATCHER_CATCH_DISTANCE = 2.35;
const WATCHER_MIN_GAP_BEHIND_PLAYER = 1.25;
const WATCHER_BASE_SPEED_BLOCKS_PER_TICK = 0.20;
const WATCHER_CATCHUP_SPEED_BLOCKS_PER_TICK = 0.30;
const WATCHER_MAX_STEP_BLOCKS = 7.5;

// Blocks
const BLOCK = {
  air: "minecraft:air",
  netherrack: "minecraft:netherrack",
  blackstone: "minecraft:blackstone",
  magma: "minecraft:magma",
  obsidian: "minecraft:obsidian",
  lava: "minecraft:lava",
  fire: "minecraft:fire",
  basalt: "minecraft:basalt",
  glowstone: "minecraft:glowstone",
  soulSand: "minecraft:soul_sand",
  endGateway: "minecraft:end_gateway",
  lightBlock15: "minecraft:light_block_15",
  bedrock: "minecraft:bedrock",
  crackedPolishedBlackstoneBricks: "minecraft:cracked_polished_blackstone_bricks",
  polishedBlackstoneBricks: "minecraft:polished_blackstone_bricks",
};

const ROAD_BLOCK_WEIGHTS = [
  { type: BLOCK.netherrack, weight: 70 },
  { type: BLOCK.blackstone, weight: 22 },
  { type: BLOCK.obsidian, weight: 8 },
];

const SAFE_BLOCKS = new Set([BLOCK.obsidian, BLOCK.magma]);

const ALLOWED_ENTITY_IDS = new Set([
  "minecraft:item",
  "minecraft:player",
  "minecraft:xp_orb",
]);

const state = {
  bootstrapPromise: null,
  bootstrapReady: false,
  maintenanceRunning: false,
  // playerId -> PlayerHighwayState
  activePlayers: new Map(),
  pendingRespawns: new Set(),
  // laneOffset string -> generated finish distance
  generatedLanes: new Map(),
  // laneOffset string -> Set of unstable block keys
  laneUnstableBlocks: new Map(),
  // List of active geysers: { laneOffset, x, y, z, restoreAtTick, originalBlock }
  activeGeysers: [],
  nextGeyserTick: 0,
  nextCollapseTick: 0,
};

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getRandomFinishDistance() {
  return randomInt(RUN_DISTANCE_MIN, RUN_DISTANCE_MAX);
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

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function isInBranchZone(_z) {
  return false;
}

function getBranchCenterX(laneOffset, side) {
  return laneOffset + side * BRANCH_SHIFT;
}

function isInBranchGap(_laneOffset, _x) {
  return false;
}

function getLaneBoundsAtZ(laneOffset, _z) {
  return {
    leftX: laneOffset - HALF_WIDTH,
    rightX: laneOffset + HALF_WIDTH,
    inBranch: false,
  };
}

function getLaneMaxBounds(laneOffset) {
  return {
    leftX: laneOffset - BRANCH_SHIFT - HALF_WIDTH,
    rightX: laneOffset + BRANCH_SHIFT + HALF_WIDTH,
  };
}

function getLaneOffsetForPlayer(playerId) {
  const hash = hashString(playerId);
  return (hash % 100000) * LANE_SPACING;
}

function getBurningHighwayDimension() {
  return world.getDimension(/** @type {any} */ (DIMENSION_ID));
}

function isBurningHighwayDimension(dimension) {
  return !!dimension && dimension.id === DIMENSION_ID;
}

function getDimensionById(dimensionId) {
  try {
    return world.getDimension(dimensionId || "minecraft:overworld");
  } catch (error) {
    return undefined;
  }
}

function chooseWeightedRoadBlock() {
  const total = ROAD_BLOCK_WEIGHTS.reduce((sum, b) => sum + b.weight, 0);
  let roll = randomInt(1, total);
  for (const entry of ROAD_BLOCK_WEIGHTS) {
    roll -= entry.weight;
    if (roll <= 0) {
      return entry.type;
    }
  }
  return BLOCK.netherrack;
}

function getDetourStarts(finishDistance = HIGHWAY_LENGTH) {
  const starts = [];
  for (let z = DETOUR_FIRST_Z; z < finishDistance - DETOUR_LENGTH - 12; z += DETOUR_SPACING) {
    starts.push(z);
  }
  return starts;
}

function buildServiceDetour(dimension, laneOffset, startZ, side) {
  const wallX = laneOffset + side * (HALF_WIDTH + 1);
  const serviceX = laneOffset + side * (HALF_WIDTH + 2);
  const railX = laneOffset + side * (HALF_WIDTH + 3);
  const endZ = startZ + DETOUR_LENGTH;
  const blockadeStart = startZ + 5;
  const blockadeEnd = blockadeStart + DETOUR_BLOCKADE_LENGTH - 1;

  for (let z = startZ; z <= endZ; z++) {
    setBlockSafe(dimension, { x: serviceX, y: ROAD_Y, z }, z % 3 === 0 ? BLOCK.obsidian : BLOCK.basalt);
    setBlockSafe(dimension, { x: serviceX, y: ROAD_Y + 1, z }, BLOCK.air);
    setBlockSafe(dimension, { x: serviceX, y: ROAD_Y + 2, z }, BLOCK.air);
    if (z % 5 === 0) {
      setBlockSafe(dimension, { x: railX, y: ROAD_Y, z }, BLOCK.blackstone);
      setBlockSafe(dimension, { x: railX, y: ROAD_Y + 1, z }, BLOCK.fire);
    }
  }

  // Cut two gates through the side wall so the outside service road is mandatory.
  for (const gateZ of [startZ, endZ]) {
    for (let y = ROAD_Y + 1; y <= WALL_TOP_Y; y++) {
      setBlockSafe(dimension, { x: wallX, y, z: gateZ }, BLOCK.air);
    }
    setBlockSafe(dimension, { x: wallX, y: ROAD_Y, z: gateZ }, BLOCK.obsidian);
  }

  // Burn out the main road for a few rows to force the detour.
  for (let z = blockadeStart; z <= blockadeEnd; z++) {
    for (let x = laneOffset - HALF_WIDTH; x <= laneOffset + HALF_WIDTH; x++) {
      setBlockSafe(dimension, { x, y: ROAD_Y, z }, BLOCK.lava);
    }
  }

  // Visual warning just before the broken section.
  for (let x = laneOffset - HALF_WIDTH; x <= laneOffset + HALF_WIDTH; x += 2) {
    setBlockSafe(dimension, { x, y: ROAD_Y + 1, z: blockadeStart - 2 }, BLOCK.fire);
  }
}

function blockKey(x, y, z) {
  return `${x},${y},${z}`;
}

function setBlockSafe(dimension, location, typeId) {
  try {
    dimension.setBlockType(toBlockPos(location), typeId);
    return true;
  } catch (error) {
    return false;
  }
}

function fillBlocksSafe(dimension, from, to, typeId) {
  try {
    dimension.fillBlocks(new BlockVolume(from, to), typeId);
    return true;
  } catch (error) {
    return false;
  }
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
    } catch (error) {
      // Best effort cleanup.
    }
  }
}

function scheduleHighwayScenery(dimension, laneOffset, finishDistance) {
  // Static authored art is requested only during lane generation. Nothing in
  // the collapse/geyser hot path performs structure work.
  for (let z = 48; z < finishDistance - 24; z += 64) {
    scheduleStructurePlacement(
      `highway-rib:${laneOffset}:${z}`,
      HIGHWAY_SCENERY.tunnelRib,
      dimension,
      { x: laneOffset - 5, y: ROAD_Y, z: z - 1 },
    );
  }

  const sideSeed = visualHashCoords(laneOffset, finishDistance, 0x53494445);
  const placements = [
    { id: HIGHWAY_SCENERY.overpass, z: Math.min(finishDistance - 80, 104 + (sideSeed % 17)), x: laneOffset + HALF_WIDTH + 7 },
    { id: HIGHWAY_SCENERY.lavafall, z: Math.min(finishDistance - 54, 190 + ((sideSeed >>> 5) % 19)), x: laneOffset - HALF_WIDTH - 8 },
    { id: HIGHWAY_SCENERY.wreck, z: Math.min(finishDistance - 30, 286 + ((sideSeed >>> 10) % 23)), x: laneOffset + HALF_WIDTH + 6 },
  ];

  for (let index = 0; index < placements.length; index++) {
    const placement = placements[index];
    if (placement.z <= SAFE_START_PAD_LENGTH + 24 || placement.z >= finishDistance - 18) continue;
    scheduleStructurePlacement(
      `highway-landmark:${laneOffset}:${index}:${placement.z}`,
      placement.id,
      dimension,
      { x: placement.x, y: ROAD_Y, z: placement.z },
    );
  }
}

async function generateHighwayLane(dimension, laneOffset, finishDistance = HIGHWAY_LENGTH) {
  finishDistance = clamp(Math.floor(finishDistance), RUN_DISTANCE_MIN, HIGHWAY_LENGTH);
  const laneKey = String(laneOffset);
  if (state.generatedLanes.get(laneKey) === finishDistance) {
    return;
  }

  const maxBounds = getLaneMaxBounds(laneOffset);
  const minX = maxBounds.leftX - 2;
  const maxX = maxBounds.rightX + 2;
  const minZ = COLLAPSE_START_Z - 2;
  const maxZ = finishDistance + 6;
  const minY = LAVA_Y - 2;
  const maxY = CEILING_Y + 2;

  const areaId = `${DIMENSION_ID}:lane:${laneOffset}`;

  await withTickingArea(
    dimension,
    areaId,
    { x: minX, y: minY, z: minZ },
    { x: maxX, y: maxY, z: maxZ },
    async () => {
      // Lava sea and bedrock floor
      fillBlocksSafe(
        dimension,
        { x: minX, y: LAVA_Y - 1, z: minZ },
        { x: maxX, y: LAVA_Y - 1, z: maxZ },
        BLOCK.bedrock,
      );
      fillBlocksSafe(
        dimension,
        { x: minX, y: LAVA_Y, z: minZ },
        { x: maxX, y: LAVA_Y, z: maxZ },
        BLOCK.lava,
      );
      fillBlocksSafe(
        dimension,
        { x: minX, y: LAVA_Y + 1, z: minZ },
        { x: maxX, y: ROAD_Y - 1, z: maxZ },
        BLOCK.lava,
      );

      // Clear road, wall and ceiling area above lava
      fillBlocksSafe(
        dimension,
        { x: minX, y: ROAD_Y, z: minZ },
        { x: maxX, y: CEILING_Y, z: maxZ },
        BLOCK.air,
      );

      // Build road (main + optional branch lanes)
      const unstableBlocks = new Set();
      for (let z = START_Z; z <= finishDistance; z++) {
        const bounds = getLaneBoundsAtZ(laneOffset, z);
        for (let x = bounds.leftX; x <= bounds.rightX; x++) {
          if (bounds.inBranch && isInBranchGap(laneOffset, x)) continue;
          const roadBlock = chooseWeightedRoadBlock();
          setBlockSafe(dimension, { x, y: ROAD_Y, z }, roadBlock);

          if (!SAFE_BLOCKS.has(roadBlock) && Math.random() < UNSTABLE_CHANCE) {
            unstableBlocks.add(blockKey(x, ROAD_Y, z));
          }

        }
      }

      // Build side walls and ceiling with a deterministic structural rhythm.
      // This changes the material selected by existing writes rather than adding
      // another geometry scan or increasing road-block writes.
      for (let z = COLLAPSE_START_Z; z <= finishDistance + 2; z++) {
        const bounds = getLaneBoundsAtZ(laneOffset, z);
        const leftWallX = bounds.leftX - 1;
        const rightWallX = bounds.rightX + 1;
        const ribRow = Math.abs(z - START_Z) % HIGHWAY_RIB_SPACING === 0;
        for (let y = ROAD_Y; y <= WALL_TOP_Y; y++) {
          const glowSeed = visualHashCoords(laneOffset + y, z, 0x485759);
          const isGlowstone = !ribRow && glowSeed % 100 < 8;
          const wallBlock = ribRow
            ? BLOCK.polishedBlackstoneBricks
            : isGlowstone
              ? BLOCK.glowstone
              : BLOCK.basalt;
          setBlockSafe(dimension, { x: leftWallX, y, z }, wallBlock);
          setBlockSafe(dimension, { x: rightWallX, y, z }, wallBlock);
        }

        // Ceiling / roof
        for (let x = leftWallX; x <= rightWallX; x++) {
          for (let y = WALL_TOP_Y + 1; y <= CEILING_Y; y++) {
            setBlockSafe(
              dimension,
              { x, y, z },
              ribRow ? BLOCK.polishedBlackstoneBricks : BLOCK.basalt,
            );
          }
        }
      }

      // Keep the playable route straight: no service detours, branches, loops, or side lanes.
      placeStaticHighwayObstacles(dimension, laneOffset, finishDistance);

      // Place finish portal structure
      placeFinishPortal(dimension, laneOffset, finishDistance);

      scheduleHighwayScenery(dimension, laneOffset, finishDistance);

      // Store lane unstable blocks for future players
      state.laneUnstableBlocks.set(laneKey, unstableBlocks);
      state.generatedLanes.set(laneKey, finishDistance);
    },
  );
}


function getObstaclePattern(laneOffset, bounds, index) {
  const centerX = Math.floor(laneOffset);
  const leftX = bounds.leftX;
  const rightX = bounds.rightX;
  const allXs = [];
  for (let x = leftX; x <= rightX; x++) {
    allXs.push(x);
  }

  switch (index % 6) {
    case 0:
      // Low full-width speed bump: blocks the run line but can be jumped.
      return { height: 1, depth: 1, xs: allXs };
    case 1:
      // Tall left barricade with a right-side gap.
      return { height: 2, depth: 2, xs: allXs.filter((x) => x <= centerX + 1) };
    case 2:
      // Tall right barricade with a left-side gap.
      return { height: 2, depth: 2, xs: allXs.filter((x) => x >= centerX - 1) };
    case 3:
      // Split barricade: blocks both sides and forces the center lane.
      return { height: 2, depth: 2, xs: [leftX, leftX + 1, rightX - 1, rightX] };
    case 4:
      // Center barricade: blocks the straight sprint path.
      return { height: 2, depth: 2, xs: [centerX - 1, centerX, centerX + 1] };
    default:
      // Staggered columns that force a quick weave.
      return { height: 2, depth: 1, xs: [leftX + 1, centerX, rightX - 1] };
  }
}

function placeStaticHighwayObstacles(dimension, laneOffset, finishDistance = HIGHWAY_LENGTH) {
  const maxZ = Math.max(OBSTACLE_FIRST_Z, Math.floor(finishDistance) - OBSTACLE_SAFE_FINISH_GAP);
  let obstacleIndex = 0;
  let z = OBSTACLE_FIRST_Z;

  while (z <= maxZ) {
    const bounds = getLaneBoundsAtZ(laneOffset, z);
    const obstacle = getObstaclePattern(laneOffset, bounds, obstacleIndex);
    const obstacleBlock = obstacleIndex % 2 === 0
      ? BLOCK.crackedPolishedBlackstoneBricks
      : BLOCK.polishedBlackstoneBricks;

    for (let dz = 0; dz < obstacle.depth; dz++) {
      for (const x of obstacle.xs) {
        if (x < bounds.leftX || x > bounds.rightX) continue;
        if (bounds.inBranch && isInBranchGap(laneOffset, x)) continue;
        setBlockSafe(dimension, { x, y: ROAD_Y, z: z + dz }, BLOCK.obsidian);
        for (let dy = 1; dy <= obstacle.height; dy++) {
          setBlockSafe(dimension, { x, y: ROAD_Y + dy, z: z + dz }, obstacleBlock);
        }
        for (let dy = obstacle.height + 1; dy <= 3; dy++) {
          setBlockSafe(dimension, { x, y: ROAD_Y + dy, z: z + dz }, BLOCK.air);
        }
      }
    }

    obstacleIndex += 1;
    z += randomInt(OBSTACLE_MIN_SPACING, OBSTACLE_MAX_SPACING);
  }
}

function placeFinishPortal(dimension, laneOffset, finishDistance = HIGHWAY_LENGTH) {
  const finishZ = Math.floor(finishDistance) + 2;
  const centerX = laneOffset;

  // 3x3 obsidian platform
  for (let x = centerX - 1; x <= centerX + 1; x++) {
    for (let z = finishZ - 1; z <= finishZ + 1; z++) {
      setBlockSafe(dimension, { x, y: ROAD_Y, z }, BLOCK.obsidian);
    }
  }

  // Obsidian frame pillars
  for (let y = ROAD_Y + 1; y <= ROAD_Y + 3; y++) {
    setBlockSafe(dimension, { x: centerX - 1, y, z: finishZ - 1 }, BLOCK.obsidian);
    setBlockSafe(dimension, { x: centerX + 1, y, z: finishZ - 1 }, BLOCK.obsidian);
    setBlockSafe(dimension, { x: centerX - 1, y, z: finishZ + 1 }, BLOCK.obsidian);
    setBlockSafe(dimension, { x: centerX + 1, y, z: finishZ + 1 }, BLOCK.obsidian);
  }

  // Top frame
  for (let x = centerX - 1; x <= centerX + 1; x++) {
    setBlockSafe(dimension, { x, y: ROAD_Y + 4, z: finishZ - 1 }, BLOCK.obsidian);
    setBlockSafe(dimension, { x, y: ROAD_Y + 4, z: finishZ + 1 }, BLOCK.obsidian);
  }
  for (let z = finishZ - 1; z <= finishZ + 1; z++) {
    setBlockSafe(dimension, { x: centerX - 1, y: ROAD_Y + 4, z }, BLOCK.obsidian);
    setBlockSafe(dimension, { x: centerX + 1, y: ROAD_Y + 4, z }, BLOCK.obsidian);
  }

  // End gateway center
  setBlockSafe(dimension, { x: centerX, y: ROAD_Y + 1, z: finishZ }, BLOCK.endGateway);
  setBlockSafe(dimension, { x: centerX, y: ROAD_Y + 2, z: finishZ }, BLOCK.endGateway);

  // Light blocks around the portal
  setBlockSafe(dimension, { x: centerX - 2, y: ROAD_Y + 2, z: finishZ }, BLOCK.lightBlock15);
  setBlockSafe(dimension, { x: centerX + 2, y: ROAD_Y + 2, z: finishZ }, BLOCK.lightBlock15);
  setBlockSafe(dimension, { x: centerX, y: ROAD_Y + 2, z: finishZ - 2 }, BLOCK.lightBlock15);
  setBlockSafe(dimension, { x: centerX, y: ROAD_Y + 2, z: finishZ + 2 }, BLOCK.lightBlock15);
}

async function clearLaneArea(dimension, laneOffset) {
  const maxBounds = getLaneMaxBounds(laneOffset);
  const minX = maxBounds.leftX - 3;
  const maxX = maxBounds.rightX + 3;
  const minZ = COLLAPSE_START_Z - 4;
  const maxZ = HIGHWAY_LENGTH + 8;

  const areaId = `${DIMENSION_ID}:clear:${laneOffset}:${system.currentTick}`;
  clearSequenceWatchersForLane(dimension, laneOffset);

  await withTickingArea(
    dimension,
    areaId,
    { x: minX, y: LAVA_Y - 1, z: minZ },
    { x: maxX, y: CEILING_Y + 2, z: maxZ },
    async () => {
      fillBlocksSafe(
        dimension,
        { x: minX, y: LAVA_Y - 1, z: minZ },
        { x: maxX, y: CEILING_Y + 2, z: maxZ },
        BLOCK.air,
      );
    },
  );

  state.generatedLanes.delete(String(laneOffset));
  state.laneUnstableBlocks.delete(String(laneOffset));
  state.activeGeysers = state.activeGeysers.filter((geyser) => geyser.laneOffset !== laneOffset);
}

function isAirLikeBlock(typeId) {
  return typeId === BLOCK.air || typeId === "minecraft:cave_air" || typeId === "minecraft:void_air";
}

function isUnsafeSpawnBlock(typeId) {
  return typeId === BLOCK.air || typeId === BLOCK.lava || typeId === BLOCK.fire || typeId === "minecraft:soul_fire";
}

function forceSafeStartPad(dimension, laneOffset) {
  const minZ = START_Z - 1;
  const maxZ = START_Z + SAFE_START_PAD_LENGTH;
  for (let z = minZ; z <= maxZ; z++) {
    for (let x = laneOffset - SAFE_START_PAD_HALF_WIDTH; x <= laneOffset + SAFE_START_PAD_HALF_WIDTH; x++) {
      setBlockSafe(dimension, { x, y: LAVA_Y - 1, z }, BLOCK.bedrock);
      setBlockSafe(dimension, { x, y: LAVA_Y, z }, BLOCK.lava);
      setBlockSafe(dimension, { x, y: ROAD_Y, z }, BLOCK.obsidian);
      for (let y = ROAD_Y + 1; y <= ROAD_Y + 3; y++) {
        setBlockSafe(dimension, { x, y, z }, BLOCK.air);
      }
    }
  }

  forceWatcherStartPad(dimension, laneOffset);

  const spawnX = Math.floor(laneOffset + 0.5);
  const spawnZ = Math.floor(START_Z + 0.5);
  setBlockSafe(dimension, { x: spawnX, y: ROAD_Y, z: spawnZ }, BLOCK.obsidian);
  setBlockSafe(dimension, { x: spawnX, y: ROAD_Y + 1, z: spawnZ }, BLOCK.air);
  setBlockSafe(dimension, { x: spawnX, y: ROAD_Y + 2, z: spawnZ }, BLOCK.air);
}

function verifySafeHighwaySpawn(dimension, laneOffset) {
  const x = Math.floor(laneOffset + 0.5);
  const z = Math.floor(START_Z + 0.5);
  try {
    const below = dimension.getBlock({ x, y: ROAD_Y, z });
    const feet = dimension.getBlock({ x, y: ROAD_Y + 1, z });
    const head = dimension.getBlock({ x, y: ROAD_Y + 2, z });
    if (!below || !feet || !head) return false;
    if (isUnsafeSpawnBlock(below.typeId) || below.isAir || below.isLiquid) return false;
    if (!isAirLikeBlock(feet.typeId) || !isAirLikeBlock(head.typeId)) return false;
    return true;
  } catch (error) {
    return false;
  }
}

function prepareSafeHighwaySpawn(dimension, laneOffset) {
  forceSafeStartPad(dimension, laneOffset);
  if (verifySafeHighwaySpawn(dimension, laneOffset)) {
    return true;
  }
  forceSafeStartPad(dimension, laneOffset);
  return verifySafeHighwaySpawn(dimension, laneOffset);
}

function isEntityValid(entity) {
  try {
    if (!entity) return false;
    if (typeof entity.isValid === "function") return entity.isValid();
    return entity.isValid !== false;
  } catch (error) {
    return false;
  }
}

function forceWatcherStartPad(dimension, laneOffset) {
  const minZ = START_Z - WATCHER_START_BEHIND_Z - 2;
  const maxZ = START_Z - 2;
  for (let z = minZ; z <= maxZ; z++) {
    for (let x = laneOffset - HALF_WIDTH; x <= laneOffset + HALF_WIDTH; x++) {
      setBlockSafe(dimension, { x, y: LAVA_Y - 1, z }, BLOCK.bedrock);
      setBlockSafe(dimension, { x, y: LAVA_Y, z }, BLOCK.lava);
      setBlockSafe(dimension, { x, y: ROAD_Y, z }, BLOCK.obsidian);
      for (let y = ROAD_Y + 1; y <= ROAD_Y + 3; y++) {
        setBlockSafe(dimension, { x, y, z }, BLOCK.air);
      }
    }
  }
}

function hasTagSafe(entity, tag) {
  try {
    return !!entity && typeof entity.hasTag === "function" && entity.hasTag(tag);
  } catch (error) {
    return false;
  }
}

function addTagSafe(entity, tag) {
  try {
    if (entity && typeof entity.addTag === "function" && !hasTagSafe(entity, tag)) {
      entity.addTag(tag);
    }
  } catch (error) {}
}

function removeEntitySafe(entity) {
  try {
    if (isEntityValid(entity) && typeof entity.remove === "function") {
      entity.remove();
      return true;
    }
  } catch (error) {}
  return false;
}

function findSequenceWatcherById(watcherId) {
  if (!watcherId) {
    return undefined;
  }

  const dimension = getBurningHighwayDimension();
  try {
    const watchers = dimension.getEntities({ type: WATCHER_TYPE_ID });
    for (const watcher of watchers) {
      if (watcher.id === watcherId && hasTagSafe(watcher, WATCHER_SEQUENCE_TAG)) {
        return watcher;
      }
    }
  } catch (error) {}

  return undefined;
}

function getSequenceWatcher(playerState) {
  if (!playerState) {
    return undefined;
  }

  if (isEntityValid(playerState.watcherEntity) && hasTagSafe(playerState.watcherEntity, WATCHER_SEQUENCE_TAG)) {
    return playerState.watcherEntity;
  }

  const watcher = findSequenceWatcherById(playerState.watcherEntityId);
  if (watcher) {
    playerState.watcherEntity = watcher;
    return watcher;
  }

  return undefined;
}

function removeSequenceWatcher(playerState) {
  const watcher = getSequenceWatcher(playerState);
  removeEntitySafe(watcher);
  if (playerState) {
    playerState.watcherEntity = undefined;
    playerState.watcherEntityId = undefined;
  }
}

function clearSequenceWatchersForLane(dimension, laneOffset) {
  try {
    const watchers = dimension.getEntities({ type: WATCHER_TYPE_ID });
    for (const watcher of watchers) {
      if (BURNING_HIGHWAY_WATCHER_ENABLED && !hasTagSafe(watcher, WATCHER_SEQUENCE_TAG)) {
        continue;
      }
      if (Math.abs(watcher.location.x - (laneOffset + 0.5)) <= HIGHWAY_WIDTH + 1) {
        removeEntitySafe(watcher);
      }
    }
  } catch (error) {}
}

function setWatcherAnimationState(entity, stateValue) {
  try {
    if (entity && typeof entity.setProperty === "function") {
      entity.setProperty("paradise:anim_state", stateValue);
    }
  } catch (error) {}
}

function faceWatcherToward(entity, target) {
  if (!entity || !target) {
    return { x: 0, y: 0 };
  }

  const dx = target.x - entity.location.x;
  const dz = target.z - entity.location.z;
  const yaw = Math.atan2(-dx, dz) * 180 / Math.PI;
  return { x: 0, y: yaw };
}

function getWatcherStartLocation(laneOffset) {
  return {
    x: laneOffset + 0.5,
    y: ROAD_Y + 1,
    z: START_Z - WATCHER_START_BEHIND_Z + 0.5,
  };
}

function resetWatcherChaseState(playerState, currentTick = system.currentTick) {
  playerState.watcherZ = START_Z - WATCHER_START_BEHIND_Z + 0.5;
  playerState.lastWatcherUpdateTick = currentTick;
  playerState.watcherStartTick = currentTick + WATCHER_START_DELAY_TICKS;
  playerState.watcherRestarting = false;
}

function ensureBurningHighwayWatcher(player, playerState, forceRespawn = false) {
  if (!isBurningHighwayRunActive(player) || !playerState) {
    return undefined;
  }

  // The Burning Highway running stalker is intentionally removed in this build.
  // Keep this function as a cleanup/no-op hook because entry, regeneration, and
  // maintenance paths still call it to clear stale sequence watchers safely.
  removeSequenceWatcher(playerState);
  playerState.watcherZ = START_Z - WATCHER_START_BEHIND_Z + 0.5;
  playerState.watcherStartTick = system.currentTick + WATCHER_START_DELAY_TICKS;
  playerState.lastWatcherUpdateTick = system.currentTick;
  playerState.watcherRestarting = false;
  return undefined;
}

async function restartBurningHighwayFromWatcherCatch(player, playerState) {
  if (!player || !playerState || playerState.watcherRestarting || playerState.pendingEscape) {
    return false;
  }

  playerState.watcherRestarting = true;
  clearBurningHighwayRunOverlay(player);
  safeActionBar(player, "§4The watcher caught you. Run again.");
  removeSequenceWatcher(playerState);

  try {
    await regeneratePlayerLane(player);
    return true;
  } catch (error) {
    playerState.watcherRestarting = false;
    return false;
  }
}

function distance2d(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function updateBurningHighwayWatcher(player, playerState) {
  if (!isBurningHighwayRunActive(player) || !playerState || playerState.watcherRestarting) {
    return;
  }

  const watcher = ensureBurningHighwayWatcher(player, playerState, false);
  if (!watcher) {
    return;
  }

  const currentTick = system.currentTick;
  const previousTick = playerState.lastWatcherUpdateTick ?? currentTick;
  const elapsedTicks = clamp(currentTick - previousTick, 1, MAINTENANCE_INTERVAL_TICKS * 3);
  playerState.lastWatcherUpdateTick = currentTick;

  if (currentTick < (playerState.watcherStartTick ?? 0)) {
    return;
  }

  const playerZ = player.location.z;
  const watcherZ = typeof playerState.watcherZ === "number" ? playerState.watcherZ : watcher.location.z;
  const pressure = clamp((playerZ - watcherZ - 10) / 36, 0, 1);
  const speed = WATCHER_BASE_SPEED_BLOCKS_PER_TICK + (WATCHER_CATCHUP_SPEED_BLOCKS_PER_TICK - WATCHER_BASE_SPEED_BLOCKS_PER_TICK) * pressure;
  const maxStep = Math.min(WATCHER_MAX_STEP_BLOCKS, speed * elapsedTicks);
  const targetZ = Math.min(playerZ - WATCHER_MIN_GAP_BEHIND_PLAYER, watcherZ + maxStep);
  const nextZ = Math.max(START_Z - WATCHER_START_BEHIND_Z + 0.5, targetZ);

  playerState.watcherZ = nextZ;

  const nextLocation = {
    x: playerState.laneOffset + 0.5,
    y: ROAD_Y + 1,
    z: nextZ,
  };

  try {
    watcher.teleport(nextLocation, {
      dimension: player.dimension,
      rotation: faceWatcherToward(watcher, player.location),
      checkForBlocks: false,
      keepVelocity: false,
    });
  } catch (error) {}

  setWatcherAnimationState(watcher, WATCHER_RUN_ANIM_STATE);

  const caughtByDistance = distance2d(player.location, nextLocation) <= WATCHER_CATCH_DISTANCE;
  const caughtByProgress = nextZ >= playerZ - WATCHER_MIN_GAP_BEHIND_PLAYER + 0.1;
  if (caughtByDistance || caughtByProgress) {
    system.run(() => {
      void restartBurningHighwayFromWatcherCatch(player, playerState).catch(() => {
        playerState.watcherRestarting = false;
      });
    });
  }
}

function getPlayerHighwayState(playerId) {
  return state.activePlayers.get(playerId);
}

function setPlayerHighwayState(playerId, data) {
  state.activePlayers.set(playerId, data);
}

function removePlayerHighwayState(playerId) {
  state.activePlayers.delete(playerId);
}

function getPlayerById(playerId) {
  return getCachedPlayerById(playerId);
}

function isPlayerInBurningHighway(player) {
  return !!player && !!player.dimension && player.dimension.id === DIMENSION_ID;
}

function isBurningHighwayRunActive(player) {
  if (!isPlayerInBurningHighway(player)) {
    return false;
  }

  const playerState = getPlayerHighwayState(player.id);
  if (!playerState || playerState.pendingEscape) {
    return false;
  }

  return true;
}

function resetLavaStartState(playerState, currentTick = system.currentTick) {
  playerState.lavaStartTick = currentTick + LAVA_START_DELAY_TICKS;
  playerState.lastCountdownSecondShown = undefined;
  playerState.lavaStarted = false;
  playerState.nextCollapseTick = playerState.lavaStartTick;
  playerState.idleTicks = 0;
  playerState.panicSprintTicks = 0;
  playerState.lastProgressZ = 0;
  playerState.lastMotionSample = undefined;
  playerState.lastMoveDirection = undefined;
}

function showBurningHighwayRunOverlay(player, playerState = getPlayerHighwayState(player && player.id)) {
  if (!isBurningHighwayRunActive(player) || !playerState || playerState.runOverlayShown) {
    return false;
  }

  if (!player.onScreenDisplay || typeof player.onScreenDisplay.setTitle !== "function") {
    return false;
  }

  try {
    player.onScreenDisplay.setTitle(RUN_OVERLAY_TITLE_TOKEN, {
      fadeInDuration: 0,
      stayDuration: RUN_OVERLAY_STAY_TICKS,
      fadeOutDuration: 0,
    });
    playerState.runOverlayShown = true;
    return true;
  } catch (error) {
    return false;
  }
}

function clearBurningHighwayRunOverlay(player) {
  if (!player || !player.onScreenDisplay || typeof player.onScreenDisplay.setTitle !== "function") {
    return false;
  }

  try {
    player.onScreenDisplay.setTitle("", {
      fadeInDuration: 0,
      stayDuration: 1,
      fadeOutDuration: 0,
    });
    return true;
  } catch (error) {
    return false;
  }
}

function clearBurningHighwayRunDisplay(player) {
  clearBurningHighwayRunOverlay(player);
  safeActionBar(player, "");
}

function clearBurningHighwayPlayerState(player) {
  if (!player || !player.id) {
    return;
  }
  const playerState = getPlayerHighwayState(player.id);
  if (playerState) {
    removeSequenceWatcher(playerState);
  }
  clearBurningHighwayRunDisplay(player);
  state.pendingRespawns.delete(player.id);
  removePlayerHighwayState(player.id);
}

function updateLavaStartCountdown(player, playerState) {
  if (!isBurningHighwayRunActive(player) || !playerState) {
    return false;
  }

  if (playerState.lavaStarted) {
    return true;
  }

  if (typeof playerState.lavaStartTick !== "number") {
    resetLavaStartState(playerState, system.currentTick);
  }

  const ticksRemaining = playerState.lavaStartTick - system.currentTick;
  if (ticksRemaining <= 0) {
    playerState.lavaStarted = true;
    playerState.lastCountdownSecondShown = 0;
    playerState.nextCollapseTick = system.currentTick;
    safeActionBar(player, "§cRUN!");
    return true;
  }

  const secondsRemaining = clamp(
    Math.ceil(ticksRemaining / 20),
    1,
    LAVA_START_DELAY_SECONDS,
  );

  if (playerState.lastCountdownSecondShown !== secondsRemaining) {
    safeActionBar(player, `§cLava moving in ${secondsRemaining}...`);
    playerState.lastCountdownSecondShown = secondsRemaining;
  }

  return false;
}

function cleanupInactiveBurningHighwayPlayers() {
  for (const [playerId] of [...state.activePlayers.entries()]) {
    const player = getPlayerById(playerId);
    if (!player) {
      const playerState = getPlayerHighwayState(playerId);
      if (playerState) {
        removeSequenceWatcher(playerState);
      }
      removePlayerHighwayState(playerId);
      continue;
    }

    if (isPlayerInBurningHighway(player)) {
      continue;
    }

    clearBurningHighwayRunDisplay(player);
    if (!state.pendingRespawns.has(playerId)) {
      const playerState = getPlayerHighwayState(playerId);
      if (playerState) {
        removeSequenceWatcher(playerState);
      }
      removePlayerHighwayState(playerId);
    }
  }
}

async function regeneratePlayerLane(player) {
  const playerState = getPlayerHighwayState(player.id);
  if (!playerState) {
    return false;
  }

  const dimension = getBurningHighwayDimension();
  const laneOffset = playerState.laneOffset;
  const finishDistance = getRandomFinishDistance();
  playerState.finishDistance = finishDistance;
  removeSequenceWatcher(playerState);

  // Clear existing lane
  await clearLaneArea(dimension, laneOffset);

  // Regenerate
  await generateHighwayLane(dimension, laneOffset, finishDistance);
  prepareSafeHighwaySpawn(dimension, laneOffset);

  // Reset player state
  playerState.collapseFrontZ = COLLAPSE_START_Z;
  playerState.maxZReached = 0;
  playerState.enteredAtTick = system.currentTick;
  playerState.pendingEscape = false;
  playerState.unstableDelays = new Map(); // blockKey -> igniteAtTick
  playerState.finishStillTicks = 0;
  playerState.unstableBlocks = new Set(state.laneUnstableBlocks.get(String(laneOffset)) || []);
  playerState.startVerified = verifySafeHighwaySpawn(dimension, laneOffset);
  resetLavaStartState(playerState, system.currentTick);
  resetWatcherChaseState(playerState, system.currentTick);

  // Teleport to start
  placeHighwayTeachingSigns(dimension, laneOffset);

  const startLocation = {
    x: laneOffset + 0.5,
    y: ROAD_Y + 1,
    z: START_Z + 0.5,
  };
  await verifiedPlayerTeleport(player, startLocation, {
    dimension,
    checkForBlocks: false,
    keepVelocity: false,
  }, { attempts: 8, retryTicks: 4, maxDistance: 64 });

  ensureBurningHighwayWatcher(player, playerState, true);

  return true;
}

function getFinishZ(finishDistance = HIGHWAY_LENGTH) {
  return Math.floor(finishDistance) + 2;
}

function isNearFinishPortal(location, laneOffset, finishDistance = HIGHWAY_LENGTH) {
  const finishZ = getFinishZ(finishDistance);
  const centerX = laneOffset;
  const dx = location.x - centerX;
  const dz = location.z - finishZ;
  const dy = location.y - (ROAD_Y + 1);
  return Math.sqrt(dx * dx + dy * dy + dz * dz) <= FINISH_RADIUS;
}

function handleFinishZone(player, playerState) {
  if (!isNearFinishPortal(player.location, playerState.laneOffset, playerState.finishDistance || HIGHWAY_LENGTH)) {
    playerState.finishStillTicks = 0;
    return false;
  }

  const speed = playerState.lastHorizontalSpeed ?? 1;
  const progress = playerState.lastForwardProgress ?? 0;
  if (speed >= FINISH_SPRINT_RESET_SPEED || progress > 0.22) {
    playerState.finishStillTicks = 0;
    if (canTrigger(playerState, "finish-sprint-reset", 20 * 3)) {
      safeActionBar(player, "The finish rejects panic. Stop at the end.");
      system.run(() => {
        void regeneratePlayerLane(player).catch(() => {});
      });
    }
    return true;
  }

  playerState.finishStillTicks = (playerState.finishStillTicks || 0) + MAINTENANCE_INTERVAL_TICKS;
  const remainingTicks = Math.max(0, FINISH_STILL_REQUIRED_TICKS - playerState.finishStillTicks);
  safeActionBar(player, remainingTicks > 0 ? `Stand still at the finish: ${(remainingTicks / 20).toFixed(1)}s` : "The finish finally opens.");
  if (playerState.finishStillTicks >= FINISH_STILL_REQUIRED_TICKS) {
    system.run(() => {
      void escapePlayer(player).catch(() => {});
    });
  }
  return true;
}

async function escapePlayer(player) {
  const playerState = getPlayerHighwayState(player.id);
  if (!playerState || playerState.pendingEscape) {
    return false;
  }

  playerState.pendingEscape = true;
  removeSequenceWatcher(playerState);
  clearBurningHighwayRunDisplay(player);

  try {
    const returnPoint = playerState.returnPoint;
    if (!returnPoint) {
      return false;
    }

    const targetDimension = getDimensionById(returnPoint.dimensionId) || world.getDimension("minecraft:overworld");
    const returned = await verifiedPlayerTeleport(player, returnPoint.location, {
      dimension: targetDimension,
      checkForBlocks: false,
      keepVelocity: false,
    }, { attempts: 8, retryTicks: 4, maxDistance: 64 });
    if (!returned) {
      throw new Error("Return teleport verification failed.");
    }

    return true;
  } catch (error) {
    playerState.pendingEscape = false;
    return false;
  }
}

function processExpiredUnstableDelays(dimension, playerState, currentTick) {
  for (const [delayedKey, igniteAtTick] of [...playerState.unstableDelays.entries()]) {
    if (currentTick >= igniteAtTick) {
      const parts = delayedKey.split(",");
      const dx = parseInt(parts[0], 10);
      const dy = parseInt(parts[1], 10);
      const dz = parseInt(parts[2], 10);
      setBlockSafe(dimension, { x: dx, y: dy, z: dz }, BLOCK.lava);
      playerState.unstableDelays.delete(delayedKey);
    }
  }
}

function collapseHighwayRow(dimension, playerState, collapseZ, currentTick) {
  const laneOffset = playerState.laneOffset;
  const finishDistance = Math.floor(playerState.finishDistance || HIGHWAY_LENGTH);
  if (collapseZ > finishDistance + 2) {
    return;
  }

  const bounds = getLaneBoundsAtZ(laneOffset, collapseZ);
  for (let x = bounds.leftX; x <= bounds.rightX; x++) {
    if (bounds.inBranch && isInBranchGap(laneOffset, x)) continue;
    const key = blockKey(x, ROAD_Y, collapseZ);
    if (playerState.unstableBlocks && playerState.unstableBlocks.has(key)) {
      if (!playerState.unstableDelays.has(key)) {
        playerState.unstableDelays.set(key, currentTick + UNSTABLE_DELAY_TICKS);
        setBlockSafe(dimension, { x, y: ROAD_Y, z: collapseZ }, BLOCK.fire);
      }
    } else {
      setBlockSafe(dimension, { x, y: ROAD_Y, z: collapseZ }, BLOCK.lava);
      setBlockSafe(dimension, { x, y: ROAD_Y + 1, z: collapseZ }, BLOCK.air);
    }
  }

  for (let ahead = 1; ahead <= FIRE_WARNING_DISTANCE; ahead++) {
    const warningZ = collapseZ + ahead;
    if (warningZ > finishDistance) continue;
    const warningBounds = getLaneBoundsAtZ(laneOffset, warningZ);
    for (let x = warningBounds.leftX; x <= warningBounds.rightX; x++) {
      if (warningBounds.inBranch && isInBranchGap(laneOffset, x)) continue;
      const block = dimension.getBlock({ x, y: ROAD_Y, z: warningZ });
      if (block && !SAFE_BLOCKS.has(block.typeId) && block.typeId !== BLOCK.lava && block.typeId !== BLOCK.fire) {
        setBlockSafe(dimension, { x, y: ROAD_Y, z: warningZ }, BLOCK.fire);
      }
    }
  }

  const leftWallX = bounds.leftX - 1;
  const rightWallX = bounds.rightX + 1;
  for (let y = ROAD_Y; y <= WALL_TOP_Y; y++) {
    setBlockSafe(dimension, { x: leftWallX, y, z: collapseZ }, BLOCK.lava);
    setBlockSafe(dimension, { x: rightWallX, y, z: collapseZ }, BLOCK.lava);
  }
  for (let x = leftWallX; x <= rightWallX; x++) {
    for (let y = WALL_TOP_Y + 1; y <= CEILING_Y; y++) {
      setBlockSafe(dimension, { x, y, z: collapseZ }, BLOCK.lava);
    }
  }
}

function advanceCollapseForPlayer(player, playerState) {
  if (!playerState.lavaStarted) {
    return;
  }

  const dimension = getBurningHighwayDimension();
  const currentTick = system.currentTick;
  const finishDistance = Math.floor(playerState.finishDistance || HIGHWAY_LENGTH);
  const maxCollapseZ = finishDistance + 2;

  processExpiredUnstableDelays(dimension, playerState, currentTick);

  const timedAdvanceReady = currentTick >= playerState.nextCollapseTick;
  const chaseTargetZ = Math.floor(player.location.z - LAVA_CHASE_GAP_BLOCKS);
  let targetCollapseZ = playerState.collapseFrontZ;

  if (timedAdvanceReady) {
    targetCollapseZ = Math.max(targetCollapseZ, playerState.collapseFrontZ + 1);
  }

  if (chaseTargetZ > targetCollapseZ) {
    targetCollapseZ = chaseTargetZ;
  }

  targetCollapseZ = clamp(targetCollapseZ, playerState.collapseFrontZ, maxCollapseZ);
  const rowsToCollapse = clamp(
    targetCollapseZ - playerState.collapseFrontZ,
    0,
    MAX_COLLAPSE_ROWS_PER_STEP,
  );

  if (rowsToCollapse <= 0) {
    return;
  }

  for (let i = 0; i < rowsToCollapse; i++) {
    playerState.collapseFrontZ += 1;
    collapseHighwayRow(dimension, playerState, playerState.collapseFrontZ, currentTick);
  }

  playerState.nextCollapseTick = currentTick + COLLAPSE_TICK_INTERVAL;
}

function warnHighwayRule(player, playerState, message, soundPitch = 0.75) {
  if (!canTrigger(playerState, "rule-warning", 20 * 8)) return;
  safePlaySound(player.dimension, "ambient.cave", player.location, { volume: 0.65, pitch: soundPitch });
  safeActionBar(player, message);
  requestRuleVhs(player, VHS_TIER.Low, 20 * 4, "burning-highway-warning");
}

function markHighwayUnstableAhead(player, playerState, startOffset = 8, rows = 4) {
  const dimension = getBurningHighwayDimension();
  const laneOffset = playerState.laneOffset;
  const finishDistance = Math.floor(playerState.finishDistance || HIGHWAY_LENGTH);
  const startZ = clamp(Math.floor(player.location.z) + startOffset, 2, Math.max(2, finishDistance - rows - 2));
  for (let dz = 0; dz < rows; dz++) {
    const z = startZ + dz * 2;
    const bounds = getLaneBoundsAtZ(laneOffset, z);
    for (let x = bounds.leftX; x <= bounds.rightX; x++) {
      if (bounds.inBranch && isInBranchGap(laneOffset, x)) continue;
      const key = blockKey(x, ROAD_Y, z);
      playerState.unstableBlocks.add(key);
      if ((x + z) % 2 === 0) {
        setBlockSafe(dimension, { x, y: ROAD_Y, z }, BLOCK.fire);
      }
    }
  }
}

function placeHighwayTeachingSigns(_dimension, _laneOffset) {
  // Intentionally no placed signs. Standing signs inside the road create
  // foot-height collision and were the main source of the movement issue.
}

function updateBurningHighwayMotionRule(player, playerState) {
  const motion = sampleMotion(playerState, player.location);
  const forwardProgress = player.location.z - (playerState.lastProgressZ ?? player.location.z);
  playerState.lastProgressZ = player.location.z;
  playerState.lastHorizontalSpeed = motion.horizontalSpeed;
  playerState.lastForwardProgress = forwardProgress;

  const idle = motion.horizontalSpeed < 0.025 && forwardProgress < 0.15;
  const sprintingBlindly = false;
  const controlledProgress = forwardProgress > 0.12;

  if (idle) {
    playerState.idleTicks = (playerState.idleTicks || 0) + motion.dt;
    playerState.panicSprintTicks = Math.max(0, (playerState.panicSprintTicks || 0) - motion.dt);
  } else if (sprintingBlindly) {
    playerState.panicSprintTicks = (playerState.panicSprintTicks || 0) + motion.dt;
    playerState.idleTicks = Math.max(0, (playerState.idleTicks || 0) - motion.dt * 2);
  } else if (controlledProgress) {
    playerState.idleTicks = Math.max(0, (playerState.idleTicks || 0) - motion.dt * 3);
    playerState.panicSprintTicks = Math.max(0, (playerState.panicSprintTicks || 0) - motion.dt * 2);
  }

  if ((playerState.idleTicks || 0) >= 20) {
    warnHighwayRule(player, playerState, "The fire hears stillness.", 0.45);
    playerState.nextCollapseTick = Math.min(playerState.nextCollapseTick, system.currentTick + 1);
    const behindZ = Math.max(0, Math.floor(player.location.z) - 3);
    const bounds = getLaneBoundsAtZ(playerState.laneOffset, behindZ);
    for (let x = bounds.leftX; x <= bounds.rightX; x++) {
      if (bounds.inBranch && isInBranchGap(playerState.laneOffset, x)) continue;
      setBlockSafe(player.dimension, { x, y: ROAD_Y, z: behindZ }, BLOCK.fire);
    }
  }

}

function triggerGeysers(dimension, laneOffset, finishDistance = HIGHWAY_LENGTH) {
  const currentTick = system.currentTick;
  const maxGeyserZ = Math.max(20, Math.floor(finishDistance) - 10);

  for (let i = 0; i < GEYSER_COUNT_PER_BURST; i++) {
    const geyserZ = randomInt(10, maxGeyserZ);
    const bounds = getLaneBoundsAtZ(laneOffset, geyserZ);
    const isLeft = Math.random() < 0.5;
    const wallX = isLeft ? bounds.leftX - 1 : bounds.rightX + 1;
    const geyserY = randomInt(ROAD_Y + 1, WALL_TOP_Y);

    const loc = { x: wallX, y: geyserY, z: geyserZ };
    const block = dimension.getBlock(loc);
    const originalBlock = block ? block.typeId : BLOCK.basalt;

    setBlockSafe(dimension, loc, BLOCK.lava);

    state.activeGeysers.push({
      laneOffset,
      x: wallX,
      y: geyserY,
      z: geyserZ,
      restoreAtTick: currentTick + GEYSER_DURATION_TICKS,
      originalBlock,
    });
  }
}

function restoreExpiredGeysers() {
  const currentTick = system.currentTick;
  const dimension = getBurningHighwayDimension();
  const remaining = [];

  for (const geyser of state.activeGeysers) {
    if (currentTick >= geyser.restoreAtTick) {
      setBlockSafe(dimension, { x: geyser.x, y: geyser.y, z: geyser.z }, geyser.originalBlock);
    } else {
      remaining.push(geyser);
    }
  }

  state.activeGeysers = remaining;
}

async function enterBurningHighway(player) {
  if (!player || isBurningHighwayDimension(player.dimension)) {
    return false;
  }

  await bootstrapBurningHighwayWorld();

  const dimension = getBurningHighwayDimension();
  const laneOffset = getLaneOffsetForPlayer(player.id);
  const finishDistance = getRandomFinishDistance();

  // Every run starts with a clean lane so collapsed roads and old exits are not reused.
  // If generation has a transient failure, still move the player and let
  // dimension-change/maintenance rebuild the lane on the next ticks.
  try {
    await clearLaneArea(dimension, laneOffset);
    await generateHighwayLane(dimension, laneOffset, finishDistance);
    prepareSafeHighwaySpawn(dimension, laneOffset);
  } catch (error) {}

  // Save return point
  const returnPoint = {
    dimensionId: player.dimension.id,
    location: {
      x: player.location.x,
      y: player.location.y,
      z: player.location.z,
    },
  };

  // Get unstable blocks for this lane if already generated
  const laneKey = String(laneOffset);
  const laneUnstable = state.laneUnstableBlocks.get(laneKey) || new Set();

  const playerState = {
    laneOffset,
    finishDistance,
    collapseFrontZ: COLLAPSE_START_Z,
    maxZReached: 0,
    enteredAtTick: system.currentTick,
    nextCollapseTick: system.currentTick + LAVA_START_DELAY_TICKS,
    returnPoint,
    pendingEscape: false,
    unstableBlocks: new Set(laneUnstable),
    unstableDelays: new Map(),
    idleTicks: 0,
    panicSprintTicks: 0,
    lastProgressZ: 0,
    lastHorizontalSpeed: 0,
    lastForwardProgress: 0,
    finishStillTicks: 0,
    lavaStartTick: system.currentTick + LAVA_START_DELAY_TICKS,
    lastCountdownSecondShown: undefined,
    lavaStarted: false,
    runOverlayShown: false,
    watcherEntity: undefined,
    watcherEntityId: undefined,
    watcherZ: START_Z - WATCHER_START_BEHIND_Z + 0.5,
    watcherStartTick: system.currentTick + WATCHER_START_DELAY_TICKS,
    lastWatcherUpdateTick: system.currentTick,
    watcherRestarting: false,
    startVerified: verifySafeHighwaySpawn(dimension, laneOffset),
    cooldowns: new Map(),
  };

  resetLavaStartState(playerState, system.currentTick);
  resetWatcherChaseState(playerState, system.currentTick);

  setPlayerHighwayState(player.id, playerState);

  prepareSafeHighwaySpawn(dimension, laneOffset);
  placeHighwayTeachingSigns(dimension, laneOffset);

  // Teleport to start
  const startLocation = {
    x: laneOffset + 0.5,
    y: ROAD_Y + 1,
    z: START_Z + 0.5,
  };
  const entered = await verifiedPlayerTeleport(player, startLocation, {
    dimension,
    checkForBlocks: false,
    keepVelocity: false,
  }, { attempts: 8, retryTicks: 4, maxDistance: 64 });
  if (!entered) {
    removePlayerHighwayState(player.id);
    return false;
  }

  ensureBurningHighwayWatcher(player, playerState, true);
  showBurningHighwayRunOverlay(player, playerState);
  updateLavaStartCountdown(player, playerState);

  try {
    player.sendMessage("§cHint: §7Reach the finish, then stop. Sprinting through the end resets the highway.");
  } catch (error) {}

  return true;
}

function runBurningHighwayEntryCommand(player) {
  void enterBurningHighway(player).then((entered) => {
    if (!entered) {
      try {
        player.sendMessage("Burning Highway entry failed. Try again in a moment.");
      } catch (error) {}
    }
  }).catch((error) => {
    try {
      player.sendMessage(`Burning Highway entry failed: ${String(error)}`);
    } catch (_error) {}
  });
}

async function bootstrapBurningHighwayWorld() {
  if (!state.bootstrapPromise) {
    state.bootstrapPromise = (async () => {
      const dimension = getBurningHighwayDimension();
      setNetherWeather(dimension);
      state.nextGeyserTick = system.currentTick + GEYSER_INTERVAL_TICKS;
      state.nextCollapseTick = system.currentTick + COLLAPSE_TICK_INTERVAL;
      state.bootstrapReady = true;
    })().catch((error) => {
      state.bootstrapPromise = null;
      throw error;
    });
  }
  return state.bootstrapPromise;
}

function setNetherWeather(dimension) {
  try {
    dimension.setWeather(WeatherType.Clear, 20 * 60 * 20);
  } catch (error) {
    // Weather is a nice-to-have.
  }
}

function handlePlayerDimensionChange(event) {
  const player = event.player;
  if (!player) {
    return;
  }

  const enteredHighway =
    event.toDimension &&
    event.toDimension.id === DIMENSION_ID &&
    event.fromDimension &&
    event.fromDimension.id !== DIMENSION_ID;

  const leftHighway =
    event.fromDimension &&
    event.fromDimension.id === DIMENSION_ID &&
    event.toDimension &&
    event.toDimension.id !== DIMENSION_ID;

  if (enteredHighway) {
    // State is already set by enterBurningHighway, just ensure lane exists
    const playerState = getPlayerHighwayState(player.id);
    if (playerState) {
      showBurningHighwayRunOverlay(player, playerState);
      updateLavaStartCountdown(player, playerState);
      system.run(() => {
        const dimension = getBurningHighwayDimension();
        void generateHighwayLane(dimension, playerState.laneOffset, playerState.finishDistance || HIGHWAY_LENGTH).then(() => {
          prepareSafeHighwaySpawn(dimension, playerState.laneOffset);
        }).catch(() => {});
      });
    }
    return;
  }

  if (leftHighway) {
    clearBurningHighwayRunDisplay(player);

    const playerState = getPlayerHighwayState(player.id);
    if (playerState && playerState.pendingEscape) {
      removeSequenceWatcher(playerState);
      removePlayerHighwayState(player.id);
      return;
    }

    if (playerState) {
      removeSequenceWatcher(playerState);
      playerState.lavaStarted = false;
      playerState.lastCountdownSecondShown = undefined;
    }

    // If the leave was caused by death, entityDie/playerSpawn may need this state
    // on the next tick for lane regeneration. Otherwise remove it as an abnormal
    // transfer-out cleanup so the run overlay cannot reappear later.
    system.runTimeout(() => {
      if (state.pendingRespawns.has(player.id)) {
        return;
      }

      const currentPlayer = getPlayerById(player.id);
      if (!currentPlayer || !isPlayerInBurningHighway(currentPlayer)) {
        const staleState = getPlayerHighwayState(player.id);
        if (staleState) {
          removeSequenceWatcher(staleState);
        }
        removePlayerHighwayState(player.id);
      }
    }, 1);
  }
}

function handlePlayerSpawn(event) {
  const player = event.player;
  if (!player || event.initialSpawn) {
    return;
  }

  if (!isPlayerInBurningHighway(player)) {
    clearBurningHighwayRunDisplay(player);
  }

  if (!state.pendingRespawns.has(player.id)) {
    if (!isPlayerInBurningHighway(player)) {
      const playerState = getPlayerHighwayState(player.id);
      if (playerState) {
        removeSequenceWatcher(playerState);
      }
      removePlayerHighwayState(player.id);
    }
    return;
  }
  state.pendingRespawns.delete(player.id);

  // Player respawned after dying in the highway.
  const playerState = getPlayerHighwayState(player.id);
  if (!playerState) {
    clearBurningHighwayRunDisplay(player);
    return;
  }

  // They died in the highway. Regenerate lane and teleport them back.
  system.run(() => {
    void regeneratePlayerLane(player).catch(() => {});
  });
}

function handleChatEnterCommand(event) {
  const message = String(event.message || "").trim().toLowerCase();
  if (message !== CHAT_ENTER_COMMAND) {
    return;
  }

  event.cancel = true;

  system.run(() => {
    const sender = event.sender;
    if (!sender || sender.typeId !== "minecraft:player") {
      return;
    }

    try {
      sender.sendMessage("Entering Burning Highway...");
    } catch (error) {
      // Ignore chat feedback failures.
    }

    runBurningHighwayEntryCommand(sender);
  });
}

function handleEntitySpawn(event) {
  const entity = event.entity;
  if (!entity || !entity.isValid || !entity.dimension || entity.dimension.id !== DIMENSION_ID) {
    return;
  }

  if (ALLOWED_ENTITY_IDS.has(entity.typeId)) {
    return;
  }

  system.run(() => {
    try {
      entity.remove();
    } catch (error) {
      // Ignored.
    }
  });
}

function handleEntityDie(event) {
  const entity = event.deadEntity;
  if (!entity || entity.typeId !== "minecraft:player" || !isBurningHighwayDimension(entity.dimension)) {
    return;
  }

  clearBurningHighwayRunDisplay(entity);
  state.pendingRespawns.add(entity.id);

  const playerState = getPlayerHighwayState(entity.id);
  if (playerState) {
    removeSequenceWatcher(playerState);
    playerState.lavaStarted = false;
    playerState.lastCountdownSecondShown = undefined;
  }
}

function handlePlayerLeave(event) {
  const playerState = getPlayerHighwayState(event.playerId);
  if (playerState) {
    removeSequenceWatcher(playerState);
  }
  state.pendingRespawns.delete(event.playerId);
  removePlayerHighwayState(event.playerId);
}

async function maintainBurningHighway() {
  if (state.maintenanceRunning || !state.bootstrapReady) {
    return;
  }

  const dimension = getBurningHighwayDimension();
  cleanupInactiveBurningHighwayPlayers();

  const players = dimension.getPlayers();

  if (!players.length) {
    // No players, just restore geysers
    restoreExpiredGeysers();
    return;
  }

  state.maintenanceRunning = true;

  try {
    // Restore expired geysers
    restoreExpiredGeysers();

    // Trigger new geysers if interval reached
    if (system.currentTick >= state.nextGeyserTick) {
      for (const player of players) {
        const playerState = getPlayerHighwayState(player.id);
        if (playerState && isBurningHighwayRunActive(player) && playerState.lavaStarted) {
          triggerGeysers(dimension, playerState.laneOffset, playerState.finishDistance || HIGHWAY_LENGTH);
        }
      }
      state.nextGeyserTick = system.currentTick + GEYSER_INTERVAL_TICKS;
    }

    for (const player of players) {
      if (!player || !isBurningHighwayDimension(player.dimension)) {
        continue;
      }

      const playerState = getPlayerHighwayState(player.id);
      if (!playerState || playerState.pendingEscape) {
        clearBurningHighwayRunDisplay(player);
        continue;
      }

      showBurningHighwayRunOverlay(player, playerState);
      updateBurningHighwayWatcher(player, playerState);

      const lavaStarted = updateLavaStartCountdown(player, playerState);
      if (!lavaStarted) {
        continue;
      }

      // Rule: keep moving, but panic buckles the road.
      updateBurningHighwayMotionRule(player, playerState);

      // Advance collapse
      advanceCollapseForPlayer(player, playerState);

      // Update max Z reached
      if (player.location.z > playerState.maxZReached) {
        playerState.maxZReached = player.location.z;
      }

      // Check finish proximity
      if (handleFinishZone(player, playerState)) {
        continue;
      }

      // Remove stray entities
      try {
        const nearbyEntities = dimension.getEntities({
          location: player.location,
          maxDistance: ENTITY_CLEANUP_RADIUS,
        });

        for (const entity of nearbyEntities) {
          if (entity.typeId === "minecraft:player") {
            continue;
          }
          if (ALLOWED_ENTITY_IDS.has(entity.typeId)) {
            continue;
          }
          try {
            entity.remove();
          } catch (error) {
            // Ignore.
          }
        }
      } catch (error) {
        // Entity queries can fail if chunks are loading.
      }
    }
  } finally {
    state.maintenanceRunning = false;
  }
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

  try {
    const players = world.getPlayers();
    return players.length === 1 ? players[0] : undefined;
  } catch (_error) {
    return undefined;
  }
}

function registerStartupHooks(event) {
  try {
    event.dimensionRegistry.registerCustomDimension(DIMENSION_ID);
  } catch (error) {
    // Already registered.
  }

  try {
    event.customCommandRegistry.registerCommand(
      {
        name: ENTER_COMMAND_ID,
        description: "Enter the Burning Highway dimension",
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
          runBurningHighwayEntryCommand(source);
        });

        return {
          status: CustomCommandStatus.Success,
          message: "Entering Burning Highway...",
        };
      },
    );
  } catch (error) {
    // Ignore duplicate command registration during reloads.
  }
}

world.afterEvents.worldLoad.subscribe(() => {
  system.run(() => {
    void bootstrapBurningHighwayWorld().catch(() => {});
  });
});

world.afterEvents.playerDimensionChange.subscribe(handlePlayerDimensionChange);
world.beforeEvents.chatSend.subscribe(handleChatEnterCommand);
world.afterEvents.entitySpawn.subscribe(handleEntitySpawn);
world.afterEvents.entityDie.subscribe(handleEntityDie);
world.afterEvents.playerLeave.subscribe(handlePlayerLeave);

// Death detection via respawn
try {
  world.afterEvents.playerSpawn.subscribe(handlePlayerSpawn);
} catch (error) {
  // playerSpawn may not be available in all API versions.
}

system.beforeEvents.startup.subscribe(registerStartupHooks);

system.run(() => {
  void bootstrapBurningHighwayWorld().catch(() => {});
});

system.runInterval(() => {
  void maintainBurningHighway().catch(() => {});
}, MAINTENANCE_INTERVAL_TICKS);

export { enterBurningHighway };
