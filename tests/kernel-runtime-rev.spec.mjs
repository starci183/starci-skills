import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { FAKE_ORCA } from './helpers/fake-orca.mjs';
import { inspectLedger, ledgerFileFor, openLedger } from '../engine/ledger-db.mjs';
import {
  KERNEL_REV_ACKED_EVENT, KERNEL_REV_STALE, REV_DIFF_MAX_FILES, kernelRevState, opRevDrift, opRevStale, revWakeLine, shortRev,
} from '../scripts/kernel/runtime-rev.mjs';
import { wakeKernel } from '../scripts/kernel/wake-delivery.mjs';
import { wakePromptOf } from '../scripts/kernel/watchdog.mjs';
import { rowsOfEvent } from '../scripts/kernel/typed-logs.mjs';

// Owner, 2026-09-27: Kernels read kernel-prompt.md and driver-loop.yaml once at boot, so a runtime change never
// reached a running Kernel without a restart. Every wake now names the runtime rev and, when the Kernel's acked
// rev is behind, what to re-read; enqueue/dispatch of a leg whose op contract changed waits for the ack.
const ROOT = path.resolve(import.meta.dirname, '..');
const API = path.join(ROOT, 'scripts', 'kernel', 'api.mjs');
const json = (text) => { try { return JSON.parse(text); } catch { return null; } };
const lastJson = (text) => String(text ?? '').trim().split(/\r?\n/).reverse().map(json).find(Boolean) ?? null;

const git = (cwd, ...args) => {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
};
const write = (root, rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
const REGISTRY = (entries = '') => `schema: starci/contract-changes@1\nchanges:\n${entries}`;

// A runtime root with three revisions: A (base), B (the draw brief, a knowledge file and a draw-scoped
// contract change), C (more than REV_DIFF_MAX_FILES kernel-relevant files).
const runtime = (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-runtime-rev-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  git(root, 'init', '-q');
  git(root, 'config', 'user.email', 'spec@example.test'); git(root, 'config', 'user.name', 'spec'); git(root, 'config', 'commit.gpgsign', 'false');
  write(root, 'modules/kernel/kernel-prompt.md', 'prompt\n');
  write(root, 'modules/kernel/driver-loop.yaml', 'loop: 1\n');
  write(root, 'modules/kernel/verdict-contract.yaml', 'v: 1\n');
  write(root, 'modules/kernel/contract-changes.yaml', REGISTRY());
  write(root, 'modules/ops/_common.yaml', 'c: 1\n');
  write(root, 'modules/ops/ops/interface.draw.yaml', 'id: interface.draw\n');
  write(root, 'modules/ops/ops/code.refactor.yaml', 'id: code.refactor\n');
  write(root, 'scripts/kernel/op-prompt.mjs', 'export {};\n');
  write(root, 'README.md', 'x\n');
  git(root, 'add', '-A'); git(root, 'commit', '-qm', 'A');
  const A = git(root, 'rev-parse', 'HEAD');
  write(root, 'modules/ops/ops/interface.draw.yaml', 'id: interface.draw\nnew: rule\n');
  write(root, 'knowledge/ui/rule.yaml', 'rule: 1\n');
  write(root, 'README.md', 'not kernel relevant\n');
  write(root, 'modules/kernel/contract-changes.yaml', REGISTRY(`  - id: draw-new-rule\n    effectiveAt: '2026-09-27T20:00:00+07:00'\n    summary: "The draw brief gained a rule"\n    ops: [interface.draw]\n`));
  git(root, 'add', '-A'); git(root, 'commit', '-qm', 'B');
  const B = git(root, 'rev-parse', 'HEAD');
  for (let i = 0; i <= REV_DIFF_MAX_FILES; i += 1) write(root, `knowledge/bulk/k${i}.yaml`, `k: ${i}\n`);
  git(root, 'add', '-A'); git(root, 'commit', '-qm', 'C');
  const C = git(root, 'rev-parse', 'HEAD');
  return { root, A, B, C, checkout: (rev) => git(root, 'checkout', '-q', rev) };
};

const ledgerFixture = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-runtime-rev-ledger-'));
  const l = openLedger({ file: path.join(dir, 'runtime.sqlite') });
  t.after(() => { l.close(); fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }); });
  const wf = 'wf-rev';
  l.ensureWorkflow({ workflowId: wf, title: wf, ledgerMode: 'durable', sourceRoots: [dir] });
  const ack = (rev, source = 'ack') => l.transaction(() => l.appendEvent({ workflowId: wf, entityType: 'kernel', entityId: wf, kind: KERNEL_REV_ACKED_EVENT, payload: { rev, files: [], source } }));
  return { l, db: l.db, wf, ack };
};

test('an acked rev behind HEAD is stale: the wake names the rev, the changed kernel files and the new contract change', (t) => {
  const rt = runtime(t); rt.checkout(rt.B);
  const { db, wf, ack } = ledgerFixture(t);
  ack(rt.A, 'boot');
  const state = kernelRevState(db, wf, { root: rt.root });
  assert.deepEqual([state.current, state.acked, state.ackSource, state.stale, state.full ?? false], [rt.B, rt.A, 'boot', true, false]);
  assert.deepEqual(state.files, ['knowledge/ui/rule.yaml', 'modules/kernel/contract-changes.yaml', 'modules/ops/ops/interface.draw.yaml'], 'README.md is not kernel-relevant');
  assert.deepEqual(state.changes.map((c) => [c.id, c.ops]), [['draw-new-rule', ['interface.draw']]]);
  const line = revWakeLine(state, wf);
  assert.ok(line.startsWith(`Runtime rev ${shortRev(rt.B)} is newer than your acked rev ${shortRev(rt.A)}: re-read knowledge/ui/rule.yaml, modules/kernel/contract-changes.yaml, modules/ops/ops/interface.draw.yaml`), line);
  assert.match(line, /new contract changes: draw-new-rule \(The draw brief gained a rule\)/);
  assert.match(line, new RegExp(`api kernel-ack-rev --workflow ${wf} --rev ${shortRev(rt.B)}`));
  assert.doesNotMatch(line, /\n/, 'one line: a newline would submit half a wake');

  // The gate holds only the legs whose op contract moved.
  assert.deepEqual(opRevStale(state, 'interface.draw', { root: rt.root }), { files: ['modules/ops/ops/interface.draw.yaml'], changes: ['draw-new-rule'] });
  assert.equal(opRevStale(state, 'code.refactor', { root: rt.root }), null, 'other legs are unaffected');

  // The ack clears it.
  ack(rt.B);
  const acked = kernelRevState(db, wf, { root: rt.root });
  assert.deepEqual([acked.acked, acked.stale, acked.files], [rt.B, false, []]);
  assert.equal(opRevStale(acked, 'interface.draw', { root: rt.root }), null);
  assert.equal(revWakeLine(acked, wf), `Runtime rev ${shortRev(rt.B)}.`);
});

test('past the file cap, or for a rev git no longer knows, the wake asks for the full re-read; a never-acked Kernel is asked once and never gated', (t) => {
  const rt = runtime(t); rt.checkout(rt.C);
  const { db, wf, ack } = ledgerFixture(t);
  const unacked = kernelRevState(db, wf, { root: rt.root });
  assert.deepEqual([unacked.unacked, unacked.stale], [true, false]);
  assert.match(revWakeLine(unacked, wf), /^Runtime rev [0-9a-f]{12}: no runtime rev acked yet - re-read modules\/kernel\/kernel-prompt\.md and modules\/kernel\/driver-loop\.yaml in full, then api kernel-ack-rev/);
  assert.equal(opRevStale(unacked, 'interface.draw', { root: rt.root }), null);

  ack(rt.A);
  const full = kernelRevState(db, wf, { root: rt.root });
  assert.deepEqual([full.stale, full.full, full.files.length, full.fileCount], [true, true, REV_DIFF_MAX_FILES, REV_DIFF_MAX_FILES + 4]);
  assert.match(revWakeLine(full, wf), /re-read modules\/kernel\/kernel-prompt\.md and modules\/kernel\/driver-loop\.yaml in full, then api kernel-ack-rev/);
  assert.ok(opRevStale(full, 'interface.draw', { root: rt.root }), 'the gate reads every changed file, not the capped list');
  assert.equal(opRevStale(full, 'code.refactor', { root: rt.root }), null);

  ack('0123456789abcdef0123456789abcdef01234567');
  const unknown = kernelRevState(db, wf, { root: rt.root });
  assert.deepEqual([unknown.stale, unknown.full, unknown.unknownDiff], [true, true, true]);
  assert.ok(opRevStale(unknown, 'code.refactor', { root: rt.root }), 'an unknown acked rev holds every leg');
});

test('every Kernel wake carries the runtime rev before its seat identity: wakeKernel and the watchdog liveness wake', (t) => {
  const rt = runtime(t); rt.checkout(rt.B);
  const { l, db, wf, ack } = ledgerFixture(t);
  ack(rt.A, 'boot');
  l.db.prepare("INSERT INTO signals(scope,key,holder_pid,token,value_json,at,expires_at) VALUES('kernel',?,1,'tok',?,?,NULL)").run(wf, JSON.stringify({ terminal: 'term_k' }), Date.now());
  l.db.prepare("INSERT INTO jobs(job_id,workflow_id,attempt,generation,kind,role,payload_json,status,worker_id,created_at,updated_at) VALUES(?,?,2,0,'kernel','kernel','{}','running','term_k',?,?)").run(`kernel-${wf}`, wf, Date.now(), Date.now());
  const prev = process.env.STARCI_KERNEL_REV_ROOT;
  process.env.STARCI_KERNEL_REV_ROOT = rt.root;
  t.after(() => { if (prev == null) delete process.env.STARCI_KERNEL_REV_ROOT; else process.env.STARCI_KERNEL_REV_ROOT = prev; });
  const IDLE = ['done', '─────', '❯', '─────', '  ⏵⏵ bypass permissions on (shift+tab to cycle)'].join('\n');
  const sends = [];
  let reads = 0;
  const deps = { show: () => ({ ok: true, connected: true, writable: true, terminal: { lastOutputAt: Date.now() } }),
    read: () => ({ ok: true, screen: reads++ < 2 ? IDLE : `> ${sends[0]?.text.slice(0, 80)}\n✻ Brewing… (1s · esc to interrupt)` }),
    send: (a) => { sends.push(a); return { ok: true }; }, sleep: () => {} };
  wakeKernel({ db, workflowId: wf, text: 'Durable transition wake for workflow wf-rev: report-filed.', deps });
  assert.ok(sends.length >= 1 && sends[0].text, 'the wake was typed');
  const text = sends[0].text;
  assert.match(text, new RegExp(`^Durable transition wake for workflow wf-rev: report-filed\\. Runtime rev ${shortRev(rt.B)} is newer than your acked rev ${shortRev(rt.A)}: re-read `));
  assert.match(text, /Runtime wake for Kernel attempt 2 of wf-rev: api status --workflow wf-rev shows kernel\.attempt 2 and kernel\.you true on your terminal\.$/, 'the seat identity still ends the wake');

  // The watchdog builds its wake from one api status read.
  const state = kernelRevState(db, wf, { root: rt.root });
  const prompt = wakePromptOf(wf, { kernel: { attempt: 2 }, kernelRev: JSON.parse(JSON.stringify(state)) });
  assert.match(prompt, new RegExp(`Runtime rev ${shortRev(rt.B)} is newer than your acked rev`));
  assert.match(prompt, /Runtime wake for Kernel attempt 2 of wf-rev: .*your terminal\.$/);
  assert.doesNotMatch(wakePromptOf(wf, { kernel: null, kernelRev: state }), /Runtime rev/, 'no seat, no rev line');
});

test('op-rev-drift: the op contract files that moved after dispatch, and its typed log warning', (t) => {
  const rt = runtime(t);
  assert.deepEqual(opRevDrift(rt.root, 'interface.draw', rt.A, rt.B), { from: rt.A, to: rt.B, files: ['modules/ops/ops/interface.draw.yaml'] });
  assert.equal(opRevDrift(rt.root, 'code.refactor', rt.A, rt.C), null, 'knowledge and another op brief are not this op contract');
  assert.equal(opRevDrift(rt.root, 'interface.draw', rt.B, rt.B), null);
  const [row] = rowsOfEvent({ seq: 7, kind: 'op-rev-drift', workflow_id: 'wf', entity_type: 'job', entity_id: 'job-1', created_at: 1,
    payload_json: JSON.stringify({ op: 'interface.draw', attempt: 1, from: rt.A, to: rt.B, files: ['modules/ops/ops/interface.draw.yaml'] }) });
  assert.deepEqual([row.kind, row.level, row.jobId, row.data.code], ['warning', 'warn', 'job-1', 'op-rev-drift']);
  assert.match(row.data.message, /interface\.draw\.yaml/);
});

// ---- api end to end: status, the gate, the ack verb, settle drift ---------------------------------
const apiFixture = (t, rt) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-runtime-rev-api-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const repo = path.join(dir, 'repo'); fs.mkdirSync(repo);
  const stub = path.join(dir, 'fake-orca.mjs'); fs.writeFileSync(stub, FAKE_ORCA);
  const env = { ...process.env, STARCI_KERNEL_REV_ROOT: rt.root, STARCI_ORCA_COMMAND: process.execPath, STARCI_ORCA_ARGS: JSON.stringify([stub]),
    STARCI_FAKE_ORCA_LOG: path.join(dir, 'calls.jsonl'), STARCI_FAKE_ORCA_STATE: path.join(dir, 'state.json') };
  for (const key of ['ORCA_TERMINAL_HANDLE', 'STARCI_ROLE', 'STARCI_OP_JOB']) delete env[key];
  const api = (args) => spawnSync(process.execPath, [API, ...args, '--repo', repo, '--json'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120000, env });
  const ok = (args) => { const r = api(args); assert.equal(r.status, 0, `${args.join(' ')}: ${r.stderr || r.stdout}`); return json(r.stdout); };
  const wf = 'wf-rev-api';
  const seed = (fn) => { const l = openLedger({ file: ledgerFileFor(repo) }); try { return fn(l); } finally { l.close(); } };
  const read = (fn) => { const l = inspectLedger({ file: ledgerFileFor(repo) }); try { return fn(l.db); } finally { l.close(); } };
  seed((l) => {
    l.ensureWorkflow({ workflowId: wf, title: wf, ledgerMode: 'durable', sourceRoots: [repo] });
    l.db.prepare("UPDATE workflows SET phase='running' WHERE workflow_id=?").run(wf);
    l.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)').run(wf, 0, 'goal', '# goal', '{}', Date.now());
    l.db.prepare("INSERT INTO jobs(job_id,workflow_id,attempt,generation,kind,role,payload_json,status,worker_id,created_at,updated_at) VALUES(?,?,1,0,'kernel','kernel','{}','running','term_k',?,?)").run(`kernel-${wf}`, wf, Date.now(), Date.now());
  });
  return { repo, wf, api, ok, seed, read };
};

test('api: a stale Kernel is refused kernel-rev-stale for the changed op only, status shows kernelRev and a reread step, kernel-ack-rev clears it', (t) => {
  const rt = runtime(t); rt.checkout(rt.B);
  const fx = apiFixture(t, rt);
  // Never acked: nothing is gated, status says so.
  const fresh = fx.ok(['status', '--workflow', fx.wf]);
  assert.deepEqual([fresh.kernelRev.current, fresh.kernelRev.acked, fresh.kernelRev.unacked, fresh.kernelRev.stale], [rt.B, null, true, false]);
  assert.notEqual(fresh.nextActions[0]?.kind, 'reread');

  const acked = fx.ok(['kernel-ack-rev', '--workflow', fx.wf, '--rev', shortRev(rt.A), '--files', 'kernel-prompt.md,driver-loop.yaml']);
  assert.deepEqual([acked.rev, acked.files, acked.attempt, acked.kernelRev.stale], [rt.A, ['kernel-prompt.md', 'driver-loop.yaml'], 1, true]);
  const unknown = fx.api(['kernel-ack-rev', '--workflow', fx.wf, '--rev', 'deadbeefdeadbeef']);
  assert.equal(unknown.status, 1);
  assert.equal(lastJson(unknown.stderr)?.code, 'kernel-rev-unknown');

  const status = fx.ok(['status', '--workflow', fx.wf]);
  assert.deepEqual([status.kernelRev.acked, status.kernelRev.stale], [rt.A, true]);
  assert.deepEqual(status.kernelRev.files, ['knowledge/ui/rule.yaml', 'modules/kernel/contract-changes.yaml', 'modules/ops/ops/interface.draw.yaml']);
  assert.equal(status.nextActions[0].kind, 'reread');
  assert.match(status.nextActions[0].reason, new RegExp(`api kernel-ack-rev --workflow ${fx.wf} --rev ${shortRev(rt.B)}`));
  assert.equal(status.frontier.actionable, true, 'a stale Kernel has work: the re-read');

  const refused = fx.api(['enqueue', '--workflow', fx.wf, '--op', 'interface.draw', '--paths', 'docs/draw']);
  assert.equal(refused.status, 1, refused.stdout);
  const err = lastJson(refused.stderr);
  assert.equal(err.code, KERNEL_REV_STALE);
  assert.match(err.error, /enqueue of interface\.draw refused - its op contract changed .*modules\/ops\/ops\/interface\.draw\.yaml, contract change draw-new-rule/);
  const other = fx.ok(['enqueue', '--workflow', fx.wf, '--op', 'code.refactor', '--paths', 'docs/refactor']);
  assert.ok(other.job_id, 'a leg of an unchanged op is enqueued');

  // dispatch holds a queued leg of the changed op the same way, before any reservation.
  fx.seed((l) => l.db.prepare("INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,created_at,updated_at) VALUES('job-draw',?,'interface.draw',1,0,'op','op',?,'queued',?,?)")
    .run(fx.wf, JSON.stringify({ opId: 'interface.draw', owned_paths: ['docs/draw'] }), Date.now(), Date.now()));
  const held = fx.api(['dispatch', '--job', 'job-draw']);
  assert.equal(held.status, 1);
  assert.equal(lastJson(held.stderr)?.code, KERNEL_REV_STALE);
  assert.equal(fx.read((db) => db.prepare("SELECT status FROM jobs WHERE job_id='job-draw'").get().status), 'queued');

  const current = fx.ok(['kernel-ack-rev', '--workflow', fx.wf, '--rev', rt.B]);
  assert.equal(current.kernelRev.stale, false);
  const after = fx.ok(['status', '--workflow', fx.wf]);
  assert.deepEqual([after.kernelRev.acked, after.kernelRev.stale], [rt.B, false]);
  assert.notEqual(after.nextActions[0]?.kind, 'reread');
  const enq = fx.api(['enqueue', '--workflow', fx.wf, '--op', 'interface.draw', '--paths', 'docs/draw2']);
  assert.notEqual(lastJson(enq.stderr)?.code, KERNEL_REV_STALE, 'the ack lifts the gate');
  assert.deepEqual(fx.read((db) => db.prepare('SELECT json_extract(payload_json,\'$.source\') s FROM events WHERE workflow_id=? AND kind=? ORDER BY seq').all(fx.wf, KERNEL_REV_ACKED_EVENT).map((r) => r.s)), ['ack', 'ack']);
});

test('api settle WARNs op-rev-drift when the op contract changed after dispatch; status lists it', (t) => {
  const rt = runtime(t); rt.checkout(rt.B);
  const fx = apiFixture(t, rt);
  const now = Date.now();
  fx.seed((l) => {
    l.db.prepare("INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,worker_id,created_at,updated_at) VALUES('job-d',?,'interface.draw',1,0,'op','op',?,'running','ctx-d',?,?)")
      .run(fx.wf, JSON.stringify({ opId: 'interface.draw', owned_paths: ['docs/d'], managed: { dispatchId: 'ctx-d' } }), now, now);
    l.db.prepare('INSERT INTO contracts(workflow_id,op_id,attempt,dispatch_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?,?)')
      .run(fx.wf, 'interface.draw', 1, 'ctx-d', '# contract', JSON.stringify({ contract: { schema: 'starci/contract-version@1', op: 'interface.draw', runtimeSha: rt.A, admittedAt: now } }), now);
  });
  const r = fx.api(['settle', '--job', 'job-d', '--verdict', 'fail']);
  assert.equal(r.status, 0, r.stderr || r.stdout);
  const out = json(r.stdout);
  assert.deepEqual(out.opRevDrift, { op: 'interface.draw', attempt: 1, from: rt.A, to: rt.B, files: ['modules/ops/ops/interface.draw.yaml'] });
  assert.match(r.stderr, /WARN op-rev-drift: job-d \(interface\.draw\)/);
  const status = fx.ok(['status', '--workflow', fx.wf]);
  assert.deepEqual(status.opRevDrift.map((w) => [w.jobId, w.op, w.from, w.to]), [['job-d', 'interface.draw', rt.A, rt.B]]);
});
