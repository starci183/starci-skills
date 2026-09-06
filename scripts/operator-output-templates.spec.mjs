import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, access} from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {loadOperatorPackages, kindOf} from './operator-md.mjs';
import {loadKindTemplates} from './validate-templates.mjs';

const root=path.resolve(import.meta.dirname,'..');
const clean=value=>String(value??'').trim().replace(/^`|`$/g,'');

test('every declared output resolves through the brief to its actual canonical kind authority',async()=>{
 const packages=await loadOperatorPackages(root),kinds=await loadKindTemplates(root);
 const seen=new Set();
 for(const pkg of packages){
  const brief=await readFile(path.join(pkg.dir,'brief.md'),'utf8');
  assert.match(brief,/Before write\/resume, read \.\.\/\.\.\/templates\/kinds\/<kind>/);
  assert.match(brief,/md \.contract\.json \+ \.skeleton\.md; data \.schema\.json; artifact follows operator\.md/);
  for(const output of pkg.en.tables.outputs?.rows??[]){
   const kind=kindOf(output.kind),type=clean(output.type);seen.add(type);
   const line=brief.split('\n').find(value=>value.startsWith('`'+kind+'` `'+clean(output.file)+'`'));
   assert.ok(line?.endsWith(`(${type})`),`${pkg.manifest.id}/${kind}: brief must preserve its authored output type`);
   const home=path.resolve(pkg.dir,'../../templates/kinds');
   if(type==='md'){
    const contract=JSON.parse(await readFile(path.join(home,kind+'.contract.json'),'utf8'));
    assert.equal(contract.kind,kind);
    assert.equal(path.join(root,kinds.get(kind).skeleton),path.join(home,kind+'.skeleton.md'));
    await access(path.join(home,kind+'.skeleton.md'));
   }else if(type==='data'){
    const schema=JSON.parse(await readFile(path.join(home,kind+'.schema.json'),'utf8'));
    assert.equal(typeof schema,'object');
   }else{
    assert.equal(type,'artifact');
    assert.ok(pkg.en.tables.outputs.rows.includes(output),'artifacts remain governed by the authored operator, not invented kind files');
   }
  }
 }
 assert.deepEqual([...seen].sort(),['artifact','data','md']);
});

test('template guidance keeps generated parity and the existing brief byte budget',async()=>{
 const policy=JSON.parse(await readFile(path.join(root,'resources/orchestrator.json'),'utf8'));
 assert.match(policy.agent.prompt,/output-template map names runtime instructions, separately from product Context aliases/);
 assert.match(policy.agent.prompt,/only the declared kind needed before writing or resuming/);
 assert.match(policy.agent.prompt,/current status and declared outputs/);
 assert.match(policy.agent.prompt,/refusal must not claim undeclared successful outputs/);
 execFileSync(process.execPath,['scripts/generate-operator-briefs.mjs','--check'],{cwd:root,windowsHide:true});
 for(const pkg of await loadOperatorPackages(root))assert.ok((await readFile(path.join(pkg.dir,'brief.md'))).length<=policy.briefBytes,pkg.manifest.id);
});

test('the existing nested handoff names the mandatory parent resume transition before output mutation',async()=>{
 const policy=JSON.parse(await readFile(path.join(root,'resources/orchestrator.json'),'utf8'));
 assert.match(policy.agent.prompt,/worker-slots\.mjs resume <parent-branch> <workerId> <ranProfile>/);
 assert.match(policy.agent.prompt,/confirms acquisition before the author edits parent outputs/);
 assert.match(policy.agent.prompt,/waiting bytes stay intact until this existing transition succeeds/);
});

test('current workflow guidance cites archival and fresh-session authority without a nonexistent migration command',async()=>{
 const policy=JSON.parse(await readFile(path.join(root,'resources/orchestrator.json'),'utf8'));
 for(const guidance of [policy.session.manifest,policy.session.owner]){
  assert.match(guidance,/workflows\/discovery\.md/);assert.match(guidance,/fresh current session/);
  assert.doesNotMatch(guidance,/session-migrate\.mjs|session-open migrates/);
 }
 const peers=JSON.parse(await readFile(path.join(root,'templates/kinds/workflow-peers.schema.json'),'utf8'));
 assert.ok(peers.oneOf.some(shape=>shape.properties.version.const===1),'current one-repository tuple representation remains available');
});
