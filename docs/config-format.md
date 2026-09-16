# Local config format

StarCi keeps **local runtime preferences** in ignored `config.json` at the skill root. That file is never bundled into `.dist` and is not overwritten by install/update when it already exists.

## Example source

| File | Role |
| --- | --- |
| `config.example.yaml` | Preferred authored example (defaults: `language: vi`, `model: null`, `effort: medium`). |
| `config.example.json` | Legacy example mirror kept during migration; loaders still accept it when the YAML example is absent. |
| `config.json` | User-local runtime config. Always JSON. Created only when missing. |

## Init copy policy

`scripts/config.mjs` `loadConfig(root, {initialize:true})`:

1. If `config.json` already exists under `root`, load and validate it. Do not rewrite it from the example.
2. If absent, resolve the example in this order under the same `root`:
   - `config.example.yaml` (preferred authored source)
   - `config.example.json` (legacy mirror)
   - `.dist/config.example.json` (built projection after `ensure-build`)
3. Write a new `config.json` as pretty-printed JSON with the validated example values (`wx` create-only).

Existing user `config.json` files are never rewritten by example updates. The loader translates the former
`supervisor`, `validator` and `critique` sections into the current in-memory pools and role map, so an existing local
file keeps working without becoming another authored format. Build projects the example into
`.dist/config.example.json` for runtime packaging; that projection is not a second authored source.

## Shape

Required keys only:

- `language` — BCP-47-like tag (`vi`, `en`, …)
- `model` — `null` (inherit host) or non-empty host model name
- `effort` — one of `none`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`, `ultra`
- `allocation.mode` — `adaptive`; fresh quota, current admitted load, recent service and task/model suitability
  are recomputed before every future assignment
- `allocation.preferredProvider` — `null` for automatic capacity or one declared provider id for a bounded
  preference; this never forms a fallback chain
- `models.selection` — `quota-aware`; selection happens before a call
- `models.pools` — the two closed cross-provider pools, `fable-astra` and `opus-sol`; every member is a
  known runtime with the role its consumers require
- `models.nonOperation` — the closed mapping from the three non-operation roles to one declared pool

| non-operation role | typed functions | default pool |
| --- | --- | --- |
| `planner` | `assessGoal`, `planOp` | `fable-astra` |
| `kernelManager` | `manageWorkflow`, `decide` | `opus-sol` |
| `validator` | `critiqueGoal`, `validateOp` | `fable-astra` |

The named pools keep provider diversity without making one model a fallback. Before a call, admission chooses
an eligible, qualified member using actual capacity and fresh known quota. Planner/validator remain in the
Fable/Astra pool and manager/technical decisions remain in Opus/Sol; adaptive allocation does not invent Qwen
support for these functions. Functions retain separate typed inputs and independent contexts even when they
share a pool.

Operation candidates still come from the operation policy and runtime catalog, but adaptive allocation treats
catalog order as eligibility/suitability rather than sequential fallback. It groups candidates by provider
family so several models do not multiply one family's quota, and combines fresh quota with atomic admitted
family load. The runtime pin seals the accepted `config.json` digest, so config changes apply to future
assignments only after a new pin and an orderly same-id restart/retry boundary; a running dispatch never changes
identity.

Existing ignored files without `allocation` resolve to `{mode:"adaptive", preferredProvider:null}` in memory.
The former `providers` array remains readable for compatibility: its first item becomes
`preferredProvider`, while later items no longer define a chain. The loader never rewrites either form.

## Related catalog ownership (not config)

| Path | Decision |
| --- | --- |
| `docs/catalog.json` | **Generated** by `scripts/build-docs.mjs` (also feeds `sites/skills/src/catalog.generated.json`). Do not author a parallel `docs/catalog.yaml`. |
| `README.yaml` / `INDEX.yaml` / `UPDATE.yaml` / `core/README.yaml` | Authored declarative metadata; YAML is the preferred source. JSON mirrors remain until a later delete pass. |
| `examples/*.yaml` (`nivo-setup-*`, `nivo-service-routing`) | Authored structured examples; YAML preferred. JSON mirrors remain until a later delete pass. Build projects them to `.dist/examples/*.json`. |
| `fixtures/forward-goal-report.yaml` | Authored synthetic evaluation narrative (`starci/fixture-report@1`), not an exact JSON wire fixture under test. Converted to YAML. Executable replay uses `fixtures/forward-goal/draft/**` (Work YAML). |
