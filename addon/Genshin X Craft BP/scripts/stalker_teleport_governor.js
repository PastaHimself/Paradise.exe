import { recordPlayerTelemetry, recordTelemetry } from "./paradise_telemetry.js";

const DEFAULT_MIN_TELEPORT_TICKS = 20 * 12;
const DEFAULT_VISIBLE_MIN_TELEPORT_TICKS = 20 * 20;
const DEFAULT_MAX_PER_ENCOUNTER = 2;

const phasePolicy = Object.freeze({
  dormant: { minTicks: 20 * 45, visibleMinTicks: 20 * 60, maxPerEncounter: 0 },
  presence: { minTicks: 20 * 18, visibleMinTicks: 20 * 28, maxPerEncounter: 1 },
  observe: { minTicks: 20 * 22, visibleMinTicks: 20 * 32, maxPerEncounter: 1 },
  shadow: { minTicks: 20 * 22, visibleMinTicks: 20 * 32, maxPerEncounter: 1 },
  pressure: { minTicks: 20 * 30, visibleMinTicks: 20 * 45, maxPerEncounter: 0 },
  hunt: { minTicks: 20 * 30, visibleMinTicks: 20 * 45, maxPerEncounter: 0 },
  warning: { minTicks: 20 * 30, visibleMinTicks: 20 * 45, maxPerEncounter: 0 },
  lunge: { minTicks: 20 * 12, visibleMinTicks: 20 * 20, maxPerEncounter: 0 },
  ambush: { minTicks: 20 * 10, visibleMinTicks: 20 * 18, maxPerEncounter: 1 },
  resolve: { minTicks: 20 * 30, visibleMinTicks: 20 * 45, maxPerEncounter: 0 },
  vanish: { minTicks: 20 * 18, visibleMinTicks: 20 * 30, maxPerEncounter: 1 },
  cooldown: { minTicks: 20 * 60, visibleMinTicks: 20 * 80, maxPerEncounter: 0 },
  psychological: { minTicks: 20 * 24, visibleMinTicks: 20 * 36, maxPerEncounter: 1 },
  library_hunt: { minTicks: 20 * 14, visibleMinTicks: 20 * 24, maxPerEncounter: 2 },
});

const entityRecords = new Map();

function currentTickOf(value) {
  const tick = Number(value);
  return Number.isFinite(tick) ? Math.max(0, Math.floor(tick)) : 0;
}

function idOf(value, fallback = "unknown") {
  return String(value?.id || value?.name || value || fallback);
}

function distanceSquared(a, b) {
  if (!a || !b) {
    return Number.POSITIVE_INFINITY;
  }
  const dx = (Number(a.x) || 0) - (Number(b.x) || 0);
  const dy = (Number(a.y) || 0) - (Number(b.y) || 0);
  const dz = (Number(a.z) || 0) - (Number(b.z) || 0);
  return dx * dx + dy * dy + dz * dz;
}

function getRecord(entityOrId) {
  const entityId = idOf(entityOrId);
  let record = entityRecords.get(entityId);
  if (!record) {
    record = {
      entityId,
      lastTeleportTick: -999999,
      lastVisibleTeleportTick: -999999,
      lastReason: "none",
      lastPhase: "dormant",
      totalAllowed: 0,
      totalDenied: 0,
      encounterKey: "",
      encounterCount: 0,
      recent: [],
    };
    entityRecords.set(entityId, record);
  }
  return record;
}

function getEncounterKey(player, state, phase, options = {}) {
  if (options.encounterKey) {
    return String(options.encounterKey);
  }
  const playerId = idOf(player);
  const entityId = idOf(state?.entityId || options.entityId || "entity");
  const phaseStart = Number(state?.phaseChangedTick || 0) || 0;
  return `${playerId}:${entityId}:${phase}:${phaseStart}`;
}

function pushRecent(record, entry) {
  record.recent.push(entry);
  while (record.recent.length > 12) {
    record.recent.shift();
  }
}

function resolvePolicy(phase, options = {}) {
  const normalizedPhase = String(phase || "observe").toLowerCase();
  const policy = phasePolicy[normalizedPhase] || phasePolicy.observe;
  return {
    phase: normalizedPhase,
    minTicks: Math.max(0, Number(options.minTicks ?? policy.minTicks ?? DEFAULT_MIN_TELEPORT_TICKS)),
    visibleMinTicks: Math.max(0, Number(options.visibleMinTicks ?? policy.visibleMinTicks ?? DEFAULT_VISIBLE_MIN_TELEPORT_TICKS)),
    maxPerEncounter: Math.max(0, Number(options.maxPerEncounter ?? policy.maxPerEncounter ?? DEFAULT_MAX_PER_ENCOUNTER)),
  };
}

export function resetStalkerTeleportBudget(entityOrId, reason = "reset") {
  const record = getRecord(entityOrId);
  record.encounterKey = "";
  record.encounterCount = 0;
  record.lastReason = reason;
  return record;
}

export function canTeleportStalker(options = {}) {
  const tick = currentTickOf(options.currentTick);
  const entity = options.entity;
  const player = options.player;
  const state = options.state;
  const phase = String(options.phase || state?.phase || "observe").toLowerCase();
  const reason = String(options.reason || "move");
  const record = getRecord(entity || options.entityId || state?.entityId);
  const policy = resolvePolicy(phase, options);
  const encounterKey = getEncounterKey(player, state, phase, { ...options, entityId: record.entityId });
  const movedDistanceSq = distanceSquared(options.fromLocation || entity?.location, options.toLocation || options.location);
  const visible = options.visible === true;
  const isOrientationOnly = Number.isFinite(movedDistanceSq) && movedDistanceSq <= 0.04;

  if (record.encounterKey !== encounterKey) {
    record.encounterKey = encounterKey;
    record.encounterCount = 0;
  }

  const nearPlayerDistanceSq = distanceSquared(player?.location, options.toLocation || options.location);
  const isNearPlayerTeleport = Number.isFinite(nearPlayerDistanceSq) && nearPlayerDistanceSq <= 24 * 24;
  const canBlinkNearPlayer = policy.phase === "vanish" || reason.startsWith("ambush-warning") || reason.startsWith("dimension-sync");
  if (isNearPlayerTeleport && !canBlinkNearPlayer && !isOrientationOnly && options.force !== true && options.skipGovernor !== true) {
    return {
      allowed: false,
      reason: "noBlinkZone",
      phase: policy.phase,
      encounterKey,
      remainingTicks: policy.minTicks,
    };
  }

  if (options.force === true || options.skipGovernor === true || isOrientationOnly) {
    return {
      allowed: true,
      reason: "forced",
      phase: policy.phase,
      encounterKey,
      remainingBudget: Math.max(0, policy.maxPerEncounter - record.encounterCount),
    };
  }

  if (record.encounterCount >= policy.maxPerEncounter) {
    return {
      allowed: false,
      reason: "encounterBudgetExceeded",
      phase: policy.phase,
      encounterKey,
      remainingTicks: 0,
    };
  }

  const sinceLast = tick - record.lastTeleportTick;
  if (sinceLast < policy.minTicks) {
    return {
      allowed: false,
      reason: "minTeleportCooldown",
      phase: policy.phase,
      encounterKey,
      remainingTicks: policy.minTicks - sinceLast,
    };
  }

  if (visible) {
    const sinceVisible = tick - record.lastVisibleTeleportTick;
    if (sinceVisible < policy.visibleMinTicks) {
      return {
        allowed: false,
        reason: "visibleTeleportCooldown",
        phase: policy.phase,
        encounterKey,
        remainingTicks: policy.visibleMinTicks - sinceVisible,
      };
    }
  }

  return {
    allowed: true,
    reason: "allowed",
    phase: policy.phase,
    encounterKey,
    remainingBudget: Math.max(0, policy.maxPerEncounter - record.encounterCount - 1),
  };
}

export function recordStalkerTeleport(options = {}) {
  const tick = currentTickOf(options.currentTick);
  const record = getRecord(options.entity || options.entityId || options.state?.entityId);
  const phase = String(options.phase || options.state?.phase || "observe").toLowerCase();
  const reason = String(options.reason || "move");
  const allowed = options.allowed !== false;
  const entry = {
    tick,
    phase,
    reason,
    status: allowed ? "allowed" : "denied",
    denialReason: options.denialReason || "",
    playerId: idOf(options.player),
  };

  if (allowed) {
    record.lastTeleportTick = tick;
    if (options.visible === true) {
      record.lastVisibleTeleportTick = tick;
    }
    record.encounterCount += options.skipBudget === true ? 0 : 1;
    record.totalAllowed += 1;
  } else {
    record.totalDenied += 1;
  }

  record.lastReason = reason;
  record.lastPhase = phase;
  pushRecent(record, entry);

  const telemetry = options.player
    ? recordPlayerTelemetry(options.player, "stalker_teleport", {
        currentTick: tick,
        source: "stalker_teleport_governor",
        reason,
        status: entry.status,
        phase,
        denialReason: entry.denialReason,
        entityId: record.entityId,
        totalAllowed: record.totalAllowed,
        totalDenied: record.totalDenied,
      })
    : recordTelemetry("stalker_teleport", {
        currentTick: tick,
        source: "stalker_teleport_governor",
        reason,
        status: entry.status,
        phase,
        denialReason: entry.denialReason,
        entityId: record.entityId,
      });

  return { record: { ...record, recent: [...record.recent] }, telemetry };
}

export function getStalkerTeleportDebugSnapshot(entityOrId) {
  const record = getRecord(entityOrId);
  return {
    ...record,
    recent: [...record.recent],
  };
}

export function clearStalkerTeleportGovernor(entityOrId) {
  entityRecords.delete(idOf(entityOrId));
}

export function clearStalkerTeleportGovernors() {
  entityRecords.clear();
}
