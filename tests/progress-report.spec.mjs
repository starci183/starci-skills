import test from 'node:test';
import assert from 'node:assert/strict';
import { withLedger, seedWorkflow } from './_ledger-fixture.mjs';
import { workflowProgress, progressMessages, LEG_VI } from '../scripts/supervisor/progress-report.mjs';

// Owner, 2026-09-23: every 10 minutes the supervisor sends the progress and the
// remaining estimate to Telegram, and a terse table was rejected ("ghi rõ ràng
// ra mọi thứ"): each workflow gets its goal, every leg in Vietnamese, what runs
// and for how long, the latest report, pending questions with links and a
// finish time.
test('the progress report spells out each workflow in Vietnamese with a finish time', async (t) => {
  await withLedger(t, async ({ ledger }) => {
    const wf = 'wf-nivo-app-auth-mudqjob3';
    seedWorkflow(ledger, { id: wf, state: { phase: 'running' } });
    const start = Date.now() - 4 * 3600000;
    ledger.db.prepare("UPDATE workflows SET phase='running', created_at=? WHERE workflow_id=?").run(start, wf);
    ledger.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)')
      .run(wf, 1, 'g', 'hoàn thiện đăng nhập', JSON.stringify({ derivedPlan: { legs: ['request.analyze', 'scope.define', 'business.decide', 'architecture.decide', 'work.author'] } }), start);
    const job = (id, op, status) => ledger.db.prepare(`INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,created_at,updated_at)
      VALUES(?,?,?,1,0,'op','op','{}',?,?,?)`).run(id, wf, op, status, start, start);
    job('j1', 'scope.define', 'succeeded');
    job('j2', 'business.decide', 'succeeded');
    job('j3', 'business.decide', 'running');
    job('j4', 'architecture.decide', 'queued');
    ledger.db.prepare(`INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,created_at) VALUES(?,?,?,1,0,'ask',?,?)`)
      .run(wf, 'ctx_q', 'business.decide', JSON.stringify({ summary: 's', question: { text: 'Chọn cổng thanh toán nào?' } }), start);
    ledger.appendEvent({ workflowId: wf, entityType: 'report', entityId: 'ctx_q', kind: 'ask-serving', payload: { dispatchId: 'ctx_q', url: 'http://127.0.0.1:6975/a-0123456789abcdef01' } });
    const row = ledger.db.prepare('SELECT workflow_id, created_at FROM workflows WHERE workflow_id=?').get(wf);
    const p = workflowProgress(ledger.db, row, { publicBase: 'https://response.example.org' });
    assert.deepEqual([p.done, p.total], [2, 4], 'request.analyze with no job is not counted; a reworked leg stays done');
    assert.ok(Math.abs(p.etaMs - 4 * 3600000) < 60000, '2 legs in 4h leaves 2 legs, about 4h');
    assert.deepEqual(p.asks.map((a) => a.link), ['https://response.example.org/a-0123456789abcdef01']);
    const text = progressMessages([{ repo: 'r', ...p }]).join('\n');
    assert.match(text, /Báo cáo tiến độ/);
    assert.match(text, /AUTH \(đăng nhập\).*2\/4 chặng xong/);
    assert.match(text, /Mục tiêu: hoàn thiện đăng nhập/);
    assert.match(text, new RegExp(`Đang làm: <b>${LEG_VI['business.decide']}</b> \\(làm lại\\)`));
    assert.match(text, new RegExp(`Chờ tới lượt: ${LEG_VI['architecture.decide']}`));
    assert.match(text, /Chọn cổng thanh toán nào\?\n\s+https:\/\/response\.example\.org\/a-0123456789abcdef01/);
    assert.match(text, /Dự kiến xong: ~4\.0 giờ nữa \(khoảng/);
  });
});

test('a long report is split under the Telegram message limit', () => {
  const rows = Array.from({ length: 12 }, (_, i) => ({ repo: 'r', id: `wf-x${i}`, name: `WF ${i}`, goal: 'g'.repeat(220), done: 1, total: 9,
    legs: [], lastReport: { op: 'scope.define', outcome: 'done', summary: 's'.repeat(260), at: Date.now() }, asks: [], runtime: [], ownerGates: [],
    startedAt: Date.now() - 3600000, elapsedMs: 3600000, etaMs: 3600000, etaAt: Date.now() + 3600000 }));
  const messages = progressMessages(rows);
  assert.ok(messages.length > 1);
  assert.ok(messages.every((m) => m.length <= 4096));
});
