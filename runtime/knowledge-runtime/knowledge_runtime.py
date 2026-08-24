from __future__ import annotations

import hashlib
import json
import math
import os
import re
import shutil
import subprocess
import time
from collections import Counter
from dataclasses import dataclass
from importlib.metadata import PackageNotFoundError, version as package_version
from pathlib import Path
from typing import Any, Sequence


SCHEMA_VERSION = 1
INDEX_RELATIVE_PATH = Path(".workspaces/local/knowledge/qdrant-edge-v1")
INDEX_MANIFEST_NAME = "manifest.json"
SHARD_DIRECTORY_NAME = "shard"
FALLBACK_VECTOR_NAME = "fallback"
LOCAL_VECTOR_NAME = "local"
TOKEN_RE = re.compile(r"[^\W_]+", re.UNICODE)
HEADING_RE = re.compile(r"^#\s+(.+?)\s*$", re.MULTILINE)
IDENTITY_ROW_RE = re.compile(r"^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$", re.MULTILINE)
VECTOR_DIMENSIONS = 256
LOCAL_VECTOR_RELEVANCE_FLOOR = 0.35
QUERY_EXPANSIONS = {
    "hàng đợi": "queue backlog",
    "bệnh nhân": "patient clinical",
    "xử lý": "processing operations",
    "danh sách": "list collection",
    "ưu tiên": "priority",
    "phân công": "assignment",
    "trạng thái": "state status",
    "chi tiết": "detail",
    "khóa học": "course",
    "đăng ký": "enrollment",
    "thanh toán": "payment",
    "hành trình": "itinerary journey",
    "bản đồ": "map spatial",
    "bảo mật": "security",
    "sự cố": "incident",
    "điều tra": "investigation",
    "tài liệu": "document",
    "chỉnh sửa": "editing",
}

KIND_OPERATOR_KNOWLEDGE = "operator-knowledge"
KIND_FRONTEND_CODING_CONTEXT = "frontend-coding-context"
DEFAULT_KINDS = {KIND_OPERATOR_KNOWLEDGE}
PUBLIC_KINDS = {KIND_OPERATOR_KNOWLEDGE, KIND_FRONTEND_CODING_CONTEXT}
INDEXED_KINDS = PUBLIC_KINDS


class KnowledgeRuntimeError(RuntimeError):
    def __init__(self, message: str, *, code: str, exit_code: int) -> None:
        super().__init__(message)
        self.code = code
        self.exit_code = exit_code


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def normalize_text(value: str) -> str:
    value = value.casefold().replace("_", " ").replace("-", " ")
    return " ".join(TOKEN_RE.findall(value))


def tokenize(value: str) -> list[str]:
    return normalize_text(value).split()


def expand_query_text(value: str) -> str:
    normalized = normalize_text(value)
    expansions = [english for vietnamese, english in QUERY_EXPANSIONS.items() if vietnamese in normalized]
    return " ".join([normalized, *expansions])


def compact_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def first_paragraph(markdown: str, heading: str | None = None, limit: int = 520) -> str:
    source = markdown
    if heading:
        match = re.search(
            rf"^##\s+{re.escape(heading)}\s*$\n(.*?)(?=^##\s+|\Z)",
            markdown,
            re.MULTILINE | re.DOTALL | re.IGNORECASE,
        )
        if match:
            source = match.group(1)
    paragraphs = [compact_whitespace(item) for item in re.split(r"\n\s*\n", source)]
    paragraph = next(
        (
            item
            for item in paragraphs
            if item and not item.startswith(("#", "|", "```"))
        ),
        "",
    )
    return paragraph[:limit]


def file_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as error:
        raise KnowledgeRuntimeError(
            f"Cannot read runtime authority: {path}",
            code="source-read-failed",
            exit_code=3,
        ) from error


def flatten_json(value: Any, *, skip_keys: set[str] | None = None) -> str:
    skip = skip_keys or {"$schema"}
    parts: list[str] = []

    def visit(item: Any, key: str | None = None) -> None:
        if key and key not in skip:
            parts.append(key)
        if isinstance(item, dict):
            for child_key, child in item.items():
                if child_key not in skip:
                    visit(child, child_key)
        elif isinstance(item, list):
            for child in item:
                visit(child)
        elif item is not None:
            parts.append(str(item))

    visit(value)
    return " ".join(parts)


def stable_sparse_vector(value: str, dimensions: int = VECTOR_DIMENSIONS) -> list[float]:
    normalized = normalize_text(value)
    tokens = normalized.split()
    features: Counter[int] = Counter()
    for token in tokens:
        padded = f"^{token}$"
        for size in (3, 4, 5):
            for offset in range(max(0, len(padded) - size + 1)):
                feature = padded[offset : offset + size]
                slot = int.from_bytes(hashlib.sha256(feature.encode("utf-8")).digest()[:4], "big") % dimensions
                features[slot] += 1
    for left, right in zip(tokens, tokens[1:]):
        feature = f"{left}::{right}"
        slot = int.from_bytes(hashlib.sha256(feature.encode("utf-8")).digest()[:4], "big") % dimensions
        features[slot] += 2
    magnitude = math.sqrt(sum(value * value for value in features.values())) or 1.0
    return [round(features.get(index, 0) / magnitude, 7) for index in range(dimensions)]


def qdrant_edge_module() -> Any:
    try:
        import qdrant_edge  # type: ignore[import-not-found]
    except ImportError as error:
        raise KnowledgeRuntimeError(
            "qdrant-edge-py is required; install runtime/knowledge-runtime/requirements.txt",
            code="qdrant-edge-unavailable",
            exit_code=3,
        ) from error
    return qdrant_edge


def qdrant_edge_version() -> str:
    try:
        return package_version("qdrant-edge-py")
    except PackageNotFoundError:
        return "unknown"


def record_point_id(record_id: str) -> int:
    return int.from_bytes(hashlib.sha256(record_id.encode("utf-8")).digest()[:8], "big") & ((1 << 63) - 1)


def remove_cache_path(path: Path) -> None:
    if path.is_symlink() or path.is_file():
        path.unlink()
    elif path.is_dir():
        shutil.rmtree(path)


def replace_cache_directory(temporary: Path, target: Path) -> None:
    backup = target.with_name(f"{target.name}.previous-{os.getpid()}-{time.time_ns()}")
    if target.exists():
        target.replace(backup)
    try:
        temporary.replace(target)
    except Exception:
        if backup.exists() and not target.exists():
            backup.replace(target)
        raise
    if backup.exists():
        remove_cache_path(backup)


def local_model_signature(model_path: Path) -> str:
    if not model_path.exists() or not model_path.is_dir():
        raise KnowledgeRuntimeError(
            f"Local embedding model directory does not exist: {model_path}",
            code="embedding-model-missing",
            exit_code=2,
        )
    evidence: list[str] = []
    for candidate in sorted(model_path.rglob("*")):
        if candidate.is_file() and candidate.name in {
            "config.json",
            "modules.json",
            "tokenizer.json",
            "tokenizer_config.json",
            "sentence_bert_config.json",
        }:
            evidence.append(f"{candidate.relative_to(model_path).as_posix()}:{file_hash(candidate)}")
    return sha256_text("\n".join(evidence) or str(model_path.resolve()))


def encode_with_local_model(model_path: Path, texts: Sequence[str]) -> list[list[float]]:
    try:
        from sentence_transformers import SentenceTransformer  # type: ignore[import-not-found]
    except ImportError as error:
        raise KnowledgeRuntimeError(
            "sentence-transformers is not installed; omit --embedding-model to use deterministic fallback",
            code="embedding-provider-unavailable",
            exit_code=2,
        ) from error
    try:
        model = SentenceTransformer(str(model_path.resolve()), local_files_only=True)
        encoded = model.encode(list(texts), normalize_embeddings=True, show_progress_bar=False)
        return [[round(float(value), 7) for value in row] for row in encoded]
    except Exception as error:  # provider boundary
        raise KnowledgeRuntimeError(
            f"Local embedding model failed without network fallback: {error}",
            code="embedding-provider-failed",
            exit_code=2,
        ) from error


@dataclass(frozen=True)
class SourceFile:
    path: Path
    relative_path: str
    content_hash: str


def discover_source_files(source_root: Path) -> list[SourceFile]:
    source_root = source_root.resolve()
    workspace_root = source_root.parent if source_root.name == ".claude" else source_root
    installed_root = workspace_root / ".claude" / "knowledge"
    repository_root = source_root / "knowledge"
    operator_knowledge_root = installed_root if installed_root.is_dir() else repository_root
    if not operator_knowledge_root.is_dir():
        raise KnowledgeRuntimeError(
            f"Missing operator knowledge root: {operator_knowledge_root}",
            code="source-root-invalid",
            exit_code=3,
        )

    sources = [
        SourceFile(path, f".claude/knowledge/{path.relative_to(operator_knowledge_root).as_posix()}", file_hash(path))
        for path in sorted(set(operator_knowledge_root.rglob("*.md")), key=lambda item: item.as_posix())
        if not path.name.endswith(".schema.json")
    ]

    for current_path in sorted((workspace_root / ".worktrees").glob("*/coding-context/frontend/current.json")):
        try:
            manifest = json.loads(current_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise KnowledgeRuntimeError(
                f"Cannot read frontend coding-context manifest: {current_path}",
                code="coding-context-manifest-invalid",
                exit_code=3,
            ) from error
        project = str(manifest.get("project", ""))
        generation_relative = str(manifest.get("generationPath", ""))
        expected_prefix = f".worktrees/{project}/coding-context/frontend/generations/"
        if not project or not generation_relative.startswith(expected_prefix):
            raise KnowledgeRuntimeError(
                f"Frontend coding-context manifest escapes its project: {current_path}",
                code="coding-context-path-invalid",
                exit_code=3,
            )
        generation_path = (workspace_root / generation_relative).resolve()
        if not generation_path.is_file() or workspace_root not in generation_path.parents:
            raise KnowledgeRuntimeError(
                f"Frontend coding-context generation is missing: {generation_path}",
                code="coding-context-generation-missing",
                exit_code=3,
            )
        for path in (current_path, generation_path):
            sources.append(SourceFile(path, path.relative_to(workspace_root).as_posix(), file_hash(path)))
    return sorted(sources, key=lambda item: item.relative_path)


def source_generation(files: Sequence[SourceFile]) -> str:
    return sha256_text("\n".join(f"{item.relative_path}:{item.content_hash}" for item in files))


def identity_table(markdown: str) -> dict[str, str]:
    output: dict[str, str] = {}
    for key, value in IDENTITY_ROW_RE.findall(markdown):
        clean_key = compact_whitespace(key).casefold()
        clean_value = compact_whitespace(value).strip("`")
        if clean_key not in {"field", "---"} and set(clean_key) != {"-"}:
            output[clean_key] = clean_value
    return output


def operator_knowledge_record(source: SourceFile) -> dict[str, Any]:
    markdown = read_text(source.path)
    identity = identity_table(markdown)
    knowledge_id = identity.get("knowledge id", "")
    if not knowledge_id or not re.fullmatch(r"(?:fe|be|business|architecture|quality|deployment|workspace|source|platform|shared)\.[a-z0-9]+(?:-[a-z0-9]+)*", knowledge_id):
        raise KnowledgeRuntimeError(
            f"Operator knowledge needs a stable `Knowledge ID` row: {source.relative_path}",
            code="operator-knowledge-id-invalid",
            exit_code=3,
        )
    title_match = HEADING_RE.search(markdown)
    title = title_match.group(1).strip() if title_match else knowledge_id
    summary = first_paragraph(markdown, "Record") or first_paragraph(markdown)
    ownership = identity.get("operators", "")
    operators = [item.strip() for item in ownership.split(",") if item.strip()]
    if not operators:
        raise KnowledgeRuntimeError(
            f"Operator knowledge needs an `Operators` row: {source.relative_path}",
            code="operator-knowledge-owner-missing",
            exit_code=3,
        )
    tags = [item.strip() for item in identity.get("search tags", "").split(",") if item.strip()]
    dependencies = [item.strip() for item in identity.get("dependencies", "").split(",") if item.strip() and item.strip() != "none"]
    return make_record(
        record_id=f"operator-knowledge:{knowledge_id}",
        kind=KIND_OPERATOR_KNOWLEDGE,
        title=title,
        search_text=f"{knowledge_id} {knowledge_id} {title} {title} {' '.join(tags)} {markdown}",
        summary=summary,
        source=source,
        metadata={"knowledgeId": knowledge_id, "operators": operators, "tags": tags},
        payload={"knowledgeId": knowledge_id, "operators": operators, "summary": summary},
        dependencies=dependencies,
    )


def frontend_coding_context_records(source: SourceFile) -> list[dict[str, Any]]:
    try:
        snapshot = json.loads(read_text(source.path))
    except json.JSONDecodeError as error:
        raise KnowledgeRuntimeError(
            f"Frontend coding-context JSON is invalid: {source.relative_path}",
            code="coding-context-json-invalid",
            exit_code=3,
        ) from error
    if snapshot.get("kind") != KIND_FRONTEND_CODING_CONTEXT or not isinstance(snapshot.get("components"), list):
        raise KnowledgeRuntimeError(
            f"Frontend coding-context schema is invalid: {source.relative_path}",
            code="coding-context-schema-invalid",
            exit_code=3,
        )
    project = str(snapshot.get("project", ""))
    generation = str(snapshot.get("generation", {}).get("id", ""))
    input_hash = str(snapshot.get("generation", {}).get("inputSha256", ""))
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", project) or not generation or not input_hash.startswith("sha256:"):
        raise KnowledgeRuntimeError(
            f"Frontend coding-context identity is invalid: {source.relative_path}",
            code="coding-context-identity-invalid",
            exit_code=3,
        )
    records: list[dict[str, Any]] = []
    for component in snapshot["components"]:
        if not isinstance(component, dict):
            continue
        name = str(component.get("name", ""))
        component_source = str(component.get("source", ""))
        content_hash = str(component.get("sourceSha256", ""))
        if not name or not component_source or not content_hash.startswith("sha256:"):
            raise KnowledgeRuntimeError(
                f"Frontend component identity is invalid in {source.relative_path}",
                code="coding-context-component-invalid",
                exit_code=3,
            )
        description = compact_whitespace(str(component.get("description", "")))
        payload = {
            "project": project,
            "generation": generation,
            "generationInputSha256": input_hash,
            "name": name,
            "layer": component.get("layer"),
            "description": description,
            "props": component.get("props", {}),
            "contracts": component.get("contracts", []),
            "source": component_source,
            "sourceSha256": content_hash,
        }
        records.append(make_record(
            record_id=f"frontend-coding-context:{project}:{name}:{component_source}",
            kind=KIND_FRONTEND_CODING_CONTEXT,
            title=f"{name} ({component.get('layer', 'common')})",
            search_text=f"{name} {component.get('layer', '')} {description} {flatten_json(payload)}",
            summary=description or f"Generated frontend contract for {name}",
            source=source,
            metadata={"project": project, "generation": generation, "name": name, "layer": component.get("layer"), "contentSha256": content_hash},
            payload=payload,
            dependencies=[],
        ))
    return records


def make_record(
    *,
    record_id: str,
    kind: str,
    title: str,
    search_text: str,
    summary: str,
    source: SourceFile,
    metadata: dict[str, Any],
    payload: dict[str, Any],
    dependencies: list[str],
) -> dict[str, Any]:
    tokens = tokenize(search_text)
    counts = Counter(tokens)
    vector_text = " ".join([record_id, title, summary, flatten_json(payload)])
    return {
        "id": record_id,
        "kind": kind,
        "title": title,
        "summary": compact_whitespace(summary)[:900],
        "source": {"path": source.relative_path, "sha256": source.content_hash},
        "metadata": metadata,
        "payload": payload,
        "dependencies": sorted(set(dependencies)),
        "length": len(tokens),
        "terms": dict(sorted(counts.items())),
        "fallbackVector": stable_sparse_vector(vector_text),
        "vectorText": compact_whitespace(vector_text)[:2400],
    }


def records_from_sources(files: Sequence[SourceFile], source_root: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for source in files:
        parts = Path(source.relative_path).parts
        if len(parts) >= 3 and parts[1] == "knowledge" and source.path.suffix == ".md":
            records.append(operator_knowledge_record(source))
        elif source.relative_path.endswith("/components.json") and "/coding-context/frontend/generations/" in source.relative_path:
            records.extend(frontend_coding_context_records(source))
    ids = [record["id"] for record in records]
    duplicates = sorted(record_id for record_id, count in Counter(ids).items() if count > 1)
    if duplicates:
        raise KnowledgeRuntimeError(
            f"Duplicate operator knowledge ids: {', '.join(duplicates[:8])}",
            code="duplicate-record-id",
            exit_code=3,
        )
    return sorted(records, key=lambda item: item["id"])


def add_local_embeddings(records: list[dict[str, Any]], model_path: Path | None) -> dict[str, Any]:
    provider: dict[str, Any] = {
        "fallback": {"id": "hash-ngram-v1", "dimensions": VECTOR_DIMENSIONS},
        "local": None,
    }
    if model_path is None:
        return provider
    signature = local_model_signature(model_path)
    vectors = encode_with_local_model(model_path, [record["vectorText"] for record in records])
    if len(vectors) != len(records):
        raise KnowledgeRuntimeError(
            "Local embedding provider returned the wrong number of vectors",
            code="embedding-count-mismatch",
            exit_code=2,
        )
    for record, vector in zip(records, vectors):
        record["localVector"] = vector
    provider["local"] = {
        "id": "sentence-transformers-local",
        "modelSignature": signature,
        "dimensions": len(vectors[0]) if vectors else 0,
    }
    return provider


def build_index(source_root: Path, index_path: Path, embedding_model: Path | None = None) -> dict[str, Any]:
    source_root = source_root.resolve()
    files = discover_source_files(source_root)
    records = records_from_sources(files, source_root)
    provider = add_local_embeddings(records, embedding_model)
    source_manifest = [
        {"path": item.relative_path, "sha256": item.content_hash}
        for item in files
    ]
    counts = Counter(record["kind"] for record in records)
    local = provider.get("local")
    vector_dimensions = {
        FALLBACK_VECTOR_NAME: VECTOR_DIMENSIONS,
        **({LOCAL_VECTOR_NAME: int(local["dimensions"])} if local else {}),
    }
    point_ids = [record_point_id(record["id"]) for record in records]
    if len(point_ids) != len(set(point_ids)):
        raise KnowledgeRuntimeError(
            "Deterministic Qdrant point id collision",
            code="qdrant-point-id-collision",
            exit_code=3,
        )
    index = {
        "schemaVersion": SCHEMA_VERSION,
        "generation": source_generation(files),
        "sourceRoot": str(source_root),
        "builtAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "sourceAuthority": [".claude/knowledge/**/*.md", ".worktrees/*/coding-context/frontend/current.json"],
        "embedding": provider,
        "counts": dict(sorted(counts.items())),
        "sources": source_manifest,
        "recordCount": len(records),
        "storage": {
            "engine": "qdrant-edge",
            "binding": "qdrant-edge-py",
            "bindingVersion": qdrant_edge_version(),
            "shard": SHARD_DIRECTORY_NAME,
            "distance": "cosine",
            "vectors": vector_dimensions,
        },
    }
    index_path = index_path.resolve()
    index_path.parent.mkdir(parents=True, exist_ok=True)
    temporary = index_path.with_name(f"{index_path.name}.building-{os.getpid()}-{time.time_ns()}")
    temporary.mkdir(parents=True)
    shard = None
    try:
        qdrant = qdrant_edge_module()
        vectors = {
            name: qdrant.EdgeVectorParams(size=dimensions, distance=qdrant.Distance.Cosine)
            for name, dimensions in vector_dimensions.items()
        }
        (temporary / SHARD_DIRECTORY_NAME).mkdir()
        shard = qdrant.EdgeShard.create(
            str(temporary / SHARD_DIRECTORY_NAME),
            qdrant.EdgeConfig(vectors=vectors, on_disk_payload=True),
        )
        points = []
        for record, point_id in zip(records, point_ids):
            point_vectors = {FALLBACK_VECTOR_NAME: record["fallbackVector"]}
            if local:
                point_vectors[LOCAL_VECTOR_NAME] = record["localVector"]
            payload_record = {
                key: value
                for key, value in record.items()
                if key not in {"fallbackVector", "localVector"}
            }
            points.append(qdrant.Point(point_id, point_vectors, {"record": payload_record}))
        for offset in range(0, len(points), 128):
            shard.update(qdrant.UpdateOperation.upsert_points(points[offset : offset + 128]))
        shard.flush()
        observed = int(shard.info().points_count)
        if observed != len(records):
            raise KnowledgeRuntimeError(
                f"Qdrant Edge persisted {observed} of {len(records)} operator-knowledge records",
                code="qdrant-record-count-mismatch",
                exit_code=3,
            )
        shard.close()
        shard = None
        (temporary / INDEX_MANIFEST_NAME).write_text(
            json.dumps(index, ensure_ascii=False, separators=(",", ":")) + "\n",
            encoding="utf-8",
        )
        replace_cache_directory(temporary, index_path)
    except KnowledgeRuntimeError:
        raise
    except Exception as error:
        raise KnowledgeRuntimeError(
            f"Qdrant Edge index build failed: {error}",
            code="qdrant-index-build-failed",
            exit_code=3,
        ) from error
    finally:
        if shard is not None:
            shard.close()
        if temporary.exists():
            remove_cache_path(temporary)
    return index_summary(index, index_path=index_path, stale=False)


def load_qdrant_records(index_path: Path, expected_count: int) -> list[dict[str, Any]]:
    qdrant = qdrant_edge_module()
    shard = None
    try:
        shard = qdrant.EdgeShard.load(str(index_path / SHARD_DIRECTORY_NAME))
        records: list[dict[str, Any]] = []
        offset = None
        while True:
            page, offset = shard.scroll(
                qdrant.ScrollRequest(
                    offset=offset,
                    limit=256,
                    with_payload=True,
                    with_vector=False,
                )
            )
            for item in page:
                payload = item.payload if isinstance(item.payload, dict) else {}
                record = payload.get("record")
                if not isinstance(record, dict):
                    raise KnowledgeRuntimeError(
                        f"Qdrant point {item.id} has no operator-knowledge record payload",
                        code="qdrant-payload-invalid",
                        exit_code=3,
                    )
                records.append(record)
            if offset is None:
                break
        if len(records) != expected_count:
            raise KnowledgeRuntimeError(
                f"Qdrant Edge contains {len(records)} records; manifest expects {expected_count}",
                code="qdrant-record-count-mismatch",
                exit_code=3,
            )
        return sorted(records, key=lambda item: item["id"])
    except KnowledgeRuntimeError:
        raise
    except Exception as error:
        raise KnowledgeRuntimeError(
            f"Qdrant Edge shard is unreadable: {index_path}",
            code="index-invalid",
            exit_code=3,
        ) from error
    finally:
        if shard is not None:
            shard.close()


def qdrant_vector_scores(
    index_path: Path,
    query_vector: Sequence[float],
    vector_name: str,
    record_count: int,
) -> dict[int, float]:
    qdrant = qdrant_edge_module()
    shard = None
    try:
        shard = qdrant.EdgeShard.load(str(index_path / SHARD_DIRECTORY_NAME))
        points = shard.query(
            qdrant.QueryRequest(
                limit=record_count,
                query=qdrant.Query.Nearest(list(query_vector), using=vector_name),
                with_payload=False,
                with_vector=False,
            )
        )
        scores = {int(point.id): max(0.0, float(point.score)) for point in points}
        if len(scores) != record_count:
            raise KnowledgeRuntimeError(
                f"Qdrant Edge returned {len(scores)} of {record_count} vector scores",
                code="qdrant-query-count-mismatch",
                exit_code=3,
            )
        return scores
    except KnowledgeRuntimeError:
        raise
    except Exception as error:
        raise KnowledgeRuntimeError(
            f"Qdrant Edge vector query failed: {error}",
            code="qdrant-query-failed",
            exit_code=3,
        ) from error
    finally:
        if shard is not None:
            shard.close()


def load_index(index_path: Path) -> dict[str, Any]:
    manifest_path = index_path / INDEX_MANIFEST_NAME
    if not index_path.is_dir() or not manifest_path.is_file():
        raise KnowledgeRuntimeError(
            f"Operator knowledge index is missing: {index_path}",
            code="index-missing",
            exit_code=3,
        )
    try:
        index = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise KnowledgeRuntimeError(
            f"Operator knowledge index is unreadable: {index_path}",
            code="index-invalid",
            exit_code=3,
        ) from error
    if (
        index.get("schemaVersion") != SCHEMA_VERSION
        or index.get("storage", {}).get("engine") != "qdrant-edge"
        or not isinstance(index.get("recordCount"), int)
    ):
        raise KnowledgeRuntimeError(
            f"Unsupported operator knowledge index schema: {index.get('schemaVersion')}",
            code="index-schema-unsupported",
            exit_code=3,
        )
    index["records"] = load_qdrant_records(index_path, int(index["recordCount"]))
    index["_indexPath"] = str(index_path.resolve())
    return index


def current_staleness(index: dict[str, Any], source_root: Path) -> tuple[bool, list[str], str]:
    current_files = discover_source_files(source_root)
    current = {item.relative_path: item.content_hash for item in current_files}
    indexed = {
        str(item.get("path")): str(item.get("sha256"))
        for item in index.get("sources", [])
        if isinstance(item, dict)
    }
    changed = sorted(
        path
        for path in set(current) | set(indexed)
        if current.get(path) != indexed.get(path)
    )
    generation = source_generation(current_files)
    return bool(changed) or generation != index.get("generation"), changed, generation


def index_summary(index: dict[str, Any], *, index_path: Path, stale: bool, changed: Sequence[str] = ()) -> dict[str, Any]:
    local = index.get("embedding", {}).get("local")
    return {
        "schemaVersion": SCHEMA_VERSION,
        "indexPath": str(index_path.resolve()),
        "generation": index.get("generation"),
        "stale": stale,
        "changedSources": list(changed[:20]),
        "changedSourceCount": len(changed),
        "counts": index.get("counts", {}),
        "sourceCount": len(index.get("sources", [])),
        "recordCount": int(index.get("recordCount", len(index.get("records", [])))),
        "embedding": {
            "active": "local" if local else "deterministic-fallback",
            "fallback": index.get("embedding", {}).get("fallback"),
            "local": local,
        },
        "storage": index.get("storage", {}),
    }


def status_index(source_root: Path, index_path: Path) -> dict[str, Any]:
    index = load_index(index_path)
    stale, changed, _ = current_staleness(index, source_root)
    return index_summary(index, index_path=index_path, stale=stale, changed=changed)


def document_frequency(records: Sequence[dict[str, Any]]) -> Counter[str]:
    frequency: Counter[str] = Counter()
    for record in records:
        frequency.update(record.get("terms", {}).keys())
    return frequency


def bm25_scores(records: Sequence[dict[str, Any]], query_tokens: Sequence[str]) -> list[float]:
    if not records:
        return []
    frequencies = document_frequency(records)
    average_length = sum(max(1, int(record.get("length", 1))) for record in records) / len(records)
    output: list[float] = []
    k1 = 1.35
    b = 0.72
    query_counts = Counter(query_tokens)
    for record in records:
        terms = record.get("terms", {})
        length = max(1, int(record.get("length", 1)))
        score = 0.0
        for token, query_count in query_counts.items():
            term_frequency = int(terms.get(token, 0))
            if term_frequency <= 0:
                continue
            df = frequencies[token]
            inverse = math.log(1.0 + (len(records) - df + 0.5) / (df + 0.5))
            denominator = term_frequency + k1 * (1.0 - b + b * length / average_length)
            score += inverse * (term_frequency * (k1 + 1.0) / denominator) * (1.0 + math.log(query_count))
        output.append(score)
    return output


def validate_kinds(kinds: Sequence[str] | None) -> set[str]:
    if not kinds:
        return set(DEFAULT_KINDS)
    requested = set(kinds)
    unknown = sorted(requested - PUBLIC_KINDS)
    if unknown:
        raise KnowledgeRuntimeError(
            f"Unknown knowledge kind(s): {', '.join(unknown)}",
            code="filter-kind-invalid",
            exit_code=2,
        )
    return requested


def score_records(
    records: Sequence[dict[str, Any]],
    query_text: str,
    vector_scores: dict[int, float],
    vector_provider: str,
) -> list[dict[str, Any]]:
    expanded_query = expand_query_text(query_text)
    query_tokens = tokenize(expanded_query)
    if not query_tokens:
        raise KnowledgeRuntimeError("Query text has no searchable terms", code="query-empty", exit_code=2)
    lexical = bm25_scores(records, query_tokens)
    maximum = max(lexical, default=0.0) or 1.0
    normalized_query = normalize_text(query_text)
    query_set = set(query_tokens)
    scored: list[dict[str, Any]] = []
    for record, lexical_score in zip(records, lexical):
        vector_score = vector_scores.get(record_point_id(record["id"]), 0.0)
        identity = normalize_text(
            " ".join(
                [
                    str(record.get("id", "")),
                    str(record.get("title", "")),
                    flatten_json(record.get("metadata", {})),
                ]
            )
        )
        exact_bonus = 0.22 if normalized_query and normalized_query in identity else 0.0
        record_name = normalize_text(str(record.get("metadata", {}).get("name", "")))
        name_bonus = 0.55 if record_name and record_name in normalized_query else 0.0
        identity_overlap = len(query_set & set(identity.split())) / max(1, len(query_set))
        combined = 0.70 * (lexical_score / maximum) + 0.18 * vector_score + 0.12 * identity_overlap + exact_bonus + name_bonus
        matched_terms = sorted(query_set & set(record.get("terms", {}).keys()))
        scored.append(
            {
                "record": record,
                "score": round(combined, 6),
                "lexicalScore": round(lexical_score, 6),
                "vectorScore": round(vector_score, 6),
                "vectorProvider": vector_provider,
                "matchedTerms": matched_terms[:16],
            }
        )
    return sorted(scored, key=lambda item: (-item["score"], item["record"]["id"]))


def eligible_scores(scored: Sequence[dict[str, Any]], *, local_embeddings: bool) -> list[dict[str, Any]]:
    return [
        item
        for item in scored
        if (item["lexicalScore"] > 0 and item["matchedTerms"])
        or (local_embeddings and item["vectorScore"] >= LOCAL_VECTOR_RELEVANCE_FLOOR)
    ]


def public_hit(scored: dict[str, Any], *, required_by: Sequence[str] = ()) -> dict[str, Any]:
    record = scored["record"]
    output = {
        "id": record["id"],
        "kind": record["kind"],
        "title": record["title"],
        "summary": record["summary"],
        "score": scored["score"],
        "retrieval": {
            "lexical": scored["lexicalScore"],
            "vector": scored["vectorScore"],
            "vectorProvider": scored["vectorProvider"],
            "matchedTerms": scored["matchedTerms"],
        },
        "data": record.get("payload", {}),
        "provenance": record["source"],
    }
    if required_by:
        output["requiredBy"] = sorted(set(required_by))
    return output


def query_index(
    index: dict[str, Any],
    *,
    query_text: str,
    kinds: Sequence[str] | None,
    top_k: int,
    project: str | None,
    grammar: str | None,
    profile: str | None,
    route: str | None,
    embedding_model: Path | None,
) -> dict[str, Any]:
    if top_k < 1 or top_k > 20:
        raise KnowledgeRuntimeError("--top-k must be between 1 and 20", code="top-k-invalid", exit_code=2)
    if not tokenize(expand_query_text(query_text)):
        raise KnowledgeRuntimeError("Query text has no searchable terms", code="query-empty", exit_code=2)
    selected_kinds = validate_kinds(kinds)
    if grammar is not None or profile is not None or route is not None:
        raise KnowledgeRuntimeError(
            "Knowledge queries do not accept grammar, profile, or route filters",
            code="filter-unsupported",
            exit_code=2,
        )
    if project is not None and KIND_FRONTEND_CODING_CONTEXT not in selected_kinds:
        raise KnowledgeRuntimeError(
            "Project filtering is available only for frontend-coding-context queries",
            code="filter-project-unsupported",
            exit_code=2,
        )
    if KIND_FRONTEND_CODING_CONTEXT in selected_kinds and not project:
        raise KnowledgeRuntimeError(
            "frontend-coding-context queries require an exact project filter",
            code="filter-project-required",
            exit_code=2,
        )
    records = index["records"]

    local_metadata = index.get("embedding", {}).get("local")
    query_local_vector: Sequence[float] | None = None
    if embedding_model is not None:
        if not local_metadata:
            raise KnowledgeRuntimeError(
                "Index has no local embeddings; rebuild it with --embedding-model",
                code="index-local-embedding-absent",
                exit_code=2,
            )
        signature = local_model_signature(embedding_model)
        if signature != local_metadata.get("modelSignature"):
            raise KnowledgeRuntimeError(
                "Local embedding model does not match the index model signature",
                code="embedding-model-mismatch",
                exit_code=2,
            )
        query_local_vector = encode_with_local_model(embedding_model, [query_text])[0]
    vector_provider = "local" if query_local_vector is not None else "deterministic-fallback"
    vector_name = LOCAL_VECTOR_NAME if query_local_vector is not None else FALLBACK_VECTOR_NAME
    query_vector = query_local_vector or stable_sparse_vector(expand_query_text(query_text))
    vector_scores = qdrant_vector_scores(
        Path(index["_indexPath"]),
        query_vector,
        vector_name,
        len(records),
    )

    operator_knowledge_hits: list[dict[str, Any]] = []
    if KIND_OPERATOR_KNOWLEDGE in selected_kinds:
        operator_candidates = [record for record in records if record["kind"] == KIND_OPERATOR_KNOWLEDGE]
        operator_knowledge_hits = eligible_scores(
            score_records(operator_candidates, query_text, vector_scores, vector_provider),
            local_embeddings=query_local_vector is not None,
        )[:top_k]

    coding_context_hits: list[dict[str, Any]] = []
    if KIND_FRONTEND_CODING_CONTEXT in selected_kinds:
        coding_candidates = [
            record for record in records
            if record["kind"] == KIND_FRONTEND_CODING_CONTEXT and record.get("metadata", {}).get("project") == project
        ]
        coding_context_hits = eligible_scores(
            score_records(coding_candidates, query_text, vector_scores, vector_provider),
            local_embeddings=query_local_vector is not None,
        )[:top_k]

    all_hits = [*operator_knowledge_hits, *coding_context_hits]
    if not all_hits:
        raise KnowledgeRuntimeError("No eligible knowledge record", code="no-eligible-result", exit_code=4)

    return {
        "schemaVersion": SCHEMA_VERSION,
        "query": query_text,
        "filters": {
            "project": project,
            "grammar": grammar,
            "profile": profile,
            "route": route,
            "kinds": sorted(selected_kinds),
            "topK": top_k,
        },
        "selected": {
            "operatorKnowledge": [public_hit(hit) for hit in operator_knowledge_hits],
            "frontendCodingContext": [public_hit(hit) for hit in coding_context_hits],
        },
        "provenance": {
            "generation": index["generation"],
            "sources": sorted(
                {
                    (hit["record"]["source"]["path"], hit["record"]["source"]["sha256"])
                    for hit in all_hits
                }
            ),
        },
        "index": {
            "recordCount": len(records),
            "counts": index.get("counts", {}),
            "embedding": vector_provider,
            "vectorStore": "qdrant-edge",
        },
    }


def run_query(
    *,
    source_root: Path,
    index_path: Path,
    query_text: str,
    kinds: Sequence[str] | None,
    top_k: int,
    project: str | None,
    grammar: str | None,
    profile: str | None,
    route_path: Path | None,
    rebuild_if_stale: bool,
    embedding_model: Path | None,
) -> dict[str, Any]:
    source_root = source_root.resolve()
    route: str | None = None
    if route_path is not None:
        routed = resolve_route(route_path, source_root)
        route = str(routed["route"])
        for name, explicit, resolved in (
            ("project", project, routed["project"]),
            ("grammar", grammar, routed["grammar"]),
            ("profile", profile, routed["profile"]),
        ):
            if explicit is not None and explicit != resolved:
                raise KnowledgeRuntimeError(
                    f"Explicit {name} {explicit!r} conflicts with routed value {resolved!r}",
                    code=f"route-{name}-conflict",
                    exit_code=2,
                )
        project = str(routed["project"]) if routed["project"] else None
        grammar = str(routed["grammar"]) if routed["grammar"] else None
        profile = str(routed["profile"]) if routed["profile"] else None

    if not index_path.is_dir() or not (index_path / INDEX_MANIFEST_NAME).is_file():
        if not rebuild_if_stale:
            raise KnowledgeRuntimeError(
                f"Operator knowledge index is missing: {index_path}",
                code="index-missing",
                exit_code=3,
            )
        build_index(source_root, index_path, embedding_model)
    index = load_index(index_path)
    stale, changed, _ = current_staleness(index, source_root)
    if stale:
        if not rebuild_if_stale:
            raise KnowledgeRuntimeError(
                f"Operator knowledge index is stale ({len(changed)} changed source files)",
                code="index-stale",
                exit_code=3,
            )
        build_index(source_root, index_path, embedding_model)
        index = load_index(index_path)
    return query_index(
        index,
        query_text=query_text,
        kinds=kinds,
        top_k=top_k,
        project=project,
        grammar=grammar,
        profile=profile,
        route=route,
        embedding_model=embedding_model,
    )


def default_index_path(source_root: Path) -> Path:
    return source_root.resolve() / INDEX_RELATIVE_PATH
