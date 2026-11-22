import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

import * as model from "../addon/BP/scripts/yellow_halls_decor_model.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function seededCells(size, seed = 7) {
  const cells = [];
  for (let x = 0; x < size; x += 1) {
    cells[x] = [];
    for (let z = 0; z < size; z += 1) {
      cells[x][z] = { north: false, south: false, east: false, west: false };
    }
  }
  // A spanning corridor plus the four patch portals.
  for (let x = 0; x < size - 1; x += 1) {
    cells[x][3].east = true;
    cells[x + 1][3].west = true;
  }
  for (let z = 0; z < size - 1; z += 1) {
    cells[0][z].south = true;
    cells[0][z + 1].north = true;
  }
  cells[1][0].north = true;
  cells[1][size - 1].south = true;
  cells[size - 1][1].east = true;
  cells[0][1].west = true;
  // Fill the rest so the graph stays connected the way a generated patch is.
  for (let x = 0; x < size; x += 1) {
    for (let z = 0; z < size; z += 1) {
      if ((x * 31 + z * 17 + seed) % 5 !== 0) continue;
      if (x < size - 1) {
        cells[x][z].east = true;
        cells[x + 1][z].west = true;
      }
      if (z < size - 1) {
        cells[x][z].south = true;
        cells[x][z + 1].north = true;
      }
    }
  }
  return cells;
}

function reachableCount(cells, size) {
  const seen = new Set(["1,0"]);
  const stack = [[1, 0]];
  while (stack.length > 0) {
    const [x, z] = stack.pop();
    const cell = cells[x][z];
    for (const [open, nx, nz] of [
      [cell.north, x, z - 1],
      [cell.south, x, z + 1],
      [cell.west, x - 1, z],
      [cell.east, x + 1, z],
    ]) {
      if (!open || nx < 0 || nz < 0 || nx >= size || nz >= size) continue;
      const key = `${nx},${nz}`;
      if (seen.has(key)) continue;
      seen.add(key);
      stack.push([nx, nz]);
    }
  }
  return seen.size;
}

function degrees(cells, size) {
  const result = [];
  for (let x = 0; x < size; x += 1) {
    for (let z = 0; z < size; z += 1) {
      const cell = cells[x][z];
      result.push([cell.north, cell.south, cell.east, cell.west].filter(Boolean).length);
    }
  }
  return result;
}

describe("yellow halls wear surfaces", () => {
  it("keeps the wallpaper ratio inside the documented band", () => {
    const counts = { clean: 0, stained: 0, peeling: 0, water_damaged: 0 };
    for (let x = 0; x < 40; x += 1) {
      for (let y = 64; y <= 67; y += 1) {
        for (let z = 0; z < 40; z += 1) {
          counts[model.selectWallpaperState(x, y, z, { isCorner: true, nearVent: true })] += 1;
        }
      }
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    assert.ok(counts.clean / total > 0.62 && counts.clean / total < 0.74, JSON.stringify(counts));
    assert.ok(counts.water_damaged / total > 0.01 && counts.water_damaged / total < 0.09);
  });

  it("only allows peeling and water damage next to a corner or a vent", () => {
    for (let x = 0; x < 30; x += 1) {
      for (let y = 64; y <= 67; y += 1) {
        for (let z = 0; z < 30; z += 1) {
          const state = model.selectWallpaperState(x, y, z, { isCorner: false, nearVent: false });
          assert.ok(state === "clean" || state === "stained", `${x},${y},${z} -> ${state}`);
        }
      }
    }
  });

  it("wears the floor along the route and stains only the shoulder", () => {
    for (let x = 0; x < 32; x += 1) {
      for (let z = 0; z < 32; z += 1) {
        const route = model.selectFloorState(x, z, { onRoute: true });
        assert.ok(route === "base" || route === "worn_path");
        const shoulder = model.selectFloorState(x, z, { onRoute: false });
        assert.ok(shoulder === "base" || shoulder === "dark_stain");
      }
    }
  });

  it("cracks about one ceiling tile in twenty", () => {
    let cracked = 0;
    let total = 0;
    for (let x = 0; x < 64; x += 1) {
      for (let z = 0; z < 64; z += 1) {
        total += 1;
        if (model.selectCeilingState(x, z) === "cracked") cracked += 1;
      }
    }
    assert.ok(cracked / total > 0.02 && cracked / total < 0.09, `${cracked}/${total}`);
  });
});

describe("yellow halls fixture chain", () => {
  it("places a fixture every four blocks and dims the turn-adjacent one", () => {
    const plan = model.planLegFixtures(8, 0, { axis: "z" });
    assert.deepEqual(plan.map((entry) => entry.offset), [2, 6]);
    assert.equal(plan[plan.length - 1].state, "dim");
    assert.equal(plan[0].axis, "z");
  });

  it("burns out at most one fixture per even length leg", () => {
    for (let ordinal = 0; ordinal < 6; ordinal += 1) {
      const plan = model.planLegFixtures(16, ordinal, { axis: "x" });
      const burned = plan.filter((entry) => entry.state === "burned_out");
      assert.ok(burned.length <= 1);
      if (ordinal % 2 === 1) assert.equal(burned.length, 1);
      else assert.equal(burned.length, 0);
    }
  });

  it("matches the declared light emissions", () => {
    assert.equal(model.fixtureLight("lit"), 13);
    assert.equal(model.fixtureLight("dim"), 7);
    assert.equal(model.fixtureLight("burned_out"), 0);
    assert.equal(model.fixtureLight("missing_tube"), 6);
  });
});

describe("yellow halls corridor motif", () => {
  const size = 4;

  it("keeps every cell reachable and both inner cells at degree two", () => {
    const cells = seededCells(size);
    const motif = model.applyCorridorMotif(cells, size, 1, 0);
    assert.equal(motif.applied, true, motif.reason);
    assert.equal(reachableCount(motif.cells, size), size * size);
    for (const { x, z } of model.MOTIF_INNER_CELLS) {
      const degree = degrees(motif.cells, size)[x * size + z];
      assert.equal(degree, 2, `${x},${z} degree ${degree}`);
    }
  });

  it("preserves the four patch portals", () => {
    const cells = seededCells(size);
    const motif = model.applyCorridorMotif(cells, size, 1, 0);
    assert.equal(motif.cells[1][0].north, true);
    assert.equal(motif.cells[1][size - 1].south, true);
    assert.equal(motif.cells[size - 1][1].east, true);
    assert.equal(motif.cells[0][1].west, true);
  });

  it("repairs a snake patch whose inner cells are the only shortcut", () => {
    const cells = [];
    for (let x = 0; x < size; x += 1) {
      cells[x] = [];
      for (let z = 0; z < size; z += 1) cells[x][z] = { north: false, south: false, east: false, west: false };
    }
    const order = [];
    for (let x = 0; x < size; x += 1) {
      for (let step = 0; step < size; step += 1) {
        order.push([x, x % 2 === 0 ? step : size - 1 - step]);
      }
    }
    for (let index = 0; index < order.length - 1; index += 1) {
      const [ax, az] = order[index];
      const [bx, bz] = order[index + 1];
      if (bx === ax + 1) {
        cells[ax][az].east = true;
        cells[bx][bz].west = true;
      } else if (bx === ax - 1) {
        cells[ax][az].west = true;
        cells[bx][bz].east = true;
      } else if (bz === az + 1) {
        cells[ax][az].south = true;
        cells[bx][bz].north = true;
      } else {
        cells[ax][az].north = true;
        cells[bx][bz].south = true;
      }
    }
    const motif = model.applyCorridorMotif(cells, size, 1, 0);
    assert.equal(motif.applied, true, motif.reason);
    assert.equal(reachableCount(motif.cells, size), size * size);
    for (const { x, z } of model.MOTIF_INNER_CELLS) {
      assert.equal(degrees(motif.cells, size)[x * size + z], 2);
    }
  });

  it("bails out when the patch cannot be reconnected", () => {
    const cells = seededCells(size);
    for (let x = 0; x < size; x += 1) {
      for (let z = 0; z < size; z += 1) {
        cells[x][z] = { north: false, south: false, east: false, west: false };
      }
    }
    // Only the inner cells can reach the isolated far corner.
    cells[1][0].north = true;
    cells[1][1].north = true;
    cells[1][1].east = true;
    const motif = model.applyCorridorMotif(cells, size, 1, 0);
    assert.equal(motif.applied, false);
    assert.equal(motif.reason, "disconnected");
    assert.equal(motif.cells, cells);
  });

  it("is deterministic for a patch coordinate", () => {
    const a = model.applyCorridorMotif(seededCells(size), size, 1, 0);
    const b = model.applyCorridorMotif(seededCells(size), size, 1, 0);
    assert.deepEqual(a.cells, b.cells);
    assert.equal(a.closedLinks, b.closedLinks);
  });
});

describe("yellow halls block registry", () => {
  const source = readFileSync(path.join(ROOT, "addon/BP/scripts/yellow_halls_decor.js"), "utf8");
  const ids = [...new Set(source.match(/paradise:[a-z0-9_]+/g) ?? [])].sort();

  it("keeps every referenced block id under the file-name limit", () => {
    for (const id of ids) {
      const name = `${id.replace(":", "__")}.json`;
      assert.ok(name.length <= 59, `${name} is ${name.length} characters`);
    }
  });

  it("references only block ids that exist in the behavior pack", () => {
    const missing = ids.filter(
      (id) => !existsSync(path.join(ROOT, "addon/BP/blocks", `${id.replace(":", "__")}.json`)),
    );
    assert.deepEqual(missing, []);
  });
});
