# Execute self-upgrade

Freeze fixtures, acceptance references, required diagnostic layers, metrics, and the two-consecutive-
pass stability policy before execution. Run `quality/integration` against the actual output before
reading producer rationale. One pass enters a fresh stability check; two consecutive passes are
required before a no-change result can close.

On any wrong or inconsistent output, run `quality/workflow-diagnose` across every required layer:
objective/scope, inputs, prompts, state machine, execute logic, knowledge, Grammar/UI when applicable,
validation, output contract, tool/model boundary, and proof. Missing evidence is a finding. Classify
the smallest owner; do not average findings into a broad rewrite.

`calibrate` records the diagnosis and blocks because it has no owner-mutation authority. `upgrade`
repairs exactly one approved owner with `quality/finding-repair`, reruns the same acceptance contract,
and again requires a second fresh consecutive pass. Retry at most three repairs. Repeated fingerprints,
boundary drift, stale evidence, or a third failed retry blocks. Only then may `quality/delivery-proof`
close the mission.
