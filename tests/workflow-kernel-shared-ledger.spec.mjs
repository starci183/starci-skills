import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {parseYaml} from '../core/yaml.mjs';
import {createStore} from '../execution/workflow-store.mjs';
import {approve,createWorkflowState,detectLedgerMode,goalPhase,kernelMain,runLoop,validateWorkTree} from '../execution/workflow-kernel.mjs';
import {fakeAllocator,passing,scriptedOrca} from './helpers/kernel-harness.mjs';

/**
 * A frontend workflow on the Work tree its backend owns. Everything here is real except the runtimes: two git
 * repositories, the host route registry that binds them, and the shipped Work validator - because the whole
 * claim under test is that the record lands in the owner, names the frontend, and still validates.
 */
const template=fs.readFileSync(new URL('../docs/supervision-templates/op.md',import.meta.url),'utf8');
const noWait=()=>{};
const RECEIPT='demo.sales.implementation.frontend.receipt';
const INTAKE='demo.sales.implementation.backend.intake';
const PAGE='app/receipt/page.tsx';

const node=({id,directory,files,check,repository=null})=>`schema: work/node@2
id: ${id}
kind: implementation
required: true
state: todo
description: ${id === RECEIPT ? 'Render the receipt page against the accepted design.' : 'Persist an order on intake.'}
assertions:
  - unit-tests-pass
implementation:
  status: proposed
  changes:
    - what: Write the slice.
      why: Nothing does this yet.
      repository: ${repository ?? 'demo-backend'}
      directory: ${directory}
      revision: worktree
      verification:
        - ${check}
      files:
        - ${files}
  gaps: []
extensions:
  work3:
${repository ? `    scope:\n      repository: ${repository}\n` : ''}    checks:
      - assertion: unit-tests-pass
        command: ${check}
`;

function git(cwd,...args){
  const result=spawnSync('git',args,{cwd,encoding:'utf8',windowsHide:true});
  assert.equal(result.status,0,`git ${args.join(' ')} in ${cwd}: ${result.stderr}`);
  return (result.stdout??'').trim();
}
function repository(root,{name,branch,origin,seed={}}){
  fs.mkdirSync(root,{recursive:true});
  fs.writeFileSync(path.join(root,'package.json'),`${JSON.stringify({name,private:true},null,2)}\n`);
  for(const [relative,content] of Object.entries(seed)){
    const file=path.join(root,relative);
    fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.writeFileSync(file,content);
  }
  git(root,'init','-b','main');
  git(root,'remote','add','origin',origin);
  git(root,'config','user.email','kernel@starci.test');
  git(root,'config','user.name','StarCi kernel spec');
  git(root,'config','commit.gpgsign','false');
  git(root,'add','-A');
  git(root,'commit','-q','-m','chore: seed the repository');
  if(branch!=='main')git(root,'checkout','-q','-b',branch);
  return root;
}

function fixture(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-shared-ledger-'));
  t.after(()=>{assert.equal(path.dirname(root),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(root).startsWith('starci-shared-ledger-'));fs.rmSync(root,{recursive:true,force:true});});
  const source=path.join(root,'source'),host=path.join(source,'.claude');
  fs.mkdirSync(host,{recursive:true});
  const owner=path.join(root,'demo-backend'),code=path.join(root,'demo-frontend');
  // The backend owns the one Work tree of the product; the frontend owns no `.starciwork` at all.
  repository(owner,{name:'@demo/backend',branch:'main',origin:'https://github.com/demo/demo-backend.git'});
  const work=path.join(owner,'.starciwork');
  const put=(relative,content)=>{const file=path.join(work,relative);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,content);};
  put('workspace.yaml','schema: work/workspace@1\nid: demo\n');
  put(`features/sales/implementation/frontend/receipt/index.yaml`,
    node({id:RECEIPT,directory:'app/receipt',files:PAGE,check:'npx vitest run receipt',repository:'demo-frontend'}));
  put(`features/sales/implementation/backend/intake/index.yaml`,
    node({id:INTAKE,directory:'src/sales',files:'src/sales/intake.ts',check:'npx vitest run intake'}));
  git(owner,'add','-A');
  git(owner,'commit','-q','-m','work: author the sales slices');
  // The page already exists as a placeholder: an operation changes tracked code, so the worktree it starts
  // from is the one the design describes, not an empty directory.
  repository(code,{name:'demo-frontend',branch:'session/receipt',origin:'git@github.com:demo/demo-frontend.git',
    seed:{[PAGE]:'export default function Receipt(){return null;}\n'}});
  const binding=path.join(source,'.workspaces','projects','demo','work.json');
  fs.mkdirSync(path.dirname(binding),{recursive:true});
  fs.writeFileSync(binding,`${JSON.stringify({schema:'starci/workspace-binding@1',project:'demo',
    repositories:{be:{pathFromSource:'../demo-backend',gitRepository:'https://github.com/demo/demo-backend.git'},
      fe:{pathFromSource:'../demo-frontend',gitRepository:'https://github.com/demo/demo-frontend.git'}},
    work:{ownerRole:'be',pathFromRepository:'.starciwork'}},null,2)}\n`);
  return {root,source,host,owner,code,work,
    read:id=>parseYaml(fs.readFileSync(path.join(work,'features/sales/implementation',id===RECEIPT?'frontend/receipt':'backend/intake','index.yaml'),'utf8')),
    evidence:(id,opId=id)=>path.join(work,'features/sales/implementation',id===RECEIPT?'frontend/receipt':'backend/intake','evidence',`${opId}-evidence`,'manifest.yaml')};
}

/** The goal phase of a frontend workflow against the routed tree, stopping before any approval. */
function started(t){
  const fixed=fixture(t);
  assert.equal(detectLedgerMode(fixed.code,null,path.join(fixed.owner,'.starciwork')),'work',
    'the mode follows the resolved tree, not a `.starciwork` the frontend does not have');
  const store=createStore({repoRoot:fixed.owner,id:'20260912-120000-shared-ledger'});
  const state=createWorkflowState({job:'Render the receipt page',worktree:fixed.code,branch:'session/receipt',
    store,host:fixed.host,launcher:'L.mjs',ledgerMode:'work',repoRoot:fixed.code});
  const goal=goalPhase(store,state,{validate:validateWorkTree,cwd:fixed.code,
    assessGoal:({ledger})=>({ok:true,provider:'fake',value:{definitionOfDone:[`the ${ledger.length} listed nodes are done`],risks:[],questions:[]}})});
  return {...fixed,store,state,goal};
}

test('a frontend workflow binds the Work tree its backend owns and takes only the frontend nodes',t=>{
  const run=started(t);
  assert.equal(run.goal.ok,true);
  assert.equal(run.goal.ledgerShared,true);
  assert.equal(run.goal.ledgerOwner,'demo-backend');
  assert.equal(run.goal.ledgerSource,'workspace');
  assert.equal(run.state.ledgerRoot,run.work);
  assert.deepEqual(run.state.ledgerOwner,{repoRoot:run.owner,repository:'demo-backend',role:'be',project:'demo'});
  assert.equal(run.state.codeSide,'frontend');
  // The backend node names no repository and sits in implementation/backend/**: it is not this job's work.
  assert.deepEqual(run.state.ops.map(op=>[op.id,op.nodeId,op.kind]),[[RECEIPT,RECEIPT,'interface.draw']]);
  assert.deepEqual(run.state.ops[0].allowlist,[PAGE]);
  assert.deepEqual(run.state.ledger.map(item=>item.id),[RECEIPT]);
  assert.equal(run.state.needUser.length,0);
  // The frontend repository keeps no Work tree of its own, not even the workflow's own runtime directory.
  assert.equal(fs.existsSync(path.join(run.code,'.starciwork')),false);
  assert.equal(run.store.dir.startsWith(run.owner),true);
  const goal=fs.readFileSync(run.store.paths.goal,'utf8');
  assert.match(goal,/owned by `demo-backend`/);
  assert.match(goal,/every Work record is written and committed in the owner/);
  const record=JSON.parse(fs.readFileSync(run.store.paths.goalJson,'utf8'));
  assert.equal(record.ledgerShared,true);
  assert.equal(record.codeRepository,'demo-frontend');
  assert.equal(record.codeSide,'frontend');
});

test('the accepted slice is recorded and committed in the owner, names the frontend repository, and the tree still validates',t=>{
  const run=started(t);
  approve(run.store,run.state);
  run.state.run='run_wf';run.state.from='term_kernel';
  const orca=scriptedOrca({reportsDir:run.store.paths.reports,worktree:run.code,
    // The frontend lane: the surface is drawn, then built, then walked; the node is done only after the walk.
    scripts:{[RECEIPT]:[{outcome:'done',summary:'The receipt surface is drawn.',files:[],
      checks:[passing('unit-tests-pass','npx vitest run receipt')]}],
      [`${RECEIPT}-implement`]:[{outcome:'done',summary:'The receipt page renders.',files:[PAGE],
      checks:[passing('unit-tests-pass','npx vitest run receipt')]}],
      [`${RECEIPT}-verify`]:[{outcome:'done',summary:'The receipt flow passes on the surface.',files:[],
      checks:[passing('unit-tests-pass','npx vitest run receipt')]}]}});
  // The agent's work: the page is written in the frontend worktree and nowhere else.
  fs.writeFileSync(path.join(run.code,PAGE),'export default function Receipt(){return <main>Receipt</main>;}\n');
  const ownerHead=git(run.owner,'rev-parse','HEAD');
  const state=runLoop(orca.orca,run.store,run.state,{cwd:run.code,allocator:fakeAllocator(),template,wait:noWait,
    validate:validateWorkTree,git:spawnSync,exec:command=>({status:0,stdout:`${command} ok`,stderr:''}),
    // The launcher resolves a worktree relative to the process; this workflow is on another drive, so the
    // launch itself is stood in for and everything after it is the kernel's own path.
    launch:(_orca,{operation,scope})=>orca.register(scope??operation),
    decide:()=>{throw Error('decide must not be called on a policy-covered path');},
    waitTimeoutMs:2000,tickMs:1000,maxIterations:10});

  const built=state.ops.find(op=>op.kind==='frontend.implement'),last=state.ops.find(op=>op.kind==='uat.verify');
  assert.deepEqual(state.ops.map(op=>op.kind),['interface.draw','frontend.implement','uat.verify']);
  const receipt=run.read(RECEIPT);
  assert.equal(receipt.state,'done');
  assert.equal(receipt.extensions.work3.kernel.verifiedBy,'starci-kernel');
  assert.deepEqual(receipt.completion.evidence,[`${last.id}-evidence`],'the completion is named after the op that closed the lane');
  // Source identity names the repository the code is in - the frontend - never the owner of the ledger.
  assert.equal(receipt.completion.sourceIdentity.repositories[0].repository,'demo-frontend');
  assert.equal(receipt.completion.sourceIdentity.repositories[0].commit,built.head,'the identity binds the head of the code, which the build step produced');
  assert.equal(receipt.completion.sourceIdentity.repositories[0].coverage.kind,'scoped');
  const manifest=parseYaml(fs.readFileSync(run.evidence(RECEIPT,last.id),'utf8'));
  assert.equal(manifest.nodeId,RECEIPT);
  assert.equal(manifest.outcome,'pass');
  assert.equal(manifest.sourceIdentity.repositories[0].repository,'demo-frontend');
  assert.deepEqual(manifest.provenance.servedVersions,[{repository:'demo-frontend',commit:built.head,artifact:'worktree'}]);
  // The backend node was never touched: another workflow in another repository owns it.
  assert.equal(run.read(INTAKE).state,'todo');

  // The code commit is in the frontend, the Work commit is in the backend, and neither repository carries the other's.
  assert.match(git(run.code,'log','-1','--format=%B'),new RegExp(`Work: ${RECEIPT.replaceAll('.','\\.')}`));
  assert.equal(git(run.code,'status','--porcelain'),'');
  const ledgerCommit=git(run.owner,'rev-parse','HEAD');
  assert.notEqual(ledgerCommit,ownerHead,'the ledger write is committed in the repository that owns the tree');
  assert.match(git(run.owner,'log','-1','--format=%B'),new RegExp(`^work\\(${RECEIPT.replaceAll('.','\\.')}\\): record ${last.id.replaceAll('.','\.')} in the Work ledger`));
  assert.match(git(run.owner,'log','-1','--format=%B'),new RegExp(`Work: ${RECEIPT.replaceAll('.','\\.')}`));
  assert.equal(git(run.owner,'status','--porcelain','--','.starciwork/features'),'','the write is committed, not left dirty in somebody else'+"'"+'s repository');
  assert.equal(git(run.owner,'status','--porcelain','--','.starciwork'),'?? .starciwork/_local/','only the kernel\'s own runtime directory stays untracked');
  assert.equal(state.head,built.head,'the workflow head stays the head of the code it produced');
  assert.notEqual(state.head,ledgerCommit);
  assert.equal(last.ledgerCommit,ledgerCommit);

  const events=run.store.readEvents();
  const loaded=events.find(event=>event.event==='ledger-loaded');
  assert.deepEqual(loaded['ledger-shared'],{owner:'demo-backend',root:run.work.replaceAll('\\','/')});
  assert.equal(loaded.source,'workspace');
  assert.equal(loaded.code,'demo-frontend');
  const committed=events.find(event=>event.event==='ledger-commit');
  assert.equal(committed.ledgerCommit,ledgerCommit);
  assert.equal(committed.shared,true);
  assert.equal(committed.repository,'demo-backend');

  // The real validator accepts the tree with one repository's completion inside another repository's ledger.
  const validated=validateWorkTree({repoRoot:run.owner,workRoot:run.work});
  assert.deepEqual(validated.errors,[]);
  assert.equal(validated.ok,true);
  assert.deepEqual(validated.nodes.filter(item=>item.id===RECEIPT).map(item=>item.effectiveState),['done']);
});

test('a workflow refuses to start on a shared ledger that carries changes the kernel does not own',t=>{
  const run=started(t);
  approve(run.store,run.state);
  run.state.run='run_wf';run.state.from='term_kernel';
  // Somebody is authoring business material in the owner repository right now.
  fs.writeFileSync(path.join(run.work,'features','sales','brief.md'),'# Sales\n\nA pending draft nobody committed.\n');
  const orca=scriptedOrca({reportsDir:run.store.paths.reports,worktree:run.code,scripts:{}});
  const state=runLoop(orca.orca,run.store,run.state,{cwd:run.code,allocator:fakeAllocator(),template,wait:noWait,
    validate:validateWorkTree,git:spawnSync,exec:()=>({status:0,stdout:'',stderr:''}),
    launch:()=>{throw Error('nothing may be launched over a ledger the kernel cannot commit into');},
    maxIterations:4});
  assert.equal(state.finished.outcome,'blocked');
  assert.match(state.finished.reason,/shared Work ledger carries uncommitted changes/);
  assert.ok(state.needUser.some(item=>item.kind==='ledger'&&/features\/sales\/brief\.md/.test(item.detail)));
  const dirty=run.store.readEvents().find(event=>event.event==='ledger-shared-dirty');
  assert.deepEqual(dirty.foreign,['.starciwork/features/sales/brief.md']);
  assert.equal(dirty.owner,'demo-backend');
  assert.equal(run.read(RECEIPT).state,'todo','nothing was written into the tree it refused to commit into');
});

test('the launcher commands reach one workflow directory in the owner, from the frontend worktree',t=>{
  const fixed=fixture(t);
  const assessGoal=({ledger})=>({ok:true,provider:'fake',value:{definitionOfDone:[`the ${ledger.length} nodes are done`],risks:[],questions:[]}});
  const goal=kernelMain('workflow-goal',{job:'Render the receipt page',host:fixed.host},
    {orca:null,cwd:fixed.code,functions:{assessGoal}});
  assert.equal(goal.ledgerShared,true);
  assert.equal(goal.ledgerOwner,'demo-backend');
  assert.equal(goal.ops,1);
  // The workflow directory is in the owner, and the frontend still has no Work tree of its own.
  assert.equal(goal.dir.startsWith(fixed.owner),true);
  assert.equal(fs.existsSync(path.join(fixed.code,'.starciwork')),false);
  // Status is run from the frontend too and finds that directory through the same host route.
  const status=kernelMain('workflow-status',{id:goal.id,host:fixed.host},{orca:null,cwd:fixed.code});
  assert.equal(status.dir,goal.dir);
  assert.equal(status.ledgerMode,'work');
  assert.equal(status.ledgerShared,true);
  assert.equal(status.ledgerSource,'workspace');
  assert.equal(status.codeSide,'frontend');
  assert.equal(status.ledgerOwner.repository,'demo-backend');
  assert.deepEqual(status.workNodes.map(item=>item.node),[RECEIPT]);
  // The same workflow is reachable by naming the tree outright instead of the host.
  assert.equal(kernelMain('workflow-status',{id:goal.id,'ledger-root':fixed.work},{orca:null,cwd:fixed.code}).dir,goal.dir);
});
