# Local config format

StarCi keeps **local runtime preferences** in ignored `config.yaml` at the skill root. That file is host-local state, never part of the shipped source payload, and is not overwritten by install/update when it already exists.

## Example source

| File | Role |
| --- | --- |
| `config.example.yaml` | Preferred authored example (defaults: `language: vi`, `model: null`, `effort: medium`). |
| `config.example.json` | Fallback example; loaders accept it when the YAML example is absent. |
| `config.yaml` | User-local runtime config. Seeded verbatim — comments included — from `config.example.yaml`, only when missing. |
| `config.json` | Still honored when `config.yaml` is absent, so existing installs keep working. |

## Init copy policy

`engine/config.mjs` `loadConfig(root, {initialize:true})`:

1. With `initialize`, copy `config.example.yaml` verbatim to `config.yaml` under `root` when `config.yaml` is absent (best effort).
2. Read `config.yaml` if present; else `config.json`; else the example (`config.example.yaml`, then `config.example.json`).
3. Validate the result; an existing owner file is never rewritten by example updates.

The loader translates earlier `supervisor`, `validator` and `critique` sections and earlier `nonOperation` role keys into the current in-memory pools and role map, so an existing local file keeps working without becoming another authored format.

## Shape

Required keys:

- `language` — BCP-47-like tag (`vi`, `en`, …)
- `model` — `null` (inherit host) or non-empty host model name
- `effort` — one of `none`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`, `ultra`
- `models.selection` — `quota-aware`; selection happens before a call
- `models.pools` — the two closed cross-provider pools, `fable-astra` and `opus-sol`; every member is a
  known runtime with the role its consumers require
- `models.nonOperation` — the closed mapping from the three non-operation roles to one declared pool

Optional keys:

- `kernel` — `{agent?, model?, effort?}` route pin for the `[Kernel]` seat; null means routing decides
- `budgets` — `{maxOps?, perOpMs?, dailyTokens?}` owner ceilings; positive integers or null
- `allocation.mode` — `adaptive`; fresh quota, current admitted load, recent service and task/model suitability
  are recomputed before every future assignment
- `allocation.preferredProvider` — `null` for automatic capacity or one declared provider id for a bounded
  preference; this never forms a fallback chain
- `debug` — boolean

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
family load. The runtime pin seals the accepted `config.yaml` digest, so config changes apply to future
assignments only after a new pin and an orderly same-id restart/retry boundary; a running dispatch never changes
identity.

## Runtime naming

| Name | Meaning | Example |
| --- | --- | --- |
| `launcher` | Human chat surface invoking entry skills | `codex-chat` |
| `host` | Workflow execution environment | `orca` |
| `agent` | Executable/Orca adapter | `codex` |
| `provider` | Credential, billing and quota family used by allocation | `codex` |
| `model` | Concrete model identifier | `gpt-5.6-sol` |
| `profile` | StarCi capability/routing profile | `codex-agent` |
| `runtimePool` | Capacity pool selected by the allocator | `codex-agent` |

An `agent` and `provider` may currently carry the same string, but their fields
are not interchangeable. Routing records use `provider` for quota authority.

Files without `allocation` resolve to `{mode:"adaptive", preferredProvider:null}` in memory.
