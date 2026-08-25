#!/usr/bin/env python3
"""Machine-local reference index backed by Qdrant Edge and exposed through MCP."""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import importlib.metadata
import json
import math
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Iterable

SCHEMA_VERSION = 1
VECTOR_DIMENSIONS = 8
CHUNK_LINES = 160
CHUNK_OVERLAP = 20
MAX_FILE_BYTES = 1_000_000
TEXT_SUFFIXES = {
    ".c", ".cc", ".cpp", ".cs", ".css", ".go", ".graphql", ".h", ".hpp", ".html",
    ".java", ".js", ".json", ".jsx", ".kt", ".kts", ".md", ".mdx", ".mjs", ".mts",
    ".php", ".prisma", ".py", ".rb", ".rs", ".scss", ".sh", ".sql", ".svelte", ".swift",
    ".toml", ".ts", ".tsx", ".vue", ".xml", ".yaml", ".yml",
}
EXCLUDED_PARTS = {
    ".git", ".next", ".nuxt", ".output", ".turbo", ".venv", "build", "coverage", "dist",
    "node_modules", "target", "vendor",
}
EXCLUDED_NAMES = {
    ".env", ".env.local", "package-lock.json", "pnpm-lock.yaml", "yarn.lock",
}


class RuntimeFailure(RuntimeError):
    pass


def stable_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_text(value: str) -> str:
    return sha256_bytes(value.encode("utf-8"))


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def atomic_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{os.getpid()}.{time.time_ns()}.tmp")
    temporary.write_text(stable_json(value) + "\n", encoding="utf-8")
    os.replace(temporary, path)


def readable_path(path: Path) -> Path:
    resolved = path.resolve()
    if os.name == "nt" and not str(resolved).startswith("\\\\?\\"):
        return Path(f"\\\\?\\{resolved}")
    return resolved


def git(root: Path, *args: str, check: bool = True) -> str:
    result = subprocess.run(
        ["git", "-C", str(root), *args],
        text=True,
        encoding="utf-8",
        errors="replace",
        capture_output=True,
        check=False,
    )
    if check and result.returncode != 0:
        raise RuntimeFailure(result.stderr.strip() or f"git {' '.join(args)} failed")
    return result.stdout.strip()


def git_ok(root: Path, *args: str) -> bool:
    return subprocess.run(
        ["git", "-C", str(root), *args],
        text=True,
        encoding="utf-8",
        errors="replace",
        capture_output=True,
        check=False,
    ).returncode == 0


def eligible(relative_path: str) -> bool:
    path = Path(relative_path)
    lowered = {part.lower() for part in path.parts}
    if lowered & EXCLUDED_PARTS or path.name.lower() in EXCLUDED_NAMES:
        return False
    if path.name.startswith(".env") or path.suffix.lower() not in TEXT_SUFFIXES:
        return False
    return True


def tracked_files(root: Path) -> list[str]:
    output = subprocess.run(
        ["git", "-C", str(root), "ls-files", "-z"],
        capture_output=True,
        check=True,
    ).stdout
    return sorted(item.decode("utf-8", errors="surrogateescape") for item in output.split(b"\0") if item and eligible(item.decode("utf-8", errors="surrogateescape")))


def read_text_file(path: Path) -> tuple[str, bytes]:
    raw = path.read_bytes()
    if len(raw) > MAX_FILE_BYTES or b"\0" in raw:
        raise RuntimeFailure(f"ineligible binary or oversized file: {path}")
    return raw.decode("utf-8", errors="replace"), raw


def chunk_text(text: str) -> list[tuple[int, int, str]]:
    lines = text.splitlines()
    if not lines:
        return [(1, 1, "")]
    chunks: list[tuple[int, int, str]] = []
    step = max(1, CHUNK_LINES - CHUNK_OVERLAP)
    for start in range(0, len(lines), step):
        selected = lines[start : start + CHUNK_LINES]
        chunks.append((start + 1, start + len(selected), "\n".join(selected)))
        if start + CHUNK_LINES >= len(lines):
            break
    return chunks


def point_id(reference_id: str, relative_path: str, start_line: int) -> int:
    digest = hashlib.sha256(f"{reference_id}\0{relative_path}\0{start_line}".encode("utf-8")).digest()
    return int.from_bytes(digest[:8], "big") & ((1 << 63) - 1)


def vector_for(value: str) -> list[float]:
    digest = hashlib.sha256(value.encode("utf-8")).digest()
    values = [((int.from_bytes(digest[index * 4 : index * 4 + 4], "big") / 0xFFFFFFFF) * 2) - 1 for index in range(VECTOR_DIMENSIONS)]
    norm = math.sqrt(sum(item * item for item in values)) or 1.0
    return [item / norm for item in values]


def inventory(root: Path) -> tuple[list[dict[str, Any]], dict[str, list[tuple[int, int, str]]]]:
    files: list[dict[str, Any]] = []
    chunks_by_path: dict[str, list[tuple[int, int, str]]] = {}
    for relative_path in tracked_files(root):
        raw = readable_path(root / relative_path).read_bytes()
        if len(raw) > MAX_FILE_BYTES or b"\0" in raw:
            continue
        text = raw.decode("utf-8", errors="replace")
        chunks = chunk_text(text)
        files.append({
            "path": relative_path.replace("\\", "/"),
            "blobSha256": f"sha256:{sha256_bytes(raw)}",
            "bytes": len(raw),
            "recordCount": len(chunks),
        })
        chunks_by_path[relative_path.replace("\\", "/")] = chunks
    return files, chunks_by_path


def contract_fingerprint() -> str:
    contract = {
        "schemaVersion": SCHEMA_VERSION,
        "vectorDimensions": VECTOR_DIMENSIONS,
        "chunkLines": CHUNK_LINES,
        "chunkOverlap": CHUNK_OVERLAP,
        "maxFileBytes": MAX_FILE_BYTES,
        "suffixes": sorted(TEXT_SUFFIXES),
        "excludedParts": sorted(EXCLUDED_PARTS),
        "excludedNames": sorted(EXCLUDED_NAMES),
    }
    return f"sha256:{sha256_text(stable_json(contract))}"


def calculate_metrics(current: list[dict[str, Any]], previous: list[dict[str, Any]]) -> tuple[dict[str, Any], set[str]]:
    current_map = {item["path"]: item for item in current}
    previous_map = {item["path"]: item for item in previous}
    added = set(current_map) - set(previous_map)
    deleted = set(previous_map) - set(current_map)
    modified = {path for path in set(current_map) & set(previous_map) if current_map[path]["blobSha256"] != previous_map[path]["blobSha256"]}
    unchanged = set(current_map) & set(previous_map) - modified
    changed = added | modified | deleted
    changed_bytes = sum((current_map[path] if path in current_map else previous_map[path])["bytes"] for path in changed)
    affected_records = sum((current_map[path] if path in current_map else previous_map[path])["recordCount"] for path in changed)
    deleted_records = sum(previous_map[path]["recordCount"] for path in deleted)
    total_bytes = sum(item["bytes"] for item in current)
    total_records = sum(item["recordCount"] for item in current)
    incremental_cost = changed_bytes + affected_records * 1024 + deleted_records * 512
    full_cost = max(total_bytes + total_records * 1024, 1)
    metrics = {
        "addedFiles": len(added),
        "modifiedFiles": len(modified),
        "deletedFiles": len(deleted),
        "unchangedFiles": len(unchanged),
        "changedBytes": changed_bytes,
        "totalBytes": total_bytes,
        "affectedRecords": affected_records,
        "totalRecords": total_records,
        "incrementalCost": incremental_cost,
        "fullCost": full_cost,
        "deleteRatio": deleted_records / max(sum(item["recordCount"] for item in previous), 1),
        "affectedRecordRatio": affected_records / max(total_records, sum(item["recordCount"] for item in previous), 1),
    }
    return metrics, changed


def choose_action(policy: dict[str, Any], metrics: dict[str, Any], *, manual_full: bool, generation_ready: bool, contract_matches: bool, history_comparable: bool) -> tuple[str, str]:
    if manual_full:
        return "full", "manual-full"
    if not generation_ready:
        return "full", "generation-missing-or-corrupt"
    if not contract_matches:
        return "full", "index-contract-changed"
    if not history_comparable:
        return "full", "history-not-comparable"
    if metrics["addedFiles"] + metrics["modifiedFiles"] + metrics["deletedFiles"] == 0:
        return "noop", "no-eligible-drift"
    if metrics["affectedRecordRatio"] >= policy["maxAffectedRecordRatio"]:
        return "full", "affected-record-budget-crossed"
    if metrics["deleteRatio"] >= policy["maxDeleteRatio"]:
        return "full", "delete-budget-crossed"
    if metrics["incrementalCost"] / metrics["fullCost"] >= policy["incrementalCostCeiling"]:
        return "full", "incremental-cost-crossed"
    return "incremental", "compatible-delta"


def qdrant_module():
    import qdrant_edge  # type: ignore[import-not-found]
    return qdrant_edge


def point_payloads(reference_id: str, revision: str, root: Path, files: Iterable[dict[str, Any]], chunks_by_path: dict[str, list[tuple[int, int, str]]]):
    for item in files:
        for start_line, end_line, text in chunks_by_path[item["path"]]:
            identifier = point_id(reference_id, item["path"], start_line)
            record = {
                "id": f"{reference_id}:{item['path']}:{start_line}",
                "reference": reference_id,
                "path": item["path"],
                "startLine": start_line,
                "endLine": end_line,
                "text": text,
                "revision": revision,
                "blobSha256": item["blobSha256"],
            }
            yield identifier, record


def build_generation(candidate: Path, reference_id: str, revision: str, files: list[dict[str, Any]], chunks_by_path: dict[str, list[tuple[int, int, str]]], previous_generation: Path | None, changed_paths: set[str], action: str) -> int:
    qdrant = qdrant_module()
    shard_path = candidate / "shard"
    if action == "incremental" and previous_generation is not None:
        shutil.copytree(previous_generation, candidate)
        shard = qdrant.EdgeShard.load(str(readable_path(shard_path)))
        previous_manifest = read_json(candidate / "manifest.json")
        prior_points = [point for item in previous_manifest["files"] if item["path"] in changed_paths for point in item.get("pointIds", [])]
        if prior_points:
            shard.update(qdrant.UpdateOperation.delete_points(prior_points))
    else:
        candidate.mkdir(parents=True)
        shard_path.mkdir()
        shard = qdrant.EdgeShard.create(str(readable_path(shard_path)), qdrant.EdgeConfig(vectors={"fallback": qdrant.EdgeVectorParams(size=VECTOR_DIMENSIONS, distance=qdrant.Distance.Cosine)}, on_disk_payload=True))
    try:
        selected_files = files if action == "full" else [item for item in files if item["path"] in changed_paths]
        points = [qdrant.Point(identifier, {"fallback": vector_for(record["path"] + "\n" + record["text"])}, {"record": record}) for identifier, record in point_payloads(reference_id, revision, Path(), selected_files, chunks_by_path)]
        for offset in range(0, len(points), 128):
            shard.update(qdrant.UpdateOperation.upsert_points(points[offset : offset + 128]))
        shard.flush()
        observed = int(shard.info().points_count)
    finally:
        shard.close()
    return observed


def active_manifest(partition_root: Path) -> tuple[dict[str, Any] | None, Path | None]:
    pointer = partition_root / "active.json"
    if not pointer.is_file():
        return None, None
    try:
        active = read_json(pointer)
        generation = partition_root / "generations" / active["generation"]
        manifest = read_json(generation / "manifest.json")
        if not (generation / "shard").is_dir():
            return None, None
        return manifest, generation
    except (OSError, KeyError, json.JSONDecodeError):
        return None, None


def index_reference(state_root: Path, reference_root: Path, reference_id: str, policy: dict[str, Any], manual_full: bool) -> dict[str, Any]:
    checkout = reference_root / reference_id
    if not (checkout / ".git").exists():
        raise RuntimeFailure(f"reference checkout is missing: {checkout}")
    if git(checkout, "status", "--porcelain"):
        raise RuntimeFailure(f"reference checkout is dirty: {checkout}")
    revision = git(checkout, "rev-parse", "HEAD")
    files, chunks_by_path = inventory(checkout)
    partition_root = state_root / "partitions" / reference_id
    previous, previous_generation = active_manifest(partition_root)
    prior_files = previous.get("files", []) if previous else []
    metrics, changed_paths = calculate_metrics(files, prior_files)
    generation_ready = previous is not None and previous_generation is not None
    contract = contract_fingerprint()
    contract_matches = bool(previous and previous.get("contractFingerprint") == contract)
    previous_revision = previous.get("revision") if previous else None
    history_comparable = bool(previous_revision and git_ok(checkout, "merge-base", "--is-ancestor", previous_revision, revision))
    if previous_revision == revision:
        history_comparable = True
    action, reason = choose_action(policy, metrics, manual_full=manual_full, generation_ready=generation_ready, contract_matches=contract_matches, history_comparable=history_comparable)
    if action == "noop":
        return {"id": reference_id, "beforeRevision": previous_revision, "afterRevision": revision, "action": action, "reason": reason, "generation": previous["generation"], "metrics": metrics}

    generation = sha256_text(stable_json({"reference": reference_id, "revision": revision, "contract": contract, "files": files}))[:24]
    generations = partition_root / "generations"
    generations.mkdir(parents=True, exist_ok=True)
    temporary = generations / f".b-{os.getpid()}-{time.time_ns():x}"
    candidate = generations / generation
    if candidate.exists():
        shutil.rmtree(candidate)
    try:
        observed = build_generation(temporary, reference_id, revision, files, chunks_by_path, previous_generation, changed_paths, action)
    except Exception:
        shutil.rmtree(temporary, ignore_errors=True)
        raise
    enriched_files = []
    for item in files:
        point_ids = [point_id(reference_id, item["path"], start) for start, _, _ in chunks_by_path[item["path"]]]
        enriched_files.append({**item, "pointIds": point_ids})
    expected = sum(item["recordCount"] for item in files)
    if observed != expected:
        shutil.rmtree(temporary, ignore_errors=True)
        raise RuntimeFailure(f"candidate point count mismatch for {reference_id}: {observed} != {expected}")
    manifest = {"schemaVersion": SCHEMA_VERSION, "reference": reference_id, "revision": revision, "generation": generation, "contractFingerprint": contract, "recordCount": expected, "files": enriched_files}
    atomic_json(temporary / "manifest.json", manifest)
    os.replace(temporary, candidate)
    atomic_json(partition_root / "active.json", {"schemaVersion": SCHEMA_VERSION, "generation": generation, "revision": revision})
    return {"id": reference_id, "beforeRevision": previous_revision, "afterRevision": revision, "action": action, "reason": reason, "generation": generation, "metrics": metrics}


def load_records(generation: Path) -> list[dict[str, Any]]:
    qdrant = qdrant_module()
    shard = qdrant.EdgeShard.load(str(readable_path(generation / "shard")))
    records: list[dict[str, Any]] = []
    offset = None
    try:
        while True:
            page, offset = shard.scroll(qdrant.ScrollRequest(offset=offset, limit=256, with_payload=True, with_vector=False))
            for point in page:
                if isinstance(point.payload, dict) and isinstance(point.payload.get("record"), dict):
                    records.append(point.payload["record"])
            if offset is None:
                break
    finally:
        shard.close()
    return records


def tokenize(value: str) -> list[str]:
    return re.findall(r"[a-z0-9_./:-]+", value.lower())


def search(state_root: Path, query: str, reference: str | None = None, path_prefix: str | None = None, top_k: int = 10) -> dict[str, Any]:
    if top_k < 1 or top_k > 50:
        raise RuntimeFailure("top_k must be between 1 and 50")
    terms = tokenize(query)
    if not terms:
        raise RuntimeFailure("query has no searchable terms")
    partitions = state_root / "partitions"
    candidates: list[dict[str, Any]] = []
    if not partitions.is_dir():
        raise RuntimeFailure("reference index is missing")
    roots = [partitions / reference] if reference else sorted(path for path in partitions.iterdir() if path.is_dir())
    for partition in roots:
        manifest, generation = active_manifest(partition)
        if not manifest or not generation:
            continue
        for record in load_records(generation):
            if path_prefix and not record["path"].startswith(path_prefix):
                continue
            path_text = record["path"].lower()
            body_text = record["text"].lower()
            score = sum((8 if term in path_text else 0) + min(body_text.count(term), 8) for term in terms)
            if score:
                candidates.append({"score": score, "reference": record["reference"], "path": record["path"], "startLine": record["startLine"], "endLine": record["endLine"], "revision": record["revision"], "text": record["text"][:4000]})
    candidates.sort(key=lambda item: (-item["score"], item["reference"], item["path"], item["startLine"]))
    return {"query": query, "count": min(len(candidates), top_k), "results": candidates[:top_k]}


def serve(state_root: Path, host: str, port: int) -> None:
    from mcp.server import MCPServer  # type: ignore[import-not-found]

    server = MCPServer("StarCi Reference Context", instructions="Read-only clean reference source lookup by full text and path.")

    @server.tool()
    def reference_search(query: str, reference: str | None = None, path_prefix: str | None = None, top_k: int = 10) -> dict[str, Any]:
        """Search clean immutable coding references. Returns paths, line spans, revisions, and bounded source excerpts."""
        return search(state_root, query, reference, path_prefix, top_k)

    server.run(transport="streamable-http", host=host, port=port, streamable_http_path="/mcp", stateless_http=True, json_response=True)


async def smoke(state_root: Path, url: str) -> dict[str, Any]:
    from mcp import Client  # type: ignore[import-not-found]

    partitions = state_root / "partitions"
    selected_reference = None
    selected_query = None
    for partition in sorted(path for path in partitions.iterdir() if path.is_dir()):
        manifest, generation = active_manifest(partition)
        if not manifest or not generation:
            continue
        records = load_records(generation)
        if not records:
            continue
        selected_reference = partition.name
        candidates = [token for token in tokenize(records[0]["path"] + " " + records[0]["text"][:500]) if len(token) >= 3]
        if candidates:
            selected_query = candidates[0]
            break
    if not selected_reference or not selected_query:
        raise RuntimeFailure("no active record is available for MCP query proof")
    async with Client(url) as client:
        tools = await client.list_tools()
        names = [tool.name for tool in tools.tools]
        if names != ["reference_search"]:
            raise RuntimeFailure(f"unexpected MCP tool set: {names}")
        result = await client.call_tool("reference_search", {"query": selected_query, "reference": selected_reference, "top_k": 1})
        if result.is_error or not result.content:
            raise RuntimeFailure("MCP reference_search proof failed")
    return {"url": url, "tools": names, "queryReference": selected_reference, "queryTokenSha256": f"sha256:{sha256_text(selected_query)}", "protocolProved": True, "queryProved": True}


def doctor() -> dict[str, Any]:
    dependencies = {}
    for package in ("qdrant-edge-py", "mcp"):
        try:
            dependencies[package] = importlib.metadata.version(package)
        except importlib.metadata.PackageNotFoundError:
            dependencies[package] = None
    return {"python": sys.version.split()[0], "dependencies": dependencies, "ready": all(dependencies.values())}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["doctor", "index", "query", "serve", "smoke"])
    parser.add_argument("--state-root", type=Path, default=Path(".workspaces/local/state/reference-context"))
    parser.add_argument("--reference-root", type=Path, default=Path(".worktrees/references"))
    parser.add_argument("--policy", type=Path, default=Path(__file__).with_name("drift-policy.json"))
    parser.add_argument("--reference", action="append")
    parser.add_argument("--manual-full", action="store_true")
    parser.add_argument("--query")
    parser.add_argument("--path-prefix")
    parser.add_argument("--top-k", type=int, default=10)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8020)
    parser.add_argument("--url", default="http://127.0.0.1:8021/mcp")
    args = parser.parse_args(argv)
    if args.command == "doctor":
        print(stable_json(doctor()))
        return 0 if doctor()["ready"] else 2
    if args.command == "index":
        policy = read_json(args.policy)
        references = args.reference or sorted(path.name for path in args.reference_root.iterdir() if path.is_dir() and (path / ".git").exists())
        results = [index_reference(args.state_root.resolve(), args.reference_root.resolve(), item, policy, args.manual_full) for item in references]
        print(stable_json({"schemaVersion": SCHEMA_VERSION, "policy": policy, "references": results}))
        return 0
    if args.command == "query":
        if not args.query:
            raise RuntimeFailure("query command requires --query")
        selected = args.reference[0] if args.reference and len(args.reference) == 1 else None
        print(stable_json(search(args.state_root.resolve(), args.query, selected, args.path_prefix, args.top_k)))
        return 0
    if args.command == "smoke":
        print(stable_json(asyncio.run(smoke(args.state_root.resolve(), args.url))))
        return 0
    serve(args.state_root.resolve(), args.host, args.port)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeFailure as error:
        print(stable_json({"status": "blocked", "error": str(error)}), file=sys.stderr)
        raise SystemExit(2)
