import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {createSourceFixture,acceptArchitecture,sha,put} from './workflow-source-fixture.mjs';
import {execFileSync} from 'node:child_process';

test('fresh nested critique admits measured source only and accepts an independently source-informed review',async t=>{
 const f=await createSourceFixture(t,{sessionId:'source-grounded-review',initialFiles:{'README.md':'Disposable stateless fixture.\n'.repeat(600)}});
 const {openAttempt}=await f.load('scripts/attempt-gate.mjs');
 await acceptArchitecture(f,{beforeCritique:async(_,{request,branch,snapshot})=>{
  const requestFile=path.join(branch,'request/request.json'),snapshotFile=path.join(branch,'request/source-review.json');
  assert.ok(snapshot.files.find(file=>file.path==='README.md').chunks.length>1);
  const originalRequest=readFileSync(requestFile),originalSnapshot=readFileSync(snapshotFile),stateFile=path.join(f.session,'state.json');
  const probe=async(change,pattern)=>{
   const value=structuredClone(request),source=structuredClone(snapshot);change(value,source);
   const bytes=JSON.stringify(source,null,2)+'\n';put(snapshotFile,bytes);
   if(value.frozenInputs.length)value.frozenInputs[0].sha256=sha(bytes);
   put(requestFile,value);const before=readFileSync(stateFile);
   await assert.rejects(openAttempt(branch),pattern);
   assert.deepEqual(readFileSync(stateFile),before,'rejected admission changes neither attempts nor ledger');
   writeFileSync(requestFile,originalRequest);writeFileSync(snapshotFile,originalSnapshot);
  };
  await probe(value=>{value.frozenInputs=[];},/fresh critique requires/);
  await probe((value,source)=>{source.head='0'.repeat(40);},/parent source HEAD/);
  await probe((value,source)=>{source.files[0].blob='0'.repeat(40);},/actual bound Git/);
  await probe((value,source)=>{source.files[0].chunks.push('invented');source.files[0].sha256=sha(source.files[0].chunks.join(''));},/actual bound Git/);
  await probe((value,source)=>{source.files=source.files.slice(1);},/omits observed boundary/);
  await probe((value,source)=>{source.repository='https://foreign.invalid/repo';},/actual bound Git/);
  await probe((value,source)=>{source.files[0].path='../foreign';},/path traversal|unsafe/);
  await probe(value=>{value.inputs['architecture-decision']=`step-${request.step}/parallel-1/response/response.md`;},/rationale|additional authored|does not exist|not declared/);
  await probe((value,source)=>{source.authorRationale='Trust the author';},/unexpected property/);
  const {architectureSourceRequestErrors,collectArchitectureSource}=await f.load('scripts/architecture-source-review.mjs');
  const savedState=readFileSync(stateFile),fake=f.state(),key=`${request.step}/${request.parallel}/critique`;
  const missing={...request,frozenInputs:[]};
  put(requestFile,missing);fake.requestHashes[key]=sha(readFileSync(requestFile));
  fake.attempts[key]={...fake.attempts[`${request.step}/${request.parallel}`],status:'matched',id:request.attempt.id};put(stateFile,fake);
  assert.match((await architectureSourceRequestErrors(f.root,branch,missing,{phase:'accept'})).join('\n'),/fresh critique requires/,'copied parent context and status cannot manufacture historical acceptance');
  writeFileSync(stateFile,savedState);writeFileSync(requestFile,originalRequest);
  const routeFile=path.join(f.session,'step-1/parallel-1/response/data/route.json'),routeBytes=readFileSync(routeFile),route=JSON.parse(routeBytes);
  route.checkout.gitRepository='https://foreign.invalid/repository';put(routeFile,route);
  await assert.rejects(collectArchitectureSource(f.root,branch),/evidenceManifest/);
  writeFileSync(routeFile,routeBytes);
 }});
 const state=f.state(),child=state.attempts['3/1/critique'];
 assert.equal(child.status,'matched');assert.equal(state.attempts['3/1'].status,'matched');
 const{architectureSourceCritiqueErrors}=await f.load('scripts/architecture-source-review.mjs');
 assert.deepEqual(await architectureSourceCritiqueErrors(f.root,path.join(f.session,'step-3/parallel-1')),[]);
 const critiqueFile=path.join(f.session,'step-3/parallel-1/critique/response/critique.md'),bytes=readFileSync(critiqueFile);
 writeFileSync(critiqueFile,bytes.toString().replaceAll('[source:package.json] [source:README.md] ',''));
 assert.ok((await architectureSourceCritiqueErrors(f.root,path.join(f.session,'step-3/parallel-1'))).some(error=>/source evidence/.test(error)));
 writeFileSync(critiqueFile,bytes);
});

test('source collection rejects actual Git symlink blobs and subtree or traversal selectors',async t=>{
 const initial=await createSourceFixture(t,{sessionId:'source-link-base'});
 const run=(...args)=>execFileSync('git',['-C',initial.repository,...args],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();
 const blob=execFileSync('git',['-C',initial.repository,'hash-object','-w','--stdin'],{input:'README.md',encoding:'utf8',windowsHide:true}).trim();
 run('update-index','--add','--cacheinfo',`120000,${blob},source-link`);
 run('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','Add a real Git symlink for source containment test');
 const f=await createSourceFixture(t,{sessionId:'source-link-review',existing:{...initial,base:run('rev-parse','HEAD')}});
 await acceptArchitecture(f,{beforeCritique:async(_,{branch})=>{
  const {collectArchitectureSource}=await f.load('scripts/architecture-source-review.mjs');
  for(const ref of ['source-link','../README.md','.'])await assert.rejects(collectArchitectureSource(f.root,branch,{extraPaths:[ref]}),/regular Git blob|unsafe source path/);
 }});
});
