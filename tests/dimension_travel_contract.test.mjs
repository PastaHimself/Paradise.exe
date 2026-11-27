import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("..", import.meta.url);
const dimensionPlan = readFileSync(new URL("addon/BP/scripts/paradise_dimension_plan.js", root), "utf8");
const yellowHalls = readFileSync(new URL("addon/BP/scripts/yellow_halls.js", root), "utf8");
const library = readFileSync(new URL("addon/BP/scripts/library.js", root), "utf8");

test("Yellow Halls ARCHIVE pad targets the Library at the canonical anchor offset", () => {
  assert.match(dimensionPlan, /\[DIMENSION\.library\]: \{ name: "Library", enter: enterLibrary \}/);
  assert.match(
    dimensionPlan,
    /\{ key: "yellow-archive", dx: -10, dz: 0, block: "minecraft:bookshelf", label: "ARCHIVE", target: DIMENSION\.library/,
  );
  assert.match(dimensionPlan, /const center = offset\(anchor\.location, definition\.dx, 0, definition\.dz\)/);
  assert.match(dimensionPlan, /distanceSquared\(player\.location, pad\.location\) > 2\.6 \* 2\.6/);
  assert.match(dimensionPlan, /void enterTargetDimension\(player, pad\.target, pad\.reason, \{ connection: true \}\)/);
  assert.match(dimensionPlan, /const entered = await target\.enter\(player\)/);
  assert.match(library, /export async function enterLibrary\(player\)/);
});

test("Library travel keeps the original Yellow Halls return button and Overworld destination", () => {
  assert.match(yellowHalls, /const returnDestination = resolveSavedReturnDestination\(getSavedReturnPoint\(player\.id\)\)/);
  assert.match(yellowHalls, /world\.getDimension\(returnDestination\.dimensionId\)/);
  assert.match(yellowHalls, /verifiedPlayerTeleport\(player, returnDestination\.location/);
  assert.match(library, /returnPoints\.set\(player\.id, \{\s*dimensionId: player\.dimension\.id/);
  assert.match(library, /const targetDimId = saved \? saved\.dimensionId : "minecraft:overworld"/);
});
