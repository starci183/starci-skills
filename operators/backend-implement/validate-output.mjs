import { validatorFor, runValidatorCli } from './validation.mjs';

/**
 * A change record is the only durable trace that a file was mutated, so the hash pair has to agree
 * with the kind. A `modified` record whose before and after hashes are equal is the defect this map
 * exists to catch: it describes a mutation that never happened.
 */
const HASH_SHAPE = {
  added: { before: 'null', after: 'set' },
  modified: { before: 'set', after: 'set' },
  deleted: { before: 'set', after: 'null' },
};

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), (value) => {
  const errors = [];
  const { outcome, receipt, artifactRefs } = value.output;
  const { status, implementation, findings, failure, resume } = receipt;

  if (outcome !== status) errors.push('output.outcome must equal receipt.status');

  if (outcome === 'implemented') {
    if (implementation === null) errors.push('an implemented receipt requires an implementation');
    if (failure !== null) errors.push('an implemented receipt cannot carry a failure');
    if (resume !== null) errors.push('an implemented receipt cannot carry a resume');
  } else {
    if (implementation !== null) errors.push('a blocked receipt cannot carry an implementation');
    if (failure === null) errors.push('a blocked receipt requires one typed failure');
    else if (failure.retryable && resume === null) errors.push('a retryable failure requires a resume');
    else if (!failure.retryable && resume !== null) errors.push('a non-retryable failure cannot carry a resume');
  }

  const declaredOperationIds = new Set();

  if (implementation !== null) {
    for (const operation of implementation.operations) {
      if (declaredOperationIds.has(operation.operationId)) {
        errors.push(`operation ${operation.operationId} is declared more than once`);
      }
      declaredOperationIds.add(operation.operationId);
    }

    const applied = new Set(implementation.appliedOperationIds);
    if (applied.size !== implementation.appliedOperationIds.length) {
      errors.push('appliedOperationIds must not repeat an operation identifier');
    }
    for (const operationId of applied) {
      if (!declaredOperationIds.has(operationId)) {
        errors.push(`appliedOperationIds names undeclared operation ${operationId}`);
      }
    }
    for (const operationId of declaredOperationIds) {
      if (!applied.has(operationId)) {
        errors.push(`operation ${operationId} was declared but never applied`);
      }
    }

    const seenFiles = new Set();
    for (const change of implementation.changes) {
      if (seenFiles.has(change.fileRef)) {
        errors.push(`file ${change.fileRef} carries more than one change record`);
      }
      seenFiles.add(change.fileRef);
      if (!declaredOperationIds.has(change.operationId)) {
        errors.push(`change on ${change.fileRef} names undeclared operation ${change.operationId}`);
      }

      const shape = HASH_SHAPE[change.changeKind];
      const beforeSet = change.beforeHash !== null;
      const afterSet = change.afterHash !== null;
      if ((shape.before === 'set') !== beforeSet) {
        errors.push(`change on ${change.fileRef} is ${change.changeKind} with the wrong beforeHash`);
      }
      if ((shape.after === 'set') !== afterSet) {
        errors.push(`change on ${change.fileRef} is ${change.changeKind} with the wrong afterHash`);
      }
      if (change.changeKind === 'modified' && beforeSet && afterSet && change.beforeHash === change.afterHash) {
        errors.push(`change on ${change.fileRef} records a modification whose hashes are identical`);
      }
    }

    const conformanceKeys = new Set();
    for (const record of implementation.conformance) {
      const key = `${record.operationId}|${record.facet}`;
      if (conformanceKeys.has(key)) {
        errors.push(`operation ${record.operationId} records ${record.facet} conformance twice`);
      }
      conformanceKeys.add(key);
      if (!declaredOperationIds.has(record.operationId)) {
        errors.push(`conformance names undeclared operation ${record.operationId}`);
      }
      // A widened or narrowed facet means the frozen contract was not filled as written.
      if (outcome === 'implemented' && record.verdict !== 'conforms') {
        errors.push(`operation ${record.operationId} reports ${record.verdict} ${record.facet} conformance in an implemented receipt`);
      }
    }

    const proofKeys = new Set();
    for (const proof of implementation.proofs) {
      const key = `${proof.operationId}|${proof.proofKind}`;
      if (proofKeys.has(key)) {
        errors.push(`operation ${proof.operationId} records the ${proof.proofKind} proof twice`);
      }
      proofKeys.add(key);
      if (!declaredOperationIds.has(proof.operationId)) {
        errors.push(`proof names undeclared operation ${proof.operationId}`);
      }
      if (outcome === 'implemented' && proof.result !== 'passed') {
        errors.push(`operation ${proof.operationId} reports a failed ${proof.proofKind} proof in an implemented receipt`);
      }
      // The result file is what an auditor opens to disagree with this receipt.
      if (!artifactRefs.includes(proof.resultRef)) {
        errors.push(`artifactRefs does not register proof result ${proof.resultRef}`);
      }
    }

    for (const operation of implementation.operations) {
      for (const facet of operation.facets) {
        if (!conformanceKeys.has(`${operation.operationId}|${facet}`)) {
          // Silence about a facet reads exactly like a pass.
          errors.push(`operation ${operation.operationId} declares the ${facet} facet but proves no conformance for it`);
        }
      }
      for (const proofKind of operation.proofKinds) {
        if (!proofKeys.has(`${operation.operationId}|${proofKind}`)) {
          errors.push(`operation ${operation.operationId} declares the ${proofKind} proof but never ran it`);
        }
      }
      for (const record of implementation.conformance) {
        if (record.operationId === operation.operationId && !operation.facets.includes(record.facet)) {
          errors.push(`operation ${operation.operationId} proves undeclared facet ${record.facet}`);
        }
      }
      for (const proof of implementation.proofs) {
        if (proof.operationId === operation.operationId && !operation.proofKinds.includes(proof.proofKind)) {
          errors.push(`operation ${operation.operationId} runs undeclared proof ${proof.proofKind}`);
        }
      }
    }
  }

  for (const finding of findings) {
    if (finding.operationId !== null && implementation !== null && !declaredOperationIds.has(finding.operationId)) {
      errors.push(`finding names undeclared operation ${finding.operationId}`);
    }
    // Raising the business question and shipping anyway is the exact contradiction to catch.
    if (finding.code === 'BUSINESS_QUESTION_RAISED' && outcome === 'implemented') {
      errors.push('an implemented receipt cannot raise an unresolved business question');
    }
  }

  return errors;
});

if (process.argv[1]?.endsWith('validate-output.mjs')) {
  await runValidatorCli(validateOutput, 'node validate-output.mjs <output.json>');
}
