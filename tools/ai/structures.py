"""Inspect placed blocks inside .mcstructure files using the existing NBT validator."""

from collections import defaultdict

from common import BP, page
from scaffold import definitions
from validate_mcstructures import MCStructureError, validate_mcstructure_file


def structure_id(path):
    if len(path.parts) == 1:
        return "mystructure:" + path.stem
    namespace, *parts = path.with_suffix("").parts
    return namespace + ":" + "/".join(parts)


def inventory(root, args):
    directory = root / BP / "structures"
    declared = definitions(root, BP / "blocks", "minecraft:block") if args.check_blocks else {}
    selected = []
    blocks = []
    issues = []
    for path in sorted(directory.rglob("*.mcstructure")):
        identifier = structure_id(path.relative_to(directory))
        if args.query.casefold() not in identifier.casefold():
            continue
        relative = path.relative_to(root).as_posix()
        try:
            metadata = validate_mcstructure_file(path, include_blocks=args.palette or bool(args.block) or args.check_blocks)
        except MCStructureError as error:
            issues.append({"file": relative, "message": str(error)})
            continue

        layers = metadata.pop("block_counts", [])
        totals = defaultdict(lambda: [0] * len(layers))
        for layer, counts in enumerate(layers):
            for block, count in counts.items():
                totals[block][layer] = count
        if args.check_blocks:
            for block in sorted(totals):
                if ":" in block and not block.startswith("minecraft:") and block not in declared:
                    issues.append({"file": relative, "block": block, "message": "No local BP definition for custom block"})
        if args.block and args.block not in totals:
            continue
        if args.palette or args.block:
            blocks.extend({"structure": identifier, "block": block, "by_layer": counts}
                          for block, counts in sorted(totals.items()) if not args.block or block == args.block)
        selected.append({"id": identifier, "file": relative, **metadata})
    report = {**page(selected, args), "diagnostics": page(issues, args)}
    if args.palette or args.block:
        report["blocks"] = page(blocks, args)
    return bool(issues), report
