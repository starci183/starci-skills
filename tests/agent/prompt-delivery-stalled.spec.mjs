// A prompt Orca answered agent_prompt_stalled is proven from the frame, never counted delivered on the
// receipt (scripts/agent/lib.mjs deliverPrompt). Seen on a live defect (twice on one interface.draw op,
// three times on another): a fresh Codex took a stalled send, the frame showed it idle at
// "› Ask Codex to do anything" or a bare "›" whose input box Orca lifted out as `draft`, and dispatch
// waited 45s for a submission that could not come ("prompt was not consumed within 45000ms").
// A lost send is sent once more; lost again, the launch is refused prompt-delivery-stalled, a provider
// strike like an unclassified worker-start refusal (runtimes.yaml allocation.providerStrikes).
// On a host with prompt receipts (Orca 1.4.209, --wait-submit) turn_started proves the submit and a
// receipt without it is the stalled case; a host without receipts is refused at send (nothing typed).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { FAKE_ORCA } from '../helpers/fake-orca.mjs';
import { openLedger, inspectLedger, ledgerFileFor } from '../../engine/db/ledger.mjs';
import { openMachine, TEST_REGISTRY_ENV } from '../../engine/db/machine.mjs';
import { seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { deliverPrompt, loadAdapter, PROMPT_DELIVERY_STALLED, TERMINAL_INCARNATION_STALE } from '../../scripts/agent/lib.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
// The card's settle/attestation windows (~25s of pure waiting per dispatch) are counted logically; scale the real sleeps down (scripts/lib/sleep-sync.mjs).
process.env.STARCI_SLEEP_SCALE??='0.02';
// This spec is about dispatch delivery/liveness, not the host-contract listing (orca-call-contract covers it): left on,
// every mutation spawns the fake orca's agent-context under a 15s timeout that misses under full-suite load.
process.env.STARCI_ORCA_SKIP_LIVE_CHECK??='1';
const API = path.join(ROOT, 'scripts', 'kernel', 'cli.mjs');
const json = (text) => { try { return JSON.parse(text); } catch { return null; } };
const codex = loadAdapter('codex').card;
const PREAMBLE = 'Orca Task preamble: you are the operation agent for op-interface.draw. Read the contract with starci kernel op-contract.';
const HEADER = ['╭──────────────────────────────╮', '│ >_ OpenAI Codex (v0.155.1)   │', '╰──────────────────────────────╯',
  '  Tip: This is GPT-6, a new generation of intelligence.'];
const IDLE = [...HEADER, '› Ask Codex to do anything', `  gpt-6-sol high · ${path.join(os.tmpdir(), 'ecommerce-app')}`].join('\n');
const BARE = [...HEADER, '›', `  gpt-6-sol high · ${path.join(os.tmpdir(), 'ecommerce-app')}`].join('\n');
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

/* ------------------------------------------------------------ starci kernel dispatch */

const opFixture = (t, extra = {}) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-prompt-stalled-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  if(process.env.STARCI_TEST_TEMP_DIR)t.after(()=>fs.rmSync(path.join(process.env.STARCI_TEST_TEMP_DIR,'starci-job-scratch'),
    {recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const repo = path.join(root, 'repo'); fs.mkdirSync(repo, { recursive: true });fs.mkdirSync(path.join(repo,'docs'),{recursive:true});
  const stub = path.join(root, 'fake-orca.mjs'); fs.writeFileSync(stub, FAKE_ORCA);
  const stateFile = path.join(root, 'state.json'), logFile = path.join(root, 'calls.jsonl');
  // The provider-health circuit is a machine.sqlite row now (runtime signals only take
  // kernel|stop|launch|decision-doorbell): the dispatch subprocess and the spec read one isolated file.
  const machineFile = path.join(root, 'machine.sqlite');
  // Two dispatches of one workflow are two op_attempts rows: op_attempts is UNIQUE on
  // (workflow_id, dispatch_id) and the orchestration dispatch id is the terminal handle — a reused
  // fake-terminal-1 collides on the second job. UNIQUE_TERMINALS gives each launch its own handle.
  const env = { ...process.env, STARCI_ORCA_COMMAND: process.execPath, STARCI_ORCA_ARGS: JSON.stringify([stub]),
    STARCI_FAKE_ORCA_LOG: logFile, STARCI_FAKE_ORCA_STATE: stateFile, STARCI_FAKE_ORCA_PREAMBLE: PREAMBLE,
    STARCI_FAKE_ORCA_UNIQUE_TERMINALS: '1',
    [TEST_REGISTRY_ENV]: machineFile, ...extra };
  const workflowId = 'wf-prompt-stalled';
  const ledger = openLedger({ file: ledgerFileFor(repo) });
  try {
    for (const n of [1, 2]) fs.mkdirSync(path.join(repo, 'docs', `ps-${n}`), { recursive: true });
    seedWorkflow(ledger, { id: workflowId, jobs: [
      { jobId: `kernel-${workflowId}`, kind: 'kernel', role: 'kernel', status: 'running', workerId: 'fake-kernel-terminal',
        payload: { hierarchy: { schema: 'starci/agent-hierarchy@1', nodeId: `agent:kernel:${workflowId}`, parentNodeId: `workflow:${workflowId}`, role: 'kernel' } } },
      ...[1, 2].map((n) => ({ jobId: `job-ps-${n}`, opId: 'code.refactor',
        payload: { opId: 'code.refactor', owned_paths: [`docs/ps-${n}/`], model: 'codex-agent', difficulty: 'hard' } })),
    ] });
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
  return { dispatch, read, textSends, enterSends, machineFile };
};


/* ------------------------------------------------- the host's prompt receipt */
// Orca 1.4.209 answers a text+Enter prompt sent with --wait-submit with result.send.prompt: turn_started in
// its stages proves the submit, so the screen is not polled; a receipt with input_accepted alone is the
// stalled case and is proven from the frame. A host without receipts is refused at send.
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
