import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import Ajv2020 from 'ajv/dist/2020.js';
import {parseYaml,stringifyYaml} from '../core/yaml.mjs';
import {sha256,validateWorkspace} from '../core/index.mjs';
import {scanCanonicalWork,sourceStalenessClosure,SourceStalenessInputError} from '../kernel/source-staleness.mjs';
import {checkStalesMain} from '../scripts/check-stales.mjs';

const script=path.resolve(new URL('../scripts/check-stales.mjs',import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/,value=>value.slice(1)));
const run=(cwd,args)=>{const result=spawnSync(args[0],args.slice(1),{cwd,encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stderr);return result.stdout.trim();};

function fixture(t,{aggregate=false}={}){
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'starci-stales-')),repo=path.join(base,'repo'),work=path.join(base,'work');
  fs.mkdirSync(repo);fs.mkdirSync(work);t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
  run(repo,['git','init','-q']);run(repo,['git','config','user.email','fixture@example.test']);run(repo,['git','config','user.name','Fixture']);run(repo,['git','remote','add','origin','https://example.test/org/repo.git']);
  const source=(name,body=`export const ${name} = true;\n`)=>{const file=path.join(repo,'src',`${name}.ts`);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,body);};
  for(const name of ['upstream','target','unrelated'])source(name);
  run(repo,['git','add','.']);run(repo,['git','commit','-qm','fixture source']);const commit=run(repo,['git','rev-parse','HEAD']);
  const put=(relative,value)=>{const file=path.join(work,...relative.split('/'));fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,stringifyYaml(value));return file;};
  put('workspace.yaml',{schema:'work/workspace@1',id:'staleness-fixture'});
  if(aggregate)put('features/demo/index.yaml',{schema:'work/node@2',id:'demo',kind:'group',required:true,description:'Synthetic aggregate target.'});
  const records={
    upstream:{schema:'work/node@2',id:'upstream',kind:'implementation',required:true,state:'todo',assertions:['gate'],description:'Synthetic upstream implementation.'},
    target:{schema:'work/node@2',id:'target',kind:'implementation',required:true,state:'todo',dependsOn:['upstream'],assertions:['gate'],description:'Synthetic target implementation.'},
    unrelated:{schema:'work/node@2',id:'unrelated',kind:'implementation',required:true,state:'todo',assertions:['gate'],description:'Synthetic unrelated implementation.'}
  };
  const locations={upstream:'features/demo/implementation/backend/upstream/index.yaml',target:'features/demo/implementation/backend/target/index.yaml',unrelated:'features/other/implementation/backend/index.yaml'};
  for(const id of Object.keys(records))put(locations[id],records[id]);
  const initial=validateWorkspace(work);assert.equal(initial.ok,true,JSON.stringify(initial.errors));
  for(const id of Object.keys(records)){
    const node=initial.nodes.find(item=>item.id===id),identity={schema:'starci/source-identity@1',repositories:[{repository:'repo',origin:'https://example.test/org/repo.git',state:'committed',commit,coverage:{kind:'scoped',paths:[`src/${id}.ts`],dependencyCoverage:'Synthetic direct file only.',limitations:['No runtime behavior was exercised.']}}]},evidenceId=`${id}-proof`;
    records[id].state='done';records[id].completion={inputDigest:node.inputDigest,evidence:[evidenceId],sourceIdentity:identity};put(locations[id],records[id]);
    const evidencePath=locations[id].replace(/index\.yaml$/u,`evidence/${evidenceId}/manifest.yaml`);
    put(evidencePath,{schema:'work/evidence@1',id:evidenceId,nodeId:id,inputDigest:node.inputDigest,outcome:'pass',assertions:[{id:'gate',outcome:'pass',observation:'Synthetic fixture check only.'}],assets:[],sourceIdentity:identity});
  }
  const checked=validateWorkspace(work);assert.equal(checked.ok,true,JSON.stringify(checked.errors));
  const scan=(targets=['target'])=>scanCanonicalWork({workRoot:work,repositories:{repo},targets});
  return {base,repo,work,commit,put,records,locations,source,scan};
}

test('report schema compiles and a canonical Work fixture is deterministic and clean',t=>{
  const f=fixture(t),schema=parseYaml(fs.readFileSync(new URL('../schemas/source-staleness.schema.yaml',import.meta.url),'utf8')),validate=new Ajv2020({strict:true}).compile(schema);
  const first=f.scan(),second=f.scan();assert.deepEqual(first,second);assert.equal(first.clean,true);assert.deepEqual(first.subjects.map(subject=>subject.id),['target','upstream']);assert.equal(validate(first),true,JSON.stringify(validate.errors));
  const called=checkStalesMain(['--work',f.work,'--repo',`repo=${f.repo}`,'--target','target']);assert.equal(called.exitCode,0);assert.deepEqual(called.report,first);
  const direct=spawnSync(process.execPath,[script,'--work',f.work,'--repo',`repo=${f.repo}`,'--target','target'],{encoding:'utf8',windowsHide:true});assert.equal(direct.status,0,direct.stderr);assert.deepEqual(JSON.parse(direct.stdout),first);
});

test('changed covered bytes require revalidation and affect only typed selected dependents',t=>{
  const f=fixture(t);f.source('upstream','export const upstream = false;\n');const report=f.scan(),finding=report.findings.find(item=>item.code==='SOURCE_INPUTS_CHANGED');
  assert.equal(report.clean,false);assert.equal(finding.status,'revalidation-needed');assert.equal(finding.category,'source-drift');const impact=report.impactGraph.impactSets.find(item=>item.id===finding.impactSetId);assert.deepEqual(impact.affectedNodeIds,['target','upstream']);assert.ok(report.impactGraph.edges.some(edge=>edge.from==='upstream'&&edge.to==='target'&&edge.relation==='dependsOn'));assert.ok(!report.subjects.some(subject=>subject.id==='unrelated'));assert.equal(finding.repairCandidate.authorized,false);
});

test('aggregate targets include descendants and split semantic owners join the closure',t=>{
  const f=fixture(t,{aggregate:true});f.source('upstream','export const upstream = false;\n');const report=f.scan(['demo']);assert.ok(report.subjects.some(subject=>subject.id==='upstream'));assert.ok(report.findings.some(item=>item.nodeId==='upstream'&&item.code==='SOURCE_INPUTS_CHANGED'));
  const nodes=[{id:'parent',path:'features/x/index.yaml',kind:'group',children:['fr'],dependsOn:[],refs:[]},{id:'fr',path:'features/x/business/srs/fr/index.yaml',kind:'business',children:[],dependsOn:[],refs:[]},{id:'rule',path:'features/x/business/srs/rule/index.yaml',kind:'business',children:[],dependsOn:[],refs:[]}],raw=new Map([
    ['parent',{id:'parent'}],['fr',{id:'fr',extensions:{work3:{srs:{schema:'starci/srs-functional-requirement@1',id:'FR-1',businessRuleRefs:['BR-1']}}}}],['rule',{id:'rule',extensions:{work3:{srs:{schema:'starci/srs-business-rule@1',id:'BR-1',decisionRefs:[]}}}}]
  ]);assert.deepEqual(sourceStalenessClosure(nodes,['fr'],raw).map(node=>node.id),['fr','parent','rule']);
});

test('malformed child cycles and semantic arrays terminate without internal failure',{timeout:1000},()=>{
  const nodes=[{id:'a',path:'a/index.yaml',kind:'group',children:['b'],dependsOn:[],refs:[]},{id:'b',path:'a/b/index.yaml',kind:'group',children:['a'],dependsOn:[],refs:[]}],raw=new Map([['a',{id:'a',extensions:{work3:{srs:{schema:'starci/srs-functional-requirement@1',id:'FR',businessRuleRefs:{bad:true}}}}}],['b',{id:'b'}]]);assert.deepEqual(sourceStalenessClosure(nodes,['a'],raw).map(node=>node.id),['a','b']);
});

test('an unrelated commit does not invalidate unchanged scoped coverage',t=>{
  const f=fixture(t);fs.writeFileSync(path.join(f.repo,'README.md'),'unrelated\n');run(f.repo,['git','add','README.md']);run(f.repo,['git','commit','-qm','unrelated commit']);const report=f.scan();assert.equal(report.clean,true);assert.notEqual(report.currentInputs.repositories[0].head,f.commit);
});

test('missing declared source and stale evidence remain distinct',t=>{
  const f=fixture(t);fs.rmSync(path.join(f.repo,'src/upstream.ts'));let report=f.scan();let finding=report.findings.find(item=>item.code==='SOURCE_PATH_MISSING');assert.equal(finding.status,'missing');assert.equal(finding.category,'source-drift');
  const nodeFile=path.join(f.work,...f.locations.target.split('/')),node=parseYaml(fs.readFileSync(nodeFile,'utf8'));node.description='Changed accepted implementation scope.';fs.writeFileSync(nodeFile,stringifyYaml(node));report=f.scan();assert.ok(report.findings.some(item=>item.nodeId==='target'&&item.category==='evidence-invalid'&&item.status==='revalidation-needed'));assert.ok(!report.findings.some(item=>item.nodeId==='target'&&item.code==='IMPLEMENTATION_PROOF_MISSING'));
});

test('an unfinished implementation reports missing proof without claiming code is absent',t=>{
  const f=fixture(t),file=path.join(f.work,...f.locations.target.split('/')),node=parseYaml(fs.readFileSync(file,'utf8'));node.state='todo';delete node.completion;fs.writeFileSync(file,stringifyYaml(node));
  const report=f.scan(),finding=report.findings.find(item=>item.code==='IMPLEMENTATION_PROOF_MISSING');assert.equal(finding.status,'missing');assert.equal(finding.category,'evidence-invalid');assert.equal(finding.operator,'review.verify');assert.match(finding.detail,/does not prove.*source code is absent/u);
});

test('dirty unrelated paths stay out of scoped coverage while dirty covered files do not',t=>{
  const f=fixture(t);fs.writeFileSync(path.join(f.repo,'notes.txt'),'untracked unrelated\n');assert.equal(f.scan().clean,true);fs.appendFileSync(path.join(f.repo,'src/target.ts'),'// changed\n');assert.ok(f.scan().findings.some(item=>item.code==='SOURCE_INPUTS_CHANGED'&&item.nodeId==='target'));
});

test('sourceRefs use exact path revisions and stack paths route to runtime operations',t=>{
  const f=fixture(t);fs.mkdirSync(path.join(f.repo,'.stacks'),{recursive:true});fs.writeFileSync(path.join(f.repo,'.stacks/application-stacks.yaml'),'schema: synthetic\n');run(f.repo,['git','add','.stacks/application-stacks.yaml']);run(f.repo,['git','commit','-qm','stack']);const revision=run(f.repo,['git','rev-parse','HEAD']);
  const file=path.join(f.work,...f.locations.target.split('/')),node=parseYaml(fs.readFileSync(file,'utf8'));node.sourceRefs=[{repository:'repo',revision,path:'.stacks/application-stacks.yaml',observation:'Synthetic stack source.'}];fs.writeFileSync(file,stringifyYaml(node));
  fs.appendFileSync(path.join(f.repo,'.stacks/application-stacks.yaml'),'changed: true\n');const finding=f.scan().findings.find(item=>item.bindingId.includes('sourceRef'));
  assert.equal(finding.category,'stack-drift');assert.equal(finding.status,'revalidation-needed');assert.equal(finding.operator,'runtime.operate');
});

test('unavailable mappings are unknown and invalid targets fail with exit 2',t=>{
  const f=fixture(t),report=scanCanonicalWork({workRoot:f.work,repositories:{other:f.repo},targets:['target']});assert.ok(report.findings.some(item=>item.category==='input-unavailable'&&item.code==='REPOSITORY_MAPPING_MISSING'&&item.status==='unverifiable'));
  const invalid=checkStalesMain(['--work',f.work,'--repo',`repo=${f.repo}`,'--target','missing']);assert.equal(invalid.exitCode,2);assert.equal(invalid.report.code,'UNKNOWN_TARGET');
  assert.throws(()=>scanCanonicalWork({workRoot:f.work,repositories:{repo:f.repo},targets:['../escape']}),SourceStalenessInputError);
});

test('global malformed Work, malformed sourceRefs, and legacy codeRefs cannot report clean',t=>{
  const f=fixture(t),broken=path.join(f.base,'broken-work');fs.mkdirSync(broken);fs.writeFileSync(path.join(broken,'workspace.yaml'),'not: [valid');let report=scanCanonicalWork({workRoot:broken,repositories:{repo:f.repo}});assert.equal(report.clean,false);assert.equal(report.subjects.length,0);assert.ok(report.findings.some(item=>item.nodeId===null&&item.layer==='work'));
  const targetFile=path.join(f.work,...f.locations.target.split('/')),node=parseYaml(fs.readFileSync(targetFile,'utf8'));node.sourceRefs=[{repository:'repo',revision:'not-a-sha',path:'',observation:''}];fs.writeFileSync(targetFile,stringifyYaml(node));report=f.scan();assert.ok(report.findings.some(item=>item.code==='MALFORMED_SOURCE_REFERENCE'));
  delete node.sourceRefs;const evidenceFile=path.join(path.dirname(targetFile),'evidence/target-proof/manifest.yaml'),evidence=parseYaml(fs.readFileSync(evidenceFile,'utf8'));node.completion.sourceIdentity.repositories={bad:true};evidence.sourceIdentity=structuredClone(node.completion.sourceIdentity);fs.writeFileSync(targetFile,stringifyYaml(node));fs.writeFileSync(evidenceFile,stringifyYaml(evidence));report=f.scan();assert.ok(report.findings.some(item=>item.code==='MALFORMED_SOURCE_IDENTITY'));
  const legacy={repository:'repo',commit:f.commit};delete node.completion.sourceIdentity;node.completion.codeRefs=[legacy];delete evidence.sourceIdentity;evidence.codeRefs=[legacy];fs.writeFileSync(targetFile,stringifyYaml(node));fs.writeFileSync(evidenceFile,stringifyYaml(evidence));report=f.scan();assert.ok(report.findings.some(item=>item.code==='LEGACY_CODE_REFS_COVERAGE_UNKNOWN'&&item.status==='unverifiable'));
});

test('a wrong or credentialed repository origin cannot satisfy source identity',t=>{
  const f=fixture(t);run(f.repo,['git','remote','set-url','origin','https://example.test/other/repo.git']);let report=f.scan(),finding=report.findings.find(item=>item.code==='REPOSITORY_ORIGIN_MISMATCH');assert.equal(finding.status,'unverifiable');assert.equal(JSON.stringify(finding).includes('other/repo'),false);
  run(f.repo,['git','remote','set-url','origin','https://token@example.test/org/repo.git']);report=f.scan();finding=report.findings.find(item=>item.code==='REPOSITORY_ORIGIN_MISMATCH');assert.equal(finding.observed.credentialFree,false);assert.equal(JSON.stringify(report).includes('token@'),false);
});

test('a symlinked source parent is unsafe even when the declared leaf looks ordinary',t=>{
  const f=fixture(t),outside=path.join(f.base,'outside');fs.mkdirSync(outside);fs.writeFileSync(path.join(outside,'upstream.ts'),'outside\n');fs.writeFileSync(path.join(f.repo,'.gitignore'),'linked/\n');run(f.repo,['git','add','.gitignore']);run(f.repo,['git','commit','-qm','ignore fixture link']);fs.symlinkSync(outside,path.join(f.repo,'linked'),'junction');
  const file=path.join(f.work,...f.locations.upstream.split('/')),node=parseYaml(fs.readFileSync(file,'utf8'));node.completion.sourceIdentity.repositories[0].coverage.paths=['linked/upstream.ts'];fs.writeFileSync(file,stringifyYaml(node));const evidenceFile=path.join(path.dirname(file),'evidence/upstream-proof/manifest.yaml'),evidence=parseYaml(fs.readFileSync(evidenceFile,'utf8'));evidence.sourceIdentity=structuredClone(node.completion.sourceIdentity);fs.writeFileSync(evidenceFile,stringifyYaml(evidence));
  const finding=f.scan().findings.find(item=>item.code==='SOURCE_COVERAGE_UNREADABLE');assert.equal(finding.status,'unverifiable');assert.equal(finding.category,'input-unavailable');
});

test('before and after fingerprints fail closed when source or Work changes during a scan',t=>{
  const f=fixture(t),input={workRoot:f.work,repositories:{repo:f.repo},targets:['target']};let report=scanCanonicalWork(input,{afterMeasurements:()=>fs.appendFileSync(path.join(f.repo,'src/target.ts'),'// race\n')});assert.ok(report.findings.some(item=>item.code==='SCAN_INPUT_CHANGED'&&item.layer==='source'));
  report=scanCanonicalWork(input,{afterMeasurements:()=>fs.appendFileSync(path.join(f.work,'workspace.yaml'),'\n')});assert.ok(report.findings.some(item=>item.code==='SCAN_INPUT_CHANGED'&&item.layer==='work'));
});

test('a stored dirty identity is never auto-blessed as current source',t=>{
  const f=fixture(t),file=path.join(f.work,...f.locations.target.split('/')),node=parseYaml(fs.readFileSync(file,'utf8')),identity=node.completion.sourceIdentity.repositories[0];
  identity.state='dirty';identity.baseCommit=identity.commit;delete identity.commit;identity.snapshot={artifact:'snapshot.patch',sha256:sha256('synthetic snapshot')};
  const evidenceFile=path.join(path.dirname(file),'evidence/target-proof/manifest.yaml'),evidence=parseYaml(fs.readFileSync(evidenceFile,'utf8'));evidence.sourceIdentity=structuredClone(node.completion.sourceIdentity);evidence.assets=[{path:'snapshot.patch',sha256:identity.snapshot.sha256}];fs.writeFileSync(path.join(path.dirname(evidenceFile),'snapshot.patch'),'synthetic snapshot');fs.writeFileSync(file,stringifyYaml(node));fs.writeFileSync(evidenceFile,stringifyYaml(evidence));
  const report=f.scan(),finding=report.findings.find(item=>item.code==='DIRTY_SNAPSHOT_COMPARISON_UNDEFINED');assert.equal(finding.status,'unverifiable');assert.equal(finding.category,'input-unavailable');
});
