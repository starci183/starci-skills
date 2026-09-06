# Nested review return and integrity re-review

On 2026-09-06, an accepted architecture parent at Accounting 26/1 waited for its nested
critique. The critique executed successfully and selected `return`, with three failed attacks.
The operator already required a new attempt for a failing candidate, but the forecast editor
accepted only blocked parents; the waiting-resolution gate accepted only mismatched or
inconclusive child executions. A successful review that returns a candidate therefore could not
reach the existing repair procedure without rewriting accepted evidence.

The owning task separately disclosed replacing the review's observation timestamp with an
estimated value. That admission makes its provenance disputed. Filesystem modification time is
not proof of execution time, and this change does not reinterpret or rewrite the accepted record.
The owner prepared an exact session-bound disclosure identifying the original parent and child.

The existing resolved-waiting gate now binds a declared kind return to a fresh same-operator
invocation. An explicit integrity variant retains the disclosure bytes and their digest inside
the immutable forecast. It grants only a fresh review within the already confirmed scope. Neither
the disclosure nor the old review can become a typed delivery input or supply completion proof.
The original parent and child remain sealed; a planned replacement stays an outstanding obligation.

`scripts/nested-return.spec.mjs` runs a complete isolated lifecycle using the real open, accept,
forecast preview/commit and worker-resume gates: accepted source binding, actual restatement
answer, waiting parent, matched return, new parent, fresh nested review and completed architecture.
It separately exercises integrity re-review, premature completion, unexecuted forecast closure,
disclosure-as-input, mutated disclosure/identity, keep-as-return, forged and stale review bindings,
and preservation of the original accepted bytes. These are runtime regression fixtures, not product
architecture approval or UAT.

The actual Accounting preview from the isolated candidate correctly refused with
`WORKFLOW_OWNER_INVALID`: that candidate directory is not the session's bound shared Source.
No authority override or actual ledger mutation was used. The publisher must run the real preview
from the guarded-adopted Source before publication. Final test logs and exact candidate hashes are
kept in the owning upgrade support directory; this note does not claim publication.
