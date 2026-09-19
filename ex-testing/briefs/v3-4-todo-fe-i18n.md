# v3-4 — todo-fe: i18n (đa ngôn ngữ) + dark/light theme, academy pattern
Read `briefs/v3-HEADER.md` first.

APP: `examples/todo-app-frontend`
SCOPE: `src/app/**`, `src/i18n/**`, `src/messages/**`, `src/modules/theme/**`,
`src/components/**` (locale/theme UI only), `package.json`, middleware/proxy files at app root,
`ex-testing/lint/**`. Do NOT touch other apps' dirs; v3-2 lints this app — avoid editing files
it's likely fixing (core feature components); your NEW files are yours.
REFERENCE (copy the pattern, not the content): `D:/Repositories/starci-academy-fe`:
  - `src/i18n/{config,routing,request,navigation}.ts` — next-intl setup, LOCALES=["en","vi"]
  - `src/messages/{en,vi}.json` — dictionary files
  - `src/app/[lang]/` — locale-prefixed routing
  - `src/modules/theme/` — dark/light theme module

## Mission
1. Install `next-intl` (version compatible with the app's Next version — check package.json;
   academy-fe's version is the reference). Add theme deps ONLY if academy uses a lib
   (check src/modules/theme imports — next-themes? custom provider? match it).
2. Port i18n: `src/i18n/` config+routing+request+navigation; `src/messages/en.json` + `vi.json`
   — extract THIS app's real UI strings into the dictionaries (en + vi translations;
   vi.json is where Vietnamese legitimately lives — nowhere else).
3. Restructure routing to `[lang]` segment like academy (`src/app/[lang]/...`) with locale
   negotiation (middleware or the pattern academy uses — follow it).
4. Port dark/light theme: `src/modules/theme/` + provider wiring + a toggle component —
   match academy's mechanism (class-based? data attr? CSS vars?) so both apps behave alike.
5. All NEW code in English; dictionaries carry the locales.
6. Verify: `npm run build` (or `next build`) passes; manual smoke notes in report;
   `npx tsc --noEmit` clean.
7. Marker: `ex-testing/lint/i18n-todo-fe.done`.
Report: strings extracted (count), routes moved, theme mechanism, files touched.
