import test from "node:test";
import assert from "node:assert/strict";

import {
  AUDIO_SCENE_PROFILES,
  PARADISE_AUDIO_DIMENSION_IDS,
  getAudioSceneProfile,
} from "../addon/Genshin X Craft BP/scripts/paradise_audio_scene_profiles.js";
import {
  getAmbientProfile,
  getPhaseVolume,
  getPlayerAudioPhase,
  shouldRestartAmbient,
} from "../addon/Genshin X Craft BP/scripts/paradise_ambient_audio_model.js";
import { HORROR_PHASE } from "../addon/Genshin X Craft BP/scripts/horror_director.js";
import {
  AUDIO_SOUND_REGISTRY,
  HORROR_SOUND,
  getPlayableSoundId,
} from "../addon/Genshin X Craft BP/scripts/paradise_audio_registry.js";
import { HORROR_EVENT_CATALOG } from "../addon/Genshin X Craft BP/scripts/horror_event_catalog_v2.js";

const EXPECTED_DIMENSIONS = [
  "paradise:yellow_halls",
  "paradise:flat_flower",
  "paradise:endless_staircase",
  "paradise:burning_highway",
  "catacombs:catacomb_mazes",
  "heaven:the_heaven",
  "library:the_library",
];

test("audio scene profiles cover exactly the existing seven dimensions", () => {
  assert.deepEqual([...PARADISE_AUDIO_DIMENSION_IDS].sort(), [...EXPECTED_DIMENSIONS].sort());
  assert.deepEqual(Object.keys(AUDIO_SCENE_PROFILES).sort(), [...EXPECTED_DIMENSIONS].sort());
  for (const dimensionId of EXPECTED_DIMENSIONS) {
    const profile = getAudioSceneProfile(dimensionId);
    assert.ok(profile, `${dimensionId} needs an audio profile`);
    assert.ok(profile.ambientPool, `${dimensionId} needs an ambient pool`);
    assert.ok(profile.allowedPhases.includes(HORROR_PHASE.Quiet));
    assert.ok(profile.allowedPhases.includes(HORROR_PHASE.Buildup));
  }
});

test("scene profiles select a manifest-backed semantic pool", () => {
  const yellow = getAmbientProfile("paradise:yellow_halls");
  const catacombs = getAmbientProfile("catacombs:catacomb_mazes");

  assert.equal(yellow.dimensionId, "paradise:yellow_halls");
  assert.equal(yellow.ambientPool, "old_locations");
  assert.equal(yellow.soundId, "paradise.ambient.old_locations.yellow_halls");
  assert.equal(catacombs.ambientPool, "old_locations");
  assert.equal(catacombs.soundId, "paradise.ambient.old_locations.catacombs");
});

test("per-player phase resolution prioritizes relief, targeted scare, then fear", () => {
  const director = {
    phase: HORROR_PHASE.Peak,
    activeScare: { playerId: "other-player" },
  };

  assert.equal(
    getPlayerAudioPhase({
      playerId: "player-one",
      currentTick: 100,
      directorSnapshot: director,
      horrorSnapshot: { reliefUntilTick: 140, fearScore: 95, panicUntilTick: 0 },
    }),
    HORROR_PHASE.Relief,
  );
  assert.equal(
    getPlayerAudioPhase({
      playerId: "player-one",
      currentTick: 100,
      directorSnapshot: { phase: HORROR_PHASE.Peak, activeScare: { playerId: "player-one" } },
      horrorSnapshot: { reliefUntilTick: 0, fearScore: 20, panicUntilTick: 0 },
    }),
    HORROR_PHASE.Peak,
  );
  assert.equal(
    getPlayerAudioPhase({
      playerId: "player-one",
      currentTick: 100,
      directorSnapshot: director,
      horrorSnapshot: { reliefUntilTick: 0, fearScore: 80, panicUntilTick: 0 },
    }),
    HORROR_PHASE.Buildup,
  );
});

test("phase mixing keeps phase transitions on the same sound instance", () => {
  assert.equal(getPhaseVolume(HORROR_PHASE.Quiet), 0.45);
  assert.equal(getPhaseVolume(HORROR_PHASE.Peak), 0.1);
  assert.equal(getPhaseVolume(HORROR_PHASE.Relief), 0.3);

  const sameSound = {
    profileId: "yellow-halls",
    soundId: "paradise.ambient.old_locations.yellow_halls",
    playbackMode: "sound_instance_loop",
  };
  assert.equal(shouldRestartAmbient(sameSound, { ...sameSound, phase: HORROR_PHASE.Peak }, 120, 100), false);
  assert.equal(shouldRestartAmbient(sameSound, { ...sameSound, soundId: "paradise.ambient.old_locations.library" }, 300, 100), true);
  assert.equal(shouldRestartAmbient(sameSound, { ...sameSound, profileId: "catacombs" }, 300, 100), true);
  assert.equal(shouldRestartAmbient(sameSound, { ...sameSound, playbackMode: "finite_segment_loop" }, 300, 100), true);
});

test("the central audio registry preserves legacy IDs and fails closed for pending packs", () => {
  for (const soundId of Object.values(HORROR_SOUND)) {
    assert.ok(AUDIO_SOUND_REGISTRY[soundId], `${soundId} must have one registry record`);
  }

  const pending = "paradise.ambient.old_locations.yellow_halls";
  assert.equal(AUDIO_SOUND_REGISTRY[pending].licenseStatus, "pending_source");
  assert.equal(getPlayableSoundId(pending), "paradise.dimension.yellow_hum");
  assert.equal(getPlayableSoundId(HORROR_SOUND.AmbientLowHum), HORROR_SOUND.AmbientLowHum);
});

test("every catalog sound action carries a budget tier", () => {
  const soundActions = HORROR_EVENT_CATALOG.flatMap((event) =>
    event.actions.filter((action) => action.type === "sound"),
  );
  assert.ok(soundActions.length > 0);
  assert.ok(soundActions.every((action) => ["ambient", "buildup", "peak"].includes(action.audioTier)));
});
