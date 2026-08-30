# `fe/contract-freeze` output

- `output.outcome`: Typed result routed only by the parent Skill machine.
- `output.result`: This operator atomic product, or null when incomplete.
- `output.result.behaviorContract`: Executable preservation decisions for every observed interaction,
  plus surface owners, Grammar bindings, and responsive states carried into mutation and proof.
- `output.result.mediaDecision`: Exactly one `none`, `reuse`, or `generate` decision with its user
  purpose. Reused/generated media also freezes placement, asset/brief reference, responsive treatment,
  and alternative intent; `none` keeps those nullable and explains why media adds no value.
- `output.gaps`: Exact blockers or authority gaps.
- `output.evidenceRefs`: Exact evidence used.
- `output.handoff`: Typed cross-domain continuation, only when the outcome requires it.
