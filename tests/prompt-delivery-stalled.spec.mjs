// A prompt Orca answered agent_prompt_stalled is proven from the frame, never counted delivered on the
// receipt (scripts/agent/lib.mjs deliverPrompt). starci-next op-interface.draw-4d29c2beaf (twice) and
// -c3f0e8e174 (three times, 2026-09-25): a fresh Codex took a stalled send, the frame showed it idle at
// "› Ask Codex to do anything" or a bare "›" whose input box Orca lifted out as `draft`, and dispatch
// waited 45s for a submission that could not come ("prompt was not consumed within 45000ms").
// A lost send is sent once more; lost again, the launch is refused prompt-delivery-stalled, a provider
// strike like an unclassified worker-start refusal (runtimes.yaml allocation.providerStrikes).
// On a host with prompt receipts (Orca 1.4.209, --wait-submit) turn_started proves the submit and a
// receipt without it is the stalled case; an old host keeps the agent_prompt_stalled/screen path.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { FAKE_ORCA } from './helpers/fake-orca.mjs';
import { openLedger, inspectLedger, ledgerFileFor } from '../engine/ledger-db.mjs';
import { deliverPrompt, loadAdapter, PROMPT_DELIVERY_STALLED, TERMINAL_INCARNATION_STALE } from '../scripts/agent/lib.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const API = path.join(ROOT, 'scripts', 'kernel', 'api.mjs');
const json = (text) => { try { return JSON.parse(text); } catch { return null; } };
const codex = loadAdapter('codex').card;
const PREAMBLE = 'Orca Task preamble: you are the operation agent for op-interface.draw. Read the contract with api op-contract.';
const HEADER = ['╭──────────────────────────────╮', '│ >_ OpenAI Codex (v0.155.1)   │', '╰──────────────────────────────╯',
  '  Tip: This is GPT-6, a new generation of intelligence.'];
const IDLE = [...HEADER, '› Ask Codex to do anything', '  gpt-6-sol high · D:\\Repositories\\starci-next'].join('\n');
const BARE = [...HEADER, '›', '  gpt-6-sol high · D:\\Repositories\\starci-next'].join('\n');
const STALLED = { ok: false, errorCode: 'agent_prompt_stalled', error: 'agent_prompt_stalled' };

// A scripted terminal: `sends` answer in order; every read returns `frame()`.
const terminal = ({ sends, frame }) => {
  const log = { sends: [], reads: 0 };
  const io = {
    send: (call) => { log.sends.push(call); return sends[log.sends.length - 1] ?? { ok: true }; },
    read: () => { log.reads += 1; return { ok: true, ...frame(log) }; },
    sleep: () => {},
  };
  return { io, log };
};
const deliver = (io) => deliverPrompt({ handle: 'term_x', adapter: codex, prompt: PREAMBLE, worktree: null, io });

test('a stalled send into an empty input is re-delivered, not reported delivered', () => {
  const { io, log } = terminal({ sends: [STALLED, { ok: true }], frame: () => ({ screen: IDLE }) });
  const sent = deliver(io);
  assert.equal(sent.ok, true);
  assert.equal(sent.redelivered, true);
  assert.equal(log.sends.length, 2, 'the prompt is typed a second time');
  assert.deepEqual(log.sends.map((s) => [s.text, s.enter]), [[PREAMBLE, true], [PREAMBLE, true]]);
});

test('a prompt lost on the send and on its one re-delivery is refused prompt-delivery-stalled', () => {
  const { io, log } = terminal({ sends: [STALLED, STALLED], frame: () => ({ screen: IDLE }) });
  const sent = deliver(io);
  assert.equal(sent.ok, false, 'a stalled send is never delivered on the receipt');
  assert.equal(sent.failureKind, PROMPT_DELIVERY_STALLED);
  assert.equal(sent.transient, true);
  assert.match(sent.error, /^prompt-delivery-stalled: /);
  assert.equal(log.sends.length, 2, 'exactly one re-delivery');
  assert.match(sent.screen, /Ask Codex to do anything/, 'the refusal carries the frame it read');
});

test('a stalled send whose text sits in the input box, or whose turn began, is delivered once', () => {
  const inBox = terminal({ sends: [STALLED], frame: () => ({ screen: BARE, draft: '[Pasted Content 4812 chars]' }) });
  const boxed = deliver(inBox.io);
  assert.deepEqual([boxed.ok, boxed.stalled, boxed.redelivered, inBox.log.sends.length], [true, true, undefined, 1]);
  const typed = terminal({ sends: [STALLED], frame: () => ({ screen: BARE, draft: PREAMBLE }) });
  assert.deepEqual([deliver(typed.io).ok, typed.log.sends.length], [true, 1]);
  const working = terminal({ sends: [STALLED], frame: () => ({ screen: [...HEADER, `› ${PREAMBLE}`, '• Working (2s • esc to interrupt)', '› Ask Codex to do anything'].join('\n') }) });
  assert.deepEqual([deliver(working.io).ok, working.log.sends.length], [true, 1]);
  // A frame that repaints late: the first read is idle, the next shows the paste.
  const late = terminal({ sends: [STALLED], frame: (log) => (log.reads < 2 ? { screen: IDLE } : { screen: BARE, draft: '[Pasted Content 4812 chars]' }) });
  assert.deepEqual([deliver(late.io).ok, late.log.sends.length], [true, 1]);
});

test('awaitSubmission reads the input-box draft: a paste Orca lifted out of a bare "›" frame gets its Enter', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-draft-submission-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const stub = path.join(root, 'fake-orca.mjs'); fs.writeFileSync(stub, FAKE_ORCA);
  const stateFile = path.join(root, 'state.json');
  fs.writeFileSync(stateFile, JSON.stringify({ sends: 1, terminals: { 'fake-terminal-1': {
    handle: 'fake-terminal-1', connected: true, writable: true, command: 'codex', model: 'gpt-6-sol',
    sent: true, prompt: PREAMBLE, screen: BARE, draft: PREAMBLE, draftMode: 'drop-enter' } } }));
  const script = `import {awaitSubmission,loadAdapter} from ${JSON.stringify(pathToFileURL(path.join(ROOT, 'scripts', 'agent', 'lib.mjs')).href)};
    const card=loadAdapter('codex').card;
    console.log(JSON.stringify(awaitSubmission('fake-terminal-1',{...card,submission:{timeoutMs:1000,settleMs:250}},{sentText:${JSON.stringify(PREAMBLE)}})));`;
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 30000,
    env: { ...process.env, STARCI_ORCA_COMMAND: process.execPath, STARCI_ORCA_ARGS: JSON.stringify([stub]),
      STARCI_FAKE_ORCA_LOG: path.join(root, 'calls.jsonl'), STARCI_FAKE_ORCA_STATE: stateFile } });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const result = json(run.stdout.trim());
  assert.equal(result?.ok, true, result?.reason);
  assert.equal(result?.unstuckByEnter, true, 'the draft is the staged input row, submitted by its one Enter');
  assert.deepEqual(json(fs.readFileSync(stateFile, 'utf8')).terminals['fake-terminal-1'].submitted, [PREAMBLE]);
});

/* ------------------------------------------------------------ api dispatch */

const opFixture = (t, extra = {}) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-prompt-stalled-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const repo = path.join(root, 'repo'); fs.mkdirSync(repo, { recursive: true });
  const stub = path.join(root, 'fake-orca.mjs'); fs.writeFileSync(stub, FAKE_ORCA);
  const stateFile = path.join(root, 'state.json'), logFile = path.join(root, 'calls.jsonl');
  const env = { ...process.env, STARCI_ORCA_COMMAND: process.execPath, STARCI_ORCA_ARGS: JSON.stringify([stub]),
    STARCI_FAKE_ORCA_LOG: logFile, STARCI_FAKE_ORCA_STATE: stateFile, STARCI_FAKE_ORCA_PREAMBLE: PREAMBLE, ...extra };
  const workflowId = 'wf-prompt-stalled';
  const ledger = openLedger({ file: ledgerFileFor(repo) });
  try {
    ledger.enqueueJob({ jobId: `kernel-${workflowId}`, workflowId, kind: 'kernel', role: 'kernel',
      payload: { hierarchy: { schema: 'starci/agent-hierarchy@1', nodeId: `agent:kernel:${workflowId}`, parentNodeId: `workflow:${workflowId}`, role: 'kernel' } } });
    ledger.db.prepare("UPDATE jobs SET status='running',worker_id='fake-kernel-terminal' WHERE job_id=?").run(`kernel-${workflowId}`);
    for (const n of [1, 2])
      ledger.enqueueJob({ jobId: `job-ps-${n}`, workflowId, opId: 'code.refactor', kind: 'op',
        payload: { opId: 'code.refactor', owned_paths: [`docs/ps-${n}/`], model: 'codex-agent', difficulty: 'hard' } });
  } finally { ledger.close(); }
  const dispatch = (jobId) => spawnSync(process.execPath, [API, 'dispatch', '--repo', repo, '--job', jobId, '--model', 'codex-agent', '--spawn', '--json'],
    { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120000, env });
  const read = (fn) => { const l = inspectLedger({ file: ledgerFileFor(repo) }); try { return fn(l.db); } finally { l.close(); } };
  const textSends = () => fs.readFileSync(logFile, 'utf8').trim().split('\n').map(json)
    .filter((e) => e?.argv?.[0] === 'terminal' && e.argv[1] === 'send' && e.argv[e.argv.indexOf('--text') + 1]
      // an old host's refused --wait-submit call typed nothing
      && !(extra.STARCI_FAKE_ORCA_OLD_HOST === '1' && e.argv.includes('--wait-submit')));
  const enterSends = () => fs.readFileSync(logFile, 'utf8').trim().split('\n').map(json)
    .filter((e) => e?.argv?.[0] === 'terminal' && e.argv[1] === 'send' && e.argv.includes('--text') && e.argv[e.argv.indexOf('--text') + 1] === '');
  return { dispatch, read, textSends, enterSends };
};

test('dispatch on an old host: a Codex prompt lost once is re-delivered and the job runs', (t) => {
  const fx = opFixture(t, { STARCI_FAKE_ORCA_OLD_HOST: '1', STARCI_FAKE_ORCA_PROMPT_LOST: '1' });
  const r = fx.dispatch('job-ps-1');
  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.equal(fx.read((db) => db.prepare("SELECT status FROM jobs WHERE job_id='job-ps-1'").get().status), 'running');
  assert.equal(fx.textSends().length, 2, 'the preamble was typed twice: the lost send and its re-delivery');
});

test('dispatch on an old host: a Codex prompt lost twice is refused prompt-delivery-stalled at send, a provider strike, not a submission timeout', (t) => {
  const fx = opFixture(t, { STARCI_FAKE_ORCA_OLD_HOST: '1', STARCI_FAKE_ORCA_PROMPT_LOST: '2' });
  const health = () => fx.read((db) => json(db.prepare("SELECT value_json FROM signals WHERE scope='provider-health' AND key='codex'").get()?.value_json ?? 'null'));
  const first = fx.dispatch('job-ps-1');
  assert.notEqual(first.status, 0);
  const [rejected] = fx.read((db) => db.prepare("SELECT payload_json FROM events WHERE entity_id='job-ps-1' AND kind='dispatch-rejected'").all()).map((e) => json(e.payload_json));
  assert.deepEqual([rejected?.step, rejected?.signal], ['send', PROMPT_DELIVERY_STALLED]);
  assert.match(rejected?.screenTail ?? '', /Ask Codex to do anything/);
  assert.equal(fx.textSends().length, 2);
  assert.equal(fx.read((db) => db.prepare("SELECT status FROM jobs WHERE job_id='job-ps-1'").get().status), 'queued', 'no effect: the attempt is reusable');
  assert.equal(rejected?.providerHealth, null, 'one lost prompt is a strike, not an outage');
  assert.deepEqual([health()?.status, health()?.failureKind, health()?.failures], ['striking', PROMPT_DELIVERY_STALLED, 1]);
  const second = fx.dispatch('job-ps-2');
  assert.notEqual(second.status, 0);
  assert.equal(json(second.stdout)?.rejection?.providerHealth?.failureKind, PROMPT_DELIVERY_STALLED, 'the repeat opens the codex circuit');
  assert.deepEqual([health()?.status, health()?.failures], ['unavailable', 2]);
});

/* ------------------------------------------------- the host's prompt receipt */
// Orca 1.4.209 answers a text+Enter prompt sent with --wait-submit with result.send.prompt: turn_started in
// its stages proves the submit, so the screen is not polled; a receipt with input_accepted alone is the
// stalled case and is proven from the frame. A host without receipts (old-host) keeps the screen path.
const RECEIPT = (stages, extra = {}) => ({ ok: true, submitted: stages.includes('turn_started'),
  prompt: { requestId: 'req-1', stages, provider: 'codex', observation: 'supported', processIncarnation: 'inc-1', ...extra } });

test('receipt: turn_started proves the submit with one observed send and no screen read', () => {
  const { io, log } = terminal({ sends: [RECEIPT(['input_accepted', 'turn_started'])], frame: () => ({ screen: IDLE }) });
  const sent = deliver(io);
  assert.deepEqual([sent.ok, sent.submitted, log.sends.length, log.reads], [true, true, 1, 0]);
  assert.equal(log.sends[0].waitSubmit, 45, 'observed for the card submission window (codex: the 45s default)');
});

test('receipt: input accepted with no turn start into an empty input is re-delivered, lost twice refused', () => {
  const once = terminal({ sends: [RECEIPT(['input_accepted']), RECEIPT(['input_accepted', 'turn_started'])], frame: () => ({ screen: IDLE }) });
  const sent = deliver(once.io);
  assert.deepEqual([sent.ok, sent.submitted, sent.redelivered, once.log.sends.length], [true, true, true, 2]);
  const twice = terminal({ sends: [RECEIPT(['input_accepted']), RECEIPT(['input_accepted'])], frame: () => ({ screen: IDLE }) });
  const refused = deliver(twice.io);
  assert.deepEqual([refused.ok, refused.failureKind, twice.log.sends.length], [false, PROMPT_DELIVERY_STALLED, 2]);
  // The text in the input box (the Enter swallowed): delivered once; awaitSubmission gives the Enter.
  const boxed = terminal({ sends: [RECEIPT(['input_accepted'])], frame: () => ({ screen: BARE, draft: PREAMBLE }) });
  assert.deepEqual([deliver(boxed.io).ok, boxed.log.sends.length], [true, 1]);
});

test('receipt: an old host, a permission prompt and a stale incarnation are never re-delivered', () => {
  const old = terminal({ sends: [{ ok: true, prompt: { requestId: 'unsupported-old-host', stages: ['input_accepted'], provider: 'old-host', observation: 'unsupported' } }],
    frame: () => ({ screen: IDLE }) });
  assert.deepEqual([deliver(old.io).ok, old.log.sends.length, old.log.reads], [true, 1, 0], 'old-host: the screen path (awaitSubmission) proves it');
  const permission = terminal({ sends: [RECEIPT(['input_accepted'], { observation: 'permission' })], frame: () => ({ screen: IDLE }) });
  assert.deepEqual([deliver(permission.io).ok, permission.log.sends.length], [true, 1]);
  const stale = terminal({ sends: [{ ok: false, errorCode: 'terminal_not_writable', staleIncarnation: true }], frame: () => ({ screen: IDLE }) });
  const refused = deliver(stale.io);
  assert.deepEqual([refused.ok, refused.failureKind, refused.transient, stale.log.sends.length], [false, TERMINAL_INCARNATION_STALE, false, 1]);
  const replaced = terminal({ sends: [RECEIPT(['input_accepted'], { observation: 'incarnation_replaced' })], frame: () => ({ screen: IDLE }) });
  assert.equal(deliver(replaced.io).failureKind, TERMINAL_INCARNATION_STALE);
});

test('dispatch on a receipt host: a lost prompt is re-delivered with --wait-submit and the screen is never polled for Enter', (t) => {
  const fx = opFixture(t, { STARCI_FAKE_ORCA_PROMPT_RECEIPT: '1', STARCI_FAKE_ORCA_PROMPT_LOST: '1' });
  const r = fx.dispatch('job-ps-1');
  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.equal(fx.read((db) => db.prepare("SELECT status FROM jobs WHERE job_id='job-ps-1'").get().status), 'running');
  const sends = fx.textSends();
  assert.equal(sends.length, 2);
  assert.ok(sends.every((s) => s.argv.includes('--wait-submit')), 'every prompt send asks the host to observe it');
  assert.equal(fx.enterSends().length, 0, 'turn_started proved the submit: no Enter-only send');
});

test('dispatch on a receipt host: a prompt lost twice is refused prompt-delivery-stalled', (t) => {
  const fx = opFixture(t, { STARCI_FAKE_ORCA_PROMPT_RECEIPT: '1', STARCI_FAKE_ORCA_PROMPT_LOST: '2' });
  assert.notEqual(fx.dispatch('job-ps-1').status, 0);
  const [rejected] = fx.read((db) => db.prepare("SELECT payload_json FROM events WHERE entity_id='job-ps-1' AND kind='dispatch-rejected'").all()).map((e) => json(e.payload_json));
  assert.deepEqual([rejected?.step, rejected?.signal], ['send', PROMPT_DELIVERY_STALLED]);
});

test('terminal send: terminal_not_writable on a terminal Orca shows writable is a stale incarnation', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-stale-incarnation-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const stub = path.join(root, 'fake-orca.mjs'); fs.writeFileSync(stub, FAKE_ORCA);
  const stateFile = path.join(root, 'state.json');
  fs.writeFileSync(stateFile, JSON.stringify({ sends: 0, terminals: { 'fake-terminal-1': {
    handle: 'fake-terminal-1', connected: true, writable: true, command: 'codex', staleIncarnation: true } } }));
  const script = `import {terminalSend} from ${JSON.stringify(pathToFileURL(path.join(ROOT, 'scripts', 'api', 'orca', 'terminal-send.mjs')).href)};
    console.log(JSON.stringify(terminalSend({terminal:'fake-terminal-1',text:'hello there',enter:true})));`;
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 30000,
    env: { ...process.env, STARCI_ORCA_COMMAND: process.execPath, STARCI_ORCA_ARGS: JSON.stringify([stub]),
      STARCI_FAKE_ORCA_LOG: path.join(root, 'calls.jsonl'), STARCI_FAKE_ORCA_STATE: stateFile } });
  const sent = json(run.stdout.trim());
  assert.deepEqual([sent?.ok, sent?.errorCode, sent?.staleIncarnation], [false, 'terminal_not_writable', true]);
});
