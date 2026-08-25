from __future__ import annotations

import importlib.util
import json
import subprocess
import tempfile
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).parents[1] / "reference_context.py"
SPEC = importlib.util.spec_from_file_location("reference_context", MODULE_PATH)
assert SPEC and SPEC.loader
runtime = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(runtime)


POLICY = {
    "schemaVersion": 1,
    "id": "reference-drift-test-v1",
    "strategy": "adaptive-budget",
    "incrementalCostCeiling": 0.9,
    "maxAffectedRecordRatio": 0.9,
    "maxDeleteRatio": 0.9,
}


def run(root: Path, *args: str) -> None:
    subprocess.run(["git", "-C", str(root), *args], check=True, capture_output=True)


class ReferenceContextTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        self.root = Path(self.temporary.name)
        self.references = self.root / ".worktrees" / "references"
        self.checkout = self.references / "demo-fe"
        self.checkout.mkdir(parents=True)
        run(self.checkout, "init", "-q")
        run(self.checkout, "config", "user.email", "test@example.com")
        run(self.checkout, "config", "user.name", "Test")
        (self.checkout / "src").mkdir()
        (self.checkout / "src" / "alpha.ts").write_text("export const alpha = 'reference token'\n", encoding="utf-8")
        run(self.checkout, "add", ".")
        run(self.checkout, "commit", "-qm", "initial")
        self.state = self.root / ".workspaces" / "local" / "state" / "reference-context"

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def test_full_noop_incremental_and_query(self) -> None:
        initial = runtime.index_reference(self.state, self.references, "demo-fe", POLICY, False)
        self.assertEqual(initial["action"], "full")
        self.assertEqual(initial["reason"], "generation-missing-or-corrupt")

        unchanged = runtime.index_reference(self.state, self.references, "demo-fe", POLICY, False)
        self.assertEqual(unchanged["action"], "noop")

        (self.checkout / "src" / "beta.ts").write_text("export const beta = 'second reference token'\n", encoding="utf-8")
        run(self.checkout, "add", ".")
        run(self.checkout, "commit", "-qm", "second")
        changed = runtime.index_reference(self.state, self.references, "demo-fe", POLICY, False)
        self.assertEqual(changed["action"], "incremental")
        result = runtime.search(self.state, "second reference", reference="demo-fe")
        self.assertEqual(result["results"][0]["path"], "src/beta.ts")

    def test_manual_full_wins(self) -> None:
        runtime.index_reference(self.state, self.references, "demo-fe", POLICY, False)
        forced = runtime.index_reference(self.state, self.references, "demo-fe", POLICY, True)
        self.assertEqual((forced["action"], forced["reason"]), ("full", "manual-full"))


if __name__ == "__main__":
    unittest.main()
