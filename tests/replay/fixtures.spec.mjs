// The replay fixtures are reduced, neutral and few KB: nothing path-like, token-like, product-named or large is in the repository, the scan that says so catches each
// kind, and the extractor that writes them turns a ledger full of product content into a fixture with none of it, the same bytes every time.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { openLedger } from '../../engine/db/ledger.mjs';
import { seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { FIXTURES } from '../helpers/replay-world.mjs';
import { FIXTURE_MAX_BYTES, scanFixture, scanFixtureDir } from '../helpers/replay-hygiene.mjs';
import { Pseudonyms, isVocabulary } from '../helpers/replay-neutral.mjs';
import { CASES, extractCase, writeFixture } from '../helpers/replay-extract.mjs';

// A drive letter for planted paths, spelled so that this spec holds no drive-letter literal itself.
const drive = String.fromCharCode(67);
// Generate a provider-shaped stand-in per run; letters keep the prefix branch distinct from the long digit-bearing token rule.
const generatedGithubToken = () => ['ghp', Array.from(randomBytes(36), (byte) => String.fromCharCode(97 + byte % 26)).join('')].join('_');

test('every fixture of tests/fixtures/replay passes the hygiene scan, is a few KB and names its case', () => {
  const scanned = scanFixtureDir(FIXTURES);
  assert.deepEqual(scanned.map((entry) => entry.file), CASES.map((name) => `${name}.json`).sort(), 'one fixture per extractable case');
  for (const { file, findings } of scanned) {
    assert.deepEqual(findings, [], `${file} holds nothing path-like, token-like, product-named or large`);
    const size = fs.statSync(path.join(FIXTURES, file)).size;
    assert.ok(size < FIXTURE_MAX_BYTES, `${file} is ${size} bytes`);
    const document = JSON.parse(fs.readFileSync(path.join(FIXTURES, file), 'utf8'));
    assert.equal(document.case, file.replace(/\.json$/, ''));
    assert.equal(document.schema, 'replay-fixture@1');
  }
});

test('the scan catches a path, a drive letter, a token, a URL, a product name, an email and a fixture over its size', () => {
  const rules = (document) => scanFixture(document).map((finding) => finding.rule);
  assert.deepEqual(rules({ a: 'src/features/x' }), ['path-like']);
  assert.deepEqual(rules({ a: `${drive}:\\work\\x` }), ['path-like']);
  assert.ok(rules({ a: generatedGithubToken() }).includes('token-like'));
  assert.ok(rules({ a: `${'a1'.repeat(20)}` }).includes('token-like'));
  assert.ok(rules({ a: 'https://example.test' }).includes('url-like'));
  assert.ok(rules({ a: 'someone@example.test' }).includes('url-like'));
  assert.deepEqual(rules({ a: 'the Nivo leg' }), ['product-named']);
  assert.ok(rules({ 'starci-key': 1 }).includes('product-named'), 'a key is scanned like a value');
  assert.ok(rules({ text: 'x'.repeat(FIXTURE_MAX_BYTES) }).includes('too-large'));
  assert.deepEqual(scanFixture({ code: 'workflow-checkpoint-recovery-conflict', op: 'architecture.decide', node: 'd-1.s-1-password' }), [], 'runtime vocabulary and the redaction word pass');
});

test('placeholders are numbered by first appearance, keep only the words the redaction filter reacts to, and a code is a vocabulary word', () => {
  const ids = new Pseudonyms();
  assert.deepEqual([ids.id('job', 'op-secret-name-1'), ids.id('job', 'other'), ids.id('job', 'op-secret-name-1')], ['job-1', 'job-2', 'job-1']);
  assert.equal(ids.node('billing.reset-password'), 'd-1.s-1-password');
  assert.equal(ids.node('billing.invoices'), 'd-1.s-2');
  assert.equal(ids.node('shop.reset-password'), 'd-2.s-1-password');
  assert.ok(isVocabulary('op-critic-verdict-missing') && isVocabulary('architecture.decide'));
  assert.ok(!isVocabulary('a path/like') && !isVocabulary('Sentence with spaces.') && !isVocabulary(`${drive}:\\x`) && !isVocabulary(null));
});

/** A copy directory holding a Nivo-shaped ledger whose rows are full of product content: names, paths, a token and prose. */
function copyWithProductContent(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-extract-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const copy = path.join(dir, 'ledger-copy-case1');
  fs.mkdirSync(path.join(copy, 'nivo'), { recursive: true });
  const ledger = openLedger({ file: path.join(copy, 'nivo', 'runtime.sqlite') });
  try {
    const payload = { opId: 'architecture.decide', owned_paths: [`${drive}:\\Users\\someone\\nivo-monorepo\\.starciwork\\features\\billing\\sds`], title: `Nivo billing ${generatedGithubToken()}` };
    seedWorkflow(ledger, { id: 'wf-nivo-billing-muxq1xov', goal: { revision: 0, markdown: '# Nivo billing' }, jobs: [{ jobId: 'op-architecture.decide-e78adc94cc', opId: 'architecture.decide', status: 'reported', pool: 'claude-agent', payload }] });
    ledger.db.prepare("UPDATE op_attempts SET provider='claude' WHERE job_id='op-architecture.decide-e78adc94cc'").run();
    ledger.transaction(() => ledger.appendEvent({ workflowId: 'wf-nivo-billing-muxq1xov', entityType: 'job', entityId: 'op-architecture.decide-e78adc94cc', kind: 'job-settle-needs-kernel',
      payload: { reason: 'settle-refused', code: 'op-critic-verdict-missing', detail: [`${drive}:\\orca\\nivo-monorepo\\notes.md says the Nivo owner wants billing`, 'op-critic-verdict-missing'], outcome: 'done', op: 'architecture.decide', attempt: 1, runtimeRev: 'a'.repeat(40), ageMs: 5 } }));
  } finally { ledger.close(); }
  return copy;
}

test('the extractor turns a ledger full of product content into a neutral fixture, the same bytes every time, and refuses to write one that is not neutral', (t) => {
  const copy = copyWithProductContent(t);
  const first = JSON.stringify(extractCase('handed-over', copy));
  assert.equal(first, JSON.stringify(extractCase('handed-over', copy)), 'deterministic');
  for (const planted of ['nivo', 'Nivo', 'billing', 'someone', 'ghp_', `${drive}:`, 'orca', 'muxq1xov', 'e78adc94cc', '\\']) assert.ok(!first.includes(planted), `the fixture holds no ${planted}`);
  const document = JSON.parse(first);
  assert.deepEqual(scanFixture(document), []);
  assert.deepEqual([document.jobs[0].id, document.jobs[0].op, document.jobs[0].provider, document.workflow.id], ['job-1', 'architecture.decide', 'claude', 'wf-1']);
  assert.deepEqual(document.events[0].payload.detail, ['op-critic-verdict-missing'], 'only the vocabulary word of the detail survives');
  assert.equal(document.events[0].payload.runtimeRev, '$rev:1', 'the revision is a token the world resolves');
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-extract-out-'));
  t.after(() => fs.rmSync(out, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const written = writeFixture('handed-over', copy, out);
  assert.ok(written.bytes < FIXTURE_MAX_BYTES);
  assert.equal(fs.readFileSync(path.join(out, 'handed-over.json'), 'utf8'), `${JSON.stringify(document, null, 1)}\n`);
  assert.throws(() => extractCase('no-such-case', copy), /unknown case/);
});

test('the first-leg recipe extracts the approved plan before any op job and refuses an already enqueued workflow', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-first-leg-extract-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const copy = path.join(dir, 'ledger-copy-first-leg');
  const file = path.join(copy, 'starci', 'runtime.sqlite');
  const plan = { legs: [{ op: 'request.analyze' }, { op: 'scope.define' }, { op: 'business.decide' }], edges: [['request.analyze', 'scope.define'], ['scope.define', 'business.decide']] };
  const ledger = openLedger({ file });
  try {
    seedWorkflow(ledger, { id: 'source-workflow', goal: { revision: 0, derivedPlan: plan }, jobs: [] });
    const document = extractCase('first-leg', copy);
    assert.deepEqual(document.plan, plan);
    assert.deepEqual(document.workflow, { id: 'wf-1', phase: 'running', goalRevision: 0 });
    assert.deepEqual(document.jobs, []);
    assert.deepEqual(document.source, { copy: 'first-leg' });
    assert.deepEqual(scanFixture(document), []);
    const out = path.join(dir, 'generated');
    writeFixture('first-leg', copy, out);
    assert.equal(fs.readFileSync(path.join(out, 'first-leg.json'), 'utf8'), fs.readFileSync(path.join(FIXTURES, 'first-leg.json'), 'utf8'), 'the checked-in fixture is emitted by its recipe');
    ledger.write.createUnit({ workflowId: 'source-workflow', unitId: 'u1', opId: 'scope.define', subjectKey: 'u1', goalRevision: 0 });
    ledger.enqueueJob({ jobId: 'j1', workflowId: 'source-workflow', unitId: 'u1', opId: 'scope.define', tryNo: 1, kind: 'op', payload: {} });
    assert.throws(() => extractCase('first-leg', copy), /no op jobs/);
  } finally {
    ledger.close();
  }
});
