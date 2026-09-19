# StarCi 5-plus: one flow, declared inputs and outputs, the owner decides

Status: the design of release `5.0.0-plus`, describing the runtime **as built**. It consolidates the rulings
of 2026-09-12 and 2026-09-13 into one structure instead of the sequence of patches they arrived as. Where
this document and an older document disagree, this one is the runtime; the guides describe the parts in
detail and were rewritten to match: [workflow-kernel.md](workflow-kernel.md), [kinds.md](kinds.md),
[model-functions.md](model-functions.md), [workflow-chat.md](workflow-chat.md),
[brand-checks.md](brand-checks.md), [op-granularity.md](op-granularity.md),
[work-ledger.md](work-ledger.md).

## 1. The model in one page

```text
Job (the owner's prompt, verbatim)
  └─ critique         the runtime challenges the prompt: sound | revise | refuse, prerequisites, overlaps
     └─ goal          ledger nodes (Work tree) or an assessed plan; intake ops for what the tree lacks
        └─ approval   the one human gate; refuse needs the owner's stated override
           └─ workflow   one kernel, one worktree (a lane), one host: Orca or headless
              ├─ op       one kind, one contract: what it READS, what it PRODUCES, its checks, its acceptance
              │  └─ record   every kind of record declares what it is derived from; the kernel matches the two
              ├─ owner question   a non-mechanical ask or a missing credential pauses the op: decision.prepare
              ├─ reconciliation   a feature against decided records: reference | conflict | new, as data
              ├─ validator        the one validator, given the declared inputs and outputs, not a feeling
              ├─ render checks    generated direction is separate from downstream Grammar/browser proof
              └─ proof digest     a completion remembers the declaration it was accepted under
```

Six statements hold the release together. Every section below is one of them made concrete.

1. **One workflow is one flow.** One Orca lane worktree per workflow, merged back on `done`; the same kernel
   runs in a plain Claude Code or Codex chat on the headless host (one chat, one workflow, sequential,
   `host-unsupported` for what a host cannot do); the supervisor and the kernels follow the build; the
   provider quota is probed, never guessed.
2. **Every owner prompt is critiqued before it is a goal.** The critique changes the plan: a prerequisite the
   tree lacks becomes the intake that runs first, a `revise` binds the contract of every operation, and a
   `refuse` is not approvable without the owner's stated override. The critic also reads the goal against the
   decided records and names its overlaps: a conflict is listed for the owner on the goal page before any intake
   runs, a reference is a record the intake is told to cite, and both travel into the intake's contract (§4).
   Objections and overlaps alike are read leniently, because a goal that goes uncritiqued costs more than a
   row the kernel could not shape.
3. **Input and output are explicit.** Every operation kind and every record kind declares what it reads and
   what it produces, as data in `model/kinds.yaml` and `model/records.yaml`; the op catalog, the kind graph,
   the contract and the validator are held to the same declaration by `validateGraph` and `ops/validate.mjs`.
   Duplicates and conflicts between records are matched against these declarations.
4. **Adding a feature is a reconciliation with three cases.** Reference what a decided record already holds,
   never restate it; never overwrite or average a conflict - put it to the owner as a decision record; author
   what is new, declaring what it reads from the decided records and what it hands on. An intake determines
   every side as checkable claims before it reconciles.
5. **The owner decides; the runtime prepares.** A question that is not mechanical, or a credential or
   authority the environment lacks, pauses the op and opens `decision.prepare` (or `provision.ask` for a provision); the supervisor model answers only
   mechanical questions; a credential is never invented, stubbed, defaulted or silently skipped, and no
   secret value is written anywhere. What is NOT a question for the owner is an unclear record: an SRS or an
   SDS that is confusing, contradictory or silent is revised by the runtime towards its most reasonable
   reading, with the reason in the record's decision log and the `rev` bumped. A reading that moves money,
   authority or customer data is put to the owner as distinct typed outcomes and one recommendation; dependent
   work stays non-actionable until an exact owner answer/receipt selects one (§4b). What the owner must PROVIDE is read from the whole
   product up front instead of one stuck operation at a time.
6. **Design delivery is image-first.** For a large FE scope, `interface.draw` selects a small representative
   critical-screen set and invokes built-in ImageGen with accepted business/SDS, brand, UI knowledge and actual
   Grammar anatomy/reference inputs. It retains exact prompts, images and actual tool provenance, and maps every
   remaining screen/state/component. Generated direction is not exact component/render/API proof; actual Grammar
   implementation captures and browser UAT remain separate required evidence.

## 2. Records: what a Work record is derived from

A **record kind** is what a file in the Work tree or the product is, independent of the operation that wrote
it. `model/records.yaml` (`starci/records@1`) is the closed catalog; `kernel/io.mjs` reads it, nothing else
does. `layout` is the path patterns `recordKindOfPath` matches, read most-specific-first; `nodeKinds` is
which Work node kinds carry a record of this kind, which is not the same question as which record a node's
own `index.yaml` is.

| record kind | layout | derived from (`reads`) | node kinds |
| --- | --- | --- | --- |
| `record` | `**/index.yaml` | - (the node's own declaration) | `implementation`, `uat`, `e2e`, `operations` |
| `srs` | `features/*/business/**` | `decision` | `business`, `business-overview`, `module` |
| `sds` | `features/*/architecture/**` | `srs`, `decision` | `architecture` |
| `decision` | `features/*/business/srs/business-rules/policy-decisions/**` | - (the owner's) | `business` (with the `srs-policy-decision` section) |
| `brand` | `brand/index.yaml`, `brand/**` | `code` | `brand` |
| `design` | `features/*/ui/**` | `srs`, `sds`, `brand`, `grammar` | `ui` |
| `asset` | `**/assets/**` | `design`, `brand` | - |
| `code` | `repository:**` | `sds`, `design`, `grammar` | `implementation` |
| `grammar` | `grammar:**`, `knowledge/grammars/**` | `design` | - |
| `evidence` | `**/evidence/**` | `code`, `design`, `srs` | `uat`, `e2e` |
| `runtime` | - (declared, never written as a file) | `code` | `operations` |
| `integration` | `features/*/integration/**` | `srs`, `sds` | `integration` |

`reads` is the derivation, not the file dependency: an `srs` record is derived from the owner's decisions,
`code` from the design it realises, `evidence` from the code it proved. The catalog is what makes "C repeats
A" and "C conflicts with A" a matter of ids: a record of kind K may cite another record only through the
kinds K reads, and a record that restates one of them is a duplicate by declaration.

Two entries deviate from the first draft of this table, and both deviations are the shipped runtime. `code`
reads `sds`, `design` **and** `grammar`, because `grammar.update` and `uat.verify` both write code while
reading the design and the grammar and never the sds - a catalog naming `sds` alone would make `writer-blind`
refuse the shipped kind table. `brand` reads `code` because every token is traced out of the product's real
style and token files, which is why an untraceable value is a question for the owner rather than a record
entry.

`validateRecords` refuses a catalog that adds to or drops from the closed `RECORD_KINDS` list
(`catalog-drift`), an entry missing its purpose, layout, `nodeKinds` or `reads` (`record-shape`), a
derivation source nobody declares and a record declared as its own source (`unknown-record-read` - a record
derived from itself would make every restatement of it legal by declaration).

## 3. Kinds: what an operation reads and what it produces

`model/kinds.yaml` (`starci/kinds@2`) replaces the single `mutates` list of 5.1 with two lists over the
record catalog, and the kernel, the contract and the validator read them instead of keeping sets of their
own. This is the shipped table, entry for entry:

| kind | reads | writes |
| --- | --- | --- |
| `decision.prepare` (or `provision.ask` for a provision) | `srs`, `sds`, `decision` | `decision` |
| `business.decide` | `srs`, `decision` | `srs`, `decision` |
| `business.revise` | `srs`, `decision` | `srs` |
| `architecture.decide` | `srs`, `sds`, `decision` | `sds`, `decision` |
| `architecture.revise` | `srs`, `sds`, `decision` | `sds` |
| `brand.decide` | `code`, `grammar` | `brand`, `asset` |
| `interface.draw` | `srs`, `sds`, `brand`, `grammar`, `design` | `design`, `asset` |
| `interface.asset` (needs `design-tool`) | `design`, `brand` | `asset`, `design`, `code` |
| `frontend.implement` | `srs`, `sds`, `design`, `asset`, `brand`, `grammar`, `code` | `code` |
| `backend.implement` | `srs`, `sds`, `decision`, `code` | `code` |
| `runtime.operate` | `sds`, `code`, `runtime` | `runtime`, `code` |
| `grammar.update` | `design`, `grammar`, `brand` | `grammar`, `code` |
| `uat.verify` | `srs`, `design`, `asset`, `brand`, `code` | `evidence`, `code` |
| `e2e.verify` | `srs`, `sds`, `code` | `evidence`, `code` |
| `integration.verify` | `integration`, `sds`, `code` | `evidence` (`proof: {boundary: live}`) |
| `review.verify` | `srs`, `sds`, `code`, `evidence`, `runtime` | - (read-only) |
| `work.author` | `srs`, `sds`, `decision`, `code`, `record` | `record`, `srs`, `sds`, `decision` |

Five of these rows are wider than the first draft, and each one is a fact of the operator that was already
shipping. `frontend.implement` reads `srs` because an operation may only report `srs-gap` about a requirement
it actually had in front of it (§4b), and a build that never reads the requirement cannot say the
requirement is unsettled. `interface.draw` writes `asset` because representative images and exact prompt files live in
the ui node's `assets/` (§7). `interface.asset` writes `code` because the generated artwork lands in the
bound source repository at the path the design record declares - the files are asset bytes and product
source at once. `e2e.verify` and `uat.verify` write `code` because each authors its scenario spec inside the
bound repository; what they may never write is *product* code, and that ceiling is the operator's allowlist,
not the record catalog. `uat.verify` reads `brand` because `kindsReadingBrand()` replaced the kernel's
hard-coded `DESIGN_KINDS`, and a walk that judges a rendered surface is handed the brand payload exactly as
the drawing and the build are. `review.verify` reads `runtime` because the operations lane proves
`runtime.operate` with it, and a prover that cannot read the record its build wrote is `lane-proof-blind`.

What `validateGraph` refuses beyond the 5.1 lane and route rules:

- `unknown-record` - a `reads` or `writes` entry the record catalog does not declare.
- `writer-blind` - **a writer must read, or itself write, at least one source of the record it writes.** The
  rule is not "reads everything the record is derived from": a kind that authors two records in one operation
  may satisfy the derivation from its own output, which is how `business.decide` writes `srs` while writing
  the `decision` that `srs` is derived from. A record with no declared sources (`record`, `decision`) exempts
  its writers entirely, because there is nothing to be blind to.
- `lane-proof-blind` - a lane whose prove step does not read every record kind its build step writes.
- `route-target-blind` - a route whose target kind writes nothing that every kind which may raise the blocker
  reads (`brand-gap` routes to `brand.decide` because it writes `brand` and every raiser reads `brand`).
- `readonly-writes` / `writes-nothing` - the read-only invariant of 5.1, restated over `writes`.
- `unknown-capability` / `needs-shape` - a `needs` entry outside the `capabilities` vocabulary is a promise no
  host could satisfy.

What `ops/validate.mjs` refuses (`IO_DRIFT`): an operator contract whose `writes[].path` maps to a record
kind the kind graph does not let that kind write. Paths map to record kinds by the layout of §2
(`recordKindOfPath`), and the operator templates are written in the same vocabulary - `N/` is the node's own
folder, `E/` its evidence bundle, `repository:` the bound source, `grammar:` the installed grammar. Three
destinations are outside the rule, because they belong to the kernel rather than to the operation's kind:

- everything under `E/` - the attempt report `schemas/op-report.schema.yaml` requires of every operation
  whatever its kind;
- a `node` row on `N/index.yaml` whose fields are only `state`, `blocker`, `completion` or
  `extensions.work3.kernel` - the kernel writing its own receipt into the node the operation ran on;
- an evidence manifest recognised by its own fields (`id`, `nodeId`, `inputDigest`, `outcome`, `assertions`,
  `assets`) wherever it is written, because a frontend build keeps its capture of the running page under the
  node's `assets/` and a path alone cannot tell that capture apart from declared artwork.

An operator that carries no kind at all - the 4.x jobs the kind graph never adopted - is outside the
declaration and is not held to it.

What the kernel does with the declaration (`kernel/io.mjs`):

- The contract prints `## Reads` and `## Produces` under the goal (`ioBlock`), so an operation knows which
  records it may cite and which it may write before it reads its allowlist.
- After a `done`, every changed file the op itself reported is mapped to a record kind; a file whose kind the
  op does not declare in `writes` is the finding `produced a <kind> record it does not declare`, the report is
  downgraded to `failed` and the op is retried (`io-undeclared-write`). This runs before the validator and asks
  no model. A path that is not a record at all - the kernel's own state, `_local`, `_resources` - is never a
  finding, and neither is a record the op never claimed: one Work tree is shared by a project's repositories,
  so a file another workflow left dirty beside this one is not its product.
- The validator is given `io:{reads,writes}` with the one rule that makes it binding: a record cited outside
  `reads` or written outside `writes` is a defect, whatever else the diff gets right.
- `kindsReadingBrand`, `intakeKindFor` and `decisionKindFor` answer from the two profiles what the kernel
  used to keep as `DESIGN_KINDS`, `WORK_OPERATION` and `DECISION_OPERATION`. `decisionKindFor` reads the
  lanes: a decision node's lane is a single step, and that step is the answer.

## 4. Reconciliation: three cases, as data

### The principle

Adding a capability to a product whose features are already decided is not an append. A new feature C
arriving beside decided features A and B does not get to sit next to them and be true on its own terms: what
has to hold after the change is the **whole product as one consistent set of decided records**. So every
decided record that C touches is re-examined, and there are exactly three things that re-examination can
find.

What a decided record already holds, C cites by its id and leaves exactly as it is - not re-worded, not
re-defined, not copied into C's own records under another name, because two statements of one rule are two
rules the moment one of them is edited. What C would change in a decided record is a **conflict**, and a
conflict is the owner's: the intake states both sides, the consequences of each, the numbered options and one
recommendation in a decision record under C, and the decided record becomes its revised version only through
the owner's answer. The runtime never writes that revision, never overwrites the record and never averages
the two positions - and every part of C that rests on the unsettled question stays a draft behind it, which
is why **the workflow may not finish `done` over an unsettled conflict**. What no decided record covers is
**new**: authored under C, declaring what it reads from the decided records it rests on and what it hands on,
both to the records of C that follow it and to the decided records that will now depend on it.

The owner's shorthand for this thinking is "A, B + C => A', B', C'"; the three typed cases below are how the
runtime makes it checkable. That shorthand is an illustration and nothing else - it appears in no contract,
no model function, no operator and no prompt, because what an operation is told is the cases.

### The table

An intake (`work.author` over a whole feature, `op.intake`) first determines every side of the feature as
checkable claims - architecture, user stories per actor, security and authority, business rules and states,
quality with numbers, external integrations with the exact credential name the owner provides, open
decisions - and only then reconciles them against the decided records of the product. The result is one table
in the feature's module record, `extensions.work3.reconciliation`, whose rows are typed:

```yaml
extensions:
  work3:
    reconciliation:
      - case: reference          # C repeats what A already holds: cite A by id, never restate it
        record: demo.sales.business.srs.rule.refund-window
        detail: the collab refund path follows the sales refund window as decided
      - case: conflict           # C cannot hold together with what A decided: never overwrite, never average
        record: demo.sales.architecture.sds.contract.intake-command
        decision: demo.collab.business.srs.decision.d-intake-contract
        detail: collab needs an asynchronous intake; sales decided a synchronous contract
      - case: new                # C is new: authored under C, declaring what it reads and what it hands on
        record: demo.collab.business.srs.fr.share-thread
        reads: [demo.sales.business.srs.rule.refund-window]
        hands: [demo.collab.architecture.sds.flow.share]
        detail: sharing a thread is a capability no decided record covers
```

`kernel/reconciliation.mjs` is the pure module. `readReconciliation(record)` answers
`{rows, findings, table}`: the rows it could normalize to `{case, record, decision, reads, hands, detail}`,
the rows it could not, and whether the record carried a table at all. A row the reader cannot shape - not a
mapping, a case outside the closed three, no record id - comes back as the finding
`reconciliation-row-malformed` rather than as an exception, because a malformed table is a defect of the
intake the kernel reports back to it, never a crash of the loop that was checking it. `table: false` is what
tells `reconciliation-missing` apart from an empty table.

`scopeReconciliation(tree, scope, readNode)` collects the rows under one scope, shallowest record first, so
the feature's module record answers. When the tree listing holds nothing under the scope - a validator run
taken before the op, a projection that lists only what it could bind - **the module record is read from disk**
at `<workRoot>/features/<scope>/index.yaml` instead. A table that exists is never reported missing for being
newer than the listing.

`checkReconciliation(rows, {tree, scope, ...})` is the mechanical half. Each rule is one named finding; a
finding downgrades the intake report to `failed` and the op runs again with the findings:

| finding | rule |
| --- | --- |
| `reconciliation-missing` | an intake over a tree that holds decided records of other features wrote no table |
| `reference-unknown` | a `reference` row names a record the tree does not hold, or one that is not decided |
| `reference-restated` | a `new` record under C repeats a sentence of the referenced record word for word |
| `conflict-without-decision` | a `conflict` row names no decision record, or one that is not a `todo` `decision` node under C |
| `conflict-edited` | a `conflict` row's decided record was changed while the intake ran (its digest moved) |
| `new-unknown` | a `new` row names a record outside C, or `reads`/`hands` ids the tree lacks |
| `new-reads-blind` | a `new` row cites a record of a kind its own record kind is not derived from |
| `reconciliation-row-malformed` | the table, or one of its rows, is not a shape the reader can normalize |

Two of those rules need their mechanics stated, because they are the ones a reader would otherwise have to
guess at. **Restatement** is not a similarity score: a statement is cut into sentences, each sentence is
folded (whitespace collapsed, case dropped, trailing punctuation removed), and a folded sentence of at least
`RESTATEMENT_WORDS` (12) words appearing in two records is the same sentence written twice. A shorter
sentence is left to the validator, because "the refund window is 30 days" is a fact two features may both
state without either restating the other. **`conflict-edited`** compares the digests the kernel captured at
launch (`op.intakeDigests`, sha-256 of each node file's bytes) against the tree now, so a decided record that
moved while the intake ran is caught against what the tree held *before* the op rather than against the
intake's word for it. A node whose file cannot be read is left undigested: an unreadable record proves no
edit either way.

`recordReadsOf(kind)` answers which record kinds a `new` row may cite, and **it includes the record's own
kind**. That is deliberate and it is not the same list as §2: a rule that refines another rule, or a design
that cites a sibling design, is a peer citation and not a derivation. Without it the design's own worked
`new` row - a collab requirement citing a sales requirement - would be `new-reads-blind` against its own
example.

What the kernel does with a valid table (`reconciled {op, scope, reference, conflict, new}`): every
`conflict` row is put to the owner exactly as an `decision.prepare` (or `provision.ask` for a provision) decision is - a `needUser` item of kind
`decision` carrying the decision record, its numbered options and the command that answers it. The command is
the same one an `decision.prepare` (or `provision.ask` for a provision) takes, and its `--op` is **the intake operation's id**, because the intake is the
op that wrote the decision record:

```
starci workflow-answer --id <workflow> --op <intake op id> --choice <n> [--note "..."]
```

`answerOwnerQuestion` recognises both shapes: an `decision.prepare` (or `provision.ask` for a provision) op answers on the ask, and any other op with a
`decision` item on the list answers on that item's own record (`raiser.decisions`). Only a requester that is
still live is resumed - the intake itself is already accepted, and re-running it would undo the
reconciliation the owner just settled. The workflow finishes `blocked` on an unanswered conflict, never
`done` over one. A `reference` row changes nothing. A `new` row is the record the next sync sees as a node.

The three participants see the same cases:

- **The critic** answers `overlaps: [{record, case, evidence}]` beside its verdict, over the two cases it can
  see from the goal text and the decided records (`OVERLAP_CASES = [reference, conflict]`). The third case is
  not an overlap with anything and is not the critic's to name. Overlaps are read as leniently as objections:
  an entry naming no record or an unknown case is dropped and counted, never a reason to send a whole
  critique back. Its rules are binding in the other direction too - a goal that would only be added beside
  the decided records, naming none of them, is `revise` with the reconciliation in `required`, and that
  *does* reach the owner and every operation's contract.

  The overlaps travel. `critiqueGoalPhase` keeps them in `state.critique.overlaps` (only the two closed cases;
  anything else the critic called an overlap is dropped) and counts them on the `goal-critiqued` event; the goal
  page prints a `conflict` under `### Conflicts for the owner` and a `reference` under `### Records to cite`,
  so the owner reads the critic's reading before approving; and the intake's contract carries them as
  `## Reconciliation the critic found` - one row to write per overlap, a `conflict` row with its decision
  record, a `reference` row citing the record by id. The kernel still checks the table the intake writes
  against the tree by id: the critic's reading is a head start, never the verdict.
- **The intake contract** (`work.intake` in `kernel/contract.mjs`) is written around the sides and the three
  cases and names the table shape verbatim.
- **The validator** is told which case each row claims and which ids the kernel already checked, and judges
  only what a reader can: whether a `reference` row's cited record really covers the claim, whether a `new`
  record restates a decided one in other words, whether a `conflict` decision states both sides, the
  consequences, the options and one recommendation.

The intake never edits another feature's record. The 5.1 rule that let an intake report a change to A as
`sds-gap` is withdrawn in the contract and in the validator rule: a change to what A decided is either a
conflict (the owner's) or new work that A hands to C (declared).

`workflow-goal --reintake <feature>` runs the same intake over drafts the tree already holds
(`intake-planned {mode: reconcile}`), which is how a feature authored before 5-plus is brought under the
three cases (the first proof in §11).

`workflow-goal --migrate <feature,...|all>` is the migration of a whole tree to this model: one intake per
feature in migrate mode, no node executed, allowlists that never meet (the module record, `business/**`,
`architecture/**`, `integration/**`), so every feature migrates at once on its own runtime slot. It adds what
5-plus makes explicit - the typed reconciliation, the integrations with their credential custody, the
integration nodes the tree then owes - and re-decides nothing: a decided record keeps its state, its rev
and its wording, and a contradiction is a `conflict` row and a decision record. Two things make that
possible: the `work.migrate` sequence (declare, never rewrite a draft, never set a record to todo), and the
validator digest, which leaves `extensions.work3.reconciliation` and `extensions.work3.integrations` out
of a record semantic inputs - they are the kernel reading of the record relations, not what it decided -
so declaring them on a decided module record stales none of the completions beneath it.

The same principle reaches the owner's list itself. A rule that turns a bound into an escalation applies to
what an older rule already parked: on kernel start, once per rule, `rejudgeParked` judges every parked item
again and routes it where the current rule routes it - a parked review is escalated, a deep shared change
is authored as a node, a refused record path is refused and its code paths carry on, a spent launch cools
and comes back, a requester blocked behind an alive shared change waits for it. What is genuinely the
owner's - a provision, an irreversible effect, a decision - stays (`parked-rejudged`).

## 4b. The record is revised, not asked about

An SRS or an SDS that is confusing, contradictory or silent is not a reason to stop. The owner ruled it on
2026-09-14 and the runtime uses that path for **ordinary reversible technical ambiguity**: it records the most
reasonable reading, states why, bumps the `rev` and moves on. A reading that changes an observable product
policy about **money, authority or customer data** is not the runtime's to infer. It prepares a canonical
question, distinct typed outcomes and one recommendation, then preserves an unresolved owner dependency until
an exact answer/receipt selects one. Settled legacy receipts remain history; malformed legacy topic receipts
are withdrawn rather than replayed as policy.

There are two repair kinds, one per record, and they are mirrors of each other:

| blocker | the record it is about | the kind that repairs it | origin | limit | then |
| --- | --- | --- | --- | --- | --- |
| `srs-gap` | the requirement does not settle the case, or settles it twice in two ways | `business.revise` (operator `business.decide`) | `business` | 2 | reopen |
| `sds-gap` | the design does not say how | `architecture.revise` (operator `architecture.decide`) | `architecture` | 2 | reopen |

Neither belongs to a lane: nothing schedules them, a report creates them. The kernel reopens the node that
**owns** the record - never the operation that tripped over it - creates the repair on that node's own file
and the record folder around it, and puts the requester behind it (`kernel/kernel.mjs`, `reopenRecordOwner`,
events `srs-gap` / `sds-gap`). Accepting the repair settles the node as a decision with a bumped `rev`
(`kernel/sync.mjs`, `recordDone`), so a reopened record is never read as the first one. A kind may only
report a gap in a record it actually **reads** - which is why `frontend.implement` gained `srs` in its
`reads` when `srs-gap` was added to what it may raise.

Both repair sequences are the same eight steps (`kernel/contract.mjs`, one `REVISE` builder):

1. read the gap and the passage it names;
2. state the two or three readings that passage actually admits - a passage that admits exactly one reading
   is not a gap, and a gap that belongs to the other layer is `blocked` back to it;
3. choose the most reasonable reading, from the accepted records of this feature, the decided records of the
   **other** features and the product's own conventions - **unless** the readings differ in an observable
   outcome about money, authority or customer data, and then report `ask` with `question.kind: decision`,
   one numbered option per reading and one recommendation;
4. write it into the record with the acceptance an implementer derives code from;
5. bump the `rev` and append **exactly one** `extensions.work3.decisionLog` entry
   `{rev, at, gap, chosen, why, alternatives}`, rewriting and deleting nothing;
6. run the validator; 7. self-audit; 8. report `done` with the rev and the entry.

That is the only thing either sequence may ever `ask` about. The validator holds the other end: a changed
record with no log entry is a defect, and so is a money/authority/customer-data reading taken with no
decision record (`models/functions.mjs`, VALIDATOR_RULES).

The same split runs one phase earlier, on the goal. The critic marks each `hidden-decision` objection
`decisive` or not. A non-decisive one becomes **nothing**: the repair will settle it when an operation hits
it. A decisive one becomes one `decision.prepare` (or `provision.ask` for a provision) of kind `decision`, planned before every operation that touches
its feature (`kernel/goal.mjs`, `planCritiqueDecisions`, event `decision-planned`), so the owner is asked
before the work rather than after it.

### The whole product is read for what the owner must provide

The runtime thinks about the whole product up front instead of discovering each missing thing when an
operation gets stuck. The critic answers `provisions`: everything only the **owner** can provide for the
proofs of this goal to be real - a credential or token, a sandbox or test account on an external system (a
payment gateway, a bank, e-invoice, tax, SMS or email, identity, storage), a real dataset or sample
(transaction statements, invoices), or the legal and consent authority to act for real (messaging real
users, charging real cards). It names every one the goal's scope **implies** from the decided records, not
only what the job text says: an accounting feature that settles transactions implies the gateway sandbox and
the statement samples even when nobody wrote that down.

They are `state.provisions`, rendered on the goal page under `### The owner provides` and printed by
`workflow-status` as `## The owner provides (n)` with each one `open`, `asked` or `provided`. Nothing waits
on that list: the operation that needs one asks for it in its own tab at the moment it needs it, with the
exact name, and every other operation carries on.

## 5. The owner loop

The owner is asked for what the runtime cannot obtain, for irreversible effects, and for decisive product
policy about money, authority or customer data. Ordinary reversible technical ambiguity may use a recorded
recommendation; it cannot replace an exact owner receipt for those reserved decisions. Before this split, a workflow could sit blocked all day on a line the owner
could not act on - "decide whether the last findings stand", "no runtime could launch op-3" - while the one
question that really was theirs waited in the same list.

`kernel/owner.mjs` owns the whole loop. Three things decide what happens to a question, and they are a closed
set.

### The two stop reasons

A question stops the op that asked it - `paused`, `waitingFor` the ask op - for exactly two reasons.

**Something only the owner can provide.** `ownerProvisionNeed(detail)` answers
`{kind: credential | account | dataset | authority}` or `null`. A credential is one member of that class, not
the class: an accounting product needs a **sandbox account** on the tax authority or the e-invoice provider,
a **real dataset** to reconcile against (a bank statement export, a sample of production invoices), and the
owner's **authority** to act (may we message these users, may we charge this card) exactly as a chat product
needs a bot token. Every one of them is as unobtainable by a runtime as a key is, and a proof taken without
one is not a proof. The rules are regexes over the sentence and carry no vendor name.

**An effect nobody can undo.** `irreversibleEffect(detail)` is true of a message or notification that reaches
real customers or users, a payment / charge / transfer / refund of real money, a deletion / drop / purge of
production or customer data, and a publish / deploy / release to production. The runtime prepares those and
stops; only the owner performs them, because *undo* is not one of the runtime's verbs.

`stopReasonFor(question)` reads the sentence first and an unambiguously declared kind second. `authority`
alone is never a stop, because it is also the kernel's own generic blocker kind - the words decide.

### Prepared decisions

An unsettled decisive product-policy question opens `decision.prepare`; a provision opens `provision.ask`.
The decision op writes one canonical question, at least two distinct typed outcomes and one recommendation.
The requester remains non-actionable while the draft is unprepared/running or while no exact accepted owner
answer/receipt selects an outcome. A recommendation is preparation, not authority.

`workflow-answer --id <wf> --op <ask> --choice <n> [--note "..."]` accepts only an exact prepared choice and
records the correlated owner receipt. Invalid or stale preparation hides legacy fallback/options and rejects
answer actions. A settled valid legacy receipt remains settled; similarly worded topic IDs or authority text
do not match by substring.

An exact answer settles the prepared decision:

| the owner's choice | what happens |
| --- | --- |
| any exact prepared choice, including the recommendation | record the correlated owner receipt; only then may dependent decisive-policy work become actionable |
| a later different authorized choice | preserve the earlier receipt as history and reopen only affected work through the current dependency bindings |

An irreversible ask keeps its authority boundary and paused requester until the owner answers. A credential
uses the researched workflow input surface described below and resumes through canonical custody checks.

### The owner answers in the op

The owner is at a keyboard, in front of the op's own tab; making them leave it to type a command is how a
one-word answer waited a day. So after writing the decision record the ask op prints the question and the
numbered options **in its own terminal** and says *the owner may answer here with the number, or later with
`workflow-answer`*. If the owner answers there first, the op reports `answered-by-owner: <n>`, which
`settleOwnerAsk` handles exactly as `--choice n` (`owner-answered {via: 'terminal'}`). The tab does not
close with the report: a `decision.prepare` tab that reported `decision:` is kept (`ask-tab-kept`) until the
owner answers or the workflow finishes, and the op stays in it - a number typed there after the report is
relayed by the op through `workflow-answer` itself. The report closed the tab once, and the owner opened
six tabs and found the question in none of them.

A provision is never asked for as a value. For an account, a dataset or an authority the op asks in its tab and
reports `provided: <what>` once the owner replies. **A credential is not asked in a tab at all**: a question for
the owner has to be a question, and an agent printing a command for them to compose was not one. The kernel
never launches that ask (`provision-fill-waiting`). Orca receives one workflow-owned form with researched
instructions and hidden fields; headless hosts retain `starci identity fill <slug> --name <VAR> ...` with
echo off. Each value goes through canonical `identity set` stdin into encrypted custody. The kernel settles
the ask through its platform-aware presence verifier (`credential-present`, `provision-filled`); an explicit
invalid/expired replacement also requires a new canonical write for that exact variable. Saved presence
permits a new provider verification attempt and proves no provider validity. No value reaches a plaintext
file, an event or a report, and
`redactSecrets` masks anything key-shaped on the way through.

Which of the two ops opened is a guess made from the sentence before anything was read, so it is a hint about
the tab and never a ruling: the kernel accepts an ask by what the report says, so a `provision.ask` that found
a design decision reports `decision: <id>` and its stop is lifted. A `decision.prepare` that found a credential
returns the exact requirement to the kernel's researched input flow instead of asking for its value.

The one environment variable the custody itself needs is `SOPS_AGE_KEY_FILE`: the kernel and the CLI name the
host's `~/.starci/master.identity` themselves when nothing names a key file (`sopsEnv`), and every contract
that runs `sops exec-env` tells the op to do the same - a presence check that could not open the custody once
reported a credential the owner had just filled as absent.

### Custody: a credential is never an environment variable

An environment variable is nobody's: it belongs to whichever terminal exported it, it is gone on the next
machine, and the tree cannot say who set it or when. A credential lives in an **encrypted identity resource of
the Work tree**:

```
.starciwork/_resources/identity/<slug>/resource.yaml   # work/resource@1, kind identity - alias, the subject
                                                       # on the provider, the role, the variable NAMES
.starciwork/_resources/identity/<slug>/secrets.enc.yaml # sops, under the host's own age or GPG key
```

The integration declaration names it (`credential: {name, providedBy: owner, custody: identity:<slug>}`;
`custody` is required and the 5.1 `where` is read only as the deprecation `credential-custody-missing`), the
owner fills it with

```
node <skill root>/bin/starci.mjs identity set <slug> --name <VAR>   # the value on stdin, never an argument
```

which never echoes it, and every operation that needs it runs its check **inside** `sops exec-env`, so the
value exists in one process and is copied nowhere. A missing sops, a key this host does not have, or a custody
without that variable is `blocked` `environment` naming the slug and the variable - which is the stop of §5.

### A mechanical bound never becomes a question

A bound the runtime set for itself is not a decision anyone can take from a terminal, so it escalates inside
the runtime instead.

| bound | what happens now |
| --- | --- |
| `verify-exhausted` (review rounds spent) | one more repair round on the strongest implement runtime that has not worked the group (`verify-escalated {group, round, runtime}`), and the round it buys includes the review that judges it; when the last findings cite no decided record the rule they argue about is a **hidden decision** (`verify-hidden-decision`) and the repair waits for a provisional ruling. Escalations are capped at `VERIFY_ROUNDS * 2` per group per day; past that the group is parked (`verify-parked`) |
| `shared-depth` | a shared change too deep to delegate, whose paths are inside this repository, becomes one Work node authored by a `work.author` op the kernel creates (`shared-authored {node, paths}`) and scheduled like any other node. Only paths outside the repository stay refused |
| `ledger-path` | an op that asked for record paths AND code paths is split: the record paths are refused with one event (`ledger-path-refused {paths, continued}`) and the code paths continue as the scoped shared op. Record paths alone are refused in the op's own terminal, and never as a `needUser` item |
| launch exhaustion (`chain-exhausted`, the restart limit for `stalled-idle`) | the op cools for `RATE_LIMIT_COOLDOWN_MS` and is re-admitted (`launch-cooling`, `launch-readmitted`), capped at `LAUNCH_DAILY_CAP = 6` re-admissions per op per day; past the cap it is an `environment` item, not a decision |

And `needUser` itself is deduplicated by `(kind, op|node, first 120 characters of detail)` every iteration
(`need-user-deduplicated`), because a kernel that runs for a day used to push the same line every tick.

### The three seams, unchanged

1. **Open.** A report `ask` whose `question.kind` is not mechanical
   (`MECHANICAL_QUESTION = /^(mechanical|runtime|retry|format|tooling)$/i`), or a `blocked`
   `environment`/`authority` the rules above recognise, opens one `decision.prepare` (or `provision.ask` for a provision) op with the question, the
   requester, the feature's own **policy-decision** folder as its allowlist (`decisionAllowlistFor`, read from
   the node's path in the tree, never from the id segment) and an existing policy decision of the tree as a
   reference to mirror. A second op asking the same question joins the existing ask as another requester. A
   reconciliation conflict (§4) opens the same question without an op, because the intake already wrote the
   decision record.
2. **Prepare.** The ask op answers from a decided record (`answered-from: <record id>`,
   `owner-ask-answered-from-record`) or writes the one decision record draft.
3. **Answer.** Through the op's own terminal, or through `workflow-answer` and the kernel's inbox. The
   supervisor model's `decide` still answers only `question.kind: mechanical`, and only from the closed option
   set the kernel offered it. If it cannot answer safely, it remains unresolved; decisive product policy is
   never converted into an inferred provisional answer.

What the owner will have to provide is not discovered one stuck operation at a time. The critic reads the
whole product for it up front and answers `provisions` - credentials, sandbox or test accounts on external
systems, real datasets, legal and consent authority - which the goal page lists under `### The owner
provides` and `workflow-status` prints with each one `open`, `asked` or `provided` (§4b). That list waits
for nothing: it tells the owner what is coming, and the operation that needs one opens the question in its
own tab at the moment it needs it.

## 6. The host model

A host is three facts and no more: a name, what it offers beyond a worktree and a runtime, and whether it
runs operations in parallel. `model/hosts.yaml` (`starci/hosts@1`) declares them and `hosts/index.mjs` is the
only code that loads it (`loadHosts`, `hostDescriptor`, `validateHosts`, `assertHosts`).

| host | capabilities | sequential |
| --- | --- | --- |
| `orca` | `design-tool` | no |
| `headless` | - (deliberately empty) | yes |

The emptiness of the headless list is the contract that makes `host-unsupported` mechanical instead of a
judgement. `hosts/orca/calls.mjs` and `hosts/headless/host.mjs` ask the profile for their own descriptor and
carry the shipped values only as `BUILT_IN_HOSTS`, the fallback for a tree whose `.dist` is not built yet - a
host must be able to describe itself before a build exists, and `tests/hosts.spec.mjs` asserts the fallback
and the profile say the same thing so the duplication cannot become a disagreement. `validateHosts` checks
every offered capability against the `capabilities` vocabulary of `model/kinds.yaml` - the same vocabulary a
kind's `needs` is drawn from - because a capability nobody can ask for is a promise a host silently fails to
keep.

A kind lists what it `needs` (`interface.asset` needs `design-tool`); an op whose kind needs what the host
lacks is refused at schedule time as `host-unsupported` and re-admitted by an approval from a host that has
it. The lane (one workflow, one worktree, merge-back on done) is the Orca host's; the headless host answers
`--lane` with a plain git worktree. Everything else - guards, validator, review rounds, dynamic budget,
critique, the one human gate - is host-independent. [workflow-chat.md](workflow-chat.md) is the chat's
instruction.

## 7. Image-first direction, then render truth

`interface.draw` uses built-in `image_gen.imagegen` for a small representative critical-screen set, retaining
each exact prompt and actual tool/input provenance. Its complete coverage/component/state map derives every
remaining screen and state from accepted business/SDS, brand, relevant UI knowledge and actual inspected Grammar
anatomy. The tool's model selection is not exposed and is never guessed.

These images are direction, not exact component/render/API proof. `frontend.implement` must produce actual Grammar
implementation captures plus matching markup under its implementation node's `assets/` and machine checks, then
`uat.verify` observes the identified running build in a browser. `checks/render.mjs` audits those implementation
captures and, for legacy UI-declared captures, structurally distinguishes them from assets carrying a `generation`
record; its kernel
hook returns null for ImageGen direction assets rather than reporting them green.

| rule | knowledge | checks |
| --- | --- | --- |
| A list of entities is a page section with a heading, never wrapped in a card; a card is one item. | `knowledge/ui/composition/collection.yaml` (`COLLECTION-1`, `COLLECTION-2`) | `entity-list-in-card` |
| The render's dominant colours are the brand's own tokens, its primary is present, and the mascot appears where the brand names a slot. | `knowledge/ui/proof/brand.yaml` (`BRAND-1`, `BRAND-2`, `BRAND-3`) | `palette-off-brand`, `primary-absent`, `mascot-slot-missing` |

The four check ids are the closed list `CHECK_IDS`. The thresholds are named constants, and each one is a
statement about what a capture is:

- `PALETTE_TOLERANCE` = `TOKEN_TOLERANCE` × 12 = **deltaE 6** on the brand module's x100 OKLab scale. A
  capture is not a stylesheet: the same token arrives antialiased, blended over a surface, dithered by the
  browser's compositing and quantised again by the bucket mean. Six - about three just-noticeable
  differences - is wide enough for a token painted at ninety percent over a light surface and narrow enough
  that a different hue stays a different hue.
- `MIN_BUCKET_SHARE` = **2%** of the saturated pixels. Below that is the fringe of an antialiased glyph, not
  a filled button, a chart series or a banner.
- `MIN_REPEATED_ITEMS` = **3**. Two rows are a pair the reader reads as two facts; three are a collection.
- `CHROMA_FLOOR` 0.04 and lightness 0.12-0.95 drop the page's greys, its paper and its ink before any
  bucketing: the brand's palette question is about colour, not about ink.

The PNG decoder is implemented in the module on `node:zlib` (signature, IHDR, concatenated IDAT, the five
scanline filters, 8-bit greyscale, greyscale+alpha, RGB and RGBA, non-interlaced), so a drawing is never
checked by a dependency that may not be installed. A palette image, a 16-bit image or an interlaced one
throws `unsupported png: <why>` and is recorded as a `skip`, never as colours the file does not have.

**A check that cannot run is `skip` with the reason, never `pass`**: no markup kept beside a capture, a PNG
the decoder does not read, a record that declares no capture, a brand that names no mascot, a surface the
brand does not allow the mascot on. A `skip` never makes a run `ok: false` and never makes it green either.
When the whole run cannot start - a tree with no brand record, a node with no `ui:` spec - the kernel hook
returns the single skip `render-checks-unavailable` with the reason: a broken input is one unproven claim,
never a failed drawing and never a passing one. `renderChecksFor` answers **null**, not a green result, for
an operation that wrote no design record at all, so an operation with nothing to do with a drawing is never
reported as a drawing that passed.

## 8. An external integration is proven live, or it is not proven

On 2026-09-13 four `e2e.verify` operations of one product reported four chatbot delivery nodes verified
without ever asking the owner for the Telegram or Zalo credential. Nothing was wrong with the operations:
`e2e.verify` proves the API against the database and forbids a fake only of "the unit under proof", so a
faked channel was within its contract; the credential rule is prose that forbids inventing a key, and a fake
invents none; and the four completions were bound to their records, not to the rules they were proven under,
so a rule that arrived later reopened nothing. Three defects of the model, three rules:

**An integration is a record.** A business or design record that names an external system declares it as
data under `extensions.work3.integrations[]`: `{id, provider, credential: {name, providedBy: owner, custody},
sandbox?}` - the intake side "external integrations and credentials" is written as this list, not as prose.
`declaredIntegrations(ledger)` reads every `business`, `business-overview`, `module` and `architecture` node
and answers **`{list, problems}`**: each listed entry carries `declaredBy`, the record that declared it, and
`problems` is what the runtime cannot act on - `credential-missing` (no variable to ask the owner for),
`credential-not-owner` (somebody other than the owner is supposed to provide the key),
`credential-custody-missing` (no `custody: identity:<slug>`, or the retired 5.1 `where`, which named a place
rather than a custody) and `integration-shape` (no id, no provider, or not a list at all). They are findings
rather than silent skips, because a vague declaration is exactly what a faked proof hides behind; an entry
with an id is still listed even when its credential is a finding, so the tree still owes it a node.

`integration` is a record kind (§2), one `integration` node per declared id is required at
`features/<f>/integration/<id>/index.yaml` (`missingIntegrationNodes` lists the ids with none, which the
kernel reports as `ledger incomplete` and closes with `work.author`), and that node walks the one-step lane
`integration.verify`: a prove kind that reads `integration`, `sds` and `code`, writes `evidence`, and runs the
live scenario **inside the custody** - `sops exec-env <slug>/secrets.enc.yaml '<check>'`, so the credential
exists in one process and is copied into no file, log, report or contract. No sops, no key for this tree, or a
custody without that variable is `blocked` `environment` naming the slug and the variable and nothing else -
which is the stop of §5. A fake, stub, mock, recorded response, local double or skipped scenario standing in
for the declared provider is the defect the kind exists to catch, and the validator rejects it; so is a
credential read from anywhere but its custody, and a credential value written anywhere at all.

**Evidence says what it proved against.** Every evidence manifest may carry `proof: {boundary: api | live,
fakes: [provider ids]}`; `boundary` is required once a proof is given at all and `fakes` defaults to the
empty list. `e2e.verify` writes `boundary: api` and names every provider it faked; `integration.verify`
writes `boundary: live` and may name none. `integrationProofStatus(ledger)` turns that into the one answer a
status view prints, per declared integration:

| `proven` | when | `workflow-status` prints |
| --- | --- | --- |
| `live` | a passing manifest on its own integration node carries `boundary: live` | proven live |
| `fake` | it appears only in some other run's `proof.fakes` | proven against a fake, not live |
| `none` | nothing proved it, or the only live run failed | not proven |

There is no fourth state, and a failed live run is `none` rather than `live`: it ran, it did not prove.
`workflow-status` prints one line per declared integration under **`## Integrations (n)`**, reading the tree
through the bounded `readLedgerTree` so a status view never spawns the validator; a workflow that names no
tree leaves the section out rather than guessing.

**A proof remembers the rules it was proven under.** `markDone` writes
`extensions.work3.kernel.contractDigest` **and `contractKind`** - the digest of everything a proof of that
kind rests on (`contractDigestOf({kind, kindRecord, operator, rules})`: the `model/kinds.yaml` entry, the
operator contract it launched through and `VALIDATOR_RULES`, in a canonical form with stable key order at
every depth), and the name of the operation kind the digest was taken for. The ledger sync compares it on
every read (`reopenStaleProofs`): a node whose stored digest is not the current one is reopened
(`proof-under-old-rule`, through `markReopened`) so its lane runs again under the rule that holds now.

Two details of that comparison are the shipped behaviour and both matter. **The reopen compares by the
recorded kind**: `contractKind` is what the digest was taken for, so the stored digest and the current one
are computed for the same declaration. Only when a node carries no `contractKind` - a block an older build
wrote - does the kernel fall back to the last step of the node's lane, and then to the node kind for a node
with no lane. And **a node that stores no digest at all is left alone on purpose**: reopening every proof
written before the digest existed would be a whole product's work the owner never asked for, so those are
reopened only when the owner asks. `staleProofs(ledger,{digestOf,kindOf})` is the same question asked of a
tree rather than of a run, and it considers only nodes the kernel itself completed (their kernel block names
an `opId`), so a decided record settled by review is never dragged in.

## 8b. Heavy work is cut and fanned out

> "Heavy work runs in parallel: a big node is cut by a planning operation into many small nodes with disjoint
> write scopes, the seam that everyone shares (module wiring, migrations, contracts) is built first and alone,
> then the rest fan out — eight or nine builds at once on ten slots — and the proof (API end-to-end, review)
> runs once for the whole group, on another runtime, not once per piece. The implementer runs its own
> end-to-end suite as a check; it never grades itself." — the owner, 2026-09-14

A node the tree already holds can be bigger than one operation, and the kernel says so from the record rather
than from an opinion. Three measures, applied identically in the goal phase and in the run (`cutReason` in
`kernel/sync.mjs`): a write scope naming more than **`CUT_FILES` = 12** files, more than **`CUT_ASSERTIONS` =
8** assertions, or `refs`/`dependsOn` naming SDS records that carry **`CUT_COMPONENTS` = 3** or more
components. One of them over its bound and the node is planned as one **`implementation.plan`** operation
before its lane and instead of its first step (`cut-planned`), once per node — so what the owner approves reads
`1 implementation.plan -> seam -> N backend.implement -> 1 e2e.verify -> 1 review.verify` rather than one long
slice nobody can parallelise.

`implementation.plan` is a kind of its own carrying the `work.author` operator contract under the `work.cut`
sequence, so there is no second operator and no second registry entry. It writes records and builds nothing.
Its order is the point: the **seam** is named first — the one child that owns the module wiring, the DI
registration, the migrations and the shared contracts and types every other child would otherwise touch (on the
frontend: the app shell and routing, the theme and grammar version, the shared store, the API client) — and it
is built first and alone, because two builds that both edit the module wiring are not parallel work, they are
one merge conflict with two authors. The rest is cut by acceptance: one observable behaviour per child, at most
12 files, disjoint from every sibling and from the seam, one runnable check per assertion, every assertion
traced to the same SRS/SDS ids the parent traced to, and every non-seam child `dependsOn` the seam. The node
itself becomes a **derived parent** — no `state`, no `completion`, no write scope — keeping its assertions as
the group's acceptance under `extensions.work3.groupAssertions`, which is why removing `state` there is the
cut's job rather than a forgery and only `completion` stays the kernel's inside that record. A node that really
is one behaviour reports `done` with `cut: none` and the kernel runs it exactly as it is.

Afterwards the tree is re-read: the children are the schedulable nodes (`cut-authored {node, children, seam}`),
the parent is no candidate at all, and each child is **ordinary build work** — `backend.implement` or
`frontend.implement` with a small allowlist, never a new kind. `allocation.fanOut {seamFirst: true,
maxPerGroup: 9}` in `model/runtimes.yaml` keeps the seam alone in its group and bounds one parent to nine of
the ten slots. And the proof is the group's, once: `e2e.verify` then `review.verify` are planned for the parent
when every child's build step is accepted, on a runtime none of the children used, judged against the parent's
group acceptance; a frontend group gets one `uat.verify` at the parent — every flow walked on the rendered
surface — and no review. Accepting that proof records one `lane-step` for every child, so no child ever proves
itself. Findings come back to where they live: `childOwning(file)` maps a finding to the child whose write
scope holds it, and a finding that names one child repairs that child alone.

The bounds, the child shape and the `ui`-node case this build does not yet cover are in
[op-granularity.md](op-granularity.md) §1 and §4.

## 9. The tree

One concept, one folder, a name that says what it holds:

| folder | holds | was |
| --- | --- | --- |
| `model/` | the declared data the runtime runs on: `records.yaml`, `kinds.yaml`, `hosts.yaml`, `runtimes.yaml`, `registry.yaml`, the provider profiles; no code | `profiles/` |
| `ops/` | one folder per operation kind, `operator.yaml` with its reads, writes, steps, proofs and blockers, plus the generator and `validate.mjs` | unchanged |
| `kernel/` | the control loop by concern: `kernel.mjs` (loop, phases, CLI seams), `common.mjs` (what every concern shares), `goal.mjs`, `intake.mjs`, `owner.mjs`, `io.mjs`, `reconciliation.mjs`, `graph.mjs`, `ledger.mjs`, `sync.mjs`, `routing.mjs`, `contract.mjs`, `schedule.mjs`, `budget.mjs`, `loads.mjs`, `lanes.mjs`, `chains.mjs`, `terminals.mjs`, `verify.mjs`, `guards.mjs`, `store.mjs`, `view.mjs`, `reports.mjs`, `supervisor.mjs` | `execution/workflow-kernel.mjs` and its satellites |
| `hosts/` | `index.mjs` (the host model as data) and the two adapters `orca/` and `headless/`, behind one `invoke` surface | `execution/orca-*.mjs` |
| `models/` | the model functions and the headless providers (`functions.mjs`) | `execution/llm-functions.mjs` |
| `checks/` | machine checks over bytes: `brand.mjs`, `render.mjs`, `proof.mjs` | `execution/brand-checks.mjs`, `execution/verify-proof.mjs` |
| `tests/` | the regression suite, one spec per concern; every rule in this document names its test in §12 | unchanged |
| `bin/starci.mjs` | the one command line: `workflow-*` forwarded to the launcher, `render check` / `brand check` and every CLI command | `.dist/execution/orca-supervised-launch.mjs` |

Left where they are, because their names already say what they hold: `workflows/` and `approvals/` (the Plan
route and its job catalog), `providers/` (the provider contracts), `core/`, `schemas/`, `specifications/`,
`contracts/` (the Work tree contract and its validator), `knowledge/`, `cli/`, `scripts/`, `upgrades/` (the
per-version operator notes), `docs/`, and `execution/` (the 4.x Plan-route execution modes only). `.dist`
mirrors the source tree.

## 10. What changed from 5.1, and why

| 5.1 | 5-plus |
| --- | --- |
| `mutates: [...]` per kind; `DESIGN_KINDS`, `DECISION_OPERATION`, `WORK_OPERATION` hard-coded in the kernel | `reads`/`writes` per kind over a record catalog; the kernel asks `kernel/io.mjs` |
| the intake reports a change to a decided record as `sds-gap` and the kernel edits it through `architecture.revise` | a change to a decided record is a `conflict` row put to the owner or a `new` row that declares what it hands on; the intake edits nothing outside its scope |
| the reconciliation table is prose the validator reads by feel | typed rows the kernel checks mechanically, then the validator judges what a reader can |
| the critic's rule is a formula | the critic answers `overlaps` with the cases it can see; the formula is in no contract and no prompt |
| `credentialNeed`, `openOwnerAsk`, `answerOwnerQuestion` inside the 318 KB kernel | `kernel/owner.mjs` |
| the goal critique, the intake and the ledger sync inside the kernel | `kernel/goal.mjs`, `kernel/intake.mjs`, `kernel/sync.mjs`, over `kernel/common.mjs` |
| the two host descriptors as frozen objects in two adapters | `model/hosts.yaml` read by `hosts/index.mjs`; the adapters keep them only as the pre-build fallback |
| an external system proven by whatever ran | a declared `integration` record, an `integration` node, a live proof, and evidence that says what it proved against |
| a completion bound to its record only | a completion bound to the declaration it was accepted under (`contractDigest`, `contractKind`) |
| brand rules in prose only | ImageGen directions carry prompt/tool provenance; actual implementation captures retain markup for named `COLLECTION-*`, `BRAND-*` checks |
| `profiles/`, `execution/` | `model/`, `kernel/`, `hosts/`, `models/`, `checks/` |
| `.dist/execution/orca-supervised-launch.mjs` on every command line | `node <skill>/bin/starci.mjs <command>` |
| the pre-release version tag | `5.0.0-plus` |

What is deliberately unchanged: the kernel's seams (`invoke`, `runHeadless`, the allocator, the kind graph),
the lane worktree and merge-back, the terminal rules (a tab exists only while its op runs, the coordinator
tab is re-bound or replaced, the kernel tab is released on pause), re-approve re-admits and avoided runtimes
expire, the inbox wake, the intake wording refresh, stray quarantine, the shared tree addressed both ways,
worktree trust before launch, the short pasted spec with the contract pointer. Every one of them keeps its
test.

## 11. The two proofs

**A reintake against decided records.** In a repository whose tree holds decided `srs`/`sds` records of
features A and B and drafts of a feature C:

```
node <skill>/bin/starci.mjs workflow-goal --host <skill> --job "<the owner's prompt for C>" --scope C --reintake C --lane
node <skill>/bin/starci.mjs workflow-approve --host <skill> --id <id>
node <skill>/bin/starci.mjs workflow-run --host <skill> --id <id>
node <skill>/bin/starci.mjs workflow-status --host <skill> --id <id>
node <skill>/bin/starci.mjs workflow-answer --host <skill> --id <id> --op <intake op id> --choice 2 --note "<the owner's words>"
```

The goal page carries the critique with `### Conflicts for the owner` when the critic finds one; after
approval the intake op runs (`intake-planned {mode: reconcile}`), its report is checked mechanically
(`reconciled {reference, conflict, new}`), every `conflict` row is listed for the owner as a `decision` item
(`reconciliation-conflict`) and answered with `workflow-answer` naming the intake op. `workflow-status` lists
that conflict under `## Needs you (n)`; the table itself is read from the feature's module record, because the
status page prints `## Reconciliation` (one line per intake: the counts the kernel checked and every conflict still open for the owner) beside `## Integrations`. The unit version of the proof is `tests/reconciliation.spec.mjs`
(the seven findings, one test each, plus "a full pass counts the three cases and hands the conflict to the
owner with its numbered options") and the kernel test **"an accepted intake settles by what the tree holds
under its scope and the workflow finishes done, asking nothing about a node called null"** in
`tests/workflow-kernel.spec.mjs`. The seam itself is held by `tests/kernel-seams.spec.mjs`.

**A drawing that passes the brand and section rules.** With a ui node drawn (PNG and markup under its
`assets/`) and a brand record in the tree:

```
node <skill>/bin/starci.mjs render check <repo>/.starciwork/features/<f>/ui --brand <repo>/.starciwork
```

prints one line per check (`palette-off-brand`, `primary-absent`, `entity-list-in-card`,
`mascot-slot-missing`) and exits non-zero on a failing one or a broken input; the kernel runs the same checks
on an accepted `interface.draw` report and downgrades a failing one (`render-check-failed`). The unit version
is `tests/render-checks.spec.mjs`, which decodes every PNG filter type, renders synthetic candidates in the
brand's palette and off it, and asserts that the kernel hook answers `null` for an operation that drew
nothing.

## 12. Where each rule is held

Every rule this document states, and the test that holds it. A rule with no test is named as such in the
last row group.

| rule | test |
| --- | --- |
| the record catalog is closed, validates, and compiles to what the kernel reads | `tests/io.spec.mjs` - "the record catalog is the closed list, validates, and compiles to what the kernel reads at run time" |
| a wrong record catalog is rejected with its named error | `tests/io.spec.mjs` - "a record catalog that is wrong is rejected with its named error, never silently repaired" |
| every path maps to the record kind the catalog says it is | `tests/io.spec.mjs` - "every path a workflow touches maps to the record kind the catalog says it is" |
| a file produced outside `writes` is a named finding before any model | `tests/io.spec.mjs` - "a file an operation produced that its kind never declared is a named finding, not a silent write"; `tests/kernel-seams.spec.mjs` - "a changed file whose record kind the op does not declare downgrades the report, with no model asked" |
| the contract prints `## Reads` / `## Produces` under the goal | `tests/io.spec.mjs` - "the contract prints the declaration under the goal, so an operation knows what it may cite and produce"; `tests/kernel-seams.spec.mjs` - "the contract prints what the kind reads and produces, under the goal and after the critique" |
| the validator is handed `io:{reads,writes}` and its rule | `tests/kernel-seams.spec.mjs` - "the validator is handed the declaration of the kind it judges" |
| the kernel asks the catalog instead of keeping its own sets | `tests/io.spec.mjs` - "the kernel asks the catalog instead of keeping its own sets of kinds" |
| every kind declares `reads`/`writes` over the one record catalog | `tests/kind-graph.spec.mjs` - "every kind declares what it reads and what it produces, over the one record catalog" |
| `unknown-record`, `writer-blind`, `lane-proof-blind`, `route-target-blind` | `tests/kind-graph.spec.mjs` - "a declaration the records catalog cannot support is rejected with its named error" |
| `IO_DRIFT`: an operator may not write a record its kind never declared | `tests/ops.spec.mjs` - "an operator cannot write a record its kind never declared" |
| `implementation.plan` is a kind carried by the `work.author` operator, named by no lane and created by no route | `tests/kind-graph.spec.mjs` - "the shipped catalog validates against the allocator profile and the operator catalog" |
| a node past the bounds gets a cut op before its lane; its children fan out behind the seam and are proven once at the parent | `tests/workflow-kernel.spec.mjs` - "a node too big for one operation gets a cut op before its lane, and its children fan out behind the seam" |
| a group proof's findings repair the child whose write scope holds the file | `tests/workflow-kernel.spec.mjs` - "a group proof that found something repairs the child whose write scope holds the file, not the whole group" |
| a node that is one behaviour reports `cut: none` and runs as it is | `tests/workflow-kernel.spec.mjs` - "a node the planning operation did not split reports cut: none and the kernel runs it as it is" |
| the fan-out cap and the seam rule come from `allocation.fanOut` | `tests/workflow-kernel.spec.mjs` - "the fan-out cap and the seam rule are read from the allocation profile, never guessed"; `tests/runtime-allocator.spec.mjs` - "fan-out is bounded per cut group: the seam runs alone and one parent never takes every slot" |
| the cut sequence names the seam first and states the bounds the kernel measured | `tests/contract-steps.spec.mjs` - "work.cut names the seam first, cuts the rest by acceptance into disjoint children, and leaves a derived parent" |
| the operator carries the cut mode without a second operator | `tests/ops.spec.mjs` - "the record-authoring operator carries the cut mode: it writes child nodes, names the seam and builds nothing" |
| a derived parent with children validates and keeps its assertions as `groupAssertions` | `tests/work-ledger.spec.mjs` - "a cut leaves a derived parent whose assertions are the group acceptance, and children the kernel can launch"; "a cut that left the parent its own state is refused: a branch may not author one" |
| the three cases are the closed set; the seven findings are the mechanical half | `tests/reconciliation.spec.mjs` - "the three cases are the closed set and the seven findings are the mechanical half of the rule" |
| `readReconciliation` reports the rows it cannot shape instead of throwing | `tests/reconciliation.spec.mjs` - "readReconciliation normalizes the rows it can shape and reports the ones it cannot, instead of throwing" |
| each of the seven findings | `tests/reconciliation.spec.mjs` - one test per finding, named after it |
| a first feature in an empty product needs no table | `tests/reconciliation.spec.mjs` - "a tree with no other decided records needs no table at all" |
| a valid table is counted and every conflict is the owner's question | `tests/reconciliation.spec.mjs` - "a full pass counts the three cases and hands the conflict to the owner with its numbered options"; `tests/kernel-seams.spec.mjs` - "a valid table is counted, and every conflict row is the owner's question - answered by workflow-answer" |
| a refused reconciliation comes back as findings and the intake runs again | `tests/kernel-seams.spec.mjs` - "a reconciliation the kernel refuses comes back as findings and the intake runs again" |
| a kernel given no reconciler behaves as before the rule | `tests/kernel-seams.spec.mjs` - "a kernel given no reconciler settles an intake exactly as it did before the rule existed" |
| an accepted intake settles by what the tree holds under its scope | `tests/workflow-kernel.spec.mjs` - "an accepted intake settles by what the tree holds under its scope and the workflow finishes done, asking nothing about a node called null" |
| an intake planned by an older build carries the current wording | `tests/workflow-kernel.spec.mjs` - "an intake op planned by an older build carries the current goal and acceptance after a sync, its allowlist untouched" |
| the intake contract is the three cases and edits no other feature | `tests/contract-steps.spec.mjs` - "work.intake determines every side, then reconciles it as three typed cases, and edits no other feature" |
| the validator is told what the kernel already checked | `tests/llm-functions.spec.mjs` - "the intake rule tells the validator what the kernel already checked and what only a reader can judge" |
| the critic answers the overlaps as the cases, and the formula is gone | `tests/llm-functions.spec.mjs` - "the critic answers the overlaps with the decided records as the three cases, and the formula is gone" |
| the Work schema documents the reconciliation row | `tests/reconciliation.spec.mjs` - "the Work schema documents the reconciliation row and leaves extensions free-form" |
| a non-mechanical question opens an `decision.prepare` (or `provision.ask` for a provision); a mechanical one stays with the kernel | `tests/workflow-kernel.spec.mjs` - "a question only the owner can answer pauses the op and opens an decision.prepare op; the drafted decision is listed, the answer is delivered, and a mechanical question stays with the kernel" |
| a credential the environment lacks is the owner's question, and so is an effect nobody can undo; an `authority` block that names neither still needs classification as ordinary technical ambiguity or decisive policy | workflow-kernel and owner-request regressions |
| the owner is asked only for what the runtime cannot obtain and cannot undo, over product-agnostic sentences | `tests/kernel-seams.spec.mjs` - "the runtime asks the owner only for what it cannot obtain and for what it cannot undo" |
| decisive product policy stays non-actionable until an exact owner choice/receipt | owner-request decision option and actionability regressions |
| invalid or stale preparation rejects answers without replaying a legacy fallback | owner-request decision option and legacy receipt regressions |
| a settled valid legacy receipt remains historical proof | owner-request legacy receipt regressions |
| the owner answers in the op's own terminal, and a credential reports only presence | `tests/kernel-seams.spec.mjs` - "the owner answers in the op's own terminal, and a credential reports only that it is present"; `tests/contract-steps.spec.mjs` - "the decision.prepare sequence asks in its own terminal, and a credential is put into custody by the owner, never handed over"; `tests/ops.spec.mjs` - "the decision.prepare operator asks in its own terminal and never asks for a credential value" |
| a credential lives in the tree's encrypted custody, filled from stdin alone and echoed nowhere | `tests/cli.spec.mjs` - "identity set puts a value into the tree's encrypted custody from stdin alone, and echoes it nowhere", "identity set refuses with the exact reason when sops or its key is not there, and writes nothing" |
| a spent review bound escalates inside the runtime; a resulting decisive policy gap still waits for its owner | workflow-kernel and owner-request regressions |
| a shared change too deep becomes one Work node, never a question | `tests/workflow-kernel.spec.mjs` - "a shared change too deep to delegate again becomes one Work node the kernel authors, not a question for the owner" |
| a record path an op asked for is refused in its terminal; a mixed request is split | `tests/workflow-kernel.spec.mjs` - "a shared change must name its paths...", "a shared change that asks for record paths and code paths is split: the record paths are refused, the code paths continue" |
| a spent launch bound cools and is re-admitted, capped per day | `tests/workflow-kernel.spec.mjs` - "a spent launch bound cools the op and re-admits it, and only the daily cap reaches the owner" |
| the owner's list carries one item per question | `tests/kernel-seams.spec.mjs` - "the owner's list carries one item per question, not one per iteration" |
| `workflow-status` keeps unresolved owner decisions actionable and correlated | workflow-view and owner-request regressions |
| the decision record lands in the feature folder the tree has, never the id segment | `tests/workflow-kernel.spec.mjs` - "the decision folder of an owner question comes from the feature folder in the tree, never from the id segment" |
| the host profile validates against the kinds capability vocabulary | `tests/hosts.spec.mjs` - "the shipped host profile validates against the real kinds capability vocabulary" |
| each adapter describes itself exactly as the profile declares it | `tests/hosts.spec.mjs` - "each adapter describes itself exactly as the profile declares it" |
| a bad host profile is rejected by code | `tests/hosts.spec.mjs` - "the authored profile is loaded from its directory and a bad profile is rejected by code" |
| a kind may need a host capability; a host that lacks it refuses the op | `tests/kind-graph.spec.mjs` - "a kind may need a host capability from the closed vocabulary: the drawing needs the design tool and every other kind runs on any host"; `tests/workflow-kernel.spec.mjs` - "an interface.asset op on a host without the design tool is host-unsupported..." |
| the PNG decoder, the dominant colours, the palette and the primary | `tests/render-checks.spec.mjs` - "the decoder returns the exact pixels for every filter type...", "the dominant colours of a capture are its saturated pixels, bucketed in OKLab", "the palette of a capture is the brand tokens, and the primary has to be in it" |
| a list of entities inside a card fails; one item in a card is a card | `tests/render-checks.spec.mjs` - "a list of entities inside a card fails, the same list in a section passes, and one item in a card is a card" |
| the mascot has a slot exactly where the brand allows it | `tests/render-checks.spec.mjs` - "the mascot has a slot exactly where the brand allows it" |
| a whole run reads every candidate, its markup and every surface | `tests/render-checks.spec.mjs` - "a run over a ui node reads every candidate, its markup and the mascot slots of every surface" |
| the hook answers null for generated direction or an operation with no browser capture | `tests/render-checks.spec.mjs` - ImageGen assets are excluded from exact render proof; `tests/kernel-seams.spec.mjs` - a kind outside the compatibility draw hook never reaches it |
| a failing canon check downgrades the drawing before the validator | `tests/kernel-seams.spec.mjs` - "a drawing that fails a canon check is downgraded before the validator; a passing one is recorded" |
| the CLI prints one line per check and exits 1 on a failure or a broken input | `tests/render-checks.spec.mjs` - "the CLI prints one line per check and exits 1 when a check fails or the input is broken" |
| a declared integration is data; a nameless entry, a credential nobody owns, or one with no custody is a finding | `tests/work-ledger.spec.mjs` - "a declared integration is data: a credential nobody owns or a nameless entry is a finding, not a silent skip" |
| the live proof reads its credential through `sops exec-env` from the declared custody, and never writes one | `tests/contract-steps.spec.mjs` - "an integration is proven live or it is not proven..."; `tests/ops.spec.mjs` - "the live integration operator proves through the real provider with the owner's own credential, and refuses without it"; `tests/llm-functions.spec.mjs` - "validateOp carries the rule that an integration is proven live or it is not proven" |
| every declared integration is live, fake or not proven - no fourth state | `tests/work-ledger.spec.mjs` - "every declared integration is proven live, proven against a fake, or not proven - and there is no fourth state" |
| `workflow-status` prints what each declared integration is proven by | `tests/workflow-view.spec.mjs` - "workflow-status prints one line per declared integration and what each is actually proven by" |
| a declared external integration walks a lane of its own | `tests/kind-graph.spec.mjs` - "a declared external integration is proven live on a lane of its own" |
| the live operator proves through the real provider with the owner's credential | `tests/ops.spec.mjs` - "the live integration operator proves through the real provider with the owner's own credential"; `tests/contract-steps.spec.mjs` - "an integration is proven live or it is not proven: the credential is the owner's, no fake stands in, and e2e names what it faked" |
| the validator carries the live-integration rule | `tests/llm-functions.spec.mjs` - "validateOp carries the rule that an integration is proven live or it is not proven" |
| `markDone` stores the digest and the kind the proof was bound to | `tests/work-ledger.spec.mjs` - "a proof remembers the rules it was taken under: markDone stores the contract digest and hands the proof to the evidence"; `tests/kernel-seams.spec.mjs` - "markDone stores the digest of the declaration the proof was accepted under" |
| the digest is the declaration in a stable order, and a moved rule reopens the proof | `tests/work-ledger.spec.mjs` - "the contract digest is the declaration itself, in a stable order, and a moved rule reopens the proof" |
| a stale proof is reopened; one that stores no digest is left alone | `tests/kernel-seams.spec.mjs` - "a done node proven under an older declaration is reopened; one that stores no digest is left alone" |
| the reopen compares by the recorded kind | `tests/kernel-seams.spec.mjs` - "a proof records the kind it was bound to, and a lane whose last step is optional is not reopened for that step" |
| a kernel given no digest function reopens nothing | `tests/kernel-seams.spec.mjs` - "a kernel given no digest function reopens nothing" |
| an accepted operation binds its proof to its kind's declaration | `tests/kernel-seams.spec.mjs` - "an accepted operation binds its proof to the declaration of its kind" |
| `bin/starci.mjs` is the one command line, forwarding argv unchanged | `tests/entry.spec.mjs` - "a workflow command on bin/starci.mjs is answered by the launcher, not by the CLI" |
| `--help` names the installer commands and the kernel commands | `tests/entry.spec.mjs` - "a launcher usage error is reported by the launcher and the CLI keeps its own commands" |
| the tree the installer ships, and its links | `tests/skills-tree.spec.mjs`, `tests/integration.spec.mjs` - "public runtime Markdown links resolve within the shipped payload" |
| `starci update` names the upgrade note of the version it installed | `tests/integration.spec.mjs` - "an update that changed the installed version names the upgrade note of what it installed" |

Two rules of this document are stated and **not** held by a test of their own, and are named here rather
than left to be discovered:

- **The owner's shorthand is not runtime content.** That it appears in no contract, no model function and no
  operator is a property of the source, held today only by this document and by review. What *is* tested is
  the rule itself: `tests/llm-functions.spec.mjs` asserts the critic answers the cases and no formula, and
  `tests/contract-steps.spec.mjs` asserts the intake contract is written as the three cases.
- **`recordReadsOf` includes the record's own kind.** The peer-citation rule is exercised indirectly by
  `new-reads-blind` in `tests/reconciliation.spec.mjs` (a `new` row citing a peer passes there), but no test
  asserts the inclusion itself, so a change that dropped it would fail only through that indirection.
- **The critic's `overlaps` travel to the page and the intake contract** - held by `tests/workflow-kernel.spec.mjs`
  "the overlaps the critic finds are the three cases: a conflict is listed for the owner on the goal page, a
  reference is a record to cite, and the intake contract carries both"; the status section by
  `tests/workflow-view.spec.mjs` "workflow-status prints the reconciliation of every intake".


### Integration preparation and workflow input

Every external API/service/SDK integration reads current official documentation before design, configuration
or credential choices. The owning declaration keeps actual source observations, read dates, authentication
and lifecycle constraints, applicable endpoint setup, an ordered owner/machine prerequisite plan and live
verification. Research completeness precedes dependent work; owner input additionally requires executable
machine preparation. Missing research is an owning-operation repair, not a secret question.

Orca credential forms are created and reconciled by the kernel's detached input helper, never by the observer
or an ask agent. They display researched human guidance, group duplicate fields, write only encrypted
custody and let the kernel resume satisfied requests. See `docs/workflow-kernel.md` for the lifecycle and
`tests/workflow-inputs.spec.mjs` for security, deduplication, restart and preparation regression coverage.
