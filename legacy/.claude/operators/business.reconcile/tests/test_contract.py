import json
from pathlib import Path
import unittest
ROOT = Path(__file__).resolve().parents[1]
class BusinessReconcileContractTest(unittest.TestCase):
    def load(self, name): return json.loads((ROOT / name).read_text(encoding="utf-8"))
    def test_request_requires_delivery_and_authority(self):
        self.assertEqual(self.load("request.json")["properties"]["inputs"]["properties"]["files"]["minItems"], 2)
    def test_mismatch_requires_report_and_claims_but_not_model(self):
        response = self.load("response.json")
        common = response["allOf"][0]["then"]["properties"]["outputs"]["allOf"]
        self.assertEqual({c["contains"]["properties"]["id"]["const"] for c in common}, {"business-reconciliation", "claims"})
        self.assertEqual(response["allOf"][1]["if"]["properties"]["status"]["const"], "done")
    def test_discrepancy_does_not_republish(self):
        item = next(x for x in self.load("criteria.json")["items"] if x["id"] == "matrix-fully-compared")
        self.assertIn("remains mismatch", item["onFail"]["instruction"])
        self.assertIn("no model", self.load("criteria.json")["stopWhen"])
if __name__ == "__main__": unittest.main()
