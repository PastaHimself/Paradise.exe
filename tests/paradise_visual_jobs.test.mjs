import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { registerHooks } from "node:module";

const harness = {
  scheduled: [],
  running: [],
  placements: [],
  failuresRemaining: 0,
};

globalThis.__paradiseVisualJobHarness = harness;

const serverMockSource = `
const harness = globalThis.__paradiseVisualJobHarness;
export const system = {
  run(callback) {
    harness.scheduled.push(callback);
  },
  runJob(generator) {
    harness.running.push(generator);
  },
};
export const world = {
  structureManager: {
    place(...args) {
      harness.placements.push(args);
      if (harness.failuresRemaining > 0) {
        harness.failuresRemaining -= 1;
        throw new Error("transient structure placement failure");
      }
    },
  },
};
`;

const serverMock = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@minecraft/server") {
      return {
        url: `data:text/javascript,${encodeURIComponent(serverMockSource)}`,
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});

const { cancelVisualJobs, scheduleStructurePlacement } = await import(
  "../addon/BP/scripts/paradise_visual_jobs.js?visual-jobs-test"
);
serverMock.deregister();

function resetHarness() {
  while (harness.scheduled.length > 0) harness.scheduled.shift()();
  harness.scheduled.length = 0;
  harness.running.length = 0;
  harness.placements.length = 0;
  harness.failuresRemaining = 0;
}

describe("queued structure placement lifecycle", () => {
  it("keeps completion pending through a yielded retry and resolves after placement", async () => {
    resetHarness();
    harness.failuresRemaining = 1;

    const completion = scheduleStructurePlacement(
      "visual-test:retry",
      "paradise:test/room",
      { id: "paradise:yellow_halls" },
      { x: 8, y: 65, z: -4 },
      { owner: "visual-test" },
    );

    assert.ok(completion instanceof Promise);
    assert.equal(harness.scheduled.length, 1);
    harness.scheduled.shift()();
    assert.equal(harness.running.length, 1);

    const generator = harness.running[0];
    const firstAttempt = generator.next();
    assert.equal(firstAttempt.done, false);
    assert.equal(harness.placements.length, 1);

    const retry = generator.next();
    assert.equal(retry.done, true);
    assert.equal(await completion, true);
    assert.equal(harness.placements.length, 2);
  });

  it("resolves cancellation even when the queued generator has not started", async () => {
    resetHarness();

    const completion = scheduleStructurePlacement(
      "visual-test:cancel",
      "paradise:test/room",
      { id: "paradise:yellow_halls" },
      { x: 8, y: 65, z: -4 },
      { owner: "visual-cancel" },
    );

    harness.scheduled.shift()();
    assert.equal(harness.running.length, 1);
    assert.equal(cancelVisualJobs("visual-cancel"), 1);
    assert.equal(await completion, false);

    harness.running[0].next();
    while (harness.scheduled.length > 0) harness.scheduled.shift()();
    assert.equal(harness.placements.length, 0);
  });

  it("rechecks the live placement guard when a queued structure job starts", async () => {
    resetHarness();
    let allowed = true;

    const completion = scheduleStructurePlacement(
      "visual-test:escape-race",
      "paradise:test/room",
      { id: "paradise:yellow_halls" },
      { x: 8, y: 65, z: -4 },
      { owner: "visual-escape-race", isPlacementAllowed: () => allowed },
    );

    harness.scheduled.shift()();
    assert.equal(harness.running.length, 1);
    allowed = false;
    harness.running[0].next();

    assert.equal(await completion, false);
    assert.equal(harness.placements.length, 0);
  });
});
