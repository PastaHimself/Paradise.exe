import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as model from "../addon/BP/scripts/library_decor_model.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

describe("library surfaces", () => {
  it("keeps the protected traversal cross free of shelf rows", () => {
    for (let x = 0; x < 16; x += 1) {
      for (let z = 0; z < 16; z += 1) {
        const cross = model.isCross(x, z);
        assert.equal(cross, (x >= 7 && x <= 8) || (z >= 7 && z <= 8));
      }
    }
    for (const rowX of model.shelfRowsFor(0)) {
      assert.ok(!model.isCross(rowX, 4) || rowX === 3 || rowX === 11);
    }
  });

  it("replaces west-room shelf rows to preserve the three-block aisle", () => {
    assert.deepEqual(model.shelfRowsFor(true), [2, 6]);
    assert.deepEqual(model.shelfRowsFor(false), [3, 11]);
  });

  it("samples full, sparse and empty tiers by local z mod 6", () => {
    assert.deepEqual([0, 1, 2, 3, 4, 5].map(model.shelfStateFor), ["full", "full", "sparse", "sparse", "full", "empty"]);
    assert.equal(model.isShelfEndcap(0), true);
    assert.equal(model.isShelfEndcap(15), true);
    assert.equal(model.isShelfEndcap(7), false);
  });

  it("cracks roughly one plaster panel in eight and never on the cross", () => {
    let panels = 0;
    for (let x = 0; x < 64; x += 1) {
      for (let z = 0; z < 64; z += 1) {
        if (model.isPlasterPanel(x, 69, z)) {
          panels += 1;
          assert.equal(model.isCross(x, z), false);
        }
      }
    }
    const ratio = panels / (64 * 64);
    assert.ok(ratio > 0.06 && ratio < 0.18, String(ratio));
  });

  it("keeps the restricted reservation empty and exact", () => {
    const { min, max } = model.RESTRICTED_RESERVE;
    assert.deepEqual(min, [10, 65, 12]);
    assert.deepEqual(max, [13, 68, 14]);
    assert.equal(model.isReserved(10, 65, 12), true);
    assert.equal(model.isReserved(13, 68, 14), true);
    assert.equal(model.isReserved(14, 65, 12), false);
    assert.equal(model.isReserved(10, 69, 12), false);
    assert.equal(model.isReserved(12, 66, 13), true);
  });
});

describe("library lighting", () => {
  it("keeps the lit anchors and alternates only in low-power rooms", () => {
    for (let index = 0; index < model.AISLE_LIGHT_ANCHORS.length; index += 1) {
      assert.equal(model.aisleLightStateFor(index, false), "lit");
    }
    assert.equal(model.aisleLightStateFor(0, true), "lit");
    assert.equal(model.aisleLightStateFor(1, true), "unlit");
    assert.equal(model.aisleLightStateFor(2, true), "lit");
  });

  it("covers the five documented light anchors", () => {
    assert.deepEqual(model.AISLE_LIGHT_ANCHORS, [
      { x: 4, z: 4 },
      { x: 10, z: 4 },
      { x: 4, z: 11 },
      { x: 11, z: 11 },
      { x: 10, z: 13 },
    ]);
  });

  it("declares the documented emissions", () => {
    assert.deepEqual(model.LIBRARY_LIGHT.lit, [
      "paradise:lib_aisle_light_x0_y0_z0",
      "paradise:lib_aisle_light_x1_y0_z0",
    ]);
    assert.deepEqual(model.LIBRARY_LIGHT.unlit, [
      "paradise:lib_aisle_light_unlit_x0_y0_z0",
      "paradise:lib_aisle_light_unlit_x1_y0_z0",
    ]);
    assert.equal(model.LIBRARY_LIGHT.deskLit, "paradise:lib_desk_lamp");
  });
});

describe("library block registry", () => {
  const source = readFileSync(path.join(ROOT, "addon/BP/scripts/library_decor_model.js"), "utf8");
  const ids = [...new Set(source.match(/paradise:[a-z0-9_]+/g) ?? [])].sort();

  it("references only block ids that exist in the behavior pack", () => {
    const missing = ids.filter((id) => !existsSync(path.join(ROOT, "addon/BP/blocks", `${id.replace(":", "__")}.json`)));
    assert.deepEqual(missing, []);
  });

  it("keeps every referenced id under the file-name limit", () => {
    for (const id of ids) assert.ok(`${id.replace(":", "__")}.json`.length <= 59, id);
  });
});
