import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TEST_DIR, "..");
const BP_SCRIPTS = path.join(ROOT, "addon", "Genshin X Craft BP", "scripts");
const RP_FOGS = path.join(ROOT, "addon", "Genshin X Craft RP", "fogs");
const RP_PARTICLES = path.join(ROOT, "addon", "Genshin X Craft RP", "particles");

const EXPECTED_DIMENSIONS = [
  "paradise:yellow_halls",
  "paradise:flat_flower",
  "paradise:endless_staircase",
  "paradise:burning_highway",
  "catacombs:catacomb_mazes",
  "heaven:the_heaven",
  "library:the_library",
];

const PROFILE_PATH = path.join(BP_SCRIPTS, "paradise_dimension_visual_profiles.js");

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

test("visual profile registry covers all seven dimensions", async () => {
  assert.equal(fs.existsSync(PROFILE_PATH), true, "visual profile registry must exist");
  const moduleUrl = pathToFileURL(PROFILE_PATH);
  const { PARADISE_VISUAL_DIMENSION_IDS } = await import(`${moduleUrl.href}?t=${Date.now()}`);
  assert.deepEqual([...PARADISE_VISUAL_DIMENSION_IDS].sort(), [...EXPECTED_DIMENSIONS].sort());
});

test("every profile fog id resolves to a resource-pack fog file", async () => {
  const moduleUrl = pathToFileURL(PROFILE_PATH);
  const { DIMENSION_VISUAL_PROFILES } = await import(`${moduleUrl.href}?t=${Date.now()}`);

  for (const [dimensionId, profile] of Object.entries(DIMENSION_VISUAL_PROFILES)) {
    const shortName = profile.fog.replace("paradise:", "paradise_");
    const fogPath = path.join(RP_FOGS, `${shortName}.json`);
    assert.equal(fs.existsSync(fogPath), true, `${dimensionId} fog file must exist`);
    const fog = readJson(fogPath);
    assert.equal(
      fog["minecraft:fog_settings"].description.identifier,
      profile.fog,
      `${dimensionId} fog identifier must match the profile`,
    );
  }
});

const FOG_EXPECTATIONS = Object.freeze({
  "paradise_yellow_halls_fog.json": { start: 6, end: 52, color: "#6E6238" },
  "paradise_flat_flower_fog.json": { start: 12, end: 84, color: "#62464D" },
  "paradise_endless_staircase_fog.json": { start: 8, end: 64, color: "#27313A" },
  "paradise_burning_highway_fog.json": { start: 5, end: 58, color: "#2A0F0B" },
  "paradise_catacombs_fog.json": { start: 4, end: 36, color: "#171A17" },
  "paradise_heaven_fog.json": { start: 24, end: 128, color: "#D4D6D1" },
  "paradise_library_fog.json": { start: 7, end: 56, color: "#2A211C" },
});

test("all dimension fogs use the approved horror grading", () => {
  for (const [fileName, expected] of Object.entries(FOG_EXPECTATIONS)) {
    const fog = readJson(path.join(RP_FOGS, fileName));
    const air = fog["minecraft:fog_settings"].distance.air;
    assert.equal(air.fog_start, expected.start, `${fileName} fog_start`);
    assert.equal(air.fog_end, expected.end, `${fileName} fog_end`);
    assert.equal(air.fog_color, expected.color, `${fileName} fog_color`);
    assert.equal(air.render_distance_type, "fixed", `${fileName} render distance type`);
  }
});

test("visual budget keeps low-memory clients conservative", () => {
  const source = readText(path.join(BP_SCRIPTS, "paradise_visual_budget.js"));
  assert.match(source, /LOW: Object\.freeze\(\{ particlePulseTicks: 34, particleBurst: 0, particleRadius: 10 \}\)/);
  assert.match(source, /MID: Object\.freeze\(\{ particlePulseTicks: 22, particleBurst: 1, particleRadius: 17 \}\)/);
  assert.match(source, /HIGH: Object\.freeze\(\{ particlePulseTicks: 16, particleBurst: 2, particleRadius: 23 \}\)/);
  assert.match(source, /SUPER_HIGH: Object\.freeze\(\{ particlePulseTicks: 12, particleBurst: 3, particleRadius: 29 \}\)/);
});

const PARTICLE_FILES = [
  "paradise_dust_mote.json",
  "paradise_pollen_mote.json",
  "paradise_ash_fleck.json",
  "paradise_celestial_mote.json",
];

test("all Paradise ambient particles remain valid JSON with one-particle emitters", () => {
  for (const fileName of PARTICLE_FILES) {
    const particle = readJson(path.join(RP_PARTICLES, fileName));
    assert.equal(particle.format_version, "1.10.0");
    assert.equal(
      particle.particle_effect.components["minecraft:emitter_rate_instant"].num_particles,
      1,
      `${fileName} should stay cheap per spawn`,
    );
  }
});

test("Yellow Halls flicker uses spaced bursts with restoration", () => {
  const source = readText(path.join(BP_SCRIPTS, "yellow_halls.js"));
  assert.match(source, /const FLICKER_MIN_GAP_TICKS = 80;/);
  assert.match(source, /const FLICKER_MAX_GAP_TICKS = 260;/);
  assert.match(source, /const FLICKER_BURST_MIN_TICKS = 3;/);
  assert.match(source, /const FLICKER_BURST_MAX_TICKS = 10;/);
  assert.match(source, /nextFlickerTick:/);
  assert.match(source, /flickerRestoreTick:/);

  const restoreMatch = source.match(
    /function restoreFlickeredLights\(dimension\) \{([\s\S]*?)\n\}\n\nfunction flickerLightsNearPlayer/,
  );
  assert.ok(restoreMatch, "restoreFlickeredLights must remain a distinct helper");
  assert.match(restoreMatch[1], /state\.flickeredLights\.delete\(posKey\)/);
  assert.doesNotMatch(
    restoreMatch[1],
    /state\.flickeredLights\.clear\(\)/,
    "unloaded light positions must remain queued for a later restore attempt",
  );
  assert.match(source, /if \(!state\.flickerOn && state\.flickeredLights\.size > 0\)/);
});

test("Catacomb lights stay mostly lit and flicker in short bursts", () => {
  const source = readText(path.join(BP_SCRIPTS, "catacombs.js"));
  assert.match(source, /const FLICKER_ACTIVE_DISTANCE = 56;/);
  assert.match(source, /const MAX_FLICKER_LIGHT_NODES = 48;/);
  assert.match(source, /onTicksMin: options\.onTicksMin \?\? 140/);
  assert.match(source, /onTicksMax: options\.onTicksMax \?\? 420/);
  assert.match(source, /offTicksMin: options\.offTicksMin \?\? 2/);
  assert.match(source, /offTicksMax: options\.offTicksMax \?\? 12/);
});

test("dimension generators use the approved visual palette changes", () => {
  const yellow = readText(path.join(BP_SCRIPTS, "yellow_halls.js"));
  const flower = readText(path.join(BP_SCRIPTS, "flat_flower.js"));
  const highway = readText(path.join(BP_SCRIPTS, "burning_highway.js"));
  const stairs = readText(path.join(BP_SCRIPTS, "endless_staircase.js"));
  const heaven = readText(path.join(BP_SCRIPTS, "heaven.js"));
  const library = readText(path.join(BP_SCRIPTS, "library.js"));

  assert.match(yellow, /if \(cellRng\(\) < 0\.62\)/);
  assert.match(flower, /const FLOWER_DENSITY = 0\.76;/);
  assert.match(flower, /const MAX_LIGHT_ANCHORS_PER_PATCH = 8;/);
  assert.match(highway, /\{ type: BLOCK\.blackstone, weight: 46 \}/);
  assert.match(highway, /\{ type: BLOCK\.crackedPolishedBlackstoneBricks, weight: 28 \}/);
  assert.match(stairs, /stair: "minecraft:deepslate_brick_stairs"/);
  assert.match(heaven, /"minecraft:light_gray_concrete"/);
  assert.match(library, /"minecraft:glowstone"/);
});

test("the main entrypoint still uses the existing atmosphere bootstrap", () => {
  const main = readText(path.join(BP_SCRIPTS, "main.js"));
  const atmosphereImports = main
    .split("\n")
    .filter((line) => line.includes("paradise_dimension_atmosphere.js"));
  assert.equal(atmosphereImports.length, 1);
});

test("visual profile module stays pure and testable", () => {
  const source = readText(PROFILE_PATH);
  assert.doesNotMatch(source, /@minecraft\/server/);
  assert.doesNotMatch(source, /system\.run/);
  assert.doesNotMatch(source, /world\./);
});

test("visual upgrade does not add new dimension ids", async () => {
  const moduleUrl = pathToFileURL(PROFILE_PATH);
  const { PARADISE_VISUAL_DIMENSION_IDS } = await import(`${moduleUrl.href}?t=${Date.now()}`);
  assert.equal(PARADISE_VISUAL_DIMENSION_IDS.length, 7);
});
