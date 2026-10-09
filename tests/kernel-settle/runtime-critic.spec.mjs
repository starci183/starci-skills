// Nivo 2026-10-09: architecture.decide (admitted and reported 2026-10-07) was refused op-critic-verdict-missing by a gate that landed the night
// after its admission; its worker was gone and its contract never told it to run a Critic, so nothing could cure the refusal. The runtime owes the
// Critic of a done report that has no verdict of its own: the settler runs it (once per product digest), the settle gate judges its verdict, and a
// Critic that cannot judge is a hold, never a refusal. Specs use the fake Critic seam, as the Critic specs do.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { kernelTerminalOf, OP_VERDICT_IGNORED_EVENT, runtimeCriticFor, runtimeCriticRunOf, RUNTIME_CRITIC_EVENT } from '../../scripts/kernel/settle/critic-run.mjs';
import { judgeCriticVerdict } from '../../scripts/kernel/critic-settle.mjs';
import { criticFor } from '../../scripts/work/critic-pick.mjs';
import { productDigests, productFiles, kindEntryOf, criticRubrics } from '../../scripts/work/decision-critic-product.mjs';
import { allocationSettings } from '../../engine/config.mjs';

const OP = 'architecture.decide';
const rubrics = criticRubrics();
const entry = kindEntryOf(OP, rubrics);

/** A work tree holding one architecture record, and the digests the Critic would judge. */
function treeWithRecord(t) {
  const tree = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-critic-run-'));
  t.after(() => fs.rmSync(tree, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const dir = path.join(tree, '.starciwork', 'features', 'authentication', 'sds', 'accounts');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.yaml'), 'id: accounts\nkind: sds\n');
  return tree;
}

/** The verdict document a Critic of `critic` returns for the product of `tree`. */
function verdictFor(tree, { critic = 'codex', maker = 'claude', beauty = 9 } = {}) {
  const workRoot = path.join(tree, '.starciwork');
  const digests = productDigests({ workRoot, entry, inputs: rubrics.inputs, within: ['features/authentication/sds'] });
  return { schema: 'starci/critic-verdict@1', op: OP, kind: OP, at: new Date().toISOString(), maker, critic: { provider: critic }, rubric: { source: `modules/kernel/critic-rubrics.yaml id=${entry.id}`, checks: entry.checks.length },
    beauty, minimum: entry.minimum, pass: beauty >= entry.minimum, product: digests.product, inputs: digests.inputs, unhanded: [],
    checks: entry.checks.map((check) => ({ id: check.id, pass: beauty >= entry.minimum, evidence: 'read', fix: beauty >= entry.minimum ? null : 'fix it' })), summary: 'judged' };
}

const world = async (t, fn) => withLedger(t, async ({ ledger }) => {
  const tree = treeWithRecord(t);
  seedWorkflow(ledger, { id: 'wf-c', goal: { revision: 1, markdown: '# c' }, jobs: [{ jobId: 'op-arch', opId: OP, status: 'reported', pool: 'claude-agent',
    payload: { opId: OP, owned_paths: ['.starciwork/features/authentication/sds'], model: 'claude-agent' } }] });
  ledger.db.prepare("UPDATE op_attempts SET provider='claude' WHERE job_id='op-arch'").run();
  const item = { jobId: 'op-arch', workflowId: 'wf-c', op: OP, outcome: 'done' };
  await fn({ ledger, tree, item });
});

test('a done report admitted before the Critic rule settles after a runtime-run Critic pass, and the run is recorded once per digest', (t) => world(t, async ({ ledger, tree, item }) => {
  const calls = [];
  const critique = async (args) => { calls.push(args); return { critique: { code: null, critic: { provider: 'codex', model: 'gpt-x' } }, document: verdictFor(tree) }; };
  const first = await runtimeCriticFor(ledger, item, { tree, retryMs: 60_000, critique, entry: 'term_kernel' });
  assert.deepEqual([first.ran, first.pass], [true, true]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].entry, 'term_kernel', 'the Critic is launched from the Kernel terminal: Orca refuses a run-create with no sender (no_active_sender_terminal)');
  assert.equal(calls[0].kind, OP);
  assert.deepEqual(calls[0].maker, { provider: 'claude', model: null }, 'the Critic is asked to judge a product made by the op provider');
  assert.equal(calls[0].records.length, productFiles({ workRoot: path.join(tree, '.starciwork'), entry, within: ['features/authentication/sds'] }).length);
  assert.equal(await runtimeCriticFor(ledger, item, { tree, retryMs: 60_000, critique }), null, 'the same digest is not judged twice');
  assert.equal(calls.length, 1);
  const recorded = runtimeCriticRunOf(ledger.db, 'op-arch');
  assert.deepEqual([recorded.outcome, recorded.pass, recorded.maker, recorded.critic.provider], ['verdict', true, 'claude', 'codex']);
  assert.equal(ledger.db.prepare('SELECT count(*) n FROM events WHERE kind=?').get(RUNTIME_CRITIC_EVENT).n, 1);
  const judged = judgeCriticVerdict({ op: OP, roots: [tree], owned: ['.starciwork/features/authentication/sds'], runtime: recorded.document });
  assert.equal(judged.status, 'pass', JSON.stringify(judged));
  const without = judgeCriticVerdict({ op: OP, roots: [tree], owned: ['.starciwork/features/authentication/sds'] });
  assert.equal(without.code, 'op-critic-verdict-missing', 'with no run recorded the refusal says the runtime owes it');
  assert.equal(judgeCriticVerdict({ op: OP, roots: [tree], owned: [] }).code, 'op-critic-verdict-missing');
}));

test('a failing critique is the op\'s error-work with the critique attached', (t) => world(t, async ({ ledger, tree, item }) => {
  const critique = async () => ({ critique: { code: null, critic: { provider: 'codex' } }, document: verdictFor(tree, { beauty: 4 }) });
  const ran = await runtimeCriticFor(ledger, item, { tree, retryMs: 60_000, critique });
  assert.deepEqual([ran.ran, ran.pass], [true, false]);
  const judged = judgeCriticVerdict({ op: OP, roots: [tree], owned: ['.starciwork/features/authentication/sds'], runtime: runtimeCriticRunOf(ledger.db, 'op-arch').document });
  assert.equal(judged.code, 'op-critic-verdict-failed');
  assert.ok(judged.findings.length > 0, 'every failed check travels with its evidence and fix');
}));

test('a Critic that cannot judge is a typed hold, retried no sooner than the spacing, and the maker\'s own verdict is never trusted', (t) => world(t, async ({ ledger, tree, item }) => {
  let runs = 0;
  const critique = async () => { runs += 1; return { critique: { code: 'CRITIC_QUOTA_OUT', error: 'quota', critic: { provider: 'codex' } }, document: null }; };
  const held = await runtimeCriticFor(ledger, item, { tree, retryMs: 60_000, now: 1_000_000, critique });
  assert.deepEqual(held, { hold: { code: 'CRITIC_QUOTA_OUT', error: 'quota' } });
  assert.deepEqual(await runtimeCriticFor(ledger, item, { tree, retryMs: 60_000, now: 1_030_000, critique }), { hold: { code: 'CRITIC_QUOTA_OUT', error: 'quota' } });
  assert.equal(runs, 1, 'inside the spacing the hold is read back, the Critic is not launched again');
  await runtimeCriticFor(ledger, item, { tree, retryMs: 60_000, now: 1_100_000, critique });
  assert.equal(runs, 2);
  const own = judgeCriticVerdict({ op: OP, roots: [tree], owned: ['.starciwork/features/authentication/sds'], runtime: verdictFor(tree, { critic: 'claude', maker: 'claude' }) });
  assert.equal(own.code, 'CRITIC_NO_INDEPENDENT_MEMBER');
}));

test('the picker never chooses the provider that made the product, and a report that is not a decision leg owes no run', (t) => world(t, async ({ ledger, tree, item }) => {
  const pick = criticFor(allocationSettings().drawLoop, 'claude');
  assert.ok(pick.error || pick.critic.provider !== 'claude', 'the Critic of a claude product is not claude');
  assert.equal(await runtimeCriticFor(ledger, { ...item, outcome: 'ask' }, { tree, retryMs: 1, critique: async () => assert.fail('no run for an ask') }), null);
  assert.equal(await runtimeCriticFor(ledger, { ...item, op: 'work.author' }, { tree, retryMs: 1, critique: async () => assert.fail('no run for an op without a Critic') }), null);
}));

test('a verdict the op attached is ignored and recorded as such: the runtime still runs its own Critic, once per digest, and judges only that run (the maker never supplies its own judge verdict)', (t) => world(t, async ({ ledger, tree, item }) => {
  ledger.db.prepare("INSERT INTO blobs(sha256,bytes,media_type,file_uri,created_at) VALUES(?,?,?,?,?)").run('a'.repeat(64), 1, 'application/json', 'work/blob', Date.now());
  const attempt = ledger.db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=?').get('op-arch').attempt_id;
  ledger.db.prepare("INSERT INTO job_artifacts(workflow_id,attempt_id,job_id,op_id,role,kind,name,sha256,bytes,media_type,origin,created_at) VALUES('wf-c',?,'op-arch',?,'report-attachment','file','attachments/critic-verdict.json',?,1,'application/json','op',?)").run(attempt, OP, 'a'.repeat(64), Date.now());
  let runs = 0;
  const critique = async () => { runs += 1; return { critique: { code: null, critic: { provider: 'codex', model: 'gpt-x', ms: 4200, dispatchId: 'ctx_c1' } }, document: verdictFor(tree, { beauty: 4 }) }; };
  const first = await runtimeCriticFor(ledger, item, { tree, retryMs: 60_000, critique });
  assert.deepEqual([first.ran, first.pass, runs], [true, false, 1], 'the attached verdict does not stand in for the run of the runtime');
  assert.equal(await runtimeCriticFor(ledger, item, { tree, retryMs: 60_000, critique }), null);
  const ignored = ledger.db.prepare('SELECT payload_json FROM events WHERE kind=?').all(OP_VERDICT_IGNORED_EVENT);
  assert.equal(ignored.length, 1, 'recorded once');
  assert.equal(JSON.parse(ignored[0].payload_json).file, 'attachments/critic-verdict.json');
  const run = runtimeCriticRunOf(ledger.db, 'op-arch');
  assert.deepEqual([run.critic.provider, run.critic.model, run.critic.durationMs, run.critic.dispatchId, run.try], ['codex', 'gpt-x', 4200, 'ctx_c1', 1], 'who, model, time and dispatch are on the journal');
}));

test('a Critic that cannot judge is launched at most maxAttempts times for the same bytes, then only read back', (t) => world(t, async ({ ledger, tree, item }) => {
  let runs = 0;
  const critique = async () => { runs += 1; return { critique: { code: 'CRITIC_UNAVAILABLE', error: 'down', critic: { provider: 'codex' } }, document: null }; };
  for (let i = 0; i < 6; i += 1) await runtimeCriticFor(ledger, item, { tree, retryMs: 10, maxAttempts: 3, now: 1_000_000 + i * 100, critique });
  assert.equal(runs, 3, 'bounded: the Critic is not launched again for the same digest');
  assert.deepEqual((await runtimeCriticFor(ledger, item, { tree, retryMs: 10, maxAttempts: 3, now: 9_000_000, critique })).hold.code, 'CRITIC_UNAVAILABLE');
  assert.equal(runtimeCriticRunOf(ledger.db, 'op-arch').try, 3);
}));

test('the Kernel terminal of a workflow is read from its kernel signal', (t) => withLedger(t, ({ ledger }) => {
  seedWorkflow(ledger, { id: 'wf-s', goal: { revision: 1, markdown: '# s' }, jobs: [], signals: [{ scope: 'kernel', key: 'wf-s', value: { terminal: 'term_kernel_s' } }] });
  assert.equal(kernelTerminalOf(ledger.db, 'wf-s'), 'term_kernel_s');
  assert.equal(kernelTerminalOf(ledger.db, 'wf-none'), null);
}));
