import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {parseYaml} from '../core/yaml.mjs';
import {createStore} from '../kernel/store.mjs';
import {approve,createWorkflowState,detectLedgerMode,goalPhase,kernelMain,runLoop,validateWorkTree} from '../kernel/kernel.mjs';
import {fakeAllocator,passing,scriptedOrca} from './helpers/kernel-harness.mjs';
import {encodePng,screen} from './helpers/png.mjs';
import {toOp} from '../kernel/common.mjs';
import {buildReport} from '../kernel/reports.mjs';
import {openJournal} from '../kernel/journal.mjs';
import {sealRuntime} from '../kernel/runtime-pin.mjs';

/**
 * A frontend workflow on the Work tree its backend owns. Everything here is real except the runtimes: two git
 * repositories, the host route registry that binds them, and the shipped Work validator - because the whole
 * claim under test is that the record lands in the owner, names the frontend, and still validates.
 */
const template=fs.readFileSync(new URL('../docs/supervision-templates/op.md',import.meta.url),'utf8');
const noWait=()=>{};
const acceptAll=()=>({ok:true,verdict:'accept',summary:'stub validator: accepted',findings:[],dropped:[],provider:'stub',usage:null});
const RECEIPT='demo.sales.implementation.frontend.receipt';
const INTAKE='demo.sales.implementation.backend.intake';
const PAGE='app/receipt/page.tsx';
const slash=value=>String(value).replaceAll('\\','/');
const stageSealableRuntime=(sourceRoot,target)=>{
  const required=['.dist','bin/starci.mjs','bin/starci-skills.mjs','scripts/config.mjs','config.json','core/runtime-root.mjs','core/yaml.mjs',
    'init/AGENTS.md','init/CLAUDE.md','init/DEVIN.md','package.json','SKILL.md','docs/supervision-templates/op.md','knowledge/grammars'];
  for(const relative of required){const source=path.join(sourceRoot,...relative.split('/')),destination=path.join(target,...relative.split('/'));
    fs.mkdirSync(path.dirname(destination),{recursive:true});fs.cpSync(source,destination,{recursive:true});}
  return target;
};

const BRAND=`schema: work/node@2
id: demo.brand
kind: brand
required: true
state: todo
description: The brand of the product - identity, colour tokens, mascot.
assertions:
  - brand-tokens-match-source
assets:
  - path: assets/mascot/rest.png
    description: Mascot master at rest.
brand:
  rev: "1"
  identity:
    name: Demo
    family: starci
    owner: Product owner
  color:
    tokens:
      - token: --demo-core-primary
        value: "#c0203c"
        role: primary
    policy:
      dangerMayMatchPrimary: true
  typography:
    family: Demo Sans, system-ui, sans-serif
  mascot:
    name: Demo mascot
    assets:
      - path: brand/assets/mascot/rest.png
        purpose: Mascot master at rest, for empty states.
    allowedIn: [empty states]
    forbiddenIn: [error dialogs]
    rules: [Never recolour the mascot.]
  iconography:
    set:
      - "@demo/icons"
  imagery:
    style:
      - Warm studio light.
    promptRules:
      - Name the mascot sheet and the primary token.
  forbidden:
    - Never recolour the mascot.
  sources:
    - repository: demo-frontend
      path: src/app/globals.css
      kind: css
`;

const UI='demo.sales.ui';
/** The feature's design record: a ui node whose allowlist is its own folder in the tree, delivered by the frontend job. */
const UI_RECORD=`schema: work/node@2
id: demo.sales.ui
kind: ui
required: true
state: todo
description: The sales surfaces, drawn before they are built.
assertions:
  - sales-surfaces-drawn
extensions:
  work3:
    allowlist:
      files:
        - .starciwork/features/sales/ui/**
    checks:
      - assertion: sales-surfaces-drawn
        command: node starci.mjs validate .starciwork
    scope:
      repository: demo-frontend
`;
const UI_PAYLOAD=`ui:
  status: proposed
  intent: The receipt, drawn inside the grammar and the brand.
  surfaces:
    - name: receipt
      route: /receipt
      purpose: Read the receipt of an order.
      actors:
        - customer
  states:
    - name: loading
      trigger: the order loads
      behavior: skeleton lines
    - name: empty
      trigger: no order
      behavior: the mascot says there is nothing to show
    - name: error
      trigger: the order cannot load
      behavior: an inline error with retry
    - name: interaction
      trigger: a line is expanded
      behavior: the line detail opens in place
    - name: resting
      trigger: order present
      behavior: the receipt lines
  accessibility:
    - keyboard reachable
  responsive:
    - narrow and wide
  assets:
    - path: assets/receipt-resting.png
      role: candidate for receipt resting, narrow
      provenance: image model
      generation:
        tool: image_gen.imagegen
        promptPath: assets/receipt-resting.prompt.txt
        inputRefs:
          - brand/index.yaml
  observations: []
  gaps: []
  artworkSlots: []
assets:
  - path: assets/receipt-resting.png
    description: Candidate for receipt resting, narrow.
`;
/** Bytes the validator reads as a PNG: the signature and a little padding. */
// The drawing's candidate is a real capture painted in the brand's primary: the kernel now reads every accepted
// drawing's bytes against the brand, so a placeholder header would be refused as a render with no primary in it.
const PNG_BYTES=encodePng(screen({width:24,height:24,bands:[{hex:'#c0203c',rows:12}]}));

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

// The fixture tree (two real git repositories, ~14 git spawns) is identical, deterministic content on
// every call - no test parameterizes it. Real git behaviour is the point of these tests (committed history,
// clean/dirty worktree, ledger ownership), so it must stay real; what does not need to be real is redoing the
// same ~14 process spawns from scratch for every one of the four tests that need this tree. Build it once
// into a base directory in `before`, and give each test its own on-disk copy via a plain recursive file copy
// (no git spawn involved) - a git repository is just files, and a filesystem clone of one is exactly as real
// a repository as the original. Each test still gets a fully independent, real, mutate-and-commit-able tree.
function buildFixtureContent(root){
  const source=path.join(root,'source'),host=path.join(source,'.claude');
  fs.mkdirSync(host,{recursive:true});
  fs.copyFileSync(new URL('../config.example.yaml',import.meta.url),path.join(host,'config.example.yaml'));
  const owner=path.join(root,'demo-backend'),code=path.join(root,'demo-frontend');
  // The backend owns the one Work tree of the product; the frontend owns no `.starciwork` at all.
  // The lockfile is what the candidate dependency plan binds: `npx vitest` checks declare package tools, and a
  // manifest without a deterministic lockfile is a refused plan, so the candidate never reaches a fake install.
  repository(owner,{name:'@demo/backend',branch:'main',origin:'https://github.com/demo/demo-backend.git',
    seed:{'package-lock.json':'{"name":"@demo/backend","lockfileVersion":3,"requires":true,"packages":{"":{}}}\n'}});
  const work=path.join(owner,'.starciwork');
  const put=(relative,content)=>{const file=path.join(work,relative);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,content);};
  put('workspace.yaml','schema: work/workspace@1\nid: demo\n');
  // The brand every design step reads: a frontend surface is never drawn on a tree that has none.
  put('brand/index.yaml',BRAND);
  put('brand/assets/mascot/rest.png','synthetic-mascot-bytes');
  put('features/sales/ui/index.yaml',UI_RECORD);
  put(`features/sales/implementation/frontend/receipt/index.yaml`,
    node({id:RECEIPT,directory:'app/receipt',files:PAGE,check:'npx vitest run receipt',repository:'demo-frontend'}));
  put(`features/sales/implementation/backend/intake/index.yaml`,
    node({id:INTAKE,directory:'src/sales',files:'src/sales/intake.ts',check:'npx vitest run intake'}));
  git(owner,'add','-A');
  git(owner,'commit','-q','-m','work: author the sales slices');
  // The page already exists as a placeholder: an operation changes tracked code, so the worktree it starts
  // from is the one the design describes, not an empty directory.
  repository(code,{name:'demo-frontend',branch:'session/receipt',origin:'git@github.com:demo/demo-frontend.git',
    seed:{[PAGE]:'export default function Receipt(){return null;}\n',
      'package-lock.json':'{"name":"demo-frontend","lockfileVersion":3,"requires":true,"packages":{"":{}}}\n'}});
  const binding=path.join(source,'.workspaces','projects','demo','work.json');
  fs.mkdirSync(path.dirname(binding),{recursive:true});
  fs.writeFileSync(binding,`${JSON.stringify({schema:'starci/workspace-binding@1',project:'demo',
    repositories:{be:{pathFromSource:'../demo-backend',gitRepository:'https://github.com/demo/demo-backend.git'},
      fe:{pathFromSource:'../demo-frontend',gitRepository:'https://github.com/demo/demo-frontend.git'}},
    work:{ownerRole:'be',pathFromRepository:'.starciwork'}},null,2)}\n`);
}
function handleFor(root){
  const source=path.join(root,'source'),host=path.join(source,'.claude');
  const owner=path.join(root,'demo-backend'),code=path.join(root,'demo-frontend');
  const work=path.join(owner,'.starciwork');
  return {root,source,host,owner,code,work,
    read:id=>parseYaml(fs.readFileSync(path.join(work,'features/sales/implementation',id===RECEIPT?'frontend/receipt':'backend/intake','index.yaml'),'utf8')),
    evidence:(id,opId=id)=>path.join(work,'features/sales/implementation',id===RECEIPT?'frontend/receipt':'backend/intake','evidence',`${opId}-evidence`,'manifest.yaml')};
}
let baseFixtureRoot=null;
before(()=>{
  baseFixtureRoot=fs.mkdtempSync(path.join(os.tmpdir(),'starci-shared-ledger-base-'));
  buildFixtureContent(baseFixtureRoot);
});
after(()=>{if(baseFixtureRoot)fs.rmSync(baseFixtureRoot,{recursive:true,force:true});});
function fixture(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-shared-ledger-'));
  t.after(()=>{assert.equal(path.dirname(root),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(root).startsWith('starci-shared-ledger-'));fs.rmSync(root,{recursive:true,force:true});});
  fs.cpSync(baseFixtureRoot,root,{recursive:true});
  return handleFor(root);
}

/** The critic stands in: every goal is critiqued by the runtime, and a real provider call here would be a different claim. */
const critiqueGoal=()=>({ok:true,verdict:'sound',objections:[],dropped:[],required:[],alternatives:[],question:null,provider:'stub-critic',attempts:[],usage:null});

/** The goal phase of a frontend workflow against the routed tree, stopping before any approval. */
function started(t){
  const fixed=fixture(t);
  assert.equal(detectLedgerMode(fixed.code,null,path.join(fixed.owner,'.starciwork')),'work',
    'the mode follows the resolved tree, not a `.starciwork` the frontend does not have');
  const store=createStore({repoRoot:fixed.owner,id:'20260912-120000-shared-ledger'});
  const state=createWorkflowState({job:'Render the receipt page',worktree:fixed.code,branch:'session/receipt',
    store,host:fixed.host,launcher:'L.mjs',ledgerMode:'work',repoRoot:fixed.code});
  const goal=goalPhase(store,state,{validate:validateWorkTree,cwd:fixed.code,
    critiqueGoal,
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
  // The drawing is the ui node's own op, and its tree paths are located in the owner, because the tree is there.
  assert.deepEqual(run.state.ops.map(op=>[op.id,op.nodeId,op.kind]),[[UI,UI,'interface.draw']]);
  const owner=run.owner.replaceAll('\\','/');
  assert.deepEqual(run.state.ops[0].allowlist,[`${owner}/.starciwork/features/sales/ui/**`,`${owner}/.starciwork/features/sales/ui/index.yaml`]);
  assert.ok(run.state.ops[0].references.includes(`${owner}/.starciwork/features/sales/ui/index.yaml`));
  // The receipt page waits for the drawing: it has a lane, no op yet, and the wait is recorded once.
  assert.deepEqual(run.state.lanes[RECEIPT].lane,['frontend.implement','uat.verify','security.verify','perf.verify']);
  assert.deepEqual(run.store.readEvents().filter(event=>event.event==='lane-waits-design').map(event=>[event.node,event.design]),[[RECEIPT,UI]]);
  assert.deepEqual(run.state.ledger.map(item=>[item.id,item.status]),[[RECEIPT,'planned'],[UI,'planned']],'the held page is still a goal item');
  assert.deepEqual(run.state.needUser,[]);
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
    scripts:{[UI]:[{outcome:'done',summary:'The receipt surface is drawn.',
      files:[`${run.owner.replaceAll('\\','/')}/.starciwork/features/sales/ui/index.yaml`],
      checks:[passing('sales-surfaces-drawn','node starci.mjs validate .starciwork')],
      // The drawing's payload on the ui record and its candidate image, written where the tree is - the owner.
      effect:()=>{
        const record=path.join(run.work,'features/sales/ui/index.yaml');
        fs.appendFileSync(record,UI_PAYLOAD);
        fs.mkdirSync(path.join(path.dirname(record),'assets'),{recursive:true});
        fs.writeFileSync(path.join(path.dirname(record),'assets','receipt-resting.png'),PNG_BYTES);
        fs.writeFileSync(path.join(path.dirname(record),'assets','receipt-resting.prompt.txt'),'Synthetic ImageGen direction fixture.');
      }}],
      [RECEIPT]:[{outcome:'done',summary:'The receipt page renders.',files:[PAGE,
        `${run.owner.replaceAll('\\','/')}/.starciwork/features/sales/implementation/frontend/receipt/assets/receipt-resting.png`,
        `${run.owner.replaceAll('\\','/')}/.starciwork/features/sales/implementation/frontend/receipt/assets/receipt-resting.html`],
      checks:[passing('unit-tests-pass','npx vitest run receipt')],
      // The build writes product code in the frontend and its bounded running-page proof in the owner Work node.
      effect:()=>{fs.writeFileSync(path.join(run.code,PAGE),'export default function Receipt(){return <main>Receipt</main>;}\n');
        const assets=path.join(run.work,'features/sales/implementation/frontend/receipt/assets');fs.mkdirSync(assets,{recursive:true});
        fs.writeFileSync(path.join(assets,'receipt-resting.png'),PNG_BYTES);
        fs.writeFileSync(path.join(assets,'receipt-resting.html'),'<main><section><h2>Receipt</h2><p>Order received.</p></section></main>');}}],
      [`${RECEIPT}-verify`]:[{outcome:'done',summary:'The receipt flow passes on the surface.',files:[],
      checks:[passing('unit-tests-pass','npx vitest run receipt')]}]}});
  const ownerHead=git(run.owner,'rev-parse','HEAD');
  const state=runLoop(orca.orca,run.store,run.state,{cwd:run.code,allocator:fakeAllocator(),template,wait:noWait,
    validate:validateWorkTree,git:spawnSync,exec:command=>({status:0,stdout:`${command} ok`,stderr:''}),
    // The launcher resolves a worktree relative to the process; this workflow is on another drive, so the
    // launch itself is stood in for and everything after it is the kernel's own path.
    launch:(_orca,{operation,scope})=>orca.register(scope??operation),
    // The validator is a runtime like any other here: left real it reaches for a provider that is not in this
    // test, and the walk then stops mid-lane on a `validator-unavailable` that proves nothing about the ledger.
    validateOp:acceptAll,
    decide:()=>{throw Error('decide must not be called on a policy-covered path');},
    waitTimeoutMs:2000,tickMs:1000,maxIterations:10});

  const built=state.ops.find(op=>op.kind==='frontend.implement'),last=state.ops.find(op=>op.kind==='uat.verify');
  assert.deepEqual(state.ops.map(op=>[op.id,op.kind,op.status]),[[UI,'interface.draw','done'],[RECEIPT,'frontend.implement','done'],[`${RECEIPT}-verify`,'uat.verify','done']]);
  // The drawing is recorded done in the owner, with its payload and its candidate beside it.
  assert.equal(parseYaml(fs.readFileSync(path.join(run.work,'features/sales/ui/index.yaml'),'utf8')).state,'done');
  assert.ok(fs.existsSync(path.join(run.work,'features/sales/ui/assets/receipt-resting.png')));
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
  // Two ledger commits in the owner: the drawing's and the receipt's; the receipt's is the owner's head.
  const ledgerCommits=events.filter(event=>event.event==='ledger-commit');
  assert.deepEqual(ledgerCommits.map(event=>event.node),[UI,RECEIPT]);
  const committed=ledgerCommits.at(-1);
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
  git(run.owner,'add','--','.starciwork/features/sales/brief.md');
  const orca=scriptedOrca({reportsDir:run.store.paths.reports,worktree:run.code,scripts:{}});
  const state=runLoop(orca.orca,run.store,run.state,{cwd:run.code,allocator:fakeAllocator(),template,wait:noWait,
    validate:validateWorkTree,git:spawnSync,exec:()=>({status:0,stdout:'',stderr:''}),
    launch:()=>{throw Error('nothing may be launched over a ledger the kernel cannot commit into');},
    maxIterations:4});
  // Not a finish: the kernel steps back and the supervisor tries again once the owner has committed or dropped it.
  assert.equal(state.finished,null);
  assert.match(run.store.readEvents().find(event=>event.event==='preflight-blocked').reason,/shared Work ledger carries uncommitted changes/);
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
    {orca:null,cwd:fixed.code,functions:{assessGoal,critiqueGoal}});
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
  // The drawing is the one op; the receipt page has its lane and waits for it.
  assert.deepEqual(status.workNodes.map(item=>item.node),[UI]);
  assert.deepEqual(Object.keys(status.lanes).sort(),[RECEIPT,UI].sort());
  // The same workflow is reachable by naming the tree outright instead of the host.
  assert.equal(kernelMain('workflow-status',{id:goal.id,'ledger-root':fixed.work},{orca:null,cwd:fixed.code}).dir,goal.dir);
});

test('public retry and pinned enrolled run preserve accepted history while settling frontend source and backend Work roots',async t=>{
  const run=started(t);approve(run.store,run.state);let runtime=null;
  t.after(()=>runtime?.close());
  const accepted=toOp({id:'accepted-before-retry',kind:'backend.implement',goal:'Preserve the already accepted backend contract.',
    allowlist:['src/accepted.ts'],acceptance:['the accepted backend contract remains accepted']},0);
  Object.assign(accepted,{status:'done',attempt:1,head:git(run.code,'rev-parse','HEAD'),files:[],reports:[{outcome:'done',summary:'accepted before shared-root retry'}]});
  run.state.ops.unshift(accepted);run.state.decisions=[{id:'accepted-direction',choice:1,answer:'keep the accepted frontend direction'}];
  const authoredRuntime=stageSealableRuntime(process.cwd(),path.join(run.root,'authored-runtime')),authoredPrefix=slash(authoredRuntime),currentPrefix=slash(process.cwd());let relocatedReferences=0;
  for(const op of run.state.ops)op.references=(op.references??[]).map(reference=>{if(typeof reference!=='string')return reference;const normalized=slash(reference);
    if(!normalized.startsWith(`${currentPrefix}/knowledge/`))return reference;relocatedReferences+=1;return `${authoredPrefix}${normalized.slice(currentPrefix.length)}`;});
  assert.ok(relocatedReferences>0,'the pre-pin operation carries authored runtime provenance before sealing');
  const pin=sealRuntime({sourceRoot:authoredRuntime,buildsRoot:path.join(run.root,'builds'),version:'1.0.0'}),pinFile=path.join(run.root,'accepted-runtime-pin.json'),journalFile=path.join(run.root,'runtime','journal.sqlite');
  assert.equal(pin.sourceRoot,slash(fs.realpathSync(authoredRuntime)));fs.writeFileSync(pinFile,`${JSON.stringify(pin,null,2)}\n`);
  fs.renameSync(authoredRuntime,path.join(run.root,'relocated-authored-runtime'));
  assert.equal(fs.existsSync(authoredRuntime),false,'the original authored runtime is absent before public retry');
  Object.assign(run.state,{approved:true,phase:'run',run:'run-shared-enrolled',from:'term-shared',goalDigest:'f'.repeat(64),
    definitionOfDone:['backend-owned design and evidence are accepted','frontend source is accepted'],head:accepted.head,
    engine:{schema:'starci/engine@1',version:'1.0.0',generation:1,journalFile,journalChosen:true,runtimePin:pin,coordination:'kernel-v0'}});
  run.store.saveState(run.state);openJournal({file:journalFile}).close();
  const stopped=kernelMain('workflow-stop',{id:run.state.id,host:run.host},{orca:{},cwd:run.code});assert.equal(stopped.id,run.state.id);
  const retried=kernelMain('workflow-retry',{id:run.state.id,host:run.host,'runtime-pin':pinFile},{orca:{},cwd:run.code});assert.equal(retried.ok,true);assert.equal(retried.generation,2);
  const afterRetry=run.store.loadState();assert.equal(afterRetry.ops.find(op=>op.id===accepted.id).status,'done');assert.deepEqual(afterRetry.decisions,run.state.decisions);
  const retryReceiptJournal=openJournal({file:journalFile});try{const names=retryReceiptJournal.events({workflowId:run.state.id}).filter(event=>event.generation===2&&event.kind==='runtime-file-written').map(event=>event.payload?.relative);
    for(const name of ['state.json','events.jsonl','stop.flag'])assert.ok(names.includes(name),`public retry receipts ${name}`);
  }finally{retryReceiptJournal.close();}

  const nonce=`shared-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const pinnedKernel=await import(`${pathToFileURL(path.join(pin.root,'.dist','kernel','kernel.mjs')).href}?${nonce}`),
    pinnedEngine=await import(`${pathToFileURL(path.join(pin.root,'.dist','kernel','engine.mjs')).href}?${nonce}`),
    pinnedStoreModule=await import(`${pathToFileURL(path.join(pin.root,'.dist','kernel','store.mjs')).href}?${nonce}`);
  const pinnedStore=pinnedStoreModule.createStore({repoRoot:run.owner,id:run.state.id}),engineState=pinnedStore.loadState(),
    gitAdapter=(executable,args,options={})=>spawnSync(executable,args,{encoding:'utf8',windowsHide:true,...options});
  const foreign=path.join(run.root,'unrelated','knowledge','grammars','index.yaml');fs.mkdirSync(path.dirname(foreign),{recursive:true});fs.writeFileSync(foreign,'schema: grammar/index@1\n');
  const prePinOp=engineState.ops.find(op=>op.kind==='interface.draw');
  assert.throws(()=>pinnedKernel.candidateReferences({...prePinOp,references:[foreign]},engineState,{work:{ledger:{repoRoot:run.owner,workRoot:run.work},loaded:{nodes:new Map(),list:[]}}}),
    /outside the accepted routed roots/,'a real verified pin never grants trust to an unrelated authored suffix');
  runtime=pinnedEngine.createEngineRuntime({store:pinnedStore,state:engineState,git:gitAdapter,candidateBase:path.join(run.root,'candidates'),
    eligibility:()=>({eligible:true,mode:'qualified'}),spawnChild:()=>{throw Error('the fake host owns native execution in this fixture');},
    exec:()=>({status:0,stdout:'dependency install skipped by the fixture',stderr:''})});
  runtime.model=name=>name==='validateOp'?{ok:true,verdict:'accept',summary:'both routed roots satisfy the bounded operation',findings:[],dropped:[],
    provider:'fixture-validator',complete:true,independentFromAttempt:true,freshContext:true,reviewerAttemptId:`validator-${Date.now()}`}:{ok:true,value:{option:'continue'}};
  runtime.manageWorkflow=snapshot=>({schema:'starci/manager-decision@1',workflowId:snapshot.workflowId,generation:snapshot.generation,version:snapshot.version,
    digest:snapshot.digest,decisionId:snapshot.decisionId,basisDigest:snapshot.basisDigest,orderedActionIds:snapshot.actions.map(action=>action.id),rationale:'continue accepted remaining shared-root work'});
  runtime.check=(command,options={})=>({status:0,stdout:`${command} passed`,stderr:'',...options.result});
  runtime.candidateCheck=(command,options={},op)=>runtime.check(command,{...options,cwd:runtime.candidateCwd(op)});
  const candidateRoots=new Map(),writerRows=new Map(),observedReceiptNames=new Set(),settle=runtime.settled.bind(runtime);let activeOp=null,activeJob=null;
  const begin=runtime.beginCandidate.bind(runtime);runtime.beginCandidate=(op,options)=>{if(op.kind==='uat.verify'&&!op.checks?.length)op.checks=[{name:'unit-tests-pass',command:'npx vitest run receipt'}];
    activeOp=op;activeJob=op.lease.jobId;const bridge=begin(op,options);
    candidateRoots.set(op.id,bridge.rootBindings.map(root=>root.id));return bridge;};
  runtime.settled=(op,options={})=>{const result=settle(op,options);for(const event of runtime.journal.events({workflowId:run.state.id}).filter(event=>event.generation===2&&event.kind==='runtime-file-written'))observedReceiptNames.add(event.payload?.relative);
    if(result.ok&&activeJob){const count=runtime.journal.db.prepare("SELECT count(*) AS n FROM leases WHERE job_id=? AND resource_key LIKE 'canonical-writer:%'").get(activeJob).n;
      writerRows.set(`${op.id}:${options.workerOnly===true?'worker':'final'}`,count);}return result;};
  const allocator={maxParallelOps:1,allocate:()=>({ok:true,runtime:'gpt-5.6-sol',target:'gpt-5.6-sol',role:'implement',candidate:{selection:{target:'gpt-5.6-sol',orcaLaunch:{agent:'codex',model:'gpt-5.6-sol'}}}}),
    release(){},failed(){},launched(){},deferred(){},snapshot:()=>({}),serialize:()=>({}),sharedSync:()=>({dropped:[]})};
  let workerLive=false,deliverPending=false,counter=0;const dispatches=new Map();
  const deliver=()=>{const op=activeOp,dispatch=[...dispatches.entries()].find(([,value])=>value.op===op.id)?.[0];let files=[];
    if(op.kind==='interface.draw'){
      const record=path.join(run.work,'features/sales/ui/index.yaml'),assets=path.join(path.dirname(record),'assets');fs.appendFileSync(record,UI_PAYLOAD);fs.mkdirSync(assets,{recursive:true});
      fs.writeFileSync(path.join(assets,'receipt-resting.png'),PNG_BYTES);fs.writeFileSync(path.join(assets,'receipt-resting.prompt.txt'),'Synthetic ImageGen direction fixture.');
      files=[record,path.join(assets,'receipt-resting.png'),path.join(assets,'receipt-resting.prompt.txt')];
    }else if(op.kind==='frontend.implement'){
      fs.writeFileSync(path.join(run.code,PAGE),'export default function Receipt(){return <main>Receipt</main>;}\n');
      const assets=path.join(run.work,'features/sales/implementation/frontend/receipt/assets');fs.mkdirSync(assets,{recursive:true});
      fs.writeFileSync(path.join(assets,'receipt-resting.png'),PNG_BYTES);fs.writeFileSync(path.join(assets,'receipt-resting.html'),'<main><h2>Receipt</h2></main>');
      files=[PAGE,path.join(assets,'receipt-resting.png'),path.join(assets,'receipt-resting.html')];
    }
    const checks=(op.checks??[]).map(check=>({name:check.name,command:check.command,exitCode:0,evidence:'fixture pass'})),report=buildReport({outcome:'done',run:'run-shared-enrolled',task:`task-${op.id}`,dispatch,from:'term-worker',summary:`${op.id} complete`,files,checks});
    fs.writeFileSync(pinnedStore.checksPath(op.id),`${JSON.stringify(checks)}\n`);fs.writeFileSync(pinnedStore.reportPath(dispatch),`${JSON.stringify(report)}\n`);deliverPending=false;};
  const receipt=result=>({outcome:'ok',effectState:'none',receipt:{ok:true,result}}),orca={host:{name:'orca',capabilities:['design-tool'],sequential:false},invoke(name,args={}){
    if(name==='run-show')return receipt({run:{id:'run-shared-enrolled',coordinator_handle:'term-shared'}});
    if(name==='worker-list')return receipt({workers:workerLive?[...dispatches].map(([id,value])=>({dispatchId:id,taskId:value.task,workerState:'unsupervised',dispatchStatus:'dispatched',agentTerminalHandle:'term-worker'})):[]});
    if(name==='terminal-list')return receipt({terminals:workerLive?[{handle:'term-worker',title:`[Op] ${activeOp?.kind} - ${activeOp?.id}`,worktreePath:run.code,status:'running'}]:[]});
    if(name==='task-list')return receipt({tasks:workerLive?[...dispatches.values()].map(value=>({id:value.task,display_name:`[Op] ${value.op}`})):[]});
    if(name==='worker-stop')return receipt({state:'stopped',dispatchId:args.dispatch});if(name==='worker-release'){workerLive=false;return receipt({state:'released',processAction:'none'});}
    if(name==='terminal-close')return receipt({state:'closed'});if(name==='terminal-rename')return receipt({terminal:{handle:'term-worker'}});if(name==='terminal-read')return receipt({terminal:{handle:'term-worker',status:'running',tail:['worker completing shared-root change']}});
    if(name==='check'){if(workerLive&&deliverPending)deliver();return receipt({messages:[]});}if(name==='send')return receipt({message:{id:`msg-${++counter}`}});throw Error(`Unexpected fake Orca call: ${name}`);
  }};
  const guards={protectedPaths:()=>[],revertProtected:()=>({reverted:[],removed:[]}),resourceLocks:()=>[],resourcesClash:()=>false,gitQueue:fn=>fn(),preflight:()=>({ok:true,fixes:[],problems:[]}),parseSharedChangePaths:()=>[]};
  const launch=(_orca,{operation,scope})=>{const dispatch=`ctx-shared-${++counter}`,task=`task-${scope??operation}`;workerLive=true;deliverPending=true;dispatches.clear();dispatches.set(dispatch,{op:scope??operation,task});return {ok:true,effectState:'committed',selection:{target:'gpt-5.6-sol'},task:{id:task},dispatchId:dispatch,terminal:'term-worker'};};
  let clock=Date.now();const now=()=>{clock+=1000;return clock;},wait=ms=>{clock+=Math.max(0,Number(ms)||0);};
  const finished=pinnedKernel.kernelMain('workflow-run',{id:run.state.id,host:run.host,from:'term-shared',run:'run-shared-enrolled','max-iterations':'16'},
    {orca,cwd:run.code,wait,functions:{engineRuntime:runtime,allocator,launch,guards,git:gitAdapter,reconcileInputs:()=>{},refreshPreparation:()=>{},deferPreparation:()=>false,now,wait,waitTimeoutMs:5000,tickMs:1000,pollMs:1000}});
  const final=pinnedStore.loadState(),implemented=final.ops.find(op=>op.kind==='frontend.implement');
  assert.equal(finished.finished?.outcome,'done',JSON.stringify({finished,needUser:final.needUser,ops:final.ops.map(op=>[op.id,op.kind,op.status,op.pending,op.refusal,op.findings,op.checks,op.verifiedChecks]),events:pinnedStore.readEvents().slice(-30)}));
  assert.equal(final.ops.find(op=>op.id===accepted.id).reports[0].summary,'accepted before shared-root retry');assert.deepEqual(final.decisions,run.state.decisions.map(decision=>({...decision,goalRev:1})));
  const drawn=final.ops.find(op=>op.kind==='interface.draw');assert.deepEqual(candidateRoots.get(drawn.id),['source','work','runtime']);
  assert.equal(drawn.candidate.roots.find(root=>root.id==='runtime').acceptedHead.startsWith('content:'),true,'the pinned Grammar canon is an explicit protected content root');
  assert.ok(runtime.candidateBridge(drawn).rootBindings.find(root=>root.id==='runtime').references.some(reference=>reference.sourceRef.includes('/knowledge/grammars/')&&!reference.sourceRef.includes('/.dist/')),
    'the pre-pin drawing retains its authored canon provenance');
  assert.deepEqual(candidateRoots.get(implemented.id),['source','work','runtime']);assert.equal(implemented.candidate?.status,'sealed');
  assert.ok(runtime.candidateBridge(implemented).rootBindings.find(root=>root.id==='runtime').references.some(reference=>reference.sourceRef.includes('/.dist/knowledge/grammars/')),
    'the frontend operation derived by the pinned kernel retains compiled canon');
  assert.equal(writerRows.get(`${implemented.id}:worker`),2);assert.equal(writerRows.get(`${implemented.id}:final`),0);
  for(const op of final.ops.filter(item=>item.status==='done'&&item.id!==accepted.id)){
    assert.ok(observedReceiptNames.has(`contracts/${op.id}.md`),`contract receipt for ${op.id}; found ${JSON.stringify([...observedReceiptNames])}`);
    assert.ok(observedReceiptNames.has(`checks/${op.id}.json`),`worker checks receipt for ${op.id}`);
    assert.ok(observedReceiptNames.has(`checks/${op.id}-kernel.json`),`kernel checks receipt for ${op.id}`);
    assert.ok(observedReceiptNames.has(`reports/${op.launch.dispatch}.json`),`report receipt for ${op.id}`);
  }
  const retainedReceiptNames=new Set(runtime.journal.events({workflowId:run.state.id}).filter(event=>event.kind==='runtime-file-written').map(event=>event.payload?.relative));
  for(const name of observedReceiptNames)assert.ok(retainedReceiptNames.has(name),`normal finish retained latest custody for ${name}`);
  assert.equal(runtime.journal.db.prepare('SELECT count(*) n FROM state_snapshots WHERE workflow_id=?').get(run.state.id).n,1,'normal finish retains one final state projection');
  assert.equal(runtime.journal.db.prepare('SELECT count(*) n FROM jobs WHERE workflow_id=?').get(run.state.id).n,0,'normal finish drops completed operational jobs');
  assert.equal(runtime.journal.db.prepare("SELECT count(*) n FROM events WHERE workflow_id=? AND kind<>'runtime-file-written'").get(run.state.id).n,0,'normal finish drops non-custody journal history');
  assert.equal(fs.existsSync(path.join(run.code,'.starciwork')),false);assert.match(fs.readFileSync(path.join(run.code,PAGE),'utf8'),/Receipt/);
  assert.ok(fs.existsSync(run.evidence(RECEIPT,`${RECEIPT}-verify`)));assert.equal(run.read(RECEIPT).state,'done');
  assert.equal(git(run.code,'status','--porcelain'),'');assert.equal(git(run.owner,'status','--porcelain','--','.starciwork/features'),'');
  const journal=openJournal({file:journalFile});try{assert.deepEqual(journal.liveRows(run.state.id),{leases:[],jobs:[]});}finally{journal.close();}
  runtime.close();runtime=null;
});
