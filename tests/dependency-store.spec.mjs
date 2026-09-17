import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {DEPENDENCY_STORE,dependencyKeyFor,ensureStoredDependencies,linkDependencies,storeEntryReady,withinStore} from '../kernel/dependency-store.mjs';

const COMMAND='npm ci --ignore-scripts --no-audit --no-fund';
const temp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'starci-deps-spec-'));
const project=(root,{lock='{"lockfileVersion":3}'}={})=>{
  fs.mkdirSync(root,{recursive:true});
  fs.writeFileSync(path.join(root,'package.json'),'{"name":"fixture","version":"1.0.0"}');
  fs.writeFileSync(path.join(root,'package-lock.json'),lock);
  return root;
};
/** An install that really produces a tree, and counts how often it was asked to. */
const installer=(calls=[])=>({calls,exec:(command,options)=>{calls.push({command,cwd:options.cwd});
  fs.mkdirSync(path.join(options.cwd,'node_modules','vitest'),{recursive:true});
  fs.writeFileSync(path.join(options.cwd,'node_modules','vitest','index.js'),'export default 1;');
  return {status:0,stdout:'added 1 package',stderr:''};}});

test('the key is the lockfile and the command, so a manifest change is a different tree by construction',()=>{
  const dir=temp(),root=project(path.join(dir,'root'));
  const first=dependencyKeyFor(root,{command:COMMAND});
  assert.equal(first.lockfile,'package-lock.json');
  assert.match(first.key,/^[0-9a-f]{32}$/);
  assert.equal(dependencyKeyFor(root,{command:COMMAND}).key,first.key,'the same inputs key the same tree');
  assert.notEqual(dependencyKeyFor(root,{command:'npm install'}).key,first.key,'a different install command is a different tree');
  fs.writeFileSync(path.join(root,'package-lock.json'),'{"lockfileVersion":3,"packages":{}}');
  assert.notEqual(dependencyKeyFor(root,{command:COMMAND}).key,first.key,'an edited lockfile is a different tree');
  const bare=path.join(dir,'bare');fs.mkdirSync(bare);
  assert.equal(dependencyKeyFor(bare,{command:COMMAND}).key,null,'a root with no lockfile has no key');
  fs.rmSync(dir,{recursive:true,force:true});
});

test('an install runs once per key and every later root reuses the stored tree',()=>{
  const dir=temp(),storeRoot=path.join(dir,'store');
  const root=project(path.join(dir,'candidate')),{calls,exec}=installer();
  const first=ensureStoredDependencies(root,{exec,command:COMMAND,storeRoot});
  assert.equal(first.ready,true);assert.equal(first.reused,false);assert.equal(calls.length,1);
  assert.equal(storeEntryReady(first.path),true);
  assert.notEqual(path.resolve(calls[0].cwd),path.resolve(root),'the install is staged, never run in the candidate itself');

  // A second root with the identical lockfile is the same key: no install at all.
  const other=project(path.join(dir,'base'));
  const second=ensureStoredDependencies(other,{exec,command:COMMAND,storeRoot});
  assert.equal(second.ready,true);assert.equal(second.reused,true);assert.equal(second.key,first.key);
  assert.equal(calls.length,1,'the tree is installed once, not once per root');
  fs.rmSync(dir,{recursive:true,force:true});
});

test('base and candidate resolve to the same bytes, which is what makes their comparison a comparison of code',()=>{
  const dir=temp(),storeRoot=path.join(dir,'store');
  const candidate=project(path.join(dir,'candidate')),base=project(path.join(dir,'base')),{exec}=installer();
  const stored=ensureStoredDependencies(candidate,{exec,command:COMMAND,storeRoot});
  for(const root of [candidate,base])assert.equal(linkDependencies(root,stored.nodeModules).linked,true);
  assert.equal(fs.realpathSync(path.join(candidate,'node_modules')),fs.realpathSync(path.join(base,'node_modules')));
  assert.equal(fs.existsSync(path.join(base,'node_modules','vitest','index.js')),true,'the base root can run the oracle at all');
  assert.equal(linkDependencies(candidate,stored.nodeModules).reused,true,'re-linking an already linked root is a no-op');
  assert.equal(withinStore(fs.realpathSync(path.join(base,'node_modules')),{storeRoot}),true);
  assert.equal(withinStore(candidate,{storeRoot}),false,'only the store itself is the permitted outside target');
  fs.rmSync(dir,{recursive:true,force:true});
});

test('a root that holds its own real node_modules is never replaced by the store',()=>{
  const dir=temp(),root=project(path.join(dir,'root'));
  fs.mkdirSync(path.join(root,'node_modules','own'),{recursive:true});
  const refused=linkDependencies(root,path.join(dir,'store','key','node_modules'));
  assert.equal(refused.linked,false);
  assert.match(refused.reason,/own node_modules/);
  assert.equal(fs.existsSync(path.join(root,'node_modules','own')),true);
  fs.rmSync(dir,{recursive:true,force:true});
});

test('a failed install leaves no entry to trust and no staging behind',()=>{
  const dir=temp(),storeRoot=path.join(dir,'store'),root=project(path.join(dir,'root'));
  const failed=ensureStoredDependencies(root,{exec:()=>({status:1,stdout:'',stderr:'ERR! 404'}),command:COMMAND,storeRoot});
  assert.equal(failed.ready,false);
  assert.match(failed.evidence,/404/);
  assert.equal(fs.existsSync(path.join(storeRoot,failed.key)),false,'a failed key is absent, not half-built');
  const staged=fs.existsSync(path.join(storeRoot,'.staging'))?fs.readdirSync(path.join(storeRoot,'.staging')):[];
  assert.deepEqual(staged,[],'the staging directory is swept');

  // An install that reports success without producing a tree is a failure too, not an empty store entry.
  const empty=ensureStoredDependencies(root,{exec:()=>({status:0,stdout:'up to date',stderr:''}),command:COMMAND,storeRoot});
  assert.equal(empty.ready,false);
  assert.equal(storeEntryReady(path.join(storeRoot,empty.key)),false);
  fs.rmSync(dir,{recursive:true,force:true});
});

test('a store entry without its ready marker is never trusted',()=>{
  const dir=temp(),storeRoot=path.join(dir,'store'),root=project(path.join(dir,'root')),{calls,exec}=installer();
  const stored=ensureStoredDependencies(root,{exec,command:COMMAND,storeRoot});
  assert.equal(stored.schema,DEPENDENCY_STORE);
  fs.rmSync(path.join(stored.path,'.starci-ready.json'));
  assert.equal(storeEntryReady(stored.path),false);
  fs.rmSync(stored.path,{recursive:true,force:true});
  assert.equal(ensureStoredDependencies(root,{exec,command:COMMAND,storeRoot}).ready,true);
  assert.equal(calls.length,2,'an untrusted entry is rebuilt rather than reused');
  fs.rmSync(dir,{recursive:true,force:true});
});
