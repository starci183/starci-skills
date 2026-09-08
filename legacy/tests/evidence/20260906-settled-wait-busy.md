# Settled waiting history and subsequent replanning

On 2026-09-06, Accounting's preserved waiting architecture 26/1 had exactly one completed
replacement, 27/1. That replacement had a fresh matched KEEP critique, resumed through the normal
worker gate and completed successfully. A subsequent 28/1 restatement was accepted blocked and
its actual user answer recorded. Its preview succeeded, but committing that preview reported
PLAN_BUSY. A read-only comparison showed `missionCorrectionBusy=true` while the existing
`resolvedWaitingAttemptKeys` returned settled 26/1 with no errors and no active workers or leases.

The shared busy predicate now consumes that same verified settlement result. Damaged resolution,
unresolved waiting work, running attempts, workers and leases still block. A second successor for
the same waiting checkpoint is refused before preview can create a conflicting replacement.

The existing isolated nested-return lifecycle regression continues through a second accepted
restatement, its actual fixture answer and a successful subsequent preview/commit. It checks
forged or damaged successors, active execution and exact preservation of the earlier parent and
replacement. This is runtime regression evidence, not product completion or UAT. The actual
consumer comparison was read-only; no peer ledger or runtime was changed by the candidate work.
