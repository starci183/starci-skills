---
name: starci-be-patterns-audit
description: Re-grounds the back-end canon against the backend source it claims to describe — dead anchors, counts that no longer recount, and rules whose file still exists but whose idiom the code has quietly stopped following — then records what it found so the next run reads only what changed since the last one. Use this skill whenever the back-end rules need to be trusted or are suspected of having gone stale: "audit the backend canon", "is canon/be still true", "check the be rules against the source", "does this rule still describe the code", "re-ground the exceptions doc", "soi patterns be", "dong bo canon backend voi code", "canon be con dung khong", and before leaning on a back-end rule in a review or a generated module. Reach for it also after a large backend refactor, when folders moved and nothing announced it. Not for changing application code — this skill reads the backend and never writes it; not for the front-end canon, whose lane is the FE audit and the gates under patterns/fe/; and not for recording a deferral, which is starci-record-debt.
---

# Auditing the back-end canon

A rule in `canon/be/` earns its authority by being grounded. It names the real file it was read
from, and often a real count: how many places spell it that way, how many exceptions survive. That
grounding is exactly what rots. A module is renamed, a thrown built-in moves out of `features/mock`,
an idiom recorded in July stops being how the tenth module spells it — and none of it makes a
sound. The document still reads as authoritative, and a reader quoting it is quoting a claim nobody
can reproduce.

Half of that decay a machine can see. `patterns/verify.mjs` walks every `.md` under `canon/be/`,
resolves each path the prose names against the registered backend, and recounts every `N files`
claim that has a symbol beside it. Run it and you learn which anchors are dead.

The other half only a reader catches, and it is the more common one: the anchor resolves, the file
is still there, and the file no longer does what the rule says it does. That is what this skill is
for. It is the judgement pass around the mechanical one, run against the backend's own git history
so that an audit carried across many sessions never rescans a tree that has not moved.

One direction of authority decides every finding. **When a rule and the source disagree, the source
wins and the rule is what gets re-grounded.** The canon records how the backend already spells
things; it is not a wish list, and a rule losing an argument with ten real modules is a rule that
went stale, not ten modules that went wrong. `canon/HOW-TO-WRITE.md` is the law here and this skill
does not restate it — read it before changing a single rule.

## What rots, and which half sees it

| Failure | How it reads | What catches it |
|---|---|---|
| the anchor is gone | the rule names a path that no longer exists in the source | `patterns/verify.mjs`, as FAIL |
| the count drifted | a `N files` claim recounts to a different number | the same run, as WARN — but only when a backticked symbol sits on that line |
| the count is written in words | `contracts/exceptions.md` says real running code contains **zero** `throw new Error`; `conventions/config-and-env.md` says `process.env` is read in one file with three named exceptions | nothing mechanical. A person recounts these |
| the idiom moved | the anchor resolves and the file no longer does what the rule describes | nothing. A person reads the file |
| the rule became machine-caught | eslint or `tsc` now rejects what the prose forbids | nothing. It should be deleted, not audited |

That last row is a deletion, not a finding. A prohibition the linter already enforces costs a reader
attention and buys nothing; `canon/HOW-TO-WRITE.md` gives the measurement behind that and the licence
to delete freely.

## Quick start

```bash
node .claude/scripts/register-workspace-source.mjs --check
node .claude/patterns/verify.mjs be

BE=$(node .claude/scripts/read-workspace-context.mjs be.path)
cat "$BE/.artifacts/states/patterns-audit-be.json"
```

Never write the backend's location into anything. It is a per-machine answer that
`starci-setup-workspace-be` already owns, and a remembered path is right on one machine and silently
wrong on the next.

## The audit, in order

**1. Confirm the source before reading a word of it.** `register-workspace-source.mjs --check`
costs nothing. A branch change is a warning rather than a failure, but read it: auditing prose
against a branch where half the modules have not landed yet produces confident nonsense in both
directions.

**2. Run the mechanical half first, and clear it first.** `node .claude/patterns/verify.mjs be`
exits 1 on a dead anchor. Fix those before reading anything downstream — every later step reads
these same documents, and a rule pointing at a deleted folder cannot be judged, only re-grounded or
removed.

**3. Narrow to what actually changed.**

- *3a.* Read `lastAuditCommit` from the state file. With no state, this is the first pass: take the
  whole of `canon/be/` against the whole tree, and expect it to be long.
- *3b.* With a state, ask git what moved:
  `git -C "$BE" diff --name-only <lastAuditCommit> HEAD -- src`. Keep the `.ts` files; drop
  `*.spec.ts` unless the audit is deliberately about how specs are spelled. Nothing changed means
  the answer is that the canon still describes the tree, and the run is over.

**4. Judge the changed files against the shelf that claims them.** `canon/be/INDEX.md` splits the
rules by the question they answer, and a changed file usually falls under one shelf, not all three:
`canon/be/modules/modules-and-di.md` and `canon/be/modules/database-and-entities.md` for how a
module and its entities are put together; `canon/be/contracts/api-surface.md`,
`canon/be/contracts/validation.md`, `canon/be/contracts/exceptions.md` and
`canon/be/contracts/async-and-messaging.md` for what the code promises outward; and
`canon/be/conventions/type-safety.md`, `canon/be/conventions/comments.md`,
`canon/be/conventions/imports-and-format.md`, `canon/be/conventions/config-and-env.md` for how the
resulting lines are spelled. Read the shelf the change touches, not the set.

For each disagreement, write down four things and nothing else: which rule, which file and line, what
the source actually does, and which of the three conclusions in the next section it lands on. Then
re-read the findings carried open from the last run — unrelated work fixes them more often than
anyone expects, and an audit that never closes anything is a list, not a ledger.

**5. Write the state and the log.** Append a dated block to
`$BE/.artifacts/states/patterns-audit-be.md` — what was scanned, what was concluded, what stays open.
Update `$BE/.artifacts/states/patterns-audit-be.json`: `lastAuditCommit` becomes `HEAD`,
`openFindings` becomes what survived. That pair is the whole reason a second run is cheap.

**6. Report. Do not fix on the way past.** The default outcome of this skill is a report, because
every conclusion below is somebody's decision and two of the three are not this skill's to make.

## What a finding may conclude

Three outcomes, and naming which one a finding is matters more than the finding itself.

**The rule went stale.** The source moved, on purpose, and the prose did not follow. Re-ground it:
change the rule, its anchor and its date together, in one edit, the way `canon/HOW-TO-WRITE.md`
requires — an anchor left behind is worse than no anchor. This is the only outcome the skill may act
on directly, and only with approval.

**The code drifted.** One new file spells something the rest of the backend does not. That is a
change to the backend, which is a different act in a different lane with its own verification; this
skill reports it and stops. If the fix is knowingly postponed, it goes in the ledger:
`node .claude/scripts/record-technical-debt.mjs add --role be --why ...`, through
`starci-record-debt`. A finding that lives only in a chat message is a finding that will be
rediscovered by walking into it.

**The rule should not exist.** Either a gate already catches it, or it was never grounded in two
independent places to begin with. One occurrence is an anchor to that case, not a law — say so in
the rule or delete it. When a finding recurs in run after run and is mechanically decidable, the
right answer is to stop auditing it by hand and promote it to a gate, alongside the shape of
`patterns/fe/gates/check-canon-sync.mjs`, which holds the front-end prose and its registry to the
same numbers.

## The state lives in the audited tree

`patterns-audit-be.json` and `patterns-audit-be.md` sit under the backend's own `.artifacts/states/`,
not in this skill set. The state is a claim about that repository — a commit it was last read at, and
findings that name files inside it — so it belongs beside the thing it describes, and it stays
truthful when this skill set is cloned somewhere else. The front-end audit keeps its state in the
front-end tree for the same reason.

```json
{
  "lastAuditCommit": "b59cc9b1...",
  "generatedAt": "2026-08-03",
  "openFindings": [
    { "rule": "exceptions/2", "canonFile": "canon/be/contracts/exceptions.md",
      "source": "src/features/tools/...", "note": "framework built-in still thrown; known debt, not new" }
  ]
}
```

## Boundaries

The backend is read, never written. The state file under `.artifacts/states/` is written every run.
`canon/be/**` is edited only after the person running the audit approves the specific re-grounding,
one rule at a time.

No rule is invented here. This skill measures the canon against the source; a new rule needs two
independent sources and belongs in the canon-writing lane, not in an audit report.

The front end is not in scope, and its central law is enforced elsewhere: no component reaches the
app that was never a component and a story in the design-system folder first — the reasoning sits in
`canon/fe/architecture.md`, the enforcement in `patterns/fe/gates/check-story-coverage.mjs`, and
neither is this skill's business.

## When this runs wide

A first pass over a whole backend is large enough to split. Split it by shelf — one lane for
`canon/be/modules/`, one for `canon/be/contracts/`, one for `canon/be/conventions/` — rather than by
module, so that no two lanes read the same rule and reach different conclusions about it.

Every lane writes a brief to a file before it finishes. A lane that holds its findings in conversation
has produced nothing the closing pass can read, and the closing pass is where the state file is
written and the conclusions are settled. Deciding and scanning are cheap to parallelise; deciding
twice is not.

## Common mistakes

- **Rescanning everything because it is simpler.** It is simpler once. The state exists so that the
  fifth audit costs what the fifth audit's worth of change costs.
- **Reading a WARN as a broken rule.** A drifted count usually means the rule is still true and its
  evidence is old. Recount, update the number and the date, and move on.
- **Fixing the code toward the rule.** The direction of authority runs the other way until a person
  says otherwise. Ten modules disagreeing with one anchored example is evidence about the rule.
- **Promoting one observation to a rule.** The audit sees a single file; a rule needs two
  independent sources.
- **Auditing specs by default.** `*.spec.ts` deliberately holds shapes the canon forbids in running
  code, and counting them is how a clean tree gets reported as broken.
- **Leaving the state unwritten because nothing was fixed.** A run that concluded "still accurate"
  is exactly the run worth recording; it is what makes the next one cheap.

## Files

| Path | What it is |
|---|---|
| `.claude/patterns/verify.mjs` | the mechanical half: anchors and counts |
| `.claude/scripts/read-workspace-context.mjs` | where the backend is, on this machine |
| `.claude/scripts/register-workspace-source.mjs` | `--check`, before trusting that answer |
| `.claude/scripts/record-technical-debt.mjs` | where a deferred finding goes |
| `.claude/canon/be/INDEX.md` | the three shelves, and which question each answers |
| `.claude/canon/HOW-TO-WRITE.md` | how a rule is changed, and when it is deleted |
| `README.md` | why this is shaped the way it is |
| `test.mjs` | run after any change: `node .claude/skills/starci-be-patterns-audit/test.mjs` |

The front-end counterpart audits the other tree and shares nothing but the method. The workspace it
reads from is registered by `starci-setup-workspace-be`.
