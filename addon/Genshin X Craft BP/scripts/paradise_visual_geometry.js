export function selectVisualModuleIndex(seed, moduleCount, consumedLowBits = 0) {
  const count = Math.max(1, Math.floor(Number(moduleCount) || 0));
  const shift = Math.max(0, Math.min(31, Math.floor(Number(consumedLowBits) || 0)));
  return ((Number(seed) >>> shift) % count) >>> 0;
}

export function shouldRebuildGeneratedPatch(current, runSeed, force = false, dirty = false) {
  return !current || current.runSeed !== runSeed || force === true || dirty === true;
}

export function playersIntersectStructureBounds(players, location, size, margin = 0) {
  if (!location || !size) return false;
  const safeMargin = Math.max(0, Number(margin) || 0);
  const minX = Number(location.x) - safeMargin;
  const minY = Number(location.y) - safeMargin;
  const minZ = Number(location.z) - safeMargin;
  const maxX = Number(location.x) + Math.max(1, Number(size.x) || 1) - 1 + safeMargin;
  const maxY = Number(location.y) + Math.max(1, Number(size.y) || 1) - 1 + safeMargin;
  const maxZ = Number(location.z) + Math.max(1, Number(size.z) || 1) - 1 + safeMargin;

  for (const player of players || []) {
    const point = player?.location;
    if (!point) continue;
    if (
      point.x >= minX && point.x <= maxX &&
      point.y >= minY && point.y <= maxY &&
      point.z >= minZ && point.z <= maxZ
    ) {
      return true;
    }
  }
  return false;
}
