/**
 * @param {Map<string, { patchX: number, patchZ: number, falseFlowers?: Array<{ patchX: number, patchZ: number }> }>} activeFlowers
 * @param {string} excludedPlayerId
 * @returns {Set<string>}
 */
export function collectOccupiedFlowerPatches(activeFlowers, excludedPlayerId) {
  const occupied = new Set();
  for (const [playerId, flower] of activeFlowers) {
    if (playerId === excludedPlayerId || !flower) continue;
    occupied.add(`${flower.patchX}:${flower.patchZ}`);
    for (const falseFlower of flower.falseFlowers || []) {
      occupied.add(`${falseFlower.patchX}:${falseFlower.patchZ}`);
    }
  }
  return occupied;
}

/**
 * @param {{ patchX: number, patchZ: number, falseFlowers?: Array<{ patchX: number, patchZ: number }> }} flower
 * @returns {Array<{ patchX: number, patchZ: number }>}
 */
export function collectUniqueFlowerPatches(flower) {
  const patches = new Map();
  const add = (patchX, patchZ) => patches.set(`${patchX}:${patchZ}`, { patchX, patchZ });
  add(flower.patchX, flower.patchZ);
  for (const falseFlower of flower.falseFlowers || []) {
    add(falseFlower.patchX, falseFlower.patchZ);
  }
  return [...patches.values()];
}

/**
 * @param {string} playerId
 * @param {Array<Map<string, unknown> | Set<string>>} collections
 * @returns {void}
 */
export function clearPlayerEntries(playerId, collections) {
  for (const collection of collections) collection.delete(playerId);
}
