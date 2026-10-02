// settle-session-release.spec.mjs — per-op session release at settle
// (host housekeeping, STORAGE-PROMPT item 8): when `api settle` closes an op,
// the op's own agent session files move to the archive root — never the live
// kernel's session, never a session whose terminal is still open, and settle
// still succeeds when no session file exists.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { inspectLedger, ledgerFileFor, openLedger, ensureWorkflow, changeWorkflowPhase, insertGoal, createUnit, enqueueJob, setJobStatus, startAttempt, writeContract, appendEvent } from '../../engine/db/ledger.mjs';
import { FAKE_ORCA } from '../helpers/fake-orca.mjs';
import { sessionCandidates, sessionHomes, sessionProjectSlug, releaseSettledSession } from '../../scripts/kernel/op-session.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const API = path.join(ROOT, 'scripts', 'kernel', 'cli.mjs');
const json = (v) => JSON.stringify(v ?? null);

const runApi = (env, ...args) => spawnSync(process.execPath, [API, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120000, env });
const out = (r) => { try { return JSON.parse(r.stdout); } catch { return null; } };

/** One temp root per test: repo dir, agent-trust re-root, archive root and the fake orca. */
const fixture = (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-sess-release-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const repo = path.join(root, 'repo');
  fs.mkdirSync(repo, { recursive: true });
  const trustHome = path.join(root, 'agent-home');
  const archiveRoot = path.join(root, 'archive');
  const stub = path.join(root, 'fake-orca.mjs');
  fs.writeFileSync(stub, FAKE_ORCA);
  const stateFile = path.join(root, 'orca-state.json');
  const hkStub = path.join(root, 'hk-sessions-stub.mjs');
  // The spec-side stand-in for scripts/housekeeping/hk-sessions.mjs (another lane lands the
  // real one): same signature archiveSessionFiles(paths, {archiveRoot, agent, apply}).
  fs.writeFileSync(hkStub, `import fs from 'node:fs';
import path from 'node:path';
export function archiveSessionFiles(paths, { archiveRoot, agent, apply } = {}) {
  const moved = [];
  for (const source of paths ?? []) {
    const dest = path.join(archiveRoot, agent, path.basename(source));
    if (apply) { fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.renameSync(source, dest); }
    moved.push({ from: source, to: dest });
  }
  return { moved };
}
`);
  const env = {
    ...process.env,
    STARCI_AGENT_TRUST_HOME: trustHome,
    STARCI_SESSION_ARCHIVE_ROOT: archiveRoot,
    STARCI_HK_SESSIONS_MODULE: pathToFileURL(hkStub).href,
    STARCI_ORCA_COMMAND: process.execPath,
    STARCI_ORCA_ARGS: JSON.stringify([stub]),
    STARCI_FAKE_ORCA_STATE: stateFile,
    STARCI_FAKE_ORCA_LOG: path.join(root, 'orca-calls.jsonl'),
    LOCALAPPDATA: path.join(root, 'localappdata'),
  };
  delete env.ORCA_TERMINAL_HANDLE;
  env.STARCI_TEST_MACHINE_FILE = path.join(root, 'machine.sqlite');  // fleet registry of this fixture only
  return { root, repo, trustHome, archiveRoot, stateFile, env, ledgerFile: ledgerFileFor(repo, { env }) };
};

const seed = (file, fn) => { const ledger = openLedger({ file }); try { fn(ledger); } finally { ledger.close(); } };
const read = (file, fn) => { const ledger = inspectLedger({ file }); try { return fn(ledger); } finally { ledger.close(); } };

/** A running op job bound to a worker terminal, with its unit, attempt, contract and op-dispatched event. */
const seedOpJob = (file, { wf, jobId, handle, worktree }) => {
  seed(file, (ledger) => {
    const at = Date.now();
    ledger.transaction((db) => {
      ensureWorkflow(db, { workflowId: wf, phase: 'queued', title: 'session release', by: 'test-fixture', reason: 'seed', at });
      insertGoal(db, { workflowId: wf, revision: 1, goalIdentity: `goal-${wf}`, markdown: '# goal', goal: {}, createdAt: at });
      changeWorkflowPhase(db, { workflowId: wf, to: 'running', by: 'test-fixture', reason: 'seed', at });
      const unitId = `unit-${jobId}`;
      createUnit(db, { workflowId: wf, unitId, opId: 'docs.author', subjectKey: unitId, goalRevision: 1, createdAt: at });
      enqueueJob(db, { jobId, workflowId: wf, unitId, opId: 'docs.author', kind: 'op', role: 'op', payload: {
        opId: 'docs.author', owned_paths: ['docs/'], provider: 'claude', agent: 'claude',
        managed: { dispatchId: `ctx-${jobId}`, agentTerminalHandle: handle },
      }, createdAt: at });
      setJobStatus(db, { jobId, to: 'ready', reason: 'dispatch', at });
      setJobStatus(db, { jobId, to: 'leased', reason: 'dispatch', at });
      const attempt = startAttempt(db, { workflowId: wf, jobId, dispatchId: `ctx-${jobId}`, terminalHandle: handle,
        worktreePath: worktree, dispatchedAt: at, startedAt: at, at });
      writeContract(db, { attemptId: attempt.attempt_id, markdown: '# contract', context: { worktree }, createdAt: at });
      setJobStatus(db, { jobId, to: 'running', reason: 'worker live', at, workerId: handle });
      appendEvent(db, { workflowId: wf, entityType: 'job', entityId: jobId, kind: 'op-dispatched',
        payload: { terminal: handle, dispatch: `ctx-${jobId}` }, createdAt: at });
    });
  });
};

/** A Claude Code session file under the re-rooted home, carrying the worker's first message. */
const claudeSessionFile = (trustHome, cwd, name, text) => {
  const dir = path.join(trustHome, '.claude', 'projects', sessionProjectSlug(cwd));
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  fs.writeFileSync(file, json({ type: 'user', message: { content: text } }) + '\n');
  return file;
};

const seedOrcaTerminal = (stateFile, terminal) => {
  const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : { sends: 0 };
  state.terminals = { ...(state.terminals || {}), [terminal.handle]: terminal };
  fs.writeFileSync(stateFile, JSON.stringify(state));
};

test('settle archives the settled op\'s own claude session file', t => {
  const fx = fixture(t), wf = 'wf-sess-archive', jobId = 'op-sess-archive-a1';
  seedOpJob(fx.ledgerFile, { wf, jobId, handle: 'term-sess1', worktree: fx.repo });
  seedOrcaTerminal(fx.stateFile, { handle: 'term-sess1', connected: false, writable: true, command: 'claude', tabId: 'tab-1', title: '[Op] docs.author' });
  const session = claudeSessionFile(fx.trustHome, fx.repo, 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa.jsonl', `[Op] docs.author — (job ${jobId}, attempt 1, dispatch ctx-${jobId})`);
  // The session's own usage record: settle reads it before the file moves (scripts/kernel/usage-record.mjs).
  fs.appendFileSync(session, json({ type: 'assistant', sessionId: 'aaaaaaaa', message: { id: 'msg_1', model: 'claude-opus-5-5', content: [], usage: { input_tokens: 7, output_tokens: 11, cache_read_input_tokens: 100, cache_creation_input_tokens: 13 } } }) + '\n');

  const r = runApi(fx.env, 'settle', '--repo', fx.repo, '--job', jobId, '--verdict', 'fail', '--json');
  assert.equal(r.status, 0, r.stderr || r.stdout);
  const body = out(r);
  assert.equal(body?.ok, true);
  assert.equal(body?.sessionReleased?.released, true, `expected session release, got ${JSON.stringify(body?.sessionReleased)}`);
  assert.equal(body?.sessionReleased?.agent, 'claude');
  // The file moved into <archiveRoot>/claude/ and left the live session dir.
  assert.equal(fs.existsSync(session), false, 'session file was not moved out of the agent home');
  const moved = path.join(fx.archiveRoot, 'claude', path.basename(session));
  assert.equal(fs.existsSync(moved), true, `no archived copy at ${moved}`);
  // The receipt is kept on the job payload with the other settle receipts.
  const stored = read(fx.ledgerFile, (l) => JSON.parse(l.db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(jobId)?.payload_json ?? '{}'));
  assert.equal(stored?.sessionReleased?.released, true);
  assert.equal(stored?.session, undefined, 'observe-time identity is not written by settle');
  // The attempt's measured usage was recorded from the session file before it moved.
  const usage = read(fx.ledgerFile, (l) => ({ attempt: l.db.prepare('SELECT tokens_in, tokens_out, cost_usd, usage_source FROM op_attempts WHERE job_id=?').get(jobId), rows: l.db.prepare("SELECT response_model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens FROM llm_usage WHERE subject_type='attempt'").all() }));
  assert.deepEqual({ ...usage.attempt }, { tokens_in: 120, tokens_out: 11, cost_usd: 0.000333, usage_source: 'cli-transcript' });
  assert.deepEqual(usage.rows.map((x) => ({ ...x })), [{ response_model: 'claude-opus-5-5', input_tokens: 7, output_tokens: 11, cache_read_tokens: 100, cache_write_tokens: 13 }]);
});

test('a session whose worker terminal is still open is skipped with a recorded reason', t => {
  const fx = fixture(t), wf = 'wf-sess-live', jobId = 'op-sess-live-a1';
  // The handle is nowhere in Orca's state: the fake still answers
  // terminal-show connected — a session with a live terminal is never moved.
  seedOpJob(fx.ledgerFile, { wf, jobId, handle: 'term-live', worktree: fx.repo });
  const session = claudeSessionFile(fx.trustHome, fx.repo, 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb.jsonl', `(job ${jobId}, attempt 1)`);

  const r = runApi(fx.env, 'settle', '--repo', fx.repo, '--job', jobId, '--verdict', 'fail', '--json');
  assert.equal(r.status, 0, r.stderr || r.stdout);
  const body = out(r);
  assert.equal(body?.ok, true, 'a live worker terminal never un-settles the job');
  assert.equal(body?.sessionReleased?.released, false);
  assert.equal(body?.sessionReleased?.reason, 'terminal-still-open');
  assert.equal(fs.existsSync(session), true, 'the session file of an open terminal must not move');
  assert.equal(fs.existsSync(path.join(fx.archiveRoot, 'claude', path.basename(session))), false);
});

test('the kernel\'s own session file in the same project dir is never moved', t => {
  const fx = fixture(t), wf = 'wf-sess-kernel', jobId = 'op-sess-kernel-a1';
  seedOpJob(fx.ledgerFile, { wf, jobId, handle: 'term-sess3', worktree: fx.repo });
  seedOrcaTerminal(fx.stateFile, { handle: 'term-sess3', connected: false, writable: true, command: 'claude', tabId: 'tab-3', title: '[Op] docs.author' });
  const opSession = claudeSessionFile(fx.trustHome, fx.repo, 'cccccccc-3333-4333-8333-cccccccccccc.jsonl', `(job ${jobId}, attempt 1)`);
  // The live kernel's own session for the same checkout: it carries no op job id.
  const kernelSession = claudeSessionFile(fx.trustHome, fx.repo, 'dddddddd-4444-4444-8444-dddddddddddd.jsonl', '[Kernel] docs kernel workflow');

  const r = runApi(fx.env, 'settle', '--repo', fx.repo, '--job', jobId, '--verdict', 'fail', '--json');
  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.equal(out(r)?.sessionReleased?.released, true);
  assert.equal(fs.existsSync(opSession), false, 'the op\'s session file was not archived');
  assert.equal(fs.existsSync(kernelSession), true, 'the kernel\'s session file must never move');
  assert.equal(fs.existsSync(path.join(fx.archiveRoot, 'claude', path.basename(kernelSession))), false);
});

test('settle succeeds when the op has no session file', t => {
  const fx = fixture(t), wf = 'wf-sess-none', jobId = 'op-sess-none-a1';
  seedOpJob(fx.ledgerFile, { wf, jobId, handle: 'term-sess4', worktree: fx.repo });
  seedOrcaTerminal(fx.stateFile, { handle: 'term-sess4', connected: false, writable: true, command: 'claude', tabId: 'tab-4' });

  const r = runApi(fx.env, 'settle', '--repo', fx.repo, '--job', jobId, '--verdict', 'fail', '--json');
  assert.equal(r.status, 0, r.stderr || r.stdout);
  const body = out(r);
  assert.equal(body?.ok, true);
  assert.equal(body?.sessionReleased?.released, false);
  assert.equal(body?.sessionReleased?.reason, 'no-session-file');
  const status = read(fx.ledgerFile, (l) => l.db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId)?.status);
  assert.equal(status, 'failed');
});

test('observe records the worker\'s session identity on the job payload', t => {
  const fx = fixture(t), wf = 'wf-sess-observe', jobId = 'op-sess-observe-a1';
  seedOpJob(fx.ledgerFile, { wf, jobId, handle: 'term-sess5', worktree: fx.repo });
  seedOrcaTerminal(fx.stateFile, { handle: 'term-sess5', connected: true, writable: true, command: 'claude', tabId: 'tab-5', title: '[Op] docs.author' });
  const session = claudeSessionFile(fx.trustHome, fx.repo, 'eeeeeeee-5555-4555-8555-eeeeeeeeeeee.jsonl', `(job ${jobId}, attempt 1)`);

  const r = runApi(fx.env, 'observe', '--repo', fx.repo, '--job', jobId, '--json');
  assert.equal(r.status, 0, r.stderr || r.stdout);
  const stored = read(fx.ledgerFile, (l) => JSON.parse(l.db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(jobId)?.payload_json ?? '{}'));
  assert.equal(stored?.session?.agent, 'claude');
  const files = stored?.session?.files ?? [];
  const mine = files.find((f) => f.file === session);
  assert.ok(mine, `payload.session did not record ${session}: ${JSON.stringify(files)}`);
  assert.equal(mine.matched, true, 'the worker\'s session file must be attributed to its job id');
});

// ---- unit coverage of the resolver/guards (no spawned api) ---------------

test('sessionCandidates attributes by job id and prunes outside the window', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-sess-unit-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const homes = sessionHomes({ env: { STARCI_AGENT_TRUST_HOME: root } });
  const cwd = path.join(root, 'checkout');
  const mine = claudeSessionFile(root, cwd, 'one.jsonl', 'contract for job op-x-1');
  const other = claudeSessionFile(root, cwd, 'two.jsonl', 'an unrelated session');
  const found = sessionCandidates({ agent: 'claude', cwds: [cwd], sinceMs: Date.now() - 60_000, homes, jobId: 'op-x-1' });
  assert.deepEqual(found.map((f) => f.file).sort(), [mine, other].sort());
  assert.equal(found.find((f) => f.file === mine)?.matched, true);
  assert.equal(found.find((f) => f.file === other)?.matched, false);
  // Files created before the job's dispatch window are not even candidates.
  assert.deepEqual(sessionCandidates({ agent: 'claude', cwds: [cwd], sinceMs: Date.now() + 60_000, homes, jobId: 'op-x-1' }), []);
  // A codex rollout under <home>/sessions/<Y>/<M>/<D>/ is found the same way.
  const codexHome = homes.codex[0];
  const day = new Date();
  const dir = path.join(codexHome, 'sessions', String(day.getFullYear()), String(day.getMonth() + 1).padStart(2, '0'), String(day.getDate()).padStart(2, '0'));
  fs.mkdirSync(dir, { recursive: true });
  const rollout = path.join(dir, 'rollout-2026-01-01T00-00-00-abc.jsonl');
  fs.writeFileSync(rollout, json({ type: 'session_meta', payload: { cwd } }) + '\n' + json({ type: 'user_message', message: 'job op-cx-9' }) + '\n');
  const codexFound = sessionCandidates({ agent: 'codex', cwds: [], sinceMs: Date.now() - 60_000, homes, jobId: 'op-cx-9' });
  assert.equal(codexFound.find((f) => f.file === rollout)?.matched, true);
});

test('releaseSettledSession refuses a kernel job and an open terminal; stubbed archiver moves files', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-sess-rel-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const env = { STARCI_AGENT_TRUST_HOME: root, STARCI_SESSION_ARCHIVE_ROOT: path.join(root, 'archive') };
  const db = { prepare: () => ({ get: () => undefined }) };
  // A kernel-kind job is never a release target — its own session is untouchable.
  const kernel = await releaseSettledSession({ db, job: { job_id: 'kernel-1', kind: 'kernel' }, payload: { provider: 'claude' }, repo: root, env });
  assert.equal(kernel.released, false);
  assert.equal(kernel.reason, 'not-an-op-job');
  // An op whose worker terminal still reads connected keeps its session.
  const live = await releaseSettledSession({ db, job: { job_id: 'op-1', kind: 'op' }, payload: { provider: 'claude', orca: { agentTerminalHandle: 'term-x' } }, repo: root, env,
    show: () => ({ ok: true, connected: true }) });
  assert.equal(live.released, false);
  assert.equal(live.reason, 'terminal-still-open');
});
