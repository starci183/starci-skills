# starci-setup-storybook — notes

`SKILL.md` says what to do. This file says why it is shaped this way, and why the two jobs it
does — choosing and fetching — live in one skill instead of two. Read it before changing anything
here.

## The idea underneath

The whole set works by **indirection through a ledger**. A skill never names a source — it names a
**role**, and `context/workspace.json` binds that role to something concrete, per machine. Plug one
source into the ledger and every skill in the set works against it, without any of them knowing
which app they are serving.

The hard part is not the mechanism, it is **which level each binding lives at**:

| Key | Level | Wrong level does what |
|---|---|---|
| `fe.path` | per project | shared → two different apps get one path, which is nonsense |
| `design_system` | **the whole ledger** | per project → every app grows its own book and they drift |

That table is the reason this skill exists. An app with no `.storybook/` of its own is not missing
a design system — it **borrows** the ecosystem's. Once you see it that way, the fix stops being
"patch each app" and becomes "one book, many readers".

Switching the current project changes `fe.path` and leaves `design_system.path` untouched. That is
the whole design in one line of output.

## Why choosing and fetching are one skill, not two

They used to be filed separately, on the reasoning that they fire at opposite moments and cost
different amounts:

| | Situation | Cost |
|---|---|---|
| choosing | something usable is already on the machine | reads, records |
| fetching | there is nothing to choose between | writes to disk, touches the network |

That split looked clean until the two skills themselves proved it wasn't: `choose` already named
`generate` the moment it found nothing to pick from, and `generate`'s own description said "if a
usable storybook is already on the machine, use `choose` instead." Two skills that each hand off
to the other on their very first branch are one job wearing two names — an agent holding either
one already needs to know about the other, so nothing was actually kept separate. They share one
script, one ledger key, and one underlying question: *is anything usable already registered?* Yes
answers it by reading; no answers it by writing. That is a branch, not a boundary, and folding it
into one skill means an agent reaches for the right lane without a mid-task hop to a second skill
just to be told which one it should have opened.

The cost asymmetry the old split was built on is real and still worth naming — it is why the
`SKILL.md` body keeps a "two lanes" table rather than pretending the branches are interchangeable —
but a difference in cost is a reason to document the branch clearly, not a reason to file it as a
separate skill.

## The price of sharing one book

A shared blueprint means a shared blast radius. Editing the book changes what every borrowing app
is built from. That is the power and the risk in one sentence, so the rule that goes with it is not
decoration: **the book has one home; borrowers read, never write.** A borrowed copy that gets
edited splits the ecosystem, and nothing announces it — true whether that copy arrived by `choose`
pointing at a hand-built one or by `generate` cloning the canonical one.

There is deliberately **no per-project override** yet. If one app ever needs an older book it takes
a single line — `projects.<name>.design_system` beating the ledger value. Building it before a real
case exists would repeat a mistake the workspace skill already paid for once.

## Candidates come from the ledger, never from a sweep

A machine can hold two clones of one repo:

```
<root-a>/app       storybook present  main present  script declared  same origin
<root-b>/app       storybook present  main present  script declared  same origin   <- weeks behind
```

Every technical test passes on both. **Nothing about the folders separates them** — only the ledger
does, because only one of them is registered. So candidates are read from registered sources, and
the canonical checkout is recognised by **git origin**, never by folder name: names are free.

When two registered sources still qualify, `choose` refuses and prints both with their last commit.
The date is usually what tells you which one you meant.

## What "usable" means, and why the check is not paranoid

`fe.design_system` in the workspace record is set from `existsSync` alone, so an **empty**
`.storybook/` satisfies it — the test fixtures in this skill create exactly that. Adopting it would
point the whole ecosystem at a shell that renders nothing. So a storybook counts here only with a
`main.*` **and** a `storybook` script, and a refusal names which half is missing. The same check
gates a freshly cloned checkout, too: a clone that lands without its config is a folder, not a
design system, no less than a hand-built one missing the same half.

## Clone, never copy

A clone keeps a line home. `git pull` refreshes it, and its commit can be compared with upstream to
say how far behind it has fallen — which is exactly what `--check` reports. A copied folder drifts
in silence, and the first sign is one app's tokens no longer matching another's. This is also why
an earlier idea — "copy just the scaffold" — was dropped: a partial copy has all the drift of a
copy and none of the completeness of a clone.

Identification is by **git origin**, never by folder name, for the clone target as much as for
choosing among candidates: a folder already sitting where the clone would land is adopted only if
its origin matches the canonical repo, and refused otherwise, because adopting a stranger makes the
wrong tree the blueprint for every project at once.

## The fetched clone is registered as a source

Not just recorded as the design system — it also enters `projects` under its own name, so `--list`
shows it and `--check` watches it. An unexplained folder on disk is a folder someone eventually
deletes.

## Mirrors and forks

```bash
DESIGN_SYSTEM_REPO=https://git.example.com/team/design.git \
  node .claude/scripts/choose-design-system.mjs generate --into C:/Repositories
```

The checkout is named after the repo it came from rather than after a constant, so a mirror does
not land in a folder claiming to be something else. The same override is what lets the tests stand
a local bare repo in for the network.

## Running the tests

```bash
node .claude/skills/starci-setup-storybook/test.mjs
node .claude/scripts/run-all-tests.mjs                     # every skill's suite
```

30 cases, built under `.testtmp/` and deleted again — fake repos, fake ledgers, and a local bare
repo standing in for the canonical remote. The clone path is exercised with a real `git clone`
against that bare repo, so it is the real code path and still needs no network. Nothing touches
this machine's real ledger.

Half the fetching cases require a **refusal**: a stranger at the clone target, a checkout whose
storybook has no config, a second run that must reuse rather than fetch again. A refusal nobody has
watched fire is not known to fire.

**When a case fails, read the real output before changing the code.** In this set the case has been
the wrong thing more often than the code has — asserting lowercase against an uppercase verdict,
searching a whole output for a string belonging to one section, and a fixture whose `.storybook/`
held only a config file that git dropped on clone once the case put nothing else in the folder, so
a case meant to test "config missing" ended up testing "folder missing" instead. The fixtures here
always leave something else in `.storybook/` for exactly that reason.

## What these tests cannot tell you

They test the script. They say nothing about whether an agent holding this skill asks for
`design_system.path` instead of assuming a folder, or reaches for the right lane once it is here.
That is a behaviour question and needs an eval — same prompt with and without the skill in one turn,
graded blind, in the shape `max-pro-vip/evals/` already uses.

> **prompt** — "Add a Badge atom to the design system."
>
> **expected** — Asks `design_system.path` rather than guessing `.storybook` under the current
> project. Notices the current project may be borrowing, and writes to the book's one home.

The near-miss worth testing there is the one the two former skills used to share a border over:
*"which storybook are we using"* wants the reading lane, while *"I don't have the storybook"* wants
the fetching one. Now that both live in a single skill the failure mode is subtler — not "wrong
skill" but "right skill, wrong branch," such as cloning a second copy when a usable one was already
sitting in the ledger.
