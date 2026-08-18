// What the v3 trust tree publishes.
//
// The site is generated, never hand-authored: `npm run sync` reads the records under `.claude/`
// and writes `content/`. This file is the only place that decides WHICH shelves are public, so a
// new shelf becomes a documented shelf by adding one entry here — no page, no sidebar, no route.
//
//   source      path under .claude/, and the route itself: `compilers/principles` publishes at
//               /compilers/principles, so a page's address is the directory it came from
//   title       sidebar and heading label
//   description one line under the shelf heading
//
// A module is any directory holding `en.md`, or a skill directory holding its required `SKILL.md`.
// That file is the binding record and the module's own page. `vi.md` beside it is published as the
// human guide; a module without one simply has no second page. One level of family nesting is
// allowed, so `laws/b1-one-surface-owner` publishes with `laws` as its own sidebar group.
export const groups = [
  {
    source: "runbooks",
    title: "Runbooks",
    description: "Executable operator guides for every StarCi service and external integration: provision, start, verify, rotate, stop and recover without exposing credentials.",
  },
  {
    source: "compilers/principles",
    title: "Principles",
    description: "Ground rules: each module decides one className from a business relationship, never from how it looks.",
  },
  {
    source: "skills",
    title: "Skills",
    description: "What every skill must print, ask and record — the reporting shape all nine capabilities share.",
  },
  {
    source: "contexts",
    title: "Contexts",
    description: "Location facts: where source is read from, and where in-progress state is written.",
  },
  {
    source: "brainstorms/directions",
    title: "Directions",
    description: "From live product tokens and brand evidence to 3–4 visual directions; the selected object is embedded in the layout rather than approved under a second hash.",
  },
  {
    source: "brainstorms/layouts",
    title: "Layouts",
    description: "From one selected direction and a business request to 3–4 structural layout JSON candidates — one layout hash binds both.",
  },
  {
    source: "brainstorms/blocks",
    title: "Blocks",
    description: "From an accepted region to 3–4 block anatomies: parts, repeats, states and who owns the data.",
  },
  {
    source: "gates/fe/lints",
    title: "FE lints",
    description: "Machine-rejectable frontend violations: what a checker refuses, and the exact evidence it refuses on.",
  },
  {
    source: "compilers/patterns/fe",
    title: "FE patterns",
    description: "From an accepted shape to frontend source architecture: where a file lives and what it is allowed to import.",
  },
  {
    source: "gates/be/lints",
    title: "BE lints",
    description: "Machine-rejectable backend violations: what a checker refuses, and the exact evidence it refuses on.",
  },
  {
    source: "compilers/patterns/be",
    title: "BE patterns",
    description: "From an accepted capability to backend source architecture: module layering, transport, data access and failure.",
  },
];

// The public brief is deliberately separate from INDEX.md. INDEX is the binding agent bootstrap;
// this source is a short reader-facing capability map and restates no module law.
export const indexSource = "docs/brief.md";
