import { validatorFor, runValidatorCli } from './validation.mjs';

/**
 * A finding whose verdict is not PASS is a failure finding. PASS is valid only when no failure
 * finding stands on the same node and property, which is what stops a passing measurement from
 * being reported next to the drift it contradicts.
 */
const isFailure = (finding) => finding.verdict !== 'PASS';

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), (value) => {
  const errors = [];
  const { outcome, receipt, artifactRefs } = value.output;
  const { status, binding, audit, failure, resume } = receipt;

  if (outcome !== status) errors.push('output.outcome must equal receipt.status');

  if (outcome === 'audited') {
    if (audit === null) errors.push('an audited receipt requires an audit');
    if (failure !== null) errors.push('an audited receipt cannot carry a failure');
    if (resume !== null) errors.push('an audited receipt cannot carry a resume');
  } else {
    if (audit !== null) errors.push('a blocked receipt cannot carry an audit');
    if (failure === null) errors.push('a blocked receipt requires one typed failure');
    else if (failure.retryable && resume === null) errors.push('a retryable failure requires a resume');
    else if (!failure.retryable && resume !== null) errors.push('a non-retryable failure cannot carry a resume');
  }

  // The surface that was measured must be the surface that was applied. A blocked receipt may
  // record the two heads apart, because reporting that gap is exactly what SOURCE_DRIFT is for.
  if (outcome === 'audited' && binding.appliedSourceHead !== binding.sourceHead) {
    errors.push('an audited surface must be measured at the applied source head');
  }

  const boundRules = new Set(binding.boundRuleIds);
  if (binding.boundRuleIds.length !== boundRules.size) {
    errors.push('boundRuleIds must not repeat a rule identifier');
  }

  if (audit !== null) {
    const captureFor = new Map();
    for (const capture of audit.captures) {
      if (captureFor.has(capture.matrixId)) {
        errors.push(`matrix entry ${capture.matrixId} produced more than one capture`);
      }
      captureFor.set(capture.matrixId, capture);
      if (!artifactRefs.includes(capture.evidenceRef)) {
        errors.push(`artifactRefs must register capture evidence ${capture.evidenceRef}`);
      }
    }

    const observationFor = new Map();
    for (const observation of audit.observations) {
      const key = `${observation.matrixId}|${observation.nodePath}|${observation.property}`;
      if (observationFor.has(key)) {
        errors.push(`node ${observation.nodePath} measures ${observation.property} twice under ${observation.matrixId}`);
      }
      observationFor.set(key, observation);

      if (!captureFor.has(observation.matrixId)) {
        errors.push(`observation on ${observation.nodePath} names matrix entry ${observation.matrixId} with no capture`);
      }

      for (const ruleId of observation.claimedRuleIds) {
        if (!boundRules.has(ruleId)) {
          errors.push(`node ${observation.nodePath} records claim ${ruleId} as known while it is outside the bound inventory`);
        }
      }

      // An identifier the knowledge does not publish is a finding class of its own. Recording it
      // among the known claims would launder it into authority; dropping it would hide it.
      for (const identifier of observation.unknownClaimedIdentifiers) {
        if (boundRules.has(identifier)) {
          errors.push(`node ${observation.nodePath} files published rule ${identifier} as unknown`);
        }
        const reported = audit.findings.some(
          (item) =>
            item.matrixId === observation.matrixId &&
            item.nodePath === observation.nodePath &&
            item.claimedIdentifier === identifier,
        );
        if (!reported) {
          errors.push(`node ${observation.nodePath} claims unpublished identifier ${identifier} with no finding`);
        }
      }

      // A rendered value nobody claims has no owner, and that absence is the second finding class.
      if (observation.claimedRuleIds.length === 0 && observation.unknownClaimedIdentifiers.length === 0) {
        const reported = audit.findings.some(
          (item) =>
            item.matrixId === observation.matrixId &&
            item.nodePath === observation.nodePath &&
            item.property === observation.property &&
            item.verdict === 'PROOF_MISSING',
        );
        if (!reported) {
          errors.push(`node ${observation.nodePath} renders ${observation.property} with no claim and no PROOF_MISSING finding`);
        }
      }
    }

    const findingIds = new Set();
    for (const finding of audit.findings) {
      if (findingIds.has(finding.findingId)) errors.push(`finding ${finding.findingId} is reported twice`);
      findingIds.add(finding.findingId);

      const capture = captureFor.get(finding.matrixId);
      if (capture === undefined) {
        errors.push(`finding ${finding.findingId} names matrix entry ${finding.matrixId} with no capture`);
      } else if (capture.evidenceRef !== finding.evidenceRef) {
        errors.push(`finding ${finding.findingId} cites evidence that is not the capture of ${finding.matrixId}`);
      }

      // A verdict is a statement about a measurement. Without one there is nothing being judged.
      const key = `${finding.matrixId}|${finding.nodePath}|${finding.property}`;
      const observation = observationFor.get(key);
      if (observation === undefined) {
        errors.push(`finding ${finding.findingId} judges ${finding.property} on ${finding.nodePath} with no measurement`);
      }

      if (finding.ruleId !== null && !boundRules.has(finding.ruleId)) {
        errors.push(`finding ${finding.findingId} cites ${finding.ruleId}, which the bound knowledge does not publish`);
      }

      if (finding.claimedIdentifier !== null) {
        if (boundRules.has(finding.claimedIdentifier)) {
          errors.push(`finding ${finding.findingId} reports published rule ${finding.claimedIdentifier} as an unpublished claim`);
        }
        if (finding.ruleId !== null) {
          errors.push(`finding ${finding.findingId} cites a rule while reporting an unpublished claim`);
        }
        if (finding.verdict !== 'PROOF_MISSING') {
          errors.push(`finding ${finding.findingId} reports an unpublished claim under verdict ${finding.verdict}`);
        }
      }

      if (finding.verdict === 'PASS' && finding.causeTags.length > 0) {
        errors.push(`finding ${finding.findingId} passes while carrying a cause tag`);
      }

      // A drift is a disagreement between a claim and a measurement, so the rule it drifts from
      // must be a rule that node actually claimed.
      if (finding.causeTags.includes('VALUE_DRIFT')) {
        if (finding.ruleId === null) {
          errors.push(`finding ${finding.findingId} reports value drift without naming the drifting rule`);
        } else if (observation !== undefined && !observation.claimedRuleIds.includes(finding.ruleId)) {
          errors.push(`finding ${finding.findingId} reports drift from ${finding.ruleId}, which that node never claimed`);
        }
      }

      if (new Set(finding.causeTags).size !== finding.causeTags.length) {
        errors.push(`finding ${finding.findingId} repeats a cause tag`);
      }
    }

    for (const finding of audit.findings) {
      if (finding.verdict !== 'PASS') continue;
      const contradicted = audit.findings.some(
        (item) =>
          item !== finding &&
          item.matrixId === finding.matrixId &&
          item.nodePath === finding.nodePath &&
          item.property === finding.property &&
          isFailure(item),
      );
      if (contradicted) {
        errors.push(`finding ${finding.findingId} passes ${finding.property} on ${finding.nodePath} while a failure finding stands on it`);
      }
    }
  }

  return errors;
});

if (process.argv[1]?.endsWith('validate-output.mjs')) {
  await runValidatorCli(validateOutput, 'node validate-output.mjs <output.json>');
}
