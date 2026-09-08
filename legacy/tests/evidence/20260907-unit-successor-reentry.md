# Unit dependency successor evidence

The isolated candidate starts at published runtime commit
`5f874f80bac7617c19de75173f951e5e1c80ec8a`. Its implementation remains in
`scripts/plan-history.mjs`: new retry projections rewire unopened unit dependency edges, and
existing sealed forecasts resolve an exact same-unit retry lineage through its immutable opening
authority. Fresh unit consumption also uses the existing current producer delivery guard.

## Observed failure

A retained native forecast had ordinary dependencies pointing to an accepted retry while its unit
dependency still named the original failed source. The chain contained source invocations 34, 35
and 39. Only 39 was matched. The old unit gate checked 34 directly and refused the downstream unit.

The candidate's read-only probe resolved three dependencies as 32 to 32, 34 to 39, and 36 to 36.
The plan admission result contained no errors. It compared 18 retained state, plan, request and
response files before and after the probe; every byte digest was unchanged. The aggregate inventory
digest was `491a03cecdab24e60fdd5326c6b3c7c08e197979996815df7c9bb20c5f783526`.
This observation validates the gate, and does not authorize dispatching a subsequently superseded
native request.

## Candidate verification

The regression fixture uses current accepted architecture and backend plan outputs, real Node
tests, official attempt gates, failed normal source commits, and a matched normal retry commit.
It retains the older unopened unit edge to exercise read-time compatibility without rewriting
accepted evidence. Negative cases alter request bytes or the sealed retry relationships and must
refuse credit.

The first RC.11 lineage run refused a malformed retry graph with `GOAL_PARTITION_UNBOUND` but the
test assertion omitted that precise code. Its failed log remains preserved in the support folder.
The assertion now includes that existing semantic refusal, without changing the production gate.

The retirement fixture then exposed a separate admission deadlock. A typed read-only source review
depended on one accepted unit, but `partitionAdmissionErrors` required completion of that unit's
entire delivery set. The reviewed member was deliberately pending the diagnostic. The existing
source-review request gate now validates this exact diagnostic once before the partition gate permits
it to inspect its subject. It grants no delivery credit. Ordinary quality still waits for the entire
set; an incorrect source Input, missing changed method or product write request is refused.

| Verification | Terminal result |
| --- | --- |
| `node --test scripts/unit-successor.spec.mjs` | 1 passed, 0 failed, 0 skipped; 201070.2945 ms |
| `node --test scripts/unit-successor-review.spec.mjs` | 1 passed, 0 failed, 0 skipped; 197749.3845 ms |
| `node --test scripts/goal-partitions.spec.mjs` | 1 passed, 0 failed, 0 skipped; 83701.1967 ms |
| `npm run docs:check` | All 76 generated files match |

The lineage run includes the current-delivery guard and predates the narrow diagnostic admission
join. The retirement and nineteen-member partition runs use the final join. Their support manifest
records the exact helper and log hashes separately. The retirement run accepts an ordinary nonretry
unit before review, preserves its historical proof during pending and genuinely red diagnostic
states, accepts a new normal source repair commit with the missing regression, keeps the original
source retired, and opens the consumer using only the repaired unit. Original attempt state,
request and response bytes, and the accepted units artifact remain unchanged.

These are isolated runtime and disposable-source fixture proofs. The native observation was
read-only. Full combined-suite, package and publication verification belong to the release owner.
