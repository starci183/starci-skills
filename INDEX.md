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
| [`compilers/`](./compilers) | exactly one answer, no candidates | a shape is accepted and code is about to be written — [`principles`](./compilers/principles) decide the classes, [`patterns`](./compilers/patterns) decide which file holds it and what it may import |
| [`gates/`](./gates) | pass, or reject with evidence | code exists and must be judged — [`lints`](./gates) point at the character they refuse on |

## Load order

**A skill owns its own reading list.** Its numbered steps name what to read and when. If a skill is
driving, follow the skill and stop reading here — this file has done its job by getting you to it, and
loading a stage the skill did not ask for is paying for a tree you are not using.

**If nothing is driving — plain coding, no skill —** this order is yours:

1. [`contexts/workspaces`](./contexts/workspaces) — resolve the project's role routes and **verify**
   them. A stale route stops the work; it is not approximated.
2. [`contexts/worktrees`](./contexts/worktrees) — only if the work writes state that must survive.
3. [`compilers/`](./compilers) — **before the first line**: [`principles`](./compilers/principles) for
   every class, [`patterns`](./compilers/patterns) for which file holds the code and what it may import.
   Both answer a shape already accepted, so reading them afterwards leaves only one move — moving code
   that is already written.
4. [`gates/`](./gates) — last, on code that exists.

[`brainstorms/`](./brainstorms) is deliberately absent from that list: if the shape is not decided,
coding has not started, and deciding it belongs to a skill — layout, then block.

Read [`skills/skill-shape`](./skills/skill-shape) when you are about to run a skill or write one, not
before every task.

A request that cannot resolve its project, its role targets or its write boundary is stuck before any
target-specific work. Say so; do not proceed on a guess.

## Capabilities

Seven. `skills/starci-*` holds them; `skills/skill-shape` holds what they must all print, ask and
record. Six do the work; the seventh only looks at the other six.

| Skill | Owns |
|---|---|
| `starci-init` | making a Source ready: the bootstrap, `.workspace/<project>/`, `.worktrees/<project>/` — three roots, approved separately |
| `starci-diagnose` | a read-only trace of another skill; writes nothing it traces |
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
- the lint machines are real ESLint plugins, published from `starci183/starci-eslint` as
  `@starci/eslint-canon-fe` and `@starci/eslint-canon-be`, each rule shipped with the test that fires it.
  **This tree is the law; that repository is the machine.** A rule there with no law here is
  unaccountable; a law here with no rule there only advises;
- an approval binds to the hash of canonical JSON with the envelope outside it, so re-running the same
  decision yields the same hash.

## Authoring

Every module is one document in two records: `en.md` for the agent, `vi.md` for the human. They match
section for section and neither refers to the other. A shelf may carry its own `en.md`, which becomes
that shelf's page.

Rules live in the tree. This file routes; it never restates a rule, and neither does the Source
bootstrap.
