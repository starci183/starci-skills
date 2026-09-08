import copy
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest

OPERATOR_ROOT = Path(__file__).resolve().parents[1]
REPOSITORY = OPERATOR_ROOT.parents[2]
sys.path.insert(0, str(REPOSITORY / "scripts"))
from validate_operator import validate


def required_file_outputs(schema):
    found = {}
    def visit(node):
        if isinstance(node, dict):
            props = node.get("properties", {})
            output_id = props.get("id", {}).get("const") if isinstance(props, dict) else None
            output_type = props.get("type", {}).get("const") if isinstance(props, dict) else None
            file_props = props.get("file", {}).get("properties", {}) if isinstance(props, dict) else {}
            media_type = file_props.get("mediaType", {}).get("const") if isinstance(file_props, dict) else None
            if output_id and output_type == "file" and media_type:
                found[output_id] = media_type
            for value in node.values():
                visit(value)
        elif isinstance(node, list):
            for value in node:
                visit(value)
    visit(schema)
    return found


class ExecutableOperatorContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.operator_id = OPERATOR_ROOT.name
        cls.bundle = json.loads((REPOSITORY / ".dist" / "operators" / f"{cls.operator_id}.json").read_text(encoding="utf-8"))

    def records(self, root):
        request_contract = json.loads((OPERATOR_ROOT / "request.json").read_text(encoding="utf-8"))
        input_rules = request_contract.get("properties", {}).get("inputs", {}).get("properties", {})
        input_count = input_rules.get("files", {}).get("minItems", 0)
        prompt_count = max(1, input_rules.get("prompts", {}).get("minItems", 0))
        inputs = []
        for index in range(input_count):
            relative = f"inputs/input-{index}.txt"
            target = root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            payload = f"bound input {index}\n".encode()
            target.write_bytes(payload)
            inputs.append({"path": relative, "sha256": "sha256:" + hashlib.sha256(payload).hexdigest(), "mediaType": "text/plain"})
        request = {
            "schemaVersion": 1, "kind": "request", "id": "req-1", "workId": "work-1",
            "workRevision": 1, "operation": self.operator_id,
            "expected": [{"id": "acceptance", "description": "The requested result is correct."}],
            "inputs": {"prompts": ["Concrete operator objective."] * prompt_count, "files": inputs},
            "context": {"notes": [], "files": []},
            "requestedBy": {"kind": "user", "id": "contract-test"},
            "createdAt": "2026-09-08T00:00:00Z"
        }
        outputs = []
        for output_id, media_type in required_file_outputs(json.loads((OPERATOR_ROOT / "response.json").read_text(encoding="utf-8"))).items():
            suffix = ".json" if media_type == "application/json" else ".md"
            relative = f"artifacts/req-1/{output_id}{suffix}"
            target = root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            payload = (b"{}\n" if suffix == ".json" else f"# {output_id}\n".encode())
            target.write_bytes(payload)
            outputs.append({"id": output_id, "type": "file", "file": {
                "path": relative, "sha256": "sha256:" + hashlib.sha256(payload).hexdigest(), "mediaType": media_type
            }, "description": f"Synthetic {output_id} contract fixture."})
        outputs.append({"id": "diagnostic", "type": "text", "text": "Synthetic fixture marker; not execution evidence.", "format": "plain"})
        output_ids = [item["id"] for item in outputs]
        reviews = [item["id"] for item in self.bundle["criteria"]["items"] if item["check"]["kind"] == "review"]
        response = {
            "schemaVersion": 1, "kind": "response", "id": "res-1", "workId": "work-1",
            "workRevision": 1, "requestId": "req-1", "status": "done",
            "outputs": outputs, "createdAt": "2026-09-08T00:01:00Z", "feedbackRound": 0,
            "observations": [{"criterionId": "acceptance", "result": "passed", "evidenceIds": [], "note": "Synthetic acceptance record for schema testing only."}],
            "criteriaResults": [{"criterionId": review, "result": "passed", "outputIds": output_ids, "note": "Synthetic review result for contract testing only."} for review in reviews]
        }
        return request, response

    def test_valid_synthetic_records_are_accepted_by_compiled_bundle(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "work-1"
            root.mkdir()
            request, response = self.records(root)
            result = validate(self.bundle, request, response, root)
            self.assertTrue(result["machinePassed"], result)
            self.assertTrue(result["accepted"], result)

    def test_missing_primary_output_is_refused(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "work-1"
            root.mkdir()
            request, response = self.records(root)
            primary = next(iter(required_file_outputs(json.loads((OPERATOR_ROOT / "response.json").read_text(encoding="utf-8")))))
            response["outputs"] = [item for item in response["outputs"] if item["id"] != primary]
            actual = [item["id"] for item in response["outputs"]]
            for review in response["criteriaResults"]:
                review["outputIds"] = actual
            result = validate(self.bundle, request, response, root)
            self.assertFalse(result["machinePassed"], result)
            self.assertEqual(result["failures"][0]["check"], "response-shape")

    def test_failed_review_routes_bounded_feedback(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "work-1"
            root.mkdir()
            request, response = self.records(root)
            response.update(status="mismatch", reason="Synthetic review failure.")
            response["criteriaResults"][0].update(result="failed", note="Concrete synthetic defect.")
            result = validate(self.bundle, request, response, root)
            self.assertFalse(result["accepted"], result)
            self.assertEqual(len(result["reviewFailures"]), 1)
            self.assertIn(result["feedback"][0]["fromStep"], {step["id"] for step in self.bundle["step"]["steps"]})

    def test_foreign_revision_binding_is_refused(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "work-1"
            root.mkdir()
            request, response = self.records(root)
            response["workRevision"] = 2
            result = validate(self.bundle, request, response, root)
            self.assertFalse(result["machinePassed"], result)
            self.assertTrue(any(item["check"] == "request-binding" for item in result["failures"]), result)


if __name__ == "__main__":
    unittest.main()
