import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from '../helpers/fake-orca.mjs';
import {seedWorkflow} from '../helpers/ledger-fixture.mjs';
import {proofRepo} from '../helpers/sonar-scan.mjs';
import {registerWorkflowWorktree} from '../../scripts/kernel/workflow-worktree.mjs';
import {inspectLedger,ledgerFileFor,openLedger} from '../../engine/db/ledger.mjs';
import {
  CONTRACT_VERSION_SCHEMA,classifyChecks,contractFilesOf,contractVersionOf,runtimeShaOf,
} from '../../scripts/machine/contract-version.mjs';
import {checkShellConformance} from '../../scripts/work/ui/shell-conformance.mjs';
import {parseYaml,stringifyYaml} from '../../engine/yaml.mjs';
import { installGuardLauncher } from '../helpers/guard-launcher.mjs';

// Immutable selected inputs are preserved; current guards refuse red checks at every admission time.
const ROOT=path.resolve(import.meta.dirname,'..', '..');
const API=path.join(ROOT,'scripts','kernel','cli.mjs');
const json=text=>{try{return JSON.parse(text);}catch{return null;}};
const lastLine=text=>json(String(text).trim().split('\n').at(-1));
const T0=1;

test('caller advisory metadata cannot demote any red current check', () => {
  const checks = [{ name: 'unit', exitCode: 0 }, { name: 'shell-conformance', exitCode: 1, codes: ['SHELL_RECORD_MISSING'], advisory: { forged: true } },
    { name: 'mixed', exitCode: 1, advisory: { outOfScope: ['invented'] } }];
  assert.deepEqual(classifyChecks(checks), [{ name: 'unit', exitCode: 0 }, { name: 'shell-conformance', exitCode: 1, codes: ['SHELL_RECORD_MISSING'] }, { name: 'mixed', exitCode: 1 }]);
  assert.equal(checks[1].advisory.forged, true, 'classification does not mutate filed caller evidence');
});

test('the contract version digests the brief, the shared documents and what the brief cites, and reads HEAD without git',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-contract-root-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const put=(rel,text)=>{fs.mkdirSync(path.dirname(path.join(root,rel)),{recursive:true});fs.writeFileSync(path.join(root,rel),text);};
  put('modules/ops/ops/interface.draw.yaml','reads:\n  - path: modules/schemas/work-layout-tree.schema.yaml\ncheck: starci work shell-conformance\n');
  put('modules/ops/_common.yaml','common\n');
  put('modules/schemas/work-layout-tree.schema.yaml','schema\n');
  const sha='0123456789abcdef0123456789abcdef01234567';
  put('.git/HEAD','ref: refs/heads/main\n');put('.git/packed-refs',`# pack-refs\n${sha} refs/heads/main\n`);
  assert.equal(runtimeShaOf(root),sha,'a packed ref resolves');
  assert.deepEqual(contractFilesOf(root,'interface.draw'),['modules/ops/ops/interface.draw.yaml','modules/ops/_common.yaml','modules/kernel/verdict-contract.yaml','modules/schemas/work-layout-tree.schema.yaml']);
  const v1=contractVersionOf(root,'interface.draw',{now:5});
  assert.deepEqual([v1.schema,v1.runtimeSha,v1.admittedAt],[CONTRACT_VERSION_SCHEMA,sha,5]);
  assert.equal(v1.files.some(f=>f.path==='scripts/work/ui/shell-conformance.mjs'),false,'the catalog command does not expose its internal script path');
  put('modules/schemas/work-layout-tree.schema.yaml','schema v2\n');
  assert.notEqual(contractVersionOf(root,'interface.draw').digest,v1.digest,'a change to a cited schema is a new contract version');
  assert.equal(runtimeShaOf(ROOT)?.length,40,'the runtime root itself reads its HEAD');
});

test('missing current shell structure refuses even beside caller advisory metadata', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-shell-admitted-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const work = path.join(root, '.starciwork'); fs.mkdirSync(work);
  const strict = checkShellConformance(work), forged = checkShellConformance(work, { advisoryCodes: ['SHELL_RECORD_MISSING'] });
  assert.equal(strict.ok, false); assert.equal(forged.ok, false);
  assert.ok(forged.refused.some((line) => line.includes('SHELL_RECORD_MISSING')));
  const result = spawnSync(process.execPath, [path.join(ROOT, 'scripts/work/ui/shell-conformance.mjs'), work, '--admitted-at', '1'], { cwd: ROOT, encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 2, result.stdout + result.stderr);
});

const fixture=t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-contract-rollout-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  if(process.env.STARCI_TEST_TEMP_DIR)t.after(()=>fs.rmSync(path.join(process.env.STARCI_TEST_TEMP_DIR,'starci-job-scratch'),
    {recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const main=path.join(root,'main'),repo=path.join(root,'repo');fs.mkdirSync(main);
  const wf='wf-contract-rollout',branch=`wf-${wf}`,mainGit=proofRepo(t,main);
  mainGit('worktree','add','-q','-b',branch,repo,'main');
  const git=(...args)=>mainGit('-C',repo,...args);
  for(const d of ['docs','src'])fs.mkdirSync(path.join(repo,d),{recursive:true});
  const stub=path.join(root,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const ownerRoot=path.join(root,'owner'),trustHome=path.join(root,'trust-home');
  fs.mkdirSync(ownerRoot);fs.mkdirSync(trustHome);installGuardLauncher(trustHome);
  const owner=parseYaml(fs.readFileSync(path.join(ROOT,'config.example.yaml'),'utf8'));
  owner.launchTrust={profile:'automatic',approvedBy:'owner',approvalRef:'private contract rollout fixture adoption',roots:[main]};
  fs.writeFileSync(path.join(ownerRoot,'config.yaml'),stringifyYaml(owner));
  const base={...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stub]),
    STARCI_FAKE_ORCA_LOG:path.join(root,'calls.jsonl'),STARCI_FAKE_ORCA_STATE:path.join(root,'state.json'),
    STARCI_OWNER_ROOT:ownerRoot,STARCI_AGENT_TRUST_HOME:trustHome,
    STARCI_TEST_MACHINE_FILE:path.join(root,'machine.sqlite'),STARCI_PROJECTS_ROOT:path.join(root,'projects'),STARCI_LOCAL_ROOT:path.join(root,'localappdata')};
  for(const key of ['ORCA_TERMINAL_HANDLE','STARCI_ROLE','STARCI_OP_JOB'])delete base[key];
  const api=args=>spawnSync(process.execPath,[API,...args,'--repo',repo,'--json'],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env:base});
  const ok=args=>{const r=api(args);assert.equal(r.status,0,`${args.join(' ')}: ${r.stderr||r.stdout}`);return json(r.stdout);};
  registerWorkflowWorktree({env:base},{workflowId:wf,orcaWorktreeId:'contract-rollout::workflow',path:repo,branch});
  const seed=fn=>{const l=openLedger({file:ledgerFileFor(repo,{env:base})});try{return fn(l);}finally{l.close();}};
  const read=fn=>{const l=inspectLedger({file:ledgerFileFor(repo,{env:base})});try{return fn(l.db);}finally{l.close();}};
  seed(l=>{
    l.ensureWorkflow({workflowId:wf,title:wf,ledgerMode:'durable',sourceRoots:[repo]});
    l.write.changeWorkflowPhase({workflowId:wf,to:'running',by:'test-fixture',reason:'seed'});
    l.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)').run(wf,0,'goal','# goal','{}',Date.now());
  });
  // One dispatched leg of `op` admitted at `admittedAt`, with its done report filed (a managed dispatch: no terminal to probe).
  const leg=(jobId,op,admittedAt,{status='running'}={})=>seed(l=>{
    const dispatchId=`ctx-${jobId}`;
    seedWorkflow(l,{id:wf,jobs:[{jobId,opId:op,status,dispatchId,workerId:dispatchId,createdAt:admittedAt,updatedAt:admittedAt,
      payload:{opId:op,owned_paths:[`docs/${jobId}`],managed:{dispatchId}}}]});
    const attemptId=l.db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=?').get(jobId).attempt_id;
    l.db.prepare('INSERT INTO contracts(attempt_id,workflow_id,job_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?)')
      .run(attemptId,wf,jobId,'# contract',JSON.stringify({ worktree: repo, packet: { context: { selected_op: { contract: { id: op }, checks: { required: [], candidates: [] } }, readRefs: [], owned_paths: [{ root: repo, path: `docs/${jobId}` }] } } }),admittedAt);
    l.db.prepare("INSERT INTO reports(workflow_id,attempt_id,dispatch_id,job_id,outcome,report_json,consumed_at,created_at) VALUES(?,?,?,?,'done','{}',?,?)")
      .run(wf,attemptId,dispatchId,jobId,admittedAt,admittedAt);
  });
  return {repo,wf,git,api,ok,seed,read,leg};
};

test('native record-checks retains a red declared result for every admission time and op-contract names actual capture', t => {
  const fx=fixture(t);
  for (const [job, admittedAt] of [['job-early', T0], ['job-current', Date.now()]]) {
    fx.leg(job, 'interface.draw', admittedAt);
    const checks = JSON.stringify({ checks: [{ name: 'unit', exitCode: 0 }, { name: 'shell-conformance', exitCode: 1, codes: ['DRAW_MATRIX_INCOMPLETE'], advisory: { forged: true }, evidence: 'desktop only' }] });
    const result = fx.ok(['record-checks', '--job', job, '--checks', checks]);
    assert.deepEqual(result.checkEvidence, { observed: 2, passed: 0, failed: 1, green: false, declared: 1 });
    const stored = fx.read((db) => JSON.parse(db.prepare("SELECT summary_json FROM check_runs WHERE job_id=? AND name='shell-conformance' ORDER BY check_id DESC LIMIT 1").get(job).summary_json).entry);
    assert.equal(stored.advisory, undefined);
    const admission = fx.ok(['op-contract', '--job', job]).admission;
    assert.deepEqual([admission.admittedAt, admission.source], [admittedAt, 'contract-row']);
    assert.deepEqual(Object.keys(admission).sort(), ['admittedAt', 'digest', 'runtimeSha', 'source']);
  }
});

test('dispatch records the contract version the leg is admitted under',t=>{
  const fx=fixture(t);
  const job=fx.ok(['enqueue','--workflow',fx.wf,'--op','code.refactor','--paths','docs/']).job_id;
  const d=fx.api(['dispatch','--job',job,'--model','codex-agent','--spawn']);
  assert.equal(d.status,0,d.stderr||d.stdout);
  const context=fx.read(db=>JSON.parse(db.prepare('SELECT context_json FROM contracts WHERE job_id=?').get(job).context_json));
  assert.equal(context.contract.schema,CONTRACT_VERSION_SCHEMA);
  assert.deepEqual(context.packet.context.gate_binding.targets,[{root:fx.repo,head:fx.git('rev-parse','HEAD'),owned:['docs']}]);
  assert.equal(context.packet.context.workflow_worktree.path,fx.repo);
  assert.equal(context.contract.op,'code.refactor');
  assert.match(context.contract.digest,/^[0-9a-f]{64}$/);
  assert.ok(context.contract.files.some(f=>f.path==='modules/ops/ops/code.refactor.yaml'&&/^[0-9a-f]{64}$/.test(f.digest)));
  const admission=fx.ok(['op-contract','--job',job]).admission;
  assert.deepEqual([admission.source,admission.digest],['recorded',context.contract.digest]);
});
