# Lane v5-8 — post-v4-1 audit + codecov verify + v4-4 report reconstruction

Date: 2026-09-19. Scope honored: read-everything; wrote only
`lint/v4-4-REPORT.md`, this report, and one stale doc ref inside
`examples/ecommerce-app-fe/brand/duck.prompt.txt`. No other lanes' files touched.

## 1. v4-4 report gap — reconstructed

`lint/v4-4-REPORT.md` written, marked reconstructed-by-v5-8. Key facts:

- `lint/SONAR-SUMMARY.md` (mtime 12:29) is the v3-7-era file — v4-4 never
  overwrote it. All four `*/.scannerwork/report-task.txt` files are also
  12:28–12:29, so **no v4-4 sonar rescan exists on disk**; the v3-7 numbers are
  still the latest verified data.
- Coverage artifacts: todo-be/ec-be lcov date to v3-6 (12:24); todo-fe's 14:37
  lcov is v4-5's own gate run, not v4-4's. ec-fe has no suite (expected).
- The one piece of v4-4's mission with zero evidence of completion is a
  post-v4-1 rescan of `starci-ecommerce-app-fe` (its `sonar.sources` changed
  shape). Flagged for the next sonar owner.

## 2. Stale-ref audit after v4-1 (`types/` → `packages/shared/`) — 1 fixed

Checked `examples/ecommerce-app-fe`: root + per-app `tsconfig*.json` paths and
includes, both `next.config.mjs` (`createNextIntlPlugin` targets
`../../packages/shared/src/i18n/request.ts`), both `globals.css`
(`@import`/`@source` all point at `packages/shared/src`, `brand/`, grammar dist),
`eslint.config.mjs` (`APP_GLOBS` + js/recommended files cover `packages/**`),
`sonar-project.properties` (`sources=apps,packages`), `architecture.json`,
`scripts/*.mjs`, both `package.json`s, `postcss.config.mjs`, and a full-tree
grep for `types/`, `ProductCard`, `ProductTile`, `components/classNames`,
`../types`.

- `types/` dir is gone; all `@shared/*` imports in `apps/*/src` resolve to real
  files under `packages/shared/src/` (i18n/{config,navigation,routing,request},
  leaves/{CatalogueTile,DuckMascot,StateBlock}, theme/{DisplayControls,
  theme-context,tokens.css}, messages/{en,vi}.json).
- `i18n/request.ts` loads `../messages/${locale}.json` — resolves correctly.
- Remaining `types/` grep hits are all legitimate: `@types/*` npm deps,
  `.next/types`, `next-env.d.ts` triple-slash refs, and the regenerated
  `tsconfig.tsbuildinfo`.
- **Fixed**: `brand/duck.prompt.txt` described the shipped mark as
  `src/components/DuckMascot.tsx` "in each app" — repointed to
  `packages/shared/src/leaves/DuckMascot/index.tsx` (single shared leaf).
- Noted, not touched (outside write scope): `lint/SONAR-SUMMARY.md` narrates
  ec-fe `sonar.sources` as `apps,types`; the file on disk is already
  `apps,packages`. Recorded in the reconstructed v4-4 report.

## 3. Codecov verification — PASS, no fixes

Workflow: `.claude/.github/workflows/example-coverage.yml` (v3-6's additive
file; `.claude` is its own git repo with a GitHub remote, so the path is a real
workflow location).

| Check | Result |
|---|---|
| Flags per app | `todo-be`, `ecommerce-be`, `todo-fe` — distinct, one per suite-owning app; `ecommerce-app-fe` correctly absent (no suite) |
| lcov paths | `files: <dir>/coverage/lcov.info` — all three apps emit exactly there (todo-be `coverageDirectory: '<rootDir>/../coverage'` with rootDir `src`; ec-be `coverage`; todo-fe vitest `reportsDirectory: 'coverage'`, `lcov` reporter); all three lcov files exist on disk |
| Referenced scripts | `npx jest --coverage` (jest+ts-jest in both BE devDeps), `npx vitest run --coverage` (vitest + `@vitest/coverage-v8@^2.1.2` in todo-fe devDeps), `npm ci` (lockfile present in each app dir) |
| Upload auth | `codecov/codecov-action@v5`, `use_oidc: true`, `id-token: write` — mirrors root `ci.yml`; `disable_search: true` with explicit `files` |

Known caveat carried from COVERAGE-SUMMARY (not a defect, out of scope): root
`codecov.yml` has no per-flag statuses, so example-app lines aggregate into the
repo-wide project gate.

## 4. FE canon spot-check — PASS

- `@starci/eslint-canon-fe@3.1.0` (`packages/eslint/fe`):
  `route-slot-fixed-name` is defined in `file-layout.mjs` and exported through
  `recommended` (all law rules set to `"error"`).
- `todo-app-frontend/eslint.config.mjs` attaches it via
  `starciFeConfig({layout: "single-app", ...})`; `ecommerce-app-fe/
  eslint.config.mjs` via `starciFeConfig({layout: "monorepo", ...})`.
  `starciFeConfig` applies the flat recommended map — the rule is active in
  both.
- `apps/shop/src/app/[lang]/page.tsx` is the fixed thin shell
  (`const Page = () => <ShopRootPage />; export default Page`) — the v4-5
  finding (redirect logic inside the slot) is resolved; `ShopRootPage` exists
  under `components/pages/`.

## Bottom line

- v4-4 report reconstructed with honest provenance; the only unproven v4-4 work
  is a fresh ec-fe sonar scan.
- One stale doc ref fixed in ec-fe; all functional references post-v4-1 are
  clean.
- Codecov workflow verified end-to-end — nothing broken, nothing changed.
- Canon `route-slot-fixed-name` active in both FE apps; shop root slot
  conforms.
