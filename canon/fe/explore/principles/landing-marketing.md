# Landing and marketing surfaces — STRICT

Rules shared by every landing or marketing surface: what the design is allowed to assume about data,
how a surface is positioned, which visualisation library it may reach for, and how the copy reads.
Companion to [[single-source-render]], [[card]], [[no-uppercase-text]] and [[no-emoji]].

## 1. Design for the data that EXISTS, not for the ideal schema

A field that exists in the schema but is always `null` or empty in the real content **may not be
depended on**. The layout has to look finished when the field is absent; use it opportunistically —
render it when present, drop it when not. This is Refactoring UI's "design with real data" applied
one level earlier: read the seeded content and the entity's nullability BEFORE picking a pattern,
rather than drawing a UI around images, authors, tags, search or counts the back end does not supply.

- **Cover images are null and the content is text-only, so go TEXT-FIRST** — typography, whitespace
  and type scale carry the hierarchy. An image grid over null covers is a grid of empty boxes.
- **Few items means one "featured anchor"** — a single editorial highlight plus a text list, so the
  page is not bare. Do not pick a "section per category" shape while most categories are still empty:
  five of six empty reads as broken. That shape is a later version of the page.
- **Never invent data for the UI.** No back-end count means no "42 items" chip; no author means no
  byline. A chip or a label reflects a REAL field or it is not there.
- **Spend the fields the front end is already ignoring** before asking the back end for new ones — a
  `tier` flag becomes a "Members" tag, a `sourceUrl` becomes a "read the source" link, a query on the
  same category becomes a "related" strip.
- **A landing page may only market something that exists in the catalogue.** Check the real records
  before putting an offer, a plan or a proof claim on the page; a category that sounds impressive and
  resolves to nothing is a dead end for whoever clicks it, and it is the cheapest kind of broken
  promise to make.
- **Curated marketing copy** — the plan comparison, the flagship list — is a translated constant
  distilled from the real catalogue, not a live query. The full dynamic list belongs on the catalogue
  page it already has.

## 2. Reframe the surface around the content that is really there; kill dead-bucket filters

When a surface's real content has collapsed to one kind — every article in the library turns out to
be a case study — the POSITIONING and the TAXONOMY follow that content instead of preserving a
generic frame. A library of six case studies is a case-study library, not "our writing across six
topics".

**Render a filter, category or facet only for a bucket that has items** (`items.length > 0`). A
filter pointing at an empty bucket is the section-1 anti-pattern in another costume, and Baymard's
filtering research is consistent that a zero-result path is where people quit rather than back up.
The visible taxonomy is derived from real content; the wide aspirational enum stays in the back end
for later, and the front end exposes only what is populated. Read the content before settling the
information architecture.

## 3. The landing renders a curated selection, not the whole catalogue; one entity, one section

The landing tells a curated story — a few strong, representative items — rather than listing
everything, which only exposes the thin and empty ones. Hick's Law is the mechanism: choice time
grows with the number of options, and a landing page is trying to produce one decision, not a
comparison. Position on depth, not breadth; the searchable, filterable catalogue is its own page.

**One entity gets exactly one section.** Two sections rendering the SAME N entities — a card grid and
a "how they compare" list over the same three plans — is duplication. Merge them: each card carries
identity, position and its own call to action. Same instinct as [[single-source-render]] and
[[card]].

Calls to action point at a REAL record — a detail route whose identifier resolves — not a generic
catalogue link and never an invented slug.

## 4. An illustrative sample card is STATIC; a product screenshot gets window chrome

A card or block playing the role of "example" — a sample profile, an example result, a preview of the
output — is rendered STATIC from a hard-coded constant plus translated labels, with no API call. It
is a photograph of the product used to sell a story, not one real customer's data, so it is always
complete and attractive, has no loading, empty or error state, and drags no back-end contract behind
it.

Because it is openly an illustration, it MAY use plausible illustrative numbers (a report scored
87/100) to give the card weight. That is the opposite of a card showing a REAL person, where numbers
may never be invented and only real fields appear. Do not impersonate a real individual or company:
use an illustrative persona, and do not link it to a real profile.

A card that says "this is a screen of the product" is wrapped in a mockup frame — window chrome and
an address bar carrying a URL that reads as real. The chrome and the URL are the signal that this is
a running product rather than a bare card, and the content inside is GROUNDED in the real screen:
read the actual page and mirror its recognisable elements, with the URL matching the route that
exists. An invented layout inside browser chrome is a promise the product cannot keep at the moment
someone signs up.

The distinction in one line: a card holding the page's real data (a record, a receipt) is an ordinary
card; a card that is a snapshot of a screen is a mockup frame; a sample data object is a static
constant.

An API call is still right when the block is genuine PROOF — a live customer count, real avatars.
Then the number is real and honestly gated, hidden below a minimum rather than padded. Proof means a
real number with a gate; illustration means static.

## 5. A section that PROMISES public accountability has to show evidence

A section promising to work in the open, or to be judged on its own quality, has to keep the promise.
The floor is the promise plus links that invite verification — the public repository, the changelog,
the incident history — as evidence rather than as decoration. Better is to SHOW a real artifact: the
latest technical note, an activity graph, the systems already shipped. A section that promises
openness and shows nothing is the weakest section on the page, because it spends the reader's trust
and returns nothing for it. Show an artifact only when real data exists (section 1): before the data
is wired, keep the section editorial, then upgrade from telling to showing once it is.

Do not repeat a section that already exists — a founder or team section does not re-list the products
that already have their own section ([[single-source-render]]).

## 6. A public infrastructure showcase is grounded but must not leak live production state

A public surface drawing the architecture is grounded in real components and real wiring — names and
numbers are not invented — but it must **not expose live up, down or latency state of production**. A
public page reading "queue down, cache empty" is reconnaissance handed to an attacker.
Grounded-in-data does not mean expose everything.

One block, two modes. **Public**: a curated topology with decorative motion that always reads
operational and is bound to no realtime down-state. **Real live**: per-component status and latency,
behind authentication on a status page. The public showcase therefore needs no health query at all —
before reflexively building a public live-health endpoint, ask who is looking and what it reveals.

## 7. Visualisation libraries: 2D graphs are a DOM graph library, a 3D hero is WebGL

**A 2D graph or network visualisation** (a knowledge graph, a force-directed map) uses a DOM-based
graph library such as React Flow, with `d3-force` for layout only. Do not add a second WebGL graph
library unless the scale passes a few hundred nodes or genuinely needs the GPU. The reason is not
dependency count: in a DOM graph a **node is a component**, so glow, colour and brand follow the
design tokens and the node can hold real text, while a canvas has to be hand-painted and is hard to
theme and to make accessible.

**The exception is a genuine 3D hero** — a scene with real depth, a globe — where three.js is the
right tool and a DOM graph simply cannot do it. Conditions: it is real 3D rather than a shaded flat
node graph; there is exactly ONE such hero, loaded lazily and client-side only; and there is
precedent for the dependency. 3D for the hero, a DOM graph for 2D browsing, and the two do not mix.

**A static or decorative diagram** — a fixed hero picture, packets running along a wire — is CSS
keyframes or the animation library already in the project, and does not pull a graph engine in for a
static picture, which is a vanity dependency. A graph library is for INTERACTIVE diagrams. A surface
already using one animation library keeps it for new motion, so there is one motion system and one
place to honour `prefers-reduced-motion`.

## 8. An interactive showpiece is a legitimate flex; when it looks bad, CONTAIN it rather than kill it

When a visualisation looks bad, separate the CONCEPT from the EXECUTION before deciding to drop it.
Is the idea wrong, or is the execution wrong — full-bleed sprawl, chaotic layout? Usually it is the
execution: contain it and tune it, and keep the concept. Do not jump straight to "replace it with a
grid".

**One interactive showpiece on a landing page — a graph, an animation, a 3D scene — is a valid flex
when the thing being sold is engineering quality.** A live force-graph demonstrates the craft it is
claiming, which is stronger on-brand proof than a competent, boring grid. What keeps it from being
vanity: it is CONTAINED and compact, grounded in real data, and serves the message.

Two ways to contain a full-bleed showpiece: wrap it in a bounded, centred frame (a max width, a
rounded border); or split the section, showpiece on one half, copy and call to action on the other. A
narrower frame FORCES a re-tune of layout and physics — reduce size variance, increase collide
padding, keep labels from overflowing, consider capping the element count with a "+N", re-centre and
re-zoom. A narrow width does not become attractive by itself.

Do not let "clean" kill "flex" by reflex. A landing page is marketing, and sometimes wow beats
scan speed. Ask what the section is for — showing off craft keeps the contained showpiece, fast
scanning takes the grid — instead of assuming clean is correct.

## 9. N items sharing one AXIS become a matrix; the axis is drawn once

Three or more items sharing the same set of COLUMNS — plans, phases, comparison criteria — render as
a MATRIX: the shared axis is the column header, drawn exactly once, and each item is a ROW whose
first cell is its identity. Do not repeat the same criteria list inside every card; the repetition is
noise and it hides the very message that these items share one structure. A matrix turns the shared
part into a visual axis, so the reader sees "same thinking, different content" without being told.

Do not use a matrix when the items do NOT share an axis — each has a different structure, so use
ordinary cards — or when there are only one or two items. A matrix is not a tab set or a segmented
control, which pick one of N; a matrix displays many items side by side for comparison, and the
implementation is a plain table.

## 10. Localised copy: no filler loanwords, translate for MEANING, keep labels in step

**A sentence in the reader's own language does not carry a foreign word that already has a good
native equivalent.** The source language stays only for standard technical terms the audience already
reads untranslated — API, CI/CD, production, idempotency. The test is whether the word is ordinary
vocabulary with a native equivalent (translate it) or industry terminology (keep it).

**Translate the MEANING, not the words.** An idiom rendered word for word reads wrong in every target
language; find the natural phrasing that carries the same meaning, even when it shares no vocabulary
with the original.

**Labels and stats in one row stay in step** — comparable length and structure. One over-long label
breaks the editorial rhythm of a stat strip, and shortening it costs nothing that the surrounding
context does not already supply.

**Keep deliberate wordplay and voice** where it already works: smooth it, do not flatten it. A copy
edit touches the locale file it is fixing and leaves the others alone, and leaves valid JSON behind.
See also [[no-uppercase-text]] and [[no-emoji]].
