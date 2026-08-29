# Execute starci-architecture-discover

1. Accept only a validated global `selection` for this skill, validate the complete input, run local `analyze-input`, then enter fixed state `evidence`. Treat an omitted `selection.mode` as `gated`.
2. Load only the current state's operator interface and resolve only its declared context through default search or exact references.
3. Validate the operator's closed `context + input`, execute its one job, validate the typed `output`, then let the Skill machine route through exactly one matching edge.
4. Keep selection, operator data, context, observations, plans and receipts in task-session memory only. On a loop, compare the prior fingerprint, reuse approved identities and reload only the re-entered operator. Block repeated no-progress fingerprints.
5. In `gated` mode, wait states stop before irreversible work and accept only the displayed revision or command. In `bypass` mode, do not pause: bind the currently displayed revision to an ephemeral bypass-authorization receipt and continue only to `approval.bypassTarget`; never describe that receipt as human approval.
6. At every terminal, validate the result, return it, and purge all task-session intermediates. Preserve only authorized product-source or external mutations.

## CONTEXT BY STATE

| State or phase | Allowed | Forbidden |
| --- | --- | --- |
| `route + business freshness` | route, commits, hashes and receipt headers | raw source and unrelated business bodies |
| `frame + current state` | exact business projection, canonical coding-context candidates and architecture law | raw source files and whole indexes |
| `alternatives + challenge` | frozen constraints and two-to-four candidate summaries | reloading business, source or unrelated knowledge |
| `selection + handoff` | option-set hash, selected decision and approval receipt | unselected bodies and new discovery |
