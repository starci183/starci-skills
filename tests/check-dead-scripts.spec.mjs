import test from 'node:test';
import assert from 'node:assert/strict';
import { deadScriptFindings } from '../scripts/checks/check-dead-scripts.mjs';

// RED18: a runtime script is alive only when a tracked file other than a test names it.
const run = (files) => deadScriptFindings({ tracked: Object.keys(files), read: (rel) => files[rel] ?? '' });

test('a script imported, spawned or documented outside the tests is alive', () => {
  assert.deepEqual(run({
    'scripts/lib/used.mjs': 'export const x = 1;',
    'scripts/checks/uses.mjs': "import { x } from '../lib/used.mjs';",
    'scripts/kernel/spawned.mjs': '',
    'package.json': '{"scripts":{"check":"node scripts/checks/uses.mjs && node scripts/kernel/spawned.mjs"}}',
  }), []);
});

test('a script only a test names, or nothing names, is dead', () => {
  const findings = run({
    'scripts/checks/only-tested.mjs': 'export const y = 1;',
    'scripts/kernel/orphan.mjs': '',
    'tests/only-tested.spec.mjs': "import { y } from '../scripts/checks/only-tested.mjs';",
  });
  assert.deepEqual(findings.map((f) => [f.code, f.path]), [['RT_DEAD_SCRIPT', 'scripts/checks/only-tested.mjs'], ['RT_DEAD_SCRIPT', 'scripts/kernel/orphan.mjs']]);
});

test('a script that names only itself is dead; generated runtime copies keep nothing alive', () => {
  const findings = run({
    'scripts/kernel/self.mjs': '// usage: node scripts/kernel/self.mjs',
    'packages/hfs/runtime/scripts/lib/copy.mjs': "import '../../../../../scripts/kernel/self.mjs';",
  });
  assert.deepEqual(findings.map((f) => f.path), ['scripts/kernel/self.mjs']);
});
