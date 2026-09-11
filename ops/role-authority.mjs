/** Generated authority documents share the same capability owner as operator contracts. */
export function authorityFor(op) {
  const authority = {
    schema: 'starci/op-authority@1', op: op.id,
    primary: {
      owns: ['the selected matrix cell result', 'its final response and required criteria'],
      reads: op.reads.map(x => x.id), writes: op.writes.map(x => ({ id: x.id, path: x.path })),
      allowedEffects: op.sideEffects,
      canAdvanceWorkflow: false,
      maxSecondary: 3,
      calls: [],
      rules: ['Use existing request authority only.', 'Preserve business expectations and criteria.', 'The executing task\'s workflow runner, not this op, validates the cell response and advances within the approved workflow. The Plan coordinator owns goal approval and complete-result acceptance, not per-cell execution.']
    }
  };
  if (op.executionModes) {
    authority.primary.selection = 'required-exactly-one';
    authority.primary.modes = Object.fromEntries(Object.entries(op.executionModes).map(([name,contract])=>[name,{reads:contract.reads.map(r=>r.id),writes:contract.writes,allowedEffects:contract.sideEffects,completionProfile:contract.completionProfile}]));
    authority.primary.rules.push('Select exactly one mode; its permissions and profile replace the selector envelope. Never union permissions or chain modes.');
  }
  if (op.id === 'interface.implement') {
    authority.primary.calls = [
      { op: 'architecture.decide', role: 'implementation.architecture', authority: 'secondary.json' },
      { op: 'backend.implement', role: 'interface.backend', authority: 'secondary.json' }
    ];
    authority.primary.rules.push('A design gap pauses implementation and delegates the SDS correction to the separately owned architecture.decide secondary; after accepted integration, resume implementation from the new design revision.');
    authority.primary.rules.push('Wait for every secondary response; then inspect returned changes and rerun affected FE integration/render checks before final response.');
  }
  if (op.id === 'backend.implement') {
    authority.primary.calls = [
      { op: 'architecture.decide', role: 'implementation.architecture', authority: 'secondary.json' }
    ];
    authority.primary.rules.push('A design gap pauses implementation and delegates the SDS correction to the separately owned architecture.decide secondary; after accepted integration, resume implementation from the new design revision.');
  }
  return authority;
}
