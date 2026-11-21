"""Read exact 1-based line slices of a script so an agent never has to dump
a 200 KB module to see one function."""

from pathlib import Path

MAX_LINES = 2000


def resolve_script(root, index, name):
    candidate = Path(name).as_posix()
    if candidate in index["scriptPaths"]:
        return candidate
    absolute = Path(name)
    if absolute.is_absolute():
        if absolute.is_relative_to(root):
            relative = absolute.relative_to(root).as_posix()
            if relative in index["scriptPaths"]:
                return relative
    matches = [member for member in index["scriptPaths"] if name.casefold() in member.casefold()]
    if not matches:
        basenames = [member for member in index["scriptPaths"] if Path(member).name == name]
        matches = basenames
    if len(matches) == 1:
        return matches[0]
    if not matches:
        raise ValueError(f"No script matches {name!r}; pass a unique substring or repo-relative path")
    raise ValueError(f"{name!r} matches {len(matches)} scripts; narrow it: {', '.join(matches[:5])}")


def slice_file(root, args, index):
    relative = resolve_script(root, index, args.file)
    path = root / relative
    if path.is_symlink():
        raise ValueError(f"Refusing to slice a symbolic link: {relative}")
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    symbol = None
    if args.symbol:
        rows = [row for row in index["rows"]
                if row["kind"] == "symbol" and row["file"] == relative and args.symbol.casefold() in row["name"].casefold()]
        if not rows:
            raise ValueError(f"No symbol matching {args.symbol!r} in {relative}")
        exact = [row for row in rows if row["name"].casefold() == args.symbol.casefold()]
        row = (exact or sorted(rows, key=lambda item: (len(item["name"]), item["name"])))[0]
        symbol = row["name"]
        start = row["line"]
        end = row.get("end") or row["line"]
    else:
        start = args.start or 1
        end = args.end if args.end is not None else len(lines)
    if type(start) is not int or type(end) is not int or not 1 <= start <= end <= len(lines):
        raise ValueError(f"Expected 1 <= start <= end <= {len(lines)} for {relative}, received {start}..{end}")
    if end - start + 1 > MAX_LINES:
        raise ValueError(f"Range {start}..{end} exceeds the {MAX_LINES}-line slice limit; narrow --start/--end or --symbol")
    return {
        "file": relative,
        "symbol": symbol,
        "start": start,
        "end": end,
        "total_lines": len(lines),
        "lines": [{"n": number, "text": lines[number - 1]} for number in range(start, end + 1)],
    }
