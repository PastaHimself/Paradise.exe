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
  guard: "paradise:es_straight_railing",
  guardSloped: "paradise:es_sloped_railing",
  guardPost: "paradise:es_railing_end_post",
  guardCorner: "paradise:es_corner_railing",
  landingTiles: "paradise:es_scuffed_landing_tiles",
  landingPlate: "paradise:es_landing_plate",
  landingPlatePeeling: "paradise:es_landing_plate_peeling",
  landingPlateBlank: "paradise:es_landing_plate_blank",
  landingPlateRepeated: "paradise:es_landing_plate_repeated",
  lampNormal: "paradise:es_caged_wall_lamp",
  lampRed: "paradise:es_caged_wall_lamp_red",
  lampDead: "paradise:es_caged_wall_lamp_dead",
  stepLight: "paradise:es_small_step_light",
  chainedDoor: "paradise:es_chained_service_door",
  emergencyDoor: "paradise:es_emergency_door",
  supportBeam: "paradise:es_support_beam",
  metalGrating: "paradise:es_metal_grating",
  crackedConcrete: "paradise:es_cracked_concrete",
  dampWall: "paradise:es_damp_wall_patches",
  rebar: "paradise:es_exposed_rebar",
  cable: "paradise:es_exposed_cable_bundle",
  shaftCable: "paradise:es_hanging_shaft_cable",
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
 */
export function scenePlacements(lane, z) {
  if (!isLegalRow(z)) return [];
  const y = stairY(z);
  const k = stationIndex(z);
  const placements = [];

  placements.push({ x: lane + 1, y, z, block: STAIR_DECOR.guard });
  if (z % 4 === 0) {
    placements.push({ x: lane + 1, y: y + 1, z, block: STAIR_DECOR.guardPost });
  }
  if (isChippedRow(z)) {
    placements.push({ x: lane - 3, y, z, block: STAIR_DECOR.chippedTread });
  }

  if (z === stationZ(k)) {
    const t = stationZ(k);
    const ly = stationY(k);
    for (let x = lane - 5; x <= lane - 3; x++) {
      for (let dz = 0; dz <= 1; dz++) {
        placements.push({ x, y: ly, z: t + dz, block: STAIR_DECOR.landingTiles });
      }
    }
    placements.push({ x: lane - 5, y: ly + 2, z: t + 1, block: plateBlock(k) });
    placements.push({ x: lane - 3, y: ly + 2, z: t + 1, block: lampBlock(k) });
    placements.push({ x: lane + 1, y: ly, z: t - 1, block: STAIR_DECOR.stepLight });
    if (k % 3 === 0) {
      placements.push({ x: lane - 3, y: ly + 2, z: t - 2, block: signBlock(k) });
    }
    const door = serviceDoorBlock(k);
    if (door) placements.push({ x: lane - 4, y: ly + 1, z: t + 1, block: door });
    if (k % 4 === 1) {
      placements.push({ x: lane - 4, y: ly + 1, z: t, block: STAIR_DECOR.hatch });
    }
  }

  if (z % 6 === 0) {
    placements.push({ x: lane - 4, y: y + 1, z: z - 1, block: STAIR_DECOR.bracket });
  }
  if (z % 9 === 0) {
    placements.push({ x: lane - 3, y: y + 1, z, block: STAIR_DECOR.dampWall });
  }
  if (z % 17 === 0) {
    placements.push({ x: lane - 3, y, z, block: STAIR_DECOR.crackedConcrete });
  }
  if (z % 13 === 0) {
    placements.push({ x: lane - 3, y: y + 2, z, block: STAIR_DECOR.rebar });
  }

  return placements;
}

/** Remote-ledge decor stays east of the shaft and never touches the walk columns. */
export function remotePlacements(lane, z) {
  if (!isLegalRow(z)) return [];
  const y = stairY(z);
  const placements = [];
  placements.push({ x: lane + 8, y, z, block: STAIR_DECOR.metalGrating });
  if (z % 10 === 0) {
    placements.push({ x: lane + 8, y: y + 1, z, block: STAIR_DECOR.supportBeam });
  }
  if (z % 14 === 0) {
    placements.push({ x: lane + 8, y: y + 1, z: z + 1, block: STAIR_DECOR.shaftCable });
  }
  if (z % 21 === 0) {
    placements.push({ x: lane + 8, y, z: z + 1, block: STAIR_DECOR.pipeElbow });
  }
  return placements;
}

/** Scenery structure choice for an authored row; the bridge is row-locked. */
export function sceneryFor(z) {
  if (!isLegalRow(z)) return null;
  if (isBridgeRow(z)) return "bridge";
  if (z === 0 || z % 12 !== 0) return null;
  const intervalIndex = Math.floor(z / 12);
  if (intervalIndex % 5 === 0) return "buttress";
  if (intervalIndex % 4 === 0) return "landing";
  return "support";
}
