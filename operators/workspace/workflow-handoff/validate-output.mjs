import { runValidatorCli, validatorFor } from '../../validation.mjs';

const schemaUrl = new URL('./output.schema.json', import.meta.url);

function semantic(value) {
  const errors = [];
  const complete = value.status === 'complete';
  const expected = {
    published: ['completed', 'workspace-workflow-handoff-published', 'workflow-checkpoint-published'],
    resumed: ['completed', 'workspace-workflow-handoff-resumed', 'workflow-checkpoint-resumed'],
    blocked: ['blocked', 'workspace-workflow-handoff-blocked', 'workflow-handoff-blocked']
  }[value.payload.decision];
  if (expected) {
    if (value.payload.state.status !== expected[0]) errors.push('/payload/state/status: must agree with decision');
    if (value.payload.state.code !== expected[1]) errors.push('/payload/state/code: must agree with decision');
    if (!value.payload.state.emits.factsAdd.includes(expected[2])) errors.push('/payload/state/emits/factsAdd: missing decision fact');
  }
  if (complete && !['published', 'resumed'].includes(value.payload.decision)) errors.push('/payload/decision: complete output must publish or resume');
  if (!complete && value.payload.decision !== 'blocked') errors.push('/payload/decision: blocked status requires blocked decision');
  if (complete && typeof value.payload.produced.checkpointTag !== 'string') errors.push('/payload/produced/checkpointTag: completion requires the exact tag');
  if (complete && typeof value.payload.produced.resumeCapability !== 'string') errors.push('/payload/produced/resumeCapability: completion requires the next capability');
  if (complete && typeof value.payload.produced.resumeStage !== 'string') errors.push('/payload/produced/resumeStage: completion requires the next stage');
  if (complete && typeof value.payload.produced.resumeReceiptRef !== 'string') errors.push('/payload/produced/resumeReceiptRef: completion requires a continuation receipt');
  if (complete && value.payload.produced.sourcePushRefs.length === 0) errors.push('/payload/produced/sourcePushRefs: completion requires exact Git-head proof');
  if (complete && value.payload.produced.durableWrites.length === 0) errors.push('/payload/produced/durableWrites: completion requires the checkpoint tag or adopted head effects');
  if (value.status === 'blocked' && value.payload.findings.length === 0) errors.push('/payload/findings: blocked output requires a bounded finding');
  const prefix = `session://tasks/${value.payload.cleanup.scratchRefs[0]?.split('/')[3] ?? ''}/`;
  if (value.payload.cleanup.scratchRefs.length > 0 && !value.payload.cleanup.scratchRefs.every((ref) => ref.startsWith(prefix))) errors.push('/payload/cleanup/scratchRefs: scratch refs must share one task owner');
  return errors;
}

export const validateOutput = validatorFor(schemaUrl, semantic);

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll('\\\\', '/')}`).href) {
  await runValidatorCli(validateOutput, 'usage: node validate-output.mjs <output.json>');
}
