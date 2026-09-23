import test from 'node:test';
import assert from 'node:assert/strict';
import { validateOpReport, lossyTextFields } from '../scripts/kernel/report-envelope.mjs';

// Seven live business.decide reports reached the ledger with every Vietnamese
// letter turned into '?', and an owner ask was served as "Ch?n tuy?n c?ng khai".
test('a report whose text lost its non-ASCII characters is refused with a UTF-8 hint', () => {
  const lossy = { outcome: 'ask', summary: '?? r? so?t 22 b?n ghi quy t?c',
    question: { kind: 'decision', text: 'Ch?n tuy?n c?ng khai cho c?c thao t?c Sales?', options: ['1. ??ng k? thao t?c', '2. D?ng tuy?n l?nh chung'] } };
  const verdict = validateOpReport(lossy);
  assert.equal(verdict.ok, false);
  assert.match(verdict.reasons.join(' '), /lost its non-ASCII characters/);
  assert.match(verdict.reasons.join(' '), /UTF-8/);
  assert.deepEqual(lossyTextFields(lossy), ['summary', 'question.text', 'question.options[0]', 'question.options[1]']);
});

test('real Vietnamese, English questions and query strings are not lossy', () => {
  const vi = { outcome: 'ask', summary: 'Đã rà soát 22 bản ghi quy tắc', question: { text: 'Chọn tuyến công khai cho các thao tác Sales. Phương án nào được chấp nhận?', options: ['1. Đăng ký thao tác Sales có phiên bản'] } };
  assert.equal(validateOpReport(vi).ok, true);
  const en = { outcome: 'blocked', summary: 'Which route? The probe hit /api?x=1 and returned 404.', blocker: { kind: 'environment', detail: 'GET /health?probe=live failed; is the stack up?' } };
  assert.deepEqual(lossyTextFields(en), []);
  assert.equal(validateOpReport({ outcome: 'done', summary: 'bad byte � here' }).ok, false, 'a replacement character alone is lossy');
});

// Owner ruling 2026-09-23: a missing credential never stops building; a build
// op codes on a placeholder and names the variables it stood in for.
test('a report may name the credentials it built on placeholders for', async () => {
  const { validateOpReport } = await import('../scripts/kernel/report-envelope.mjs');
  const base = { schema: 'starci/op-report@1', outcome: 'done', summary: 'VNPay adapter built against env vars' };
  assert.equal(validateOpReport({ ...base, credentialPending: ['VNPAY_TMN_CODE', 'vnpay-hash-secret.key'] }).ok, true);
  assert.equal(validateOpReport({ ...base, credentialPending: 'VNPAY_TMN_CODE' }).ok, false);
  assert.equal(validateOpReport({ ...base, credentialPending: ['has space'] }).ok, false);
});
