# `fe/baseline-visual-review` output

`failed`, `ready-for-closure`, or `insufficient-evidence`, with one inspection record for every input
cell. Baseline evidence never certifies PASS.

## Output fields

- `output.outcome`: routing-only result. `failed` continues repair/reconstruction;
  `ready-for-closure` continues the complete closure matrix; `insufficient-evidence` blocks.
- `output.aiExecution`: exact one-model, one-reviewer, fresh-context execution provenance.
- `output.result`: null only when evidence is insufficient. Otherwise contains `typedVerdict`, the
  noncanonical integer `auditScore`, exactly five evidenced axes, one concrete inspection per raster,
  the complete finding set, structural finding subset, and immutable finding-batch fingerprint.
- `output.gaps`: exact missing evidence; non-empty only for `insufficient-evidence`.
- `output.evidenceRefs`: packet and review artifacts used to reach the routing result.
