from pathlib import Path
import json

root = Path(__file__).parents[1]
load = lambda name: json.loads((root / name).read_text(encoding="utf-8"))
op, steps, checks, criteria = load("operator.json"), load("step.json")["steps"], load("validate.json"), load("criteria.json")
assert set(op["modules"]) == {"request", "response", "validate", "step", "criteria"}
assert all(x["onFail"]["fromStep"] in {s["id"] for s in steps} for x in criteria["items"])
for kind in ("machine", "review"):
    assert {x["check"]["ref"] for x in criteria["items"] if x["check"]["kind"] == kind} == {x["id"] for x in checks[kind]}
text = " ".join(json.dumps(load(n)) for n in op["modules"].values())
assert "one canonical owner" in text and "preserving stable identifiers" in text
assert "originating operation" in text and "same surface" in text
assert "@workspaces/knowledge" in text and criteria["limits"]["feedbackRounds"] == 2
assert all(t not in text for t in ("@worktrees", "@dynamic", "@dir/"))
import importlib.util
spec = importlib.util.spec_from_file_location("contract_harness", root.parents[0] / "backend.generate" / "tests" / "contract_harness.py")
harness = importlib.util.module_from_spec(spec); spec.loader.exec_module(harness); harness.exercise(root)
print("knowledge.repair source and validator contract tests passed")
