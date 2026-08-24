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
  const matches = (state.on ?? []).filter((edge) => conditionMatches(edge.when, envelope, input));
  if (matches.length !== 1) throw new Error(`${machine.id}/${stateId}: expected one route, matched ${matches.length}`);
  return matches[0].target;
}
