import { runValidatorCli, validatorFor } from '../../operators/validation.mjs';

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), (value) => {
  const errors = [];
  if (value.result !== value.finalState) errors.push('terminal mismatch');
  const directions = value.dispositions.map(({ direction }) => direction).sort();
  if (JSON.stringify(directions) !== JSON.stringify(['add', 'change', 'remove'])) errors.push('exactly one ADD, CHANGE, and REMOVE disposition is required');
  const requiredLayers = ['objective-scope', 'input', 'prompt', 'state-machine', 'execute-logic', 'knowledge', 'grammar-ui', 'validation', 'output-contract', 'tool-model', 'proof'].sort();
  const actualLayers = value.layerChecks.map(({ layer }) => layer).sort();
  if (JSON.stringify(actualLayers) !== JSON.stringify(requiredLayers)) errors.push('exactly one check is required for every diagnostic layer');
  for (const check of value.layerChecks) {
    if (check.status === 'passed' && (check.finding !== null || check.ownerRef !== null)) errors.push(`${check.layer}: passed layer cannot retain a finding or owner`);
    if (check.status === 'finding' && (!check.finding || !check.ownerRef)) errors.push(`${check.layer}: finding requires the smallest owner`);
    if (check.status === 'not-applicable' && (!check.finding || check.ownerRef !== null)) errors.push(`${check.layer}: not-applicable requires an evidence-backed reason and no owner`);
  }
  const attemptNumbers = value.attempts.map(({ attempt }) => attempt);
  if (new Set(attemptNumbers).size !== attemptNumbers.length) errors.push('attempt numbers must be unique');
  const fingerprints = value.attempts.map(({ fingerprint }) => fingerprint);
  const hasRepeatedFingerprint = new Set(fingerprints).size !== fingerprints.length;
  if (value.correctness.repeatedFingerprint !== hasRepeatedFingerprint) errors.push('repeated fingerprint flag differs from attempts');
  const trailingPasses = [...value.attempts].reverse().findIndex(({ verdict }) => verdict !== 'pass');
  const achievedPasses = trailingPasses === -1 ? value.attempts.length : trailingPasses;
  if (value.correctness.achievedConsecutivePasses !== achievedPasses) errors.push('achieved consecutive passes differ from ordered attempts');
  if (value.correctness.repairAttempts !== value.attempts.filter(({ phase }) => phase === 'retry').length) errors.push('repair attempt count differs from retry outputs');
  if (value.correctness.initialVerdict !== value.attempts[0].verdict) errors.push('initial verdict differs from first attempt');
  if (value.correctness.finalVerdict !== value.attempts.at(-1).verdict) errors.push('final verdict differs from last attempt');
  if (value.mode === 'calibrate' && value.changeSetApplied) errors.push('calibration cannot claim an applied change set');
  if (value.mode === 'calibrate' && value.correctness.initialVerdict !== 'pass' && value.result !== 'blocked') errors.push('failed calibration output must block after diagnosis');
  if (value.mode === 'upgrade' && value.result === 'complete' && !value.changeSetApplied) errors.push('completed upgrade requires an applied change set');
  if (value.result === 'not-needed' && value.changeSetApplied) errors.push('not-needed cannot claim a change set');
  if (['complete', 'not-needed'].includes(value.result)) {
    if (value.correctness.finalVerdict !== 'pass' || value.correctness.achievedConsecutivePasses < value.correctness.requiredConsecutivePasses) errors.push('successful terminal requires two consecutive correct outputs');
    if (hasRepeatedFingerprint) errors.push('successful terminal cannot reuse an output fingerprint');
    if (value.layerChecks.some(({ status }) => status === 'finding')) errors.push('successful terminal cannot retain a diagnostic finding');
    if (value.reason !== null) errors.push('successful terminal cannot include a blocker reason');
  }
  if (value.result === 'blocked' && !value.reason) errors.push('blocked result requires a reason');
  if (value.observationMode === 'multi-task') {
    const actors = value.actorResults ?? [];
    if (actors.length < 2 || actors.length > 3) errors.push('multi-task output requires two or three actor results');
    if (!value.crossCaseDecision) errors.push('multi-task output requires one cross-case decision');
    if (!value.runtimeTransition) errors.push('multi-task output requires a runtime transition record');
    const actorIds = actors.map(({ actorId }) => actorId);
    const taskRefs = actors.map(({ taskRef }) => taskRef);
    if (new Set(actorIds).size !== actorIds.length) errors.push('multi-task actor result ids must be unique');
    if (new Set(taskRefs).size !== taskRefs.length) errors.push('multi-task actor result task refs must be unique');
    for (const actor of actors) {
      const repeated = new Set(actor.attemptFingerprints).size !== actor.attemptFingerprints.length;
      const packet = actor.proofPacket;
      if (actor.verdict === 'pass' && actor.status !== 'complete') errors.push(`${actor.actorId}: passing actor must be complete`);
      if (actor.verdict === 'pass' && !actor.resultRef) errors.push(`${actor.actorId}: passing actor requires a resultRef`);
      if (actor.verdict === 'pass' && actor.achievedConsecutivePasses < actor.requiredConsecutivePasses) errors.push(`${actor.actorId}: passing actor requires its own consecutive passes`);
      if (actor.verdict === 'pass' && repeated) errors.push(`${actor.actorId}: passing actor cannot reuse a fingerprint`);
      if (actor.verdict === 'pass' && !packet?.preMutationRuntimeObserveReceiptRef) errors.push(`${actor.actorId}: passing actor requires a pre-mutation runtime-observe receipt`);
      if (actor.verdict === 'pass' && (!packet?.terminalVisible || !packet.skillResultRef)) errors.push(`${actor.actorId}: passing actor requires one visible typed Skill result`);
      if (actor.verdict === 'pass' && !['complete', 'handoff'].includes(packet?.typedOutcome)) errors.push(`${actor.actorId}: passing actor requires a successful typed outcome`);
      if (actor.verdict === 'pass' && (!packet?.directionQualityReceiptRef || !packet.independentReviewRef || !packet.durableRasterRefs.length)) errors.push(`${actor.actorId}: passing visual actor requires direction, durable raster, and independent review receipts`);
      if (actor.verdict === 'pass') {
        for (const ref of [packet.preMutationRuntimeObserveReceiptRef, packet.skillResultRef, packet.directionQualityReceiptRef, packet.independentReviewRef, ...packet.durableRasterRefs]) {
          if (!actor.evidenceRefs.includes(ref)) errors.push(`${actor.actorId}: proof packet ref is not bound in actor evidenceRefs: ${ref}`);
        }
      }
    }
    if (['complete', 'not-needed'].includes(value.result) && actors.some(({ verdict }) => verdict !== 'pass')) errors.push('multi-task success requires every actor to pass independently');
    if (['complete', 'not-needed'].includes(value.result) && actors.some(({ runtimeFingerprint }) => runtimeFingerprint !== actors[0]?.runtimeFingerprint)) errors.push('multi-task success requires one final runtime fingerprint');
    if (value.crossCaseDecision?.discriminatorRequired && !actors.some(({ role }) => role === 'discriminator')) errors.push('required discriminator result is missing');
    if (!value.crossCaseDecision?.discriminatorRequired && actors.some(({ role }) => role === 'discriminator')) errors.push('discriminator actor requires an evidenced discriminator decision');
    if (value.changeSetApplied && value.crossCaseDecision?.classification === 'product-specific') errors.push('product-specific evidence cannot authorize a runtime change');
    if (['complete', 'not-needed'].includes(value.result) && !['sufficient', 'not-applicable'].includes(value.crossCaseDecision?.knowledgeStatus)) errors.push('multi-task success cannot retain an unresolved knowledge classification');
    if (value.changeSetApplied && value.runtimeTransition) {
      if (value.runtimeTransition.afterFingerprint === null || value.runtimeTransition.afterFingerprint === value.runtimeTransition.beforeFingerprint) errors.push('applied runtime change requires a fresh runtime fingerprint');
      if (!value.runtimeTransition.proofsInvalidated || !value.runtimeTransition.reloadRequired) errors.push('applied runtime change must invalidate old proofs and require actor reload');
      if (value.runtimeTransition.actorNotificationRefs.length < actors.length || value.runtimeTransition.resumeRefs.length < actors.length) errors.push('applied runtime change requires notification and resume receipts for every actor');
      if (actors.some(({ runtimeFingerprint }) => runtimeFingerprint !== value.runtimeTransition.afterFingerprint)) errors.push('every successful actor must run the changed runtime fingerprint');
    }
  }
  return errors;
});

if (process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput, 'node validate-output.mjs <artifact.json>');
