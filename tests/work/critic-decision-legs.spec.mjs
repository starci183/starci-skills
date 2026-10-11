import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sha256 } from '../../engine/digest.mjs';
import { allocationSettings } from '../../engine/config.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { criticFor } from '../../scripts/work/critic-pick.mjs';
import { coverageOf, criticContract } from '../../scripts/work/critic-contract.mjs';
import { critiqueDecision, decisionCriticMain } from '../../scripts/work/decision-critic.mjs';
import { citedInputs, criticRubrics, decisionRubric, kindEntryOf, ownedRelOf, productDigests, productFiles } from '../../scripts/work/decision-critic-product.mjs';
import { tierSettings } from '../../scripts/agent/tiers.mjs';
import { boundValue, refValue } from '../../scripts/kernel/op-incident-policy.mjs';
import { criticOwedBy, criticRefusalText, judgeCriticVerdict, recordCriticJudgment } from '../../scripts/kernel/critic-settle.mjs';
import { settlePreflight } from '../../scripts/kernel/verbs/shared/settle-preflight.mjs';
import { proofsOf } from '../../scripts/kernel/gate-settle.mjs';
import { fakeCriticOrca } from '../helpers/fake-critic-orca.mjs';
import { fakeAdmission } from '../helpers/fake-admission.mjs';
import { seedWorkflow, withLedger } from '../helpers/ledger-fixture.mjs';

// The independent Critic of the decision legs (scope.define, architecture.decide, business.decide): the rubric of each kind is data, the Critic is
// handed the op's decision records and the records they cite, one single pass runs under the Critic standard, and the settle gate
// requires a fresh passing verdict for exactly those bytes. The worker launch is a fake (the Orca client); a real run's cost is unmeasured.

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const KINDS = ['scope.define', 'architecture.decide', 'business.decide'];
const contract = criticContract();
const rubrics = criticRubrics();
const drawLoop = allocationSettings().drawLoop;
const clock = () => { let t = 0; return { now: () => t, sleep: async (ms) => { t += ms; } }; };

const put = (root, rel, text) => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  return file;
};

/** A repository with a work root: a decided requirement and decision, a scope record citing them, and two design records. */
function repo(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-critic-decision-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  put(root, '.starciwork/features/shop/index.yaml', [
    'schema: work/feature@1', 'id: feat.shop', 'title: Shop', 'description: A shop',
    'extensions:', '  work3:', '    scope:', '      request: {source: "the request"}', '      nodes:', '        - {id: n1, grounding: [br.pricing, src/pricing.ts]}',
    'refs: [dec.currency]', ''].join('\n'));
  put(root, '.starciwork/features/shop/br/pricing/index.yaml', 'schema: work/br@1\nid: br.pricing\ntitle: Pricing rule\n');
  put(root, '.starciwork/features/shop/decision/currency/index.yaml', 'schema: work/decision@1\nid: dec.currency\ntitle: One currency\n');
  put(root, 'src/pricing.ts', 'export const price = 1;\n');
  put(root, '.starciwork/features/shop/sds/billing/index.yaml', 'schema: work/sds-component@1\nid: sds.billing\ntitle: Billing\nrefs: [br.pricing]\n');
  put(root, '.starciwork/features/shop/contract/billing-api/index.yaml', 'schema: work/contract@1\nid: contract.billing\ntitle: Billing API\nrefs: [dec.currency]\ndependsOn: [sds.billing]\n');
  put(root, '.starciwork/features/other/index.yaml', 'schema: work/feature@1\nid: feat.other\ntitle: Other\n');
  return { root, workRoot: path.join(root, '.starciwork') };
}

const verdictFor = (kind, score, { failing = [] } = {}) => ({ schema: 'starci/decision-critique@1', score, anchor: String(score), summary: 'two sentences. here.',
  checks: kindEntryOf(kind, rubrics).checks.map((c) => ({ id: c.id, pass: !failing.includes(c.id), evidence: `read ${c.id}`, fix: failing.includes(c.id) ? `repair ${c.id}` : null })) });

const critique = (r, kind, orca, extra = {}) => critiqueDecision({ kind, workRoot: r.workRoot, maker: 'devin', orca, placement: { tmpRoot: r.root }, entry: 'term_op', ...clock(), ...extra });
// the settle reads only the verdict the runtime's own Critic run recorded: `runtime` is that event's document
const attach = (r, document) => document;
const OWNED = { 'scope.define': ['.starciwork/features/shop/index.yaml'], 'architecture.decide': ['.starciwork/features/shop/sds', '.starciwork/features/shop/contract'],
  'business.decide': ['.starciwork/features/shop/br', '.starciwork/features/shop/decision'] };
const judge = (r, kind, runtime) => judgeCriticVerdict({ op: kind, roots: [r.root], owned: OWNED[kind], runtime });

test('the rubric file validates: a rubric per kind, derived from its op contract, with checks, gates, anchors, a minimum and a token budget', () => {
  assert.equal(rubrics.schema, 'starci/module-kernel-critic-rubrics@1');
  assert.deepEqual(rubrics.kinds.map((row) => row.id), KINDS);
  assert.ok(rubrics.inputs.maxFiles > 0 && rubrics.inputs.maxBytes > 0);
  for (const row of rubrics.kinds) {
    assert.ok(fs.existsSync(path.join(ROOT, row.op)), `${row.id} names its op contract`);
    const op = parseYaml(fs.readFileSync(path.join(ROOT, row.op), 'utf8'));
    assert.equal(op.id, row.id);
    for (const proof of row.derivedFrom.join(' ').match(/proofs\[([^\]]+)\]/)[1].split(', ')) assert.ok(op.proofs.some((p) => p.id === proof), `${row.id} proof ${proof} exists in the contract`);
    for (const schema of row.derivedFrom.join(' ').match(/work-[a-z-]+\.schema\.yaml/g)) assert.ok(fs.existsSync(path.join(ROOT, 'modules', 'schemas', schema)), `${schema} exists`);
    const ids = row.checks.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length, 'check ids are unique');
    assert.ok(row.checks.length >= 8);
    assert.ok(row.checks.every((c) => c.check && c.test && c.group), 'every check says what it checks and how to see it');
    assert.ok(row.checks.filter((c) => c.gate === true).length >= 3, 'the rubric has gate checks');
    assert.ok(Number.isFinite(row.minimum) && row.minimum >= 1 && row.minimum <= 10 && row.gateCap < row.minimum, 'a failed gate cannot reach the minimum');
    assert.ok(row.scoreAnchors.length >= 5 && row.scoreAnchors.every((a) => a.score && a.anchor));
    assert.ok(row.tokenBudget.perAttempt > 0 && row.tokenBudget.status === 'provisional');
    assert.ok(row.product.records.length >= 1 && row.cites.length >= 1);
    const rubric = decisionRubric(row);
    assert.equal(rubric.checks.length, row.checks.length);
    assert.equal(rubric.beautyAnchors, row.scoreAnchors, 'the Critic standard reads the anchors as the draw rubric does');
  }
  const text = JSON.stringify(rubrics.kinds[0].checks) + JSON.stringify(rubrics.kinds[1].checks);
  for (const needle of ['grounded', 'invented', 'Earlier decisions', 'Alternatives', 'Traceable', 'Sources']) assert.match(text, new RegExp(needle, 'i'), `a check covers ${needle}`);
});

test('critic.yaml covers both kinds, the refs resolve to the rubric file, and no kind is owed any more', () => {
  for (const kind of KINDS) {
    const row = coverageOf(kind);
    assert.equal(row.status, 'covered');
    assert.equal(boundValue(row.minimum), kindEntryOf(kind, rubrics).minimum);
    assert.equal(refValue(row.tokenBudget.ref).perAttempt, kindEntryOf(kind, rubrics).tokenBudget.perAttempt, 'the token budget of the critique is declared in the contract');
    assert.equal(criticOwedBy(kind)?.id, kind);
  }
  assert.deepEqual(contract.coverage.filter((row) => row.status === 'owed'), []);
  assert.equal(criticOwedBy('interface.draw'), null, 'the draw path has its own gate');
  assert.equal(criticOwedBy('brand.decide'), null);
  const registry = parseYaml(fs.readFileSync(path.join(ROOT, 'modules', 'reconciler', 'edge-cases.yaml'), 'utf8'));
  assert.equal(registry.cases.find((one) => one.id === 'critic-coverage-decision-legs').status, 'covered');
  for (const kind of KINDS) {
    const op = parseYaml(fs.readFileSync(path.join(ROOT, 'modules', 'ops', 'ops', `${kind}.yaml`), 'utf8'));
    assert.ok(op.proofs.some((p) => p.id === 'independent-critic'), `${kind} states the proof`);
    assert.ok(!op.writes.some((w) => w.id === 'critic-verdict'), 'the op writes no verdict: the runtime runs the Critic');
    assert.ok(!op.blockers.some((b) => b.code === 'CRITIC_HOLD'), 'the op holds nothing for the Critic: the settler does');
    assert.doesNotMatch(JSON.stringify(op.steps), /decision-critic/);
    assert.ok(proofsOf(kind).includes('read-knowledge'), 'the read proof is still owed');
  }
});

test('the product is the op\'s decision records and the inputs are the records they cite, found by id and by path', (t) => {
  const r = repo(t);
  const scope = kindEntryOf('scope.define', rubrics);
  assert.deepEqual(productFiles({ workRoot: r.workRoot, entry: scope }).map((f) => f.rel), ['features/other/index.yaml', 'features/shop/index.yaml']);
  assert.deepEqual(productFiles({ workRoot: r.workRoot, entry: scope, within: ['features/shop'] }).map((f) => f.rel), ['features/shop/index.yaml']);
  const product = productFiles({ workRoot: r.workRoot, entry: scope, within: ['features/shop'] });
  const { handed, unhanded } = citedInputs({ workRoot: r.workRoot, product, entry: scope, inputs: rubrics.inputs });
  assert.deepEqual(handed.map((h) => h.rel), ['features/shop/br/pricing/index.yaml', 'features/shop/decision/currency/index.yaml', 'repo:src/pricing.ts']);
  assert.deepEqual(unhanded, []);
  const small = citedInputs({ workRoot: r.workRoot, product, entry: scope, inputs: { maxFiles: 1, maxBytes: 100000 } });
  assert.equal(small.handed.length, 1);
  assert.equal(small.unhanded.length, 2, 'what is past the bound stays cited and unhanded');
  const arch = kindEntryOf('architecture.decide', rubrics);
  assert.deepEqual(productFiles({ workRoot: r.workRoot, entry: arch }).map((f) => f.rel), ['features/shop/contract/billing-api/index.yaml', 'features/shop/sds/billing/index.yaml']);
  const biz = kindEntryOf('business.decide', rubrics);
  assert.deepEqual(productFiles({ workRoot: r.workRoot, entry: biz }).map((f) => f.rel), ['features/other/index.yaml', 'features/shop/br/pricing/index.yaml', 'features/shop/decision/currency/index.yaml', 'features/shop/index.yaml'], 'business.decide judges the requirement, rule, criterion and decision records and the feature record, never the design');
  assert.equal(criticOwedBy('business.decide')?.id, 'business.decide', 'the runtime owes the business.decide Critic at settle');
  assert.equal(ownedRelOf('.starciwork/features/shop/sds/**'), 'features/shop/sds');
  assert.equal(ownedRelOf('src/x.ts'), null);
});

test('the Critic is handed the records, the cited inputs, a manifest and the rubric, judges once, and the verdict names the sha256 of every handed byte', async (t) => {
  const r = repo(t);
  const orca = fakeCriticOrca({ verdict: verdictFor('scope.define', 9) });
  const seen = [];
  const started = orca.workerStart;
  orca.workerStart = (a) => { seen.push(fs.readdirSync(a.worktree).sort()); return started(a); };
  const { critique: judged, document } = await critique(r, 'scope.define', orca, { records: [path.join(r.workRoot, 'features/shop/index.yaml')], extras: [put(r.root, 'goal.txt', 'ship the shop')] });
  assert.equal(judged.outcome, 'judged', judged.error);
  assert.equal(orca.names().filter((n) => n === 'worker-start').length, 1, 'one single pass');
  assert.deepEqual(seen[0], ['extra-1.txt', 'input-1.yaml', 'input-2.yaml', 'input-3.ts', 'manifest.yaml', 'product-1.yaml', 'rubric.yaml'], 'only the handed files are in the Critic directory');
  assert.equal(document.schema, 'starci/critic-verdict@1');
  assert.deepEqual([document.kind, document.op, document.maker, document.minimum, document.pass], ['scope.define', 'scope.define', 'devin', 7, true]);
  assert.equal(document.beauty, 9, 'the score key of a decision verdict is read as the overall score');
  assert.equal(document.checks.length, kindEntryOf('scope.define', rubrics).checks.length);
  assert.deepEqual(document.product, [{ label: 'features/shop/index.yaml', sha256: sha256(fs.readFileSync(path.join(r.workRoot, 'features/shop/index.yaml'))) }]);
  assert.equal(document.inputs.length, 4, 'the cited records and the extra input are hashed');
  assert.ok(document.inputs.some((i) => i.label === 'extra:goal.txt' && i.sha256 === sha256('ship the shop')));
  assert.match(document.rubric.source, /kinds\[id=scope\.define\]/);
  assert.match(judged.critic.prompt, /decision of kind scope\.define/);
  assert.match(judged.critic.prompt, /never: reads anything but the product files and the rubric handed to it/, 'the generated role lines ride in the prompt');
});

test('the maker\'s provider is never the Critic, for every maker and both kinds', async (t) => {
  for (const kind of KINDS) {
    for (const maker of ['claude', 'codex', 'devin']) {
      const r = repo(t);
      const orca = fakeCriticOrca({ verdict: verdictFor(kind, 9) });
      const { document } = await critique(r, kind, orca, { maker });
      if (!document) continue;
      const agent = orca.calls.find((c) => c[0] === 'worker-start')[1].agent;
      assert.notEqual(agent, maker, `${maker} never judges its own ${kind}`);
      assert.equal(document.maker, maker);
      assert.notEqual(document.critic.provider, maker);
    }
    assert.ok(criticFor(drawLoop, 'claude').critic.allowGroup.every((member) => member.provider !== 'claude'));
  }
});

test('the three happy errors of the Critic end the verb with exit 3 and a code, never a pass', async (t) => {
  const run = async (orca, argv = []) => {
    const r = repo(t);
    const out = path.join(r.root, 'job', 'critic-verdict.json');
    const result = await decisionCriticMain(['--kind', 'architecture.decide', '--root', r.root, '--out', out, '--json', ...argv], { orca, placement: { tmpRoot: r.root }, entry: 'term_op', ...clock() });
    return { ...result, out, body: JSON.parse(result.text) };
  };
  const quota = fakeCriticOrca({ verdict: verdictFor('architecture.decide', 9) });
  quota.admission = fakeAdmission({ used: { claude: 100, codex: 100 } });
  const out = await run(quota, ['--maker', 'devin']);
  assert.deepEqual([out.exitCode, out.body.code], [3, 'CRITIC_QUOTA_OUT']);
  assert.equal(fs.existsSync(out.out), false, 'no verdict file is left for the settle gate to find');
  const down = await run(fakeCriticOrca({ mode: 'launch-failed' }), ['--maker', 'devin']);
  assert.deepEqual([down.exitCode, down.body.code], [3, 'CRITIC_UNAVAILABLE']);
  const unknown = await run(fakeCriticOrca({ verdict: verdictFor('architecture.decide', 9) }));
  assert.deepEqual([unknown.exitCode, unknown.body.code], [3, 'CRITIC_AUTHOR_UNKNOWN']);
  const settings = tierSettings();
  const claudeOnly = { ...settings, tiers: { ...settings.tiers, frontier: settings.tiers.frontier.filter((member) => member.agent === 'claude') } };
  assert.equal(criticFor(drawLoop, 'claude', { settings: claudeOnly }).code, 'CRITIC_NO_INDEPENDENT_MEMBER', 'a tier with only the maker\'s provider refuses');
  for (const id of ['critic-no-independent-member', 'critic-unavailable', 'critic-quota-out']) {
    const policy = fs.readFileSync(path.join(ROOT, 'modules', 'kernel', 'op-incident-policy.yaml'), 'utf8');
    assert.match(policy, new RegExp(`id: ${id}[^\\n]*decision-critic`), `the hold ${id} names the decision legs`);
  }
});

test('a verdict under the minimum exits 1 and prints every failed check with its fix', async (t) => {
  const r = repo(t);
  const out = path.join(r.root, 'job', 'critic-verdict.json');
  const orca = fakeCriticOrca({ verdict: verdictFor('scope.define', 6, { failing: ['S1', 'S4'] }) });
  const result = await decisionCriticMain(['--kind', 'scope.define', '--root', r.workRoot, '--out', out, '--maker', 'devin'], { orca, placement: { tmpRoot: r.root }, entry: 'term_op', ...clock() });
  assert.equal(result.exitCode, 1);
  assert.match(result.text, /critic FAIL scope\.define/);
  assert.match(result.text, /S1: read S1 - fix: repair S1/);
  assert.match(result.text, /S4: read S4 - fix: repair S4/);
  assert.equal(JSON.parse(fs.readFileSync(out, 'utf8')).pass, false);
  assert.equal((await decisionCriticMain([], {})).exitCode, 2);
});

test('the settle gate refuses without a verdict, with a stale one, with a failing one, and passes a fresh passing one', async (t) => {
  for (const kind of KINDS) {
    const r = repo(t);
    const missing = judge(r, kind, null);
    assert.deepEqual([missing.status, missing.code], ['missing', 'op-critic-verdict-missing'], kind);
    assert.match(missing.detail, /runtime-critic-run/);

    const { document } = await critique(r, kind, fakeCriticOrca({ verdict: verdictFor(kind, 9) }), { records: null });
    assert.equal(judge(r, kind, attach(r, document)).status, 'pass', `${kind}: a fresh passing verdict for exactly the product bytes`);

    // the op edits a record after the Critic judged it
    const edited = productFiles({ workRoot: r.workRoot, entry: kindEntryOf(kind, rubrics), within: [ownedRelOf(OWNED[kind][0])] })[0].abs;
    const before = fs.readFileSync(edited, 'utf8');
    fs.writeFileSync(edited, `${before}# edited after the verdict\n`);
    const stale = judge(r, kind, attach(r, document));
    assert.deepEqual([stale.status, stale.code], ['red', 'CRITIC_VERDICT_STALE']);
    fs.writeFileSync(edited, before);
    assert.equal(judge(r, kind, attach(r, document)).status, 'pass', 'the same bytes are fresh again');

    // a cited input changed
    const input = path.join(r.workRoot, 'features/shop/br/pricing/index.yaml');
    fs.appendFileSync(input, '# moved\n');
    assert.equal(judge(r, kind, attach(r, document)).code, 'CRITIC_VERDICT_STALE', 'a verdict of other premises is stale');
    fs.writeFileSync(input, 'schema: work/br@1\nid: br.pricing\ntitle: Pricing rule\n');

    // a verdict that judged fewer records than the op owns
    const partial = { ...document, product: document.product.slice(0, 1) };
    if (document.product.length > 1) assert.equal(judge(r, kind, attach(r, partial)).code, 'CRITIC_VERDICT_STALE', 'a subset of the product is stale');
    assert.equal(judge(r, kind, attach(r, { ...document, product: [] })).code, 'CRITIC_VERDICT_STALE');

    const failing = await critique(r, kind, fakeCriticOrca({ verdict: verdictFor(kind, 5, { failing: { 'scope.define': ['S1', 'S5'], 'architecture.decide': ['A1', 'A3'], 'business.decide': ['B1', 'B2'] }[kind] }) }));
    const refusal = judge(r, kind, attach(r, failing.document));
    assert.deepEqual([refusal.status, refusal.code], ['red', 'op-critic-verdict-failed']);
    assert.match(refusal.detail, new RegExp(`minimum for ${kind.replace('.', '\\.')} is 7`));
    assert.ok(refusal.findings.length >= 1 && refusal.findings.every((line) => /fix: repair/.test(line)), 'the critique rides with the refusal');
    assert.match(criticRefusalText(kind, refusal, 'job-1'), /error-work/);
    assert.match(criticRefusalText(kind, refusal, 'job-1'), /fix: repair/);
  }
});

test('the verdict is not trusted when the Critic is the maker, the maker is unknown, the rubric is another, or the pass flag lies', async (t) => {
  const r = repo(t);
  const { document } = await critique(r, 'scope.define', fakeCriticOrca({ verdict: verdictFor('scope.define', 9) }));
  const judged = (patch) => judge(r, 'scope.define', attach(r, { ...document, ...patch }));
  assert.equal(judged({ critic: { ...document.critic, provider: 'devin' } }).code, 'CRITIC_NO_INDEPENDENT_MEMBER', 'the maker\'s provider never judges');
  assert.equal(judged({ maker: null }).code, 'CRITIC_AUTHOR_UNKNOWN');
  assert.equal(judged({ rubric: { source: 'x', checks: 3 } }).code, 'CRITIC_VERDICT_STALE', 'another rubric than the declared one');
  const lying = judged({ pass: true, beauty: 3 });
  assert.equal(lying.code, 'op-critic-verdict-failed', 'pass or fail is re-derived from the score against the declared minimum');
  assert.equal(judged({ kind: 'architecture.decide', op: 'architecture.decide' }).code, 'op-critic-verdict-missing', 'a verdict of another kind is no verdict');
  assert.equal(judge(r, 'interface.draw', attach(r, document)), null, 'the draw path is not judged here');
  assert.equal(judge(r, 'brand.decide', attach(r, document)), null);
});

test('settle refuses a done through the preflight, records the critic-verdict check, and lets a fresh passing verdict through', async (t) => {
  const r = repo(t);
  const { document } = await critique(r, 'scope.define', fakeCriticOrca({ verdict: verdictFor('scope.define', 9) }));
  const bad = { ...document, product: [{ label: 'features/shop/index.yaml', sha256: sha256('other bytes') }] };
  const fx = withLedger(t, (ledgerFx) => {
    seedWorkflow(ledgerFx.ledger, { id: 'wf-critic', jobs: [{ jobId: 'op-critic', opId: 'scope.define', status: 'running', dispatchId: 'critic-dispatch' }] });
    return ledgerFx;
  });
  const attemptId = fx.ledger.db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=?').get('op-critic').attempt_id;
  const none = () => null;
  const internals = { settleProofMedia: none, settleSonarGate: none, settleOpGate: none, settleOpProofs: none, settleDrawAcceptance: none, settleDrawMetrics: none, settleWorkHygiene: none };
  const preflight = async (doc) => {
    const emitted = [];
    const settleCriticVerdict = () => ({ op: 'scope.define', jobId: 'op-critic', attemptId, status: 'reported', judged: judge(r, 'scope.define', attach(r, doc)) });
    let exit = null;
    try {
      await settlePreflight({ ledger: fx.ledger, args: { json: false }, repo: r.root, emit: (...a) => emitted.push(a), internals: { ...internals, settleCriticVerdict }, replay: false, verdict: 'pass', jobId: 'op-critic' });
    } catch (error) { exit = error.exitCode; }
    return { exit, emitted };
  };
  const refused = await preflight(bad);
  assert.equal(refused.exit, 1);
  assert.equal(refused.emitted[0][0].code, 'CRITIC_VERDICT_STALE');
  assert.match(refused.emitted[0][1], /settle REFUSED for op-critic \(scope\.define\)/);
  const row = fx.ledger.db.prepare("SELECT exit_code, summary_json FROM check_runs WHERE name='op-proof' AND command LIKE '%independent-critic%' ORDER BY check_id DESC").get();
  assert.equal(row.exit_code, 1);
  assert.deepEqual(JSON.parse(row.summary_json).codes, ['CRITIC_VERDICT_STALE']);
  const passed = await preflight(document);
  assert.equal(passed.exit, null);
  assert.equal(fx.ledger.db.prepare("SELECT exit_code FROM check_runs WHERE name='op-proof' AND command LIKE '%independent-critic%' ORDER BY check_id DESC").get().exit_code, 0);
  assert.equal(recordCriticJudgment(fx.ledger, { attemptId, judgment: { op: 'scope.define', judged: { status: 'pass', code: null, findings: [] } } }).green, true);
});

test('the digests the verdict carries are those the settle gate recomputes', async (t) => {
  const r = repo(t);
  const entry = kindEntryOf('architecture.decide', rubrics);
  const { document } = await critique(r, 'architecture.decide', fakeCriticOrca({ verdict: verdictFor('architecture.decide', 8) }));
  const now = productDigests({ workRoot: r.workRoot, entry, inputs: rubrics.inputs });
  assert.deepEqual(document.product.map((p) => p.sha256).sort(), now.product.map((p) => p.sha256).sort());
  assert.deepEqual(document.inputs.map((p) => p.sha256).sort(), now.inputs.map((p) => p.sha256).sort());
});
