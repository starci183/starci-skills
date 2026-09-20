# Negative corpus — malformed Work/evidence the checks must catch

Each case is a self-contained `work/` tree (plus any owned `src/` it needs) that violates exactly one
rule. Nothing here touches the real `.starciwork` trees or real source. To re-run the detection:

```bash
# base gate (record layout, refs, evidence digests) — importable checker over a fixture root
node -e "import('./scripts/checks/check-example-work.mjs').then(m=>{const p=[],w=[],i=[];m.checkWorkTree(require('path').resolve('examples/todo-app-backend/ex-testing/negative/<case>/work'),p,w,i);p.forEach(x=>console.log('REFUSED '+x));w.forEach(x=>console.log('WARN '+x));process.exitCode=p.length?1:0})"

# consistency layer (conflicts, proof coverage)
node scripts/checks/check-work-consistency.mjs --tree examples/todo-app-backend/ex-testing/negative/<case>/work

# deep layer (authored provenance, dep/norm staleness)
node scripts/checks/check-work-deep.mjs --tree examples/todo-app-backend/ex-testing/negative/<case>/work
```

Raw output from the run this corpus was verified with lives in `_evidence/detection-*.txt`.

## Detection matrix

| Case | Defect | Expected detector | Observed | Verdict |
|---|---|---|---|---|
| 01-record-fake-provenby | `fr.fake.thing` carries a hand-authored `provenBy` naming a `todo` uat flow; sibling impl evidence settles on a `runs/` dir that does not exist | `check-work-deep.mjs`: `PROVENBY_AUTHORED`, `PROVENBY_TARGET_NOT_DONE` | both refused, exit 1 | **caught** |
| 01 (residual) | `evidence.yaml`'s `run: runs/20990101T000000Z-ghost` points at a run that was never created | *no check reads `evidence.run` on impl evidence* | base gate passes; deep/consistency only flag the provenBy | **GAP** — dangling `run:` on non-uat-flow evidence is invisible |
| 02-evidence-stale-after-code-change | impl `done` on evidence whose `codeDigest` predates the current `src/worker/index.ts` | `check-example-work.mjs` trust concept 1: `CODE_DIGEST_STALE` | refused, exit 1 | **caught** |
| 03-srs-business-contradiction | two `done` business rules declare `conflictsWith` each other, no `work/policy-decision` settles the pair | `check-work-consistency.mjs` concept 3: `CONFLICT_WITHOUT_DECISION` | refused, exit 1 | **caught** |
| 03 (residual) | the same contradiction in prose only, with no `conflictsWith` edge | *no check reads rule semantics* | would pass every gate | **GAP** — undeclared contradictions are undetectable |
| 04-lease-drift | run B's `run-ledger.json` reuses `task/res-ghost-9` (no run created it) and recreates `task/res-shared-1` already owned by run A | *no check reads cross-run ledger consistency* | 0 refused across all three layers | **GAP** — lease drift between UAT runs is invisible to the suite |

## Gaps for a later wave (do not fix here)

1. `evidence.run` on implementation evidence is never resolved — a done impl can settle on a run
   directory that does not exist. Only `work/uat-flow` evidence gets its `run` verified
   (check-example-work.mjs concept 12).
2. Contradictory business rules that never declare `conflictsWith` pass all checks; detection
   would require semantic reading of `statements`.
3. Cross-run `run-ledger.json` consistency (`reused` vs a prior `created`, duplicate `created`
   of the same fixture id) has no detector at all — `starci/uat-run-manifest@1` payloads are
   skipped as artifacts, and nothing compares ledgers across runs.
