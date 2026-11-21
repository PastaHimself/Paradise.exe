"""Summarize captured CPU profiles and compare Blockception diagnostic reports."""

from collections import Counter, deque

from common import page, read_json


def cpu_profile(path, args):
    doc = read_json(path)
    nodes = doc.get("nodes")
    if not isinstance(nodes, list) or not nodes:
        raise ValueError("Expected a .cpuprofile with a non-empty nodes array")
    by_id = {node["id"]: node for node in nodes}
    if len(by_id) != len(nodes) or any(type(key) is not int for key in by_id):
        raise ValueError("Profile node IDs must be unique integers")
    parent = {}
    child_counts = {}
    for key, node in by_id.items():
        children = node.get("children", [])
        if not isinstance(children, list):
            raise ValueError(f"Expected children array in profile node {key}")
        child_counts[key] = len(children)
        for child in children:
            if type(child) is not int or child not in by_id or child in parent:
                raise ValueError(f"Invalid or multiply referenced child node {child!r}")
            parent[child] = key

    hits = Counter()
    own_us = Counter()
    samples, deltas = doc.get("samples"), doc.get("timeDeltas")
    if samples is not None:
        if not isinstance(samples, list) or any(type(key) is not int or key not in by_id for key in samples):
            raise ValueError("Profile samples must reference existing node IDs")
        hits.update(samples)
    else:
        for key, node in by_id.items():
            count = node.get("hitCount", 0)
            if type(count) is not int or count < 0:
                raise ValueError(f"Invalid hitCount in profile node {key}")
            hits[key] = count
    if deltas is not None:
        if (samples is None or not isinstance(deltas, list) or len(samples) != len(deltas)
                or any(type(delta) is not int or delta < 0 for delta in deltas)):
            raise ValueError("Expected one nonnegative time delta in microseconds per sample")
        for key, delta in zip(samples, deltas):
            own_us[key] += delta

    inclusive_us = own_us.copy()
    inclusive_hits = hits.copy()
    leaves = deque(key for key, count in child_counts.items() if count == 0)
    visited = 0
    while leaves:
        leaf = leaves.popleft()
        visited += 1
        if leaf in parent:
            caller = parent[leaf]
            inclusive_us[caller] += inclusive_us[leaf]
            inclusive_hits[caller] += inclusive_hits[leaf]
            child_counts[caller] -= 1
            if child_counts[caller] == 0:
                leaves.append(caller)
    if visited != len(nodes):
        raise ValueError("Cycle in profile call tree")

    rows = []
    for key, node in by_id.items():
        frame = node["callFrame"]
        file = frame.get("url", "").replace("\\", "/")
        if args.file.casefold() not in file.casefold() or not inclusive_hits[key]:
            continue
        row = {"node": key, "caller": parent.get(key), "function": frame.get("functionName") or "(anonymous)",
               "file": file, "line": frame.get("lineNumber", -1) + 1 or None,
               "self_samples": hits[key], "total_samples": inclusive_hits[key]}
        if deltas is not None:
            row.update(self_us=own_us[key], total_us=inclusive_us[key])
        rows.append(row)

    order = args.sort
    sample_key = f"{order}_samples"
    time_key = f"{order}_us"
    rows.sort(key=lambda row: (-row.get(time_key, 0), -row[sample_key], row["node"]))
    return {"samples": hits.total(), "sampled_us": own_us.total() if deltas is not None else None,
            "sort": order, **page(rows, args)}


def blockception_diagnostics(path, severities):
    report = read_json(path)
    rows = report["diagnostics"]
    if not isinstance(rows, list):
        raise ValueError("Expected a Blockception diagnostics array")
    result = Counter()
    for row in rows:
        severity = row.get("severityName") or {1: "error", 2: "warning"}.get(row.get("severity"))
        if severity in severities:
            key = (severity, row["file"].replace("\\", "/"),
                   row.get("code") or "", " ".join(row["message"].split()))
            result[key] += 1
    return result


def compare_diagnostics(current_path, baseline_path, args):
    severities = {"error", "warning"} if args.warnings else {"error"}
    current = blockception_diagnostics(current_path, severities)
    baseline = blockception_diagnostics(baseline_path, severities) if baseline_path else Counter()
    added, resolved = current - baseline, baseline - current

    def rows(counts):
        return [
            {"severity": severity, "file": file, "code": code, "message": message, "count": count}
            for (severity, file, code, message), count in sorted(counts.items())
        ]

    return bool(added), {"current": current.total(), "baseline": baseline.total(),
                         "added": page(rows(added), args), "resolved": page(rows(resolved), args)}
