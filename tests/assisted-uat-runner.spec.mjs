import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import {parseYaml,stringifyYaml} from '../engine/yaml.mjs';
import {
  PROTOCOL_PREFIX,computeRequestBindings,digestFile,digestValue,inspectPreparedRequest,
  signalSession,startSession,validateLockedPlaywright,waitSession,
} from '../scripts/uat/assisted-runner.mjs';

const write=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,typeof value==='string'?value:stringifyYaml(value));};
const schemaValidator=name=>new Ajv2020({allErrors:true,strict:false,formats:{'date-time':true}}).compile(parseYaml(fs.readFileSync(new URL(`../modules/schemas/${name}.schema.yaml`,import.meta.url),'utf8')));
const fixture=t=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'starci-assisted-uat-'));
  t.after(()=>fs.rmSync(temp,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const assisted=path.join(temp,'E','assisted-uat'),requestFile=path.join(assisted,'request.yaml');
  const scriptFile=path.join(assisted,'playwright','flow-login.spec.ts');
  const cleanupFile=path.join(assisted,'cleanup.yaml'),redactionFile=path.join(assisted,'redaction.yaml');
  const driverFile=path.join(temp,'fake-driver.mjs');
  write(scriptFile,'// prepared Playwright flow\n');
  write(cleanupFile,{schema:'starci/assisted-uat-cleanup@1',actions:[],verify:[{id:'absence-readback',command:[process.execPath,'--version']}]});
  write(redactionFile,{schema:'starci/assisted-uat-redaction@1',rules:[{pattern:'secret-[a-z]+',replacement:'[REDACTED]'}],commands:[{id:'redaction-inspection',command:[process.execPath,'--version']}]});
  write(driverFile,`import fs from 'node:fs';import path from 'node:path';import readline from 'node:readline';
const prefix=process.env.STARCI_ASSISTED_UAT_PROTOCOL;const run=process.env.STARCI_ASSISTED_UAT_RUN_DIR;
const rel=file=>path.relative(path.dirname(path.dirname(run)),file).replace(/\\\\/g,'/');
const emit=value=>console.log(prefix+JSON.stringify(value));
console.log('secret-leak-from-driver');
const artifact=path.join(run,'artifacts','screen.png');fs.mkdirSync(path.dirname(artifact),{recursive:true});fs.writeFileSync(artifact,'sanitized-png');
emit({type:'step',flowId:'flow.login',id:'open',status:'completed',observed:'Login rendered',evidenceRefs:[]});
emit({type:'artifact',path:rel(artifact),mediaType:'image/png',redacted:true});
emit({type:'checkpoint',gateId:'gate.otp'});
const input=readline.createInterface({input:process.stdin});for await(const line of input){const signal=JSON.parse(line);if(signal.gateId!=='gate.otp')process.exit(3);if(signal.value!=='ok')process.exit(4);input.close();break;}
emit({type:'check',id:'after-human',command:'machine readback',exitCode:0,evidenceRefs:[rel(artifact)]});
emit({type:'step',flowId:'flow.login',id:'confirm',status:'completed',observed:'Account home rendered',evidenceRefs:[rel(artifact)]});
emit({type:'postcondition',id:'signed-in',expected:'Account home',observed:'Account home',status:'completed',evidenceRefs:[rel(artifact)]});
`);
  const request={schema:'starci/assisted-uat-request@1',requestId:'request.login.1',nodeId:'uat.account.login',preparedAt:'2026-09-21T01:00:00.000Z',bindings:{},
    build:{repository:'frontend',revision:'0123456789012345678901234567890123456789',servedIdentity:'local-build-1'},
    environment:{resourceId:'env.local',revision:'env-r1',origins:['http://127.0.0.1:3000']},
    flows:[{id:'flow.login',entry:'/login',actor:'test-user',steps:[
      {id:'open',action:'Open login',expected:'Login is visible',postconditions:[],evidence:['screenshot']},
      {id:'confirm',action:'Confirm OTP in browser',expected:'Account home is visible',postconditions:['session persists'],evidence:['screenshot']},
    ]}],
    humanGates:[{id:'gate.otp',flowId:'flow.login',afterStepId:'open',class:'secret-entry',reason:'OTP stays in browser',prompt:'Enter the OTP in the visible browser, then reply ok, fail, or cancel.',responseSchema:{type:'string',enum:['ok','fail','cancel']},evidenceRequired:['post-login screenshot']}],
    scripts:[{flowId:'flow.login',path:'playwright/flow-login.spec.ts',sha256:digestFile(scriptFile),command:['playwright','test'],cwd:temp}],
    sessionManifest:{path:'session-manifest.yaml'},redaction:{path:'redaction.yaml',sha256:digestFile(redactionFile)},cleanup:{path:'cleanup.yaml',sha256:digestFile(cleanupFile)},
    receipt:{schema:'starci/assisted-uat-receipt@1',pathTemplate:'receipts/{runId}.yaml',immutable:true},limits:{timeoutMs:30000,retries:0}};
  request.bindings=computeRequestBindings(request);
  write(requestFile,request);
  const requestDigest=digestFile(requestFile),scripts=request.scripts.map(({flowId,path,sha256})=>({flowId,path,sha256}));
  const session={schema:'starci/assisted-uat-session-manifest@1',sessionId:'session.login.1',request:{path:'request.yaml',sha256:requestDigest},
    bindings:{requestDigest,...request.bindings,scriptsDigest:digestValue(scripts),cleanupPlanDigest:request.cleanup.sha256,redactionPolicyDigest:request.redaction.sha256},
    playwright:{version:'1.99.0',browser:'chromium',revision:'1234'},launch:{command:[process.execPath,driverFile,'playwright','test','chromium','--headed','--workers=1'],cwd:temp,envNames:[]},
    scripts,humanGateIds:['gate.otp'],artifacts:{runDirTemplate:'runs/{runId}',requiredMedia:['image/png'],hash:'sha256'},receipt:{schema:'starci/assisted-uat-receipt@1',pathTemplate:'receipts/{runId}.yaml',writeOnce:true}};
  write(path.join(assisted,'session-manifest.yaml'),session);
  return {temp,assisted,requestFile,receiptFile:path.join(assisted,'receipts','run-1.yaml'),scriptFile};
};

test('prepared request selection recomputes every request/session/file binding and fixes run paths',t=>{
  const f=fixture(t),prepared=inspectPreparedRequest({requestPath:f.requestFile,receiptPath:f.receiptFile});
  assert.equal(prepared.runId,'run-1');
  assert.equal(prepared.runDir,path.join(f.assisted,'runs','run-1'));
  assert.equal(prepared.session.bindings.requestDigest,prepared.requestDigest);
  assert.deepEqual(prepared.request.bindings,computeRequestBindings(prepared.request));
  assert.throws(()=>inspectPreparedRequest({requestPath:'request.yaml',receiptPath:f.receiptFile}),/absolute path/);
});

test('browser admission requires a project-local locked Playwright headed single-worker command',t=>{
  const f=fixture(t),prepared=inspectPreparedRequest({requestPath:f.requestFile,receiptPath:f.receiptFile});
  write(path.join(f.temp,'package.json'),JSON.stringify({name:'fixture',private:true}));
  write(path.join(f.temp,'node_modules','@playwright','test','package.json'),JSON.stringify({name:'@playwright/test',version:'1.99.0'}));
  write(path.join(f.temp,'node_modules','playwright-core','package.json'),JSON.stringify({name:'playwright-core',version:'1.99.0'}));
  write(path.join(f.temp,'node_modules','playwright-core','browsers.json'),JSON.stringify({browsers:[{name:'chromium',revision:'1234'}]}));
  prepared.session.launch.command=['npx','--no-install','playwright','test','--headed','--workers=1','--project=chromium'];
  assert.equal(validateLockedPlaywright(prepared).version,'1.99.0');
  prepared.session.launch.command=[process.execPath,path.join(f.temp,'fake-driver.mjs'),'playwright','test','chromium','--headed','--workers=1'];
  assert.throws(()=>validateLockedPlaywright(prepared),/project-local Playwright CLI/);
});

test('prepared request selection fails closed on stale flow and script bytes',t=>{
  const f=fixture(t),request=parseYaml(fs.readFileSync(f.requestFile,'utf8'));
  request.flows[0].steps[0].expected='Changed after preparation';write(f.requestFile,request);
  assert.throws(()=>inspectPreparedRequest({requestPath:f.requestFile,receiptPath:f.receiptFile}),error=>error.code==='assisted-uat-stale'&&/digest mismatch/.test(error.message));
  const f2=fixture(t);fs.appendFileSync(f2.scriptFile,'// drift\n');
  assert.throws(()=>inspectPreparedRequest({requestPath:f2.requestFile,receiptPath:f2.receiptFile}),error=>error.code==='assisted-uat-stale'&&/script flow.login/.test(error.message));
});

test('cleanup and redaction plans are strict typed inputs, not unchecked command bags',t=>{
  const f=fixture(t),cleanup=path.join(f.assisted,'cleanup.yaml');
  write(cleanup,{schema:'starci/assisted-uat-cleanup@1',actions:[],verify:[],unexpected:true});
  const request=parseYaml(fs.readFileSync(f.requestFile,'utf8'));request.cleanup.sha256=digestFile(cleanup);request.bindings=computeRequestBindings(request);write(f.requestFile,request);
  const sessionFile=path.join(f.assisted,'session-manifest.yaml'),session=parseYaml(fs.readFileSync(sessionFile,'utf8'));
  session.request.sha256=digestFile(f.requestFile);session.bindings.requestDigest=session.request.sha256;session.bindings.inputDigest=request.bindings.inputDigest;session.bindings.cleanupPlanDigest=request.cleanup.sha256;write(sessionFile,session);
  assert.throws(()=>inspectPreparedRequest({requestPath:f.requestFile,receiptPath:f.receiptFile}),error=>error.code==='assisted-uat-schema-invalid'&&/cleanup schema/.test(error.message));
});

test('verification has a strict contract and cannot derive pass with a false prerequisite',()=>{
  const validate=schemaValidator('assisted-uat-verification'),digest='a'.repeat(64),ref={path:'request.yaml',sha256:digest};
  const document={schema:'starci/assisted-uat-verification@1',request:ref,sessionManifest:{path:'session-manifest.yaml',sha256:digest},receipt:{path:'receipts/run-1.yaml',sha256:digest},
    bindings:{requestDigest:digest,inputDigest:digest,buildDigest:digest,environmentDigest:digest,flowsDigest:digest,scriptsDigest:digest,cleanupPlanDigest:digest,redactionPolicyDigest:digest},
    checks:[{id:'bindings',command:'recompute digests',exitCode:0,evidenceRefs:['receipts/run-1.yaml']}],
    derived:{currentBindings:true,flowsComplete:true,postconditionsPassed:true,evidenceComplete:true,cleanupComplete:true,redactionComplete:true},disposition:'pass',verifiedAt:'2026-09-21T02:00:00.000Z'};
  assert.equal(validate(document),true,JSON.stringify(validate.errors));
  document.derived.cleanupComplete=false;assert.equal(validate(document),false,'a pass cannot coexist with incomplete cleanup');
  document.derived.cleanupComplete=true;document.extra=true;assert.equal(validate(document),false,'verification rejects undeclared fields');
});

test('chat and direct commands share one event-driven run, relay only the frozen prompt, and write a receipt last',async t=>{
  const f=fixture(t);
  let state=startSession({requestPath:f.requestFile,receiptPath:f.receiptFile,skipRunnerCheck:true});
  for(let guard=0;state.phase!=='waiting'&&guard<4;guard++)state=await waitSession({requestPath:f.requestFile,receiptPath:f.receiptFile,after:state.revision});
  assert.equal(state.phase,'waiting');assert.equal(state.event.type,'checkpoint');
  assert.equal(state.event.gate.instruction,'Enter the OTP in the visible browser, then reply ok, fail, or cancel.');
  assert.equal(JSON.stringify(state).includes('secret-leak-from-driver'),false,'driver output and secrets are never relayed');
  const first=signalSession({requestPath:f.requestFile,receiptPath:f.receiptFile,value:'ok',actor:'user'});
  const replay=signalSession({requestPath:f.requestFile,receiptPath:f.receiptFile,value:'ok',actor:'user'});
  assert.equal(first.idempotent,false);assert.equal(replay.idempotent,true);
  assert.throws(()=>signalSession({requestPath:f.requestFile,receiptPath:f.receiptFile,value:'fail',actor:'user'}),/conflicting replay/);
  for(let guard=0;state.phase!=='finished'&&guard<8;guard++)state=await waitSession({requestPath:f.requestFile,receiptPath:f.receiptFile,after:state.revision});
  assert.equal(state.phase,'finished');assert.ok(fs.existsSync(f.receiptFile));
  const receipt=parseYaml(fs.readFileSync(f.receiptFile,'utf8'));
  assert.equal(receipt.completionSignal.value,'ok');
  assert.equal(receipt.completionSignal.meaning,'execution-finished-not-pass');
  assert.equal('outcome' in receipt,false);assert.equal('pass' in receipt,false);
  assert.ok(receipt.checks.some(check=>check.id==='after-human'&&check.exitCode===0),'machine assertions resumed after the human signal');
  assert.equal(receipt.cleanup.complete,true);assert.equal(receipt.redaction.complete,true);
  assert.equal(receipt.artifacts[0].sha256,digestFile(path.join(f.assisted,receipt.artifacts[0].path)));
  const again=startSession({requestPath:f.requestFile,receiptPath:f.receiptFile,skipRunnerCheck:true});
  assert.equal(again.idempotent,true);assert.equal(again.phase,'finished');
});

test('the skill keeps secrets in the browser and delegates verdict/report ingestion to the enclosing op',()=>{
  const skill=fs.readFileSync(new URL('../skills/run-assisted-uat/SKILL.md',import.meta.url),'utf8');
  assert.match(skill,/never in chat/i);assert.match(skill,/execution-finished-not-pass/);
  assert.match(skill,/api\.mjs report/);assert.match(skill,/without polling|Do not build a sleep\/status loop/);
  assert.match(skill,/ok.*fail.*cancel/s);assert.match(skill,/never opens `\.starciwork\/runtime\.sqlite`/i);
  assert.ok(skill.includes(PROTOCOL_PREFIX.replace(/@/g,'@'))||skill.includes('STARCI_ASSISTED_UAT_PROTOCOL'));
});

test('on Windows npm and npx launch through node and npm-cli, never a .cmd shim Node refuses to spawn',async()=>{
  const {launchFor}=await import('../scripts/uat/assisted-runner.mjs');
  const node=['C:','Program Files','nodejs','node.exe'].join(path.win32.sep);
  const npx=launchFor(['npx','playwright','test','--headed'],{platform:'win32',execPath:node});
  assert.equal(npx.file,node);
  assert.equal(npx.args[0],['C:','Program Files','nodejs','node_modules','npm','bin','npx-cli.js'].join(path.win32.sep));
  assert.deepEqual(npx.args.slice(1),['playwright','test','--headed']);
  assert.equal(launchFor(['npm','run','uat'],{platform:'win32',execPath:node}).args[0].endsWith('npm-cli.js'),true);
  assert.deepEqual(launchFor(['node','cli.js'],{platform:'win32',execPath:node}),{file:node,args:['cli.js']});
  assert.deepEqual(launchFor(['npx','playwright'],{platform:'linux',execPath:'/usr/bin/node'}),{file:'npx',args:['playwright']});
  const real=launchFor(['npx','--version']);
  const r=(await import('node:child_process')).spawnSync(real.file,real.args,{encoding:'utf8',windowsHide:true});
  assert.equal(r.error,undefined,'npx launches on this host without spawn EINVAL');
  assert.equal(r.status,0);
});
