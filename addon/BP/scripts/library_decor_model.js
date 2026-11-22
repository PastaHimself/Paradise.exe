/**
 * Pure library dressing rules: surfaces, shelf sampling, lights, reservation.
 */

export const LIBRARY_SURFACE = Object.freeze({
  parquet: "paradise:lib_worn_parquet",
  runner: "paradise:lib_carpet_runner",
  paneling: "paradise:lib_dark_wood_paneling",
  baseboard: "paradise:lib_water_damaged_baseboard",
  plaster: "paradise:lib_cracked_plaster",
});

export const LIBRARY_LIGHT = Object.freeze({
  lit: Object.freeze(["paradise:lib_aisle_light_x0_y0_z0", "paradise:lib_aisle_light_x1_y0_z0"]),
  unlit: Object.freeze(["paradise:lib_aisle_light_unlit_x0_y0_z0", "paradise:lib_aisle_light_unlit_x1_y0_z0"]),
  deskLit: "paradise:lib_desk_lamp",
  deskUnlit: "paradise:lib_desk_lamp_unlit",
});

export const LIBRARY_SHELF = Object.freeze({
  full: Object.freeze(["paradise:lib_full_bookshelf_x0_y0_z0", "paradise:lib_full_bookshelf_x0_y1_z0"]),
  sparse: Object.freeze(["paradise:lib_sparse_shelf_x0_y0_z0", "paradise:lib_sparse_shelf_x0_y1_z0"]),
  empty: Object.freeze(["paradise:lib_empty_shelf_x0_y0_z0", "paradise:lib_empty_shelf_x0_y1_z0"]),
  endcap: Object.freeze(["paradise:lib_shelf_endcap_x0_y0_z0", "paradise:lib_shelf_endcap_x0_y1_z0"]),
});

/** Restricted reservation, local to a chunk origin: keep it empty. */
export const RESTRICTED_RESERVE = Object.freeze({
  min: [10, 65, 12],
  max: [13, 68, 14],
  plinthY: 64,
});

export function hash32(value) {
  let n = value | 0;
  n ^= n >>> 16;
  n = Math.imul(n, 0x7feb352d);
  n ^= n >>> 15;
  n = Math.imul(n, 0x846ca68b);
  n ^= n >>> 16;
  return n >>> 0;
}

export function hashCoords(x, z, salt = 0) {
  return hash32(Math.imul(x | 0, 0x8da6b343) ^ Math.imul(z | 0, 0xd8163841) ^ Math.imul(salt | 0, 0x9e3779b1));
}

/** The protected traversal cross, in chunk-local coordinates. */
export function isCross(localX, localZ) {
  return (localX >= 7 && localX <= 8) || (localZ >= 7 && localZ <= 8);
}

export function isReserved(localX, localY, localZ) {
  const { min, max } = RESTRICTED_RESERVE;
  return (
    localX >= min[0] && localX <= max[0] &&
    localY >= min[1] && localY <= max[1] &&
    localZ >= min[2] && localZ <= max[2]
  );
}

/** One shelf tier per local z, sampled full/sparse/empty by z mod 6. */
export function shelfStateFor(localZ) {
  const bucket = ((localZ % 6) + 6) % 6;
  if (bucket === 0 || bucket === 1 || bucket === 4) return "full";
  if (bucket === 2 || bucket === 3) return "sparse";
  return "empty";
}

export function isShelfEndcap(localZ) {
  return localZ === 0 || localZ === 15;
}

/** Shelf rows: x3 and x11, plus the variant-2 parallel rows at x2 and x6. */
export function shelfRowsFor(variant) {
  const rows = [3, 11];
  if (variant === 2) rows.push(2, 6);
  return rows;
}

/** Cracked plaster on one in eight non-door wall panels. */
export function isPlasterPanel(localX, localY, localZ) {
  if (isCross(localX, localZ)) return false;
  if (localY < 68 || localY > 70) return false;
  return hashCoords(localX, localZ, 97) % 8 === 0;
}

/** Aisle light anchors: split pairs above x4..5 and x10..11 at z4 and z11. */
export const AISLE_LIGHT_ANCHORS = Object.freeze([
  { x: 4, z: 4 }, { x: 10, z: 4 }, { x: 4, z: 11 }, { x: 11, z: 11 }, { x: 10, z: 13 },
]);

/** Alternate lights go unlit in the low-power (restricted) room. */
export function aisleLightStateFor(index, lowPower) {
  if (!lowPower) return "lit";
  return index % 2 === 0 ? "lit" : "unlit";
}

