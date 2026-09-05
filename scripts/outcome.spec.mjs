import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildEvidenceManifest } from './evidence-manifest.mjs';
import { validateAgainst } from './json-schema.mjs';
import { outcomeErrors } from './validate-response.mjs';
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

test('renderer requires a matched accepted seal and emits the native image as an absolute embed', async (t) => {
  const f = await fixture(); t.after(() => rm(f.base, { recursive: true, force: true }));
  const manifest = await buildEvidenceManifest(f.branch);
  await writeFile(path.join(f.session, 'state.json'), `${JSON.stringify({
    contractVersion: contract,
    attempts: { '1/1': { id: 'attempt-1', status: 'matched', responseRef: 'step-1/parallel-1/response/response.json', evidenceManifest: manifest } }
  }, null, 2)}\n`);
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

test('renderer refuses unaccepted and post-accept modified evidence', async (t) => {
  const f = await fixture(); t.after(() => rm(f.base, { recursive: true, force: true }));
  await writeFile(path.join(f.session, 'state.json'), JSON.stringify({ contractVersion: contract, attempts: {} }));
  await assert.rejects(() => renderOutcome(sourceRoot, f.branch, { validateStepFn: async () => ({ errors: [] }) }), /OUTCOME_UNACCEPTED/);
  const manifest = await buildEvidenceManifest(f.branch);
  await writeFile(path.join(f.session, 'state.json'), JSON.stringify({ contractVersion: contract, attempts: { '1/1': { id: 'attempt-1', status: 'matched', responseRef: 'step-1/parallel-1/response/response.json', evidenceManifest: manifest } } }));
  await writeFile(path.join(f.branch, 'response', 'artifacts', 'selected.png'), Buffer.concat([png, Buffer.from('tamper')]));
  await assert.rejects(() => renderOutcome(sourceRoot, f.branch, { validateStepFn: async () => ({ errors: [] }) }), /inventory changed after acceptance/);
});
