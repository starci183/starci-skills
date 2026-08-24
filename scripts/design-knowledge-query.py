# /// script
# requires-python = ">=3.11"
# dependencies = ["qdrant-edge-py==0.8.0"]
# ///

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


SOURCE_ROOT = Path(__file__).resolve().parents[2]
RUNTIME_ROOT = SOURCE_ROOT / ".claude" / "runtime" / "design-runtime"
sys.path.insert(0, str(RUNTIME_ROOT))

from design_knowledge import (  # noqa: E402
    DesignKnowledgeError,
    build_index,
    default_index_path,
    run_query,
    status_index,
)


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(
        description="Build and query the embedded Qdrant Edge design-knowledge index without a network service."
    )
    root.add_argument("--source-root", type=Path, default=SOURCE_ROOT)
    root.add_argument("--index", type=Path)
    commands = root.add_subparsers(dest="command", required=True)

    build = commands.add_parser("build", help="Rebuild the persisted index from runtime authority")
    build.add_argument("--embedding-model", type=Path, help="Optional local sentence-transformers model directory")

    commands.add_parser("status", help="Report index inventory and source staleness")

    query = commands.add_parser("query", help="Return one compact typed design context packet")
    query.add_argument("--source-root", type=Path, default=argparse.SUPPRESS)
    query.add_argument("--index", type=Path, default=argparse.SUPPRESS)
    query.add_argument("--text", required=True)
    query.add_argument("--project")
    query.add_argument("--grammar")
    query.add_argument("--profile")
    query.add_argument("--route", type=Path, help="Verified workspace route JSON; grammar/profile remain explicit")
    query.add_argument("--kind", action="append", choices=["archetype", "grammar", "principle", "operator-knowledge"])
    query.add_argument("--top-k", type=int, default=3)
    query.add_argument("--rebuild-if-stale", action="store_true")
    query.add_argument("--embedding-model", type=Path, help="Same optional local model used to build the index")
    return root


def emit(value: object, stream: object = sys.stdout) -> None:
    # ASCII-safe JSON remains lossless after decoding and survives Windows pipes whose
    # inherited code page cannot represent topology arrows or Vietnamese authority text.
    print(json.dumps(value, ensure_ascii=True, separators=(",", ":")), file=stream)


def main() -> int:
    args = parser().parse_args()
    source_root = args.source_root.resolve()
    index_path = (args.index or default_index_path(source_root)).resolve()
    try:
        if args.command == "build":
            emit(build_index(source_root, index_path, args.embedding_model))
            return 0
        if args.command == "status":
            emit(status_index(source_root, index_path))
            return 0
        packet = run_query(
            source_root=source_root,
            index_path=index_path,
            query_text=args.text,
            kinds=args.kind,
            top_k=args.top_k,
            project=args.project,
            grammar=args.grammar,
            profile=args.profile,
            route_path=args.route,
            rebuild_if_stale=args.rebuild_if_stale,
            embedding_model=args.embedding_model,
        )
        emit(packet)
        return 0
    except DesignKnowledgeError as error:
        emit(
            {
                "schemaVersion": 1,
                "error": {"code": error.code, "message": str(error)},
            },
            sys.stderr,
        )
        return error.exit_code


if __name__ == "__main__":
    raise SystemExit(main())
