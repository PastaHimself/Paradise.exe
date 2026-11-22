import { system, world } from "@minecraft/server";

let cachedPlayersTick = Number.NaN;
let cachedPlayers = [];
let cachedPlayerById = new Map();

function currentTick() {
  try {
    return typeof system.currentTick === "number" ? system.currentTick : 0;
  } catch (_error) {
    return 0;
  }
}

function isEntityValid(entity) {
  if (!entity) {
    return false;
  }

  try {
    if (typeof entity.isValid === "function") {
      return entity.isValid();
    }
    return entity.isValid !== false;
  } catch (_error) {
    return false;
  }
}

function isValidPlayer(player) {
  try {
    return isEntityValid(player) && player.typeId === "minecraft:player" && !!player.id;
  } catch (_error) {
    return false;
  }
}

function readWorldPlayers() {
  try {
    if (typeof world.getPlayers === "function") {
      return world.getPlayers();
    }
  } catch (_error) {
    // Fall back below.
  }

  try {
    if (typeof world.getAllPlayers === "function") {
      return world.getAllPlayers();
    }
  } catch (_error) {
    // The world may not be fully readable during startup.
  }

  return undefined;
}

function rebuildPlayerCache(tick) {
  const players = readWorldPlayers();
  if (!Array.isArray(players)) {
    cachedPlayersTick = Number.NaN;
    cachedPlayers = [];
    cachedPlayerById = new Map();
    return cachedPlayers;
  }

  cachedPlayersTick = tick;
  cachedPlayers = players.filter(isValidPlayer);
  cachedPlayerById = new Map(cachedPlayers.map((player) => [player.id, player]));
  return cachedPlayers;
}

export function invalidatePlayerCache() {
  cachedPlayersTick = Number.NaN;
  cachedPlayers = [];
  cachedPlayerById = new Map();
}

export function getCachedPlayers() {
  const tick = currentTick();
  if (cachedPlayersTick !== tick) {
    return rebuildPlayerCache(tick);
  }

  // A same-tick cache may outlive a leave/despawn event on some runtimes; keep
  // callers protected without forcing another world.getPlayers() query.
  if (cachedPlayers.some((player) => !isValidPlayer(player))) {
    cachedPlayers = cachedPlayers.filter(isValidPlayer);
    cachedPlayerById = new Map(cachedPlayers.map((player) => [player.id, player]));
  }

  return cachedPlayers;
}

export function getCachedPlayerById(playerId) {
  if (!playerId) {
    return undefined;
  }

  getCachedPlayers();
  const player = cachedPlayerById.get(playerId);
  return isValidPlayer(player) ? player : undefined;
}

export function getCachedPlayersInDimension(dimensionId) {
  if (!dimensionId) {
    return [];
  }

  return getCachedPlayers().filter((player) => {
    try {
      return player.dimension && player.dimension.id === dimensionId;
    } catch (_error) {
      return false;
    }
  });
}

try {
  world.afterEvents.playerSpawn.subscribe(invalidatePlayerCache);
} catch (_error) {
  // Event availability varies across preview/stable builds.
}

try {
  world.afterEvents.playerLeave.subscribe(invalidatePlayerCache);
} catch (_error) {
  // Event availability varies across preview/stable builds.
}
