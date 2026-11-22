export const STALKER_SPAWN_BLOCK_REASON = Object.freeze({
  SystemDisabled: "system_disabled",
  InvalidPlayer: "invalid_player",
  BlockedDimension: "blocked_dimension",
  PlayerCooldown: "cooldown",
  Cooldown: "cooldown",
  SafeRoom: "safe_room",
  PsychologicalSuppression: "psychological_suppression",
  QuietPhase: "quiet_phase",
  ReliefPhase: "relief_phase",
  SpawnAttemptCooldown: "spawn_attempt_cooldown",
  RecentSuccessfulSpawn: "recent_successful_spawn",
  MaxWatchersForPlayer: "max_watchers_for_player",
  MaxWatchersForDimension: "max_watchers_for_dimension",
  NoValidSpot: "no_valid_spot",
  SpawnFailed: "spawn_failed",
});

export const DEBUG_COMMANDS = Object.freeze({
  ForceSpawn: "force_spawn",
  ForceAmbush: "force_ambush",
  ForceFakeout: "force_fakeout",
  DebugStatus: "debug_status",
});

export function isForceWatcherCommand(message) {
  return String(message || "").trim().toLowerCase().startsWith("force_");
}

export function formatSpawnBlockers(reasons) {
  if (!Array.isArray(reasons) || reasons.length === 0) {
    return "ready";
  }

  return [...new Set(reasons.map((reason) => String(reason || "unknown")))]
    .filter((reason) => reason.length > 0)
    .join(", ");
}

export function formatDebugStatus(input = {}) {
  const enabled = input.enabled === true;
  const dimensionId = String(input.dimensionId || "unknown");
  const allowedDimension = input.allowedDimension === true;
  const watcherCount = Math.max(0, Math.floor(Number(input.watcherCount) || 0));
  const assignedWatcherCount = Math.max(0, Math.floor(Number(input.assignedWatcherCount) || 0));
  const tensionState = String(input.tensionState || "unknown");
  const heat = Math.floor(Number(input.heat) || 0);
  const fear = Math.floor(Number(input.fear) || 0);
  const suspicion = Math.floor(Number(input.suspicion) || 0);
  const soundScore = Math.floor(Number(input.soundScore) || 0);
  const blockers = formatSpawnBlockers(input.blockers || []);

  return `enabled=${enabled} dimension=${dimensionId} allowed=${allowedDimension} watchers=${watcherCount} assigned=${assignedWatcherCount} tension=${tensionState} heat=${heat} fear=${fear} suspicion=${suspicion} sound=${soundScore} blockers=${blockers}`;
}


export function isValidWatcherDebugPlayerState(input = {}) {
  return String(input.playerTypeId || "") === "minecraft:player" && String(input.dimensionId || "").length > 0;
}

export function getWatcherSpawnBlockersForState(input = {}) {
  const blockers = [];
  const bypassCooldowns = input.bypassCooldowns === true;
  const bypassTension = input.bypassTension === true;

  if (input.systemEnabled !== true) {
    blockers.push(STALKER_SPAWN_BLOCK_REASON.SystemDisabled);
  }

  if (!isValidWatcherDebugPlayerState(input)) {
    blockers.push(STALKER_SPAWN_BLOCK_REASON.InvalidPlayer);
    return blockers;
  }

  if (input.allowedDimension !== true) {
    blockers.push(STALKER_SPAWN_BLOCK_REASON.BlockedDimension);
    return blockers;
  }

  if (!bypassCooldowns && input.playerCooldown === true) {
    blockers.push(STALKER_SPAWN_BLOCK_REASON.PlayerCooldown);
  }

  if (input.safeRoom === true) {
    blockers.push(STALKER_SPAWN_BLOCK_REASON.SafeRoom);
  }

  if (input.psychologicalSuppression === true) {
    blockers.push(STALKER_SPAWN_BLOCK_REASON.PsychologicalSuppression);
  }

  if (!bypassTension) {
    const tensionState = String(input.tensionState || "");
    if (tensionState === "quiet") {
      blockers.push(STALKER_SPAWN_BLOCK_REASON.QuietPhase);
    }
    if (tensionState === "relief") {
      blockers.push(STALKER_SPAWN_BLOCK_REASON.ReliefPhase);
    }
  }

  if (!bypassCooldowns) {
    if (input.spawnAttemptCooldown === true) {
      blockers.push(STALKER_SPAWN_BLOCK_REASON.SpawnAttemptCooldown);
    }
    if (input.recentSuccessfulSpawn === true) {
      blockers.push(STALKER_SPAWN_BLOCK_REASON.RecentSuccessfulSpawn);
    }
  }

  if (input.maxWatchersForPlayer === true) {
    blockers.push(STALKER_SPAWN_BLOCK_REASON.MaxWatchersForPlayer);
  }

  if (input.maxWatchersForDimension === true) {
    blockers.push(STALKER_SPAWN_BLOCK_REASON.MaxWatchersForDimension);
  }

  return blockers;
}

export function makeWatcherSpawnResult(watcher, blockers = []) {
  return {
    watcher,
    blockers: Array.isArray(blockers) ? blockers : [],
  };
}

export function formatSpawnCommandResult(commandName, result, successMessage) {
  if (result && result.watcher) {
    return String(successMessage || `${commandName} succeeded`);
  }

  return `${commandName} failed: ${formatSpawnBlockers(result && result.blockers ? result.blockers : [])}`;
}

export function choosePresenceCueStage(input = {}) {
  const pressure = Math.floor(Number(input.pressure) || 0);
  const heat = Math.floor(Number(input.heat) || 0);
  const soundScore = Math.floor(Number(input.soundScore) || 0);
  const score = Math.max(pressure, Math.floor(heat * 0.75 + soundScore * 0.5));

  if (score >= 82) {
    return "panic";
  }
  if (score >= 58) {
    return "near";
  }
  if (score >= 28) {
    return "watched";
  }
  return "none";
}
