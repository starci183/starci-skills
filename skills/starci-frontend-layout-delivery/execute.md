# Execute starci-frontend-layout-delivery

1. Accept only a validated global `selection` for this skill, validate the complete input, run local `analyze-input`, then enter fixed state `route`.
2. Load only the current state's operator contract. That operator alone retrieves its declared Qdrant knowledge.
3. Validate operator input, execute it, validate output, then route through exactly one matching edge.
4. Keep selection, operator data, context, observations, plans and receipts in task-session memory only. On a loop, compare the prior fingerprint, reuse approved identities and reload only the re-entered operator. Block repeated no-progress fingerprints.
5. Wait states stop before irreversible work and accept only the displayed revision or command.
6. At every terminal, validate the result, return it, and purge all task-session intermediates. Preserve only approved product-source or external mutations.

## CONTEXT BY STATE

| State or phase | Allowed | Forbidden |
| --- | --- | --- |
| `route + staleness` | route, commit, revision, receipt and hash metadata | business body, Qdrant bodies, source files |
| `business initialize` | exact evidence and business lifecycle law only after stale decision | frontend knowledge and coding context |
| `preflight` | request, route and fresh-business receipt headers | all semantic bodies |
| `customer journey` | fresh business journey projection + fe.customer-journey | Principles, Grammar, coding context, raw source |
| `page + state` | selected journey + exact business slice + one operator law | other directions and source |
| `context sync` | metadata first; changed generated JSON/knowledge only on hash miss | unchanged bodies and model-visible raw source |
| `source fit + Principles + layout + Grammar` | approved session refs + exact Qdrant records + canonical JSON candidates | whole indexes, unrelated features, raw source |
| `coding scope freeze` | approved refs, canonical candidate records, exact file headers | file bodies and repository scans |
| `implementation + proof` | only frozen exact files, commands, seeds and receipts | undeclared files, broad Qdrant, unrelated business |
