import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sha256 } from '../../engine/digest.mjs';
import { allocationSettings } from '../../engine/config.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { DEFAULT_RUBRIC, runCritic } from '../../scripts/work/draw-critic.mjs';
import { criticFor } from '../../scripts/work/critic-pick.mjs';
import { coverageOf, criticContract } from '../../scripts/work/critic-contract.mjs';
import { codeOfOutcome, roundCritic, staleRefusal, touchedByCritic } from '../../scripts/work/critic-verdict.mjs';
import { tierMembers, tierOfSeat, tierSettings } from '../../scripts/agent/tiers.mjs';
import { boundGuard } from '../../scripts/guards/rights.mjs';
import { guardsRoot } from '../../scripts/guards/guards-root.mjs';
import { boundValue, incidentPolicy } from '../../scripts/kernel/op-incident-policy.mjs';
import { fakeCriticOrca, passingVerdict } from '../helpers/fake-critic-orca.mjs';
import { fakeAdmission } from '../helpers/fake-admission.mjs';

// The Critic as a standardised role: its model is taken from the tier of its seat through the picker with provider
// independence as a hard filter, it sees and does only what its guard allows, its answer is one typed verdict that names the
// bytes it judged, and each way it can fail is a typed code classified as a happy error or a bug.

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const drawLoop = allocationSettings().drawLoop;
const DEVIN = { provider: 'devin', model: 'swe-2-max' };
const contract = criticContract();

const round = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-critic-std-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const png = path.join(dir, 'desktop.png');
  fs.writeFileSync(png, Buffer.from('89504e470d0a1a0a00ff', 'hex'));
  const html = path.join(dir, 'screen.html');
  fs.writeFileSync(html, '<!doctype html><html><body><h1>Ledger</h1></body></html>');
  return { dir, images: [{ path: png, label: 'desktop 1184px' }], html, png };
};
const clock = () => { let t = 0; return { now: () => t, sleep: async (ms) => { t += ms; } }; };
const run = (r, orca, critic, extra = {}) => runCritic({ images: r.images, html: r.html, rubric: DEFAULT_RUBRIC, critic, minimum: 8, orca, placement: { tmpRoot: r.dir }, entry: 'term_op', ...clock(), ...extra });

test('the Critic takes its tier from the seat table, and no hand pin is left in the draw loop settings', () => {
  assert.equal(contract.seat, 'critic');
  assert.equal(tierOfSeat(contract.seat), 'frontier');
  assert.equal(contract.independence, allocationSettings().admission.roles.critic.independence, 'the contract and the admission policy name the same rule');
  assert.deepEqual(Object.keys(drawLoop).filter((key) => key.startsWith('critic')), ['criticTimeoutMs'], 'the only Critic key of the draw loop is its wall bound');
  assert.ok(drawLoop.criticTimeoutMs > 0);
  const picked = criticFor(drawLoop, DEVIN).critic;
  assert.equal(picked.tier, 'frontier');
  assert.equal(picked.timeoutMs, drawLoop.criticTimeoutMs);
  const tier = tierMembers('frontier').map((member) => `${member.provider}/${member.model}`);
  assert.ok(picked.allowGroup.every((member) => tier.includes(`${member.provider}/${member.model}`)), 'every candidate is a member of the Critic tier');
});

test('the independence rule is a hard filter: the maker\'s provider is never a candidate', () => {
  for (const maker of ['devin', 'codex', 'claude']) {
    const { critic } = criticFor(drawLoop, maker);
    assert.ok(critic.allowGroup.length >= 1);
    assert.ok(critic.allowGroup.every((member) => member.provider !== maker), `${maker} never judges its own product`);
    assert.notEqual(critic.provider, maker);
  }
  assert.equal(criticFor(drawLoop, 'CODEX').critic.author.provider, 'codex', 'the maker\'s name is read case-insensitively');
});

test('a tier with no member of another provider refuses the critique with a typed code and never falls back to the maker', () => {
  const settings = tierSettings();
  const claudeOnly = { ...settings, tiers: { ...settings.tiers, frontier: settings.tiers.frontier.filter((member) => member.agent === 'claude') } };
  const refused = criticFor(drawLoop, 'claude', { settings: claudeOnly });
  assert.equal(refused.critic, undefined);
  assert.equal(refused.code, 'CRITIC_NO_INDEPENDENT_MEMBER');
  assert.match(refused.error, /no independent critic available/);
  assert.equal(criticFor(drawLoop, 'devin', { settings: claudeOnly }).critic.provider, 'claude', 'another provider than the maker is still picked');
  const unmapped = criticFor(drawLoop, 'devin', { settings: { ...settings, seats: {} } });
  assert.equal(unmapped.code, 'CRITIC_NO_INDEPENDENT_MEMBER', 'a seat with no tier has no candidate');
  const unknown = criticFor(drawLoop, null);
  assert.equal(unknown.code, 'CRITIC_AUTHOR_UNKNOWN');
});

test('a critique that cannot be admitted is written with its typed code and recorded on the round', async () => {
  const { critiqueRound } = await import('../../scripts/work/draw-loop.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-critic-refused-'));
  const html = path.join(dir, 'screen.html');
  fs.writeFileSync(html, '<p>x</p>');
  try {
    const orca = fakeCriticOrca();
    const critique = await critiqueRound({ loop: {}, n: 1, roundDir: dir, captures: [], html, settings: drawLoop, drawer: null, orca });
    assert.deepEqual([critique.outcome, critique.code, critique.verdict], ['not-configured', 'CRITIC_AUTHOR_UNKNOWN', null]);
    assert.equal(orca.names().includes('worker-start'), false, 'no worker is started for a product whose maker is unknown');
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'critique.json'), 'utf8')).code, 'CRITIC_AUTHOR_UNKNOWN');
    assert.equal(roundCritic(critique).code, 'CRITIC_AUTHOR_UNKNOWN', 'the round carries the code finish reports');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
  }
});

test('the quota of the first independent member moves the Critic to the next one; every independent member out of tokens is a quota-out happy error', async (t) => {
  const r = round(t);
  const orca = fakeCriticOrca({ verdict: passingVerdict(DEFAULT_RUBRIC, 9) });
  orca.admission = fakeAdmission({ used: { claude: 100 } });
  const second = await run(r, orca, criticFor(drawLoop, DEVIN).critic);
  assert.equal(second.outcome, 'judged', second.error);
  assert.deepEqual([orca.calls.find((c) => c[0] === 'worker-start')[1].agent], ['codex'], 'claude is out of tokens, so the next independent member of the tier judges');

  const none = fakeCriticOrca({ verdict: passingVerdict(DEFAULT_RUBRIC, 9) });
  none.admission = fakeAdmission({ used: { claude: 100, codex: 100 } });
  const out = await run(round(t), none, criticFor(drawLoop, DEVIN).critic);
  assert.equal(out.outcome, 'quota');
  assert.equal(out.code, 'CRITIC_QUOTA_OUT');
  assert.equal(out.verdict, null);
  assert.equal(none.names().includes('worker-start'), false, 'nothing was started');
});

test('a critic that cannot start or answer is the unavailable happy error', async (t) => {
  for (const mode of ['launch-failed', 'silent', 'ended', 'escalate']) {
    const orca = fakeCriticOrca({ mode });
    const critique = await run(round(t), orca, { ...criticFor(drawLoop, DEVIN).critic, timeoutMs: 20000 });
    assert.equal(critique.verdict, null, mode);
    assert.equal(critique.code, 'CRITIC_UNAVAILABLE', mode);
  }
});

test('the Critic\'s terminal is bound to the critic guard while it runs, reaching its directory and its verdict file only, and unbound after', async (t) => {
  const r = round(t);
  const orca = fakeCriticOrca({ verdict: passingVerdict(DEFAULT_RUBRIC, 8) });
  const seen = [];
  const check = orca.check;
  orca.check = (args) => { seen.push(boundGuard('term_critic_1')); return check(args); };
  const critique = await run(r, orca, criticFor(drawLoop, DEVIN).critic);
  assert.equal(critique.outcome, 'judged', critique.error);
  const guard = seen.find(Boolean);
  assert.equal(guard.role, 'critic');
  assert.equal(guard.reach.verdictFile, 'verdict.json');
  assert.equal(path.basename(guard.reach.dir).startsWith('starci-draw-critic-'), true, 'the one directory is the critic placement');
  assert.deepEqual(guard.owned, [], 'it owns no path of any worktree');
  assert.equal(guard.workflowWorktree, null, 'it holds no workflow worktree');
  assert.equal(boundGuard('term_critic_1'), null, 'the binding is removed with the worker');
  assert.match(critique.critic.prompt, /never: reads anything but the product files and the rubric handed to it/, 'its prompt carries the generated role lines');
});

test('a critic terminal that no guard is bound to is not trusted: no verdict, typed CRITIC_UNGUARDED', async (t) => {
  const r = round(t);
  const blocked = path.join(guardsRoot(), 'terminals', 'term_critic_1.json');
  fs.mkdirSync(blocked, { recursive: true });
  t.after(() => fs.rmSync(blocked, { recursive: true, force: true }));
  const orca = fakeCriticOrca({ verdict: passingVerdict(DEFAULT_RUBRIC, 9) });
  const critique = await run(r, orca, criticFor(drawLoop, DEVIN).critic);
  assert.deepEqual([critique.outcome, critique.code, critique.verdict], ['unguarded', 'CRITIC_UNGUARDED', null]);
  assert.ok(orca.names().includes('worker-release'), 'the unguarded worker is still stopped and released');
});

test('the verdict is one typed record: scores per check, the minimum, pass or fail against it, and the digests of the bytes judged', async (t) => {
  const r = round(t);
  const orca = fakeCriticOrca({ verdict: passingVerdict(DEFAULT_RUBRIC, 9) });
  const critique = await run(r, orca, criticFor(drawLoop, DEVIN).critic);
  const { verdict } = critique;
  assert.equal(verdict.schema, 'starci/critic-verdict@1');
  assert.equal(verdict.checks.length, DEFAULT_RUBRIC.checks.length);
  assert.equal(verdict.minimum, 8);
  assert.equal(verdict.pass, true);
  assert.deepEqual(verdict.product.map((entry) => entry.label), ['desktop 1184px', 'html']);
  assert.equal(verdict.product[0].sha256, sha256(fs.readFileSync(r.png)), 'the digest of the render bytes the Critic was handed');
  assert.equal(verdict.product[1].sha256, sha256(fs.readFileSync(r.html)));
  assert.deepEqual(verdict.rubric, { source: DEFAULT_RUBRIC.source, checks: DEFAULT_RUBRIC.checks.length });
  assert.deepEqual([verdict.critic.provider, verdict.critic.tier], ['claude', 'frontier']);
  const below = await run(round(t), fakeCriticOrca({ verdict: passingVerdict(DEFAULT_RUBRIC, 6) }), criticFor(drawLoop, DEVIN).critic);
  assert.equal(below.verdict.pass, false, 'a score under the declared minimum fails');
  assert.deepEqual(roundCritic(critique).judged, verdict.product.map((entry) => entry.sha256), 'the round records the digests the verdict names');
});

test('a verdict that names other bytes than the attempt\'s product is refused as stale', () => {
  const digest = (text) => sha256(text);
  assert.equal(staleRefusal([digest('a'), digest('b')], [digest('a')]), null);
  assert.equal(staleRefusal([digest('a')], [digest('b')]).code, 'CRITIC_VERDICT_STALE');
  assert.equal(staleRefusal([], [digest('a')]).code, 'CRITIC_VERDICT_STALE');
  assert.equal(staleRefusal(undefined, [digest('a')]).code, 'CRITIC_VERDICT_STALE');
  assert.match(staleRefusal([digest('a')], [digest('a'), digest('c')]).detail, /1 digest\(s\) not judged/);
});

test('no verdict, edited product and extra files are bugs: refused, typed, recorded, never a pass', async (t) => {
  const none = await run(round(t), fakeCriticOrca({ mode: 'done-no-verdict' }), criticFor(drawLoop, DEVIN).critic);
  assert.deepEqual([none.outcome, none.code, none.verdict], ['verdict-missing', 'CRITIC_NO_VERDICT', null]);

  const edited = fakeCriticOrca({ verdict: passingVerdict(DEFAULT_RUBRIC, 10), onStart: (a) => fs.writeFileSync(path.join(a.worktree, 'render-1.png'), 'repainted') });
  const touched = await run(round(t), edited, criticFor(drawLoop, DEVIN).critic);
  assert.deepEqual([touched.outcome, touched.code, touched.verdict], ['product-modified', 'CRITIC_PRODUCT_MODIFIED', null]);
  assert.match(touched.error, /render-1\.png changed or removed/);

  const extra = fakeCriticOrca({ verdict: passingVerdict(DEFAULT_RUBRIC, 10), onStart: (a) => fs.writeFileSync(path.join(a.worktree, 'notes.md'), 'x') });
  const created = await run(round(t), extra, criticFor(drawLoop, DEVIN).critic);
  assert.equal(created.code, 'CRITIC_PRODUCT_MODIFIED');
  assert.match(created.error, /notes\.md created/);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-critic-touch-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'a.png'), 'a');
  const handed = [{ file: 'a.png', label: 'a', role: 'product', sha256: sha256('a') }];
  fs.mkdirSync(path.join(dir, '.claude'));
  fs.writeFileSync(path.join(dir, 'verdict.json'), '{}');
  assert.deepEqual(touchedByCritic({ dir, handed, verdictFile: 'verdict.json' }), [], 'the verdict file and the launch settings are not edits');
  assert.equal(codeOfOutcome('judged'), null);
  assert.equal(codeOfOutcome('not-configured'), null);
});

test('the coverage table names every op kind that owes a Critic, and an owed kind points at an open registry entry', () => {
  const draw = coverageOf('interface.draw');
  assert.equal(draw.status, 'covered');
  assert.equal(boundValue(draw.minimum), drawLoop.beautyMin, 'the declared minimum is the draw loop beautyMin');
  const registry = parseYaml(fs.readFileSync(path.join(ROOT, 'modules', 'reconciler', 'edge-cases.yaml'), 'utf8'));
  for (const row of contract.coverage) {
    assert.ok(fs.existsSync(path.join(ROOT, 'modules', 'ops', 'ops', `${row.kind}.yaml`)), `${row.kind} is an op kind`);
    assert.ok(['covered', 'owed'].includes(row.status));
    if (row.status !== 'owed') continue;
    const entry = registry.cases.find((one) => one.id === row.entry);
    assert.equal(entry?.status, 'open', `${row.kind} is owed and tracked by the open entry ${row.entry}`);
  }
  assert.deepEqual(contract.coverage.filter((row) => row.status === 'owed').map((row) => row.kind), [], 'the decision legs are covered (tests/work/critic-decision-legs.spec.mjs)');
  assert.deepEqual(contract.coverage.map((row) => row.kind), ['interface.draw', 'scope.define', 'architecture.decide', 'business.decide']);
  assert.equal(coverageOf('brand.decide'), null);
});

test('every hold of the Critic is a row of the incident policy and every typed code is catalogued', () => {
  const policy = incidentPolicy();
  const holds = new Set(policy.holds.map((hold) => hold.id));
  for (const id of ['critic-no-independent-member', 'critic-unavailable', 'critic-quota-out']) assert.ok(holds.has(id), id);
  const roles = parseYaml(fs.readFileSync(path.join(ROOT, 'modules', 'kernel', 'roles.yaml'), 'utf8'));
  const critic = roles.roles.find((role) => role.id === 'critic');
  const rows = new Set([...policy.rows, ...policy.holds].map((row) => row.id));
  for (const error of critic.happyErrors) assert.ok(rows.has(error.row), `${error.id} names the policy row ${error.row}`);
  const catalog = fs.readFileSync(path.join(ROOT, 'modules', 'kernel', 'failure-codes.yaml'), 'utf8');
  for (const code of Object.values(contract.codes)) assert.match(catalog, new RegExp(`^${code}:`, 'm'), `${code} is catalogued`);
  assert.equal(codeOfOutcome('quota'), contract.codes.quotaOut);
  assert.equal(codeOfOutcome('timeout'), contract.codes.unavailable);
  assert.equal(codeOfOutcome('unguarded'), contract.codes.unguarded);
});
