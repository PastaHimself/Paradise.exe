function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

/**
 * Keeps an authored bearing/elevation while moving a preferred Watcher location
 * inside the selected psychological style's actual 3D distance contract.
 */
export function clampPreferredLocationToRange(playerLocation, preferredLocation, range) {
  if (!playerLocation || !preferredLocation || !Array.isArray(range) || range.length < 2) return preferredLocation;
  const min = Math.max(0, finite(range[0]));
  const max = Math.max(min, finite(range[1], min));
  const inset = Math.min(0.1, Math.max(0, max - min) * 0.25);
  const safeMin = min + inset;
  const safeMax = Math.max(safeMin, max - inset);

  const dx = finite(preferredLocation.x) - finite(playerLocation.x);
  const dyOriginal = finite(preferredLocation.y, finite(playerLocation.y)) - finite(playerLocation.y);
  const dz = finite(preferredLocation.z) - finite(playerLocation.z);
  const horizontalDistance = Math.hypot(dx, dz);
  const threeDimensionalDistance = Math.hypot(horizontalDistance, dyOriginal);
  const targetDistance = Math.max(safeMin, Math.min(safeMax, threeDimensionalDistance || safeMin));

  // Normal V2 anchors have small elevation offsets. If a caller ever provides an
  // impossible vertical delta, constrain only that exceptional case so the final
  // location can still satisfy the Watcher's safety contract.
  const maxVertical = Math.max(0, targetDistance - 0.05);
  const dy = Math.sign(dyOriginal || 1) * Math.min(Math.abs(dyOriginal), maxVertical);
  const targetHorizontal = Math.sqrt(Math.max(0, targetDistance * targetDistance - dy * dy));

  let ux = 0;
  let uz = 1;
  if (horizontalDistance > 0.0001) {
    ux = dx / horizontalDistance;
    uz = dz / horizontalDistance;
  }

  return {
    x: finite(playerLocation.x) + ux * targetHorizontal,
    y: finite(playerLocation.y) + dy,
    z: finite(playerLocation.z) + uz * targetHorizontal,
  };
}
