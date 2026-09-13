# Operation granularity: one operation, one thing

An operation does exactly one thing: one implementation slice, one UAT flow, one verification of one
node, one gate. The power of a workflow comes from many small operations running at once, not from
one large agent. Four guardrails keep small operations from costing more than they return.

## 1. Seam first, then fan out — cut by acceptance, never by file
An operation is one observable behavior (one acceptance group), with the files that behavior needs.
Two operations that would both touch a shared interface are wrong cuts: the interface becomes its own
operation, scheduled first, and the two depend on it.

A node the tree already holds that is bigger than that is not built as one long slice and is not left for a
person to split. The kernel measures every launchable `implementation` node against three facts of its own
record — all three in `kernel/sync.mjs` (`cutReason`), applied identically at goal time and in the run, so the
page the user approves and the run they get never disagree:

| Measure | Bound | Constant |
| --- | --- | --- |
| files its write scope names | more than 12 | `CUT_FILES` |
| assertions it states | more than 8 | `CUT_ASSERTIONS` |
| components the SDS records in its `refs`/`dependsOn` carry | 3 or more | `CUT_COMPONENTS` |

One of them over its bound and the node gets exactly one **`implementation.plan`** operation — before its lane
and instead of its first step, once per node (`cut-planned {node, reason, files, assertions}`). It is a kind of
its own, because that is what the goal page, the status view and the events show; it carries the `work.author`
operator contract under the `work.cut` sequence, so there is no second operator. Its write scope is the node's
own folder in the tree, its check the whole-tree validator, its references the node, the design it rests on and
the code its own allowlist names.

What it does, in this order:

1. **Name the seam.** The one child that owns what every other child would otherwise touch: module wiring and
   registration, dependency-injection setup, database migrations, shared contracts, shared types and shared
   fixtures. On a frontend node the seam is the app shell and routing, the theme and grammar version bump, the
   shared store and the API client. It is built **first and alone**. Two builds that both edit the module wiring
   are not parallel work; they are one merge conflict with two authors.
2. **Cut the rest by acceptance.** One observable behaviour per child, a write scope of at most `CUT_FILES`
   files that is disjoint from every sibling *and* from the seam, one runnable check per assertion, every
   assertion traced to the same SRS/SDS ids the parent traced to. A frontend node is cut by screen and region —
   one screen, one folder — which is why the design gate runs before the cut: there is nothing to cut a
   frontend node by until the feature's `ui` node is done.
3. **Declare the order.** Every non-seam child names the seam in `dependsOn` and depends on no other sibling.
4. **Write the children** at `<node dir>/<part>/index.yaml` (work/node@2, `kind: implementation`,
   `state: todo`, `required: true`) and turn the node into a **derived parent**: no `state`, no `completion`, no
   write scope, its assertions kept as the group's acceptance under `extensions.work3.groupAssertions`. A parent
   with children authors no state and derives one from them, so removing `state` here is the job rather than a
   forgery — only `completion` stays the kernel's inside that record.

A node that really is one observable behaviour is not split: the operation reports `done` with `cut: none`
(`cut-none`) and the kernel runs the node exactly as it is.

On acceptance the tree is re-read and the children are the schedulable nodes (`cut-authored {node, children,
seam}`); the parent is derived and is no longer a candidate at all. Each child is **ordinary build work** —
`backend.implement` or `frontend.implement` with a small allowlist — never a new kind. Fan-out is bounded by
`allocation.fanOut` in `model/runtimes.yaml`: `seamFirst: true` keeps the seam alone in its group, and
`maxPerGroup: 9` against `maxParallelOps: 10` means eight or nine builds of one parent at once while the rest
of the tree still has a slot.

## 2. Context pack, prepared by the kernel
The kernel, not the operation, assembles what the operation reads: the exact SRS/SDS sections of its
node, the code files in its allowlist and their direct imports, the conventions of the module
(naming, error unions, validation style), the checks and their scopes. The contract embeds the pack as
references with line ranges; the operation is told not to explore beyond it. Token usage per operation
is recorded in the launch record so the planner can adjust the cut size from data.

## 3. Resource locks in the contract
Every operation declares `resources: [ ]` (e.g. `postgres`, `keycloak`, `e2e-runtime`, `docker`).
The scheduler never runs two operations that share a resource at the same time; global gates are run
only by the kernel between rounds; unit checks inside an operation are scoped to its node's test
pattern. UAT operations declare `e2e-runtime` and therefore run one at a time; each flow keeps its own
seed/cleanup so a flow never depends on another flow's state.

## 4. One proof per group, never one per piece
The proof runs once for the whole group, on another runtime — not once per piece. The implementer runs its own
end-to-end suite as a check; it never grades itself.

- **A node that was cut** is one group: its children build in parallel, and `e2e.verify` and then
  `review.verify` are planned **once for the parent** when every child's build step is accepted, on a runtime
  none of the children used (`avoidRuntimes` is the union). A frontend group gets **one `uat.verify` at the
  parent** — every flow of the feature walked on the rendered surface — and no `review.verify`. The parent's
  group acceptance (`extensions.work3.groupAssertions`) is what that proof is judged against, and accepting it
  records one `lane-step` for every child, which is what lets each child's lane finish without its own prove
  operation. `verifyComponents` groups by the cut parent and `planVerifyOps` waits until the whole group is
  implemented, so no subset of a group is ever proven on its own.
- **A node that was not cut** keeps the module tier: when all nodes of a module are implemented, one
  `review.verify` checks consistency across them (naming, error unions, contracts between nodes, dead code)
  without re-verifying each acceptance, on a runtime that did not implement them.
- **Findings land where they live.** `childOwning(file)` answers which child's write scope holds a file a
  finding names; a set of findings that names exactly one child becomes a repair of that child alone
  (`verify-findings {child}`), and the other children are not reopened. Findings spread over several children,
  or over none, stay the group's, exactly as before the cut. Review rounds are counted per group, and only a
  `review.verify` spends one.

## Working order per kind
An operation is cut small, but the agent still needs the order of work inside it: without one, some
wrote a green spec first, some skipped the design, some edited outside the allowlist. So every contract
carries a mandatory numbered section, `## Working order (mandatory, in this order)`, rendered by
`kernel/contract.mjs` (`stepsFor`, `sequenceFor`) from the operation's own values - its
allowlist, its `name: command` checks, its acceptance ids, references, resources, requesters and
findings - never from generic wording. The sequence is chosen from the op kind and origin, then from
the Work node kind and layout it closes, then from its allowlist; an unknown kind falls back to `generic`.

| Sequence | Chosen when | Order |
| --- | --- | --- |
| `work.author` | kind `work.author`: the node's record declares no write scope or no check, so nothing of its lane may start | read the record, its parent and sibling records and the requirement/design it references -> open the actual code an implementation would change and list those files -> state the claims as testable assertions -> write the write scope and one runnable check per assertion into the record -> leave `completion`, the kernel block, the evidence folder, `required`, `state` and `dependsOn` untouched -> run the validator -> report the assertions and checks added; an undeterminable scope is `ask`, never a guessed path |
| `work.cut` | kind `implementation.plan`: the kernel measured the node as too big for one operation (write scope past 12 files, more than 8 assertions, or a design of 3 or more components) | read the node, its assertions and the design it references -> open the code its write scope names -> NAME THE SEAM first: the one child that owns the module wiring, DI registration, migrations, shared contracts and types every other child would touch (on the frontend: app shell and routing, theme and grammar version, shared store, API client) -> cut the rest by acceptance, one observable behaviour each, allowlist ≤ 12 files, disjoint from every sibling and from the seam, one runnable check per assertion, every assertion traced to the same SRS/SDS ids the parent traced to, every non-seam child `dependsOn` the seam -> write the children at `<node dir>/<part>/index.yaml` (work/node@2, `kind: implementation`, `state: todo`, `required: true`) -> turn the node into a derived parent: no `state`, no `completion`, no write scope, its assertions kept as `extensions.work3.groupAssertions` -> run the validator -> report the seam and the children. A node that is one behaviour is `done` with `cut: none`; a seam the material does not determine is `ask`, never a cut that leaves two children writing the same file |
| `work.intake` | kind `work.author` carrying an `intake` scope: the tree does not hold the feature at all, so this operation authors its records rather than completing a node | restate what the feature must let the business do -> DETERMINE every side as checkable claims (architecture, user stories per actor, security and authority, business rules and states, quality with numbers, external integrations with the exact credential variable the OWNER provides, open decisions) -> RECONCILE every side against the decided records as one typed row per touched record under `extensions.work3.reconciliation`, in exactly three cases and no fourth: `reference` cites the decided record by id and restates nothing of it, `conflict` writes a `todo` decision record under THIS feature with both sides, the consequences, numbered options and one recommendation and leaves the decided record byte for byte (the kernel puts it to the owner), `new` is authored here declaring the `reads` it rests on and the `hands` it passes on -> mirror the example feature's shape under the allowlist -> full business drafts, architecture skeleton, every leaf `todo` -> run the validator verbatim -> report the records, the count per case and the decisions left for the owner. No other feature's record changes by a byte, and no gap is filed against one |
| `implement.ledger` | `backend.implement` / `interface.implement` from a ledger `implementation` or `ui` node | read SDS/SRS + assertions -> spec red -> smallest change -> checks -> self-audit -> report once |
| `implement.shared` | origin `shared` | read the requester's paths -> minimal change, no refactor -> requester's checks -> report |
| `implement.repair` | origin `repair` | map each finding -> confirm the check fails -> fix each -> re-run -> report with a finding -> fix map |
| `implement.gate` | origin `gate` | read the failing gate -> re-run it -> fix exactly what it names -> re-run -> report |
| `interface.draw` | kind `interface.draw` | read SRS/SDS + assertions -> enumerate every screen and DESCRIBE every state in the record (only the main state is drawn; loading, empty and error are the grammar's own state contracts the build renders) -> read the WHOLE installed canon and the brand, compose inside them -> write the interface design record (blueprint, states with the contract that renders each, slots, copy, the grammar version and brand rev it was drawn against) -> COMPOSE one candidate per screen and viewport from the grammar package's own renderers in a scratch folder outside the product, CAPTURE it with headless Chrome into the node's `assets/`, and KEEP THE MARKUP it rendered beside each PNG as `<candidate>.html` so the render can be checked from its source -> declare every artwork the chosen candidate embeds as an `artworkSlots` entry -> run `starci render check` over the node and fix what it names, a check it could not run being unproven and never a pass -> report; a missing business rule is `blocked` `sds-gap`, a region the grammar cannot render is `blocked` `grammar-gap` |
| `interface.asset` | kind `interface.asset` | read the record's `artworkSlots` and locate each slot's crop in the chosen candidate (undeclared artwork is `blocked` `interface-gap`) -> read the brand record and the masters each slot references -> generate each slot with the image model from that crop and those masters as references -> write one file per slot at the allowlisted asset path only -> open every file, compare it against its slot, record `{slot -> file, sha256}` back into the record -> self-audit -> report the slot -> file table; a brief the brand rules cannot satisfy is `blocked` `brand-gap` |
| `frontend.implement` | kind `frontend.implement`, or any implementing kind on an `implementation/frontend/**` node | read the interface design record first (a screen, state or artwork it lacks is `blocked` `interface-gap`) -> story/spec red per state -> implement with the typed components only -> wire each artwork slot's generated file into the component its region binds -> update stories and skeletons -> lint/typecheck/unit -> self-audit every slot as wired -> report |
| `review.verify` | kind `review.verify` | read-only: run every check yourself -> compare against assertions and SDS -> findings name file+line+assertion -> never fix -> `done` with findings (empty when clean) |
| `e2e.verify` | kind `e2e.verify` (the prove step of the backend lane) | read the design (SDS/SRS) + assertions -> one scenario per assertion at the allowlisted spec path, exercised through the public API on the real stack the suite starts itself (containers), never a screen and never a mock of the unit under proof -> run the listed check verbatim -> self-audit the allowlist -> `done` only with a green run and the spec paths; a red scenario or a runtime that cannot start is `failed` |
| `integration.verify` | kind `integration.verify`, or a ledger `integration` node | read the `extensions.work3.integrations` entry this node proves (id, provider, the exact credential variable, where the code reads it, the provider's sandbox) and restate per assertion the call and the effect the provider must show -> take the credential from that environment variable and nowhere else; an environment that lacks it is `blocked` `environment` naming that variable and nothing else - no value, no guess, no partial run, no fallback -> write the live scenario at the allowlisted path, one per assertion, each calling the real provider's sandbox: no fake, stub, mock, recording, replay, local double, skipped test or "when the key is missing" branch -> run the listed check verbatim and keep the whole output with every secret masked -> write the evidence with `proof: {boundary: live, fakes: []}` -> report `done` only on a green live run; a rejected scenario, an outage or a rate limit is `failed` |
| `uat` | a ledger `uat` node without an explicit `uat.verify` kind | read the flow folder (flow, seed, accounts) -> e2e spec at the allowlisted path -> run on the `resources` runtime -> report with the output; a runtime that cannot start is `failed`, never `done` |
| `uat.verify` | kind `uat.verify` | read the flow folder, seed and accounts -> start the named runtime -> walk the rendered surface as a person does, never the API -> a screenshot per step -> compare each step against the interface design record and the assertions -> write the run record under the flow folder -> `done` only on a complete passing walk |
| `migration` | allowlist contains `migrations/` | new migration only -> apply on a real container -> roll back -> re-apply (idempotence) -> checks -> report |
| `operations` | `runtime.operate` or a ledger `operations` node | apply on a real container -> roll back -> re-apply -> checks -> report |
| `architecture.revise` | kind `architecture.revise` | read the gap report and the named SDS passage -> state the two or three readings it admits (a gap that is really a missing requirement is `blocked` `srs-gap`) -> choose the most reasonable one by the accepted records, the other features' decided records and the product's own conventions -> write it into that section with its contract and acceptance -> bump its `rev` and append exactly one `extensions.work3.decisionLog` entry `{rev, at, gap, chosen, why, alternatives}` -> run the validator check -> report the rev and the entry; no code. The ONE `ask`: readings that differ in an observable outcome about money, authority or customer data are reported `ask` with `question.kind: decision`, numbered options and one recommendation |
| `business.revise` | kind `business.revise` | the same move one layer earlier, on the requirement: read the gap and the named SRS passage -> state the readings it admits (a gap that is really a missing design is `blocked` `sds-gap`) -> choose the most reasonable one -> write it into the requirement, rule or journey with the acceptance an implementer derives code from -> bump the `rev` and append exactly one decision-log entry -> run the validator check -> report the rev and the entry; no code, and the same one `ask` and no other |
| `grammar.update` | kind `grammar.update`, whatever the origin or the node it came from | read the gap report, the requirement/design it names, the WHOLE canon and the brand (a gap that is really a missing rule or screen is `blocked` `sds-gap`/`interface-gap`) -> try the composition of existing contracts and blueprint regions FIRST and write the attempt down; if it composes, report `done` with that composition and change nothing -> only then name the one new semantic unit (primitive or block) with its anatomy, slots, states and reused tokens -> implement it in the grammar repository with its stories and tests, red before and green after -> run that repository's gates verbatim, publish one new version only behind green gates and read it back from the registry -> bind the version in the consumer or raise `shared-change` with the exact manifest paths -> record the unit in the canon -> report the unit, the version and the canon entries; no product page |
| `decide` | `business.decide` (what the product must do) / `architecture.decide` (how the system satisfies it) | closed options only -> weigh against the requirement and the layer it must stay inside -> write the decision with rationale into the node -> no code, and no decision belonging to the other layer |
| `brand.decide` | kind `brand.decide`, or a ledger `brand` node | read the accepted scope and the owner's rulings -> read every colour value out of the real style/token files and record the token name, the value and the file it came from -> give each token its role, the danger-may-match-primary policy and the contrast floor, and measure the pairs -> settle typography, the one icon set, mascot and logo, reusing existing assets and generating at most one placeholder mascot with the image model -> write the record (identity, tokens, mascot/logo rules, imagery prompt rules, artwork slots, voice, motion, forbidden, `sources`) -> run the brand checks and bump `rev` -> report the rev; an untraceable value is `ask`, a missing source file is `blocked` `environment` |
| `generic` | anything else | read -> prove failing -> change -> checks -> self-audit -> report once |

### Before the lane: completing the record
An operation is cut by acceptance (§1), which presumes the node says what its acceptance is and what proves it.
A node whose record declares neither cannot be cut at all, and the kernel will not invent a scope for authored
work. `work.author` is that gap closed as work rather than as a question: one operation, whose whole write scope
is the node's own `index.yaml`, whose whole check is the Work validator, and which builds nothing. It precedes
the node's lane, it is bounded at one per node per workflow, and a record still incomplete after it was accepted
is the one case that does go back to the user.

### The frontend lane
A frontend node is not one operation. Its sequences run in order - `interface.draw` -> `interface.asset` ->
`frontend.implement` -> `uat.verify` - and each one says so in its definition of done ("the node is done only
after `uat.verify`"), so no single operation of the lane can report the node finished:
- `interface.draw` is design before code: it enumerates the screens and every state (loading, empty,
  error, populated, permission-denied) and records the blueprint, contract slots and copy. A state nobody
  enumerated is a state nobody builds, and an implementer that has to guess one is the cost. It also declares
  every artwork the chosen candidate embeds - an illustration, the mascot in an empty state, a decorative
  image, a chart placeholder - as an `artworkSlots` entry carrying the region it sits in, its purpose, the
  brief that reproduces it, its size and format, the brand masters it uses and the crop of the candidate it
  came from. A candidate whose artwork the record does not list is an incomplete record.
- `interface.asset` turns those slots into files. It generates each one with the image model from the slot's
  own candidate crop and the brand masters it references, so the asset is the artwork that was approved rather
  than a fresh reading of its words, writes it at the allowlisted asset path at the declared size and format,
  and records `{slot -> file, sha256}` back into the record. It writes no product code: the wiring is the
  build's step. A brief the brand rules cannot satisfy is `blocked` with blocker `brand-gap`, which routes back
  to `interface.draw`; a host without an image model is `failed`, because a placeholder is not an asset. The
  step is optional only through `node.hasNoArtworkSlots` - a record that declares no slot has nothing to make.
- `frontend.implement` may only build what that record describes. A screen or state the record lacks is
  `blocked` with blocker `interface-gap`, which routes back to `interface.draw` - never an improvised
  layout. Stories and skeletons move with every layout change, so each state stays renderable alone. It
  consumes the generated artwork rather than producing any: each slot's file is imported into the typed
  component the record binds to that region, and an image that is missing, substituted, redrawn or invented
  here is a defect, not a shortcut - a slot it cannot ship is `blocked` `interface-gap`/`brand-gap`.
- `uat.verify` walks the rendered surface with a screenshot per step and compares what is on screen to
  the design record, artwork included: every declared slot is visible at its region in that step's capture and
  is the file the record names, so a missing or different asset is a failed step. A walk through the API proves
  the server, not the surface; a walk that stopped early is `partial`/`failed`, never `done`.
- A requirement (SRS) gap - the requirement does not settle the case, or settles it twice in two ways - is
  `blocked` with `srs-gap` and routes to `business.revise` on the business node that owns the record, which
  takes the most reasonable reading, says why in the decision log and bumps the `rev`. A design never invents
  the product rule it is supposed to realise, and a build never picks a reading in code.
- A design (SDS) gap found anywhere in the lane is `blocked` with `sds-gap` and routes to
  `architecture.revise`, which edits the named section, bumps its `rev` and writes no code.
- An identity gap - no colour token, no typeface, no mascot rule to draw inside - is `blocked` with
  `brand-gap` and routes to `brand.decide`, which settles the one brand record out of the product's real
  style and token files and bumps its `rev`. A drawing never invents a colour to get itself unblocked.
- A language gap - the accepted requirement needs a shape no contract of the installed grammar renders and no
  composition of existing contracts covers - is `blocked` with `grammar-gap` and routes to `grammar.update`,
  which grows the grammar by one semantic unit in its own repository, publishes it and records it in the canon.
  Its first move is an attempt *not* to grow anything: a shape that composes out of existing contracts is
  reported as that composition and the grammar is left alone, because a grammar that gains a unit per screen is
  no grammar. Neither the drawing nor the build may invent the unit beside it in a page.

Why the order matters:
- Spec red before code: a spec written after the code is green by construction and proves nothing; the
  kernel verifies fail-before/pass-after itself (`verify-proof`), so a green-first spec is caught as a weak
  proof and the operation is wasted.
- Smallest change inside the allowlist: other operations run in the same worktree; a path outside the
  allowlist is a `blocked` with `shared-change` and the exact paths, never an edit.
- Report once, with the real vocabulary: `done|partial|failed|ask|blocked`, blockers `shared-change`,
  `sds-gap`, `interface-gap`, `brand-gap`, `grammar-gap`, `environment`, `authority`. A second report, a `done` on an unrun
  spec or a `done` on a partial walk is a downgrade to `failed`.
- Design before code, in both directions: the red spec proves the behavior, the interface design record
  proves the surface. An operation that invents the screen it implements leaves nothing for review to
  compare against, which is why `interface-gap` routes back instead of being improvised.
- Declared, generated, wired - artwork is the same rule one level in. The approved candidate is a picture, and
  the parts of it no component can draw are exactly the parts an unguarded build would drop or replace with
  something close enough. Declaring each one as a slot makes it re-renderable, generating it from that slot's
  crop makes it the same artwork, and wiring it by file name makes the shipped page show what the person
  approved rather than a later interpretation of it.
- Verify is read-only: a reviewer that fixes what it reviews leaves nothing for the repair operation and
  hides the finding from the ledger.

### Not yet: cutting a `ui` node
A `ui` node can be as big as an implementation one — a feature with eight screens is one drawing operation
today. The same `implementation.plan` shape applies to it: children at `ui/<screen>`, each one
`interface.draw` of a single screen (one grammar render, checked by the render checks), with the artwork slots
gathered back at the parent so `interface.asset` still runs **once per parent** rather than once per screen.
That is not in this build: `cutReason` measures `implementation` nodes only, so a `ui` node is never cut and
walks its lane whole. It is the next step, and it needs one thing this build does not have — a rule for where a
slot declared by a child is read from when the parent's asset operation generates it.

## Consequences for the planner and the kernel
- The goal planner emits operations that satisfy §1: a node past the bounds is planned as one
  `implementation.plan` instead of its first lane step, so the page the user approves reads
  `1 implementation.plan -> seam -> N backend.implement -> 1 e2e.verify -> 1 review.verify`.
- `renderContract` embeds the context pack (§2), the resource list (§3) and the working order of the kind (`stepsFor`).
- The scheduler checks allowlist disjointness and resource disjointness before launching, then the fan-out rule:
  the seam of a cut group runs alone and at most `allocation.fanOut.maxPerGroup` children of one parent run at once.
- `planVerifyOps` creates one proof per cut parent (`e2e.verify` then `review.verify`, or one `uat.verify` on a
  frontend group) and one module-tier review per module for everything that was not cut.
