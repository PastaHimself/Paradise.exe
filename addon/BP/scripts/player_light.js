import { EquipmentSlot, ItemStack, system, world } from "@minecraft/server";
import { getCachedPlayers } from "./paradise_tick_cache.js";
import { getPlayerHorrorSnapshot, isTimerActive } from "./paradise_player_horror_state.js";

const ORPHAN_CLEANUP_RADIUS_XZ = 12;
const ORPHAN_CLEANUP_RADIUS_Y = 4;

// Held/offhand flashlight lighting. Instead of a weak single glow at the player's feet,
// this projects a bright line of temporary light blocks in the player's view
// direction with a small spill cone so it reads like a flashlight beam.
const LIGHT_BLOCK = "minecraft:light_block_15";
const LEGACY_LIGHT_BLOCK = "minecraft:light_block_7";
const AIR_BLOCK = "minecraft:air";
const MANAGED_LIGHT_BLOCKS = new Set([LIGHT_BLOCK, LEGACY_LIGHT_BLOCK]);
const AIR_BLOCKS = new Set(["minecraft:air", "minecraft:cave_air", "minecraft:void_air"]);
const TICK_INTERVAL = 2;
const MAX_BATTERY_TICKS = 20 * 120;
const RECHARGE_PER_TICK = 3;
const SIGNAL_INTERVAL_TICKS = 20 * 4;
const FLASHLIGHT_BEAM_LENGTH = 10;
const FLASHLIGHT_EYE_OFFSET = 1.45;
const FLASHLIGHT_SPILL_START_DISTANCE = 3;
const FLASHLIGHT_WIDE_START_DISTANCE = 6;

const FLASHLIGHT_OFF_ITEM = "paradise:flashlight";
const FLASHLIGHT_ON_ITEM = "paradise:flashlight_on";
const FLASHLIGHT_ITEMS = new Set([FLASHLIGHT_OFF_ITEM, FLASHLIGHT_ON_ITEM]);
const FLASHLIGHT_SWITCH_SOUND = "paradise.flashlight.switch";
const TOGGLE_DEBOUNCE_TICKS = 4;

const FLASHLIGHT_DANGER = Object.freeze({
  lowBatteryFlickerStartRatio: 0.38,
  criticalBatteryFlickerRatio: 0.12,
  watcherFlickerRadius: 28,
  watcherPanicRadius: 6,
  flickerBurstMinTicks: 2,
  flickerBurstMaxTicks: 10,
  flickerGapMinTicks: 5,
  flickerGapMaxTicks: 36,
  powerOnFailureStartRatio: 0.55,
  powerOnFailureMinChance: 0.015,
  powerOnFailureMaxChance: 0.22,
  powerOnFailureCooldownTicks: 12,
});

const trackedLights = new Map();
const playerLightState = new Map();

function posKey(x, y, z) {
  return `${x},${y},${z}`;
}

function getPlayerId(player) {
  return player?.id || player?.name || "unknown";
}

function getPlayerLightState(player) {
  const id = getPlayerId(player);
  let state = playerLightState.get(id);
  if (!state) {
    state = {
      batteryTicks: MAX_BATTERY_TICKS,
      enabled: false,
      nextSignalTick: 0,
      lastToggleTick: -TOGGLE_DEBOUNCE_TICKS,
      nextToggleTick: 0,
      nextFlickerWindowTick: 0,
      flickerUntilTick: 0,
      wasActive: false,
    };
    playerLightState.set(id, state);
  }
  return state;
}

function getEquipmentSlotItemTypeId(equippable, slotCandidates) {
  for (const slot of slotCandidates) {
    if (slot === undefined || slot === null) {
      continue;
    }

    try {
      const item = equippable?.getEquipment?.(slot);
      if (item?.typeId) {
        return item.typeId;
      }
    } catch (_error) {
    }
  }

  return undefined;
}

function getHeldItemTypeId(player) {
  try {
    const equippable = player.getComponent("minecraft:equippable") || player.getComponent("equippable");
    const mainhand = getEquipmentSlotItemTypeId(equippable, [EquipmentSlot.Mainhand, "Mainhand", "mainhand"]);
    if (FLASHLIGHT_ITEMS.has(mainhand)) {
      return mainhand;
    }

    const offhand = getEquipmentSlotItemTypeId(equippable, [EquipmentSlot.Offhand, "Offhand", "offhand"]);
    if (FLASHLIGHT_ITEMS.has(offhand)) {
      return offhand;
    }
    return mainhand || offhand;
  } catch (_error) {
    return undefined;
  }
}

function isHoldingLightItem(player) {
  return FLASHLIGHT_ITEMS.has(String(getHeldItemTypeId(player) || ""));
}

function isFlashlightItem(itemStack) {
  return FLASHLIGHT_ITEMS.has(itemStack?.typeId);
}

function copyStackPresentation(source, target) {
  try {
    if (source?.nameTag) target.nameTag = source.nameTag;
  } catch (_error) {}
  try {
    const lore = source?.getLore?.();
    if (Array.isArray(lore) && lore.length) target.setLore(lore);
  } catch (_error) {}
  return target;
}

function setHeldFlashlightVariant(player, enabled) {
  const desiredType = enabled ? FLASHLIGHT_ON_ITEM : FLASHLIGHT_OFF_ITEM;
  try {
    const equippable = player.getComponent("minecraft:equippable") || player.getComponent("equippable");
    const slots = [EquipmentSlot.Mainhand, EquipmentSlot.Offhand, "Mainhand", "Offhand", "mainhand", "offhand"];
    for (const slot of slots) {
      if (slot === undefined || slot === null) continue;
      try {
        const current = equippable?.getEquipment?.(slot);
        if (!FLASHLIGHT_ITEMS.has(current?.typeId)) continue;
        if (current.typeId === desiredType) return true;
        const replacement = copyStackPresentation(current, new ItemStack(desiredType, 1));
        if (equippable?.setEquipment?.(slot, replacement) !== false) return true;
      } catch (_error) {}
    }
  } catch (_error) {}

  try {
    const container = getInventoryContainer(player);
    const selected = Number(player.selectedSlotIndex) || 0;
    const current = container?.getItem?.(selected);
    if (FLASHLIGHT_ITEMS.has(current?.typeId)) {
      container.setItem(selected, copyStackPresentation(current, new ItemStack(desiredType, 1)));
      return true;
    }
  } catch (_error) {}
  return false;
}

function playFlashlightToggleSound(player, enabled, failed = false) {
  const options = {
    volume: failed ? 0.75 : 0.9,
    pitch: failed ? 0.68 : enabled ? 1.08 : 0.92,
  };

  try {
    if (typeof player?.playSound === "function") {
      player.playSound(FLASHLIGHT_SWITCH_SOUND, options);
      return;
    }
  } catch (_error) {
  }

  try {
    if (typeof player?.dimension?.playSound === "function") {
      player.dimension.playSound(FLASHLIGHT_SWITCH_SOUND, player.location, options);
    }
  } catch (_error) {
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomInt(min, max) {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

function getBatteryRatio(state) {
  return clamp(state.batteryTicks / MAX_BATTERY_TICKS, 0, 1);
}

function shouldFailPowerOn(state) {
  if (state.batteryTicks <= 0) {
    return true;
  }

  const batteryRatio = getBatteryRatio(state);
  const lowBatteryAmount = clamp(
    (FLASHLIGHT_DANGER.powerOnFailureStartRatio - batteryRatio) / FLASHLIGHT_DANGER.powerOnFailureStartRatio,
    0,
    1
  );
  if (lowBatteryAmount <= 0) {
    return Math.random() < FLASHLIGHT_DANGER.powerOnFailureMinChance;
  }

  const chance = FLASHLIGHT_DANGER.powerOnFailureMinChance +
    (FLASHLIGHT_DANGER.powerOnFailureMaxChance - FLASHLIGHT_DANGER.powerOnFailureMinChance) * lowBatteryAmount * lowBatteryAmount;
  return Math.random() < chance;
}

function toggleFlashlight(player) {
  try {
    if (!player?.isValid || !isHoldingLightItem(player)) {
      return;
    }

    const state = getPlayerLightState(player);
    const currentTick = system.currentTick ?? 0;
    if (currentTick < state.nextToggleTick || currentTick - state.lastToggleTick < TOGGLE_DEBOUNCE_TICKS) {
      return;
    }

    state.lastToggleTick = currentTick;
    const currentlyOn = getHeldItemTypeId(player) === FLASHLIGHT_ON_ITEM;
    const turningOn = !currentlyOn;

    if (turningOn && shouldFailPowerOn(state)) {
      state.enabled = false;
      setHeldFlashlightVariant(player, false);
      playFlashlightToggleSound(player, true, true);
      signalWatcherToggle(player, false, currentTick, true);
      state.nextToggleTick = currentTick + FLASHLIGHT_DANGER.powerOnFailureCooldownTicks;
      state.wasActive = false;
      return;
    }

    state.enabled = turningOn;
    setHeldFlashlightVariant(player, state.enabled);
    state.nextToggleTick = currentTick + TOGGLE_DEBOUNCE_TICKS;
    playFlashlightToggleSound(player, state.enabled);
    signalWatcherToggle(player, state.enabled, currentTick, false);
    if (!state.enabled) {
      state.wasActive = false;
      state.flickerUntilTick = 0;
    }
  } catch (_error) {
  }
}

function handleFlashlightUse(event) {
  const itemStack = event?.beforeItemStack ?? event?.itemStack;
  if (!isFlashlightItem(itemStack)) {
    return;
  }

  const player = event?.source ?? event?.player;
  if (!player?.isValid || player.typeId !== "minecraft:player") {
    return;
  }

  // Defer the state mutation so item-use handlers never interfere with the
  // current event stack. Some @minecraft/server versions expose itemUse but not
  // itemUseOn, so subscriptions are guarded below.
  system.run(() => toggleFlashlight(player));
}

function subscribeAfterEvent(eventSignal, handler) {
  try {
    if (eventSignal?.subscribe) {
      eventSignal.subscribe(handler);
    }
  } catch (_error) {
  }
}

function getInventoryContainer(player) {
  try {
    return player.getComponent("minecraft:inventory")?.container || player.getComponent("inventory")?.container;
  } catch (_error) {
    return undefined;
  }
}

function hasFlashlight(player) {
  try {
    const container = getInventoryContainer(player);
    if (!container) {
      return false;
    }

    for (let slot = 0; slot < container.size; slot++) {
      const item = container.getItem(slot);
      if (FLASHLIGHT_ITEMS.has(item?.typeId)) {
        return true;
      }
    }
  } catch (_error) {
  }

  return false;
}

function giveFlashlightIfMissing(player) {
  try {
    if (!player?.isValid || hasFlashlight(player)) {
      return;
    }

    const container = getInventoryContainer(player);
    if (!container) {
      return;
    }

    container.addItem(new ItemStack(FLASHLIGHT_OFF_ITEM, 1));
  } catch (_error) {
  }
}

function normalizeVector(vector, fallback = { x: 0, y: 0, z: 1 }) {
  const x = Number(vector?.x) || 0;
  const y = Number(vector?.y) || 0;
  const z = Number(vector?.z) || 0;
  const length = Math.sqrt(x * x + y * y + z * z);
  if (length <= 0.0001) {
    return fallback;
  }

  return { x: x / length, y: y / length, z: z / length };
}

function yawPitchToVector(rotation) {
  const pitch = (Number(rotation?.x) || 0) * Math.PI / 180;
  const yaw = (Number(rotation?.y) || 0) * Math.PI / 180;
  return {
    x: -Math.sin(yaw) * Math.cos(pitch),
    y: -Math.sin(pitch),
    z: Math.cos(yaw) * Math.cos(pitch),
  };
}

function getPlayerViewDirection(player) {
  // Player rotation remains tied to the character's aim in first-person,
  // third-person back, and third-person front. Prefer it so the projected
  // light does not follow the external camera orbit in alternate perspectives.
  try {
    if (typeof player?.getRotation === "function") {
      return normalizeVector(yawPitchToVector(player.getRotation()));
    }
  } catch (_error) {
  }

  try {
    if (typeof player?.getViewDirection === "function") {
      return normalizeVector(player.getViewDirection());
    }
  } catch (_error) {
  }

  return { x: 0, y: 0, z: 1 };
}

function blockPosition(location) {
  return {
    x: Math.floor(location.x),
    y: Math.floor(location.y),
    z: Math.floor(location.z),
  };
}

function isManagedLightType(typeId) {
  return MANAGED_LIGHT_BLOCKS.has(typeId);
}

function isLightReplaceableBlock(block) {
  return block && (AIR_BLOCKS.has(block.typeId) || isManagedLightType(block.typeId));
}

function canPlaceLightAt(dimension, x, y, z) {
  try {
    return isLightReplaceableBlock(dimension.getBlock({ x, y, z }));
  } catch (_error) {
    return false;
  }
}

function setLightIfReplaceable(dimension, x, y, z) {
  try {
    const block = dimension.getBlock({ x, y, z });
    if (isLightReplaceableBlock(block)) {
      block.setType(LIGHT_BLOCK);
    }
  } catch (_error) {
  }
}

function addBeamLight(positions, seen, dimension, location) {
  const pos = blockPosition(location);
  const key = posKey(pos.x, pos.y, pos.z);
  if (seen.has(key) || !canPlaceLightAt(dimension, pos.x, pos.y, pos.z)) {
    return false;
  }

  seen.add(key);
  positions.push(pos);
  return true;
}

function getPlayerLightPositions(player) {
  const direction = getPlayerViewDirection(player);
  const horizontal = normalizeVector({ x: direction.x, y: 0, z: direction.z }, { x: 0, y: 0, z: 1 });
  const right = { x: -horizontal.z, y: 0, z: horizontal.x };
  const origin = {
    x: player.location.x,
    y: player.location.y + FLASHLIGHT_EYE_OFFSET,
    z: player.location.z,
  };

  const positions = [];
  const seen = new Set();
  addBeamLight(positions, seen, player.dimension, origin);

  for (let distance = 1; distance <= FLASHLIGHT_BEAM_LENGTH; distance++) {
    const center = {
      x: origin.x + direction.x * distance,
      y: origin.y + direction.y * distance,
      z: origin.z + direction.z * distance,
    };
    const centerPos = blockPosition(center);

    // Stop the main beam when it hits a solid block so it does not light rooms
    // through walls. Side spill still only appears in replaceable air.
    if (!canPlaceLightAt(player.dimension, centerPos.x, centerPos.y, centerPos.z)) {
      break;
    }

    addBeamLight(positions, seen, player.dimension, center);

    if (distance >= FLASHLIGHT_SPILL_START_DISTANCE) {
      const sideOffset = distance >= FLASHLIGHT_WIDE_START_DISTANCE ? 1.15 : 0.85;
      addBeamLight(positions, seen, player.dimension, {
        x: center.x + right.x * sideOffset,
        y: center.y,
        z: center.z + right.z * sideOffset,
      });
      addBeamLight(positions, seen, player.dimension, {
        x: center.x - right.x * sideOffset,
        y: center.y,
        z: center.z - right.z * sideOffset,
      });
    }

    if (distance >= FLASHLIGHT_WIDE_START_DISTANCE) {
      addBeamLight(positions, seen, player.dimension, {
        x: center.x,
        y: center.y - 0.9,
        z: center.z,
      });
    }
  }

  return positions;
}

function removeLight(dimension, x, y, z) {
  try {
    const block = dimension.getBlock({ x, y, z });
    if (block && isManagedLightType(block.typeId)) {
      block.setType(AIR_BLOCK);
    }
  } catch (_error) {
  }
}

function distanceSquared(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

function getWatcherProximity(player) {
  try {
    const watchers = player.dimension.getEntities({
      type: "paradise:watcher",
      location: player.location,
      maxDistance: FLASHLIGHT_DANGER.watcherFlickerRadius,
    });

    let nearestDistanceSquared = Infinity;
    for (const watcher of watchers) {
      const distSq = distanceSquared(watcher.location, player.location);
      if (distSq < nearestDistanceSquared) {
        nearestDistanceSquared = distSq;
      }
    }

    if (!Number.isFinite(nearestDistanceSquared)) {
      return { distance: Infinity, intensity: 0 };
    }

    const distance = Math.sqrt(nearestDistanceSquared);
    const dangerRange = Math.max(1, FLASHLIGHT_DANGER.watcherFlickerRadius - FLASHLIGHT_DANGER.watcherPanicRadius);
    const intensity = 1 - clamp((distance - FLASHLIGHT_DANGER.watcherPanicRadius) / dangerRange, 0, 1);
    return { distance, intensity: intensity * intensity };
  } catch (_error) {
    return { distance: Infinity, intensity: 0 };
  }
}

function getLowBatteryFlickerIntensity(state) {
  const batteryRatio = getBatteryRatio(state);
  const range = Math.max(0.01, FLASHLIGHT_DANGER.lowBatteryFlickerStartRatio - FLASHLIGHT_DANGER.criticalBatteryFlickerRatio);
  const lowAmount = clamp((FLASHLIGHT_DANGER.lowBatteryFlickerStartRatio - batteryRatio) / range, 0, 1);
  return lowAmount * lowAmount;
}

function getFlashlightFlickerIntensity(player, state, currentTick = system.currentTick || 0) {
  const batteryIntensity = getLowBatteryFlickerIntensity(state);
  const watcherIntensity = getWatcherProximity(player).intensity;
  let horrorInterference = 0;

  try {
    const horrorState = getPlayerHorrorSnapshot(player, currentTick);
    if (horrorState.flashlightInterferenceUntilTick > currentTick) {
      const remaining = horrorState.flashlightInterferenceUntilTick - currentTick;
      horrorInterference = clamp(0.22 + remaining / (20 * 24), 0.22, 0.72);
    }
    if (horrorState.panicUntilTick > currentTick) {
      horrorInterference = Math.max(horrorInterference, 0.55);
    }
  } catch (_error) {
  }

  return clamp(batteryIntensity * 0.65 + watcherIntensity * 0.75 + horrorInterference, 0, 1);
}

function shouldForceFlashlightDropout(player, currentTick) {
  try {
    return isTimerActive(player, "panicUntilTick", currentTick) && Math.random() < 0.10;
  } catch (_error) {
    return false;
  }
}

function shouldLightFlicker(player, state, currentTick) {
  if (shouldForceFlashlightDropout(player, currentTick)) {
    state.flickerUntilTick = Math.max(state.flickerUntilTick || 0, currentTick + randomInt(2, 8));
    state.nextFlickerWindowTick = Math.max(state.nextFlickerWindowTick || 0, currentTick + randomInt(10, 30));
    return true;
  }

  const intensity = getFlashlightFlickerIntensity(player, state, currentTick);
  if (intensity <= 0.01) {
    state.nextFlickerWindowTick = currentTick;
    state.flickerUntilTick = 0;
    return false;
  }

  if (currentTick < state.flickerUntilTick) {
    return true;
  }

  if (currentTick < state.nextFlickerWindowTick) {
    return false;
  }

  const burstMax = FLASHLIGHT_DANGER.flickerBurstMinTicks +
    Math.floor((FLASHLIGHT_DANGER.flickerBurstMaxTicks - FLASHLIGHT_DANGER.flickerBurstMinTicks) * intensity);
  const gapMax = FLASHLIGHT_DANGER.flickerGapMaxTicks -
    Math.floor((FLASHLIGHT_DANGER.flickerGapMaxTicks - FLASHLIGHT_DANGER.flickerGapMinTicks) * intensity);

  const burstTicks = randomInt(FLASHLIGHT_DANGER.flickerBurstMinTicks, Math.max(FLASHLIGHT_DANGER.flickerBurstMinTicks, burstMax));
  const gapTicks = randomInt(FLASHLIGHT_DANGER.flickerGapMinTicks, Math.max(FLASHLIGHT_DANGER.flickerGapMinTicks, gapMax));

  // Flicker is burst-scheduled instead of per-tick coin-flipped so it reads as unstable hardware.
  state.flickerUntilTick = currentTick + burstTicks;
  state.nextFlickerWindowTick = currentTick + burstTicks + gapTicks;
  return true;
}

function signalWatcher(player, message) {
  try {
    // Running the command from the player gives watcher_stalker.js a source
    // entity for the `paradise:watcher` script event when supported.
    player.runCommand(`scriptevent paradise:watcher ${message}`);
  } catch (_error) {
    // Flashlight behavior still works if script-event command execution is unavailable.
  }
}

function signalWatcherLightUse(player, state, currentTick) {
  if (currentTick < state.nextSignalTick) {
    return;
  }
  state.nextSignalTick = currentTick + SIGNAL_INTERVAL_TICKS;
  signalWatcher(player, "light");
}

function signalWatcherToggle(player, enabled, currentTick, failed) {
  signalWatcher(player, failed ? "light_toggle_fail" : enabled ? "light_toggle_on" : "light_toggle_off");
}

function tickPlayerLight() {
  const players = getCachedPlayers();
  const currentLights = new Map();
  const currentTick = system.currentTick || 0;

  for (const player of players) {
    if (!player.isValid) continue;

    const state = getPlayerLightState(player);
    const heldType = getHeldItemTypeId(player);
    const holdingLight = FLASHLIGHT_ITEMS.has(heldType);
    state.enabled = heldType === FLASHLIGHT_ON_ITEM;
    if (state.enabled && state.batteryTicks <= 0) {
      state.enabled = false;
      setHeldFlashlightVariant(player, false);
      playFlashlightToggleSound(player, false, true);
    }
    const active = holdingLight && state.enabled && state.batteryTicks > 0;

    if (!active) {
      state.wasActive = false;
      state.flickerUntilTick = 0;
      state.batteryTicks = Math.min(MAX_BATTERY_TICKS, state.batteryTicks + RECHARGE_PER_TICK * TICK_INTERVAL);
      continue;
    }

    state.wasActive = true;
    state.batteryTicks = Math.max(0, state.batteryTicks - TICK_INTERVAL);
    signalWatcherLightUse(player, state, currentTick);

    if (shouldLightFlicker(player, state, currentTick)) {
      continue;
    }

    const dimension = player.dimension;
    const dimId = dimension.id;
    const positions = getPlayerLightPositions(player);

    if (!currentLights.has(dimId)) {
      currentLights.set(dimId, new Set());
    }
    const dimCurrent = currentLights.get(dimId);

    for (const pos of positions) {
      const key = posKey(pos.x, pos.y, pos.z);
      dimCurrent.add(key);
      setLightIfReplaceable(dimension, pos.x, pos.y, pos.z);
    }
  }

  for (const [dimId, trackedSet] of trackedLights) {
    const dimCurrent = currentLights.get(dimId);
    const dimension = world.getDimension(dimId);

    for (const key of trackedSet) {
      if (!dimCurrent || !dimCurrent.has(key)) {
        const [x, y, z] = key.split(",").map(Number);
        removeLight(dimension, x, y, z);
      }
    }
  }

  trackedLights.clear();
  for (const [dimId, set] of currentLights) {
    trackedLights.set(dimId, new Set(set));
  }
}

function cleanupOrphanedLights(player) {
  try {
    const dim = player.dimension;
    const cx = Math.floor(player.location.x);
    const cy = Math.floor(player.location.y);
    const cz = Math.floor(player.location.z);

    for (let dx = -ORPHAN_CLEANUP_RADIUS_XZ; dx <= ORPHAN_CLEANUP_RADIUS_XZ; dx++) {
      for (let dy = -ORPHAN_CLEANUP_RADIUS_Y; dy <= ORPHAN_CLEANUP_RADIUS_Y; dy++) {
        for (let dz = -ORPHAN_CLEANUP_RADIUS_XZ; dz <= ORPHAN_CLEANUP_RADIUS_XZ; dz++) {
          const x = cx + dx;
          const y = cy + dy;
          const z = cz + dz;
          removeLight(dim, x, y, z);
        }
      }
    }
  } catch (_error) {
  }
}

world.afterEvents.playerSpawn.subscribe((event) => {
  const player = event.player;
  cleanupOrphanedLights(player);
  system.run(() => giveFlashlightIfMissing(player));
});

subscribeAfterEvent(world.afterEvents.itemUse, handleFlashlightUse);
subscribeAfterEvent(world.afterEvents.playerInteractWithBlock, handleFlashlightUse);

system.runInterval(tickPlayerLight, TICK_INTERVAL);
