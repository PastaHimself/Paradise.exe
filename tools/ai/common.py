"""Shared pack paths, bounded output, and JSON readers."""

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
BP = Path("addon/Genshin X Craft BP")
RP = Path("addon/Genshin X Craft RP")
IMAGE_SUFFIXES = (".png", ".tga", ".jpg", ".jpeg", ".dds")


def read_json(path):
    return parse_json(path.read_bytes(), path.name)


def parse_json(data, filename):
    def reject_constant(value):
        raise ValueError(f"Invalid JSON constant {value} in {filename}")

    def unique_pairs(pairs):
        result = {}
        for name, value in pairs:
            if name in result:
                raise ValueError(f"Duplicate JSON key {name!r} in {filename}")
            result[name] = value
        return result

    return json.loads(data.decode("utf-8-sig"),
                      parse_constant=reject_constant, object_pairs_hook=unique_pairs)


def page(rows, args):
    return {"total": len(rows), "offset": args.offset, "items": rows[args.offset:args.offset + args.limit]}


def strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for entry in value.values():
            yield from strings(entry)
    elif isinstance(value, list):
        for entry in value:
            yield from strings(entry)


def require_packs(root):
    for path in (BP, RP):
        if not (root / path / "manifest.json").is_file():
            raise ValueError(f"Missing {path / 'manifest.json'}; check --root")


def json_bytes(data):
    return (json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode()
