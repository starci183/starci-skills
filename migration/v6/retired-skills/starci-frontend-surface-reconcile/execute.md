# Execute starci-frontend-surface-reconcile

1. Accept only a validated global `selection` for this skill, validate the complete input, run local `analyze-input`, then enter fixed state `surface-feedback-request`. Treat an omitted `selection.mode` as `gated`.
2. Load only the current state's operator interface and resolve only its declared context through default search or exact references.
3. Validate the operator's closed `context + input`, execute its one job, validate the typed `output`, then let the Skill machine route through exactly one matching edge.
4. Keep selection, operator data, context, observations, plans and receipts in task-session memory only. On a loop, compare the prior fingerprint, reuse approved identities and reload only the re-entered operator. Block repeated no-progress fingerprints.
5. In `gated` mode, wait states stop before irreversible work and accept only the displayed revision or command. In `bypass` mode, do not pause: bind the currently displayed revision to an ephemeral bypass-authorization receipt and continue only to `approval.bypassTarget`; never describe that receipt as human approval. Before an architecture approval wait, read and apply `../../operators/architecture/review-widget.md`; `architecture/decision-challenge` must emit a validated HTML preview and the host must render it through `visualize` before requesting `OK ARCHITECTURE`.
6. At every terminal, validate the result, return it, and purge all task-session intermediates. Preserve only authorized product-source or external mutations.

## CONTEXT BY STATE

| State or phase | Allowed | Forbidden |
| --- | --- | --- |
| `surface audit + authority` | closed surface IDs, current authority/consumer revisions, observed inconsistency and proof-plan headers | unrelated surfaces, broad source and raw business context |
| `approval + reconcile` | frozen authority hash, exact authority and consumer targets, approval receipt and complete acceptance-plan identity | undeclared consumers, new discovery and scope expansion |
| `proof` | joined authority/source change receipt, deterministic seed/reset, declared commands, UI-quality receipt, browser/account handles and complete state-and-viewport evidence | partial proof, skipped scenarios, raw credentials and unrelated design history |
