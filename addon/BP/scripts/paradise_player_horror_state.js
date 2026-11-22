import { recordPlayerTelemetry } from "./paradise_telemetry.js";

const MAX_FEAR = 100;
const DECAY_INTERVAL_TICKS = 20 * 18;
const DEFAULT_LIMIT_TICKS = 20 * 6;

const playerStates = new Map();

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function tickNow(explicitTick) {
  const tick = Number(explicitTick);
  return Number.isFinite(tick) ? Math.max(0, Math.floor(tick)) : 0;
}

function playerIdOf(playerOrId) {
  if (typeof playerOrId === "string") {
    return playerOrId || "unknown";
  }
  return String(playerOrId?.id || playerOrId?.name || "unknown");
}

function makeDefaultState(currentTick = 0) {
  return {
    fearScore: 0,
    panicUntilTick: 0,
    flashlightInterferenceUntilTick: 0,
    movementPenaltyUntilTick: 0,
    visionDistortionUntilTick: 0,
    hearingDistortionUntilTick: 0,
    dimensionShockCooldownUntilTick: 0,
    stalkerAttentionLevel: 0,
    baseThreatLevel: 0,
    baseViolationCount: 0,
    ignoredWarningCount: 0,
    lastBaseEventTick: 0,
    reliefUntilTick: 0,
    lastMajorScareTick: 0,
    lastEventKeys: [],
    lastUpdatedTick: tickNow(currentTick),
    lastDecayTick: tickNow(currentTick),
  };
}

function copyState(state) {
  return {
    ...state,
    lastEventKeys: [...(state.lastEventKeys || [])],
  };
}

function decayState(state, currentTick) {
  const tick = tickNow(currentTick);
  if (!Number.isFinite(state.lastDecayTick)) {
    state.lastDecayTick = Number.isFinite(state.lastUpdatedTick) ? state.lastUpdatedTick : tick;
  }

  const elapsed = tick - state.lastDecayTick;
  if (elapsed >= DECAY_INTERVAL_TICKS) {
    const steps = Math.floor(elapsed / DECAY_INTERVAL_TICKS);
    state.fearScore = clamp(state.fearScore - steps, 0, MAX_FEAR);
    state.stalkerAttentionLevel = clamp(state.stalkerAttentionLevel - steps, 0, MAX_FEAR);
    state.lastDecayTick += steps * DECAY_INTERVAL_TICKS;
  }

  if (tick >= (state.lastUpdatedTick || 0)) {
    state.lastUpdatedTick = tick;
  }
}

export function getPlayerHorrorState(playerOrId, currentTick = 0) {
  const playerId = playerIdOf(playerOrId);
  let state = playerStates.get(playerId);
  if (!state) {
    state = makeDefaultState(currentTick);
    playerStates.set(playerId, state);
  }
  decayState(state, currentTick);
  return state;
}

export function getPlayerHorrorSnapshot(playerOrId, currentTick = 0) {
  return copyState(getPlayerHorrorState(playerOrId, currentTick));
}

export function resetPlayerHorrorState(playerOrId) {
  playerStates.delete(playerIdOf(playerOrId));
}

export function clearStalePlayerHorrorStates(activePlayerIds = []) {
  const active = new Set(activePlayerIds.map((id) => String(id)));
  for (const playerId of playerStates.keys()) {
    if (!active.has(playerId)) {
      playerStates.delete(playerId);
    }
  }
}

export function getConsequenceProfile(category = "ambient", intensity = 1) {
  const normalized = String(category || "ambient").toLowerCase();
  const value = clamp(Number(intensity) || 1, 1, 5);

  if (normalized === "panic" || value >= 5) {
    return {
      category: "panic",
      fear: 30,
      stalkerAttention: 24,
      panicTicks: 20 * 12,
      flashlightInterferenceTicks: 20 * 16,
      movementPenaltyTicks: 20 * 4,
      visionDistortionTicks: 20 * 10,
      hearingDistortionTicks: 20 * 10,
      reliefTicks: 20 * 45,
      major: true,
    };
  }

  if (normalized === "major" || value >= 4) {
    return {
      category: "major",
      fear: 20,
      stalkerAttention: 16,
      panicTicks: 20 * 6,
      flashlightInterferenceTicks: 20 * 10,
      movementPenaltyTicks: 20 * 2,
      visionDistortionTicks: 20 * 7,
      hearingDistortionTicks: 20 * 5,
      reliefTicks: 20 * 30,
      major: true,
    };
  }

  if (normalized === "pressure" || value >= 3) {
    return {
      category: "pressure",
      fear: 10,
      stalkerAttention: 10,
      panicTicks: 0,
      flashlightInterferenceTicks: 20 * 6,
      movementPenaltyTicks: 20 * 2,
      visionDistortionTicks: 20 * 4,
      hearingDistortionTicks: 20 * 4,
      reliefTicks: 0,
      major: false,
    };
  }

  if (normalized === "buildup" || value >= 2) {
    return {
      category: "buildup",
      fear: 5,
      stalkerAttention: 6,
      panicTicks: 0,
      flashlightInterferenceTicks: 20 * 3,
      movementPenaltyTicks: 0,
      visionDistortionTicks: 0,
      hearingDistortionTicks: 20 * 2,
      reliefTicks: 0,
      major: false,
    };
  }

  return {
    category: "ambient",
    fear: 2,
    stalkerAttention: 1,
    panicTicks: 0,
    flashlightInterferenceTicks: 0,
    movementPenaltyTicks: 0,
    visionDistortionTicks: 0,
    hearingDistortionTicks: 0,
    reliefTicks: 0,
    major: false,
  };
}

export function applyHorrorConsequence(playerOrId, consequence = {}, currentTick = 0) {
  const tick = tickNow(currentTick);
  const state = getPlayerHorrorState(playerOrId, tick);
  const profile = getConsequenceProfile(consequence.category, consequence.intensity);
  const merged = /** @type {any} */ ({
    ...profile,
    ...consequence,
  });

  const fearDelta = Number(merged.fear ?? merged.fearDelta ?? 0) || 0;
  const attentionDelta = Number(merged.stalkerAttention ?? merged.stalkerAttentionDelta ?? 0) || 0;
  state.fearScore = clamp(state.fearScore + fearDelta, 0, MAX_FEAR);
  state.stalkerAttentionLevel = clamp(state.stalkerAttentionLevel + attentionDelta, 0, MAX_FEAR);

  const baseThreatDelta = Number(merged.baseThreat ?? merged.baseThreatDelta ?? 0) || 0;
  if (baseThreatDelta !== 0) {
    state.baseThreatLevel = clamp((state.baseThreatLevel || 0) + baseThreatDelta, 0, MAX_FEAR);
    state.lastBaseEventTick = tick;
  }
  if (merged.baseViolation === true) {
    state.baseViolationCount = Math.max(0, Math.floor(Number(state.baseViolationCount) || 0)) + 1;
    state.lastBaseEventTick = tick;
  }
  if (merged.ignoredWarning === true) {
    state.ignoredWarningCount = Math.max(0, Math.floor(Number(state.ignoredWarningCount) || 0)) + 1;
  }

  const extendUntil = (field, ticks) => {
    const duration = Math.max(0, Number(ticks) || 0);
    if (duration > 0) {
      state[field] = Math.max(state[field] || 0, tick + duration);
    }
  };

  extendUntil("panicUntilTick", merged.panicTicks);
  extendUntil("flashlightInterferenceUntilTick", merged.flashlightInterferenceTicks);
  extendUntil("movementPenaltyUntilTick", merged.movementPenaltyTicks);
  extendUntil("visionDistortionUntilTick", merged.visionDistortionTicks);
  extendUntil("hearingDistortionUntilTick", merged.hearingDistortionTicks);
  extendUntil("dimensionShockCooldownUntilTick", merged.dimensionShockCooldownTicks);
  extendUntil("reliefUntilTick", merged.reliefTicks);

  if (merged.major === true) {
    state.lastMajorScareTick = tick;
  }

  const eventKey = String(merged.eventKey || merged.source || "").trim();
  if (eventKey) {
    state.lastEventKeys.push(eventKey);
    while (state.lastEventKeys.length > 10) {
      state.lastEventKeys.shift();
    }
  }

  state.lastUpdatedTick = tick;
  if (!Number.isFinite(state.lastDecayTick)) {
    state.lastDecayTick = tick;
  }
  recordPlayerTelemetry(playerOrId, "horror_state", {
    currentTick: tick,
    source: merged.source || "unknown",
    reason: merged.eventKey || merged.category || "consequence",
    status: "applied",
    category: merged.category,
    fearScore: state.fearScore,
    stalkerAttentionLevel: state.stalkerAttentionLevel,
    panicUntilTick: state.panicUntilTick,
    flashlightInterferenceUntilTick: state.flashlightInterferenceUntilTick,
    dimensionShockCooldownUntilTick: state.dimensionShockCooldownUntilTick,
  });

  return copyState(state);
}

export function isTimerActive(playerOrId, field, currentTick = 0) {
  const state = getPlayerHorrorState(playerOrId, currentTick);
  return (state[field] || 0) > tickNow(currentTick);
}
