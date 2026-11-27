import { system, world } from "@minecraft/server";
import { createVisualJobQueue } from "./paradise_visual_job_queue.js";

const placementStats = {
  placed: 0,
  retried: 0,
  failed: 0,
};

const visualJobs = createVisualJobQueue({
  schedule: (callback) => system.run(callback),
  runJob: (generator) => system.runJob(generator),
  maxActive: 2,
  maxPending: 128,
  maxPendingPerOwner: 32,
  onError: (error, key) => console.warn(`[Paradise] Visual job failed: ${key}`, error),
});

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

/**
 * @param {string} key
 * @param {(context: { isCancelled: () => boolean }) => Generator<void, void, void>} generatorFactory
 * @param {{ owner?: string, onCancelled?: () => void }} [options]
 * @returns {boolean}
 */
export function scheduleVisualJob(key, generatorFactory, options = {}) {
  return visualJobs.schedule(key, generatorFactory, options.owner ?? "global", options.onCancelled);
}

/**
 * Cancel pending and active visual jobs owned by a dimension or patch.
 * Active generators stop at their next yield boundary.
 *
 * @param {string} owner
 * @returns {number}
 */
export function cancelVisualJobs(owner) {
  return visualJobs.cancelOwner(owner);
}

/**
 * @param {string} key
 * @returns {boolean}
 */
export function cancelVisualJob(key) {
  return visualJobs.cancelKey(key);
}

export function getVisualJobStats() {
  return {
    ...visualJobs.getStats(),
    placed: placementStats.placed,
    retried: placementStats.retried,
    failed: placementStats.failed,
  };
}

export function placePackStructure(structureId, dimension, location) {
  if (!structureId || !dimension || !location) return false;
  world.structureManager.place(structureId, dimension, location, {
    includeBlocks: true,
    includeEntities: false,
  });
  return true;
}

/**
 * @param {string} key
 * @param {string} structureId
 * @param {import("@minecraft/server").Dimension} dimension
 * @param {import("@minecraft/server").Vector3} location
 * @param {{ owner?: string, isPlacementAllowed?: () => boolean }} [options]
 * @returns {Promise<boolean>}
 */
export function scheduleStructurePlacement(key, structureId, dimension, location, options = {}) {
  const owner = options.owner ?? dimension.id;
  const isPlacementAllowed = options.isPlacementAllowed ?? (() => true);
  if (!isPlacementAllowed()) return Promise.resolve(false);

  let resolveCompletion;
  let settled = false;
  const completion = new Promise((resolve) => {
    resolveCompletion = resolve;
  });
  const finish = (placed) => {
    if (settled) return;
    settled = true;
    resolveCompletion(placed);
  };

  const scheduled = scheduleVisualJob(key, function* (context) {
    try {
      if (context.isCancelled() || !isPlacementAllowed()) return;
      let firstError;
      try {
        placePackStructure(structureId, dimension, location);
        placementStats.placed += 1;
        finish(true);
        return;
      } catch (error) {
        firstError = error;
      }

      placementStats.retried += 1;
      yield;
      if (context.isCancelled() || !isPlacementAllowed()) return;
      try {
        placePackStructure(structureId, dimension, location);
        placementStats.placed += 1;
        finish(true);
      } catch (error) {
        placementStats.failed += 1;
        console.warn(`[Paradise] Structure placement failed twice: ${structureId}`, {
          firstError,
          retryError: error,
          dimensionId: dimension.id,
          location,
        });
      }
    } finally {
      finish(false);
    }
  }, { owner, onCancelled: () => finish(false) });

  if (!scheduled) {
    console.warn(`[Paradise] Structure placement was not queued: ${key}`);
    finish(false);
  }
  return completion;
}
