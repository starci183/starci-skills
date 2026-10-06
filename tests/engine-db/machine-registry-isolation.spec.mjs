import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {openLedger,projectsRootFor,PROJECTS_ROOT_ENV} from '../../engine/db/ledger.mjs';
import {TEST_REGISTRY_ENV,isUnderTempDir,LOCAL_ROOT_ENV,machineFileFor,openMachine,starciLocalRoot} from '../../engine/db/machine.mjs';
import {runSpecFiles} from '../../scripts/supervisor/land.mjs';

/**
 * The host's machine registry (<runtime root>/.runtime/machine.sqlite `ledgers`) once held 7,829 rows,
 * four of them product ledgers: every spec that ran scripts/kernel/cli.mjs, or opened a ledger through a code
 * path that reserves, enrolled its temp-folder ledger on the live registry, and the rows outlived the specs
 * in every lease sweep and allocation scan. Two layers keep that from coming back, and each is held here:
 * the test run gets its own registry (preload + node --test fallback), and the live registry refuses a
 * temp-directory ledger.
 */
const runtimeRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..', '..');
const machineDb=pathToFileURL(path.join(runtimeRoot,'engine','db','machine.mjs')).href;
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
  return track(t,openLedger({file:path.join(dir,'.starciwork','runtime.sqlite'),repoRoot:dir}));
};

test('the explicit test registry wins; inside node --test a live runtime root falls back to a temp registry',()=>{
  const state=path.join(runtimeRoot,'.runtime');
  assert.equal(machineFileFor({}),path.join(state,'machine.sqlite'),'outside a test run the host registry is <runtime root>/.runtime/machine.sqlite');
  assert.equal(machineFileFor({[TEST_REGISTRY_ENV]:'x/machine.sqlite'}),path.resolve('x/machine.sqlite'));
  const fallback=machineFileFor({NODE_TEST_CONTEXT:'child-v8'});
  assert.ok(isUnderTempDir(fallback),`${fallback} is under the OS temp directory`);
  // A state base a spec already moved under the temp directory is its own isolation and is kept.
  const moved=path.join(os.tmpdir(),'la');
  assert.equal(machineFileFor({[LOCAL_ROOT_ENV]:moved,NODE_TEST_CONTEXT:'child-v8'}),path.join(moved,'machine.sqlite'));
});

test('this spec and its child inherit the explicit private registry or use the isolated temp fallback',t=>{
  const file=machineFileFor(),explicit=process.env[TEST_REGISTRY_ENV];
  if(explicit)assert.equal(file,path.resolve(explicit),'the runner may place its private registry outside TEMP');
  else assert.ok(isUnderTempDir(file),`fallback ${file}`);
  const hostFile=machineFileFor({});
  assert.notEqual(path.resolve(file).toLowerCase(),path.resolve(hostFile).toLowerCase(),'the spec does not open the host registry');
  const registry=openMachine();
  t.after(()=>registry.close());
  assert.equal(registry.live,false,'the inherited registry is treated as test state regardless of its location');
  const child=spawnSync(process.execPath,['--input-type=module','-e',`import {machineFileFor,openMachine,TEST_REGISTRY_ENV} from ${JSON.stringify(machineDb)};const m=openMachine();process.stdout.write(JSON.stringify({file:machineFileFor(),explicit:process.env[TEST_REGISTRY_ENV]??null,live:m.live}));m.close();`],{encoding:'utf8',env:{...process.env}});
  assert.equal(child.status,0,child.stderr);
  assert.deepEqual(JSON.parse(child.stdout),{file,explicit:explicit??null,live:false},'the child resolves the same isolated registry');
});

test('npm test and the land gate load the per-run registry preload',t=>{
  const pkg=JSON.parse(fs.readFileSync(path.join(runtimeRoot,'package.json'),'utf8'));
  assert.match(pkg.scripts.test,/--import \.\/tests\/setup\/isolated-temp\.mjs --import \.\/tests\/setup\/isolated-registry\.mjs --import \.\/tests\/setup\/runtime-copies\.mjs --test /,'the temp-root guard loads first so the per-run registry lands inside it');
  const probeRoot=tempWorld(t),landProbe=path.join(probeRoot,'land-registry.spec.mjs');
  const preload=path.join(probeRoot,'tests','setup','isolated-registry.mjs');
  fs.mkdirSync(path.dirname(preload),{recursive:true});
  const ownedPreload=pathToFileURL(path.join(runtimeRoot,'tests','setup','isolated-registry.mjs')).href;
  fs.writeFileSync(preload,`import ${JSON.stringify(ownedPreload)};process.env.STARCI_REGISTRY_PRELOAD_PROBE='loaded';\n`);
  fs.writeFileSync(landProbe,`import assert from 'node:assert/strict';import test from 'node:test';test('land preload',()=>{assert.equal(process.env.STARCI_REGISTRY_PRELOAD_PROBE,'loaded');assert.ok(process.env.${TEST_REGISTRY_ENV}?.endsWith('machine.sqlite'));});\n`);
  // Exercise the real land runner and registry preload in a tree with no generated runtime copies to write.
  const landed=runSpecFiles({dir:probeRoot,files:[landProbe],concurrency:1});
  assert.equal(landed.ok,true,landed.stderr||landed.stdout);
  const probe=spawnSync(process.execPath,['--import',pathToFileURL(path.join(runtimeRoot,'tests','setup','isolated-registry.mjs')).href,'-e',`process.stdout.write(process.env.${TEST_REGISTRY_ENV})`],
    {encoding:'utf8',env:Object.fromEntries(Object.entries(process.env).filter(([key])=>key!==TEST_REGISTRY_ENV&&key!=='NODE_TEST_CONTEXT'))});
  assert.equal(probe.status,0,probe.stderr);
  assert.ok(isUnderTempDir(probe.stdout)&&probe.stdout.endsWith('machine.sqlite'),probe.stdout);
  assert.equal(fs.existsSync(path.dirname(probe.stdout)),false,'the run removes its registry when it exits');
});

test('STARCI_LOCAL_ROOT overrides the per-host state base wholesale, ahead of <runtime root>/.runtime but behind the narrower seams',()=>{
  const override=path.join(os.tmpdir(),'starci-local-root-spec');
  // No override: the state base is <runtime root>/.runtime, whatever LOCALAPPDATA says.
  assert.equal(starciLocalRoot({LOCALAPPDATA:path.join(os.homedir(),'AppData','Local')}),path.join(runtimeRoot,'.runtime'));
  // The override wins, and machineFileFor (which resolves through starciLocalRoot) follows it.
  assert.equal(starciLocalRoot({[LOCAL_ROOT_ENV]:override}),path.resolve(override));
  assert.equal(machineFileFor({[LOCAL_ROOT_ENV]:override}),path.join(path.resolve(override),'machine.sqlite'));
  // A relative override resolves against the current working directory, same as every other *_ROOT env seam.
  assert.equal(starciLocalRoot({[LOCAL_ROOT_ENV]:'rel/local-root'}),path.resolve('rel/local-root'));
  // The narrower TEST_REGISTRY_ENV (an exact file) still wins over LOCAL_ROOT_ENV when both are set.
  assert.equal(machineFileFor({[LOCAL_ROOT_ENV]:override,[TEST_REGISTRY_ENV]:'x/machine.sqlite'}),path.resolve('x/machine.sqlite'));
  // engine/db/ledger.mjs re-exports the same function; the projects root it derives (PROJECTS_ROOT_ENV unset) moves too.
  assert.equal(projectsRootFor({[LOCAL_ROOT_ENV]:override}),path.join(path.resolve(override),'projects'));
  // The narrower STARCI_PROJECTS_ROOT still wins over LOCAL_ROOT_ENV for the ledger projects root specifically.
  assert.equal(projectsRootFor({[LOCAL_ROOT_ENV]:override,[PROJECTS_ROOT_ENV]:'y/projects'}),path.resolve('y/projects'));
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
  // A repository under the temp directory is refused too, even when the ledger file itself is not there.
  assert.match(live.registerLedger({file:product.path,ledgerId:product.ledgerId,repoRoot:path.join(fakeTemp,'stray','repo')}).refused,/registry-temp-repo/);
  assert.equal(live.registerLedger({file:product.path,ledgerId:product.ledgerId}).registered,true);
  assert.deepEqual(live.db.prepare('SELECT ledger_id FROM ledgers').all().map(row=>row.ledger_id),[product.ledgerId]);

  const testRegistry=track(t,openMachine({file:path.join(root,'host','test.sqlite'),env:{[TEST_REGISTRY_ENV]:path.join(root,'host','test.sqlite')},tempDirs:[fakeTemp]}));
  assert.equal(testRegistry.live,false);
  assert.equal(testRegistry.registerLedger({file:fixture.path,ledgerId:fixture.ledgerId}).registered,true);
  // A registry that itself sits under the temp directory is a spec's own, never the host's.
  const specOwn=track(t,openMachine({file:path.join(fakeTemp,'machine.sqlite'),env:{},tempDirs:[fakeTemp]}));
  assert.equal(specOwn.registerLedger({file:fixture.path,ledgerId:fixture.ledgerId}).registered,true);
});
