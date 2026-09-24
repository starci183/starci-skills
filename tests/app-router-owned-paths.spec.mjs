import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from './helpers/fake-orca.mjs';
import {inspectLedger,ledgerFileFor,openLedger,reserveTwoPhase} from '../engine/ledger-db.mjs';
import {isGlobSegment,normalizeOwnedPath,normalizeOwnedPaths,ownedPathLeaseRequests,ownedPathsIntersect,ownedPathspec} from '../engine/admission.mjs';
import {landedProof,ownedPathEffects} from '../scripts/kernel/settle-landed.mjs';
import {resolveReadPath} from '../scripts/kernel/prerequisites.mjs';
import {validateOpReport} from '../scripts/kernel/report-envelope.mjs';
import {withLedger} from './_ledger-fixture.mjs';

// Next.js App Router route segments are literal directory names that look like globs
// (inc-ed9f28ec0561 nivo Modules, inc-e3e7d183c3d5 mia base-repos: interface.scaffold/implement
// could never own src/app/[lang]/…). Each form is carried end to end: admission -> enqueue ->
// dispatch path leases and their overlap -> report files -> the settle landed-check, whose git
// pathspecs must read the name literally (`[id]` as a glob also matches a sibling `i`).
const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const WORKFLOW='wf-app-router';
const OP='code.refactor'; // commitPolicy scoped-local-commit, push false: settle runs the landed-check

// dir: the owned route directory. twin: a sibling a glob reading of the bracket segment also
// matches (null when the form carries no glob meta at all).
const FORMS=[
  {form:'dynamic',dir:'src/app/[lang]',twin:'src/app/l'},
  {form:'dynamic id',dir:'src/app/[workspaceId]',twin:'src/app/w'},
  {form:'catch-all',dir:'src/app/docs/[...slug]',twin:'src/app/docs/s'},
  {form:'optional catch-all',dir:'src/app/shop/[[...opt]]',twin:'src/app/shop/o]'},
  {form:'route group',dir:'src/app/(marketing)/about',twin:null},
  {form:'parallel slot',dir:'src/app/@modal/settings',twin:null},
  {form:'intercepting dynamic',dir:'src/app/@modal/(.)photo/[id]',twin:'src/app/@modal/(.)photo/i'},
  {form:'intercept two levels up',dir:'src/app/feed/@modal/(..)(..)[postId]',twin:'src/app/feed/@modal/(..)(..)p'},
];
const ALL_DIRS=FORMS.map(f=>f.dir);
const pageOf=dir=>`${dir}/page.tsx`;

const gitRaw=(cwd,...args)=>spawnSync('git',['-C',cwd,...args],{encoding:'utf8',windowsHide:true});
const git=(cwd,...args)=>{
  const r=gitRaw(cwd,...args);
  assert.equal(r.status,0,`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const write=(root,rel,body)=>{
  const abs=path.join(root,...rel.split('/'));
  fs.mkdirSync(path.dirname(abs),{recursive:true});
  fs.writeFileSync(abs,body);
};
// A git checkout holding every form's route directory and every twin, all committed clean.
const routeCheckout=(repo)=>{
  fs.mkdirSync(repo,{recursive:true});
  git(repo,'init','--quiet');
  git(repo,'config','user.email','lane@starci.test');
  git(repo,'config','user.name','lane');
  git(repo,'config','core.autocrlf','false');
  git(repo,'checkout','--quiet','-b','main');
  write(repo,'.gitignore','.starciwork/\n');
  for(const {dir,twin} of FORMS){
    write(repo,pageOf(dir),'export default function Page() { return null; }\n');
    if(twin)write(repo,twin,'twin\n');
  }
  git(repo,'add','-A');
  // Dated in the past so a no-effect window opened by a test never counts the fixture commit.
  const past='2020-01-01T00:00:00Z';
  const r=spawnSync('git',['-C',repo,'commit','--quiet','-m','routes'],{encoding:'utf8',windowsHide:true,env:{...process.env,GIT_AUTHOR_DATE:past,GIT_COMMITTER_DATE:past}});
  assert.equal(r.status,0,r.stderr);
};
const tempDir=(t,prefix)=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),prefix));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  return dir;
};

test('every App Router segment form is a concrete owned path; real globs stay refused',()=>{
  for(const {form,dir} of FORMS){
    assert.equal(normalizeOwnedPath(dir),dir,`${form}: ${dir} is a literal prefix`);
    assert.equal(normalizeOwnedPath(`${dir}/**`),dir,`${form}: a trailing /** is the same prefix`);
    assert.equal(normalizeOwnedPath(`.\\${dir.replaceAll('/','\\')}\\`),dir,`${form}: Windows spelling normalizes`);
    assert.equal(normalizeOwnedPath(pageOf(dir)),pageOf(dir));
  }
  for(const glob of ['src/app/*','src/app/[lang]/*','src/app/[lang]/**/page.tsx','src/app/{en,vi}','src/app/pa?e',
    'src/app/[lang','src/app/lang]','src/app/[]','src/app/[a]b','src/app/[l*]','src/app/[[lang]]','src/app/[[...opt]',
    'src/app/[...]','src/app/(.)[a,b]']){
    assert.throws(()=>normalizeOwnedPath(glob),/concrete prefix, not a glob/,`${glob} stays refused`);
  }
  assert.equal(isGlobSegment('[lang]'),false);
  assert.equal(isGlobSegment('(..)(..)[postId]'),false);
  assert.equal(isGlobSegment('*.tsx'),true);
  assert.equal(isGlobSegment('[!a]'),true,'a negated character class is a glob, not a route param name');
  assert.equal(ownedPathspec('src/app/[lang]'),':(literal)src/app/[lang]');
  assert.equal(ownedPathspec('.'),':(literal).');
  assert.equal(ownedPathspec('docs/*'),'docs/*','a legacy real glob keeps the glob reading');
});

test('App Router prefixes dedupe and intersect literally: parent/child overlap, a glob twin never does',()=>{
  assert.deepEqual(normalizeOwnedPaths([...ALL_DIRS.map(pageOf),...ALL_DIRS,'src/app/[lang]/**']),
    [...ALL_DIRS].sort((a,b)=>a.length-b.length||a.localeCompare(b)),'each page collapses into its owned route');
  for(const {form,dir,twin} of FORMS){
    assert.equal(ownedPathsIntersect(dir,pageOf(dir)),true,form);
    assert.equal(ownedPathsIntersect(`${dir}/**`,`${dir}/(group)/child/page.tsx`),true,form);
    if(twin&&!isGlobSegment(twin.split('/').at(-1)))assert.equal(ownedPathsIntersect(dir,twin),false,`${form}: ${twin} is a sibling`);
  }
  assert.deepEqual(ownedPathLeaseRequests(['src/app/[lang]/**','src/app/[lang]/page.tsx']),[{resourceKey:'path:src/app/[lang]',units:1}]);
});

test('durable path leases fence each App Router route against its children, never against a glob twin',t=>withLedger(t,({ledger,machine})=>{
  const seed=keys=>{for(const key of keys)ledger.db.prepare('INSERT OR IGNORE INTO resources(resource_key,capacity) VALUES(?,1)').run(key);};
  const parent=ownedPathLeaseRequests(ALL_DIRS);
  seed(parent.map(l=>l.resourceKey));
  assert.equal(reserveTwoPhase(ledger,machine,{job:{jobId:'routes',workflowId:'wf-routes',opId:'interface.implement',generation:1,kind:'op'},leases:parent}).ok,true);
  FORMS.forEach(({form,dir,twin},i)=>{
    const child=ownedPathLeaseRequests([`${dir}/loading.tsx`]);
    seed(child.map(l=>l.resourceKey));
    const refused=reserveTwoPhase(ledger,machine,{job:{jobId:`child-${i}`,workflowId:`wf-child-${i}`,opId:'interface.scaffold',generation:1,kind:'op'},leases:child});
    assert.equal(refused.ok,false,`${form}: a child of a held route is fenced`);
    const why=[refused.reason,...(refused.reasons??[])].filter(Boolean).join('; ');
    assert.ok(why.includes(`overlaps durable lease path:${dir} held by routes`),`${form}: ${why}`);
    if(!twin||isGlobSegment(twin.split('/').at(-1)))return;
    const sibling=ownedPathLeaseRequests([twin]);
    seed(sibling.map(l=>l.resourceKey));
    const admitted=reserveTwoPhase(ledger,machine,{job:{jobId:`twin-${i}`,workflowId:`wf-twin-${i}`,opId:'interface.scaffold',generation:1,kind:'op'},leases:sibling});
    assert.equal(admitted.ok,true,`${form}: ${twin} runs beside ${dir}: ${admitted.reason}`);
  });
}));

test('landed-check and no-effect proof read App Router owned paths literally, per form',t=>{
  const repo=path.join(tempDir(t,'starci-approuter-landed-'),'work');
  routeCheckout(repo);
  const head=git(repo,'rev-parse','HEAD');
  for(const {form,dir,twin} of FORMS){
    assert.equal(landedProof({base:repo,ownedPaths:[dir],head,branch:'main',pushes:false}).ok,true,`${form}: clean route lands`);
    if(twin){
      write(repo,twin,'dirty twin\n');
      const globbed=gitRaw(repo,'status','--porcelain','--',dir).stdout;
      assert.ok(globbed.includes(twin.split('/').at(-1)),`${form}: precondition - git's glob reading of ${dir} also matches ${twin}`);
      const proof=landedProof({base:repo,ownedPaths:[`${dir}/**`],head,branch:'main',pushes:false});
      assert.equal(proof.ok,true,`${form}: a dirty ${twin} is not under ${dir}: ${JSON.stringify(proof.detail?.dirty)}`);
      git(repo,'checkout','--quiet','--',ownedPathspec(twin));
    }
    write(repo,`${dir}/draft.tsx`,'export {};\n');
    const dirty=landedProof({base:repo,ownedPaths:[dir],head,branch:'main',pushes:false});
    assert.equal(dirty.reason,'not-landed',form);
    assert.deepEqual(dirty.detail.dirty,[`${dir}/draft.tsx`],form);
    assert.deepEqual(dirty.detail.repos[0].paths,[dir],`${form}: the reported path is the plain owned path`);
    fs.rmSync(path.join(repo,...dir.split('/'),'draft.tsx'));
  }
  const since=Date.now()-60000;
  write(repo,'src/app/l','twin edit\n');
  git(repo,'commit','--quiet','-am','twin');
  const untouched=ownedPathEffects({base:repo,ownedPaths:['src/app/[lang]'],sinceMs:since});
  assert.equal(untouched.clean,true,`a commit to src/app/l is no effect on src/app/[lang]: ${JSON.stringify(untouched.commits)}`);
  write(repo,pageOf('src/app/[lang]'),'export default function Page() { return 1; }\n');
  git(repo,'commit','--quiet','-am','lang');
  const touched=ownedPathEffects({base:repo,ownedPaths:['src/app/[lang]'],sinceMs:since});
  assert.equal(touched.commits.length,1,'the commit under src/app/[lang] is an effect');
});

test('prerequisites bind a placeholder to an App Router owned path; report files under it are owned',()=>{
  assert.deepEqual(resolveReadPath('<a>/<b>/<route>/page.tsx',['src/app/[lang]']),['src/app/[lang]/page.tsx']);
  assert.deepEqual(resolveReadPath('<a>/<b>/<c>/<route>/page.tsx',['src/app/@modal/(.)photo/[id]']),[]);
  assert.deepEqual(resolveReadPath('<a>/<b>/<route>/page.tsx',['src/app/*']),[],'a real glob still binds nothing');
  const report=(files,ownedPaths)=>validateOpReport({outcome:'done',summary:'routes',files},{ownedPaths});
  assert.equal(report(ALL_DIRS.map(pageOf),ALL_DIRS).ok,true);
  assert.equal(report(ALL_DIRS.map(pageOf),ALL_DIRS.map(d=>`${d}/**`)).ok,true,'a /** directory grant owns its files');
  const outside=report(['src/app/l/page.tsx'],['src/app/[lang]']);
  assert.equal(outside.ok,false);
  assert.match(outside.reasons.join(';'),/outside owned_paths/);
});

/* ------------------------------------------------ api end to end: enqueue -> dispatch -> settle */

const apiFixture=t=>{
  const root=tempDir(t,'starci-approuter-api-');
  const repo=path.join(root,'repo');
  routeCheckout(repo);
  const stub=path.join(root,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const env={...process.env,
    STARCI_ORCA_COMMAND:process.execPath,
    STARCI_ORCA_ARGS:JSON.stringify([stub]),
    STARCI_FAKE_ORCA_MODE:'healthy',
    STARCI_FAKE_ORCA_LOG:path.join(root,'calls.jsonl'),
    STARCI_FAKE_ORCA_STATE:path.join(root,'state.json'),
    LOCALAPPDATA:path.join(root,'localappdata'),
  };
  const run=(...args)=>spawnSync(process.execPath,[API,...args,'--repo',repo,'--json'],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:180000,env});
  const ledger=openLedger({file:ledgerFileFor(repo)});
  try{
    ledger.ensureWorkflow({workflowId:WORKFLOW,title:'app router routes'});
    ledger.db.prepare("UPDATE workflows SET phase='queued' WHERE workflow_id=?").run(WORKFLOW);
  }finally{ledger.close();}
  const inspect=fn=>{const l=inspectLedger({file:ledgerFileFor(repo)});try{return fn(l.db);}finally{l.close();}};
  return {root,repo,run,inspect};
};
const leading=stdout=>{
  const open=stdout.indexOf('{'),close=stdout.indexOf('\n}');
  return JSON.parse(close<0?stdout.slice(open):stdout.slice(open,close+2));
};

test('api: enqueue -> dispatch leases -> overlap refusal -> report -> landed-check settle, every App Router form',t=>{
  const fx=apiFixture(t);
  const enqueue=paths=>{
    const r=fx.run('enqueue','--workflow',WORKFLOW,'--op',OP,'--paths',paths.join(','));
    assert.equal(r.status,0,r.stderr||r.stdout);
    return leading(r.stdout).job_id;
  };
  const dispatch=jobId=>fx.run('dispatch','--job',jobId,'--model','qwen-agent','--spawn');
  const leases=jobId=>fx.inspect(db=>db.prepare('SELECT resource_key FROM leases WHERE job_id=? ORDER BY resource_key').all(jobId).map(r=>r.resource_key));

  const routes=enqueue(ALL_DIRS.map(d=>`${d}/**`));
  assert.deepEqual(JSON.parse(fx.inspect(db=>db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(routes).payload_json)).owned_paths,
    ALL_DIRS.map(d=>`${d}/**`),'enqueue records the owned spellings verbatim');
  const d1=dispatch(routes);
  assert.equal(d1.status,0,`dispatch of the route owner must pass admission: ${d1.stderr||d1.stdout}`);
  assert.deepEqual(leases(routes),ALL_DIRS.map(d=>`path:${d}`).sort(),'one literal path lease per route');

  const children=enqueue(ALL_DIRS.map(d=>`${d}/loading.tsx`));
  const d2=dispatch(children);
  assert.notEqual(d2.status,0,'a child of every held route is fenced');
  const refusal=`${d2.stdout}${d2.stderr}`;
  for(const {form,dir} of FORMS)assert.ok(refusal.includes(`overlaps durable lease path:${dir} held by ${routes}`),`${form}: ${refusal}`);
  assert.deepEqual(leases(children),[],'a refused dispatch holds nothing');

  const twins=FORMS.map(f=>f.twin).filter(tw=>tw&&!isGlobSegment(tw.split('/').at(-1)));
  const siblings=enqueue(twins);
  const d3=dispatch(siblings);
  assert.equal(d3.status,0,`glob twins are disjoint from the literal routes: ${d3.stderr||d3.stdout}`);

  for(const dir of ALL_DIRS)write(fx.repo,pageOf(dir),`export default function Page() { return ${JSON.stringify(dir)}; }\n`);
  git(fx.repo,'add','-A','--',...ALL_DIRS.map(ownedPathspec));
  git(fx.repo,'commit','--quiet','-m','implement routes');
  const head=git(fx.repo,'rev-parse','HEAD');
  const reportFile=path.join(fx.root,'report.json');
  fs.writeFileSync(reportFile,JSON.stringify({schema:'starci/op-report@1',outcome:'done',summary:'implemented every route form',
    files:ALL_DIRS.map(pageOf),checks:[{name:'self-check',command:'true',exitCode:0}],head,branch:'main'}));
  const filed=fx.run('report','--job',routes,'--report',reportFile);
  assert.equal(filed.status,0,`report files under App Router owned paths: ${filed.stderr||filed.stdout}`);
  const checked=fx.run('check','--job',routes,'--checks',JSON.stringify({checks:[{name:'validator',exitCode:0}]}));
  assert.equal(checked.status,0,checked.stderr||checked.stdout);

  // A dirty twin sits outside every route; a dirty file inside one route is not landed.
  write(fx.repo,'src/app/l','dirty twin\n');
  write(fx.repo,'src/app/@modal/(.)photo/[id]/draft.tsx','export {};\n');
  const refused=fx.run('settle','--job',routes,'--verdict','pass');
  assert.notEqual(refused.status,0,refused.stdout);
  const body=leading(refused.stdout);
  assert.equal(body.reason,'not-landed');
  assert.deepEqual(body.detail.dirty,['src/app/@modal/(.)photo/[id]/draft.tsx'],'only the file inside a route is dirty');
  fs.rmSync(path.join(fx.repo,'src','app','@modal','(.)photo','[id]','draft.tsx'));

  const settled=fx.run('settle','--job',routes,'--verdict','pass');
  assert.equal(settled.status,0,`the landed-check passes with only a glob twin dirty: ${settled.stderr||settled.stdout}`);
  const landed=leading(settled.stdout).landed;
  assert.equal(landed.head,head);
  assert.equal(landed.headCheck,'verified');
  assert.deepEqual([...landed.repos[0].paths].sort(),[...ALL_DIRS].sort());
  assert.equal(fx.inspect(db=>db.prepare('SELECT status FROM jobs WHERE job_id=?').get(routes).status),'succeeded');
  assert.deepEqual(leases(routes),[],'settle releases every route lease');
});
