---
name: starci-fe-contract
description: Runs the front end's DOM contract — the rendered-tree runner that measures computed style after every story, plus the source-reading gates — against the app the workspace context names, and reads the result back as a diagnosis rather than a list of failures. Reach for it whenever a change needs proving or a red run needs explaining: "run the contract", "chạy gate frontend", "kiểm tra lại storybook trước khi merge", "why is this story failing the audit", "check-seams says my gap is off-scale but it looks fine", "unregistered token", "the responsive sweep found a breakpoint I did not write", "is this branch clean". Also worth running before touching an unfamiliar component, so the drift you are about to inherit is visible first. Not for writing or repairing the component — a confirmed finding is handed to the apply skill that owns that surface; not for registering where the front end lives (use starci-setup-workspace-fe); and not for judging whether a component is the right component at all, which is a design question the runner has no opinion about.
---

# The DOM contract

Every gate in this system reads source, and reading source is how a layout rule gets lied to: a
regular expression cannot tell a string literal from a render. So the layout rules are checked a
second way, by something that never reads text at all — it reads the tree the browser produced, with
real CSS and real computed style, and measures it.

That gives two lanes with a clean division of labour. *What does this file say* is a source gate.
*What did the browser do* is the runner. The reasoning behind the split, the five audits, and the
things each audit explicitly cannot prove are `canon/fe/enforce/testing.md`; this skill is how the two lanes
are actually run and how a red result is read.

The sentence to hold while reading one: **a red result is a seam that declares a principle and
computes to the wrong pixel.** It is rarely a broken build. It is almost always a claim and a
measurement that disagree, and the interesting question is which of the two is wrong.

## 1. Resolve the roots

```bash
node .claude/scripts/read-workspace-context.mjs fe.path
node .claude/scripts/read-workspace-context.mjs fe.design_system
node .claude/scripts/read-workspace-context.mjs fe.storybook_url
```

A missing context exits non-zero and prints the command that fixes it. Honour that exit code:
continuing with an empty string builds a path that fails somewhere far from the cause. Registering a
source is `skills/starci-setup-workspace-fe`.

Everything below runs with the front-end root as the working directory. The gates read
`process.cwd()` and walk the design-system and application component trees from there, so a gate run
from the wrong folder reports a clean zero — the most misleading result the system can produce, and
the reason the roots are resolved first rather than assumed.

## 2. Run the source gates

The gates live in `patterns/fe/gates/`, one per rule that can be decided by reading a file. Each
exits non-zero on a violation and prints the file and line; most also take `--json` for a
machine-readable list, and a few take `--report` to enumerate without failing.

Run the whole folder rather than the one gate you expect to fail. Gates are cheap, and the finding
that explains a confusing runner failure is regularly in a gate nobody thought to run: a component
with no story at all, an import that crosses a tier boundary, a presentational file that still names
a retired prop.

Which questions belong to this lane, and which gate answers each, is listed in `canon/fe/enforce/testing.md`
under the source-reading section — import direction, story existence and parity, story shape,
declarations no render exposes.

## 3. Run the rendered-tree runner

The runner is `patterns/fe/runner/test-runner.ts`, wired as the story test-runner's configuration.
It needs a Storybook actually serving at `fe.storybook_url`, because it drives a real browser: each
story is visited, the tree is read, and five audits run against it.

It resolves its vocabulary from the registry `patterns/fe/patterns.mjs` rather than holding a table
of its own. That is deliberate and worth knowing before you debug a wall of red: a change to the
registry makes the audits go out of date **loudly**, failing everywhere at once, instead of drifting
quietly. A run that fails on nearly every story usually means the registry moved, not that the app
regressed overnight — check the registry's history before opening a single component.

Information findings are printed alongside a failure, or on demand through the verbose environment
switch named in `canon/fe/enforce/testing.md`. Reach for it when a story passes and you still do not believe
it: the concepts the DOM cannot expose, and the truncation that never fired, are recorded there
rather than counted as passes.

## 4. Read the red

A finding carries the chain of tiered ancestors from the root down to the offending node, so start
by reading the chain rather than the message — a story that renders more than one thing still points
at exactly which one. Then take the finding by kind.

**An unregistered token.** The element claims a named decision the registry cannot resolve. This is
a hard failure on its own and it is nearly always a typo, because a mistyped token renders perfectly
and audits clean everywhere else. Fix the spelling. Only when the concept genuinely does not exist
yet does the fix move to the registry, and adding one there is a canon change, not a test change.

**A declared pattern that computes to the wrong value.** The strong finding, and the one the concept
layer exists for. Two questions, in this order. Is the *claim* wrong — the element declares a seam
between groups but is actually separating fields inside one group? Then the token is wrong and the
pixels were right. Is the *pixel* wrong — the claim describes the design correctly but the class
resolves to another rung? Then the class is wrong. Never settle it by changing whichever is easier
to reach; the token is a statement about meaning, and editing it to match a number turns the
document into a transcript of the code.

**A gap that is off the scale.** Weaker than the one above, and it catches what no source regex
sees: an inline style, a third-party class, a value computed at runtime. When the class in the file
looks correct and the computed value is not, the value is arriving from somewhere the file does not
mention. A frame with nothing to space apart is not a finding at all.

**A tier nesting violation.** Read it against `canon/fe/enforce/tiers/architecture.md` before touching anything.
Two of these are especially worth recognising: a half-written identity marker, which reads as
compliance in a diff and is why the pairing is checked at all; and anything found beneath an atom,
which is the one case where *contains* and *imports* are the same fact, so the finding is real
wherever in the tree it appeared.

**A truncation class that never fired.** Three outcomes, one bug. The element overflowing its own
box is the class working. The element not overflowing while its nearest flex or grid ancestor does
is the finding — a label that never got a bounded box to truncate inside, so the row grew instead,
which is the missing minimum-width guard on a flex child. Neither overflowing is a story whose
content is simply short, and it is recorded as information, never as a pass.

**A responsive switch at an unnamed width.** The sweep reports the pixel where the shape changed. A
change at a width that is real and is not one of the named container breakpoints is either a
content-driven threshold — one that moves with this story's text, font and translation, which is why
it lands nowhere near a named edge — or a viewport breakpoint written where a container query
belongs. The sweep cannot tell you a frame switched at the *wrong* named width; that half needs the
prop the story passed, and the runner holds only the DOM half.

## 5. What green does not prove

A clean run means no audit observed a violation. It does not mean the component is right. Nothing
here judges whether the component is the correct component for the data, whether the copy is
sensible, or whether the pending state mirrors the loaded one in any way an audit can measure — that
last one is `skills/starci-fe-skeleton-apply`.

The runner also asserts nothing about a frame's slot contents, on purpose, because a rendered tree
cannot distinguish content a frame imported from content a caller handed it. Reading that silence as
approval is the commonest over-claim made from a green run.

## When a gate and the canon disagree

Read the gate's output before editing the rule. A failing check is a question, not a verdict, and
more than once in this system the check has been the thing that was wrong — matching an ellipsis as
a path, reading a substring out of a longer path, demanding a case the real output never used. If
the gate is wrong, fix the gate; if the canon is stale, re-ground and re-anchor it the way
`canon/HOW-TO-WRITE.md` requires; and if the source is simply wrong, the fix belongs to the apply
skill that owns that surface, not to this one.

Record anything left unfixed rather than remembering it, through `skills/starci-record-debt`.

## Files

| Path | Holds |
|---|---|
| `canon/fe/enforce/testing.md` | why the two lanes exist, the five audits, and what each cannot prove |
| `patterns/fe/runner/test-runner.ts` | the rendered-tree audit, run after every story |
| `patterns/fe/patterns.mjs` | the registry the runner resolves every token against |
| `patterns/fe/gates/` | the source-reading gates, one per rule a file can answer |
| `canon/fe/enforce/spacing/overview.md` | what each named seam and inset means, beside its value |
| `canon/fe/enforce/tiers/architecture.md` | the tiers, the import direction, and emitted identity |
| `README.md` | why this skill is shaped the way it is |
| `test.mjs` | run after any change: `node .claude/skills/starci-fe-contract/test.mjs` |
