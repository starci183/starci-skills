import { validatorFor, runValidatorCli } from './validation.mjs';

const LANES = ['behavior', 'ux', 'ui'];
const CANONICAL_PATH = /^\.worktrees\/uat\/([a-z0-9][a-z0-9-]*)\/([a-z0-9][a-z0-9-]*)\/(?:snapshot|result)\.json$/;

function flowOf(ref) {
  const match = CANONICAL_PATH.exec(ref);
  return match ? `${match[1]}/${match[2]}` : null;
}

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), (value) => {
  const errors = [];
  const { outcome, receipt, artifactRefs } = value.output;
  const { status, binding, freeze, publication, lanes, caseResults, cleanup, findings, failure, resume } = receipt;

  if (outcome !== status) errors.push('output.outcome must equal receipt.status');

  // A verdict exists only where a canonical result was written. Blocking publishes nothing, because a
  // half-published result is the artifact a later reader would mistake for a decision.
  if (outcome === 'blocked') {
    if (publication !== null) errors.push('a blocked receipt cannot publish a canonical result');
    if (failure === null) errors.push('a blocked receipt requires one typed failure');
    else if (failure.retryable && resume === null) errors.push('a retryable failure requires a resume');
    else if (!failure.retryable && resume !== null) errors.push('a non-retryable failure cannot carry a resume');
  } else {
    if (publication === null) errors.push('a decided receipt must publish the canonical result');
    if (failure !== null) errors.push('a decided receipt cannot carry a failure');
    if (resume !== null) errors.push('a decided receipt cannot carry a resume');
    if (publication !== null && publication.verdict !== outcome) {
      errors.push('the published verdict must equal the public outcome');
    }
  }

  // The canonical pair is one unit. A result whose snapshot binding does not equal the parsed sibling
  // snapshot is how a passing result gets attached to a snapshot that never framed it.
  if (publication !== null) {
    if (freeze === null) errors.push('a result cannot be published without a frozen snapshot');
    else {
      if (publication.snapshotFingerprint !== freeze.snapshotFingerprint) {
        errors.push('the published result must bind the fingerprint of its sibling snapshot');
      }
      if (flowOf(publication.resultRef) !== flowOf(freeze.snapshotRef)) {
        errors.push('the result and snapshot must address the same canonical feature/flow directory');
      }
      if (!artifactRefs.includes(freeze.snapshotRef)) errors.push('artifactRefs must register the canonical snapshot');
      if (!artifactRefs.includes(publication.resultRef)) errors.push('artifactRefs must register the canonical result');
    }
  }

  if (freeze !== null && flowOf(freeze.snapshotRef) !== `${binding.feature}/${binding.flow}`) {
    errors.push('the canonical snapshot path must equal the bound feature and flow');
  }

  const laneNames = lanes.map((item) => item.lane);
  if (new Set(laneNames).size !== laneNames.length) errors.push('a lane may report at most one verdict');

  const verdictOf = new Map(lanes.map((item) => [item.lane, item.verdict]));
  if (outcome !== 'blocked') {
    for (const lane of LANES) {
      if (!verdictOf.has(lane)) errors.push(`a decided receipt requires an independent ${lane} verdict`);
    }
  }

  // Behavior, UX, and UI keep independent evidence. A contradiction between them is FAIL and never a
  // pass narrated around the disagreeing lane.
  const failing = lanes.filter((item) => item.verdict === 'fail').map((item) => item.lane);
  if (failing.length > 0 && outcome !== 'failed') {
    errors.push(`a contradicted ${failing.join(' and ')} lane is FAIL, not ${outcome}`);
  }

  // Unavailable runtime or evidence is BLOCKED. Reporting it as FAIL would charge a defect to a product
  // that was never observed.
  const unavailable = lanes.filter((item) => item.verdict === 'unavailable').map((item) => item.lane);
  if (unavailable.length > 0 && outcome !== 'blocked') {
    errors.push(`an unavailable ${unavailable.join(' and ')} lane is BLOCKED, not ${outcome}`);
  }

  if (outcome === 'passed' && lanes.some((item) => item.verdict !== 'pass')) {
    errors.push('a passed receipt requires every independent lane to pass');
  }
  if (outcome === 'failed' && failing.length === 0) {
    errors.push('a failed receipt must name the contradicted lane');
  }

  const frozenById = new Map((freeze?.frozenCases ?? []).map((item) => [item.caseId, item]));
  if (freeze === null && caseResults.length > 0) {
    errors.push('a case cannot be executed before the snapshot freezes it');
  }

  const seenCases = new Set();
  const seenOrders = new Set();
  const frozenAt = freeze === null ? null : Date.parse(freeze.frozenAt);

  for (const result of caseResults) {
    if (seenCases.has(result.caseId)) errors.push(`case ${result.caseId} reports more than one result`);
    seenCases.add(result.caseId);

    const frozen = frozenById.get(result.caseId);
    if (frozen === undefined) {
      errors.push(`case ${result.caseId} was executed without being frozen into the snapshot`);
      continue;
    }
    if (frozen.order !== result.order) errors.push(`case ${result.caseId} was executed out of its frozen order`);
    if (seenOrders.has(result.order)) errors.push(`execution order ${result.order} is claimed by more than one case`);
    seenOrders.add(result.order);

    // Inputs are frozen before execution. A case executed at or before the freeze proves nothing about
    // the intent the snapshot states.
    if (frozenAt !== null && Date.parse(result.executedAt) <= frozenAt) {
      errors.push(`case ${result.caseId} executed at or before the snapshot freeze`);
    }

    // Post-journey mutation can manufacture the expected outcome, so it invalidates the evidence rather
    // than annotating it.
    if (result.postExecutionMutation && result.outcome === 'pass') {
      errors.push(`case ${result.caseId} passes on evidence a post-journey mutation could have manufactured`);
    }

    for (const capture of result.captures) {
      if (capture.assertionId.trim() === '') errors.push(`a capture on ${result.caseId} names no assertion`);
    }

    if (result.outcome === 'pass') {
      for (const checkpoint of frozen.requiredCheckpoints) {
        const covering = result.captures.filter((item) => item.checkpoint === checkpoint);
        if (covering.length === 0) {
          errors.push(`case ${result.caseId} passes with no capture at the ${checkpoint} checkpoint`);
        } else if (!covering.some((item) => item.framing === 'full-viewport')) {
          errors.push(`case ${result.caseId} covers the ${checkpoint} checkpoint with a crop; crops are supplementary only`);
        }
      }
    }
  }

  // One authenticated lease runs one case at a time, so the frozen order and the observed clock agree.
  const ordered = [...caseResults].sort((left, right) => left.order - right.order);
  for (let index = 1; index < ordered.length; index += 1) {
    if (Date.parse(ordered[index].executedAt) <= Date.parse(ordered[index - 1].executedAt)) {
      errors.push(`case ${ordered[index].caseId} did not execute after case ${ordered[index - 1].caseId}`);
    }
  }

  if (outcome === 'passed') {
    for (const frozen of frozenById.values()) {
      const result = caseResults.find((item) => item.caseId === frozen.caseId);
      if (result === undefined) errors.push(`frozen case ${frozen.caseId} was never executed`);
      else if (result.outcome !== 'pass') errors.push(`frozen case ${frozen.caseId} did not pass`);
    }

    if (findings.some((item) => item.severity === 'hard' && item.state === 'open')) {
      errors.push('a passed receipt cannot leave an open hard finding');
    }

    // A scoped cleanup requires both the UAT flag and the exact namespace; either alone would reach
    // records this run does not own.
    if (!cleanup.performed) errors.push('a passed receipt requires scoped fixture cleanup');
    if (!cleanup.usesUatFlag) errors.push('cleanup must select on is_uat=true');
    if (freeze !== null && cleanup.namespace !== freeze.fixtureNamespace) {
      errors.push('cleanup must select the exact frozen fixture namespace');
    }

    // Product UAT publishes only after the receipts that admitted it.
    if (!receipt.evidenceRefs.includes(binding.blindVisualPassRef)) {
      errors.push('a passed receipt must carry the admitted blind visual PASS as evidence');
    }
    if (!receipt.evidenceRefs.includes(binding.qualityPassRef)) {
      errors.push('a passed receipt must carry the admitted final quality PASS as evidence');
    }
  }

  for (const finding of findings) {
    if (finding.caseId !== null && freeze !== null && !frozenById.has(finding.caseId)) {
      errors.push(`finding on ${finding.caseId} names a case the snapshot never froze`);
    }
  }

  return errors;
});

if (process.argv[1]?.endsWith('validate-output.mjs')) {
  await runValidatorCli(validateOutput, 'node validate-output.mjs <output.json>');
}
