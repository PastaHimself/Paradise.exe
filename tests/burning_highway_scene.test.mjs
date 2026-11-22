import test from "node:test";
import assert from "node:assert/strict";

import {
  OVERLAY_Y,
  ROAD_Y,
  SKID_END,
  SKID_START,
  SURFACE,
  TURNOUT,
  TURNOUT_END,
  TURNOUT_START,
  WRECK_CELLS,
  WRECK_FITTINGS,
  WRECK_SHELL_SEGMENTS,
  wreckFittingPlacements,
  wreckSegmentPlacements,
  dividerBlock,
  isRoadOverlaySafe,
  isTurnoutEntry,
  ribRows,
  surfaceOverlay,
  wreckOrigin,
} from "../addon/BP/scripts/burning_highway_scene.js";

test("lane line only paints the documented windows", () => {
  assert.equal(surfaceOverlay(-2, 17, 300), SURFACE.lane);
  assert.equal(surfaceOverlay(-2, 20, 300), SURFACE.plain);
  assert.equal(surfaceOverlay(-2, 5, 300), null);
  assert.equal(surfaceOverlay(-2, 290, 300), null);
});

test("shoulder stripes, skids, cracks and heat sit on their own rows", () => {
  assert.equal(surfaceOverlay(-3, 20, 300), SURFACE.shoulder);
  assert.equal(surfaceOverlay(3, 20, 300), SURFACE.shoulder);
  for (let z = SKID_START; z <= SKID_END; z++) {
    assert.equal(surfaceOverlay(-1, z, 300), SURFACE.skid);
  }
  assert.equal(surfaceOverlay(3, 34, 300), SURFACE.cracked);
  assert.equal(surfaceOverlay(-3, 46, 300), SURFACE.heat);
  assert.equal(surfaceOverlay(0, 20, 300), SURFACE.plain);
});

test("the turnout paints plain asphalt with a merge arrow at Z125", () => {
  assert.equal(surfaceOverlay(1, 125, 300), TURNOUT.arrow);
  assert.equal(surfaceOverlay(-2, 110, 300), SURFACE.plain);
  assert.equal(surfaceOverlay(4, 110, 300), null);
  assert.equal(TURNOUT_START, 96);
  assert.equal(TURNOUT_END, 127);
});

test("divider states follow the Z schedule and entries stay open", () => {
  assert.equal(dividerBlock(98), null);
  assert.equal(dividerBlock(99), TURNOUT.clean);
  assert.equal(dividerBlock(106), TURNOUT.damaged);
  assert.equal(dividerBlock(107), TURNOUT.damaged);
  assert.equal(dividerBlock(115), TURNOUT.clean);
  assert.equal(dividerBlock(120), TURNOUT.guard);
  assert.equal(dividerBlock(124), TURNOUT.endCap);
  assert.equal(dividerBlock(125), null);
  assert.equal(isTurnoutEntry(96), true);
  assert.equal(isTurnoutEntry(110), false);
  assert.equal(isTurnoutEntry(126), true);
});

test("ribs skip the turnout and the finish area", () => {
  const rows = ribRows(400);
  assert.ok(rows.includes(48));
  assert.ok(!rows.some((z) => z >= 94 && z <= 128));
  assert.ok(!rows.some((z) => z >= 400 - 24));
  assert.deepEqual(ribRows(90), [48]);
  assert.deepEqual(ribRows(70), []);
});

test("wreck origin stays on the service side and inside the lane", () => {
  const origin = wreckOrigin(2000, 380, 0);
  assert.equal(origin.x, 2009);
  assert.equal(origin.y, ROAD_Y);
  assert.ok(origin.z <= 350);
  assert.ok(origin.z >= 286);
  for (const [x] of WRECK_CELLS) assert.ok(x >= 2);
  for (const fitting of WRECK_FITTINGS) assert.ok(fitting.block.startsWith("paradise:bh_"));
});

test("the four shell segments land in the wreck cluster cells", () => {
  const origin = { x: 2009, y: 64, z: 290 };
  const placements = wreckSegmentPlacements(origin);
  assert.deepEqual(WRECK_SHELL_SEGMENTS.map((s) => s.cell), [[2, 1, 2], [3, 1, 2], [2, 1, 3], [3, 1, 3]]);
  assert.deepEqual(placements.map((p) => [p.x, p.y, p.z]), [
    [2011, 65, 292],
    [2012, 65, 292],
    [2011, 65, 293],
    [2012, 65, 293],
  ]);
  assert.equal(new Set(placements.map((p) => p.block)).size, 4);
  const fittings = wreckFittingPlacements(origin);
  assert.deepEqual(fittings.map((p) => [p.x, p.z]), [[2010, 293], [2013, 293], [2014, 292], [2015, 294]]);
});

test("overlays never leave the road-to-lip band", () => {
  assert.equal(isRoadOverlaySafe(ROAD_Y), true);
  assert.equal(isRoadOverlaySafe(OVERLAY_Y), true);
  assert.equal(isRoadOverlaySafe(63), false);
  assert.equal(isRoadOverlaySafe(67), false);
});
