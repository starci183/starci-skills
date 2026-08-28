from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


RUNTIME_ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(RUNTIME_ROOT))

from knowledge_runtime import (  # noqa: E402
    KnowledgeRuntimeError,
    build_index,
    discover_source_files,
    load_index,
    query_index,
    run_query,
    status_index,
)


class OperatorKnowledgeRuntimeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.temporary = tempfile.TemporaryDirectory()
        cls.index_path = Path(cls.temporary.name) / "index.qdrant"
        cls.summary = build_index(SOURCE_ROOT, cls.index_path)
        cls.index = load_index(cls.index_path)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.temporary.cleanup()

    def test_inventory_contains_recursive_operator_knowledge(self) -> None:
        self.assertGreaterEqual(self.summary["counts"]["operator-knowledge"], 33)
        self.assertTrue(set(self.summary["counts"]).issubset({"operator-knowledge", "frontend-coding-context"}))
        source_paths = [item.relative_path for item in discover_source_files(SOURCE_ROOT)]
        knowledge_paths = [path for path in source_paths if path.startswith(".claude/knowledge/")]
        self.assertFalse(any(path.endswith("/en.md") or path.endswith("/vi.md") for path in knowledge_paths))
        self.assertIn(".claude/knowledge/grammar/common/overview.md", source_paths)
        self.assertIn(".claude/knowledge/grammar/core/overview.md", source_paths)
        self.assertIn(".claude/knowledge/grammar/offset-pop/overview.md", source_paths)
        self.assertEqual(self.summary["storage"]["engine"], "qdrant-edge")
        self.assertTrue((self.index_path / "shard").is_dir())
        manifest = json.loads((self.index_path / "manifest.json").read_text(encoding="utf-8"))
        self.assertNotIn("records", manifest)

    def test_project_scoped_frontend_context_is_indexed_and_queryable(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            workspace = Path(temporary)
            knowledge = workspace / ".claude" / "knowledge"
            knowledge.mkdir(parents=True)
            (knowledge / "test.md").write_text(
                "# Test law\n\n| Field | Value |\n| --- | --- |\n| Knowledge ID | `shared.test-law` |\n| Operators | `test` |\n| Search tags | `test` |\n| Dependencies | `none` |\n\n## Record\n\nTest only.\n",
                encoding="utf-8",
            )
            generation = workspace / ".worktrees" / "demo" / "coding-context" / "frontend" / "generations" / "g1" / "components.json"
            generation.parent.mkdir(parents=True)
            generation.write_text(json.dumps({
                "schemaVersion": 1,
                "project": "demo",
                "kind": "frontend-coding-context",
                "generation": {"id": "g1", "inputSha256": "sha256:" + "1" * 64},
                "components": [{
                    "name": "SurfaceCard",
                    "layer": "branches",
                    "description": "Named safe surface with external label and nested list state.",
                    "source": "src/components/branches/SurfaceCard/index.tsx",
                    "sourceSha256": "sha256:" + "2" * 64,
                    "props": {"type": "SurfaceCardProps", "fields": {"label": {"required": True, "type": "string", "description": ""}}},
                    "contracts": ["surface-in-surface"],
                }],
            }), encoding="utf-8")
            current = generation.parents[2] / "current.json"
            current.write_text(json.dumps({
                "schemaVersion": 1,
                "project": "demo",
                "kind": "frontend-coding-context",
                "generationPath": ".worktrees/demo/coding-context/frontend/generations/g1/components.json",
            }), encoding="utf-8")
            index_path = workspace / "index"
            build_index(workspace, index_path)
            packet = query_index(
                load_index(index_path),
                query_text="SurfaceCard external label nested list safe surface",
                kinds=["frontend-coding-context"],
                top_k=3,
                project="demo",
                grammar=None,
                profile=None,
                route=None,
                embedding_model=None,
            )
            hit = packet["selected"]["frontendCodingContext"][0]
            self.assertEqual(hit["data"]["name"], "SurfaceCard")
            self.assertEqual(hit["data"]["project"], "demo")

    def test_named_grammar_case_query_selects_exact_case(self) -> None:
        packet = query_index(
            self.index,
            query_text="grammar core SurfaceCard trustworthy list inside card affirmative rows nested surface",
            kinds=None,
            top_k=3,
            project=None,
            grammar=None,
            profile=None,
            route=None,
            embedding_model=None,
        )
        selected = [item["data"]["knowledgeId"] for item in packet["selected"]["operatorKnowledge"]]
        self.assertEqual(selected[0], "fe.grammar-core-case-trust-list-in-card")

    def test_ui_authority_replaces_design_principles(self) -> None:
        source_paths = [item.relative_path for item in discover_source_files(SOURCE_ROOT)]
        self.assertIn(".claude/knowledge/ui.md", source_paths)
        self.assertNotIn(".claude/knowledge/design-principles.md", source_paths)

        packet = query_index(
            self.index,
            query_text="UI decision SUSPENSE no suspense Grammar Common selected Grammar render authority",
            kinds=["operator-knowledge"],
            top_k=3,
            project=None,
            grammar=None,
            profile=None,
            route=None,
            embedding_model=None,
        )
        selected = [item["data"]["knowledgeId"] for item in packet["selected"]["operatorKnowledge"]]
        self.assertEqual(selected[0], "fe.ui")
        self.assertNotIn("fe.design-principles", selected)

    def test_deployment_query_selects_lifecycle_knowledge(self) -> None:
        packet = query_index(
            self.index,
            query_text="immutable artifact migration domain rollout monitor steady window rollback deployment manifest",
            kinds=["operator-knowledge"],
            top_k=3,
            project=None,
            grammar=None,
            profile=None,
            route=None,
            embedding_model=None,
        )
        selected = [item["data"]["knowledgeId"] for item in packet["selected"]["operatorKnowledge"]]
        self.assertEqual(selected[0], "deployment.lifecycle")

    def test_irrelevant_query_is_refused(self) -> None:
        with self.assertRaises(KnowledgeRuntimeError) as raised:
            query_index(
                self.index,
                query_text="zxqv plmnb qqqxyz uuuvoid",
                kinds=None,
                top_k=3,
                project=None,
                grammar=None,
                profile=None,
                route=None,
                embedding_model=None,
            )
        self.assertEqual(raised.exception.code, "no-eligible-result")

    def test_read_only_query_does_not_create_missing_index(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            index_path = Path(temporary) / "missing" / "index.qdrant"
            with self.assertRaises(KnowledgeRuntimeError) as raised:
                run_query(
                    source_root=SOURCE_ROOT,
                    index_path=index_path,
                    query_text="nested surface",
                    kinds=None,
                    top_k=1,
                    project=None,
                    grammar=None,
                    profile=None,
                    route_path=None,
                    rebuild_if_stale=False,
                    embedding_model=None,
                )
            self.assertEqual(raised.exception.code, "index-missing")
            self.assertFalse(index_path.exists())

    def test_cli_builds_and_queries_explicit_index(self) -> None:
        script = SOURCE_ROOT / "scripts" / "knowledge-query.py"
        with tempfile.TemporaryDirectory() as temporary:
            index_path = Path(temporary) / "index.qdrant"
            built = subprocess.run(
                [sys.executable, str(script), "--index", str(index_path), "build"],
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(built.returncode, 0, built.stderr)
            queried = subprocess.run(
                [
                    sys.executable,
                    str(script),
                    "query",
                    "--text",
                    "grammar core SurfaceCard trustworthy list inside card affirmative rows nested surface",
                    "--index",
                    str(index_path),
                    "--top-k",
                    "1",
                ],
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(queried.returncode, 0, queried.stderr)
            packet = json.loads(queried.stdout)
            self.assertEqual(
                packet["selected"]["operatorKnowledge"][0]["data"]["knowledgeId"],
                "fe.grammar-core-case-trust-list-in-card",
            )

    def test_status_detects_fresh_index(self) -> None:
        status = status_index(SOURCE_ROOT, self.index_path)
        self.assertFalse(status["stale"])
        self.assertEqual(status["generation"], self.summary["generation"])

    def test_run_query_rebuilds_missing_index(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            index_path = Path(temporary) / "nested" / "index.qdrant"
            packet = run_query(
                source_root=SOURCE_ROOT,
                index_path=index_path,
                query_text="immutable deployment rollout rollback",
                kinds=None,
                top_k=1,
                project=None,
                grammar=None,
                profile=None,
                route_path=None,
                rebuild_if_stale=True,
                embedding_model=None,
            )
            self.assertTrue(index_path.is_dir())
            self.assertEqual(
                packet["selected"]["operatorKnowledge"][0]["data"]["knowledgeId"],
                "deployment.lifecycle",
            )


if __name__ == "__main__":
    unittest.main()
