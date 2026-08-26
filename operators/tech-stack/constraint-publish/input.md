# `tech-stack/constraint-publish` input

## JSON architecture

`provided` actively supplies project, objectiveRef, stackModelRef. `loads` passively binds only compatibilityReceiptRef, approvalReceiptRef at execution time. `session` owns ephemeral input, output and scratch references; bodies are never copied into the parent skill.
