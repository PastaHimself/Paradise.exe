// Static Burning Highway road wear and turnout rules (Ticket 6). Pure helpers
// so overlay and divider patterns can be tested without a Bedrock runtime.

export const ROAD_Y = 64;
export const OVERLAY_Y = 65;
export const TURNOUT_START = 96;
export const TURNOUT_END = 127;
export const TURNOUT_DIVIDER_START = 99;
export const TURNOUT_DIVIDER_END = 124;
export const SKID_START = 136;
export const SKID_END = 141;

export const SURFACE = Object.freeze({
  plain: "paradise:bh_road_surface_plain_asphalt",
  lane: "paradise:bh_road_surface_lane_stripe",
  shoulder: "paradise:bh_road_surface_shoulder_strip",
  skid: "paradise:bh_road_surface_skid_marks",
  cracked: "paradise:bh_road_surface_cracked_asphalt",
  heat: "paradise:bh_road_surface_heat_damaged_edge",
  mergeArrow: "paradise:bh_road_surface_merge_arrow",
});

export const TURNOUT = Object.freeze({
  clean: "paradise:bh_concrete_divider",
  damaged: "paradise:bh_damaged_divider",
  guard: "paradise:bh_bent_guardrail",
  endCap: "paradise:bh_guardrail_end",
  shelter: "paradise:bh_sheltered_turnout",
  arrow: "paradise:bh_road_surface_merge_arrow",
});

/** Road overlay block for a lane-relative x and z, or null for bare asphalt. */
export function surfaceOverlay(laneX, z, finishDistance) {
  if (z < 11 || z > finishDistance - 25) return null;

  if (z >= TURNOUT_START && z <= TURNOUT_END) {
    if (z === 125 && laneX === 1) return TURNOUT.arrow;
    if (laneX >= -3 && laneX <= 3) return SURFACE.plain;
    return null;
  }

  if (z >= SKID_START && z <= SKID_END && laneX === -1) return SURFACE.skid;
  if (z % 17 === 0 && laneX === 3) return SURFACE.cracked;
  if (z % 23 === 0 && laneX === -3) return SURFACE.heat;
  if (z % 8 >= 0 && z % 8 <= 3 && laneX === -2) return SURFACE.lane;
  if (laneX === -3 || laneX === 3) return SURFACE.shoulder;
  return SURFACE.plain;
}

/** Turnout divider material on X0; null where the lane stays open. */
export function dividerBlock(z) {
  if (z < TURNOUT_DIVIDER_START || z > TURNOUT_DIVIDER_END) return null;
  if (z <= 105) return TURNOUT.clean;
  if (z <= 107) return TURNOUT.damaged;
  if (z <= 117) return TURNOUT.clean;
  if (z <= 122) return TURNOUT.guard;
  return TURNOUT.endCap;
}

/** Turnout entries stay clear at both ends. */
export function isTurnoutEntry(z) {
  return (z >= TURNOUT_START && z <= TURNOUT_START + 2) || (z >= TURNOUT_END - 2 && z <= TURNOUT_END);
}

/** Ribs are skipped over the turnout and stop before the finish area. */
export function ribRows(finishDistance) {
  const rows = [];
  for (let z = 48; z < finishDistance - 24; z += 64) {
    if (z >= TURNOUT_START - 2 && z <= TURNOUT_END + 1) continue;
    rows.push(z);
  }
  return rows;
}

export function wreckOrigin(laneOffset, finishDistance, seed) {
  return {
    x: laneOffset + 9,
    y: ROAD_Y,
    z: Math.min(finishDistance - 30, 286 + ((seed >>> 10) % 23)),
  };
}

/** Static vehicle cells keep the walking strips at X−3..−1 clear. */
export const WRECK_CELLS = Object.freeze([
  [2, 1, 2],
  [3, 1, 2],
  [2, 1, 3],
  [3, 1, 3],
]);

export const WRECK_FITTINGS = Object.freeze([
  { cell: [1, 1, 3], block: "paradise:bh_detached_wheel" },
  { cell: [4, 1, 3], block: "paradise:bh_broken_bumper" },
  { cell: [5, 1, 2], block: "paradise:bh_loose_vehicle_door" },
  { cell: [6, 1, 4], block: "paradise:bh_scrap_pile" },
]);

export function isRoadOverlaySafe(y) {
  return y >= ROAD_Y && y <= OVERLAY_Y;
}
