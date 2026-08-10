# The canon, v2

The rules this codebase is written by, one file per concept, filed on an axis.

Read [`HOW-TO-WRITE.md`](HOW-TO-WRITE.md) before adding or changing anything here. It states the
shape every file takes and, more importantly, what a file must never carry.

## The axes

An axis answers a different KIND of question, which is why they are separate trees rather than
folders inside one shelf. A file that seems to fit two axes is usually two files.

### Front end

| Axis | The question it answers | Where |
|---|---|---|
| **canon** | How is this spelled here? The law the code already follows, and the machine enforces. | `fe/canon/` |
| **design** | Why is it shaped this way? The thinking a rule came out of — hierarchy, restraint, what earns attention. Written in a universal voice: a file here should read as true of any front end, and name no product. | `fe/design/` |
| **references** | What does the outside world say? Vendor docs, platform behaviour, prior art. Cited, never paraphrased into law. | `fe/references/` |

`fe/canon/` divides again by what is being decided:

- **`uxui/`** — what a thing IS and where it may sit. `layers/` holds one file per layer:
  [`leaf`](fe/canon/uxui/layers/leaf.md) · [`shell`](fe/canon/uxui/layers/shell.md) ·
  [`composite`](fe/canon/uxui/layers/composite.md) · [`branch`](fe/canon/uxui/layers/branch.md) ·
  [`block`](fe/canon/uxui/layers/block.md) · [`layout`](fe/canon/uxui/layers/layout.md) ·
  [`overlay`](fe/canon/uxui/layers/overlay.md) · [`page`](fe/canon/uxui/layers/page.md).

  Two questions place anything, and both are answered by a type signature rather than by taste:

  | | takes only `props` | takes `children` |
  |---|---|---|
  | **knows no domain** | composite | branch |
  | **knows the domain** | block | layout · overlay |

  A **leaf** sits below the table: it wraps ONE vendor primitive, takes no children, and arranges
  nothing. A **page** sits above it: one screen, composed of blocks, in a folder holding exactly two
  files.

  A **shell** is the one named exemption in the whole system. It is a branch by the table — children,
  no domain — and it alone may import the component library alongside the leaves, because the vendor
  primitives it wraps (a dialog, a drawer, a popover) REQUIRE children and so fit in neither tier as
  written. The exemption is a folder rather than a list inside a rule, which makes it countable and
  checkable both ways: a branch elsewhere that imports the library is misfiled, and a file in
  `shells/` that imports nothing is an ordinary branch that wandered in.

  Layout and overlay share the same cell and differ in one thing — a layout SURVIVES navigation,
  an overlay is summoned and dismissed.
- **`patterns/`** — how code is written. One file per concept, each naming the artifact that holds
  it: [`contract`](fe/canon/patterns/contract.md) · [`file-layout`](fe/canon/patterns/file-layout.md)
  · [`icon`](fe/canon/patterns/icon.md) · [`naming`](fe/canon/patterns/naming.md). Still owed:
  props-and-slots, css-doors, tokens, loading, the-split, translation, type-safety, comments,
  accessibility.

`be/canon/patterns/` holds [`cqrs`](be/canon/patterns/cqrs.md) ·
[`data-access`](be/canon/patterns/data-access.md) · [`testing`](be/canon/patterns/testing.md).

`fe/design/` carries the laws no machine can hold — no file there names a number of its own, which
is why none of them ships an artifact: [`gap`](fe/design/gap.md) · [`margin`](fe/design/margin.md) ·
[`padding`](fe/design/padding.md) · [`surface-in-surface`](fe/design/surface-in-surface.md) ·
[`call-to-action`](fe/design/call-to-action.md). Still owed: position, responsive, hierarchy,
restraint, colour, typography.

**Which shelf a concept goes on is decided by whether anything can hold it.** A law with an
enforceable half belongs in `canon/patterns/` beside its artifact — `icon` began in `design/` and
moved, because it turned out to have measurable steps and a rule that can see them. A law that
states only a reason stays in `design/`.

Reading design without canon leaves a reader with taste and no spelling; reading canon without
design leaves them able to type a legal value for the wrong reason.

## What holds a law

A law a machine can hold ships WITH the thing that holds it, under [`sources/`](sources/), named for
the law file that governs it: `<axis>/canon/patterns/<name>.md` is held by
`sources/<axis>/<name>.mjs` and its twin `sources/<axis>/<name>.test.mjs`.

**That correspondence is checked, not trusted.** [`sources/parity.test.mjs`](sources/parity.test.mjs)
fails when a rule module has no law, when a rule module has no twin, or when a law names an artifact
that is absent. It exists because all three drifted within an hour of each other while a promise to
write this gate went unkept — a convention nobody checks is a preference. Adding an axis to its list
is what puts that shelf under the gate.

The artifact is not always a lint rule, and the strongest ones are not. A closed union makes a wrong
value UNREPRESENTABLE rather than forbidden, and there is nothing left to police once the bad value
cannot be typed; a rule covers only what a type cannot see, such as which file wrote a string. A
repository adopting a law copies the artifact rather than reimplementing it, and its own lint config
stays the authority on what is switched on and at what level.

### Back end

| Axis | The question it answers | Where |
|---|---|---|
| **canon** | How is this spelled here? Modules, exceptions, types, logging, tests. | `be/canon/` |
| **stacks** | What is it running on, and what does that thing demand? Postgres, Kafka, Redis, NATS, Elasticsearch. | `be/stacks/` |
| **references** | Vendor and protocol documentation, cited. | `be/references/` |

## The one rule that outranks the others

**Canon records what the code already does.** A file here is not a preference somebody had; it is a
law the source can be checked against. If a rule cannot be pointed at in real code, it is not a rule
yet — it is a proposal, and proposals do not belong in this tree.

When canon and the source disagree, one of them is wrong and the disagreement is the finding. Say
which, and why, rather than quietly obeying whichever was read most recently.

## Status

This tree is being built beside the previous one rather than converted in place, so that no rule is
half-migrated at any moment. Where a concept exists in both, **this tree wins for the front-end
rebuild**, and the older shelf still governs the legacy front end, which has a different layer
system and different rules.
