# Ops source ownership

Hand-authored ops contracts live as YAML under `modules/ops/`. They are the only authority; there is no generated JSON mirror to keep in sync. Do not hand-edit derived views; that creates dual authority.

## Authored (edit these)

| Path | Role |
| --- | --- |
| `modules/ops/registry.yaml` | Operator ID list and consolidation policy input |
| `modules/ops/ops/<op>.yaml` | Executable operator contracts (one file per operation, including shared policy, specification policy and secondary permissions as declared fields) |

Runtime readers load the YAML sources above in place. Runtime packaging ships the authored YAML; consumers read it directly.
