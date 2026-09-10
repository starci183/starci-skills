// Regression coverage for pre-upstream SRS@3/SDS@4 compatibility; not authoring authority.
import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSpecification} from '../specifications/validate.mjs';
import {documentSRSV3} from '../fixtures/srs-v3.mjs';
import {documentSDSV4} from '../fixtures/sds-v4.mjs';
import {documentSDSV4Overview} from '../fixtures/sds-v4.mjs';
import {validateSRSV3Bindings} from '../specifications/srs-v3.mjs';
import {validateSDSV4Bindings} from '../specifications/sds-v4.mjs';
import {validateSDS,validateSDSBindings} from '../specifications/sds.mjs';
import {documentSDS} from '../fixtures/sds.mjs';
import {validateWorkspace,previewCompletion,authoredWorkspace,canonicalJSON,sha256} from '../core/index.mjs';
import {writeSrsSdsWorkspace} from '../fixtures/srs-sds-workspace.mjs';
import {parseYaml,stringifyYaml} from '../core/yaml.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import {acquirePublishLock} from '../scripts/runtime-compile/stage.mjs';

const schemaValidator=file=>new Ajv2020({allErrors:true,strict:false}).compile(parseYaml(fs.readFileSync(new URL(file,import.meta.url),'utf8')));

function workspace(t,{complete=true}={}){const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-srs-sds-'));writeSrsSdsWorkspace(root,{complete});t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const read=p=>parseYaml(fs.readFileSync(path.join(root,p),'utf8'));const write=(p,v)=>{const file=path.join(root,p);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,stringifyYaml(v));};return {root,read,write,run:()=>validateWorkspace(root)};}

test('folder-owned SRS v3 validates complete ordered behavior and honest NFR targets',()=>{
 const {fr,nfr}=documentSRSV3();
 assert.deepEqual(validateSpecification(fr),{ok:true,errors:[]});
 assert.deepEqual(validateSpecification(nfr),{ok:true,errors:[]});
});

test('SRS v3 rejects incomplete branches, disconnected acceptance and invented decided targets',()=>{
 for(const mutate of [
  s=>delete s.content.exceptionFlows[0].resumeAt,
  s=>s.content.acceptanceCriteria[0].branchRef='missing',
  s=>s.content.mainFlow[0].stateEffect='',
 ]){const s=documentSRSV3().fr;mutate(s);assert.equal(validateSpecification(s).ok,false);}
 const n=documentSRSV3().nfr;n.content.target={status:'decided',value:'',decisionOwner:'Owner',missingDecision:'none'};assert.equal(validateSpecification(n).ok,false);
});

test('accepted status, acceptance joins, safe code paths and ref vocabularies fail closed',()=>{
 const a=documentSRSV3().nfr;a.status='pass';assert.equal(validateSpecification(a).ok,false);
 const b=documentSRSV3().fr;b.status='pass';assert.equal(validateSpecification(b).ok,false);
 const c=documentSRSV3().fr;c.content.mainFlow[0].acceptanceIds=['MISSING-AC'];assert.equal(validateSpecification(c).ok,false);
 const d=documentSDSV4().units[0];d.content.file='../outside.ts';assert.equal(validateSpecification(d).ok,false);
 const e=documentSDSV4().flow;e.refs.push({type:'typo-unknown-type',nodeId:'missing',itemId:'missing'});assert.equal(validateSpecification(e).ok,false);
});

test('flow-first SDS v4 validates every applicable synthetic leaf without claiming implementation proof',()=>{
 const fixture=documentSDSV4();
 for(const spec of [fixture.flow,...fixture.units,fixture.contract,fixture.data,fixture.quality,fixture.deployment,fixture.decision,fixture.verification])assert.deepEqual(validateSpecification(spec),{ok:true,errors:[]},spec.id);
});

test('published JSON Schemas accept every positive SRS/SDS node type and reject representative wrong types',()=>{
 const srsValidate=schemaValidator('../specifications/srs-v3.schema.yaml'),srs=Object.values(documentSRSV3());for(const spec of srs){assert.equal(srsValidate(spec),true,`${spec.id}: ${JSON.stringify(srsValidate.errors)}`);const bad=structuredClone(spec);bad.refs='not-an-array';assert.equal(srsValidate(bad),false,spec.id);}
 for(const [spec,field,badValue] of [[srs[0],'actors','text'],[srs[1],'scope',[]],[srs[2],'appliesTo','text'],[srs[3],'transitions','text'],[srs[4],'stages','text']]){const bad=structuredClone(spec);bad.content[field]=badValue;assert.equal(srsValidate(bad),false,`${spec.nodeType}.${field}`);}
 const sdsValidate=schemaValidator('../specifications/sds-v4.schema.yaml'),fixture=documentSDSV4(),sds=[documentSDSV4Overview(),fixture.flow,...fixture.units,fixture.contract,fixture.data,fixture.quality,fixture.deployment,fixture.decision,fixture.verification];for(const spec of sds){assert.equal(sdsValidate(spec),true,`${spec.id}: ${JSON.stringify(sdsValidate.errors)}`);const bad=structuredClone(spec);bad.content=42;assert.equal(sdsValidate(bad),false,spec.id);}
 for(const [spec,field,badValue] of [[documentSDSV4Overview(),'scope','text'],[documentSDSV4Overview(),'strategy','text'],[fixture.data,'businessDataRefs','text'],[fixture.data,'recovery',[]],[fixture.quality,'conditions',[]],[fixture.quality,'measurement',{}]]){const bad=structuredClone(spec);bad.content[field]=badValue;assert.equal(sdsValidate(bad),false,`${spec.nodeType}.${field}`);}
});

test('SDS v4 rejects generic or ambiguous execution maps and false verification evidence',()=>{
 for(const mutate of [
  f=>f.flow.content.mainSequence[1].authorization='',
  f=>f.flow.content.exceptionSequences[0].resumeAt='missing',
  f=>f.units[2].content.existence='existing',
  f=>f.contract.content.idempotency='',
  f=>f.verification.content.executionEvidence='passed',
  f=>f.quality.content.target={status:'undecided',value:'unknown',decisionOwner:'',missingDecision:''},
 ]){const f=documentSDSV4();mutate(f);const invalid=[f.flow,...f.units,f.contract,f.data,f.quality,f.deployment,f.decision,f.verification].some(s=>!validateSpecification(s).ok);assert.equal(invalid,true);}
});

test('legacy SRS specification@2 and SDS specification@3 remain valid under unchanged validators',async()=>{
 const {documentSDS}=await import('../fixtures/sds.mjs');
 assert.deepEqual(validateSpecification(documentSDS()),{ok:true,errors:[]});
 const fs=await import('node:fs');
 const business=JSON.parse(fs.readFileSync(new URL('../.dist/examples/nivo-setup-business.json',import.meta.url),'utf8'));
 assert.deepEqual(validateSpecification(business),{ok:true,errors:[]});
});

test('untagged SDS@3 imports retain the prior-runtime portable digest baseline',t=>{
 const f=workspace(t,{complete:false}),make=(id,spec)=>({schema:'work/node@2',id,kind:'architecture',required:true,state:'todo',description:`Portable legacy ${id}.`,extensions:{work3:{specification:spec}}}),owner=documentSDS(),consumer=documentSDS();consumer.designRefs=[{nodeId:'legacy-baseline-owner',viewIds:['client']}];consumer.views.find(v=>v.kind==='structure').content.dependencies.push('legacy-baseline-owner#client');
 const business=parseYaml(fs.readFileSync(new URL('../examples/nested-business/knowledge/business/srs/documents/update/index.yaml',import.meta.url),'utf8'));f.write('module/legacy-baseline/business/index.yaml',business);const ownerNode=make('legacy-baseline-owner',owner);ownerNode.refs=['example.business.srs.documents.update'];f.write('module/legacy-baseline/owner/index.yaml',ownerNode);const consumerNode=make('legacy-baseline-consumer',consumer);consumerNode.refs=['example.business.srs.documents.update','legacy-baseline-owner'];f.write('module/legacy-baseline/consumer/index.yaml',consumerNode);const result=f.run();assert.ok(result.ok,JSON.stringify(result.errors));assert.equal(result.nodes.find(n=>n.id==='legacy-baseline-consumer').inputDigest,'76f139f826be4f192f459e70a299bcdd38b4bcd4e39f8927319f45b08de2b49f');
});

test('new typed refs resolve exact owners and reject cross-version substitution',()=>{
 const {fr,nfr}=documentSRSV3(), srsNodes=[{meta:{id:'srs-fr-command',kind:'business',extensions:{work3:{specification:fr}}}},{meta:{id:'srs-nfr-command',kind:'business',extensions:{work3:{specification:nfr}}}}];
 assert.deepEqual(validateSRSV3Bindings(nfr,{nodes:srsNodes,allowedNodeIds:new Set(srsNodes.map(n=>n.meta.id))}),[]);
 srsNodes[0].meta.extensions.work3.specification={schema:'starci/specification@2',id:'FR-CMD-01'};
 assert.match(validateSRSV3Bindings(nfr,{nodes:srsNodes,allowedNodeIds:new Set(srsNodes.map(n=>n.meta.id))})[0],/Unbound/);
 const fixture=documentSDSV4(), flow={...fixture.flow,refs:[{type:'code-unit',nodeId:'sds-code-page',itemId:'CU-COMMAND-PAGE'}]}, unit=fixture.units[0];
 const nodes=[{meta:{id:'sds-flow',kind:'architecture',extensions:{work3:{specification:flow}}}},{meta:{id:'sds-code-page',kind:'architecture',extensions:{work3:{specification:unit}}}}];
 assert.deepEqual(validateSDSV4Bindings(flow,{nodes,allowedNodeIds:new Set(nodes.map(n=>n.meta.id))}),[]);
 nodes[1].meta.extensions.work3.specification={schema:'starci/specification@3',id:'CU-COMMAND-PAGE'};
 assert.match(validateSDSV4Bindings(flow,{nodes,allowedNodeIds:new Set(nodes.map(n=>n.meta.id))})[0],/Unbound/);
});

test('narrow bidirectional SDS interoperability resolves only exact code-unit, contract and data projections',()=>{
 const legacy=documentSDS(),v4=documentSDSV4(),legacyNode={meta:{id:'legacy-owner',kind:'architecture',extensions:{work3:{specification:legacy}}}},v4Node={meta:{id:'v4-owner',kind:'architecture',extensions:{work3:{specification:v4.units[0]}}}};
 const imported=structuredClone(v4.units[1]);imported.refs=[{type:'legacy-code-unit',nodeId:'legacy-owner',itemId:'client'}];assert.deepEqual(validateSDSV4Bindings(imported,{nodes:[legacyNode],allowedNodeIds:new Set(['legacy-owner'])}),[]);
 for(const mutate of [r=>r.type='legacy-contract',r=>r.itemId='missing',r=>r.nodeId='missing']){const bad=structuredClone(imported);mutate(bad.refs[0]);assert.ok(validateSDSV4Bindings(bad,{nodes:[legacyNode],allowedNodeIds:new Set(['legacy-owner'])}).length);}
 assert.ok(validateSDSV4Bindings(imported,{nodes:[{...legacyNode,meta:{...legacyNode.meta,kind:'business'}}],allowedNodeIds:new Set(['legacy-owner'])}).length);assert.ok(validateSDSV4Bindings(imported,{nodes:[v4Node],allowedNodeIds:new Set(['v4-owner'])}).length);assert.ok(validateSDSV4Bindings(imported,{nodes:[legacyNode],allowedNodeIds:new Set()}).length);
 const businessSpec=parseYaml(fs.readFileSync(new URL('../examples/nested-business/knowledge/business/srs/documents/update/index.yaml',import.meta.url),'utf8')).extensions.work3.specification,businessNode={meta:{id:'example.business.srs.documents.update',kind:'business',extensions:{work3:{specification:businessSpec}}}},consumer=documentSDS(),edge=consumer.views.find(x=>x.kind==='structure');edge.content.dependencies=[...edge.content.dependencies,'v4-owner#CU-COMMAND-PAGE'];consumer.designRefs=[{schema:'starci/sds@4',nodeId:'v4-owner',items:[{id:'CU-COMMAND-PAGE',kind:'structure'}]}];assert.deepEqual(validateSDS(consumer),{ok:true,errors:[]});assert.deepEqual(validateSDSBindings(consumer,{nodes:[v4Node,businessNode],allowedNodeIds:new Set(['v4-owner','example.business.srs.documents.update'])}),[]);
 for(const mutate of [r=>r.items[0].kind='contracts',r=>r.items[0].id='missing',r=>r.nodeId='missing']){const bad=structuredClone(consumer);mutate(bad.designRefs[0]);assert.ok(validateSDSBindings(bad,{nodes:[v4Node],allowedNodeIds:new Set(['v4-owner'])}).length);}
 assert.ok(validateSDSBindings(consumer,{nodes:[legacyNode],allowedNodeIds:new Set(['legacy-owner'])}).length);assert.ok(validateSDSBindings(consumer,{nodes:[v4Node],allowedNodeIds:new Set()}).length);
 const old=documentSDS();assert.deepEqual(validateSDS(old),{ok:true,errors:[]});
});

test('bidirectional imported owners propagate direct and ancestor dependency freshness',t=>{
 const f=workspace(t,{complete:false}),legacyBusiness=parseYaml(fs.readFileSync(new URL('../examples/nested-business/knowledge/business/srs/documents/update/index.yaml',import.meta.url),'utf8')).extensions.work3.specification,legacy=documentSDS(),workNode=(id,kind,description,spec,extra={})=>({schema:'work/node@2',id,kind,required:true,state:'todo',description,...(spec?{extensions:{work3:{specification:spec}}}:{}),...extra});
 f.write('module/imports/legacy-business/index.yaml',workNode('example.business.srs.documents.update','business','Legacy business owner.',legacyBusiness));
 f.write('module/imports/legacy-owner/index.yaml',workNode('legacy-owner','architecture','Legacy SDS owner.',legacy,{refs:['example.business.srs.documents.update']}));
 const v4Path='module/architecture/sds/code-map/shared/router/index.yaml',v4=f.read(v4Path);v4.extensions.work3.specification.content.callees.push('legacy-owner#client');v4.extensions.work3.specification.refs.push({type:'legacy-code-unit',nodeId:'legacy-owner',itemId:'client'});const arch=f.read('module/architecture/index.yaml');arch.refs.push('legacy-owner');f.write('module/architecture/index.yaml',arch);f.write(v4Path,v4);
 let result=f.run();assert.ok(result.ok,JSON.stringify(result.errors));let digest=result.nodes.find(n=>n.id==='sds-code-router').inputDigest,invariant=authoredWorkspace(f.root,['sds-code-router']).authoredBinding[0].invariantDigest;
 const owner=f.read('module/imports/legacy-owner/index.yaml');owner.extensions.work3.specification.purpose+=' Direct legacy change.';f.write('module/imports/legacy-owner/index.yaml',owner);result=f.run();assert.notEqual(result.nodes.find(n=>n.id==='sds-code-router').inputDigest,digest);assert.notEqual(authoredWorkspace(f.root,['sds-code-router']).authoredBinding[0].invariantDigest,invariant);
 f.write('module/imports/c/index.yaml',workNode('legacy-import-c','business','Legacy import ancestor dependency.'));const imports=f.read('module/imports/legacy-owner/index.yaml');imports.refs.push('legacy-import-c');f.write('module/imports/legacy-owner/index.yaml',imports);result=f.run();digest=result.nodes.find(n=>n.id==='sds-code-router').inputDigest;invariant=authoredWorkspace(f.root,['sds-code-router']).authoredBinding[0].invariantDigest;const c=f.read('module/imports/c/index.yaml');c.description+=' changed';f.write('module/imports/c/index.yaml',c);assert.notEqual(f.run().nodes.find(n=>n.id==='sds-code-router').inputDigest,digest);assert.notEqual(authoredWorkspace(f.root,['sds-code-router']).authoredBinding[0].invariantDigest,invariant);
 const consumer=documentSDS(),edge=consumer.views.find(x=>x.kind==='structure');edge.content.dependencies.push('sds-code-page#CU-COMMAND-PAGE');consumer.designRefs=[{schema:'starci/sds@4',nodeId:'sds-code-page',items:[{id:'CU-COMMAND-PAGE',kind:'structure'}]}];f.write('module/legacy-consumer/index.yaml',workNode('legacy-consumer','architecture','Legacy v3 consumer.',consumer,{refs:['example.business.srs.documents.update','sds-code-page']}));result=f.run();assert.ok(result.ok,JSON.stringify(result.errors));digest=result.nodes.find(n=>n.id==='legacy-consumer').inputDigest;invariant=authoredWorkspace(f.root,['legacy-consumer']).authoredBinding[0].invariantDigest;const pagePath='module/architecture/sds/code-map/frontend/command-page/index.yaml',page=f.read(pagePath);page.extensions.work3.specification.content.responsibility+=' Direct v4 change.';f.write(pagePath,page);assert.notEqual(f.run().nodes.find(n=>n.id==='legacy-consumer').inputDigest,digest);assert.notEqual(authoredWorkspace(f.root,['legacy-consumer']).authoredBinding[0].invariantDigest,invariant);
});

test('qualified SDS edges resolve exact owners and bare imported IDs must be unambiguous',t=>{
 const f=workspace(t,{complete:false}),node=(id,spec)=>({schema:'work/node@2',id,kind:'architecture',required:true,state:'todo',description:`Legacy owner ${id}.`,refs:['example.business.srs.documents.update'],extensions:{work3:{specification:spec}}}),business=parseYaml(fs.readFileSync(new URL('../examples/nested-business/knowledge/business/srs/documents/update/index.yaml',import.meta.url),'utf8'));
 f.write('module/imports/business/index.yaml',business);f.write('module/imports/legacy-a/index.yaml',node('legacy-a',documentSDS()));f.write('module/imports/legacy-b/index.yaml',node('legacy-b',documentSDS()));const arch=f.read('module/architecture/index.yaml');arch.refs.push('legacy-a','legacy-b','example.business.srs.documents.update');f.write('module/architecture/index.yaml',arch);
 const file='module/architecture/sds/code-map/shared/router/index.yaml',qualified=f.read(file);qualified.extensions.work3.specification.refs.push({type:'legacy-code-unit',nodeId:'legacy-a',itemId:'client'},{type:'legacy-code-unit',nodeId:'legacy-b',itemId:'client'});qualified.extensions.work3.specification.content.callees.push('legacy-a#client');f.write(file,qualified);let result=f.run();assert.ok(result.ok,JSON.stringify(result.errors));
 const bare=f.read(file);bare.extensions.work3.specification.content.callees.at(-1);bare.extensions.work3.specification.content.callees[bare.extensions.work3.specification.content.callees.length-1]='client';f.write(file,bare);result=f.run();assert.ok(result.errors.some(e=>e.code==='SDS_GRAPH'&&e.message.includes('client')),JSON.stringify(result.errors));
 const unknown=f.read(file);unknown.extensions.work3.specification.content.callees[unknown.extensions.work3.specification.content.callees.length-1]='missing-owner#client';f.write(file,unknown);result=f.run();assert.ok(result.errors.some(e=>e.code==='SDS_GRAPH'&&e.message.includes('missing-owner#client')),JSON.stringify(result.errors));
 const wrong=f.read(file);wrong.extensions.work3.specification.content.callees[wrong.extensions.work3.specification.content.callees.length-1]='legacy-a#client';wrong.extensions.work3.specification.refs.find(r=>r.nodeId==='legacy-a').type='legacy-contract';f.write(file,wrong);result=f.run();assert.ok(result.errors.some(e=>e.code==='SDS_BINDING'||e.code==='SDS_GRAPH'),JSON.stringify(result.errors));
 const caller=f.read(file);caller.extensions.work3.specification.refs.find(r=>r.nodeId==='legacy-a').type='legacy-code-unit';caller.extensions.work3.specification.content.callees.pop();caller.extensions.work3.specification.content.callers.push('legacy-a#client');f.write(file,caller);result=f.run();assert.ok(result.ok,JSON.stringify(result.errors));caller.extensions.work3.specification.content.callers.at(-1);caller.extensions.work3.specification.content.callers[caller.extensions.work3.specification.content.callers.length-1]='legacy-z#client';f.write(file,caller);result=f.run();assert.ok(result.errors.some(e=>e.code==='SDS_GRAPH'&&e.message.includes('legacy-z#client')),JSON.stringify(result.errors));
});

test('real folder-owned SRS/SDS tree validates current reviewed done through all public workspace APIs',t=>{
 const f=workspace(t),validated=f.run();assert.ok(validated.ok,JSON.stringify(validated.errors));assert.ok(validated.nodes.every(n=>n.effectiveState==='done'));
 const flow=validated.nodes.find(n=>n.id==='sds-flow-command');const preview=previewCompletion(f.root,{'sds-flow-command':flow.completion});assert.ok(preview.ok,JSON.stringify(preview.errors));assert.equal(preview.nodes.find(n=>n.id==='sds-flow-command').effectiveState,'done');
 const authored=authoredWorkspace(f.root,['sds-flow-command']);assert.ok(authored.ok,JSON.stringify(authored.errors));assert.equal(authored.authoredBinding.length,1);assert.match(authored.authoredBinding[0].invariantDigest,/^[a-f0-9]{64}$/);
});

test('workspace rejects wrong layout/type, duplicate item IDs and malformed or dangling typed targets',t=>{
 const cases=[
  ['SRS_NODE_TYPE',f=>{const p='module/business/srs/data/command-request/index.yaml',m=f.read(p);m.extensions.work3.specification.nodeType='business-rule';f.write(p,m);}],
  ['SRS_ITEM_ID',f=>{const p='module/business/srs/business-rules/recipient-scope/index.yaml',m=f.read(p);m.extensions.work3.specification.id='FR-CMD-01';f.write(p,m);}],
  ['SRS_BINDING',f=>{const p='module/business/srs/non-functional-requirements/reliability/index.yaml',m=f.read(p);m.extensions.work3.specification.refs[0].nodeId='missing-owner';f.write(p,m);}],
  ['SRS_BINDING',f=>{const p='module/business/srs/non-functional-requirements/reliability/index.yaml',m=f.read(p);m.extensions.work3.specification.refs[0].type='business-rule';f.write(p,m);}],
  ['SDS_BINDING',f=>{const p='module/architecture/sds/data/receipt/index.yaml',m=f.read(p);m.extensions.work3.specification.refs[0].type='data';f.write(p,m);}],
  ['SPECIFICATION',f=>{const p='module/architecture/sds/flows/command/index.yaml',m=f.read(p);m.extensions.work3.specification.refs[0]={type:'functional-requirement',nodeId:'srs-fr-command'};f.write(p,m);}]
 ];
 for(const [code,mutate] of cases){const f=workspace(t);mutate(f);const r=f.run();assert.equal(r.ok,false,mutate.toString());assert.ok(r.errors.some(e=>e.code===code),JSON.stringify(r.errors));}
});

test('all deterministic SRS joins and same-owner journey flow relationship fail closed',t=>{
 for(const [code,file,mutate] of [
  ['SRS_GRAPH','module/business/srs/business-rules/recipient-scope/index.yaml',s=>s.content.appliesTo=['MISSING-FR']],
  ['SRS_GRAPH','module/business/srs/data/command-request/index.yaml',s=>s.content.transitions[0].ruleRefs=['MISSING-BR']],
  ['SRS_JOURNEY_OWNER','module/business/srs/customer-journeys/operator-result/index.yaml',s=>s.refs.find(r=>r.type==='flow').nodeId='srs-nfr-command']
 ]){const f=workspace(t,{complete:false}),m=f.read(file);mutate(m.extensions.work3.specification);f.write(file,m);const r=f.run();assert.ok(r.errors.some(e=>e.code===code),JSON.stringify(r.errors));}
});

test('decided quality target and internal caller symbols cannot pass on empty or misspelled values',t=>{
 const quality=documentSDSV4().quality;quality.status='pass';quality.content.target={status:'decided',value:'',decisionOwner:'owner',missingDecision:''};assert.equal(validateSpecification(quality).ok,false);
 const f=workspace(t,{complete:false}),p='module/architecture/sds/flows/command/index.yaml',m=f.read(p);m.extensions.work3.specification.content.mainSequence[0].callerRef='CU-TYPO';f.write(p,m);const r=f.run();assert.ok(r.errors.some(e=>e.code==='SDS_GRAPH'&&e.message.includes('CU-TYPO')),JSON.stringify(r.errors));
});

test('direct and transitive typed edits invalidate completion and authored invariants without false reciprocal cycles',t=>{
 const f=workspace(t),before=f.run();assert.ok(before.ok);const target='sds-flow-command';const invariant=authoredWorkspace(f.root,[target]).authoredBinding[0].invariantDigest;
 const frPath='module/business/srs/functional-requirements/command/index.yaml',fr=f.read(frPath);fr.extensions.work3.specification.content.goal+=' Direct semantic revision.';f.write(frPath,fr);
 let changed=f.run();assert.equal(changed.nodes.find(n=>n.id===target).effectiveState,'uninvestigate');assert.notEqual(authoredWorkspace(f.root,[target]).authoredBinding[0].invariantDigest,invariant);
 const g=workspace(t),base=authoredWorkspace(g.root,[target]).authoredBinding[0].invariantDigest,brPath='module/business/srs/business-rules/recipient-scope/index.yaml',br=g.read(brPath);br.extensions.work3.specification.content.rationale+=' Transitive semantic revision.';g.write(brPath,br);
 changed=g.run();assert.equal(changed.errors.some(e=>e.code==='CYCLE'),false);assert.equal(changed.nodes.find(n=>n.id===target).effectiveState,'uninvestigate');assert.notEqual(authoredWorkspace(g.root,[target]).authoredBinding[0].invariantDigest,base);
});

test('reciprocal typed freshness includes target ancestor Work imports without invalidating unrelated edits',t=>{
 const f=workspace(t,{complete:false}),leaf=(id,description)=>({schema:'work/node@2',id,kind:'business',required:true,state:'todo',description});
 f.write('module/imports/c/index.yaml',leaf('ordinary-c','C imported by the B ancestor.'));f.write('module/imports/d/index.yaml',leaf('ordinary-d','B ordinary dependency.'));f.write('module/imports/e/index.yaml',leaf('ordinary-e','B ordinary reference.'));f.write('module/unrelated/index.yaml',leaf('unrelated','Unrelated sibling.'));
 const ancestorPath='module/business/srs/non-functional-requirements/index.yaml',ancestor=f.read(ancestorPath);ancestor.refs=['ordinary-c'];f.write(ancestorPath,ancestor);
 const bPath='module/business/srs/non-functional-requirements/reliability/index.yaml',b=f.read(bPath);b.dependsOn=['ordinary-d'];b.refs=['ordinary-e'];f.write(bPath,b);
 // A FR -> B NFR and B NFR -> A FR are reciprocal typed specification refs.
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
