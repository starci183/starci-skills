import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {FAKE_ORCA} from '../helpers/fake-orca.mjs';
import {uuidv8,orcaRequestIdOf,requestStateFrom} from '../../scripts/api/orca/lib.mjs';

// scripts/api/orca/lib.mjs is the whole host boundary: argv comes from
// modules/host/orca/calls.yaml and, before each new mutation, the verb about
// to run is compared against the live `orca agent-context --json` listing.
// Every case here drives that runner through the shared fake Orca, which
// answers agent-context from calls.yaml itself.
const ROOT=path.resolve(import.meta.dirname,'..', '..');

const stubEnv=(t,extra={})=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-orca-call-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const stub=path.join(root,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  return {root,log:path.join(root,'calls.jsonl'),env:{
    ...process.env,
    STARCI_ORCA_COMMAND:process.execPath,
    STARCI_ORCA_ARGS:JSON.stringify([stub]),
    STARCI_FAKE_ORCA_LOG:path.join(root,'calls.jsonl'),
    STARCI_FAKE_ORCA_STATE:path.join(root,'state.json'),
    ...extra,
  }};
};

// One child node process per case keeps binary overrides and private fake state isolated.
// This outer case captures the inner envelope, including the fake overflow's retained stdout.
const CASE_MAX_BUFFER=4*1024*1024;
const caseDiagnostic=r=>`case process failed: ${JSON.stringify({
  status:r.status,signal:r.signal,error:r.error?{code:r.error.code??null,message:r.error.message}:null,
  stdoutBytes:Buffer.byteLength(r.stdout??''),stderrBytes:Buffer.byteLength(r.stderr??''),
  stderrTail:String(r.stderr??'').slice(-4096),maxBuffer:CASE_MAX_BUFFER,
})}`;
const call=(fx,body)=>{
  const script=path.join(fx.root,`case-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(script,`import {orcaCall} from ${JSON.stringify(pathToFileURL(path.join(ROOT,'scripts','api','orca','lib.mjs')).href)};\n`+
    `import {requestShow} from ${JSON.stringify(pathToFileURL(path.join(ROOT,'scripts','api','orca','request-show.mjs')).href)};\n`+
    `console.log(JSON.stringify((${body})(orcaCall,requestShow)));\n`);
  const r=spawnSync(process.execPath,[script],{encoding:'utf8',env:fx.env,timeout:60000,maxBuffer:CASE_MAX_BUFFER,windowsHide:true});
  const diagnostic=caseDiagnostic(r);
  assert.equal(r.error,undefined,diagnostic);
  assert.equal(r.signal,null,diagnostic);
  assert.equal(r.status,0,diagnostic);
  return JSON.parse(r.stdout.trim().split(/\r?\n/).at(-1));
};
const logged=fx=>fs.existsSync(fx.log)
  ?fs.readFileSync(fx.log,'utf8').trim().split(/\r?\n/).filter(Boolean).map(l=>JSON.parse(l).argv)
  :[];

test('argv is assembled from calls.yaml — declared flags only, in contract order',t=>{
  const fx=stubEnv(t);
  const out=call(fx,`c=>c('worker-start',{spec:'do x','task-title':'x #1',worktree:'wt',agent:'codex',model:'gpt-6.1-sol','display-name':'[Op] x',run:'run-1',from:'kernel-1'},{request:{job:'j1',lease:'l1'}})`);
  assert.equal(out.outcome,'ok');
  const start=logged(fx).find(argv=>argv.slice(0,2).join(' ')==='orchestration worker-start');
  assert.ok(start,'worker-start never reached the binary');
  const id=start[start.indexOf('--retry-request')+1];
  assert.match(id,/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.deepEqual(start,['orchestration','worker-start','--spec','do x','--task-title','x #1','--worktree','wt','--agent','codex',
    '--model','gpt-6.1-sol','--display-name','[Op] x','--run','run-1','--from','kernel-1','--retry-request',id,'--json'],
    'argv order and content are calls.yaml flags order plus defaults.jsonFlag');
});

test('a param calls.yaml does not declare is a contract violation, not a flag',t=>{
  const fx=stubEnv(t);
  const out=call(fx,`c=>{try{c('worker-stop',{dispatch:'d1',force:true});return{threw:false}}catch(e){return{threw:true,message:e.message}}}`);
  assert.equal(out.threw,true,'an undeclared param must throw before any process runs');
  assert.match(out.message,/--force is not a flag calls\.yaml declares/);
  assert.deepEqual(logged(fx),[],'nothing may reach the binary once the contract is violated');
});

test('a missing required flag refuses before the process runs',t=>{
  const fx=stubEnv(t);
  const out=call(fx,`c=>{try{c('worker-show',{});return{threw:false}}catch(e){return{threw:true,message:e.message}}}`);
  assert.equal(out.threw,true);
  assert.match(out.message,/missing required --dispatch/);
  assert.deepEqual(logged(fx),[]);
});

test('the receipt is classified by the calls.yaml classify block',t=>{
  const fx=stubEnv(t,{STARCI_FAKE_ORCA_MODE:'auth-partial'});
  const out=call(fx,`c=>c('worker-start',{spec:'s',worktree:'wt',agent:'codex',run:'r'},{request:{job:'j'}})`);
  assert.equal(out.outcome,'failed');
  assert.equal(out.effectState,'partial','a residual dispatch is partial, so fallback must settle it first');
  const release=call(stubEnv(t,{STARCI_FAKE_ORCA_MODE:'prompt-stalled'}),`c=>c('worker-release',{dispatch:'d1'})`);
  assert.equal(release.outcome,'failed');
  assert.equal(release.effectState,'partial','state retained is a live residual resource');
});

test('the live agent-context listing is refreshed before each new mutation, while reads remain untouched',t=>{
  const fx=stubEnv(t);
  const out=call(fx,`c=>[c('terminal-show',{terminal:'t1'}).outcome,c('terminal-read',{terminal:'t1'}).outcome,`+
    `c('terminal-rename',{terminal:'t1',title:'[Op] x'}).outcome,c('terminal-close',{terminal:'t1'}).outcome]`);
  assert.deepEqual(out,['ok','ok','ok','ok']);
  const verbs=logged(fx).map(argv=>argv[0]);
  assert.equal(verbs.filter(v=>v==='agent-context').length,2,'each new mutation refreshes the current host listing');
  assert.equal(verbs.indexOf('agent-context'),2,'reads run untouched; the listing is fetched at the first mutation');
});

test('a read-only process never spends a call on agent-context',t=>{
  const fx=stubEnv(t);
  call(fx,`c=>c('terminal-show',{terminal:'t1'}).outcome`);
  assert.equal(logged(fx).some(argv=>argv[0]==='agent-context'),false);
});

test('a host contract change during one caller process refuses the next mutation before issue',t=>{
  const fx=stubEnv(t);
  const out=call(fx,`c=>{const first=c('terminal-rename',{terminal:'t1',title:'first'});
    process.env.STARCI_FAKE_ORCA_OMIT_COMMAND='terminal rename';
    const second=c('terminal-rename',{terminal:'t1',title:'second'});return{first,second}}`);
  assert.equal(out.first.outcome,'ok');
  assert.deepEqual([out.second.outcome,out.second.effectState,out.second.reason],['failed','none','host-contract-drift']);
  assert.equal(logged(fx).filter(argv=>argv[0]==='agent-context').length,2);
  assert.equal(logged(fx).filter(argv=>argv.slice(0,2).join(' ')==='terminal rename').length,1);
});

test('a failed live refresh cannot reuse an earlier successful listing, and a later refresh may recover',t=>{
  const fx=stubEnv(t);
  const out=call(fx,`c=>{const first=c('terminal-rename',{terminal:'t1',title:'first'});
    process.env.STARCI_FAKE_ORCA_HOST='runtime_unavailable';
    const second=c('terminal-rename',{terminal:'t1',title:'second'});
    delete process.env.STARCI_FAKE_ORCA_HOST;
    const third=c('terminal-rename',{terminal:'t1',title:'third'});return{first,second,third}}`);
  assert.equal(out.first.outcome,'ok');assert.equal(out.third.outcome,'ok');
  assert.deepEqual([out.second.outcome,out.second.effectState,out.second.reason,out.second.hostUnavailable],
    ['failed','none','host-contract-drift',true]);
  assert.equal(logged(fx).filter(argv=>argv[0]==='agent-context').length,3);
  assert.equal(logged(fx).filter(argv=>argv.slice(0,2).join(' ')==='terminal rename').length,2);
});

for(const failure of ['nonzero','signal','overflow','explicit-refusal'])test(`complete commands from a ${failure} fresh listing cannot authorize a new mutation`,t=>{
  const fx=stubEnv(t,{STARCI_FAKE_ORCA_LISTING_FAILURE:failure});
  const out=call(fx,`c=>c('terminal-rename',{terminal:'t1',title:'must remain unissued'})`);
  assert.deepEqual([out.outcome,out.effectState,out.reason],['failed','none','host-contract-drift']);
  assert.equal(out.missing.listing,'unreadable');
  assert.equal(logged(fx).filter(argv=>argv[0]==='agent-context').length,1);
  assert.equal(logged(fx).some(argv=>argv.slice(0,2).join(' ')==='terminal rename'),false);
});

test('request-show wrapper issues one declared read and rejects unreadable states',t=>{
  for(const state of ['completed','pending','absent','garbled']) {
    const fx=stubEnv(t,{STARCI_FAKE_ORCA_REQUEST_STATE:state});
    const out=call(fx,`(c,show)=>show({request:'request-fixture'})`);
    assert.deepEqual(out,state==='garbled'?{ok:false,state:null}:{ok:true,state});
    assert.equal(logged(fx).length,1,'the wrapper issues exactly one read');
    assert.deepEqual(logged(fx)[0],['orchestration','request-show','--request','request-fixture','--json']);
  }
  assert.equal(requestStateFrom({outcome:'failed',result:{state:'completed'}}),null,
    'a failed read cannot reconcile a lost mutation receipt');
});

test('a flag the live binary does not offer refuses the mutation and allows the read',t=>{
  const fx=stubEnv(t,{STARCI_FAKE_ORCA_OMIT_FLAG:'terminal send:enter'});
  const out=call(fx,`c=>({read:c('terminal-read',{terminal:'t1'}),send:c('terminal-send',{terminal:'t1',text:'hi',enter:true})})`);
  assert.equal(out.read.outcome,'ok','a read is never blocked by the mutation guard');
  assert.equal(out.send.outcome,'failed');
  assert.equal(out.send.effectState,'none','a refused call left no effect to reconcile');
  assert.equal(out.send.reason,'host-contract-drift');
  assert.deepEqual(out.send.missing,{command:'terminal send',flags:['enter']});
  assert.match(out.send.error,/terminal-send/);
  assert.match(out.send.error,/--enter/);
  assert.equal(logged(fx).some(argv=>argv.slice(0,2).join(' ')==='terminal send'),false,
    'the refusal happens before effects — terminal send must never have run');
});

test('a command the live binary does not offer refuses the mutation by name',t=>{
  const fx=stubEnv(t,{STARCI_FAKE_ORCA_OMIT_COMMAND:'orchestration worker-stop'});
  const out=call(fx,`c=>c('worker-stop',{dispatch:'d1'})`);
  assert.equal(out.outcome,'failed');
  assert.equal(out.reason,'host-contract-drift');
  assert.deepEqual(out.missing,{command:'orchestration worker-stop'});
  assert.equal(logged(fx).some(argv=>argv.slice(0,2).join(' ')==='orchestration worker-stop'),false);
});

test('STARCI_ORCA_SKIP_LIVE_CHECK=1 is the documented stub escape and nothing else',t=>{
  const fx=stubEnv(t,{STARCI_FAKE_ORCA_OMIT_COMMAND:'terminal rename',STARCI_ORCA_SKIP_LIVE_CHECK:'1'});
  const out=call(fx,`c=>c('terminal-rename',{terminal:'t1',title:'[Op] x'})`);
  assert.equal(out.outcome,'ok','the override skips the comparison, it does not change the call');
  assert.equal(logged(fx).some(argv=>argv[0]==='agent-context'),false,'no listing is fetched when the check is skipped');
});

/* ------------------------------------------------------------ replay (calls.yaml idempotency) */

const argvOf=(fx,verb)=>logged(fx).filter(argv=>argv.slice(0,2).join(' ')===verb);
const flagOf=(argv,name)=>argv.includes(name)?argv[argv.indexOf(name)+1]:null;
const stateOf=fx=>JSON.parse(fs.readFileSync(fx.env.STARCI_FAKE_ORCA_STATE,'utf8'));

test('a replay: request mutation needs its ledger identity, and only it takes one',t=>{
  const fx=stubEnv(t);
  const out=call(fx,`c=>{const t=f=>{try{f();return null}catch(e){return e.message}};return [
    t(()=>c('run-create',{objective:'o'})),
    t(()=>c('run-create',{objective:'o'},{request:{}})),
    t(()=>c('worker-stop',{dispatch:'d1'},{request:{job:'j'}})),
    t(()=>c('run-create',{objective:'o','retry-request':'mine'},{request:{job:'j'}}))]}`);
  assert.match(out[0],/run-create: a request-replay mutation needs its ledger identity/);
  assert.match(out[1],/needs its ledger identity/,'an identity with no filled part is no identity');
  assert.match(out[2],/only for replay: request mutations \(calls\.yaml declares reissue\)/);
  assert.match(out[3],/--retry-request is derived from the request identity, never passed/);
  assert.equal(logged(fx).some(argv=>argv[0]==='orchestration'),false,'every refusal happens before any process runs');
});

test('the first issue already carries --retry-request, derived from the ledger identity alone',t=>{
  const fx=stubEnv(t);
  const out=call(fx,`c=>[c('run-create',{objective:'o',from:'k'},{request:{workflow:'wf-1',kernel:'k',replaces:null}}),
    c('run-create',{objective:'o',from:'k'},{request:{replaces:null,kernel:'k',workflow:'wf-1'}}),
    c('run-create',{objective:'o',from:'k'},{request:{workflow:'wf-2',kernel:'k',replaces:null}})]`);
  const ids=argvOf(fx,'orchestration run-create').map(argv=>flagOf(argv,'--retry-request'));
  assert.match(ids[0],/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(ids[1],ids[0],'the id ignores key order: the same identity is the same request after a restart');
  assert.notEqual(ids[2],ids[0],'another workflow is another request');
  assert.deepEqual(out.map(o=>[o.outcome,o.result.run.id,o.request.replayed]),[['ok','run-fake-1',false],['ok','run-fake-1',true],['ok','run-fake-2',false]],
    'Orca answers the recorded Run to a repeated id instead of creating a second one');
  assert.equal(Object.keys(stateOf(fx).runs).length,2,'two identities, two Runs');
});

test('a lost receipt of a replay: request mutation is settled by request-show and one replay under the same id',t=>{
  const fx=stubEnv(t,{STARCI_FAKE_ORCA_LOSE_RECEIPT:'orchestration run-create'});
  const out=call(fx,`c=>c('run-create',{objective:'o',from:'k'},{request:{workflow:'wf-1'}})`);
  assert.deepEqual([out.outcome,out.effectState,out.result?.run?.id],['ok','committed','run-fake-1']);
  assert.deepEqual([out.request.state,out.request.replayed],['completed',true]);
  const issued=argvOf(fx,'orchestration run-create');
  assert.equal(issued.length,2,'the original and exactly one replay');
  assert.equal(flagOf(issued[1],'--retry-request'),flagOf(issued[0],'--retry-request'),'the replay carries the same id');
  assert.equal(argvOf(fx,'orchestration request-show').length,1);
  assert.equal(Object.keys(stateOf(fx).runs).length,1,'the replay never made a second Run');
});

test('an absent request after a lost receipt is outcome unknown, never a blind second issue',t=>{
  const fx=stubEnv(t,{STARCI_FAKE_ORCA_LOSE_RECEIPT:'orchestration run-use',STARCI_FAKE_ORCA_REQUEST_STATE:'absent'});
  const out=call(fx,`c=>c('run-use',{id:'run-1',from:'k'},{request:{run:'run-1',from:'k'}})`);
  assert.deepEqual([out.outcome,out.effectState,out.reason],['unknown','unknown','request-absent']);
  assert.equal(argvOf(fx,'orchestration run-use').length,1,'a repeated run-use would fence live Dispatches: it is never re-issued blind');
  const unreadable=stubEnv(t,{STARCI_FAKE_ORCA_LOSE_RECEIPT:'orchestration run-use',STARCI_FAKE_ORCA_REQUEST_STATE:'garbled'});
  const u=call(unreadable,`c=>c('run-use',{id:'run-1',from:'k'},{request:{run:'run-1',from:'k'}})`);
  assert.deepEqual([u.outcome,u.reason],['unknown','request-show-unreadable']);
});

for(const shape of ['overflow','signal','empty','primitive'])test(`a ${shape} receipt loss reconciles the original request exactly once`,t=>{
  const fx=stubEnv(t,{STARCI_FAKE_ORCA_LOSE_RECEIPT:'orchestration run-create',STARCI_FAKE_ORCA_LOST_RECEIPT_KIND:shape});
  const out=call(fx,`c=>c('run-create',{objective:'private fixture'},{request:{workflow:'lost-${shape}'}})`);
  assert.deepEqual([out.outcome,out.effectState,out.request.state],['ok','committed','completed']);
  const issued=argvOf(fx,'orchestration run-create');assert.equal(issued.length,2);
  assert.equal(flagOf(issued[0],'--retry-request'),flagOf(issued[1],'--retry-request'));
  assert.equal(argvOf(fx,'orchestration request-show').length,1);
  assert.equal(Object.keys(stateOf(fx).runs).length,1);
});

test('clipped or signal receipts on a non-replay mutation remain unknown and are never issued twice',t=>{
  for(const shape of ['overflow','signal','empty']) {
    const fx=stubEnv(t,{STARCI_FAKE_ORCA_LOSE_RECEIPT:'orchestration reply',STARCI_FAKE_ORCA_LOST_RECEIPT_KIND:shape});
    const out=call(fx,`c=>c('reply',{id:'private-message',body:'private fixture'})`);
    assert.deepEqual([out.outcome,out.effectState,out.reason],['unknown','unknown','receipt-lost']);
    assert.equal(argvOf(fx,'orchestration reply').length,1);
  }
});

test('a second lost replay receipt or a retry refusal cannot downgrade the original unknown effect to none',t=>{
  const twice=stubEnv(t,{STARCI_FAKE_ORCA_LOSE_RECEIPT:'orchestration run-create',STARCI_FAKE_ORCA_LOSE_RECEIPT_ALWAYS:'1',STARCI_FAKE_ORCA_LOST_RECEIPT_KIND:'overflow'});
  const unknown=call(twice,`c=>c('run-create',{objective:'private fixture'},{request:{workflow:'twice-lost'}})`);
  assert.deepEqual([unknown.outcome,unknown.effectState,unknown.reason],['unknown','unknown','retry-receipt-lost']);
  assert.equal(argvOf(twice,'orchestration run-create').length,2);assert.equal(Object.keys(stateOf(twice).runs).length,1);
  const refused=stubEnv(t,{STARCI_FAKE_ORCA_LOSE_RECEIPT:'orchestration run-create',STARCI_FAKE_ORCA_REPLAY_REFUSAL:'1'});
  const retry=call(refused,`c=>c('run-create',{objective:'private fixture'},{request:{workflow:'refused-replay'}})`);
  assert.deepEqual([retry.outcome,retry.effectState,retry.reason],['unknown','unknown','retry-unsettled']);
  assert.equal(Object.keys(stateOf(refused).runs).length,1);
});

test('a lost receipt of a replay: reissue mutation is re-issued once with no request id; replay: none is never re-issued',t=>{
  const fx=stubEnv(t,{STARCI_FAKE_ORCA_LOSE_RECEIPT:'orchestration worker-stop'});
  const out=call(fx,`c=>c('worker-stop',{dispatch:'d1'})`);
  assert.deepEqual([out.outcome,out.request.state],['ok','reissued']);
  const stops=argvOf(fx,'orchestration worker-stop');
  assert.equal(stops.length,2);
  assert.equal(stops.some(argv=>argv.includes('--retry-request')),false,'a deliberate later stop stays a fresh effect, never a recorded replay');
  const none=stubEnv(t,{STARCI_FAKE_ORCA_LOSE_RECEIPT:'orchestration reply'});
  const r=call(none,`c=>c('reply',{id:'m1',body:'yes'})`);
  assert.deepEqual([r.outcome,r.effectState,r.reason],['unknown','unknown','receipt-lost']);
  assert.equal(argvOf(none,'orchestration reply').length,1,'a duplicate reply is a second message: replay none');
});

test('every calls.yaml mutation declares a replay mode the runner enforces',async()=>{
  const {validateCallContract}=await import(pathToFileURL(path.join(ROOT,'scripts','checks','check-providers.mjs')).href);
  const {readModuleJson}=await import(pathToFileURL(path.join(ROOT,'engine','runtime-root.mjs')).href);
  const calls=readModuleJson('modules','host','orca','calls.yaml');
  assert.deepEqual(validateCallContract({calls,api:null}),[]);
  for(const [name,call] of Object.entries(calls.calls))
    if(call.kind==='mutation')assert.ok(['none','reissue','request'].includes(call.replay),`${name} declares replay`);
  const broken=structuredClone(calls);
  delete broken.calls['worker-stop'].replay;
  broken.calls['worker-show'].replay='reissue';
  broken.calls['run-use'].flags=broken.calls['run-use'].flags.filter(f=>f!=='retry-request');
  const errors=validateCallContract({calls:broken,api:null}).join('\n');
  assert.match(errors,/calls\.worker-stop is a mutation and must declare replay/);
  assert.match(errors,/calls\.worker-show is a read and must not declare replay/);
  assert.match(errors,/calls\.run-use is replay: request and must declare --retry-request/);
});

// Orca 1.4.209 refuses every --retry-request that is not a UUID (invalid_argument); the fake refuses it the same way.
test('uuidv8 is the RFC 9562 custom UUID over SHA-256 of the namespace bytes then the name (version 8, variant 10)',()=>{
  const ns='6ba7b810-9dad-11d1-80b4-00c04fd430c8',d=crypto.createHash('sha256').update(Buffer.from(ns.replace(/-/g,''),'hex')).update('www.example.com').digest().subarray(0,16);
  d[6]=(d[6]&0x0f)|0x80;d[8]=(d[8]&0x3f)|0x80;const h=d.toString('hex');
  assert.equal(uuidv8(ns,'www.example.com'),`${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`);
});

test('the request id is a deterministic UUIDv8: same inputs the same id, another verb, identity or attempt another id',()=>{
  const ids=[orcaRequestIdOf('run-create',{a:1,b:2}),orcaRequestIdOf('run-create',{b:2,a:1}),orcaRequestIdOf('run-use',{a:1,b:2}),
    orcaRequestIdOf('run-create',{a:1,b:3}),orcaRequestIdOf('run-create',{a:1,b:2,attempt:2})];
  for(const id of ids) assert.match(id,/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(ids[1],ids[0]);
  assert.equal(new Set(ids.filter((_,i)=>i!==1)).size,4);
});

test('a non-UUID --retry-request is refused by the shape check, and the receipt error is the reported reason, not a crashpad stderr line',t=>{
  const fx=stubEnv(t);
  const run=spawnSync(process.execPath,[path.join(fx.root,'fake-orca.mjs'),'orchestration','run-create','--objective','o','--retry-request','starci-run-create-0123456789abcdef01234567','--json'],{encoding:'utf8',env:fx.env,windowsHide:true});
  assert.equal(run.status,1);
  assert.equal(JSON.parse(run.stdout).error.code,'invalid_argument');
  assert.match(JSON.parse(run.stdout).error.message,/must be the UUID Orca reported/);
  const out=call(fx,`c=>c('run-create',{objective:'o',from:'k'},{request:{workflow:'wf-9'}})`);
  assert.equal(out.outcome,'ok','the runner derives a UUID the fake accepts');
});

test('a failed call reports the receipt error, not a crashpad line on stderr',t=>{
  const fx=stubEnv(t,{STARCI_FAKE_ORCA_CHECK_FAILS:'1',STARCI_FAKE_ORCA_STDERR:'registration_protocol_win.cc:108 CreateFile: 0x2'});
  const out=call(fx,`c=>c('check',{run:'run-1'})`);
  assert.notEqual(out.outcome,'ok');
  assert.match(out.error??'',/check refused/);
  assert.doesNotMatch(out.error??'',/registration_protocol/);
});
