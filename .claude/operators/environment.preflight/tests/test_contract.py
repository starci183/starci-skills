import json
from pathlib import Path
import unittest
ROOT = Path(__file__).resolve().parents[1]
class EnvironmentPreflightContractTest(unittest.TestCase):
    def load(self, name): return json.loads((ROOT / name).read_text(encoding="utf-8"))
    def test_blocked_response_still_requires_both_reports(self):
        response = self.load("response.json")
        self.assertIn("blocked", response["allOf"][0]["if"]["properties"]["status"]["enum"])
        clauses = response["allOf"][0]["then"]["properties"]["outputs"]["allOf"]
        self.assertEqual({c["contains"]["properties"]["id"]["const"] for c in clauses}, {"environment-readiness", "readiness-report"})
    def test_all_walls_are_collected(self):
        policy = self.load("validate.json")["failurePolicy"]
        self.assertIn("Continue independent checks after a wall", policy)
        self.assertIn("unchanged walls block", policy)
    def test_probe_calls_are_read_only_and_declared(self):
        calls = {c["alias"] for s in self.load("step.json")["steps"] for c in s["calls"]}
        self.assertTrue({"@cli/curl", "@cli/docker", "@cli/git", "@cli/shell"} <= calls)
        self.assertNotIn("@tools/secrets", calls)
if __name__ == "__main__": unittest.main()
