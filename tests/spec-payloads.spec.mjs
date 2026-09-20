// Regression coverage for the cohesive SRS and SDS payload validators; not authoring authority.
import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSpecification} from '../scripts/checks/spec/validate.mjs';
import {documentSRS} from './fixtures/srs.mjs';
import {validateSRSBindings} from '../scripts/checks/spec/srs.mjs';
import {documentSDS} from './fixtures/sds.mjs';
import {validateWorkspace,previewCompletion,authoredWorkspace} from '../engine/index.mjs';
import {writeSRSWorkspace} from './fixtures/srs-workspace.mjs';
import {parseYaml,stringifyYaml} from '../engine/yaml.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const schemaValidator=file=>new Ajv2020({allErrors:true,strict:false}).compile(parseYaml(fs.readFileSync(new URL(file,import.meta.url),'utf8')));

function workspace(t,{complete=true}={}){const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-srs-'));writeSRSWorkspace(root,{complete});t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const read=p=>parseYaml(fs.readFileSync(path.join(root,p),'utf8'));const write=(p,v)=>{const file=path.join(root,p);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,stringifyYaml(v));};return {root,read,write,run:()=>validateWorkspace(root)};}

test('folder-owned SRS validates complete ordered behavior and honest NFR targets',()=>{
 const {fr,nfr}=documentSRS();
 assert.deepEqual(validateSpecification(fr),{ok:true,errors:[]});
 assert.deepEqual(validateSpecification(nfr),{ok:true,errors:[]});
});

test('SRS rejects incomplete branches, disconnected acceptance and invented decided targets',()=>{
 for(const mutate of [s=>delete s.content.exceptionFlows[0].resumeAt,s=>s.content.acceptanceCriteria[0].branchRef='missing',s=>s.content.mainFlow[0].stateEffect='']){const s=documentSRS().fr;mutate(s);assert.equal(validateSpecification(s).ok,false);}
 const n=documentSRS().nfr;n.content.target={status:'decided',value:'',decisionOwner:'Owner',missingDecision:'none'};assert.equal(validateSpecification(n).ok,false);
});

test('accepted status, acceptance joins and ref vocabularies fail closed',()=>{
 const a=documentSRS().nfr;a.status='pass';assert.equal(validateSpecification(a).ok,false);
 const b=documentSRS().fr;b.status='pass';assert.equal(validateSpecification(b).ok,false);
 const c=documentSRS().fr;c.content.mainFlow[0].acceptanceIds=['MISSING-AC'];assert.equal(validateSpecification(c).ok,false);
 const d=documentSRS().fr;d.refs.push({type:'typo-unknown-type',nodeId:'missing',itemId:'missing'});assert.equal(validateSpecification(d).ok,false);
});

test('published JSON Schema accepts every SRS node type and rejects representative wrong types',()=>{
 const validate=schemaValidator('../modules/schemas/spec/srs.schema.yaml'),srs=Object.values(documentSRS());for(const spec of srs){assert.equal(validate(spec),true,`${spec.id}: ${JSON.stringify(validate.errors)}`);const bad=structuredClone(spec);bad.refs='not-an-array';assert.equal(validate(bad),false,spec.id);}
 for(const [spec,field,badValue] of [[srs[0],'actors','text'],[srs[1],'scope',[]],[srs[2],'appliesTo','text'],[srs[3],'transitions','text'],[srs[4],'stages','text']]){const bad=structuredClone(spec);bad.content[field]=badValue;assert.equal(validate(bad),false,`${spec.nodeType}.${field}`);}
});

test('cohesive specification@1 and SDS sds@1 documents remain valid under unchanged validators',()=>{
 assert.deepEqual(validateSpecification(documentSDS()),{ok:true,errors:[]});
 // The compiled examples/nivo-setup-business.json projection was the build output of the deleted examples/nivo-setup-business.yaml
 // (owner ruling: examples/ keeps only the todo-app repositories). tests/fixtures/nested-business/ carries a real
 // starci/specification@1 business document (the deleted nested-business example's SRS leaf), which this test's
 // own name asks for more literally than the deleted file did.
 const business=parseYaml(fs.readFileSync(new URL('fixtures/nested-business/knowledge/business/srs/documents/update/index.yaml',import.meta.url),'utf8')).extensions.work3.specification;
 assert.deepEqual(validateSpecification(business),{ok:true,errors:[]});
});

test('untagged SDS imports retain the portable digest baseline',t=>{
 const f=workspace(t,{complete:false}),make=(id,spec)=>({schema:'work/node@1',id,kind:'architecture',required:true,state:'todo',description:`Portable legacy ${id}.`,extensions:{work3:{specification:spec}}}),owner=documentSDS(),consumer=documentSDS();consumer.designRefs=[{nodeId:'legacy-baseline-owner',viewIds:['client']}];consumer.views.find(v=>v.kind==='structure').content.dependencies.push('legacy-baseline-owner#client');
 const business=parseYaml(fs.readFileSync(new URL('fixtures/nested-business/knowledge/business/srs/documents/update/index.yaml',import.meta.url),'utf8'));f.write('module/legacy-baseline/business/index.yaml',business);const ownerNode=make('legacy-baseline-owner',owner);ownerNode.refs=['example.business.srs.documents.update'];f.write('module/legacy-baseline/owner/index.yaml',ownerNode);const consumerNode=make('legacy-baseline-consumer',consumer);consumerNode.refs=['example.business.srs.documents.update','legacy-baseline-owner'];f.write('module/legacy-baseline/consumer/index.yaml',consumerNode);const result=f.run();assert.ok(result.ok,JSON.stringify(result.errors));assert.equal(result.nodes.find(n=>n.id==='legacy-baseline-consumer').inputDigest,'7c0bd407ab7093943e8f857b986581b45024c19035fe1f5bc8bc2466391905bf');
});

test('SRS typed refs resolve exact owners and reject cross-version substitution',()=>{
 const {fr,nfr}=documentSRS(),nodes=[{meta:{id:'srs-fr-command',kind:'business',extensions:{work3:{specification:fr}}}},{meta:{id:'srs-nfr-command',kind:'business',extensions:{work3:{specification:nfr}}}}];
 assert.deepEqual(validateSRSBindings(nfr,{nodes,allowedNodeIds:new Set(nodes.map(n=>n.meta.id))}),[]);
 nodes[0].meta.extensions.work3.specification={schema:'starci/specification@1',id:'FR-CMD-01'};
 assert.match(validateSRSBindings(nfr,{nodes,allowedNodeIds:new Set(nodes.map(n=>n.meta.id))})[0],/Unbound/);
});

test('real folder-owned SRS tree validates reviewed done through all public workspace APIs',t=>{
 const f=workspace(t),validated=f.run();assert.ok(validated.ok,JSON.stringify(validated.errors));assert.ok(validated.nodes.every(n=>n.effectiveState==='done'));
 const fr=validated.nodes.find(n=>n.id==='srs-fr-command');const preview=previewCompletion(f.root,{'srs-fr-command':fr.completion});assert.ok(preview.ok,JSON.stringify(preview.errors));assert.equal(preview.nodes.find(n=>n.id==='srs-fr-command').effectiveState,'done');
 const authored=authoredWorkspace(f.root,['srs-fr-command']);assert.ok(authored.ok,JSON.stringify(authored.errors));assert.equal(authored.authoredBinding.length,1);assert.match(authored.authoredBinding[0].invariantDigest,/^[a-f0-9]{64}$/);
});

test('workspace rejects wrong SRS layout/type, duplicate item IDs and malformed typed targets',t=>{
 const cases=[
  ['SRS_NODE_TYPE',f=>{const p='module/business/srs/data/command-request/index.yaml',m=f.read(p);m.extensions.work3.specification.nodeType='business-rule';f.write(p,m);}],
  ['SRS_ITEM_ID',f=>{const p='module/business/srs/business-rules/recipient-scope/index.yaml',m=f.read(p);m.extensions.work3.specification.id='FR-CMD-01';f.write(p,m);}],
  ['SRS_BINDING',f=>{const p='module/business/srs/non-functional-requirements/reliability/index.yaml',m=f.read(p);m.extensions.work3.specification.refs[0].nodeId='missing-owner';f.write(p,m);}],
  ['SRS_BINDING',f=>{const p='module/business/srs/non-functional-requirements/reliability/index.yaml',m=f.read(p);m.extensions.work3.specification.refs[0].type='business-rule';f.write(p,m);}]
 ];
 for(const [code,mutate] of cases){const f=workspace(t);mutate(f);const result=f.run();assert.equal(result.ok,false,mutate.toString());assert.ok(result.errors.some(e=>e.code===code),JSON.stringify(result.errors));}
});

test('all deterministic SRS joins and same-owner journey flow relationship fail closed',t=>{
 for(const [code,file,mutate] of [
  ['SRS_GRAPH','module/business/srs/business-rules/recipient-scope/index.yaml',s=>s.content.appliesTo=['MISSING-FR']],
  ['SRS_GRAPH','module/business/srs/data/command-request/index.yaml',s=>s.content.transitions[0].ruleRefs=['MISSING-BR']],
  ['SRS_JOURNEY_OWNER','module/business/srs/customer-journeys/operator-result/index.yaml',s=>s.refs.find(r=>r.type==='flow').nodeId='srs-nfr-command']
 ]){const f=workspace(t,{complete:false}),m=f.read(file);mutate(m.extensions.work3.specification);f.write(file,m);const result=f.run();assert.ok(result.errors.some(e=>e.code===code),JSON.stringify(result.errors));}
});

test('reciprocal typed freshness includes target ancestor Work imports without invalidating unrelated edits',t=>{
 const f=workspace(t,{complete:false}),leaf=(id,description)=>({schema:'work/node@1',id,kind:'business',required:true,state:'todo',description});
 f.write('module/imports/c/index.yaml',leaf('ordinary-c','C imported by the B ancestor.'));f.write('module/imports/d/index.yaml',leaf('ordinary-d','B ordinary dependency.'));f.write('module/imports/e/index.yaml',leaf('ordinary-e','B ordinary reference.'));f.write('module/unrelated/index.yaml',leaf('unrelated','Unrelated sibling.'));
 const ancestorPath='module/business/srs/non-functional-requirements/index.yaml',ancestor=f.read(ancestorPath);ancestor.refs=['ordinary-c'];f.write(ancestorPath,ancestor);
 const bPath='module/business/srs/non-functional-requirements/reliability/index.yaml',b=f.read(bPath);b.dependsOn=['ordinary-d'];b.refs=['ordinary-e'];f.write(bPath,b);
 let result=f.run();assert.ok(result.ok,JSON.stringify(result.errors));assert.equal(result.errors.some(e=>e.code==='CYCLE'),false);const target='srs-fr-command',before=result.nodes.find(n=>n.id===target).inputDigest,invariant=authoredWorkspace(f.root,[target]).authoredBinding[0].invariantDigest;
 const unrelated=f.read('module/unrelated/index.yaml');unrelated.description+=' changed';f.write('module/unrelated/index.yaml',unrelated);result=f.run();assert.equal(result.nodes.find(n=>n.id===target).inputDigest,before);assert.equal(authoredWorkspace(f.root,[target]).authoredBinding[0].invariantDigest,invariant);
 const c=f.read('module/imports/c/index.yaml');c.description+=' changed';f.write('module/imports/c/index.yaml',c);result=f.run();assert.ok(result.ok,JSON.stringify(result.errors));assert.notEqual(result.nodes.find(n=>n.id===target).inputDigest,before);assert.notEqual(authoredWorkspace(f.root,[target]).authoredBinding[0].invariantDigest,invariant);
 const d=f.read('module/imports/d/index.yaml');d.dependsOn=['srs-nfr-command'];f.write('module/imports/d/index.yaml',d);result=f.run();assert.equal(result.ok,false);assert.ok(result.errors.some(e=>e.code==='CYCLE'));
});

test('untouched real carried-over workspace retains prior-runtime digest bytes',()=>{
 const carried=validateWorkspace(fileURLToPath(new URL('fixtures/nested-business/',import.meta.url)));assert.ok(carried.ok,JSON.stringify(carried.errors));assert.equal(carried.nodes.find(n=>n.id==='example.business.srs.documents.update').inputDigest,'d2c165b924d53e6285b9765c03bc138c57f1e15bb846e01afb2d87b18be9a22b');
});

