---
name: starci-setup-storybook-choose
description: Decides WHICH storybook the whole ecosystem uses as its design system, and records it once in the shared ledger so every registered project reads the same blueprint. Use this skill whenever a task needs the design system and the ledger has none yet, or the recorded one is wrong: "set up storybook", "which storybook are we using", "point the design system at X", "I built my own storybook, use that one", "where do the atoms live", "open the design system", "the skill is reading the wrong storybook". Use it before writing any component, story, or token — a project with no `.storybook/` of its own is not missing a design system, it borrows the ecosystem's, and guessing which one is how two apps quietly drift apart. For fetching the canonical storybook when the machine has none, use starci-setup-storybook-generate instead.
---

# Choosing the ecosystem's storybook

A design system is **one** thing shared by every source in the ledger. An app with no
`.storybook/` of its own is not missing anything — it borrows. Recording the choice once, at the
ledger level rather than per project, is what stops each app growing its own copy and drifting.

## Quick start

```bash
node .claude/scripts/choose-design-system.mjs            # what is recorded, and what could be
node .claude/scripts/choose-design-system.mjs choose     # adopt the one usable storybook in the ledger
```

Then every skill asks for it the same way, whichever project is current:

```bash
node .claude/scripts/workspace/read-workspace-context.mjs design_system.path
```

## Adopting your own

```bash
node .claude/scripts/choose-design-system.mjs choose <path-to-repo-or-.storybook>
```

Building your own design system is a deliberate act, so claiming it is one too. Nothing here
notices a storybook you made and adopts it on your behalf — the bias runs to the canonical book,
and anything else is adopted only because you named it.

## What counts as usable

A folder proves nothing. `fe.design_system` in the workspace record is set from `existsSync`
alone, so an empty `.storybook/` satisfies it — and someone would open that and find nothing to
render. A storybook is usable here when it carries **both**:

| | Why |
|---|---|
| a `main.*` config | without it there is no storybook, only a folder named like one |
| a `storybook` script in `package.json` | without it nobody can start what the config describes |

`choose` refuses an unusable folder and names which half is missing.

## Candidates come from the ledger, never from a sweep

This is the rule worth defending, and it was learned on a real machine holding two clones of one
repo side by side:

```
<root-a>/app    storybook ✓  main ✓  script ✓  same origin
<root-b>/app    storybook ✓  main ✓  script ✓  same origin   ← weeks behind
```

Every technical test passes on both. Same origin, same config, same script; only the folder name
differs, and a folder name means nothing. **Nothing about the folders separates them — only the
ledger does.** So `choose` looks at registered sources and stops there.

When more than one registered source still qualifies, it refuses and prints each with its last
commit rather than picking. The date is usually what tells you which one you meant.

Identification of the canonical checkout is by **git origin**, not by folder name, for the same
reason: names are free, origins are not.

## Adopting the book means adopting its architecture

A storybook is not a folder of components — it is a layer architecture, and the lower tiers are
**shared by every app that reads it**. Adopting the book adopts that shape too.

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

## Before trusting the recorded one

```bash
node .claude/scripts/choose-design-system.mjs --check
```

It fails when the folder is gone or has stopped being usable, and **warns** when the commit has
moved since it was recorded. A moved commit is not an error — the blueprint is allowed to change —
but it is exactly how two machines end up disagreeing about what the design system says, so it is
always reported.

## Common mistakes

- **Treating a missing `fe.design_system` as breakage.** It only means this project has no
  `.storybook/` folder of its own. It borrows; ask `design_system.path`.
- **Reading from one storybook and writing into another.** The blueprint has one home. Editing a
  borrowed copy splits the ecosystem in two, and nothing will tell you it happened.
- **Adopting a folder because it exists.** Check the config; a shell renders nothing.
- **Scanning the disk for `.storybook`.** It finds stale clones that look perfect.

## Files

| Path | What it is |
|---|---|
| `.claude/scripts/choose-design-system.mjs` | chooses, records, checks |
| `.claude/scripts/workspace/read-workspace-context.mjs` | reads it back — `design_system.path` |
| `.claude/context/workspace.json` | the ledger, gitignored, per machine |
| `test.mjs` | `node .claude/skills/starci-setup-storybook-choose/test.mjs` |

Nothing usable anywhere on the machine means there is nothing to choose between — fetch the
canonical book with `starci-setup-storybook-generate`.
