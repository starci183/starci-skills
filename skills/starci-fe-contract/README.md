# starci-fe-contract — notes

`SKILL.md` says how to run the contract and how to read a red result. This file says why the skill
is shaped that way and what it deliberately leaves to others. Read it before changing anything here.

## Why a skill, when the runner already runs itself

The runner and the gates are wired into the story test-runner and into the hooks; nobody needs a
document to make them execute. What people need a document for is the ten minutes after a red run,
and that is where a run without help goes wrong in one of two directions.

The first is treating a finding as a build break and editing until it goes quiet. The token is the
easiest thing in the file to change, so a mismatch between a claim and a measurement gets settled by
deleting the claim — and the document that recorded *why* a seam is that number becomes a transcript
of whatever the code happened to compute.

The second is treating green as approval. Three of the five audits state, in their own source, the
thing they cannot prove. A reader who never opens that gets a stronger belief out of a passing run
than the run ever offered.

So the body is organised around reading rather than running: two short sections to execute the two
lanes, then a long section that takes each finding by kind and asks which of the claim or the pixel
is wrong.

## Why the two lanes stay separate here rather than behind one command

It would be easy to write a wrapper that runs the gates and the runner together and prints one
verdict. That wrapper would be the wrong shape, because the two lanes fail for different reasons and
are debugged differently: a gate failure is a fact about a file and can be read straight from the
output, while a runner failure is a measurement of a browser and usually needs the story opened.

Collapsing them also hides the diagnosis that matters most on a bad day — a wall of red across
nearly every story, which almost always means the registry moved rather than that the app regressed.
That reading is only available when you can see which lane went red and how broadly.

## What is cited and what is not

Nothing in the body restates a rule. The five audits, the attribute table, the hard-versus-
information split and the honest limits are `canon/fe/testing.md`, and the body points at it rather
than paraphrasing, because a paraphrase of a rule is a second source of truth that is wrong the day
the first one changes. What the body adds is the part canon does not carry: the operational
sequence, the working-directory trap, and a triage order for reading findings.

The working-directory trap is worth naming here because it is the one failure mode of this skill
that produces a *confident wrong answer* rather than an error. The gates read the process's working
directory. Run from the canon repo instead of the front-end root and they walk trees that do not
exist, find nothing, and exit zero. A clean report from the wrong folder is indistinguishable from a
clean report, which is why the roots are resolved before anything else runs.

## What it refuses

It does not fix anything. A confirmed finding is handed to the apply skill that owns the surface —
`skills/starci-fe-skeleton-apply` for a pending state, the layout and block skills for structure —
and anything left unfixed is recorded through `skills/starci-record-debt` rather than remembered.

It also has no opinion about whether a component is the right component for the data. That is a
lookup, and it lives in the design material, not in a measurement of pixels.

## Running the tests

```bash
node .claude/skills/starci-fe-contract/test.mjs
node .claude/scripts/run-all-tests.mjs                      # every skill's suite
```

The suite reads `SKILL.md` and nothing else: every path the skill cites must still resolve, no
machine path may appear, and the founding invariant must still be stated in words. A canon file that
moves fails it, which is the point — a citation to a renamed file is worse than no citation, because
it reads as grounded.

## What these tests cannot tell you

They test the document. They say nothing about whether an agent holding this skill reads a red run
correctly, and that is the whole claim the skill makes. The eval that would test it is a fixed red
run, replayed:

> **prompt** — a recorded runner output with one unregistered token and one declared pattern that
> computes to a different rung.
>
> **expected** — Names the typo as a typo rather than adding a registry entry for it. For the second
> finding, asks whether the claim or the pixel is wrong before proposing an edit, and does not
> silently rewrite the token to match the measured value.

The baseline arm is the interesting one: without the skill, the fastest way to a green run is to
edit the tokens, and a run that does that looks like a success in a diff.
