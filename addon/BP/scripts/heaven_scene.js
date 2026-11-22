// Static Heaven rest-station and landmark layouts (Ticket 7). Pure helpers so
// the clean/disturbed pair, pool edging and the reserved dais stay testable.

export const FLOOR_Y = 64;

export const REST = Object.freeze({
  clean: Object.freeze({
    bench: "paradise:hv_rest_bench_clean",
    lamp: "paradise:hv_rest_wall_lamp_clean",
    sign: "paradise:hv_rest_you_are_safe_sign_clean",
    table: "paradise:hv_bedside_table_clean",
    chest: "paradise:hv_disturbed_white_chest_geometry_clean",
    plaque: "paradise:hv_blank_plaque_clean",
  }),
  disturbed: Object.freeze({
    bench: "paradise:hv_disturbed_rest_bench_geometry",
    lamp: "paradise:hv_disturbed_wall_lamp_geometry",
    sign: "paradise:hv_disturbed_safety_sign_geometry",
    table: "paradise:hv_disturbed_bedside_table_geometry",
    chest: "paradise:hv_disturbed_white_chest_geometry",
    plaque: "paradise:hv_engraved_panel_disturbed",
    footprints: "paradise:hv_disturbed_footprints_deep",
  }),
});

export const POOL = Object.freeze({
  edging: "paradise:hv_garden_edging_disturbed",
  rim: "paradise:hv_fountain_rim_disturbed",
  planter: "paradise:hv_pale_planter_clean",
  hedge: "paradise:hv_clipped_hedge_clean",
});

export const EXIT_FRAMES = Object.freeze({
  open: "paradise:hv_open_exit_frame",
  final: "paradise:hv_final_door_frame",
});

/** Future altar reserve inside the temple: local [10..13, 3..6, 10..13]. */
export const DAIS_RESERVE = Object.freeze({
  minX: 10,
  maxX: 13,
  minY: 3,
  maxY: 6,
  minZ: 10,
  maxZ: 13,
});

export function isDaisReserved(x, y, z) {
  return x >= DAIS_RESERVE.minX && x <= DAIS_RESERVE.maxX
    && y >= DAIS_RESERVE.minY && y <= DAIS_RESERVE.maxY
    && z >= DAIS_RESERVE.minZ && z <= DAIS_RESERVE.maxZ;
}

/**
 * Side-by-side rest stations: the clean one at the spawn anchor and the
 * disturbed twin nine blocks east so both read from the same approach.
 */
export function restStations(x, z) {
  return [
    { id: "clean", offsetX: 0, z, blocks: REST.clean },
    { id: "disturbed", offsetX: 9, z, blocks: REST.disturbed },
  ];
}

/** Bench, lamp, sign, table and chest placements for one station. */
export function restStationPlan(x, z, blocks, disturbed = false) {
  const plan = [
    { x, y: FLOOR_Y + 1, z: z + 5, block: blocks.bench },
    { x: x + 2, y: FLOOR_Y + 2, z: z + 5, block: blocks.lamp },
    { x, y: FLOOR_Y + 1, z: z + 3, block: blocks.sign },
    { x: x - 1, y: FLOOR_Y + 1, z: z + 5, block: blocks.table },
    { x: x + 2, y: FLOOR_Y + 1, z: z + 6, block: blocks.chest },
    { x: x, y: FLOOR_Y + 1, z: z + 7, block: blocks.plaque },
  ];
  if (disturbed) {
    plan.push({ x: x + 1, y: FLOOR_Y, z: z + 4, block: REST.disturbed.footprints });
    plan.push({ x: x - 1, y: FLOOR_Y, z: z + 6, block: REST.disturbed.footprints });
  }
  return plan;
}

/**
 * Pool garden edging on the rim (x/z = 0 or size−1) with north pedestrian
 * openings at x5..6 and planters on the four corners.
 */
export function poolEdging(x, z, size = 12) {
  const cells = [];
  const last = size - 1;
  for (let dx = 0; dx <= last; dx++) {
    for (const dz of [0, last]) {
      if (dz === 0 && dx >= 5 && dx <= 6) continue;
      cells.push({ x: x + dx, y: FLOOR_Y + 1, z: z + dz });
    }
  }
  for (let dz = 0; dz <= last; dz++) {
    for (const dx of [0, last]) {
      cells.push({ x: x + dx, y: FLOOR_Y + 1, z: z + dz });
    }
  }
  return cells;
}

export function poolPlanters(x, z, size = 12) {
  const last = size - 1;
  return [
    { x, z, block: POOL.planter },
    { x: x + last, z, block: POOL.planter },
    { x, z: z + last, block: POOL.planter },
    { x: x + last, z: z + last, block: POOL.planter },
  ];
}

/** Exit frames flank the arrival pad: open on the west, final on the east. */
export function exitFrames(x, z) {
  return [
    { x: x - 4, y: FLOOR_Y + 1, z, block: EXIT_FRAMES.open },
    { x: x + 4, y: FLOOR_Y + 1, z, block: EXIT_FRAMES.final },
  ];
}
