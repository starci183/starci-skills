// Admission only: previewing a continuation neither changes lifecycle nor rewrites accepted history.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { validateAgainst } from './json-schema.mjs';
import { workflowOwnerErrors } from './workflow-root.mjs';
import { frozenScopeErrors } from './mission-scope.mjs';
import { missionCorrectionBusy } from './session-open.mjs';
import { acceptedBlockedResponse } from './accepted-blocked.mjs';

export async function continuationErrors(root, session, state, flags = {}) {
  const continuation = flags.continuation, phase = state?.lifecycle?.phase;
  if (continuation === undefined) return phase === 'active' ? [] : ['SESSION_CONTINUATION_REQUIRED: the owning native task must request continuation before reviewing a blocked session'];
  const errors = [];
  try {
    const schema = JSON.parse(await readFile(path.join(root, 'templates/step/continuation.schema.json'), 'utf8'));
    errors.push(...validateAgainst(schema, continuation, 'continuation'));
    if (errors.length) return errors;
    const blocked = phase === 'blocked' && state.status === 'blocked';
    const activeLegacy = phase === 'active' && state.status === 'running' && !state.planHistory && state.stoppedAt === undefined;
    if (!blocked && !activeLegacy) errors.push('SESSION_CONTINUATION_INVALID: continuation requires a blocked session or an active legacy ledger with a terminal blocked current attempt');
    if (continuation.hostId !== state.hostBinding?.hostId) errors.push('SESSION_CONTINUATION_OWNER: continuation must come from the exact owning native task or session');
    const cell = flags.edit?.cell;
    if (flags.edit?.kind !== 'resume' || !/^[1-9][0-9]*\/[1-9][0-9]*$/.test(cell ?? '') || cell !== state.current) errors.push('SESSION_CONTINUATION_INVALID: resume must name the current blocked invocation');
    if (blocked && state.stoppedAt?.branch !== cell) errors.push('SESSION_CONTINUATION_INVALID: resume differs from the recorded stoppedAt branch');
    if (state.mission?.confirmation?.status !== 'confirmed') errors.push('SESSION_CONTINUATION_SCOPE: continuation cannot confirm or replace the mission');
    errors.push(...workflowOwnerErrors(root, session, state, { dispatch: true }));
    errors.push(...frozenScopeErrors(state, { root }));
    if ((state.workerSlots ?? []).length || Object.keys(state.leases ?? {}).length || Object.values(state.attempts ?? {}).some(attempt => ['running', 'waiting'].includes(attempt.status)) || await missionCorrectionBusy(session, state)) errors.push('SESSION_CONTINUATION_BUSY: seal live attempts and release their workers and leases before continuation');
    if (errors.length) return [...new Set(errors)];
    const response = await acceptedBlockedResponse(root, session, state, cell);
    if (blocked && (state.stoppedAt.stop !== response.stop || state.stoppedAt.operator !== response.operatorId)) errors.push('SESSION_CONTINUATION_INVALID: stoppedAt differs from the accepted blocked response');
  } catch (error) { errors.push(error.message); }
  return [...new Set(errors)];
}
