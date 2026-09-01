# Operators

## Version 7 contract

An operator performs exactly one job:

```text
operator(context, input) -> output
```

- `context` contains only revision-bound, read-only dependencies supplied by the runtime.
- `input` contains only the direct operand for this operator's one job.
- `output` contains only the typed result of that job, including its evidence or effects when the job produces them.

The Skill machine owns guards, branches, loops, waits, approvals, handoffs and the choice of the next state. The runtime owns session allocation, context lineage and cleanup. An operator neither invokes another operator nor emits routing state. Consequently a v7 operator contract never exposes the legacy `stage`, `status`, `facts`, `decision`, `state`, `emits`, or `cleanup` envelope.

When a job can observe more than one outcome, those values remain ordinary typed output data. The Skill machine compares exact output paths with `outputEquals`; the operator never names or selects the next state.

Every operator keeps eight required files:

- `input.md`: exact `context` and `input` field meanings and ownership.
- `input.schema.json`: closed v7 input JSON Schema.
- `output.md`: exact output field meanings and result invariants.
- `output.schema.json`: closed v7 output JSON Schema.
- `operator.json`: one job, optional exact source references, effects and stop conditions; never accepted/emitted routes or indexed-knowledge bindings.
- `execute.md`: the single action, its evidence boundary and its stop conditions, without workflow branches.
- `validate-input.mjs`: fail-closed validation before the action.
- `validate-output.mjs`: fail-closed validation before the result reaches the Skill machine.

An operator may additionally own one optional presentation asset at `icon.svg`. It is not executable
authority and never changes the eight-file contract. A v7 operator icon uses a `0 0 64 64` viewBox,
transparent background, and exactly the two StarCi colors `#7547FF` and `#F7C948`; it contains no
scripts, event handlers, external references, text, embedded raster data, or third color. The catalog
may render it decoratively beside the operator's visible name and must fall back safely when it is
absent.

A schema is not clear merely because it rejects extra keys. Each direct `context`, `input`, and `output` field has a semantic description, refs identify their artifact type and revision, and embedded artifacts are validated by their declared schema rather than accepted as free objects.

V7 has no default-search context path. The runtime uses the agent's default repository/file search, preferring `rg`, to resolve the smallest exact context set before invocation. The resolved files and revisions enter `context`; an operator never receives a generated knowledge summary, embedding result, default search generation, or `contextRefs` manifest entry.

Invalid input stops before the action or effects. Invalid output never reaches the Skill machine.

Broad repository source context is forbidden. Default search resolves exact files rather than preloading a repository or querying an index. Business authority comes from an exact `.worktrees/businesses/...` revision; source work opens only hash-pinned contract JSON or exact approved files. Workers are read/analyze-only unless an operator explicitly proves disjoint safe writes, and the coordinator owns joins and mutations.

Input and output schemas are independent files. `operator.json` binds their exact filenames;
validation refuses missing, extra, or cross-direction contract files, while allowing only the
optional `icon.svg` addition. During the 7.0 migration, `node contract-v7.mjs`
reports remaining v6 contracts. Release completion requires every operator to pass the v7 contract.

## Domains

| Domain | Ownership |
| --- | --- |
| `workspace` | identity, bootstrap, portable declarations, route hydration and write-root proof |
| `business` | evidence, feature model, lifecycle publication and delivered-source reconciliation |
| `architecture` | hard-decision analysis, live source evidence, pattern binding and exact boundary challenge |
| `fe` | journey/layout delivery plus source-first feedback, learning and cross-surface reconciliation |
| `be` | approved backend source implementation only |
| `quality` | one source gate, diagnosis, readiness, repair, debt or rule-accountability responsibility |
| `deployment` | release intent through manifest, host, artifact, migration, domain, rollout, monitor, recovery/rollback and proof |
| `platform` | bounded Cloudflare, MCP, Sonar and observability control-plane reconciliation |
| `source` | provider-neutral provenance record/query |
| `test` | focused test operators retained for FE product proof |

Operator prose and semantic schemas are hand-authored; `materialize.mjs`
deliberately preserves them instead of regenerating generic instructions. Run `node materialize.mjs`,
then `node validate-operators.mjs`. The validator proves path/manifest identity, exact bundle shape,
closed schemas, default-search context boundaries, absence of routing leakage, source-reference
identity, and fail-closed validators.
