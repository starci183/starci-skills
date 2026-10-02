import test from 'node:test';
import assert from 'node:assert/strict';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';
import path from 'node:path';
import { workflowProgress, progressMessages, LEG_VI, reportRepos } from '../../scripts/supervisor/progress-report.mjs';
import { SKILL_ROOT } from '../../scripts/machine/home.mjs';
import { translator } from '../../scripts/lib/i18n.mjs'; import os from 'node:os';

// Owner, 2026-09-23: every 10 minutes the supervisor sends the progress and the
// remaining estimate to Telegram, and a terse table was rejected ("write
// everything out clearly"): each workflow gets its goal, every leg in Vietnamese, what runs
// and for how long, the latest report, pending questions with links and a
// finish time.
const trv = translator('vi');
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Owner-authored content the report quotes verbatim (goal text, an ask's question).
const GOAL = 'ho\u00e0n thi\u1ec7n \u0111\u0103ng nh\u1eadp';
const ASK_TEXT = 'Ch\u1ecdn c\u1ed5ng thanh to\u00e1n n\u00e0o?';
test('the progress report spells out each workflow in Vietnamese with a finish time', async (t) => {
  await withLedger(t, async ({ ledger }) => {
    const wf = 'wf-nivo-app-auth-mudqjob3';
    const start = Date.now() - 4 * 3600000;
    seedWorkflow(ledger, { id: wf, state: { phase: 'running' }, now:start });
    ledger.db.prepare("UPDATE workflows SET created_at=? WHERE workflow_id=?").run(start, wf);
    ledger.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)')
      .run(wf, 1, 'g', GOAL, JSON.stringify({ derivedPlan: { legs: ['request.analyze', 'scope.define', 'business.decide', 'architecture.decide', 'work.author'] } }), start);
    seedWorkflow(ledger,{id:wf,now:start,jobs:[
      {jobId:'j1',opId:'scope.define',status:'succeeded',createdAt:start},
      {jobId:'j2',opId:'business.decide',status:'succeeded',createdAt:start},
      {jobId:'j3',opId:'business.decide',status:'running',dispatchId:'ctx_q',createdAt:start},
      {jobId:'j4',opId:'architecture.decide',status:'queued',createdAt:start},
    ]});
    const attemptId=ledger.db.prepare("SELECT attempt_id FROM op_attempts WHERE job_id='j3'").get().attempt_id;
    ledger.db.prepare(`INSERT INTO reports(workflow_id,attempt_id,dispatch_id,job_id,outcome,report_json,created_at) VALUES(?,?,?,?,'ask',?,?)`)
      .run(wf, attemptId, 'ctx_q', 'j3', JSON.stringify({ summary: 's', question: { text: ASK_TEXT } }), start);
    ledger.appendEvent({ workflowId: wf, entityType: 'report', entityId: 'ctx_q', kind: 'ask-serving', payload: { dispatchId: 'ctx_q', url: 'http://127.0.0.1:6975/a-0123456789abcdef01' } });
    const row = ledger.db.prepare('SELECT workflow_id, created_at FROM workflows WHERE workflow_id=?').get(wf);
    const p = workflowProgress(ledger.db, row, { publicBase: 'https://response.example.org' });
    assert.deepEqual([p.done, p.total], [2, 4], 'request.analyze with no job is not counted; a reworked leg stays done');
    assert.ok(Math.abs(p.etaMs - 4 * 3600000) < 60000, '2 legs in 4h leaves 2 legs, about 4h');
    assert.deepEqual(p.asks.map((a) => a.link), ['https://response.example.org/a-0123456789abcdef01']);
    const text = progressMessages([{ repo: 'r', ...p }]).join('\n');
    // The Vietnamese wording lives in the i18n catalog (modules/i18n/messages): assert the rendered catalog text.
    assert.ok(text.includes(trv('<b>[StarCi] Progress report at {now}</b>', { now: '|' }).split('|')[0]));
    assert.ok(text.includes(trv('<b>▶ {name}</b> — {done}/{total} legs done', { name: trv('AUTH (sign-in)'), done: 2, total: 4 })));
    assert.ok(text.includes(trv('Goal: {goal}', { goal: GOAL })));
    assert.ok(text.includes(`${trv('🔄 In progress: <b>{op}</b>', { op: LEG_VI['business.decide'] })}${trv(' (rework)')}`));
    assert.ok(text.includes(trv('⏳ Waiting its turn: {legs}', { legs: LEG_VI['architecture.decide'] })));
    assert.ok(text.includes(`${ASK_TEXT}\n   https://response.example.org/a-0123456789abcdef01`));
    assert.ok(text.includes(trv('🕒 ETA: ~{dur} more (around {etaAt}), at the pace since it started ({startedAt})', { dur: trv('{h} hours', { h: '4.0' }), etaAt: '|', startedAt: '' }).split('|')[0]));
    // Forms are served on demand: once this one ended it has no link, and the report points at /asks.
    ledger.appendEvent({ workflowId: wf, entityType: 'report', entityId: 'ctx_q', kind: 'ask-serving-expired', payload: { dispatchId: 'ctx_q' } });
    const ended = workflowProgress(ledger.db, row, { publicBase: 'https://response.example.org' });
    assert.deepEqual(ended.asks.map((a) => a.link), [null]);
    assert.match(progressMessages([{ repo: 'r', ...ended }]).join('\n'), new RegExp(`${escRe(ASK_TEXT)}\\n\\s+${escRe(trv('(press /asks for an answer link)'))}`));
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

test('the report covers --repo, else config supervisor.repos resolved like the rest of the supervisor; no host-specific fallback', () => {
  assert.deepEqual(reportRepos([path.join(os.tmpdir(), 'x')]), [path.join(os.tmpdir(), 'x')]);
  assert.deepEqual(reportRepos([], { supervisor: { repos: ['todo-app-be'] } }), [path.resolve(path.dirname(SKILL_ROOT), 'todo-app-be')]);
  assert.deepEqual(reportRepos([], { supervisor: { repos: [] } }), [], 'an empty list reports nothing');
  assert.deepEqual(reportRepos([], null), []);
});
