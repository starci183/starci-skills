// What the v3 trust tree publishes.
//
// The site is generated, never hand-authored: `npm run sync` reads the records under `.claude/`
// and writes `content/`. This file is the only place that decides WHICH shelves are public, so a
// new shelf becomes a documented shelf by adding one entry here — no page, no sidebar, no route.
//
//   source      physical path under .claude/
//   route       stable public path; physical V5 namespaces never leak into published URLs
//   title       sidebar and heading label
//   description one line under the shelf heading
//
// A module is any directory holding `en.md`, or a skill directory holding its required `SKILL.md`.
// Paired modules publish `en.md` as EN and `vi.md` as VI. Their compact `context.md` remains an agent
// runtime record in the trust tree and is not published into Nextra navigation. Skills additionally
// publish their binding `SKILL.md` as Agent (EN). One level of family nesting is
// allowed, so `laws/b1-one-surface-owner` publishes with `laws` as its own sidebar group.
export const groups = [
  {
    source: "platform/mcp",
    route: "mcp",
    title: "MCP context",
    description: "Qdrant-backed additional context for routed StarCi sources: deterministic indexing, isolated role collections and read-only MCP launchers.",
  },
  {
    source: "platform/deployment",
    route: "deployment",
    title: "Deployment",
    description: "Portable .stacks intent, ignored .infra execution state, SSH host setup, declared domain drivers, immutable release and steady-state monitoring.",
  },
  {
    source: "platform/readiness/initialization",
    route: "readiness/initialization",
    title: "Initialization readiness",
    description: "One identity-first registry for Source bootstrap, workspace routes and worktree state.",
  },
  {
    source: "platform/readiness/staleness",
    route: "readiness/staleness",
    title: "Staleness readiness",
    description: "One shared taxonomy and category modules: stale-list reads evidence, while repair applies the same module's inventory, action and proof.",
  },
  {
    source: "platform/runbooks",
    route: "runbooks",
    title: "Runbooks",
    description: "Executable operator guides for every StarCi service and external integration: provision, start, verify, rotate, stop and recover without exposing credentials.",
  },
  {
    source: "runtime/standards/backend",
    route: "standards/backend",
    title: "Backend standards",
    description: "Stable v4 pattern bindings and pattern-to-gate-to-machine accountability for approved backend source.",
  },
  {
    source: "runtime/standards/frontend",
    route: "standards/frontend",
    title: "Frontend standards",
    description: "Stable v4 accountability between frontend design/source patterns, gates and the published lint canon.",
  },
  {
    source: "knowledge/archetypes",
    route: "archetypes",
    title: "Page archetypes",
    description: "Reusable dominant-task, region-graph and responsive page topologies resolved before product Grammar and Principles.",
    htmlTemplate: true,
  },
  {
    source: "knowledge/grammars",
    route: "grammars",
    title: "Grammars",
    description: "Explicit product-family authority: closed facts, deterministic outcomes, owner profiles, durable capsules, cases and templates.",
  },
  {
    source: "knowledge/compilers/principles",
    route: "compilers/principles",
    title: "Principles",
    description: "Ground rules: each module decides one className from a business relationship, never from how it looks.",
  },
  {
    source: "knowledge/requests",
    route: "requests",
    title: "Design requests",
    description: "Source-first frontend feedback, rejected attempts, and the durable queue for grammar/principle learning.",
  },
  {
    source: "skills",
    title: "Skills",
    description: "What every skill must print, ask and record — the reporting shape all nineteen capabilities share.",
  },
  {
    source: "runtime/orchestration",
    route: "orchestration",
    title: "Agent orchestration",
    description: "One coordinator/worker contract, explicit Claude and Codex adapters, and machine-validated phase maps for every physical StarCi skill.",
  },
  {
    source: "knowledge/contexts",
    route: "contexts",
    title: "Contexts",
    description: "Location facts: where source is read from, and where in-progress state is written.",
  },
  {
    source: "knowledge/brainstorms/directions",
    route: "brainstorms/directions",
    title: "Directions",
    description: "From live product tokens and brand evidence to 3–4 visual directions and one evidence-backed recommendation, with no separate approval checkpoint.",
  },
  {
    source: "knowledge/brainstorms/layouts",
    route: "brainstorms/layouts",
    title: "Layouts",
    description: "From one recommended direction and a business request to 3–4 structural layout JSON candidates — one owner approval binds both.",
  },
  {
    source: "knowledge/brainstorms/blocks",
    route: "brainstorms/blocks",
    title: "Blocks",
    description: "From an accepted region to 3–4 block anatomies: parts, repeats, states and who owns the data.",
  },
  {
    source: "runtime/gates/fe/lints",
    route: "gates/fe/lints",
    title: "FE lints",
    description: "Machine-rejectable frontend violations: what a checker refuses, and the exact evidence it refuses on.",
  },
  {
    source: "knowledge/compilers/patterns/fe",
    route: "compilers/patterns/fe",
    title: "FE patterns",
    description: "From an accepted shape to frontend source architecture: where a file lives and what it is allowed to import.",
  },
  {
    source: "runtime/gates/be/lints",
    route: "gates/be/lints",
    title: "BE lints",
    description: "Machine-rejectable backend violations: what a checker refuses, and the exact evidence it refuses on.",
  },
  {
    source: "knowledge/compilers/patterns/be",
    route: "compilers/patterns/be",
    title: "BE patterns",
    description: "From an accepted capability to backend source architecture: module layering, transport, data access and failure.",
  },
];

// The public brief is deliberately separate from INDEX.md. INDEX is the binding agent bootstrap;
// this source is a short reader-facing capability map and restates no module law.
export const indexSource = "docs/brief.md";
