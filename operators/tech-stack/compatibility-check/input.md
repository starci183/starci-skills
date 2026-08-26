# `tech-stack/compatibility-check` input

## JSON architecture

`provided` actively supplies project, objectiveRef, stackModelRef. `loads` passively binds only compatibilityEvidenceRefs, deploymentEvidenceRefs at execution time. `session` owns ephemeral input, output and scratch references; bodies are never copied into the parent skill.
