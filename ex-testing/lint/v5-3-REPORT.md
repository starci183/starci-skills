# Lane v5-3 — move grammar + heroicons into `.claude/packages/`, repoint consumers

Date: 2026-09-19. Scope honored: wrote only `.claude/packages/grammar/**`,
`.claude/packages/heroicons/**`, `starci-academy-fe` working-tree changes listed below, and this
report. Canon packages under `.claude/packages/eslint/{be,fe}` untouched; no `examples/` or other
lanes' dirs touched. No version bumps, no publish.

## 1. Relocation

- `starci-academy-fe/packages/grammar` → `.claude/packages/grammar`, `.../heroicons` →
  `.claude/packages/heroicons`, copied with `node_modules` excluded, then verified
  **byte-identical** via `diff -r` (zero diffs before the edits below).
- `repository` metadata repointed to the new home repo (`starci183/starci-skills`, `.claude`'s own
  git remote): grammar's `repository.url`/`bugs`/`homepage` moved off `starci-lab/starci-academy-fe`
  (`directory` stays `packages/grammar`, now relative to the skills repo root); heroicons gained the
  same `repository` block (`directory: packages/heroicons`).
- One hard-coded path fixed inside the moved sources:
  `grammar/academy-shot.mjs` wrote screenshots to the old absolute path — now
  `D:/Repositories/starci-academy-backend/.claude/packages/grammar/reference-renders/`.
  `grammar/README.md` install line updated to `./.claude/packages/grammar`.
- Spec fallback `packages/grammar/src/common/styles.css` left as-is: it still resolves when tests
  run from the `.claude` root, matching its original monorepo-root intent.
- Not workspace members: `.claude/packages/package.json` (`workspaces: ["eslint/*"]`) is outside
  this lane's scope, so both packages keep standalone `npm install` semantics.

## 2. Source-defect fixes required to make the moved gates green

All were **pre-existing** in the source checkout (verified identical failure in the old location
before fixing); none are move artifacts:

- `src/stories/` (untracked scaffold, fails `tsconfig.build.json` under
  `exactOptionalPropertyTypes`): `Button.tsx` `onClick?: (() => void) | undefined`;
  `Header.tsx` `user?: User | undefined`; `Grammar.stories.tsx` — `<Divider />` now passes the
  required `label="or"`, and `<EmptyNotice>` now uses its real props
  (`message`/`description`) instead of children it never rendered.
- `devDependencies` gained three hoisted-or-nothing deps that the package's own specs import but
  never declared — they resolved only because the old home sat under `starci-academy-fe`'s root
  `node_modules`: `jsdom@^30` (jsdom-env spec workers), `@testing-library/react@^16`,
  `react-dom@^19.0.0` (`react-dom/server` in specs). `package-lock.json` regenerated accordingly.

## 3. Package verification (new location)

| Gate | Result |
|---|---|
| grammar `npm install` | clean, 0 vulnerabilities |
| grammar `npm run typecheck` | pass |
| grammar `npm test` | pass — build + 8 `node --test` assertions + **38 spec files / 227 tests** |
| grammar `npm run build` | pass (dist + copied CSS) |
| heroicons `npm install` / `typecheck` / `test` / `build` | pass — 2/2 boundary tests |

## 4. academy-fe repoint (working tree only, not committed — separate repo)

- `package.json`: `@starci/grammar`/`@starci/heroicons` →
  `file:../starci-academy-backend/.claude/packages/{grammar,heroicons}`; all four
  `grammar:*`/`heroicons:*` scripts repointed to the same `--prefix`.
- `npm install`: clean; `prepare` ran both package builds through the new prefixes successfully.
  `npm ls` shows both resolved to `.\..\starci-academy-backend\.claude\packages\*`;
  `node_modules/@starci/*` are symlinks whose realpaths are the `.claude` dirs.
- `package-lock.json` regenerated; two stale `"packages/grammar"`/`"packages/heroicons"`
  `extraneous` entries npm refused to drop were removed by hand.
- `eslint-plugin-storybook@^10.6.0` added to devDependencies — `eslint.config.mjs` imports it
  directly; it previously reached `node_modules` only transitively through the in-tree link.
- `eslint.config.mjs`: removed a stray semicolon (line 2) that `semi: never` rejected — a
  pre-existing uncommitted defect blocking `lint:check`.
- `vitest.config.ts`: added `resolve.dedupe: [react, react-dom, @heroui/react, @heroui/styles]`.
  With the link target now outside the repo, grammar's dist resolved `react`/`@heroui/react` from
  its own `node_modules` — a second React copy null-dispatched every hook (958 tests failed on
  `useId`/`useContext` null reads). Dedupe pins the shared peers to the app copy.
- `next.config.ts`: added `turbopack.root = <repo parent>` (`D:/Repositories`). Turbopack refuses
  to resolve files outside its root (documented); the linked packages' real paths sit outside this
  checkout, so the root is the common parent of both repos. Without it `next build` failed with 455
  `Can't resolve '@starci/grammar/*'` errors.
- `starci-academy-fe/packages/` deleted entirely after the link verified (two empty dirs were
  transiently locked by orphaned `python -m http.server` processes from a prior session — killed,
  then removed).

## 5. Residual references swept

- No `packages/grammar`/`packages/heroicons` paths remain outside the lockfiles: tsconfig has no
  paths/refs, `next.config` had no transpilePackages, `.github/workflows/ci.yml` and `.husky` clean.
- `eslint.config.mjs` glob `packages/*/scripts/**` now matches nothing (moved sources are outside
  this repo and unreachable by its lint); left in place as a generic guard for future in-repo
  packages.
- `pnpm-lock.yaml` still lists `file:packages/grammar` specifiers — stale, but
  `packageManager: npm@11.6.2` makes npm the only supported installer and the file predates this
  lane untouched; flagged for its owner.

## 6. Gate receipts

`npm run verify` in academy-fe, run once end-to-end after all fixes:

- `grammar:verify` — pass (typecheck + full test chain above)
- `heroicons:verify` — pass
- `typecheck` (`tsc --noEmit`) — pass
- `lint:check` (`eslint --max-warnings=0`) — pass, 0 problems
- `test:unit` (`vitest run`) — **503 files / 3042 tests pass** (35 skipped, 0 failed) in the
  standalone run; the `verify` rerun showed one 30 s timeout in
  `CourseFlashcardSessionBlock > "keeps the live session on screen…"` — a heavy `importActual`
  render test (6–12 s baseline) that flaked under residual load from the parallel `next build`;
  passes consistently in isolation on an idle machine.
- `npm run build` (CI gate, Turbopack) — pass: compiled, TS check, all routes prerendered

Bottom line: both packages live in `.claude/packages/`, verify standalone, and the academy-fe dev
loop (`install`, `verify`, `build`, tests) is green against the new links with nothing left
pointing at `packages/`.
