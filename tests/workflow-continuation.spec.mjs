import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createStore,WORKFLOW_STATE} from '../kernel/store.mjs';
import {buildContinuationBrief,continuationBoundary,exportContinuationBrief} from '../kernel/continuation.mjs';

const state=dir=>({schema:WORKFLOW_STATE,kernel:'starci/workflow-kernel@1',id:'wf-resume',job:'Continue the approved UI delivery',phase:'run',approved:true,
  goalDigest:'a'.repeat(64),scope:['features/chat'],definitionOfDone:['Accepted UI and browser UAT'],worktree:dir,repoRoot:dir,branch:'main',head:'b'.repeat(40),
  engine:{schema:'starci/engine@1',generation:4,journalFile:path.join(dir,'missing-journal.sqlite'),runtimePin:{root:path.join(dir,'.claude'),digest:'c'.repeat(64)}},
  decisions:[{id:'decision-1',choice:2,answer:'Keep the accepted direction'}],needUser:[{kind:'environment',detail:'reconcile the exact stopped dispatch'}],
  ops:[{id:'draw-1',kind:'interface.draw',status:'done',attempt:1,head:'d'.repeat(40),files:['.starciwork/features/chat/ui/index.yaml'],reports:[]},
    {id:'implement-1',kind:'frontend.implement',status:'ready',attempt:3,lease:null,task:null,dispatch:null,terminal:null,reports:[]}],ledger:[],gateResults:[]});

test('continuation export is a stable workflows/<id>.md projection with exact source, pin, decisions and incomplete work',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-continuation-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const store=createStore({repoRoot:root,id:'wf-resume'}),current=state(root);store.saveState(current);
  const result=exportContinuationBrief(store,current,{now:()=>0,git:()=>({status:0,stdout:`${'e'.repeat(40)}\n`})});
  assert.equal(result.file.endsWith(path.join('continuations','workflows','wf-resume.md')),true);
  const markdown=fs.readFileSync(result.file,'utf8');
  for(const expected of ['starci/workflow-continuation@1','wf-resume','implement-1','decision-1','Runtime pin digest',current.engine.runtimePin.digest,'Observed source HEAD','Next safe action'])assert.match(markdown,new RegExp(expected));
  assert.match(markdown,/journal, state, runtime pin, candidate packets, reports and source commits remain authoritative/i);
  assert.equal(exportContinuationBrief(store,current,{now:()=>1,git:()=>({status:1})}).file,result.file,'the same workflow updates one stable brief');
});

test('boundary audit catches a stranded writer and exact dispatch drift without clearing either',()=>{
  const current=state(process.cwd()),op=current.ops[0];Object.assign(op,{status:'done',task:'task-1',dispatch:'ctx-live',terminal:'term-live',
    launch:{task:'task-1',dispatch:'ctx-other'},lease:{workflowId:current.id,opId:op.id,attempt:1,generation:4,jobId:'job-1',leaseToken:'lease-1'}});
  const journalView={file:'fixture.sqlite',error:null,snapshot:null,
    jobs:[{job_id:'job-1',workflow_id:current.id,op_id:op.id,attempt:1,generation:4,kind:'operation',status:'effect_unknown',lease_token:'lease-1'}],
    leases:[{job_id:'job-1',workflow_id:current.id,op_id:op.id,attempt:1,generation:4,resource_key:'writer:test'}]};
  const checked=continuationBoundary(current,{journalView,controller:{alive:false}});
  assert.equal(checked.ok,false);assert.ok(checked.findings.some(item=>item.code==='dispatch-identity-drift'));
  assert.ok(checked.findings.some(item=>item.code==='settled-operation-retains-writer'));
  assert.equal(op.lease.jobId,'job-1');assert.equal(journalView.leases.length,1,'the read-only audit never releases unknown effects');
  const brief=buildContinuationBrief({id:current.id,dir:'.',paths:{state:'state.json',final:'final.json',continuation:'workflow.md'}},current,
    {now:()=>0,git:()=>({status:1})});assert.match(brief.markdown,/reconcile the exact identities/i);
});
