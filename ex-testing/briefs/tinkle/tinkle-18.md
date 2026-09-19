# tinkle-18 — secondary dirs: docs, workflows, hosts, providers, execution, contracts, approvals

Read `tinkle/_common-distless.md`. Owns: `docs/**`, `workflows/**`, `hosts/**`, `providers/**`, `execution/**`, `contracts/**`, `approvals/**`.

Mission: for each dir, determine its .dist relationship (source? copied verbatim? compiled?) — read build scripts to see what they do with it. Then:
- If source compiled/copied to .dist → find readers, repoint to source directly
- If dir is legacy/superseded (content moved to modules/ or sqlite/) → `git mv <dir> legacy/<dir>`
- If dir is live runtime code → leave in place, just kill its .dist path refs
build-docs.mjs and build-workflows.mjs logic is being removed by tinkle-19 — your job is the DATA/readers side, not the builders. Report per-dir verdict. Marker `done/tinkle-18.done`.
