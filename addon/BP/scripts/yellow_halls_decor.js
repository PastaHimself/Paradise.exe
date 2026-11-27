/**
 * Yellow Halls static dressing writer.
 *
 * Placement rules live in `yellow_halls_decor_model.js`; this module only turns
 * those decisions into block writes so the whole pass stays reviewable.
 */

import { BlockPermutation } from "@minecraft/server";
import * as model from "./yellow_halls_decor_model.js";

export const WALLPAPER = Object.freeze({
  clean: "paradise:yh_wallpaper_clean",
  stained: "paradise:yh_wallpaper_stained",
  peeling: "paradise:yh_wallpaper_peeling",
  water_damaged: "paradise:yh_wallpaper_water_damaged",
});

export const CARPET = Object.freeze({
  base: "paradise:yh_beige_carpet_base",
  worn_path: "paradise:yh_beige_carpet_worn_path",
  dark_stain: "paradise:yh_beige_carpet_dark_stain",
});

export const CARPET_CORNERS = Object.freeze({
  base: "paradise:yh_raised_carpet_corner",
  worn: "paradise:yh_raised_carpet_corner_worn",
  dark: "paradise:yh_raised_carpet_corner_dark",
});

export const CEILING = Object.freeze({
  intact: "paradise:yh_acoustic_ceiling_intact",
  cracked: "paradise:yh_acoustic_ceiling_cracked",
});

/** Two-segment fixture halves; the second half extends along the leg axis. */
export const FIXTURE = Object.freeze({
  lit: ["paradise:yh_fluorescent_fixture_x0_y0_z0", "paradise:yh_fluorescent_fixture_x0_y0_z1"],
  dim: ["paradise:yh_fluorescent_fixture_dim_x0_y0_z0", "paradise:yh_fluorescent_fixture_dim_x0_y0_z1"],
  burned_out: ["paradise:yh_fluorescent_burned_out_x0_y0_z0", "paradise:yh_fluorescent_burned_out_x0_y0_z1"],
  missing_tube: ["paradise:yh_fluorescent_missing_tube_x0_y0_z0", "paradise:yh_fluorescent_missing_tube_x0_y0_z1"],
});

/** Segment offsets per cardinal facing, taken from the scaffold placement report. */
export const FIXTURE_OFFSETS = Object.freeze({
  north: [[0, 0], [0, 1]],
  south: [[0, 1], [0, 0]],
  east: [[1, 0], [0, 0]],
  west: [[0, 0], [1, 0]],
});

const PAIR = {
  closed_office_door: [
    { id: "paradise:yh_closed_office_door_x0_y0_z0", offset: [0, 0, 0] },
    { id: "paradise:yh_closed_office_door_x0_y1_z0", offset: [0, 1, 0] },
  ],
  bricked_up_door: [
    { id: "paradise:yh_bricked_up_door_x0_y0_z0", offset: [0, 0, 0] },
    { id: "paradise:yh_bricked_up_door_x0_y1_z0", offset: [0, 1, 0] },
  ],
  maintenance_hatch: [{ id: "paradise:yh_maintenance_hatch", offset: [0, 0, 0] }],
  archive_sign: [
    { id: "paradise:yh_archive_sign_x0_y0_z0", offset: [0, 0, 0] },
    { id: "paradise:yh_archive_sign_x1_y0_z0", offset: [1, 0, 0] },
  ],
  archive_directional_arrow: [
    { id: "paradise:yh_archive_directional_arrow_x0_y0_z0", offset: [0, 0, 0] },
    { id: "paradise:yh_archive_directional_arrow_x1_y0_z0", offset: [1, 0, 0] },
  ],
  stairwell_sign: [
    { id: "paradise:yh_stairwell_sign_normal_x0_y0_z0", offset: [0, 0, 0] },
    { id: "paradise:yh_stairwell_sign_normal_x1_y0_z0", offset: [1, 0, 0] },
  ],
  maintenance_sign: [
    { id: "paradise:yh_maint_sign_normal_x0_y0_z0", offset: [0, 0, 0] },
    { id: "paradise:yh_maint_sign_normal_x1_y0_z0", offset: [1, 0, 0] },
  ],
  exit_sign: [
    { id: "paradise:yh_exit_sign_normal_x0_y0_z0", offset: [0, 0, 0] },
    { id: "paradise:yh_exit_sign_normal_x1_y0_z0", offset: [1, 0, 0] },
  ],
  corridor_poster_normal: [
    { id: "paradise:yh_poster_normal_x0_y0_z0", offset: [0, 0, 0] },
    { id: "paradise:yh_poster_normal_x0_y1_z0", offset: [0, 1, 0] },
  ],
  door_frame: [
    { id: "paradise:sh_door_frame_trim_iron_x0_y0_z0", offset: [0, 0, 0] },
    { id: "paradise:sh_door_frame_trim_iron_x0_y1_z0", offset: [0, 1, 0] },
  ],
  abandoned_desk: [
    { id: "paradise:yh_abandoned_desk_x0_y0_z0", offset: [0, 0, 0] },
    { id: "paradise:yh_abandoned_desk_x1_y0_z0", offset: [1, 0, 0] },
  ],
  filing_cabinet: [
    { id: "paradise:yh_filing_cabinet_x0_y0_z0", offset: [0, 0, 0] },
    { id: "paradise:yh_filing_cabinet_x0_y1_z0", offset: [0, 1, 0] },
  ],
  water_cooler: [
    { id: "paradise:yh_water_cooler_x0_y0_z0", offset: [0, 0, 0] },
    { id: "paradise:yh_water_cooler_x0_y1_z0", offset: [0, 1, 0] },
  ],
  fuse_cabinet: [
    { id: "paradise:yh_fuse_cabinet_x0_y0_z0", offset: [0, 0, 0] },
    { id: "paradise:yh_fuse_cabinet_x0_y1_z0", offset: [0, 1, 0] },
  ],
  folding_chair: [{ id: "paradise:yh_folding_chair", offset: [0, 0, 0] }],
  overturned_wastebasket: [{ id: "paradise:yh_overturned_wastebasket_x0_y0_z0", offset: [0, 0, 0] }],
  stacked_cardboard_boxes: [{ id: "paradise:yh_stacked_cardboard_boxes", offset: [0, 0, 0] }],
  small_debris: [{ id: "paradise:sh_small_debris", offset: [0, 0, 0] }],
  small_debris_charred: [{ id: "paradise:sh_small_debris_charred", offset: [0, 0, 0] }],
  conduit_straight: [{ id: "paradise:sh_conduit_straight_iron", offset: [0, 0, 0] }],
  conduit_elbow: [{ id: "paradise:sh_conduit_elbow_iron", offset: [0, 0, 0] }],
  wall_junction: [{ id: "paradise:sh_wall_junction_iron", offset: [0, 0, 0] }],
  conduit_end_cap: [{ id: "paradise:sh_conduit_end_cap_iron_x0_y0_z0", offset: [0, 0, 0] }],
  return_air_vent: [{ id: "paradise:yh_return_air_vent", offset: [0, 0, 0] }],
};

export const PROP_IDS = Object.freeze(PAIR);

function placeBlock(dimension, typeId, x, y, z, facing) {
  try {
    const block = dimension.getBlock({ x, y, z });
    if (!block) return false;
    const permutation = BlockPermutation.resolve(
      typeId,
      facing ? { "minecraft:cardinal_direction": facing } : {},
    );
    block.setPermutation(permutation);
    return true;
  } catch (error) {
    return false;
  }
}

function getSegmentWorldPositions(entry, base, facing) {
  if (!entry?.length) return [];
  const rotated = entry.map(({ id, offset: [x, y, z] }) => {
    switch (facing) {
      case "east": return { id, x: -z, y, z: x };
      case "south": return { id, x: -x, y, z: -z };
      case "west": return { id, x: z, y, z: -x };
      default: return { id, x, y, z };
    }
  });
  const minX = Math.min(...rotated.map((segment) => segment.x));
  const minZ = Math.min(...rotated.map((segment) => segment.z));
  return rotated.map((segment) => ({
    id: segment.id,
    x: base.x + segment.x - minX,
    y: base.y + segment.y,
    z: base.z + segment.z - minZ,
  }));
}

/** Place every staged segment of a registry entry at a base position. */
export function placeSegments(dimension, entry, base, facing) {
  const segments = getSegmentWorldPositions(entry, base, facing);
  if (segments.length === 0) return 0;
  let placed = 0;
  for (const segment of segments) {
    if (placeBlock(dimension, segment.id, segment.x, segment.y, segment.z, facing)) {
      placed += 1;
    }
  }
  return placed;
}

/**
 * Wall cells of a patch, derived from the maze graph exactly the way
 * `renderCellWall` fills them, so wallpapers never close a portal.
 */
export function collectWallCells(maze, minX, minZ) {
  const size = maze.length;
  const cells = new Map();
  const add = (x, z) => {
    const key = `${x},${z}`;
    if (!cells.has(key)) cells.set(key, { x, z });
  };
  for (let cx = 0; cx < size; cx++) {
    for (let cz = 0; cz < size; cz++) {
      const cell = maze[cx][cz];
      const cellMinX = minX + cx * 8;
      const cellMinZ = minZ + cz * 8;
      const cellMaxX = cellMinX + 7;
      const cellMaxZ = cellMinZ + 7;
      for (let offset = 0; offset < 8; offset++) {
        const portal = offset === 3 || offset === 4;
        if (!cell.north || !portal) add(cellMinX + offset, cellMinZ);
        if (!cell.south || !portal) add(cellMinX + offset, cellMaxZ);
        if (!cell.west || !portal) add(cellMinX, cellMinZ + offset);
        if (!cell.east || !portal) add(cellMaxX, cellMinZ + offset);
      }
    }
  }
  return [...cells.values()];
}

export function isCornerWallCell(x, z, minX, minZ) {
  const localX = (x - minX) % 8;
  const localZ = (z - minZ) % 8;
  return (localX <= 1 || localX >= 6) && (localZ <= 1 || localZ >= 6);
}

/** Place the two opaque baffles that shape each orthogonal corridor turn. */
export function applyYellowHallsTurnBaffles(dimension, patchX, patchZ, maze, minX, minZ, options = {}) {
  const blockId = options.blockId ?? "minecraft:yellow_concrete";
  let placed = 0;
  for (let cellX = 0; cellX < maze.length; cellX++) {
    for (let cellZ = 0; cellZ < maze[cellX].length; cellZ++) {
      if (options.excludedCells?.has(`${cellX},${cellZ}`)) continue;
      if (!model.isTurnBaffleEligible(patchX, patchZ, cellX, cellZ, maze[cellX][cellZ])) continue;
      const regions = model.planTurnBaffleRegions(
        maze[cellX][cellZ],
        minX + cellX * 8,
        minZ + cellZ * 8,
      );
      for (const region of regions) {
        for (let x = region.minX; x <= region.maxX; x++) {
          for (let z = region.minZ; z <= region.maxZ; z++) {
            for (let y = 65; y <= 67; y++) {
              if (placeBlock(dimension, blockId, x, y, z, null)) placed += 1;
            }
          }
        }
      }
    }
  }
  return { placed };
}

/** Wallpaper, carpet and acoustic ceiling surface rules for one patch. */
export function applyYellowHallsSurfaces(dimension, patchX, patchZ, maze, minX, minZ, options = {}) {
  const groundY = options.groundY ?? 64;
  const ceilingY = options.ceilingY ?? 68;
  const authoredPatch = patchX === model.BREAKER_MOUNT.patchX && patchZ === model.BREAKER_MOUNT.patchZ;
  const vents = options.vents ?? (authoredPatch ? model.CONDUIT_RUN.filter((row) => row.id === "return_air_vent") : []);
  const size = maze.length;
  const writes = { walls: 0, floor: 0, ceiling: 0 };

  const nearVent = (x, z) =>
    vents.some((vent) => model.manhattan(x, z, minX + vent.x, minZ + vent.z) <= 1);

  for (let cx = 0; cx < size; cx++) {
    for (let cz = 0; cz < size; cz++) {
      const cellMinX = minX + cx * 8;
      const cellMinZ = minZ + cz * 8;
      for (let dx = 0; dx < 8; dx++) {
        for (let dz = 0; dz < 8; dz++) {
          const x = cellMinX + dx;
          const z = cellMinZ + dz;
          const onRoute = model.isRouteBlockPosition(maze, x, z, minX, minZ);
          const floorState = model.selectFloorState(x, z, { onRoute });
          if (placeBlock(dimension, CARPET[floorState], x, groundY, z, null)) writes.floor += 1;
          const ceilingState = model.selectCeilingState(x, z);
          if (placeBlock(dimension, CEILING[ceilingState], x, ceilingY, z, null)) writes.ceiling += 1;
        }
      }
    }
  }

  for (const corner of model.planRaisedCarpetCorners(maze, minX, minZ)) {
    const insideArrivalBuffer =
      patchX === 0 &&
      patchZ === 0 &&
      corner.x >= -3 &&
      corner.x <= 3 &&
      corner.z >= -3 &&
      corner.z <= 3;
    if (insideArrivalBuffer) continue;
    if (placeBlock(dimension, CARPET_CORNERS[corner.state], corner.x, groundY + 1, corner.z, corner.facing)) {
      writes.floor += 1;
    }
  }

  for (const cell of collectWallCells(maze, minX, minZ)) {
    const corner = isCornerWallCell(cell.x, cell.z, minX, minZ);
    const vent = nearVent(cell.x, cell.z);
    for (let y = groundY + 1; y <= groundY + 3; y++) {
      const state = model.selectWallpaperState(cell.x, y, cell.z, { isCorner: corner, nearVent: vent });
      if (placeBlock(dimension, WALLPAPER[state], cell.x, y, cell.z, null)) writes.walls += 1;
    }
  }
  return writes;
}

/** Recessed fixture chain along every straight corridor leg of one patch. */
export function applyYellowHallsFixtures(dimension, patchX, patchZ, maze, minX, minZ, options = {}) {
  const ceilingY = options.ceilingY ?? 68;
  const size = maze.length;
  const plan = [];
  let legOrdinal = 0;
  const isStraight = (cell, axis) =>
    axis === "z"
      ? (cell.north || cell.south) && !cell.east && !cell.west
      : (cell.east || cell.west) && !cell.north && !cell.south;
  const hasStraightPredecessor = (cellX, cellZ, axis) => {
    const previousX = axis === "x" ? cellX - 1 : cellX;
    const previousZ = axis === "z" ? cellZ - 1 : cellZ;
    if (previousX < 0 || previousZ < 0) return false;
    const previous = maze[previousX]?.[previousZ];
    if (!previous || !isStraight(previous, axis)) return false;
    return axis === "x"
      ? previous.east && maze[cellX][cellZ].west
      : previous.south && maze[cellX][cellZ].north;
  };

  for (const axis of ["z", "x"]) {
    for (let cellX = 0; cellX < size; cellX++) {
      for (let cellZ = 0; cellZ < size; cellZ++) {
        const cell = maze[cellX][cellZ];
        if (!isStraight(cell, axis) || hasStraightPredecessor(cellX, cellZ, axis)) continue;

        const run = [];
        let currentX = cellX;
        let currentZ = cellZ;
        while (currentX < size && currentZ < size) {
          const current = maze[currentX]?.[currentZ];
          if (!current || !isStraight(current, axis)) break;
          run.push({ x: currentX, z: currentZ });
          const hasForwardLink = axis === "x" ? current.east : current.south;
          if (!hasForwardLink) break;
          if (axis === "x") currentX += 1;
          else currentZ += 1;
          const next = maze[currentX]?.[currentZ];
          if (!next || !isStraight(next, axis)) break;
          if (axis === "x" ? !next.west : !next.north) break;
        }

        if (run.length === 0) continue;
        const start = run[0];
        const fixtures = model.planLegFixtures(run.length * 8, legOrdinal, { axis });
        legOrdinal += 1;
        for (const fixture of fixtures) {
          const base = fixture.offset - 1;
          const x = axis === "x" ? minX + start.x * 8 + base : minX + start.x * 8 + 3;
          const z = axis === "z" ? minZ + start.z * 8 + base : minZ + start.z * 8 + 3;
          plan.push({ x, z, state: fixture.state, facing: axis === "z" ? "north" : "east" });
        }
      }
    }
  }

  for (let cellX = 0; cellX < size; cellX++) {
    for (let cellZ = 0; cellZ < size; cellZ++) {
      if (!model.isOrthogonalTurn(maze[cellX][cellZ])) continue;
      plan.push({
        x: minX + cellX * 8 + 3,
        z: minZ + cellZ * 8 + 3,
        state: "dim",
        facing: "north",
      });
    }
  }
  let placed = 0;
  for (const fixture of plan) {
    const ids = FIXTURE[fixture.state];
    const offsets = FIXTURE_OFFSETS[fixture.facing];
    for (let index = 0; index < ids.length; index++) {
      const pair = offsets[index] ?? [0, 0];
      const dx = pair[0];
      const dz = pair[1];
      if (placeBlock(dimension, ids[index], fixture.x + dx, ceilingY, fixture.z + dz, fixture.facing)) {
        placed += 1;
      }
    }
  }
  return { placed, plan };
}

/**
 * Authored scenery for the arrival-adjacent patch: eight bays, the service
 * conduit run, the reserved breaker mount and the wall-lane clutter.
 */
export function applyYellowHallsScenery(dimension, patchX, patchZ, maze, minX, minZ, options = {}) {
  if (patchX !== model.BREAKER_MOUNT.patchX || patchZ !== model.BREAKER_MOUNT.patchZ) {
    return { applied: false, placed: 0 };
  }
  let placed = 0;
  const place = (entry, x, y, z, facing) => {
    placed += placeSegments(dimension, entry, { x, y, z }, facing);
  };

  // Bay anchors carry absolute Y (65 = one above the Y64 floor), so the door,
  // frame and sign all sit flush on the wall instead of sinking into the floor.
  for (const bay of model.BAYS) {
    const isPortal = model.bayFaceIsPortal(maze, bay);
    const anchor = model.bayDoorAnchor(bay, isPortal);
    if (bay.prop) place(PAIR[bay.prop], minX + anchor.x, anchor.y, minZ + anchor.z, bay.facing);
    if (bay.bay === 1) {
      place(PAIR.door_frame, minX + 2, bay.y, minZ + bay.z, bay.facing);
      place(PAIR.door_frame, minX + 5, bay.y, minZ + bay.z, bay.facing);
    }
    if (bay.sign) {
      const entry = PAIR[`${bay.sign}_sign`];
      if (entry) place(entry, minX + bay.signX, bay.y + 2, minZ + bay.signZ, bay.facing);
    }
    if (bay.archive) {
      place(PAIR.door_frame, minX + 18, bay.y, minZ + bay.z, bay.facing);
      place(PAIR.door_frame, minX + 21, bay.y, minZ + bay.z, bay.facing);
      place(PAIR.archive_directional_arrow, minX + 17, bay.y + 2, minZ + 17, bay.facing);
    }
  }

  for (const row of model.CONDUIT_RUN) {
    const entry = PAIR[row.id];
    if (entry) place(entry, minX + row.x, row.y, minZ + row.z, "north");
  }

  for (const prop of model.FLOOR_PROPS) {
    const entry = PAIR[prop.id];
    let safeSegments;
    for (const position of [{ x: prop.x, z: prop.z }, ...(prop.alternates ?? [])]) {
      const base = { x: minX + position.x, y: prop.y, z: minZ + position.z };
      const segments = getSegmentWorldPositions(entry, base, prop.facing);
      if (segments.every((segment) => !model.isRouteBlockPosition(maze, segment.x, segment.z, minX, minZ))) {
        safeSegments = segments;
        break;
      }
    }
    for (const segment of safeSegments ?? []) {
      if (placeBlock(dimension, segment.id, segment.x, segment.y, segment.z, prop.facing)) placed += 1;
    }
  }
  for (const prop of model.WALL_PROPS) {
    place(PAIR[prop.id], minX + prop.x, prop.y, minZ + prop.z, prop.facing);
  }

  const mount = model.BREAKER_MOUNT;
  for (let x = mount.backMin[0]; x <= mount.backMax[0]; x++) {
    for (let y = mount.backMin[1]; y <= mount.backMax[1]; y++) {
      if (placeBlock(dimension, WALLPAPER.water_damaged, minX + x, y, minZ + mount.backMin[2], null)) placed += 1;
    }
  }
  for (let x = mount.frontMin[0]; x <= mount.frontMax[0]; x++) {
    for (let y = mount.frontMin[1]; y <= mount.frontMax[1]; y++) {
      for (let z = mount.frontMin[2]; z <= mount.frontMax[2]; z++) {
        if (placeBlock(dimension, "minecraft:air", minX + x, y, minZ + z, null)) placed += 1;
      }
    }
  }
  return { applied: true, placed };
}

/** Run every Yellow Halls static pass for a freshly painted patch. */
export function applyYellowHallsDressing(dimension, patchX, patchZ, maze, minX, minZ, options = {}) {
  const baffles = applyYellowHallsTurnBaffles(dimension, patchX, patchZ, maze, minX, minZ, options);
  const surfaces = applyYellowHallsSurfaces(dimension, patchX, patchZ, maze, minX, minZ, options);
  const fixtures = applyYellowHallsFixtures(dimension, patchX, patchZ, maze, minX, minZ, options);
  const scenery = applyYellowHallsScenery(dimension, patchX, patchZ, maze, minX, minZ, options);
  return { baffles, surfaces, fixtures, scenery };
}
