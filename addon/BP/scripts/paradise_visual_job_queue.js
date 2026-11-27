/**
 * @typedef {{ isCancelled: () => boolean }} VisualJobContext
 * @typedef {{ key: string, owner: string, generatorFactory: (context: VisualJobContext) => Generator<void, void, void>, cancelled: boolean, cancellationNotified: boolean, onCancelled?: () => void }} VisualJob
 * @typedef {{ schedule: (callback: () => void) => void, runJob: (generator: Generator<void, void, void>) => unknown, maxActive?: number, maxPending?: number, maxPendingPerOwner?: number, onError?: (error: unknown, key: string) => void }} VisualJobQueueOptions
 */

/**
 * A bounded, deduplicating visual-work queue with owner-scoped cancellation.
 *
 * @param {VisualJobQueueOptions} options
 */
export function createVisualJobQueue(options) {
  const maxActive = Math.max(1, Math.floor(options.maxActive ?? 2));
  const maxPending = Math.max(1, Math.floor(options.maxPending ?? 128));
  const maxPendingPerOwner = Math.max(1, Math.floor(options.maxPendingPerOwner ?? 32));
  const pendingJobs = [];
  const pendingByKey = new Map();
  const activeByKey = new Map();
  const ownerJobs = new Map();
  const pendingByOwner = new Map();
  let pendingHead = 0;
  let pendingCount = 0;
  let activeCount = 0;
  let pumpScheduled = false;
  let droppedCount = 0;
  let cancelledCount = 0;
  let failedCount = 0;

  function addOwnerJob(job) {
    let jobs = ownerJobs.get(job.owner);
    if (!jobs) {
      jobs = new Set();
      ownerJobs.set(job.owner, jobs);
    }
    jobs.add(job);
  }

  function removeOwnerJob(job) {
    const jobs = ownerJobs.get(job.owner);
    if (!jobs) return;
    jobs.delete(job);
    if (jobs.size === 0) ownerJobs.delete(job.owner);
  }

  function notifyCancelled(job) {
    if (job.cancellationNotified) return;
    job.cancellationNotified = true;
    try {
      job.onCancelled?.();
    } catch (error) {
      failedCount += 1;
      options.onError?.(error, job.key);
    }
  }

  function decrementPendingOwner(owner) {
    const next = Math.max(0, (pendingByOwner.get(owner) ?? 0) - 1);
    if (next === 0) pendingByOwner.delete(owner);
    else pendingByOwner.set(owner, next);
  }

  function compactPendingJobs() {
    if (pendingHead > 64 && pendingHead * 2 >= pendingJobs.length) {
      pendingJobs.splice(0, pendingHead);
      pendingHead = 0;
    }
  }

  function schedulePump() {
    if (pumpScheduled) return;
    pumpScheduled = true;
    try {
      options.schedule(pump);
    } catch (error) {
      pumpScheduled = false;
      throw error;
    }
  }

  function releaseActiveJob(job) {
    if (activeByKey.get(job.key) !== job) return;
    activeByKey.delete(job.key);
    activeCount = Math.max(0, activeCount - 1);
    removeOwnerJob(job);
    schedulePump();
  }

  function wrapGenerator(job) {
    return (function* () {
      let inner;
      try {
        inner = job.generatorFactory({ isCancelled: () => job.cancelled });
        while (!job.cancelled) {
          const next = inner.next();
          if (next.done) break;
          yield next.value;
        }
      } catch (error) {
        failedCount += 1;
        options.onError?.(error, job.key);
        throw error;
      } finally {
        try {
          if (job.cancelled) {
            if (inner && typeof inner.return === "function") inner.return();
            notifyCancelled(job);
          }
        } finally {
          releaseActiveJob(job);
        }
      }
    })();
  }

  function pump() {
    pumpScheduled = false;
    while (activeCount < maxActive && pendingHead < pendingJobs.length) {
      const job = pendingJobs[pendingHead];
      pendingJobs[pendingHead] = undefined;
      pendingHead += 1;
      if (!job) continue;

      if (pendingByKey.get(job.key) === job) {
        pendingByKey.delete(job.key);
        pendingCount = Math.max(0, pendingCount - 1);
        decrementPendingOwner(job.owner);
      }

      if (job.cancelled || activeByKey.has(job.key)) {
        if (job.cancelled) notifyCancelled(job);
        removeOwnerJob(job);
        continue;
      }

      activeByKey.set(job.key, job);
      activeCount += 1;
      try {
        options.runJob(wrapGenerator(job));
      } catch (error) {
        failedCount += 1;
        options.onError?.(error, job.key);
        releaseActiveJob(job);
      }
    }
    compactPendingJobs();
  }

  function schedule(key, generatorFactory, owner = "global", onCancelled = undefined) {
    if (typeof key !== "string" || key.length === 0 || typeof generatorFactory !== "function") return false;
    if (pendingByKey.has(key) || activeByKey.has(key)) return false;

    const normalizedOwner = typeof owner === "string" && owner.length > 0 ? owner : "global";
    const ownerPending = pendingByOwner.get(normalizedOwner) ?? 0;
    if (pendingCount >= maxPending || ownerPending >= maxPendingPerOwner) {
      droppedCount += 1;
      return false;
    }

    const job = {
      key,
      owner: normalizedOwner,
      generatorFactory,
      cancelled: false,
      cancellationNotified: false,
      onCancelled,
    };
    pendingJobs.push(job);
    pendingByKey.set(key, job);
    pendingCount += 1;
    pendingByOwner.set(normalizedOwner, ownerPending + 1);
    addOwnerJob(job);
    schedulePump();
    return true;
  }

  function cancelOwner(owner) {
    const jobs = ownerJobs.get(owner);
    if (!jobs) return 0;
    let cancelled = 0;
    for (const job of jobs) {
      if (job.cancelled) continue;
      job.cancelled = true;
      cancelled += 1;
      cancelledCount += 1;
      notifyCancelled(job);
      if (pendingByKey.get(job.key) === job) {
        pendingByKey.delete(job.key);
        pendingCount = Math.max(0, pendingCount - 1);
        decrementPendingOwner(job.owner);
      }
    }
    schedulePump();
    return cancelled;
  }

  function cancelKey(key) {
    const job = pendingByKey.get(key) ?? activeByKey.get(key);
    if (!job) return false;
    if (!job.cancelled) {
      job.cancelled = true;
      cancelledCount += 1;
      notifyCancelled(job);
      if (pendingByKey.get(key) === job) {
        pendingByKey.delete(key);
        pendingCount = Math.max(0, pendingCount - 1);
        decrementPendingOwner(job.owner);
      }
    }
    schedulePump();
    return true;
  }

  function getStats() {
    return {
      active: activeCount,
      queued: pendingCount,
      dropped: droppedCount,
      cancelled: cancelledCount,
      failed: failedCount,
    };
  }

  return { schedule, cancelOwner, cancelKey, getStats };
}
