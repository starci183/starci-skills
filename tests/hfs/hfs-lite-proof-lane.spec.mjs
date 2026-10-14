// proves: BE_LITE_PROOF_LANE_MISSING@lite, BE_PATTERN_SPEC_MISSING@lite, BE_PATTERN_SPEC_MISSING@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkRepo } from '../../scripts/hfs/check.mjs';
import { liteProofLaneFindings } from '../../scripts/hfs/rules/lite-proof-lane.mjs';
import { integrationSpecFindings } from '../../scripts/hfs/rules/integration-specs.mjs';
import { loadRuleCatalog, loadSlotManifest } from '../../scripts/hfs/slots.mjs';

const SCENARIOS = {
  'event-bus': ['atomic-with-transaction', 'relay-only-after-commit', 'redelivery-then-dead-letter', 'duplicate-delivery-is-a-noop'],
  queue: ['enqueue-atomic-with-transaction', 'relay-job-id-is-outbox-id', 'scheduler-fires-once'],
  webhooks: ['bad-signature-is-refused', 'replay-is-refused', 'accepted-delivery-publishes-once'],
  realtime: ['subscriber-receives-push', 'foreign-topic-is-isolated', 'disconnect-releases-subscription'],
  'fenced-job': ['claim-bumps-token', 'zombie-fenced-out', 'redispatch-isolated'],
  projection: ['recompute-is-idempotent', 'replay-rebuilds'],
  saga: ['compensation-on-failure', 'step-order', 'state-version-fences', 'consumer-dedupes'],
};
const SPEC = 'be/src/tests/integration/patterns/proofs.integration-spec.ts';
const declaration = (edition, patterns) => ({
  hfs: 3, kind: 'app', project: 'demo', edition,
  sides: {
    be: { apps: [{ name: 'core', kind: 'api' }], patterns },
    fe: { apps: [{ name: 'web', kind: 'next' }] },
  },
});
const tree = (t, files) => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-lite-proof-'));
  t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(repoRoot, file)), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, file), content);
  }
  return { repoRoot, files: Object.keys(files) };
};
const ids = (patterns) => patterns.flatMap((pattern) => SCENARIOS[pattern].map((scenario) => `${pattern}/${scenario}`));
const spec = (scenarios) => scenarios.map((id, index) => {
  const title = JSON.stringify(`${id}: proves the outcome`);
  return `${index % 2 ? 'test' : 'it'}(${title}, () => { expect(true).toBe(true); });`;
}).join('\n');
const find = (fixture, edition, patterns) => liteProofLaneFindings({ ...fixture, repo: declaration(edition, patterns) });
const proofFindings = (result) => result.findings.filter((finding) => ['BE_LITE_PROOF_LANE_MISSING', 'BE_PATTERN_SPEC_MISSING'].includes(finding.code));

test('BE_LITE_PROOF_LANE_MISSING: every declared lite pattern without integration specs is refused; full is unchanged', (t) => {
  const fixture = tree(t, {});
  for (const pattern of Object.keys(SCENARIOS)) {
    const findings = find(fixture, 'lite', [pattern]);
    assert.deepEqual(findings.filter((finding) => finding.code === 'BE_LITE_PROOF_LANE_MISSING').map((finding) => finding.path), ['hfs.json']);
    assert.deepEqual(findings.filter((finding) => finding.code === 'BE_PATTERN_SPEC_MISSING').map((finding) => finding.scenario), ids([pattern]));
    assert.ok(findings.every((finding) => finding.level === 'error'));
    assert.deepEqual(find(fixture, 'full', [pattern]), []);
  }
});

test('BE_LITE_PROOF_LANE_MISSING: integration specs proving every scenario pass in lite and full for all seven patterns', (t) => {
  for (const pattern of Object.keys(SCENARIOS)) {
    const fixture = tree(t, { [SPEC]: spec(ids([pattern])) });
    for (const edition of ['lite', 'full']) assert.deepEqual(find(fixture, edition, [pattern]), [], `${edition}: ${pattern}`);
  }
});

test('BE_PATTERN_SPEC_MISSING: a present lite lane still owes every exact scenario title, and unrelated patterns add no requirements', (t) => {
  const patterns = Object.keys(SCENARIOS);
  const missing = 'saga/state-version-fences';
  const fixture = tree(t, { [SPEC]: spec(ids(patterns).filter((id) => id !== missing)) });
  const findings = find(fixture, 'lite', patterns);
  assert.deepEqual(findings.map((finding) => [finding.code, finding.pattern, finding.scenario]), [['BE_PATTERN_SPEC_MISSING', 'saga', missing]]);
  assert.deepEqual(find(fixture, 'full', patterns), []);
  assert.deepEqual(find(fixture, 'lite', ['queue']), []);
  assert.deepEqual(find(fixture, 'lite', []), []);
});

test('BE_LITE_PROOF_LANE_MISSING: e2e, contract, unit and front-end specs cannot supply the lite integration lane', (t) => {
  const files = [
    'be/src/tests/e2e/queue/proofs.e2e-spec.ts',
    'be/src/tests/contract/queue/proofs.contract-spec.ts',
    'be/src/modules/queues/queue.spec.ts',
    'fe/src/tests/integration/proofs.integration-spec.ts',
    'be/src/tests/integration/queue/proofs.spec.ts',
  ];
  const fixture = tree(t, Object.fromEntries(files.map((file) => [file, spec(ids(['queue']))])));
  const findings = find(fixture, 'lite', ['queue']);
  assert.equal(findings.filter((finding) => finding.code === 'BE_LITE_PROOF_LANE_MISSING').length, 1);
  assert.equal(findings.filter((finding) => finding.code === 'BE_PATTERN_SPEC_MISSING').length, SCENARIOS.queue.length);
});

test('BE_PATTERN_SPEC_MISSING: comments, strings, skipped/todo calls, dynamic titles and missing callbacks do not prove a scenario', (t) => {
  const id = 'projection/recompute-is-idempotent';
  const fixture = tree(t, { [SPEC]: [
    `// it('${id}: comment', () => {});`,
    `const example = "it('${id}: string', () => {});";`,
    `it.skip('${id}: skipped', () => {});`,
    `test.todo('${id}: todo');`,
    `const title = '${id}: dynamic'; it(title, () => {});`,
    `test('${id}: no callback');`,
    `it('${id}: undefined callback', undefined);`,
    `it('${id}: null callback', null);`,
    `describe.skip('disabled suite', () => { it('${id}: skipped suite', () => {}); });`,
    `xdescribe('disabled suite', () => { it('${id}: disabled suite', () => {}); });`,
    `it('wrong/${id}: wrong prefix', () => {});`,
    spec(['projection/replay-rebuilds']),
  ].join('\n') });
  const findings = find(fixture, 'lite', ['projection']);
  assert.deepEqual(findings.map((finding) => [finding.code, finding.scenario]), [['BE_PATTERN_SPEC_MISSING', id]]);
});

test('BE_PATTERN_SPEC_MISSING: titles may use literal templates and proofs may be split across tracked integration specs', (t) => {
  const fixture = tree(t, {
    [SPEC]: 'test(`projection/recompute-is-idempotent: a literal template`, () => {});',
    'be/src/tests/integration/replay/replay.integration-spec.ts': spec(['projection/replay-rebuilds']),
  });
  assert.deepEqual(find(fixture, 'lite', ['projection']), []);
  const rootPass = { ...fixture, files: ['hfs.json'], all: fixture.files };
  assert.deepEqual(find(rootPass, 'lite', ['projection']), [], 'the app-root pass reads the full tracked tree');
  const untracked = { ...fixture, files: [] };
  assert.equal(find(untracked, 'lite', ['projection'])[0].code, 'BE_LITE_PROOF_LANE_MISSING', 'files on disk alone are not tracked proof');
});

test('BE_PATTERN_SPEC_MISSING: the edition manifest supplies scenario ids, including saga when configured', (t) => {
  const manifest = structuredClone(loadSlotManifest());
  manifest.ruleParams.be.patternScenarios.saga = ['configured-saga-proof'];
  manifest.ruleParams.be.lite.patternScenarios = { projection: ['configured-projection-proof'] };
  const scenarios = ['saga/configured-saga-proof', 'projection/configured-projection-proof'];
  const passing = tree(t, { [SPEC]: spec(scenarios) });
  const missing = tree(t, { [SPEC]: spec(ids(['saga', 'projection'])) });
  for (const edition of ['lite', 'full']) {
    const repo = declaration(edition, ['saga', 'projection']);
    assert.deepEqual(liteProofLaneFindings({ ...passing, repo, manifest }), []);
    const findings = liteProofLaneFindings({ ...missing, repo, manifest });
    assert.deepEqual(findings.map((finding) => finding.scenario), edition === 'lite' ? scenarios : []);
    assert.ok(findings.every((finding) => finding.code === 'BE_PATTERN_SPEC_MISSING'));
  }
});

test('BE_LITE_PROOF_LANE_MISSING: no patterns, non-pattern capabilities, side passes and absent/full editions add no lite findings', (t) => {
  const fixture = tree(t, {});
  for (const edition of ['lite', 'full', undefined]) {
    assert.deepEqual(find(fixture, edition, []), []);
    assert.deepEqual(find(fixture, edition, ['cqrs']), []);
  }
  assert.deepEqual(liteProofLaneFindings({ ...fixture, repo: { edition: 'lite', profile: 'be', patterns: ['queue'] } }), []);
  assert.deepEqual(find(fixture, undefined, ['queue']), []);
});

test('BE_PATTERN_SPEC_MISSING: starci app check wires the lite lane and preserves full scenario enforcement', (t) => {
  for (const edition of ['lite', 'full']) {
    const repo = declaration(edition, ['projection']);
    const empty = tree(t, { 'hfs.json': JSON.stringify(repo) });
    const missing = proofFindings(checkRepo({ ...empty, declaration: repo, tree: false }));
    assert.deepEqual(missing.filter((finding) => finding.code === 'BE_PATTERN_SPEC_MISSING').map((finding) => finding.scenario).sort((a, b) => a.localeCompare(b)), ids(['projection']).sort((a, b) => a.localeCompare(b)));
    assert.equal(missing.filter((finding) => finding.code === 'BE_LITE_PROOF_LANE_MISSING').length, edition === 'lite' ? 1 : 0);
    const passing = tree(t, { 'hfs.json': JSON.stringify(repo), [SPEC]: spec(ids(['projection'])) });
    assert.deepEqual(proofFindings(checkRepo({ ...passing, declaration: repo, tree: false })), []);
    const e2e = tree(t, { 'hfs.json': JSON.stringify(repo), 'be/src/tests/e2e/projection/proofs.e2e-spec.ts': spec(ids(['projection'])) });
    assert.equal(proofFindings(checkRepo({ ...e2e, declaration: repo, tree: false })).length, edition === 'lite' ? 3 : 0);
  }
});

test('R284 owns BE_LITE_PROOF_LANE_MISSING once and R155 retains BE_PATTERN_SPEC_MISSING in both editions', () => {
  const catalog = loadRuleCatalog();
  const lane = catalog.rules.find((rule) => rule.id === 'R284');
  assert.equal(lane.code, 'BE_LITE_PROOF_LANE_MISSING');
  assert.deepEqual(lane.failureCodes, ['BE_LITE_PROOF_LANE_MISSING']);
  assert.deepEqual(catalog.rules.filter((rule) => rule.failureCodes.includes('BE_PATTERN_SPEC_MISSING')).map((rule) => rule.id), ['R155']);
  assert.equal(catalog.rules.find((rule) => rule.id === 'R155').editions, undefined);
});

test('BE_INTEGRATION_SPEC_MISSING: direct callers keep the full integration-world proof requirement and lite uses its own lane', (t) => {
  const fixture = tree(t, { 'be/src/modules/integrations/payment/payment.config.ts': 'export const payment = {};\n' });
  assert.deepEqual(integrationSpecFindings({ ...fixture, repo: declaration('lite', []) }), []);
  assert.deepEqual(integrationSpecFindings({ ...fixture, repo: declaration('full', []) }).map((finding) => finding.code), ['BE_INTEGRATION_SPEC_MISSING']);
  assert.deepEqual(integrationSpecFindings({ ...fixture, files: [], repo: declaration('full', []) }), []);
});
