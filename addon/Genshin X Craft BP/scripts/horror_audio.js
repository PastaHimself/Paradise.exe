import { system } from "@minecraft/server";

export const HORROR_SOUND = Object.freeze({
  StalkerBreathFar: "paradise.stalker.breath_far",
  StalkerBreathNear: "paradise.stalker.breath_near",
  StalkerStepBehind: "paradise.stalker.step_behind",
  StalkerWallScratch: "paradise.stalker.wall_scratch",
  StalkerRoarMuffled: "paradise.stalker.roar_muffled",
  AmbientLowHum: "paradise.ambient.low_hum",
  AmbientLightPop: "paradise.ambient.light_pop",
  AmbientRadioNumbers: "paradise.ambient.radio_numbers",
  DimensionYellowHum: "paradise.dimension.yellow_hum",
  DimensionCatacombWhisper: "paradise.dimension.catacomb_whisper",
});

const TICKS_PER_SECOND = 20;
const PLAYER_AUDIO_STATE = new Map();

function currentTick() {
  try {
    return system.currentTick || 0;
  } catch (_error) {
    return 0;
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function pickRandom(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return undefined;
  }
  return values[Math.floor(Math.random() * values.length)];
}

function playerKey(player) {
  return player?.id || player?.name || "unknown";
}

function getAudioState(player) {
  const key = playerKey(player);
  if (!PLAYER_AUDIO_STATE.has(key)) {
    PLAYER_AUDIO_STATE.set(key, {
      cooldowns: new Map(),
      lastSeenTick: currentTick(),
    });
  }

  const state = PLAYER_AUDIO_STATE.get(key);
  state.lastSeenTick = currentTick();
  return state;
}

export function clearPlayerAudioState(playerOrId) {
  const key = typeof playerOrId === "string"
    ? playerOrId
    : playerOrId?.id || playerOrId?.name;
  if (key) PLAYER_AUDIO_STATE.delete(String(key));
}

function canPlay(player, key, cooldownTicks, tick = currentTick()) {
  if (!player || !key) {
    return false;
  }

  const state = getAudioState(player);
  const lastTick = state.cooldowns.get(key) ?? -1000000000;
  if (tick - lastTick < cooldownTicks) {
    return false;
  }

  state.cooldowns.set(key, tick);
  return true;
}

function chance(probability) {
  return Math.random() < clamp(probability, 0, 1);
}

function safeLocation(location) {
  return {
    x: Number(location?.x) || 0,
    y: Number(location?.y) || 0,
    z: Number(location?.z) || 0,
  };
}

function getViewDirection(player) {
  try {
    if (player && typeof player.getViewDirection === "function") {
      return player.getViewDirection();
    }
  } catch (_error) {
    // Fall through to a stable fallback.
  }

  return { x: 0, y: 0, z: 1 };
}

function horizontalDirection(vector) {
  const x = Number(vector?.x) || 0;
  const z = Number(vector?.z) || 0;
  const length = Math.sqrt(x * x + z * z);
  if (length <= 0.0001) {
    return { x: 0, y: 0, z: 1 };
  }

  return { x: x / length, y: 0, z: z / length };
}

export function getPlayerAudioBasis(player) {
  const forward = horizontalDirection(getViewDirection(player));
  return {
    forward,
    back: { x: -forward.x, y: 0, z: -forward.z },
    right: { x: -forward.z, y: 0, z: forward.x },
  };
}

export function pointBehindPlayer(player, distance = 4, sideOffset = 0, yOffset = 0.9) {
  const origin = safeLocation(player?.location);
  const basis = getPlayerAudioBasis(player);
  return {
    x: origin.x + basis.back.x * distance + basis.right.x * sideOffset,
    y: origin.y + yOffset,
    z: origin.z + basis.back.z * distance + basis.right.z * sideOffset,
  };
}

export function pointHiddenNearPlayer(player, options = {}) {
  const behindDistance = randomFloat(options.behindMin ?? 3.5, options.behindMax ?? 9.0);
  const sideMagnitude = randomFloat(options.sideMin ?? 2.5, options.sideMax ?? 6.0);
  const sideSign = Math.random() < 0.5 ? -1 : 1;
  const yOffset = randomFloat(options.yMin ?? 0.2, options.yMax ?? 1.6);
  return pointBehindPlayer(player, behindDistance, sideMagnitude * sideSign, yOffset);
}

function normalizeSoundOptions(options = {}) {
  const soundOptions = {};

  if (options.location) {
    soundOptions.location = safeLocation(options.location);
  }
  if (typeof options.volume === "number") {
    soundOptions.volume = clamp(options.volume, 0, 4);
  }
  if (typeof options.pitch === "number") {
    soundOptions.pitch = clamp(options.pitch, 0.01, 4);
  }

  return soundOptions;
}

export function playForOnePlayer(player, soundId, options = {}) {
  if (!player || !soundId || typeof player.playSound !== "function") {
    return false;
  }

  const soundOptions = normalizeSoundOptions(options);
  try {
    player.playSound(soundId, soundOptions);
    return true;
  } catch (_error) {
    try {
      player.playSound(soundId);
      return true;
    } catch (_fallbackError) {
      return false;
    }
  }
}

export function playAtPosition(playerOrDimension, soundId, location, options = {}) {
  if (playerOrDimension?.dimension && typeof playerOrDimension.playSound === "function") {
    return playForOnePlayer(playerOrDimension, soundId, {
      ...options,
      location,
    });
  }

  const dimension = playerOrDimension?.dimension || playerOrDimension;
  if (!dimension || !soundId || !location || typeof dimension.playSound !== "function") {
    return false;
  }

  const soundOptions = normalizeSoundOptions(options);
  delete soundOptions.location;
  try {
    dimension.playSound(soundId, safeLocation(location), soundOptions);
    return true;
  } catch (_error) {
    return false;
  }
}

export function tryPlayForOnePlayer(player, key, soundId, options = {}, cooldownTicks = TICKS_PER_SECOND * 45) {
  if (!canPlay(player, key, cooldownTicks)) {
    return false;
  }

  if (playForOnePlayer(player, soundId, options)) {
    return true;
  }

  const state = getAudioState(player);
  state.cooldowns.delete(key);
  return false;
}

export function tryPlayAtPosition(player, key, soundId, location, options = {}, cooldownTicks = TICKS_PER_SECOND * 45) {
  if (!canPlay(player, key, cooldownTicks)) {
    return false;
  }

  if (playAtPosition(player, soundId, location, options)) {
    return true;
  }

  const state = getAudioState(player);
  state.cooldowns.delete(key);
  return false;
}

function playerPressure(context = {}) {
  return clamp(
    Number(context.pressure ?? context.heat ?? 0) +
      Math.floor(Number(context.fear ?? 0) * 0.25) +
      Math.floor(Number(context.soundScore ?? 0) * 0.2),
    0,
    100,
  );
}

export function maybePlayStalkerHorrorAudio(player, context = {}) {
  if (!player || !player.dimension || !player.location) {
    return false;
  }

  const phase = String(context.phase || "").toLowerCase();
  const pressure = playerPressure(context);
  const forced = context.force === true;
  const isolated = Number(context.nearbyPlayers ?? 2) <= 1;
  const peakTension = String(context.tensionState || "").toLowerCase() === "peak";
  const highThreat = pressure >= 72 || phase === "pressure" || phase === "ambush" || peakTension;
  const ambushThreat = pressure >= 88 || phase === "ambush";

  if (!forced) {
    const chanceBoost = isolated ? 0.035 : 0;
    const phaseBoost = highThreat ? 0.075 : 0.025;
    if (!chance(phaseBoost + chanceBoost + pressure / 1600)) {
      return false;
    }
  }

  if (!canPlay(player, "stalker:any", forced ? TICKS_PER_SECOND * 6 : TICKS_PER_SECOND * 12)) {
    return false;
  }

  const roll = Math.random();
  if (ambushThreat && (forced || roll < 0.14)) {
    const location = pointHiddenNearPlayer(player, {
      behindMin: 10,
      behindMax: 22,
      sideMin: 5,
      sideMax: 12,
      yMin: 0.0,
      yMax: 2.0,
    });
    return tryPlayAtPosition(
      player,
      "stalker:roar_muffled",
      HORROR_SOUND.StalkerRoarMuffled,
      location,
      { volume: 0.85, pitch: randomFloat(0.68, 0.86) },
      TICKS_PER_SECOND * 150,
    );
  }

  if (highThreat && roll < 0.34) {
    const location = pointBehindPlayer(player, randomFloat(1.15, 2.35), randomFloat(-0.7, 0.7), randomFloat(0.9, 1.45));
    return tryPlayForOnePlayer(
      player,
      "stalker:breath_near",
      HORROR_SOUND.StalkerBreathNear,
      { location, volume: 0.72, pitch: randomFloat(0.82, 1.02) },
      TICKS_PER_SECOND * 55,
    );
  }

  if (roll < 0.58) {
    const location = pointBehindPlayer(player, randomFloat(2.5, 5.0), randomFloat(-1.4, 1.4), randomFloat(0.1, 0.9));
    return tryPlayForOnePlayer(
      player,
      "stalker:step_behind",
      HORROR_SOUND.StalkerStepBehind,
      { location, volume: 0.62, pitch: randomFloat(0.84, 1.08) },
      TICKS_PER_SECOND * 38,
    );
  }

  if (roll < 0.78) {
    const location = pointHiddenNearPlayer(player, {
      behindMin: 3.5,
      behindMax: 8,
      sideMin: 2.5,
      sideMax: 5.5,
      yMin: -0.2,
      yMax: 1.4,
    });
    return tryPlayAtPosition(
      player,
      "stalker:wall_scratch",
      HORROR_SOUND.StalkerWallScratch,
      location,
      { volume: 0.58, pitch: randomFloat(0.75, 1.08) },
      TICKS_PER_SECOND * 50,
    );
  }

  const location = pointBehindPlayer(player, randomFloat(7, 15), randomFloat(-4, 4), randomFloat(0.8, 1.8));
  return tryPlayForOnePlayer(
    player,
    "stalker:breath_far",
    HORROR_SOUND.StalkerBreathFar,
    { location, volume: 0.42, pitch: randomFloat(0.72, 0.95) },
    TICKS_PER_SECOND * 42,
  );
}

export function maybePlayAmbientHorrorAudio(player, context = {}) {
  if (!player || !player.dimension || !player.location) {
    return false;
  }

  const pressure = playerPressure(context);
  const isolated = Number(context.nearbyPlayers ?? 2) <= 1;
  const horrorDimension = context.horrorDimension === true;
  const probability =
    (horrorDimension ? 0.0018 : 0.00055) +
    (isolated ? 0.00055 : 0) +
    pressure / 90000;

  if (!chance(probability)) {
    return false;
  }
  if (!canPlay(player, "ambient:any", TICKS_PER_SECOND * 35)) {
    return false;
  }

  const choices = pressure >= 55
    ? ["radio", "light_pop", "low_hum", "low_hum"]
    : ["light_pop", "low_hum", "low_hum", "low_hum"];
  const choice = pickRandom(choices);

  if (choice === "radio") {
    const location = pointHiddenNearPlayer(player, { behindMin: 4, behindMax: 10, sideMin: 2, sideMax: 7, yMin: 0.8, yMax: 1.8 });
    return tryPlayForOnePlayer(
      player,
      "ambient:radio_numbers",
      HORROR_SOUND.AmbientRadioNumbers,
      { location, volume: 0.38, pitch: randomFloat(0.86, 1.05) },
      TICKS_PER_SECOND * 260,
    );
  }

  if (choice === "light_pop") {
    const location = pointHiddenNearPlayer(player, { behindMin: 2.5, behindMax: 7, sideMin: 2, sideMax: 5, yMin: 1.1, yMax: 2.4 });
    return tryPlayAtPosition(
      player,
      "ambient:light_pop",
      HORROR_SOUND.AmbientLightPop,
      location,
      { volume: 0.5, pitch: randomFloat(0.85, 1.25) },
      TICKS_PER_SECOND * 95,
    );
  }

  return tryPlayForOnePlayer(
    player,
    "ambient:low_hum",
    HORROR_SOUND.AmbientLowHum,
    { location: player.location, volume: 0.26, pitch: randomFloat(0.72, 0.92) },
    TICKS_PER_SECOND * 180,
  );
}

export function maybePlayYellowHallsAudio(player, context = {}) {
  if (!player || !player.dimension || !player.location) {
    return false;
  }

  const confidencePressure = Number(context.confidencePressure ?? 0);
  const probability = context.force === true ? 1 : 0.006 + clamp(confidencePressure, 0, 30) / 6000;
  if (context.force !== true && !chance(probability)) {
    return false;
  }

  const location = pointHiddenNearPlayer(player, { behindMin: 6, behindMax: 14, sideMin: 3, sideMax: 9, yMin: 0.5, yMax: 1.8 });
  return tryPlayForOnePlayer(
    player,
    "dimension:yellow_hum",
    HORROR_SOUND.DimensionYellowHum,
    { location, volume: 0.34, pitch: randomFloat(0.76, 0.94) },
    TICKS_PER_SECOND * 145,
  );
}

export function maybePlayCatacombAudio(player, context = {}) {
  if (!player || !player.dimension || !player.location) {
    return false;
  }

  const pressure = clamp(Number(context.pressure ?? 0), 0, 40);
  const probability = context.force === true ? 1 : 0.004 + pressure / 5000;
  if (context.force !== true && !chance(probability)) {
    return false;
  }
  if (!canPlay(player, "catacomb:any", TICKS_PER_SECOND * 22)) {
    return false;
  }

  const roll = Math.random();
  if (pressure >= 10 && roll < 0.72) {
    const location = pointHiddenNearPlayer(player, { behindMin: 2.5, behindMax: 7.5, sideMin: 2, sideMax: 5.5, yMin: 0.8, yMax: 1.9 });
    return tryPlayForOnePlayer(
      player,
      "catacomb:whisper",
      HORROR_SOUND.DimensionCatacombWhisper,
      { location, volume: 0.45, pitch: randomFloat(0.82, 1.04) },
      TICKS_PER_SECOND * 62,
    );
  }

  if (roll < 0.9) {
    const location = pointHiddenNearPlayer(player, { behindMin: 3, behindMax: 8, sideMin: 2, sideMax: 6, yMin: 0.1, yMax: 1.5 });
    return tryPlayAtPosition(
      player,
      "catacomb:wall_scratch",
      HORROR_SOUND.StalkerWallScratch,
      location,
      { volume: 0.52, pitch: randomFloat(0.72, 0.98) },
      TICKS_PER_SECOND * 58,
    );
  }

  const location = pointHiddenNearPlayer(player, { behindMin: 2, behindMax: 6, sideMin: 1.5, sideMax: 5, yMin: 1.2, yMax: 2.4 });
  return tryPlayAtPosition(
    player,
    "catacomb:light_pop",
    HORROR_SOUND.AmbientLightPop,
    location,
    { volume: 0.42, pitch: randomFloat(0.8, 1.15) },
    TICKS_PER_SECOND * 90,
  );
}
