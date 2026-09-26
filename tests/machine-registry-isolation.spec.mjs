import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {TEST_REGISTRY_ENV,isUnderTempDir,machineFileFor,openLedger,openMachine,pruneRegistry,reserveTwoPhase,runtimeRootFor} from '../engine/ledger-db.mjs';
import {pruneMachineRegistry} from '../scripts/kernel/prune-registry.mjs';

/**
 * The host's machine registry (%LOCALAPPDATA%/StarCi/runtime/machine.sqlite `ledgers`) once held 7,829 rows,
 * four of them product ledgers: every spec that ran scripts/kernel/api.mjs, or opened a ledger through a code
 * path that reserves, enrolled its temp-folder ledger on the live registry, and the rows outlived the specs
 * in every lease sweep and allocation scan. Three layers keep that from coming back, and each is held here:
 * the test run gets its own registry (preload + node --test fallback), the live registry refuses a
 * temp-directory ledger, and a one-shot prune clears what is already there without touching a product ledger.
 */
const runtimeRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ledgerDb=pathToFileURL(path.join(runtimeRoot,'engine','ledger-db.mjs')).href;
// One temp root per test; every handle opened in it is closed before the tree is removed (Windows EPERMs
// an rmSync over an open sqlite file).
const handles=new WeakMap();
const tempWorld=t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-registry-')),open=[];
  handles.set(t,open);
  t.after(()=>{for(const handle of open.reverse())try{handle.close();}catch{}fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25});});
  return root;
};
const track=(t,handle)=>{handles.get(t).push(handle);return handle;};
const ledgerIn=(t,dir)=>{
  fs.mkdirSync(path.join(dir,'.starciwork'),{recursive:true});
  return track(t,openLedger({file:path.join(dir,'.starciwork','runtime.sqlite')}));
};

test('the explicit test registry wins; inside node --test a live runtime root falls back to a temp registry',()=>{
  const home=path.join(os.homedir(),'AppData','Local');
  assert.equal(machineFileFor({LOCALAPPDATA:home}),path.join(home,'StarCi','runtime','machine.sqlite'),'outside a test run the host registry is unchanged');
  assert.equal(machineFileFor({LOCALAPPDATA:home,[TEST_REGISTRY_ENV]:'x/machine.sqlite'}),path.resolve('x/machine.sqlite'));
  const fallback=machineFileFor({LOCALAPPDATA:home,NODE_TEST_CONTEXT:'child-v8'});
  assert.ok(isUnderTempDir(fallback),`${fallback} is under the OS temp directory`);
  // A runtime root a spec already moved under the temp directory is its own isolation and is kept.
  const moved=path.join(os.tmpdir(),'la');
  assert.equal(machineFileFor({LOCALAPPDATA:moved,NODE_TEST_CONTEXT:'child-v8'}),path.join(moved,'StarCi','runtime','machine.sqlite'));
  // Only the registry moves: connectors, uat-slots and watchdog logs keep the runtime root.
  assert.equal(runtimeRootFor({LOCALAPPDATA:home,[TEST_REGISTRY_ENV]:'x/machine.sqlite'}),path.join(home,'StarCi','runtime'));
});

test('this spec, and a process it spawns with the inherited env, resolve a registry under the OS temp directory',()=>{
  assert.ok(isUnderTempDir(machineFileFor()),`in-process ${machineFileFor()}`);
  const child=spawnSync(process.execPath,['--input-type=module','-e',`import {machineFileFor} from ${JSON.stringify(ledgerDb)};process.stdout.write(machineFileFor());`],{encoding:'utf8',env:{...process.env}});
  assert.equal(child.status,0,child.stderr);
  assert.ok(isUnderTempDir(child.stdout),`spawned ${child.stdout}`);
});

test('npm test and the land gate load the per-run registry preload',()=>{
  const pkg=JSON.parse(fs.readFileSync(path.join(runtimeRoot,'package.json'),'utf8'));
  assert.match(pkg.scripts.test,/--import \.\/tests\/setup\/isolated-temp\.mjs --import \.\/tests\/setup\/isolated-registry\.mjs --test /,'the temp-root guard loads first so the per-run registry lands inside it');
  assert.match(fs.readFileSync(path.join(runtimeRoot,'scripts','supervisor','land.mjs'),'utf8'),/'tests', 'setup', 'isolated-registry\.mjs'/);
  const probe=spawnSync(process.execPath,['--import',pathToFileURL(path.join(runtimeRoot,'tests','setup','isolated-registry.mjs')).href,'-e',`process.stdout.write(process.env.${TEST_REGISTRY_ENV})`],
    {encoding:'utf8',env:Object.fromEntries(Object.entries(process.env).filter(([key])=>key!==TEST_REGISTRY_ENV&&key!=='NODE_TEST_CONTEXT'))});
  assert.equal(probe.status,0,probe.stderr);
  assert.ok(isUnderTempDir(probe.stdout)&&probe.stdout.endsWith('machine.sqlite'),probe.stdout);
  assert.equal(fs.existsSync(path.dirname(probe.stdout)),false,'the run removes its registry when it exits');
});

test('the live registry refuses a temp-directory ledger; a test registry enrols it',t=>{
  const root=tempWorld(t),fakeTemp=path.join(root,'tmp');
  // `tempDirs` stands in for the OS temp directory, so the registry here reads as live (outside it).
  const live=track(t,openMachine({file:path.join(root,'host','machine.sqlite'),env:{},tempDirs:[fakeTemp]}));
  assert.equal(live.live,true);
  const fixture=ledgerIn(t,path.join(fakeTemp,'spec-repo')),product=ledgerIn(t,path.join(root,'product'));
  const refused=live.registerLedger({file:fixture.path,ledgerId:fixture.ledgerId});
  assert.equal(refused.registered,false);
  assert.match(refused.refused,/registry-temp-ledger/);
  assert.deepEqual(live.registerLedger({file:product.path,ledgerId:product.ledgerId}),{ledgerId:product.ledgerId,registered:true});
  assert.deepEqual(live.db.prepare('SELECT ledger_id FROM ledgers').all().map(row=>row.ledger_id),[product.ledgerId]);

  // Repo-scoped admission needs no registry row.
  fixture.db.prepare('INSERT INTO resources(resource_key,capacity) VALUES(?,1)').run('repo:src');
  const job={jobId:'j1',workflowId:'wf',kind:'op',generation:1};
  assert.equal(reserveTwoPhase(fixture,live,{job,leases:[{resourceKey:'repo:src',units:1}]}).ok,true);
  assert.deepEqual(live.db.prepare('SELECT ledger_id FROM ledgers').all().map(row=>row.ledger_id),[product.ledgerId],'the refused fixture stays unregistered');

  const testRegistry=track(t,openMachine({file:path.join(root,'host','test.sqlite'),env:{[TEST_REGISTRY_ENV]:path.join(root,'host','test.sqlite')},tempDirs:[fakeTemp]}));
  assert.equal(testRegistry.live,false);
  assert.equal(testRegistry.registerLedger({file:fixture.path,ledgerId:fixture.ledgerId}).registered,true);
  // A registry that itself sits under the temp directory is a spec's own, never the host's.
  const specOwn=track(t,openMachine({file:path.join(fakeTemp,'machine.sqlite'),env:{},tempDirs:[fakeTemp]}));
  assert.equal(specOwn.registerLedger({file:fixture.path,ledgerId:fixture.ledgerId}).registered,true);
});

test('prune drops missing and temp-directory rows, keeps product ledgers and lease holders, and is idempotent',t=>{
  const root=tempWorld(t),fakeTemp=path.join(root,'tmp');
  const machine=track(t,openMachine({file:path.join(root,'host','machine.sqlite'),env:{[TEST_REGISTRY_ENV]:'set'},tempDirs:[fakeTemp]}));
  const product=ledgerIn(t,path.join(root,'product')),fixture=ledgerIn(t,path.join(fakeTemp,'spec-repo'));
  machine.registerLedger({file:product.path,ledgerId:product.ledgerId});
  machine.registerLedger({file:fixture.path,ledgerId:fixture.ledgerId});
  machine.registerLedger({file:path.join(root,'gone','.starciwork','runtime.sqlite'),ledgerId:'gone'});
  machine.registerLedger({file:path.join(fakeTemp,'deleted','.starciwork','runtime.sqlite'),ledgerId:'deleted-temp'});
  machine.registerLedger({file:path.join(root,'moved','.starciwork','runtime.sqlite'),ledgerId:'moved-with-lease'});
  machine.db.prepare('INSERT INTO leases(resource_key,token,ledger_id,workflow_id,job_id,units,acquired_at,expires_at) VALUES(?,?,?,?,?,?,?,?)')
    .run('ai/global','tok','moved-with-lease','wf','j',1,1,Number.MAX_SAFE_INTEGER);

  const dry=pruneRegistry(machine,{tempDirs:[fakeTemp],dryRun:true});
  assert.deepEqual({before:dry.before,after:dry.after,pruned:dry.pruned},{before:5,after:5,pruned:3});
  const done=machine.pruneRegistry();
  assert.deepEqual({before:done.before,after:done.after,pruned:done.pruned,temp:done.temp,missing:done.missing},{before:5,after:2,pruned:3,temp:2,missing:1});
  assert.deepEqual(done.kept.map(row=>row.ledgerId),['moved-with-lease']);
  assert.deepEqual(machine.db.prepare('SELECT ledger_id FROM ledgers ORDER BY ledger_id').all().map(row=>row.ledger_id).sort(),[product.ledgerId,'moved-with-lease'].sort());
  const again=machine.pruneRegistry();
  assert.deepEqual({before:again.before,after:again.after,pruned:again.pruned},{before:2,after:2,pruned:0});
});

test('the prune command backs the registry up before deleting, and a second run is a no-op',t=>{
  const root=tempWorld(t),machineFile=path.join(root,'host','machine.sqlite');
  const machine=openMachine({file:machineFile,env:{[TEST_REGISTRY_ENV]:machineFile}});
  const fixture=ledgerIn(t,path.join(root,'spec-repo'));
  machine.registerLedger({file:fixture.path,ledgerId:fixture.ledgerId});
  machine.close();
  const first=pruneMachineRegistry({machineFile,now:()=>Date.UTC(2026,8,25)});
  assert.deepEqual({ok:first.ok,before:first.before,after:first.after,pruned:first.pruned},{ok:true,before:1,after:0,pruned:1});
  assert.ok(first.backup&&fs.existsSync(first.backup),'a backup is written before rows go');
  const {DatabaseSync}=process.getBuiltinModule('node:sqlite');
  const copy=new DatabaseSync(first.backup,{readOnly:true});
  try{assert.equal(copy.prepare('SELECT count(*) n FROM ledgers').get().n,1);}finally{copy.close();}
  const second=spawnSync(process.execPath,[path.join(runtimeRoot,'scripts','kernel','prune-registry.mjs'),'--machine',machineFile,'--json'],{encoding:'utf8'});
  assert.equal(second.status,0,second.stderr);
  const result=JSON.parse(second.stdout);
  assert.deepEqual({before:result.before,after:result.after,pruned:result.pruned,backup:result.backup},{before:0,after:0,pruned:0,backup:null});
  assert.equal(spawnSync(process.execPath,[path.join(runtimeRoot,'scripts','kernel','prune-registry.mjs'),'--machine',path.join(root,'none.sqlite')],{encoding:'utf8'}).status,2);
});
