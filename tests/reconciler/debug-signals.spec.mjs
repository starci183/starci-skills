// The signals Debug's questions needed and the runtime now emits where the fact occurs: a refusal row with the role (as-runtime-change-refused),
// the loosening on the land record (as-gate-loosening), the critic-run event (co-critic-independent) and the wake-tagged usage rows (fr-wake-acted).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadQuestions, answerQuestions } from '../../scripts/reconciler/debug-questions.mjs';
import { digestNumbers } from '../../scripts/reconciler/debug-digest-numbers.mjs';
import { refusalFacts } from '../../scripts/reconciler/debug-digest-machine.mjs';
import { logRefusal } from '../../scripts/guards/refusals.mjs';
import { landOutcomeOf } from '../../scripts/supervisor/land-record.mjs';
import { criticRunPayload } from '../../scripts/work/critic-run-record.mjs';

const NOW = 1_800_000_000_000;
const MIN = 60_000;
const n = digestNumbers();
const IDS = ['as-runtime-change-refused', 'as-gate-loosening', 'co-critic-independent', 'fr-wake-acted'];

const answers = (snapshot) => {
  const groups = loadQuestions().map((g) => ({ ...g, questions: g.questions.filter((q) => IDS.includes(q.id)) }));
  return Object.fromEntries(answerQuestions(groups, {}, { now: NOW, workflows: [], ...snapshot }, n).flatMap((g) => g.questions).map((q) => [q.id, q]));
};

test('the four questions are answerable, and so is every other: no documented gap is left', () => {
  const all = loadQuestions().flatMap((g) => g.questions);
  for (const id of IDS) assert.equal(all.find((q) => q.id === id).answerable, 'today', id);
  assert.deepEqual(all.filter((q) => q.answerable === 'gap').map((q) => q.id), []);
  assert.ok(all.every((q) => q.check && !q.signal && !q.why), 'every question names its check and carries no gap reason');
});

test('a refusal row carries the role and the digest counts the runtime changes the guard refused', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-refusals-'));
  const env = { ...process.env, STARCI_GUARDS_ROOT: dir };
  const previous = process.env.STARCI_GUARDS_ROOT;
  process.env.STARCI_GUARDS_ROOT = dir;
  try {
    logRefusal({ tool: 'Bash', via: 'pre-tool-use', role: 'supervisor', code: 'RUNTIME_CHANGE_OWNED_BY_DEBUG', command: 'starci land' });
    logRefusal({ tool: 'Bash', via: 'pre-tool-use', role: 'op', code: 'RIGHTS_OP_RUNTIME_WRITE', command: 'x' });
  } finally { if (previous === undefined) delete process.env.STARCI_GUARDS_ROOT; else process.env.STARCI_GUARDS_ROOT = previous; }
  const refusals = refusalFacts(env);
  fs.rmSync(dir, { recursive: true, force: true });
  assert.deepEqual(refusals.map((r) => [r.role, r.code]), [['supervisor', 'RUNTIME_CHANGE_OWNED_BY_DEBUG'], ['op', 'RIGHTS_OP_RUNTIME_WRITE']]);
  assert.match(answers({ refusals })['as-runtime-change-refused'].evidence, /1 runtime change\(s\) asked by supervisor and refused/);
  assert.match(answers({ refusals: [] })['as-runtime-change-refused'].evidence, /no runtime change was asked/);
});

test('the land record keeps the loosening with its approval id, and the digest flags a landed loosening nobody approved', () => {
  const checks = [{ name: 'gate-loosening', ok: false, approved: false, id: 'gate-loosening-abc', findings: [{}, {}] }];
  const refused = landOutcomeOf({ ok: false, reason: 'checks-failed', checks }, { commits: ['c1'], startedAt: NOW });
  assert.deepEqual(refused.run.specs.loosening, { id: 'gate-loosening-abc', approved: false, findings: 2 });
  const clean = landOutcomeOf({ ok: true, checks: [] }, { commits: ['c1'], startedAt: NOW });
  assert.equal(clean.run.specs.loosening, undefined);
  const fine = answers({ lands: [{ runId: 1, result: 'failed', approved: false }, { runId: 2, result: 'passed', approved: true }] })['as-gate-loosening'];
  assert.equal(fine.state, 'ok');
  assert.match(fine.evidence, /2 land\(s\) loosened a gate: 1 approved by the owner, 1 refused/);
  const bad = answers({ lands: [{ runId: 3, result: 'passed', approved: false }] })['as-gate-loosening'];
  assert.equal(bad.state, 'attention');
});

test('a critic-run names the Critic and the op provider; one on the maker\'s own provider is a departure', () => {
  const loop = { rounds: [{ n: 1, beauty: 8.5, critic: { provider: 'codex', model: 'm', judged: ['d1'] } }], best: { n: 1 } };
  const run = criticRunPayload({ label: 'blob:abc', loop }, { job_id: 'j1', op_id: 'interface.draw' }, 'claude');
  assert.deepEqual([run.criticProvider, run.opProvider, run.independent, run.judged, run.used], ['codex', 'claude', true, 1, true]);
  assert.equal(criticRunPayload({ label: 'x', loop: { rounds: [{ n: 1 }], best: { n: 1 } } }, { job_id: 'j1' }, 'claude'), null);
  const ev = (independent) => ({ kind: 'critic-run', criticProvider: 'claude', opProvider: 'claude', independent });
  const snapshot = (events) => ({ workflows: [{ events }] });
  assert.equal(answers(snapshot([]))['co-critic-independent'].state, 'unknown');
  assert.equal(answers(snapshot([{ ...ev(true), criticProvider: 'codex' }]))['co-critic-independent'].state, 'ok');
  assert.equal(answers(snapshot([ev(false)]))['co-critic-independent'].state, 'attention');
});

test('a wake with no turn of the agent after it is an ignored wake; two wakes seconds apart share one answer', () => {
  const wake = (seq, minutesAgo, turns) => ({ seq, at: NOW - minutesAgo * MIN, turns, tokens: turns * 10 });
  const flow = (wakes) => ({ workflows: [{ name: 'Wf', kernelWakes: wakes }] });
  assert.equal(answers(flow([wake(1, 60, 0)]))['fr-wake-acted'].state, 'unknown', 'nothing measured: the answer is unknown, not ignored');
  assert.equal(answers(flow([wake(1, 60, 5), wake(2, 30, 3)]))['fr-wake-acted'].state, 'ok');
  assert.equal(answers(flow([wake(1, 60, 5), wake(2, 30, 0)]))['fr-wake-acted'].state, 'attention');
  assert.equal(answers(flow([{ ...wake(1, 30, 0), at: NOW - 30 * MIN }, { ...wake(2, 30, 4), at: NOW - 30 * MIN + 5000 }]))['fr-wake-acted'].state, 'ok', 'a wake followed by another within wakeActMs');
  assert.equal(answers(flow([wake(1, 60, 5), wake(2, 2, 0)]))['fr-wake-acted'].state, 'ok', 'a wake younger than the grace is not judged yet');
});
