# `tech-stack/topology-model` input

## JSON architecture

`provided` actively supplies project, objectiveRef, inventoryRef. `loads` passively binds only businessConstraintRefs, approvedDecisionRefs at execution time. `session` owns ephemeral input, output and scratch references; bodies are never copied into the parent skill.
