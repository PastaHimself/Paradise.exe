/**
 * Single source of truth for custom audio identifiers.
 *
 * Existing IDs are marked runtime-ready. Supplied packs are deliberately
 * marked pending until their source archive, checksum, and license evidence
 * have passed the staging validator. Callers can still request the semantic
 * ID; getPlayableSoundId() selects the safe fallback until then.
 */

export const AUDIO_SOUND_ID = Object.freeze({
  StalkerBreathFar: "paradise.stalker.breath_far",
  StalkerBreathNear: "paradise.stalker.breath_near",
  StalkerStepBehind: "paradise.stalker.step_behind",
  StalkerWallScratch: "paradise.stalker.wall_scratch",
  StalkerRoarMuffled: "paradise.stalker.roar_muffled",
  AmbientLowHum: "paradise.ambient.low_hum",
  AmbientLightPop: "paradise.ambient.light_pop",
  AmbientRadioNumbers: "paradise.ambient.radio_numbers",
  DimensionYellowHum: "paradise.dimension.yellow_hum",
  DimensionCatacombWhisper: "paradise.dimension.catacomb_whisper",
  FlashlightSwitch: "paradise.flashlight.switch",
  AmbientOldLocationsYellowHalls: "paradise.ambient.old_locations.yellow_halls",
  AmbientOldLocationsFlatFlower: "paradise.ambient.old_locations.flat_flower",
  AmbientOldLocationsEndlessStaircase: "paradise.ambient.old_locations.endless_staircase",
  AmbientOldLocationsCatacombs: "paradise.ambient.old_locations.catacombs",
  AmbientOldLocationsLibrary: "paradise.ambient.old_locations.library",
  AmbientWindOpen: "paradise.ambient.wind.open",
  AmbientWindHeaven: "paradise.ambient.wind.heaven",
});

export const HORROR_SOUND = Object.freeze({
  StalkerBreathFar: AUDIO_SOUND_ID.StalkerBreathFar,
  StalkerBreathNear: AUDIO_SOUND_ID.StalkerBreathNear,
  StalkerStepBehind: AUDIO_SOUND_ID.StalkerStepBehind,
  StalkerWallScratch: AUDIO_SOUND_ID.StalkerWallScratch,
  StalkerRoarMuffled: AUDIO_SOUND_ID.StalkerRoarMuffled,
  AmbientLowHum: AUDIO_SOUND_ID.AmbientLowHum,
  AmbientLightPop: AUDIO_SOUND_ID.AmbientLightPop,
  AmbientRadioNumbers: AUDIO_SOUND_ID.AmbientRadioNumbers,
  DimensionYellowHum: AUDIO_SOUND_ID.DimensionYellowHum,
  DimensionCatacombWhisper: AUDIO_SOUND_ID.DimensionCatacombWhisper,
});

function existingRecord(soundId, resourcePath) {
  return Object.freeze({
    soundId,
    resourcePath,
    licenseStatus: "existing_project_asset",
    runtimeReady: true,
  });
}

function pendingRecord(soundId, {
  sourcePack,
  resourcePath,
  fallbackSoundId,
  licenseStatus = "pending_source",
}) {
  return Object.freeze({
    soundId,
    sourcePack,
    resourcePath,
    fallbackSoundId,
    licenseStatus,
    runtimeReady: false,
  });
}

export const AUDIO_SOUND_REGISTRY = Object.freeze({
  [AUDIO_SOUND_ID.StalkerBreathFar]: existingRecord(
    AUDIO_SOUND_ID.StalkerBreathFar,
    "sounds/paradise_horror/breath_far.ogg",
  ),
  [AUDIO_SOUND_ID.StalkerBreathNear]: existingRecord(
    AUDIO_SOUND_ID.StalkerBreathNear,
    "sounds/paradise_horror/breath_near.ogg",
  ),
  [AUDIO_SOUND_ID.StalkerStepBehind]: existingRecord(
    AUDIO_SOUND_ID.StalkerStepBehind,
    "sounds/paradise_horror/step_behind.ogg",
  ),
  [AUDIO_SOUND_ID.StalkerWallScratch]: existingRecord(
    AUDIO_SOUND_ID.StalkerWallScratch,
    "sounds/paradise_horror/wall_scratch.ogg",
  ),
  [AUDIO_SOUND_ID.StalkerRoarMuffled]: existingRecord(
    AUDIO_SOUND_ID.StalkerRoarMuffled,
    "sounds/paradise_horror/roar_muffled.ogg",
  ),
  [AUDIO_SOUND_ID.AmbientLowHum]: existingRecord(
    AUDIO_SOUND_ID.AmbientLowHum,
    "sounds/paradise_horror/low_hum.ogg",
  ),
  [AUDIO_SOUND_ID.AmbientLightPop]: existingRecord(
    AUDIO_SOUND_ID.AmbientLightPop,
    "sounds/paradise_horror/light_pop.ogg",
  ),
  [AUDIO_SOUND_ID.AmbientRadioNumbers]: existingRecord(
    AUDIO_SOUND_ID.AmbientRadioNumbers,
    "sounds/paradise_horror/radio_numbers.ogg",
  ),
  [AUDIO_SOUND_ID.DimensionYellowHum]: existingRecord(
    AUDIO_SOUND_ID.DimensionYellowHum,
    "sounds/paradise_horror/yellow_hum.ogg",
  ),
  [AUDIO_SOUND_ID.DimensionCatacombWhisper]: existingRecord(
    AUDIO_SOUND_ID.DimensionCatacombWhisper,
    "sounds/paradise_horror/catacomb_whisper.ogg",
  ),
  [AUDIO_SOUND_ID.FlashlightSwitch]: existingRecord(
    AUDIO_SOUND_ID.FlashlightSwitch,
    "sounds/paradise_flashlight/switch_click_sound.ogg",
  ),
  [AUDIO_SOUND_ID.AmbientOldLocationsYellowHalls]: pendingRecord(
    AUDIO_SOUND_ID.AmbientOldLocationsYellowHalls,
    {
      sourcePack: "Old Locations",
      resourcePath: "sounds/paradise_audio/old_locations/yellow_halls.ogg",
      fallbackSoundId: AUDIO_SOUND_ID.DimensionYellowHum,
    },
  ),
  [AUDIO_SOUND_ID.AmbientOldLocationsFlatFlower]: pendingRecord(
    AUDIO_SOUND_ID.AmbientOldLocationsFlatFlower,
    {
      sourcePack: "Old Locations",
      resourcePath: "sounds/paradise_audio/old_locations/flat_flower.ogg",
      fallbackSoundId: AUDIO_SOUND_ID.AmbientLowHum,
    },
  ),
  [AUDIO_SOUND_ID.AmbientOldLocationsEndlessStaircase]: pendingRecord(
    AUDIO_SOUND_ID.AmbientOldLocationsEndlessStaircase,
    {
      sourcePack: "Old Locations",
      resourcePath: "sounds/paradise_audio/old_locations/endless_staircase.ogg",
      fallbackSoundId: AUDIO_SOUND_ID.AmbientLowHum,
    },
  ),
  [AUDIO_SOUND_ID.AmbientOldLocationsCatacombs]: pendingRecord(
    AUDIO_SOUND_ID.AmbientOldLocationsCatacombs,
    {
      sourcePack: "Old Locations",
      resourcePath: "sounds/paradise_audio/old_locations/catacombs.ogg",
      fallbackSoundId: AUDIO_SOUND_ID.DimensionCatacombWhisper,
    },
  ),
  [AUDIO_SOUND_ID.AmbientOldLocationsLibrary]: pendingRecord(
    AUDIO_SOUND_ID.AmbientOldLocationsLibrary,
    {
      sourcePack: "Old Locations",
      resourcePath: "sounds/paradise_audio/old_locations/library.ogg",
      fallbackSoundId: AUDIO_SOUND_ID.AmbientLowHum,
    },
  ),
  [AUDIO_SOUND_ID.AmbientWindOpen]: pendingRecord(
    AUDIO_SOUND_ID.AmbientWindOpen,
    {
      sourcePack: "Free PSX Wind Ambience",
      resourcePath: "sounds/paradise_audio/wind/open.ogg",
      fallbackSoundId: AUDIO_SOUND_ID.AmbientLowHum,
      licenseStatus: "license_blocked",
    },
  ),
  [AUDIO_SOUND_ID.AmbientWindHeaven]: pendingRecord(
    AUDIO_SOUND_ID.AmbientWindHeaven,
    {
      sourcePack: "Free PSX Wind Ambience",
      resourcePath: "sounds/paradise_audio/wind/heaven.ogg",
      fallbackSoundId: AUDIO_SOUND_ID.AmbientLowHum,
      licenseStatus: "license_blocked",
    },
  ),
});

export function getAudioSoundRecord(soundId) {
  return AUDIO_SOUND_REGISTRY[String(soundId || "")];
}

export function getPlayableSoundId(soundId) {
  const record = getAudioSoundRecord(soundId);
  if (!record || record.runtimeReady) return soundId;
  return record.fallbackSoundId || undefined;
}
