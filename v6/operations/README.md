# Operations

An operation is a reusable, typed transformation with eight required files:

- `input.md`: accepted evidence and preconditions.
- `input.schema.json`: closed input JSON Schema.
- `output.md`: emitted artifact and status.
- `output.schema.json`: closed output JSON Schema.
- `operation.json`: routing, knowledge, side-effect, and stop metadata only.
- `execute.md`: ordered decisions, boundaries, side effects, and stop conditions.
- `validate-input.mjs`: fail-closed input validation before any processing.
- `validate-output.mjs`: fail-closed output validation before the chain may continue.

Operations do not choose when they run. The app graph routes an artifact envelope to exactly one operation, wait state, or terminal state.

Invalid input stops at the boundary without side effects. Invalid output is never emitted or routed downstream.

Input and output schemas are independent files. `operation.json` binds their exact filenames; the app validator refuses missing, extra, or cross-direction contract files.
