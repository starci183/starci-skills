# Execute `fe/finding-classify`

Classify the complete visual-fidelity or independent-review finding batch by each finding's smallest demonstrated owner. Fingerprint every finding, preserve one ordered ledger, and route one batched repair; never stop after the first visible defect. Round 3 and later findings remain routable while their progress fingerprint changes.

Start from the already-recorded pixel observation. Only now compare it with StarCi-native frontend
authority from `knowledge/ui.md`, the routed project Grammar, frozen product/business authority, and
the implementation evidence needed to locate cause. Do not reverse the visible finding merely because
the current implementation, Grammar, or knowledge says the render was intended.

Assign each finding to exactly one owner:

- `implementation`: authority is adequate and the rendered implementation violates it;
- `grammar`: the reusable Grammar contract creates or fails to prevent the contradiction;
- `ui-knowledge`: the shared principle is absent, contradictory, or demonstrably wrong across its
  intended boundary;
- `product-authority` or `business`: the desired visible meaning is not authorized;
- `backend`: the required product state or data cannot be produced by the current backend contract.

Return `repair` only for implementation-owned findings, `authority-repair` only for Grammar or UI
knowledge ownership, and the existing typed handoff outcome for business/backend ownership. There is
no `clean` outcome: this operator is reachable only from a validated visual repair verdict. Return only
this atomic classification; never repair or route internally. `blocked` is legal only when
classification itself lacks finite evidence or a required route is unavailable. A known implementation,
Grammar, UI-knowledge, business, product-authority, or backend owner is routable and therefore cannot
be converted to `blocked` here. Cross-domain outcomes must carry the matching typed handoff so the
parent can CALL that skill and resume the exact FE mission.
