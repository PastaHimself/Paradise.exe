import {
  BlockPermutation,
  BlockVolume,
  CommandPermissionLevel,
  CustomCommandStatus,
  WeatherType,
  system,
  world,
} from "@minecraft/server";
import {
  VHS_TIER,
  canTrigger,
  clearRuleState,
  getOrCreateRuleState,
  requestRuleVhs,
  tryBeginRuleScare,
  safeAddEffect,
  safePlaySound,
  safeSpawnParticle,
  safeTitle,
  sampleMotion,
  verifiedPlayerTeleport,
  setStandingSign,
} from "./dimension_horror_rules.js";
import { hashCoords as visualHashCoords, scheduleStructurePlacement } from "./paradise_visual_jobs.js";
import { shouldRebuildGeneratedPatch } from "./paradise_visual_geometry.js";
import { runSingleFlight } from "./paradise_single_flight.js";
import {
  clearPlayerEntries,
  collectOccupiedFlowerPatches,
  collectUniqueFlowerPatches,
} from "./flat_flower_lifecycle.js";
import {
  SCENE_GARDEN_PROPS,
  SCENE_LANDMARKS,
  SCENE_LANDMARK_DRESS,
  SCENE_MARKERS,
  SCENE_STRUCTURE_SIZES,
  isAuthoredScenePatch,
  isScenePath,
  landmarkInPatch,
  sceneFlower,
  sceneGround,
  sceneStructurePatches,
  unreservedPatchRectangles,
} from "./flat_flower_scene.js";

const DIMENSION_ID = "paradise:flat_flower";
const ENTER_COMMAND_ID = "p:enter_flat_flower";
const CHAT_ENTER_COMMAND = "!enter_flat_flower";

// The dimension is script-generated. We keep the world flat and peaceful by
// painting loaded patches around the player instead of relying on native terrain generation.
const ENTRY_CENTER = { x: 0, y: 64, z: 0 };
const ENTRY_TELEPORT_Y = 66;
const GROUND_Y = 64;
const FLOWER_Y = 65;
const AIR_TOP_Y = 67;
const LIGHT_Y = 68;
const PAD_SCAN_MIN_Y = GROUND_Y;
const PAD_SCAN_FILL_MAX_Y = GROUND_Y + 5;
const PAD_SCAN_STRUCTURE_MAX_Y = GROUND_Y + 13;
const PAD_SCAN_DRESS_MAX_Y = GROUND_Y + 8;
const PAD_SCAN_DECORATION_MAX_Y = GROUND_Y + 3;

const PATCH_SIZE = 32;
const ACTIVE_PATCH_RADIUS = 1;
const MAINTENANCE_INTERVAL_TICKS = 20;
const PROXIMITY_CHECK_TICKS = 5;
const WEATHER_REFRESH_TICKS = 20 * 60 * 5;

const FLOWER_MIN_DISTANCE = 220;
const FLOWER_MAX_DISTANCE = 360;
const FLOWER_CLEAR_RADIUS = 2;
const SPAWN_CLEAR_RADIUS = 4;
const FLOWER_DENSITY = 0.76;
const MAX_LIGHT_ANCHORS_PER_PATCH = 8;
const FALSE_GOLDEN_FLOWERS_PER_RUN = 8;
const WORLD_GENERATION_SEED = 0;
const FLAT_FLOWER_MODULES = Object.freeze([
  "paradise:flat_flower/lone_tree",
  "paradise:flat_flower/ruined_gazebo",
  "paradise:flat_flower/flower_ring",
  "paradise:flat_flower/distant_marker",
]);
const TRUE_ESCAPE_FLOWER_BLOCK = "minecraft:wither_rose";
const FALSE_ESCAPE_FLOWER_BLOCK = "minecraft:yellow_flower";

const ALLOWED_ENTITY_IDS = new Set([
  "minecraft:item",
  "minecraft:player",
  "minecraft:xp_orb",
]);

const ENTRY_PATCH = getPatchCoordsFromBlockPos(ENTRY_CENTER);

// The state is intentionally lightweight and session-based, matching the pack's
// existing catacombs pattern.
const state = {
  bootstrapPromise: null,
  bootstrapReady: false,
  maintenanceRunning: false,
  generatedPatches: new Map(),
  patchVersions: new Map(),
  dirtyPatches: new Set(),
  patchJobs: new Map(),
  returnPoints: new Map(),
  activeFlowers: new Map(),
  pendingEscapes: new Set(),
  nextWeatherRefreshTick: 0,
  lureRules: new Map(),
};

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toBlockPos(location) {
  return {
    x: Math.floor(location.x),
    y: Math.floor(location.y),
    z: Math.floor(location.z),
  };
}

function addVec(location, dx = 0, dy = 0, dz = 0) {
  return {
    x: location.x + dx,
    y: location.y + dy,
    z: location.z + dz,
  };
}

function sameBlockPos(a, b) {
  const left = toBlockPos(a);
  const right = toBlockPos(b);
  return left.x === right.x && left.y === right.y && left.z === right.z;
}

function getFlatFlowerDimension() {
  // Dimension types don't include custom dimension IDs, but registerCustomDimension creates it at runtime.
  return world.getDimension(/** @type {any} */ (DIMENSION_ID));
}

function isFlatFlowerDimension(dimension) {
  return !!dimension && dimension.id === DIMENSION_ID;
}

function getPatchKey(patchX, patchZ) {
  return `${patchX}:${patchZ}`;
}

function getPatchCoordsFromBlockPos(position) {
  const block = toBlockPos(position);
  return {
    patchX: Math.floor(block.x / PATCH_SIZE),
    patchZ: Math.floor(block.z / PATCH_SIZE),
  };
}

function markPatchDirtyAt(location) {
  if (!location) return;
  const { patchX, patchZ } = getPatchCoordsFromBlockPos(location);
  state.dirtyPatches.add(getPatchKey(patchX, patchZ));
}

function getPatchBounds(patchX, patchZ) {
  const minX = patchX * PATCH_SIZE;
  const minZ = patchZ * PATCH_SIZE;
  return {
    minX,
    minZ,
    maxX: minX + PATCH_SIZE - 1,
    maxZ: minZ + PATCH_SIZE - 1,
  };
}

function patchContainsLocation(patchX, patchZ, location) {
  const { minX, minZ, maxX, maxZ } = getPatchBounds(patchX, patchZ);
  const block = toBlockPos(location);
  return block.x >= minX && block.x <= maxX && block.z >= minZ && block.z <= maxZ;
}

function hash32(value) {
  let n = value | 0;
  n ^= n >>> 16;
  n = Math.imul(n, 0x7feb352d);
  n ^= n >>> 15;
  n = Math.imul(n, 0x846ca68b);
  n ^= n >>> 16;
  return n >>> 0;
}

function noise2D(x, z) {
  const mixed =
    Math.imul(x | 0, 0x8da6b343) ^
    Math.imul(z | 0, 0xd8163841) ^
    Math.imul(WORLD_GENERATION_SEED, 0x9e3779b1) ^
    0x5f3759df;
  return hash32(mixed);
}

function shouldPlaceRedFlower(x, z) {
  // Coarse 8x8 micro-zones bias local density while the five equal bias bands
  // average back to the existing 0.82 target across the field.
  const zoneBand = noise2D(Math.floor(x / 8), Math.floor(z / 8)) % 5;
  const zoneBias = (zoneBand - 2) * 0.07;
  const threshold = clamp(FLOWER_DENSITY + zoneBias, 0.68, 0.96);
  return noise2D(x, z) % 10000 < threshold * 10000;
}

function getFieldFlowerBlock(x, z) {
  const zone = noise2D(Math.floor(x / 8) + 71, Math.floor(z / 8) - 43) % 100;
  if (zone < 80) return "minecraft:poppy";
  if (zone < 87) return "minecraft:cornflower";
  if (zone < 94) return "minecraft:white_tulip";
  return "minecraft:azure_bluet";
}

function isPadReserved(x, z, centers) {
  return centers.some((center) =>
    (Math.abs(x - center.x) <= 1 && Math.abs(z - center.z) <= 1)
    || (x === center.x && z === center.z + 2));
}

function collectPadReservations(dimension, minX, minZ, maxX, maxZ, minY, maxY) {
  const centers = [];
  // Keep the snapshot synchronous for destructive fills and placement guards.
  const volume = new BlockVolume(
    { x: minX, y: minY, z: minZ },
    { x: maxX, y: maxY, z: maxZ },
  );
  const plates = dimension.getBlocks(volume, {
    includeTypes: ["minecraft:stone_pressure_plate"],
  });
  for (const location of plates.getBlockLocationIterator()) {
    centers.push({ x: location.x, z: location.z });
  }
  return centers;
}

function collectPadReservationsForPoints(dimension, points, minY, maxY) {
  if (points.length === 0) return [];

  let minX = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minZ = Math.min(minZ, point.z);
    maxX = Math.max(maxX, point.x);
    maxZ = Math.max(maxZ, point.z);
  }

  return collectPadReservations(
    dimension,
    minX - 1,
    minZ - 2,
    maxX + 1,
    maxZ + 1,
    minY,
    maxY,
  );
}

function fillUnreservedPatch(dimension, bounds, centers, fromY, toY, typeId) {
  for (const [minX, maxX, minZ, maxZ] of unreservedPatchRectangles(
    bounds.minX, bounds.minZ, bounds.maxX, bounds.maxZ, centers,
  )) {
    dimension.fillBlocks(
      new BlockVolume({ x: minX, y: fromY, z: minZ }, { x: maxX, y: toY, z: maxZ }),
      typeId,
    );
  }
}

function placeSparseLightAnchors(dimension, minX, minZ, protectedCenters = []) {
  let placed = 0;
  for (let localX = 4; localX < PATCH_SIZE && placed < MAX_LIGHT_ANCHORS_PER_PATCH; localX += 8) {
    for (let localZ = 4; localZ < PATCH_SIZE && placed < MAX_LIGHT_ANCHORS_PER_PATCH; localZ += 8) {
      if (isPadReserved(minX + localX, minZ + localZ, protectedCenters)) continue;
      setBlockSafe(dimension, { x: minX + localX, y: LIGHT_Y, z: minZ + localZ }, "minecraft:light_block_15");
      placed++;
    }
  }
}

function patchHasSpecialFlowerSite(patchX, patchZ) {
  if (patchX === ENTRY_PATCH.patchX && patchZ === ENTRY_PATCH.patchZ) return true;
  for (const flower of state.activeFlowers.values()) {
    if (flower.patchX === patchX && flower.patchZ === patchZ) return true;
    for (const falseFlower of flower.falseFlowers || []) {
      if (falseFlower.patchX === patchX && falseFlower.patchZ === patchZ) return true;
    }
  }
  return false;
}

async function scheduleFlatFlowerLandmark(dimension, patchX, patchZ, minX, minZ, token) {
  if (patchHasSpecialFlowerSite(patchX, patchZ) || isAuthoredScenePatch(patchX, patchZ)) return true;
  const seed = visualHashCoords(patchX, patchZ, WORLD_GENERATION_SEED ^ 0x464c4154);
  if (seed % 16 !== 0) return true;
  const structureId = FLAT_FLOWER_MODULES[(seed >>> 4) % FLAT_FLOWER_MODULES.length];
  const offsetX = seed & 1 ? 2 : 18;
  const offsetZ = seed & 2 ? 2 : 18;
  const location = { x: minX + offsetX, y: GROUND_Y + 1, z: minZ + offsetZ };
  const [sizeX, , sizeZ] = SCENE_STRUCTURE_SIZES[structureId];
  const ownsPaintToken = () => state.patchVersions.get(getPatchKey(patchX, patchZ)) === token;
  const overlapsLivePad = () => collectPadReservations(
    dimension,
    location.x - 1,
    location.z - 2,
    location.x + sizeX,
    location.z + sizeZ,
    PAD_SCAN_MIN_Y,
    PAD_SCAN_STRUCTURE_MAX_Y,
  ).length > 0;

  if (!ownsPaintToken()) return false;
  if (overlapsLivePad()) return true;

  let padBlockedPlacement = false;
  const isPlacementAllowed = () => {
    if (!ownsPaintToken()) return false;
    if (overlapsLivePad()) {
      padBlockedPlacement = true;
      return false;
    }
    return true;
  };
  const placed = await scheduleStructurePlacement(
    `flat-flower:${WORLD_GENERATION_SEED}:${patchX}:${patchZ}:${token}`,
    structureId,
    dimension,
    location,
    { isPlacementAllowed },
  );
  if (!ownsPaintToken()) return false;
  if (placed) return true;
  return padBlockedPlacement || overlapsLivePad();
}

function paintSceneColumn(dimension, x, z, protectedCenters) {
  const ground = sceneGround(x, z);
  if (!ground) return false;
  if (isPadReserved(x, z, protectedCenters)) return true;
  setBlockSafe(dimension, { x, y: GROUND_Y, z }, ground);
  const flower = sceneFlower(x, z);
  if (flower) {
    setBlockSafe(dimension, { x, y: FLOWER_Y, z }, flower);
  }
  return true;
}

function placeScenePiece(dimension, piece, protectedCenters) {
  if (piece.y <= AIR_TOP_Y && isScenePath(piece.x, piece.z)) return false;
  if (isPadReserved(piece.x, piece.z, protectedCenters)) return false;
  const block = dimension.getBlock({ x: piece.x, y: piece.y, z: piece.z });
  if (!block) return false;
  const replaceable = block.typeId === "minecraft:air"
    || block.typeId === "minecraft:structure_void"
    || block.typeId?.startsWith("paradise:ff_")
    || ["minecraft:poppy", "minecraft:cornflower", "minecraft:white_tulip", "minecraft:azure_bluet"].includes(block.typeId);
  if (!replaceable) return false;
  try {
    block.setPermutation(BlockPermutation.resolve(piece.block, {
      "minecraft:cardinal_direction": piece.facing,
    }));
    return true;
  } catch (_error) {
    return false;
  }
}

async function placeSceneAnchors(dimension, patchX, patchZ, minX, minZ, maxX, maxZ, token) {
  const ownsPaintToken = () => state.patchVersions.get(getPatchKey(patchX, patchZ)) === token;
  for (const landmark of SCENE_LANDMARKS) {
    if (!landmarkInPatch(landmark, minX, minZ, maxX, maxZ)) continue;
    // The source structures currently fit wholly in their owning patches.
    // Check this before a future resize can put unloaded neighboring cells at risk.
    const requiredPatches = sceneStructurePatches(landmark);
    if (requiredPatches.some((key) => key !== getPatchKey(patchX, patchZ))) {
      throw new Error(`Flat Flower structure spans unprepared patches: ${landmark.id}`);
    }
    const [sizeX, , sizeZ] = SCENE_STRUCTURE_SIZES[landmark.id];
    const overlapsLivePad = () => collectPadReservations(
      dimension,
      landmark.x - 1,
      landmark.z - 2,
      landmark.x + sizeX,
      landmark.z + sizeZ,
      PAD_SCAN_MIN_Y,
      PAD_SCAN_STRUCTURE_MAX_Y,
    ).length > 0;
    // The travel planner owns any newly re-anchored pad in this footprint.
    if (overlapsLivePad()) continue;
    let padBlockedPlacement = false;
    const isPlacementAllowed = () => {
      if (!ownsPaintToken()) return false;
      if (overlapsLivePad()) {
        padBlockedPlacement = true;
        return false;
      }
      return true;
    };
    const placed = await scheduleStructurePlacement(
      `flat-flower-scene:${WORLD_GENERATION_SEED}:${landmark.id}:${token}`,
      landmark.id,
      dimension,
      { x: landmark.x, y: landmark.y, z: landmark.z },
      { isPlacementAllowed },
    );
    if ((!placed && !padBlockedPlacement && !overlapsLivePad()) || !ownsPaintToken()) {
      throw new Error(`Flat Flower structure placement failed: ${landmark.id}`);
    }
    if (!placed) continue;
    const dressPieces = SCENE_LANDMARK_DRESS.filter((piece) => piece.landmark === landmark.id);
    if (dressPieces.length > 0) {
      const currentPads = collectPadReservationsForPoints(
        dimension,
        dressPieces,
        PAD_SCAN_MIN_Y,
        PAD_SCAN_DRESS_MAX_Y,
      );
      for (const piece of dressPieces) placeScenePiece(dimension, piece, currentPads);
    }
  }

  const localMarkers = SCENE_MARKERS.filter((marker) => landmarkInPatch(marker, minX, minZ, maxX, maxZ));
  const localProps = SCENE_GARDEN_PROPS.filter((prop) => landmarkInPatch(prop, minX, minZ, maxX, maxZ));
  const localDecorations = [...localMarkers, ...localProps];
  const currentPads = collectPadReservationsForPoints(
    dimension,
    localDecorations,
    PAD_SCAN_MIN_Y,
    PAD_SCAN_DECORATION_MAX_Y,
  );
  for (const marker of localMarkers) {
    marker.segments.forEach((segment, index) => {
      if (!isPadReserved(marker.x, marker.z, currentPads)) {
        setBlockSafe(dimension, { x: marker.x, y: FLOWER_Y + index, z: marker.z }, segment);
      }
    });
  }

  for (const prop of localProps) placeScenePiece(dimension, prop, currentPads);
}

function clearSpecialArea(dimension, center, radius) {
  const location = toBlockPos(center);
  const from = {
    x: location.x - radius,
    y: FLOWER_Y,
    z: location.z - radius,
  };
  const to = {
    x: location.x + radius,
    y: AIR_TOP_Y,
    z: location.z + radius,
  };

  try {
    dimension.fillBlocks(new BlockVolume(from, to), "minecraft:air");
  } catch (error) {
    // The next terrain pass will try again.
  }
}

function setBlockSafe(dimension, location, typeId) {
  try {
    dimension.setBlockType(toBlockPos(location), typeId);
    return true;
  } catch (error) {
    return false;
  }
}

function getPatchJob(dimension, patchX, patchZ, options = {}) {
  const key = getPatchKey(patchX, patchZ);

  const existingJob = state.patchJobs.get(key);
  if (existingJob) return existingJob;

  const current = state.generatedPatches.get(key);
  const stale = shouldRebuildGeneratedPatch(
    current,
    WORLD_GENERATION_SEED,
    options.force === true,
    state.dirtyPatches.has(key),
  );

  if (!stale) {
    return Promise.resolve(false);
  }

  const token = (state.patchVersions.get(key) ?? 0) + 1;
  state.patchVersions.set(key, token);
  const job = runSingleFlight(state.patchJobs, key, async () => {
    state.dirtyPatches.delete(key);
    try {
      await paintPatch(dimension, patchX, patchZ, { ...options, token });
      state.generatedPatches.set(key, {
        lastBuiltTick: system.currentTick,
        runSeed: WORLD_GENERATION_SEED,
      });
      return true;
    } catch (error) {
      state.dirtyPatches.add(key);
      console.warn(`[Flat Flower] Patch build failed at ${patchX}:${patchZ}.`, error);
      return false;
    }
  });

  return job.then((result) => {
    if (state.dirtyPatches.has(key)) {
      system.run(() => {
        void getPatchJob(dimension, patchX, patchZ).catch(() => {});
      });
    }
    return result;
  });
}

async function withTickingArea(dimension, areaId, from, to, work) {
  const manager = world.tickingAreaManager;

  if (!manager || typeof manager.createTickingArea !== "function") {
    return work();
  }

  await manager.createTickingArea(areaId, {
    dimension,
    from,
    to,
  });

  try {
    return await work();
  } finally {
    try {
      manager.removeTickingArea(areaId);
    } catch (error) {
      // Best effort cleanup.
    }
  }
}

async function paintPatch(dimension, patchX, patchZ, options = {}) {
  const { minX, minZ, maxX, maxZ } = getPatchBounds(patchX, patchZ);
  const bounds = { minX, minZ, maxX, maxZ };
  const areaId = `${DIMENSION_ID}:patch:${patchX}:${patchZ}`;

  const from = {
    x: minX - 4,
    y: GROUND_Y - 1,
    z: minZ - 4,
  };
  const to = {
    x: maxX + 4,
    y: PAD_SCAN_STRUCTURE_MAX_Y + 2,
    z: maxZ + 4,
  };

  await withTickingArea(dimension, areaId, from, to, async () => {
    const protectedCenters = collectPadReservations(
      dimension,
      minX - 1,
      minZ - 2,
      maxX + 1,
      maxZ + 1,
      PAD_SCAN_MIN_Y,
      PAD_SCAN_FILL_MAX_Y,
    );
    fillUnreservedPatch(dimension, bounds, protectedCenters, GROUND_Y, GROUND_Y, "minecraft:grass_block");

    // Clear the space above the grass before the flowers and light are applied.
    fillUnreservedPatch(dimension, bounds, protectedCenters, FLOWER_Y, LIGHT_Y, "minecraft:air");

    placeSparseLightAnchors(dimension, minX, minZ, protectedCenters);

    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        if (paintSceneColumn(dimension, x, z, protectedCenters)) continue;
        if (isPadReserved(x, z, protectedCenters)) continue;
        if (shouldPlaceRedFlower(x, z)) {
          setBlockSafe(dimension, { x, y: FLOWER_Y, z }, getFieldFlowerBlock(x, z));
        }
      }
    }

    if (options.suppressSpecialSites !== true) {
      applySpecialSitesForPatch(dimension, patchX, patchZ);
    }
    await placeSceneAnchors(
      dimension, patchX, patchZ, minX, minZ, maxX, maxZ, options.token,
    );
    const ambientPlaced = await scheduleFlatFlowerLandmark(
      dimension, patchX, patchZ, minX, minZ, options.token,
    );
    if (!ambientPlaced) throw new Error(`Flat Flower ambient placement failed: ${patchX}:${patchZ}`);
  });
}

function getFlowerLureState(playerId) {
  return getOrCreateRuleState(state.lureRules, playerId, () => ({
    pressure: 0,
    lingerTicks: 0,
    falseFocusTicks: 0,
    cooldowns: new Map(),
  }));
}

function placeFlowerTeachingSigns(dimension) {
  setStandingSign(dimension, { x: ENTRY_CENTER.x - 2, y: FLOWER_Y, z: ENTRY_CENTER.z + 2 }, "TOO\\nBEAUTIFUL", "minecraft:oak_sign");
  setStandingSign(dimension, { x: ENTRY_CENTER.x + 2, y: FLOWER_Y, z: ENTRY_CENTER.z + 2 }, "THE\\nBRIGHT\\nONES\\nWANT YOU", "minecraft:oak_sign");
}

function decorateFalseFlowerLure(dimension, falseFlower) {
  const loc = falseFlower.location;
  const ring = [
    { x: loc.x + 1, z: loc.z },
    { x: loc.x - 1, z: loc.z },
    { x: loc.x, z: loc.z + 1 },
    { x: loc.x, z: loc.z - 1 },
    { x: loc.x + 2, z: loc.z },
    { x: loc.x - 2, z: loc.z },
    { x: loc.x, z: loc.z + 2 },
    { x: loc.x, z: loc.z - 2 },
  ];
  for (const spot of ring) {
    setBlockSafe(dimension, { x: spot.x, y: GROUND_Y, z: spot.z }, "minecraft:grass_block");
    setBlockSafe(dimension, { x: spot.x, y: FLOWER_Y, z: spot.z }, "minecraft:poppy");
  }
}

function nearestFalseFlower(player) {
  const flower = getActiveFlower(player.id);
  if (!flower || !Array.isArray(flower.falseFlowers)) return undefined;
  let best = undefined;
  let bestDist = Number.MAX_SAFE_INTEGER;
  for (const falseFlower of flower.falseFlowers) {
    const dx = player.location.x - (falseFlower.location.x + 0.5);
    const dz = player.location.z - (falseFlower.location.z + 0.5);
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < bestDist) {
      best = falseFlower;
      bestDist = dist;
    }
  }
  return best ? { falseFlower: best, distance: bestDist } : undefined;
}

function warnFlowerLure(player, ruleState, subtitle = "The beautiful path is watching.") {
  if (!canTrigger(ruleState, "warning", 20 * 10)) return;
  safePlaySound(player.dimension, "ambient.cave", player.location, { volume: 0.45, pitch: 1.45 });
  safeSpawnParticle(player.dimension, "minecraft:heart_particle", addVec(player.location, 0, 0.8, 0));
  requestRuleVhs(player, VHS_TIER.Low, 20 * 5, "flat-flower-lure");
  safeTitle(player, "", subtitle, 35);
}

async function resetFlowerAfterLure(player, ruleState) {
  const scareDecision = tryBeginRuleScare(player, ruleState, "consequence", 20 * 40, {
    source: "dimension_scare:flat_flower_false_beauty",
    intensity: 4,
    minimumQuietTicks: 20 * 45,
    buildupTicks: 20 * 4,
    peakTicks: 20 * 7,
    reliefTicks: 20 * 20,
    globalCooldownTicks: 20 * 55,
    playerCooldownTicks: 20 * 70,
  });
  if (!scareDecision.allowed) return;
  ruleState.pressure = 0;
  ruleState.falseFocusTicks = 0;
  assignGoldenFlower(player.id, ENTRY_CENTER);
  safeTitle(player, "The field smiles again.", "The perfect flowers lied.", 50);
  safeAddEffect(player, "minecraft:blindness", 45, { amplifier: 0, showParticles: false });
  requestRuleVhs(player, VHS_TIER.High, 20 * 7, "flat-flower-false-beauty");
  await verifiedPlayerTeleport(player, addVec(ENTRY_CENTER, 0, 2, 0), {
    dimension: player.dimension,
    checkForBlocks: false,
    keepVelocity: false,
  }, { attempts: 6, retryTicks: 3, maxDistance: 48 });
  await ensureTerrainAroundLocation(ENTRY_CENTER, 1);
  placeFlowerTeachingSigns(player.dimension);
  await prepareGoldenFlowerSite(player.id);
}

function updateFlatFlowerLureRule(player) {
  if (state.pendingEscapes.has(player.id)) return;
  const ruleState = getFlowerLureState(player.id);
  const motion = sampleMotion(ruleState, player.location);
  const nearest = nearestFalseFlower(player);
  if (!nearest) return;

  const closingFast = nearest.distance < (ruleState.lastFalseDistance ?? Number.MAX_SAFE_INTEGER) - 0.25;
  ruleState.lastFalseDistance = nearest.distance;

  if (nearest.distance <= 18 && closingFast && motion.horizontalDistance > 0.3) {
    ruleState.falseFocusTicks = (ruleState.falseFocusTicks || 0) + motion.dt;
    ruleState.pressure += 1.2;
  } else {
    ruleState.falseFocusTicks = Math.max(0, (ruleState.falseFocusTicks || 0) - motion.dt * 2);
    ruleState.pressure = Math.max(0, ruleState.pressure - 0.4);
  }

  if (nearest.distance <= 5) {
    ruleState.pressure += 1;
    if (canTrigger(ruleState, "ring", 20 * 12)) {
      decorateFalseFlowerLure(player.dimension, nearest.falseFlower);
    }
  }

  if (ruleState.pressure >= 6) {
    warnFlowerLure(player, ruleState, "The perfect flowers lean closer.");
  }
  if (ruleState.pressure >= 16 || nearest.distance <= 1.75) {
    system.run(() => {
      void resetFlowerAfterLure(player, ruleState).catch(() => {});
    });
  }
}

function applySpecialSitesForPatch(dimension, patchX, patchZ) {
  if (patchX === ENTRY_PATCH.patchX && patchZ === ENTRY_PATCH.patchZ) {
    clearSpecialArea(dimension, ENTRY_CENTER, SPAWN_CLEAR_RADIUS);
    setBlockSafe(dimension, { x: ENTRY_CENTER.x, y: LIGHT_Y, z: ENTRY_CENTER.z }, "minecraft:light_block_15");
  }

  for (const [playerId, flower] of state.activeFlowers.entries()) {
    if (state.pendingEscapes.has(playerId)) {
      continue;
    }

    for (const falseFlower of flower.falseFlowers || []) {
      if (falseFlower.patchX !== patchX || falseFlower.patchZ !== patchZ) {
        continue;
      }
      clearSpecialArea(dimension, falseFlower.location, 1);
      setBlockSafe(dimension, { x: falseFlower.location.x, y: GROUND_Y, z: falseFlower.location.z }, "minecraft:grass_block");
      setBlockSafe(dimension, { x: falseFlower.location.x, y: FLOWER_Y, z: falseFlower.location.z }, FALSE_ESCAPE_FLOWER_BLOCK);
      setBlockSafe(dimension, { x: falseFlower.location.x, y: LIGHT_Y, z: falseFlower.location.z }, "minecraft:light_block_15");
      decorateFalseFlowerLure(dimension, falseFlower);
    }

    if (flower.patchX !== patchX || flower.patchZ !== patchZ) {
      continue;
    }

    clearSpecialArea(dimension, flower.location, FLOWER_CLEAR_RADIUS);
    setBlockSafe(dimension, { x: flower.location.x, y: GROUND_Y, z: flower.location.z }, "minecraft:grass_block");
    setBlockSafe(dimension, { x: flower.location.x, y: FLOWER_Y, z: flower.location.z }, TRUE_ESCAPE_FLOWER_BLOCK);
    setBlockSafe(dimension, { x: flower.location.x, y: LIGHT_Y, z: flower.location.z }, "minecraft:light_block_15");
    flower.prepared = true;
  }
}

function chooseGoldenFlowerLocation(origin, playerId) {
  const occupiedPatches = collectOccupiedFlowerPatches(state.activeFlowers, playerId);

  const base = toBlockPos(origin);

  for (let attempt = 0; attempt < 24; attempt++) {
    const distance = randomInt(FLOWER_MIN_DISTANCE, FLOWER_MAX_DISTANCE);
    const angle = Math.random() * Math.PI * 2;

    let x = base.x + Math.round(Math.cos(angle) * distance);
    let z = base.z + Math.round(Math.sin(angle) * distance);
    let patchX = Math.floor(x / PATCH_SIZE);
    let patchZ = Math.floor(z / PATCH_SIZE);
    const key = getPatchKey(patchX, patchZ);

    if (occupiedPatches.has(key)) {
      continue;
    }

    const bounds = getPatchBounds(patchX, patchZ);
    const safeMargin = FLOWER_CLEAR_RADIUS + 4;

    x = clamp(x, bounds.minX + safeMargin, bounds.maxX - safeMargin);
    z = clamp(z, bounds.minZ + safeMargin, bounds.maxZ - safeMargin);
    patchX = Math.floor(x / PATCH_SIZE);
    patchZ = Math.floor(z / PATCH_SIZE);

    if (occupiedPatches.has(getPatchKey(patchX, patchZ))) {
      continue;
    }

    return {
      location: {
        x,
        y: FLOWER_Y,
        z,
      },
      patchX,
      patchZ,
    };
  }

  for (let offset = 0; offset < 64; offset += 1) {
    const fallbackX = base.x + FLOWER_MIN_DISTANCE + offset * PATCH_SIZE;
    const fallbackZ = base.z;
    const patchX = Math.floor(fallbackX / PATCH_SIZE);
    const patchZ = Math.floor(fallbackZ / PATCH_SIZE);
    if (occupiedPatches.has(getPatchKey(patchX, patchZ))) continue;
    return { location: { x: fallbackX, y: FLOWER_Y, z: fallbackZ }, patchX, patchZ };
  }

  throw new Error("Unable to reserve a unique Flat Flower patch for the player.");
}

function chooseFalseGoldenFlowers(origin, trueFlower, playerId) {
  const base = toBlockPos(origin);
  const falseFlowers = [];
  const occupiedPatches = collectOccupiedFlowerPatches(state.activeFlowers, playerId);
  occupiedPatches.add(getPatchKey(trueFlower.patchX, trueFlower.patchZ));

  for (let attempt = 0; attempt < 80 && falseFlowers.length < FALSE_GOLDEN_FLOWERS_PER_RUN; attempt++) {
    const distance = randomInt(Math.floor(FLOWER_MIN_DISTANCE * 0.45), FLOWER_MAX_DISTANCE);
    const angle = Math.random() * Math.PI * 2;
    const x = base.x + Math.round(Math.cos(angle) * distance);
    const z = base.z + Math.round(Math.sin(angle) * distance);
    const patchX = Math.floor(x / PATCH_SIZE);
    const patchZ = Math.floor(z / PATCH_SIZE);
    const patchKey = getPatchKey(patchX, patchZ);
    if (occupiedPatches.has(patchKey)) continue;
    occupiedPatches.add(patchKey);

    falseFlowers.push({
      location: { x, y: FLOWER_Y, z },
      patchX,
      patchZ,
    });
  }

  return falseFlowers;
}

function assignGoldenFlower(playerId, origin) {
  const choice = chooseGoldenFlowerLocation(origin, playerId);
  choice.falseFlowers = chooseFalseGoldenFlowers(origin, choice, playerId);
  choice.runSeed = WORLD_GENERATION_SEED;
  choice.prepared = false;
  state.activeFlowers.set(playerId, choice);
  return choice;
}

async function ensureTerrainAroundLocation(location, radiusPatches = ACTIVE_PATCH_RADIUS, options = {}) {
  const { patchX, patchZ } = getPatchCoordsFromBlockPos(location);

  for (let dx = -radiusPatches; dx <= radiusPatches; dx++) {
    for (let dz = -radiusPatches; dz <= radiusPatches; dz++) {
      await getPatchJob(getFlatFlowerDimension(), patchX + dx, patchZ + dz, options);
    }
  }
}

async function prepareGoldenFlowerSite(playerId) {
  const flower = state.activeFlowers.get(playerId);
  if (!flower) {
    return;
  }

  const dimension = getFlatFlowerDimension();
  const force = flower.prepared !== true;
  for (const patch of collectUniqueFlowerPatches(flower)) {
    const built = await getPatchJob(dimension, patch.patchX, patch.patchZ, { force });
    const key = getPatchKey(patch.patchX, patch.patchZ);
    if ((force && !built) || state.dirtyPatches.has(key)) return;
  }
  flower.prepared = true;
  for (const falseFlower of flower.falseFlowers || []) falseFlower.prepared = true;
}

async function bootstrapFlatFlowerWorld() {
  if (!state.bootstrapPromise) {
    state.bootstrapPromise = (async () => {
      const dimension = getFlatFlowerDimension();
      await ensureTerrainAroundLocation(ENTRY_CENTER, 1, { force: true });
      setCalmWeather(dimension);
      state.nextWeatherRefreshTick = system.currentTick + WEATHER_REFRESH_TICKS;
      state.bootstrapReady = true;
    })().catch((error) => {
      state.bootstrapPromise = null;
      throw error;
    });
  }

  return state.bootstrapPromise;
}

function setCalmWeather(dimension) {
  try {
    dimension.setWeather(WeatherType.Clear, 20 * 60 * 20);
  } catch (error) {
    // Weather is a nice-to-have, not a requirement.
  }
}

function getSavedReturnPoint(playerId) {
  return state.returnPoints.get(playerId);
}

function storeReturnPoint(playerId, fromDimension, fromLocation) {
  state.returnPoints.set(playerId, {
    dimensionId: fromDimension.id,
    location: {
      x: fromLocation.x,
      y: fromLocation.y,
      z: fromLocation.z,
    },
  });
}

function getActiveFlower(playerId) {
  return state.activeFlowers.get(playerId);
}

async function escapePlayerFromFlatFlower(player) {
  if (!player || state.pendingEscapes.has(player.id)) {
    return false;
  }

  const flower = getActiveFlower(player.id);
  const returnPoint = getSavedReturnPoint(player.id);

  if (!flower || !returnPoint) {
    return false;
  }

  state.pendingEscapes.add(player.id);

  try {
    // Remove the special flower from the world before the player leaves so the field
    // goes back to its normal red-flower state.
    await getPatchJob(getFlatFlowerDimension(), flower.patchX, flower.patchZ, {
      force: true,
      suppressSpecialSites: true,
    });

    const targetDimension = world.getDimension("minecraft:overworld");
    const returned = await verifiedPlayerTeleport(player, returnPoint.location, {
      dimension: targetDimension,
      checkForBlocks: false,
      keepVelocity: false,
    }, { attempts: 8, retryTicks: 4, maxDistance: 64 });
    if (!returned) {
      throw new Error("Return teleport verification failed.");
    }

    return true;
  } catch (error) {
    // Restore the wrong-looking escape flower if escape failed.
    await prepareGoldenFlowerSite(player.id);
    return false;
  } finally {
    state.pendingEscapes.delete(player.id);
  }
}

function clearStateForLeavingPlayer(playerId) {
  clearPlayerEntries(playerId, [state.pendingEscapes, state.activeFlowers, state.returnPoints]);
  clearRuleState(state.lureRules, playerId);
}

function isGoldenFlowerLocation(playerId, location) {
  const flower = getActiveFlower(playerId);
  if (!flower) {
    return false;
  }

  const block = toBlockPos(location);
  return (
    block.x === flower.location.x &&
    block.z === flower.location.z &&
    (block.y === FLOWER_Y || block.y === GROUND_Y)
  );
}

function isFalseGoldenFlowerLocation(playerId, location) {
  const flower = getActiveFlower(playerId);
  if (!flower) {
    return false;
  }

  const block = toBlockPos(location);
  return (flower.falseFlowers || []).some((falseFlower) => (
    block.x === falseFlower.location.x &&
    block.z === falseFlower.location.z &&
    (block.y === FLOWER_Y || block.y === GROUND_Y)
  ));
}

function isNearGoldenFlower(playerId, location, radius = 2.5) {
  const flower = getActiveFlower(playerId);
  if (!flower) {
    return false;
  }

  const dx = location.x - (flower.location.x + 0.5);
  const dy = location.y - (flower.location.y + 0.5);
  const dz = location.z - (flower.location.z + 0.5);
  return dx * dx + dy * dy + dz * dz <= radius * radius;
}

function handlePlayerInteractWithBlock(event) {
  const player = event.player;
  const block = event.block;

  if (!player || !block || !isFlatFlowerDimension(player.dimension)) {
    return;
  }

  if (state.pendingEscapes.has(player.id)) {
    return;
  }

  if (isGoldenFlowerLocation(player.id, block.location)) {
    system.run(() => {
      try {
        player.sendMessage("The wrong flower does not open by touch. Break it.");
      } catch (error) {}
    });
    return;
  }

  if (isFalseGoldenFlowerLocation(player.id, block.location)) {
    system.run(() => {
      try {
        player.sendMessage("That flower is too perfect.");
      } catch (error) {}
      const ruleState = getFlowerLureState(player.id);
      ruleState.pressure += 10;
      void resetFlowerAfterLure(player, ruleState).catch(() => {});
    });
  }
}

function handlePlayerBreakBlock(event) {
  const player = event.player;
  const block = event.block;

  if (!player || !block || !isFlatFlowerDimension(player.dimension)) {
    return;
  }

  if (isGoldenFlowerLocation(player.id, block.location)) {
    markPatchDirtyAt(block.location);
    system.run(() => {
      void escapePlayerFromFlatFlower(player).catch(() => {});
    });
    return;
  }

  if (isFalseGoldenFlowerLocation(player.id, block.location)) {
    event.cancel = true;
    system.run(() => {
      try {
        player.sendMessage("That flower is too perfect.");
      } catch (error) {}
      const ruleState = getFlowerLureState(player.id);
      ruleState.pressure += 10;
      void resetFlowerAfterLure(player, ruleState).catch(() => {});
    });
    return;
  }

  markPatchDirtyAt(block.location);
}

function handlePlayerPlaceBlock(event) {
  const player = event.player;
  const block = event.block;
  if (!player || !block || !isFlatFlowerDimension(player.dimension)) return;
  markPatchDirtyAt(block.location);
}

function handleBlockExplode(event) {
  if (!event?.block || !isFlatFlowerDimension(event.dimension)) return;
  markPatchDirtyAt(event.block.location);
}

function handlePlayerDimensionChange(event) {
  const player = event.player;
  if (!player) {
    return;
  }

  const enteredFlatFlower =
    event.toDimension &&
    event.toDimension.id === DIMENSION_ID &&
    event.fromDimension &&
    event.fromDimension.id !== DIMENSION_ID;

  const leftFlatFlower =
    event.fromDimension &&
    event.fromDimension.id === DIMENSION_ID &&
    event.toDimension &&
    event.toDimension.id !== DIMENSION_ID;

  if (enteredFlatFlower) {
    clearStateForLeavingPlayer(player.id);
    storeReturnPoint(player.id, event.fromDimension, event.fromLocation);

    const origin = event.toLocation ? event.toLocation : ENTRY_CENTER;
    assignGoldenFlower(player.id, origin);

    try {
      player.sendMessage("§cHint: §7The wrong-looking wither rose is the way out. The perfect yellow flowers are bait.");
    } catch (error) {}

    system.run(() => {
      void ensureTerrainAroundLocation(origin, 1).catch(() => {});
      try { placeFlowerTeachingSigns(event.toDimension); } catch (_error) {}
      void prepareGoldenFlowerSite(player.id).catch(() => {});
    });

    return;
  }

  if (leftFlatFlower) {
    clearStateForLeavingPlayer(player.id);
  }
}

function handleEntitySpawn(event) {
  const entity = event.entity;
  if (!entity || !entity.isValid || !entity.dimension || entity.dimension.id !== DIMENSION_ID) {
    return;
  }

  if (ALLOWED_ENTITY_IDS.has(entity.typeId)) {
    return;
  }

  system.run(() => {
    try {
      entity.remove();
    } catch (error) {
      // Ignored. The next maintenance tick will catch it if needed.
    }
  });
}

async function maintainFlatFlowerWorld() {
  if (state.maintenanceRunning || !state.bootstrapReady) {
    return;
  }

  const dimension = getFlatFlowerDimension();
  const players = dimension.getPlayers();

  if (!players.length) {
    if (system.currentTick >= state.nextWeatherRefreshTick) {
      setCalmWeather(dimension);
      state.nextWeatherRefreshTick = system.currentTick + WEATHER_REFRESH_TICKS;
    }
    return;
  }

  state.maintenanceRunning = true;

  try {
    if (system.currentTick >= state.nextWeatherRefreshTick) {
      setCalmWeather(dimension);
      state.nextWeatherRefreshTick = system.currentTick + WEATHER_REFRESH_TICKS;
    }

    for (const player of players) {
      if (!player || !isFlatFlowerDimension(player.dimension)) {
        continue;
      }

      // Keep the immediate area flat and flower-covered as the player moves.
      await ensureTerrainAroundLocation(player.location, ACTIVE_PATCH_RADIUS);

      // Remove any stray entities near active players so the dimension stays calm.
      try {
        const nearbyEntities = dimension.getEntities({
          location: player.location,
          maxDistance: 48,
        });

        for (const entity of nearbyEntities) {
          if (entity.typeId === "minecraft:player") {
            continue;
          }

          if (ALLOWED_ENTITY_IDS.has(entity.typeId)) {
            continue;
          }

          try {
            entity.remove();
          } catch (error) {
            // Ignore individual cleanup failures.
          }
        }
      } catch (error) {
        // Entity queries can fail if the chunk is still streaming in.
      }

      const flower = getActiveFlower(player.id);
      if (flower && !state.pendingEscapes.has(player.id) && flower.prepared !== true) {
        // Make sure the wrong-looking escape flower patch exists even if the player never reaches it
        // right away. The flower is re-painted if the chunk is refreshed later.
        await prepareGoldenFlowerSite(player.id);
      }

      updateFlatFlowerLureRule(player);
    }
  } finally {
    state.maintenanceRunning = false;
  }
}

function handleFlowerProximity() {
  if (!state.bootstrapReady) {
    return;
  }

  const dimension = getFlatFlowerDimension();
  const players = dimension.getPlayers();

  for (const player of players) {
    if (!player || !isFlatFlowerDimension(player.dimension)) {
      continue;
    }

    if (state.pendingEscapes.has(player.id)) {
      continue;
    }

    if (isNearGoldenFlower(player.id, player.location)) {
      system.run(() => {
        void escapePlayerFromFlatFlower(player).catch(() => {});
      });
    }
  }
}

async function enterFlatFlower(player) {
  if (!player) {
    return false;
  }

  if (isFlatFlowerDimension(player.dimension)) {
    return false;
  }

  try {
    await bootstrapFlatFlowerWorld();
  } catch (error) {
    // Terrain painting is best-effort for command entry. Teleport first, then
    // maintenance will repaint the loaded patches around the player.
  }

  const dimension = getFlatFlowerDimension();
  const entered = await verifiedPlayerTeleport(
    player,
    {
      x: ENTRY_CENTER.x,
      y: ENTRY_TELEPORT_Y,
      z: ENTRY_CENTER.z,
    },
    {
      dimension,
      checkForBlocks: false,
      keepVelocity: false,
      facingLocation: addVec(ENTRY_CENTER, 1, 0, 0),
    },
    { attempts: 8, retryTicks: 4, maxDistance: 48 },
  );
  if (!entered) {
    return false;
  }

  system.run(() => {
    void ensureTerrainAroundLocation(ENTRY_CENTER, 1, { force: true }).catch(() => {});
  });

  return true;
}

function runFlatFlowerEntryCommand(player) {
  void enterFlatFlower(player).then((entered) => {
    if (!entered) {
      try {
        player.sendMessage("Flat_Flower entry failed. Try again in a moment.");
      } catch (error) {}
    }
  }).catch((error) => {
    try {
      player.sendMessage(`Flat_Flower entry failed: ${String(error)}`);
    } catch (_error) {}
  });
}


function getCommandSourcePlayer(origin) {
  const candidates = [
    origin && origin.sourceEntity,
    origin && origin.initiator,
    origin && origin.source,
  ];

  for (const candidate of candidates) {
    if (candidate && candidate.typeId === "minecraft:player") {
      return candidate;
    }
  }

  try {
    const players = world.getPlayers();
    return players.length === 1 ? players[0] : undefined;
  } catch (_error) {
    return undefined;
  }
}

function registerStartupHooks(event) {
  try {
    event.dimensionRegistry.registerCustomDimension(DIMENSION_ID);
  } catch (error) {
    // Already registered during a previous reload.
  }

  try {
    event.customCommandRegistry.registerCommand(
      {
        name: ENTER_COMMAND_ID,
        description: "Enter the Flat_Flower dimension",
        permissionLevel: CommandPermissionLevel.Any,
        cheatsRequired: false,
        mandatoryParameters: [],
        optionalParameters: [],
      },
      (origin) => {
        system.run(() => {
          const source = getCommandSourcePlayer(origin);
          if (!source || source.typeId !== "minecraft:player") {
            return;
          }
          runFlatFlowerEntryCommand(source);
        });

        return {
          status: CustomCommandStatus.Success,
          message: "Entering Flat_Flower...",
        };
      },
    );
  } catch (error) {
    // Ignore duplicate command registration during reloads.
  }
}

function handleChatEnterCommand(event) {
  const message = String(event.message || "").trim().toLowerCase();
  if (message !== CHAT_ENTER_COMMAND) {
    return;
  }

  event.cancel = true;

  system.run(() => {
    const sender = event.sender;
    if (!sender || sender.typeId !== "minecraft:player") {
      return;
    }

    try {
      sender.sendMessage("Entering Flat_Flower...");
    } catch (error) {
      // Ignore chat feedback failures.
    }

    runFlatFlowerEntryCommand(sender);
  });
}

world.afterEvents.worldLoad.subscribe(() => {
  system.run(() => {
    void bootstrapFlatFlowerWorld().catch(() => {});
  });
});

world.afterEvents.playerDimensionChange.subscribe(handlePlayerDimensionChange);
world.afterEvents.playerLeave.subscribe((event) => clearStateForLeavingPlayer(event.playerId));
world.afterEvents.playerInteractWithBlock.subscribe(handlePlayerInteractWithBlock);
world.beforeEvents.playerBreakBlock.subscribe(handlePlayerBreakBlock);
world.afterEvents.playerPlaceBlock.subscribe(handlePlayerPlaceBlock);
world.afterEvents.blockExplode.subscribe(handleBlockExplode);
world.beforeEvents.chatSend.subscribe(handleChatEnterCommand);
world.afterEvents.entitySpawn.subscribe(handleEntitySpawn);

system.beforeEvents.startup.subscribe(registerStartupHooks);

system.run(() => {
  void bootstrapFlatFlowerWorld().catch(() => {});
});

system.runInterval(() => {
  void maintainFlatFlowerWorld().catch(() => {});
}, MAINTENANCE_INTERVAL_TICKS);

system.runInterval(() => {
  handleFlowerProximity();
}, PROXIMITY_CHECK_TICKS);

export { enterFlatFlower };
