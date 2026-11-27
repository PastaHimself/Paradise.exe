import {
  BlockPermutation,
  BlockVolume,
  CommandPermissionLevel,
  CustomCommandStatus,
  GameMode,
  ItemStack,
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
import { hashCoords as visualHashCoords, scheduleStructurePlacement, scheduleVisualJob } from "./paradise_visual_jobs.js";
import {
  applyLibrarySurfaces,
  applyLibraryShelves,
  applyLibraryFurniture,
  applyLibraryLights,
  applyLibrarySigns,
  applyLibraryRestrictedBay,
} from "./library_decor.js";
import {
  isAlcoveCell,
  isArrivalChunk,
  isConnectionReservation,
  isProtectedBookshelf,
  isReadingRoom,
  isRestrictedApproachCell,
  isRestrictedRoom,
  isWestRoom,
} from "./library_layout.js";

export const LIBRARY_DIMENSION_ID = "library:the_library";
const LEGACY_ENTER_COMMAND_ID = "p:library";
const PARADISE_ENTER_COMMAND_ID = "p:enter_library";
const CHAT_ENTER_COMMAND = "!enter_library";
const FLOOR_Y = 64;
const CEILING_Y = 73;
const ROOM_HEIGHT_MIN = 65;
const ROOM_HEIGHT_MAX = 72;
const CHUNK_SIZE = 16;
const VISIT_GRID_SPACING = 1000;
const RETURN_TICKING_AREA_PREFIX = "library:return:";
const VOID_FALL_THRESHOLD = -64;
const ROOM_GEN_INTERVAL_TICKS = 2;
const VOID_MONITOR_INTERVAL_TICKS = 1;
const LIBRARY_ART = Object.freeze({
  balcony: "paradise:library/upper_balcony",
  alcove: "paradise:library/reading_alcove",
  frame: "paradise:library/archive_frame",
  monument: "paradise:library/central_monument",
});

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
  "minecraft:cobweb",
  "minecraft:powder_snow",
  "minecraft:magma",
]);

const RIDDLES = [
  { question: "I speak without a mouth and hear without ears. I have no body but I come alive with wind. What am I?", answer: "echo" },
  { question: "The more you take, the more you leave behind. What am I?", answer: "footsteps" },
  { question: "I have cities but no houses, forests but no trees, and water but no fish. What am I?", answer: "map" },
  { question: "I can be cracked, made, told, and played. What am I?", answer: "joke" },
  { question: "What has hands but cannot clap?", answer: "clock" },
  { question: "I have keys but no locks, space but no room. You can enter but cannot go inside. What am I?", answer: "keyboard" },
  { question: "The more you have of me, the less you see. What am I?", answer: "darkness" },
];

const MATH_QUESTIONS = [
  { question: "What is 15 x 4 + 7?", answer: "67" },
  { question: "What is 144 divided by 12, then multiplied by 3?", answer: "36" },
  { question: "What is 2 to the power of 10?", answer: "1024" },
  { question: "What is the square root of 169?", answer: "13" },
  { question: "What is 50 percent of 250?", answer: "125" },
  { question: "What is 17 x 17?", answer: "289" },
  { question: "What is 1000 minus 337?", answer: "663" },
];

const HISTORY_QUESTIONS = [
  { question: "In what year did World War II end?", answer: "1945" },
  { question: "Who was the first person to walk on the Moon?", answer: "neil armstrong" },
  { question: "In what year did the Berlin Wall fall?", answer: "1989" },
  { question: "Who painted the Mona Lisa?", answer: "leonardo da vinci" },
  { question: "In what year did Columbus reach the Americas?", answer: "1492" },
  { question: "What empire did Julius Caesar lead?", answer: "roman" },
  { question: "In what year did the French Revolution begin?", answer: "1789" },
];

const returnPoints = new Map();
const libraryGamemodes = new Map();
const visitCounters = new Map();
const generatedChunks = new Set();
const pendingChunkGenerations = new Map();
const pendingSpawnPreparations = new Map();
const pendingVoidFall = new Set();
const playerHistory = new Map();
const pendingQuestion = new Map();
const libraryRuleState = new Map();
const activeLibraryReturnAttempts = new Map();
const failedLibraryReturnPlayers = new Set();
const returnAreaLeaseTokens = new Map();
let nextReturnAreaLeaseToken = 0;

function beginLibraryReturnAttempt(playerId) {
  activeLibraryReturnAttempts.set(
    playerId,
    (activeLibraryReturnAttempts.get(playerId) || 0) + 1,
  );
}

function endLibraryReturnAttempt(playerId) {
  const activeCount = activeLibraryReturnAttempts.get(playerId) || 0;
  if (activeCount <= 1) {
    activeLibraryReturnAttempts.delete(playerId);
    return;
  }
  activeLibraryReturnAttempts.set(playerId, activeCount - 1);
}

function acquireReturnAreaLease(areaId) {
  nextReturnAreaLeaseToken += 1;
  returnAreaLeaseTokens.set(areaId, nextReturnAreaLeaseToken);
  return nextReturnAreaLeaseToken;
}

function releaseReturnAreaLease(areaId, leaseToken) {
  if (returnAreaLeaseTokens.get(areaId) !== leaseToken) {
    return false;
  }

  returnAreaLeaseTokens.delete(areaId);
  try {
    world.tickingAreaManager.removeTickingArea(areaId);
  } catch (_error) {
    // Ignore missing ticking areas and cleanup failures.
  }
  return true;
}

const LIBRARY_LIGHT_ITEM_IDS = new Set([
  "minecraft:torch",
  "minecraft:lantern",
  "minecraft:soul_lantern",
  "minecraft:glowstone",
  "minecraft:sea_lantern",
  "minecraft:shroomlight",
  "minecraft:campfire",
  "minecraft:soul_campfire",
  "minecraft:candle",
]);

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function isLibraryDimensionId(dimensionId) {
  return String(dimensionId) === LIBRARY_DIMENSION_ID;
}

function getDimensionSafe(dimensionId) {
  try {
    return world.getDimension(dimensionId);
  } catch (_error) {
    return undefined;
  }
}

function getLibraryPlayers() {
  try {
    const dimension = getDimensionSafe(LIBRARY_DIMENSION_ID);
    if (dimension && typeof dimension.getPlayers === "function") {
      return dimension.getPlayers().filter((player) => player && isLibraryDimensionId(player.dimension.id));
    }
  } catch (_error) {
    // Fall back to the global player scan below.
  }

  try {
    return getCachedPlayers().filter((player) => player && isLibraryDimensionId(player.dimension.id));
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

function enableLibraryBuildAccess(player) {
  if (!player || !isLibraryDimensionId(player.dimension.id)) {
    return;
  }

  if (!libraryGamemodes.has(player.id)) {
    libraryGamemodes.set(player.id, getPlayerGameMode(player));
  }

  system.run(() => {
    try {
      player.setGameMode(GameMode.Survival);
    } catch (_error) {
      // If the override fails, the dimension still works.
    }
  });
}

function restoreLibraryBuildAccess(player) {
  if (!player) {
    return;
  }

  const savedGameMode = libraryGamemodes.get(player.id);
  libraryGamemodes.delete(player.id);

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

function syncLibraryGamemodes() {
  for (const player of getCachedPlayers()) {
    if (!player || !isLibraryDimensionId(player.dimension.id)) {
      continue;
    }
    enableLibraryBuildAccess(player);
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

function pickRandomQuestion() {
  const pools = [RIDDLES, MATH_QUESTIONS, HISTORY_QUESTIONS];
  const pool = pools[randomInt(0, pools.length - 1)];
  return pool[randomInt(0, pool.length - 1)];
}

function getLibraryRuleState(playerId) {
  return getOrCreateRuleState(libraryRuleState, playerId, () => ({
    archiveDebt: 0,
    wrongAnswers: 0,
    noiseTicks: 0,
    lightMisuse: 0,
    lastMistake: "silence",
    cooldowns: new Map(),
  }));
}

function addLibraryDebt(player, amount, reason, subtitle) {
  if (!player || !isLibraryDimensionId(player.dimension.id)) return;
  const ruleState = getLibraryRuleState(player.id);
  ruleState.archiveDebt = Math.max(0, (ruleState.archiveDebt || 0) + amount);
  ruleState.lastMistake = reason;

  if (canTrigger(ruleState, `warn:${reason}`, 20 * 10)) {
    safePlaySound(player.dimension, "ambient.cave", player.location, { volume: 0.55, pitch: reason === "light" ? 0.35 : 0.8 });
    safeTitle(player, "", subtitle, 35);
    requestRuleVhs(player, VHS_TIER.Low, 20 * 5, `library-${reason}`);
  }

  if (ruleState.archiveDebt >= 10) {
    triggerLibraryArchiveConsequence(player, ruleState);
  }
}

function dimNearbyLibraryLight(dim, player, ruleState) {
  if (!canTrigger(ruleState, "dim-light", 20 * 8)) return;
  const px = Math.floor(player.location.x);
  const pz = Math.floor(player.location.z);
  const options = [
    { x: px + 4, y: CEILING_Y, z: pz + 4 },
    { x: px - 4, y: CEILING_Y, z: pz + 4 },
    { x: px + 4, y: CEILING_Y, z: pz - 4 },
    { x: px - 4, y: CEILING_Y, z: pz - 4 },
  ];
  for (const pos of options) {
    const localX = ((pos.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const localZ = ((pos.z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    if ((localX === 4 && localZ === 4)
      || (localX === 11 && localZ === 11)
      || (localX === 10 && localZ === 13)) continue;
    const block = getBlockSafe(dim, pos.x, pos.y, pos.z);
    if (block && block.typeId === "minecraft:glowstone") {
      fillSafe(dim, pos, pos, "minecraft:oak_planks");
      return;
    }
  }
}

function placeLibraryTeachingSigns(dim, spawn, ruleState = undefined) {
  const x = Math.floor(spawn.x);
  const z = Math.floor(spawn.z);
  setStandingSign(dim, { x: x - 2, y: FLOOR_Y + 1, z: z + 2 }, "QUIET\\nQUESTIONS", "minecraft:oak_sign");
  setStandingSign(dim, { x: x + 2, y: FLOOR_Y + 1, z: z + 2 }, "LIGHT\\nLIES", "minecraft:oak_sign");
  if (ruleState && ruleState.lastMistake) {
    setStandingSign(dim, { x, y: FLOOR_Y + 1, z: z + 5 }, `RECORDED\\n${String(ruleState.lastMistake).toUpperCase()}`, "minecraft:oak_sign");
  }
}

function giveRuleNoteToQuestionChest(container) {
  const note = makeNoteItem("Quiet Rule", [
    "The shelves punish noise.",
    "The lamps punish light.",
    "The archive records false answers.",
  ]);
  if (note) {
    try {
      container.setItem(1, note);
    } catch (_error) {}
  }
}

function triggerLibraryArchiveConsequence(player, ruleState) {
  const dim = getDimensionSafe(LIBRARY_DIMENSION_ID);
  if (!dim) return;
  const scareDecision = tryBeginRuleScare(player, ruleState, "archive-consequence", 20 * 45, {
    source: "dimension_scare:library_archive_debt",
    intensity: 4,
    minimumQuietTicks: 20 * 45,
    buildupTicks: 20 * 4,
    peakTicks: 20 * 8,
    reliefTicks: 20 * 20,
    globalCooldownTicks: 20 * 60,
    playerCooldownTicks: 20 * 70,
  });
  if (!scareDecision.allowed) return;
  ruleState.archiveDebt = Math.max(0, ruleState.archiveDebt - 8);
  pendingQuestion.delete(player.id);
  const currentCount = visitCounters.get(player.id) || 1;
  const nextCount = currentCount + 1;
  visitCounters.set(player.id, nextCount);
  const spawn = getNextLibrarySpawn(nextCount);
  safeTitle(player, "The answer is filed.", "The archive opens deeper.", 50);
  safeAddEffect(player, "minecraft:blindness", 50, { amplifier: 0, showParticles: false });
  requestRuleVhs(player, VHS_TIER.High, 20 * 8, "library-archive-debt");
  system.run(() => {
    void (async () => {
      await preGenerateSpawnChunks(dim, spawn);
      await verifiedPlayerTeleport(player, spawn, { dimension: dim, checkForBlocks: false, keepVelocity: false }, { attempts: 8, retryTicks: 4, maxDistance: 64 });
      placeLibraryHistorySigns(dim, spawn);
      placeLibraryTeachingSigns(dim, spawn, ruleState);
      spawnQuestionChest(dim, spawn);
    })().catch(() => {});
  });
}

function tickLibraryRules() {
  const players = getLibraryPlayers();
  if (!players.length) return;
  for (const player of players) {
    const ruleState = getLibraryRuleState(player.id);
    const motion = sampleMotion(ruleState, player.location);
    const noisy = motion.horizontalSpeed >= 0.17 || Math.abs(motion.dy) > 0.35;
    if (noisy) {
      ruleState.noiseTicks = (ruleState.noiseTicks || 0) + motion.dt;
    } else {
      ruleState.noiseTicks = Math.max(0, (ruleState.noiseTicks || 0) - motion.dt * 2);
    }
    if ((ruleState.noiseTicks || 0) >= 35) {
      ruleState.noiseTicks = 10;
      addLibraryDebt(player, 2, "noise", "The shelves heard you.");
    }
  }
}

function fillSafe(dim, from, to, blockId) {
  try {
    dim.fillBlocks(new BlockVolume(from, to), blockId);
  } catch (_error) {
    // Chunk may not be loaded yet; will retry on next interval tick.
  }
}

function getLibraryRoomVariant(cx, cz) {
  return visualHashCoords(cx, cz, 0x4c494252) % 4;
}

function structureFootprintIsFree(cx, cz, minX, maxX, minY, maxY, minZ, maxZ) {
  for (let x = minX; x <= maxX; x += 1) {
    for (let z = minZ; z <= maxZ; z += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        if (isConnectionReservation(cx, cz, x, y, z)
          || isAlcoveCell(cx, cz, x, y, z)
          || isRestrictedApproachCell(cx, cz, x, y, z)
          || (y <= FLOOR_Y + 3 && (x === 7 || x === 8 || z === 7 || z === 8))) {
          return false;
        }
      }
    }
  }
  return true;
}

function scheduleLibraryChunkArt(dim, cx, cz) {
  const seed = visualHashCoords(cx, cz, 0x41524348);
  const ox = cx * CHUNK_SIZE;
  const oz = cz * CHUNK_SIZE;

  if (isRestrictedRoom(cx, cz)) {
    // The archive frame's central lower backplane is masked in its structure.
    scheduleStructurePlacement(`library-archive-frame:${cx}:${cz}`, LIBRARY_ART.frame, dim,
      { x: ox + 8, y: FLOOR_Y + 1, z: oz + 13 });
    return;
  }
  if (isArrivalChunk(cx, cz) || isReadingRoom(cx, cz) || isWestRoom(cx, cz)) return;

  if (seed % 32 === 0) {
    // The monument begins above head height, leaving both cross aisles open.
    scheduleStructurePlacement(
      `library-monument:${cx}:${cz}`,
      LIBRARY_ART.monument,
      dim,
      { x: ox + 4, y: FLOOR_Y + 4, z: oz + 4 },
    );
    return;
  }
  if (seed % 4 !== 0) return;

  const choices = [LIBRARY_ART.balcony, LIBRARY_ART.alcove, LIBRARY_ART.frame];
  const structureId = choices[(seed >>> 5) % choices.length];
  const location = structureId === LIBRARY_ART.balcony
    ? { x: ox + 1, y: FLOOR_Y + 1, z: oz }
    : structureId === LIBRARY_ART.alcove
      ? { x: ox, y: FLOOR_Y + 1, z: oz + 10 }
      : { x: ox, y: FLOOR_Y + 1, z: oz + 1 };
  const bounds = structureId === LIBRARY_ART.balcony
    ? [1, 9, 68, 72, 0, 6]
    : structureId === LIBRARY_ART.alcove
      ? [0, 5, 65, 70, 10, 14]
      : [0, 6, 65, 72, 1, 3];
  if (!structureFootprintIsFree(cx, cz, ...bounds)) return;
  scheduleStructurePlacement(`library-art:${cx}:${cz}`, structureId, dim, location);
}

function ensureLibraryChunkLoaded(dim, cx, cz) {
  for (const x of [cx * CHUNK_SIZE, cx * CHUNK_SIZE + 15]) {
    for (const z of [cz * CHUNK_SIZE, cz * CHUNK_SIZE + 15]) {
      if (!getBlockSafe(dim, x, FLOOR_Y, z) || !getBlockSafe(dim, x, CEILING_Y, z)) return false;
    }
  }
  return true;
}

function requestLibraryChunk(dim, cx, cz) {
  const key = `${cx}:${cz}`;
  if (generatedChunks.has(key)) return Promise.resolve(true);
  if (pendingChunkGenerations.has(key)) return pendingChunkGenerations.get(key);

  let resolveCompletion;
  const completion = new Promise((resolve) => { resolveCompletion = resolve; });
  pendingChunkGenerations.set(key, completion);
  let settled = false;
  const settle = (completed) => {
    if (settled) return;
    settled = true;
    pendingChunkGenerations.delete(key);
    if (completed) generatedChunks.add(key);
    resolveCompletion(completed);
  };

  const scheduled = scheduleVisualJob(`library-chunk:${key}`, function* (context) {
    let completed = false;
    try {
      if (context.isCancelled() || !ensureLibraryChunkLoaded(dim, cx, cz)) return;
      const ox = cx * CHUNK_SIZE;
      const oz = cz * CHUNK_SIZE;
      const variant = getLibraryRoomVariant(cx, cz);

      for (let localX = 0; localX < CHUNK_SIZE; localX += 2) {
        for (let x = localX; x < localX + 2; x += 1) {
          for (let z = 0; z < CHUNK_SIZE; z += 1) {
            if (isProtectedBookshelf(cx, cz, x, z)) continue;
            for (let y = ROOM_HEIGHT_MIN; y <= ROOM_HEIGHT_MAX; y += 1) {
              if (isConnectionReservation(cx, cz, x, y, z)) continue;
              const block = getBlockSafe(dim, ox + x, y, oz + z);
              if (!block) throw new Error("Library generation lost a loaded chunk");
              if (block.typeId === "minecraft:bookshelf" || block.typeId === "minecraft:glowstone") {
                block.setType("minecraft:air");
              }
            }
          }
        }
        yield;
        if (context.isCancelled()) return;
      }

      applyLibrarySurfaces(dim, ox, oz, variant, cx, cz);
      yield;
      if (context.isCancelled()) return;
      if (!ensureLibraryChunkLoaded(dim, cx, cz)) throw new Error("Library chunk unloaded during dressing");
      applyLibraryShelves(dim, ox, oz, variant, cx, cz);
      yield;
      if (context.isCancelled()) return;
      if (!ensureLibraryChunkLoaded(dim, cx, cz)) throw new Error("Library chunk unloaded during dressing");
      applyLibraryFurniture(dim, ox, oz, variant, cx, cz);
      yield;
      if (context.isCancelled()) return;
      if (!ensureLibraryChunkLoaded(dim, cx, cz)) throw new Error("Library chunk unloaded during dressing");
      applyLibraryLights(dim, ox, oz, variant, cx, cz);
      yield;
      if (context.isCancelled()) return;
      if (!ensureLibraryChunkLoaded(dim, cx, cz)) throw new Error("Library chunk unloaded during dressing");
      applyLibrarySigns(dim, ox, oz, variant, cx, cz);
      applyLibraryRestrictedBay(dim, ox, oz, cx, cz);
      if (context.isCancelled()) return;
      scheduleLibraryChunkArt(dim, cx, cz);
      completed = true;
    } catch (error) {
      console.warn(`[Paradise] Library chunk ${key} generation failed`, error);
    } finally {
      settle(completed);
    }
  }, { owner: LIBRARY_DIMENSION_ID, onCancelled: () => settle(false) });
  if (!scheduled) settle(false);
  return completion;
}

function generateLibraryRooms() {
  const dim = getDimensionSafe(LIBRARY_DIMENSION_ID);
  if (!dim) {
    return;
  }

  const players = getLibraryPlayers();
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
        void requestLibraryChunk(dim, cx, cz);
      }
    }
  }
}

function monitorLibraryVoidFalls() {
  const players = getLibraryPlayers();
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

    system.run(() => {
      void (async () => {
        try {
          const spawnIndex = visitCounters.get(player.id) || 1;
          const spawn = getNextLibrarySpawn(spawnIndex);
          const dim = getDimensionSafe(LIBRARY_DIMENSION_ID);
          if (!dim) {
            pendingVoidFall.delete(player.id);
            return;
          }
          await verifiedPlayerTeleport(player, spawn, {
            dimension: dim,
            checkForBlocks: false,
            keepVelocity: false,
          }, { attempts: 8, retryTicks: 4, maxDistance: 64 });
          pendingVoidFall.delete(player.id);
          announce(player, "The Library", "The archive holds you.");
        } catch (_error) {
          pendingVoidFall.delete(player.id);
        }
      })();
    });
  }
}

function getNextLibrarySpawn(visitIndex) {
  return {
    x: visitIndex * VISIT_GRID_SPACING + 0.5,
    y: FLOOR_Y + 1,
    z: 0.5,
  };
}

async function preGenerateSpawnChunks(dim, spawn) {
  const scx = Math.floor(spawn.x / CHUNK_SIZE);
  const scz = Math.floor(spawn.z / CHUNK_SIZE);
  const pregenAreaId = `library:pregen:${scx}:${scz}`;
  if (pendingSpawnPreparations.has(pregenAreaId)) return pendingSpawnPreparations.get(pregenAreaId);
  const preparation = (async () => {
    await world.tickingAreaManager.createTickingArea(pregenAreaId, {
      dimension: dim,
      from: { x: (scx - 1) * CHUNK_SIZE, y: FLOOR_Y, z: (scz - 1) * CHUNK_SIZE },
      to: { x: (scx + 2) * CHUNK_SIZE - 1, y: CEILING_Y, z: (scz + 2) * CHUNK_SIZE - 1 },
    });
    try {
      const requested = [];
      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dz = -1; dz <= 1; dz += 1) {
          requested.push(requestLibraryChunk(dim, scx + dx, scz + dz));
        }
      }
      const results = await Promise.all(requested);
      if (results.some((completed) => !completed)) {
        throw new Error("Library pre-generation was incomplete; retry entry once chunks load");
      }
    } finally {
      world.tickingAreaManager.removeTickingArea(pregenAreaId);
    }
  })();
  pendingSpawnPreparations.set(pregenAreaId, preparation);
  try {
    await preparation;
  } finally {
    if (pendingSpawnPreparations.get(pregenAreaId) === preparation) {
      pendingSpawnPreparations.delete(pregenAreaId);
    }
  }
}

function placeLibraryHistorySigns(dim, spawn) {
  const entries = [...playerHistory.values()].slice(0, 5);
  if (entries.length === 0) {
    return;
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const signX = Math.floor(spawn.x) + (i - 2) * 2;
    const signY = FLOOR_Y + 1;
    const signZ = Math.floor(spawn.z) + 4;

    try {
      const block = dim.getBlock({ x: signX, y: signY, z: signZ });
      if (!block) {
        continue;
      }
      block.setPermutation(BlockPermutation.resolve("minecraft:oak_sign"));
      const sign = block.getComponent("minecraft:sign");
      if (sign) {
        if (typeof sign.setText === "function") {
          sign.setText(`${entry.name}\n${entry.message}\nin ${entry.dimensionId}`);
        }
        if (typeof sign.setWaxed === "function") {
          sign.setWaxed(true);
        }
      }
    } catch (_error) {
      // Ignore sign placement failures.
    }
  }
}

function spawnQuestionChest(dim, spawn) {
  const chestX = Math.floor(spawn.x) + 3;
  const chestY = FLOOR_Y + 1;
  const chestZ = Math.floor(spawn.z);

  try {
    const block = dim.getBlock({ x: chestX, y: chestY, z: chestZ });
    if (!block) {
      return;
    }
    block.setPermutation(BlockPermutation.resolve("minecraft:chest"));
    const inventory = block.getComponent("minecraft:inventory");
    if (!inventory || !inventory.container) {
      return;
    }
    const paper = new ItemStack("minecraft:paper", 1);
    paper.nameTag = "Question?";
    paper.setLore(["Right-click to begin the challenge."]);
    inventory.container.setItem(0, paper);
    giveRuleNoteToQuestionChest(inventory.container);
    placeLibraryTeachingSigns(dim, spawn);
  } catch (_error) {
    // Ignore chest placement failures.
  }
}

function handleItemUse(event) {
  const player = event.source;
  if (!player || player.typeId !== "minecraft:player") {
    return;
  }
  if (!isLibraryDimensionId(player.dimension.id)) {
    return;
  }
  const item = event.itemStack;
  if (item && LIBRARY_LIGHT_ITEM_IDS.has(item.typeId)) {
    system.run(() => {
      const ruleState = getLibraryRuleState(player.id);
      ruleState.lightMisuse = (ruleState.lightMisuse || 0) + 1;
      dimNearbyLibraryLight(player.dimension, player, ruleState);
      addLibraryDebt(player, 4, "light", "The Library closes its eyes.");
    });
    return;
  }

  if (!item || item.typeId !== "minecraft:paper" || item.nameTag !== "Question?") {
    return;
  }

  system.run(() => {
    const question = pickRandomQuestion();
    pendingQuestion.set(player.id, question);
    announce(player, question.question, "Type your answer in chat");
  });
}

function handleChatAnswer(event) {
  const sender = event.sender;
  if (!sender || !isLibraryDimensionId(sender.dimension.id)) {
    return;
  }
  if (!pendingQuestion.has(sender.id)) {
    return;
  }

  event.cancel = true;

  const entry = pendingQuestion.get(sender.id);
  const given = String(event.message || "").trim().toLowerCase();
  const correct = String(entry.answer || "").trim().toLowerCase();

  if (given === correct) {
    pendingQuestion.delete(sender.id);
    system.run(() => {
      void exitLibraryToOverworld(sender).catch((_error) => {
        try {
          sender.sendMessage("Failed to escape. Try again.");
        } catch (_e) {}
      });
    });
  } else {
    system.run(() => {
      const ruleState = getLibraryRuleState(sender.id);
      ruleState.wrongAnswers = (ruleState.wrongAnswers || 0) + 1;
      announce(sender, "Incorrect.", ruleState.wrongAnswers === 1 ? "The archive records false information." : "The archive opens below you.");
      addLibraryDebt(sender, ruleState.wrongAnswers === 1 ? 3 : 5, "false", "The wrong answer was kept.");
    });
  }
}

function handleLibraryChatSend(event) {
  const message = String(event.message || "").trim().toLowerCase();
  if (message === CHAT_ENTER_COMMAND) {
    event.cancel = true;
    system.run(() => {
      const sender = event.sender;
      if (!sender || sender.typeId !== "minecraft:player") return;
      try {
        sender.sendMessage("Entering The Library...");
      } catch (_error) {}
      runLibraryEntryCommand(sender);
    });
    return;
  }

  handleChatAnswer(event);
}

export async function enterLibrary(player) {
  if (isLibraryDimensionId(player.dimension.id)) {
    announce(player, "The Library", "You are already in The Library.");
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

  if (!libraryGamemodes.has(player.id)) {
    libraryGamemodes.set(player.id, getPlayerGameMode(player));
  }

  const currentCount = visitCounters.get(player.id) || 0;
  const nextCount = currentCount + 1;
  visitCounters.set(player.id, nextCount);

  const spawn = getNextLibrarySpawn(nextCount);

  const dim = getDimensionSafe(LIBRARY_DIMENSION_ID);
  if (!dim) {
    try {
      player.sendMessage("The Library dimension is not available.");
    } catch (_error) {}
    return false;
  }

  await preGenerateSpawnChunks(dim, spawn);

  try {
    const entered = await verifiedPlayerTeleport(player, spawn, {
      dimension: dim,
      checkForBlocks: false,
      keepVelocity: false,
    }, { attempts: 8, retryTicks: 4, maxDistance: 64 });
    if (!entered) {
      throw new Error("Library teleport verification failed.");
    }
  } catch (error) {
    try {
      player.sendMessage(`Failed to enter The Library: ${String(error)}`);
    } catch (_error) {}
    return false;
  }

  enableLibraryBuildAccess(player);

  system.run(() => {
    placeLibraryHistorySigns(dim, spawn);
    spawnQuestionChest(dim, spawn);
  });

  announce(player, "The Library", "Quiet questions. No false light.");
  return true;
}

function runLibraryEntryCommand(player) {
  void enterLibrary(player).then((entered) => {
    if (!entered) {
      try {
        player.sendMessage("Library entry failed. Try again in a moment.");
      } catch (_error) {}
    }
  }).catch((error) => {
    try {
      player.sendMessage(`Library entry failed: ${String(error)}`);
    } catch (_error) {}
  });
}

export async function exitLibraryToOverworld(player) {
  beginLibraryReturnAttempt(player.id);
  try {
    const saved = returnPoints.get(player.id);
    const targetDimId = saved ? saved.dimensionId : "minecraft:overworld";
    const targetDimension = getDimensionSafe(targetDimId);
    if (!targetDimension) {
      throw new Error(`The saved return dimension is unavailable: ${targetDimId}.`);
    }

    const fallbackLocation = (saved && saved.location) || world.getDefaultSpawnLocation();
    const safeLocation = findSafeReturnSpot(targetDimension, fallbackLocation);
    const teleportTarget = safeLocation || {
      x: fallbackLocation.x,
      y: fallbackLocation.y,
      z: fallbackLocation.z,
    };

    const returnAreaId = `${RETURN_TICKING_AREA_PREFIX}${player.id}`;
    const leaseToken = acquireReturnAreaLease(returnAreaId);
    try {
      world.tickingAreaManager.removeTickingArea(returnAreaId);
    } catch (_error) {
      // Ignore missing ticking areas.
    }

    try {
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
    } catch (error) {
      releaseReturnAreaLease(returnAreaId, leaseToken);
      throw error;
    }

    if (returnAreaLeaseTokens.get(returnAreaId) !== leaseToken) {
      throw new Error("The Library return ticking-area lease was superseded.");
    }

    try {
      let returned = false;
      if (safeLocation) {
        returned = await verifiedPlayerTeleport(player, teleportTarget, {
          dimension: targetDimension,
          checkForBlocks: false,
          keepVelocity: false,
        }, { attempts: 8, retryTicks: 4, maxDistance: 64 });
      } else {
        returned = await verifiedPlayerTeleport(player, teleportTarget, {
          dimension: targetDimension,
          checkForBlocks: true,
          keepVelocity: false,
        }, { attempts: 8, retryTicks: 4, maxDistance: 64 });
      }
      if (returned !== true) {
        throw new Error("The return teleport could not be verified.");
      }
    } finally {
      const cleanup = () => releaseReturnAreaLease(returnAreaId, leaseToken);
      try {
        system.runTimeout(cleanup, 20);
      } catch (_error) {
        cleanup();
      }
    }

    failedLibraryReturnPlayers.delete(player.id);
    restoreLibraryBuildAccess(player);
    returnPoints.delete(player.id);
    libraryGamemodes.delete(player.id);
    pendingVoidFall.delete(player.id);
    pendingQuestion.delete(player.id);
    clearRuleState(libraryRuleState, player.id);
    announce(player, "You have escaped the Library.", "");
    return true;
  } catch (error) {
    if (returnPoints.has(player.id)) {
      failedLibraryReturnPlayers.add(player.id);
    }
    pendingVoidFall.delete(player.id);
    try {
      player.sendMessage(`Failed to return from The Library: ${String(error)}`);
    } catch (_e) {}
    return false;
  } finally {
    endLibraryReturnAttempt(player.id);
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

function registerLibraryEnterCommand(event, commandId) {
  try {
    event.customCommandRegistry.registerCommand(
      {
        name: commandId,
        description: "Enter The Library dimension",
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
          runLibraryEntryCommand(source);
        });

        return {
          status: CustomCommandStatus.Success,
          message: "Preparing The Library...",
        };
      },
    );
  } catch (_error) {
    // Ignore duplicate command registration during reloads.
  }
}

system.beforeEvents.startup.subscribe((event) => {
  try {
    event.dimensionRegistry.registerCustomDimension(LIBRARY_DIMENSION_ID);
  } catch (_error) {
    // Ignore already-registered reloads.
  }

  registerLibraryEnterCommand(event, LEGACY_ENTER_COMMAND_ID);
  registerLibraryEnterCommand(event, PARADISE_ENTER_COMMAND_ID);
});

world.afterEvents.worldLoad.subscribe(() => {
  system.run(() => {
    syncLibraryGamemodes();
  });
});

world.afterEvents.playerDimensionChange.subscribe((event) => {
  const player = event.player;
  if (!player) {
    return;
  }

  if (isLibraryDimensionId(event.toDimension.id) && !isLibraryDimensionId(event.fromDimension.id)) {
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
      enableLibraryBuildAccess(player);
    });
    return;
  }

  if (isLibraryDimensionId(event.fromDimension.id) && !isLibraryDimensionId(event.toDimension.id)) {
    system.run(() => {
      restoreLibraryBuildAccess(player);
    });

    if (pendingVoidFall.has(player.id)) {
      pendingVoidFall.delete(player.id);
      return;
    }

    if (
      !activeLibraryReturnAttempts.has(player.id)
      && !failedLibraryReturnPlayers.has(player.id)
    ) {
      returnPoints.delete(player.id);
    }
    libraryGamemodes.delete(player.id);
    pendingQuestion.delete(player.id);
    clearRuleState(libraryRuleState, player.id);
  }
});

world.afterEvents.playerLeave.subscribe((event) => {
  returnPoints.delete(event.playerId);
  failedLibraryReturnPlayers.delete(event.playerId);
  libraryGamemodes.delete(event.playerId);
  visitCounters.delete(event.playerId);
  pendingVoidFall.delete(event.playerId);
  pendingQuestion.delete(event.playerId);
  playerHistory.delete(event.playerId);
  clearRuleState(libraryRuleState, event.playerId);
});

world.afterEvents.entitySpawn.subscribe((event) => {
  const entity = event.entity;
  if (!entity || !entity.isValid || !entity.dimension || !isLibraryDimensionId(entity.dimension.id)) {
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

world.afterEvents.entityDie.subscribe((event) => {
  const entity = event.deadEntity;
  if (!entity || entity.typeId !== "minecraft:player") {
    return;
  }
  if (!entity.dimension || !isLibraryDimensionId(entity.dimension.id)) {
    return;
  }
  try {
    playerHistory.set(entity.id, {
      name: entity.nameTag || entity.id,
      message: String(event.damageSource && event.damageSource.cause ? event.damageSource.cause : "unknown cause"),
      dimensionId: entity.dimension ? entity.dimension.id : "unknown",
      timestamp: String(system.currentTick),
    });
  } catch (_error) {
    // Ignore history recording failures.
  }
});

world.afterEvents.itemUse.subscribe(handleItemUse);
world.beforeEvents.chatSend.subscribe(handleLibraryChatSend);

system.runInterval(generateLibraryRooms, ROOM_GEN_INTERVAL_TICKS);
system.runInterval(monitorLibraryVoidFalls, VOID_MONITOR_INTERVAL_TICKS);
system.runInterval(tickLibraryRules, 10);
