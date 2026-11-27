import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  clearPlayerEntries,
  collectOccupiedFlowerPatches,
  collectUniqueFlowerPatches,
} from "../addon/BP/scripts/flat_flower_lifecycle.js";

describe("Flat Flower multiplayer ownership", () => {
  it("reserves true and false flower patches belonging to other players only", () => {
    const activeFlowers = new Map([
      ["player-a", {
        patchX: -8,
        patchZ: 4,
        falseFlowers: [{ patchX: -7, patchZ: 4 }, { patchX: -8, patchZ: 5 }],
      }],
      ["player-b", {
        patchX: 10,
        patchZ: -2,
        falseFlowers: [{ patchX: 11, patchZ: -2 }],
      }],
    ]);

    assert.deepEqual(
      [...collectOccupiedFlowerPatches(activeFlowers, "player-b")].sort(),
      ["-7:4", "-8:4", "-8:5"],
    );
    assert.deepEqual(
      [...collectOccupiedFlowerPatches(activeFlowers, "player-a")].sort(),
      ["10:-2", "11:-2"],
    );
  });

  it("prepares each unique patch once even when several flowers share it", () => {
    const flower = {
      patchX: -1,
      patchZ: 0,
      falseFlowers: [
        { patchX: -1, patchZ: 0 },
        { patchX: 0, patchZ: -1 },
        { patchX: 0, patchZ: -1 },
        { patchX: 1, patchZ: 0 },
      ],
    };
    assert.deepEqual(collectUniqueFlowerPatches(flower), [
      { patchX: -1, patchZ: 0 },
      { patchX: 0, patchZ: -1 },
      { patchX: 1, patchZ: 0 },
    ]);
  });

  it("clears only the disconnected player's state and preserves other players", () => {
    const pendingEscapes = new Set(["player-a", "player-b"]);
    const activeFlowers = new Map([[
      "player-a", { patchX: 0, patchZ: 0 },
    ], [
      "player-b", { patchX: 1, patchZ: 1 },
    ]]);
    const returnPoints = new Map([[
      "player-a", { dimensionId: "minecraft:overworld" },
    ], [
      "player-b", { dimensionId: "minecraft:overworld" },
    ]]);

    clearPlayerEntries("player-a", [pendingEscapes, activeFlowers, returnPoints]);

    assert.equal(pendingEscapes.has("player-a"), false);
    assert.equal(activeFlowers.has("player-a"), false);
    assert.equal(returnPoints.has("player-a"), false);
    assert.equal(pendingEscapes.has("player-b"), true);
    assert.equal(activeFlowers.has("player-b"), true);
    assert.equal(returnPoints.has("player-b"), true);
  });

  it("keeps forced patch requests single-flight and does not reseed shared terrain on player entry", () => {
    const source = readFileSync(new URL("../addon/BP/scripts/flat_flower.js", import.meta.url), "utf8");
    assert.match(source, /if \(existingJob\) return existingJob;/);
    assert.doesNotMatch(source, /options\.force !== true/);
    assert.doesNotMatch(source, /state\.runSeed\s*=/);
    assert.doesNotMatch(source, /state\.generatedPatches\.clear\(\)/);
    assert.match(source, /runSingleFlight\(state\.patchJobs, key/);
  });

  it("subscribes disconnect cleanup to playerLeave rather than relying on dimension changes", () => {
    const source = readFileSync(new URL("../addon/BP/scripts/flat_flower.js", import.meta.url), "utf8");
    assert.match(source, /world\.afterEvents\.playerLeave\.subscribe\(\(event\) => clearStateForLeavingPlayer\(event\.playerId\)\)/);
    assert.match(source, /clearPlayerEntries\(playerId, \[state\.pendingEscapes, state\.activeFlowers, state\.returnPoints\]\)/);
  });
});
