# The canon, v2

The rules this codebase is written by, one file per concept, filed on an axis.

Read [`HOW-TO-WRITE.md`](HOW-TO-WRITE.md) before adding or changing anything here. It states the
shape every file takes and, more importantly, what a file must never carry.

Before running any skill, read [`skill-shape.md`](skill-shape.md). Every capability follows
**Plan -> Review -> Apply** and every phase prints `CONTEXT` first, then closes with `OUTPUTS`,
`CHANGES`, `NEED APPROVALS`, `WARNINGS`, `REJECTED` and `OWED`. `OUTPUTS` carries concepts;
`CHANGES` carries the detailed code tree. One task is one append-only file at
`<Source>/.workflows/<kind>/<app>/<id>.md`. `Source` is the current backend AGENTS/project context;
its one workflow root holds every app's records, including frontend-only work.

There is no seal and no lock record. The production write boundary is confirmed once, out loud,
before the first write; whether an old task still matches the source is asked afterwards by
[`starci-workflow-drift-plan`](skills/starci-workflow-drift-plan/SKILL.md), over one task or all of them. That
is a deliberate trade: preventing drift cost a hash per file and phases that refused to finish, and
finding it costs one skill run.

## The capability trios

| Capability | Plan | Review | Apply |
|---|---|---|---|
| Backend feature | [`starci-be-feature-plan`](skills/starci-be-feature-plan/SKILL.md) | [`starci-be-feature-review`](skills/starci-be-feature-review/SKILL.md) | [`starci-be-feature-apply`](skills/starci-be-feature-apply/SKILL.md) |
| Data backup | [`starci-data-backup-plan`](skills/starci-data-backup-plan/SKILL.md) | [`starci-data-backup-review`](skills/starci-data-backup-review/SKILL.md) | [`starci-data-backup-apply`](skills/starci-data-backup-apply/SKILL.md) |
| Data restore | [`starci-data-restore-plan`](skills/starci-data-restore-plan/SKILL.md) | [`starci-data-restore-review`](skills/starci-data-restore-review/SKILL.md) | [`starci-data-restore-apply`](skills/starci-data-restore-apply/SKILL.md) |
| FE consolidation | [`starci-fe-consolidate-plan`](skills/starci-fe-consolidate-plan/SKILL.md) | [`starci-fe-consolidate-review`](skills/starci-fe-consolidate-review/SKILL.md) | [`starci-fe-consolidate-apply`](skills/starci-fe-consolidate-apply/SKILL.md) |
| FE design | [`starci-fe-design-plan`](skills/starci-fe-design-plan/SKILL.md) | [`starci-fe-design-review`](skills/starci-fe-design-review/SKILL.md) | [`starci-fe-design-apply`](skills/starci-fe-design-apply/SKILL.md) |
| FE fidelity | [`starci-fe-fidelity-plan`](skills/starci-fe-fidelity-plan/SKILL.md) | [`starci-fe-fidelity-review`](skills/starci-fe-fidelity-review/SKILL.md) | [`starci-fe-fidelity-apply`](skills/starci-fe-fidelity-apply/SKILL.md) |
| FE lint sync | [`starci-fe-lint-sync-plan`](skills/starci-fe-lint-sync-plan/SKILL.md) | [`starci-fe-lint-sync-review`](skills/starci-fe-lint-sync-review/SKILL.md) | [`starci-fe-lint-sync-apply`](skills/starci-fe-lint-sync-apply/SKILL.md) |
| Trust upgrade | [`starci-fe-upgrade-plan`](skills/starci-fe-upgrade-plan/SKILL.md) | [`starci-fe-upgrade-review`](skills/starci-fe-upgrade-review/SKILL.md) | [`starci-fe-upgrade-apply`](skills/starci-fe-upgrade-apply/SKILL.md) |
| Workflow drift | [`starci-workflow-drift-plan`](skills/starci-workflow-drift-plan/SKILL.md) | [`starci-workflow-drift-review`](skills/starci-workflow-drift-review/SKILL.md) | [`starci-workflow-drift-apply`](skills/starci-workflow-drift-apply/SKILL.md) |

## The axes

An axis answers a different KIND of question, which is why they are separate trees rather than
folders inside one shelf. A file that seems to fit two axes is usually two files.

### Front end

| Axis | The question it answers | Where |
|---|---|---|
| **canon** | How is this spelled here? The law the code already follows, and the machine enforces. | `fe/canon/` |
| **design** | Why is it shaped this way? The thinking a rule came out of — hierarchy, restraint, what earns attention. Written in a universal voice: a file here should read as true of any front end, and name no product. | `fe/design/` |
| **creativity** | How are researched alternatives generated, challenged and selected without escaping canon? | `fe/creativity/` |
| **baselines** | What does ONE screen already promise its users? Named product behaviour a parity request must preserve. Names its product, unlike every shelf above. | `fe/baselines/` |
| **references** | What does the outside world say? Vendor docs, platform behaviour, prior art. Cited, never paraphrased into law. | `fe/references/` |

`fe/canon/` divides again by what is being decided:

- **`uxui/`** — what a thing IS and where it may sit. `layers/` holds one file per layer:
  [`leaf`](fe/canon/uxui/layers/leaf.md) · [`shell`](fe/canon/uxui/layers/shell.md) ·
  [`composite`](fe/canon/uxui/layers/composite.md) · [`branch`](fe/canon/uxui/layers/branch.md) ·
  [`block`](fe/canon/uxui/layers/block.md) · [`layout`](fe/canon/uxui/layers/layout.md) ·
  [`overlay`](fe/canon/uxui/layers/overlay.md) · [`page`](fe/canon/uxui/layers/page.md).

  Two questions place anything, and both are answered by a type signature rather than by taste:

  | | takes only `props` | takes `contract` + `render` |
  |---|---|---|
  | **knows no domain** | composite | branch |
  | **knows the domain** | block | layout · overlay |

  `render` is a branded `ContractComponent<K>` carrying a record of COMPONENTS — one per slot the
  key declares — never markup. That is what lets an entry state what belongs at every position,
  preserve the exact key across a branch boundary, and have the compiler hold it.

  A **leaf** sits below the table: it wraps ONE vendor primitive, fills a slot rather than opening
  one, and arranges nothing. It carries its own name on its metadata, which is how a slot asking for
  a glyph refuses a label. A **page** sits above it: one screen, composed of blocks, in a folder
  holding exactly two files.

  A **shell** is the one named exemption in the whole system. It is a branch by the table — it opens
  slots, it knows no domain — and it alone may import the component library alongside the leaves,
  because ModalShell, DrawerShell and DropdownShell intentionally pass real `children` holes through
  of their own and so fit in neither tier as written. The exemption is a folder rather than a list inside a rule, which makes it countable and
  checkable both ways: a branch elsewhere that imports the library is misfiled, and a file in
  `shells/` is closed to those three names; surface cards remain typed branches.

  Layout and overlay share the same cell and differ in one thing — a layout SURVIVES navigation,
  an overlay is summoned and dismissed.
- **`patterns/`** — how code is written. One file per concept, each explaining the concept and its
  `why`, naming concrete `starci-academy-fe` implementation anchors, and linking the artifact or
  repository audit that holds it: [`cache-key`](fe/canon/patterns/cache-key.md) ·
  [`comments`](fe/canon/patterns/comments.md) ·
  [`contract`](fe/canon/patterns/contract.md) ·
  [`file-layout`](fe/canon/patterns/file-layout.md) · [`icon`](fe/canon/patterns/icon.md) ·
  [`landmark`](fe/canon/patterns/landmark.md) ·
  [`lint-adoption`](fe/canon/patterns/lint-adoption.md) ·
  [`lint-escape-hatch`](fe/canon/patterns/lint-escape-hatch.md) ·
  [`loading`](fe/canon/patterns/loading.md) · [`naming`](fe/canon/patterns/naming.md) ·
  [`props-and-slots`](fe/canon/patterns/props-and-slots.md) ·
  [`served-locale`](fe/canon/patterns/served-locale.md) ·
  [`the-split`](fe/canon/patterns/the-split.md) · [`tokens`](fe/canon/patterns/tokens.md) ·
  [`translation`](fe/canon/patterns/translation.md) ·
  [`type-safety`](fe/canon/patterns/type-safety.md) ·
  [`typography`](fe/canon/patterns/typography.md) ·
  [`vendor-boundary`](fe/canon/patterns/vendor-boundary.md).

`be/canon/patterns/` holds [`authorization`](be/canon/patterns/authorization.md) ·
[`cdc`](be/canon/patterns/cdc.md) · [`comments`](be/canon/patterns/comments.md) ·
[`cqrs`](be/canon/patterns/cqrs.md) · [`data-access`](be/canon/patterns/data-access.md) ·
[`e2e-flow`](be/canon/patterns/e2e-flow.md) ·
[`event-delivery`](be/canon/patterns/event-delivery.md) ·
[`exception-identity`](be/canon/patterns/exception-identity.md) ·
[`exceptions`](be/canon/patterns/exceptions.md) ·
[`module-layering`](be/canon/patterns/module-layering.md) ·
[`naming`](be/canon/patterns/naming.md) ·
[`observability`](be/canon/patterns/observability.md) ·
[`testing`](be/canon/patterns/testing.md) · [`transport`](be/canon/patterns/transport.md) ·
[`type-safety`](be/canon/patterns/type-safety.md).
Still owed, each with the evidence that says so: `migrations`, `pagination`, `concurrency`,
`throttling`.

Backend capability work follows **Plan -> Review -> Apply**, for the same reason the frontend does: a
folder architecture is arguable in a sentence and the same decisions embedded in thirty written
files are arguable only by whoever reads all thirty.
[`starci-be-feature-plan`](skills/starci-be-feature-plan/SKILL.md) reads the law, dumps the
schema unfiltered, mirrors the sibling family and stops with every file named and every test case
enumerated. [`starci-be-feature-review`](skills/starci-be-feature-review/SKILL.md) challenges and
revises that brief until one exact tree is approved. [`starci-be-feature-apply`](skills/starci-be-feature-apply/SKILL.md)
writes those files and no others.

`fe/design/` carries the laws no machine can hold — no file there names a number of its own, which
is why none of them ships an artifact: [`gap`](fe/design/gap.md) · [`margin`](fe/design/margin.md) ·
[`padding`](fe/design/padding.md) · [`surface-in-surface`](fe/design/surface-in-surface.md) ·
[`hierarchy`](fe/design/hierarchy.md) · [`call-to-action`](fe/design/call-to-action.md) ·
[`input`](fe/design/input.md) · [`exception`](fe/design/exception.md) ·
[`press-affordance`](fe/design/press-affordance.md) ·
[`refactor-parity`](fe/design/refactor-parity.md).
Still owed: position, responsive, restraint, colour, typography.

Two of them answer the questions a reader meets first, and in this order: `hierarchy` settles what
is read and in what sequence, then `call-to-action` settles what the surface asks for once it has
been understood. A primary action nobody reaches was never a call-to-action failure.

**Which shelf a concept goes on is decided by whether anything can hold it.** A law with an
enforceable half belongs in `canon/patterns/` beside its artifact — `icon` began in `design/` and
moved, because it turned out to have measurable steps and a rule that can see them. A law that
states only a reason stays in `design/`.

Reading design without canon leaves a reader with taste and no spelling; reading canon without
design leaves them able to type a legal value for the wrong reason.

`fe/creativity/` is the operating workflow for page and flow invention. Start at
[`creativity/INDEX.md`](fe/creativity/INDEX.md). It uses canon as fixed grammar, design as judgement,
backend behavior as business truth and the contract `why` plus existing components as reuse
evidence. It is not another canon shelf. Net-new UI and work that still needs a product or
composition choice follow **Plan -> Review revisions -> Apply**. Three task procedures execute it
across four explicit scopes (`page`, `layout`, `block`, `overlay`) without blurring their owners:

- [`starci-fe-design-plan`](skills/starci-fe-design-plan/SKILL.md) reads live contracts, shipped
  components and named references, then renders one disposable `index.html` with two to four
  direction tabs, serves one URL on the first free port from 8080 and tracks its path/hash.
- [`starci-fe-design-review`](skills/starci-fe-design-review/SKILL.md) challenges the selected brief,
  source boundary, owner states and acceptance evidence until one exact revision is approved. It
  writes no production source.
- [`starci-fe-design-apply`](skills/starci-fe-design-apply/SKILL.md) commits the current target state
  as the before-state, writes the approved frontend directly in final source paths, and closes by
  matching the baseline diff, rendered states and tests.

Duplication is the other thing a build leaves behind, and it is not a defect list: two files holding
one shape say the vocabulary had no word for it. It is a second pair, split for the same reason as
the first — surveying and editing want different write boundaries.

- [`starci-fe-consolidate-plan`](skills/starci-fe-consolidate-plan/SKILL.md) states a scope, freezes
  members and call sites while the tree it measured still exists, and settles each cluster with the
  question a diff cannot re-derive — the same thing, or the same picture. Each ends at `merge`,
  `prop-variant`, `extract-composite` or `keep-apart`, and it stops for approval of that set. It
  writes a proposal and changes no code, because editing while surveying destroys the measurement
  the proposal rests on.
- [`starci-fe-consolidate-review`](skills/starci-fe-consolidate-review/SKILL.md) revises and approves
  one verdict and measured call-site boundary per group.
- [`starci-fe-consolidate-apply`](skills/starci-fe-consolidate-apply/SKILL.md) carries out the
  approved verdicts one cluster per diff, may neither widen nor narrow the measured call sites, and
  proves each one still renders what it rendered.

Merging two shapes that merely look alike is worse than the duplication: it produces one owner with
a flag per call site. Two blocks over different domain entities that render identically are not one
block — the shape is a composite and the meaning stays where it is.

A bounded parity, interaction or runtime defect still follows the trio.
[`starci-fe-fidelity-plan`](skills/starci-fe-fidelity-plan/SKILL.md) locks binding evidence and the
comparison identity. [`starci-fe-fidelity-review`](skills/starci-fe-fidelity-review/SKILL.md) renders
and revises the smallest correction. [`starci-fe-fidelity-apply`](skills/starci-fe-fidelity-apply/SKILL.md)
writes only the approved correction. If ownership, CTA, behavior or reusable vocabulary becomes
undecided, it returns to Design Plan.

## What holds a law

A law a machine can hold ships WITH the thing that holds it, under [`sources/`](sources/), named for
the law file that governs it: `<axis>/canon/patterns/<name>.md` is held by
`sources/<axis>/<name>.mjs` and its twin `sources/<axis>/<name>.test.mjs`.

**That correspondence is checked, not trusted.** [`sources/parity.test.mjs`](sources/parity.test.mjs)
fails when a rule module has no law, when a rule module has no twin, or when a law names an artifact
that is absent. It exists because all three drifted within an hour of each other while a promise to
write this gate went unkept — a convention nobody checks is a preference. Adding an axis to its list
is what puts that shelf under the gate.

**Three gates hold the tree itself rather than any one law.**
[`sources/parity.test.mjs`](sources/parity.test.mjs) holds law to artifact.
[`sources/links.test.mjs`](sources/links.test.mjs) fails when anything here points at a file that is
not there, which is the drift that consolidating two statements of one concept leaves behind.
[`sources/skills.test.mjs`](sources/skills.test.mjs) fails when a skill prints a command for a
script that does not exist, starts a trust script by a path that depends on where the run happens,
or declares a name its folder does not match.

Run them:

```powershell
npm test          # from the trust root
npm run gate:canon # from a repository that vendors it
```

This tree has no build, so those gates are the only moment anything here is executed. They were
wired after a sweep found them all passing and none of them reachable: the trust root carried no
manifest, so `node --test` had no entry point and the gates had never been run by anybody. A gate
that cannot be invoked is indistinguishable from a gate that does not exist.

The artifact is not always a lint rule, and the strongest ones are not. A closed union makes a wrong
value UNREPRESENTABLE rather than forbidden, and there is nothing left to police once the bad value
cannot be typed; a rule covers only what a type cannot see, such as which file wrote a string. A
repository adopting FE canon attaches the gathered StarCi FE plugin, recommendation and linter
options as one unit rather than maintaining a handwritten parallel subset. The effective config is
then proved against a real production file by
[`scripts/audit-fe-lint-adoption.mjs`](scripts/audit-fe-lint-adoption.mjs); an import, plugin folder
or copied name is not adoption. See
[`fe/canon/patterns/lint-adoption.md`](fe/canon/patterns/lint-adoption.md).

### Back end

| Axis | The question it answers | Where |
|---|---|---|
| **canon** | How is this spelled here? Modules, exceptions, types, logging, tests. | `be/canon/` |
| **stacks** | What is it running on, and what does that thing demand? Postgres, Kafka, Redis, NATS, Elasticsearch. | `be/stacks/` |
| **references** | Vendor and protocol documentation, cited. | `be/references/` |

The back end reaches its rules the same way the front end does, through a generated mirror written by
[`scripts/sync-be-lint.mjs`](scripts/sync-be-lint.mjs) — and on this axis the import that "obviously"
replaces it is not merely fragile but impossible: `.claude/` is gitignored by the back end, so a
config importing `sources/be/` resolves on one machine and in no clone, no CI job and no image.
[`sources/be/index.mjs`](sources/be/index.mjs) gathers every law's rules once, and the target's
config keeps deciding which globs and which levels.

The script differs from its front-end twin in one deliberate way: it will not delete a repository's
hand-written plugin while that plugin still publishes a rule canon does not. Removing the front end's
cost seven live rules that are still owed back, and an adoption that quietly subtracts enforcement is
the failure `LINT-ADOPTION-1` describes wearing the word adoption. So the names at risk are printed
every run, and the folder goes only when the list is empty and `--retire-local-plugin` says so.

## The one rule that outranks the others

**Canon records what the code already does.** A file here is not a preference somebody had; it is a
law the source can be checked against. If a rule cannot be pointed at in real code, it is not a rule
yet — it is a proposal, and proposals do not belong in this tree.

When canon and the source disagree, one of them is wrong and the disagreement is the finding. Say
which, and why, rather than quietly obeying whichever was read most recently.

## Trust boundary

This `.claude/` tree is the only StarCi trust tree for the backend and frontend repositories. Root
`CLAUDE.md` files route into it. Parallel trees, versioned Claude folders and frontend-local canon
copies are legacy drift and must not be recreated.
