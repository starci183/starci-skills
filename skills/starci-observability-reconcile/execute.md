# Execute starci-observability-reconcile

1. Accept only a validated global `selection` for this skill, validate the complete input, run local `analyze-input`, then enter fixed state `observability`.
2. Load only the current state's operator contract. That operator alone retrieves its declared Qdrant knowledge.
3. Validate operator input, execute it, validate output, then route through exactly one matching edge.
4. Keep selection, operator data, context, observations, plans and receipts in task-session memory only. On a loop, compare the prior fingerprint, reuse approved identities and reload only the re-entered operator. Block repeated no-progress fingerprints.
5. Wait states stop before irreversible work and accept only the displayed revision or command.
6. At every terminal, validate the result, return it, and purge all task-session intermediates. Preserve only approved product-source or external mutations.

## CONTEXT BY STATE

| State or phase | Allowed | Forbidden |
| --- | --- | --- |
| `inspect + plan` | exact service identities, current revisions and declared target metadata | product source, broad provider discovery and raw credentials |
| `approval + apply` | frozen delta, approval receipt and opaque handles | undeclared resources and new context |
| `proof or partial recovery` | declared probes, before/after receipts and bounded retry state | adjacent services and unrelated tenant data |
