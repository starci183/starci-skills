# Orchestration

Orchestration controls how an operator executes; it never chooses the next skill state, changes business authority, widens a write boundary, or grants approval.

The operator input binds one mode from `modes/` and one provider mapping from `providers/`. Modes describe provider-neutral concurrency. Provider files map those limits to runtime model aliases. A runtime must reject an unavailable alias rather than silently substitute a stronger, more expensive, or differently capable model.

Workers are read-only unless an operator contract explicitly grants a disjoint write target. `be/implementation` grants no worker source writes: only its coordinator may apply product-source changes.

All prompts, worker observations, joins, operator inputs, operator outputs, receipts, and scratch objects are task-session data. The parent skill runtime purges them at every terminal state. Orchestration must not create a filesystem run directory or durable transcript.
