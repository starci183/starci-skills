import json
from pathlib import Path
import unittest
ROOT = Path(__file__).resolve().parents[1]
class WorkspaceBindContractTest(unittest.TestCase):
    def load(self, name): return json.loads((ROOT / name).read_text(encoding="utf-8"))
    def test_request_requires_declaration_and_hydration_files(self):
        self.assertEqual(self.load("request.json")["properties"]["inputs"]["properties"]["files"]["minItems"], 2)
    def test_binding_has_no_runtime_capability(self):
        calls = [c["alias"] for s in self.load("step.json")["steps"] for c in s["calls"]]
        self.assertNotIn("@tools/browsercontrol", calls)
        self.assertNotIn("@cli/curl", calls)
        self.assertIn("@cli/git", calls)
    def test_dirty_checkout_blocks_without_repair(self):
        item = next(x for x in self.load("criteria.json")["items"] if x["id"] == "git-state-valid")
        self.assertEqual(item["onFail"]["action"], "block")
        self.assertIn("do not alter", item["onFail"]["instruction"])
if __name__ == "__main__": unittest.main()
