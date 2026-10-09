// RT_OP_JUDGE_UNDECLARED: every op contract declares who judges its product (principle P2), and the declarations are held to the runtime's tables.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { opJudgeFindings, loadFacts, checkOpJudge } from '../../scripts/checks/check-op-judge.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const BASE = loadFacts(ROOT);
const facts = (change) => { const copy = structuredClone(BASE); change(copy); return copy; };
const messages = (change) => opJudgeFindings(facts(change)).map((finding) => finding.path + ': ' + finding.message).join('\n');
const entry = (copy, op, by) => copy.contracts[op].judge.find((row) => row.by === by);

test('the tree is green: all 38 ops declare a judge and the declarations match the runtime tables (passing)', () => {
  assert.deepEqual(checkOpJudge(ROOT), []);
  assert.equal(BASE.ids.length, 38);
  for (const op of BASE.ids) assert.ok(BASE.contracts[op].judge.length >= 1, `${op} declares at least one judge`);
});

test('the Critic is declared for exactly the ops the Critic table covers, and the owner only where an owner gate exists (passing)', () => {
  const withKind = (by) => BASE.ids.filter((op) => BASE.contracts[op].judge.some((row) => row.by === by)).sort();
  assert.deepEqual(withKind('critic'), BASE.critic.coverage.filter((row) => row.status === 'covered').map((row) => row.kind).sort());
  assert.deepEqual(withKind('owner'), Object.keys(BASE.registry.ownerGates).sort());
  assert.equal(entry(BASE, 'scope.define', 'critic').runs, 'runtime');
  assert.equal(entry(BASE, 'interface.draw', 'critic').runs, 'in-op');
});

test('an op with no judge, an empty list, an unknown kind or an entry without a why is refused (violating)', () => {
  assert.match(messages((copy) => { delete copy.contracts['business.decide'].judge; }), /business\.decide\.yaml.*has no judge/);
  assert.match(messages((copy) => { copy.contracts['business.decide'].judge = []; }), /judge is empty/);
  assert.match(messages((copy) => { copy.contracts['business.decide'].judge[0].by = 'nobody'; }), /unknown kind "nobody"/);
  assert.match(messages((copy) => { delete copy.contracts['business.decide'].judge[0].why; }), /judge machine entry has no why/);
});

test('a machine judge must be a measure the runtime owns: an invented one, a missing one, an inapplicable one and a process-only one are refused (violating)', () => {
  assert.match(messages((copy) => { entry(copy, 'backend.implement', 'machine').measures.push('my-own-tests'); }), /names my-own-tests, which .* does not list/);
  assert.match(messages((copy) => { entry(copy, 'backend.implement', 'machine').measures = ['declared-checks', 'work-hygiene', 'sonar-gate']; }), /leaves out op-gate/);
  assert.match(messages((copy) => { entry(copy, 'unit.verify', 'machine').measures.push('sonar-gate'); }), /names sonar-gate, which the runtime does not apply to unit\.verify/);
  assert.match(messages((copy) => { entry(copy, 'unit.verify', 'machine').measures = ['declared-checks', 'op-gate']; }), /leaves out op-proof:unit-kit/);
  assert.match(messages((copy) => { entry(copy, 'business.decide', 'machine').measures = ['op-proof:read-knowledge']; }), /rests on process measures alone/);
  assert.match(messages((copy) => { entry(copy, 'business.decide', 'machine').proofs = ['no-such-proof']; }), /cites the proof no-such-proof/);
  assert.match(messages((copy) => { entry(copy, 'review.verify', 'machine').proofs = ['review-gate']; }), /contract-script but cites no proof whose check: is a script of its own/);
});

test('a machine judge is not an op-written test: a measure whose independence is the maker is refused (violating)', () => {
  assert.match(messages((copy) => { copy.registry.measures['op-gate'].independence = 'maker'; }), /op-gate has the independence maker/);
  assert.match(messages((copy) => { copy.registry.measures['op-gate'].source = 'scripts/kernel/no-such-file.mjs'; }), /op-gate names the source .*, which does not exist/);
});

test('the Critic declaration and the Critic table cannot drift apart (violating)', () => {
  assert.match(messages((copy) => { copy.contracts['business.decide'].judge.push({ by: 'critic', rubric: 'x', runs: 'runtime', why: 'x' }); }), /coverage has no row for business\.decide/);
  assert.match(messages((copy) => { copy.contracts['scope.define'].judge = copy.contracts['scope.define'].judge.filter((row) => row.by !== 'critic'); }), /marks scope\.define covered but the contract declares no critic judge/);
  assert.match(messages((copy) => { copy.critic.coverage.find((row) => row.kind === 'scope.define').status = 'owed'; }), /coverage row of scope\.define is owed, not covered/);
  assert.match(messages((copy) => { entry(copy, 'scope.define', 'critic').runs = 'in-op'; }), /runs in-op, but the coverage row of scope\.define says .* run by the runtime/);
  assert.match(messages((copy) => { entry(copy, 'scope.define', 'critic').rubric = 'modules/kernel/critic-rubrics.yaml#kinds[id=other]'; }), /rubric must be .*kinds\[id=scope\.define\]/);
  assert.match(messages((copy) => { entry(copy, 'interface.draw', 'critic').rubric = 'scripts/work/no-such-critic.mjs'; }), /rubric .* is not a file the coverage row of interface\.draw names/);
});

test('an owner is declared only where an owner gate exists, and a gate whose anchor is gone is found (violating)', () => {
  assert.match(messages((copy) => { copy.contracts['backend.implement'].judge.push({ by: 'owner', why: 'x' }); }), /ownerGates has no gate for backend\.implement/);
  assert.match(messages((copy) => { copy.contracts['handover.review'].judge = copy.contracts['handover.review'].judge.filter((row) => row.by !== 'owner'); }), /ownerGates names a gate for handover\.review but the contract declares no owner judge/);
  assert.match(messages((copy) => { copy.registry.ownerGates['handover.review'].anchor = 'a-text-no-file-holds'; }), /ownerGates handover\.review: .* no longer holds/);
});

test('a next-leg is a registered reviewer of the op, and a registered reviewer is declared (violating)', () => {
  assert.match(messages((copy) => { copy.contracts['backend.implement'].judge.push({ by: 'next-leg', leg: 'unit.verify', why: 'x' }); }), /next-leg unit\.verify is not a registered reviewer of backend\.implement/);
  assert.match(messages((copy) => { copy.contracts['backend.implement'].judge = copy.contracts['backend.implement'].judge.filter((row) => row.by !== 'next-leg'); }), /registers review\.verify as a reviewer of backend\.implement but the contract declares no next-leg review\.verify/);
  assert.match(messages((copy) => { copy.registry.reviewers['review.verify'].anchor = 'a-sentence-the-goal-lacks'; }), /reviewers review\.verify: the goal of its contract no longer says/);
});
