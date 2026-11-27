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
from audit import CHECKS, audit
from checks import texture_candidates, validate
from block_repairs import build_floor_collision_plan, build_stair_collision_plan
from geometry_reuse import build_shared_reuse_plan, plan_digest
from manifests import pack_versions, version_argument
from navigation import references, script_impact
from package_mcaddon import package_mcaddon
from prune import SCOPES, prune
from runtime import compare_diagnostics, cpu_profile
from scaffold import RENDER_METHODS, Conflict, blocks_from_exports, build_plan, catalog, scaffold_lock
from slice import slice_file
from structures import inventory


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
    inspect.add_argument("--kind", choices=["summary", "symbol", "export", "store", "event", "schedule", "state",
                                            "dimension", "fog", "sound", "particle", "entity", "item", "structure", "api"],
                         default="summary")
    inspect.add_argument("--query", default="", help="Case-insensitive substring across result fields")
    inspect.add_argument("--file", default="", help="Case-insensitive substring of repo-relative script path")
    scan = commands.add_parser("catalog", help="Find Bedrock geometry exports and same-stem texture candidates", allow_abbrev=False)
    scan.add_argument("--directory", type=Path, required=True, help="Model export directory, repo-relative or absolute")
    scan.add_argument("--texture-dir", type=Path, help="Optional separate texture directory")
    scan.add_argument("--query", default="", help="Case-insensitive substring of model path or geometry ID")
    scaffold = commands.add_parser(
        "scaffold", help="Plan a JSON batch of blocks and dimensions", allow_abbrev=False,
        formatter_class=argparse.RawDescriptionHelpFormatter, epilog="""Verified block spec example:
{
  "vanilla_root": "/path/to/Mojang-bedrock-samples-v1.26.50.4",
  "blocks": [{
    "id": "paradise:sample", "model": "/path/to/sample.geo.json",
    "texture": "/path/to/sample.png", "batch": "shared",
    "geometry_mode": "S", "rotation": "C", "rotation_offset": 0.0,
    "collision_box": false, "sound": "stone",
    "provenance": [{"vanilla_path": "resource_pack/textures/blocks/quartz_bricks.png"}],
    "index": {"ticket": 0, "asset": "sample", "state": "base"}
  }]
}
Source/atlas rectangles are [x, y, width, height]; omit them for whole images.
For the known Preview-only calcite tile set the provenance tile's "fallback"
to "resource_pack/textures/blocks/quartz_bricks.png" to stage those pixels.
Use "source_geometry" to select one geometry from a multi-geometry export.
Reuse identical staged shapes through "geometry_owner": "paradise:sample".
Geometry mode is "1" (one cell, default) or "S" (numbered cell segments).
Read placements.items[].segments for generated IDs and rotated XYZ offsets.
Rotation is fixed ("F", default) or cardinal ("C"). For collision, use booleans,
origin/size, or min/max arrays. "allow_tall_collision": true enables 24 units.
"texture_path" reuses an existing RP bitmap with stable source bytes or proof.
Directory imports read these options from <texture>.provenance.json, with
provenance and vanilla_root required. New PNG atlas checks require Pillow.
""",
    )
    source = scaffold.add_mutually_exclusive_group(required=True)
    source.add_argument("--spec", type=Path, help="Path to a batch JSON file")
    source.add_argument("--from-directory", type=Path, help="Batch-import geometry exports with unique same-stem textures")
    scaffold.add_argument("--texture-dir", type=Path, help="Separate texture directory for --from-directory")
    scaffold.add_argument("--namespace", help="Block identifier namespace for --from-directory (default paradise)")
    scaffold.add_argument("--render-method", choices=sorted(RENDER_METHODS), help="Block render method for --from-directory (default opaque)")
    scaffold.add_argument("--ids", help="Comma-separated block/dimension IDs to include from the spec")
    scaffold.add_argument("--batch", help="Only include spec rows whose batch field matches this tag")
    writable(scaffold)
    reuse = commands.add_parser("geometry-reuse", help="Migrate exactly identical shared block models to existing owners", allow_abbrev=False)
    reuse.add_argument("--expected-plan", help="SHA-256 of the reviewed dry-run; required for --apply")
    writable(reuse)
    repair = commands.add_parser("repair-flat-flower-floors", help="Restore solid collision on six verified full-tile Y64 floors", allow_abbrev=False)
    repair.add_argument("--expected-plan", help="SHA-256 of the reviewed dry-run; required for --apply")
    writable(repair)
    tread = commands.add_parser("repair-stair-treads", help="Restore the two authored stair collision profiles", allow_abbrev=False)
    tread.add_argument("--expected-plan", help="SHA-256 of the reviewed dry-run; required for --apply")
    writable(tread)
    check = commands.add_parser("validate", help="Run pack, audio, references, structure, and Script API checks", allow_abbrev=False)
    preflight(check)
    assets = commands.add_parser("assets", help="List textures with no exact local reference observed", allow_abbrev=False)
    assets.add_argument("--query", default="", help="Case-insensitive substring of asset path")
    build = commands.add_parser("package", help="Run pre-flight and plan or export a clean .mcaddon", allow_abbrev=False)
    preflight(build)
    writable(build)
    build.add_argument("--output", type=Path, default=Path("artifacts/Paradise.exe.mcaddon"), help="Repo-relative or absolute .mcaddon output")
    build.add_argument("--replace", action="store_true", help="Allow replacing an existing archive with different bytes")
    refs = commands.add_parser("refs", help="Find exact JS literals and JSON key/value occurrences", allow_abbrev=False)
    refs.add_argument("query", help="Identifier, asset path, or literal to find (case-sensitive)")
    refs.add_argument("--contains", action="store_true", help="Match substrings, including static template segments")
    refs.add_argument("--file", default="", help="Case-insensitive substring of repo-relative file path")

    impact = commands.add_parser("impact", help="Trace changed scripts back to their importers and BP entry points", allow_abbrev=False)
    target = impact.add_mutually_exclusive_group()
    target.add_argument("--file", action="append", help="Existing script path or unique basename, repeatable")
    target.add_argument("--base", help="Git commit to compare with the checkout (default HEAD)")

    structs = commands.add_parser("structures", help="Inspect .mcstructure metadata and actual placed blocks", allow_abbrev=False)
    structs.add_argument("--query", default="", help="Case-insensitive substring of structure identifier")
    structs.add_argument("--block", help="Only show structures containing this exact block identifier")
    structs.add_argument("--palette", action="store_true", help="Include observed block counts by layer")
    structs.add_argument("--check-blocks", action="store_true", help="Require local definitions for all used custom blocks")

    profile = commands.add_parser("profile", help="Rank recorded function costs from a Bedrock .cpuprofile", allow_abbrev=False)
    profile.add_argument("path", type=Path, help="Path to the .cpuprofile")
    profile.add_argument("--file", default="", help="Case-insensitive substring of script URL")
    profile.add_argument("--sort", choices=["self", "total"], default="self", help="Rank own work or inclusive work (default self)")

    diagnostics = commands.add_parser("diagnostics", help="Compare errors in two Blockception JSON reports", allow_abbrev=False)
    diagnostics.add_argument("--current", type=Path, required=True, help="Current Blockception report")
    diagnostics.add_argument("--baseline", type=Path, help="Earlier Blockception report to compare")
    diagnostics.add_argument("--warnings", action="store_true", help="Include warnings as well as errors")

    manifest = commands.add_parser("manifest", help="Inspect or plan linked BP/RP version updates", allow_abbrev=False)
    manifest.add_argument("--bp-version", type=version_argument, help="Target BP version as MAJOR.MINOR.PATCH")
    manifest.add_argument("--rp-version", type=version_argument, help="Target RP and BP dependency version as MAJOR.MINOR.PATCH")
    manifest.add_argument("--engine", type=version_argument, help="Target min_engine_version in both manifests")
    writable(manifest)
    slice = commands.add_parser("slice", help="Read an exact 1-based line range or symbol body of one script", allow_abbrev=False)
    slice.add_argument("--file", required=True, help="Unique script substring or repo-relative path")
    slice.add_argument("--start", type=integer(1, 10**9), help="First line to read (default 1)")
    slice.add_argument("--end", type=integer(1, 10**9), help="Last line to read (default end of file)")
    slice.add_argument("--symbol", help="Slice the indexed symbol whose name contains this text")
    audit_cmd = commands.add_parser("audit", help="Audit the packs for the V2 target engine readiness (read-only)", allow_abbrev=False)
    audit_cmd.add_argument("--check", action="append", choices=list(CHECKS), help="Audit section to run (repeatable; default all)")
    audit_cmd.add_argument("--target", help="Target engine version MAJOR.MINOR.PATCH (default 1.26.50)")
    audit_cmd.add_argument("--examples", type=integer(1, 50), default=5, help="Max locations kept per finding (default 5)")
    prune_cmd = commands.add_parser("prune", help="Plan or apply removal of unreferenced RP assets (dry-run default)", allow_abbrev=False)
    prune_cmd.add_argument("--scope", action="append", choices=[*SCOPES, "all"],
                           help="Asset scope to audit (repeatable; default textures)")
    prune_cmd.add_argument("--include-subpacks", action="store_true", help="Include subpack textures in the texture scope")
    writable(prune_cmd)
    gate = commands.add_parser("preflight", help="Run validate plus the V2 audit and return one pass/fail report", allow_abbrev=False)
    preflight(gate)
    gate.add_argument("--require-v2", action="store_true", help="Fail the gate when the V2 audit has findings")
    gate.add_argument("--check", action="append", choices=list(CHECKS), help="V2 audit section to include (repeatable; default all)")
    gate.add_argument("--target", help="Target engine version MAJOR.MINOR.PATCH (default 1.26.50)")
    gate.add_argument("--examples", type=integer(1, 50), default=5, help="Max locations kept per audit finding (default 5)")
    for command in (inspect, scan, scaffold, reuse, repair, tread, check, assets, build, refs, impact, structs, profile, diagnostics, manifest,
                    slice, audit_cmd, prune_cmd, gate):
        command.add_argument("--json", action="store_true", help="Compact JSON output (default)")
        pagination(command)
    return parser.parse_args()


def script_index(root, lookup=None):
    command = ["node", str(Path(__file__).with_name("index.mjs")), str(root), str(root / BP)]
    if lookup is not None:
        command.append(json.dumps(lookup))
    process = subprocess.run(
        command,
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


def filter_spec(spec, args):
    ids = {part.strip() for part in args.ids.split(",") if part.strip()} if args.ids else None
    if ids is None and args.batch is None:
        return spec
    filtered = dict(spec)
    for key in ("blocks", "dimensions"):
        rows = spec.get(key, [])
        kept = [row for row in rows
                if (ids is None or row.get("id") in ids) and (args.batch is None or row.get("batch") == args.batch)]
        if rows and not kept:
            raise ValueError(f"No {key} rows match the --ids/--batch filters")
        filtered[key] = kept
    return filtered


def run_preflight(root, args):
    index = script_index(root)
    hard_issues, hard = summarize_checks(validate(root, args, index), args)
    audit_issues, v2 = audit(root, args, index)
    gate = hard_issues or (bool(args.require_v2) and audit_issues)
    return gate, {
        "gate": "fail" if gate else "pass",
        "require_v2": bool(args.require_v2),
        "checks": hard["checks"],
        "diagnostics": hard["diagnostics"],
        "v2_audit": {"target": v2["target"], "checks": v2["checks"], "findings": v2["findings"]},
    }


def run(args):
    root = args.root.resolve()
    if args.command == "profile":
        return False, cpu_profile(args.path, args)
    if args.command == "diagnostics":
        return compare_diagnostics(args.current, args.baseline, args)
    require_packs(root)
    if args.command == "slice":
        return False, slice_file(root, args, script_index(root))
    if args.command == "audit":
        return audit(root, args, script_index(root))
    if args.command == "prune":
        with scaffold_lock(root, args.apply):
            return prune(root, args, script_index(root))
    if args.command == "preflight":
        return run_preflight(root, args)
    if args.command == "refs":
        if not args.query:
            raise ValueError("Specify a nonempty reference")
        return references(root, args, script_index(root, {"query": args.query, "contains": args.contains}))
    if args.command == "impact":
        return script_impact(root, args, script_index(root))
    if args.command == "structures":
        return inventory(root, args)
    if args.command == "manifest":
        if args.apply and all(target is None for target in (args.bp_version, args.rp_version, args.engine)):
            raise ValueError("Pass a target version with --apply")
        with scaffold_lock(root, args.apply):
            plan, versions = pack_versions(root, args)
            if args.apply:
                plan.apply()
        return False, {"mode": "apply" if args.apply else "dry-run", "versions": versions,
                       **page(plan.summary(), args)}
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
        if args.spec and (args.texture_dir or args.namespace or args.render_method):
            raise ValueError("--texture-dir, --namespace, and --render-method require --from-directory")
        mode = "apply" if args.apply else "dry-run"
        with scaffold_lock(root, args.apply):
            if args.spec:
                spec = filter_spec(read_json(args.spec), args)
            else:
                spec, errors = blocks_from_exports(root, args.from_directory, args.texture_dir,
                                                   args.namespace or "paradise", args.render_method or "opaque")
                if errors:
                    return True, {"mode": mode, "paired_blocks": len(spec["blocks"]), "diagnostics": page(errors, args)}
            plan, warnings = build_plan(root, spec, lambda: script_index(root))
            report = {"mode": mode, "warnings": warnings, "placements": page(plan.placements, args),
                      **page(plan.summary(), args)}
            if args.from_directory:
                report["paired_blocks"] = len(spec["blocks"])
            if args.apply:
                plan.apply()
            return False, report
    if args.command == "geometry-reuse":
        with scaffold_lock(root, args.apply):
            plan, mapping, index_rows = build_shared_reuse_plan(root)
            digest = plan_digest(plan)
            if args.apply:
                if args.expected_plan != digest:
                    raise Conflict("Geometry migration requires the exact reviewed --expected-plan digest")
                plan.apply()
        return False, {"mode": "apply" if args.apply else "dry-run", "plan_sha256": digest,
                       "removed_geometries": len(mapping), "updated_index_rows": index_rows,
                       "mapping": mapping, **page(plan.summary(), args)}
    if args.command in ("repair-flat-flower-floors", "repair-stair-treads"):
        with scaffold_lock(root, args.apply):
            plan = (build_floor_collision_plan if args.command == "repair-flat-flower-floors" else build_stair_collision_plan)(root)
            digest = plan_digest(plan)
            if args.apply:
                if args.expected_plan != digest:
                    raise Conflict("Floor repair requires the exact reviewed --expected-plan digest")
                plan.apply()
        return False, {"mode": "apply" if args.apply else "dry-run", "plan_sha256": digest,
                       **page(plan.summary(), args)}
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
