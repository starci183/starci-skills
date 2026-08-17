---
name: starci-init
description: Write or repair a Source repository's agent bootstrap — AGENTS.md and CLAUDE.md at the repository root — so any agent routes into this trust tree before doing anything else. Use when a Source has no bootstrap, when its bootstrap points at a tree that moved, or when it has grown into a rules digest. Writes two files and nothing else.
---

# starci-init

Read [`../skill-shape/en.md`](../skill-shape/en.md) first.

This is the only skill that writes at the **Source repository root**, outside the trust tree. Two files,
both routers:

| File | Read by | Says |
|---|---|---|
| `AGENTS.md` | Codex and other agent runtimes | read the tree's entry first, in this order |
| `CLAUDE.md` | Claude Code, loaded automatically | the same, for that runtime |

They are two files because two runtimes look for two names, not because there are two sets of rules.
Nobody may "deduplicate" them into one — a runtime that cannot find its filename gets no bootstrap at
all, and an agent with no bootstrap invents its own order.

## The law this skill exists to protect

**A bootstrap routes; it never restates a rule.** The moment it carries a rule, that rule has two homes
and they drift — and the copy at the repository root is the one nobody remembers to update. That is why
the bootstrap stays under ten lines and says only: read the entry, in this order, and do not copy rules
into this file.

A bootstrap that has grown into a summary of the tree is the failure this skill repairs.

## PROCESS

### 1 — Print CONTEXT

`Phase` is `plan`, then `review`, then `apply`. `Touching` is exactly two paths: `<Source>/AGENTS.md`
and `<Source>/CLAUDE.md`. Nothing else, ever.

### 2 — Resolve Source, and prove the tree entry exists

Source is the repository holding the trust tree. Read the tree's entry — `INDEX.md` at the tree root —
and confirm it is there.

**If the entry does not exist, stop.** A bootstrap pointing at a missing file is worse than no
bootstrap: the agent follows the link, finds nothing, and proceeds on its own judgement while believing
it was routed.

### 3 — Read what is already there

Never write over a bootstrap unseen. For each of the two files, classify it:

| Situation | Verdict |
|---|---|
| absent | `create` |
| present, routes to this tree's entry, no rules inside | `reuse` — nothing to do, say so |
| present, routes to a path that moved | `repoint` — change the link, keep the rest |
| present, carries rules, tables or law text | `slim` — the rules stay in the tree; propose exactly what is removed |
| present, project-specific content unrelated to routing | **stop** — this is somebody's file, not a slot |

`slim` is the case that needs the owner's eyes: content is being deleted from a file at the repository
root, and the argument for it is that the content lives in the tree already. Show which rule each
removed line duplicates, and where it lives now.

### 4 — Review the exact bytes

Show both files in full, before and after. They are short by design, so there is no reason to summarise
a diff of them. Get approval for the pair, then write.

### 5 — Write the two files

The shape, and nothing more than the shape:

```markdown
# StarCi agent bootstrap

Before planning, reading target source, or running a skill, read
[`<tree>/INDEX.md`](<tree>/INDEX.md) completely and follow its load order.

This file is only a bootstrap. Do not copy context, brainstorm, compiler, gate or skill rules into it.
The entry resolves the project route first, then routes to the stage the request needs.
```

Both files carry the same content and the same link. Relative paths only — an absolute path makes the
bootstrap true on one machine, which is the `WORKSPACE-6` failure at the repository root.

### 6 — Verify by following the link

Resolve the link from the repository root exactly as an agent would, and confirm it lands on the entry.
Then confirm the entry names the load order and the capabilities.

A bootstrap is verified when a reader who knows nothing about this tree can get from the repository root
to the right stage without being told anything else.

### 7 — Close the phase

Append the workflow and print the six tables. `CHANGES` lists both paths and what happened to each.

## Stops

- The tree entry does not exist → stop; the tree needs an entry before it can be pointed at.
- A bootstrap file holds unrelated project content → stop; propose a location for the routing lines
  instead of overwriting somebody's file.
- The link would have to be absolute to resolve → stop; the tree is not where the bootstrap can reach it,
  which is a layout problem rather than a wording problem.
- A rule can only be removed by rewriting it elsewhere → that is a trust-tree change, not an init.

## OUTPUT

The six tables from the skill shape, in order. `REJECTED` carries any line the owner kept that this skill
proposed removing, with their reason.
