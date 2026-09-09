import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {validateWorkspace,previewEvidence,sha256} from '../core/index.mjs';
import {stringifyYaml,parseYaml} from '../core/yaml.mjs';
import {publishEvidence,previewEvidencePublication} from '../workflows/evidence.mjs';

function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-scoped-publication-'));
 t.after(()=>{assert.equal(path.dirname(dir),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(dir).startsWith('starci-scoped-publication-'));fs.rmSync(dir,{recursive:true,force:true});});
 const root=path.join(dir,'.starciwork');
 const put=(relative,value)=>{const file=path.join(root,relative);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,stringifyYaml(value));return file;};
 const node=(id,extra={})=>put(id+'/index.yaml',{schema:'work/node@2',id:id.replaceAll('/','.'),kind:'operations',required:true,state:'todo',description:'Synthetic publication fixture, not product evidence.',assertions:['verified'],...extra});
 const read=id=>parseYaml(fs.readFileSync(path.join(root,id+'/index.yaml'),'utf8'));
 const current=id=>validateWorkspace(root).nodes.find(n=>n.id===id.replaceAll('/','.'));
 const manifest=(id='owner',name='proof')=>({schema:'work/evidence@1',id:name.replaceAll('/','.'),nodeId:id.replaceAll('/','.'),inputDigest:current(id).inputDigest,outcome:'pass',assertions:[{id:'verified',outcome:'pass',observation:'Synthetic checked result'}],assets:[]});
 const done=id=>{const m=manifest(id,id+'-old-proof');put(id+'/evidence/old-proof/manifest.yaml',m);put(id+'/index.yaml',{...read(id),state:'done',completion:{inputDigest:m.inputDigest,evidence:[m.id]}});};
 const stale=id=>{done(id);put(id+'/index.yaml',{...read(id),description:'Changed synthetic semantic input'});};
 const stage=(name='fresh',m=manifest('owner',name))=>{put('_local/evidence-staging/'+name+'/manifest.yaml',m);return path.join(root,'_local/evidence-staging',name);};
 put('workspace.yaml',{schema:'work/workspace@1',id:'synthetic-scoped-publication'});node('owner');node('unrelated');
 return {dir,root,put,node,read,current,manifest,done,stale,stage};
}

test('publishes current owner proof while preserving unrelated recoverable stale diagnostics',t=>{
 const f=fixture(t);f.stale('unrelated');const before=validateWorkspace(f.root),directory=f.stage();
 assert.equal(before.ok,false);assert.deepEqual(new Set(before.errors.map(e=>e.code)),new Set(['STALE_COMPLETION','STALE_EVIDENCE']));
 assert.equal(previewEvidence(f.root,{directory,nodeId:'owner',name:'fresh'}).ok,false);
 const result=publishEvidence(f.root,{directory,nodeId:'owner',name:'fresh'});
 assert.equal(result.published,true);assert.equal(result.globalOk,false);assert.deepEqual(result.remainingErrors,before.errors);
 assert.equal(fs.existsSync(directory),false);assert.equal(fs.existsSync(path.join(result.path,'manifest.yaml')),true);
 assert.deepEqual(validateWorkspace(f.root).errors,before.errors);assert.equal(f.current('owner').state,'todo');
});

test('scoped preview is read-only and successful globally valid publication retains its API fields',t=>{
 const f=fixture(t),directory=f.stage(),before=validateWorkspace(f.root),bytes=fs.readFileSync(path.join(directory,'manifest.yaml'));
 const preview=previewEvidencePublication(f.root,{directory,nodeId:'owner',name:'fresh'});
 assert.equal(preview.ok,true);assert.equal(preview.globalOk,true);assert.deepEqual(preview.remainingErrors,[]);assert.equal(preview.preview,true);
 assert.equal(fs.existsSync(preview.path),false);assert.deepEqual(fs.readFileSync(path.join(directory,'manifest.yaml')),bytes);assert.deepEqual(validateWorkspace(f.root),before);
 const published=publishEvidence(f.root,{directory,nodeId:'owner',name:'fresh'});
 assert.equal(published.path,preview.path);assert.equal(published.nodeId,'owner');assert.match(published.seal,/^[a-f0-9]{64}$/);assert.equal(published.globalOk,true);assert.deepEqual(published.remainingErrors,[]);assert.equal(f.current('owner').state,'todo');
});

test('truthful failed or inconclusive evidence can be retained without earning completion',t=>{
 const f=fixture(t);f.stale('unrelated');
 for(const outcome of ['fail','not-run','inconclusive']){
  const m=f.manifest('owner',outcome);m.outcome=outcome;m.assertions[0].outcome=outcome;m.assertions[0].observation='Synthetic honest '+outcome+' result';
  const result=publishEvidence(f.root,{directory:f.stage(outcome,m),nodeId:'owner',name:outcome});assert.equal(result.published,true);assert.equal(result.globalOk,false);assert.equal(f.current('owner').state,'todo');assert.equal(f.current('owner').completion,null);
 }
});

for(const state of ['stale','uninvestigate','blockers','investigation'])test(`selected owner ${state} cannot publish current-shaped evidence`,t=>{
 const f=fixture(t);
 if(state==='stale')f.stale('owner');
 if(state==='uninvestigate')f.node('owner',{state:'uninvestigate'});
 if(state==='blockers')f.node('owner',{blockers:['Synthetic unresolved blocker']});
 if(state==='investigation')f.node('owner',{investigation:{contextDigest:'0'.repeat(64)}});
 const directory=f.stage();assert.equal(previewEvidencePublication(f.root,{directory,nodeId:'owner',name:'fresh'}).ok,false);
 assert.throws(()=>publishEvidence(f.root,{directory,nodeId:'owner',name:'fresh'}),/preflight/);assert.equal(fs.existsSync(directory),true);
});

test('a stale candidate input digest is rejected even if core evidence-format preview is valid',t=>{
 const f=fixture(t),m=f.manifest();f.node('owner',{description:'Changed owner after evidence was recorded'});const directory=f.stage('fresh',m);
 assert.equal(previewEvidence(f.root,{directory,nodeId:'owner',name:'fresh'}).ok,true);
 const preview=previewEvidencePublication(f.root,{directory,nodeId:'owner',name:'fresh'});assert.equal(preview.ok,false);assert.ok(preview.errors.some(e=>e.code==='EVIDENCE_CURRENT_BINDING'));
 assert.throws(()=>publishEvidence(f.root,{directory,nodeId:'owner',name:'fresh'}),/EVIDENCE_CURRENT_BINDING/);
});

for(const relation of ['dependsOn','refs'])test(`stale required ${relation} closure cannot be hidden as unrelated`,t=>{
 const f=fixture(t);f.stale('unrelated');f.node('owner',{[relation]:['unrelated']});const directory=f.stage();
 const preview=previewEvidencePublication(f.root,{directory,nodeId:'owner',name:'fresh'});assert.equal(preview.ok,false);assert.equal(preview.remainingErrors.length,0);
 assert.throws(()=>publishEvidence(f.root,{directory,nodeId:'owner',name:'fresh'}),/preflight/);
});

test('optional unfinished aggregate children do not block unless explicitly consumed',t=>{
 const f=fixture(t);f.node('inputs');const group=f.read('inputs');delete group.state;f.put('inputs/index.yaml',group);
 f.node('inputs/required');f.done('inputs/required');f.node('inputs/optional',{required:false});f.stale('inputs/optional');
 f.node('owner',{dependsOn:['inputs']});assert.equal(f.current('inputs').effectiveState,'done');
 const directory=f.stage();assert.equal(previewEvidencePublication(f.root,{directory,nodeId:'owner',name:'fresh'}).ok,true);
 const result=publishEvidence(f.root,{directory,nodeId:'owner',name:'fresh'});assert.equal(result.globalOk,false);assert.ok(result.remainingErrors.length);
 f.node('owner',{dependsOn:['inputs'],refs:['inputs.optional']});const second=f.stage('second');
 assert.equal(previewEvidencePublication(f.root,{directory:second,nodeId:'owner',name:'second'}).ok,false);assert.throws(()=>publishEvidence(f.root,{directory:second,nodeId:'owner',name:'second'}),/preflight/);
});

test('all additional owner bindings must be current and cannot exempt an unfinished dependency',t=>{
 const f=fixture(t),m=f.manifest();m.bindings=[{nodeId:'unrelated',inputDigest:f.current('unrelated').inputDigest}];
 const directory=f.stage('fresh',m);assert.equal(previewEvidencePublication(f.root,{directory,nodeId:'owner',name:'fresh'}).ok,true);
 f.node('owner',{dependsOn:['unrelated']});const waiting=f.manifest('owner','waiting');waiting.bindings=m.bindings;const blocked=f.stage('waiting',waiting);
 assert.equal(previewEvidencePublication(f.root,{directory:blocked,nodeId:'owner',name:'waiting'}).ok,false);
 f.stale('unrelated');assert.equal(previewEvidencePublication(f.root,{directory,nodeId:'owner',name:'fresh'}).ok,false);
 assert.throws(()=>publishEvidence(f.root,{directory,nodeId:'owner',name:'fresh'}),/preflight/);
});

for(const corruption of ['missing-ref','duplicate-id','cycle','unknown-field','broken-proof'])test(`structural ${corruption} anywhere remains globally blocking`,t=>{
 const f=fixture(t);
 if(corruption==='missing-ref')f.node('unrelated',{dependsOn:['absent']});
 if(corruption==='duplicate-id')f.node('unrelated',{id:'owner'});
 if(corruption==='cycle'){f.node('unrelated',{dependsOn:['other']});f.node('other',{dependsOn:['unrelated']});}
 if(corruption==='unknown-field')f.node('unrelated',{inventedField:true});
 if(corruption==='broken-proof')f.node('unrelated',{state:'done'});
 const directory=f.stage();assert.equal(previewEvidencePublication(f.root,{directory,nodeId:'owner',name:'fresh'}).ok,false);assert.throws(()=>publishEvidence(f.root,{directory,nodeId:'owner',name:'fresh'}),/preflight/);
});

for(const corruption of ['malformed','foreign-owner','missing-asset','wrong-hash','path-escape','unsealed-file','duplicate-binding'])test(`staged ${corruption} never publishes amid unrelated stale diagnostics`,t=>{
 const f=fixture(t);f.stale('unrelated');const m=f.manifest('owner','fresh');
 if(corruption==='foreign-owner')m.nodeId='unrelated';
 if(corruption==='missing-asset')m.assets=[{path:'absent.log',sha256:'0'.repeat(64)}];
 if(corruption==='wrong-hash')m.assets=[{path:'actual.log',sha256:'0'.repeat(64)}];
 if(corruption==='path-escape')m.assets=[{path:'../outside.log',sha256:'0'.repeat(64)}];
 if(corruption==='duplicate-binding')m.bindings=[{nodeId:'owner',inputDigest:m.inputDigest}];
 const directory=f.stage('fresh',m);
 if(corruption==='malformed')fs.writeFileSync(path.join(directory,'manifest.yaml'),'not: [valid');
 if(corruption==='wrong-hash')fs.writeFileSync(path.join(directory,'actual.log'),'actual bytes');
 if(corruption==='unsealed-file')fs.writeFileSync(path.join(directory,'unsealed.log'),'not declared');
 assert.equal(previewEvidencePublication(f.root,{directory,nodeId:'owner',name:'fresh'}).ok,false);assert.throws(()=>publishEvidence(f.root,{directory,nodeId:'owner',name:'fresh'}));assert.equal(fs.existsSync(directory),true);assert.equal(fs.existsSync(path.join(f.root,'owner/evidence/fresh')),false);
});

test('node-scoped assets retain primary ownership and checked current bytes',t=>{
 const f=fixture(t);f.stale('unrelated');const file=path.join(f.root,'owner/assets/capture.log');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'synthetic capture');
 const m=f.manifest();m.assets=[{scope:'node',path:'assets/capture.log',sha256:sha256(fs.readFileSync(file))}];const directory=f.stage('fresh',m);
 assert.equal(previewEvidencePublication(f.root,{directory,nodeId:'owner',name:'fresh'}).ok,true);
 fs.writeFileSync(file,'changed capture');assert.throws(()=>publishEvidence(f.root,{directory,nodeId:'owner',name:'fresh'}),/ASSET_HASH/);
});

test('safe fresh-name publication never overwrites prior canonical bytes',t=>{
 const f=fixture(t);f.stale('unrelated');const first=publishEvidence(f.root,{directory:f.stage(),nodeId:'owner',name:'fresh'}),bytes=fs.readFileSync(path.join(first.path,'manifest.yaml'));
 const correction=f.stage('correction');assert.throws(()=>publishEvidence(f.root,{directory:correction,nodeId:'owner',name:'fresh'}));assert.deepEqual(fs.readFileSync(path.join(first.path,'manifest.yaml')),bytes);assert.equal(fs.existsSync(correction),true);
 for(const name of ['../escape','/absolute'])assert.equal(previewEvidencePublication(f.root,{directory:correction,nodeId:'owner',name}).ok,false);
});

test('links in staged bundles or staging locations remain forbidden',t=>{
 const f=fixture(t),directory=f.stage(),external=path.join(f.dir,'external');fs.mkdirSync(external);
 fs.symlinkSync(external,path.join(directory,'linked'),process.platform==='win32'?'junction':'dir');assert.equal(previewEvidencePublication(f.root,{directory,nodeId:'owner',name:'fresh'}).ok,false);assert.throws(()=>publishEvidence(f.root,{directory,nodeId:'owner',name:'fresh'}),/links/);
 const alias=path.join(f.root,'_local/evidence-staging/alias');fs.symlinkSync(directory,alias,process.platform==='win32'?'junction':'dir');assert.equal(previewEvidencePublication(f.root,{directory:alias,nodeId:'owner',name:'fresh'}).ok,false);assert.throws(()=>publishEvidence(f.root,{directory:alias,nodeId:'owner',name:'fresh'}),/staging/);
});
