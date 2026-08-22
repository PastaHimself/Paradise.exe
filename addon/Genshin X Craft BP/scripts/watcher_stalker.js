import { system, world } from "@minecraft/server";
import {
  DEBUG_COMMANDS,
  STALKER_SPAWN_BLOCK_REASON,
  choosePresenceCueStage,
  formatDebugStatus,
  formatSpawnBlockers,
  getWatcherSpawnBlockersForState,
  makeWatcherSpawnResult,
  isForceWatcherCommand,
} from "./watcher_stalker_visibility_model.js";
import { configureHorrorDirector, horrorDirector } from "./horror_director.js";
import {
  HORROR_SOUND,
  maybePlayAmbientHorrorAudio,
  maybePlayStalkerHorrorAudio,
  pointBehindPlayer,
  pointHiddenNearPlayer,
  tryPlayAtPosition,
  tryPlayForOnePlayer,
} from "./horror_audio.js";
import {
  ADAPTIVE_TACTIC,
  chooseAdaptiveTactic,
  canResolveAdaptiveAmbushDamage,
  createAdaptiveProfile,
  decayAdaptiveProfile,
  hasAttackEvidencePolicy,
  observeAdaptiveExposure,
  observeAdaptiveFlashlight,
  observeAdaptiveLook,
  observeAdaptiveMotionAfterExposure,
  observeAdaptiveRoute,
  recordAdaptiveTactic,
} from "./watcher_adaptive_profile.js";
import {
  EVIDENCE_KIND,
  WATCHER_BEHAVIOR,
  approximateWatcherEvidenceLocation,
  advanceWatcherSearch,
  beginWatcherSearch,
  chooseEvidenceDrivenBehavior,
  computeSightEvidenceStrength,
  createWatcherEvidenceState,
  getWatcherEvidenceReactionDelayTicks,
  hasWatcherAttackEvidence,
  observeWatcherEvidence,
  predictWatcherInterception,
  tickWatcherEvidence,
} from "./watcher_evidence_model.js";
import { getCachedPlayerById, getCachedPlayers } from "./paradise_tick_cache.js";
import { clampPreferredLocationToRange } from "./watcher_psychological_choreography.js";
import { isVhsEnabled } from "./player_config.js";
import { applyHorrorConsequence, getPlayerHorrorSnapshot, resetPlayerHorrorState } from "./paradise_player_horror_state.js";
import { clearPlayerTelemetry, recordPlayerTelemetry } from "./paradise_telemetry.js";
import {
  canTeleportStalker,
  clearStalkerTeleportGovernor,
  clearStalkerTeleportGovernors,
  getStalkerTeleportDebugSnapshot,
  recordStalkerTeleport,
  resetStalkerTeleportBudget,
} from "./stalker_teleport_governor.js";
import {
  clearVhsRequest,
  getRequestedVhsRequest,
  getVhsTierRank,
  isPlayerInSafeRoom,
  requestVhsTier,
  showVhsTier,
  VHS_TIER,
} from "./paradise_horror_state.js";

configureHorrorDirector({ tickProvider: () => system.currentTick || 0 });

/**
 * Paradise watcher stalker AI.
 *
 * The watcher is a scripted horror director, not a normal mob AI. It learns
 * player routes, homes, and activity blocks, then moves the watcher through
 * observe, shadow, pressure, ambush, and vanish phases.
 */

const SOUND_POINTS = {
  sneak: 0,
  walk: 1,
  jump: 3,
  sprint: 6,
  chest: 6,
  door: 8,
  placeBlock: 7,
  breakSoft: 8,
  breakWood: 10,
  breakStone: 12,
  breakGlassMetal: 16,
  attack: 14,
  playerHurt: 12,
  loudCombat: 18,
  explosion: 60,
  flashlightToggle: 8,
  flashlightFailClick: 6,
};

const CONFIG = {
  watcherTypeId: "paradise:watcher",
  tickInterval: 5,
  memorySampleInterval: 20,
  heavyMemorySampleInterval: 80,
  rescanInterval: 100,
  spawnCheckInterval: 100,
  cleanupInterval: 200,
  autoSpawnWatchers: true,
  maxWatchersPerDimension: 4,
  maxWatchersPerPlayer: 1,
  targetSearchRadius: 224,
  targetKeepRadius: 288,
  cooldownObjectiveId: "paradise_watcher_cd",
  cooldownObjectiveName: "Paradise Watcher Cooldown",
  playerCooldownSeconds: 240,
  vanishTicks: 20 * 45,
  phaseHeat: {
    observe: 28,
    shadow: 56,
    pressure: 78,
    ambush: 88,
  },
  initialSpawnHeat: 10,
  interactionHeat: 6,
  activityHeat: 5,
  seenHeat: 5,
  staredHeat: 8,
  closeHeat: 5,
  baseHeat: 4,
  movementHeat: 1,
  heatDecayInterval: 20 * 14,
  heatDecayAmount: 1,
  fearDecayInterval: 20 * 26,
  fearDecayAmount: 1,
  routeCellSize: 16,
  activityScanRadius: 6,
  lightPreference: 7,
  candidateSamples: {
    observe: 30,
    shadow: 40,
    pressure: 44,
    ambush: 34,
    vanish: 22,
  },
  ranges: {
    observe: [52, 84],
    shadow: [34, 58],
    pressure: [18, 32],
    ambush: [7, 13],
    vanish: [58, 96],
  },
  moveDelayRanges: {
    dormant: [20 * 45, 20 * 90],
    observe: [20 * 38, 20 * 70],
    shadow: [20 * 24, 20 * 44],
    pressure: [20 * 12, 20 * 24],
    vanish: [20 * 40, 20 * 70],
  },
  exposedRepositionTicks: {
    observe: 12,
    shadow: 18,
    pressure: 32,
  },
  nearRepositionDistance: 6.0,
  farRepositionDistance: 96,
  ambushWarmupTicks: 20 * 3,
  ambushPulseTicks: 14,
  ambushEscapeDistance: 18,
  ambushHitDistance: 12.0,
  minorAmbushDamage: 2,
  ambushDamage: 7,
  encounterOutcomeWeights: {
    fakeout: 0.20,
    nearMiss: 0.30,
    minorDamage: 0.35,
    fullHit: 0.15,
  },
  ambushMaxTicks: 20 * 8,
  lostTargetGraceTicks: 20 * 16,
  debugScriptEventId: "paradise:watcher",
  managedTag: "paradise_watcher_managed",
  velocitySampleWindow: 8,
  velocitySampleInterval: 3,
  predictiveSeconds: 3.5,
  squadMinHeatForPack: 52,
  maxSquadSize: 3,
  phaseTransitionDelayTicks: {
    observeToShadow: 20 * 4,
    shadowToPressure: 20 * 5,
    pressureToAmbush: 20 * 4,
  },
  behaviorHeatBoost: {
    idle: 0.85,
    exploring: 1.05,
    building: 1.25,
    combat: 1.45,
    fleeing: 1.25,
  },
  behaviorAmbushBoost: {
    idle: 0.9,
    exploring: 1.05,
    building: 1.15,
    combat: 1.35,
    fleeing: 1.45,
  },
  revisitPenaltyTicks: 20 * 60 * 3,
  revisitPenaltyScore: 15,
  chokePointBonus: 8,
  escapeRouteBonus: 5,
  overheadCoverBonus: 6,
  predictiveCandidateChance: 0.55,
  particleIds: [
    "minecraft:basic_smoke_particle",
    "minecraft:campfire_smoke_particle",
    "minecraft:sculk_soul_particle",
  ],
  cueSounds: [
    "ambient.cave",
    "mob.endermen.stare",
    "block.sculk_shrieker.shriek",
  ],
  animationPropertyId: "paradise:anim_state",
  animationDurationsTicks: {
    roar: 20 * 2,
    attack: 20,
  },
  attackVanishDelayTicks: 20,
  soundDetectionRadius: 32,
  soundExplosionRadius: 64,
  soundScoreMax: 120,
  soundScoreDecayInterval: 20 * 8,
  soundScoreDecayAmount: 4,
  flashlightToggleAttraction: {
    suspicionPoints: SOUND_POINTS.flashlightToggle,
    failedSuspicionPoints: SOUND_POINTS.flashlightFailClick,
    soundPoints: 11,
    failedSoundPoints: 8,
    heat: 3,
    failedHeat: 2,
    cooldownTicks: 20,
  },
  movementSoundCooldownTicks: 20,
  loudCombatCooldownTicks: 60,
  profileSaveInterval: 20 * 45,
  passiveContextHeatInterval: 20 * 28,
  memoryDynamicPropertyId: "paradise:watcher_memory",
  maxPersistedCells: 8,
  maxLineOfSightDistance: 96,
  lineOfSightStep: 1.0,
  adaptive: {
    tacticMinTicks: 20 * 18,
    tacticMaxTicks: 20 * 42,
    exposureObservationCooldownTicks: 20 * 6,
    sightEvidenceMaxTicks: 20 * 3,
  },
  stareRetreatTicks: {
    observe: 20 * 2,
    shadow: 20 * 3,
    pressure: 20 * 5,
  },
  stareHoldTicks: {
    observe: [20 * 2, 20 * 5],
    shadow: [20 * 3, 20 * 7],
    pressure: [20 * 4, 20 * 9],
  },
  stareHoldChance: {
    observe: 0.18,
    shadow: 0.28,
    pressure: 0.42,
  },
  stareHoldCooldownTicks: [20 * 16, 20 * 34],
  ambushRestraintChance: 0.08,
  nonDamageCooldownTicks: 20 * 10,
  shortFakeoutCooldownSeconds: 45,
  nearMissCooldownSeconds: 75,
  realAmbushMinHeat: 54,
  vanishInvisibilityAmplifier: 1,
  minSpawnAttemptIntervalTicks: 20 * 150,
  samePlayerSpawnCooldownTicks: 20 * 135,
  lowTensionVanishDistance: 13,
  vhs: {
    tickInterval: 20,
    lowDistance: 58,
    highDistance: 24,
    panicDistance: 8,
    panicDurationTicks: 20 * 8,
    decayTicks: 20 * 12,
    minimumTierTicks: 20 * 4,
    refreshTicks: 30,
    panicMinIntervalTicks: 20 * 120,
    safeRoomClearRefreshTicks: 20,
  },
  psychological: {
    enabled: true,
    tickInterval: 20,
    minHeat: 18,
    minimumPressure: 24,
    globalCooldownTicks: 20 * 38,
    playerCooldownTicks: 20 * 95,
    safeRoomPlayerCooldownTicks: 20 * 80,
    typeCooldownTicks: 20 * 150,
    noEncounterSuppressTicks: [20 * 20, 20 * 42],
    psychOnlySuppressChaseTicks: [20 * 70, 20 * 125],
    escalateDelayTicks: [20 * 8, 20 * 22],
    maxActivePerPlayer: 1,
    maxActivePerDimension: 4,
    minSpawnDistance: 5.5,
    maxSpawnDistance: 66,
    closeVanishDistance: 5.25,
    staredVanishTicks: 10,
    halfHiddenStaredVanishTicks: 18,
    safeRoomExteriorChance: 0.10,
    outcomeWeights: {
      psychologicalOnly: 0.50,
      psychologicalThenChase: 0.16,
      directChase: 0.18,
      noEncounter: 0.16,
    },
    safeRoomOutcomeWeights: {
      psychologicalOnly: 0.84,
      noEncounter: 0.16,
    },
    typeWeights: {
      hallwayGlimpse: 1.15,
      turnaroundApparition: 1.05,
      halfHidden: 1.25,
      fogSilhouette: 1.05,
      safeRoomExterior: 1.0,
      catacombsOverhead: 1.15,
      passiveMobReplacement: 0.65,
    },
    visibleTicks: {
      hallwayGlimpse: 10,
      turnaroundApparition: 12,
      halfHidden: 22,
      fogSilhouette: 28,
      safeRoomExterior: 30,
      catacombsOverhead: 16,
      passiveMobReplacement: 14,
    },
    ranges: {
      hallwayGlimpse: [14, 28],
      turnaroundApparition: [6, 11],
      halfHidden: [9, 22],
      fogSilhouette: [30, 62],
      safeRoomExterior: [10, 18],
      catacombsOverhead: [5, 14],
      passiveMobReplacement: [6, 18],
    },
    passiveReplacement: {
      searchRadius: 18,
      mobInvisibilityExtraTicks: 18,
    },
  },
  antiCombat: {
    hitWindowTicks: 20 * 45,
    hitCooldownTicks: 12,
    aggressionDecayTicks: 20 * 90,
    aggressionDecayAmount: 1,
    heatPerHit: 14,
    fearPerHit: 7,
    suspicionPerHit: 18,
    vanishBaseTicks: 20 * 35,
    vanishMinTicks: 20 * 8,
    reappearBaseTicks: 20 * 32,
    reappearMinTicks: 20 * 7,
    panicHitThreshold: 3,
    panicCooldownTicks: 20 * 35,
    warningMessageCooldownTicks: 20 * 22,
  },
};

const TENSION = {
  Quiet: "quiet",
  Buildup: "buildup",
  Peak: "peak",
  Relief: "relief",
};

const TENSION_CONFIG = {
  quietMinTicks: 20 * 55,
  buildupMinTicks: 20 * 65,
  peakMaxTicks: 20 * 24,
  reliefMinTicks: 20 * 60,
  reliefMaxTicks: 20 * 120,
  buildupPressure: 32,
  peakPressure: 82,
};

const SUSPICION_PHASE = {
  Quiet: "quiet",
  Investigate: "investigate",
  Spotted: "spotted",
  Warned: "warned",
  AttackReady: "attack_ready",
};

const SUSPICION_CONFIG = {
  max: 100,
  investigate: 20,
  spotted: 44,
  warning: 62,
  attack: 82,
  decayIntervalTicks: 20 * 3,
  quietDecay: 4,
  sneakDecay: 8,
  actionCooldownTicks: 8,
  warningDurationTicks: 20 * 18,
};

const PSYCHOLOGICAL_OUTCOME = {
  PsychologicalOnly: "psychological_only",
  PsychologicalThenChase: "psychological_then_chase",
  DirectChase: "direct_chase",
  NoEncounter: "no_encounter",
};

const PSYCHOLOGICAL_APPEARANCE_TYPE = {
  HallwayGlimpse: "hallwayGlimpse",
  TurnaroundApparition: "turnaroundApparition",
  HalfHidden: "halfHidden",
  FogSilhouette: "fogSilhouette",
  SafeRoomExterior: "safeRoomExterior",
  CatacombsOverhead: "catacombsOverhead",
  PassiveMobReplacement: "passiveMobReplacement",
};

const PHASE = {
  Dormant: "dormant",
  Observe: "observe",
  Shadow: "shadow",
  Pressure: "pressure",
  Ambush: "ambush",
  Psychological: "psychological",
  Vanish: "vanish",
};

const BEHAVIOR_MODE = {
  Idle: "idle",
  Exploring: "exploring",
  Building: "building",
  Combat: "combat",
  Fleeing: "fleeing",
};

const SQUAD_ROLE = {
  Observer: "observer",
  Flanker: "flanker",
  Ambusher: "ambusher",
  None: "none",
};

const AMBUSH_OUTCOME = {
  Fakeout: "fakeout",
  NearMiss: "near_miss",
  MinorDamage: "minor_damage",
  Hit: "hit",
  Retreat: "retreat",
};

const WATCHER_ANIMATION_STATE = {
  Idle: 0,
  Walk: 1,
  Run: 2,
  Roar: 3,
  Attack: 4,
};

const VANILLA_STALKER_DIMENSION_IDS = [
  "overworld",
  "nether",
  "the_end",
  "minecraft:overworld",
  "minecraft:nether",
  "minecraft:the_end",
];
const LIBRARY_DIMENSION_ID = "library:the_library";
const LIBRARY_FLOOR_Y = 64;
const LIBRARY_STAND_Y = LIBRARY_FLOOR_Y + 1;
const LIBRARY_CEILING_Y = 73;

const BURNING_HIGHWAY_DIMENSION_ID = "paradise:burning_highway";
const BURNING_HIGHWAY_SEQUENCE_WATCHER_TAG = "paradise_burning_highway_watcher";

const BLOCKED_CUSTOM_DIMENSION_IDS = [
  "paradise:yellow_halls",
  "paradise:flat_flower",
  "paradise:endless_staircase",
  "catacombs:catacomb_mazes",
  "heaven:the_heaven",
  BURNING_HIGHWAY_DIMENSION_ID,
];

const ALLOWED_STALKER_DIMENSION_IDS = new Set([
  ...VANILLA_STALKER_DIMENSION_IDS,
  LIBRARY_DIMENSION_ID,
]);

const WATCHER_SCAN_DIMENSION_IDS = [
  ...ALLOWED_STALKER_DIMENSION_IDS,
  ...BLOCKED_CUSTOM_DIMENSION_IDS,
];

const LIBRARY_PHASE_RANGES = {
  observe: [18, 30],
  shadow: [12, 24],
  pressure: [8, 16],
  ambush: [5, 9],
  vanish: [18, 30],
};

const DEFAULT_MIN_Y = -64;
const DEFAULT_MAX_Y = 319;

const TRANSPARENT_PATTERNS = [
  "air",
  "water",
  "lava",
  "glass",
  "pane",
  "torch",
  "lantern",
  "candle",
  "lever",
  "button",
  "pressure_plate",
  "tripwire",
  "rail",
  "ladder",
  "vine",
  "carpet",
  "sign",
  "ice",
  "cobweb",
  "web",
  "flower",
  "short_grass",
  "tall_grass",
  "seagrass",
  "fern",
  "dead_bush",
  "roots",
  "nether_sprouts",
  "sapling",
  "mushroom",
];

const DANGER_BLOCK_PATTERNS = [
  "lava",
  "fire",
  "magma",
  "cactus",
  "powder_snow",
  "sweet_berry",
  "campfire",
];

const PASSABLE_PATTERNS = [
  "torch",
  "lever",
  "button",
  "pressure_plate",
  "tripwire",
  "rail",
  "ladder",
  "vine",
  "carpet",
  "sign",
  "flower",
  "short_grass",
  "tall_grass",
  "fern",
  "dead_bush",
  "roots",
  "nether_sprouts",
  "sapling",
  "mushroom",
];

const ACTIVITY_WEIGHTS = new Map([
  ["minecraft:barrel", 8],
  ["minecraft:blast_furnace", 7],
  ["minecraft:brewing_stand", 6],
  ["minecraft:cartography_table", 5],
  ["minecraft:chest", 8],
  ["minecraft:composter", 5],
  ["minecraft:crafting_table", 6],
  ["minecraft:enchanting_table", 7],
  ["minecraft:ender_chest", 9],
  ["minecraft:furnace", 7],
  ["minecraft:grindstone", 5],
  ["minecraft:hopper", 5],
  ["minecraft:lectern", 5],
  ["minecraft:loom", 5],
  ["minecraft:smithing_table", 5],
  ["minecraft:smoker", 7],
  ["minecraft:stonecutter", 5],
  ["minecraft:trapped_chest", 8],
]);

const CHEST_SOUND_PATTERNS = ["chest", "barrel", "shulker_box", "hopper", "ender_chest"];
const DOOR_SOUND_PATTERNS = ["door", "trapdoor", "fence_gate"];
const CATACOMBS_DIMENSION_PATTERNS = ["catacomb", "catacombs"];
const PASSIVE_MOB_TYPES = new Set([
  "minecraft:cow",
  "minecraft:pig",
  "minecraft:sheep",
  "minecraft:chicken",
  "minecraft:rabbit",
  "minecraft:horse",
  "minecraft:donkey",
  "minecraft:mule",
  "minecraft:llama",
  "minecraft:goat",
  "minecraft:mooshroom",
  "minecraft:cat",
  "minecraft:wolf",
  "minecraft:fox",
  "minecraft:parrot",
  "minecraft:turtle",
]);

const BREAK_SOUND_CATEGORIES = [
  { patterns: ["glass", "iron", "gold", "copper", "chain", "netherite", "amethyst"], points: SOUND_POINTS.breakGlassMetal },
  { patterns: ["stone", "cobble", "granite", "diorite", "andesite", "deepslate", "blackstone", "basalt", "brick", "sandstone", "concrete", "terracotta", "obsidian"], points: SOUND_POINTS.breakStone },
  { patterns: ["wood", "log", "plank", "fence", "stem", "hyphae", "stripped", "bamboo", "warped", "crimson"], points: SOUND_POINTS.breakWood },
  { patterns: ["dirt", "sand", "gravel", "clay", "leaves", "snow", "powder", "soul", "moss", "nylium", "sponge", "wool", "hay", "mud"], points: SOUND_POINTS.breakSoft },
];

function getBreakSoundPoints(typeId) {
  if (!typeId) {
    return 0;
  }

  for (const category of BREAK_SOUND_CATEGORIES) {
    if (category.patterns.some((p) => typeId.includes(p))) {
      return category.points;
    }
  }

  return SOUND_POINTS.breakSoft;
}

const watcherStates = new Map();
const trackedWatchers = new Map();
const playerProfiles = new Map();
const playerVhsStates = new Map();
const activePsychologicalWatchersByPlayer = new Map();
const activePsychologicalWatchersByDimension = new Map();

let cooldownObjective = undefined;
let bootstrapDone = false;
let systemEnabled = true;
let debugEnabled = false;
let blockCacheTick = -1;
let blockCache = new Map();
let nextProfileSaveCheckTick = 0;
const psychologicalCooldownUntilByPlayer = new Map();
const debugWatcherFailureReasonByPlayer = new Map();

const debugStats = {
  blockReads: 0,
  blockReadFailures: 0,
  losChecks: 0,
  failedTeleports: 0,
  failedParticles: 0,
  failedPropertySets: 0,
  failedEffects: 0,
  noValidSpot: 0,
  ambushesStarted: 0,
  ambushesHit: 0,
  ambushesNearMiss: 0,
  ambushesFakeout: 0,
  ambushesMinorDamage: 0,
  minorEvents: 0,
  psychologicalEvents: 0,
  psychologicalEscalations: 0,
  psychologicalNoEncounter: 0,
  psychologicalDirectChase: 0,
  profileLoadFailures: 0,
  profileSaveFailures: 0,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function incrementDebugStat(name, amount = 1) {
  if (Object.prototype.hasOwnProperty.call(debugStats, name)) {
    debugStats[name] += amount;
  }
}

function resetDebugStats() {
  for (const key of Object.keys(debugStats)) {
    debugStats[key] = 0;
  }
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
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

function cloneLocation(location) {
  return {
    x: Number(location.x),
    y: Number(location.y),
    z: Number(location.z),
  };
}

function centerBlock(location) {
  return {
    x: Math.floor(location.x) + 0.5,
    y: Math.floor(location.y),
    z: Math.floor(location.z) + 0.5,
  };
}

function distanceSquared(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

function distance(a, b) {
  return Math.sqrt(distanceSquared(a, b));
}

function normalize(vector) {
  const length = Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z);
  if (!length) {
    return { x: 0, y: 0, z: 0 };
  }

  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length,
  };
}

function horizontal(vector) {
  return normalize({ x: vector.x, y: 0, z: vector.z });
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function getDimensionById(dimensionId) {
  try {
    return world.getDimension(/** @type {any} */ (dimensionId));
  } catch (_error) {
    return undefined;
  }
}

function getDimensionMinY(dimension) {
  try {
    if (dimension.heightRange && typeof dimension.heightRange.min === "number") {
      return dimension.heightRange.min;
    }
  } catch (_error) {
    // Fall through.
  }

  return DEFAULT_MIN_Y;
}

function getDimensionMaxY(dimension) {
  try {
    if (dimension.heightRange && typeof dimension.heightRange.max === "number") {
      return dimension.heightRange.max;
    }
  } catch (_error) {
    // Fall through.
  }

  return DEFAULT_MAX_Y;
}

function clampBlockY(dimension, y) {
  return clamp(Math.floor(y), getDimensionMinY(dimension), getDimensionMaxY(dimension));
}

function safeBlockPos(dimension, location) {
  return {
    x: Math.floor(location.x),
    y: clampBlockY(dimension, location.y),
    z: Math.floor(location.z),
  };
}

function safeGetBlock(dimension, location) {
  if (!dimension || !location) {
    return undefined;
  }

  const pos = safeBlockPos(dimension, location);
  const currentTick = system.currentTick || 0;
  if (blockCacheTick !== currentTick) {
    blockCacheTick = currentTick;
    blockCache.clear();
  }

  const key = `${dimension.id}|${pos.x}|${pos.y}|${pos.z}`;
  if (blockCache.has(key)) {
    return blockCache.get(key);
  }

  try {
    incrementDebugStat("blockReads");
    const block = dimension.getBlock(pos);
    blockCache.set(key, block);
    return block;
  } catch (_error) {
    incrementDebugStat("blockReadFailures");
    blockCache.set(key, undefined);
    return undefined;
  }
}

function isEntityValid(entity) {
  if (!entity) {
    return false;
  }

  try {
    if (typeof entity.isValid === "function") {
      return entity.isValid();
    }

    return entity.isValid !== false;
  } catch (_error) {
    return false;
  }
}

function dimensionIdOf(dimension) {
  try {
    return dimension && typeof dimension.id === "string" ? dimension.id : "";
  } catch (_error) {
    return "";
  }
}

function isAllowedStalkerDimension(dimension) {
  const dimensionId = dimensionIdOf(dimension);
  return !!dimensionId && ALLOWED_STALKER_DIMENSION_IDS.has(dimensionId);
}

function isSupportedDimension(dimension) {
  return isAllowedStalkerDimension(dimension);
}

function isLibraryDimension(dimension) {
  return dimensionIdOf(dimension) === LIBRARY_DIMENSION_ID;
}

function isBurningHighwayDimension(dimension) {
  return dimensionIdOf(dimension) === BURNING_HIGHWAY_DIMENSION_ID;
}

function getPhaseRangeForPlayer(player, phase) {
  if (player && isLibraryDimension(player.dimension)) {
    return LIBRARY_PHASE_RANGES[phase] || LIBRARY_PHASE_RANGES.shadow;
  }

  return CONFIG.ranges[phase] || CONFIG.ranges.shadow;
}

function hasTagSafe(entity, tag) {
  try {
    return !!entity && typeof entity.hasTag === "function" && entity.hasTag(tag);
  } catch (_error) {
    return false;
  }
}

function isBurningHighwaySequenceWatcher(entity) {
  try {
    return isWatcherEntity(entity) && isBurningHighwayDimension(entity.dimension) && hasTagSafe(entity, BURNING_HIGHWAY_SEQUENCE_WATCHER_TAG);
  } catch (_error) {
    return false;
  }
}

function isInterestingPlayer(player) {
  return !!player &&
    player.typeId === "minecraft:player" &&
    isSupportedDimension(player.dimension) &&
    !isBurningHighwayDimension(player.dimension);
}

function isValidWatcherDebugPlayer(player) {
  return !!player &&
    player.typeId === "minecraft:player" &&
    !!player.dimension &&
    typeof player.dimension.id === "string" &&
    player.dimension.id.length > 0;
}

function isWatcherEntity(entity) {
  return !!entity && entity.typeId === CONFIG.watcherTypeId;
}

function getPlayerById(playerId) {
  return getCachedPlayerById(playerId);
}

function getEyeLocation(entity) {
  try {
    if (typeof entity.getHeadLocation === "function") {
      return entity.getHeadLocation();
    }
  } catch (_error) {
    // Fall back below.
  }

  return addVec(entity.location, 0, 1.55, 0);
}

function getViewDirection(entity) {
  try {
    if (typeof entity.getViewDirection === "function") {
      return entity.getViewDirection();
    }
  } catch (_error) {
    // Fall back below.
  }

  return { x: 0, y: 0, z: 1 };
}

function isAirBlock(block) {
  if (!block) {
    return true;
  }

  try {
    if (typeof block.isAir === "boolean") {
      return block.isAir;
    }
  } catch (_error) {
    // Fall through.
  }

  return String(block.typeId || "").includes("air");
}

function blockTypeId(block) {
  return String((block && block.typeId) || "");
}

function containsPattern(typeId, patterns) {
  return patterns.some((pattern) => typeId.includes(pattern));
}

function isDangerBlock(block) {
  return containsPattern(blockTypeId(block), DANGER_BLOCK_PATTERNS);
}

function isTransparentBlock(block) {
  if (!block || isAirBlock(block)) {
    return true;
  }

  return containsPattern(blockTypeId(block), TRANSPARENT_PATTERNS);
}

function isPassableBlock(block) {
  if (!block || isAirBlock(block)) {
    return true;
  }

  const typeId = blockTypeId(block);
  if (typeId.includes("water") || typeId.includes("lava")) {
    return false;
  }

  if (containsPattern(typeId, DANGER_BLOCK_PATTERNS)) {
    return false;
  }

  return containsPattern(typeId, PASSABLE_PATTERNS);
}

function isSolidSupportBlock(block) {
  if (!block || isAirBlock(block)) {
    return false;
  }

  const typeId = blockTypeId(block);
  if (containsPattern(typeId, DANGER_BLOCK_PATTERNS)) {
    return false;
  }

  if (containsPattern(typeId, PASSABLE_PATTERNS)) {
    return false;
  }

  return !containsPattern(typeId, ["water", "lava", "cobweb", "web"]);
}

function getLightLevel(dimension, location) {
  try {
    if (typeof dimension.getLightLevel === "function") {
      return dimension.getLightLevel(safeBlockPos(dimension, location));
    }
  } catch (_error) {
    // Some API versions or unloaded blocks reject this.
  }

  return 15;
}

function hasLineOfSight(dimension, from, to) {
  incrementDebugStat("losChecks");

  const delta = {
    x: to.x - from.x,
    y: to.y - from.y,
    z: to.z - from.z,
  };
  const totalDistance = Math.sqrt(delta.x * delta.x + delta.y * delta.y + delta.z * delta.z);

  if (!totalDistance) {
    return true;
  }

  if (totalDistance > CONFIG.maxLineOfSightDistance) {
    return false;
  }

  const steps = Math.max(1, Math.ceil(totalDistance / CONFIG.lineOfSightStep));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const sample = {
      x: from.x + delta.x * t,
      y: from.y + delta.y * t,
      z: from.z + delta.z * t,
    };
    const block = safeGetBlock(dimension, sample);
    if (!isTransparentBlock(block)) {
      return false;
    }
  }

  return true;
}

function isPlayerLookingAtLocation(player, location, focusThreshold = 0.54) {
  const eye = getEyeLocation(player);
  const view = normalize(getViewDirection(player));
  const toTarget = normalize({
    x: location.x - eye.x,
    y: location.y - eye.y,
    z: location.z - eye.z,
  });

  if (dot(view, toTarget) < focusThreshold) {
    return false;
  }

  return hasLineOfSight(player.dimension, eye, location);
}

function isPlayerLookingAtWatcher(player, watcher) {
  return isPlayerLookingAtLocation(player, getEyeLocation(watcher), 0.5);
}

function getNowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function getCooldownUntilSeconds(player) {
  if (!cooldownObjective || !player) {
    return 0;
  }

  try {
    const participant = player.scoreboardIdentity || player;
    const score = cooldownObjective.getScore(participant);
    return typeof score === "number" ? score : 0;
  } catch (_error) {
    return 0;
  }
}

function setCooldownUntilSeconds(player, seconds) {
  if (!cooldownObjective || !player) {
    return;
  }

  try {
    const participant = player.scoreboardIdentity || player;
    cooldownObjective.setScore(participant, seconds);
  } catch (_error) {
    // Scoreboard cooldown is best effort; in-memory vanish still works.
  }
}

function isPlayerOnCooldown(player) {
  return getNowSeconds() < getCooldownUntilSeconds(player);
}

function markPlayerCooldown(player) {
  markPlayerCooldownSeconds(player, CONFIG.playerCooldownSeconds);
}

function markPlayerCooldownSeconds(player, seconds) {
  setCooldownUntilSeconds(player, getNowSeconds() + seconds);
}

function getRouteCellKey(dimensionId, location) {
  const cellSize = CONFIG.routeCellSize;
  const pos = toBlockPos(location);
  return `${dimensionId}|${Math.floor(pos.x / cellSize)}|${Math.floor(pos.z / cellSize)}`;
}

function getRouteCellCenter(location) {
  const cellSize = CONFIG.routeCellSize;
  const pos = toBlockPos(location);
  return {
    x: Math.floor(pos.x / cellSize) * cellSize + cellSize / 2,
    y: pos.y,
    z: Math.floor(pos.z / cellSize) * cellSize + cellSize / 2,
  };
}

function serializeCell(cell) {
  return {
    key: cell.key,
    dimensionId: cell.dimensionId,
    center: cell.center,
    visits: Math.floor(cell.visits || 0),
    routeScore: Math.floor(cell.routeScore || 0),
    activityScore: Math.floor(cell.activityScore || 0),
    spawnScore: Math.floor(cell.spawnScore || 0),
    lastTick: Math.floor(cell.lastTick || 0),
  };
}

function loadProfileMemory(player, profile) {
  if (!player || typeof player.getDynamicProperty !== "function") {
    return;
  }

  try {
    const raw = player.getDynamicProperty(CONFIG.memoryDynamicPropertyId);
    if (typeof raw !== "string" || !raw.length) {
      return;
    }

    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") {
      return;
    }

    profile.heat = clamp(Number(data.heat) || 0, 0, 100);
    profile.fear = clamp(Number(data.fear) || 0, 0, 100);
    profile.encounterCount = Math.max(0, Math.floor(Number(data.encounterCount) || 0));
    profile.fakeoutCount = Math.max(0, Math.floor(Number(data.fakeoutCount) || 0));
    profile.nearMissCount = Math.max(0, Math.floor(Number(data.nearMissCount) || 0));
    profile.minorDamageCount = Math.max(0, Math.floor(Number(data.minorDamageCount) || 0));
    profile.ambushHitCount = Math.max(0, Math.floor(Number(data.ambushHitCount) || 0));
    profile.attackDebt = Math.max(0, Math.floor(Number(data.attackDebt) || 0));

    if (Array.isArray(data.cells)) {
      for (const saved of data.cells.slice(0, CONFIG.maxPersistedCells)) {
        if (!saved || !saved.key || !saved.dimensionId || !saved.center) {
          continue;
        }

        profile.cells.set(saved.key, {
          key: String(saved.key),
          dimensionId: String(saved.dimensionId),
          center: {
            x: Number(saved.center.x) || 0,
            y: Number(saved.center.y) || 64,
            z: Number(saved.center.z) || 0,
          },
          visits: Math.max(0, Math.floor(Number(saved.visits) || 0)),
          routeScore: Math.max(0, Math.floor(Number(saved.routeScore) || 0)),
          activityScore: Math.max(0, Math.floor(Number(saved.activityScore) || 0)),
          spawnScore: Math.max(0, Math.floor(Number(saved.spawnScore) || 0)),
          lastTick: Math.max(0, Math.floor(Number(saved.lastTick) || 0)),
          activityTypes: new Set(),
          timeOfDayScore: new Map(),
        });
      }
    }

    updateProfileDerivedCells(profile, system.currentTick || 0);
  } catch (_error) {
    incrementDebugStat("profileLoadFailures");
  }
}

function saveProfileMemory(profile, force = false) {
  if (!profile) {
    return;
  }

  const currentTick = system.currentTick || 0;
  if (!force && currentTick - profile.lastProfileSaveTick < CONFIG.profileSaveInterval) {
    return;
  }

  const player = getPlayerById(profile.playerId);
  if (!player || typeof player.setDynamicProperty !== "function") {
    return;
  }

  try {
    const cells = [...profile.cells.values()]
      .sort((a, b) => scoreCell(b, currentTick) - scoreCell(a, currentTick))
      .slice(0, CONFIG.maxPersistedCells)
      .map(serializeCell);

    player.setDynamicProperty(
      CONFIG.memoryDynamicPropertyId,
      JSON.stringify({
        version: 2,
        savedAt: getNowSeconds(),
        heat: Math.floor(profile.heat),
        fear: Math.floor(profile.fear),
        encounterCount: profile.encounterCount || 0,
        fakeoutCount: profile.fakeoutCount || 0,
        nearMissCount: profile.nearMissCount || 0,
        minorDamageCount: profile.minorDamageCount || 0,
        ambushHitCount: profile.ambushHitCount || 0,
        attackDebt: profile.attackDebt || 0,
        cells,
      }),
    );
    profile.lastProfileSaveTick = currentTick;
  } catch (_error) {
    incrementDebugStat("profileSaveFailures");
  }
}

function getProfileSaveDueTick(profile) {
  return (profile?.lastProfileSaveTick || 0) + CONFIG.profileSaveInterval;
}

function requestProfileSaveCheck(profile) {
  const dueTick = getProfileSaveDueTick(profile);
  if (nextProfileSaveCheckTick === 0 || dueTick < nextProfileSaveCheckTick) {
    nextProfileSaveCheckTick = dueTick;
  }
}

function saveDueProfiles(currentTick) {
  if (currentTick < nextProfileSaveCheckTick) {
    return;
  }

  let nextDueTick = currentTick + CONFIG.profileSaveInterval;
  for (const profile of playerProfiles.values()) {
    if (getProfileSaveDueTick(profile) <= currentTick) {
      saveProfileMemory(profile, false);
    }

    const refreshedDueTick = getProfileSaveDueTick(profile);
    if (refreshedDueTick < nextDueTick) {
      nextDueTick = refreshedDueTick;
    }
  }

  nextProfileSaveCheckTick = nextDueTick;
}

function getProfile(player) {
  let profile = playerProfiles.get(player.id);
  if (!profile) {
    profile = {
      playerId: player.id,
      name: player.name,
      heat: 0,
      fear: 0,
      lastSeenTick: 0,
      lastHeatTick: 0,
      lastFearTick: 0,
      lastSampleTick: 0,
      lastHeavySampleTick: 0,
      lastKnownLocation: cloneLocation(player.location),
      lastKnownDimensionId: player.dimension.id,
      lastMovementDistance: 0,
      cells: new Map(),
      primaryCell: undefined,
      baseCell: undefined,
      routeCell: undefined,
      velocityHistory: [],
      currentVelocity: { x: 0, y: 0, z: 0 },
      behaviorMode: BEHAVIOR_MODE.Idle,
      behaviorModeTicks: 0,
      lastHealth: undefined,
      lastVelocitySampleTick: 0,
      timePatterns: new Map(),
      recentAnchorKeys: new Map(),
      soundScore: 0,
      lastSoundDecayTick: 0,
      lastMovementSoundTick: 0,
      lastLoudCombatTick: 0,
      suspicion: 0,
      suspicionPhase: SUSPICION_PHASE.Quiet,
      lastSuspicionTick: system.currentTick || 0,
      lastSuspiciousActionTicks: new Map(),
      lastNoiseTick: 0,
      lastWarningCueTick: 0,
      warningCueUntilTick: 0,
      tensionState: TENSION.Quiet,
      tensionStartedTick: system.currentTick || 0,
      tensionNextTransitionTick: (system.currentTick || 0) + randomInt(TENSION_CONFIG.quietMinTicks, TENSION_CONFIG.quietMinTicks + 20 * 45),
      reliefUntilTick: 0,
      peakMajorUsed: false,
      lastMajorScareTick: 0,
      lastSpawnAttemptTick: -999999,
      lastSuccessfulSpawnTick: -999999,
      lastPresenceCueTick: -999999,
      lastPresenceCueStage: "none",
      psychologicalSuppressChaseUntilTick: 0,
      nextPsychologicalDecisionTick: 0,
      lastPsychologicalTick: -999999,
      lastPsychologicalType: undefined,
      psychologicalTypeCooldowns: new Map(),
      psychologicalActiveCount: 0,
      passiveHeatAccumulator: 0,
      lastContextHeatTick: 0,
      lastProfileSaveTick: 0,
      lastMinorHorrorTick: 0,
      encounterCount: 0,
      fakeoutCount: 0,
      nearMissCount: 0,
      minorDamageCount: 0,
      ambushHitCount: 0,
      attackDebt: 0,
      antiCombatHits: 0,
      lastAntiCombatMessageTick: -999999,
      antiCombatAggression: 0,
      lastWatcherHitTick: -999999,
      lastAntiCombatTick: -999999,
      lastAntiCombatPanicTick: -999999,
      lastViewDirection: horizontal(getViewDirection(player)),
      previousViewDirection: horizontal(getViewDirection(player)),
      lastViewSampleTick: system.currentTick || 0,
      lastTurnaroundTick: -999999,
      lastLookAwayTick: -999999,
      lastHeardByWatcherTick: -999999,
      adaptive: createAdaptiveProfile(system.currentTick || 0),
    };
    loadProfileMemory(player, profile);
    playerProfiles.set(player.id, profile);
    requestProfileSaveCheck(profile);
  }

  ensurePsychologicalProfileState(profile, player);

  return profile;
}

function ensurePsychologicalProfileState(profile, player) {
  if (!profile) {
    return;
  }

  if (!(profile.psychologicalTypeCooldowns instanceof Map)) {
    profile.psychologicalTypeCooldowns = new Map();
  }
  if (typeof profile.psychologicalSuppressChaseUntilTick !== "number") {
    profile.psychologicalSuppressChaseUntilTick = 0;
  }
  if (typeof profile.nextPsychologicalDecisionTick !== "number") {
    profile.nextPsychologicalDecisionTick = 0;
  }
  if (typeof profile.lastPsychologicalTick !== "number") {
    profile.lastPsychologicalTick = -999999;
  }
  if (typeof profile.psychologicalActiveCount !== "number") {
    profile.psychologicalActiveCount = 0;
  }
  if (typeof profile.minorDamageCount !== "number") {
    profile.minorDamageCount = 0;
  }
  if (typeof profile.attackDebt !== "number") {
    profile.attackDebt = 0;
  }
  if (typeof profile.lastAntiCombatMessageTick !== "number") {
    profile.lastAntiCombatMessageTick = -999999;
  }
  if (!profile.lastViewDirection && player) {
    profile.lastViewDirection = horizontal(getViewDirection(player));
  }
  if (!profile.previousViewDirection && profile.lastViewDirection) {
    profile.previousViewDirection = { ...profile.lastViewDirection };
  }
  if (typeof profile.lastViewSampleTick !== "number") {
    profile.lastViewSampleTick = system.currentTick || 0;
  }
  if (typeof profile.lastTurnaroundTick !== "number") {
    profile.lastTurnaroundTick = -999999;
  }
  if (typeof profile.lastLookAwayTick !== "number") {
    profile.lastLookAwayTick = -999999;
  }
  if (typeof profile.lastPresenceCueTick !== "number") {
    profile.lastPresenceCueTick = -999999;
  }
  if (typeof profile.lastPresenceCueStage !== "string") {
    profile.lastPresenceCueStage = "none";
  }
  if (typeof profile.lastHeardByWatcherTick !== "number") {
    profile.lastHeardByWatcherTick = -999999;
  }
  if (!profile.adaptive || !profile.adaptive.traits || !(profile.adaptive.lastTacticTicks instanceof Map)) {
    profile.adaptive = createAdaptiveProfile(system.currentTick || 0);
  }
}

function getCell(profile, dimensionId, location) {
  const key = getRouteCellKey(dimensionId, location);
  let cell = profile.cells.get(key);
  if (!cell) {
    cell = {
      key,
      dimensionId,
      center: getRouteCellCenter(location),
      visits: 0,
      routeScore: 0,
      activityScore: 0,
      spawnScore: 0,
      lastTick: 0,
      activityTypes: new Set(),
      timeOfDayScore: new Map(),
    };
    profile.cells.set(key, cell);
  }

  cell.center.y = Math.floor(location.y);
  return cell;
}

function scoreCell(cell, currentTick = system.currentTick) {
  if (!cell) {
    return 0;
  }

  const ageTicks = Math.max(0, currentTick - cell.lastTick);
  const recency = clamp(12 - Math.floor(ageTicks / (20 * 60)), 0, 12);
  const todScore = getTimeOfDayScore(cell, currentTick);
  return cell.visits + cell.routeScore * 2 + cell.activityScore * 4 + cell.spawnScore * 5 + recency + todScore;
}

function updateProfileDerivedCells(profile, currentTick) {
  const ranked = [...profile.cells.values()].sort((a, b) => scoreCell(b, currentTick) - scoreCell(a, currentTick));
  profile.primaryCell = ranked[0];
  profile.routeCell = ranked.find((cell) => cell.routeScore >= 5) || ranked[1] || ranked[0];
  profile.baseCell =
    ranked.find((cell) => cell.activityScore >= 10 || cell.spawnScore >= 4) ||
    ranked.find((cell) => scoreCell(cell, currentTick) >= 26) ||
    ranked[0];
}

function increaseHeat(profile, amount) {
  profile.heat = clamp(profile.heat + amount, 0, 100);
  profile.lastHeatTick = system.currentTick;
}

function increaseFear(profile, amount) {
  profile.fear = clamp(profile.fear + amount, 0, 100);
  profile.lastFearTick = system.currentTick;
}

function decayProfile(profile, currentTick) {
  if (profile.heat > 0 && currentTick - profile.lastHeatTick >= CONFIG.heatDecayInterval) {
    profile.heat = clamp(profile.heat - CONFIG.heatDecayAmount, 0, 100);
    profile.lastHeatTick = currentTick;
  }

  if (profile.fear > 0 && currentTick - profile.lastFearTick >= CONFIG.fearDecayInterval) {
    profile.fear = clamp(profile.fear - CONFIG.fearDecayAmount, 0, 100);
    profile.lastFearTick = currentTick;
  }

  if (profile.soundScore > 0 && currentTick - profile.lastSoundDecayTick >= CONFIG.soundScoreDecayInterval) {
    profile.soundScore = clamp(profile.soundScore - CONFIG.soundScoreDecayAmount, 0, CONFIG.soundScoreMax);
    profile.lastSoundDecayTick = currentTick;
  }

  if (
    profile.antiCombatAggression > 0 &&
    currentTick - profile.lastAntiCombatTick >= CONFIG.antiCombat.aggressionDecayTicks
  ) {
    profile.antiCombatAggression = clamp(
      profile.antiCombatAggression - CONFIG.antiCombat.aggressionDecayAmount,
      0,
      12,
    );
    profile.antiCombatHits = Math.min(profile.antiCombatHits || 0, profile.antiCombatAggression);
    profile.lastAntiCombatTick = currentTick;
  }
}

function getCurrentHour() {
  try {
    const time = world.getTimeOfDay ? world.getTimeOfDay() : 0;
    return Math.floor((time % 24000) / 1000);
  } catch (_error) {
    return 0;
  }
}

function updateVelocityTracking(player, profile, currentTick, previousLocation, previousTick) {
  if (currentTick - profile.lastVelocitySampleTick < CONFIG.velocitySampleInterval) {
    return;
  }
  profile.lastVelocitySampleTick = currentTick;

  const prev = previousLocation || profile.lastKnownLocation || player.location;
  const curr = cloneLocation(player.location);
  const dt = Math.max(1, currentTick - (previousTick || currentTick - CONFIG.memorySampleInterval)) / 20;
  const velocity = {
    x: (curr.x - prev.x) / dt,
    y: (curr.y - prev.y) / dt,
    z: (curr.z - prev.z) / dt,
  };

  profile.velocityHistory.push(velocity);
  if (profile.velocityHistory.length > CONFIG.velocitySampleWindow) {
    profile.velocityHistory.shift();
  }

  const avg = { x: 0, y: 0, z: 0 };
  for (const v of profile.velocityHistory) {
    avg.x += v.x;
    avg.y += v.y;
    avg.z += v.z;
  }
  const n = profile.velocityHistory.length || 1;
  profile.currentVelocity = {
    x: avg.x / n,
    y: avg.y / n,
    z: avg.z / n,
  };
}

function updateLookTracking(player, profile, currentTick) {
  if (!player || !profile) {
    return;
  }

  const currentView = horizontal(getViewDirection(player));
  if (!currentView.x && !currentView.z) {
    return;
  }

  ensurePsychologicalProfileState(profile, player);
  const previous = profile.lastViewDirection || currentView;
  const alignment = dot(currentView, previous);

  if (alignment < -0.12) {
    profile.lastTurnaroundTick = currentTick;
  } else if (alignment < 0.35) {
    profile.lastLookAwayTick = currentTick;
  }

  profile.previousViewDirection = { ...previous };
  profile.lastViewDirection = currentView;
  profile.lastViewSampleTick = currentTick;
  observeAdaptiveLook(profile.adaptive, alignment, currentTick);
}

function classifyBehaviorMode(player, profile, currentTick) {
  let health = undefined;
  try {
    health = player.getComponent ? player.getComponent("minecraft:health") : undefined;
    if (health && typeof health.currentValue === "number") {
      health = health.currentValue;
    }
  } catch (_error) {
    // Fallback below.
  }

  const speed = Math.sqrt(
    profile.currentVelocity.x * profile.currentVelocity.x +
    profile.currentVelocity.z * profile.currentVelocity.z
  );

  const prevHealth = profile.lastHealth;
  profile.lastHealth = health;

  if (prevHealth !== undefined && health !== undefined && health < prevHealth - 2) {
    return BEHAVIOR_MODE.Combat;
  }

  if (speed > 5.5) {
    return BEHAVIOR_MODE.Fleeing;
  }

  if (speed < 0.3) {
    return BEHAVIOR_MODE.Idle;
  }

  if (speed < 2.5) {
    return BEHAVIOR_MODE.Building;
  }

  return BEHAVIOR_MODE.Exploring;
}

function updateBehaviorMode(player, profile, currentTick) {
  const newMode = classifyBehaviorMode(player, profile, currentTick);
  if (profile.behaviorMode === newMode) {
    profile.behaviorModeTicks += 1;
  } else {
    profile.behaviorMode = newMode;
    profile.behaviorModeTicks = 1;
  }
}

function updateTimePattern(profile, cell, currentTick) {
  const hour = getCurrentHour();
  cell.timeOfDayScore.set(hour, (cell.timeOfDayScore.get(hour) || 0) + 1);
}

function getTimeOfDayScore(cell, currentTick) {
  if (!cell || !cell.timeOfDayScore) {
    return 0;
  }
  const hour = getCurrentHour();
  return (cell.timeOfDayScore.get(hour) || 0) * 2;
}

function getPredictedLocation(player, profile) {
  const v = profile.currentVelocity;
  if (!v || (Math.abs(v.x) < 0.05 && Math.abs(v.z) < 0.05)) {
    return cloneLocation(player.location);
  }

  return {
    x: player.location.x + v.x * CONFIG.predictiveSeconds,
    y: clamp(player.location.y + v.y * CONFIG.predictiveSeconds, -64, 319),
    z: player.location.z + v.z * CONFIG.predictiveSeconds,
  };
}

function countEscapeRoutes(dimension, spot) {
  const offsets = [
    { x: 1, y: 0, z: 0 },
    { x: -1, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 0, z: -1 },
    { x: 1, y: 1, z: 0 },
    { x: -1, y: 1, z: 0 },
    { x: 0, y: 1, z: 1 },
    { x: 0, y: 1, z: -1 },
  ];
  let routes = 0;
  for (const offset of offsets) {
    const neighbor = addVec(spot, offset.x, offset.y, offset.z);
    const feet = safeGetBlock(dimension, neighbor);
    const head = safeGetBlock(dimension, addVec(neighbor, 0, 1, 0));
    if (isPassableBlock(feet) && isPassableBlock(head)) {
      routes += 1;
    }
  }
  return routes;
}

function hasOverheadCover(dimension, spot) {
  for (let dy = 2; dy <= 3; dy++) {
    const block = safeGetBlock(dimension, addVec(spot, 0, dy, 0));
    if (block && !isTransparentBlock(block)) {
      return true;
    }
  }
  return false;
}

function isChokePoint(spot, player, anchorLocation) {
  if (!anchorLocation) {
    return false;
  }
  const toAnchor = normalize({
    x: anchorLocation.x - player.location.x,
    y: anchorLocation.y - player.location.y,
    z: anchorLocation.z - player.location.z,
  });
  const toSpot = normalize({
    x: spot.x - player.location.x,
    y: spot.y - player.location.y,
    z: spot.z - player.location.z,
  });
  const alignment = dot(toAnchor, toSpot);
  return alignment > 0.45 && distance(player.location, spot) > distance(anchorLocation, player.location) * 0.3;
}

function getSquadWatchers(targetPlayerId, excludeEntityId) {
  const squad = [];
  for (const entity of getTrackedWatchers()) {
    if (entity.id === excludeEntityId) {
      continue;
    }
    const state = getState(entity);
    if (state.targetPlayerId === targetPlayerId && state.phase !== PHASE.Vanish && state.phase !== PHASE.Dormant) {
      squad.push({ entity, state });
    }
  }
  return squad;
}

function assignSquadRole(entityId, squad, phase) {
  const roleCount = { observer: 0, flanker: 0, ambusher: 0 };
  for (const member of squad) {
    if (member.state.squadRole) {
      roleCount[member.state.squadRole] = (roleCount[member.state.squadRole] || 0) + 1;
    }
  }

  if (phase === PHASE.Ambush) {
    return SQUAD_ROLE.Ambusher;
  }

  if (phase === PHASE.Observe || roleCount.observer === 0) {
    return SQUAD_ROLE.Observer;
  }

  if (roleCount.flanker === 0) {
    return SQUAD_ROLE.Flanker;
  }

  return SQUAD_ROLE.Ambusher;
}

function getSquadAnchor(profile, squad, phase, myRole) {
  if (!squad.length) {
    return chooseAnchor(profile, phase);
  }

  if (myRole === SQUAD_ROLE.Observer) {
    return profile.primaryCell || profile.routeCell;
  }

  if (myRole === SQUAD_ROLE.Flanker) {
    return profile.routeCell || profile.baseCell || profile.primaryCell;
  }

  return profile.baseCell || profile.primaryCell;
}

function getRevisitPenalty(state, anchorKey) {
  if (!anchorKey || !state.recentSpots) {
    return 0;
  }
  const lastVisit = state.recentSpots.get(anchorKey);
  if (!lastVisit) {
    return 0;
  }
  const elapsed = system.currentTick - lastVisit;
  if (elapsed < CONFIG.revisitPenaltyTicks) {
    return CONFIG.revisitPenaltyScore * (1 - elapsed / CONFIG.revisitPenaltyTicks);
  }
  return 0;
}

function recordSpotVisit(state, anchorKey) {
  if (!state.recentSpots) {
    state.recentSpots = new Map();
  }
  state.recentSpots.set(anchorKey, system.currentTick);
}

function activityWeightForBlock(typeId) {
  if (!typeId) {
    return 0;
  }

  if (ACTIVITY_WEIGHTS.has(typeId)) {
    return ACTIVITY_WEIGHTS.get(typeId);
  }

  if (typeId.endsWith("_bed")) {
    return 9;
  }

  if (typeId.includes("chest")) {
    return 8;
  }

  if (typeId.includes("furnace") || typeId.includes("anvil")) {
    return 7;
  }

  return 0;
}

function getSpawnPointLocation(player) {
  try {
    const spawnPoint = player.getSpawnPoint();
    if (spawnPoint && spawnPoint.dimension) {
      return {
        dimensionId: spawnPoint.dimension.id,
        location: {
          x: spawnPoint.x,
          y: spawnPoint.y,
          z: spawnPoint.z,
        },
      };
    }
  } catch (_error) {
    // Players can have no personal spawn point.
  }

  return undefined;
}

function sampleActivityBlocks(player, profile, currentTick, strongSample) {
  const dimension = player.dimension;
  const origin = toBlockPos(player.location);
  const radius = CONFIG.activityScanRadius;
  const attempts = strongSample ? 72 : 30;
  let foundWeight = 0;

  for (let i = 0; i < attempts; i++) {
    const location = {
      x: origin.x + randomInt(-radius, radius),
      y: origin.y + randomInt(-2, 2),
      z: origin.z + randomInt(-radius, radius),
    };
    const block = safeGetBlock(dimension, location);
    const typeId = blockTypeId(block);
    const weight = activityWeightForBlock(typeId);

    if (weight <= 0) {
      continue;
    }

    const cell = getCell(profile, dimension.id, location);
    cell.activityScore += strongSample ? weight : Math.max(1, Math.ceil(weight / 3));
    cell.visits += 1;
    cell.lastTick = currentTick;
    cell.activityTypes.add(typeId);
    foundWeight += weight;
  }

  if (foundWeight > 0) {
    increaseHeat(profile, CONFIG.activityHeat + Math.min(10, Math.ceil(foundWeight / 10)));
  }
}

function samplePlayerMemory(player, currentTick, strongSample = false) {
  if (!isInterestingPlayer(player)) {
    return undefined;
  }

  const profile = getProfile(player);
  const previousLocation = cloneLocation(profile.lastKnownLocation || player.location);
  const previousTick = profile.lastSampleTick || Math.max(0, currentTick - CONFIG.memorySampleInterval);
  const movement = previousLocation && profile.lastKnownDimensionId === player.dimension.id
    ? distance(previousLocation, player.location)
    : 0;

  profile.name = player.name;
  profile.lastSeenTick = currentTick;
  updateVelocityTracking(player, profile, currentTick, previousLocation, previousTick);
  updateLookTracking(player, profile, currentTick);
  profile.lastSampleTick = currentTick;
  profile.lastKnownLocation = cloneLocation(player.location);
  profile.lastKnownDimensionId = player.dimension.id;
  profile.lastMovementDistance = movement;
  updateBehaviorMode(player, profile, currentTick);
  classifyAndApplyMovementSound(player, profile, currentTick);

  if (
    profile.behaviorMode === BEHAVIOR_MODE.Combat &&
    profile.behaviorModeTicks >= 40 &&
    currentTick - profile.lastLoudCombatTick >= CONFIG.loudCombatCooldownTicks &&
    isPlayerHeardByWatcher(player)
  ) {
    addSoundScore(profile, SOUND_POINTS.loudCombat);
    profile.lastLoudCombatTick = currentTick;
  }

  const cell = getCell(profile, player.dimension.id, player.location);
  cell.visits += strongSample ? 2 : 1;
  cell.routeScore += movement > 3 ? 2 : 1;
  cell.lastTick = currentTick;
  updateTimePattern(profile, cell, currentTick);
  observeAdaptiveRoute(profile.adaptive, cell.key, currentTick);
  const adaptiveSpeed = Math.sqrt(
    profile.currentVelocity.x * profile.currentVelocity.x +
    profile.currentVelocity.z * profile.currentVelocity.z
  );
  observeAdaptiveMotionAfterExposure(
    profile.adaptive,
    adaptiveSpeed,
    movement,
    currentTick,
    { x: profile.currentVelocity.x, z: profile.currentVelocity.z },
    { isSneaking: isPlayerSneaking(player) },
  );
  decayAdaptiveProfile(profile.adaptive, currentTick);

  if (movement > 10) {
    increaseHeat(profile, CONFIG.movementHeat);
  }

  const spawnPoint = getSpawnPointLocation(player);
  if (spawnPoint && spawnPoint.dimensionId === player.dimension.id) {
    const spawnCell = getCell(profile, spawnPoint.dimensionId, spawnPoint.location);
    spawnCell.spawnScore += strongSample ? 4 : 1;
    spawnCell.lastTick = currentTick;
  }

  if (strongSample || currentTick - profile.lastHeavySampleTick >= CONFIG.heavyMemorySampleInterval) {
    profile.lastHeavySampleTick = currentTick;
    sampleActivityBlocks(player, profile, currentTick, strongSample);
  }

  updateProfileDerivedCells(profile, currentTick);
  syncSharedHorrorStateIntoProfile(player, profile, currentTick);
  decayProfile(profile, currentTick);
  decaySuspicion(player, profile, currentTick);
  advanceTension(profile, currentTick);
  return profile;
}

function syncSharedHorrorStateIntoProfile(player, profile, currentTick) {
  if (!player || !profile) {
    return;
  }

  try {
    const shared = getPlayerHorrorSnapshot(player, currentTick);
    profile.sharedFearScore = shared.fearScore;
    profile.sharedStalkerAttentionLevel = shared.stalkerAttentionLevel;
    profile.sharedPanicUntilTick = shared.panicUntilTick;
    profile.sharedFlashlightInterferenceUntilTick = shared.flashlightInterferenceUntilTick;

    if (shared.stalkerAttentionLevel >= 10) {
      const attentionHeat = Math.min(5, Math.floor(shared.stalkerAttentionLevel / 18));
      if (attentionHeat > 0 && currentTick - (profile.lastSharedAttentionHeatTick || 0) >= 20 * 18) {
        increaseHeat(profile, attentionHeat);
        profile.lastSharedAttentionHeatTick = currentTick;
      }
    }

    if (shared.fearScore >= 25 && currentTick - (profile.lastSharedFearBlendTick || 0) >= 20 * 24) {
      increaseFear(profile, Math.min(4, Math.floor(shared.fearScore / 25)));
      profile.lastSharedFearBlendTick = currentTick;
    }
  } catch (_error) {
  }
}

function getBehaviorAdjustedHeat(profile) {
  const boost = CONFIG.behaviorHeatBoost[profile.behaviorMode] || 1;
  return Math.floor(profile.heat * boost);
}

function getBehaviorAmbushBoost(profile) {
  return CONFIG.behaviorAmbushBoost[profile.behaviorMode] || 1;
}

function countNearbyPlayers(player, radius) {
  let count = 0;
  for (const other of getCachedPlayers()) {
    if (!isInterestingPlayer(other) || other.dimension.id !== player.dimension.id) {
      continue;
    }
    if (distance(player.location, other.location) <= radius) {
      count += 1;
    }
  }
  return count;
}

function getContextualPassiveHeat(player, profile, currentTick) {
  if (!player || !profile || currentTick - profile.lastContextHeatTick < CONFIG.passiveContextHeatInterval) {
    return 0;
  }

  profile.lastContextHeatTick = currentTick;

  let context = 0;
  const light = getLightLevel(player.dimension, player.location);
  const hour = getCurrentHour();
  const isNight = hour >= 13 || hour <= 5;

  if (light <= CONFIG.lightPreference) {
    context += 2;
  }
  if (isNight) {
    context += 1.5;
  }
  if (player.location.y < 50) {
    context += 1;
  }
  if (profile.soundScore >= 18) {
    context += 2;
  }
  if (profile.behaviorMode === BEHAVIOR_MODE.Idle && light <= CONFIG.lightPreference) {
    context += 1.5;
  }
  if (profile.baseCell && profile.baseCell.dimensionId === player.dimension.id && distance(player.location, profile.baseCell.center) <= 48) {
    context += isNight ? 2 : 1;
  }
  if (countNearbyPlayers(player, 96) <= 1) {
    context += 1;
  }

  if (context < 4) {
    return 0;
  }

  profile.passiveHeatAccumulator += context / 10;
  const amount = Math.min(2, Math.floor(profile.passiveHeatAccumulator));
  if (amount <= 0) {
    return 0;
  }

  profile.passiveHeatAccumulator -= amount;
  return amount;
}

function addSoundScore(profile, points) {
  if (points <= 0) {
    return;
  }

  profile.soundScore = clamp(profile.soundScore + points, 0, CONFIG.soundScoreMax);
}

function isPlayerSneaking(player) {
  try {
    return player && player.isSneaking === true;
  } catch (_error) {
    return false;
  }
}

function getProfilePressure(profile) {
  if (!profile) {
    return 0;
  }
  const soundBoost = Math.floor(profile.soundScore * 0.55);
  const suspicionBoost = Math.floor(profile.suspicion * 0.35);
  const sharedFear = Math.floor((profile.sharedFearScore || 0) * 0.20);
  const sharedAttention = Math.floor((profile.sharedStalkerAttentionLevel || 0) * 0.42);
  const fearBlend = Math.floor(profile.heat * 0.72 + profile.fear * 0.38 + sharedFear + sharedAttention);
  return clamp(Math.max(profile.heat, fearBlend) + soundBoost + suspicionBoost, 0, 100);
}

function setTension(profile, state, currentTick, durationTicks = 0) {
  if (!profile || profile.tensionState === state) {
    return;
  }
  profile.tensionState = state;
  profile.tensionStartedTick = currentTick;
  profile.tensionNextTransitionTick = durationTicks > 0 ? currentTick + durationTicks : currentTick;
  if (state === TENSION.Peak) {
    profile.peakMajorUsed = false;
  }
}

function enterRelief(profile, currentTick, reason = "relief") {
  if (!profile) {
    return;
  }
  const reliefTicks = randomInt(TENSION_CONFIG.reliefMinTicks, TENSION_CONFIG.reliefMaxTicks);
  profile.tensionState = TENSION.Relief;
  profile.tensionStartedTick = currentTick;
  profile.tensionNextTransitionTick = currentTick + reliefTicks;
  profile.reliefUntilTick = currentTick + reliefTicks;
  profile.peakMajorUsed = true;
  profile.lastMajorScareTick = currentTick;
  profile.suspicion = clamp(profile.suspicion - 28, 0, SUSPICION_CONFIG.max);
  profile.suspicionPhase = SUSPICION_PHASE.Quiet;
  profile.warningCueUntilTick = 0;
  profile.lastReliefReason = reason;
}

function advanceTension(profile, currentTick) {
  if (!profile) {
    return TENSION.Quiet;
  }

  const pressure = getProfilePressure(profile);
  if (profile.tensionState === TENSION.Relief) {
    if (currentTick < profile.reliefUntilTick) {
      return TENSION.Relief;
    }
    profile.reliefUntilTick = 0;
    setTension(profile, TENSION.Quiet, currentTick, randomInt(TENSION_CONFIG.quietMinTicks, TENSION_CONFIG.quietMinTicks + 20 * 45));
    return profile.tensionState;
  }

  if (profile.tensionState === TENSION.Peak) {
    if (profile.peakMajorUsed || currentTick >= profile.tensionNextTransitionTick) {
      enterRelief(profile, currentTick, profile.peakMajorUsed ? "peak-used" : "peak-expired");
    }
    return profile.tensionState;
  }

  if (profile.tensionState === TENSION.Quiet) {
    const quietFinished = currentTick >= profile.tensionNextTransitionTick;
    if (quietFinished && (pressure >= TENSION_CONFIG.buildupPressure || profile.suspicion >= SUSPICION_CONFIG.investigate)) {
      setTension(profile, TENSION.Buildup, currentTick, randomInt(TENSION_CONFIG.buildupMinTicks, TENSION_CONFIG.buildupMinTicks + 20 * 45));
    }
    return profile.tensionState;
  }

  if (profile.tensionState === TENSION.Buildup) {
    const buildupFinished = currentTick >= profile.tensionNextTransitionTick;
    if (buildupFinished && (pressure >= TENSION_CONFIG.peakPressure || profile.suspicion >= SUSPICION_CONFIG.warning)) {
      setTension(profile, TENSION.Peak, currentTick, TENSION_CONFIG.peakMaxTicks);
    }
    return profile.tensionState;
  }

  return profile.tensionState;
}

function updateSuspicionPhase(profile, currentTick) {
  if (!profile) {
    return SUSPICION_PHASE.Quiet;
  }
  if (profile.suspicion >= SUSPICION_CONFIG.attack && currentTick <= profile.warningCueUntilTick) {
    profile.suspicionPhase = SUSPICION_PHASE.AttackReady;
  } else if (profile.suspicion >= SUSPICION_CONFIG.warning && currentTick <= profile.warningCueUntilTick) {
    profile.suspicionPhase = SUSPICION_PHASE.Warned;
  } else if (profile.suspicion >= SUSPICION_CONFIG.spotted) {
    profile.suspicionPhase = SUSPICION_PHASE.Spotted;
  } else if (profile.suspicion >= SUSPICION_CONFIG.investigate) {
    profile.suspicionPhase = SUSPICION_PHASE.Investigate;
  } else {
    profile.suspicionPhase = SUSPICION_PHASE.Quiet;
  }
  return profile.suspicionPhase;
}

function decaySuspicion(player, profile, currentTick) {
  if (!profile || currentTick - profile.lastSuspicionTick < SUSPICION_CONFIG.decayIntervalTicks) {
    return;
  }
  profile.lastSuspicionTick = currentTick;
  const quietTicks = currentTick - Math.max(profile.lastNoiseTick || 0, profile.lastHeatTick || 0);
  const sneaking = isPlayerSneaking(player);
  let decay = sneaking ? SUSPICION_CONFIG.sneakDecay : SUSPICION_CONFIG.quietDecay;
  if (quietTicks < 20 * 10 && !sneaking) {
    decay = Math.max(1, Math.floor(decay / 2));
  }
  profile.suspicion = clamp(profile.suspicion - decay, 0, SUSPICION_CONFIG.max);
  updateSuspicionPhase(profile, currentTick);
}

function reduceSuspicionForSneaking(player, profile, currentTick) {
  if (!isPlayerSneaking(player) || !profile || profile.suspicion <= 0) {
    return;
  }
  if (currentTick - profile.lastSuspicionTick >= SUSPICION_CONFIG.decayIntervalTicks) {
    profile.suspicion = clamp(profile.suspicion - SUSPICION_CONFIG.sneakDecay, 0, SUSPICION_CONFIG.max);
    profile.lastSuspicionTick = currentTick;
    updateSuspicionPhase(profile, currentTick);
  }
}

function recordSuspiciousAction(player, profile, action, points, options = {}) {
  if (!player || !profile || points <= 0) {
    return;
  }

  const currentTick = system.currentTick || 0;
  if (isPlayerInSafeRoom(player, currentTick)) {
    return;
  }
  const lastTick = profile.lastSuspiciousActionTicks.get(action) || -999999;
  const cooldown = options.cooldownTicks ?? SUSPICION_CONFIG.actionCooldownTicks;
  if (currentTick - lastTick < cooldown) {
    return;
  }
  profile.lastSuspiciousActionTicks.set(action, currentTick);
  profile.lastNoiseTick = currentTick;

  let amount = points;
  if (isPlayerSneaking(player) && !options.ignoreSneakReduction) {
    amount *= 0.45;
  }

  profile.suspicion = clamp(profile.suspicion + amount, 0, SUSPICION_CONFIG.max);
  const heardByWatcher = options.countsAsSoundEvidence !== false && isPlayerHeardByWatcher(player);
  if (heardByWatcher) {
    profile.lastHeardByWatcherTick = currentTick;
    recordWatcherEvidenceForPlayer(
      player,
      options.evidenceKind || EVIDENCE_KIND.Sound,
      options.evidenceStrength ?? clamp(points / SOUND_POINTS.loudCombat, 0.08, 1),
      currentTick,
      {
        location: options.evidenceLocation || player.location,
        maxDistance: options.evidenceMaxDistance || CONFIG.soundDetectionRadius,
      },
    );
  }
  if (options.soundPoints) {
    addSoundScore(profile, options.soundPoints);
  }
  if (options.heat) {
    increaseHeat(profile, options.heat);
  }
  if (options.fear) {
    increaseFear(profile, options.fear);
  }
  updateSuspicionPhase(profile, currentTick);
  advanceTension(profile, currentTick);
}

function canStartMajorScare(profile, currentTick) {
  if (!profile) {
    return false;
  }
  advanceTension(profile, currentTick);
  updateSuspicionPhase(profile, currentTick);
  const normalPeak = profile.tensionState === TENSION.Peak && !profile.peakMajorUsed && profile.suspicionPhase === SUSPICION_PHASE.AttackReady;
  if (normalPeak) {
    return true;
  }
  const attackDebt = Math.max(0, Math.floor(Number(profile.attackDebt) || 0));
  const pressure = getProfilePressure(profile);
  const warned = profile.suspicion >= SUSPICION_CONFIG.warning || profile.warningCueUntilTick > currentTick;
  const enoughTimeSinceMajor = currentTick - (profile.lastMajorScareTick || -999999) >= 20 * 45;
  return attackDebt >= 2 && warned && pressure >= CONFIG.realAmbushMinHeat && enoughTimeSinceMajor;
}

function warnBeforeAttack(player, entity, state, profile, currentTick) {
  if (!player || !profile || isPlayerInSafeRoom(player, currentTick)) {
    return false;
  }
  if (profile.suspicion < SUSPICION_CONFIG.warning) {
    return false;
  }
  if (currentTick - profile.lastWarningCueTick < 20 * 14) {
    return true;
  }
  profile.lastWarningCueTick = currentTick;
  profile.warningCueUntilTick = currentTick + SUSPICION_CONFIG.warningDurationTicks;
  updateSuspicionPhase(profile, currentTick);

  requestVhsTier(player, VHS_TIER.High, currentTick, 20 * 5, "stalker-warning");
  playCue(player, PHASE.Pressure, true);
  try {
    player.sendMessage("§8Something heard you.");
  } catch (_error) {
    // Text warnings are optional.
  }
  try {
    player.addEffect("minecraft:darkness", 20 * 3, { amplifier: 0, showParticles: false });
  } catch (_error) {
    incrementDebugStat("failedEffects");
  }
  if (entity && state && state.phase !== PHASE.Ambush) {
    moveWatcher(entity, state, player, profile, currentTick, true);
  }
  return true;
}

function isPlayerHeardByWatcher(player) {
  if (!player) {
    return false;
  }

  for (const entity of getTrackedWatchers()) {
    const state = getState(entity);
    if (state.targetPlayerId !== player.id) {
      continue;
    }

    if (state.phase === PHASE.Dormant || state.phase === PHASE.Vanish) {
      continue;
    }

    if (!entity.dimension || entity.dimension.id !== player.dimension.id) {
      continue;
    }

    if (distance(entity.location, player.location) <= CONFIG.soundDetectionRadius) {
      return true;
    }
  }

  return false;
}

function resetWatcherPerception(state, currentTick) {
  if (!state) {
    return;
  }
  state.evidence = createWatcherEvidenceState(currentTick);
  state.behaviorState = WATCHER_BEHAVIOR.Dormant;
  state.lastTargetLocation = undefined;
  state.confirmedSightTicks = 0;
  state.lastRouteHintSnapshotTick = -999999;
}

function getEvidenceMovementDirection(profile) {
  const velocity = profile?.currentVelocity;
  if (!velocity) {
    return { x: 0, z: 0 };
  }
  const direction = horizontal({ x: velocity.x, y: 0, z: velocity.z });
  return { x: direction.x, z: direction.z };
}

function snapshotEvidenceRouteHints(profile, origin, dimensionId) {
  if (!profile?.cells || !origin || !dimensionId) {
    return [];
  }
  const maxDistance = 56;
  const ranked = [...profile.cells.values()]
    .filter((cell) => cell?.center && cell.dimensionId === dimensionId)
    .filter((cell) => distance(cell.center, origin) <= maxDistance)
    .sort((a, b) => scoreCell(b) - scoreCell(a))
    .slice(0, 6)
    .map((cell) => cloneLocation(cell.center));

  for (const cell of [profile.routeCell, profile.baseCell, profile.primaryCell]) {
    if (!cell?.center || cell.dimensionId !== dimensionId || distance(cell.center, origin) > maxDistance) {
      continue;
    }
    const key = getRouteCellKey(dimensionId, cell.center);
    if (!ranked.some((candidate) => getRouteCellKey(dimensionId, candidate) === key)) {
      ranked.push(cloneLocation(cell.center));
    }
  }
  return ranked.slice(0, 8);
}

function recordWatcherEvidenceForPlayer(player, kind, strength, currentTick, options = {}) {
  if (!player || !player.location || isPlayerInSafeRoom(player, currentTick)) {
    return 0;
  }

  const sourceOrigin = cloneLocation(options.location || player.location);
  const origin = kind === EVIDENCE_KIND.Flashlight
    ? approximateWatcherEvidenceLocation(sourceOrigin, options.uncertainty ?? 4)
    : sourceOrigin;
  const maxDistance = Math.max(1, Number(options.maxDistance) || CONFIG.soundDetectionRadius);
  const profile = playerProfiles.get(player.id);
  let recorded = 0;

  for (const entity of getTrackedWatchers()) {
    const state = getState(entity);
    const assigned = state.targetPlayerId === player.id || state.ownerPlayerId === player.id;
    if (!assigned || state.phase === PHASE.Dormant || state.phase === PHASE.Vanish || state.phase === PHASE.Psychological) {
      continue;
    }
    if (!entity.dimension || entity.dimension.id !== player.dimension.id) {
      continue;
    }
    if (distance(entity.location, sourceOrigin) > maxDistance) {
      continue;
    }

    if (!state.evidence) {
      state.evidence = createWatcherEvidenceState(currentTick);
    }
    const refreshRouteHints =
      kind !== EVIDENCE_KIND.Flashlight &&
      currentTick - (state.lastRouteHintSnapshotTick || -999999) >= 20 * 4;
    const routeHints = kind === EVIDENCE_KIND.Flashlight
      ? undefined
      : refreshRouteHints
        ? snapshotEvidenceRouteHints(profile, origin, player.dimension.id)
        : state.evidence.routeHints;
    if (refreshRouteHints) {
      state.lastRouteHintSnapshotTick = currentTick;
    }
    observeWatcherEvidence(state.evidence, {
      kind,
      location: origin,
      strength: clamp(strength, 0, 1),
      movementDirection: kind === EVIDENCE_KIND.Flashlight
        ? { x: 0, z: 0 }
        : getEvidenceMovementDirection(profile),
      routeHints,
    }, currentTick);
    state.behaviorState = chooseEvidenceDrivenBehavior(state.evidence, {
      directorPhase: profile?.tensionState,
      safeRoom: false,
      currentTick,
    });
    const reactionTick = currentTick + getWatcherEvidenceReactionDelayTicks(kind, strength);
    if (!state.nextMoveTick || state.nextMoveTick < currentTick) {
      state.nextMoveTick = reactionTick;
    } else {
      state.nextMoveTick = Math.min(state.nextMoveTick, reactionTick);
    }
    if (profile && (kind === EVIDENCE_KIND.Sound || kind === EVIDENCE_KIND.Interaction)) {
      profile.lastHeardByWatcherTick = currentTick;
    }
    recorded += 1;
  }

  return recorded;
}

function getEvidenceRouteCandidates(state) {
  const evidence = state?.evidence;
  if (!evidence?.lastKnownPosition || !Array.isArray(evidence.routeHints)) {
    return [];
  }

  const radius = Math.max(18, (evidence.searchRadius || 10) * 1.75);
  return evidence.routeHints
    .filter(Boolean)
    .filter((candidate) => distance(candidate, evidence.lastKnownPosition) <= radius * 1.35)
    .map((candidate) => cloneLocation(candidate))
    .slice(0, 8);
}

function chooseEvidenceTeleportSpot(player, profile, phase, state, currentTick, preferredCenter) {
  const evidence = state?.evidence;
  if (!player?.dimension || !evidence?.lastKnownPosition) {
    return undefined;
  }

  const routeCandidates = getEvidenceRouteCandidates(state);
  let origin = cloneLocation(preferredCenter || evidence.lastKnownPosition);
  const adaptive = profile?.adaptive;
  const learnedDirection = adaptive?.escapeConfidence >= 0.25 ? adaptive.escapeDirection : undefined;
  const evidenceDirection = evidence.movementDirection?.x || evidence.movementDirection?.z
    ? evidence.movementDirection
    : learnedDirection;
  const routeConfidence = clamp(
    Math.max(evidence.confidence * 0.75, adaptive?.escapeConfidence || 0),
    0,
    1,
  );

  if (!preferredCenter && (phase === PHASE.Ambush || state.adaptiveTactic === ADAPTIVE_TACTIC.PredictedAmbush || Math.random() < 0.35)) {
    const prediction = predictWatcherInterception(state.evidence, {
      direction: evidenceDirection,
      routeConfidence,
      distance: phase === PHASE.Ambush ? 14 : 10,
      uncertainty: phase === PHASE.Ambush ? 5 : 7,
      failureChance: phase === PHASE.Ambush ? 0.28 : 0.38,
    });
    if (prediction.success && prediction.location) {
      origin = prediction.location;
    }
  }

  const centers = [origin, ...routeCandidates.slice(0, 4)];
  const range = phase === "search"
    ? [3, Math.max(8, evidence.searchRadius || 10)]
    : getPhaseRangeForPlayer(player, phase);
  const samples = phase === "search" ? 18 : Math.min(24, CONFIG.candidateSamples[phase] || 20);
  let best;

  for (let i = 0; i < samples; i++) {
    const center = i === 0 ? origin : pickRandom(centers);
    const radius = randomFloat(range[0], range[1]);
    const candidate = candidateFromPolar(center, radius, randomFloat(0, Math.PI * 2), randomInt(-2, 2));
    const standPhase = phase === "search" ? PHASE.Shadow : phase;
    const spot = resolveStandSpot(player.dimension, candidate, standPhase);
    if (!spot) {
      continue;
    }

    const spotEye = addVec(spot, 0, 0.9, 0);
    const visible = hasLineOfSight(player.dimension, getEyeLocation(player), spotEye);
    const focused = isPlayerLookingAtLocation(player, spotEye, 0.35);
    const light = getLightLevel(player.dimension, spot);
    const cover = countCoverBlocks(player.dimension, spot);
    const playerDistance = distance(player.location, spot);
    let score = (visible ? -28 : 14) + (focused ? -32 : 4) + cover * 3;
    score += light <= CONFIG.lightPreference ? 10 : -Math.max(0, light - CONFIG.lightPreference);
    score -= countDangerBlocks(player.dimension, spot) * 18;
    score += Math.min(10, playerDistance / 10);
    if (phase !== PHASE.Ambush && phase !== PHASE.Vanish && playerDistance < 24) {
      score -= 40;
    }
    if (preferredCenter) {
      score -= Math.min(20, distance(spot, preferredCenter)) * 0.35;
    }
    score += randomFloat(-2, 2);

    if (!best || score > best.score) {
      best = {
        spot,
        score,
        anchor: undefined,
        patternKey: `evidence-${phase}:band-${Math.max(0, Math.floor(playerDistance / 8))}`,
      };
    }
  }

  return best;
}

function shouldUseEvidenceMovement(state, currentTick) {
  const evidence = state?.evidence;
  if (!evidence?.lastKnownPosition) {
    return false;
  }
  if (state.behaviorState === WATCHER_BEHAVIOR.Search || evidence.behavior === WATCHER_BEHAVIOR.Search) {
    return true;
  }
  const freshConfirmedSight = evidence.confirmed && currentTick - evidence.lastSightTick <= 20;
  return !freshConfirmedSight;
}

function moveWatcherByEvidence(entity, state, player, profile, currentTick, force = false) {
  if (!state?.evidence?.lastKnownPosition) {
    return false;
  }

  tickWatcherEvidence(state.evidence, currentTick);
  let behavior = chooseEvidenceDrivenBehavior(state.evidence, {
    directorPhase: profile?.tensionState,
    safeRoom: isPlayerInSafeRoom(player, currentTick),
    currentTick,
  });
  state.behaviorState = behavior;
  let preferredCenter;

  if (behavior === WATCHER_BEHAVIOR.Search) {
    const search = advanceWatcherSearch(
      state.evidence,
      currentTick,
      getEvidenceRouteCandidates(state),
    );
    behavior = search.behavior;
    state.behaviorState = behavior;
    preferredCenter = search.target;

    if (behavior === WATCHER_BEHAVIOR.Disengage) {
      profile.heat = clamp(profile.heat - 10, 0, 100);
      profile.suspicion = clamp(profile.suspicion - 18, 0, SUSPICION_CONFIG.max);
      enterPhase(entity, state, player, profile, PHASE.Vanish, currentTick, "search-failed", {
        skipImmediateMove: true,
      });
      markPlayerCooldownSeconds(player, randomInt(20, 90));
      return true;
    }
  }

  const phase = state.phase === PHASE.Dormant ? PHASE.Observe : state.phase;
  const result = chooseEvidenceTeleportSpot(player, profile, behavior === WATCHER_BEHAVIOR.Search ? "search" : phase, state, currentTick, preferredCenter);
  if (!result) {
    state.failedSpotCount += 1;
    state.nextMoveTick = currentTick + randomInt(20 * 4, 20 * 8);
    return false;
  }

  const teleportPhase = behavior === WATCHER_BEHAVIOR.Search ? "search" : phase;
  const moved = teleportWatcher(
    entity,
    result.spot,
    state.evidence.lastKnownPosition,
    player.dimension,
    {
      player,
      state,
      phase: teleportPhase,
      reason: behavior === WATCHER_BEHAVIOR.Search ? "search-investigate" : (force ? `evidence-immediate-${phase}` : `evidence-${phase}`),
      currentTick,
      directorPhase: profile?.tensionState,
      protectedRelief: profile?.tensionState === TENSION.Relief,
      physicallyValid: true,
      patternKey: result.patternKey,
    },
  );
  if (!moved) {
    state.failedSpotCount += 1;
    return false;
  }

  state.failedSpotCount = 0;
  state.lastMoveTick = currentTick;
  state.totalMoves += 1;
  state.lastTargetLocation = cloneLocation(state.evidence.lastKnownPosition);
  if (behavior === WATCHER_BEHAVIOR.Search) {
    state.nextMoveTick = currentTick + randomInt(20 * 10, 20 * 18);
    if (Math.random() < 0.16) {
      tryPlayAtPosition(
        player,
        "search:misleading-cue",
        HORROR_SOUND.StalkerStepBehind,
        result.spot,
        { volume: 0.38, pitch: randomFloat(0.82, 1.02) },
        20 * 45,
      );
    }
  } else {
    scheduleNextMove(state, state.phase, currentTick);
  }
  setWatcherAnimation(entity, getWatcherBaseAnimationForPhase(state.phase), { force: true });
  return true;
}

function classifyAndApplyMovementSound(player, profile, currentTick) {
  if (currentTick - profile.lastMovementSoundTick < CONFIG.movementSoundCooldownTicks) {
    return;
  }

  profile.lastMovementSoundTick = currentTick;

  const vel = profile.currentVelocity;
  const hSpeed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
  const vSpeed = vel.y;

  if (hSpeed >= 4.0) {
    recordSuspiciousAction(player, profile, "sprint", SOUND_POINTS.sprint, { heat: 1, cooldownTicks: CONFIG.movementSoundCooldownTicks });
  } else if (isPlayerSneaking(player)) {
    reduceSuspicionForSneaking(player, profile, currentTick);
  }

  if (!isPlayerHeardByWatcher(player)) {
    return;
  }

  let pts = 0;

  if (hSpeed >= 4.0) {
    pts = SOUND_POINTS.sprint;
  } else if (hSpeed >= 0.3) {
    let isSneaking = false;
    try {
      isSneaking = player.isSneaking === true;
    } catch (_e) {
      // Not all API versions expose isSneaking.
    }
    pts = isSneaking ? SOUND_POINTS.sneak : SOUND_POINTS.walk;
  }

  if (vSpeed > 0.25 && hSpeed > 0.1) {
    pts = Math.max(pts, SOUND_POINTS.jump);
  }

  if (pts > 0) {
    addSoundScore(profile, pts);
    if (hSpeed < 4.0) {
      recordWatcherEvidenceForPlayer(
        player,
        EVIDENCE_KIND.Sound,
        clamp(pts / SOUND_POINTS.loudCombat, 0.08, 0.75),
        currentTick,
      );
    }
  }
}

function phaseFromProfile(profile, state, currentTick) {
  advanceTension(profile, currentTick);
  const pressure = clamp(getBehaviorAdjustedHeat(profile) + Math.floor(profile.soundScore * 0.45) + Math.floor(profile.suspicion * 0.25), 0, 100);
  const rawPressure = getProfilePressure(profile);

  if (profile.tensionState === TENSION.Relief) {
    return PHASE.Dormant;
  }

  if (profile.tensionState === TENSION.Quiet) {
    return pressure >= CONFIG.phaseHeat.observe ? PHASE.Observe : PHASE.Dormant;
  }

  if (profile.tensionState === TENSION.Buildup) {
    if (pressure >= CONFIG.phaseHeat.shadow) {
      return PHASE.Shadow;
    }
    if (pressure >= CONFIG.phaseHeat.observe) {
      return PHASE.Observe;
    }
    return PHASE.Dormant;
  }

  const ambushThreshold = Math.floor(CONFIG.phaseHeat.ambush * getBehaviorAmbushBoost(profile));
  if (rawPressure >= ambushThreshold && canStartMajorScare(profile, currentTick)) {
    return PHASE.Ambush;
  }

  if (pressure >= CONFIG.phaseHeat.pressure) {
    return PHASE.Pressure;
  }

  if (pressure >= CONFIG.phaseHeat.shadow) {
    return PHASE.Shadow;
  }

  if (pressure >= CONFIG.phaseHeat.observe) {
    return PHASE.Observe;
  }

  return PHASE.Dormant;
}

function canTransitionPhase(state, currentTick, fromPhase, toPhase) {
  if (fromPhase === toPhase) {
    return true;
  }

  let requiredDelay = 0;
  if (fromPhase === PHASE.Observe && toPhase === PHASE.Shadow) {
    requiredDelay = CONFIG.phaseTransitionDelayTicks.observeToShadow;
  } else if (fromPhase === PHASE.Shadow && toPhase === PHASE.Pressure) {
    requiredDelay = CONFIG.phaseTransitionDelayTicks.shadowToPressure;
  } else if (fromPhase === PHASE.Pressure && toPhase === PHASE.Ambush) {
    requiredDelay = CONFIG.phaseTransitionDelayTicks.pressureToAmbush;
  }

  if (requiredDelay <= 0) {
    return true;
  }

  if (state.phaseTransitionStartTick <= 0) {
    state.phaseTransitionStartTick = currentTick;
    return false;
  }

  return currentTick - state.phaseTransitionStartTick >= requiredDelay;
}

function resetPhaseTransitionDelay(state) {
  state.phaseTransitionStartTick = 0;
}

function getState(entity) {
  let state = watcherStates.get(entity.id);
  if (!state) {
    state = {
      entityId: entity.id,
      phase: PHASE.Dormant,
      ownerPlayerId: undefined,
      targetPlayerId: undefined,
      phaseChangedTick: system.currentTick,
      phaseTransitionStartTick: 0,
      nextThinkTick: 0,
      nextMoveTick: 0,
      nextCueTick: 0,
      exposedTicks: 0,
      lostTargetTicks: 0,
      failedSpotCount: 0,
      lastMoveTick: 0,
      lastSeenByTargetTick: 0,
      lastTargetLocation: undefined,
      ambushLocation: undefined,
      ambushDimensionId: undefined,
      ambushOutcome: undefined,
      ambushStartTick: 0,
      ambushLastPulseTick: 0,
      stareHoldUntilTick: 0,
      lastStareHoldTick: -999999,
      vanishUntilTick: 0,
      cooldownPlayerId: undefined,
      totalMoves: 0,
      lastAnchorKey: undefined,
      lastReason: "created",
      squadRole: SQUAD_ROLE.None,
      lastAnimationState: undefined,
      animationLockUntilTick: 0,
      recentSpots: new Map(),
      adaptiveTactic: undefined,
      adaptiveTacticUntilTick: 0,
      confirmedSightTicks: 0,
      lastAdaptiveExposureTick: -999999,
      behaviorState: WATCHER_BEHAVIOR.Dormant,
      evidence: createWatcherEvidenceState(system.currentTick || 0),
      lastRouteHintSnapshotTick: -999999,
    };
    watcherStates.set(entity.id, state);
  }

  if (!state.evidence) {
    state.evidence = createWatcherEvidenceState(system.currentTick || 0);
  }
  if (!state.behaviorState) {
    state.behaviorState = WATCHER_BEHAVIOR.Dormant;
  }

  return state;
}

function registerWatcher(entity) {
  if (!isWatcherEntity(entity) || isBurningHighwaySequenceWatcher(entity)) {
    return;
  }

  if (!isAllowedStalkerDimension(entity.dimension)) {
    removeWatcherWithoutLoot(entity);
    return;
  }

  trackedWatchers.set(entity.id, entity);
  getState(entity);

  try {
    entity.addTag(CONFIG.managedTag);
  } catch (_error) {
    // Tags are optional.
  }

  setWatcherAnimation(entity, "Idle", { force: true });
}

function getTrackedWatchers() {
  if (trackedWatchers.size) {
    for (const [entityId, entity] of [...trackedWatchers.entries()]) {
      if (!isEntityValid(entity) || isBurningHighwaySequenceWatcher(entity)) {
        trackedWatchers.delete(entityId);
        watcherStates.delete(entityId);
        continue;
      }

      if (!isAllowedStalkerDimension(entity.dimension)) {
        removeWatcherWithoutLoot(entity);
      }
    }
    return [...trackedWatchers.values()].filter((entity) => isEntityValid(entity) && !isBurningHighwaySequenceWatcher(entity) && isAllowedStalkerDimension(entity.dimension));
  }

  scanLoadedWatchers();
  return [...trackedWatchers.values()].filter((entity) => isEntityValid(entity) && !isBurningHighwaySequenceWatcher(entity) && isAllowedStalkerDimension(entity.dimension));
}

function scanLoadedWatchers() {
  for (const dimensionId of WATCHER_SCAN_DIMENSION_IDS) {
    const dimension = getDimensionById(dimensionId);
    if (!dimension) {
      continue;
    }

    let entities = [];
    try {
      entities = dimension.getEntities({ type: CONFIG.watcherTypeId });
    } catch (_error) {
      entities = [];
    }

    for (const entity of entities) {
      if (isBurningHighwaySequenceWatcher(entity)) {
        continue;
      }
      registerWatcher(entity);
    }
  }
}

function getAssignedWatcherCount(player) {
  let count = 0;
  for (const entity of getTrackedWatchers()) {
    const state = getState(entity);
    const assignedToPlayer = state.ownerPlayerId === player.id || state.targetPlayerId === player.id;
    if (assignedToPlayer && state.phase !== PHASE.Vanish) {
      count += 1;
    }
  }

  return count;
}

function getWatcherCountInDimension(dimensionId) {
  let count = 0;
  for (const entity of getTrackedWatchers()) {
    if (entity.dimension && entity.dimension.id === dimensionId) {
      count += 1;
    }
  }

  return count;
}

function findIdleWatcherFor(player) {
  for (const entity of getTrackedWatchers()) {
    if (!entity.dimension || entity.dimension.id !== player.dimension.id || !isAllowedStalkerDimension(entity.dimension)) {
      continue;
    }

    const state = getState(entity);
    if (state.ownerPlayerId && state.ownerPlayerId !== player.id) {
      continue;
    }

    if (state.targetPlayerId && state.targetPlayerId !== player.id) {
      continue;
    }

    if (state.phase !== PHASE.Dormant && state.phase !== PHASE.Vanish) {
      continue;
    }

    if (state.phase === PHASE.Vanish && system.currentTick < state.vanishUntilTick) {
      continue;
    }

    state.ownerPlayerId = player.id;
    return { entity, state };
  }

  return undefined;
}

function countCoverBlocks(dimension, spot) {
  const offsets = [
    { x: 1, y: 0, z: 0 },
    { x: -1, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 0, z: -1 },
    { x: 1, y: 1, z: 0 },
    { x: -1, y: 1, z: 0 },
    { x: 0, y: 1, z: 1 },
    { x: 0, y: 1, z: -1 },
  ];
  let cover = 0;

  for (const offset of offsets) {
    const block = safeGetBlock(dimension, addVec(spot, offset.x, offset.y, offset.z));
    if (block && !isTransparentBlock(block)) {
      cover += 1;
    }
  }

  return cover;
}

function countDangerBlocks(dimension, spot) {
  const offsets = [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: -1, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: -1, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 0, z: -1 },
  ];
  let danger = 0;

  for (const offset of offsets) {
    if (isDangerBlock(safeGetBlock(dimension, addVec(spot, offset.x, offset.y, offset.z)))) {
      danger += 1;
    }
  }

  return danger;
}

function hasOpenHorizontalExit(dimension, spot) {
  const exits = [
    { x: 1, z: 0 },
    { x: -1, z: 0 },
    { x: 0, z: 1 },
    { x: 0, z: -1 },
  ];

  for (const exit of exits) {
    const feet = safeGetBlock(dimension, addVec(spot, exit.x, 0, exit.z));
    const head = safeGetBlock(dimension, addVec(spot, exit.x, 1, exit.z));
    if (isPassableBlock(feet) && isPassableBlock(head)) {
      return true;
    }
  }

  return false;
}

function isLibraryLayoutSpot(dimension, spot) {
  if (!isLibraryDimension(dimension)) {
    return true;
  }

  const pos = toBlockPos(spot);
  if (pos.y !== LIBRARY_STAND_Y) {
    return false;
  }

  const floor = safeGetBlock(dimension, { x: pos.x, y: LIBRARY_FLOOR_Y, z: pos.z });
  if (blockTypeId(floor) !== "minecraft:oak_planks") {
    return false;
  }

  const ceiling = safeGetBlock(dimension, { x: pos.x, y: LIBRARY_CEILING_Y, z: pos.z });
  if (!ceiling || isPassableBlock(ceiling)) {
    return false;
  }

  return hasOpenHorizontalExit(dimension, spot);
}

function isSpotValid(dimension, spot) {
  if (!isAllowedStalkerDimension(dimension)) {
    return false;
  }

  const feet = safeGetBlock(dimension, spot);
  const head = safeGetBlock(dimension, addVec(spot, 0, 1, 0));
  const below = safeGetBlock(dimension, addVec(spot, 0, -1, 0));

  if (!isSolidSupportBlock(below)) {
    return false;
  }

  if (!isPassableBlock(feet) || !isPassableBlock(head)) {
    return false;
  }

  if (!isLibraryLayoutSpot(dimension, spot)) {
    return false;
  }

  return countDangerBlocks(dimension, spot) === 0;
}

function resolveStandSpot(dimension, candidate, phase) {
  const origin = toBlockPos(candidate);
  const candidates = [];
  for (let dy = 6; dy >= -9; dy--) {
    const spot = {
      x: origin.x,
      y: clampBlockY(dimension, origin.y + dy),
      z: origin.z,
    };

    if (isSpotValid(dimension, spot)) {
      const center = centerBlock(spot);
      if (phase === PHASE.Shadow) {
        const coverBonus = hasOverheadCover(dimension, spot) ? 2 : 0;
        candidates.push({ spot: center, score: coverBonus });
      } else {
        return center;
      }
    }
  }

  if (phase === PHASE.Shadow && candidates.length) {
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0].spot;
  }

  return undefined;
}

function getPlayerBasis(player) {
  let forward = horizontal(getViewDirection(player));
  if (!forward.x && !forward.z) {
    forward = { x: 0, y: 0, z: 1 };
  }

  return {
    forward,
    back: { x: -forward.x, y: 0, z: -forward.z },
    right: { x: -forward.z, y: 0, z: forward.x },
  };
}

function candidateFromPolar(origin, radius, angle, yOffset = 0) {
  return {
    x: origin.x + Math.cos(angle) * radius,
    y: origin.y + yOffset,
    z: origin.z + Math.sin(angle) * radius,
  };
}

function generateCandidate(player, phase, anchorLocation, profile, adaptiveTactic) {
  const usePredictive = profile && Math.random() < CONFIG.predictiveCandidateChance;
  const origin = usePredictive ? getPredictedLocation(player, profile) : player.location;
  const range = getPhaseRangeForPlayer(player, phase);
  const radius = randomFloat(range[0], range[1]);
  const yOffset = randomInt(-2, 3);
  const basis = getPlayerBasis(player);
  const sideSign = Math.random() < 0.5 ? -1 : 1;
  const side = {
    x: basis.right.x * sideSign,
    y: 0,
    z: basis.right.z * sideSign,
  };
  const adaptive = profile?.adaptive;
  const learnedEscape = adaptive && adaptive.escapeConfidence >= 0.25
    ? normalize({ x: adaptive.escapeDirection.x, y: 0, z: adaptive.escapeDirection.z })
    : undefined;
  const learnedEscapeRight = learnedEscape
    ? { x: -learnedEscape.z, y: 0, z: learnedEscape.x }
    : undefined;

  if (adaptiveTactic === ADAPTIVE_TACTIC.PredictedAmbush && learnedEscape) {
    const offsetSide = Math.random() < 0.5 ? -1 : 1;
    return {
      x: player.location.x + learnedEscape.x * radius + learnedEscapeRight.x * offsetSide * radius * 0.42,
      y: player.location.y + randomInt(-1, 2),
      z: player.location.z + learnedEscape.z * radius + learnedEscapeRight.z * offsetSide * radius * 0.42,
    };
  }

  if (adaptiveTactic === ADAPTIVE_TACTIC.RoutePoisoning && learnedEscape) {
    const offsetSide = Math.random() < 0.5 ? -1 : 1;
    return {
      x: player.location.x + learnedEscape.x * radius * 0.92 + learnedEscapeRight.x * offsetSide * radius * 0.36,
      y: player.location.y + yOffset,
      z: player.location.z + learnedEscape.z * radius * 0.92 + learnedEscapeRight.z * offsetSide * radius * 0.36,
    };
  }

  if (adaptiveTactic === ADAPTIVE_TACTIC.PeripheralWatch) {
    return {
      x: player.location.x + basis.forward.x * radius * 0.42 + side.x * radius * 0.9,
      y: player.location.y + yOffset,
      z: player.location.z + basis.forward.z * radius * 0.42 + side.z * radius * 0.9,
    };
  }

  if (adaptiveTactic === ADAPTIVE_TACTIC.FalseRearThreat) {
    return {
      x: player.location.x + basis.forward.x * radius * 0.14 + side.x * radius * 0.98,
      y: player.location.y + yOffset,
      z: player.location.z + basis.forward.z * radius * 0.14 + side.z * radius * 0.98,
    };
  }

  if (adaptiveTactic === ADAPTIVE_TACTIC.BaitSighting) {
    return {
      x: player.location.x + basis.forward.x * radius * 0.86 + side.x * radius * 0.34,
      y: player.location.y + yOffset,
      z: player.location.z + basis.forward.z * radius * 0.86 + side.z * radius * 0.34,
    };
  }

  if (adaptiveTactic === ADAPTIVE_TACTIC.EmptyRoom) {
    const predicted = getPredictedLocation(player, profile);
    return {
      x: predicted.x + basis.forward.x * radius * 0.35 + side.x * radius * 0.88,
      y: predicted.y + yOffset,
      z: predicted.z + basis.forward.z * radius * 0.35 + side.z * radius * 0.88,
    };
  }

  if (phase === PHASE.Observe) {
    const lateral = randomFloat(-0.45, 0.45);
    return {
      x: origin.x + basis.back.x * radius + basis.right.x * lateral * radius,
      y: origin.y + yOffset,
      z: origin.z + basis.back.z * radius + basis.right.z * lateral * radius,
    };
  }

  if (phase === PHASE.Shadow) {
    const behindWeight = randomFloat(0.45, 0.9);
    const sideWeight = randomFloat(0.35, 0.85);
    return {
      x: origin.x + basis.back.x * radius * behindWeight + side.x * radius * sideWeight,
      y: origin.y + yOffset,
      z: origin.z + basis.back.z * radius * behindWeight + side.z * radius * sideWeight,
    };
  }

  if (phase === PHASE.Pressure) {
    const frontChance = Math.random() < 0.28;
    const front = frontChance ? basis.forward : basis.back;
    const sideWeight = randomFloat(-0.55, 0.55);
    return {
      x: origin.x + front.x * radius + basis.right.x * sideWeight * radius,
      y: origin.y + yOffset,
      z: origin.z + front.z * radius + basis.right.z * sideWeight * radius,
    };
  }

  if (phase === PHASE.Ambush) {
    const behindWeight = randomFloat(0.2, 0.8);
    const sideWeight = randomFloat(-0.7, 0.7);
    return {
      x: origin.x + basis.back.x * radius * behindWeight + basis.right.x * sideWeight * radius,
      y: origin.y + randomInt(-1, 2),
      z: origin.z + basis.back.z * radius * behindWeight + basis.right.z * sideWeight * radius,
    };
  }

  if (phase === PHASE.Vanish && anchorLocation) {
    return candidateFromPolar(anchorLocation, radius, randomFloat(0, Math.PI * 2), yOffset);
  }

  if (anchorLocation && Math.random() < 0.45) {
    return candidateFromPolar(anchorLocation, radius, randomFloat(0, Math.PI * 2), yOffset);
  }

  return candidateFromPolar(origin, radius, randomFloat(0, Math.PI * 2), yOffset);
}

function scoreSpot(dimension, player, spot, phase, anchorLocation, state, adaptiveTactic, profile) {
  const playerEye = getEyeLocation(player);
  const spotEye = addVec(spot, 0, 0.9, 0);
  const dist = distance(player.location, spot);
  const range = getPhaseRangeForPlayer(player, phase);
  const visible = hasLineOfSight(dimension, playerEye, spotEye);
  const focused = isPlayerLookingAtLocation(player, spotEye, 0.48);
  const light = getLightLevel(dimension, spot);
  const cover = countCoverBlocks(dimension, spot);
  let score = 0;

  if (dist >= range[0] && dist <= range[1]) {
    score += 22;
  } else {
    score -= Math.abs(dist - (range[0] + range[1]) / 2);
  }

  if (phase === PHASE.Observe) {
    score += visible ? -18 : 14;
    score += focused ? -24 : 8;
  } else if (phase === PHASE.Shadow) {
    score += visible ? -6 : 10;
    score += focused ? -12 : 5;
  } else if (phase === PHASE.Pressure) {
    score += visible ? 8 : 4;
    score += focused ? 5 : 0;
  } else if (phase === PHASE.Ambush) {
    score += visible ? 6 : 10;
    score += focused ? -6 : 4;
  } else if (phase === PHASE.Vanish) {
    score += visible ? -30 : 16;
    score += focused ? -30 : 8;
  }

  const spotDirection = normalize({
    x: spot.x - player.location.x,
    y: 0,
    z: spot.z - player.location.z,
  });
  const viewAlignment = dot(horizontal(getViewDirection(player)), spotDirection);
  const adaptive = profile?.adaptive;
  const learnedEscape = adaptive && adaptive.escapeConfidence >= 0.25
    ? normalize({ x: adaptive.escapeDirection.x, y: 0, z: adaptive.escapeDirection.z })
    : undefined;
  const escapeAlignment = learnedEscape ? dot(learnedEscape, spotDirection) : 0;

  if (adaptiveTactic === ADAPTIVE_TACTIC.PeripheralWatch) {
    score += visible ? 12 : -4;
    score += focused ? -20 : 10;
    score += Math.max(0, 12 - Math.abs(viewAlignment - 0.42) * 24);
  } else if (adaptiveTactic === ADAPTIVE_TACTIC.FalseRearThreat) {
    score += visible ? -8 : 12;
    score += focused ? -18 : 8;
    score += Math.max(0, 8 - Math.abs(viewAlignment - 0.12) * 16);
  } else if (adaptiveTactic === ADAPTIVE_TACTIC.RoutePoisoning) {
    score += learnedEscape ? Math.max(-8, escapeAlignment * 16) : 0;
    score += focused ? -10 : 5;
  } else if (adaptiveTactic === ADAPTIVE_TACTIC.StareContest) {
    score += visible ? 16 : -10;
    score += focused ? 14 : 2;
  } else if (adaptiveTactic === ADAPTIVE_TACTIC.BaitSighting) {
    score += visible ? 18 : -12;
    score += focused ? 7 : 5;
    score += Math.max(0, viewAlignment * 8);
  } else if (adaptiveTactic === ADAPTIVE_TACTIC.ShadowPursuit) {
    score += visible ? -10 : 14;
    score += focused ? -15 : 5;
  } else if (adaptiveTactic === ADAPTIVE_TACTIC.EmptyRoom) {
    score += visible ? -12 : 15;
    score += focused ? -16 : 6;
    if (anchorLocation) {
      score += Math.min(12, distance(spot, anchorLocation) * 0.22);
    }
  } else if (adaptiveTactic === ADAPTIVE_TACTIC.PredictedAmbush) {
    score += learnedEscape ? Math.max(-10, escapeAlignment * 20) : 0;
    score += focused ? -10 : 7;
  } else if (adaptiveTactic === ADAPTIVE_TACTIC.ShortHunt) {
    score += visible ? 10 : 4;
    score += focused ? 2 : 4;
  }

  score += cover * 2.5;
  score += light <= CONFIG.lightPreference ? 12 : -Math.max(0, light - CONFIG.lightPreference);
  score -= countDangerBlocks(dimension, spot) * 16;

  const escapeRoutes = countEscapeRoutes(dimension, spot);
  score += Math.min(escapeRoutes, 3) * CONFIG.escapeRouteBonus;

  if (isChokePoint(spot, player, anchorLocation)) {
    score += CONFIG.chokePointBonus;
  }

  if (phase === PHASE.Shadow && hasOverheadCover(dimension, spot)) {
    score += CONFIG.overheadCoverBonus;
  }

  if (state && anchorLocation) {
    const anchorKey = getRouteCellKey(dimension.id, anchorLocation);
    score -= getRevisitPenalty(state, anchorKey);
  }

  if (anchorLocation) {
    const anchorDistance = distance(spot, anchorLocation);
    if (phase === PHASE.Pressure && anchorDistance <= 24) {
      score += 10;
    } else if (phase === PHASE.Shadow && anchorDistance <= 42) {
      score += 6;
    } else if (phase === PHASE.Vanish && anchorDistance >= 18) {
      score += 5;
    }
  }

  return score + randomFloat(-2, 2);
}

function chooseAnchor(profile, phase, squad, role) {
  if (!profile) {
    return undefined;
  }

  if (squad && squad.length && role !== SQUAD_ROLE.None) {
    return getSquadAnchor(profile, squad, phase, role);
  }

  if (phase === PHASE.Pressure || phase === PHASE.Ambush) {
    return profile.baseCell || profile.routeCell || profile.primaryCell;
  }

  if (phase === PHASE.Shadow) {
    return profile.routeCell || profile.primaryCell || profile.baseCell;
  }

  return profile.primaryCell || profile.routeCell || profile.baseCell;
}

function chooseTeleportSpot(player, profile, phase, state, adaptiveTactic = state?.adaptiveTactic) {
  const dimension = player.dimension;
  const samples = CONFIG.candidateSamples[phase] || 32;
  const squad = state ? getSquadWatchers(state.targetPlayerId, state.entityId) : [];
  const role = state && squad.length ? assignSquadRole(state.entityId, squad, phase) : SQUAD_ROLE.None;
  const anchor = chooseAnchor(profile, phase, squad, role);
  const anchorLocation = anchor ? anchor.center : undefined;
  let best = undefined;

  for (let i = 0; i < samples; i++) {
    const candidate = generateCandidate(player, phase, anchorLocation, profile, adaptiveTactic);
    const spot = resolveStandSpot(dimension, candidate, phase);

    if (!spot) {
      continue;
    }

    const score = scoreSpot(dimension, player, spot, phase, anchorLocation, state, adaptiveTactic, profile);
    if (!best || score > best.score) {
      best = { spot, score, anchor };
    }
  }

  if (!best) {
    incrementDebugStat("noValidSpot");
  }

  return best;
}

function teleportWatcher(entity, location, facingLocation, dimension, options = {}) {
  if (!isEntityValid(entity) || !location) {
    return false;
  }

  const currentTick = options.currentTick ?? (system.currentTick || 0);
  const player = options.player;
  const state = options.state;
  const phase = options.phase || state?.phase || PHASE.Observe;
  const reason = options.reason || "watcher-move";
  const targetDimension = dimension || entity.dimension;
  const sameEntityDimension = !!(player && entity.dimension && player.dimension && entity.dimension.id === player.dimension.id);
  const sameTargetDimension = !!(player && targetDimension && player.dimension && targetDimension.id === player.dimension.id);
  const visible = options.visible === true || (
    (sameEntityDimension && isPlayerLookingAtLocation(player, entity.location, 0.35)) ||
    (sameTargetDimension && isPlayerLookingAtLocation(player, location, 0.35))
  );
  const strongLineOfSight = options.strongLineOfSight === true || (
    sameTargetDimension &&
    player &&
    location &&
    hasLineOfSight(player.dimension, getEyeLocation(player), addVec(location, 0, 0.9, 0))
  );
  let governorPatternKey = options.patternKey;

  if (player && options.skipGovernor !== true) {
    const decision = canTeleportStalker({
      entity,
      player,
      state,
      phase,
      reason,
      currentTick,
      fromLocation: entity.location,
      toLocation: location,
      location,
      visible,
      force: options.force === true,
      minTicks: options.minTicks,
      visibleMinTicks: options.visibleMinTicks,
      maxPerEncounter: options.maxPerEncounter,
      encounterKey: options.encounterKey,
      directorPhase: options.directorPhase,
      protectedRelief: options.protectedRelief === true,
      strongLineOfSight,
      physicallyValid: options.physicallyValid !== false,
      patternKey: options.patternKey,
      allowVisibleSetup: options.allowVisibleSetup === true,
    });
    governorPatternKey = decision.patternKey || governorPatternKey;

    if (!decision.allowed) {
      recordStalkerTeleport({
        entity,
        player,
        state,
        phase,
        reason,
        currentTick,
        visible,
        allowed: false,
        denialReason: decision.reason,
        patternKey: decision.patternKey || options.patternKey,
      });
      if (state && decision.remainingTicks > 0) {
        state.nextMoveTick = Math.max(state.nextMoveTick || 0, currentTick + Math.max(20, Math.min(decision.remainingTicks, 20 * 45)));
      }
      incrementDebugStat("governedTeleports");
      return false;
    }
  }

  try {
    entity.teleport(location, {
      dimension: dimension || entity.dimension,
      checkForBlocks: false,
      facingLocation,
      keepVelocity: false,
    });
    if (player) {
      recordStalkerTeleport({
        entity,
        player,
        state,
        phase,
        reason,
        currentTick,
        visible,
        allowed: true,
        skipBudget: options.skipBudget === true,
        patternKey: governorPatternKey,
      });
    }
    return true;
  } catch (_error) {
    incrementDebugStat("failedTeleports");
    if (player) {
      recordStalkerTeleport({
        entity,
        player,
        state,
        phase,
        reason,
        currentTick,
        visible,
        allowed: false,
        denialReason: "apiTeleportFailed",
      });
    }
    return false;
  }
}

function randomTickRange(range, fallbackTicks) {
  if (!Array.isArray(range) || range.length < 2) {
    return fallbackTicks;
  }
  return randomInt(Math.max(1, Math.floor(range[0])), Math.max(1, Math.floor(range[1])));
}

function getPsychologicalVisibleTicks(type) {
  return CONFIG.psychological.visibleTicks[type] || 16;
}

function isCatacombsLikeDimension(dimension) {
  const id = String(dimension?.id || "").toLowerCase();
  return CATACOMBS_DIMENSION_PATTERNS.some((pattern) => id.includes(pattern));
}

function getActivePsychologicalCountForDimension(dimensionId) {
  return activePsychologicalWatchersByDimension.get(dimensionId) || 0;
}

function setActivePsychologicalCountForDimension(dimensionId, count) {
  if (!dimensionId) {
    return;
  }
  if (count <= 0) {
    activePsychologicalWatchersByDimension.delete(dimensionId);
  } else {
    activePsychologicalWatchersByDimension.set(dimensionId, count);
  }
}

function incrementActivePsychologicalDimension(dimensionId) {
  setActivePsychologicalCountForDimension(dimensionId, getActivePsychologicalCountForDimension(dimensionId) + 1);
}

function decrementActivePsychologicalDimension(dimensionId) {
  setActivePsychologicalCountForDimension(dimensionId, getActivePsychologicalCountForDimension(dimensionId) - 1);
}

function weightedPick(weights) {
  let total = 0;
  for (const value of Object.values(weights || {})) {
    total += Math.max(0, Number(value) || 0);
  }
  if (total <= 0) {
    return undefined;
  }

  let roll = Math.random() * total;
  for (const [key, rawWeight] of Object.entries(weights)) {
    const weight = Math.max(0, Number(rawWeight) || 0);
    if (weight <= 0) {
      continue;
    }
    if (roll < weight) {
      return key;
    }
    roll -= weight;
  }

  return undefined;
}

function getPsychologicalTypeCooldown(profile, type) {
  ensurePsychologicalProfileState(profile);
  return profile.psychologicalTypeCooldowns.get(type) || 0;
}

function setPsychologicalTypeCooldown(profile, type, untilTick) {
  ensurePsychologicalProfileState(profile);
  profile.psychologicalTypeCooldowns.set(type, untilTick);
}

function getPsychologicalGlobalCooldownUntil(player) {
  if (!player || !player.id) {
    return 0;
  }
  return psychologicalCooldownUntilByPlayer.get(player.id) || 0;
}

function setPsychologicalGlobalCooldownUntil(player, untilTick) {
  if (!player || !player.id) {
    return;
  }
  psychologicalCooldownUntilByPlayer.set(player.id, Math.max(0, untilTick));
}

function hasActivePsychologicalAppearance(player) {
  if (!player || !player.id) {
    return false;
  }
  const entityId = activePsychologicalWatchersByPlayer.get(player.id);
  if (!entityId) {
    return false;
  }

  const entity = trackedWatchers.get(entityId);
  if (isEntityValid(entity)) {
    return true;
  }

  activePsychologicalWatchersByPlayer.delete(player.id);
  return false;
}

function isPsychologicalDecisionAllowed(player, profile, currentTick, allowSafeRoomExterior = false) {
  if (!CONFIG.psychological.enabled || !player || !profile || !isInterestingPlayer(player)) {
    return false;
  }

  ensurePsychologicalProfileState(profile, player);

  if (hasActivePsychologicalAppearance(player)) {
    return false;
  }

  if (activePsychologicalWatchersByPlayer.size >= CONFIG.psychological.maxActivePerPlayer && activePsychologicalWatchersByPlayer.has(player.id)) {
    return false;
  }

  if (getActivePsychologicalCountForDimension(player.dimension.id) >= CONFIG.psychological.maxActivePerDimension) {
    return false;
  }

  if (currentTick < getPsychologicalGlobalCooldownUntil(player)) {
    return false;
  }

  const playerCooldown = allowSafeRoomExterior
    ? CONFIG.psychological.safeRoomPlayerCooldownTicks
    : CONFIG.psychological.playerCooldownTicks;
  if (currentTick - profile.lastPsychologicalTick < playerCooldown) {
    return false;
  }

  if (currentTick < profile.nextPsychologicalDecisionTick) {
    return false;
  }

  const pressure = getProfilePressure(profile);
  if (!allowSafeRoomExterior && profile.heat < CONFIG.psychological.minHeat && pressure < CONFIG.psychological.minimumPressure) {
    return false;
  }

  return true;
}

function choosePsychologicalEncounterOutcome(profile, currentTick, allowSafeRoomExterior = false) {
  const weights = allowSafeRoomExterior
    ? CONFIG.psychological.safeRoomOutcomeWeights
    : CONFIG.psychological.outcomeWeights;
  const picked = weightedPick(weights);

  switch (picked) {
    case "psychologicalThenChase":
      return PSYCHOLOGICAL_OUTCOME.PsychologicalThenChase;
    case "directChase":
      return PSYCHOLOGICAL_OUTCOME.DirectChase;
    case "noEncounter":
      return PSYCHOLOGICAL_OUTCOME.NoEncounter;
    case "psychologicalOnly":
    default:
      return PSYCHOLOGICAL_OUTCOME.PsychologicalOnly;
  }
}

function isSpotWithinPsychologicalDistance(player, spot, type) {
  const range = CONFIG.psychological.ranges[type] || [CONFIG.psychological.minSpawnDistance, CONFIG.psychological.maxSpawnDistance];
  const dist = distance(player.location, spot);
  return dist >= Math.max(CONFIG.psychological.minSpawnDistance, range[0]) && dist <= Math.min(CONFIG.psychological.maxSpawnDistance, range[1]);
}

function isPsychologicalSpotSafe(player, spot, type, options = {}) {
  if (!player || !spot || !player.dimension || !isSpotValid(player.dimension, spot)) {
    return false;
  }

  if (!isSpotWithinPsychologicalDistance(player, spot, type)) {
    return false;
  }

  const playerEye = getEyeLocation(player);
  const spotEye = addVec(spot, 0, 0.9, 0);
  const dist = distance(player.location, spot);
  if (dist < CONFIG.psychological.minSpawnDistance) {
    return false;
  }

  if (options.requireLineOfSight && !hasLineOfSight(player.dimension, playerEye, spotEye)) {
    return false;
  }

  return true;
}

function corridorScoreAt(dimension, spot, forward, right) {
  let score = 0;
  for (let step = -1; step <= 1; step++) {
    const center = addVec(spot, forward.x * step, 0, forward.z * step);
    const left = safeGetBlock(dimension, addVec(center, right.x, 0, right.z));
    const rightBlock = safeGetBlock(dimension, addVec(center, -right.x, 0, -right.z));
    const aheadFeet = safeGetBlock(dimension, addVec(center, forward.x, 0, forward.z));
    const aheadHead = safeGetBlock(dimension, addVec(center, forward.x, 1, forward.z));
    if (left && !isTransparentBlock(left)) score += 2;
    if (rightBlock && !isTransparentBlock(rightBlock)) score += 2;
    if (isPassableBlock(aheadFeet) && isPassableBlock(aheadHead)) score += 1;
  }
  return score;
}

function findHallwayGlimpseSpot(player, profile, currentTick) {
  const basis = getPlayerBasis(player);
  const range = CONFIG.psychological.ranges[PSYCHOLOGICAL_APPEARANCE_TYPE.HallwayGlimpse];
  let best = undefined;

  for (let d = range[1]; d >= range[0]; d -= 2) {
    for (let lateral of [0, -1.5, 1.5, -3, 3]) {
      const candidate = {
        x: player.location.x + basis.forward.x * d + basis.right.x * lateral,
        y: player.location.y + randomInt(-1, 2),
        z: player.location.z + basis.forward.z * d + basis.right.z * lateral,
      };
      const spot = resolveStandSpot(player.dimension, candidate, PHASE.Observe);
      if (!spot || !isPsychologicalSpotSafe(player, spot, PSYCHOLOGICAL_APPEARANCE_TYPE.HallwayGlimpse, { requireLineOfSight: true })) {
        continue;
      }
      const toSpot = horizontal({ x: spot.x - player.location.x, y: 0, z: spot.z - player.location.z });
      const alignment = dot(toSpot, basis.forward);
      if (alignment < 0.45) {
        continue;
      }
      const corridor = corridorScoreAt(player.dimension, spot, basis.forward, basis.right);
      const score = corridor * 5 + d * 0.25 - Math.abs(lateral) * 1.5 + randomFloat(-1, 1);
      if (!best || score > best.score) {
        best = { spot, score };
      }
    }
  }

  return best;
}

function findTurnaroundApparitionSpot(player, profile, currentTick) {
  if (!profile || currentTick - profile.lastTurnaroundTick > 20 * 3) {
    return undefined;
  }

  const basis = getPlayerBasis(player);
  const range = CONFIG.psychological.ranges[PSYCHOLOGICAL_APPEARANCE_TYPE.TurnaroundApparition];
  let best = undefined;
  for (let i = 0; i < 18; i++) {
    const radius = randomFloat(range[0], range[1]);
    const side = randomFloat(-2.5, 2.5);
    const candidate = {
      x: player.location.x + basis.back.x * radius + basis.right.x * side,
      y: player.location.y + randomInt(-1, 1),
      z: player.location.z + basis.back.z * radius + basis.right.z * side,
    };
    const spot = resolveStandSpot(player.dimension, candidate, PHASE.Shadow);
    if (!spot || !isPsychologicalSpotSafe(player, spot, PSYCHOLOGICAL_APPEARANCE_TYPE.TurnaroundApparition)) {
      continue;
    }
    const visible = hasLineOfSight(player.dimension, getEyeLocation(player), addVec(spot, 0, 0.9, 0));
    const score = (visible ? 6 : 2) + countCoverBlocks(player.dimension, spot) * 2 - distance(player.location, spot) * 0.15;
    if (!best || score > best.score) {
      best = { spot, score };
    }
  }
  return best;
}

function findHalfHiddenWatcherSpot(player, profile, currentTick) {
  const range = CONFIG.psychological.ranges[PSYCHOLOGICAL_APPEARANCE_TYPE.HalfHidden];
  let best = undefined;

  for (let i = 0; i < 36; i++) {
    const candidate = candidateFromPolar(player.location, randomFloat(range[0], range[1]), randomFloat(0, Math.PI * 2), randomInt(-1, 2));
    const spot = resolveStandSpot(player.dimension, candidate, PHASE.Shadow);
    if (!spot || !isPsychologicalSpotSafe(player, spot, PSYCHOLOGICAL_APPEARANCE_TYPE.HalfHidden)) {
      continue;
    }
    const spotEye = addVec(spot, 0, 0.9, 0);
    const visible = hasLineOfSight(player.dimension, getEyeLocation(player), spotEye);
    const cover = countCoverBlocks(player.dimension, spot);
    if (!visible || cover <= 0) {
      continue;
    }
    const light = getLightLevel(player.dimension, spot);
    const score = cover * 5 + (light <= CONFIG.lightPreference ? 8 : 0) - Math.abs(distance(player.location, spot) - 14) + randomFloat(-2, 2);
    if (!best || score > best.score) {
      best = { spot, score };
    }
  }

  return best;
}

function findFogSilhouetteSpot(player, profile, currentTick) {
  const range = CONFIG.psychological.ranges[PSYCHOLOGICAL_APPEARANCE_TYPE.FogSilhouette];
  const basis = getPlayerBasis(player);
  let best = undefined;

  for (let i = 0; i < 42; i++) {
    const radius = randomFloat(range[0], range[1]);
    const frontBias = Math.random() < 0.72 ? basis.forward : basis.back;
    const side = randomFloat(-0.55, 0.55) * radius;
    const candidate = {
      x: player.location.x + frontBias.x * radius + basis.right.x * side,
      y: player.location.y + randomInt(-2, 4),
      z: player.location.z + frontBias.z * radius + basis.right.z * side,
    };
    const spot = resolveStandSpot(player.dimension, candidate, PHASE.Observe);
    if (!spot || !isPsychologicalSpotSafe(player, spot, PSYCHOLOGICAL_APPEARANCE_TYPE.FogSilhouette)) {
      continue;
    }
    const visible = hasLineOfSight(player.dimension, getEyeLocation(player), addVec(spot, 0, 0.9, 0));
    const light = getLightLevel(player.dimension, spot);
    const score = (visible ? 7 : 3) + Math.max(0, 11 - light) * 2 + distance(player.location, spot) * 0.08 + randomFloat(-1, 1);
    if (!best || score > best.score) {
      best = { spot, score };
    }
  }
  return best;
}

function findSafeRoomExteriorSpot(player, profile, currentTick) {
  const range = CONFIG.psychological.ranges[PSYCHOLOGICAL_APPEARANCE_TYPE.SafeRoomExterior];
  const basis = getPlayerBasis(player);
  let best = undefined;

  for (let i = 0; i < 36; i++) {
    const radius = randomFloat(range[0], range[1]);
    const angle = Math.random() < 0.65
      ? Math.atan2(basis.forward.z, basis.forward.x) + randomFloat(-0.7, 0.7)
      : randomFloat(0, Math.PI * 2);
    const candidate = candidateFromPolar(player.location, radius, angle, randomInt(-1, 2));
    const spot = resolveStandSpot(player.dimension, candidate, PHASE.Observe);
    if (!spot || !isPsychologicalSpotSafe(player, spot, PSYCHOLOGICAL_APPEARANCE_TYPE.SafeRoomExterior)) {
      continue;
    }
    const visible = hasLineOfSight(player.dimension, getEyeLocation(player), addVec(spot, 0, 0.9, 0));
    const cover = countCoverBlocks(player.dimension, spot);
    const score = (visible ? 10 : 2) + cover * 2 - Math.abs(distance(player.location, spot) - 12) + randomFloat(-1, 1);
    if (!best || score > best.score) {
      best = { spot, score };
    }
  }

  return best;
}

function findCatacombsOverheadSpot(player, profile, currentTick) {
  if (!isCatacombsLikeDimension(player.dimension)) {
    return undefined;
  }

  const range = CONFIG.psychological.ranges[PSYCHOLOGICAL_APPEARANCE_TYPE.CatacombsOverhead];
  const basis = getPlayerBasis(player);
  let best = undefined;

  for (let i = 0; i < 36; i++) {
    const radius = randomFloat(range[0], range[1]);
    const side = randomFloat(-0.9, 0.9) * radius;
    const forward = randomFloat(-0.35, 0.8) * radius;
    const candidate = {
      x: player.location.x + basis.forward.x * forward + basis.right.x * side,
      y: player.location.y + randomInt(4, 9),
      z: player.location.z + basis.forward.z * forward + basis.right.z * side,
    };
    const spot = resolveStandSpot(player.dimension, candidate, PHASE.Shadow);
    if (!spot || spot.y <= player.location.y + 2.5 || !isPsychologicalSpotSafe(player, spot, PSYCHOLOGICAL_APPEARANCE_TYPE.CatacombsOverhead)) {
      continue;
    }
    const visible = hasLineOfSight(player.dimension, getEyeLocation(player), addVec(spot, 0, 0.9, 0));
    const score = (visible ? 12 : 3) + Math.min(8, spot.y - player.location.y) + countCoverBlocks(player.dimension, spot) * 2 + randomFloat(-1, 1);
    if (!best || score > best.score) {
      best = { spot, score };
    }
  }

  return best;
}

function findPassiveReplacementSpot(player, profile, currentTick) {
  let entities = [];
  try {
    entities = player.dimension.getEntities({
      location: player.location,
      maxDistance: CONFIG.psychological.passiveReplacement.searchRadius,
    });
  } catch (_error) {
    entities = [];
  }

  const candidates = [];
  for (const entity of entities) {
    if (!isEntityValid(entity) || !PASSIVE_MOB_TYPES.has(entity.typeId)) {
      continue;
    }
    const mobDistance = distance(player.location, entity.location);
    const range = CONFIG.psychological.ranges[PSYCHOLOGICAL_APPEARANCE_TYPE.PassiveMobReplacement];
    if (mobDistance < range[0] || mobDistance > range[1]) {
      continue;
    }
    const spot = resolveStandSpot(player.dimension, entity.location, PHASE.Observe);
    if (!spot || !isPsychologicalSpotSafe(player, spot, PSYCHOLOGICAL_APPEARANCE_TYPE.PassiveMobReplacement)) {
      continue;
    }
    const visible = hasLineOfSight(player.dimension, getEyeLocation(player), addVec(spot, 0, 0.9, 0));
    candidates.push({ entity, spot, score: (visible ? 8 : 3) - Math.abs(mobDistance - 11) + randomFloat(-1, 1) });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}

function findRequestedPsychologicalSpot(type, player, preferredLocation, currentTick) {
  if (!player || !preferredLocation) return undefined;
  const basis = getPlayerBasis(player);
  const range = CONFIG.psychological.ranges[type] || [CONFIG.psychological.minSpawnDistance, CONFIG.psychological.maxSpawnDistance];
  const normalizedPreferred = clampPreferredLocationToRange(player.location, preferredLocation, range);
  const candidates = [
    normalizedPreferred,
    addVec(normalizedPreferred, basis.right.x * 1.5, 0, basis.right.z * 1.5),
    addVec(normalizedPreferred, -basis.right.x * 1.5, 0, -basis.right.z * 1.5),
    addVec(normalizedPreferred, basis.forward.x * 1.5, 0, basis.forward.z * 1.5),
    addVec(normalizedPreferred, -basis.forward.x * 1.5, 0, -basis.forward.z * 1.5),
  ].map((candidate) => clampPreferredLocationToRange(player.location, candidate, range));
  const phase = type === PSYCHOLOGICAL_APPEARANCE_TYPE.HallwayGlimpse || type === PSYCHOLOGICAL_APPEARANCE_TYPE.FogSilhouette
    ? PHASE.Observe
    : PHASE.Shadow;
  for (const candidate of candidates) {
    const spot = resolveStandSpot(player.dimension, candidate, phase);
    if (!spot || !isPsychologicalSpotSafe(player, spot, type)) continue;
    return { spot, score: 100 - distance(player.location, spot) * 0.1, requested: true, currentTick };
  }
  return undefined;
}

function tryFindPsychologicalSpot(type, player, profile, currentTick) {
  switch (type) {
    case PSYCHOLOGICAL_APPEARANCE_TYPE.HallwayGlimpse:
      return findHallwayGlimpseSpot(player, profile, currentTick);
    case PSYCHOLOGICAL_APPEARANCE_TYPE.TurnaroundApparition:
      return findTurnaroundApparitionSpot(player, profile, currentTick);
    case PSYCHOLOGICAL_APPEARANCE_TYPE.HalfHidden:
      return findHalfHiddenWatcherSpot(player, profile, currentTick);
    case PSYCHOLOGICAL_APPEARANCE_TYPE.FogSilhouette:
      return findFogSilhouetteSpot(player, profile, currentTick);
    case PSYCHOLOGICAL_APPEARANCE_TYPE.SafeRoomExterior:
      return findSafeRoomExteriorSpot(player, profile, currentTick);
    case PSYCHOLOGICAL_APPEARANCE_TYPE.CatacombsOverhead:
      return findCatacombsOverheadSpot(player, profile, currentTick);
    case PSYCHOLOGICAL_APPEARANCE_TYPE.PassiveMobReplacement:
      return findPassiveReplacementSpot(player, profile, currentTick);
    default:
      return undefined;
  }
}

function getCandidatePsychologicalTypes(player, profile, currentTick, allowSafeRoomExterior = false) {
  const weights = { ...CONFIG.psychological.typeWeights };
  if (allowSafeRoomExterior) {
    return { [PSYCHOLOGICAL_APPEARANCE_TYPE.SafeRoomExterior]: weights.safeRoomExterior || 1 };
  }

  delete weights.safeRoomExterior;
  if (!isCatacombsLikeDimension(player.dimension)) {
    delete weights.catacombsOverhead;
  }
  if (!profile || currentTick - profile.lastTurnaroundTick > 20 * 3) {
    delete weights.turnaroundApparition;
  }
  if (profile && profile.lastPsychologicalType && weights[profile.lastPsychologicalType]) {
    weights[profile.lastPsychologicalType] *= 0.22;
  }
  return weights;
}

function choosePsychologicalAppearance(player, profile, currentTick, allowSafeRoomExterior = false) {
  const tried = new Set();
  for (let attempt = 0; attempt < 5; attempt++) {
    const weights = getCandidatePsychologicalTypes(player, profile, currentTick, allowSafeRoomExterior);
    for (const type of tried) {
      delete weights[type];
    }
    for (const type of Object.keys(weights)) {
      if (currentTick < getPsychologicalTypeCooldown(profile, type)) {
        delete weights[type];
      }
    }

    const type = weightedPick(weights);
    if (!type) {
      return undefined;
    }
    tried.add(type);
    const result = tryFindPsychologicalSpot(type, player, profile, currentTick);
    if (result && result.spot) {
      return { type, ...result };
    }
  }
  return undefined;
}

function playPsychologicalCue(player, type, spot) {
  if (!player || !spot) {
    return;
  }

  if (type === PSYCHOLOGICAL_APPEARANCE_TYPE.PassiveMobReplacement || type === PSYCHOLOGICAL_APPEARANCE_TYPE.HallwayGlimpse) {
    return;
  }

  const sound = type === PSYCHOLOGICAL_APPEARANCE_TYPE.CatacombsOverhead
    ? "paradise.dimension.catacomb_whisper"
    : type === PSYCHOLOGICAL_APPEARANCE_TYPE.TurnaroundApparition
      ? "paradise.stalker.step_behind"
      : "paradise.stalker.breath_far";

  try {
    player.dimension.playSound(sound, spot, {
      volume: type === PSYCHOLOGICAL_APPEARANCE_TYPE.SafeRoomExterior ? 0.18 : 0.25,
      pitch: randomFloat(0.78, 0.94),
    });
  } catch (_error) {
    // Psychological cues are intentionally optional.
  }
}

function removePsychologicalWatcherSilently(entity, state) {
  if (!entity || !state) {
    return false;
  }

  const entityId = entity.id;
  trackedWatchers.delete(entityId);
  watcherStates.delete(entityId);
  clearStalkerTeleportGovernor(entityId);
  if (state.targetPlayerId && activePsychologicalWatchersByPlayer.get(state.targetPlayerId) === entityId) {
    activePsychologicalWatchersByPlayer.delete(state.targetPlayerId);
  }
  decrementActivePsychologicalDimension(state.psychologicalDimensionId || entity.dimension?.id);

  try {
    entity.remove();
    return true;
  } catch (_error) {
    return false;
  }
}

function schedulePsychologicalEscalation(player, profile, type, currentTick) {
  if (!player || !profile || isPlayerInSafeRoom(player, currentTick)) {
    return;
  }

  const playerId = player.id;
  const delayTicks = randomTickRange(CONFIG.psychological.escalateDelayTicks, 20 * 12);
  increaseHeat(profile, type === PSYCHOLOGICAL_APPEARANCE_TYPE.HalfHidden ? 6 : 4);
  increaseFear(profile, 4);
  setTension(profile, TENSION.Buildup, currentTick, randomInt(20 * 28, 20 * 55));
  profile.psychologicalSuppressChaseUntilTick = currentTick + delayTicks;
  incrementDebugStat("psychologicalEscalations");

  system.runTimeout(() => {
    const livePlayer = getPlayerById(playerId);
    const tick = system.currentTick || 0;
    if (!livePlayer || !isInterestingPlayer(livePlayer) || isPlayerInSafeRoom(livePlayer, tick)) {
      return;
    }
    const liveProfile = samplePlayerMemory(livePlayer, tick, true) || getProfile(livePlayer);
    liveProfile.psychologicalSuppressChaseUntilTick = 0;
    spawnWatcherForPlayer(livePlayer, tick);
  }, delayTicks);
}

function finishPsychologicalAppearance(entity, state, player, profile, currentTick, reason = "expired") {
  if (!state || state.phase !== PHASE.Psychological) {
    return false;
  }

  if (entity && state.psychologicalType !== PSYCHOLOGICAL_APPEARANCE_TYPE.HallwayGlimpse) {
    try {
      spawnParticles(entity.dimension, entity.location, 0.22);
    } catch (_error) {
      // Optional.
    }
  }

  removePsychologicalWatcherSilently(entity, state);

  if (player && profile) {
    profile.psychologicalActiveCount = Math.max(0, (profile.psychologicalActiveCount || 1) - 1);
    if (state.psychologicalEscalates) {
      schedulePsychologicalEscalation(player, profile, state.psychologicalType, currentTick);
    } else {
      profile.psychologicalSuppressChaseUntilTick = currentTick + randomTickRange(CONFIG.psychological.psychOnlySuppressChaseTicks, 20 * 90);
      if (reason === "stared" || reason === "approached") {
        increaseFear(profile, 2);
      } else {
        profile.heat = clamp(profile.heat - 2, 0, 100);
      }
    }
  }

  return true;
}

function startPsychologicalAppearance(player, profile, currentTick, appearance, outcome) {
  if (!appearance || !appearance.spot || !player || !profile || !isInterestingPlayer(player)) {
    return false;
  }

  const type = appearance.type;
  const visibleTicks = getPsychologicalVisibleTicks(type);
  let watcher;
  try {
    watcher = player.dimension.spawnEntity(CONFIG.watcherTypeId, appearance.spot);
  } catch (_error) {
    return false;
  }

  registerWatcher(watcher);
  const state = getState(watcher);
  state.phase = PHASE.Psychological;
  state.ownerPlayerId = player.id;
  state.targetPlayerId = player.id;
  state.psychologicalType = type;
  state.psychologicalUntilTick = currentTick + visibleTicks;
  state.psychologicalStartedTick = currentTick;
  state.psychologicalEscalates = outcome === PSYCHOLOGICAL_OUTCOME.PsychologicalThenChase;
  state.psychologicalFocusedTicks = 0;
  state.psychologicalDimensionId = player.dimension.id;
  state.temporaryPsychological = true;
  state.lastReason = `psychological-${type}`;
  state.phaseChangedTick = currentTick;
  state.cooldownPlayerId = player.id;
  state.nextMoveTick = currentTick + visibleTicks;
  state.psychologicalPassiveMob = appearance.entity;

  try {
    watcher.addTag("paradise_watcher_psychological");
  } catch (_error) {
    // Optional.
  }

  if (appearance.entity && type === PSYCHOLOGICAL_APPEARANCE_TYPE.PassiveMobReplacement) {
    try {
      appearance.entity.addEffect("minecraft:invisibility", visibleTicks + CONFIG.psychological.passiveReplacement.mobInvisibilityExtraTicks, {
        amplifier: 0,
        showParticles: false,
      });
    } catch (_error) {
      incrementDebugStat("failedEffects");
    }
  }

  setWatcherAnimation(watcher, "Idle", { force: true });
  teleportWatcher(watcher, appearance.spot, player.location, player.dimension, {
    player,
    state,
    phase: PHASE.Psychological,
    reason: `psychological-${type}`,
    currentTick,
    maxPerEncounter: 1,
  });
  activePsychologicalWatchersByPlayer.set(player.id, watcher.id);
  incrementActivePsychologicalDimension(player.dimension.id);

  profile.lastPsychologicalTick = currentTick;
  profile.lastPsychologicalType = type;
  profile.psychologicalActiveCount = (profile.psychologicalActiveCount || 0) + 1;
  profile.nextPsychologicalDecisionTick = currentTick + randomTickRange(CONFIG.psychological.noEncounterSuppressTicks, 20 * 30);
  setPsychologicalTypeCooldown(profile, type, currentTick + CONFIG.psychological.typeCooldownTicks);
  setPsychologicalGlobalCooldownUntil(player, currentTick + CONFIG.psychological.globalCooldownTicks);
  incrementDebugStat("psychologicalEvents");

  if (type === PSYCHOLOGICAL_APPEARANCE_TYPE.FogSilhouette || type === PSYCHOLOGICAL_APPEARANCE_TYPE.CatacombsOverhead) {
    spawnParticles(player.dimension, appearance.spot, 0.18);
  }
  if (type !== PSYCHOLOGICAL_APPEARANCE_TYPE.SafeRoomExterior) {
    requestVhsTier(player, VHS_TIER.Low, currentTick, Math.max(visibleTicks + 20, 20 * 3), `psychological-${type}`);
  }
  playPsychologicalCue(player, type, appearance.spot);
  debugPlayer(player, `psychological ${type} outcome=${outcome}`);
  return true;
}

function triggerPsychologicalAppearance(player, profile, currentTick, outcome, allowSafeRoomExterior = false) {
  const appearance = choosePsychologicalAppearance(player, profile, currentTick, allowSafeRoomExterior);
  if (!appearance) {
    return false;
  }

  return startPsychologicalAppearance(player, profile, currentTick, appearance, outcome);
}

/**
 * Requests a non-chasing Watcher apparition for an external horror scenario.
 * The normal psychological safety gates, global/player cooldowns, per-type
 * cooldowns, placement checks, and active-appearance limits still apply.
 */
export function requestWatcherGlimpse(player, options = {}) {
  if (!player || !isInterestingPlayer(player)) {
    return false;
  }

  const currentTick = Math.max(0, Number(options.currentTick ?? system.currentTick) || 0);
  const styleMap = {
    "hallway": PSYCHOLOGICAL_APPEARANCE_TYPE.HallwayGlimpse,
    "half_hidden": PSYCHOLOGICAL_APPEARANCE_TYPE.HalfHidden,
    "fog": PSYCHOLOGICAL_APPEARANCE_TYPE.FogSilhouette,
    "turnaround": PSYCHOLOGICAL_APPEARANCE_TYPE.TurnaroundApparition,
  };
  const type = styleMap[String(options.style || 'hallway')] || PSYCHOLOGICAL_APPEARANCE_TYPE.HallwayGlimpse;
  const profile = samplePlayerMemory(player, currentTick, false) || getProfile(player);

  if (!isPsychologicalDecisionAllowed(player, profile, currentTick, false)) {
    return false;
  }
  if (currentTick < getPsychologicalTypeCooldown(profile, type)) {
    return false;
  }

  const requested = options.preferredLocation
    ? findRequestedPsychologicalSpot(type, player, options.preferredLocation, currentTick)
    : undefined;
  const result = requested || tryFindPsychologicalSpot(type, player, profile, currentTick);
  if (!result || !result.spot) {
    return false;
  }

  return startPsychologicalAppearance(
    player,
    profile,
    currentTick,
    { type, ...result },
    PSYCHOLOGICAL_OUTCOME.PsychologicalOnly,
  );
}

function suppressChaseAfterNoEncounter(profile, currentTick) {
  ensurePsychologicalProfileState(profile);
  profile.nextPsychologicalDecisionTick = currentTick + randomTickRange(CONFIG.psychological.noEncounterSuppressTicks, 20 * 28);
  profile.psychologicalSuppressChaseUntilTick = Math.max(
    profile.psychologicalSuppressChaseUntilTick || 0,
    profile.nextPsychologicalDecisionTick,
  );
  incrementDebugStat("psychologicalNoEncounter");
}

function decideWatcherEncounterForSpawn(player, profile, currentTick) {
  if (!isPsychologicalDecisionAllowed(player, profile, currentTick, false)) {
    return PSYCHOLOGICAL_OUTCOME.DirectChase;
  }

  const outcome = choosePsychologicalEncounterOutcome(profile, currentTick, false);
  if (outcome === PSYCHOLOGICAL_OUTCOME.NoEncounter) {
    suppressChaseAfterNoEncounter(profile, currentTick);
  } else if (outcome === PSYCHOLOGICAL_OUTCOME.DirectChase) {
    incrementDebugStat("psychologicalDirectChase");
  }
  return outcome;
}

function maybeTriggerSafeRoomExteriorPsychology(player, currentTick) {
  if (!CONFIG.psychological.enabled || !player || !isInterestingPlayer(player) || !isPlayerInSafeRoom(player, currentTick)) {
    return false;
  }

  const profile = samplePlayerMemory(player, currentTick, false) || getProfile(player);
  if (!isPsychologicalDecisionAllowed(player, profile, currentTick, true)) {
    return false;
  }
  if (Math.random() > CONFIG.psychological.safeRoomExteriorChance) {
    return false;
  }

  const outcome = choosePsychologicalEncounterOutcome(profile, currentTick, true);
  if (outcome === PSYCHOLOGICAL_OUTCOME.NoEncounter) {
    suppressChaseAfterNoEncounter(profile, currentTick);
    return false;
  }
  return triggerPsychologicalAppearance(player, profile, currentTick, PSYCHOLOGICAL_OUTCOME.PsychologicalOnly, true);
}

function tickSafeRoomExteriorPsychology(currentTick) {
  if (!CONFIG.psychological.enabled || currentTick % CONFIG.psychological.tickInterval !== 0) {
    return;
  }

  for (const player of getCachedPlayers()) {
    maybeTriggerSafeRoomExteriorPsychology(player, currentTick);
  }
}

function tickPsychologicalAppearance(entity, state, currentTick) {
  const player = getPlayerById(state.targetPlayerId);
  if (!player || !isInterestingPlayer(player)) {
    finishPsychologicalAppearance(entity, state, undefined, undefined, currentTick, "no-target");
    return;
  }

  const profile = getProfile(player);
  const dist = entity && entity.dimension && entity.dimension.id === player.dimension.id
    ? distance(player.location, entity.location)
    : Infinity;
  const focused = entity && entity.dimension && entity.dimension.id === player.dimension.id
    ? isPlayerLookingAtWatcher(player, entity)
    : false;

  if (focused) {
    state.psychologicalFocusedTicks += CONFIG.tickInterval;
    if (currentTick - (state.lastAdaptiveExposureTick || -999999) >= CONFIG.adaptive.exposureObservationCooldownTicks) {
      observeAdaptiveExposure(profile.adaptive, currentTick);
      state.lastAdaptiveExposureTick = currentTick;
    }
  } else {
    state.psychologicalFocusedTicks = Math.max(0, state.psychologicalFocusedTicks - CONFIG.tickInterval * 2);
  }

  const staredLimit = state.psychologicalType === PSYCHOLOGICAL_APPEARANCE_TYPE.HalfHidden
    ? CONFIG.psychological.halfHiddenStaredVanishTicks
    : CONFIG.psychological.staredVanishTicks;

  if (dist <= CONFIG.psychological.closeVanishDistance) {
    finishPsychologicalAppearance(entity, state, player, profile, currentTick, "approached");
    return;
  }

  if (focused && state.psychologicalFocusedTicks >= staredLimit) {
    finishPsychologicalAppearance(entity, state, player, profile, currentTick, "stared");
    return;
  }

  if (currentTick >= state.psychologicalUntilTick) {
    finishPsychologicalAppearance(entity, state, player, profile, currentTick, "expired");
  }
}


function getWatcherBaseAnimationForPhase(phase) {
  if (phase === PHASE.Shadow) {
    return "Walk";
  }

  if (phase === PHASE.Pressure || phase === PHASE.Ambush) {
    return "Run";
  }

  return "Idle";
}

function setWatcherAnimation(entity, animationName, options = {}) {
  if (!isEntityValid(entity)) {
    return false;
  }

  const animationState = WATCHER_ANIMATION_STATE[animationName];
  if (animationState === undefined) {
    return false;
  }

  const state = watcherStates.get(entity.id);
  if (
    state &&
    !options.force &&
    state.lastAnimationState === animationState &&
    (!state.animationLockUntilTick || state.animationLockUntilTick <= system.currentTick)
  ) {
    return true;
  }

  try {
    entity.setProperty(CONFIG.animationPropertyId, animationState);
    if (state) {
      state.lastAnimationState = animationState;
      if (options.durationTicks && options.durationTicks > 0) {
        state.animationLockUntilTick = system.currentTick + options.durationTicks;
      } else if (options.force) {
        state.animationLockUntilTick = 0;
      }
    }
  } catch (_error) {
    incrementDebugStat("failedPropertySets");
    return false;
  }

  if (options.durationTicks && options.durationTicks > 0) {
    const entityId = entity.id;
    system.runTimeout(() => {
      const liveEntity = trackedWatchers.get(entityId);
      if (!isEntityValid(liveEntity)) {
        return;
      }

      const liveState = watcherStates.get(entityId);
      if (
        liveState &&
        liveState.animationLockUntilTick &&
        liveState.animationLockUntilTick > system.currentTick
      ) {
        return;
      }

      setWatcherAnimation(
        liveEntity,
        getWatcherBaseAnimationForPhase(liveState ? liveState.phase : PHASE.Dormant),
        { force: true },
      );
    }, options.durationTicks);
  }

  return true;
}

function playCue(player, phase, force = false) {
  if (!player || (!force && Math.random() > 0.30)) {
    return;
  }

  const profile = playerProfiles.get(player.id);
  if (
    maybePlayStalkerHorrorAudio(player, {
      phase,
      force,
      heat: profile ? profile.heat : 0,
      fear: profile ? profile.fear : 0,
      soundScore: profile ? profile.soundScore : 0,
      pressure: profile ? getProfilePressure(profile) : 0,
      tensionState: profile ? profile.tensionState : undefined,
      nearbyPlayers: countNearbyPlayers(player, 96),
    })
  ) {
    return;
  }

  const sound = phase === PHASE.Ambush
    ? "block.sculk_shrieker.shriek"
    : pickRandom(CONFIG.cueSounds);
  const basis = getPlayerBasis(player);
  const source = {
    x: player.location.x + basis.back.x * randomFloat(5, 16) + basis.right.x * randomFloat(-8, 8),
    y: player.location.y + randomFloat(0, 2),
    z: player.location.z + basis.back.z * randomFloat(5, 16) + basis.right.z * randomFloat(-8, 8),
  };

  try {
    player.dimension.playSound(sound, source, {
      volume: phase === PHASE.Ambush ? 1.2 : 0.45,
      pitch: phase === PHASE.Pressure ? 0.55 : 0.85,
    });
  } catch (_error) {
    // Sound is optional.
  }
}

function chooseMinorHorrorEvent(phase) {
  const roll = Math.random();
  if (phase === PHASE.Pressure) {
    return roll < 0.45 ? "glimpse" : roll < 0.75 ? "sound" : "fade";
  }
  if (phase === PHASE.Shadow) {
    return roll < 0.5 ? "glimpse" : roll < 0.8 ? "sound" : "fade";
  }
  return roll < 0.65 ? "sound" : "glimpse";
}

function maybeTriggerMinorHorrorEvent(entity, state, player, profile, currentTick) {
  if (
    !player ||
    !profile ||
    isPlayerInSafeRoom(player, currentTick) ||
    state.phase === PHASE.Ambush ||
    state.phase === PHASE.Vanish ||
    state.phase === PHASE.Dormant
  ) {
    return false;
  }

  if (currentTick - profile.lastMinorHorrorTick < CONFIG.nonDamageCooldownTicks) {
    return false;
  }

  const chance = state.phase === PHASE.Pressure ? 0.32 : state.phase === PHASE.Shadow ? 0.22 : 0.12;
  if (Math.random() > chance) {
    return false;
  }

  const eventType = chooseMinorHorrorEvent(state.phase);
  profile.lastMinorHorrorTick = currentTick;
  incrementDebugStat("minorEvents");

  if (eventType === "sound") {
    playCue(player, state.phase, true);
    increaseFear(profile, state.phase === PHASE.Pressure ? 4 : 2);
    return true;
  }

  if (eventType === "fade") {
    spawnParticles(entity.dimension, entity.location, 0.55);
    addWatcherInvisibility(entity, 20 * 3);
    state.nextMoveTick = currentTick + randomInt(20 * 3, 20 * 7);
    increaseFear(profile, 3);
    return true;
  }

  const moved = moveWatcher(entity, state, player, profile, currentTick, true);
  if (moved) {
    spawnParticles(entity.dimension, entity.location, 0.25);
    setWatcherAnimation(entity, getWatcherBaseAnimationForPhase(state.phase), { force: true });
    state.nextMoveTick = currentTick + randomInt(20 * 2, 20 * 6);
    increaseFear(profile, state.phase === PHASE.Pressure ? 5 : 3);
  }
  return moved;
}

function hideWatcher(entity, state, player, profile, currentTick) {
  if (!isEntityValid(entity)) {
    return false;
  }

  spawnParticles(entity.dimension, entity.location, 0.65);
  addWatcherInvisibility(entity, CONFIG.vanishTicks);
  setWatcherAnimation(entity, "Idle", { force: true });

  if (!player || !profile || !isInterestingPlayer(player)) {
    return true;
  }

  const result = state.evidence?.lastKnownPosition
    ? chooseEvidenceTeleportSpot(player, profile, PHASE.Vanish, state, currentTick)
    : chooseTeleportSpot(player, profile, PHASE.Vanish, state);
  const facingLocation = state.evidence?.lastKnownPosition || player.location;
  if (result && teleportWatcher(entity, result.spot, facingLocation, player.dimension, {
    player,
    state,
    phase: PHASE.Vanish,
    reason: "vanish-cleanup",
    currentTick,
    directorPhase: profile?.tensionState,
    protectedRelief: profile?.tensionState === TENSION.Relief,
    physicallyValid: true,
    patternKey: result.patternKey,
  })) {
    state.lastMoveTick = currentTick;
    state.totalMoves += 1;
    if (result.anchor) {
      recordSpotVisit(state, result.anchor.key);
    }
  }

  return true;
}

function spawnParticles(dimension, location, spread = 0.35) {
  if (!dimension || !location) {
    return;
  }

  for (const particleId of CONFIG.particleIds) {
    try {
      dimension.spawnParticle(
        particleId,
        addVec(location, randomFloat(-spread, spread), randomFloat(0.1, 0.65), randomFloat(-spread, spread)),
      );
    } catch (_error) {
      incrementDebugStat("failedParticles");
      // Particle identifiers and unloaded chunks can fail.
    }
  }
}

function applyScareEffects(player, strong) {
  if (!player) {
    return;
  }

  const ticks = strong ? 90 : 45;
  try {
    player.addEffect("minecraft:blindness", ticks, {
      amplifier: 0,
      showParticles: false,
    });
  } catch (_error) {
    incrementDebugStat("failedEffects");
    // Optional.
  }

  try {
    player.addEffect("minecraft:nausea", ticks, {
      amplifier: strong ? 1 : 0,
      showParticles: false,
    });
  } catch (_error) {
    incrementDebugStat("failedEffects");
    // Optional.
  }
}

function addWatcherInvisibility(entity, ticks) {
  if (!isEntityValid(entity) || ticks <= 0) {
    return;
  }

  try {
    entity.addEffect("minecraft:invisibility", ticks, {
      amplifier: CONFIG.vanishInvisibilityAmplifier,
      showParticles: false,
    });
  } catch (_error) {
    incrementDebugStat("failedEffects");
  }
}


function getPlayerVhsState(player) {
  let state = playerVhsStates.get(player.id);
  if (!state) {
    state = {
      currentTier: VHS_TIER.Off,
      lockUntilTick: 0,
      lastAppliedTick: -999999,
      nextRefreshTick: 0,
      lastDangerTick: -999999,
      panicCooldownUntilTick: 0,
      lastReason: "init",
    };
    playerVhsStates.set(player.id, state);
  }

  return state;
}

function getWatcherThreatForPlayer(player) {
  let closest = Infinity;
  let strongestPhase = PHASE.Dormant;

  for (const watcher of getTrackedWatchers()) {
    const state = getState(watcher);
    if (state.targetPlayerId !== player.id) {
      continue;
    }
    if (!watcher.dimension || watcher.dimension.id !== player.dimension.id) {
      continue;
    }
    if (state.phase === PHASE.Dormant || state.phase === PHASE.Vanish) {
      continue;
    }

    const dist = distance(player.location, watcher.location);
    if (dist < closest) {
      closest = dist;
      strongestPhase = state.phase;
    }
  }

  return {
    distance: closest,
    phase: strongestPhase,
  };
}

function chooseDesiredVhsTier(player, profile, currentTick) {
  if (!player) {
    return { tier: VHS_TIER.Off, reason: "no-player" };
  }

  if (!isVhsEnabled(player)) {
    return { tier: VHS_TIER.Off, reason: "vhs-disabled" };
  }

  if (isPlayerInSafeRoom(player, currentTick)) {
    return { tier: VHS_TIER.Off, reason: "safe-room" };
  }

  const requested = getRequestedVhsRequest(player, currentTick);
  let desired = requested.tier;
  let reason = requested.reason || "request";

  const threat = getWatcherThreatForPlayer(player);
  if (threat.distance <= CONFIG.vhs.panicDistance && threat.phase === PHASE.Ambush) {
    desired = VHS_TIER.Panic;
    reason = "stalker-ambush-close";
  } else if (threat.distance <= CONFIG.vhs.highDistance || threat.phase === PHASE.Pressure || threat.phase === PHASE.Ambush) {
    if (getVhsTierRank(desired) < getVhsTierRank(VHS_TIER.High)) {
      desired = VHS_TIER.High;
      reason = "stalker-nearby";
    }
  } else if (threat.distance <= CONFIG.vhs.lowDistance || (profile && profile.tensionState === TENSION.Buildup)) {
    if (getVhsTierRank(desired) < getVhsTierRank(VHS_TIER.Low)) {
      desired = VHS_TIER.Low;
      reason = "buildup";
    }
  }

  if (profile) {
    const pressure = getProfilePressure(profile);
    if (profile.tensionState === TENSION.Peak && pressure >= 82 && getVhsTierRank(desired) < getVhsTierRank(VHS_TIER.High)) {
      desired = VHS_TIER.High;
      reason = "peak-buildup";
    } else if (pressure >= 42 && getVhsTierRank(desired) < getVhsTierRank(VHS_TIER.Low)) {
      desired = VHS_TIER.Low;
      reason = "profile-buildup";
    }
  }

  return { tier: desired, reason };
}

function applyVhsTier(player, desiredTier, currentTick, reason = "tick") {
  if (!player || !player.id) {
    return;
  }

  const state = getPlayerVhsState(player);
  let tier = desiredTier || VHS_TIER.Off;

  if (!isVhsEnabled(player)) {
    clearVhsRequest(player);
    if (state.currentTier !== VHS_TIER.Off || currentTick >= state.nextRefreshTick) {
      showVhsTier(player, VHS_TIER.Off, 1);
    }
    state.currentTier = VHS_TIER.Off;
    state.lastAppliedTick = currentTick;
    state.nextRefreshTick = currentTick + CONFIG.vhs.safeRoomClearRefreshTicks;
    state.lockUntilTick = currentTick;
    state.lastReason = "vhs-disabled";
    return;
  }

  if (isPlayerInSafeRoom(player, currentTick)) {
    clearVhsRequest(player);
    if (state.currentTier !== VHS_TIER.Off || currentTick >= state.nextRefreshTick) {
      showVhsTier(player, VHS_TIER.Off, 1);
    }
    state.currentTier = VHS_TIER.Off;
    state.lastAppliedTick = currentTick;
    state.nextRefreshTick = currentTick + CONFIG.vhs.safeRoomClearRefreshTicks;
    state.lockUntilTick = currentTick;
    state.lastReason = "safe-room";
    return;
  }

  const desiredRank = getVhsTierRank(tier);
  const currentRank = getVhsTierRank(state.currentTier);

  if (tier === VHS_TIER.Panic && currentTick < state.panicCooldownUntilTick && state.currentTier !== VHS_TIER.Panic) {
    tier = VHS_TIER.High;
    reason = "panic-cooldown";
  }

  if (desiredRank > getVhsTierRank(VHS_TIER.Low)) {
    state.lastDangerTick = currentTick;
  }

  if (getVhsTierRank(tier) < currentRank && currentTick < state.lockUntilTick) {
    tier = state.currentTier;
    reason = state.lastReason || "minimum-duration";
  } else if (
    currentRank > getVhsTierRank(VHS_TIER.Low) &&
    getVhsTierRank(tier) < currentRank &&
    currentTick - state.lastDangerTick < CONFIG.vhs.decayTicks
  ) {
    tier = state.currentTier;
    reason = state.lastReason || "decay-hold";
  }

  if (tier === VHS_TIER.Panic && state.currentTier !== VHS_TIER.Panic) {
    state.panicCooldownUntilTick = currentTick + CONFIG.vhs.panicMinIntervalTicks;
  }

  const changed = tier !== state.currentTier;
  if (changed || currentTick >= state.nextRefreshTick) {
    const durationTicks = tier === VHS_TIER.Panic ? 45 : tier === VHS_TIER.High ? 40 : tier === VHS_TIER.Low ? 35 : 1;
    showVhsTier(player, tier, durationTicks);
    state.currentTier = tier;
    state.lastAppliedTick = currentTick;
    state.nextRefreshTick = currentTick + CONFIG.vhs.refreshTicks;
    state.lockUntilTick = currentTick + CONFIG.vhs.minimumTierTicks;
    state.lastReason = reason;
  }
}

function tickRequestedVhsOnly(player, currentTick) {
  const requested = getRequestedVhsRequest(player, currentTick);
  const state = playerVhsStates.get(player.id);

  if (requested.tier !== VHS_TIER.Off) {
    applyVhsTier(player, requested.tier, currentTick, requested.reason || "request-only");
  } else if (state && state.currentTier !== VHS_TIER.Off) {
    applyVhsTier(player, VHS_TIER.Off, currentTick, requested.reason || "request-expired");
  }
}

function tickVhsForPlayers(currentTick) {
  if (currentTick % CONFIG.vhs.tickInterval !== 0) {
    return;
  }

  for (const player of getCachedPlayers()) {
    if (!player || !player.id || player.typeId !== "minecraft:player") {
      continue;
    }

    if (!isInterestingPlayer(player)) {
      tickRequestedVhsOnly(player, currentTick);
      continue;
    }

    const profile = samplePlayerMemory(player, currentTick, false) || getProfile(player);
    const desired = chooseDesiredVhsTier(player, profile, currentTick);
    applyVhsTier(player, desired.tier, currentTick, desired.reason);
  }

  for (const playerId of [...playerVhsStates.keys()]) {
    if (!getPlayerById(playerId)) {
      playerVhsStates.delete(playerId);
    }
  }
}

function resetWatcherHealth(entity) {
  if (!isEntityValid(entity)) {
    return false;
  }

  try {
    const health = entity.getComponent("minecraft:health");
    if (health && typeof health.resetToMaxValue === "function") {
      health.resetToMaxValue();
      return true;
    }
  } catch (_error) {
    // Best-effort only; the watcher is removed immediately after hit handling.
  }

  return false;
}

function removeWatcherWithoutLoot(entity) {
  if (!isEntityValid(entity)) {
    return false;
  }

  const entityId = entity.id;
  trackedWatchers.delete(entityId);
  watcherStates.delete(entityId);
  clearStalkerTeleportGovernor(entityId);

  try {
    spawnParticles(entity.dimension, entity.location, 0.75);
  } catch (_error) {
    // Optional effect.
  }

  try {
    entity.remove();
    return true;
  } catch (_error) {
    return false;
  }
}

function computeAntiCombatReappearTicks(profile) {
  const aggression = clamp(profile.antiCombatAggression || 0, 0, 12);
  return Math.max(
    CONFIG.antiCombat.reappearMinTicks,
    CONFIG.antiCombat.reappearBaseTicks - aggression * 20 * 3,
  );
}

function computeAntiCombatVanishTicks(profile) {
  const aggression = clamp(profile.antiCombatAggression || 0, 0, 12);
  return Math.max(
    CONFIG.antiCombat.vanishMinTicks,
    CONFIG.antiCombat.vanishBaseTicks - aggression * 20 * 4,
  );
}

function scheduleAggressiveReappearance(player, profile, delayTicks) {
  if (!player || !profile) {
    return;
  }

  const playerId = player.id;
  const aggression = clamp(profile.antiCombatAggression || 0, 0, 12);
  system.runTimeout(() => {
    const livePlayer = getPlayerById(playerId);
    const currentTick = system.currentTick || 0;
    if (!livePlayer || !isInterestingPlayer(livePlayer) || isPlayerInSafeRoom(livePlayer, currentTick)) {
      return;
    }

    const liveProfile = samplePlayerMemory(livePlayer, currentTick, true) || getProfile(livePlayer);
    increaseHeat(liveProfile, clamp(8 + aggression * 3, 8, 36));
    increaseFear(liveProfile, clamp(3 + aggression, 3, 18));
    liveProfile.lastSpawnAttemptTick = -999999;
    liveProfile.lastSuccessfulSpawnTick = -999999;
    if (aggression >= CONFIG.antiCombat.panicHitThreshold) {
      setTension(liveProfile, TENSION.Peak, currentTick, 20 * 16);
      requestVhsTier(livePlayer, VHS_TIER.Panic, currentTick, CONFIG.vhs.panicDurationTicks, "anti-combat-return");
    } else {
      setTension(liveProfile, TENSION.Buildup, currentTick, 20 * 18);
      requestVhsTier(livePlayer, VHS_TIER.High, currentTick, 20 * 5, "anti-combat-return");
    }
    const watcher = spawnWatcherForPlayer(livePlayer, currentTick);
    if (isEntityValid(watcher)) {
      const state = getState(watcher);
      if (state.phase !== PHASE.Vanish && state.phase !== PHASE.Ambush) {
        maybeStartStareHold(watcher, state, livePlayer, liveProfile, currentTick, "anti-combat-return", true);
      }
    }
    saveProfileMemory(liveProfile, true);
  }, Math.max(1, delayTicks));
}

function applyAntiCombatPsychologicalConsequences(player, profile, currentTick) {
  if (!player || !profile || isPlayerInSafeRoom(player, currentTick)) {
    return;
  }

  const aggression = clamp(profile.antiCombatAggression || 0, 0, 12);
  requestVhsTier(
    player,
    aggression >= CONFIG.antiCombat.panicHitThreshold ? VHS_TIER.Panic : VHS_TIER.High,
    currentTick,
    aggression >= CONFIG.antiCombat.panicHitThreshold ? CONFIG.vhs.panicDurationTicks : 20 * 7,
    "anti-combat-consequence",
  );
  playCue(player, aggression >= CONFIG.antiCombat.panicHitThreshold ? PHASE.Ambush : PHASE.Pressure, true);
  applyScareEffects(player, aggression >= 2);

  try {
    player.addEffect("minecraft:darkness", 20 * clamp(3 + aggression, 3, 10), {
      amplifier: 0,
      showParticles: false,
    });
  } catch (_error) {
    incrementDebugStat("failedEffects");
  }

  if (currentTick - (profile.lastAntiCombatMessageTick || -999999) >= CONFIG.antiCombat.warningMessageCooldownTicks) {
    profile.lastAntiCombatMessageTick = currentTick;
    try {
      player.sendMessage("§8You cannot solve this by fighting.");
    } catch (_error) {
      // Text warnings are optional.
    }
  }

  profile.psychologicalSuppressChaseUntilTick = Math.max(
    profile.psychologicalSuppressChaseUntilTick || 0,
    currentTick + randomInt(20 * 5, 20 * 12),
  );
  profile.nextPsychologicalDecisionTick = Math.min(profile.nextPsychologicalDecisionTick || currentTick, currentTick + 20 * 8);
  profile.lastSpawnAttemptTick = -999999;
  profile.lastSuccessfulSpawnTick = -999999;
}

function handleWatcherAttacked(event, fromDeath = false) {
  const watcher = event.hurtEntity || event.deadEntity;
  if (!isWatcherEntity(watcher)) {
    return false;
  }

  const source = event.damageSource;
  const attacker = source && source.damagingEntity && source.damagingEntity.typeId === "minecraft:player"
    ? source.damagingEntity
    : undefined;

  if (!attacker || !isInterestingPlayer(attacker)) {
    if (!fromDeath) {
      resetWatcherHealth(watcher);
      removeWatcherWithoutLoot(watcher);
    }
    return true;
  }

  const currentTick = system.currentTick || 0;
  const profile = samplePlayerMemory(attacker, currentTick, true) || getProfile(attacker);
  const attackerInSafeRoom = isPlayerInSafeRoom(attacker, currentTick);

  if (!fromDeath && currentTick - profile.lastWatcherHitTick < CONFIG.antiCombat.hitCooldownTicks) {
    resetWatcherHealth(watcher);
    removeWatcherWithoutLoot(watcher);
    return true;
  }

  if (currentTick - profile.lastWatcherHitTick > CONFIG.antiCombat.hitWindowTicks) {
    profile.antiCombatHits = 0;
  }

  profile.antiCombatHits = clamp((profile.antiCombatHits || 0) + 1, 0, 12);
  profile.antiCombatAggression = clamp(Math.max(profile.antiCombatAggression || 0, profile.antiCombatHits), 0, 12);
  profile.lastWatcherHitTick = currentTick;
  profile.lastAntiCombatTick = currentTick;

  if (attackerInSafeRoom) {
    clearVhsRequest(attacker);
    applyVhsTier(attacker, VHS_TIER.Off, currentTick, "safe-room-attack");
  } else {
    increaseHeat(profile, CONFIG.antiCombat.heatPerHit + profile.antiCombatAggression * 3);
    increaseFear(profile, CONFIG.antiCombat.fearPerHit + profile.antiCombatAggression);
    profile.suspicion = clamp(profile.suspicion + CONFIG.antiCombat.suspicionPerHit, 0, SUSPICION_CONFIG.max);
    updateSuspicionPhase(profile, currentTick);
    setTension(
      profile,
      profile.antiCombatAggression >= CONFIG.antiCombat.panicHitThreshold ? TENSION.Peak : TENSION.Buildup,
      currentTick,
      20 * 18,
    );
    applyAntiCombatPsychologicalConsequences(attacker, profile, currentTick);

    if (
      profile.antiCombatAggression >= CONFIG.antiCombat.panicHitThreshold &&
      currentTick - profile.lastAntiCombatPanicTick >= CONFIG.antiCombat.panicCooldownTicks
    ) {
      const panicDecision = horrorDirector.tryBeginScare(attacker, {
        source: "watcher_anti_combat_panic",
        intensity: 4,
        minimumQuietTicks: 20 * 35,
        buildupTicks: 20,
        peakTicks: CONFIG.vhs.panicDurationTicks,
        reliefTicks: 20 * 20,
        globalCooldownTicks: CONFIG.antiCombat.panicCooldownTicks,
        playerCooldownTicks: CONFIG.antiCombat.panicCooldownTicks,
        currentTick,
      });
      if (panicDecision.allowed) {
        profile.lastAntiCombatPanicTick = currentTick;
        requestVhsTier(attacker, VHS_TIER.Panic, currentTick, CONFIG.vhs.panicDurationTicks, "anti-combat-hit");
        playCue(attacker, PHASE.Ambush, true);
      }
    } else {
      requestVhsTier(attacker, VHS_TIER.High, currentTick, 20 * 6, "anti-combat-hit");
      playCue(attacker, PHASE.Pressure, true);
    }
  }

  if (!fromDeath) {
    const state = watcherStates.get(watcher.id);
    if (state && !attackerInSafeRoom) {
      state.vanishUntilTick = currentTick + computeAntiCombatVanishTicks(profile);
      state.cooldownPlayerId = attacker.id;
      state.lastReason = "anti-combat-hit";
    }
    resetWatcherHealth(watcher);
    if (!removeWatcherWithoutLoot(watcher) && state) {
      enterPhase(watcher, state, attacker, profile, PHASE.Vanish, currentTick, "anti-combat-hit", {
        skipImmediateMove: true,
        skipAnimation: true,
      });
    }
  }

  if (!attackerInSafeRoom) {
    scheduleAggressiveReappearance(attacker, profile, computeAntiCombatReappearTicks(profile));
  }
  saveProfileMemory(profile, true);
  return true;
}

function handleWatcherDeath(event) {
  if (!event || !isWatcherEntity(event.deadEntity)) {
    return;
  }

  handleWatcherAttacked(event, true);
  if (event.deadEntity && event.deadEntity.id) {
    trackedWatchers.delete(event.deadEntity.id);
    watcherStates.delete(event.deadEntity.id);
  }
}

function debugPlayer(player, message) {
  if (!debugEnabled || !player) {
    return;
  }

  try {
    player.sendMessage(`[Watcher] ${message}`);
  } catch (_error) {
    // Debug is optional.
  }
}

function chooseStateAdaptiveTactic(state, profile, phase, currentTick, force = false) {
  if (!state || !profile?.adaptive) {
    return undefined;
  }
  if (phase === PHASE.Dormant || phase === PHASE.Vanish || phase === PHASE.Psychological) {
    state.adaptiveTactic = undefined;
    state.adaptiveTacticUntilTick = 0;
    return undefined;
  }
  if (!force && state.adaptiveTactic && currentTick < (state.adaptiveTacticUntilTick || 0)) {
    return state.adaptiveTactic;
  }

  const tactic = chooseAdaptiveTactic(profile.adaptive, {
    phase,
    pressure: getProfilePressure(profile),
    fear: profile.fear,
    tick: currentTick,
  });
  state.adaptiveTactic = tactic;
  state.adaptiveTacticUntilTick = currentTick + randomInt(
    CONFIG.adaptive.tacticMinTicks,
    CONFIG.adaptive.tacticMaxTicks,
  );
  recordAdaptiveTactic(profile.adaptive, tactic, currentTick);
  return tactic;
}

function maybePlayAdaptiveTacticCue(player, state, profile, currentTick) {
  if (!player || !state || !profile || !state.adaptiveTactic) {
    return false;
  }

  const tactic = state.adaptiveTactic;
  if (tactic === ADAPTIVE_TACTIC.FalseRearThreat) {
    const location = pointBehindPlayer(player, randomFloat(2.4, 4.8), randomFloat(-1.2, 1.2), randomFloat(0.1, 1.1));
    return tryPlayForOnePlayer(
      player,
      "adaptive:false_rear",
      HORROR_SOUND.StalkerStepBehind,
      { location, volume: 0.66, pitch: randomFloat(0.82, 1.06) },
      20 * 34,
    );
  }

  if (tactic === ADAPTIVE_TACTIC.ShadowPursuit) {
    const location = pointBehindPlayer(player, randomFloat(6.0, 11.0), randomFloat(-3.5, 3.5), randomFloat(0.4, 1.5));
    return tryPlayForOnePlayer(
      player,
      "adaptive:shadow_pursuit",
      HORROR_SOUND.StalkerBreathFar,
      { location, volume: 0.46, pitch: randomFloat(0.72, 0.94) },
      20 * 42,
    );
  }

  if (tactic === ADAPTIVE_TACTIC.RoutePoisoning && profile.adaptive.escapeConfidence >= 0.35) {
    const escape = normalize({
      x: profile.adaptive.escapeDirection.x,
      y: 0,
      z: profile.adaptive.escapeDirection.z,
    });
    const location = {
      x: player.location.x + escape.x * randomFloat(9, 16),
      y: player.location.y + randomFloat(0.2, 1.3),
      z: player.location.z + escape.z * randomFloat(9, 16),
    };
    return tryPlayAtPosition(
      player,
      "adaptive:route_poison",
      HORROR_SOUND.StalkerWallScratch,
      location,
      { volume: 0.5, pitch: randomFloat(0.74, 0.96) },
      20 * 52,
    );
  }

  if (tactic === ADAPTIVE_TACTIC.EmptyRoom) {
    return true;
  }

  if (tactic === ADAPTIVE_TACTIC.ShortHunt) {
    const location = pointHiddenNearPlayer(player, {
      behindMin: 7,
      behindMax: 13,
      sideMin: 3,
      sideMax: 7,
      yMin: 0.2,
      yMax: 1.5,
    });
    return tryPlayAtPosition(
      player,
      "adaptive:short_hunt",
      HORROR_SOUND.StalkerBreathNear,
      location,
      { volume: 0.58, pitch: randomFloat(0.78, 0.96) },
      20 * 48,
    );
  }

  return false;
}

function hasHonestAttackEvidence(player, entity, state, profile, currentTick) {
  if (!player || !entity || !state || !profile || !entity.dimension || !player.dimension || !state.evidence) {
    return false;
  }
  const sameDimension = entity.dimension.id === player.dimension.id;
  const evidenceLocation = state.evidence.lastKnownPosition;
  const withinSoundRange = !!(
    sameDimension &&
    evidenceLocation &&
    distance(entity.location, evidenceLocation) <= CONFIG.soundDetectionRadius
  );
  const heardTicksAgo = currentTick - (profile.lastHeardByWatcherTick || -999999);
  return hasWatcherAttackEvidence(state.evidence, currentTick) && hasAttackEvidencePolicy({
    confirmedSightTicks: state.confirmedSightTicks || 0,
    heardTicksAgo,
    soundWithinRange: withinSoundRange,
  });
}

function scheduleNextMove(state, phase, currentTick) {
  const baseRange = CONFIG.moveDelayRanges[phase] || CONFIG.moveDelayRanges.shadow;
  let minTicks = baseRange[0];
  let maxTicks = baseRange[1];
  if (state?.adaptiveTactic === ADAPTIVE_TACTIC.EmptyRoom) {
    minTicks = Math.floor(minTicks * 1.25);
    maxTicks = Math.floor(maxTicks * 1.45);
  } else if (state?.adaptiveTactic === ADAPTIVE_TACTIC.ShortHunt) {
    minTicks = Math.max(20 * 7, Math.floor(minTicks * 0.72));
    maxTicks = Math.max(minTicks + 20, Math.floor(maxTicks * 0.78));
  }
  state.nextMoveTick = currentTick + randomInt(minTicks, maxTicks);
}

function enterPhase(entity, state, player, profile, phase, currentTick, reason = "phase", options = {}) {
  if (player && state.ownerPlayerId && state.ownerPlayerId !== player.id) {
    return;
  }

  const prevPhase = state.phase;
  state.phase = phase;
  if (player && !state.ownerPlayerId) {
    state.ownerPlayerId = player.id;
  }
  state.targetPlayerId = player ? player.id : undefined;
  state.phaseChangedTick = currentTick;
  state.exposedTicks = 0;
  state.lostTargetTicks = 0;
  state.failedSpotCount = 0;
  state.lastTargetLocation = state.evidence?.lastKnownPosition
    ? cloneLocation(state.evidence.lastKnownPosition)
    : state.lastTargetLocation;
  state.lastReason = reason;

  if (prevPhase !== phase) {
    resetPhaseTransitionDelay(state);
    resetStalkerTeleportBudget(entity, `phase:${prevPhase}->${phase}`);
    state.adaptiveTacticUntilTick = 0;
    if (phase === PHASE.Dormant || phase === PHASE.Vanish || phase === PHASE.Psychological) {
      state.adaptiveTactic = undefined;
    }
    if (phase === PHASE.Dormant || phase === PHASE.Vanish) {
      state.confirmedSightTicks = 0;
    }
    if (player) {
      recordPlayerTelemetry(player, "stalker_state", {
        currentTick,
        source: "watcher_stalker",
        reason,
        status: "phase_transition",
        previousPhase: prevPhase,
        phase,
        heat: profile ? profile.heat : 0,
        fear: profile ? profile.fear : 0,
      });
    }
  }

  if (phase === PHASE.Dormant) {
    resetWatcherPerception(state, currentTick);
  }

  if (phase === PHASE.Vanish) {
    state.vanishUntilTick = currentTick + CONFIG.vanishTicks;
    state.cooldownPlayerId = player ? player.id : state.cooldownPlayerId;
    hideWatcher(entity, state, player, profile, currentTick);
  }

  if (phase !== PHASE.Ambush) {
    state.ambushLocation = undefined;
    state.ambushDimensionId = undefined;
    state.ambushOutcome = undefined;
  }

  if (player) {
    const squad = getSquadWatchers(player.id, entity.id);
    state.squadRole = assignSquadRole(entity.id, squad, phase);
  }

  scheduleNextMove(state, phase, currentTick);

  if (!options.skipAnimation && phase !== PHASE.Ambush) {
    setWatcherAnimation(entity, getWatcherBaseAnimationForPhase(phase), { force: prevPhase !== phase });
  }

  if (
    player &&
    phase !== PHASE.Dormant &&
    phase !== PHASE.Ambush &&
    phase !== PHASE.Vanish &&
    !options.skipImmediateMove
  ) {
    moveWatcher(entity, state, player, profile, currentTick, true);
  }

  if (player) {
    debugPlayer(player, `${phase} heat=${profile.heat} fear=${profile.fear} mode=${profile.behaviorMode} reason=${reason}`);
  }
}

function moveWatcher(entity, state, player, profile, currentTick, force = false) {
  if (!player || !isInterestingPlayer(player) || isPlayerInSafeRoom(player, currentTick)) {
    return false;
  }

  const phase = state.phase === PHASE.Dormant ? PHASE.Observe : state.phase;
  const dimensionSyncPending = !!(entity.dimension && player.dimension && entity.dimension.id !== player.dimension.id);
  if (!state.evidence?.lastKnownPosition && !dimensionSyncPending) {
    state.nextMoveTick = currentTick + randomInt(20 * 8, 20 * 16);
    return false;
  }
  if (shouldUseEvidenceMovement(state, currentTick)) {
    return moveWatcherByEvidence(entity, state, player, profile, currentTick, force);
  }

  const adaptiveTactic = chooseStateAdaptiveTactic(state, profile, phase, currentTick);
  const result = chooseTeleportSpot(player, profile, phase, state, adaptiveTactic);

  if (!result) {
    state.failedSpotCount += 1;
    state.nextMoveTick = currentTick + randomInt(20, 60);
    return false;
  }

  const dimensionSync = !!(entity.dimension && player.dimension && entity.dimension.id !== player.dimension.id);
  const moved = teleportWatcher(entity, result.spot, player.location, player.dimension, {
    player,
    state,
    phase,
    reason: dimensionSync ? "dimension-sync" : (force ? `immediate-${phase}` : `scheduled-${phase}`),
    currentTick,
    force: dimensionSync,
    directorPhase: profile?.tensionState,
    protectedRelief: profile?.tensionState === TENSION.Relief,
    physicallyValid: true,
  });
  if (!moved) {
    state.failedSpotCount += 1;
    state.nextMoveTick = currentTick + randomInt(20, 60);
    return false;
  }

  state.failedSpotCount = 0;
  state.lastMoveTick = currentTick;
  state.totalMoves += 1;
  state.lastAnchorKey = result.anchor ? result.anchor.key : undefined;
  if (result.anchor) {
    recordSpotVisit(state, result.anchor.key);
  }
  scheduleNextMove(state, state.phase, currentTick);

  setWatcherAnimation(entity, getWatcherBaseAnimationForPhase(state.phase), { force: true });

  if (state.phase === PHASE.Pressure) {
    spawnParticles(entity.dimension, entity.location, 0.25);
  }

  return true;
}

function selectTarget(entity, state) {
  const currentTick = system.currentTick || 0;
  const ownedPlayerId = state.ownerPlayerId || state.targetPlayerId;

  if (ownedPlayerId) {
    const owner = getPlayerById(ownedPlayerId);
    if (
      owner &&
      isInterestingPlayer(owner) &&
      !isPlayerOnCooldown(owner) &&
      !isPlayerInSafeRoom(owner, currentTick)
    ) {
      state.ownerPlayerId = owner.id;
      state.targetPlayerId = owner.id;
      return {
        player: owner,
        profile: getProfile(owner),
        score: 999,
      };
    }

    state.targetPlayerId = undefined;
    return undefined;
  }

  let best = undefined;
  for (const player of getCachedPlayers()) {
    if (!isInterestingPlayer(player) || isPlayerOnCooldown(player) || isPlayerInSafeRoom(player, currentTick)) {
      continue;
    }

    if (getAssignedWatcherCount(player) >= CONFIG.maxWatchersPerPlayer) {
      continue;
    }

    const profile = getProfile(player);
    const sameDimension = entity.dimension && entity.dimension.id === player.dimension.id;
    if (!sameDimension) {
      continue;
    }

    const dist = distance(player.location, entity.location);
    if (dist > CONFIG.targetSearchRadius) {
      continue;
    }

    const assigned = getAssignedWatcherCount(player);
    const squad = getSquadWatchers(player.id, undefined);
    const packHunt = profile.heat >= CONFIG.squadMinHeatForPack && assigned < CONFIG.maxSquadSize;
    const assignedPenalty = packHunt ? assigned * 8 : assigned * 35;

    const baseScore = scoreCell(profile.baseCell);
    const proximityScore = Math.max(0, 80 - dist);
    const behaviorScore = CONFIG.behaviorHeatBoost[profile.behaviorMode] || 1;
    const score = profile.heat * 2 + profile.fear + baseScore + proximityScore - assignedPenalty + behaviorScore * 5;

    if (!best || score > best.score) {
      best = { player, profile, score };
    }
  }

  if (best) {
    state.ownerPlayerId = best.player.id;
    state.targetPlayerId = best.player.id;
  }

  return best;
}

function updateTargetPressure(player, watcher, state, profile, currentTick) {
  const dist = distance(player.location, watcher.location);
  const visible = hasLineOfSight(player.dimension, getEyeLocation(player), getEyeLocation(watcher));
  const focused = isPlayerLookingAtWatcher(player, watcher);

  const previousSightTicks = state.confirmedSightTicks || 0;
  if (visible) {
    state.confirmedSightTicks = clamp(
      previousSightTicks + CONFIG.tickInterval,
      0,
      CONFIG.adaptive.sightEvidenceMaxTicks,
    );
    const sightStrength = computeSightEvidenceStrength({
      distance: dist,
      maxDistance: CONFIG.maxLineOfSightDistance,
      lightLevel: getLightLevel(player.dimension, player.location),
      sneaking: isPlayerSneaking(player),
      obstructed: false,
    });
    const refreshRouteHints = currentTick - (state.lastRouteHintSnapshotTick || -999999) >= 20 * 4;
    const routeHints = refreshRouteHints
      ? snapshotEvidenceRouteHints(profile, player.location, player.dimension.id)
      : state.evidence.routeHints;
    if (refreshRouteHints) {
      state.lastRouteHintSnapshotTick = currentTick;
    }
    observeWatcherEvidence(state.evidence, {
      kind: EVIDENCE_KIND.Sight,
      location: player.location,
      strength: sightStrength,
      contactTicks: state.confirmedSightTicks,
      movementDirection: getEvidenceMovementDirection(profile),
      routeHints,
    }, currentTick);
    const sightReactionTick = currentTick + getWatcherEvidenceReactionDelayTicks(EVIDENCE_KIND.Sight, sightStrength);
    if (!state.nextMoveTick || state.nextMoveTick < currentTick) {
      state.nextMoveTick = sightReactionTick;
    } else {
      state.nextMoveTick = Math.min(state.nextMoveTick, sightReactionTick);
    }
    if (currentTick - (state.lastAdaptiveExposureTick || -999999) >= CONFIG.adaptive.exposureObservationCooldownTicks) {
      observeAdaptiveExposure(profile.adaptive, currentTick);
      state.lastAdaptiveExposureTick = currentTick;
    }
  } else {
    const hadReliableContact = state.evidence?.confirmed || previousSightTicks >= 15;
    state.confirmedSightTicks = Math.max(0, previousSightTicks - CONFIG.tickInterval * 2);
    if (hadReliableContact && state.evidence?.lastKnownPosition && state.evidence.behavior !== WATCHER_BEHAVIOR.Search) {
      beginWatcherSearch(state.evidence, currentTick);
    }
    tickWatcherEvidence(state.evidence, currentTick);
  }

  state.behaviorState = chooseEvidenceDrivenBehavior(state.evidence, {
    directorPhase: profile.tensionState,
    safeRoom: false,
    currentTick,
  });

  if (visible && focused) {
    state.exposedTicks += CONFIG.tickInterval;
    state.lastSeenByTargetTick = currentTick;

    const retreatLimit = CONFIG.stareRetreatTicks[state.phase] || 20 * 4;
    if (state.exposedTicks >= retreatLimit && state.phase !== PHASE.Pressure) {
      profile.heat = clamp(profile.heat - 3, 0, 100);
      increaseFear(profile, 3);
      state.nextMoveTick = currentTick;
      state.lastReason = "stared-retreat";
    } else if (state.exposedTicks <= 20) {
      increaseHeat(profile, Math.max(1, Math.floor(CONFIG.seenHeat / 2)));
      increaseFear(profile, 2);
      recordSuspiciousAction(player, profile, "spotted_watcher", 5, { fear: 1, cooldownTicks: 20 * 5, countsAsSoundEvidence: false });
    } else if (state.phase === PHASE.Pressure) {
      increaseFear(profile, 4);
      increaseHeat(profile, 1);
      recordSuspiciousAction(player, profile, "focused_watcher", 4, { fear: 1, cooldownTicks: 20 * 5, countsAsSoundEvidence: false });
    } else {
      increaseFear(profile, 2);
    }
  } else if (visible && state.phase === PHASE.Pressure) {
    state.exposedTicks = Math.max(0, state.exposedTicks - CONFIG.tickInterval);
    increaseHeat(profile, 1);
  } else {
    state.exposedTicks = Math.max(0, state.exposedTicks - CONFIG.tickInterval * 2);
  }

  if (dist <= 11) {
    increaseHeat(profile, CONFIG.closeHeat);
    increaseFear(profile, dist <= CONFIG.nearRepositionDistance ? 8 : 3);
    recordSuspiciousAction(player, profile, "close_watcher", 5, { fear: 2, cooldownTicks: 20 * 6, countsAsSoundEvidence: false });
  }

  if (profile.baseCell && state.phase === PHASE.Pressure) {
    increaseHeat(profile, CONFIG.baseHeat);
  }

  decayProfile(profile, currentTick);
}


function shouldMove(entity, state, player, currentTick) {
  if (currentTick < (state.stareHoldUntilTick || 0)) {
    return false;
  }

  if (currentTick >= state.nextMoveTick) {
    return true;
  }

  if (!entity.dimension || entity.dimension.id !== player.dimension.id) {
    return true;
  }

  const dist = distance(player.location, entity.location);
  if (dist <= CONFIG.nearRepositionDistance && state.phase !== PHASE.Pressure) {
    return true;
  }

  if (dist >= CONFIG.farRepositionDistance) {
    return true;
  }

  const exposedLimit = CONFIG.exposedRepositionTicks[state.phase] || 20;
  return state.exposedTicks >= exposedLimit;
}

function getStareHoldTicksForPhase(phase) {
  return randomTickRange(CONFIG.stareHoldTicks[phase] || CONFIG.stareHoldTicks.shadow, 20 * 4);
}

function getStareHoldChance(state, player, profile, currentTick, reason) {
  if (!state || !player || !profile) {
    return 0;
  }

  let chance = CONFIG.stareHoldChance[state.phase] || 0;
  const aggression = clamp(profile.antiCombatAggression || 0, 0, 12);
  const watcher = trackedWatchers.get(state.entityId);
  const watcherLocation = isEntityValid(watcher) ? watcher.location : player.location;
  const dist = distance(player.location, watcherLocation);

  if (reason === "ambush-restraint") {
    chance = Math.max(chance, CONFIG.ambushRestraintChance - aggression * 0.025);
  }
  if (state.phase === PHASE.Pressure && dist <= 15) {
    chance += 0.14;
  }
  if (isPlayerLookingAtLocation(player, watcherLocation, 0.35)) {
    chance += 0.05;
  }
  if (profile.suspicionPhase === SUSPICION_PHASE.AttackReady) {
    chance -= 0.12;
  }
  if (currentTick < (profile.psychologicalSuppressChaseUntilTick || 0)) {
    chance += 0.12;
  }
  if (state.adaptiveTactic === ADAPTIVE_TACTIC.StareContest) {
    chance += 0.32;
  } else if (state.adaptiveTactic === ADAPTIVE_TACTIC.BaitSighting) {
    chance -= 0.08;
  } else if (state.adaptiveTactic === ADAPTIVE_TACTIC.FalseRearThreat) {
    chance -= 0.06;
  }

  return clamp(chance, 0, 0.88);
}

function faceWatcherTowardPlayer(entity, player) {
  if (!isEntityValid(entity) || !player || !entity.dimension || !player.dimension || entity.dimension.id !== player.dimension.id) {
    return false;
  }
  return teleportWatcher(entity, entity.location, player.location, entity.dimension, {
    player,
    state: watcherStates.get(entity.id),
    phase: watcherStates.get(entity.id)?.phase || PHASE.Observe,
    reason: "face-player",
    currentTick: system.currentTick || 0,
    skipGovernor: true,
    skipBudget: true,
  });
}

function maybeStartStareHold(entity, state, player, profile, currentTick, reason = "stare", forced = false) {
  if (!isEntityValid(entity) || !player || !profile || isPlayerInSafeRoom(player, currentTick)) {
    return false;
  }
  if (state.phase === PHASE.Ambush || state.phase === PHASE.Vanish || state.phase === PHASE.Dormant) {
    return false;
  }
  if (currentTick < (state.stareHoldUntilTick || 0)) {
    faceWatcherTowardPlayer(entity, player);
    setWatcherAnimation(entity, "Idle", { force: true });
    return true;
  }
  if (!forced && currentTick - (state.lastStareHoldTick || -999999) < 20 * 6) {
    return false;
  }

  const chance = forced ? 1 : getStareHoldChance(state, player, profile, currentTick, reason);
  if (!forced && Math.random() > chance) {
    return false;
  }

  const holdTicks = getStareHoldTicksForPhase(state.phase);
  state.stareHoldUntilTick = currentTick + holdTicks;
  state.lastStareHoldTick = currentTick + randomTickRange(CONFIG.stareHoldCooldownTicks, 20 * 22);
  state.nextMoveTick = Math.max(state.nextMoveTick || 0, state.stareHoldUntilTick + randomInt(10, 30));
  state.lastReason = reason;
  faceWatcherTowardPlayer(entity, player);
  setWatcherAnimation(entity, "Idle", { force: true });
  increaseFear(profile, state.phase === PHASE.Pressure ? 4 : 2);
  increaseHeat(profile, state.phase === PHASE.Pressure ? 1 : 0);
  if (Math.random() < 0.35 || forced) {
    playCue(player, state.phase, forced);
  }
  return true;
}

function getEncounterOutcomeCounts(profile) {
  const fakeout = Math.max(0, Math.floor(profile.fakeoutCount || 0));
  const nearMiss = Math.max(0, Math.floor(profile.nearMissCount || 0));
  const minorDamage = Math.max(0, Math.floor(profile.minorDamageCount || 0));
  const fullHit = Math.max(0, Math.floor(profile.ambushHitCount || 0));
  const total = Math.max(0, Math.floor(profile.encounterCount || 0));
  return { fakeout, nearMiss, minorDamage, fullHit, total };
}

function normalizeEncounterWeights(weights) {
  const total = Math.max(0.0001, weights.fakeout + weights.nearMiss + weights.minorDamage + weights.fullHit);
  return {
    fakeout: weights.fakeout / total,
    nearMiss: weights.nearMiss / total,
    minorDamage: weights.minorDamage / total,
    fullHit: weights.fullHit / total,
  };
}

function dampenOutcomeIfOverTarget(weights, key, count, total, target) {
  if (total < 8 || target <= 0) {
    return;
  }
  if (count / total > target * 1.25) {
    weights[key] *= 0.35;
  }
}

function chooseWeightedEncounterOutcome(weights) {
  const roll = Math.random();
  let cursor = weights.fakeout;
  if (roll < cursor) {
    return AMBUSH_OUTCOME.Fakeout;
  }
  cursor += weights.nearMiss;
  if (roll < cursor) {
    return AMBUSH_OUTCOME.NearMiss;
  }
  cursor += weights.minorDamage;
  if (roll < cursor) {
    return AMBUSH_OUTCOME.MinorDamage;
  }
  return AMBUSH_OUTCOME.Hit;
}

function chooseAmbushOutcome(player, profile, state, ambushSpot) {
  const focused = ambushSpot ? isPlayerLookingAtLocation(player, addVec(ambushSpot, 0, 0.9, 0), 0.45) : false;
  const counts = getEncounterOutcomeCounts(profile);
  const aggression = clamp(profile.antiCombatAggression || 0, 0, 12);
  const pressure = getProfilePressure(profile);
  const attackDebt = Math.max(0, Math.floor(Number(profile.attackDebt) || 0));
  const ignoredWarnings = profile.suspicionPhase === SUSPICION_PHASE.AttackReady || profile.warningCueUntilTick > (system.currentTick || 0);
  const highFear = profile.fear >= 35 || pressure >= CONFIG.phaseHeat.ambush || attackDebt >= 2;

  let weights;
  if (highFear && (ignoredWarnings || attackDebt >= 2 || counts.total >= 4)) {
    weights = { fakeout: 0.00, nearMiss: 0.15, minorDamage: 0.50, fullHit: 0.35 };
  } else if (counts.total >= 3 || aggression >= CONFIG.antiCombat.panicHitThreshold || attackDebt >= 1) {
    weights = { fakeout: 0.05, nearMiss: 0.25, minorDamage: 0.45, fullHit: 0.25 };
  } else {
    weights = {
      fakeout: CONFIG.encounterOutcomeWeights.fakeout,
      nearMiss: CONFIG.encounterOutcomeWeights.nearMiss,
      minorDamage: CONFIG.encounterOutcomeWeights.minorDamage,
      fullHit: CONFIG.encounterOutcomeWeights.fullHit,
    };
  }

  if (aggression > 0 || pressure >= CONFIG.phaseHeat.ambush) {
    const riskNudge = clamp(aggression * 0.012 + Math.max(0, pressure - CONFIG.phaseHeat.ambush) / 450, 0, 0.18);
    weights.fakeout = Math.max(0, weights.fakeout - riskNudge);
    weights.nearMiss = Math.max(0.12, weights.nearMiss - riskNudge * 0.25);
    weights.minorDamage += riskNudge * 0.65;
    weights.fullHit += riskNudge * 0.35;
  }

  if (focused) {
    weights.fullHit *= 0.65;
    weights.minorDamage *= 0.9;
    weights.nearMiss += 0.10;
  }

  if (counts.total < 1 && attackDebt <= 0) {
    weights.fullHit = 0;
    weights.minorDamage = Math.max(weights.minorDamage, 0.12);
  }

  if (attackDebt >= 1) {
    weights.fakeout = Math.min(weights.fakeout, 0.05);
    weights.fullHit = Math.max(weights.fullHit, attackDebt >= 2 ? 0.30 : 0.20);
    weights.minorDamage = Math.max(weights.minorDamage, attackDebt >= 2 ? 0.45 : 0.38);
  }

  if (profile.warningCueUntilTick > (system.currentTick || 0) && attackDebt >= 1) {
    weights.fakeout = 0;
    weights.nearMiss = Math.min(weights.nearMiss, 0.18);
    weights.minorDamage = Math.max(weights.minorDamage, 0.46);
    weights.fullHit = Math.max(weights.fullHit, 0.28);
  }

  dampenOutcomeIfOverTarget(weights, "fakeout", counts.fakeout, counts.total, 0.32);
  dampenOutcomeIfOverTarget(weights, "nearMiss", counts.nearMiss, counts.total, 0.42);
  dampenOutcomeIfOverTarget(weights, "minorDamage", counts.minorDamage, counts.total, 0.35);
  dampenOutcomeIfOverTarget(weights, "fullHit", counts.fullHit, counts.total, 0.18);

  return chooseWeightedEncounterOutcome(normalizeEncounterWeights(weights));
}

function getLungeSpot(player) {
  const basis = getPlayerBasis(player);
  const side = Math.random() < 0.5 ? -1 : 1;
  const candidate = {
    x: player.location.x + basis.back.x * randomFloat(2.3, 3.8) + basis.right.x * side * randomFloat(0.4, 1.4),
    y: player.location.y + randomInt(-1, 1),
    z: player.location.z + basis.back.z * randomFloat(2.3, 3.8) + basis.right.z * side * randomFloat(0.4, 1.4),
  };

  return resolveStandSpot(player.dimension, candidate, PHASE.Ambush);
}

function startAmbush(entity, state, player, profile, currentTick, options = {}) {
  if (isPlayerInSafeRoom(player, currentTick)) {
    clearVhsRequest(player);
    enterPhase(entity, state, player, profile, PHASE.Vanish, currentTick, "safe-room-ambush-block", {
      skipImmediateMove: true,
    });
    return;
  }

  if (!canStartMajorScare(profile, currentTick)) {
    warnBeforeAttack(player, entity, state, profile, currentTick);
    enterPhase(entity, state, player, profile, PHASE.Pressure, currentTick, "ambush-gated");
    return;
  }

  if (!options.bypassHonestEvidence && !hasHonestAttackEvidence(player, entity, state, profile, currentTick)) {
    warnBeforeAttack(player, entity, state, profile, currentTick);
    enterPhase(entity, state, player, profile, PHASE.Pressure, currentTick, "ambush-no-honest-evidence");
    return;
  }

  const scareDecision = horrorDirector.tryBeginScare(player, {
    source: "watcher_ambush",
    intensity: 4,
    minimumQuietTicks: 20 * 45,
    buildupTicks: CONFIG.ambushWarmupTicks,
    peakTicks: CONFIG.ambushMaxTicks,
    reliefTicks: 20 * 30,
    globalCooldownTicks: 20 * 90,
    playerCooldownTicks: CONFIG.samePlayerSpawnCooldownTicks,
    sourceCooldownTicks: CONFIG.minSpawnAttemptIntervalTicks,
    currentTick,
  });
  if (!scareDecision.allowed) {
    warnBeforeAttack(player, entity, state, profile, currentTick);
    enterPhase(entity, state, player, profile, PHASE.Pressure, currentTick, `ambush-director-${scareDecision.reason || "blocked"}`);
    return;
  }

  profile.peakMajorUsed = true;
  profile.lastMajorScareTick = currentTick;

  const adaptiveTactic = chooseStateAdaptiveTactic(state, profile, PHASE.Ambush, currentTick, true);
  const freshDirectSight = !!(
    state.evidence?.confirmed &&
    currentTick - (state.evidence.lastSightTick || -999999) <= 20 * 2
  );
  const result = options.bypassHonestEvidence || freshDirectSight
    ? chooseTeleportSpot(player, profile, PHASE.Ambush, state, adaptiveTactic)
    : chooseEvidenceTeleportSpot(player, profile, PHASE.Ambush, state, currentTick);
  if (!result) {
    horrorDirector.endScare("watcher_ambush", { currentTick, reliefTicks: 20 * 12 });
    enterRelief(profile, currentTick, "ambush-no-spot");
    enterPhase(entity, state, player, profile, PHASE.Vanish, currentTick, "ambush-no-spot");
    markPlayerCooldown(player);
    return;
  }

  state.phase = PHASE.Ambush;
  state.targetPlayerId = player.id;
  state.ambushLocation = result.spot;
  state.ambushDimensionId = player.dimension.id;
  state.ambushOutcome = chooseAmbushOutcome(player, profile, state, result.spot);
  state.ambushStartTick = currentTick;
  state.ambushLastPulseTick = currentTick;
  state.phaseChangedTick = currentTick;
  state.lastReason = "ambush";
  incrementDebugStat("ambushesStarted");
  const armedTeleport = teleportWatcher(entity, result.spot, player.location, player.dimension, {
    player,
    state,
    phase: PHASE.Ambush,
    reason: "ambush-warning",
    currentTick,
    maxPerEncounter: 1,
    minTicks: 20 * 8,
    visibleMinTicks: 20 * 16,
    directorPhase: profile.tensionState,
    protectedRelief: profile.tensionState === TENSION.Relief,
    physicallyValid: true,
    patternKey: result.patternKey,
    allowVisibleSetup: true,
  });
  if (!armedTeleport) {
    horrorDirector.endScare("watcher_ambush", { currentTick, reliefTicks: 20 * 12 });
    enterRelief(profile, currentTick, "ambush-governor-blocked");
    profile.attackDebt = Math.min(4, (profile.attackDebt || 0) + 1);
    enterPhase(entity, state, player, profile, PHASE.Vanish, currentTick, "ambush-governor-blocked");
    markPlayerCooldownSeconds(player, CONFIG.shortFakeoutCooldownSeconds);
    return;
  }
  state.confirmedSightTicks = 0;
  spawnParticles(player.dimension, result.spot, 0.55);
  setWatcherAnimation(entity, "Roar", {
    force: true,
    durationTicks: CONFIG.animationDurationsTicks.roar,
  });
  requestVhsTier(
    player,
    state.ambushOutcome === AMBUSH_OUTCOME.Fakeout ? VHS_TIER.High : VHS_TIER.Panic,
    currentTick,
    state.ambushOutcome === AMBUSH_OUTCOME.Fakeout ? 20 * 5 : CONFIG.vhs.panicDurationTicks,
    `stalker-ambush-${state.ambushOutcome}`,
  );
  playCue(player, PHASE.Ambush, true);
  if (state.ambushOutcome !== AMBUSH_OUTCOME.Fakeout) {
    applyScareEffects(player, state.ambushOutcome !== AMBUSH_OUTCOME.NearMiss);
  }
  debugPlayer(player, `ambush armed outcome=${state.ambushOutcome} heat=${profile.heat} fear=${profile.fear} mode=${profile.behaviorMode}`);
}

function abortAmbush(entity, state, player, profile, currentTick, reason) {
  horrorDirector.endScare("watcher_ambush", { currentTick, reliefTicks: 20 * 24 });
  profile.heat = clamp(profile.heat - 16, 0, 100);
  profile.fear = clamp(profile.fear + 8, 0, 100);
  const ambushDebtReason = String(reason || "");
  if (ambushDebtReason.includes("escaped") || ambushDebtReason.includes("blocked") || ambushDebtReason.includes("failed")) {
    profile.attackDebt = Math.min(4, (profile.attackDebt || 0) + 1);
  }
  const fadeToShadow = reason === "ambush-escaped" && Math.random() < 0.6;
  if (fadeToShadow) {
    enterPhase(entity, state, player, profile, PHASE.Shadow, currentTick, reason);
  } else {
    enterRelief(profile, currentTick, reason);
    enterPhase(entity, state, player, profile, PHASE.Vanish, currentTick, reason);
    markPlayerCooldown(player);
  }
  saveProfileMemory(profile, true);
}

function finishAmbush(entity, state, player, profile, currentTick) {
  const marker = state.ambushLocation;
  if (!marker || !player) {
    return;
  }
  if (isPlayerInSafeRoom(player, currentTick)) {
    abortAmbush(entity, state, player, profile, currentTick, "safe-room-ambush-block");
    clearVhsRequest(player);
    return;
  }

  let outcome = state.ambushOutcome || chooseAmbushOutcome(player, profile, state, marker);
  const attackSpot = marker;
  const playerDistanceFromWarning = distance(player.location, marker);
  const sameDimension = player.dimension.id === entity.dimension.id;
  const entityDistanceFromPlayer = sameDimension ? distance(player.location, entity.location) : Number.POSITIVE_INFINITY;
  const escapedWarning = playerDistanceFromWarning > CONFIG.ambushEscapeDistance;
  const freshLineOfSight = sameDimension && hasLineOfSight(
    player.dimension,
    getEyeLocation(entity),
    getEyeLocation(player),
  );

  if (escapedWarning) {
    outcome = AMBUSH_OUTCOME.NearMiss;
  }

  spawnParticles(player.dimension, attackSpot, outcome === AMBUSH_OUTCOME.Fakeout ? 0.9 : 0.75);
  playCue(player, PHASE.Ambush, true);

  const canDamage = hasWatcherAttackEvidence(state.evidence, currentTick) && canResolveAdaptiveAmbushDamage({
    outcomeDamageCapable: outcome === AMBUSH_OUTCOME.MinorDamage || outcome === AMBUSH_OUTCOME.Hit,
    sameDimension,
    escapedWarning,
    nearWarningOrEntity:
      playerDistanceFromWarning <= CONFIG.ambushEscapeDistance ||
      entityDistanceFromPlayer <= CONFIG.ambushHitDistance,
    freshLineOfSight,
  });

  profile.encounterCount = (profile.encounterCount || 0) + 1;

  if (outcome === AMBUSH_OUTCOME.Fakeout) {
    setWatcherAnimation(entity, "Roar", {
      force: true,
      durationTicks: Math.min(CONFIG.animationDurationsTicks.roar, 20),
    });
    profile.heat = clamp(profile.heat - 14, 0, 100);
    profile.fear = clamp(profile.fear + 12, 0, 100);
    profile.fakeoutCount = (profile.fakeoutCount || 0) + 1;
    profile.attackDebt = Math.min(4, (profile.attackDebt || 0) + 1);
    applyHorrorConsequence(player, {
      source: "watcher_ambush",
      eventKey: "stalker_fakeout",
      category: "pressure",
      fear: 8,
      stalkerAttention: 4,
      flashlightInterferenceTicks: 20 * 5,
    }, currentTick);
    incrementDebugStat("ambushesFakeout");
    markPlayerCooldownSeconds(player, CONFIG.shortFakeoutCooldownSeconds);
  } else if (outcome === AMBUSH_OUTCOME.NearMiss || !canDamage) {
    if (!canDamage && (state.ambushOutcome === AMBUSH_OUTCOME.MinorDamage || state.ambushOutcome === AMBUSH_OUTCOME.Hit)) {
      profile.attackDebt = Math.min(4, (profile.attackDebt || 0) + 1);
    }
    outcome = AMBUSH_OUTCOME.NearMiss;
    setWatcherAnimation(entity, "Attack", {
      force: true,
      durationTicks: CONFIG.animationDurationsTicks.attack,
    });
    applyScareEffects(player, true);
    profile.heat = clamp(profile.heat - 22, 0, 100);
    profile.fear = clamp(profile.fear + 16, 0, 100);
    profile.nearMissCount = (profile.nearMissCount || 0) + 1;
    profile.attackDebt = Math.min(4, (profile.attackDebt || 0) + 1);
    applyHorrorConsequence(player, {
      source: "watcher_ambush",
      eventKey: "stalker_near_miss",
      category: "major",
      fear: 14,
      stalkerAttention: 7,
      panicTicks: 20 * 5,
      flashlightInterferenceTicks: 20 * 8,
      visionDistortionTicks: 20 * 6,
      reliefTicks: 20 * 24,
    }, currentTick);
    incrementDebugStat("ambushesNearMiss");
    markPlayerCooldownSeconds(player, CONFIG.nearMissCooldownSeconds);
  } else if (outcome === AMBUSH_OUTCOME.MinorDamage) {
    setWatcherAnimation(entity, "Attack", {
      force: true,
      durationTicks: CONFIG.animationDurationsTicks.attack,
    });
    applyScareEffects(player, true);
    try {
      player.applyDamage(CONFIG.minorAmbushDamage, {
        damagingEntity: entity,
      });
    } catch (_error) {
      // The scare still resolves as pressure if damage cannot be applied.
    }
    profile.heat = clamp(profile.heat - 26, 0, 100);
    profile.fear = clamp(profile.fear + 18, 0, 100);
    profile.minorDamageCount = (profile.minorDamageCount || 0) + 1;
    profile.attackDebt = Math.max(0, (profile.attackDebt || 0) - 1);
    applyHorrorConsequence(player, {
      source: "watcher_ambush",
      eventKey: "stalker_graze",
      category: "major",
      fear: 18,
      stalkerAttention: 8,
      panicTicks: 20 * 8,
      flashlightInterferenceTicks: 20 * 12,
      movementPenaltyTicks: 20 * 3,
      visionDistortionTicks: 20 * 8,
      reliefTicks: 20 * 30,
    }, currentTick);
    incrementDebugStat("ambushesMinorDamage");
    markPlayerCooldownSeconds(player, CONFIG.nearMissCooldownSeconds + 35);
  } else {
    setWatcherAnimation(entity, "Attack", {
      force: true,
      durationTicks: CONFIG.animationDurationsTicks.attack,
    });
    applyScareEffects(player, true);
    try {
      player.applyDamage(CONFIG.ambushDamage, {
        damagingEntity: entity,
      });
    } catch (_error) {
      // The visual scare still lands.
    }
    profile.heat = clamp(profile.heat - 34, 0, 100);
    profile.fear = clamp(profile.fear + 22, 0, 100);
    profile.ambushHitCount = (profile.ambushHitCount || 0) + 1;
    profile.attackDebt = 0;
    applyHorrorConsequence(player, {
      source: "watcher_ambush",
      eventKey: "stalker_full_hit",
      category: "panic",
      fear: 28,
      stalkerAttention: 10,
      panicTicks: 20 * 12,
      flashlightInterferenceTicks: 20 * 16,
      movementPenaltyTicks: 20 * 5,
      visionDistortionTicks: 20 * 10,
      hearingDistortionTicks: 20 * 10,
      reliefTicks: 20 * 45,
    }, currentTick);
    incrementDebugStat("ambushesHit");
    markPlayerCooldown(player);
  }

  horrorDirector.endScare("watcher_ambush", { currentTick, reliefTicks: 20 * 30 });
  enterRelief(profile, currentTick, "ambush-" + outcome);
  saveProfileMemory(profile, true);
  enterPhase(entity, state, player, profile, PHASE.Vanish, currentTick, "ambush-" + outcome, {
    skipImmediateMove: true,
    skipAnimation: true,
  });

  const entityId = entity.id;
  const playerId = player.id;
  system.runTimeout(() => {
    const liveEntity = trackedWatchers.get(entityId);
    const liveState = watcherStates.get(entityId);
    const livePlayer = getPlayerById(playerId);
    if (
      !isEntityValid(liveEntity) ||
      !liveState ||
      liveState.phase !== PHASE.Vanish ||
      !livePlayer ||
      !isInterestingPlayer(livePlayer)
    ) {
      return;
    }

    const liveProfile = getProfile(livePlayer);
    hideWatcher(liveEntity, liveState, livePlayer, liveProfile, system.currentTick);
  }, CONFIG.attackVanishDelayTicks);
}


function tickAmbush(entity, state, currentTick) {
  const player = getPlayerById(state.targetPlayerId);
  if (!player || !isInterestingPlayer(player)) {
    state.phase = PHASE.Dormant;
    state.targetPlayerId = undefined;
    state.ambushLocation = undefined;
    state.ambushOutcome = undefined;
    return;
  }

  const profile = getProfile(player);
  if (isPlayerInSafeRoom(player, currentTick)) {
    clearVhsRequest(player);
    abortAmbush(entity, state, player, profile, currentTick, "safe-room-ambush-block");
    return;
  }
  if (!state.ambushLocation || player.dimension.id !== state.ambushDimensionId) {
    abortAmbush(entity, state, player, profile, currentTick, "ambush-target-left");
    return;
  }

  const dist = distance(player.location, state.ambushLocation);
  if (dist > CONFIG.ambushEscapeDistance || currentTick - state.ambushStartTick > CONFIG.ambushMaxTicks) {
    abortAmbush(entity, state, player, profile, currentTick, "ambush-escaped");
    return;
  }

  if (currentTick - state.ambushStartTick >= CONFIG.ambushWarmupTicks) {
    finishAmbush(entity, state, player, profile, currentTick);
    return;
  }

  if (currentTick - state.ambushLastPulseTick >= CONFIG.ambushPulseTicks) {
    spawnParticles(player.dimension, state.ambushLocation, 0.45);
    state.ambushLastPulseTick = currentTick;
  }
}

function tickVanish(entity, state, currentTick) {
  const player = state.cooldownPlayerId ? getPlayerById(state.cooldownPlayerId) : undefined;
  if (player && isInterestingPlayer(player) && currentTick >= state.nextMoveTick) {
    const profile = getProfile(player);
    moveWatcher(entity, state, player, profile, currentTick);
  }

  if (currentTick >= state.vanishUntilTick) {
    state.phase = PHASE.Dormant;
    state.targetPlayerId = undefined;
    state.cooldownPlayerId = undefined;
    state.phaseChangedTick = currentTick;
    state.lastReason = "vanish-ended";
    resetWatcherPerception(state, currentTick);
    setWatcherAnimation(entity, "Idle", { force: true });
  }
}

function tickActiveWatcher(entity, state, currentTick) {
  const targetInfo = selectTarget(entity, state);
  if (!targetInfo || targetInfo.profile.heat < CONFIG.phaseHeat.observe) {
    if (state.phase !== PHASE.Dormant) {
      state.phase = PHASE.Dormant;
      state.targetPlayerId = undefined;
      state.phaseChangedTick = currentTick;
      state.lastReason = "no-target";
      resetWatcherPerception(state, currentTick);
      scheduleNextMove(state, PHASE.Dormant, currentTick);
    }
    return;
  }

  const player = targetInfo.player;
  const profile = samplePlayerMemory(player, currentTick, false) || targetInfo.profile;

  if (isPlayerInSafeRoom(player, currentTick)) {
    clearVhsRequest(player);
    enterPhase(entity, state, player, profile, PHASE.Vanish, currentTick, "safe-room-target", {
      skipImmediateMove: true,
    });
    return;
  }

  if (player.dimension.id !== entity.dimension.id) {
    const moved = moveWatcher(entity, state, player, profile, currentTick, true);
    if (!moved) {
      state.lostTargetTicks += CONFIG.tickInterval;
      if (state.lostTargetTicks >= CONFIG.lostTargetGraceTicks) {
        enterPhase(entity, state, player, profile, PHASE.Dormant, currentTick, "dimension-move-failed");
      }
      return;
    }
    state.lostTargetTicks = 0;
  }

  const desiredPhase = phaseFromProfile(profile, state, currentTick);

  if (profile.tensionState === TENSION.Relief && state.phase !== PHASE.Dormant && state.phase !== PHASE.Vanish) {
    enterPhase(entity, state, player, profile, PHASE.Vanish, currentTick, "relief-cooldown");
    return;
  }

  if (entity.dimension && entity.dimension.id === player.dimension.id) {
    const closeDistance = distance(player.location, entity.location);
    const closeButShouldCommit = desiredPhase === PHASE.Ambush || profile.suspicionPhase === SUSPICION_PHASE.AttackReady || (profile.attackDebt || 0) >= 1;
    if (closeDistance <= CONFIG.lowTensionVanishDistance && profile.tensionState !== TENSION.Peak && state.phase !== PHASE.Vanish && !closeButShouldCommit) {
      enterPhase(entity, state, player, profile, PHASE.Vanish, currentTick, "too-close-before-peak");
      markPlayerCooldownSeconds(player, 45);
      return;
    }
  }

  if (desiredPhase === PHASE.Ambush && state.phase !== PHASE.Ambush) {
    if (profile.suspicion >= SUSPICION_CONFIG.warning && profile.suspicionPhase !== SUSPICION_PHASE.AttackReady) {
      warnBeforeAttack(player, entity, state, profile, currentTick);
      return;
    }
    if (currentTick < (state.stareHoldUntilTick || 0)) {
      updateTargetPressure(player, entity, state, profile, currentTick);
      maybeStartStareHold(entity, state, player, profile, currentTick, "ambush-stare-continue", true);
      return;
    }
    if (canTransitionPhase(state, currentTick, state.phase, PHASE.Ambush) && canStartMajorScare(profile, currentTick)) {
      if (maybeStartStareHold(entity, state, player, profile, currentTick, "ambush-restraint")) {
        return;
      }
      startAmbush(entity, state, player, profile, currentTick);
      return;
    }
  }

  if (state.phase === PHASE.Dormant || state.phase === PHASE.Ambush || state.phase !== desiredPhase) {
    if (canTransitionPhase(state, currentTick, state.phase, desiredPhase)) {
      enterPhase(entity, state, player, profile, desiredPhase, currentTick, "pressure-change");
    }
  }

  updateTargetPressure(player, entity, state, profile, currentTick);

  if (currentTick < (state.stareHoldUntilTick || 0)) {
    maybeStartStareHold(entity, state, player, profile, currentTick, "stare-continue", true);
    return;
  }

  if (state.phase === PHASE.Pressure && maybeStartStareHold(entity, state, player, profile, currentTick, "pressure-restraint")) {
    return;
  }

  if (currentTick >= state.nextCueTick) {
    chooseStateAdaptiveTactic(state, profile, state.phase, currentTick);
    if (!maybePlayAdaptiveTacticCue(player, state, profile, currentTick) &&
        !maybeTriggerMinorHorrorEvent(entity, state, player, profile, currentTick)) {
      playCue(player, state.phase, false);
    }
    state.nextCueTick = currentTick + randomInt(20 * 18, 20 * 50);
  }

  if (shouldMove(entity, state, player, currentTick)) {
    const moved = moveWatcher(entity, state, player, profile, currentTick);
    if (!moved && state.failedSpotCount >= 4) {
      state.nextMoveTick = currentTick + 20;
      state.failedSpotCount = 0;
      enterPhase(entity, state, player, profile, PHASE.Observe, currentTick, "spot-fail-reset");
    }
  }
}

function tickWatcher(entity, currentTick) {
  if (!systemEnabled || !isWatcherEntity(entity)) {
    return;
  }

  if (!isAllowedStalkerDimension(entity.dimension)) {
    removeWatcherWithoutLoot(entity);
    return;
  }

  const state = getState(entity);

  if (state.phase === PHASE.Ambush) {
    tickAmbush(entity, state, currentTick);
    return;
  }

  if (state.phase === PHASE.Psychological) {
    tickPsychologicalAppearance(entity, state, currentTick);
    return;
  }

  if (state.phase === PHASE.Vanish) {
    tickVanish(entity, state, currentTick);
    return;
  }

  tickActiveWatcher(entity, state, currentTick);
}

function sendWatcherCommandMessage(player, message) {
  if (!player || typeof player.sendMessage !== "function") {
    return;
  }

  try {
    player.sendMessage(`[Watcher] ${message}`);
  } catch (_error) {
    // Debug command feedback is optional.
  }
}

function getWatcherSpawnBlockers(player, currentTick, profile, options = {}) {
  const validPlayer = isValidWatcherDebugPlayer(player);
  const allowedDimension = validPlayer && isAllowedStalkerDimension(player.dimension) && !isBurningHighwayDimension(player.dimension);
  const playerCooldown = validPlayer ? isPlayerOnCooldown(player) : false;
  const safeRoom = validPlayer ? isPlayerInSafeRoom(player, currentTick) : false;
  const psychologicalSuppression = !!(profile && currentTick < (profile.psychologicalSuppressChaseUntilTick || 0));
  const spawnAttemptCooldown = !!(profile && currentTick - profile.lastSpawnAttemptTick < CONFIG.minSpawnAttemptIntervalTicks);
  const recentSuccessfulSpawn = !!(profile && currentTick - profile.lastSuccessfulSpawnTick < CONFIG.samePlayerSpawnCooldownTicks);
  const maxWatchersForPlayer = validPlayer && getAssignedWatcherCount(player) >= CONFIG.maxWatchersPerPlayer;

  let maxWatchersForDimension = false;
  if (validPlayer && allowedDimension) {
    const dimensionId = player.dimension.id;
    maxWatchersForDimension = getWatcherCountInDimension(dimensionId) >= CONFIG.maxWatchersPerDimension && !findIdleWatcherFor(player);
  }

  return getWatcherSpawnBlockersForState({
    systemEnabled,
    playerTypeId: player ? player.typeId : undefined,
    dimensionId: validPlayer ? player.dimension.id : undefined,
    allowedDimension,
    bypassCooldowns: options.bypassCooldowns === true,
    bypassTension: options.bypassTension === true,
    playerCooldown,
    safeRoom,
    psychologicalSuppression,
    tensionState: profile ? profile.tensionState : undefined,
    spawnAttemptCooldown,
    recentSuccessfulSpawn,
    maxWatchersForPlayer,
    maxWatchersForDimension,
  });
}

function setDebugWatcherFailureReason(player, reason) {
  if (!player || !player.id) {
    return;
  }

  if (reason) {
    debugWatcherFailureReasonByPlayer.set(player.id, reason);
  } else {
    debugWatcherFailureReasonByPlayer.delete(player.id);
  }
}

function getDebugWatcherFailureBlockers(player, currentTick, profile, options = {}) {
  const blockers = getWatcherSpawnBlockers(player, currentTick, profile, options);
  if (blockers.length > 0) {
    return blockers;
  }

  const reason = player && player.id ? debugWatcherFailureReasonByPlayer.get(player.id) : undefined;
  return reason ? [reason] : [];
}

function buildWatcherDebugStatus(player, profile, blockers) {
  return formatDebugStatus({
    enabled: systemEnabled,
    dimensionId: player && player.dimension ? player.dimension.id : "unknown",
    allowedDimension: player && player.dimension ? isAllowedStalkerDimension(player.dimension) : false,
    watcherCount: player && player.dimension ? getWatcherCountInDimension(player.dimension.id) : 0,
    assignedWatcherCount: player ? getAssignedWatcherCount(player) : 0,
    tensionState: profile ? profile.tensionState : "none",
    heat: profile ? profile.heat : 0,
    fear: profile ? profile.fear : 0,
    suspicion: profile ? profile.suspicion : 0,
    soundScore: profile ? profile.soundScore : 0,
    blockers,
  });
}

function spawnWatcherForPlayerResult(player, currentTick, options = {}) {
  if (!CONFIG.autoSpawnWatchers && options.bypassSystemEnabled !== true) {
    return makeWatcherSpawnResult(undefined, [STALKER_SPAWN_BLOCK_REASON.SystemDisabled]);
  }

  if (!isValidWatcherDebugPlayer(player) || !isAllowedStalkerDimension(player.dimension) || isBurningHighwayDimension(player.dimension)) {
    const earlyBlockers = getWatcherSpawnBlockers(player, currentTick, undefined, options);
    if (options.reportToPlayer === true) {
      sendWatcherCommandMessage(player, `spawn blocked: ${formatSpawnBlockers(earlyBlockers)}`);
    }
    return makeWatcherSpawnResult(undefined, earlyBlockers);
  }

  const profile = samplePlayerMemory(player, currentTick, true) || getProfile(player);
  advanceTension(profile, currentTick);

  const blockers = getWatcherSpawnBlockers(player, currentTick, profile, options);
  if (blockers.length > 0) {
    if (options.reportToPlayer === true) {
      sendWatcherCommandMessage(player, `spawn blocked: ${formatSpawnBlockers(blockers)}`);
    }
    return makeWatcherSpawnResult(undefined, blockers);
  }

  profile.lastSpawnAttemptTick = currentTick;

  if (getAssignedWatcherCount(player) >= CONFIG.maxWatchersPerPlayer) {
    const resultBlockers = [STALKER_SPAWN_BLOCK_REASON.MaxWatchersForPlayer];
    if (options.reportToPlayer === true) {
      sendWatcherCommandMessage(player, `spawn blocked: ${formatSpawnBlockers(resultBlockers)}`);
    }
    return makeWatcherSpawnResult(undefined, resultBlockers);
  }

  if (getWatcherCountInDimension(player.dimension.id) >= CONFIG.maxWatchersPerDimension) {
    const idle = findIdleWatcherFor(player);
    if (idle) {
      increaseHeat(profile, CONFIG.initialSpawnHeat);
      profile.lastSuccessfulSpawnTick = currentTick;
      idle.state.ownerPlayerId = player.id;
      enterPhase(idle.entity, idle.state, player, profile, phaseFromProfile(profile, idle.state, currentTick), currentTick, "reuse-idle");
      return makeWatcherSpawnResult(idle.entity, []);
    }

    const resultBlockers = [STALKER_SPAWN_BLOCK_REASON.MaxWatchersForDimension];
    if (options.reportToPlayer === true) {
      sendWatcherCommandMessage(player, `spawn blocked: ${formatSpawnBlockers(resultBlockers)}`);
    }
    return makeWatcherSpawnResult(undefined, resultBlockers);
  }

  increaseHeat(profile, CONFIG.initialSpawnHeat);

  const result = chooseTeleportSpot(player, profile, PHASE.Observe, undefined);
  if (!result) {
    incrementDebugStat("noValidSpot");
    const resultBlockers = [STALKER_SPAWN_BLOCK_REASON.NoValidSpot];
    if (options.reportToPlayer === true) {
      sendWatcherCommandMessage(player, `spawn blocked: ${formatSpawnBlockers(resultBlockers)}`);
    }
    return makeWatcherSpawnResult(undefined, resultBlockers);
  }

  try {
    const watcher = player.dimension.spawnEntity(CONFIG.watcherTypeId, result.spot);
    registerWatcher(watcher);
    profile.lastSuccessfulSpawnTick = currentTick;
    const newState = getState(watcher);
    newState.ownerPlayerId = player.id;
    enterPhase(watcher, newState, player, profile, phaseFromProfile(profile, newState, currentTick), currentTick, "spawn", {
      skipImmediateMove: true,
    });
    return makeWatcherSpawnResult(watcher, []);
  } catch (_error) {
    const resultBlockers = [STALKER_SPAWN_BLOCK_REASON.SpawnFailed];
    if (options.reportToPlayer === true) {
      sendWatcherCommandMessage(player, `spawn blocked: ${formatSpawnBlockers(resultBlockers)}`);
    }
    return makeWatcherSpawnResult(undefined, resultBlockers);
  }
}

function spawnWatcherForPlayer(player, currentTick, options = {}) {
  return spawnWatcherForPlayerResult(player, currentTick, options).watcher;
}

function maybeTriggerWatcherPresenceCue(player, profile, currentTick, reason = "pressure") {
  if (!player || !profile || isPlayerInSafeRoom(player, currentTick)) {
    return false;
  }

  if (!isAllowedStalkerDimension(player.dimension)) {
    return false;
  }

  const pressure = getProfilePressure(profile);
  const stage = choosePresenceCueStage({
    pressure,
    heat: profile.heat,
    soundScore: profile.soundScore,
  });

  if (stage === "none") {
    return false;
  }

  const cooldownTicks = stage === "panic" ? 20 * 35 : stage === "near" ? 20 * 55 : 20 * 80;
  if (currentTick - profile.lastPresenceCueTick < cooldownTicks) {
    return false;
  }

  profile.lastPresenceCueTick = currentTick;
  profile.lastPresenceCueStage = stage;

  const cueReason = String(reason || "pressure").startsWith("watcher-") ? String(reason) : `watcher-${reason}`;

  if (stage === "panic") {
    requestVhsTier(player, VHS_TIER.High, currentTick, 20 * 8, cueReason);
    playCue(player, PHASE.Pressure, true);
    increaseFear(profile, 5);
    return true;
  }

  if (stage === "near") {
    requestVhsTier(player, VHS_TIER.Low, currentTick, 20 * 6, cueReason);
    playCue(player, PHASE.Shadow, true);
    increaseFear(profile, 3);
    return true;
  }

  maybePlayStalkerHorrorAudio(player, {
    phase: PHASE.Observe,
    force: true,
    heat: profile.heat,
    fear: profile.fear,
    soundScore: profile.soundScore,
    pressure,
    tensionState: profile.tensionState,
    nearbyPlayers: countNearbyPlayers(player, 96),
  });
  increaseFear(profile, 1);
  return true;
}

function ensureWatchersForPlayers(currentTick) {
  if (!CONFIG.autoSpawnWatchers || currentTick % CONFIG.spawnCheckInterval !== 0) {
    return;
  }

  for (const player of getCachedPlayers()) {
    if (!isInterestingPlayer(player) || isPlayerOnCooldown(player) || isPlayerInSafeRoom(player, currentTick)) {
      continue;
    }

    const profile = samplePlayerMemory(player, currentTick, false) || getProfile(player);
    const contextualHeat = getContextualPassiveHeat(player, profile, currentTick);
    if (contextualHeat > 0) {
      increaseHeat(profile, contextualHeat);
    }
    advanceTension(profile, currentTick);

    if (profile.heat >= CONFIG.psychological.minHeat && profile.heat < CONFIG.phaseHeat.observe) {
      maybeTriggerWatcherPresenceCue(player, profile, currentTick, "watcher-low-heat");
    }

    if (profile.heat >= CONFIG.phaseHeat.observe && profile.tensionState !== TENSION.Quiet && profile.tensionState !== TENSION.Relief) {
      maybeTriggerWatcherPresenceCue(player, profile, currentTick, "watcher-spawn-check");
      const outcome = decideWatcherEncounterForSpawn(player, profile, currentTick);
      if (outcome === PSYCHOLOGICAL_OUTCOME.NoEncounter) {
        continue;
      }
      if (outcome === PSYCHOLOGICAL_OUTCOME.PsychologicalOnly || outcome === PSYCHOLOGICAL_OUTCOME.PsychologicalThenChase) {
        if (triggerPsychologicalAppearance(player, profile, currentTick, outcome, false)) {
          continue;
        }
      }
      spawnWatcherForPlayer(player, currentTick);
    }
  }
}

function cleanupState(currentTick) {
  if (currentTick % CONFIG.cleanupInterval !== 0) {
    return;
  }

  for (const [entityId, entity] of trackedWatchers.entries()) {
    if (!isEntityValid(entity)) {
      trackedWatchers.delete(entityId);
      watcherStates.delete(entityId);
      clearStalkerTeleportGovernor(entityId);
    }
  }

  for (const [playerId, profile] of playerProfiles.entries()) {
    if (currentTick - profile.lastSeenTick > 20 * 60 * 20) {
      saveProfileMemory(profile, true);
      playerProfiles.delete(playerId);
      psychologicalCooldownUntilByPlayer.delete(playerId);
      activePsychologicalWatchersByPlayer.delete(playerId);
      continue;
    }

    if (getProfileSaveDueTick(profile) <= currentTick) {
      saveProfileMemory(profile, false);
    }
  }
}

function tickAllWatchers(currentTick) {
  for (const watcher of getTrackedWatchers()) {
    tickWatcher(watcher, currentTick);
  }
}

function initializeWatcherSystem() {
  if (bootstrapDone) {
    return;
  }

  bootstrapDone = true;

  try {
    cooldownObjective = world.scoreboard.getObjective(CONFIG.cooldownObjectiveId);
    if (!cooldownObjective) {
      cooldownObjective = world.scoreboard.addObjective(CONFIG.cooldownObjectiveId, CONFIG.cooldownObjectiveName);
    }
  } catch (_error) {
    try {
      cooldownObjective = world.scoreboard.getObjective(CONFIG.cooldownObjectiveId);
    } catch (_nestedError) {
      cooldownObjective = undefined;
    }
  }

  scanLoadedWatchers();
  for (const player of getCachedPlayers()) {
    samplePlayerMemory(player, system.currentTick, true);
  }
}

function formatDebugStats() {
  return Object.entries(debugStats)
    .map(([key, value]) => `${key}=${value}`)
    .join(" ");
}

function formatProfileDebug(profile) {
  if (!profile) {
    return "no profile";
  }

  const speed = Math.sqrt(profile.currentVelocity.x * profile.currentVelocity.x + profile.currentVelocity.z * profile.currentVelocity.z);
  const base = profile.baseCell ? `${Math.floor(profile.baseCell.center.x)},${Math.floor(profile.baseCell.center.y)},${Math.floor(profile.baseCell.center.z)}` : "none";
  const route = profile.routeCell ? `${Math.floor(profile.routeCell.center.x)},${Math.floor(profile.routeCell.center.y)},${Math.floor(profile.routeCell.center.z)}` : "none";
  return `tension=${profile.tensionState} suspicion=${Math.floor(profile.suspicion)} suspicionPhase=${profile.suspicionPhase} heat=${Math.floor(profile.heat)} fear=${Math.floor(profile.fear)} sound=${Math.floor(profile.soundScore)} mode=${profile.behaviorMode} speed=${speed.toFixed(2)} encounters=${profile.encounterCount || 0} hit=${profile.ambushHitCount || 0} minor=${profile.minorDamageCount || 0} fake=${profile.fakeoutCount || 0} near=${profile.nearMissCount || 0} debt=${profile.attackDebt || 0} base=${base} route=${route}`;
}

function getOrCreateDebugWatcher(player, currentTick) {
  setDebugWatcherFailureReason(player, undefined);

  if (!isValidWatcherDebugPlayer(player)) {
    setDebugWatcherFailureReason(player, STALKER_SPAWN_BLOCK_REASON.InvalidPlayer);
    return undefined;
  }

  if (!isAllowedStalkerDimension(player.dimension) || isBurningHighwayDimension(player.dimension)) {
    setDebugWatcherFailureReason(player, STALKER_SPAWN_BLOCK_REASON.BlockedDimension);
    return undefined;
  }

  const existing = findIdleWatcherFor(player);
  const profile = samplePlayerMemory(player, currentTick, true) || getProfile(player);
  if (existing) {
    existing.state.ownerPlayerId = player.id;
    existing.state.targetPlayerId = player.id;
    return { entity: existing.entity, state: existing.state, profile };
  }

  const result = chooseTeleportSpot(player, profile, PHASE.Observe, undefined);
  if (!result) {
    incrementDebugStat("noValidSpot");
    setDebugWatcherFailureReason(player, STALKER_SPAWN_BLOCK_REASON.NoValidSpot);
    return undefined;
  }

  try {
    const watcher = player.dimension.spawnEntity(CONFIG.watcherTypeId, result.spot);
    registerWatcher(watcher);
    const state = getState(watcher);
    state.ownerPlayerId = player.id;
    return { entity: watcher, state, profile };
  } catch (_error) {
    setDebugWatcherFailureReason(player, STALKER_SPAWN_BLOCK_REASON.SpawnFailed);
    return undefined;
  }
}

function recordFlashlightToggleSignal(player, failed = false) {
  if (!player) {
    return;
  }

  const currentTick = system.currentTick || 0;
  const profile = samplePlayerMemory(player, currentTick, false) || getProfile(player);
  const attraction = CONFIG.flashlightToggleAttraction;
  observeAdaptiveFlashlight(profile.adaptive, currentTick);
  recordSuspiciousAction(
    player,
    profile,
    failed ? "flashlight_fail_click" : "flashlight_toggle",
    failed ? attraction.failedSuspicionPoints : attraction.suspicionPoints,
    {
      heat: failed ? attraction.failedHeat : attraction.heat,
      soundPoints: isPlayerHeardByWatcher(player) ? (failed ? attraction.failedSoundPoints : attraction.soundPoints) : 0,
      cooldownTicks: attraction.cooldownTicks,
      countsAsSoundEvidence: false,
    }
  );
  recordWatcherEvidenceForPlayer(
    player,
    EVIDENCE_KIND.Flashlight,
    failed ? 0.30 : 0.52,
    currentTick,
    { maxDistance: CONFIG.soundDetectionRadius + 12 },
  );
}

function handleScriptEvent(event) {
  if (event.id !== CONFIG.debugScriptEventId) {
    return;
  }

  const message = String(event.message || "").trim().toLowerCase();
  const isForceCommand = isForceWatcherCommand(message);
  const source = event.sourceEntity || event.initiator;
  const player = source && source.typeId === "minecraft:player" ? source : undefined;
  if (isForceCommand && !player) {
    return;
  }

  switch (message) {
    case "on":
      systemEnabled = true;
      break;
    case "off":
      systemEnabled = false;
      break;
    case "debug_on":
      debugEnabled = true;
      break;
    case "debug_off":
      debugEnabled = false;
      break;
    case "reset":
      watcherStates.clear();
      playerProfiles.clear();
      activePsychologicalWatchersByPlayer.clear();
      activePsychologicalWatchersByDimension.clear();
      clearStalkerTeleportGovernors();
      psychologicalCooldownUntilByPlayer.clear();
      debugWatcherFailureReasonByPlayer.clear();
      nextProfileSaveCheckTick = 0;
      for (const watcher of getTrackedWatchers()) {
        getState(watcher);
      }
      break;
    case "pulse":
      if (player) {
        const profile = samplePlayerMemory(player, system.currentTick, true) || getProfile(player);
        increaseHeat(profile, 40);
        increaseFear(profile, 20);
        advanceTension(profile, system.currentTick);
        const spawnResult = spawnWatcherForPlayerResult(player, system.currentTick, { reportToPlayer: false });
        if (spawnResult.watcher) {
          sendWatcherCommandMessage(player, "pulse succeeded: watcher spawned");
        } else {
          sendWatcherCommandMessage(player, `pulse did not spawn: ${formatSpawnBlockers(spawnResult.blockers)}`);
        }
      }
      break;
    case "stats":
      if (player) {
        player.sendMessage(`[WatcherStats] ${formatDebugStats()}`);
        const snapshot = getPlayerHorrorSnapshot(player, system.currentTick || 0);
        player.sendMessage(`[HorrorState] fear=${Math.floor(snapshot.fearScore)} panicUntil=${snapshot.panicUntilTick} flashlightUntil=${snapshot.flashlightInterferenceUntilTick} attention=${Math.floor(snapshot.stalkerAttentionLevel)} reliefUntil=${snapshot.reliefUntilTick}`);
      }
      break;
    case "telemetry":
      if (player) {
        const existing = findIdleWatcherFor(player);
        const snapshot = existing ? getStalkerTeleportDebugSnapshot(existing.entity) : undefined;
        if (snapshot) {
          player.sendMessage(`[TeleportGovernor] allowed=${snapshot.totalAllowed} denied=${snapshot.totalDenied} last=${snapshot.lastPhase}/${snapshot.lastReason} budget=${snapshot.encounterCount}`);
        } else {
          player.sendMessage("[TeleportGovernor] no managed watcher found for this player");
        }
      }
      break;
    case "reset_stats":
      resetDebugStats();
      if (player) {
        player.sendMessage("[WatcherStats] reset");
      }
      break;
    case DEBUG_COMMANDS.DebugStatus:
      if (player) {
        const profile = samplePlayerMemory(player, system.currentTick, true) || getProfile(player);
        advanceTension(profile, system.currentTick);
        const blockers = getWatcherSpawnBlockers(player, system.currentTick, profile, {});
        sendWatcherCommandMessage(player, buildWatcherDebugStatus(player, profile, blockers));
      }
      break;
    case "profile":
      if (player) {
        const profile = samplePlayerMemory(player, system.currentTick, true) || getProfile(player);
        player.sendMessage(`[WatcherProfile] ${formatProfileDebug(profile)}`);
      }
      break;
    case DEBUG_COMMANDS.ForceSpawn:
      if (player) {
        const spawnResult = spawnWatcherForPlayerResult(player, system.currentTick, {
          bypassCooldowns: true,
          bypassTension: true,
          reportToPlayer: false,
        });
        if (spawnResult.watcher) {
          sendWatcherCommandMessage(player, "force_spawn succeeded: observer watcher created");
        } else {
          sendWatcherCommandMessage(player, `force_spawn failed: ${formatSpawnBlockers(spawnResult.blockers)}`);
        }
      }
      break;
    case DEBUG_COMMANDS.ForceAmbush:
      if (player) {
        const debugWatcher = getOrCreateDebugWatcher(player, system.currentTick);
        if (debugWatcher) {
          increaseHeat(debugWatcher.profile, 100);
          increaseFear(debugWatcher.profile, 35);
          startAmbush(debugWatcher.entity, debugWatcher.state, player, debugWatcher.profile, system.currentTick, { bypassHonestEvidence: true });
          sendWatcherCommandMessage(player, "force_ambush succeeded");
        } else {
          const profile = samplePlayerMemory(player, system.currentTick, true) || getProfile(player);
          const blockers = getDebugWatcherFailureBlockers(player, system.currentTick, profile, {
            bypassCooldowns: true,
            bypassTension: true,
          });
          sendWatcherCommandMessage(player, `force_ambush failed: ${formatSpawnBlockers(blockers)}`);
        }
      }
      break;
    case DEBUG_COMMANDS.ForceFakeout:
      if (player) {
        const debugWatcher = getOrCreateDebugWatcher(player, system.currentTick);
        if (debugWatcher) {
          increaseHeat(debugWatcher.profile, 65);
          startAmbush(debugWatcher.entity, debugWatcher.state, player, debugWatcher.profile, system.currentTick, { bypassHonestEvidence: true });
          debugWatcher.state.ambushOutcome = AMBUSH_OUTCOME.Fakeout;
          sendWatcherCommandMessage(player, "force_fakeout succeeded");
        } else {
          const profile = samplePlayerMemory(player, system.currentTick, true) || getProfile(player);
          const blockers = getDebugWatcherFailureBlockers(player, system.currentTick, profile, {
            bypassCooldowns: true,
            bypassTension: true,
          });
          sendWatcherCommandMessage(player, `force_fakeout failed: ${formatSpawnBlockers(blockers)}`);
        }
      }
      break;
    case "light":
      if (player) {
        const currentTick = system.currentTick || 0;
        const profile = samplePlayerMemory(player, currentTick, false) || getProfile(player);
        recordSuspiciousAction(player, profile, "bright_light", 5, { heat: 2, cooldownTicks: 20 * 4, countsAsSoundEvidence: false });
        recordWatcherEvidenceForPlayer(
          player,
          EVIDENCE_KIND.Flashlight,
          0.22,
          currentTick,
          { maxDistance: CONFIG.soundDetectionRadius + 8 },
        );
      }
      break;
    case "light_toggle_on":
    case "light_toggle_off":
      recordFlashlightToggleSignal(player, false);
      break;
    case "light_toggle_fail":
      recordFlashlightToggleSignal(player, true);
      break;
    default:
      if (player) {
        player.sendMessage("[Watcher] events: on, off, debug_on, debug_off, reset, pulse, stats, telemetry, reset_stats, profile, debug_status, force_spawn, force_ambush, force_fakeout, light, light_toggle_on, light_toggle_off, light_toggle_fail");
      }
      break;
  }
}

world.afterEvents.worldLoad.subscribe(() => {
  system.run(() => {
    initializeWatcherSystem();
  });
});

world.afterEvents.entitySpawn.subscribe((event) => {
  system.run(() => {
    registerWatcher(event.entity);
  });
});

world.afterEvents.playerSpawn.subscribe((event) => {
  system.run(() => {
    const profile = samplePlayerMemory(event.player, system.currentTick, true);
    if (profile) {
      increaseHeat(profile, 6);
    }
  });
});

world.afterEvents.playerInteractWithBlock.subscribe((event) => {
  system.run(() => {
    const profile = samplePlayerMemory(event.player, system.currentTick, true);
    if (profile) {
      increaseHeat(profile, CONFIG.interactionHeat);
      const bTypeId = String((event.block && event.block.typeId) || "");
      if (CHEST_SOUND_PATTERNS.some((p) => bTypeId.includes(p))) {
        recordSuspiciousAction(event.player, profile, "chest", SOUND_POINTS.chest, { heat: 2, soundPoints: isPlayerHeardByWatcher(event.player) ? SOUND_POINTS.chest : 0, cooldownTicks: 20 * 2 });
      } else if (DOOR_SOUND_PATTERNS.some((p) => bTypeId.includes(p))) {
        recordSuspiciousAction(event.player, profile, "door", SOUND_POINTS.door * 0.6, { soundPoints: isPlayerHeardByWatcher(event.player) ? SOUND_POINTS.door : 0, cooldownTicks: 20 * 2 });
      }
    }
  });
});

world.afterEvents.playerBreakBlock.subscribe((event) => {
  system.run(() => {
    const profile = samplePlayerMemory(event.player, system.currentTick, true);
    if (profile) {
      increaseHeat(profile, CONFIG.interactionHeat);
      const brokenId = String(
        (event.brokenBlockPermutation &&
          event.brokenBlockPermutation.type &&
          event.brokenBlockPermutation.type.id) ||
          ""
      );
      const pts = getBreakSoundPoints(brokenId);
      if (pts > 0) {
        const action = brokenId.includes("glass") || brokenId.includes("pane") ? "break_glass" : "break_block";
        recordSuspiciousAction(event.player, profile, action, pts, {
          heat: action === "break_glass" ? 4 : 2,
          fear: action === "break_glass" ? 1 : 0,
          soundPoints: isPlayerHeardByWatcher(event.player) ? pts : 0,
          cooldownTicks: 20,
          ignoreSneakReduction: action === "break_glass",
        });
      }
    }
  });
});

world.afterEvents.playerPlaceBlock.subscribe((event) => {
  system.run(() => {
    const profile = samplePlayerMemory(event.player, system.currentTick, true);
    if (profile) {
      recordSuspiciousAction(event.player, profile, "place_block", SOUND_POINTS.placeBlock * 0.65, {
        soundPoints: isPlayerHeardByWatcher(event.player) ? SOUND_POINTS.placeBlock : 0,
        cooldownTicks: 20,
      });
    }
  });
});

world.afterEvents.entityHurt.subscribe((event) => {
  system.run(() => {
    try {
      const source = event.damageSource;
      if (event.hurtEntity && isWatcherEntity(event.hurtEntity)) {
        handleWatcherAttacked(event, false);
        return;
      }

      if (source && source.damagingEntity && source.damagingEntity.typeId === "minecraft:player") {
        const attacker = source.damagingEntity;
        const profile = playerProfiles.get(attacker.id);
        if (profile) {
          recordSuspiciousAction(attacker, profile, "attack", SOUND_POINTS.attack, {
            heat: 3,
            soundPoints: isPlayerHeardByWatcher(attacker) ? SOUND_POINTS.attack : 0,
            cooldownTicks: CONFIG.loudCombatCooldownTicks,
          });
        }
      }

      if (event.hurtEntity && event.hurtEntity.typeId === "minecraft:player") {
        const victim = event.hurtEntity;
        const profile = playerProfiles.get(victim.id);
        if (profile) {
          recordSuspiciousAction(victim, profile, "player_hurt", SOUND_POINTS.playerHurt, {
            fear: 2,
            soundPoints: isPlayerHeardByWatcher(victim) ? SOUND_POINTS.playerHurt : 0,
            cooldownTicks: CONFIG.loudCombatCooldownTicks,
          });
        }
      }
    } catch (_error) {
      // entityHurt events are best-effort.
    }
  });
});

world.afterEvents.entityDie.subscribe((event) => {
  system.run(() => {
    try {
      handleWatcherDeath(event);
    } catch (_error) {
      // entityDie handling is best-effort.
    }
  });
});

world.afterEvents.explosion.subscribe((event) => {
  system.run(() => {
    try {
      const dimension = event.dimension;
      if (!dimension) {
        return;
      }

      const source = event.source;
      const epicenter = source && isEntityValid(source) ? cloneLocation(source.location) : undefined;
      const currentTick = system.currentTick || 0;

      for (const player of getCachedPlayers()) {
        if (!isInterestingPlayer(player) || player.dimension.id !== dimension.id) {
          continue;
        }

        if (epicenter && distance(player.location, epicenter) > CONFIG.soundExplosionRadius) {
          continue;
        }

        const profile = playerProfiles.get(player.id);
        if (profile) {
          addSoundScore(profile, SOUND_POINTS.explosion);
          if (epicenter) {
            recordWatcherEvidenceForPlayer(
              player,
              EVIDENCE_KIND.Sound,
              1,
              currentTick,
              { location: epicenter, maxDistance: CONFIG.soundExplosionRadius },
            );
          }
        }
      }
    } catch (_error) {
      // Explosion events are best-effort.
    }
  });
});


world.afterEvents.playerLeave.subscribe((event) => {
  const playerId = event?.playerId;
  if (!playerId) {
    return;
  }
  const profile = playerProfiles.get(playerId);
  if (profile) {
    saveProfileMemory(profile, true);
  }
  playerProfiles.delete(playerId);
  psychologicalCooldownUntilByPlayer.delete(playerId);
  activePsychologicalWatchersByPlayer.delete(playerId);
  debugWatcherFailureReasonByPlayer.delete(playerId);
  resetPlayerHorrorState(playerId);
  clearPlayerTelemetry(playerId);
});

system.afterEvents.scriptEventReceive.subscribe(handleScriptEvent, {
  namespaces: ["paradise"],
});

system.run(() => {
  initializeWatcherSystem();
});

system.runInterval(() => {
  const currentTick = system.currentTick;

  if (!bootstrapDone) {
    initializeWatcherSystem();
  }

  if (currentTick % CONFIG.memorySampleInterval === 0) {
    for (const player of getCachedPlayers()) {
      const profile = samplePlayerMemory(player, currentTick, false);
      if (profile && !isPlayerInSafeRoom(player, currentTick)) {
        maybePlayAmbientHorrorAudio(player, {
          heat: profile.heat,
          fear: profile.fear,
          soundScore: profile.soundScore,
          pressure: getProfilePressure(profile),
          tensionState: profile.tensionState,
          nearbyPlayers: countNearbyPlayers(player, 96),
        });
      }
    }
  }

  if (currentTick % CONFIG.rescanInterval === 0) {
    scanLoadedWatchers();
  }

  tickVhsForPlayers(currentTick);
  tickSafeRoomExteriorPsychology(currentTick);
  ensureWatchersForPlayers(currentTick);
  tickAllWatchers(currentTick);
  saveDueProfiles(currentTick);
  cleanupState(currentTick);
}, CONFIG.tickInterval);
