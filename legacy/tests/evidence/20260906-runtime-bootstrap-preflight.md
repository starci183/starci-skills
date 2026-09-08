# Runtime bootstrap must remain reachable after preflight

Two independent observations exposed the same planner contradiction.

1. A live mission for a newly routed product planned `environment.preflight`, two workspace bindings and a later `runtime.serve`. The registry correctly had no entries for the new product. Preflight therefore terminated on the missing entries, while the only operator authorized to create them remained downstream of the terminated branch. Installing dependencies and making the container daemon reachable cleared the host walls but could not create the registry entries without violating the runtime owner's exclusive write boundary.
2. The planner's synthetic surface chain reproduced the same topology without product state: adding `runtime.serve` made preflight require every bound runtime role, and the planner made every later node depend on that preflight. No valid chain ordering could reach the producer whose output the opening requirement demanded.

The correction is in the planner, the one home of preflight presets. A chain that contains `runtime.serve` opens by checking declarations and host capabilities with `runtimeRoles: []`; after workspace binding, `runtime.serve` inventories, creates and attests the generation before its consumers. A chain that observes or walks an existing runtime without owning `runtime.serve` continues to preset every bound role, so the change does not turn missing runtime evidence into readiness.

Regression coverage lives in `scripts/plan-chain.spec.mjs`: the existing consumer-only surface case retains `runtimeRoles`, while the bootstrap-owner case requires an empty list and a valid `preflight -> bind -> source -> runtime.serve` order.
