# Implementation output

The output validates against `output.schema.json` and records every source mutation.

A successful run emits `seed.materialize / ready` with `source-written`. It includes:

- the exact changed files;
- the source change-set reference and hash;
- the effective contracts consumed;
- every lower-tier extension actually used;
- static check receipts needed before business-state materialization.

A blocked run emits `code.result / blocked` with machine-readable stop reasons and no claim of completion.

The output does not approve visual proof. Source existence is only the prerequisite for Product Seed and Product Proof.
