// Three dispatch-side defects of 2026-10-09 (runtime 3cf4005fa), each with the owner its duty was missing:
//   1. an approved leg whose plan declares no write set came to the Kernel as free text: the runtime proposes the op contract's families (leg-proposal.mjs) as a picked choice;
//   2. shape-refused carried only a sentence and classified a typed sds-gap blocker as a too-narrow grant by its prose: the typed blocker kind now classifies, and the item carries
//      the failed attempt's own blocker and the paths it reported as a ready choice;
//   3. a ready job refused for the same cause was routed and refused every push: the refusal is remembered on the job and retried on a growing interval or at once on a change.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { proposedLegPaths, featureFamiliesOf, requiredKernelParamsOf } from '../../scripts/kernel/leg-proposal.mjs';
import { buildMenu } from '../../scripts/kernel/kernel-menu.mjs';
import { causesOf, isShapeCause, CAUSES } from '../../scripts/kernel/progress-rca.mjs';
import { fingerprintOf, isHeld, memoOf, nextMemo } from '../../scripts/kernel/dispatch-refusal-memo.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { makeTempDir } from '../../scripts/api/fs/make-temp-dir.mjs';
import { withLedger } from '../helpers/ledger-fixture.mjs';

const tree = (t, features) => {
  const dir = makeTempDir('starci-leg-proposal-');
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 25 }));
  for (const feature of features) { fs.mkdirSync(path.join(dir, '.starciwork', 'features', feature), { recursive: true }); fs.writeFileSync(path.join(dir, '.starciwork', 'features', feature, 'index.yaml'), `id: ${feature}\n`); }
  return dir;
};

test('the rev-ack item teaches the attestation a Kernel seat can run (a digest, no file)', async () => {
  const { menuCatalog } = await import('../../scripts/kernel/kernel-menu.mjs');
  const effect = menuCatalog().kinds.find((kind) => kind.id === 'rev-ack').options[0].effect;
  assert.match(effect, /--digest <readToken>/);
  assert.doesNotMatch(effect, /read-manifest/);
});

test('the parameters only the Kernel can set are named for the op that needs them', () => {
  assert.deepEqual(requiredKernelParamsOf({ skillRoot, op: 'provision.ask' }), ['subject']);
  assert.deepEqual(requiredKernelParamsOf({ skillRoot, op: 'interface.audit' }), ['audit']);
  assert.deepEqual(requiredKernelParamsOf({ skillRoot, op: 'review.verify' }), ['mode'], 'the default mode `select` is planning only: dispatch refuses it');
  assert.deepEqual(requiredKernelParamsOf({ skillRoot, op: 'scope.define' }), []);
  assert.deepEqual(requiredKernelParamsOf({ skillRoot, op: 'no.such.op' }), []);
});

test('the proposed write set of a leg is the op contract\'s feature families of every feature the trees hold, never a guess', (t) => {
  const one = tree(t, ['authentication', 'system-health']);
  const two = tree(t, ['authentication']);
  assert.equal(proposedLegPaths({ skillRoot, op: 'interface.draw', trees: [one, two] }), '.starciwork/features/authentication/ui,.starciwork/features/system-health/ui');
  // work.author declares planned identity, environment and fixture slots (contract: "the kernel's owned_paths for such a dispatch include exactly those slot directories"): the proposal grants them
  // with the leg, otherwise a uat flow's accounts have no identity slot to be declared in and the report is refused outside owned_paths (premortem walk, work.author).
  assert.match(proposedLegPaths({ skillRoot, op: 'work.author', trees: [two] }), /^\.starciwork\/features\/authentication\/impl,.*uat,\.starciwork\/_resources\/environments,\.starciwork\/_resources\/fixtures,\.starciwork\/_resources\/identities$/);
  assert.equal(proposedLegPaths({ skillRoot, op: 'work.author', trees: [] }), '.starciwork/_resources/environments,.starciwork/_resources/fixtures,.starciwork/_resources/identities', 'no feature yet: the slots the op declares are still granted');
  assert.equal(proposedLegPaths({ skillRoot, op: 'interface.draw', trees: [] }), '', 'no tree holds a feature: nothing to propose');
  assert.equal(proposedLegPaths({ skillRoot, op: 'no.such.op', trees: [one] }), '');
  assert.deepEqual(featureFamiliesOf({ writes: [{ path: '.starciwork/features/<feature>/ui/<name>/index.yaml' }, { path: '.starciwork/shell/index.yaml' }, { path: '.starciwork/features/<feature>/{a,b}/x' }] }), ['ui']);
});

const legAction = (over = {}) => ({ kind: 'dispatch', origin: 'approved-leg-open', op: 'interface.draw', reason: 'approved leg interface.draw has no job', attest: '', ...over });
const menuOf = (nextActions, extra = {}) => buildMenu({ workflow: 'wf-1', rev: 'r', jobDecisions: [], shapeRefused: [], questions: [], peers: [], wedged: [], deadWaits: [], decisions: [], nextActions, handover: null, feedback: null, snoozed: new Set(), ...extra });

test('the leg-ready item offers the proposed write set as a pickable choice and free text only as the escape', () => {
  const [item] = menuOf([legAction({ proposed: '.starciwork/features/authentication/ui' })]);
  assert.deepEqual(item.options.map((o) => o.choice), ['enqueue-proposed', 'enqueue-leg', 'none-fits']);
  const pick = item.options[0];
  assert.equal(pick.text, undefined, 'a pick takes no input');
  assert.deepEqual(pick.args, { workflow: 'wf-1', op: 'interface.draw', paths: '.starciwork/features/authentication/ui' });
  assert.match(item.options[1].effect, /^escape/);
  const bare = menuOf([legAction()])[0];
  assert.deepEqual(bare.options.map((o) => o.choice), ['enqueue-leg', 'none-fits'], 'nothing proposed: only the escape remains');
});

test('the shape-refused item carries the paths the failed attempt reported as a ready choice, free text as the escape', () => {
  const refused = { jobId: 'op-a-2', op: 'work.author', failedJobId: 'op-a-1', situation: 'a failed shape', reported: 'apps/app/src/a.ts,apps/app/src/b.ts' };
  const [item] = menuOf([], { shapeRefused: [refused] });
  assert.deepEqual(item.options.map((o) => o.choice), ['widen-reported', 'widen', 'none-fits']);
  assert.equal(item.options[0].args['add-paths'], 'apps/app/src/a.ts,apps/app/src/b.ts');
  assert.equal(item.options[1].text, 'paths');
  assert.deepEqual(menuOf([], { shapeRefused: [{ ...refused, reported: '' }] })[0].options.map((o) => o.choice), ['widen', 'none-fits']);
});

const blocked = (kind, detail, extra = {}) => ({ status: 'failed', result: { verdict: 'fail' }, report: { outcome: 'blocked', blocker: { kind, detail }, summary: detail, ...extra } });

test('a typed blocker kind classifies the failure; its prose never overrules it, and an upstream record gap is no shape cause', () => {
  const prose = 'the SDS leaves the session record out; the fix lives outside the owned paths and beyond the grant';
  const sds = causesOf(blocked('sds-gap', prose));
  assert.deepEqual(sds, ['record-gap'], 'the typed sds-gap wins over the words "outside the owned"');
  assert.equal(sds.some(isShapeCause), false, 'so the same-shape guard does not stand over the route\'s upstream repair');
  assert.ok(CAUSES['record-gap']);
  for (const kind of ['srs-gap', 'interface-gap', 'brand-gap']) assert.deepEqual(causesOf(blocked(kind, prose)), ['record-gap'], kind);
  assert.deepEqual(causesOf(blocked('shared-change', 'a shared file')), ['grant-too-narrow']);
  assert.deepEqual(causesOf(blocked('test-gap', 'the files do not exist and nothing is covered')), ['test-gap'], 'typed test-gap is not also a missing-paths verdict');
});

test('a recorded check that exited 124 is a timeout by its exit code; prose classifies only a report that names no kind', () => {
  const timeout = causesOf({ status: 'failed', result: {}, report: { outcome: 'failed', checks: [{ name: 'lint', exitCode: 124, evidence: 'killed' }] } });
  assert.ok(timeout.includes('tool-timeout'));
  const noKind = causesOf({ status: 'failed', result: {}, report: { outcome: 'blocked', blocker: { kind: 'other', detail: 'the change is outside the owned paths' } } });
  assert.deepEqual(noKind, ['grant-too-narrow'], 'a report with no typed kind falls back to its wording');
  assert.deepEqual(causesOf({ status: 'failed', result: {}, report: { outcome: 'blocked', blocker: { kind: 'authority', detail: 'cannot decide' } } }), ['other']);
});

const refusal = { code: 'grammar-context-missing', step: null, reason: 'interface.draw declares grammarContext: required and family-css: no brand record', watch: [] };

test('a refusal is held on a growing interval and tried at once when its cause changed', (t) => {
  withLedger(t, ({ ledger }) => {
    const db = ledger.db;
    db.exec('PRAGMA foreign_keys=OFF');
    db.prepare("INSERT INTO workflows(workflow_id,trace_id,phase,created_at,updated_at) VALUES('wf-1',?, 'running',1,1)").run('a'.repeat(32));
    const fp = (over = {}) => fingerprintOf({ db, workflowId: 'wf-1', refusal: { ...refusal, ...over }, rev: 'rev-1' });
    const first = nextMemo(null, { refusal, fingerprint: fp(), now: 1_000 });
    assert.deepEqual([first.count, first.nextAt - 1_000], [1, 60_000]);
    assert.equal(isHeld(first, { fingerprint: fp(), now: 30_000 }), true, 'inside the interval, same cause: left alone');
    assert.equal(isHeld(first, { fingerprint: fp(), now: 61_001 }), false, 'the interval ran out: tried again');
    const intervals = [first];
    for (let i = 0; i < 6; i += 1) intervals.push(nextMemo(intervals.at(-1), { refusal, fingerprint: fp(), now: intervals.at(-1).nextAt }));
    assert.deepEqual(intervals.map((m) => m.nextAt - m.lastAt), [60_000, 120_000, 240_000, 480_000, 900_000, 900_000, 900_000], 'doubles to the declared cap');
    assert.equal(intervals.at(-1).firstAt, 1_000, 'the first time the cause was met is kept');
    assert.equal(fp({ reason: `${refusal.reason} request ID: 1d7c2d99-892c-84a9-b9a8-9c47101f6bbc` }), fp({ reason: `${refusal.reason} request ID: 77ca1015-461b-85ce-b600-755e932319a5` }), 'a request id is not a cause');
    assert.notEqual(fingerprintOf({ db, workflowId: 'wf-1', refusal, rev: 'rev-2' }), fp(), 'another runtime revision: tried at once');
    const beforeRuling = fp();
    ledger.appendEvent({ workflowId: 'wf-1', entityType: 'workflow', entityId: 'wf-1', kind: 'kernel-decision', createdAt: 5, payload: {} });
    assert.notEqual(fp(), beforeRuling, 'a ruling the Kernel or the owner gave: tried at once');
    const watched = makeTempDir('starci-refusal-watch-');
    t.after(() => fs.rmSync(watched, { recursive: true, force: true, maxRetries: 10, retryDelay: 25 }));
    const file = path.join(watched, 'index.yaml');
    const before = fp({ watch: [file] });
    fs.writeFileSync(file, 'brand\n');
    assert.notEqual(fp({ watch: [file] }), before, 'a resource the refusal names appeared: tried at once');
    assert.equal(memoOf({ dispatchRefusal: first }), first);
    assert.equal(memoOf({}), null);
  });
});
