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
  cracked: "paradise:bh_road_surface_cracked_asphal",
  heat: "paradise:bh_road_surface_heat_damaged_e",
  mergeArrow: "paradise:bh_road_surface_merge_arrow",
});

export const TURNOUT = Object.freeze({
  clean: "paradise:bh_concrete_divider_x0_y0_z0",
  damaged: "paradise:bh_damaged_divider_x0_y0_z0",
  guard: "paradise:bh_bent_guardrail",
  endCap: "paradise:bh_guardrail_end",
  shelter: "paradise:bh_sheltered_turnout_x0_y0_z0",
  arrow: "paradise:bh_road_surface_merge_arrow",
});

/** All staged segments for a divider or turnout piece, relative to the anchor. */
export const PIECE_SEGMENTS = Object.freeze({
  [TURNOUT.clean]: [[0, 0, 0, TURNOUT.clean], [1, 0, 0, "paradise:bh_concrete_divider_x1_y0_z0"]],
  [TURNOUT.damaged]: [[0, 0, 0, TURNOUT.damaged], [1, 0, 0, "paradise:bh_damaged_divider_x1_y0_z0"]],
  [TURNOUT.shelter]: [
    [0, 0, 0, TURNOUT.shelter],
    [0, 1, 0, "paradise:bh_sheltered_turnout_x0_y1_z0"],
    [1, 0, 0, "paradise:bh_sheltered_turnout_x1_y0_z0"],
    [1, 1, 0, "paradise:bh_sheltered_turnout_x1_y1_z0"],
  ],
});

export function segmentsFor(block) {
  return PIECE_SEGMENTS[block] ?? [[0, 0, 0, block]];
}

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
  return z >= TURNOUT_START - 12 && z <= TURNOUT_END + 12 && Math.abs(laneX) <= 3 ? SURFACE.plain : null;
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
  // The entire wreck is off-road, beyond the service shoulder.
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
  { cell: [4, 1, 3], block: "paradise:bh_broken_bumper_x0_y0_z0" },
  { cell: [5, 1, 2], block: "paradise:bh_loose_vehicle_door" },
  { cell: [6, 1, 4], block: "paradise:bh_scrap_pile" },
]);

/** Bumper is a two-cell prop; every other fitting is single-cell. */
const FITTING_SEGMENTS = Object.freeze({
  "paradise:bh_broken_bumper_x0_y0_z0": [
    [0, 0, 0, "paradise:bh_broken_bumper_x0_y0_z0"],
    [1, 0, 0, "paradise:bh_broken_bumper_x1_y0_z0"],
  ],
});

export function fittingSegments(block) {
  return FITTING_SEGMENTS[block] ?? [[0, 0, 0, block]];
}

/** Complete divider pairs run longitudinally, not across the service path. */
export function dividerPlacements(laneOffset) {
  const placements = [];
  for (let z = TURNOUT_DIVIDER_START; z <= TURNOUT_DIVIDER_END;) {
    const block = dividerBlock(z);
    const segments = segmentsFor(block);
    if (segments.length === 2 && dividerBlock(z + 1) === block) {
      for (const [dx, dy, dz, id] of segments) {
        placements.push({ x: laneOffset, y: OVERLAY_Y + dy, z: z + dx + dz, block: id, facing: "east" });
      }
      z += 2;
    } else {
      placements.push({ x: laneOffset, y: OVERLAY_Y, z, block: segments.length === 1 ? block : "minecraft:gray_concrete", facing: segments.length === 1 ? "east" : undefined });
      z++;
    }
  }
  return placements;
}

/** Two-block-wide service path stays clear; shelter occupies only X+3. */
export function turnoutShelterPlacements(laneOffset) {
  const placements = [];
  for (let z = 105; z <= 115; z += 2) {
    for (const [dx, dy, dz, block] of segmentsFor(TURNOUT.shelter)) {
      placements.push({ x: laneOffset + 3, y: OVERLAY_Y + dy, z: z + dx + dz, block, facing: "east" });
    }
  }
  return placements;
}

/** Side-wall fittings never occupy either two-wide walking strip. */
export function turnoutWallPlacements(laneOffset) {
  const anchors = [
    [67, 96, "bh_detour_sign_normal"],
    [67, 101, "bh_bent_detour_sign"],
    [66, 107, "bh_emergency_phone_box_normal_x0_y0_z0"],
    [67, 107, "bh_emergency_phone_box_normal_x0_y1_z0"],
    [65, 112, "bh_utility_cabinet_normal_x0_y0_z0"],
    [66, 112, "bh_utility_cabinet_normal_x0_y1_z0"],
    [67, 116, "bh_bent_road_closed_sign"],
    [67, 118, "bh_road_closed_sign_normal"],
    [67, 121, "bh_bent_emergency_exit_sign"],
    [67, 125, "bh_emergency_exit_sign_normal"],
  ];
  return anchors.map(([y, z, id]) => ({
    x: laneOffset + 4, y: Number(y), z: Number(z), block: "paradise:" + id, facing: "west",
  }));
}

export function turnoutShoulderPlacements(laneOffset) {
  return [
    { x: laneOffset + 3, y: 65, z: 100, block: "paradise:bh_traffic_cone", facing: "north" },
    { x: laneOffset + 3, y: 65, z: 104, block: "paradise:bh_drain_grate", facing: "north" },
    { x: laneOffset + 3, y: 65, z: 117, block: "paradise:bh_scrap_pile", facing: "north" },
    { x: laneOffset + 3, y: 65, z: 124, block: "paradise:bh_traffic_cone", facing: "north" },
  ];
}

export function isTurnoutRow(z) {
  return z >= TURNOUT_START && z <= TURNOUT_END;
}

export function isRoadOverlaySafe(y) {
  return y >= ROAD_Y && y <= OVERLAY_Y;
}

/**
 * Four-part burned shell: the S-mode split pieces land in the wreck cluster's
 * local cells (2,1,2), (3,1,2), (2,1,3), (3,1,3) at world origin + cell.
 */
export const WRECK_SHELL_SEGMENTS = Object.freeze([
  { cell: [2, 1, 2], block: "paradise:bh_burned_out_vehicle_shell_x0_y0_z0" },
  { cell: [3, 1, 2], block: "paradise:bh_burned_out_vehicle_shell_x1_y0_z0" },
  { cell: [2, 1, 3], block: "paradise:bh_burned_out_vehicle_shell_x0_y0_z1" },
  { cell: [3, 1, 3], block: "paradise:bh_burned_out_vehicle_shell_x1_y0_z1" },
]);

export function wreckSegmentPlacements(origin) {
  return WRECK_SHELL_SEGMENTS.map((segment) => ({
    x: origin.x + segment.cell[0],
    y: origin.y + segment.cell[1],
    z: origin.z + segment.cell[2],
    block: segment.block,
  }));
}

export function wreckFittingPlacements(origin) {
  return WRECK_FITTINGS.flatMap((fitting) => fittingSegments(fitting.block).map(([dx, dy, dz, block]) => ({
    x: origin.x + fitting.cell[0] + dx,
    y: origin.y + fitting.cell[1] + dy,
    z: origin.z + fitting.cell[2] + dz,
    block,
  })));
}
