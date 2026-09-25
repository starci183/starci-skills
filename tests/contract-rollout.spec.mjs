import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from './helpers/fake-orca.mjs';
import {inspectLedger,ledgerFileFor,openLedger} from '../engine/ledger-db.mjs';
import {
  CONTRACT_VERSION_SCHEMA,advisoryCodesFor,classifyChecks,contractFilesOf,contractVersionOf,laterChangesFor,loadContractChanges,runtimeShaOf,
} from '../scripts/kernel/contract-version.mjs';
import {checkShellConformance} from '../scripts/checks/shell-conformance.mjs';

// Owner, 2026-09-24: most blocks came from contract changes rolled onto running workflows mid-flight
// (app shell, layout tree, nav, part review in one night; DRAW_MATRIX_INCOMPLETE refused drawings
// admitted before it existed). A leg is judged against the contract it was ADMITTED under: dispatch
// records that version, a check or finding code a registered change added after it is an advisory
// suspect for that leg, and a change meant to reach in-flight work becomes a follow-up leg, never a
// hold on the running one.
const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const json=text=>{try{return JSON.parse(text);}catch{return null;}};
const lastLine=text=>json(String(text).trim().split('\n').at(-1));
const T0=Date.parse('2026-09-24T01:00:00+07:00');           // before every change below
const T_SHELL=Date.parse('2026-09-24T01:03:37+07:00'), T_TREE=Date.parse('2026-09-24T02:11:02+07:00'), T_PARTS=Date.parse('2026-09-24T05:25:49+07:00');

const REGISTRY=['schema: starci/contract-changes@1','changes:',
  '  - id: app-shell-record',"    effectiveAt: '2026-09-24T01:03:37+07:00'",'    adds:','      checks:','        - shell-conformance','      codes:','        - SHELL_RECORD_MISSING','    reach: new-legs',
  '  - id: layout-tree',"    effectiveAt: '2026-09-24T02:11:02+07:00'",'    adds:','      codes:','        - LAYOUT_UNSETTLED','    reach: new-legs',
  '  - id: part-review-matrix',"    effectiveAt: '2026-09-24T05:25:49+07:00'",'    ops:','        - interface.draw','    adds:','      codes:','        - DRAW_MATRIX_INCOMPLETE','    reach: new-legs',
  '  - id: token-leak-fix',"    effectiveAt: '2026-09-24T06:00:00+07:00'",'    safetyCritical: true','    adds:','      checks:','        - secret-scan','    reach: new-legs',
  '  - id: nav-follow-up',"    effectiveAt: '2026-09-24T07:00:00+07:00'",'    summary: nav routes land on a page','    reach: follow-up','    followUp:','      op: interface.implement','      ops:','        - interface.draw','      detail: re-derive the nav of drawings admitted before nav routes',''].join('\n');

const registryFile=t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-contract-changes-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const file=path.join(dir,'contract-changes.yaml');fs.writeFileSync(file,REGISTRY);return file;
};

test('the registry normalizes changes, refuses malformed ones, and the live registry parses clean',t=>{
  const registry=loadContractChanges(ROOT,{file:registryFile(t)});
  assert.deepEqual(registry.problems,[]);
  assert.deepEqual(registry.changes.map(c=>c.id),['app-shell-record','layout-tree','part-review-matrix','token-leak-fix','nav-follow-up']);
  assert.deepEqual(registry.changes.at(-1).followUp,{op:'interface.implement',ops:['interface.draw'],detail:'re-derive the nav of drawings admitted before nav routes'});
  const live=loadContractChanges(ROOT,{file:path.join(ROOT,'modules','kernel','contract-changes.yaml')});
  assert.deepEqual(live.problems,[],'modules/kernel/contract-changes.yaml is well-formed');
  assert.ok(live.changes.some(c=>c.id==='part-review-matrix'&&c.adds.codes.includes('DRAW_MATRIX_INCOMPLETE')));

  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-bad-changes-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const bad=path.join(dir,'x.yaml');
  fs.writeFileSync(bad,['schema: starci/contract-changes@1','changes:','  - id: Bad Id',"    effectiveAt: '2026-01-01T00:00:00Z'",'  - id: no-date','  - id: odd-reach',"    effectiveAt: '2026-01-01T00:00:00Z'",'    reach: sometimes','  - id: bare-follow-up',"    effectiveAt: '2026-01-01T00:00:00Z'",'    reach: follow-up','  - id: ghost-op',"    effectiveAt: '2026-01-01T00:00:00Z'",'    ops: [review.verify, architecture.revise]','  - id: ghost-follow-up',"    effectiveAt: '2026-01-01T00:00:00Z'",'    reach: follow-up','    followUp:','      op: interface.implement','      ops: [interface.draw, no.such.op]',''].join('\n'));
  const parsed=loadContractChanges(ROOT,{file:bad});
  assert.deepEqual(parsed.changes,[]);
  assert.equal(parsed.problems.length,6,parsed.problems.join('\n'));
  assert.ok(parsed.problems.some((p) => /ghost-op: .*architecture\.revise.*not an op/.test(p)),'an ops name no manifest declares is a problem');
  assert.ok(parsed.problems.some((p) => /ghost-follow-up: .*no\.such\.op.*not an op/.test(p)),'a followUp op name no manifest declares is a problem');
  assert.deepEqual(loadContractChanges(ROOT,{file:path.join(dir,'absent.yaml')}),{schema:'starci/contract-changes@1',changes:[],problems:[]});
});

test('a red check a later change added is advisory for an older leg; safety-critical and partial matches are not',t=>{
  const registry=loadContractChanges(ROOT,{file:registryFile(t)});
  const laterFor=(admittedAt,op='interface.draw')=>laterChangesFor(registry,{admittedAt,op}).map(c=>c.id);
  assert.deepEqual(laterFor(T0),['app-shell-record','layout-tree','part-review-matrix','nav-follow-up'],'the safety-critical change applies to every leg');
  assert.deepEqual(laterFor(T0,'interface.implement'),['app-shell-record','layout-tree','nav-follow-up'],'a change scoped to ops reaches only those ops');
  assert.deepEqual(laterFor(T_PARTS),['nav-follow-up']);
  assert.deepEqual(laterFor(null),[],'a leg never admitted is admitted under the current contract');

  const checks=[
    {name:'unit',exitCode:0},
    {name:'shell-conformance',exitCode:1,advisory:{forged:true}},
    {name:'draw-matrix',exitCode:1,codes:['DRAW_MATRIX_INCOMPLETE']},
    {name:'mixed',exitCode:1,codes:['DRAW_MATRIX_INCOMPLETE','COMPOSITE_MISSING']},
    {name:'secret-scan',exitCode:1},
  ];
  const between=classifyChecks(checks,laterChangesFor(registry,{admittedAt:T_TREE+1,op:'interface.draw'}));
  assert.equal(between[0].advisory,undefined);
  assert.equal(between[1].advisory,undefined,'shell-conformance predates this leg, and a caller-supplied advisory is dropped');
  assert.deepEqual(between[2].advisory.changes,['part-review-matrix']);
  assert.equal(between[3].advisory,undefined,'one code the leg was admitted under keeps the check red');
  assert.equal(between[4].advisory,undefined,'a safety-critical check is never advisory');
  const older=classifyChecks(checks,laterChangesFor(registry,{admittedAt:T0,op:'interface.draw'}));
  assert.deepEqual(older[1].advisory.changes,['app-shell-record']);
  assert.deepEqual(advisoryCodesFor(registry,{admittedAt:T_SHELL,op:'interface.draw'}),{codes:['LAYOUT_UNSETTLED','DRAW_MATRIX_INCOMPLETE'],checks:[],changes:['layout-tree','part-review-matrix','nav-follow-up']});
});

test('the contract version digests the brief, the shared documents and what the brief cites, and reads HEAD without git',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-contract-root-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const put=(rel,text)=>{fs.mkdirSync(path.dirname(path.join(root,rel)),{recursive:true});fs.writeFileSync(path.join(root,rel),text);};
  put('modules/ops/ops/interface.draw.yaml','reads:\n  - path: modules/schemas/work-layout-tree.schema.yaml\ncheck: node scripts/checks/shell-conformance.mjs\n');
  put('modules/ops/_common.yaml','common\n');
  put('modules/schemas/work-layout-tree.schema.yaml','schema\n');
  const sha='0123456789abcdef0123456789abcdef01234567';
  put('.git/HEAD','ref: refs/heads/main\n');put('.git/packed-refs',`# pack-refs\n${sha} refs/heads/main\n`);
  assert.equal(runtimeShaOf(root),sha,'a packed ref resolves');
  assert.deepEqual(contractFilesOf(root,'interface.draw'),['modules/ops/ops/interface.draw.yaml','modules/ops/_common.yaml','modules/kernel/verdict-contract.yaml','modules/schemas/work-layout-tree.schema.yaml','scripts/checks/shell-conformance.mjs']);
  const v1=contractVersionOf(root,'interface.draw',{now:5});
  assert.deepEqual([v1.schema,v1.runtimeSha,v1.admittedAt],[CONTRACT_VERSION_SCHEMA,sha,5]);
  assert.equal(v1.files.find(f=>f.path==='scripts/checks/shell-conformance.mjs').digest,'absent');
  put('modules/schemas/work-layout-tree.schema.yaml','schema v2\n');
  assert.notEqual(contractVersionOf(root,'interface.draw').digest,v1.digest,'a change to a cited schema is a new contract version');
  assert.equal(runtimeShaOf(ROOT)?.length,40,'the runtime root itself reads its HEAD');
});

test('shell-conformance demotes the codes added after a leg\'s admission to suspects',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-shell-admitted-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  fs.mkdirSync(path.join(dir,'.starciwork'),{recursive:true});
  const work=path.join(dir,'.starciwork');
  const strict=checkShellConformance(work);
  assert.equal(strict.ok,false);
  assert.ok(strict.refused.some(line=>line.includes('SHELL_RECORD_MISSING')));
  const admitted=checkShellConformance(work,{advisoryCodes:['SHELL_RECORD_MISSING']});
  assert.equal(admitted.ok,true);
  assert.ok(admitted.suspect.some(line=>line.includes('SHELL_RECORD_MISSING')&&line.includes('added after this leg was admitted')));
  const cli=spawnSync(process.execPath,[path.join(ROOT,'scripts','checks','shell-conformance.mjs'),work,'--admitted-at','2026-09-24T00:00:00+07:00'],{cwd:ROOT,encoding:'utf8',windowsHide:true});
  assert.equal(cli.status,0,cli.stdout);
  assert.equal(spawnSync(process.execPath,[path.join(ROOT,'scripts','checks','shell-conformance.mjs'),work,'--admitted-at','soon'],{cwd:ROOT,encoding:'utf8',windowsHide:true}).status,2);
});

const fixture=t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-contract-rollout-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const repo=path.join(root,'repo');fs.mkdirSync(repo,{recursive:true});
  const stub=path.join(root,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const base={...process.env,STARCI_CONTRACT_CHANGES:registryFile(t),STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stub]),
    STARCI_FAKE_ORCA_LOG:path.join(root,'calls.jsonl'),STARCI_FAKE_ORCA_STATE:path.join(root,'state.json')};
  for(const key of ['ORCA_TERMINAL_HANDLE','STARCI_ROLE','STARCI_OP_JOB'])delete base[key];
  const api=args=>spawnSync(process.execPath,[API,...args,'--repo',repo,'--json'],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env:base});
  const ok=args=>{const r=api(args);assert.equal(r.status,0,`${args.join(' ')}: ${r.stderr||r.stdout}`);return json(r.stdout);};
  const wf='wf-contract-rollout';
  const seed=fn=>{const l=openLedger({file:ledgerFileFor(repo)});try{return fn(l);}finally{l.close();}};
  const read=fn=>{const l=inspectLedger({file:ledgerFileFor(repo)});try{return fn(l.db);}finally{l.close();}};
  seed(l=>{
    l.ensureWorkflow({workflowId:wf,title:wf,ledgerMode:'durable',sourceRoots:[repo]});
    l.db.prepare("UPDATE workflows SET phase='running' WHERE workflow_id=?").run(wf);
    l.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)').run(wf,0,'goal','# goal','{}',Date.now());
  });
  // One dispatched leg of `op` admitted at `admittedAt`, with its done report filed (a managed dispatch: no terminal to probe).
  const leg=(jobId,op,admittedAt,{status='running',attempt=1}={})=>seed(l=>{
    const dispatchId=`ctx-${jobId}`;
    l.db.prepare("INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,worker_id,created_at,updated_at) VALUES(?,?,?,?,0,'op','op',?,?,?,?,?)")
      .run(jobId,wf,op,attempt,JSON.stringify({opId:op,owned_paths:[`docs/${jobId}`],managed:{dispatchId}}),status,dispatchId,admittedAt,admittedAt);
    l.db.prepare('INSERT INTO contracts(workflow_id,op_id,attempt,dispatch_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?,?)').run(wf,op,attempt,dispatchId,'# contract','{}',admittedAt);
    l.db.prepare("INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,consumed_at,created_at) VALUES(?,?,?,?,0,'done','{}',?,?)").run(wf,dispatchId,op,attempt,admittedAt,admittedAt);
  });
  return {repo,wf,api,ok,seed,read,leg};
};

test('api check records a later-added red check advisory for an older leg and red for a current one; op-contract names the admission',t=>{
  const fx=fixture(t);
  fx.leg('job-old-draw','interface.draw',T_TREE+60_000);
  fx.leg('job-new-draw','interface.draw',Date.now(),{attempt:2});
  const checks=JSON.stringify({checks:[{name:'unit',exitCode:0},{name:'shell-conformance',exitCode:1,codes:['DRAW_MATRIX_INCOMPLETE'],evidence:'desktop only'}]});
  const old=fx.ok(['check','--job','job-old-draw','--checks',checks]);
  assert.deepEqual(old.checkEvidence,{observed:2,passed:1,failed:0,green:true,advisory:1});
  assert.deepEqual(old.advisory,[{name:'shell-conformance',changes:['part-review-matrix']}]);
  const stored=fx.read(db=>JSON.parse(db.prepare('SELECT checks_json FROM checks WHERE op_id=? AND attempt=1').get('interface.draw').checks_json));
  assert.match(stored.checks[1].advisory.reason,/added by part-review-matrix after this leg was admitted/);
  const current=fx.ok(['check','--job','job-new-draw','--checks',checks]);
  assert.deepEqual(current.checkEvidence,{observed:2,passed:1,failed:1,green:false},'a leg admitted after the change is held to it');
  assert.equal(current.advisory,undefined);

  const contract=fx.ok(['op-contract','--job','job-old-draw']);
  assert.deepEqual([contract.admission.admittedAt,contract.admission.source],[T_TREE+60_000,'contract-row']);
  assert.deepEqual(contract.admission.laterChanges,['part-review-matrix','nav-follow-up']);
  assert.deepEqual(contract.admission.advisoryCodes,['DRAW_MATRIX_INCOMPLETE']);
});

test('dispatch records the contract version the leg is admitted under',t=>{
  const fx=fixture(t);
  const job=fx.ok(['enqueue','--workflow',fx.wf,'--op','code.refactor','--paths','docs/']).job_id;
  const d=fx.api(['dispatch','--job',job,'--model','codex-agent','--spawn']);
  assert.equal(d.status,0,d.stderr||d.stdout);
  const context=fx.read(db=>JSON.parse(db.prepare('SELECT context_json FROM contracts WHERE workflow_id=? AND op_id=?').get(fx.wf,'code.refactor').context_json));
  assert.equal(context.contract.schema,CONTRACT_VERSION_SCHEMA);
  assert.equal(context.contract.op,'code.refactor');
  assert.match(context.contract.digest,/^[0-9a-f]{64}$/);
  assert.ok(context.contract.files.some(f=>f.path==='modules/ops/ops/code.refactor.yaml'&&/^[0-9a-f]{64}$/.test(f.digest)));
  const admission=fx.ok(['op-contract','--job',job]).admission;
  assert.deepEqual([admission.source,admission.digest,admission.laterChanges],['recorded',context.contract.digest,[]]);
});

test('a reach follow-up change owes each older leg a follow-up leg: status names it, actionable, until the Kernel enqueues it',t=>{
  const fx=fixture(t);
  fx.leg('job-draw-old','interface.draw',T0,{status:'succeeded'});
  fx.leg('job-impl-old','interface.implement',T0,{status:'succeeded'});
  const before=fx.ok(['status','--workflow',fx.wf]).frontier;
  assert.deepEqual(before.contractFollowUps.map(f=>[f.change,f.jobId,f.followUpOp,f.after]),[['nav-follow-up','job-draw-old','interface.implement',null]]);
  assert.equal(before.actionable,true);
  assert.match(before.reason,/--contract-change <change> --follow-up-of <jobId>/);
  const refuse=(args,code)=>{const r=fx.api(args);assert.equal(r.status,1,r.stdout);assert.equal(lastLine(r.stderr)?.code,code,r.stderr);};
  refuse(['enqueue','--workflow',fx.wf,'--op','interface.implement','--paths','docs/x','--contract-change','layout-tree','--follow-up-of','job-draw-old'],'contract-change-unknown');
  refuse(['enqueue','--workflow',fx.wf,'--op','interface.implement','--paths','docs/x','--contract-change','nav-follow-up','--follow-up-of','job-nowhere'],'follow-up-of-unknown');
  const follow=fx.ok(['enqueue','--workflow',fx.wf,'--op','interface.implement','--paths','docs/nav','--contract-change','nav-follow-up','--follow-up-of','job-draw-old']);
  assert.deepEqual(follow.contractChange,{id:'nav-follow-up',followUpOf:'job-draw-old'});
  assert.equal(fx.ok(['status','--workflow',fx.wf]).frontier.contractFollowUps,undefined,'the key is present only while a follow-up is owed');
});

test('every op a registered contract change names is an op manifest, never a kind', () => {
  const registry = loadContractChanges(ROOT);
  assert.deepEqual(registry.problems, []);
  const manifests = new Set(fs.readdirSync(path.join(ROOT, 'modules', 'ops', 'ops')).filter((f) => f.endsWith('.yaml')).map((f) => f.replace(/\.yaml$/, '')));
  const unknown = registry.changes.flatMap((change) => [...change.ops, ...(change.followUp ? [change.followUp.op, ...change.followUp.ops] : [])]
    .filter((op) => !manifests.has(op)).map((op) => `${change.id}: ${op}`));
  assert.deepEqual(unknown, []);
});
