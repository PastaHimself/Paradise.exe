export const WATCHER_BEHAVIOR = Object.freeze({
  Dormant: "dormant",
  Observe: "observe",
  Shadow: "shadow",
  Investigate: "investigate",
  Pressure: "pressure",
  Alerted: "alerted",
  Pursue: "pursue",
  Search: "search",
  Ambush: "ambush",
  Disengage: "disengage",
});

export const EVIDENCE_KIND = Object.freeze({
  Sight: "sight",
  Sound: "sound",
  Flashlight: "flashlight",
  Interaction: "interaction",
});

const MAX_SUSPICION = 100;
const CONFIRMED_SIGHT_REACTION_TICKS = 15;
const CONFIRMED_SIGHT_STALE_TICKS = 20 * 4;
const FRESH_SOUND_ATTACK_TICKS = 60;
const MAX_SEARCH_TICKS = 20 * 40;
const SEARCH_MIN_CONFIDENCE = 0.12;
const SEARCHED_LOCATION_LIMIT = 12;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function cloneLocation(value) {
  if (!value) return undefined;
  return {
    x: Number(value.x) || 0,
    y: Number(value.y) || 0,
    z: Number(value.z) || 0,
  };
}

function normalizeXZ(vector) {
  const x = Number(vector?.x) || 0;
  const z = Number(vector?.z) || 0;
  const length = Math.hypot(x, z);
  if (length <= 0.0001) return { x: 0, z: 0 };
  return { x: x / length, z: z / length };
}

function locationKey(value) {
  if (!value) return "none";
  return `${Math.round((Number(value.x) || 0) * 2) / 2},${Math.round((Number(value.y) || 0) * 2) / 2},${Math.round((Number(value.z) || 0) * 2) / 2}`;
}

function evidenceSuspicionDelta(evidence) {
  const strength = clamp(evidence?.strength ?? 1, 0, 1);
  switch (evidence?.kind) {
    case EVIDENCE_KIND.Sight: {
      const contactTicks = Math.max(0, Number(evidence.contactTicks) || 0);
      const reactionBonus = contactTicks >= CONFIRMED_SIGHT_REACTION_TICKS
        ? 34
        : contactTicks * 1.4;
      return (44 + reactionBonus) * strength;
    }
    case EVIDENCE_KIND.Sound:
      return 28 * strength;
    case EVIDENCE_KIND.Interaction:
      return 22 * strength;
    case EVIDENCE_KIND.Flashlight:
      return 14 * strength;
    default:
      return 0;
  }
}

function evidenceConfidence(evidence) {
  const strength = clamp(evidence?.strength ?? 1, 0, 1);
  switch (evidence?.kind) {
    case EVIDENCE_KIND.Sight:
      return 0.55 + 0.45 * strength;
    case EVIDENCE_KIND.Sound:
      return 0.25 + 0.50 * strength;
    case EVIDENCE_KIND.Interaction:
      return 0.20 + 0.45 * strength;
    case EVIDENCE_KIND.Flashlight:
      return 0.15 + 0.30 * strength;
    default:
      return 0;
  }
}


export function approximateWatcherEvidenceLocation(location, uncertainty = 0, randomFn = Math.random) {
  const source = cloneLocation(location);
  if (!source) return undefined;
  const radiusLimit = Math.max(0, Number(uncertainty) || 0);
  if (radiusLimit <= 0) return source;
  const angle = clamp(randomFn(), 0, 0.999999999) * Math.PI * 2;
  const radius = radiusLimit * (0.35 + clamp(randomFn(), 0, 1) * 0.65);
  return {
    x: source.x + Math.cos(angle) * radius,
    y: source.y,
    z: source.z + Math.sin(angle) * radius,
  };
}

export function getWatcherEvidenceReactionDelayTicks(kind, strength = 1, randomFn = Math.random) {
  const normalizedKind = String(kind || "");
  const confidence = clamp(strength, 0, 1);
  const ranges = {
    [EVIDENCE_KIND.Sight]: [6, 22],
    [EVIDENCE_KIND.Sound]: [20, 70],
    [EVIDENCE_KIND.Interaction]: [18, 60],
    [EVIDENCE_KIND.Flashlight]: [40, 90],
  };
  const [minTicks, maxTicks] = ranges[normalizedKind] || [30, 80];
  const base = maxTicks - (maxTicks - minTicks) * confidence;
  const jitterSpan = Math.min(12, Math.max(2, (maxTicks - minTicks) * 0.18));
  const jitter = (clamp(randomFn(), 0, 1) * 2 - 1) * jitterSpan;
  return Math.round(clamp(base + jitter, minTicks, maxTicks));
}

export function computeSightEvidenceStrength(input = {}) {
  if (input.obstructed === true) return 0;
  const maxDistance = Math.max(1, Number(input.maxDistance) || 96);
  const distance = Math.max(0, Number(input.distance) || 0);
  const distanceFactor = clamp(1 - (distance / maxDistance) * 0.62, 0.28, 1);
  const lightLevel = clamp(input.lightLevel ?? 7, 0, 15);
  const lightFactor = 0.42 + (lightLevel / 15) * 0.58;
  const sneakFactor = input.sneaking === true ? 0.68 : 1;
  const environmentFactor = clamp(input.environmentMultiplier ?? 1, 0.2, 1.25);
  return clamp(distanceFactor * lightFactor * sneakFactor * environmentFactor, 0, 1);
}

export function createWatcherEvidenceState(tick = 0) {
  const now = Math.max(0, Math.floor(Number(tick) || 0));
  return {
    suspicion: 0,
    confidence: 0,
    confirmed: false,
    behavior: WATCHER_BEHAVIOR.Dormant,
    lastKnownPosition: undefined,
    lastEvidenceTick: now,
    lastDecayTick: now,
    lastEvidenceKind: undefined,
    lastEvidenceStrength: 0,
    lastSightTick: -999999,
    lastSoundTick: -999999,
    lastInteractionTick: -999999,
    lastFlashlightTick: -999999,
    movementDirection: { x: 0, z: 0 },
    routeHints: [],
    searchStartedTick: -999999,
    lastSearchAdvanceTick: -999999,
    lastSearchDecayTick: -999999,
    searchConfidence: 0,
    searchRadius: 0,
    searchedLocations: [],
  };
}

export function observeWatcherEvidence(state, evidence = {}, tick = 0) {
  if (!state || !evidence.location) return state;
  const now = Math.max(0, Math.floor(Number(tick) || 0));
  const kind = String(evidence.kind || "");
  const strength = clamp(evidence.strength ?? 1, 0, 1);

  state.suspicion = clamp(state.suspicion + evidenceSuspicionDelta({ ...evidence, kind, strength }), 0, MAX_SUSPICION);
  state.confidence = clamp(Math.max(state.confidence * 0.86, evidenceConfidence({ ...evidence, kind, strength })), 0, 1);
  state.lastKnownPosition = cloneLocation(evidence.location);
  state.lastEvidenceTick = now;
  state.lastDecayTick = now;
  state.lastEvidenceKind = kind;
  state.lastEvidenceStrength = strength;

  const movement = normalizeXZ(evidence.movementDirection);
  if (movement.x || movement.z) {
    state.movementDirection = movement;
  }

  if (Array.isArray(evidence.routeHints)) {
    state.routeHints = evidence.routeHints
      .filter(Boolean)
      .slice(0, 8)
      .map((location) => cloneLocation(location));
  }

  if (kind === EVIDENCE_KIND.Sight) {
    state.lastSightTick = now;
    const contactTicks = Math.max(0, Number(evidence.contactTicks) || 0);
    if (contactTicks >= CONFIRMED_SIGHT_REACTION_TICKS && state.suspicion >= 65) {
      state.confirmed = true;
    }
  } else if (kind === EVIDENCE_KIND.Sound) {
    state.lastSoundTick = now;
  } else if (kind === EVIDENCE_KIND.Interaction) {
    state.lastInteractionTick = now;
  } else if (kind === EVIDENCE_KIND.Flashlight) {
    state.lastFlashlightTick = now;
  }

  if (state.behavior === WATCHER_BEHAVIOR.Search || state.behavior === WATCHER_BEHAVIOR.Disengage) {
    state.searchStartedTick = -999999;
    state.lastSearchDecayTick = -999999;
    state.searchConfidence = 0;
    state.searchRadius = 0;
    state.searchedLocations.length = 0;
  }
  state.behavior = kind === EVIDENCE_KIND.Sight
    ? WATCHER_BEHAVIOR.Observe
    : WATCHER_BEHAVIOR.Investigate;

  return state;
}

export function tickWatcherEvidence(state, tick = 0, _context = {}) {
  if (!state) return state;
  const now = Math.max(0, Math.floor(Number(tick) || 0));
  const lastDecayTick = Number.isFinite(Number(state.lastDecayTick))
    ? Number(state.lastDecayTick)
    : Number(state.lastEvidenceTick) || now;
  const elapsedSinceDecay = Math.max(0, now - lastDecayTick);
  const secondsSinceDecay = elapsedSinceDecay / 20;

  state.suspicion = clamp(state.suspicion - secondsSinceDecay * 1.15, 0, MAX_SUSPICION);
  state.confidence = clamp(state.confidence - secondsSinceDecay * 0.018, 0, 1);
  state.lastDecayTick = now;

  if (now - (Number(state.lastSightTick) || -999999) > CONFIRMED_SIGHT_STALE_TICKS) {
    state.confirmed = false;
  }

  if (state.searchStartedTick > -999000) {
    const searchAge = Math.max(0, now - state.searchStartedTick);
    const lastSearchDecayTick = state.lastSearchDecayTick > -999000
      ? state.lastSearchDecayTick
      : state.searchStartedTick;
    const searchElapsed = Math.max(0, now - lastSearchDecayTick);
    const searchSeconds = searchElapsed / 20;
    state.searchConfidence = clamp(
      Math.min(state.searchConfidence || state.confidence, state.confidence) - searchSeconds * 0.02,
      0,
      1,
    );
    state.searchRadius = clamp(6 + (searchAge / 20) * 0.65, 6, 34);
    state.lastSearchDecayTick = now;
  }

  return state;
}

export function beginWatcherSearch(state, tick = 0) {
  if (!state) return state;
  const now = Math.max(0, Math.floor(Number(tick) || 0));
  state.behavior = WATCHER_BEHAVIOR.Search;
  state.searchStartedTick = now;
  state.lastSearchAdvanceTick = now;
  state.lastSearchDecayTick = now;
  state.searchConfidence = clamp(Math.max(0.35, state.confidence), 0, 1);
  state.searchRadius = 6;
  state.searchedLocations.length = 0;
  return state;
}

export function advanceWatcherSearch(state, tick = 0, candidates = [], randomFn = Math.random) {
  if (!state) {
    return { behavior: WATCHER_BEHAVIOR.Disengage, target: undefined, searchRadius: 0 };
  }
  const now = Math.max(0, Math.floor(Number(tick) || 0));
  if (state.searchStartedTick <= -999000) {
    beginWatcherSearch(state, now);
  }

  tickWatcherEvidence(state, now);
  const searchAge = Math.max(0, now - state.searchStartedTick);
  if (searchAge >= MAX_SEARCH_TICKS || state.searchConfidence <= SEARCH_MIN_CONFIDENCE) {
    state.behavior = WATCHER_BEHAVIOR.Disengage;
    return {
      behavior: state.behavior,
      target: undefined,
      searchRadius: state.searchRadius,
      confidence: state.searchConfidence,
    };
  }

  const searched = new Set(state.searchedLocations);
  const available = (Array.isArray(candidates) ? candidates : [])
    .filter(Boolean)
    .filter((candidate) => !searched.has(locationKey(candidate)));

  let target;
  if (available.length > 0) {
    const roll = clamp(randomFn(), 0, 0.999999999);
    target = cloneLocation(available[Math.floor(roll * available.length)]);
  } else if (state.lastKnownPosition) {
    const angle = clamp(randomFn(), 0, 0.999999999) * Math.PI * 2;
    const radius = Math.max(2, state.searchRadius * (0.35 + clamp(randomFn(), 0, 1) * 0.65));
    target = {
      x: state.lastKnownPosition.x + Math.cos(angle) * radius,
      y: state.lastKnownPosition.y,
      z: state.lastKnownPosition.z + Math.sin(angle) * radius,
    };
  }

  if (target) {
    state.searchedLocations.push(locationKey(target));
    while (state.searchedLocations.length > SEARCHED_LOCATION_LIMIT) {
      state.searchedLocations.shift();
    }
    state.searchConfidence = clamp(state.searchConfidence - 0.035, 0, 1);
  }

  state.lastSearchAdvanceTick = now;
  state.behavior = WATCHER_BEHAVIOR.Search;
  return {
    behavior: state.behavior,
    target,
    searchRadius: state.searchRadius,
    confidence: state.searchConfidence,
  };
}

export function predictWatcherInterception(state, options = {}, randomFn = Math.random) {
  if (!state?.lastKnownPosition) {
    return { success: false, deliberateFailure: false, location: undefined, confidence: 0 };
  }

  const routeConfidence = clamp(options.routeConfidence ?? state.confidence, 0, 1);
  const failureChance = clamp(options.failureChance ?? (0.42 - routeConfidence * 0.24), 0.08, 0.65);
  if (clamp(randomFn(), 0, 1) < failureChance) {
    return {
      success: false,
      deliberateFailure: true,
      location: undefined,
      confidence: routeConfidence,
    };
  }

  const direction = normalizeXZ(options.direction || state.movementDirection);
  if ((!direction.x && !direction.z) || routeConfidence <= 0.05) {
    return { success: false, deliberateFailure: false, location: undefined, confidence: routeConfidence };
  }

  const distance = Math.max(4, Number(options.distance) || 12);
  const uncertainty = Math.max(0, Number(options.uncertainty) || Math.max(2, 8 * (1 - routeConfidence)));
  const right = { x: -direction.z, z: direction.x };
  const lateral = (clamp(randomFn(), 0, 1) * 2 - 1) * uncertainty;
  const forwardDistance = distance * (0.72 + routeConfidence * 0.28);

  return {
    success: true,
    deliberateFailure: false,
    confidence: routeConfidence,
    location: {
      x: state.lastKnownPosition.x + direction.x * forwardDistance + right.x * lateral,
      y: state.lastKnownPosition.y,
      z: state.lastKnownPosition.z + direction.z * forwardDistance + right.z * lateral,
    },
  };
}

export function chooseEvidenceDrivenBehavior(state, context = {}) {
  if (!state) return WATCHER_BEHAVIOR.Dormant;
  if (context.safeRoom === true || String(context.directorPhase || "").toLowerCase() === "relief") {
    return WATCHER_BEHAVIOR.Disengage;
  }

  const suspicion = clamp(state.suspicion, 0, MAX_SUSPICION);
  if (state.behavior === WATCHER_BEHAVIOR.Search && state.searchConfidence > SEARCH_MIN_CONFIDENCE) {
    return WATCHER_BEHAVIOR.Search;
  }
  if (state.confirmed && suspicion >= 90) return WATCHER_BEHAVIOR.Pursue;
  if (suspicion >= 70) return WATCHER_BEHAVIOR.Alerted;
  if (suspicion >= 45) return WATCHER_BEHAVIOR.Investigate;

  const now = Math.max(0, Math.floor(Number(context.currentTick ?? state.lastEvidenceTick) || 0));
  const recentEvidenceAge = Math.max(0, now - (Number(state.lastEvidenceTick) || 0));
  const freshInvestigativeEvidence =
    recentEvidenceAge <= 20 * 6 &&
    (state.lastEvidenceKind === EVIDENCE_KIND.Sound || state.lastEvidenceKind === EVIDENCE_KIND.Interaction);
  if (freshInvestigativeEvidence) return WATCHER_BEHAVIOR.Investigate;

  if (suspicion >= 20) return WATCHER_BEHAVIOR.Shadow;
  return WATCHER_BEHAVIOR.Observe;
}

export function hasWatcherAttackEvidence(state, tick = 0) {
  if (!state) return false;
  const now = Math.max(0, Math.floor(Number(tick) || 0));
  const freshSight = state.confirmed && now - (Number(state.lastSightTick) || -999999) <= CONFIRMED_SIGHT_STALE_TICKS;
  if (freshSight) return true;

  const freshSound =
    state.lastEvidenceKind === EVIDENCE_KIND.Sound &&
    state.lastEvidenceStrength >= 0.7 &&
    now - (Number(state.lastSoundTick) || -999999) <= FRESH_SOUND_ATTACK_TICKS;
  const freshInteraction =
    state.lastEvidenceKind === EVIDENCE_KIND.Interaction &&
    state.lastEvidenceStrength >= 0.82 &&
    now - (Number(state.lastInteractionTick) || -999999) <= FRESH_SOUND_ATTACK_TICKS;
  return freshSound || freshInteraction;
}

export function evaluateRepositionFairness(input = {}) {
  const phase = String(input.directorPhase || "").toLowerCase();
  if (input.protectedRelief === true || phase === "relief") return { allowed: false, reason: "relief" };
  if (input.physicallyValid !== true) return { allowed: false, reason: "invalid_destination" };
  if (input.visibleFromPlayer === true || input.strongLineOfSight === true) return { allowed: false, reason: "visible" };
  if (Math.max(0, Number(input.budgetRemaining) || 0) <= 0) return { allowed: false, reason: "budget" };
  if (input.patternRepeated === true) return { allowed: false, reason: "repeated_pattern" };
  if ((Number(input.destinationDistance) || 0) < Math.max(0, Number(input.minSafeDistance) || 0)) {
    return { allowed: false, reason: "too_close" };
  }
  return { allowed: true, reason: "allowed" };
}
