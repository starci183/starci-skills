import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildEvidenceManifest } from './evidence-manifest.mjs';
import { validateAgainst } from './json-schema.mjs';
import { outcomeErrors, outcomeRegistryErrors } from './validate-response.mjs';
import { renderOutcome } from './render-outcome.mjs';

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contract = 'starci/v2.2';
const registry = {
  schemaVersion: 1,
  kinds: {
    image: { responseTypes: ['artifact'] }, table: { responseTypes: ['md', 'data'] },
    code: { responseTypes: ['artifact', 'md'] }, diagram: { responseTypes: ['artifact', 'md'] },
    document: { responseTypes: ['md', 'artifact'] }, link: { responseTypes: ['md', 'artifact', 'data'] }
  },
  operators: { 'demo.make': { primaryKinds: ['image', 'document'], guidance: 'Show the selected result.' } }
};
const pkg = { en: { tables: { outputs: { rows: [
  { kind: 'captures', file: 'response/artifacts/<candidate>.png', type: 'artifact' },
  { kind: 'report', file: 'response/response.md', type: 'md' }
] } } } };
// A real encoded 1x1 PNG; the image gate checks structure and dimensions, not the filename alone.
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

async function fixture() {
  const base = await mkdtemp(path.join(os.tmpdir(), 'starci-outcome-'));
  const session = path.join(base, 'session');
  const branch = path.join(session, 'step-1', 'parallel-1');
  await mkdir(path.join(branch, 'request'), { recursive: true });
  await mkdir(path.join(branch, 'response', 'artifacts'), { recursive: true });
  await writeFile(path.join(branch, 'request', 'request.json'), '{}\n');
  await writeFile(path.join(branch, 'response', 'artifacts', 'selected.png'), png);
  const response = {
    contractVersion: contract, schemaVersion: 9, operatorId: 'demo.make', step: 1, parallel: 1,
    status: 'done', fields: { captures: ['response/artifacts/selected.png'] }, fallbacks: [], commits: [], next: [],
    boundProfile: 'demo', ranProfile: 'demo', attempt: { id: 'attempt-1', number: 1, expectedVersion: 1 },
    actual: { expectedVersion: 1, observedAt: new Date().toISOString(), observations: [{ criterionId: 'result', observed: 'A selected capture exists.', evidence: ['response/artifacts/selected.png'] }] },
    comparison: { expectedVersion: 1, verdict: 'matched', criteria: [{ criterionId: 'result', verdict: 'matched', evidence: ['response/artifacts/selected.png'], note: 'Native capture is present.' }], next: 'advance' },
    outcome: { summary: 'The selected candidate is ready to review.', primary: { kind: 'image', label: 'Selected candidate', ref: 'response/artifacts/selected.png' } }
  };
  await writeFile(path.join(branch, 'response', 'response.json'), `${JSON.stringify(response, null, 2)}\n`);
  return { base, session, branch, response };
}

async function sealFixture(f) {
  const manifest = await buildEvidenceManifest(f.branch);
  await writeFile(path.join(f.session, 'state.json'), `${JSON.stringify({
    contractVersion: contract,
    attempts: { '1/1': { id: 'attempt-1', status: 'matched', responseRef: 'step-1/parallel-1/response/response.json', evidenceManifest: manifest } }
  }, null, 2)}\n`);
}

test('response schema requires an outcome only for marked v2.2 done receipts', async () => {
  const schema = JSON.parse(await readFile(path.join(sourceRoot, 'templates', 'step', 'response.schema.json'), 'utf8'));
  const marked = {
    contractVersion: contract, schemaVersion: 9, operatorId: 'demo.make', step: 1, parallel: 1, status: 'done',
    fields: {}, fallbacks: [], commits: [], next: [], boundProfile: 'demo', ranProfile: 'demo',
    attempt: { id: 'a', number: 1, expectedVersion: 1 },
    actual: { expectedVersion: 1, observedAt: '2026-09-05T00:00:00Z', observations: [{ criterionId: 'x', observed: 'x', evidence: ['response/response.md'] }] },
    comparison: { expectedVersion: 1, verdict: 'matched', criteria: [{ criterionId: 'x', verdict: 'matched', evidence: ['response/response.md'], note: 'x' }], next: 'advance' }
  };
  assert.match(validateAgainst(schema, marked, 'response.json').join('\n'), /outcome: required/);
  const { contractVersion, attempt, boundProfile, ranProfile, actual, comparison, ...legacy } = marked;
  assert.deepEqual(validateAgainst(schema, legacy, 'response.json'), []);
});

test('outcome gate accepts one native image selected from an array-valued owned field', async (t) => {
  const f = await fixture(); t.after(() => rm(f.base, { recursive: true, force: true }));
  assert.deepEqual(await outcomeErrors(sourceRoot, f.branch, f.response, pkg, { registry }), []);
});

test('outcome gate rejects fake images, traversal, missing outcomes and false success states', async (t) => {
  const f = await fixture(); t.after(() => rm(f.base, { recursive: true, force: true }));
  await writeFile(path.join(f.branch, 'response', 'artifacts', 'selected.png'), 'this is not an image');
  assert.match((await outcomeErrors(sourceRoot, f.branch, f.response, pkg, { registry })).join('\n'), /not a valid PNG/);
  const escaped = structuredClone(f.response);
  escaped.outcome.primary.ref = '../response/artifacts/selected.png';
  assert.match((await outcomeErrors(sourceRoot, f.branch, escaped, pkg, { registry })).join('\n'), /leaves its attempt branch|not one of response.fields/);
  const missing = structuredClone(f.response); delete missing.outcome;
  assert.match((await outcomeErrors(sourceRoot, f.branch, missing, pkg, { registry })).join('\n'), /every v2\.2 done receipt/);
  const mismatch = structuredClone(f.response); mismatch.status = 'mismatch';
  assert.match((await outcomeErrors(sourceRoot, f.branch, mismatch, pkg, { registry })).join('\n'), /reserved for an accepted done result/);
  const legacy = structuredClone(f.response); delete legacy.contractVersion; delete legacy.outcome;
  assert.deepEqual(await outcomeErrors(sourceRoot, f.branch, legacy, pkg, { registry }), []);
});

test('primaryOutputs refuses a report in place of an audit capture and a wrong code artifact', async (t) => {
  const f = await fixture(); t.after(() => rm(f.base, { recursive: true, force: true }));
  await writeFile(path.join(f.branch, 'response', 'response.md'), '# Review report\n\nThe capture passed.\n');
  const auditRegistry = structuredClone(registry);
  auditRegistry.operators['demo.make'] = { primaryKinds: ['image'], primaryOutputs: ['captures'], guidance: 'Show the capture.' };
  const report = structuredClone(f.response);
  report.fields.report = 'response/response.md';
  report.outcome.primary = { kind: 'document', label: 'Report', ref: 'response/response.md' };
  const reportErrors = await outcomeErrors(sourceRoot, f.branch, report, pkg, { registry: auditRegistry });
  assert.match(reportErrors.join('\n'), /not an allowed primary kind/);
  assert.match(reportErrors.join('\n'), /not emitted by one of demo\.make\.primaryOutputs \(captures\)/);

  const codeRegistry = structuredClone(registry);
  codeRegistry.operators['demo.make'] = { primaryKinds: ['code'], primaryOutputs: ['report'], guidance: 'Show changes.' };
  const wrongCode = structuredClone(f.response);
  wrongCode.fields.report = 'response/response.md';
  wrongCode.outcome.primary = { kind: 'code', label: 'Wrong artifact', ref: 'response/artifacts/selected.png' };
  assert.match((await outcomeErrors(sourceRoot, f.branch, wrongCode, pkg, { registry: codeRegistry })).join('\n'), /not emitted by one of demo\.make\.primaryOutputs \(report\)/);

  const brokenRegistry = structuredClone(codeRegistry);
  brokenRegistry.operators['demo.make'].primaryOutputs = ['not-declared'];
  assert.match(outcomeRegistryErrors(brokenRegistry, [{ manifest: { id: 'demo.make' }, ...pkg }]).join('\n'), /names undeclared Output not-declared/);
});

test('renderer requires a matched accepted seal and emits the native image as an absolute embed', async (t) => {
  const f = await fixture(); t.after(() => rm(f.base, { recursive: true, force: true }));
  await sealFixture(f);
  let fullGate = null;
  const rendered = await renderOutcome(sourceRoot, f.branch, { validateStepFn: async (...args) => { fullGate = args; return { errors: [] }; } });
  assert.equal(fullGate[1], f.branch);
  assert.deepEqual(fullGate[2], { operator: true, requestPhase: 'accept' });
  assert.match(rendered, /^## The best outcome\n\n/);
  assert.match(rendered, /!\[Selected candidate\]\(<[A-Z]:\/|!\[Selected candidate\]\(<\//);
  assert.match(rendered, /response\/artifacts\/selected\.png>\)/);

  const stateFile = path.join(f.session, 'state.json');
  const state = JSON.parse(await readFile(stateFile, 'utf8'));
  state.attempts['1/1'].status = 'mismatched';
  await writeFile(stateFile, JSON.stringify(state));
  await assert.rejects(() => renderOutcome(sourceRoot, f.branch, { validateStepFn: async () => ({ errors: [] }) }), /only an accepted matched attempt/);
});

test('renderer expands real-shaped JSON receipt arrays instead of stringifying the top-level object', async (t) => {
  const f = await fixture(); t.after(() => rm(f.base, { recursive: true, force: true }));
  const receiptRef = 'response/data/repair.json';
  await mkdir(path.join(f.branch, 'response', 'data'), { recursive: true });
  await writeFile(path.join(f.branch, receiptRef), JSON.stringify({
    schemaVersion: 10,
    questionFingerprint: `sha256:${'1'.repeat(64)}`,
    manifestBefore: `sha256:${'2'.repeat(64)}`,
    manifestAfter: `sha256:${'3'.repeat(64)}`,
    decision: 'repair-existing-rule', rule: 'UI-12', case: 'Case 4',
    files: [{ path: 'knowledge/ui/presentation.md', before: `sha256:${'4'.repeat(64)}`, after: `sha256:${'5'.repeat(64)}` }],
    evidence: ['failing fixture now passes', 'mirror and catalog agree'],
    retry: { operator: 'interface.audit', surfaceRef: 'checkout/settings', manifestFingerprint: `sha256:${'3'.repeat(64)}` }
  }, null, 2));
  f.response.fields = { receipt: receiptRef };
  f.response.outcome = { summary: 'The repaired rule and its changed sources are ready.', primary: { kind: 'table', label: 'Knowledge repair receipt', ref: receiptRef } };
  await writeFile(path.join(f.branch, 'response', 'response.json'), `${JSON.stringify(f.response, null, 2)}\n`);
  await sealFixture(f);
  const rendered = await renderOutcome(sourceRoot, f.branch, { validateStepFn: async () => ({ errors: [] }) });
  assert.match(rendered, /### Files\n\n\| path \| before \| after \|/);
  assert.match(rendered, /knowledge\/ui\/presentation\.md/);
  assert.match(rendered, /### Evidence\n\n- failing fixture now passes/);
  assert.match(rendered, /Open the full Knowledge repair receipt artifact/);
});

test('renderer surfaces lane verdicts from real-shaped API data', async (t) => {
  const f = await fixture(); t.after(() => rm(f.base, { recursive: true, force: true }));
  const verdictRef = 'response/data/verdicts.json';
  await mkdir(path.join(f.branch, 'response', 'data'), { recursive: true });
  await writeFile(path.join(f.branch, verdictRef), JSON.stringify({
    runId: 'api-run-1', commit: '1'.repeat(40), servedHead: '2'.repeat(40), namespace: 'uat-checkout',
    flowRoot: '.worktrees/e2e/checkout', resultRef: '.worktrees/e2e/checkout/runs/api-run-1/result.json',
    latestRef: '.worktrees/e2e/checkout/latest.json', historyRef: '.worktrees/e2e/checkout/history.md',
    lanes: [
      { lane: 'contract', verdict: 'pass', evidenceRefs: ['cases.json'], statement: 'Every runner case passed.' },
      { lane: 'data', verdict: 'pass', evidenceRefs: ['reads.json'], statement: 'All rows stayed in namespace.' },
      { lane: 'lifecycle', verdict: 'pass', evidenceRefs: ['cleanup.json'], statement: 'The namespace alone was deleted.' }
    ],
    records: [{ id: 'order-1', store: 'orders', inNamespace: true, readBackRef: 'GET /orders/order-1' }],
    cleanup: { performed: true, verifiedReadOnly: true, namespace: 'uat-checkout', runRecordsDeleted: false }
  }, null, 2));
  f.response.fields = { verdicts: verdictRef };
  f.response.outcome = { summary: 'All three API lanes passed.', primary: { kind: 'table', label: 'API verdicts', ref: verdictRef } };
  await writeFile(path.join(f.branch, 'response', 'response.json'), `${JSON.stringify(f.response, null, 2)}\n`);
  await sealFixture(f);
  const rendered = await renderOutcome(sourceRoot, f.branch, { validateStepFn: async () => ({ errors: [] }) });
  assert.match(rendered, /### Lanes\n\n\| lane \| verdict \| evidenceRefs \| statement \|/);
  assert.match(rendered, /\| lifecycle \| pass \|/);
  assert.match(rendered, /### Records\n\n\| id \| store \| inNamespace \| readBackRef \|/);
});

test('renderer keeps both flow ownership and executable cases from a real-shaped UAT plan', async (t) => {
  const f = await fixture(); t.after(() => rm(f.base, { recursive: true, force: true }));
  const casesRef = 'response/data/cases.json';
  await mkdir(path.join(f.branch, 'response', 'data'), { recursive: true });
  await writeFile(path.join(f.branch, casesRef), JSON.stringify({
    contractVersion: contract, feature: 'checkout', env: 'dev', planVersion: 'uat-plan/1',
    flows: [{ flowId: 'buy', state: 'valid', action: 'reuse', entry: '/checkout', actorAliases: ['buyer'], namespace: 'uat-checkout-buy' }],
    cases: [{
      caseId: 'buy-card', flowId: 'buy', order: 1, actor: 'buyer', preconditions: ['cart has one item'], inputs: ['visa'],
      actions: ['open checkout', 'submit payment'], assertions: ['order-created'], expected: ['confirmation appears'],
      verification: ['read order through API'], fixture: { jsonRef: '.worktrees/uat/checkout/buy/seed/records.json', sqlRef: null, createsAssertedOutcome: false },
      cleanup: 'data.seed removes uat-checkout-buy'
    }]
  }, null, 2));
  f.response.fields = { cases: casesRef };
  f.response.outcome = { summary: 'The checkout flow and case are ready.', primary: { kind: 'table', label: 'UAT case sheet', ref: casesRef } };
  await writeFile(path.join(f.branch, 'response', 'response.json'), `${JSON.stringify(f.response, null, 2)}\n`);
  await sealFixture(f);
  const rendered = await renderOutcome(sourceRoot, f.branch, { validateStepFn: async () => ({ errors: [] }) });
  assert.match(rendered, /### Cases\n\n\| caseId \| flowId \| order \| actor/);
  assert.match(rendered, /buy-card.*buyer/);
  assert.match(rendered, /### Flows\n\n\| flowId \| state \| action \| entry \| actorAliases \| namespace \|/);
  assert.match(rendered, /\/checkout.*uat-checkout-buy/);
});

test('renderer chooses result and verdict tables over receipt binding and embeds secondary images', async (t) => {
  const f = await fixture(); t.after(() => rm(f.base, { recursive: true, force: true }));
  const reportRef = 'response/response.md';
  await writeFile(path.join(f.branch, reportRef), `# quality-verification — head\n\n## Binding\n\n| Field | Value |\n| --- | --- |\n| Operator | quality.verify |\n\n## Results\n\n| Gate | Status | Evidence |\n| --- | --- | --- |\n| lint | pass | gates/lint.json |\n\n## Gate verdict\n\n| Field | Value |\n| --- | --- |\n| Verdict | pass |\n\n## Verdict\n\n| Topic | Verdict | Route |\n| --- | --- | --- |\n| presentation | pass | none |\n`);
  f.response.fields = { report: reportRef, captures: ['response/artifacts/selected.png'] };
  f.response.outcome = {
    summary: 'The delivery gates passed.',
    primary: { kind: 'table', label: 'Quality results', ref: reportRef },
    secondary: [{ kind: 'image', label: 'Relevant content image', ref: 'response/artifacts/selected.png' }]
  };
  await writeFile(path.join(f.branch, 'response', 'response.json'), `${JSON.stringify(f.response, null, 2)}\n`);
  await sealFixture(f);
  const rendered = await renderOutcome(sourceRoot, f.branch, { validateStepFn: async () => ({ errors: [] }) });
  assert.match(rendered, /### Results/);
  assert.match(rendered, /### Gate verdict/);
  assert.doesNotMatch(rendered, /### Binding/);
  assert.match(rendered, /!\[Relevant content image\]\(<.*response\/artifacts\/selected\.png>\)/);
});

test('renderer shows the article with its declared image and selects change sections from Markdown code evidence', async (t) => {
  const f = await fixture(); t.after(() => rm(f.base, { recursive: true, force: true }));
  const articleRef = 'response/article.md';
  await writeFile(path.join(f.branch, articleRef), '# Checkout guide\n\nUse the review screen to verify the final total before payment.\n');
  f.response.fields = { article: articleRef, image: ['response/artifacts/selected.png'] };
  f.response.outcome = {
    summary: 'The finished article is ready.',
    primary: { kind: 'document', label: 'Checkout guide', ref: articleRef },
    secondary: [{ kind: 'image', label: 'Review screen', ref: 'response/artifacts/selected.png' }]
  };
  await writeFile(path.join(f.branch, 'response', 'response.json'), `${JSON.stringify(f.response, null, 2)}\n`);
  await sealFixture(f);
  const article = await renderOutcome(sourceRoot, f.branch, { validateStepFn: async () => ({ errors: [] }) });
  assert.match(article, /Use the review screen to verify the final total/);
  assert.match(article, /!\[Review screen\]\(<.*selected\.png>\)/);

  const changesRef = 'response/changes.md';
  await writeFile(path.join(f.branch, changesRef), '# changes\n\n## Binding\n\nCommit: 1111111\n\n## Changed files\n\n| File | Result |\n| --- | --- |\n| src/checkout.ts | payment result added |\n\n## Proof\n\nThe focused test passed.\n');
  f.response.fields = { changes: changesRef };
  f.response.outcome = { summary: 'The source change is ready.', primary: { kind: 'code', label: 'Backend changes', ref: changesRef } };
  await writeFile(path.join(f.branch, 'response', 'response.json'), `${JSON.stringify(f.response, null, 2)}\n`);
  await sealFixture(f);
  const changes = await renderOutcome(sourceRoot, f.branch, { validateStepFn: async () => ({ errors: [] }) });
  assert.match(changes, /## Changed files/);
  assert.match(changes, /src\/checkout\.ts/);
  assert.doesNotMatch(changes, /## Binding/);
});

test('renderer preserves a Markdown Mermaid diagram as an actual diagram block', async (t) => {
  const f = await fixture(); t.after(() => rm(f.base, { recursive: true, force: true }));
  const diagramRef = 'response/architecture.md';
  await writeFile(path.join(f.branch, diagramRef), '# Decision\n\n## Boundary diagram\n\n```mermaid\nflowchart LR\n  Web --> API\n```\n');
  f.response.fields = { architecture: diagramRef };
  f.response.outcome = { summary: 'The accepted boundary is ready.', primary: { kind: 'diagram', label: 'Architecture boundary', ref: diagramRef } };
  await writeFile(path.join(f.branch, 'response', 'response.json'), `${JSON.stringify(f.response, null, 2)}\n`);
  await sealFixture(f);
  const rendered = await renderOutcome(sourceRoot, f.branch, { validateStepFn: async () => ({ errors: [] }) });
  assert.match(rendered, /```mermaid\nflowchart LR\n  Web --> API\n```/);
  assert.doesNotMatch(rendered, /```text/);
});

test('renderer refuses unaccepted and post-accept modified evidence', async (t) => {
  const f = await fixture(); t.after(() => rm(f.base, { recursive: true, force: true }));
  await writeFile(path.join(f.session, 'state.json'), JSON.stringify({ contractVersion: contract, attempts: {} }));
  await assert.rejects(() => renderOutcome(sourceRoot, f.branch, { validateStepFn: async () => ({ errors: [] }) }), /OUTCOME_UNACCEPTED/);
  const manifest = await buildEvidenceManifest(f.branch);
  await writeFile(path.join(f.session, 'state.json'), JSON.stringify({ contractVersion: contract, attempts: { '1/1': { id: 'attempt-1', status: 'matched', responseRef: 'step-1/parallel-1/response/response.json', evidenceManifest: manifest } } }));
  await writeFile(path.join(f.branch, 'response', 'artifacts', 'selected.png'), Buffer.concat([png, Buffer.from('tamper')]));
  await assert.rejects(() => renderOutcome(sourceRoot, f.branch, { validateStepFn: async () => ({ errors: [] }) }), /inventory changed after acceptance/);
});
