import { validatorFor, runValidatorCli } from './validation.mjs';

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), (value) => {
  const errors = [];
  const { outcome, receipt, artifactRefs } = value.output;
  const { status, binding, application, findings, failure, resume } = receipt;

  if (outcome !== status) errors.push('output.outcome must equal receipt.status');

  if (outcome === 'applied') {
    if (application === null) errors.push('an applied receipt requires an application');
    if (failure !== null) errors.push('an applied receipt cannot carry a failure');
    if (resume !== null) errors.push('an applied receipt cannot carry a resume');
  } else {
    if (application !== null) errors.push('a blocked receipt cannot carry an application');
    if (failure === null) errors.push('a blocked receipt requires one typed failure');
    else if (failure.retryable && resume === null) errors.push('a retryable failure requires a resume');
    else if (!failure.retryable && resume !== null) errors.push('a non-retryable failure cannot carry a resume');
  }

  if (application !== null) {
    // The resolution actually read must be the resolution the receipt binds. A newer receipt read
    // under an older binding is RESOLUTION_STALE, not a detail of bookkeeping.
    if (application.appliedResolution.receiptRef !== binding.resolutionReceiptRef) {
      errors.push('the applied resolution must be the receipt named in the binding');
    }
    if (application.appliedResolution.fingerprint !== binding.resolutionFingerprint) {
      errors.push('the applied resolution fingerprint must equal the bound resolution fingerprint');
    }

    const observed = new Set(binding.observationOnlyOwnerRefs);
    const rootFor = new Map(binding.mutableOwners.map((owner) => [owner.ownerRef, owner.rootPath]));

    const declaredFor = new Map();
    for (const entry of application.declaredWriteSet) {
      if (declaredFor.has(entry.path)) errors.push(`declared write set repeats path ${entry.path}`);
      declaredFor.set(entry.path, entry);

      if (observed.has(entry.ownerRef)) {
        errors.push(`declared path ${entry.path} belongs to observation-only owner ${entry.ownerRef}`);
      }
      const root = rootFor.get(entry.ownerRef);
      if (root === undefined) {
        errors.push(`declared path ${entry.path} names non-mutable owner ${entry.ownerRef}`);
      } else if (!entry.path.startsWith(`${root}/`)) {
        errors.push(`declared path ${entry.path} lies outside the root of owner ${entry.ownerRef}`);
      }
    }

    const classInventory = new Set(application.resolutionClassNames);
    const ruleInventory = new Set(application.appliedRuleIds);
    if (application.resolutionClassNames.length !== classInventory.size) {
      errors.push('resolutionClassNames must not repeat a class');
    }
    if (application.appliedRuleIds.length !== ruleInventory.size) {
      errors.push('appliedRuleIds must not repeat a rule identifier');
    }

    const writtenPaths = new Set();
    let effectiveWrites = 0;

    for (const write of application.writes) {
      if (writtenPaths.has(write.path)) errors.push(`path ${write.path} is written more than once`);
      writtenPaths.add(write.path);

      const declared = declaredFor.get(write.path);
      if (declared === undefined) {
        errors.push(`path ${write.path} was written but is absent from the declared write set`);
      } else if (declared.ownerRef !== write.ownerRef) {
        errors.push(`path ${write.path} was written under owner ${write.ownerRef} but declared under ${declared.ownerRef}`);
      } else if (declared.intent === 'create' && write.action === 'modified') {
        errors.push(`path ${write.path} was declared for creation but reports a modification`);
      } else if (declared.intent === 'modify' && write.action === 'created') {
        errors.push(`path ${write.path} was declared for modification but reports a creation`);
      }

      // Every value carried into source must already exist in the resolution. This operator has no
      // way to decide one, so a class it cannot find is a class that does not exist yet.
      for (const className of write.classNames) {
        if (!classInventory.has(className)) {
          errors.push(`path ${write.path} writes class "${className}" which the resolution never published`);
        }
      }
      for (const ruleId of write.ruleIds) {
        if (!ruleInventory.has(ruleId)) {
          errors.push(`path ${write.path} carries rule ${ruleId} which the resolution never applied`);
        }
      }

      if (write.action === 'created') {
        if (write.fingerprintBefore !== null) {
          errors.push(`path ${write.path} was created but reports a prior fingerprint`);
        }
        effectiveWrites += 1;
      }
      if (write.action === 'modified') {
        if (write.fingerprintBefore === null) {
          errors.push(`path ${write.path} was modified but reports no prior fingerprint`);
        } else if (write.fingerprintBefore === write.fingerprintAfter) {
          errors.push(`path ${write.path} reports a modification with an unchanged fingerprint`);
        }
        effectiveWrites += 1;
      }
      if (write.action === 'unchanged') {
        if (write.fingerprintBefore !== write.fingerprintAfter) {
          errors.push(`path ${write.path} is reported unchanged with a different fingerprint`);
        }
        if (write.classNames.length > 0) {
          errors.push(`path ${write.path} is reported unchanged while emitting classes`);
        }
      }

      if (write.classNames.length > 0 && write.nodePaths.length === 0) {
        errors.push(`path ${write.path} writes classes without naming the nodes that carry them`);
      }

      // Contract emission is decided by the resolution, not re-decided here.
      if (application.contractEmission === 'receipt-only' && write.contractAttributeWritten) {
        errors.push(`path ${write.path} writes a contract attribute under receipt-only emission`);
      }
      if (
        application.contractEmission === 'attribute' &&
        write.classNames.length > 0 &&
        !write.contractAttributeWritten
      ) {
        errors.push(`path ${write.path} writes resolved classes without their contract attribute`);
      }

      if (write.action !== 'unchanged' && !artifactRefs.includes(write.path)) {
        errors.push(`artifactRefs must register written path ${write.path}`);
      }
    }

    if (effectiveWrites === 0) {
      errors.push('an applied receipt must change at least one declared path');
    }

    // A declared path that produced nothing is reported, never dropped silently.
    for (const path of declaredFor.keys()) {
      if (writtenPaths.has(path)) continue;
      const reported = findings.some(
        (item) => item.path === path && item.code === 'WRITE_SET_PATH_UNUSED',
      );
      if (!reported) errors.push(`declared path ${path} produced no write and no unused finding`);
    }

    for (const finding of findings) {
      if (!declaredFor.has(finding.path)) {
        errors.push(`finding on ${finding.path} names a path outside the declared write set`);
        continue;
      }
      const write = application.writes.find((item) => item.path === finding.path);
      if (finding.code === 'FILE_CREATED' && write?.action !== 'created') {
        errors.push(`finding claims ${finding.path} was created but no creation was written`);
      }
      if (finding.code === 'FILE_UNCHANGED' && write?.action !== 'unchanged') {
        errors.push(`finding claims ${finding.path} was unchanged but a change was written`);
      }
      if (finding.code === 'WRITE_SET_PATH_UNUSED' && write !== undefined) {
        errors.push(`finding claims ${finding.path} was unused but a write was recorded for it`);
      }
    }
  }

  return errors;
});

if (process.argv[1]?.endsWith('validate-output.mjs')) {
  await runValidatorCli(validateOutput, 'node validate-output.mjs <output.json>');
}
