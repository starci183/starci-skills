# `context/freshness-check` input

## JSON architecture

`provided` supplies the expected project, context kind, source, generator and schema fingerprints. `loads.currentReceipt` passively supplies metadata for the current cached generation, never its body. `session` owns ephemeral input, output and scratch refs.
