# Execute starci-workspace-ready

1. Accept only a validated global `selection` for this skill, validate the complete input, run local `analyze-input`, then enter fixed state `identity`. Treat an omitted `selection.mode` as `gated`.
2. Load only the current state's operator interface and resolve only its declared context through default search or exact references.
3. Validate the operator's closed `context + input`, execute its one job, validate the typed `output`, then let the Skill machine route through exactly one matching edge.
4. Keep selection, operator data, context, observations, plans and receipts in task-session memory only. On a loop, compare the prior fingerprint, reuse approved identities and reload only the re-entered operator. Block repeated no-progress fingerprints.
5. In `gated` mode, wait states stop before irreversible work and accept only the displayed revision or command. In `bypass` mode, do not pause: bind the currently displayed revision to an ephemeral bypass-authorization receipt and continue only to `approval.bypassTarget`; never describe that receipt as human approval.
6. At every terminal, validate the result, return it, and purge all task-session intermediates. Preserve only authorized product-source or external mutations.

## CONTEXT BY STATE

| State or phase | Allowed | Forbidden |
| --- | --- | --- |
| `identity + freshness checks` | project id, repository root, commit, config hashes and receipt headers | business bodies, default search bodies, product source bodies |
| `initialize one stale layer` | only that layer manifest and exact initializer interface | later workspace layers and product context |
| `route verification` | compiled route refs and hash metadata | business, design, source and deployment context |
