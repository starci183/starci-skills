"""Synthetic contract cases. These records prove validator behavior, not operator execution."""
from copy import deepcopy
from pathlib import Path
import hashlib
import importlib.util
import json
import sys
import tempfile


def exercise(operator_root: Path):
    repo = operator_root.parents[2]
    sys.path.insert(0, str(repo / "scripts"))
    import validate_operator
    spec = importlib.util.spec_from_file_location("build_operators_for_test", repo / "scripts/build-operators.py")
    builder = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(builder)
    aliases = json.loads(builder.alias_builder.build(repo / ".claude/alias"))["aliases"]
    schema = json.loads(builder.schema_builder.build(repo / ".claude/schema", "index.schema.json"))
    bundle = json.loads(builder.build(operator_root, aliases, schema))
    source_response = json.loads((operator_root / "response.json").read_text(encoding="utf-8"))
    required = source_response["allOf"][0]["then"]["properties"]["outputs"]["allOf"]

    with tempfile.TemporaryDirectory() as temporary:
        work = Path(temporary) / "work1"
        (work / "artifacts" / "req1").mkdir(parents=True)
        context = {"notes": [], "files": []}
        context_contract = json.loads((operator_root / "request.json").read_text(encoding="utf-8"))["properties"].get("context", {})
        if "visual" in context_contract.get("required", []):
            mode = context_contract.get("properties", {}).get("visual", {}).get("properties", {}).get("mode", {}).get("const", "new")
            visual = {"mode": mode, "preserve": [], "change": ["Synthetic contract fixture only."]}
            if mode != "new":
                baseline = work / "context" / "baseline.png"
                baseline.parent.mkdir()
                baseline.write_bytes(b"synthetic baseline; not visual evidence")
                record = {"path": "context/baseline.png", "sha256": "sha256:" + hashlib.sha256(baseline.read_bytes()).hexdigest(), "mediaType": "image/png"}
                context["files"].append(record)
                visual.update(baselinePath=record["path"], preserve=["Preserve the supplied baseline."])
            context["visual"] = visual
        minimum = json.loads((operator_root / "request.json").read_text(encoding="utf-8"))["properties"]["expected"].get("minItems", 1)
        expected = [{"id": f"expected-{n}", "description": "Synthetic acceptance fixture; not real execution."} for n in range(1, minimum + 1)]
        request = {"schemaVersion": 1, "kind": "request", "id": "req1", "workId": "work1", "workRevision": 1,
                   "operation": bundle["id"], "expected": expected, "inputs": {"prompts": ["Synthetic contract fixture; perform no external action."], "files": []},
                   "context": context, "requestedBy": {"kind": "agent", "id": "contract-test"}, "createdAt": "2026-09-08T00:00:00Z"}
        outputs = []
        for clause in required:
            props = clause["contains"]["properties"]
            output_id, output_type = props["id"]["const"], props["type"]["const"]
            if output_type == "commit":
                outputs.append({"id": output_id, "type": "commit", "repository": "synthetic fixture", "sha": "0" * 40})
            else:
                payload = b"synthetic output; not execution evidence"
                artifact = work / "artifacts" / "req1" / (output_id + (".png" if output_type == "image" else ".json"))
                artifact.write_bytes(payload)
                file_record = {"path": artifact.relative_to(work).as_posix(), "sha256": "sha256:" + hashlib.sha256(payload).hexdigest(),
                               "mediaType": "image/png" if output_type == "image" else "application/json"}
                item = {"id": output_id, "type": output_type, "file": file_record}
                item["alt" if output_type == "image" else "description"] = "Synthetic contract fixture; not execution evidence."
                outputs.append(item)
        output_ids = [item["id"] for item in outputs]
        reviews = [item["id"] for item in bundle["criteria"]["items"] if item["check"]["kind"] == "review"]
        response = {"schemaVersion": 1, "kind": "response", "id": "res1", "workId": "work1", "workRevision": 1, "requestId": "req1", "status": "done",
                    "outputs": outputs, "createdAt": "2026-09-08T00:01:00Z", "feedbackRound": 0,
                    "observations": [{"criterionId": item["id"], "result": "passed", "evidenceIds": [], "note": "Synthetic schema case only."} for item in expected],
                    "criteriaResults": [{"criterionId": review, "result": "passed", "outputIds": output_ids, "note": "Synthetic schema case only; not real execution."} for review in reviews]}
        assert validate_operator.validate(bundle, request, response, work)["accepted"]
        missing_output = deepcopy(response)
        missing_output["outputs"] = missing_output["outputs"][1:]
        assert not validate_operator.validate(bundle, request, missing_output, work)["machinePassed"]
        wrong_binding = deepcopy(response)
        wrong_binding["workRevision"] = 2
        assert any(f["check"] == "request-binding" for f in validate_operator.validate(bundle, request, wrong_binding, work)["failures"])
        missing_review = deepcopy(response)
        missing_review["criteriaResults"] = missing_review["criteriaResults"][:-1]
        assert not validate_operator.validate(bundle, request, missing_review, work)["accepted"]
        failed_review = deepcopy(response)
        failed_review["criteriaResults"][0]["result"] = "failed"
        assert not validate_operator.validate(bundle, request, failed_review, work)["accepted"]
        event = validate_operator.validate(bundle, request, None, work, ["capability-unavailable"])
        assert event["feedback"][0]["action"] == "block"
