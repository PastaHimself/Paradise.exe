import {
  BlockPermutation,
  CommandPermissionLevel,
  CustomCommandStatus,
  GameMode,
  system,
  world,
} from "@minecraft/server";
import { maybePlayCatacombAudio } from "./horror_audio.js";
import { getCachedPlayers } from "./paradise_tick_cache.js";
import { scheduleStructurePlacement } from "./paradise_visual_jobs.js";
import {
  VHS_TIER,
  canTrigger,
  clearRuleState,
  getOrCreateRuleState,
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

export const CATACOMB_DIMENSION_ID = "catacombs:catacomb_mazes";
const LEGACY_ENTER_COMMAND_ID = "p:catacombs";
const PARADISE_ENTER_COMMAND_ID = "p:enter_catacombs";
const CHAT_ENTER_COMMAND = "!enter_catacombs";
const BUILD_OBJECTIVE_ID = "catacombs_state";
const BUILD_OBJECTIVE_LABEL = "Catacombs State";
const BUILD_PARTICIPANT = "catacombs_built";
const BUILD_MARKER_VALUE = 2;
const TICKING_AREA_ID = "catacombs:maze_core";
const RETURN_TICKING_AREA_PREFIX = "catacombs:return:";
const CATACOMB_ESCAPE_LIMIT_TICKS = 20 * 60 * 20;
const CATACOMB_TIMER_CHECK_INTERVAL_TICKS = 20;
const FLICKER_LIGHT_INTERVAL_TICKS = 4;
const FLICKER_ACTIVE_DISTANCE = 72;
const EXTRA_LOOP_COUNT = 10;
const MAX_AUTHORED_CATACOMB_MODULES = 6;
const MAX_FLICKER_LIGHT_NODES = 32;
const CATACOMB_MODULES = Object.freeze([
  { id: "paradise:catacombs/tomb_shrine", depth: 3 },
  { id: "paradise:catacombs/ossuary_panel", depth: 2 },
  { id: "paradise:catacombs/collapsed_crypt", depth: 5 },
  { id: "paradise:catacombs/memorial_chamber", depth: 5 },
]);

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function addVec(location, dx = 0, dy = 0, dz = 0) {
  return {
    x: location.x + dx,
    y: location.y + dy,
    z: location.z + dz,
  };
}

function isCatacombDimensionId(dimensionId) {
  return String(dimensionId) === CATACOMB_DIMENSION_ID;
}

const MAZE = {
  originX: 0,
  originY: 64,
  originZ: 0,
  cellsX: 17,
  cellsZ: 17,
  cellSize: 5,
  openMinY: 65,
  openMaxY: 68,
  ceilingY: 69,
  startCellX: 1,
  startCellZ: 1,
  margin: 4,
  lightEveryCells: 16,
  ossuaryWallChance: 0.92,
  skullNicheChance: 0.42,
};

const BLOCK_DEFINITIONS = {
  air: ["minecraft:air"],
  stoneBricks: ["minecraft:stone_bricks"],
  crackedStoneBricks: ["minecraft:cracked_stone_bricks"],
  mossyStoneBricks: ["minecraft:mossy_stone_bricks"],
  cobblestone: ["minecraft:cobblestone"],
  mossyCobblestone: ["minecraft:mossy_cobblestone"],
  tuff: ["minecraft:tuff"],
  calcite: ["minecraft:calcite"],
  smoothBasalt: ["minecraft:smooth_basalt"],
  sandstone: ["minecraft:sandstone"],
  cutSandstone: ["minecraft:cut_sandstone"],
  chiseledSandstone: ["minecraft:chiseled_sandstone"],
  packedMud: ["minecraft:packed_mud"],
  mudBricks: ["minecraft:mud_bricks"],
  brownConcretePowder: ["minecraft:brown_concrete_powder"],
  polishedBlackstoneBricks: ["minecraft:polished_blackstone_bricks"],
  deepslateBricks: ["minecraft:deepslate_bricks"],
  crackedDeepslateBricks: ["minecraft:cracked_deepslate_bricks"],
  chiseledDeepslate: ["minecraft:chiseled_deepslate"],
  soulLantern: ["minecraft:soul_lantern"],
  lantern: ["minecraft:lantern"],
  soulTorch: ["minecraft:soul_torch"],
  candle: ["minecraft:candle", { candles: 1, lit: true }],
  unlitCandle: ["minecraft:candle", { candles: 1, lit: false }],
  boneBlock: ["minecraft:bone_block"],
  cobweb: ["minecraft:web"],
  gravel: ["minecraft:gravel"],
  soulSand: ["minecraft:soul_sand"],
  ironBars: ["minecraft:iron_bars"],
  chain: ["minecraft:chain"],
  obsidian: ["minecraft:obsidian"],
  cryingObsidian: ["minecraft:crying_obsidian"],
  stoneBrickWall: ["minecraft:stone_brick_wall"],
  stonePressurePlate: ["minecraft:stone_pressure_plate"],
  skeletonSkull: ["minecraft:skeleton_skull"],
  deepslateTile: ["minecraft:deepslate_tiles"],
};

const permutationCache = new Map();

function resolvePermutation(typeId, states) {
  const cacheKey = states ? `${typeId}:${JSON.stringify(states)}` : typeId;
  if (!permutationCache.has(cacheKey)) {
    let permutation;
    try {
      permutation = BlockPermutation.resolve(typeId, states);
    } catch (error) {
      const fallbackTypeId =
        typeId === "minecraft:web"
          ? "minecraft:cobweb"
          : typeId === "minecraft:cobweb"
            ? "minecraft:web"
            : "minecraft:air";

      try {
        permutation = BlockPermutation.resolve(fallbackTypeId, states);
      } catch (_fallbackError) {
        permutation = BlockPermutation.resolve("minecraft:air");
      }
    }
    permutationCache.set(cacheKey, permutation);
  }
  return permutationCache.get(cacheKey);
}

function getBlockPermutation(name) {
  const definition = BLOCK_DEFINITIONS[name];
  if (!definition) {
    return resolvePermutation("minecraft:air");
  }
  return resolvePermutation(definition[0], definition[1]);
}

const BLOCK = {
  get air() { return getBlockPermutation("air"); },
  get stoneBricks() { return getBlockPermutation("stoneBricks"); },
  get crackedStoneBricks() { return getBlockPermutation("crackedStoneBricks"); },
  get mossyStoneBricks() { return getBlockPermutation("mossyStoneBricks"); },
  get cobblestone() { return getBlockPermutation("cobblestone"); },
  get mossyCobblestone() { return getBlockPermutation("mossyCobblestone"); },
  get tuff() { return getBlockPermutation("tuff"); },
  get calcite() { return getBlockPermutation("calcite"); },
  get smoothBasalt() { return getBlockPermutation("smoothBasalt"); },
  get sandstone() { return getBlockPermutation("sandstone"); },
  get cutSandstone() { return getBlockPermutation("cutSandstone"); },
  get chiseledSandstone() { return getBlockPermutation("chiseledSandstone"); },
  get packedMud() { return getBlockPermutation("packedMud"); },
  get mudBricks() { return getBlockPermutation("mudBricks"); },
  get brownConcretePowder() { return getBlockPermutation("brownConcretePowder"); },
  get polishedBlackstoneBricks() { return getBlockPermutation("polishedBlackstoneBricks"); },
  get deepslateBricks() { return getBlockPermutation("deepslateBricks"); },
  get crackedDeepslateBricks() { return getBlockPermutation("crackedDeepslateBricks"); },
  get chiseledDeepslate() { return getBlockPermutation("chiseledDeepslate"); },
  get soulLantern() { return getBlockPermutation("soulLantern"); },
  get lantern() { return getBlockPermutation("lantern"); },
  get soulTorch() { return getBlockPermutation("soulTorch"); },
  get candle() { return getBlockPermutation("candle"); },
  get unlitCandle() { return getBlockPermutation("unlitCandle"); },
  get boneBlock() { return getBlockPermutation("boneBlock"); },
  get cobweb() { return getBlockPermutation("cobweb"); },
  get gravel() { return getBlockPermutation("gravel"); },
  get soulSand() { return getBlockPermutation("soulSand"); },
  get ironBars() { return getBlockPermutation("ironBars"); },
  get chain() { return getBlockPermutation("chain"); },
  get obsidian() { return getBlockPermutation("obsidian"); },
  get cryingObsidian() { return getBlockPermutation("cryingObsidian"); },
  get stoneBrickWall() { return getBlockPermutation("stoneBrickWall"); },
  get stonePressurePlate() { return getBlockPermutation("stonePressurePlate"); },
  get skeletonSkull() { return getBlockPermutation("skeletonSkull"); },
  get deepslateTile() { return getBlockPermutation("deepslateTile"); },
};

const MOB = {
  skeleton: "minecraft:skeleton",
  zombie: "minecraft:zombie",
  husk: "minecraft:husk",
  spider: "minecraft:spider",
  caveSpider: "minecraft:cave_spider",
  silverfish: "minecraft:silverfish",
  witherSkeleton: "minecraft:wither_skeleton",
};

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

const SIDE_ORDER = ["north", "east", "south", "west"];
const DOOR_FACING_BY_SIDE = {
  north: "south",
  east: "west",
  south: "north",
  west: "east",
};

const returnPoints = new Map();
const pendingEscape = new Set();
const catacombGamemodes = new Map();
const catacombEscapeTimers = new Map();
const pendingCatacombRespawns = new Set();
const catacombMemoryRules = new Map();

let mazePlan = null;
let mazeReady = false;
let bootstrapPromise = null;
let coreAreaPromise = null;
let timedRebuildPromise = null;
let mazeGenerationNonce = 0;
let flickerLightNodes = [];
let flickerLightsReady = false;

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

function registerCatacombsEnterCommand(event, commandId) {
  try {
    event.customCommandRegistry.registerCommand(
      {
        name: commandId,
        description: "Enter the Catacomb Mazes dimension",
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
          runCatacombsEntryCommand(source);
        });

        return {
          status: CustomCommandStatus.Success,
          message: "Preparing the Catacombs...",
        };
      },
    );
  } catch (_error) {
    // Ignore duplicate command registration during reloads.
  }
}

function handleCatacombsChatEnterCommand(event) {
  const message = String(event.message || "").trim().toLowerCase();
  if (message !== CHAT_ENTER_COMMAND) {
    return;
  }

  event.cancel = true;
  system.run(() => {
    const sender = event.sender;
    if (!sender || sender.typeId !== "minecraft:player") return;
    try {
      sender.sendMessage("Entering the Catacombs...");
    } catch (_error) {}
    runCatacombsEntryCommand(sender);
  });
}

system.beforeEvents.startup.subscribe((event) => {
  try {
    event.dimensionRegistry.registerCustomDimension(CATACOMB_DIMENSION_ID);
  } catch (_error) {
    // Ignore already-registered reloads.
  }

  registerCatacombsEnterCommand(event, LEGACY_ENTER_COMMAND_ID);
  registerCatacombsEnterCommand(event, PARADISE_ENTER_COMMAND_ID);
});

world.afterEvents.worldLoad.subscribe(() => {
  void ensureWorldReady();
  system.run(() => {
    syncCatacombGamemodes();
  });
});

world.beforeEvents.chatSend.subscribe(handleCatacombsChatEnterCommand);

world.beforeEvents.playerBreakBlock.subscribe((event) => {
  const block = event.block;
  const player = event.player;
  if (!block || !isCatacombDimensionId(block.dimension.id)) {
    return;
  }

  event.cancel = true;

  if (player && player.typeId === "minecraft:player") {
    const disturbedTypeId = block.typeId;
    const disturbedLocation = { ...block.location };
    system.run(() => {
      recordCatacombDisturbance(player, disturbedTypeId, disturbedLocation);
    });
  }
});

world.beforeEvents.explosion.subscribe((event) => {
  if (!event.dimension || !isCatacombDimensionId(event.dimension.id)) {
    return;
  }

  event.cancel = true;
  try {
    event.setImpactedBlocks([]);
  } catch (_error) {
    // Canceling the event is enough on API versions that reject block rewrites here.
  }
});

world.afterEvents.playerDimensionChange.subscribe((event) => {
  const player = event.player;
  if (!player) {
    return;
  }

  if (isCatacombDimensionId(event.toDimension.id) && !isCatacombDimensionId(event.fromDimension.id)) {
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
      enableCatacombBuildAccess(player);
      startCatacombEscapeTimer(player);
    });
    return;
  }

  if (isCatacombDimensionId(event.fromDimension.id) && !isCatacombDimensionId(event.toDimension.id)) {
    system.run(() => {
      restoreCatacombBuildAccess(player);
    });
    clearCatacombEscapeTimer(player.id);
    if (pendingCatacombRespawns.has(player.id)) {
      return;
    }

    pendingEscape.delete(player.id);
    returnPoints.delete(player.id);
    clearRuleState(catacombMemoryRules, player.id);
  }
});

world.afterEvents.playerInteractWithBlock.subscribe((event) => {
  const player = event.player;
  const block = event.block;
  if (!player || !block || !isCatacombDimensionId(player.dimension.id) || !mazePlan || !mazePlan.exitDoor) {
    return;
  }

  if (isExitDoorBlock(block, mazePlan.exitDoor)) {
    triggerExit(player);
  }
});

world.afterEvents.pressurePlatePush.subscribe((event) => {
  const source = event.source;
  const block = event.block;
  if (
    !source ||
    source.typeId !== "minecraft:player" ||
    !isCatacombDimensionId(source.dimension.id) ||
    !block ||
    !mazePlan ||
    !mazePlan.exitDoor
  ) {
    return;
  }

  if (isExitPlateBlock(block, mazePlan.exitDoor)) {
    triggerExit(source);
  }
});

world.afterEvents.entityDie.subscribe((event) => {
  const entity = event.deadEntity;
  if (!entity || entity.typeId !== "minecraft:player" || !isCatacombDimensionId(entity.dimension.id)) {
    return;
  }

  pendingCatacombRespawns.add(entity.id);
  clearCatacombEscapeTimer(entity.id);
});

world.afterEvents.playerSpawn.subscribe((event) => {
  const player = event.player;
  if (!player || !pendingCatacombRespawns.has(player.id)) {
    return;
  }

  system.runTimeout(() => {
    pendingCatacombRespawns.delete(player.id);
    void (async () => {
      await rebuildMazeNow();
      const spawn = mazePlan ? getStartSpawnLocation(mazePlan) : { x: 2.5, y: MAZE.originY + 1, z: 2.5 };
      await teleportPlayerIntoCatacombs(player, spawn, {
        title: "Catacomb Mazes",
        subtitle: "Death does not release you. The maze rebuilt itself.",
        reportFailure: false,
      });
    })().catch(() => {});
  }, 1);
});

world.afterEvents.playerLeave.subscribe((event) => {
  returnPoints.delete(event.playerId);
  pendingEscape.delete(event.playerId);
  catacombGamemodes.delete(event.playerId);
  clearCatacombEscapeTimer(event.playerId);
  pendingCatacombRespawns.delete(event.playerId);
  clearRuleState(catacombMemoryRules, event.playerId);
});

system.runInterval(tickCatacombEscapeTimers, CATACOMB_TIMER_CHECK_INTERVAL_TICKS);
system.runInterval(tickFlickeringCatacombLights, FLICKER_LIGHT_INTERVAL_TICKS);
system.runInterval(tickCatacombMemoryRules, 10);

function getCatacombMemoryState(playerId) {
  return getOrCreateRuleState(catacombMemoryRules, playerId, () => ({
    pressure: 0,
    currentCellKey: undefined,
    repeatedCells: new Map(),
    recentCells: [],
    disturbedGraves: 0,
    cooldowns: new Map(),
  }));
}

function getCellFromLocation(location) {
  if (!mazePlan || !Array.isArray(mazePlan.cellsFlat)) return undefined;
  const x = Math.floor((Math.floor(location.x) - MAZE.originX) / MAZE.cellSize);
  const z = Math.floor((Math.floor(location.z) - MAZE.originZ) / MAZE.cellSize);
  if (x < 0 || z < 0 || x >= MAZE.cellsX || z >= MAZE.cellsZ) return undefined;
  return getCell(mazePlan.grid, x, z);
}

function isGraveMemoryBlock(typeId) {
  return [
    "minecraft:skeleton_skull",
    "minecraft:candle",
    "minecraft:soul_lantern",
    "minecraft:lantern",
    "minecraft:bone_block",
    "minecraft:stone_brick_wall",
    "minecraft:chain",
    "minecraft:web",
    "minecraft:cobweb",
  ].includes(String(typeId));
}

function recordCatacombDisturbance(player, typeId, location) {
  if (!player || !isCatacombDimensionId(player.dimension.id)) return;
  const ruleState = getCatacombMemoryState(player.id);
  ruleState.pressure += isGraveMemoryBlock(typeId) ? 7 : 2;
  ruleState.disturbedGraves += isGraveMemoryBlock(typeId) ? 1 : 0;
  warnCatacombMemory(player, ruleState, location, "Do not disturb them.");
}

function placeCatacombMemoryMarker(dim, cell, text = "YOU WERE HERE") {
  if (!cell) return;
  const base = getCellBase(cell);
  const center = getCellCenter(cell);
  try {
    setBlock(dim, base.x + 1, MAZE.originY + 1, base.z + 1, BLOCK.skeletonSkull);
    setBlock(dim, base.x + 3, MAZE.originY + 1, base.z + 3, BLOCK.unlitCandle);
    setBlock(dim, base.x + 2, MAZE.originY, base.z + 2, BLOCK.soulSand);
    setStandingSign(dim, { x: center.x, y: MAZE.originY + 1, z: center.z }, text, "minecraft:spruce_sign");
  } catch (_error) {}
}

function ageRememberedCatacombCell(dim, cell, strength = 1) {
  if (!cell) return;
  const interior = getCellInterior(cell);
  for (let i = 0; i < Math.min(5, 2 + strength); i++) {
    const x = randomInt(interior.minX, interior.maxX);
    const z = randomInt(interior.minZ, interior.maxZ);
    const block = strength > 2 ? BLOCK.soulSand : (Math.random() < 0.5 ? BLOCK.gravel : BLOCK.crackedStoneBricks);
    setBlock(dim, x, MAZE.originY, z, block);
  }
}

function warnCatacombMemory(player, ruleState, location = player.location, subtitle = "The dead remember your path.") {
  if (!canTrigger(ruleState, "warning", 20 * 12)) return;
  safePlaySound(player.dimension, "block.bell.use", location, { volume: 0.45, pitch: 0.5 });
  safeSpawnParticle(player.dimension, "minecraft:sculk_soul_particle", addVec(location, 0, 0.4, 0));
  requestRuleVhs(player, VHS_TIER.Low, 20 * 5, "catacomb-memory-warning");
  safeTitle(player, "", subtitle, 30);
}

function punishCatacombMemory(player, ruleState) {
  const scareDecision = tryBeginRuleScare(player, ruleState, "consequence", 20 * 60, {
    source: "dimension_scare:catacomb_memory_shift",
    intensity: 4,
    minimumQuietTicks: 20 * 45,
    buildupTicks: 20 * 4,
    peakTicks: 20 * 8,
    reliefTicks: 20 * 20,
    globalCooldownTicks: 20 * 60,
    playerCooldownTicks: 20 * 75,
  });
  if (!scareDecision.allowed) return;
  ruleState.pressure = Math.max(0, ruleState.pressure - 16);
  safeTitle(player, "The dead know this corridor.", "The path is no longer yours.", 50);
  safeAddEffect(player, "minecraft:blindness", 55, { amplifier: 0, showParticles: false });
  requestRuleVhs(player, VHS_TIER.High, 20 * 8, "catacomb-memory-shift");
  system.run(() => {
    void resetPlayerToCatacombSpawn(player, { announce: true }).catch(() => {});
  });
}

function tickCatacombMemoryRules() {
  if (!mazeReady || !mazePlan || timedRebuildPromise) return;
  const players = getCatacombPlayers();
  if (!players.length) return;
  const dim = getCatacombDimension();

  for (const player of players) {
    if (!player || pendingEscape.has(player.id)) continue;
    const ruleState = getCatacombMemoryState(player.id);
    sampleMotion(ruleState, player.location);
    const cell = getCellFromLocation(player.location);
    if (!cell) continue;
    const key = cellKey(cell);

    if (ruleState.currentCellKey !== key) {
      ruleState.currentCellKey = key;
      ruleState.recentCells.push(key);
      while (ruleState.recentCells.length > 10) ruleState.recentCells.shift();
      const visits = (ruleState.repeatedCells.get(key) || 0) + 1;
      ruleState.repeatedCells.set(key, visits);

      if (visits === 2 || ruleState.recentCells.slice(0, -1).includes(key)) {
        ruleState.pressure += 4;
        warnCatacombMemory(player, ruleState, player.location, "You have walked here before.");
        if (canTrigger(ruleState, `marker:${key}`, 20 * 45)) {
          placeCatacombMemoryMarker(dim, cell, "YOU WERE\\nHERE");
        }
      } else {
        ruleState.pressure = Math.max(0, ruleState.pressure - 1);
      }

      if (visits >= 3) {
        ageRememberedCatacombCell(dim, cell, visits);
        ruleState.pressure += 3;
      }
    }

    if (ruleState.pressure >= 14) {
      warnCatacombMemory(player, ruleState, player.location, "They recognize your route.");
    }
    if (ruleState.pressure >= 24) {
      punishCatacombMemory(player, ruleState);
    }

    maybePlayCatacombAudio(player, {
      pressure: ruleState.pressure,
    });
  }
}

function registerFlickerLight(position, onPermutation, offPermutation, rng = null, options = {}) {
  if (!position || !onPermutation || !offPermutation || flickerLightNodes.length >= MAX_FLICKER_LIGHT_NODES) {
    return;
  }

  const nodeRng = rng || makeRng(`flicker:${position.x}:${position.y}:${position.z}:${flickerLightNodes.length}`);
  flickerLightNodes.push({
    position: {
      x: position.x,
      y: position.y,
      z: position.z,
    },
    onPermutation,
    offPermutation,
    lit: true,
    nextTick: system.currentTick + 8 + nodeRng.int(80),
    onTicksMin: options.onTicksMin ?? 20,
    onTicksMax: options.onTicksMax ?? 120,
    offTicksMin: options.offTicksMin ?? 2,
    offTicksMax: options.offTicksMax ?? 10,
    burstChance: options.burstChance ?? 0.25,
  });
}

function isPlayerNearPosition(player, position, maxDistance) {
  const dx = player.location.x - position.x;
  const dy = player.location.y - position.y;
  const dz = player.location.z - position.z;
  return dx * dx + dy * dy + dz * dz <= maxDistance * maxDistance;
}

function hasNearbyCatacombPlayer(players, position) {
  for (const player of players) {
    if (isPlayerNearPosition(player, position, FLICKER_ACTIVE_DISTANCE)) {
      return true;
    }
  }
  return false;
}

function scheduleNextFlicker(light, currentTick) {
  const minTicks = light.lit ? light.onTicksMin : light.offTicksMin;
  const maxTicks = Math.max(minTicks, light.lit ? light.onTicksMax : light.offTicksMax);
  light.nextTick = currentTick + randomInt(minTicks, maxTicks);

  if (!light.lit && Math.random() < light.burstChance) {
    light.nextTick = currentTick + randomInt(1, 4);
  }
}

function tickFlickeringCatacombLights() {
  if (!flickerLightsReady || flickerLightNodes.length === 0) {
    return;
  }

  const players = getCatacombPlayers();
  if (players.length === 0) {
    return;
  }

  const dim = getDimensionSafe(CATACOMB_DIMENSION_ID);
  if (!dim) {
    return;
  }

  const currentTick = system.currentTick;
  let updates = 0;
  for (const light of flickerLightNodes) {
    if (currentTick < light.nextTick) {
      continue;
    }

    if (!hasNearbyCatacombPlayer(players, light.position)) {
      light.nextTick = currentTick + randomInt(40, 100);
      continue;
    }

    light.lit = !light.lit;
    const permutation = light.lit ? light.onPermutation : light.offPermutation;
    setBlock(dim, light.position.x, light.position.y, light.position.z, permutation);
    scheduleNextFlicker(light, currentTick);

    updates++;
    if (updates >= 18) {
      break;
    }
  }
}

function startCatacombEscapeTimer(player) {
  if (!player || !isCatacombDimensionId(player.dimension.id)) {
    return;
  }

  catacombEscapeTimers.set(player.id, system.currentTick + CATACOMB_ESCAPE_LIMIT_TICKS);
}

function clearCatacombEscapeTimer(playerId) {
  catacombEscapeTimers.delete(playerId);
}

function getCatacombPlayers() {
  try {
    const dimension = getDimensionSafe(CATACOMB_DIMENSION_ID);
    if (dimension && typeof dimension.getPlayers === "function") {
      return dimension.getPlayers().filter((player) => player && isCatacombDimensionId(player.dimension.id));
    }
  } catch (_error) {
    // Fall back to the global player scan below.
  }

  try {
    return getCachedPlayers().filter((player) => player && isCatacombDimensionId(player.dimension.id));
  } catch (_error) {
    return [];
  }
}

function syncCatacombEscapeTimers() {
  const activeCatacombPlayerIds = new Set();

  for (const player of getCatacombPlayers()) {
    activeCatacombPlayerIds.add(player.id);
    if (!catacombEscapeTimers.has(player.id)) {
      startCatacombEscapeTimer(player);
    }
  }

  for (const playerId of catacombEscapeTimers.keys()) {
    if (!activeCatacombPlayerIds.has(playerId)) {
      catacombEscapeTimers.delete(playerId);
    }
  }
}

function formatTimerTicks(ticks) {
  const totalSeconds = Math.max(0, Math.ceil(ticks / 20));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function showCatacombTimer(player, expiresAt, currentTick) {
  try {
    player.onScreenDisplay.setActionBar(`Maze shifts in ${formatTimerTicks(expiresAt - currentTick)}`);
  } catch (_error) {
    // The timer still runs if the HUD update is unavailable.
  }
}

function getWorldSeedText() {
  // Version-sensitive: world.seed is still pre-release. The fallback keeps the maze deterministic.
  try {
    if (typeof world.seed === "string" && world.seed.length > 0) {
      return world.seed;
    }
  } catch (_error) {
    // Ignore and use fallback.
  }

  return "catacombs-default-seed";
}

function makeFreshMazeSeedText() {
  mazeGenerationNonce += 1;
  return `catacombs-fresh-${Date.now()}-${mazeGenerationNonce}-${Math.random().toString(36).slice(2)}`;
}

function hashString(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function makeRng(seedText) {
  let state = hashString(seedText) || 0x6d2b79f5;

  const next = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };

  return {
    next,
    chance(probability) {
      return next() < probability;
    },
    int(max) {
      return Math.floor(next() * max);
    },
    pick(values) {
      return values[Math.floor(next() * values.length)];
    },
    shuffle(values) {
      for (let i = values.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [values[i], values[j]] = [values[j], values[i]];
      }
      return values;
    },
  };
}

function makeDoorPermutation(facing, open, upper) {
  return resolvePermutation("minecraft:dark_oak_door", {
    "minecraft:cardinal_direction": facing,
    door_hinge_bit: false,
    open_bit: open,
    upper_block_bit: upper,
  });
}

function getMazeMinX() {
  return MAZE.originX;
}

function getMazeMinZ() {
  return MAZE.originZ;
}

function getMazeMaxX() {
  return MAZE.originX + MAZE.cellsX * MAZE.cellSize - 1;
}

function getMazeMaxZ() {
  return MAZE.originZ + MAZE.cellsZ * MAZE.cellSize - 1;
}

function getCellBase(cell) {
  return {
    x: MAZE.originX + cell.x * MAZE.cellSize,
    z: MAZE.originZ + cell.z * MAZE.cellSize,
  };
}

function getCellInterior(cell) {
  const base = getCellBase(cell);
  return {
    minX: base.x + 1,
    maxX: base.x + 3,
    minZ: base.z + 1,
    maxZ: base.z + 3,
  };
}

function getCellCenter(cell) {
  const base = getCellBase(cell);
  return {
    x: base.x + 2,
    z: base.z + 2,
  };
}

function cellKey(cell) {
  return `${cell.x},${cell.z}`;
}

function getCell(grid, x, z) {
  if (z < 0 || z >= grid.length) {
    return undefined;
  }
  if (x < 0 || x >= grid[z].length) {
    return undefined;
  }
  return grid[z][x];
}

function createCellGrid() {
  const grid = [];
  for (let z = 0; z < MAZE.cellsZ; z++) {
    const row = [];
    for (let x = 0; x < MAZE.cellsX; x++) {
      row.push({
        x,
        z,
        links: new Set(),
        role: "corridor",
        distance: 0,
        deadEnd: false,
      });
    }
    grid.push(row);
  }
  return grid;
}

function neighborCells(grid, cell) {
  const candidates = [
    getCell(grid, cell.x, cell.z - 1),
    getCell(grid, cell.x + 1, cell.z),
    getCell(grid, cell.x, cell.z + 1),
    getCell(grid, cell.x - 1, cell.z),
  ];
  return candidates.filter(Boolean);
}

function linkCells(a, b) {
  a.links.add(cellKey(b));
  b.links.add(cellKey(a));
}

function hasLink(cell, x, z) {
  return cell.links.has(`${x},${z}`);
}

function carveDepthFirstMaze(grid, rng) {
  const start = getCell(grid, MAZE.startCellX, MAZE.startCellZ);
  const stack = [start];
  start.visited = true;

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const unvisited = neighborCells(grid, current).filter((candidate) => !candidate.visited);
    rng.shuffle(unvisited);

    if (unvisited.length === 0) {
      stack.pop();
      continue;
    }

    const next = unvisited[0];
    next.visited = true;
    linkCells(current, next);
    stack.push(next);
  }
}

function addLoops(grid, rng, loopCount) {
  let attempts = 0;
  let added = 0;
  while (attempts < loopCount * 8 && added < loopCount) {
    attempts++;
    const x = 1 + rng.int(MAZE.cellsX - 2);
    const z = 1 + rng.int(MAZE.cellsZ - 2);
    const cell = getCell(grid, x, z);
    if (!cell || cell.links.size >= 3) {
      continue;
    }

    const neighbors = neighborCells(grid, cell).filter(
      (neighbor) => neighbor.links.size < 3 && !cell.links.has(cellKey(neighbor)),
    );
    if (neighbors.length === 0) {
      continue;
    }

    const neighbor = rng.pick(neighbors);
    linkCells(cell, neighbor);
    added++;
  }
}

function breadthFirstSearch(grid) {
  const start = getCell(grid, MAZE.startCellX, MAZE.startCellZ);
  const queue = [start];
  const distances = new Map();
  const parents = new Map();

  distances.set(cellKey(start), 0);
  parents.set(cellKey(start), null);

  while (queue.length > 0) {
    const current = queue.shift();
    const currentDistance = distances.get(cellKey(current));
    for (const neighbor of neighborCells(grid, current)) {
      const key = cellKey(neighbor);
      if (distances.has(key)) {
        continue;
      }
      if (!current.links.has(key)) {
        continue;
      }
      distances.set(key, currentDistance + 1);
      parents.set(key, cellKey(current));
      queue.push(neighbor);
    }
  }

  return { distances, parents };
}

function chooseExitCell(grid, distances, rng) {
  let best = getCell(grid, MAZE.startCellX, MAZE.startCellZ);
  let bestScore = -1;

  for (const row of grid) {
    for (const cell of row) {
      const key = cellKey(cell);
      const distance = distances.get(key);
      if (distance === undefined) {
        continue;
      }

      const margin = Math.min(cell.x, cell.z, MAZE.cellsX - 1 - cell.x, MAZE.cellsZ - 1 - cell.z);
      const preferred = margin >= 2 ? 100 : margin * 10;
      const score = distance * 100 + preferred + rng.next();
      if (score > bestScore) {
        bestScore = score;
        best = cell;
      }
    }
  }

  return best;
}

function buildPath(parents, startCell, exitCell) {
  const path = [];
  let key = cellKey(exitCell);
  const startKey = cellKey(startCell);

  while (key !== null && key !== undefined) {
    const [xText, zText] = key.split(",");
    path.push({ x: Number(xText), z: Number(zText) });
    if (key === startKey) {
      break;
    }
    key = parents.get(key);
  }

  path.reverse();
  return path;
}

function chooseSafeCells(path, rng) {
  const result = new Set();
  const wanted = [0.22, 0.5, 0.78];
  for (const fraction of wanted) {
    const index = Math.min(path.length - 1, Math.max(1, Math.floor(path.length * fraction)));
    const cell = path[index];
    if (cell) {
      result.add(`${cell.x},${cell.z}`);
    }
  }

  // Add one extra safe room if the maze is large enough.
  if (path.length > 18 && rng.chance(0.5)) {
    const index = Math.min(path.length - 2, Math.max(2, Math.floor(path.length * 0.33)));
    const cell = path[index];
    if (cell) {
      result.add(`${cell.x},${cell.z}`);
    }
  }

  return result;
}

function chooseLootCells(grid, pathSet, safeSet, rng) {
  const candidates = grid
    .flat()
    .filter((cell) => {
      const key = cellKey(cell);
      if (key === `${MAZE.startCellX},${MAZE.startCellZ}`) return false;
      if (pathSet.has(key) || safeSet.has(key)) return false;
      if (cell.distance < 5) return false;
      return cell.deadEnd || cell.links.size <= 2;
    });

  rng.shuffle(candidates);

  const result = new Set();
  const targetCount = Math.min(7, Math.max(3, Math.floor(candidates.length / 11)));
  for (const cell of candidates) {
    if (result.size >= targetCount) {
      break;
    }
    result.add(cellKey(cell));
  }

  return result;
}

function chooseDoorSide(cell, rng) {
  const boundarySides = SIDE_ORDER.filter((side) => !getAdjacentCellKey(cell, side));
  if (boundarySides.length > 0) {
    return rng.pick(boundarySides);
  }

  const unlinkedSides = [];
  for (const side of SIDE_ORDER) {
    const adjacent = getAdjacentCellKey(cell, side);
    if (adjacent && !cell.links.has(adjacent.key)) {
      unlinkedSides.push(side);
    }
  }

  if (unlinkedSides.length === 0) {
    return rng.pick(SIDE_ORDER);
  }

  return rng.pick(unlinkedSides);
}

function getAdjacentCellKey(cell, side) {
  switch (side) {
    case "north":
      if (cell.z <= 0) return null;
      return { key: `${cell.x},${cell.z - 1}` };
    case "east":
      if (cell.x >= MAZE.cellsX - 1) return null;
      return { key: `${cell.x + 1},${cell.z}` };
    case "south":
      if (cell.z >= MAZE.cellsZ - 1) return null;
      return { key: `${cell.x},${cell.z + 1}` };
    case "west":
      if (cell.x <= 0) return null;
      return { key: `${cell.x - 1},${cell.z}` };
    default:
      return null;
  }
}

function computeDoorPlacement(cell, side) {
  const base = getCellBase(cell);
  const center = getCellCenter(cell);
  const floorY = MAZE.originY + 1;

  switch (side) {
    case "north":
      return {
        side,
        facing: DOOR_FACING_BY_SIDE.north,
        lower: { x: center.x, y: floorY, z: base.z },
        upper: { x: center.x, y: floorY + 1, z: base.z },
        plate: { x: center.x, y: floorY, z: base.z + 1 },
      };
    case "east":
      return {
        side,
        facing: DOOR_FACING_BY_SIDE.east,
        lower: { x: base.x + 4, y: floorY, z: center.z },
        upper: { x: base.x + 4, y: floorY + 1, z: center.z },
        plate: { x: base.x + 3, y: floorY, z: center.z },
      };
    case "south":
      return {
        side,
        facing: DOOR_FACING_BY_SIDE.south,
        lower: { x: center.x, y: floorY, z: base.z + 4 },
        upper: { x: center.x, y: floorY + 1, z: base.z + 4 },
        plate: { x: center.x, y: floorY, z: base.z + 3 },
      };
    case "west":
    default:
      return {
        side: "west",
        facing: DOOR_FACING_BY_SIDE.west,
        lower: { x: base.x, y: floorY, z: center.z },
        upper: { x: base.x, y: floorY + 1, z: center.z },
        plate: { x: base.x + 1, y: floorY, z: center.z },
      };
  }
}

function createMazePlan(seedText = getWorldSeedText()) {
  const rng = makeRng(seedText);
  const grid = createCellGrid();
  carveDepthFirstMaze(grid, rng);
  addLoops(grid, rng, EXTRA_LOOP_COUNT);

  const { distances, parents } = breadthFirstSearch(grid);
  for (const row of grid) {
    for (const cell of row) {
      cell.distance = distances.get(cellKey(cell)) || 0;
      cell.deadEnd = cell.links.size === 1;
    }
  }

  const startCell = getCell(grid, MAZE.startCellX, MAZE.startCellZ);
  const exitCell = chooseExitCell(grid, distances, rng);
  const path = buildPath(parents, startCell, exitCell);
  const pathSet = new Set(path.map((cell) => `${cell.x},${cell.z}`));
  const safeSet = chooseSafeCells(path, rng);
  const lootSet = chooseLootCells(grid, pathSet, safeSet, rng);

  for (const row of grid) {
    for (const cell of row) {
      const key = cellKey(cell);
      if (key === cellKey(startCell)) {
        cell.role = "start";
      } else if (key === cellKey(exitCell)) {
        cell.role = "exit";
      } else if (safeSet.has(key)) {
        cell.role = "safe";
      } else if (lootSet.has(key)) {
        cell.role = "loot";
      } else if (cell.deadEnd) {
        cell.role = "deadEnd";
      } else {
        cell.role = "corridor";
      }
    }
  }

  const doorSide = chooseDoorSide(exitCell, rng);
  const exitDoor = computeDoorPlacement(exitCell, doorSide);

  return {
    seed: seedText,
    grid,
    startCell,
    exitCell,
    path,
    pathSet,
    safeSet,
    lootSet,
    exitDoor,
    cellsFlat: grid.flat(),
  };
}

function getOrCreateBuildObjective() {
  let objective = world.scoreboard.getObjective(BUILD_OBJECTIVE_ID);
  if (!objective) {
    try {
      objective = world.scoreboard.addObjective(BUILD_OBJECTIVE_ID, BUILD_OBJECTIVE_LABEL);
    } catch (_error) {
      objective = world.scoreboard.getObjective(BUILD_OBJECTIVE_ID);
    }
  }
  return objective;
}

function isMazeBuilt() {
  const objective = world.scoreboard.getObjective(BUILD_OBJECTIVE_ID);
  if (!objective) {
    return false;
  }

  try {
    return (objective.getScore(BUILD_PARTICIPANT) || 0) >= BUILD_MARKER_VALUE;
  } catch (_error) {
    return false;
  }
}

function markMazeBuilt() {
  const objective = getOrCreateBuildObjective();
  if (!objective) {
    return;
  }

  objective.setScore(BUILD_PARTICIPANT, BUILD_MARKER_VALUE);
}

function getDimensionSafe(dimensionId) {
  try {
    return world.getDimension(dimensionId);
  } catch (_error) {
    return undefined;
  }
}

function getCatacombDimension() {
  const dim = getDimensionSafe(CATACOMB_DIMENSION_ID);
  if (!dim) {
    throw new Error(`Dimension ${CATACOMB_DIMENSION_ID} is not available.`);
  }
  return dim;
}

function getMazeBlock(dim, x, y, z) {
  try {
    return dim.getBlock({ x, y, z });
  } catch (_error) {
    return undefined;
  }
}

function setBlock(dim, x, y, z, permutation) {
  const block = getMazeBlock(dim, x, y, z);
  if (!block) {
    return;
  }

  block.setPermutation(permutation);
}

function reinforceMazeFloor(dim, x, z, permutation = BLOCK.stoneBricks) {
  setBlock(dim, x, MAZE.originY - 1, z, permutation);
  const floor = getMazeBlock(dim, x, MAZE.originY, z);
  if (!floor || floor.isAir || floor.isLiquid || PASSABLE_HAZARDS.has(floor.typeId)) {
    setBlock(dim, x, MAZE.originY, z, permutation);
  }
}

function getTimeoutHoldingLocation() {
  return {
    x: MAZE.originX + 2.5,
    y: MAZE.ceilingY + 4,
    z: MAZE.originZ + 2.5,
  };
}

function prepareTimeoutHoldingPlatform(dim) {
  const center = getTimeoutHoldingLocation();
  const baseX = Math.floor(center.x);
  const baseY = Math.floor(center.y);
  const baseZ = Math.floor(center.z);

  for (let x = baseX - 2; x <= baseX + 2; x++) {
    for (let z = baseZ - 2; z <= baseZ + 2; z++) {
      setBlock(dim, x, baseY - 1, z, BLOCK.obsidian);
      setBlock(dim, x, baseY, z, BLOCK.air);
      setBlock(dim, x, baseY + 1, z, BLOCK.air);
    }
  }

  return center;
}

function* fillBox(dim, fromX, toX, fromY, toY, fromZ, toZ, permutation) {
  let placements = 0;
  for (let x = fromX; x <= toX; x++) {
    for (let z = fromZ; z <= toZ; z++) {
      for (let y = fromY; y <= toY; y++) {
        setBlock(dim, x, y, z, permutation);
        placements++;
        if (placements % 256 === 0) {
          yield;
        }
      }
    }
  }
}

function* carveCellInterior(dim, cell) {
  const interior = getCellInterior(cell);
  for (let x = interior.minX; x <= interior.maxX; x++) {
    for (let z = interior.minZ; z <= interior.maxZ; z++) {
      reinforceMazeFloor(dim, x, z);
      for (let y = MAZE.openMinY; y <= MAZE.openMaxY; y++) {
        setBlock(dim, x, y, z, BLOCK.air);
      }
    }
  }
  yield;
}

function* carveLink(dim, cell, side) {
  const base = getCellBase(cell);
  const interior = getCellInterior(cell);
  const minY = MAZE.openMinY;
  const maxY = MAZE.openMaxY;

  switch (side) {
    case "north":
      for (let x = interior.minX; x <= interior.maxX; x++) {
        reinforceMazeFloor(dim, x, base.z);
        for (let y = minY; y <= maxY; y++) {
          setBlock(dim, x, y, base.z, BLOCK.air);
        }
      }
      break;
    case "east":
      for (let z = interior.minZ; z <= interior.maxZ; z++) {
        reinforceMazeFloor(dim, base.x + 4, z);
        reinforceMazeFloor(dim, base.x + 5, z);
        for (let y = minY; y <= maxY; y++) {
          setBlock(dim, base.x + 4, y, z, BLOCK.air);
          setBlock(dim, base.x + 5, y, z, BLOCK.air);
        }
      }
      break;
    case "south":
      for (let x = interior.minX; x <= interior.maxX; x++) {
        reinforceMazeFloor(dim, x, base.z + 4);
        reinforceMazeFloor(dim, x, base.z + 5);
        for (let y = minY; y <= maxY; y++) {
          setBlock(dim, x, y, base.z + 4, BLOCK.air);
          setBlock(dim, x, y, base.z + 5, BLOCK.air);
        }
      }
      break;
    case "west":
      for (let z = interior.minZ; z <= interior.maxZ; z++) {
        reinforceMazeFloor(dim, base.x, z);
        for (let y = minY; y <= maxY; y++) {
          setBlock(dim, base.x, y, z, BLOCK.air);
        }
      }
      break;
    default:
      break;
  }
  yield;
}

function isSideOpen(cell, side) {
  const adjacent = getAdjacentCellKey(cell, side);
  return Boolean(adjacent && cell.links.has(adjacent.key));
}

function getClosedSides(cell) {
  return SIDE_ORDER.filter((side) => !isSideOpen(cell, side));
}

function getWallRun(cell, side) {
  const base = getCellBase(cell);
  switch (side) {
    case "north":
      return [
        { x: base.x + 1, z: base.z },
        { x: base.x + 2, z: base.z },
        { x: base.x + 3, z: base.z },
      ];
    case "east":
      return [
        { x: base.x + 4, z: base.z + 1 },
        { x: base.x + 4, z: base.z + 2 },
        { x: base.x + 4, z: base.z + 3 },
      ];
    case "south":
      return [
        { x: base.x + 1, z: base.z + 4 },
        { x: base.x + 2, z: base.z + 4 },
        { x: base.x + 3, z: base.z + 4 },
      ];
    case "west":
    default:
      return [
        { x: base.x, z: base.z + 1 },
        { x: base.x, z: base.z + 2 },
        { x: base.x, z: base.z + 3 },
      ];
  }
}

function getSideAxisOffset(side, amount) {
  switch (side) {
    case "north":
      return { dx: 0, dz: amount };
    case "east":
      return { dx: -amount, dz: 0 };
    case "south":
      return { dx: 0, dz: -amount };
    case "west":
    default:
      return { dx: amount, dz: 0 };
  }
}

function getWallCenter(cell, side) {
  const run = getWallRun(cell, side);
  return run[1] || run[0];
}

function placeRoughBlock(dim, x, y, z, rng, palette) {
  setBlock(dim, x, y, z, rng.pick(palette));
}

function roughenCeiling(dim, cell, rng) {
  const interior = getCellInterior(cell);
  const ceilingPalette = [
    BLOCK.cobblestone,
    BLOCK.tuff,
    BLOCK.smoothBasalt,
    BLOCK.deepslateTile,
    BLOCK.crackedStoneBricks,
    BLOCK.crackedDeepslateBricks,
  ];

  for (let x = interior.minX; x <= interior.maxX; x++) {
    for (let z = interior.minZ; z <= interior.maxZ; z++) {
      if (rng.chance(0.58)) {
        placeRoughBlock(dim, x, MAZE.ceilingY, z, rng, ceilingPalette);
      }
      if (rng.chance(0.08)) {
        setBlock(dim, x, MAZE.openMaxY, z, rng.pick([BLOCK.tuff, BLOCK.cobblestone, BLOCK.smoothBasalt]));
      }
    }
  }
}

function ageFloorCell(dim, cell, rng, intensity = 1) {
  const interior = getCellInterior(cell);
  const dustPalette = [
    BLOCK.gravel,
    BLOCK.tuff,
    BLOCK.brownConcretePowder,
    BLOCK.soulSand,
    BLOCK.crackedStoneBricks,
    BLOCK.mudBricks,
  ];
  const chance = Math.min(0.72, 0.18 + intensity * 0.14 + cell.distance * 0.006);

  for (let x = interior.minX; x <= interior.maxX; x++) {
    for (let z = interior.minZ; z <= interior.maxZ; z++) {
      if (rng.chance(chance)) {
        setBlock(dim, x, MAZE.originY, z, rng.pick(dustPalette));
      }
    }
  }
}

function placeOssuaryWall(dim, cell, side, rng, intensity = 1) {
  if (isSideOpen(cell, side) || !rng.chance(MAZE.ossuaryWallChance)) {
    return;
  }

  const run = getWallRun(cell, side);
  const lowerPalette = [BLOCK.boneBlock, BLOCK.calcite, BLOCK.sandstone, BLOCK.cutSandstone];
  const upperPalette = [BLOCK.boneBlock, BLOCK.calcite, BLOCK.chiseledSandstone, BLOCK.smoothBasalt];
  const backingPalette = [BLOCK.tuff, BLOCK.cobblestone, BLOCK.crackedStoneBricks, BLOCK.mudBricks];

  for (const pos of run) {
    if (rng.chance(0.18)) {
      setBlock(dim, pos.x, MAZE.originY + 1, pos.z, rng.pick(backingPalette));
    } else {
      setBlock(dim, pos.x, MAZE.originY + 1, pos.z, rng.pick(lowerPalette));
    }

    if (rng.chance(0.28 + intensity * 0.08)) {
      setBlock(dim, pos.x, MAZE.originY + 2, pos.z, BLOCK.skeletonSkull);
    } else {
      setBlock(dim, pos.x, MAZE.originY + 2, pos.z, rng.pick(upperPalette));
    }

    if (rng.chance(0.62)) {
      setBlock(dim, pos.x, MAZE.originY + 3, pos.z, rng.pick([BLOCK.boneBlock, BLOCK.calcite, BLOCK.crackedStoneBricks]));
    }

    if (rng.chance(0.24 + intensity * 0.04)) {
      setBlock(dim, pos.x, MAZE.openMaxY, pos.z, rng.pick([BLOCK.boneBlock, BLOCK.calcite, BLOCK.smoothBasalt]));
    }
  }
}

function placeBoneArch(dim, cell, side, rng) {
  if (!isSideOpen(cell, side)) {
    return;
  }

  const base = getCellBase(cell);
  const archPalette = [BLOCK.boneBlock, BLOCK.calcite, BLOCK.cutSandstone];
  switch (side) {
    case "north":
    case "south": {
      const z = side === "north" ? base.z : base.z + 4;
      for (let y = MAZE.originY + 1; y <= MAZE.openMaxY; y++) {
        setBlock(dim, base.x, y, z, rng.pick(archPalette));
        setBlock(dim, base.x + 4, y, z, rng.pick(archPalette));
      }
      for (let x = base.x + 1; x <= base.x + 3; x++) {
        setBlock(dim, x, MAZE.openMaxY, z, rng.pick(archPalette));
      }
      setBlock(dim, base.x + 2, MAZE.ceilingY, z, rng.pick([BLOCK.boneBlock, BLOCK.chiseledSandstone]));
      break;
    }
    case "east":
    case "west": {
      const x = side === "east" ? base.x + 4 : base.x;
      for (let y = MAZE.originY + 1; y <= MAZE.openMaxY; y++) {
        setBlock(dim, x, y, base.z, rng.pick(archPalette));
        setBlock(dim, x, y, base.z + 4, rng.pick(archPalette));
      }
      for (let z = base.z + 1; z <= base.z + 3; z++) {
        setBlock(dim, x, MAZE.openMaxY, z, rng.pick(archPalette));
      }
      setBlock(dim, x, MAZE.ceilingY, base.z + 2, rng.pick([BLOCK.boneBlock, BLOCK.chiseledSandstone]));
      break;
    }
    default:
      break;
  }
}

function placeWallCross(dim, cell, side, rng) {
  const center = getWallCenter(cell, side);
  if (!center) {
    return;
  }

  setBlock(dim, center.x, MAZE.originY + 1, center.z, rng.pick([BLOCK.boneBlock, BLOCK.calcite]));
  setBlock(dim, center.x, MAZE.originY + 2, center.z, rng.pick([BLOCK.boneBlock, BLOCK.calcite]));
  setBlock(dim, center.x, MAZE.originY + 3, center.z, rng.pick([BLOCK.boneBlock, BLOCK.calcite]));

  const run = getWallRun(cell, side);
  if (run.length >= 3) {
    setBlock(dim, run[0].x, MAZE.originY + 2, run[0].z, rng.pick([BLOCK.boneBlock, BLOCK.calcite]));
    setBlock(dim, run[2].x, MAZE.originY + 2, run[2].z, rng.pick([BLOCK.boneBlock, BLOCK.calcite]));
  }
}

function placeSkullNiche(dim, cell, side, rng) {
  if (!rng.chance(MAZE.skullNicheChance)) {
    return;
  }

  const center = getWallCenter(cell, side);
  const inward = getSideAxisOffset(side, 1);
  if (!center) {
    return;
  }

  setBlock(dim, center.x, MAZE.originY + 1, center.z, rng.pick([BLOCK.chiseledSandstone, BLOCK.chiseledDeepslate, BLOCK.smoothBasalt]));
  setBlock(dim, center.x, MAZE.originY + 2, center.z, BLOCK.skeletonSkull);
  if (rng.chance(0.34)) {
    setBlock(dim, center.x, MAZE.openMaxY, center.z, BLOCK.chain);
  }
  if (rng.chance(0.12)) {
    const candlePosition = {
      x: center.x + inward.dx,
      y: MAZE.originY + 1,
      z: center.z + inward.dz,
    };
    setBlock(dim, candlePosition.x, candlePosition.y, candlePosition.z, BLOCK.candle);
    registerFlickerLight(candlePosition, BLOCK.candle, BLOCK.unlitCandle, rng, {
      onTicksMin: 18,
      onTicksMax: 120,
      offTicksMin: 4,
      offTicksMax: 18,
      burstChance: 0.2,
    });
  }
}

function placeOssuaryMound(dim, cell, rng) {
  const center = getCellCenter(cell);
  const offsets = [
    { dx: 0, dz: 0 },
    { dx: 1, dz: 0 },
    { dx: -1, dz: 0 },
    { dx: 0, dz: 1 },
    { dx: 0, dz: -1 },
  ];

  for (const offset of offsets) {
    if (offset.dx === 0 && offset.dz === 0 || rng.chance(0.56)) {
      setBlock(dim, center.x + offset.dx, MAZE.originY, center.z + offset.dz, rng.pick([BLOCK.boneBlock, BLOCK.gravel, BLOCK.calcite]));
    }
  }

  if (rng.chance(0.75)) {
    setBlock(dim, center.x, MAZE.originY + 1, center.z, BLOCK.skeletonSkull);
  }
}

function decorateCatacombShell(dim, cell, rng) {
  roughenCeiling(dim, cell, rng);

  const intensity = cell.role === "exit" || cell.role === "loot" || cell.deadEnd ? 2 : 1;
  for (const side of SIDE_ORDER) {
    if (isSideOpen(cell, side)) {
      placeBoneArch(dim, cell, side, rng);
    } else {
      placeOssuaryWall(dim, cell, side, rng, intensity);
    }
  }

  if ((cell.role === "safe" || cell.role === "loot" || cell.deadEnd) && rng.chance(0.72)) {
    const closed = getClosedSides(cell);
    if (closed.length > 0) {
      placeSkullNiche(dim, cell, rng.pick(closed), rng);
    }
  }
}

function chooseFloorPermutation(cell) {
  const theme = cell.role;
  if (theme === "exit") {
    return BLOCK.deepslateBricks;
  }
  if (theme === "loot") {
    return BLOCK.mossyCobblestone;
  }
  if (theme === "safe") {
    return BLOCK.mossyStoneBricks;
  }
  if (theme === "start") {
    return BLOCK.stoneBricks;
  }
  if (theme === "deadEnd") {
    return cell.distance >= 20 ? BLOCK.crackedStoneBricks : BLOCK.cobblestone;
  }
  if (cell.distance >= 20) {
    return BLOCK.crackedDeepslateBricks;
  }
  if (cell.distance >= 10) {
    return BLOCK.crackedStoneBricks;
  }
  return BLOCK.stoneBricks;
}

function placeCornerPillars(dim, cell, useCandles) {
  const base = getCellBase(cell);
  const corners = [
    { x: base.x, z: base.z },
    { x: base.x + 4, z: base.z },
    { x: base.x, z: base.z + 4 },
    { x: base.x + 4, z: base.z + 4 },
  ];

  for (const corner of corners) {
    setBlock(dim, corner.x, MAZE.originY, corner.z, BLOCK.boneBlock);
    setBlock(dim, corner.x, MAZE.originY + 1, corner.z, BLOCK.boneBlock);
    if (useCandles) {
      setBlock(dim, corner.x, MAZE.originY + 2, corner.z, BLOCK.candle);
    }
  }
}

function placeCeilingLight(dim, cell, rng = null) {
  const center = getCellCenter(cell);
  const light = rng && rng.chance(0.08) ? BLOCK.lantern : BLOCK.soulLantern;
  const position = { x: center.x, y: MAZE.ceilingY - 1, z: center.z };
  setBlock(dim, position.x, position.y, position.z, light);

  if (!rng || rng.chance(0.98)) {
    registerFlickerLight(position, light, BLOCK.air, rng, {
      onTicksMin: 10,
      onTicksMax: 55,
      offTicksMin: 8,
      offTicksMax: 40,
      burstChance: 0.18,
    });
  }
}

function placeFloorCandles(dim, cell, rng, count = 1) {
  const interior = getCellInterior(cell);
  const options = [
    { x: interior.minX, z: interior.minZ },
    { x: interior.maxX, z: interior.minZ },
    { x: interior.minX, z: interior.maxZ },
    { x: interior.maxX, z: interior.maxZ },
  ];
  rng.shuffle(options);
  for (let i = 0; i < Math.min(count, options.length); i++) {
    const pos = options[i];
    const candlePosition = { x: pos.x, y: MAZE.originY + 1, z: pos.z };
    setBlock(dim, candlePosition.x, candlePosition.y, candlePosition.z, BLOCK.candle);
    if (rng.chance(0.85)) {
      registerFlickerLight(candlePosition, BLOCK.candle, BLOCK.unlitCandle, rng, {
        onTicksMin: 14,
        onTicksMax: 80,
        offTicksMin: 10,
        offTicksMax: 38,
        burstChance: 0.12,
      });
    }
  }
}

function placeSkeletonHead(dim, cell, rng) {
  const interior = getCellInterior(cell);
  const options = [
    { x: interior.minX, z: interior.minZ },
    { x: interior.maxX, z: interior.minZ },
    { x: interior.minX, z: interior.maxZ },
    { x: interior.maxX, z: interior.maxZ },
    { x: Math.floor((interior.minX + interior.maxX) / 2), z: Math.floor((interior.minZ + interior.maxZ) / 2) },
  ];
  const spot = rng.pick(options);
  try {
    setBlock(dim, spot.x, MAZE.originY + 1, spot.z, BLOCK.skeletonSkull);
  } catch (_error) {
    setBlock(dim, spot.x, MAZE.originY + 1, spot.z, BLOCK.boneBlock);
  }
}

function placeWallStains(dim, cell, rng, count) {
  const base = getCellBase(cell);
  const positions = [
    { x: base.x + 1, z: base.z },
    { x: base.x + 2, z: base.z },
    { x: base.x + 3, z: base.z },
    { x: base.x + 1, z: base.z + 4 },
    { x: base.x + 2, z: base.z + 4 },
    { x: base.x + 3, z: base.z + 4 },
    { x: base.x, z: base.z + 1 },
    { x: base.x, z: base.z + 2 },
    { x: base.x, z: base.z + 3 },
    { x: base.x + 4, z: base.z + 1 },
    { x: base.x + 4, z: base.z + 2 },
    { x: base.x + 4, z: base.z + 3 },
  ];

  const palettes = [
    BLOCK.crackedStoneBricks,
    BLOCK.mossyStoneBricks,
    BLOCK.cobblestone,
    BLOCK.crackedDeepslateBricks,
    BLOCK.deepslateBricks,
  ];

  rng.shuffle(positions);
  for (let i = 0; i < Math.min(count, positions.length); i++) {
    const target = positions[i];
    setBlock(dim, target.x, MAZE.originY + 1, target.z, rng.pick(palettes));
  }
}

function placeDeadEndDecor(dim, cell, rng) {
  const base = getCellBase(cell);
  const interior = getCellInterior(cell);
  setBlock(dim, interior.minX, MAZE.originY, interior.minZ, BLOCK.gravel);
  setBlock(dim, interior.maxX, MAZE.originY, interior.maxZ, BLOCK.soulSand);
  setBlock(dim, base.x + 1, MAZE.openMaxY, base.z + 1, BLOCK.cobweb);
  setBlock(dim, base.x + 3, MAZE.openMaxY, base.z + 3, BLOCK.cobweb);

  const closed = getClosedSides(cell);
  if (closed.length > 0) {
    const shrineSide = rng.pick(closed);
    placeWallCross(dim, cell, shrineSide, rng);
    if (rng.chance(0.66)) {
      placeSkullNiche(dim, cell, shrineSide, rng);
    }
  }

  if (rng.chance(0.58)) {
    placeOssuaryMound(dim, cell, rng);
  }
  if (rng.chance(0.5)) {
    setBlock(dim, base.x + 2, MAZE.openMaxY, base.z + 2, BLOCK.chain);
  }
}

function decorateStartCell(dim, cell, rng) {
  const center = getCellCenter(cell);
  paintFloorCell(dim, cell, BLOCK.stoneBricks);
  ageFloorCell(dim, cell, rng, 0.6);
  placeCeilingLight(dim, cell, rng);
  placeCornerPillars(dim, cell, false);
  placeFloorCandles(dim, cell, rng, 1);
  placeSkeletonHead(dim, cell, rng);
  setBlock(dim, center.x, MAZE.originY, center.z, BLOCK.chiseledDeepslate);
}

function decorateSafeCell(dim, cell, rng) {
  paintFloorCell(dim, cell, BLOCK.mossyStoneBricks);
  ageFloorCell(dim, cell, rng, 0.9);
  if (rng.chance(0.45)) {
    placeCeilingLight(dim, cell, rng);
  }
  placeCornerPillars(dim, cell, false);
  placeFloorCandles(dim, cell, rng, 1);
  placeWallStains(dim, cell, rng, 2);
  const closed = getClosedSides(cell);
  if (closed.length > 0) {
    placeSkullNiche(dim, cell, rng.pick(closed), rng);
  }
}

function decorateLootCell(dim, cell, rng) {
  const base = getCellBase(cell);
  paintFloorCell(dim, cell, BLOCK.mossyCobblestone);
  ageFloorCell(dim, cell, rng, 1.5);
  if (rng.chance(0.55)) {
    placeCeilingLight(dim, cell, rng);
  }
  placeCornerPillars(dim, cell, false);
  placeWallStains(dim, cell, rng, 3);
  placeSkeletonHead(dim, cell, rng);
  placeFloorCandles(dim, cell, rng, 1);
  placeOssuaryMound(dim, cell, rng);
  const closed = getClosedSides(cell);
  if (closed.length > 0) {
    placeWallCross(dim, cell, rng.pick(closed), rng);
  }
  setBlock(dim, base.x + 1, MAZE.openMaxY, base.z + 1, BLOCK.cobweb);
  setBlock(dim, base.x + 3, MAZE.openMaxY, base.z + 3, BLOCK.cobweb);
}

function placeExitDoor(cell, exitDoor) {
  const dim = getCatacombDimension();
  setBlock(dim, exitDoor.lower.x, exitDoor.lower.y, exitDoor.lower.z, makeDoorPermutation(exitDoor.facing, false, false));
  setBlock(dim, exitDoor.upper.x, exitDoor.upper.y, exitDoor.upper.z, makeDoorPermutation(exitDoor.facing, false, true));
  setBlock(dim, exitDoor.plate.x, exitDoor.plate.y, exitDoor.plate.z, BLOCK.stonePressurePlate);

  const base = getCellBase(cell);
  const center = getCellCenter(cell);
  setBlock(dim, center.x, MAZE.originY, center.z, BLOCK.cryingObsidian);
  setBlock(dim, center.x, MAZE.originY + 1, center.z, BLOCK.obsidian);
  setBlock(dim, base.x + 1, MAZE.originY + 1, base.z + 1, BLOCK.ironBars);
  setBlock(dim, base.x + 3, MAZE.originY + 1, base.z + 3, BLOCK.ironBars);
  setBlock(dim, base.x + 1, MAZE.openMaxY, base.z + 1, BLOCK.chain);
  setBlock(dim, base.x + 3, MAZE.openMaxY, base.z + 3, BLOCK.chain);
}

function decorateExitCell(dim, cell, exitDoor, rng) {
  paintFloorCell(dim, cell, BLOCK.deepslateBricks);
  ageFloorCell(dim, cell, rng, 1.2);
  placeCeilingLight(dim, cell, rng);
  placeCornerPillars(dim, cell, false);
  placeWallStains(dim, cell, rng, 4);
  placeSkeletonHead(dim, cell, rng);
  const closed = getClosedSides(cell).filter((side) => side !== exitDoor.side);
  if (closed.length > 0) {
    placeWallCross(dim, cell, rng.pick(closed), rng);
  }
  placeFloorCandles(dim, cell, rng, 2);
  placeExitDoor(cell, exitDoor);
}

function decorateCorridorCell(dim, cell, rng) {
  paintFloorCell(dim, cell, chooseFloorPermutation(cell));
  ageFloorCell(dim, cell, rng, cell.deadEnd ? 1.7 : 1);
  if (cell.deadEnd) {
    placeDeadEndDecor(dim, cell, rng);
  } else {
    placeWallStains(dim, cell, rng, cell.distance >= 20 ? 3 : 1);
    if ((cell.distance > 0 && cell.distance % MAZE.lightEveryCells === 0 && rng.chance(0.35)) || rng.chance(0.004)) {
      placeCeilingLight(dim, cell, rng);
    }
    if (rng.chance(0.14)) {
      const base = getCellBase(cell);
      setBlock(dim, base.x + 2, MAZE.originY, base.z + 1, rng.pick([BLOCK.stoneBrickWall, BLOCK.boneBlock, BLOCK.gravel]));
    }
    if (rng.chance(cell.distance >= 12 ? 0.34 : 0.18)) {
      placeSkeletonHead(dim, cell, rng);
    }
    if (rng.chance(0.018)) {
      placeFloorCandles(dim, cell, rng, 1);
    }
  }
}

function paintFloorCell(dim, cell, permutation) {
  const interior = getCellInterior(cell);
  for (let x = interior.minX; x <= interior.maxX; x++) {
    for (let z = interior.minZ; z <= interior.maxZ; z++) {
      setBlock(dim, x, MAZE.originY, z, permutation);
    }
  }
}

function scheduleCatacombVisualModules(dim, plan) {
  const candidates = plan.cellsFlat.filter((cell) => {
    if (!(cell.deadEnd || cell.role === "safe" || cell.role === "loot")) return false;
    if (cell.role === "start" || cell.role === "exit") return false;
    return getClosedSides(cell).includes("south");
  });
  const rng = makeRng(`${plan.seed}:authored-modules`);
  rng.shuffle(candidates);

  const count = Math.min(MAX_AUTHORED_CATACOMB_MODULES, candidates.length);
  for (let index = 0; index < count; index++) {
    const cell = candidates[index];
    const spec = CATACOMB_MODULES[(index + rng.int(CATACOMB_MODULES.length)) % CATACOMB_MODULES.length];
    const base = getCellBase(cell);
    scheduleStructurePlacement(
      `catacombs:${plan.seed}:${cell.x}:${cell.z}`,
      spec.id,
      dim,
      { x: base.x, y: MAZE.originY + 1, z: base.z + MAZE.cellSize - spec.depth },
    );
  }
}

function* buildMazeJob(plan) {
  const dim = getCatacombDimension();
  flickerLightsReady = false;
  flickerLightNodes = [];
  const minX = getMazeMinX();
  const maxX = getMazeMaxX();
  const minZ = getMazeMinZ();
  const maxZ = getMazeMaxZ();
  const fromY = MAZE.originY;
  const toY = MAZE.ceilingY;

  clearCatacombEntities(dim);

  // Solid shell first, then carve the maze out of it.
  yield* fillBox(dim, minX, maxX, fromY, toY, minZ, maxZ, BLOCK.stoneBricks);

  for (const cell of plan.cellsFlat) {
    yield* carveCellInterior(dim, cell);
  }

  // Open the carved links between cells.
  for (const cell of plan.cellsFlat) {
    const eastKey = `${cell.x + 1},${cell.z}`;
    const southKey = `${cell.x},${cell.z + 1}`;
    if (cell.x < MAZE.cellsX - 1 && cell.links.has(eastKey)) {
      yield* carveLink(dim, cell, "east");
    }
    if (cell.z < MAZE.cellsZ - 1 && cell.links.has(southKey)) {
      yield* carveLink(dim, cell, "south");
    }
  }

  // Dress each cell after the connectivity is in place.
  for (const cell of plan.cellsFlat) {
    const cellRng = makeRng(`${plan.seed}:cell:${cell.x}:${cell.z}`);
    decorateCatacombShell(dim, cell, cellRng);
    switch (cell.role) {
      case "start":
        decorateStartCell(dim, cell, cellRng);
        break;
      case "safe":
        decorateSafeCell(dim, cell, cellRng);
        break;
      case "loot":
        decorateLootCell(dim, cell, cellRng);
        break;
      case "exit":
        decorateExitCell(dim, cell, plan.exitDoor, cellRng);
        break;
      case "deadEnd":
        paintFloorCell(dim, cell, chooseFloorPermutation(cell));
        placeDeadEndDecor(dim, cell, cellRng);
        break;
      default:
        decorateCorridorCell(dim, cell, cellRng);
        break;
    }
    if (cell.distance % 2 === 0) {
      yield;
    }
  }

  scheduleCatacombVisualModules(dim, plan);
  spawnThemedMobs(dim, plan);
  markMazeBuilt();
  flickerLightsReady = true;
  broadcastCatacombObjective();
}

function clearCatacombEntities(dim) {
  try {
    const entities = dim.getEntities({
      location: {
        x: (getMazeMinX() + getMazeMaxX()) / 2,
        y: MAZE.originY + 2,
        z: (getMazeMinZ() + getMazeMaxZ()) / 2,
      },
      maxDistance: Math.max(getMazeMaxX() - getMazeMinX(), getMazeMaxZ() - getMazeMinZ()) + MAZE.margin,
    });

    for (const entity of entities) {
      if (!entity || entity.typeId === "minecraft:player") {
        continue;
      }
      try {
        entity.remove();
      } catch (_error) {
        // Ignore entities that cannot be removed.
      }
    }
  } catch (_error) {
    // Entity cleanup is best effort.
  }
}

function broadcastCatacombObjective() {
  const message = "Catacombs regenerated. You have 20 minutes to find the door and escape.";
  try {
    world.sendMessage(message);
  } catch (_error) {
    for (const player of getCachedPlayers()) {
      try {
        player.sendMessage(message);
      } catch (__error) {
        // Ignore players that cannot receive chat.
      }
    }
  }
}

function spawnThemedMobs(dim, plan) {
  const rng = makeRng(`${plan.seed}:mobs`);
  let spawned = 0;
  const maxSpawns = 20;

  for (const cell of plan.cellsFlat) {
    if (spawned >= maxSpawns) {
      break;
    }

    if (cell.role === "start" || cell.role === "safe") {
      continue;
    }

    if (cell.role === "exit") {
      spawned += spawnExitGuardians(dim, cell, rng, plan.exitDoor.side);
      continue;
    }

    let chance = 0.05;
    if (cell.deadEnd) {
      chance += 0.15;
    }
    if (cell.distance >= 12) {
      chance += 0.05;
    }
    if (cell.distance >= 20) {
      chance += 0.05;
    }

    if (!rng.chance(chance)) {
      continue;
    }

    const spawnCount = cell.deadEnd && rng.chance(0.4) ? 2 : 1;
    for (let i = 0; i < spawnCount && spawned < maxSpawns; i++) {
      const mobType = pickMobTypeForCell(cell, rng);
      if (spawnMobInCell(dim, cell, mobType, rng)) {
        spawned++;
      }
    }
  }
}

function pickMobTypeForCell(cell, rng) {
  if (cell.role === "loot" && rng.chance(0.6)) {
    return MOB.skeleton;
  }

  if (cell.deadEnd && cell.distance >= 18) {
    if (rng.chance(0.35)) {
      return MOB.caveSpider;
    }
    if (rng.chance(0.2)) {
      return MOB.silverfish;
    }
  }

  if (cell.distance >= 22 && rng.chance(0.35)) {
    return MOB.husk;
  }

  if (cell.distance >= 14 && rng.chance(0.3)) {
    return MOB.skeleton;
  }

  if (rng.chance(0.5)) {
    return MOB.zombie;
  }

  return rng.pick([MOB.skeleton, MOB.zombie, MOB.spider]);
}

function spawnMobInCell(dim, cell, mobType, rng) {
  const base = getCellBase(cell);
  const offsets = [
    { x: base.x + 1.5, z: base.z + 1.5 },
    { x: base.x + 2.5, z: base.z + 1.5 },
    { x: base.x + 1.5, z: base.z + 2.5 },
    { x: base.x + 2.5, z: base.z + 2.5 },
  ];
  const offset = rng.pick(offsets);
  try {
    dim.spawnEntity(mobType, {
      x: offset.x,
      y: MAZE.originY + 1,
      z: offset.z,
    });
    return true;
  } catch (_error) {
    return false;
  }
}

function spawnExitGuardians(dim, cell, rng, exitSide) {
  const base = getCellBase(cell);
  const center = getCellCenter(cell);
  const doorSide = exitSide || "north";
  const oppositeSide = {
    north: "south",
    east: "west",
    south: "north",
    west: "east",
  }[doorSide];

  let count = 0;
  const guardianSpawnPoints = {
    north: [
      { x: center.x, z: base.z + 3 },
      { x: base.x + 1, z: base.z + 3 },
      { x: base.x + 3, z: base.z + 3 },
    ],
    east: [
      { x: base.x + 1, z: center.z },
      { x: base.x + 1, z: base.z + 1 },
      { x: base.x + 1, z: base.z + 3 },
    ],
    south: [
      { x: center.x, z: base.z + 1 },
      { x: base.x + 1, z: base.z + 1 },
      { x: base.x + 3, z: base.z + 1 },
    ],
    west: [
      { x: base.x + 3, z: center.z },
      { x: base.x + 3, z: base.z + 1 },
      { x: base.x + 3, z: base.z + 3 },
    ],
  };

  const spots = guardianSpawnPoints[oppositeSide] || guardianSpawnPoints.north;
  const mobs = [MOB.witherSkeleton, MOB.skeleton, MOB.skeleton];
  for (let i = 0; i < mobs.length; i++) {
    const spot = spots[i % spots.length];
    try {
      dim.spawnEntity(mobs[i], {
        x: spot.x + 0.5,
        y: MAZE.originY + 1,
        z: spot.z + 0.5,
      });
      count++;
    } catch (_error) {
      // Ignore mob spawn failures and keep the exit usable.
    }
  }

  if (rng.chance(0.3)) {
    try {
      dim.spawnEntity(MOB.caveSpider, {
        x: center.x + 0.5,
        y: MAZE.originY + 1,
        z: center.z + 0.5,
      });
      count++;
    } catch (_error) {
      // Ignore.
    }
  }

  return count;
}

function isExitDoorBlock(block, exitDoor) {
  if (block.typeId !== "minecraft:dark_oak_door") {
    return false;
  }

  const pos = block.location;
  return (
    sameBlockLocation(pos, exitDoor.lower) ||
    sameBlockLocation(pos, exitDoor.upper)
  );
}

function isExitPlateBlock(block, exitDoor) {
  if (block.typeId !== "minecraft:stone_pressure_plate") {
    return false;
  }

  return sameBlockLocation(block.location, exitDoor.plate);
}

function sameBlockLocation(a, b) {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}

function openExitDoor(open) {
  if (!mazePlan || !mazePlan.exitDoor) {
    return;
  }

  const dim = getCatacombDimension();
  const door = mazePlan.exitDoor;
  setBlock(dim, door.lower.x, door.lower.y, door.lower.z, makeDoorPermutation(door.facing, open, false));
  setBlock(dim, door.upper.x, door.upper.y, door.upper.z, makeDoorPermutation(door.facing, open, true));
}

function triggerExit(player) {
  if (!player || !isCatacombDimensionId(player.dimension.id)) {
    return;
  }

  if (pendingEscape.has(player.id)) {
    return;
  }

  pendingEscape.add(player.id);
  clearCatacombEscapeTimer(player.id);
  openExitDoor(true);
  announce(player, "You escaped the Catacombs.", "Returning you to your previous location.");
  system.runTimeout(() => {
    void exitCatacombs(player);
  }, 2);

  system.runTimeout(() => {
    openExitDoor(false);
  }, 20);

  system.runTimeout(() => {
    void rebuildMazeNow().catch((error) => {
      try {
        world.sendMessage(`Catacombs failed to regenerate: ${String(error)}`);
      } catch (_innerError) {
        // Ignore chat failures.
      }
    });
  }, 60);
}

async function teleportPlayerIntoCatacombs(player, spawn, options = {}) {
  try {
    await ensureWorldReady();
    const dim = getCatacombDimension();
    const targetSpawn =
      spawn ||
      (mazePlan ? getStartSpawnLocation(mazePlan) : { x: 2.5, y: MAZE.originY + 1, z: 2.5 });

    const entered = await verifiedPlayerTeleport(player, targetSpawn, {
      dimension: dim,
      checkForBlocks: false,
      keepVelocity: false,
      facingLocation: {
        x: targetSpawn.x + 1,
        y: targetSpawn.y,
        z: targetSpawn.z,
      },
    }, { attempts: 8, retryTicks: 4, maxDistance: 64 });
    if (!entered) {
      throw new Error("Catacombs teleport verification failed.");
    }

    try {
      player.sendMessage("§cHint: §7Find the exit door before the maze shifts. The dead dislike repeated steps.");
    } catch (error) {}

    enableCatacombBuildAccess(player);
    startCatacombEscapeTimer(player);
    if (options.title && options.subtitle) {
      announce(player, options.title, options.subtitle);
    }
    return true;
  } catch (error) {
    if (options.reportFailure && typeof player.sendMessage === "function") {
      player.sendMessage(`Failed to enter the Catacombs: ${String(error)}`);
    }
    return false;
  }
}

function getStartSpawnLocation(plan) {
  const center = getCellCenter(plan.startCell);
  return {
    x: center.x + 0.5,
    y: MAZE.originY + 1,
    z: center.z + 0.5,
  };
}

function getRandomCatacombSpawnLocation(plan) {
  if (!plan || !Array.isArray(plan.cellsFlat) || !plan.cellsFlat.length) {
    return { x: 2.5, y: MAZE.originY + 1, z: 2.5 };
  }

  const dim = getCatacombDimension();
  const cells = plan.cellsFlat.filter((cell) => cell.role !== "exit");
  const sourceCells = cells.length ? cells : plan.cellsFlat;

  for (let i = 0; i < 48; i++) {
    const cell = sourceCells[randomInt(0, sourceCells.length - 1)];
    const base = getCellBase(cell);
    const candidate = {
      x: base.x + randomInt(1, 3) + 0.5,
      y: MAZE.originY + 1,
      z: base.z + randomInt(1, 3) + 0.5,
    };

    if (isSafeStandingSpot(dim, candidate)) {
      return candidate;
    }
  }

  return getStartSpawnLocation(plan);
}

export async function enterCatacombs(player) {
  if (isCatacombDimensionId(player.dimension.id)) {
    announce(player, "Catacomb Mazes", "You are already inside the Catacombs.");
    return false;
  }

  try {
    await rebuildMazeNow();
  } catch (error) {
    // Rebuilds can fail transiently while chunks/ticking areas are catching up.
    // Try the existing maze instead of making the command appear to do nothing.
    await ensureWorldReady().catch(() => {});
  }
  const spawn = mazePlan ? getStartSpawnLocation(mazePlan) : { x: 2.5, y: MAZE.originY + 1, z: 2.5 };
  const moved = await teleportPlayerIntoCatacombs(player, spawn, {
    title: "Catacomb Mazes",
    subtitle: "Find the exit door. Repeated corridors remember you.",
    reportFailure: true,
  });

  if (!moved) {
    return false;
  }

  return true;
}

function runCatacombsEntryCommand(player) {
  void enterCatacombs(player).then((entered) => {
    if (!entered) {
      try {
        player.sendMessage("Catacombs entry failed. Try again in a moment.");
      } catch (error) {}
    }
  }).catch((error) => {
    try {
      player.sendMessage(`Catacombs entry failed: ${String(error)}`);
    } catch (_error) {}
  });
}

export async function resetPlayerToCatacombSpawn(player, options = {}) {
  if (!player || !isCatacombDimensionId(player.dimension.id)) {
    return false;
  }

  try {
    await ensureWorldReady();
    const spawn = mazePlan ? getStartSpawnLocation(mazePlan) : { x: 2.5, y: MAZE.originY + 1, z: 2.5 };
    const reset = await verifiedPlayerTeleport(player, spawn, {
      dimension: getCatacombDimension(),
      checkForBlocks: false,
      keepVelocity: false,
      facingLocation: {
        x: spawn.x + 1,
        y: spawn.y,
        z: spawn.z,
      },
    }, { attempts: 8, retryTicks: 4, maxDistance: 64 });
    if (!reset) {
      throw new Error("Catacombs reset teleport verification failed.");
    }

    if (options.announce !== false) {
      announce(player, "The Catacombs shifted.", "Find the door and escape.");
      try {
        player.sendMessage("The Catacombs shifted. Find the door and escape.");
      } catch (_error) {
        // Ignore chat failures.
      }
    }
    return true;
  } catch (_error) {
    return false;
  }
}

function waitTicks(ticks) {
  return new Promise((resolve) => {
    system.runTimeout(() => resolve(), ticks);
  });
}

function spawnTransitionParticles(dimension, location) {
  const particleIds = [
    "minecraft:basic_smoke_particle",
    "minecraft:campfire_smoke_particle",
    "minecraft:sculk_soul_particle",
  ];

  for (const particleId of particleIds) {
    try {
      dimension.spawnParticle(
        particleId,
        addVec(location, randomFloat(-0.35, 0.35), 0.2, randomFloat(-0.35, 0.35)),
      );
    } catch (_error) {
      // Ignore missing particles or unloaded chunks.
    }
  }
}

function applyTransitionEffect(player, ticks) {
  try {
    if (typeof player.addEffect === "function") {
      player.addEffect("minecraft:blindness", ticks, {
        amplifier: 0,
        showParticles: false,
      });
    }
  } catch (_error) {
    // The blind effect is optional.
  }
}

export async function enterCatacombsAtRandomLocation(player, options = {}) {
  try {
    const transitionTicks = options.transitionTicks === undefined ? 12 : options.transitionTicks;
    const freshMaze = options.freshMaze !== false;
    const currentDimension = player.dimension;

    applyTransitionEffect(player, transitionTicks);
    spawnTransitionParticles(currentDimension, player.location);

    const rebuildPromise = freshMaze ? rebuildMazeNow() : ensureWorldReady();
    if (transitionTicks > 0) {
      await waitTicks(transitionTicks);
    }

    await rebuildPromise;
    const spawn = getRandomCatacombSpawnLocation(mazePlan);
    const moved = await teleportPlayerIntoCatacombs(player, spawn, {
      reportFailure: false,
    });

    return moved;
  } catch (_error) {
    return false;
  }
}

async function exitCatacombs(player) {
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

    restoreCatacombBuildAccess(player);
    returnPoints.delete(player.id);
    pendingEscape.delete(player.id);
    announce(player, "Catacomb Mazes", "Your return point has been restored.");
  } catch (error) {
    pendingEscape.delete(player.id);
    if (typeof player.sendMessage === "function") {
      player.sendMessage(`Failed to escape the Catacombs: ${String(error)}`);
    }
  }
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

function isSafeStandingSpot(dimension, position) {
  const feet = getMazeBlock(dimension, Math.floor(position.x), Math.floor(position.y), Math.floor(position.z));
  const head = getMazeBlock(dimension, Math.floor(position.x), Math.floor(position.y) + 1, Math.floor(position.z));
  const below = getMazeBlock(dimension, Math.floor(position.x), Math.floor(position.y) - 1, Math.floor(position.z));
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
    // Ignore and fall back to an explicit survival override.
  }

  return undefined;
}

function enableCatacombBuildAccess(player) {
  if (!player || !isCatacombDimensionId(player.dimension.id)) {
    return;
  }

  if (!catacombGamemodes.has(player.id)) {
    catacombGamemodes.set(player.id, getPlayerGameMode(player));
  }

  system.run(() => {
    try {
      player.setGameMode(GameMode.Survival);
    } catch (_error) {
      // If the override fails, the maze still works but block edits may remain restricted.
    }
  });
}

function restoreCatacombBuildAccess(player) {
  if (!player) {
    return;
  }

  const savedGameMode = catacombGamemodes.get(player.id);
  catacombGamemodes.delete(player.id);

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

function syncCatacombGamemodes() {
  for (const player of getCachedPlayers()) {
    if (!player || !isCatacombDimensionId(player.dimension.id)) {
      continue;
    }

    enableCatacombBuildAccess(player);
  }
}

async function ensureWorldReady(forceRebuild = false) {
  if (mazeReady && !forceRebuild) {
    return;
  }

  if (bootstrapPromise) {
    await bootstrapPromise;
    if (mazeReady && !forceRebuild) {
      return;
    }
  }

  if (forceRebuild) {
    await rebuildMazeNow();
    return;
  }

  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      mazePlan = mazePlan || createMazePlan();
      await ensureCoreTickingArea();
      if (!isMazeBuilt()) {
        await buildMazeNow(mazePlan);
      }
      mazeReady = true;
    })().catch((error) => {
      bootstrapPromise = null;
      mazeReady = false;
      throw error;
    });
  }

  await bootstrapPromise;
}

async function rebuildMazeNow() {
  if (bootstrapPromise) {
    await bootstrapPromise;
  }

  bootstrapPromise = (async () => {
    mazePlan = createMazePlan(makeFreshMazeSeedText());
    mazeReady = false;
    await ensureCoreTickingArea();
    await buildMazeNow(mazePlan);
    mazeReady = true;
  })().catch((error) => {
    bootstrapPromise = null;
    mazeReady = false;
    throw error;
  });

  await bootstrapPromise;
}

async function rebuildMazeAfterEscapeTimeout() {
  if (timedRebuildPromise) {
    await timedRebuildPromise;
    return;
  }

  timedRebuildPromise = (async () => {
    const dim = getCatacombDimension();
    const holdingLocation = prepareTimeoutHoldingPlatform(dim);
    const players = getCatacombPlayers();

    for (const player of players) {
      announce(player, "The Catacombs are shifting.", "The exit has moved. Run.");
      try {
        await verifiedPlayerTeleport(player, holdingLocation, {
          dimension: dim,
          checkForBlocks: false,
          keepVelocity: false,
        }, { attempts: 6, retryTicks: 3, maxDistance: 64 });
      } catch (_error) {
        // Keep rebuilding even if one player cannot be moved.
      }
    }

    await waitTicks(10);
    await rebuildMazeNow();

    const spawn = mazePlan ? getStartSpawnLocation(mazePlan) : { x: 2.5, y: MAZE.originY + 1, z: 2.5 };
    for (const player of getCatacombPlayers()) {
      try {
        await verifiedPlayerTeleport(player, spawn, {
          dimension: dim,
          checkForBlocks: false,
          keepVelocity: false,
          facingLocation: {
            x: spawn.x + 1,
            y: spawn.y,
            z: spawn.z,
          },
        }, { attempts: 8, retryTicks: 4, maxDistance: 64 });
        startCatacombEscapeTimer(player);
        announce(player, "New maze generated.", "You have 20 minutes to escape.");
      } catch (_error) {
        // Ignore individual teleport failures.
      }
    }
  })().finally(() => {
    timedRebuildPromise = null;
  });

  await timedRebuildPromise;
}

function tickCatacombEscapeTimers() {
  syncCatacombEscapeTimers();
  if (timedRebuildPromise) {
    return;
  }

  const currentTick = system.currentTick;
  for (const player of getCatacombPlayers()) {
    const expiresAt = catacombEscapeTimers.get(player.id);
    if (!expiresAt) {
      continue;
    }

    showCatacombTimer(player, expiresAt, currentTick);
    if (currentTick < expiresAt) {
      continue;
    }

    system.run(() => {
      void rebuildMazeAfterEscapeTimeout().catch((error) => {
        try {
          world.sendMessage(`Catacombs timer rebuild failed: ${String(error)}`);
        } catch (_innerError) {
          // Ignore chat failures.
        }
      });
    });
    return;
  }
}

async function buildMazeNow(plan) {
  await new Promise((resolve, reject) => {
    try {
      system.runJob(
        (function* () {
          try {
            yield* buildMazeJob(plan);
            resolve();
          } catch (error) {
            reject(error);
          }
        })(),
      );
    } catch (error) {
      reject(error);
    }
  });
}

async function ensureCoreTickingArea() {
  if (!coreAreaPromise) {
    coreAreaPromise = (async () => {
      const dim = getCatacombDimension();
      const areaFrom = {
        x: getMazeMinX() - MAZE.margin,
        y: MAZE.originY - 1,
        z: getMazeMinZ() - MAZE.margin,
      };
      const areaTo = {
        x: getMazeMaxX() + MAZE.margin,
        y: MAZE.ceilingY + 1,
        z: getMazeMaxZ() + MAZE.margin,
      };

      try {
        world.tickingAreaManager.removeTickingArea(TICKING_AREA_ID);
      } catch (_error) {
        // Ignore missing areas.
      }

      await world.tickingAreaManager.createTickingArea(TICKING_AREA_ID, {
        dimension: dim,
        from: areaFrom,
        to: areaTo,
      });
    })().catch((error) => {
      coreAreaPromise = null;
      throw error;
    });
  }

  await coreAreaPromise;
}

function handlePlayerInteract(event) {
  if (!mazePlan || !mazePlan.exitDoor) {
    return;
  }

  const block = event.block;
  if (!block || block.typeId !== "minecraft:dark_oak_door") {
    return;
  }

  if (
    sameBlockLocation(block.location, mazePlan.exitDoor.lower) ||
    sameBlockLocation(block.location, mazePlan.exitDoor.upper)
  ) {
    triggerExit(event.player);
  }
}

function handlePressurePlatePush(event) {
  if (!mazePlan || !mazePlan.exitDoor) {
    return;
  }

  const source = event.source;
  const block = event.block;
  if (!source || source.typeId !== "minecraft:player" || !block || block.typeId !== "minecraft:stone_pressure_plate") {
    return;
  }

  if (sameBlockLocation(block.location, mazePlan.exitDoor.plate)) {
    triggerExit(source);
  }
}
