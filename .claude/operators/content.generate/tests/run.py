from pathlib import Path
import json

root = Path(__file__).parents[1]
load = lambda name: json.loads((root / name).read_text(encoding="utf-8"))
op, steps, checks, criteria = load("operator.json"), load("step.json")["steps"], load("validate.json"), load("criteria.json")
assert set(op["modules"]) == {"request", "response", "validate", "step", "criteria"}
assert criteria["limits"]["feedbackRounds"] == 2
step_ids = {s["id"] for s in steps}
assert all(x["onFail"]["fromStep"] in step_ids for x in criteria["items"])
for kind in ("machine", "review"):
    assert {x["check"]["ref"] for x in criteria["items"] if x["check"]["kind"] == kind} == {x["id"] for x in checks[kind]}
text = " ".join(json.dumps(load(n)) for n in op["modules"].values())
assert "independent-review" in text and "without the producer rationale" in text
assert "actual selected baseline" in text and "remove rejected image" in text
assert "@tools/imagegen" in text and "@tools/imageview" in text and "@tools/agent" in text
assert all(t not in text for t in ("@worktrees", "@dynamic", "@dir/"))
import importlib.util
spec = importlib.util.spec_from_file_location("contract_harness", root.parents[0] / "backend.generate" / "tests" / "contract_harness.py")
harness = importlib.util.module_from_spec(spec); spec.loader.exec_module(harness); harness.exercise(root)
print("content.generate source and validator contract tests passed")
