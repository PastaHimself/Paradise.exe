import test from "node:test";
import assert from "node:assert/strict";

import {
  AMBIENT_PLAYBACK_MODE,
  buildAmbientSoundOptions,
  selectAmbientPlaybackMode,
} from "../addon/Genshin X Craft BP/scripts/paradise_audio_playback_model.js";

test("playback mode prefers the retained SoundInstance loop contract", () => {
  assert.equal(
    selectAmbientPlaybackMode({
      loopCount: true,
      soundInstance: true,
      setVolume: true,
      stop: true,
      segmentSoundIds: ["segment-a"],
    }),
    AMBIENT_PLAYBACK_MODE.SoundInstanceLoop,
  );
});

test("playback mode only uses finite segments when the loop handle is unavailable", () => {
  assert.equal(
    selectAmbientPlaybackMode({
      loopCount: false,
      soundInstance: false,
      segmentSoundIds: ["segment-a", "segment-b"],
    }),
    AMBIENT_PLAYBACK_MODE.FiniteSegmentLoop,
  );
  assert.equal(
    selectAmbientPlaybackMode({ loopCount: false, soundInstance: false, segmentSoundIds: [] }),
    AMBIENT_PLAYBACK_MODE.Disabled,
  );
});

test("ambient loop options are bounded and do not include a location", () => {
  assert.deepEqual(buildAmbientSoundOptions(0.72), { loopCount: -1, volume: 0.72 });
  assert.deepEqual(buildAmbientSoundOptions(9), { loopCount: -1, volume: 1 });
});
