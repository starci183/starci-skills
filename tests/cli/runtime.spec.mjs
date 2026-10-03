import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { CATALOG as catalog } from '../../packages/cli/src/catalog.generated.mjs';
import { main } from '../../scripts/cli/main.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const addedVerbs = {
  architecture: ['base'],
  'benchmark-snapshot': ['date', 'dir', 'repo', 'since-hours'],
  'gen-ops': ['check', 'ops-dir', 'out'],
  housekeeping: ['apply', 'dry-run', 'only'],
  'ledger-hygiene': ['apply'],
  'machine-db': ['all', 'create', 'file', 'ledger-file', 'ledger-id', 'name', 'product', 'repo'],
};

test('runtime catalog resolves every added handler and its exact local flags', () => {
  for (const [verb, flags] of Object.entries(addedVerbs)) {
    const command = catalog.groups.runtime.verbs[verb];
    assert.ok(command, verb);
    assert.equal(fs.existsSync(path.join(root, command.impl.script)), true, command.impl.script);
    assert.deepEqual(command.flags.map((flag) => flag.name).sort(), flags);
  }
});

test('runtime catalog resolves handler, cwd and json once', () => {
  let call;
  const code = main(['runtime', 'check', '--cwd', 'repo', '--json', '--quiet'], { catalog, cwd: 'base', runScript: (script, args, options) => { call = { script, args, options }; return 1; } });
  assert.equal(code, 1);
  assert.match(call.script, /scripts[\\/]checks[\\/]check-runtime\.mjs$/);
  assert.deepEqual(call.args, ['--json']);
  assert.match(call.options.cwd, /base[\\/]repo$/);
});

test('runtime check declares --only and forwards delimited check arguments', () => {
  const command = catalog.groups.runtime.verbs.check;
  assert.deepEqual(command.flags.map((flag) => flag.name), ['only']);
  assert.deepEqual(command.positional, [{ name: 'check-arguments', required: false, variadic: true }]);

  let call;
  const code = main(['runtime', 'check', '--only', 'cli-parity', '--', '--root', 'tree'], {
    catalog,
    runScript: (script, args, options) => {
      call = { script, args, options };
      return 0;
    },
  });
  assert.equal(code, 0);
  assert.match(call.script, /scripts[\\/]checks[\\/]check-runtime\.mjs$/);
  assert.deepEqual(call.args, ['--only', 'cli-parity', '--', '--root', 'tree']);
});

test('every added runtime verb dispatches through the runtime seam', () => {
  const samples = {
    architecture: ['repo'],
    'benchmark-snapshot': ['--since-hours', '24'],
    'gen-ops': ['--check'],
    housekeeping: ['--dry-run'],
    'ledger-hygiene': [],
    'machine-db': ['status'],
  };
  const calls = [];
  for (const [verb, args] of Object.entries(samples)) {
    assert.equal(main(['runtime', verb, ...args], { catalog, runScript: (script, passed) => { calls.push({ verb, script, passed }); return 0; } }), 0, verb);
  }
  assert.deepEqual(calls.map((call) => call.verb), Object.keys(samples));
});

test('runtime validation enforces positionals and no-machine-output', () => {
  assert.equal(main(['runtime', 'validate'], { catalog, stderr: () => {}, runScript: () => 0 }), 2);
  assert.equal(main(['runtime', 'version', '--json'], { catalog, stderr: () => {}, runScript: () => 0 }), 2);
  let args;
  assert.equal(main(['runtime', 'install', '--force'], { catalog, runScript: (_script, value) => { args = value; return 0; } }), 0);
  assert.deepEqual(args, ['init', '--force']);
});
