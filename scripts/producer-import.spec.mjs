import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, symlinkSync, unlinkSync, rmdirSync, cpSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { importProducer, validateImportedInput } from './producer-import.mjs';
import { validateRequest } from './validate-request.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),HEAD='1'.repeat(40);
const digest=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
const write=(p,v)=>{mkdirSync(path.dirname(p),{recursive:true});writeFileSync(p,typeof v==='string'?v:JSON.stringify(v,null,2)+'\n');};
const read=p=>JSON.parse(readFileSync(p,'utf8'));
function fixture(){
  const host=mkdtempSync(path.join(tmpdir(),'producer-import-')),sessions=path.join(host,'.worktrees/sessions'),sourceSession=path.join(sessions,'original'),targetSession=path.join(sessions,'receiver'),source=path.join(sourceSession,'step-1/parallel-1'),target=path.join(targetSession,'step-10/parallel-1');
  const req={schemaVersion:9,operatorId:'git.publish',step:1,parallel:1,sessionId:'original',contexts:[],requirements:{},inputs:{},resume:null};
  write(path.join(source,'request/request.json'),req);
  write(path.join(sourceSession,'state.json'),{id:'original',steps:{'1/1':'git.publish'},requestHashes:{'1/1':digest(readFileSync(path.join(source,'request/request.json')))}});
  write(path.join(targetSession,'state.json'),{id:'receiver',steps:{'2/1':'quality.verify'},requestHashes:{},chain:[['2/1']],current:'2/1'});
  const table=(h,header,rows)=>`## ${h}\n\n| ${header.join(' | ')} |\n| ${header.map(()=>'---').join(' | ')} |\n${rows.map(r=>`| ${r.join(' | ')} |`).join('\n')}\n\n`;
  const contract=read(path.join(ROOT,'templates/kinds/git-publication.contract.json'));
  let md='# git-publication — fixture\n\n';
  for(const s of contract.sections){const name=s.heading.slice(4,-1);if(s.rows)md+=table(name,['Field','Value'],s.rows.map(row=>[row,row==='Operator'?'git.publish':row==='Frozen head'?HEAD:'fixture']));else if(name==='Published heads')md+=table(name,['Checkout','Branch','Head','Previous remote head','Commits'],[['fixture','fixture','`'+HEAD+'`','—','1']]);else if(name==='Hooks')md+=table(name,['Hook','Reference','Outcome'],[['`pre-commit`','fixture','passed']]);else md+=table(name,['Code','Subject','Statement'],[['`BOUNDARY_CLEAN`','fixture','Synthetic typed fixture; no publication performed']]);}
  write(path.join(source,'response/response.md'),md);write(path.join(source,'response/artifacts/raw.log'),'raw gate output\n');
  write(path.join(source,'response/response.json'),{schemaVersion:9,operatorId:'git.publish',step:1,parallel:1,status:'done',fields:{'git-publication':'response/response.md'},fallbacks:[],commits:[],next:[]});
  const args={sourceSessionId:'original',sourceStep:1,sourceParallel:1,targetSessionId:'receiver',targetStep:10,targetParallel:1,root:ROOT,hostRoot:host};
  const check=()=>validateImportedInput(ROOT,targetSession,'step-10/parallel-1/response/response.md','git-publication',{hostRoot:host});
  const cleanup=()=>{if(!path.resolve(host).startsWith(path.resolve(tmpdir())+path.sep))throw Error('unsafe fixture cleanup');rmSync(host,{recursive:true,force:true});};
  return {host,sourceSession,targetSession,source,target,args,check,cleanup};
}
test('imports preserve original bytes and ownership without receiver history edits',async()=>{
  const f=fixture();try{const state=readFileSync(path.join(f.targetSession,'state.json'));await importProducer(f.args);assert.deepEqual(await f.check(),[]);assert.ok((await validateRequest(ROOT,f.target)).errors.some(e=>e.includes('evidence-only')));assert.deepEqual(readFileSync(path.join(f.target,'request/request.json')),readFileSync(path.join(f.source,'request/request.json')));assert.equal(read(path.join(f.target,'request/request.json')).sessionId,'original');assert.deepEqual(readFileSync(path.join(f.targetSession,'state.json')),state);await assert.rejects(importProducer(f.args),/already exists/);}finally{f.cleanup();}
});
for(const [name,mutate,needle]of [
  ['changed copy',f=>write(path.join(f.target,'response/artifacts/raw.log'),'changed'),'bytes or origin'],
  ['changed origin',f=>write(path.join(f.source,'response/artifacts/raw.log'),'changed'),'bytes or origin'],
  ['missing origin',f=>unlinkSync(path.join(f.source,'response/response.md')),'origin output'],
  ['missing manifest',f=>unlinkSync(path.join(f.target,'import.json')),'explicit import manifest'],
  ['changed original request',f=>{const p=path.join(f.source,'request/request.json'),v=read(p);v.requirements.extra='changed';write(p,v);},'frozen request hash'],
  ['wrong original operator state',f=>{const p=path.join(f.sourceSession,'state.json'),v=read(p);v.steps['1/1']='quality.verify';write(p,v);},'session operator'],
  ['uncompleted origin',f=>{const p=path.join(f.source,'response/response.json'),v=read(p);v.status='blocked';write(p,v);},'completed producer'],
  ['typed output invalid',f=>write(path.join(f.source,'response/response.md'),'# invalid receipt\n'),'typed output gate'],
  ['origin is another imported slot',f=>write(path.join(f.source,'import.json'),{}),'laundered'],
  ['target promoted into execution history',f=>{const p=path.join(f.targetSession,'state.json'),v=read(p);v.steps['10/1']='git.publish';write(p,v);},'evidence-only'],
  ['Windows alternate data stream path',f=>{const p=path.join(f.target,'import.json'),v=read(p);v.files[0].path='response/file.log:stream';write(p,v);},'invalid import file inventory'],
  ['NUL path',f=>{const p=path.join(f.target,'import.json'),v=read(p);v.files[0].path='response/file\0.log';write(p,v);},'invalid import file inventory'],
])test(`rejects ${name}`,async()=>{const f=fixture();try{await importProducer(f.args);mutate(f);assert.ok((await f.check()).some(e=>e.includes(needle)));}finally{f.cleanup();}});
test('rejects undeclared output and unsafe source coordinates',async()=>{const f=fixture();try{await importProducer(f.args);assert.ok((await validateImportedInput(ROOT,f.targetSession,'step-10/parallel-1/response/artifacts/raw.log','git-publication',{hostRoot:f.host})).some(e=>e.includes('not an output')));await assert.rejects(importProducer({...f.args,sourceSessionId:'../escape',targetStep:11}),/strict/);await assert.rejects(importProducer({...f.args,targetStep:-1}),/strict/);}finally{f.cleanup();}});
test('rejects symlinked imported evidence',async()=>{const f=fixture();try{await importProducer(f.args);const dir=path.join(f.target,'response/artifacts');unlinkSync(path.join(dir,'raw.log'));rmdirSync(dir);symlinkSync(path.join(f.source,'response/artifacts'),dir,process.platform==='win32'?'junction':'dir');assert.ok((await f.check()).some(e=>e.includes('symlink')));}finally{f.cleanup();}});
test('local input ownership uses receiving request identity rather than fixture folder name',async()=>{const f=fixture();try{const local=path.join(f.targetSession,'step-12/parallel-1');write(path.join(local,'request/request.json'),{sessionId:'logical-session'});write(path.join(local,'response/response.md'),'local input');const ref='step-12/parallel-1/response/response.md';assert.deepEqual(await validateImportedInput(ROOT,f.targetSession,ref,'git-publication',{hostRoot:f.host,receivingSessionId:'logical-session'}),[]);assert.ok((await validateImportedInput(ROOT,f.targetSession,ref,'git-publication',{hostRoot:f.host,receivingSessionId:'other-session'})).some(e=>e.includes('explicit import manifest')));await importProducer(f.args);assert.ok((await validateImportedInput(ROOT,f.targetSession,'step-10/parallel-1/response/response.md','git-publication',{hostRoot:f.host,receivingSessionId:'logical-session'})).some(e=>e.includes('target does not match')));}finally{f.cleanup();}});
test('actual CLI subprocess completes its dynamic validator imports and exits zero',async()=>{
  const f=fixture();try{
    const runtime=path.join(f.host,'.claude');
    for(const folder of ['scripts','templates','operators','resources'])cpSync(path.join(ROOT,folder),path.join(runtime,folder),{recursive:true});
    cpSync(path.join(ROOT,'routing.json'),path.join(runtime,'routing.json'));
    const result=spawnSync(process.execPath,[path.join(runtime,'scripts/producer-import.mjs'),'original','1','1','receiver','10','1'],{cwd:f.host,encoding:'utf8',shell:false,windowsHide:true,timeout:30000});
    assert.equal(result.error,undefined);assert.equal(result.status,0,result.stderr);assert.doesNotMatch(result.stderr,/unsettled|top-level await/i);
    assert.equal(JSON.parse(result.stdout).sourceSessionId,'original');assert.deepEqual(await f.check(),[]);
  }finally{f.cleanup();}
});

test('actual request and response validator CLIs complete with an imported changes bundle',async()=>{
  const f=fixture();try{
    const table=(name,headers,rows=[])=>`## ${name}\n\n| ${headers.join(' | ')} |\n| ${headers.map(()=>'---').join(' | ')} |\n${rows.map(row=>`| ${row.join(' | ')} |`).join('\n')}\n\n`;
    const requestFile=path.join(f.source,'request/request.json'),request=read(requestFile);
    request.operatorId='frontend.source.apply';request.requirements={mode:'apply'};write(requestFile,request);
    write(path.join(f.sourceSession,'state.json'),{id:'original',steps:{'1/1':request.operatorId},requestHashes:{'1/1':digest(readFileSync(requestFile))}});
    write(path.join(f.source,'response/response.md'),'# frontend-source-application — fixture\n\n'+
      table('Binding',['Field','Value'],[['Target','fixture'],['Mode','apply'],['Branch','session/original'],['Base','2'.repeat(40)],['Commit',HEAD]])+
      table('Projection',['Path','Change','Classes','Claims','Why'],[['`app/test.tsx`','modified','—','—','Synthetic typed fixture']])+
      table('Rejections',['Path','Value','Because'])+table('Fallbacks taken',['Code','Action']));
    write(path.join(f.source,'response/changes.md'),'# changes — frontend.source.apply step-1/parallel-1\n\n'+
      table('Binding',['Field','Value'],[['Operator',request.operatorId],['Step','step-1/parallel-1'],['Checkout','fixture'],['Predecessor','fixture']])+
      table('Files',['Path','Change','Why','Claims'],[['`app/test.tsx`','modified','Synthetic typed fixture','—']])+'## What the next step must know\n\nFixture only; no source operation was performed.\n');
    write(path.join(f.source,'response/data/writes.json'),{mode:'apply',base:'2'.repeat(40),branch:'session/original',commit:HEAD,files:[{path:'app/test.tsx',change:'modified',before:digest('before'),after:digest('after'),classes:[]}],sweep:{command:'node scripts/sweep-presentation.mjs',exitCode:0,findings:[],output:'{"scanned":0,"findings":[]}'}});
    write(path.join(f.source,'response/response.json'),{schemaVersion:9,operatorId:request.operatorId,step:1,parallel:1,status:'done',fields:{'frontend-source-application':'response/response.md',changes:'response/changes.md',writes:'response/data/writes.json'},fallbacks:[],commits:[HEAD],next:[]});
    await importProducer(f.args);
    const receiver=path.join(f.targetSession,'step-2/parallel-1');
    write(path.join(receiver,'request/request.json'),{schemaVersion:9,operatorId:'quality.verify',step:2,parallel:1,sessionId:'receiver',contexts:[],requirements:{},inputs:{changes:'step-10/parallel-1/response/changes.md'},resume:null});
    write(path.join(f.targetSession,'state.json'),{id:'receiver',project:'fixture',startedAt:'2026-09-04T00:00:00Z',status:'running',steps:{'2/1':'quality.verify'},requestHashes:{},chain:[['2/1']],current:'2/1'});
    write(path.join(receiver,'response/response.json'),{schemaVersion:9,operatorId:'quality.verify',step:2,parallel:1,status:'blocked',stop:'PREDECESSOR_STALE',fields:{},fallbacks:[],commits:[],next:[]});
    const runtime=path.join(f.host,'.claude');
    for(const folder of ['scripts','templates','operators','resources'])cpSync(path.join(ROOT,folder),path.join(runtime,folder),{recursive:true});
    cpSync(path.join(ROOT,'routing.json'),path.join(runtime,'routing.json'));
    const run=script=>spawnSync(process.execPath,[path.join(runtime,'scripts',script),receiver],{cwd:f.host,encoding:'utf8',shell:false,windowsHide:true,timeout:30000});
    for(const script of ['validate-request.mjs','validate-response.mjs']){
      const result=run(script);assert.equal(result.error,undefined);assert.equal(result.status,0,`${script}: ${result.stderr}`);assert.doesNotMatch(result.stderr,/unsettled|top-level await/i);assert.match(result.stdout,/valid/);
    }
    write(path.join(f.target,'response/artifacts/raw.log'),'tampered');
    const rejected=run('validate-request.mjs');assert.equal(rejected.status,1,rejected.stderr);assert.match(rejected.stderr,/bytes or origin/);assert.doesNotMatch(rejected.stderr,/unsettled|top-level await/i);
  }finally{f.cleanup();}
});
