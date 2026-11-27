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

function commandPushed(result) {
  const count = result?.successCount;
  return Number.isFinite(count) && count > 0;
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
      if (fogId && !commandPushed(dimension.runCommand(`fog ${target} push ${fogId} ${tag}`))) {
        rememberFailure("dimension-command", "fog push reported no affected player");
        return false;
      }
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
    if (fogId && !commandPushed(player.runCommand(`fog @s push ${fogId} ${tag}`))) {
      rememberFailure("entity-command", "fog push reported no affected entity");
      return false;
    }
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
 * `Player.fogSettings` is the primary path at the 1.26.50 floor: remove the tag
 * first so a re-applied layer never stacks, then push the layer. `/fog` stays as
 * the fallback for runtimes where the component is unavailable or throws.
 */
export function applyFogLayer(player, fogId, tag) {
  if (!player || typeof tag !== "string" || tag.length === 0) {
    fogRuntimeStats.failures += 1;
    rememberFailure("input", "missing player or fog tag");
    return false;
  }

  if (tryFogSettings(player, fogId, tag)) return true;
  if (tryCommandFog(player, fogId, tag)) return true;

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
