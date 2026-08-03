---
name: starci-setup-workspace
description: Registers and resolves BOTH sources this machine works against — the front end's folder, branch, dev URL, Storybook URL, design-system folder, and the back end's folder, branch, and the HTTP port it actually serves on (read from CORE_PORT/PORT/APP_PORT/HTTP_PORT/SERVER_PORT in its .env/.env.override/.env.local/.env.development before falling back to the default in its own config code, `be.url` null and `be.ports_found_by` naming the file when nothing is found) — through one `--fe`/`--be` pair of flags, sharing a single gitignored per-machine context file and one pair of scripts. Use this skill whenever a task needs to know where either side's code actually lives, before opening, editing, grepping, or running anything in it: "set up the workspace", "point this at my app/api", "which repo is the FE", "which repo is the BE", "what port does the api run on", "what's the storybook url", "máy này FE/BE là repo nào", "api chạy port mấy", "the skill is reading the wrong frontend", "switch to project X". Use it even when the request never says "workspace" or "setup" — any FE or BE task on a fresh machine, a fresh clone, or a machine holding several checkouts needs this first, because a remembered path is right on one machine and silently wrong on the next. The same skill also declares and resolves per-project secrets — names only, in the workspace record; the values live in env vars and never touch this public repo: "set the vps password", "add cloudflare token", "khai secret cho project", "set github credentials", "which env var holds the token". Not for choosing which storybook is the design system (use starci-setup-storybook).
---

# Front-end + back-end workspace

A path written into a document is true on exactly one machine. Whatever drive and root a document
names, the next machine answers differently — so any skill that remembers a path is already wrong
somewhere, quietly, and the failure looks like success: files open, greps return, conclusions get
drawn from the wrong tree. That is as true of the API the front end talks to as it is of the front
end itself, so one skill resolves both sources rather than making a reader hold two.

So nothing here remembers. You state the source(s) once per machine; every skill afterwards asks.

## Quick start

```bash
# register either side (a folder, or a git URL to clone) — or both at once
node .claude/scripts/workspace/register-workspace-source.mjs --fe <dir-or-git-url> --be <dir-or-git-url> [--project <name>]

# use it
node .claude/scripts/workspace/read-workspace-context.mjs fe.path
node .claude/scripts/workspace/read-workspace-context.mjs be.url
```

Then work against `$(node .claude/scripts/workspace/read-workspace-context.mjs fe.path)` rather than a literal path.

## What you can ask for

| Key | What it holds |
|---|---|
| `fe.path` | the front end's folder, absolute |
| `fe.branch` · `fe.head` | branch, and the last commit with its date |
| `fe.url` | dev server, from the repo's own `dev` script or its framework's default |
| `fe.storybook_url` | from the repo's own `storybook` script |
| `fe.design_system` | this project's own `.storybook/`, if any — normally null; the one shared book is `design_system.path` |
| `fe.artifacts` | `.artifacts/`, when the project has one |
| `fe.remote` · `fe.name` | origin URL, package name |
| `be.path` | the back end's folder, absolute |
| `be.branch` · `be.head` | branch, and the last commit with its date |
| `be.url` | `http://localhost:<port>`, or `null` when no port could be found |
| `be.ports_found_by` | which key and which file answered — an `.env` line or a config default |
| `be.remote` · `be.name` | origin URL, package name |

`be.url`'s port comes from `CORE_PORT`, `PORT`, `APP_PORT`, `HTTP_PORT`, or `SERVER_PORT` — read
first out of `.env`, `.env.override`, `.env.local`, `.env.development`, in that order, and only
when none of those files sets one of those keys does it fall back to the default written into the
repo's own config: `src/modules/env/config.ts`, `src/config/configuration.ts`, `src/config.ts`, or
`src/main.ts`, whichever exists. `be.ports_found_by` says which of those answered, so a wrong port
is a one-line trace rather than a guess.

```bash
node .claude/scripts/workspace/read-workspace-context.mjs              # everything, for a human
node .claude/scripts/workspace/read-workspace-context.mjs fe.path      # one value, bare — safe in $(...)
node .claude/scripts/workspace/read-workspace-context.mjs be.url       # same, for the API port
node .claude/scripts/workspace/read-workspace-context.mjs --json       # the whole record
```

A missing context exits 1 and prints the command that fixes it. Honour that exit code: continuing
with an empty string builds a path like `/src/app` and then fails somewhere far from the cause.

## Registering

```bash
node .claude/scripts/workspace/register-workspace-source.mjs --fe ../shop-web --project shop
node .claude/scripts/workspace/register-workspace-source.mjs --be ../shop-api --project shop
node .claude/scripts/workspace/register-workspace-source.mjs --fe ../shop-web --be ../shop-api --project shop
node .claude/scripts/workspace/register-workspace-source.mjs --fe https://github.com/acme/shop-web.git --into ~/Repositories
node .claude/scripts/workspace/register-workspace-source.mjs <fe-dir> <be-dir>     # positional: front end first, back end second
```

Either role may be stated alone — a front-end-only or back-end-only project registers just the one
flag it has. Stating both writes both into the same record in a single call.

A git URL is cloned — into the current directory, or into `--into <dir>`. Running it again reuses
the clone. A folder already sitting at the target is adopted only if its `origin` matches; a folder
that merely shares a name is refused, because adopting it is how the wrong tree gets registered.

Several projects live side by side. `--list` shows them with `*` on the current one, `--use <name>`
switches, and everything read through `read-workspace-context.mjs` follows that switch — no other skill needs to
know it happened.

## Secrets (env-only)

A secret's *value* never lives in this repo — only its *name* does. `.claude` is public, so
anything written into `workspace.json` is written for anyone to read; a manifest of names is safe
there, a manifest of values is not. So the name goes into a per-project `secrets` manifest and the
value stays in an environment variable named `<PROJECT>_<NAME>` (the project uppercased) — set
once per machine, never written to disk by anything in this skill.

```bash
# declare which secrets a project needs (names only). Works on the current project without
# re-stating --fe/--be.
node .claude/scripts/workspace/register-workspace-source.mjs --secrets VPS_PASS,CLOUDFLARE_TOKEN,DO_TOKEN,GITHUB_TOKEN

# read one value back out of the environment
node .claude/scripts/workspace/read-workspace-context.mjs secret.VPS_PASS
```

For a project registered as `starci`, `secret.VPS_PASS` reads `process.env.STARCI_VPS_PASS`. The
command prints the bare value — safe in `$(...)`, safe to pipe straight into `gh secret set` — or,
when the env var isn't set, exits non-zero and names exactly which var to set. It never prints a
value speculatively, and never on failure.

The human view — `read-workspace-context.mjs` with no key — lists every secret the current project
declares as present or missing, by name only:

```
SECRETS  (values live in env as <PROJECT>_<KEY>, never on disk)
  ok   STARCI_VPS_PASS
  MISS STARCI_CLOUDFLARE_TOKEN
```

These are the names `starci-deploy-vps` and `starci-deploy-k8s` read at deploy time. Declaring them
here first means a missing credential shows up as `MISS` before a deploy goes looking for it, not
partway through one.

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

`looks_like_role` reports which dependency of the stated role the folder carries — `next`, `vite`,
`nuxt`, `@angular/core`, … for a front end; `@nestjs/core`, `express`, `fastify`, `koa`,
`@hapi/hapi` for a back end. It is a note, not a veto — a stack this list has never met is still
whatever you said it is.

## Before trusting a recorded path

```bash
node .claude/scripts/workspace/register-workspace-source.mjs --check
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
- **Assuming the API's port from habit.** `be.url` is read out of the repo's own `.env` files and,
  failing that, its own config default — never guessed. A `null` here means neither told it
  anything; `be.ports_found_by` says exactly where it looked.
- **Treating a missing `fe.design_system` as breakage.** A registered source should not carry its
  own `.storybook/` — there is one shared book. `null` here is the expected answer; ask
  `design_system.path` (see starci-setup-storybook) for the book everyone reads.
- **Committing `context/`.** It is the one file guaranteed wrong on the next machine.

## Files

| Path | What it is |
|---|---|
| `.claude/scripts/workspace/register-workspace-source.mjs` | writes the record |
| `.claude/scripts/workspace/read-workspace-context.mjs` | reads it |
| `.claude/context/workspace.json` | the record, gitignored, per machine |
| `README.md` | why this is shaped the way it is |
| `test.mjs` | run after any change: `node .claude/skills/starci-setup-workspace/test.mjs` |

Front end and back end are one skill, not two, precisely because both varied per machine and per
project in the same way: registering both at once is `--fe <dir> --be <dir>`, into the one record,
through the one pair of scripts above.
