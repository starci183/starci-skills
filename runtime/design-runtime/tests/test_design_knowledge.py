from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


RUNTIME_ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(RUNTIME_ROOT))

from design_knowledge import (  # noqa: E402
    DesignKnowledgeError,
    build_index,
    discover_source_files,
    load_index,
    query_index,
    run_query,
    status_index,
)


class RealCorpusTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.temporary = tempfile.TemporaryDirectory()
        cls.index_path = Path(cls.temporary.name) / "index.qdrant"
        cls.summary = build_index(SOURCE_ROOT, cls.index_path)
        cls.index = load_index(cls.index_path)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.temporary.cleanup()

    def test_inventory_includes_full_archetype_shelf(self) -> None:
        self.assertGreaterEqual(self.summary["counts"]["archetype"], 301)
        self.assertEqual(self.summary["counts"]["principle"], 15)
        self.assertGreaterEqual(self.summary["counts"]["operator-knowledge"], 33)
        self.assertGreaterEqual(self.summary["counts"]["grammar-owner"], 70)
        source_paths = [item.relative_path for item in discover_source_files(SOURCE_ROOT)]
        self.assertFalse(any(path.endswith("/en.md") or path.endswith("/vi.md") for path in source_paths))
        self.assertFalse(any("/templates/" in path for path in source_paths))
        self.assertTrue(any(path == ".claude/v6/knowledge/grammar-complex-cases.md" for path in source_paths))
        self.assertEqual(self.summary["storage"]["engine"], "qdrant-edge")
        self.assertTrue((self.index_path / "shard").is_dir())
        manifest = json.loads((self.index_path / "manifest.json").read_text(encoding="utf-8"))
        self.assertNotIn("records", manifest)

    def test_clinical_query_selects_specific_archetype(self) -> None:
        packet = query_index(
            self.index,
            query_text="interpret MIC susceptibility breakpoint edition expert rule selective report",
            kinds=["archetype"],
            top_k=3,
            project=None,
            grammar=None,
            profile=None,
            route=None,
            embedding_model=None,
        )
        selected = [item["data"]["archetypeId"] for item in packet["selected"]["archetypes"]]
        self.assertEqual(selected[0], "antimicrobial-susceptibility-interpretation-workbench")

    def test_irrelevant_vector_collision_is_refused(self) -> None:
        with self.assertRaises(DesignKnowledgeError) as raised:
            query_index(
                self.index,
                query_text="zxqv plmnb qqqxyz uuuvoid",
                kinds=["archetype"],
                top_k=3,
                project=None,
                grammar=None,
                profile=None,
                route=None,
                embedding_model=None,
            )
        self.assertEqual(raised.exception.code, "no-eligible-result")

    def test_vietnamese_queue_query_selects_operational_workbench(self) -> None:
        packet = query_index(
            self.index,
            query_text="hàng đợi bệnh nhân cần xử lý, ưu tiên, phân công và theo dõi trạng thái",
            kinds=["archetype"],
            top_k=3,
            project=None,
            grammar=None,
            profile=None,
            route=None,
            embedding_model=None,
        )
        selected = [item["data"]["archetypeId"] for item in packet["selected"]["archetypes"]]
        self.assertEqual(selected[0], "operational-collection-workbench")

    def test_v6_operator_knowledge_is_retrieved_from_qdrant(self) -> None:
        packet = query_index(
            self.index,
            query_text="nested surface neutral affirmative check treatment complex case",
            kinds=["operator-knowledge"],
            top_k=3,
            project=None,
            grammar=None,
            profile=None,
            route=None,
            embedding_model=None,
        )
        selected = [item["data"]["knowledgeId"] for item in packet["selected"]["operatorKnowledge"]]
        self.assertEqual(selected[0], "fe.grammar-complex-cases")

    def test_deployment_operator_knowledge_is_retrieved_from_qdrant(self) -> None:
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

    def test_read_only_query_does_not_create_missing_index(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            index_path = Path(temporary) / "missing" / "index.qdrant"
            with self.assertRaises(DesignKnowledgeError) as raised:
                run_query(
                    source_root=SOURCE_ROOT,
                    index_path=index_path,
                    query_text="queue operations",
                    kinds=["archetype"],
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

    def test_cli_accepts_index_after_query_subcommand(self) -> None:
        script = SOURCE_ROOT / ".claude" / "scripts" / "design-knowledge-query.py"
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
                    "hàng đợi bệnh nhân cần xử lý",
                    "--index",
                    str(index_path),
                    "--kind",
                    "archetype",
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
                packet["selected"]["archetypes"][0]["data"]["archetypeId"],
                "operational-collection-workbench",
            )

    def test_routed_grammar_closes_owner_dependencies_to_principles(self) -> None:
        packet = query_index(
            self.index,
            query_text="responsive tabs variable labels horizontal overflow",
            kinds=["grammar", "principle"],
            top_k=2,
            project="starci-academy",
            grammar="starci",
            profile="starci-academy",
            route=None,
            embedding_model=None,
        )
        closure = {
            item["principleId"]
            for item in packet["dependencyClosure"]["grammarToPrinciples"]
        }
        self.assertTrue({"overflow", "responsive"}.issubset(closure))
        selected = {item["data"]["principleId"] for item in packet["selected"]["principles"]}
        self.assertTrue(closure.issubset(selected))

    def test_grammar_is_never_inferred_from_project(self) -> None:
        with self.assertRaises(DesignKnowledgeError) as raised:
            query_index(
                self.index,
                query_text="sidebar surface card",
                kinds=["grammar"],
                top_k=2,
                project="starci-academy",
                grammar=None,
                profile=None,
                route=None,
                embedding_model=None,
            )
        self.assertEqual(raised.exception.code, "grammar-route-required")

    def test_status_detects_fresh_index(self) -> None:
        status = status_index(SOURCE_ROOT, self.index_path)
        self.assertFalse(status["stale"])
        self.assertEqual(status["generation"], self.summary["generation"])

    def test_verified_frontend_route_selects_grammar_profile(self) -> None:
        route = SOURCE_ROOT / ".workspaces/local/routes/starci-academy/fe/config.json"
        packet = run_query(
            source_root=SOURCE_ROOT,
            index_path=self.index_path,
            query_text="surface card labelled body",
            kinds=["grammar"],
            top_k=1,
            project=None,
            grammar=None,
            profile=None,
            route_path=route,
            rebuild_if_stale=False,
            embedding_model=None,
        )
        self.assertEqual(packet["filters"]["grammar"], "starci")
        self.assertEqual(packet["filters"]["profile"], "starci-academy")

    def test_run_query_rebuilds_missing_index(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            index_path = Path(temporary) / "nested" / "index.qdrant"
            packet = run_query(
                source_root=SOURCE_ROOT,
                index_path=index_path,
                query_text="batch table operations",
                kinds=["archetype"],
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
                packet["selected"]["archetypes"][0]["data"]["archetypeId"],
                "batch-table-operations",
            )


if __name__ == "__main__":
    unittest.main()
