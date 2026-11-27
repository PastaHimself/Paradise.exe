import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SOURCE = readFileSync(path.join(ROOT, "addon/BP/scripts/catacombs.js"), "utf8");
const CATACOMB_DIMENSION_ID = "catacombs:catacomb_mazes";

function extractFunction(name) {
  const declaration = new RegExp(`^(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\s*\\(`, "m");
  const match = declaration.exec(SOURCE);
  assert.ok(match, `missing function ${name}`);

  const start = match.index;
  const nextDeclaration = /^(?:export\s+)?(?:async\s+)?function\s+\w+\s*\(/gm;
  nextDeclaration.lastIndex = start + match[0].length;
  const nextMatch = nextDeclaration.exec(SOURCE);
  return SOURCE.slice(start, nextMatch ? nextMatch.index : SOURCE.length).replace(/^export\s+/, "");
}

function createHarness(options = {}) {
  const state = {
    players: [],
    scheduled: [],
    rebuildCount: 0,
    planCount: 0,
    teleports: [],
    safeSpotRequests: [],
    announcements: [],
    messages: [],
    tickingAreaCreates: [],
    tickingAreaRemovals: [],
    restoredBuildAccess: [],
    failTeleportFor: new Set(options.failTeleportFor ?? []),
    buildGate: options.buildGate ?? null,
    ensureCoreGate: options.ensureCoreGate ?? null,
    initialMazeReady: options.initialMazeReady ?? false,
    initialMazePlan: options.initialMazePlan ?? null,
    initialBootstrapPromise: options.initialBootstrapPromise ?? null,
    dimensions: new Map([
      [CATACOMB_DIMENSION_ID, { id: CATACOMB_DIMENSION_ID }],
      ["minecraft:overworld", { id: "minecraft:overworld" }],
      ["minecraft:nether", { id: "minecraft:nether" }],
      ["minecraft:the_end", { id: "minecraft:the_end" }],
    ]),
  };

  const system = {
    runTimeout(callback, ticks) {
      state.scheduled.push({ callback, ticks, ran: false });
    },
  };

  const world = {
    getDefaultSpawnLocation() {
      return { x: 0, y: 64, z: 0 };
    },
    sendMessage(message) {
      state.messages.push(message);
    },
    tickingAreaManager: {
      async createTickingArea(identifier, configuration) {
        state.tickingAreaCreates.push({ identifier, configuration });
      },
      removeTickingArea(identifier) {
        state.tickingAreaRemovals.push(identifier);
      },
    },
  };

  const dependencies = {
    getDimensionSafe(dimensionId) {
      return state.dimensions.get(dimensionId);
    },
    findSafeReturnSpot(dimension, location) {
      state.safeSpotRequests.push({ dimensionId: dimension.id, location: { ...location } });
      return { x: location.x + 0.5, y: location.y, z: location.z + 0.5 };
    },
    async verifiedPlayerTeleport(player, location, teleportOptions) {
      state.teleports.push({
        playerId: player.id,
        dimensionId: teleportOptions.dimension.id,
        location: { ...location },
        checkForBlocks: teleportOptions.checkForBlocks,
      });
      if (state.failTeleportFor.has(player.id)) {
        return false;
      }

      player.dimension = teleportOptions.dimension;
      player.location = { ...location };
      state.players = state.players.filter((candidate) => candidate.id !== player.id);
      return true;
    },
    restoreCatacombBuildAccess(player) {
      state.restoredBuildAccess.push(player.id);
    },
    announce(player, title, subtitle) {
      state.announcements.push({ playerId: player.id, title, subtitle });
    },
    openExitDoor() {},
    clearCatacombEscapeTimer() {},
    createMazePlan() {
      state.planCount += 1;
      return { id: state.planCount };
    },
    makeFreshMazeSeedText() {
      return `test-maze-${state.planCount + 1}`;
    },
    async ensureCoreTickingArea() {
      if (state.ensureCoreGate) {
        await state.ensureCoreGate.promise;
      }
    },
    async buildMazeNow(plan) {
      state.rebuildCount += 1;
      state.lastBuiltPlan = plan;
      if (state.buildGate) {
        await state.buildGate.promise;
      }
    },
    isMazeBuilt: () => false,
    getStartSpawnLocation: () => ({ x: 2.5, y: 65, z: 2.5 }),
    getRandomCatacombSpawnLocation: () => ({ x: 12.5, y: 65, z: 12.5 }),
  };

  const functionSources = [
    "hasCatacombOccupants",
    "invalidatePostExitRebuild",
    "beginCatacombEntry",
    "schedulePostExitRebuild",
    "ensureWorldReady",
    "rebuildMazeNow",
    "enterCatacombs",
    "enterCatacombsAtRandomLocation",
    "exitCatacombs",
  ].map(extractFunction);
  const triggerExitSource = extractFunction("triggerExit").replace(
    "void exitCatacombs(player);",
    "lastExitPromise = exitCatacombs(player);",
  );

  const runtime = new Function(
    "state",
    "system",
    "world",
    "dependencies",
    "CATACOMB_DIMENSION_ID",
    "RETURN_TICKING_AREA_PREFIX",
    `
      const pendingCatacombEntries = new Set();
      const pendingEscape = new Set();
      const returnPoints = new Map();
      let postExitRebuildGeneration = 0;
      let mazePlan = state.initialMazePlan;
      let mazeReady = state.initialMazeReady;
      let bootstrapPromise = state.initialBootstrapPromise;
      let mazeRebuildPromise = null;
      let lastExitPromise = null;

      const {
        getDimensionSafe,
        findSafeReturnSpot,
        verifiedPlayerTeleport,
        restoreCatacombBuildAccess,
        announce,
        openExitDoor,
        clearCatacombEscapeTimer,
        createMazePlan,
        makeFreshMazeSeedText,
        ensureCoreTickingArea,
        buildMazeNow,
        isMazeBuilt,
        getStartSpawnLocation,
        getRandomCatacombSpawnLocation,
      } = dependencies;

      function isCatacombDimensionId(dimensionId) {
        return dimensionId === CATACOMB_DIMENSION_ID;
      }

      function getCatacombPlayers() {
        return state.players;
      }

      function applyTransitionEffect() {}
      function spawnTransitionParticles() {}
      function waitTicks() {
        return Promise.resolve();
      }

      ${functionSources.join("\n\n")}

      ${triggerExitSource}

      async function teleportPlayerIntoCatacombs(player, spawn) {
        await ensureWorldReady();
        player.dimension = { id: CATACOMB_DIMENSION_ID };
        player.location = { ...spawn };
        if (!state.players.some((candidate) => candidate.id === player.id)) {
          state.players.push(player);
        }
        return true;
      }

      return {
        enterCatacombs,
        enterCatacombsAtRandomLocation,
        triggerExit,
        exitCatacombs,
        getLastExitPromise: () => lastExitPromise,
        getPlayers: () => state.players,
        getReturnPoints: () => returnPoints,
        getPendingEscape: () => pendingEscape,
        getPendingEntries: () => pendingCatacombEntries,
        schedulePostExitRebuild,
        getMazeState: () => ({ mazeReady, mazePlan, bootstrapPromise, mazeRebuildPromise }),
        getPostExitRebuildGeneration: () => postExitRebuildGeneration,
      };
    `,
  );

  return {
    state,
    ...runtime(
      state,
      system,
      world,
      dependencies,
      CATACOMB_DIMENSION_ID,
      "catacombs:return:",
    ),
  };
}

function createPlayer(id) {
  return {
    id,
    dimension: { id: "minecraft:overworld" },
    location: { x: 10, y: 64, z: 20 },
    messages: [],
    sendMessage(message) {
      this.messages.push(message);
    },
  };
}

async function settleRebuild(harness) {
  for (let index = 0; index < 5; index += 1) {
    await Promise.resolve();
  }
  const rebuildPromise = harness.getMazeState().mazeRebuildPromise;
  if (rebuildPromise) {
    await rebuildPromise;
  }
  for (let index = 0; index < 5; index += 1) {
    await Promise.resolve();
  }
}

async function flushMicrotasks() {
  for (let index = 0; index < 10; index += 1) {
    await Promise.resolve();
  }
}

function getScheduledTask(harness, ticks, occurrence = 0) {
  const tasks = harness.state.scheduled.filter((task) => task.ticks === ticks && !task.ran);
  const task = tasks[occurrence];
  assert.ok(task, `expected scheduled callback at ${ticks} ticks (occurrence ${occurrence})`);
  task.ran = true;
  return task;
}

async function runExitCallback(harness) {
  const task = getScheduledTask(harness, 2);
  task.callback();
  const exitPromise = harness.getLastExitPromise();
  assert.ok(exitPromise, "triggerExit should start the return operation");
  await exitPromise;
}

test("two players share one maze; only the last exit schedules a generation-safe rebuild", async () => {
  let releaseBuild;
  const buildGate = {
    promise: new Promise((resolve) => {
      releaseBuild = resolve;
    }),
  };
  const harness = createHarness({ buildGate });
  const firstPlayer = createPlayer("first");
  const secondPlayer = createPlayer("second");

  const firstEntry = harness.enterCatacombs(firstPlayer);
  await flushMicrotasks();
  assert.equal(harness.state.rebuildCount, 1, "the first entrant creates the shared maze");

  const secondEntry = harness.enterCatacombs(secondPlayer);
  assert.equal(harness.getPendingEntries().size, 2, "both in-flight entries reserve the shared instance");
  assert.equal(harness.state.rebuildCount, 1, "the second entrant must not start another maze build");

  releaseBuild();
  assert.equal(await firstEntry, true);
  assert.equal(await secondEntry, true);
  assert.deepEqual(harness.getPlayers().map((player) => player.id).sort(), ["first", "second"]);
  assert.equal(harness.state.rebuildCount, 1);
  assert.equal(harness.getPendingEntries().size, 0);

  harness.getReturnPoints().set(firstPlayer.id, {
    dimensionId: "minecraft:nether",
    location: { x: -40, y: 70, z: 18 },
  });
  harness.getReturnPoints().set(secondPlayer.id, {
    dimensionId: "minecraft:overworld",
    location: { x: 120, y: 66, z: -24 },
  });

  harness.triggerExit(firstPlayer);
  await runExitCallback(harness);
  assert.deepEqual(harness.getPlayers().map((player) => player.id), ["second"]);
  assert.equal(harness.state.teleports[0].dimensionId, "minecraft:nether");
  assert.deepEqual(harness.state.safeSpotRequests[0], {
    dimensionId: "minecraft:nether",
    location: { x: -40, y: 70, z: 18 },
  });

  const firstPlayerRebuild = getScheduledTask(harness, 60);
  firstPlayerRebuild.callback();
  await settleRebuild(harness);
  assert.equal(harness.state.rebuildCount, 1, "a delayed rebuild must not run while another player remains");

  harness.triggerExit(secondPlayer);
  await runExitCallback(harness);
  assert.equal(harness.getPlayers().length, 0);
  assert.equal(harness.state.teleports[1].dimensionId, "minecraft:overworld");

  const secondPlayerRebuild = getScheduledTask(harness, 60);
  secondPlayerRebuild.callback();
  await settleRebuild(harness);
  assert.equal(harness.state.rebuildCount, 2, "the last-player callback rebuilds exactly once");
  assert.equal(harness.getReturnPoints().size, 0);
  assert.equal(
    harness.state.announcements.filter((entry) => entry.subtitle === "Your return point has been restored.").length,
    2,
    "success is announced only after each verified return",
  );
});

test("the random-route fresh-maze entry reuses the maze while another player is inside", async () => {
  const harness = createHarness();
  const firstPlayer = createPlayer("route-first");
  const secondPlayer = createPlayer("route-second");

  assert.equal(await harness.enterCatacombsAtRandomLocation(firstPlayer, {
    transitionTicks: 0,
    freshMaze: true,
  }), true);
  assert.equal(await harness.enterCatacombsAtRandomLocation(secondPlayer, {
    transitionTicks: 0,
    freshMaze: true,
  }), true);

  assert.equal(harness.state.rebuildCount, 1);
  assert.deepEqual(harness.getPlayers().map((player) => player.id).sort(), ["route-first", "route-second"]);
  assert.equal(harness.getPendingEntries().size, 0);
});

test("a superseded delayed rebuild callback cannot rebuild the maze", async () => {
  const harness = createHarness();

  harness.schedulePostExitRebuild();
  harness.schedulePostExitRebuild();

  const staleTask = getScheduledTask(harness, 60);
  staleTask.callback();
  await flushMicrotasks();
  assert.equal(harness.state.rebuildCount, 0);

  const currentTask = getScheduledTask(harness, 60);
  currentTask.callback();
  await settleRebuild(harness);
  assert.equal(harness.state.rebuildCount, 1);
});

test("an entry invalidates a delayed rebuild that is still waiting for its ticking area", async () => {
  let releaseTickingArea;
  const ensureCoreGate = {
    promise: new Promise((resolve) => {
      releaseTickingArea = resolve;
    }),
  };
  const harness = createHarness({
    ensureCoreGate,
    initialMazeReady: true,
    initialMazePlan: { id: 0 },
    initialBootstrapPromise: Promise.resolve(),
  });

  harness.schedulePostExitRebuild();
  const delayedTask = getScheduledTask(harness, 60);
  delayedTask.callback();
  await flushMicrotasks();
  assert.equal(harness.state.planCount, 1, "the guarded rebuild has reached its ticking-area wait");
  assert.equal(harness.state.rebuildCount, 0);

  const player = createPlayer("reentering");
  const entryPromise = harness.enterCatacombs(player);
  await flushMicrotasks();
  assert.equal(harness.getPendingEntries().has(player.id), true);

  releaseTickingArea();
  assert.equal(await entryPromise, true);
  await settleRebuild(harness);
  assert.equal(harness.state.rebuildCount, 0, "the stale build aborts before writing the shared maze");
  assert.equal(harness.getPlayers().map((candidate) => candidate.id).includes(player.id), true);
});

test("failed return teleport preserves the saved return point and emits no success announcement", async () => {
  const harness = createHarness({ failTeleportFor: ["stranded"] });
  const player = createPlayer("stranded");
  player.dimension = { id: CATACOMB_DIMENSION_ID };
  harness.state.players.push(player);
  const savedReturnPoint = {
    dimensionId: "minecraft:nether",
    location: { x: -128, y: 72, z: -33 },
  };
  harness.getReturnPoints().set(player.id, savedReturnPoint);
  harness.getPendingEscape().add(player.id);

  const result = await harness.exitCatacombs(player);

  assert.equal(result, false);
  assert.equal(harness.getReturnPoints().get(player.id), savedReturnPoint);
  assert.equal(harness.getPendingEscape().has(player.id), false);
  assert.equal(harness.state.teleports.length, 1);
  assert.equal(harness.state.teleports[0].dimensionId, "minecraft:nether");
  assert.deepEqual(harness.state.safeSpotRequests[0], {
    dimensionId: "minecraft:nether",
    location: savedReturnPoint.location,
  });
  assert.equal(
    harness.state.announcements.some((entry) => entry.subtitle === "Your return point has been restored."),
    false,
  );
  assert.ok(player.messages.some((message) => message.includes("return teleport verification failed")));
  assert.equal(harness.state.tickingAreaRemovals.includes("catacombs:return:stranded"), true);

  assert.match(
    SOURCE,
    /if \(pendingCatacombRespawns\.has\(player\.id\) \|\| pendingEscape\.has\(player\.id\)\)\s*\{\s*return;/,
    "the dimension-change listener must defer return-point cleanup while verified exit is pending",
  );
});

test("Catacombs custom dress identifiers are resolved before native block placement", () => {
  const placements = [];
  const helperSource = extractFunction("setDressBlock");
  const setDressBlock = new Function(
    "getMazeBlock",
    "BlockPermutation",
    `${helperSource}; return setDressBlock;`,
  )(
    () => ({
      setPermutation(permutation) {
        placements.push(permutation);
      },
    }),
    {
      resolve(typeId, states) {
        return { typeId, states };
      },
    },
  );

  assert.equal(setDressBlock({}, 4, 65, 8, "paradise:cat_uneven_floor_tiles"), true);
  assert.deepEqual(placements, [{
    typeId: "paradise:cat_uneven_floor_tiles",
    states: undefined,
  }]);

  const invalidDressBlock = new Function(
    "getMazeBlock",
    "BlockPermutation",
    `${helperSource}; return setDressBlock;`,
  )(
    () => ({ setPermutation() { assert.fail("invalid identifiers must not reach setPermutation"); } }),
    { resolve() { throw new Error("unknown block identifier"); } },
  );
  assert.equal(invalidDressBlock({}, 4, 65, 8, "paradise:missing_block"), false);

  const dressSource = extractFunction("dressCatacombCell");
  assert.match(dressSource, /setDressBlock\(dim,\s*x,\s*MAZE\.originY,\s*z,\s*floorBlock\(x,\s*z\)\)/);
  assert.match(dressSource, /setDressBlock\(dim,\s*point\.x,\s*y,\s*point\.z,\s*wallBlock\(point\.x,\s*point\.z\)\)/);
  assert.doesNotMatch(dressSource, /setBlock\([^;]*(?:floorBlock|wallBlock)\(/);
});
