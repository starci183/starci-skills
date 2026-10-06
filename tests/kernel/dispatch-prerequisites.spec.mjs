import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from '../helpers/fake-orca.mjs';
import {openLedger,inspectLedger,ledgerFileFor} from '../../engine/db/ledger.mjs';
import {parseYaml} from '../../engine/yaml.mjs';
import {selectDispatchContract} from '../../scripts/kernel/dispatch-admission.mjs';
import {resolveReadReference} from '../../scripts/context/read-refs.mjs';
import {seedWorkflow} from '../helpers/ledger-fixture.mjs';
import {checkPrerequisites,prerequisiteDetail,resolveReadPath} from '../../scripts/kernel/prerequisites.mjs';

// starci kernel dispatch refuses `prerequisite-unmet` from data only: a manifest read
// marked mustExist that the job binding resolves but the repository lacks, and
// the design gate (an implementation record whose proved ui record has no settled interface.draw).
// Unknown is never unmet.
const ROOT=path.resolve(import.meta.dirname,'..', '..');
const API=path.join(ROOT,'scripts','kernel','cli.mjs');
const AUDIT=parseYaml(fs.readFileSync(path.join(ROOT,'modules','ops','ops','interface.audit.yaml'),'utf8'));
// interface.audit's target is its required typed packet param. A previous ledger
// row is optional history, not a first-audit prerequisite; the file-path form below is the shape
// mustExist still resolves, exercised through a synthetic read.
const TARGET='.starciwork/features/<feature>/operations/<audit>/index.yaml';
const FILE_READ={id:'target',path:TARGET,mustExist:true};

const tmpRepo=t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-prereq-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  return dir;
};
const write=(repo,rel,text)=>{fs.mkdirSync(path.dirname(path.join(repo,rel)),{recursive:true});fs.writeFileSync(path.join(repo,rel),text);};

test('interface.audit declares its target operation record mustExist',()=>{
  const target=AUDIT.reads.find(r=>r.id==='target');
  assert.equal(target.path, 'params.audit');
  assert.equal(AUDIT.params.audit.required, true);
  assert.equal(AUDIT.params.audit.type, 'object');
  assert.equal(target.mustExist,true);
});

test('a required typed audit READ uses the attempt value and cannot be satisfied by a filename',t=>{
  const repo=tmpRepo(t),audit={id:'operation.checkout.purchase',feature:'checkout',selectedMatrix:{cells:[
    {id:'checkout-ready',surface:'checkout',route:'/checkout',state:'ready',viewport:'desktop',theme:'light',assertionIds:['ui.checkout.total']},
  ]}};
  const selected=selectDispatchContract(ROOT,'interface.audit',{params:{audit}});
  const evaluate=payload=>checkPrerequisites({brief:selected.brief,payload,repo});
  const missing=[{kind:'instance-missing',read:'target',path:'params.audit'}];
  assert.deepEqual(evaluate({params:selected.params}).unmet,[],'the complete real selected contract accepts its admitted typed audit');
  assert.equal(resolveReadReference('params.audit',{sourceRoot:ROOT}).kind,'instance','READ and prerequisite owners agree that the value is not a file');
  for(const payload of [{},{params:{}},{params:{audit:null}},{params:{audit:undefined}},{params:Object.create({audit})}])
    assert.deepEqual(evaluate(payload).unmet,missing,'absent, null, undefined or inherited values are not this attempt input');
  write(repo,'params.audit','this file cannot supply a typed audit');
  assert.deepEqual(evaluate({}).unmet,missing,'a same-named file cannot impersonate the required attempt value');
  assert.deepEqual(evaluate({params:{audit:null}}).unmet,missing,'a same-named file cannot turn null into a value');
  assert.match(prerequisiteDetail({op:'interface.audit',jobId:'job-audit',unmet:missing}),/params\.audit.*absent or null.*stays queued/);
  const ordinary={reads:[...selected.brief.reads,{id:'private-file',path:'required.yaml',mustExist:true}]};
  assert.deepEqual(checkPrerequisites({brief:ordinary,payload:{params:selected.params},repo}).unmet,
    [{kind:'record-missing',read:'private-file',path:'required.yaml'}],'a valid instance does not waive an ordinary required file');
  write(repo,'required.yaml','schema: private/fixture@1\n');
  assert.deepEqual(checkPrerequisites({brief:ordinary,payload:{params:selected.params},repo}).unmet,[]);
  assert.deepEqual(checkPrerequisites({brief:{reads:[{id:'rounds',path:'params.maxRounds',mustExist:true}]},
    payload:{},params:selected.params,repo}).unmet,[],'selected admission defaults remain actual instance inputs');
  assert.throws(()=>selectDispatchContract(ROOT,'interface.audit',{}),error=>error.code==='params-invalid','strict admission still owns required shape validation');
  assert.throws(()=>selectDispatchContract(ROOT,'interface.audit',{params:{audit:null}}),error=>error.code==='params-invalid');
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
  const brief={reads:[FILE_READ]};
  const missing=checkPrerequisites({brief,repo,payload:{records:['.starciwork/features/wspv'],owned_paths:['.starciwork/features/wspv/operations/audit-pay']}});
  assert.deepEqual(missing.unmet,[{kind:'record-missing',read:'target',path:'.starciwork/features/wspv/operations/audit-pay/index.yaml'}]);
  assert.match(prerequisiteDetail({op:'interface.audit',jobId:'job-1',unmet:missing.unmet}),
    /reads \.starciwork\/features\/wspv\/operations\/audit-pay\/index\.yaml \(reads\.target, mustExist\).*starci kernel dispatch --job job-1 again.*stays queued/);

  write(repo,'.starciwork/features/wspv/operations/audit-pay/index.yaml','schema: work/implementation@1\n');
  assert.deepEqual(checkPrerequisites({brief,repo,payload:{owned_paths:['.starciwork/features/wspv/operations/audit-pay']}}).unmet,[]);

  const unbound=checkPrerequisites({brief,repo,payload:{owned_paths:['.starciwork/features/login/operations']}});
  assert.deepEqual(unbound.unmet,[]);
  assert.equal(unbound.unknown[0].kind,'read-unbound');
});

test('starci kernel dispatch refuses prerequisite-unmet before the packet and before any Orca call',t=>{
  const root=tmpRepo(t);
  const repo=path.join(root,'repo');fs.mkdirSync(repo,{recursive:true});
  const stub=path.join(root,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const log=path.join(root,'calls.jsonl');
  const env={...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stub]),
    STARCI_FAKE_ORCA_MODE:'healthy',STARCI_FAKE_ORCA_LOG:log,STARCI_FAKE_ORCA_STATE:path.join(root,'state.json'),
    STARCI_LOCAL_ROOT:path.join(root,'localappdata')};
  // interface.implement's designDrawn read: the implementation record proves a ui record no interface.draw ever settled,
  // so the job is refused with DESIGN_NOT_SETTLED before anything reaches the host.
  write(repo,'.starciwork/features/f/impl/fe/home/index.yaml','schema: work/implementation@1\nid: impl.f.home\nproves:\n  - ui.f.home\n');
  write(repo,'.starciwork/workspace.yaml','schema: work/workspace@1\nid: t\n');
  // ledgerFileFor resolves under env.STARCI_LOCAL_ROOT — seed the file the spawned api will open.
  const ledgerFile=ledgerFileFor(repo,{env});
  const ledger=openLedger({file:ledgerFile});
  try{seedWorkflow(ledger,{id:'wf-prereq',state:{phase:'running',job:'wf-prereq'},
    jobs:[{jobId:'job-audit-scope',opId:'interface.implement',kind:'op',
      payload:{opId:'interface.implement',records:['.starciwork/features/f/impl/fe/home'],owned_paths:['.starciwork/features/f/impl/fe/home'],model:'devin-agent'}}]});}
  finally{ledger.close();}

  for(const spawn of [[],['--spawn']]){
    const r=spawnSync(process.execPath,[API,'dispatch','--repo',repo,'--job','job-audit-scope',...spawn,'--json'],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});
    assert.equal(r.status,1,`${spawn.join(' ')||'dry'}: ${r.stdout}${r.stderr}`);
    const out=JSON.parse(r.stdout);
    assert.equal(out.reason,'prerequisite-unmet');
    assert.equal(out.unmet[0].kind,'design-not-settled');
    assert.equal(out.unmet[0].code,'DESIGN_NOT_SETTLED');
    assert.equal(out.unmet[0].ui,'ui.f.home');
    assert.match(out.detail,/then run starci kernel dispatch --job job-audit-scope again/);
  }
  assert.equal(fs.existsSync(log)?fs.readFileSync(log,'utf8').trim():'','','nothing reached the host');
  const inspect=inspectLedger({file:ledgerFile});
  try{
    assert.equal(inspect.db.prepare('SELECT status FROM jobs WHERE job_id=?').get('job-audit-scope').status,'queued');
    assert.equal(inspect.db.prepare('SELECT count(*) n FROM leases').get().n,0);
  }finally{inspect.close();}
});
