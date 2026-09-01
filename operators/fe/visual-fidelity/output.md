# `fe/visual-fidelity` output

- `output.outcome`: `passed`, `repair`, `insufficient-evidence`, or `blocked`, consumed only by the
  parent Skill.
- `output.result`: Structured pixel-review receipt for `passed` or `repair`; null otherwise.
- `output.gaps`: Exact unresolved evidence or authority gaps.
- `output.evidenceRefs`: Non-empty exact evidence behind every outcome.

The structured result repeats packet, matrix, partition, round, opaque Grammar/icon/media identities,
product-family benchmarks, reviewer, final-screenshot, and audit
identity. `packetRasterRefs` must preserve packet order and match `inspectionRecords` one-for-one in
that order. Every inspection contains all 20 visual lenses, including product-family quality, and all
three challenge families.
`probeRecords` contains the exact 22 canonical probes in order: applicable `survived`/`contradiction`
records keep an exact packet raster ref, while `not-applicable` keeps `imageRef: null`.

`passed` requires a complete populated happy-case packet, a separately validated Grammar audit bound
to the exact decision/icon/media/matrix fingerprints, score at least 9, a passing final screenshot,
no retained gaps, no problem/confirmed challenge/probe contradiction, and `uncertainty=false`.
`repair` requires at least one concrete visible problem or contradiction. `insufficient-evidence`
means the reviewer ran but the packet cannot support a conclusion; it returns `result: null`, exact
recapture gaps, and no score. `blocked` is reserved for missing authority/runtime/isolation before
pixel inspection and also returns `result: null`.

The parent compares every repeated packet and reviewer binding with the invocation. A score, summary,
or prose assertion cannot override missing bindings, parity, or inspection evidence.
