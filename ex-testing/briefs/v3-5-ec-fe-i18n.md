# v3-5 — ec-fe: i18n + dark/light theme, academy pattern (MONOREPO)
Read `briefs/v3-HEADER.md` first.

APP: `examples/ecommerce-app-fe` (apps/landing + apps/shop + shared types/)
SCOPE: `apps/**`, `types/**`, workspace package.jsons, `ex-testing/lint/**`.
v3-3 lints this app — same non-overlap rule as v3-4: your new files are yours.
REFERENCE: same `D:/Repositories/starci-academy-fe` tree as v3-4.

## Mission — same as v3-4 with monorepo deltas:
- Decide: shared i18n config in `types/` (or a shared package) vs per-app copies — pick
  whatever keeps `landing` and `shop` consistent WITHOUT duplicating dictionaries
  (single source of messages, both apps consume).
- `[lang]` routing inside each app's router root.
- Theme module shared the same way; toggle in both apps.
- `ex-testing/lint/i18n-ec-fe.done` marker.
Report: sharing decision + why, strings extracted, files touched.
