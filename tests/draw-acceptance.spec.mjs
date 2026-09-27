// interface.draw acceptance judges EVERY asset a pass binds, adopted ones included, and a commit-only adoption never
// stands for a redraw a contract change owes (scripts/checks/draw-acceptance.mjs, scripts/kernel/contract-version.mjs).
// Reproduces nivo wf-nivo-app-auth-mujek72s op-interface.draw-7c2821e002: a commit-only work-debt leg adopted from a
// finished workflow committed 40 image-gen files (whole-screen ui-mockup prompts, an imagegen-provenance evidence
// record) of three pre-token-render draws unchanged, settled pass on 3/3 git checks, and the draw node went green.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inspectLedger,ledgerFileFor,openLedger} from '../engine/ledger-db.mjs';
import {parseYaml} from '../engine/yaml.mjs';
import {sha256} from '../engine/index.mjs';
import {
  DATA_STATUS_DRAWN,DRAW_ACCEPTANCE_CHANGE,DRAW_ASSET_NOT_TOKEN_RENDERED,DRAW_NOT_REDRAWN,DRAW_NOT_SHAPES,RENDER_RECORD_SCHEMA,drawAcceptanceFindings,
} from '../scripts/checks/draw-acceptance.mjs';
import {committedWorkAdmissionOf,contractFollowUpsOf,loadContractChanges} from '../scripts/kernel/contract-version.mjs';
import {colorsFromJobs} from '../scripts/work/work-graph-store.mjs';

const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const json=v=>JSON.stringify(v??null);
const PNG_A=Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da6360000002000154a24f5d0000000049454e44ae426082','hex');
const PNG_B=Buffer.concat([PNG_A,Buffer.from('b')]);
const PNG_C=Buffer.concat([PNG_A,Buffer.from('c')]);
const registry=loadContractChanges(ROOT);
const effectiveOf=id=>{const c=registry.changes.find(x=>x.id===id);assert.ok(c,`${id} is registered`);return c.effectiveAt;};
const codes=r=>[...new Set(r.findings.map(f=>f.code))].sort();
const yaml=o=>JSON.stringify(o,null,2); // JSON is YAML

const tmp=t=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-draw-accept-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25}));return dir;};
const put=(repo,rel,body)=>{const abs=path.join(repo,rel);fs.mkdirSync(path.dirname(abs),{recursive:true});fs.writeFileSync(abs,body);return rel;};
const UI='.starciwork/features/login/ui';
const shapes=[{base:'SignInBase',state:'sign-in-ready',viewports:['desktop','mobile']},{base:'RegisterBase',state:'register-code-refused',viewports:['mobile']}];
const record=(assets,extra={})=>yaml({schema:'work/ui-screen@1',id:'ui.login.authentication',state:'todo',surface:'page',ui:{shapes,...extra},assets});

/** The adopted case: pre-token-render image-gen drawings, whole-screen prompts, an imagegen-provenance audit. */
const adoptedFixture=repo=>{
  put(repo,`${UI}/index.yaml`,record([
    {path:'assets/directions/sign-in-ready--page--desktop--light.content.png',role:'direction-content',generation:{tool:'image_gen.imagegen',promptPath:'assets/directions/sign-in-ready--page--desktop--light.prompt.txt'}},
    {path:'assets/directions/list-loading--page--desktop--light.content.png',role:'direction-content',generation:{tool:'image_gen.imagegen',promptPath:'assets/directions/list-loading--page--desktop--light.prompt.txt'}},
  ]));
  put(repo,`${UI}/assets/directions/sign-in-ready--page--desktop--light.content.png`,PNG_A);
  put(repo,`${UI}/assets/directions/list-loading--page--desktop--light.content.png`,PNG_B);
  const files=[
    put(repo,`${UI}/assets/auth-sign-in-desktop-direction.png`,PNG_C),
    put(repo,`${UI}/assets/auth-sign-in-desktop-direction.prompt.txt`,'Use case: ui-mockup\nAsset type: proposed desktop web-app interface direction\n'),
    put(repo,'.starciwork/features/login/operations/interface-draw-audit/index.yaml',yaml({schema:'work/evidence@1',id:'operation.login.interface-draw-audit',outcome:'pass',
      assertions:[{id:'imagegen-provenance',outcome:'pass'}],
      selectedMatrix:{cells:[{id:'sign-in-ready-desktop-light',screen:'sign-in',state:'sign-in-ready',direction:'../../ui/assets/auth-sign-in-desktop-direction.png'},
        {id:'list-loading',screen:'list',state:'list-loading'}]}})),
  ];
  return files;
};

test('an adopted image-gen draw is refused on every asset it binds, not only the files it wrote',t=>{
  const repo=tmp(t);
  const files=adoptedFixture(repo);
  const verdict=drawAcceptanceFindings({repo,files});
  assert.equal(verdict.ok,false);
  assert.deepEqual(verdict.records,[`${UI}/index.yaml`],'the ui record the adopted assets belong to is judged too');
  assert.deepEqual(codes(verdict),[DATA_STATUS_DRAWN,DRAW_ASSET_NOT_TOKEN_RENDERED,DRAW_NOT_REDRAWN,DRAW_NOT_SHAPES].sort());
  const at=code=>verdict.findings.filter(f=>f.code===code).map(f=>f.path);
  assert.ok(at(DRAW_ASSET_NOT_TOKEN_RENDERED).includes(`${UI}/assets/auth-sign-in-desktop-direction.png`),'the loose whole-screen image with a ui-mockup prompt');
  assert.ok(at(DRAW_ASSET_NOT_TOKEN_RENDERED).includes(`${UI}/assets/directions/sign-in-ready--page--desktop--light.content.png`),'a record drawing it did not write but binds');
  assert.ok(at(DRAW_ASSET_NOT_TOKEN_RENDERED).includes('.starciwork/features/login/operations/interface-draw-audit/index.yaml'),'the imagegen-provenance assertion');
  assert.ok(at(DATA_STATUS_DRAWN).length>=2,'list-loading is drawn by the record and named by the matrix');
  assert.ok(at(DRAW_NOT_SHAPES).includes('.starciwork/features/login/operations/interface-draw-audit/index.yaml'),'a matrix cell naming a screen, not an XBase#state');
});

test('adopting a prior draw is allowed only when it meets the current contract itself',t=>{
  const repo=tmp(t);
  // A content-only part (SignInBase#sign-in-ready) with its render source, a clean score and the owner's accept.
  const part='assets/directions/SignInBase#sign-in-ready--desktop--light.png';
  const html='<!doctype html><main><h1>Sign in</h1><button type="submit">Continue</button></main>';
  put(repo,`${UI}/assets/directions/SignInBase#sign-in-ready--desktop--light.html`,html);
  put(repo,`${UI}/assets/directions/SignInBase#sign-in-ready--desktop--light.score.json`,json({schema:'starci/ui-proof-score@1',ok:true,htmlSha256:sha256(Buffer.from(html)),summary:{pass:12,fail:0,unmeasurable:1},cases:[],spacing:[]}));
  put(repo,`${UI}/index.yaml`,record([
    {path:part,role:'direction-content',breakpoint:'desktop',theme:'light',generation:{tool:'draw-render',promptPath:'assets/directions/SignInBase#sign-in-ready--desktop--light.prompt.txt'}},
    {path:'assets/directions/hero-art.png',role:'raster-region',generation:{tool:'image_gen.imagegen',promptPath:'assets/directions/hero-art.prompt.txt'}},
    {path:'assets/auth-sign-in-desktop-direction.png',role:'direction',retired:'image-gen',generation:{tool:'image_gen.imagegen',promptPath:'assets/auth-sign-in-desktop-direction.prompt.txt'}},
  ],{review:{owner:{decision:'accepted',answeredBy:'owner',dispatchId:'ctx_owner',at:'2026-09-27T09:00:00Z',parts:[{path:part,sha256:sha256(PNG_A)}]}}}));
  const files=[
    put(repo,`${UI}/${part}`,PNG_A),
    put(repo,`${UI}/assets/directions/SignInBase#sign-in-ready--desktop--light.prompt.txt`,'brief with grammar-geometry block\n'),
    put(repo,`${UI}/assets/directions/hero-art.png`,PNG_C),
    put(repo,`${UI}/assets/auth-sign-in-desktop-direction.png`,Buffer.concat([PNG_A,Buffer.from('old')])),
    put(repo,`${UI}/assets/auth-sign-in-desktop-direction.prompt.txt`,'Use case: ui-mockup\n'),
    put(repo,`${UI}/evidence/draws.yaml`,yaml({schema:'work/evidence@1',draws:[{id:'sign-in-ready-desktop-light',shape:'SignInBase#sign-in-ready',state:'sign-in-ready',provenance:{tool:'draw-render'}}]})),
  ];
  const verdict=drawAcceptanceFindings({repo,files});
  assert.deepEqual(verdict.findings,[],'a draw-render content part the owner accepted, a raster region beside it and a retired image-gen file (kept) pass');
  assert.equal(verdict.drawn,true);

  // A loose capture is token-rendered when a starci/draw-render@1 record beside it carries its sha256.
  const loose=put(repo,`${UI}/assets/directions/SignInBase#sign-in-ready--390x844--light.png`,Buffer.concat([PNG_A,Buffer.from('cap')]));
  assert.equal(drawAcceptanceFindings({repo,files:[...files,loose]}).ok,false,'no receipt yet');
  put(repo,`${UI}/assets/directions/SignInBase#sign-in-ready--390x844--light.json`,json({schema:RENDER_RECORD_SCHEMA,ok:true,image:{sha256:sha256(fs.readFileSync(path.join(repo,loose)))}}));
  assert.equal(drawAcceptanceFindings({repo,files:[...files,loose]}).ok,true,'a draw-render receipt of the same bytes');

  // The owner's accept is the only accept: an automatic one leaves the drawing unaccepted.
  const rec=parseYaml(fs.readFileSync(path.join(repo,UI,'index.yaml'),'utf8'));
  rec.ui.review.owner.answeredBy='auto-recommended';
  fs.writeFileSync(path.join(repo,UI,'index.yaml'),yaml(rec));
  assert.deepEqual(codes(drawAcceptanceFindings({repo,files})),['DRAW_NOT_OWNER_ACCEPTED']);
});

// A running interface.draw job with a bound contract, a filed done report and green git checks (the 3/3 of the incident).
const checkout=t=>{
  const repo=tmp(t);
  const git=(...args)=>{const r=spawnSync('git',['-C',repo,...args],{encoding:'utf8',windowsHide:true});assert.equal(r.status,0,`git ${args.join(' ')}: ${r.stderr}`);return r.stdout.trim();};
  git('init','--quiet','-b','main');git('config','user.email','lane@starci.test');git('config','user.name','lane');git('config','core.autocrlf','false');
  put(repo,'src/a.ts','export const a = 1;\n');put(repo,'.gitignore','.starciwork/\n');
  git('add','.');git('commit','--quiet','-m','init');
  return repo;
};
const seedDraw=(repo,{jobId,wf='wf-draw',files,admittedAt,payload={}})=>{
  const ledger=openLedger({file:ledgerFileFor(repo)});
  try{
    ledger.ensureWorkflow({workflowId:wf,title:'draw'});
    ledger.enqueueJob({jobId,workflowId:wf,opId:'interface.draw',kind:'op',payload:{opId:'interface.draw',owned_paths:['src/'],orca:{dispatchId:`ctx-${jobId}`,agentTerminalHandle:`term-${jobId}`},...payload}});
    ledger.db.prepare("UPDATE jobs SET status='running' WHERE job_id=?").run(jobId);
    ledger.db.prepare('INSERT INTO contracts(workflow_id,op_id,attempt,dispatch_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?,?)')
      .run(wf,'interface.draw',1,`ctx-${jobId}`,'# contract',json({worktree:repo}),admittedAt);
    ledger.db.prepare('INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,from_terminal,consumed_at,created_at) VALUES(?,?,?,?,?,?,?,?,NULL,?)')
      .run(wf,`ctx-${jobId}`,'interface.draw',1,0,'done',json({outcome:'done',summary:'adopted 40 inherited interface.draw evidence files unchanged',files}),null,Date.now());
    ledger.db.prepare('INSERT INTO checks(workflow_id,op_id,attempt,checks_json,created_at) VALUES(?,?,?,?,?)').run(wf,'interface.draw',1,
      json({checks:[{name:'owned-paths-committed',command:'git show',exitCode:0},{name:'owned-paths-clean',command:'git status',exitCode:0},{name:'head-ancestor',command:'git merge-base',exitCode:0}]}),Date.now());
  }finally{ledger.close();}
  return jobId;
};
const settle=(repo,jobId)=>{const r=spawnSync(process.execPath,[API,'settle','--repo',repo,'--job',jobId,'--verdict','pass','--json'],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000});let body=null;try{body=JSON.parse(r.stdout);}catch{}return {r,body};};
const statusOf=(repo,jobId)=>{const l=inspectLedger({file:ledgerFileFor(repo)});try{return l.db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId).status;}finally{l.close();}};

test('api settle refuses an adopting interface.draw pass draw-not-accepted; a leg admitted before the change settles as admitted',t=>{
  const repo=checkout(t);
  const files=adoptedFixture(repo);
  const at=effectiveOf(DRAW_ACCEPTANCE_CHANGE);
  const jobId=seedDraw(repo,{jobId:'op-interface.draw-adopt',files,admittedAt:at+1000});
  const refused=settle(repo,jobId);
  assert.equal(refused.r.status,1,refused.r.stdout||refused.r.stderr);
  assert.equal(refused.body.reason,'draw-not-accepted');
  assert.ok(refused.body.codes.includes(DRAW_ASSET_NOT_TOKEN_RENDERED));
  assert.ok(refused.body.codes.includes(DRAW_NOT_REDRAWN));
  assert.equal(statusOf(repo,jobId),'running','a refused settle writes nothing');
  const legacy=seedDraw(repo,{jobId:'op-interface.draw-old',wf:'wf-draw-old',files,admittedAt:at-1000});
  const old=settle(repo,legacy);
  assert.equal(old.r.status,0,old.r.stderr||old.r.stdout);
});

// Ledger fixture for the follow-up rule: a finished workflow's pre-contract draws, adopted by a live one's commit-only leg.
const followUpWorld=t=>{
  const repo=tmp(t);
  const redo=effectiveOf('draw-redo-token-render-shapes');
  const ledger=openLedger({file:ledgerFileFor(repo)});
  const job=(wf,jobId,{attempt=1,status='succeeded',admittedAt,payload={}})=>{
    ledger.enqueueJob({jobId,workflowId:wf,opId:'interface.draw',kind:'op',payload:{opId:'interface.draw',owned_paths:[`${UI}/assets`],...payload}});
    ledger.db.prepare('UPDATE jobs SET status=?, attempt=? WHERE job_id=?').run(status,attempt,jobId);
    if(admittedAt!=null)ledger.db.prepare('INSERT INTO contracts(workflow_id,op_id,attempt,dispatch_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?,?)').run(wf,'interface.draw',attempt,`ctx-${jobId}`,'#',json({}),admittedAt);
  };
  ledger.ensureWorkflow({workflowId:'wf-old',title:'old'});
  ledger.ensureWorkflow({workflowId:'wf-live',title:'live'});
  ledger.db.prepare("UPDATE workflows SET phase='running' WHERE workflow_id='wf-live'").run();
  ledger.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)')
    .run('wf-live',0,'g0','# goal',json({derivedPlan:{legs:[{op:'interface.draw'}]}}),Date.now());
  const day=24*3600*1000;
  job('wf-old','op-draw-old-2',{attempt:2,admittedAt:redo-6*day});
  job('wf-old','op-draw-old-6',{attempt:6,admittedAt:redo-4*day});
  job('wf-live','op-draw-adopt',{admittedAt:redo+3600*1000,payload:{commitOnly:{of:['op-draw-old-2','op-draw-old-6'],batch:'work-debt',adoptedFrom:'wf-old',outOfScope:0}}});
  return {repo,ledger,job,redo};
};

test('a commit-only adoption of pre-contract draws still owes the redo follow-up; only a real follow-up leg satisfies it',t=>{
  const {repo,ledger,job,redo}=followUpWorld(t);
  try{
    const adopt=ledger.db.prepare("SELECT * FROM jobs WHERE job_id='op-draw-adopt'").get();
    assert.ok(committedWorkAdmissionOf(ledger.db,{...adopt,payload:JSON.parse(adopt.payload_json)}).at<redo,'its work carries the admission of the draws it committed');
    const owedItems=()=>contractFollowUpsOf(ledger.db,'wf-live',registry).owed.filter(o=>o.followUpOp==='interface.draw');
    const owed=()=>owedItems().map(o=>o.jobId);
    assert.deepEqual(owed(),['op-draw-adopt'],'admitted after the change, yet it drew nothing: the redo is owed');
    const item=owedItems()[0];
    assert.ok([item.change,...(item.alsoCovers??[])].includes('draw-redo-token-render-shapes'),'one follow-up, under the newest draw change, covers the redo');

    job('wf-live','op-draw-adopt-again',{attempt:2,admittedAt:redo+7200*1000,payload:{commitOnly:{of:['op-draw-adopt']},contractChange:{id:'draw-redo-token-render-shapes',followUpOf:'op-draw-adopt'}}});
    assert.equal(owed().length,1,'a commit-only leg marked as the follow-up does not satisfy it');
  }finally{ledger.close();}

  const r=spawnSync(process.execPath,[API,'status','--repo',repo,'--workflow','wf-live','--json'],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000});
  assert.equal(r.status,0,r.stderr);
  const s=JSON.parse(r.stdout);
  assert.equal(s.frontier.actionable,true);
  assert.equal(s.frontier.contractFollowUps.filter(f=>f.followUpOp==='interface.draw').length,1,'one follow-up per leg, however many draw changes owe it');
  assert.equal(s.legs.find(l=>l.op==='interface.draw').color,'red','a leg owed a redo is rework, never green');
  const action=s.nextActions.find(a=>a.kind==='dispatch'&&a.change);
  assert.ok(action,'nextActions names the follow-up enqueue');
  assert.match(action.reason,new RegExp(`--contract-change ${action.change} --follow-up-of op-draw-adopt`));

  const l2=openLedger({file:ledgerFileFor(repo)});
  try{
    const newest=registry.changes.filter(c=>c.reach==='follow-up'&&c.followUp.op==='interface.draw').sort((a,b)=>b.effectiveAt-a.effectiveAt)[0].id;
    l2.enqueueJob({jobId:'op-draw-redo',workflowId:'wf-live',opId:'interface.draw',kind:'op',payload:{opId:'interface.draw',owned_paths:[`${UI}/assets`],contractChange:{id:newest,followUpOf:'op-draw-adopt-again'}}});
    l2.db.prepare("UPDATE jobs SET attempt=3 WHERE job_id='op-draw-redo'").run();
    assert.deepEqual(contractFollowUpsOf(l2.db,'wf-live',registry).owed.filter(o=>o.followUpOp==='interface.draw'),[],'a real redraw leg under the newest draw change is the follow-up for every older one');
  }finally{l2.close();}
});

test('a succeeded leg owed a follow-up colours its work-graph nodes as rework',()=>{
  const graph={nodes:[{id:'login.foundation',domain:'login',slice:'login.foundation',kind:'foundation',ownedPaths:[`${UI}/assets`]}]};
  const jobs=[{jobId:'op-draw-adopt',op:'interface.draw',status:'succeeded',at:1,paths:[`${UI}/assets`.toLowerCase()]}];
  assert.equal(colorsFromJobs(graph,jobs)['login.foundation'],'green');
  const rework=jobs.map(j=>(j.jobId==='op-draw-adopt'?{...j,status:'failed'}:j));
  assert.equal(colorsFromJobs(graph,rework)['login.foundation'],'red');
  assert.ok(parseYaml(fs.readFileSync(path.join(ROOT,'modules','schemas','work-ui-screen.schema.yaml'),'utf8')).$defs,'schema parses');
});
