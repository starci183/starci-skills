# Ops source ownership

Hand-authored ops contracts live as YAML under `ops/`. Executable generate code remains the only owner of derived JSON. Do not hand-edit generated files; that creates dual authority.

## Authored (edit these)

| Path | Role |
| --- | --- |
| `ops/registry.yaml` | Operator ID list and consolidation policy input |
| `ops/common.yaml` | Shared policy document for all ops |
| `ops/*/operator.yaml` | Executable operator contracts |
| `ops/business.decide/specification.yaml` | Business specification policy |
| `ops/architecture.decide/specification.yaml` | Architecture specification policy |
| `ops/interface.implement/secondary.yaml` | Caller-owned secondary permissions |

`ops/contracts.mjs` loads the YAML sources above. `ops/*.mjs` (`generate`, `basic-ops`, `role-authority`, `validate`, `select`) are executable owners, not declarative docs.

## Generated (do not author)

| Path | Produced by |
| --- | --- |
| `.dist/ops/catalog.json` | Unified build projection of operator contracts |
| `.dist/basic-ops.json` | `basic-ops.mjs` through the unified build |
| `.dist/ops/consolidation.json` | `registry.yaml` consolidation through the unified build |
| `.dist/ops/*/authority.json` | `role-authority.mjs` through the unified build |

`ops/generate.mjs` supplies an in-memory output map to the unified build. Source-tree generation is retired. `npm run build` publishes the complete validated bundle; `npm run build:check` is read-only. No generated JSON mirrors remain beside authored YAML.

Runtime packaging still emits JSON under `.dist/ops/**` and `.dist/policy/common.json` from the authored YAML plus generated views.
