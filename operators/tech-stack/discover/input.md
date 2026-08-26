# `tech-stack/discover` input

## JSON architecture

`provided` actively supplies project, objectiveRef, sourceFingerprint. `loads` passively binds only manifestRefs, configurationRefs, deploymentRefs at execution time. `session` owns ephemeral input, output and scratch references; bodies are never copied into the parent skill.
