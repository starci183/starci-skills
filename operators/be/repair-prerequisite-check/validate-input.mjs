import { runValidatorCli, validatorFor } from '../../validation.mjs';

function refs(value, output = []) {
  if (typeof value === 'string' && value.startsWith('session://')) output.push(value);
  else if (Array.isArray(value)) for (const item of value) refs(item, output);
  else if (value && typeof value === 'object') for (const item of Object.values(value)) refs(item, output);
  return output;
}

function semantic(value) {
  const errors = [];
  if (!value.facts.includes('in-boundary-repair')) errors.push('$.facts: missing in-boundary-repair');
  const { provided, loads, session } = value.payload;
  const expectedAuthority = `.worktrees/${provided.project}/businesses`;
  if (!(loads.business.authorityPath === expectedAuthority || loads.business.authorityPath.startsWith(`${expectedAuthority}/`))) errors.push('$.payload.loads.business.authorityPath: project mismatch');
  if (loads.route.ref !== provided.routeReceiptRef || loads.route.project !== provided.project) errors.push('$.payload.loads.route: route identity mismatch');
  if (loads.business.freshnessReceiptRef !== provided.businessFreshnessReceiptRef || loads.business.headRef !== provided.businessHeadRef) errors.push('$.payload.loads.business: freshness identity mismatch');
  if (loads.business.boundRouteRevision !== loads.route.revision) errors.push('$.payload.loads.business.boundRouteRevision: route revision mismatch');
  if (loads.boundary.ref !== provided.approvedBoundaryRef || loads.boundary.approvalReceiptRef !== provided.approvalReceiptRef) errors.push('$.payload.loads.boundary: approval identity mismatch');
  if (loads.boundary.planHash !== loads.boundary.approvalPlanHash) errors.push('$.payload.loads.boundary: approval is not bound to plan hash');
  if (loads.boundary.baselineCommitRef !== provided.baselineCommitRef) errors.push('$.payload.loads.boundary.baselineCommitRef: baseline mismatch');
  if (loads.repair.findingRef !== provided.repairFindingRef || loads.repair.boundaryRevision !== loads.boundary.revision) errors.push('$.payload.loads.repair: finding boundary mismatch');
  const prefix = `session://tasks/${session.taskId}/`;
  for (const ref of refs({ provided, loads, session })) if (!ref.startsWith(prefix)) errors.push(`$: foreign task-session reference ${ref}`);
  return errors;
}

export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), semantic);
if (process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput, 'node validate-input.mjs <artifact.json>');
