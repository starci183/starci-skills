# 02 — stale evidence: proof captured before the code changed

## The defect

`work/` holds a `work/implementation` (`impl.stale.worker`) that is `state: done` on the strength of
`evidence.yaml` captured at 2026-01-01. The evidence stamps a `codeDigest` over the record's owned
directory `src/worker/` — but `src/worker/index.ts` on disk today is NOT the bytes that were hashed
(the digest below belongs to an older file). The code moved after the proof; the record still reads
`done`.

This is the "run cũ claim done sau khi src đổi" defect: nothing inside the record's own yaml is
wrong — the lie is only visible when the digest is recomputed against the working tree.

## Which check must catch it

| Rule | Detector | Expected |
|---|---|---|
| codeDigest no longer matches owned code | `node scripts/example-derive.mjs --work <this>/work --write` then read `work/_derived/` | record derived `stale`, reason `code-digest-mismatch` |
| same idea at the real gate | `check-example-work.mjs` concept 1 (`CODE_DIGEST_STALE`) — only reachable inside `examples/**/.starciwork`, so this fixture demonstrates it via the derive layer | refuse unless `stale: true` |

## Result

See `../_evidence/detection-*.txt` and the matrix in `../README.md`.
