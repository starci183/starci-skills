# Lane v6-1 — repair ecommerce-app-be .starciwork records (gate: 19 refused)

SCOPE (exclusive): `examples/ecommerce-app-be/.starciwork/**` ONLY. Do not touch app source, other apps, or `packages/`.

## Context
`node .claude/scripts/check-example-work.mjs` (run from `.claude/`) reports 19 REFUSED in `examples/ecommerce-app-be/.starciwork`:
- OWNER_PATH_MISSING ×4-ish: records name `apps/order/src/...` / `apps/identity/src/...` but the app merged into a single root `src/` layout. Real module dirs now: `src/modules/bussiness/{account,cart,catalog,order,payment,session}`, `src/modules/integrations/{identity,order}`, `src/modules/platform/*`, `src/features/{checkout,identity}`.
- CODE_DIGEST_STALE ×~9: evidence.yaml codeDigests hashed the old apps/* paths — after fixing owners, regenerate evidence so digests match real code.
- `id is undefined` ×6: `assets/generation-receipts.yaml` + `assets/direction-check.yaml` under `features/*/ui/*/assets/` are being parsed as Work nodes. Check how check-example-work.mjs decides a yaml is a node vs payload (EXEMPT schemas / filename rules / a `schema:` marker) and fix the files so the gate accepts them as payloads — do NOT delete them (they are provenance for generated UI art).

## Tasks
1. Read `.claude/schemas/work-layout.yaml` + `scripts/check-example-work.mjs` + `scripts/example-evidence.mjs` + `scripts/example-ownership.mjs` FIRST — understand the gate before editing.
2. Rewrite every `module:`/`owners[].path` entry pointing at `apps/<app>/src/...` to the equivalent `src/...` path (verify each target dir exists on disk).
3. Fix the assets yaml `id is undefined` refusals the sanctioned way (check gate source for how payload yaml is exempted — likely a `schema:` value outside the work/ kinds, or relocation; if the gate only exempts by filename pattern, rename accordingly but keep content).
4. Regenerate every stale evidence.yaml via `node scripts/example-evidence.mjs` — re-run the same assertion commands the evidence records (--cwd = the app dir). If an assertion command no longer exists (renamed spec file), find the current equivalent command and record THAT; never write an evidence whose assertions fail.
5. Re-run `node .claude/scripts/check-example-work.mjs` scoped to this app until 0 refused for ecommerce-app-be. Do not touch todo-app-backend records (other lanes own them).
6. Report → `.claude/ex-testing/lint/v6-1-REPORT.md`: paths rewritten, evidence regenerated (assertion outcomes), remaining refusals if any.

## Rules
- Work records are YAML, English. `state: done` requires proof — regenerated evidence IS the proof; never flip state without it. If an assertion genuinely fails against current code, leave the record's evidence absent/stale and report it honestly — do not mark done.
