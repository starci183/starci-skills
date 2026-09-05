import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { retainSessionBundle, verifyRetention, closeSuccessfulSession } from './session-cleanup.mjs';

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
  try { await run({ base, session, state, put, branch }); } finally { rmSync(base, { recursive: true, force: true }); }
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
