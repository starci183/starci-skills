from pathlib import Path
import json

root = Path(__file__).parents[1]
load = lambda name: json.loads((root / name).read_text(encoding="utf-8"))
op, steps, checks, criteria = load("operator.json"), load("step.json")["steps"], load("validate.json"), load("criteria.json")
assert set(op["modules"]) == {"request", "response", "validate", "step", "criteria"}
assert criteria["limits"] == {"feedbackRounds": 2}
ids = {s["id"] for s in steps}
assert all(i["onFail"]["fromStep"] in ids for i in criteria["items"])
for kind in ("machine", "review"):
    assert sorted(i["check"]["ref"] for i in criteria["items"] if i["check"]["kind"] == kind) == sorted(i["id"] for i in checks[kind])
assert {i["check"]["ref"] for i in criteria["items"] if i["check"]["kind"] == "event"} == {"capability-unavailable", "essential-input-missing", "transient-execution-failure"}
text = " ".join(json.dumps(load(n)) for n in op["modules"].values())
assert "@workspaces/be" in text and "protected" in text and "before and after" in text
assert "apply a migration to an environment" in text and "one local commit" in text
assert all(token not in text for token in ("@worktrees", "@dynamic", "@dir/"))
import importlib.util
spec = importlib.util.spec_from_file_location("contract_harness", root / "tests" / "contract_harness.py")
harness = importlib.util.module_from_spec(spec); spec.loader.exec_module(harness); harness.exercise(root)
print("backend.generate source and validator contract tests passed")
