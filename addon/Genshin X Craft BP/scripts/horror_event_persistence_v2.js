export const RESTORATION_JOURNAL_VERSION = 1;

function finiteInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.floor(number) : undefined;
}

function normalizeLocation(location) {
  const x = finiteInteger(location?.x);
  const y = finiteInteger(location?.y);
  const z = finiteInteger(location?.z);
  return x === undefined || y === undefined || z === undefined ? undefined : { x, y, z };
}

function normalizeStates(states) {
  if (!states || typeof states !== 'object' || Array.isArray(states)) return {};
  const output = {};
  for (const [key, value] of Object.entries(states)) {
    if (typeof value === 'boolean' || typeof value === 'string' || Number.isFinite(value)) output[String(key)] = value;
  }
  return output;
}

export function createRestorationSnapshot(input = {}) {
  const location = normalizeLocation(input.location);
  const id = String(input.id || '');
  const dimensionId = String(input.dimensionId || '');
  const restoreTypeId = String(input.restoreTypeId || '');
  if (!id || !dimensionId || !location || !restoreTypeId) return undefined;
  const expectedTypeIds = Array.from(new Set((input.expectedTypeIds || ['minecraft:air']).map(String).filter(Boolean)));
  return {
    id,
    version: RESTORATION_JOURNAL_VERSION,
    dimensionId,
    location,
    restoreTypeId,
    restoreStates: normalizeStates(input.restoreStates),
    expectedTypeIds: expectedTypeIds.length ? expectedTypeIds : ['minecraft:air'],
    createdTick: Math.max(0, finiteInteger(input.createdTick) ?? 0),
  };
}

export function parseRestorationJournal(raw) {
  if (typeof raw !== 'string' || !raw) return [];
  let parsed;
  try { parsed = JSON.parse(raw); } catch (_error) { return []; }
  const records = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.records) ? parsed.records : [];
  const output = [];
  const seen = new Set();
  for (const record of records) {
    if (Number(record?.version) !== RESTORATION_JOURNAL_VERSION) continue;
    const normalized = createRestorationSnapshot(record);
    if (!normalized || seen.has(normalized.id)) continue;
    seen.add(normalized.id);
    output.push(normalized);
  }
  return output;
}

export function serializeRestorationJournal(records) {
  const normalized = [];
  const seen = new Set();
  for (const record of records || []) {
    const snapshot = createRestorationSnapshot(record);
    if (!snapshot || seen.has(snapshot.id)) continue;
    seen.add(snapshot.id);
    normalized.push(snapshot);
  }
  return JSON.stringify({ version: RESTORATION_JOURNAL_VERSION, records: normalized });
}

export function appendRestorationSnapshot(records, record, maxRecords = 128) {
  const max = Math.max(1, Math.floor(Number(maxRecords) || 128));
  const current = parseRestorationJournal(serializeRestorationJournal(records || []));
  const snapshot = createRestorationSnapshot(record);
  if (!snapshot) return current;
  const existingIndex = current.findIndex((entry) => entry.id === snapshot.id);
  if (existingIndex >= 0) {
    current[existingIndex] = snapshot;
    return current;
  }
  if (current.length >= max) return current;
  current.push(snapshot);
  return current;
}

export function removeRestorationSnapshot(records, id) {
  const key = String(id || '');
  return (records || []).filter((record) => String(record?.id || '') !== key);
}
