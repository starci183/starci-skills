import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { inspectLedger, openLedger, ledgerFileFor } from '../engine/ledger-db.mjs';
import { FAKE_ORCA } from './helpers/fake-orca.mjs';

const root = path.resolve(import.meta.dirname, '..');
const json = value => JSON.parse(value);
const fixture = t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kernel-replace-close-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const repo = path.join(dir, 'repo'), owner = path.join(dir, 'owner');
  fs.mkdirSync(repo); fs.mkdirSync(owner);
  fs.writeFileSync(path.join(owner, 'config.yaml'), 'language: en\neffort: medium\nkernel: {agent: codex, model: gpt-6-sol, effort: high}\n');
  const fake = path.join(dir, 'fake-orca.mjs'), stateFile = path.join(dir, 'state.json');
  // Simulate a host acknowledging close without actually removing the old tab.
  const fakeSource = FAKE_ORCA.replace('if (r) { r.closed = true; r.connected = false; r.writable = false; }',
    "if (r && process.env.STARCI_FAKE_ORCA_CLOSE_IGNORES !== handle) { r.closed = true; r.connected = false; r.writable = false; }");
  assert.notEqual(fakeSource, FAKE_ORCA, 'the fake close seam was installed');
  fs.writeFileSync(fake, fakeSource);
  fs.writeFileSync(stateFile, JSON.stringify({ sends: 0, counter: 0, terminals: {}, commands: [] }));
  const env = { ...process.env, STARCI_ORCA_COMMAND: process.execPath, STARCI_ORCA_ARGS: JSON.stringify([fake]),
    STARCI_FAKE_ORCA_STATE: stateFile, STARCI_FAKE_ORCA_UNIQUE_TERMINALS: '1', STARCI_OWNER_ROOT: owner };
  const run = (script, args, more = {}) => spawnSync(process.execPath, [path.join(root, script), ...args],
    { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 120000, env: { ...env, ...more } });
  const defined = run('scripts/goal/define-goal.mjs', ['--repo', repo, '--text', 'verify a replaced kernel close', '--json']);
  assert.equal(defined.status, 0, defined.stderr);
  const workflowId = json(defined.stdout).workflowId;
  const first = run('scripts/kernel/start-workflow.mjs', ['--repo', repo, '--goal', workflowId, '--json']);
  assert.equal(first.status, 0, first.stderr);
  const old = json(first.stdout).terminal;
  const state = json(fs.readFileSync(stateFile, 'utf8'));
  state.terminals[old].connected = false; state.terminals[old].writable = false;
  fs.writeFileSync(stateFile, JSON.stringify(state));
  // A Kernel launched by terminal create before every launch went through worker-start: a seat and a kernel job
  // with no Dispatch. The next start retires it - the only terminal the runtime still closes for a Kernel.
  const ledger = openLedger({ file: ledgerFileFor(repo) });
  try {
    ledger.db.prepare("UPDATE signals SET value_json=json_remove(value_json,'$.dispatch','$.runId') WHERE scope='kernel' AND key=?").run(workflowId);
    ledger.db.prepare("UPDATE jobs SET payload_json=json_remove(payload_json,'$.managed') WHERE job_id=?").run(`kernel-${workflowId}`);
  } finally { ledger.close(); }
  const restart = more => run('scripts/kernel/start-workflow.mjs', ['--repo', repo, '--goal', workflowId, '--json'], more);
  const rows = () => {
    const ledger = inspectLedger({ file: ledgerFileFor(repo) });
    try {
      const event = kind => ledger.db.prepare('SELECT payload_json FROM events WHERE workflow_id=? AND kind=?').get(workflowId, kind);
      return { cleared: json(event('kernel-stale-cleared').payload_json),
        unclosed: event('kernel-stale-terminal-unclosed')?.payload_json,
        incidents: ledger.db.prepare('SELECT status,last_progress FROM incidents WHERE workflow_id=?').all(workflowId) };
    } finally { ledger.close(); }
  };
  return { old, restart, rows, stateFile };
};

test('retiring a terminal-launched Kernel records proof that its terminal is gone', t => {
  const f = fixture(t);
  const restarted = f.restart();
  assert.equal(restarted.status, 0, restarted.stderr);
  assert.notEqual(json(restarted.stdout).terminal, f.old);
  const rows = f.rows();
  assert.equal(rows.cleared.retiredTerminalLaunch, true);
  assert.equal(rows.cleared.terminalClosed.ok, true);
  assert.equal(rows.cleared.terminalClosed.verified?.ok, true);
  assert.ok(['gone', 'unlisted'].includes(rows.cleared.terminalClosed.verified?.proof));
  assert.equal(rows.unclosed, undefined);
  assert.deepEqual(rows.incidents, []);
});

test('an acknowledged close that leaves the old tab is recorded for GC', t => {
  const f = fixture(t);
  const restarted = f.restart({ STARCI_FAKE_ORCA_CLOSE_IGNORES: f.old });
  assert.equal(restarted.status, 0, restarted.stderr);
  const rows = f.rows();
  assert.equal(rows.cleared.terminalClosed.ok, false);
  assert.equal(rows.cleared.terminalClosed.verified?.ok, false);
  assert.ok(rows.unclosed, 'the unclosed event lets GC find the residue');
  assert.equal(json(rows.unclosed).handle, f.old);
  assert.equal(rows.incidents.length, 1);
  assert.equal(rows.incidents[0].status, 'open');
  assert.match(rows.incidents[0].last_progress, /kernel-stale-terminal-unclosed/);
  assert.equal(json(fs.readFileSync(f.stateFile, 'utf8')).terminals[f.old].closed, false);
});
