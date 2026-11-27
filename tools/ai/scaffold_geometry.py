"""Stage static Bedrock cube geometry into block-sized cells."""

from copy import deepcopy
from itertools import product
from math import ceil, cos, floor, isfinite, radians, sin

CELL_MIN = (-8, 0, -8)
CELL_MAX = (8, 16, 8)
EPSILON = 1e-7
CUSTOM_BLOCK_MIN = (-14, -14, -14)
CUSTOM_BLOCK_MAX = (30, 30, 30)
CUSTOM_BLOCK_MAX_SIZE = 30
CUSTOM_BLOCK_MAX_CENTER_OFFSET = 7
CUSTOM_BLOCK_MIN_CELL_INTERSECTION = 1
# Axes and edge directions in the Bedrock JSON exported by Blockbench.
# Each tuple records U axis, V axis, normal axis, and the three signs.
FACE_AXES = {
    "north": (0, 1, 2, 1, -1, -1),
    "south": (0, 1, 2, -1, -1, 1),
    "east": (2, 1, 0, -1, -1, -1),
    "west": (2, 1, 0, 1, -1, 1),
    "up": (0, 2, 1, 1, -1, 1),
    "down": (0, 2, 1, 1, 1, -1),
}


def vector(value, length, label):
    if (not isinstance(value, list) or len(value) != length
            or any(type(n) not in (int, float) or not isfinite(n) for n in value)):
        raise ValueError(f"{label} must have {length} finite numbers")
    return value


def translated(point, delta):
    return [round(x + shift, 9) for x, shift in zip(point, delta)]


def rotate(point, pivot, angles, positive_z_rotation=False):
    x, y, z = (v - p for v, p in zip(point, pivot))
    # Convert Bedrock static geometry axes to the ZYX rotation convention.
    z_angle = angles[2] if positive_z_rotation else -angles[2]
    a, b, c = (radians(-angles[0]), radians(angles[1]), radians(z_angle))
    y, z = y * cos(a) - z * sin(a), y * sin(a) + z * cos(a)
    x, z = x * cos(b) + z * sin(b), -x * sin(b) + z * cos(b)
    x, y = x * cos(c) - y * sin(c), x * sin(c) + y * cos(c)
    return translated((x, y, z), pivot)


def cube_bounds(cube, ancestors, positive_z_rotation=False):
    origin = vector(cube["origin"], 3, "cube origin")
    size = vector(cube["size"], 3, "cube size")
    if any(n < 0 for n in size) or sum(n > 0 for n in size) < 2:
        raise ValueError("Cube sizes must describe a non-empty cuboid or plane")
    inflate = cube.get("inflate", ancestors[0].get("inflate", 0))
    vector([inflate], 1, "inflate")
    lo = [v - inflate for v in origin]
    hi = [v + n + inflate for v, n in zip(origin, size)]
    if any(a > b for a, b in zip(lo, hi)):
        raise ValueError("Cube inflate inverts its bounds")
    transforms = [
        (vector(item.get("pivot", [0, 0, 0]), 3, "pivot"),
         vector(item.get("rotation", [0, 0, 0]), 3, "rotation"))
        for item in (cube, *ancestors) if any(item.get("rotation", []))
    ]
    corners = list(product(*zip(lo, hi)))
    for pivot, angles in transforms:
        corners = [rotate(point, pivot, angles, positive_z_rotation) for point in corners]
    return ([min(axis) for axis in zip(*corners)],
            [max(axis) for axis in zip(*corners)], bool(transforms))


def inside(lo, hi, lower=CELL_MIN, upper=CELL_MAX, epsilon=EPSILON):
    return all(v >= limit - epsilon for v, limit in zip(lo, lower)) and all(
        v <= limit + epsilon for v, limit in zip(hi, upper)
    )


def fractional_range(axis, sign, lo, hi, cut_lo, cut_hi):
    span = hi[axis] - lo[axis]
    if span <= EPSILON:
        return (0, 1)
    first = (cut_lo[axis] - lo[axis]) / span
    last = (cut_hi[axis] - lo[axis]) / span
    return (first, last) if sign == 1 else (1 - last, 1 - first)


def face_uvs(cube):
    uv = cube.get("uv")
    if isinstance(uv, dict):
        return uv
    u, v = vector(uv, 2, "box UV origin")
    x, y, z = cube["size"]
    return {
        "east": {"uv": [u, v + z], "uv_size": [z, y]},
        "west": {"uv": [u + z + x, v + z], "uv_size": [z, y]},
        "north": {"uv": [u + z, v + z], "uv_size": [x, y]},
        "south": {"uv": [u + 2 * z + x, v + z], "uv_size": [x, y]},
        "up": {"uv": [u + z, v], "uv_size": [x, z]},
        "down": {"uv": [u + z + x, v + z], "uv_size": [x, -z]},
    }


def clipped_faces(faces, lo, hi, cut_lo, cut_hi):
    output = {}
    for name, face in faces.items():
        if name not in FACE_AXES:
            raise ValueError(f"Unknown face {name}")
        u, v, normal, u_sign, v_sign, outward = FACE_AXES[name]
        positive = outward > 0
        if (positive and cut_hi[normal] < hi[normal] - EPSILON
                or not positive and cut_lo[normal] > lo[normal] + EPSILON):
            continue
        if "uv_size" not in face:
            raise ValueError("A split face requires explicit uv_size")
        uv = vector(face["uv"], 2, "uv")
        size = vector(face["uv_size"], 2, "uv_size")
        a, b = fractional_range(u, u_sign, lo, hi, cut_lo, cut_hi)
        c, d = fractional_range(v, v_sign, lo, hi, cut_lo, cut_hi)
        # Express the retained face rectangle in the source atlas axes.
        rotation = face.get("uv_rotation", 0)
        if type(rotation) is not int or rotation not in (0, 90, 180, 270):
            raise ValueError("Face UV rotation must be a multiple of 90")
        a, b, c, d = {
            0: (a, b, c, d), 90: (c, d, 1 - b, 1 - a),
            180: (1 - b, 1 - a, 1 - d, 1 - c), 270: (1 - d, 1 - c, a, b),
        }[rotation]
        output[name] = {**face, "uv": translated(uv, (a * size[0], c * size[1])),
                        "uv_size": [round((b - a) * size[0], 9), round((d - c) * size[1], 9)]}
    return output


def read_cubes(model, positive_z_rotation=False):
    bones = model.get("bones", [])
    by_name = {bone["name"]: bone for bone in bones}
    if len(bones) != len(by_name):
        raise ValueError("Geometry bone names must be unique")
    for i, bone in enumerate(bones):
        parents = [bone]
        seen = {bone["name"]}
        while (parent := parents[-1].get("parent")) is not None:
            if parent in seen or parent not in by_name:
                raise ValueError(f"Invalid bone parent {parent!r}")
            parents.append(by_name[parent])
            seen.add(parent)
        if any(key in bone for key in ("poly_mesh", "texture_meshes", "locators")):
            raise ValueError("Static scaffold supports cube bones only")
        for cube in bone.get("cubes", []):
            yield i, cube, *cube_bounds(cube, parents, positive_z_rotation), cube.get("mirror", bone.get("mirror", False))


def shifted_geometry(model, cell_cubes, delta):
    result = deepcopy(model)
    description = result.get("description", {})
    if "visible_bounds_offset" in description:
        description["visible_bounds_offset"] = translated(description["visible_bounds_offset"], delta)
    for i, bone in enumerate(result.get("bones", [])):
        # A missing pivot means the model origin. Translate it as well so
        # inherited rotations preserve their center in the segment.
        bone["pivot"] = translated(bone.get("pivot", [0, 0, 0]), delta)
        if "cubes" in bone:
            bone["cubes"] = cell_cubes.get(i, [])
    return result


def cells_for_bounds(lo, hi):
    intervals = []
    for a, b, base in zip(lo, hi, CELL_MIN):
        first = floor((a - base + EPSILON) / 16)
        last = ceil((b - base - EPSILON) / 16) - 1
        first = min(first, max(0, last))
        intervals.append(range(first, max(first, last) + 1))
    return sorted(product(*intervals))


def validate_custom_block_segment(model, cell):
    # Validate in Bedrock's geometry rotation convention, including its Z sign.
    cubes = list(read_cubes(model))
    if not cubes:
        raise ValueError(f"Segment {cell} has no geometry")
    mins = [min(row[2][axis] for row in cubes) for axis in range(3)]
    maxs = [max(row[3][axis] for row in cubes) for axis in range(3)]
    if any(hi - lo > CUSTOM_BLOCK_MAX_SIZE + EPSILON for lo, hi in zip(mins, maxs)):
        raise ValueError(f"Segment {cell} exceeds the 30-unit custom block geometry limit")
    if not inside(mins, maxs, CUSTOM_BLOCK_MIN, CUSTOM_BLOCK_MAX):
        raise ValueError(f"Segment {cell} exceeds the custom block geometry bounds")
    center = [(lo + hi) / 2 for lo, hi in zip(mins, maxs)]
    center_offset = [center[0], center[1] - 8, center[2]]
    if any(abs(value) > CUSTOM_BLOCK_MAX_CENTER_OFFSET + EPSILON for value in center_offset):
        raise ValueError(f"Segment {cell} geometry center is more than 7 units from its block center")
    overlap = [max(0, min(hi, upper) - max(lo, lower))
               for lo, hi, lower, upper in zip(mins, maxs, CELL_MIN, CELL_MAX)]
    if any(value < CUSTOM_BLOCK_MIN_CELL_INTERSECTION - EPSILON for value in overlap):
        raise ValueError(f"Segment {cell} must intersect its own 16-unit cell by at least 1 unit on every axis")


def add_non_rendering_segment_anchor(model):
    bones = model.setdefault("bones", [])
    anchor_name = "__scaffold_segment_anchor"
    if any(bone.get("name") == anchor_name for bone in bones):
        raise ValueError(f"Reserved segment anchor bone name already exists: {anchor_name}")
    bones.append({
        "name": anchor_name,
        "neverRender": True,
        "pivot": [0, 0, 0],
        "cubes": [{"origin": [0, 1, 0], "size": [1, 1, 1], "uv": [0, 0]}],
    })


def stage_cells(model, split, preserve_rotated_cubes=False, translation_bias=None):
    if type(preserve_rotated_cubes) is not bool:
        raise ValueError("preserve_rotated_cubes must be boolean")
    bias = vector(translation_bias if translation_bias is not None else [0, 0, 0],
                  3, "translation_bias")
    if not split and (preserve_rotated_cubes or any(bias)):
        raise ValueError("preserve_rotated_cubes and translation_bias require geometry_mode S")
    # Cell assignment must use the same transform Bedrock applies at runtime.
    cubes = list(read_cubes(model))
    if not split:
        for _, _, lo, hi, _, _ in cubes:
            if not inside(lo, hi):
                raise ValueError("Cube leaves the 16-unit cell; use geometry_mode S or fix the export")
        return {(0, 0, 0): deepcopy(model)}, (0, 0, 0)
    if not cubes:
        raise ValueError("Split geometry has no cubes")
    mins = [min(row[2][a] for row in cubes) for a in range(3)]
    maxs = [max(row[3][a] for row in cubes) for a in range(3)]
    if any(hi - lo > 64 * 16 for lo, hi in zip(mins, maxs)):
        raise ValueError("Geometry span exceeds 64 cells on an axis")
    shift = [base - lo if lo < base - EPSILON or hi > end + EPSILON else 0
             for base, end, lo, hi in zip(CELL_MIN, CELL_MAX, mins, maxs)]
    shift = [value + adjustment for value, adjustment in zip(shift, bias)]
    grouped = {}
    for bone, cube, low, high, rotated, mirrored in cubes:
        lo, hi = translated(low, shift), translated(high, shift)
        intervals = []
        for a, b, base in zip(lo, hi, CELL_MIN):
            first = floor((a - base + EPSILON) / 16)
            last = ceil((b - base - EPSILON) / 16) - 1
            # A flat face on a plane belongs to the preceding cell when
            # available. Avoid an empty extra cell at the model boundary.
            first = min(first, max(0, last))
            intervals.append(range(first, max(first, last) + 1))
        if rotated and any(len(axis) != 1 for axis in intervals):
            if not preserve_rotated_cubes:
                raise ValueError("Rotated cube crosses a 16-unit plane; author adjoining cell-sized pieces")
            cell = tuple(floor(((a + b) / 2 - base + EPSILON) / 16)
                         for a, b, base in zip(lo, hi, CELL_MIN))
            part = deepcopy(cube)
            delta = [value - 16 * index for value, index in zip(shift, cell)]
            part["origin"] = translated(cube["origin"], delta)
            if "pivot" in cube or any(cube.get("rotation", [])):
                part["pivot"] = translated(cube.get("pivot", [0, 0, 0]), delta)
            grouped.setdefault(cell, {}).setdefault(bone, []).append(part)
            continue
        for cell in product(*intervals):
            offset = [16 * n for n in cell]
            delta = [s - n for s, n in zip(shift, offset)]
            cell_lo = translated(CELL_MIN, offset)
            cell_hi = translated(CELL_MAX, offset)
            part = deepcopy(cube)
            if inside(lo, hi, cell_lo, cell_hi):
                part["origin"] = translated(cube["origin"], delta)
                if "pivot" in cube or any(cube.get("rotation", [])):
                    part["pivot"] = translated(cube.get("pivot", [0, 0, 0]), delta)
            else:
                if mirrored:
                    raise ValueError("Mirrored cube crosses a plane; bake mirrored UVs before splitting")
                cut_lo = [max(a, b) for a, b in zip(lo, cell_lo)]
                cut_hi = [min(a, b) for a, b in zip(hi, cell_hi)]
                part["origin"] = translated(cut_lo, [-n for n in offset])
                part["size"] = translated(cut_hi, [-n for n in cut_lo])
                part["inflate"] = 0
                part["uv"] = clipped_faces(face_uvs(cube), lo, hi, cut_lo, cut_hi)
            grouped.setdefault(cell, {}).setdefault(bone, []).append(part)
    if preserve_rotated_cubes:
        for cell in cells_for_bounds(translated(mins, shift), translated(maxs, shift)):
            grouped.setdefault(cell, {})

    staged = {}
    for cell, cell_cubes in sorted(grouped.items()):
        segment = shifted_geometry(model, cell_cubes, [s - 16 * n for s, n in zip(shift, cell)])
        if not cell_cubes:
            # AABB occupancy can include a cell with no cube centre. Keep its
            # runtime segment registered while neighbouring oversized cubes
            # render the authored shape across the cell boundary.
            add_non_rendering_segment_anchor(segment)
        if preserve_rotated_cubes:
            validate_custom_block_segment(segment, cell)
        else:
            for _, _, lo, hi, _, _ in read_cubes(segment):
                if not inside(lo, hi):
                    raise ValueError(f"Segment {cell} still has out-of-bounds geometry")
        staged[cell] = segment
    return staged, tuple(shift)


def placement_offsets(cells, cardinal):
    directions = {
        "north": lambda x, z: (x, z), "east": lambda x, z: (-z, x),
        "south": lambda x, z: (-x, -z), "west": lambda x, z: (z, -x),
    }
    output = {cell: {} for cell in cells}
    for name, rotate_xz in directions.items():
        if name != "north" and not cardinal:
            continue
        rotated = [rotate_xz(x, z) for x, _, z in cells]
        min_x, min_z = (min(axis) for axis in zip(*rotated))
        for cell, (x, z) in zip(cells, rotated):
            output[cell][name] = [x - min_x, cell[1], z - min_z]
    return output
