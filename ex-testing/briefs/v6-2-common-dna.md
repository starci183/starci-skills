# Lane v6-2 — author `knowledge/grammars/common/DNA.yaml` (fixes 53 RENDER_PROOF_INCOMPLETE)

SCOPE (exclusive): `.claude/knowledge/grammars/common/**` (new) + `.claude/knowledge/grammars/index.yaml` (add the family entry). Do not touch examples or packages.

## Context
Both example apps' brand records declare `identity.family: common` (they consume `@starci/grammar/common`). The render/brand checks (`checks/render.mjs` `cardClassesOf`, `checks/brand.mjs` `grammarTokenNames`) read `knowledge/grammars/<family>/DNA.{yaml,yml,json}` — only `starci/` exists → "the host carries no DNA snapshot for grammar family `common`" → 53 RENDER_PROOF_INCOMPLETE refusals on todo-be's frontend implementation captures.

## Tasks
1. Read `knowledge/grammars/starci/DNA.yaml` (the existing snapshot = the format contract: schema starci/knowledge-source@1, provenance, identity, tokens[], renderers[] with component+classes, claims, gaps) and `knowledge/grammars/index.yaml` (catalog — add a `common` entry mirroring the starci entry's shape).
2. The source of truth for the snapshot is the actual package source now at `.claude/packages/grammar/src/common/` (moved there by another lane — if missing, fall back to the installed `@starci/grammar@0.4.13` in `examples/todo-app-frontend/node_modules/@starci/grammar/`). Author `common/DNA.yaml` describing the COMMON public entry: its real token names (from the common styles/tokens source), its renderer list (component names + emitted class names — especially the card surface classes ending `-surface`/`-surface-card`, e.g. what `SurfaceCard`/`SurfaceListCard` actually emit), claims and gaps honestly marked as a snapshot.
3. `provenance` must name package `@starci/grammar`, version 0.4.13, `publicEntry: @starci/grammar/common`, and today's date as `captured`.
4. Verify: write a tiny node script that imports `checks/brand.mjs`'s `grammarTokenNames({family:'common'})` and `checks/render.mjs`'s `cardClassesOf({family:'common'})` — both must return `error: null` with non-empty names/classes. Then re-run `node scripts/check-example-work.mjs` and confirm the RENDER_PROOF_INCOMPLETE count drops (palette-off-brand failures that remain are a different lane's job — report the delta).
5. Report → `.claude/ex-testing/lint/v6-2-REPORT.md`.

## Rules
- Snapshot = observation of real source, not invention. If a token/class table can't be confirmed from source, leave it out and say so in `provenance.limitations`.
