import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]

class BackendPlanContractTest(unittest.TestCase):
    def load(self, name): return json.loads((ROOT / name).read_text(encoding="utf-8"))
    def test_done_requires_plan_and_units(self):
        clauses = self.load("response.json")["allOf"][0]["then"]["properties"]["outputs"]["allOf"]
        self.assertEqual({c["contains"]["properties"]["id"]["const"] for c in clauses}, {"backend-plan", "units"})
    def test_partition_law_prevents_double_fill(self):
        text = " ".join(x["instruction"] for x in self.load("validate.json")["review"])
        self.assertIn("exactly once", text)
        self.assertIn("no module invents", text)
        self.assertIn("acyclic", text)
    def test_partition_failure_routes_to_partition_step(self):
        item = next(x for x in self.load("criteria.json")["items"] if x["id"] == "partition-complete")
        self.assertEqual(item["onFail"]["fromStep"], "partition-modules")
        self.assertIn("omitted, duplicated or invented", item["onFail"]["instruction"])

if __name__ == "__main__": unittest.main()
