function readPath(value, dottedPath) {
  return dottedPath.split('.').reduce((node, part) => node?.[part], value);
}

export function conditionMatches(condition, envelope, input) {
  if (condition.stage !== undefined && envelope?.stage !== condition.stage) return false;
  if (condition.status !== undefined && envelope?.status !== condition.status) return false;
  if (condition.decision !== undefined && envelope?.payload?.decision !== condition.decision) return false;
  const facts = new Set(envelope?.facts ?? []);
  if ((condition.allFacts ?? []).some((fact) => !facts.has(fact))) return false;
  if ((condition.noneFacts ?? []).some((fact) => facts.has(fact))) return false;
  for (const [key, expected] of Object.entries(condition.inputEquals ?? {})) {
    if (readPath(input, key) !== expected) return false;
  }
  const output = envelope?.output ?? envelope?.trace?.actualOutput;
  for (const [key, expected] of Object.entries(condition.outputEquals ?? {})) {
    if (readPath(output, key) !== expected) return false;
  }
  return true;
}

export function nextState(machine, stateId, envelope, input) {
  const state = machine.states[stateId];
  if (!state) throw new Error(`unknown state ${stateId}`);
  if (state.kind === 'terminal') return null;
  if (state.kind === 'wait' && envelope?.type !== 'RESUME') {
    throw new Error(`${machine.id}/${stateId}: wait requires a typed RESUME receipt`);
  }
  const matches = (state.on ?? []).filter((edge) => conditionMatches(edge.when, envelope, input));
  if (matches.length !== 1) throw new Error(`${machine.id}/${stateId}: expected one route, matched ${matches.length}`);
  const target = matches[0].target;
  if (state.kind === 'wait' && target !== state.approval?.resumeTarget) {
    throw new Error(`${machine.id}/${stateId}: RESUME target differs from declared authority target`);
  }
  return target;
}
