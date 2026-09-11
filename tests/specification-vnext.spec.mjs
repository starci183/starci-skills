// Regression coverage for pre-upstream SRS@3 and specification@3 compatibility; not authoring authority.
import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSpecification} from '../specifications/validate.mjs';
import {documentSRSV3} from '../fixtures/srs-v3.mjs';
import {validateSRSV3Bindings} from '../specifications/srs-v3.mjs';
import {documentSDS} from '../fixtures/sds.mjs';
import {validateWorkspace,previewCompletion,authoredWorkspace} from '../core/index.mjs';
import {writeSRSV3Workspace} from '../fixtures/srs-v3-workspace.mjs';
import {parseYaml,stringifyYaml} from '../core/yaml.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import {acquirePublishLock} from '../scripts/runtime-compile/stage.mjs';

const schemaValidator=file=>new Ajv2020({allErrors:true,strict:false}).compile(parseYaml(fs.readFileSync(new URL(file,import.meta.url),'utf8')));

function workspace(t,{complete=true}={}){const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-srs-v3-'));writeSRSV3Workspace(root,{complete});t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const read=p=>parseYaml(fs.readFileSync(path.join(root,p),'utf8'));const write=(p,v)=>{const file=path.join(root,p);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,stringifyYaml(v));};return {root,read,write,run:()=>validateWorkspace(root)};}

test('folder-owned SRS v3 validates complete ordered behavior and honest NFR targets',()=>{
 const {fr,nfr}=documentSRSV3();
 assert.deepEqual(validateSpecification(fr),{ok:true,errors:[]});
 assert.deepEqual(validateSpecification(nfr),{ok:true,errors:[]});
});

test('SRS v3 rejects incomplete branches, disconnected acceptance and invented decided targets',()=>{
 for(const mutate of [s=>delete s.content.exceptionFlows[0].resumeAt,s=>s.content.acceptanceCriteria[0].branchRef='missing',s=>s.content.mainFlow[0].stateEffect='']){const s=documentSRSV3().fr;mutate(s);assert.equal(validateSpecification(s).ok,false);}
 const n=documentSRSV3().nfr;n.content.target={status:'decided',value:'',decisionOwner:'Owner',missingDecision:'none'};assert.equal(validateSpecification(n).ok,false);
});

test('accepted status, acceptance joins and ref vocabularies fail closed',()=>{
 const a=documentSRSV3().nfr;a.status='pass';assert.equal(validateSpecification(a).ok,false);
 const b=documentSRSV3().fr;b.status='pass';assert.equal(validateSpecification(b).ok,false);
 const c=documentSRSV3().fr;c.content.mainFlow[0].acceptanceIds=['MISSING-AC'];assert.equal(validateSpecification(c).ok,false);
 const d=documentSRSV3().fr;d.refs.push({type:'typo-unknown-type',nodeId:'missing',itemId:'missing'});assert.equal(validateSpecification(d).ok,false);
});

test('published JSON Schema accepts every SRS v3 node type and rejects representative wrong types',()=>{
 const validate=schemaValidator('../specifications/srs-v3.schema.yaml'),srs=Object.values(documentSRSV3());for(const spec of srs){assert.equal(validate(spec),true,`${spec.id}: ${JSON.stringify(validate.errors)}`);const bad=structuredClone(spec);bad.refs='not-an-array';assert.equal(validate(bad),false,spec.id);}
 for(const [spec,field,badValue] of [[srs[0],'actors','text'],[srs[1],'scope',[]],[srs[2],'appliesTo','text'],[srs[3],'transitions','text'],[srs[4],'stages','text']]){const bad=structuredClone(spec);bad.content[field]=badValue;assert.equal(validate(bad),false,`${spec.nodeType}.${field}`);}
});

test('legacy SRS specification@2 and SDS specification@3 remain valid under unchanged validators',()=>{
 assert.deepEqual(validateSpecification(documentSDS()),{ok:true,errors:[]});
 const business=JSON.parse(fs.readFileSync(new URL('../.dist/examples/nivo-setup-business.json',import.meta.url),'utf8'));
 assert.deepEqual(validateSpecification(business),{ok:true,errors:[]});
});

test('untagged SDS@3 imports retain the prior-runtime portable digest baseline',t=>{
 const f=workspace(t,{complete:false}),make=(id,spec)=>({schema:'work/node@2',id,kind:'architecture',required:true,state:'todo',description:`Portable legacy ${id}.`,extensions:{work3:{specification:spec}}}),owner=documentSDS(),consumer=documentSDS();consumer.designRefs=[{nodeId:'legacy-baseline-owner',viewIds:['client']}];consumer.views.find(v=>v.kind==='structure').content.dependencies.push('legacy-baseline-owner#client');
 const business=parseYaml(fs.readFileSync(new URL('../examples/nested-business/knowledge/business/srs/documents/update/index.yaml',import.meta.url),'utf8'));f.write('module/legacy-baseline/business/index.yaml',business);const ownerNode=make('legacy-baseline-owner',owner);ownerNode.refs=['example.business.srs.documents.update'];f.write('module/legacy-baseline/owner/index.yaml',ownerNode);const consumerNode=make('legacy-baseline-consumer',consumer);consumerNode.refs=['example.business.srs.documents.update','legacy-baseline-owner'];f.write('module/legacy-baseline/consumer/index.yaml',consumerNode);const result=f.run();assert.ok(result.ok,JSON.stringify(result.errors));assert.equal(result.nodes.find(n=>n.id==='legacy-baseline-consumer').inputDigest,'76f139f826be4f192f459e70a299bcdd38b4bcd4e39f8927319f45b08de2b49f');
});

test('SRS v3 typed refs resolve exact owners and reject cross-version substitution',()=>{
 const {fr,nfr}=documentSRSV3(),nodes=[{meta:{id:'srs-fr-command',kind:'business',extensions:{work3:{specification:fr}}}},{meta:{id:'srs-nfr-command',kind:'business',extensions:{work3:{specification:nfr}}}}];
 assert.deepEqual(validateSRSV3Bindings(nfr,{nodes,allowedNodeIds:new Set(nodes.map(n=>n.meta.id))}),[]);
 nodes[0].meta.extensions.work3.specification={schema:'starci/specification@2',id:'FR-CMD-01'};
 assert.match(validateSRSV3Bindings(nfr,{nodes,allowedNodeIds:new Set(nodes.map(n=>n.meta.id))})[0],/Unbound/);
});

test('real folder-owned SRS v3 tree validates reviewed done through all public workspace APIs',t=>{
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
 const f=workspace(t,{complete:false}),leaf=(id,description)=>({schema:'work/node@2',id,kind:'business',required:true,state:'todo',description});
 f.write('module/imports/c/index.yaml',leaf('ordinary-c','C imported by the B ancestor.'));f.write('module/imports/d/index.yaml',leaf('ordinary-d','B ordinary dependency.'));f.write('module/imports/e/index.yaml',leaf('ordinary-e','B ordinary reference.'));f.write('module/unrelated/index.yaml',leaf('unrelated','Unrelated sibling.'));
 const ancestorPath='module/business/srs/non-functional-requirements/index.yaml',ancestor=f.read(ancestorPath);ancestor.refs=['ordinary-c'];f.write(ancestorPath,ancestor);
 const bPath='module/business/srs/non-functional-requirements/reliability/index.yaml',b=f.read(bPath);b.dependsOn=['ordinary-d'];b.refs=['ordinary-e'];f.write(bPath,b);
 let result=f.run();assert.ok(result.ok,JSON.stringify(result.errors));assert.equal(result.errors.some(e=>e.code==='CYCLE'),false);const target='srs-fr-command',before=result.nodes.find(n=>n.id===target).inputDigest,invariant=authoredWorkspace(f.root,[target]).authoredBinding[0].invariantDigest;
 const unrelated=f.read('module/unrelated/index.yaml');unrelated.description+=' changed';f.write('module/unrelated/index.yaml',unrelated);result=f.run();assert.equal(result.nodes.find(n=>n.id===target).inputDigest,before);assert.equal(authoredWorkspace(f.root,[target]).authoredBinding[0].invariantDigest,invariant);
 const c=f.read('module/imports/c/index.yaml');c.description+=' changed';f.write('module/imports/c/index.yaml',c);result=f.run();assert.ok(result.ok,JSON.stringify(result.errors));assert.notEqual(result.nodes.find(n=>n.id===target).inputDigest,before);assert.notEqual(authoredWorkspace(f.root,[target]).authoredBinding[0].invariantDigest,invariant);
 const d=f.read('module/imports/d/index.yaml');d.dependsOn=['srs-nfr-command'];f.write('module/imports/d/index.yaml',d);result=f.run();assert.equal(result.ok,false);assert.ok(result.errors.some(e=>e.code==='CYCLE'));
});

test('untouched real legacy workspace retains prior-runtime digest bytes',()=>{
 const legacy=validateWorkspace(fileURLToPath(new URL('../examples/nested-business/',import.meta.url)));assert.ok(legacy.ok,JSON.stringify(legacy.errors));assert.equal(legacy.nodes.find(n=>n.id==='example.business.srs.documents.update').inputDigest,'deb5060362d0d2377a8ee9fbdd505f2762bd5fb8de6ddc96ed99d8cc24a3c7c5');
});

test('dist publication lock preserves stale, live and ambiguous owners for explicit offline recovery',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-publish-lock-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const lock=path.join(dir,'.dist.publish-lock'),deadToken='dead-owner',deadClaim=`${lock}.claim-999999-${deadToken}`,owner={schema:'starci/dist-publish-lock@1',pid:999999,token:deadToken,startedAt:Date.now()-60000,claim:deadClaim};fs.writeFileSync(deadClaim,JSON.stringify(owner));fs.linkSync(deadClaim,lock);
 assert.throws(()=>acquirePublishLock(lock,{timeoutMs:10}),error=>/owner PID 999999, token dead-owner/.test(error.message)&&/Stop all publishers/.test(error.message)&&/offline/.test(error.message));assert.deepEqual(JSON.parse(fs.readFileSync(lock,'utf8')),owner);assert.ok(fs.existsSync(deadClaim));fs.unlinkSync(lock);fs.unlinkSync(deadClaim);
 fs.writeFileSync(lock,'malformed');assert.throws(()=>acquirePublishLock(lock,{timeoutMs:10}),/malformed or ambiguous owner metadata/);assert.equal(fs.readFileSync(lock,'utf8'),'malformed');fs.unlinkSync(lock);
 const liveClaim=`${lock}.claim-${process.pid}-live`,live={schema:'starci/dist-publish-lock@1',pid:process.pid,token:'live',startedAt:Date.now()-60000,claim:liveClaim};fs.writeFileSync(liveClaim,JSON.stringify(live));fs.linkSync(liveClaim,lock);assert.throws(()=>acquirePublishLock(lock,{timeoutMs:10}),/owner PID/);assert.deepEqual(JSON.parse(fs.readFileSync(lock,'utf8')),live);
});
