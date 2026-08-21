import { ItemStack, system } from "@minecraft/server";
import { requestVhsTier, VHS_TIER } from "./paradise_horror_state.js";
import { horrorDirector } from "./horror_director.js";

export { VHS_TIER };

export function currentTick() {
  try {
    return system.currentTick || 0;
  } catch (_error) {
    return 0;
  }
}


function waitTeleportRetryTicks(ticks) {
  return new Promise((resolve) => {
    try {
      system.runTimeout(resolve, Math.max(1, Math.floor(ticks || 1)));
    } catch (_error) {
      resolve();
    }
  });
}

function dimensionIdOf(dimension) {
  try {
    return dimension && typeof dimension.id === "string" ? dimension.id : "";
  } catch (_error) {
    return "";
  }
}

function distanceSquared(a, b) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const dx = Number(a.x) - Number(b.x);
  const dy = Number(a.y) - Number(b.y);
  const dz = Number(a.z) - Number(b.z);
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(dz)) {
    return Number.POSITIVE_INFINITY;
  }
  return dx * dx + dy * dy + dz * dz;
}

function isPlayerAtTeleportTarget(player, location, options = {}, verifyOptions = {}) {
  try {
    if (!player || !player.dimension || !player.location) return false;
    const targetDimension = options.dimension || player.dimension;
    const targetDimensionId = dimensionIdOf(targetDimension);
    const currentDimensionId = dimensionIdOf(player.dimension);
    if (targetDimensionId && currentDimensionId && targetDimensionId !== currentDimensionId) {
      return false;
    }
    const maxDistance = Math.max(1, Number(verifyOptions.maxDistance ?? 48));
    return distanceSquared(player.location, location) <= maxDistance * maxDistance;
  } catch (_error) {
    return false;
  }
}

export async function verifiedPlayerTeleport(player, location, options = {}, verifyOptions = {}) {
  const attempts = Math.max(1, Math.floor(verifyOptions.attempts ?? 6));
  const retryTicks = Math.max(1, Math.floor(verifyOptions.retryTicks ?? 4));
  const firstCheckTicks = Math.max(1, Math.floor(verifyOptions.firstCheckTicks ?? 2));

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      if (!player || typeof player.teleport !== "function") {
        return false;
      }
      player.teleport(location, options);
    } catch (_error) {
      // Retry after the destination dimension/chunk has had another chance to load.
    }

    await waitTeleportRetryTicks(attempt === 0 ? firstCheckTicks : retryTicks);
    if (isPlayerAtTeleportTarget(player, location, options, verifyOptions)) {
      return true;
    }
  }

  return isPlayerAtTeleportTarget(player, location, options, verifyOptions);
}

export function getOrCreateRuleState(map, playerId, factory = () => ({})) {
  if (!map.has(playerId)) {
    map.set(playerId, factory());
  }
  return map.get(playerId);
}

export function clearRuleState(map, playerId) {
  map.delete(playerId);
}

export function isTriggerReady(ruleState, key, cooldownTicks, tick = currentTick()) {
  if (!ruleState.cooldowns) {
    ruleState.cooldowns = new Map();
  }
  const lastTick = ruleState.cooldowns.get(key) ?? -1000000000;
  return tick - lastTick >= cooldownTicks;
}

export function markTrigger(ruleState, key, tick = currentTick()) {
  if (!ruleState.cooldowns) {
    ruleState.cooldowns = new Map();
  }
  ruleState.cooldowns.set(key, tick);
}

export function canTrigger(ruleState, key, cooldownTicks, tick = currentTick()) {
  if (!isTriggerReady(ruleState, key, cooldownTicks, tick)) {
    return false;
  }
  markTrigger(ruleState, key, tick);
  return true;
}

export function tryBeginRuleScare(player, ruleState, key, cooldownTicks, request = {}) {
  const tick = currentTick();
  if (!isTriggerReady(ruleState, key, cooldownTicks, tick)) {
    return {
      allowed: false,
      reason: "rule_cooldown",
      phase: horrorDirector.getSnapshot(tick).phase,
    };
  }

  const decision = horrorDirector.tryBeginScare(player, {
    currentTick: tick,
    ...request,
  });
  if (decision.allowed) {
    markTrigger(ruleState, key, tick);
  }
  return decision;
}

export function sampleMotion(ruleState, location, tick = currentTick()) {
  const last = ruleState.lastMotionSample;
  const current = {
    x: Number(location.x) || 0,
    y: Number(location.y) || 0,
    z: Number(location.z) || 0,
    tick,
  };

  ruleState.lastMotionSample = current;

  if (!last || tick <= last.tick) {
    return {
      dx: 0,
      dy: 0,
      dz: 0,
      dt: 1,
      horizontalDistance: 0,
      horizontalSpeed: 0,
      moved: false,
      forwardDot: 0,
      straight: false,
    };
  }

  const dx = current.x - last.x;
  const dy = current.y - last.y;
  const dz = current.z - last.z;
  const dt = Math.max(1, tick - last.tick);
  const horizontalDistance = Math.sqrt(dx * dx + dz * dz);
  const horizontalSpeed = horizontalDistance / dt;

  let forwardDot = 0;
  let straight = false;
  if (horizontalDistance > 0.03) {
    const dir = { x: dx / horizontalDistance, z: dz / horizontalDistance };
    if (ruleState.lastMoveDirection) {
      forwardDot = dir.x * ruleState.lastMoveDirection.x + dir.z * ruleState.lastMoveDirection.z;
      straight = forwardDot > 0.92;
    }
    ruleState.lastMoveDirection = dir;
  }

  return {
    dx,
    dy,
    dz,
    dt,
    horizontalDistance,
    horizontalSpeed,
    moved: horizontalDistance > 0.03,
    forwardDot,
    straight,
  };
}

export function rememberLocation(ruleState, location, limit = 8) {
  if (!ruleState.recentLocations) {
    ruleState.recentLocations = [];
  }
  const remembered = {
    x: Math.floor(location.x) + 0.5,
    y: location.y,
    z: Math.floor(location.z) + 0.5,
  };
  ruleState.recentLocations.push(remembered);
  while (ruleState.recentLocations.length > limit) {
    ruleState.recentLocations.shift();
  }
  return remembered;
}

export function pickRememberedLocation(ruleState, fallback) {
  const list = ruleState.recentLocations || [];
  if (list.length >= 2) {
    return list[Math.max(0, list.length - 2)];
  }
  if (list.length === 1) {
    return list[0];
  }
  return fallback;
}

export function safePlaySound(dimension, soundId, location, options = {}) {
  try {
    if (dimension && typeof dimension.playSound === "function") {
      dimension.playSound(soundId, location, options);
      return true;
    }
  } catch (_error) {}
  return false;
}

export function safeSpawnParticle(dimension, particleId, location) {
  try {
    if (dimension && typeof dimension.spawnParticle === "function") {
      dimension.spawnParticle(particleId, location);
      return true;
    }
  } catch (_error) {}
  return false;
}

export function safeAddEffect(player, effectId, durationTicks, options = {}) {
  try {
    if (player && typeof player.addEffect === "function") {
      player.addEffect(effectId, durationTicks, options);
      return true;
    }
  } catch (_error) {}
  return false;
}

export function safeTitle(player, title, subtitle = "", stayDuration = 35) {
  try {
    if (player && player.onScreenDisplay) {
      player.onScreenDisplay.setTitle(title, {
        subtitle,
        fadeInDuration: 4,
        stayDuration,
        fadeOutDuration: 8,
      });
      return true;
    }
  } catch (_error) {}
  return false;
}

export function safeActionBar(player, message) {
  try {
    if (player && player.onScreenDisplay && typeof player.onScreenDisplay.setActionBar === "function") {
      player.onScreenDisplay.setActionBar(message);
      return true;
    }
  } catch (_error) {}
  return false;
}

/**
 * @typedef {"PARADISE_VHS_OFF" | "PARADISE_VHS_LOW" | "PARADISE_VHS_HIGH" | "PARADISE_VHS_PANIC"} ParadiseVhsTier
 */

/**
 * Requests a VHS overlay tier from a dimension rule.
 *
 * @param {any} player
 * @param {ParadiseVhsTier} [tier]
 * @param {number} [durationTicks]
 * @param {string} [reason]
 * @returns {boolean}
 */
export function requestRuleVhs(player, tier = VHS_TIER.Low, durationTicks = 20 * 5, reason = "dimension-rule") {
  try {
    return requestVhsTier(player, tier, currentTick(), durationTicks, reason);
  } catch (_error) {
    return false;
  }
}

export function setStandingSign(dimension, location, text, blockTypeId = "minecraft:oak_sign") {
  try {
    const pos = {
      x: Math.floor(location.x),
      y: Math.floor(location.y),
      z: Math.floor(location.z),
    };
    dimension.setBlockType(pos, blockTypeId);
    const block = dimension.getBlock(pos);
    const sign = block ? block.getComponent("minecraft:sign") : undefined;
    if (sign && typeof sign.setText === "function") {
      sign.setText(String(text).slice(0, 120));
      if (typeof sign.setWaxed === "function") {
        sign.setWaxed(true);
      }
    }
    return true;
  } catch (_error) {
    return false;
  }
}

export function makeNoteItem(title, loreLines = []) {
  try {
    const item = new ItemStack("minecraft:paper", 1);
    item.nameTag = title;
    if (typeof item.setLore === "function") {
      item.setLore(loreLines.map((line) => String(line)));
    }
    return item;
  } catch (_error) {
    return undefined;
  }
}
