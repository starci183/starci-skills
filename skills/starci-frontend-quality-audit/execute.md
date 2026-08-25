# Execute starci-frontend-quality-audit

1. Accept only a validated global `selection` for this skill, validate the complete input, run local `analyze-input`, then enter fixed state `audit`.
2. Load only the current state's operator contract. That operator alone retrieves its declared Qdrant knowledge.
3. Validate operator input, execute it, validate output, then route through exactly one matching edge.
4. Keep selection, operator data, context, observations, plans and receipts in task-session memory only. On a loop, compare the prior fingerprint, reuse approved identities and reload only the re-entered operator. Block repeated no-progress fingerprints.
5. Wait states stop before irreversible work and accept only the displayed revision or command.
6. At every terminal, validate the result, return it, and purge all task-session intermediates. Preserve only approved product-source or external mutations.

## CONTEXT BY STATE

| State or phase | Allowed | Forbidden |
| --- | --- | --- |
| `audit` | verified route receipt, closed surface refs, exact browser target, pinned fe.ui-quality-review knowledge and task-session evidence | business bodies, broad source context, external skill runtime and undeclared surfaces |
| `terminal` | quality receipt and evidence-linked rule findings only | screenshots, traces, raw observations and source mutations |
