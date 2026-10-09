// RT_EVENT_SPILL_BYPASS: the check refuses a runtime writer that spills a ledger event by hand, and the one path spills an oversized payload of every event family.
import test from 'node:test';
import assert from 'node:assert/strict';
import { eventSpillFindings, checkEventSpill, CODE } from '../../scripts/checks/check-event-spill.mjs';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { eventPayloadOf } from '../../engine/db/event-payload.mjs';
import { EVENT_LIMITS } from '../../engine/db/event-compact.mjs';

test('a writer that passes payloadSha, catches the too-large refusal or inserts into events is refused; the owners and specs are not', () => {
  const bypass = {
    'scripts/kernel/a.mjs': "ledger.appendEvent({ kind: 'x', payload, payloadSha });",
    'scripts/kernel/b.mjs': "if (error.code !== 'STARCI_EVENT_PAYLOAD_TOO_LARGE') throw error;",
    'engine/db/c.mjs': "db.exec(\"INSERT INTO events (kind) VALUES ('x')\");",
    'engine/db/ledger.mjs': 'payloadSha STARCI_EVENT_PAYLOAD_TOO_LARGE INSERT INTO events',
    'tests/kernel/x.spec.mjs': 'payloadSha: sha',
    'scripts/kernel/clean.mjs': "ledger.appendEvent({ kind: 'x', payload });\nconst row = db.prepare('SELECT payload_sha FROM events').get();",
  };
  const findings = eventSpillFindings(bypass);
  assert.deepEqual(findings.map((f) => f.path).sort(), ['engine/db/c.mjs', 'scripts/kernel/a.mjs', 'scripts/kernel/b.mjs']);
  assert.ok(findings.every((f) => f.code === CODE));
});

test('the runtime tree has no writer that bypasses the one spill path', () => {
  assert.deepEqual(checkEventSpill(), []);
});

// The families whose payload grows with their input (found by reading every appendEvent writer): a read-plan attestation, the files a boot delivered, a launch startup,
// a settle hand-over with its detail lines, the receipts of a checkpoint and of a preserve, a gate re-judgment, a Kernel decision, a dispatch push, a Critic run, recorded checks.
const FAMILIES = ['runtime-rev-acked', 'runtime-read-delivered', 'kernel-restarted', 'kernel-booted', 'job-settle-needs-kernel', 'workflow-checkpoint-prepared', 'workflow-checkpoint-applied',
  'workflow-op-preserved-prepared', 'workflow-op-preserved-applied', 'gate-rejudged', 'kernel-decision', 'kernel-dispatch-push', 'runtime-critic-run', 'checks-recorded'];

test('an oversized payload of every event family is kept whole behind its sha and read back, with a bounded inline view', (t) => withLedger(t, (world) => {
  const { ledger } = world;
  seedWorkflow(ledger, { id: 'wf-spill', state: { phase: 'running', job: 'spill' }, goalIdentity: 'g', goal: { revision: 0, identity: 'g', markdown: '# goal', json: {} }, jobs: [] });
  for (const kind of FAMILIES) {
    const payload = { rev: 'abc', source: 'spec', files: Array.from({ length: 1500 }, (_, i) => `modules/cli/commands/kernel/file-${i}.yaml`), detail: ['x'.repeat(40_000)] };
    const row = ledger.transaction(() => ledger.appendEvent({ workflowId: 'wf-spill', entityType: 'kernel', entityId: 'wf-spill', kind, payload }));
    assert.match(row.payload_sha, /^[0-9a-f]{64}$/, kind);
    assert.ok(row.payload_json.length <= EVENT_LIMITS.payloadBytes, `${kind}: inline view is bounded`);
    assert.equal(JSON.parse(row.payload_json).rev, 'abc', `${kind}: the scalars of the payload stay inline`);
    assert.equal(eventPayloadOf(row).files.length, 1500, `${kind}: the whole payload is behind the sha`);
  }
}));
