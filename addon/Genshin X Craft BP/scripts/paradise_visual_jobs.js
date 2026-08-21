import { system, world } from "@minecraft/server";

const MAX_ACTIVE_VISUAL_JOBS = 2;
const pendingJobs = [];
const activeKeys = new Set();
let activeCount = 0;
const placementStats = {
  placed: 0,
  retried: 0,
  failed: 0,
};

export function hash32(value) {
  let n = value | 0;
  n ^= n >>> 16;
  n = Math.imul(n, 0x7feb352d);
  n ^= n >>> 15;
  n = Math.imul(n, 0x846ca68b);
  n ^= n >>> 16;
  return n >>> 0;
}

export function hashCoords(x, z, salt = 0) {
  return hash32(
    Math.imul(x | 0, 0x8da6b343) ^
      Math.imul(z | 0, 0xd8163841) ^
      Math.imul(salt | 0, 0x9e3779b1)
  );
}

export function shouldPlaceRare(x, z, period, salt = 0) {
  const safePeriod = Math.max(1, Math.floor(period));
  return hashCoords(x, z, salt) % safePeriod === 0;
}

function pump() {
  while (activeCount < MAX_ACTIVE_VISUAL_JOBS && pendingJobs.length > 0) {
    const job = pendingJobs.shift();
    if (!job || activeKeys.has(job.key)) continue;

    activeKeys.add(job.key);
    activeCount++;

    system.runJob(
      (function* () {
        try {
          const generator = job.generatorFactory();
          for (const value of generator) {
            yield value;
          }
        } finally {
          activeKeys.delete(job.key);
          activeCount = Math.max(0, activeCount - 1);
          system.run(pump);
        }
      })()
    );
  }
}

export function scheduleVisualJob(key, generatorFactory) {
  if (!key || typeof generatorFactory !== "function") return false;
  if (activeKeys.has(key) || pendingJobs.some((job) => job.key === key)) return false;
  pendingJobs.push({ key, generatorFactory });
  system.run(pump);
  return true;
}

export function getVisualJobStats() {
  return {
    active: activeCount,
    queued: pendingJobs.length,
    placed: placementStats.placed,
    retried: placementStats.retried,
    failed: placementStats.failed,
  };
}


export function placePackStructure(structureId, dimension, location) {
  if (!structureId || !dimension || !location) return false;
  try {
    world.structureManager.place(structureId, dimension, location, {
      includeBlocks: true,
      includeEntities: false,
    });
    return true;
  } catch {
    return false;
  }
}

export function scheduleStructurePlacement(key, structureId, dimension, location) {
  return scheduleVisualJob(key, function* () {
    let placed = placePackStructure(structureId, dimension, location);
    if (!placed) {
      placementStats.retried += 1;
      // One tick-sized yield gives transient chunk/loading failures one bounded
      // recovery chance without creating a retry loop or an extra queued job.
      yield;
      placed = placePackStructure(structureId, dimension, location);
    }

    if (placed) placementStats.placed += 1;
    else placementStats.failed += 1;
    yield;
  });
}
