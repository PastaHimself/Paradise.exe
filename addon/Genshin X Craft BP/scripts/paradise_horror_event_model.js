export const CUSTOM_HORROR_DIMENSION_IDS = Object.freeze([
  "paradise:yellow_halls",
  "paradise:flat_flower",
  "paradise:endless_staircase",
  "paradise:burning_highway",
  "catacombs:catacomb_mazes",
  "heaven:the_heaven",
  "library:the_library",
]);

export const TENSION_CONFIG = Object.freeze({
  maxScore: 100,
  ambientThreshold: 18,
  buildupThreshold: 42,
  majorThreshold: 68,
  panicThreshold: 86,
  directorPulseMinGapTicks: 20 * 45,
  actionRollMinGapTicks: 20 * 12,
  decayIntervalTicks: 20 * 15,
  decayAmount: 5,
});

const VALUABLE_ORES = new Set([
  "minecraft:diamond_ore",
  "minecraft:deepslate_diamond_ore",
  "minecraft:gold_ore",
  "minecraft:deepslate_gold_ore",
  "minecraft:emerald_ore",
  "minecraft:deepslate_emerald_ore",
  "minecraft:ancient_debris",
]);

const DOOR_TYPES = new Set([
  "minecraft:oak_door",
  "minecraft:spruce_door",
  "minecraft:birch_door",
  "minecraft:jungle_door",
  "minecraft:acacia_door",
  "minecraft:dark_oak_door",
  "minecraft:mangrove_door",
  "minecraft:cherry_door",
  "minecraft:bamboo_door",
  "minecraft:crimson_door",
  "minecraft:warped_door",
]);

const BED_TYPES = new Set([
  "minecraft:white_bed",
  "minecraft:orange_bed",
  "minecraft:magenta_bed",
  "minecraft:light_blue_bed",
  "minecraft:yellow_bed",
  "minecraft:lime_bed",
  "minecraft:pink_bed",
  "minecraft:gray_bed",
  "minecraft:light_gray_bed",
  "minecraft:cyan_bed",
  "minecraft:purple_bed",
  "minecraft:blue_bed",
  "minecraft:brown_bed",
  "minecraft:green_bed",
  "minecraft:red_bed",
  "minecraft:black_bed",
]);

const CHEST_TYPES = new Set(["minecraft:chest", "minecraft:trapped_chest", "minecraft:barrel"]);
const FURNACE_TYPES = new Set(["minecraft:furnace", "minecraft:lit_furnace", "minecraft:blast_furnace", "minecraft:smoker"]);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function floorNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.floor(numeric) : fallback;
}

function blockTypeFromContext(context) {
  return String(
    context?.blockType ||
      context?.block?.typeId ||
      context?.data?.blockTypeId ||
      context?.data?.brokenTypeId ||
      "",
  );
}

function damageCauseFromContext(context) {
  return String(context?.damageCause || context?.data?.damageCause || context?.data?.cause || "");
}

function getPlayerId(context) {
  const player = context?.player;
  return String(player?.id || player?.name || player?.nameTag || "none");
}

function getDimensionId(context) {
  return String(context?.dimension?.id || context?.player?.dimension?.id || "none");
}

function getLocation(context) {
  return context?.location || context?.blockLocation || context?.block?.location || context?.player?.location;
}

export function makeDefaultTensionState(tick = 0) {
  const now = Math.max(0, floorNumber(tick));
  return {
    score: 0,
    lastStimulusTick: now,
    lastDecayTick: now,
    lastRollTick: 0,
    lastMajorTick: 0,
    lastEventKey: "",
  };
}

export function makeStableActionKey(context, options = {}) {
  if (options.actionKey) {
    return String(options.actionKey);
  }

  const location = getLocation(context);
  const bucketSize = Math.max(1, floorNumber(options.bucketSize, 4));
  const locationKey = location
    ? `${Math.floor(floorNumber(location.x) / bucketSize)},${Math.floor(floorNumber(location.y) / bucketSize)},${Math.floor(floorNumber(location.z) / bucketSize)}`
    : "none";
  const entityId = String(context?.entity?.id || "none");
  const scriptId = String(context?.sourceEvent?.id || "none");

  return `${String(context?.type || "unknown")}|${getPlayerId(context)}|${getDimensionId(context)}|${locationKey}|${entityId}|${scriptId}`;
}

export function getTriggerTensionPoints(context) {
  const type = String(context?.type || "");
  const blockType = blockTypeFromContext(context);
  const damageCause = damageCauseFromContext(context);
  let points = 0;

  if (type === "directorPulse" || type === "worldLoad") return 0;
  if (type === "playerSpawn") points += 6;
  if (type === "playerBreakBlock") points += 8;
  if (type === "playerInteractWithBlock") points += 5;
  if (type === "entityHurt") points += 18;
  if (type === "entityDie") points += 20;
  if (type === "entitySpawn") points += 4;
  if (type === "scriptEventReceive") points += 30;
  if (type === "houseReplacementSleep") points += 26;

  if (VALUABLE_ORES.has(blockType)) points += 18;
  if (DOOR_TYPES.has(blockType)) points += 8;
  if (BED_TYPES.has(blockType)) points += 16;
  if (CHEST_TYPES.has(blockType)) points += 10;
  if (FURNACE_TYPES.has(blockType)) points += 7;
  if (blockType.includes("spawner")) points += 18;
  if (damageCause.includes("fall") || damageCause.includes("lava") || damageCause.includes("fire")) points += 10;

  return clamp(points, 0, 45);
}

export function decayTensionState(state, tick = 0) {
  const now = Math.max(0, floorNumber(tick));
  const current = state || makeDefaultTensionState(now);
  const elapsed = Math.max(0, now - floorNumber(current.lastDecayTick));
  if (elapsed < TENSION_CONFIG.decayIntervalTicks) {
    return current;
  }

  const steps = Math.floor(elapsed / TENSION_CONFIG.decayIntervalTicks);
  const score = clamp(floorNumber(current.score) - steps * TENSION_CONFIG.decayAmount, 0, TENSION_CONFIG.maxScore);
  return {
    ...current,
    score,
    lastDecayTick: floorNumber(current.lastDecayTick) + steps * TENSION_CONFIG.decayIntervalTicks,
  };
}

export function applyTensionStimulus(state, context, tick = context?.currentTick || 0) {
  const now = Math.max(0, floorNumber(tick));
  const decayed = decayTensionState(state || makeDefaultTensionState(now), now);
  const points = getTriggerTensionPoints(context);
  if (points <= 0) {
    return decayed;
  }

  return {
    ...decayed,
    score: clamp(floorNumber(decayed.score) + points, 0, TENSION_CONFIG.maxScore),
    lastStimulusTick: now,
  };
}

export function getForcedEventKey(options = {}) {
  return String(options?.forcedEventKey || options?.forceEventKey || "");
}

export function shouldApplyTensionTierGate(options = {}) {
  return getForcedEventKey(options) === "";
}

export function shouldAttemptHorrorRoll(state, context, options = {}) {
  if (options.forcedEventKey || options.forceEventKey) {
    return true;
  }

  const now = Math.max(0, floorNumber(context?.currentTick));
  const score = floorNumber(state?.score);
  const type = String(context?.type || "");
  const random = typeof options.random === "function" ? options.random : Math.random;

  if (type === "directorPulse") {
    return score >= TENSION_CONFIG.ambientThreshold && now - floorNumber(state?.lastRollTick) >= TENSION_CONFIG.directorPulseMinGapTicks;
  }

  if (score >= TENSION_CONFIG.majorThreshold) {
    return now - floorNumber(state?.lastRollTick) >= TENSION_CONFIG.actionRollMinGapTicks;
  }

  if (score >= TENSION_CONFIG.buildupThreshold) {
    return random() < 0.35 && now - floorNumber(state?.lastRollTick) >= TENSION_CONFIG.actionRollMinGapTicks;
  }

  if (score >= TENSION_CONFIG.ambientThreshold) {
    return random() < 0.12 && now - floorNumber(state?.lastRollTick) >= TENSION_CONFIG.actionRollMinGapTicks;
  }

  return false;
}
