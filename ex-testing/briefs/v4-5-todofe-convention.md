# Lane v4-5 — todo-fe verification + FE convention audit

SCOPE: write/edit only inside `examples/todo-app-frontend/**` and `ex-testing/lint/v4-5-*.md`. For `examples/ecommerce-app-fe/**` you are READ-ONLY — audit findings go in your report; another lane owns its edits.

## Context

`todo-app-frontend` = single Next.js app; `ecommerce-app-fe` = monorepo (`apps/landing`, `apps/shop`, shared code under a `types/`→`packages/shared/src/` migration by another lane — audit whatever layout exists at read time).

The FE convention (from `starci-academy-fe`, recorded in `.claude/ex-testing/FE-CONVENTION.md` — read it first):

- Route tree `src/app/` (or `apps/*/src/app/`) holds ONLY framework slots; `page.tsx` exports a fixed `const Page = () => <XxxPage />` thin shell (canon rule `starci-fe/route-slot-fixed-name`); `layout.tsx` → `Layout` — the ROOT `[lang]/layout.tsx` legitimately does server-side locale wiring (html/body/providers/getMessages — that is the academy pattern, not a violation); non-root layouts stay thin.
- `components/{pages,layouts,overlays}/<Xxx>/` = 2-file surface: `index.tsx` (connected: reads params/hooks/queries, derives state, renders twin) + `component.tsx` (pure `XxxBase`-style twin receiving `{state, props, on}` — `state` is a union like `"loading"|"failed"|"not-found"|"ready"`); layouts' index receives only `{children}`/`{content}`.
- `components/{leaves,branches,composites,blocks}/` keep `isLoading?: boolean` — no state unions.
- i18n: `next-intl`, `app/[lang]` routing, `LOCALES = ["en","vi"]`, messages at `src/messages/{en,vi}.json` (todo-fe) or shared messages package (ec-fe); Vietnamese ONLY inside message/locale files; tests and source are English.
- Theme: dark/light provider (`NorthwindThemeProvider` / `src/modules/theme`), `suppressHydrationWarning` on `<html>`.

## Tasks

1. todo-fe gates: `npx eslint .` → 0, `npx tsc --noEmit` → clean, `npx vitest run` → all green, `npx vitest run --coverage` produces `coverage/lcov.info`.
2. Audit todo-fe against the convention: every `page.tsx`/`layout.tsx` thin with fixed names; every surface folder has index+component split with `state` union on the pure twin; lower tiers use `isLoading`; no Vietnamese outside `src/messages/`; specs English. Fix drift directly.
3. Audit ec-fe READ-ONLY for the same convention (note: a parallel lane is restructuring its shared package — report what's true at read time): write findings (file + violation + fix) to your report for that lane/maintainer to apply.
4. Confirm `vi.json` actually contains Vietnamese (not English placeholders) and `en.json` is complete for every key used.
5. Report to `D:/Repositories/starci-academy-backend/.claude/ex-testing/lint/v4-5-REPORT.md`: gate results, drift fixed in todo-fe, drift found in ec-fe (with file list).

## Rules

- Do not disable any `starci-fe/*` rule. English everywhere except message files.
- Follow existing style: double quotes, no semicolons, indent 4, `Array<T>`.
