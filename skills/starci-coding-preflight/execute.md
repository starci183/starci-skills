# Execute starci-coding-preflight

1. Accept only a validated global `selection` for this skill, validate the complete input, run local `analyze-input`, then enter fixed state `preflight`. Treat an omitted `selection.mode` as `gated`.
2. Load only the current state's operator contract. That operator alone retrieves its declared Qdrant knowledge.
3. Validate operator input, execute it, validate output, then route through exactly one matching edge.
4. Keep selection, operator data, context, observations, plans and receipts in task-session memory only. On a loop, compare the prior fingerprint, reuse approved identities and reload only the re-entered operator. Block repeated no-progress fingerprints.
5. In `gated` mode, wait states stop before irreversible work and accept only the displayed revision or command. In `bypass` mode, do not pause: bind the currently displayed revision to an ephemeral bypass-authorization receipt and continue only to `approval.bypassTarget`; never describe that receipt as human approval.
6. At every terminal, validate the result, return it, and purge all task-session intermediates. Preserve only authorized product-source or external mutations.

## CONTEXT BY STATE

| State or phase | Allowed | Forbidden |
| --- | --- | --- |
| `coding preflight` | exact target hashes, nearest declared templates, governing ESLint rules and TypeScript contracts | whole-repository scans, unrelated references and product-source mutation |
| `commit-triggered quality plan` | exact lint, typecheck and Sonar commands, commit or explicit activation, dependency order, parallel eligibility and time budgets | running gates during ordinary coding, unbounded waits, hidden check suppression and quality-gate weakening |
