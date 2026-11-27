import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../addon/BP/scripts/yellow_halls.js", import.meta.url), "utf8");
const moduleStart = source.indexOf("async function scheduleYellowHallsModule(");
const nextDeclaration = /^function placeHazards\(/m;
const moduleEnd = nextDeclaration.exec(source.slice(moduleStart)).index + moduleStart;
const scheduleModuleSource = source.slice(moduleStart, moduleEnd);

test("Yellow Halls advances to another candidate when an escape claims a deferred module cell", async () => {
  const escapedCells = new Set();
  const attempts = [];
  let releaseFirstPlacement;

  const scheduleYellowHallsModule = runInNewContext(
    `${scheduleModuleSource}\nscheduleYellowHallsModule;`,
    {
      visualHashCoords: () => 0,
      YELLOW_HALLS_MODULES: [{ id: "paradise:yellow_halls/test_module", deadEndOnly: false }],
      selectVisualModuleIndex: () => 0,
      ENTRY_PATCH: { patchX: 0, patchZ: 0 },
      CELLS_PER_SIDE: 2,
      GROUND_Y: 64,
      isEscapeCellForAnyPlayer: (_patchX, _patchZ, cellX, cellZ) =>
        escapedCells.has(`${cellX}:${cellZ}`),
      getConnectionPadReservations: () => [],
      refreshActivePlayerConnectionPadAnchors() {},
      getCachedConnectionPadReservations: () => [],
      yellowHallsModel: {
        isModuleCellEligible: (_maze, _patchX, _patchZ, _cellX, _cellZ, options) => !options.escape,
        orderModuleCandidates: (candidates) => candidates,
        moduleWorldBounds: (_spec, cellX, cellZ, minX, minZ, groundY) => ({
          origin: { x: minX + cellX, y: groundY + 1, z: minZ + cellZ },
          minX: minX + cellX,
          maxX: minX + cellX,
          minY: groundY + 1,
          maxY: groundY + 1,
          minZ: minZ + cellZ,
          maxZ: minZ + cellZ,
        }),
        isBoundsClear: () => true,
      },
      scheduleStructurePlacement: (_key, _structureId, _dimension, origin, options) => {
        attempts.push({ origin: { ...origin }, isPlacementAllowed: options.isPlacementAllowed });
        if (attempts.length === 1) {
          return new Promise((resolve) => {
            releaseFirstPlacement = () => resolve(options.isPlacementAllowed());
          });
        }
        return Promise.resolve(options.isPlacementAllowed());
      },
    },
  );

  const pendingPlacement = scheduleYellowHallsModule({}, 1, 0, {}, 32, 0, 0);
  await Promise.resolve();

  assert.equal(attempts.length, 1);
  assert.deepEqual(attempts[0].origin, { x: 32, y: 65, z: 0 });

  escapedCells.add("0:0");
  releaseFirstPlacement();

  assert.equal(await pendingPlacement, true);
  assert.deepEqual(
    attempts.map(({ origin }) => origin),
    [
      { x: 32, y: 65, z: 0 },
      { x: 32, y: 65, z: 1 },
    ],
  );
});
