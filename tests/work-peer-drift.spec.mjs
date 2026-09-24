import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from './helpers/fake-orca.mjs';
import {inspectLedger,ledgerFileFor,openLedger} from '../engine/ledger-db.mjs';
import {claimFoundation,writeFoundation} from '../scripts/kernel/foundations.mjs';
import {baselineWorkInputs,inputDrift,peerDriftSummaryOf,recordInputs,staleOperationsOf} from '../scripts/kernel/input-digests.mjs';
import {changeNoteOf,committedMatches,committedReader,createOwnership,ownerDeclarationFor} from '../scripts/kernel/work-ownership.mjs';

// starci-next inc-1c7f7dad53e0 (2026-09-25): three workflows on one ledger - sn-foundation,
// sn-learn-content, sn-subscription - share Work records (challenges, commerce/br/single-subscription,
// the learning-paths foundation contract). Work-input staleness listed a settled job whenever a record
// it read changed from outside its workflow, so each peer rewrite re-staled settled work, the Kernels
// redid it, the redo rewrote records and re-staled the peers: sn-subscription redid its scope 5 times
// and its business seam 6 times, mostly re-verifying unchanged content, often against a file a peer
// had not even committed. The fix: every shared record has ONE owner workflow; a peer's committed
// change is advisory peerDrift; only the OWNER marking it breaking owes ONE follow-up leg; an
// in-flight (uncommitted) rewrite never counts.

const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const F='wf-sn-foundation',L='wf-sn-learn-content',S='wf-sn-subscription',DONE='wf-finished-import';
const SUB='.starciwork/features/commerce/br/single-subscription';
const CH='.starciwork/features/challenges/fr/submit-code-and-evaluate';
const LPC='.starciwork/features/learning-paths/contract/foundation/learner-progress-contract';
const SHARED=[SUB,CH,LPC];
const T0=Date.now()-3600000;
const json=text=>{try{return JSON.parse(text);}catch{return null;}};

const git=(cwd,args)=>{
  const r=spawnSync('git',['-C',cwd,...args],{encoding:'utf8',windowsHide:true,env:{...process.env,
    GIT_AUTHOR_NAME:'spec',GIT_AUTHOR_EMAIL:'spec@example.invalid',GIT_COMMITTER_NAME:'spec',GIT_COMMITTER_EMAIL:'spec@example.invalid'}});
  assert.equal(r.status,0,`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const recordText=(id,rev,kind,body)=>`schema: work/business-rule@1\nid: ${id}\nstatements:\n  - ${body}\nchange:\n  rev: ${rev}\n  kind: ${kind}\n  at: "${new Date().toISOString()}"\n`;
const scopeIndex=(feature,workflow,nodes)=>['schema: work/feature@1',`id: ${feature}`,'extensions:','  work3:','    scope:','      request:',`        workflow: ${workflow}`,'      nodes:',
  ...nodes.flatMap(([id,kind,p])=>[`        - id: ${id}`,`          kind: ${kind}`,`          path: ${p}/index.yaml`]),''].join('\n');

/**
 * The starci-next world: a git product repo whose catalog places commerce, challenges, concepts and
 * learning-paths; sn-subscription's scope record is commerce's, sn-learn-content's is concepts' (it
 * names the challenges records as nodes it authors), sn-foundation's is learning-paths' (it also names
 * single-subscription, as the live one does) and it owns the learner-progress-contract foundation.
 * Every workflow has settled a scope leg and a 3-slice business cut that read all three shared records.
 */
const world=t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-peer-drift-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const repo=path.join(root,'repo');fs.mkdirSync(repo,{recursive:true});
  const work=(rel,text)=>{const file=path.join(repo,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);};
  git(repo,['init','-q']);
  work('.gitignore','.starciwork/runtime.sqlite*\n');
  work('.starciwork/index.yaml',['schema: work/catalog@1','id: starci-next','features:',...['commerce','challenges','concepts','learning-paths'].flatMap(f=>[`  - id: ${f}`,`    directory: features/${f}`]),''].join('\n'));
  work('.starciwork/features/commerce/index.yaml',scopeIndex('commerce',S,[['br.commerce.single-subscription','revision',SUB],['fr.challenges.submit-code-and-evaluate','foundation-dependency',CH]]));
  work('.starciwork/features/concepts/index.yaml',scopeIndex('concepts',L,[['fr.challenges.submit-code-and-evaluate','revision',CH]]));
  work('.starciwork/features/learning-paths/index.yaml',scopeIndex('learning-paths',F,[['br.commerce.single-subscription','business-rule',SUB],['contract.learning-paths.foundation.learner-progress-contract','contract',LPC]]));
  work('.starciwork/features/challenges/index.yaml','schema: work/feature@1\nid: challenges\n');
  work('.starciwork/features/profiles/data/skill-evidence/index.yaml',recordText('data.profiles.skill-evidence',1,'initial','evidence'));
  work(`${SUB}/index.yaml`,recordText('br.commerce.single-subscription',1,'initial','one subscription'));
  work(`${CH}/index.yaml`,recordText('fr.challenges.submit-code-and-evaluate',1,'initial','submit an address'));
  work(`${LPC}/index.yaml`,recordText('contract.learning-paths.foundation.learner-progress-contract',1,'initial','progress events'));
  git(repo,['add','-A']);git(repo,['commit','-q','-m','seed']);
  const orca=path.join(root,'fake-orca.mjs');fs.writeFileSync(orca,FAKE_ORCA);
  const env={...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([orca]),STARCI_FAKE_ORCA_MODE:'healthy',
    STARCI_FAKE_ORCA_LOG:path.join(root,'calls.jsonl'),STARCI_FAKE_ORCA_STATE:path.join(root,'state.json'),LOCALAPPDATA:path.join(root,'localappdata')};
  for(const key of ['ORCA_TERMINAL_HANDLE','STARCI_ROLE','STARCI_OP_JOB','STARCI_CONTRACT_CHANGES'])delete env[key];
  const api=(...args)=>spawnSync(process.execPath,[API,...args,'--repo',repo,'--json'],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});
  const seed=fn=>{const l=openLedger({file:ledgerFileFor(repo)});try{return fn(l);}finally{l.close();}};
  const read=fn=>{const l=inspectLedger({file:ledgerFileFor(repo)});try{return fn(l.db);}finally{l.close();}};
  const settle=(l,{wf,jobId,op,attempt=1,cut=null,owned,records=SHARED,at=T0})=>{
    l.enqueueJob({jobId,workflowId:wf,opId:op,attempt,kind:'op',payload:{opId:op,owned_paths:owned,records,...(cut?{cut}:{}),settledAt:at}});
    l.db.prepare("UPDATE jobs SET status='succeeded',updated_at=? WHERE job_id=?").run(at,jobId);
    const inputs=baselineWorkInputs(recordInputs(ROOT,[],undefined,{repo,workPaths:records}),repo,{now:at});
    l.db.prepare('INSERT INTO contracts(workflow_id,op_id,attempt,dispatch_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?,?)')
      .run(wf,op,attempt,`dispatch-${jobId}`,'# contract',JSON.stringify({packet:{op},worktree:'.',inputs}),at);
  };
  seed(l=>{
    for(const [i,wf] of [F,L,S,DONE].entries()){
      l.ensureWorkflow({workflowId:wf,title:wf,ledgerMode:'durable',sourceRoots:[repo]});
      l.db.prepare("UPDATE workflows SET phase=?,created_at=? WHERE workflow_id=?").run(wf===DONE?'finished':'running',T0-100000+i,wf);
      l.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)').run(wf,1,`goal-${wf}`,'# goal','{}',T0);
    }
    writeFoundation(l.db,claimFoundation(null,{name:'learner-progress-contract',workflowId:F,ownerRunning:false,kind:'contract',now:T0}).record,T0);
    const own={[F]:[LPC],[L]:[CH],[S]:[SUB]};
    for(const wf of [F,L,S]){
      const short=wf.split('-').at(-1);
      settle(l,{wf,jobId:`${short}-scope`,op:'scope.define',owned:[`.starciwork/evidence/${wf}.scope`]});
      for(const ordinal of [1,2,3])settle(l,{wf,jobId:`${short}-business-${ordinal}`,op:'business.decide',attempt:ordinal,cut:{id:`${short}-business-r1`,ordinal,total:3},owned:own[wf]});
    }
  });
  let n=0;
  /** One leg of `wf` that rewrote `files` (settled now, owning them) - a peer's redo following another's record. */
  const rewrite=(wf,edits,{commit=true,status='succeeded'}={})=>{
    for(const [rel,text] of edits)work(`${rel}/index.yaml`,text);
    const at=Date.now()+(n++);
    seed(l=>{
      const jobId=`${wf.split('-').at(-1)}-rewrite-${n}`;
      l.enqueueJob({jobId,workflowId:wf,opId:'business.revise',attempt:n,kind:'op',payload:{opId:'business.revise',owned_paths:edits.map(([rel])=>rel),...(status==='succeeded'?{settledAt:at}:{})}});
      l.db.prepare('UPDATE jobs SET status=?,updated_at=? WHERE job_id=?').run(status,at,jobId);
    });
    if(commit){git(repo,['add','-A']);git(repo,['commit','-q','-m',`${wf} rewrite ${n}`]);}
  };
  const drift=wf=>read(db=>inputDrift(db,wf,{root:ROOT,repo}));
  /** A running leg with no terminal keeps the frontier `engaged`, so its reason is the stale one (tests/stale-input.spec.mjs holdEngaged). */
  const engage=wf=>seed(l=>{l.enqueueJob({jobId:`${wf}-engaged`,workflowId:wf,opId:'docs.author',kind:'op',payload:{opId:'docs.author',owned_paths:['docs/engaged/']}});l.db.prepare("UPDATE jobs SET status='running' WHERE job_id=?").run(`${wf}-engaged`);});
  const status=wf=>{const r=api('status','--workflow',wf);assert.equal(r.status,0,r.stderr||r.stdout);return json(r.stdout);};
  return {repo,work,api,seed,read,settle,rewrite,drift,status,engage};
};

test('ownership: foundation, scope record, scope node, cut, then the repo owner; finished workflows and read-only nodes own nothing',t=>{
  const w=world(t);
  w.read(db=>{
    const ownerOf=createOwnership(db,{repo:w.repo});
    const of=rel=>{const o=ownerOf(rel);return [o.workflowId,o.by];};
    assert.deepEqual(of(`${LPC}/index.yaml`),[F,'foundation'],'a foundation owns the record directory named after it under foundation/');
    assert.deepEqual(of(`${SUB}/index.yaml`),[S,'scope-record'],'the feature scope record beats a peer scope naming the same record as a node');
    assert.deepEqual(of(`${CH}/index.yaml`),[L,'scope-node'],'a node kind foundation-dependency only reads: the authoring scope owns it');
    assert.deepEqual(of('.starciwork/features/profiles/data/skill-evidence/index.yaml'),[F,'repo-owner'],'nothing names it: the repo owner (oldest live workflow here)');
    assert.equal(ownerOf.repoOwner().workflowId,F);
  });
  w.seed(l=>{
    l.enqueueJob({jobId:'l-profiles',workflowId:L,opId:'business.decide',attempt:9,kind:'op',payload:{opId:'business.decide',owned_paths:['.starciwork/features/profiles/data']}});
    l.enqueueJob({jobId:'done-commerce',workflowId:DONE,opId:'business.decide',attempt:9,kind:'op',payload:{opId:'business.decide',owned_paths:['.starciwork/features/profiles']}});
  });
  w.read(db=>assert.deepEqual(createOwnership(db,{repo:w.repo})('.starciwork/features/profiles/data/skill-evidence/index.yaml'),{workflowId:L,by:'cut',detail:'its jobs own it'},'one live workflow\'s jobs own it; a finished workflow\'s never count'));
  w.seed(l=>l.db.prepare("UPDATE workflows SET phase='finished' WHERE workflow_id=?").run(S));
  w.read(db=>assert.deepEqual(createOwnership(db,{repo:w.repo})(`${SUB}/index.yaml`).workflowId,F,'a finished scope owner owns nothing: the next rule (foundation\'s scope node) decides'));
});

test('pieces: change notes, committed matching across line ends, owner declarations by record',()=>{
  assert.deepEqual(changeNoteOf('id: x\nchange:\n  rev: 7\n  kind: breaking\n  at: "2026-09-25T13:30:00Z"\n  withdraws:\n    - rev: 9\nextensions: {}\n'),{rev:7,kind:'breaking',at:Date.parse('2026-09-25T13:30:00Z')});
  assert.equal(changeNoteOf('id: x\n'),null);
  const lf=Buffer.from('a: 1\nb: 2\n');
  const sha=b=>crypto.createHash('sha256').update(b).digest('hex').slice(0,16);
  assert.ok(committedMatches(lf,sha(lf)));
  assert.ok(committedMatches(lf,sha(Buffer.from('a: 1\r\nb: 2\r\n'))),'core.autocrlf: the working tree shows the blob with CRLF');
  assert.ok(!committedMatches(lf,sha(Buffer.from('a: 2\n'))));
  assert.ok(committedMatches(null,null),'absent at HEAD and absent when read');
  const changes=[{record:`${CH}/index.yaml`,history:[{by:L,reach:'advisory',at:5},{by:S,reach:'follow-up',at:9}]},{record:'.starciwork/features/challenges',history:[{by:L,reach:'follow-up',at:7}]}];
  assert.deepEqual(ownerDeclarationFor(changes,`${CH}/index.yaml`,{owner:L,after:1}),{by:L,reach:'follow-up',at:7,record:'.starciwork/features/challenges'},'the newest declaration of the owner covering the file');
  assert.equal(ownerDeclarationFor(changes,`${CH}/index.yaml`,{owner:L,after:7}),null,'only one made after the job read it');
  assert.equal(ownerDeclarationFor(changes,'.starciwork/index.yaml',{owner:L,after:0}),null,'a record file never covers its parent directory');
});

test('3-workflow ping-pong: peers rewriting shared records re-stale nothing; each change is advisory peerDrift, an in-flight rewrite not even that',t=>{
  const w=world(t);
  for(const wf of [F,L,S])assert.deepEqual(w.drift(wf),{stale:[],sourceDrift:[],peerDrift:[]},`${wf}: quiet before any peer rewrite`);

  // Five rounds of the live churn: learn-content and foundation follow each other's records and rewrite
  // single-subscription (the subscription's) to match; the subscription revises its other commerce records
  // (D02 offers); each commits. Before the fix every round re-staled the peers' settled scope and business
  // seams; the Kernels redid them and the redo rewrote the records again.
  const OFFER='.starciwork/features/commerce/data/offer';
  for(let round=2;round<=6;round++){
    w.rewrite(L,[[CH,recordText('fr.challenges.submit-code-and-evaluate',round,'clarifying',`attempt event rev ${round}`)],[SUB,recordText('br.commerce.single-subscription',round,'clarifying',`preview rule from learn-content ${round}`)]]);
    w.rewrite(F,[[LPC,recordText('contract.learning-paths.foundation.learner-progress-contract',round,'clarifying',`progress rev ${round}`)],[SUB,recordText('br.commerce.single-subscription',round,'clarifying',`entitlement basis ${round}`)]]);
    w.rewrite(S,[[OFFER,recordText('data.commerce.offer',round,'clarifying',`price and period ${round}`)]]);
    for(const wf of [F,L,S]){
      const d=w.drift(wf);
      assert.deepEqual(d.stale,[],`round ${round}: ${wf} owes no redo for a peer's rewrite`);
      assert.deepEqual(staleOperationsOf(d.stale),[]);
    }
  }
  const s=w.drift(S),l=w.drift(L),f=w.drift(F);
  assert.deepEqual(peerDriftSummaryOf(s.peerDrift).records.map(r=>[r.file,r.owner,r.writers,r.jobs,r.foreignWrite]),[
    [`${CH}/index.yaml`,L,[L],4,false],
    [`${SUB}/index.yaml`,S,[F,L],1,true],
    [`${LPC}/index.yaml`,F,[F],4,false],
  ],'subscription sees every peer change as advisory drift, and peers writing the record it owns as a foreign write to review');
  assert.deepEqual(peerDriftSummaryOf(l.peerDrift).records.map(r=>[r.file,r.owner]),[[`${LPC}/index.yaml`,F]],'learn-content: its own later legs explain the records they rewrote');
  assert.deepEqual(peerDriftSummaryOf(f.peerDrift).records.map(r=>[r.file,r.owner]),[[`${CH}/index.yaml`,L]]);
  assert.ok(s.peerDrift.every(p=>p.files.every(x=>x.readRev===1)),'judged against the revision each job read (rev 1)');
  assert.ok(s.peerDrift.flatMap(p=>p.files).filter(x=>x.file===`${CH}/index.yaml`).every(x=>x.currentRev===6));

  // An uncommitted rewrite by a running peer leg is in flight: not a change at all.
  const before=JSON.stringify(w.drift(S));
  w.rewrite(L,[[CH,recordText('fr.challenges.submit-code-and-evaluate',99,'breaking','half written')]],{commit:false,status:'running'});
  assert.equal(JSON.stringify(w.drift(S)),before,'an in-flight rewrite, even one marked breaking, changes nothing until it is committed');

  // The frontier: nothing owed, drift advisory.
  w.engage(S);
  const st=w.status(S);
  assert.deepEqual(st.frontier.staleOperations,[]);
  assert.deepEqual(st.staleInput,[]);
  assert.equal(st.frontier.peerDrift.advisory,true);
  assert.equal(st.frontier.peerDrift.jobs,4);
  assert.doesNotMatch(st.frontier.reason??'',/re-dispatch|follow-up leg/);
});

test('a breaking change binds only when its owner makes it: ONE targeted follow-up per dependent job, never a seam-first cascade',t=>{
  const w=world(t);
  // A non-owner marking another workflow's record breaking binds nothing.
  w.rewrite(F,[[SUB,recordText('br.commerce.single-subscription',2,'breaking','foundation withdrew preview wording')]]);
  const l=w.drift(L);
  assert.deepEqual(l.stale,[],'learn-content read the subscription\'s record: a breaking note written by foundation is not the owner\'s');
  assert.ok(l.peerDrift.flatMap(p=>p.files).filter(x=>x.file===`${SUB}/index.yaml`).every(x=>x.breakingIgnored==='written-by-non-owner'));
  assert.deepEqual(w.drift(S).stale,[],'nor does it stale the owner itself: a foreign write, advisory');

  // The owner commits a breaking change: every peer job that read an older revision owes ONE follow-up.
  w.rewrite(L,[[CH,recordText('fr.challenges.submit-code-and-evaluate',3,'breaking','E3 refuses a retired version')]]);
  for(const wf of [S,F]){
    const ops=staleOperationsOf(w.drift(wf).stale);
    const short=wf.split('-').at(-1);
    assert.deepEqual(ops.map(o=>[o.jobId,o.followUp,o.breakingBy,o.heldBy??null]),
      [[`${short}-business-1`,true,[L],null],[`${short}-business-2`,true,[L],null],[`${short}-business-3`,true,[L],null],[`${short}-scope`,true,[L],null]],
      `${wf}: one follow-up per job that read rev 1, none held behind a seam`);
    assert.deepEqual(w.drift(wf).stale[0].breaking,[{file:`${CH}/index.yaml`,owner:L,via:'change-note',rev:3}]);
  }
  assert.deepEqual(w.drift(L).stale,[],'the owner\'s own jobs: its own later leg, never stale');

  w.engage(S);
  const st=w.status(S);
  assert.equal(st.frontier.actionable,true);
  assert.match(st.frontier.reason,/declared its committed change breaking; enqueue ONE follow-up leg for each/);
  assert.doesNotMatch(st.frontier.reason,/seam-first\)/);

  // The follow-up leg: a new attempt of that op and cut ordinal, settled on the owner's revision.
  w.seed(l=>w.settle(l,{wf:S,jobId:'subscription-business-2-follow-up',op:'business.decide',attempt:4,cut:{id:'subscription-business-r1',ordinal:2,total:3},owned:[SUB],at:Date.now()+1000}));
  assert.deepEqual(staleOperationsOf(w.drift(S).stale).map(o=>o.jobId),['subscription-business-1','subscription-business-3','subscription-scope'],'the follow-up supersedes only its own slice');
});

test('api record-change: only the owner declares, only a committed revision; follow-up owes the peers, advisory waives a breaking note',t=>{
  const w=world(t);
  const refused=(args,code)=>{const r=w.api('record-change',...args);assert.equal(r.status,1,r.stdout);const body=json(String(r.stderr).trim().split('\n').at(-1));assert.equal(body?.code,code,r.stderr);return body;};
  refused(['--workflow',S,'--record',CH,'--reach','follow-up','--reason','not mine'],'record-change-not-owner');
  refused(['--workflow',L,'--record',CH,'--reach','sideways','--reason','x'],'record-change-reach-invalid');
  refused(['--workflow',L,'--record','.starciwork/features/nothing','--reach','follow-up','--reason','x'],'record-change-record-missing');

  w.rewrite(L,[[CH,recordText('fr.challenges.submit-code-and-evaluate',2,'clarifying','the score event names the rubric version')]],{commit:false,status:'running'});
  refused(['--workflow',L,'--record',CH,'--reach','follow-up','--reason','x'],'record-change-uncommitted');
  git(w.repo,['add','-A']);git(w.repo,['commit','-q','-m','learn-content rev 2']);
  assert.deepEqual(w.drift(S).stale,[],'a clarifying change by its owner is advisory');

  const r=w.api('record-change','--workflow',L,'--record',CH,'--reach','follow-up','--reason','the score event now names the rubric version; subscription charges per scored attempt');
  assert.equal(r.status,0,r.stderr||r.stdout);
  const out=json(r.stdout);
  assert.deepEqual([out.record,out.reach,out.rev,out.owner.workflowId,out.owner.by],[CH,'follow-up',2,L,'scope-node']);
  assert.deepEqual(out.owes.map(o=>o.jobId).sort(),['foundation-business-1','foundation-business-2','foundation-business-3','foundation-scope','subscription-business-1','subscription-business-2','subscription-business-3','subscription-scope']);
  assert.deepEqual(w.drift(S).stale.map(s=>s.breaking[0].via),['declaration','declaration','declaration','declaration']);
  assert.equal(w.read(db=>db.prepare("SELECT COUNT(*) n FROM events WHERE kind='record-change-declared' AND workflow_id=?").get(L).n),1);

  // The owner commits a note marked breaking but declares it advisory: nothing is owed.
  w.rewrite(S,[[SUB,recordText('br.commerce.single-subscription',2,'breaking','renamed a withdrawn clause, no rule changed')]]);
  assert.ok(w.drift(L).stale.some(s=>s.path===SUB),'precondition: the owner\'s breaking note owes learn-content a follow-up');
  const adv=w.api('record-change','--workflow',S,'--record',`${SUB}/index.yaml`,'--reach','advisory','--reason','editorial in substance');
  assert.equal(adv.status,0,adv.stderr||adv.stdout);
  assert.ok(!w.drift(L).stale.some(s=>s.path===SUB),'the owner waived it');
  assert.ok(w.drift(L).peerDrift.flatMap(p=>p.files).some(x=>x.file===`${SUB}/index.yaml`&&x.breakingIgnored==='owner-declared-advisory'));
});

test('committed revisions: HEAD bytes per record file; a checkout whose HEAD tracks no Work, or no git, reads as the working tree',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-committed-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const tracked=path.join(root,'tracked'),ignored=path.join(root,'ignored'),plain=path.join(root,'plain');
  for(const repo of [tracked,ignored,plain]){fs.mkdirSync(path.join(repo,'.starciwork','x'),{recursive:true});fs.writeFileSync(path.join(repo,'.starciwork','x','index.yaml'),'v: 1\n');}
  for(const repo of [tracked,ignored]){git(repo,['init','-q']);if(repo===ignored)fs.writeFileSync(path.join(repo,'.gitignore'),'.starciwork/\n');fs.writeFileSync(path.join(repo,'README.md'),'x\n');git(repo,['add','-A']);git(repo,['commit','-q','-m','seed']);}
  fs.writeFileSync(path.join(tracked,'.starciwork','x','index.yaml'),'v: 2 in flight\n');
  const heads=committedReader(tracked)(['.starciwork/x/index.yaml','.starciwork/y/index.yaml']);
  assert.deepEqual([...heads].map(([k,v])=>[k,v?.toString('utf8')??null]),[['.starciwork/x/index.yaml','v: 1\n'],['.starciwork/y/index.yaml',null]],'HEAD, not the in-flight working tree');
  assert.equal(committedReader(ignored)(['.starciwork/x/index.yaml']),null,'Work never committed here: the working tree is the only revision');
  assert.equal(committedReader(plain)(['.starciwork/x/index.yaml']),null,'no git checkout');
});
