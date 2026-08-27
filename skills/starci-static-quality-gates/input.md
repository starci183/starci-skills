# starci-static-quality-gates input

Provide one closed invocation validated by `input.schema.json`. The required `selection` object is the ephemeral output of global `/analyze-input.md`; it selects this skill directly. The trigger is evidence for activation only; both values execute the same fixed lint, typecheck and Sonar flow.
