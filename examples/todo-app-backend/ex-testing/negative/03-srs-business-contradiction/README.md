# 03 — business spec inconsistency: two `done` rules that cannot both be true

## The defect

`work/` holds two `work/business-rule` records, both `state: done`, that assert opposite product
law about pricing:

- `br.pricing.free-for-all` — "the product is free for every account; no cap may limit usage"
- `br.pricing.cap-required` — "every account has an active-task cap; exceeding it refuses writes"

Each declares `conflictsWith` the other, and **no `work/policy-decision` resolves the pair** — the
tree asserts a contradiction as settled fact. This is the "spec sai business" shape: an SRS layer
that contradicts itself while every record still says `done`.

## Which check must catch it

| Rule | Detector | Expected |
|---|---|---|
| declared conflict, both done, no deciding policy-decision | `node scripts/checks/check-work-consistency.mjs --tree <this>/work` | `CONFLICT_WITHOUT_DECISION` (refuse) |

## Known residual gap

If the two records contradicted each other in **prose only** — no `conflictsWith` edge authored —
no check reads the semantics and the pair would pass every gate. The corpus exercises the declared
form; the undeclared form is a detection gap noted for a later wave.

## Result

See `../_evidence/detection-*.txt` and the matrix in `../README.md`.
