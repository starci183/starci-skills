# starci-workflow-handoff input

Provide one closed invocation validated by `input.schema.json`. The required `selection` object is the ephemeral output of global `/analyze-input.md`; it selects this skill directly. The mode is explicit: publish creates the portable checkpoint; resume verifies and adopts one exact checkpoint before emitting the next capability.
