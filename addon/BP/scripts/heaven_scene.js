// Static Heaven rest-station and landmark layouts (Ticket 7). Pure helpers so
// the clean/disturbed pair, pool edging and the reserved dais stay testable.

export const FLOOR_Y = 64;

export const REST = Object.freeze({
  clean: Object.freeze({
    bench: "paradise:hv_rest_bench_clean_x0_y0_z0",
    lamp: "paradise:hv_rest_wall_lamp_clean_x0_y0_z0",
    sign: "paradise:hv_rest_you_are_safe_sign_clea_x0_y0_z0",
    table: "paradise:hv_bedside_table_clean",
    chest: "paradise:hv_white_chest_casing_clean",
    plaque: "paradise:hv_blank_plaque_clean_x0_y0_z0",
  }),
  disturbed: Object.freeze({
    bench: "paradise:hv_disturbed_rest_bench_geomet_x0_y0_z0",
    lamp: "paradise:hv_disturbed_wall_lamp_geomet",
    sign: "paradise:hv_disturbed_safety_sign_geome_x0_y0_z0",
    table: "paradise:hv_disturbed_bedside_table_geo_x0_y0_z0",
    chest: "paradise:hv_disturbed_white_chest_geome_x0_y0_z0",
    plaque: "paradise:hv_cracked_plaque_disturbed_x0_y0_z0",
    footprints: "paradise:hv_disturbed_footprints_faint",
    footprintsDistinct: "paradise:hv_disturbed_footprints_disti",
  }),
});

export const POOL = Object.freeze({
  edging: "paradise:hv_garden_edging_disturbed",
  rim: "paradise:hv_fountain_rim_disturbed_x0_y0_z0",
  planter: "paradise:hv_pale_planter_clean_x0_y0_z0",
  hedge: "paradise:hv_clipped_hedge_clean_x0_y0_z0",
});

export const EXIT_FRAMES = Object.freeze({
  open: "paradise:hv_open_exit_frame_x0_y0_z0",
  final: "paradise:hv_final_door_frame_x0_y0_z0",
});

/**
 * Staged segment layouts for every multi-cell Heaven piece. Offsets are
 * relative to the anchor cell so the writer places complete models only.
 */
export const PIECE_SEGMENTS = Object.freeze({
  [REST.clean.bench]: [[0, 0, 0, REST.clean.bench], [1, 0, 0, "paradise:hv_rest_bench_clean_x1_y0_z0"]],
  [REST.clean.lamp]: [[0, 0, 0, REST.clean.lamp], [0, 1, 0, "paradise:hv_rest_wall_lamp_clean_x0_y1_z0"]],
  [REST.clean.sign]: [
    [0, 0, 0, REST.clean.sign],
    [0, 1, 0, "paradise:hv_rest_you_are_safe_sign_clea_x0_y1_z0"],
    [1, 0, 0, "paradise:hv_rest_you_are_safe_sign_clea_x1_y0_z0"],
    [1, 1, 0, "paradise:hv_rest_you_are_safe_sign_clea_x1_y1_z0"],
  ],
  [REST.clean.plaque]: [
    [0, 0, 0, REST.clean.plaque],
    [0, 1, 0, "paradise:hv_blank_plaque_clean_x0_y1_z0"],
    [1, 0, 0, "paradise:hv_blank_plaque_clean_x1_y0_z0"],
  ],
  [REST.disturbed.bench]: [
    [0, 0, 0, REST.disturbed.bench],
    [1, 0, 0, "paradise:hv_disturbed_rest_bench_geomet_x1_y0_z0"],
  ],
  [REST.disturbed.sign]: [
    [0, 0, 0, REST.disturbed.sign],
    [0, 1, 0, "paradise:hv_disturbed_safety_sign_geome_x0_y1_z0"],
    [1, 0, 0, "paradise:hv_disturbed_safety_sign_geome_x1_y0_z0"],
    [1, 1, 0, "paradise:hv_disturbed_safety_sign_geome_x1_y1_z0"],
  ],
  [REST.disturbed.chest]: [
    [0, 0, 0, REST.disturbed.chest],
    [1, 0, 0, "paradise:hv_disturbed_white_chest_geome_x1_y0_z0"],
  ],
  [REST.disturbed.plaque]: [
    [0, 0, 0, REST.disturbed.plaque],
    [0, 1, 0, "paradise:hv_cracked_plaque_disturbed_x0_y1_z0"],
    [1, 0, 0, "paradise:hv_cracked_plaque_disturbed_x1_y0_z0"],
  ],
  [POOL.rim]: [
    [0, 0, 0, POOL.rim],
    [0, 0, 1, "paradise:hv_fountain_rim_disturbed_x0_y0_z1"],
    [1, 0, 0, "paradise:hv_fountain_rim_disturbed_x1_y0_z0"],
    [1, 0, 1, "paradise:hv_fountain_rim_disturbed_x1_y0_z1"],
  ],
  [POOL.planter]: [
    [0, 0, 0, POOL.planter],
    [0, 0, 1, "paradise:hv_pale_planter_clean_x0_y0_z1"],
    [0, 1, 0, "paradise:hv_pale_planter_clean_x0_y1_z0"],
    [1, 0, 0, "paradise:hv_pale_planter_clean_x1_y0_z0"],
    [1, 0, 1, "paradise:hv_pale_planter_clean_x1_y0_z1"],
  ],
  "paradise:hv_empty_planter_disturbed_x0_y0_z0": [
    [0, 0, 0, "paradise:hv_empty_planter_disturbed_x0_y0_z0"],
    [0, 0, 1, "paradise:hv_empty_planter_disturbed_x0_y0_z1"],
    [1, 0, 0, "paradise:hv_empty_planter_disturbed_x1_y0_z0"],
    [1, 0, 1, "paradise:hv_empty_planter_disturbed_x1_y0_z1"],
  ],
  [POOL.hedge]: [[0, 0, 0, POOL.hedge], [0, 1, 0, "paradise:hv_clipped_hedge_clean_x0_y1_z0"]],
  [EXIT_FRAMES.open]: [
    [0, 0, 0, EXIT_FRAMES.open],
    [0, 1, 0, "paradise:hv_open_exit_frame_x0_y1_z0"],
    [1, 0, 0, "paradise:hv_open_exit_frame_x1_y0_z0"],
    [1, 1, 0, "paradise:hv_open_exit_frame_x1_y1_z0"],
  ],
  [EXIT_FRAMES.final]: [
    [0, 0, 0, EXIT_FRAMES.final],
    [0, 1, 0, "paradise:hv_final_door_frame_x0_y1_z0"],
    [1, 0, 0, "paradise:hv_final_door_frame_x1_y0_z0"],
    [1, 1, 0, "paradise:hv_final_door_frame_x1_y1_z0"],
  ],
});

export function segmentsFor(block) {
  return PIECE_SEGMENTS[block] ?? [[0, 0, 0, block]];
}

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

/** Static displays are deliberately separate from the gameplay rest pad. */
export function restStations(x, z) {
  return [
    { id: "clean", offsetX: -20, z: z + 2, blocks: REST.clean },
    { id: "disturbed", offsetX: -20, z: z + 12, blocks: REST.disturbed },
  ];
}

export function restStationPlan(x, z, blocks, disturbed = false) {
  const plan = [
    { x, y: 65, z: z + 4, block: blocks.bench },
    { x: x + 6, y: 66, z: z + 5, block: blocks.lamp },
    { x: x + 3, y: 66, z: z + 5, block: blocks.sign },
    { x: x + 2, y: 65, z: z + 4, block: blocks.table },
    { x: x + 6, y: 65, z: z + 4, block: blocks.chest },
    { x: x + 5, y: 67, z: z + 5, block: blocks.plaque },
    { x: x + 7, y: 65, z: z + 2, block: disturbed ? "paradise:hv_empty_planter_disturbed_x0_y0_z0" : POOL.planter },
  ];
  if (disturbed) {
    plan.push({ x: x + 2, y: 64, z: z + 2, block: REST.disturbed.footprints });
    plan.push({ x: x + 4, y: 64, z: z + 3, block: REST.disturbed.footprintsDistinct });
  }
  return plan;
}

export function visitLandmarks(x) {
  const chunkX = 16 * Math.floor(x / 16);
  return [
    { key: "clean-rest", x: x - 20, z: 2, width: 9, depth: 7 },
    { key: "disturbed-rest", x: x - 20, z: 12, width: 9, depth: 7 },
    { key: "pool", x: chunkX - 2, z: 19, width: 16, depth: 18 },
    { key: "temple", x: chunkX + 24, z: 16, width: 24, depth: 24 },
  ];
}

export function coveredChunks(rectangle) {
  const keys = [];
  for (let cx = Math.floor(rectangle.x / 16); cx <= Math.floor((rectangle.x + rectangle.width - 1) / 16); cx++) {
    for (let cz = Math.floor(rectangle.z / 16); cz <= Math.floor((rectangle.z + rectangle.depth - 1) / 16); cz++) {
      keys.push(`${cx}:${cz}`);
    }
  }
  return keys;
}

export function rectanglesIntersect(a, b) {
  return a.x < b.x + b.width && b.x < a.x + a.width
    && a.z < b.z + b.depth && b.z < a.z + a.depth;
}

export function visitReservations(x) {
  return [
    ...visitLandmarks(x),
    { x: x - 3, z: 2, width: 7, depth: 7 },
    { x: x + 6, z: 7, width: 7, depth: 7 },
    { x: x - 16, z: 4, width: 13, depth: 2 },
    { x: x - 16, z: 6, width: 2, depth: 10 },
    { x: x - 14, z: 6, width: 5, depth: 5 },
  ];
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
  for (let dz = 1; dz < last; dz++) {
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

/** Inert exit models belong at the fixed temple, not at the gameplay pad. */
export function exitFrames(x, z) {
  return [
    { x: x + 3, y: FLOOR_Y + 3, z: z + 20, block: EXIT_FRAMES.open },
    { x: x + 10, y: FLOOR_Y + 3, z: z + 20, block: EXIT_FRAMES.final },
  ];
}
