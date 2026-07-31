# starci-setup-workspace-be — notes

`SKILL.md` says what to do. This file says why it is shaped this way and what it refuses to do.
Read it before changing anything here.

## Why the pair is split

`starci-setup-workspace-be` and `starci-setup-workspace-fe` share one record and one pair of
scripts. They are two skills because they are asked for at different moments and carry different
knowledge: the port-resolution order below matters to nobody fixing a card, and a Storybook URL
matters to nobody writing a migration. They register into the same `context/workspace.json`, so
`--fe <dir> --be <dir>` still does both at once.

## The port is the interesting half

A wrong path fails loudly on the first `ls`. A wrong port fails *quietly* — the call is refused,
and it looks exactly like the server being down. So the port is read, in this order, stopping at
the first answer:

1. `CORE_PORT` · `PORT` · `APP_PORT` · `HTTP_PORT` · `SERVER_PORT` in `.env`, `.env.override`,
   `.env.local`, `.env.development`
2. the same names' default in `src/modules/env/config.ts`, `src/config/configuration.ts`,
   `src/config.ts`, `src/main.ts`

`.env` wins because overriding the default is exactly what an `.env` is for. Only config-shaped
files are read — scanning a whole `src/` tree would be slow and would start matching comments.

When nothing answers, `be.url` is `null` and `workspace.mjs be.url` exits 1. That is deliberate: a
guessed port produces `ECONNREFUSED` somewhere far from its cause, while a null produces a failure
at the moment the question was asked.

## What varies, and why a document cannot hold it

| Varies per | What goes wrong when it is written down |
|---|---|
| **machine** | a document names one drive and root; the next machine answers differently, often a folder deeper |
| **project** | the same skill gets pointed at a different API |

Any canon file that writes a path or a port down is the reason this skill exists — and rewiring
such a file to ask instead is the work that follows adopting this set.

## It does not search — that was learned the hard way

An earlier version swept the machine for folders that looked like a backend and offered dozens of
candidates. Git worktrees are full copies of a repo, and each looked exactly as valid as the
original. A second defect from the same sweep: a backend carrying a bundler for an internal
dashboard matched the front-end role too, so both roles resolved to one folder while the run
reported success — and every front-end lookup then pointed at the API.

The guard that survived is worth keeping: one folder cannot hold both roles.

## Running the tests

```bash
node .claude/skills/starci-setup-workspace-be/test.mjs
node .claude/scripts/run-all-tests.mjs                      # every skill's suite
```

The suite builds backends under `.testtmp/` — one with only a code default, one with an `.env`
overriding it, one saying plain `PORT`, one saying nothing at all — and deletes them again. This
machine's own `context/workspace.json` is never touched.

Several cases require a **failure**: a path that does not exist, one folder given for both roles, a
project with no port answering null rather than a number. A refusal nobody has watched fire is not
known to fire.

**When a case fails, read the real output before changing the code.** These four cases found a real
argument-parsing bug — `--dry --project shop --be <dir>` treated `shop`, the value of `--project`,
as a bare positional word and tried to open it as a folder — because boolean flags were consuming
the token after them.

## What these tests cannot tell you

They test the scripts. They say nothing about whether an agent holding this skill actually asks for
`be.url` instead of assuming 3000. That is a behaviour question and needs an eval: the same prompt
with the skill and without it in the same turn, graded blind, in the shape `max-pro-vip/evals/`
already uses.

> **prompt** — "Call the enrollment endpoint and show me what it returns."
>
> **expected** — Asks `workspace.mjs be.url` rather than typing `localhost:3000`. With no context
> recorded, stops and says to run setup.

That eval has not been run yet.
