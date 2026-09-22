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
  const ops = plan.legs.map(leg => leg.op);
  assert.ok(ops.indexOf('interface.implement') < ops.indexOf('interface.audit'));
  assert.ok(ops.indexOf('interface.audit') < ops.indexOf('uat.verify'));
  assert.ok(!plan.legs.some(leg => leg.op === 'workspace.manage'));
});

test('assisted UAT preparation is a separate existing-build workflow', () => {
  const result = run('prepare assisted UAT for the bank approval journey');
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  const plan = body(result);
  assert.equal(plan.status, 'ok');
  assert.equal(plan.scopeKind, 'assisted-uat-prepare');
  assert.deepEqual(plan.legs.map(leg => leg.op), ['request.analyze', 'uat.assisted.prepare']);
  assert.ok(!plan.legs.some(leg => leg.op === 'interface.implement'));
});

test('assisted UAT verification consumes the exact prepared package before acceptance', () => {
  const result = run('verify assisted UAT receipt for the bank approval journey');
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  const plan = body(result);
  assert.equal(plan.status, 'ok');
  assert.equal(plan.scopeKind, 'assisted-uat-verify');
  assert.deepEqual(plan.legs.map(leg => leg.op), ['request.analyze', 'uat.assisted.prepare', 'uat.assisted.verify']);
  assert.ok(!plan.legs.some(leg => leg.op === 'uat.verify'));
});

test('Vietnamese prompts select archetypes through the archetypes.yaml phrase data', () => {
  const cases = [
    ['ứng dụng hơi chậm khi mở khoá học', 'investigate-first'],
    ['tích hợp VNPay cho thanh toán khoá học', 'external-integration'],
    ['tái cấu trúc module enrolment', 'refactor'],
    ['làm giao diện màn hình đăng ký khoá học', 'feature-build-with-ui'],
    ['xây dịch vụ đăng ký khoá học', 'feature-build-backend'],
    ['kiểm tra lint toàn repo', 'verify-only'],
  ];
  for (const [prompt, scopeKind] of cases) {
    for (const form of [prompt, prompt.normalize('NFD')]) {
      const result = run(form);
      assert.equal(result.status, 0, result.stderr || result.error?.message);
      assert.equal(body(result).scopeKind, scopeKind, `${JSON.stringify(form)} should select ${scopeKind}`);
    }
  }
});

test('diacritics are kept: "chấm điểm" (grade) is not the "chậm" (slow) signal', () => {
  const result = run('chấm điểm bài nộp');
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  const plan = body(result);
  assert.equal(plan.status, 'needs-owner');
  assert.equal(plan.ambiguity?.tier, 'INTENT');
});

test('an ordinary behavior-invariant refactor retains the Work remap', () => {
  const result = run('refactor the enrolment service without changing behavior');
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  const plan = body(result);
  assert.equal(plan.scopeKind, 'refactor');
  assert.ok(plan.legs.some(leg => leg.op === 'work.author'));
  assert.ok(!plan.legs.some(leg => leg.op === 'workspace.manage'));
});
