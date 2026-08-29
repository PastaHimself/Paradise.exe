import { BlockPermutation, system, world } from "@minecraft/server";
import { requestVhsTier, VHS_TIER } from "./paradise_horror_state.js";
import { applyHorrorConsequence, getPlayerHorrorSnapshot } from "./paradise_player_horror_state.js";

const TICKS = 20;

const CONFIG = Object.freeze({
  pulseIntervalTicks: TICKS * 18,
  globalCooldownTicks: TICKS * 34,
  playerCooldownTicks: TICKS * 62,
  eventCooldownTicks: TICKS * 150,
  spawnGraceTicks: TICKS * 35,
  maxMutationsPerEvent: 56,
  watcherLifetimeTicks: TICKS * 14,
});

const AIR_BLOCKS = new Set(["minecraft:air", "minecraft:cave_air", "minecraft:void_air"]);
const LIGHT_BLOCKS = new Set([
  "minecraft:torch",
  "minecraft:wall_torch",
  "minecraft:redstone_torch",
  "minecraft:redstone_wall_torch",
  "minecraft:soul_torch",
  "minecraft:soul_wall_torch",
  "minecraft:lantern",
  "minecraft:soul_lantern",
  "minecraft:glowstone",
  "minecraft:sea_lantern",
  "minecraft:shroomlight",
  "minecraft:campfire",
  "minecraft:soul_campfire",
  "minecraft:end_rod",
  "minecraft:ochre_froglight",
  "minecraft:verdant_froglight",
  "minecraft:pearlescent_froglight",
]);

const MUTABLE_TERRAIN = new Set([
  "minecraft:grass_block",
  "minecraft:dirt",
  "minecraft:coarse_dirt",
  "minecraft:podzol",
  "minecraft:mycelium",
  "minecraft:stone",
  "minecraft:cobblestone",
  "minecraft:deepslate",
  "minecraft:cobbled_deepslate",
  "minecraft:tuff",
  "minecraft:andesite",
  "minecraft:diorite",
  "minecraft:granite",
  "minecraft:sand",
  "minecraft:red_sand",
  "minecraft:gravel",
  "minecraft:netherrack",
]);

const BREACHABLE_BLOCK_FRAGMENTS = [
  "glass",
  "door",
  "trapdoor",
  "fence",
  "planks",
  "log",
  "leaves",
  "bookshelf",
  "ladder",
  "scaffolding",
];

const PROTECTED_BLOCK_FRAGMENTS = [
  "bedrock",
  "barrier",
  "command_block",
  "structure_block",
  "jigsaw",
  "chest",
  "barrel",
  "shulker",
  "furnace",
  "hopper",
  "dispenser",
  "dropper",
  "crafter",
  "beacon",
  "lodestone",
  "portal",
  "end_gateway",
  "spawner",
  "bed",
  "respawn_anchor",
  "light_block",
];

const CORRUPTION_PALETTE = [
  "minecraft:sculk",
  "minecraft:netherrack",
  "minecraft:soul_sand",
  "minecraft:blackstone",
  "minecraft:magma",
];

const playerCooldowns = new Map();
const eventCooldowns = new Map();
let globalCooldownUntil = 0;
let initialized = false;

function nowTick() {
  try {
    return Number(system.currentTick) || 0;
  } catch (_error) {
    return 0;
  }
}

function playerId(player) {
  return String(player?.id || player?.name || "unknown");
}

function isValidPlayer(player) {
  try {
    if (!player || player.typeId !== "minecraft:player" || !player.dimension || !player.location) return false;
    if (typeof player.isValid === "function") return player.isValid();
    return player.isValid !== false;
  } catch (_error) {
    return false;
  }
}

function floorLoc(location) {
  return {
    x: Math.floor(Number(location?.x) || 0),
    y: Math.floor(Number(location?.y) || 0),
    z: Math.floor(Number(location?.z) || 0),
  };
}

function add(location, x = 0, y = 0, z = 0) {
  return {
    x: (Number(location?.x) || 0) + x,
    y: (Number(location?.y) || 0) + y,
    z: (Number(location?.z) || 0) + z,
  };
}

function randomInt(min, max) {
  const low = Math.ceil(min);
  const high = Math.floor(max);
  return Math.floor(Math.random() * (high - low + 1)) + low;
}

function choose(list) {
  return list.length ? list[randomInt(0, list.length - 1)] : undefined;
}

function yawToBasis(player) {
  let yaw = 0;
  try {
    yaw = Number(player.getRotation?.().y) || 0;
  } catch (_error) {}
  const radians = yaw * Math.PI / 180;
  const forward = { x: -Math.sin(radians), z: Math.cos(radians) };
  const right = { x: -forward.z, z: forward.x };
  return { forward, right };
}

function safeGetBlock(dimension, location) {
  try {
    return dimension?.getBlock(floorLoc(location));
  } catch (_error) {
    return undefined;
  }
}

function safeSetBlock(dimension, location, typeId) {
  const block = safeGetBlock(dimension, location);
  if (!block) return false;
  try {
    block.setPermutation(BlockPermutation.resolve(typeId));
    return true;
  } catch (_error) {}
  try {
    block.setType(typeId);
    return true;
  } catch (_error) {
    return false;
  }
}

function isProtectedType(typeId) {
  const id = String(typeId || "");
  return PROTECTED_BLOCK_FRAGMENTS.some((fragment) => id.includes(fragment));
}

function isAir(typeId) {
  return AIR_BLOCKS.has(String(typeId || ""));
}

function isBreachable(typeId) {
  const id = String(typeId || "");
  return !isProtectedType(id) && BREACHABLE_BLOCK_FRAGMENTS.some((fragment) => id.includes(fragment));
}

function findGround(dimension, location, maxDown = 10) {
  const start = floorLoc(location);
  for (let dy = 0; dy <= maxDown; dy++) {
    const ground = { x: start.x, y: start.y - dy, z: start.z };
    const typeId = safeGetBlock(dimension, ground)?.typeId;
    if (typeId && !isAir(typeId) && typeId !== "minecraft:water" && typeId !== "minecraft:lava") {
      return ground;
    }
  }
  return undefined;
}

function hasProtectedBlockNear(dimension, center, radius) {
  const c = floorLoc(center);
  const r = Math.max(1, Math.ceil(radius));
  for (let x = -r; x <= r; x++) {
    for (let y = -r; y <= r; y++) {
      for (let z = -r; z <= r; z++) {
        const typeId = safeGetBlock(dimension, { x: c.x + x, y: c.y + y, z: c.z + z })?.typeId;
        if (isProtectedType(typeId)) return true;
      }
    }
  }
  return false;
}

function playSound(player, soundId, options = {}) {
  try {
    player.dimension.playSound(soundId, player.location, options);
  } catch (_error) {}
}

function particle(dimension, particleId, location) {
  try {
    dimension.spawnParticle(particleId, location);
  } catch (_error) {}
}

function addEffect(player, effectId, duration, amplifier = 0) {
  try {
    player.addEffect(effectId, Math.max(1, Math.floor(duration)), {
      amplifier: Math.max(0, Math.floor(amplifier)),
      showParticles: false,
    });
  } catch (_error) {}
}

function subtitle(player, text, stay = 55) {
  try {
    player.onScreenDisplay.setTitle(" ", {
      subtitle: text,
      fadeInDuration: 1,
      stayDuration: stay,
      fadeOutDuration: 10,
    });
  } catch (_error) {
    try { player.sendMessage(`§8${text}`); } catch (__error) {}
  }
}

function cameraShake(player, intensity = 0.45, seconds = 1.2) {
  try {
    player.runCommand(`camerashake add @s ${intensity.toFixed(2)} ${seconds.toFixed(2)} rotational`);
  } catch (_error) {}
}

function spawnWatcher(player, location, lifetimeTicks = CONFIG.watcherLifetimeTicks) {
  let watcher;
  try {
    watcher = player.dimension.spawnEntity("paradise:watcher", location);
  } catch (_error) {
    return undefined;
  }

  system.runTimeout(() => {
    try {
      if (typeof watcher?.isValid === "function" ? watcher.isValid() : watcher?.isValid !== false) watcher.remove();
    } catch (_error) {}
  }, lifetimeTicks);
  return watcher;
}

function fractureTerrain(dimension, center, radius = 3, targetCount = 16) {
  const c = floorLoc(center);
  const candidates = [];
  for (let x = -radius; x <= radius; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -radius; z <= radius; z++) {
        if (x * x + z * z > radius * radius) continue;
        const location = { x: c.x + x, y: c.y + y, z: c.z + z };
        const block = safeGetBlock(dimension, location);
        if (!block || isProtectedType(block.typeId) || !MUTABLE_TERRAIN.has(block.typeId)) continue;
        candidates.push(location);
      }
    }
  }

  let changed = 0;
  while (candidates.length && changed < Math.min(targetCount, CONFIG.maxMutationsPerEvent)) {
    const index = randomInt(0, candidates.length - 1);
    const location = candidates.splice(index, 1)[0];
    const replacement = Math.random() < 0.4 ? "minecraft:air" : choose(CORRUPTION_PALETTE);
    if (safeSetBlock(dimension, location, replacement)) changed++;
  }
  return changed;
}

function corruptSurface(player, radius = 6, targetCount = 28) {
  const dimension = player.dimension;
  const base = floorLoc(player.location);
  let changed = 0;
  const attempts = targetCount * 5;
  for (let i = 0; i < attempts && changed < targetCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const distance = 2 + Math.random() * Math.max(1, radius - 2);
    const sample = {
      x: base.x + Math.cos(angle) * distance,
      y: base.y + 2,
      z: base.z + Math.sin(angle) * distance,
    };
    const ground = findGround(dimension, sample, 9);
    if (!ground) continue;
    const block = safeGetBlock(dimension, ground);
    if (!block || isProtectedType(block.typeId) || !MUTABLE_TERRAIN.has(block.typeId)) continue;
    if (safeSetBlock(dimension, ground, choose(CORRUPTION_PALETTE))) {
      changed++;
      particle(dimension, "minecraft:basic_smoke_particle", add(ground, 0.5, 1.1, 0.5));
    }
  }
  return changed;
}

function createDestructiveExplosion(player, location, radius = 2.2) {
  if (!isValidPlayer(player)) return false;
  const protectedNearby = hasProtectedBlockNear(player.dimension, location, radius + 1);
  let created = false;
  try {
    created = player.dimension.createExplosion(location, radius, {
      breaksBlocks: !protectedNearby,
      causesFire: false,
      allowUnderwater: false,
    });
  } catch (_error) {}

  if (!created || protectedNearby) {
    playSound(player, "random.explode", { volume: 1.5, pitch: 0.7 });
    particle(player.dimension, "minecraft:huge_explosion_emitter", location);
    fractureTerrain(player.dimension, location, Math.max(2, Math.floor(radius + 1)), randomInt(8, 18));
  }
  return !protectedNearby;
}

function removeNearbyLights(player, radius = 9, maxCount = 32) {
  const base = floorLoc(player.location);
  let removed = 0;
  for (let y = -4; y <= 5 && removed < maxCount; y++) {
    for (let x = -radius; x <= radius && removed < maxCount; x++) {
      for (let z = -radius; z <= radius && removed < maxCount; z++) {
        if (x * x + z * z > radius * radius) continue;
        const location = { x: base.x + x, y: base.y + y, z: base.z + z };
        const block = safeGetBlock(player.dimension, location);
        if (!block || !LIGHT_BLOCKS.has(block.typeId)) continue;
        if (safeSetBlock(player.dimension, location, "minecraft:air")) removed++;
      }
    }
  }
  return removed;
}

function breachNearbyStructure(player, radius = 6, maxCount = 24) {
  const base = floorLoc(player.location);
  const candidates = [];
  for (let y = -2; y <= 4; y++) {
    for (let x = -radius; x <= radius; x++) {
      for (let z = -radius; z <= radius; z++) {
        if (x * x + z * z > radius * radius) continue;
        const location = { x: base.x + x, y: base.y + y, z: base.z + z };
        const typeId = safeGetBlock(player.dimension, location)?.typeId;
        if (isBreachable(typeId)) candidates.push(location);
      }
    }
  }

  let broken = 0;
  while (candidates.length && broken < maxCount) {
    const index = randomInt(0, candidates.length - 1);
    const location = candidates.splice(index, 1)[0];
    if (safeSetBlock(player.dimension, location, "minecraft:air")) {
      broken++;
      if (broken % 4 === 0) particle(player.dimension, "minecraft:basic_smoke_particle", add(location, 0.5, 0.5, 0.5));
    }
  }
  return broken;
}

function isUnderground(player) {
  const base = floorLoc(player.location);
  for (let y = 3; y <= 14; y++) {
    const typeId = safeGetBlock(player.dimension, { x: base.x, y: base.y + y, z: base.z })?.typeId;
    if (typeId && !isAir(typeId)) return true;
  }
  return false;
}

function smokeBurst(player, radius = 4, count = 12) {
  if (!isValidPlayer(player)) return;
  for (let i = 0; i < count; i++) {
    particle(player.dimension, "minecraft:basic_smoke_particle", add(player.location,
      (Math.random() * 2 - 1) * radius,
      0.3 + Math.random() * 2.8,
      (Math.random() * 2 - 1) * radius));
  }
}

function stagedWatcherApproach(player, steps = 3) {
  if (!isValidPlayer(player)) return;
  const basis = yawToBasis(player);
  for (let i = 0; i < steps; i++) {
    system.runTimeout(() => {
      if (!isValidPlayer(player)) return;
      const distance = Math.max(2.8, 8 - i * 2.1);
      const side = i % 2 === 0 ? 1 : -1;
      const location = add(player.location,
        -basis.forward.x * distance + basis.right.x * side * (1.5 + Math.random()),
        0.2,
        -basis.forward.z * distance + basis.right.z * side * (1.5 + Math.random()));
      spawnWatcher(player, location, TICKS * 3);
      playSound(player, "mob.warden.heartbeat", { volume: 1.1 + i * 0.12, pitch: 0.58 - i * 0.05 });
    }, TICKS * (1 + i * 2));
  }
}

function scorchRing(player, radius = 6, targetCount = 18) {
  const base = floorLoc(player.location);
  let changed = 0;
  for (let attempt = 0; attempt < targetCount * 6 && changed < targetCount; attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const distance = 2 + Math.random() * Math.max(1, radius - 2);
    const ground = findGround(player.dimension, {
      x: base.x + Math.cos(angle) * distance,
      y: base.y + 3,
      z: base.z + Math.sin(angle) * distance,
    }, 10);
    const block = ground && safeGetBlock(player.dimension, ground);
    if (!block || isProtectedType(block.typeId) || !MUTABLE_TERRAIN.has(block.typeId)) continue;
    if (safeSetBlock(player.dimension, ground, Math.random() < 0.45 ? "minecraft:magma" : "minecraft:blackstone")) changed++;
  }
  return changed;
}

function eventFaultline(player) {
  const basis = yawToBasis(player);
  const origin = { ...player.location };
  addEffect(player, "resistance", TICKS * 7, 2);
  addEffect(player, "darkness", TICKS * 8, 0);
  playSound(player, "ambient.cave", { volume: 1.6, pitch: 0.35 });
  subtitle(player, "The ground remembered where you were standing.", 75);
  cameraShake(player, 0.42, 3.6);
  smokeBurst(player, 5, 18);

  const blasts = [];
  for (let i = 0; i < 5; i++) {
    const distance = 3.5 + i * 2.2;
    const side = i % 2 === 0 ? 1 : -1;
    blasts.push(add(origin,
      basis.forward.x * distance + basis.right.x * side * randomInt(1, 3),
      -0.5,
      basis.forward.z * distance + basis.right.z * side * randomInt(1, 3)));
  }

  blasts.forEach((location, index) => {
    system.runTimeout(() => {
      if (!isValidPlayer(player)) return;
      createDestructiveExplosion(player, location, 1.9 + index * 0.18);
      fractureTerrain(player.dimension, location, 3 + Math.floor(index / 2), 14 + index * 4);
      cameraShake(player, 0.42 + index * 0.08, 0.9);
    }, 18 + index * 14);
  });
  system.runTimeout(() => {
    if (!isValidPlayer(player)) return;
    fractureTerrain(player.dimension, add(origin, 0, -1, 0), 5, 34);
    stagedWatcherApproach(player, 3);
  }, TICKS * 4);
  return true;
}


function eventBlackout(player) {
  const removed = removeNearbyLights(player, 13, 56);
  addEffect(player, "darkness", TICKS * 16, 0);
  addEffect(player, "slowness", TICKS * 7, 1);
  playSound(player, "random.fizz", { volume: 1.6, pitch: 0.32 });
  subtitle(player, removed > 0 ? "Every light died in the order you placed it." : "The dark arrived before there was anything to extinguish.", 82);
  cameraShake(player, 0.28, 2.4);

  for (let i = 0; i < 5; i++) {
    system.runTimeout(() => {
      if (!isValidPlayer(player)) return;
      playSound(player, i === 4 ? "random.break" : "random.fizz", { volume: 0.7 + i * 0.12, pitch: 0.55 - i * 0.06 });
      smokeBurst(player, 4 + i, 5 + i * 2);
      if (i === 2) breachNearbyStructure(player, 5, 8);
    }, 10 + i * 18);
  }
  stagedWatcherApproach(player, 4);
  system.runTimeout(() => {
    if (!isValidPlayer(player)) return;
    const basis = yawToBasis(player);
    const blast = add(player.location, -basis.forward.x * 4, 0.1, -basis.forward.z * 4);
    createDestructiveExplosion(player, blast, 1.8);
  }, TICKS * 7);
  return true;
}


function eventStructuralBreach(player) {
  const basis = yawToBasis(player);
  const origin = { ...player.location };
  const firstBroken = breachNearbyStructure(player, 9, 38);
  addEffect(player, "darkness", TICKS * 10, 0);
  addEffect(player, "weakness", TICKS * 10, 1);
  playSound(player, "random.break", { volume: 1.7, pitch: 0.35 });
  subtitle(player, firstBroken > 0 ? "It did not find a door. It made one." : "Something outside has started measuring the walls.", 78);
  cameraShake(player, 0.62, 2.2);

  const breachPoints = [
    add(origin, -basis.forward.x * 5 + basis.right.x * 3, 0.5, -basis.forward.z * 5 + basis.right.z * 3),
    add(origin, -basis.forward.x * 6 - basis.right.x * 3, 0.5, -basis.forward.z * 6 - basis.right.z * 3),
    add(origin, basis.forward.x * 5, 0.4, basis.forward.z * 5),
  ];
  breachPoints.forEach((point, index) => system.runTimeout(() => {
    if (!isValidPlayer(player)) return;
    createDestructiveExplosion(player, point, 1.9 + index * 0.2);
    breachNearbyStructure(player, 8, 14 + index * 5);
    smokeBurst(player, 6, 10);
  }, 18 + index * 24));
  system.runTimeout(() => stagedWatcherApproach(player, 3), TICKS * 3);
  return true;
}


function eventRotBloom(player) {
  let totalChanged = 0;
  addEffect(player, "nausea", TICKS * 13, 0);
  addEffect(player, "darkness", TICKS * 9, 0);
  addEffect(player, "weakness", TICKS * 6, 0);
  playSound(player, "mob.warden.emerge", { volume: 1.4, pitch: 0.42 });
  subtitle(player, "The rot is not spreading. It is following.", 80);
  cameraShake(player, 0.38, 2.5);

  for (let wave = 0; wave < 4; wave++) {
    system.runTimeout(() => {
      if (!isValidPlayer(player)) return;
      totalChanged += corruptSurface(player, 6 + wave * 2, 18 + wave * 8);
      smokeBurst(player, 5 + wave, 10 + wave * 4);
      playSound(player, "mob.warden.dig", { volume: 0.75 + wave * 0.12, pitch: 0.72 - wave * 0.08 });
      if (wave === 3) stagedWatcherApproach(player, 3);
    }, wave * TICKS * 2);
  }
  return true;
}


function eventCeilingCollapse(player) {
  if (!isUnderground(player)) return false;
  const base = floorLoc(player.location);
  const placements = [];
  for (let i = 0; i < 70 && placements.length < 22; i++) {
    const x = base.x + randomInt(-7, 7);
    const z = base.z + randomInt(-7, 7);
    if (Math.abs(x - base.x) <= 1 && Math.abs(z - base.z) <= 1) continue;
    for (let y = base.y + 10; y >= base.y + 3; y--) {
      const ceiling = safeGetBlock(player.dimension, { x, y, z });
      const below = safeGetBlock(player.dimension, { x, y: y - 1, z });
      if (!ceiling || !below || isProtectedType(ceiling.typeId)) continue;
      if (!isAir(ceiling.typeId) && isAir(below.typeId)) {
        placements.push({ x, y, z });
        break;
      }
    }
  }
  if (!placements.length) return false;

  addEffect(player, "darkness", TICKS * 12, 0);
  addEffect(player, "resistance", TICKS * 8, 2);
  playSound(player, "dig.stone", { volume: 1.7, pitch: 0.32 });
  subtitle(player, "The ceiling has started breathing dust.", 78);
  cameraShake(player, 0.72, 3.0);

  placements.forEach((location, index) => {
    system.runTimeout(() => {
      if (!isValidPlayer(player)) return;
      safeSetBlock(player.dimension, location, Math.random() < 0.58 ? "minecraft:gravel" : Math.random() < 0.7 ? "minecraft:sand" : "minecraft:pointed_dripstone");
      particle(player.dimension, "minecraft:basic_smoke_particle", add(location, 0.5, -0.2, 0.5));
      if (index % 6 === 0) {
        playSound(player, "dig.stone", { volume: 0.9, pitch: 0.45 });
        cameraShake(player, 0.34, 0.6);
      }
    }, 8 + index * 3);
  });
  system.runTimeout(() => {
    if (!isValidPlayer(player)) return;
    const basis = yawToBasis(player);
    createDestructiveExplosion(player, add(player.location, basis.forward.x * 5, 2, basis.forward.z * 5), 1.75);
    stagedWatcherApproach(player, 2);
  }, TICKS * 4);
  return true;
}


function eventAshStorm(player) {
  const base = floorLoc(player.location);
  let fires = 0;
  for (let i = 0; i < 90 && fires < 20; i++) {
    const angle = Math.random() * Math.PI * 2;
    const distance = 3 + Math.random() * 10;
    const ground = findGround(player.dimension, {
      x: base.x + Math.cos(angle) * distance,
      y: base.y + 4,
      z: base.z + Math.sin(angle) * distance,
    }, 12);
    if (!ground || isProtectedType(safeGetBlock(player.dimension, ground)?.typeId)) continue;
    const above = add(ground, 0, 1, 0);
    if (!isAir(safeGetBlock(player.dimension, above)?.typeId)) continue;
    if (safeSetBlock(player.dimension, above, "minecraft:fire")) fires++;
  }

  scorchRing(player, 9, 28);
  addEffect(player, "darkness", TICKS * 13, 0);
  addEffect(player, "weakness", TICKS * 10, 1);
  addEffect(player, "nausea", TICKS * 6, 0);
  playSound(player, "ambient.weather.thunder", { volume: 1.4, pitch: 0.48 });
  subtitle(player, "The sky is burning on the other side of the dark.", 82);
  cameraShake(player, 0.52, 3.2);

  for (let wave = 0; wave < 5; wave++) {
    system.runTimeout(() => {
      if (!isValidPlayer(player)) return;
      smokeBurst(player, 8 + wave, 18 + wave * 4);
      const basis = yawToBasis(player);
      const side = wave % 2 === 0 ? 1 : -1;
      const blast = add(player.location,
        basis.forward.x * (5 + wave) + basis.right.x * side * randomInt(1, 4),
        0,
        basis.forward.z * (5 + wave) + basis.right.z * side * randomInt(1, 4));
      createDestructiveExplosion(player, blast, 1.55 + wave * 0.12);
    }, TICKS + wave * 18);
  }
  system.runTimeout(() => stagedWatcherApproach(player, 3), TICKS * 5);
  return true;
}


function eventGraveyardShift(player) {
  const removed = removeNearbyLights(player, 15, 64);
  const broken = breachNearbyStructure(player, 10, 42);
  addEffect(player, "darkness", TICKS * 18, 0);
  addEffect(player, "slowness", TICKS * 9, 1);
  subtitle(player, "The building has changed shifts. You were not replaced.", 88);
  playSound(player, "mob.warden.roar", { volume: 1.25, pitch: 0.45 });
  cameraShake(player, 0.68, 3.2);
  smokeBurst(player, 10, 28);
  stagedWatcherApproach(player, 5);
  system.runTimeout(() => {
    if (!isValidPlayer(player)) return;
    fractureTerrain(player.dimension, add(player.location, 0, -1, 0), 6, 42);
    scorchRing(player, 8, 22);
  }, TICKS * 4);
  return true;
}

function eventRedRupture(player) {
  const basis = yawToBasis(player);
  addEffect(player, "darkness", TICKS * 14, 0);
  addEffect(player, "nausea", TICKS * 9, 0);
  subtitle(player, "Something beneath the world has begun knocking back.", 85);
  playSound(player, "mob.wither.spawn", { volume: 1.1, pitch: 0.42 });
  cameraShake(player, 0.58, 3.0);
  for (let i = 0; i < 6; i++) {
    system.runTimeout(() => {
      if (!isValidPlayer(player)) return;
      const side = i % 2 === 0 ? 1 : -1;
      const point = add(player.location,
        basis.forward.x * (3 + i * 1.7) + basis.right.x * side * randomInt(1, 3),
        -0.5,
        basis.forward.z * (3 + i * 1.7) + basis.right.z * side * randomInt(1, 3));
      createDestructiveExplosion(player, point, 1.7 + i * 0.12);
      fractureTerrain(player.dimension, point, 3, 12 + i * 3);
    }, 15 + i * 13);
  }
  system.runTimeout(() => stagedWatcherApproach(player, 4), TICKS * 4);
  return true;
}

const EVENTS = [
  { key: "faultline", weight: 5, canRun: () => true, run: eventFaultline },
  { key: "blackout", weight: 6, canRun: () => true, run: eventBlackout },
  { key: "structural_breach", weight: 4, canRun: () => true, run: eventStructuralBreach },
  { key: "rot_bloom", weight: 5, canRun: () => true, run: eventRotBloom },
  { key: "ceiling_collapse", weight: 4, canRun: isUnderground, run: eventCeilingCollapse },
  { key: "ash_storm", weight: 4, canRun: () => true, run: eventAshStorm },
  { key: "graveyard_shift", weight: 3, canRun: () => true, run: eventGraveyardShift },
  { key: "red_rupture", weight: 3, canRun: () => true, run: eventRedRupture },
];

function canRunEvent(player, event, forced = false) {
  if (!isValidPlayer(player)) return false;
  const now = nowTick();
  if (!forced) {
    if (globalCooldownUntil > now) return false;
    if ((playerCooldowns.get(playerId(player)) || 0) > now) return false;
    if ((eventCooldowns.get(event.key) || 0) > now) return false;
  }
  try {
    return event.canRun(player) !== false;
  } catch (_error) {
    return false;
  }
}

function markCooldowns(player, event) {
  const now = nowTick();
  globalCooldownUntil = now + CONFIG.globalCooldownTicks;
  playerCooldowns.set(playerId(player), now + CONFIG.playerCooldownTicks);
  eventCooldowns.set(event.key, now + CONFIG.eventCooldownTicks);
}

function runEvent(player, event, forced = false) {
  if (!canRunEvent(player, event, forced)) return false;
  let result = false;
  try {
    result = event.run(player) !== false;
  } catch (_error) {
    result = false;
  }
  if (!result) return false;

  markCooldowns(player, event);
  const now = nowTick();
  requestVhsTier(player, VHS_TIER.Panic, now, TICKS * 11, `destructive:${event.key}`);
  applyHorrorConsequence(player, {
    source: `destructive_horror:${event.key}`,
    eventKey: event.key,
    category: "panic",
    intensity: 5,
    fear: 34,
    stalkerAttention: 38,
    panicTicks: TICKS * 12,
    flashlightInterferenceTicks: TICKS * 20,
    visionDistortionTicks: TICKS * 12,
    hearingDistortionTicks: TICKS * 11,
    movementPenaltyTicks: TICKS * 5,
    major: true,
  }, now);
  return true;
}

function chooseEvent(player) {
  const candidates = EVENTS.filter((event) => canRunEvent(player, event, false));
  if (!candidates.length) return undefined;
  const total = candidates.reduce((sum, event) => sum + event.weight, 0);
  let roll = Math.random() * total;
  for (const event of candidates) {
    roll -= event.weight;
    if (roll <= 0) return event;
  }
  return candidates[candidates.length - 1];
}

function tryTrigger(player, triggerBoost = 0) {
  if (!isValidPlayer(player)) return false;
  const now = nowTick();
  if (globalCooldownUntil > now || (playerCooldowns.get(playerId(player)) || 0) > now) return false;

  const horror = getPlayerHorrorSnapshot(player, now);
  const fear = Number(horror.fearScore) || 0;
  const attention = Number(horror.stalkerAttentionLevel) || 0;
  const chance = Math.min(0.58, 0.10 + fear / 360 + attention / 460 + triggerBoost);
  if (Math.random() >= chance) return false;

  const event = chooseEvent(player);
  return event ? runEvent(player, event, false) : false;
}

function pulse() {
  let players = [];
  try { players = world.getPlayers(); } catch (_error) {}
  for (const player of players) tryTrigger(player, 0);
}

function subscribe(signal, handler) {
  try {
    if (signal?.subscribe) signal.subscribe(handler);
  } catch (_error) {}
}

function handleScriptEvent(event) {
  if (event?.id !== "paradise:destruction") return;
  const source = event.sourceEntity || event.initiator;
  const player = isValidPlayer(source) ? source : world.getPlayers()[0];
  const [command, argument] = String(event.message || "").trim().split(/\s+/);

  if (command === "list") {
    try { world.sendMessage(`§4Destructive events: ${EVENTS.map((entry) => entry.key).join(", ")}`); } catch (_error) {}
    return;
  }

  if (command === "force" && player) {
    const key = String(argument || "").toLowerCase();
    const eventDef = EVENTS.find((entry) => entry.key === key);
    const fired = eventDef ? runEvent(player, eventDef, true) : false;
    try { world.sendMessage(fired ? `§4Forced ${key}.` : `§cCould not force ${key}.`); } catch (_error) {}
  }
}

function initialize() {
  if (initialized) return;
  initialized = true;

  subscribe(world.afterEvents.playerSpawn, (event) => {
    const player = event.player;
    if (isValidPlayer(player)) playerCooldowns.set(playerId(player), nowTick() + CONFIG.spawnGraceTicks);
  });
  subscribe(world.afterEvents.playerLeave, (event) => {
    if (event?.playerId) playerCooldowns.delete(String(event.playerId));
  });
  subscribe(world.afterEvents.playerBreakBlock, (event) => tryTrigger(event.player, 0.08));
  subscribe(world.afterEvents.playerInteractWithBlock, (event) => tryTrigger(event.player, 0.05));
  subscribe(world.afterEvents.entityHurt, (event) => {
    if (event?.hurtEntity?.typeId === "minecraft:player") tryTrigger(event.hurtEntity, 0.12);
  });
  subscribe(system.afterEvents?.scriptEventReceive, handleScriptEvent);
  system.runInterval(pulse, CONFIG.pulseIntervalTicks);
}

system.run(initialize);
