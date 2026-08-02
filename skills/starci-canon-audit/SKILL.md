---
name: starci-canon-audit
description: Audits the whole canon under `canon/` — front end and back end together — for the six ways a rule set decays, and reports what it finds: cross-references pointing at files that moved, a rule filed on the wrong shelf, prose that no longer describes the source it claims to describe — a back-end rule included, whose anchor has gone dead, whose count no longer recounts, or whose idiom the code has quietly stopped following — two files stating the same rule, an area of the source no rule covers, and an index whose tables no longer match the folder beside it. Use this skill when the rules themselves are the subject rather than the code: "audit the canon", "check the rules are still true", "is anything in canon stale", "we just merged a big refactor, re-ground the docs", "why do two files disagree about tiers", "is canon/be still true", "check the be rules against the source", "does this rule still describe the code", "re-ground the exceptions doc", "soi lại canon", "soi patterns be", "dọn tài liệu", "kiểm tra rules còn đúng không", "dong bo canon backend voi code", "canon be con dung khong", "the docs sent me to a file that isn't there". Reach for it after any large move in the source — a tier renamed, a folder split, stories relocated, a back-end module renamed — because that is when a correct rule quietly stops being findable. Not for writing or changing a rule (that is `canon/HOW-TO-WRITE.md`), not for changing application code, and not a substitute for `scripts/verify.mjs`, which this skill runs as its first step rather than replaces.
---

# Auditing the canon

A canon file earns its authority by being grounded: it names a real file and quotes a real count.
That is also exactly what rots. The source moves, the document does not, and nothing says so — so
the failure mode of a rule set is never that the rules were written badly. It is that they were
written truly, about a tree that has since changed shape, and every reader after that is quoting
evidence nobody can reproduce.

Decay is quiet in a second way too. A rule filed on the wrong shelf is still correct, still
grounded, and still unread, because the person who needed it looked where it should have been. A
correct rule nobody finds costs the same as a wrong one.

This skill exists to make both visible on purpose, on a schedule, rather than the next time
someone happens to trip over it.

## What it reads, and what it never touches

It reads the canon tree — `canon/fe/`, `canon/be/`, `canon/INDEX.md`, `canon/HOW-TO-WRITE.md` — and
it reads the real source those files describe, to check them against it. The source is resolved,
never written down:

```bash
node .claude/scripts/workspace/read-workspace-context.mjs fe.path
node .claude/scripts/workspace/read-workspace-context.mjs fe.design_system
node .claude/scripts/workspace/read-workspace-context.mjs be.path
```

A missing context exits non-zero and prints the command that fixes it. Honour that exit code. An
audit run against an unregistered source finds nothing and reports nothing, which reads exactly
like a clean bill of health and is the worst possible outcome of this skill.

Application code is read and never edited. The subject of this audit is the canon.

## The six ways a canon decays

| Axis | What it looks like | How it is decided |
|---|---|---|
| dead cross-reference | a canon file sends a reader to `canon/…`, `patterns/…` or `design/…` that is not there | mechanically — the path either resolves or it does not |
| wrong shelf | a rule about how code is spelled sitting in `canon/fe/enforce/tiers/architecture.md`; a `.md` that makes an argument sitting under `patterns/` | by reading, against the division stated in `canon/INDEX.md` |
| stale against source | a rule describing a tier, component, entity, route or token that no longer exists under that name | grep the real tree; never from memory |
| duplication | two canon files stating the same rule, so a later edit fixes one of them | by reading |
| coverage gap | a part of the source that no rule covers at all | grep the real tree, plus the coverage gates |
| index drift | `canon/INDEX.md` lists files the folder does not hold, or omits ones it does | mechanically — compare the table to the listing |

Two of these carry a trap worth stating outright.

**Duplication between `canon/` and `patterns/` is not duplication.** It is the design: a rule that
lives only in prose decays quietly, and one that lives only in a script gets routed around by
people who do not understand it, so each rule lives in both places once and
`scripts/gates/check-canon-sync.mjs` holds the two halves to the same numbers. Reporting that
as a merge candidate is a finding that would break the set if acted on.

**Staleness has a layer no machine sees.** `scripts/verify.mjs` catches an anchor pointing at a
path that no longer exists, and recounts a claim of the form "N files mention `X`". It cannot
catch a rule whose named path still exists but now holds something else, or a rule about a concept
that was renamed everywhere except in the prose. That layer is why a human-grade reading pass
exists at all, and why every finding on this axis has to name the source line that contradicts the
canon line.

## Re-grounding `canon/be/` is inside this, not a separate job

A rule under `canon/be/` rots the same three ways as any other rule here, and none of the three need
a back-end-only pass to catch: a dead anchor — a rule naming a `src/` file, a module, or a thrown
built-in that has since moved or been renamed; a count that no longer recounts — a `N files` claim,
or one written in words, such as `exceptions.md` claiming zero `throw new Error` survives in running
code; and an idiom the code has quietly stopped following — the anchor still resolves, the file is
still there, and it no longer does what the rule says. The first two are `node .claude/scripts/verify.mjs be`,
already step 1b below. The third is the reading pass in step 2, run against `canon/be/enforce/authoring/`
and `canon/be/explore/system-design/` the same as `canon/fe/` gets read against its own shelves. There
is no separate back-end audit to reach for first — asking whether `canon/be/` still describes the
backend is this same procedure, framed on one role instead of both.

## Procedure

**1. Set the frame and run the machines first.** The mechanical pass is cheap and certain, so it
goes first and its output becomes the spine of the report; the reading pass then explains what the
machines could not decide rather than rediscovering what they already found.

1a. Resolve `fe.path`, `fe.design_system` and `be.path` as above. If either role is unregistered,
stop and say so — `starci-setup-workspace-fe` and `starci-setup-workspace-be` fix it in one
command. A partial audit presented as a whole one is worse than no audit.

1b. `node .claude/scripts/verify.mjs` — anchors and counts, per role. A missing anchor is a
failure: the rule points at nothing. A drifted count is a warning: the rule is probably still true
and only its evidence is stale. Keep that distinction in the report; collapsing them makes the
whole list feel like noise.

1c. Sweep the cross-references and the index by hand or by script: every `canon/…`, `patterns/…`
and `design/…` path named inside the canon must resolve, and the tables in `canon/INDEX.md` must
match what `canon/fe/`, `canon/fe/enforce/authoring/` and `canon/be/*/` actually hold.

1d. Where a coverage question is already machine-decidable, let the machine decide it rather than
arguing it in prose: `scripts/gates/check-story-coverage.mjs` for the Storybook-first law,
`scripts/gates/check-pattern-coverage.mjs` and `scripts/gates/check-doc-parity.mjs` for
rules that are supposed to have a written counterpart.

**2. Read one shelf at a time, grounded.** Take the shelves separately — `canon/fe/` top level,
`canon/fe/enforce/authoring/`, `canon/be/enforce/authoring/`, `canon/be/explore/system-design/` — and
for each, read the files against the real tree. Wrong-shelf, semantic staleness, duplication and
coverage gaps are decided here.

The standard for a finding is fixed: it names the canon file and line, and it names the source
file and line that supports the claim. A statement that something "seems outdated" with no source
line behind it is not a finding; record it as needing verification and say plainly that it was not
settled. The canon's own test for a rule — can you point at the code this describes, and how many
places do it that way — applies with equal force to a claim that a rule is wrong.

**3. Rank, then report.** Order by what a reader loses, not by how many of each kind there are:

1. a rule that points at nothing, or two rules that contradict each other — the reader is misled
2. a rule on the wrong shelf, or missing from the index — the reader never arrives
3. a stale count, a duplicate, a gap — the reader is served, slightly worse

Each entry: the canon path and line, the axis, what is wrong in one sentence, the source line that
proves it, and the smallest fix that would settle it.

## This skill reports; it does not rewrite

An audit that edits while it reads loses the only baseline it had. Halfway through, some of the
findings describe files as they were and some as they now are, and nobody — including the agent
holding the list — can tell which. So the default is a report, and the report is the deliverable.

When the person who asked approves a fix, work in order of how much judgement it takes:

- **Mechanical first.** Move a mis-shelved file and update every reference that named it. Delete or
  re-point a dead link. Correct a count in an index. These have one right answer.
- **Verbatim merges next.** Two files saying the same thing in the same words collapse into one,
  with a reference left where the deleted one stood.
- **Rewriting and splitting last, one file at a time.** This is where a well-meant paraphrase
  invents a rule nobody agreed to. Change the rule, its anchor, and its date together, as
  `canon/HOW-TO-WRITE.md` requires, and re-run `node .claude/scripts/verify.mjs` after each one
  rather than at the end.

Debt that is found and consciously not paid belongs in the ledger, not in the report only —
`starci-record-debt` exists so a deliberate deferral survives the session that decided it.

## Storybook-first is one of the things audited

No component reaches the app that was never a component and a story in the design-system folder
first. The reasoning is in `canon/fe/enforce/tiers/architecture.md`; the enforcement is
`scripts/gates/check-story-coverage.mjs`. On the coverage axis this cuts both ways, and both
are findings: a component in the app with no story behind it, and a tier or a pattern that the
design-system folder now carries with no rule in `canon/fe/` describing when to reach for it.

## Common mistakes

- **Reading before running.** The reading pass then spends its attention rediscovering the dead
  links `scripts/verify.mjs` would have listed in two seconds, and misses the semantic staleness
  only a reader can catch.
- **Declaring staleness from memory.** The rule is measured against the tree in front of you, not
  against what the tree looked like in an earlier conversation.
- **Reporting a canon rule and its gate as duplicates.** See above; that pair is deliberate, and
  `scripts/gates/check-canon-sync.mjs` is what keeps them equal.
- **Treating a failing gate as a verdict.** A failing check is a question. More than once the check
  has been the thing that was wrong — it matched an ellipsis as a path, and it read an inner
  `src/…` out of a longer path. Read its output before editing the rule it accuses.
- **Auditing with no source registered.** `verify.mjs` skips that role and counts a failure; a
  reader skimming the summary sees a short list and concludes the canon is healthy.
- **Deleting a rule because it is unenforced.** Deleting is fine and `canon/HOW-TO-WRITE.md`
  encourages it — but the rules worth keeping are precisely the ones no gate can catch, so
  "no gate covers this" is an argument for keeping it, not against.
- **Counting `*.spec.ts` as running code when re-grounding `canon/be/`.** A spec deliberately holds
  the shape a rule forbids elsewhere — a bare `Error`, an `as unknown as` — and counting it reports
  a clean module as broken.

## Files

| Path | What it is |
|---|---|
| `canon/INDEX.md` | the map being audited, and the stated division between prose and machinery |
| `canon/HOW-TO-WRITE.md` | the rules this audit enforces: grounding, anchors with dates, two sources before a general rule |
| `scripts/verify.mjs` | the mechanical half — anchors and counts, per role |
| `canon/fe/explore/registry.mjs` · `scripts/runner/test-runner.ts` | the registry and the rendered-tree runner a canon number must agree with |
| `scripts/gates/check-canon-sync.mjs` | holds the prose and the registry to the same values |
| `canon/fe/` · `canon/fe/explore/component/` | the longer material the canon was consolidated from, and the right place to argue a boundary rather than apply one |
| `README.md` | why this skill is shaped the way it is |
| `test.mjs` | run after any change: `node .claude/skills/starci-canon-audit/test.mjs` |
