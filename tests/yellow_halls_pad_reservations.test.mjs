import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { runInNewContext } from "node:vm";

import {
  boundsOverlap,
  createYellowHallsPadReservations,
  inferYellowHallsPadAnchor,
  isPositionReserved,
  scanYellowHallsPadMarkers,
  subtractReservedVolumes,
} from "../addon/BP/scripts/yellow_halls_pad_reservations.js";

const source = readFileSync(new URL("../addon/BP/scripts/yellow_halls.js", import.meta.url), "utf8");

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

function finishGenerator(generator) {
  while (true) {
    const step = generator.next();
    if (step.done) return step.value;
  }
}

function finishScan(dimension, bounds, readsPerBatch) {
  return finishGenerator(scanYellowHallsPadMarkers(dimension, bounds, readsPerBatch));
}

function padScanRuntimeFixture() {
  const start = source.indexOf("function runYellowHallsPadMarkerScan(");
  const end = source.indexOf("function createPadProtectedDimension(");
  const scanRuntimeSource = source.slice(start, end);
  const jobs = [];
  const warnings = [];
  const recordedAnchors = [];
  const state = {
    connectionPadAnchors: new Map(),
    connectionPadReservations: new Map(),
    connectionPadScannedPatches: new Set(),
    connectionPadScanPromises: new Map(),
  };
  const runtime = runInNewContext(`
    ${scanRuntimeSource}
    ({ scanExistingConnectionPads, getConnectionPadReservations })
  `, {
    system: { runJob: (generator) => jobs.push(generator) },
    state,
    getPatchKey: (patchX, patchZ) => `${patchX}:${patchZ}`,
    getPatchBounds: () => ({ minX: 0, maxX: 0, minZ: 0, maxZ: 0 }),
    GROUND_Y: 64,
    scanYellowHallsPadMarkers,
    recordConnectionPadAnchor: (anchor) => recordedAnchors.push(anchor),
    world: { getAllPlayers: () => [] },
    refreshPlayerConnectionPadAnchor() {},
    console: { warn: (...args) => warnings.push(args.join(" ")) },
  });

  return { jobs, runtime, state, warnings, recordedAnchors };
}

function patchPaintFixture({ deferInitialScan = false, deferFinalScan = false } = {}) {
  const sourceFor = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));
  const events = [];
  const reservations = [];
  const blocks = new Map();
  const initialScanGate = deferred();
  const finalScanGate = deferred();
  const initialScanStarted = deferred();
  const finalScanStarted = deferred();
  let scanCount = 0;
  const locationKey = ({ x, y, z }) => `${x}:${y}:${z}`;
  const dimension = {
    id: "paradise:yellow_halls",
    getBlock: (location) => blocks.get(locationKey(location)),
    setBlockType(location, type) { blocks.set(locationKey(location), type); },
    fillBlocks() {},
  };
  const position = { x: 34, y: 66, z: 2 };
  let releaseModule;
  let rejectModule;
  let notifyModuleStarted;
  const moduleStarted = new Promise((resolve) => { notifyModuleStarted = resolve; });
  const moduleCompletion = new Promise((resolve, reject) => {
    releaseModule = resolve;
    rejectModule = reject;
  });
  class BlockVolume {
    constructor(minimum, maximum) { this.minimum = minimum; this.maximum = maximum; }
    getMin() { return this.minimum; }
    getMax() { return this.maximum; }
  }
  const paintPatch = runInNewContext(`
    ${sourceFor("function createPadProtectedDimension(", "function getPatchSeed(")}
    ${sourceFor("function paintPatch(", "function getPatchJob(")}
    paintPatch;
  `, {
    BlockVolume, isPositionReserved, subtractReservedVolumes,
    GROUND_Y: 64, CEILING_Y: 68, CELL_SIZE: 8, CELLS_PER_SIDE: 1,
    ENTRY_PATCH: { patchX: 0, patchZ: 0 }, BLOCK: { air: "air", birchPlanks: "planks" },
    getPatchBounds: () => ({ minX: 32, minZ: 0, maxX: 63, maxZ: 31 }),
    getPatchSeed: () => 1,
    yellowHallsModel: { generatePatchMaze: () => [[{}]] },
    cancelVisualJobs() {}, pickWallBlock() {}, renderCellWall() {},
    isEscapeCellForAnyPlayer: () => false, applyYellowHallsDressing() {},
    placePatchLights() {}, placeDecorations() {}, placeHazards() {}, placeChests() {},
    async getConnectionPadReservations() {
      scanCount += 1;
      if (scanCount === 1) {
        initialScanStarted.resolve();
        if (deferInitialScan) await initialScanGate.promise;
      }
      if (scanCount === 2) {
        finalScanStarted.resolve();
        if (deferFinalScan) await finalScanGate.promise;
      }
      return [...reservations];
    },
    world: { tickingAreaManager: {
      async createTickingArea(id) { events.push(`created:${id}`); },
      removeTickingArea(id) { events.push(`removed:${id}`); },
    } },
    async scheduleYellowHallsModule() {
      events.push("module-started");
      notifyModuleStarted();
      await moduleCompletion;
      events.push("module-completed");
    },
    applySpecialSitesForPatch(protectedDimension) {
      events.push("special-sites");
      protectedDimension.setBlockType(position, "escape-room");
    },
  });
  return {
    events, moduleStarted, releaseModule, rejectModule,
    initialScanStarted: initialScanStarted.promise,
    finalScanStarted: finalScanStarted.promise,
    releaseInitialScan: initialScanGate.resolve,
    releaseFinalScan: finalScanGate.resolve,
    paint: () => paintPatch(dimension, 1, 0),
    addPad() {
      dimension.setBlockType(position, "connection-pad");
      reservations.push({ minX: 34, maxX: 34, minY: 66, maxY: 66, minZ: 2, maxZ: 2 });
    },
    getPad: () => dimension.getBlock(position),
  };
}

describe("Yellow Halls connection-pad reservations", () => {
  it("reserves all three 3×3 pads, Z+2 signs, and two-wide approaches at A.y±1", () => {
    const reservations = createYellowHallsPadReservations({ x: 0.9, y: 66.8, z: -0.2 });
    assert.equal(reservations.length, 9);

    assert.deepEqual(reservations.slice(0, 3), [
      { minX: 9, maxX: 11, minY: 65, maxY: 67, minZ: -2, maxZ: 0 },
      { minX: 10, maxX: 10, minY: 65, maxY: 67, minZ: 1, maxZ: 1 },
      { minX: 0, maxX: 10, minY: 65, maxY: 67, minZ: -1, maxZ: 0 },
    ]);
    assert.deepEqual(reservations.slice(3, 6), [
      { minX: -11, maxX: -9, minY: 65, maxY: 67, minZ: -2, maxZ: 0 },
      { minX: -10, maxX: -10, minY: 65, maxY: 67, minZ: 1, maxZ: 1 },
      { minX: -10, maxX: 0, minY: 65, maxY: 67, minZ: -1, maxZ: 0 },
    ]);
    assert.deepEqual(reservations.slice(6, 9), [
      { minX: -1, maxX: 1, minY: 65, maxY: 67, minZ: -12, maxZ: -10 },
      { minX: 0, maxX: 0, minY: 65, maxY: 67, minZ: -9, maxZ: -9 },
      { minX: 0, maxX: 1, minY: 65, maxY: 67, minZ: -11, maxZ: -1 },
    ]);
    assert.equal(isPositionReserved({ x: 10, y: 66, z: 1 }, reservations), true);
    assert.equal(isPositionReserved({ x: 5, y: 66, z: 0 }, reservations), true);
    assert.equal(isPositionReserved({ x: 5, y: 64, z: 0 }, reservations), false);
  });

  it("recovers the same anchor from each of the three native pad signs", () => {
    assert.deepEqual(inferYellowHallsPadAnchor("STAIRWELL", { x: 10, y: 66, z: 1 }), { x: 0, y: 66, z: -1 });
    assert.deepEqual(inferYellowHallsPadAnchor("ARCHIVE", { x: -10, y: 66, z: 1 }), { x: 0, y: 66, z: -1 });
    assert.deepEqual(inferYellowHallsPadAnchor("DOWN", { x: 0, y: 66, z: -9 }), { x: 0, y: 66, z: -1 });
    assert.equal(inferYellowHallsPadAnchor("OTHER", { x: 0, y: 66, z: 0 }), undefined);
  });

  it("keeps recovered markers but leaves a partially unreadable scan retryable", () => {
    let firstUnreadableRead = true;
    const dimension = {
      getBlock(location) {
        if (location.x === 5 && location.y === 65 && location.z === 10 && firstUnreadableRead) {
          firstUnreadableRead = false;
          return undefined;
        }
        if (location.x === 5 && location.y === 66 && location.z === 12) {
          return {
            typeId: "minecraft:oak_sign",
            getComponent() {
              return { getText: () => "STAIRWELL" };
            },
          };
        }
        return { typeId: "minecraft:air" };
      },
    };
    const bounds = { minX: 5, maxX: 5, minY: 65, maxY: 67, minZ: 10, maxZ: 10 };

    const firstScan = finishScan(dimension, bounds);
    assert.deepEqual(firstScan.anchors, [{ x: -5, y: 66, z: 10 }]);
    assert.equal(firstScan.unreadable, 1);
    assert.equal(firstScan.complete, false);

    const retry = finishScan(dimension, bounds);
    assert.deepEqual(retry.anchors, [{ x: -5, y: 66, z: 10 }]);
    assert.equal(retry.unreadable, 0);
    assert.equal(retry.complete, true);
  });

  it("yields within the configured block-read budget and preserves anchors, duplicates, and unreadable counts", () => {
    const blockReads = [];
    const dimension = {
      getBlock(location) {
        blockReads.push(location);
        if (location.x === 5 && location.y === 65 && location.z === 1) {
          throw new Error("unloaded chunk");
        }
        if (location.x === -5 && location.y === 66 && location.z === 1) return undefined;
        if (location.x === 10 && location.y === 66 && location.z === 2) {
          return {
            typeId: "minecraft:oak_sign",
            getComponent: () => ({ getText: () => "STAIRWELL" }),
          };
        }
        if (location.x === -10 && location.y === 66 && location.z === 2) {
          return {
            typeId: "minecraft:oak_sign",
            getComponent: () => ({ getText: () => "ARCHIVE" }),
          };
        }
        if (location.x === 0 && location.y === 66 && location.z === 0) {
          return { typeId: "minecraft:stone_pressure_plate" };
        }
        if (location.y === 65 && location.x >= -1 && location.x <= 1 && location.z >= -1 && location.z <= 1) {
          return { typeId: "minecraft:stone_bricks" };
        }
        if (location.x === 0 && location.y === 66 && location.z === 2) {
          return { typeId: "minecraft:oak_sign", getComponent() { throw new Error("sign unavailable"); } };
        }
        if (location.x === 1 && location.y === 66 && location.z === 2) {
          return { typeId: "minecraft:oak_sign", getComponent: () => ({}) };
        }
        return { typeId: "minecraft:air" };
      },
    };
    const job = scanYellowHallsPadMarkers(dimension, {
      minX: -10,
      maxX: 10,
      minY: 65,
      maxY: 66,
      minZ: 0,
      maxZ: 0,
      yLevels: [65, 66],
    }, 3);

    let readsBeforeBatch = 0;
    let yields = 0;
    let scan;
    while (true) {
      const step = job.next();
      const readsThisBatch = blockReads.length - readsBeforeBatch;
      assert.ok(readsThisBatch <= 3, `batch performed ${readsThisBatch} reads`);
      if (step.done) {
        scan = step.value;
        break;
      }
      assert.equal(readsThisBatch, 3);
      readsBeforeBatch = blockReads.length;
      yields += 1;
    }

    assert.deepEqual(scan.anchors, [
      { x: 0, y: 66, z: 0 },
      { x: -10, y: 66, z: 0 },
    ]);
    assert.equal(scan.unreadable, 4);
    assert.equal(scan.complete, false);
    assert.equal(yields, Math.floor(blockReads.length / 3));
  });

  it("uses 192 block reads as the default yield interval", () => {
    let reads = 0;
    const dimension = {
      getBlock() {
        reads += 1;
        return { typeId: "minecraft:air" };
      },
    };
    const job = scanYellowHallsPadMarkers(dimension, {
      minX: 0,
      maxX: 0,
      minY: 64,
      maxY: 64,
      minZ: 0,
      maxZ: 200,
    });

    const firstBatch = job.next();
    assert.equal(firstBatch.done, false);
    assert.equal(reads, 192);

    const completion = job.next();
    assert.equal(completion.done, true);
    assert.equal(reads, 203);
    assert.equal(completion.value.complete, true);
  });

  it("awaits runJob completion, shares in-flight scans, and retries incomplete patches", async () => {
    let firstRead = true;
    const dimension = {
      getBlock() {
        if (firstRead) {
          firstRead = false;
          return undefined;
        }
        return { typeId: "minecraft:air" };
      },
    };
    const fixture = padScanRuntimeFixture();
    let firstSettled = false;
    const first = fixture.runtime.getConnectionPadReservations(dimension, 1, 0).then((value) => {
      firstSettled = true;
      return value;
    });
    const concurrent = fixture.runtime.getConnectionPadReservations(dimension, 1, 0);

    assert.equal(fixture.jobs.length, 1);
    assert.equal(firstSettled, false);
    assert.equal(fixture.state.connectionPadScannedPatches.has("1:0"), false);
    finishGenerator(fixture.jobs.shift());
    assert.equal((await first).length, 0);
    assert.equal((await concurrent).length, 0);
    assert.equal(firstSettled, true);
    assert.equal(fixture.state.connectionPadScannedPatches.has("1:0"), false);
    assert.equal(fixture.state.connectionPadScanPromises.has("1:0"), false);
    assert.match(fixture.warnings[0], /1 unreadable cells/);

    const retry = fixture.runtime.getConnectionPadReservations(dimension, 1, 0);
    assert.equal(fixture.jobs.length, 1);
    finishGenerator(fixture.jobs.shift());
    assert.equal((await retry).length, 0);
    assert.equal(fixture.state.connectionPadScannedPatches.has("1:0"), true);
  });

  it("recovers a pad from its complete native support footprint when its sign is missing", () => {
    const dimension = {
      getBlock(location) {
        if (location.x === 10 && location.y === 66 && location.z === 0) {
          return { typeId: "minecraft:stone_pressure_plate" };
        }
        if (
          location.y === 65 &&
          location.x >= 9 && location.x <= 11 &&
          location.z >= -1 && location.z <= 1
        ) {
          return { typeId: "minecraft:stone_bricks" };
        }
        return { typeId: "minecraft:air" };
      },
    };
    const scan = finishScan(dimension, {
      minX: 10,
      maxX: 10,
      minY: 65,
      maxY: 66,
      minZ: 0,
      maxZ: 0,
    });

    assert.deepEqual(scan.anchors, [{ x: 0, y: 66, z: 0 }]);
    assert.equal(scan.complete, true);
  });

  it("scans explicit anchor-height levels outside the base floor band", () => {
    const dimension = {
      getBlock(location) {
        if (location.x === 10 && location.y === 64 && location.z === 12) {
          return {
            typeId: "minecraft:oak_sign",
            getComponent: () => ({ getText: () => "STAIRWELL" }),
          };
        }
        if (location.x === 10 && location.y === 68 && location.z === 12) {
          return {
            typeId: "minecraft:oak_sign",
            getComponent: () => ({ getText: () => "ARCHIVE" }),
          };
        }
        return { typeId: "minecraft:air" };
      },
    };
    const scan = finishScan(dimension, {
      minX: 10,
      maxX: 10,
      minY: 64,
      maxY: 68,
      minZ: 10,
      maxZ: 10,
      yLevels: [64, 68],
    });

    assert.deepEqual(scan.anchors, [
      { x: 0, y: 64, z: 10 },
      { x: 20, y: 68, z: 10 },
    ]);
    assert.equal(scan.complete, true);
  });

  it("does not mistake an ordinary hazard plate on the patch floor for a connection pad", () => {
    const dimension = {
      getBlock(location) {
        if (location.x === 10 && location.y === 66 && location.z === 0) {
          return { typeId: "minecraft:stone_pressure_plate" };
        }
        if (location.x === 10 && location.y === 65 && location.z === 0) {
          return { typeId: "minecraft:birch_planks" };
        }
        return { typeId: "minecraft:air" };
      },
    };
    const scan = finishScan(dimension, {
      minX: 10,
      maxX: 10,
      minY: 65,
      maxY: 66,
      minZ: 0,
      maxZ: 0,
    });

    assert.deepEqual(scan.anchors, []);
    assert.equal(scan.complete, true);
  });

  it("subtracts overlapping reservations without losing or duplicating any unreserved cell", () => {
    const sourceBounds = { minX: 0, maxX: 4, minY: 0, maxY: 2, minZ: 0, maxZ: 4 };
    const reservations = [
      { minX: 1, maxX: 2, minY: 1, maxY: 2, minZ: 1, maxZ: 3 },
      { minX: 2, maxX: 3, minY: 0, maxY: 1, minZ: 2, maxZ: 4 },
    ];
    const regions = subtractReservedVolumes(sourceBounds, reservations);

    for (let x = 0; x <= 4; x++) {
      for (let y = 0; y <= 2; y++) {
        for (let z = 0; z <= 4; z++) {
          const point = { x, y, z };
          const reserved = reservations.some((reservation) =>
            x >= reservation.minX && x <= reservation.maxX &&
            y >= reservation.minY && y <= reservation.maxY &&
            z >= reservation.minZ && z <= reservation.maxZ,
          );
          const containingRegions = regions.filter((region) =>
            x >= region.minX && x <= region.maxX &&
            y >= region.minY && y <= region.maxY &&
            z >= region.minZ && z <= region.maxZ,
          );
          assert.equal(containingRegions.length, reserved ? 0 : 1, JSON.stringify(point));
        }
      }
    }
    for (let left = 0; left < regions.length; left++) {
      for (let right = left + 1; right < regions.length; right++) {
        assert.equal(boundsOverlap(regions[left], regions[right]), false);
      }
    }
  });

  it("applies reservations to patch fills, block writes, and delayed structure placement", () => {
    assert.match(source, /const padReservations = await getConnectionPadReservations\(dimension, patchX, patchZ\)/);
    assert.match(source, /const writeDimension = createPadProtectedDimension\(dimension, padReservations\)/);
    assert.match(source, /subtractReservedVolumes\(/);
    assert.match(source, /scanYellowHallsPadMarkers\(dimension/);
    assert.match(source, /system\.runJob\(/);
    assert.match(source, /async function scanExistingConnectionPads/);
    assert.match(source, /const yLevels = new Set\(\[GROUND_Y, GROUND_Y \+ 1, GROUND_Y \+ 2, GROUND_Y \+ 3, GROUND_Y \+ 4\]\)/);
    assert.match(source, /for \(const anchor of state\.connectionPadAnchors\.values\(\)\)/);
    assert.match(source, /if \(scan\.complete\) \{\s*state\.connectionPadScannedPatches\.add\(patchKey\)/);
    assert.match(source, /isPlacementAllowed,/);
    assert.match(source, /refreshPlayerConnectionPadAnchor\(player, true\)/);
    assert.match(source, /refreshPlayerConnectionPadAnchor\(player\)/);
  });

  it("protects pads registered during module placement before writing special sites", async () => {
    const fixture = patchPaintFixture({ deferInitialScan: true, deferFinalScan: true });
    const painted = fixture.paint();
    await fixture.initialScanStarted;
    assert.deepEqual(fixture.events, ["created:yh_1_0"]);
    fixture.releaseInitialScan();
    await fixture.moduleStarted;
    assert.deepEqual(fixture.events, ["created:yh_1_0", "module-started"]);
    fixture.addPad();
    fixture.releaseModule();
    await fixture.finalScanStarted;
    assert.deepEqual(fixture.events, ["created:yh_1_0", "module-started", "module-completed"]);
    fixture.releaseFinalScan();
    await painted;
    assert.equal(fixture.getPad(), "connection-pad");
    assert.deepEqual(fixture.events, ["created:yh_1_0", "module-started", "module-completed", "special-sites", "removed:yh_1_0"]);
  });

  it("releases the ticking area if deferred module placement fails", async () => {
    const fixture = patchPaintFixture();
    const painted = fixture.paint();
    await fixture.moduleStarted;
    fixture.rejectModule(new Error("fixture placement failure"));
    await assert.rejects(painted, /fixture placement failure/);
    assert.deepEqual(fixture.events, ["created:yh_1_0", "module-started", "removed:yh_1_0"]);
  });
});
