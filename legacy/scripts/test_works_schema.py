"""Validate the authored .works contracts and their single-file production form."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest

from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / ".claude/schema"
spec = importlib.util.spec_from_file_location("build_schema", ROOT / "scripts/build-schema.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)
STAMP = "2026-09-08T00:00:00Z"
ACTOR = {"kind": "agent", "id": "fixture-agent"}
CRITERIA = [{"id": "criterion-1", "description": "The observed result matches the request."}]


def fixtures():
    # These are test records only; fixture digests and actor names are not execution evidence.
    shared = {"schemaVersion": 1, "workId": "work-1", "workRevision": 1}
    return {
        "work": {"schemaVersion": 1, "kind": "work", "id": "work-1", "revision": 1,
                 "goal": "Verify the requested behavior", "status": "active",
                 "scope": {"included": ["The requested behavior"], "excluded": []},
                 "acceptanceCriteria": copy.deepcopy(CRITERIA), "createdAt": STAMP, "updatedAt": STAMP},
        "request": {**shared, "kind": "request", "id": "request-1", "operation": "verify",
                    "expected": copy.deepcopy(CRITERIA),
                    "inputs": {"prompts": ["Verify the requested behavior."], "files": []},
                    "context": {"notes": [], "files": []},
                    "requestedBy": copy.deepcopy(ACTOR), "createdAt": STAMP},
        "response": {**shared, "kind": "response", "id": "response-1", "requestId": "request-1",
                     "outputs": [{"id": "output-1", "type": "text", "text": "The requested check ran.", "format": "plain"}],
                     "status": "done", "observations": [{"criterionId": "criterion-1", "result": "passed",
                     "evidenceIds": ["evidence-1"], "note": "The assertion passed."}], "createdAt": STAMP},
        "evidence": {**shared, "kind": "evidence", "id": "evidence-1", "path": "artifacts/check.txt",
                     "sha256": "sha256:" + "a" * 64, "mediaType": "text/plain", "description": "Captured check output",
                     "capturedBy": copy.deepcopy(ACTOR), "capturedAt": STAMP},
        "decision": {**shared, "kind": "decision", "id": "decision-1",
                     "subject": {"kind": "request", "id": "request-1", "sha256": "sha256:" + "b" * 64},
                     "outcome": "approved", "decidedBy": {"kind": "user", "id": "fixture-user"},
                     "sourceRef": "fixture:message-1", "rationale": "The requested scope is accepted.", "createdAt": STAMP},
    }


class WorksSchemaTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.payload = builder.build(SOURCE, "index.schema.json")
        cls.bundle = json.loads(cls.payload)
        cls.validator = Draft202012Validator(cls.bundle, format_checker=FormatChecker())
        resources = [(file.as_uri(), Resource.from_contents(json.loads(file.read_text(encoding="utf-8"))))
                     for file in SOURCE.glob("*.schema.json")]
        cls.registry = Registry().with_resources(resources)
        cls.original = Draft202012Validator({"$ref": (SOURCE / "index.schema.json").as_uri()},
                                           registry=cls.registry, format_checker=FormatChecker())

    def assert_valid(self, record):
        errors = list(self.validator.iter_errors(record))
        self.assertEqual(errors, [], [error.message for error in errors])
        self.assertTrue(self.original.is_valid(record))

    def assert_invalid(self, record):
        self.assertFalse(self.validator.is_valid(record), record)
        self.assertFalse(self.original.is_valid(record), record)

    def test_sources_and_bundle_are_valid_draft_2020_12_schemas(self):
        for file in SOURCE.glob("*.schema.json"):
            with self.subTest(file=file.name):
                Draft202012Validator.check_schema(json.loads(file.read_text(encoding="utf-8")))
        Draft202012Validator.check_schema(self.bundle)

    def test_every_record_kind_accepts_its_fixture(self):
        for kind, record in fixtures().items():
            with self.subTest(kind=kind):
                self.assert_valid(record)

    def test_unknown_fields_missing_required_fields_and_versions_are_rejected(self):
        for kind, record in fixtures().items():
            for mutation in [dict(record, extra=True), dict(record, schemaVersion="1"),
                             dict(record, schemaVersion=2), dict(record, kind="unknown"),
                             {key: value for key, value in record.items() if key != "id"}]:
                with self.subTest(kind=kind, mutation=mutation):
                    self.assert_invalid(mutation)

    def test_nested_objects_are_closed(self):
        records = fixtures()
        for kind, key in [("work", "scope"), ("request", "requestedBy"),
                          ("evidence", "capturedBy"), ("decision", "subject")]:
            record = records[kind]
            record[key]["extra"] = True
            self.assert_invalid(record)
        response = records["response"]
        response["observations"][0]["extra"] = True
        self.assert_invalid(response)

    def test_completed_work_requires_nonempty_evidence_and_completion_is_status_bound(self):
        work = fixtures()["work"]
        work["status"] = "completed"
        self.assert_invalid(work)
        work["completion"] = {"evidenceIds": [], "completedAt": STAMP}
        self.assert_invalid(work)
        work["completion"]["evidenceIds"] = ["evidence-1"]
        self.assert_valid(work)
        work["status"] = "active"
        self.assert_invalid(work)

    def test_response_status_constraints(self):
        response = fixtures()["response"]
        response["outputs"] = []
        self.assert_invalid(response)
        for status in ["blocked", "waiting", "mismatch"]:
            response["status"] = status
            response.pop("reason", None)
            self.assert_invalid(response)
            response["reason"] = "A prerequisite is unresolved."
            self.assert_valid(response)
        response = fixtures()["response"]
        # A delivered diagnostic can report a failed check. Output delivery and
        # verification of the subject are deliberately separate facts.
        response["observations"][0]["result"] = "failed"
        self.assert_valid(response)
        del response["observations"]
        self.assert_valid(response)
        del response["outputs"]
        self.assert_invalid(response)

    def test_request_inputs_and_context_have_distinct_closed_shapes(self):
        request = fixtures()["request"]
        self.assert_valid(request)
        file = {"path": "inputs/source.txt", "sha256": "sha256:" + "c" * 64, "mediaType": "text/plain"}
        request["inputs"] = {"prompts": [], "files": [file]}
        request["context"] = {"notes": ["Use the existing terminology."], "files": []}
        self.assert_valid(request)
        for inputs in [{"prompts": [], "files": []}, {"prompts": ["   "], "files": []},
                       {"prompts": ["Read the file"]}, {"prompts": ["Read"], "files": [], "notes": []},
                       {"prompts": [], "files": [{"path": "inputs/source.txt"}]}]:
            self.assert_invalid(dict(request, inputs=inputs))
        self.assert_invalid(dict(request, context={"prompts": ["This is not context"], "files": []}))
        self.assert_invalid(dict(request, context={"notes": [], "files": [], "extra": True}))
        self.assert_invalid({key: value for key, value in request.items() if key != "context"})
        self.assert_invalid(dict(request, inputEvidenceIds=[]))

    def test_response_accepts_mixed_text_commit_image_and_file_outputs(self):
        response = fixtures()["response"]
        del response["observations"]
        response["outputs"].extend([
            {"id": "commit-1", "type": "commit", "repository": "repo:app", "sha": "a" * 40},
            {"id": "image-1", "type": "image", "alt": "Rendered result",
             "file": {"path": "artifacts/result.png", "sha256": "sha256:" + "b" * 64, "mediaType": "image/png"}},
            {"id": "file-1", "type": "file", "description": "Rendered video",
             "file": {"path": "artifacts/result.mp4", "sha256": "sha256:" + "c" * 64, "mediaType": "video/mp4"}},
        ])
        self.assert_valid(response)
        response["outputs"][1]["sha"] = "d" * 64
        self.assert_valid(response)
        for index, key, value in [(0, "text", ""), (0, "format", "html"),
                                  (1, "sha", "abc123"), (1, "sha", "g" * 40),
                                  (2, "alt", ""), (3, "type", "unknown"), (3, "extra", True)]:
            changed = copy.deepcopy(response)
            changed["outputs"][index][key] = value
            self.assert_invalid(changed)
        changed = copy.deepcopy(response)
        changed["outputs"][2]["file"]["mediaType"] = "text/plain"
        self.assert_invalid(changed)
        changed["outputs"][2]["file"]["mediaType"] = "image/png"
        changed["outputs"][2]["file"]["path"] = "../outside.png"
        self.assert_invalid(changed)
        changed = copy.deepcopy(response)
        del changed["outputs"][2]["file"]["sha256"]
        self.assert_invalid(changed)

    def test_dates_digests_paths_revisions_and_blank_values(self):
        records = fixtures()
        for kind, key, value in [("work", "createdAt", "not-a-date"), ("work", "goal", "  "),
                                  ("work", "revision", 0), ("request", "workRevision", "1"),
                                  ("evidence", "sha256", "invalid"), ("decision", "sourceRef", "")]:
            self.assert_invalid(dict(records[kind], **{key: value}))
        for path in ["../outside", "artifacts/../outside", "/absolute", "C:/outside", "artifacts\\file", ".", "artifacts/./file"]:
            self.assert_invalid(dict(records["evidence"], path=path))

    def test_generated_bundle_is_current_and_has_no_external_refs(self):
        self.assertEqual((ROOT / ".dist" / "schema.json").read_bytes(), self.payload)
        for _, node in builder.schema_nodes(self.bundle):
            if isinstance(node, dict) and "$ref" in node:
                self.assertTrue(node["$ref"].startswith("#/"), node["$ref"])


if __name__ == "__main__":
    unittest.main()
