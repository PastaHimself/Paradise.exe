export const AMBIENT_PLAYBACK_MODE = Object.freeze({
  SoundInstanceLoop: "sound_instance_loop",
  FiniteSegmentLoop: "finite_segment_loop",
  Disabled: "disabled",
});

export function selectAmbientPlaybackMode({
  loopCount = false,
  soundInstance = false,
  setVolume = false,
  stop = false,
  segmentSoundIds = [],
} = {}) {
  if (loopCount && soundInstance && setVolume && stop) {
    return AMBIENT_PLAYBACK_MODE.SoundInstanceLoop;
  }
  if (Array.isArray(segmentSoundIds) && segmentSoundIds.length > 0) {
    return AMBIENT_PLAYBACK_MODE.FiniteSegmentLoop;
  }
  return AMBIENT_PLAYBACK_MODE.Disabled;
}

export function buildAmbientSoundOptions(volume) {
  const numeric = Number(volume);
  const boundedVolume = Number.isFinite(numeric)
    ? Math.max(0, Math.min(1, numeric))
    : 0;
  return { loopCount: -1, volume: boundedVolume };
}
