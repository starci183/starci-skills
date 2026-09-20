# 01 — record with a hand-authored `provenBy` (fake proof claim)

## The defect

`work/features/fake/impl/fake-be/ghost/index.yaml` is a `work/implementation@1` that claims
`state: done` and carries a **hand-written** `provenBy` naming `uat.fake.ghost` — a UAT record
that exists but is still `todo` (its run never happened). Beside it, `evidence.yaml` settles the
record on `run: runs/20990101T000000Z-ghost`, a directory that was never created, and the record
declares `assets[].path: assets/never-captured.png` with a sha256 of bytes that do not exist.

Three independent lies, each one a record *asserting* proof instead of holding derived proof:

1. `provenBy` is authored at all — provenance is derived from done records' `proves` edges, never
   written down by hand.
2. The authored `provenBy` target is not `done` — a false proof claim even if authoring were legal.
3. The evidence and the record name artifacts that are not on disk — proof with no bytes behind it.

## Which check must catch it

| Rule | Detector | Expected |
|---|---|---|
| hand-authored `provenBy` | `node scripts/checks/check-work-deep.mjs --tree <this>/work` | `PROVENBY_AUTHORED` |
| provenBy target not done | same | `PROVENBY_TARGET_NOT_DONE` |
| `run:` ghost in evidence | `node scripts/checks/check-work-artifacts.mjs --tree <this>/work` | `EVIDENCE_ARTIFACT_GHOST` |
| `assets[].path` missing | same | `ASSET_MISSING` |

## Result

See `../_evidence/detection-*.txt` and the matrix in `../README.md`.
