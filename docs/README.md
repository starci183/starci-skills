# StarCi trust v3 docs — Nextra

The site is generated from the v3 trust tree; nothing under `content/` is hand-authored.

A module is a directory holding `en.md` — the binding rules an agent reads, and the module's own
page — with `vi.md` beside it as the human guide:

```text
compilers/principles/gap/
├─ en.md   # binding rules, English, for the agent
└─ vi.md   # Vietnamese guide: the business situation behind each code
```

Which shelves are public is decided in one place, [`publication.mjs`](publication.mjs). A new shelf
becomes a documented shelf by adding one entry there — no page, no route, no sidebar to write.

```bash
npm install
npm run sync
npm run dev    # http://localhost:3032
npm run build
```

`sync` regenerates `content/` from the records, copies the Academy frontend source into
`.academy-src/` (so Tailwind and live previews compile against the real components), and vendors the
HeroUI stylesheet. Run it after changing a source record; `dev`, `build` and `serve` run it first.

Live examples in a record use `<CodeUiTabs example="…" />`, resolved from
[`src/components/CodeUiTabs/examples.js`](src/components/CodeUiTabs/examples.js). The registry is
empty until v3 has examples to show; an unknown id renders a visible notice rather than failing the
build.

Do not edit generated files under `content/`, `.academy-src/` or `public/vendor/`.
