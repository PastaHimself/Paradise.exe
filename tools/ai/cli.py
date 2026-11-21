#!/usr/bin/env python3
"""Local Bedrock tooling for Paradise.exe."""

import argparse
import filecmp
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from zipfile import BadZipFile

# Dry runs and read-only commands also leave Python bytecode off disk.
sys.dont_write_bytecode = True

from common import BP, ROOT, RP, page, read_json, require_packs
sys.path.insert(1, str(ROOT / "tools"))
from checks import texture_candidates, validate
from package_mcaddon import package_mcaddon
from scaffold import Conflict, build_plan, catalog, scaffold_lock


class Parser(argparse.ArgumentParser):
    def error(self, message):
        raise ValueError(message)


def integer(minimum, maximum):
    def parse(value):
        number = int(value)
        if not minimum <= number <= maximum:
            raise argparse.ArgumentTypeError(f"expected {minimum} through {maximum}")
        return number
    return parse


def pagination(parser):
    parser.add_argument("--limit", type=integer(1, 500), default=20, help="Maximum result rows per list (default 20)")
    parser.add_argument("--offset", type=integer(0, 10**8), default=0, help="Skip result rows (default 0)")


def writable(parser):
    flags = parser.add_mutually_exclusive_group()
    flags.add_argument("--dry-run", action="store_true", help="Plan without writes (default)")
    flags.add_argument("--apply", action="store_true", help="Execute the planned writes")


def preflight(parser):
    parser.add_argument("--skip-typecheck", action="store_true", help="Skip tsc and installed API version comparison")
    parser.add_argument("--release-audio", action="store_true", help="Require the existing complete audio release gate")


def options():
    parser = Parser(description=__doc__, allow_abbrev=False)
    parser.add_argument("--root", type=Path, default=ROOT, help="Alternate Paradise checkout")
    parser.add_argument("--json", action="store_true", help="Compact JSON output (default)")
    commands = parser.add_subparsers(dest="command", required=True, parser_class=Parser)
    inspect = commands.add_parser("inspect", help="Find source locations and show scheduler or state entries", allow_abbrev=False)
    inspect.add_argument("--kind", choices=["summary", "symbol", "event", "schedule", "state", "dimension", "fog", "sound"], default="summary")
    inspect.add_argument("--query", default="", help="Case-insensitive substring across result fields")
    inspect.add_argument("--file", default="", help="Case-insensitive substring of repo-relative script path")
    scan = commands.add_parser("catalog", help="Find Bedrock geometry exports and same-stem texture candidates", allow_abbrev=False)
    scan.add_argument("--directory", type=Path, required=True, help="Model export directory, repo-relative or absolute")
    scan.add_argument("--texture-dir", type=Path, help="Optional separate texture directory")
    scan.add_argument("--query", default="", help="Case-insensitive substring of model path or geometry ID")
    scaffold = commands.add_parser("scaffold", help="Plan a JSON batch of blocks and dimensions", allow_abbrev=False)
    scaffold.add_argument("--spec", type=Path, required=True, help="Path to a batch JSON file")
    writable(scaffold)
    check = commands.add_parser("validate", help="Run pack, audio, references, structure, and Script API checks", allow_abbrev=False)
    preflight(check)
    assets = commands.add_parser("assets", help="List textures with no exact local reference observed", allow_abbrev=False)
    assets.add_argument("--query", default="", help="Case-insensitive substring of asset path")
    build = commands.add_parser("package", help="Run pre-flight and plan or export a clean .mcaddon", allow_abbrev=False)
    preflight(build)
    writable(build)
    build.add_argument("--output", type=Path, default=Path("artifacts/Paradise.exe.mcaddon"), help="Repo-relative or absolute .mcaddon output")
    build.add_argument("--replace", action="store_true", help="Allow replacing an existing archive with different bytes")
    for command in (inspect, scan, scaffold, check, assets, build):
        command.add_argument("--json", action="store_true", help="Compact JSON output (default)")
        pagination(command)
    return parser.parse_args()


def script_index(root):
    process = subprocess.run(
        ["node", str(Path(__file__).with_name("index.mjs")), str(root), str(root / BP)],
        cwd=root, capture_output=True, text=True, timeout=60,
    )
    if process.returncode:
        if "Cannot find package 'typescript'" in process.stderr:
            raise ValueError("TypeScript is missing; run npm install --ignore-scripts --no-audit --no-fund")
        raise ValueError(process.stderr.strip().splitlines()[0] if process.stderr.strip() else
                         f"Script index terminated with status {process.returncode}")
    return json.loads(process.stdout)


def inspect_scripts(root, args):
    index = script_index(root)
    rows = [item for item in index["rows"] if args.file.casefold() in item["file"].casefold()
            and args.query.casefold() in " ".join(map(str, item.values())).casefold()]
    report = {"scripts": index["files"], "parse_errors": page(index["errors"], args)}
    if args.kind == "summary":
        report["counts"] = dict(sorted((kind, sum(row["kind"] == kind for row in rows))
                                      for kind in {row["kind"] for row in rows}))
    else:
        report.update(page([row for row in rows if row["kind"] == args.kind], args))
    return bool(index["errors"]), report


def summarize_checks(result, args):
    checks = {}
    diagnostics = []
    has_errors = False
    for name, section in result.items():
        errors, warnings = section.get("errors", []), section.get("warnings", [])
        has_errors |= bool(errors)
        checks[name] = {"errors": len(errors), "warnings": len(warnings)}
        for key in ("counts", "versions", "typecheck", "structure_count", "asset_count", "skipped"):
            if key in section:
                checks[name][key] = section[key]
        for severity, entries in (("error", errors), ("warning", warnings)):
            for entry in entries:
                diagnostics.append({"check": name, "severity": severity, **(
                    entry if isinstance(entry, dict) else {"message": entry})})
    diagnostics.sort(key=lambda row: (row["severity"], row["check"], row.get("file", ""), row.get("line", 0), row["message"]))
    return has_errors, {"checks": checks, "diagnostics": page(diagnostics, args)}


def package_member(path):
    return (not any(part.startswith(".") or part in {"__MACOSX", "node_modules", "__pycache__"} for part in path.parts)
            and path.name.lower() not in {"thumbs.db", "desktop.ini"}
            and path.suffix.lower() not in {".bbmodel", ".bak", ".tmp", ".orig", ".rej", ".zip", ".mcpack", ".mcaddon"}
            and not path.name.endswith("~"))


def build_archive(root, args):
    if args.replace and not args.apply:
        raise ValueError("--replace requires --apply")
    raw_output = root / args.output
    if raw_output.is_symlink() or raw_output.suffix.lower() != ".mcaddon":
        raise ValueError("Expected a non-symlink .mcaddon output path")
    output = raw_output.resolve()
    packs = [root / BP, root / RP]
    if (output.is_relative_to(root) and not output.is_relative_to(root / "artifacts")) or any(
            output.is_relative_to(pack.resolve()) for pack in packs):
        raise ValueError("Use artifacts/ or an output directory outside the repo")
    if output.exists() and not output.is_file():
        raise ValueError("Output path must be a regular file")
    counts = {}
    excluded = []
    for pack in packs:
        if pack.is_symlink() or pack.parent.is_symlink():
            raise Conflict(f"Pack directory cannot be a symbolic link: {pack.relative_to(root)}")
        members = 0
        for path in sorted(pack.rglob("*")):
            if path.is_symlink():
                raise Conflict(f"Remove symbolic link before packaging: {path.relative_to(root)}")
            if path.is_file():
                if package_member(path.relative_to(pack)):
                    members += 1
                else:
                    excluded.append(path.relative_to(root).as_posix())
        counts[pack.name] = members

    issues, report = summarize_checks(validate(root, args, script_index(root)), args)
    report.update({"mode": "apply" if args.apply else "dry-run", "output": (
        output.relative_to(root).as_posix() if output.is_relative_to(root) else str(output)),
        "pack_files": counts, "excluded": page(excluded, args)})
    if issues or not args.apply:
        report["action"] = "blocked" if issues else "plan"
        return issues, report

    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=output.parent) as directory:
        staged = Path(directory) / output.name
        package_mcaddon(*packs, staged, include=package_member)
        if output.is_symlink():
            raise Conflict("Output became a symbolic link during packaging")
        if output.exists() and filecmp.cmp(staged, output, shallow=False):
            action = "unchanged"
        elif args.replace:
            os.replace(staged, output)
            action = "published"
        else:
            try:
                os.link(staged, output)
            except FileExistsError as exc:
                raise Conflict("Archive already exists with different bytes; use --replace to replace it") from exc
            action = "published"
    report.update({"action": action, "bytes": output.stat().st_size})
    return False, report


def run(args):
    root = args.root.resolve()
    require_packs(root)
    if args.command == "inspect":
        return inspect_scripts(root, args)
    if args.command == "assets":
        index = script_index(root)
        if index["errors"]:
            return True, {"parse_errors": page(index["errors"], args)}
        matched, candidates = texture_candidates(root, index["textures"])
        filtered = [candidate for candidate in candidates if args.query.casefold() in candidate["path"].casefold()]
        return False, {"matched": matched, "unmatched": len(candidates), **page(filtered, args)}
    if args.command == "catalog":
        models, errors = catalog(root, args.directory, args.texture_dir)
        matches = [row for row in models if args.query.casefold() in
                   " ".join([row["model"], *row["geometries"]]).casefold()]
        return bool(errors), {**page(matches, args), "errors": page(errors, args)}
    if args.command == "scaffold":
        with scaffold_lock(root, args.apply):
            plan, warnings = build_plan(root, read_json(args.spec), lambda: script_index(root))
            report = {"mode": "apply" if args.apply else "dry-run", "warnings": warnings, **page(plan.summary(), args)}
            if args.apply:
                plan.apply()
            return False, report
    if args.command == "validate":
        return summarize_checks(validate(root, args, script_index(root)), args)
    return build_archive(root, args)


def main():
    command = None
    try:
        args = options()
        command = args.command
        issues, report = run(args)
        status = 1 if issues else 0
    except Conflict as error:
        status, report = 1, {"error": str(error)}
    except (OSError, ValueError, TypeError, KeyError, AttributeError, RecursionError, BadZipFile, subprocess.SubprocessError) as error:
        status, report = 2, {"error": str(error)}
    print(json.dumps({"command": command, "ok": status == 0, "status": status, **report},
                     ensure_ascii=True, separators=(",", ":")))
    return status


if __name__ == "__main__":
    sys.exit(main())
