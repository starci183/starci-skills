"""Adversarial recovery tests for the interface.draw operator.

The suite separates executable record checks from recovery promises which are
recorded in criteria.json and followed by the invoking agent.
"""

from __future__ import annotations

import copy
import hashlib
import importlib.util
import inspect
import json
from pathlib import Path
import struct
import tempfile
import unittest
import zlib


def find_repo_root() -> Path:
    """Find the checkout without depending on the caller's working directory."""
    for parent in Path(__file__).resolve().parents:
        if (parent / "scripts" / "build-operators.py").is_file():
            return parent
    raise RuntimeError("could not find repository root containing scripts/build-operators.py")


ROOT = find_repo_root()


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"could not import {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


VALIDATOR = load_module("interface_draw_validate_operator", ROOT / "scripts" / "validate_operator.py")
BUNDLE = json.loads((ROOT / ".dist" / "operators" / "interface.draw.json").read_text(encoding="utf-8"))


PNG_HEADER_ONLY = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" + struct.pack(">II", 1, 1)


def png_chunk(kind: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)


VALID_ONE_PIXEL_PNG = (
    b"\x89PNG\r\n\x1a\n"
    + png_chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 6, 0, 0, 0))
    + png_chunk(b"IDAT", zlib.compress(b"\x00\xff\xff\xff\xff"))
    + png_chunk(b"IEND", b"")
)


def digest(data: bytes) -> str:
    return "sha256:" + hashlib.sha256(data).hexdigest()


def request_record() -> dict:
    """A sanitized brief derived from Nivo's actual AgentOS lifecycle surfaces."""
    return {
        "schemaVersion": 1,
        "kind": "request",
        "id": "draw-agentos-recovery",
        "workId": "nivo-recovery-work",
        "workRevision": 7,
        "operation": "interface.draw",
        "expected": [
            {
                "id": "lifecycle",
                "description": "Show ordered progress, the failed step, live status, and a pending retry action.",
            },
            {
                "id": "safe-launch",
                "description": "Distinguish launch states without displaying a launch URL, token, or credential.",
            },
        ],
        "inputs": {
            "prompts": [
                "Draw the AgentOS recovery surface from the supplied criteria; preserve native actions and live status."
            ],
            "files": [],
        },
        "context": {
            "notes": [],
            "files": [],
            "visual": {
                "mode": "new",
                "preserve": [],
                "change": ["Create the requested AgentOS recovery direction."],
            },
        },
        "requestedBy": {"kind": "user", "id": "designer"},
        "createdAt": "2026-09-08T00:00:00Z",
    }


def write_artifact(work_root: Path, relative_path: str, data: bytes) -> dict:
    path = work_root / relative_path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    if relative_path.endswith(".png"):
        media_type = "image/png"
    elif relative_path.endswith(".json"):
        media_type = "application/json"
    else:
        media_type = "text/plain"
    return {"path": relative_path, "sha256": digest(data), "mediaType": media_type}


def response_record(
    work_root: Path,
    attempt_id: str = "attempt-001",
    response_id: str = "response-001",
    request: dict | None = None,
) -> dict:
    request = request or request_record()
    request_id = request["id"]
    visual = request["context"]["visual"]
    image = write_artifact(
        work_root,
        f"artifacts/{request_id}/{attempt_id}/direction.png",
        VALID_ONE_PIXEL_PNG,
    )
    prompt_text = (
        "Sanitized AgentOS recovery direction prompt.\n"
        + "Mode: " + visual["mode"] + ".\n"
        + "Preserve: " + "; ".join(visual["preserve"]) + ".\n"
        + "Change: " + "; ".join(visual["change"]) + ".\n"
    ).encode("utf-8")
    prompt = write_artifact(
        work_root,
        f"artifacts/{request_id}/{attempt_id}/generation-prompt.txt",
        prompt_text,
    )
    baseline = None
    if visual["mode"] != "new":
        baseline = next(file for file in request["context"]["files"] if file["path"] == visual["baselinePath"])
    generation_context = {
        "schemaVersion": 1,
        "requestId": request_id,
        "attemptId": attempt_id,
        "mode": visual["mode"],
        "baseline": baseline,
        "prompt": prompt,
        "image": image,
    }
    generation_context_file = write_artifact(
        work_root,
        f"artifacts/{request_id}/{attempt_id}/generation-context.json",
        (json.dumps(generation_context, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8"),
    )
    return {
        "schemaVersion": 1,
        "kind": "response",
        "id": response_id,
        "workId": "nivo-recovery-work",
        "workRevision": 7,
        "requestId": request_id,
        "status": "done",
        'feedbackRound': 0,
        'criteriaResults': [{'criterionId': c['id'], 'result': 'passed', 'outputIds': ['direction'], 'note': 'Simulated passing review for contract testing only.'} for c in BUNDLE['criteria']['items'] if c['check']['kind'] == 'review'],
        'observations': [{'criterionId': c['id'], 'result': 'passed', 'evidenceIds': [], 'note': 'Simulated expected-criterion observation.'} for c in request['expected']],
        "outputs": [
            {"id": "direction", "type": "image", "file": image, "alt": "AgentOS recovery direction"},
            {
                "id": "generation-prompt",
                "type": "file",
                "file": prompt,
                "description": "Exact generation prompt",
            },
            {
                "id": "generation-context",
                "type": "file",
                "file": generation_context_file,
                "description": "Exact retained generation bindings",
            },
            {"id": "rationale", "type": "text", "text": "Shows the requested recovery surface.", "format": "plain"},
        ],
        "createdAt": "2026-09-08T00:01:00Z",
    }


class RecoveryFixture(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.work_root = Path(self.temporary.name) / "nivo-recovery-work"
        self.work_root.mkdir()
        self.request = request_record()

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def validate(self, response: dict | None = None, request: dict | None = None) -> dict:
        return VALIDATOR.validate(BUNDLE, request or self.request, response, self.work_root)

    def request_with_baseline(self, mode: str = "revise") -> tuple[dict, dict]:
        baseline = write_artifact(self.work_root, "context/selected-baseline.png", VALID_ONE_PIXEL_PNG)
        request = request_record()
        request["context"] = {
            "notes": [],
            "files": [baseline],
            "visual": {
                "mode": mode,
                "baselinePath": baseline["path"],
                "preserve": ["Keep the product shell, navigation, typography, and unchanged regions."],
                "change": ["Expose the failed lifecycle step and pending retry action."],
            },
        }
        return request, baseline

    def rewrite_generation_context(self, response: dict, mutation) -> None:
        output = next(item for item in response["outputs"] if item["id"] == "generation-context")
        path = self.work_root / output["file"]["path"]
        record = json.loads(path.read_text(encoding="utf-8"))
        mutation(record)
        data = (json.dumps(record, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")
        path.write_bytes(data)
        output["file"]["sha256"] = digest(data)


class MachineEnforcementTests(RecoveryFixture):
    """Checks that the validator really executes today."""

    def test_invalid_request_shape_is_rejected(self) -> None:
        invalid = copy.deepcopy(self.request)
        invalid["inputs"] = {"prompts": [], "files": []}
        result = self.validate(request=invalid)
        self.assertFalse(result["machinePassed"])
        self.assertEqual([failure["check"] for failure in result["failures"]], ["request-shape"])

    def test_wrong_response_binding_is_rejected(self) -> None:
        response = response_record(self.work_root)
        response["requestId"] = "some-other-request"
        result = self.validate(response)
        self.assertFalse(result["machinePassed"])
        self.assertIn("request-binding", [failure["check"] for failure in result["failures"]])

    def test_changed_output_bytes_are_rejected(self) -> None:
        response = response_record(self.work_root)
        direction = self.work_root / response["outputs"][0]["file"]["path"]
        direction.write_bytes(PNG_HEADER_ONLY + b"changed after hashing")
        result = self.validate(response)
        self.assertFalse(result["machinePassed"])
        self.assertIn("output-files", [failure["check"] for failure in result["failures"]])

    def test_retry_retains_exact_request_baseline_and_same_attempt_outputs(self) -> None:
        request, baseline = self.request_with_baseline()
        response = response_record(self.work_root, "attempt-002", "response-002", request)
        result = self.validate(response, request)
        self.assertTrue(result["machinePassed"], result)
        context_output = next(item for item in response["outputs"] if item["id"] == "generation-context")
        retained = json.loads((self.work_root / context_output["file"]["path"]).read_text(encoding="utf-8"))
        self.assertEqual(retained["baseline"], baseline)
        self.assertEqual(retained["attemptId"], "attempt-002")

    def test_wrong_drawing_is_left_to_review_and_not_machine_certified(self) -> None:
        response = response_record(self.work_root)
        result = self.validate(response)
        self.assertTrue(result["machinePassed"])
        self.assertIn("brief-fidelity", [check["id"] for check in result["reviewRequired"]])

    def test_uncertain_completion_stops_at_feedback_limit(self) -> None:
        response = response_record(self.work_root)
        response['feedbackRound'] = 2
        result = VALIDATOR.validate(BUNDLE, self.request, response, self.work_root, ['transient-execution-failure'])
        self.assertFalse(result['accepted'])
        self.assertEqual(result['feedback'][0]['action'], 'stop')
        response['feedbackRound'] = 1
        result = VALIDATOR.validate(BUNDLE, self.request, response, self.work_root, ['transient-execution-failure'])
        self.assertEqual(result['feedback'][0]['action'], 'retry')
        self.assertIn('If completion is uncertain, inspect its status first', result['feedback'][0]['instruction'])

    def test_semantically_empty_brief_is_a_runner_decision(self) -> None:
        request = request_record()
        request["inputs"]["prompts"] = ["Make it nice."]
        request["expected"] = [{"id": "nice", "description": "Looks good."}]
        result = self.validate(request=request)
        self.assertTrue(result["machinePassed"])

    def test_attempt_name_does_not_claim_or_enforce_image_call_count(self) -> None:
        # attempt-003 is deliberately opaque metadata, not proof that three calls occurred.
        # A runner needs a persisted call ledger to enforce the budget soundly.
        response = response_record(self.work_root, "attempt-003", "response-003")
        self.assertTrue(self.validate(response)["machinePassed"])

    def test_history_requirements_are_outside_single_record_validation(self) -> None:
        response = response_record(self.work_root, "attempt-002", "response-002")
        next(output for output in response["outputs"] if output["id"] == "rationale")["text"] = "Updated direction."
        self.assertTrue(self.validate(response)["machinePassed"])


class MissingRecoveryEnforcementRegressions(RecoveryFixture):
    """Regressions for response-boundary false acceptances found during review."""

    def assert_rejected(self, result: dict, promised_guard: str) -> None:
        self.assertFalse(
            result["machinePassed"],
            f"false acceptance: validator did not enforce {promised_guard}; result={result}",
        )

    def test_regression_truncated_png_is_not_a_completed_direction(self) -> None:
        # The file has the 24 bytes inspected by png-signature and no PNG chunks or image data.
        response = response_record(self.work_root)
        image = response["outputs"][0]["file"]
        (self.work_root / image["path"]).write_bytes(PNG_HEADER_ONLY)
        image["sha256"] = digest(PNG_HEADER_ONLY)
        self.assert_rejected(self.validate(response), "a decodable, persisted generation result")

    def test_regression_done_cannot_coexist_with_failed_review(self) -> None:
        response = response_record(self.work_root)
        response["observations"] = [
            {
                "criterionId": "safe-launch",
                "result": "failed",
                "evidenceIds": [],
                "note": "The direction exposes credential-shaped content and omits the blocked state.",
            }
        ]
        self.assert_rejected(self.validate(response), "review failure recovery or mismatch status")

    def test_regression_retry_cannot_replace_selected_baseline_with_rejected_candidate(self) -> None:
        request, _ = self.request_with_baseline()
        rejected = write_artifact(
            self.work_root,
            "artifacts/draw-agentos-recovery/attempt-001/direction.png",
            VALID_ONE_PIXEL_PNG,
        )
        response = response_record(self.work_root, "attempt-002", "response-002", request)
        self.rewrite_generation_context(response, lambda record: record.update(baseline=rejected))
        self.assert_rejected(self.validate(response, request), "exact selected-baseline retention across retry")

    def test_regression_retry_prompt_cannot_drop_preserve_constraints(self) -> None:
        request, _ = self.request_with_baseline("extend")
        response = response_record(self.work_root, "attempt-002", "response-002", request)
        prompt_output = next(item for item in response["outputs"] if item["id"] == "generation-prompt")
        prompt_path = self.work_root / prompt_output["file"]["path"]
        prompt_data = b"Change: Expose the failed lifecycle step and pending retry action.\n"
        prompt_path.write_bytes(prompt_data)
        prompt_output["file"]["sha256"] = digest(prompt_data)
        self.rewrite_generation_context(
            response,
            lambda record: record.update(prompt=prompt_output["file"]),
        )
        self.assert_rejected(self.validate(response, request), "preserve/change constraints in every retry prompt")


if __name__ == "__main__":
    unittest.main()
