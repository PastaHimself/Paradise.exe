import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { registerHooks } from "node:module";

function createEvent() {
  const listeners = [];
  return {
    subscribe(listener) {
      listeners.push(listener);
    },
    emit(event) {
      for (const listener of listeners) {
        listener(event);
      }
    },
  };
}

const dimensionChangeEvent = createEvent();
const scheduledTimeouts = [];
const removedTickingAreas = [];
const createdTickingAreas = [];
const dimensions = new Map();

const tickingAreaManager = {
  removeTickingArea(areaId) {
    removedTickingAreas.push(areaId);
  },
  createTickingArea(areaId, options) {
    createdTickingAreas.push({ areaId, options });
    return Promise.resolve();
  },
};

const world = {
  tickingAreaManager,
  afterEvents: {
    worldLoad: createEvent(),
    playerDimensionChange: dimensionChangeEvent,
    playerLeave: createEvent(),
    entitySpawn: createEvent(),
    entityDie: createEvent(),
    itemUse: createEvent(),
  },
  beforeEvents: {
    chatSend: createEvent(),
  },
  getDimension(dimensionId) {
    const dimension = dimensions.get(dimensionId);
    if (!dimension) {
      throw new Error(`Unknown dimension: ${dimensionId}`);
    }
    return dimension;
  },
  getDefaultSpawnLocation() {
    return { x: 0.5, y: 65, z: 0.5 };
  },
};

const system = {
  beforeEvents: {
    startup: createEvent(),
  },
  currentTick: 0,
  run(callback) {
    callback();
  },
  runTimeout(callback, ticks) {
    scheduledTimeouts.push({ callback, ticks });
    return scheduledTimeouts.length;
  },
  runInterval() {
    return 0;
  },
};

const testContext = {
  world,
  system,
  verifiedPlayerTeleport: async () => true,
};
globalThis.__libraryLifecycleTest = testContext;

const mockedModules = new Map([
  [
    "@minecraft/server",
    `
      export const BlockPermutation = { resolve: (typeId, states) => ({ typeId, states }) };
      export class BlockVolume {}
      export const CommandPermissionLevel = {};
      export const CustomCommandStatus = { Success: "success" };
      export const GameMode = { Survival: "survival", Creative: "creative" };
      export class ItemStack {
        constructor(typeId, amount) { this.typeId = typeId; this.amount = amount; }
        setLore() {}
      }
      export const world = globalThis.__libraryLifecycleTest.world;
      export const system = globalThis.__libraryLifecycleTest.system;
    `,
  ],
  [
    "./dimension_horror_rules.js",
    `
      export const VHS_TIER = {};
      export const canTrigger = () => true;
      export const clearRuleState = (map, playerId) => map.delete(playerId);
      export const getOrCreateRuleState = (map, playerId, factory = () => ({})) => {
        if (!map.has(playerId)) map.set(playerId, factory());
        return map.get(playerId);
      };
      export const makeNoteItem = () => ({});
      export const requestRuleVhs = () => false;
      export const tryBeginRuleScare = () => false;
      export const safeAddEffect = () => false;
      export const safePlaySound = () => false;
      export const safeTitle = () => false;
      export const sampleMotion = () => ({ x: 0, y: 0, z: 0 });
      export const verifiedPlayerTeleport = (...args) =>
        globalThis.__libraryLifecycleTest.verifiedPlayerTeleport(...args);
      export const setStandingSign = () => false;
    `,
  ],
  ["./paradise_tick_cache.js", "export const getCachedPlayers = () => [];"],
  [
    "./paradise_visual_jobs.js",
    "export const hashCoords = () => 0; export const scheduleStructurePlacement = () => false; export const scheduleVisualJob = () => false;",
  ],
  ["./library_decor.js", "export const applyLibrarySurfaces = () => ({}); export const applyLibraryShelves = () => 0; export const applyLibraryFurniture = () => 0; export const applyLibraryLights = () => 0; export const applyLibrarySigns = () => 0; export const applyLibraryRestrictedBay = () => 0;"],
  ["./library_layout.js", `
    export const isAlcoveCell = () => false;
    export const isArrivalChunk = () => false;
    export const isConnectionReservation = () => false;
    export const isProtectedBookshelf = () => false;
    export const isReadingRoom = () => false;
    export const isRestrictedApproachCell = () => false;
    export const isRestrictedRoom = () => false;
    export const isWestRoom = () => false;
  `],
]);

const moduleHooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    const source = mockedModules.get(specifier);
    if (source !== undefined) {
      return {
        url: `data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`,
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});

const { exitLibraryToOverworld, LIBRARY_DIMENSION_ID } = await import(
  "../addon/BP/scripts/library.js?library-lifecycle-test"
);
moduleHooks.deregister();

const overworld = {
  id: "minecraft:overworld",
  getBlock() {
    return undefined;
  },
};
const nether = {
  id: "minecraft:nether",
  getBlock() {
    return undefined;
  },
};
const libraryDimension = {
  id: LIBRARY_DIMENSION_ID,
  getBlock() {
    return undefined;
  },
};
dimensions.set(overworld.id, overworld);
dimensions.set(nether.id, nether);
dimensions.set(libraryDimension.id, libraryDimension);

function createPlayer(id) {
  const messages = [];
  const titles = [];
  const player = {
    id,
    typeId: "minecraft:player",
    dimension: libraryDimension,
    location: { x: 0.5, y: 65, z: 0.5 },
    gameMode: "creative",
    messages,
    titles,
    getGameMode() {
      return this.gameMode;
    },
    setGameMode(gameMode) {
      this.gameMode = gameMode;
    },
    sendMessage(message) {
      messages.push(message);
    },
    onScreenDisplay: {
      setTitle(title, options) {
        titles.push({ title, options });
      },
    },
  };
  return player;
}

function emitLibraryEntry(player, fromDimension, fromLocation) {
  player.dimension = libraryDimension;
  dimensionChangeEvent.emit({
    player,
    fromDimension,
    toDimension: libraryDimension,
    fromLocation: { ...fromLocation },
  });
}

function emitLibraryExit(player, toDimension, toLocation) {
  const fromLocation = { ...player.location };
  player.dimension = toDimension;
  player.location = { ...toLocation };
  dimensionChangeEvent.emit({
    player,
    fromDimension: libraryDimension,
    toDimension,
    fromLocation,
  });
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

function resetTickingAreaRecords() {
  scheduledTimeouts.length = 0;
  removedTickingAreas.length = 0;
  createdTickingAreas.length = 0;
}

describe("Library return lifecycle", () => {
  it("preserves the saved return dimension and location after a failed verified teleport", async () => {
    resetTickingAreaRecords();
    const player = createPlayer("library-failed-return");
    const savedLocation = { x: 11.25, y: 65, z: -4.75 };
    const laterLocation = { x: 90.5, y: 72, z: 90.5 };
    emitLibraryEntry(player, overworld, savedLocation);

    const teleportCalls = [];
    testContext.verifiedPlayerTeleport = async (targetPlayer, location, options) => {
      teleportCalls.push({ location: { ...location }, dimension: options.dimension });
      emitLibraryExit(targetPlayer, options.dimension, location);
      return teleportCalls.length > 1;
    };

    const failed = await exitLibraryToOverworld(player);
    assert.equal(failed, false);
    assert.equal(
      player.titles.some(({ title }) => title === "You have escaped the Library."),
      false,
    );
    assert.ok(player.messages.some((message) => message.includes("return teleport could not be verified")));

    emitLibraryEntry(player, nether, laterLocation);
    const returned = await exitLibraryToOverworld(player);

    assert.equal(returned, true);
    assert.equal(teleportCalls.length, 2);
    assert.equal(teleportCalls[1].dimension.id, overworld.id);
    assert.deepEqual(teleportCalls[1].location, savedLocation);
    assert.ok(player.titles.some(({ title }) => title === "You have escaped the Library."));

    emitLibraryEntry(player, nether, laterLocation);
    assert.equal(await exitLibraryToOverworld(player), true);
    assert.equal(teleportCalls[2].dimension.id, nether.id);
    assert.deepEqual(teleportCalls[2].location, laterLocation);
  });

  it("does not let an older timeout remove a newer lease for the same ticking-area id", async () => {
    resetTickingAreaRecords();
    const player = createPlayer("library-overlapping-return");
    emitLibraryEntry(player, overworld, { x: 20.5, y: 65, z: 30.5 });

    const pendingTeleports = [];
    testContext.verifiedPlayerTeleport = () => new Promise((resolve) => {
      pendingTeleports.push(resolve);
    });

    const firstReturn = exitLibraryToOverworld(player);
    await flushMicrotasks();
    const secondReturn = exitLibraryToOverworld(player);
    await flushMicrotasks();

    assert.equal(pendingTeleports.length, 2);
    assert.equal(createdTickingAreas.length, 2);
    assert.equal(createdTickingAreas[0].areaId, createdTickingAreas[1].areaId);
    assert.deepEqual(removedTickingAreas, [
      createdTickingAreas[0].areaId,
      createdTickingAreas[0].areaId,
    ]);

    pendingTeleports[0](true);
    assert.equal(await firstReturn, true);
    assert.equal(scheduledTimeouts.length, 1);
    assert.equal(scheduledTimeouts[0].ticks, 20);

    const removalsBeforeOldCleanup = removedTickingAreas.length;
    scheduledTimeouts[0].callback();
    assert.equal(removedTickingAreas.length, removalsBeforeOldCleanup);

    pendingTeleports[1](true);
    assert.equal(await secondReturn, true);
    assert.equal(scheduledTimeouts.length, 2);

    scheduledTimeouts[1].callback();
    assert.equal(removedTickingAreas.length, removalsBeforeOldCleanup + 1);
    assert.equal(removedTickingAreas.at(-1), createdTickingAreas[0].areaId);
  });
});

