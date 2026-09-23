import test from 'node:test';
import assert from 'node:assert/strict';
import { withLedger, seedWorkflow } from './_ledger-fixture.mjs';
import { workflowProgress, progressMessage } from '../scripts/supervisor/progress-report.mjs';

// Owner, 2026-09-23: every 10 minutes the supervisor sends a progress table with
// the remaining estimate to Telegram. A leg that succeeded stays done even while
// it is reworked; the estimate is the workflow's own pace so far.
test('progress counts done legs, shows rework, estimates from pace and fits a phone', async (t) => {
  await withLedger(t, async ({ ledger }) => {
    const wf = 'wf-nivo-app-auth-mudqjob3';
    seedWorkflow(ledger, { id: wf, state: { phase: 'running' } });
    const start = Date.now() - 4 * 3600000;
    ledger.db.prepare("UPDATE workflows SET phase='running', created_at=? WHERE workflow_id=?").run(start, wf);
    ledger.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)')
      .run(wf, 1, 'g', '', JSON.stringify({ derivedPlan: { legs: ['request.analyze', 'scope.define', 'business.decide', 'architecture.decide', 'work.author'] } }), start);
    const job = (id, op, status) => ledger.db.prepare(`INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,created_at,updated_at)
      VALUES(?,?,?,1,0,'op','op','{}',?,?,?)`).run(id, wf, op, status, start, start);
    job('j1', 'scope.define', 'succeeded');
    job('j2', 'business.decide', 'succeeded');
    job('j3', 'business.decide', 'running');
    job('j4', 'architecture.decide', 'queued');
    const row = ledger.db.prepare('SELECT workflow_id, created_at FROM workflows WHERE workflow_id=?').get(wf);
    const p = workflowProgress(ledger.db, row);
    assert.deepEqual([p.name, p.done, p.total], ['AUTH', 2, 4], 'request.analyze with no job is not counted');
    assert.deepEqual(p.current, ['↻business.decide']);
    assert.deepEqual(p.waiting, ['architecture.decide']);
    assert.ok(Math.abs(p.etaMs - 4 * 3600000) < 60000, '2 legs in 4h leaves 2 legs, about 4h');
    const text = progressMessage([{ repo: 'r', ...p }]);
    assert.match(text, /\[StarCi\] Tiến độ/);
    assert.match(text, /AUTH\s+2\/4\s+4\.0h\s+↻business\.decide/);
    const tableLines = text.split('<pre>')[1].split('</pre>')[0].split('\n');
    assert.ok(tableLines.every((l) => l.length <= 40), 'the table fits a phone-width chat');
  });
});
