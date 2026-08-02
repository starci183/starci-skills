---
name: starci-setup-workspace-be
description: Registers and resolves the BACK-END source this machine works against — its folder, branch, and the HTTP port it will actually serve on — and stores it per machine in a gitignored context file. Use this skill whenever a task needs to know where the backend code lives or which port it listens on, before opening, editing, grepping, migrating, or calling it: "set up the backend", "point this at my api", "which repo is the BE", "what port does the api run on", "find the entity for X", "run the migration", "the skill is reading the wrong backend", "switch to project X". Use it even when the request never says "workspace" or "setup" — any backend task on a fresh machine, a fresh clone, or a machine holding several checkouts needs this first, because a remembered path is right on one machine and silently wrong on the next. Not for front-end paths or Storybook URLs (use starci-setup-workspace-fe).
---

# Back-end workspace

A path written into a document is true on exactly one machine. Whatever drive and root a document
names, the next machine answers differently — and the backend often sits a folder deeper than
anyone assumed. Any skill that remembers a path is already wrong somewhere, quietly, and the
failure looks like success: files open, greps return.

The port is the same problem in miniature. `3000` is a habit, not a fact.

## Quick start

```bash
# register the back end (folder, or a git URL to clone)
node .claude/scripts/workspace/register-workspace-source.mjs --be <dir-or-git-url> [--project <name>]

# use it
node .claude/scripts/workspace/read-workspace-context.mjs be.path
node .claude/scripts/workspace/read-workspace-context.mjs be.url
```

## What you can ask for

| Key | What it holds |
|---|---|
| `be.path` | the folder, absolute |
| `be.branch` · `be.head` | branch, and the last commit with its date |
| `be.url` | where it will actually serve — see below |
| `be.remote` · `be.name` | origin URL, package name |
| `be.ports_found_by` | which file the port came from |

```bash
node .claude/scripts/workspace/read-workspace-context.mjs              # everything, for a human
node .claude/scripts/workspace/read-workspace-context.mjs be.url       # one value, bare — safe in $(...)
node .claude/scripts/workspace/read-workspace-context.mjs --json       # the whole record
```

A missing context exits 1 and prints the command that fixes it. Honour that exit code — a caller
that ignores it ends up calling `http://localhost:undefined`.

## How the port is worked out

Read, in this order, and stop at the first answer:

1. `CORE_PORT` · `PORT` · `APP_PORT` · `HTTP_PORT` · `SERVER_PORT` in `.env`, `.env.override`,
   `.env.local`, `.env.development`
2. the same names' default in `src/modules/env/config.ts`, `src/config/configuration.ts`,
   `src/config.ts`, or `src/main.ts`

`.env` wins because overriding the default is exactly what an `.env` is for — a machine that moved
its port did so there. `be.ports_found_by` names the file that answered, so a surprising port can
be traced in one step instead of guessed at.

Nothing found means `be.url` is `null`, and null is the honest answer. Fill it in
`.claude/context/workspace.json` by hand if the project states its port somewhere unusual.

## Registering

```bash
node .claude/scripts/workspace/register-workspace-source.mjs --be ../shop-api --project shop
node .claude/scripts/workspace/register-workspace-source.mjs --be git@github.com:acme/shop-api.git --into ~/Repositories
node .claude/scripts/workspace/register-workspace-source.mjs <fe-dir> <be-dir>     # positional: back end second
```

A git URL is cloned — into the current directory, or into `--into <dir>`. Running it again reuses
the clone. A folder already at the target is adopted only if its `origin` matches; one that merely
shares a name is refused, because adopting it is how the wrong tree gets registered.

`--list` shows every registered project with `*` on the current one, `--use <name>` switches, and
everything read through `read-workspace-context.mjs` follows.

## It does not search for your repo

State the source. The script records it.

An earlier version swept the machine for folders that looked like a backend and offered **52
candidates** — git worktrees are full copies of the repo, and each one looked exactly as valid as
the original. Searching produced a confident answer to a question only the person at the keyboard
can settle.

`looks_like_role` reports which server dependency the folder carries (`@nestjs/core`, `express`,
`fastify`, `koa`, …). It is a note, not a veto — a stack this list has never met is still whatever
you said it is. One thing it does enforce: a folder cannot be registered as both roles at once,
because a backend that carries `vite` to build an internal dashboard once got recorded as the front
end too, and every front-end lookup then pointed at the API.

## Before trusting a recorded path

```bash
node .claude/scripts/workspace/register-workspace-source.mjs --check
```

Paths rot. `--check` costs nothing and turns a confusing failure later into a clear one now. A
changed branch is a warning rather than a failure — the tree is still right — but read it, because
migrations and entities differ across branches and a wrong answer there is expensive.

## Common mistakes

- **Assuming the port.** `3001` here, `4000` there, and an `.env` can move it today. Ask `be.url`.
- **Remembering a path from earlier in the conversation.** True for that machine, that project.
- **Two checkouts of the same repo.** Same remote, same branch, same folder name — only the date on
  `be.head` separates them. Register the one you mean.
- **Reading `be.url` as "the server is running".** It is where it *would* serve. Starting it is a
  separate act.
- **Committing `context/`.** It is the one file guaranteed wrong on the next machine.

## Files

| Path | What it is |
|---|---|
| `.claude/scripts/workspace/register-workspace-source.mjs` | writes the record |
| `.claude/scripts/workspace/read-workspace-context.mjs` | reads it |
| `.claude/context/workspace.json` | the record, gitignored, per machine |
| `README.md` | why this is shaped the way it is |
| `test.mjs` | run after any change: `node .claude/skills/starci-setup-workspace-be/test.mjs` |

The front end is a separate skill, `starci-setup-workspace-fe`. They share one record and one pair
of scripts, so registering both at once is `--fe <dir> --be <dir>`.
