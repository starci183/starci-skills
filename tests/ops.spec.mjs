import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { outputs, generate, root } from '../ops/generate.mjs';
import { ops as sourceContracts } from '../ops/contracts.mjs';
import { validateCatalog } from '../ops/validate.mjs';
import { validateWorkspace, sha256 } from '../core/index.mjs';
import { parseYaml } from '../core/yaml.mjs';
const repository=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const catalogue=JSON.parse(outputs().get('catalog.json'));
const fresh=()=>structuredClone(catalogue);
const errors=cat=>validateCatalog(cat,{root,repositoryRoot:repository,documents:outputs()}).errors.map(e=>e.code);
const resolvePublicKnowledge=rel=>[path.join(repository,rel),path.join(repository,'.dist',rel)].find(candidate=>fs.existsSync(candidate));

test('implementation and code review route to the same resolvable coding convention contract',()=>{
  const generated=JSON.parse(outputs().get('catalog.json'));
  for(const id of ['backend.implement','interface.implement','review.verify']) {
    const refs=generated.ops.find(op=>op.id===id).supportingReferences;
    const convention=refs.find(ref=>ref.path==='knowledge/coding-reference.json');
    assert.ok(convention,`${id} must expose the shared convention contract`);
    const resolved=resolvePublicKnowledge(convention.path);
    assert.ok(resolved,`resolvable ${convention.path}`);
    const document=JSON.parse(fs.readFileSync(resolved,'utf8'));
    assert.equal(document.schema,'starci/knowledge@1');
    assert.ok(document.sections.length>0);
  }
  assert.ok(!generated.ops.find(op=>op.id==='business.decide').supportingReferences.some(ref=>ref.path==='knowledge/coding-reference.json'));
});

test('current V3 contracts have complete resolvable catalogue identities and English authority',()=>{
  const result=validateCatalog(catalogue,{root,repositoryRoot:repository,documents:outputs()});
  assert.deepEqual(result.errors,[]);
  assert.deepEqual(catalogue.ops.map(op=>op.id).sort(),sourceContracts.map(op=>op.id).sort());
  assert.deepEqual(Object.keys(catalogue).sort(),['commonDocument','ops','schema']);
  assert.ok(catalogue.ops.some(o=>o.id==='workspace.manage'));
  assert.ok(catalogue.ops.some(o=>o.id==='scope.retire'));
});
test('UAT contract rejects parallel/visual execution and incomplete cleanup or recording authority',()=>{
  for(const [key,value] of [['flowOrder','parallel'],['appearanceScoring',true],['uxAnswers','scores'],['cleanup','optional'],['recording','screenshots-only'],['paidAI','unlimited']]) {
    const c=fresh();c.ops.find(o=>o.id==='uat.verify').contract.uatPolicy[key]=value;
    assert.ok(errors(c).includes('UAT_POLICY'),key);
  }
  for(const id of ['sequence','ux','recording','scripts','cleanup']) {
    const c=fresh(),op=c.ops.find(o=>o.id==='uat.verify');op.contract.proofs=op.contract.proofs.filter(p=>p.id!==id);
    assert.ok(errors(c).includes('UAT_BINDING'),id);
  }
  const c=fresh(),op=c.ops.find(o=>o.id==='uat.verify');op.contract.reads=op.contract.reads.filter(r=>r.id!=='effects');
  assert.ok(errors(c).includes('UAT_BINDING'));
});

test('all generated authority/catalogue bytes are reproducible without writes in check mode',()=>{
  const before=outputs();
  assert.deepEqual(outputs(),before);
});
test('operator generation and catalogue validation need only current operator sources and selected domain references',()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'work3-ops-minimal-'));
  try {
    const isolatedRoot=path.join(temporary,'ops');fs.cpSync(root,isolatedRoot,{recursive:true});
    fs.cpSync(path.join(repository,'core'),path.join(temporary,'core'),{recursive:true});
    for(const ref of new Set(catalogue.ops.flatMap(op=>op.supportingReferences.map(r=>r.path)))) {
      const target=path.join(temporary,ref);fs.mkdirSync(path.dirname(target),{recursive:true});
      const sourced=[path.join(repository,ref),path.join(repository,'.dist',ref)].find(candidate=>fs.existsSync(candidate));
      assert.ok(sourced,`missing domain reference fixture for ${ref}`);
      fs.copyFileSync(sourced,target);
    }
    const observed=spawnSync(process.execPath,['--input-type=module','-e',"import {outputs} from './generate.mjs'; if(!outputs().size)process.exit(1)"],{cwd:isolatedRoot,encoding:'utf8'});
    assert.equal(observed.status,0,observed.stderr+observed.stdout);
    assert.deepEqual(fs.readdirSync(temporary).sort(),['core','knowledge','ops']);
    assert.deepEqual(validateCatalog(catalogue,{root:isolatedRoot,repositoryRoot:temporary,documents:outputs()}).errors,[]);
  } finally {assert.equal(path.dirname(temporary),os.tmpdir());assert.ok(path.basename(temporary).startsWith('work3-ops-minimal-'));fs.rmSync(temporary,{recursive:true,force:true});}
});
test('migration contract cannot substitute inferred intent, completed imports or unsafe worktree retirement',()=>{
  const c=fresh(),op=c.ops.find(o=>o.id==='workspace.manage');assert.ok(op);
  const migration=op.contract.executionModes.import;
  assert.equal(migration.graphPolicy.mode,'selected-scope-only');
  migration.migrationPolicy.importState='done';assert.ok(errors(c).includes('MODE_MIGRATION_POLICY'));
  migration.migrationPolicy=structuredClone(catalogue.ops.find(o=>o.id===op.id).contract.executionModes.import.migrationPolicy);
  migration.migrationPolicy.registeredWorktreeRemoval='recursive-delete';assert.ok(errors(c).includes('MODE_MIGRATION_POLICY'));
  migration.reads=migration.reads.filter(r=>r.id!=='custody');assert.ok(errors(c).includes('MODE_MIGRATION_BINDING'));
  delete migration.migrationPolicy;assert.ok(errors(c).includes('MODE_MIGRATION_POLICY'));
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
  c.ops[0].document='review.verify.vi.md';assert.ok(errors(c).includes('DOCUMENT_PATH'));
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
  const c=fresh();const op=c.ops.find(o=>o.id==='backend.implement');op.sideEffects=[];op.contract.sideEffects=[];
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
  const profilePath=[path.join(repository,'.dist/schemas/profiles.json'),path.join(repository,'schemas/profiles.yaml')]
    .find(candidate=>fs.existsSync(candidate));
  assert.ok(profilePath,'profiles schema must resolve from .dist JSON or authored YAML');
  const profileFile=profilePath.endsWith('.yaml')
    ? parseYaml(fs.readFileSync(profilePath,'utf8'))
    : JSON.parse(fs.readFileSync(profilePath,'utf8'));
  const profiles=profileFile.profiles??profileFile;
  const result=validateCatalog(catalogue,{root,repositoryRoot:repository,profiles,documents:outputs()});
  assert.deepEqual(result.errors,[]);
  const c=fresh();c.ops[0].completionProfile='fake-profile';c.ops[0].nodeKinds=['fake-profile'];c.ops[0].contract.completionProfile='fake-profile';
  assert.ok(validateCatalog(c,{profiles}).errors.some(e=>e.code==='UNKNOWN_PROFILE'));
});

test('request analysis cannot acquire source, runtime, release or data effects',()=>{
  const catalog=fresh(), task=catalog.ops.find(o=>o.id==='task.execute').contract;
  assert.deepEqual(task.sideEffects,[]);
  assert.deepEqual(task.writes.map(w=>w.id),['evidence']);
  for(const mutate of [
    x=>x.sideEffects.push('source edit'),
    x=>x.writes.push({id:'source',path:'repository:any',fields:['code'],content:{en:'Mutate code'}}),
    x=>x.adHocPolicy.authority='request-bound-not-unrestricted',
  ]){const changed=fresh();mutate(changed.ops.find(o=>o.id==='task.execute').contract);assert.equal(validateCatalog(changed).ok,false);}
});

test('data correction mode requires schema and readback recovery without arbitrary code',()=>{
  const catalog=fresh(), mode=catalog.ops.find(o=>o.id==='release.deliver').contract.executionModes.migrate;
  assert.equal(mode.dataCorrectionPolicy.arbitraryCode,false);
  assert.equal(mode.dataCorrectionPolicy.adHocSql,false);
  for(const mutate of [
    x=>x.dataCorrectionPolicy.schemaInspection='optional',
    x=>x.dataCorrectionPolicy.postMutationReadback='optional',
    x=>x.dataCorrectionPolicy.arbitraryCode=true,
  ]){const changed=fresh();mutate(changed.ops.find(o=>o.id==='release.deliver').contract.executionModes.migrate);assert.equal(validateCatalog(changed).ok,false);}
});
test('conditional reused domain references must resolve; a fabricated reference cannot pass',()=>{
  const c=fresh();const op=c.ops.find(o=>o.id==='backend.implement');
  assert.ok(op.supportingReferences.length>0);
  op.supportingReferences[0].path='knowledge/patterns/not-real/INDEX.json';
  assert.ok(errors(c).includes('DOMAIN_REFERENCE'));
});
test('draw and FE discovery both expose applicable presentation and Grammar package knowledge',()=>{
  const generated=JSON.parse(outputs().get('catalog.json'));
  for(const id of ['interface.draw','interface.implement']) {
    const refs=generated.ops.find(op=>op.id===id).supportingReferences;
    for(const target of ['knowledge/ui/composition/INDEX.json','knowledge/ui/presentation/INDEX.json','knowledge/grammars/INDEX.json']) {
      assert.equal(refs.filter(ref=>ref.path===target).length,1,`${id}: ${target}`);
      assert.ok(resolvePublicKnowledge(target), target);
    }
  }
  assert.ok(!generated.ops.find(op=>op.id==='backend.implement').supportingReferences.some(ref=>ref.path==='knowledge/grammars/INDEX.json'));
  const draw=generated.ops.find(op=>op.id==='interface.draw').contract;
  assert.ok(draw.reads.some(read=>read.id==='grammar'));
  for(const step of draw.steps.slice(0,3)) assert.ok(step.reads.includes('grammar'));
  assert.deepEqual(validateCatalog(generated,{root,repositoryRoot:repository,documents:outputs()}).errors,[]);
});
test('consumer graph policy cannot add prerequisites, accept NA or dispatch a successor',()=>{
  const c=fresh();const op=c.ops.find(o=>o.id==='uat.verify');
  assert.equal(op.contract.graphPolicy.mode,'read-only');
  op.contract.writes.find(w=>w.id==='node').fields.push('dependsOn');
  assert.ok(errors(c).includes('CONSUMER_GRAPH_WRITE'));
  op.contract.graphPolicy.prerequisiteState='na';op.contract.graphPolicy.dispatch='automatic';
  assert.ok(errors(c).includes('GRAPH_POLICY'));
  const planning=catalogue.ops.find(o=>o.id==='workspace.manage');
  assert.equal(planning.contract.executionModes.prepare.graphPolicy.mode,'selected-scope-only');
  assert.ok(planning.contract.executionModes.prepare.writes.find(w=>w.id==='node').fields.includes('dependsOn'));
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
