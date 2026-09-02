import { validatorFor, runValidatorCli } from './validation.mjs';

const COVERAGE_METRICS = ['statements', 'lines', 'functions', 'branches'];

/**
 * A gate result is measured, never narrated. Each status implies an exact shape for the exit code,
 * the evidence, and the classification, and a shape mismatch is how a claim without a command gets
 * recorded as a pass.
 */
function checkResultShape(result, errors) {
  const at = `gate ${result.gate}`;
  switch (result.status) {
    case 'pass':
      if (result.exitCode !== 0) errors.push(`${at} passed with a non-zero exit code`);
      if (result.evidenceRef === null) errors.push(`${at} passed with no evidence to open`);
      if (result.classification !== null) errors.push(`${at} passed but carries a failure classification`);
      break;
    case 'fail':
      if (result.exitCode === null || result.exitCode === 0) {
        errors.push(`${at} failed with an exit code that reports success`);
      }
      if (result.evidenceRef === null) errors.push(`${at} failed with no evidence to open`);
      if (result.classification === null || result.classification === 'external-blocker') {
        errors.push(`${at} failed without an in-boundary, boundary-drift, or flaky classification`);
      }
      break;
    case 'external-blocker':
      if (result.classification !== 'external-blocker') {
        errors.push(`${at} was blocked externally but is classified otherwise`);
      }
      if (result.evidenceRef === null) errors.push(`${at} was blocked externally with no evidence to open`);
      break;
    case 'skipped-not-requested':
      // Available to e2e alone: a gate that quietly did not run reads exactly like a gate that passed.
      if (result.gate !== 'e2e') errors.push(`${at} cannot be skipped as not requested`);
      if (result.exitCode !== null) errors.push(`${at} was skipped but reports an exit code`);
      if (result.evidenceRef !== null) errors.push(`${at} was skipped but names evidence`);
      if (result.classification !== null) errors.push(`${at} was skipped but carries a classification`);
      break;
    default:
      break;
  }
}

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), (value) => {
  const errors = [];
  const { outcome, receipt, artifactRefs } = value.output;
  const { status, verification, findings, failure, resume } = receipt;

  if (outcome !== status) errors.push('output.outcome must equal receipt.status');

  if (outcome === 'verified') {
    if (verification === null) errors.push('a verified receipt requires a verification');
    if (failure !== null) errors.push('a verified receipt cannot carry a failure');
    if (resume !== null) errors.push('a verified receipt cannot carry a resume');
  } else {
    if (verification !== null) errors.push('a blocked receipt cannot carry a verification');
    if (failure === null) errors.push('a blocked receipt requires one typed failure');
    else if (failure.retryable && resume === null) errors.push('a retryable failure requires a resume');
    else if (!failure.retryable && resume !== null) errors.push('a non-retryable failure cannot carry a resume');
  }

  const findingKeys = new Set(findings.map((item) => `${item.code}|${item.gate}`));

  if (verification !== null) {
    const planned = new Set(verification.plannedGates);
    if (planned.size !== verification.plannedGates.length) {
      errors.push('plannedGates must not repeat a gate');
    }
    const required = new Set(verification.requiredGates);
    if (required.size !== verification.requiredGates.length) {
      errors.push('requiredGates must not repeat a gate');
    }
    for (const gate of required) {
      if (!planned.has(gate)) errors.push(`required gate ${gate} is not planned`);
    }

    const byGate = new Map();
    for (const result of verification.results) {
      if (byGate.has(result.gate)) errors.push(`gate ${result.gate} reports more than one result`);
      byGate.set(result.gate, result);
      if (!planned.has(result.gate)) errors.push(`gate ${result.gate} reports a result but was never planned`);
      checkResultShape(result, errors);
    }
    for (const gate of planned) {
      if (!byGate.has(gate)) errors.push(`planned gate ${gate} has no result`);
    }

    const skippedE2e = byGate.get('e2e');
    if (skippedE2e?.status === 'skipped-not-requested' && !findingKeys.has('E2E_NOT_REQUESTED|e2e')) {
      errors.push('a skipped e2e gate must record E2E_NOT_REQUESTED so the absence is visible');
    }

    // Coverage exists only where the unit gate produced it, and a metric under its own
    // threshold cannot sit beside a green unit result.
    const unit = byGate.get('unit-coverage');
    const unitMeasured = unit !== undefined && unit.status !== 'skipped-not-requested';
    if (verification.coverage === null && unitMeasured && unit.status === 'pass') {
      errors.push('the unit-coverage gate passed but reports no coverage measurement');
    }
    if (verification.coverage !== null && !unitMeasured) {
      errors.push('coverage is reported without a measured unit-coverage gate');
    }
    if (verification.coverage !== null) {
      const below = COVERAGE_METRICS.filter(
        (metric) => verification.coverage[metric] < verification.coverage.thresholds[metric],
      );
      if (below.length > 0 && unit?.status === 'pass') {
        errors.push(`unit-coverage passed while ${below.join(', ')} sit below their own threshold`);
      }
      if (below.length > 0 && !findingKeys.has('COVERAGE_BELOW_THRESHOLD|unit-coverage')) {
        errors.push('coverage below a threshold must record COVERAGE_BELOW_THRESHOLD');
      }
      if (!artifactRefs.includes(verification.coverage.evidenceRef)) {
        errors.push('artifactRefs does not register the coverage evidence');
      }
    }

    // A green Sonar gate measures the diff, not the project underneath it.
    const sonar = byGate.get('sonar');
    if (sonar !== undefined && verification.sonarScope === null) {
      errors.push('the sonar gate ran but the receipt does not say which scope was measured');
    }
    if (sonar === undefined && verification.sonarScope !== null) {
      errors.push('a sonar scope is reported without a sonar gate');
    }
    if (sonar?.status === 'pass' && verification.sonarScope === 'new-code' && !findingKeys.has('SONAR_NEW_CODE_ONLY|sonar')) {
      errors.push('a passing new-code Sonar gate must record SONAR_NEW_CODE_ONLY, because the project beneath it may be red');
    }

    const debtIds = new Set();
    const debtByGate = new Map();
    for (const debt of verification.debts) {
      if (debtIds.has(debt.debtId)) errors.push(`debt ${debt.debtId} is recorded twice`);
      debtIds.add(debt.debtId);
      debtByGate.set(debt.gate, debt);
      const covered = byGate.get(debt.gate);
      if (covered === undefined) {
        errors.push(`debt ${debt.debtId} covers unplanned gate ${debt.gate}`);
      } else if (covered.status !== 'fail') {
        errors.push(`debt ${debt.debtId} covers ${debt.gate}, which did not fail`);
      } else if (covered.classification !== 'in-boundary') {
        errors.push(`debt ${debt.debtId} owes away a ${covered.classification} failure that belongs to the boundary owner`);
      }
      if (!findingKeys.has(`DEBT_DECLARED|${debt.gate}`)) {
        errors.push(`debt ${debt.debtId} is carried without recording DEBT_DECLARED`);
      }
    }

    const unmet = [...required].filter((gate) => {
      const result = byGate.get(gate);
      if (result === undefined) return true;
      if (result.status === 'pass') return false;
      return !(result.status === 'fail' && debtByGate.has(gate));
    });
    if (verification.verdict === 'pass' && unmet.length > 0) {
      errors.push(`verdict is pass while required gates ${unmet.join(', ')} neither passed nor carry a debt`);
    }
    if (verification.verdict === 'fail' && unmet.length === 0) {
      errors.push('verdict is fail while every required gate passed or is debt-covered');
    }

    // Quality writes nothing but gate evidence; anything else here is a repair it may not make.
    const evidence = new Set(
      verification.results.map((item) => item.evidenceRef).filter((ref) => ref !== null),
    );
    if (verification.coverage !== null) evidence.add(verification.coverage.evidenceRef);
    for (const ref of evidence) {
      if (!artifactRefs.includes(ref)) errors.push(`artifactRefs does not register gate evidence ${ref}`);
    }
    for (const ref of artifactRefs) {
      if (!evidence.has(ref)) errors.push(`artifactRefs carries ${ref}, which no gate result produced`);
    }

    for (const finding of findings) {
      if (finding.gate !== null && !planned.has(finding.gate)) {
        errors.push(`finding names unplanned gate ${finding.gate}`);
      }
    }
  }

  return errors;
});

if (process.argv[1]?.endsWith('validate-output.mjs')) {
  await runValidatorCli(validateOutput, 'node validate-output.mjs <output.json>');
}
