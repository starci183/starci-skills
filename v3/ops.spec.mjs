import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { outputs, generate, root } from './ops/generate.mjs';
import { ops as sourceContracts } from './ops/contracts.mjs';
import { validateCatalog } from './ops/validate.mjs';
import { validateWorkspace, sha256 } from './core/index.mjs';
const repository=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const catalogue=JSON.parse(fs.readFileSync(path.join(root,'catalog.json'),'utf8'));
const fresh=()=>structuredClone(catalogue);
const errors=cat=>validateCatalog(cat,{root,repositoryRoot:repository}).errors.map(e=>e.code);

test('current V3 contracts have complete resolvable catalogue identities and authority/mirrors',()=>{
  const result=validateCatalog(catalogue,{root,repositoryRoot:repository});
  assert.deepEqual(result.errors,[]);
  assert.deepEqual(catalogue.ops.map(op=>op.id).sort(),sourceContracts.map(op=>op.id).sort());
  assert.deepEqual(Object.keys(catalogue).sort(),['commonDocument','ops','schema']);
  assert.ok(catalogue.ops.some(o=>o.id==='goal.setup'));
  assert.ok(catalogue.ops.some(o=>o.id==='scope.retire'));
});
test('all generated authority/mirror/catalogue bytes are reproducible without writes in check mode',()=>{
  const before=new Map([...outputs()].map(([name])=>[name,fs.readFileSync(path.join(root,name),'utf8')]));
  assert.deepEqual(generate({check:true}),[]);
  for(const [name,bytes] of before) assert.equal(fs.readFileSync(path.join(root,name),'utf8'),bytes);
});
test('operator generation and catalogue validation need only current operator sources and selected domain references',()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'work3-ops-minimal-'));
  try {
    const isolatedRoot=path.join(temporary,'v3','ops');fs.cpSync(root,isolatedRoot,{recursive:true});
    for(const ref of new Set(catalogue.ops.flatMap(op=>op.supportingReferences.map(r=>r.path)))) {
      const target=path.join(temporary,ref);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(repository,ref),target);
    }
    const observed=spawnSync(process.execPath,['generate.mjs','--check'],{cwd:isolatedRoot,encoding:'utf8'});
    assert.equal(observed.status,0,observed.stderr+observed.stdout);
    assert.deepEqual(fs.readdirSync(temporary).sort(),['knowledge','v3']);
    assert.deepEqual(validateCatalog(catalogue,{root:isolatedRoot,repositoryRoot:temporary}).errors,[]);
  } finally {assert.equal(path.dirname(temporary),os.tmpdir());assert.ok(path.basename(temporary).startsWith('work3-ops-minimal-'));fs.rmSync(temporary,{recursive:true,force:true});}
});
test('migration contract cannot substitute inferred intent, completed imports or unsafe worktree retirement',()=>{
  const c=fresh(),op=c.ops.find(o=>o.id==='workspace.migrate');assert.ok(op);
  assert.equal(op.contract.graphPolicy.mode,'selected-scope-only');
  op.contract.migrationPolicy.importState='done';assert.ok(errors(c).includes('MIGRATION_POLICY'));
  op.contract.migrationPolicy=structuredClone(catalogue.ops.find(o=>o.id===op.id).contract.migrationPolicy);
  op.contract.migrationPolicy.registeredWorktreeRemoval='recursive-delete';assert.ok(errors(c).includes('MIGRATION_POLICY'));
  op.contract.reads=op.contract.reads.filter(r=>r.id!=='custody');assert.ok(errors(c).includes('MIGRATION_BINDING'));
});
test('one-pilot import binds real committed source and recoverable untracked bytes without accepting implementation or UAT',()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'work3-op-import-'));
  try {
    const repo=path.join(temporary,'source');fs.mkdirSync(repo);
    const git=(...args)=>{const result=spawnSync('git',args,{cwd:repo,encoding:'utf8'});assert.equal(result.status,0,result.stderr);return result.stdout.trim();};
    git('init');fs.writeFileSync(path.join(repo,'chat.mjs'),'export const draftState = "draft";\n');git('add','chat.mjs');git('-c','user.name=Synthetic Test','-c','user.email=test@example.invalid','commit','-m','Synthetic source fixture');
    const commit=git('rev-parse','HEAD');assert.match(commit,/^[a-f0-9]{40,64}$/);
    fs.mkdirSync(path.join(repo,'old-artifacts'));const original=path.join(repo,'old-artifacts','notes.md');fs.writeFileSync(original,'Historical note: draft save was claimed complete; no current proof.\n');
    const status=git('status','--porcelain','--untracked-files=all');assert.match(status,/\?\? old-artifacts\/notes.md/);
    const worktrees=git('worktree','list','--porcelain');assert.match(worktrees,/worktree /);
    const work=path.join(temporary,'.work'),resource=path.join(work,'_resources','imports','pilot');fs.mkdirSync(path.join(resource,'assets'),{recursive:true});
    fs.writeFileSync(path.join(work,'workspace.yaml'),JSON.stringify({schema:'work/workspace@1',id:'synthetic-import'}));
    const preserved=path.join(resource,'assets','notes.md');fs.copyFileSync(original,preserved);assert.equal(sha256(fs.readFileSync(original)),sha256(fs.readFileSync(preserved)));
    fs.writeFileSync(path.join(resource,'resource.yaml'),JSON.stringify({schema:'work/resource@1',id:'source-facts',kind:'import',owner:'synthetic-owner',revision:commit,details:{repository:repo,commit,sourcePath:'chat.mjs',observed:'source exports draft string',intent:'candidate; not approved',untracked:status,worktrees},files:[{path:'assets/notes.md'}]}));
    const bodies=new Map();const metadata=new Map();
    const put=(id,meta)=>{const dir=path.join(work,'pilot',id);fs.mkdirSync(dir,{recursive:true});const body=bodies.get(id)??'# Synthetic import\nObserved source only; expected intent is unapproved.\n';bodies.set(id,body);metadata.set(id,meta);fs.writeFileSync(path.join(dir,'node.md'),'---\n'+JSON.stringify(meta)+'\n---\n'+body);};
    for(const [id,kind] of [['business','business'],['implementation','implementation'],['uat','uat.ux']]) put(id,{schema:'work/node@1',id,kind,required:true,state:'suspended',suspensionReason:'Imported source claim requires independently selected intent/proof review.',assertions:['own-proof'],refs:['source-facts']});
    put('consumer',{schema:'work/node@1',id:'consumer',kind:'operations',required:true,state:'todo',assertions:['consumer-proof'],dependsOn:['implementation']});
    put('migration',{schema:'work/node@1',id:'migration',kind:'operations',required:true,state:'todo',assertions:['preservation'],refs:['source-facts']});
    const before=validateWorkspace(work);assert.deepEqual(before.errors,[]);assert.equal(before.nodes.find(n=>n.id==='consumer').eligible,false);
    const node=before.nodes.find(n=>n.id==='migration'),evidenceDir=path.join(work,'pilot','migration','evidence','import-check');fs.mkdirSync(evidenceDir,{recursive:true});
    const report=JSON.stringify({commit,status,worktrees,originHash:sha256(fs.readFileSync(original)),retrievedHash:sha256(fs.readFileSync(preserved)),cleanup:'not-requested',acceptance:'migration preservation only; product unapproved'});
    fs.writeFileSync(path.join(evidenceDir,'preservation.json'),report);
    fs.writeFileSync(path.join(evidenceDir,'manifest.yaml'),JSON.stringify({schema:'work/evidence@1',id:'import-check',nodeId:'migration',inputDigest:node.inputDigest,outcome:'pass',assertions:[{id:'preservation',outcome:'pass',observation:'Read actual Git commit/status/worktree inventory and independently compared retained original versus copied untracked note hashes in this isolated synthetic fixture.'}],assets:[{path:'preservation.json',sha256:sha256(report)}]}));
    put('migration',{...metadata.get('migration'),state:'done',completion:{inputDigest:node.inputDigest,evidence:['import-check']}});
    const after=validateWorkspace(work);assert.deepEqual(after.errors,[]);assert.equal(after.nodes.find(n=>n.id==='migration').effectiveState,'done');
    for(const id of ['business','implementation','uat']) {assert.equal(after.nodes.find(n=>n.id===id).effectiveState,'suspended');assert.equal(metadata.get(id).completion,undefined);}
    assert.equal(after.nodes.find(n=>n.id==='consumer').eligible,false);assert.equal(fs.existsSync(original),true);
    const withoutReason={...metadata.get('business')};delete withoutReason.suspensionReason;put('business',withoutReason);assert.equal(validateWorkspace(work).ok,false);
  } finally {assert.equal(path.dirname(temporary),os.tmpdir());assert.ok(path.basename(temporary).startsWith('work3-op-import-'));fs.rmSync(temporary,{recursive:true,force:true});}
});
test('operator and document identity collision is refused',()=>{
  const c=fresh();c.ops.push(structuredClone(c.ops[0]));
  assert.ok(errors(c).includes('DUPLICATE_OP'));assert.ok(errors(c).includes('DUPLICATE_DOCUMENT'));
});
test('a Vietnamese mirror cannot be loaded as runtime authority; path escapes are refused',()=>{
  const c=fresh();c.ops[0].document='../CONTRACT.md';assert.ok(errors(c).includes('DOCUMENT_PATH'));
  c.ops[0].document='api.verify.vi.md';assert.ok(errors(c).includes('DOCUMENT_PATH'));
});
test('every procedure read/write is bound; missing declaration cannot silently widen scope',()=>{
  const c=fresh();c.ops[0].contract.steps[0].writes.push('undeclared-remote');assert.ok(errors(c).includes('UNDECLARED_WRITE'));
  c.ops[0].contract.steps[0].reads.push('imaginary-account');assert.ok(errors(c).includes('UNDECLARED_READ'));
});
test('every declared read and output has an actual procedural consumer/producer',()=>{
  const c=fresh();c.ops[0].contract.reads.push({id:'unused',path:'N/node.md',purpose:{en:'actual required input',vi:'đầu vào bắt buộc thật'}});
  assert.ok(errors(c).includes('UNUSED_READ'));
  c.ops[0].contract.writes.push({id:'never-written',path:'E/unused.json',fields:['actual'],content:{en:'unproduced output',vi:'output chưa tạo'}});
  assert.ok(errors(c).includes('UNREACHABLE_WRITE'));
});
test('every template placeholder must be explicitly grounded; broad absolute write scope is refused',()=>{
  const c=fresh();c.ops[0].contract.writes[0].path='repository:<unbound>/<write-ceiling>';
  assert.ok(errors(c).includes('UNDEFINED_PLACEHOLDER'));assert.ok(errors(c).includes('WRITE_DESTINATION'));
  c.ops[0].contract.writes[0].path='C:/Users';assert.ok(errors(c).includes('UNSAFE_TEMPLATE'));
});
test('source mutation cannot be described as read-only or omit repository grounding',()=>{
  const c=fresh();const op=c.ops.find(o=>o.id==='backend.generate');op.sideEffects=[];op.contract.sideEffects=[];
  assert.ok(errors(c).includes('SOURCE_AUTHORITY'));
  op.contract.reads=op.contract.reads.filter(r=>r.id!=='repo');assert.ok(errors(c).includes('UNDECLARED_READ'));
});
test('a catalogue cannot omit fields, proof or concrete blockers and still pass',()=>{
  const c=fresh();c.ops[0].contract.writes[0].fields=[];c.ops[0].contract.proofs=[];c.ops[0].contract.blockers=[];
  assert.ok(errors(c).includes('WRITE_FIELDS'));assert.ok(errors(c).includes('EMPTY_CONTRACT'));
});
test('a V3 operator cannot disappear from the catalogue or carry unknown catalogue root fields',()=>{
  const c=fresh();c.ops.pop();assert.ok(errors(c).includes('DOCUMENT_COVERAGE'));
  c.ops=[];assert.ok(errors(c).includes('CATALOG_EMPTY'));
  c.unexpectedMapping={};assert.ok(errors(c).includes('CATALOG_FIELDS'));
});
test('summary write ceilings/effects cannot drift from detailed contracts',()=>{
  const c=fresh();c.ops[0].writeScope.push('arbitrary external target');assert.ok(errors(c).includes('WRITE_SCOPE_DRIFT'));
  c.ops[0].sideEffects.push('delete all');assert.ok(errors(c).includes('CATALOG_DRIFT'));
});
test('all completion profiles refer to actually supported core profiles',()=>{
  const profileFile=JSON.parse(fs.readFileSync(path.join(repository,'v3/schemas/profiles.json'),'utf8'));
  const profiles=profileFile.profiles??profileFile;
  const result=validateCatalog(catalogue,{root,repositoryRoot:repository,profiles});
  assert.deepEqual(result.errors,[]);
  const c=fresh();c.ops[0].completionProfile='fake-profile';c.ops[0].nodeKinds=['fake-profile'];c.ops[0].contract.completionProfile='fake-profile';
  assert.ok(validateCatalog(c,{profiles}).errors.some(e=>e.code==='UNKNOWN_PROFILE'));
});
test('conditional reused domain references must resolve; a fabricated reference cannot pass',()=>{
  const c=fresh();const op=c.ops.find(o=>o.id==='backend.generate');
  assert.ok(op.supportingReferences.length>0);
  op.supportingReferences[0].path='knowledge/patterns/not-real/INDEX.md';
  assert.ok(errors(c).includes('DOMAIN_REFERENCE'));
});
test('consumer graph policy cannot add prerequisites, accept NA or dispatch a successor',()=>{
  const c=fresh();const op=c.ops.find(o=>o.id==='uat.verify');
  assert.equal(op.contract.graphPolicy.mode,'read-only');
  op.contract.writes.find(w=>w.id==='node').fields.push('dependsOn');
  assert.ok(errors(c).includes('CONSUMER_GRAPH_WRITE'));
  op.contract.graphPolicy.prerequisiteState='na';op.contract.graphPolicy.dispatch='automatic';
  assert.ok(errors(c).includes('GRAPH_POLICY'));
  const planning=catalogue.ops.find(o=>o.id==='goal.setup');
  assert.equal(planning.contract.graphPolicy.mode,'selected-scope-only');
  assert.ok(planning.contract.writes.find(w=>w.id==='node').fields.includes('dependsOn'));
});
test('quality verification records real runner output in evidence and completes without staling its own semantic inputs',()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'work3-op-proof-'));
  try {
    const work=path.join(temporary,'.work'),nodeDir=path.join(work,'example','quality'),evidenceDir=path.join(nodeDir,'evidence','actual-gate');
    fs.mkdirSync(evidenceDir,{recursive:true});
    fs.writeFileSync(path.join(work,'workspace.yaml'),JSON.stringify({schema:'work/workspace@1',id:'synthetic-operator-test'}));
    const metadata={schema:'work/node@1',id:'quality-piece',kind:'operations',required:true,state:'todo',assertions:['selected-gate']};
    const body='# Selected quality gate\n\nRun the selected synthetic arithmetic test; expected: the one required test passes.\n';
    const nodeFile=path.join(nodeDir,'node.md');
    const nodeBytes=meta=>'---\n'+JSON.stringify(meta)+'\n---\n'+body;
    fs.writeFileSync(nodeFile,nodeBytes(metadata));
    const before=validateWorkspace(work);assert.equal(before.ok,true);
    const digest=before.nodes.find(n=>n.id===metadata.id).inputDigest;
    fs.writeFileSync(path.join(temporary,'gate.test.mjs'),"import test from 'node:test'; import assert from 'node:assert/strict'; test('selected arithmetic',()=>assert.equal(1+1,2));\n");
    const childEnvironment={...process.env};delete childEnvironment.NODE_TEST_CONTEXT;
    const observed=spawnSync(process.execPath,['--test','gate.test.mjs'],{cwd:temporary,encoding:'utf8',env:childEnvironment});
    assert.equal(observed.status,0,observed.stderr);
    const output=observed.stdout+observed.stderr;
    assert.match(output,/selected arithmetic/);
    fs.writeFileSync(path.join(evidenceDir,'gate-output.txt'),output);
    const report='Observed selected node test runner exit: '+observed.status+'.\nThis is synthetic framework testing, not product acceptance.\n';
    fs.writeFileSync(path.join(evidenceDir,'result.md'),report);
    const evidence={schema:'work/evidence@1',id:'actual-gate',nodeId:metadata.id,inputDigest:digest,outcome:'pass',assertions:[{id:'selected-gate',outcome:'pass',observation:'Executed node --test gate.test.mjs in the isolated fixture; actual exit 0 and selected arithmetic case present in retained runner output.'}],assets:[{path:'gate-output.txt',sha256:sha256(output)},{path:'result.md',sha256:sha256(report)}]};
    fs.writeFileSync(path.join(evidenceDir,'manifest.yaml'),JSON.stringify(evidence));
    fs.writeFileSync(nodeFile,nodeBytes({...metadata,state:'done',completion:{inputDigest:digest,evidence:['actual-gate']}}));
    const after=validateWorkspace(work);assert.deepEqual(after.errors,[]);assert.equal(after.nodes[0].effectiveState,'done');assert.equal(after.nodes[0].inputDigest,digest);
    fs.appendFileSync(nodeFile,'\n## Actual gate result\nThis post-proof output must not be written into the semantic specification.\n');
    const stale=validateWorkspace(work);assert.equal(stale.ok,false);assert.notEqual(stale.nodes[0].inputDigest,digest);assert.equal(stale.nodes[0].effectiveState,'suspended');
  } finally {
    assert.equal(path.dirname(temporary),os.tmpdir());
    assert.ok(path.basename(temporary).startsWith('work3-op-proof-'));
    fs.rmSync(temporary,{recursive:true,force:true});
  }
});
test('declared design source byte changes suspend only linked graph; a new output capture does not authorize redesign',()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'work3-op-graph-'));
  try {
    const work=path.join(temporary,'.work');fs.mkdirSync(work);
    fs.writeFileSync(path.join(work,'workspace.yaml'),JSON.stringify({schema:'work/workspace@1',id:'synthetic-graph-scope'}));
    const sourceDir=path.join(work,'_resources','design','selected');fs.mkdirSync(path.join(sourceDir,'assets'),{recursive:true});
    const sourceFile=path.join(sourceDir,'assets','direction.svg');
    fs.writeFileSync(sourceFile,'<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>');
    fs.writeFileSync(path.join(sourceDir,'resource.yaml'),JSON.stringify({schema:'work/resource@1',id:'selected-design',kind:'design',owner:'synthetic-owner',revision:'1',details:{purpose:'synthetic graph binding, not product acceptance'},files:[{path:'assets/direction.svg'}]}));
    const specs=[
      {id:'art-direction',refs:['selected-design']},
      {id:'ui-design',dependsOn:['art-direction'],refs:['selected-design']},
      {id:'frontend',dependsOn:['ui-design']},
      {id:'uat',dependsOn:['frontend']},
      {id:'unrelated'}
    ];
    const nodePaths=new Map(),metadata=new Map();
    function render(meta){return '---\n'+JSON.stringify(meta)+'\n---\n# Synthetic graph node\nScope and expected assertion are fixed; this fixture is not real product UAT.\n';}
    for(const spec of specs){const folder=path.join(work,spec.id);fs.mkdirSync(folder);const file=path.join(folder,'node.md');const meta={schema:'work/node@1',kind:'operations',required:true,state:'todo',assertions:['fixture-proof'],...spec};metadata.set(spec.id,meta);nodePaths.set(spec.id,file);fs.writeFileSync(file,render(meta));}
    for(const spec of specs){
      const current=validateWorkspace(work);assert.equal(current.ok,true,JSON.stringify(current.errors));
      const node=current.nodes.find(n=>n.id===spec.id);assert.equal(node.eligible,true);
      const e=path.join(work,spec.id,'evidence','initial');fs.mkdirSync(e,{recursive:true});
      fs.writeFileSync(path.join(e,'manifest.yaml'),JSON.stringify({schema:'work/evidence@1',id:spec.id+'-proof',nodeId:spec.id,inputDigest:node.inputDigest,outcome:'pass',assertions:[{id:'fixture-proof',outcome:'pass',observation:'Synthetic contract fixture observation; not a product verification claim.'}],assets:[]}));
      fs.writeFileSync(nodePaths.get(spec.id),render({...metadata.get(spec.id),state:'done',completion:{inputDigest:node.inputDigest,evidence:[spec.id+'-proof']}}));
    }
    const complete=validateWorkspace(work);assert.equal(complete.ok,true);assert.ok(complete.nodes.every(n=>n.effectiveState==='done'));
    const savedNodes=new Map([...nodePaths].map(([id,file])=>[id,fs.readFileSync(file,'utf8')]));
    // A freshly captured OUTPUT has its own new evidence bundle; it is not promoted into resource.files.
    const captureDir=path.join(work,'ui-design','evidence','new-capture');fs.mkdirSync(captureDir,{recursive:true});
    const capture=Buffer.from('89504e470d0a1a0a','hex');fs.writeFileSync(path.join(captureDir,'output.png'),capture);
    fs.writeFileSync(path.join(captureDir,'manifest.yaml'),JSON.stringify({schema:'work/evidence@1',id:'new-output-only',nodeId:'ui-design',inputDigest:complete.nodes.find(n=>n.id==='ui-design').inputDigest,outcome:'inconclusive',assertions:[{id:'output-only',outcome:'inconclusive',observation:'Synthetic new output artifact, not accepted design authority.'}],assets:[{path:'output.png',sha256:sha256(capture)}]}));
    const captured=validateWorkspace(work);assert.equal(captured.ok,true,JSON.stringify(captured.errors));assert.ok(captured.nodes.every(n=>n.effectiveState==='done'));
    fs.writeFileSync(sourceFile,'<svg xmlns="http://www.w3.org/2000/svg"><rect width="20" height="10"/></svg>');
    const changed=validateWorkspace(work);assert.equal(changed.ok,false);
    for(const id of ['art-direction','ui-design','frontend','uat']) assert.equal(changed.nodes.find(n=>n.id===id).effectiveState,'suspended',id);
    assert.equal(changed.nodes.find(n=>n.id==='unrelated').effectiveState,'done');
    for(const [id,file] of nodePaths) assert.equal(fs.readFileSync(file,'utf8'),savedNodes.get(id),'Validation preserves old completion/evidence refs');
    // NA does not supply an account/module prerequisite even in a fresh valid scope.
    const accountDir=path.join(work,'account');fs.mkdirSync(accountDir);fs.writeFileSync(path.join(accountDir,'node.md'),render({schema:'work/node@1',id:'account',kind:'operations',required:true,state:'na',naReason:'Synthetic decision: account not provisioned'}));
    const moduleDir=path.join(work,'module');fs.mkdirSync(moduleDir);fs.writeFileSync(path.join(moduleDir,'node.md'),render({schema:'work/node@1',id:'module',kind:'operations',required:true,state:'todo',dependsOn:['account'],assertions:['module-proof']}));
    const gated=validateWorkspace(work).nodes.find(n=>n.id==='module');assert.equal(gated.eligible,false);assert.ok(gated.blockedBy.includes('account'));
  } finally {assert.equal(path.dirname(temporary),os.tmpdir());assert.ok(path.basename(temporary).startsWith('work3-op-graph-'));fs.rmSync(temporary,{recursive:true,force:true});}
});
