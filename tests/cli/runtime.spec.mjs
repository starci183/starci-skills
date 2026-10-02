import assert from 'node:assert/strict';
import test from 'node:test';
import { main } from '../../scripts/cli/main.mjs';

const catalog = { global: [{ name: 'cwd', type: 'string' }, { name: 'json', type: 'boolean' }, { name: 'quiet', type: 'boolean' }], groups: { runtime: {
  owner: 'runtime', verbs: {
    check: { group: 'runtime', verb: 'check', impl: { script: 'scripts/checks/check-runtime.mjs' }, flags: [], json: 'flag' },
    install: { group: 'runtime', verb: 'install', impl: { script: 'scripts/install/install.mjs', args: ['init'] }, flags: [{ name: 'force', type: 'boolean' }], json: 'none' },
    version: { group: 'runtime', verb: 'version', impl: { script: 'scripts/install/install.mjs', args: ['version'] }, flags: [], json: 'none' },
    validate: { group: 'runtime', verb: 'validate', impl: { script: 'scripts/work/validate/work-validate.mjs' }, positional: [{ name: 'target', required: true }], flags: [{ name: 'strict', type: 'boolean' }], json: 'always' },
  },
} } };

test('runtime catalog resolves handler, cwd and json once', () => {
  let call;
  const code = main(['runtime', 'check', '--cwd', 'repo', '--json', '--quiet'], { catalog, cwd: 'base', runScript: (script, args, options) => { call = { script, args, options }; return 1; } });
  assert.equal(code, 1);
  assert.match(call.script, /scripts[\\/]checks[\\/]check-runtime\.mjs$/);
  assert.deepEqual(call.args, ['--json']);
  assert.match(call.options.cwd, /base[\\/]repo$/);
});

test('runtime validation enforces positionals and no-machine-output', () => {
  assert.equal(main(['runtime', 'validate'], { catalog, stderr: () => {}, runScript: () => 0 }), 2);
  assert.equal(main(['runtime', 'version', '--json'], { catalog, stderr: () => {}, runScript: () => 0 }), 2);
  let args;
  assert.equal(main(['runtime', 'install', '--force'], { catalog, runScript: (_script, value) => { args = value; return 0; } }), 0);
  assert.deepEqual(args, ['init', '--force']);
});
