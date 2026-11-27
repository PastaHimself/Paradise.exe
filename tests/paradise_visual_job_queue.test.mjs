import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createVisualJobQueue } from "../addon/BP/scripts/paradise_visual_job_queue.js";

function createHarness(options = {}) {
  const scheduled = [];
  const running = [];
  const queue = createVisualJobQueue({
    schedule(callback) {
      scheduled.push(callback);
    },
    runJob(generator) {
      running.push(generator);
    },
    ...options,
  });
  return { queue, scheduled, running };
}

function drain(generator) {
  let result = generator.next();
  while (!result.done) result = generator.next();
}

describe("bounded visual job queue", () => {
  it("bounds total and per-owner backlog, deduplicates in-flight keys, and schedules one pump", () => {
    const harness = createHarness({ maxActive: 2, maxPending: 3, maxPendingPerOwner: 2 });
    const emptyJob = function* () { yield; };

    assert.equal(harness.queue.schedule("a:1", emptyJob, "dimension-a"), true);
    assert.equal(harness.queue.schedule("a:1", emptyJob, "dimension-a"), false);
    assert.equal(harness.queue.schedule("a:2", emptyJob, "dimension-a"), true);
    assert.equal(harness.queue.schedule("a:3", emptyJob, "dimension-a"), false);
    assert.equal(harness.queue.schedule("b:1", emptyJob, "dimension-b"), true);
    assert.equal(harness.queue.schedule("c:1", emptyJob, "dimension-c"), false);
    assert.equal(harness.scheduled.length, 1);
    assert.deepEqual(harness.queue.getStats(), {
      active: 0,
      queued: 3,
      dropped: 2,
      cancelled: 0,
      failed: 0,
    });

    harness.scheduled.shift()();
    assert.equal(harness.running.length, 2);
    assert.deepEqual(harness.queue.getStats(), {
      active: 2,
      queued: 1,
      dropped: 2,
      cancelled: 0,
      failed: 0,
    });

    drain(harness.running[0]);
    assert.equal(harness.scheduled.length, 1);
    harness.scheduled.shift()();
    assert.equal(harness.running.length, 3);
    drain(harness.running[1]);
    drain(harness.running[2]);
    assert.deepEqual(harness.queue.getStats(), {
      active: 0,
      queued: 0,
      dropped: 2,
      cancelled: 0,
      failed: 0,
    });
  });

  it("cancels queued and active work by owner without allowing a cancelled generator to continue", () => {
    const harness = createHarness({ maxActive: 1, maxPending: 4, maxPendingPerOwner: 4 });
    let steps = 0;
    const job = function* () {
      steps += 1;
      yield;
      steps += 1;
      yield;
      steps += 1;
    };

    harness.queue.schedule("patch:0:0:active", job, "patch:0:0");
    harness.queue.schedule("patch:0:0:pending", job, "patch:0:0");
    harness.scheduled.shift()();
    assert.equal(harness.running.length, 1);
    assert.deepEqual(harness.queue.getStats(), {
      active: 1,
      queued: 1,
      dropped: 0,
      cancelled: 0,
      failed: 0,
    });
    harness.running[0].next();
    assert.equal(steps, 1);

    assert.equal(harness.queue.cancelOwner("patch:0:0"), 2);
    assert.equal(harness.queue.getStats().queued, 0);
    harness.running[0].next();
    assert.equal(steps, 1);
    assert.equal(harness.queue.getStats().active, 0);
    assert.equal(harness.queue.getStats().cancelled, 2);

    harness.scheduled.shift()();
    assert.equal(harness.running.length, 1);
    assert.equal(harness.queue.getStats().queued, 0);
  });

  it("releases active capacity and reports generator failures", () => {
    const errors = [];
    const harness = createHarness({
      onError(error, key) {
        errors.push({ error, key });
      },
    });
    harness.queue.schedule("broken", function* () {
      throw new Error("fixture failure");
    }, "test");
    harness.scheduled.shift()();
    assert.throws(() => harness.running[0].next(), /fixture failure/);
    assert.equal(harness.queue.getStats().active, 0);
    assert.equal(harness.queue.getStats().failed, 1);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].key, "broken");
  });
});
