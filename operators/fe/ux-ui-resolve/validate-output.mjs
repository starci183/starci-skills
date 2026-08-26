import { validatorFor, runValidatorCli } from '../../validation.mjs';

const sameStrings = (left, right) => JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), (value) => {
  const errors = [];
  const { decision, produced, artifact } = value.payload;
  if (value.status !== decision || value.payload.state.status !== decision || value.payload.state.emits.status !== decision) errors.push('$.payload.state: root, decision and emitted status must agree');

  const actionPaths = artifact.requestActions.map((item) => item.path);
  const mutationPaths = produced.mutations.map((item) => item.path);
  if (new Set(actionPaths).size !== actionPaths.length) errors.push('$.payload.artifact.requestActions: duplicate request paths are forbidden');

  if (decision === 'repair-ready') {
    if (artifact.phase !== 'plan') errors.push('$.payload.artifact.phase: repair-ready requires plan');
    if (artifact.handoffRef === null) errors.push('$.payload.artifact.handoffRef: repair-ready requires a typed handoff');
    if (artifact.requestActions.some((item) => item.action !== 'approve')) errors.push('$.payload.artifact.requestActions: plan may only approve');
    if (produced.mutations.some((item) => item.requestStatus !== 'approved')) errors.push('$.payload.produced.mutations: plan may only persist approved status');
    if (!sameStrings(actionPaths, mutationPaths)) errors.push('$.payload.produced.mutations: plan mutations must match request actions exactly');
    if (Object.values(artifact.proof).some(Boolean)) errors.push('$.payload.artifact.proof: plan cannot claim closure proof');
  }

  if (decision === 'resolved') {
    if (artifact.phase !== 'close') errors.push('$.payload.artifact.phase: resolved requires close');
    if (artifact.handoffRef !== null) errors.push('$.payload.artifact.handoffRef: resolved cannot carry a repair handoff');
    if (artifact.requestActions.some((item) => item.action !== 'resolve')) errors.push('$.payload.artifact.requestActions: close may only resolve');
    if (produced.mutations.some((item) => item.requestStatus !== 'resolved')) errors.push('$.payload.produced.mutations: close may only persist resolved status');
    if (!sameStrings(actionPaths, mutationPaths)) errors.push('$.payload.produced.mutations: close mutations must match request actions exactly');
    if (Object.values(artifact.proof).some((proved) => proved !== true)) errors.push('$.payload.artifact.proof: resolved requires every closure proof');
  }

  if (decision === 'blocked' && produced.mutations.length !== 0) errors.push('$.payload.produced.mutations: blocked cannot mutate requests');
  return errors;
});

if (process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput, 'node validate-output.mjs <artifact.json>');
