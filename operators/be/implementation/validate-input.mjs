import path from 'node:path';
import { validatorFor, runValidatorCli } from '../../validation.mjs';

const requiredFacts = {
  'architecture.boundary.review\u0000approved': ['backend-boundary-approved', 'backend-coding-scope-frozen'],
  'be.repair\u0000ready': ['backend-boundary-approved', 'backend-coding-scope-frozen', 'in-boundary-repair']
};

const profileByMode = {
  economical: 'orchestration/modes/economical.json',
  balanced: 'orchestration/modes/balanced.json',
  parallel: 'orchestration/modes/parallel.json'
};

function semanticErrors(value) {
  const errors = [];
  const guard = requiredFacts[`${value.stage}\u0000${value.status}`] ?? [];
  for (const fact of guard) if (!value.facts.includes(fact)) errors.push(`$.facts: missing ${fact}`);

  const { provided, loads, session } = value.payload;
  if (provided.approvalReceiptRef !== loads.approval.ref) errors.push('$.payload.loads.approval.ref: must equal provided.approvalReceiptRef');
  if (provided.businessHeadRef !== loads.business.ref) errors.push('$.payload.loads.business.ref: must equal provided.businessHeadRef');
  if (provided.approvedBoundaryRef !== loads.boundary.ref) errors.push('$.payload.loads.boundary.ref: must equal provided.approvedBoundaryRef');
  if (provided.codingScopeRef !== loads.scope.ref) errors.push('$.payload.loads.scope.ref: must equal provided.codingScopeRef');
  if (provided.baselineCommitRef !== loads.scope.sourceCommitRef || loads.scope.sourceCommitRef !== loads.source.sourceCommitRef) errors.push('$.payload.loads.source.sourceCommitRef: frozen baseline mismatch');
  if (loads.scope.targetSetSha256 !== loads.source.targetSetSha256) errors.push('$.payload.loads.source.targetSetSha256: frozen target set mismatch');
  if (loads.orchestration.profileRef !== profileByMode[loads.orchestration.mode]) {
    errors.push('$.payload.loads.orchestration.profileRef: does not match mode');
  }

  const sessionPrefix = `session://tasks/${session.taskId}/`;
  const sessionRefs = [
    provided.approvedBoundaryRef,
    provided.approvalReceiptRef,
    provided.businessHeadRef,
    provided.codingScopeRef,
    loads.approval.ref,
    loads.business.ref,
    loads.boundary.ref,
    loads.scope.ref,
    session.inputRef,
    session.outputRef,
    session.scratchPrefix
  ];
  for (const ref of sessionRefs) if (!ref.startsWith(sessionPrefix)) errors.push(`$: session ref is outside task ${session.taskId}: ${ref}`);

  const paths = loads.source.targetFiles.map((target) => target.path.replaceAll('\\', '/'));
  if (new Set(paths).size !== paths.length) errors.push('$.payload.loads.source.targetFiles: duplicate path');
  for (const [index, target] of paths.entries()) {
    if (path.isAbsolute(target) || target === '..' || target.startsWith('../') || target.includes('/../')) {
      errors.push(`$.payload.loads.source.targetFiles[${index}].path: must be a repository-relative path without traversal`);
    }
  }
  return errors;
}

export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), semanticErrors);

if (process.argv[1]?.endsWith('validate-input.mjs')) {
  await runValidatorCli(validateInput, 'node validate-input.mjs <artifact.json>');
}
