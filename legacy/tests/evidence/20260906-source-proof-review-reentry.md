# Source proof review re-entry

Observed on 2026-09-06 against runtime 2.5.0-rc.7. This is an enforcement correction in the existing workflow retry home, not a new source-output contract.

Accounting invocation 35/1 retained a blocked INVALID_INPUT receipt after a real single normal commit, 1068292133b3a1f8354685ef13c49267e2974f01. Its required optional-provenance-claim criterion remained inconclusive because the PostgreSQL test did not prove the intended first attachment case. The source-history correction correctly refused this normal window, but no same-unit proof-review correction was expressible. No sealed receipt was rewritten.

Independent invocation 36/1 then completed with accepted commit 733f373e46a24de07baa743245dee4a731022bc1. A correction must retain the original failed window while allowing a fresh current base descended from it. The accepted intervening work is not evidence that invocation 35 achieved its criterion.

The owning runtime is scripts/plan-history.mjs and workflows/README.md. Eligibility binds the exact non-passing required criterion to sealed declared evidence, a readable normal original source window, current checkout ancestry, unchanged mission/unit/effects, and a new request-side method whose bytes differ from every prior frozen input. The new invocation must pass its own source and evidence gates.

Focused regression logs are retained in the owning support folder v25-proof-review-reentry. The initial three tests passed. The final ancestry lifecycle passed after a negative-test assertion was corrected to recognize an earlier truthful missing-reflog refusal. It exercises an accepted independent source commit, a real normal merge, preview/commit/open, a changed frozen method, a new normal correction commit, full backend acceptance, and later HEAD movement with historical replay. Negative cases cover stale/non-ancestor revisions, unreadable or non-normal history, absent/optional/passing criteria, wrong stop or unresolved interaction, altered goal/unit/effects, unsafe method paths, renamed unchanged method bytes, and mutation of frozen method bytes.

The final release manifest records the exact full-suite and packed-install results separately. Fixture proof is not product UAT or proof that Accounting's correction has run. Mixed candidate/live module validation cannot establish a native preview verdict; the canonical Source preview is performed after guarded adoption. This candidate is an intermediate blocker fix, not completion of all 2.5 coordination work.
