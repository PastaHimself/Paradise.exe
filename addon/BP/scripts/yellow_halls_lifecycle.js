/**
 * Resolve the exact destination captured when a player entered Yellow Halls.
 *
 * @param {{ dimensionId?: unknown, location?: { x?: unknown, y?: unknown, z?: unknown } } | undefined} returnPoint
 * @returns {{ dimensionId: string, location: { x: number, y: number, z: number } } | undefined}
 */
export function resolveSavedReturnDestination(returnPoint) {
  if (!returnPoint || typeof returnPoint.dimensionId !== "string" || returnPoint.dimensionId.length === 0) {
    return undefined;
  }

  const { location } = returnPoint;
  if (!location) return undefined;
  const { x, y, z } = location;
  if (
    typeof x !== "number" || !Number.isFinite(x) ||
    typeof y !== "number" || !Number.isFinite(y) ||
    typeof z !== "number" || !Number.isFinite(z)
  ) {
    return undefined;
  }

  return {
    dimensionId: returnPoint.dimensionId,
    location: { x, y, z },
  };
}

/**
 * Merge a new caller's requirements into a patch build that has not started.
 *
 * @param {{ force: boolean, includePendingEscapePlayerIds: Set<string> }} current
 * @param {{ force?: boolean, includePendingEscapePlayerIds?: Set<string> }} requested
 * @returns {boolean}
 */
export function mergeYellowHallsPatchBuildOptions(current, requested) {
  let requiresFollowup = false;

  if (requested.force === true && !current.force) {
    current.force = true;
    requiresFollowup = true;
  }

  for (const playerId of requested.includePendingEscapePlayerIds ?? []) {
    if (current.includePendingEscapePlayerIds.has(playerId)) continue;
    current.includePendingEscapePlayerIds.add(playerId);
    requiresFollowup = true;
  }

  return requiresFollowup;
}

/**
 * Serialize builds per patch. The map points to the last scheduled build;
 * requests arriving before that build starts share its options and completion.
 * Once a build starts, a new force request requires a subsequent build.
 *
 * @typedef {{ force: boolean, includePendingEscapePlayerIds: Set<string> }} PatchBuildOptions
 * @typedef {{ started: boolean, options: PatchBuildOptions, promise: Promise<boolean> }} PatchBuildJob
 * @param {Map<string, PatchBuildJob>} jobs
 * @param {string} key
 * @param {{ force?: boolean, includePendingEscapePlayerIds?: Set<string> }} requested
 * @param {(options: PatchBuildOptions) => Promise<boolean>} build
 * @returns {Promise<boolean>}
 */
export function queueYellowHallsPatchBuild(jobs, key, requested, build) {
  const previous = jobs.get(key);
  const options = {
    force: requested.force === true || (requested.includePendingEscapePlayerIds?.size ?? 0) > 0,
    includePendingEscapePlayerIds: new Set(requested.includePendingEscapePlayerIds ?? []),
  };

  if (previous && !previous.started) {
    mergeYellowHallsPatchBuildOptions(previous.options, options);
    return previous.promise;
  }
  if (previous && !options.force) return previous.promise;

  const job = { started: false, options, promise: /** @type {Promise<boolean>} */ (undefined) };
  const ready = previous ? previous.promise.then(() => {}, () => {}) : Promise.resolve();
  job.promise = ready.then(() => {
    job.started = true;
    return build(job.options);
  }).finally(() => {
    if (jobs.get(key) === job) jobs.delete(key);
  });
  jobs.set(key, job);
  return job.promise;
}
