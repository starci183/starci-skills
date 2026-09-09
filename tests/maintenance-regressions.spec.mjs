import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {validateWorkspace,previewCompletion,previewEvidence,sha256} from '../core/index.mjs';
import {stringifyYaml} from '../core/yaml.mjs';
import {checkEntry} from '../scripts/check-entry.mjs';
import {publishEvidence} from '../workflows/evidence.mjs';
function fixture(t) {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-maintenance-'));
 t.after(()=>{assert.equal(path.dirname(dir),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(dir).startsWith('starci-maintenance-'));fs.rmSync(dir,{recursive:true,force:true});});
 const root=path.join(dir,'.starciwork'),put=(p,x)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,stringifyYaml(x));};
 put(path.join(root,'workspace.yaml'),{schema:'work/workspace@1',id:'synthetic'});
 for(const id of ['piece','neighbor'])put(path.join(root,id,'index.yaml'),{schema:'work/node@2',id,kind:'operations',required:true,state:'todo',assertions:['first','second'],description:'Synthetic maintenance regression; no product acceptance.'});
 const manifest=(id='proof',assertions=['first','second'])=>({schema:'work/evidence@1',id,nodeId:'piece',inputDigest:validateWorkspace(root).nodes.find(n=>n.id==='piece').inputDigest,outcome:'pass',assertions:assertions.map(id=>({id,outcome:'pass',observation:'Synthetic observation'})),assets:[]});
 const stage=(name='new-proof')=>{const directory=path.join(dir,'.starciwork/_local','evidence-staging',name);put(path.join(directory,'manifest.yaml'),manifest(name));return directory;};
 return {dir,root,put,manifest,stage};
}
test('root local plans are excluded from Work hashes and cannot satisfy canonical dependencies',t=>{
 const f=fixture(t),before=validateWorkspace(f.root);
 f.put(path.join(f.root,'_local/plans/demo/goal/index.yaml'),{schema:'starci/plan-goal@1',draft:'not canonical Work'});
 f.put(path.join(f.root,'_local/fake/index.yaml'),{schema:'work/node@2',id:'fake',kind:'operations',state:'done'});
 fs.writeFileSync(path.join(f.root,'_local/scratch.json'),'malformed draft');
 assert.deepEqual(validateWorkspace(f.root),before);
 const file=path.join(f.root,'piece/index.yaml');
 f.put(file,{schema:'work/node@2',id:'piece',kind:'operations',state:'todo',description:'Synthetic',assertions:['first','second'],dependsOn:['fake']});
 assert.ok(validateWorkspace(f.root).errors.some(e=>e.code==='MISSING_REF'));
 f.put(path.join(f.root,'neighbor/_local/index.yaml'),{schema:'starci/plan-goal@1'});
 assert.ok(validateWorkspace(f.root).errors.some(e=>e.code==='RESERVED_DIRECTORY'));
});

test('root local state cannot be a link and nested canonical evidence is not a staging area',t=>{
 const f=fixture(t),external=path.join(f.dir,'external');fs.mkdirSync(external);
 fs.symlinkSync(external,path.join(f.root,'_local'),process.platform==='win32'?'junction':'dir');
 assert.ok(validateWorkspace(f.root).errors.some(e=>e.code==='SYMLINK'));
});

test('current host entry with stale task INDEX.md is a context refresh, not missing runtime',t=>{
 const f=fixture(t);fs.mkdirSync(path.join(f.dir,'.claude'));fs.writeFileSync(path.join(f.dir,'.claude/SKILL.md'),'Synthetic skill');
 for(const name of ['AGENTS.md','CLAUDE.md'])fs.writeFileSync(path.join(f.dir,name),'Read .claude/SKILL.md');
 const result=checkEntry(f.dir,{claimedEntry:'.claude/INDEX.md'});
 assert.equal(result.status,'context-refresh-required');assert.equal(result.runtimeWriteRequired,false);
 assert.equal(fs.existsSync(path.join(f.dir,'.claude/INDEX.md')),false);
 assert.equal(checkEntry(f.dir).status,'ready');
 fs.writeFileSync(path.join(f.dir,'AGENTS.md'),'Read .claude/INDEX.md');
 assert.equal(checkEntry(f.dir).status,'bootstrap-review-required');
 assert.equal(checkEntry(path.join(f.dir,'missing')).status,'missing-runtime');
});
test('saveRun terminates for Windows slash variants without changing frozen request digests',t=>{
 const f=fixture(t),url=new URL('../workflows/lifecycle.mjs',import.meta.url).href;
 const goal={schema:'starci/goal@1',id:'synthetic',workflow:'prepare-work',requestId:'request',originalRequest:'Synthetic metadata preparation',finalOutcome:'Valid metadata',scope:{business:['synthetic'],paths:[],resources:['work'],exclusions:[]},criteria:['valid'],businessChanges:['Synthetic metadata only'],impacts:[],resourceEffects:[{target:'work',operation:'prepare',postcondition:'valid'}],inputs:{request:'synthetic'},workTargets:[],cells:[{id:'prepare-work',op:'workspace.manage',operation:'prepare',purpose:'Synthetic scope',finalOutput:'Work',criteria:['valid'],inputs:{request:{from:'request',key:'request'}},outputSchema:{type:'object',properties:{result:{type:'string'}},required:['result'],additionalProperties:false}}]};
 const variants=process.platform==='win32'?[f.root,f.root.replaceAll('\\','/'),f.root.replace('\\','/')]:[f.root];
 for(const [i,root]of variants.entries()) {
  const code=`import {propose,saveRun,workflowDigest} from ${JSON.stringify(url)};const run=propose(${JSON.stringify(goal)},{workRoot:${JSON.stringify(root)}});const before=workflowDigest(run);saveRun(run,'variant-${i}');if(workflowDigest(run)!==before)throw Error('Frozen run changed');`;
  const child=spawnSync(process.execPath,['--input-type=module','-e',code],{encoding:'utf8',timeout:3000});
  assert.equal(child.error,undefined);assert.equal(child.status,0,child.stderr);
 }
});
test('completion preview catches missing assertions before acceptance without transient done writes',t=>{
 const f=fixture(t),manifest=f.manifest('incomplete',['first']);
 f.put(path.join(f.root,'piece/evidence/incomplete/manifest.yaml'),manifest);
 const file=path.join(f.root,'piece/index.yaml'),before=fs.readFileSync(file),completions={piece:{inputDigest:manifest.inputDigest,evidence:['incomplete']}};
 const preview=previewCompletion(f.root,completions);
 assert.equal(preview.ok,false);assert.equal(preview.preview,true);assert.ok(preview.errors.length);
 assert.deepEqual(fs.readFileSync(file),before);assert.equal(validateWorkspace(f.root).ok,true);
 f.put(path.join(f.root,'piece/evidence/complete/manifest.yaml'),f.manifest('complete'));
 const complete=previewCompletion(f.root,{piece:{inputDigest:manifest.inputDigest,evidence:['complete']}});
 assert.equal(complete.ok,true);assert.equal(complete.nodes.find(n=>n.id==='piece').effectiveState,'done');
 assert.equal(validateWorkspace(f.root).nodes.find(n=>n.id==='piece').state,'todo');
 assert.equal(previewCompletion(f.root,{missing:completions.piece}).ok,false);
});
test('completion preview preserves parent and evidence ownership gates',t=>{
 const f=fixture(t),m=f.manifest();f.put(path.join(f.root,'piece/evidence/proof/manifest.yaml'),m);
 const other=validateWorkspace(f.root).nodes.find(n=>n.id==='neighbor');
 assert.equal(previewCompletion(f.root,{neighbor:{inputDigest:other.inputDigest,evidence:['proof']}}).ok,false);
 f.put(path.join(f.root,'piece/index.yaml'),{schema:'work/node@2',id:'piece',kind:'operations',required:true,description:'Synthetic parent derives completion'});
 f.put(path.join(f.root,'piece/child/index.yaml'),{schema:'work/node@2',id:'child',kind:'operations',required:true,state:'todo',assertions:['child'],description:'Synthetic child'});
 assert.equal(validateWorkspace(f.root).ok,true);
 assert.equal(previewCompletion(f.root,{piece:{inputDigest:m.inputDigest,evidence:['proof']}}).ok,false);
});
test('staged evidence is invisible until whole-bundle publication; unrelated Work stays valid',t=>{
 const f=fixture(t),directory=f.stage(),asset=path.join(directory,'result.log');
 fs.writeFileSync(asset,'complete bytes');const m=f.manifest('new-proof');m.assets=[{path:'result.log',sha256:sha256(fs.readFileSync(asset))}];f.put(path.join(directory,'manifest.yaml'),m);
 const before=validateWorkspace(f.root);assert.equal(before.ok,true);
 assert.equal(previewEvidence(f.root,{directory,nodeId:'piece',name:'new-proof'}).ok,true);
 const rename=fs.renameSync;
 t.mock.method(fs,'renameSync',(from,to)=>{assert.equal(validateWorkspace(f.root).ok,true);rename(from,to);assert.equal(validateWorkspace(f.root).ok,true);});
 const result=publishEvidence(f.root,{directory,nodeId:'piece',name:'new-proof'});
 assert.equal(fs.existsSync(directory),false);assert.equal(fs.existsSync(path.join(result.path,'manifest.yaml')),true);
 assert.deepEqual(validateWorkspace(f.root).nodes,before.nodes);
});
test('bad staged hash never poisons shared Work and published evidence cannot be overwritten',t=>{
 const f=fixture(t),directory=f.stage();fs.writeFileSync(path.join(directory,'proof.log'),'actual');
 const m=f.manifest('new-proof');m.assets=[{path:'proof.log',sha256:'0'.repeat(64)}];f.put(path.join(directory,'manifest.yaml'),m);
 assert.throws(()=>publishEvidence(f.root,{directory,nodeId:'piece',name:'new-proof'}),/preflight/);
 assert.equal(validateWorkspace(f.root).ok,true);assert.equal(fs.existsSync(directory),true);
 m.assets[0].sha256=sha256('actual');f.put(path.join(directory,'manifest.yaml'),m);publishEvidence(f.root,{directory,nodeId:'piece',name:'new-proof'});
 const next=f.stage('correction');assert.throws(()=>publishEvidence(f.root,{directory:next,nodeId:'piece',name:'new-proof'}));
 assert.equal(fs.existsSync(next),true);assert.equal(validateWorkspace(f.root).ok,true);
});
test('evidence staging refuses traversal, hidden metadata, foreign owner and unauthorized staging roots',t=>{
 const f=fixture(t);
 for(const name of ['../escape','/absolute'])assert.equal(previewEvidence(f.root,{directory:f.stage('safe'),nodeId:'piece',name}).ok,false);
 const directory=f.stage('unsafe');f.put(path.join(directory,'index.yaml'),{schema:'work/node@2'});
 assert.equal(previewEvidence(f.root,{directory,nodeId:'piece',name:'unsafe'}).ok,false);
 const good=f.stage('owned');assert.equal(previewEvidence(f.root,{directory:good,nodeId:'neighbor',name:'owned'}).ok,false);
 assert.throws(()=>publishEvidence(f.root,{directory:f.dir,nodeId:'piece',name:'wrong'}),/staging/);
 assert.equal(validateWorkspace(f.root).ok,true);
});
