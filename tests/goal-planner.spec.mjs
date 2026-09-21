import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const ROUTE_PLAN = path.join(ROOT, 'scripts', 'route', 'route-plan.mjs');
const run = text => spawnSync(process.execPath, [ROUTE_PLAN, '--text', text, '--json'], {
  cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 60000,
});
const body = result => JSON.parse(result.stdout);

test('Work and stack canonicalization derives the migration chain without generic record authoring', () => {
  const result = run('refactor and canonicalize .starciwork and .starcistacks against the current contracts');
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  const plan = body(result);
  assert.equal(plan.status, 'ok');
  assert.equal(plan.scopeKind, 'workspace-canonicalization');
  assert.deepEqual(plan.legs.map(leg => leg.op), [
    'scope.define',
    'test.author',
    'code.refactor',
    'workspace.manage',
    'review.verify',
  ]);
  assert.ok(!plan.legs.some(leg => leg.op === 'work.author'));
});

test('a canonical product landing request remains a feature scope', () => {
  const result = run('build the canonical NIVO public landing page');
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  const plan = body(result);
  assert.equal(plan.scopeKind, 'feature-build-with-ui');
  assert.ok(plan.legs.some(leg => leg.op === 'interface.implement'));
  assert.ok(!plan.legs.some(leg => leg.op === 'workspace.manage'));
});

test('an ordinary behavior-invariant refactor retains the Work remap', () => {
  const result = run('refactor the enrolment service without changing behavior');
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  const plan = body(result);
  assert.equal(plan.scopeKind, 'refactor');
  assert.ok(plan.legs.some(leg => leg.op === 'work.author'));
  assert.ok(!plan.legs.some(leg => leg.op === 'workspace.manage'));
});
