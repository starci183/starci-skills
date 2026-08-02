# Canon — the map

This tree holds two kinds of thing, and keeping them apart is what stops either from rotting.

**Canon is prose.** It states a judgement and the reason behind it, so that a case its author never
saw can still be decided by someone reading it. A rule whose reason is written down survives contact
with a new situation; a bare imperative does not, and the reader either obeys it where it does not
belong or ignores it where it does.

**Patterns are executable.** They hold the values a machine compares against and the gates that do
the comparing. Anything a script can check belongs there, not here — a prose copy of a number is a
second source of truth that is wrong the day the first one changes.

The division has a practical test. If a claim can fail a build, it lives in `patterns/`. If it can
only be argued with, it lives in `canon/`. Where prose has to name a number — the pixel values in
`canon/fe/enforce/spacing/overview.md` — the prose says plainly that the registry is authoritative and the prose is
the side that is stale.

Paths below are written relative to the canon root, the `.claude/` directory this file sits under.

## Front end

Three files carry the reasoning, and they answer three different questions.

| File | Answers |
|---|---|
| [`canon/fe/enforce/tiers/architecture.md`](fe/architecture.md) | which tier a component belongs to, what it may import, how a data-owning component is split into a presentational twin and a connected twin, and which component a shape of data becomes |
| [`canon/fe/enforce/spacing/overview.md`](fe/principles/spacing.md) | why a seam or an inset is the number it is — the named layout concepts, in prose, beside the registry that holds their values |
| [`canon/fe/enforce/testing.md`](fe/testing.md) | how the contract is checked: `data-tier`, `data-component`, `data-principles`, and the rendered-tree runner that measures computed style |

Those three decide **what** to build. `canon/fe/enforce/authoring/` decides **how the resulting code is
spelled**, so that a file written today reads like the file next to it:

| File | Decides |
|---|---|
| [`structure-and-naming.md`](fe/authoring/structure-and-naming.md) | where a file goes and what it is called |
| [`props-and-types.md`](fe/authoring/props-and-types.md) | how a prop is declared |
| [`type-safety.md`](fe/authoring/type-safety.md) | what may not be typed loosely |
| [`imports-and-format.md`](fe/authoring/imports-and-format.md) | import order and formatting |
| [`react-idioms.md`](fe/authoring/react-idioms.md) | hooks and render idioms |
| [`state-management.md`](fe/authoring/state-management.md) | what belongs in a store |
| [`async-data.md`](fe/authoring/async-data.md) | fetching and caching |
| [`loading-and-skeleton.md`](fe/authoring/loading-and-skeleton.md) | how an async state is written |
| [`forms.md`](fe/authoring/forms.md) | form idioms |
| [`overlay-and-feedback.md`](fe/authoring/overlay-and-feedback.md) | modal, drawer, toast, as code |
| [`styling-tailwind.md`](fe/authoring/styling-tailwind.md) | writing classes and semantic tokens |
| [`storybook-stories.md`](fe/authoring/storybook-stories.md) | how a story file is written |
| [`i18n.md`](fe/authoring/i18n.md) | translated strings |
| [`comments.md`](fe/authoring/comments.md) | when a comment is worth writing |

One law spans all of them: **no component reaches the app that was never a component and a story in
the design-system folder first.** The reasoning is in `canon/fe/enforce/tiers/architecture.md`; the enforcement is
`scripts/gates/check-story-coverage.mjs`.

Four further shelves sit beside those, holding the material that decides what a screen may look like
and do — a layer above spelling and below architecture. Each carries its own index, because each is
long enough that a copy of its table here would drift from the folder within a month.

| Shelf | Answers |
|---|---|
| [`canon/fe/explore/foundations/`](fe/foundations/INDEX.md) | which value out of a deliberately closed scale an element gets: gap, colour token, radius, elevation, breakpoint, z-index, motion, type, sticky offset, scrollbar gutter, and how wide content overflows |
| [`canon/fe/explore/principles/`](fe/principles/INDEX.md) | what the interface is allowed to say and do: accent as signal, one primary action, honest persuasion, hover affordance, design restraint, content voice, accessibility, and building for the data that exists |
| [`canon/fe/explore/layouts/`](fe/layouts/INDEX.md) | which shell a surface gets and how its regions behave — the job-to-shell rule, the shell decision tree, the region vocabulary, responsive and adaptive behaviour, and one file per archetype grounded in a real route |
| [`canon/fe/explore/patterns/`](fe/patterns/INDEX.md) | the recurring behaviours inside a shell: list anatomy, form flow, the three tiers of loading feedback, empty states, drawers, where a surface lands, and how a progress block is composed |

## Back end

Grouped by what the rule constrains rather than by which folder the code sits in, because the same
question tends to arrive from several modules at once.

One shelf sits ahead of the rest. [`canon/be/concepts/`](be/concepts/INDEX.md) holds one file per
subsystem this backend is actually built out of — the exception layer, the GraphQL resolver leaf, CQRS
events and CDC projection, BullMQ processors, Elasticsearch sync, the seeders, auth, payments, RAG,
media encoding and the rest — each naming the `src/` folder it was read from. The files below say how
a line is spelled; that shelf says what the thing being spelled is, and it is usually the cheaper file
to open first. Its table is [`canon/be/concepts/INDEX.md`](be/concepts/INDEX.md).

| Area | File | Decides |
|---|---|---|
| modules | [`canon/be/modules/modules-and-di.md`](be/modules/modules-and-di.md) | module layout and injection |
| modules | [`canon/be/modules/database-and-entities.md`](be/modules/database-and-entities.md) | entities, relations, indexes |
| contracts | [`canon/be/contracts/api-surface.md`](be/contracts/api-surface.md) | what the API exposes |
| contracts | [`canon/be/contracts/validation.md`](be/contracts/validation.md) | how input is validated |
| contracts | [`canon/be/contracts/exceptions.md`](be/contracts/exceptions.md) | typed exceptions, never a bare throw |
| contracts | [`canon/be/contracts/async-and-messaging.md`](be/contracts/async-and-messaging.md) | queues, events, change capture |
| conventions | [`canon/be/conventions/type-safety.md`](be/conventions/type-safety.md) | what may not be typed loosely |
| conventions | [`canon/be/conventions/config-and-env.md`](be/conventions/config-and-env.md) | environment access and defaults |
| conventions | [`canon/be/conventions/imports-and-format.md`](be/conventions/imports-and-format.md) | import order and formatting |
| conventions | [`canon/be/conventions/comments.md`](be/conventions/comments.md) | when a comment is worth writing |

## Where the executable half sits

| Path | What it is |
|---|---|
| `canon/fe/explore/registry.mjs` | the registry: every named layout concept, the property it governs, and the value it must compute to |
| `scripts/runner/test-runner.ts` | the rendered-tree audit that measures the registry against the browser, after every story |
| `scripts/gates/check-*.mjs` | the source-reading gates, one per rule that can be decided by reading a file |
| `patterns/be/gates/` | the same idea on the back end |
| `scripts/verify.mjs` | checks that the canon still describes the source it claims to describe |

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

Registering a source is `starci-setup-workspace-fe` and `starci-setup-workspace-be`. A missing context
exits non-zero and prints the command that fixes it.

## The design material these were consolidated from

The canon files above are the settled prose. The material they were drawn from stays in place, in
longer and more granular form, and is the right thing to open when a boundary needs arguing rather
than applying:

| Path | Holds |
|---|---|
| `canon/fe/enforce/tiers/` | one file per tier, in full, with its numbered rules |
| `canon/fe/enforce/examples/` | real components at each tier, one worked example each |
| `canon/fe/enforce/spacing/` | the closed sets — gap, padding, margin, position, responsive — and the reasoning under each |
| `canon/fe/enforce/tiers/split.md` · `story.md` | the presentational split, and what a story must render |
| `canon/fe/enforce/tiers/references/` | why each boundary sits where it does, which tiers are shared, how to read a scan |
| `scripts/search/data/` | the tier table and the import matrix, queryable |
| `canon/fe/explore/component/` | which component a data shape becomes: the matrix, its fifteen sections, and the traps per section |

## Reading order

There is none. Open the one file the task touches. These are not a curriculum, and a rule read out of
context is a rule applied where it does not belong.

Two things hold when they disagree with you. **If a rule and the source disagree, the source wins and
the rule is stale** — re-ground it, re-anchor it, and re-run `verify.mjs`. **If a gate and a rule
disagree, read the gate's output before editing the rule**: a failing check is a question, not a
verdict, and more than once the check has been the thing that was wrong.

How to add, change, or delete a rule here is [`canon/HOW-TO-WRITE.md`](HOW-TO-WRITE.md).
