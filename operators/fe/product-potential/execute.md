# Execute `fe/product-potential`

Reconstruct the required user-outcome flow for one closed frontend target without treating the
incumbent product as the scope ceiling. Compare every observed capability and every required flow
relation with that outcome, then return one exhaustive capability delta:

- `KEEP` only when the capability and its place in the flow are evidence-backed;
- `ADD` when a missing capability or relation is required to complete the outcome;
- `CHANGE` when a capability exists but has the wrong behavior, ownership, placement, or effect;
- `REMOVE` when it is redundant, contradictory, misleading, or has no defensible user purpose.

Model relations explicitly. A sequence such as `A -> B -> C` is incomplete when a node, transition,
feedback path, recovery path, or terminal outcome is absent; do not call the visible fragments a
complete feature. Challenge additions as strictly as removals: novelty without an authority-backed
outcome is `REMOVE`, not product potential.

Classify the smallest likely owner of every delta as `frontend`, `business`, `backend`, or
`cross-domain`. This operator reports owner and evidence only. It does not route, call another
operator, persist a session, choose a design direction, or mutate source. The parent Skill alone
decides the next operator or peer Skill.

Use only the closed `context` and `input`. Return one typed `output.outcome` plus this job's result,
gaps, and evidence. When the evidence cannot classify the full target, return `blocked`; never hide an
unclassified capability inside prose.

Frontend creation follows `AI-first -> Rules-first -> Grammar-last`. UX synthesis, UI-direction synthesis, principle/law compilation, layout compilation, Grammar application, implementation, and audit are separate jobs. Audit jobs observe and report; they never repair source.
