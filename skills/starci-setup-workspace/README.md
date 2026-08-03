# starci-setup-workspace — notes

`SKILL.md` says what to do. This file says why it is shaped this way and what it refuses to do.
Read it before changing anything here.

## Why FE and BE are one skill

This used to be two skills — a front-end one and a back-end one — because they were asked for at
different moments and carried different knowledge: a Storybook URL means nothing to someone
hunting an API port. They were merged because the thing that varies is identical on both sides
(a path true on one machine, wrong on the next) and the mechanism that fixes it is identical too
(a stated source, read out of the repo, kept in one gitignored file) — two skills were two copies
of the same idea, not two ideas. `--fe` and `--be` on the same command line, into the same
`context/workspace.json`, through the same pair of scripts, is what that identity looks like in
practice.

## What varies, and why a document cannot hold it

| Varies per | What goes wrong when it is written down |
|---|---|
| **machine** | a document names one drive and root; the next machine answers differently |
| **project** | the same skill gets pointed at a different app with a different front end |

Any canon file that writes a path down is the reason this skill exists — and rewiring such a file
to ask instead is the work that follows adopting this set.

## It does not search — that was learned the hard way

An earlier version swept the machine for folders that looked like a front end. Every defect its own
tests found came from that sweep:

| What the sweep did | Why it was wrong |
|---|---|
| offered dozens of candidates for one role | git worktrees are full copies of a repo |
| claimed a backend as the front end | it carried a bundler to build an internal dashboard |
| left a front-end-only project **ambiguous forever** | the unstated role kept matching unrelated repos, so `--check` never passed |
| silently picked a stale clone | it was simply nearest, and nearest is not current |

Each produced a confident answer to a question only the person at the keyboard can settle.

What is still read from the repo — never invented — has one verifiable source each: the Storybook
port from `scripts.storybook`, the dev port from `scripts.dev` or the framework's own default,
branch and last commit from git. Every field records **how** it was found.

`looks_like_role` is the one inference left, and it is a note rather than a veto — annotating a
decision, not making one.

## Running the tests

```bash
node .claude/skills/starci-setup-workspace/test.mjs
node .claude/scripts/run-all-tests.mjs                      # every skill's suite
```

The suite builds repos under `.testtmp/` and deletes them again, including a local bare repo that
stands in for a remote, so nothing needs the network and this machine's own `context/workspace.json`
is never touched.

About a third of the cases require a **failure**: a path that does not exist, an empty folder, a
clone target whose origin belongs to someone else. A refusal nobody has watched fire is not known
to fire.

**When a case fails, read the real output before changing the code.** Four times in this skill's
short history the case was the thing that was wrong — asserting lowercase against an uppercase
verdict, searching a whole output for a string belonging to one section of it, demanding a
rejection the data did not warrant, and asserting a proportion of matched words that real phrasing
never reaches.

## What these tests cannot tell you

They test the scripts. They say nothing about whether an agent holding this skill actually asks for
`fe.path` instead of remembering one from earlier in the conversation. That is a behaviour question
and needs an eval: the same prompt with the skill and without it in the same turn, graded blind by
a separate agent, in the shape `max-pro-vip/evals/` already uses.

> **prompt** — "Fix the ContinueCard in Storybook, it's misaligned."
>
> **expected** — Does not `cd` into a remembered path. Asks `workspace.mjs fe.path` before opening
> a file. With no context recorded, stops and says to run setup rather than picking a repo.

The interesting arm is the baseline. On any machine holding two checkouts of one front end, a run
without the skill is likely to walk into the stale one — exactly the failure the skill claims to
prevent. That eval has not been run yet.
