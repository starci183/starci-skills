import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, symlinkSync, unlinkSync, rmdirSync, cpSync, rmSync, readdirSync, mkdtempSync } from 'node:fs';
import { spawnSync, execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { importProducer, validateImportedInput, acceptedProducerProof } from './producer-import.mjs';
import { validateRequest } from './validate-request.mjs';
import { producerImportFixture, HEAD, digest, write, read } from './producer-import-fixture.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// Historical output compatibility is exercised in an unmarked evidence-only receiver. The
// current receiver below is opened and confirmed through the actual session lifecycle.
const fixture=()=>{const f=producerImportFixture();write(path.join(f.targetSession,'state.json'),{id:'receiver',steps:{},requestHashes:{},chain:[]});return f;};

// A copied runtime keeps even the synthetic workflow-owner registry under this temporary host.
// The producer goes through openAttempt and acceptAttempt: no passing ledger verdict is injected.
async function currentFixture(t){
  const host=mkdtempSync(path.join(tmpdir(),'producer-import-current-')),root=path.join(host,'.claude');
  t.after(()=>{if(!path.resolve(host).startsWith(path.resolve(tmpdir())+path.sep))throw Error('unsafe fixture cleanup');rmSync(host,{recursive:true,force:true});});
  for(const file of ['package.json',...read(path.join(ROOT,'package.json')).files])cpSync(path.join(ROOT,file),path.join(root,file),{recursive:true});
  const moduleAt=ref=>import(pathToFileURL(path.join(root,ref)).href);
  const [{openSession,confirmSession},{openAttempt,acceptAttempt},imports]=await Promise.all([moduleAt('scripts/v23-test-fixture.mjs'),moduleAt('scripts/attempt-gate.mjs'),moduleAt('scripts/producer-import.mjs')]);
  const opened=await openSession(path.join(host,'.worktrees/sessions'),{sessionId:'current-origin',project:'imports',hostBinding:{kind:'codex-task',hostId:path.basename(host),worktree:host,sourcePromptRef:'user:fixture'},mission:{language:'en',goal:'Plan an attributable fixture unit.',target:'Declared seed plan',includes:['Seed planning'],excludes:['Product changes'],outputs:['Seed plan'],doneWhen:[{evidence:'One attributable seed unit is planned.',producedBy:'data.plan'}],verification:'Validate the plan and units.',sourceRef:'user:fixture'}});
  await confirmSession(opened.session,{selected:'as-stated',selectedBy:'user',sourceRef:'user:approved'});
  const sourceSession=opened.session,source=path.join(sourceSession,'step-1/parallel-1'),stateFile=path.join(sourceSession,'state.json');
  const head=execFileSync('git',['-C',host,'rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim();
  const contexts=[{alias:'@workspaces/be',head:null},{alias:'@worktrees/_templates',head:null},{alias:'@worktrees/uat/items',head:null}];
  const request={contractVersion:'starci/v2.2',schemaVersion:9,operatorId:'data.plan',sessionId:opened.sessionId,step:1,parallel:1,contexts,requirements:{goal:'The fixture unit supports the declared journey.',feature:'items',env:'dev'},inputs:{},resume:null,goal:{doneWhen:0},attempt:{id:'1/1:a1',number:1,kind:'initial',previous:null},expected:{version:1,goalVersion:1,sourceRef:'state.json#mission:v1/doneWhen:0',criteria:[{id:'units',required:true,expected:'One attributable unit is planned.',verification:'Validate the plan and units.'}]},environment:{isolationId:'1/1:a1',mode:'isolated',workspace:{alias:'@workspaces/be',worktree:host,revision:head},reads:contexts.map(c=>c.alias),writes:[],exclusive:[],outputRoot:'response'},frozenInputs:[]};
  const state=read(stateFile);state.chain=[['1/1']];state.steps={'1/1':'data.plan'};state.current='1/1';write(stateFile,state);
  write(path.join(source,'request/request.json'),request);await openAttempt(source);
  const unit={id:'first',kind:'table',goal:'The owned fixture is available.',inputs:[],dependsOn:[]};
  const table=(name,columns,rows)=>`\n## ${name}\n\n| ${columns.join(' | ')} |\n| ${columns.map(()=> '---').join(' | ')} |\n${rows.map(row=>`| ${row.join(' | ')} |`).join('\n')}\n`;
  write(path.join(source,'response/response.md'),'# seed-plan — items\n'+table('Units',['Unit','Serves','Namespace','Goal'],[['`first`','flow `first`','`uat-first`',unit.goal]])+table('Targets',['Unit','Store','Attribution','Volume','Rollback'],[['`first`','`items`','owner','2','Remove every record owned by the unit account.']])+table('Fixtures',['Unit','State','Action','JSON','SQL','Expected','Creates outcome'],[['`first`','valid','reuse','`.worktrees/uat/items/first/seed/records.json`','—','Two owned records read back.','false']])+table('Fallbacks taken',['Code','Action'],[]));
  write(path.join(source,'response/data/units.json'),{schemaVersion:9,producedBy:'data.plan',units:[unit]});
  const evidence=['response/response.md','response/data/units.json'];
  write(path.join(source,'response/response.json'),{contractVersion:'starci/v2.2',schemaVersion:9,operatorId:'data.plan',step:1,parallel:1,status:'done',fields:{'seed-plan':evidence[0],units:evidence[1]},fallbacks:[],commits:[],next:['data.seed'],boundProfile:'sol-reviewer',ranProfile:'sol-reviewer',attempt:{id:'1/1:a1',number:1,expectedVersion:1},actual:{expectedVersion:1,observedAt:new Date().toISOString(),observations:[{criterionId:'units',observed:'The attributable unit is declared.',evidence}]},comparison:{expectedVersion:1,verdict:'matched',criteria:[{criterionId:'units',verdict:'matched',evidence,note:'The unit and target validate.'}],next:'advance'},goalCheck:{achieved:true,evidence},outcome:{summary:'An attributable fixture unit is planned.',primary:{kind:'document',label:'Seed plan',ref:evidence[0]}}});
  assert.equal((await acceptAttempt(source)).state,'matched');
  const receiver=await openSession(path.join(host,'.worktrees/sessions'),{sessionId:'current-receiver',project:'imports-receiver',hostBinding:{kind:'codex-task',hostId:`${path.basename(host)}-receiver`,worktree:host,sourcePromptRef:'user:receiver'},mission:{language:'en',goal:'Consume an accepted attributable fixture plan.',target:'Declared seed plan',includes:['Accepted plan inspection'],excludes:['Product changes'],outputs:['Verified plan input'],doneWhen:[{evidence:'The accepted fixture plan is available.',producedBy:'data.plan'}],verification:'Validate the original accepted producer and exact copied bytes.',sourceRef:'user:receiver'}});
  await confirmSession(receiver.session,{selected:'as-stated',selectedBy:'user',sourceRef:'user:receiver-approved'});
  const targetSession=receiver.session,target=path.join(targetSession,'step-100/parallel-1');
  const args={sourceSessionId:opened.sessionId,sourceStep:1,sourceParallel:1,targetSessionId:'current-receiver',targetStep:100,targetParallel:1,root,hostRoot:host};
  const proof=()=>imports.acceptedProducerProof(root,opened.sessionId,1,1,'units',{hostRoot:host});
  const check=()=>imports.validateImportedInput(root,targetSession,'step-100/parallel-1/response/data/units.json','units',{hostRoot:host});
  return {host,root,source,sourceSession,target,targetSession,stateFile,head,args,proof,check,moduleAt,...imports};
}

test('current imports use actual accepted proof and reject unaccepted, altered or semantically invalid producers',async t=>{
  const f=await currentFixture(t),savedState=readFileSync(f.stateFile);
  const files=['request/request.json','response/response.json','response/response.md','response/data/units.json'];
  const originals=new Map(files.map(ref=>[ref,readFileSync(path.join(f.source,ref))]));
  const restore=()=>{write(f.stateFile,savedState.toString());for(const [ref,bytes]of originals)write(path.join(f.source,ref),bytes.toString());};
  await t.test('accepted artifact exposes exact identity, manifest, original refs and verified repository binding',async()=>{
    const proof=await f.proof(),state=read(f.stateFile);
    assert.equal(proof.attemptId,state.attempts['1/1'].id);assert.equal(proof.manifestFingerprint,state.attempts['1/1'].evidenceManifest.fingerprint);
    assert.equal(proof.sessionRoot,f.sourceSession);assert.deepEqual(proof.artifacts,[{ref:'step-1/parallel-1/response/data/units.json',sha256:digest(originals.get('response/data/units.json'))}]);
    assert.equal(proof.bindings[0].revision,f.head);assert.match(proof.bindings[0].repositoryHash,/^sha256:[a-f0-9]{64}$/);assert.deepEqual(proof.heads,[]);
    const receiver=readFileSync(path.join(f.targetSession,'state.json'));await f.importProducer(f.args);assert.deepEqual(await f.check(),[]);
    assert.deepEqual(readFileSync(path.join(f.targetSession,'state.json')),receiver);assert.deepEqual(readFileSync(path.join(f.target,'request/request.json')),originals.get('request/request.json'));
    await assert.rejects(f.importProducer(f.args),/already exists/);
    await assert.rejects(f.acceptedProducerProof(f.root,f.args.sourceSessionId,1,1,'mutations',{hostRoot:f.host}),/kind was not emitted/);
  });
  const stateChange=fn=>{const state=read(f.stateFile);fn(state);write(f.stateFile,state);};
  for(const [name,mutate,needle]of [
    ['done without acceptance',()=>stateChange(state=>{delete state.attempts['1/1'];}),/matched accepted/],
    ['running attempt with a done receipt',()=>stateChange(state=>{state.attempts['1/1'].status='running';}),/matched accepted/],
    ['mismatched attempt',()=>stateChange(state=>{state.attempts['1/1'].status='mismatched';}),/matched accepted/],
    ['missing accepted manifest',()=>stateChange(state=>{delete state.attempts['1/1'].evidenceManifest;}),/manifest/],
    ['tampered accepted manifest',()=>stateChange(state=>{state.attempts['1/1'].evidenceManifest.files.pop();}),/manifest/i],
    ['wrong original attempt identity',()=>stateChange(state=>{state.attempts['1/1'].id='foreign-a1';}),/identity/],
    ['wrong accepted response coordinate',()=>stateChange(state=>{state.attempts['1/1'].responseRef='step-2/parallel-1/response/response.json';}),/identity/],
    ['changed original request',()=>{const ref=path.join(f.source,'request/request.json'),request=read(ref);request.requirements.feature='changed';write(ref,request);},/frozen request hash/],
    ['changed original model',()=>{const ref=path.join(f.source,'response/data/units.json'),model=read(ref);model.units[0].goal='Altered after acceptance';write(ref,model);},/manifest/i],
    ['unrecorded extra evidence',()=>write(path.join(f.source,'response/extra.txt'),'unsealed'),/manifest/i],
    ['wrong runtime revision',()=>stateChange(state=>{state.runtimeRevision-=1;}),/current runtime revision/],
    ['downgraded current request contract',()=>{const ref=path.join(f.source,'request/request.json'),request=read(ref);delete request.contractVersion;write(ref,request);stateChange(state=>{state.requestHashes['1/1']=digest(readFileSync(ref));});},/matching contracts/],
    ['another producer session',()=>stateChange(state=>{state.id='foreign';}),/original session/],
    ['origin laundered from an import',()=>write(path.join(f.source,'import.json'),{}),/laundered/]
  ])await t.test(name,async()=>{
    try{mutate();await assert.rejects(f.proof(),needle);await assert.rejects(f.importProducer({...f.args,targetStep:101}),needle);assert.match((await f.check()).join('\n'),needle);}
    finally{restore();for(const ref of ['response/extra.txt','import.json']){const file=path.join(f.source,ref);try{unlinkSync(file);}catch(error){if(error.code!=='ENOENT')throw error;}}}
  });
  await t.test('a forged replacement seal cannot suppress the original operator validator',async()=>{
    try{
      const file=path.join(f.source,'response/data/units.json'),model=read(file);model.units[0].kind='page';write(file,model);
      const {buildEvidenceManifest}=await f.moduleAt('scripts/evidence-manifest.mjs');
      stateChange(state=>{state.attempts['1/1'].evidenceManifest=null;});
      const state=read(f.stateFile);state.attempts['1/1'].evidenceManifest=await buildEvidenceManifest(f.source);write(f.stateFile,state);
      await assert.rejects(f.proof(),/accepted operator gate.*unit first is a page/);
      await assert.rejects(f.importProducer({...f.args,targetStep:101}),/accepted operator gate.*unit first is a page/);
    }finally{restore();}
  });
  await t.test('current receipts cannot use the legacy missing-section tolerance',async()=>{
    try{
      write(path.join(f.source,'response/response.md'),originals.get('response/response.md').toString().replace(/\n## Fallbacks taken[\s\S]*$/,'\n'));
      const {buildEvidenceManifest}=await f.moduleAt('scripts/evidence-manifest.mjs');
      const state=read(f.stateFile);state.attempts['1/1'].evidenceManifest=await buildEvidenceManifest(f.source);write(f.stateFile,state);
      await assert.rejects(f.proof(),/full typed output gate.*section/);
    }finally{restore();}
  });
  await t.test('legacy typed output compatibility cannot satisfy current consumer proof',async()=>{
    const legacy=fixture();try{await assert.rejects(acceptedProducerProof(ROOT,'original',1,1,'git-publication',{hostRoot:legacy.host}),/current runtime revision/);}finally{legacy.cleanup();}
  });
  await t.test('all-legacy origin is rejected on import and read by a real current receiver',async()=>{
    const legacy=fixture();
    try{
      const original=path.join(f.host,'.worktrees/sessions/original');
      cpSync(legacy.sourceSession,original,{recursive:true});
      const args={...f.args,sourceSessionId:'original',targetStep:102};
      const receiverFile=path.join(f.targetSession,'state.json'),before=readFileSync(receiverFile);
      await assert.rejects(f.importProducer(args),/current receiver.*legacy evidence/);
      assert.equal(readdirSync(f.targetSession).includes('step-102'),false,'rejection publishes no target');
      assert.deepEqual(readFileSync(receiverFile),before);
      // This copied, byte-preserving legacy import was admitted only to the legacy inspection
      // receiver. Moving the fixture into a current ledger must not make it consumable there.
      await importProducer(legacy.args);
      const planted=path.join(f.targetSession,'step-102/parallel-1');
      cpSync(legacy.target,planted,{recursive:true});
      const manifest=read(path.join(planted,'import.json'));
      manifest.targetSessionId=f.args.targetSessionId;manifest.targetStep=102;write(path.join(planted,'import.json'),manifest);
      const errors=await f.validateImportedInput(f.root,f.targetSession,'step-102/parallel-1/response/response.md','git-publication',{hostRoot:f.host});
      assert.match(errors.join('\n'),/current receiver.*legacy evidence/);
      assert.deepEqual(readFileSync(receiverFile),before);
      assert.match((await validateImportedInput(ROOT,legacy.targetSession,'step-100/parallel-1/response/response.md','git-publication',{hostRoot:legacy.host,receivingContractVersion:'starci/v2.2'})).join('\n'),/current receiver.*legacy evidence/,'the current request marker also prevents an unmarked receiver bypass');
    }finally{legacy.cleanup();}
  });
  await t.test('retained current acceptance keeps its exact proof and remains importable',async()=>{
    const before=await f.proof(),state=read(f.stateFile);state.status='done';state.brief.proven=['doneWhen:0 accepted seed plan'];
    const {retainSessionBundle}=await f.moduleAt('scripts/session-cleanup.mjs');
    const retained=await retainSessionBundle(f.sourceSession,state,'Synthetic accepted plan completed.');
    if(path.relative(f.host,f.sourceSession).startsWith('..'))throw Error('unsafe fixture removal');
    rmSync(f.sourceSession,{recursive:true});
    const proof=await f.proof();assert.equal(proof.manifestFingerprint,before.manifestFingerprint);assert.equal(proof.sessionRoot,retained.bundle);assert.deepEqual(proof.artifacts,before.artifacts);
    await f.importProducer({...f.args,targetStep:101});assert.deepEqual(await f.check(),[]);
  });
});

test('a retained producer remains importable after its active session is removed, and archive tampering fails',async()=>{
  const f=fixture();try{
    const {retainSessionBundle}=await import('./session-cleanup.mjs');
    const state={...read(path.join(f.sourceSession,'state.json')),status:'done',hostBinding:{kind:'codex-task',hostId:'source-task',worktree:f.host},lifecycle:{phase:'active'},mission:{version:1,goal:'publish the fixture',target:'fixture',includes:['fixture'],outputs:['git-publication'],verification:'synthetic legacy inspection fixture'},brief:{proven:['doneWhen:0 typed publication']},attempts:{'1/1':{id:'original-1',status:'matched',requestRef:'step-1/parallel-1/request/request.json',responseRef:'step-1/parallel-1/response/response.json'}}};
    const retained=await retainSessionBundle(f.sourceSession,state,'fixture completed');
    rmSync(f.sourceSession,{recursive:true});
    await importProducer(f.args);assert.deepEqual(await f.check(),[]);
    write(path.join(retained.bundle,'step-1/parallel-1/response/artifacts/raw.log'),'tampered archive');
    assert.ok((await f.check()).some(error=>error.includes('RETENTION_CHANGED')));
  }finally{f.cleanup();}
});
test('imports preserve original bytes and ownership without receiver history edits',async()=>{
  const f=fixture();try{const state=readFileSync(path.join(f.targetSession,'state.json'));await importProducer(f.args);assert.deepEqual(await f.check(),[]);assert.ok((await validateRequest(ROOT,f.target)).errors.some(e=>e.includes('evidence-only')));assert.deepEqual(readFileSync(path.join(f.target,'request/request.json')),readFileSync(path.join(f.source,'request/request.json')));assert.equal(read(path.join(f.target,'request/request.json')).sessionId,'original');assert.deepEqual(readFileSync(path.join(f.targetSession,'state.json')),state);await assert.rejects(importProducer(f.args),/already exists/);}finally{f.cleanup();}
});

test('partial current markers cannot turn a producer or a receiving workflow into legacy inspection',async()=>{
  for(const marker of [{contractVersion:'starci/v2.2'},{runtimeRevision:3},{contractVersion:null}]){
    const f=fixture();try{
      await importProducer(f.args);
      const receiverFile=path.join(f.targetSession,'state.json');write(receiverFile,{...read(receiverFile),...marker});
      await assert.rejects(importProducer({...f.args,targetStep:101}),/current receiver.*legacy evidence/);
      assert.match((await f.check()).join('\n'),/current receiver.*legacy evidence/);
    }finally{f.cleanup();}
    const g=fixture();try{
      const stateFile=path.join(g.sourceSession,'state.json');write(stateFile,{...read(stateFile),...marker});
      await assert.rejects(importProducer(g.args),/current runtime revision.*matching contracts/);
    }finally{g.cleanup();}
  }
});

test('concurrent imports publish one complete target and leave no staging debris',async()=>{
  const f=fixture();try{
    const results=await Promise.allSettled([importProducer(f.args),importProducer(f.args)]);
    assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
    assert.match(String(results.find(result=>result.status==='rejected').reason),/already exists/);
    assert.deepEqual(await f.check(),[]);
    assert.ok(!readdirSync(path.dirname(f.target)).some(name=>name.includes('-import-')));
  }finally{f.cleanup();}
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
  ['target promoted into execution history',f=>{const p=path.join(f.targetSession,'state.json'),v=read(p);v.steps['100/1']='git.publish';write(p,v);},'evidence-only'],
  ['Windows alternate data stream path',f=>{const p=path.join(f.target,'import.json'),v=read(p);v.files[0].path='response/file.log:stream';write(p,v);},'invalid import file inventory'],
  ['NUL path',f=>{const p=path.join(f.target,'import.json'),v=read(p);v.files[0].path='response/file\0.log';write(p,v);},'invalid import file inventory'],
])test(`rejects ${name}`,async()=>{const f=fixture();try{await importProducer(f.args);mutate(f);assert.ok((await f.check()).some(e=>e.includes(needle)));}finally{f.cleanup();}});
// The origin's `next` is the routing history of the tree that produced it, not a typed output: a
// hand-off to an operator this tree renamed or retired does not block the import, while a missing
// declared output still does.
test('an origin whose next names an operator this tree does not carry imports; an origin missing a typed output does not',async()=>{
  const f=fixture();try{
    const file=path.join(f.source,'response/response.json'),response=read(file);
    write(file,{...response,next:['backend.source.apply']});
    await importProducer(f.args);assert.deepEqual(await f.check(),[]);
    assert.ok((await validateRequest(ROOT,f.target)).errors.some(e=>e.includes('evidence-only')),'the imported slot stays evidence-only');
  }finally{f.cleanup();}
  const g=fixture();try{
    const file=path.join(g.source,'response/response.json'),response=read(file);
    write(file,{...response,fields:{},next:['backend.source.apply']});
    await assert.rejects(importProducer(g.args),/typed output gate: .*required output git-publication is not in fields/);
  }finally{g.cleanup();}
});
test('rejects undeclared output and unsafe source coordinates',async()=>{const f=fixture();try{await importProducer(f.args);assert.ok((await validateImportedInput(ROOT,f.targetSession,'step-100/parallel-1/response/artifacts/raw.log','git-publication',{hostRoot:f.host})).some(e=>e.includes('not an output')));await assert.rejects(importProducer({...f.args,sourceSessionId:'../escape',targetStep:11}),/strict/);await assert.rejects(importProducer({...f.args,targetStep:-1}),/strict/);}finally{f.cleanup();}});
test('rejects symlinked imported evidence',async()=>{const f=fixture();try{await importProducer(f.args);const dir=path.join(f.target,'response/artifacts');unlinkSync(path.join(dir,'raw.log'));rmdirSync(dir);symlinkSync(path.join(f.source,'response/artifacts'),dir,process.platform==='win32'?'junction':'dir');assert.ok((await f.check()).some(e=>e.includes('symlink')));}finally{f.cleanup();}});
test('local input ownership uses receiving request identity rather than fixture folder name',async()=>{const f=fixture();try{const local=path.join(f.targetSession,'step-12/parallel-1');write(path.join(local,'request/request.json'),{sessionId:'logical-session'});write(path.join(local,'response/response.md'),'local input');const ref='step-12/parallel-1/response/response.md';assert.deepEqual(await validateImportedInput(ROOT,f.targetSession,ref,'git-publication',{hostRoot:f.host,receivingSessionId:'logical-session'}),[]);assert.ok((await validateImportedInput(ROOT,f.targetSession,ref,'git-publication',{hostRoot:f.host,receivingSessionId:'other-session'})).some(e=>e.includes('explicit import manifest')));await importProducer(f.args);assert.ok((await validateImportedInput(ROOT,f.targetSession,'step-100/parallel-1/response/response.md','git-publication',{hostRoot:f.host,receivingSessionId:'logical-session'})).some(e=>e.includes('target does not match')));}finally{f.cleanup();}});
// An origin is judged by the tree that accepted it as done: its primary output and the outputs it declares
// are owed; a document section a later release added to the contract is this tree's history and does
// not refuse the import, while a broken document (its title) and a missing primary output still do.
test('an origin missing a contract section a later release added still imports; a broken title and a missing primary output do not',async()=>{
  const f=fixture();try{
    const file=path.join(f.source,'response/response.md'),text=readFileSync(file,'utf8');
    const cut=text.lastIndexOf('\n## ');assert.ok(cut>0,'the fixture receipt has a last section to remove');
    write(file,text.slice(0,cut+1));
    await importProducer(f.args);assert.deepEqual(await f.check(),[]);
  }finally{f.cleanup();}
  const g=fixture();try{
    write(path.join(g.source,'response/response.md'),'# not the receipt\n\n## Binding\n');
    await assert.rejects(importProducer(g.args),/typed output gate: .*title must match/);
  }finally{g.cleanup();}
});
test('actual CLI subprocess completes its dynamic validator imports and exits zero',async()=>{
  const f=fixture();try{
    const runtime=path.join(f.host,'.claude');
    for(const folder of ['scripts','templates','operators','resources'])cpSync(path.join(ROOT,folder),path.join(runtime,folder),{recursive:true});
    cpSync(path.join(ROOT,'routing.json'),path.join(runtime,'routing.json'));
    const result=spawnSync(process.execPath,[path.join(runtime,'scripts/producer-import.mjs'),'original','1','1','receiver','100','1'],{cwd:f.host,encoding:'utf8',shell:false,windowsHide:true,timeout:30000});
    assert.equal(result.error,undefined);assert.equal(result.status,0,result.stderr);assert.doesNotMatch(result.stderr,/unsettled|top-level await/i);
    assert.equal(JSON.parse(result.stdout).sourceSessionId,'original');assert.deepEqual(await f.check(),[]);
  }finally{f.cleanup();}
});

test('actual request and response validator CLIs complete with an imported changes bundle',async()=>{
  const f=fixture();try{
    const table=(name,headers,rows=[])=>`## ${name}\n\n| ${headers.join(' | ')} |\n| ${headers.map(()=>'---').join(' | ')} |\n${rows.map(row=>`| ${row.join(' | ')} |`).join('\n')}\n\n`;
    const requestFile=path.join(f.source,'request/request.json'),request=read(requestFile);
    request.operatorId='backend.generate';request.requirements={mode:'apply',scope:'full'};write(requestFile,request);
    write(path.join(f.sourceSession,'state.json'),{id:'original',steps:{'1/1':request.operatorId},requestHashes:{'1/1':digest(readFileSync(requestFile))}});
    const fingerprint=digest('contract');
    write(path.join(f.source,'response/response.md'),'# backend-source-application — fixture\n\n'+
      table('Binding',['Field','Value'],[['Outcome','fixture'],['Feature','fixture'],['Contract fingerprint',fingerprint],['Base','2'.repeat(40)],['Branch','session/original'],['Commit',HEAD]])+
      table('Operations',['Operation','Transport','Writer','Transaction','Idempotency','Decisions'],[['fixture-op','rest','`app/test.ts`','single-transaction','none','fixture']])+
      table('Changes',['Path','Change','Operation','Before','After'],[['`app/test.ts`','modified','fixture-op',digest('before'),digest('after')]])+
      table('Widened',['Path','Nearest boundary','Why'])+table('Findings',['Code','Operation','File','Statement'])+table('Fallbacks taken',['Code','Action']));
    write(path.join(f.source,'response/changes.md'),'# changes — backend.generate step-1/parallel-1\n\n'+
      table('Binding',['Field','Value'],[['Operator',request.operatorId],['Step','step-1/parallel-1'],['Checkout','fixture'],['Predecessor','fixture']])+
      table('Files',['Path','Change','Why','Claims'],[['`app/test.ts`','modified','Synthetic typed fixture','—']])+'## What the next step must know\n\nFixture only; no source operation was performed.\n');
    write(path.join(f.source,'response/data/mutations.json'),{mode:'apply',contractFingerprint:fingerprint,base:'2'.repeat(40),branch:'session/original',commit:HEAD,
      operations:[{operationId:'fixture-op',name:'fixture',transport:'rest',writerRef:'app/test.ts',storeRefs:[],transactionBoundary:'single-transaction',idempotencyKind:'none',migrationRefs:[],authorityDimensionIds:['fixture'],facets:['transport'],proofKinds:['unit']}],
      changes:[{path:'app/test.ts',change:'modified',operationId:'fixture-op',beforeHash:digest('before'),afterHash:digest('after')}]});
    write(path.join(f.source,'response/response.json'),{schemaVersion:9,operatorId:request.operatorId,step:1,parallel:1,status:'done',fields:{'backend-source-application':'response/response.md',changes:'response/changes.md',mutations:'response/data/mutations.json'},fallbacks:[],commits:[HEAD],next:[]});
    await importProducer(f.args);
    const receiver=path.join(f.targetSession,'step-2/parallel-1');
    write(path.join(receiver,'request/request.json'),{schemaVersion:9,operatorId:'quality.verify',step:2,parallel:1,sessionId:'receiver',contexts:[],requirements:{},inputs:{changes:'step-100/parallel-1/response/changes.md'},resume:null});
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
