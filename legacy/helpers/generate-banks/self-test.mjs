// Proves validate.mjs on a synthetic host: a fixture product whose unchecked ledger, findings and walk
// evidence give three threads, one lawful run that drafts three missions from them — each with its
// evidence refs, the tier hinted from the ledger entry it came from, the queue ordered by dependsOn
// then priority — one lawful BANK_EMPTY stop that wrote nothing, and one mutation per law, each of
// which must fail with a line that names the defect. Nothing outside the temporary host is read.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateGenerateBanksRun } from './validate.mjs';
import { queueHash, missionDigest } from '../../scripts/bank.mjs';

const PRODUCT = 'fixture-product';
const RUN_ID = '20260905-101500';
const HELPER = 'generate-banks';
const BANKED_BY = { helper: HELPER, runId: RUN_ID };

const goalDraft = (goal, producedBy) => ({
  version: 1,
  language: 'vi',
  goal,
  includes: [goal],
  excludes: ['anything the evidence does not name'],
  doneWhen: [{ evidence: `a receipt of ${producedBy} that answers "${goal}"`, producedBy }],
  sourceRef: 'unchecked and findings ledgers of the fixture product',
});
const MISSIONS = [
  {
    schemaVersion: 9, missionId: 'cover-the-deferred-list', product: PRODUCT, title: 'Walk the list surface the last run deferred',
    routes: ['fe'], env: 'dev', evidenceRefs: ['unchecked:u-1'], tierHint: 'secondary', bankedBy: BANKED_BY,
    goalDraft: goalDraft('Walk the list surface the last run deferred', 'uat.verify'),
  },
  {
    schemaVersion: 9, missionId: 'answer-the-contrast-finding', product: PRODUCT, title: 'Answer the contrast finding on the detail surface',
    routes: ['fe'], env: 'dev', evidenceRefs: ['finding:f-9', 'source:app/detail/page.tsx'], bankedBy: BANKED_BY,
    goalDraft: goalDraft('Answer the contrast finding on the detail surface', 'interface.generate'),
  },
  {
    schemaVersion: 9, missionId: 'prove-the-detail-surface', product: PRODUCT, title: 'Prove the repaired detail surface holds up',
    routes: ['fe'], env: 'dev', evidenceRefs: ['uat:detail/runs/20260904-120000-abc1234'], bankedBy: BANKED_BY,
    goalDraft: goalDraft('Prove the repaired detail surface holds up', 'interface.audit'),
  },
];
const ENTRIES = [
  { missionId: 'answer-the-contrast-finding', status: 'banked', dependsOn: [], priority: 'P0' },
  { missionId: 'cover-the-deferred-list', status: 'banked', dependsOn: [], priority: 'P1' },
  { missionId: 'prove-the-detail-surface', status: 'banked', dependsOn: ['answer-the-contrast-finding'], priority: 'P1' },
];
const queueDoc = (entries = ENTRIES, bankedBy = BANKED_BY) => ({ schemaVersion: 9, product: PRODUCT, bankedBy, entries });
const BANK_HASH = queueHash(queueDoc(), new Map(MISSIONS.map((mission) => [mission.missionId, missionDigest(mission)])));
const runDoc = (patch = {}) => ({
  schemaVersion: 9, helper: HELPER, runId: RUN_ID, profile: 'astra',
  args: { product: PRODUCT, env: 'dev', language: 'vi', limit: 12, notes: null, runId: RUN_ID },
  inputs: [{ ref: `@worktrees/unchecked/${PRODUCT}`, head: null }, { ref: '@knowledge/findings', head: null }],
  outputs: [`@worktrees/banked/${PRODUCT}/queue.json`, ...MISSIONS.map((m) => `@worktrees/banked/${PRODUCT}/${m.missionId}/mission.json`), `@worktrees/helpers/${HELPER}/runs/${RUN_ID}/run.json`],
  startedAt: '2026-09-05T10:15:00Z', endedAt: '2026-09-05T10:16:40Z',
  ...patch,
});
const bankSummary = (queueHashValue = BANK_HASH, entries = ENTRIES) => ({ queueHash: queueHashValue, approvalHash: null, entries: entries.map(({ missionId, status }) => ({ missionId, status })) });
const v22Run = (patch = {}) => runDoc({
  contractVersion: 'starci/v2.2',
  hostBinding: { kind: 'codex-task', hostId: 'codex-task-17', worktree: 'C:/fixture/worktree', starciSessionId: null },
  sourceCoverage: runDoc().inputs.map(({ ref }) => ({ ref, state: 'valid', evidence: [ref] })),
  bankBefore: { queueHash: null, approvalHash: null, entries: [] },
  bankAfter: bankSummary(), outcome: 'drafted', deduplications: [],
  ...patch,
});

function host({ run = runDoc(), queue = queueDoc(), missions = MISSIONS, docs = true } = {}) {
  const hostRoot = mkdtempSync(path.join(tmpdir(), 'generate-banks-'));
  const runDir = path.join(hostRoot, '.worktrees', 'helpers', HELPER, 'runs', RUN_ID);
  mkdirSync(runDir, { recursive: true });
  writeFileSync(path.join(runDir, 'run.json'), JSON.stringify(run, null, 2));
  if (queue) {
    const bank = path.join(hostRoot, '.worktrees', 'banked', PRODUCT);
    mkdirSync(bank, { recursive: true });
    writeFileSync(path.join(bank, 'queue.json'), JSON.stringify(queue, null, 2));
    for (const m of missions) {
      mkdirSync(path.join(bank, m.missionId), { recursive: true });
      writeFileSync(path.join(bank, m.missionId, 'mission.json'), JSON.stringify(m, null, 2));
      if (docs) writeFileSync(path.join(bank, m.missionId, 'mission.md'), `# ${m.title}\n\n${m.goalDraft.goal}\n`);
    }
  }
  return { hostRoot, runDir };
}
async function run(options) {
  const { hostRoot, runDir } = host(options);
  const { errors } = await validateGenerateBanksRun(runDir, hostRoot);
  rmSync(hostRoot, { recursive: true, force: true });
  return errors;
}
async function expectValid(options, label) { assert.deepEqual(await run(options), [], `${label} should be valid`); }
async function expectError(options, needle, label) {
  const errors = await run(options);
  assert.ok(errors.some((e) => e.includes(needle)), `${label}: expected an error containing "${needle}", got:\n${errors.join('\n') || '(none)'}`);
}

// A lawful bank: three grounded missions, the deferred one hinted secondary from the ledger entry it
// came from, and a queue in the order a drafted bank comes out in.
await expectValid({}, 'three grounded missions in the drafted order');
await expectValid({ run: v22Run() }, 'a v2.2 run bound to its host with source and bank snapshots');
// A lawful stop: nothing at all was written.
await expectValid({ run: runDoc({ stop: 'BANK_EMPTY', outputs: [`@worktrees/helpers/${HELPER}/runs/${RUN_ID}/run.json`] }), queue: null }, 'an empty reading that wrote nothing');
await expectValid({ run: v22Run({ stop: 'BANK_EMPTY', outcome: 'empty', outputs: [`@worktrees/helpers/${HELPER}/runs/${RUN_ID}/run.json`], bankBefore: { queueHash: null, approvalHash: null, entries: [] }, bankAfter: { queueHash: null, approvalHash: null, entries: [] } }), queue: null }, 'a v2.2 empty run that preserved a no-bank snapshot');

// A mission with no evidence ref is an idea, not a mission.
await expectError({ missions: [{ ...MISSIONS[0], evidenceRefs: [] }, MISSIONS[1], MISSIONS[2]] }, 'evidenceRefs', 'a mission drafted from nothing');
// A tier hint nobody can trace is a decision in disguise.
await expectError({ missions: [MISSIONS[0], { ...MISSIONS[1], tierHint: 'journey' }, MISSIONS[2]] }, 'names no unchecked: evidence ref', 'an invented tier hint');
// The queue is ordered by what a mission waits for, then by priority.
await expectError({ queue: queueDoc([ENTRIES[1], ENTRIES[0], ENTRIES[2]]) }, 'a drafted bank comes out as', 'a queue that ignores priority');
await expectError({ queue: queueDoc([ENTRIES[0], ENTRIES[2], ENTRIES[1]]) }, 'a drafted bank comes out as', 'a queue that ignores its own dependency order');
// The bank and its missions name the run that drafted them.
await expectError({ queue: queueDoc(ENTRIES, { helper: HELPER, runId: '20260101-000000' }) }, 'bankedBy does not name run', 'a queue that names another run');
await expectError({ missions: [{ ...MISSIONS[0], bankedBy: { helper: 'other-helper', runId: RUN_ID } }, MISSIONS[1], MISSIONS[2]] }, 'bankedBy does not name run', 'a mission that names another helper');
// A helper writes only what its package declares.
await expectError({ run: runDoc({ outputs: [...runDoc().outputs, '@workspaces/fe/app/page.tsx'] }) }, 'is under no Writes alias', 'a run that wrote product source');
// A stop writes no bank.
await expectError({ run: runDoc({ stop: 'BANK_UNGROUNDED' }) }, 'a bank is written whole or not at all', 'a stop that still left a bank');
// The queue, the missions and the folders are one bank.
await expectError({ missions: MISSIONS.slice(0, 2) }, 'has no prove-the-detail-surface/mission.json', 'an entry with no mission');
await expectError({ docs: false }, 'mission.md: missing', 'a mission the person cannot read');
await expectError({ run: runDoc({ args: { ...runDoc().args, limit: 2 } }) }, 'past the run\'s limit of 2', 'a bank longer than the run allowed');
await expectError({ run: runDoc({ runId: '20260101-000000' }) }, 'is not the folder', 'a run record that names another run');
await expectError({ run: v22Run({ sourceCoverage: [{ ref: '@knowledge/unknown', state: 'valid', evidence: ['@knowledge/unknown'] }] }) }, 'is absent from inputs', 'v2.2 coverage over an unread source');
await expectError({ run: v22Run({ sourceCoverage: [{ ref: runDoc().inputs[0].ref, state: 'missing', evidence: [runDoc().inputs[0].ref] }] }) }, 'requires outcome incomplete', 'v2.2 missing coverage reported as drafted');
await expectError({ run: v22Run({ bankBefore: bankSummary(BANK_HASH, [{ ...ENTRIES[0], status: 'running:s-other' }, ENTRIES[1], ENTRIES[2]]) }) }, 'status running:s-other was not preserved', 'v2.2 refresh that reopened a running mission');

process.stdout.write('generate-banks self-test: one lawful bank, one lawful stop and every mutation refused\n');
