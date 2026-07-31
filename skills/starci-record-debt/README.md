# Why this skill is shaped the way it is

Notes for whoever changes it. `SKILL.md` is the interface; this is the reasoning behind it.

## Why not a TODO comment

A `TODO` sits in the file it describes, which is its one real advantage — and it drops the field
that matters. A TODO records **what to do**. It has no place to record **why it was not done**, and
that is the only part a later reader cannot reconstruct by looking at the code.

The second problem is that a TODO is invisible until you open the file. Debt is most valuable at
the moment somebody is deciding whether to work in an area at all — before they have opened
anything.

## Why not an issue tracker

Trackers are for work someone intends to schedule. Most debt is not scheduled and should not be:
it is a shortcut that is correct for now, and the note exists so it is not mistaken for a pattern.
Filing those in a tracker either floods the backlog or, more often, gets closed as stale — at which
point the reasoning is gone and the code still looks unexplained.

The other reason is proximity. This lives beside the skill set that will read it. An agent already
loading `.claude/` finds the debt without being told to look somewhere else.

## Why `--why` is enforced by the tool and not by convention

Because a convention that costs effort at the exact moment someone is in a hurry is not a
convention. Deferring a fix happens under time pressure by definition — that is what deferring is.
A required flag makes the field cost the same as everything else in the command.

The refusal message says what to do when there is no reason yet: what you have is a task, not debt.
That distinction is the tool's entire filter, and it is worth being blunt about.

## Why roles instead of paths

The same reasoning as `starci-setup-workspace-fe`, and the same failure it avoids: a path written
into a file is true on one machine. Debt entries outlive the machine that wrote them more often
than most notes do — they are read months later, frequently on a different checkout.

`resolveRole` shells out to `read-workspace-context.mjs` rather than reading
`context/workspace.json` directly, so exactly one piece of code knows the registry's shape. Two
readers of the same format drift; it is only a question of when.

A missing role is not an error at write time. You can record debt about a tree this machine has
never registered — only `--check` needs the folder to exist, and it reports the unresolvable role
separately from a missing path, because they mean different things.

## What a `--why` is actually worth

An account, not proof. The house rule is that a comment explaining **why** is one person's version
of events and nothing checks it — and a debt entry is exactly that, written down deliberately.

That is not an argument against writing it. It is the reason for the shape around it: the entry is
signed with a date, its claims about the codebase are testable by `--check`, and closing it demands
a `--how` that can be read against the diff. Read a `--why` as "this is what the person deferring
believed at the time", never as "this was verified". If it says a fix is blocked, confirm the block
still exists before repeating the conclusion.

## Why the ledger is committed rather than ignored

The first cut ignored `debt/`, reasoning that entries name your trees and this skill set is public.
That got it backwards. A deferral only one machine can see is a deferral the next person
rediscovers by walking into it — which is the exact failure the whole tool exists to prevent. The
audience for a debt entry is *somebody else, later*, and an audience of one is no audience.

It is also what makes role-relative paths pay off. They were built so an entry written on one
machine still resolves on another; ignoring the folder meant no entry ever crossed a machine, and
that property was never exercised.

The cost is real and worth naming: entries say what is unfinished, in files named out loud, and
they travel wherever the skill set travels. Write each one as something a stranger may read. A
single entry that genuinely must not leave the machine can be ignored on its own — turning the
whole ledger private to hide one line trades the tool for the secret.

## Why closing keeps the file

A closed entry answers a question an empty folder cannot: was this considered? Deleting it leaves
the next reader unable to distinguish "settled deliberately" from "never looked at", which is the
same ambiguity the tool exists to remove.

## Why `--check` exists at all

The principle the rest of this skill set follows: encode the QUESTION in the tool, not the ANSWER
in a document. A debt entry is a claim about the codebase, and claims go stale silently. `--check`
does not decide anything — it asks whether the files a claim names are still there, and hands both
possible meanings back to a human.

Exit 2 rather than 1, so a caller can tell "the notes are stale" apart from "you used the tool
wrong".

## Why the entry is markdown with frontmatter

The body is meant to be read by a person and by a model, and both already read markdown. The
filtered fields — role, state, rule — must be machine-readable without parsing prose, hence
frontmatter.

The parser is about fifteen lines and handles only what this script writes. A YAML dependency would
put a package between the skill set and its own notes for no gain.

## What the tests cannot cover

Whether an agent holding this skill actually *reaches for it* when a fix is deferred, instead of
silently moving on. That is a property of the description in the frontmatter, not of the script, and
only an eval can measure it. The test suite covers the script: required fields, path rules, id
collisions, state transitions, and `--check`'s two outcomes.

Every case names the claim it is testing, so a failing run reads as a broken promise rather than as
a numbered failure.
