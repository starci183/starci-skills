import { runValidatorCli, validatorFor } from '../../operators/validation.mjs';

export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), (value) => {
  const errors = [];
  const roots = value.scope.writeRoots;
  const requiredLayers = ['objective-scope', 'input', 'prompt', 'state-machine', 'execute-logic', 'knowledge', 'grammar-ui', 'validation', 'output-contract', 'tool-model', 'proof'].sort();
  if (JSON.stringify([...value.options.requiredLayerNames].sort()) !== JSON.stringify(requiredLayers)) errors.push('self-upgrade must bind every diagnostic layer; use evidence-backed not-applicable instead of omission');
  if (value.options.stabilityPolicy.requiredConsecutivePasses !== 2) errors.push('self-upgrade requires two consecutive passes');
  if (value.options.stabilityPolicy.maxRepairAttempts > 3) errors.push('self-upgrade allows at most three repair attempts');
  if (value.options.observationMode === 'multi-task') {
    const actors = value.options.actorSpecs ?? [];
    const policy = value.options.supervisionPolicy;
    if (!policy) errors.push('multi-task observation requires a supervision policy');
    if (actors.length < 2 || actors.length > 3) errors.push('multi-task observation requires two or three actors');
    if (actors.filter(({ role }) => role === 'primary').length < 2) errors.push('multi-task observation requires at least two primary actors');
    if (actors.filter(({ role }) => role === 'discriminator').length > 1) errors.push('multi-task observation allows at most one discriminator');
    const taskRefs = actors.map(({ taskRef }) => taskRef);
    if (new Set(taskRefs).size !== taskRefs.length) errors.push('multi-task actors require independent task references');
    const actorIds = actors.map(({ actorId }) => actorId);
    if (new Set(actorIds).size !== actorIds.length) errors.push('multi-task actor ids must be unique');
    const actorRoots = actors.flatMap(({ writeRootRefs }) => writeRootRefs);
    if (new Set(actorRoots).size !== actorRoots.length) errors.push('multi-task actor product write roots must not overlap');
    if (!policy?.preMutationCaptureGate) errors.push('multi-task actors require a pre-mutation capture gate');
    for (const actor of actors) {
      if (actor.expectedSkillId === 'starci-fe-process' && actor.preMutationGateRef !== 'operator://fe/runtime-observe') errors.push(`${actor.actorId}: frontend actor must gate mutation on fe/runtime-observe`);
      if (actor.expectedSkillId === 'starci-fe-process' && actor.terminalContractRef !== 'skill-output://starci-fe-process/v7') errors.push(`${actor.actorId}: frontend actor must bind the v7 terminal evidence contract`);
    }
  }
  if (value.options.observationMode === 'single' && (value.options.actorSpecs?.length ?? 0) > 1) errors.push('single observation cannot bind multiple actors');
  if (value.scope.externalMutation) errors.push('self-upgrade never authorizes external mutation');
  if (roots.some((root) => !root.startsWith('.claude/'))) errors.push('self-upgrade write roots must stay under .claude');
  if (value.options.intentMode === 'calibrate') {
    if (roots.length === 0 || roots.some((root) => !root.startsWith('.claude/upgrades/'))) errors.push('calibrate may write only .claude/upgrades artifacts');
    if (value.scope.approvalRef !== null) errors.push('calibrate does not consume runtime mutation approval');
  }
  if (value.options.intentMode === 'upgrade') {
    if (roots.length === 0 || !value.scope.approvalRef) errors.push('upgrade requires approved .claude write roots');
    if (roots.every((root) => root.startsWith('.claude/upgrades/'))) errors.push('upgrade must name at least one proven runtime owner in addition to its evidence store');
  }
  return errors;
});

if (process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput, 'node validate-input.mjs <artifact.json>');
