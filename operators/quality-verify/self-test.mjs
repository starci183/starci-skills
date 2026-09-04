// Proves validate.mjs on a synthetic session branch: one green verification, one red one that is a
// verdict and not a stop, one blocked on an unavailable gate, and one mutation per law, each of which
// must fail with a line that names the defect.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateQualityStep, integrationGateBindingErrors } from './validate.mjs';

const HEAD = '1'.repeat(40);
const OTHER_HEAD = '2'.repeat(40);
const BRANCH = 'session/s-test';
const OBSERVED = '2026-01-10T00:00:00.000Z';
const PLAN = [
  { gate: 'format', commandRef: 'package.json#scripts.format', configRef: '.prettierrc', required: true },
  { gate: 'lint', commandRef: 'package.json#scripts.lint', configRef: 'eslint.config.mjs', required: true },
  { gate: 'unit-coverage', commandRef: 'package.json#scripts.test', configRef: 'jest.config.ts', required: true },
];
const THRESHOLDS = { statements: 80, lines: 80, functions: 80, branches: 80 };
const METRICS = ['statements', 'lines', 'functions', 'branches'];
const UNCONFIGURED = Object.fromEntries(METRICS.map((metric) => [metric, null]));
const DEBT = { debtId: 'lint-debt', gate: 'lint', approvalRef: '@worktrees/debts/be.md#lint', ownerRef: 'be-team', expiresAt: '2026-06-01T00:00:00.000Z' };

const gateResult = (gate, over = {}) => ({
  gate, required: true, sourceHead: HEAD, sessionBranch: BRANCH, predecessorCommit: HEAD, observedAt: OBSERVED,
  commandRef: PLAN.find((g) => g.gate === gate)?.commandRef ?? 'package.json#scripts.x',
  configRef: PLAN.find((g) => g.gate === gate)?.configRef ?? 'config.json',
  status: 'pass', exitCode: 0, evidenceRef: `gates/${gate}.log`, classification: null, sonarScope: null, debt: null,
  ...(gate === 'lint' ? { lint: { baseline: 0, delivery: 0, changedFiles: 3 } } : {}),
  statement: `${gate} measured at the frozen head`, ...over,
});
const failing = (gate, over = {}) => gateResult(gate, { status: 'fail', exitCode: 1, classification: 'in-boundary', ...(gate === 'lint' ? { lint: { baseline: 0, delivery: 2, changedFiles: 3 } } : {}), ...over });

const coverage = (over = {}) => ({ statements: 90, lines: 90, functions: 90, branches: 81.4, thresholds: THRESHOLDS, evidenceRef: 'gates/unit-coverage.log', ...over });

// The scorecard the audit and the UAT run closed; this receipt copies the rows and computes the line.
const SCORECARD = [
  ['presentation', 'pass', 'none'],
  ['composition', 'pass', 'none'],
  ['responsive', 'pass', 'none'],
  ['motion', 'pass', 'none'],
  ['accessibility', 'pass', 'none'],
  ['contrast', 'pass', 'none'],
  ['render-truth', 'pass', 'none'],
  ['taste', 'ship', 'none'],
  ['experience', 'ship', 'none'],
];
const TOPICS = SCORECARD.map(([t]) => t);
const scorecardLine = (rows) => {
  const by = new Map(rows.map((r) => [r[0], r]));
  if (TOPICS.some((t) => !by.has(t) || by.get(t)[1] === 'blocked')) return 'blocked';
  return rows.some((r) => r[1] === 'fail' || r[1] === 'fix-first') ? 'fix-first' : 'ship';
};

function responseMd({ results = PLAN.map((g) => [g.gate, 'pass']), verdict = 'pass', scorecard = SCORECARD, findings = [['PREDECESSOR_CONSUMED', '—', 'the producer receipt was consumed unchanged']], plan = PLAN, sonarScope = 'new-code', head = HEAD, cov = coverage(), coverageMetrics = ['branches'] } = {}) {
  return `# quality-verification — ${head}

The delivery was verified at one frozen head against the routed gate plan, and the verdict rests on
the measured gate files alone.

## Binding

| Field | Value |
| --- | --- |
| Operator | \`quality.verify\` |
| Step | \`step-1/parallel-1\` |
| Checkout | \`@workspaces/be\` |
| Head | \`${head}\` |
| Session branch | \`${BRANCH}\` |
| Predecessors | \`step-1/parallel-1/response/changes.md\` |

## Gate plan

| Gate | Required | Command | Configuration |
| --- | --- | --- | --- |
${plan.map((g) => `| \`${g.gate}\` | ${g.required === false ? 'no' : 'yes'} | \`${g.commandRef}\` | \`${g.configRef}\` |`).join('\n')}

## Results

| Gate | Status | Exit code | Evidence | Classification | Statement |
| --- | --- | --- | --- | --- | --- |
${results.map(([gate, status]) => `| \`${gate}\` | ${status} | ${status === 'pass' ? 0 : status === 'skipped-not-requested' ? '—' : 1} | \`gates/${gate}.log\` | ${status === 'fail' ? 'in-boundary' : '—'} | ${gate} measured |`).join('\n')}

## Coverage

| Metric | Measured | Threshold | Verdict |
| --- | --- | --- | --- |
${coverageMetrics.map((metric) => `| ${metric} | ${cov[metric]} | ${cov.thresholds[metric] === null ? '—' : cov.thresholds[metric]} | ${cov.thresholds[metric] === null ? 'unconfigured' : cov[metric] < cov.thresholds[metric] ? 'below' : 'at-or-above'} |`).join('\n')}

## Sonar

| Field | Value |
| --- | --- |
| Scope | ${sonarScope} |
| Finding | — |

## Debts

| Debt | Gate | Approval | Owner | Expires | Statement |
| --- | --- | --- | --- | --- | --- |

## Findings

| Code | Gate | Statement |
| --- | --- | --- |
${findings.map(([code, gate, statement]) => `| \`${code}\` | ${gate} | ${statement} |`).join('\n')}

## Gate verdict

| Field | Value |
| --- | --- |
| Verdict | \`${verdict}\` |

## Verdict

| Topic | Verdict | Route |
| --- | --- | --- |
${scorecard.map(([topic, v, route]) => `| \`${topic}\` | ${v} | ${route} |`).join('\n')}

Verdict: ${scorecardLine(scorecard)}
`;
}

const requestJson = ({ gates = PLAN, thresholds = THRESHOLDS, e2e = false, sonarScope = 'new-code', debts = [], head = HEAD, inputs = { changes: 'step-1/parallel-1/response/changes.md' }, extra = {} } = {}) => ({
  schemaVersion: 9, operatorId: 'quality.verify', step: 1, parallel: 1, sessionId: 's-test',
  contexts: [{ alias: '@workspaces/be', head }],
  requirements: { gates, thresholds, explicitE2eRequest: e2e, sonarScope, declaredDebts: debts, resume: null, ...extra },
  inputs, resume: null,
});

const responseJson = ({ status = 'done', stop, gates = PLAN.map((g) => `response/data/gates/${g.gate}.json`), coverageField = 'response/data/coverage.json', next = ['git.publish'] } = {}) => ({
  schemaVersion: 9, operatorId: 'quality.verify', step: 1, parallel: 1, status, ...(stop ? { stop } : {}),
  fallbacks: [],
  fields: status === 'blocked' ? {} : { 'quality-verification': 'response/response.md', 'gate-result': gates, ...(coverageField ? { coverage: coverageField } : {}) },
  commits: [], next,
});

function writeBranch(files) {
  files = structuredClone(files);
  if (files['response/response.md'] && !files['response/response.md'].includes('## Audit scope')) files['response/response.md'] += "\n## Audit scope\n\n| Field | Value |\n| --- | --- |\n| Mode | not-recorded |\n| Coverage claim | not-recorded |\n| Deferred states | — |\n";

  const session = mkdtempSync(path.join(tmpdir(), 'quality-session-'));
  const branch = path.join(session, 'step-1', 'parallel-1');
  for (const d of ['request', 'response/data/gates', 'response/artifacts']) mkdirSync(path.join(branch, d), { recursive: true });
  writeFileSync(path.join(session, 'state.json'), JSON.stringify({ id: 's-test', project: 'starci-academy', startedAt: '2026-09-03T00:00:00Z', requestHashes: {}, chain: [['1/1']], steps: { '1/1': 'quality.verify' }, current: '1/1', status: 'running' }));
  mkdirSync(path.join(session, 'step-1', 'parallel-1', 'response'), { recursive: true });
  writeFileSync(path.join(session, 'step-1', 'parallel-1', 'response', 'changes.md'), '# changes\n');
  if (files.__predecessorChanges !== undefined) writeFileSync(path.join(session, 'step-1', 'parallel-1', 'response', 'changes.md'), files.__predecessorChanges);
  for (const [name, content] of Object.entries(files)) {
    if (name === '__predecessorChanges') continue;
    if (content === null) continue;
    mkdirSync(path.dirname(path.join(branch, name)), { recursive: true });
    writeFileSync(path.join(branch, name), typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
  return { branch, session };
}

const baseline = (over = {}) => ({
  'request/request.json': requestJson(),
  'response/response.json': responseJson(),
  'response/response.md': responseMd(),
  'response/data/gates/format.json': gateResult('format'),
  'response/data/gates/lint.json': gateResult('lint'),
  'response/data/gates/unit-coverage.json': gateResult('unit-coverage'),
  'response/data/coverage.json': coverage(),
  ...over,
});

const effectiveReport = (configured) => ({
  version: '29.7.0',
  globalConfig: configured === undefined ? {} : { coverageThreshold: configured },
  configs: [{ rootDir: '/fixture' }],
});
function policyBaseline({ requested = [], configured, report = effectiveReport(configured), emitted = UNCONFIGURED, unitFails = false, policyOver = {}, over = {} } = {}) {
  const evidenceRef = 'request/artifacts/effective-config.json';
  const raw = typeof report === 'string' ? report : JSON.stringify(report, null, 2);
  const unitPlan = PLAN.find((gate) => gate.gate === 'unit-coverage');
  const coveragePolicy = {
    format: 'jest-show-config-29', sourceHead: HEAD,
    commandRef: unitPlan.commandRef, configRef: unitPlan.configRef,
    evidenceRef, evidenceSha256: createHash('sha256').update(raw).digest('hex'),
    ...policyOver,
  };
  const cov = coverage({ thresholds: emitted });
  return baseline({
    'request/request.json': requestJson({ thresholds: requested, extra: { coveragePolicy } }),
    [evidenceRef]: raw,
    'response/data/coverage.json': cov,
    'response/data/gates/unit-coverage.json': unitFails ? failing('unit-coverage') : gateResult('unit-coverage'),
    'response/response.json': responseJson({ next: unitFails ? ['backend.generate'] : ['git.publish'] }),
    'response/response.md': responseMd({
      cov, coverageMetrics: METRICS, verdict: unitFails ? 'fail' : 'pass',
      results: PLAN.map(({ gate }) => [gate, unitFails && gate === 'unit-coverage' ? 'fail' : 'pass']),
    }),
    ...over,
  });
}

// A red gate is a verdict, not a stop: the branch is done and the receipt says fail.
const red = () => baseline({
  'response/data/gates/lint.json': failing('lint'),
  'response/response.md': responseMd({ results: [['format', 'pass'], ['lint', 'fail'], ['unit-coverage', 'pass']], verdict: 'fail' }),
  'response/response.json': responseJson({ next: ['backend.generate'] }),
});

async function expectValid(files, label) {
  const { branch, session } = writeBranch(files);
  const { errors } = await validateQualityStep(branch);
  rmSync(session, { recursive: true, force: true });
  assert.deepEqual(errors, [], `${label} should be valid`);
}
async function expectError(files, needle, label) {
  const { branch, session } = writeBranch(files);
  const { errors } = await validateQualityStep(branch);
  rmSync(session, { recursive: true, force: true });
  assert.ok(errors.some((e) => e.includes(needle)), `${label}: expected an error containing "${needle}", got:\n${errors.join('\n') || '(none)'}`);
}

await expectValid(baseline(), 'a green verification with one file per gate');
const integratedGate=gateResult('lint',{sessionBranch:'integration-proof'}),integrationProducer={operatorId:'runtime.serve',status:'done',delta:{runtimeLadder:{rung:'serve',servedHead:HEAD,integration:{branch:'integration-proof'}}}};
assert.deepEqual(integrationGateBindingErrors(integratedGate,integrationProducer),[]);
assert.ok(integrationGateBindingErrors(integratedGate,null).length);
assert.ok(integrationGateBindingErrors({...integratedGate,sourceHead:OTHER_HEAD},integrationProducer).length);
assert.ok(integrationGateBindingErrors({...integratedGate,sessionBranch:'arbitrary'},integrationProducer).length);
assert.ok(integrationGateBindingErrors(integratedGate,{...integrationProducer,status:'blocked'}).length);
await expectError(baseline({'response/data/gates/lint.json':gateResult('lint',{sessionBranch:'uat'})}),'integration gate must bind','an integration label without a platform producer');
await expectValid(red(), 'a red gate returned as a verdict, not a stop');
await expectValid({
  'request/request.json': requestJson(),
  'response/response.json': responseJson({ status: 'blocked', stop: 'GATE_UNAVAILABLE', next: [] }),
  'response/response.md': null, 'response/data/coverage.json': null,
}, 'blocked because a required gate could not be executed');

await expectError(baseline({ 'response/response.json': { ...responseJson(), stop: 'DEBT_UNAPPROVED' } }), 'only a blocked response carries a stop', 'done with a stop');
await expectError(baseline({ 'response/response.json': responseJson({ status: 'blocked', stop: 'GATE_RED', next: [] }) }), 'not a registered code', 'unknown stop code');
await expectError(baseline({ 'request/request.json': requestJson({ extra: { cachePolicy: 'fresh' } }) }), 'requirements.cachePolicy is not a field', 'a field the operator no longer declares');
await expectError(baseline({ 'request/request.json': requestJson({ gates: [...PLAN, { gate: 'e2e', commandRef: 'p#e2e', configRef: 'e2e.config.ts', required: false }] }) }), 'cannot be planned without an explicit request', 'e2e planned with no person asking');
await expectError(baseline({
  'request/request.json': requestJson({ gates: [...PLAN, { gate: 'e2e', commandRef: 'p#e2e', configRef: 'e2e.config.ts', required: false }] }),
  'response/data/gates/e2e.json': gateResult('e2e', { required: false, status: 'pass' }),
  'response/response.json': responseJson({ gates: [...PLAN.map((g) => `response/data/gates/${g.gate}.json`), 'response/data/gates/e2e.json'] }),
  'response/response.md': responseMd({ plan: [...PLAN, { gate: 'e2e', commandRef: 'p#e2e', configRef: 'e2e.config.ts', required: false }], results: [...PLAN.map((g) => [g.gate, 'pass']), ['e2e', 'pass']] }),
}), 'ran without an explicit request', 'the e2e suite run unasked');
await expectError(baseline({ 'request/request.json': requestJson({ gates: PLAN, e2e: true }), 'response/data/gates/e2e.json': gateResult('e2e', { status: 'skipped-not-requested', exitCode: null, evidenceRef: null }) }), 'never planned it', 'a gate result for a gate nobody planned');
await expectError(baseline({ 'response/data/gates/lint.json': gateResult('lint', { exitCode: 1 }) }), 'passed with a non-zero exit code', 'a pass over a failing command');
await expectError(baseline({ 'response/data/gates/lint.json': gateResult('lint', { evidenceRef: null }) }), 'passed with no evidence to open', 'a pass with nothing to open');
await expectError(baseline({ 'response/data/gates/lint.json': failing('lint', { classification: null }), 'response/response.md': responseMd({ results: [['format', 'pass'], ['lint', 'fail'], ['unit-coverage', 'pass']], verdict: 'fail' }) }), 'without an in-boundary, boundary-drift, or flaky classification', 'a failure nobody classified');
await expectError(baseline({ 'response/data/gates/format.json': gateResult('format', { status: 'skipped-not-requested', exitCode: null, evidenceRef: null }) }), 'cannot be skipped as not requested', 'a gate other than e2e quietly skipped');
await expectError(baseline({ 'response/data/gates/lint.json': gateResult('lint', { sourceHead: OTHER_HEAD, predecessorCommit: OTHER_HEAD }) }), 'different heads', 'two gates standing on two heads');
await expectError(baseline({ 'request/request.json': requestJson({ head: OTHER_HEAD }), 'response/response.md': responseMd({ head: OTHER_HEAD }) }), 'but the request pinned', 'gates measured off the pinned commit');
await expectError(baseline({ 'response/data/gates/lint.json': gateResult('lint', { predecessorCommit: OTHER_HEAD }) }), 'which is not the head', 'a predecessor describing another commit');
await expectError(baseline({ 'response/data/gates/lint.json': gateResult('lint', { sonarScope: 'new-code' }) }), 'belongs to the sonar gate alone', 'a sonar scope on a lint result');
// A backend-only delivery owes no surface verdict: nine not-applicable rows ship on the gates; a request that binds fe may not say so.
const NOT_APPLICABLE = SCORECARD.map(([topic]) => [topic, 'not-applicable', 'none']);
await expectValid(baseline({ 'response/response.md': responseMd({ scorecard: NOT_APPLICABLE }) }), 'a backend-only delivery ships on its gates with every surface topic not-applicable');
await expectError(baseline({ 'request/request.json': { ...requestJson(), contexts: [{ alias: '@workspaces/be', head: HEAD }, { alias: '@workspaces/fe', head: HEAD }] }, 'response/response.md': responseMd({ scorecard: NOT_APPLICABLE }) }), 'binds @workspaces/fe', 'a surface delivery that calls its topics not-applicable');
await expectError(baseline({ 'response/response.md': responseMd({ scorecard: SCORECARD.map(([t]) => [t, 'not-applicable', 'interface.generate']) }) }), 'still routes to', 'a not-applicable row that routes somewhere');
// Lint under the default changed scope: the delivery's own errors decide, a red base is a finding.
await expectError(baseline({ 'response/data/gates/lint.json': gateResult('lint', { lint: null }) }), 'records lint { baseline, delivery, changedFiles }', 'a changed-scope lint result with no counts');
await expectError(baseline({ 'response/data/gates/lint.json': gateResult('lint', { lint: { baseline: 4030, delivery: 127, changedFiles: 18 } }) }), 'passes exactly when the delivery added none', 'a passing lint gate over a delivery that added errors');
await expectError(baseline({ 'response/data/gates/lint.json': gateResult('lint', { lint: { baseline: 4030, delivery: 0, changedFiles: 18 } }) }), 'must record LINT_BASELINE_RED', 'a green changed-scope lint gate over a red base read as project health');
await expectError(baseline({ 'response/data/gates/typecheck.json': gateResult('typecheck', { lint: { baseline: 0, delivery: 0, changedFiles: 1 } }) }), 'belongs to the lint gate alone', 'a lint record on a typecheck result');
await expectValid(baseline({ 'request/request.json': requestJson({ extra: { lintScope: 'overall' } }), 'response/data/gates/lint.json': gateResult('lint', { lint: null }) }), 'lint under overall scope carries no delivery counts');
await expectError(baseline({ 'response/data/gates/unit-coverage.json': gateResult('unit-coverage', { gate: 'unit-coverage' }), 'response/data/coverage.json': coverage({ branches: 40 }), 'response/response.md': responseMd({ cov: coverage({ branches: 40 }) }) }), 'sit below their own threshold', 'a green unit gate over a red branch metric');
await expectError(baseline({ 'response/data/coverage.json': coverage({ thresholds: { ...THRESHOLDS, branches: 50 } }) }), 'but the request pinned', 'a threshold lowered under the request');
await expectError(baseline({ 'response/data/coverage.json': null, 'response/response.json': responseJson({ coverageField: null }) }), 'reports no coverage measurement', 'a passing unit gate with no coverage');

// Absence is established by the frozen effective configuration, while measured unit failures keep
// their original result. A numeric zero remains distinct from a metric with no threshold.
await expectValid(policyBaseline(), 'measured coverage with no configured or requested thresholds');
await expectValid(policyBaseline({ configured: {} }), 'an empty effective threshold map');
await expectValid(policyBaseline({ configured: { global: {} } }), 'an empty global threshold map');
await expectValid(policyBaseline({ unitFails: true }), 'a raw unit failure with every coverage threshold unconfigured');
await expectValid(policyBaseline({ configured: { global: { branches: 0 } }, emitted: { ...UNCONFIGURED, branches: 0 } }), 'a configured explicit zero');
await expectValid(policyBaseline({ requested: { branches: 0 }, emitted: { ...UNCONFIGURED, branches: 0 } }), 'a requested explicit zero');
await expectValid(policyBaseline({
  requested: [{ statements: 70, lines: 75 }, { functions: 60, branches: 70 }, { branches: 80 }],
  configured: { global: { functions: 65, branches: 75 } },
  emitted: { statements: 70, lines: 75, functions: 65, branches: 80 },
}), 'all configured and requested bars survive list normalization');
await expectValid(policyBaseline({ requested: THRESHOLDS, configured: { global: { statements: 85 } }, emitted: { ...THRESHOLDS, statements: 85 } }), 'supplied configuration evidence strengthens a fully numeric request');

await expectError(policyBaseline({ configured: { global: { branches: 0 } } }), 'threshold', 'configured zero replaced by absent');
await expectError(policyBaseline({ requested: { branches: 0 } }), 'threshold', 'requested zero replaced by absent');
await expectError(policyBaseline({ configured: { global: { branches: 75 } }, emitted: { ...UNCONFIGURED, branches: 70 } }), 'threshold', 'a configured threshold lowered in coverage');
await expectError(policyBaseline({ requested: [{ branches: 70 }, { branches: 80 }], emitted: { ...UNCONFIGURED, branches: 70 } }), 'threshold', 'a requested list bar dropped during normalization');
await expectError(policyBaseline({ requested: THRESHOLDS, configured: { global: { statements: 85 } }, emitted: THRESHOLDS }), 'threshold', 'opt-in evidence ignored for an otherwise complete numeric request');
await expectError(policyBaseline({ emitted: Object.fromEntries(METRICS.map((metric) => [metric, 0])) }), 'threshold', 'unconfigured metrics fabricated as zero');
await expectError(baseline({ 'request/request.json': requestJson({ thresholds: [] }) }), 'coveragePolicy', 'an empty request with invented numeric thresholds and no evidence');
await expectError(policyBaseline({ over: { 'request/request.json': requestJson({ thresholds: [] }) } }), 'coveragePolicy', 'null thresholds without effective-configuration evidence');

await expectError(policyBaseline({ policyOver: { evidenceSha256: '0'.repeat(64) } }), 'coveragePolicy', 'a tampered effective-configuration digest');
await expectError(policyBaseline({ over: { 'request/artifacts/effective-config.json': JSON.stringify(effectiveReport({ global: { branches: 80 } }), null, 2) } }), 'coveragePolicy', 'the raw report changed after its digest was pinned');
await expectError(policyBaseline({ over: { 'request/artifacts/effective-config.json': null } }), 'coveragePolicy', 'a missing raw effective-configuration report');
for (const [field, value] of [['sourceHead', OTHER_HEAD], ['commandRef', 'package.json#scripts.other'], ['configRef', 'other.config.json']]) {
  await expectError(policyBaseline({ policyOver: { [field]: value } }), 'coveragePolicy', `effective configuration bound to another ${field}`);
}
await expectError(policyBaseline({ over: { 'response/data/gates/unit-coverage.json': gateResult('unit-coverage', { commandRef: 'package.json#scripts.other' }) } }), 'commandRef', 'the measured command differs from the gate plan');
await expectError(policyBaseline({ over: { 'response/data/gates/unit-coverage.json': gateResult('unit-coverage', { configRef: 'other.config.json' }) } }), 'configRef', 'the measured configuration differs from the gate plan');

for (const [report, label] of [
  ['not JSON', 'an unreadable report'],
  [{}, 'a missing report envelope'],
  [{ version: '29.7.0', globalConfig: {}, configs: [] }, 'a report with no project configurations'],
  [{ version: '29.7.0', globalConfig: {}, configs: [null] }, 'a malformed project configuration'],
  [{ version: '29.7.0', configs: [{}] }, 'a missing global configuration'],
  [{ ...effectiveReport(), version: '30.0.0' }, 'an unsupported report version'],
  [effectiveReport({ global: { branches: '80' } }), 'a nonnumeric configured threshold'],
  [effectiveReport({ global: { branches: -1 } }), 'an uncovered-count threshold'],
  [effectiveReport({ global: { branches: 101 } }), 'a percentage outside its range'],
  [effectiveReport({ './scoped/': { branches: 80 } }), 'a scoped threshold'],
  [{ ...effectiveReport(), configs: [{ coverageThreshold: { global: { branches: 80 } } }] }, 'a project-local threshold'],
]) {
  await expectError(policyBaseline({ report }), 'coverage', `${label} cannot prove threshold absence`);
}

const unconfiguredMd = policyBaseline()['response/response.md'];
await expectError(policyBaseline({ over: { 'response/response.md': unconfiguredMd.replace('| branches | 81.4 | — | unconfigured |', '| branches | 81.4 | — | at-or-above |') } }), 'Coverage', 'an unconfigured metric narrated as meeting a threshold');
await expectError(policyBaseline({ over: { 'response/response.md': unconfiguredMd.replace('| branches | 81.4 | — | unconfigured |', '| branches | 99 | — | unconfigured |') } }), 'Coverage', 'a measured percentage changed in the receipt');
await expectError(policyBaseline({ over: { 'response/response.md': responseMd({ cov: coverage({ thresholds: UNCONFIGURED }) }) } }), 'all four metrics', 'a policy receipt that omits three measured metrics');

await expectError(baseline({ 'response/response.md': responseMd({ verdict: 'fail' }) }), 'every required gate passed or is debt-covered', 'a red verdict over green gates');
await expectError({ ...red(), 'response/response.md': responseMd({ results: [['format', 'pass'], ['lint', 'fail'], ['unit-coverage', 'pass']], verdict: 'pass' }) }, 'neither passed nor carry a debt', 'a green verdict over a red required gate');
await expectError(baseline({
  'request/request.json': requestJson({ debts: [DEBT] }),
  'response/data/gates/lint.json': failing('lint', { debt: { debtId: 'lint-debt', approvalRef: DEBT.approvalRef, ownerRef: DEBT.ownerRef, expiresAt: '2025-01-01T00:00:00.000Z', statement: 'carried' } }),
  'response/response.md': responseMd({ results: [['format', 'pass'], ['lint', 'fail'], ['unit-coverage', 'pass']], findings: [['DEBT_DECLARED', 'lint', 'the lint failure is owed']] }),
}), 'expired before the gate was measured', 'a debt whose approval has run out');
await expectError(baseline({
  'request/request.json': requestJson({ debts: [{ ...DEBT, gate: 'format' }] }),
  'response/data/gates/format.json': failing('format', { classification: 'boundary-drift', debt: { debtId: 'lint-debt', approvalRef: DEBT.approvalRef, ownerRef: DEBT.ownerRef, expiresAt: DEBT.expiresAt, statement: 'carried' } }),
  'response/response.md': responseMd({ results: [['format', 'fail'], ['lint', 'pass'], ['unit-coverage', 'pass']], findings: [['DEBT_DECLARED', 'format', 'owed']] }),
}), 'belongs to the boundary owner', 'a boundary-drift failure owed away');
await expectError(baseline({ 'response/data/gates/lint.json': failing('lint', { debt: { debtId: 'ghost-debt', approvalRef: 'x', ownerRef: 'y', expiresAt: DEBT.expiresAt, statement: 'z' } }), 'response/response.md': responseMd({ results: [['format', 'pass'], ['lint', 'fail'], ['unit-coverage', 'pass']], findings: [['DEBT_DECLARED', 'lint', 'owed']] }) }), 'was never declared in the request', 'a debt nobody declared');
await expectError({
  ...baseline({
    'request/request.json': requestJson({ gates: [...PLAN, { gate: 'sonar', commandRef: 'p#sonar', configRef: 'sonar-project.properties', required: false }] }),
    'response/data/gates/sonar.json': gateResult('sonar', { required: false, sonarScope: 'new-code' }),
    'response/response.json': responseJson({ gates: [...PLAN.map((g) => `response/data/gates/${g.gate}.json`), 'response/data/gates/sonar.json'] }),
    'response/response.md': responseMd({ plan: [...PLAN, { gate: 'sonar', commandRef: 'p#sonar', configRef: 'sonar-project.properties', required: false }], results: [...PLAN.map((g) => [g.gate, 'pass']), ['sonar', 'pass']] }),
  }),
}, 'must record SONAR_NEW_CODE_ONLY', 'a green new-code Sonar gate read as project health');
await expectError(baseline({ 'response/response.md': responseMd({ results: [['format', 'pass'], ['lint', 'pass']] }) }), 'Results has 2 rows', 'a receipt that drops a measured gate');
await expectError(baseline({ 'response/response.md': responseMd().replace('## Verdict', '## Result') }), 'missing section ^## Verdict$', 'receipt section renamed');
await expectError(baseline({ 'response/data/gates/lint.json': { ...gateResult('lint'), sourceHead: 'nope' } }), 'sourceHead', 'gate-result schema');
await expectError(baseline({ 'response/response.json': responseJson({ gates: ['response/data/gates/format.json', 'response/data/gates/lint.json'] }) }), 'gate-result does not list', 'a gate file the response never lists');
await expectError(baseline({ 'request/request.json': requestJson({ inputs: {} }) }), 'needs at least one of', 'a verification with no producer receipt');
await expectError(baseline({ __predecessorChanges: `# changes — backend.generate step-1/parallel-1

## Binding

| Field | Value |
| --- | --- |
| Operator | \`backend.generate\` |
| Step | \`step-1/parallel-1\` |
| Checkout | \`@workspaces/be\` at \`${HEAD}\` on \`session/s-test\`, nothing written |
| Predecessor | \`step-1/parallel-1/response/response.md\` |
` }), 'PREDECESSOR_STALE', 'a predecessor produced under mode dry');

// A frontend delivery carries the presentation sweep, because nothing else in the plan measures which
// node a class landed on. The producer receipt carries a commit, so it is a delivery and not a plan.
function frontendApplication() {
  return `# frontend-source-application — overview

## Binding

| Field | Value |
| --- | --- |
| Target | \`overview\` |
| Mode | \`apply\` |
| Branch | \`${BRANCH}\` |
| Base | \`${OTHER_HEAD}\` |
| Commit | \`${HEAD}\` |
`;
}
await expectError(baseline({
  'request/request.json': requestJson({ inputs: { changes: 'step-1/parallel-1/response/changes.md', 'frontend-source-application': 'step-1/parallel-1/response/application.md' } }),
  'response/application.md': frontendApplication(),
}), 'plans the presentation-sweep gate', 'a frontend delivery gated without the presentation sweep');
await expectValid(baseline({
  'request/request.json': requestJson({
    gates: [...PLAN, { gate: 'presentation-sweep', commandRef: 'package.json#scripts.sweep:presentation', configRef: '.claude/scripts/sweep-presentation.mjs', required: true }],
    inputs: { changes: 'step-1/parallel-1/response/changes.md', 'frontend-source-application': 'step-1/parallel-1/response/application.md' },
  }),
  'response/application.md': frontendApplication(),
  'response/data/gates/presentation-sweep.json': gateResult('presentation-sweep', { commandRef: 'package.json#scripts.sweep:presentation', configRef: '.claude/scripts/sweep-presentation.mjs' }),
  'response/response.json': responseJson({ gates: [...PLAN.map((g) => `response/data/gates/${g.gate}.json`), 'response/data/gates/presentation-sweep.json'] }),
  'response/response.md': responseMd({
    plan: [...PLAN, { gate: 'presentation-sweep', commandRef: 'package.json#scripts.sweep:presentation', configRef: '.claude/scripts/sweep-presentation.mjs', required: true }],
    results: [...PLAN.map((g) => [g.gate, 'pass']), ['presentation-sweep', 'pass']],
  }),
}), 'a frontend delivery whose plan carries the presentation sweep');

// The scorecard is copied, never rescored, and the line is computed from the rows.
await expectValid(baseline({ 'response/response.md': responseMd({ scorecard: SCORECARD.map((r) => (r[0] === 'experience' ? ['experience', 'blocked', 'none'] : r)) }) }), 'a delivery whose experience topic was never observed');
await expectError(baseline({ 'response/response.md': responseMd({ scorecard: SCORECARD.slice(0, 8) }) }), 'Verdict carries no experience row', 'a scorecard missing a topic');
await expectError(baseline({ 'response/response.md': responseMd().replace('Verdict: ship', 'Verdict: fix-first') }), 'the rows make it ship', 'a line the rows do not produce');
await expectError(baseline({ 'response/response.md': responseMd({ scorecard: SCORECARD.map((r) => (r[0] === 'taste' ? ['taste', 'fix-first', 'direction'] : r)) }).replace('Verdict: fix-first', 'Verdict: ship') }), 'the rows make it fix-first', 'a fix-first row reported as a ship');
await expectError(baseline({ 'response/response.md': responseMd({ scorecard: SCORECARD.map((r) => (r[0] === 'motion' ? ['motion', 'blocked', 'direction'] : r)) }) }), 'is blocked and still routes to direction', 'a blocked topic given an owner');

const scopedAudit = { mode: 'primary-surfaces', surfaces: [{ id: 'primary', type: 'page', route: '/primary', matrixIds: ['primary-loaded'] }], deferredStates: ['empty'], coverageClaim: 'selected-surfaces' };
for (const omitCarry of [false, true]) {
  const files = baseline();
  files['request/request.json'].inputs['frontend-surface-audit'] = 'step-2/parallel-1/response/response.md';
  if (!omitCarry) {
    files['response/data/audit-scope.json'] = scopedAudit;
    files['response/response.json'].fields['audit-scope'] = 'response/data/audit-scope.json';
  }
  files['response/response.md'] += '\n## Audit scope\n\n| Field | Value |\n| --- | --- |\n| Mode | primary-surfaces |\n| Coverage claim | selected-surfaces |\n| Deferred states | empty |\n';
  const { branch, session } = writeBranch(files);
  try {
    const source = path.join(session, 'step-2/parallel-1/response');
    mkdirSync(path.join(source, 'data'), { recursive: true });
    writeFileSync(path.join(source, 'response.md'), '# admitting surface audit\n');
    writeFileSync(path.join(source, 'data/verdicts.json'), JSON.stringify({ auditScope: scopedAudit }));
    const { errors } = await validateQualityStep(branch);
    if (omitCarry) assert.ok(errors.some((error) => error.includes('must carry response/data/audit-scope.json')), errors.join('\n'));
    else assert.deepEqual(errors, [], 'quality carries limited UI scope while its coverage gates remain unchanged');
  } finally { rmSync(session, { recursive: true, force: true }); }
}

process.stdout.write('quality.verify self-test: gate, scope and mutation checks passed\n');
