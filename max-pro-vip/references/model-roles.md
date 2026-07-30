---
name: model-roles
description: Pick the model and effort level for each kind of work when running an agent or workflow. Read before spawning any agent.
---

# Model roles

Two tiers. **`sonnet` is the default for everything**; `opus` is the exception, not the ceiling.

| Model | Use for |
|---|---|
| `sonnet` | sweeping, acting, translating, measuring, registry lookups, bulk edits, drawing the routine widget, deciding direction on an ambiguous brief |
| `opus` | only where a whole region must be held in mind at once: the rules in [`judgement.md`](../principles/judgement.md), a proposal that changes canon, the closing synthesis of a session |

Anchored 2026-07-30, the teacher: *"no fable, sonnet is strong enough now, use sonnet more."*
The three-tier split with `fable` on top is retired.

## When `opus` actually earns it

Only three situations, and they share one trait — no lookup table can answer them:

- a `judgement.md` rule is in play: accent-flood, silhouette mismatch across a row, whether content
  that will really wrap should be centred
- a proposal would change canon, so getting it wrong costs more than one screen
- closing a session: reading the whole log and deciding what canon was missing

Everything else is `sonnet`. If you cannot name which of the three applies, it is `sonnet`.

## Rules

**Sweeping is `sonnet`.** Sweeping means reading measurements and matching them against rules that
already exist. Anchored 2026-07-29: a first pass ran 15 sweep agents on `opus` with `effort: high`
— wrong role, and the teacher settled it: *"sonnet only from now on."*

**Changing depth does not change role.** Shallow triage and deep-diving are both sweeping, both
`sonnet`. To make it cheaper, change the **architecture**, not the model. Anchored 2026-07-29: one
sweep cost about 1.7 million tokens because every cell was read equally deeply, including cells
that were always going to pass.

**Do not spawn an agent for small work.** Under six cells, reading directly is cheaper — an agent
bootstraps its context from zero every time.

**Fan out by AXIS, not by REGION** when the region count is large. The canon files are static: read
once, reused for every region. A region's props are short text, inlined into the prompt. Flipping it
makes the number of canon reads equal to the number of axes, independent of region count. Only flip
at 15 regions or more; below that it is excess architecture for small work.

**Split agents by file, never by task, when they write.** Two agents editing one file lose work. For
heavy builds run sequentially, or give each its own worktree.

**Never hand a background agent a destructive git command.** `checkout` or `reset` used to "undo"
without checking `status` first loses uncommitted work.

**Give an agent the constraint, not just the goal.** Anchored 2026-07-30: nine translation agents
were told to write with the Write tool only, never PowerShell — because PowerShell on this machine
corrupts UTF-8 silently. None of them broke a file. The two files that were corrupted that day were
corrupted by this session, before that constraint was written down.
