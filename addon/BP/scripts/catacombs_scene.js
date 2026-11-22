// Static Catacombs dress helpers (Ticket 5). Pure decisions so the surface,
// lamp, burial and sealed-junction rules can be tested without a runtime.

export const DRESS = Object.freeze({
  wallClean: "paradise:cat_stone_masonry_clean",
  wallCracked: "paradise:cat_stone_masonry_cracked",
  wallDamp: "paradise:cat_stone_masonry_damp",
  floorBase: "paradise:cat_uneven_floor_tiles",
  floorDamp: "paradise:cat_uneven_floor_tiles_damp",
  puddle: "paradise:cat_floor_puddles_standing_water",
  lampLit: "paradise:cat_iron_lamp_cage_x0_y0_z0",
  lampSconce: "paradise:cat_wall_sconce_x0_y0_z0",
  lampOut: "paradise:cat_iron_lamp_cage_out_x0_y0_z0",
  lampRusted: "paradise:cat_iron_lamp_cage_rusted_x0_y0_z0",
  candleLit: "paradise:cat_candle_cluster_x0_y0_z0",
  candleOut: "paradise:cat_candle_cluster_out_x0_y0_z0",
  boneShelf: "paradise:cat_bone_shelf_x0_y0_z0",
  coffinBoard: "paradise:cat_broken_coffin_board_x0_y0_z0",
  sarcophagus: "paradise:cat_closed_sarcophagus_x0_y0_z0",
  urn: "paradise:cat_urn",
  rubble: "paradise:cat_rubble_pile_x0_y0_z0",
  niche: "paradise:cat_empty_niche",
  skullNiche: "paradise:cat_skull_niche_x0_y0_z0",
  sealedDoorway: "paradise:cat_sealed_stone_doorway_x0_y0_z0",
  cluePanel: "paradise:cat_cracked_clue_panel_x0_y0_z0",
  warning: "paradise:cat_seal_warn_incised_seal",
  arch: "paradise:cat_straight_arch_x0_y0_z0",
  lowArch: "paradise:cat_low_archway_x0_y0_z0",
  cornerPier: "paradise:cat_corner_pier_x0_y0_z0",
  pillar: "paradise:cat_pillar_x0_y0_z0",
  passageFrame: "paradise:cat_open_passage_frame_x0_y0_z0",
  plate: "paradise:cat_tomb_number_plate",
});

/**
 * Segment layout for every staged two-cell/four-cell piece. Offsets are
 * relative to the anchor cell; the runtime writer expands each piece so no
 * half-model is ever placed.
 */
export const PIECE_SEGMENTS = Object.freeze({
  [DRESS.lampLit]: [[0, 0, 0, DRESS.lampLit], [0, 1, 0, "paradise:cat_iron_lamp_cage_x0_y1_z0"]],
  [DRESS.lampOut]: [[0, 0, 0, DRESS.lampOut], [0, 1, 0, "paradise:cat_iron_lamp_cage_out_x0_y1_z0"]],
  [DRESS.lampRusted]: [[0, 0, 0, DRESS.lampRusted], [0, 1, 0, "paradise:cat_iron_lamp_cage_rusted_x0_y1_z0"]],
  [DRESS.lampSconce]: [[0, 0, 0, DRESS.lampSconce], [0, 1, 0, "paradise:cat_wall_sconce_x0_y1_z0"]],
  [DRESS.candleLit]: [[0, 0, 0, DRESS.candleLit], [1, 0, 0, "paradise:cat_candle_cluster_x1_y0_z0"]],
  [DRESS.candleOut]: [[0, 0, 0, DRESS.candleOut], [1, 0, 0, "paradise:cat_candle_cluster_out_x1_y0_z0"]],
  [DRESS.boneShelf]: [
    [0, 0, 0, DRESS.boneShelf],
    [0, 1, 0, "paradise:cat_bone_shelf_x0_y1_z0"],
    [1, 0, 0, "paradise:cat_bone_shelf_x1_y0_z0"],
    [1, 1, 0, "paradise:cat_bone_shelf_x1_y1_z0"],
  ],
  [DRESS.coffinBoard]: [[0, 0, 0, DRESS.coffinBoard], [1, 0, 0, "paradise:cat_broken_coffin_board_x1_y0_z0"]],
  [DRESS.sarcophagus]: [[0, 0, 0, DRESS.sarcophagus], [1, 0, 0, "paradise:cat_closed_sarcophagus_x1_y0_z0"]],
  [DRESS.rubble]: [
    [0, 0, 0, DRESS.rubble],
    [0, 0, 1, "paradise:cat_rubble_pile_x0_y0_z1"],
    [1, 0, 0, "paradise:cat_rubble_pile_x1_y0_z0"],
  ],
  [DRESS.skullNiche]: [[0, 0, 0, DRESS.skullNiche], [1, 0, 0, "paradise:cat_skull_niche_x1_y0_z0"]],
  [DRESS.sealedDoorway]: [
    [0, 0, 0, DRESS.sealedDoorway],
    [0, 1, 0, "paradise:cat_sealed_stone_doorway_x0_y1_z0"],
    [1, 0, 0, "paradise:cat_sealed_stone_doorway_x1_y0_z0"],
    [1, 1, 0, "paradise:cat_sealed_stone_doorway_x1_y1_z0"],
  ],
  [DRESS.cluePanel]: [
    [0, 0, 0, DRESS.cluePanel],
    [0, 1, 0, "paradise:cat_cracked_clue_panel_x0_y1_z0"],
    [1, 0, 0, "paradise:cat_cracked_clue_panel_x1_y0_z0"],
    [1, 1, 0, "paradise:cat_cracked_clue_panel_x1_y1_z0"],
  ],
  [DRESS.arch]: [
    [0, 0, 0, DRESS.arch],
    [0, 1, 0, "paradise:cat_straight_arch_x0_y1_z0"],
    [1, 0, 0, "paradise:cat_straight_arch_x1_y0_z0"],
    [1, 1, 0, "paradise:cat_straight_arch_x1_y1_z0"],
  ],
  [DRESS.lowArch]: [[0, 0, 0, DRESS.lowArch], [1, 0, 0, "paradise:cat_low_archway_x1_y0_z0"]],
  [DRESS.cornerPier]: [[0, 0, 0, DRESS.cornerPier], [0, 1, 0, "paradise:cat_corner_pier_x0_y1_z0"]],
  [DRESS.pillar]: [[0, 0, 0, DRESS.pillar], [0, 1, 0, "paradise:cat_pillar_x0_y1_z0"]],
  [DRESS.passageFrame]: [
    [0, 0, 0, DRESS.passageFrame],
    [0, 1, 0, "paradise:cat_open_passage_frame_x0_y1_z0"],
    [1, 0, 0, "paradise:cat_open_passage_frame_x1_y0_z0"],
    [1, 1, 0, "paradise:cat_open_passage_frame_x1_y1_z0"],
  ],
});

/** Every cell a piece owns, including the anchor, as [dx, dy, dz, id]. */
export function segmentsFor(block) {
  return PIECE_SEGMENTS[block] ?? [[0, 0, 0, block]];
}

export const SIDE_ORDER = Object.freeze(["north", "east", "south", "west"]);

function mod(value, base) {
  return ((value % base) + base) % base;
}

/** Deterministic hash in 0..99 for a cell column. */
export function cellRoll(x, z, salt = 0) {
  let h = (x | 0) * 1836311903 + (z | 0) * 2971215073 + salt;
  h = (h ^ (h >>> 15)) * 2246822519;
  h = h ^ (h >>> 13);
  return Math.abs(h) % 100;
}

/** Wall surface: 76% clean, 14% cracked, 10% damp. */
export function wallBlock(x, z) {
  const roll = cellRoll(x, z, 0x5ca7);
  if (roll < 76) return DRESS.wallClean;
  if (roll < 90) return DRESS.wallCracked;
  return DRESS.wallDamp;
}

/** Floor: 84% base tiles, 12% uneven, 4% standing water. */
export function floorBlock(x, z) {
  const roll = cellRoll(x, z, 0xf100);
  if (roll < 84) return DRESS.floorBase;
  if (roll < 96) return DRESS.floorDamp;
  return DRESS.puddle;
}

/**
 * Light slots across four eligible cells: lit cluster (9), unlit cluster (0),
 * wall sconce (10), rusted iron cage (8).
 */
export function lampFor(k) {
  switch (mod(k, 4)) {
    case 0:
      return { block: DRESS.lampLit, light: 9 };
    case 1:
      return { block: DRESS.lampOut, light: 0 };
    case 2:
      return { block: DRESS.lampSconce, light: 10 };
    default:
      return { block: DRESS.lampRusted, light: 8 };
  }
}

export function candleFor(roll) {
  return roll < 70 ? DRESS.candleLit : DRESS.candleOut;
}

const BURIAL = Object.freeze([
  DRESS.boneShelf,
  DRESS.coffinBoard,
  DRESS.sarcophagus,
  DRESS.urn,
  DRESS.skullNiche,
  DRESS.niche,
]);

export function burialFor(roll) {
  return BURIAL[mod(Math.floor(roll / 7), BURIAL.length)];
}

/** Arch/cross pieces sit overhead at Y68 only. */
export function archFor(k) {
  return mod(k, 5) === 0 ? DRESS.arch : mod(k, 5) === 2 ? DRESS.lowArch : null;
}

/**
 * Pick the static shortcut junction: first corridor cell at path index >= 6,
 * excluding the last six path cells, with a closed side and an interior
 * neighbour. Preference E, S, W, N then lexicographic x/z.
 */
export function selectJunction(cells, pathLength, excludedKeys = new Set()) {
  const preference = ["east", "south", "west", "north"];
  const candidates = cells
    .filter((cell) => cell.role === "corridor" || cell.role === "deadEnd")
    .filter((cell) => !excludedKeys.has(`${cell.x}:${cell.z}`))
    .filter((cell) => cell.pathIndex >= 6 && cell.pathIndex <= pathLength - 7)
    .sort((a, b) => (a.pathIndex - b.pathIndex) || (a.x - b.x) || (a.z - b.z));

  for (const cell of candidates) {
    for (const side of preference) {
      if (cell.closedSides.includes(side) && cell.degree >= 2) {
        return { cell, side };
      }
    }
  }
  return null;
}

/** Wall-run offset in cell-local coordinates for the sealed doorway set. */
export function wallRunOffsets(side, t) {
  switch (side) {
    case "north":
      return { dx: 1 + t, dz: 0 };
    case "east":
      return { dx: 4, dz: 1 + t };
    case "south":
      return { dx: 1 + t, dz: 4 };
    default:
      return { dx: 0, dz: 1 + t };
  }
}

export function sideInset(side, amount) {
  switch (side) {
    case "north":
      return { dx: 0, dz: amount };
    case "east":
      return { dx: -amount, dz: 0 };
    case "south":
      return { dx: 0, dz: -amount };
    default:
      return { dx: amount, dz: 0 };
  }
}

/**
 * Static sealed-doorway set: optical plane W(1,0,65..67), clue W(0,0,66),
 * sconce W(2,0,67), warning W(0,0,67), approach W(1,1,65) and W(2,1,65) left
 * clear, future opening reserved at W(1..2,0,65..67) with a flat floor at
 * W(1..2,0,64).
 */
export function sealedDoorwayPlan(base, side) {
  const at = (t, d, y) => {
    const run = wallRunOffsets(side, t);
    const inset = sideInset(side, d);
    return { x: base.x + run.dx + inset.dx, y, z: base.z + run.dz + inset.dz };
  };
  return {
    plane: [at(1, 0, 65), at(1, 0, 66), at(1, 0, 67)],
    clue: at(0, 0, 66),
    sconce: at(2, 0, 67),
    warning: at(0, 0, 67),
    approach: [at(1, 1, 65), at(2, 1, 65)],
    futureOpening: [at(1, 0, 65), at(1, 0, 66), at(1, 0, 67), at(2, 0, 65), at(2, 0, 66), at(2, 0, 67)],
    flatFloor: [at(1, 0, 64), at(2, 0, 64)],
    adjacentReserve: [at(1, -1, 65), at(1, -1, 66), at(1, -1, 67), at(2, -1, 65), at(2, -1, 66), at(2, -1, 67)],
  };
}
