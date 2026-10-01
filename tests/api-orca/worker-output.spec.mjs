import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { workerOutput, messageText, SOURCE_CHANGED } from '../../scripts/api/orca/worker-read.mjs';
import { readWorkerOutput, snapshotOpenAttempts, snapshotSeats, finalizeAttemptTranscript, outputHeader } from '../../scripts/kernel/transcripts.mjs';
import { closeOperationTerminal } from '../../scripts/kernel/close-op-terminal.mjs';
import { openLedger, ledgerFileFor } from '../../engine/db/ledger.mjs';
import { withMachine } from '../../engine/db/machine.mjs';
import { seedWorkflow } from '../helpers/ledger-fixture.mjs';

// Deep map T1 (REPLACE): every worker's output is read by Dispatch through worker-read, paged by its cursor, never
// by scraping the terminal. These specs pin the paging (cursor followed until a page is empty, source_changed
// restarts once without the cursor), the completeness verdict (contentComplete is true only when every page said
// so; clipping is kept), and the transcript sink (blob store + redaction) reading by Dispatch for op attempts and
// for Kernel/Supervisor seats. No live Orca: `read` is an injected one-page worker-read.

const page = (rows, { cursor = null, contentComplete = true, clipping = [], source = 'transcript', ok = true, errorCode = null } = {}) => ({
  ok, source: ok ? source : null, rows, draft: null, cursor, contentComplete, clipping, warnings: [], fallbackReason: null, archived: false,
  sourceChanged: errorCode === SOURCE_CHANGED, errorCode, error: errorCode, hostUnavailable: false,
});
/** A scripted worker-read: answers[i] for the i-th call; records every call. */
const scripted = (answers) => {
  const calls = [];
  const read = (args) => { calls.push(args); return answers[Math.min(calls.length - 1, answers.length - 1)]; };
  return { read, calls };
};

test('workerOutput follows the cursor until a page is empty and joins the pages in order', () => {
  const { read, calls } = scripted([page(['a', 'b'], { cursor: 'c1' }), page(['c'], { cursor: 'c2' }), page([], { cursor: 'c2' })]);
  const out = workerOutput({ dispatch: 'ctx-1', read });
  assert.equal(out.ok, true);
  assert.deepEqual(out.rows, ['a', 'b', 'c']);
  assert.deepEqual(calls.map((c) => c.cursor), [null, 'c1', 'c2'], 'the first read has no cursor; each next read passes the cursor unchanged');
  assert.ok(calls.every((c) => c.dispatch === 'ctx-1' && c.source === 'auto'), 'read by Dispatch with source auto');
  assert.equal(out.contentComplete, true);
  assert.equal(out.pages, 3);
});

test('workerOutput keeps Orca\'s completeness verdict: one clipped page makes the whole read incomplete', () => {
  const { read } = scripted([page(['tail'], { cursor: 'eof', contentComplete: false, clipping: ['terminal_buffer'], source: 'terminal' }), page([], { cursor: 'eof' })]);
  const out = workerOutput({ dispatch: 'ctx-2', read });
  assert.equal(out.ok, true);
  assert.equal(out.contentComplete, false);
  assert.deepEqual(out.clipping, ['terminal_buffer']);
  assert.equal(out.source, 'terminal');
});

test('workerOutput restarts once without the cursor on source_changed and keeps only the fresh read', () => {
  const { read, calls } = scripted([
    page(['old'], { cursor: 'c1' }), page([], { ok: false, errorCode: SOURCE_CHANGED }),
    page(['new-1'], { cursor: 'n1' }), page([], { cursor: 'n1' }),
  ]);
  const out = workerOutput({ dispatch: 'ctx-3', read });
  assert.equal(out.ok, true);
  assert.equal(out.restarted, true);
  assert.deepEqual(out.rows, ['new-1'], 'rows read under the old source are dropped');
  assert.deepEqual(calls.map((c) => c.cursor), [null, 'c1', null, 'n1']);
});

test('workerOutput: a first page that fails is the failure; a later failure keeps what was read, marked read_failed', () => {
  const failed = workerOutput({ dispatch: 'ctx-4', read: scripted([page([], { ok: false, errorCode: 'dispatch_not_found' })]).read });
  assert.equal(failed.ok, false);
  assert.equal(failed.errorCode, 'dispatch_not_found');
  const partial = workerOutput({ dispatch: 'ctx-5', read: scripted([page(['x'], { cursor: 'c1' }), page([], { ok: false, errorCode: 'runtime_timeout' })]).read });
  assert.equal(partial.ok, true);
  assert.deepEqual(partial.rows, ['x']);
  assert.equal(partial.contentComplete, false);
  assert.ok(partial.clipping.includes('read_failed'));
});

test('workerOutput stops at the page cap and says so', () => {
  let n = 0;
  const read = () => { n += 1; return page([`row ${n}`], { cursor: `c${n}` }); };
  const out = workerOutput({ dispatch: 'ctx-6', read, maxPages: 3 });
  assert.equal(out.pages, 3);
  assert.equal(out.contentComplete, false);
  assert.ok(out.clipping.includes('page_cap'));
});

test('messageText renders a transcript message as Orca\'s CLI prints it', () => {
  assert.equal(messageText({ role: 'assistant', blocks: [{ type: 'text', text: 'hello' }, { type: 'tool-call', name: 'Bash', input: { command: 'ls' } }] }),
    '[assistant] hello\n[tool Bash] {"command":"ls"}');
  assert.equal(messageText({ role: 'tool', blocks: [{ type: 'tool-result', isError: true, output: 'boom' }, { type: 'image-ref' }] }),
    '[tool] [tool result error] boom\n[image omitted]');
});

test('readWorkerOutput heads the text with the completeness verdict and returns null without a Dispatch', () => {
  assert.equal(readWorkerOutput(null), null);
  const got = readWorkerOutput('ctx-7', { read: scripted([page(['one'], { cursor: 'e', contentComplete: false, clipping: ['terminal_fallback'], source: 'terminal' }), page([])]).read });
  assert.equal(got.contentComplete, false);
  assert.match(got.text.split('\n')[0], /^\[worker-read dispatch=ctx-7 source=terminal contentComplete=false clipping=terminal_fallback\]$/);
  assert.equal(got.text.split('\n')[1], 'one');
  assert.equal(outputHeader({ dispatch: 'd', source: 'transcript', contentComplete: true }), '[worker-read dispatch=d source=transcript contentComplete=true]');
});

const sandbox = (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-worker-output-'));
  const prior = { art: process.env.STARCI_ARTIFACT_ROOT, machine: process.env.STARCI_TEST_MACHINE_FILE };
  process.env.STARCI_ARTIFACT_ROOT = path.join(root, 'artifacts');
  process.env.STARCI_TEST_MACHINE_FILE = path.join(root, 'machine.sqlite');
  t.after(() => {
    for (const [k, v] of [['STARCI_ARTIFACT_ROOT', prior.art], ['STARCI_TEST_MACHINE_FILE', prior.machine]]) if (v === undefined) delete process.env[k]; else process.env[k] = v;
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
  });
  const repo = path.join(root, 'repo'); fs.mkdirSync(repo, { recursive: true });
  return { root, repo };
};

test('snapshotOpenAttempts reads each open attempt by its job\'s Dispatch and stores the redacted output once', (t) => {
  const { repo } = sandbox(t);
  const ledger = openLedger({ file: ledgerFileFor(repo) });
  t.after(() => ledger.close());
  seedWorkflow(ledger, { id: 'wf-out', jobs: [{ jobId: 'op-out', opId: 'ex-test.probe', status: 'running', dispatchId: 'ctx-out', workerId: 'term-out', terminalHandle: 'term-out',
    payload: { opId: 'ex-test.probe', managed: { dispatchId: 'ctx-out', agentTerminalHandle: 'term-out' } } }] });
  const { read, calls } = scripted([page(['working on it'], { cursor: 'e' }), page([])]);
  const first = snapshotOpenAttempts(ledger, { read, now: 1_000_000 });
  assert.deepEqual({ checked: first.checked, written: first.written, unreadable: first.unreadable }, { checked: 1, written: 1, unreadable: 0 });
  assert.ok(calls.every((c) => c.dispatch === 'ctx-out'), 'read by the job\'s Dispatch, never by the terminal handle');
  const again = snapshotOpenAttempts(ledger, { read: scripted([page(['working on it'], { cursor: 'e' }), page([])]).read, now: 1_000_000 + 120_000 });
  assert.equal(again.unchanged, 1, 'an unchanged output adds no row');
  const unreadable = snapshotOpenAttempts(ledger, { read: scripted([page([], { ok: false, errorCode: 'dispatch_not_found' })]).read, now: 1_000_000 + 240_000 });
  assert.equal(unreadable.unreadable, 1);
});

test('finalizeAttemptTranscript reads a released worker by Dispatch into op_attempts.transcript_sha', (t) => {
  const { repo } = sandbox(t);
  const ledger = openLedger({ file: ledgerFileFor(repo) });
  t.after(() => ledger.close());
  seedWorkflow(ledger, { id: 'wf-fin', jobs: [{ jobId: 'op-fin', opId: 'ex-test.probe', status: 'running', dispatchId: 'ctx-fin', workerId: 'term-fin', terminalHandle: 'term-fin',
    payload: { opId: 'ex-test.probe', managed: { dispatchId: 'ctx-fin' } } }] });
  const attemptId = ledger.db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=?').get('op-fin').attempt_id;
  const { read, calls } = scripted([page(['done'], { cursor: 'e' }), page([])]);
  const sha = finalizeAttemptTranscript(ledger, { attemptId, dispatch: 'ctx-fin', read });
  assert.match(String(sha), /^[0-9a-f]{64}$/);
  assert.equal(ledger.db.prepare('SELECT transcript_sha FROM op_attempts WHERE attempt_id=?').get(attemptId).transcript_sha, sha);
  assert.equal(calls[0].dispatch, 'ctx-fin');
  assert.equal(finalizeAttemptTranscript(ledger, { attemptId, dispatch: null }), null, 'no Dispatch, nothing read');
});

test('snapshotSeats reads every live seat by the Dispatch its record names', (t) => {
  sandbox(t);
  withMachine((m) => {
    m.upsertSeat({ seatId: 'supervisor', role: 'supervisor', state: 'live', terminalHandle: 'term-sup', detailJson: { token: 't', value: { terminal: 'term-sup', dispatch: 'ctx-sup' } } });
    const { read, calls } = scripted([page(['supervising'], { cursor: 'e' }), page([])]);
    const r = snapshotSeats(m, { read, now: 5_000_000 });
    assert.equal(r.written, 1);
    assert.equal(calls[0].dispatch, 'ctx-sup');
    m.upsertSeat({ seatId: 'supervisor', role: 'supervisor', state: 'live', terminalHandle: 'term-sup', detailJson: { token: 't', value: { terminal: 'term-sup' } } });
    const none = snapshotSeats(m, { read, now: 5_000_000 + 120_000 });
    assert.equal(none.unreadable, 1, 'a seat that names no Dispatch is not read through its terminal');
  });
});

test('closeOperationTerminal reads no output: the transcript is the caller\'s worker-read, not a terminal scrape', () => {
  const closed = closeOperationTerminal('term-x', { list: () => ({ ok: true, terminals: [{ handle: 'term-x', tabId: 'tab-x' }] }),
    close: () => ({ ok: true }), unbind: () => true });
  assert.equal(closed.ok, true);
  assert.equal('transcript' in closed, false);
});

test('a worker without a PTY reads unverified, never gone: terminal_unsupported_for_agent_session is no gone code', async () => {
  const { TERMINAL_GONE_CODES } = await import('../../scripts/api/orca/terminal-show.mjs');
  assert.equal(TERMINAL_GONE_CODES.has('terminal_unsupported_for_agent_session'), false);
  assert.equal(TERMINAL_GONE_CODES.has('terminal_handle_stale'), true);
});
