import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeOpShared, opSharedOf, resolveOpContract, opCheckRequirements } from '../../scripts/lib/op-shared.mjs';
import { opInputPaths, recordInputs, ABSENT } from '../../scripts/kernel/input-digests.mjs';
import { captureDispatchInputs, selectDispatchContract } from '../../scripts/kernel/dispatch-admission.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const brief = () => ({ id: 'sample.op', params: { mode: { default: 'select' } },
  reads: [{ id: 'common', path: 'knowledge/common.yaml' }, { id: 'target', path: 'knowledge/old.yaml' }],
  writes: [{ id: 'evidence', path: 'evidence/**' }], proofs: [{ id: 'common', check: 'scripts/checks/check-op-manifest.mjs' }],
  blockers: [{ code: 'COMMON' }], layoutPolicy: { checks: ['scripts/work/validate.mjs'] },
  policy: { executionModes: {
    read: { goal: { en: 'Read one selected scope.' }, sideEffects: ['none'], completionProfile: 'business',
      steps: [{ action: { en: 'Read it.' } }], reads: [{ id: 'target', path: 'knowledge/selected.yaml' }],
      writes: [], proofs: [{ id: 'selected' }], blockers: [], migrationPolicy: { retained: true } },
    deploy: { goal: { en: 'Deploy.' }, sideEffects: ['provider effect'], reads: [{ id: 'sibling', path: 'knowledge/sibling.yaml' }], writes: [{ id: 'deployment', path: 'deploy/**' }] },
  } },
});

test('execution refuses selector/unknown mode while planning retains a read-only envelope', () => {
  const doc = brief();
  assert.equal(resolveOpContract(doc).ok, false);
  assert.equal(resolveOpContract(doc, { mode: 'typo' }).ok, false);
  assert.equal(resolveOpContract(doc, { allowSelect: true }).planning, true);
});

test('selection retains common obligations and excludes every sibling permission/input', () => {
  const doc = brief(), before = structuredClone(doc);
  const selected = resolveOpContract(doc, { params: { mode: 'read' } });
  assert.equal(selected.ok, true);
  assert.equal(selected.contract.completionProfile, 'business');
  assert.deepEqual(selected.contract.sideEffects, ['none']);
  assert.deepEqual(selected.contract.reads.map((row) => row.id), ['common', 'target']);
  assert.equal(selected.contract.reads[1].path, 'knowledge/selected.yaml');
  assert.deepEqual(selected.contract.writes.map((row) => row.id), ['evidence']);
  assert.deepEqual(selected.contract.proofs.map((row) => row.id), ['common', 'selected']);
  assert.equal(selected.contract.policy.executionModes, undefined);
  assert.deepEqual(selected.contract.policy.migrationPolicy, { retained: true });
  assert.deepEqual(opInputPaths(doc, { mode: 'read' }), ['knowledge/common.yaml', 'knowledge/selected.yaml']);
  assert.deepEqual(doc, before);
});

test('nested shared READ markers expand through the same common owner before selection', () => {
  const doc = brief(); doc.policy.executionModes.read.reads = [{ id: 'target', path: 'shared' }];
  const merged = mergeOpShared(doc, { reads: [{ id: 'target', path: 'knowledge/actual.yaml' }] });
  assert.equal(resolveOpContract(merged, { mode: 'read' }).contract.reads[1].path, 'knowledge/actual.yaml');
  assert.throws(() => mergeOpShared(doc, {}), /shared fragment missing/);
  assert.throws(() => mergeOpShared(doc, { reads: [{ id: 'target', path: 'knowledge/a.yaml' }, { id: 'target', path: 'knowledge/b.yaml' }] }), /duplicate shared fragment/);
});

test('required named checks and proof owners remain separate from route candidates', () => {
  const contract = resolveOpContract(brief(), { mode: 'read' }).contract;
  const checks = opCheckRequirements(contract, { checks: ['scripts/gates/acceptance.mjs'] });
  assert.deepEqual(checks.required.map((row) => row.source), ['layoutPolicy', 'proof']);
  assert.deepEqual(checks.required.map((row) => row.obligation), ['check-owner', 'proof-owner']);
  assert.equal(opCheckRequirements({ layoutPolicy: { checks: ['starci-validate'] } }).required[0].obligation, 'check-id');
  assert.deepEqual(checks.candidates, [{ path: 'scripts/gates/acceptance.mjs', source: 'kind' }]);
  assert.ok(!checks.required.some((row) => row.path === 'scripts/gates/acceptance.mjs'));
});

test('missing READs and failed input measurement cannot create a usable packet', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-selected-admission-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const file of ['CONTEXT.md', 'modules/ops/ops/sample.op.yaml', 'modules/ops/_common.yaml', 'modules/kernel/verdict-contract.yaml', 'modules/kernel/dispatch.yaml']) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), file.endsWith('_common.yaml') ? 'shared: {}' : file);
  }
  const packet = { context: { records: [], owned_paths: [] } };
  const input = { skillRoot: root, op: 'sample.op', packet, briefDoc: { reads: [{ id: 'law', path: 'knowledge/missing.yaml' }] }, params: {}, repo: root, stateDir: path.join(root, '.starciwork'), workerCwd: root };
  let measured = 0;
  assert.throws(() => captureDispatchInputs({ ...input, inputRecorder: () => { measured += 1; } }), (error) => error.code === 'op-context-refused');
  assert.equal(measured, 0); assert.equal(packet.context.readRefs, undefined);
  input.briefDoc = { reads: [] };
  assert.throws(() => captureDispatchInputs({ ...input, inputRecorder: () => { throw Object.assign(new Error('private failure'), { code: 'EACCES' }); } }), (error) => error.code === 'op-context-refused' && !error.message.includes('private failure'));
  assert.equal(packet.context.readRefs, undefined);
  assert.throws(() => captureDispatchInputs({ ...input, inputRecorder: () => null }), (error) => error.code === 'op-context-refused');
  assert.throws(() => captureDispatchInputs({ ...input, inputRecorder: () => ({ schema: 'starci/input-digests@1', digests: [{ kind: 'source', path: 'knowledge/absent.yaml', digest: ABSENT }] }) }), (error) => error.code === 'op-context-refused');
  const captured = captureDispatchInputs({ ...input, inputRecorder: (_root, _paths, _digest, options) => { assert.equal(options.workDir, '.starciwork'); return { schema: 'starci/input-digests@1', digests: [] }; } });
  assert.equal(captured.inputs.schema, 'starci/input-digests@1'); assert.equal(packet.context.readRefs.length, 5);
});

test('strict admission measurement distinguishes unreadable bytes from legitimate absence', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-input-read-fault-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, 'knowledge', 'present.yaml');
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, 'observed: true');
  const read = fs.readFileSync;
  try {
    fs.readFileSync = (target, ...args) => { if (path.resolve(target) === file) throw Object.assign(new Error('fixture-only unreadable bytes'), { code: 'EACCES' }); return read(target, ...args); };
    assert.throws(() => recordInputs(root, ['knowledge/present.yaml'], undefined, { strict: true }), (error) => error.code === 'EACCES');
    assert.equal(recordInputs(root, ['knowledge/present.yaml']).digests[0].digest, ABSENT, 'a non-strict reader reads an unreadable file as absent');
    assert.equal(recordInputs(root, ['knowledge/never-created.yaml'], undefined, { strict: true }).digests[0].digest, ABSENT);
  } finally { fs.readFileSync = read; }
});

test('shared edits are observed and unresolved placeholder maps refuse', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-shared-fresh-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, '_common.yaml');
  fs.writeFileSync(file, 'shared: {placeholders: {app: first}}');
  assert.equal(opSharedOf(root).placeholders.app, 'first');
  fs.writeFileSync(file, 'shared: {placeholders: {app: other}}');
  assert.equal(opSharedOf(root).placeholders.app, 'other');
  fs.unlinkSync(file); assert.deepEqual(opSharedOf(root), {});
  assert.throws(() => mergeOpShared({ placeholders: { app: 'shared' } }, {}), /placeholders.app/);
});

test('missing selected proof/check owner refuses before returning admission', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-check-owner-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (file, value) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), value); };
  write('modules/ops/ops/sample.op.yaml', JSON.stringify({ id: 'sample.op', reads: [], proofs: [{ id: 'proof', check: 'scripts/checks/owner.mjs' }], layoutPolicy: { checks: ['starci-validate'] } }));
  write('modules/schemas/op.schema.yaml', '{}'); write('modules/models/kinds.yaml', 'kinds: {}');
  assert.throws(() => selectDispatchContract(root, 'sample.op', {}), (error) => error.code === 'op-context-refused');
  write('scripts/checks/owner.mjs', 'export const proofOwner = true;');
  const admitted = selectDispatchContract(root, 'sample.op', {});
  assert.equal(admitted.selected.checks.required[1].obligation, 'proof-owner');
  write('modules/ops/ops/sample.op.yaml', JSON.stringify({ id: 'sample.op', layoutPolicy: { checks: ['scripts/checks/missing.mjs'] } }));
  assert.throws(() => selectDispatchContract(root, 'sample.op', {}), (error) => error.code === 'op-context-refused');
});
