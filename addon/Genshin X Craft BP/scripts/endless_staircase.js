import {
  BlockPermutation,
  CommandPermissionLevel,
  CustomCommandStatus,
  system,
  world,
} from "@minecraft/server";
import {
  VHS_TIER,
  canTrigger,
  requestRuleVhs,
  tryBeginRuleScare,
  safeActionBar,
  safeAddEffect,
  safePlaySound,
  safeTitle,
  sampleMotion,
  verifiedPlayerTeleport,
} from "./dimension_horror_rules.js";
import { enterBurningHighway } from "./burning_highway.js";
import { enterCatacombs } from "./catacombs.js";
import { enterFlatFlower } from "./flat_flower.js";
import { enterHeaven } from "./heaven.js";
import { enterLibrary } from "./library.js";
import { enterYellowHalls } from "./yellow_halls.js";
import { scheduleStructurePlacement } from "./paradise_visual_jobs.js";

const DIMENSION_ID = "paradise:endless_staircase";
const ENTER_COMMAND_ID = "p:enter_endless_staircase";
const CHAT_ENTER_COMMAND = "!enter_endless_staircase";
const LEAVE_COMMAND = "!leave_endless_staircase";

const LANE_SPACING = 1000;
const START_Y = 64;
const START_Z = 0;
const GENERATE_AHEAD = 40;
const CLEANUP_BEHIND = 20;
const FALL_THRESHOLD = 15;
const MAINTENANCE_INTERVAL_TICKS = 5;
const STAIR_TRAVEL_DIRECTION = "south";
const EXIT_Z = START_Z - 28;
const EXIT_TRIGGER_RADIUS = 3.25;
const UPWARD_TRANSFER_DISTANCE = 120;
const CHECKPOINT_INTERVAL = 4;
const STAIR_SCENERY_INTERVAL = 12;
const STAIR_SCENERY = Object.freeze({
  support: "paradise:endless_staircase/support_arch",
  buttress: "paradise:endless_staircase/broken_buttress",
  bridge: "paradise:endless_staircase/distant_bridge",
  landing: "paradise:endless_staircase/landing_frame",
});

const STAIR_WEIRDO_DIRECTION_BY_TRAVEL = Object.freeze({
  east: 0,
  west: 1,
  south: 2,
  north: 3,
});

const BLOCK = {
  air: "minecraft:air",
  stair: "minecraft:deepslate_brick_stairs",
  obsidian: "minecraft:obsidian",
  polishedDeepslate: "minecraft:polished_deepslate",
  stonePressurePlate: "minecraft:stone_pressure_plate",
};

const generatedVisualSlices = new Set();

const state = {
  bootstrapPromise: null,
  bootstrapReady: false,
  maintenanceRunning: false,
  activePlayers: new Map(),
  pendingRespawns: new Set(),
};

function toBlockPos(location) {
  return {
    x: Math.floor(location.x),
    y: Math.floor(location.y),
    z: Math.floor(location.z),
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

function getLaneOffsetForPlayer(playerId) {
  const hash = hashString(playerId);
  return (hash % 100000) * LANE_SPACING;
}

function getEndlessStaircaseDimension() {
  return world.getDimension(/** @type {any} */ (DIMENSION_ID));
}

function isEndlessStaircaseDimension(dimension) {
  return !!dimension && dimension.id === DIMENSION_ID;
}

function getDimensionById(dimensionId) {
  try {
    return world.getDimension(dimensionId || "minecraft:overworld");
  } catch (error) {
    return undefined;
  }
}

function setBlockSafe(dimension, location, typeId) {
  try {
    dimension.setBlockType(toBlockPos(location), typeId);
    return true;
  } catch (error) {
    return false;
  }
}

function getStairPermutationForDirection(direction = STAIR_TRAVEL_DIRECTION) {
  const weirdoDirection = STAIR_WEIRDO_DIRECTION_BY_TRAVEL[direction] ?? STAIR_WEIRDO_DIRECTION_BY_TRAVEL.south;
  return BlockPermutation.resolve(BLOCK.stair, {
    upside_down_bit: false,
    weirdo_direction: weirdoDirection,
  });
}

function setStairBlock(dimension, x, y, z) {
  try {
    const block = dimension.getBlock({ x, y, z });
    if (!block) return false;
    const perm = getStairPermutationForDirection(STAIR_TRAVEL_DIRECTION);
    block.setPermutation(perm);
    return true;
  } catch (error) {
    return false;
  }
}

function clearBlock(dimension, x, y, z) {
  try {
    dimension.setBlockType({ x, y, z }, BLOCK.air);
    return true;
  } catch (error) {
    return false;
  }
}

function getStairY(z) {
  return START_Y + (z - START_Z);
}

function scheduleStairScenery(dimension, laneOffset, z) {
  if (z < START_Z || z % STAIR_SCENERY_INTERVAL !== 0) return;
  const key = `${laneOffset}:${z}`;
  if (generatedVisualSlices.has(key)) return;
  generatedVisualSlices.add(key);

  const y = getStairY(z);
  const intervalIndex = Math.floor(z / STAIR_SCENERY_INTERVAL);
  let structureId = STAIR_SCENERY.support;
  let location = { x: laneOffset - 5, y: y - 1, z: z - 2 };

  if (intervalIndex !== 0 && intervalIndex % 24 === 0) {
    structureId = STAIR_SCENERY.bridge;
    location = { x: laneOffset + 10, y: y + 4, z: z - 2 };
  } else if (intervalIndex !== 0 && intervalIndex % 5 === 0) {
    structureId = STAIR_SCENERY.buttress;
    location = { x: laneOffset + 8, y: y - 1, z: z - 2 };
  } else if (intervalIndex !== 0 && intervalIndex % CHECKPOINT_INTERVAL === 0) {
    structureId = STAIR_SCENERY.landing;
    location = { x: laneOffset - 5, y: y - 1, z: z - 2 };
  }

  scheduleStructurePlacement(`endless-stair:${key}`, structureId, dimension, location);
}

function generateStairSlice(dimension, laneOffset, z) {
  const y = getStairY(z);
  setStairBlock(dimension, laneOffset, y, z);
  scheduleStairScenery(dimension, laneOffset, z);
}

function clearStairSlice(dimension, laneOffset, z) {
  const y = getStairY(z);
  clearBlock(dimension, laneOffset, y, z);
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (dx === 0 && dy === 0 && dz === 0) continue;
        clearBlock(dimension, laneOffset + dx, y + dy, z + dz);
      }
    }
  }
}

function generateStairsAhead(dimension, laneOffset, currentZ) {
  const startZ = Math.max(EXIT_Z, Math.floor(currentZ));
  const maxZ = Math.floor(currentZ) + GENERATE_AHEAD;
  for (let z = startZ; z <= maxZ; z++) {
    generateStairSlice(dimension, laneOffset, z);
  }
}

function clearOldStairs(dimension, laneOffset, currentZ) {
  const minZ = Math.floor(currentZ) - CLEANUP_BEHIND;
  if (minZ <= START_Z) return;
  for (let z = Math.max(START_Z, minZ - 5); z < minZ; z++) {
    clearStairSlice(dimension, laneOffset, z);
  }
}

function clearRouteArea(dimension, laneOffset, minZ, maxZ) {
  for (let z = minZ; z <= maxZ; z++) {
    const y = getStairY(z);
    for (let dx = -3; dx <= 3; dx++) {
      for (let dy = -5; dy <= 5; dy++) {
        clearBlock(dimension, laneOffset + dx, y + dy, z);
      }
    }
  }
}

function generateExitRoute(dimension, laneOffset) {
  for (let z = EXIT_Z; z <= START_Z + GENERATE_AHEAD; z++) {
    generateStairSlice(dimension, laneOffset, z);
  }
  placeExitStructure(dimension, laneOffset);
}

function placeExitStructure(dimension, laneOffset) {
  const exitY = getStairY(EXIT_Z);
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -3; dz <= 1; dz++) {
      const edge = Math.abs(dx) === 2 || dz === -3 || dz === 1;
      setBlockSafe(dimension, { x: laneOffset + dx, y: exitY, z: EXIT_Z + dz }, edge ? BLOCK.polishedDeepslate : BLOCK.obsidian);
      setBlockSafe(dimension, { x: laneOffset + dx, y: exitY + 1, z: EXIT_Z + dz }, BLOCK.air);
      setBlockSafe(dimension, { x: laneOffset + dx, y: exitY + 2, z: EXIT_Z + dz }, BLOCK.air);
    }
  }
  setBlockSafe(dimension, { x: laneOffset, y: exitY + 1, z: EXIT_Z - 1 }, BLOCK.stonePressurePlate);
}

function getPlayerState(playerId) {
  return state.activePlayers.get(playerId);
}

function setPlayerState(playerId, data) {
  state.activePlayers.set(playerId, data);
}

function removePlayerState(playerId) {
  state.activePlayers.delete(playerId);
}

async function enterEndlessStaircase(player) {
  if (!player || isEndlessStaircaseDimension(player.dimension)) {
    return false;
  }

  await bootstrapEndlessStaircaseWorld();

  const dimension = getEndlessStaircaseDimension();
  const laneOffset = getLaneOffsetForPlayer(player.id);

  clearRouteArea(dimension, laneOffset, EXIT_Z - 4, START_Z + GENERATE_AHEAD + 10);
  generateExitRoute(dimension, laneOffset);

  const returnPoint = {
    dimensionId: player.dimension.id,
    location: {
      x: player.location.x,
      y: player.location.y,
      z: player.location.z,
    },
  };

  const playerState = {
    laneOffset,
    returnPoint,
    pendingEscape: false,
    pendingTransfer: false,
    enteredAtTick: system.currentTick,
    lastZ: START_Z,
    maxZReached: START_Z,
    lastSafeZ: START_Z,
    lastSafeLocation: {
      x: laneOffset + 0.5,
      y: getStairY(START_Z) + 1,
      z: START_Z + 0.5,
    },
    upwardThreshold: UPWARD_TRANSFER_DISTANCE,
    transferStartedAtTick: 0,
    previousRuleZ: START_Z,
    retreatPressure: 0,
    cooldowns: new Map(),
  };

  setPlayerState(player.id, playerState);

  const startLocation = {
    x: laneOffset + 0.5,
    y: getStairY(START_Z) + 1,
    z: START_Z + 0.5,
  };

  const entered = await verifiedPlayerTeleport(player, startLocation, {
    dimension,
    checkForBlocks: false,
    keepVelocity: false,
    facingLocation: {
      x: laneOffset + 0.5,
      y: getStairY(START_Z + 8) + 1,
      z: START_Z + 8.5,
    },
  }, { attempts: 8, retryTicks: 4, maxDistance: 64 });
  if (!entered) {
    removePlayerState(player.id);
    return false;
  }

  try {
    player.sendMessage("You stand before an endless staircase. It stretches upward into nothing, repeating each step like a bad memory.");
    player.sendMessage("§cHint: §7The stairs ignore your feet. Try speaking to the place instead.");
  } catch (e) {}

  return true;
}

function runEndlessStaircaseEntryCommand(player) {
  void enterEndlessStaircase(player).then((entered) => {
    if (!entered) {
      try {
        player.sendMessage("Endless Staircase entry failed. Try again in a moment.");
      } catch (error) {}
    }
  }).catch((error) => {
    try {
      player.sendMessage(`Endless Staircase entry failed: ${String(error)}`);
    } catch (_error) {}
  });
}

async function escapePlayer(player) {
  const playerState = getPlayerState(player.id);
  if (!playerState || playerState.pendingEscape) {
    return false;
  }

  playerState.pendingEscape = true;

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

    try {
      player.sendMessage("You step off the stairs. The endless climb ends.");
    } catch (e) {}

    return true;
  } catch (error) {
    playerState.pendingEscape = false;
    return false;
  }
}

async function bootstrapEndlessStaircaseWorld() {
  if (!state.bootstrapPromise) {
    state.bootstrapPromise = (async () => {
      state.bootstrapReady = true;
    })().catch((error) => {
      state.bootstrapPromise = null;
      throw error;
    });
  }
  return state.bootstrapPromise;
}

function handlePlayerDimensionChange(event) {
  const player = event.player;
  if (!player) return;

  const entered =
    event.toDimension &&
    event.toDimension.id === DIMENSION_ID &&
    event.fromDimension &&
    event.fromDimension.id !== DIMENSION_ID;

  const left =
    event.fromDimension &&
    event.fromDimension.id === DIMENSION_ID &&
    event.toDimension &&
    event.toDimension.id !== DIMENSION_ID;

  if (entered) {
    const playerState = getPlayerState(player.id);
    if (playerState) {
      system.run(() => {
        const dimension = getEndlessStaircaseDimension();
        generateExitRoute(dimension, playerState.laneOffset);
      });
    }
    return;
  }

  if (left) {
    const playerState = getPlayerState(player.id);
    if (playerState && (playerState.pendingEscape || playerState.pendingTransfer)) {
      removePlayerState(player.id);
    }
  }
}

function handlePlayerSpawn(event) {
  const player = event.player;
  if (!player || event.initialSpawn) return;

  if (!state.pendingRespawns.has(player.id)) return;
  state.pendingRespawns.delete(player.id);

  const playerState = getPlayerState(player.id);
  if (!playerState) return;

  system.run(() => {
    void (async () => {
      const dimension = getEndlessStaircaseDimension();
      const laneOffset = playerState.laneOffset;
      const lastZ = Math.max(START_Z, Math.floor(playerState.lastZ || START_Z));
      const y = getStairY(lastZ);

      for (let z = lastZ - 5; z <= lastZ + GENERATE_AHEAD; z++) {
        generateStairSlice(dimension, laneOffset, z);
      }
      placeExitStructure(dimension, laneOffset);

      await verifiedPlayerTeleport(
        player,
        { x: laneOffset + 0.5, y: y + 1, z: lastZ + 0.5 },
        { dimension, checkForBlocks: false, keepVelocity: false },
        { attempts: 8, retryTicks: 4, maxDistance: 64 },
      );
    })().catch(() => {});
  });
}

function handleChatEnterCommand(event) {
  const message = String(event.message || "").trim().toLowerCase();
  if (message === CHAT_ENTER_COMMAND) {
    event.cancel = true;
    system.run(() => {
      const sender = event.sender;
      if (!sender || sender.typeId !== "minecraft:player") return;
      try {
        sender.sendMessage("Entering The Endless Staircase...");
      } catch (e) {}
      runEndlessStaircaseEntryCommand(sender);
    });
    return;
  }

  if (message === LEAVE_COMMAND) {
    event.cancel = true;
    system.run(() => {
      const sender = event.sender;
      if (!sender || sender.typeId !== "minecraft:player") return;
      void escapePlayer(sender).catch(() => {});
    });
  }
}

function handleEntitySpawn(event) {
  const entity = event.entity;
  if (!entity || !entity.isValid || !entity.dimension || entity.dimension.id !== DIMENSION_ID) return;
  if (entity.typeId === "minecraft:player" || entity.typeId === "minecraft:item" || entity.typeId === "minecraft:xp_orb") return;

  system.run(() => {
    try {
      entity.remove();
    } catch (e) {}
  });
}

function handleEntityDie(event) {
  const entity = event.deadEntity;
  if (!entity || entity.typeId !== "minecraft:player" || !isEndlessStaircaseDimension(entity.dimension)) {
    return;
  }

  state.pendingRespawns.add(entity.id);
}

function handlePlayerLeave(event) {
  state.pendingRespawns.delete(event.playerId);
  removePlayerState(event.playerId);
}

function clearPlayerVelocity(player) {
  try {
    if (typeof player.clearVelocity === "function") {
      player.clearVelocity();
    }
  } catch (error) {}
}

function isNearExit(player, playerState) {
  const dx = player.location.x - (playerState.laneOffset + 0.5);
  const dz = player.location.z - (EXIT_Z - 0.5);
  const dy = player.location.y - (getStairY(EXIT_Z) + 1);
  return Math.sqrt(dx * dx + dy * dy + dz * dz) <= EXIT_TRIGGER_RADIUS || Math.floor(player.location.z) <= EXIT_Z;
}

function updateSafeCheckpoint(player, playerState, currentZ, stairY) {
  if (currentZ < START_Z) return;
  if (Math.abs(player.location.x - (playerState.laneOffset + 0.5)) > 1.35) return;
  if (player.location.y < stairY || player.location.y > stairY + 3.5) return;

  playerState.maxZReached = Math.max(playerState.maxZReached || START_Z, currentZ);

  const previousSafeZ = playerState.lastSafeZ ?? START_Z;
  if (currentZ >= previousSafeZ + CHECKPOINT_INTERVAL || currentZ >= (playerState.maxZReached || START_Z) - 1) {
    playerState.lastSafeZ = currentZ;
    playerState.lastSafeLocation = {
      x: playerState.laneOffset + 0.5,
      y: stairY + 1,
      z: currentZ + 0.5,
    };
  }
}

function resetPlayerToEndlessCheckpoint(player, playerState, reason = "fall") {
  const dimension = getEndlessStaircaseDimension();
  const safeZ = Math.max(START_Z, Math.floor(playerState.lastSafeZ ?? START_Z));
  for (let z = Math.max(START_Z, safeZ - 4); z <= safeZ + GENERATE_AHEAD; z++) {
    generateStairSlice(dimension, playerState.laneOffset, z);
  }

  const target = playerState.lastSafeLocation || {
    x: playerState.laneOffset + 0.5,
    y: getStairY(safeZ) + 1,
    z: safeZ + 0.5,
  };

  clearPlayerVelocity(player);
  void verifiedPlayerTeleport(player, target, {
    dimension,
    checkForBlocks: false,
    keepVelocity: false,
    facingLocation: {
      x: target.x,
      y: target.y + 4,
      z: target.z + 8,
    },
  }, { attempts: 6, retryTicks: 3, maxDistance: 64 });

  if (reason === "fall") {
    safeActionBar(player, "The staircase catches you and puts you back on the last safe step.");
  }
}

function pickRandomParadiseTarget(excludedDimensionId = undefined) {
  const candidates = [
    { name: "Burning Highway", dimensionId: "paradise:burning_highway", enter: enterBurningHighway },
    { name: "Catacombs", dimensionId: "catacombs:catacomb_mazes", enter: enterCatacombs },
    { name: "Heaven", dimensionId: "heaven:the_heaven", enter: enterHeaven },
    { name: "Library", dimensionId: "library:the_library", enter: enterLibrary },
    { name: "Yellow Halls", dimensionId: "paradise:yellow_halls", enter: enterYellowHalls },
    { name: "Flat Flower", dimensionId: "paradise:flat_flower", enter: enterFlatFlower },
  ];
  const available = candidates.filter((candidate) => candidate.dimensionId !== excludedDimensionId);
  const pool = available.length ? available : candidates;
  return pool[Math.floor(Math.random() * pool.length)];
}

async function transferPlayerToRandomParadiseDimension(player, playerState) {
  if (!player || !playerState || playerState.pendingTransfer) return;

  playerState.pendingTransfer = true;
  playerState.pendingEscape = true;
  playerState.transferStartedAtTick = system.currentTick;

  const returnPoint = playerState.returnPoint;
  const target = pickRandomParadiseTarget(returnPoint && returnPoint.dimensionId);
  const stagingDimension = getDimensionById(returnPoint && returnPoint.dimensionId) || world.getDimension("minecraft:overworld");
  const stagingLocation = returnPoint && returnPoint.location ? returnPoint.location : world.getDefaultSpawnLocation();

  safeTitle(player, "The stairs end.", `Entering ${target.name}.`, 45);

  try {
    const staged = await verifiedPlayerTeleport(player, stagingLocation, {
      dimension: stagingDimension,
      checkForBlocks: false,
      keepVelocity: false,
    }, { attempts: 8, retryTicks: 4, maxDistance: 64 });
    if (!staged) {
      throw new Error("Staircase staging teleport verification failed.");
    }
  } catch (error) {
    playerState.pendingTransfer = false;
    playerState.pendingEscape = false;
    try {
      player.sendMessage(`The staircase transfer failed: ${String(error)}`);
    } catch (_error) {}
    return;
  }

  system.runTimeout(() => {
    void target.enter(player).then((entered) => {
      if (!entered) {
        try {
          player.sendMessage(`The staircase could not open ${target.name}.`);
        } catch (_error) {}
      }
    }).catch((error) => {
      try {
        player.sendMessage(`The staircase transfer failed: ${String(error)}`);
      } catch (_error) {}
    });
  }, 2);
}

function clearRetreatStairs(dimension, laneOffset, currentZ, pressure) {
  const extra = Math.min(9, 2 + Math.floor(pressure / 4));
  for (let z = currentZ - extra; z <= currentZ - 1; z++) {
    if (z < START_Z) continue;
    clearStairSlice(dimension, laneOffset, z);
  }
}

function updateEndlessRetreatRule(player, playerState, dimension, currentZ) {
  const motion = sampleMotion(playerState, player.location);
  const previousZ = playerState.previousRuleZ ?? currentZ;
  const climbing = currentZ > previousZ || motion.dz > 0.16;
  const descending = currentZ < previousZ || motion.dz < -0.16;
  const stalling = motion.horizontalSpeed < 0.025;
  playerState.previousRuleZ = currentZ;

  if (currentZ <= START_Z + 2) {
    playerState.retreatPressure = 0;
    return;
  }

  if (climbing && currentZ >= START_Z + 8) {
    playerState.retreatPressure = (playerState.retreatPressure || 0) + 2.2;
  } else if (descending) {
    playerState.retreatPressure = Math.max(0, (playerState.retreatPressure || 0) - 3);
  } else if (stalling) {
    playerState.retreatPressure = Math.max(0, (playerState.retreatPressure || 0) - 1.2);
  } else {
    playerState.retreatPressure = Math.max(0, (playerState.retreatPressure || 0) - 1.5);
  }

  if ((playerState.retreatPressure || 0) >= 5) {
    if (canTrigger(playerState, "upwardWarning", 20 * 9)) {
      safePlaySound(dimension, "ambient.cave", player.location, { volume: 0.55, pitch: 0.5 });
      safeActionBar(player, "Going up only makes the staircase longer.");
      requestRuleVhs(player, VHS_TIER.Low, 20 * 5, "staircase-upward-warning");
    }
    generateStairsAhead(dimension, playerState.laneOffset, currentZ + 10);
  }

  if ((playerState.retreatPressure || 0) >= 14) {
    const pressureDecision = tryBeginRuleScare(player, playerState, "effect", 20 * 16, {
      source: "dimension_scare:staircase_upward_loop",
      intensity: 4,
      minimumQuietTicks: 20 * 45,
      buildupTicks: 20 * 3,
      peakTicks: 20 * 6,
      reliefTicks: 20 * 18,
      globalCooldownTicks: 20 * 45,
      playerCooldownTicks: 20 * 55,
    });
    if (pressureDecision.allowed) {
      safeAddEffect(player, "minecraft:blindness", 35, { amplifier: 0, showParticles: false });
      safeTitle(player, "Upward is a loop.", "The exit is below where you began.", 35);
      requestRuleVhs(player, VHS_TIER.High, 20 * 6, "staircase-upward-loop");
    }
  }

  if ((playerState.retreatPressure || 0) >= 24) {
    const resetDecision = tryBeginRuleScare(player, playerState, "consequence", 20 * 35, {
      source: "dimension_scare:staircase_upward_reset",
      intensity: 5,
      minimumQuietTicks: 20 * 55,
      buildupTicks: 20 * 3,
      peakTicks: 20 * 5,
      reliefTicks: 20 * 25,
      globalCooldownTicks: 20 * 70,
      playerCooldownTicks: 20 * 85,
    });
    if (resetDecision.allowed) {
      playerState.retreatPressure = 8;
      playerState.maxZReached = START_Z;
      playerState.lastSafeZ = START_Z;
      playerState.lastSafeLocation = {
        x: playerState.laneOffset + 0.5,
        y: getStairY(START_Z) + 1,
        z: START_Z + 0.5,
      };
      generateExitRoute(dimension, playerState.laneOffset);
      safeTitle(player, "The climb repeats.", "Turn around. The lower exit is real.", 45);
      requestRuleVhs(player, VHS_TIER.Panic, 20 * 5, "staircase-upward-reset");
      void verifiedPlayerTeleport(player, playerState.lastSafeLocation, {
        dimension,
        checkForBlocks: false,
        keepVelocity: false,
        facingLocation: {
          x: playerState.laneOffset + 0.5,
          y: getStairY(EXIT_Z) + 1,
          z: EXIT_Z + 0.5,
        },
      }, { attempts: 4, retryTicks: 2, maxDistance: 80 });
    }
  }
}
function maintainEndlessStaircase() {
  if (state.maintenanceRunning || !state.bootstrapReady) return;

  const dimension = getEndlessStaircaseDimension();
  const players = dimension.getPlayers();

  if (!players.length) return;

  state.maintenanceRunning = true;

  try {
    for (const player of players) {
      if (!player || !isEndlessStaircaseDimension(player.dimension)) continue;

      const playerState = getPlayerState(player.id);
      if (!playerState || playerState.pendingEscape || playerState.pendingTransfer) continue;

      const laneOffset = playerState.laneOffset;
      const loc = player.location;
      const currentZ = Math.floor(loc.z);
      const stairY = getStairY(currentZ);

      playerState.lastZ = currentZ;

      generateStairsAhead(dimension, laneOffset, currentZ);
      if (currentZ <= START_Z + 6) {
        generateExitRoute(dimension, laneOffset);
      }

      updateSafeCheckpoint(player, playerState, currentZ, stairY);

      if (isNearExit(player, playerState)) {
        system.run(() => {
          void escapePlayer(player).catch(() => {});
        });
        continue;
      }

      if (currentZ >= START_Z + (playerState.upwardThreshold || UPWARD_TRANSFER_DISTANCE)) {
        system.run(() => {
          void transferPlayerToRandomParadiseDimension(player, playerState).catch(() => {});
        });
        continue;
      }

      updateEndlessRetreatRule(player, playerState, dimension, currentZ);

      clearOldStairs(dimension, laneOffset, currentZ);

      if (loc.y < stairY - FALL_THRESHOLD) {
        system.run(() => {
          resetPlayerToEndlessCheckpoint(player, playerState, "fall");
        });
        continue;
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
  } catch (error) {}

  try {
    event.customCommandRegistry.registerCommand(
      {
        name: ENTER_COMMAND_ID,
        description: "Enter The Endless Staircase",
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
          runEndlessStaircaseEntryCommand(source);
        });
        return {
          status: CustomCommandStatus.Success,
          message: "Entering The Endless Staircase...",
        };
      },
    );
  } catch (error) {}
}

world.afterEvents.worldLoad.subscribe(() => {
  system.run(() => {
    void bootstrapEndlessStaircaseWorld().catch(() => {});
  });
});

world.afterEvents.playerDimensionChange.subscribe(handlePlayerDimensionChange);
world.beforeEvents.chatSend.subscribe(handleChatEnterCommand);
world.afterEvents.entitySpawn.subscribe(handleEntitySpawn);
world.afterEvents.entityDie.subscribe(handleEntityDie);
world.afterEvents.playerLeave.subscribe(handlePlayerLeave);

try {
  world.afterEvents.playerSpawn.subscribe(handlePlayerSpawn);
} catch (error) {}

system.beforeEvents.startup.subscribe(registerStartupHooks);

system.run(() => {
  void bootstrapEndlessStaircaseWorld().catch(() => {});
});

system.runInterval(() => {
  maintainEndlessStaircase();
}, MAINTENANCE_INTERVAL_TICKS);

export { enterEndlessStaircase };
