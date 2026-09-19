# v3-3 — ec-fe: canon-fe setup + fix (MONOREPO)
Read `briefs/v3-HEADER.md` first.

APP: `examples/ecommerce-app-fe` (apps/landing + apps/shop + types/ + scripts/)
SCOPE: its `eslint.config.mjs`, `package.json`, `package-lock.json`, `apps/**`, `types/**`,
`ex-testing/lint/**`
NOTE: v3-5 works in THIS SAME APP on i18n/theme — stay out of `**/i18n/**`, `**/messages/**`,
`**/theme/**` until `ex-testing/lint/i18n-ec-fe.done` exists.

## Mission — same as v3-2 EXCEPT:
- NOT single-app. Read canon-fe docs in node_modules for `layout` values; pick the one for
  `apps/*` workspaces (verify in the package's dist types/README — don't guess).
- Globs: `apps/**/*.{ts,tsx}` + `types/**/*.ts`; `scripts/**` gets node globals.
- Ledger `ex-testing/lint/debt-ec-fe.json`; marker `ex-testing/lint/setup-ec-fe.done`.
Report: layout chosen + why, per-rule counts, files touched.
