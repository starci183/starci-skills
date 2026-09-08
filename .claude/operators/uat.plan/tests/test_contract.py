import json
from pathlib import Path
import unittest
ROOT = Path(__file__).resolve().parents[1]
class UatPlanContractTest(unittest.TestCase):
    def load(self, name): return json.loads((ROOT / name).read_text(encoding="utf-8"))
    def test_done_requires_plan_cases_and_units(self):
        clauses = self.load("response.json")["allOf"][0]["then"]["properties"]["outputs"]["allOf"]
        self.assertEqual({c["contains"]["properties"]["id"]["const"] for c in clauses}, {"uat-plan", "uat-case-sheet", "units"})
    def test_planning_freezes_real_prerequisite_modes(self):
        text = " ".join(x["instruction"] for x in self.load("validate.json")["review"])
        for phrase in ("ordered UI actions", "distinct account aliases", "distinct namespaces", "No secret value"):
            self.assertIn(phrase, text)
    def test_case_failure_routes_without_walking(self):
        item = next(x for x in self.load("criteria.json")["items"] if x["id"] == "cases-executable")
        self.assertEqual(item["onFail"]["fromStep"], "compose-flows")
        self.assertNotIn("browsercontrol", json.dumps(self.load("step.json")))
if __name__ == "__main__": unittest.main()
