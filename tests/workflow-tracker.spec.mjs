import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { etaText, eventSentence, legState, ownerItems, presentSentence, retryGroups, stageGroups } from '../ui/src/workflow-tracker-model.ts';

const fixture = JSON.parse(fs.readFileSync(new URL('../ui/fixtures/snapshot.json', import.meta.url), 'utf8')).body;
const base = fixture.projects[0].workflows[0];
const make = (changes = {}) => ({ ...structuredClone(base), frontier: { state: 'engaged', actionable: false, reason: '', queuedCauses: {}, peerWaits: [] }, nextActions: [], asks: [], drawReviews: [], incidents: [], holds: [], running: [], queued: [], etaAt: null, ...changes });

test('running retry takes priority over an old failed leg', () => {
  const wf = make({ legs: [{ op: 'uat.verify', state: 'failed', color: 'red', since: 1 }], running: [{ op: 'uat.verify', jobId: 'retry', attempt: 3, since: 10, status: 'running' }] });
  assert.equal(legState(wf, wf.legs[0]), 'running');
  assert.match(presentSentence(wf, true), /Đang làm Kiểm thử UAT/);
});

test('owner gate states the decision and suppresses the linked incident duplicate', () => {
  const wf = make({ nextActions: [{ kind: 'owner-gate', op: 'uat.verify', jobId: 'j', incidentId: 'i', reason: 'route failed-retries-the-same-op already fired 3 of 3 times; the owner decides whether it runs again' }], incidents: [{ id: 'i', op: null, text: '[owner-gate] same', at: 1 }] });
  assert.equal(ownerItems(wf).length, 1);
  assert.match(ownerItems(wf)[0].text, /chạy lại/);
  assert.match(presentSentence(wf, true), /Thầy cần/);
});

test('an open draw review gives one owner action with a direct destination', () => {
  const wf = make({ asks: [{ op: 'interface.draw', askClass: 'approval', text: 'Duyệt bản vẽ đăng nhập.', link: null }],
    drawReviews: [{ record: 'ui.login', awaitingOwner: true }], nextActions: [{ kind: 'owner-gate', op: 'interface.draw', reason: 'ask ctx waits on the owner', incidentId: null }] });
  assert.equal(ownerItems(wf).length, 1);
  assert.equal(ownerItems(wf)[0].link, '#/owner');
});

test('peer wait names the dependency without treating an incident as an owner action', () => {
  const wf = make({ frontier: { state: 'peer-wait', actionable: false, reason: '', queuedCauses: {}, peerWaits: [{ peer: 'other', job: 'j', reason: 'wait' }] }, incidents: [{ id: 'i', op: null, text: '[runtime-defect] wait', at: 1 }] });
  assert.match(presentSentence(wf, true), /luồng việc khác/);
  assert.equal(ownerItems(wf).length, 0);
});

test('finished and unavailable states are explicit; unknown ops remain visible', () => {
  const wf = make({ frontier: { state: 'idle', actionable: false, reason: '', queuedCauses: {}, peerWaits: [] }, legs: [{ op: 'unknown.special', state: 'done', color: 'green', since: 1 }] });
  assert.match(presentSentence(wf, true), /hoàn tất/);
  assert.equal(stageGroups(wf).at(-1).name, 'Khác');
  assert.match(presentSentence(wf, false), /Chưa xác nhận/);
  assert.equal(etaText(wf, Date.now(), String), 'Chưa có ước tính');
  assert.match(etaText({ ...wf, etaAt: 1 }, 2, String), /Ước tính cũ/);
});

test('adjacent retries merge only for identical verdict and cause', () => {
  const job = (attempt, verdict, cause) => ({ attempt, verdict, status: verdict === 'running' ? 'running' : 'failed', report: cause ? { rootCause: cause } : null });
  const groups = retryGroups([job(1, 'fail', 'A'), job(2, 'fail', 'A'), job(3, 'fail', 'B'), job(4, 'running', '')]);
  assert.deepEqual(groups.map((group) => [group.first, group.last]), [[1, 2], [3, 3], [4, 4]]);
});

test('filing a report is not a settled verdict', () => {
  const filed = eventSentence({ kind: 'report-filed', op: 'uat.verify' });
  assert.match(filed, /đang chờ chốt kết quả/);
  assert.doesNotMatch(filed, /được chốt đạt/);
});
