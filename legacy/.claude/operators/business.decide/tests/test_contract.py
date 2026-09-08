import json
from pathlib import Path
import unittest
ROOT = Path(__file__).resolve().parents[1]
class BusinessDecideContractTest(unittest.TestCase):
    def load(self, name): return json.loads((ROOT / name).read_text(encoding="utf-8"))
    def test_done_requires_authority_chain(self):
        clauses = self.load("response.json")["allOf"][0]["then"]["properties"]["outputs"]["allOf"]
        self.assertEqual({c["contains"]["properties"]["id"]["const"] for c in clauses}, {"business-promise-authority", "restatement", "claims", "coverage-matrix", "model"})
    def test_mandatory_dimensions_are_explicit(self):
        review = next(x for x in self.load("validate.json")["review"] if x["id"] == "coverage-closed")["instruction"]
        for dimension in ("actor eligibility", "purchase side effect", "settlement", "idempotency", "entitlement consumer", "denial"):
            self.assertIn(dimension, review)
    def test_publication_failure_blocks_and_does_not_retry_write(self):
        item = next(x for x in self.load("criteria.json")["items"] if x["id"] == "publication-valid")
        self.assertEqual(item["onFail"]["action"], "block")
        self.assertIn("publish no head", item["onFail"]["instruction"])
if __name__ == "__main__": unittest.main()
