# starci-setup-storybook-generate — notes

`SKILL.md` says what to do. This file says why it is shaped this way. Read it before changing
anything here.

## Why this is separate from `choose`

Two skills, one script, because they are asked for at opposite moments:

| | Situation | Cost |
|---|---|---|
| `choose` | something usable is already on the machine | reads, records |
| `generate` | there is nothing to choose between | writes to disk, touches the network |

Keeping them apart means the cheap, reversible one is never dragged along by the expensive one,
and the description that decides which fires can be specific instead of hedged.

## The design system ships inside the app repo

There is no separate package. The `.storybook/` folder lives inside the front-end app repo, so
fetching the book means fetching that repo — and most of its weight is the upper tiers, which are
somebody's real product.

That is worth knowing before running it: what arrives is **not a template**. It is a working design
system with a domain already in it. Your app joins at its own namespace; the existing one stays
where it is.

Sizes are deliberately not written down here. Ask the checkout:
`node .claude/scripts/scan-storybook-architecture.mjs <path>`.

## Clone, never copy

A clone keeps a line home. `git pull` refreshes it, and its commit can be compared with upstream to
say how far behind it has fallen — which is exactly what `--check` reports. A copied folder drifts
in silence, and the first sign is one app's tokens no longer matching another's.

This is also why the earlier idea of "copy just the scaffold" was dropped: a partial copy has all
the drift of a copy and none of the completeness of a clone.

## Reuse before fetch

The first thing it does is look for a `starci-academy` checkout already registered in the ledger.
Cloning a second copy of a design system that is already on the machine creates two blueprints that
will diverge, and nothing announces it when they do.

Identification is by **git origin**, never by folder name — a folder called `starci-academy` proves
nothing. The same rule guards the clone target: a folder already sitting there is adopted only if
its origin matches, and refused otherwise, because adopting a stranger makes the wrong tree the
blueprint for every project at once.

## The clone is registered as a source

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
node .claude/skills/starci-setup-storybook-generate/test.mjs
node .claude/scripts/run-all-tests.mjs                     # every skill's suite
```

11 cases, built under `.testtmp/` and deleted again. The clone path is exercised with a real
`git clone` against a local bare repo, so it is the real code path and still needs no network.

Half the cases require a **refusal**: a stranger at the target, a checkout whose storybook has no
config, a second run that must reuse rather than fetch again. A refusal nobody has watched fire is
not known to fire.

**When a case fails, read the real output before changing the code.** The last failure here was the
fixture, not the script: its `.storybook/` held no files, git does not track empty directories, so
the folder vanished on clone and the case meant to test *"config missing"* was quietly testing
*"folder missing"* instead. The script had been right the whole time.

## What these tests cannot tell you

They test the script. They say nothing about whether an agent reaches for this skill at the right
moment — that is a triggering question, decided entirely by the `description` in `SKILL.md`, and
measured with a different harness: realistic queries, half that should fire and half that should
not, each run several times because the model is stochastic.

The near-miss worth testing there is the one this skill shares a border with: *"which storybook are
we using"* must reach `choose`, while *"I don't have the storybook"* must reach this one.
