/**
 * Dispatch an ambient particle to one player's client only.
 *
 * @param {{ spawnParticle?: (particleId: string, location: import("@minecraft/server").Vector3) => void } | undefined} player
 * @param {string} particleId
 * @param {import("@minecraft/server").Vector3} location
 * @returns {boolean}
 */
export function spawnParticleForPlayer(player, particleId, location) {
  if (!player || typeof player.spawnParticle !== "function" || !particleId || !location) return false;
  player.spawnParticle(particleId, location);
  return true;
}
