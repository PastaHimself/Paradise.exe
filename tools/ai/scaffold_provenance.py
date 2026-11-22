"""Verify copied vanilla atlas pixels and keep the décor index in the write plan."""

import csv
from hashlib import sha1, sha256
from io import BytesIO, StringIO
from pathlib import Path
from struct import unpack

from common import read_json

INDEX = Path("3d model *DECORATION*/paradise_exe_v2/asset-index.csv")
COLUMNS = ("ticket", "asset", "block_id", "state", "geo_source", "geo_runtime", "atlas_source",
           "rp_path", "vanilla_path", "source_release", "source_sha256", "source_rect",
           "atlas_rect", "structure_id", "generator", "slot", "status")
METADATA = {"ticket", "asset", "state", "structure_id", "generator", "slot"}
POLICY = read_json(Path(__file__).with_name("scaffold_vanilla.json"))
PREVIEW_ONLY = {"resource_pack/textures/blocks/polished_calcite_bricks.png"}


def rect(value, dimensions):
    if value is None:
        return (0, 0, *dimensions)
    if (not isinstance(value, list) or len(value) != 4 or any(type(n) is not int for n in value)):
        raise ValueError("Texture rectangles must be [x, y, width, height] in whole pixels")
    x, y, width, height = value
    if (x < 0 or y < 0 or width <= 0 or height <= 0
            or x + width > dimensions[0] or y + height > dimensions[1]):
        raise ValueError(f"Texture rectangle {value} leaves {dimensions}")
    return x, y, x + width, y + height


def rect_string(box):
    x, y, right, bottom = box
    return f"{x},{y},{right - x},{bottom - y}"


def stable_blob_matches(name, content):
    expected = POLICY["files"].get(name)
    return expected is not None and sha1(f"blob {len(content)}\0".encode() + content).hexdigest() == expected


def verify_existing_tile(path, content):
    name = f"resource_pack/{path}"
    if not str(path).endswith(".png") or not stable_blob_matches(name, content):
        raise ValueError(f"Unverified RP texture {path}; provide provenance for its vanilla pixels")
    width, height = unpack(">II", content[16:24])
    whole = f"0,0,{width},{height}"
    return [{"vanilla_path": name, "source_release": POLICY["release"],
             "source_sha256": sha256(content).hexdigest(), "source_rect": whole,
             "atlas_rect": whole, "status": "verified"}]


def verify_atlas(content, provenance, vanilla_root):
    """Compare every nontransparent atlas pixel to the pinned Mojang sample."""
    if not isinstance(provenance, list) or not provenance or vanilla_root is None:
        raise ValueError("New atlases require provenance and a vanilla_root for the pinned stable samples")
    try:
        from PIL import Image, ImageChops
    except ImportError as error:
        raise ValueError("Pillow is required to verify atlas pixels (pip install Pillow)") from error

    image = Image.open(BytesIO(content)).convert("RGBA")
    coverage = Image.new("L", image.size)
    records = []
    warnings = []
    for tile in provenance:
        if not isinstance(tile, dict) or set(tile) - {"vanilla_path", "fallback", "source_rect", "atlas_rect"}:
            raise ValueError("Invalid provenance tile fields")
        requested = tile.get("vanilla_path")
        if not isinstance(requested, str):
            raise ValueError("Each provenance tile needs a vanilla_path")
        name = requested
        if name in PREVIEW_ONLY:
            name = tile.get("fallback")
            if not isinstance(name, str) or name not in POLICY["files"]:
                raise ValueError(f"Preview-only source {requested} requires a configured stable fallback")
            warnings.append(f"Preview-only {requested} replaced with {name}")
        elif "fallback" in tile:
            raise ValueError(f"Fallback applies only to a known Preview-only source: {requested}")
        expected = POLICY["files"].get(name)
        if expected is None:
            raise ValueError(f"Unverified vanilla source path for {POLICY['release']}: {name}")
        source = (vanilla_root / name).read_bytes()
        if not stable_blob_matches(name, source):
            raise ValueError(f"Source bytes differ from {POLICY['release']}: {name}")
        vanilla = Image.open(BytesIO(source)).convert("RGBA")
        source_box = rect(tile.get("source_rect"), vanilla.size)
        atlas_box = rect(tile.get("atlas_rect"), image.size)
        piece = vanilla.crop(source_box)
        if piece.size != image.crop(atlas_box).size:
            raise ValueError(f"Source and atlas rectangles differ in size: {name}")
        if coverage.crop(atlas_box).getbbox():
            raise ValueError(f"Overlapping provenance regions at {atlas_box}")
        if name != requested:
            image.paste(piece, atlas_box)
        elif image.crop(atlas_box).tobytes() != piece.tobytes():
            raise ValueError(f"Atlas pixels do not match {name} at {atlas_box}")
        coverage.paste(255, atlas_box)
        records.append({"vanilla_path": name, "source_release": POLICY["release"],
                        "source_sha256": sha256(source).hexdigest(), "source_rect": rect_string(source_box),
                        "atlas_rect": rect_string(atlas_box), "status": "substituted" if name != requested else "verified"})
    if ImageChops.multiply(image.getchannel("A"), ImageChops.invert(coverage)).getbbox():
        raise ValueError("Atlas contains visible pixels outside its provenance rectangles")
    if warnings:
        buffer = BytesIO()
        image.save(buffer, format="PNG")
        content = buffer.getvalue()
    return content, records, warnings


def asset_records(metadata, name, model, runtime, atlas, path, tiles):
    if not isinstance(metadata, dict) or set(metadata) - METADATA or any(
            type(value) not in (str, int) for value in metadata.values()):
        raise ValueError("index metadata accepts ticket, asset, state, structure_id, generator and slot")
    base = {"asset": name.partition(":")[2], **metadata, "block_id": name, "geo_source": model,
            "geo_runtime": runtime, "atlas_source": atlas, "rp_path": path}
    return [{**base, **tile} for tile in tiles]


def update_index(plan, records):
    if not records:
        return
    old = plan.content(INDEX)
    existing = []
    if old is not None:
        reader = csv.DictReader(StringIO(old.decode("utf-8"), newline=""))
        if tuple(reader.fieldnames or ()) != COLUMNS:
            raise ValueError(f"Unexpected header in {INDEX}")
        existing = list(reader)

    def key(row):
        return row["block_id"], row.get("state", "")

    new = {}
    for row in records:
        new.setdefault(key(row), []).append(row)
    output = StringIO(newline="")
    writer = csv.DictWriter(output, COLUMNS, lineterminator="\n")
    writer.writeheader()
    for row in existing:
        if row["status"] == "deferred" or key(row) not in new:
            writer.writerow(row)
        elif replacement := new[key(row)]:
            writer.writerows(replacement)
            new[key(row)] = []
    for rows in new.values():
        writer.writerows(rows)
    plan.add(INDEX, output.getvalue().encode("utf-8"), merge_from=old)
