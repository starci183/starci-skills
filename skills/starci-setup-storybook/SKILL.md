---
name: starci-setup-storybook
description: Decides which storybook the whole ecosystem uses as its design system — reading the answer from the shared ledger of registered sources, never from a disk sweep — and records the choice once so every registered project reads the same blueprint; when nothing usable is registered yet, the same job fetches StarCi's canonical storybook (which ships inside the front-end app repo, not as a separate package) and records that instead. Use this skill whenever a task needs the design system and the ledger has none recorded, or the recorded one might be wrong: "set up storybook", "which storybook are we using", "point the design system at X", "I built my own storybook, use that one", "where do the atoms live", "open the design system", "the skill is reading the wrong storybook". Use it just as much when there is nothing on the machine yet to choose between: "I don't have the storybook", "get me the design system", "pull starci's storybook", "clone the design system", "set up storybook on a new machine", "generate the storybook for my project". Use it before writing any component, story, or token — there is exactly one book (starci-academy's `.storybook/`) and a registered source must not carry its own; an app adds its components under its own namespace inside that one book, and guessing which storybook to read is how two apps quietly drift apart. Not for registering where the front-end or back-end source itself lives, its branch, or its dev port (starci-setup-workspace / starci-setup-workspace), and not for deciding which component or tier a piece of UI belongs in once the book is chosen — that is the component matrix and the tier-boundaries material under canon/fe/.
---

# Setting up the ecosystem's storybook

There is exactly **one** design system, and it is `starci-academy/.storybook` — the book that
ships inside the StarCi front-end app repo. Every registered source reads its blueprint from there.
A registered source **must not carry a `.storybook/` of its own**: a second book is a second truth,
and the day one app's tokens stop matching another's, nothing announces it. An app that needs its
own components adds them **under its own namespace inside the one book**, never in a book of its own.
`check-single-source-of-truth.mjs` fails while a second book exists.

Recording the choice once, at the ledger level rather than per project, is what holds that line.
Sometimes there is nothing yet to point at — a fresh machine, a fresh clone, nobody's fetched one
here before. That is not a different problem, just the other branch of the same one: fetch StarCi's
canonical book (it comes with the front-end app repo) and record it exactly the same way.

## Quick start

```bash
node .claude/scripts/choose-design-system.mjs             # what is recorded, and what could be
node .claude/scripts/choose-design-system.mjs choose       # adopt the one usable storybook already in the ledger
node .claude/scripts/choose-design-system.mjs generate     # nothing usable yet — fetch the canonical one
```

Then every skill asks for it the same way, whichever project is current and whichever branch
recorded it:

```bash
node .claude/scripts/workspace/read-workspace-context.mjs design_system.path
```

## Two lanes, one ledger key

| | Situation | Cost |
|---|---|---|
| `choose` | something usable is already registered on this machine | reads, records |
| `generate` | nothing usable is registered anywhere | clones, touches the network, registers |

Both write into the same `design_system` entry, so a skill reading it back never needs to know
which branch put it there. `choose` itself names `generate` the moment it finds nothing to pick
from, rather than failing blankly — the two branches hand off to each other automatically.

## Pointing at the one book explicitly

```bash
node .claude/scripts/choose-design-system.mjs choose <path-to-starci-academy-or-its-.storybook>
```

Naming a path is for pointing at the one canonical book when nothing is recorded yet — a fresh
clone of `starci-academy`, say. It is not a door to a second book: the bias runs to the canonical
one, and a stray storybook is never noticed and adopted on your behalf. If you have a `.storybook/`
of your own, fold its stories into a namespace inside the one book and delete the copy —
`check-single-source-of-truth.mjs` fails while a second book exists.

## What counts as usable

A folder proves nothing. `fe.design_system` in the workspace record is set from `existsSync`
alone, so an empty `.storybook/` satisfies it — and someone would open that and find nothing to
render. A storybook is usable here when it carries **both**:

| | Why |
|---|---|
| a `main.*` config | without it there is no storybook, only a folder named like one |
| a `storybook` script in `package.json` | without it nobody can start what the config describes |

Both `choose` and `generate` refuse an unusable folder and name which half is missing — a clone
that lands without its config is a folder, not a design system, no less than a hand-built one is.

## Candidates come from the ledger, never from a sweep

This is the rule worth defending, and it was learned on a real machine holding two clones of one
repo side by side:

```
<root-a>/app    storybook present  main present  script declared  same origin
<root-b>/app    storybook present  main present  script declared  same origin   <- weeks behind
```

Every technical test passes on both. Same origin, same config, same script; only the folder name
differs, and a folder name means nothing. **Nothing about the folders separates them — only the
ledger does.** So `choose` looks at registered sources and stops there, and `generate` looks for a
registered checkout before it ever considers cloning a second one.

When more than one registered source still qualifies, `choose` refuses and prints each with its
last commit rather than picking. The date is usually what tells you which one you meant.

Identification of the canonical checkout is by **git origin**, not by folder name, for the same
reason: names are free, origins are not.

## Adopting the book means adopting its architecture

A storybook is not a folder of components — it is a layer architecture, and the lower tiers are
**shared by every app that reads it**. Adopting the book, by either branch, adopts that shape too.

The book is the source of truth for its own architecture, so ask it rather than trusting anything
written down:

```bash
node .claude/scripts/audit/scan-storybook-architecture.mjs "$(node .claude/scripts/workspace/read-workspace-context.mjs fe.path)"
```

It reports which tiers sit at the top level — **shared, belonging to no app** — and which app
namespaces exist beneath. Counts differ per book and per week; the boundary does not.

Whichever source you write into:

- **a shared tier has one home.** Copying one under an app namespace is the moment two apps stop
  sharing a vocabulary, and nothing else announces it. `scan-storybook-architecture.mjs` calls it out when it happens
- **only the upper tiers live under an app name.** The line falls where domain knowledge starts:
  a composite takes `items`, a block takes an entity — so a composite serves any app and a block
  cannot
- **the import direction runs downward only.** `scan.mjs --violations` names any file that breaks
  it
- **unsure between two tiers, pick the lower one.** Promoting is a rename; demoting leaves every
  caller stranded

Why each boundary sits where it does: `canon/fe/enforce/tiers/references/tier-boundaries.md`.

## Fetching the canonical book, when there is nothing to choose from

StarCi's design system ships **inside the front-end app repo** — there is no separate package. So
"get the storybook" means getting `starci-academy`, and taking `.storybook/` from it. What arrives
is **not a template**: it is a working design system with a domain already in it. Your app joins
at its own namespace; the existing one stays where it is.

```bash
node .claude/scripts/choose-design-system.mjs generate                  # into the current directory
node .claude/scripts/choose-design-system.mjs generate --into C:/Repositories
```

What it does, in order:

| # | Situation | What happens |
|---|---|---|
| 1 | a registered source is already a `starci-academy` checkout with a usable storybook | **reuses it** — no clone |
| 2 | the target folder already holds that checkout | reuses it, no clone |
| 3 | the target folder holds something else | refuses, rather than writing into it |
| 4 | nothing there | clones, registers it as a source, records it as the design system |

Step 1 is the one that matters. Cloning a second copy of a design system already on the machine
creates two blueprints that will diverge, and nothing announces it when they do — you simply find
one app's tokens no longer matching another's. Reuse before fetch, every time.

The clone lands in the current directory, unless `--into <dir>` says otherwise — a place you chose
by standing in it, not one this skill invented, and it is printed before anything is written. The
clone is registered as a source in its own right, so `--list` shows it and nobody later finds an
unexplained folder and wonders whether it is safe to delete.

To point at a fork or a mirror instead of StarCi's own:

```bash
DESIGN_SYSTEM_REPO=https://git.example.com/team/design.git \
  node .claude/scripts/choose-design-system.mjs generate --into C:/Repositories
```

The checkout is named after the repo it came from, so a mirror does not land in a folder claiming
to be something else.

## Before trusting the recorded one

```bash
node .claude/scripts/choose-design-system.mjs --check
```

It fails when the folder is gone or has stopped being usable, and **warns** when the commit has
moved since it was recorded — whether that entry came from `choose` or from `generate`. A moved
commit is not an error — the blueprint is allowed to change — but it is exactly how two machines
end up disagreeing about what the design system says, so it is always reported. `git pull` in that
folder is what brings a clone forward; a copied folder would not have that line home at all.

## Common mistakes

- **Treating a missing `fe.design_system` as breakage.** A registered source is *supposed* to have
  no `.storybook/` of its own — there is one book, and it is asked for with `design_system.path`.
- **Reading from one storybook and writing into another.** The blueprint has one home. Editing a
  second copy splits the ecosystem in two, and nothing will tell you it happened.
- **Adopting a folder because it exists.** Check the config; a shell renders nothing.
- **Scanning the disk for `.storybook`.** It finds stale clones that look perfect.
- **Cloning when a copy is already registered.** Run the plain command first; reuse fires before
  any network call does.
- **Cloning into a folder that already holds another repo.** Refused on purpose; adopting it is
  how the wrong tree becomes the blueprint.
- **Assuming a clone means it works.** A checkout without `main.*` or without a `storybook` script
  is a folder, not a design system, and is refused with the missing half named.

## Files

| Path | What it is |
|---|---|
| `.claude/scripts/choose-design-system.mjs` | chooses, fetches, registers, records, checks |
| `.claude/scripts/workspace/read-workspace-context.mjs` | reads it back — `design_system.path` |
| `.claude/context/workspace.json` | the ledger, gitignored, per machine |
| `test.mjs` | `node .claude/skills/starci-setup-storybook/test.mjs` |
