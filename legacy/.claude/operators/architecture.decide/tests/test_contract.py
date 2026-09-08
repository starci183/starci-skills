import json
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


class ArchitectureContractTest(unittest.TestCase):
    def load(self, name):
        return json.loads((ROOT / name).read_text(encoding="utf-8"))

    def test_done_requires_decision_evidence_set(self):
        response = self.load("response.json")
        required = {clause["contains"]["properties"]["id"]["const"] for clause in response["allOf"][0]["then"]["properties"]["outputs"]["allOf"]}
        self.assertEqual(required, {"architecture-decision", "current-state", "stack-model", "independent-critique"})

    def test_hard_architecture_law_is_reviewed(self):
        reviews = " ".join(item["instruction"] for item in self.load("validate.json")["review"])
        for phrase in ("exactly one alternative", "shared writers", "idempotency", "backup and restore", "fresh independent critique"):
            self.assertIn(phrase, reviews)

    def test_feedback_never_publishes_a_failed_decision(self):
        criteria = self.load("criteria.json")
        self.assertEqual(criteria["limits"]["feedbackRounds"], 2)
        self.assertIn("publish no decision", criteria["stopWhen"])
        self.assertEqual(next(i for i in criteria["items"] if i["id"] == "ownership-complete")["onFail"]["fromStep"], "select-and-deepen")


if __name__ == "__main__":
    unittest.main()
