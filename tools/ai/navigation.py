"""Find exact identifier occurrences and trace changed script dependencies."""

from collections import Counter, defaultdict, deque
from pathlib import Path
import subprocess

from common import BP, RP, page, read_json
from validate_addon import AddonValidator


DEFINITION_TABLES = {
    "animations", "animation_controllers", "render_controllers", "sound_definitions", "texture_data",
}


def json_matches(value, matches, pointer="", field=None, table=False):
    if isinstance(value, dict):
        for key, child in sorted(value.items()):
            address = pointer + "/" + key.replace("~", "~0").replace("/", "~1")
            if matches(key):
                yield {"kind": "json-key", "pointer": address, "definition": table}
            yield from json_matches(child, matches, address, key, key in DEFINITION_TABLES)
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from json_matches(child, matches, f"{pointer}/{index}")
    elif isinstance(value, str) and matches(value):
        yield {"kind": "json-value", "pointer": pointer, "definition": field == "identifier"}


def references(root, args, index):
    def matches(value):
        return args.query in value if args.contains else args.query == value

    found = list(index["references"])
    diagnostics = list(index["errors"])
    for pack in (BP, RP):
        for path in sorted((root / pack).rglob("*.json")):
            relative = path.relative_to(root).as_posix()
            if args.file.casefold() not in relative.casefold():
                continue
            try:
                document = read_json(path)
            except ValueError as error:
                diagnostics.append({"file": relative, "message": str(error)})
                continue
            found.extend({"file": relative, **row} for row in json_matches(document, matches))
    found = sorted((row for row in found if args.file.casefold() in row["file"].casefold()),
                   key=lambda row: (row["file"], row.get("line", 0), row.get("column", 0), row.get("pointer", "")))
    return bool(diagnostics), {
        "query": args.query, "counts": dict(sorted(Counter(row["kind"] for row in found).items())),
        **page(found, args), "diagnostics": page(diagnostics, args),
    }


def git_paths(root, *arguments):
    result = subprocess.run(["git", "-C", str(root), *arguments], capture_output=True, timeout=30)
    if result.returncode:
        raise ValueError(result.stderr.decode(errors="replace").strip())
    return {part.decode(errors="surrogateescape") for part in result.stdout.split(b"\x00") if part}


def changed_paths(root, base):
    # Resolve first so a user-supplied revision cannot be interpreted as a Git option or pathspec.
    commit, = git_paths(root, "rev-parse", "--verify", "--end-of-options", base + "^{commit}")
    return git_paths(root, "diff", "--name-only", "-z", "--no-renames", commit.strip(), "--", "addon") | git_paths(
        root, "ls-files", "--others", "--exclude-standard", "-z", "--", "addon")


def script_impact(root, args, index):
    scripts = set(index["scriptPaths"])
    if args.file:
        selected = set()
        for name in args.file:
            path = Path(name)
            if path.is_absolute():
                if not path.is_relative_to(root):
                    raise ValueError(f"Script is outside checkout: {name}")
                path = path.relative_to(root)
            options = sorted(member for member in scripts if path.as_posix() == member or (
                len(path.parts) == 1 and path.name == Path(member).name))
            if len(options) != 1:
                raise ValueError(f"Expected one script for {name}; found {len(options)}: {', '.join(options[:5])}")
            selected.add(options[0])
    else:
        selected = changed_paths(root, args.base or "HEAD")

    seeds = {file for file in selected if Path(file).is_relative_to(BP / "scripts")
             and Path(file).suffix in {".js", ".mjs", ".cjs"}}
    outgoing = defaultdict(set)
    incoming = defaultdict(set)
    unresolved = []
    for row in index["dependencies"]:
        from_file, specifier = row["file"], row["specifier"]
        if not specifier.startswith(("./", "../")):
            continue
        candidates = [candidate.resolve() for candidate in AddonValidator._resolve_import(root / from_file, specifier)]
        targets = [candidate.relative_to(root).as_posix() for candidate in candidates if candidate.is_relative_to(root)]
        to_file = next((target for target in targets if (root / target).is_file()), None)
        if not to_file:
            unresolved.append(row)
            to_file = next((target for target in targets if target in seeds), None)
        if to_file:
            outgoing[from_file].add(to_file)
            incoming[to_file].add(from_file)

    manifest = read_json(root / BP / "manifest.json")
    entries = sorted((BP / module["entry"]).as_posix() for module in manifest["modules"] if module.get("type") == "script")
    active = set(entries)
    queue = deque(entries)
    while queue:
        for dependency in sorted(outgoing[queue.popleft()] - active):
            active.add(dependency)
            queue.append(dependency)

    affected = {file: {"file": file, "depth": 0} for file in sorted(seeds)}
    queue = deque(affected)
    while queue:
        dependency = queue.popleft()
        for caller in sorted(incoming[dependency] - affected.keys()):
            affected[caller] = {"file": caller, "depth": affected[dependency]["depth"] + 1, "via": dependency}
            queue.append(caller)
    rows = sorted(affected.values(), key=lambda row: (row["depth"], row["file"]))
    for row in rows:
        row["entry_reachable"] = row["file"] in active
        row["exists"] = row["file"] in scripts
    return bool(unresolved or index["errors"]), {
        "entries": entries, "reachable_scripts": len(active & scripts), "unreachable_scripts": len(scripts - active),
        "changed": page([{"file": file, "exists": (root / file).exists()} for file in sorted(selected)], args),
        "unresolved_imports": page(unresolved, args), "parse_errors": page(index["errors"], args), **page(rows, args),
    }
