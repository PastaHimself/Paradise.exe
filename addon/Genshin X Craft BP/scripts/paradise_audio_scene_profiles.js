/**
 * Runtime-free audio scene metadata.
 *
 * `soundId` values are semantic registry entries. The staging/manifest gate
 * decides whether a supplied pack is ready to replace the conservative
 * fallback sound; this module never guesses at licensing or file presence.
 */

const PHASES = Object.freeze(["quiet", "buildup", "peak", "relief"]);

function profile({
  profileId,
  dimensionId,
  ambientPool,
  soundId,
  fallbackSoundId,
  scenarioTags,
  assetStatus = "pending_source",
  segmentSoundIds = [],
}) {
  return Object.freeze({
    profileId,
    dimensionId,
    ambientPool,
    soundId,
    fallbackSoundId,
    allowedPhases: PHASES,
    scenarioTags: Object.freeze([...scenarioTags]),
    assetStatus,
    segmentSoundIds: Object.freeze([...segmentSoundIds]),
    segmentDurationTicks: 20 * 8,
  });
}

export const AUDIO_SCENE_PROFILES = Object.freeze({
  "paradise:yellow_halls": profile({
    profileId: "yellow_halls",
    dimensionId: "paradise:yellow_halls",
    ambientPool: "old_locations",
    soundId: "paradise.ambient.old_locations.yellow_halls",
    fallbackSoundId: "paradise.dimension.yellow_hum",
    scenarioTags: ["interior", "yellow_halls", "looping_bed"],
  }),
  "paradise:flat_flower": profile({
    profileId: "flat_flower",
    dimensionId: "paradise:flat_flower",
    ambientPool: "old_locations",
    soundId: "paradise.ambient.old_locations.flat_flower",
    fallbackSoundId: "paradise.ambient.low_hum",
    scenarioTags: ["open", "flowers", "looping_bed"],
  }),
  "paradise:endless_staircase": profile({
    profileId: "endless_staircase",
    dimensionId: "paradise:endless_staircase",
    ambientPool: "old_locations",
    soundId: "paradise.ambient.old_locations.endless_staircase",
    fallbackSoundId: "paradise.ambient.low_hum",
    scenarioTags: ["interior", "stairs", "looping_bed"],
  }),
  "paradise:burning_highway": profile({
    profileId: "burning_highway",
    dimensionId: "paradise:burning_highway",
    ambientPool: "wind",
    soundId: "paradise.ambient.wind.open",
    fallbackSoundId: "paradise.ambient.low_hum",
    scenarioTags: ["open", "wind", "looping_bed"],
    assetStatus: "license_blocked",
  }),
  "catacombs:catacomb_mazes": profile({
    profileId: "catacombs",
    dimensionId: "catacombs:catacomb_mazes",
    ambientPool: "old_locations",
    soundId: "paradise.ambient.old_locations.catacombs",
    fallbackSoundId: "paradise.dimension.catacomb_whisper",
    scenarioTags: ["interior", "catacombs", "looping_bed"],
  }),
  "heaven:the_heaven": profile({
    profileId: "heaven",
    dimensionId: "heaven:the_heaven",
    ambientPool: "wind",
    soundId: "paradise.ambient.wind.heaven",
    fallbackSoundId: "paradise.ambient.low_hum",
    scenarioTags: ["open", "heaven", "wind", "looping_bed"],
    assetStatus: "license_blocked",
  }),
  "library:the_library": profile({
    profileId: "library",
    dimensionId: "library:the_library",
    ambientPool: "old_locations",
    soundId: "paradise.ambient.old_locations.library",
    fallbackSoundId: "paradise.ambient.low_hum",
    scenarioTags: ["interior", "library", "looping_bed"],
  }),
});

export const PARADISE_AUDIO_DIMENSION_IDS = Object.freeze(
  Object.keys(AUDIO_SCENE_PROFILES),
);

export function getAudioSceneProfile(dimensionId) {
  return AUDIO_SCENE_PROFILES[String(dimensionId || "")];
}
