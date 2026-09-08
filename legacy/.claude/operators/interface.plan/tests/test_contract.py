import json
from pathlib import Path
import unittest
ROOT = Path(__file__).resolve().parents[1]
class InterfacePlanContractTest(unittest.TestCase):
    def load(self, name): return json.loads((ROOT / name).read_text(encoding="utf-8"))
    def test_done_requires_map_and_units(self):
        clauses = self.load("response.json")["allOf"][0]["then"]["properties"]["outputs"]["allOf"]
        self.assertEqual({c["contains"]["properties"]["id"]["const"] for c in clauses}, {"surface-map", "units"})
    def test_surface_and_shell_invariants_are_distinct(self):
        ids = {x["id"] for x in self.load("validate.json")["review"]}
        self.assertEqual(ids, {"surface-coverage", "shell-once", "units-match-map", "data-contracts"})
    def test_missing_surface_routes_to_mapping(self):
        item = next(x for x in self.load("criteria.json")["items"] if x["id"] == "all-surfaces-mapped")
        self.assertEqual(item["onFail"]["fromStep"], "map-surfaces")
        self.assertIn("omitted surface", item["onFail"]["instruction"])
if __name__ == "__main__": unittest.main()
