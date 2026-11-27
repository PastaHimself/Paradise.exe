import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";

import {
  SCENE_GARDEN_PROPS,
  SCENE_LANDMARKS,
  SCENE_LANDMARK_DRESS,
  SCENE_MARKERS,
  SCENE_PATHS,
  SCENE_STRUCTURE_SIZES,
  isAuthoredScenePatch,
  isScenePath,
  landmarkInPatch,
  sceneFlower,
  sceneGround,
  sceneStructurePatches,
  unreservedPatchRectangles,
} from "../addon/BP/scripts/flat_flower_scene.js";

const source = readFileSync(new URL("../addon/BP/scripts/flat_flower.js", import.meta.url), "utf8");

const nativeStructureSource = String.raw`
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(sys.argv[1]) / 'tools'))
from validate_mcstructures import LittleEndianNBTReader
structures = {}
for landmark, name in (
    ('paradise:flat_flower/ruined_gazebo', 'ruined_gazebo'),
    ('paradise:flat_flower/lone_tree', 'lone_tree'),
    ('paradise:flat_flower/flower_ring', 'flower_ring'),
    ('paradise:flat_flower/distant_marker', 'distant_marker'),
):
    path = Path(sys.argv[1]) / 'addon/BP/structures/paradise/flat_flower' / (name + '.mcstructure')
    root = LittleEndianNBTReader(path.read_bytes()).read_root()
    sx, sy, sz = root['size']
    raw = root['structure']
    indices = raw['block_indices'][0]
    palette = [item['name'] for item in raw['palette']['default']['block_palette']]
    cells = []
    for x in range(sx):
        for y in range(sy):
            for z in range(sz):
                index = indices[(x * sy + y) * sz + z]
                block = palette[index] if index >= 0 else 'minecraft:structure_void'
                if block not in ('minecraft:structure_void', 'minecraft:air'):
                    cells.append([x, y, z, block])
    structures[landmark] = cells
print(json.dumps(structures))
`;

const nativeStructureCells = JSON.parse(execFileSync("python3", [
  "-c",
  nativeStructureSource,
  fileURLToPath(new URL("..", import.meta.url)),
], { encoding: "utf8" }));

function functionSource(name) {
  const header = new RegExp(`^(?:async\\s+)?function\\s+${name}\\s*\\(`, "m");
  const match = header.exec(source);
  assert.ok(match, `${name} must exist in the running generator`);
  const next = /^(?:async\s+)?function\s+\w+\s*\(/gm;
  next.lastIndex = match.index + match[0].length;
  const following = next.exec(source);
  return source.slice(match.index, following ? following.index : source.length);
}

const generatorFunctions = [
  "getPatchBounds",
  "isPadReserved",
  "collectPadReservations",
  "collectPadReservationsForPoints",
  "fillUnreservedPatch",
  "placeSparseLightAnchors",
  "scheduleFlatFlowerLandmark",
  "paintSceneColumn",
  "placeScenePiece",
  "placeSceneAnchors",
  "paintPatch",
];

function createFixture({ delayedStructures = false, ambientHash = 1 } = {}) {
  const blocks = new Map();
  const writes = [];
  const structures = [];
  const pendingStructures = [];
  const tickingAreas = new Set();
  const blockQueries = [];
  const state = { patchVersions: new Map() };
  let releaseStructures;
  const structureGate = delayedStructures
    ? new Promise((resolve) => { releaseStructures = resolve; })
    : Promise.resolve();

  function key(location) {
    return `${location.x}:${location.y}:${location.z}`;
  }

  function blockType(location) {
    return blocks.get(key(location)) ?? "minecraft:air";
  }

  const dimension = {
    id: "paradise:flat_flower",
    getBlock(location) {
      return {
        typeId: blockType(location),
        setPermutation(permutation) {
          writes.push({ kind: "prop", location: { ...location }, typeId: permutation.typeId });
          blocks.set(key(location), permutation.typeId);
        },
      };
    },
    getBlocks(volume, options) {
      blockQueries.push({
        from: { ...volume.from },
        to: { ...volume.to },
        includeTypes: [...options.includeTypes],
      });
      const locations = [];
      for (let x = volume.from.x; x <= volume.to.x; x++) {
        for (let y = volume.from.y; y <= volume.to.y; y++) {
          for (let z = volume.from.z; z <= volume.to.z; z++) {
            if (options.includeTypes.includes(blockType({ x, y, z }))) {
              locations.push({ x, y, z });
            }
          }
        }
      }
      return { getBlockLocationIterator: () => locations[Symbol.iterator]() };
    },
    setBlockType(location, typeId) {
      blocks.set(key(location), typeId);
    },
    fillBlocks(volume, typeId) {
      for (let x = volume.from.x; x <= volume.to.x; x++) {
        for (let z = volume.from.z; z <= volume.to.z; z++) {
          for (let y = volume.from.y; y <= volume.to.y; y++) {
            this.setBlockType({ x, y, z }, typeId);
          }
        }
      }
    },
  };

  const scheduleStructurePlacement = async (jobKey, structureId, target, location, options) => {
    assert.ok(tickingAreas.size > 0, "structure placement must hold its ticking area");
    if (!options.isPlacementAllowed()) return false;
    pendingStructures.push({ jobKey, structureId, location });
    await structureGate;
    if (!options.isPlacementAllowed()) return false;
    structures.push({ jobKey, structureId, location });
    writes.push({ kind: "structure", structureId, location });
    for (const [x, y, z, typeId] of nativeStructureCells[structureId] ?? []) {
      target.setBlockType({ x: location.x + x, y: location.y + y, z: location.z + z }, typeId);
    }
    return true;
  };

  const context = {
    state,
    ENTRY_CENTER: { x: 0, y: 64, z: 0 },
    GROUND_Y: 64,
    FLOWER_Y: 65,
    AIR_TOP_Y: 67,
    LIGHT_Y: 68,
    PAD_SCAN_MIN_Y: 64,
    PAD_SCAN_FILL_MAX_Y: 69,
    PAD_SCAN_STRUCTURE_MAX_Y: 77,
    PAD_SCAN_DRESS_MAX_Y: 72,
    PAD_SCAN_DECORATION_MAX_Y: 67,
    PATCH_SIZE: 32,
    MAX_LIGHT_ANCHORS_PER_PATCH: 8,
    DIMENSION_ID: dimension.id,
    WORLD_GENERATION_SEED: 0,
    FLAT_FLOWER_MODULES: SCENE_LANDMARKS.map((landmark) => landmark.id),
    BlockPermutation: { resolve: (typeId, states) => ({ typeId, states }) },
    BlockVolume: class {
      constructor(from, to) { this.from = from; this.to = to; }
    },
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
    getPatchKey: (x, z) => `${x}:${z}`,
    patchHasSpecialFlowerSite: () => false,
    visualHashCoords: () => ambientHash,
    setBlockSafe: (target, location, block) => { target.setBlockType(location, block); return true; },
    shouldPlaceRedFlower: () => false,
    getFieldFlowerBlock: () => "minecraft:poppy",
    applySpecialSitesForPatch: () => {},
    scheduleStructurePlacement,
    withTickingArea: async (_target, areaId, _from, _to, work) => {
      tickingAreas.add(areaId);
      try { return await work(); } finally { tickingAreas.delete(areaId); }
    },
  };
  const exported = runInNewContext(
    `${generatorFunctions.map(functionSource).join("\n")}\n({ paintPatch });`,
    context,
  );

  async function paint(patchX, patchZ, token = 1) {
    state.patchVersions.set(`${patchX}:${patchZ}`, token);
    await exported.paintPatch(dimension, patchX, patchZ, { token });
  }

  return {
    blockType,
    blockQueries,
    blocks,
    dimension,
    paint,
    pendingStructures,
    releaseStructures,
    state,
    structures,
    tickingAreas,
    writes,
  };
}

function addPad(fixture, x, anchorY, z) {
  fixture.dimension.setBlockType({ x, y: anchorY - 1, z }, "minecraft:stone_bricks");
  fixture.dimension.setBlockType({ x, y: anchorY, z }, "minecraft:stone_pressure_plate");
  fixture.dimension.setBlockType({ x, y: anchorY, z: z + 2 }, "minecraft:oak_sign");
}

describe("Flat Flower actual static patch generator", () => {
  it("paints the prescribed path, preserves native pads and dresses after the gazebo structure", async () => {
    const fixture = createFixture();
    fixture.dimension.setBlockType({ x: 13, y: 65, z: 13 }, "minecraft:stone_pressure_plate");
    fixture.dimension.setBlockType({ x: 13, y: 65, z: 15 }, "minecraft:oak_sign");
    fixture.dimension.setBlockType({ x: 13, y: 64, z: 13 }, "minecraft:stone_bricks");
    fixture.dimension.setBlockType({ x: 27, y: 66, z: 6 }, "minecraft:stone_pressure_plate");
    fixture.dimension.setBlockType({ x: 27, y: 66, z: 8 }, "minecraft:oak_sign");
    fixture.dimension.setBlockType({ x: 27, y: 65, z: 6 }, "minecraft:stone_bricks");
    await fixture.paint(0, 0);

    assert.equal(fixture.blockType({ x: 4, y: 64, z: 8 }), "paradise:ff_field_ground_worn_footpath");
    assert.equal(fixture.blockType({ x: 5, y: 64, z: 14 }), "paradise:ff_field_ground_worn_footpath");
    assert.equal(fixture.blockType({ x: 13, y: 65, z: 13 }), "minecraft:stone_pressure_plate");
    assert.equal(fixture.blockType({ x: 13, y: 65, z: 15 }), "minecraft:oak_sign");
    assert.equal(fixture.blockType({ x: 13, y: 64, z: 13 }), "minecraft:stone_bricks");
    assert.equal(fixture.blockType({ x: 27, y: 66, z: 6 }), "minecraft:stone_pressure_plate", "Y66 travel plate survives");
    assert.equal(fixture.blockType({ x: 27, y: 66, z: 8 }), "minecraft:oak_sign", "Y66 native pad sign survives");
    assert.equal(fixture.blockType({ x: 27, y: 65, z: 6 }), "minecraft:stone_bricks", "Y65 pad support survives");
    assert.equal(fixture.blockType({ x: 0, y: 64, z: 10 }), sceneGround(0, 10), "unpainted pads do not leave ground holes");
    assert.equal(fixture.blockType({ x: 13, y: 65, z: 19 }), "minecraft:smooth_quartz", "native post foot is preserved");
    assert.equal(fixture.blockType({ x: 13, y: 66, z: 19 }), "minecraft:spruce_log", "native post remains supported");
    assert.equal(fixture.blockType({ x: 14, y: 65, z: 28 }), "paradise:ff_abandoned_bench");
    assert.equal(fixture.structures.length, 1);
    assert.equal(fixture.structures[0].structureId, SCENE_LANDMARKS[0].id);
    assert.ok(fixture.writes.some((entry) => entry.kind === "prop"));
    const structureIndex = fixture.writes.findIndex((entry) => entry.kind === "structure");
    const firstPropIndex = fixture.writes.findIndex((entry) => entry.kind === "prop");
    assert.ok(structureIndex >= 0 && firstPropIndex > structureIndex, "scene dressing follows the landmark");
    assert.equal(fixture.tickingAreas.size, 0);
  });

  it("paints three static marker silhouettes on their own patches without ambient duplicates", async () => {
    const fixture = createFixture();
    await fixture.paint(1, 0);
    await fixture.paint(0, 1);
    await fixture.paint(1, 1);
    for (const marker of SCENE_MARKERS) {
      assert.equal(fixture.blockType({ x: marker.x, y: 65, z: marker.z }), marker.segments[0]);
      assert.equal(fixture.blockType({ x: marker.x, y: 66, z: marker.z }), marker.segments[1]);
    }
    assert.equal(fixture.structures.length, 3);
    assert.equal(fixture.blockType({ x: 36, y: 64, z: 22 }), "paradise:ff_field_ground_worn_footpath");
    assert.equal(fixture.blockType({ x: 18, y: 64, z: 44 }), "paradise:ff_field_ground_worn_footpath");
    assert.equal(fixture.blockType({ x: 55, y: 64, z: 41 }), "paradise:ff_field_ground_worn_footpath");
    assert.equal(fixture.blockType({ x: 20, y: 65, z: 45 }), "minecraft:air", "west route leaves no post");
    assert.equal(fixture.tickingAreas.size, 0);
  });

  it("keeps two-block walking strips open with native mcstructure masks applied", async () => {
    const fixture = createFixture();
    await fixture.paint(0, 0);
    await fixture.paint(1, 0);
    await fixture.paint(0, 1);
    await fixture.paint(1, 1);
    const nativeTreePerimeter = new Set(["32:65:36", "32:65:37"]);
    const walkablePath = new Set();
    for (const [minX, maxX, minZ, maxZ] of SCENE_PATHS) {
      for (let x = minX; x <= maxX; x++) {
        for (let z = minZ; z <= maxZ; z++) {
          for (const y of [65, 66]) {
            const key = `${x}:${y}:${z}`;
            assert.equal(fixture.blockType({ x, y, z }), "minecraft:air", `route blocked at ${x},${y},${z}`);
          }
          walkablePath.add(`${x}:${z}`);
        }
      }
    }
    for (const key of nativeTreePerimeter) {
      const [x, y, z] = key.split(":").map(Number);
      assert.equal(fixture.blockType({ x, y, z }), "minecraft:mossy_cobblestone");
      assert.equal(isScenePath(x, z), false, "the walkable path stops before the native tree wall");
    }
    for (const z of [39, 40]) {
      for (const y of [65, 66]) {
        assert.equal(
          fixture.blockType({ x: 32, y, z }),
          "minecraft:air",
          `the authored west entrance must remain open at 32,${y},${z}`,
        );
      }
    }

    const reached = new Set(["0:3"]);
    const pending = [[0, 3]];
    for (let index = 0; index < pending.length; index += 1) {
      const [x, z] = pending[index];
      for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const key = `${x + dx}:${z + dz}`;
        if (walkablePath.has(key) && !reached.has(key)) {
          reached.add(key);
          pending.push([x + dx, z + dz]);
        }
      }
    }
    assert.equal(reached.size, walkablePath.size, "native structure masks must not disconnect any route branch");
    assert.ok(reached.has("31:39"), "the two-wide approach reaches the tree's west entrance");

    // The west approach remains fully two-wide along the native tree perimeter.
    for (let z = 36; z <= 45; z++) {
      for (const x of [30, 31]) {
        for (const y of [65, 66]) {
          assert.equal(fixture.blockType({ x, y, z }), "minecraft:air", `west approach ${x},${y},${z}`);
        }
      }
    }
    assert.ok(walkablePath.size > 200);
  });

  it("repaints the same authored ground, markers and props on a repeated patch build", async () => {
    const fixture = createFixture();
    await fixture.paint(0, 0, 1);
    const initialCells = [...fixture.blocks].sort((a, b) => a[0].localeCompare(b[0]));
    await fixture.paint(0, 0, 2);
    assert.deepEqual([...fixture.blocks].sort((a, b) => a[0].localeCompare(b[0])), initialCells);
    assert.equal(fixture.structures.length, 2, "native landmark is refreshed only once per repaint");
  });

  it("retains exactly eight fixed Y68 light anchors on an ordinary patch and unchanged ambient offsets", async () => {
    const fixture = createFixture({ ambientHash: 16 });
    await fixture.paint(2, 0);
    const lights = [...fixture.blocks.entries()]
      .filter(([cell, typeId]) => cell.split(":")[1] === "68" && typeId === "minecraft:light_block_15")
      .map(([cell]) => cell);
    assert.deepEqual(lights.sort(), [
      "68:68:4", "68:68:12", "68:68:20", "68:68:28",
      "76:68:4", "76:68:12", "76:68:20", "76:68:28",
    ].sort());
    assert.equal(fixture.structures.length, 1);
    assert.equal(fixture.structures[0].structureId, SCENE_LANDMARKS[1].id);
    assert.equal(fixture.structures[0].location.x, 82);
    assert.equal(fixture.structures[0].location.z, 18);
    assert.equal(fixture.blockQueries.length, 4, "ordinary patches skip empty decoration scans");
  });

  it("protects pads created while a structure job is queued", async () => {
    const fixture = createFixture({ delayedStructures: true });
    const painting = fixture.paint(0, 0);
    for (let i = 0; i < 10 && fixture.pendingStructures.length === 0; i++) await Promise.resolve();
    assert.equal(fixture.pendingStructures.length, 1);
    fixture.dimension.setBlockType({ x: 13, y: 65, z: 19 }, "minecraft:stone_pressure_plate");
    fixture.dimension.setBlockType({ x: 13, y: 65, z: 21 }, "minecraft:oak_sign");
    fixture.releaseStructures();
    await painting;
    assert.equal(fixture.structures.length, 0, "native pad takes priority over overlapping landmark");
    assert.equal(fixture.blockType({ x: 13, y: 65, z: 19 }), "minecraft:stone_pressure_plate");
    assert.equal(fixture.blockType({ x: 13, y: 65, z: 21 }), "minecraft:oak_sign");
  });

  it("protects a Y64 pad from the ground fill and fixed landmark placement", async () => {
    const fixture = createFixture();
    addPad(fixture, 13, 64, 19);

    await fixture.paint(0, 0);

    assert.equal(fixture.blockType({ x: 13, y: 63, z: 19 }), "minecraft:stone_bricks");
    assert.equal(fixture.blockType({ x: 13, y: 64, z: 19 }), "minecraft:stone_pressure_plate");
    assert.equal(fixture.blockType({ x: 13, y: 64, z: 21 }), "minecraft:oak_sign");
    assert.equal(fixture.structures.some((entry) => entry.structureId === SCENE_LANDMARKS[0].id), false);
  });

  it("protects a Y69 pad support from the upper fill and fixed landmark placement", async () => {
    const fixture = createFixture();
    addPad(fixture, 13, 69, 19);

    await fixture.paint(0, 0);

    assert.equal(fixture.blockType({ x: 13, y: 68, z: 19 }), "minecraft:stone_bricks");
    assert.equal(fixture.blockType({ x: 13, y: 69, z: 19 }), "minecraft:stone_pressure_plate");
    assert.equal(fixture.blockType({ x: 13, y: 69, z: 21 }), "minecraft:oak_sign");
    assert.equal(fixture.structures.some((entry) => entry.structureId === SCENE_LANDMARKS[0].id), false);
  });

  it("rechecks the Y77 structure-volume boundary before a queued tree write", async () => {
    const fixture = createFixture({ delayedStructures: true });
    const painting = fixture.paint(1, 1);
    for (let i = 0; i < 10 && fixture.pendingStructures.length === 0; i++) await Promise.resolve();
    assert.equal(fixture.pendingStructures.length, 1);
    assert.equal(fixture.pendingStructures[0].structureId, SCENE_LANDMARKS[1].id);
    addPad(fixture, 34, 77, 39);

    fixture.releaseStructures();
    await painting;

    assert.equal(fixture.structures.some((entry) => entry.structureId === SCENE_LANDMARKS[1].id), false);
    assert.equal(fixture.structures.some((entry) => entry.structureId === SCENE_LANDMARKS[3].id), true);
    assert.equal(fixture.blockType({ x: 34, y: 76, z: 39 }), "minecraft:stone_bricks");
    assert.equal(fixture.blockType({ x: 34, y: 77, z: 39 }), "minecraft:stone_pressure_plate");
    assert.equal(fixture.blockType({ x: 34, y: 77, z: 41 }), "minecraft:oak_sign");
  });

  it("does not extend structure protection below Y64 or above Y77", async () => {
    const below = createFixture();
    addPad(below, 13, 63, 19);
    await below.paint(0, 0);
    assert.equal(below.structures.some((entry) => entry.structureId === SCENE_LANDMARKS[0].id), true);
    assert.equal(below.blockType({ x: 13, y: 62, z: 19 }), "minecraft:stone_bricks");
    assert.equal(below.blockType({ x: 13, y: 63, z: 19 }), "minecraft:stone_pressure_plate");
    assert.equal(below.blockType({ x: 13, y: 63, z: 21 }), "minecraft:oak_sign");

    const above = createFixture();
    addPad(above, 34, 78, 39);
    await above.paint(1, 1);
    assert.equal(above.structures.some((entry) => entry.structureId === SCENE_LANDMARKS[1].id), true);
    assert.equal(above.blockType({ x: 34, y: 77, z: 39 }), "minecraft:stone_bricks");
    assert.equal(above.blockType({ x: 34, y: 78, z: 39 }), "minecraft:stone_pressure_plate");
    assert.equal(above.blockType({ x: 34, y: 78, z: 41 }), "minecraft:oak_sign");
  });

  it("protects a pad re-anchored into a queued ambient tree footprint", async () => {
    const fixture = createFixture({ delayedStructures: true, ambientHash: 16 });
    const painting = fixture.paint(2, 0);
    for (let i = 0; i < 10 && fixture.pendingStructures.length === 0; i++) await Promise.resolve();
    assert.equal(fixture.pendingStructures.length, 1);
    assert.equal(fixture.pendingStructures[0].structureId, SCENE_LANDMARKS[1].id);
    assert.equal(fixture.pendingStructures[0].location.x, 82);
    assert.equal(fixture.pendingStructures[0].location.y, 65);
    assert.equal(fixture.pendingStructures[0].location.z, 18);
    addPad(fixture, 85, 76, 23);

    fixture.releaseStructures();
    await painting;

    assert.equal(fixture.structures.length, 0, "the pad cancels the queued ambient tree without failing the patch");
    assert.equal(fixture.blockType({ x: 85, y: 75, z: 23 }), "minecraft:stone_bricks");
    assert.equal(fixture.blockType({ x: 85, y: 76, z: 23 }), "minecraft:stone_pressure_plate");
    assert.equal(fixture.blockType({ x: 85, y: 76, z: 25 }), "minecraft:oak_sign");
    assert.equal(fixture.tickingAreas.size, 0);
  });

  it("uses bounded native pressure-plate queries instead of repeated full-patch scans", async () => {
    const fixture = createFixture();
    await fixture.paint(0, 0);

    assert.equal(fixture.blockQueries.length, 6, "one fill, three fresh structure checks, one dress scan and one local decoration scan");
    assert.deepEqual(fixture.blockQueries[0], {
      from: { x: -1, y: 64, z: -2 },
      to: { x: 32, y: 69, z: 32 },
      includeTypes: ["minecraft:stone_pressure_plate"],
    });
    for (const query of fixture.blockQueries.slice(1, 4)) {
      assert.deepEqual(query, {
        from: { x: 11, y: 64, z: 16 },
        to: { x: 24, y: 77, z: 30 },
        includeTypes: ["minecraft:stone_pressure_plate"],
      });
    }
    assert.deepEqual(fixture.blockQueries[4], {
      from: { x: 12, y: 64, z: 17 },
      to: { x: 24, y: 72, z: 29 },
      includeTypes: ["minecraft:stone_pressure_plate"],
    });
    assert.deepEqual(fixture.blockQueries[5], {
      from: { x: 6, y: 64, z: 15 },
      to: { x: 23, y: 67, z: 31 },
      includeTypes: ["minecraft:stone_pressure_plate"],
    });
    const queryCellCount = fixture.blockQueries.reduce((total, query) => total
      + (query.to.x - query.from.x + 1)
      * (query.to.y - query.from.y + 1)
      * (query.to.z - query.from.z + 1), 0);
    assert.equal(queryCellCount, 18705, "bounded scan volumes retain the measured minimum query footprint");
    assert.ok(fixture.blockQueries.every((query) => query.to.x - query.from.x < 36));
    assert.ok(fixture.blockQueries.every((query) => query.to.z - query.from.z < 36));
  });

  it("rejects delayed structure writes after a patch paint token changes", async () => {
    const fixture = createFixture({ delayedStructures: true });
    const first = fixture.paint(1, 1);
    for (let i = 0; i < 10 && fixture.pendingStructures.length === 0; i++) await Promise.resolve();
    assert.equal(fixture.pendingStructures.length, 1);
    fixture.state.patchVersions.set("1:1", 2);
    fixture.releaseStructures();
    await assert.rejects(first, /structure placement failed/);
    assert.equal(fixture.structures.length, 0);
    assert.equal(fixture.writes.some((write) => write.kind === "prop"), false);
    assert.equal(fixture.tickingAreas.size, 0);
  });
});
