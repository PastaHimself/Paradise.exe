import { BlockPermutation, system, world } from "@minecraft/server";
import { HORROR_EVENT_CATALOG, validateHorrorEventCatalog } from "./horror_event_catalog_v2.js";
import {
  EVENT_FAMILY,
  EVENT_TIER,
  applyEventPressure,
  createEventMemory,
  createRuntimeState,
  markSessionEnded,
  markSessionStarted,
  rememberEvent,
  decayEventPressure,
  eventStartChance,
  ambientReadinessScore,
  rankEventCandidates,
  serializeEventMemory,
  deserializeEventMemory,
} from "./horror_event_model_v2.js";
import { createHorrorEventRuntime } from "./horror_event_runtime_v2.js";
import { createHorrorExperienceCoordinator } from "./paradise_horror_experience.js";
import {
  aabbIntersectsBlockCell,
  geometryCandidates,
  hasCascadeRisk,
  isLocationClearOfPlayers,
  reserveExactTargets,
  tryRestoreRecord,
} from "./horror_event_safety_v2.js";
import {
  appendRestorationSnapshot,
  createRestorationSnapshot,
  parseRestorationJournal,
  removeRestorationSnapshot,
  serializeRestorationJournal,
} from "./horror_event_persistence_v2.js";
import { requestVhsTier, VHS_TIER } from "./paradise_horror_state.js";
import { applyHorrorConsequence, getPlayerHorrorSnapshot } from "./paradise_player_horror_state.js";
import { getCachedPlayerById, getCachedPlayers } from "./paradise_tick_cache.js";
import { recordPlayerTelemetry } from "./paradise_telemetry.js";
import { clearPlayerAudioState } from "./horror_audio.js";
import { requestWatcherGlimpse } from "./watcher_stalker.js";

const TICKS_PER_SECOND = 20;
const SAMPLE_INTERVAL_TICKS = 10;
const RUNTIME_INTERVAL_TICKS = 5;
const ATTEMPT_INTERVAL_TICKS = 100;
const PLAYER_WARMUP_TICKS = 20 * 45;
const ROUTE_CELL_SIZE = 8;
const ROUTE_HISTORY_LIMIT = 28;
const TURN_MEMORY_TICKS = 20 * 120;
const DIMENSION_WARMUP_TICKS = 20 * 15;
const MAX_PENDING_RESTORATIONS = 128;
const ERROR_REPORT_COOLDOWN_TICKS = 20 * 30;
const DOORWAY_TARGET_CLEARANCE = 1.75;
const RESTORATION_JOURNAL_KEY = "paradise:horror_v2_restorations_v1";
const HORROR_MEMORY_PROPERTY = "paradise:horror_v2_event_memory_v1";
const horrorExperience = createHorrorExperienceCoordinator({
  defaultMinimumQuietTicks: 20 * 45,
  serverMajorPeakLimit: 2,
});

const SAFE_DESTRUCTIBLE_BLOCKS = new Set([
  "minecraft:stone", "minecraft:cobblestone", "minecraft:mossy_cobblestone",
  "minecraft:stone_bricks", "minecraft:mossy_stone_bricks", "minecraft:cracked_stone_bricks",
  "minecraft:deepslate", "minecraft:cobbled_deepslate", "minecraft:deepslate_bricks",
  "minecraft:cracked_deepslate_bricks", "minecraft:deepslate_tiles", "minecraft:cracked_deepslate_tiles",
  "minecraft:tuff", "minecraft:calcite", "minecraft:dripstone_block", "minecraft:bricks",
  "minecraft:mud_bricks", "minecraft:sandstone", "minecraft:smooth_sandstone",
  "minecraft:red_sandstone", "minecraft:smooth_red_sandstone", "minecraft:netherrack",
  "minecraft:blackstone", "minecraft:polished_blackstone", "minecraft:polished_blackstone_bricks",
  "minecraft:basalt", "minecraft:smooth_basalt", "minecraft:dirt", "minecraft:coarse_dirt",
  "minecraft:rooted_dirt", "minecraft:gravel", "minecraft:sand", "minecraft:red_sand",
  "minecraft:clay", "minecraft:terracotta", "minecraft:glass",
  "minecraft:oak_planks", "minecraft:spruce_planks", "minecraft:birch_planks",
  "minecraft:jungle_planks", "minecraft:acacia_planks", "minecraft:dark_oak_planks",
  "minecraft:mangrove_planks", "minecraft:cherry_planks", "minecraft:bamboo_planks",
  "minecraft:crimson_planks", "minecraft:warped_planks",
  "minecraft:oak_log", "minecraft:spruce_log", "minecraft:birch_log", "minecraft:jungle_log",
  "minecraft:acacia_log", "minecraft:dark_oak_log", "minecraft:mangrove_log", "minecraft:cherry_log",
  ...[
    "white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray",
    "light_gray", "cyan", "purple", "blue", "brown", "green", "red", "black",
  ].flatMap((color) => [
    `minecraft:${color}_concrete`,
    `minecraft:${color}_terracotta`,
    `minecraft:${color}_wool`,
  ]),
]);

const SAFE_FLAMMABLE_BLOCKS = new Set([
  "minecraft:oak_planks", "minecraft:spruce_planks", "minecraft:birch_planks",
  "minecraft:jungle_planks", "minecraft:acacia_planks", "minecraft:dark_oak_planks",
  "minecraft:mangrove_planks", "minecraft:cherry_planks", "minecraft:bamboo_planks",
  "minecraft:oak_log", "minecraft:spruce_log", "minecraft:birch_log", "minecraft:jungle_log",
  "minecraft:acacia_log", "minecraft:dark_oak_log", "minecraft:mangrove_log", "minecraft:cherry_log",
  ...[
    "white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray",
    "light_gray", "cyan", "purple", "blue", "brown", "green", "red", "black",
  ].map((color) => `minecraft:${color}_wool`),
]);

const LIGHT_BLOCKS = new Set([
  "minecraft:torch", "minecraft:wall_torch", "minecraft:redstone_torch", "minecraft:redstone_wall_torch",
  "minecraft:lantern", "minecraft:soul_lantern", "minecraft:glowstone", "minecraft:sea_lantern",
  "minecraft:shroomlight", "minecraft:ochre_froglight", "minecraft:verdant_froglight",
  "minecraft:pearlescent_froglight",
]);

const PROTECTED_BLOCK_FRAGMENTS = Object.freeze([
  "chest", "barrel", "shulker", "furnace", "smoker", "blast_furnace", "hopper",
  "dispenser", "dropper", "brewing_stand", "beacon", "lodestone", "portal", "gateway",
  "command_block", "structure_block", "jigsaw", "spawner", "bed", "sign", "lectern",
  "jukebox", "note_block", "ender_chest", "crafting_table", "anvil", "enchanting_table",
  "redstone", "comparator", "repeater", "lever", "button", "pressure_plate", "door",
  "trapdoor", "fence_gate",
]);

const ARTIFICIAL_FRAGMENTS = Object.freeze([
  "planks", "bricks", "concrete", "terracotta", "glass", "wool", "quartz", "lantern",
  "torch", "copper", "tiles", "polished", "stairs", "slab",
]);

const DOOR_FRAGMENTS = Object.freeze(["_door", "trapdoor", "fence_gate"]);

const playerTrackers = new Map();
const playerMemories = new Map();
const runtimeState = createRuntimeState();
const pendingRestorations = [];
let persistedRestorationSnapshots = [];
const errorReportTicks = new Map();
let nextSessionId = 1;
let nextRestorationId = 1;

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function floorLocation(location) {
  return {
    x: Math.floor(Number(location?.x) || 0),
    y: Math.floor(Number(location?.y) || 0),
    z: Math.floor(Number(location?.z) || 0),
  };
}

function cloneLocation(location) {
  return { x: Number(location?.x) || 0, y: Number(location?.y) || 0, z: Number(location?.z) || 0 };
}

function add(location, vector, scale = 1) {
  return {
    x: location.x + vector.x * scale,
    y: location.y + vector.y * scale,
    z: location.z + vector.z * scale,
  };
}

function distanceSquared(a, b) {
  const dx = (a?.x || 0) - (b?.x || 0);
  const dy = (a?.y || 0) - (b?.y || 0);
  const dz = (a?.z || 0) - (b?.z || 0);
  return dx * dx + dy * dy + dz * dz;
}

function horizontalLength(vector) {
  return Math.hypot(Number(vector?.x) || 0, Number(vector?.z) || 0);
}

function horizontalUnit(vector, fallback = { x: 0, y: 0, z: 1 }) {
  const length = horizontalLength(vector);
  if (length < 0.0001) return { ...fallback };
  return { x: vector.x / length, y: 0, z: vector.z / length };
}

function safeViewDirection(player) {
  try {
    return player.getViewDirection();
  } catch (_error) {
    return { x: 0, y: 0, z: 1 };
  }
}

function safeVelocity(player) {
  try {
    return player.getVelocity();
  } catch (_error) {
    return { x: 0, y: 0, z: 0 };
  }
}

function getBasis(player) {
  const forward = horizontalUnit(safeViewDirection(player));
  return {
    forward,
    right: { x: -forward.z, y: 0, z: forward.x },
  };
}

function trackerFor(player, currentTick) {
  let tracker = playerTrackers.get(player.id);
  if (!tracker) {
    const location = cloneLocation(player.location);
    tracker = {
      createdTick: currentTick,
      nextAttemptTick: currentTick + PLAYER_WARMUP_TICKS + Math.floor(Math.random() * 20 * 30),
      lastSampleTick: currentTick,
      lastLocation: location,
      lastView: horizontalUnit(safeViewDirection(player)),
      routeCells: [],
      routeSamples: [],
      cellCounts: new Map(),
      turnTicks: [],
      turnedAroundUntilTick: 0,
      fearSprintUntilTick: 0,
      backtrackedUntilTick: 0,
      stillTicks: 0,
      shelterTicks: 0,
      sampleTicks: 0,
      lastShelterBoundaryLocation: undefined,
      dimensionWarmupUntilTick: 0,
      doorStillTicks: 0,
      wasSprinting: false,
      lastInteractionTick: -1e9,
      lastInteractionLocation: undefined,
      lastBreakTick: -1e9,
      lastBreakLocation: undefined,
      lastCueTick: -1e9,
      lastCueLocation: undefined,
      eventPressure: 0,
      dimensionId: player.dimension?.id,
      context: undefined,
    };
    playerTrackers.set(player.id, tracker);
  }
  return tracker;
}

function memoryClock() {
  try { return Math.max(0, Number(world.getAbsoluteTime()) || 0); } catch (_error) { return system.currentTick || 0; }
}

function memoryFor(playerOrId) {
  const player = typeof playerOrId === "string" ? getCachedPlayerById(playerOrId) : playerOrId;
  const playerId = typeof playerOrId === "string" ? playerOrId : playerOrId?.id;
  if (!playerId) return createEventMemory();
  let memory = playerMemories.get(playerId);
  if (!memory) {
    memory = createEventMemory();
    if (player) {
      try {
        const raw = player.getDynamicProperty(HORROR_MEMORY_PROPERTY);
        if (typeof raw === "string") memory = deserializeEventMemory(raw);
      } catch (_error) {}
    }
    playerMemories.set(playerId, memory);
  }
  return memory;
}

function persistMemory(player, memory) {
  if (!player || !memory) return false;
  try {
    player.setDynamicProperty(HORROR_MEMORY_PROPERTY, serializeEventMemory(memory));
    return true;
  } catch (error) {
    reportRuntimeError({ stage: "memory_persistence", playerId: player.id, eventKey: "memory", actionType: "setDynamicProperty", error });
    return false;
  }
}

function routeCell(location, dimensionId) {
  return `${dimensionId || "unknown"}:${Math.floor(location.x / ROUTE_CELL_SIZE)},${Math.floor(location.y / ROUTE_CELL_SIZE)},${Math.floor(location.z / ROUTE_CELL_SIZE)}`;
}

function updateRoute(tracker, location, dimensionId, currentTick) {
  const cell = routeCell(location, dimensionId);
  const history = tracker.routeCells;
  if (history[history.length - 1] === cell) return;

  const recentBeforeLast = history.slice(Math.max(0, history.length - 10), Math.max(0, history.length - 2));
  if (recentBeforeLast.includes(cell)) tracker.backtrackedUntilTick = currentTick + 20 * 5;

  history.push(cell);
  tracker.routeSamples.push({ cell, location: cloneLocation(location), tick: currentTick, dimensionId });
  tracker.cellCounts.set(cell, (tracker.cellCounts.get(cell) || 0) + 1);
  while (history.length > ROUTE_HISTORY_LIMIT) {
    const removed = history.shift();
    if (tracker.routeSamples.length > ROUTE_HISTORY_LIMIT) tracker.routeSamples.shift();
    const nextCount = Math.max(0, (tracker.cellCounts.get(removed) || 1) - 1);
    if (nextCount === 0) tracker.cellCounts.delete(removed);
    else tracker.cellCounts.set(removed, nextCount);
  }
}

function routeRepeatScore(tracker) {
  const total = tracker.routeCells.length;
  if (total < 6) return 0;
  let repeatVisits = 0;
  for (const count of tracker.cellCounts.values()) repeatVisits += Math.max(0, count - 1);
  return clamp01(repeatVisits / Math.max(4, total * 0.45));
}

function isProtectedType(typeId) {
  const id = String(typeId || "");
  if (!id.startsWith("minecraft:")) return true;
  return PROTECTED_BLOCK_FRAGMENTS.some((fragment) => id.includes(fragment));
}

function isArtificialType(typeId) {
  const id = String(typeId || "");
  return ARTIFICIAL_FRAGMENTS.some((fragment) => id.includes(fragment));
}

function isDoorType(typeId) {
  const id = String(typeId || "");
  return DOOR_FRAGMENTS.some((fragment) => id.includes(fragment));
}

function isLoaded(dimension, location) {
  try {
    return !!dimension?.isChunkLoaded(location);
  } catch (_error) {
    return false;
  }
}

function getBlockSafe(dimension, location) {
  try {
    if (!isLoaded(dimension, location)) return undefined;
    return dimension.getBlock(location);
  } catch (_error) {
    return undefined;
  }
}

const CONTEXT_OFFSETS = Object.freeze([
  [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1],
  [2, 0, 0], [-2, 0, 0], [0, 0, 2], [0, 0, -2], [1, 1, 1], [-1, 1, -1],
  [2, 1, 2], [-2, 1, -2], [3, 0, 0], [-3, 0, 0], [0, 0, 3], [0, 0, -3],
  [2, 2, 0], [-2, 2, 0], [0, 2, 2], [0, 2, -2],
]);

function sampleNearbyBlocks(player) {
  const origin = floorLocation(player.location);
  let checked = 0;
  let artificial = 0;
  let nearLight = false;
  let nearDoor = false;
  let nearDoorLocation = undefined;
  let destructibleNearby = false;
  let safeIgnitionNearby = false;

  for (const [dx, dy, dz] of CONTEXT_OFFSETS) {
    const block = getBlockSafe(player.dimension, { x: origin.x + dx, y: origin.y + dy, z: origin.z + dz });
    if (!block) continue;
    checked += 1;
    const id = block.typeId;
    if (isArtificialType(id)) artificial += 1;
    if (LIGHT_BLOCKS.has(id)) nearLight = true;
    if (isDoorType(id)) { nearDoor = true; if (!nearDoorLocation) nearDoorLocation = cloneLocation(block.location); }
    if (SAFE_DESTRUCTIBLE_BLOCKS.has(id) && !isProtectedType(id)) destructibleNearby = true;
    if (SAFE_FLAMMABLE_BLOCKS.has(id)) safeIgnitionNearby = true;
  }

  return {
    artificial: checked ? clamp01(artificial / Math.max(4, checked * 0.42)) : 0,
    nearLight,
    nearDoor,
    nearDoorLocation,
    destructibleNearby,
    safeIgnitionNearby,
  };
}

function safeFloorFailure(player) {
  const origin = floorLocation(player.location);
  const floorLoc = { x: origin.x, y: origin.y - 1, z: origin.z };
  const floorBlock = getBlockSafe(player.dimension, floorLoc);
  if (!floorBlock || !SAFE_DESTRUCTIBLE_BLOCKS.has(floorBlock.typeId) || isProtectedType(floorBlock.typeId)) return false;

  const landingLoc = { x: origin.x, y: origin.y - 2, z: origin.z };
  const landing = getBlockSafe(player.dimension, landingLoc);
  if (!landing || landing.isAir || landing.isLiquid) return false;
  return true;
}

function hasNearbyPlayer(player, radius = 64) {
  const radiusSquared = radius * radius;
  for (const other of getCachedPlayers()) {
    if (other.id === player.id || other.dimension?.id !== player.dimension?.id) continue;
    if (distanceSquared(other.location, player.location) <= radiusSquared) return true;
  }
  return false;
}

function resetTrackerForDimension(tracker, player, currentTick) {
  tracker.dimensionId = player.dimension?.id;
  tracker.routeCells.length = 0;
  tracker.routeSamples.length = 0;
  tracker.cellCounts.clear();
  tracker.turnTicks.length = 0;
  tracker.turnedAroundUntilTick = 0;
  tracker.fearSprintUntilTick = 0;
  tracker.backtrackedUntilTick = 0;
  tracker.stillTicks = 0;
  tracker.shelterTicks = 0;
  tracker.sampleTicks = 0;
  tracker.doorStillTicks = 0;
  tracker.wasSprinting = false;
  tracker.lastInteractionTick = -1e9;
  tracker.lastInteractionLocation = undefined;
  tracker.lastBreakTick = -1e9;
  tracker.lastBreakLocation = undefined;
  tracker.lastCueTick = -1e9;
  tracker.lastCueLocation = undefined;
  tracker.lastShelterBoundaryLocation = undefined;
  tracker.eventPressure = 0;
  tracker.context = undefined;
  tracker.lastSampleTick = currentTick;
  tracker.lastLocation = cloneLocation(player.location);
  tracker.lastView = horizontalUnit(safeViewDirection(player));
  tracker.dimensionWarmupUntilTick = currentTick + DIMENSION_WARMUP_TICKS;
  tracker.nextAttemptTick = Math.max(tracker.nextAttemptTick || 0, tracker.dimensionWarmupUntilTick);
}

function updatePlayerContext(player, currentTick) {
  const tracker = trackerFor(player, currentTick);
  if (tracker.dimensionId !== player.dimension?.id) resetTrackerForDimension(tracker, player, currentTick);

  const sampleDelta = Math.max(1, currentTick - tracker.lastSampleTick);
  tracker.lastSampleTick = currentTick;
  tracker.eventPressure = decayEventPressure(tracker.eventPressure, sampleDelta);
  const location = cloneLocation(player.location);
  const velocity = safeVelocity(player);
  const speed = horizontalLength(velocity);
  const moving = speed > 0.035 || distanceSquared(location, tracker.lastLocation) > 0.02;
  const sprinting = (() => {
    try { return !!player.isSprinting; } catch (_error) { return false; }
  })();
  const sneaking = (() => {
    try { return !!player.isSneaking; } catch (_error) { return false; }
  })();

  if (moving) tracker.stillTicks = 0;
  else tracker.stillTicks += sampleDelta;

  const view = horizontalUnit(safeViewDirection(player), tracker.lastView);
  const viewDot = view.x * tracker.lastView.x + view.z * tracker.lastView.z;
  if (viewDot < -0.15) {
    tracker.turnedAroundUntilTick = currentTick + 20 * 2;
    tracker.turnTicks.push(currentTick);
  }
  tracker.turnTicks = tracker.turnTicks.filter((tick) => currentTick - tick <= TURN_MEMORY_TICKS);

  updateRoute(tracker, location, tracker.dimensionId, currentTick);

  const horror = getPlayerHorrorSnapshot(player, currentTick);
  if (sprinting && !tracker.wasSprinting && (currentTick - tracker.lastCueTick <= 20 * 6 || horror.fearScore >= 22)) {
    tracker.fearSprintUntilTick = currentTick + 20 * 8;
  }
  tracker.wasSprinting = sprinting;

  let lightLevel = 15;
  let skyLightLevel = 15;
  try { lightLevel = player.dimension.getLightLevel(location); } catch (_error) {}
  try { skyLightLevel = player.dimension.getSkyLightLevel(location); } catch (_error) {}

  const nearby = sampleNearbyBlocks(player);
  const shelterLike = nearby.artificial >= 0.35 && (skyLightLevel <= 7 || nearby.nearDoor || nearby.nearLight);
  tracker.sampleTicks += sampleDelta;
  if (shelterLike) tracker.shelterTicks = Math.min(20 * 120, tracker.shelterTicks + sampleDelta);
  else tracker.shelterTicks = Math.max(0, tracker.shelterTicks - sampleDelta * 2);
  if (nearby.nearDoorLocation && shelterLike) tracker.lastShelterBoundaryLocation = cloneLocation(nearby.nearDoorLocation);

  if (nearby.nearDoor && !moving) tracker.doorStillTicks += sampleDelta;
  else tracker.doorStillTicks = Math.max(0, tracker.doorStillTicks - sampleDelta * 2);

  const recentCueBoost = currentTick - tracker.lastCueTick <= 20 * 20
    ? Math.max(0, 14 - (currentTick - tracker.lastCueTick) / 30)
    : 0;
  const ambientReadiness = ambientReadinessScore(tracker.sampleTicks, PLAYER_WARMUP_TICKS);
  const tension = Math.max(0, Math.min(100,
    horror.fearScore * 0.48
      + horror.stalkerAttentionLevel * 0.2
      + tracker.eventPressure * 0.55
      + clamp01((12 - lightLevel) / 12) * 8
      + ambientReadiness
      + recentCueBoost,
  ));
  const darkness = clamp01((12 - lightLevel) / 12);
  const routeRepeat = routeRepeatScore(tracker);
  const hiding = sneaking && speed < 0.055 && (darkness >= 0.45 || nearby.artificial >= 0.35);
  const bravery = clamp01((horror.fearScore / 70) * (moving && !sprinting ? 1 : 0.25) * (currentTick > tracker.backtrackedUntilTick ? 1 : 0.45));

  const context = {
    tension,
    tensionNorm: tension / 100,
    ambientReadiness,
    lightLevel,
    skyLightLevel,
    darkness,
    underground: skyLightLevel <= 4,
    openSky: skyLightLevel >= 12,
    openSpace: clamp01((skyLightLevel / 15) * (1 - nearby.artificial * 0.75)),
    artificial: nearby.artificial,
    alone: !hasNearbyPlayer(player, 64),
    moving,
    speed,
    sprinting,
    stillTicks: tracker.stillTicks,
    stillness: clamp01(tracker.stillTicks / (20 * 8)),
    turnedAround: currentTick <= tracker.turnedAroundUntilTick,
    lookBackRate: clamp01(tracker.turnTicks.length / 6),
    fearSprint: currentTick <= tracker.fearSprintUntilTick,
    backtracked: currentTick <= tracker.backtrackedUntilTick,
    routeRepeat,
    hiding,
    doorHesitation: nearby.nearDoor && tracker.doorStillTicks >= 20 * 2,
    shelterReliance: clamp01(tracker.shelterTicks / (20 * 45)),
    bravery,
    recentInteraction: currentTick - tracker.lastInteractionTick <= 20 * 8,
    recentBreak: currentTick - tracker.lastBreakTick <= 20 * 8,
    nearLight: nearby.nearLight,
    nearDoor: nearby.nearDoor,
    destructibleNearby: nearby.destructibleNearby,
    safeIgnitionNearby: nearby.safeIgnitionNearby,
    safeFloorFailure: safeFloorFailure(player),
    sealableDoorway: nearby.nearDoor && nearby.artificial >= 0.2,
  };

  tracker.context = context;
  tracker.lastLocation = location;
  tracker.lastView = view;
  return context;
}

function playerContext(playerId, session) {
  const player = getCachedPlayerById(playerId);
  if (!player) return {};
  const tracker = trackerFor(player, system.currentTick || 0);
  if (session?.data?.dimensionId && session.data.dimensionId !== player.dimension?.id) return {};
  return tracker.context || updatePlayerContext(player, system.currentTick || 0);
}

function learnedRouteLocation(tracker, player) {
  const samples = tracker?.routeSamples || [];
  for (let index = samples.length - 1; index >= 0; index--) {
    const sample = samples[index];
    if ((tracker.cellCounts.get(sample.cell) || 0) < 2) continue;
    const d2 = distanceSquared(sample.location, player.location);
    if (d2 >= 6 * 6 && d2 <= 40 * 40) return cloneLocation(sample.location);
  }
  return undefined;
}

function learnedShelterExteriorLocation(tracker, player, fallbackDirection) {
  const boundary = tracker?.lastShelterBoundaryLocation;
  if (!boundary) return undefined;
  const outward = horizontalUnit({
    x: boundary.x - player.location.x,
    y: 0,
    z: boundary.z - player.location.z,
  }, fallbackDirection);
  return add({ x: boundary.x, y: boundary.y + 1.15, z: boundary.z }, outward, 3.5);
}

function anchorLocation(player, anchor, tracker) {
  const origin = cloneLocation(player.location);
  const { forward, right } = getBasis(player);
  const raised = { ...origin, y: origin.y + 1.15 };
  const velocityDirection = horizontalUnit(safeVelocity(player), forward);
  const side = Math.random() < 0.5 ? -1 : 1;

  switch (anchor) {
    case "behind": return add(raised, forward, -4.8);
    case "ahead": return add(raised, forward, 6.5);
    case "far_ahead": return add(raised, forward, 14);
    case "left": return add(raised, right, -4.5);
    case "right": return add(raised, right, 4.5);
    case "overhead": return { x: raised.x, y: raised.y + 3.1, z: raised.z };
    case "below": return { x: origin.x, y: origin.y - 1.1, z: origin.z };
    case "peripheral": return add(add(raised, forward, 5.5), right, side * 5.5);
    case "route_ahead": {
      const learned = learnedRouteLocation(tracker, player);
      return learned ? { ...learned, y: learned.y + 1.15 } : add(raised, velocityDirection, 8.5);
    }
    case "outside_hide": {
      const learned = learnedShelterExteriorLocation(tracker, player, { x: -forward.x, y: 0, z: -forward.z });
      return learned || add(add(raised, forward, -5.5), right, side * 3.5);
    }
    case "interaction": return tracker?.lastInteractionLocation ? cloneLocation(tracker.lastInteractionLocation) : add(raised, forward, 3.5);
    case "near":
    default:
      return add(add(raised, forward, 2 + Math.random() * 2), right, side * (1.5 + Math.random() * 2));
  }
}

function eventActionIndex(session, action) {
  return Math.max(0, session?.event?.actions?.indexOf(action) ?? 0);
}

function sceneAnchor(session, action, player, currentTick) {
  const tracker = trackerFor(player, currentTick);
  const index = eventActionIndex(session, action);
  if (session?.event?.anchorPolicy === "fixed_world") {
    const fixed = session?.data?.scene?.anchors?.get(index);
    if (fixed) return cloneLocation(fixed);
  }
  return anchorLocation(player, action.anchor || "near", tracker);
}

function markCue(player, location, currentTick) {
  const tracker = trackerFor(player, currentTick);
  tracker.lastCueTick = currentTick;
  tracker.lastCueLocation = cloneLocation(location);
}

function playSpatialSound(session, player, action, currentTick) {
  const location = sceneAnchor(session, action, player, currentTick);
  player.playSound(action.soundId, {
    location,
    volume: Math.max(0, Number(action.volume) || 0.8),
    pitch: Math.max(0.05, Number(action.pitch) || 1),
  });
  markCue(player, location, currentTick);
}

function spawnScenarioParticles(session, player, action, currentTick) {
  const center = sceneAnchor(session, action, player, currentTick);
  const count = Math.max(1, Math.min(20, Math.floor(Number(action.count) || 1)));
  const spread = Math.max(0, Math.min(3, Number(action.spread) || 0));
  for (let index = 0; index < count; index++) {
    const location = {
      x: center.x + (Math.random() * 2 - 1) * spread,
      y: center.y + (Math.random() * 2 - 1) * spread * 0.5,
      z: center.z + (Math.random() * 2 - 1) * spread,
    };
    try { player.spawnParticle(action.particleId, location); } catch (_error) { break; }
  }
}

function isProtectedNeighborhood(dimension, location) {
  const base = floorLocation(location);
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dz = -1; dz <= 1; dz++) {
        const block = getBlockSafe(dimension, { x: base.x + dx, y: base.y + dy, z: base.z + dz });
        if (block && isProtectedType(block.typeId)) return true;
      }
    }
  }
  return false;
}

function playerSafetySnapshots(excludedPlayerId) {
  return getCachedPlayers()
    .filter((player) => !excludedPlayerId || player.id !== excludedPlayerId)
    .map((player) => ({
      id: player.id,
      dimensionId: player.dimension?.id,
      location: cloneLocation(player.location),
    }));
}

function hasEntityOccupancy(dimension, location) {
  const base = floorLocation(location);
  const upper = { x: base.x, y: base.y + 1, z: base.z };
  try {
    const nearby = dimension.getEntities({
      location: { x: base.x + 0.5, y: base.y + 1, z: base.z + 0.5 },
      maxDistance: 4,
    }) || [];
    for (const entity of nearby) {
      try {
        const bounds = entity.getAABB();
        if (aabbIntersectsBlockCell(bounds, base) || aabbIntersectsBlockCell(bounds, upper)) return true;
      } catch (_error) {
        return true;
      }
    }
  } catch (_error) {
    return true;
  }
  return false;
}

function cascadeNeighborhoodSnapshots(dimension, location) {
  const base = floorLocation(location);
  const offsets = [
    [0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1],
  ];
  const neighbors = [];
  for (const [dx, dy, dz] of offsets) {
    const block = getBlockSafe(dimension, { x: base.x + dx, y: base.y + dy, z: base.z + dz });
    if (!block) {
      neighbors.push({ dx, dy, dz, typeId: "paradise:unavailable", isLiquid: true });
      continue;
    }
    neighbors.push({ dx, dy, dz, typeId: block.typeId, isLiquid: !!block.isLiquid });
  }
  return neighbors;
}

function isCascadeSafeBlock(dimension, block) {
  if (!dimension || !block) return false;
  return !hasCascadeRisk(block.typeId, cascadeNeighborhoodSnapshots(dimension, block.location));
}

function isMutationLocationSafe(player, location, options = {}) {
  const players = playerSafetySnapshots(options.allowTargetNear ? player.id : undefined);
  if (!isLocationClearOfPlayers(location, player.dimension?.id, players, options.playerRadius ?? 3)) return false;
  if (options.placement && hasEntityOccupancy(player.dimension, location)) return false;
  return true;
}

function actionCenter(player, action, tracker) {
  if (action.geometry === "doorway" && tracker?.lastShelterBoundaryLocation) {
    return cloneLocation(tracker.lastShelterBoundaryLocation);
  }
  const center = anchorLocation(player, action.anchor || "near", tracker);
  if (action.geometry === "floor") {
    center.y = Math.floor(player.location.y) - 1;
  } else if (action.geometry === "path") {
    center.y = Math.floor(center.y) - 2;
  }
  return center;
}

function targetRecord(block, extra = {}) {
  return {
    location: cloneLocation(block.location),
    expectedTypeId: block.typeId,
    ...extra,
  };
}

function findDoorwaySealTarget(player, center, basis, action, reserved) {
  const doorLocations = geometryCandidates(center, "doorway", basis, Math.min(4, action.radius || 3));
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const location of doorLocations) {
    const door = getBlockSafe(player.dimension, location);
    if (!door || !isDoorType(door.typeId)) continue;
    for (const [dx, dz] of directions) {
      const cell = { x: door.location.x + dx, y: Math.floor(player.location.y), z: door.location.z + dz };
      const key = `${cell.x},${cell.y},${cell.z}`;
      if (reserved?.has(key)) continue;
      const current = getBlockSafe(player.dimension, cell);
      const above = getBlockSafe(player.dimension, { x: cell.x, y: cell.y + 1, z: cell.z });
      const below = getBlockSafe(player.dimension, { x: cell.x, y: cell.y - 1, z: cell.z });
      if (!current?.isAir || !above?.isAir || !below || below.isAir || below.isLiquid) continue;
      if (distanceSquared(cell, player.location) < DOORWAY_TARGET_CLEARANCE * DOORWAY_TARGET_CLEARANCE) continue;
      if (!isMutationLocationSafe(player, cell, { allowTargetNear: true, placement: true, playerRadius: 3.25 })) continue;
      return [{ location: cloneLocation(cell), expectedTypeId: "minecraft:air", doorLocation: cloneLocation(door.location), doorTypeId: door.typeId }];
    }
  }
  return [];
}

function prepareDestructiveTargets(player, action, center, tracker, reserved) {
  const basis = getBasis(player);
  if (action.geometry === "doorway") return findDoorwaySealTarget(player, center, basis, action, reserved);

  const points = geometryCandidates(center, action.geometry, basis, action.radius);
  const limit = Math.max(1, Math.min(12, Math.floor(Number(action.maxBlocks) || 1)));
  const targets = [];
  for (const location of points) {
    if (targets.length >= limit) break;
    const key = `${location.x},${location.y},${location.z}`;
    if (reserved?.has(key)) continue;
    const block = getBlockSafe(player.dimension, location);
    if (!block) continue;

    let eligible = false;
    if (action.mode === "extinguish") eligible = LIGHT_BLOCKS.has(block.typeId);
    else if (action.mode === "ignite") eligible = SAFE_FLAMMABLE_BLOCKS.has(block.typeId);
    else eligible = SAFE_DESTRUCTIBLE_BLOCKS.has(block.typeId) && !isProtectedType(block.typeId);
    if (!eligible) continue;
    if (action.mode !== "seal" && hasCascadeRisk(block.typeId, cascadeNeighborhoodSnapshots(player.dimension, block.location))) continue;

    const allowTargetNear = action.geometry === "floor";
    if (!isMutationLocationSafe(player, block.location, { allowTargetNear, playerRadius: 3.25 })) continue;
    if (!allowTargetNear && isProtectedNeighborhood(player.dimension, block.location)) continue;

    if (action.geometry === "floor" || action.geometry === "path") {
      const landing = getBlockSafe(player.dimension, { x: block.location.x, y: block.location.y - 1, z: block.location.z });
      if (!landing || landing.isAir || landing.isLiquid) continue;
    }

    targets.push(targetRecord(block));
    reserved?.add(key);
  }
  return targets;
}

function prepareTemporaryLightTargets(player, center, action, reserved) {
  const points = geometryCandidates(center, "light", getBasis(player), 7);
  const count = Math.max(1, Math.min(8, Math.floor(Number(action.count) || 1)));
  const candidates = [];
  for (const location of points) {
    const key = `${location.x},${location.y},${location.z}`;
    if (reserved?.has(key)) continue;
    const block = getBlockSafe(player.dimension, location);
    if (!block || !LIGHT_BLOCKS.has(block.typeId) || !isCascadeSafeBlock(player.dimension, block)) continue;
    candidates.push(targetRecord(block));
  }
  return reserveExactTargets(candidates, reserved, count);
}

function prepareEventScene(player, event, currentTick) {
  if (!player || !event || !isLoaded(player.dimension, player.location)) return undefined;
  const tracker = trackerFor(player, currentTick);
  const scene = {
    dimensionId: player.dimension?.id,
    anchors: new Map(),
    targets: new Map(),
  };
  const reserved = new Set();
  let temporaryRestorationCount = 0;

  for (let index = 0; index < event.actions.length; index++) {
    const action = event.actions[index];
    const center = actionCenter(player, action, tracker);
    if (event.anchorPolicy === "fixed_world" || action.type === "destruct" || action.type === "temp_light" || action.type === "watcher") {
      scene.anchors.set(index, cloneLocation(center));
    }

    if (action.type === "destruct") {
      const targets = prepareDestructiveTargets(player, action, center, tracker, reserved);
      if (!targets.length) return undefined;
      scene.targets.set(index, targets);
    } else if (action.type === "temp_light") {
      const targets = prepareTemporaryLightTargets(player, center, action, reserved);
      if (!targets.length) return undefined;
      temporaryRestorationCount += targets.length;
      if (!canReserveRestorations(temporaryRestorationCount)) {
        reportRuntimeError({
          stage: "restoration_backpressure",
          playerId: player.id,
          eventKey: event.key,
          actionType: action.mode || "temp_light",
          error: new Error("temporary restoration journal is at capacity"),
        });
        return undefined;
      }
      scene.targets.set(index, targets);
    }
  }
  return scene;
}

function canReserveRestorations(count = 1) {
  const requested = Math.max(0, Math.floor(Number(count) || 0));
  return persistedRestorationSnapshots.length + requested <= MAX_PENDING_RESTORATIONS;
}

function flushRestorationJournal() {
  try {
    const value = persistedRestorationSnapshots.length > 0
      ? serializeRestorationJournal(persistedRestorationSnapshots)
      : undefined;
    world.setDynamicProperty(RESTORATION_JOURNAL_KEY, value);
    return true;
  } catch (error) {
    reportRuntimeError({
      stage: "restoration_journal_write",
      eventKey: "restoration",
      actionType: "setDynamicProperty",
      error,
    });
    return false;
  }
}

function persistRestorationRecord(record) {
  if (!record || !canReserveRestorations(1)) return false;
  const snapshot = createRestorationSnapshot({
    id: record.id,
    dimensionId: record.dimensionId,
    location: record.location,
    restoreTypeId: record.restoreTypeId,
    restoreStates: record.restoreStates,
    expectedTypeIds: Array.from(record.expectedTypeIds || ["minecraft:air"]),
    createdTick: record.createdTick,
  });
  if (!snapshot) return false;
  const previous = persistedRestorationSnapshots;
  const next = appendRestorationSnapshot(previous, snapshot, MAX_PENDING_RESTORATIONS);
  if (!next.some((entry) => entry.id === snapshot.id)) return false;
  persistedRestorationSnapshots = next;
  if (flushRestorationJournal()) return true;
  persistedRestorationSnapshots = previous;
  return false;
}

function removePersistedRestoration(record) {
  if (!record?.id) return true;
  const previous = persistedRestorationSnapshots;
  const next = removeRestorationSnapshot(previous, record.id);
  if (next.length === previous.length) return true;
  persistedRestorationSnapshots = next;
  if (flushRestorationJournal()) return true;
  persistedRestorationSnapshots = previous;
  return false;
}

function restoreDimension(record) {
  if (record?.dimension) return record.dimension;
  if (!record?.dimensionId) return undefined;
  try { return world.getDimension(record.dimensionId); } catch (_error) { return undefined; }
}

function restoreAdapter(record) {
  return {
    isLoaded(location) {
      const dimension = restoreDimension(record);
      return isLoaded(dimension, location);
    },
    getBlock(location) {
      const dimension = restoreDimension(record);
      return getBlockSafe(dimension, location);
    },
    setPermutation(location, permutation) {
      const dimension = restoreDimension(record);
      if (!dimension) throw new Error("restoration dimension unavailable");
      dimension.setBlockPermutation(location, permutation);
    },
    setType(location, typeId) {
      const dimension = restoreDimension(record);
      if (!dimension) throw new Error("restoration dimension unavailable");
      dimension.setBlockType(location, typeId);
    },
  };
}

function restoreRecord(record) {
  if (!record) return "done";
  if (!record.permutation && record.restoreTypeId) {
    try {
      record.permutation = BlockPermutation.resolve(record.restoreTypeId, record.restoreStates || {});
    } catch (error) {
      reportRuntimeError({
        stage: "restoration_permutation",
        eventKey: "restoration",
        actionType: record.restoreTypeId,
        error,
      });
      return "pending";
    }
  }
  const result = tryRestoreRecord(record, restoreAdapter(record));
  if (result === "restored" || result === "abandoned" || result === "done") {
    if (!removePersistedRestoration(record)) return "pending_journal";
  }
  return result;
}

function registerRestore(session, record) {
  if (!session.data.restores) session.data.restores = [];
  session.data.restores.push(record);
  if (!pendingRestorations.some((entry) => entry.id === record.id)) pendingRestorations.push(record);
  return record;
}

function recoverPendingRestorations() {
  let raw;
  try { raw = world.getDynamicProperty(RESTORATION_JOURNAL_KEY); } catch (error) {
    reportRuntimeError({ stage: "restoration_journal_read", eventKey: "restoration", actionType: "getDynamicProperty", error });
    return;
  }
  if (raw === undefined) {
    persistedRestorationSnapshots = [];
    return;
  }
  if (typeof raw !== "string") {
    reportRuntimeError({
      stage: "restoration_journal_read",
      eventKey: "restoration",
      actionType: "invalid_journal_type",
      error: new Error("restoration journal is not a string"),
    });
    return;
  }
  persistedRestorationSnapshots = parseRestorationJournal(raw).slice(0, MAX_PENDING_RESTORATIONS);
  for (const snapshot of persistedRestorationSnapshots) {
    if (pendingRestorations.some((entry) => entry.id === snapshot.id)) continue;
    pendingRestorations.push({
      id: snapshot.id,
      dimensionId: snapshot.dimensionId,
      location: cloneLocation(snapshot.location),
      restoreTypeId: snapshot.restoreTypeId,
      restoreStates: { ...snapshot.restoreStates },
      expectedTypeIds: new Set(snapshot.expectedTypeIds || ["minecraft:air"]),
      createdTick: snapshot.createdTick,
      restored: false,
      recovered: true,
    });
  }
  processPendingRestorations();
}

function processPendingRestorations() {
  for (let index = pendingRestorations.length - 1; index >= 0; index--) {
    const record = pendingRestorations[index];
    const result = restoreRecord(record);
    if (result === "restored" || result === "abandoned" || result === "done") pendingRestorations.splice(index, 1);
  }
}

function scheduleForSession(session, callback, delayTicks) {
  if (!session.data.runIds) session.data.runIds = [];
  const runId = system.runTimeout(() => {
    const index = session.data.runIds.indexOf(runId);
    if (index >= 0) session.data.runIds.splice(index, 1);
    try {
      callback();
    } catch (error) {
      reportRuntimeError({
        stage: "scheduled_callback",
        playerId: session.playerId,
        eventKey: session.event?.key,
        actionType: "scheduled",
        error,
      });
    }
  }, Math.max(1, Math.floor(delayTicks || 1)));
  session.data.runIds.push(runId);
  return runId;
}

function temporarilyExtinguishLight(session, player, target, restoreTicks, delayTicks = 0) {
  const mutate = () => {
    if (!canReserveRestorations(1)) {
      reportRuntimeError({
        stage: "restoration_backpressure",
        playerId: player.id,
        eventKey: session.event?.key,
        actionType: "temp_light",
        error: new Error("temporary restoration journal is at capacity"),
      });
      return;
    }
    const block = getBlockSafe(player.dimension, target.location);
    if (!block || block.typeId !== target.expectedTypeId || !LIGHT_BLOCKS.has(block.typeId)) return;
    if (!isCascadeSafeBlock(player.dimension, block)) return;
    const record = {
      id: `horror-v2-restore-${memoryClock()}-${nextRestorationId++}`,
      dimension: player.dimension,
      dimensionId: player.dimension?.id,
      location: cloneLocation(block.location),
      permutation: block.permutation,
      restoreTypeId: block.typeId,
      restoreStates: block.permutation.getAllStates(),
      expectedTypeIds: new Set(["minecraft:air"]),
      createdTick: memoryClock(),
      restored: false,
    };
    if (!persistRestorationRecord(record)) {
      reportRuntimeError({
        stage: "restoration_backpressure",
        playerId: player.id,
        eventKey: session.event?.key,
        actionType: "temp_light",
        error: new Error("failed to persist restoration before mutation"),
      });
      return;
    }
    registerRestore(session, record);
    try {
      block.setType("minecraft:air");
    } catch (error) {
      restoreRecord(record);
      reportRuntimeError({ stage: "temporary_light_mutation", playerId: player.id, eventKey: session.event?.key, actionType: "temp_light", error });
      return;
    }
    scheduleForSession(session, () => restoreRecord(record), restoreTicks);
  };
  if (delayTicks > 0) scheduleForSession(session, mutate, delayTicks);
  else mutate();
}

function executeTempLight(session, player, action) {
  const index = eventActionIndex(session, action);
  const targets = session.data.scene?.targets?.get(index) || [];
  targets.forEach((target, targetIndex) => {
    const delay = action.mode === "procession" ? targetIndex * 6 : 0;
    temporarilyExtinguishLight(session, player, target, Math.max(20, Number(action.restoreTicks) || 20 * 8), delay);
  });
}

function revalidateDestructiveTarget(player, target, action) {
  if (!target?.location || !isLoaded(player.dimension, target.location)) return undefined;
  const placement = action.mode === "seal";
  const allowTargetNear = action.geometry === "floor" || placement;
  if (placement && distanceSquared(target.location, player.location) < DOORWAY_TARGET_CLEARANCE * DOORWAY_TARGET_CLEARANCE) return undefined;
  if (!isMutationLocationSafe(player, target.location, { allowTargetNear: placement ? true : allowTargetNear, placement, playerRadius: 3.25 })) return undefined;
  const block = getBlockSafe(player.dimension, target.location);
  if (!block || block.typeId !== target.expectedTypeId) return undefined;

  if (placement) {
    const door = getBlockSafe(player.dimension, target.doorLocation);
    if (!door || door.typeId !== target.doorTypeId || !isDoorType(door.typeId)) return undefined;
    const above = getBlockSafe(player.dimension, { x: target.location.x, y: target.location.y + 1, z: target.location.z });
    const below = getBlockSafe(player.dimension, { x: target.location.x, y: target.location.y - 1, z: target.location.z });
    if (!block.isAir || !above?.isAir || !below || below.isAir || below.isLiquid) return undefined;
  } else if (isProtectedNeighborhood(player.dimension, target.location)) {
    return undefined;
  }
  if (!placement && hasCascadeRisk(block.typeId, cascadeNeighborhoodSnapshots(player.dimension, block.location))) return undefined;
  return block;
}

function emitCollapseDebris(player, location) {
  const center = { x: location.x + 0.5, y: location.y + 0.65, z: location.z + 0.5 };
  for (let index = 0; index < 3; index++) {
    try {
      player.spawnParticle("minecraft:basic_smoke_particle", {
        x: center.x + (Math.random() - 0.5) * 0.6,
        y: center.y + Math.random() * 0.4,
        z: center.z + (Math.random() - 0.5) * 0.6,
      });
    } catch (_error) {
      break;
    }
  }
}

function executeDestruction(session, player, action, currentTick) {
  const index = eventActionIndex(session, action);
  const targets = session.data.scene?.targets?.get(index) || [];
  const limit = Math.max(1, Math.min(12, Math.floor(Number(action.maxBlocks) || 1)));
  let changed = 0;
  for (const target of targets) {
    if (changed >= limit) break;
    const block = revalidateDestructiveTarget(player, target, action);
    if (!block) continue;
    try {
      if (action.mode === "seal") {
        block.setType("minecraft:cobbled_deepslate");
      } else if (action.mode === "ignite") {
        const smokeLocation = { x: block.location.x + 0.5, y: block.location.y + 0.6, z: block.location.z + 0.5 };
        block.setType("minecraft:blackstone");
        try { player.spawnParticle("minecraft:basic_smoke_particle", smokeLocation); } catch (_error) {}
      } else if (action.mode === "collapse") {
        const collapsedLocation = cloneLocation(block.location);
        block.setType("minecraft:air");
        emitCollapseDebris(player, collapsedLocation);
      } else {
        block.setType("minecraft:air");
      }
      changed += 1;
    } catch (error) {
      reportRuntimeError({ stage: "destructive_mutation", playerId: player.id, eventKey: session.event.key, actionType: action.mode, error });
    }
  }

  if (changed > 0) {
    recordPlayerTelemetry(player, "horror_v2_destruction", {
      currentTick,
      source: session.event.key,
      reason: action.mode,
      status: "changed",
      count: changed,
    });
  }
}

function executeVhs(player, action, currentTick, eventKey) {
  const tier = action.tier === "high" ? VHS_TIER.High : VHS_TIER.Low;
  try { requestVhsTier(player, tier, currentTick, Math.max(20, Number(action.ticks) || 20 * 3), `horror-v2-${eventKey}`); } catch (_error) {}
}

function executeWatcher(session, player, action, currentTick) {
  const preferredLocation = sceneAnchor(session, action, player, currentTick);
  const shown = requestWatcherGlimpse(player, {
    style: action.style,
    currentTick,
    preferredLocation,
  });
  if (shown) {
    session.data.watcherShown = (session.data.watcherShown || 0) + 1;
    return true;
  }

  session.data.watcherDenied = (session.data.watcherDenied || 0) + 1;
  try {
    player.playSound("paradise.stalker.breath_far", {
      location: preferredLocation,
      volume: 0.18,
      pitch: 0.72,
    });
    markCue(player, preferredLocation, currentTick);
  } catch (error) {
    reportRuntimeError({ stage: "watcher_fallback", playerId: player.id, eventKey: session.event.key, actionType: action.style, error });
  }
  recordPlayerTelemetry(player, "horror_v2_watcher", {
    currentTick,
    source: session.event.key,
    reason: "watcher_denied",
    status: "fallback_audio",
    style: action.style,
  });
  return false;
}

function reportRuntimeError(info = {}) {
  const currentTick = system.currentTick || 0;
  const key = `${info.stage || "unknown"}:${info.eventKey || "unknown"}:${info.actionType || "unknown"}`;
  const lastTick = errorReportTicks.get(key) ?? -1e9;
  if (currentTick - lastTick < ERROR_REPORT_COOLDOWN_TICKS) return;
  errorReportTicks.set(key, currentTick);
  const message = info.error instanceof Error ? info.error.message : String(info.error || "unknown error");
  console.warn(`[Paradise Horror V2] ${key}: ${message}`);
  try {
    recordPlayerTelemetry(info.playerId, "horror_v2_error", {
      currentTick,
      source: info.eventKey || "unknown",
      reason: info.stage || "unknown",
      status: "error",
      action: info.actionType || "unknown",
      message,
    });
  } catch (_error) {}
}

function executeAction(session, action, currentTick) {
  const player = getCachedPlayerById(session.playerId);
  if (!player || player.dimension?.id !== session.data.dimensionId) return;
  switch (action.type) {
    case "sound": playSpatialSound(session, player, action, currentTick); break;
    case "particle": spawnScenarioParticles(session, player, action, currentTick); break;
    case "watcher": executeWatcher(session, player, action, currentTick); break;
    case "vhs": executeVhs(player, action, currentTick, session.event.key); break;
    case "temp_light": executeTempLight(session, player, action); break;
    case "destruct": executeDestruction(session, player, action, currentTick); break;
    default: break;
  }
}

function cleanupSession(session, reason) {
  const currentTick = system.currentTick || 0;
  const completionClock = memoryClock();
  for (const runId of session.data.runIds || []) {
    try { system.clearRun(runId); } catch (_error) {}
  }
  session.data.runIds = [];
  for (const record of session.data.restores || []) restoreRecord(record);

  markSessionEnded(runtimeState, session.id);
  const livePlayer = getCachedPlayerById(session.playerId);
  const memory = memoryFor(livePlayer || session.playerId);
  const hasWatcherAction = (session.event.actions || []).some((action) => action.type === "watcher");
  const watcherDeniedOnly = hasWatcherAction
    && (session.data.watcherShown || 0) === 0
    && (session.data.watcherDenied || 0) > 0;
  if (session.nextActionIndex > 0 && !watcherDeniedOnly) {
    rememberEvent(memory, session.event, completionClock);
    if (livePlayer) persistMemory(livePlayer, memory);
  } else if (watcherDeniedOnly) {
    recordPlayerTelemetry(session.playerId, "horror_v2", {
      currentTick,
      source: session.event.key,
      reason: "watcher_denied",
      status: "degraded",
      family: session.event.family,
      tier: session.event.tier,
    });
  }

  if (session.data.experienceBeatId) {
    const experiencePlayer = livePlayer || session.playerId;
    if (reason === "complete") {
      horrorExperience.completeHorrorBeat(experiencePlayer, session.data.experienceBeatId, {
        currentTick,
        reliefTicks: 20 * 35,
      });
    } else {
      horrorExperience.cancelHorrorBeat(experiencePlayer, session.data.experienceBeatId, reason, currentTick);
    }
  }

  recordPlayerTelemetry(session.playerId, "horror_v2", {
    currentTick,
    source: session.event.key,
    reason,
    status: reason === "complete" ? "completed" : "aborted",
    family: session.event.family,
    tier: session.event.tier,
  });
}

const runtime = createHorrorEventRuntime({
  getPlayerContext: playerContext,
  executeAction,
  cleanupSession,
  reportError: reportRuntimeError,
});

function consequenceForEvent(event) {
  const fear = event.tier === EVENT_TIER.Major ? 9 : event.tier === EVENT_TIER.Scenario ? 5 : 2;
  const attention = event.family === EVENT_FAMILY.WatcherLinked ? fear + 2 : Math.max(1, Math.floor(fear * 0.65));
  return {
    category: "ambient",
    fear,
    stalkerAttention: attention,
    eventKey: `horror_v2:${event.key}`,
    major: event.tier === EVENT_TIER.Major,
  };
}

function startEventForPlayer(player, event, currentTick, scene) {
  if (!player || !event) return false;
  const preparedScene = scene || prepareEventScene(player, event, currentTick);
  if (!preparedScene) return false;
  const source = `horror_v2:${event.key}`;
  const major = event.tier === EVENT_TIER.Major;
  const experienceDecision = major
    ? horrorExperience.requestHorrorBeat(player, {
      source,
      family: event.family,
      tier: event.tier,
      intensity: event.intensity,
      dimensionId: player.dimension?.id,
      currentTick,
      minimumQuietTicks: event.minimumQuietTicks,
      buildupTicks: Math.min(20 * 5, Math.floor(event.durationTicks * 0.32)),
      peakTicks: Math.max(20, event.durationTicks - Math.min(20 * 5, Math.floor(event.durationTicks * 0.32))),
      reliefTicks: 20 * 35,
      sourceCooldownTicks: 20 * 60 * 20,
    })
    : { allowed: true };
  if (!experienceDecision.allowed) {
    recordPlayerTelemetry(player, "horror_experience", {
      currentTick,
      source,
      reason: experienceDecision.reason,
      status: "denied",
      family: event.family,
      tier: event.tier,
    });
    return false;
  }

  const session = runtime.start({
    id: `horror-v2-${nextSessionId++}`,
    playerId: player.id,
    event,
    startTick: currentTick,
    data: {
      dimensionId: player.dimension?.id,
      restores: [],
      runIds: [],
      scene: preparedScene,
      experienceBeatId: experienceDecision.beatId,
    },
  });
  if (!session) {
    if (major && experienceDecision.beatId) horrorExperience.cancelHorrorBeat(player, experienceDecision.beatId, "runtime_start_failed", currentTick);
    return false;
  }

  const tracker = trackerFor(player, currentTick);
  tracker.eventPressure = applyEventPressure(tracker.eventPressure, event.intensity);

  markSessionStarted(runtimeState, {
    id: session.id,
    playerId: player.id,
    tier: event.tier,
    family: event.family,
    source,
  });
  applyHorrorConsequence(player, consequenceForEvent(event), currentTick);
  recordPlayerTelemetry(player, "horror_v2", {
    currentTick,
    source: event.key,
    reason: "selected",
    status: "started",
    family: event.family,
    tier: event.tier,
  });
  return true;
}

function attemptEvent(player, currentTick) {
  const tracker = trackerFor(player, currentTick);
  if (currentTick < tracker.nextAttemptTick || currentTick < (tracker.dimensionWarmupUntilTick || 0)) return false;
  tracker.nextAttemptTick = currentTick + 20 * (8 + Math.floor(Math.random() * 9));

  const context = tracker.context || updatePlayerContext(player, currentTick);
  const memory = memoryFor(player);
  const memoryNow = memoryClock();
  const quietTicks = memory.lastCompletedTick !== undefined
    ? Math.max(0, memoryNow - memory.lastCompletedTick)
    : Math.max(0, currentTick - tracker.createdTick);
  if (Math.random() > eventStartChance(context, quietTicks)) return false;

  const ranked = rankEventCandidates(
    HORROR_EVENT_CATALOG,
    context,
    memory,
    memoryNow,
    runtimeState,
    player.id,
  );
  if (!ranked.length) return false;

  const candidates = ranked.slice(0, Math.min(6, ranked.length)).map((row) => ({
    ...row,
    utility: row.score * (0.88 + Math.random() * 0.24),
  })).sort((a, b) => b.utility - a.utility);

  for (const candidate of candidates) {
    const preparedScene = prepareEventScene(player, candidate.event, currentTick);
    if (!preparedScene) continue;
    if (startEventForPlayer(player, candidate.event, currentTick, preparedScene)) return true;
  }
  return false;
}

function samplePlayers(currentTick) {
  const liveIds = new Set();
  for (const player of getCachedPlayers()) {
    liveIds.add(player.id);
    try {
      updatePlayerContext(player, currentTick);
    } catch (error) {
      reportRuntimeError({ stage: "context_sampling", playerId: player.id, eventKey: "context", actionType: "sample", error });
    }
  }
  for (const playerId of playerTrackers.keys()) {
    if (!liveIds.has(playerId)) {
      playerTrackers.delete(playerId);
      playerMemories.delete(playerId);
    }
  }
}

function tickHorrorEventsV2() {
  const currentTick = system.currentTick || 0;
  horrorExperience.tick(currentTick);
  if (currentTick % TICKS_PER_SECOND === 0 && pendingRestorations.length > 0) processPendingRestorations();

  if (currentTick % SAMPLE_INTERVAL_TICKS === 0) samplePlayers(currentTick);

  for (const session of runtime.getSessions()) {
    const player = getCachedPlayerById(session.playerId);
    if (!player || player.dimension?.id !== session.data.dimensionId) {
      runtime.abort(session.id, !player ? "player_missing" : "dimension_changed");
    }
  }
  runtime.tick(currentTick);

  if (currentTick % ATTEMPT_INTERVAL_TICKS !== 0) return;
  for (const player of getCachedPlayers()) {
    try {
      attemptEvent(player, currentTick);
    } catch (error) {
      reportRuntimeError({ stage: "event_attempt", playerId: player.id, eventKey: "selection", actionType: "attempt", error });
    }
  }
}

function noteInteraction(event) {
  const player = event?.player;
  if (!player?.id) return;
  const currentTick = system.currentTick || 0;
  const tracker = trackerFor(player, currentTick);
  tracker.lastInteractionTick = currentTick;
  tracker.lastInteractionLocation = cloneLocation(event.block?.location || player.location);
}

function noteBreak(event) {
  const player = event?.player;
  if (!player?.id) return;
  const currentTick = system.currentTick || 0;
  const tracker = trackerFor(player, currentTick);
  tracker.lastBreakTick = currentTick;
  tracker.lastBreakLocation = cloneLocation(event.block?.location || player.location);
}

function abortPlayerSession(playerId, reason) {
  runtime.abortPlayer(playerId, reason);
  horrorExperience.clearHorrorExperience(playerId, reason);
  clearPlayerAudioState(playerId);
  playerTrackers.delete(playerId);
  playerMemories.delete(playerId);
}

const catalogErrors = validateHorrorEventCatalog(HORROR_EVENT_CATALOG);
if (catalogErrors.length > 0) {
  console.warn(`[Paradise Horror V2] catalog validation failed: ${catalogErrors.join(", ")}`);
} else {
  try { world.afterEvents.playerInteractWithBlock.subscribe(noteInteraction); } catch (_error) {}
  try { world.afterEvents.playerBreakBlock.subscribe(noteBreak); } catch (_error) {}
  try { world.afterEvents.playerPlaceBlock.subscribe(noteInteraction); } catch (_error) {}
  try {
    world.afterEvents.playerSpawn.subscribe((event) => {
      const currentTick = system.currentTick || 0;
      trackerFor(event.player, currentTick);
      memoryFor(event.player);
      horrorExperience.getSnapshot(event.player, currentTick);
    });
  } catch (_error) {}
  try {
    world.afterEvents.playerLeave.subscribe((event) => {
      if (event?.playerId) abortPlayerSession(event.playerId, "player_left");
    });
  } catch (_error) {}
  try {
    world.afterEvents.entityDie.subscribe((event) => {
      const dead = event?.deadEntity;
      if (dead?.typeId === "minecraft:player" && dead.id) abortPlayerSession(dead.id, "player_died");
    });
  } catch (_error) {}

  system.run(() => {
    try {
      recoverPendingRestorations();
    } catch (error) {
      reportRuntimeError({ stage: "restoration_recovery", eventKey: "restoration", actionType: "startup", error });
    }
  });
  system.runInterval(tickHorrorEventsV2, RUNTIME_INTERVAL_TICKS);
}
