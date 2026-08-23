from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path


RUNTIME_ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = Path(__file__).resolve().parents[3]
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
        cls.index_path = Path(cls.temporary.name) / "index.json"
        cls.summary = build_index(SOURCE_ROOT, cls.index_path)
        cls.index = load_index(cls.index_path)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.temporary.cleanup()

    def test_inventory_includes_full_archetype_shelf(self) -> None:
        self.assertGreaterEqual(self.summary["counts"]["archetype"], 301)
        self.assertEqual(self.summary["counts"]["principle"], 15)
        self.assertGreaterEqual(self.summary["counts"]["grammar-owner"], 70)
        source_paths = [item.relative_path for item in discover_source_files(SOURCE_ROOT)]
        self.assertFalse(any(path.endswith("/en.md") or path.endswith("/vi.md") for path in source_paths))
        self.assertFalse(any("/templates/" in path for path in source_paths))

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
            index_path = Path(temporary) / "nested" / "index.json"
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
            self.assertTrue(index_path.is_file())
            self.assertEqual(
                packet["selected"]["archetypes"][0]["data"]["archetypeId"],
                "batch-table-operations",
            )


if __name__ == "__main__":
    unittest.main()
