import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { CATALOG as catalog } from '../../packages/cli/src/catalog.generated.mjs';
import { main } from '../../scripts/cli/main.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const publicVerbs = {
  actions: ['action', 'hold-ms', 'item', 'open', 'reason', 'refs', 'until', 'workflow'],
  bridge: ['blocker', 'bridge', 'dependents', 'dry-run', 'finding', 'foundation', 'goal', 'kind', 'lead', 'merge-into', 'no-notify', 'owner-ok', 'paths', 'reason', 'record', 'releases', 'repo', 'request-only', 'start', 'text', 'title', 'to', 'waiter', 'waits', 'workflow'],
  gc: ['apply', 'dry-run', 'holder', 'only', 'plan', 'trigger'],
  land: ['commit', 'full-by-push-git', 'job', 'lane', 'no-push', 'notify', 'reason', 'specs', 'status', 'wait-ms'],
  notify: ['entity', 'item', 'repo', 'text', 'text-file', 'workflow'],
  owed: ['all', 'commits', 'force', 'item', 'reason', 'repo', 'workflow'],
  poll: ['interval-ms', 'once', 'repo', 'stall-minutes', 'workflow'],
  push: ['check', 'repo'],
  'ram-cap': ['op', 'reserve', 'weight', 'workflow'],
  report: ['repo', 'send'],
  tell: ['limit', 'read', 'since', 'timeout-ms', 'wait'],
};

test('supervisor catalog resolves every added public handler and its exact local flags', () => {
  for (const [verb, flags] of Object.entries(publicVerbs)) {
    const command = catalog.groups.supervisor.verbs[verb];
    assert.ok(command, verb);
    assert.equal(fs.existsSync(path.join(root, command.impl.script)), true, command.impl.script);
    assert.deepEqual(command.flags.map((flag) => flag.name).sort(), flags);
  }
});

test('supervisor verbs resolve only the public status/start/stop modes', () => {
  const calls = [];
  const runScript = (script, args) => { calls.push({ script, args }); return 0; };
  assert.equal(main(['supervisor', 'status', '--json'], { catalog, runScript }), 0);
  assert.equal(main(['supervisor', 'start', '--plan', '--reason', 'check'], { catalog, runScript }), 0);
  assert.equal(main(['supervisor', 'stop'], { catalog, runScript }), 0);
  assert.deepEqual(calls.map((call) => call.args), [['--status', '--json'], ['--plan', '--reason', 'check'], ['--stop']]);
});

test('every added supervisor verb dispatches through the runtime seam', () => {
  const samples = {
    actions: ['list'],
    bridge: ['detect'],
    gc: [],
    land: ['--status'],
    notify: ['--repo', 'repo', '--workflow', 'wf-1', '--text', 'hello'],
    owed: [],
    poll: ['--once'],
    push: ['--check'],
    'ram-cap': ['status'],
    report: [],
    tell: ['hello'],
  };
  const calls = [];
  for (const [verb, args] of Object.entries(samples)) {
    assert.equal(main(['supervisor', verb, ...args], { catalog, runScript: (script, passed) => { calls.push({ verb, script, passed }); return 0; } }), 0, verb);
  }
  assert.deepEqual(calls.map((call) => call.verb), Object.keys(samples));
});

test('supervisor internal watchdog flags are refused', () => {
  assert.equal(main(['supervisor', 'start', '--replace'], { catalog, stderr: () => {}, runScript: () => 0 }), 2);
  assert.equal(main(['supervisor', 'start', '--restart'], { catalog, stderr: () => {}, runScript: () => 0 }), 2);
});
