import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { runSingleFlight } from "../addon/BP/scripts/paradise_single_flight.js";

describe("shared single-flight jobs", () => {
  it("reuses the in-flight promise even when a later caller requests a forced rebuild", async () => {
    const jobs = new Map();
    let release;
    let calls = 0;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const first = runSingleFlight(jobs, "patch:0:0", async () => {
      calls += 1;
      await gate;
      return "built";
    });
    const forced = runSingleFlight(jobs, "patch:0:0", async () => {
      calls += 1;
      return "forced duplicate";
    });

    assert.equal(forced, first);
    await Promise.resolve();
    assert.equal(calls, 1);
    assert.equal(jobs.get("patch:0:0"), first);
    release();
    assert.equal(await first, "built");
    assert.equal(jobs.has("patch:0:0"), false);
  });

  it("releases a failed job so a later repair can retry", async () => {
    const jobs = new Map();
    await assert.rejects(
      runSingleFlight(jobs, "patch:-1:-1", async () => {
        throw new Error("fixture failure");
      }),
      /fixture failure/,
    );
    assert.equal(jobs.has("patch:-1:-1"), false);
    assert.equal(await runSingleFlight(jobs, "patch:-1:-1", async () => true), true);
  });
});
