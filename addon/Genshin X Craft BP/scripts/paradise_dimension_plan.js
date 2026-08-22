import { system, world } from "@minecraft/server";
import { getCachedPlayers } from "./paradise_tick_cache.js";
import {
  safeActionBar,
  safePlaySound,
  safeTitle,
  setStandingSign,
  verifiedPlayerTeleport,
} from "./dimension_horror_rules.js";
import { enterBurningHighway } from "./burning_highway.js";
import { enterCatacombs, enterCatacombsAtRandomLocation } from "./catacombs.js";
import { enterEndlessStaircase } from "./endless_staircase.js";
import { enterFlatFlower } from "./flat_flower.js";
import { enterHeaven } from "./heaven.js";
import { enterLibrary } from "./library.js";
import { enterYellowHalls } from "./yellow_halls.js";
import { applyHorrorConsequence, resetPlayerHorrorState } from "./paradise_player_horror_state.js";
import { clearPlayerTelemetry, recordPlayerTelemetry } from "./paradise_telemetry.js";
import { canTeleportStalker, recordStalkerTeleport } from "./stalker_teleport_governor.js";

const TICKS_PER_SECOND = 20;
const PLAYER_SCAN_TICKS = 5;
const PAD_SCAN_TICKS = 10;
const LIBRARY_TIMER_TICKS = TICKS_PER_SECOND;
const MISTAKE_ENTRY_COOLDOWN_TICKS = TICKS_PER_SECOND * 55;
const CONNECTION_COOLDOWN_TICKS = TICKS_PER_SECOND * 8;
const DEATH_ROUTE_DELAY_TICKS = 8;

const DIMENSION = Object.freeze({
  yellowHalls: "paradise:yellow_halls",
  flatFlower: "paradise:flat_flower",
  endlessStaircase: "paradise:endless_staircase",
  burningHighway: "paradise:burning_highway",
  catacombs: "catacombs:catacomb_mazes",
  heaven: "heaven:the_heaven",
  library: "library:the_library",
});

/** @type {Set<string>} */
const PARADISE_DIMENSION_IDS = new Set(Object.values(DIMENSION));
const OVERWORLD_ID = "minecraft:overworld";
const STALKER_TYPE_ID = "paradise:watcher";
const STALKER_TAG = "paradise_library_stalker";
const LIBRARY_ESCAPE_TOTAL_TICKS = TICKS_PER_SECOND * 60 * 5;
const LIBRARY_COUNT_DISTANCE = 12;
const LIBRARY_PAUSE_DISTANCE = 8;
const LIBRARY_EXIT_PAD_BLOCK = "minecraft:stone_pressure_plate";
const YELLOW_REAL_EXIT_BLOCK = "minecraft:stone_pressure_plate";

const FLOWER_BLOCK_IDS = new Set([
  "minecraft:dandelion",
  "minecraft:yellow_flower",
  "minecraft:poppy",
  "minecraft:red_flower",
  "minecraft:blue_orchid",
  "minecraft:allium",
  "minecraft:azure_bluet",
  "minecraft:red_tulip",
  "minecraft:orange_tulip",
  "minecraft:white_tulip",
  "minecraft:pink_tulip",
  "minecraft:oxeye_daisy",
  "minecraft:cornflower",
  "minecraft:lily_of_the_valley",
  "minecraft:wither_rose",
  "minecraft:sunflower",
  "minecraft:lilac",
  "minecraft:rose_bush",
  "minecraft:peony",
  "minecraft:pitcher_plant",
  "minecraft:torchflower",
]);

const CATACOMB_ENTRY_BLOCK_IDS = new Set([
  "minecraft:stone",
  "minecraft:cobblestone",
  "minecraft:stone_bricks",
  "minecraft:cracked_stone_bricks",
  "minecraft:mossy_stone_bricks",
  "minecraft:deepslate",
  "minecraft:cobbled_deepslate",
  "minecraft:polished_deepslate",
  "minecraft:cracked_deepslate_bricks",
  "minecraft:cracked_deepslate_tiles",
  "minecraft:tuff",
  "minecraft:dripstone_block",
  "minecraft:andesite",
  "minecraft:diorite",
  "minecraft:granite",
]);

const BOOK_ITEM_IDS = new Set([
  "minecraft:book",
  "minecraft:writable_book",
  "minecraft:written_book",
  "minecraft:enchanted_book",
]);

const BOOKSHELF_BLOCK_IDS = new Set([
  "minecraft:bookshelf",
  "minecraft:chiseled_bookshelf",
  "minecraft:lectern",
]);

const targetEntrances = Object.freeze({
  [DIMENSION.yellowHalls]: { name: "Yellow Halls", enter: enterYellowHalls },
  [DIMENSION.flatFlower]: { name: "Flat Flower", enter: enterFlatFlower },
  [DIMENSION.endlessStaircase]: { name: "Endless Staircase", enter: enterEndlessStaircase },
  [DIMENSION.burningHighway]: { name: "Burning Highway", enter: enterBurningHighway },
  [DIMENSION.catacombs]: { name: "Catacombs", enter: enterCatacombs },
  [DIMENSION.heaven]: { name: "Heaven", enter: enterHeaven },
  [DIMENSION.library]: { name: "Library", enter: enterLibrary },
});

const playerMistakes = new Map();
const entryCooldowns = new Map();
const connectionCooldowns = new Map();
const returnPoints = new Map();
const dimensionAnchors = new Map();
const yellowFakeExitCounts = new Map();
const yellowHiddenExits = new Map();
const deathCounts = new Map();
const pendingDeathRoutes = new Map();
const pendingHeavenDeathEntries = new Map();
const libraryTimers = new Map();
const connectionPadSets = new Map();
const transitionLocks = new Set();

function currentTick() {
  try {
    return system.currentTick || 0;
  } catch (_error) {
    return 0;
  }
}

function playerIdOf(player) {
  return player && (player.id || player.name) ? String(player.id || player.name) : "unknown";
}

function dimensionIdOf(entityOrDimension) {
  try {
    if (!entityOrDimension) return "";
    if (typeof entityOrDimension.id === "string") return entityOrDimension.id;
    if (entityOrDimension.dimension && typeof entityOrDimension.dimension.id === "string") {
      return entityOrDimension.dimension.id;
    }
  } catch (_error) {}
  return "";
}

function isParadiseDimensionId(dimensionId) {
  return PARADISE_DIMENSION_IDS.has(String(dimensionId));
}

function isPlayerInParadise(player) {
  return isParadiseDimensionId(dimensionIdOf(player));
}

function getDimensionSafe(dimensionId) {
  try {
    return world.getDimension(dimensionId || OVERWORLD_ID);
  } catch (_error) {
    return undefined;
  }
}

function toBlockPos(location) {
  return {
    x: Math.floor(location.x),
    y: Math.floor(location.y),
    z: Math.floor(location.z),
  };
}

function copyLocation(location) {
  return {
    x: Number(location.x) || 0,
    y: Number(location.y) || 0,
    z: Number(location.z) || 0,
  };
}

function offset(location, dx = 0, dy = 0, dz = 0) {
  return {
    x: location.x + dx,
    y: location.y + dy,
    z: location.z + dz,
  };
}

function distanceSquared(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

function horizontalDistance(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function getMistakeState(playerId) {
  if (!playerMistakes.has(playerId)) {
    playerMistakes.set(playerId, {
      doorTicks: [],
      lastLocation: undefined,
      lastMoveTick: currentTick(),
      highestRecentY: undefined,
      recentFireHurtTick: -1000000000,
      fireRunTicks: 0,
      endlessFastClimbTicks: 0,
      endlessQuietTicks: 0,
      endlessBrightTicks: 0,
    });
  }
  return playerMistakes.get(playerId);
}

function cooldownKey(player, key) {
  return `${playerIdOf(player)}:${key}`;
}

function isCooldownReady(map, player, key, cooldownTicks) {
  const tick = currentTick();
  const fullKey = cooldownKey(player, key);
  const last = map.get(fullKey) ?? -1000000000;
  return tick - last >= cooldownTicks;
}

function markCooldown(map, player, key) {
  map.set(cooldownKey(player, key), currentTick());
}

function transitionLockKey(player, key) {
  return `${playerIdOf(player)}:${key}`;
}

function rememberReturnPoint(player) {
  if (!player || !player.dimension || !player.location) return;
  const playerId = playerIdOf(player);
  const dimId = dimensionIdOf(player);
  if (!dimId || dimId === OVERWORLD_ID || !isParadiseDimensionId(dimId)) {
    returnPoints.set(playerId, {
      dimensionId: dimId || OVERWORLD_ID,
      location: copyLocation(player.location),
    });
    return;
  }

  if (!returnPoints.has(playerId)) {
    returnPoints.set(playerId, {
      dimensionId: OVERWORLD_ID,
      location: copyLocation(world.getDefaultSpawnLocation()),
    });
  }
}

function setDimensionAnchor(player) {
  if (!player || !player.dimension || !player.location) return;
  const playerId = playerIdOf(player);
  dimensionAnchors.set(playerId, {
    dimensionId: dimensionIdOf(player),
    location: copyLocation(player.location),
    tick: currentTick(),
  });
}

function clearDimensionState(playerId) {
  connectionPadSets.delete(playerId);
  yellowHiddenExits.delete(playerId);
  libraryTimers.delete(playerId);
  for (const lockKey of Array.from(transitionLocks)) {
    if (lockKey.startsWith(`${playerId}:`)) transitionLocks.delete(lockKey);
  }
}

async function enterTargetDimension(player, targetDimensionId, reason = "dimension-rule", options = {}) {
  if (!player || !targetEntrances[targetDimensionId]) return false;
  if (dimensionIdOf(player) === targetDimensionId) return false;
  const cooldownTicks = options.cooldownTicks ?? (options.connection ? CONNECTION_COOLDOWN_TICKS : MISTAKE_ENTRY_COOLDOWN_TICKS);
  const cooldownMap = options.connection ? connectionCooldowns : entryCooldowns;
  if (!options.ignoreCooldown && !isCooldownReady(cooldownMap, player, targetDimensionId, cooldownTicks)) {
    return false;
  }

  const lockKey = transitionLockKey(player, targetDimensionId);
  if (transitionLocks.has(lockKey)) return false;
  transitionLocks.add(lockKey);

  rememberReturnPoint(player);
  const target = targetEntrances[targetDimensionId];
  try {
    safeTitle(player, target.name, reason, 35);
    const entered = await target.enter(player);
    if (entered) {
      if (!options.ignoreCooldown) markCooldown(cooldownMap, player, targetDimensionId);
      setDimensionAnchor(player);
    }
    return entered;
  } catch (error) {
    try {
      player.sendMessage(`${target.name} entry failed: ${String(error)}`);
    } catch (_innerError) {}
    return false;
  } finally {
    transitionLocks.delete(lockKey);
  }
}

async function enterCatacombsWorse(player, reason = "The maze opens below you.") {
  if (!player || dimensionIdOf(player) === DIMENSION.catacombs) return false;
  rememberReturnPoint(player);
  if (!isCooldownReady(connectionCooldowns, player, "catacombs-random", CONNECTION_COOLDOWN_TICKS)) {
    return false;
  }
  const lockKey = transitionLockKey(player, "catacombs-random");
  if (transitionLocks.has(lockKey)) return false;
  transitionLocks.add(lockKey);

  safeTitle(player, "Catacombs", reason, 35);
  try {
    const entered = await enterCatacombsAtRandomLocation(player, { freshMaze: true, transitionTicks: 8 });
    if (entered) {
      markCooldown(connectionCooldowns, player, "catacombs-random");
      setDimensionAnchor(player);
    }
    return entered;
  } catch (_error) {
    const fallbackEntered = await enterTargetDimension(player, DIMENSION.catacombs, reason, { connection: true, ignoreCooldown: true });
    if (fallbackEntered) markCooldown(connectionCooldowns, player, "catacombs-random");
    return fallbackEntered;
  } finally {
    transitionLocks.delete(lockKey);
  }
}

async function teleportToRememberedReturn(player, title = "Returned", subtitle = "You found the wrong way out.") {
  if (!player) return false;
  const saved = returnPoints.get(playerIdOf(player));
  const targetDimension = getDimensionSafe(saved ? saved.dimensionId : OVERWORLD_ID) || getDimensionSafe(OVERWORLD_ID);
  if (!targetDimension) return false;
  const targetLocation = saved && saved.location ? saved.location : world.getDefaultSpawnLocation();
  const moved = await verifiedPlayerTeleport(player, targetLocation, {
    dimension: targetDimension,
    checkForBlocks: false,
    keepVelocity: false,
  }, { attempts: 8, retryTicks: 4, maxDistance: 80 });
  if (moved) {
    safeTitle(player, title, subtitle, 35);
    clearDimensionState(playerIdOf(player));
  }
  return moved;
}

function getHeldItemTypeId(player, event = undefined) {
  try {
    if (event && event.itemStack && event.itemStack.typeId) return String(event.itemStack.typeId);
  } catch (_error) {}
  try {
    const equippable = player.getComponent("minecraft:equippable") || player.getComponent("equippable");
    const item = equippable && typeof equippable.getEquipment === "function" ? equippable.getEquipment("Mainhand") : undefined;
    if (item && item.typeId) return String(item.typeId);
  } catch (_error) {}
  try {
    const inventory = player.getComponent("minecraft:inventory") || player.getComponent("inventory");
    const selectedSlot = typeof player.selectedSlotIndex === "number" ? player.selectedSlotIndex : 0;
    const item = inventory && inventory.container ? inventory.container.getItem(selectedSlot) : undefined;
    if (item && item.typeId) return String(item.typeId);
  } catch (_error) {}
  return "";
}

function hasBookshelfNear(player, radius = 4) {
  if (!player || !player.dimension || !player.location) return false;
  const base = toBlockPos(player.location);
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -1; dy <= 2; dy++) {
      for (let dz = -radius; dz <= radius; dz++) {
        if (dx * dx + dz * dz > radius * radius) continue;
        try {
          const block = player.dimension.getBlock({ x: base.x + dx, y: base.y + dy, z: base.z + dz });
          if (block && BOOKSHELF_BLOCK_IDS.has(block.typeId)) return true;
        } catch (_error) {}
      }
    }
  }
  return false;
}

function setBlockSafe(dimension, location, typeId) {
  try {
    dimension.setBlockType(toBlockPos(location), typeId);
    return true;
  } catch (_error) {
    return false;
  }
}

function paintSmallPad(dimension, center, paletteBlock, label) {
  const blockCenter = toBlockPos(center);
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      setBlockSafe(dimension, { x: blockCenter.x + dx, y: blockCenter.y - 1, z: blockCenter.z + dz }, paletteBlock);
      setBlockSafe(dimension, { x: blockCenter.x + dx, y: blockCenter.y, z: blockCenter.z + dz }, "minecraft:air");
    }
  }
  setBlockSafe(dimension, { x: blockCenter.x, y: blockCenter.y, z: blockCenter.z }, "minecraft:stone_pressure_plate");
  setBlockSafe(dimension, { x: blockCenter.x, y: blockCenter.y - 1, z: blockCenter.z + 2 }, paletteBlock);
  setBlockSafe(dimension, { x: blockCenter.x, y: blockCenter.y, z: blockCenter.z + 2 }, "minecraft:air");
  setStandingSign(dimension, { x: blockCenter.x, y: blockCenter.y, z: blockCenter.z + 2 }, label, "minecraft:oak_sign");
}

function blockTypeAt(dimension, location) {
  try {
    const block = dimension.getBlock(toBlockPos(location));
    return block && block.typeId ? String(block.typeId) : "";
  } catch (_error) {
    return "";
  }
}

function connectionPadSignature(dimensionId, anchor, definitions) {
  const base = toBlockPos(anchor.location || anchor);
  const keys = definitions.map((definition) => definition.key).join("|");
  return `${dimensionId}:${base.x}:${base.y}:${base.z}:${keys}`;
}

function shouldPaintConnectionPads(player, signature, pads) {
  const existing = connectionPadSets.get(playerIdOf(player));
  if (!existing || existing.signature !== signature) return true;
  for (const pad of pads) {
    if (blockTypeAt(player.dimension, pad.location) !== "minecraft:stone_pressure_plate") {
      return true;
    }
  }
  return false;
}

function getPadDefinitionsForDimension(dimensionId) {
  switch (dimensionId) {
    case DIMENSION.yellowHalls:
      return [
        { key: "yellow-stairwell", dx: 10, dz: 0, block: "minecraft:stone_bricks", label: "STAIRWELL", target: DIMENSION.endlessStaircase, reason: "The stairwell door was not a door." },
        { key: "yellow-archive", dx: -10, dz: 0, block: "minecraft:bookshelf", label: "ARCHIVE", target: DIMENSION.library, reason: "The office archive opens." },
        { key: "yellow-buried", dx: 0, dz: -10, block: "minecraft:cracked_stone_bricks", label: "DOWN", target: DIMENSION.catacombs, reason: "The wall gives way to something buried.", catacombsRandom: true },
      ];
    case DIMENSION.flatFlower:
      return [
        { key: "flower-perfect", dx: 10, dz: 0, block: "minecraft:white_concrete", label: "PERFECT\nPATH", target: DIMENSION.heaven, reason: "The perfect flowers accept you." },
        { key: "flower-fake", dx: -10, dz: 0, block: "minecraft:yellow_concrete", label: "TOO\nMANY", target: DIMENSION.yellowHalls, reason: "The fake flowers become doors." },
        { key: "flower-fire", dx: 0, dz: 10, block: "minecraft:magma", label: "BURNED\nFIELD", target: DIMENSION.burningHighway, reason: "The field catches fire." },
      ];
    case DIMENSION.burningHighway:
      return [
        { key: "highway-emergency", dx: 8, dz: 8, block: "minecraft:yellow_concrete", label: "EMERGENCY\nEXIT", target: DIMENSION.yellowHalls, reason: "The emergency exit opens into yellow halls." },
        { key: "highway-field", dx: -8, dz: 8, block: "minecraft:grass_block", label: "BURNED\nFIELD", target: DIMENSION.flatFlower, reason: "The ash turns into flowers." },
      ];
    case DIMENSION.catacombs:
      return [
        { key: "catacombs-archive", dx: 8, dz: 0, block: "minecraft:bookshelf", label: "FORBIDDEN\nARCHIVE", target: DIMENSION.library, reason: "The archive room swallows the tomb." },
        { key: "catacombs-maintenance", dx: -8, dz: 0, block: "minecraft:yellow_concrete", label: "MAINTENANCE", target: DIMENSION.yellowHalls, reason: "The maintenance tunnel loops sideways." },
        { key: "catacombs-white", dx: 0, dz: 8, block: "minecraft:white_concrete", label: "ANGEL\nTOMB", target: DIMENSION.heaven, reason: "The white tomb pretends to be mercy." },
      ];
    case DIMENSION.heaven:
      return [
        { key: "heaven-garden", dx: 8, dz: 0, block: "minecraft:grass_block", label: "PERFECT\nGARDEN", target: DIMENSION.flatFlower, reason: "The garden is too perfect." },
        { key: "heaven-hall", dx: -8, dz: 0, block: "minecraft:yellow_concrete", label: "WHITE\nHALL", target: DIMENSION.yellowHalls, reason: "The white hall yellows at the edges." },
        { key: "heaven-stairs", dx: 0, dz: 8, block: "minecraft:stone_bricks", label: "BRIGHT\nSTAIRS", target: DIMENSION.endlessStaircase, reason: "The bright staircase keeps climbing." },
        { key: "heaven-road", dx: 0, dz: -8, block: "minecraft:magma", label: "FALLING\nSTAR", target: DIMENSION.burningHighway, reason: "The star lands as a burning road." },
        { key: "heaven-tomb", dx: 12, dz: 8, block: "minecraft:cracked_stone_bricks", label: "ANGEL\nTOMB", target: DIMENSION.catacombs, reason: "The angel tomb opens downward.", catacombsRandom: true },
        { key: "heaven-reading", dx: -12, dz: 8, block: "minecraft:bookshelf", label: "READING\nROOM", target: DIMENSION.library, reason: "The white reading room becomes quiet." },
      ];
    case DIMENSION.library:
      return [
        { key: "library-basement", dx: 8, dz: 0, block: "minecraft:cracked_stone_bricks", label: "BASEMENT", target: DIMENSION.catacombs, reason: "The forbidden basement descends.", catacombsRandom: true },
        { key: "library-stairwell", dx: -8, dz: 0, block: "minecraft:stone_bricks", label: "SILENT\nSTAIRS", target: DIMENSION.endlessStaircase, reason: "The silent stairwell keeps going." },
        { key: "library-white", dx: 0, dz: 8, block: "minecraft:white_concrete", label: "WHITE\nROOM", target: DIMENSION.heaven, reason: "The reading room turns white." },
        { key: "library-office", dx: 0, dz: -8, block: "minecraft:yellow_concrete", label: "OFFICE", target: DIMENSION.yellowHalls, reason: "The office door opens the wrong way." },
      ];
    default:
      return [];
  }
}

function refreshConnectionPadsForPlayer(player) {
  if (!player || !player.dimension || !player.location) return;
  const dimensionId = dimensionIdOf(player);
  if (!isParadiseDimensionId(dimensionId) || dimensionId === DIMENSION.endlessStaircase) return;

  const playerId = playerIdOf(player);
  let anchor = dimensionAnchors.get(playerId);
  if (!anchor || anchor.dimensionId !== dimensionId || horizontalDistance(anchor.location, player.location) > 96) {
    setDimensionAnchor(player);
    anchor = dimensionAnchors.get(playerId);
  }
  if (!anchor) return;

  const definitions = getPadDefinitionsForDimension(dimensionId);
  const pads = [];
  for (const definition of definitions) {
    const center = offset(anchor.location, definition.dx, 0, definition.dz);
    pads.push({ ...definition, location: center, dimensionId });
  }

  const signature = connectionPadSignature(dimensionId, anchor, definitions);
  if (shouldPaintConnectionPads(player, signature, pads)) {
    for (const pad of pads) {
      paintSmallPad(player.dimension, pad.location, pad.block, pad.label);
    }
  }
  connectionPadSets.set(playerId, { signature, pads });
}

function checkConnectionPadsForPlayer(player) {
  if (!player || !player.dimension || !player.location) return;
  const playerId = playerIdOf(player);
  const storedPads = connectionPadSets.get(playerId);
  const pads = Array.isArray(storedPads) ? storedPads : storedPads && storedPads.pads;
  if (!pads || !pads.length) return;
  for (const pad of pads) {
    if (pad.dimensionId !== dimensionIdOf(player)) continue;
    if (distanceSquared(player.location, pad.location) > 2.6 * 2.6) continue;
    system.run(() => {
      if (pad.catacombsRandom) {
        void enterCatacombsWorse(player, pad.reason);
      } else {
        void enterTargetDimension(player, pad.target, pad.reason, { connection: true });
      }
    });
    return;
  }
}

function getBehindPlayerLocation(player, distance = 3) {
  try {
    const dir = typeof player.getViewDirection === "function" ? player.getViewDirection() : undefined;
    if (dir && Number.isFinite(dir.x) && Number.isFinite(dir.z)) {
      return {
        x: Math.floor(player.location.x - dir.x * distance) + 0.5,
        y: Math.floor(player.location.y),
        z: Math.floor(player.location.z - dir.z * distance) + 0.5,
      };
    }
  } catch (_error) {}
  return {
    x: Math.floor(player.location.x - distance) + 0.5,
    y: Math.floor(player.location.y),
    z: Math.floor(player.location.z) + 0.5,
  };
}


function vectorLength(value) {
  return Math.sqrt((value.x || 0) * (value.x || 0) + (value.y || 0) * (value.y || 0) + (value.z || 0) * (value.z || 0));
}

function normalizeVector(value) {
  const length = vectorLength(value);
  if (!Number.isFinite(length) || length <= 0.0001) {
    return { x: 0, y: 0, z: 0 };
  }
  return { x: (value.x || 0) / length, y: (value.y || 0) / length, z: (value.z || 0) / length };
}

function dotVector(a, b) {
  return (a.x || 0) * (b.x || 0) + (a.y || 0) * (b.y || 0) + (a.z || 0) * (b.z || 0);
}

function getPlayerEyeLocation(player) {
  try {
    if (player && typeof player.getHeadLocation === "function") {
      return player.getHeadLocation();
    }
  } catch (_error) {}
  return { x: player.location.x, y: player.location.y + 1.62, z: player.location.z };
}

function isPlayerLookingNearLocation(player, location, threshold = 0.35) {
  try {
    if (!player || !location || !player.location || typeof player.getViewDirection !== "function") {
      return false;
    }
    const eye = getPlayerEyeLocation(player);
    const view = normalizeVector(player.getViewDirection());
    const toTarget = normalizeVector({ x: location.x - eye.x, y: location.y - eye.y, z: location.z - eye.z });
    return dotVector(view, toTarget) >= threshold;
  } catch (_error) {
    return false;
  }
}

function getLibraryEncounterKey(player, timerOrRemainingTicks) {
  const remainingTicks = typeof timerOrRemainingTicks === "number" ? timerOrRemainingTicks : Number(timerOrRemainingTicks?.remainingTicks || 0);
  const resetCount = typeof timerOrRemainingTicks === "number" ? 0 : Number(timerOrRemainingTicks?.resetCount || 0);
  const seconds = Math.ceil(Math.max(0, remainingTicks) / TICKS_PER_SECOND);
  const phase = seconds <= 60 ? "final" : seconds <= 180 ? "closing" : "opening";
  return `${playerIdOf(player)}:library:${phase}:reset${resetCount}`;
}

function activateYellowHiddenExit(player) {
  if (!player || dimensionIdOf(player) !== DIMENSION.yellowHalls) return;
  const playerId = playerIdOf(player);
  const exitLocation = getBehindPlayerLocation(player, 4);
  yellowHiddenExits.set(playerId, exitLocation);
  setBlockSafe(player.dimension, { x: exitLocation.x, y: exitLocation.y - 1, z: exitLocation.z }, "minecraft:birch_planks");
  setBlockSafe(player.dimension, exitLocation, YELLOW_REAL_EXIT_BLOCK);
  const signLocation = offset(exitLocation, 0, 0, -2);
  setBlockSafe(player.dimension, { x: signLocation.x, y: signLocation.y - 1, z: signLocation.z }, "minecraft:birch_planks");
  setBlockSafe(player.dimension, signLocation, "minecraft:air");
  setStandingSign(player.dimension, signLocation, "REAL\nEXIT\nBEHIND", "minecraft:birch_sign");
  safeTitle(player, "Behind you.", "The real exit was never in front.", 45);
}

function scheduleYellowHiddenExit(player) {
  const playerId = playerIdOf(player);
  system.runTimeout(() => {
    if (!player || dimensionIdOf(player) !== DIMENSION.yellowHalls) return;
    if (yellowHiddenExits.has(playerId)) return;
    activateYellowHiddenExit(player);
  }, 12);
}

function checkYellowHiddenExit(player) {
  if (!player || dimensionIdOf(player) !== DIMENSION.yellowHalls) return;
  const exitLocation = yellowHiddenExits.get(playerIdOf(player));
  if (!exitLocation || distanceSquared(player.location, exitLocation) > 2.6 * 2.6) return;
  system.run(() => {
    void teleportToRememberedReturn(player, "Yellow Halls", "The hidden exit lets you out.");
  });
}

function isExitSignBlock(block) {
  if (!block || !String(block.typeId).includes("sign")) return false;
  try {
    const sign = block.getComponent("minecraft:sign");
    const text = sign && typeof sign.getText === "function" ? String(sign.getText()).trim().toUpperCase() : "";
    return text.includes("EXIT");
  } catch (_error) {
    return false;
  }
}

function handleDoorMistake(player) {
  if (!player || isPlayerInParadise(player)) return;
  const playerId = playerIdOf(player);
  const state = getMistakeState(playerId);
  const tick = currentTick();
  state.doorTicks = (state.doorTicks || []).filter((doorTick) => tick - doorTick <= TICKS_PER_SECOND * 20);
  state.doorTicks.push(tick);
  if (state.doorTicks.length >= 3) {
    state.doorTicks = [];
    system.run(() => {
      void enterTargetDimension(player, DIMENSION.yellowHalls, "Too many doors looked like safety.");
    });
  }
}

function handleFlowerBreakMistake(player, blockTypeId, location, dimensionId) {
  if (!player || dimensionId !== OVERWORLD_ID || !FLOWER_BLOCK_IDS.has(blockTypeId)) return;
  if (Math.random() > 0.08) return;
  system.run(() => {
    void enterTargetDimension(player, DIMENSION.flatFlower, "You picked the wrong flower.");
  });
}

function handleCatacombMiningMistake(player, blockTypeId, location, dimensionId) {
  if (!player || isParadiseDimensionId(dimensionId)) return;
  if (!location || Number(location.y) >= 20) return;
  if (!CATACOMB_ENTRY_BLOCK_IDS.has(blockTypeId)) return;
  if (Math.random() > 0.10) return;
  system.run(() => {
    void enterCatacombsWorse(player, "You disturbed something buried.");
  });
}

function handleLibraryReadingMistake(player, reason) {
  if (!player || isPlayerInParadise(player)) return;
  system.run(() => {
    void enterTargetDimension(player, DIMENSION.library, reason || "You read something that was not meant for you.");
  });
}

function updateMovementMistakes() {
  const tick = currentTick();
  for (const player of getCachedPlayers()) {
    if (!player || !player.location || !player.dimension) continue;
    const playerId = playerIdOf(player);
    const state = getMistakeState(playerId);
    const location = copyLocation(player.location);
    const last = state.lastLocation;
    const dt = Math.max(1, tick - (state.lastMoveTick || tick));
    const dy = last ? location.y - last.y : 0;
    const horizontal = last ? horizontalDistance(location, last) : 0;
    const horizontalSpeed = horizontal / dt;

    state.lastLocation = location;
    state.lastMoveTick = tick;

    if (!isPlayerInParadise(player)) {
      if (state.highestRecentY === undefined || location.y > state.highestRecentY || dy > -0.05) {
        state.highestRecentY = location.y;
      }
      const dropDistance = (state.highestRecentY || location.y) - location.y;
      if (dropDistance >= 12 && dy < -0.6) {
        state.highestRecentY = location.y;
        system.run(() => {
          void enterTargetDimension(player, DIMENSION.endlessStaircase, "The fall became a staircase.");
        });
      }

      if (tick - (state.recentFireHurtTick || -1000000000) <= TICKS_PER_SECOND * 5 && horizontalSpeed >= 0.16) {
        state.fireRunTicks = (state.fireRunTicks || 0) + dt;
      } else {
        state.fireRunTicks = Math.max(0, (state.fireRunTicks || 0) - dt * 2);
      }
      if ((state.fireRunTicks || 0) >= 12) {
        state.fireRunTicks = 0;
        system.run(() => {
          void enterTargetDimension(player, DIMENSION.burningHighway, "You caught fire and ran.");
        });
      }
    }

    if (dimensionIdOf(player) === DIMENSION.endlessStaircase) {
      updateEndlessConnectionRules(player, state, horizontalSpeed, dt);
    }

    if (dimensionIdOf(player) === DIMENSION.burningHighway && location.y < 56) {
      system.run(() => {
        void enterCatacombsWorse(player, "The broken road drops into the Catacombs.");
      });
    }
  }
}

function updateEndlessConnectionRules(player, state, horizontalSpeed, dt) {
  const z = Math.floor(player.location.z);
  if (z < 20) {
    state.endlessFastClimbTicks = 0;
    state.endlessQuietTicks = 0;
    state.endlessBrightTicks = 0;
    return;
  }

  if (z >= 42 && horizontalSpeed >= 0.19) {
    state.endlessFastClimbTicks = (state.endlessFastClimbTicks || 0) + dt;
  } else {
    state.endlessFastClimbTicks = Math.max(0, (state.endlessFastClimbTicks || 0) - dt * 2);
  }

  if (z >= 28 && horizontalSpeed <= 0.035) {
    state.endlessQuietTicks = (state.endlessQuietTicks || 0) + dt;
  } else {
    state.endlessQuietTicks = Math.max(0, (state.endlessQuietTicks || 0) - dt * 2);
  }

  if (z >= 62 && horizontalSpeed <= 0.08) {
    state.endlessBrightTicks = (state.endlessBrightTicks || 0) + dt;
  } else {
    state.endlessBrightTicks = Math.max(0, (state.endlessBrightTicks || 0) - dt * 2);
  }

  if ((state.endlessFastClimbTicks || 0) >= TICKS_PER_SECOND * 4) {
    state.endlessFastClimbTicks = 0;
    system.run(() => {
      void enterTargetDimension(player, DIMENSION.burningHighway, "You climbed too fast for too long.", { connection: true });
    });
    return;
  }

  if ((state.endlessQuietTicks || 0) >= TICKS_PER_SECOND * 5) {
    state.endlessQuietTicks = 0;
    system.run(() => {
      void enterTargetDimension(player, DIMENSION.library, "The quiet stairwell becomes shelves.", { connection: true });
    });
    return;
  }

  if ((state.endlessBrightTicks || 0) >= TICKS_PER_SECOND * 4) {
    state.endlessBrightTicks = 0;
    system.run(() => {
      void enterTargetDimension(player, DIMENSION.heaven, "The upper landing is too bright.", { connection: true });
    });
  }
}

function deathCountKey(playerId, dimensionId) {
  return `${playerId}:${dimensionId}`;
}

function incrementDeathCount(playerId, dimensionId) {
  const key = deathCountKey(playerId, dimensionId);
  const count = (deathCounts.get(key) || 0) + 1;
  deathCounts.set(key, count);
  return count;
}

function causeText(event) {
  try {
    return String(event.damageSource && event.damageSource.cause ? event.damageSource.cause : "").toLowerCase();
  } catch (_error) {
    return "";
  }
}

function isHeavenEntryDeathCause(cause) {
  return cause.includes("fall") || cause.includes("void") || cause.includes("drown");
}

function handlePlayerDeath(event) {
  const entity = event.deadEntity;
  if (!entity || entity.typeId !== "minecraft:player") return;
  const playerId = playerIdOf(entity);
  const dimensionId = dimensionIdOf(entity);
  const cause = causeText(event);

  if (isParadiseDimensionId(dimensionId)) {
    const count = incrementDeathCount(playerId, dimensionId);
    pendingDeathRoutes.set(playerId, { dimensionId, cause, count, tick: currentTick() });
    return;
  }

  if (isHeavenEntryDeathCause(cause)) {
    pendingHeavenDeathEntries.set(playerId, { cause, tick: currentTick() });
  }
}

function routeDeathMemory(player) {
  if (!player) return;
  const playerId = playerIdOf(player);
  const route = pendingDeathRoutes.get(playerId);
  const heavenEntry = pendingHeavenDeathEntries.get(playerId);
  pendingDeathRoutes.delete(playerId);
  pendingHeavenDeathEntries.delete(playerId);

  if (heavenEntry && !isPlayerInParadise(player)) {
    system.runTimeout(() => {
      void enterTargetDimension(player, DIMENSION.heaven, "Death accepted you into the wrong place.", { ignoreCooldown: true });
    }, DEATH_ROUTE_DELAY_TICKS);
    return;
  }

  if (!route) return;

  system.runTimeout(() => {
    switch (route.dimensionId) {
      case DIMENSION.yellowHalls:
        if (route.count === 1) {
          safeTitle(player, "Yellow Halls", "Death puts you deeper in the halls.", 45);
          void enterTargetDimension(player, DIMENSION.yellowHalls, "Death puts you deeper in the halls.", { ignoreCooldown: true });
        } else if (route.count === 2) {
          safeTitle(player, "Yellow Halls", "More EXIT signs appear.", 45);
          yellowFakeExitCounts.set(playerId, Math.max(2, yellowFakeExitCounts.get(playerId) || 0));
          void enterTargetDimension(player, DIMENSION.yellowHalls, "The fake exits multiplied.", { ignoreCooldown: true });
        } else {
          const target = Math.random() < 0.5 ? DIMENSION.catacombs : DIMENSION.endlessStaircase;
          if (target === DIMENSION.catacombs) {
            void enterCatacombsWorse(player, "The halls break downward.");
          } else {
            void enterTargetDimension(player, target, "A stairwell replaces the hall.", { connection: true, ignoreCooldown: true });
          }
        }
        break;
      case DIMENSION.flatFlower:
        if (route.count < 3) {
          safeTitle(player, "Flat Flower", route.count === 1 ? "The real flower moved." : "The field spreads wider.", 45);
          void enterTargetDimension(player, DIMENSION.flatFlower, route.count === 1 ? "The real flower moved." : "The field spreads wider.", { ignoreCooldown: true });
        } else {
          const target = Math.random() < 0.5 ? DIMENSION.heaven : DIMENSION.yellowHalls;
          void enterTargetDimension(player, target, target === DIMENSION.heaven ? "The perfect field becomes Heaven." : "The fake flowers become doors.", { connection: true, ignoreCooldown: true });
        }
        break;
      case DIMENSION.endlessStaircase:
        if (route.count >= 3) {
          const target = Math.random() < 0.5 ? DIMENSION.burningHighway : DIMENSION.library;
          void enterTargetDimension(player, target, target === DIMENSION.burningHighway ? "The climb turns into a road." : "The stairs become shelves.", { connection: true, ignoreCooldown: true });
        }
        break;
      case DIMENSION.burningHighway:
        if (route.count >= 3) {
          const target = Math.random() < 0.5 ? DIMENSION.catacombs : DIMENSION.yellowHalls;
          if (target === DIMENSION.catacombs) {
            void enterCatacombsWorse(player, "The highway collapses into tombs.");
          } else {
            void enterTargetDimension(player, DIMENSION.yellowHalls, "The emergency exit was fake.", { connection: true, ignoreCooldown: true });
          }
        }
        break;
      case DIMENSION.catacombs:
        if (route.count >= 3) {
          const target = Math.random() < 0.5 ? DIMENSION.library : DIMENSION.heaven;
          void enterTargetDimension(player, target, target === DIMENSION.library ? "The forbidden archive opens." : "The white tomb accepts you.", { connection: true, ignoreCooldown: true });
        }
        break;
      case DIMENSION.heaven: {
        const targets = [DIMENSION.flatFlower, DIMENSION.yellowHalls, DIMENSION.endlessStaircase, DIMENSION.burningHighway, DIMENSION.catacombs, DIMENSION.library];
        const target = targets[Math.floor(Math.random() * targets.length)];
        if (target === DIMENSION.catacombs) {
          void enterCatacombsWorse(player, "Heaven drops you into a tomb.");
        } else {
          void enterTargetDimension(player, target, "Heaven sends you somewhere worse.", { connection: true, ignoreCooldown: true });
        }
        break;
      }
      case DIMENSION.library:
        if (route.count < 3) {
          safeTitle(player, "The Library", route.count === 1 ? "The timer starts over." : "The Stalker starts closer.", 45);
          void enterTargetDimension(player, DIMENSION.library, route.count === 1 ? "The timer starts over." : "The Stalker starts closer.", { ignoreCooldown: true });
        } else {
          const target = Math.random() < 0.5 ? DIMENSION.catacombs : DIMENSION.yellowHalls;
          if (target === DIMENSION.catacombs) {
            void enterCatacombsWorse(player, "The archive basement opens.");
          } else {
            void enterTargetDimension(player, DIMENSION.yellowHalls, "The office door opens wrong.", { connection: true, ignoreCooldown: true });
          }
        }
        break;
      default:
        break;
    }
  }, DEATH_ROUTE_DELAY_TICKS);
}

function spawnLibraryStalker(player, timerState) {
  if (!player || !player.dimension || dimensionIdOf(player) !== DIMENSION.library) return undefined;
  try {
    if (timerState.stalker && isEntityValid(timerState.stalker)) return timerState.stalker;
  } catch (_error) {}

  const tick = currentTick();
  if (timerState.lastSpawnAttemptTick && tick - timerState.lastSpawnAttemptTick < TICKS_PER_SECOND * 3) {
    return undefined;
  }
  timerState.lastSpawnAttemptTick = tick;

  const spawnLocation = offset(player.location, 14, 0, 14);
  let stalker = undefined;
  try {
    stalker = player.dimension.spawnEntity(STALKER_TYPE_ID, spawnLocation);
    try { stalker.addTag(STALKER_TAG); } catch (_error) {}
  } catch (_error) {}
  timerState.stalker = stalker && isEntityValid(stalker) ? stalker : undefined;
  return timerState.stalker;
}

function isEntityValid(entity) {
  try {
    if (!entity) return false;
    if (typeof entity.isValid === "function") return entity.isValid();
    return entity.isValid !== false;
  } catch (_error) {
    return false;
  }
}

function teleportStalkerNearPlayer(player, stalker, timerOrRemainingTicks, reason = "library-reposition") {
  if (!player || !stalker || !isEntityValid(stalker)) return false;
  const tick = currentTick();
  const remainingTicks = typeof timerOrRemainingTicks === "number" ? timerOrRemainingTicks : Number(timerOrRemainingTicks?.remainingTicks || 0);
  const close = remainingTicks <= TICKS_PER_SECOND * 120;
  const distance = close ? 11 : 18;
  const angle = Math.random() * Math.PI * 2;
  const target = {
    x: Math.floor(player.location.x + Math.cos(angle) * distance) + 0.5,
    y: Math.floor(player.location.y),
    z: Math.floor(player.location.z + Math.sin(angle) * distance) + 0.5,
  };
  const visible = isPlayerLookingNearLocation(player, stalker.location, 0.35) || isPlayerLookingNearLocation(player, target, 0.35);
  const decision = canTeleportStalker({
    entity: stalker,
    player,
    phase: "library_hunt",
    reason,
    currentTick: tick,
    fromLocation: stalker.location,
    toLocation: target,
    location: target,
    visible,
    maxPerEncounter: reason === "library-too-close-reset" ? 1 : 2,
    minTicks: reason === "library-too-close-reset" ? TICKS_PER_SECOND * 6 : close ? TICKS_PER_SECOND * 14 : TICKS_PER_SECOND * 20,
    visibleMinTicks: reason === "library-too-close-reset" ? TICKS_PER_SECOND * 10 : close ? TICKS_PER_SECOND * 22 : TICKS_PER_SECOND * 30,
    encounterKey: getLibraryEncounterKey(player, timerOrRemainingTicks),
  });

  if (!decision.allowed) {
    recordStalkerTeleport({
      entity: stalker,
      player,
      phase: "library_hunt",
      reason,
      currentTick: tick,
      allowed: false,
      visible,
      denialReason: decision.reason,
    });
    recordPlayerTelemetry(player, "library_stalker", {
      currentTick: tick,
      source: "paradise_dimension_plan",
      reason,
      status: "teleport_blocked",
      denialReason: decision.reason,
      remainingTicks,
    });
    return false;
  }

  try {
    stalker.teleport(target, { dimension: player.dimension, checkForBlocks: false, keepVelocity: false });
    recordStalkerTeleport({
      entity: stalker,
      player,
      phase: "library_hunt",
      reason,
      currentTick: tick,
      allowed: true,
      visible,
    });
    recordPlayerTelemetry(player, "library_stalker", {
      currentTick: tick,
      source: "paradise_dimension_plan",
      reason,
      status: "teleport_allowed",
      remainingTicks,
    });
    return true;
  } catch (_error) {
    recordStalkerTeleport({
      entity: stalker,
      player,
      phase: "library_hunt",
      reason,
      currentTick: tick,
      allowed: false,
      visible,
      denialReason: "apiTeleportFailed",
    });
    return false;
  }
}

function getLibraryTimerState(player) {
  const playerId = playerIdOf(player);
  if (!libraryTimers.has(playerId)) {
    libraryTimers.set(playerId, {
      remainingTicks: LIBRARY_ESCAPE_TOTAL_TICKS,
      startedTick: currentTick(),
      lastDisplayedSecond: -1,
      lastPhase: "",
      stalker: undefined,
      exitOpen: false,
      exitLocation: undefined,
      fakeExitsPlaced: false,
      lastStalkerMoveTick: 0,
      lastSpawnAttemptTick: 0,
      resetCount: 0,
      lastTooCloseResetTick: 0,
    });
  }
  return libraryTimers.get(playerId);
}

function startLibraryTimer(player, reason = "The Stalker has opened the archive.") {
  if (!player || dimensionIdOf(player) !== DIMENSION.library) return;
  const playerId = playerIdOf(player);
  const timer = {
    remainingTicks: LIBRARY_ESCAPE_TOTAL_TICKS,
    startedTick: currentTick(),
    lastDisplayedSecond: -1,
    lastPhase: "",
    stalker: undefined,
    exitOpen: false,
    exitLocation: undefined,
    fakeExitsPlaced: false,
    lastStalkerMoveTick: 0,
    lastSpawnAttemptTick: 0,
    resetCount: 0,
    lastTooCloseResetTick: 0,
  };
  libraryTimers.set(playerId, timer);
  spawnLibraryStalker(player, timer);
  safeTitle(player, "The Library", reason, 45);
  markLibraryPhase(player, timer, "5:00");
}

function formatTime(ticks) {
  const totalSeconds = Math.max(0, Math.ceil(ticks / TICKS_PER_SECOND));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}

function distanceToStalker(player, stalker) {
  try {
    if (!stalker || !isEntityValid(stalker) || !stalker.location) return Number.POSITIVE_INFINITY;
    return Math.sqrt(distanceSquared(player.location, stalker.location));
  } catch (_error) {
    return Number.POSITIVE_INFINITY;
  }
}

function markLibraryPhase(player, timer, phase) {
  if (timer.lastPhase === phase) return;
  timer.lastPhase = phase;
  switch (phase) {
    case "5:00":
      safeActionBar(player, "Library timer: 5:00 | The Stalker begins slow. Stay 12+ blocks away.");
      safePlaySound(player.dimension, "ambient.cave", player.location, { volume: 0.45, pitch: 0.65 });
      break;
    case "4:00":
      safeTitle(player, "4:00", "The bookshelves begin whispering.", 35);
      safePlaySound(player.dimension, "ambient.cave", player.location, { volume: 0.7, pitch: 0.8 });
      break;
    case "3:00":
      safeTitle(player, "3:00", "The lights forget how to stay on.", 35);
      flickerLibraryLights(player);
      break;
    case "2:00":
      safeTitle(player, "2:00", "The Stalker learns your pace.", 35);
      break;
    case "1:00":
      safeTitle(player, "1:00", "The fake exits appear.", 35);
      placeLibraryFakeExits(player, timer);
      break;
    case "0:00":
      openLibraryRealExit(player, timer);
      break;
    default:
      break;
  }
}

function flickerLibraryLights(player) {
  const base = toBlockPos(player.location);
  for (const pos of [
    { x: base.x + 4, y: base.y + 8, z: base.z + 4 },
    { x: base.x - 4, y: base.y + 8, z: base.z + 4 },
    { x: base.x + 4, y: base.y + 8, z: base.z - 4 },
    { x: base.x - 4, y: base.y + 8, z: base.z - 4 },
  ]) {
    setBlockSafe(player.dimension, pos, "minecraft:air");
    system.runTimeout(() => setBlockSafe(player.dimension, pos, "minecraft:glowstone"), 30);
  }
}

function placeLibraryFakeExits(player, timer) {
  if (timer.fakeExitsPlaced) return;
  timer.fakeExitsPlaced = true;
  const base = toBlockPos(player.location);
  const spots = [
    { x: base.x + 6, y: base.y, z: base.z },
    { x: base.x - 6, y: base.y, z: base.z },
    { x: base.x, y: base.y, z: base.z + 6 },
  ];
  for (const spot of spots) {
    setBlockSafe(player.dimension, { x: spot.x, y: spot.y - 1, z: spot.z }, "minecraft:oak_planks");
    setBlockSafe(player.dimension, spot, "minecraft:stone_pressure_plate");
    setStandingSign(player.dimension, offset(spot, 0, 0, 1), "EXIT", "minecraft:oak_sign");
  }
}

function openLibraryRealExit(player, timer) {
  if (timer.exitOpen) return;
  const base = toBlockPos(player.location);
  const exitLocation = { x: base.x, y: base.y, z: base.z - 5 };
  timer.exitOpen = true;
  timer.exitLocation = exitLocation;
  setBlockSafe(player.dimension, { x: exitLocation.x, y: exitLocation.y - 1, z: exitLocation.z }, "minecraft:emerald_block");
  setBlockSafe(player.dimension, exitLocation, LIBRARY_EXIT_PAD_BLOCK);
  setStandingSign(player.dimension, offset(exitLocation, 0, 0, -2), "REAL\nEXIT", "minecraft:oak_sign");
  safeTitle(player, "0:00", "The real exit opens. Step on the green plate.", 55);
}

function updateLibraryTimer(player) {
  if (!player || dimensionIdOf(player) !== DIMENSION.library) return;
  const timer = getLibraryTimerState(player);
  const stalker = spawnLibraryStalker(player, timer);
  const tick = currentTick();
  if (!stalker || !isEntityValid(stalker)) {
    if (tick - (timer.lastMissingStalkerMessageTick || 0) >= TICKS_PER_SECOND * 5) {
      timer.lastMissingStalkerMessageTick = tick;
      safeActionBar(player, `Library timer waiting at ${formatTime(timer.remainingTicks)}. The Stalker is still finding you.`);
    }
    return;
  }
  const distance = distanceToStalker(player, stalker);

  if (distance > 30 || tick - (timer.lastStalkerMoveTick || 0) >= (timer.remainingTicks <= TICKS_PER_SECOND * 120 ? TICKS_PER_SECOND * 14 : TICKS_PER_SECOND * 20)) {
    if (teleportStalkerNearPlayer(player, stalker, timer, distance > 30 ? "library-distance-correct" : "library-paced-pressure")) {
      timer.lastStalkerMoveTick = tick;
    }
  }

  if (distance >= LIBRARY_COUNT_DISTANCE) {
    timer.remainingTicks = Math.max(0, timer.remainingTicks - LIBRARY_TIMER_TICKS);
  } else if (distance >= LIBRARY_PAUSE_DISTANCE) {
    safeActionBar(player, `Library timer paused at ${formatTime(timer.remainingTicks)}. Keep 12+ blocks from the Stalker.`);
    return;
  } else {
    if (tick - (timer.lastTooCloseResetTick || 0) < TICKS_PER_SECOND * 6) {
      safeActionBar(player, `Too close. Move away. Timer remains at ${formatTime(timer.remainingTicks)}.`);
      return;
    }
    timer.lastTooCloseResetTick = tick;
    timer.remainingTicks = LIBRARY_ESCAPE_TOTAL_TICKS;
    timer.resetCount = (timer.resetCount || 0) + 1;
    safeTitle(player, "Too close.", "The timer starts over.", 35);
    safePlaySound(player.dimension, "ambient.cave", player.location, { volume: 0.8, pitch: 0.45 });
    applyHorrorConsequence(player, {
      source: "library_timer",
      eventKey: "library_stalker_too_close",
      category: "major",
      fear: 18,
      stalkerAttention: 12,
      panicTicks: TICKS_PER_SECOND * 5,
      flashlightInterferenceTicks: TICKS_PER_SECOND * 10,
      visionDistortionTicks: TICKS_PER_SECOND * 6,
      reliefTicks: TICKS_PER_SECOND * 10,
    }, tick);
    if (teleportStalkerNearPlayer(player, stalker, timer, "library-too-close-reset")) {
      timer.lastStalkerMoveTick = tick;
    }
    return;
  }

  const seconds = Math.ceil(timer.remainingTicks / TICKS_PER_SECOND);
  if (seconds !== timer.lastDisplayedSecond) {
    timer.lastDisplayedSecond = seconds;
    safeActionBar(player, `Library survival timer: ${formatTime(timer.remainingTicks)} | Stalker distance: ${Number.isFinite(distance) ? distance.toFixed(1) : "?"}`);
  }

  if (timer.remainingTicks <= TICKS_PER_SECOND * 240) markLibraryPhase(player, timer, "4:00");
  if (timer.remainingTicks <= TICKS_PER_SECOND * 180) markLibraryPhase(player, timer, "3:00");
  if (timer.remainingTicks <= TICKS_PER_SECOND * 120) markLibraryPhase(player, timer, "2:00");
  if (timer.remainingTicks <= TICKS_PER_SECOND * 60) markLibraryPhase(player, timer, "1:00");
  if (timer.remainingTicks <= 0) markLibraryPhase(player, timer, "0:00");
}

function checkLibraryExit(player) {
  if (!player || dimensionIdOf(player) !== DIMENSION.library) return;
  const timer = libraryTimers.get(playerIdOf(player));
  if (!timer || !timer.exitOpen || !timer.exitLocation) return;
  if (distanceSquared(player.location, timer.exitLocation) > 2.3 * 2.3) return;
  system.run(() => {
    void teleportToRememberedReturn(player, "The Library", "You survived long enough to leave.");
  });
}

function handleBlockInteract(event) {
  const player = event.player;
  const block = event.block;
  if (!player || !block) return;
  const blockTypeId = String(block.typeId || "");
  const dimensionId = dimensionIdOf(player);

  if (!isPlayerInParadise(player) && blockTypeId.endsWith("_door")) {
    handleDoorMistake(player);
  }

  if (dimensionId === DIMENSION.yellowHalls && isExitSignBlock(block)) {
    const playerId = playerIdOf(player);
    const count = (yellowFakeExitCounts.get(playerId) || 0) + 1;
    yellowFakeExitCounts.set(playerId, count);
    if (count === 1) {
      safeTitle(player, "EXIT", "The first exit returns you.", 35);
    } else if (count === 2) {
      scheduleYellowHiddenExit(player);
      safeTitle(player, "EXIT", "The second exit sends you back again.", 35);
    } else if (count > 2) {
      safeTitle(player, "EXIT", "More fake exits appear.", 35);
    }
  }

  if (!isPlayerInParadise(player) && BOOKSHELF_BLOCK_IDS.has(blockTypeId)) {
    const held = getHeldItemTypeId(player, event);
    if (blockTypeId === "minecraft:lectern" || BOOK_ITEM_IDS.has(held) || blockTypeId === "minecraft:chiseled_bookshelf") {
      handleLibraryReadingMistake(player, "You opened a forbidden archive.");
    }
  }
}

function handleBlockBreakBefore(event) {
  const player = event.player;
  const block = event.block;
  if (!player || !block) return;
  const typeId = String(block.typeId || "");
  const location = copyLocation(block.location);
  const dimensionId = dimensionIdOf(block.dimension || player.dimension);
  handleFlowerBreakMistake(player, typeId, location, dimensionId);
  handleCatacombMiningMistake(player, typeId, location, dimensionId);
}

function handleItemUse(event) {
  const player = event.source;
  if (!player || player.typeId !== "minecraft:player" || isPlayerInParadise(player)) return;
  const itemTypeId = event.itemStack && event.itemStack.typeId ? String(event.itemStack.typeId) : "";
  if (!BOOK_ITEM_IDS.has(itemTypeId)) return;
  if (!hasBookshelfNear(player, 4)) return;
  handleLibraryReadingMistake(player, "You read between the shelves.");
}

function handleEntityHurt(event) {
  const entity = event.hurtEntity;
  if (!entity || entity.typeId !== "minecraft:player" || isPlayerInParadise(entity)) return;
  const cause = causeText(event);
  if (!cause.includes("fire") && !cause.includes("lava") && !cause.includes("burn")) return;
  const state = getMistakeState(playerIdOf(entity));
  state.recentFireHurtTick = currentTick();
}

function handleDimensionChange(event) {
  const player = event.player;
  if (!player) return;
  const playerId = playerIdOf(player);
  const toId = dimensionIdOf(event.toDimension);
  const fromId = dimensionIdOf(event.fromDimension);

  if (isParadiseDimensionId(toId)) {
    if (!returnPoints.has(playerId) && fromId && !isParadiseDimensionId(fromId)) {
      returnPoints.set(playerId, {
        dimensionId: fromId,
        location: event.fromLocation ? copyLocation(event.fromLocation) : copyLocation(world.getDefaultSpawnLocation()),
      });
    }
    setDimensionAnchor(player);
    if (toId === DIMENSION.library) {
      system.runTimeout(() => startLibraryTimer(player), 10);
    }
  }

  if (isParadiseDimensionId(fromId) && !isParadiseDimensionId(toId)) {
    clearDimensionState(playerId);
  }
}

function scanPadsAndExits() {
  for (const player of getCachedPlayers()) {
    if (!player || !player.dimension || !player.location) continue;
    refreshConnectionPadsForPlayer(player);
    checkConnectionPadsForPlayer(player);
    checkYellowHiddenExit(player);
    checkLibraryExit(player);
  }
}

function updateLibraryTimers() {
  for (const player of getCachedPlayers()) {
    if (!player || dimensionIdOf(player) !== DIMENSION.library) continue;
    updateLibraryTimer(player);
  }
}

function subscribeAfter(eventSignal, handler) {
  try {
    if (eventSignal && typeof eventSignal.subscribe === "function") {
      eventSignal.subscribe(handler);
    }
  } catch (_error) {}
}

function subscribeBefore(eventSignal, handler) {
  try {
    if (eventSignal && typeof eventSignal.subscribe === "function") {
      eventSignal.subscribe(handler);
    }
  } catch (_error) {}
}

subscribeAfter(world.afterEvents.playerInteractWithBlock, handleBlockInteract);
subscribeBefore(world.beforeEvents.playerBreakBlock, handleBlockBreakBefore);
subscribeAfter(world.afterEvents.itemUse, handleItemUse);
subscribeAfter(world.afterEvents.entityHurt, handleEntityHurt);
subscribeAfter(world.afterEvents.entityDie, handlePlayerDeath);
subscribeAfter(world.afterEvents.playerSpawn, (event) => {
  if (!event || event.initialSpawn || !event.player) return;
  routeDeathMemory(event.player);
});
subscribeAfter(world.afterEvents.playerDimensionChange, handleDimensionChange);
subscribeAfter(world.afterEvents.playerLeave, (event) => {
  const playerId = event.playerId;
  playerMistakes.delete(playerId);
  pendingDeathRoutes.delete(playerId);
  pendingHeavenDeathEntries.delete(playerId);
  returnPoints.delete(playerId);
  dimensionAnchors.delete(playerId);
  yellowFakeExitCounts.delete(playerId);
  clearDimensionState(playerId);
  resetPlayerHorrorState(playerId);
  clearPlayerTelemetry(playerId);
});

system.runInterval(updateMovementMistakes, PLAYER_SCAN_TICKS);
system.runInterval(scanPadsAndExits, PAD_SCAN_TICKS);
system.runInterval(updateLibraryTimers, LIBRARY_TIMER_TICKS);
