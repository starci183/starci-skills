# AGENT FLEETS — roster

Two named groups:
- **STARCI** (`starci-*`) — write lanes: build, fix, refactor, migrate.
- **READ** (`read-*`) — read-only audit lanes: never edit anything except their own report file.

Naming rule: every spawned agent terminal gets a `<group>-<fleet>-<lane>` title at creation. Find them via `orca terminal list | grep <group>-`.

## Active lanes (fleet v5)

| Terminal | Title | Agent | Brief | Scope |
|---|---|---|---|---|
| term_e981c75d-1cb7-48b8-b12d-29b571c02f9d | starci-v5-1-e2e-kit | devin | `ex-testing/briefs/v5-1-e2e-kit.md` | extract `.claude/packages/e2e-kit`; rewire `src/tests/infra/**` in both BE apps |
| term_8374e2dd-0078-4040-ab59-184cfdf3dc9f | starci-v5-2-fe-kit | devin | `ex-testing/briefs/v5-2-fe-kit.md` | extract `.claude/packages/fe-kit` (theme+i18n); rewire todo-fe + ec-fe shared |
| term_84f857ff-f986-4ccf-b0e6-de447cc87efd | starci-v5-3-grammar | devin | `ex-testing/briefs/v5-3-grammar.md` | move grammar+heroicons → `.claude/packages/`; repoint academy-fe `file:` deps |
| term_8f3b651c-18ec-43e6-85a6-f2f6d6305e72 | starci-v5-4-sonar-vulns | qwen | `ex-testing/briefs/v5-4-sonar-vulns.md` | fix 8 sonar vulns (todo-be 3, ec-be 5) + rescan |
| term_498d1ee0-2426-4d1f-b2bb-434f813f2ada | starci-v5-5-todofe-i18n | qwen | `ex-testing/briefs/v5-5-todofe-i18n.md` | wire todo-fe feature screens to existing en/vi dictionaries |
| term_0df43aa4-cd30-431e-80bb-e7da1c787638 | starci-v5-6-ecfe-tests | qwen | `ex-testing/briefs/v5-6-ecfe-tests.md` | vitest suite for ec-fe (coverage >0) |
| term_36327a98-08fd-42f7-b227-ffadb056f407 | starci-v5-7-gql-codes | devin | `ex-testing/briefs/v5-7-gql-codes.md` | align GraphQL error-code contract (strip `_EXCEPTION` on wire) |
| term_1d5b6bc5-bfd3-434f-9928-c2939d67a62e | starci-v5-8-audit-codecov | devin | `ex-testing/briefs/v5-8-audit-codecov.md` | post-v4-1 stale-ref audit, codecov verify, reconstruct v4-4 report |

| term_129008da-7968-4c04-bb4c-4c9029d20307 | starci-v6-1-ecbe-work | devin | `ex-testing/briefs/v6-1-ecbe-work-records.md` | repair ec-be `.starciwork` records: owner paths `apps/*`→`src/*`, regen evidence, fix assets-yaml ids |
| term_dd0217b6-ee4a-4eae-a870-fa6b68182dfc | starci-v6-2-common-dna | qwen | `ex-testing/briefs/v6-2-common-dna.md` | author `knowledge/grammars/common/DNA.yaml` (fixes 53 RENDER_PROOF_INCOMPLETE) |
## READ group (audit, read-only)

| Terminal | Title | Agent | Brief | Scope |
|---|---|---|---|---|
| term_0a35012c-257e-4fb5-a824-4d8dff45834a | read-v6-3-topology-audit | devin | `ex-testing/briefs/v6-3-work-topology-audit.md` | topology/contradiction/ref-integrity audit of both work trees |
| term_0ade03da-1bb4-4e10-9201-d01953a0aa09 | read-v6-4-change-impact | devin | `ex-testing/briefs/v6-4-work-change-impact.md` | change-isolation + extension mechanics analysis |

## Done fleets

- **v4** (all done): v4-1 ec-fe shared pkg, v4-2 ec-be GraphQL doors, v4-3 todo-be e2e 13/13, v4-4 sonar (crashed after SONAR-SUMMARY.md — report reconstructed by v5-8), v4-5 convention audit.
- **v3** (all done): 10 lanes — canon lint setup/burn-down ×4 apps, i18n+theme, coverage wiring, sonar provisioning, FE conventions.

## Ops notes

- Spawn devin lane: `devin --permission-mode dangerous -- "prompt"` — answer trust prompt with `1`+Enter; verify with `orca terminal read --screen` (long typed commands can leave Enter un-landed).
- Spawn qwen lane: `qwen -i "prompt" --yolo` — if `-i` doesn't submit, send the prompt again as a TUI message. Qwen API key: env `BAILIAN_TOKEN_PLAN_API_KEY` (User env var). To restart a stuck qwen: kill its `cli-entry.js` process, set `$env:BAILIAN_TOKEN_PLAN_API_KEY` in the terminal session, relaunch.
- Reports land in `.claude/ex-testing/lint/v*-REPORT.md`; sonar state in `SONAR-SUMMARY.md`.
- Lib monorepo: `.claude/packages/` — `eslint/{be,fe}` (published canon), `grammar`, `heroicons` (published), `e2e-kit`, `fe-kit` (private, `file:` deps).

## Fleet v7 — .starciwork truth repair (15 lanes)

Spawned after v6-3/v6-4 audits. Marker protocol: `ex-testing/lint/done/<lane>.done`.

| Lane | Agent | Phase | Scope |
|---|---|---|---|
| starci-v7-1-todobe-records | devin | 1 | todo-be records: missing FRs, composes paths, requiresProof, event states |
| starci-v7-2-ecbe-records | devin | 1 | ec-be records: contract wire paths, cart FRs, provenBy, plan-cap |
| starci-v7-3-fe-owners | qwen | 1 | fe impl owner paths [lang], repository fields, realm naming |
| starci-v7-4-edges | devin | 1 | blockedBy reroot, conflictsWith→decision, composes sanity |
| starci-v7-5-hygiene | qwen | 1 | unsanctioned roots, assets payload marker, catalog↔dirs |
| starci-v7-6-todobe-evidence | qwen | 2 | todo-be evidence re-proof (non-ui/uat) |
| starci-v7-7-ecbe-evidence | qwen | 2 | ec-be evidence re-proof |
| starci-v7-8-derived | qwen | 2 | _derived rebuild both trees |
| starci-v7-9-todofe-render | qwen | 3 | todo-fe render captures + ui evidence |
| starci-v7-10-ecfe-render | qwen | 3 | ec-fe render captures + ui evidence |
| starci-v7-11-todo-uat | devin | 3 | todo UAT playwright runs + videos |
| starci-v7-12-ec-uat | devin | 3 | ec UAT runs |
| starci-v7-13-gate-verify | devin | 4 | final gate verify + fleet summary |
| starci-v7-14-residual | qwen | 4* | mechanical sweep (waits phase-1 only) |
| read-v7-15-topology | devin | 4 | re-audit vs v6-3 findings |

Briefs: `ex-testing/briefs/v7/`. Spawn note: qwen lanes need `$env:BAILIAN_TOKEN_PLAN_API_KEY` pulled from User scope (orca env is stale); `qwen -p "prompt" --yolo` runs headless, no TUI.

## Fleet v8 — check/tooling layer (5 lanes, scripts/ only — no .starciwork edits)

| Lane | Agent | File | What |
|---|---|---|---|
| starci-v8-1-replay | devin | scripts/check-work-replay.mjs | re-execute evidence assertions (dry-run default, --run to execute) |
| starci-v8-2-surfaces | devin | scripts/check-work-surfaces.mjs | rigorous contract↔code diff: http/gql/fe-routes/events both directions |
| starci-v8-3-history | qwen | scripts/check-work-history.mjs | git-backed rev/withdraws verification (CHANGE_UNRECORDED, WITHDRAWS_NOT_VERBATIM) |
| starci-v8-4-consistency | qwen | scripts/check-work-consistency.mjs | cross-record semantics: ac naming, proof coverage, conflict-without-decision, gap closure lies |
| starci-v8-5-remap | devin | scripts/work-remap-path.mjs | path-remap tool (dry-run default, fixture-tested only — v7 owns live trees) |

Briefs: ex-testing/briefs/v8/. Style bar: match check-example-work.mjs (why-comments, named sections, descriptive names).
| starci-v8-6-artifacts | qwen | scripts/check-work-artifacts.mjs | declared-bytes-vs-disk: ASSET_MISSING/EMPTY, magic bytes (png/webm/mp4), RUN_MEDIA_FAKE, RECEIPT_ORPHAN, RESOURCE_FILE_MISSING, FEATURE_DONE_INCOMPLETE |
