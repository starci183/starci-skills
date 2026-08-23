from __future__ import annotations

import hashlib
import json
import math
import re
import subprocess
import time
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Sequence


SCHEMA_VERSION = 1
INDEX_RELATIVE_PATH = Path(".workspaces/local/design-knowledge/index-v1.json")
TOKEN_RE = re.compile(r"[^\W_]+", re.UNICODE)
HEADING_RE = re.compile(r"^#\s+(.+?)\s*$", re.MULTILINE)
IDENTITY_ROW_RE = re.compile(r"^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$", re.MULTILINE)
JSON_FENCE_RE = re.compile(r"```json\s*(\{.*?\})\s*```", re.DOTALL | re.IGNORECASE)
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

KIND_ARCHETYPE = "archetype"
KIND_GRAMMAR = "grammar"
KIND_GRAMMAR_OWNER = "grammar-owner"
KIND_PRINCIPLE = "principle"
PUBLIC_KINDS = {KIND_ARCHETYPE, KIND_GRAMMAR, KIND_PRINCIPLE}
INDEXED_KINDS = PUBLIC_KINDS | {KIND_GRAMMAR_OWNER}


class DesignKnowledgeError(RuntimeError):
    def __init__(self, message: str, *, code: str, exit_code: int) -> None:
        super().__init__(message)
        self.code = code
        self.exit_code = exit_code


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


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


def relative_posix(path: Path, root: Path) -> str:
    return path.resolve().relative_to(root.resolve()).as_posix()


def file_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as error:
        raise DesignKnowledgeError(
            f"Cannot read runtime authority: {path}",
            code="source-read-failed",
            exit_code=3,
        ) from error


def parse_json(path: Path) -> Any:
    try:
        return json.loads(read_text(path))
    except json.JSONDecodeError as error:
        raise DesignKnowledgeError(
            f"Invalid JSON authority {path}: {error}",
            code="source-json-invalid",
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


def cosine(left: Sequence[float], right: Sequence[float]) -> float:
    if len(left) != len(right):
        return 0.0
    return max(0.0, sum(a * b for a, b in zip(left, right)))


def local_model_signature(model_path: Path) -> str:
    if not model_path.exists() or not model_path.is_dir():
        raise DesignKnowledgeError(
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
        raise DesignKnowledgeError(
            "sentence-transformers is not installed; omit --embedding-model to use deterministic fallback",
            code="embedding-provider-unavailable",
            exit_code=2,
        ) from error
    try:
        model = SentenceTransformer(str(model_path.resolve()), local_files_only=True)
        encoded = model.encode(list(texts), normalize_embeddings=True, show_progress_bar=False)
        return [[round(float(value), 7) for value in row] for row in encoded]
    except Exception as error:  # provider boundary
        raise DesignKnowledgeError(
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
    archetype_root = source_root / ".claude" / "archetypes"
    grammar_root = source_root / ".claude" / "grammars"
    principle_root = source_root / ".claude" / "compilers" / "principles"
    for required in (archetype_root, grammar_root, principle_root):
        if not required.is_dir():
            raise DesignKnowledgeError(
                f"Missing design authority root: {required}",
                code="source-root-invalid",
                exit_code=3,
            )

    paths: set[Path] = set()
    for path in archetype_root.rglob("context.md"):
        if path.parent != archetype_root:
            paths.add(path)
    for path in principle_root.glob("*/context.md"):
        paths.add(path)
    for grammar_dir in grammar_root.iterdir():
        if not grammar_dir.is_dir() or not (grammar_dir / "grammar.json").is_file():
            continue
        for name in ("context.md", "grammar.json", "facts.json", "capsules.json", "rulings.json", "design-system.json"):
            path = grammar_dir / name
            if path.is_file():
                paths.add(path)
        paths.update(grammar_dir.glob("profiles/*.json"))
        paths.update(grammar_dir.glob("cases/*.json"))

    return [
        SourceFile(path, relative_posix(path, source_root), file_hash(path))
        for path in sorted(paths, key=lambda item: item.as_posix())
        if not path.name.endswith(".schema.json")
    ]


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


def output_payload(markdown: str) -> dict[str, Any]:
    output_match = re.search(r"^##\s+Output\s*$\n(.*)$", markdown, re.MULTILINE | re.DOTALL | re.IGNORECASE)
    if not output_match:
        return {}
    for candidate in JSON_FENCE_RE.findall(output_match.group(1)):
        try:
            payload = json.loads(candidate)
            if isinstance(payload, dict):
                return payload
        except json.JSONDecodeError:
            continue
    return {}


def important_archetype_text(markdown: str, identity: dict[str, str], payload: dict[str, Any]) -> str:
    title = (HEADING_RE.search(markdown).group(1) if HEADING_RE.search(markdown) else "")
    important = [
        title,
        identity.get("archetype id", ""),
        identity.get("family", ""),
        identity.get("dominant task", ""),
        identity.get("search aliases", ""),
        flatten_json({key: payload.get(key) for key in ("aliases", "dominantTask", "regions", "relationships", "responsive", "stateObligations")}),
    ]
    return " ".join(important * 3) + " " + markdown


def archetype_record(source: SourceFile) -> dict[str, Any]:
    markdown = read_text(source.path)
    identity = identity_table(markdown)
    payload = output_payload(markdown)
    archetype_id = (
        identity.get("archetype id")
        or str(payload.get("archetypeId") or "")
        or source.path.parent.name
    )
    title_match = HEADING_RE.search(markdown)
    title = title_match.group(1).strip() if title_match else archetype_id.replace("-", " ").title()
    aliases_value = identity.get("search aliases", "")
    aliases = payload.get("aliases") if isinstance(payload.get("aliases"), list) else []
    if not aliases:
        aliases = [item.strip() for item in aliases_value.split(",") if item.strip()]
    dominant_task = identity.get("dominant task") or str(payload.get("dominantTask") or first_paragraph(markdown, "Record"))
    family = identity.get("family") or source.path.parent.parent.name
    compact_payload = {
        key: payload[key]
        for key in (
            "archetypeId",
            "aliases",
            "dominantTask",
            "regions",
            "relationships",
            "responsive",
            "stateObligations",
            "boundaryVerdict",
            "grammarHandoff",
            "principlesHandoff",
        )
        if key in payload
    }
    compact_payload.setdefault("archetypeId", archetype_id)
    compact_payload.setdefault("aliases", aliases)
    compact_payload.setdefault("dominantTask", dominant_task)
    return make_record(
        record_id=f"archetype:{archetype_id}",
        kind=KIND_ARCHETYPE,
        title=title,
        search_text=important_archetype_text(markdown, identity, payload),
        summary=dominant_task,
        source=source,
        metadata={"archetypeId": archetype_id, "family": family, "aliases": aliases},
        payload=compact_payload,
        dependencies=[],
    )


def record_identifier(value: dict[str, Any], fallback: str) -> str:
    for key in ("id", "caseId", "ruleId", "factId", "capsuleId", "rulingId", "systemId", "grammarId"):
        candidate = value.get(key)
        if isinstance(candidate, str) and candidate:
            return candidate
    return fallback


def grammar_json_records(source: SourceFile, grammar_id: str) -> list[dict[str, Any]]:
    data = parse_json(source.path)
    records: list[dict[str, Any]] = []
    stem = source.path.stem

    if source.path.parent.name == "profiles" and isinstance(data, dict):
        profile_id = str(data.get("profileId") or source.path.stem)
        owners = data.get("owners", {})
        if not isinstance(owners, dict):
            return records
        for owner_id, owner in owners.items():
            if not isinstance(owner, dict):
                continue
            concerns = [str(item) for item in owner.get("principleConcerns", []) if isinstance(item, str)]
            summary = str(owner.get("reason") or owner.get("component") or owner_id)
            payload = {
                key: owner[key]
                for key in (
                    "decision",
                    "component",
                    "primitive",
                    "principleMode",
                    "principleConcerns",
                    "capsuleRefs",
                    "reason",
                )
                if key in owner
            }
            payload.update({"ownerId": owner_id, "grammar": grammar_id, "profileId": profile_id})
            records.append(
                make_record(
                    record_id=f"grammar-owner:{grammar_id}:{profile_id}:{owner_id}",
                    kind=KIND_GRAMMAR_OWNER,
                    title=owner_id,
                    search_text=f"{owner_id} {owner_id} {flatten_json(owner)}",
                    summary=summary,
                    source=source,
                    metadata={"grammar": grammar_id, "profileId": profile_id, "ownerId": owner_id},
                    payload=payload,
                    dependencies=concerns,
                )
            )
        return records

    if not isinstance(data, dict):
        return records
    list_fields = [
        (key, value)
        for key, value in data.items()
        if isinstance(value, list) and key not in {"spacingRungs", "componentLanguage", "antiPatterns"}
    ]
    if list_fields:
        for field, values in list_fields:
            for index, value in enumerate(values):
                if not isinstance(value, dict):
                    continue
                item_id = record_identifier(value, f"{field}-{index}")
                summary = str(value.get("statement") or value.get("outcome") or value.get("why") or value.get("reason") or item_id)
                records.append(
                    make_record(
                        record_id=f"grammar:{grammar_id}:{stem}:{item_id}",
                        kind=KIND_GRAMMAR,
                        title=item_id,
                        search_text=f"{item_id} {item_id} {flatten_json(value)}",
                        summary=summary,
                        source=source,
                        metadata={"grammar": grammar_id, "catalog": stem, "itemId": item_id},
                        payload={"grammar": grammar_id, "catalog": stem, "itemId": item_id, "summary": summary},
                        dependencies=[],
                    )
                )
        return records

    item_id = record_identifier(data, source.path.stem)
    summary = str(data.get("statement") or data.get("outcome") or data.get("why") or data.get("reason") or item_id)
    records.append(
        make_record(
            record_id=f"grammar:{grammar_id}:{stem}:{item_id}",
            kind=KIND_GRAMMAR,
            title=item_id,
            search_text=f"{item_id} {item_id} {flatten_json(data)}",
            summary=summary,
            source=source,
            metadata={"grammar": grammar_id, "catalog": stem, "itemId": item_id},
            payload={"grammar": grammar_id, "catalog": stem, "itemId": item_id, "summary": summary},
            dependencies=[],
        )
    )
    return records


def grammar_markdown_record(source: SourceFile, grammar_id: str) -> dict[str, Any]:
    markdown = read_text(source.path)
    title_match = HEADING_RE.search(markdown)
    title = title_match.group(1).strip() if title_match else grammar_id
    return make_record(
        record_id=f"grammar:{grammar_id}:context",
        kind=KIND_GRAMMAR,
        title=title,
        search_text=f"{grammar_id} {grammar_id} {markdown}",
        summary=first_paragraph(markdown, "Record"),
        source=source,
        metadata={"grammar": grammar_id, "catalog": "context", "itemId": grammar_id},
        payload={"grammar": grammar_id, "catalog": "context", "itemId": grammar_id, "summary": first_paragraph(markdown, "Record")},
        dependencies=[],
    )


def principle_record(source: SourceFile) -> dict[str, Any]:
    markdown = read_text(source.path)
    principle_id = source.path.parent.name
    title_match = HEADING_RE.search(markdown)
    title = title_match.group(1).strip() if title_match else principle_id.replace("-", " ").title()
    summary = first_paragraph(markdown, "Record") or first_paragraph(markdown, "Law")
    return make_record(
        record_id=f"principle:{principle_id}",
        kind=KIND_PRINCIPLE,
        title=title,
        search_text=f"{principle_id} {principle_id} {title} {title} {markdown}",
        summary=summary,
        source=source,
        metadata={"principleId": principle_id},
        payload={"principleId": principle_id, "summary": summary},
        dependencies=[],
    )


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
        if len(parts) >= 3 and parts[1] == "archetypes":
            records.append(archetype_record(source))
        elif len(parts) >= 4 and parts[1:3] == ("compilers", "principles"):
            records.append(principle_record(source))
        elif len(parts) >= 3 and parts[1] == "grammars":
            grammar_id = parts[2]
            if source.path.name == "context.md":
                records.append(grammar_markdown_record(source, grammar_id))
            else:
                records.extend(grammar_json_records(source, grammar_id))
    ids = [record["id"] for record in records]
    duplicates = sorted(record_id for record_id, count in Counter(ids).items() if count > 1)
    if duplicates:
        raise DesignKnowledgeError(
            f"Duplicate design knowledge ids: {', '.join(duplicates[:8])}",
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
        raise DesignKnowledgeError(
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
    index = {
        "schemaVersion": SCHEMA_VERSION,
        "generation": source_generation(files),
        "sourceRoot": str(source_root),
        "builtAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "sourceAuthority": [
            ".claude/archetypes/**/context.md",
            ".claude/grammars/*/{context.md,grammar.json,facts.json,capsules.json,rulings.json,design-system.json,profiles/*.json,cases/*.json}",
            ".claude/compilers/principles/*/context.md",
        ],
        "embedding": provider,
        "counts": dict(sorted(counts.items())),
        "sources": source_manifest,
        "records": records,
    }
    index_path = index_path.resolve()
    index_path.parent.mkdir(parents=True, exist_ok=True)
    temporary = index_path.with_suffix(index_path.suffix + ".tmp")
    temporary.write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    temporary.replace(index_path)
    return index_summary(index, index_path=index_path, stale=False)


def load_index(index_path: Path) -> dict[str, Any]:
    if not index_path.is_file():
        raise DesignKnowledgeError(
            f"Design knowledge index is missing: {index_path}",
            code="index-missing",
            exit_code=3,
        )
    try:
        index = json.loads(index_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise DesignKnowledgeError(
            f"Design knowledge index is unreadable: {index_path}",
            code="index-invalid",
            exit_code=3,
        ) from error
    if index.get("schemaVersion") != SCHEMA_VERSION or not isinstance(index.get("records"), list):
        raise DesignKnowledgeError(
            f"Unsupported design knowledge index schema: {index.get('schemaVersion')}",
            code="index-schema-unsupported",
            exit_code=3,
        )
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
        "recordCount": len(index.get("records", [])),
        "embedding": {
            "active": "local" if local else "deterministic-fallback",
            "fallback": index.get("embedding", {}).get("fallback"),
            "local": local,
        },
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
        return set(PUBLIC_KINDS)
    requested = set(kinds)
    unknown = sorted(requested - PUBLIC_KINDS)
    if unknown:
        raise DesignKnowledgeError(
            f"Unknown knowledge kind(s): {', '.join(unknown)}",
            code="filter-kind-invalid",
            exit_code=2,
        )
    return requested


def resolve_route(route_path: Path, source_root: Path) -> dict[str, str | None]:
    route_path = route_path.resolve()
    routes_root = (source_root.resolve() / ".workspaces" / "local" / "routes").resolve()
    try:
        route_path.relative_to(routes_root)
    except ValueError as error:
        raise DesignKnowledgeError(
            f"Workspace route must be under {routes_root}: {route_path}",
            code="route-outside-source",
            exit_code=2,
        ) from error
    data = parse_json(route_path)
    if not isinstance(data, dict):
        raise DesignKnowledgeError("Workspace route must be a JSON object", code="route-invalid", exit_code=2)
    source = data.get("source", {})
    repository = data.get("repository", {})
    context = data.get("context", {})
    if not isinstance(source, dict) or not isinstance(repository, dict) or not isinstance(context, dict):
        raise DesignKnowledgeError("Workspace route has no source/repository/context object", code="route-invalid", exit_code=2)
    declared_source = Path(str(source.get("path", ""))).resolve()
    declared_trust = Path(str(source.get("trust", ""))).resolve()
    if declared_source != source_root.resolve() or declared_trust != (source_root.resolve() / ".claude"):
        raise DesignKnowledgeError(
            "Workspace route belongs to another Source trust tree",
            code="route-source-mismatch",
            exit_code=2,
        )
    disk_path = Path(str(repository.get("diskPath", ""))).resolve()
    if not disk_path.is_dir():
        raise DesignKnowledgeError(
            f"Routed repository does not exist: {disk_path}",
            code="route-stale",
            exit_code=2,
        )
    required_paths = [Path(str(item)).resolve() for item in context.get("manifests", [])]
    if context.get("contract"):
        required_paths.append(Path(str(context["contract"])).resolve())
    missing = [str(path) for path in required_paths if not path.is_file()]
    if missing:
        raise DesignKnowledgeError(
            f"Workspace route is stale; missing routed evidence: {', '.join(missing)}",
            code="route-stale",
            exit_code=2,
        )
    recorded_branch = str(repository.get("branch") or "")
    recorded_head = str(repository.get("head") or "")
    if recorded_branch and recorded_head and (disk_path / ".git").exists():
        branch = subprocess.run(
            ["git", "-C", str(disk_path), "branch", "--show-current"],
            capture_output=True,
            text=True,
        )
        ancestor = subprocess.run(
            ["git", "-C", str(disk_path), "merge-base", "--is-ancestor", recorded_head, "HEAD"],
            capture_output=True,
            text=True,
        )
        if branch.returncode != 0 or branch.stdout.strip() != recorded_branch or ancestor.returncode != 0:
            raise DesignKnowledgeError(
                f"Workspace route branch/head is stale for {disk_path}",
                code="route-stale",
                exit_code=2,
            )
    grammar = context.get("grammar")
    profile = context.get("grammarProfile")
    if (grammar is None) != (profile is None):
        raise DesignKnowledgeError(
            "Workspace route grammar and grammarProfile must both be set or both be null",
            code="route-grammar-pair-invalid",
            exit_code=2,
        )
    return {
        "project": str(data.get("project")) if data.get("project") else None,
        "grammar": str(grammar) if grammar else None,
        "profile": str(profile) if profile else None,
        "route": str(route_path),
    }


def score_records(
    records: Sequence[dict[str, Any]],
    query_text: str,
    query_local_vector: Sequence[float] | None,
) -> list[dict[str, Any]]:
    expanded_query = expand_query_text(query_text)
    query_tokens = tokenize(expanded_query)
    if not query_tokens:
        raise DesignKnowledgeError("Query text has no searchable terms", code="query-empty", exit_code=2)
    lexical = bm25_scores(records, query_tokens)
    maximum = max(lexical, default=0.0) or 1.0
    fallback_query_vector = stable_sparse_vector(expanded_query)
    normalized_query = normalize_text(query_text)
    query_set = set(query_tokens)
    scored: list[dict[str, Any]] = []
    for record, lexical_score in zip(records, lexical):
        local_vector = record.get("localVector")
        if query_local_vector is not None and isinstance(local_vector, list):
            vector_score = cosine(query_local_vector, local_vector)
            vector_provider = "local"
        else:
            vector_score = cosine(fallback_query_vector, record.get("fallbackVector", []))
            vector_provider = "deterministic-fallback"
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
        identity_overlap = len(query_set & set(identity.split())) / max(1, len(query_set))
        combined = 0.70 * (lexical_score / maximum) + 0.18 * vector_score + 0.12 * identity_overlap + exact_bonus
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


def ensure_grammar_profile(records: Sequence[dict[str, Any]], grammar: str | None, profile: str | None) -> None:
    if (grammar is None) != (profile is None):
        raise DesignKnowledgeError(
            "--grammar and --profile are an explicit pair",
            code="grammar-profile-pair-required",
            exit_code=2,
        )
    if grammar is None:
        return
    available_grammars = {str(record.get("metadata", {}).get("grammar")) for record in records if record["kind"] in {KIND_GRAMMAR, KIND_GRAMMAR_OWNER}}
    if grammar not in available_grammars:
        raise DesignKnowledgeError(
            f"Unknown grammar: {grammar}",
            code="grammar-not-found",
            exit_code=4,
        )
    available_profiles = {
        str(record.get("metadata", {}).get("profileId"))
        for record in records
        if record["kind"] == KIND_GRAMMAR_OWNER and record.get("metadata", {}).get("grammar") == grammar
    }
    if profile not in available_profiles:
        raise DesignKnowledgeError(
            f"Profile {profile!r} is not declared by grammar {grammar!r}",
            code="grammar-profile-not-found",
            exit_code=4,
        )


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
        raise DesignKnowledgeError("--top-k must be between 1 and 20", code="top-k-invalid", exit_code=2)
    selected_kinds = validate_kinds(kinds)
    records = index["records"]
    ensure_grammar_profile(records, grammar, profile)

    local_metadata = index.get("embedding", {}).get("local")
    query_local_vector: Sequence[float] | None = None
    if embedding_model is not None:
        if not local_metadata:
            raise DesignKnowledgeError(
                "Index has no local embeddings; rebuild it with --embedding-model",
                code="index-local-embedding-absent",
                exit_code=2,
            )
        signature = local_model_signature(embedding_model)
        if signature != local_metadata.get("modelSignature"):
            raise DesignKnowledgeError(
                "Local embedding model does not match the index model signature",
                code="embedding-model-mismatch",
                exit_code=2,
            )
        query_local_vector = encode_with_local_model(embedding_model, [query_text])[0]

    archetypes: list[dict[str, Any]] = []
    grammar_hits: list[dict[str, Any]] = []
    owner_hits: list[dict[str, Any]] = []
    principle_hits: list[dict[str, Any]] = []

    if KIND_ARCHETYPE in selected_kinds:
        candidates = [record for record in records if record["kind"] == KIND_ARCHETYPE]
        archetypes = eligible_scores(
            score_records(candidates, query_text, query_local_vector),
            local_embeddings=query_local_vector is not None,
        )[:top_k]

    if KIND_GRAMMAR in selected_kinds and grammar is not None and profile is not None:
        grammar_candidates = [
            record
            for record in records
            if record["kind"] == KIND_GRAMMAR and record.get("metadata", {}).get("grammar") == grammar
        ]
        owner_candidates = [
            record
            for record in records
            if record["kind"] == KIND_GRAMMAR_OWNER
            and record.get("metadata", {}).get("grammar") == grammar
            and record.get("metadata", {}).get("profileId") == profile
        ]
        grammar_hits = eligible_scores(
            score_records(grammar_candidates, query_text, query_local_vector),
            local_embeddings=query_local_vector is not None,
        )[:top_k]
        owner_hits = eligible_scores(
            score_records(owner_candidates, query_text, query_local_vector),
            local_embeddings=query_local_vector is not None,
        )[:top_k]

    dependency_owners: dict[str, list[str]] = defaultdict(list)
    for hit in owner_hits:
        for dependency in hit["record"].get("dependencies", []):
            dependency_owners[str(dependency)].append(hit["record"]["id"])

    if KIND_PRINCIPLE in selected_kinds:
        principle_candidates = [record for record in records if record["kind"] == KIND_PRINCIPLE]
        principle_hits = eligible_scores(
            score_records(principle_candidates, query_text, query_local_vector),
            local_embeddings=query_local_vector is not None,
        )[:top_k]
        selected_ids = {hit["record"]["metadata"]["principleId"] for hit in principle_hits}
        for principle_id in sorted(dependency_owners):
            if principle_id in selected_ids:
                continue
            exact = next(
                (record for record in principle_candidates if record.get("metadata", {}).get("principleId") == principle_id),
                None,
            )
            if exact is None:
                raise DesignKnowledgeError(
                    f"Grammar dependency has no Principle module: {principle_id}",
                    code="principle-dependency-missing",
                    exit_code=4,
                )
            principle_hits.append(score_records([exact], query_text, query_local_vector)[0])

    selected_count = len(archetypes) + len(grammar_hits) + len(owner_hits) + len(principle_hits)
    if selected_count == 0:
        if KIND_GRAMMAR in selected_kinds and grammar is None:
            raise DesignKnowledgeError(
                "Grammar selection requires an explicit --grammar/--profile pair or --route; project identity is never a fallback",
                code="grammar-route-required",
                exit_code=4,
            )
        raise DesignKnowledgeError("No eligible design knowledge record", code="no-eligible-result", exit_code=4)

    principle_public = [
        public_hit(hit, required_by=dependency_owners.get(hit["record"]["metadata"]["principleId"], []))
        for hit in principle_hits
    ]
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
            "archetypes": [public_hit(hit) for hit in archetypes],
            "grammar": None
            if grammar is None
            else {
                "id": grammar,
                "profile": profile,
                "owners": [public_hit(hit) for hit in owner_hits],
                "records": [public_hit(hit) for hit in grammar_hits],
            },
            "principles": principle_public,
        },
        "dependencyClosure": {
            "grammarToPrinciples": [
                {"principleId": principle_id, "requiredBy": sorted(owner_ids)}
                for principle_id, owner_ids in sorted(dependency_owners.items())
            ]
        },
        "provenance": {
            "generation": index["generation"],
            "sources": sorted(
                {
                    (hit["record"]["source"]["path"], hit["record"]["source"]["sha256"])
                    for hit in archetypes + grammar_hits + owner_hits + principle_hits
                }
            ),
        },
        "index": {
            "recordCount": len(records),
            "counts": index.get("counts", {}),
            "embedding": "local" if query_local_vector is not None else "deterministic-fallback",
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
                raise DesignKnowledgeError(
                    f"Explicit {name} {explicit!r} conflicts with routed value {resolved!r}",
                    code=f"route-{name}-conflict",
                    exit_code=2,
                )
        project = str(routed["project"]) if routed["project"] else None
        grammar = str(routed["grammar"]) if routed["grammar"] else None
        profile = str(routed["profile"]) if routed["profile"] else None

    if not index_path.is_file():
        if not rebuild_if_stale:
            raise DesignKnowledgeError(
                f"Design knowledge index is missing: {index_path}",
                code="index-missing",
                exit_code=3,
            )
        build_index(source_root, index_path, embedding_model)
    index = load_index(index_path)
    stale, changed, _ = current_staleness(index, source_root)
    if stale:
        if not rebuild_if_stale:
            raise DesignKnowledgeError(
                f"Design knowledge index is stale ({len(changed)} changed source files)",
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
