# independent-critique — decision-id

## Execution

| Field | Value |
| --- | --- |
| Reviewer execution | the fresh execution's own reference, never the author's |
| Inherited turns | none |
| Given | selected stack-model and frozen source snapshot, constraints and trade-off axes; no author rationale |
| Source snapshot | sha256 digest of request/source-review.json |
| Independent alternative | a materially different ownership or failure-boundary design and why it may fit better |
| Trade-offs | compare the independent alternative using each frozen axis |
| Uncertainty | unmeasured assumptions and the observations needed to resolve them |

## Attacks

| Adverse path | Attack | Resolution | Verdict |
| --- | --- | --- | --- |
| partial-failure | [source:actual/observed/path] what breaks when one side completes | how the selected design survives it | holds |
| retry-idempotency | [source:actual/observed/path] what a repeated call does | how the design makes it idempotent | holds |
| concurrency | [source:actual/observed/path] what two writers do at once | how ownership serialises them | holds |
| stale-state | [source:actual/observed/path] what a reader sees after a change | how staleness is bounded | holds |
| deletion | [source:actual/observed/path] what deleting the owner's data leaves behind | how readers cope | holds |
| recovery | [source:actual/observed/path] what restoring from backup loses | what the restore path proves | holds |
| dependency-outage | [source:actual/observed/path] what an unavailable dependency does | how the boundary degrades | holds |
| rollback | [source:actual/observed/path] what undoing the migration costs | the rollback step and its proof | holds |

## Verdict

| Field | Value |
| --- | --- |
| Selection | keep |
