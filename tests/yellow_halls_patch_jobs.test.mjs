import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setImmediate } from "node:timers/promises";
import { describe, it } from "node:test";
import { runInNewContext } from "node:vm";

import { queueYellowHallsPatchBuild } from "../addon/BP/scripts/yellow_halls_lifecycle.js";

const source = readFileSync(new URL("../addon/BP/scripts/yellow_halls.js", import.meta.url), "utf8");
const patchJobSource = source.slice(source.indexOf("function getPatchJob("), source.indexOf("function buildEscapeRoom("));

function fixture() {
  const state = {
    patchJobs: new Map(), generatedPatches: new Map(), dirtyPatches: new Set(),
  };
  const builds = [];
  const getPatchJob = runInNewContext(`${patchJobSource}\ngetPatchJob;`, {
    queueYellowHallsPatchBuild,
    state,
    getPatchKey: (x, z) => `${x}:${z}`,
    getPatchSeed: () => 1,
    shouldRebuildGeneratedPatch: (current, seed, force, dirty) => !current || current.runSeed !== seed || force || dirty,
    system: { currentTick: 1, run: () => {} },
    console: { warn: () => {} },
    paintPatch: (_dimension, x, z, options) => new Promise((resolve, reject) => {
      builds.push({ x, z, options, resolve, reject });
    }),
  });
  return { state, builds, request: (options = {}, x = 1) => getPatchJob({}, x, 0, options) };
}

describe("Yellow Halls actual patch-job orchestration", () => {
  it("merges synchronous callers before the first build starts without a redundant repaint", async () => {
    const { builds, request, state } = fixture();
    const first = request();
    const forced = request({ force: true, includePendingEscapePlayerIds: new Set(["a"]) });
    const second = request({ includePendingEscapePlayerIds: new Set(["b"]) });
    await setImmediate();
    assert.equal(builds.length, 1);
    assert.equal(builds[0].options.force, true);
    assert.deepEqual([...builds[0].options.includePendingEscapePlayerIds].sort(), ["a", "b"]);
    builds[0].resolve();
    assert.deepEqual(await Promise.all([first, forced, second]), [true, true, true]);
    assert.equal(state.patchJobs.size, 0);
  });

  it("does not satisfy a later force request with a build already in progress", async () => {
    const { builds, request, state } = fixture();
    const first = request({ force: true });
    await setImmediate();
    const later = request({ force: true });
    let laterSettled = false;
    void later.then(() => { laterSettled = true; });
    builds[0].resolve();
    assert.equal(await first, true);
    await setImmediate();
    assert.equal(laterSettled, false);
    assert.equal(builds.length, 2);
    builds[1].resolve();
    assert.equal(await later, true);
    assert.equal(state.patchJobs.size, 0);
  });

  it("coalesces overlapping recovery callers into one isolated follow-up and waits for it", async () => {
    const { builds, request } = fixture();
    const initial = request();
    await setImmediate();
    const first = request({ force: true, includePendingEscapePlayerIds: new Set(["a"]) });
    const duplicate = request({ force: true, includePendingEscapePlayerIds: new Set(["a"]) });
    const second = request({ force: true, includePendingEscapePlayerIds: new Set(["b"]) });
    const ordinary = request();
    let settled = 0;
    for (const promise of [first, duplicate, second, ordinary]) void promise.then(() => { settled++; });
    assert.deepEqual([...builds[0].options.includePendingEscapePlayerIds], []);
    builds[0].resolve();
    assert.equal(await initial, true);
    await setImmediate();
    assert.equal(settled, 0);
    assert.equal(builds.length, 2);
    assert.deepEqual([...builds[1].options.includePendingEscapePlayerIds].sort(), ["a", "b"]);
    builds[1].resolve();
    assert.deepEqual(await Promise.all([first, duplicate, second, ordinary]), [true, true, true, true]);
    assert.equal(settled, 4);
    assert.equal(builds.length, 2);
  });

  it("runs queued repair after failure and keeps separate patches independent", async () => {
    const { builds, request, state } = fixture();
    const first = request({ force: true });
    await setImmediate();
    const repair = request({ force: true });
    const unrelated = request({}, 2);
    await setImmediate();
    assert.deepEqual(builds.map((build) => build.x), [1, 2]);
    builds[0].reject(new Error("fixture write failure"));
    builds[1].resolve();
    assert.equal(await first, false);
    assert.equal(await unrelated, true);
    await setImmediate();
    assert.equal(builds.length, 3);
    builds[2].resolve();
    assert.equal(await repair, true);
    assert.equal(state.patchJobs.size, 0);
    assert.equal(state.dirtyPatches.size, 0);
    assert.equal(await request(), false);
  });

  it("does not leak a previous recovery owner's inclusion into a newer forced build", async () => {
    const { builds, request } = fixture();
    const recovery = request({ force: true, includePendingEscapePlayerIds: new Set(["a"]) });
    await setImmediate();
    const next = request({ force: true, includePendingEscapePlayerIds: new Set(["b"]) });
    builds[0].resolve();
    assert.equal(await recovery, true);
    await setImmediate();
    assert.deepEqual([...builds[1].options.includePendingEscapePlayerIds], ["b"]);
    builds[1].resolve();
    assert.equal(await next, true);
  });
});
