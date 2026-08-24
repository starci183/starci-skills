# Execute starci-frontend-maintenance-apply

1. Accept only a validated global `selection` for this skill, validate the complete input, run local `analyze-input`, then enter fixed state `maintenance-apply`.
2. Load only the current state's operator contract. That operator alone retrieves its declared Qdrant knowledge.
3. Validate operator input, execute it, validate output, then route through exactly one matching edge.
4. Keep selection, operator data, context, observations, plans and receipts in task-session memory only. On a loop, compare the prior fingerprint, reuse approved identities and reload only the re-entered operator. Block repeated no-progress fingerprints.
5. Wait states stop before irreversible work and accept only the displayed revision or command.
6. At every terminal, validate the result, return it, and purge all task-session intermediates. Preserve only approved product-source or external mutations.

## CONTEXT BY STATE

| State or phase | Allowed | Forbidden |
| --- | --- | --- |
| `route + target verification` | project route, approved target refs, source/contract hashes and receipt headers | business bodies, broad Qdrant and repository scans |
| `audit or reconcile` | exact component/surface contracts, selected Grammar pair and closed consumer refs | other Grammar packages, unrelated consumers and raw business context |
| `approval + mutation` | frozen decision hash, exact files and approval receipt | new discovery, undeclared files and scope expansion |
| `proof + learning` | changed-file receipts, focused checks and one durable learning request | session scratch and unrelated design history |
