import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {stateRoot,inspectStorage} from '../workflows/storage.mjs';
import {init,update} from '../bin/starci-skills.mjs';

const runtime=fileURLToPath(new URL('../',import.meta.url));
const cli=path.join(runtime,'bin/starci.mjs');
const invoke=(...args)=>spawnSync(process.execPath,[cli,...args],{encoding:'utf8',timeout:30000});
function temp(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-package-'));t.after(()=>{assert.equal(path.dirname(root),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(root).startsWith('starci-package-'));fs.rmSync(root,{recursive:true,force:true});});return root;}

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
 init(opts,()=>{});
 const split=fs.readFileSync(path.join(runtime,'init/AGENTS.md'),'utf8').replace("The project's backend owns shared `.starciwork`; Plan/run state lives inside `.starciwork/_local/plans` for both backend and frontend.","The project's backend owns the shared `.starciwork` and sibling `.starcitemp` for both backend and frontend.");
 for(const name of ['AGENTS.md','CLAUDE.md'])fs.writeFileSync(path.join(host,name),split+'\nCustom rule stays.\n');
 update(opts,()=>{});
 for(const name of ['AGENTS.md','CLAUDE.md']){const content=fs.readFileSync(path.join(host,name),'utf8');assert.match(content,/\.starciwork\/_local\/plans/);assert.ok(content.endsWith('Custom rule stays.\n'));}
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
 assert.equal(stateRoot(path.join(base,'.starciwork')),path.join(base,'.starciwork','_local'));
 assert.equal(stateRoot(path.join(base,'.work')),path.join(base,'.starci'));
 assert.equal(stateRoot(path.join(base,'custom-metadata')),path.join(base,'custom-metadata','_local'));
 assert.deepEqual(fs.readdirSync(path.join(base,'.starci')),[]);
 assert.deepEqual(fs.readdirSync(path.join(base,'.starcitemp')),[]);
});

test('update migrates known pre-rename bootstraps and preserves custom instructions and product bytes',t=>{
 const host=temp(t),opts={dir:host,force:false,bootstrap:true,upgradeMajor:false};
 init(opts,()=>{});
 const split=fs.readFileSync(path.join(runtime,'init/AGENTS.md'),'utf8').replace("The project's backend owns shared `.starciwork`; Plan/run state lives inside `.starciwork/_local/plans` for both backend and frontend.","The project's backend owns the shared `.starciwork` and sibling `.starcitemp` for both backend and frontend.");
 const old=split.replaceAll('.starciwork','.work').replaceAll('.starcitemp','.starci');
 for(const name of ['AGENTS.md','CLAUDE.md'])fs.writeFileSync(path.join(host,name),old+'\nCustom: keep project rules.\n');
 for(const dir of ['.work','.starci','.starciwork','.starcitemp']){fs.mkdirSync(path.join(host,dir));fs.writeFileSync(path.join(host,dir,'owned.txt'),'user data');}
 update(opts,()=>{});
 for(const name of ['AGENTS.md','CLAUDE.md']){const text=fs.readFileSync(path.join(host,name),'utf8');assert.ok(text.includes('.starciwork'));assert.ok(text.endsWith('Custom: keep project rules.\n'));}
 for(const dir of ['.work','.starci','.starciwork','.starcitemp'])assert.equal(fs.readFileSync(path.join(host,dir,'owned.txt'),'utf8'),'user data');
});
