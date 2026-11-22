const fogRuntimeStats = {
  commandApplied: 0,
  componentApplied: 0,
  failures: 0,
};

let lastFailure = "";

function rememberFailure(path, error) {
  const raw = error instanceof Error ? error.message : String(error ?? "unknown error");
  lastFailure = `${path}: ${raw}`.slice(0, 192);
}

function tryCommandFog(player, fogId, tag) {
  if (!player) return false;

  // Dimension.runCommand executes from the broader dimension command context,
  // which is preferable for GameDirectors-level commands such as /fog. Use a
  // name-filtered selector so only this player receives the layer.
  const dimension = player.dimension;
  if (dimension && typeof dimension.runCommand === "function" && typeof player.name === "string") {
    const target = `@a[name=${JSON.stringify(player.name)}]`;
    try {
      dimension.runCommand(`fog ${target} remove ${tag}`);
      if (fogId) dimension.runCommand(`fog ${target} push ${fogId} ${tag}`);
      fogRuntimeStats.commandApplied += 1;
      lastFailure = "";
      return true;
    } catch (error) {
      rememberFailure("dimension-command", error);
    }
  }

  // Keep Entity.runCommand as a compatibility fallback for test harnesses and
  // runtimes where the dimension command surface is unavailable.
  if (typeof player.runCommand !== "function") return false;
  try {
    player.runCommand(`fog @s remove ${tag}`);
    if (fogId) player.runCommand(`fog @s push ${fogId} ${tag}`);
    fogRuntimeStats.commandApplied += 1;
    lastFailure = "";
    return true;
  } catch (error) {
    rememberFailure("entity-command", error);
    return false;
  }
}

function tryFogSettings(player, fogId, tag) {
  try {
    const fog = player?.fogSettings;
    if (!fog || typeof fog.remove !== "function" || typeof fog.push !== "function") {
      return false;
    }
    fog.remove(tag);
    if (fogId) fog.push(fogId, tag);
    fogRuntimeStats.componentApplied += 1;
    lastFailure = "";
    return true;
  } catch (error) {
    rememberFailure("fogSettings", error);
    return false;
  }
}

/**
 * Applies one tagged fog layer.
 *
 * The command path is intentionally first because /fog is available at the
 * add-on's declared 1.26.20 engine floor. Player.fogSettings is only used as
 * an optional capability fallback on newer runtimes where it exists.
 */
export function applyFogLayer(player, fogId, tag) {
  if (!player || typeof tag !== "string" || tag.length === 0) {
    fogRuntimeStats.failures += 1;
    rememberFailure("input", "missing player or fog tag");
    return false;
  }

  if (tryCommandFog(player, fogId, tag)) return true;
  if (tryFogSettings(player, fogId, tag)) return true;

  fogRuntimeStats.failures += 1;
  if (!lastFailure) rememberFailure("capability", "no supported fog application path");
  return false;
}

export function getFogRuntimeStats() {
  return {
    commandApplied: fogRuntimeStats.commandApplied,
    componentApplied: fogRuntimeStats.componentApplied,
    failures: fogRuntimeStats.failures,
    lastFailure,
  };
}
