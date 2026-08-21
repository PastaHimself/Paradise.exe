export const EVENT_FAMILY = Object.freeze({
  Environmental: 'environmental',
  Sensory: 'sensory',
  RealityDistortion: 'reality_distortion',
  PlayerReactive: 'player_reactive',
  WatcherLinked: 'watcher_linked',
  Destructive: 'destructive',
});

export const EVENT_TIER = Object.freeze({
  Omen: 'omen',
  Scenario: 'scenario',
  Major: 'major',
});

const KEY_COOLDOWN_TICKS = 20 * 60 * 30;
const FAMILY_SUPPRESSION_TICKS = 20 * 60 * 10;
const FAMILY_REPEAT_PENALTY_TICKS = 20 * 60 * 20;
const MAX_ACTIVE_SESSIONS = 2;

export function createEventMemory() {
  return {
    keyTicks: new Map(),
    familyTicks: new Map(),
    lastKey: undefined,
    lastFamily: undefined,
    lastCompletedTick: undefined,
  };
}

export function rememberEvent(memory, event, currentTick) {
  if (!memory || !event) return;
  const now = Math.max(0, Number(currentTick) || 0);
  memory.keyTicks.set(event.key, now);
  memory.familyTicks.set(event.family, now);
  memory.lastKey = event.key;
  memory.lastFamily = event.family;
  memory.lastCompletedTick = now;
}

export function createRuntimeState() {
  return {
    activeSessions: new Map(),
  };
}

export function canStartEvent(event, state, playerId) {
  if (!event || !state || !playerId) return false;
  if (state.activeSessions.size >= MAX_ACTIVE_SESSIONS) return false;
  if (event.tier === EVENT_TIER.Major && state.activeSessions.size > 0) return false;
  for (const session of state.activeSessions.values()) {
    if (session.playerId === playerId) return false;
    if (session.tier === EVENT_TIER.Major) return false;
    if (event.family === EVENT_FAMILY.Destructive && session.family === EVENT_FAMILY.Destructive) return false;
  }
  return true;
}

export function markSessionStarted(state, session) {
  if (!state || !session?.id) return false;
  state.activeSessions.set(session.id, { ...session });
  return true;
}

export function markSessionEnded(state, sessionId) {
  if (!state || !sessionId) return false;
  return state.activeSessions.delete(sessionId);
}

export function shouldAbortSessionForDirector(session, directorSnapshot) {
  if (!session || !directorSnapshot?.activeScare) return false;
  return String(directorSnapshot.activeScare.source || '') !== String(session.source || '');
}

function elapsed(now, then) {
  return Math.max(0, now - (Number(then) || 0));
}

function isOnCooldown(memory, event, now) {
  const keyTick = memory.keyTicks.get(event.key);
  if (keyTick !== undefined && elapsed(now, keyTick) < KEY_COOLDOWN_TICKS) return true;
  const familyTick = memory.familyTicks.get(event.family);
  if (familyTick !== undefined && elapsed(now, familyTick) < FAMILY_SUPPRESSION_TICKS) return true;
  return false;
}

function familyRepeatMultiplier(memory, event, now) {
  const familyTick = memory.familyTicks.get(event.family);
  if (familyTick === undefined) return 1;
  const age = elapsed(now, familyTick);
  if (age >= FAMILY_REPEAT_PENALTY_TICKS) return 1;
  const range = FAMILY_REPEAT_PENALTY_TICKS - FAMILY_SUPPRESSION_TICKS;
  const progress = Math.max(0, Math.min(1, (age - FAMILY_SUPPRESSION_TICKS) / Math.max(1, range)));
  return 0.25 + progress * 0.55;
}

export function rankEventCandidates(catalog, context, memory, currentTick, state, playerId) {
  const now = Math.max(0, Number(currentTick) || 0);
  if (!Array.isArray(catalog) || !memory || !state || !playerId) return [];
  if (context?.safeRoom) return [];

  const tension = Number(context?.tension ?? 0);
  const ranked = [];
  for (const event of catalog) {
    if (!event || !event.key || !event.family || !event.tier) continue;
    if (!canStartEvent(event, state, playerId)) continue;
    if (isOnCooldown(memory, event, now)) continue;
    if (Number.isFinite(event.minTension) && tension < event.minTension) continue;
    if (Number.isFinite(event.maxTension) && tension > event.maxTension) continue;
    if (memory.lastCompletedTick !== undefined && Number.isFinite(event.minimumQuietTicks)) {
      if (elapsed(now, memory.lastCompletedTick) < event.minimumQuietTicks) continue;
    }

    let score = 0;
    try {
      score = Number(event.score?.(context) ?? 0);
    } catch (_error) {
      score = 0;
    }
    if (!(score > 0)) continue;
    score *= familyRepeatMultiplier(memory, event, now);
    if (memory.lastKey === event.key) score *= 0.05;
    ranked.push({ event, score });
  }

  ranked.sort((a, b) => b.score - a.score || String(a.event.key).localeCompare(String(b.event.key)));
  return ranked;
}

export function selectEvent(catalog, context, memory, currentTick, state, playerId, random = Math.random) {
  const ranked = rankEventCandidates(catalog, context, memory, currentTick, state, playerId);
  if (!ranked.length) return undefined;
  const top = ranked.slice(0, Math.min(4, ranked.length));
  const jittered = top.map((row) => ({
    ...row,
    utility: row.score * (0.88 + Math.max(0, Math.min(1, Number(random()) || 0)) * 0.24),
  }));
  jittered.sort((a, b) => b.utility - a.utility);
  return jittered[0].event;
}

export function eventStartChance(context, quietTicks) {
  const quietSeconds = Math.max(0, Number(quietTicks) || 0) / 20;
  const tensionNorm = Math.max(0, Math.min(1, Number(context?.tensionNorm ?? (Number(context?.tension || 0) / 100)) || 0));
  const quietProgress = Math.max(0, Math.min(1, (quietSeconds - 15) / 180));
  return Math.max(0.08, Math.min(0.82, 0.08 + quietProgress * 0.46 + tensionNorm * 0.24));
}

export function ambientReadinessScore(sampleTicks, warmupTicks = 20 * 45) {
  const samples = Math.max(0, Number(sampleTicks) || 0);
  const warmup = Math.max(0, Number(warmupTicks) || 0);
  const progress = Math.max(0, Math.min(1, (samples - warmup) / (20 * 75)));
  return progress * 12;
}

export function applyEventPressure(currentValue, intensity) {
  const current = Math.max(0, Number(currentValue) || 0);
  const level = Math.max(0, Number(intensity) || 0);
  return Math.min(100, current + level * 6);
}

export function decayEventPressure(currentValue, elapsedTicks) {
  const current = Math.max(0, Number(currentValue) || 0);
  const ticks = Math.max(0, Number(elapsedTicks) || 0);
  const decay = ticks / (20 * 10);
  return Math.max(0, current - decay);
}

export function serializeEventMemory(memory) {
  if (!memory) return '';
  return JSON.stringify({
    version: 1,
    keyTicks: [...(memory.keyTicks || new Map()).entries()],
    familyTicks: [...(memory.familyTicks || new Map()).entries()],
    lastKey: memory.lastKey,
    lastFamily: memory.lastFamily,
    lastCompletedTick: memory.lastCompletedTick,
  });
}

export function deserializeEventMemory(raw) {
  if (typeof raw !== 'string' || !raw) return createEventMemory();
  let parsed;
  try { parsed = JSON.parse(raw); } catch (_error) { return createEventMemory(); }
  if (Number(parsed?.version) !== 1) return createEventMemory();
  const memory = createEventMemory();
  for (const [key, tick] of Array.isArray(parsed.keyTicks) ? parsed.keyTicks : []) {
    if (key && Number.isFinite(Number(tick))) memory.keyTicks.set(String(key), Math.max(0, Number(tick)));
  }
  for (const [family, tick] of Array.isArray(parsed.familyTicks) ? parsed.familyTicks : []) {
    if (family && Number.isFinite(Number(tick))) memory.familyTicks.set(String(family), Math.max(0, Number(tick)));
  }
  memory.lastKey = parsed.lastKey ? String(parsed.lastKey) : undefined;
  memory.lastFamily = parsed.lastFamily ? String(parsed.lastFamily) : undefined;
  memory.lastCompletedTick = Number.isFinite(Number(parsed.lastCompletedTick)) ? Math.max(0, Number(parsed.lastCompletedTick)) : undefined;
  return memory;
}
