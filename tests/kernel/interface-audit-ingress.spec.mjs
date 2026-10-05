import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { fileReport } from '../../engine/db/ledger.mjs';
import { readOpManifest, paramDefinitionError, paramValueError } from '../../scripts/lib/op-shared.mjs';
import { validateAgainstSchema } from '../../scripts/lib/json-schema.mjs';
import { resolveOpParams } from '../../scripts/kernel/dispatch-op.mjs';
import { selectDispatchContract } from '../../scripts/kernel/dispatch-admission.mjs';
import { stageReportEvidence, fileReportEvidence } from '../../scripts/kernel/verbs/shared/report-evidence.mjs';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const brief = () => readOpManifest(path.join(ROOT, 'modules/ops/ops/interface.audit.yaml'));
const scope = () => ({ id: 'operation.checkout.purchase', feature: 'checkout', selectedMatrix: { cells: [
  { id: 'checkout-ready', surface: 'checkout', route: '/checkout', state: 'ready', viewport: 'desktop', theme: 'light', assertionIds: ['ui.checkout.total'] },
] }, dependencies: ['ui.checkout.purchase'] });

test('the real enqueue resolver requires a typed Kernel-owned scope before a first audit', () => {
  const op = brief(), selected = scope();
  assert.equal(resolveOpParams(op, { enforceRequired: true }).reason, 'params-invalid');
  assert.equal(resolveOpParams(op, { leg: { audit: selected }, enforceRequired: true }).reason, 'params-invalid', 'a goal leg cannot set the Kernel param');
  const resolved = resolveOpParams(op, { flag: { audit: selected }, enforceRequired: true });
  assert.equal(resolved.ok, true);
  assert.deepEqual(resolved.params.audit, selected);
  assert.equal(resolved.params.maxRounds, op.params.maxRounds.default);
  for (const mutation of [
    (value) => { value.selectedMatrix.cells = []; },
    (value) => { delete value.selectedMatrix.cells[0].viewport; },
    (value) => { value.selectedMatrix.cells[0].theme = '   '; },
    (value) => { value.selectedMatrix.cells[0].assertionIds = []; },
    (value) => { value.unknownScope = true; },
    (value) => { value.selectedMatrix.cells[0].route = 123; },
  ]) {
    const invalid = scope(); mutation(invalid);
    assert.equal(resolveOpParams(op, { flag: { audit: invalid }, enforceRequired: true }).reason, 'params-invalid');
  }
});

test('object definitions/defaults and unsupported nested shape dialects fail at their real owners', () => {
  const op = brief(), schema = parseYaml(fs.readFileSync(path.join(ROOT, 'modules/schemas/op.schema.yaml'), 'utf8'));
  assert.equal(paramDefinitionError('audit', op.params.audit), null);
  assert.ok(paramDefinitionError('audit', { type: 'object' }));
  assert.ok(paramValueError('audit', op.params.audit, []));
  const unsupported = structuredClone(op);
  unsupported.params.audit.valueSchema.properties.selectedMatrix.oneOf = [{}];
  assert.ok(validateAgainstSchema(unsupported, schema).some((error) => error.includes('oneOf')));
  const external = structuredClone(op);
  external.params.audit.valueSchema.properties.selectedMatrix.$ref = 'external-audit-schema.json';
  assert.ok(validateAgainstSchema(external, schema).some((error) => error.includes('$ref')));
  const defaults = structuredClone(op);
  delete defaults.params.audit.required; defaults.params.audit.default = { id: 'operation.checkout.purchase' };
  assert.equal(resolveOpParams(defaults, { enforceRequired: true }).reason, 'params-invalid');
});

test('native admission refuses a lost required scope even if enqueue had once supplied it', () => {
  assert.throws(() => selectDispatchContract(ROOT, 'interface.audit', {}), (error) => error.code === 'params-invalid');
  assert.doesNotThrow(() => selectDispatchContract(ROOT, 'interface.audit', {}, { planning: true }), 'planning does not impersonate an executable audit');
  const selected = scope(), admitted = selectDispatchContract(ROOT, 'interface.audit', { params: { audit: selected } });
  assert.deepEqual(admitted.params.audit, selected);
  assert.deepEqual(admitted.selected.contract.params.audit.valueSchema, brief().params.audit.valueSchema);
  assert.equal(admitted.brief.reads.find((read) => read.id === 'target').path, 'params.audit');
});

function fixture(t, { typed = true, op = 'interface.audit', admitted = scope() } = {}) {
  const world = withLedger(t, (value) => value), { root, ledger } = world;
  const previous = process.env.STARCI_ARTIFACT_ROOT;
  process.env.STARCI_ARTIFACT_ROOT = path.join(root, 'artifacts');
  t.after(() => { if (previous === undefined) delete process.env.STARCI_ARTIFACT_ROOT; else process.env.STARCI_ARTIFACT_ROOT = previous; });
  seedWorkflow(ledger, { id: 'wf-a', jobs: [{ jobId: 'audit-a', opId: op, status: 'running', payload: {} }] });
  const attempt = ledger.db.prepare("SELECT * FROM op_attempts WHERE job_id='audit-a'").get();
  const packet = typed ? { params: { audit: admitted }, context: { selected_op: { mode: null, contract: brief() } } } : { context: {} };
  ledger.db.prepare('INSERT INTO contracts(attempt_id,workflow_id,job_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?)')
    .run(attempt.attempt_id, attempt.workflow_id, attempt.job_id, '# private audit contract', JSON.stringify({ packet }), 1);
  const scratch = path.join(root, 'scratch'); fs.mkdirSync(scratch);
  const counts = () => Object.fromEntries(['reports', 'job_artifacts', 'report_attachments', 'blobs', 'check_runs', 'interface_audits']
    .map((table) => [table, Number(ledger.db.prepare(`SELECT count(*) n FROM ${table}`).get().n)]));
  const file = (doc, { outcome = 'done', attach = true } = {}) => {
    const auditFile = path.join(scratch, 'interface-audit.json');
    if (attach) fs.writeFileSync(auditFile, JSON.stringify(doc));
    const report = { outcome, summary: 'private audit filing', checks: [{ name: 'private-declared-observation', command: 'fixture observation', exitCode: 0 }] };
    const staged = stageReportEvidence({ report, scratch, attach: attach ? [auditFile] : [], opId: op });
    return ledger.transaction((db) => {
      const row = fileReport(db, { attemptId: attempt.attempt_id, outcome, report, createdAt: 2 });
      return fileReportEvidence(db, { attempt, reportId: row.report_id, report, staged, now: 2 });
    });
  };
  return { ...world, attempt, admitted, packet, counts, file };
}

const verdict = (admitted = scope()) => ({ schema: 'starci/interface-audit-operation@1', id: admitted.id,
  feature: admitted.feature, selectedMatrix: structuredClone(admitted.selectedMatrix), verdict: 'pass', findings: [] });

test('a first audit creates its ledger row and retains separate capture annotations without changing scope', (t) => {
  const fx = fixture(t), doc = verdict(fx.admitted);
  doc.selectedMatrix.cells[0].capture = { path: 'captures/current.png', sha256: 'a'.repeat(64) };
  assert.equal(fx.counts().interface_audits, 0, 'no future report row is required as input');
  const filed = fx.file(doc), row = fx.ledger.db.prepare('SELECT * FROM interface_audits').get();
  assert.equal(filed.audit.auditId, fx.admitted.id);
  assert.equal(row.workflow_id, fx.attempt.workflow_id); assert.equal(row.attempt_id, fx.attempt.attempt_id);
  assert.equal(row.feature, fx.admitted.feature); assert.deepEqual(JSON.parse(row.scope_json), fx.admitted.selectedMatrix);
  assert.deepEqual(fx.counts(), { reports: 1, job_artifacts: 1, report_attachments: 1, blobs: 1, check_runs: 1, interface_audits: 1 });
  const blob = fx.ledger.db.prepare('SELECT b.file_uri FROM blobs b JOIN job_artifacts a ON a.sha256=b.sha256').get();
  assert.deepEqual(JSON.parse(fs.readFileSync(blob.file_uri, 'utf8')).selectedMatrix.cells[0].capture, doc.selectedMatrix.cells[0].capture);
});

for (const [name, mutation] of [
  ['foreign audit ID', (doc) => { doc.id = 'operation.checkout.other'; }],
  ['changed theme', (doc) => { doc.selectedMatrix.cells[0].theme = 'dark'; }],
  ['omitted matrix cell', (doc) => { doc.selectedMatrix.cells = []; }],
  ['new scope cell', (doc) => { doc.selectedMatrix.cells.push({ ...doc.selectedMatrix.cells[0], id: 'added-without-admission' }); }],
  ['changed assertions', (doc) => { doc.selectedMatrix.cells[0].assertionIds = ['different.assertion']; }],
  ['contradictory scope alias', (doc) => { doc.scope = { cells: [] }; }],
  ['foreign feature', (doc) => { doc.feature = 'other'; }],
  ['malformed audit suffix', (doc) => { doc.id += '.extra'; }],
]) test(`typed report refuses ${name} and rolls back report/artifact/check writes`, (t) => {
  const fx = fixture(t), doc = verdict(fx.admitted), before = fx.counts(); mutation(doc);
  assert.throws(() => fx.file(doc), (error) => error.reason === 'report-attachment-invalid' || error.code === 'report-attachment-invalid');
  assert.deepEqual(fx.counts(), before);
  assert.equal(fx.ledger.db.prepare('SELECT reported_at FROM op_attempts').get().reported_at, null);
});

test('the immutable admitted matrix remains the authority even if current Source would describe another scope', (t) => {
  const fx = fixture(t), packet = structuredClone(fx.packet);
  packet.params.audit.selectedMatrix.cells[0].viewport = 'admitted-mobile';
  fx.ledger.db.prepare('UPDATE contracts SET context_json=? WHERE attempt_id=?').run(JSON.stringify({ packet }), fx.attempt.attempt_id);
  assert.throws(() => fx.file(verdict()), (error) => error.reason === 'report-attachment-invalid' || error.code === 'report-attachment-invalid');
  const filed = verdict(packet.params.audit);
  assert.equal(fx.file(filed).audit.auditId, filed.id);
});

test('a completed typed audit without its verdict attachment refuses; a blocked audit may report its input gap', (t) => {
  const fx = fixture(t), before = fx.counts();
  assert.throws(() => fx.file(null, { attach: false }), (error) => error.reason === 'report-attachment-invalid' || error.code === 'report-attachment-invalid');
  assert.deepEqual(fx.counts(), before);
  assert.equal(fx.file(null, { attach: false, outcome: 'blocked' }).audit, undefined);
});

test('a report cannot take another workflow audit identity, even when the matrix is equal', (t) => {
  const fx = fixture(t); seedWorkflow(fx.ledger, { id: 'wf-b' });
  fx.ledger.db.prepare('INSERT INTO interface_audits(audit_id,workflow_id,feature,scope_json,verdict,created_at,updated_at) VALUES(?,?,?,?,?,?,?)')
    .run(fx.admitted.id, 'wf-b', fx.admitted.feature, JSON.stringify(fx.admitted.selectedMatrix), 'partial', 1, 1);
  const prior = fx.ledger.db.prepare('SELECT * FROM interface_audits').get(), before = fx.counts();
  assert.throws(() => fx.file(verdict()), (error) => error.reason === 'report-attachment-invalid' || error.code === 'report-attachment-invalid');
  assert.deepEqual(fx.counts(), before); assert.deepEqual(fx.ledger.db.prepare('SELECT * FROM interface_audits').get(), prior);
});

test('a different operation cannot file a typed interface.audit verdict', (t) => {
  const fx = fixture(t, { op: 'business.decide' }), before = fx.counts();
  assert.throws(() => fx.file(verdict()), (error) => error.code === 'report-attachment-invalid');
  assert.deepEqual(fx.counts(), before);
});

test('a filed typed contract with a lost scope refuses instead of becoming a legacy report', (t) => {
  const fx = fixture(t), packet = structuredClone(fx.packet), before = fx.counts(); delete packet.params.audit;
  fx.ledger.db.prepare('UPDATE contracts SET context_json=? WHERE attempt_id=?').run(JSON.stringify({ packet }), fx.attempt.attempt_id);
  assert.throws(() => fx.file(verdict()), (error) => error.code === 'report-attachment-invalid');
  assert.deepEqual(fx.counts(), before);
});

test('a legacy attempt without a filed typed definition keeps its admitted scope storage behavior', (t) => {
  const fx = fixture(t, { typed: false }), doc = { schema: 'starci/interface-audit-operation@1', id: 'operation.checkout.old',
    selectedMatrix: { legacyScope: 'previous contract' }, verdict: 'partial' };
  assert.equal(fx.file(doc).audit.auditId, doc.id);
  assert.deepEqual(JSON.parse(fx.ledger.db.prepare('SELECT scope_json FROM interface_audits').get().scope_json), doc.selectedMatrix);
});
