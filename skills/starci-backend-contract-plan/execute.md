# Execute starci-backend-contract-plan

1. Accept only a validated global `selection` for this skill, validate the complete input, run local `analyze-input`, then enter fixed state `contract`. Treat an omitted `selection.mode` as `gated`.
2. Load only the current state's operator contract. That operator alone retrieves its declared Qdrant knowledge.
3. Validate operator input, execute it, validate output, then route through exactly one matching edge.
4. Keep selection, operator data, context, observations, plans and receipts in task-session memory only. On a loop, compare the prior fingerprint, reuse approved identities and reload only the re-entered operator. Block repeated no-progress fingerprints.
5. In `gated` mode, wait states stop before irreversible work and accept only the displayed revision or command. In `bypass` mode, do not pause: bind the currently displayed revision to an ephemeral bypass-authorization receipt and continue only to `approval.bypassTarget`; never describe that receipt as human approval.
6. At every terminal, validate the result, return it, and purge all task-session intermediates. Preserve only authorized product-source or external mutations.

## CONTEXT BY STATE

| State or phase | Allowed | Forbidden |
| --- | --- | --- |
| `route + freshness` | route, source commit, authority and coding-context hash metadata | business bodies, raw source and Qdrant bodies |
| `architecture + boundary planning` | exact business projection, canonical coding-context records and narrow operator knowledge | raw source files, whole indexes and unrelated modules |
| `approval + coding-scope freeze` | plan hash, source HEAD and exact target path/hash headers | file bodies and repository scans |
| `implementation` | approved boundary, exact frozen files and be.implementation knowledge | undeclared files, broad Qdrant and adjacent business |
| `quality + proof + reconcile` | changed-file receipts, declared commands, frozen pre-delivery receipt and immutable proof | new design context and unfrozen source discovery |
