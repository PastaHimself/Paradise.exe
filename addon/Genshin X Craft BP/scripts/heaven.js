import {
  BlockVolume,
  CommandPermissionLevel,
  CustomCommandStatus,
  GameMode,
  system,
  world,
} from "@minecraft/server";
import {
  VHS_TIER,
  canTrigger,
  clearRuleState,
  getOrCreateRuleState,
  makeNoteItem,
  requestRuleVhs,
  tryBeginRuleScare,
  safeAddEffect,
  safePlaySound,
  safeTitle,
  sampleMotion,
  verifiedPlayerTeleport,
  setStandingSign,
} from "./dimension_horror_rules.js";
import { getCachedPlayers } from "./paradise_tick_cache.js";
import { hashCoords as visualHashCoords, scheduleStructurePlacement } from "./paradise_visual_jobs.js";
import { playersIntersectStructureBounds } from "./paradise_visual_geometry.js";

export const HEAVEN_DIMENSION_ID = "heaven:the_heaven";
const LEGACY_ENTER_COMMAND_ID = "p:heaven";
const PARADISE_ENTER_COMMAND_ID = "p:enter_heaven";
const CHAT_ENTER_COMMAND = "!enter_heaven";
const FLOOR_Y = 64;
const CHUNK_SIZE = 16;
const VISIT_GRID_SPACING = 1000;
const RETURN_TICKING_AREA_PREFIX = "heaven:return:";
const VOID_FALL_THRESHOLD = -64;
const FLOOR_GEN_INTERVAL_TICKS = 2;
const VOID_MONITOR_INTERVAL_TICKS = 1;
const HEAVEN_ART = Object.freeze({
  colonnade: "paradise:heaven/colonnade",
  arch: "paradise:heaven/celestial_arch",
  pool: "paradise:heaven/reflection_pool",
  temple: "paradise:heaven/distant_temple",
});
const HEAVEN_ART_SIZE = Object.freeze({
  temple: Object.freeze({ x: 24, y: 15, z: 24 }),
});
const HEAVEN_STRUCTURE_PLAYER_MARGIN = 2;

const RANDOM_DIMENSIONS = [
  "minecraft:nether",
  "minecraft:the_end",
  "catacombs:catacomb_mazes",
  "paradise:yellow_halls",
  "paradise:flat_flower",
  "paradise:endless_staircase",
  "paradise:burning_highway",
];

const HOSTILE_MOB_IDS = new Set([
  "minecraft:blaze",
  "minecraft:cave_spider",
  "minecraft:creeper",
  "minecraft:drowned",
  "minecraft:elder_guardian",
  "minecraft:ender_dragon",
  "minecraft:enderman",
  "minecraft:endermite",
  "minecraft:evocation_illager",
  "minecraft:ghast",
  "minecraft:guardian",
  "minecraft:hoglin",
  "minecraft:husk",
  "minecraft:magma_cube",
  "minecraft:phantom",
  "minecraft:piglin",
  "minecraft:piglin_brute",
  "minecraft:pillager",
  "minecraft:ravager",
  "minecraft:shulker",
  "minecraft:silverfish",
  "minecraft:skeleton",
  "minecraft:slime",
  "minecraft:spider",
  "minecraft:stray",
  "minecraft:vex",
  "minecraft:vindicator",
  "minecraft:witch",
  "minecraft:wither",
  "minecraft:wither_skeleton",
  "minecraft:zoglin",
  "minecraft:zombie",
  "minecraft:zombie_villager",
]);

const PASSABLE_HAZARDS = new Set([
  "minecraft:air",
  "minecraft:cave_air",
  "minecraft:void_air",
  "minecraft:water",
  "minecraft:lava",
  "minecraft:fire",
  "minecraft:soul_fire",
  "minecraft:web",
  "minecraft:cobweb",
  "minecraft:powder_snow",
  "minecraft:magma_block",
]);

const returnPoints = new Map();
const heavenGamemodes = new Map();
const visitCounters = new Map();
const generatedChunks = new Set();
const pendingVoidFall = new Set();
const heavenTrustRules = new Map();

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function isHeavenDimensionId(dimensionId) {
  return String(dimensionId) === HEAVEN_DIMENSION_ID;
}

function getDimensionSafe(dimensionId) {
  try {
    return world.getDimension(dimensionId);
  } catch (_error) {
    return undefined;
  }
}

function getHeavenPlayers() {
  try {
    const dimension = getDimensionSafe(HEAVEN_DIMENSION_ID);
    if (dimension && typeof dimension.getPlayers === "function") {
      return dimension.getPlayers().filter((player) => player && isHeavenDimensionId(player.dimension.id));
    }
  } catch (_error) {
    // Fall back to the global player scan below.
  }

  try {
    return getCachedPlayers().filter((player) => player && isHeavenDimensionId(player.dimension.id));
  } catch (_error) {
    return [];
  }
}

function announce(player, title, subtitle) {
  try {
    player.onScreenDisplay.setTitle(title, {
      subtitle,
      fadeInDuration: 5,
      stayDuration: 40,
      fadeOutDuration: 10,
    });
  } catch (_error) {
    // Screen display failures are non-fatal.
  }
}

function getPlayerGameMode(player) {
  try {
    if (typeof player.getGameMode === "function") {
      return player.getGameMode();
    }
  } catch (_error) {
    // Ignore and fall back.
  }
  return undefined;
}

function enableHeavenBuildAccess(player) {
  if (!player || !isHeavenDimensionId(player.dimension.id)) {
    return;
  }

  if (!heavenGamemodes.has(player.id)) {
    heavenGamemodes.set(player.id, getPlayerGameMode(player));
  }

  system.run(() => {
    try {
      player.setGameMode(GameMode.Survival);
    } catch (_error) {
      // If the override fails, the dimension still works but block edits may remain restricted.
    }
  });
}

function restoreHeavenBuildAccess(player) {
  if (!player) {
    return;
  }

  const savedGameMode = heavenGamemodes.get(player.id);
  heavenGamemodes.delete(player.id);

  if (!savedGameMode) {
    return;
  }

  system.run(() => {
    try {
      player.setGameMode(savedGameMode);
    } catch (_error) {
      // Ignore restoration failures.
    }
  });
}

function syncHeavenGamemodes() {
  for (const player of getCachedPlayers()) {
    if (!player || !isHeavenDimensionId(player.dimension.id)) {
      continue;
    }
    enableHeavenBuildAccess(player);
  }
}

function getBlockSafe(dimension, x, y, z) {
  try {
    return dimension.getBlock({ x, y, z });
  } catch (_error) {
    return undefined;
  }
}

function isSafeStandingSpot(dimension, position) {
  const feet = getBlockSafe(dimension, Math.floor(position.x), Math.floor(position.y), Math.floor(position.z));
  const head = getBlockSafe(dimension, Math.floor(position.x), Math.floor(position.y) + 1, Math.floor(position.z));
  const below = getBlockSafe(dimension, Math.floor(position.x), Math.floor(position.y) - 1, Math.floor(position.z));
  if (!feet || !head || !below) {
    return false;
  }
  if (!feet.isAir || !head.isAir) {
    return false;
  }
  if (below.isAir || below.isLiquid) {
    return false;
  }
  if (PASSABLE_HAZARDS.has(below.typeId)) {
    return false;
  }
  return true;
}

function findSafeReturnSpot(dimension, location) {
  const baseX = Math.floor(location.x);
  const baseY = Math.floor(location.y);
  const baseZ = Math.floor(location.z);

  for (let radius = 0; radius <= 5; radius++) {
    for (let dy = -2; dy <= 4; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          const candidate = {
            x: baseX + dx + 0.5,
            y: baseY + dy,
            z: baseZ + dz + 0.5,
          };
          if (isSafeStandingSpot(dimension, candidate)) {
            return candidate;
          }
        }
      }
    }
  }

  return null;
}

function getHeavenTrustState(playerId) {
  return getOrCreateRuleState(heavenTrustRules, playerId, () => ({
    trustDebt: 0,
    lingerTicks: 0,
    restLocation: undefined,
    cooldowns: new Map(),
  }));
}

function setBlockTypeSafe(dimension, location, typeId) {
  try {
    dimension.setBlockType({ x: Math.floor(location.x), y: Math.floor(location.y), z: Math.floor(location.z) }, typeId);
    return true;
  } catch (_error) {
    return false;
  }
}

function placeHeavenRestStation(dim, spawn, playerId = undefined) {
  const x = Math.floor(spawn.x);
  const z = Math.floor(spawn.z);
  const center = { x, y: FLOOR_Y + 1, z: z + 5 };

  for (let dx = -3; dx <= 3; dx++) {
    for (let dz = 2; dz <= 8; dz++) {
      setBlockTypeSafe(dim, { x: x + dx, y: FLOOR_Y, z: z + dz }, Math.abs(dx) === 3 || dz === 2 || dz === 8 ? "minecraft:smooth_quartz" : "minecraft:white_concrete");
    }
  }

  setBlockTypeSafe(dim, { x: x - 1, y: FLOOR_Y + 1, z: z + 5 }, "minecraft:white_bed");
  setBlockTypeSafe(dim, { x: x + 2, y: FLOOR_Y + 1, z: z + 5 }, "minecraft:chest");
  setStandingSign(dim, { x, y: FLOOR_Y + 1, z: z + 3 }, "REST\\nYOU ARE\\nSAFE", "minecraft:birch_sign");
  setStandingSign(dim, { x, y: FLOOR_Y + 1, z: z + 7 }, "STAY", "minecraft:birch_sign");

  try {
    const chest = dim.getBlock({ x: x + 2, y: FLOOR_Y + 1, z: z + 5 });
    const inventory = chest ? chest.getComponent("minecraft:inventory") : undefined;
    const note = makeNoteItem("Welcome", ["Food is unnecessary here.", "Sleep is unnecessary here.", "Trust is expected here."]);
    if (inventory && inventory.container && note) {
      inventory.container.setItem(0, note);
    }
  } catch (_error) {}

  if (playerId) {
    const ruleState = getHeavenTrustState(playerId);
    ruleState.restLocation = center;
  }
}

function isNearHeavenRest(ruleState, location, radius = 7) {
  const rest = ruleState.restLocation;
  if (!rest) return false;
  const dx = location.x - rest.x;
  const dz = location.z - rest.z;
  return dx * dx + dz * dz <= radius * radius;
}

function addHeavenTrustDebt(player, amount, reason) {
  const ruleState = getHeavenTrustState(player.id);
  ruleState.trustDebt = Math.max(0, (ruleState.trustDebt || 0) + amount);
  if (canTrigger(ruleState, `warn:${reason}`, 20 * 12)) {
    safePlaySound(player.dimension, "ambient.cave", player.location, { volume: 0.55, pitch: 1.8 });
    safeTitle(player, "", reason === "rest" ? "Safety answers too quickly." : "The room waits for trust.", 35);
    requestRuleVhs(player, VHS_TIER.Low, 20 * 5, "heaven-artificial-safety");
  }

  if (ruleState.trustDebt >= 12) {
    rejectHeavenSafety(player, ruleState);
  }
}

function duplicateHeavenRestStation(player, ruleState) {
  if (!canTrigger(ruleState, "duplicate-room", 20 * 25)) return;
  const rest = ruleState.restLocation;
  if (!rest) return;
  const dim = player.dimension;
  const shifted = { x: rest.x + 9, y: FLOOR_Y + 1, z: rest.z };
  placeHeavenRestStation(dim, shifted, undefined);
  setStandingSign(dim, { x: shifted.x, y: FLOOR_Y + 1, z: shifted.z + 3 }, "REST\\nAGAIN", "minecraft:birch_sign");
}

function rejectHeavenSafety(player, ruleState) {
  const scareDecision = tryBeginRuleScare(player, ruleState, "consequence", 20 * 60, {
    source: "dimension_scare:heaven_rejection",
    intensity: 4,
    minimumQuietTicks: 20 * 50,
    buildupTicks: 20 * 4,
    peakTicks: 20 * 8,
    reliefTicks: 20 * 25,
    globalCooldownTicks: 20 * 70,
    playerCooldownTicks: 20 * 80,
  });
  if (!scareDecision.allowed) return;
  ruleState.trustDebt = 0;
  safeTitle(player, "Returned", "The safe room was not safe.", 55);
  safeAddEffect(player, "minecraft:blindness", 55, { amplifier: 0, showParticles: false });
  requestRuleVhs(player, VHS_TIER.High, 20 * 8, "heaven-rejection");
  system.runTimeout(() => {
    void teleportToRandomDimension(player).catch(() => {});
  }, 8);
}

function tickHeavenTrustRules() {
  const players = getHeavenPlayers();
  if (!players.length) return;
  for (const player of players) {
    const ruleState = getHeavenTrustState(player.id);
    const motion = sampleMotion(ruleState, player.location);
    if (isNearHeavenRest(ruleState, player.location) && motion.horizontalSpeed < 0.03) {
      ruleState.lingerTicks = (ruleState.lingerTicks || 0) + motion.dt;
    } else {
      ruleState.lingerTicks = Math.max(0, (ruleState.lingerTicks || 0) - motion.dt * 2);
    }
    if ((ruleState.lingerTicks || 0) >= 80) {
      ruleState.lingerTicks = 20;
      duplicateHeavenRestStation(player, ruleState);
      addHeavenTrustDebt(player, 3, "linger");
    }
  }
}

function handleHeavenInteract(event) {
  const player = event.player;
  const block = event.block;
  if (!player || !block || !isHeavenDimensionId(player.dimension.id)) return;
  const typeId = String(block.typeId);
  if (!typeId.includes("bed") && typeId !== "minecraft:chest" && typeId !== "minecraft:barrel") return;
  system.run(() => {
    const ruleState = getHeavenTrustState(player.id);
    if (!isNearHeavenRest(ruleState, block.location, 10)) return;
    duplicateHeavenRestStation(player, ruleState);
    addHeavenTrustDebt(player, typeId.includes("bed") ? 5 : 3, "rest");
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

  try {
    const players = world.getPlayers();
    return players.length === 1 ? players[0] : undefined;
  } catch (_error) {
    return undefined;
  }
}

function registerHeavenEnterCommand(event, commandId) {
  try {
    event.customCommandRegistry.registerCommand(
      {
        name: commandId,
        description: "Enter the Heaven dimension",
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
          runHeavenEntryCommand(source);
        });

        return {
          status: CustomCommandStatus.Success,
          message: "Preparing Heaven...",
        };
      },
    );
  } catch (_error) {
    // Ignore duplicate command registration during reloads.
  }
}

function handleHeavenChatEnterCommand(event) {
  const message = String(event.message || "").trim().toLowerCase();
  if (message !== CHAT_ENTER_COMMAND) {
    return;
  }

  event.cancel = true;
  system.run(() => {
    const sender = event.sender;
    if (!sender || sender.typeId !== "minecraft:player") return;
    try {
      sender.sendMessage("Entering Heaven...");
    } catch (_error) {}
    runHeavenEntryCommand(sender);
  });
}

system.beforeEvents.startup.subscribe((event) => {
  try {
    event.dimensionRegistry.registerCustomDimension(HEAVEN_DIMENSION_ID);
  } catch (_error) {
    // Ignore already-registered reloads.
  }

  registerHeavenEnterCommand(event, LEGACY_ENTER_COMMAND_ID);
  registerHeavenEnterCommand(event, PARADISE_ENTER_COMMAND_ID);
});

world.afterEvents.worldLoad.subscribe(() => {
  system.run(() => {
    syncHeavenGamemodes();
  });
});

world.beforeEvents.chatSend.subscribe(handleHeavenChatEnterCommand);

world.afterEvents.playerDimensionChange.subscribe((event) => {
  const player = event.player;
  if (!player) {
    return;
  }

  if (isHeavenDimensionId(event.toDimension.id) && !isHeavenDimensionId(event.fromDimension.id)) {
    if (!returnPoints.has(player.id)) {
      returnPoints.set(player.id, {
        dimensionId: event.fromDimension.id,
        location: {
          x: event.fromLocation.x,
          y: event.fromLocation.y,
          z: event.fromLocation.z,
        },
      });
    }
    system.run(() => {
      enableHeavenBuildAccess(player);
    });
    return;
  }

  if (isHeavenDimensionId(event.fromDimension.id) && !isHeavenDimensionId(event.toDimension.id)) {
    system.run(() => {
      restoreHeavenBuildAccess(player);
    });

    if (pendingVoidFall.has(player.id)) {
      // The void-fall handler already performed cleanup; just sync here.
      pendingVoidFall.delete(player.id);
      return;
    }

    returnPoints.delete(player.id);
    heavenGamemodes.delete(player.id);
    visitCounters.delete(player.id);
    clearRuleState(heavenTrustRules, player.id);
  }
});

world.afterEvents.playerLeave.subscribe((event) => {
  returnPoints.delete(event.playerId);
  heavenGamemodes.delete(event.playerId);
  visitCounters.delete(event.playerId);
  pendingVoidFall.delete(event.playerId);
  clearRuleState(heavenTrustRules, event.playerId);
});

world.afterEvents.playerInteractWithBlock.subscribe(handleHeavenInteract);

world.afterEvents.entitySpawn.subscribe((event) => {
  const entity = event.entity;
  if (!entity || !entity.isValid || !entity.dimension || !isHeavenDimensionId(entity.dimension.id)) {
    return;
  }
  if (!HOSTILE_MOB_IDS.has(entity.typeId)) {
    return;
  }
  system.run(() => {
    try {
      entity.remove();
    } catch (_error) {
      // Ignore removal failures.
    }
  });
});

system.runInterval(generateHeavenFloor, FLOOR_GEN_INTERVAL_TICKS);
system.runInterval(monitorHeavenVoidFalls, VOID_MONITOR_INTERVAL_TICKS);
system.runInterval(tickHeavenTrustRules, 10);

function paintHeavenFloorPattern(dim, cx, cz) {
  const ox = cx * CHUNK_SIZE;
  const oz = cz * CHUNK_SIZE;
  const seed = visualHashCoords(cx, cz, 0x48454156);

  // Full white base guarantees one solid Y=64 block at every X/Z. The
  // following fills only replace that base with pale architectural bands.
  dim.fillBlocks(
    new BlockVolume({ x: ox, y: FLOOR_Y, z: oz }, { x: ox + 15, y: FLOOR_Y, z: oz + 15 }),
    "minecraft:white_concrete",
  );

  if (seed % 2 === 0) {
    dim.fillBlocks(new BlockVolume({ x: ox + 7, y: FLOOR_Y, z: oz }, { x: ox + 8, y: FLOOR_Y, z: oz + 15 }), "minecraft:smooth_quartz");
  } else {
    dim.fillBlocks(new BlockVolume({ x: ox, y: FLOOR_Y, z: oz + 7 }, { x: ox + 15, y: FLOOR_Y, z: oz + 8 }), "minecraft:smooth_quartz");
  }

  const panelX = seed & 2 ? ox + 2 : ox + 10;
  const panelZ = seed & 4 ? oz + 2 : oz + 10;
  dim.fillBlocks(new BlockVolume({ x: panelX, y: FLOOR_Y, z: panelZ }, { x: panelX + 3, y: FLOOR_Y, z: panelZ + 3 }), "minecraft:calcite");

  if (seed % 3 === 0) {
    dim.fillBlocks(new BlockVolume({ x: ox, y: FLOOR_Y, z: oz }, { x: ox + 15, y: FLOOR_Y, z: oz }), "minecraft:quartz_bricks");
  }
}

function scheduleHeavenChunkArt(dim, cx, cz) {
  const seed = visualHashCoords(cx, cz, 0x43454c45);
  const ox = cx * CHUNK_SIZE;
  const oz = cz * CHUNK_SIZE;
  const templeLocation = { x: ox - 4, y: FLOOR_Y + 1, z: oz - 4 };
  const templeBlockedByPlayer = playersIntersectStructureBounds(
    getHeavenPlayers(),
    templeLocation,
    HEAVEN_ART_SIZE.temple,
    HEAVEN_STRUCTURE_PLAYER_MARGIN,
  );

  if (seed % 64 === 0 && !templeBlockedByPlayer) {
    scheduleStructurePlacement(
      `heaven-temple:${cx}:${cz}`,
      HEAVEN_ART.temple,
      dim,
      templeLocation,
    );
    return;
  }
  if (seed % 4 !== 0) return;

  const small = [HEAVEN_ART.colonnade, HEAVEN_ART.arch, HEAVEN_ART.pool];
  const structureId = small[(seed >>> 6) % small.length];
  const location = structureId === HEAVEN_ART.arch
    ? { x: ox + 2, y: FLOOR_Y + 1, z: oz + 10 }
    : { x: ox, y: FLOOR_Y + 1, z: oz };
  scheduleStructurePlacement(`heaven-art:${cx}:${cz}`, structureId, dim, location);
}

function generateHeavenChunk(dim, cx, cz) {
  paintHeavenFloorPattern(dim, cx, cz);
  generatedChunks.add(`${cx}:${cz}`);
  scheduleHeavenChunkArt(dim, cx, cz);
}

function generateHeavenFloor() {
  const dim = getDimensionSafe(HEAVEN_DIMENSION_ID);
  if (!dim) {
    return;
  }

  const players = getHeavenPlayers();
  if (players.length === 0) {
    return;
  }

  for (const player of players) {
    const pcx = Math.floor(player.location.x / CHUNK_SIZE);
    const pcz = Math.floor(player.location.z / CHUNK_SIZE);

    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const cx = pcx + dx;
        const cz = pcz + dz;
        const key = `${cx}:${cz}`;
        if (generatedChunks.has(key)) {
          continue;
        }

        try {
          generateHeavenChunk(dim, cx, cz);
        } catch (_error) {
          // Chunk may not be loaded yet; retry next tick.
        }
      }
    }
  }
}

function monitorHeavenVoidFalls() {
  const players = getHeavenPlayers();
  if (players.length === 0) {
    return;
  }

  for (const player of players) {
    if (player.location.y >= VOID_FALL_THRESHOLD) {
      continue;
    }
    if (pendingVoidFall.has(player.id)) {
      continue;
    }

    pendingVoidFall.add(player.id);

    if (Math.random() < 0.2) {
      void (async () => {
        try {
          await exitHeavenToOverworld(player);
        } catch (_error) {
          pendingVoidFall.delete(player.id);
        }
      })();
    } else {
      void (async () => {
        try {
          await teleportToRandomDimension(player);
        } catch (_error) {
          pendingVoidFall.delete(player.id);
        }
      })();
    }
  }
}

function getNextHeavenSpawn(visitIndex) {
  return {
    x: visitIndex * VISIT_GRID_SPACING + 0.5,
    y: FLOOR_Y + 1,
    z: 0.5,
  };
}

function preGenerateSpawnChunks(dim, spawn) {
  const scx = Math.floor(spawn.x / CHUNK_SIZE);
  const scz = Math.floor(spawn.z / CHUNK_SIZE);

  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const cx = scx + dx;
      const cz = scz + dz;
      const key = `${cx}:${cz}`;
      if (generatedChunks.has(key)) {
        continue;
      }

      try {
        if (cx === scx && cz === scz) {
          // Keep the arrival chunk visually finished but free of authored
          // structures so the preserved spawn point can never be obstructed.
          paintHeavenFloorPattern(dim, cx, cz);
          generatedChunks.add(key);
        } else {
          generateHeavenChunk(dim, cx, cz);
        }
      } catch (_error) {
        // Ignore generation failures for pre-load.
      }
    }
  }
}

export async function enterHeaven(player) {
  if (isHeavenDimensionId(player.dimension.id)) {
    announce(player, "The Heaven", "You are already in Heaven.");
    return false;
  }

  if (!returnPoints.has(player.id)) {
    returnPoints.set(player.id, {
      dimensionId: player.dimension.id,
      location: {
        x: player.location.x,
        y: player.location.y,
        z: player.location.z,
      },
    });
  }

  if (!heavenGamemodes.has(player.id)) {
    heavenGamemodes.set(player.id, getPlayerGameMode(player));
  }

  const currentCount = visitCounters.get(player.id) || 0;
  const nextCount = currentCount + 1;
  visitCounters.set(player.id, nextCount);

  const spawn = getNextHeavenSpawn(nextCount);

  const dim = getDimensionSafe(HEAVEN_DIMENSION_ID);
  if (!dim) {
    if (typeof player.sendMessage === "function") {
      player.sendMessage("Heaven dimension is not available.");
    }
    return false;
  }

  preGenerateSpawnChunks(dim, spawn);

  try {
    const entered = await verifiedPlayerTeleport(player, spawn, {
      dimension: dim,
      checkForBlocks: false,
      keepVelocity: false,
    }, { attempts: 8, retryTicks: 4, maxDistance: 64 });
    if (!entered) {
      throw new Error("Heaven teleport verification failed.");
    }
  } catch (error) {
    if (typeof player.sendMessage === "function") {
      player.sendMessage(`Failed to enter Heaven: ${String(error)}`);
    }
    return false;
  }

  enableHeavenBuildAccess(player);
  system.run(() => {
    placeHeavenRestStation(dim, spawn, player.id);
  });
  announce(player, "The Heaven", "A place of peace... or so it seems.");
  return true;
}

function runHeavenEntryCommand(player) {
  void enterHeaven(player).then((entered) => {
    if (!entered) {
      try {
        player.sendMessage("Heaven entry failed. Try again in a moment.");
      } catch (_error) {}
    }
  }).catch((error) => {
    try {
      player.sendMessage(`Heaven entry failed: ${String(error)}`);
    } catch (_error) {}
  });
}

async function exitHeavenToOverworld(player) {
  try {
    const saved = returnPoints.get(player.id);
    const targetDimension = getDimensionSafe("minecraft:overworld");
    if (!targetDimension) {
      throw new Error("No valid return dimension is available.");
    }

    const fallbackLocation = (saved && saved.location) || world.getDefaultSpawnLocation();
    const safeLocation = findSafeReturnSpot(targetDimension, fallbackLocation);
    const teleportTarget = safeLocation || {
      x: fallbackLocation.x,
      y: fallbackLocation.y,
      z: fallbackLocation.z,
    };

    const returnAreaId = `${RETURN_TICKING_AREA_PREFIX}${player.id}`;
    try {
      world.tickingAreaManager.removeTickingArea(returnAreaId);
    } catch (_error) {
      // Ignore missing ticking areas.
    }

    await world.tickingAreaManager.createTickingArea(returnAreaId, {
      dimension: targetDimension,
      from: {
        x: Math.floor(teleportTarget.x) - 4,
        y: Math.floor(teleportTarget.y) - 2,
        z: Math.floor(teleportTarget.z) - 4,
      },
      to: {
        x: Math.floor(teleportTarget.x) + 4,
        y: Math.floor(teleportTarget.y) + 4,
        z: Math.floor(teleportTarget.z) + 4,
      },
    });

    try {
      if (safeLocation) {
        await verifiedPlayerTeleport(player, teleportTarget, {
          dimension: targetDimension,
          checkForBlocks: false,
          keepVelocity: false,
        }, { attempts: 8, retryTicks: 4, maxDistance: 64 });
      } else {
        await verifiedPlayerTeleport(player, teleportTarget, {
          dimension: targetDimension,
          checkForBlocks: true,
          keepVelocity: false,
        }, { attempts: 8, retryTicks: 4, maxDistance: 64 });
      }
    } finally {
      try {
        world.tickingAreaManager.removeTickingArea(returnAreaId);
      } catch (_error) {
        // Ignore cleanup failures.
      }
    }

    restoreHeavenBuildAccess(player);
    returnPoints.delete(player.id);
    heavenGamemodes.delete(player.id);
    visitCounters.delete(player.id);
    pendingVoidFall.delete(player.id);
    clearRuleState(heavenTrustRules, player.id);
    announce(player, "Returned", "You escaped the illusion.");
  } catch (error) {
    pendingVoidFall.delete(player.id);
    if (typeof player.sendMessage === "function") {
      player.sendMessage(`Failed to return from Heaven: ${String(error)}`);
    }
  }
}

async function teleportToRandomDimension(player) {
  try {
    const targetId = RANDOM_DIMENSIONS[randomInt(0, RANDOM_DIMENSIONS.length - 1)];
    const targetDimension = getDimensionSafe(targetId);
    if (!targetDimension) {
      throw new Error(`Dimension ${targetId} is not available.`);
    }

    const castElsewhere = await verifiedPlayerTeleport(
      player,
      { x: 0.5, y: 100, z: 0.5 },
      {
        dimension: targetDimension,
        checkForBlocks: false,
        keepVelocity: false,
      },
      { attempts: 8, retryTicks: 4, maxDistance: 64 },
    );
    if (!castElsewhere) {
      throw new Error("Random dimension teleport verification failed.");
    }

    returnPoints.delete(player.id);
    heavenGamemodes.delete(player.id);
    visitCounters.delete(player.id);
    pendingVoidFall.delete(player.id);
    clearRuleState(heavenTrustRules, player.id);
  } catch (error) {
    pendingVoidFall.delete(player.id);
    if (typeof player.sendMessage === "function") {
      player.sendMessage(`The void cast you elsewhere: ${String(error)}`);
    }
  }
}
