import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  mergeYellowHallsPatchBuildOptions,
  resolveSavedReturnDestination,
} from "../addon/BP/scripts/yellow_halls_lifecycle.js";

const source = readFileSync(new URL("../addon/BP/scripts/yellow_halls.js", import.meta.url), "utf8");

describe("Yellow Halls player lifecycle", () => {
  it("returns to the saved source dimension and exact location", () => {
    assert.deepEqual(resolveSavedReturnDestination({
      dimensionId: "library:the_library",
      location: { x: -18.5, y: 66, z: 32.25 },
    }), {
      dimensionId: "library:the_library",
      location: { x: -18.5, y: 66, z: 32.25 },
    });
  });

  it("rejects incomplete or non-finite return destinations", () => {
    assert.equal(resolveSavedReturnDestination(undefined), undefined);
    assert.equal(resolveSavedReturnDestination({ dimensionId: "", location: { x: 0, y: 64, z: 0 } }), undefined);
    assert.equal(resolveSavedReturnDestination({ dimensionId: "minecraft:overworld", location: { x: 0, y: NaN, z: 0 } }), undefined);
  });

  it("merges force and all pending escape owners into a not-yet-started patch request", () => {
    const current = {
      force: false,
      includePendingEscapePlayerIds: new Set(["player-a"]),
    };

    assert.equal(mergeYellowHallsPatchBuildOptions(current, {
      force: true,
      includePendingEscapePlayerIds: new Set(["player-b"]),
    }), true);
    assert.equal(current.force, true);
    assert.deepEqual([...current.includePendingEscapePlayerIds].sort(), ["player-a", "player-b"]);

    assert.equal(mergeYellowHallsPatchBuildOptions(current, {
      force: true,
      includePendingEscapePlayerIds: new Set(["player-a", "player-b"]),
    }), false);
  });

  it("uses the saved destination instead of hard-coding the Overworld", () => {
    assert.match(source, /world\.getDimension\(returnDestination\.dimensionId\)/);
    assert.match(source, /verifiedPlayerTeleport\(player, returnDestination\.location/);
    assert.doesNotMatch(source, /world\.getDimension\("minecraft:overworld"\)/);
  });

  it("cleans player-owned escape state on disconnect", () => {
    assert.match(source, /world\.afterEvents\.playerLeave\.subscribe\(\(event\) => clearStateForLeavingPlayer\(event\.playerId\)\)/);
    assert.match(source, /state\.pendingEscapes\.delete\(playerId\)/);
    assert.match(source, /state\.activeEscapes\.delete\(playerId\)/);
    assert.match(source, /state\.returnPoints\.delete\(playerId\)/);
    assert.match(source, /clearRuleState\(state\.confidenceRules, playerId\)/);
  });

  it("does not force-regenerate the entry patch after every successful entry", () => {
    const entryStart = source.indexOf("async function enterYellowHalls(player)");
    const entryEnd = source.indexOf("function runYellowHallsEntryCommand", entryStart);
    const entrySource = source.slice(entryStart, entryEnd);
    assert.doesNotMatch(entrySource, /force:\s*true/);
  });

  it("invalidates the old escape button before rebuilding its patch while preserving other special sites", () => {
    const escapeStart = source.indexOf("async function escapePlayerFromYellowHalls(player)");
    const escapeEnd = source.indexOf("function getYellowConfidenceState", escapeStart);
    const escapeSource = source.slice(escapeStart, escapeEnd);
    assert.match(escapeSource, /escape\.buttonLocation = undefined;\s*const rebuilt = await getPatchJob/);
    assert.match(escapeSource, /if \(!rebuilt\) throw new Error\("Escape patch rebuild did not complete\."\)/);
    assert.doesNotMatch(escapeSource, /suppressSpecialSites/);
    assert.match(escapeSource, /catch \(error\) \{\s*await prepareEscapeSite\(player\.id, \{ includePendingEscape: true \}\)/);
  });

  it("rebuilds the escape room during failed-teleport recovery while the escape remains pending", () => {
    assert.match(source, /prepareEscapeSite\(player\.id, \{ includePendingEscape: true \}\)/);
    assert.match(source, /options\.includePendingEscapePlayerIds\?\.has\(playerId\)/);
    assert.match(source, /applySpecialSitesForPatch\(finalWriteDimension, patchX, patchZ, options\)/);
  });

  it("keeps the patch ticking area until its queued module placement completes", () => {
    assert.match(source, /await scheduleYellowHallsModule\(/);
    assert.match(source, /const placed = await scheduleStructurePlacement\(/);
    assert.match(source, /if \(isEscapeCellForAnyPlayer\(patchX, patchZ, candidate\.cx, candidate\.cz\)\) return false/);
  });
});
