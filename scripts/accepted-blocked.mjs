// A sealed blocked result is a historical reason for re-entry, never current success proof.
// The successor still runs the current request, operator and acceptance gates. In particular,
// this reader must not rejudge an old readiness report or profile under today's operator law.
import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual as same } from 'node:util';
import { evidenceManifestErrors } from './evidence-manifest.mjs';
import { invocationState } from './mission-history.mjs';
import { scopeHash } from './mission-scope.mjs';
import { V22_CONTRACT } from './validate-request.mjs';

const hash = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const reject = message => { throw Error(`PLAN_BLOCKED_HISTORY_UNBOUND: ${message}`); };

export async function acceptedBlockedResponse(_root, session, state, cell) {
  if (!/^[1-9][0-9]*\/[1-9][0-9]*$/.test(cell)) reject('expected a top-level invocation coordinate');
  const attempt = state.attempts?.[cell];
  if (state.contractVersion !== V22_CONTRACT || state.mission?.confirmation?.status !== 'confirmed'
    || attempt?.status !== 'blocked' || !attempt.context || !attempt.evidenceManifest
    || attempt.expected?.goalVersion !== state.mission.version) reject(`${cell} has no sealed blocked invocation for this confirmed mission`);
  const [step, parallel] = cell.split('/').map(Number), ref = `step-${step}/parallel-${parallel}`;
  if (attempt.requestRef !== `${ref}/request/request.json` || attempt.responseRef !== `${ref}/response/response.json`) reject('accepted file coordinates differ');
  const branch = path.join(session, ref);
  const relative = path.relative(await realpath(session), await realpath(branch));
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) reject('accepted branch escaped its session');
  const sealed = await evidenceManifestErrors(branch, attempt.evidenceManifest);
  if (sealed.length) reject(sealed.join('\n'));
  const request = JSON.parse(await readFile(path.join(branch, 'request/request.json'), 'utf8'));
  const response = JSON.parse(await readFile(path.join(branch, 'response/response.json'), 'utf8'));
  if (request.sessionId !== state.id || request.contractVersion !== V22_CONTRACT || response.contractVersion !== V22_CONTRACT
    || [request, response].some(value => value.step !== step || value.parallel !== parallel || value.exchange != null || value.operatorId !== attempt.operatorId)
    || response.sessionId != null && response.sessionId !== state.id
    || state.steps?.[cell] !== attempt.operatorId) reject('request, response and ledger identity differ');
  if (!attempt.id || !Number.isInteger(attempt.number) || attempt.number < 1
    || [request, response].some(value => value.attempt?.id !== attempt.id || value.attempt?.number !== attempt.number)
    || request.attempt.kind !== attempt.kind || request.attempt.previous !== attempt.previous
    || request.expected?.version !== attempt.expectedVersion || response.attempt.expectedVersion !== attempt.expectedVersion
    || !same(request.expected, attempt.expected) || hash(JSON.stringify(request.expected)) !== attempt.expectedHash
    || !same(request.frozenInputs, attempt.frozenInputs)) reject('accepted attempt or frozen expectation differs');
  const historical = invocationState(session, state, request);
  if (historical.steps?.[cell] !== attempt.operatorId || !historical.chain?.some(step => step.includes(cell))
    || historical.mission.confirmation?.status !== 'confirmed'
    || scopeHash(historical.mission) !== scopeHash(state.mission)
    || !same(historical.mission.confirmation, state.mission.confirmation)
    || !same(historical.mission.bankRef, state.mission.bankRef)
    || !same(historical.choices?.[state.mission.confirmation.decisionId], state.choices?.[state.mission.confirmation.decisionId])) reject('blocked invocation belongs to a different confirmed scope');
  if (response.status !== 'blocked' || !/^[A-Z][A-Z0-9_]*$/.test(response.stop ?? '')
    || !response.comparison || response.comparison.next !== 'blocked'
    || !['mismatched', 'inconclusive'].includes(response.comparison.verdict)
    || response.comparison.expectedVersion !== attempt.expectedVersion
    || !same(response.comparison, attempt.comparison)) reject('response is not the accepted blocked comparison');
  const start = Date.parse(attempt.startedAt), end = Date.parse(attempt.endedAt), observed = Date.parse(response.actual?.observedAt);
  if (![start, end, observed].every(Number.isFinite) || end < start || observed < start || observed > end
    || response.actual.expectedVersion !== attempt.expectedVersion) reject('accepted observation is not bound to its completed attempt');
  return response;
}
