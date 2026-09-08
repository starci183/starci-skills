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
      rules: ['Use existing request authority only.', 'Preserve business expectations and criteria.', 'The coordinator gate, not this op, accepts the response and advances the workflow.']
    }
  };
  if (op.executionModes) {
    authority.primary.selection = 'required-exactly-one';
    authority.primary.modes = Object.fromEntries(Object.entries(op.executionModes).map(([name,contract])=>[name,{reads:contract.reads.map(r=>r.id),writes:contract.writes,allowedEffects:contract.sideEffects,completionProfile:contract.completionProfile}]));
    authority.primary.rules.push('Select exactly one mode; its permissions and profile replace the selector envelope. Never union permissions or chain modes.');
  }
  if (op.id === 'interface.implement') {
    authority.primary.calls = [{ op: 'backend.implement', role: 'interface.backend', authority: 'secondary.json' }];
    authority.primary.rules.push('Wait for the secondary response; then inspect backend changes and rerun affected FE integration/render checks before final response.');
  }
  return authority;
}
