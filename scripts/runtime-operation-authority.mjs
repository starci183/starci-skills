// Admission for the supported process-control CLI, not a host security boundary.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSessionState, realPath, workflowOwnerErrors } from './workflow-root.mjs';
import { validateRequest } from './validate-request.mjs';
import { deliveryRequestErrors } from './mission-scope.mjs';
import { platformAuthorityErrors } from './platform-authority.mjs';
import { operationClasses, RUNG_EFFECTS, RUNGS_THAT_START } from '../operators/runtime-serve/validate.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const covers = (owner, target) => { const base = realPath(owner), full = realPath(target); return full === base || full.startsWith(`${base}${path.sep}`); };
export function runtimeOperationBindingErrors({ state, request, requestHash, operation, worktree, log, pidFile, session }) {
  const errors = [], key = `${request.step}/${request.parallel}${request.exchange ? `/${request.exchange}` : ''}`;
  if (request.operatorId !== 'runtime.serve') errors.push('runtime.serve request required');
  if (state.lifecycle?.phase !== 'active' || state.status !== 'running') errors.push('active running session required');
  const attempt = state.attempts?.[key];
  if (!attempt || attempt.id !== request.attempt?.id || attempt.status !== 'running') errors.push('current running attempt required');
  const lease = state.workerSlots?.find(value => value.attemptId === attempt?.id && value.branch === key);
  if (!lease || lease.requestHash && lease.requestHash !== requestHash) errors.push('current worker slot required');
  if (state.requestHashes?.[key] !== requestHash) errors.push('frozen request changed');
  const requirements = request.requirements ?? {}, rung = requirements.operation;
  if (operation === 'stop' ? rung !== 'stop' : !RUNGS_THAT_START.has(rung)) errors.push(`requested rung ${rung ?? 'missing'} does not authorize ${operation}`);
  if (!(requirements.desiredState?.effects ?? []).includes(RUNG_EFFECTS[rung])) errors.push('requested effect does not cover this rung');
  const owners = [...(request.environment?.exclusive ?? []), ...(request.environment?.writes ?? []), request.environment?.workspace?.worktree].filter(value => typeof value === 'string' && path.isAbsolute(value));
  if (!worktree || !owners.some(owner => covers(owner, worktree))) errors.push('server worktree has no declared concrete write owner');
  for (const target of [log, pidFile].filter(Boolean)) if (!covers(session, target) && !owners.some(owner => covers(owner, target))) errors.push(`process record path has no declared write owner: ${target}`);
  return errors;
}

export async function assertRuntimeOperationAuthority(args) {
  if (!args.branch) throw Error('RUNTIME_AUTHORITY_REQUIRED: --branch must name the admitted runtime.serve invocation before process or cache mutation');
  const branch = path.resolve(args.branch), owner = readSessionState(branch);
  if (!owner) throw Error('RUNTIME_AUTHORITY_REQUIRED: branch has no session');
  const checked = await validateRequest(root, branch);
  const errors = [...checked.errors, ...workflowOwnerErrors(root, owner.session, owner.state, { dispatch: true })];
  if (!checked.request) throw Error(`RUNTIME_AUTHORITY_REQUIRED: ${errors.join('; ')}`);
  errors.push(...deliveryRequestErrors(owner.state, checked.request, root));
  let record = null;
  if (args.stop) record = JSON.parse(readFileSync(args.stop, 'utf8'));
  const requirements = checked.request.requirements ?? {};
  errors.push(...await platformAuthorityErrors({ root, hostRoot: owner.state.workflowOwner?.sourceRoot, requirements, kind: requirements.desiredState?.serviceKind, desiredEffects: requirements.desiredState?.effects ?? [], operationClasses }));
  errors.push(...runtimeOperationBindingErrors({ state: owner.state, request: checked.request, requestHash: sha(readFileSync(path.join(branch, 'request/request.json'))), operation: args.stop ? 'stop' : 'start', worktree: record?.worktree ?? args.worktree, log: record?.logRef ?? args.log, pidFile: args.stop, session: owner.session }));
  if (errors.length) throw Error(`RUNTIME_AUTHORITY_REQUIRED: ${errors.join('; ')}`);
  return { assurance: 'cooperative-ledger-validation', userSourceAuthentication: 'not-provided', modelDispatchAuthentication: 'not-provided' };
}
