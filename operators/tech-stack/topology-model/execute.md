# Execute `tech-stack/topology-model`

## Context

Read `context.inventoryRef` only at `context.inventorySha256`, plus the exact `context.businessConstraintRefs` and `context.approvedDecisionRefs`.

## Input

Bind the model to `input.project` and `input.objectiveRef`.

## Action

Produce one operational topology that separates observed facts from proposed targets and assigns every runtime, communication path, store, deployment unit, credential boundary, migrator, backup, restore, and operational owner required by the supplied constraints.

## Output

Return `output.outcome`, `output.stackModelRef`, `output.stackModelSha256`, `output.evidenceRefs`, `output.contradictions`, and `output.reason`.

## Stop

Return `revise` for a bounded contradiction that can be resolved by remodelling. Return `blocked` when inventory identity is invalid or no coherent topology can be produced.
