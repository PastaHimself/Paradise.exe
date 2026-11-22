export const DIMENSION_VISUAL_PROFILES = Object.freeze({
  "paradise:yellow_halls": Object.freeze({
    fog: "paradise:yellow_halls_fog",
    particle: "paradise:dust_mote",
    ambientY: 1.1,
    verticalSpread: 2.2,
    radiusScale: 0.85,
  }),
  "paradise:flat_flower": Object.freeze({
    fog: "paradise:flat_flower_fog",
    particle: "paradise:pollen_mote",
    ambientY: 1.0,
    verticalSpread: 3.2,
    radiusScale: 1.15,
  }),
  "paradise:endless_staircase": Object.freeze({
    fog: "paradise:endless_staircase_fog",
    particle: "paradise:dust_mote",
    ambientY: 1.8,
    verticalSpread: 4.0,
    radiusScale: 1.25,
  }),
  "paradise:burning_highway": Object.freeze({
    fog: "paradise:burning_highway_fog",
    particle: "paradise:ash_fleck",
    ambientY: 2.0,
    verticalSpread: 4.5,
    radiusScale: 1.2,
  }),
  "catacombs:catacomb_mazes": Object.freeze({
    fog: "paradise:catacombs_fog",
    particle: "paradise:dust_mote",
    ambientY: 1.0,
    verticalSpread: 1.8,
    radiusScale: 0.7,
  }),
  "heaven:the_heaven": Object.freeze({
    fog: "paradise:heaven_fog",
    particle: "paradise:celestial_mote",
    ambientY: 2.4,
    verticalSpread: 5.0,
    radiusScale: 1.35,
  }),
  "library:the_library": Object.freeze({
    fog: "paradise:library_fog",
    particle: "paradise:dust_mote",
    ambientY: 1.5,
    verticalSpread: 2.5,
    radiusScale: 0.8,
  }),
});

export const PARADISE_VISUAL_DIMENSION_IDS = Object.freeze(
  Object.keys(DIMENSION_VISUAL_PROFILES),
);
