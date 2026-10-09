import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { FAKE_ORCA } from '../helpers/fake-orca.mjs';
import { inspectLedger, ledgerFileFor, openLedger } from '../../engine/db/ledger.mjs';
import { seedWorkflow } from '../helpers/ledger-fixture.mjs';
import {
  KERNEL_REV_ACKED_EVENT, KERNEL_REV_STALE, REV_DIFF_MAX_FILES, kernelRevState, opRevDrift, opRevStale, revWakeLine, shortRev,
} from '../../scripts/kernel/runtime-rev.mjs';
import { KERNEL_CONTRACT_FILES } from '../../scripts/kernel/required-read.mjs';
import { wakeKernel } from '../../scripts/kernel/wake-delivery.mjs';
import { wakePromptOf } from '../../scripts/kernel/kernel-watchdog.mjs';
import { rowsOfEvent } from '../../scripts/kernel/typed-logs.mjs';
import { ENGINE_SCHEMA } from '../../engine/constants.mjs';
import { INSTALL_MANIFEST_FILE, INSTALL_PROTOCOL_SCHEMA, installedPayloadDigest } from '../../scripts/lib/install-custody.mjs';

// Owner, 2026-09-27: Kernels read kernel-prompt.md and driver-loop.yaml once at boot, so a runtime change never
// reached a running Kernel without a restart. Every wake now names the runtime rev and, when the Kernel's acked
// rev is behind, what to re-read; enqueue/dispatch of a leg whose op contract changed waits for the ack.
const ROOT = path.resolve(import.meta.dirname, '..', '..');
const API = path.join(ROOT, 'scripts', 'kernel', 'cli.mjs');
const json = (text) => { try { return JSON.parse(text); } catch { return null; } };
const lastJson = (text) => json(String(text ?? '').trim()) ?? String(text ?? '').trim().split(/\r?\n/).reverse().map(json).find(Boolean) ?? null;

const git = (cwd, ...args) => {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
};
const write = (root, rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };

// A runtime root with three revisions: A (base), B (the draw brief and a knowledge file), C (more than REV_DIFF_MAX_FILES kernel-relevant files).
const runtime = (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-runtime-rev-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  git(root, 'init', '-q');
  git(root, 'config', 'user.email', 'spec@example.test'); git(root, 'config', 'user.name', 'spec'); git(root, 'config', 'commit.gpgsign', 'false');
  write(root, 'modules/kernel/kernel-prompt.md', 'prompt\n');
  write(root, 'modules/kernel/driver-loop.yaml', 'loop: 1\n');
  write(root, 'modules/kernel/verdict-contract.yaml', 'v: 1\n');
  write(root, 'modules/kernel/api.yaml', 'schema: fixture\n');
  write(root, 'modules/kernel/owner-rulings.yaml', 'rulings: []\n');
  write(root, 'modules/kernel/revision-scope.yaml', fs.readFileSync(path.join(ROOT, 'modules', 'kernel', 'revision-scope.yaml'), 'utf8'));
  write(root, 'modules/cli/commands/kernel/status.yaml', 'verb: status\n');
  write(root, 'modules/ops/_common.yaml', 'c: 1\n');
  write(root, 'modules/ops/ops/interface.draw.yaml', 'id: interface.draw\n');
  write(root, 'modules/ops/ops/code.refactor.yaml', 'id: code.refactor\n');
  write(root, 'scripts/kernel/op-prompt.mjs', 'export {};\n');
  write(root, 'README.md', 'x\n');
  git(root, 'add', '-A'); git(root, 'commit', '-qm', 'A');
  const A = git(root, 'rev-parse', 'HEAD');
  write(root, 'modules/ops/ops/interface.draw.yaml', 'id: interface.draw\nnew: rule\n');
  write(root, 'modules/kernel/driver-loop.yaml', 'loop: 2\n');
  write(root, 'knowledge/ui/rule.yaml', 'rule: 1\n');
  write(root, 'README.md', 'not kernel relevant\n');
  git(root, 'add', '-A'); git(root, 'commit', '-qm', 'B');
  const B = git(root, 'rev-parse', 'HEAD');
  // the verb contracts a Kernel seat reads are the group file and the verbs of its seat table (required-read.mjs): those are the kernel-relevant files of the verb directory
  const seatContracts = KERNEL_CONTRACT_FILES.filter((rel) => rel.startsWith('modules/cli/commands/kernel/'));
  for (let i = 0; i <= REV_DIFF_MAX_FILES; i += 1) write(root, seatContracts[i], `k: ${i}\n`);
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

test('an acked rev behind HEAD is stale: the wake names the rev, the actual changed kernel files and complete READ route', (t) => {
  const rt = runtime(t); rt.checkout(rt.B);
  const { db, wf, ack } = ledgerFixture(t);
  ack(rt.A, 'boot');
  const state = kernelRevState(db, wf, { root: rt.root, ops: ['interface.draw'] });
  assert.deepEqual([state.current, state.acked, state.ackSource, state.stale, state.full ?? false], [rt.B, rt.A, 'boot', true, false]);
  assert.deepEqual(state.files, ['modules/kernel/driver-loop.yaml', 'modules/ops/ops/interface.draw.yaml'], 'README.md and knowledge are not this Kernel\'s contract');
  const line = revWakeLine(state, wf);
  assert.ok(line.startsWith(`Runtime rev ${shortRev(rt.B)}: your acknowledged rev is ${shortRev(rt.A)}; re-read modules/kernel/driver-loop.yaml and modules/ops/ops/interface.draw.yaml`), line);
  assert.match(line, new RegExp(`starci kernel kernel-ack-rev --workflow ${wf} --plan`));
  assert.match(line,new RegExp(`--rev ${rt.B} --digest <readToken>`));
  assert.doesNotMatch(line, /\n/, 'one line: a newline would submit half a wake');

  // The gate holds only the legs whose op contract moved.
  assert.deepEqual(opRevStale(state, 'interface.draw', { root: rt.root }), { files: ['modules/ops/ops/interface.draw.yaml'] });
  assert.equal(opRevStale(state, 'code.refactor', { root: rt.root }), null, 'other legs are unaffected');

  // The ack clears it.
  ack(rt.B);
  const acked = kernelRevState(db, wf, { root: rt.root });
  assert.deepEqual([acked.acked, acked.stale, acked.files], [rt.B, false, []]);
  assert.equal(opRevStale(acked, 'interface.draw', { root: rt.root }), null);
  assert.equal(revWakeLine(acked, wf), `Runtime rev ${shortRev(rt.B)}.`);
});

test('past the file cap or for an unknown revision, the wake offers the complete READ route; an unacked state has no diff gate', (t) => {
  const rt = runtime(t); rt.checkout(rt.C);
  const { db, wf, ack } = ledgerFixture(t);
  const unacked = kernelRevState(db, wf, { root: rt.root });
  assert.deepEqual([unacked.unacked, unacked.stale], [true, false]);
  const unackedLine = revWakeLine(unacked, wf);
  assert.ok(unackedLine.startsWith(`Runtime rev ${shortRev(rt.C)}: no complete runtime READ is acknowledged; re-read modules/kernel/kernel-prompt.md and modules/kernel/driver-loop.yaml`), unackedLine);
  assert.ok(unackedLine.includes(`starci kernel kernel-ack-rev --workflow ${wf} --plan; read every returned path, then attest with --rev ${rt.C} --digest <readToken>`), unackedLine);
  assert.equal(opRevStale(unacked, 'interface.draw', { root: rt.root }), null);

  ack(rt.A);
  const full = kernelRevState(db, wf, { root: rt.root });
  assert.deepEqual([full.stale, full.full, full.files.length, full.fileCount], [true, true, REV_DIFF_MAX_FILES, REV_DIFF_MAX_FILES + 2]);
  const fullLine = revWakeLine(full, wf);
  assert.match(fullLine, /re-read modules\/kernel\/kernel-prompt\.md and modules\/kernel\/driver-loop\.yaml, then starci kernel kernel-ack-rev/);
  assert.ok(fullLine.includes(`--workflow ${wf} --plan; read every returned path, then attest with --rev ${rt.C} --digest <readToken>`), fullLine);
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
  l.db.prepare("INSERT INTO signals(scope,key,workflow_id,holder_pid,token,value_json,at,expires_at) VALUES('kernel',?,?,1,'tok',?,?,NULL)").run(wf, wf, JSON.stringify({ terminal: 'term_k' }), Date.now());
  seedWorkflow(l, { id: wf, jobs: [{ jobId: `kernel-${wf}`, kind: 'kernel', status: 'running', workerId: 'term_k',
    payload: { hierarchy: { schema: 'starci/agent-hierarchy@1', nodeId: `agent:kernel:${wf}`, parentNodeId: `workflow:${wf}`, role: 'kernel', attempt: 2 } } }] });
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
  const state = kernelRevState(db, wf, { root: rt.root });
  const revLine = revWakeLine(state, wf);
  assert.ok(text.startsWith(`Durable transition wake for workflow wf-rev: report-filed. ${revLine} `), text);
  assert.match(text, /Runtime wake for Kernel attempt 2 of wf-rev: starci kernel status --workflow wf-rev shows kernel\.attempt 2 and kernel\.you true on your terminal\.$/, 'the seat identity still ends the wake');

  // The watchdog builds its wake from one starci kernel status read.
  const prompt = wakePromptOf(wf, { kernel: { attempt: 2 }, kernelRev: JSON.parse(JSON.stringify(state)) });
  assert.ok(prompt.includes(revLine), prompt);
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
  if (process.env.STARCI_TEST_TEMP_DIR) t.after(() => fs.rmSync(path.join(process.env.STARCI_TEST_TEMP_DIR, 'starci-job-scratch'), { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const repo = path.join(dir, 'repo'); fs.mkdirSync(repo); fs.mkdirSync(path.join(repo, 'docs'));
  const stub = path.join(dir, 'fake-orca.mjs'); fs.writeFileSync(stub, FAKE_ORCA);
  const env = { ...process.env, STARCI_KERNEL_REV_ROOT: rt.root, STARCI_GIT_MEMO_DIR: path.join(dir, 'git-memo'), STARCI_ORCA_COMMAND: process.execPath, STARCI_ORCA_ARGS: JSON.stringify([stub]),
    STARCI_FAKE_ORCA_LOG: path.join(dir, 'calls.jsonl'), STARCI_FAKE_ORCA_STATE: path.join(dir, 'state.json') };
  for (const key of ['ORCA_TERMINAL_HANDLE', 'STARCI_ROLE', 'STARCI_OP_JOB']) delete env[key];
  const api = (args, kernel = false) => spawnSync(process.execPath, [API, ...args, '--repo', repo, '--json'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120000, env: kernel || args[0] === 'kernel-ack-rev' ? { ...env,ORCA_TERMINAL_HANDLE: 'term_k' } : env });
  const ok = (args, kernel = false) => { const r = api(args, kernel); assert.equal(r.status, 0, `${args.join(' ')}: ${r.stderr || r.stdout}`); return json(r.stdout); };
  const wf = 'wf-rev-api';
  const seed = (fn) => { const l = openLedger({ file: ledgerFileFor(repo) }); try { return fn(l); } finally { l.close(); } };
  const read = (fn) => { const l = inspectLedger({ file: ledgerFileFor(repo) }); try { return fn(l.db); } finally { l.close(); } };
  seed((l) => {
    seedWorkflow(l, { id: wf, state: { phase: 'running', job: wf }, goal: { revision: 0, identity: 'goal', markdown: '# goal', json: {} },
      jobs: [{ jobId: `kernel-${wf}`, kind: 'kernel', status: 'running', workerId: 'term_k',
        payload: { managed: { agentTerminalHandle: 'term_k',dispatchId: 'fixture-dispatch' },hierarchy: { schema: 'starci/agent-hierarchy@1', nodeId: `agent:kernel:${wf}`, parentNodeId: `workflow:${wf}`, role: 'kernel',workflowId: wf,generation: 1,attempt: 1,runtime: { terminalHandle: 'term_k' } } } }],
      signals: [{ key: wf,token: 'fixture-kernel-token',value: { terminal: 'term_k',dispatch: 'fixture-dispatch' } }] });
    l.write.updateWorkflow({ workflowId: wf, ledgerMode: 'durable', sourceRoots: [repo] });
  });
  const manifestFile = path.join(dir,'kernel-read.json');
  const readAck = rev => {
    const plan = ok(['kernel-ack-rev','--workflow',wf,'--plan']);
    fs.writeFileSync(manifestFile,JSON.stringify(plan.readManifest));
    return ok(['kernel-ack-rev','--workflow',wf,'--rev',rev,'--read-manifest',manifestFile]);
  };
  return { repo, wf, api, ok, seed, read, readAck, manifestFile };
};

test('api: a stale Kernel is refused kernel-rev-stale for the changed op only, status shows kernelRev and a reread step, kernel-ack-rev clears it', (t) => {
  const rt = runtime(t); rt.checkout(rt.B);
  const fx = apiFixture(t, rt);
  // Never acked: nothing is gated, status says so.
  const fresh = fx.ok(['status', '--workflow', fx.wf]);
  assert.deepEqual([fresh.kernelRev.current, fresh.kernelRev.acked, fresh.kernelRev.unacked, fresh.kernelRev.stale], [rt.B, null, true, false]);
  assert.notEqual(fresh.nextActions[0]?.kind, 'reread');

  rt.checkout(rt.A);
  const acked = fx.readAck(rt.A);
  assert.equal(acked.rev,rt.A);assert.equal(acked.attempt,1);assert.ok(acked.readManifest.files.length);
  rt.checkout(rt.B);
  const unknown = fx.api(['kernel-ack-rev', '--workflow', fx.wf, '--rev', 'deadbeefdeadbeef','--read-manifest',fx.manifestFile]);
  assert.equal(unknown.status, 1);
  assert.equal(lastJson(unknown.stderr)?.code, 'kernel-rev-unknown');

  const status = fx.ok(['status', '--workflow', fx.wf]);
  assert.deepEqual([status.kernelRev.acked, status.kernelRev.stale], [rt.A, true]);
  assert.deepEqual(status.kernelRev.files, ['modules/kernel/driver-loop.yaml'], 'no interface.draw leg yet: only the Kernel contract file asks for the re-read');
  assert.equal(status.nextActions[0].kind, 'reread');
  assert.match(status.nextActions[0].reason, new RegExp(`starci kernel kernel-ack-rev --workflow ${fx.wf} --plan`));
  assert.match(status.nextActions[0].reason, new RegExp(`--rev ${rt.B} --digest <readToken>`));
  assert.equal(status.frontier.actionable, true, 'a stale Kernel has work: the re-read');

  const refused = fx.api(['enqueue', '--workflow', fx.wf, '--op', 'interface.draw', '--paths', 'docs/draw']);
  assert.equal(refused.status, 1, refused.stdout);
  const err = lastJson(refused.stderr);
  assert.equal(err.code, KERNEL_REV_STALE);
  assert.match(err.error, /enqueue of interface\.draw refused - its op contract changed .*modules\/ops\/ops\/interface\.draw\.yaml/);
  const other = fx.ok(['enqueue', '--workflow', fx.wf, '--op', 'code.refactor', '--paths', 'docs/refactor']);
  assert.ok(other.job_id, 'a leg of an unchanged op is enqueued');

  // dispatch holds a queued leg of the changed op the same way, before any reservation.
  fx.seed((l) => seedWorkflow(l, { id: fx.wf, jobs: [{ jobId: 'job-draw', opId: 'interface.draw', kind: 'op', payload: { opId: 'interface.draw', owned_paths: ['docs/draw'] } }] }));
  const held = fx.api(['dispatch', '--job', 'job-draw']);
  assert.equal(held.status, 1);
  assert.equal(lastJson(held.stderr)?.code, KERNEL_REV_STALE);
  assert.equal(fx.read((db) => db.prepare("SELECT status FROM jobs WHERE job_id='job-draw'").get().status), 'queued');

  const current = fx.readAck(rt.B);
  assert.equal(current.rev,rt.B);
  const after = fx.ok(['status', '--workflow', fx.wf]);
  assert.deepEqual([after.kernelRev.acked, after.kernelRev.stale], [rt.B, false]);
  assert.notEqual(after.nextActions[0]?.kind, 'reread');
  const enq = fx.api(['enqueue', '--workflow', fx.wf, '--op', 'interface.draw', '--paths', 'docs/draw2']);
  assert.notEqual(lastJson(enq.stderr)?.code, KERNEL_REV_STALE, 'the ack lifts the gate');
  assert.deepEqual(fx.read((db) => db.prepare('SELECT json_extract(payload_json,\'$.source\') s FROM events WHERE workflow_id=? AND kind=? ORDER BY seq').all(fx.wf, KERNEL_REV_ACKED_EVENT).map((r) => r.s)), ['ack', 'ack']);
});

test('starci kernel settle WARNs op-rev-drift when the op contract changed after dispatch; status lists it', (t) => {
  const rt = runtime(t); rt.checkout(rt.B);
  const fx = apiFixture(t, rt);
  const now = Date.now();
  fx.seed((l) => {
    seedWorkflow(l, { id: fx.wf, jobs: [{ jobId: 'job-d', opId: 'interface.draw', kind: 'op', status: 'running', workerId: 'ctx-d',
      payload: { opId: 'interface.draw', owned_paths: ['docs/d'], managed: { dispatchId: 'ctx-d' } } }] });
    l.transaction((db) => {
      const attemptId = db.prepare("SELECT attempt_id FROM op_attempts WHERE job_id='job-d'").get().attempt_id;
      db.prepare('INSERT INTO contracts(attempt_id,workflow_id,job_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?)')
        .run(attemptId, fx.wf, 'job-d', '# contract', JSON.stringify({ contract: { schema: 'starci/contract-version@1', op: 'interface.draw', runtimeSha: rt.A, admittedAt: now } }), now);
    });
  });
  const r = fx.api(['settle', '--job', 'job-d', '--verdict', 'fail']);
  assert.equal(r.status, 0, r.stderr || r.stdout);
  const out = json(r.stdout);
  assert.deepEqual(out.opRevDrift, { op: 'interface.draw', attempt: 1, from: rt.A, to: rt.B, files: ['modules/ops/ops/interface.draw.yaml'] });
  assert.match(r.stderr, /WARN op-rev-drift: job-d \(interface\.draw\)/);
  const status = fx.ok(['status', '--workflow', fx.wf]);
  assert.deepEqual(status.opRevDrift.map((w) => [w.jobId, w.op, w.from, w.to]), [['job-d', 'interface.draw', rt.A, rt.B]]);
});

test('runtime churn: a land outside the Kernel contract is silent; an op-contract-only land is coalesced for 30 min after the last ack', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-runtime-churn-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  git(root, 'init', '-q');
  git(root, 'config', 'user.email', 'spec@example.test'); git(root, 'config', 'user.name', 'spec'); git(root, 'config', 'commit.gpgsign', 'false');
  write(root, 'modules/kernel/kernel-prompt.md', 'prompt\n');
  write(root, 'modules/kernel/driver-loop.yaml', 'loop: 1\n');
  write(root, 'modules/ops/ops/interface.draw.yaml', 'id: interface.draw\n');
  write(root, 'scripts/kernel/op-prompt.mjs', 'export {};\n');
  git(root, 'add', '-A'); git(root, 'commit', '-qm', 'A');
  const A = git(root, 'rev-parse', 'HEAD');
  // A reconciler lane: code and runtimes.yaml numbers outside this Kernel's required contract.
  write(root, 'scripts/reconciler/engine.mjs', 'export {};\n');
  write(root, 'modules/models/runtimes.yaml', 'allocation: {}\n');
  git(root, 'add', '-A'); git(root, 'commit', '-qm', 'B');
  const B = git(root, 'rev-parse', 'HEAD');
  const { db, wf, ack } = ledgerFixture(t);
  ack(A);
  const silent = kernelRevState(db, wf, { root, ops: ['interface.draw'] });
  assert.deepEqual([silent.stale, silent.files], [false, []], 'no re-read, no ack');
  assert.equal(revWakeLine(silent, wf), `Runtime rev ${shortRev(B)}.`);
  // An op contract the workflow dispatches moves: coalesced within 30 min of the ack, asked after.
  write(root, 'modules/ops/ops/interface.draw.yaml', 'id: interface.draw\nnew: 1\n');
  git(root, 'add', '-A'); git(root, 'commit', '-qm', 'C');
  const at = Date.now();
  const soon = kernelRevState(db, wf, { root, ops: ['interface.draw'], now: at + 60_000 });
  assert.equal(soon.stale, false);
  assert.deepEqual(soon.deferred.files, ['modules/ops/ops/interface.draw.yaml']);
  assert.ok(opRevStale(soon, 'interface.draw', { root }), 'the dispatch gate still holds the changed op');
  const later = kernelRevState(db, wf, { root, ops: ['interface.draw'], now: at + 31 * 60_000 });
  assert.deepEqual([later.stale, later.files], [true, ['modules/ops/ops/interface.draw.yaml']]);
  // A Kernel contract file is never coalesced.
  write(root, 'modules/kernel/kernel-prompt.md', 'prompt 2\n');
  git(root, 'add', '-A'); git(root, 'commit', '-qm', 'D');
  const contract = kernelRevState(db, wf, { root, ops: ['interface.draw'], now: at + 60_000 });
  assert.equal(contract.stale, true);
  assert.ok(contract.files.includes('modules/kernel/kernel-prompt.md'));
});

test('installed upcoming op keeps one READ revision through actual CLI enqueue and dispatch admission', t => {
  const rt = runtime(t); rt.checkout(rt.A);
  fs.renameSync(path.join(rt.root, '.git'), path.join(path.dirname(rt.root), path.basename(rt.root) + '-retained-git'));
  const retained = path.join(path.dirname(rt.root), path.basename(rt.root) + '-retained-git');
  t.after(() => fs.rmSync(retained, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  write(rt.root, 'package.json', JSON.stringify({ name: 'starci-installed-fixture', version: '0.0.1-fixture' }));
  write(rt.root, 'engine/constants.mjs', `export const ENGINE_SCHEMA=${JSON.stringify(ENGINE_SCHEMA)};`);
  const files = {};
  const scan = (dir, relative = '') => { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) scan(path.join(dir, entry.name), rel);
    else files[rel] = installedPayloadDigest(fs.readFileSync(path.join(dir, entry.name)));
  } };
  scan(rt.root);
  const custody = { name: 'starci-installed-fixture', version: '0.0.1-fixture', installProtocol: { schema: INSTALL_PROTOCOL_SCHEMA, engine: ENGINE_SCHEMA }, files };
  const descriptor = path.join(rt.root, INSTALL_MANIFEST_FILE);
  fs.writeFileSync(descriptor, JSON.stringify(custody));
  const fx = apiFixture(t, rt), op = 'code.refactor';
  const opCount = () => fx.read(db => db.prepare('SELECT count(*) n FROM jobs WHERE workflow_id=? AND op_id IS NOT NULL').get(fx.wf).n);
  assert.equal(opCount(), 0, 'the upcoming op has no persisted job');
  const plan = fx.ok(['kernel-ack-rev', '--workflow', fx.wf, '--plan', '--op', op], true).readManifest;
  assert.deepEqual(plan.ops, [op]); assert.equal(plan.revision.kind, 'installed');
  assert.match(plan.rev, /^installed:[a-f0-9]{64}$/);
  fs.writeFileSync(fx.manifestFile, JSON.stringify(plan));
  const acked = fx.ok(['kernel-ack-rev', '--workflow', fx.wf, '--rev', plan.rev, '--read-manifest', fx.manifestFile, '--op', op], true);
  assert.equal(acked.rev, plan.rev);
  const before = fx.ok(['status', '--workflow', fx.wf], true).kernelRev;
  assert.deepEqual([before.current, before.acked, before.stale], [plan.rev, plan.rev, false], 'status retains acknowledged upcoming rows');
  const args = ['enqueue', '--workflow', fx.wf, '--op', op, '--paths', 'docs/refactor'];
  const beyondGate = fx.api([...args, '--params', '{invalid'], true);
  assert.equal(beyondGate.status, 1);
  assert.equal(lastJson(beyondGate.stderr)?.code, 'params-invalid', 'actual combined READ/revision gate passes before parameter validation');
  assert.equal(opCount(), 0);
  const enqueued = fx.ok(args, true);
  assert.ok(enqueued.job_id); assert.equal(opCount(), 1);
  const gate = fx.ok(['incident', '--workflow', fx.wf, '--kind', 'supervisor-gate', '--op', op, '--holds', enqueued.job_id, '--cause', 'runtime-defect', '--no-workaround', 'defect-on-every-path', '--detail', 'private fixture stops before provider launch']);
  assert.ok(gate.incidentId);
  const dispatch = fx.api(['dispatch', '--job', enqueued.job_id], true);
  assert.equal(dispatch.status, 1);
  const held = lastJson(dispatch.stdout);
  assert.equal(held?.reason, 'supervisor-gate', `actual dispatch passes READ/revision admission and reaches its later governed hold: ${JSON.stringify({status:dispatch.status,signal:dispatch.signal,error:dispatch.error?.message??null,stdout:dispatch.stdout,stderr:dispatch.stderr})}`);
  assert.equal(held.incident, gate.incidentId, 'the exact private incident holds this job');
  assert.equal(fx.read(db => db.prepare('SELECT status FROM jobs WHERE job_id=?').get(enqueued.job_id).status), 'queued');
  assert.equal(fs.existsSync(path.join(path.dirname(fx.repo), 'calls.jsonl')), false, 'no provider command was reached');
  fs.renameSync(descriptor, descriptor + '.retained');
  const missing = fx.api(args, true);
  assert.equal(missing.status, 1); assert.equal(lastJson(missing.stderr)?.code, 'kernel-read-unverified');
  fs.renameSync(descriptor + '.retained', descriptor);
  const bad = { ...custody, files: { ...files, 'modules/ops/ops/code.refactor.yaml': '0'.repeat(64) } };
  fs.writeFileSync(descriptor, JSON.stringify(bad));
  const forged = fx.api(['dispatch', '--job', enqueued.job_id], true);
  assert.equal(forged.status, 1); assert.equal(lastJson(forged.stderr)?.code, 'kernel-read-unverified');
  fs.writeFileSync(descriptor, JSON.stringify(custody));
  write(rt.root, 'modules/ops/ops/code.refactor.yaml', 'id: code.refactor\nchanged: unread\n');
  const changed = fx.api(args, true);
  assert.equal(changed.status, 1); assert.equal(lastJson(changed.stderr)?.code, 'kernel-read-unverified');
  assert.equal(opCount(), 1, 'refused missing/forged/changed READ adds no job');
});

test('a land that carries a Kernel note delivers it verbatim with the wake; a land without one adds no line; the ack clears it', (t) => {
  const rt = runtime(t); rt.checkout(rt.B);
  const { db, wf, ack } = ledgerFixture(t);
  const note = 'report with --evidence from now on; the old flag is refused';
  git(rt.root, 'notes', '--ref=land', 'add', '-m', `Land-Verified: ${rt.B}\nSpecs: 1/1\nKernel-Note: ${note}`, rt.B);
  ack(rt.A, 'boot');
  const withNote = kernelRevState(db, wf, { root: rt.root, ops: ['interface.draw'] });
  assert.deepEqual(withNote.notes, [note]);
  const line = revWakeLine(withNote, wf);
  assert.ok(line.endsWith(` What a Kernel must do differently: ${note}`), line);
  assert.doesNotMatch(line, /\n/, 'one line');
  // A note on a revision whose changed files are not this Kernel's contract still asks for the re-read and carries the line.
  const only = runtime(t); only.checkout(only.B);
  git(only.root, 'notes', '--ref=land', 'add', '-m', 'Kernel-Note: only the note changed', only.B);
  const silent = ledgerFixture(t);
  silent.ack(only.A, 'boot');
  const state = kernelRevState(silent.db, silent.wf, { root: only.root, ops: ['code.refactor'] });
  assert.equal(state.stale, true);
  assert.match(revWakeLine(state, silent.wf), /What a Kernel must do differently: only the note changed/);
  // Without a note on any land since the ack there is no line, and after the ack nothing is stale.
  const none = runtime(t); none.checkout(none.B);
  const plain = ledgerFixture(t);
  plain.ack(none.A, 'boot');
  assert.equal(kernelRevState(plain.db, plain.wf, { root: none.root, ops: ['interface.draw'] }).notes, undefined);
  assert.doesNotMatch(revWakeLine(kernelRevState(plain.db, plain.wf, { root: none.root, ops: ['interface.draw'] }), plain.wf), /must do differently/);
  ack(rt.B);
  const acked = kernelRevState(db, wf, { root: rt.root });
  assert.equal(revWakeLine(acked, wf), `Runtime rev ${shortRev(rt.B)}.`);
});
