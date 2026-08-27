# Orchestration

Orchestration controls how an operator executes; it never chooses the next skill state, changes business authority, widens a write boundary, or grants approval. Task-scoped `selection.mode` (`gated` or `bypass`) is a separate machine-routing policy owned by `skills/route-machine.mjs`; it is not an orchestration concurrency mode.

The operator input binds one mode from `modes/` and one provider mapping from `providers/`. Modes describe provider-neutral concurrency. Provider files map those limits to runtime model aliases. A runtime must reject an unavailable alias rather than silently substitute a stronger, more expensive, or differently capable model.

Workers are read-only unless an operator contract explicitly grants a disjoint write target. `be/implementation` grants no worker source writes: only its coordinator may apply product-source changes.

`maxWorkers` is a ceiling, never a target. Before spawning, the coordinator hashes the exact assignment refs and counts truly independent items. It reuses a matching task-session observation instead of spawning again. It downgrades to a cheaper mode when the selected mode's `activation.minIndependentItems` is not met, assignments overlap, or the join would cost at least as much context as sequential execution. Empty workers and context-padding are forbidden.

Each worker receives only its assignment ID, exact refs/revisions, applicable rule IDs, and output schema. Workers never receive the whole prompt, conversation, repository context, another assignment, a credential handle, or an upstream artifact body that is not required for that assignment. The coordinator join contains only refs, revisions, concise findings, and coverage/conflict evidence.

All prompts, worker observations, joins, operator inputs, operator outputs, receipts, and scratch objects are task-session data. The parent skill runtime purges them at every terminal state. Orchestration must not create a filesystem run directory or durable transcript.
