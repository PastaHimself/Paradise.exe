const DEFAULT_GLOBAL_LIMIT = 96;
const DEFAULT_PLAYER_LIMIT = 48;

const globalEvents = [];
const playerEvents = new Map();
const counters = new Map();

function nowTick(explicitTick) {
  const tick = Number(explicitTick);
  return Number.isFinite(tick) ? Math.max(0, Math.floor(tick)) : 0;
}

function normalizeKey(value, fallback = "unknown") {
  const text = String(value || "").trim();
  return text.length > 0 ? text : fallback;
}

function getPlayerId(playerOrId) {
  if (typeof playerOrId === "string") {
    return normalizeKey(playerOrId);
  }
  return normalizeKey(playerOrId?.id || playerOrId?.name);
}

function trimList(list, limit) {
  const max = Math.max(1, Number(limit) || DEFAULT_GLOBAL_LIMIT);
  while (list.length > max) {
    list.shift();
  }
}

function incrementCounter(key, amount = 1) {
  const counterKey = normalizeKey(key);
  counters.set(counterKey, (counters.get(counterKey) || 0) + amount);
}

export function recordTelemetry(channel, data = {}) {
  const entry = {
    tick: nowTick(data.currentTick ?? data.tick),
    channel: normalizeKey(channel, "general"),
    source: normalizeKey(data.source, "unknown"),
    reason: normalizeKey(data.reason, "none"),
    status: normalizeKey(data.status, "recorded"),
    ...data,
  };

  globalEvents.push(entry);
  trimList(globalEvents, data.limit || DEFAULT_GLOBAL_LIMIT);
  incrementCounter(`${entry.channel}:${entry.status}`);
  return entry;
}

export function recordPlayerTelemetry(playerOrId, channel, data = {}) {
  const playerId = getPlayerId(playerOrId);
  const entry = recordTelemetry(channel, {
    ...data,
    playerId,
  });

  let list = playerEvents.get(playerId);
  if (!list) {
    list = [];
    playerEvents.set(playerId, list);
  }
  list.push(entry);
  trimList(list, data.playerLimit || DEFAULT_PLAYER_LIMIT);
  return entry;
}

export function getTelemetrySnapshot(limit = 24) {
  const count = Math.max(1, Math.floor(Number(limit) || 24));
  return globalEvents.slice(-count);
}

export function getPlayerTelemetrySnapshot(playerOrId, limit = 16) {
  const playerId = getPlayerId(playerOrId);
  const count = Math.max(1, Math.floor(Number(limit) || 16));
  return (playerEvents.get(playerId) || []).slice(-count);
}

export function getTelemetryCounters() {
  const result = {};
  for (const [key, value] of counters.entries()) {
    result[key] = value;
  }
  return result;
}

export function clearPlayerTelemetry(playerOrId) {
  playerEvents.delete(getPlayerId(playerOrId));
}

export function formatTelemetryEntry(entry) {
  if (!entry) {
    return "no telemetry";
  }
  const player = entry.playerId ? ` player=${entry.playerId}` : "";
  const reason = entry.reason ? ` reason=${entry.reason}` : "";
  return `tick=${entry.tick} channel=${entry.channel} status=${entry.status}${player} source=${entry.source}${reason}`;
}

export function resetTelemetry() {
  globalEvents.length = 0;
  playerEvents.clear();
  counters.clear();
}
