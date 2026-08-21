/**
 * Shared Paradise horror pacing director.
 *
 * This module intentionally has no @minecraft/server import so the core pacing
 * logic can be unit-tested outside Bedrock. Runtime scripts should call
 * configureHorrorDirector({ tickProvider }) from their existing tick source.
 */

export const HORROR_PHASE = Object.freeze({
  Quiet: "quiet",
  Buildup: "buildup",
  Peak: "peak",
  Relief: "relief",
});

/**
 * @typedef {"quiet" | "buildup" | "peak" | "relief"} HorrorPhase
 *
 * @typedef {object} ActiveScare
 * @property {string} source
 * @property {string} playerId
 * @property {number} intensity
 * @property {number} startedTick
 * @property {number} buildupTicks
 * @property {number} peakTicks
 * @property {number} reliefTicks
 * @property {number} globalCooldownTicks
 * @property {number} playerCooldownTicks
 * @property {number} sourceCooldownTicks
 *
 * @typedef {object} HorrorDirectorState
 * @property {HorrorPhase} phase
 * @property {number} phaseStartedTick
 * @property {number} quietStartedTick
 * @property {ActiveScare | undefined} activeScare
 * @property {number} globalCooldownUntil
 * @property {Map<string, number>} sourceCooldowns
 * @property {Map<string, number>} playerCooldowns
 * @property {Map<string, number>} playerSourceCooldowns
 */

export const SCARE_DENIAL_REASON = Object.freeze({
  NoPlayer: "no_player",
  ActiveScare: "active_scare",
  PhaseBlocked: "phase_blocked",
  MinimumQuiet: "minimum_quiet_ticks",
  GlobalCooldown: "global_cooldown",
  PlayerCooldown: "player_cooldown",
  SourceCooldown: "source_cooldown",
  PlayerSourceCooldown: "player_source_cooldown",
});

const DEFAULTS = Object.freeze({
  majorIntensity: 4,
  minimumQuietTicks: 20 * 45,
  buildupTicks: 20 * 5,
  peakTicks: 20 * 6,
  reliefTicks: 20 * 20,
  globalCooldownTicks: 20 * 45,
  playerCooldownTicks: 20 * 60,
  sourceCooldownTicks: 20 * 90,
});

/** @type {() => number} */
let tickProvider = () => 0;
/** @type {number} */
let majorIntensity = DEFAULTS.majorIntensity;

/** @type {HorrorDirectorState} */
const state = {
  phase: HORROR_PHASE.Quiet,
  phaseStartedTick: 0,
  quietStartedTick: 0,
  activeScare: undefined,
  globalCooldownUntil: 0,
  sourceCooldowns: new Map(),
  playerCooldowns: new Map(),
  playerSourceCooldowns: new Map(),
};

function getTick(explicitTick) {
  if (Number.isFinite(explicitTick)) {
    return Math.max(0, Math.floor(explicitTick));
  }
  try {
    return Math.max(0, Math.floor(Number(tickProvider()) || 0));
  } catch (_error) {
    return 0;
  }
}

function getPlayerId(player) {
  return player && (player.id || player.name || player.nameTag) ? String(player.id || player.name || player.nameTag) : "unknown";
}

function normalizeTicks(value, fallback) {
  const numeric = Math.floor(Number(value));
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
}

function normalizeIntensity(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : DEFAULTS.majorIntensity;
}

function normalizeSource(value) {
  const source = String(value || "unknown_scare").trim();
  return source || "unknown_scare";
}

function totalScareTicks(scare) {
  if (!scare) return 0;
  return Math.max(0, scare.buildupTicks) + Math.max(0, scare.peakTicks) + Math.max(0, scare.reliefTicks);
}

/**
 * @param {HorrorPhase} phase
 * @param {number} tick
 */
function setPhase(phase, tick) {
  state.phase = phase;
  state.phaseStartedTick = tick;
  if (phase === HORROR_PHASE.Quiet) {
    state.quietStartedTick = tick;
    state.activeScare = undefined;
  }
}

function clearExpiredCooldowns(tick) {
  for (const [source, untilTick] of [...state.sourceCooldowns.entries()]) {
    if (untilTick <= tick) state.sourceCooldowns.delete(source);
  }
  for (const [playerId, untilTick] of [...state.playerCooldowns.entries()]) {
    if (untilTick <= tick) state.playerCooldowns.delete(playerId);
  }
  for (const [key, untilTick] of [...state.playerSourceCooldowns.entries()]) {
    if (untilTick <= tick) state.playerSourceCooldowns.delete(key);
  }
}

function decision(allowed, reason, tick) {
  return {
    allowed,
    reason,
    phase: state.phase,
    activeSource: state.activeScare ? state.activeScare.source : undefined,
    activePlayerId: state.activeScare ? state.activeScare.playerId : undefined,
    quietTicks: state.phase === HORROR_PHASE.Quiet ? tick - state.quietStartedTick : 0,
    globalCooldownRemainingTicks: Math.max(0, state.globalCooldownUntil - tick),
  };
}

export function configureHorrorDirector(options = {}) {
  if (typeof options.tickProvider === "function") {
    tickProvider = options.tickProvider;
  }
  if (Number.isFinite(options.majorIntensity)) {
    majorIntensity = Number(options.majorIntensity);
  }
}

export function getHorrorDirectorSnapshot(tick = getTick()) {
  const now = getTick(tick);
  tickHorrorDirector(now);
  return {
    phase: state.phase,
    phaseStartedTick: state.phaseStartedTick,
    quietStartedTick: state.quietStartedTick,
    quietTicks: state.phase === HORROR_PHASE.Quiet ? now - state.quietStartedTick : 0,
    activeScare: state.activeScare ? { ...state.activeScare } : undefined,
    globalCooldownUntil: state.globalCooldownUntil,
    globalCooldownRemainingTicks: Math.max(0, state.globalCooldownUntil - now),
    sourceCooldowns: new Map(state.sourceCooldowns),
    playerCooldowns: new Map(state.playerCooldowns),
    playerSourceCooldowns: new Map(state.playerSourceCooldowns),
  };
}

export function tickHorrorDirector(tick = getTick()) {
  const now = getTick(tick);
  clearExpiredCooldowns(now);

  const scare = state.activeScare;
  if (!scare) {
    if (state.phase !== HORROR_PHASE.Quiet) {
      setPhase(HORROR_PHASE.Quiet, now);
    }
    return getHorrorDirectorSnapshotNoTick(now);
  }

  const buildupEnd = scare.startedTick + scare.buildupTicks;
  const peakEnd = buildupEnd + scare.peakTicks;
  const reliefEnd = peakEnd + scare.reliefTicks;

  if (now >= reliefEnd) {
    setPhase(HORROR_PHASE.Quiet, reliefEnd);
  } else if (now >= peakEnd) {
    if (state.phase !== HORROR_PHASE.Relief) setPhase(HORROR_PHASE.Relief, peakEnd);
  } else if (now >= buildupEnd) {
    if (state.phase !== HORROR_PHASE.Peak) setPhase(HORROR_PHASE.Peak, buildupEnd);
  } else if (state.phase !== HORROR_PHASE.Buildup) {
    setPhase(HORROR_PHASE.Buildup, scare.startedTick);
  }

  return getHorrorDirectorSnapshotNoTick(now);
}

function getHorrorDirectorSnapshotNoTick(now) {
  return {
    phase: state.phase,
    phaseStartedTick: state.phaseStartedTick,
    quietStartedTick: state.quietStartedTick,
    quietTicks: state.phase === HORROR_PHASE.Quiet ? now - state.quietStartedTick : 0,
    activeScare: state.activeScare ? { ...state.activeScare } : undefined,
    globalCooldownUntil: state.globalCooldownUntil,
    globalCooldownRemainingTicks: Math.max(0, state.globalCooldownUntil - now),
  };
}

export function tryBeginScare(player, request = {}) {
  const now = getTick(request.currentTick);
  tickHorrorDirector(now);

  const source = normalizeSource(request.source);
  const intensity = normalizeIntensity(request.intensity);
  const minor = request.minor === true || request.isMinor === true || intensity < majorIntensity;

  if (minor) {
    return decision(true, "minor_ambience", now);
  }

  if (!player) {
    return decision(false, SCARE_DENIAL_REASON.NoPlayer, now);
  }

  const playerId = getPlayerId(player);
  const playerSourceKey = `${playerId}:${source}`;
  const minimumQuietTicks = normalizeTicks(request.minimumQuietTicks, DEFAULTS.minimumQuietTicks);
  const quietTicks = state.phase === HORROR_PHASE.Quiet ? now - state.quietStartedTick : 0;

  if (state.activeScare) {
    return decision(false, SCARE_DENIAL_REASON.ActiveScare, now);
  }
  if (state.phase !== HORROR_PHASE.Quiet) {
    return decision(false, SCARE_DENIAL_REASON.PhaseBlocked, now);
  }
  if (quietTicks < minimumQuietTicks) {
    return decision(false, SCARE_DENIAL_REASON.MinimumQuiet, now);
  }
  if (state.globalCooldownUntil > now) {
    return decision(false, SCARE_DENIAL_REASON.GlobalCooldown, now);
  }
  if ((state.playerCooldowns.get(playerId) || 0) > now) {
    return decision(false, SCARE_DENIAL_REASON.PlayerCooldown, now);
  }
  if ((state.sourceCooldowns.get(source) || 0) > now) {
    return decision(false, SCARE_DENIAL_REASON.SourceCooldown, now);
  }
  if ((state.playerSourceCooldowns.get(playerSourceKey) || 0) > now) {
    return decision(false, SCARE_DENIAL_REASON.PlayerSourceCooldown, now);
  }

  const scare = {
    source,
    playerId,
    intensity,
    startedTick: now,
    buildupTicks: normalizeTicks(request.buildupTicks, DEFAULTS.buildupTicks),
    peakTicks: normalizeTicks(request.peakTicks ?? request.durationTicks, DEFAULTS.peakTicks),
    reliefTicks: normalizeTicks(request.reliefTicks, DEFAULTS.reliefTicks),
    globalCooldownTicks: normalizeTicks(request.globalCooldownTicks, DEFAULTS.globalCooldownTicks),
    playerCooldownTicks: normalizeTicks(request.playerCooldownTicks, DEFAULTS.playerCooldownTicks),
    sourceCooldownTicks: normalizeTicks(request.sourceCooldownTicks, DEFAULTS.sourceCooldownTicks),
  };

  state.activeScare = scare;
  setPhase(HORROR_PHASE.Buildup, now);

  const activeUntil = now + totalScareTicks(scare);
  state.globalCooldownUntil = Math.max(state.globalCooldownUntil, now + scare.globalCooldownTicks, activeUntil);
  state.playerCooldowns.set(playerId, Math.max(state.playerCooldowns.get(playerId) || 0, now + scare.playerCooldownTicks, activeUntil));
  state.sourceCooldowns.set(source, Math.max(state.sourceCooldowns.get(source) || 0, now + scare.sourceCooldownTicks, activeUntil));
  state.playerSourceCooldowns.set(playerSourceKey, Math.max(state.playerSourceCooldowns.get(playerSourceKey) || 0, now + Math.max(scare.playerCooldownTicks, scare.sourceCooldownTicks), activeUntil));

  return decision(true, "allowed", now);
}

export function startPeak(source, tick = getTick()) {
  const now = getTick(tick);
  tickHorrorDirector(now);
  if (!state.activeScare) return false;
  if (source && state.activeScare.source !== source) return false;
  setPhase(HORROR_PHASE.Peak, now);
  state.activeScare.buildupTicks = Math.max(0, now - state.activeScare.startedTick);
  return true;
}

export function startRelief(source, tick = getTick()) {
  const now = getTick(tick);
  tickHorrorDirector(now);
  if (!state.activeScare) return false;
  if (source && state.activeScare.source !== source) return false;
  const scare = state.activeScare;
  const elapsed = Math.max(0, now - scare.startedTick);
  scare.buildupTicks = Math.min(scare.buildupTicks, elapsed);
  scare.peakTicks = Math.max(0, elapsed - scare.buildupTicks);
  setPhase(HORROR_PHASE.Relief, now);
  return true;
}

export function returnToQuiet(tick = getTick()) {
  const now = getTick(tick);
  setPhase(HORROR_PHASE.Quiet, now);
  clearExpiredCooldowns(now);
  return true;
}

export function endScare(source, options = {}) {
  const now = getTick(options.currentTick);
  tickHorrorDirector(now);
  if (!state.activeScare) return false;
  if (source && state.activeScare.source !== source) return false;
  if (options.skipRelief === true || normalizeTicks(options.reliefTicks, -1) === 0) {
    return returnToQuiet(now);
  }
  const reliefTicks = normalizeTicks(options.reliefTicks, state.activeScare.reliefTicks);
  state.activeScare.reliefTicks = reliefTicks;
  return startRelief(source, now);
}

export function resetHorrorDirectorForTests(tick = 0) {
  const now = getTick(tick);
  state.phase = HORROR_PHASE.Quiet;
  state.phaseStartedTick = now;
  state.quietStartedTick = now;
  state.activeScare = undefined;
  state.globalCooldownUntil = 0;
  state.sourceCooldowns.clear();
  state.playerCooldowns.clear();
  state.playerSourceCooldowns.clear();
  majorIntensity = DEFAULTS.majorIntensity;
  tickProvider = () => now;
}

export const horrorDirector = Object.freeze({
  configure: configureHorrorDirector,
  tryBeginScare,
  tick: tickHorrorDirector,
  startPeak,
  startRelief,
  returnToQuiet,
  endScare,
  getSnapshot: getHorrorDirectorSnapshot,
  resetForTests: resetHorrorDirectorForTests,
});
