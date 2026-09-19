# v8-3 — `scripts/check-work-history.mjs`: change/rev discipline verified against git

Lane brief: `ex-testing/briefs/v8/_common.md` + `ex-testing/briefs/v8/v8-3.md`.

Files this lane wrote (nothing else):

- `scripts/check-work-history.mjs` — the check (new, the lane's one script file)
- `tests/work-history-check.spec.mjs` — 13 fixture tests (new)
- `ex-testing/lint/v8-3-REPORT.md` — this file
- `ex-testing/lint/done/v8-3.done` — the done marker
- `ex-testing/lint/scratch/v83-*` — run logs and the hand-verification probes this report quotes

No `.starciwork` tree, no `check-example-work.mjs`, no `check-work-deep.mjs`, no `example-ownership.mjs`,
no `checks/work-change.mjs` was edited. Every finding below is about other lanes' records, which is the point of
the check, not a claim that this lane touched them.

## What it checks

`change.rev` / `kind` / `withdraws` are claims about a transition, and a record file holds one side of it. The
script reconstructs the other side from git and runs five rules:

| code | severity | the transition it decides |
| --- | --- | --- |
| `CHANGE_UNRECORDED` | REFUSE | normative projection moved between two revisions and `change.rev` did not (or the change record was deleted) |
| `REV_NOT_MONOTONIC` | REFUSE | `change.rev` went backwards along the **mainline** chain |
| `WITHDRAWS_NOT_VERBATIM` | REFUSE / SUSPECT | a `change.withdraws[]` clause, tiered by where the quoted text actually lives in the record's own past |
| `CHANGE_KIND_SUSPECT` | SUSPECT | `kind: editorial` declared for a transition `checks/work-change.mjs` reads as clarifying/breaking |
| `UNTRACKED_RECORD` / `CHANGE_UNDECLARED` / `HISTORY_INCOMPLETE` / `REVISION_UNREADABLE` / `NO_GIT` | INFO | counts, and skips that name the checks they stand in for |

`WITHDRAWS_NOT_VERBATIM` answers one question per clause — "did any revision of this record ever carry this
string?" — and grades the answer, because the severity has to follow the evidence:

- `held` — verbatim in the previous revision's `statements[]` → nothing reported
- `wrong-revision` → carried by an older revision, not the one the claim names → SUSPECT
- `not-a-statement` → carried inside normative content but never in `statements[]` (a gap's `statement`, an sds
  `sequence.steps[].message`, an nfr `measurement.how`) → SUSPECT
- `prose-not-obligation` → carried only in `blockedBy[].because` / a note → SUSPECT ("prose is local and
  travels nowhere, so this withdrew nothing")
- `fragment-of-a-clause` → the quoted text is a piece of a longer sentence the record did carry → SUSPECT
- `never-carried` → REFUSE, but **only** once the lineage walk reached the record's own first commit; if
  `--limit` or an unresolved move hides the birth it is SUSPECT and says so

## Design decisions

**One git spawn per tree, not one per record.** The brief's `git log --follow -- <path>` per record file
measured 120 ms/spawn on this repo (1704 commits, rename detection), i.e. ~35 s for the two trees. So the
history comes from one `git log --first-parent --name-status -z` over the tree (170 ms) and the blobs from one
`git cat-file --batch` (a few hundred revisions per call). `--follow` is spent only on records whose withdrawal
nothing in the reachable past carries — 2 escalations in the run below. Total wall clock: **3.2–3.4 s** for
both trees (`3369, 3332, 3159 ms` over three runs); 1.9 s for one tree at `--limit 500`.

**The mainline owns the transition checks; `--follow` only answers "was it ever carried".** The first version
fed the escalated lineage into every check and produced `REV_NOT_MONOTONIC: accb7b04 carried 3, dfb7c74e
carries 2`. Hand-check: `git merge-base --is-ancestor` says neither is an ancestor of the other (16:17:55 and
16:18:04, two lanes). Two parallel branch tips are not a revision sequence, so that refusal was a false
positive and is now structurally impossible: `ancestors` never reaches the rev ordering. Live finding today: 0.

**A version is its parsed content, not its bytes.** Two revisions agree when `canonicalJSON` of the parsed YAML
agrees. Comparing bytes would make every explanatory comment a lane writes into a record a new revision (these
trees are full of them) and would turn git's checkout-time eol translation into a fake normative move. The
fixture test asserts this directly: a comment-only edit yields `0 transitions` and no finding at all.

**Projection is check-work-deep's, restated, for one comparison.** `REV_NOT_BUMPED` uses
strip(`state, change, provenBy, verificationSource, blockedBy`) — the projection the brief names.
`check-work-deep.mjs` keeps its `normDigestOf` module-local and this lane may not edit that file, so the five
field names are duplicated there and here with a comment saying they must be kept in step. `checks/work-change.mjs`'s
own `normative()` (which additionally strips prose keys at every depth) is used where it is the right tool —
inside `classifyChange`, imported for `CHANGE_KIND_SUSPECT` rather than re-derived.

**Withdrawal sourcing is fold-insensitive and widens in steps.** `fold()` collapses YAML block-scalar line
breaks, so a clause that only differs by folding is verbatim (refusing the formatter would be refusing nothing).
The scopes go strict → wide (`statements[]` → normative leaves → whole document minus its own `change` block →
substring haystack) so the strict claim ("this was a clause") is what passes and the wide claim ("this string
never existed here") is what a refusal is allowed to rest on.

**A tree move is a crossing, not a birth.** `git log -M` cannot pair a directory move when the pathspec is
limited to the moved tree, so an `A` at the bottom of the plain listing is often a relocation. `birthSeen`
therefore requires an `A` that is not a crossing and not the boundary of a capped walk, and a `never-carried`
REFUSE additionally requires the `--follow` walk to have run. `lineageEntries` stitches the `from` links so a
record authored under `examples/todo-app/.starciwork` keeps its pre-move revisions (fixture test:
"a record that moved directory keeps the lineage its withdrawal claim refers to").

**Every finding names its side of the pair.** `HEAD -> uncommitted`, `aa186d5d -> e9669075`. On a fleet-shared
tree a refusal without its transition cannot be attributed, and 8 of the 33 refusals below are in-flight edits
by other lanes.

**`git` is a precondition, not an assumption.** No repo / repo unreachable / tree outside the repo → one INFO per
tree naming the four checks that did not run, mirroring check-work-deep's `NO_BASELINE` line.

## Findings on the live trees

Stamped run — HEAD `5c10a673`, both example trees, default `--limit 50`, full log in
`ex-testing/lint/scratch/v83-exit-run.txt`, exit code **1** (measured through a marker file:
`v83-exit.code` = `EXIT_NONZERO`):

```
313 record(s), 290 with git history, 472 version transition(s), 132 claiming a prior revision, 10 withdrawal
claim(s) checked against their baseline, 2 lineage(s) confirmed with --follow: 35 refused, 49 suspect, 6 info
```

Per tree (`--tree` each): todo `272 record(s), 265 with git history, 490 version transition(s) … 49 refused,
49 suspect, 3 info`; ecommerce `41 record(s), 25 with git history, 8 version transition(s), 4 claiming a prior
revision, 0 withdrawal claim(s) … 2 refused, 0 suspect, 2 info`.

Verbatim, with each claim's hand-check:

```
REFUSE  examples/todo-app-backend/.starciwork/features/task/br/complete/once/index.yaml: HEAD withdraws
"A complete task is never reopened.", a string no committed revision of br.task.complete.once carried anywhere,
whole or in part (5 mainline revision(s) plus 7 lineage revision(s) examined, down to the record's first
commit) [WITHDRAWS_NOT_VERBATIM]
```

Verified by hand (`scratch/v83-verify-once.txt`): the record's full `--follow` lineage is 10 commits down to
its creation at `acd7e45e`, and the substring "never reopened" appears in **exactly one place in every one of
them** — `change.withdraws[0]`. It was born at rev 2 already withdrawing a clause it never had. TRUE POSITIVE.

```
REFUSE  examples/todo-app-backend/.starciwork/features/login/contract/identity-for-task/index.yaml: uncommitted
withdraws "The session token travels as a custom "x-session-token" request header (implicit, never...", a string
no committed revision of contract.login.identity-for-task carried anywhere, whole or in part (4 mainline
revision(s) plus 7 lineage revision(s) examined, down to the record's first commit) [WITHDRAWS_NOT_VERBATIM]
```

Verified (`scratch/v83-vc-contract.txt`): 8 distinct revisions; the sentence matches no field of none of them
— not exact, not after folding, not even as a containment. The record's `surface[0].transport` does mention
`x-session-token`, in different words. TRUE POSITIVE, and it is an in-flight edit (`uncommitted`).

```
REFUSE  examples/todo-app-backend/.starciwork/features/audit/gap/emitted-events/index.yaml: aa186d5d -> e9669075:
normative content moved (statement, closedBy, because) while change.rev stayed at 1 [CHANGE_UNRECORDED]
```

Verified (`scratch/v83-verify-move.txt`): `git diff aa186d5d e9669075` rewrites `statement`, flips
`state: todo → done` and adds `closedBy`/`because`, while both sides carry `change: {rev: 1, kind: initial}`.

```
REFUSE  examples/todo-app-backend/.starciwork/features/login/br/password/sign-in/index.yaml: d633b841 -> HEAD:
normative content moved (module) while change.rev stayed at 1 [CHANGE_UNRECORDED]
```

Verified: `-module: [src/features/sign-in/**, src/modules/integrations/keycloak/**]` /
`+module: [src/modules/bussiness/session, src/modules/integrations/keycloak]`, and `git show <each>:…` prints
the identical `change: {rev: 1, kind: initial, …}` on both sides.

```
REFUSE  examples/todo-app-backend/.starciwork/features/login/ui/sign-in/index.yaml: 48f94491 -> bae8c18b:
normative content moved (assets) while change.rev stayed at 2 [CHANGE_UNRECORDED]
```

Verified: `bae8c18b` adds a whole `assets/sign-in-refused.png` entry (with its `generation:` block) to a `ui`
record sitting at rev 2 in both commits.

```
REFUSE  examples/todo-app-backend/.starciwork/features/login/gap/migration-not-applied/index.yaml: aa186d5d ->
d633b841: normative content moved (statement, closedBy, because) and the change record was deleted
[CHANGE_UNRECORDED]
```

Verified: the diff removes `-change: {rev: 1, kind: initial, at: 2026-09-18T07:05:00.000Z}` and closes the gap.

```
SUSPECT examples/todo-app-backend/.starciwork/features/audit/fr/erasure/complete/index.yaml: HEAD -> uncommitted
(rev 2 -> 3): declared kind: editorial while normative content moved with no statement listed either way -
checks/work-change.mjs reads the transition as "breaking" [CHANGE_KIND_SUSPECT]
```

Verified: the in-flight edit replaces `requiresProof.e2e.command`'s jest pattern with a real spec path and
re-declares `kind: clarifying → editorial`. `requiresProof` is not prose in work-change's projection, so
`classifyChange` says breaking. Reported as SUSPECT, not refused: the edit really is small in spirit, and the
check is not the thing that decides whether a proof-path fix is editorial.

INFO tier, verbatim (both trees):

```
INFO  examples/todo-app-backend/.starciwork: 115 committed transition(s) moved normative content in records that
carry no change record on either side - the layout never required one, so this is a count of what a rev claim
could not cover even in principle; e.g. …/audit/data/erasure-request/index.yaml, …/audit/data/log-line/index.yaml
[CHANGE_UNDECLARED]
INFO  examples/ecommerce-app-be/.starciwork: 16 record file(s) have no git history at all - never committed, so
no transition of theirs is checkable (expected while fleet lanes are mid-flight); e.g.
…/checkout/br/cart/ac/accumulates-on-held-product/index.yaml [UNTRACKED_RECORD]
INFO  examples/todo-app-backend/.starciwork: 1 committed revision(s) did not parse as YAML 1.2 and were skipped
rather than compared [REVISION_UNREADABLE]
INFO  examples/todo-app-backend/.starciwork/brand/index.yaml: brand claims rev 3 but only one content revision is
reachable in git, so REV_NOT_BUMPED and REV_NOT_MONOTONIC had nothing to compare [HISTORY_INCOMPLETE]
```

The unreadable revision is identified (`scratch/v83-find-unreadable.mjs`):
`d633b841:…/features/login/gap/live-proof/index.yaml` — a commit that landed a record strict YAML 1.2 rejects.
The `CHANGE_UNDECLARED` count is a deliberate de-noise: 115+2 unrecorded moves in records that never authored a
`change` block is a layout gap, and printing it 115 times would train a reader to skip the whole run.

## False-positive rate observed

The first working version refused **12** withdrawal clauses. Hand-checking all 12 before trusting any of them:

- 10 were wrong-severity: the text existed in an older revision, just not in `statements[]` — in
  `invariants[]`, `measurement.how`, `sequence.steps[].message`, `blockedBy[].because`, or as a **fragment** of
  a longer `statement` (e.g. `gap.plan.sepay-not-reachable` withdraws "no module exists yet at
  src/plan/payments (gap.plan.unbuilt-module)", which is a clause *inside* its own rev-1 `statement`).
- 2 survived, and both were then verified revision-by-revision above.

So precision of the strongest tier started at 2/12 = 17 %, and the tiering (fold-insensitive compare, four
sourcing scopes, birth-required-for-refusal) is what the hand-check produced. Current run: 2 withdrawal
refusals, both verified revision-by-revision; 33 `CHANGE_UNRECORDED` refusals, of which 8 name an in-flight edit
and 25 sit between committed revisions. **Seven of the 35 refusals were opened by hand** — both withdrawal
refusals and five `CHANGE_UNRECORDED` samples covering the three shapes (`module`, `assets`, `statement`/
`closedBy`, plus the deleted-change-record case), each confirmed with `git diff` / `git show` as quoted above.
The remaining 26 were not individually opened: they are the same shapes on other records, and the report says so
rather than implying a 35/35 verification. The one class that *was* checked and rejected is
`REV_NOT_MONOTONIC`, which currently produces no live finding.

Two honest limits on the number itself:

- **The totals move under the fleet.** The combined run printed 35 refusals in total; the same todo tree printed
  49 refusals of its own a minute later (`scratch/v83-final-todo.txt`) while lanes edited it, and its
  `CHANGE_UNDECLARED` count ranged over 115 / 117 / 125 / 140 across five runs of that one tree. The closing run
  of this lane's work (`scratch/v83-run-close.txt`, 19:57 local) reads
  `313 record(s), 290 with git history, 498 version transition(s) … 51 refused, 49 suspect, 5 info` on the same
  HEAD — 16 more refusals than the stamped run above, none of them from this lane, which wrote no record. Read
  the check as "what is unrecorded right now", not a verdict with a stable count.
- **The default `--limit 50` under-reports.** `--limit 500` on the same tree: `528 version transition(s) … 56
  refused` — 7 more, and all seven are the same `c2a504d7 -> d633b841: normative content moved (module) while
  change.rev stayed at 1` pair (the tree-move commit), which the 50-commit cut never reaches. False negatives by
  default, disclosed rather than hidden by raising the default: 50 keeps the check at ~3 s; `--limit 500` costs
  ~2 s per tree.

Field-level risk worth naming: of the 33 `CHANGE_UNRECORDED` refusals in the stamped run, the moved fields are
`module` 11, `assets` 7, `statement` 6, `owners` 6, `closedBy` 4, `because` 3, `openQuestions` 2, `statements` 1,
`title` 1, plus one where the whole change record was deleted. `module`/`owners` (and `repository`, in the later
run) are path bindings, and the projection the brief mandates keeps them, so a pure path correction reads as an
unrecorded normative move. The message names the moved fields, which is what makes that dismissible at a glance.

## What it deliberately does NOT check

- **Not the record's evidence, deps or proofs** — that is check-work-deep (`DEP_STALE`, `NORM_UNRECORDED`
  against `_derived/deep-baseline.json`) and `example-verify`. This check's baseline is git, and it never reads
  the baseline file.
- **Whether a rev bump should have travelled further** — `checks/work-change.mjs` owns that, and with `--against`
  a tree it owns the full transition report. This script's `CHANGE_KIND_SUSPECT` is the one place it borrows
  `classifyChange`, per-record and criteria-blind (empty `criteria` maps), so an edited *acceptance criterion*
  is not classified as a break here.
- **The mirror kind lie**: `kind: breaking` (or `clarifying`) declared for a transition that is really prose —
  over-travel is safe, so it is not reported. Only the understatement the brief names is.
- **The `withdraws`-still-present and `withdraws`-without-`breaking` rules** — already in work-change, no
  double-reporting here.
- **A withdrawn clause that lived in a *different* record.** `lineageEntries` walks one file's lineage; a
  withdrawal quoting another record's sentence is not distinguishable from invention here.
- **Merge conflict resolutions.** `--first-parent` diffs a merge against its first parent, so a merge that
  changed a record relative to *both* parents is listed, but a lane's un-landed branch revision is not part of
  the mainline chain by design.
- **Deletions and renames as history**: a record file deleted from the tree is simply gone from `loadRecords`,
  and `UNTRACKED_RECORD` counts files git has never seen. It reports nothing about what was deleted.
- **Nothing outside the two example trees** unless `--tree` points it there, and it writes nothing anywhere —
  reports, never repairs.

## Tests

Fixture convention found: `tests/example-work-gate.spec.mjs` (node:test + `assert/strict`, throwaway trees under
`<drive root>\starci-tmp`, run by `npm test` = `node --test tests/*.spec.mjs`). `tests/work-history-check.spec.mjs`
follows it, with one **git repository per fixture** (13 tests, all passing, ~7.7 s):

refusal asserted — `CHANGE_UNRECORDED` on `HEAD -> uncommitted`; `REV_NOT_MONOTONIC` (rev 2 → rev 1 committed);
`WITHDRAWS_NOT_VERBATIM` down to a visible birth. clean-case asserted — comment-only edit produces 0 transitions
and no finding; a verbatim withdrawal produces nothing; an honest `kind: editorial` on a title-only edit is
quiet. tier asserted — fragment → SUSPECT and no refusal; prose-only → SUSPECT and no refusal; `--limit 1` turns
the same never-carried claim from REFUSE into SUSPECT. skip asserted — `NO_GIT` names the four checks that did
not run; `UNTRACKED_RECORD` counts the never-committed file. lineage asserted — a record moved directory with
unchanged bytes keeps the pre-move revision that holds its withdrawn clause (`summary.followed === 1`, no
WITHDRAWS finding).

```
node --test tests/work-history-check.spec.mjs        -> tests 13, pass 13, fail 0
node --test tests/example-work-gate.spec.mjs tests/work-change.spec.mjs tests/work-layout.spec.mjs
                                                     -> tests 61, pass 59, fail 0, skipped 2 (pre-existing)
```

## Fleet gate delta (this lane moved none of it)

`node scripts/check-example-work.mjs` before the first write and after the last, set-diffed
(`scratch/v83-gate-diff.mjs`, output `scratch/v83-gate-diff.txt`) — **all 81 delta lines are under
`examples/`, 0 outside**:

- before: `311 record(s), 2505 ref(s), 120 evidence file(s): 158 refused, 4 warned`
- after: `313 record(s), 2510 ref(s), 120 evidence file(s): 125 refused`
- only-after: 22 lines (new `recordDigest`/capture refusals in `audit/*`, `notify/impl/*`); only-before: 59
  lines (a lane fixed them)

This lane wrote no `.starciwork` file, so none of that movement is its own; the numbers are stamped to their
runs for exactly that reason.

## Running it

```
node scripts/check-work-history.mjs                                  # both example trees, --limit 50
node scripts/check-work-history.mjs --tree examples/ecommerce-app-be/.starciwork
node scripts/check-work-history.mjs --tree examples/todo-app-backend/.starciwork --limit 500
node scripts/check-work-history.mjs --tree D:\somewhere\.starciwork   # outside a repo -> INFO skip, exit 0
```

Exit 1 on any REFUSE. `--limit` bounds both the tree walk and each lineage walk; below 2 reachable revisions
the verdict is SUSPECT and says the birth is unreachable.
