import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { CATALOG as catalog } from '../../packages/cli/src/catalog.generated.mjs';
import { main } from '../../scripts/cli/main.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const verbs = {
  decisions: ['all', 'apply', 'by', 'claim', 'decision', 'list', 'note', 'repo', 'resolve', 'ring', 'verb', 'workflow'],
  'kernel-watchdog': ['goal', 'interval-ms', 'once', 'repair', 'repo', 'workflow'],
  lessons: ['commit', 'experiment', 'items', 'outcome', 'reason', 'refs', 'signature', 'text', 'via', 'write'],
  'op-metrics': ['by', 'repo', 'trend', 'window-ms'],
  'seam-policy': ['cut-id', 'job', 'paths', 'repo', 'root', 'scan'],
  worktrees: ['plan'],
};

test('machine catalog resolves handlers and declares their parsed flags', () => {
  const group = catalog.groups.machine.verbs;
  assert.deepEqual(Object.keys(group).filter((name) => group[name].impl.script).sort(), Object.keys(verbs).sort());
  assert.deepEqual(Object.keys(group).filter((name) => group[name].impl.module).sort(), ['worktrees-clean']);
  for (const [verb, flags] of Object.entries(verbs)) {
    const command = catalog.groups.machine.verbs[verb];
    assert.equal(fs.existsSync(path.join(root, command.impl.script)), true, command.impl.script);
    assert.deepEqual(command.flags.map((flag) => flag.name).sort(), flags);
  }
});

test('machine dispatches through the injected runtime seam', () => {
  let call;
  assert.equal(main(['machine', 'decisions', 'supervisor', '--list', '--json'], {
    catalog,
    runScript: (script, args) => { call = { script, args }; return 0; },
  }), 0);
  assert.match(call.script, /scripts[\\/]machine[\\/]decisions\.mjs$/);
  assert.deepEqual(call.args, ['supervisor', '--list', '--json']);
});
