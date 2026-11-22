export const AUDIO_CUE_TIER = Object.freeze({
  Ambient: "ambient",
  Reaction: "reaction",
  Buildup: "buildup",
  Peak: "peak",
});

const PEAK_COOLDOWN_TICKS = 20 * 45;
const REACTION_WINDOW_TICKS = 20 * 1.5;

function tickOf(value) {
  const tick = Number(value);
  return Number.isFinite(tick) ? Math.max(0, Math.floor(tick)) : 0;
}

function cloneState(state) {
  return {
    ...state,
    activeCues: [...(state.activeCues || [])],
  };
}

export function createAudioBudgetState() {
  return {
    activeCues: [],
    activePeakCueId: undefined,
    peakCooldownUntilTick: 0,
    reactionUntilTick: 0,
    reliefUntilTick: 0,
    lastCueTick: -1,
  };
}

function denial(state, reason) {
  return { allowed: false, reason, state: cloneState(state) };
}

export function requestAudioCue(state, {
  cueId = undefined,
  tier = AUDIO_CUE_TIER.Ambient,
  currentTick = 0,
  reliefUntilTick = 0,
  safeRoom = false,
} = {}) {
  const current = cloneState(state || createAudioBudgetState());
  const now = tickOf(currentTick);
  const id = cueId ? String(cueId) : `${tier}:${now}`;
  const normalizedTier = String(tier);

  if (safeRoom && normalizedTier === AUDIO_CUE_TIER.Peak) {
    return denial(current, "safe_room");
  }
  if (normalizedTier === AUDIO_CUE_TIER.Peak && current.reliefUntilTick > now) {
    return denial(current, "relief");
  }
  if (normalizedTier === AUDIO_CUE_TIER.Peak && current.activePeakCueId) {
    return denial(current, "peak_active");
  }
  if (normalizedTier === AUDIO_CUE_TIER.Peak && current.peakCooldownUntilTick > now) {
    return denial(current, "peak_cooldown");
  }
  if (normalizedTier === AUDIO_CUE_TIER.Reaction && current.reactionUntilTick > now) {
    return denial(current, "reaction_window");
  }

  const next = cloneState(current);
  if (!next.activeCues.includes(id)) {
    next.activeCues.push(id);
  }
  next.lastCueTick = now;

  if (normalizedTier === AUDIO_CUE_TIER.Peak) {
    next.activePeakCueId = id;
    next.peakCooldownUntilTick = now + PEAK_COOLDOWN_TICKS;
  }
  if (normalizedTier === AUDIO_CUE_TIER.Reaction) {
    next.reactionUntilTick = now + REACTION_WINDOW_TICKS;
  }
  if (Number.isFinite(Number(reliefUntilTick))) {
    next.reliefUntilTick = Math.max(next.reliefUntilTick, tickOf(reliefUntilTick));
  }

  return { allowed: true, reason: "allowed", cueId: id, tier: normalizedTier, state: next };
}

export function releaseAudioCue(state, cueId, _currentTick = 0) {
  const next = cloneState(state || createAudioBudgetState());
  const id = String(cueId || "");
  next.activeCues = next.activeCues.filter((activeId) => activeId !== id);
  if (next.activePeakCueId === id) {
    next.activePeakCueId = undefined;
  }
  return next;
}

export { PEAK_COOLDOWN_TICKS, REACTION_WINDOW_TICKS };
