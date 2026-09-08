"""Build and record-validation tests for the interface.draw operator contract."""
import struct
import zlib
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = next(parent for parent in Path(__file__).resolve().parents if (parent / "scripts/build-operators.py").is_file())
sys.path.insert(0, str(ROOT / "scripts"))
import validate_operator
from jsonschema import Draft202012Validator

spec = importlib.util.spec_from_file_location("build_operators", ROOT / "scripts/build-operators.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class OperatorTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory(prefix="starci-operator-")
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.source = self.root / "operators/interface.draw"
        shutil.copytree(ROOT / ".claude/operators/interface.draw", self.source)
        self.aliases = json.loads(builder.alias_builder.build(ROOT / ".claude/alias"))["aliases"]
        self.schema = json.loads(builder.schema_builder.build(ROOT / ".claude/schema", "index.schema.json"))
        self.payload = builder.build(self.source, self.aliases, self.schema)
        self.bundle = json.loads(self.payload)
        self.work = self.root / "work-1"
        self.work.mkdir()
        self.request = {"schemaVersion": 1, "kind": "request", "id": "request-1", "workId": "work-1",
                        "workRevision": 1, "operation": "interface.draw", "expected": [{"id": "primary-action", "description": "Show the supplied primary action."}],
                        "inputs": {"prompts": ["Draw the supplied interface brief."], "files": []},
                        "context": {"notes": [], "files": [], "visual": {"mode": "new", "preserve": [], "change": ["Draw the supplied surface."]}}, "requestedBy": {"kind": "user", "id": "user-1"},
                        "createdAt": "2026-09-08T00:00:00Z"}
        def chunk(kind, data):
            return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xffffffff)
        png = (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
               + chunk(b"IDAT", zlib.compress(b"\x00\xff\xff\xff")) + chunk(b"IEND", b""))

        self.response = {"schemaVersion": 1, "kind": "response", "id": "response-1", "workId": "work-1",
                         "workRevision": 1, "requestId": "request-1", "status": "done", "createdAt": "2026-09-08T00:01:00Z",
                         "outputs": [{"id": "direction", "type": "image", "alt": "Test fixture only.",
                                      "file": self.file("artifacts/request-1/attempt-1/direction.png", png, "image/png")},
                                     {"id": "generation-prompt", "type": "file", "description": "Exact submitted prompt.",
                                      "file": self.file("artifacts/request-1/attempt-1/generation-prompt.txt", b"Draw the supplied interface brief.", "text/plain")},
                                     {"id": "rationale", "type": "text", "text": "Synthetic validation fixture; no visual review claimed.", "format": "plain"}]}

        generation = {"schemaVersion": 1, "requestId": "request-1", "attemptId": "attempt-1", "mode": "new", "baseline": None,
                      "prompt": self.response["outputs"][1]["file"], "image": self.response["outputs"][0]["file"]}
        self.response["outputs"].append({"id": "generation-context", "type": "file", "description": "Retained generation bindings.",
                                         "file": self.file("artifacts/request-1/attempt-1/generation-context.json", json.dumps(generation).encode(), "application/json")})

        self.response['feedbackRound'] = 0
        self.response['criteriaResults'] = [{'criterionId': c['id'], 'result': 'passed', 'outputIds': ['direction'], 'note': 'Simulated passing review for contract testing only.'} for c in self.bundle['criteria']['items'] if c['check']['kind'] == 'review']
        self.response['observations'] = [{'criterionId': c['id'], 'result': 'passed', 'evidenceIds': [], 'note': 'Simulated expected-criterion observation.'} for c in self.request['expected']]

    def file(self, name, data, mime):
        path = self.work / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return {"path": name, "sha256": "sha256:" + hashlib.sha256(data).hexdigest(), "mediaType": mime}

    def validate(self, request=None, response=None):
        return validate_operator.validate(self.bundle, request or self.request, response or self.response, self.work)

    def change(self, name, action):
        file = self.source / name
        doc = json.loads(file.read_text(encoding="utf-8"))
        action(doc)
        file.write_text(json.dumps(doc), encoding="utf-8")

    def test_bundle_is_self_contained_and_both_schemas_are_valid(self):
        for kind in ("request", "response"):
            Draft202012Validator.check_schema({"$defs": self.bundle["$defs"], "allOf": [self.bundle[kind]]})
        result = self.validate()
        self.assertTrue(result["machinePassed"], result)
        self.assertEqual(len(result["passed"]), len(self.bundle["validate"]["machine"]))
        self.assertEqual(len(result["reviewRequired"]), len(self.bundle["validate"]["review"]))
        self.assertEqual((ROOT / ".dist/operators/interface.draw.json").read_bytes(), self.payload)
        self.assertNotIn("works:", self.payload.decode())
        self.assertNotIn("worktree", self.payload.decode().lower())

    def test_request_and_response_schema_siblings_are_enforced(self):
        wrong = copy.deepcopy(self.request)
        wrong["operation"] = "interface.generate"
        self.assertFalse(self.validate(request=wrong)["machinePassed"])
        for mutation in (lambda r: r["outputs"].pop(0), lambda r: r.update(unknown=True),
                         lambda r: r["outputs"].append({"id": "commit", "type": "commit", "repository": "repo", "sha": "a" * 40})):
            response = copy.deepcopy(self.response)
            mutation(response)
            self.assertFalse(self.validate(response=response)["machinePassed"])
        partial = copy.deepcopy(self.response)
        partial.update(status="blocked", reason="Image generation unavailable", outputs=[])
        partial.pop("criteriaResults")
        self.assertTrue(self.validate(response=partial)["machinePassed"])

    def test_binding_duplicate_ids_and_artifact_scope(self):
        for mutation in (lambda r: r.update(requestId="another-request"), lambda r: r.update(workRevision=2),
                         lambda r: r["outputs"].append(copy.deepcopy(r["outputs"][0])),
                         lambda r: r["outputs"][0]["file"].update(path="artifacts/other-request/direction.png")):
            response = copy.deepcopy(self.response)
            mutation(response)
            self.assertFalse(self.validate(response=response)["machinePassed"])

    def test_hash_missing_files_and_false_png(self):
        output = self.response["outputs"][0]
        file = self.work / output["file"]["path"]
        file.write_bytes(b"not the original PNG")
        self.assertFalse(self.validate()["machinePassed"])
        output["file"]["sha256"] = "sha256:" + hashlib.sha256(file.read_bytes()).hexdigest()
        result = self.validate()
        self.assertIn("direction-png", [error["check"] for error in result["failures"]])
        file.unlink()
        self.assertFalse(self.validate()["machinePassed"])
        self.request["context"]["files"] = [{"path": "context/missing.txt", "sha256": "sha256:" + "0" * 64, "mediaType": "text/plain"}]
        result = validate_operator.validate(self.bundle, self.request, None, self.work)
        self.assertFalse(result["machinePassed"])

    def test_build_rejects_unknown_alias_call_kind_and_ungranted_write(self):
        original = (self.source / "step.json").read_bytes()
        for alias in ("@tools/nonexistent", "@remote/git"):
            (self.source / "step.json").write_bytes(original)
            self.change("step.json", lambda d: d["steps"][0]["calls"][0].update(alias=alias))
            with self.assertRaises(builder.BuildError):
                builder.build(self.source, self.aliases, self.schema)
        (self.source / "step.json").write_bytes(original)
        self.aliases["@workspaces/artifacts"]["writers"] = []
        with self.assertRaisesRegex(builder.BuildError, "declared writer"):
            builder.build(self.source, self.aliases, self.schema)

    def test_misplaced_schema_constraint_cannot_be_silently_ignored(self):
        self.change('response.json', lambda d: d.update(observations={'minItems': 1}))
        with self.assertRaisesRegex(builder.BuildError, 'unknown operator schema keywords'):
            builder.build(self.source, self.aliases, self.schema)

    def test_criteria_references_and_limits_are_checked(self):
        original = (self.source / 'criteria.json').read_bytes()
        mutations = [lambda d: d['items'][0]['onFail'].update(fromStep='missing-step'),
                     lambda d: d['items'][0]['check'].update(ref='imaginary-check'),
                     lambda d: d['limits'].update(feedbackRounds=0),
                     lambda d: d['limits'].update(feedbackRounds=True),
                     lambda d: d['items'].pop(0)]
        for mutation in mutations:
            (self.source / 'criteria.json').write_bytes(original)
            self.change('criteria.json', mutation)
            with self.assertRaises(builder.BuildError):
                builder.build(self.source, self.aliases, self.schema)

    def test_done_requires_all_reviews_and_request_observations(self):
        mutations = [lambda r: r.pop('criteriaResults'), lambda r: r['criteriaResults'].pop(),
                     lambda r: r['criteriaResults'][0].update(result='not-checked'),
                     lambda r: r['criteriaResults'][0].update(result='failed'),
                     lambda r: r['criteriaResults'][0].update(outputIds=['missing']),
                     lambda r: r.update(observations=[]), lambda r: r.update(feedbackRound=3)]
        for mutation in mutations:
            response = copy.deepcopy(self.response)
            mutation(response)
            result = self.validate(response=response)
            self.assertFalse(result['accepted'], result)
            self.assertTrue(result['feedback'], result)

    def test_duplicate_reviews_cannot_replace_missing_criterion(self):
        self.response['criteriaResults'][1] = copy.deepcopy(self.response['criteriaResults'][0])
        self.assertFalse(self.validate()['accepted'])

    def test_feedback_routes_to_repair_then_stops_without_tool_execution(self):
        response = copy.deepcopy(self.response)
        response.update(status='mismatch', reason='Simulated visible defect.')
        response['criteriaResults'][0].update(result='failed', note='The required primary action is missing.')
        first = self.validate(response=response)
        self.assertFalse(first['accepted'])
        self.assertEqual(first['feedback'][0]['action'], 'retry')
        self.assertEqual(first['feedback'][0]['fromStep'], 'compose-prompt')
        self.assertIn('primary action', first['feedback'][0]['finding'])
        response['feedbackRound'] = 2
        self.assertEqual(self.validate(response=response)['feedback'][0]['action'], 'stop')

    def test_environment_events_ask_or_block_instead_of_guessing(self):
        for event, action in [('essential-input-missing', 'ask'), ('capability-unavailable', 'block')]:
            result = validate_operator.validate(self.bundle, self.request, None, self.work, [event])
            self.assertFalse(result['accepted'])
            self.assertEqual(result['feedback'][0]['action'], action)

    def test_existing_work_record_prevents_matching_stale_request_and_response(self):
        work = {'schemaVersion': 1, 'kind': 'work', 'id': 'work-1', 'revision': 1,
                'goal': 'Fixture drawing', 'status': 'active',
                'scope': {'included': ['Fixture direction'], 'excluded': []},
                'acceptanceCriteria': self.request['expected'],
                'createdAt': '2026-09-08T00:00:00Z', 'updatedAt': '2026-09-08T00:00:00Z'}
        file = self.work / 'work.json'
        file.write_text(json.dumps(work), encoding='utf-8')
        self.assertTrue(self.validate()['accepted'])
        work['revision'] = 2
        file.write_text(json.dumps(work), encoding='utf-8')
        result = self.validate()
        self.assertFalse(result['accepted'])
        self.assertIn('current work record revision', result['failures'][0]['message'])

    def test_build_cli_deterministic_check_and_failure_preserves_output(self):
        destination = self.root / ".dist/operators"
        command = [sys.executable, str(ROOT / "scripts/build-operators.py"), "--source", str(self.source.parent), "--output-dir", str(destination)]
        result = subprocess.run(command, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        output = destination / "interface.draw.json"
        before = output.read_bytes()
        self.assertEqual(subprocess.run(command + ["--check"], capture_output=True).returncode, 0)
        self.change("operator.json", lambda d: d.update(purpose="Changed purpose"))
        self.assertEqual(subprocess.run(command + ["--check"], capture_output=True).returncode, 1)
        self.assertEqual(output.read_bytes(), before)
        self.change("step.json", lambda d: d["steps"][0]["calls"][0].update(alias="@tools/missing"))
        self.assertEqual(subprocess.run(command, capture_output=True).returncode, 1)
        self.assertEqual(output.read_bytes(), before)


if __name__ == "__main__":
    unittest.main()
