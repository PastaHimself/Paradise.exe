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
import { hashCoords as visualHashCoords, scheduleStructurePlacement } from "./paradise_visual_jobs.js";

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
const pendingVoidFall = new Set();
const playerHistory = new Map();
const pendingQuestion = new Map();
const libraryRuleState = new Map();

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

function scheduleLibraryChunkArt(dim, cx, cz) {
  const seed = visualHashCoords(cx, cz, 0x41524348);
  const ox = cx * CHUNK_SIZE;
  const oz = cz * CHUNK_SIZE;

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
  scheduleStructurePlacement(`library-art:${cx}:${cz}`, structureId, dim, location);
}

function generateLibraryChunk(dim, cx, cz) {
  const ox = cx * CHUNK_SIZE;
  const oz = cz * CHUNK_SIZE;
  const variant = getLibraryRoomVariant(cx, cz);

  fillSafe(dim, { x: ox, y: FLOOR_Y, z: oz }, { x: ox + 15, y: FLOOR_Y, z: oz + 15 }, "minecraft:oak_planks");
  fillSafe(dim, { x: ox, y: CEILING_Y, z: oz }, { x: ox + 15, y: CEILING_Y, z: oz + 15 }, variant === 3 ? "minecraft:dark_oak_planks" : "minecraft:oak_planks");

  // Floor and ceiling bands create room-to-room identity without changing the
  // protected x=7..8 / z=7..8 traversal cross.
  if (variant === 1 || variant === 3) {
    fillSafe(dim, { x: ox, y: FLOOR_Y, z: oz }, { x: ox + 15, y: FLOOR_Y, z: oz + 1 }, "minecraft:dark_oak_planks");
    fillSafe(dim, { x: ox, y: CEILING_Y, z: oz + 5 }, { x: ox + 15, y: CEILING_Y, z: oz + 5 }, "minecraft:dark_oak_log");
  } else {
    fillSafe(dim, { x: ox, y: FLOOR_Y, z: oz + 14 }, { x: ox + 15, y: FLOOR_Y, z: oz + 15 }, "minecraft:spruce_planks");
    fillSafe(dim, { x: ox + 5, y: CEILING_Y, z: oz }, { x: ox + 5, y: CEILING_Y, z: oz + 15 }, "minecraft:dark_oak_log");
  }

  const leftShelfX = variant === 2 ? ox + 2 : ox + 3;
  const rightShelfX = variant === 2 ? ox + 13 : ox + 12;
  const leftTop = ROOM_HEIGHT_MIN + (variant === 1 ? 3 : 5);
  const rightTop = ROOM_HEIGHT_MIN + (variant === 3 ? 3 : 5);

  fillSafe(dim, { x: leftShelfX, y: ROOM_HEIGHT_MIN, z: oz }, { x: leftShelfX, y: leftTop, z: oz + 6 }, "minecraft:bookshelf");
  fillSafe(dim, { x: leftShelfX, y: ROOM_HEIGHT_MIN, z: oz + 9 }, { x: leftShelfX, y: leftTop, z: oz + 15 }, "minecraft:bookshelf");
  fillSafe(dim, { x: rightShelfX, y: ROOM_HEIGHT_MIN, z: oz }, { x: rightShelfX, y: rightTop, z: oz + 6 }, "minecraft:bookshelf");
  fillSafe(dim, { x: rightShelfX, y: ROOM_HEIGHT_MIN, z: oz + 9 }, { x: rightShelfX, y: rightTop, z: oz + 15 }, "minecraft:bookshelf");

  for (const x of [leftShelfX, rightShelfX]) {
    fillSafe(dim, { x, y: ROOM_HEIGHT_MIN, z: oz }, { x, y: ROOM_HEIGHT_MAX, z: oz }, "minecraft:dark_oak_log");
    fillSafe(dim, { x, y: ROOM_HEIGHT_MIN, z: oz + 15 }, { x, y: ROOM_HEIGHT_MAX, z: oz + 15 }, "minecraft:dark_oak_log");
  }

  // Two to four embedded ceiling luminaires; no unsupported hanging entities.
  const lights = variant === 0
    ? [[4, 4], [11, 4], [4, 11], [11, 11]]
    : variant === 1
      ? [[4, 4], [11, 11]]
      : [[4, 4], [11, 4], [8, 11]];
  for (const [lx, lz] of lights) {
    fillSafe(dim, { x: ox + lx, y: CEILING_Y, z: oz + lz }, { x: ox + lx, y: CEILING_Y, z: oz + lz }, "minecraft:sea_lantern");
  }

  // Keep the gameplay traversal cross exactly as before.
  fillSafe(dim, { x: ox + 7, y: FLOOR_Y + 1, z: oz }, { x: ox + 8, y: FLOOR_Y + 1, z: oz + 15 }, "minecraft:brown_carpet");
  fillSafe(dim, { x: ox, y: FLOOR_Y + 1, z: oz + 7 }, { x: ox + 15, y: FLOOR_Y + 1, z: oz + 8 }, "minecraft:brown_carpet");

  scheduleLibraryChunkArt(dim, cx, cz);
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
        const key = `${cx}:${cz}`;
        if (generatedChunks.has(key)) {
          continue;
        }

        try {
          generateLibraryChunk(dim, cx, cz);
          generatedChunks.add(key);
        } catch (_error) {
          // Chunk may not be loaded yet; retry next tick.
        }
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
  try {
    await world.tickingAreaManager.createTickingArea(pregenAreaId, {
      dimension: dim,
      from: { x: (scx - 1) * CHUNK_SIZE, y: FLOOR_Y, z: (scz - 1) * CHUNK_SIZE },
      to: { x: (scx + 2) * CHUNK_SIZE - 1, y: CEILING_Y, z: (scz + 2) * CHUNK_SIZE - 1 },
    });
  } catch (_error) {
    // Ticking area may already exist or capacity reached; continue anyway.
  }

  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const cx = scx + dx;
      const cz = scz + dz;
      const key = `${cx}:${cz}`;
      if (generatedChunks.has(key)) {
        continue;
      }

      try {
        generateLibraryChunk(dim, cx, cz);
        generatedChunks.add(key);
      } catch (_error) {
        // Ignore generation failures for pre-load.
      }
    }
  }

  try {
    world.tickingAreaManager.removeTickingArea(pregenAreaId);
  } catch (_error) {
    // Ignore cleanup failures.
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

async function exitLibraryToOverworld(player) {
  try {
    const saved = returnPoints.get(player.id);
    const targetDimId = saved ? saved.dimensionId : "minecraft:overworld";
    const targetDimension = getDimensionSafe(targetDimId) || getDimensionSafe("minecraft:overworld");
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
      system.runTimeout(() => {
        try {
          world.tickingAreaManager.removeTickingArea(returnAreaId);
        } catch (_error) {
          // Ignore cleanup failures.
        }
      }, 20);
    }

    restoreLibraryBuildAccess(player);
    returnPoints.delete(player.id);
    libraryGamemodes.delete(player.id);
    pendingVoidFall.delete(player.id);
    pendingQuestion.delete(player.id);
    clearRuleState(libraryRuleState, player.id);
    announce(player, "You have escaped the Library.", "");
  } catch (error) {
    pendingVoidFall.delete(player.id);
    try {
      player.sendMessage(`Failed to return from The Library: ${String(error)}`);
    } catch (_e) {}
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

    returnPoints.delete(player.id);
    libraryGamemodes.delete(player.id);
    pendingQuestion.delete(player.id);
    clearRuleState(libraryRuleState, player.id);
  }
});

world.afterEvents.playerLeave.subscribe((event) => {
  returnPoints.delete(event.playerId);
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
