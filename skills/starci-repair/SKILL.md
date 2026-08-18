---
name: starci-repair
description: Take a source that no longer builds, no longer lints clean, drifted out of format, still carries Prettier in strict-fix mode, retains a retired component tier such as `components/shells`, has contract reasons nobody can find by need, measures itself against copied lint rules, or retains a `.claude/` from an older tree, and return it green — measured before and after, repaired in separated passes, and never made green by silencing a finding. Use when a checkout is red, structurally stale, or untrusted. Writes product source after approval.
---

# starci-repair

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@file-layout` | `compilers/patterns/fe/file-layout` | module | supplies the accepted frontend tier vocabulary for structural repair |
| `@skill-shape` | `skills/skill-shape` | module | the shared reporting contract every skill reads |

## NESTED SKILLS

None. This skill reports a stale route and ends; it never starts setup.

## Run

Read `@skill-shape` first.

**Seven different things are called stale, and repairing the wrong one wastes the run.**

| What is stale | Symptom | Owner |
|---|---|---|
| the **route** | the recorded checkout, contract or head no longer holds | `starci-init` |
| the **source** | it does not build, does not lint clean, or drifted out of format | this skill |
| the **index** | every gate is green, but no contract `why` can be found by need, so entries get written twice | this skill, last pass |
| the **machine** | the gates cannot fire: the published lint packages are not installed, or a copy of them is vendored into the checkout | this skill, before measuring |
| the **formatter** | strict-fix mode finds Prettier beside an ESLint canon that owns formatting | this skill, the strict-fix pass |
| the **structure** | an accepted tier vocabulary removed a path that still exists, including an empty path no file-based gate can see | this skill, the retired-structure pass |
| a **remnant** | a target checkout still carries a `.claude/` left from an older tree | this skill, after the index |

So this skill resolves the route first and **stops** if the route is the stale thing. Repairing source
through a stale route means repairing a repository nobody asked about.

## The law this skill exists to protect

**Green is earned, never bought.** A finding is repaired or returned; it is never silenced. No
`eslint-disable`, no weakened severity, no rule removed from a config, no test skipped, no `any` added
to end a type error. Every one of those turns a red gate into a green one while leaving the defect in
place — and the next reader has no way to know it was ever there.

**Formatting is not repair, and mixing the two destroys review.** A behavioural fix inside four thousand
reformatted lines is a fix nobody can see. Format runs alone, in its own pass, with its own commit.

**Strict fix has one formatter: ESLint.** When the request names strict fix, Prettier is not retained as
a second opinion or a compatibility fallback. Remove its direct packages, plugins, shared configs,
configuration files, ignore files, scripts, hooks, lint-staged entries, CI steps and editor integration.
Any format entrypoint the repository still needs is repointed to the installed ESLint canon. Regenerate
the lockfile through the package manager; never hand-edit it. A transitive lockfile entry required by an
otherwise unrelated package is reported with its dependency path, not used as permission to delete that
package outside the approved boundary.

**Measure with the repository's own gates.** Read the manifest and run the scripts that repository
actually declares. A count from a command the project does not use proves nothing about the project.

**Green gates do not prove the directory tree is clean.** ESLint visits files and Git tracks files; an
empty forbidden directory is invisible to both. Structural repair therefore inventories directories
directly and compares them with the accepted tier vocabulary. `components/shells` is forbidden by
`FILE-8` whether it contains four files or none.

**The machine is installed, never authored.** The rules a gate fires are a published dependency, and
**every repository that runs the gates installs it — the checkout under repair, and only that one.** The
trust tree installs nothing: it is the law, not a runtime. So this run's install lands in the same
repository whose counts it is about to take, as a manifest and lockfile change like any other dependency.

What it never writes into that repository is a **rule**, and it never repairs one that is already there.
A rule authored or copied into a checkout is a second home for a law: it enforces whatever it was on the
day it landed, it drifts the moment the law changes, and nothing in that repository can tell
that it has. Green measured against a private copy is green against a rule nobody else has.

## PROCESS

### 1 — Establish the context lock

`Phase` is `plan`, then `review`, then `apply`. `Touching` is `None` until approval; after
approval it is the exact source paths the approved boundary names.

### 2 — Resolve and verify the route, and stop if the route is the problem

Read `.workspace/<project>/<role>/config.json` and verify it before reading source: the checkout exists,
the contract path for a frontend role exists, the recorded head still belongs to that checkout.

A stale route ends the run here. Say which field failed; the owner row names the next action.

**One repair record covers one role of one project.** A request naming five checkouts becomes five
separate records and baselines coordinated in the same user task. Measure them, display every required
boundary default in one approval batch, then process all approved records without asking which comes first.

### 3 — Read the manifest before running anything

The gates are whatever this repository declares — not a remembered list. Read `package.json` and find
the scripts that exist: lint, typecheck, build, test. A repository with no `typecheck` script is not
failing a typecheck; it has none, and that is a finding for the plan rather than a command to invent.

In strict-fix mode, inventory every first-party Prettier integration before running it: direct
dependencies matching `prettier`, `eslint-plugin-prettier`, `eslint-config-prettier` or
`prettier-plugin-*`; `.prettierignore`, `.prettierrc*` and `prettier.config.*`; manifest scripts,
lint-staged, hooks, CI workflows and editor settings that invoke or select Prettier. This exact inventory
is the removal boundary and the proof target.

**Do not run end-to-end suites** unless the request asked for them by name.

### 4 — Check the machine before trusting a single count

The same manifest answers this: does the checkout **install** the published lint packages, and does its
ESLint configuration import them **by package name**? Three answers, three different runs:

| Answer | What the counts mean | What this skill does |
|---|---|---|
| installed, imported by name | the counts are real | measure and repair as normal |
| the packages are absent | zero lint errors means nothing was checked | install them, in its own commit, then measure |
| a copy is vendored in the checkout, imported by a relative path | the counts are against a private snapshot of the law | install the packages, delete the copy, re-point the config to the package name — one commit, no rule rewritten |

The repository still owns its **configuration**: which globs each rule applies to is a local decision and
this skill does not touch it. What it refuses is a local *rule*.

Install with the lockfile-respecting command the repository declares. An install that fails stops the run
and is reported: a broken lock is a finding for its owner, not something to route around.

An install writes a manifest and a lockfile, so it is the run's **first change** — which means the baseline
commit of step 8 is taken here, before it, not later. A baseline taken after the install cannot show what
the install did.

**A green count taken before this check is not evidence.** So it is taken after, never before.

### 5 — Measure, and write the numbers down

Run each gate that exists, in the cheapest order — format check, lint, typecheck, build, unit tests —
and record the exact counts before touching anything: errors, warnings, failing suites, and the files
they land in.

In strict-fix mode, a Prettier-backed format command is measured once as legacy evidence. After the
strict-fix pass, the same script name must either invoke ESLint or be removed when it duplicated the lint
gate; it is never kept merely so the final proof can rerun Prettier.

This is the number the run will be judged against. A repair with no before-count is a claim.

For a frontend run, read `@file-layout` and inventory every component root in the resolved checkout,
including empty directories. Record each retired tier path, file count, tracked-file count and every
import or export that reaches it. The installed `no-shell-tier` rule proves files under
`components/shells` are rejected; this directory inventory covers the empty case the rule cannot see.

### 6 — Classify every finding, because they do not have one fix

| Class | What it is | How it is repaired |
|---|---|---|
| `format` | whitespace, quotes, import order — the formatter's opinion | one mechanical pass, no reading required |
| `mechanical` | a fix the tool can make safely and the reader can verify by eye | autofix, then read the diff |
| `defect` | real broken behaviour, a wrong type, a dead import, a missing case | repaired by hand, one at a time |
| `index` | a contract `why` that describes something instead of stating when you would need it, so no lookup can find it | rewritten in its own pass, reasons only |
| `machine` | the published lint packages are absent, or a copy of them is vendored into the checkout | installed from the registry, in its own commit — never authored |
| `strict-fix` | Prettier is directly installed or selected anywhere in first-party repository configuration | remove the full integration and make ESLint the sole formatter, in one mechanical pass |
| `retired-structure` | a directory, file, import or export still uses a tier the accepted layout vocabulary removed | empty paths are removed; live code is migrated to its accepted tier with references updated |
| `remnant` | a `.claude/` inside a target checkout holding nothing but leftovers from an older tree | removed in its own pass, after approval — or returned, by the test in step 12 |
| `decision` | the code is deliberate and the rule refuses it, or the rule and canon disagree | **returned to the owner** — the fix is a decision, not an edit |

A `decision` misfiled as a `defect` is how a rule gets bent to match the code. A `defect` misfiled as a
`decision` is how real breakage gets waved through as a matter of taste.

### 7 — Review: the counts, the classification, the boundary

Present the before-counts, every class with how many findings it holds, the exact file list, and
what the run will **not** touch. Batch every approval into one round.

For strict fix, the displayed boundary includes every inventoried Prettier integration plus the manifest
and lockfile. It also states whether each affected format script is repointed to ESLint or removed as a
duplicate. A later Prettier reference outside that displayed set is a boundary expansion, not a reason to
leave a partial removal behind.

`OK` approves every displayed default and the exact shown boundary; take the baseline and begin Apply
immediately. It does not cover another checkout or role that was never shown, and the run must not ask the
owner to repeat `OK`.

Where a `decision` blocks a whole file, say so: it is better to hand back a file with a named question
than to return a repository that is green because one file was rewritten to somebody else's taste.

### 8 — Baseline, then repair in separated passes

Commit the current state and record `Baseline commit: <sha>` — before the first change, never from a
half-edited tree. If step 4 installed the machine, that baseline was already taken there and is the same
one cited here; a run has one baseline, not one per pass.

Then, in this order, each pass its own commit:

1. **machine** — install the published canon and remove any vendored rule copy before trusting counts.
2. **strict fix**, when requested — remove every first-party Prettier integration, repoint retained format
   entrypoints to ESLint, regenerate the lockfile, and prove the inventory is empty.
3. **format** — ESLint's formatting fixes, alone. Nothing else in the commit.
4. **mechanical** — autofix, then read every hunk. An autofix that changed behaviour is a defect the
   tool introduced, and it is caught here or not at all.
5. **defects** — by hand, smallest first, re-running the gate that reported each one.
6. **retired structure** — remove empty forbidden tiers; migrate their live files without deleting behaviour.
7. **`why`** — the contract index, because it is a pass no gate can judge and it must not be mistaken for
   one of the three above.
8. **remnant** — last. Alone in its commit, so a
   deletion is never read as part of a fix.

A pass that would need to weaken a gate stops and returns the boundary. Unrelated work in the tree is
preserved: this skill repairs what the gates named and nothing adjacent that caught the eye.

### 9 — Fan out the defect pass, and only that pass

Ten agents, and the assignment is **by file, never by rule**. Two agents holding one file will overwrite
each other's repair and the second one wins silently; two agents holding one rule across many files are
the same collision spread thinner.

**Four passes are never fanned out.** Machine adoption, strict fix, formatting and autofix are single
whole-repository changes — running them concurrently produces writers on the same manifest, lockfile and
file set. Only the `defect` pass, where each finding is a separate hand repair in a separate file, is
worth ten agents.

Retired-structure migration is also single-writer: moving a component changes its folder, export and all
imports as one graph. Splitting those writes creates a half-moved component no gate result can explain.

**Whole-repository gates run once, by the coordinator, never per agent.** Build output is shared state:
ten concurrent typechecks or builds in one checkout write the same `dist`, the same cache, the same
incremental info, and the failures they report are each other rather than the code. An agent may run a
**file-scoped** lint on the files it holds; nothing more.

Each agent returns what it repaired, what it refused and why. The coordinator re-measures — an agent's
own claim that its file is clean is not the measurement.

| Runtime | Model |
|---|---|
| Codex | Luna |
| Claude | Sonnet 5 |

That table is the owner's standing choice, not a benchmark result. A repair pass is many small
independent edits against a gate that answers yes or no, which is the shape a mid-tier model does well
and the reason the fan-out is worth its cost at all.

### 10 — The `why` pass: make the index findable again

The last pass, and the only one no gate can judge. A contract entry's `why` is the **index a later lookup
matches on**. An entry nobody can find by need is an entry that gets written a second time, so a stale
index is real staleness even while every gate is green.

**A recorded miss outranks a count.** Read the recorded misses first: each carries the need a real lookup
could not answer. Those needs are this pass's **first** work. A count says 298 reasons look wrong; a miss
says *this* reason failed a real surface on a real day. Repair what missed, then work the count.

**`why` does not describe the business. It says when you would reach for this.**

| Wrong — describes | Right — states the need |
|---|---|
| "A breakdown grade or weak topic is read by comparing its name with one persisted value" | "if you need a row comparing a name with one stored value on a shared baseline" |
| "Each persisted result figure is one labelled measurement" | "if you need one figure under a quiet label, repeating for several figures" |
| "A two-part row" | *(says nothing a lookup can match — it names a shape, not a need)* |

Measured once on a real contract: 76 reasons, **none** written as a need. All 76 describe something.

Classify every entry against **its own key**, because the width of the two must agree:

| Finding | Means | Owner |
|---|---|---|
| `why` narrower than the key | the key is already general, the reason still names a feature | **this pass** |
| `why` vague | it names a shape, not a need | **this pass** |
| `why` wider than the key | the reason is general, the name is not | **layout**, as a `generalize` verdict |
| both narrow, deliberately | a genuinely specific reason on a specific key | nobody — leave it |

Route-scoped page keys are excluded by construction: one route's reason belongs to one route.

Three rules this pass obeys:

- **Reasons only.** The diff contains `why` lines and nothing else. A key, a class, a child or a `host`
  appearing in it means the pass exceeded itself — revert, do not keep the good parts.
- **Never wider than the entry can hold.** A reason may not promise more than the children it fixes, and
  never more than its key: a general reason on a feature-named key makes lookups match and then hand the
  reader the wrong entry.
- **Batch by family, not alphabetically.** Eight `profile-*` reasons read together can be judged against
  each other; the same eight scattered through ninety-five rows cannot be judged at all.

Proof is three things, since no gate exists: the diff touches only `why`, the contract still typechecks
and builds, and the classification counts are printed before and after. A reason invented here is worse
than a narrow one — it will match lookups it should not — so an entry whose need cannot be read off what
it actually fixes is **asked about, not guessed**.

### 11 — The retired-structure pass: remove `shells` as a tier

Run this pass from the accepted vocabulary, not from whether lint happened to emit a finding. For every
`components/shells` directory under an in-scope component root:

1. Count files recursively and ask Git which are tracked.
2. If the count is zero, remove the empty directory tree and record the absolute path plus before/after
   counts. `git diff` is correctly empty because Git never owned the directory; the result still records
   the filesystem removal.
3. If files exist, preserve their behaviour and history. Resolve each component's actual identity from
   its exports, mechanic and call sites, then move it to the tier `@file-layout` requires. A fixed vendor
   mechanic becomes a named branch; update the folder/export name, imports, barrel exports, tests and
   contract references together.
4. Do not delete a live component to make the tier disappear. If evidence cannot settle its destination
   or semantic name, return that component as a `decision`; continue with the paths whose destination is
   settled and put the unresolved path under `NEED APPROVALS` with a default if evidence supports one.

The machine pass comes first. A consumer using a vendored mirror or missing `no-shell-tier` installs the
published canon and removes the mirror; this pass never patches a consumer's private lint-rule copy.

Proof is a recursive directory search returning no `components/shells`, a source search returning no
imports through `/shells/`, the installed `no-shell-tier` gate, and the repository's original gates.

### 12 — The remnant pass: one Source, so a second `.claude` is a corpse or a question

**There is one Source and one trust tree. A project is a folder inside it —
`<Source>/.worktrees/<project>/`, `<Source>/.workspace/<project>/` — never a tree of its own.** So a
`.claude/` found inside a target checkout is not a second tree by design; it is what an older tree left
when its enforcement code moved out, and the only harm it does is to the next reader, who sees the name
and concludes the project owns rules of its own. That is exactly the wrong conclusion, and no gate in any
repository will ever report it.

This pass runs **only on the role targets the route resolved**, never on a path the run went looking for.

Two questions decide it, and both must answer yes before anything is deleted:

| Question | Yes | No |
|---|---|---|
| Is every file in it untracked by that repository? | it is nobody's committed configuration | **return it** — a tracked file is that repo's own state, and removing it edits a product's history |
| Does it hold only empty directories and files no law here names? | it is a corpse | **return it** — a populated `.claude` may be a Source, and deleting a Source is unrecoverable |

A tracked file is the common case and it is a `decision`, not a defect: `launch.json` is an editor
configuration the product's own team may run every day. This skill does not delete other people's
committed files to tidy a name.

**Empty is proven by counting, not by listing.** A directory that looks empty because the listing was
shallow is a directory this pass must refuse. Count files recursively and print the number.

Proof is the count before, the approval, and the count after. The removal is its own commit, its message
names what the directory held, and the result says `removed` rather than `repaired` — a deletion recorded
as a repair is a deletion nobody can review.

Measured once, on two checkouts carrying the same leftover: one had it ignored, so nothing was tracked;
the other had the same editor configuration **committed**. Identical directories, opposite verdicts — which
is why the test is "untracked", not "looks empty".

### 13 — Prove it with the same commands

Re-run the exact gates from step 5 and print before-and-after side by side. Zero errors means zero — not
zero after a disable, not zero because a rule was dropped, not zero because a test was skipped.

Strict fix adds four proofs: no tracked Prettier config or ignore file; no direct Prettier-family package;
no first-party script, hook, lint-staged entry, CI step or editor setting invokes or selects Prettier; and
every retained format command resolves to ESLint and passes. Search the tracked tree case-insensitively,
then inspect any surviving lockfile-only match with the package manager's dependency-path command. A
transitive match is reported; a first-party match reopens the strict-fix pass.

If a gate cannot pass without a decision the owner has not made, ask once under `### NEED APPROVALS` with
the remaining count, evidence-backed default and exact scope. Never weaken the gate.

### 14 — Close the phase

Close with the applied revision, baseline commit, tracked diff and before/after counts in concise prose.

## Stops

- The route is stale → name the field that failed and end this run.
- A gate can only pass by silencing a finding → stop; that is the one thing this skill exists to refuse.
- A lint rule contradicts an explicit accepted canon → classify the machine as stale and repair its
  adoption; stop only when the canon itself does not settle the behaviour.
- The tree is already dirty with unrelated work → stop; a baseline taken from mixed state proves nothing
  and the diff will not be readable.
- A `.claude/` in a target checkout holds tracked files or real content → stop the remnant pass and return
  it; one of those is somebody's committed configuration and the other may be a Source.
- A gate is measured against a rule copied into the checkout → stop measuring; the machine pass comes first,
  and a count taken against a private copy of the law is not evidence.
- Strict fix still has a first-party Prettier reference → do not close; the pass is incomplete even when
  lint, typecheck and build are green.
- A run is handed more than one project or role → create one record per declared target and coordinate
  them; ask only for an undisclosed boundary, never for ordering.
- A repository declares no gates at all → stop; there is nothing to measure, and inventing commands
  measures somebody else's project.

## OUTPUT

State before/after counts, material paths by pass and proof in concise prose. Before another batch, name
remaining findings as work owed and repair them in the same turn. The turn may end only with `own = 0`
or while waiting under `### NEED APPROVALS` for a genuine decision or boundary expansion.
