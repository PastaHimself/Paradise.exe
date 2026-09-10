import { system } from "@minecraft/server";
import { getHorrorDirectorSnapshot } from "./horror_director.js";
import { getPlayerHorrorSnapshot } from "./paradise_player_horror_state.js";
import { isPlayerInSafeRoom } from "./paradise_horror_state.js";
import { getPlayableSoundId } from "./paradise_audio_registry.js";
import {
  getAmbientProfile,
  getPhaseVolume,
  getPlayerAudioPhase,
  shouldRestartAmbient,
} from "./paradise_ambient_audio_model.js";
import {
  AMBIENT_PLAYBACK_MODE,
  buildAmbientSoundOptions,
  selectAmbientPlaybackMode,
} from "./paradise_audio_playback_model.js";

const AMBIENT_STATE = new Map();
const DEFAULT_SEGMENT_DURATION_TICKS = 20 * 8;

function currentTick() {
  try {
    return Math.max(0, Math.floor(Number(system.currentTick) || 0));
  } catch (_error) {
    return 0;
  }
}

function playerIdOf(playerOrId) {
  if (typeof playerOrId === "string") return playerOrId;
  return String(playerOrId?.id || playerOrId?.name || "unknown");
}

function stopInstance(instance) {
  try {
    if (instance && typeof instance.stop === "function") instance.stop();
  } catch (_error) {}
}

function setInstanceVolume(instance, volume) {
  if (!instance) return false;
  try {
    if (typeof instance.setVolume === "function") {
      instance.setVolume(volume);
      return true;
    }
    if (typeof instance.fade === "function") {
      instance.fade(5, volume);
      return true;
    }
  } catch (_error) {}
  return false;
}

function playOneShot(player, soundId, volume) {
  if (!player || typeof player.playSound !== "function" || !soundId) return false;
  try {
    player.playSound(soundId, { volume });
    return true;
  } catch (_error) {
    return false;
  }
}

function tryStartSoundInstanceLoop(player, soundId, volume, segmentSoundIds = [], segmentDurationTicks = DEFAULT_SEGMENT_DURATION_TICKS) {
  if (!player || typeof player.playSound !== "function" || !soundId) {
    return { mode: AMBIENT_PLAYBACK_MODE.Disabled, instance: undefined };
  }

  try {
    // loopCount and SoundInstance are beta APIs in the target Bedrock runtime.
    // Keep the cast local so the rest of the project stays type-safe on the
    // stable PlayerSoundOptions surface.
    const options = /** @type {any} */ (buildAmbientSoundOptions(volume));
    const instance = player.playSound(soundId, options);
    const capabilities = {
      loopCount: true,
      soundInstance: Boolean(instance),
      setVolume: typeof instance?.setVolume === "function" || typeof instance?.fade === "function",
      stop: typeof instance?.stop === "function",
      segmentSoundIds,
    };
    const mode = selectAmbientPlaybackMode(capabilities);
    if (mode === AMBIENT_PLAYBACK_MODE.SoundInstanceLoop) {
      return { mode, instance };
    }
  } catch (_error) {
    // The runtime may expose the stable API without beta loop handles.
  }

  if (Array.isArray(segmentSoundIds) && segmentSoundIds.length > 0) {
    const firstSegment = getPlayableSoundId(segmentSoundIds[0]);
    if (playOneShot(player, firstSegment, volume)) {
      return {
        mode: AMBIENT_PLAYBACK_MODE.FiniteSegmentLoop,
        instance: undefined,
        segmentIndex: 0,
        nextSegmentTick: segmentDurationTicks,
      };
    }
  }

  return { mode: AMBIENT_PLAYBACK_MODE.Disabled, instance: undefined };
}

function stopState(state) {
  if (!state) return;
  stopInstance(state.instance);
}

function stateSnapshot(state) {
  if (!state) return undefined;
  return {
    profileId: state.profileId,
    dimensionId: state.dimensionId,
    phase: state.phase,
    soundId: state.soundId,
    playbackMode: state.playbackMode,
    lastStartTick: state.lastStartTick,
    lastUpdateTick: state.lastUpdateTick,
    nextSegmentTick: state.nextSegmentTick,
    segmentIndex: state.segmentIndex,
  };
}

function advanceFiniteSegment(player, state, profile, tick) {
  const segmentSoundIds = state.segmentSoundIds || profile.segmentSoundIds || [];
  if (state.playbackMode !== AMBIENT_PLAYBACK_MODE.FiniteSegmentLoop || segmentSoundIds.length === 0) {
    return;
  }
  if (tick < state.nextSegmentTick) return;

  const nextIndex = (state.segmentIndex + 1) % segmentSoundIds.length;
  const segmentSoundId = getPlayableSoundId(segmentSoundIds[nextIndex]);
  if (playOneShot(player, segmentSoundId, getPhaseVolume(state.phase, profile))) {
    state.segmentIndex = nextIndex;
    state.nextSegmentTick = tick + state.segmentDurationTicks;
  }
}

function startAmbient(player, profile, soundId, phase, tick) {
  const volume = getPhaseVolume(phase, profile);
  const started = tryStartSoundInstanceLoop(
    player,
    soundId,
    volume,
    profile.segmentSoundIds,
    profile.segmentDurationTicks,
  );
  return {
    profileId: profile.profileId,
    dimensionId: profile.dimensionId,
    phase,
    soundId,
    playbackMode: started.mode,
    instance: started.instance,
    lastStartTick: tick,
    lastUpdateTick: tick,
    nextSegmentTick: started.nextSegmentTick || 0,
    segmentIndex: started.segmentIndex ?? -1,
    segmentSoundIds: profile.segmentSoundIds,
    segmentDurationTicks: profile.segmentDurationTicks || DEFAULT_SEGMENT_DURATION_TICKS,
  };
}

export function syncPlayerAmbient(player, context = {}) {
  if (!player) return undefined;
  const playerId = playerIdOf(player);
  const tick = Number.isFinite(Number(context.currentTick))
    ? Math.max(0, Math.floor(Number(context.currentTick)))
    : currentTick();
  const dimensionId = String(player?.dimension?.id || "");
  const profile = getAmbientProfile(dimensionId, context.scenarioId);
  const previous = AMBIENT_STATE.get(playerId);

  if (!profile) {
    stopState(previous);
    AMBIENT_STATE.delete(playerId);
    return undefined;
  }

  const directorSnapshot = context.directorSnapshot || getHorrorDirectorSnapshot(tick);
  const horrorSnapshot = context.horrorSnapshot || getPlayerHorrorSnapshot(player, tick);
  const safeRoom = typeof context.safeRoom === "boolean"
    ? context.safeRoom
    : isPlayerInSafeRoom(player, tick);
  const phase = getPlayerAudioPhase({
    playerId,
    currentTick: tick,
    directorSnapshot,
    horrorSnapshot,
    safeRoom,
  });
  const soundId = getPlayableSoundId(profile.soundId);
  if (!soundId) {
    stopState(previous);
    AMBIENT_STATE.delete(playerId);
    return undefined;
  }

  const nextIdentity = {
    profileId: profile.profileId,
    soundId,
    playbackMode: previous?.playbackMode || AMBIENT_PLAYBACK_MODE.SoundInstanceLoop,
  };
  const restart = context.forceRestart === true || shouldRestartAmbient(
    previous,
    { ...nextIdentity, phase },
    tick,
    previous?.lastStartTick ?? tick,
  );

  if (!previous || restart) {
    stopState(previous);
    const next = startAmbient(player, profile, soundId, phase, tick);
    AMBIENT_STATE.set(playerId, next);
    return stateSnapshot(next);
  }

  previous.phase = phase;
  previous.lastUpdateTick = tick;
  advanceFiniteSegment(player, previous, profile, tick);
  setInstanceVolume(previous.instance, getPhaseVolume(phase, profile));
  AMBIENT_STATE.set(playerId, previous);
  return stateSnapshot(previous);
}

export function stopPlayerAmbient(playerOrId) {
  const playerId = playerIdOf(playerOrId);
  const state = AMBIENT_STATE.get(playerId);
  stopState(state);
  AMBIENT_STATE.delete(playerId);
}

export function getPlayerAmbientState(playerOrId) {
  return stateSnapshot(AMBIENT_STATE.get(playerIdOf(playerOrId)));
}

export function clearAmbientAudioState() {
  for (const state of AMBIENT_STATE.values()) stopState(state);
  AMBIENT_STATE.clear();
}
