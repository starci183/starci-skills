// interface.draw acceptance judges EVERY asset a pass binds, adopted ones included (scripts/work/draw/draw-acceptance.mjs).
// Reproduces nivo wf-nivo-app-auth-mujek72s op-interface.draw-7c2821e002: a leg adopted from a
// finished workflow committed 40 image-gen files (whole-screen ui-mockup prompts, an imagegen-provenance evidence
// record) of three pre-token-render draws unchanged, settled pass on 3/3 git checks, and the draw node went green.
import test from 'node:test';
import { putBundle } from '../../engine/db/blob.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileReport,inspectLedger,ledgerFileFor,openLedger,recordCheckRun,writeContract} from '../../engine/db/ledger.mjs';
import {parseYaml} from '../../engine/yaml.mjs';
import {sha256} from '../../engine/digest.mjs';
import {
  DATA_STATUS_DRAWN,DRAW_ACCEPTANCE_CHANGE,DRAW_ASSET_NOT_TOKEN_RENDERED,DRAW_NOT_REDRAWN,DRAW_NOT_SHAPES,RENDER_RECORD_SCHEMA,drawAcceptanceFindings,
} from '../../scripts/work/draw/draw-acceptance.mjs';
import {colorsFromJobs} from '../../scripts/work/work-graph-store.mjs';
import { withRationale } from '../helpers/draw-rationale-fixture.mjs';
import { seedWorkflow } from '../helpers/ledger-fixture.mjs';

const ROOT=path.resolve(import.meta.dirname,'..', '..');
const API=path.join(ROOT,'scripts','kernel','cli.mjs');
const json=v=>JSON.stringify(v??null);
const PNG_A=Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da6360000002000154a24f5d0000000049454e44ae426082','hex');
const PNG_B=Buffer.concat([PNG_A,Buffer.from('b')]);
const PNG_C=Buffer.concat([PNG_A,Buffer.from('c')]);

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
  // DNA-mapped (draw-dna.mjs) and installed by the draw loop (generation.loop, draw-loop-coverage.mjs).
  // With its decision evidence (draw-rationale.mjs): data-why, rationale.json, the measured render record, the redline.
  const why=withRationale('<!doctype html><body><main data-grammar-component="PageContainer"><h1 data-grammar-component="Heading">Sign in</h1><button type="submit" data-grammar-component="Button">Continue</button></main></body>');
  const html=why.html;
  put(repo,`${UI}/assets/directions/SignInBase#sign-in-ready--desktop--light.rationale.json`,json(why.entries));
  put(repo,`${UI}/assets/directions/SignInBase#sign-in-ready--desktop--light.json`,json({schema:'starci/draw-render@1',ok:true,viewport:{width:1280,height:800},image:{sha256:sha256(PNG_A)},rationale:why.measure({width:1280,height:800})}));
  put(repo,`${UI}/assets/directions/SignInBase#sign-in-ready--desktop--light.redline.png`,PNG_A);
  const loopRel='assets/directions/draw-loop/SignInBase--sign-in-ready/loop.json';
  put(repo,`${UI}/${loopRel}`,json({schema:'starci/draw-loop@1',base:'SignInBase',state:'sign-in-ready',rounds:[{n:1}],best:1,outcome:'passed',installed:[{path:part,sha256:sha256(PNG_A)}]}));
  put(repo,`${UI}/assets/directions/SignInBase#sign-in-ready--desktop--light.html`,html);
  put(repo,`${UI}/assets/directions/SignInBase#sign-in-ready--desktop--light.score.json`,json({schema:'starci/ui-proof-score@1',ok:true,htmlSha256:sha256(Buffer.from(html)),summary:{pass:12,fail:0,unmeasurable:1},cases:[],spacing:[]}));
  put(repo,`${UI}/index.yaml`,record([
    {path:part,role:'direction-content',breakpoint:'desktop',theme:'light',generation:{tool:'draw-render',promptPath:'assets/directions/SignInBase#sign-in-ready--desktop--light.prompt.txt',mode:'draw-loop',loop:{sha256:putBundle(path.dirname(path.join(repo,UI,loopRel))),round:1}}},
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
  put(repo,'src/a.ts','export const a = 1;\n');fs.appendFileSync(path.join(repo,'.git','info','exclude'),'.starciwork/\n');
  git('add','.');git('commit','--quiet','-m','init');
  return repo;
};
const seedDraw=(repo,{jobId,wf='wf-draw',files,admittedAt,payload={}})=>{
  const ledger=openLedger({file:ledgerFileFor(repo)});
  try{
    seedWorkflow(ledger,{id:wf,state:{phase:'running',job:'draw'},
      jobs:[{jobId,opId:'interface.draw',dispatchId:`ctx-${jobId}`,terminalHandle:`term-${jobId}`,status:'running',
        payload:{opId:'interface.draw',owned_paths:['src/'],orca:{dispatchId:`ctx-${jobId}`,agentTerminalHandle:`term-${jobId}`},...payload}}]});
    const attemptId=ledger.db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=?').get(jobId).attempt_id;
    ledger.transaction(db=>{
      writeContract(db,{attemptId,markdown:'# contract',context:{worktree:repo},createdAt:admittedAt});
      fileReport(db,{attemptId,outcome:'done',createdAt:Date.now(),
        report:{schema:'starci/op-report@1',outcome:'done',summary:'adopted 40 inherited interface.draw evidence files unchanged',files,head:spawnSync('git',['-C',repo,'rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).stdout.trim()}});
      for(const check of [{name:'owned-paths-committed',command:'git show'},{name:'owned-paths-clean',command:'git status'},{name:'head-ancestor',command:'git merge-base'}])
        recordCheckRun(db,{attemptId,name:check.name,phase:'verify',runner:'kernel',authority:'runtime',status:'pass',exitCode:0,command:check.command});
    });
  }finally{ledger.close();}
  return jobId;
};
const settle=(repo,jobId,env)=>{const r=spawnSync(process.execPath,[API,'settle','--repo',repo,'--job',jobId,'--verdict','pass','--json'],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});let body=null;try{body=JSON.parse(r.stdout);}catch{}return {r,body};};
const statusOf=(repo,jobId)=>{const l=inspectLedger({file:ledgerFileFor(repo)});try{return l.db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId).status;}finally{l.close();}};

test('api settle refuses an adopting interface.draw pass draw-not-accepted; a leg admitted before the change settles as admitted',t=>{
  const repo=checkout(t);
  const files=adoptedFixture(repo);
  // draw-adopt-gate (and draw-loop-dna, whose settle gate the same legs cross) predate the alpha.3 release
  // base and were deleted by the release-line compaction; a fixture registry keeps them for this boundary.
  const at=Date.parse('2026-09-27T15:20:00+07:00');
  const changesDir=path.join(ROOT,'modules','kernel','contract-changes');
  const changes=fs.readdirSync(changesDir).filter(f=>f.endsWith('.yaml')).map(f=>parseYaml(fs.readFileSync(path.join(changesDir,f),'utf8')));
  changes.push({id:DRAW_ACCEPTANCE_CHANGE,effectiveAt:'2026-09-27T15:20:00+07:00',reach:'new-legs',ops:['interface.draw'],
    adds:{codes:[DRAW_ASSET_NOT_TOKEN_RENDERED,DRAW_NOT_SHAPES,DRAW_NOT_REDRAWN]},summary:'spec fixture for the compacted draw-adopt-gate entry'},
    {id:'draw-loop-dna',effectiveAt:'2026-09-27T18:20:00+07:00',reach:'follow-up',ops:['interface.draw'],followUp:{op:'interface.draw',ops:['interface.draw']},summary:'spec fixture for the compacted draw-loop-dna entry'});
  const changesFile=path.join(tmp(t),'contract-changes.yaml');
  fs.writeFileSync(changesFile,yaml({schema:'starci/contract-changes@1',changes}));
  const env={...process.env,STARCI_CONTRACT_CHANGES:changesFile};
  const jobId=seedDraw(repo,{jobId:'op-interface.draw-adopt',files,admittedAt:at+1000});
  const refused=settle(repo,jobId,env);
  assert.equal(refused.r.status,1,refused.r.stdout||refused.r.stderr);
  assert.equal(refused.body.reason,'draw-not-accepted');
  assert.ok(refused.body.codes.includes(DRAW_ASSET_NOT_TOKEN_RENDERED));
  assert.ok(refused.body.codes.includes(DRAW_NOT_REDRAWN));
  assert.equal(statusOf(repo,jobId),'running','a refused settle writes nothing');
  const legacy=seedDraw(repo,{jobId:'op-interface.draw-old',wf:'wf-draw-old',files,admittedAt:at-1000});
  const old=settle(repo,legacy,env);
  assert.equal(old.r.status,0,old.r.stderr||old.r.stdout);
});

test('a succeeded leg owed a follow-up colours its work-graph nodes as rework',()=>{
  const graph={nodes:[{id:'login.foundation',domain:'login',slice:'login.foundation',kind:'foundation',ownedPaths:[`${UI}/assets`]}]};
  const jobs=[{jobId:'op-draw-adopt',op:'interface.draw',status:'succeeded',at:1,paths:[`${UI}/assets`.toLowerCase()]}];
  assert.equal(colorsFromJobs(graph,jobs)['login.foundation'],'green');
  const rework=jobs.map(j=>(j.jobId==='op-draw-adopt'?{...j,status:'failed'}:j));
  assert.equal(colorsFromJobs(graph,rework)['login.foundation'],'red');
  assert.ok(parseYaml(fs.readFileSync(path.join(ROOT,'modules','schemas','work-ui-screen.schema.yaml'),'utf8')).$defs,'schema parses');
});

// nivo op-interface.draw-b7500b11bb (46 false findings): an image of a NESTED ui record was judged against its parent
// record, which does not bind it. nivo op-interface.draw-3cd517a152 (40 findings on 20 documents): evidence found by
// walking an owned directory - an older run's evidence, a draw loop's round-<n>/ - was judged as if this pass claimed it.
test('an image belongs to its nearest ui record; walked evidence counts only when the pass names it or the record binds it',t=>{
  const repo=tmp(t);
  const parent='.starciwork/features/im/ui/owned-shell', child=`${parent}/module-ledger`;
  const part='assets/directions/LedgerBase#ready--1184x900--light.png';
  put(repo,`${parent}/index.yaml`,yaml({schema:'work/ui-screen@1',id:'ui.im.owned-shell',state:'todo',surface:'layout',ui:{shapes:[]},assets:[]}));
  put(repo,`${child}/index.yaml`,record([{path:part,role:'direction-content',breakpoint:'desktop',theme:'light',generation:{tool:'draw-render'}}],{shapes:[{base:'LedgerBase',state:'ready',viewports:['desktop']}]}));
  put(repo,`${child}/${part}`,PNG_A);
  const stale={schema:'work/evidence@1',assertions:[{id:'imagegen-provenance',outcome:'pass'}],draws:[{id:'x',state:'list-loading',screen:'list'}]};
  put(repo,`${child}/evidence/draw-20260923/draws.yaml`,yaml(stale));
  put(repo,`${child}/assets/directions/draw-loop/LedgerBase--ready/round-1/draws.json`,json(stale));
  const verdict=drawAcceptanceFindings({repo,files:[parent]});
  const paths=verdict.findings.map(f=>f.path??'');
  assert.ok(!verdict.findings.some(f=>f.code===DRAW_ASSET_NOT_TOKEN_RENDERED&&f.path.endsWith('.png')),`the child's draw-render part is the child record's, token-rendered: ${JSON.stringify(verdict.findings)}`);
  assert.ok(!paths.some(p=>p.includes('/evidence/draw-20260923/')||p.includes('/round-1/')),'walked, unbound evidence is a kept proof');
  // Named by the pass (a report file), the same stale evidence is judged.
  const named=drawAcceptanceFindings({repo,files:[parent,`${child}/evidence/draw-20260923/draws.yaml`]});
  assert.ok(named.findings.some(f=>f.path===`${child}/evidence/draw-20260923/draws.yaml`&&f.code===DRAW_ASSET_NOT_TOKEN_RENDERED));
});
