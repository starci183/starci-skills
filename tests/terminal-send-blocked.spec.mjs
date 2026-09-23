import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FAKE_ORCA } from './helpers/fake-orca.mjs';

// Orca typed supervisor notices and watchdog wakes into the idle Codex kernels
// but refused the Enter sent with them (agent_prompt_blocked); every one sat
// unsubmitted until an Enter-only send. terminalSend now follows up once.
test('agent_prompt_blocked is followed by one Enter-only send that submits the typed text', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-send-blocked-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const stub = path.join(root, 'fake-orca.mjs'); fs.writeFileSync(stub, FAKE_ORCA);
  const stateFile = path.join(root, 'state.json');
  fs.writeFileSync(stateFile, JSON.stringify({ sends: 0, terminals: { 'k-1': { handle: 'k-1', title: '[Kernel] wf' } } }));
  const saved = { ...process.env };
  t.after(() => { process.env = saved; });
  Object.assign(process.env, { STARCI_ORCA_COMMAND: process.execPath, STARCI_ORCA_ARGS: JSON.stringify([stub]),
    STARCI_FAKE_ORCA_STATE: stateFile, STARCI_FAKE_ORCA_LOG: path.join(root, 'calls.jsonl'), STARCI_FAKE_ORCA_STUCK_PASTE: 'blocked' });
  // The Orca wrappers resolve the host binary once per process: load after the env is set.
  const { terminalSend } = await import('../scripts/api/orca/terminal-send.mjs');
  const r = terminalSend({ terminal: 'k-1', text: 'Supervisor: wake up', enter: true });
  assert.equal(r.ok, true);
  assert.deepEqual(r.enterRetry, { after: 'agent_prompt_blocked', ok: true });
  const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  assert.equal(state.terminals['k-1'].staged, false, 'the typed text was submitted');
  assert.equal(state.terminals['k-1'].enters, 1, 'exactly one Enter-only follow-up');
  const noEnter = terminalSend({ terminal: 'k-1', text: 'typed only', enter: false });
  assert.equal(noEnter.enterRetry, undefined, 'a send without Enter is never followed up');
});
