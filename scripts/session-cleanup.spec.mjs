import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, renameSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { retainSessionBundle, verifyRetention, closeSuccessfulSession } from './session-cleanup.mjs';
import { openSession, confirmSession, cleanupFixtureOwners } from './v23-test-fixture.mjs';
import { openAttempt } from './attempt-gate.mjs';
import { buildEvidenceManifest } from './evidence-manifest.mjs';

async function fixture(run) {
  const base = mkdtempSync(path.join(tmpdir(), 'starci-retention-'));
  const session = path.join(base, '.worktrees', 'sessions', 'sample');
  const put = (ref, body) => { const file = path.join(session, ref); mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, typeof body === 'string' ? body : JSON.stringify(body)); };
  const state = { contractVersion: 'starci/v2.2', id: 'sample', project: 'sample', status: 'done', hostBinding: { kind: 'codex-task', hostId: 'task', worktree: path.join(base, 'checkout') }, lifecycle: { phase: 'active' }, mission: { version: 1, goal: 'retain proof', target: 'sample', includes: ['proof'], outputs: ['bundle'], verification: 'test', doneWhen: [{ evidence: 'a document is retained', producedBy: 'content.generate' }] }, brief: { proven: ['doneWhen:0 validated document'] }, planned: {}, attempts: {}, workerSlots: [], leases: {} };
  const branch = (key, inputs = {}) => {
    const [n,m,exchange] = key.split('/');
    const ref = `step-${n}/parallel-${m}${exchange ? `/${exchange}` : ''}`;
    const manifest = '{"files":["all-canonical-inputs"]}';
    const sha256 = `sha256:${createHash('sha256').update(manifest).digest('hex')}`;
    put(`${ref}/request/request.json`, { inputs, frozenInputs: [{ ref: 'request/knowledge-manifest.json', sha256 }], goal: { doneWhen: 0 } });
    put(`${ref}/request/knowledge-manifest.json`, manifest);
    put(`${ref}/response/response.json`, { status: 'done', fields: { article: 'response/response.md' }, actual: { observations: [{ evidence: ['response/artifacts/observed.png'] }] } });
    put(`${ref}/response/response.md`, '# observed article');
    put(`${ref}/response/artifacts/observed.png`, 'synthetic screenshot bytes');
    put(`${ref}/response/artifacts/linked/style.css`, '.evidence{}');
    state.attempts[key] = { id: `attempt-${key}`, status: 'matched', requestRef: `${ref}/request/request.json`, responseRef: `${ref}/response/response.json` };
    return ref;
  };
  mkdirSync(session, { recursive: true });
  try { await run({ base, session, state, put, branch }); } finally { cleanupFixtureOwners(base); rmSync(base, { recursive: true, force: true }); }
}

test('retention preserves frozen inputs, actual evidence, linked assets, previous attempts and nested exchanges', async () => fixture(async ({session,state,put,branch}) => {
  const old = branch('1/1');
  state.attempts['1/1'].status = 'mismatched';
  const current = branch('2/1', { article: `${old}/response/response.md` });
  const nested = branch('2/1/audit');
  state.planned['2/1'] = { inputs: { article: `${old}/response/response.md` } };
  put('runtime/ephemeral.log', 'not retained');
  const result = await retainSessionBundle(session,state,'finished');
  for (const ref of [`${old}/request/knowledge-manifest.json`,`${current}/response/artifacts/observed.png`,`${current}/response/artifacts/linked/style.css`,`${nested}/request/request.json`]) assert.ok(existsSync(path.join(result.bundle,ref)),ref);
  assert.ok(!existsSync(path.join(result.bundle,'runtime')));
  assert.equal((await verifyRetention(result.doneDir,result.manifest,state)).lifecycle.phase,'closed-success');
  assert.ok(existsSync(session),'retention alone never deletes');
}));

test('retention copies imported slots as a closed bundle while local producer inputs need no import.json', async () => fixture(async ({session,state,put,branch}) => {
  put('step-0/parallel-1/import.json',{ sourceSession: 'archived-producer' });
  put('step-0/parallel-1/response/data/source.json',{ produced: true });
  put('step-0/parallel-1/response/artifacts/sidecar.txt','dependency');
  branch('1/1',{ imported: 'step-0/parallel-1/response/data/source.json' });
  const result = await retainSessionBundle(session,state,'finished');
  assert.ok(existsSync(path.join(result.bundle,'step-0/parallel-1/import.json')));
  assert.ok(existsSync(path.join(result.bundle,'step-0/parallel-1/response/artifacts/sidecar.txt')));
}));

test('a close interrupted before writing the sibling compact is recoverable; changed proof cannot reuse an archive', async () => fixture(async ({session,state,branch}) => {
  branch('1/1');
  const first = await retainSessionBundle(session,state,'finished');
  const text = readFileSync(first.compact,'utf8');
  rmSync(first.compact);
  const second = await retainSessionBundle(session,state,'finished');
  assert.equal(readFileSync(second.compact,'utf8'),text);
  state.mission.goal = 'different goal';
  await assert.rejects(() => retainSessionBundle(session,state,'finished'),/RETENTION_CONFLICT/);
  assert.ok(existsSync(session));
}));

test('missing and tampered evidence refuses retention verification and leaves active data intact', async () => fixture(async ({session,state,branch}) => {
  const ref = branch('1/1');
  const result = await retainSessionBundle(session,state,'finished');
  writeFileSync(path.join(result.bundle,ref,'response/response.md'),'changed');
  await assert.rejects(() => verifyRetention(result.doneDir,result.manifest,state),/RETENTION_CHANGED/);
  assert.ok(existsSync(session));
}));

test('archive verification refuses injected unlisted bytes and a junction replacing the archive root',async()=>fixture(async({session,state,branch})=>{
  branch('1/1');
  const result=await retainSessionBundle(session,state,'finished');
  const extra=path.join(result.bundle,'step-1/parallel-1/response/injected.md');writeFileSync(extra,'unsealed');
  await assert.rejects(()=>verifyRetention(result.doneDir,result.manifest,state),/inventory/);
  rmSync(extra);
  const moved=`${result.doneDir}-moved`;renameSync(result.doneDir,moved);symlinkSync(moved,result.doneDir,process.platform==='win32'?'junction':'dir');
  await assert.rejects(()=>verifyRetention(result.doneDir,result.manifest,state),/RETENTION_PATH/);
}));

test('retention rejects traversal and missing dependencies before any active data can be deleted', async () => fixture(async ({session,state,branch}) => {
  branch('1/1',{ absent:'step-0/parallel-1/response/missing.md' });
  await assert.rejects(() => retainSessionBundle(session,state,'finished'),/RETENTION_MISSING/);
  state.id = '../escape';
  await assert.rejects(() => retainSessionBundle(session,state,'finished'),/RETENTION_PATH/);
  assert.ok(existsSync(session));
}));

test('cleanup refuses active workers, unfinished goals, and the shared runtime owner', async () => fixture(async ({session,state,put,base}) => {
  state.workerSlots = [{ slot:1 }]; put('state.json',state);
  await assert.rejects(() => closeSuccessfulSession(session,'finished'),/active worker/);
  state.workerSlots=[]; state.status='stopped'; put('state.json',state);
  await assert.rejects(() => closeSuccessfulSession(session,'finished'),/remain resumable/);
  const central = path.join(base,'.worktrees','sessions','central-runtime'); mkdirSync(central);
  await assert.rejects(() => closeSuccessfulSession(central,'finished'),/never targets/);
  assert.ok(existsSync(session)); assert.ok(existsSync(central));
}));

test('closing an accepted goal retains its proof and deletes only its exact session directory', async () => fixture(async ({base}) => {
  const sessions=path.join(base,'.worktrees','sessions');
  const worktree=path.join(base,'checkout'); mkdirSync(worktree);
  const opened=await openSession(sessions,{project:'proof',hostBinding:{kind:'codex-task',hostId:'accepted-goal',worktree,sourcePromptRef:'user:1'},mission:{language:'en',goal:'prove readiness',target:'fixture',includes:['readiness'],outputs:['readiness receipt'],doneWhen:[{evidence:'readiness is observed',producedBy:'environment.preflight'}],verification:'synthetic accepted-receipt fixture',sourceRef:'user:1'}});
  await confirmSession(opened.session,{selected:'as-stated',selectedBy:'user',sourceRef:'user:1'});
  const unbackedFile=path.join(opened.session,'state.json');
  const unbacked=JSON.parse(readFileSync(unbackedFile,'utf8'));unbacked.status='done';unbacked.brief.proven=['doneWhen:0 narrated success'];writeFileSync(unbackedFile,JSON.stringify(unbacked));
  await assert.rejects(()=>closeSuccessfulSession(opened.session,'finished'),/matched|evidence|goal/i);
  unbacked.status='running';unbacked.brief.proven=[];writeFileSync(unbackedFile,JSON.stringify(unbacked));
  const branch=path.join(opened.session,'step-1','parallel-1');mkdirSync(path.join(branch,'request'),{recursive:true});
  const request={contractVersion:'starci/v2.2',schemaVersion:9,operatorId:'environment.preflight',step:1,parallel:1,sessionId:opened.sessionId,contexts:[],requirements:{project:'proof'},inputs:{},resume:null,goal:{doneWhen:0},attempt:{id:'ready-1',number:1,kind:'initial',previous:null},expected:{version:1,goalVersion:1,sourceRef:'state.json#mission:v1/doneWhen:0',criteria:[{id:'ready',required:true,expected:'ready',verification:'receipt'}]},environment:{isolationId:'ready-1',mode:'inline',workspace:null,reads:[],writes:[],exclusive:[],outputRoot:'response'},frozenInputs:[]};
  writeFileSync(path.join(branch,'request','request.json'),JSON.stringify(request));
  const stateFile=path.join(opened.session,'state.json');
  let state=JSON.parse(readFileSync(stateFile,'utf8'));state.chain=[['1/1']];state.steps={'1/1':'environment.preflight'};state.current='1/1';writeFileSync(stateFile,JSON.stringify(state));
  await openAttempt(branch);
  writeFileSync(path.join(branch,'response','response.md'),'# Synthetic accepted readiness evidence\n');
  const evidence=['response/response.md'];
  const response={outcome:{summary:'Synthetic accepted readiness result',primary:{kind:'document',label:'Readiness',ref:'response/response.md'}},contractVersion:'starci/v2.2',schemaVersion:9,operatorId:request.operatorId,step:1,parallel:1,status:'done',boundProfile:'sol-reviewer',ranProfile:'sol-reviewer',fields:{'environment-readiness':'response/response.md'},fallbacks:[],commits:[],next:[],attempt:{id:'ready-1',number:1,expectedVersion:1},goalCheck:{achieved:true,evidence},actual:{expectedVersion:1,observedAt:new Date().toISOString(),observations:[{criterionId:'ready',observed:'ready observed',evidence}]},comparison:{expectedVersion:1,verdict:'matched',criteria:[{criterionId:'ready',verdict:'matched',note:'observed',evidence}],next:'advance'}};
  writeFileSync(path.join(branch,'response','response.json'),JSON.stringify(response));
  state=JSON.parse(readFileSync(stateFile,'utf8'));state.attempts['1/1']={...state.attempts['1/1'],status:'matched',responseRef:'step-1/parallel-1/response/response.json',endedAt:new Date().toISOString(),comparison:response.comparison,evidenceManifest:await buildEvidenceManifest(branch)};state.status='done';state.brief.proven=['doneWhen:0 readiness proof retained'];writeFileSync(stateFile,JSON.stringify(state));
  const central=path.join(sessions,'central-runtime');mkdirSync(central);
  const result=await closeSuccessfulSession(opened.session,'The goal is accepted and this host session is closing.');
  assert.ok(!existsSync(opened.session));assert.ok(existsSync(central));assert.ok(existsSync(worktree));
  assert.equal(readFileSync(path.join(result.bundle,'step-1/parallel-1/response/response.md'),'utf8'),'# Synthetic accepted readiness evidence\n');
  assert.ok(existsSync(result.compact));
}));

test('close-success retains an accepted waiting parent resolved by a sealed failed review and terminal replan', async () => fixture(async ({base}) => {
  const sessions=path.join(base,'.worktrees','sessions');
  const worktree=path.join(base,'checkout');mkdirSync(worktree);
  const opened=await openSession(sessions,{project:'proof',hostBinding:{kind:'codex-task',hostId:'resolved-wait',worktree,sourcePromptRef:'user:resolved'},mission:{language:'en',goal:'accept the repaired architecture',target:'fixture',includes:['architecture'],outputs:['architecture decision'],doneWhen:[{evidence:'the repaired architecture is accepted',producedBy:'architecture.decide'}],verification:'sealed waiting review and replan fixture',sourceRef:'user:resolved'}});
  await confirmSession(opened.session,{selected:'as-stated',selectedBy:'user',sourceRef:'user:resolved'});
  const put=(ref,value)=>{const file=path.join(opened.session,ref);mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,typeof value==='string'?value:JSON.stringify(value));};
  const digest=(bytes)=>`sha256:${createHash('sha256').update(bytes).digest('hex')}`;
  const expectedHash=(value)=>digest(Buffer.from(JSON.stringify(value)));
  const requestHash=(ref)=>digest(readFileSync(path.join(opened.session,ref)));
  const expected=(version,sourceRef,id)=>({version,goalVersion:1,sourceRef,criteria:[{id,required:true,expected:id,verification:'sealed fixture evidence'}]});
  const request=(operatorId,step,attempt,goal,exp,extra={})=>({contractVersion:'starci/v2.2',schemaVersion:9,operatorId,step,parallel:1,sessionId:opened.sessionId,contexts:[],requirements:extra.requirements??{},inputs:{},resume:extra.resume??null,goal,attempt,expected:exp,environment:{isolationId:attempt.id,mode:operatorId==='workspace.bind'?'inline':'isolated',workspace:null,reads:[],writes:[],exclusive:[],outputRoot:'response'},frozenInputs:[]});
  const bindExpected=expected(1,'state.json#mission:v1/prerequisite:2/1','bound');
  const parentExpected=expected(1,'state.json#mission:v1/prerequisite:3/1','accepted');
  const childExpected=expected(1,'step-2/parallel-1/response/data/stack-model.json','review');
  const successorExpected=expected(2,'state.json#mission:v1/doneWhen:0','accepted');
  const bindRequest=request('workspace.bind',1,{id:'bind-a1',number:1,kind:'initial',previous:null},{prerequisite:'2/1'},bindExpected,{requirements:{project:'proof',role:'be'}});
  const parentRequest=request('architecture.decide',2,{id:'parent-a1',number:1,kind:'initial',previous:null},{prerequisite:'3/1'},parentExpected);
  const childRequest={...request('architecture.decide',2,{id:'child-a1',number:1,kind:'initial',previous:null},null,childExpected),exchange:'critique',inputs:{'stack-model':'step-2/parallel-1/response/data/stack-model.json'}};
  const successorRequest=request('architecture.decide',3,{id:'successor-a2',number:2,kind:'repair',previous:'parent-a1'},{doneWhen:0},successorExpected,{resume:{step:2,parallel:1,token:'repair-review'}});
  put('step-1/parallel-1/request/request.json',bindRequest);
  put('step-1/parallel-1/response/response.json',{status:'done'});
  put('step-2/parallel-1/request/request.json',parentRequest);
  put('step-2/parallel-1/response/response.json',{contractVersion:'starci/v2.2',operatorId:'architecture.decide',step:2,parallel:1,status:'waiting',fields:{'stack-model':'response/data/stack-model.json'},awaiting:{exchange:'critique',kind:'independent-critique'},attempt:{id:'parent-a1',number:1,expectedVersion:1}});
  put('step-2/parallel-1/response/data/stack-model.json','{"selected":"candidate"}\n');
  put('step-2/parallel-1/critique/request/request.json',childRequest);
  put('step-2/parallel-1/critique/response/critique.md','# faithful review returned one failure\n');
  const childComparison={expectedVersion:1,verdict:'mismatched',criteria:[],next:'repair'};
  put('step-2/parallel-1/critique/response/response.json',{contractVersion:'starci/v2.2',operatorId:'architecture.decide',step:2,parallel:1,exchange:'critique',status:'mismatch',fields:{'independent-critique':'response/critique.md'},attempt:{id:'child-a1',number:1,expectedVersion:1},comparison:childComparison});
  put('step-3/parallel-1/request/request.json',successorRequest);
  put('step-3/parallel-1/response/response.md','# accepted repaired architecture\n');
  const successorEvidence=['response/response.md'];
  const successorComparison={expectedVersion:2,verdict:'matched',criteria:[{criterionId:'accepted',verdict:'matched',note:'accepted',evidence:successorEvidence}],next:'advance'};
  put('step-3/parallel-1/response/response.json',{contractVersion:'starci/v2.2',operatorId:'architecture.decide',step:3,parallel:1,status:'done',fields:{'architecture-decision':'response/response.md'},attempt:{id:'successor-a2',number:2,expectedVersion:2},goalCheck:{achieved:true,evidence:successorEvidence},actual:{expectedVersion:2,observedAt:new Date().toISOString(),observations:[{criterionId:'accepted',observed:'accepted',evidence:successorEvidence}]},comparison:successorComparison});
  const stateFile=path.join(opened.session,'state.json');
  const state=JSON.parse(readFileSync(stateFile,'utf8'));
  state.chain=[['1/1'],['2/1'],['3/1']];state.steps={'1/1':'workspace.bind','2/1':'architecture.decide','3/1':'architecture.decide'};state.current='3/1';state.resumes={'3/1':{resumes:'2/1',stop:'CRITIQUE_UNRESOLVED'}};state.status='done';state.brief.proven=['doneWhen:0 repaired architecture accepted'];
  state.requestHashes={'1/1':requestHash('step-1/parallel-1/request/request.json'),'2/1':requestHash('step-2/parallel-1/request/request.json'),'2/1/critique':requestHash('step-2/parallel-1/critique/request/request.json'),'3/1':requestHash('step-3/parallel-1/request/request.json')};
  const attempt=(id,operatorId,number,kind,previous,exp,status,requestRef,responseRef,manifest,comparison)=>({id,operatorId,number,kind,previous,expectedVersion:exp.version,expectedHash:expectedHash(exp),expected:exp,frozenInputs:[],status,requestRef,responseRef,startedAt:'now',endedAt:'later',...(comparison?{comparison}:{}),evidenceManifest:manifest});
  state.attempts={
    '1/1':attempt('bind-a1','workspace.bind',1,'initial',null,bindExpected,'matched','step-1/parallel-1/request/request.json','step-1/parallel-1/response/response.json',await buildEvidenceManifest(path.join(opened.session,'step-1/parallel-1'))),
    '2/1':attempt('parent-a1','architecture.decide',1,'initial',null,parentExpected,'waiting','step-2/parallel-1/request/request.json','step-2/parallel-1/response/response.json',await buildEvidenceManifest(path.join(opened.session,'step-2/parallel-1'))),
    '2/1/critique':attempt('child-a1','architecture.decide',1,'initial',null,childExpected,'mismatched','step-2/parallel-1/critique/request/request.json','step-2/parallel-1/critique/response/response.json',await buildEvidenceManifest(path.join(opened.session,'step-2/parallel-1/critique')),childComparison),
    '3/1':attempt('successor-a2','architecture.decide',2,'repair','parent-a1',successorExpected,'matched','step-3/parallel-1/request/request.json','step-3/parallel-1/response/response.json',await buildEvidenceManifest(path.join(opened.session,'step-3/parallel-1')),successorComparison)
  };
  writeFileSync(stateFile,JSON.stringify(state));
  const result=await closeSuccessfulSession(opened.session,'Resolved review retained with the accepted repair.');
  assert.ok(!existsSync(opened.session));
  assert.ok(existsSync(path.join(result.bundle,'step-2/parallel-1/response/response.json')));
  assert.ok(existsSync(path.join(result.bundle,'step-2/parallel-1/critique/response/response.json')));
  const archived=JSON.parse(readFileSync(path.join(result.bundle,'state.json'),'utf8'));
  assert.equal(archived.attempts['2/1'].status,'waiting');
  assert.equal(archived.attempts['2/1/critique'].status,'mismatched');
}));
