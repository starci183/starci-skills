# starci-setup-storybook-choose — notes

`SKILL.md` says what to do. This file says why it is shaped this way. Read it before changing
anything here.

## The idea underneath

The whole set works by **indirection through a ledger**. A skill never names a source — it names a
**role**, and `context/workspace.json` binds that role to something concrete, per machine. Plug one
source into the ledger and every skill in the set works against it, without any of them knowing
which app they are serving.

The hard part is not the mechanism, it is **which level each binding lives at**:

| Key | Level | Wrong level does what |
|---|---|---|
| `fe.path` | per project | shared → two different apps get one path, which is nonsense |
| `design_system` | **the whole ledger** | per project → every app grows its own book and they drift |

That table is the reason this skill exists. An app with no `.storybook/` of its own is not missing
a design system — it **borrows** the ecosystem's. Once you see it that way, the fix stops being
"patch each app" and becomes "one book, many readers".

Switching the current project changes `fe.path` and leaves `design_system.path` untouched. That is
the whole design in one line of output.

## The price of sharing one book

A shared blueprint means a shared blast radius. Editing the book changes what every borrowing app
is built from. That is the power and the risk in one sentence, so the rule that goes with it is not
decoration: **the book has one home; borrowers read, never write.** A borrowed copy that gets
edited splits the ecosystem, and nothing announces it.

There is deliberately **no per-project override** yet. If one app ever needs an older book it takes
a single line — `projects.<name>.design_system` beating the ledger value. Building it before a real
case exists would repeat a mistake the workspace skill already paid for once.

## Candidates come from the ledger, never from a sweep

A machine can hold two clones of one repo:

```
<root-a>/app       storybook ✓  main ✓  script ✓  same origin
<root-b>/app       storybook ✓  main ✓  script ✓  same origin   ← weeks behind
```

Every technical test passes on both. **Nothing about the folders separates them** — only the ledger
does, because only one of them is registered. So candidates are read from registered sources, and
the canonical checkout is recognised by **git origin**, never by folder name: names are free.

When two registered sources still qualify, it refuses and prints both with their last commit. The
date is usually what tells you which one you meant.

## What "usable" means, and why the check is not paranoid

`fe.design_system` in the workspace record is set from `existsSync` alone, so an **empty**
`.storybook/` satisfies it — the test fixtures in that skill create exactly that. Adopting it would
point the whole ecosystem at a shell that renders nothing. So a storybook counts here only with a
`main.*` **and** a `storybook` script, and a refusal names which half is missing.

## Running the tests

```bash
node .claude/skills/starci-setup-storybook-choose/test.mjs
node .claude/scripts/run-all-tests.mjs                     # every skill's suite
```

19 cases, built under `.testtmp/` and deleted again — fake repos, fake ledgers, a local bare repo
standing in for a remote. Nothing touches the network, and this machine's real ledger is never
read or written.

**When a case fails, read the real output before changing the code.** In this set the case has been
the wrong thing more often than the code has — asserting lowercase against an uppercase verdict,
searching a whole output for a string belonging to one section, and most recently a fixture whose
`.storybook/` was empty, so git dropped the folder on clone and the case meant to test *"config
missing"* ended up testing *"folder missing"*.

## What these tests cannot tell you

They test the script. They say nothing about whether an agent holding this skill asks for
`design_system.path` instead of assuming a folder. That is a behaviour question and needs an eval —
same prompt with and without the skill in one turn, graded blind, in the shape `max-pro-vip/evals/`
already uses.

> **prompt** — "Add a Badge atom to the design system."
>
> **expected** — Asks `design_system.path` rather than guessing `.storybook` under the current
> project. Notices the current project may be borrowing, and writes to the book's one home.
