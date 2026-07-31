---
name: setup-workspace
description: Use this skill to point this shared skill set at a source — which front-end and back-end repo it should work against on this machine — and to read those paths and URLs back. Triggers on "set up the workspace", "which repo is this skill reading", "switch to project X", "the skill is looking at the wrong source", "storybook url", "backend port", and on the first run of any skill on a new machine or a fresh clone. Also triggers when a path written in canon turns out to be wrong here. Not for choosing a component or a tier — this only answers which source, and where it lives.
argument-hint: "[--fe <path>] [--be <path>] [--project <name>] [--use <name>] [--list|--check]"
---

# Workspace setup

This skill set is shared across sources. Two different things vary, and both used to be written
into the documents:

| Varies per | Example of it going wrong |
|---|---|
| **machine** | canon says the trees are on `D:/Repositories`; here they are on `C:` |
| **project** | the same skill is pointed at a different app, with a different FE and BE |

So nothing in this set names a repo. A tree is described by its **role** — `fe`, `be` — and the
answer lives in `.context/workspace.json`, which is gitignored and never travels.

## Pointing it at a source

```bash
node scripts/workspace-setup.mjs --project <name> --fe <path> --be <path>
```

Either role may be omitted; a front-end-only source registers `--fe` alone. Run it with no flags
and it will try to detect, which works when the machine holds exactly one candidate per role.

It reads rather than assumes. A role is decided by what the repo **depends on** — `next`, `nuxt`,
`vite`, `@angular/core` for a front end; `@nestjs/core`, `express`, `fastify` for a back end —
because a dependency cannot be renamed without changing what the repo is, while a folder name can.
Ports come from the repo's own `scripts`, from `.env`, or from the default in its config file, and
every field records **how** it was found so a wrong value can be traced instead of argued about.

## Reading it back

| You want | Command |
|---|---|
| everything for the current project | `node scripts/workspace.mjs` |
| one value, bare, for `$(...)` | `node scripts/workspace.mjs fe.path` |
| the whole record | `node scripts/workspace.mjs --json` |
| is what was recorded still true | `node scripts/workspace-setup.mjs --check` |

Keys: `fe.path` · `fe.branch` · `fe.url` · `fe.storybook_url` · `fe.design_system` ·
`fe.artifacts` · `be.path` · `be.branch` · `be.url`.

Never hardcode a path in a skill. Ask here. A missing context exits 1 with the command that fixes
it, so a caller stops rather than continuing with an empty string.

## Several sources on one machine

```bash
node scripts/workspace-setup.mjs --list        # * marks the current one
node scripts/workspace-setup.mjs --use mia     # switch, no re-detection
```

Everything read through `workspace.mjs` resolves against the current project, so switching is the
whole operation — no skill needs to know it happened.

## When detection finds more than one

It **refuses to pick**, and prints each candidate with its branch and last commit:

```
FE
  path       — UNRESOLVED
  found by   7 candidates for front end — say which with --fe
    - C:\Repositories\ac\starci-academy    [mtp]  5dc1fc02 2026-07-16 refactor(components)…
    - C:\Repositories\starci-academy       [mtp]  99f1587d 2026-07-31 chore(storybook)…
```

This is the behaviour worth defending. A silent pick is how a clone weeks behind gets read as the
live tree, and every conclusion drawn from it is wrong while looking perfectly sound. On a machine
holding several projects this is the normal case, not the rare one — the date on the last commit
is usually enough to tell them apart.

Two roles landing on the **same folder** is also refused: it means detection matched on something
incidental, such as a backend that carries `vite` to build an internal dashboard.

## Overriding

| Way | When |
|---|---|
| `--fe <path>` / `--be <path>` | several candidates, or a stack the detector does not know |
| `STARCI_FE` / `STARCI_BE` env vars | a machine that always answers the same way |
| edit `.context/workspace.json` | a port only this machine uses |

`--dry` prints what it would write and writes nothing.

## Forbidden

| Forbidden | Why |
|---|---|
| committing `.context/` | it is the one file guaranteed wrong on the next machine |
| writing a path or a repo name into a skill | the thing this skill exists to end |
| letting setup pick between candidates | a stale tree reads exactly like a live one |
| continuing when the context is missing | `workspace.mjs` exits 1 on purpose; honour it |

## Red flags

- "The canon says the FE is on `D:`" → canon cannot know. Ask `workspace.mjs`.
- "It found a tree, so it's the right one" → check the last commit date when several exist.
- "This skill only makes sense for our app anyway" → then it is not a skill, it is a note about
  one repo. Describe the role, not the name.
- "The port is 3000, everyone knows that" → that is the framework's default, and a project may
  well have moved it.
