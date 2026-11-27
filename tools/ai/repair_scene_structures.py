"""Reviewed, byte-preserving repairs to the authored highway and Heaven masks."""
import argparse
import json
from pathlib import Path
import struct
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from validate_mcstructures import LittleEndianNBTReader
from scaffold import Plan, scaffold_lock
from geometry_reuse import plan_digest

BASE = Path("addon/BP/structures/paradise")


class SpanReader(LittleEndianNBTReader):
    def __init__(self, data):
        super().__init__(data)
        self.spans = {}

    def read_payload(self, tag_type, label):
        start = self.offset
        result = super().read_payload(tag_type, label)
        self.spans[label] = (start, self.offset, tag_type)
        return result


def nbt_string(value):
    encoded = value.encode("utf-8")
    return struct.pack("<h", len(encoded)) + encoded


def palette_entry(name, version, facing=None):
    state = b""
    if facing:
        state = b"\x08" + nbt_string("minecraft:cardinal_direction") + nbt_string(facing)
    return (b"\x08" + nbt_string("name") + nbt_string(name)
            + b"\x03" + nbt_string("version") + struct.pack("<i", version)
            + b"\x0a" + nbt_string("states") + state + b"\x00\x00")


def patch_cells(data, updates):
    reader = SpanReader(data)
    original = reader.read_root()
    if reader.remaining():
        raise ValueError("Unexpected trailing structure bytes")
    sx, sy, sz = original["size"]
    structure = original["structure"]
    palette = structure["palette"]["default"]["block_palette"]
    indices = list(structure["block_indices"][0])
    if len(indices) != sx * sy * sz or structure["entities"]:
        raise ValueError("Unexpected structure metadata")
    new_entries = []
    for (x, y, z), (name, facing) in sorted(updates.items()):
        if not (0 <= x < sx and 0 <= y < sy and 0 <= z < sz):
            raise ValueError(f"Outside authored structure: {(x,y,z)}")
        states = {"minecraft:cardinal_direction": facing} if facing else {}
        entry = next((i for i, block in enumerate(palette)
                      if block["name"] == name and block["states"] == states), None)
        if entry is None:
            entry = len(palette)
            palette.append({"name": name, "states": states, "version": palette[0]["version"]})
            new_entries.append(palette_entry(name, palette[0]["version"], facing))
        indices[(x * sy + y) * sz + z] = entry
    p0, p1, pt = reader.spans["root.structure.palette.default.block_palette"]
    i0, i1, it = reader.spans["root.structure.block_indices[0]"]
    if pt != 9 or it != 9 or data[p0] != 10 or data[i0] != 3:
        raise ValueError("Unexpected palette or block-index list encoding")
    replacements = [
        (p0, p1, b"\x0a" + struct.pack("<i", len(palette)) + data[p0+5:p1] + b"".join(new_entries)),
        (i0, i1, b"\x03" + struct.pack("<i", len(indices)) + struct.pack(f"<{len(indices)}i", *indices)),
    ]
    patched = data
    for start, end, content in sorted(replacements, reverse=True):
        patched = patched[:start] + content + patched[end:]
    parsed = LittleEndianNBTReader(patched).read_root()
    if parsed["structure"]["block_indices"][0] != indices:
        raise ValueError("Round-trip index mismatch")
    if parsed["structure"]["block_indices"][1] != structure["block_indices"][1]:
        raise ValueError("Secondary layer changed")
    if parsed["structure"]["palette"]["default"]["block_palette"] != palette:
        raise ValueError("Round-trip palette mismatch")
    return patched


def scene_updates():
    wreck = {}
    for x, z, dx, dz in [(2, 2, 0, 0), (3, 2, 1, 0), (2, 3, 0, 1), (3, 3, 1, 1)]:
        wreck[(x, 1, z)] = (f"paradise:bh_burned_out_vehicle_shell_x{dx}_y0_z{dz}", "north")
    for x, z, name in [(1, 3, "detached_wheel"), (4, 3, "broken_bumper_x0_y0_z0"),
                       (5, 3, "broken_bumper_x1_y0_z0"), (5, 2, "loose_vehicle_door"), (6, 4, "scrap_pile")]:
        wreck[(x, 1, z)] = ("paradise:bh_" + name, "north")
    for x, _, z in list(wreck):
        wreck[(x, 0, z)] = ("minecraft:deepslate_tiles", None)
        for y in (2, 3):
            wreck[(x, y, z)] = ("minecraft:air", None)
    pool = {(x, 0, z): ("minecraft:cyan_stained_glass", None)
            for x in range(1, 11) for z in range(1, 11)}
    for x in (0, 11):
        for z in (0, 11):
            pool[(x, 0, z)] = ("minecraft:gold_block", None)
    for x in (5, 6):
        pool[(x, 0, 0)] = ("minecraft:smooth_quartz", None)
        pool[(x, 1, 0)] = ("minecraft:air", None)
    temple = {(x, y, z): ("minecraft:air", None)
              for x in range(8, 16) for y in range(2, 7) for z in range(8, 16)}
    temple.update({(x, 2, z): ("minecraft:smooth_quartz", None)
                   for x in range(9, 15) for z in range(9, 15)})
    temple.update({(x, 2, z): ("minecraft:smooth_quartz", None)
                   for x in range(10, 14) for z in range(6, 9)})
    return {"burning_highway/wreck_cluster": wreck, "heaven/reflection_pool": pool,
            "heaven/distant_temple": temple}


def build_plan(root):
    plan = Plan(root)
    for name, updates in scene_updates().items():
        relative = BASE / (name + ".mcstructure")
        before = (root / relative).read_bytes()
        for block, facing in updates.values():
            if block.startswith("paradise:"):
                definition = root / "addon/BP/blocks" / (block.replace(":", "__") + ".json")
                document = json.loads(definition.read_text())["minecraft:block"]
                if document["description"]["identifier"] != block:
                    raise ValueError(f"Unknown registration: {block}")
                if facing and "minecraft:placement_direction" not in document["description"].get("traits", {}):
                    raise ValueError(f"Missing facing state: {block}")
        plan.add(relative, patch_cells(before, updates), merge_from=before)
    return plan


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--expected-plan")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    with scaffold_lock(root, args.apply):
        plan = build_plan(root)
        digest = plan_digest(plan)
        if args.apply:
            if digest != args.expected_plan:
                parser.error("Use the exact reviewed --expected-plan digest")
            plan.apply()
        print(json.dumps({"plan_sha256": digest, "files": plan.summary()}, indent=2))


if __name__ == "__main__":
    main()
