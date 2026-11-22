const MEMORY_TIER = Object.freeze({
  SuperLow: 0,
  Low: 1,
  Mid: 2,
  High: 3,
  SuperHigh: 4,
});

const PROFILE = Object.freeze({
  LOW: Object.freeze({ particlePulseTicks: 34, particleBurst: 0, particleRadius: 10 }),
  MID: Object.freeze({ particlePulseTicks: 22, particleBurst: 1, particleRadius: 17 }),
  HIGH: Object.freeze({ particlePulseTicks: 16, particleBurst: 2, particleRadius: 23 }),
  SUPER_HIGH: Object.freeze({ particlePulseTicks: 12, particleBurst: 3, particleRadius: 29 }),
});

export function getVisualBudget(player) {
  /** @type {number} */
  let tier = MEMORY_TIER.Low;
  try {
    const value = player?.clientSystemInfo?.memoryTier;
    if (typeof value === "number") tier = value;
  } catch (_error) {}

  if (tier >= MEMORY_TIER.SuperHigh) return PROFILE.SUPER_HIGH;
  if (tier >= MEMORY_TIER.High) return PROFILE.HIGH;
  if (tier >= MEMORY_TIER.Mid) return PROFILE.MID;
  return PROFILE.LOW;
}

/** Vanilla world height for the current build; decor never targets outside it. */
export const WORLD_MIN_Y = -64;
export const WORLD_MAX_Y = 319;

/** Keep every decorative write inside the world height, with a one-block margin. */
export function clampVisualY(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return WORLD_MIN_Y + 1;
  return Math.min(WORLD_MAX_Y - 1, Math.max(WORLD_MIN_Y + 1, Math.trunc(number)));
}

/** True when a decorative Y is inside the writable band. */
export function isVisualYInBounds(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= WORLD_MIN_Y && number <= WORLD_MAX_Y;
}

/**
 * Leaves are decoration only. The Low tier (and the clamping band edges) drop
 * them instead of placing them, so weak devices never pay for a leaf pass.
 */
export function shouldPlaceLeaf(budget, value) {
  if (!isVisualYInBounds(value)) return false;
  const burst = budget?.particleBurst ?? PROFILE.LOW.particleBurst;
  return burst > 0;
}
