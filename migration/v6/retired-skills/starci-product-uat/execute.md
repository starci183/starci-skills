# Execute starci-product-uat

1. Accept only a validated global `selection` for this skill, validate the complete input, run local `analyze-input`, then enter fixed state `coverage`. Treat an omitted `selection.mode` as `gated`.
2. Load only the current state's operator interface and resolve only its declared context through default search or exact references.
3. Validate the operator's closed `context + input`, execute its one job, validate the typed `output`, then let the Skill machine route through exactly one matching edge.
4. Keep selection, operator data, context, observations, plans and receipts in task-session memory only. On a loop, compare the prior fingerprint, reuse approved identities and reload only the re-entered operator. Block repeated no-progress fingerprints.
5. In `gated` mode, wait states stop before irreversible work and accept only the displayed revision or command. In `bypass` mode, do not pause: bind the currently displayed revision to an ephemeral bypass-authorization receipt and continue only to `approval.bypassTarget`; never describe that receipt as human approval.
6. At every terminal, validate the result, return it, and purge all task-session intermediates. Preserve only authorized product-source or external mutations.

## CONTEXT BY STATE

| State or phase | Allowed | Forbidden |
| --- | --- | --- |
| `coverage` | one feature index, its product-level decision branches, the selected approved flow graph, lower-level proof receipts, merge signatures and resource claims | source repair, business invention, component-state case inflation and screenshot verdicts |
| `case execution` | one predeclared case identity at a time, fresh account when applicable, isolated browser/runtime identity, exact fixture namespace and immutable checkpoint evidence | parallel visible-browser cases, undeclared accounts, account reuse, unscoped cleanup and post-journey outcome mutation |
| `verdict` | Behavior, UX or UI evidence owned by the current lens | borrowing another lens verdict or treating absence of failure as proof |
| `retest` | discovering checkpoint, full recovery path, all occurrences and canonical happy smoke | overwriting prior runs or closing user feedback without fresh evidence |
