---
name: starci-setup-storybook-generate
description: Fetches StarCi's storybook onto this machine and records it as the ecosystem's design system, for anyone who does not already have a copy. Use this skill when a task needs the design system and nothing on the machine carries one: "I don't have the storybook", "get me the design system", "pull starci's storybook", "clone the design system", "set up storybook on a new machine", "generate the storybook for my project", or after starci-setup-storybook-choose reports no usable storybook among the registered sources. It reuses a checkout that is already registered rather than cloning a second copy, because two copies of one design system drift apart silently. If a usable storybook is already on the machine, use starci-setup-storybook-choose instead — this skill is for when there is nothing to choose between.
---

# Fetching StarCi's storybook

StarCi's design system ships **inside the front-end app repo** — there is no separate package. So
"get the storybook" means getting `starci-academy`, and taking `.storybook/` from it.

The ledger then points at that folder, and every registered project reads its blueprint from
there. One book, many readers.

## Quick start

```bash
node .claude/scripts/choose-design-system.mjs generate                  # into the current directory
node .claude/scripts/choose-design-system.mjs generate --into C:/Repositories
```

Afterwards, and from then on:

```bash
node .claude/scripts/workspace/read-workspace-context.mjs design_system.path
```

## What it does, in order

| # | Situation | What happens |
|---|---|---|
| 1 | a registered source is already a `starci-academy` checkout with a usable storybook | **reuses it** — no clone |
| 2 | the target folder already holds that checkout | reuses it, no clone |
| 3 | the target folder holds something else | refuses, rather than writing into it |
| 4 | nothing there | clones, registers it as a source, records it as the design system |

Step 1 is the one that matters. Cloning a second copy of a design system already on the machine
creates two blueprints that will diverge, and nothing announces it when they do — you simply find
one app's tokens no longer matching another's. Reuse before fetch.

Identification is by **git origin**, never by folder name. A folder called `starci-academy` proves
nothing; an origin does.

## Where the clone lands

The current directory, unless `--into <dir>` says otherwise. That is a place you chose by standing
in it, not one this skill invented — and it is printed before anything is written.

The clone is registered as a source in its own right, so `--list` shows it and nobody later finds
an unexplained folder and wonders whether it is safe to delete.

## Pointing at a fork or a mirror

```bash
DESIGN_SYSTEM_REPO=https://git.example.com/team/design.git \
  node .claude/scripts/choose-design-system.mjs generate --into C:/Repositories
```

The checkout is named after the repo it came from, so a mirror does not land in a folder claiming
to be something else.

## What you are actually fetching

Not a folder of components — a layer architecture. Your app **joins** it rather than starting one
of its own: it gets a namespace for the upper tiers and inherits the lower ones, which belong to
no app and are shared by all of them.

Ask the book you just fetched what its shape is, rather than trusting a description:

```bash
node .claude/scripts/audit/scan-storybook-architecture.mjs "$(node .claude/scripts/workspace/read-workspace-context.mjs design_system.path)/.."
```

It reports which tiers are shared, which app namespaces exist, and whether anyone has copied a
shared tier under an app — the one move that quietly ends the sharing.

Keep the import direction downward in whatever you add. `scan.mjs --violations` names any file
that breaks it, and why each boundary sits where it does is in
`canon/fe/enforce/tiers/references/tier-boundaries.md`.

## After fetching

```bash
node .claude/scripts/choose-design-system.mjs --check
```

The recorded entry keeps the commit it was fetched at. `--check` **warns** when the checkout has
moved since — not an error, because a blueprint is allowed to change, but it is exactly how two
machines end up disagreeing about what the design system says. `git pull` in that folder is what
brings it forward; the clone keeps that line home, which a copied folder would not.

## Common mistakes

- **Cloning when a copy is already registered.** Ask `choose-design-system.mjs` first; it will tell you.
- **Editing the fetched storybook to suit one app.** The book has one home. A borrowed copy that
  gets edited splits the ecosystem, and nothing will tell you it happened — take the change
  upstream instead.
- **Assuming a clone means it works.** A checkout without `main.*` or without a `storybook` script
  is a folder, not a design system. This refuses it and says which half is missing.
- **Cloning into a folder that already holds another repo.** Refused on purpose; adopting it is
  how the wrong tree becomes the blueprint.

## Files

| Path | What it is |
|---|---|
| `.claude/scripts/choose-design-system.mjs` | fetches, registers, records, checks |
| `.claude/scripts/workspace/read-workspace-context.mjs` | reads it back — `design_system.path` |
| `.claude/context/workspace.json` | the ledger, gitignored, per machine |
| `test.mjs` | `node .claude/skills/starci-setup-storybook-generate/test.mjs` |

Already have a storybook on this machine? Then there is nothing to fetch — use
`starci-setup-storybook-choose`.
