// A goal text carrying an unrendered value is refused (scripts/goal/goal-text.mjs): the eight 2026-09-27
// restart workflows were defined "... Goal g\u1ed1c:\n\nnull", route-plan could not form S*, and every Kernel
// improvised its decide legs.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { goalTextRefusal, unresolvedPlaceholders } from '../../scripts/goal/goal-text.mjs';

const RESTART = 'Kh\u1edfi \u0111\u1ed9ng l\u1ea1i tr\u00ean runtime m\u1edbi (owner, 2026-09-27): ti\u1ebfp t\u1ee5c t\u1eeb tr\u1ea1ng th\u00e1i hi\u1ec7n t\u1ea1i. Goal g\u1ed1c:\n\nnull';

test('the restart goal text is refused; ordinary owner text passes', () => {
  assert.deepEqual(unresolvedPlaceholders(RESTART), [{ line: 3, value: 'null' }]);
  assert.deepEqual(unresolvedPlaceholders('Goal g\u1ed1c: undefined').map((f) => f.value), ['undefined']);
  assert.deepEqual(unresolvedPlaceholders('params: [object Object]').map((f) => f.value), ['[object Object]']);
  assert.match(goalTextRefusal(RESTART), /^goal-text-unresolved/);
  assert.equal(goalTextRefusal('Build login with a null-safe session store.\nThe field may be null when absent.'), null);
});

test('define-goal refuses it before planning or writing anything', () => {
  const script = path.resolve(import.meta.dirname, '..', '..', 'scripts', 'goal', 'define-goal.mjs');
  const r = spawnSync(process.execPath, [script, '--repo', import.meta.dirname, '--text', RESTART, '--plan', '--json'], { encoding: 'utf8', windowsHide: true, timeout: 60_000 });
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stderr, /goal-text-unresolved/);
});
