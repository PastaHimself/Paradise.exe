"""Inspect and plan coordinated BP/RP versions without changing pack identity."""

import re
from copy import deepcopy

from common import BP, RP, json_bytes, parse_json
from scaffold import Conflict, Plan, checked_path


def version_argument(argument):
    if not re.fullmatch(r"(?:0|[1-9][0-9]{0,9})\.(?:0|[1-9][0-9]{0,9})\.(?:0|[1-9][0-9]{0,9})", argument):
        raise ValueError(f"Expected version MAJOR.MINOR.PATCH, received {argument!r}")
    return list(map(int, argument.split(".")))


def version_field(value):
    return isinstance(value, list) and len(value) == 3 and all(type(part) is int and part >= 0 for part in value)


def pack_versions(root, args):
    paths = (BP / "manifest.json", RP / "manifest.json")
    original = [checked_path(root, path).read_bytes() for path in paths]
    docs = [parse_json(data, path.name) for path, data in zip(paths, original)]
    before = deepcopy(docs)
    bp, rp = docs
    dependencies = bp.get("dependencies", [])
    link = [entry for entry in dependencies if entry.get("uuid") == rp["header"]["uuid"]]
    if len(link) != 1:
        raise Conflict("Expected exactly one BP dependency matching the RP header UUID")

    linked_before = link[0].get("version")
    broken_link = linked_before != rp["header"].get("version")
    if broken_link and args.rp_version is None:
        raise Conflict("BP dependency version does not match RP. Pass --rp-version to plan a repair.")
    for doc, target in zip(docs, (args.bp_version, args.rp_version)):
        for field, requested in (("version", target), ("min_engine_version", args.engine)):
            current = doc["header"].get(field)
            if not version_field(current):
                raise Conflict(f"Invalid existing {field} in {doc['header'].get('name', 'manifest')}")
            if requested is None:
                continue
            if requested < current and field == "version":
                raise Conflict(f"Pack version cannot decrease from {current} to {requested}")
            doc["header"][field] = requested
        if target is not None:
            for module in doc["modules"]:
                current = module.get("version")
                if not version_field(current):
                    raise Conflict(f"Invalid existing version in module {module.get('type', 'unknown')}")
                if current > target:
                    raise Conflict(f"Module version cannot decrease from {current} to {target}")
                module["version"] = target
    if args.rp_version is not None:
        link[0]["version"] = args.rp_version
    plan = Plan(root)
    for path, data, old, new in zip(paths, original, before, docs):
        plan.add(path, data if old == new else json_bytes(new), merge_from=data)
    versions = {name: {field: {"before": old["header"][field], "after": new["header"][field]}
                       for field in ("version", "min_engine_version")}
                for name, old, new in zip(("bp", "rp"), before, docs)}
    versions["bp_rp_dependency"] = {
        "before": linked_before,
        "after": link[0]["version"],
    }
    versions["script_api"] = {entry["module_name"]: entry.get("version")
                              for entry in dependencies if "module_name" in entry}
    return plan, versions
