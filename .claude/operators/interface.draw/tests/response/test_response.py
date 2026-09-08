"""Adversarial response tests for the interface.draw operator.

All image and prompt bytes in this module are synthetic fixtures.  The suite
does not invoke image generation, Nivo services, or either Nivo repository.
"""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import struct
import sys
import tempfile
import unittest
import zlib


ROOT = next(
    parent
    for parent in Path(__file__).resolve().parents
    if (parent / "scripts/build-operators.py").is_file()
)
sys.path.insert(0, str(ROOT / "scripts"))
import validate_operator


BUILD_SPEC = importlib.util.spec_from_file_location(
    "interface_draw_response_build", ROOT / "scripts/build-operators.py"
)
builder = importlib.util.module_from_spec(BUILD_SPEC)
BUILD_SPEC.loader.exec_module(builder)


def synthetic_png():
    """Return a generated 1x1 RGBA PNG fixture with valid chunk CRCs."""
    def chunk(kind, data):
        return (
            struct.pack(">I", len(data))
            + kind
            + data
            + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
        )

    header = struct.pack(">IIBBBBB", 1, 1, 8, 6, 0, 0, 0)
    scanline = zlib.compress(b"\x00\x00\x00\x00\xff")
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", scanline) + chunk(b"IEND", b"")


# Generated/synthetic 1x1 PNG fixture, never an ImageGen result.
SYNTHETIC_VALID_PNG = synthetic_png()
# Deliberately corrupt/simulated output: PNG signature and IHDR prefix only.
SYNTHETIC_TRUNCATED_PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000005a000000384"
)

NIVO_BRIEF = (
    "Draw the Academy growth summary using only revenueVnd, paidOrders, "
    "totalMembers, activeMembers, and totalCompletions. Show resting, "
    "refused, and answered states. Active rate is activeMembers/totalMembers."
)


class InterfaceDrawResponseTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix="interface-draw-response-")
        self.addCleanup(temporary.cleanup)
        self.sandbox = Path(temporary.name)
        self.source = self.sandbox / "operators/interface.draw"
        shutil.copytree(ROOT / ".claude/operators/interface.draw", self.source)
        aliases = json.loads(builder.alias_builder.build(ROOT / ".claude/alias"))["aliases"]
        schema = json.loads(
            builder.schema_builder.build(ROOT / ".claude/schema", "index.schema.json")
        )
        self.bundle = json.loads(builder.build(self.source, aliases, schema))
        self.work = self.sandbox / "work-academy-growth"
        self.work.mkdir()
        self.request = {
            "schemaVersion": 1,
            "kind": "request",
            "id": "request-growth-v1",
            "workId": "work-academy-growth",
            "workRevision": 1,
            "operation": "interface.draw",
            "expected": [
                {
                    "id": "growth-fields",
                    "description": (
                        "Show revenue, paid orders, members, completions, and active rate "
                        "without inventing unsupported metrics."
                    ),
                },
                {
                    "id": "async-states",
                    "description": "Represent resting, refused, and answered states.",
                },
            ],
            "inputs": {"prompts": [NIVO_BRIEF], "files": []},
            "context": {
                "notes": [],
                "files": [],
                "visual": {
                    "mode": "new",
                    "preserve": [],
                    "change": ["Create the Academy growth summary direction."],
                },
            },
            "requestedBy": {"kind": "user", "id": "fixture-user"},
            "createdAt": "2026-09-08T00:00:00Z",
        }
        self.response = self.make_done_response()

    def artifact(self, relative_path, data, media_type):
        path = self.work / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return {
            "path": relative_path,
            "sha256": "sha256:" + hashlib.sha256(data).hexdigest(),
            "mediaType": media_type,
        }

    def make_done_response(self, response_id="response-growth-v1", attempt="attempt-1"):
        prefix = f"artifacts/request-growth-v1/{attempt}"
        direction = self.artifact(
            f"{prefix}/direction.png", SYNTHETIC_VALID_PNG, "image/png"
        )
        prompt = self.artifact(
            f"{prefix}/generation-prompt.txt", NIVO_BRIEF.encode("utf-8"), "text/plain"
        )
        generation_context = {
            "schemaVersion": 1,
            "requestId": "request-growth-v1",
            "attemptId": attempt,
            "mode": "new",
            "baseline": None,
            "prompt": prompt,
            "image": direction,
        }
        context_file = self.artifact(
            f"{prefix}/generation-context.json",
            json.dumps(generation_context, sort_keys=True, separators=(",", ":")).encode("utf-8"),
            "application/json",
        )
        return {
            "schemaVersion": 1,
            "kind": "response",
            "id": response_id,
            "workId": "work-academy-growth",
            "workRevision": 1,
            "requestId": "request-growth-v1",
            "status": "done",
            'feedbackRound': 0,
            'criteriaResults': [{'criterionId': c['id'], 'result': 'passed', 'outputIds': ['direction'], 'note': 'Simulated passing review for contract testing only.'} for c in self.bundle['criteria']['items'] if c['check']['kind'] == 'review'],
            'observations': [{'criterionId': c['id'], 'result': 'passed', 'evidenceIds': [], 'note': 'Simulated expected-criterion observation.'} for c in self.request['expected']],
            "createdAt": "2026-09-08T00:01:00Z",
            "outputs": [
                {
                    "id": "direction",
                    "type": "image",
                    "alt": "Synthetic Academy growth direction fixture.",
                    "file": direction,
                },
                {
                    "id": "generation-prompt",
                    "type": "file",
                    "description": "Synthetic exact submitted prompt fixture.",
                    "file": prompt,
                },
                {
                    "id": "generation-context",
                    "type": "file",
                    "description": "Synthetic prompt/image attempt binding fixture.",
                    "file": context_file,
                },
                {
                    "id": "rationale",
                    "type": "text",
                    "text": "Synthetic fixture; human visual review remains required.",
                    "format": "plain",
                },
            ],
        }

    def replace_generation_context(self, response, generation_context, attempt):
        context_bytes = json.dumps(
            generation_context, sort_keys=True, separators=(",", ":")
        ).encode("utf-8")
        output = next(item for item in response["outputs"] if item["id"] == "generation-context")
        output["file"] = self.artifact(
            f"artifacts/request-growth-v1/{attempt}/generation-context.json",
            context_bytes,
            "application/json",
        )

    def write_evidence(self, evidence_id, data, revision=1):
        retained = self.artifact(
            f"artifacts/request-growth-v1/attempt-1/{evidence_id}.txt",
            data,
            "text/plain",
        )
        record = {
            "schemaVersion": 1,
            "kind": "evidence",
            "id": evidence_id,
            "workId": self.request["workId"],
            "workRevision": revision,
            **retained,
            "description": "Synthetic review-note fixture.",
            "capturedBy": {"kind": "agent", "id": "fixture-reviewer"},
            "capturedAt": "2026-09-08T00:00:30Z",
        }
        evidence_path = self.work / "evidence" / f"{evidence_id}.json"
        evidence_path.parent.mkdir(parents=True, exist_ok=True)
        evidence_path.write_text(json.dumps(record), encoding="utf-8")
        return record

    def validate(self, request=None, response=None):
        return validate_operator.validate(
            self.bundle,
            self.request if request is None else request,
            self.response if response is None else response,
            self.work,
        )

    def failure_checks(self, result):
        return {failure["check"] for failure in result["failures"]}

    def test_valid_synthetic_response_passes_machine_checks_but_requires_review(self):
        result = self.validate()
        self.assertTrue(result["machinePassed"], result)
        self.assertEqual(
            {check["id"] for check in result["reviewRequired"]},
            {
                "brief-fidelity",
                "visual-quality",
                "implementation-feasibility",
                "generation-provenance",
                "visual-continuity",
            },
        )

    def test_cross_request_and_stale_revision_responses_are_rejected(self):
        other_request = copy.deepcopy(self.request)
        other_request["id"] = "request-growth-v2"
        stale_revision = copy.deepcopy(self.request)
        stale_revision["workRevision"] = 2

        wrong_request = self.validate(request=other_request)
        wrong_revision = self.validate(request=stale_revision)

        self.assertFalse(wrong_request["machinePassed"])
        self.assertFalse(wrong_revision["machinePassed"])
        self.assertIn("request-binding", self.failure_checks(wrong_request))
        self.assertIn("request-binding", self.failure_checks(wrong_revision))

    def test_correction_keeps_request_identity_revision_and_uses_new_attempt(self):
        corrected = self.make_done_response("response-growth-v2", "attempt-2")
        corrected["outputs"][3]["text"] = (
            "Corrects response-growth-v1 after visual review; synthetic fixture only."
        )
        result = self.validate(response=corrected)
        self.assertTrue(result["machinePassed"], result)
        self.assertEqual(corrected["requestId"], self.request["id"])
        self.assertEqual(corrected["workRevision"], self.request["workRevision"])
        self.assertNotEqual(corrected["id"], self.response["id"])

    def test_corrupt_png_with_plausible_header_is_rejected(self):
        """A signature and dimensions do not make a decodable PNG artifact."""
        response = copy.deepcopy(self.response)
        response["outputs"][0]["file"] = self.artifact(
            "artifacts/request-growth-v1/attempt-corrupt/direction.png",
            SYNTHETIC_TRUNCATED_PNG,
            "image/png",
        )
        result = self.validate(response=response)
        self.assertFalse(result["machinePassed"], result)
        self.assertIn("direction-png", self.failure_checks(result))

    def test_generation_prompt_declared_text_plain_must_be_utf8_text(self):
        """Exact hashes must not bless binary bytes as the retained text prompt."""
        response = copy.deepcopy(self.response)
        response["outputs"][1]["file"] = self.artifact(
            "artifacts/request-growth-v1/attempt-binary/generation-prompt.txt",
            b"\xff\xfe\x00\x81 synthetic binary prompt fixture",
            "text/plain",
        )
        context = {
            "schemaVersion": 1,
            "requestId": self.request["id"],
            "attemptId": "attempt-binary",
            "mode": "new",
            "baseline": None,
            "prompt": response["outputs"][1]["file"],
            "image": response["outputs"][0]["file"],
        }
        self.replace_generation_context(response, context, "attempt-binary")
        result = self.validate(response=response)
        self.assertFalse(result["machinePassed"], result)
        self.assertIn("prompt-content", self.failure_checks(result))

    def test_direction_and_prompt_must_share_one_attempt_identity(self):
        """Mixing retained bytes from separate attempts breaks generation provenance."""
        response = copy.deepcopy(self.response)
        response["outputs"][1]["file"] = self.artifact(
            "artifacts/request-growth-v1/attempt-2/generation-prompt.txt",
            NIVO_BRIEF.encode("utf-8"),
            "text/plain",
        )
        result = self.validate(response=response)
        self.assertFalse(result["machinePassed"], result)
        self.assertIn("generation-binding", self.failure_checks(result))

    def test_generation_context_must_bind_the_declared_visual_baseline(self):
        request = copy.deepcopy(self.request)
        baseline = self.artifact("context/academy-growth-before.png", SYNTHETIC_VALID_PNG, "image/png")
        decoy = self.artifact("context/unrelated-screen.png", synthetic_png(), "image/png")
        request["context"]["files"] = [baseline, decoy]
        request["context"]["visual"] = {
            "mode": "revise",
            "baselinePath": baseline["path"],
            "preserve": ["five aggregate facts"],
            "change": ["make the answered state denser"],
        }
        response = copy.deepcopy(self.response)
        inherited_prompt = (
            NIVO_BRIEF
            + "\nPreserve checklist: five aggregate facts"
            + "\nChange checklist: make the answered state denser"
        )
        response["outputs"][1]["file"] = self.artifact(
            "artifacts/request-growth-v1/attempt-1/generation-prompt.txt",
            inherited_prompt.encode("utf-8"),
            "text/plain",
        )
        context = {
            "schemaVersion": 1,
            "requestId": request["id"],
            "attemptId": "attempt-1",
            "mode": "revise",
            "baseline": decoy,
            "prompt": response["outputs"][1]["file"],
            "image": response["outputs"][0]["file"],
        }
        self.replace_generation_context(response, context, "attempt-1")
        result = self.validate(request=request, response=response)
        self.assertFalse(result["machinePassed"], result)
        self.assertIn("generation-binding", self.failure_checks(result))

    def test_done_response_cannot_record_a_failed_acceptance_criterion(self):
        """Structured failure evidence contradicts a done response."""
        response = copy.deepcopy(self.response)
        response["observations"] = [
            {
                "criterionId": "growth-fields",
                "result": "failed",
                "evidenceIds": ["direction"],
                "note": "Synthetic direction invents a conversion-rate claim.",
            }
        ]
        result = self.validate(response=response)
        self.assertFalse(result["machinePassed"], result)
        self.assertIn("response-shape", self.failure_checks(result))

    def test_observations_must_reference_declared_criteria_and_evidence_records(self):
        """A passed claim cannot point at nonexistent criterion or evidence identities."""
        response = copy.deepcopy(self.response)
        response["observations"] = [
            {
                "criterionId": "invented-conversion-rate",
                "result": "passed",
                "evidenceIds": ["missing-visual-review"],
                "note": "Synthetic dangling claim fixture.",
            }
        ]
        result = self.validate(response=response)
        self.assertFalse(result["machinePassed"], result)
        self.assertIn("observation-binding", self.failure_checks(result))

    def test_observation_evidence_must_bind_the_current_work_revision(self):
        self.write_evidence(
            "stale-visual-review", b"Synthetic stale review evidence fixture.", revision=2
        )
        response = copy.deepcopy(self.response)
        response["observations"] = [
            {
                "criterionId": "growth-fields",
                "result": "passed",
                "evidenceIds": ["stale-visual-review"],
                "note": "Synthetic stale-revision claim fixture.",
            }
        ]
        result = self.validate(response=response)
        self.assertFalse(result["machinePassed"], result)
        self.assertIn("observation-binding", self.failure_checks(result))

    def test_hashed_evidence_cannot_replace_required_visual_review(self):
        self.write_evidence(
            "metadata-only-review",
            b"Synthetic metadata fixture; it does not establish pixel fidelity.",
        )
        response = copy.deepcopy(self.response)
        response["observations"] = [
            {
                "criterionId": "growth-fields",
                "result": "passed",
                "evidenceIds": ["metadata-only-review"],
                "note": "Synthetic passed claim whose relevance still needs human review.",
            }
        ]
        result = self.validate(response=response)
        self.assertFalse(result["accepted"], result)
        self.assertIn('request-acceptance', self.failure_checks(result))
        self.assertIn(
            "brief-fidelity", {check["id"] for check in result["reviewRequired"]}
        )

    def test_mismatch_can_retain_partial_outputs_and_explicit_reason(self):
        response = copy.deepcopy(self.response)
        response.update(
            status="mismatch",
            reason="The simulated image invents a conversion-rate metric not in the Nivo contract.",
            outputs=[response["outputs"][1], response["outputs"][3]],
            criteriaResults=[],
            observations=[
                {
                    "criterionId": "growth-fields",
                    "result": "failed",
                    "evidenceIds": [],
                    "note": "Prompt review found an unsupported metric; no image is claimed.",
                }
            ],
        )
        result = self.validate(response=response)
        self.assertTrue(result["machinePassed"], result)


if __name__ == "__main__":
    unittest.main()
