# Operation kinds, lanes and routes: the workflow brain as data

`model/kinds.yaml` is the catalog, `kernel/graph.mjs` is the pure module that reads it, and
together they own the process of a workflow: which operation kinds exist, which sequence a ledger node must
walk, and where an outcome may go. The kernel calls the module; nothing here runs an agent.

## Why data, not an agent

A language model is good at filling one operation's content and at picking among options that were put in
front of it. It is bad at being the control loop: asked twice, it answers twice differently, skips the step
that felt redundant, invents a repair kind nobody defined, and retries until the budget is gone. 5.0 already
moved scheduling, acceptance and allocation into code ([v5-plan.md](v5-plan.md) §1 F5); this profile moves the
last piece, the *shape of the process*, with it.

So the division is explicit. The graph decides **what kind of operation comes next, with what origin, and how
many times** - from a file anyone can diff and a validator anyone can run. The model decides **what goes
inside that operation** and answers the closed options its report offers. An operation that wants a different
process has exactly one move: report a blocker the vocabulary names, and let the graph route it. There is no
prompt that widens the lane, and a process change is a reviewable commit rather than a better-worded brief.

The same property makes the workflow explainable before it runs: `describeLane` prints the mandatory sequence
into an operation contract or a status view, so the agent doing step two can see that step three exists and
that skipping it is not available.

## The record catalog

Input and output are explicit in 5-plus. `model/records.yaml` (`starci/records@1`) is the closed catalog of
**record kinds** - what a thing in the Work tree or in the product IS, independent of the operation that
wrote it - and every kind below declares its `reads` and its `writes` over exactly those names.
[`kernel/io.mjs`](../kernel/io.mjs) is the only module that reads it.

| record | where it lives | derived from (`reads`) |
| --- | --- | --- |
| `record` | `**/index.yaml` - the authored fields of one Work node | - |
| `srs` | `features/*/business/**` | `decision` |
| `sds` | `features/*/architecture/**` | `srs`, `decision` |
<!-- decision.prepare prepares a decision the runtime takes provisionally and never waits; provision.ask asks for what only the owner can give and waits in its tab. The old single kind owner.ask is renamed on kernel start (kind-renamed). -->
| `decision` | `features/*/business/srs/business-rules/policy-decisions/**` (a business record with the `srs-policy-decision` section) | - (the owner's) |
| `brand` | `brand/index.yaml` | `code` (the real token files) |
| `design` | `features/*/ui/**` | `srs`, `sds`, `brand`, `grammar` |
| `asset` | `**/assets/**` | `design`, `brand` |
| `code` | `repository:**`, or any path outside the Work tree | `sds`, `design`, `grammar` |
| `grammar` | `grammar:**`, `knowledge/grammars/**` | `design` |
| `evidence` | `**/evidence/**` | `code`, `design`, `srs` |
| `runtime` | nowhere: declared, never written as a file | `code` |
| `integration` | `features/*/integration/**` | `srs`, `sds` |

`reads` is the derivation, not the file dependency, and that is what makes "C repeats A" a matter of ids: a
record of kind K may cite another record only through the kinds K reads.

## The catalog

Seventeen kinds, and the list is closed in both directions: `validateGraph` reports `catalog-drift` when the
profile and the `KINDS` constant of `kernel/graph.mjs` disagree, so an eighteenth kind cannot appear by
accident. `family` says what an operation is for, `role` is the allocator role of
[`model/runtimes.yaml`](runtime-allocation.md) (and must equal its `roleOfKind` entry), `reads` and `writes`
are the record kinds it may cite and produce, and `operator` is the launchable operator contract in `ops/`
that carries it.

| kind | family | role | reads | writes | operator | purpose |
| --- | --- | --- | --- | --- | --- | --- |
| `business.decide` | design | decide | srs, decision | srs, decision | `business.decide` | Settle what the product must do, before anything is designed against it. |
| `architecture.decide` | design | decide | srs, sds, decision | sds, decision | `architecture.decide` | Settle how the product realises a requirement. |
| `architecture.revise` | repair | decide | srs, sds, decision | sds | `architecture.decide` | Repair a design record a builder found silent or wrong; bump its `rev`. |
| `business.revise` | repair | decide | srs, decision | srs | `business.decide` | Repair a requirement record a builder found silent, confusing or self-contradictory; bump its `rev`. |
| `brand.decide` | design | decide | code, grammar | brand, asset | `brand.decide` | Settle the visual identity - colour tokens traced to real source files, typography, mascot, logo, imagery rules - in the one brand record. |
| `decision.prepare` (or `provision.ask` for a provision) | design | decide | srs, sds, decision | decision | `decision.prepare` (or `provision.ask` for a provision) | Prepare one decision for the owner - question, analysis per side, options, recommendation - or answer it from the decided records. |
| `interface.draw` | design | write | srs, sds, brand, grammar, design | design, asset | `interface.draw` | Render each screen's main state from the installed grammar in a browser (never an image model), describe every other state, and declare every artwork the candidate embeds. |
| `interface.asset` (needs `design-tool`) | design | write | design, brand | asset, design, code | `interface.asset` | Generate the artwork the design record declares as real repository assets, and bind each file back to its slot. |
| `frontend.implement` | build | implement | srs, sds, design, asset, brand, grammar, code | code | `interface.implement` | Build the interface the drawing settled. |
| `backend.implement` | build | implement | srs, sds, decision, code | code | `backend.implement` | Build one slice of behind-the-interface behaviour. |
| `runtime.operate` | build | implement | sds, code, runtime | runtime, code | `runtime.operate` | Migrations, environment, deployment, infrastructure. |
| `grammar.update` | build | implement | design, grammar, brand | grammar, code | `grammar.update` | Grow the installed grammar by one semantic unit no composition of existing contracts renders: implement it with its stories and tests, publish it, bump the consumer, record it in the canon. |
| `e2e.verify` | prove | verify | srs, sds, code | evidence, code | `e2e.verify` | Prove one delivered slice through its public API on the real stack, never a screen, and leave the scenario spec with its run output. |
| `uat.verify` | prove | verify | srs, design, asset, brand, code | evidence, code | `uat.verify` | Walk one end-to-end scenario on the rendered surface and leave it with its evidence. |
| `integration.verify` | prove | verify | integration, sds, code | evidence | `integration.verify` | Prove one declared external integration against the real provider, with the credential the owner supplies in the named variable, and keep the live exchange as evidence. |
| `review.verify` | prove | verify | srs, sds, code, evidence, runtime | - (read-only) | `review.verify` | Read the slice against its acceptance and report findings, repairing nothing. |
| `work.author` | design | plan | srs, sds, decision, code, record | record, srs, sds, decision | `work.author` | Complete the authored fields of one Work node - its write scope and its checks - so the kernel can launch it; as an intake, author a feature's records against the decided ones. |
| `implementation.plan` | design | plan | srs, sds, code, record | record | `work.author` | Cut one Work node too big for a single operation into child nodes with disjoint write scopes - the seam first, then one observable behaviour per child - and leave the node a derived parent whose assertions are the group's acceptance. |

Each kind also declares `reports`: the outcomes it may end with and the blocker kinds it may raise. That is
what makes a route reachable or not - `review.verify` may not raise `shared-change`, because a kind that
changes nothing cannot need a path it is not allowed to write.

Four of `validateGraph`'s refusals are about this declaration rather than about the shape of the process.
`unknown-record` is a record kind the catalog does not declare. `writer-blind` is a kind that writes a record
it shares no derivation source with - it would be authoring something it cannot check against anything it
saw. The rule is precisely "reads, **or itself writes**, at least one source of the record": a kind that
authors two records in one operation may satisfy the derivation from its own output, which is how
`business.decide` writes `srs` while writing the `decision` that `srs` is derived from, and a record with no
declared sources (`record`, `decision`) exempts its writers entirely because there is nothing to be blind to.
`lane-proof-blind` is a lane whose prove step cannot read what its build step wrote. `route-target-blind`
is a blocker answered by a kind that writes nothing every possible requester reads. `readonly-writes` and
`writes-nothing` hold the read-only invariant over `writes`, and `unknown-capability` / `needs-shape` refuse a
`needs` entry outside the `capabilities` vocabulary - a promise no host could ever satisfy.

`ops/validate.mjs` adds `IO_DRIFT` over the same declaration: an operator contract whose `writes[].path` maps
to a record its kind may not produce. Three destinations are outside it, because they belong to the kernel
rather than to the operation's kind: everything under `E/` (the attempt report every operation writes
whatever its kind), a `node` row on `N/index.yaml` whose fields are only `state`, `blocker`, `completion` or
`extensions.work3.kernel` (the kernel's own receipt), and an evidence manifest recognised by its own fields
(`id`, `nodeId`, `inputDigest`, `outcome`, `assertions`, `assets`) wherever it is written - because a
frontend build keeps its capture of the running page under the node's `assets/`, and a path alone cannot tell
that capture apart from declared artwork. An operator that carries no kind at all is outside the declaration
and is not held to it.

`brand.decide` is the identity of the product as data: one record per product, a `brand:` spec (identity and
installed grammar family, colour tokens as *grammar token name -> value* with their roles and the policy that
governs them, typography, mascot, logo, iconography, imagery with the prompt rules every later image prompt
must state, voice, motion, the forbidden list, the `artworkSlots` conventions and `sources`), revised by
bumping its `rev`. Two properties make it a kind of its own rather than an `architecture.decide`. Its values
are not chosen: every token is read out of the real style and token files of the product's interface and
`sources` names them, which is why an untraceable value is a question rather than a record entry. And it
produces bytes - a placeholder mascot for a product that has none - so `asset` is in its `writes` beside the
`brand` record itself. It is the only kind that writes `brand`, because there is one identity and one record
that holds it; `work.author` and `implementation.plan` are the two kinds that write the authored `record` of a node.

`work.author` and `implementation.plan` are the kinds that stand outside the lanes and the routes. A node whose record declares no
write scope (`implementation.changes[].files` or `extensions.work3.allowlist`) and no check
(`extensions.work3.checks`) cannot be launched at all, so nothing of its lane may start; completing that
record is the `work.author` operation, and it therefore **precedes** the node's lane rather than being a step
of it. No lane names it and no route creates it: the kernel creates exactly one per node, itself, the moment
the Work ledger reports that node incomplete - see **Ledger incomplete -> work.author** in
[workflow-kernel.md](workflow-kernel.md). It is permitted to author its own node's `index.yaml`; `state`,
`completion` and `extensions.work3.kernel` stay the kernel's inside that file, which is why an operator row
that touches only those fields is outside `IO_DRIFT`.

### The three modes of the record-authoring contract

One operator contract (`ops/work.author/operator.yaml`) carries all three, and the operation itself says which
mode it is in - a node kind, an origin or an allowlist may never reroute it:

| Mode | Kind | The op carries | Sequence | What it writes |
| --- | --- | --- | --- | --- |
| record | `work.author` | a `nodeId` | `work.author` | the node's own `index.yaml`: its write scope, its assertions, one check per assertion |
| intake | `work.author` | `op.intake = {scope, example, mode}` | `work.intake` | a whole feature the tree does not hold, reconciled against the decided records as three typed cases |
| cut | `implementation.plan` | `op.cut = {node, reason}` | `work.cut` | the node's child records, and the node itself turned into a derived parent |

The cut is a **kind** rather than a third flag because that is what the goal page, the status view and the
events show: a heavy node reads `1 implementation.plan -> seam -> N backend.implement -> 1 e2e.verify ->
1 review.verify`, and every one of those is a word the user can look up. It needs no operator of its own -
`operatorOf('implementation.plan')` is `work.author` - and it takes the same standing: before the lane, once
per node, planned by the kernel itself, named by no lane and created by no route. What it writes is only
`record`, because a cut builds nothing. The one place it differs from its sibling is what stays the kernel's
inside the record it holds: a derived parent authors no state, so removing `state` is the cut's job and only
`completion` is protected there. The bounds it is selected by, and what the children have to look like, are in
[op-granularity.md](op-granularity.md) §1.

## The lanes

One ledger node, one lane, walked in order. `match` is the node shape (`kind`, plus the `backend`/`frontend`
side from the node's layout or from its repository binding); the first lane whose match fits wins, so the
list runs from the most specific to the least.

| lane | node shape | mandatory sequence |
| --- | --- | --- |
| `design/ui` | `ui` (the feature's interface design record) | `interface.draw` -> `interface.asset` (optional when `node.hasNoArtworkSlots`) |
| `implementation/frontend` | `implementation` + frontend side | `frontend.implement` -> `uat.verify`, held until the feature's `ui` node is done |
| `implementation/backend` | `implementation` + backend side, or no side named | `backend.implement` -> `e2e.verify` -> `review.verify` |
| `e2e` | `e2e` (API scenario node; completion profile `e2e`: assertions only) | `e2e.verify` |
| `uat/frontend` | `uat` + frontend side | `uat.verify` |
| `uat` | `uat` | `e2e.verify` |
| `integration` | `integration` (one declared external system; completion profile `integration`: assertions only) | `integration.verify` |
| `operations` | `operations` | `runtime.operate` -> `review.verify` |
| `architecture` | `architecture` | `architecture.decide` |
| `business` | `business`, `business-overview` | `business.decide` |
| `brand` | `brand` (the one identity record; completion profile `brand`: assertions only) | `brand.decide` |

`nextKind(lane, doneKinds)` answers the one step that may run now. The order is mandatory in the strong
sense: a step that is neither done nor a satisfied optional is returned *even when a later step already ran*,
so a frontend node whose code exists but whose drawing does not is sent back to `interface.draw` rather than
waved through. A step is optional only through a named predicate - `optionalWhen: node.hasNoArtworkSlots` -
which the kernel evaluates; a predicate that is absent or false is false, so the default is always to run the
step. Both predicates are facts of the feature's interface design record: its `ui` node, the one the
implementation node references or the one beside it under `features/<feature>/ui`, read from disk.

| predicate | true when | the step it makes optional |
| --- | --- | --- |
| `node.hasInterfaceDesign` | the ui record names its surfaces and the candidate images that drew them | none today; the drawing is never optional on the ui lane, and an implementation node is held until that record is done |
| `node.hasNoArtworkSlots` | the ui record is drawn and declares no `artworkSlots` entry, or every slot already names its generated file | `interface.asset` |

The artwork predicate is the asymmetry that matters. A record with no artwork slot has nothing to generate, so
the asset step is skipped; a record whose slots nobody has read keeps the step, because the default is to run
it. That is what stops the approved picture from quietly losing its illustration between the drawing and the
page: the build may only import files the record names, and those files exist because this step produced
them.

Two invariants the validator enforces on every lane: a lane that builds must prove afterwards
(`lane-build-without-proof`), and no design step may stand after a build step (`lane-design-after-build`).
A node kind no lane claims gets `[]`, not a default lane: the kernel must ask the user instead of guessing.

## The routes

`routeFor({outcome, blocker, verdict, kind, lane})` gives the one bounded answer: the kind to create, the
origin to create it with, what happens to the reporter (`then`), and how many times this route may fire for
the same node group (`limit`). A clean result routes nothing - the lane simply advances.

Two targets are symbolic so the routes stay product-agnostic: `same` is the reporter's own kind (a shared
change a frontend op needs is a frontend op) and `lane.build` is the build step of the reporter's lane (a red
walk repairs what that lane builds). Both need the reporter's context; an unresolvable symbol comes back as
`unresolved`, never as a default kind.

| on | from | to | origin | limit | then |
| --- | --- | --- | --- | --- | --- |
| outcome `failed` | `uat.verify` | `lane.build` | repair | 3 | reopen |
| outcome `failed` | `e2e.verify` | `lane.build` | repair | 3 | reopen |
| verdict `findings` | `review.verify` | `lane.build` | repair | 3 | settle |
| verdict `rejected` | any | `same` | - | 2 | retry |
| verdict `gate-failed` | any | `lane.build` | gate | 3 | settle |
| blocker `srs-gap` | any | `business.revise` | business | 2 | reopen |
| blocker `sds-gap` | any | `architecture.revise` | architecture | 2 | reopen |
| blocker `interface-gap` | any | `interface.draw` | architecture | 2 | reopen |
| blocker `brand-gap` | any | `brand.decide` | architecture | 2 | reopen |
| blocker `grammar-gap` | any | `grammar.update` | architecture | 2 | reopen |
| blocker `shared-change` | any | `same` | shared | 3 | pause |
| blocker `environment` | any | *the user* | - | 1 | needUser |
| blocker `authority` | any | *the user* | - | 1 | needUser |
| outcome `ask` | any | *the user* | - | 1 | needUser |
| outcome `partial` | any | `same` | - | 5 | retry |
| outcome `failed` | any | `same` | - | 3 | retry |

`then` is what happens to the operation that reported: `retry` runs the same op again (no new op), `reopen`
returns it to pending behind the routed op, `pause` parks it until the routed op is done, `settle` finishes it
and lets the routed op carry the work forward, `needUser` stops the workflow.

`srs-gap` is the deepest of the record gaps and the newest: the **requirement** the work derives from does not
settle the case, or settles it twice in two ways. It is not an `sds-gap` - revising the design would invent the
product rule the design is supposed to realise - and it is not an `authority` block, because a confusing,
contradictory or silent record is not a reason to stop. `business.revise` states the readings the record
admits, takes the most reasonable one by the accepted records, the other features' decided records and the
product's own conventions, writes it into the requirement with its acceptance, says why in
`extensions.work3.decisionLog` and bumps the `rev`; the requester reads the settled record behind it. The one
thing it does not take silently is a reading that changes an observable outcome about money, authority or
customer data: that is reported `ask` with `question.kind: decision`, numbered options and one recommendation,
which the kernel takes provisionally while the owner is asked. `architecture.revise` is the same move one
layer later, and both are held to it by the same contract sequence and the same two validator rules. Only a
kind that **reads** the requirement may raise `srs-gap`, which is why `frontend.implement` reads `srs`.

`brand-gap` is the identity counterpart of `interface-gap`. A drawing with nothing settled to draw inside, or a
slot brief the brand record cannot satisfy - a mascot in a placement the record forbids, imagery rules the brief
contradicts - both mean the brand record is missing or silent, so the route settles the brand (`brand.decide`)
and the reporting operation reads it again. Neither the drawing, the asset operation nor the build may close the
gap themselves: one would invent an identity, one would generate outside it, one would invent the picture. Past
the bound of two the workflow asks the user, which is where a brand the product has not settled belongs.

`integration.verify` is the one kind that reads an `integration` record, and its lane is one step because
there is nothing to build first: the client that calls the provider is built by the feature's implementation
node, and this node exists to show that the call reaches the real provider. It proves one declared external
system live or it does not prove it - a mock, stub, fake, spy or recorded response standing in for the
provider is the defect the kind exists to catch. The credential is the owner's, read from the exact variable
the declaration names; a variable the environment lacks is `blocked` `environment` naming that variable,
which is the owner's question, and no secret value is written into a record, a report, an asset or a log.
Its evidence manifest carries `proof: {boundary: live, fakes: []}`, which is what lets a status view say that
an integration whose only evidence is a faked one was *proven against a fake, not live*.

`grammar-gap` is the last gap, and the four are not the same question: `srs-gap` means the requirement is
unsettled, `interface-gap` means the drawing is silent, `brand-gap` means the identity is unsettled,
`grammar-gap` means the language itself lacks the word. Each routes to the record that owns it - the
requirement, the drawing, the brand record, the grammar package - so nothing is answered in the place that
merely discovered it. The grammar one is the deepest and the most bounded: only the
two kinds that render a surface (`interface.draw`, `frontend.implement`) may raise it, and only after writing
down an attempt to express the shape as a composition of existing contracts, because a grammar that gains a
unit per screen is no longer a grammar. `grammar.update` then grows it once, in the grammar's own repository,
publishes a version, bumps the consumer and records the unit in the canon; the requester reads that canon
again behind it. Two rounds for one node, then the user decides. A workspace whose binding declares no
`grammar` repository cannot take this route at all: the kernel says so and stops, because where a language
lives is not something to guess.

The first matching route wins, so the ordered list is the specificity order, and `validateGraph` refuses a
route an earlier one already shadows (`route-shadowed`), a blocker no route answers (`unrouted-blocker`), a
route without a limit, a route from a prove kind into a design kind (`prove-to-design`: a prover asks for a
redesign, it never is one), a design target that does not pause or reopen its requester, and a cycle between
two named kinds (`route-cycle`).

## The module

`kernel/graph.mjs` is pure apart from `loadKinds`, which reads the compiled
`.dist/model/kinds.json` exactly as `loadRuntimes` reads the allocator profile (or an authored
`model/kinds.yaml` when given a `profileDir`).

| export | signature | answers |
| --- | --- | --- |
| `loadKinds` | `({profileDir?}) -> profile` | the catalog, compiled or authored |
| `validateGraph` | `(profile?, {runtimes?, operators?, records?}) -> errors[]` | every named way the process can be wrong; `[]` is valid |
| `assertGraph` | `(profile?, {runtimes?, operators?, records?}) -> profile` | the same, as a throw |
| `laneFor` | `(node, {profile?}) -> kind[]` | the mandatory sequence of one ledger node |
| `laneRecordFor`, `laneById` | `-> lane \| null` | the lane with its matches and optional steps |
| `nextKind` | `(lane, doneKinds, {predicates?, profile?}) -> kind \| null` | the one step that may run now |
| `describeLane` | `(lane, {profile?}) -> string` | a markdown one-liner for a contract or a status view |
| `routeFor` | `({outcome, blocker, verdict, kind, lane}, {profile?}) -> route \| null` | where one report goes, bounded |
| `routeList`, `kindList`, `kindRecord` | `({profile?})` | the catalog for a status view |
| `roleOf`, `familyOf`, `isReadOnly`, `readsOf`, `writesOf`, `operatorOf`, `reportsOf`, `predicatesOf` | `(kind, {profile?})` | one property of one kind |
| `kindsReading`, `kindsWriting` | `(record, {profile?}) -> kind[]` | who may cite a record kind, and who may produce it |
| `needsOf` | `(kind, {profile?}) -> capability[]` | what a kind needs from its host beyond a worktree and a runtime |
| `KINDS`, `FAMILIES`, `ROLES`, `ORIGINS`, `OUTCOMES`, `BLOCKERS`, `VERDICTS`, `THEN`, `CAPABILITIES`, `SAME`, `LANE_BUILD` | constants | the closed vocabularies; the record vocabulary is `RECORD_KINDS` of `kernel/io.mjs`, not restated here |

`kernel/io.mjs` is the other half, and the only module that reads the record catalog:

| export | signature | answers |
| --- | --- | --- |
| `loadRecords` | `({profileDir?}) -> profile` | the record catalog, compiled or authored |
| `validateRecords` | `(profile?) -> errors[]` | `unknown-record-read`, `record-shape`, `catalog-drift` |
| `recordEntry`, `recordReads` | `(record, {records?})` | one catalog entry, and what that record kind is derived from |
| `recordKindOfPath` | `(path, {nodeKind?, records?}) -> record \| null` | what one path IS; `null` when it is not a record at all |
| `undeclaredWrites` | `(kind, files, {profile?, records?, nodeKind?}) -> [{file, record}]` | what an operation produced that its kind never declared |
| `ioBlock`, `ioPayload` | `(kind, {profile?, records?})` | the declaration as markdown under the goal, and as data for the validator |
| `kindsReadingBrand`, `intakeKindFor`, `decisionKindFor` | - | the three questions the kernel used to answer from sets of its own: which kinds receive the brand payload, which kind opens a scope the tree does not hold (`brand` -> `brand.decide`, anything else -> `work.author`), and which operation settles one decision node - read from the lanes, because a decision node's lane is a single step and that step is the answer |
| `DECISION_OPERATION` | constant | the 5.1 map, surviving only as the fallback for a kernel whose kinds profile cannot be read at all |
| `RECORD_KINDS`, `RECORDS_SCHEMA` | constants | the closed record vocabulary |

`tests/kind-graph.spec.mjs` holds the shipped profile to all of it: it validates against the real runtime
profile and the real operator catalog, every lane's kinds exist, the frontend lane cannot be entered in the
middle, `optionalWhen` skips a step only for a satisfied named predicate, every route resolves with a limit,
and every invalid profile is rejected with its named error code.
