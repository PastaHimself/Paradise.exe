/**
 * Run at most one asynchronous operation for a key at a time.
 *
 * @template T
 * @param {Map<string, Promise<T>>} jobs
 * @param {string} key
 * @param {() => Promise<T> | T} work
 * @returns {Promise<T>}
 */
export function runSingleFlight(jobs, key, work) {
  const existing = jobs.get(key);
  if (existing) return existing;

  let job;
  job = Promise.resolve()
    .then(work)
    .finally(() => {
      if (jobs.get(key) === job) jobs.delete(key);
    });
  jobs.set(key, job);
  return job;
}
