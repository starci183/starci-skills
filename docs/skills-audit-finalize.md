# What the nine failures are owed

A proposal. Nothing here is written into a skill until the founder approves or refuses it, item by
item. Read [`../skill-shape.md`](../skill-shape.md) and [`../INDEX.md`](../INDEX.md) first; this
argues about them and does not restate them.

Two standards this proposal holds itself to, both learned in the session it audits:

- **A rule that was already prose and was ignored does not need better prose. It needs a gate.**
- **A gate that cannot fail teaches nothing.** Every enforceable rule below names the input that
  makes it fire, and where that input is a file already on disk, it says which one.

## What moved under this audit

The tree was being restructured while this was written. Everything below reads disk at `76debe1`,
not memory, and the corrections matter:

- `CONTEXT-LOCK.md` is gone. `INDEX.md:15` says it plainly: "There is no seal and no lock record."
- All six `verify_*.mjs` scripts are gone with it. `verify_apply_materialization.mjs`, which F3 says
  "was never run for that case", is not merely unrun — it is not runnable, and no skill names it.
- `starci-fe-fidelity-fix` is gone, split into `starci-fe-fidelity-plan` and
  `starci-fe-fidelity-apply`. F1, F3, F4 and F9 map onto `starci-fe-design-apply`, which kept its
  name; F5 maps onto `starci-fe-design-plan` with `starci-fe-fidelity-plan` as a second home; F8's
  successor is `starci-workflow-drift`, which is new.
- `npm test` is 165/165 green, over four gates. `INDEX.md:185` says "Three gates hold the tree
  itself" and never mentions `sources/coverage.test.mjs`, which is the strictest of them.

So three of the nine failures name a mechanism that no longer exists. **F3, F8 and F9 are all seal
failures, and the seal is retired.** Two of them get worse under the successor rather than better,
which is the finding, not a technicality.

## 1 · Verdict per failure

### F1 — a retired route, four surviving `router.push` calls

**Remedy: a repository audit in `sources/fe/vendor-boundary.mjs`, plus one clause in
`skill-shape.md`. Not prose in the apply skill.**

Prose cannot carry this one, and the reason is structural rather than a matter of wording. Canon
itself manufactured the invisibility: VENDOR-14 forbids internal navigation by `href` and requires
the connected owner to hold the path and call `router.push`, so every internal destination in the
repository is a bare string literal inside a valid file. `tsc` cannot see it, and no per-file ESLint
pass can, because the missing thing is a route in another tree. All three greens in F1 were honest.

Canon has already done the hard half and never harvested it. `no-internal-starci-href` funnels every
internal destination into exactly one syntactic shape. And the audit channel that would read it
already exists: `sources/fe/index.mjs` gathers `audits` separately from `rules` via `auditOwners`,
and it has exactly one occupant, `effective-config`.

| | |
|---|---|
| **Rule** | `internal-destination-resolves`, a repository audit beside `effective-config` |
| **Input that makes it fire** | `router.push("/provisioning")` anywhere in connected source while no route segment resolves `/provisioning`. That is F1's literal input. |
| **Where** | `sources/fe/vendor-boundary.mjs` + twin, and VENDOR-15 in `fe/canon/patterns/vendor-boundary.md` — the same law that mandated the pattern closes it |
| **Cost** | ~120 lines of module, ~40 of twin, one paragraph of law. No reading cost on any run. |

The second half is a boundary rule, and it is a repair of a rule the tree already has rather than a
new one. Today `a file the plan did not name is a stop` (`starci-fe-fidelity-apply`,
`starci-be-feature-apply`) fires on the one repair that must never stop: an Apply that retires
`/provisioning` and then *finds* the four callers is instructed to halt with the route already
deleted, leaving the app 404ing between the stop and whoever resumes. **A rule that makes partial
discovery more damaging than blindness is inverted.** One clause in `skill-shape.md`, governing all
four apply lanes at once:

> Retiring a route, export, component or contract key is not finished until its inbound references
> are counted. Repairing a reference this run's own deletion broke is inside the boundary by
> construction, not a widening of it.

This is not an F1-only fix. The same shape has already happened inside the trust tree:
`sync-fe-lint.mjs --write` deletes a target's `plugins/eslint/`, and three canon laws cite
`plugins/eslint/index.mjs` as their implementation anchor. A successful lint-sync leaves three canon
pages pointing at a folder canon's own script removed. Same class, no product code involved.

### F2 — one dead contract key orphaned another, and Apply stopped

**Remedy: a transitive closure inside the rule that already fired. Not a new rule, and not better
prose.**

`no-dead-contract-key` is on disk, it fired, and its message is the best-argued in `contract.mjs`.
What it cannot do is close over its own consequence: ESLint reports the state of one file at one
moment, so key B only becomes dead on the run after key A is deleted.

The graph is already built. Verified on disk: `readContractReferences` at `contract.mjs:398` builds
the key-to-call-site table in one pass, and `childContractKeys` at `:1102` already resolves child
slots — `create()` populates `asChild` from it before reporting. Only the fixpoint is missing.

| | |
|---|---|
| **Rule** | `no-dead-contract-key` gains a closure: a key referenced only by entries already ruled dead is itself dead; iterate to stable; report the whole cascade in one run |
| **Input that makes it fire** | a table where `choice-tab-strip` is referenced only by `titled-summary-filter-over-body-page`, and no source file references the latter. Today: one finding. After: two, in one run. |
| **Where** | `sources/fe/contract.mjs` + two twin cases |
| **Cost** | ~15 lines. Negative reading cost — one finding replaces N runs. |

The prose half is one clause in `skill-shape.md`, and it exists to correct a claim
`starci-fe-design-apply:40` currently makes that is false for exactly this case:

> One broken seam refuses its own file, never the whole run — everything clear of it lands and is
> proved.

For a shared closed union, "everything clear of it" is not a set that exists. One unadmitted token
makes the whole table fail to type, so landing the rest lands a file that compiles for nobody — and
the repository's gate goes red for every other session, including ones that touched nothing. The
clause:

> A deletion inside a shared closed union is not landed until the rule reports clean. A run that
> leaves the repository's gate red for other sessions has not landed, whatever its own file list
> says.

**Ownership verdict, because Apply had no answer and needed one:** the cascade is *this* task's. The
two keys were not two facts — the graph already knew the second was dead at the instant the first was
reported. Deferring it ships a table `contract.md` calls a lie in its own words, and hands the next
task a finding it did not cause and cannot date. The boundary is the transitive closure of the thing
deleted: inside the closure is this task's and runs to fixpoint; outside it is the next task's and
gets a debt file.

### F3 — the record sat at 1.0 while the code shipped 1.2

This is two defects wearing one name, and they need opposite treatments.

**(a) There was no procedure for a design change arriving mid-Apply. Genuinely absent — remedy is
prose, in `starci-fe-design-apply`.**

`starci-fe-design-apply:37` covers the *target* moving under the work. Nothing anywhere covers the
*user* moving the design under the work. `starci-fe-design-preview:18` routes feedback by kind, but
that rule lives in Preview and by Apply nobody re-reads Preview. Revisions 1.1 and 1.2 had no home,
so they left no trace. This clause has never existed in any form, so it is not ignored prose:

> A design change the user makes during Apply is appended as a new `## review` section — the
> revision named, what changed, how they approved it — before the write continues. Apply may take
> it. The record must show the revision it shipped.

**(b) The seal did not notice. Remedy: nothing, and I am refusing the obvious fix.**

The pre-restructure `starci-fe-design-apply` did not merely mention the verifier — it mandated it,
in a copy-and-run fence, with a stated blocking consequence, and `skills.test.mjs` asserts that every
printed command names a script that exists, so it could not rot. It was skipped anyway. **That is
prose in the strongest form this tree can express, ignored.** The restructure's answer was to delete
it, and the founder's trade at `INDEX.md:15-19` was deliberate: prevention cost a hash per file and
phases that refused to finish; detection costs one skill run.

Resurrecting `verify_apply_materialization.mjs` reinstates the seal under a new name, against the
founder's stated trade, and reinstates a gate whose only observed behaviour was being skipped. I
refuse it. What replaces it is the records gate (§2, item 1), which checks the weaker and cheaper
claim: a `## apply` whose `Wrote` list names files no preceding `## review` names.

**(c) The downstream hazard nobody listed, and it is worse than the stale record.**
`starci-fe-fidelity-plan:17-19` admits "an approved review in a task file" as binding evidence with
no recency or supersession test. After an F3-style live steer, the stale `## review` becomes binding
truth, and the lane whose entire purpose is restoring a proven expected result is licensed to
restore the screen to a revision the user replaced — a regression authored by rule compliance. One
clause, and it is the cheapest item in this proposal:

> An approved review is binding only when it is the last `## review` in the file and no later
> section touched the same owner.

### F4 — a shared file under concurrent edit broke Apply twice

**Remedy: prose in `skill-shape.md`, because it governs all four apply lanes — plus the relocation
of a sentence that already exists in the wrong place.**

There is no machine fix here worth its cost. The two incidents are coordination facts, and the tree's
entire concurrency doctrine is one sentence in `starci-fe-upgrade-apply:22` about `.claude` itself.
`skill-shape.md:154` even names the hazard — "a shared file is a shared place to collide" — and uses
it only to justify one task file per task, never generalising it to product source.

**Incident (ii), the `p-6`/`p-4` overwrite, is a staleness fact and `skill-shape.md:26` makes
staleness compliant.** "Confirm `Repo / branch` and `Touching`. Once." In a long Apply, once is at
the start; every rule about the target moving is phrased as something a run NOTICES, never as
something it RE-CHECKS. The anti-nagging reason the rule exists is good, which is why the fix is a
cheap re-read at the write rather than a second conversation:

> A file the approved evidence resolves through is re-read immediately before the write and diffed
> against what the plan measured — `git diff <plan-commit>..HEAD -- <path>`. A change since the
> measurement is a confirm row, not a merge you perform, and it voids the state rows that render
> through it. "Once" means once per boundary, not once per run: a widened `Touching` is confirmed
> again before the first write outside it.

**Incident (i), the added `mark` slot, needs a sentence that already exists — in the one phase that
cannot hit the failure.** `starci-fe-design-preview:29-32` carries the exact diagnosis: "the class
vocabulary is a closed union, so one unadmitted token makes the whole table fail to type and reports
as errors in unrelated files." The failure lands in Apply, where that sentence does not appear. What
Apply says instead — "a shared import renamed under you is yours to resync and carry on from" — is
correct for a rename, where the error names the thing that moved, and is the wrong instruction here,
where the errors name `title`. **The rule makes the wrong repair the obedient one.** Move the
sentence to `skill-shape.md` with one clause added:

> An error naming a slot or symbol you did not touch is a claim about the shared table, not about
> your file. Read the table's history before believing the error's address.

**Cost:** roughly six lines in `skill-shape.md`, and a deletion of the misleading half of
`starci-fe-design-apply:37-41`. Net reading cost near zero.

### F5 — Plan proposed two contracts the reference's source refuted

**Remedy: prose, as admissibility rather than diligence — and a deletion, because the correct law
already exists and was lost across two restatements.**

`fe/creativity/best-belief-source.md` states it correctly: migration parity is "named legacy SOURCE
plus its rendered output at the target viewport." The root `CLAUDE.md` Authority section compresses
that to "a named legacy render owns migration parity" — source dropped. `starci-fe-design-plan`
says only "a named legacy screen, when the request names one, decides parity", with no instruction
to open its `component.tsx`. **Plan read the render because every text it was routed through told it
a render was the authority.** This is not a missing law; it is a correct law truncated.

`starci-fe-upgrade-plan:30-34` already names this exact rule as its worked example of a correctly
grouped refusal — "three skills, one absent rule about taking evidence from the source rather than
from a reading of it." The rule was identified, written down inside the skill whose job is to notice
it, used as an illustration, and never created. That is the strongest evidence in this audit that
the upgrade loop reads but does not close.

> When the request names a reference, every proposed new entry cites the reference's SOURCE file and
> the line showing the shape. A render is evidence about appearance and is never evidence that a
> structure is absent.

Where: `starci-fe-design-plan` PROCESS; and `starci-fe-fidelity-plan:17` changes from "a named
legacy source or render" to require the source whenever the claim concerns anatomy. Plus the
`CLAUDE.md` truncation is repaired. **Cost: two sentences, and one restatement gets shorter.**

The records gate can hold the weaker half — that every `Evidence` row names a file at a commit
rather than a screenshot path — and cannot hold the strong half. Say so rather than pretending.

### F6 — the same defect in four e2e specs, three in scope

**Remedy: give the debt ledger a producer and a consumer. Plus one sentence in
`starci-be-feature-apply`.**

The boundary rule correctly forbade fixing `instance-top-up.e2e-spec.ts`. The failure is that a
discovered-out-of-scope defect has **no producer and no consumer, by construction.** Measured on
disk: `debt/` holds three real entries with real frontmatter (`state`, `cost`, `paths`);
`HOW-TO-WRITE.md:77` says known-wrong things "belong in the ledger" and never says where the ledger
is; and **no skill in the tree writes to it or reads it** — the only occurrence of the word across
`skills/` is `starci-fe-lint-sync:48`, in an unrelated sense. A `Nợ` row dies with its task. The
artifact designed to outlive a task has no inbound path from any run.

> A defect found outside `Touching` is written to `<trust-root>/debt/` as its own file, and the `Nợ`
> row cites that path. An owed row with no home makes this run the defect's last witness.

Where: `skill-shape.md`'s `Nợ` section, because it applies to every lane; plus one line in
`HOW-TO-WRITE.md` naming the path and the frontmatter shape, which it currently does not.

The consumer: `starci-fe-upgrade-plan` reads only `Rejected` tables. It should also list the open
debt files in its window — one clause, and it turns the ledger from a shelf into evidence.

The half that would actually have caught the fourth spec is a sweep, and it belongs in
`starci-be-feature-apply` because Plan already reasons in that unit ("read the sibling operations,
then mirror them") and Apply never inherits it:

> A defect repaired in one operation is searched for across the sibling family before the run
> closes. The family that decides an operation's shape also decides the blast radius of a defect
> in it.

### F7 — `presentational-purity` refused only at Apply

**Remedy: one sentence in `starci-fe-design-preview` closes F7. A script closes the class, and it is
ranked last deliberately.**

The run did lint. Lint was green. The green was vacuous, and the mechanism is exact and verified:
`presentationalPurity.create()` at `sources/fe/the-split.mjs:51` opens `if (!isDrawingHalf(...))
return {}`, where `isDrawingHalf` is `/(?:^|\/)component\.tsx$/`. The candidate's pages were shaped
differently, so **the rule never ran on a single file.**

It is not an isolated blind spot. `contract.mjs:1146` reads `if (file.includes("/.artifacts/"))
return {}` — and Preview's `Touching` *is* the artifact directory. So the phase that invents contract
keys in bulk is the one phase where the dead-key rule is switched off. **Two of the rules Preview
leans on are structurally blind inside Preview's own write boundary**, one by filename convention and
one by deliberate exemption. "Lint as you write" can be fully honoured by a linter that read nothing.

The cheap fix, which closes F7:

> The candidate carries production filenames and folder shape — `<Owner>/index.tsx` plus
> `component.tsx` — because the rules holding the split are keyed on the filename. A candidate green
> under other names has proved nothing about the file Apply will write.

And narrow the `.artifacts` exemption to plan records rather than any path segment, so a Preview
candidate is checked. (Unsettled: whether a live case needs the broad form — see §6.)

The expensive fix, which closes the class and generalises the one habit this session got right that
the tree does not hold: **an applicability reporter.** For a named file set, print which canonical
rules were structurally *applicable*; any rule that could not have fired on any file is named.

| | |
|---|---|
| **Input that makes it fire** | a Preview candidate folder holding `CartPage.tsx` and `CartPageConnected.tsx` → prints `presentational-purity: not applicable (scope: component.tsx)` and `no-dead-contract-key: not applicable (scope excludes /.artifacts/)` |
| **Where** | `scripts/audit-fe-lint-adoption.mjs --applicable <glob>`, or a sibling |
| **Cost** | the honest one: rule scopes are inline predicates today, so each of 17 modules must declare its scope in `meta`. `coverage.test.mjs` already demands `meta.schema` on every rule, so a demanded `meta` field is a pattern the tree has — but this is the largest build in this proposal. |

A green that nothing could have failed is not evidence. That sentence is the whole tree's
non-vacuity habit, and it currently lives in a session rather than in the tree.

### F8 — a sealed design never applied, and the successor still cannot see it

**Remedy: one sentence in `starci-workflow-drift`. Best value-per-line in this proposal.**

`starci-workflow-drift:24` takes `## apply` (or `## fix`) as the claim. A task file that stops at
`## review` has no claim, so the skill compares nothing and reports nothing — **silence reads exactly
like health.** The seal was replaced and this gap survived the replacement unchanged.

> A task file whose last section is `## plan` or `## review` is itself a finding — approved work
> that never landed — reported before any file comparison, named with the lane that would land it.

It is the cheapest check in the skill: read a heading, walk no source. And it is the one form of
drift a file-by-file walk structurally cannot find.

One clause in `starci-fe-design-plan` SCOPE pays for itself the first time it fires: before drawing,
list existing task files for the same screen and say whether any carries an unapplied review.

**This does not go in the records gate.** An approved design that has not shipped is a backlog item,
not a defect; a gate that fails CI on it would be wrong. Drift reports it; the gate does not.

### F9 — five stale sealed screenshots, documented rather than fixed

**Remedy: prose in `skill-shape.md`'s `Nợ` rather than in two skills, because the demand already
exists there and F9 is the one case that slipped it.**

The tree has a strong same-STATE law and no same-TIME law: nothing says a capture is invalidated by
a later write within the same run. So "these five screens are stale" satisfies the letter of `Nợ` —
the fact was named — while a wrong artifact sits in the done table.

The second-order cost is what makes this worth fixing rather than documenting. Drift later re-renders
those states, compares against the recorded images, and reports five divergences that are all correct
code. Either a session is spent on a false alarm, or the reader learns that drift findings are noise
— and a green from a lane nobody trusts is the same as no lane.

> A state's capture is void once any file in `Wrote` changes after it. Re-capture, or move the row
> out of `Đã làm` into `Nợ` with the exact recapture command. Stale evidence never sits in the done
> table.

The enforceable half — a capture timestamp per state row, compared against the record's last write —
is available and I am not proposing it. It buys one class of finding for a column on every state row
of every record, and the prose above already carries the remedy. If the records gate lands and the
column turns out cheap, revisit.

## 2 · The ranked changes

Ordered by what they prevent per line they add. A tree that grows for every incident becomes one
nobody reads, so the reading cost column is load-bearing: five of these ten add none at all.

| # | Change | Prevents | Reading cost |
|---|---|---|---|
| 1 | **`sources/workflows.test.mjs`** — a fourth gate, over the task records | the recurrence mechanism of all nine | none — a gate reads you |
| 2 | **Realign `starci-workflow-drift` to the labels the template writes**, and add the unapplied-record pass | F8; unblocks detection of F3 and F9 | none — replaces existing sentences |
| 3 | **`internal-destination-resolves`** audit + VENDOR-15 | F1 | one law paragraph |
| 4 | **`no-dead-contract-key` transitive closure** | F2 | negative — one finding replaces N runs |
| 5 | **Four clauses into `skill-shape.md`**: retirement closure inside the boundary · re-read a shared file at the write · an error naming an untouched symbol is about the table · a capture is void once `Wrote` moves | F1 (half), F2 (half), F4, F9 | ~12 lines in the file read before every run — the most expensive prose here, which is why it is one place and not four |
| 6 | **Preview candidate carries production filenames**; narrow the `.artifacts` exemption | F7 | one sentence |
| 7 | **Source-over-render admissibility** in `starci-fe-design-plan` and `starci-fe-fidelity-plan`; repair the `CLAUDE.md` truncation | F5 | two sentences, and one restatement shortens |
| 8 | **Mid-Apply revision is a new `## review`**; an approved review binds only when it is the last one | F3 | two sentences |
| 9 | **`debt/` gets a producer and a consumer**; sibling-family sweep in `starci-be-feature-apply` | F6 | three sentences |
| 10 | **Applicability reporter** (`--applicable`) | the F7 class, and the vacuous-green class generally | none in prose; the largest build here |

Four more that are not in the nine and earn their place. They rank between 5 and 8:

| # | Change | Prevents | Reading cost |
|---|---|---|---|
| 5a | **`Covered by` names the task FILE, not the skill**, and design Apply may not close while a backend row's named file lacks an `## apply` unless it records, in product terms, what the server does instead | a shipped money bug. `cart.md`'s own `Took` table says the enablers are unbuilt and the schedule ships anyway; `.workflows/feature/starci-academy/` does not exist, so the enablers have no record anywhere | a template cell |
| 5b | **`starci-fe-consolidate-apply` re-measures at start**; a call site added between phases has one permitted outcome — update it and record it | a compile break authored by rule compliance: Plan says "the measurement ages from here", Apply forbids widening, and the owner gets deleted with a live caller | one sentence |
| 6a | **Fan-out assigns every shared declaration one authoring packet**; integration is one typecheck over the whole tree, never the sum of the packets' | four honest per-packet greens summing to a red. The tree's only fan-out rule lives in `starci-fe-fidelity-apply` — the lane least likely to need it — and is absent from the two lanes that produce many files | one sentence in `skill-shape.md` |
| 7a | **A frozen reference is a full 40-char SHA**, resolved with `git rev-parse` at plan time | three records pin `starci-academy@9a19342`, which is a branch tip. The object survives a pull, so the pin keeps resolving while the branch moves past it, and nothing fails | half a sentence |

Two rule repairs, batched, because a rule that fires on correct code teaches a team to ignore
messages — which is the mechanism by which every other rule stops working:

- `no-second-language-in-path` walks the absolute filename with no anchor to the repository root, so
  on a Vietnamese developer's machine every file in the repository reports at error, naming a home
  directory the author cannot rename. Anchor the walk below the repo root.
- `no-hand-rolled-heading` fires on the `Heading` leaf itself. Its documented twin
  `no-heading-tag-outside-heading-component` exempts `/src/components/leaves/Heading/`; `tokens.mjs`
  has no such check, so the one file that legitimately writes `text-3xl font-bold` is told to render
  the component it *is*.

The remaining rule findings from the attack passes go to `debt/` rather than into this proposal —
which is the F6 remedy demonstrating itself on its first day.

## 3 · What to delete

Duplication and unread prose are the failure mode this tree has already paid for, so this section is
not optional. **Net effect of §2 and §3 together: `skill-shape.md` ends shorter than it started.**

**D1 · `skill-shape.md:146-177` — the thirty-two lines defending the record path.** Five paragraphs
argue against alternatives nobody is choosing: "one file per app was considered and refused", "not in
this tree, and that is the change", "the app folder survives even inside one repository", "it is not
filed under `apps/<app>/` either". The table at `:135-139` plus the line at `:141` already gave the
path completely. Keep two: *the kind is a folder* (it changes an outcome — it makes three questions a
listing rather than a search) and *the backend repository is the home even for frontend work* (it
crosses repositories, so it changes where a run writes). Delete the rest.

The cost of those lines is positional, and it is measurable. The section that IS load-bearing —
"What the founder rejected" at `:179`, which the tree calls "the row the whole upgrade loop runs on"
— sits behind them. Measured across the five records on disk: `Rejected` tables appear in roughly a
third of phases, and two records carry none under `## plan` at all. A reader under pressure reads
SCOPE, PROCESS and the four OUTPUT tables and stops around line 130.

**D2 · The seal, where it is still law.** `fe/creativity/INDEX.md` — the file `CLAUDE.md` routes page
and flow invention to *first* — still says at `:57` that "Fidelity Fix still locks context", at `:97`
that Preview "seals its files and state evidence", at `:99` names Fidelity Fix again, and at `:106`
that "silently changing the candidate after approval invalidates the seal." Three of those name a
mechanism `INDEX.md:15` declares retired; two name a skill that does not exist on disk.

F3's headline is "the seal did not notice." A session reading `creativity/INDEX.md` today still
believes there is a seal to notice with. **Retiring a mechanism in three files while leaving it as
law in five is worse than either keeping it or removing it.** Rewrite CREATIVITY-6 and CREATIVITY-8
into the drift world, or delete them.

**D3 · The three `agents/openai.yaml` files.** They exist under `starci-fe-design-plan`,
`-preview` and `-apply`. No gate reads `.yaml` — `links.test.mjs` and `skills.test.mjs` both walk
`.md` only. All three carry retired vocabulary (Context Lock, hash-seal, "Fidelity Fix"), and
design-plan's yaml prints the required canvas label as `DIRECTIONAL - NOT AN APPLY BASELINE` while
its own `SKILL.md:38` prints `DIRECTIONAL - NOT AN IMPLEMENTATION BASELINE`. **Two literal strings
for one required label, in one skill folder.** A second, ungated instruction surface is precisely the
drift this tree has already paid for. Delete them, or generate them and put them under a gate — but
not hand-maintained and unread.

**D4 · Four duplicated paragraphs, replaced by the shape the tree already got right.**
`skills/starci-fe-design-preview/references/state-coverage.md` is written once and linked by relative
path from three skills, gated by `links.test.mjs`. That is the model, and these three never got it:

- *"Inventory before invention"* — four copies, already drifted. Preview's alone carries "a row built
  inline from a leaf plus a glyph is the same failure where no rule can see it", the most valuable
  sentence of the four. Apply's copy drops both the REUSE/EXTEND/NEW vocabulary and the rule name.
  The phase that actually writes the entry is the one told least. This is drift caught mid-formation.
- *"That file list is the check — compare it against the section above it"* — four copies. It is a
  law about the shape of every apply phase, and `starci-fe-upgrade-plan:48` itself says such a rule
  belongs in `skill-shape.md`, which has no apply-close section. Every future plan/apply split
  multiplies it by one. **The restructure's own mechanism is generating the duplication the
  restructure exists to remove.**
- *"Confirm `Repo / branch` and `Touching`. Once."* — stated in `skill-shape.md:26` and restated in
  all four apply skills. Delete the restatements.

**D5 · The JSON fence in `references/state-coverage.md`.** It hands Preview a fenced object to fill
per state. Nothing consumes it: `verify_design_record.mjs` read record JSON and is deleted, and the
`## review` template wants `| Owner | State | Rendered |`. So the run produces JSON and hand-converts
it to a table, per state, per run. `HOW-TO-WRITE.md:98` states the test this fails: "would somebody
copy this and run it? If yes it is a fence. If they would only read it, it is a table." The tree's
one correctly-shared reference violates the tree's own fence law.

**D6 · `INDEX.md:110`, the clause "no file there names a number of its own".** `fe/design/gap.md`
names numbers throughout — gap-1 through gap-4, four pixels, eight, twelve, GAP-7 through GAP-12 each
pinning a rung; `padding.md` does it too. A reader applying the tree's own placement test at
`:123-126` honestly moves both files to canon. Delete the false clause; leave the placement question
to the founder (§6).

**D7 · `INDEX.md:8`, "Every skill here has the same three parts".** `starci-data-backup` and
`starci-data-restore` have none of them — no `skill-shape.md` reference, no SCOPE, PROCESS or OUTPUT
heading, none of the four tables — and `skills.test.mjs` cannot see it because its shape check only
fires on files carrying a `$starci-` token. Two of fifteen. Either shape them or state the exemption:
they are operational skills outside the plan/apply pairing. Deleting a false universal is cheaper
than enforcing it.

**D8 · The hand-transcribed counts in `sources/fe/*.mjs` headers.** `the-split.mjs:4` says "ONE
RULE" and exports two; `naming.mjs:147` says "both rules here" over three; `tokens.mjs:264` says "all
three" over four; `icon.mjs:306` says "both rules are exact" over five, and the two it never mentions
are the two carrying the false-positive risk. `HOW-TO-WRITE.md:71-74` already forbids this — "a
number transcribed by hand starts lying the day after it is written" — and the prohibition was never
extended to `sources/`. Delete the counts; extend the prohibition.

## 4 · The refusals

Every attacker finding not adopted, with the reason. A finding dismissed silently comes back.

| Refused | Why |
|---|---|
| Resurrect `verify_apply_materialization.mjs`, or any hash gate | It reinstates the seal under a new name against the founder's stated trade, and the deleted one's only observed behaviour was being skipped. The records gate checks the weaker, cheaper claim. |
| A fifth SCOPE row, `Checking` — the paths a run must READ | The route audit catches F1 mechanically. A row printed on every run to catch a case a gate now catches is exactly the growth this proposal resists. |
| Preview restates every `Chose` and `Took` row before building | A whole extra ritual for a narrow failure. Adopted in the narrow form only: a Plan decision Preview OVERTURNS is a confirm row before building, not a `Took` line after. |
| Merge `starci-fe-fidelity-plan` and `-apply` back into one skill | The diagnosis is right — roughly 15 of 106 lines are one law stated twice, and a session moving one class now reads 386 lines first. But the restructure is mid-flight and re-merging costs more than the duplication. To `debt/` with the measurement. |
| Move `gap.md` and `padding.md` to `canon/patterns/` | The tree's stated criterion says move; the founder's shelf intent says stay. That is a founder call, not an auditor's. Delete the false claim instead (D6). |
| A gate asserting a module header's rule count matches its exports | Parsing prose to check prose. Delete the counts (D8). |
| Remove ICON-10 (`no-decorative-icon-in-metric-cell`) | It hardcodes one product path and asserts a fact about a reference in another repository, which `starci-fe-fidelity-plan:46` forbids in prose — but rank medals are a named canon exception, so whether this is a second one is the founder's. To `debt/` for a decision. |
| Fix `no-children-slot` firing on a domain `children` field | Real, and the remedy is arguable — a domain-type exemption, or the rule is right and the type belongs elsewhere. To `debt/`. |
| Fix `no-off-scale-glyph-size` double-reporting with `no-arbitrary-value`, and `isGlyphImport` matching `iconv-lite` | Real rule defects, none of them among the nine, none observed costing this session time. To `debt/`, which is where §1's F6 remedy says they go. |
| Make the FE mirror freshness a hard prerequisite of `lint` | It already breaks `npm run lint` in a clone with no sibling checkout — the exact dependency `sync-fe-lint.mjs`'s own header refuses. A consumer package.json fix and a debt entry, not a trust-tree rule. |
| A capture-timestamp column on every state row (F9's enforceable half) | It buys one class of finding for a column on every row of every record. The prose carries the remedy. Revisit if the records gate lands cheaply. |
| A canon-anchor gate that walks `starci-academy-fe` | Adopted only as an optional mode of an existing gate that reports when it skips. A required gate depending on a foreign checkout is the dependency the tree already argued its way out of. Five of thirty-four anchors are already dead; that goes to `debt/` today. |
| Rewrite `INDEX.md`'s "two/three/four output shapes" disagreement as a fourth statement | `CLAUDE.md` says two, `INDEX.md:8-11` says three, `skill-shape.md` says four, and all three are read before every run. The fix is deletion — `skill-shape.md` is authoritative and the other two stop restating it. Folded into D4's principle rather than given its own item. |

## 5 · The one change

**`sources/workflows.test.mjs` — a fourth gate, over the task records.**

Every remedy in this proposal lands as a row in a task file. Every consumer of those rows is
currently reading labels the records do not contain. Measured across the five records on disk:

| Label a consumer reads | Files containing it |
|---|---|
| `STATES` — drift's state check | **0 of 5** |
| `TOOK` — drift's decision check | **0 of 5** |
| `## fix` — drift's alternate claim section | **0 of 5** |
| `WROTE` — drift's file check | **1 of 5**, and that one occurrence is the space-padded block `HOW-TO-WRITE.md:96-118` forbids by name |
| `\| Wrote`, `\| Took`, `\| Owner \| State` — what the template actually writes | 5 of 5 |

**`starci-workflow-drift` run today over the entire history executes none of its four checks and
reports the tree healthy.** That is measured, not argued. The successor to the seal issues a clean
bill of health from checks that never ran — strictly worse than having no drift lane, because a green
from a lane nobody suspects is what stops anyone looking.

The other consumer is no better off. `starci-fe-upgrade-plan` reads exactly and only `Rejected` rows,
and the word `Rejected` appears in exactly one `SKILL.md` in the tree — that one, the consumer. No
phase repeats the instruction; it lives only in `skill-shape.md`'s template, and compliance is about
a third. Every missing table is evidence permanently lost to the loop that is supposed to prevent the
next nine failures.

And the records already violate rules the tree states in prose four separate times: ad-hoc headings
(`## backend`, `## apply — second pass, the wiring`, `### apply, continued`), space-padded blocks,
missing refusal tables, and a `Covered by` cell naming a skill rather than a file it can be resolved
against.

A gate over the records holds what prose has asked for and not got: headings from a fixed set per
kind and in order · a non-empty `Wrote` table wherever `## apply` exists · a `Rejected` table in
every phase even when it reads "nothing refused" · no space-padded label blocks · every `Covered by`
path resolving to a file that carries an `## apply`.

**And it can fail. Three of the five records on disk fail it today** — `cart.md` on its ad-hoc second
apply heading and its missing `## plan` refusal table, `course-detail-page-v3.md` on the space-padded
`WROTE` block at `:136` and `### apply, continued`, `coding-practice.md` on a `## backend` section no
template defines. A gate whose first run is green over real data has proved nothing; this one names
its inputs before it is written.

It is also prerequisite to the rest. Fixing drift's labels (change 2) is one edit, and it makes drift
work while doing nothing about compliance. The gate makes compliance real *and* makes change 2
trivially correct, because the labels the gate enforces are the labels drift should read. Adding
rules to a tree whose records cannot be read adds nothing.

## 6 · What this audit could not settle

- **The tree moved underneath it.** `76debe1` (a fourth shell) landed after the reads this proposal
  was given. Line numbers quoted from those reads may be off by a few; every number I state as
  measured, I re-measured on disk.
- **`Rejected` producers.** The reads given to me said four skills instruct the table. On disk today
  the word appears in one `SKILL.md`, the consumer. I could not determine whether that is restructure
  progress (the instruction correctly centralised into `skill-shape.md`) or regression (four
  instructions lost in a rewrite). It changes whether item 1 needs a companion prose change.
- **Whether the `.artifacts` exemption in `no-dead-contract-key` has a live case.** I found no `.tsx`
  under any `.artifacts/` to test the narrowing against. If plan records only ever hold `.md` and
  `.html`, the exemption may be removable rather than narrowable.
- **The applicability reporter's real cost.** It depends on whether the seventeen modules' scopes can
  be declared without restructuring their `create()` functions. I did not attempt it, so item 10's
  cost is an estimate and it is ranked last for that reason.
- **Every consumer-repository measurement** — `nivo-fe`'s eight drifted mirror files, the five dead
  canon anchors, `starci-academy-fe`'s `verify` printing "pass 0" over a deleted glob, the CRLF
  digest instability. These come from an attack pass and I did not re-verify them; they are the kind
  of measurement that ages in days. They belong in `debt/` with their measurement date, not in a rule.
- **Whether `agents/*.yaml` has a consumer.** If an OpenAI runner reads them, D3's deletion breaks
  it. I could not find the consumer, and "delete it" is only safe if nobody is holding the other end.
- **`.workflows/feature/` and `.workflows/fidel/` do not exist.** Only `designs/` is on disk, while
  `.artifacts/be-feature/` still holds `context-lock.plan.json` and `architecture-record.json` — the
  retired pre-restructure shape. The be-feature lane's output has not migrated. I could not tell
  whether that is because the lane has not run since, or because it ran and wrote to the old place.
- **`docs/` is a new shelf.** This file created it. No index names it, and `INDEX.md`'s axis tables
  do not mention it — the same defect D-series flags about `debt/`. If this proposal is adopted,
  both shelves need one line in `INDEX.md`, or this document becomes the next thing nobody reads.
