import { system } from "@minecraft/server";
import { isVhsEnabled, onVhsPreferenceChanged } from "./player_config.js";

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

const vhsRequests = new Map();

function currentTick() {
  try {
    return system.currentTick || 0;
  } catch (_error) {
    return 0;
  }
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
