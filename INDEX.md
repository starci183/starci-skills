---
title: Docs
---

# StarCi trust v3

Read this before planning, before reading target source, and before running a skill.

The tree is split by **what a stage is allowed to return**. That is the only classification here;
order follows from it rather than defining it.

| Tree | Returns | Read it when |
|---|---|---|
| [`contexts/`](./contexts) | where source is read from, where state is written | always first — nothing below is correct if the route is wrong |
| [`brainstorms/`](./brainstorms) | 3–4 candidates for the owner to choose | a surface or a block is not yet decided |
| [`compilers/`](./compilers) | exactly one answer, no candidates | a shape is accepted and needs classes |
| [`gates/`](./gates) | pass, or reject with evidence | code exists and must be judged |

## Load order

1. [`contexts/workspaces`](./contexts/workspaces) — resolve the project's role routes and **verify**
   them. A stale route stops the run; it is not approximated.
2. [`contexts/worktrees`](./contexts/worktrees) — decide where this run may write before it writes.
3. [`skills/skill-shape`](./skills/skill-shape) — the reporting shape every capability shares.
4. The stage the request actually needs, from the table above.

A request that cannot resolve its project, its role targets or its write boundary is stuck before any
target-specific work. Say so; do not proceed on a guess.

## Capabilities

Eight, and no more. `skills/starci-*` holds them; `skills/skill-shape` holds what they must all print,
ask and record.

| Skill | Owns |
|---|---|
| `starci-init` | the Source bootstrap: `AGENTS.md` and `CLAUDE.md` |
| `starci-docs-publish` | the docs site's build config and its host |
| `starci-setup-workspaces-and-worktrees` | `.workspace/<project>/` and `.worktrees/<project>/` |
| `starci-fe-design-layout` | layout candidates, hash-bound |
| `starci-fe-design-block` | block anatomies, hash-bound |
| `starci-fe-design-execute` | frontend source, only after every hash is accepted |
| `starci-be-plan` | the backend brief |
| `starci-be-approve` | approval, then backend source |

## What this tree refuses

The rules here are written to be **machine-refusable**, because a rule that only advises gets skipped
under pressure:

- a layout candidate is class-free, enforced by reading 38% of the contract — a stage that cannot see a
  class cannot write one;
- every schema sets `additionalProperties: false`, so a stray `className` is invalid rather than
  arguable;
- [`scripts/validate-artifact.mjs`](./scripts/validate-artifact.mjs) refuses a batch whose candidates
  share an axis set, or where none departs from precedent;
- an approval binds to the hash of canonical JSON with the envelope outside it, so re-running the same
  decision yields the same hash.

## Authoring

Every module is one document in two records: `en.md` for the agent, `vi.md` for the human. They match
section for section and neither refers to the other. A shelf may carry its own `en.md`, which becomes
that shelf's page.

Rules live in the tree. This file routes; it never restates a rule, and neither does the Source
bootstrap.
