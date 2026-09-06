# Business head projection

`projection.json` defines the complete generated file set. `templates/kinds/model.schema.json#/$defs/documentation` defines its authored content. The model is the machine authority; every authored section is stored in that model and covered by its self-fingerprint and immutable content address. Markdown files are projections and never independent authority.

A section body can be one Markdown string or an ordered array of Markdown blocks; blocks are joined with a blank line, so long sections remain complete within the schema limits.

The section bodies retain the complete confirmed scope as Markdown, including nested headings, tables, journeys, domain boundaries, decisions, coexistence and observable success, denial and failure cases. They are not summaries of the receipt. Each section names existing claims and coverage dimensions; intent and unresolved questions retain their claim kinds. The specification assembles every section without shortening or filtering it. The evidence projection contains the exact claims and coverage documents, whose fingerprints the model binds.

`scripts/business-head.mjs` reads this template to generate and byte-validate the bundle. `scripts/business-registry.mjs` archives the model and evidence and indexes the head with the existing JCS addresses. A first pending decision has no previous head; later publications name an archived previous object. A documented head cannot lose its documentation on reconciliation. Regenerate its views from the reconciled model and current evidence through `applyHeadPublication`.

To publish a decision, prepare the normal candidate response and run:

```text
node scripts/publish-business-head.mjs <session>/step-N/parallel-M
```

The publisher validates the candidate operator output before writing, requires its opened frozen attempt and concrete feature lease, resolves the project-partitioned businesses alias through the owning Workflow and session project, checks its registered Git worktree while preserving its lock state, and serializes registry changes. It writes the generated bundle and archives before advancing the index; readback must validate before the attempt can be accepted. A stale registry plan or lineage refuses publication. No command initializes a competing registry, relocates existing authority, or changes product source.

Historical models without documentation remain readable. A new `business.decide` output requires the documented shape; existing heads are converted only by an authorized decision, preserving their original archived bytes.

Sources: [business head observations](../../tests/evidence/20260906-business-head-bundle.md).
