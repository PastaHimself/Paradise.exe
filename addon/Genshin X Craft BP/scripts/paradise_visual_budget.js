const MEMORY_TIER = Object.freeze({
  SuperLow: 0,
  Low: 1,
  Mid: 2,
  High: 3,
  SuperHigh: 4,
});

const PROFILE = Object.freeze({
  LOW: Object.freeze({ particlePulseTicks: 30, particleBurst: 0, particleRadius: 10 }),
  MID: Object.freeze({ particlePulseTicks: 20, particleBurst: 1, particleRadius: 16 }),
  HIGH: Object.freeze({ particlePulseTicks: 15, particleBurst: 2, particleRadius: 22 }),
  SUPER_HIGH: Object.freeze({ particlePulseTicks: 10, particleBurst: 3, particleRadius: 28 }),
});

export function getVisualBudget(player) {
  let tier = MEMORY_TIER.Mid;
  try {
    const value = player?.clientSystemInfo?.memoryTier;
    if (typeof value === "number") tier = value;
  } catch (_error) {}

  if (tier >= MEMORY_TIER.SuperHigh) return PROFILE.SUPER_HIGH;
  if (tier >= MEMORY_TIER.High) return PROFILE.HIGH;
  if (tier >= MEMORY_TIER.Mid) return PROFILE.MID;
  return PROFILE.LOW;
}
