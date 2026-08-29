/**
 * Per-player horror pacing state.
 *
 * This module intentionally has no Bedrock imports. It owns the timing and
 * lifecycle rules while Bedrock adapters provide player events and effects.
 */

export const HORROR_PHASE = Object.freeze({
  Quiet: "quiet",
  Buildup: "buildup",
  Peak: "peak",
  Relief: "relief",
});

export const HORROR_DENIAL_REASON = Object.freeze({
  InvalidPlayer: "invalid_player",
  ActiveBeat: "active_beat",
  QuietCooldown: "quiet_cooldown",
  SourceCooldown: "source_cooldown",
  FamilyCooldown: "family_cooldown",
  MissingEvidence: "missing_evidence",
  ServerPeakLimit: "server_peak_limit",
});

const DEFAULTS = Object.freeze({
  defaultMinimumQuietTicks: 900,
  buildupTicks: 100,
  peakTicks: 120,
  reliefTicks: 400,
  sourceCooldownTicks: 36000,
  familyCooldownTicks: 12000,
  serverMajorPeakLimit: 2,
});

function playerIdOf(playerOrId) {
  if (typeof playerOrId === "string") return playerOrId.trim();
  return String(playerOrId?.id || playerOrId?.name || "").trim();
}

function tickOf(value, fallback = 0) {
  const tick = Number(value);
  return Number.isFinite(tick) ? Math.max(0, Math.floor(tick)) : fallback;
}

function nonNegativeTicks(value, fallback) {
  const tick = Number(value);
  return Number.isFinite(tick) && tick >= 0 ? Math.floor(tick) : fallback;
}

function copyBeat(beat) {
  return beat ? { ...beat } : undefined;
}

function copyState(state, tick) {
  const now = tickOf(tick);
  return {
    playerId: state.playerId,
    phase: state.phase,
    phaseStartedTick: state.phaseStartedTick,
    quietStartedTick: state.quietStartedTick,
    quietTicks: state.phase === HORROR_PHASE.Quiet ? Math.max(0, now - state.quietStartedTick) : 0,
    activeBeat: copyBeat(state.activeBeat),
    fear: state.fear,
    evidence: [...state.evidence],
    evidenceCount: state.evidence.length,
    sourceCooldowns: Object.fromEntries(state.sourceCooldowns),
    familyCooldowns: Object.fromEntries(state.familyCooldowns),
    cleanupCount: state.cleanupCallbacks.length,
    lastCleanupReason: state.lastCleanupReason,
  };
}

function createState(playerId, tick) {
  const now = tickOf(tick);
  return {
    playerId,
    phase: HORROR_PHASE.Quiet,
    phaseStartedTick: now,
    quietStartedTick: now,
    activeBeat: undefined,
    fear: 0,
    evidence: [],
    sourceCooldowns: new Map(),
    familyCooldowns: new Map(),
    cleanupCallbacks: [],
    lastCleanupReason: undefined,
  };
}

function setPhase(state, phase, tick) {
  state.phase = phase;
  state.phaseStartedTick = tick;
  if (phase === HORROR_PHASE.Quiet) state.quietStartedTick = tick;
}

function releaseMajorBeat(state, onMajorBeatReleased) {
  if (state.activeBeat?.major) onMajorBeatReleased();
  state.activeBeat = undefined;
}

function syncState(state, tick, onMajorBeatReleased) {
  const now = tickOf(tick);
  const beat = state.activeBeat;
  if (!beat) return;

  const buildupEnd = beat.startedTick + beat.buildupTicks;
  const peakEnd = buildupEnd + beat.peakTicks;
  const reliefEnd = peakEnd + beat.reliefTicks;

  if (now >= reliefEnd) {
    releaseMajorBeat(state, onMajorBeatReleased);
    setPhase(state, HORROR_PHASE.Quiet, reliefEnd);
  } else if (now >= peakEnd) {
    setPhase(state, HORROR_PHASE.Relief, peakEnd);
  } else if (now >= buildupEnd) {
    setPhase(state, HORROR_PHASE.Peak, buildupEnd);
  } else {
    setPhase(state, HORROR_PHASE.Buildup, beat.startedTick);
  }
}

function cleanupCooldowns(state, tick) {
  for (const [key, until] of state.sourceCooldowns) {
    if (until <= tick) state.sourceCooldowns.delete(key);
  }
  for (const [key, until] of state.familyCooldowns) {
    if (until <= tick) state.familyCooldowns.delete(key);
  }
}

export function createHorrorExperienceCoordinator(options = {}) {
  const config = {
    ...DEFAULTS,
    ...options,
  };
  const states = new Map();
  let majorPeaks = 0;
  let nextBeatId = 1;

  function stateFor(playerOrId, tick = 0) {
    const playerId = playerIdOf(playerOrId);
    if (!playerId) return undefined;
    if (!states.has(playerId)) states.set(playerId, createState(playerId, tick));
    const state = states.get(playerId);
    syncState(state, tick, () => { majorPeaks = Math.max(0, majorPeaks - 1); });
    cleanupCooldowns(state, tickOf(tick));
    return state;
  }

  function result(state, allowed, reason, tick, extra = {}) {
    return {
      allowed,
      reason,
      phase: state?.phase || HORROR_PHASE.Quiet,
      playerId: state?.playerId,
      beatId: state?.activeBeat?.id,
      ...extra,
    };
  }

  function requestHorrorBeat(player, request = {}) {
    const playerId = playerIdOf(player);
    const now = tickOf(request.currentTick);
    const state = stateFor(player, now);
    if (!state) return result(undefined, false, HORROR_DENIAL_REASON.InvalidPlayer, now);

    if (state.activeBeat) return result(state, false, HORROR_DENIAL_REASON.ActiveBeat, now);

    const minimumQuietTicks = nonNegativeTicks(request.minimumQuietTicks, config.defaultMinimumQuietTicks);
    if (state.phase !== HORROR_PHASE.Quiet || now - state.quietStartedTick < minimumQuietTicks) {
      return result(state, false, HORROR_DENIAL_REASON.QuietCooldown, now);
    }

    const source = String(request.source || "unknown").trim() || "unknown";
    const family = String(request.family || "unknown").trim() || "unknown";
    if ((state.sourceCooldowns.get(source) || 0) > now) {
      return result(state, false, HORROR_DENIAL_REASON.SourceCooldown, now);
    }
    if ((state.familyCooldowns.get(family) || 0) > now) {
      return result(state, false, HORROR_DENIAL_REASON.FamilyCooldown, now);
    }

    const requiredEvidence = Math.max(0, Math.floor(Number(request.requiresEvidence) || 0));
    if (requiredEvidence > state.evidence.length) {
      return result(state, false, HORROR_DENIAL_REASON.MissingEvidence, now, {
        requiredEvidence,
        evidenceCount: state.evidence.length,
      });
    }

    const major = request.major !== false;
    if (major && majorPeaks >= config.serverMajorPeakLimit) {
      return result(state, false, HORROR_DENIAL_REASON.ServerPeakLimit, now);
    }

    const beat = {
      id: `horror-beat-${nextBeatId++}`,
      playerId,
      source,
      family,
      tier: String(request.tier || (major ? "major" : "minor")),
      intensity: Number.isFinite(Number(request.intensity)) ? Number(request.intensity) : (major ? 4 : 1),
      major,
      startedTick: now,
      buildupTicks: nonNegativeTicks(request.buildupTicks, config.buildupTicks),
      peakTicks: nonNegativeTicks(request.peakTicks, config.peakTicks),
      reliefTicks: nonNegativeTicks(request.reliefTicks, config.reliefTicks),
    };
    state.activeBeat = beat;
    setPhase(state, HORROR_PHASE.Buildup, now);
    if (major) majorPeaks += 1;

    const activeEnd = now + beat.buildupTicks + beat.peakTicks + beat.reliefTicks;
    const sourceCooldown = nonNegativeTicks(request.sourceCooldownTicks, config.sourceCooldownTicks);
    const familyCooldown = nonNegativeTicks(request.familyCooldownTicks, config.familyCooldownTicks);
    state.sourceCooldowns.set(source, Math.max(activeEnd, now + sourceCooldown));
    state.familyCooldowns.set(family, Math.max(activeEnd, now + familyCooldown));
    return result(state, true, "allowed", now, { beatId: beat.id });
  }

  function completeHorrorBeat(player, beatId, options = {}) {
    const now = tickOf(options.currentTick);
    const state = stateFor(player, now);
    if (!state?.activeBeat || state.activeBeat.id !== beatId) return false;
    const reliefTicks = nonNegativeTicks(options.reliefTicks, state.activeBeat.reliefTicks);
    state.activeBeat.reliefTicks = reliefTicks;
    if (reliefTicks === 0) {
      releaseMajorBeat(state, () => { majorPeaks = Math.max(0, majorPeaks - 1); });
      setPhase(state, HORROR_PHASE.Quiet, now);
    } else {
      setPhase(state, HORROR_PHASE.Relief, now);
    }
    return true;
  }

  function cancelHorrorBeat(player, beatId, reason = "cancelled", tick = 0) {
    const now = tickOf(tick);
    const state = stateFor(player, now);
    if (!state?.activeBeat || (beatId && state.activeBeat.id !== beatId)) return false;
    releaseMajorBeat(state, () => { majorPeaks = Math.max(0, majorPeaks - 1); });
    state.lastCleanupReason = reason;
    setPhase(state, HORROR_PHASE.Quiet, now);
    return true;
  }

  function recordEvidence(player, evidenceType, tick = 0) {
    const state = stateFor(player, tick);
    if (!state) return 0;
    const value = String(evidenceType || "unknown").trim() || "unknown";
    if (!state.evidence.includes(value)) state.evidence.push(value);
    return state.evidence.length;
  }

  function addFear(player, amount, tick = 0) {
    const state = stateFor(player, tick);
    if (!state) return 0;
    state.fear = Math.max(0, Math.min(100, state.fear + (Number(amount) || 0)));
    return state.fear;
  }

  function registerCleanup(player, callback) {
    const state = stateFor(player, 0);
    if (!state || typeof callback !== "function") return false;
    state.cleanupCallbacks.push(callback);
    return true;
  }

  function clearHorrorExperience(playerOrId, reason = "cleared") {
    const playerId = playerIdOf(playerOrId);
    const state = states.get(playerId);
    if (!state) return false;
    releaseMajorBeat(state, () => { majorPeaks = Math.max(0, majorPeaks - 1); });
    for (const callback of state.cleanupCallbacks.splice(0)) {
      try { callback(reason, playerId); } catch (_error) { /* cleanup must continue */ }
    }
    state.lastCleanupReason = reason;
    states.delete(playerId);
    return true;
  }

  function getSnapshot(player, tick = 0) {
    const state = stateFor(player, tick);
    return state ? copyState(state, tick) : undefined;
  }

  function tick(tick = 0) {
    const now = tickOf(tick);
    for (const state of states.values()) {
      syncState(state, now, () => { majorPeaks = Math.max(0, majorPeaks - 1); });
      cleanupCooldowns(state, now);
    }
  }

  return Object.freeze({
    requestHorrorBeat,
    completeHorrorBeat,
    cancelHorrorBeat,
    recordEvidence,
    addFear,
    registerCleanup,
    clearHorrorExperience,
    getSnapshot,
    tick,
    get majorPeaks() { return majorPeaks; },
  });
}
