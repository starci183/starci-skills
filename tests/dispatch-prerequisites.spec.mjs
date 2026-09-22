import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from './helpers/fake-orca.mjs';
import {openLedger,inspectLedger,ledgerFileFor} from '../engine/ledger-db.mjs';
import {parseYaml} from '../engine/yaml.mjs';
import {checkPrerequisites,prerequisiteDetail,resolveReadPath} from '../scripts/kernel/prerequisites.mjs';

// api dispatch refuses `prerequisite-unmet` from data only: a manifest read
// marked mustExist that the job binding resolves but the repository lacks, and
// bound records whose dependsOn is not done where graphPolicy wants done.
// Unknown is never unmet.
const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const AUDIT=parseYaml(fs.readFileSync(path.join(ROOT,'modules','ops','ops','interface.audit.yaml'),'utf8'));
const TARGET='.starciwork/features/<feature>/operations/<audit>/index.yaml';

const tmpRepo=t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-prereq-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  return dir;
};
const write=(repo,rel,text)=>{fs.mkdirSync(path.dirname(path.join(repo,rel)),{recursive:true});fs.writeFileSync(path.join(repo,rel),text);};

test('interface.audit declares its target operation record mustExist',()=>{
  const target=AUDIT.reads.find(r=>r.id==='target');
  assert.equal(target.path,TARGET);
  assert.equal(target.mustExist,true);
  assert.equal(AUDIT.graphPolicy.prerequisiteState,'done');
});

test('a read path resolves only when one binding spells out every placeholder',()=>{
  assert.deepEqual(resolveReadPath(TARGET,['.starciwork/features/wspv/operations/audit-pay','.starciwork/kernel-evidence/x']),
    ['.starciwork/features/wspv/operations/audit-pay/index.yaml']);
  assert.deepEqual(resolveReadPath(TARGET,['.starciwork/features/wspv/operations/audit-pay/**']),
    ['.starciwork/features/wspv/operations/audit-pay/index.yaml'],'a /** owned prefix is the same directory');
  assert.deepEqual(resolveReadPath(TARGET,['.starciwork/features/login/operations','.starciwork/features/login']),[],
    'a binding that stops at the feature leaves <audit> unresolved: unknown, not unmet');
  assert.deepEqual(resolveReadPath('.starciwork/features/<feature>/{ui,business}/**/index.yaml',['.starciwork/features/a']),[],
    'a glob path is never resolved');
});

test('a missing mustExist record is unmet; a present one and an unresolved one admit',t=>{
  const repo=tmpRepo(t);
  const brief={reads:AUDIT.reads,graphPolicy:{prerequisiteState:'done'}};
  const missing=checkPrerequisites({brief,repo,payload:{records:['.starciwork/features/wspv'],owned_paths:['.starciwork/features/wspv/operations/audit-pay']}});
  assert.deepEqual(missing.unmet,[{kind:'record-missing',read:'target',path:'.starciwork/features/wspv/operations/audit-pay/index.yaml'}]);
  assert.match(prerequisiteDetail({op:'interface.audit',jobId:'job-1',unmet:missing.unmet}),
    /reads \.starciwork\/features\/wspv\/operations\/audit-pay\/index\.yaml \(reads\.target, mustExist\).*api dispatch --job job-1 again.*stays queued/);

  write(repo,'.starciwork/features/wspv/operations/audit-pay/index.yaml','schema: work/node@1\n');
  assert.deepEqual(checkPrerequisites({brief,repo,payload:{owned_paths:['.starciwork/features/wspv/operations/audit-pay']}}).unmet,[]);

  const unbound=checkPrerequisites({brief,repo,payload:{owned_paths:['.starciwork/features/login/operations']}});
  assert.deepEqual(unbound.unmet,[]);
  assert.equal(unbound.unknown[0].kind,'read-unbound');
});

test('bound records with not-done dependsOn are unmet only when the traversal can decide the state',t=>{
  const repo=tmpRepo(t);
  const brief={reads:[],graphPolicy:{prerequisiteState:'done'}};
  write(repo,'.starciwork/features/f/impl/index.yaml','id: impl\ndependsOn: [arch, biz]\n');
  write(repo,'.starciwork/features/f/plain/index.yaml','id: plain\n');
  let traversals=0;
  const validate=()=>{traversals++;return {nodes:[
    {id:'impl',path:'features/f/impl/index.yaml',effectiveState:'todo',dependsOn:['arch','biz']},
    {id:'arch',path:'features/f/arch/index.yaml',effectiveState:'todo',dependsOn:[]},
    {id:'biz',path:'features/f/biz/index.yaml',effectiveState:'done',dependsOn:[]},
  ]};};
  const r=checkPrerequisites({brief,repo,validate,payload:{records:['.starciwork/features/f/impl']}});
  assert.deepEqual(r.unmet,[{kind:'dependency-not-done',record:'.starciwork/features/f/impl',dependsOn:[{id:'arch',state:'todo'}]}]);
  assert.match(prerequisiteDetail({op:'interface.implement',jobId:'j',unmet:r.unmet}),/depends on arch \(todo\), not done/);

  const invalid=()=>({nodes:[
    {id:'impl',path:'features/f/impl/index.yaml',effectiveState:'invalid',dependsOn:['arch']},
    {id:'arch',path:'features/f/arch/index.yaml',effectiveState:'invalid',dependsOn:[]},
  ]});
  const unknown=checkPrerequisites({brief,repo,validate:invalid,payload:{records:['.starciwork/features/f/impl']}});
  assert.deepEqual(unknown.unmet,[],'an invalid tree cannot say a dependency is not done');
  assert.equal(unknown.unknown[0].kind,'dependency-state-unknown');

  traversals=0;
  assert.deepEqual(checkPrerequisites({brief,repo,validate,payload:{records:['.starciwork/features/f/plain']}}).unmet,[]);
  assert.equal(traversals,0,'no declared dependsOn means no Work traversal at all');
  assert.deepEqual(checkPrerequisites({brief:{reads:[],graphPolicy:{prerequisiteState:'todo'}},repo,validate,payload:{records:['.starciwork/features/f/impl']}}).unmet,[],
    'only prerequisiteState done asks for done dependencies');
});

test('api dispatch refuses prerequisite-unmet before the packet and before any Orca call',t=>{
  const root=tmpRepo(t);
  const repo=path.join(root,'repo');fs.mkdirSync(repo,{recursive:true});
  const stub=path.join(root,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const log=path.join(root,'calls.jsonl');
  const env={...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stub]),
    STARCI_FAKE_ORCA_MODE:'healthy',STARCI_FAKE_ORCA_LOG:log,STARCI_FAKE_ORCA_STATE:path.join(root,'state.json'),
    LOCALAPPDATA:path.join(root,'localappdata')};
  const ledger=openLedger({file:ledgerFileFor(repo)});
  try{ledger.enqueueJob({jobId:'job-audit-scope',workflowId:'wf-prereq',opId:'interface.audit',kind:'op',
    payload:{opId:'interface.audit',records:['.starciwork/features/wspv'],owned_paths:['.starciwork/features/wspv/operations/audit-pay'],model:'devin-agent'}});}
  finally{ledger.close();}

  for(const spawn of [[],['--spawn']]){
    const r=spawnSync(process.execPath,[API,'dispatch','--repo',repo,'--job','job-audit-scope',...spawn,'--json'],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});
    assert.equal(r.status,1,`${spawn.join(' ')||'dry'}: ${r.stdout}${r.stderr}`);
    const out=JSON.parse(r.stdout);
    assert.equal(out.reason,'prerequisite-unmet');
    assert.equal(out.unmet[0].path,'.starciwork/features/wspv/operations/audit-pay/index.yaml');
    assert.match(out.detail,/then run api dispatch --job job-audit-scope again/);
  }
  assert.equal(fs.existsSync(log)?fs.readFileSync(log,'utf8').trim():'','','nothing reached the host');
  const inspect=inspectLedger({file:ledgerFileFor(repo)});
  try{
    assert.equal(inspect.db.prepare('SELECT status FROM jobs WHERE job_id=?').get('job-audit-scope').status,'queued');
    assert.equal(inspect.db.prepare('SELECT count(*) n FROM leases').get().n,0);
  }finally{inspect.close();}

  write(repo,'.starciwork/features/wspv/operations/audit-pay/index.yaml','schema: work/node@1\n');
  const dry=spawnSync(process.execPath,[API,'dispatch','--repo',repo,'--job','job-audit-scope','--json'],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});
  assert.equal(dry.status,0,dry.stdout+dry.stderr);
  assert.ok(JSON.parse(dry.stdout).packet,'once the record exists the packet renders');
});
