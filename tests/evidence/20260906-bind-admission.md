# Bind admission at first freeze and read-only prerequisites

The current Landing workflow exposed two independent boundaries on 2026-09-06: business planning required a declared backend read context outside frontend product-write impact, and session checkout request validation demanded the stored hash before attempt-gate could record it. No product source or execution receipt was rewritten to resolve either.

The read-only bind must be an actual planned prerequisite of a confirmed delivery operator with the required authored Context. It resolves the declared canonical route with no source write roots or environment writes. A later product writer still needs the role in confirmed discovery.

The first session checkout freeze uses the existing owning session mutation, with an exact unopened coordinate and request body; the attempt gate retains its before/after byte comparison and atomic state replacement. Opening outside that context, changed bodies and existing attempts do not borrow this admission. Ordinary request and receipt validation require the stored hash.

Proof: 15 checkout regressions (including the complete official opener) and 22 related current runtime/workflow/lock regressions passed with no skips; operator/template validators and 76 generated docs passed. The coordinating task independently checked the actual Landing backend prerequisite on the full host and received zero errors. A sandbox-only probe could not read Git ownership and correctly refused; no Git trust setting was broadened. Actual attempt opening and the combined release suite are performed by their owners after reviewed adoption.
