export const AMBIENT_PLAYBACK_MODE = Object.freeze({
  SoundInstanceLoop: "sound_instance_loop",
  FiniteSegmentLoop: "finite_segment_loop",
  Disabled: "disabled",
});

export function getAmbientPlaybackCapabilities(
  player,
  instance,
  options = {},
  segmentSoundIds = [],
) {
  const soundInstance = Boolean(instance);
  const setVolume = typeof instance?.setVolume === "function"
    || typeof instance?.fade === "function";
  const stop = typeof instance?.stop === "function";
  const hasPlayerLoopControl = typeof player?.stopSound === "function";

  return {
    // A returned handle alone is not enough. The beta player control surface
    // is the compatibility signal that makes loopCount safe to use here.
    loopCount: options?.loopCount === -1
      && hasPlayerLoopControl
      && soundInstance
      && setVolume
      && stop,
    soundInstance,
    setVolume,
    stop,
    segmentSoundIds,
  };
}

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
