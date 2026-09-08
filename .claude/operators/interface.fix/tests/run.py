from pathlib import Path
import json

root = Path(__file__).parents[1]
load = lambda name: json.loads((root / name).read_text(encoding="utf-8"))
op, request, steps, checks, criteria = load("operator.json"), load("request.json"), load("step.json")["steps"], load("validate.json"), load("criteria.json")
assert set(op["modules"]) == {"request", "response", "validate", "step", "criteria"}
assert request["properties"]["expected"] == {"minItems": 1, "maxItems": 1}
assert request["properties"]["context"]["properties"]["visual"]["properties"]["mode"]["const"] == "revise"
assert all(x["onFail"]["fromStep"] in {s["id"] for s in steps} for x in criteria["items"])
for kind in ("machine", "review"):
    assert {x["check"]["ref"] for x in criteria["items"] if x["check"]["kind"] == kind} == {x["id"] for x in checks[kind]}
text = " ".join(json.dumps(load(n)) for n in op["modules"].values())
assert "Do not create or delete files" in text and "change layout direction" in text
assert "Delete rejected captures" in text and criteria["limits"]["feedbackRounds"] == 2
assert all(t not in text for t in ("@worktrees", "@dynamic", "@dir/"))
import importlib.util
spec = importlib.util.spec_from_file_location("contract_harness", root.parents[0] / "backend.generate" / "tests" / "contract_harness.py")
harness = importlib.util.module_from_spec(spec); spec.loader.exec_module(harness); harness.exercise(root)
print("interface.fix source and validator contract tests passed")
