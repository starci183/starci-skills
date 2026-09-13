# StarCi 5-plus: one flow, declared inputs and outputs, the owner decides

Status: the design of release `5.0.0-plus`. It consolidates the rulings of 2026-09-12 and 2026-09-13 (the
commits between `d8cc53d6` and `1a532973` on `v4/orchestration`) into one structure instead of the sequence
of patches they arrived as. Where this document and an older document disagree, this one is the runtime as
built; the older documents ([workflow-kernel.md](workflow-kernel.md), [kinds.md](kinds.md),
[model-functions.md](model-functions.md), [workflow-chat.md](workflow-chat.md)) describe the parts in detail
and were rewritten to match.

## 1. The model in one page

```text
Job (the owner's prompt, verbatim)
  └─ critique         the runtime challenges the prompt: sound | revise | refuse, prerequisites, overlaps
     └─ goal          ledger nodes (Work tree) or an assessed plan; intake ops for what the tree lacks
        └─ approval   the one human gate; refuse needs the owner's stated override
           └─ workflow   one kernel, one worktree (a lane), one host: Orca or headless
              ├─ op       one kind, one contract: what it READS, what it PRODUCES, its checks, its acceptance
              │  └─ record   every kind of record declares what it is derived from; the kernel matches the two
              ├─ owner question   a non-mechanical ask or a missing credential pauses the op: owner.ask
              ├─ reconciliation   a feature against decided records: reference | conflict | new, as data
              ├─ validator        the one validator, given the declared inputs and outputs, not a feeling
              └─ render checks    a drawing is the grammar rendered; canon rules are checked from the bytes
```

Seven statements hold the whole release together. Every section below is one of them made concrete.

1. **One workflow is one flow.** One Orca lane worktree per workflow, merged back on `done`; the same kernel
   runs in a plain Claude Code or Codex chat on the headless host (one chat, one workflow, sequential,
   `host-unsupported` for what a host cannot do); the supervisor and the kernels follow the build; the
   provider quota is probed, never guessed. (Rulings of 2026-09-13: `a6747ebe`, `6177c584`, `9e54cc8a`,
   `4cafb92b`.)
2. **Every owner prompt is critiqued before it is a goal.** The critique changes the plan: a prerequisite the
   tree lacks becomes the intake that runs first, an overlap with a decided record becomes a reconciliation
   case, and a `refuse` is not approvable without the owner's stated override. The critic reads objections
   leniently. (`3a0ff4e3`, `8c0a4ea6`, `dcd0ed84`.)
3. **Input and output are explicit.** Every operation kind and every record kind declares what it reads and
   what it produces, as data in `model/kinds.yaml` and `model/records.yaml`; the op catalog, the kind
   graph, the contract and the validator are held to the same declaration by `validateGraph` and
   `ops/validate.mjs`. Duplicates and conflicts between records are matched against these declarations.
4. **Adding a feature is a reconciliation with three cases.** Reference what a decided record already holds,
   never restate it; never overwrite or average a conflict - critique it and put it to the owner; author what
   is new, declaring what it reads from the decided records and what it hands on. An intake determines every
   side as checkable claims before it reconciles. (`07d1a38d`, `6887b5dd`, `8bae2c9d`; the illustrative
   formula the owner used to explain the thinking is not runtime content.)
5. **The owner decides; the runtime prepares.** A question that is not mechanical, or a credential or
   authority the environment lacks, pauses the op and opens `owner.ask`; the supervisor model answers only
   mechanical questions; a credential is never invented, stubbed, defaulted or silently skipped, and no
   secret value is written anywhere. (`8bae2c9d`.)
6. **A drawing is the installed grammar rendered in a browser.** One candidate per screen and viewport of the
   main state, composed from the grammar's renderers and the brand tokens, captured by headless Chrome; the
   other states are described and rendered by the build from the grammar's state contracts; the image model
   is for artwork only. Two canon rules the owner ruled on 2026-09-13 from a real render are now rules with
   validator support: a list of entities is a page section with a heading, never a card; the render's
   primary and danger colours are the brand's own tokens and the mascot appears exactly where the brand names
   a slot - any other palette is a defect. (`80af083a`, `34506cfd`, `9ba8495a` and the owner's ruling of
   2026-09-13 16:50.)

## 2. Records: what a Work record is derived from

A **record kind** is what a file in the Work tree or the product is, independent of the operation that wrote
it. `model/records.yaml` (`starci/records@1`) is the closed catalog; `kernel/io.mjs` reads
it, nothing else does.

| record kind | where it lives | derived from (`reads`) | node kinds |
| --- | --- | --- | --- |
| `record` | the authored fields of one Work node: assertions, write scope, checks | - | any executable node |
| `srs` | `features/<f>/business/**` | `decision` | `business`, `business-overview`, `module` |
| `sds` | `features/<f>/architecture/**` | `srs`, `decision` | `architecture` |
| `decision` | `features/<f>/business/srs/decisions/**` | - (the owner's) | `decision` |
| `brand` | `brand/index.yaml` | `code` (the real token files) | `brand` |
| `design` | `features/<f>/ui/**` | `srs`, `sds`, `brand`, `grammar` | `ui` |
| `asset` | `<record>/assets/**` bytes | `design`, `brand` | - |
| `code` | a bound source repository | `sds` | `implementation` |
| `grammar` | the grammar package and its canon | `design` | - |
| `evidence` | `<node>/evidence/**`, a run record under a flow | `code`, `design`, `srs` | `uat`, `e2e` |
| `runtime` | an environment, a migration applied | `code` | `operations` |
| `integration` | an external system a record declares, with the credential the owner provides (`extensions.work3.integrations[]`) | `srs`, `sds` | `integration` |

`reads` is the derivation, not the file dependency: an `srs` record is derived from the owner's decisions,
`code` from the design, `evidence` from the code it proved. The catalog is what makes "C repeats A" and "C
conflicts with A" a matter of ids: a record of kind K may cite another record only through the kinds K reads,
and a record that restates one of them is a duplicate by declaration.

## 3. Kinds: what an operation reads and what it produces

`model/kinds.yaml` (`starci/kinds@2`) replaces the single `mutates` list of 5.1 with two lists over the
record catalog, and the kernel, the contract and the validator read them instead of their own sets:

| kind | reads | writes |
| --- | --- | --- |
| `owner.ask` | `srs`, `sds`, `decision` | `decision` |
| `business.decide` | `srs`, `decision` | `srs`, `decision` |
| `architecture.decide` / `architecture.revise` | `srs`, `sds`, `decision` | `sds`, `decision` / `sds` |
| `brand.decide` | `code`, `grammar` | `brand`, `asset` |
| `interface.draw` | `srs`, `sds`, `brand`, `grammar`, `design` | `design` |
| `interface.asset` | `design`, `brand` | `asset`, `design` |
| `frontend.implement` | `sds`, `design`, `asset`, `brand`, `grammar`, `code` | `code` |
| `backend.implement` | `srs`, `sds`, `decision`, `code` | `code` |
| `runtime.operate` | `sds`, `code`, `runtime` | `runtime`, `code` |
| `grammar.update` | `design`, `grammar`, `brand` | `grammar`, `code` |
| `e2e.verify` | `srs`, `sds`, `code` | `evidence` |
| `uat.verify` | `srs`, `design`, `asset`, `code` | `evidence` |
| `integration.verify` | `integration`, `sds`, `code` | `evidence` (`boundary: live`) |
| `review.verify` | `srs`, `sds`, `code`, `evidence` | - (read-only) |
| `work.author` | `srs`, `sds`, `decision`, `code`, `record` | `record`, `srs`, `sds`, `decision` |

What `validateGraph` now refuses, beyond the 5.1 lane and route rules:

- `unknown-record` - a `reads` or `writes` entry the record catalog does not declare.
- `writer-blind` - a kind that writes a record kind without reading everything that record kind is derived
  from (`interface.draw` writes `design`, so it must read `srs`, `sds`, `brand` and `grammar`).
- `lane-proof-blind` - a lane whose prove step does not read what its build step writes.
- `route-target-blind` - a route whose target kind writes nothing the kinds that may raise the blocker read
  (`brand-gap` is routed to `brand.decide` because `brand.decide` writes `brand` and every kind that may raise
  `brand-gap` reads `brand`).
- `readonly-writes` / `writes-nothing` - the read-only invariant of 5.1, over `writes`.

What `ops/validate.mjs` now refuses (`IO_DRIFT`): an operator contract whose `writes[].path` maps to a record
kind the kind graph does not let that kind write. Paths map to record kinds by the layout of §2
(`recordKindOfPath`): `business/**` is `srs`, `architecture/**` is `sds`, `decisions/**` is `decision`,
`brand/**` is `brand`, `ui/**` and a `ui` node's `N/index.yaml` are `design`, `N/assets/**` is `asset`,
`repository:` is `code`, `E/**` is `evidence`, `N/index.yaml` is `record`.

What the kernel does with the declaration (`kernel/io.mjs`):

- The contract prints `## Reads` and `## Produces` under the goal, from the catalog, so an operation knows
  which records it may cite and which it may write before it reads its allowlist.
- After a `done`, every changed file is mapped to a record kind; a file whose kind the op does not declare
  in `writes` is the finding `produced a <kind> record it does not declare` and the report is downgraded to
  `failed` (`io-undeclared-write`). This runs before the validator and needs no model.
- The validator is given `io:{reads,writes}` with the rule that a record cited outside `reads` or written
  outside `writes` is a defect.

## 4. Reconciliation: three cases, as data

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

`kernel/reconciliation.mjs` is the pure module: `readReconciliation(record)` and
`checkReconciliation(rows, {tree, scope})`. The kernel runs the check when the intake reports `done`, before
the validator, and each rule is a named finding that downgrades the report to `failed` and retries the op:

| finding | rule |
| --- | --- |
| `reconciliation-missing` | an intake over a tree that holds decided records of other features wrote no table |
| `reference-unknown` | a `reference` row names a record the tree does not hold or that is not decided |
| `reference-restated` | a `reference` row names a record and a new record under C repeats its statements |
| `conflict-without-decision` | a `conflict` row names no decision record under C, or one that is not `todo` |
| `conflict-edited` | a `conflict` row's decided record was changed by the intake (its digest moved) |
| `new-unknown` | a `new` row names a record that does not exist under C, or `reads`/`hands` ids the tree lacks |
| `new-reads-blind` | a `new` row cites a record of a kind its own record kind is not derived from (§2) |

What the kernel does with a valid table (`reconciled {op, scope, reference, conflict, new}`): every `conflict`
row is put to the owner exactly as an `owner.ask` decision is - a `needUser` item of kind `decision` carrying
the decision record, its numbered options and `workflow-answer` (`reconciliation-conflict`), and the workflow
finishes `blocked` on it, never `done` over an unanswered conflict. A `reference` row changes nothing. A
`new` row is the record the next sync sees as a node. The intake never edits another feature's record: the
5.1 rule that let an intake report a change to A as `sds-gap` is withdrawn, because a change to what A
decided is either a conflict (the owner's) or new work that A hands to C (declared), and the owner ruled that
the runtime never decides for them (`8bae2c9d`).

The three participants see the same cases:

- **The critic** answers `overlaps: [{record, case: reference | conflict, evidence}]` beside its verdict. A
  `conflict` overlap is rendered under `### Conflicts for the owner` on the goal page and travels into the
  intake's contract as `## Reconciliation the critic found`; a `reference` overlap is the list of records the
  intake must cite. The 5.1 critic rule that phrased this as a formula is replaced by the three cases.
- **The intake contract** (`work.intake` in `contract-steps.mjs`) is written around the sides and the three
  cases and names the table shape verbatim.
- **The validator** is told which case each row claims and judges only what the kernel cannot: whether a
  `reference` row's cited record really covers the claim, whether a `new` record restates a decided one in
  other words, whether a `conflict` decision states both sides, the consequences, the options and one
  recommendation.

`workflow-goal --reintake <feature>` runs the same intake over drafts the tree already holds, which is how a
feature authored before 5-plus is brought under the three cases (the first proof in §9).

## 5. The owner loop

`kernel/owner.mjs` owns the whole loop; the kernel calls it at three seams:

1. **Open.** A report `ask` whose `question.kind` is not mechanical, or a `blocked` `environment`/`authority`
   whose detail names a credential (`credentialNeed`), pauses the op and opens one `owner.ask` op with the
   question, the requester, the feature's decision folder as its allowlist and the decided records as
   references (`owner-ask-opened`). A reconciliation conflict (§4) opens the same question without an op,
   because the intake already wrote the decision record.
2. **Prepare.** The ask op answers from a decided record (`answered-from: <id>`, delivered to every requester
   in its next contract) or writes one decision record draft: the question, why it matters, numbered options
   analysed per side, the decided records each touches, one recommendation. The kernel lists it
   (`needUser` kind `decision`, `owner-question`).
3. **Answer.** `workflow-answer --id <wf> --op <ask> --choice <n> [--note]` reaches the kernel through its
   inbox; the answer is delivered to every requester (`owner-answered`, `owner-answer-delivered`) and the
   question is gone. The supervisor model's `decide` answers only `question.kind: mechanical`.

The credential rule is one sentence in every contract and one validator rule: a key the environment lacks is
reported `blocked` with the exact variable name, never invented, stubbed, defaulted or silently skipped, and no
secret value is ever written into a record, a report, a log or a chat.

## 6. The host model

A host is three facts: a name, the capabilities it offers, and whether it runs operations in parallel.
`orca` (`hosts/orca/calls.mjs`) offers `design-tool` and parallel slots; `headless`
(`hosts/headless/host.mjs`) offers nothing beyond a worktree and runs one operation at a time as
`claude -p` / `codex exec` / `qwen` processes with a file mailbox. A kind lists what it `needs`
(`interface.asset` needs `design-tool`); an op whose kind needs what the host lacks is refused at schedule
time as `host-unsupported`, re-admitted by an approval from a host that has it. The lane (one workflow, one
worktree, merge-back on done) is the Orca host's; the headless host answers `--lane` with a plain git
worktree. Everything else - guards, validator, review rounds, dynamic budget, critique, the one human gate -
is host-independent. [workflow-chat.md](workflow-chat.md) is the chat's instruction.

## 7. A drawing is the grammar rendered

`interface.draw` composes each screen's main state from the installed grammar's own renderers and the brand
tokens in a scratch folder outside the product, opens it in headless Chrome and captures one PNG per screen
and viewport into the ui node's `assets/`; the markup it rendered is kept beside each capture
(`<candidate>.html`) so the render can be checked from its source. Loading, empty and error states are
described in the record and rendered by the build from the grammar's state contracts. The image model is for
artwork only (`interface.asset`).

Two canon rules, product-agnostic, with validator support (`checks/render.mjs`, run by the kernel
on an accepted drawing before the validator and available as `starci render check`):

| rule | knowledge | check |
| --- | --- | --- |
| A list of entities is a page section with a heading, never wrapped in a card; a card is one item. | `knowledge/ui/composition/collection.yaml` (`COLLECTION-1`, `COLLECTION-2`) | `entity-list-in-card`: the candidate markup places a list or table of repeated entities inside a card surface |
| The render's primary and danger colours are the brand's primary and danger tokens, and the mascot appears where the brand names a slot; any other palette is a defect. | `knowledge/ui/proof/brand.yaml` (`BRAND-1`, `BRAND-2`, `BRAND-3`) | `palette-off-brand`: a saturated colour that dominates the capture and matches no brand token; `primary-absent`: the brand's primary appears nowhere; `mascot-slot-missing`: the brand allows the mascot on this surface and the record declares no mascot slot |

The palette check reads the PNG bytes with the runtime's own decoder (no dependency), buckets saturated pixels
in OKLab and compares each dominant bucket against every brand token within the brand-check tolerance; the
markup check reads the kept HTML for a card class of the grammar family wrapping a list of repeated items.
A check that cannot run (no markup kept, a PNG format the decoder does not read) is `skip` with the reason,
never `pass`.

## 8. An external integration is proven live, or it is not proven

On 2026-09-13 four `e2e.verify` operations of one product reported four chatbot delivery nodes verified
without ever asking the owner for the Telegram or Zalo credential. Nothing was wrong with the operations:
`e2e.verify` proves the API against the database and forbids a fake only of "the unit under proof", so a
faked channel was within its contract; the credential rule of `8bae2c9d` is prose that forbids inventing a
key, and a fake invents none; and the four completions were bound to their records, not to the rules they
were proven under, so a rule that arrived later reopened nothing. Three defects of the model, three rules:

- **An integration is a record.** A business or design record that names an external system declares it as
  data, `extensions.work3.integrations[]: {id, provider, credential: {name, providedBy: owner, where},
  sandbox}` - the intake side "external integrations and credentials" is written as this list, not as prose.
  `integration` is a record kind (§2), one `integration` node per declared integration is required in the
  tree (a tree that declares one and holds no node is `ledger incomplete`, which `work.author` closes), and
  that node walks the lane `integration.verify`: a prove kind that reads `integration` and `code`, writes
  `evidence`, runs the live scenario with the credential the owner provides in the named variable, and
  reports `blocked` `environment` with the exact variable name when the environment lacks it - which is the
  owner question of §5. A fake of the declared provider inside its scenario is a defect the validator rejects.
- **Evidence says what it proved against.** Every evidence manifest carries `proof: {boundary: api | live,
  fakes: [provider ids]}`; `e2e.verify` writes `boundary: api` and names its fakes, `integration.verify`
  writes `boundary: live` and may name none. The workflow report and `workflow-status` print an integration
  whose only evidence is a faked one as *proven against a fake, not live*. There is no third state.
- **A proof remembers the rules it was proven under.** `markDone` writes
  `extensions.work3.kernel.contractDigest`, the digest of the kind's declaration (`model/kinds.yaml` entry,
  its operator contract and the validator rules of that kind). The ledger sync compares it on every read: a
  node whose proof predates the current declaration is reopened by the kernel (`proof-under-old-rule`), never
  left verified by habit and never reopened by hand.

## 9. The tree

One concept, one folder, a name that says what it holds:

| folder | holds | was |
| --- | --- | --- |
| `model/` | the declared data the runtime runs on: `records.yaml`, `kinds.yaml`, `runtimes.yaml`, `hosts.yaml`, `registry.yaml`, the provider profiles; no code | `profiles/` |
| `ops/` | one folder per operation kind, `operator.yaml` with its reads, writes, steps, proofs and blockers | unchanged |
| `kernel/` | the control loop by concern: `kernel.mjs` (loop, phases, CLI), `goal.mjs`, `intake.mjs`, `owner.mjs`, `io.mjs`, `reconciliation.mjs`, `graph.mjs`, `ledger.mjs`, `routing.mjs`, `contract.mjs`, `schedule.mjs`, `budget.mjs`, `loads.mjs`, `lanes.mjs`, `terminals.mjs`, `verify.mjs`, `guards.mjs`, `store.mjs`, `view.mjs`, `reports.mjs`, `supervisor.mjs`, `chains.mjs` | `execution/workflow-kernel.mjs` and its satellites |
| `hosts/` | the host adapters, `orca/` and `headless/`, behind one `invoke` surface | `execution/orca-*.mjs` |
| `models/` | the model functions and the headless providers | `execution/llm-functions.mjs` |
| `checks/` | machine checks over bytes: `brand.mjs`, `render.mjs`, `proof.mjs` | `execution/brand-checks.mjs`, `execution/verify-proof.mjs` |
| `bin/starci.mjs` | the one command line: `workflow-goal`, `workflow-approve`, `workflow-answer`, `workflow-run`, `workflow-status`, `workflow-list`, `workflow-stop`, `workflow-lane-close`, `workflow-supervise`, `render check`, `brand check` | `.dist/execution/orca-supervised-launch.mjs` |

Left where they are, because their names already say what they hold: `workflows/` and `approvals/` (the
Plan route and its job catalog), `providers/` (the provider contracts), `core/`, `schemas/`,
`specifications/`, `contracts/` (the Work tree contract and its validator), `knowledge/`, `execution/` (the
4.x Plan-route execution modes only). `.dist` mirrors the source tree.

## 10. What changed from 5.1, and why

| 5.1 | 5-plus | ruling |
| --- | --- | --- |
| `mutates: [...]` per kind; `DESIGN_KINDS`, `DECISION_OPERATION`, `WORK_OPERATION` hard-coded in the kernel | `reads`/`writes` per kind over a record catalog; the kernel asks `execution/kernel/io.mjs` (which kinds read `brand`, which write `record`) | doctrine 3 |
| the intake reports a change to a decided record as `sds-gap` and the kernel edits it through `architecture.revise` | a change to a decided record is a `conflict` row put to the owner or a `new` row that declares what it hands on; the intake edits nothing outside its scope | `8bae2c9d` withdraws `07d1a38d` |
| the reconciliation table is prose the validator reads by feel | typed rows the kernel checks mechanically, then the validator judges | doctrine 4 |
| the critic's rule is a formula (`A, B + C => ...`) | the critic answers `overlaps` with the three cases; the formula is gone from every contract | the owner's ruling of 2026-09-13 |
| `credentialNeed`, `openOwnerAsk`, `answerOwnerQuestion` inside the 318 KB kernel | `kernel/owner.mjs` | consolidation |
| the goal critique inside the kernel | `kernel/goal.mjs` | consolidation |
| brand rules in prose only | render checks with named findings; canon rules `COLLECTION-*`, `BRAND-*` | doctrine 6 |
| version `5.0.0-alpha.1` | `5.0.0-plus` | this release |

What is deliberately unchanged: the kernel's seams (`invoke`, `runHeadless`, the allocator, the kind graph),
the lane worktree and merge-back, the terminal rules (a tab exists only while its op runs, the coordinator tab
is re-bound or replaced, the kernel tab is released on pause), re-approve re-admits and avoided runtimes
expire, the inbox wake, the intake wording refresh, stray quarantine, the shared tree addressed both ways,
worktree trust before launch, the short pasted spec with the contract pointer. Every one of them keeps its
test.

## 11. The two proofs

**A reintake against decided records.** In a repository whose tree holds decided `srs`/`sds` records of
features A and B and drafts of a feature C:

```
node <skill>/bin/starci.mjs workflow-goal --host <skill> --job "<the owner's prompt for C>" --scope C --reintake C --lane
```

The goal page carries the critique with `### Conflicts for the owner` when the critic finds one; after
approval the intake op runs (`intake-planned {mode: reconcile}`), its report is checked mechanically
(`reconciled {reference, conflict, new}`), every `conflict` row is listed for the owner as a `decision` item
(`reconciliation-conflict`) and answered with `workflow-answer`, and `workflow-status` shows the table under
`## Reconciliation`. The unit version of the proof is `tests/reconciliation.spec.mjs` and the kernel test
"an intake is settled by its typed reconciliation".

**A drawing that passes the brand and section rules.** With a ui node drawn (PNG and markup under its
`assets/`) and a brand record in the tree:

```
node <skill>/bin/starci.mjs render check <repo>/.starciwork/features/<f>/ui --brand <repo>/.starciwork
```

prints one line per check (`entity-list-in-card`, `palette-off-brand`, `primary-absent`,
`mascot-slot-missing`) and exits non-zero on a failing one; the kernel runs the same checks on an accepted
`interface.draw` report and downgrades a failing one (`render-check-failed`). The unit version is
`tests/render-checks.spec.mjs`, which renders synthetic candidates in the brand's palette and off it.
