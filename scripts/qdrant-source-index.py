# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

EXCLUDED_DIRS = {
    ".git", ".github-cache", ".next", ".stacks", ".turbo", ".workspace", ".worktrees",
    "build", "coverage", "dist", "node_modules", "out", "target", "vendor", "__pycache__",
}
EXCLUDED_NAMES = {"package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lock", "bun.lockb"}
TEXT_SUFFIXES = {
    ".c", ".cc", ".cjs", ".cpp", ".cs", ".css", ".graphql", ".gql", ".h", ".html",
    ".java", ".js", ".json", ".jsx", ".kt", ".md", ".mdx", ".mjs", ".prisma", ".properties",
    ".py", ".rb", ".rs", ".scss", ".sh", ".sql", ".svelte", ".toml", ".ts", ".tsx",
    ".vue", ".xml", ".yaml", ".yml",
}
MAX_FILE_BYTES = 512 * 1024
CATALOG_CHARS = 12000
BATCH_SIZE = 8
MAX_BATCH_CHARS = 14000


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True)
    parser.add_argument("--project", required=True)
    parser.add_argument("--role", required=True)
    parser.add_argument("--repository", required=True)
    parser.add_argument("--revision", required=True)
    parser.add_argument("--collection", required=True)
    parser.add_argument("--qdrant-url", required=True)
    parser.add_argument("--api-key-file")
    parser.add_argument("--api-key-env")
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--ollama-url", required=True)
    parser.add_argument("--dimensions", required=True, type=int)
    return parser.parse_args()


def request(url: str, api_key: str, method: str = "GET", body: dict | None = None) -> dict:
    data = None if body is None else json.dumps(body).encode("utf-8")
    headers = {"content-type": "application/json"}
    if api_key:
        headers["api-key"] = api_key
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            payload = response.read()
            return json.loads(payload) if payload else {}
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:1000]
        raise RuntimeError(f"Qdrant {method} {url} failed ({error.code}): {detail}") from error


def git_dirty(root: Path) -> bool:
    result = subprocess.run(
        ["git", "-c", "safe.directory=*", "-C", str(root), "status", "--porcelain"],
        capture_output=True,
        text=True,
    )
    return result.returncode == 0 and bool(result.stdout.strip())


def language(path: Path) -> str:
    return path.suffix.lower().lstrip(".") or "text"


def files_under(root: Path):
    result = subprocess.run(
        ["git", "-c", "safe.directory=*", "-C", str(root), "ls-files", "-co", "--exclude-standard", "-z"],
        capture_output=True,
    )
    if result.returncode != 0:
        raise RuntimeError("git could not enumerate the routed checkout")
    for raw_relative in sorted(item for item in result.stdout.split(b"\0") if item):
        try:
            relative_text = raw_relative.decode("utf-8")
        except UnicodeDecodeError:
            continue
        relative = Path(relative_text)
        if any(part in EXCLUDED_DIRS or part.startswith(".cache") for part in relative.parts[:-1]):
            continue
        name = relative.name
        path = root / relative
        if name in EXCLUDED_NAMES or name.startswith(".env") or name.endswith((".map", ".min.js", ".min.css")):
            continue
        if path.suffix.lower() not in TEXT_SUFFIXES and name not in {"Dockerfile", "Makefile", "Procfile"}:
            continue
        try:
            if not path.is_file() or path.stat().st_size > MAX_FILE_BYTES:
                continue
            text = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        if text.strip():
            yield relative.as_posix(), text.replace("\r\n", "\n")


DECLARATION = re.compile(
    r"^\s*(?:import\b|export\b|@[A-Za-z_]\w*|(?:abstract\s+)?(?:class|interface|type|enum|function)\b|"
    r"(?:public|private|protected|static|readonly|async)\s+[A-Za-z_]\w*|"
    r"(?:const|let|var)\s+[A-Za-z_]\w*)"
)


def source_group(relative: str) -> str:
    parts = relative.split("/")
    if len(parts) >= 3 and parts[0] in {"src", "apps", "packages"}:
        return "/".join(parts[:3])
    return "/".join(parts[:2]) if len(parts) >= 2 else "root"


def source_outline(virtual_path: str, text: str) -> str:
    lines = text.splitlines()
    if len(text) <= 1800:
        body = text.strip()
    else:
        selected = []
        for line_number, line in enumerate(lines, start=1):
            if DECLARATION.match(line):
                selected.append(f"L{line_number}: {line.strip()}")
            if len(selected) >= 80:
                break
        body = "\n".join(selected) or "\n".join(lines[:30])
        body = body[:5000]
    return f"file: {virtual_path}\n{body}"


def main() -> None:
    args = parse_args()
    if not args.collection.startswith("starci-context-"):
        raise SystemExit("refusing non-context collection")
    root = Path(args.root).resolve()
    api_key = os.environ.get(args.api_key_env, "") if args.api_key_env else ""
    if args.api_key_file:
        api_key = Path(args.api_key_file).read_text(encoding="utf-8").strip()
    if not api_key:
        raise SystemExit("Qdrant API key file is empty")

    vector_name = "ollama-" + args.model.lower().replace(":", "-").replace("/", "-")
    vector_size = args.dimensions
    dirty = git_dirty(root)
    virtual_root = f"/{args.role}/{args.project}"
    grouped: dict[str, list[tuple[str, str]]] = {}
    for relative, text in files_under(root):
        virtual_path = f"{virtual_root}/{relative}"
        grouped.setdefault(source_group(relative), []).append(
            (virtual_path, source_outline(virtual_path, text))
        )

    records: list[dict] = []
    for group, entries in sorted(grouped.items()):
        catalog_index = 0
        cursor = 0
        while cursor < len(entries):
            selected: list[tuple[str, str]] = []
            size = 0
            while cursor < len(entries):
                candidate = entries[cursor]
                if selected and size + len(candidate[1]) + 2 > CATALOG_CHARS:
                    break
                selected.append(candidate)
                size += len(candidate[1]) + 2
                cursor += 1
            paths = [item[0] for item in selected]
            document = f"source catalog: {virtual_root}/{group}\n\n" + "\n\n".join(item[1] for item in selected)
            digest = hashlib.sha256(document.encode("utf-8")).hexdigest()
            point_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{virtual_root}/{group}/{catalog_index}/{digest}"))
            records.append({
                "id": point_id,
                "document": document,
                "metadata": {
                    "project": args.project,
                    "role": args.role,
                    "repository": args.repository,
                    "revision": args.revision,
                    "dirty": dirty,
                    "virtualRoot": virtual_root,
                    "relativePath": group,
                    "paths": paths,
                    "language": "source-catalog",
                    "chunkIndex": catalog_index,
                    "contentHash": digest,
                    "sourceKind": "workspace-source-catalog",
                },
            })
            catalog_index += 1
    if not records:
        raise SystemExit("no source chunks selected")

    generation = hashlib.sha256("".join(row["metadata"]["contentHash"] for row in records).encode("utf-8")).hexdigest()
    for row in records:
        row["metadata"]["generation"] = generation
    base = args.qdrant_url.rstrip("/")
    collection_url = f"{base}/collections/{urllib.parse.quote(args.collection, safe='')}"
    try:
        request(collection_url, api_key)
    except RuntimeError as error:
        if "(404)" not in str(error):
            raise
        request(collection_url, api_key, "PUT", {
            "vectors": {vector_name: {"size": vector_size, "distance": "Cosine"}},
        })

    existing_ids: set[str] = set()
    for offset in range(0, len(records), 256):
        ids = [row["id"] for row in records[offset:offset + 256]]
        retrieved = request(f"{collection_url}/points", api_key, "POST", {
            "ids": ids,
            "with_payload": True,
            "with_vector": False,
        })
        existing_ids.update(
            point["id"]
            for point in retrieved.get("result", [])
            if point.get("payload", {}).get("metadata", {}).get("generation") == generation
        )
    pending = [row for row in records if row["id"] not in existing_ids]
    if existing_ids:
        print(f"resume: {len(existing_ids)}/{len(records)} catalogs already indexed", flush=True)

    completed = len(existing_ids)
    cursor = 0
    while cursor < len(pending):
        batch = []
        batch_chars = 0
        while cursor < len(pending) and len(batch) < BATCH_SIZE:
            candidate = pending[cursor]
            candidate_chars = len(candidate["document"])
            if batch and batch_chars + candidate_chars > MAX_BATCH_CHARS:
                break
            batch.append(candidate)
            batch_chars += candidate_chars
            cursor += 1
        embed_response = request(args.ollama_url.rstrip("/") + "/api/embed", "", "POST", {
            "model": args.model,
            "input": [row["document"] for row in batch],
        })
        embeddings = embed_response.get("embeddings", [])
        if len(embeddings) != len(batch):
            raise RuntimeError(f"Ollama returned {len(embeddings)} embeddings for {len(batch)} documents")
        points = []
        for row, embedding in zip(batch, embeddings, strict=True):
            points.append({
                "id": row["id"],
                "vector": {vector_name: embedding},
                "payload": {"document": row["document"], "metadata": row["metadata"]},
            })
        request(f"{collection_url}/points?wait=true", api_key, "PUT", {"points": points})
        completed += len(batch)
        print(f"indexed {completed}/{len(records)} catalogs", flush=True)

    request(f"{collection_url}/points/delete?wait=true", api_key, "POST", {
        "filter": {
            "must": [
                {"key": "metadata.project", "match": {"value": args.project}},
                {"key": "metadata.role", "match": {"value": args.role}},
            ],
            "must_not": [
                {"key": "metadata.generation", "match": {"value": generation}},
            ],
        }
    })

    manifest = {
        "version": 1,
        "project": args.project,
        "role": args.role,
        "repository": args.repository,
        "revision": args.revision,
        "dirty": dirty,
        "collection": args.collection,
        "virtualRoot": virtual_root,
        "generation": generation,
        "embeddingModel": args.model,
        "vectorName": vector_name,
        "files": len({path for row in records for path in row["metadata"]["paths"]}),
        "chunks": len(records),
        "indexedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    manifest_path = Path(args.manifest)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"ready {args.collection}: {manifest['files']} files, {manifest['chunks']} chunks")


if __name__ == "__main__":
    main()
