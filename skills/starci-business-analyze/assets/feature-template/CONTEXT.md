# {{FEATURE_TITLE}}

> Business identity: `{{PROJECT}}/{{FEATURE_ID}}@{{FEATURE_HASH}}`
>
> Source heads: `fe@{{FE_HEAD}}`, `be@{{BE_HEAD}}`
>
> Load this file first. Load only the modules named by the current task.

## Decision capsule

**Purpose.** {{ONE_SENTENCE_PURPOSE}}

**Primary actor.** {{PRIMARY_ACTOR}}

**Primary outcome.** {{PRIMARY_OUTCOME}}

**Never does.** {{EXPLICIT_NON_GOAL}}

## Invariants

- `BR-01` — {{HIGHEST_VALUE_RULE}}
- `BR-02` — {{SECOND_RULE}}
- `BR-03` — {{SECURITY_OR_OWNERSHIP_RULE}}

## Primary flow

```text
{{ENTRY_STATE}} -> {{STEP_A}} -> {{STEP_B}} -> {{SUCCESS_STATE}}
                              \-> {{FAILURE_STATE}}
```

## Surface map

| Surface | Route | Owns | Module |
|---|---|---|---|
| `{{SURFACE_ID}}` | `{{ROUTE_PATTERN}}` | {{SURFACE_PURPOSE}} | [surface](surfaces/{{SURFACE_ID}}.md) |

## Data and operation map

| Operation | Owner | Input | Result |
|---|---|---|---|
| `{{OPERATION_NAME}}` | {{frontend_or_backend}} | {{INPUT_SUMMARY}} | {{OUTPUT_SUMMARY}} |

## Explicit unknowns

- `{{UNKNOWN_ID}}` — {{QUESTION}}. Impact: {{IMPACT}}.

## LOADS

| Need | Read |
|---|---|
| Scope, terminology and exclusions | [overview.md](overview.md) |
| Actor permissions and ownership | [actors.md](actors.md) |
| One user journey | `flows/<flow-id>.md` |
| One renderable screen | `surfaces/<surface-id>.md` |
| Business invariants | [rules.md](rules.md) |
| State transitions | [states.md](states.md) |
| Entities, inputs, outputs and failures | [contracts.md](contracts.md) |
| Completion and regression proof | [acceptance.md](acceptance.md) |
| Machine rendering/query | [model.json](model.json) |
| Exact source provenance | [evidence.json](evidence.json) |

## Context rule

Do not load every module by default. `CONTEXT.md` plus the one flow/surface being changed is the normal
prompt. `model.json` is authoritative for machines; Markdown files are generated projections. Unknowns
remain unknown until routed source or an explicit owner decision resolves them.
