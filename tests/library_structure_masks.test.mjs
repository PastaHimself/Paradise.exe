import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { describe, it } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const STRUCTURE_CHECK = String.raw`
import json
import sys
from pathlib import Path
sys.path.insert(0, 'tools')
from validate_mcstructures import LittleEndianNBTReader, parse_palette

result={}
for path in Path('addon/BP/structures/paradise/library').glob('*.mcstructure'):
    root=LittleEndianNBTReader(path.read_bytes()).read_root()
    sx,sy,sz=root['size']
    indices=root['structure']['block_indices'][0]
    palette=parse_palette(root['structure']['palette']['default']['block_palette'])
    cells={}
    for y in range(sy):
        for z in range(sz):
            for x in range(sx):
                index=(x*sy+y)*sz+z
                cells[f'{x},{y},{z}']=palette[indices[index]] if indices[index]>=0 else 'minecraft:structure_void'
    result[path.stem]={
        'size':[sx,sy,sz],
        'cells':cells,
        'secondary_unchanged':all(value==-1 for value in root['structure']['block_indices'][1]),
        'entities':len(root['structure']['entities']),
    }
print(json.dumps(result))
`;

const structures = JSON.parse(execFileSync("python3", ["-c", STRUCTURE_CHECK], {
  cwd: ROOT,
  encoding: "utf8",
}));

function cell(name, x, y, z) {
  return structures[name].cells[`${x},${y},${z}`];
}

describe("Library authored structure masks", () => {
  it("keeps exact authored sizes, secondary layers and entity metadata", () => {
    assert.deepEqual(Object.keys(structures).sort(), [
      "archive_frame", "central_monument", "reading_alcove", "upper_balcony",
    ]);
    assert.deepEqual(structures.archive_frame.size, [7, 8, 3]);
    assert.deepEqual(structures.central_monument.size, [8, 4, 8]);
    assert.deepEqual(structures.reading_alcove.size, [6, 6, 5]);
    assert.deepEqual(structures.upper_balcony.size, [9, 8, 7]);
    for (const structure of Object.values(structures)) {
      assert.equal(structure.secondary_unchanged, true);
      assert.ok(structure.entities >= 0);
    }
  });

  it("leaves archive frame front planes untouched and masks its lower reserved back plane", () => {
    for (let x = 0; x < 7; x += 1) {
      for (let y = 0; y < 8; y += 1) {
        for (const z of [0, 1]) {
          assert.equal(cell("archive_frame", x, y, z), "minecraft:structure_void", `${x},${y},${z}`);
        }
      }
    }
    for (let x = 2; x <= 5; x += 1) {
      for (let y = 0; y <= 3; y += 1) {
        const type = cell("archive_frame", x, y, 2);
        assert.ok(type === "minecraft:structure_void" || (x === 5 && y === 3 && type.startsWith("paradise:sh_door_frame_trim")), `${x},${y},2=${type}`);
      }
    }
    assert.equal(cell("archive_frame", 1, 3, 2), "paradise:sh_door_frame_trim_iron_x0_y0_z0");
    assert.equal(cell("archive_frame", 5, 3, 2), "paradise:sh_door_frame_trim_iron_x0_y0_z0");
    assert.equal(cell("archive_frame", 3, 5, 2), "paradise:sh_small_wall_plate_iron");
  });

  it("keeps the reading carrel and lamp wall-side while leaving the centre aisle clear", () => {
    assert.equal(cell("reading_alcove", 0, 0, 2), "paradise:lib_study_carrel_x0_y0_z0");
    assert.equal(cell("reading_alcove", 1, 2, 3), "paradise:lib_desk_lamp");
    for (let y = 0; y <= 2; y += 1) {
      for (const x of [2, 3]) {
        for (const z of [2, 3]) {
          assert.equal(cell("reading_alcove", x, y, z), "minecraft:structure_void", `${x},${y},${z}`);
        }
      }
    }
    assert.equal(cell("reading_alcove", 2, 0, 0), "minecraft:structure_void");
  });

  it("preserves the monument upper clearance and balcony rail material", () => {
    const monument = Object.values(structures.central_monument.cells);
    const balcony = Object.values(structures.upper_balcony.cells);
    assert.ok(monument.includes("minecraft:sea_lantern"));
    assert.ok(balcony.includes("minecraft:iron_bars"));
    assert.ok(monument.includes("minecraft:structure_void"));
    for (let y = 0; y <= 2; y += 1) {
      for (let z = 0; z < 7; z += 1) {
        for (const x of [6, 7]) {
          assert.equal(cell("upper_balcony", x, y, z), "minecraft:structure_void", `${x},${y},${z}`);
        }
      }
    }
  });
});
