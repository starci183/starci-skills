// Immutable scope and invocation context. State holds content addresses; execution never rewrites
// the bytes an earlier invocation was judged against.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { scopeHash, frozenScopeErrors } from './mission-scope.mjs';

const digest = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const encode = value => `${JSON.stringify(value, null, 2)}\n`;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const invocationKey = request => `${request.step}/${request.parallel}${request.exchange ? `/${request.exchange}` : ''}`;
export const missionChoiceSource = mission => mission?.confirmation?.authority?.kind === 'coordination-extraction' ? 'coordinator' : 'user';

export async function retainContext(session, kind, value) {
  const bytes = encode(value); const hash = digest(bytes);
  const ref = `runtime/history/${kind}/${hash.slice(7)}.json`;
  const file = path.join(session, ref);
  let ancestor = path.dirname(file);
  while (!existsSync(ancestor) && path.dirname(ancestor) !== ancestor) ancestor = path.dirname(ancestor);
  const relative = path.relative(realpathSync(session), realpathSync(ancestor));
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw Error('HISTORY_TAMPERED: context writer escaped the owning session');
  await mkdir(path.dirname(file), { recursive: true });
  try { await writeFile(file, bytes, { flag: 'wx' }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; if (readFileSync(file, 'utf8') !== bytes) throw Error('HISTORY_TAMPERED: immutable context address contains different bytes'); }
  return { ref, hash };
}

export function readContext(session, address, kind) {
  if (!address || !/^sha256:[a-f0-9]{64}$/.test(address.hash ?? '') || address.ref !== `runtime/history/${kind}/${address.hash.slice(7)}.json`) throw Error('HISTORY_UNBOUND: expected an exact immutable context address');
  const file = path.join(session, address.ref);
  const relative = path.relative(realpathSync(session), realpathSync(file));
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw Error('HISTORY_TAMPERED: context escaped the owning session');
  const bytes = readFileSync(file);
  if (digest(bytes) !== address.hash) throw Error('HISTORY_TAMPERED: context bytes differ from their frozen hash');
  return JSON.parse(bytes);
}

export async function retainMission(session, state, { root, mission = state.mission } = {}) {
  const choice = state.choices?.[mission?.confirmation?.decisionId];
  const errors = frozenScopeErrors({ ...state, mission }, root ? { root } : {});
  if (!choice || choice.selected !== 'as-stated' || choice.selectedBy !== missionChoiceSource(mission) || !choice.sourceRef || choice.sourceRef !== mission.confirmation?.sourceRef) errors.push('MISSION_HISTORY_UNBOUND: confirmed scope requires its exact retained authority');
  if (errors.length) throw Error(errors.join('\n'));
  state.missionSnapshots ??= {};
  const value = { version: 1, sessionId: state.id, mission, choice };
  const existing = state.missionSnapshots[mission.version];
  if (existing) {
    const frozen = readContext(session, existing, 'missions');
    // mission.scope is a derived coverage census, excluded by the scope owner from its hash.
    if (scopeHash(frozen.mission) !== scopeHash(mission) || !same(frozen.mission.confirmation, mission.confirmation) || !same(frozen.choice, choice)) throw Error('MISSION_HISTORY_TAMPERED: a confirmed mission version cannot be overwritten');
    return existing;
  }
  return state.missionSnapshots[mission.version] = await retainContext(session, 'missions', value);
}

export function missionAt(session, state, version) {
  const record = readContext(session, state.missionSnapshots?.[version], 'missions');
  if (record.sessionId !== state.id || record.mission?.version !== version || record.mission.confirmation?.scopeHash !== scopeHash(record.mission)) throw Error('MISSION_HISTORY_UNBOUND: scope identity or confirmation hash differs');
  const choice = record.choice;
  if (!choice || choice.selected !== 'as-stated' || choice.selectedBy !== missionChoiceSource(record.mission) || !choice.sourceRef || choice.sourceRef !== record.mission.confirmation.sourceRef) throw Error('MISSION_HISTORY_UNBOUND: snapshot contains no matching confirmation authority');
  return record;
}

export async function retainInvocation(session, state, request, { root, phase = 'opening' } = {}) {
  const mission = await retainMission(session, state, { root });
  const key = invocationKey(request);
  return retainContext(session, 'invocations', {
    version: 1, sessionId: state.id, attemptId: request.attempt.id, capturedAt: new Date().toISOString(), phase,
    requestHash: digest(readFileSync(path.join(session, `step-${request.step}`, `parallel-${request.parallel}`, ...(request.exchange ? [request.exchange] : []), 'request/request.json'))),
    mission, choices: state.choices, chain: state.chain, steps: state.steps, planned: state.planned ?? {},
    planRevision: state.planHistory?.active ?? null, key
  });
}

export function invocationState(session, state, request) {
  const key = invocationKey(request); const attempt = state.attempts?.[key];
  if (!attempt?.context) {
    if (request.expected?.goalVersion !== state.mission?.version) throw Error('MISSION_HISTORY_MISSING: this preserved invocation has no verified scope snapshot; it cannot be reused as current proof');
    return state;
  }
  const context = readContext(session, attempt.context, 'invocations');
  if (context.planRevision && !(state.planHistory?.revisions ?? []).some(address => same(address, context.planRevision))) throw Error('INVOCATION_HISTORY_UNBOUND: the frozen forecast revision was removed from history');
  const requestFile = path.join(session, `step-${request.step}`, `parallel-${request.parallel}`, ...(request.exchange ? [request.exchange] : []), 'request/request.json');
  if (context.sessionId !== state.id || context.key !== key || context.attemptId !== request.attempt?.id || context.requestHash !== state.requestHashes?.[key] || digest(readFileSync(requestFile)) !== context.requestHash) throw Error('INVOCATION_HISTORY_UNBOUND: invocation identity or frozen request bytes differ');
  if (!same(context.mission, state.missionSnapshots?.[request.expected?.goalVersion])) throw Error('INVOCATION_HISTORY_UNBOUND: invocation mission address is not the retained confirmed version');
  const record = missionAt(session, state, request.expected?.goalVersion);
  if (!same(context.choices?.[record.mission.confirmation.decisionId], record.choice)) throw Error('INVOCATION_HISTORY_UNBOUND: invocation choices do not include its actual scope confirmation');
  if (record.sessionId !== state.id || record.mission?.version !== request.expected?.goalVersion || record.mission.confirmation?.scopeHash !== scopeHash(record.mission)) throw Error('INVOCATION_HISTORY_UNBOUND: frozen invocation does not bind its confirmed mission');
  // A selection arrives after the blocked invocation: historical questions see their opening
  // choices, while a resumed invocation freezes the actual answer it was granted.
  return { ...state, mission: record.mission, choices: context.choices, chain: context.chain, steps: context.steps, planned: context.planned, lifecycle: { ...state.lifecycle, phase: 'active' } };
}

export function missionHistorySnapshotErrors(session, state) {
  const errors = [];
  for (const version of Object.keys(state.missionSnapshots ?? {})) {
    try {
      const record = missionAt(session, state, Number(version));
      if (!same(state.choices?.[record.mission.confirmation.decisionId], record.choice)) errors.push('MISSION_HISTORY_TAMPERED: retained goal answer was changed or removed');
      if (Number(version) === state.mission?.version && scopeHash(record.mission) !== scopeHash(state.mission)) errors.push('MISSION_HISTORY_TAMPERED: current scope differs from its immutable confirmation');
    } catch (error) { errors.push(error.message); }
  }
  for (const attempt of Object.values(state.attempts ?? {})) if (attempt.context) {
    try {
      const request = JSON.parse(readFileSync(path.join(session, attempt.requestRef), 'utf8'));
      const original = invocationState(session, state, request);
      for (const [id, choice] of Object.entries(original.choices ?? {})) if (!same(choice, state.choices?.[id])) errors.push(`MISSION_HISTORY_TAMPERED: user answer ${id} used by a dispatched invocation changed`);
    }
    catch (error) { errors.push(error.message); }
  }
  return errors;
}
