# FE design journey

`starci-fe-design-plan` owns one resumable journey; the founder may alter, reject and approve
choices repeatedly. Before divergence, the FE workspace role's exact grammar resolves closed facts
through durable behavior evidence into mandatory surface, interaction, region and state decisions. The journey
advances only when current hashes and the grammar receipt are valid.

| Order | Gate | Contract | Divergence |
|---:|---|---|---|
| 1 | [`layouts`](layouts/) | One or more root/discovered surfaces → 3–4 layouts per surface | yes |
| 2 | [`blocks`](blocks/) | One accepted layout → 3–4 render proposals per block | yes |
| 3 | [`principles`](principles/) | Accepted layout/block hashes → one visual/node/state plan | no |
| 4 | [`patterns`](patterns/) | Exact principles hash → one source/change plan | no |
| 5 | [`lints`](lints/) | Exact source-plan hash + audits → one verdict/proof | no |

Every prompt, response, candidate, alteration, rejection and acceptance is immutable and hash-bound
by [`session.schema.json`](session.schema.json). Durable objects and status refs follow
[`registry.schema.json`](registry.schema.json). A missing product decision returns to `layouts` or
`blocks`; execution never invents a preference.

There is no implicit UI grammar. `context.grammar=<id>` resolves only
`.claude/grammars/<id>/grammar.json` and `profile.json`. Missing route, missing facts or a stale
receipt stops the journey. Layout and Block candidates may diverge only inside the legal space left
after grammar; they may not offer a plain mapped list beside an Accordion when grammar already
settled the interaction.

Target kinds are `page`, `layout`, `modal`, `drawer` and `overlay`. Accepting an `extends` edge queues
the dependent target through the same complete journey. Execute waits until every reachable layout
and block is accepted.
