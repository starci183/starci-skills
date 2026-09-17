import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {isLocalOnlyWorkspace,inspectStorage} from '../workflows/storage.mjs';
import {init,update} from '../bin/starci-skills.mjs';

const runtime=fileURLToPath(new URL('../',import.meta.url));
const cli=path.join(runtime,'bin/starci.mjs');
const invoke=(...args)=>spawnSync(process.execPath,[cli,...args],{encoding:'utf8',timeout:30000});
function temp(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-package-'));t.after(()=>{assert.equal(path.dirname(root),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(root).startsWith('starci-package-'));fs.rmSync(root,{recursive:true,force:true});});return root;}
// init() spawns two real build/verify child processes every call. Tests below that call it only to
// reach "an already-installed host" before exercising update() copy that once-built install instead.
let golden;
before(()=>{golden=fs.mkdtempSync(path.join(os.tmpdir(),'starci-package-golden-'));init({dir:golden,force:false,bootstrap:true,upgradeMajor:false},()=>{});});
after(()=>fs.rmSync(golden,{recursive:true,force:true}));
function installFromGolden(host){
  fs.cpSync(path.join(golden,'.claude'),path.join(host,'.claude'),{recursive:true});
  for(const name of ['AGENTS.md','CLAUDE.md','.gitignore'])if(fs.existsSync(path.join(golden,name)))fs.cpSync(path.join(golden,name),path.join(host,name));
}

test('public starci CLI installs the host separately from project metadata and refuses overwrites',t=>{
 const root=temp(t),host=path.join(root,'host'),be=path.join(root,'backend'),fe=path.join(root,'frontend');
 for(const dir of [host,be,fe])fs.mkdirSync(dir);
 const result=invoke('init','--dir',host);assert.equal(result.status,0,result.stderr);
 for(const file of ['AGENTS.md','CLAUDE.md','.claude/SKILL.md','.claude/README.md'])assert.ok(fs.existsSync(path.join(host,file)));
 assert.equal(fs.existsSync(path.join(host,'.starciwork')),false);assert.deepEqual(fs.readdirSync(fe),[]);
 const work=path.join(be,'.starciwork');assert.equal(invoke('workspace','init',work,'--id','synthetic').status,0);
 const before=fs.readFileSync(path.join(work,'workspace.yaml'),'utf8');
 assert.equal(invoke('validate',work).status,0);assert.notEqual(invoke('workspace','init',work,'--id','other').status,0);
 assert.equal(fs.readFileSync(path.join(work,'workspace.yaml'),'utf8'),before);
 assert.equal(invoke('workflows').status,0);assert.equal(invoke('workflow','implement-frontend').status,0);
 assert.notEqual(invoke('unknown-command').status,0);assert.notEqual(invoke('workspace','delete',work).status,0);
});

test('storage reports legacy and mixed names read-only and init cannot create parallel Work',t=>{
 const base=temp(t);
 assert.equal(inspectStorage(base).status,'new');
 assert.notEqual(invoke('workspace','init',path.join(base,'.work'),'--id','synthetic').status,0);
 assert.deepEqual(fs.readdirSync(base),[]);
 fs.mkdirSync(path.join(base,'.work'));fs.writeFileSync(path.join(base,'.work','keep'),'unchanged');
 assert.equal(inspectStorage(base).status,'migration-required');
 const report=invoke('storage',base);assert.equal(report.status,1);assert.equal(JSON.parse(report.stdout).readOnly,true);
 assert.notEqual(invoke('workspace','init',path.join(base,'.starciwork'),'--id','synthetic').status,0);
 assert.deepEqual(fs.readdirSync(base),['.work']);assert.equal(fs.readFileSync(path.join(base,'.work','keep'),'utf8'),'unchanged');
 fs.mkdirSync(path.join(base,'.starcitemp'));assert.equal(inspectStorage(base).status,'migration-required');
 fs.writeFileSync(path.join(base,'.starciwork'),'not a directory');assert.equal(inspectStorage(base).status,'unsafe');
});

test('retired temp destination is refused and split-storage bootstraps upgrade without losing user text',t=>{
 const host=temp(t),opts={dir:host,force:false,bootstrap:true,upgradeMajor:false};
 installFromGolden(host);
 // Every storage sentence this bootstrap has carried must still be RECOGNIZED on update, or a host keeps two
 // homes for the same rule. `_local/plans` is the variant the 1.0.4 cutover retires (docs/ledger-db.md §13):
 // it is recognized and replaced, never installed.
 const current="The project's backend owns shared `.starciwork`; its runtime record is the ledger `.starciwork/runtime.sqlite` for both backend and frontend.";
 const installed=fs.readFileSync(path.join(runtime,'init/AGENTS.md'),'utf8');
 assert.ok(installed.includes(current),'the shipped bootstrap carries the current storage sentence');
 for(const legacy of ["The project's backend owns shared `.starciwork`; Plan/run state lives inside `.starciwork/_local/plans` for both backend and frontend.",
                      "The project's backend owns the shared `.starciwork` and sibling `.starcitemp` for both backend and frontend."]) {
  const stale=installed.replace(current,legacy);
  for(const name of ['AGENTS.md','CLAUDE.md'])fs.writeFileSync(path.join(host,name),stale+'\nCustom rule stays.\n');
  update(opts,()=>{});
  for(const name of ['AGENTS.md','CLAUDE.md']){
   const content=fs.readFileSync(path.join(host,name),'utf8');
   assert.ok(content.includes(current),`update replaced the legacy sentence in ${name}`);
   assert.ok(!content.includes(legacy),`the legacy sentence is gone from ${name}`);
   assert.ok(content.endsWith('Custom rule stays.\n'));
  }
 }
 assert.notEqual(invoke('workspace','init',path.join(host,'.starcitemp'),'--id','synthetic').status,0);
 assert.equal(fs.existsSync(path.join(host,'.starcitemp')),false);
});

test('workspace init preserves a Plan saved before metadata exists and refuses other existing content',t=>{
 const base=temp(t),root=path.join(base,'.starciwork'),plan=path.join(root,'_local/plans/demo');
 fs.mkdirSync(plan,{recursive:true});fs.writeFileSync(path.join(plan,'index.yaml'),'Synthetic draft Plan bytes');
 assert.equal(invoke('workspace','init',root,'--id','synthetic').status,0);
 assert.equal(fs.readFileSync(path.join(plan,'index.yaml'),'utf8'),'Synthetic draft Plan bytes');
 assert.equal(invoke('validate',root).status,0);
 assert.notEqual(invoke('workspace','init',root,'--id','replacement').status,0);
 const foreign=path.join(base,'other');fs.mkdirSync(path.join(foreign,'_local'),{recursive:true});fs.writeFileSync(path.join(foreign,'owned.txt'),'keep');
 assert.notEqual(invoke('workspace','init',foreign,'--id','other').status,0);
 assert.equal(fs.readFileSync(path.join(foreign,'owned.txt'),'utf8'),'keep');
});

test('storage does not follow backend or storage symlinks',t=>{
 const base=temp(t),target=temp(t),link=path.join(base,'linked-backend');
 fs.symlinkSync(target,link,process.platform==='win32'?'junction':'dir');
 assert.equal(inspectStorage(link).status,'unsafe');
 fs.symlinkSync(target,path.join(base,'.starciwork'),process.platform==='win32'?'junction':'dir');
 assert.equal(inspectStorage(base).status,'unsafe');
 assert.deepEqual(fs.readdirSync(target),[]);
});

test('state follows the explicit root, never the presence of a competing tree or a digest rewrite',t=>{
 const base=temp(t);
 for(const dir of ['.starci','.starcitemp'])fs.mkdirSync(path.join(base,dir));
 // `stateRoot` is retired with `_local` (docs/ledger-db.md §13). What still has to be true is the reason it
 // existed: a competing tree beside a root never redirects anything, and a root holding only reserved
 // runtime state is not Work - including a root holding only a ledger, which is the 1.0.4 shape.
 const root=path.join(base,'.starciwork');fs.mkdirSync(root);
 assert.equal(isLocalOnlyWorkspace(root),false,'an empty root holds nothing, reserved or otherwise');
 fs.writeFileSync(path.join(root,'runtime.sqlite'),'');
 assert.equal(isLocalOnlyWorkspace(root),true,'a root holding only its ledger has no Work in it yet');
 fs.mkdirSync(path.join(root,'_local'));
 assert.equal(isLocalOnlyWorkspace(root),true,'an unmigrated _local is reserved state too');
 fs.writeFileSync(path.join(root,'workspace.yaml'),'schema: work/workspace@1\nid: synthetic\n');
 assert.equal(isLocalOnlyWorkspace(root),false,'a workspace record is Work');
 assert.deepEqual(fs.readdirSync(path.join(base,'.starci')),[]);
 assert.deepEqual(fs.readdirSync(path.join(base,'.starcitemp')),[]);
});

test('update migrates known pre-rename bootstraps and preserves custom instructions and product bytes',t=>{
 const host=temp(t),opts={dir:host,force:false,bootstrap:true,upgradeMajor:false};
 installFromGolden(host);
 // The pre-rename bootstrap is reconstructed from the CURRENT template the same way bin/starci-skills.mjs
 // reconstructs it - by putting that era's storage sentence back. Reconstructing it from a sentence the
 // template no longer carries would silently produce today's bootstrap and assert nothing.
 const current="The project's backend owns shared `.starciwork`; its runtime record is the ledger `.starciwork/runtime.sqlite` for both backend and frontend.";
 const template=fs.readFileSync(path.join(runtime,'init/AGENTS.md'),'utf8');
 assert.ok(template.includes(current),'the shipped bootstrap carries the current storage sentence');
 const split=template.replace(current,"The project's backend owns the shared `.starciwork` and sibling `.starcitemp` for both backend and frontend.");
 assert.notEqual(split,template,'the split-storage bootstrap is a real historical variant, not a copy of today');
 const old=split.replaceAll('.starciwork','.work').replaceAll('.starcitemp','.starci');
 for(const name of ['AGENTS.md','CLAUDE.md'])fs.writeFileSync(path.join(host,name),old+'\nCustom: keep project rules.\n');
 for(const dir of ['.work','.starci','.starciwork','.starcitemp']){fs.mkdirSync(path.join(host,dir));fs.writeFileSync(path.join(host,dir,'owned.txt'),'user data');}
 update(opts,()=>{});
 for(const name of ['AGENTS.md','CLAUDE.md']){const text=fs.readFileSync(path.join(host,name),'utf8');assert.ok(text.includes('.starciwork'));assert.ok(text.endsWith('Custom: keep project rules.\n'));}
 for(const dir of ['.work','.starci','.starciwork','.starcitemp'])assert.equal(fs.readFileSync(path.join(host,dir,'owned.txt'),'utf8'),'user data');
});
