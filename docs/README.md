# StarCi skills docs — Nextra

The site is generated from the tree; nothing under `content/` is hand-authored.

A paired module keeps three separate source records:

```text
compilers/principles/gap/
├─ en.md       # EN — published in Nextra
├─ vi.md       # VI — published in Nextra
└─ context.md  # agent runtime only — not published in Nextra
```

A skill directory publishes `en.md` as EN, `vi.md` as VI, and its binding `SKILL.md` as Agent (EN).

Which shelves are public is decided in one place, [`publication.mjs`](publication.mjs). A new shelf
becomes a documented shelf by adding one entry there — no page, no route, no sidebar to write.

Operator procedures live under `../runbooks/` as paired `en.md`/`vi.md` records and publish as the
`Runbooks` shelf. They reference repository wrappers and encrypted record names, never runtime values.

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
[`components/CodeUiTabs/examples.js`](components/CodeUiTabs/examples.js). The registry is
empty until v3 has examples to show; an unknown id renders a visible notice rather than failing the
build.

Each published archetype leaf carries a self-contained `template.html` beside its `en.md`, `vi.md`
and `context.md`. `sync` copies that file byte-for-byte to
`public/template-assets/archetypes/<family>/<archetype>/template.html` and generates a searchable
Nextra `Template` page that displays it through a sandboxed iframe. Templates may use inline scripts,
but they must include their responsive CSS locally and must not depend on network resources or inline
HTML event-handler attributes.

Do not edit generated files under `content/`, `.academy-src/`, `public/vendor/` or
`public/template-assets/archetypes/`.
