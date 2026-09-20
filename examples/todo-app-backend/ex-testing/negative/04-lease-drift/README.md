# 04 — lease drift: run ledgers that disagree about who owns a resource

## The defect

`work/` holds a `work/uat` flow (`uat.lease.drift`) with two run manifests:

- `runs/2026-09-01T000000Z-a1` created fixture `task/res-shared-1` and recorded deleting it.
- `runs/2026-09-02T000000Z-b2` claims to **reuse** `task/res-ghost-9`, leased from run A — a
  resource no run ever created (a dangling lease) — while **creating** `task/res-shared-1`
  all over again (the same fixture id claimed as fresh by a second run, double-ownership).

A real run that "reuses" a fixture that was never created, or that "creates" a fixture already
claimed by another run's ledger, is the lease-drift scenario: the ledgers disagree about the world.

## Which check must catch it

| Rule | Detector | Expected |
|---|---|---|
| reuse of a resource no earlier run created | *no current check* — no gate reads cross-run `run-ledger.json` consistency | **detection gap expected** |
| same fixture id `created` by two runs | *no current check* | **detection gap expected** |
| tree-level sanity | `node scripts/checks/check-work-consistency.mjs --tree <this>/work` | whatever it reports is recorded below |

This case exists partly to prove the gap: if nothing refuses, that result is the finding.

## Result

See `../_evidence/detection-*.txt` and the matrix in `../README.md`.
