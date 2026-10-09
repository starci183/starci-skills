Owner: modules/ops/
# Ops source ownership

The ops contracts are hand-authored YAML under `modules/ops/`. The runtime
reads that YAML in place and ships it as the payload; there is one authority
per file and no derived view to keep in step by hand.

## Authored — edit these

| Path | Role |
| --- | --- |
| `modules/ops/ops/<op>.yaml` | One executable operator contract per operation: its goal, reads, writes, steps, proofs, judge (who judges the product), blockers, policy blocks and `route:` key |
| `modules/kernel/op-judges.yaml` | The vocabulary the `judge` field is held to: the measures a machine judge may cite, the owner gates and the reviewing legs |
| `modules/ops/_common.yaml` | The vocabulary and rules every op manifest inherits |

## Generated — regenerate, never edit

| Path | Role | Regenerate with |
| --- | --- | --- |
| `modules/ops/registry.yaml` | The op index routing reads: id list, kinds and route keys projected from the manifests | `starci runtime gen-ops` (`--check` to verify it is current) |

`npm run check` runs that `--check`, so a manifest edit that is not reflected in
the registry is a red check, not a silent drift. See [writing an op
manifest](ops.md) for the anatomy of a contract.
