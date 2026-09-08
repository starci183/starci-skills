import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { knowledgeRepairEvidenceErrors, knowledgeRepairManifestErrors } from './validate.mjs';
import { buildKnowledgeManifest } from '../../scripts/knowledge-manifest.mjs';

const fp = (c) => `sha256:${c.repeat(64)}`;
const question = { schemaVersion: 10, family: 'starci', sourceOperator: 'interface.audit', surfaceRef: 'response/artifacts/reader.png', rule: 'TASTE-2', case: 'Case 1', impact: 'intentional reading rest was measured as meaningless void', evidence: ['step-3/parallel-1/response/artifacts/reader.png'], applicabilityValidated: true };
const receipt = { schemaVersion: 10, questionFingerprint: fp('a'), manifestBefore: fp('b'), manifestAfter: fp('c'), decision: 'repair-existing-rule', rule: 'TASTE-2', case: 'Case 1', files: [{ path: 'knowledge/ui/proof/taste.md', before: fp('d'), after: fp('e') }], evidence: question.evidence, retry: { operator: 'interface.audit', surfaceRef: question.surfaceRef, manifestFingerprint: fp('c') } };
assert.deepEqual(knowledgeRepairEvidenceErrors(question, receipt), []);
assert.ok(knowledgeRepairEvidenceErrors({ ...question, applicabilityValidated: false }, receipt).some((error) => error.includes('applicability')));
assert.ok(knowledgeRepairEvidenceErrors(question, { ...receipt, retry: { ...receipt.retry, operator: 'interface.generate' } }).some((error) => error.includes('originating operator')));
assert.ok(knowledgeRepairEvidenceErrors(question, { ...receipt, decision: 'append-new-evidenced-rule', evidence: ['one'] }).some((error) => error.includes('two independent')));
assert.ok(knowledgeRepairEvidenceErrors(question, { ...receipt, manifestAfter: receipt.manifestBefore }).some((error) => error.includes('no manifest progress')));
const before = { files: [{ path: 'knowledge/ui/proof/taste.md', sha256: fp('d'), rules: [{ id: 'TASTE-2' }] }, { path: 'knowledge/ui/proof/taste.vi.md', sha256: fp('f'), rules: [] }] };
const after = { files: [{ path: 'knowledge/ui/proof/taste.md', sha256: fp('e'), rules: [{ id: 'TASTE-2' }] }, { path: 'knowledge/ui/proof/taste.vi.md', sha256: fp('9'), rules: [] }] };
const mirroredReceipt = { ...receipt, files: [{ path: 'knowledge/ui/proof/taste.md', before: fp('d'), after: fp('e') }, { path: 'knowledge/ui/proof/taste.vi.md', before: fp('f'), after: fp('9') }] };
assert.deepEqual(knowledgeRepairManifestErrors(before, after, mirroredReceipt, question), []);
assert.ok(knowledgeRepairManifestErrors(before, after, receipt, question).some((error) => error.includes('exact changed manifest set')));

const root = mkdtempSync(path.join(tmpdir(), 'knowledge-repair-'));
try {
  mkdirSync(path.join(root, 'knowledge/ui/proof'), { recursive: true });
  mkdirSync(path.join(root, 'knowledge/grammars/starci'), { recursive: true });
  for (const [relative, body] of Object.entries({
    'knowledge/ui/INDEX.md': '# UI', 'knowledge/ui/INDEX.vi.md': '# UI VI',
    'knowledge/grammars/INDEX.md': '# Grammars', 'knowledge/grammars/INDEX.vi.md': '# Grammars VI',
    'knowledge/grammars/starci/family.md': '# Family', 'knowledge/grammars/starci/family.vi.md': '# Family VI',
    'knowledge/grammars/starci/DNA.md': '# Generated DNA', 'knowledge/grammars/starci/DNA.vi.md': '# Generated DNA VI',
    'knowledge/ui/proof/taste.md': '# Taste\n\n## TASTE-2 — Reading rest\n', 'knowledge/ui/proof/taste.vi.md': '# Taste VI\n',
  })) writeFileSync(path.join(root, ...relative.split('/')), body);
  const bindings = ['@knowledge/ui/proof', '@knowledge/grammars/<family>'];
  const actualBefore = buildKnowledgeManifest(root, bindings, { family: 'starci' });
  writeFileSync(path.join(root, 'knowledge/ui/proof/taste.md'), '# Taste\n\n## TASTE-2 — Intentional reading rest\n');
  writeFileSync(path.join(root, 'knowledge/ui/proof/taste.vi.md'), '# Taste VI — khoảng nghỉ có chủ đích\n');
  const actualAfter = buildKnowledgeManifest(root, bindings, { family: 'starci' });
  const beforeFiles = new Map(actualBefore.files.map((file) => [file.path, file]));
  const actualFiles = actualAfter.files.filter((file) => beforeFiles.get(file.path)?.sha256 !== file.sha256).map((file) => ({ path: file.path, before: beforeFiles.get(file.path)?.sha256 ?? null, after: file.sha256 }));
  const actualReceipt = { ...receipt, files: actualFiles };
  assert.deepEqual(knowledgeRepairManifestErrors(actualBefore, actualAfter, actualReceipt, question), []);
  const dna = actualAfter.files.find((file) => file.path.endsWith('/DNA.md'));
  assert.ok(knowledgeRepairManifestErrors(actualBefore, actualAfter, { ...actualReceipt, files: [...actualFiles, { path: dna.path, before: dna.sha256, after: fp('8') }] }, question).some((error) => error.includes('generated DNA')));
} finally { rmSync(root, { recursive: true, force: true }); }
process.stdout.write('knowledge.repair self-test: bounded owner repair evidence and retry laws passed\n');
