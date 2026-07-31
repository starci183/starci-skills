---
name: starci-setup-workspace-fe
description: Registers and resolves the FRONT-END source this machine works against — its folder, branch, dev URL, Storybook URL, design-system folder — and stores it per machine in a gitignored context file. Use this skill whenever a task needs to know where the front-end code actually lives, before opening, editing, grepping, or running anything in it: "set up the frontend", "point this at my web app", "which repo is the FE", "what's the storybook url", "open the story for this card", "the skill is reading the wrong frontend", "switch to project X". Use it even when the request never says "workspace" or "setup" — any front-end task on a fresh machine, a fresh clone, or a machine holding several checkouts needs this first, because a remembered path is right on one machine and silently wrong on the next. Not for backend paths (use starci-setup-workspace-be) and not for choosing a component or a tier.
---

# Front-end workspace

A path written into a document is true on exactly one machine. Whatever drive and root a document
names, the next machine answers differently — so any skill that remembers a path is already wrong
somewhere, quietly, and the failure looks like success: files open, greps return, conclusions get
drawn from the wrong tree.

So nothing here remembers. You state the source once per machine; every skill afterwards asks.

## Quick start

```bash
# register the front end (folder, or a git URL to clone)
node .claude/scripts/register-workspace-source.mjs --fe <dir-or-git-url> [--project <name>]

# use it
node .claude/scripts/read-workspace-context.mjs fe.path
```

Then work against `$(node .claude/scripts/read-workspace-context.mjs fe.path)` rather than a literal path.

## What you can ask for

| Key | What it holds |
|---|---|
| `fe.path` | the folder, absolute |
| `fe.branch` · `fe.head` | branch, and the last commit with its date |
| `fe.url` | dev server, from the repo's own `dev` script or its framework's default |
| `fe.storybook_url` | from the repo's own `storybook` script |
| `fe.design_system` | `.storybook/`, when the project has one |
| `fe.artifacts` | `.artifacts/`, when the project has one |
| `fe.remote` · `fe.name` | origin URL, package name |

```bash
node .claude/scripts/read-workspace-context.mjs              # everything, for a human
node .claude/scripts/read-workspace-context.mjs fe.path      # one value, bare — safe in $(...)
node .claude/scripts/read-workspace-context.mjs --json       # the whole record
```

A missing context exits 1 and prints the command that fixes it. Honour that exit code: continuing
with an empty string builds a path like `/src/app` and then fails somewhere far from the cause.

## Registering

```bash
node .claude/scripts/register-workspace-source.mjs --fe ../shop-web --project shop
node .claude/scripts/register-workspace-source.mjs --fe https://github.com/acme/shop-web.git --into ~/Repositories
node .claude/scripts/register-workspace-source.mjs <fe-dir> <be-dir>     # positional: front end first
```

A git URL is cloned — into the current directory, or into `--into <dir>`. Running it again reuses
the clone. A folder already sitting at the target is adopted only if its `origin` matches; a folder
that merely shares a name is refused, because adopting it is how the wrong tree gets registered.

Several projects live side by side. `--list` shows them with `*` on the current one, `--use <name>`
switches, and everything read through `read-workspace-context.mjs` follows that switch — no other skill needs to
know it happened.

## It does not search for your repo

State the source. The script records it.

An earlier version swept the machine for folders that looked like a front end, and every defect its
test suite found came from that sweep: 52 candidates for one role because git worktrees are full
copies; a backend claimed as the front end because it carries `vite` to build a dashboard; a clone
15 days stale picked silently because it happened to sit nearer. Each was a confident answer to a
question only the person at the keyboard can settle.

What *is* read from the repo — never invented — is anything with one verifiable source: the
Storybook port from `scripts.storybook`, the dev port from `scripts.dev` or the framework's own
default, branch and last commit from git. Every field records **how** it was found, so a wrong
value can be traced instead of argued about.

`looks_like_role` reports which front-end dependency the folder carries (`next`, `vite`, `nuxt`,
`@angular/core`, …). It is a note, not a veto — a stack this list has never met is still whatever
you said it is.

## Before trusting a recorded path

```bash
node .claude/scripts/register-workspace-source.mjs --check
```

Paths rot: trees get moved, renamed, deleted, or switched to another branch. `--check` costs
nothing and turns a confusing failure later into a clear one now. It warns rather than fails on a
branch change, because the tree is still the right one — but a skill reading one branch's canon
while another is checked out will mislead you, so read the warning.

## Common mistakes

- **Remembering a path from earlier in the conversation.** It was true for that machine and that
  project. Ask again; the answer is one command.
- **Two checkouts of the same repo.** They look identical — same remote, same branch, same folder
  name. The date on `fe.head` is what separates them. Register the one you mean.
- **Assuming port 3000.** That is `next dev`'s default, not a fact about this project. `fe.url`
  says what will actually serve.
- **Treating a missing `fe.design_system` as breakage.** A project without `.storybook/` simply has
  no design-system lane. `null` is the honest answer, not an error.
- **Committing `context/`.** It is the one file guaranteed wrong on the next machine.

## Files

| Path | What it is |
|---|---|
| `.claude/scripts/register-workspace-source.mjs` | writes the record |
| `.claude/scripts/read-workspace-context.mjs` | reads it |
| `.claude/context/workspace.json` | the record, gitignored, per machine |
| `README.md` | why this is shaped the way it is |
| `test.mjs` | run after any change: `node .claude/skills/starci-setup-workspace-fe/test.mjs` |

The back end is a separate skill, `starci-setup-workspace-be`. They share one record and one pair
of scripts, so registering both at once is `--fe <dir> --be <dir>`.
