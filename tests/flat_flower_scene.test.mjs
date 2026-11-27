import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  SCENE_BOUNDS,
  SCENE_FLOWERS,
  SCENE_GARDEN_PROPS,
  SCENE_GROUND,
  SCENE_LANDMARKS,
  SCENE_LANDMARK_DRESS,
  SCENE_MARKERS,
  SCENE_PATHS,
  SCENE_STRUCTURE_SIZES,
  SCENE_ZONES,
  inRect,
  inScene,
  isAuthoredScenePatch,
  isScenePath,
  landmarkInPatch,
  markerTopY,
  sceneFlower,
  sceneGround,
  sceneRoll,
  sceneStructurePatches,
  unreservedPatchRectangles,
} from "../addon/BP/scripts/flat_flower_scene.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test("every scene path keeps a two-block clear walk", () => {
  for (const rect of SCENE_PATHS) {
    const [minX, maxX, minZ, maxZ] = rect;
    const width = maxX - minX + 1;
    const depth = maxZ - minZ + 1;
    assert.ok(width >= 2 || depth >= 2, `path ${rect} is only one block wide`);
    assert.ok(maxX <= SCENE_BOUNDS.maxX && maxZ <= SCENE_BOUNDS.maxZ, `path ${rect} leaves the scene`);
  }
});

test("the authored scene keeps three blocks of margin around the travel pad", () => {
  const pad = { x: 0, z: 10 };
  for (const [minX, maxX, minZ, maxZ] of SCENE_PATHS) {
    const dx = Math.max(minX - pad.x, 0, pad.x - maxX);
    const dz = Math.max(minZ - pad.z, 0, pad.z - maxZ);
    const distance = Math.max(dx, dz);
    assert.ok(distance >= 3, `path ${[minX, maxX, minZ, maxZ]} is ${distance} blocks from the pad`);
  }
});

test("scene ground follows paths first, then the zone weights", () => {
  assert.equal(sceneGround(-1, 2), null);
  assert.equal(sceneGround(0, 100), null);

  for (const [minX, maxX, minZ, maxZ] of SCENE_PATHS.slice(0, 4)) {
    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        assert.equal(sceneGround(x, z), SCENE_GROUND.path, `(${x},${z}) should be footpath`);
      }
    }
  }

  const seen = new Set();
  for (let x = 0; x <= 55; x++) {
    for (let z = 2; z <= 53; z++) {
      if (!isScenePath(x, z)) seen.add(sceneGround(x, z));
    }
  }
  assert.deepEqual(
    [...seen].sort(),
    [SCENE_GROUND.bare, SCENE_GROUND.dry, SCENE_GROUND.flattened, SCENE_GROUND.shortGrass, SCENE_FLOWERS.barePatch].sort(),
  );
});

test("flower-bed soil is a Y64 tile and row gaps stay empty at Y65", () => {
  assert.equal(sceneGround(24, 30), SCENE_FLOWERS.barePatch);
  assert.equal(sceneFlower(24, 30), null);
  assert.equal(sceneGround(46, 26), SCENE_FLOWERS.barePatch);
  assert.equal(sceneFlower(46, 26), null);
  assert.equal(sceneFlower(45, 26), SCENE_FLOWERS.rows);
});

test("authored paths form one connected two-wide route to every branch", () => {
  const cells = new Set();
  for (const [minX, maxX, minZ, maxZ] of SCENE_PATHS) {
    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) cells.add(`${x}:${z}`);
    }
  }
  const reached = new Set(["0:3"]);
  const pending = [[0, 3]];
  for (let i = 0; i < pending.length; i++) {
    const [x, z] = pending[i];
    for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const key = `${x + dx}:${z + dz}`;
      if (cells.has(key) && !reached.has(key)) {
        reached.add(key);
        pending.push([x + dx, z + dz]);
      }
    }
  }
  assert.equal(reached.size, cells.size);
  assert.ok(reached.has("37:22"), "north branch reaches true marker");
  assert.ok(reached.has("18:44"), "west decoy branch reaches its marker");
  assert.ok(reached.has("55:41"), "east decoy branch reaches its marker");
});

test("fixed structures fit their loaded owner patch and own unchanged sizes", () => {
  assert.deepEqual(SCENE_STRUCTURE_SIZES, {
    "paradise:flat_flower/ruined_gazebo": [12, 8, 12],
    "paradise:flat_flower/lone_tree": [11, 12, 11],
    "paradise:flat_flower/flower_ring": [9, 2, 9],
    "paradise:flat_flower/distant_marker": [7, 11, 7],
  });
  for (const landmark of SCENE_LANDMARKS) {
    assert.deepEqual(sceneStructurePatches(landmark), [
      `${Math.floor(landmark.x / 32)}:${Math.floor(landmark.z / 32)}`,
    ]);
  }
  assert.equal(isAuthoredScenePatch(0, 0), true);
  assert.equal(isAuthoredScenePatch(1, 1), true);
  assert.equal(isAuthoredScenePatch(2, 1), false);
});

test("pad partitions preserve the plate, 3x3 area and native sign without other holes", () => {
  for (const centers of [[], [{ x: 10, z: 10 }], [{ x: 0, z: 10 }, { x: 31, z: 29 }]]) {
    const rects = unreservedPatchRectangles(0, 0, 31, 31, centers);
    const painted = new Set();
    for (const [minX, maxX, minZ, maxZ] of rects) {
      for (let x = minX; x <= maxX; x++) {
        for (let z = minZ; z <= maxZ; z++) {
          const key = `${x}:${z}`;
          assert.equal(painted.has(key), false, `duplicate paint at ${key}`);
          painted.add(key);
        }
      }
    }
    for (let x = 0; x < 32; x++) {
      for (let z = 0; z < 32; z++) {
        const protectedCell = centers.some(({ x: cx, z: cz }) =>
          (Math.abs(x - cx) <= 1 && Math.abs(z - cz) <= 1) || (x === cx && z === cz + 2));
        assert.equal(painted.has(`${x}:${z}`), !protectedCell, `cell ${x}:${z}`);
      }
    }
  }
});

test("the authored garden and landmark dressing reference registered assets", () => {
  for (const prop of [...SCENE_GARDEN_PROPS, ...SCENE_LANDMARK_DRESS]) {
    assert.ok(existsSync(path.join(ROOT, "addon/BP/blocks", `paradise__${prop.block.slice("paradise:".length)}.json`)), prop.block);
  }
  const spots = SCENE_GARDEN_PROPS.map((prop) => `${prop.block}@${prop.x},${prop.y},${prop.z}`);
  assert.ok(spots.includes("paradise:ff_abandoned_bench@14,65,28"));
  assert.ok(spots.includes("paradise:ff_standalone_garden_gate@8,65,17"));
  assert.ok(spots.includes("paradise:ff_rusted_watering_can_x0_y0_z0@13,65,29"));
  assert.equal(spots.some((spot) => spot.includes("@20,65,45")), false, "west path stays clear");
});

test("all authored field-ground and bare-patch blocks retain collision", () => {
  for (const identifier of [...Object.values(SCENE_GROUND), SCENE_FLOWERS.barePatch]) {
    const fileName = `${identifier.replace("paradise:", "paradise__")}.json`;
    const definition = JSON.parse(readFileSync(path.join(ROOT, "addon/BP/blocks", fileName), "utf8"));
    assert.equal(
      definition["minecraft:block"].components["minecraft:collision_box"],
      true,
      `${identifier} must remain collidable`,
    );
  }
});

test("no flower or debris sits on a scene path", () => {
  for (const [minX, maxX, minZ, maxZ] of SCENE_PATHS) {
    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        assert.equal(sceneFlower(x, z), null, `(${x},${z}) must stay walkable`);
      }
    }
  }
});

test("dense and sparse plots follow the documented percentages", () => {
  const count = (rect, predicate) => {
    let total = 0;
    let hits = 0;
    for (let x = rect[0]; x <= rect[1]; x++) {
      for (let z = rect[2]; z <= rect[3]; z++) {
        if (isScenePath(x, z)) continue;
        total += 1;
        if (predicate(x, z)) hits += 1;
      }
    }
    return { total, hits };
  };

  const dense = count(SCENE_ZONES.dense, (x, z) => sceneFlower(x, z) === SCENE_FLOWERS.dense);
  assert.ok(dense.total > 100);
  assert.ok(dense.hits / dense.total > 0.6, `dense coverage ${dense.hits}/${dense.total}`);

  const sparse = count(SCENE_ZONES.sparse, (x, z) => sceneFlower(x, z) === SCENE_FLOWERS.sparse);
  assert.ok(sparse.hits / sparse.total > 0.18 && sparse.hits / sparse.total < 0.32, "sparse band stays near 25%");

  const bent = count(SCENE_ZONES.sparse, (x, z) => sceneFlower(x, z) === SCENE_FLOWERS.bent);
  const wilted = count(SCENE_ZONES.sparse, (x, z) => sceneFlower(x, z) === SCENE_FLOWERS.wilted);
  assert.ok(bent.hits > 0 && bent.hits / bent.total < 0.2);
  assert.ok(wilted.hits > 0 && wilted.hits / wilted.total < 0.12);

  const rows = count(SCENE_ZONES.rows, (x, z) => sceneFlower(x, z) === SCENE_FLOWERS.rows);
  assert.ok(rows.hits > 0);
  for (const [x, maxX, z, maxZ] of [[45, 53, 26, 26], [45, 53, 29, 29], [45, 53, 32, 32]]) {
    for (let i = x; i <= maxX; i++) {
      for (let j = z; j <= maxZ; j++) {
        if ((i - 45) % 3 === 0) {
          assert.equal(sceneFlower(i, j), SCENE_FLOWERS.rows, `row flower at (${i},${j})`);
        } else {
          assert.notEqual(sceneFlower(i, j), SCENE_FLOWERS.rows, `empty soil at (${i},${j})`);
        }
      }
    }
  }
});

test("the scene hash is deterministic and bounded", () => {
  assert.equal(sceneRoll(12, 30), sceneRoll(12, 30));
  assert.notEqual(sceneRoll(12, 30), sceneRoll(13, 30));
  for (let x = 0; x < 20; x++) {
    for (let z = 0; z < 20; z++) {
      const roll = sceneRoll(x, z);
      assert.ok(Number.isInteger(roll) && roll >= 0 && roll < 100);
    }
  }
  assert.equal(inScene(0, 2), true);
  assert.equal(inScene(56, 2), false);
  assert.equal(inRect(3, 20, SCENE_ZONES.dense), true);
});

test("one true marker and two equal-post decoys, each in its own patch", () => {
  assert.equal(SCENE_MARKERS.filter((marker) => marker.trueRoute).length, 1);
  assert.equal(SCENE_MARKERS.length, 3);
  assert.deepEqual(
    SCENE_MARKERS.map((marker) => [marker.x, marker.z]),
    [[38, 22], [18, 43], [55, 42]],
  );
  assert.equal(new Set(SCENE_MARKERS.map((marker) => marker.segments[1])).size, 3);

  const patchOf = (value) => Math.floor(value / 32);
  const patches = SCENE_MARKERS.map((marker) => [patchOf(marker.x), patchOf(marker.z)]);
  assert.equal(new Set(patches.map((patch) => patch.join(","))).size, 3);
});

test("scene landmarks are placed by the patch that owns each anchor", () => {
  assert.deepEqual(SCENE_LANDMARKS.map((landmark) => landmark.id), [
    "paradise:flat_flower/ruined_gazebo",
    "paradise:flat_flower/lone_tree",
    "paradise:flat_flower/flower_ring",
    "paradise:flat_flower/distant_marker",
  ]);
  for (const landmark of SCENE_LANDMARKS) {
    const patchX = Math.floor(landmark.x / 32) * 32;
    const patchZ = Math.floor(landmark.z / 32) * 32;
    assert.equal(landmarkInPatch(landmark, patchX, patchZ, patchX + 31, patchZ + 31), true);
    assert.equal(landmarkInPatch(landmark, patchX + 32, patchZ, patchX + 63, patchZ + 31), false);
  }
});

test("one true route marker and two equal-height decoys use both segments", () => {
  assert.equal(SCENE_MARKERS.length, 3);
  assert.equal(SCENE_MARKERS.filter((marker) => marker.trueRoute).length, 1);
  for (const marker of SCENE_MARKERS) {
    assert.equal(marker.segments.length, 2);
    assert.equal(markerTopY(65), 66);
    for (const id of marker.segments) {
      assert.ok(existsSync(path.join(ROOT, "addon/BP/blocks", `paradise__${id.replace("paradise:", "")}.json`)), id);
    }
  }
  const heads = new Set(SCENE_MARKERS.map((marker) => marker.segments[1]));
  assert.equal(heads.size, 3, "each marker owns a distinct head silhouette");
});

test("garden remnants sit off the two-block footpaths and exist as blocks", () => {
  assert.ok(SCENE_GARDEN_PROPS.length >= 8);
  for (const prop of SCENE_GARDEN_PROPS) {
    assert.equal(isScenePath(prop.x, prop.z), false, `${prop.block} blocks a path at ${prop.x},${prop.z}`);
    assert.equal(inScene(prop.x, prop.z), true);
    assert.ok(existsSync(path.join(ROOT, "addon/BP/blocks", `paradise__${prop.block.replace("paradise:", "")}.json`)), prop.block);
  }
});
