# `fe/authority-reconcile` output

- `output.outcome`: Typed authority-repair result consumed only by the parent Skill.
- `output.result`: The atomic job result, or null when blocked.
- `output.gaps`: Exact missing authority or evidence; empty when complete.
- `output.evidenceRefs`: Exact evidence used to produce the result.

`reconciled` requires one structured result, the exact repeated `gapRef`, `authorityRef`, before
authority revision, frozen boundary and fingerprint; a distinct after revision; exact hash-bound
effect records; one published Grammar package/export/artifact/hash identity; exact
`changedGrammarRefs`; consumer-impact records; `resumeState=request-compile`; no gaps; and exact
evidence. `blocked`
requires `result: null`, exact gaps/evidence, and never implies product-local fallback.
