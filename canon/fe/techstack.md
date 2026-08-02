---
description: Names the concrete technology this front-end canon is written against — Next.js App Router, React, TypeScript, HeroUI, Tailwind, SWR, Apollo/GraphQL, Zustand, Storybook — and, for each, which enforce/authoring file grounds it. Use this when a rule elsewhere in canon/fe says "the request layer" or "the store" and the concrete library behind that phrase needs naming; when onboarding to this codebase and the question is "what is this actually built out of"; when writing a new canon rule and the choice is between naming a library and staying portable; or when a dependency is about to change and every file it grounds needs finding first. Not for how to write the idiom — each enforce/authoring file linked below does that. Not for which component or tier a shape of data becomes (explore/component/) or which shell a surface gets (explore/layouts/) — those are design questions, not stack questions.
---

# FE tech stack — the one place a concrete name is said out loud

Everywhere else in this canon, a rule is written to survive the stack changing under it: "the
request layer," "the store," "the tier a component belongs to." That is deliberate — a rule that
names its reason can be judged against a framework nobody has picked yet. This file is the one
exception. It says, once, what the portable language above concretely resolves to on this app, so a
reader can turn "the store" into `zustand` without guessing, and so that if one of these is ever
swapped, this is the one file to edit and the table below is the list of what else needs a re-read.

| Layer | Technology | What it is for | Grounds |
|---|---|---|---|
| Framework | Next.js, App Router | the file-system router and the segment conventions (`layout`, `page`, `loading`, `error`) a route is built out of | [`enforce/authoring/routing.md`](enforce/authoring/routing.md) |
| UI library | React | the component model the seven-tier system is written in — a tier is a React component with a fixed contract, not a framework-neutral abstraction | [`enforce/tiers/architecture.md`](enforce/tiers/architecture.md) |
| Language | TypeScript, `strict: true` | the type system every prop, hook return, and narrowed `unknown` in this canon assumes | [`enforce/authoring/type-safety.md`](enforce/authoring/type-safety.md) |
| Component kit | HeroUI (`@heroui/react`) | the constrained primitive an atom wraps rather than reimplements — `cn()` for class-joining, the compound components an atom's states are built from | [`enforce/tiers/atom.md`](enforce/tiers/atom.md), [`enforce/authoring/styling-tailwind.md`](enforce/authoring/styling-tailwind.md) |
| Styling | Tailwind | utility classes over semantic CSS-variable tokens — no raw hex, no CSS-in-JS | [`enforce/authoring/styling-tailwind.md`](enforce/authoring/styling-tailwind.md) |
| Data — read | SWR | the cache and revalidation layer every read hook is built on | [`enforce/authoring/async-data.md`](enforce/authoring/async-data.md) |
| Data — wire | Apollo, GraphQL | the query language and client every request — read or write — is shaped as, called through `runGraphQL` | [`enforce/authoring/async-data.md`](enforce/authoring/async-data.md) |
| Client state | Zustand | cross-cutting client state that outlives one component tree — overlays, cart, the pieces a server response does not own | [`enforce/authoring/state-management.md`](enforce/authoring/state-management.md) |
| Design system | Storybook | where a component is authored and storied before it is anything in the app — the source of truth `sync.md` mirrors into `src/` | [`storybook.md`](storybook.md), [`enforce/authoring/storybook-stories.md`](enforce/authoring/storybook-stories.md) |

## Reading this table

Each row names a convention, not a preference. "HeroUI grounds `atom.md`" means the atom tier's
shape — one indivisible element wrapping one constrained primitive — is not an arbitrary boundary;
it is where this specific kit's compound components stop being safe to take apart further. Swap
HeroUI for another kit and the tier still holds, but `atom.md`'s worked examples would need
rewriting against the new primitive, which is exactly the kind of consequence this file exists to
make findable in one place instead of forty.

Nothing here is a tutorial for any of these libraries — their own documentation is that. This is
the map from the portable word to the concrete name, and back.
