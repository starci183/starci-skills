// A goal text carrying an unrendered value is refused (scripts/goal/goal-text.mjs): the eight 2026-09-27
// restart workflows were defined "... Goal gốc:\n\nnull", route-plan could not form S*, and every Kernel
// improvised its decide legs.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { goalTextRefusal, unresolvedPlaceholders } from '../../scripts/goal/goal-text.mjs';

const RESTART = 'Khởi động lại trên runtime mới (owner, 2026-09-27): tiếp tục từ trạng thái hiện tại. Goal gốc:\n\nnull';

test('the restart goal text is refused; ordinary owner text passes', () => {
  assert.deepEqual(unresolvedPlaceholders(RESTART), [{ line: 3, value: 'null' }]);
  assert.deepEqual(unresolvedPlaceholders('Goal gốc: undefined').map((f) => f.value), ['undefined']);
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
