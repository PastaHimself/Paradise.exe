import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { registerHooks } from "node:module";

const queuedJobs = [];
const intervalCallbacks = new Map();
const blocks = new Map();
const generatedStructures = [];
const pregenAreas = [];
const removedAreas = [];
let loaded = true;

function key(x, y, z) {
  return `${x}:${y}:${z}`;
}

function blockType(x, y, z) {
  return blocks.get(key(x, y, z)) ?? "minecraft:air";
}

function createEvent() {
  return { subscribe() {} };
}

const dimension = {
  id: "library:the_library",
  getBlock({ x, y, z }) {
    if (!loaded) return undefined;
    return {
      get typeId() { return blockType(x, y, z); },
      setType(typeId) { blocks.set(key(x, y, z), typeId); },
      setPermutation(permutation) { blocks.set(key(x, y, z), permutation.typeId); },
    };
  },
  getPlayers() {
    return [{ id: "library-visitor", dimension, location: { x: 1000.5, y: 65, z: 0.5 } }];
  },
};

const context = {
  world: {
    getDimension(id) { return id === dimension.id ? dimension : undefined; },
    afterEvents: {
      worldLoad: createEvent(), playerDimensionChange: createEvent(), playerLeave: createEvent(),
      entitySpawn: createEvent(), entityDie: createEvent(), itemUse: createEvent(),
    },
    beforeEvents: { chatSend: createEvent() },
    tickingAreaManager: {
      createTickingArea(id) { pregenAreas.push(id); return Promise.resolve(); },
      removeTickingArea(id) { removedAreas.push(id); },
    },
  },
  system: {
    beforeEvents: { startup: createEvent() },
    run(callback) { callback(); },
    runTimeout(callback) { callback(); },
    runInterval(callback, ticks) { intervalCallbacks.set(ticks, callback); },
  },
  scheduleVisualJob(keyValue, factory, options) {
    queuedJobs.push({ key: keyValue, factory, options });
    return true;
  },
  scheduleStructurePlacement(keyValue, structureId, _dimension, location) {
    generatedStructures.push({ key: keyValue, structureId, location });
    return Promise.resolve(true);
  },
};

globalThis.__libraryGenerationTest = context;
const mocks = new Map([
  ["@minecraft/server", `
    export const BlockPermutation = { resolve: (typeId) => ({ typeId }) };
    export class BlockVolume { constructor(from, to) { this.from = from; this.to = to; } }
    export const CommandPermissionLevel = {};
    export const CustomCommandStatus = { Success: "success" };
    export const GameMode = { Survival: "survival" };
    export class ItemStack { constructor() {} setLore() {} }
    export const world = globalThis.__libraryGenerationTest.world;
    export const system = globalThis.__libraryGenerationTest.system;
  `],
  ["./dimension_horror_rules.js", `
    export const VHS_TIER = {};
    export const canTrigger = () => false;
    export const clearRuleState = () => undefined;
    export const getOrCreateRuleState = () => ({});
    export const makeNoteItem = () => ({});
    export const requestRuleVhs = () => false;
    export const tryBeginRuleScare = () => ({ allowed: false });
    export const safeAddEffect = () => false;
    export const safePlaySound = () => false;
    export const safeTitle = () => false;
    export const sampleMotion = () => ({ horizontalSpeed: 0, dy: 0, dt: 1 });
    export const verifiedPlayerTeleport = async () => true;
    export const setStandingSign = () => true;
  `],
  ["./paradise_tick_cache.js", "export const getCachedPlayers = () => [];"],
  ["./paradise_visual_jobs.js", `
    export const hashCoords = (x, z) => (Math.abs(x + z) + 1) >>> 0;
    export const scheduleVisualJob = (...args) => globalThis.__libraryGenerationTest.scheduleVisualJob(...args);
    export const scheduleStructurePlacement = (...args) => globalThis.__libraryGenerationTest.scheduleStructurePlacement(...args);
  `],
]);

const hooks = registerHooks({
  resolve(specifier, parent, nextResolve) {
    if (!mocks.has(specifier)) return nextResolve(specifier, parent);
    return {
      url: `data:text/javascript;charset=utf-8,${encodeURIComponent(mocks.get(specifier))}`,
      shortCircuit: true,
    };
  },
});
await import("../addon/BP/scripts/library.js?library-generation-test");
hooks.deregister();

function runGenerationJobs() {
  let totalYields = 0;
  let totalJobs = 0;
  while (queuedJobs.length > 0) {
    const job = queuedJobs.shift();
    const generator = job.factory({ isCancelled: () => false });
    for (let result = generator.next(); !result.done; result = generator.next()) {
      totalYields += 1;
    }
    totalJobs += 1;
  }
  return { totalJobs, totalYields };
}

describe("Library chunk generation", () => {
  it("retries unloaded chunks, generates only once, and yields across spatial slices", () => {
    const generateTick = intervalCallbacks.get(2);
    assert.equal(typeof generateTick, "function");

    loaded = false;
    generateTick();
    assert.equal(queuedJobs.length, 9);
    generateTick();
    assert.equal(queuedJobs.length, 9, "pending requests must remain single-flight");
    assert.deepEqual(runGenerationJobs(), { totalJobs: 9, totalYields: 0 });

    loaded = true;
    blocks.set(key(1008, 65, 0), "minecraft:stone_pressure_plate");
    blocks.set(key(1008, 65, 2), "minecraft:oak_sign");
    generateTick();
    assert.equal(queuedJobs.length, 9);
    const result = runGenerationJobs();
    assert.equal(result.totalJobs, 9);
    assert.ok(result.totalYields >= 9 * 10, String(result.totalYields));
    generateTick();
    assert.equal(queuedJobs.length, 0, "completed chunks must not enqueue again");
  });

  it("retains pad blocks and arrival bookshelf anchors while clearing the public cross", () => {
    assert.equal(blockType(1008, 65, 0), "minecraft:stone_pressure_plate");
    assert.equal(blockType(1008, 65, 2), "minecraft:oak_sign");
    for (const [x, z] of [[3, 2], [11, 2], [11, 9]]) {
      assert.equal(blockType(992 + x, 65, z), "minecraft:bookshelf");
    }
    for (const [cx, cz] of [[62, -1], [62, 0], [63, 0], [61, 0]]) {
      const ox = cx * 16;
      const oz = cz * 16;
      for (let i = 0; i < 16; i += 1) {
        for (const [x, z] of [[7, i], [8, i], [i, 7], [i, 8]]) {
          const type = blockType(ox + x, 66, oz + z);
          assert.equal(type, "minecraft:air", `${cx}:${cz} ${x}:66:${z} ${type}`);
        }
      }
    }
  });

  it("keeps the restricted archive reserve empty and mounts permanent lit anchors", () => {
    const ox = 63 * 16;
    for (let x = 10; x <= 13; x += 1) {
      for (let z = 12; z <= 14; z += 1) {
        assert.equal(blockType(ox + x, 64, z), "minecraft:polished_deepslate");
        for (let y = 65; y <= 68; y += 1) {
          assert.equal(blockType(ox + x, y, z), "minecraft:air", `${x}:${y}:${z}`);
        }
      }
    }
    assert.equal(blockType(ox + 9, 65, 10), "paradise:lib_restricted_archive_gate_x0_y0_z0");
    assert.equal(blockType(ox + 14, 65, 10), "paradise:lib_restricted_archive_gate_x0_y0_z0");
    for (let x = 11; x <= 12; x += 1) {
      for (let z = 9; z <= 11; z += 1) {
        for (let y = 65; y <= 67; y += 1) {
          assert.equal(blockType(ox + x, y, z), "minecraft:air", `${x}:${y}:${z} must remain passable`);
        }
      }
    }
    for (const [x, z] of [[4, 4], [11, 11], [10, 13]]) {
      assert.equal(blockType(ox + x, 73, z), "minecraft:glowstone");
    }
    assert.ok(generatedStructures.some((entry) => entry.structureId === "paradise:library/archive_frame"
      && entry.location.x === ox + 8 && entry.location.z === 13));
  });

  it("places west room shelves on x2/x6 and never fills the three-block aisle", () => {
    const ox = 61 * 16;
    assert.equal(blockType(ox + 2, 65, 3), "paradise:lib_sparse_shelf_x0_y0_z0");
    assert.equal(blockType(ox + 6, 65, 4), "paradise:lib_full_bookshelf_x0_y0_z0");
    assert.equal(blockType(ox + 1, 65, 5), "paradise:lib_fallen_shelf_x0_y0_z0");
    assert.equal(blockType(ox + 2, 65, 5), "paradise:lib_fallen_shelf_x0_y0_z1");
    assert.equal(blockType(ox + 1, 65, 4), "paradise:lib_fallen_shelf_x1_y0_z0");
    assert.equal(blockType(ox + 2, 65, 4), "paradise:lib_fallen_shelf_x1_y0_z1");
    for (let x = 3; x <= 5; x += 1) {
      for (let z = 1; z <= 6; z += 1) {
        assert.equal(blockType(ox + x, 66, z), "minecraft:air");
      }
    }
  });

  it("keeps the reader lamp and bookends in an unshelved supported niche", () => {
    const ox = 62 * 16;
    const oz = -16;
    assert.equal(blockType(ox + 3, 66, oz + 12), "paradise:lib_desk_lamp");
    assert.equal(blockType(ox + 3, 67, oz + 12), "paradise:lib_bookends");
    assert.equal(blockType(ox + 3, 69, oz + 12), "minecraft:air");
    assert.equal(blockType(ox + 12, 65, oz + 13), "paradise:lib_tall_library_ladder_x0_y0_z0");
    assert.equal(blockType(ox + 12, 66, oz + 13), "paradise:lib_tall_library_ladder_x0_y1_z0");
  });
});
