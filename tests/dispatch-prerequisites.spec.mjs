import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from './helpers/fake-orca.mjs';
import {openLedger,inspectLedger,ledgerFileFor} from '../engine/ledger-db.mjs';
import {parseYaml} from '../engine/yaml.mjs';
import {seedWorkflow} from './_ledger-fixture.mjs';
import {checkPrerequisites,prerequisiteDetail,resolveReadPath} from '../scripts/kernel/prerequisites.mjs';

// api dispatch refuses `prerequisite-unmet` from data only: a manifest read
// marked mustExist that the job binding resolves but the repository lacks, and
// a layout chain the shell record leaves unsettled.
// Unknown is never unmet.
const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const AUDIT=parseYaml(fs.readFileSync(path.join(ROOT,'modules','ops','ops','interface.audit.yaml'),'utf8'));
// interface.audit's `target` read is now a packet/ledger reference (params.audit + the
// interface_audits row), not a repository file; the file-path form below is the shape
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
  assert.equal(target.path,"packet params.audit (id operation.<feature>.<audit>, selectedMatrix) + the audit's interface_audits row (api op-contract)");
  assert.equal(target.mustExist,true);
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
    /reads \.starciwork\/features\/wspv\/operations\/audit-pay\/index\.yaml \(reads\.target, mustExist\).*api dispatch --job job-1 again.*stays queued/);

  write(repo,'.starciwork/features/wspv/operations/audit-pay/index.yaml','schema: work/node@1\n');
  assert.deepEqual(checkPrerequisites({brief,repo,payload:{owned_paths:['.starciwork/features/wspv/operations/audit-pay']}}).unmet,[]);

  const unbound=checkPrerequisites({brief,repo,payload:{owned_paths:['.starciwork/features/login/operations']}});
  assert.deepEqual(unbound.unmet,[]);
  assert.equal(unbound.unknown[0].kind,'read-unbound');
});

test('api dispatch refuses prerequisite-unmet before the packet and before any Orca call',t=>{
  const root=tmpRepo(t);
  const repo=path.join(root,'repo');fs.mkdirSync(repo,{recursive:true});
  const stub=path.join(root,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const log=path.join(root,'calls.jsonl');
  const env={...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stub]),
    STARCI_FAKE_ORCA_MODE:'healthy',STARCI_FAKE_ORCA_LOG:log,STARCI_FAKE_ORCA_STATE:path.join(root,'state.json'),
    LOCALAPPDATA:path.join(root,'localappdata')};
  // interface.draw's fixed-path shell read is mustExist: with no layout tree in the repository the job is refused.
  write(repo,'.starciwork/workspace.yaml','schema: work/workspace@1\nid: t\n');
  // ledgerFileFor resolves under env.LOCALAPPDATA — seed the file the spawned api will open.
  const ledgerFile=ledgerFileFor(repo,{env});
  const ledger=openLedger({file:ledgerFile});
  try{seedWorkflow(ledger,{id:'wf-prereq',state:{phase:'running',job:'wf-prereq'},
    jobs:[{jobId:'job-audit-scope',opId:'interface.draw',kind:'op',
      payload:{opId:'interface.draw',records:['.starciwork/features/f/ui/home'],owned_paths:['.starciwork/features/f/ui/home'],model:'devin-agent'}}]});}
  finally{ledger.close();}

  for(const spawn of [[],['--spawn']]){
    const r=spawnSync(process.execPath,[API,'dispatch','--repo',repo,'--job','job-audit-scope',...spawn,'--json'],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});
    assert.equal(r.status,1,`${spawn.join(' ')||'dry'}: ${r.stdout}${r.stderr}`);
    const out=JSON.parse(r.stdout);
    assert.equal(out.reason,'prerequisite-unmet');
    assert.equal(out.unmet[0].kind,'record-missing');
    assert.equal(out.unmet[0].path,'.starciwork/shell/index.yaml');
    assert.match(out.detail,/then run api dispatch --job job-audit-scope again/);
  }
  assert.equal(fs.existsSync(log)?fs.readFileSync(log,'utf8').trim():'','','nothing reached the host');
  const inspect=inspectLedger({file:ledgerFile});
  try{
    assert.equal(inspect.db.prepare('SELECT status FROM jobs WHERE job_id=?').get('job-audit-scope').status,'queued');
    assert.equal(inspect.db.prepare('SELECT count(*) n FROM leases').get().n,0);
  }finally{inspect.close();}
});
