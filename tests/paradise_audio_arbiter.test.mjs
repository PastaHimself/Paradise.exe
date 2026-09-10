import test from "node:test";
import assert from "node:assert/strict";

import {
  AUDIO_CUE_TIER,
  createAudioBudgetState,
  requestAudioCue,
  releaseAudioCue,
} from "../addon/Genshin X Craft BP/scripts/paradise_audio_arbiter.js";

test("audio arbiter allows ambient cues during relief but denies a new peak", () => {
  const initial = createAudioBudgetState();
  const relief = requestAudioCue(initial, {
    tier: AUDIO_CUE_TIER.Ambient,
    currentTick: 100,
    reliefUntilTick: 500,
  });

  assert.equal(relief.allowed, true);
  assert.equal(relief.state.reliefUntilTick, 500);

  const peak = requestAudioCue(relief.state, {
    tier: AUDIO_CUE_TIER.Peak,
    currentTick: 100,
  });
  assert.equal(peak.allowed, false);
  assert.equal(peak.reason, "relief");
});

test("arbiter keeps one peak cue and enforces a 45-second cooldown", () => {
  const first = requestAudioCue(createAudioBudgetState(), {
    cueId: "peak-cue",
    tier: AUDIO_CUE_TIER.Peak,
    currentTick: 200,
  });

  assert.equal(first.allowed, true);
  assert.equal(first.state.peakCooldownUntilTick, 1100);

  const overlapping = requestAudioCue(first.state, {
    cueId: "another-peak",
    tier: AUDIO_CUE_TIER.Peak,
    currentTick: 210,
  });
  assert.equal(overlapping.allowed, false);
  assert.equal(overlapping.reason, "peak_active");

  const released = releaseAudioCue(first.state, "peak-cue", 300);
  const cooldown = requestAudioCue(released, {
    tier: AUDIO_CUE_TIER.Peak,
    currentTick: 301,
  });
  assert.equal(cooldown.allowed, false);
  assert.equal(cooldown.reason, "peak_cooldown");
});

test("arbiter applies the exact one-tick reaction window and is immutable", () => {
  const initial = createAudioBudgetState();
  const reaction = requestAudioCue(initial, {
    cueId: "footstep",
    tier: AUDIO_CUE_TIER.Reaction,
    currentTick: 20,
  });

  assert.equal(reaction.allowed, true);
  assert.equal(reaction.state.reactionUntilTick, 50);
  assert.equal(initial.reactionUntilTick, 0);
  assert.equal(reaction.state.activeCues.includes("footstep"), true);
});
