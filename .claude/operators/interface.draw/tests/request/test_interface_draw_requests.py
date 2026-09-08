"""Difficult request-side tests for the compiled ``interface.draw`` contract.

The Nivo facts represented by the synthetic fixtures come from the source files
listed in findings.md.  Fixture files are summaries, not copied product source or
evidence that image generation ran.
"""
from __future__ import annotations

import copy
import base64
import hashlib
from pathlib import Path
import sys
import tempfile
import unittest


def repository_root() -> Path:
    """Find this repository without depending on the checkout's absolute path."""
    start = Path(__file__).resolve().parent
    for candidate in (start, *start.parents):
        if (candidate / "scripts" / "build-operators.py").is_file():
            return candidate
    raise RuntimeError("could not locate scripts/build-operators.py")


ROOT = repository_root()
sys.path.insert(0, str(ROOT / "scripts"))

import validate_operator  # noqa: E402  (production module, after local path setup)


STAMP = "2026-09-08T00:00:00Z"
WORK_ID = "work-nivo-interface"


class InterfaceDrawRequestTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.bundle = validate_operator.load(
            ROOT / ".dist" / "operators" / "interface.draw.json"
        )

    def setUp(self) -> None:
        temporary = tempfile.TemporaryDirectory(prefix="interface-draw-request-")
        self.addCleanup(temporary.cleanup)
        self.sandbox = Path(temporary.name)
        self.work = self.sandbox / WORK_ID
        self.work.mkdir()

        task = (
            "Synthetic Nivo-derived brief. Draw a 1440 by 1024 authenticated "
            "workspace-owner overview. Preserve overview, solutions, AI knowledge, "
            "applications, infrastructure, operations, and access as distinct tabs."
        ).encode()
        frontend = (
            "Synthetic source summary: loading and refused states replace the tab "
            "content; refusal offers Retry. Operations controls are disabled. Null "
            "usage is unavailable, and stale runtime data must be labelled stale."
        ).encode()
        backend = (
            "Synthetic source summary: a missing or foreign workspace has one "
            "not-found answer. Owned unprovisioned workspaces remain visible while "
            "their applications are unavailable. App availability is fail-closed."
        ).encode()

        self.task_file = self.stage("inputs/surface-brief.txt", task, "text/plain")
        self.frontend_file = self.stage(
            "context/frontend-surface.txt", frontend, "text/plain"
        )
        self.backend_file = self.stage(
            "context/backend-contract.txt", backend, "text/plain"
        )
        self.baseline_file = self.stage(
            "context/nivo-workspace-baseline.png",
            base64.b64decode(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII="
            ),
            "image/png",
        )
        self.request = self.complete_request()

    def stage(self, relative: str, payload: bytes, media_type: str) -> dict[str, str]:
        destination = self.work / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(payload)
        return {
            "path": relative,
            "sha256": "sha256:" + hashlib.sha256(payload).hexdigest(),
            "mediaType": media_type,
        }

    def complete_request(self) -> dict[str, object]:
        return {
            "schemaVersion": 1,
            "kind": "request",
            "id": "request-nivo-workspace-overview",
            "workId": WORK_ID,
            "workRevision": 1,
            "operation": "interface.draw",
            "expected": [
                {
                    "id": "states",
                    "description": "Show loading, refused-with-retry, and ready states without mixing their controls.",
                },
                {
                    "id": "runtime-truth",
                    "description": "Distinguish null runtime usage from zero and visibly identify stale measurements.",
                },
                {
                    "id": "app-safety",
                    "description": "Keep unavailable apps disabled and retain the source-provided refusal reason.",
                },
                {
                    "id": "operation-safety",
                    "description": "Keep lifecycle operations visibly disabled because the surface exposes no mutation.",
                },
            ],
            "inputs": {
                "prompts": [
                    "Draw the supplied AgentOS workspace overview brief for a desktop viewport."
                ],
                "files": [copy.deepcopy(self.task_file)],
            },
            "context": {
                "notes": [
                    "Audience: the authenticated owner of exactly one workspace.",
                    "Treat runtime values and application availability as live data, not decorative copy.",
                ],
                "files": [
                    copy.deepcopy(self.frontend_file),
                    copy.deepcopy(self.backend_file),
                ],
                "visual": {
                    "mode": "new",
                    "preserve": [],
                    "change": [
                        "Create a new desktop direction from the bound Nivo behavior."
                    ],
                },
            },
            "requestedBy": {"kind": "user", "id": "fixture-user"},
            "createdAt": STAMP,
        }

    def validate(
        self, request: dict[str, object] | None = None, work: Path | None = None
    ) -> dict[str, object]:
        return validate_operator.validate(
            self.bundle, request or self.request, None, work or self.work
        )

    def test_complete_nivo_derived_request_and_bound_references_pass(self) -> None:
        result = self.validate()
        self.assertTrue(result["machinePassed"], result)
        self.assertEqual(
            result["passed"],
            ["request-shape", "request-files", "visual-inheritance"],
        )
        self.assertEqual(
            [item["id"] for item in result["reviewRequired"]],
            [
                "brief-fidelity",
                "visual-quality",
                "implementation-feasibility",
                "generation-provenance",
                "visual-continuity",
            ],
        )

    def test_context_reference_cannot_substitute_for_a_task_input(self) -> None:
        request = copy.deepcopy(self.request)
        request["inputs"] = {"prompts": [], "files": []}
        result = self.validate(request)
        self.assertFalse(result["machinePassed"], result)
        self.assertEqual(result["failures"][0]["check"], "request-shape")

    def test_reference_digest_is_checked_against_actual_bytes(self) -> None:
        self.assertTrue(self.validate()["machinePassed"])
        (self.work / self.frontend_file["path"]).write_text(
            "Simulated corruption after the request was frozen.", encoding="utf-8"
        )
        result = self.validate()
        self.assertFalse(result["machinePassed"], result)
        self.assertEqual(
            [failure["check"] for failure in result["failures"]], ["request-files"]
        )
        self.assertIn("digest differs", result["failures"][0]["message"])

    def test_missing_reference_and_escaping_path_are_rejected(self) -> None:
        missing = copy.deepcopy(self.request)
        missing["context"]["files"][0]["path"] = "context/missing.txt"
        missing_result = self.validate(missing)
        self.assertFalse(missing_result["machinePassed"], missing_result)
        self.assertEqual(missing_result["failures"][0]["check"], "request-files")

        escaping = copy.deepcopy(self.request)
        escaping["context"]["files"][0]["path"] = "../outside.txt"
        escaping_result = self.validate(escaping)
        self.assertFalse(escaping_result["machinePassed"], escaping_result)
        self.assertEqual(escaping_result["failures"][0]["check"], "request-shape")

    def test_new_mode_rejects_an_inherited_baseline(self) -> None:
        request = copy.deepcopy(self.request)
        request["context"]["files"].append(copy.deepcopy(self.baseline_file))
        request["context"]["visual"]["baselinePath"] = self.baseline_file["path"]
        result = self.validate(request)
        self.assertFalse(result["machinePassed"], result)
        self.assertEqual(result["failures"][0]["check"], "request-shape")

    def test_existing_nivo_image_without_visual_inheritance_contract_is_rejected(self) -> None:
        request = copy.deepcopy(self.request)
        request["context"]["files"].append(copy.deepcopy(self.baseline_file))
        del request["context"]["visual"]
        result = self.validate(request)
        self.assertFalse(result["machinePassed"], result)
        self.assertEqual(result["failures"][0]["check"], "request-shape")

    def test_extend_and_revise_bind_an_exact_context_image(self) -> None:
        for mode in ("extend", "revise"):
            with self.subTest(mode=mode):
                request = copy.deepcopy(self.request)
                request["context"]["files"].append(copy.deepcopy(self.baseline_file))
                request["context"]["visual"] = {
                    "mode": mode,
                    "baselinePath": self.baseline_file["path"],
                    "preserve": [
                        "Preserve the existing workspace shell, tabs, and Nivo hierarchy."
                    ],
                    "change": ["Clarify stale and unavailable runtime states."],
                }
                result = self.validate(request)
                self.assertTrue(result["machinePassed"], result)

    def test_extend_and_revise_require_baseline_and_preserve_instructions(self) -> None:
        for mode in ("extend", "revise"):
            for missing in ("baselinePath", "preserve"):
                with self.subTest(mode=mode, missing=missing):
                    request = copy.deepcopy(self.request)
                    request["context"]["files"].append(copy.deepcopy(self.baseline_file))
                    visual = {
                        "mode": mode,
                        "baselinePath": self.baseline_file["path"],
                        "preserve": ["Preserve the Nivo workspace shell."],
                        "change": ["Add the requested state treatment."],
                    }
                    if missing == "baselinePath":
                        del visual["baselinePath"]
                    else:
                        visual["preserve"] = []
                    request["context"]["visual"] = visual
                    result = self.validate(request)
                    self.assertFalse(result["machinePassed"], result)
                    self.assertEqual(result["failures"][0]["check"], "request-shape")

    def test_baseline_path_must_resolve_to_a_declared_context_image(self) -> None:
        for baseline_path in (
            "context/frontend-surface.txt",
            "context/undeclared-nivo-baseline.png",
        ):
            with self.subTest(baseline_path=baseline_path):
                request = copy.deepcopy(self.request)
                request["context"]["visual"] = {
                    "mode": "revise",
                    "baselinePath": baseline_path,
                    "preserve": ["Preserve the current Nivo workspace identity."],
                    "change": ["Improve the unavailable-state hierarchy."],
                }
                result = self.validate(request)
                self.assertFalse(result["machinePassed"], result)

        duplicate = copy.deepcopy(self.request)
        duplicate["context"]["files"].extend(
            [copy.deepcopy(self.baseline_file), copy.deepcopy(self.baseline_file)]
        )
        duplicate["context"]["visual"] = {
            "mode": "extend",
            "baselinePath": self.baseline_file["path"],
            "preserve": ["Preserve the Nivo workspace shell."],
            "change": ["Add explicit stale-data treatment."],
        }
        duplicate_result = self.validate(duplicate)
        self.assertFalse(duplicate_result["machinePassed"], duplicate_result)
        self.assertIn(
            "visual-inheritance",
            [item["check"] for item in duplicate_result["failures"]],
        )

    def test_inherited_baseline_hash_is_verified_before_drawing(self) -> None:
        request = copy.deepcopy(self.request)
        request["context"]["files"].append(copy.deepcopy(self.baseline_file))
        request["context"]["visual"] = {
            "mode": "extend",
            "baselinePath": self.baseline_file["path"],
            "preserve": ["Preserve the existing Nivo workspace navigation."],
            "change": ["Extend the overview with explicit stale-data treatment."],
        }
        (self.work / self.baseline_file["path"]).write_bytes(
            b"Simulated changed baseline bytes."
        )
        result = self.validate(request)
        self.assertFalse(result["machinePassed"], result)
        self.assertIn("request-files", [item["check"] for item in result["failures"]])

    def test_request_file_failure_routes_to_correction_before_generation(self) -> None:
        (self.work / self.backend_file["path"]).unlink()
        result = self.validate()
        self.assertFalse(result["machinePassed"], result)
        failed_ids = {failure["check"] for failure in result["failures"]}

        rule = next(
            item
            for item in self.bundle["criteria"]["items"]
            if item["id"] == "request-files"
        )
        self.assertTrue(failed_ids <= {rule["check"]["ref"]})
        self.assertEqual(rule["onFail"]["action"], "ask")
        self.assertEqual(rule["onFail"]["fromStep"], "read-brief")
        self.assertIn("new id", rule["onFail"]["instruction"])

    def test_missing_essential_context_has_an_explicit_non_generation_recovery(self) -> None:
        rule = next(
            item
            for item in self.bundle["criteria"]["items"]
            if item["id"] == "missing-essential-context"
        )
        self.assertEqual(rule["check"]["ref"], "essential-input-missing")
        self.assertEqual(rule["onFail"]["action"], "ask")
        self.assertEqual(rule["onFail"]["fromStep"], "read-brief")
        self.assertNotEqual(rule["onFail"]["action"], "retry")

    def test_vague_request_is_machine_valid_but_requires_essential_context_recovery(self) -> None:
        request = copy.deepcopy(self.request)
        request["expected"] = [{"id": "quality", "description": "Looks good."}]
        request["inputs"] = {"prompts": ["Draw a dashboard."], "files": []}
        request["context"] = {
            "notes": [],
            "files": [],
            "visual": {
                "mode": "new",
                "preserve": [],
                "change": ["Create a dashboard direction."],
            },
        }

        result = self.validate(request)
        self.assertTrue(result["machinePassed"], result)
        rule = next(
            item
            for item in self.bundle["criteria"]["items"]
            if item["id"] == "missing-essential-context"
        )
        self.assertEqual(rule["onFail"]["action"], "ask")
        self.assertEqual(rule["onFail"]["fromStep"], "read-brief")

    def test_contradictory_prose_is_machine_valid_but_requires_semantic_review(self) -> None:
        request = copy.deepcopy(self.request)
        request["inputs"]["prompts"].append(
            "Enable Update, Backup, Reset, and Rebuild, and display missing or stale runtime measurements as current."
        )
        request["expected"].append(
            {
                "id": "unsafe-controls",
                "description": "All lifecycle controls are enabled in the direction.",
            }
        )

        result = self.validate(request)
        self.assertTrue(result["machinePassed"], result)
        self.assertTrue(
            {"brief-fidelity", "implementation-feasibility"}
            <= {item["id"] for item in result["reviewRequired"]}
        )

    def test_duplicate_expected_ids_are_rejected_even_when_descriptions_differ(self) -> None:
        request = copy.deepcopy(self.request)
        request["expected"].append(
            {
                "id": "states",
                "description": "A second, conflicting observation target reuses the same reference id.",
            }
        )
        result = self.validate(request)
        self.assertFalse(
            result["machinePassed"],
            "criterion IDs are references and must be unique independently of whole-object uniqueness",
        )

    def test_request_only_validation_binds_work_directory_identity(self) -> None:
        wrong_work = self.sandbox / "different-work-id"
        wrong_work.mkdir()
        for record in (
            self.task_file,
            self.frontend_file,
            self.backend_file,
        ):
            source = self.work / record["path"]
            destination = wrong_work / record["path"]
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(source.read_bytes())

        result = self.validate(work=wrong_work)
        self.assertFalse(
            result["machinePassed"],
            "request-side file validation must bind the work root before consuming references",
        )


if __name__ == "__main__":
    unittest.main()
