from copy import deepcopy
import hashlib, importlib.util, json, sys, tempfile
from pathlib import Path
import unittest

OP="interface.audit"
INPUT_COUNT=1
SPECS=[["frontend-surface-audit","file","application/json"],["audit-captures","file","application/json"],["audit-screenshots","image","image/png"],["audit-verdicts","file","application/json"]]
OBSERVE="capture-audit-matrix"
ROOT=Path(__file__).resolve().parents[4]
sys.path.insert(0,str(ROOT/"scripts"))
import validate_operator
spec=importlib.util.spec_from_file_location("build_operators",ROOT/"scripts/build-operators.py")
builder=importlib.util.module_from_spec(spec); spec.loader.exec_module(builder)
aliases=json.loads(builder.alias_builder.build(ROOT/".claude/alias"))["aliases"]
schema=json.loads(builder.schema_builder.build(ROOT/".claude/schema","index.schema.json"))
BUNDLE=json.loads(builder.build(ROOT/".claude/operators"/OP,aliases,schema))

def digest(data): return "sha256:"+hashlib.sha256(data).hexdigest()
def records(root):
    request_id="request-"+OP.replace(".","-")
    inputs=[]
    for i in range(INPUT_COUNT):
        data=json.dumps({"input":i,"operator":OP}).encode()
        path=f"inputs/input-{i}.json"; file=root/path; file.parent.mkdir(parents=True,exist_ok=True); file.write_bytes(data)
        inputs.append({"path":path,"sha256":digest(data),"mediaType":"application/json"})
    request={"schemaVersion":1,"kind":"request","id":request_id,"workId":root.name,"workRevision":1,"operation":OP,
      "expected":[{"id":"requested-outcome","description":"The requested outcome is proved."}],
      "inputs":{"prompts":["Execute the synthetic contract case without external effects."],"files":inputs},
      "context":{"notes":[],"files":[]},"requestedBy":{"kind":"user","id":"contract-test"},"createdAt":"2026-09-08T00:00:00Z"}
    outputs=[]
    for output_id,kind,media in SPECS:
        if kind=="commit":
            outputs.append({"id":output_id,"type":"commit","repository":"https://example.invalid/repository.git","sha":"1"*40,"message":"Synthetic proven commit"})
            continue
        data=json.dumps({"output":output_id,"operator":OP}).encode()
        path=f"artifacts/{request_id}/{output_id}.png" if kind=="image" else f"artifacts/{request_id}/{output_id}.json"
        file=root/path; file.parent.mkdir(parents=True,exist_ok=True); file.write_bytes(data)
        record={"id":output_id,"type":kind,"file":{"path":path,"sha256":digest(data),"mediaType":media}}
        record["alt" if kind=="image" else "description"]="Synthetic contract evidence"
        outputs.append(record)
    output_ids=[item["id"] for item in outputs]
    reviews=[item["id"] for item in BUNDLE["criteria"]["items"] if item["check"]["kind"]=="review"]
    response={"schemaVersion":1,"kind":"response","id":"response-"+OP.replace(".","-"),"workId":root.name,"workRevision":1,
      "requestId":request_id,"status":"done","outputs":outputs,"createdAt":"2026-09-08T00:01:00Z","feedbackRound":0,
      "observations":[{"criterionId":"requested-outcome","result":"passed","evidenceIds":[],"note":"Synthetic request acceptance."}],
      "criteriaResults":[{"criterionId":rid,"result":"passed","outputIds":output_ids,"note":"Synthetic evidence exercises the compiled acceptance gate."} for rid in reviews]}
    return request,response

class Contract(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(); self.root=Path(self.tmp.name)/("work-"+OP.replace(".","-")); self.root.mkdir()
        self.request,self.response=records(self.root)
    def tearDown(self): self.tmp.cleanup()
    def check(self,response): return validate_operator.validate(BUNDLE,self.request,response,self.root)
    def test_complete_done_record_is_accepted(self): self.assertTrue(self.check(self.response)["accepted"])
    def test_missing_required_output_is_rejected(self):
        candidate=deepcopy(self.response); candidate["outputs"].pop(0)
        self.assertFalse(self.check(candidate)["accepted"])
    def test_missing_and_failed_review_are_rejected(self):
        missing=deepcopy(self.response); missing["criteriaResults"].pop()
        failed=deepcopy(self.response); failed["criteriaResults"][0]["result"]="failed"; failed["criteriaResults"][0]["note"]="Concrete synthetic defect."
        self.assertFalse(self.check(missing)["accepted"]); self.assertFalse(self.check(failed)["accepted"])
    def test_wrong_request_binding_is_rejected(self):
        candidate=deepcopy(self.response); candidate["requestId"]="request-other"
        result=self.check(candidate); self.assertFalse(result["accepted"]); self.assertTrue(any(x["check"]=="request-binding" for x in result["failures"]))
    def test_feedback_limit_and_uncertain_effect_route(self):
        candidate=deepcopy(self.response); candidate["feedbackRound"]=2; candidate["outputs"].pop(0)
        result=self.check(candidate); self.assertTrue(any(x["action"]=="stop" for x in result["feedback"]))
        event=next(x for x in BUNDLE["criteria"]["items"] if x["check"]=={"kind":"event","ref":"transient-execution-failure"})
        self.assertEqual(event["onFail"]["fromStep"],OBSERVE)
        text=event["onFail"]["instruction"].lower(); self.assertTrue(("observe" in text or "inspect" in text or "fetch" in text or "probe" in text) and ("never" in text or "before" in text))

if __name__=="__main__": unittest.main()
