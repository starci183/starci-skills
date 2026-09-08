/** Contract selection only. This does not execute an agent, command or external effect. */
export function selectOperation(contract, operation) {
  if (!contract || typeof contract !== 'object') throw Error('Operator contract required');
  if (!contract.executionModes) {
    if (operation !== undefined) throw Error('This operator has no selectable mode');
    return structuredClone(contract);
  }
  if (typeof operation !== 'string' || !Object.hasOwn(contract.executionModes,operation)) throw Error('One known operation is required');
  const selected=structuredClone(contract.executionModes[operation]);
  return {...selected, operation};
}
