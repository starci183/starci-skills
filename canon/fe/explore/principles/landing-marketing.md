# Landing and marketing surfaces — STRICT

Rules shared by every landing/marketing surface: what the design is allowed to assume about data,
how a surface is positioned, which visualisation library it may reach for, and how the copy reads.
Companion to [[single-source-render]], [[card]], [[no-uppercase-text]] and [[no-emoji]].

## 1. Design for the data that EXISTS, not for the ideal schema

A field that exists in the schema but is always `null` or empty in the content **may not be depended
on**. The layout has to look finished when the field is absent; use it opportunistically — render it
when present, drop it when not. Read the real seed data and the entity's nullability BEFORE picking a
pattern, rather than drawing a UI around images, authors, tags, search or counts the back end does
not supply.

- **Cover images null, content is text-only, so go TEXT-FIRST** — typography, whitespace and type
  scale carry the hierarchy. An image grid over null covers is a grid of empty boxes.
- **Few items (early stage) means one "featured anchor"** — a single editorial highlight plus a text
  list, so the page is not bare. Do not pick a "section per group/pillar" shape while most groups are
  still empty: 5 of 6 pillars empty looks broken. That shape is a v2.
- **Never invent data for the UI.** No back-end count means no "n bài" chip; no author means no
  byline. A chip or label reflects a REAL field or it is not there.
- **Spend the fields the FE is already ignoring** before asking the back end for new ones —
  `isPremium` becomes a "Members" tag, `sourceUrl` becomes a "đọc source ↗" button, a query on the
  same category becomes a "related" strip.
- **A landing page may only market a track, course or system that exists in the curriculum.** Check
  the real data (`.mount/data/courses/`) before putting a track, path or proof claim on the page — a
  ghost track that sounds impressive is a dead end for whoever clicks it. The "no CRUD" proof lists
  systems that are actually built as capstones, with challenge, capstone and module counts taken from
  the data.
- **Curated marketing copy** — the systems list, tiers, tracks — is an i18n constant distilled from
  the real curriculum, not a live query. The full dynamic list belongs on its own page, `/courses`.

## 2. Reframe the surface around the content that is really there; kill dead-bucket filters

When a surface's seed content has collapsed to one real kind — every blog post is `codebase` — the
POSITIONING and the TAXONOMY follow that content instead of preserving a generic frame. `/blog` is
"sổ tay kiến trúc backend", not "a learning blog across 6 pillars".

**Render a filter, category or facet only for a bucket that has items** (`items.length > 0`). A
filter pointing at an empty bucket is the §1 anti-pattern in another costume. The visible taxonomy is
derived from real content; the wide aspirational enum stays in the back end for later, and the front
end exposes only what is populated. Read the seed before settling the information architecture.

## 3. The landing renders curated TRACKS, not the course catalogue; one entity, one section

The landing tells a curated story — a few strong, representative tracks — rather than listing every
course, which only exposes the thin and empty ones. Position on DEPTH and structure, not breadth; the
searchable, enrollable catalogue lives at `/courses`.

**One entity gets exactly one section.** Two sections rendering the SAME N entities — a "Courses
card" grid and a "Roadmap tier" list over the same 3 tracks — is duplication. Merge them: each card
carries identity, tier/path and a "Vào khóa" CTA. Same instinct as [[single-source-render]] and
[[card]].

CTAs and tracks point at a REAL entity — a course-detail route whose slug matches the database — not
a generic catalogue link and never an invented slug. Module counts and other numbers come from the
curriculum.

## 4. An illustrative sample card is STATIC; a product screenshot is a `ShowcaseMockup`

A card or block playing the role of "example" — a sample profile, an example result, a product
preview — is rendered STATIC from a hard-coded constant plus i18n labels, with no API call. It is a
photograph of the product used to sell a story, not one real user's data, so it is always complete
and attractive, has no loading, empty or error state, and drags no back-end contract behind it.

Because it is openly an illustration, it MAY use plausible illustrative numbers (a CV scored 87/100)
to give the card weight. That is the opposite of a card showing a REAL user, where numbers may never
be invented and only real fields appear. Do not impersonate a real person: use an illustrative
persona, and do not link to a real profile.

A card that says "this is a screen of the product" — a sample profile, leaderboard or submission —
is wrapped in the `ShowcaseMockup` block: browser chrome with mac dots and an address bar carrying a
URL that reads as real, `starci.academy/profile/<slug>`. The chrome and the URL are the signal that
this is a running product rather than a bare card. The content inside is GROUNDED in the real page —
read the actual page's component and mirror its recognisable elements, with the URL matching the real
route — never an invented layout.

The distinction, in one line: a card holding the page's real data (a record, a receipt) is a
`SectionCard` or an ordinary Card; a card that is a snapshot of a screen on the landing page is a
`ShowcaseMockup` mini-web; a sample data object is a static constant.

An API call is still right when the block is genuine PROOF — a live "N kỹ sư sẵn sàng" count, real
avatars. Then the number is real and honestly gated (hidden below a minimum). Proof means a real
number with a gate; illustration means static.

## 5. A section that PROMISES public accountability has to show evidence

A section promising to work in public or to grade its own quality has to keep the promise. The floor
is the promise plus links framed as "đừng tin, đi mà kiểm" — GitHub and the blog as evidence, not as
decoration. Better is to SHOW a real artifact: the latest technical note, an activity heatmap, the N
systems already built. A section that promises openness and shows nothing is the weakest section on
the page. Show an artifact only when real data exists (§1): before the hook is wired, keep it
editorial, then upgrade from telling to showing once it is.

Do not repeat a section that already exists — a founder section does not re-list the systems or
courses that already have their own sections ([[single-source-render]]).

## 6. A public infrastructure showcase is grounded but must not leak live production state

A public surface drawing the architecture is grounded in real components and real wiring — names and
numbers are not invented — but it must **not expose live up/down/latency state of production**.
"Kafka down / Redis 0 keys" on a public page is a signal to an attacker. Grounded-in-data does not
mean expose everything.

One block, two modes. **Public**: a curated topology with decorative "alive" animation that always
reads operational, bound to no realtime down-state. **Real live**: per-component status and latency,
gated behind admin auth at `/status`. The public showcase therefore needs no back-end health query —
before reflexively building a public live-health endpoint, ask who is looking and what it reveals.

## 7. Visualisation libraries: 2D graphs are `@xyflow/react` plus `d3-force`; 3D hero is R3F

**A 2D graph or network visualisation** (knowledge graph, force-directed) uses `@xyflow/react`,
already in the repo, with `d3-force` for layout only. Do not add a new WebGL graph library
(react-force-graph, sigma, cosmograph) unless the scale passes a few hundred nodes or genuinely needs
the GPU. The reason is not just dependency count: with xyflow a **node is a React component**, so
glow, colour and brand follow the design tokens, while a canvas has to be hand-painted and is hard to
theme and to make accessible.

**The exception is a genuine 3D hero** — an architecture scene with real depth, a globe — where
R3F/three.js is the right tool and xyflow simply cannot do it. Conditions: it is real 3D rather than a
shaded flat node graph; there is exactly ONE such hero, loaded through `dynamic(ssr:false)`; and there
is precedent in the repo. 3D for the hero, xyflow for 2D browsing, and the two do not mix. The block
is shared across its call sites rather than cloned.

**A static or decorative diagram** (a hero, a fixed layout) is CSS keyframes or plain Framer — packets
running along a wire, marching ants — and does not pull React Flow in for a static picture, which is a
vanity dependency. React Flow is for INTERACTIVE diagrams. A component already using Framer keeps
Framer for new motion, so there is one animation system and one `useReducedMotion`; CSS `@keyframes`
is for isolated pure decoration.

## 8. An interactive showpiece is a legitimate flex; when it looks bad, CONTAIN it rather than kill it

When a visualisation looks bad, separate the CONCEPT from the EXECUTION before deciding to drop it.
Is the idea wrong, or is the execution wrong — full-bleed sprawl, chaotic layout? Usually it is the
execution: contain it and tune it, and keep the concept. Do not jump straight to "replace it with a
grid".

**One interactive showpiece on the landing page — a graph, an animation, a 3D scene — is a valid flex
when the product being sold is engineering quality.** A live force-graph demonstrates the engineering
it is claiming, which is stronger on-brand proof than a competent, boring grid. What keeps it from
being vanity: it is CONTAINED and compact (bounded, not sprawling), grounded in real data, and serves
the message.

Two ways to contain a full-bleed showpiece: wrap it in a bounded, centred frame (`max-w`,
`rounded-3xl border`); or split the section, showpiece on one half and copy plus CTA on the other. A
narrower frame FORCES a re-tune of layout and physics — reduce size variance, increase collide
padding, keep labels from overflowing, consider capping the element count with a "+N", re-centre and
re-zoom. A narrow width does not become attractive by itself.

Do not let "clean" kill "flex" by reflex. A landing page is marketing, and sometimes wow beats
scan-speed. Ask what the section is for — showing off engineering keeps the contained showpiece,
fast scanning takes the grid — instead of assuming clean is correct.

## 9. N items sharing one AXIS become a matrix; the axis is drawn once

Three or more items sharing the same set of COLUMNS — tiers, phases, comparison criteria — render as
a MATRIX: the shared axis is the column header, drawn exactly once, and each item is a ROW whose
first cell is its identity. Do not repeat the same ladder or tier list inside every card; the
repetition is noise and it hides the very message that these items share one structure. A matrix
turns the shared part into a visual axis, so the reader sees "same thinking, different content".
Same family as [[single-source-render]] and [[card]].

Do not use a matrix when the items do NOT share an axis (each has a different structure — use ordinary
cards) or when there are only one or two items. A matrix is not `TabsCard` or `SegmentedControl`,
which pick one of N; a matrix displays many items side by side for comparison. The implementation is
the HeroUI `Table` compound.

## 10. Vietnamese UI and landing copy: no English filler, translate for MEANING, keep labels in step

**A Vietnamese sentence does not carry an English word that already has a good Vietnamese one** —
`build` becomes `dựng`, `diagram-first` becomes `bắt đầu từ sơ đồ`. English stays only for standard
technical terms: API, CI/CD, production, capstone, traffic, sharding, idempotency, leaderboard. The
test is whether the word is ordinary vocabulary with a Vietnamese equivalent (translate) or industry
terminology the audience already reads in English (keep).

**Translate the MEANING, not the words.** "design for failure" is "thiết kế để chịu được sự cố", not
"thiết kế cho thất bại". An English idiom translated literally reads wrong; find the natural
Vietnamese phrasing with the same meaning.

**Labels and stats in one row stay in step** — comparable length and structure. One over-long label
breaks the editorial rhythm: beside "Học viên · Bài học", "Huy hiệu đã trao" becomes "Huy hiệu".

**Keep deliberate wordplay and voice** where it already works — smooth it, do not flatten it. Copy
edits touch `vi.json` only (`en.json` stays English) and must leave valid JSON. See also
[[no-uppercase-text]] and [[no-emoji]].
