import { system } from "@minecraft/server";
import { isVhsEnabled, onVhsPreferenceChanged } from "./player_config.js";

/**
 * Shared Paradise horror state helpers.
 *
 * Real safe rooms are intentionally simple and creator-defined:
 * - Tag a player with `paradise_safe_room` for scripted/special rooms, or
 * - Place a `minecraft:lodestone` marker within 8 blocks horizontally and 4
 *   blocks vertically of the playable safe area.
 *
 * Recommended visual language for trustworthy safe rooms:
 * smooth quartz / quartz blocks / white concrete, sea lanterns, and one visible
 * or hidden lodestone marker. The marker is the authoritative detection signal;
 * the palette is the player-facing cue.
 */

export const VHS_TIER = Object.freeze({
  Off: "PARADISE_VHS_OFF",
  Low: "PARADISE_VHS_LOW",
  High: "PARADISE_VHS_HIGH",
  Panic: "PARADISE_VHS_PANIC",
});

const VHS_RANK = Object.freeze({
  [VHS_TIER.Off]: 0,
  [VHS_TIER.Low]: 1,
  [VHS_TIER.High]: 2,
  [VHS_TIER.Panic]: 3,
});

export function normalizeVhsTier(value) {
  const tier = value && typeof value === "object" ? value.tier : value;
  return Object.prototype.hasOwnProperty.call(VHS_RANK, tier) ? tier : VHS_TIER.Off;
}

export const SAFE_ROOM_CONFIG = Object.freeze({
  playerTag: "paradise_safe_room",
  markerBlockIds: Object.freeze(["minecraft:lodestone"]),
  recommendedPalette: Object.freeze([
    "minecraft:white_concrete",
    "minecraft:smooth_quartz",
    "minecraft:quartz_block",
    "minecraft:sea_lantern",
    "minecraft:lodestone",
  ]),
  horizontalRadius: 8,
  verticalRadius: 4,
  cacheTicks: 20,
});

const safeRoomCache = new Map();
const vhsRequests = new Map();

function currentTick() {
  try {
    return system.currentTick || 0;
  } catch (_error) {
    return 0;
  }
}

function floorLocation(location) {
  return {
    x: Math.floor(location.x),
    y: Math.floor(location.y),
    z: Math.floor(location.z),
  };
}

function hasSafeRoomTag(player) {
  try {
    return !!player.hasTag(SAFE_ROOM_CONFIG.playerTag);
  } catch (_error) {
    return false;
  }
}

function cacheStillApplies(cached, player, now) {
  if (!cached || now - cached.tick > SAFE_ROOM_CONFIG.cacheTicks) {
    return false;
  }
  if (!player || !player.dimension || cached.dimensionId !== player.dimension.id) {
    return false;
  }

  const loc = player.location;
  return (
    Math.abs(loc.x - cached.location.x) <= 2 &&
    Math.abs(loc.y - cached.location.y) <= 2 &&
    Math.abs(loc.z - cached.location.z) <= 2
  );
}

function scanForSafeRoomMarker(player) {
  if (!player || !player.dimension || !player.location) {
    return false;
  }

  const origin = floorLocation(player.location);
  const horizontalRadius = SAFE_ROOM_CONFIG.horizontalRadius;
  const verticalRadius = SAFE_ROOM_CONFIG.verticalRadius;
  const markerIds = new Set(SAFE_ROOM_CONFIG.markerBlockIds);

  for (let dy = -verticalRadius; dy <= verticalRadius; dy++) {
    for (let dx = -horizontalRadius; dx <= horizontalRadius; dx++) {
      for (let dz = -horizontalRadius; dz <= horizontalRadius; dz++) {
        if (dx * dx + dz * dz > horizontalRadius * horizontalRadius) {
          continue;
        }

        const location = {
          x: origin.x + dx,
          y: origin.y + dy,
          z: origin.z + dz,
        };

        try {
          const block = player.dimension.getBlock(location);
          if (block && markerIds.has(block.typeId)) {
            return true;
          }
        } catch (_error) {
          // Unloaded chunks or invalid heights are treated as not safe.
        }
      }
    }
  }

  return false;
}

export function isPlayerInSafeRoom(player, tick = currentTick()) {
  if (!player || !player.id) {
    return false;
  }

  if (hasSafeRoomTag(player)) {
    safeRoomCache.set(player.id, {
      tick,
      value: true,
      dimensionId: player.dimension ? player.dimension.id : "unknown",
      location: player.location ? { ...player.location } : { x: 0, y: 0, z: 0 },
    });
    return true;
  }

  const cached = safeRoomCache.get(player.id);
  if (cacheStillApplies(cached, player, tick)) {
    return cached.value;
  }

  const value = scanForSafeRoomMarker(player);
  safeRoomCache.set(player.id, {
    tick,
    value,
    dimensionId: player.dimension ? player.dimension.id : "unknown",
    location: player.location ? { ...player.location } : { x: 0, y: 0, z: 0 },
  });
  return value;
}

export function getVhsTierRank(tier) {
  return VHS_RANK[normalizeVhsTier(tier)] ?? 0;
}

export function requestVhsTier(player, tier, tick = currentTick(), durationTicks = 20 * 6, reason = "request") {
  const normalizedTier = normalizeVhsTier(tier);
  if (!player || !player.id || normalizedTier === VHS_TIER.Off) {
    return false;
  }

  if (!isVhsEnabled(player)) {
    clearVhsRequest(player);
    return false;
  }

  if (isPlayerInSafeRoom(player, tick) && getVhsTierRank(normalizedTier) > getVhsTierRank(VHS_TIER.Low)) {
    return false;
  }

  const existing = vhsRequests.get(player.id);
  const untilTick = tick + Math.max(1, durationTicks);
  if (
    existing &&
    existing.untilTick > tick &&
    getVhsTierRank(existing.tier) > getVhsTierRank(normalizedTier)
  ) {
    return false;
  }

  vhsRequests.set(player.id, {
    tier: normalizedTier,
    untilTick,
    reason,
  });
  return true;
}

export function getRequestedVhsRequest(player, tick = currentTick()) {
  if (!player || !player.id) {
    return { tier: VHS_TIER.Off, reason: "no-player", untilTick: 0 };
  }

  if (!isVhsEnabled(player)) {
    vhsRequests.delete(player.id);
    return { tier: VHS_TIER.Off, reason: "vhs-disabled", untilTick: 0 };
  }

  const request = vhsRequests.get(player.id);
  if (!request || request.untilTick <= tick) {
    vhsRequests.delete(player.id);
    return { tier: VHS_TIER.Off, reason: "expired", untilTick: 0 };
  }

  const tier = normalizeVhsTier(request.tier);
  if (tier === VHS_TIER.Off) {
    vhsRequests.delete(player.id);
    return { tier: VHS_TIER.Off, reason: "invalid", untilTick: 0 };
  }

  if (request.tier !== tier) {
    vhsRequests.set(player.id, { ...request, tier });
  }

  return { ...request, tier };
}

export function getRequestedVhsTier(player, tick = currentTick()) {
  return getRequestedVhsRequest(player, tick).tier;
}

export function clearVhsRequest(player) {
  if (player && player.id) {
    vhsRequests.delete(player.id);
  }
}

export function showVhsTier(player, tier, durationTicks = 35) {
  if (!player || !player.onScreenDisplay) {
    return false;
  }

  const normalizedTier = normalizeVhsTier(tier);
  if (!isVhsEnabled(player) && normalizedTier !== VHS_TIER.Off) {
    clearVhsRequest(player);
    try {
      player.onScreenDisplay.setTitle(VHS_TIER.Off, {
        fadeInDuration: 0,
        stayDuration: 1,
        fadeOutDuration: 0,
      });
    } catch (_error) {}
    return false;
  }

  try {
    if (!normalizedTier || normalizedTier === VHS_TIER.Off) {
      // Use the explicit OFF token so the resource-pack HUD binding is forced
      // away from any previous Low/High/Panic token immediately. The base HUD
      // file already suppresses this token from the vanilla title text.
      player.onScreenDisplay.setTitle(VHS_TIER.Off, {
        fadeInDuration: 0,
        stayDuration: 1,
        fadeOutDuration: 0,
      });
    } else {
      player.onScreenDisplay.setTitle(normalizedTier, {
        fadeInDuration: 0,
        stayDuration: Math.max(5, durationTicks),
        fadeOutDuration: 4,
      });
    }
    return true;
  } catch (_error) {
    return false;
  }
}


onVhsPreferenceChanged((player, enabled) => {
  if (enabled || !player || !player.id) {
    return;
  }

  clearVhsRequest(player);
  showVhsTier(player, VHS_TIER.Off, 1);
});
