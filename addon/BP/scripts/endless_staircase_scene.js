// Static Endless Staircase schedule (Ticket 4). Pure helpers so the 12-step
// station rhythm can be tested without a Bedrock runtime.

export const START_Y = 64;
export const START_Z = 0;
export const STATION_STEPS = 12;
export const WORLD_MAX_Y = 319;

export const TREAD_COLUMN_OFFSETS = Object.freeze([0, -1]);

export const STAIR_DECOR = Object.freeze({
  tread: "paradise:es_stair_tread",
  chippedTread: "paradise:es_chipped_stair_tread_geometry",
  guard: "paradise:es_straight_railing_x0_y0_z0",
  guardTop: "paradise:es_straight_railing_x0_y1_z0",
  guardSloped: "paradise:es_sloped_railing",
  guardPost: "paradise:es_railing_end_post_x0_y0_z0",
  guardPostTop: "paradise:es_railing_end_post_x0_y1_z0",
  guardCorner: "paradise:es_corner_railing_x0_y0_z0",
  landingTiles: "paradise:es_scuffed_landing_tiles",
  landingPlate: "paradise:es_landing_plate",
  landingPlatePeeling: "paradise:es_landing_plate_peeling",
  landingPlateBlank: "paradise:es_landing_plate_blank",
  landingPlateRepeated: "paradise:es_landing_plate_repeated",
  lampNormal: "paradise:es_caged_wall_lamp",
  lampRed: "paradise:es_caged_wall_lamp_red",
  lampDead: "paradise:es_caged_wall_lamp_dead",
  stepLight: "paradise:es_small_step_light",
  chainedDoor: "paradise:es_chained_service_door_x0_y0_z0",
  chainedDoorTop: "paradise:es_chained_service_door_x0_y1_z0",
  emergencyDoor: "paradise:es_emergency_door_x0_y0_z0",
  emergencyDoorTop: "paradise:es_emergency_door_x0_y1_z0",
  supportBeam: "paradise:es_support_beam_x0_y0_z0",
  metalGrating: "paradise:es_metal_grating",
  crackedConcrete: "paradise:es_cracked_concrete",
  dampWall: "paradise:es_damp_wall_patches",
  rebar: "paradise:es_exposed_rebar",
  cable: "paradise:es_exposed_cable_bundle",
  shaftCable: "paradise:es_hanging_shaft_cable_x0_y0_z0",
  shaftCableTop: "paradise:es_hanging_shaft_cable_x0_y1_z0",
  bracket: "paradise:es_mounting_bracket",
  pipeElbow: "paradise:es_pipe_elbow",
  hatch: "paradise:es_staircase_hatch",
  signForward: "paradise:es_stairwell_direction_sign",
  signDown: "paradise:es_stairwell_direction_sign_down",
  signRight: "paradise:es_stairwell_direction_sign_right",
});

export function stairY(z) {
  return START_Y + z;
}

/** Only rows whose tread top stays at or below Y319 may be written. */
export function isLegalRow(z) {
  return Number.isFinite(z) && z >= START_Z && stairY(z) <= WORLD_MAX_Y;
}

export function stationIndex(z) {
  return Math.floor(z / STATION_STEPS);
}

export function stationZ(k) {
  return k * STATION_STEPS;
}

export function stationY(k) {
  return START_Y + stationZ(k);
}

export function isChippedRow(z) {
  return z >= 0 && z % 11 === 7;
}

export function lampBlock(k) {
  const phase = ((k % 4) + 4) % 4;
  if (phase === 2) return STAIR_DECOR.lampRed;
  if (phase === 3) return STAIR_DECOR.lampDead;
  return STAIR_DECOR.lampNormal;
}

export function lampLight(k) {
  const phase = ((k % 4) + 4) % 4;
  if (phase === 2) return 7;
  if (phase === 3) return 0;
  return 11;
}

export function plateBlock(k) {
  if (k < 4) return STAIR_DECOR.landingPlate;
  if (k < 8) return STAIR_DECOR.landingPlatePeeling;
  if (k < 12) return STAIR_DECOR.landingPlateBlank;
  return STAIR_DECOR.landingPlateRepeated;
}

export function serviceDoorBlock(k) {
  if (k % 6 !== 0 && !(k >= 2 && k % 6 === 2)) return null;
  return k % 12 === 0 ? STAIR_DECOR.chainedDoor : STAIR_DECOR.emergencyDoor;
}

/** The bridge is staged only at these authored rows, never at the 24-step interval. */
export const BRIDGE_ROWS = Object.freeze([96, 192]);

export function isBridgeRow(z) {
  return BRIDGE_ROWS.includes(z);
}

export function signBlock(k) {
  const phase = ((k % 3) + 3) % 3;
  if (phase === 1) return STAIR_DECOR.signDown;
  if (phase === 2) return STAIR_DECOR.signRight;
  return STAIR_DECOR.signForward;
}

/**
 * Guard, landing and fitting placements for one authored row. Coordinates are
 * world space; `lane` is the per-player lane offset.
 *
 * Columns, from west to east:
 *   lane-2  solid shaft wall backing with the flush wall fixtures
 *   lane-1  west tread (`TREAD_COLUMN_OFFSETS`)
 *   lane    east tread
 *   lane+1  guard line at tread-top height (L+1)
 *   lane+2..lane+3  supported side landing at every station row
 *   lane+3  landing guard line on the outer platform edge
 */
export const WALL_OFFSET = -2;
export const GUARD_OFFSET = 1;
export const LANDING_INNER_OFFSET = 2;
export const LANDING_OUTER_OFFSET = 3;
export const LANDING_GUARD_OFFSET = 3;

const WALL_BLOCKS = Object.freeze([
  STAIR_DECOR.crackedConcrete,
  STAIR_DECOR.dampWall,
]);

/** Solid wall backing so every fixture has a surface to mount on. */
export function wallPlacements(lane, z) {
  if (!isLegalRow(z)) return [];
  const y = stairY(z);
  const base = z % 9 === 0 || z % 17 === 0 ? WALL_BLOCKS[1] : WALL_BLOCKS[0];
  const placements = [];
  for (let dy = 0; dy <= 2; dy++) {
    if (y + dy > WORLD_MAX_Y) continue;
    placements.push({ x: lane + WALL_OFFSET, y: y + dy, z, block: base, role: "wall" });
  }
  return placements;
}

function landingPlatform(lane, z) {
  const y = stairY(z);
  const placements = [];
  for (let x = lane + LANDING_INNER_OFFSET; x <= lane + LANDING_OUTER_OFFSET; x++) {
    for (let dz = 0; dz <= 1; dz++) {
      placements.push({ x, y, z: z + dz, block: STAIR_DECOR.landingTiles, role: "landing" });
    }
  }
  // Two stacked support beams carry each landing back down the shaft.
  for (let dy = 1; dy <= 2; dy++) {
    placements.push({
      x: lane + LANDING_OUTER_OFFSET,
      y: y - dy,
      z: z + 1,
      block: STAIR_DECOR.supportBeam,
      role: "support",
    });
  }
  // Outer guard, two vertical segments at both landing depths.
  for (let dz = 0; dz <= 1; dz++) {
    placements.push({ x: lane + LANDING_GUARD_OFFSET, y: y + 1, z: z + dz, block: STAIR_DECOR.guard, role: "guard" });
    placements.push({ x: lane + LANDING_GUARD_OFFSET, y: y + 2, z: z + dz, block: STAIR_DECOR.guardTop, role: "guard" });
  }
  placements.push({ x: lane + LANDING_GUARD_OFFSET, y: y + 1, z: z + 2, block: STAIR_DECOR.guardPost, role: "guard" });
  placements.push({ x: lane + LANDING_GUARD_OFFSET, y: y + 2, z: z + 2, block: STAIR_DECOR.guardPostTop, role: "guard" });
  return placements;
}

export function scenePlacements(lane, z) {
  if (!isLegalRow(z)) return [];
  const y = stairY(z);
  const k = stationIndex(z);
  const atStation = z === stationZ(k);
  const placements = [];

  // Wall backing first: fixtures below replace wall cells and stay flush.
  placements.push(...wallPlacements(lane, z));

  // Guard line at tread-top height, sloped with the rise; the station row
  // opens onto the side landing instead.
  if (!atStation) {
    placements.push({ x: lane + GUARD_OFFSET, y: y + 1, z, block: STAIR_DECOR.guardSloped, role: "guard" });
  }
  if (z % 4 === 0 && !atStation) {
    placements.push({ x: lane + GUARD_OFFSET, y: y + 1, z, block: STAIR_DECOR.guardPost, role: "guard" });
    placements.push({ x: lane + GUARD_OFFSET, y: y + 2, z, block: STAIR_DECOR.guardPostTop, role: "guard" });
  }

  // Chipped treads replace the east tread on the authored rows.
  if (isChippedRow(z)) {
    placements.push({ x: lane - 1, y, z, block: STAIR_DECOR.chippedTread, role: "tread" });
  }

  if (atStation) {
    const t = stationZ(k);
    const ly = stationY(k);
    placements.push(...landingPlatform(lane, t));

    // Flush wall fittings: plate, lamp and the occasional direction sign.
    placements.push({ x: lane + WALL_OFFSET, y: ly + 2, z: t + 1, block: plateBlock(k), role: "wall" });
    placements.push({ x: lane + WALL_OFFSET, y: ly + 2, z: t, block: lampBlock(k), role: "wall" });
    if (k % 3 === 0) {
      placements.push({ x: lane + WALL_OFFSET, y: ly + 2, z: t - 1, block: signBlock(k), role: "wall" });
    }
    const door = serviceDoorBlock(k);
    if (door) {
      placements.push({ x: lane + WALL_OFFSET, y: ly + 1, z: t + 1, block: door, role: "wall" });
      placements.push({
        x: lane + WALL_OFFSET,
        y: ly + 2,
        z: t + 1,
        block: door === STAIR_DECOR.chainedDoor ? STAIR_DECOR.chainedDoorTop : STAIR_DECOR.emergencyDoorTop,
        role: "wall",
      });
    }
    placements.push({ x: lane + LANDING_INNER_OFFSET, y: ly + 1, z: t, block: STAIR_DECOR.stepLight, role: "landing" });
  }

  // Surface wear stays on the wall face, never in the walking volume.
  if (z % 9 === 0) {
    placements.push({ x: lane + WALL_OFFSET, y: y + 1, z, block: STAIR_DECOR.dampWall, role: "wall" });
  }
  if (z % 13 === 0) {
    placements.push({ x: lane + WALL_OFFSET, y: y + 2, z, block: STAIR_DECOR.rebar, role: "wall" });
  }
  if (z % 6 === 0 && !atStation) {
    placements.push({ x: lane + WALL_OFFSET, y: y + 1, z: z - 1, block: STAIR_DECOR.bracket, role: "wall" });
  }
  // Nothing may be written above the world ceiling, even on the last legal row.
  return placements.filter((entry) => entry.y <= WORLD_MAX_Y && entry.y >= -64);
}

/**
 * The shaft is intentionally empty east of the guard line. Retained for
 * callers and tests: no floating grating or cables are staged in the void.
 */
export function remotePlacements(_lane, _z) {
  return [];
}

/** Authoritative scenery structure choice for an authored row. */
export function sceneryFor(z) {
  if (!isLegalRow(z)) return null;
  if (isBridgeRow(z)) return "bridge";
  if (z === 0 || z % 12 !== 0) return null;
  const intervalIndex = Math.floor(z / 12);
  if (intervalIndex % 5 === 0) return "buttress";
  if (intervalIndex % 4 === 0) return "landing";
  return "support";
}
