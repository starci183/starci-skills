# c1 — triage report: cli/, init/, mcp/, sites/

## Verdicts

| path | verdict | evidence |
|---|---|---|
| `cli/` | **LIVE** — kept | `package.json` `bin.starci` → `bin/starci.mjs:86,88` `import('../cli/main.mjs')`; `bin/starci-skills.mjs:524` requires `cli/main.mjs` in the installed runtime; ~10 specs import/spawn it (`cli.spec`, `code-patterns-cli.spec`, `execution-api-cli.spec`, `work-status.spec`, `brand-checks.spec`, `index-md.spec`, `stacks.spec`, `architecture.spec`, `application-stacks-integration.spec`, `source-layout.spec`); `modules/schemas/index.yaml` lists it as a usedBy consumer. Smoke: `node cli/main.mjs --help` OK, `node bin/starci.mjs version` → `1.0.4`. |
| `init/` | **LIVE** — kept | `bin/starci-skills.mjs:90-92` reads `init/{AGENTS,CLAUDE,DEVIN}.md` at module top level — removing it breaks every installer import, not just `init`. Also asserted by `tests/engine-lifecycle.spec.mjs:49` and `tests/integration.spec.mjs:104-105`; in `package.json` `files`. |
| `mcp/` | **JUNK** — deleted | Untracked and gitignored (`/mcp/`). Contained zero files — only empty directories literally named `mcp/docker/mcp-gateway.conf.template` and `mcp/docker/qdrant-showcase.conf.template` (dirs, not files: a mkdir/quoting artifact). No references to `mcp/` anywhere (the `mcpContextUris`/codex `mcp__*` hits are unrelated config keys). Removed with `rmdir` (would have failed on any real content). |
| `sites/` | **LEGACY** — `git mv sites legacy/sites` | 18 tracked files renamed (preserves history). Nothing imports `sites/` — it is the GitHub Pages pair (Vite skills-catalog + Next docs site) that only *consumes* canon (`workflows/`, `modules/ops/`, `schemas/`, `core/yaml.mjs` via `generate-data.mjs`). All inbound references are packaging/metadata, not code imports. |

## Moves performed

- `git mv sites legacy/sites` — all 18 tracked files show `R` renames in `git status`.
- `rmdir` chain on `mcp/` (untracked empty dirs — nothing to `git mv`).
- `cli/`, `init/` untouched.

## Test results

| command | result |
|---|---|
| `node --test tests/cli.spec.mjs` | 19 fail / 0 pass — **single root cause**: every test's `init` hook calls `copyPayload`, which throws `package is incomplete: sites/skills/src is missing` (PAYLOAD derives from `package.json` `files`). Resolves when needed_elsewhere #1 lands. No other error types observed. |
| `node --test tests/json-exceptions.spec.mjs` | 4 pass / 1 fail — only the real-root checker test fails: 6 stale `sites/*` allowlist entries (missing on disk) + 7 offenders under `legacy/sites/` (see needed_elsewhere #2/#3). Fixture tests all pass. |
| `node cli/main.mjs --help` / `node bin/starci.mjs version` | OK — `cli/`+`bin/` entry chain functional. |

No files edited → nothing to `node --check`. `knowledge/` untouched, no new `.dist/`, no commits.

## needed_elsewhere (cross-scope fallout from `sites/` → `legacy/sites/`)

1. **c8 — `package.json` `files`**: remove all 12 `sites/*` entries. Until then `bin/starci-skills.mjs` `copyPayload` (line 211) throws on `init`/`update`/`doctor`, which is the sole cause of the 19 `cli.spec.mjs` failures. Product note: this also drops the docs-site source from the installed payload — intended consequence of retiring `sites/`, but flagging since installs previously shipped `sites/skills/src`.
2. **schemas — `schemas/json-exceptions.yaml`**: the 6 `sites/*` exception paths no longer exist → drop them or re-path to `legacy/sites/*`.
3. **scripts/checks — `check-json-exceptions.mjs`**: `GENERATED` still lists `sites/skills/src/catalog.generated.json` and `legacy/` is not in `SKIP_DIR_NAMES`, so moved JSONs now report as offenders. Wave-wide suggestion: add `'legacy'` to `SKIP_DIR_NAMES` — every lane moving dirs into `legacy/` (c2/c3/c6…) will produce the same class of offenders.
4. **c8 — `.gitignore`**: `/sites/docs/{.next,out,pages}` entries are stale; the build output rode along to `legacy/sites/docs/{.next,out,pages}/` and now shows as untracked (`?? legacy/sites/…`). Re-anchor or ignore `legacy/sites/` build dirs. (`node_modules/`+`dist` stays covered by unanchored patterns.)
5. **c4 — `docs/`**: `docs/releasing.md` verify-source block runs `npm --prefix sites/skills ci`, `sites/skills/scripts/generate-data.mjs`, `site-regression.spec.mjs`, `sites/docs/build.mjs` — all now under `legacy/sites/`; `docs/config-format.md:70` references `sites/skills/src/catalog.generated.json`.
6. **c8 — `INDEX.yaml:27`, `UPDATE.yaml:115-117`**: still describe `sites/` as a live docs-sites root.
7. **c7/c9 — `tests/json-exceptions.spec.mjs`**: last test fails until #2+#3 land.

## Notes

- `bin/starci-skills.mjs:336` `PRESERVED_DOCUMENTATION_ROOTS` includes `'sites'` — left as-is; it preserves retired V2 site files on update and remains semantically correct.
- `legacy/sites/skills/scripts/generate-data.mjs` computes `root` as `../../..`, which now resolves to `legacy/` — it no longer functions in place. Left frozen (legacy = recovery copy, not live tooling); if sites are ever revived, that path needs re-pointing.
- `tests/integration.spec.mjs:391-403` uses `sites/skills/*` only as synthetic temp-root fixture paths — unaffected.
- Incident note: an early cross-device `mv` probe to `/tmp` was killed mid-copy and partially removed `sites/skills` content; all tracked files were restored via `git checkout -- sites/` and the tree verified clean (`git status`/`git diff HEAD -- sites/` empty) before the successful `git mv`. No data lost.
