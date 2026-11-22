import { BlockPermutation, system, world } from "@minecraft/server";
import { applyHorrorConsequence, getPlayerHorrorSnapshot } from "./paradise_player_horror_state.js";
import { recordPlayerTelemetry, recordTelemetry } from "./paradise_telemetry.js";
import { isPlayerInSafeRoom, requestVhsTier, VHS_TIER } from "./paradise_horror_state.js";

const TICKS = 20;

const CONFIG = Object.freeze({
  pulseIntervalTicks: TICKS * 22,
  cleanupIntervalTicks: TICKS * 5,
  globalCooldownTicks: TICKS * 34,
  playerCooldownTicks: TICKS * 72,
  defaultEventCooldownTicks: TICKS * 300,
  lowHealthFloor: 8,
  lethalFloor: 4,
  forcedLowHealthFloor: 4,
  maxTemporaryBlocks: 96,
});

const HARMFUL_EVENTS = [
  { key: "heartSkip", category: "pressure", weight: 5, cooldownTicks: TICKS * 280, triggerTypes: ["pulse", "hurt", "spawn"], run: eventHeartSkip },
  { key: "breathTheft", category: "major", weight: 4, cooldownTicks: TICKS * 360, triggerTypes: ["pulse", "break", "hurt"], run: eventBreathTheft },
  { key: "boneLock", category: "major", weight: 4, cooldownTicks: TICKS * 360, triggerTypes: ["pulse", "interact", "hurt"], run: eventBoneLock },
  { key: "bloodPrice", category: "major", weight: 3, cooldownTicks: TICKS * 420, triggerTypes: ["pulse", "interact"], run: eventBloodPrice },
  { key: "shadowBite", category: "major", weight: 5, cooldownTicks: TICKS * 320, triggerTypes: ["pulse", "break", "hurt"], run: eventShadowBite },
  { key: "panicSprint", category: "pressure", weight: 4, cooldownTicks: TICKS * 300, triggerTypes: ["pulse", "hurt", "spawn"], run: eventPanicSprint },
  { key: "handsInTheDark", category: "major", weight: 4, cooldownTicks: TICKS * 420, triggerTypes: ["pulse", "interact", "break"], run: eventHandsInTheDark },
  { key: "starvationPulse", category: "pressure", weight: 3, cooldownTicks: TICKS * 360, triggerTypes: ["pulse", "interact"], run: eventStarvationPulse },
  { key: "visionCollapse", category: "major", weight: 5, cooldownTicks: TICKS * 300, triggerTypes: ["pulse", "hurt", "break"], run: eventVisionCollapse },
  { key: "falseFloor", category: "panic", weight: 2, cooldownTicks: TICKS * 560, triggerTypes: ["pulse", "break"], run: eventFalseFloor },
  { key: "stalkerMark", category: "panic", weight: 4, cooldownTicks: TICKS * 420, triggerTypes: ["pulse", "hurt", "interact"], run: eventStalkerMark },
  { key: "organFailure", category: "panic", weight: 3, cooldownTicks: TICKS * 520, triggerTypes: ["pulse", "hurt"], run: eventOrganFailure },
  { key: "thePull", category: "major", weight: 4, cooldownTicks: TICKS * 360, triggerTypes: ["pulse", "break", "hurt"], run: eventThePull },
  { key: "chokedTorch", category: "major", weight: 4, cooldownTicks: TICKS * 340, triggerTypes: ["pulse", "interact", "break"], run: eventChokedTorch },
  { key: "executionWarning", category: "panic", weight: 3, cooldownTicks: TICKS * 620, triggerTypes: ["pulse", "hurt"], run: eventExecutionWarning },
];

const temporaryBlocks = [];
const playerCooldowns = new Map();
const eventCooldowns = new Map();
let globalCooldownUntil = 0;
let debugEnabled = false;
let initialized = false;

function tickNow() {
  try {
    return system.currentTick || 0;
  } catch (_error) {
    return 0;
  }
}

function idOf(playerOrId) {
  return String(playerOrId?.id || playerOrId?.name || playerOrId || "unknown");
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max) {
  return min + Math.random() * (max - min);
}

function choose(list) {
  return list.length ? list[randomInt(0, list.length - 1)] : undefined;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function floorLocation(location) {
  return {
    x: Math.floor(location.x),
    y: Math.floor(location.y),
    z: Math.floor(location.z),
  };
}

function add(location, dx, dy, dz) {
  return { x: location.x + dx, y: location.y + dy, z: location.z + dz };
}

function distanceSquared(a, b) {
  const dx = (Number(a?.x) || 0) - (Number(b?.x) || 0);
  const dy = (Number(a?.y) || 0) - (Number(b?.y) || 0);
  const dz = (Number(a?.z) || 0) - (Number(b?.z) || 0);
  return dx * dx + dy * dy + dz * dz;
}

function isValidPlayer(player) {
  try {
    return !!player && player.typeId === "minecraft:player" && player.isValid !== false && !!player.dimension && !!player.location;
  } catch (_error) {
    return false;
  }
}

function safeGetBlock(dimension, location) {
  try {
    return dimension?.getBlock(floorLocation(location));
  } catch (_error) {
    return undefined;
  }
}

function safeSetBlock(block, typeId) {
  if (!block || !typeId) return false;
  try {
    const permutation = BlockPermutation.resolve(typeId);
    if (permutation && typeof block.setPermutation === "function") {
      block.setPermutation(permutation);
      return true;
    }
  } catch (_error) {}
  try {
    if (typeof block.setType === "function") {
      block.setType(typeId);
      return true;
    }
  } catch (_error) {}
  return false;
}

function rememberTemporaryBlock(block, eventKey, playerId, restoreTick) {
  if (!block || !block.dimension || !block.location) return false;
  temporaryBlocks.push({
    dimension: block.dimension,
    location: floorLocation(block.location),
    permutation: block.permutation,
    typeId: block.typeId,
    restoreTick,
    eventKey,
    playerId,
  });
  while (temporaryBlocks.length > CONFIG.maxTemporaryBlocks) {
    restoreTemporaryBlock(temporaryBlocks.shift());
  }
  return true;
}

function restoreTemporaryBlock(snapshot) {
  if (!snapshot) return false;
  try {
    const block = safeGetBlock(snapshot.dimension, snapshot.location);
    if (!block) return false;
    if (snapshot.permutation && typeof block.setPermutation === "function") {
      block.setPermutation(snapshot.permutation);
      return true;
    }
    return safeSetBlock(block, snapshot.typeId);
  } catch (_error) {
    return false;
  }
}

function cleanupTemporaryBlocks() {
  const now = tickNow();
  for (let index = temporaryBlocks.length - 1; index >= 0; index--) {
    if ((temporaryBlocks[index].restoreTick || 0) <= now) {
      restoreTemporaryBlock(temporaryBlocks[index]);
      temporaryBlocks.splice(index, 1);
    }
  }
}

function restoreAllTemporaryBlocks() {
  const count = temporaryBlocks.length;
  while (temporaryBlocks.length) {
    restoreTemporaryBlock(temporaryBlocks.pop());
  }
  return count;
}

function safePlaySound(dimension, soundId, location, options = {}) {
  try {
    dimension?.playSound(soundId, location, options);
  } catch (_error) {}
}

function safeParticle(dimension, particleId, location) {
  try {
    dimension?.spawnParticle(particleId, location);
  } catch (_error) {}
}

function showSubtitle(player, text, stay = 45) {
  try {
    player?.onScreenDisplay?.setTitle(" ", {
      subtitle: text,
      fadeInDuration: 1,
      stayDuration: stay,
      fadeOutDuration: 8,
    });
  } catch (_error) {
    try { player?.sendMessage(`§7${text}`); } catch (__error) {}
  }
}

function showAction(player, text) {
  try {
    player?.onScreenDisplay?.setActionBar(text);
  } catch (_error) {}
}

function safeAddEffect(player, effectId, durationTicks, amplifier = 0) {
  try {
    player?.addEffect(effectId, Math.max(1, Math.floor(durationTicks)), {
      amplifier: Math.max(0, Math.floor(amplifier)),
      showParticles: false,
    });
    return true;
  } catch (_error) {
    return false;
  }
}

function getHealth(player) {
  try {
    const health = player?.getComponent("minecraft:health") || player?.getComponent("health");
    const value = Number(health?.currentValue ?? health?.value ?? health?.effectiveMax ?? 20);
    return Number.isFinite(value) ? value : 20;
  } catch (_error) {
    return 20;
  }
}

function safeDamage(player, amount, minHealth = Number(CONFIG.lethalFloor), damagingEntity = undefined) {
  if (!isValidPlayer(player)) return false;
  const health = getHealth(player);
  const safeAmount = Math.floor(Math.min(Math.max(0, amount), Math.max(0, health - minHealth)));
  if (safeAmount <= 0) return false;
  try {
    if (damagingEntity) {
      player.applyDamage(safeAmount, { damagingEntity });
    } else {
      player.applyDamage(safeAmount);
    }
    return true;
  } catch (_error) {
    return false;
  }
}

function applyHarmConsequence(player, event, extra = {}) {
  const now = tickNow();
  const category = event.category || "pressure";
  const intensity = category === "panic" ? 5 : category === "major" ? 4 : category === "pressure" ? 3 : 2;
  const snapshot = applyHorrorConsequence(player, {
    source: `harmful_player_event:${event.key}`,
    eventKey: event.key,
    category,
    intensity,
    fear: category === "panic" ? 34 : category === "major" ? 23 : 15,
    stalkerAttention: category === "panic" ? 36 : category === "major" ? 24 : 14,
    panicTicks: category === "panic" ? TICKS * 12 : category === "major" ? TICKS * 7 : TICKS * 3,
    flashlightInterferenceTicks: category === "panic" ? TICKS * 18 : category === "major" ? TICKS * 12 : TICKS * 8,
    movementPenaltyTicks: category === "panic" ? TICKS * 7 : category === "major" ? TICKS * 5 : TICKS * 2,
    visionDistortionTicks: category === "panic" ? TICKS * 12 : category === "major" ? TICKS * 8 : TICKS * 4,
    hearingDistortionTicks: category === "panic" ? TICKS * 10 : category === "major" ? TICKS * 6 : TICKS * 3,
    reliefTicks: category === "panic" ? TICKS * 32 : category === "major" ? TICKS * 18 : 0,
    ...extra,
  }, now);

  recordPlayerTelemetry(player, "harmful_player_event", {
    currentTick: now,
    source: "harmful_player_events",
    reason: event.key,
    status: "fired",
    category,
    fearScore: snapshot.fearScore,
    stalkerAttentionLevel: snapshot.stalkerAttentionLevel,
  });

  requestVhsTier(player, category === "panic" ? VHS_TIER.Panic : VHS_TIER.High, now, category === "panic" ? TICKS * 10 : TICKS * 6, `harmful:${event.key}`);
}

function hasValuableInventory(player) {
  try {
    const inventory = player.getComponent("minecraft:inventory") || player.getComponent("inventory");
    const container = inventory?.container;
    if (!container) return false;
    const valuableTokens = ["diamond", "emerald", "netherite", "ancient_debris", "elytra", "totem", "shulker_box"];
    for (let slot = 0; slot < container.size; slot++) {
      const item = container.getItem(slot);
      const typeId = String(item?.typeId || "");
      if (valuableTokens.some((token) => typeId.includes(token))) return true;
    }
  } catch (_error) {}
  return false;
}

function getFlatBasis(player) {
  let view = { x: 0, z: 1 };
  try {
    const raw = player.getViewDirection();
    view = { x: raw.x || 0, z: raw.z || 0 };
  } catch (_error) {}
  const length = Math.max(0.001, Math.sqrt(view.x * view.x + view.z * view.z));
  const forward = { x: view.x / length, z: view.z / length };
  return {
    forward,
    back: { x: -forward.x, z: -forward.z },
    right: { x: -forward.z, z: forward.x },
  };
}

function findSafeTeleportNear(player, preferred, radius = 4) {
  const dimension = player.dimension;
  const base = floorLocation(preferred || player.location);
  for (let attempt = 0; attempt < 80; attempt++) {
    const dx = attempt === 0 ? 0 : randomInt(-radius, radius);
    const dz = attempt === 0 ? 0 : randomInt(-radius, radius);
    const candidate = add(base, dx, 0, dz);
    for (let dy = 3; dy >= -4; dy--) {
      const feet = safeGetBlock(dimension, add(candidate, 0, dy, 0));
      const head = safeGetBlock(dimension, add(candidate, 0, dy + 1, 0));
      const floor = safeGetBlock(dimension, add(candidate, 0, dy - 1, 0));
      if (feet?.typeId === "minecraft:air" && head?.typeId === "minecraft:air" && floor && floor.typeId !== "minecraft:air" && !floor.typeId.includes("lava") && !floor.typeId.includes("fire")) {
        return { x: candidate.x + 0.5, y: candidate.y + dy, z: candidate.z + 0.5 };
      }
    }
  }
  return undefined;
}

function maybePlaceTemporaryBlock(player, location, typeId, restoreTicks, eventKey) {
  const block = safeGetBlock(player.dimension, location);
  if (!block) return false;
  rememberTemporaryBlock(block, eventKey, idOf(player), tickNow() + restoreTicks);
  return safeSetBlock(block, typeId);
}

function canFireEvent(player, event, triggerType, forced = false) {
  if (!isValidPlayer(player)) return false;
  const now = tickNow();
  if (!forced) {
    if (isPlayerInSafeRoom(player, now)) return false;
    if (globalCooldownUntil > now) return false;
    if ((playerCooldowns.get(idOf(player)) || 0) > now) return false;
    if ((eventCooldowns.get(event.key) || 0) > now) return false;
    if (!event.triggerTypes.includes(triggerType)) return false;

    const horror = getPlayerHorrorSnapshot(player, now);
    const enoughPressure = triggerType !== "pulse" || (horror.fearScore || 0) >= 10 || (horror.stalkerAttentionLevel || 0) >= 10 || Math.random() < 0.36;
    if (!enoughPressure) return false;
    if (getHealth(player) <= CONFIG.lowHealthFloor && event.category === "panic") return false;
  }
  return true;
}

function markCooldowns(player, event) {
  const now = tickNow();
  globalCooldownUntil = now + CONFIG.globalCooldownTicks;
  playerCooldowns.set(idOf(player), now + CONFIG.playerCooldownTicks);
  eventCooldowns.set(event.key, now + (event.cooldownTicks || CONFIG.defaultEventCooldownTicks));
}

function cameraShake(player, intensity = 0.35, seconds = 1.0) {
  try { player.runCommand(`camerashake add @s ${intensity.toFixed(2)} ${seconds.toFixed(2)} rotational`); } catch (_error) {}
}

function spawnHarmWatcher(player, lifetimeTicks = TICKS * 6) {
  if (!isValidPlayer(player)) return;
  const basis = getFlatBasis(player);
  const side = Math.random() < 0.5 ? -1 : 1;
  const location = {
    x: player.location.x + basis.back.x * randomFloat(5, 8) + basis.right.x * side * randomFloat(1, 3),
    y: player.location.y + 0.2,
    z: player.location.z + basis.back.z * randomFloat(5, 8) + basis.right.z * side * randomFloat(1, 3),
  };
  try {
    const watcher = player.dimension.spawnEntity("paradise:watcher", location);
    system.runTimeout(() => { try { if (watcher?.isValid !== false) watcher.remove(); } catch (_error) {} }, lifetimeTicks);
  } catch (_error) {}
}

function enhanceHarmfulEvent(player, event) {
  if (!isValidPlayer(player)) return;
  const panic = event.category === "panic";
  const major = panic || event.category === "major";
  cameraShake(player, panic ? 0.62 : major ? 0.38 : 0.22, panic ? 1.8 : 1.1);
  safePlaySound(player.dimension, panic ? "mob.warden.heartbeat" : "ambient.cave", player.location, {
    volume: panic ? 1.4 : 0.95,
    pitch: panic ? 0.48 : 0.62,
  });
  system.runTimeout(() => {
    if (!isValidPlayer(player) || isPlayerInSafeRoom(player, tickNow())) return;
    for (let i = 0; i < (panic ? 12 : major ? 8 : 5); i++) {
      safeParticle(player.dimension, "minecraft:basic_smoke_particle", {
        x: player.location.x + randomFloat(-2.5, 2.5),
        y: player.location.y + randomFloat(0.3, 2.5),
        z: player.location.z + randomFloat(-2.5, 2.5),
      });
    }
    if (major) spawnHarmWatcher(player, panic ? TICKS * 9 : TICKS * 5);
    if (panic) {
      safePlaySound(player.dimension, "mob.wither.break_block", player.location, { volume: 0.9, pitch: 0.5 });
      cameraShake(player, 0.72, 1.2);
    }
  }, panic ? TICKS * 2 : 18);
}

function runEvent(player, event, triggerType, forced = false, context = {}) {
  if (!canFireEvent(player, event, triggerType, forced)) return false;
  try {
    const result = event.run(player, { ...context, event, triggerType, forced, currentTick: tickNow() });
    if (result === false) return false;
    markCooldowns(player, event);
    enhanceHarmfulEvent(player, event);
    applyHarmConsequence(player, event, result && typeof result === "object" ? result.consequence || {} : {});
    if (debugEnabled) {
      world.sendMessage(`§c[Harmful] ${event.key} hit ${player.name}.`);
    }
    return true;
  } catch (error) {
    recordPlayerTelemetry(player, "harmful_player_event", {
      currentTick: tickNow(),
      source: "harmful_player_events",
      reason: event.key,
      status: "error",
      error: String(error?.message || error),
    });
    return false;
  }
}

function tryRandomHarmfulEvent(player, triggerType = "pulse", context = {}) {
  if (!isValidPlayer(player)) return false;
  const candidates = HARMFUL_EVENTS.filter((event) => canFireEvent(player, event, triggerType, false));
  if (!candidates.length) return false;
  const totalWeight = candidates.reduce((sum, event) => sum + Math.max(1, event.weight || 1), 0);
  let roll = Math.random() * totalWeight;
  for (const event of candidates) {
    roll -= Math.max(1, event.weight || 1);
    if (roll <= 0) return runEvent(player, event, triggerType, false, context);
  }
  return runEvent(player, candidates[candidates.length - 1], triggerType, false, context);
}

function eventHeartSkip(player, ctx) {
  const health = getHealth(player);
  if (health <= CONFIG.lowHealthFloor && !ctx.forced) return false;
  safePlaySound(player.dimension, "mob.warden.heartbeat", player.location, { volume: 1.5, pitch: 0.55 });
  safeDamage(player, randomInt(2, 4), CONFIG.lowHealthFloor);
  safeAddEffect(player, "darkness", TICKS * 3, 0);
  safeAddEffect(player, "weakness", TICKS * 5, 0);
  showSubtitle(player, "Your heart missed a beat. Something counted it.", 45);
  return { consequence: { fear: 18, stalkerAttention: 12 } };
}

function eventBreathTheft(player, ctx) {
  if (getHealth(player) <= CONFIG.lowHealthFloor && !ctx.forced) return false;
  safePlaySound(player.dimension, "mob.drowned.death", player.location, { volume: 0.9, pitch: 0.55 });
  safeAddEffect(player, "mining_fatigue", TICKS * 7, 0);
  safeAddEffect(player, "slowness", TICKS * 5, 0);
  safeAddEffect(player, "darkness", TICKS * 4, 0);
  safeDamage(player, 2, CONFIG.lowHealthFloor);
  showSubtitle(player, "The air left first.", 50);
  return { consequence: { panicTicks: TICKS * 5, hearingDistortionTicks: TICKS * 8 } };
}

function eventBoneLock(player, ctx) {
  safePlaySound(player.dimension, "mob.skeleton.hurt", player.location, { volume: 1.0, pitch: 0.45 });
  safeAddEffect(player, "slowness", TICKS * 8, 2);
  safeAddEffect(player, "mining_fatigue", TICKS * 8, 1);
  safeAddEffect(player, "weakness", TICKS * 8, 0);
  showSubtitle(player, "Your bones forgot the route.", 45);
  return { consequence: { movementPenaltyTicks: TICKS * 9, stalkerAttention: 20 } };
}

function eventBloodPrice(player, ctx) {
  if (!hasValuableInventory(player) && !ctx.forced) return false;
  if (getHealth(player) <= CONFIG.lowHealthFloor && !ctx.forced) return false;
  safePlaySound(player.dimension, "mob.evocation_illager.prepare_attack", player.location, { volume: 0.8, pitch: 0.65 });
  safeDamage(player, randomInt(3, 6), CONFIG.lowHealthFloor);
  safeAddEffect(player, "weakness", TICKS * 8, 0);
  showSubtitle(player, "It did not take the diamonds. It took the price.", 60);
  return { consequence: { fear: 26, stalkerAttention: 24, panicTicks: TICKS * 6 } };
}

function eventShadowBite(player, ctx) {
  if (getHealth(player) <= CONFIG.lowHealthFloor && !ctx.forced) return false;
  safePlaySound(player.dimension, "mob.phantom.flap", player.location, { volume: 0.8, pitch: 0.55 });
  showAction(player, "§8Something is behind you.");
  system.runTimeout(() => {
    if (!isValidPlayer(player) || isPlayerInSafeRoom(player, tickNow())) return;
    safePlaySound(player.dimension, "mob.phantom.bite", player.location, { volume: 1.0, pitch: 0.6 });
    safeDamage(player, randomInt(2, 5), CONFIG.lowHealthFloor);
    safeAddEffect(player, "darkness", TICKS * 3, 0);
  }, TICKS * 2);
  return { consequence: { stalkerAttention: 30, flashlightInterferenceTicks: TICKS * 10 } };
}

function eventPanicSprint(player, ctx) {
  safePlaySound(player.dimension, "mob.endermen.scream", player.location, { volume: 0.9, pitch: 0.6 });
  safeAddEffect(player, "speed", TICKS * 7, 2);
  safeAddEffect(player, "nausea", TICKS * 7, 0);
  safeAddEffect(player, "darkness", TICKS * 4, 0);
  showSubtitle(player, "Run. Not because you chose to.", 50);
  return { consequence: { panicTicks: TICKS * 8, movementPenaltyTicks: TICKS * 7 } };
}

function eventHandsInTheDark(player, ctx) {
  const base = floorLocation(player.location);
  const feet = safeGetBlock(player.dimension, base);
  const around = [base, add(base, 1, 0, 0), add(base, -1, 0, 0), add(base, 0, 0, 1), add(base, 0, 0, -1)];
  let placed = 0;
  for (const loc of around) {
    const block = safeGetBlock(player.dimension, loc);
    if (block?.typeId === "minecraft:air" && maybePlaceTemporaryBlock(player, loc, "minecraft:cobweb", TICKS * 10, ctx.event.key)) {
      placed++;
    }
  }
  if (!placed && feet?.typeId !== "minecraft:air") return false;
  safePlaySound(player.dimension, "block.cobweb.place", player.location, { volume: 0.9, pitch: 0.55 });
  safeAddEffect(player, "darkness", TICKS * 4, 0);
  showSubtitle(player, "Hands found your ankles.", 45);
  return { consequence: { stalkerAttention: 28, movementPenaltyTicks: TICKS * 11 } };
}

function eventStarvationPulse(player, ctx) {
  safePlaySound(player.dimension, "mob.husk.ambient", player.location, { volume: 0.9, pitch: 0.55 });
  safeAddEffect(player, "hunger", TICKS * 14, 3);
  safeAddEffect(player, "weakness", TICKS * 8, 0);
  if (getHealth(player) > CONFIG.lowHealthFloor) safeDamage(player, 1, CONFIG.lowHealthFloor);
  showSubtitle(player, "Your stomach answered something under the floor.", 55);
  return { consequence: { fear: 15, hearingDistortionTicks: TICKS * 7 } };
}

function eventVisionCollapse(player, ctx) {
  safePlaySound(player.dimension, "mob.warden.sonic_boom", player.location, { volume: 0.7, pitch: 0.5 });
  safeAddEffect(player, "blindness", TICKS * 5, 0);
  safeAddEffect(player, "darkness", TICKS * 8, 0);
  safeAddEffect(player, "slowness", TICKS * 4, 0);
  showSubtitle(player, "Do not trust your eyes now.", 45);
  return { consequence: { visionDistortionTicks: TICKS * 10, flashlightInterferenceTicks: TICKS * 14 } };
}

function eventFalseFloor(player, ctx) {
  const base = floorLocation(player.location);
  const floor = safeGetBlock(player.dimension, add(base, 0, -1, 0));
  const below = safeGetBlock(player.dimension, add(base, 0, -2, 0));
  if (!floor || floor.typeId === "minecraft:air" || floor.typeId.includes("bedrock") || floor.typeId.includes("chest")) return false;
  if (!below || below.typeId === "minecraft:air" || below.typeId.includes("lava") || below.typeId.includes("fire")) return false;
  rememberTemporaryBlock(floor, ctx.event.key, idOf(player), ctx.currentTick + TICKS * 5);
  if (!safeSetBlock(floor, "minecraft:air")) return false;
  safePlaySound(player.dimension, "random.break", player.location, { volume: 1.0, pitch: 0.5 });
  safeDamage(player, 2, CONFIG.lowHealthFloor);
  safeAddEffect(player, "slow_falling", TICKS * 3, 0);
  showSubtitle(player, "The floor changed its mind.", 45);
  return { consequence: { panicTicks: TICKS * 8, stalkerAttention: 30 } };
}

function eventStalkerMark(player, ctx) {
  safePlaySound(player.dimension, "mob.warden.agitated", player.location, { volume: 1.2, pitch: 0.65 });
  safeParticle(player.dimension, "minecraft:sonic_explosion", { x: player.location.x, y: player.location.y + 1, z: player.location.z });
  safeAddEffect(player, "glowing", TICKS * 8, 0);
  safeAddEffect(player, "darkness", TICKS * 5, 0);
  showSubtitle(player, "It knows exactly which one is you.", 55);
  return { consequence: { stalkerAttention: 48, fear: 28, panicTicks: TICKS * 7, ignoredWarning: true } };
}

function eventOrganFailure(player, ctx) {
  if (getHealth(player) <= CONFIG.lowHealthFloor && !ctx.forced) return false;
  safePlaySound(player.dimension, "mob.wither.hurt", player.location, { volume: 0.6, pitch: 0.5 });
  safeAddEffect(player, "poison", TICKS * 5, 0);
  safeAddEffect(player, "weakness", TICKS * 9, 1);
  safeDamage(player, randomInt(2, 4), CONFIG.lowHealthFloor);
  showSubtitle(player, "Something inside you stopped obeying.", 55);
  return { consequence: { panicTicks: TICKS * 9, fear: 30 } };
}

function eventThePull(player, ctx) {
  const basis = getFlatBasis(player);
  const side = Math.random() < 0.5 ? -1 : 1;
  const preferred = {
    x: player.location.x + basis.back.x * randomFloat(4, 7) + basis.right.x * side * randomFloat(2, 4),
    y: player.location.y,
    z: player.location.z + basis.back.z * randomFloat(4, 7) + basis.right.z * side * randomFloat(2, 4),
  };
  const destination = findSafeTeleportNear(player, preferred, 4);
  if (!destination) return false;
  safePlaySound(player.dimension, "mob.endermen.portal", player.location, { volume: 1.0, pitch: 0.45 });
  try { player.teleport(destination, { dimension: player.dimension }); } catch (_error) { return false; }
  safeAddEffect(player, "nausea", TICKS * 6, 0);
  safeAddEffect(player, "slowness", TICKS * 4, 1);
  showSubtitle(player, "The dark pulled first.", 45);
  return { consequence: { stalkerAttention: 32, panicTicks: TICKS * 6 } };
}

function eventChokedTorch(player, ctx) {
  safePlaySound(player.dimension, "ambient.cave", player.location, { volume: 1.0, pitch: 0.5 });
  safeAddEffect(player, "darkness", TICKS * 10, 0);
  safeAddEffect(player, "blindness", TICKS * 3, 0);
  showSubtitle(player, "The light did not go out. It was choked.", 55);
  return { consequence: { flashlightInterferenceTicks: TICKS * 20, visionDistortionTicks: TICKS * 12, stalkerAttention: 24 } };
}

function eventExecutionWarning(player, ctx) {
  if (getHealth(player) <= CONFIG.lowHealthFloor && !ctx.forced) return false;
  const start = { ...player.location };
  safePlaySound(player.dimension, "mob.warden.roar", player.location, { volume: 1.1, pitch: 0.55 });
  showSubtitle(player, "MOVE.", 30);
  showAction(player, "§4MOVE OR IT WILL HIT.");
  system.runTimeout(() => {
    if (!isValidPlayer(player) || isPlayerInSafeRoom(player, tickNow())) return;
    const movedSq = distanceSquared(start, player.location);
    if (movedSq < 4.0) {
      safePlaySound(player.dimension, "mob.wither.break_block", player.location, { volume: 0.9, pitch: 0.65 });
      safeDamage(player, 6, CONFIG.lowHealthFloor);
      safeAddEffect(player, "darkness", TICKS * 6, 0);
      safeAddEffect(player, "slowness", TICKS * 5, 2);
      applyHorrorConsequence(player, {
        source: "harmful_player_event:executionWarning:failed",
        eventKey: "executionWarningFailed",
        category: "panic",
        fear: 18,
        stalkerAttention: 42,
        panicTicks: TICKS * 8,
        flashlightInterferenceTicks: TICKS * 12,
        ignoredWarning: true,
      }, tickNow());
    } else {
      safePlaySound(player.dimension, "mob.phantom.flap", player.location, { volume: 0.8, pitch: 0.7 });
      showAction(player, "§7It missed by one breath.");
    }
  }, TICKS * 3);
  return { consequence: { stalkerAttention: 44, fear: 30, panicTicks: TICKS * 7, ignoredWarning: true } };
}

function handleInteract(event) {
  const player = event?.player;
  if (!isValidPlayer(player)) return;
  system.run(() => tryRandomHarmfulEvent(player, "interact", { block: event?.block }));
}

function handleBreak(event) {
  const player = event?.player;
  if (!isValidPlayer(player)) return;
  system.run(() => tryRandomHarmfulEvent(player, "break", { block: event?.block }));
}

function handleHurt(event) {
  const player = event?.hurtEntity;
  if (!isValidPlayer(player)) return;
  system.run(() => tryRandomHarmfulEvent(player, "hurt", { sourceEvent: event }));
}

function handleSpawn(event) {
  const player = event?.player;
  if (!isValidPlayer(player)) return;
  system.runTimeout(() => tryRandomHarmfulEvent(player, "spawn", { sourceEvent: event }), TICKS * 6);
}

function pulse() {
  for (const player of world.getPlayers()) {
    tryRandomHarmfulEvent(player, "pulse");
  }
}

function handleScriptEvent(event) {
  if (event.id !== "paradise:harmful") return;
  const message = String(event.message || "status").trim();
  const [command, arg] = message.split(/\s+/);
  const source = event.sourceEntity || event.initiator;
  const player = isValidPlayer(source) ? source : world.getPlayers()[0];

  if (command === "debug") {
    debugEnabled = arg !== "off";
    world.sendMessage(`§cHarmful event debug ${debugEnabled ? "enabled" : "disabled"}.`);
    return;
  }

  if (command === "restore") {
    const count = restoreAllTemporaryBlocks();
    world.sendMessage(`§aRestored ${count} harmful temporary blocks.`);
    return;
  }

  if (command === "status") {
    world.sendMessage(`§cHarmful events: temporaryBlocks=${temporaryBlocks.length} globalCooldown=${Math.max(0, globalCooldownUntil - tickNow())}`);
    return;
  }

  if (command === "list") {
    world.sendMessage(`§cHarmful events: ${HARMFUL_EVENTS.map((entry) => entry.key).join(", ")}`);
    return;
  }

  if (command === "force" && player) {
    const eventKey = String(arg || "").trim();
    const eventDef = HARMFUL_EVENTS.find((entry) => entry.key.toLowerCase() === eventKey.toLowerCase());
    if (!eventDef) {
      world.sendMessage(`§cUnknown harmful event. Use /scriptevent paradise:harmful list`);
      return;
    }
    const fired = runEvent(player, eventDef, "script", true, {});
    world.sendMessage(fired ? `§aForced harmful event ${eventDef.key}.` : `§cCould not force ${eventDef.key} here.`);
  }
}

export function getHarmfulPlayerEventKeys() {
  return HARMFUL_EVENTS.map((entry) => entry.key);
}

export function restoreAllHarmfulPlayerEvents() {
  return restoreAllTemporaryBlocks();
}

function initializeHarmfulPlayerEvents() {
  if (initialized) return;
  initialized = true;
  world.afterEvents.playerInteractWithBlock.subscribe(handleInteract);
  world.afterEvents.playerBreakBlock.subscribe(handleBreak);
  world.afterEvents.entityHurt.subscribe(handleHurt);
  world.afterEvents.playerSpawn.subscribe(handleSpawn);
  world.afterEvents.playerLeave.subscribe((event) => {
    if (event?.playerId) playerCooldowns.delete(event.playerId);
  });
  system.afterEvents.scriptEventReceive.subscribe(handleScriptEvent, { namespaces: ["paradise"] });
  system.runInterval(pulse, CONFIG.pulseIntervalTicks);
  system.runInterval(cleanupTemporaryBlocks, CONFIG.cleanupIntervalTicks);
  recordTelemetry("harmful_player_event", {
    currentTick: tickNow(),
    source: "harmful_player_events",
    reason: "initialize",
    status: "ready",
    eventCount: HARMFUL_EVENTS.length,
  });
}

system.run(initializeHarmfulPlayerEvents);
