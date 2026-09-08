import json
from pathlib import Path
import unittest
ROOT = Path(__file__).resolve().parents[1]
class DataPlanContractTest(unittest.TestCase):
    def load(self, name): return json.loads((ROOT / name).read_text(encoding="utf-8"))
    def test_done_requires_seed_plan_and_units(self):
        clauses = self.load("response.json")["allOf"][0]["then"]["properties"]["outputs"]["allOf"]
        self.assertEqual({c["contains"]["properties"]["id"]["const"] for c in clauses}, {"seed-plan", "units"})
    def test_seed_specific_safety_is_reviewed(self):
        text = " ".join(x["instruction"] for x in self.load("validate.json")["review"])
        for phrase in ("unique namespace", "cleanup ownership", "representative volume", "pre-create the outcome"):
            self.assertIn(phrase, text)
    def test_collision_repairs_only_affected_unit(self):
        item = next(x for x in self.load("criteria.json")["items"] if x["id"] == "namespaces-disjoint")
        self.assertEqual(item["onFail"]["fromStep"], "compose-seed-units")
        self.assertIn("colliding namespace", item["onFail"]["instruction"])
if __name__ == "__main__": unittest.main()
