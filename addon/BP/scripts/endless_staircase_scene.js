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
  return Number.isInteger(z) && z >= START_Z && stairY(z) <= WORLD_MAX_Y;
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
  if (k % 6 === 0) return STAIR_DECOR.emergencyDoor;
  if (k % 6 === 3) return STAIR_DECOR.chainedDoor;
  return null;
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

export const WALL_OFFSET = -3;
export const GUARD_OFFSET = 1;
export const LANDING_INNER_OFFSET = -3;
export const LANDING_OUTER_OFFSET = -5;
export const LANDING_GUARD_OFFSET = -6;

export function isLegalTreadRow(z) {
  return Number.isInteger(z) && z >= -28 && stairY(z) <= WORLD_MAX_Y;
}

/** All writes belong to their physical Z row, including station overhangs. */
export function wallPlacements(lane, z) {
  if (!isLegalRow(z)) return [];
  const y = stairY(z);
  const atLanding = z % STATION_STEPS <= 1;
  return Array.from({ length: atLanding ? 1 : 3 }, (_, dy) => ({
    x: lane + WALL_OFFSET, y: y + dy, z, block: STAIR_DECOR.crackedConcrete, role: "wall", facing: undefined, text: undefined,
  })).filter((entry) => entry.y <= WORLD_MAX_Y);
}

function stationPlacements(lane, k) {
  const t = stationZ(k);
  const y = stationY(k);
  const placements = [];
  /** @param {number} dx @param {number} dy @param {number} dz @param {string} block @param {string} role @param {string} [facing] @param {string} [text] */
  const add = (dx, dy, dz, block, role, facing = undefined, text = undefined) =>
    placements.push({ x: lane + dx, y: y + dy, z: t + dz, block, role, facing, text });
  for (let dx = -5; dx <= -3; dx++) {
    for (let dz = 0; dz <= 1; dz++) {
      add(dx, 0, dz, STAIR_DECOR.landingTiles, "landing");
      add(dx, -1, dz, STAIR_DECOR.crackedConcrete, "support");
    }
  }
  add(-2, 0, 0, STAIR_DECOR.landingTiles, "landing");
  for (let dz = 0; dz <= 1; dz++) {
    for (let dy = 0; dy <= 3; dy++) add(-6, dy, dz, STAIR_DECOR.crackedConcrete, "wall");
  }
  const door = serviceDoorBlock(k);
  const barricade = k % 6 === 2;
  const plateY = door || barricade ? 3 : 2;
  if (k < 4) {
    add(-5, plateY, 1, "minecraft:oak_wall_sign", "number", undefined, String(k + 1).padStart(2, "0"));
  } else {
    add(-5, plateY, 1, plateBlock(k), "plate", "east");
  }
  add(-3, 2, 1, lampBlock(k), "lamp");
  add(-3, 2, -2, signBlock(k), "sign", "east");
  add(-3, 3, 2, STAIR_DECOR.cable, "fitting", "east");
  add(-3, 1, 3, STAIR_DECOR.bracket, "fitting", "east");
  add(-3, 3, 3, STAIR_DECOR.pipeElbow, "fitting", "east");
  add(-3, 1, 4, STAIR_DECOR.rebar, "fitting", "east");
  if (k > 0) {
    // At t-1 this exact Y is occupied by the primary rail. Keep the
    // continuous guard and mount the light immediately below it instead.
    add(1, -1, -1, STAIR_DECOR.stepLight, "light", "west");
    add(1, -2, -1, STAIR_DECOR.crackedConcrete, "support");
  }
  if (door) {
    add(-5, 1, 1, door, "door", "east");
    add(-5, 2, 1, door === STAIR_DECOR.chainedDoor ? STAIR_DECOR.chainedDoorTop : STAIR_DECOR.emergencyDoorTop, "door", "east");
  } else if (barricade) {
    add(-5, 1, 1, "paradise:es_barricaded_landing_x0_y0_z0", "door", "east");
    add(-5, 2, 1, "paradise:es_barricaded_landing_x0_y1_z0", "door", "east");
  }
  if (k % 6 === 4) add(-4, 1, 1, STAIR_DECOR.hatch, "landing", "north");
  return placements;
}

function uniqueLegalRow(placements, z) {
  const cells = new Map();
  for (const entry of placements) {
    if (entry.z === z && entry.y >= -64 && entry.y <= WORLD_MAX_Y) {
      cells.set(`${entry.x}:${entry.y}:${entry.z}`, entry);
    }
  }
  return [...cells.values()];
}

export function scenePlacements(lane, z) {
  if (!isLegalRow(z)) return [];
  const y = stairY(z);
  const post = z % 4 === 0;
  /** @type {{x:number,y:number,z:number,block:string,role:string,facing?:string,text?:string}[]} */
  const placements = wallPlacements(lane, z);
  // The unsplit sloped model crosses the one-cell envelope. The registered
  // two-segment straight rail is the safe fallback until that asset is staged.
  placements.push(
    { x: lane + 1, y: y + 1, z, block: post ? STAIR_DECOR.guardPost : STAIR_DECOR.guard, role: "guard", facing: "east" },
    { x: lane + 1, y: y + 2, z, block: post ? STAIR_DECOR.guardPostTop : STAIR_DECOR.guardTop, role: "guard", facing: "east" },
  );
  for (let k = Math.max(0, stationIndex(z) - 1); k <= stationIndex(z) + 1; k++) {
    if (isLegalRow(stationZ(k))) placements.push(...stationPlacements(lane, k));
  }
  return uniqueLegalRow(placements, z);
}

export function remotePlacements(lane, z) {
  if (!isLegalRow(z)) return [];
  const k = stationIndex(z);
  const t = stationZ(k);
  const y = stationY(k);
  const dz = z - t;
  if (dz > 2) return [];
  const placements = [];
  /** @param {number} dx @param {number} dy @param {string} block @param {string} [facing] */
  const add = (dx, dy, block, facing = undefined) =>
    placements.push({ x: lane + dx, y: y + dy, z, block, role: "remote", facing });
  for (let dx = 8; dx <= 10; dx++) add(dx, -1, STAIR_DECOR.crackedConcrete);
  add(8, 0, STAIR_DECOR.metalGrating, "north");
  if (dz === 0) {
    add(9, 1, "paradise:es_broken_railing_gap_x0_y0_z0", "east");
    add(9, 2, "paradise:es_broken_railing_gap_x0_y1_z0", "east");
  }
  if (dz === 1) {
    add(8, 1, "paradise:es_bent_rail_x0_y0_z0", "east");
    add(8, 2, "paradise:es_bent_rail_x0_y1_z0", "east");
    add(10, 0, STAIR_DECOR.crackedConcrete);
    for (let dy = 1; dy <= 4; dy++) add(10, dy, STAIR_DECOR.crackedConcrete);
    add(9, 4, STAIR_DECOR.crackedConcrete);
    add(8, 4, STAIR_DECOR.supportBeam, "east");
    // Cable remains on its own supported cell, away from the bent rail.
    add(9, 2, STAIR_DECOR.shaftCable, "north");
    add(9, 3, STAIR_DECOR.shaftCableTop, "north");
  }
  if (dz === 2) add(9, 0, "paradise:es_broken_grating_x0_y0_z0", "north");
  return uniqueLegalRow(placements, z);
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
