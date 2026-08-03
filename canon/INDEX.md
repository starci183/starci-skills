# Canon — the map

This tree holds two kinds of thing, and keeping them apart is what stops either from rotting.

**Canon is prose.** It states a judgement and the reason behind it, so that a case its author never
saw can still be decided by someone reading it. A rule whose reason is written down survives contact
with a new situation; a bare imperative does not, and the reader either obeys it where it does not
belong or ignores it where it does.

**The executable half is a script or a data file, not a folder of its own.** Anything a machine can
check lives in `scripts/` — the gates, the rendered-tree runner, the search data — or, where the
values themselves need to travel with the prose that explains them, in a data file sitting beside
that prose, such as `canon/fe/explore/registry.mjs`. There used to be a separate `patterns/` tree for
this; it was retired, and every path below is the current one.

The division has a practical test. If a claim can fail a build, it belongs to a script or a registry.
If it can only be argued with, it lives in `canon/`. Where prose has to name a number — the pixel
values in `canon/fe/enforce/spacing/overview.md` — the prose says plainly that the registry is
authoritative and the prose is the side that is stale.

Paths below are written relative to the canon root, the `.claude/canon/` directory this file sits
under.

## Front end

Front-end canon is split into two lanes by one question: can a script decide whether the code obeys
this rule? `fe/README.md` is the front door that explains the split in full; what follows is a map so
a task can go straight to the shelf it needs.

Three files carry the reasoning that everything else assumes, and they answer three different
questions.

| File | Answers |
|---|---|
| [`fe/enforce/tiers/architecture.md`](fe/enforce/tiers/architecture.md) | which tier a component belongs to, what it may import, how a data-owning component is split into a presentational twin and a connected twin, and which component a shape of data becomes |
| [`fe/enforce/spacing/overview.md`](fe/enforce/spacing/overview.md) | why a seam or an inset is the number it is — the named layout concepts, in prose, beside the registry that holds their values |
| [`fe/enforce/testing.md`](fe/enforce/testing.md) | how the contract is checked: `data-tier`, `data-component`, `data-principles`, and the rendered-tree runner that measures computed style |

One law spans the whole front end: **no component reaches the app that was never a component and a
story in the design-system folder first.** The reasoning is in `fe/enforce/tiers/architecture.md`; the
enforcement is `scripts/gates/check-story-coverage.mjs`.

`explore/` is the creative lane — a judgement a person or a model makes, with no gate behind it.
`enforce/` is the strict lane — a gate goes red when the code disagrees. Each shelf below carries its
own index, because each is long enough that a copy of its table here would drift from the folder
within a month.

| Shelf | Answers |
|---|---|
| [`fe/explore/principles/`](fe/explore/principles/INDEX.md) | what the interface is allowed to say and do: accent as signal, one primary action, honest persuasion, hover affordance, design restraint, content voice, accessibility, and building for the data that exists |
| [`fe/explore/patterns/`](fe/explore/patterns/INDEX.md) | the recurring behaviours inside a shell: list anatomy, form flow, the three tiers of loading feedback, empty states, drawers, where a surface lands, and how a progress block is composed |
| [`fe/explore/layouts/`](fe/explore/layouts/INDEX.md) | which shell a surface gets and how its regions behave — the job-to-shell rule, the shell decision tree, the region vocabulary, responsive and adaptive behaviour, and one file per archetype grounded in a real route |
| [`fe/explore/foundations/`](fe/explore/foundations/INDEX.md) | which value out of a deliberately closed scale an element gets: gap, colour token, radius, elevation, breakpoint, z-index, motion, type, sticky offset, scrollbar gutter, and how wide content overflows |
| [`fe/explore/component/`](fe/explore/component/references/general-rules.md) | which component a shape of data becomes — `data/matrix.csv` is the queryable lookup, `references/traps.md` the per-section traps |
| [`fe/enforce/tiers/`](fe/enforce/tiers/architecture.md) | which tier is which, in full, with the presentational split (`split.md`) and what a story must render (`story.md`) |
| [`fe/enforce/spacing/`](fe/enforce/spacing/README.md) | the closed sets — gap, padding, margin, position, responsive — and the reasoning under each |
| [`fe/enforce/authoring/`](fe/enforce/authoring/INDEX.md) | how a line of code is spelled once the two decisions above are made — structure, props, imports, react idioms, state, async data, forms, styling, i18n, comments, and the four files grounded in public sources rather than a house count |
| [`fe/enforce/examples/`](fe/enforce/examples/atom.md) | one worked, real component per tier |

Three files sit beside the lanes rather than inside either:

- [`fe/storybook.md`](fe/storybook.md) — why the design system is the source of truth: a component is
  authored and storied there before it is anything in the app.
- [`fe/sync.md`](fe/sync.md) — the discipline that connects the two trees: how a storied component
  becomes a working twin in the app's own `src`, and why `src` never reaches into the design-system
  tree.
- [`fe/techstack.md`](fe/techstack.md) — the one file that says the portable language above ("the
  request layer," "the store," "the tier") in the name of the concrete technology it runs on today:
  Next.js, React, TypeScript, HeroUI, Tailwind, SWR, Apollo/GraphQL, Zustand, Storybook.

## Back end

Back-end canon took on the same two-lane shape as the front end. `be/INDEX.md` is the front door;
what follows is the short version.

| Shelf | Answers |
|---|---|
| [`be/explore/system-design/`](be/explore/system-design/INDEX.md) | the decisions taken before a line is spelled — module boundaries, API design, data access, auth and authz, caching, messaging and events, background jobs, CQRS and projections, resilience, observability. Ten files, anchored in public sources (Nygard, Fowler, Evans, the AWS Builders' Library, the RFCs) rather than in this repo's own `src/`, because the constraint is architectural rather than a house habit |
| [`be/enforce/authoring/`](be/enforce/authoring/INDEX.md) | how a line of backend code is spelled — naming and structure, error handling, comments, config and env, imports and format, type safety, validation. Seven files, most grounded in this codebase's own `src/` and recounted the way `HOW-TO-WRITE.md` requires |

The old four-shelf split — `concepts/`, `modules/`, `contracts/`, `conventions/` — is retired. Every
rule that lived there was carried into one of the two shelves above; nothing was dropped silently.

A third file sits beside the two shelves: [`be/techstack.md`](be/techstack.md) says, once, what the
portable language inside `explore/system-design/` ("the message broker," "the read model") runs on
today — NestJS, TypeORM, PostgreSQL, GraphQL, NATS, Kafka, Debezium, BullMQ, Keycloak, MinIO,
Elasticsearch.

## Where the executable half sits

| Path | What it is |
|---|---|
| `fe/explore/registry.mjs` | the registry: every named layout concept, the property it governs, and the value it must compute to |
| `scripts/runner/test-runner.ts` | the rendered-tree audit that measures the registry against the browser, after every story |
| `scripts/gates/check-*.mjs` | the source-reading gates, one per rule that can be decided by reading a file |
| `scripts/search/data/` | the tier table and the import matrix, queryable |
| `scripts/verify.mjs` | checks that the canon still describes the source it claims to describe |

The back end has no gates folder of its own: its machine-checkable half is held to eslint and `tsc`
directly, which is why `be/enforce/authoring/INDEX.md` states beside each rule whether a machine
already catches it rather than pointing at a script that does.

`verify.mjs` is the one to reach for before trusting a file you did not just write. Canon earns its
authority by naming a real file and a real count, and that is exactly what rots: the source moves,
the document does not, and nothing says so. A missing anchor is a failure — the rule points at
nothing. A drifted count is a warning — the rule is probably still true, but its evidence is stale
and a reader will quote the old number.

## Where the source is

Never write a machine path into any file here. A path is true on exactly one machine, and the failure
looks like success: files open, greps return, conclusions get drawn from the wrong tree. Ask instead:

```bash
node .claude/scripts/workspace/read-workspace-context.mjs fe.path
node .claude/scripts/workspace/read-workspace-context.mjs fe.design_system
node .claude/scripts/workspace/read-workspace-context.mjs be.path
```

Registering a source is `starci-setup-workspace` (`--fe`/`--be`, either or both). A missing context
exits non-zero and prints the command that fixes it.

## Reading order

There is none. Open the one file the task touches. These are not a curriculum, and a rule read out of
context is a rule applied where it does not belong.

Two things hold when they disagree with you. **If a rule and the source disagree, the source wins and
the rule is stale** — re-ground it, re-anchor it, and re-run `verify.mjs`. **If a gate and a rule
disagree, read the gate's output before editing the rule**: a failing check is a question, not a
verdict, and more than once the check has been the thing that was wrong.

How to add, change, or delete a rule here is [`HOW-TO-WRITE.md`](HOW-TO-WRITE.md).
