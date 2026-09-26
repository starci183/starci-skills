// With a work graph, `api status` reads its slices: workGraph names the runnable nodes, a leg's dispatch action
// lists them, a red node is a dispatch of the op that last wrote it, and business/architecture legs of different
// domains stop holding each other. Without one the leg skeleton drives the workflow unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ledgerFileFor, openLedger } from '../engine/ledger-db.mjs';
import { recordVersion } from '../scripts/work/work-graph-store.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const API = path.join(ROOT, 'scripts', 'kernel', 'api.mjs');
const WF = 'wf-graph-runtime';
const json = (v) => JSON.stringify(v ?? null);

const slice = (id, extra = {}) => {
  const [domain] = id.split('.');
  return { id, domain, slice: id, kind: extra.kind ?? 'slice', title: id, ownedPaths: [`src/${id.replace('.', '/')}`], reads: [], rollbackTo: id, size: { files: 2 }, ...extra };
};
const GRAPH = {
  schema: 'starci/work-graph@1', workflow: WF, domains: [{ id: 'auth' }, { id: 'notify' }],
  nodes: [slice('auth.foundation', { kind: 'foundation' }), slice('auth.login', { reads: ['src/auth/foundation'] }), slice('notify.mail')],
  edges: [{ from: 'auth.foundation', to: 'auth.login', kind: 'order' }],
};

function world(t, legs) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-wg-runtime-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const seed = (fn) => { const ledger = openLedger({ file: ledgerFileFor(repo) }); try { return fn(ledger); } finally { ledger.close(); } };
  seed((ledger) => {
    ledger.ensureWorkflow({ workflowId: WF, title: 'graph runtime' });
    ledger.db.prepare("UPDATE workflows SET phase='running' WHERE workflow_id=?").run(WF);
    ledger.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)')
      .run(WF, 0, 'g0', '# goal', json({ derivedPlan: { legs: legs.map((op) => ({ op })) } }), Date.now());
  });
  const job = (jobId, op, status, paths) => seed((ledger) => {
    ledger.enqueueJob({ jobId, workflowId: WF, opId: op, kind: 'op', payload: { opId: op, records: [], owned_paths: paths } });
    ledger.db.prepare('UPDATE jobs SET status=?, updated_at=? WHERE job_id=?').run(status, Date.now(), jobId);
  });
  const status = () => {
    const r = spawnSync(process.execPath, [API, 'status', '--workflow', WF, '--repo', repo, '--json'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120000 });
    assert.equal(r.status, 0, r.stderr);
    return JSON.parse(r.stdout);
  };
  const draw = (graph, reason) => seed((ledger) => recordVersion(ledger, { workflowId: WF, graph, event: 'draw', reason, authorOp: 'scope.define', authorJob: 'j-scope' }));
  return { job, status, draw };
}

test('without a work graph status carries none and a leg dispatch names no nodes', (t) => {
  const w = world(t, ['scope.define', 'business.decide']);
  w.job('j-scope', 'scope.define', 'succeeded', ['.starciwork/features/auth']);
  const s = w.status();
  assert.equal(s.workGraph, null);
  const dispatch = s.nextActions.find((a) => a.kind === 'dispatch' && a.op === 'business.decide');
  assert.ok(dispatch && !dispatch.nodes);
});

test('status names the runnable nodes and a leg dispatch lists them; a red node is re-dispatched to its last writer', (t) => {
  const w = world(t, ['scope.define', 'business.decide']);
  w.job('j-scope', 'scope.define', 'succeeded', ['.starciwork/features/auth']);
  w.draw(GRAPH, 'v0');
  const s = w.status();
  assert.equal(s.workGraph.version, 0);
  assert.deepEqual(s.workGraph.frontier.map((n) => n.id), ['auth.foundation', 'notify.mail']);
  const dispatch = s.nextActions.find((a) => a.kind === 'dispatch' && a.op === 'business.decide');
  assert.deepEqual(dispatch.nodes, ['auth.foundation', 'notify.mail']);

  w.job('j-found', 'backend.implement', 'succeeded', ['src/auth/foundation']);
  w.job('j-login', 'backend.implement', 'succeeded', ['src/auth/login']);
  w.job('j-mail', 'backend.implement', 'succeeded', ['src/notify/mail']);
  const revised = structuredClone(GRAPH);
  revised.nodes.find((n) => n.id === 'auth.foundation').reads = ['src/notify/mail'];
  revised.edges.push({ from: 'notify.mail', to: 'auth.foundation', kind: 'contract' });
  w.draw(revised, 'foundation reads mail');
  const after = w.status();
  assert.equal(after.workGraph.counts.red, 2);
  const rework = after.nextActions.find((a) => a.kind === 'dispatch' && a.nodes?.includes('auth.foundation') && a.op === 'backend.implement');
  assert.ok(rework, JSON.stringify(after.nextActions));
  assert.match(rework.reason, /--paths src\/auth\/foundation/);
});

test('with a work graph business and architecture legs of different domains stop holding each other', (t) => {
  const w = world(t, ['scope.define', 'business.decide', 'architecture.decide']);
  w.job('j-scope', 'scope.define', 'succeeded', ['.starciwork/features/auth']);
  w.job('j-biz-auth', 'business.decide', 'running', ['.starciwork/features/auth/fr']);
  w.job('j-arch-notify', 'architecture.decide', 'queued', ['.starciwork/features/notify/sds']);
  w.job('j-arch-auth', 'architecture.decide', 'queued', ['.starciwork/features/auth/sds']);
  const held = (s, id) => s.frontier.queued.find((q) => q.jobId === id).queuedBecause;
  const before = w.status();
  assert.equal(held(before, 'j-arch-notify'), 'dependency', 'the leg skeleton holds every architecture job');
  w.draw(GRAPH, 'v0');
  const after = w.status();
  assert.notEqual(held(after, 'j-arch-notify'), 'dependency');
  assert.equal(held(after, 'j-arch-auth'), 'dependency', 'the same domain still waits on its business leg');
});
