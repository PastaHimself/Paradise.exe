import { HORROR_PHASE } from "./horror_director.js";
import { getAudioSceneProfile } from "./paradise_audio_scene_profiles.js";

const MIN_AMBIENT_DWELL_TICKS = 20 * 8;

const PHASE_VOLUME = Object.freeze({
  [HORROR_PHASE.Quiet]: 0.45,
  [HORROR_PHASE.Buildup]: 0.7,
  [HORROR_PHASE.Peak]: 0.1,
  [HORROR_PHASE.Relief]: 0.3,
});

function finiteTick(value, fallback = 0) {
  const tick = Number(value);
  return Number.isFinite(tick) ? Math.max(0, Math.floor(tick)) : fallback;
}

function playerIdOf(value) {
  return String(value?.id || value?.name || value || "unknown");
}

function normalizedPhase(value) {
  return Object.values(HORROR_PHASE).includes(value) ? value : HORROR_PHASE.Quiet;
}

/**
 * Resolve the local phase for one player.
 * A global peak only affects its targeted player; fear in another player does
 * not leak into this player's ambient bed.
 * @param {{playerId?: any, currentTick?: number, directorSnapshot?: any, horrorSnapshot?: any, safeRoom?: boolean}} options
 */
export function getPlayerAudioPhase(options = {}) {
  const {
    playerId,
    currentTick = 0,
    directorSnapshot = {},
    horrorSnapshot = {},
    safeRoom = false,
  } = options;
  const tick = finiteTick(currentTick);
  if (safeRoom || finiteTick(horrorSnapshot.reliefUntilTick) > tick) {
    return HORROR_PHASE.Relief;
  }

  const activeScare = directorSnapshot.activeScare;
  if (activeScare && playerIdOf(activeScare.playerId) === playerIdOf(playerId)) {
    return normalizedPhase(directorSnapshot.phase);
  }

  const fearScore = Math.max(0, Number(horrorSnapshot.fearScore) || 0);
  const panicActive = finiteTick(horrorSnapshot.panicUntilTick) > tick;
  if (panicActive || fearScore >= 70 || fearScore >= 35) {
    return HORROR_PHASE.Buildup;
  }

  return HORROR_PHASE.Quiet;
}

export function getPhaseVolume(phase, profile = undefined) {
  const normalized = normalizedPhase(phase);
  if (profile?.allowedPhases && !profile.allowedPhases.includes(normalized)) {
    return 0;
  }
  return PHASE_VOLUME[normalized];
}

export function getAmbientProfile(dimensionId, _scenarioId = undefined) {
  const scene = getAudioSceneProfile(dimensionId);
  if (!scene) return undefined;
  return {
    ...scene,
    phaseVolumes: Object.freeze({
      quiet: getPhaseVolume(HORROR_PHASE.Quiet, scene),
      buildup: getPhaseVolume(HORROR_PHASE.Buildup, scene),
      peak: getPhaseVolume(HORROR_PHASE.Peak, scene),
      relief: getPhaseVolume(HORROR_PHASE.Relief, scene),
    }),
  };
}

/**
 * Phase changes only mix the retained SoundInstance. Restarting is reserved
 * for a changed scene/profile, sound, or compatibility playback mode, and a
 * bed must have dwelled for eight seconds before a non-forced switch.
 */
export function shouldRestartAmbient(previous, next, currentTick = 0, lastStartTick = 0) {
  if (!previous || !next) return true;
  const identityChanged = ["profileId", "soundId", "playbackMode"].some(
    (field) => previous[field] !== next[field],
  );
  if (!identityChanged) return false;
  return finiteTick(currentTick) - finiteTick(lastStartTick) >= MIN_AMBIENT_DWELL_TICKS;
}

export { MIN_AMBIENT_DWELL_TICKS };
