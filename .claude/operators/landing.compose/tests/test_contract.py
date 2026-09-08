import json
from pathlib import Path
import unittest
ROOT = Path(__file__).resolve().parents[1]
class LandingComposeContractTest(unittest.TestCase):
    def load(self, name): return json.loads((ROOT / name).read_text(encoding="utf-8"))
    def test_done_requires_composition(self):
        contains = self.load("response.json")["allOf"][0]["then"]["properties"]["outputs"]["contains"]
        self.assertEqual(contains["properties"]["id"]["const"], "landing-composition")
    def test_contract_covers_media_and_reduced_motion(self):
        text = " ".join(x["instruction"] for x in self.load("validate.json")["review"])
        for phrase in ("ImageGen", "code-native", "static reduced-motion truth", "interface.audit"):
            self.assertIn(phrase, text)
    def test_ownership_repair_does_not_publish__grammar(self):
        item = next(x for x in self.load("criteria.json")["items"] if x["id"] == "ownership-complete")
        self.assertEqual(item["onFail"]["fromStep"], "assign-composition")
        self.assertIn("without redefining shared Grammar", item["onFail"]["instruction"])
if __name__ == "__main__": unittest.main()
