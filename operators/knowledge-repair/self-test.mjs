import assert from 'node:assert/strict';
import { knowledgeRepairEvidenceErrors } from './validate.mjs';

const fp = (c) => `sha256:${c.repeat(64)}`;
const question = { schemaVersion: 10, family: 'starci', sourceOperator: 'interface.audit', surfaceRef: 'response/artifacts/reader.png', rule: 'TASTE-2', case: 'Case 1', impact: 'intentional reading rest was measured as meaningless void', evidence: ['step-3/parallel-1/response/artifacts/reader.png'], applicabilityValidated: true };
const receipt = { schemaVersion: 10, questionFingerprint: fp('a'), manifestBefore: fp('b'), manifestAfter: fp('c'), decision: 'repair-existing-rule', rule: 'TASTE-2', case: 'Case 1', files: [{ path: 'knowledge/ui/proof/taste.md', before: fp('d'), after: fp('e') }], evidence: question.evidence, retry: { operator: 'interface.audit', surfaceRef: question.surfaceRef, manifestFingerprint: fp('c') } };
assert.deepEqual(knowledgeRepairEvidenceErrors(question, receipt), []);
assert.ok(knowledgeRepairEvidenceErrors({ ...question, applicabilityValidated: false }, receipt).some((error) => error.includes('applicability')));
assert.ok(knowledgeRepairEvidenceErrors(question, { ...receipt, retry: { ...receipt.retry, operator: 'interface.generate' } }).some((error) => error.includes('originating operator')));
assert.ok(knowledgeRepairEvidenceErrors(question, { ...receipt, decision: 'append-new-evidenced-rule', evidence: ['one'] }).some((error) => error.includes('two independent')));
assert.ok(knowledgeRepairEvidenceErrors(question, { ...receipt, manifestAfter: receipt.manifestBefore }).some((error) => error.includes('no manifest progress')));
process.stdout.write('knowledge.repair self-test: bounded owner repair evidence and retry laws passed\n');
