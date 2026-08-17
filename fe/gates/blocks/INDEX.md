# Gate 2 — blocks

Block design starts only from a whitelisted layout hash. One named block produces 3–4 JSON render
candidates. A whole surface with `N` blocks produces `N` independent candidate sets, therefore
3–4 × N candidates; unrelated block choices are never bundled into page-wide combinations.

Every proposal makes the render reconstructible: role, title and description, reading order,
list/grid/table grammar, item fields and order, data sources, states, actions, copy slots,
responsive behavior, contract decision and pure/connected ownership split. The founder may approve
some blocks and continue altering the rest. Gate 3 opens only when every required block hash is
whitelisted.

Goal: [`GOAL.md`](GOAL.md). Contract: [`gate.schema.json`](gate.schema.json). Cardinality owner:
[`laws/b14-proposals-are-per-block/`](laws/b14-proposals-are-per-block/).
