# Gate 3 — principles

This is a linear executor. It consumes the exact accepted layout and every accepted block hash, then
emits one node/state/visual-rule plan. It never returns candidates or a recommendation. A missing
product decision returns `returned-to-owner` to Layout or Block.

Before Gate 4, enumerate every accepted visual decision as one stable `decisionId` scoped to a
render slot and concern. Emit one receipt per decision using the concern module's situation code,
classification inputs, exact element/className outcome and evidence. Run
`node <trust-root>/scripts/validate-principle-receipts.mjs --receipt <principles-output.json>`; missing
coverage, a made-up recipe or a className that differs from the selected principle row blocks the
chain. `null` is the only output for a principle row that emits no class.

Goal: [`GOAL.md`](GOAL.md).
