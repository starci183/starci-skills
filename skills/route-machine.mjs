export function conditionMatches(condition, envelope, input) {
  if (condition.stage !== undefined && envelope?.stage !== condition.stage) return false;
  if (condition.status !== undefined && envelope?.status !== condition.status) return false;
  if (condition.decision !== undefined && envelope?.payload?.decision !== condition.decision) return false;
  const facts = new Set(envelope?.facts ?? []);
  if ((condition.allFacts ?? []).some((fact) => !facts.has(fact))) return false;
  if ((condition.noneFacts ?? []).some((fact) => facts.has(fact))) return false;
  for (const [key, expected] of Object.entries(condition.inputEquals ?? {})) {
    const actual = key.split('.').reduce((value, part) => value?.[part], input);
    if (actual !== expected) return false;
  }
  return true;
}

export function nextState(machine, stateId, envelope, input) {
  const state = machine.states[stateId];
  if (!state) throw new Error(`unknown state ${stateId}`);
  if (state.kind === 'terminal') return null;
  const mode = input?.selection?.mode ?? 'gated';
  if (!['gated', 'bypass'].includes(mode)) throw new Error(`${machine.id}/${stateId}: unknown approval mode ${mode}`);
  if (state.kind === 'wait' && mode === 'bypass') {
    const target = state.approval?.bypassTarget;
    if (!target || !machine.states[target]) throw new Error(`${machine.id}/${stateId}: invalid bypass target`);
    if (!(state.on ?? []).some((edge) => edge.target === target)) throw new Error(`${machine.id}/${stateId}: bypass target is not a declared wait route`);
    return target;
  }
  const matches = (state.on ?? []).filter((edge) => conditionMatches(edge.when, envelope, input));
  if (matches.length !== 1) throw new Error(`${machine.id}/${stateId}: expected one route, matched ${matches.length}`);
  return matches[0].target;
}

export function bypassApprovalReceipt(machine, stateId, input, revisionRef) {
  const state = machine.states[stateId];
  if (!state || state.kind !== 'wait') throw new Error(`${machine.id}/${stateId}: bypass receipt requires a wait state`);
  if ((input?.selection?.mode ?? 'gated') !== 'bypass') throw new Error(`${machine.id}/${stateId}: bypass mode is not active`);
  if (typeof revisionRef !== 'string' || revisionRef.length === 0) throw new Error(`${machine.id}/${stateId}: exact displayed revision is required`);
  const taskId = input?.runId;
  if (typeof taskId !== 'string' || !/^[A-Za-z0-9._-]+$/.test(taskId)) throw new Error(`${machine.id}/${stateId}: valid runId is required`);
  return {
    schemaVersion: 1,
    kind: 'bypass-authorization',
    source: 'selection.mode',
    mode: 'bypass',
    skillId: machine.id,
    stateId,
    revisionRef,
    target: state.approval.bypassTarget,
    ref: `session://tasks/${taskId}/approvals/bypass/${stateId}`,
    retention: 'until-skill-terminal'
  };
}
