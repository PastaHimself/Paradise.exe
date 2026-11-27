"""Guarded repairs for existing authored full-tile floor block registrations."""

from common import BP, json_bytes, parse_json
from scaffold import Conflict, Plan, checked_path, load_models
from scaffold_geometry import cube_bounds


FLOOR_IDS = frozenset(f"paradise:ff_field_ground_{state}" for state in (
    "bare_soil", "dry_grass", "flattened_grass", "short_grass", "worn_footpath",
)) | {"paradise:ff_bare_flower_patch"}


def build_floor_collision_plan(root):
    """Repair the Ticket 3 Y64 ground tiles, never a generic prop."""
    models = load_models(root)
    plan = Plan(root)
    for block_id in sorted(FLOOR_IDS):
        relative = BP / "blocks" / f"{block_id.replace(':', '__')}.json"
        original = checked_path(root, relative).read_bytes()
        document = parse_json(original, relative.as_posix())
        block = document["minecraft:block"]
        components = block["components"]
        if (block["description"]["identifier"] != block_id or block.get("permutations")
                or "paradise:static_decor" not in components.get("minecraft:tags", [])):
            raise Conflict(f"Unexpected floor registration: {block_id}")
        geometry = components.get("minecraft:geometry")
        owners = models.get(geometry, []) if isinstance(geometry, str) else []
        if len(owners) != 1:
            raise Conflict(f"Missing or ambiguous floor geometry: {block_id}")
        model_bytes = checked_path(root, owners[0]).read_bytes()
        model = parse_json(model_bytes, owners[0].as_posix())
        entries = model["minecraft:geometry"]
        if len(entries) != 1 or len(entries[0].get("bones", [])) != 1:
            raise Conflict(f"Floor geometry is not one full tile: {block_id}")
        bone = entries[0]["bones"][0]
        cubes = bone.get("cubes", [])
        if len(cubes) != 1 or bone.get("parent"):
            raise Conflict(f"Floor geometry is not one full tile: {block_id}")
        lo, hi, rotated = cube_bounds(cubes[0], [bone])
        if rotated or lo != [-8, 0, -8] or hi != [8, 16, 8]:
            raise Conflict(f"Floor geometry is not a full cube: {block_id}")
        value = components.get("minecraft:collision_box")
        if type(value) is not bool:
            raise Conflict(f"Unexpected floor collision shape: {block_id}")
        plan.add(owners[0], model_bytes)
        if value is False:
            components["minecraft:collision_box"] = True
            plan.add(relative, json_bytes(document), merge_from=original)
        else:
            plan.add(relative, original)
    return plan


TREAD_IDS = ("paradise:es_stair_tread", "paradise:es_chipped_stair_tread_geometry")
TREAD_COLLISION = [
    {"min": [0, 0, 0], "max": [16, 8, 16]},
    {"min": [0, 8, 8], "max": [16, 16, 16]},
]


def build_stair_collision_plan(root):
    """Match both fixed tread variants to the exact ascending +Z profile."""
    from scaffold import box_component

    plan = Plan(root)
    expected = box_component(TREAD_COLLISION, "collision_box")
    for block_id in TREAD_IDS:
        relative = BP / "blocks" / f"{block_id.replace(':', '__')}.json"
        original = checked_path(root, relative).read_bytes()
        document = parse_json(original, relative.as_posix())
        block = document["minecraft:block"]
        components = block["components"]
        if (block["description"]["identifier"] != block_id or block.get("permutations")
                or "paradise:static_decor" not in components.get("minecraft:tags", [])
                or components.get("minecraft:geometry") != "geometry." + block_id.replace(":", ".")):
            raise Conflict(f"Unexpected tread registration: {block_id}")
        value = components.get("minecraft:collision_box")
        if value == expected:
            plan.add(relative, original)
        elif value is True:
            components["minecraft:collision_box"] = expected
            plan.add(relative, json_bytes(document), merge_from=original)
        else:
            raise Conflict(f"Unexpected tread collision shape: {block_id}")
    return plan
