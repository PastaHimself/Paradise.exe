export const ADAPTIVE_TACTIC = Object.freeze({
  PeripheralWatch: "peripheral_watch",
  FalseRearThreat: "false_rear_threat",
  RoutePoisoning: "route_poisoning",
  StareContest: "stare_contest",
  BaitSighting: "bait_sighting",
  ShadowPursuit: "shadow_pursuit",
  EmptyRoom: "empty_room",
  PredictedAmbush: "predicted_ambush",
  ShortHunt: "short_hunt",
});

const TRAIT_KEYS = Object.freeze([
  "lookBack",
  "sprintEscape",
  "freeze",
  "hide",
  "backtrack",
  "routeReuse",
  "flashlightCheck",
]);

const DECAY_INTERVAL_TICKS = 20 * 60;
const DECAY_FACTOR = 0.82;
const EXPOSURE_REACTION_WINDOW_TICKS = 80;
const RECENT_TACTIC_HARD_PENALTY_TICKS = 900;
const RECENT_TACTIC_SOFT_PENALTY_TICKS = 2400;
const HEARD_EVIDENCE_MAX_AGE_TICKS = 60;
const SIGHT_EVIDENCE_MIN_TICKS = 20;

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function normalizeXZ(vector) {
  const x = Number(vector?.x) || 0;
  const z = Number(vector?.z) || 0;
  const length = Math.sqrt(x * x + z * z);
  if (length <= 0.0001) {
    return { x: 0, z: 0 };
  }
  return { x: x / length, z: z / length };
}

function bumpTrait(state, key, amount) {
  if (!state?.traits || !TRAIT_KEYS.includes(key)) {
    return;
  }
  state.traits[key] = clamp01((state.traits[key] || 0) + amount);
}

function allowedTacticsForPhase(phase) {
  switch (String(phase || "observe").toLowerCase()) {
    case "observe":
      return [
        ADAPTIVE_TACTIC.PeripheralWatch,
        ADAPTIVE_TACTIC.FalseRearThreat,
        ADAPTIVE_TACTIC.ShadowPursuit,
      ];
    case "shadow":
      return [
        ADAPTIVE_TACTIC.FalseRearThreat,
        ADAPTIVE_TACTIC.PeripheralWatch,
        ADAPTIVE_TACTIC.RoutePoisoning,
        ADAPTIVE_TACTIC.BaitSighting,
        ADAPTIVE_TACTIC.ShadowPursuit,
        ADAPTIVE_TACTIC.EmptyRoom,
      ];
    case "pressure":
      return [
        ADAPTIVE_TACTIC.StareContest,
        ADAPTIVE_TACTIC.FalseRearThreat,
        ADAPTIVE_TACTIC.RoutePoisoning,
        ADAPTIVE_TACTIC.BaitSighting,
        ADAPTIVE_TACTIC.ShadowPursuit,
        ADAPTIVE_TACTIC.EmptyRoom,
        ADAPTIVE_TACTIC.ShortHunt,
      ];
    case "ambush":
      return [
        ADAPTIVE_TACTIC.PredictedAmbush,
        ADAPTIVE_TACTIC.ShortHunt,
        ADAPTIVE_TACTIC.RoutePoisoning,
        ADAPTIVE_TACTIC.StareContest,
      ];
    default:
      return [ADAPTIVE_TACTIC.ShadowPursuit];
  }
}

function tacticBaseScore(tactic, phase) {
  const normalizedPhase = String(phase || "observe").toLowerCase();
  const phaseBase = {
    observe: {
      [ADAPTIVE_TACTIC.PeripheralWatch]: 1.35,
      [ADAPTIVE_TACTIC.FalseRearThreat]: 1.0,
      [ADAPTIVE_TACTIC.ShadowPursuit]: 1.1,
    },
    shadow: {
      [ADAPTIVE_TACTIC.FalseRearThreat]: 1.05,
      [ADAPTIVE_TACTIC.PeripheralWatch]: 1.2,
      [ADAPTIVE_TACTIC.RoutePoisoning]: 1.0,
      [ADAPTIVE_TACTIC.BaitSighting]: 0.95,
      [ADAPTIVE_TACTIC.ShadowPursuit]: 1.15,
      [ADAPTIVE_TACTIC.EmptyRoom]: 0.85,
    },
    pressure: {
      [ADAPTIVE_TACTIC.StareContest]: 1.0,
      [ADAPTIVE_TACTIC.FalseRearThreat]: 0.9,
      [ADAPTIVE_TACTIC.RoutePoisoning]: 1.05,
      [ADAPTIVE_TACTIC.BaitSighting]: 1.0,
      [ADAPTIVE_TACTIC.ShadowPursuit]: 0.95,
      [ADAPTIVE_TACTIC.EmptyRoom]: 0.8,
      [ADAPTIVE_TACTIC.ShortHunt]: 1.1,
    },
    ambush: {
      [ADAPTIVE_TACTIC.PredictedAmbush]: 1.0,
      [ADAPTIVE_TACTIC.ShortHunt]: 1.2,
      [ADAPTIVE_TACTIC.RoutePoisoning]: 0.9,
      [ADAPTIVE_TACTIC.StareContest]: 0.65,
    },
  };
  return phaseBase[normalizedPhase]?.[tactic] ?? 0.5;
}

function tacticTraitScore(state, tactic, context) {
  const traits = state?.traits || {};
  const pressure = Math.max(0, Math.min(100, Number(context?.pressure) || 0));
  const fear = Math.max(0, Math.min(100, Number(context?.fear) || 0));
  const escapeConfidence = clamp01(state?.escapeConfidence);

  switch (tactic) {
    case ADAPTIVE_TACTIC.FalseRearThreat:
      return (traits.lookBack || 0) * 3.8 + (traits.flashlightCheck || 0) * 0.7 + (traits.hide || 0) * 0.55;
    case ADAPTIVE_TACTIC.PeripheralWatch:
      return (traits.lookBack || 0) * 0.8 + (traits.flashlightCheck || 0) * 1.4 + Math.max(0, 55 - fear) / 100;
    case ADAPTIVE_TACTIC.RoutePoisoning:
      return (traits.routeReuse || 0) * 2.2 + (traits.backtrack || 0) * 1.5 + (traits.sprintEscape || 0) * 1.25 + (traits.hide || 0) * 0.5 + escapeConfidence * 0.9;
    case ADAPTIVE_TACTIC.StareContest:
      return (traits.freeze || 0) * 4.5 + (traits.lookBack || 0) * 0.35 + Math.max(0, pressure - 70) / 45;
    case ADAPTIVE_TACTIC.BaitSighting:
      return (traits.sprintEscape || 0) * 3.7 + escapeConfidence * 1.1 + (traits.routeReuse || 0) * 0.35;
    case ADAPTIVE_TACTIC.ShadowPursuit:
      return (traits.lookBack || 0) * 0.45 + (traits.sprintEscape || 0) * 0.7 + (traits.flashlightCheck || 0) * 0.45 + (traits.hide || 0) * 1.5;
    case ADAPTIVE_TACTIC.EmptyRoom:
      return (traits.backtrack || 0) * 4.1 + (traits.routeReuse || 0) * 0.45 + (traits.hide || 0) * 1.0;
    case ADAPTIVE_TACTIC.PredictedAmbush:
      return (traits.sprintEscape || 0) * 4.0 + (traits.routeReuse || 0) * 3.0 + escapeConfidence * 2.0;
    case ADAPTIVE_TACTIC.ShortHunt:
      return Math.max(0, pressure - 75) / 18 + Math.max(0, fear - 35) / 70 + (traits.sprintEscape || 0) * 0.45;
    default:
      return 0;
  }
}

function recentTacticMultiplier(state, tactic, tick) {
  const lastTick = Number(state?.lastTacticTicks?.get(tactic));
  if (!Number.isFinite(lastTick)) {
    return 1;
  }
  const age = Math.max(0, (Number(tick) || 0) - lastTick);
  if (age < RECENT_TACTIC_HARD_PENALTY_TICKS) {
    return 0.12;
  }
  if (age < RECENT_TACTIC_SOFT_PENALTY_TICKS) {
    return 0.45;
  }
  return 1;
}

export function createAdaptiveProfile(tick = 0) {
  return {
    traits: {
      lookBack: 0,
      sprintEscape: 0,
      freeze: 0,
      hide: 0,
      backtrack: 0,
      routeReuse: 0,
      flashlightCheck: 0,
    },
    routeHistory: [],
    escapeDirection: { x: 0, z: 0 },
    escapeConfidence: 0,
    lastExposureTick: -999999,
    lastHandledExposureTick: -999999,
    lastDecayTick: Math.max(0, Math.floor(Number(tick) || 0)),
    lastTacticTicks: new Map(),
    tacticHistory: [],
    observationCount: 0,
  };
}

export function observeAdaptiveLook(state, alignment, tick) {
  if (!state) {
    return state;
  }
  decayAdaptiveProfile(state, tick);
  const value = Number(alignment);
  if (Number.isFinite(value) && value < -0.12) {
    bumpTrait(state, "lookBack", value < -0.55 ? 0.22 : 0.14);
    state.observationCount += 1;
  }
  return state;
}

export function observeAdaptiveRoute(state, cellKey, tick) {
  if (!state || !cellKey) {
    return state;
  }
  decayAdaptiveProfile(state, tick);
  const key = String(cellKey);
  const history = state.routeHistory;
  const previous = history[history.length - 1];
  const twoBack = history[history.length - 2];
  const recent = history.slice(-6);

  if (twoBack === key && previous !== key) {
    bumpTrait(state, "backtrack", 0.22);
    state.observationCount += 1;
  }
  if (recent.includes(key) && previous !== key) {
    bumpTrait(state, "routeReuse", 0.14);
    state.observationCount += 1;
  }

  if (previous !== key) {
    history.push(key);
    while (history.length > 12) {
      history.shift();
    }
  }
  return state;
}

export function observeAdaptiveExposure(state, tick) {
  if (!state) {
    return state;
  }
  decayAdaptiveProfile(state, tick);
  state.lastExposureTick = Math.max(0, Math.floor(Number(tick) || 0));
  return state;
}

export function observeAdaptiveMotionAfterExposure(state, speed, movementDistance, tick, direction, options = {}) {
  if (!state) {
    return state;
  }
  decayAdaptiveProfile(state, tick);
  const now = Math.max(0, Math.floor(Number(tick) || 0));
  const exposureAge = now - (Number(state.lastExposureTick) || -999999);
  if (exposureAge < 0 || exposureAge > EXPOSURE_REACTION_WINDOW_TICKS || state.lastHandledExposureTick === state.lastExposureTick) {
    return state;
  }

  const safeSpeed = Math.max(0, Number(speed) || 0);
  const safeMovement = Math.max(0, Number(movementDistance) || 0);
  if (options.isSneaking === true && safeSpeed <= 2.5 && safeMovement <= 2.5 && exposureAge >= 8) {
    bumpTrait(state, "hide", 0.22);
    state.lastHandledExposureTick = state.lastExposureTick;
    state.observationCount += 1;
  } else if (safeSpeed >= 4.5 || safeMovement >= 4.0) {
    bumpTrait(state, "sprintEscape", 0.22);
    const normalized = normalizeXZ(direction);
    if (normalized.x || normalized.z) {
      if (state.escapeConfidence <= 0.01) {
        state.escapeDirection = normalized;
      } else {
        state.escapeDirection = normalizeXZ({
          x: state.escapeDirection.x * 0.65 + normalized.x * 0.35,
          z: state.escapeDirection.z * 0.65 + normalized.z * 0.35,
        });
      }
      state.escapeConfidence = clamp01(state.escapeConfidence + 0.2);
    }
    state.lastHandledExposureTick = state.lastExposureTick;
    state.observationCount += 1;
  } else if (safeSpeed <= 0.35 && safeMovement <= 0.5 && exposureAge >= 8) {
    bumpTrait(state, "freeze", 0.22);
    state.lastHandledExposureTick = state.lastExposureTick;
    state.observationCount += 1;
  }
  return state;
}

export function observeAdaptiveFlashlight(state, tick) {
  if (!state) {
    return state;
  }
  decayAdaptiveProfile(state, tick);
  bumpTrait(state, "flashlightCheck", 0.18);
  state.observationCount += 1;
  return state;
}

export function decayAdaptiveProfile(state, tick) {
  if (!state) {
    return state;
  }
  const now = Math.max(0, Math.floor(Number(tick) || 0));
  const last = Math.max(0, Math.floor(Number(state.lastDecayTick) || 0));
  const elapsed = now - last;
  if (elapsed < DECAY_INTERVAL_TICKS) {
    return state;
  }

  const intervals = Math.floor(elapsed / DECAY_INTERVAL_TICKS);
  const factor = Math.pow(DECAY_FACTOR, intervals);
  for (const key of TRAIT_KEYS) {
    state.traits[key] = clamp01((state.traits[key] || 0) * factor);
  }
  state.escapeConfidence = clamp01((state.escapeConfidence || 0) * factor);
  if (state.escapeConfidence < 0.08) {
    state.escapeDirection = { x: 0, z: 0 };
  }
  state.lastDecayTick = last + intervals * DECAY_INTERVAL_TICKS;
  return state;
}

export function chooseAdaptiveTactic(state, context = {}, randomFn = Math.random) {
  if (!state) {
    state = createAdaptiveProfile(context.tick || 0);
  }
  const tick = Math.max(0, Math.floor(Number(context.tick) || 0));
  decayAdaptiveProfile(state, tick);
  const phase = String(context.phase || "observe").toLowerCase();
  const allowed = allowedTacticsForPhase(phase);
  const scored = allowed.map((tactic) => {
    const score = Math.max(0.01, tacticBaseScore(tactic, phase) + tacticTraitScore(state, tactic, context));
    return {
      tactic,
      score: score * recentTacticMultiplier(state, tactic, tick),
    };
  }).sort((a, b) => b.score - a.score || a.tactic.localeCompare(b.tactic));

  const total = scored.reduce((sum, entry) => sum + entry.score, 0);
  let cursor = Math.max(0, Math.min(0.999999999, Number(randomFn()) || 0)) * total;
  for (const entry of scored) {
    cursor -= entry.score;
    if (cursor <= 0) {
      return entry.tactic;
    }
  }
  return scored[0]?.tactic || ADAPTIVE_TACTIC.ShadowPursuit;
}

export function recordAdaptiveTactic(state, tactic, tick) {
  if (!state || !tactic) {
    return state;
  }
  const now = Math.max(0, Math.floor(Number(tick) || 0));
  state.lastTacticTicks.set(String(tactic), now);
  state.tacticHistory.push({ tactic: String(tactic), tick: now });
  while (state.tacticHistory.length > 10) {
    state.tacticHistory.shift();
  }
  return state;
}

export function hasAttackEvidencePolicy(input = {}) {
  const confirmedSightTicks = Math.max(0, Number(input.confirmedSightTicks) || 0);
  if (confirmedSightTicks >= SIGHT_EVIDENCE_MIN_TICKS) {
    return true;
  }
  const heardTicksAgo = Math.max(0, Number(input.heardTicksAgo) || 0);
  return input.soundWithinRange === true && heardTicksAgo <= HEARD_EVIDENCE_MAX_AGE_TICKS;
}

export function canResolveAdaptiveAmbushDamage(input = {}) {
  return (
    input.outcomeDamageCapable === true &&
    input.sameDimension === true &&
    input.escapedWarning !== true &&
    input.nearWarningOrEntity === true &&
    input.freshLineOfSight === true
  );
}

export function getAdaptiveSnapshot(state) {
  if (!state) {
    return createAdaptiveProfile(0);
  }
  return {
    traits: { ...state.traits },
    routeHistory: [...state.routeHistory],
    escapeDirection: { ...state.escapeDirection },
    escapeConfidence: state.escapeConfidence,
    lastExposureTick: state.lastExposureTick,
    lastHandledExposureTick: state.lastHandledExposureTick,
    lastDecayTick: state.lastDecayTick,
    tacticHistory: state.tacticHistory.map((entry) => ({ ...entry })),
    observationCount: state.observationCount,
  };
}
