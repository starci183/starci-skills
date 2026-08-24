# Product Seed output

The output validates against `output.schema.json`.

A successful result emits `test.unit / ready` with `seed-evidence`. It provides one materialization receipt per required business state, including the exact setup operation, observable locator, reset operation and evidence reference.

A blocked result emits `seed.result / blocked`. It identifies every state that could not be materialized and why. No downstream visual or interaction proof may claim coverage for that state.

The receipt is evidence that a state can be reproduced. It is not permission to change business truth, broaden test data access or write production data.
