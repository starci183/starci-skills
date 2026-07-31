---
name: starci-record-debt
description: Records work that was deliberately left undone — the files, the rule it breaks, and the reason it was deferred — into a per-machine debt folder, and reads it back later. Use this skill whenever a fix is knowingly postponed or a shortcut is knowingly taken: "skip this for now", "leave it, note it down", "we'll do this later", "park it", "record the debt", "what did we defer", "what's still outstanding", "is there anything known-broken here before I change it". Use it also at the START of work on an unfamiliar area, to check whether the odd-looking code in front of you was already weighed and deferred rather than never noticed. Not a bug tracker and not a backlog — an entry needs named files and a stated reason; something with neither is a task, not debt.
---

# Recording debt

A decision to not fix something is a real decision, and it is the one that evaporates. It is made
in the middle of a session, the session ends, and what survives is code that looks exactly like
code nobody ever thought about.

That gap costs twice. The next reader re-derives the whole argument from scratch — or, worse,
reads the shortcut as the house pattern and copies it.

## Quick start

```bash
node .claude/scripts/record-technical-debt.mjs add \
  --title "Atoms still accept className" \
  --role fe --rule ATOM-5 --cost medium \
  --path .storybook/components/atoms \
  --why "Composites forward an opaque className string into atoms, so cutting the prop breaks 9 call sites that have no prop to land on yet."
```

```bash
node .claude/scripts/record-technical-debt.mjs list        # what is open
node .claude/scripts/record-technical-debt.mjs --check     # do the paths still exist
```

## `--why` is required, and that is the whole point

An entry without a reason records that something is wrong — which the code already showed. The
reason it *stayed* wrong is the part that exists only in someone's head at the moment of deferring,
and it is gone by the next session.

Three reasons that are worth writing, and read differently later:

| Reason | What it tells the next reader |
|---|---|
| the fix needs a decision nobody has made yet | do not start; go get the decision |
| the fix is mechanical but wide | schedule it; it will not get smaller |
| the shortcut is correct here and wrong in general | do not "fix" it — read this first |

If none of them fit and the honest answer is "we ran out of time", write that. It is still more
than the code says.

## Fields

| Flag | | |
|---|---|---|
| `--title` | required | one line, as a person would say it |
| `--why` | required | why it was left — see above |
| `--role` | `fe` · `be` · `design_system` · `claude` | which tree it lives in; `claude` is this skill set's own debt |
| `--path` | repeatable | **relative to that tree** |
| `--rule` | | the rule it breaks, if there is one — `ATOM-5`, `no-vendor-in-blocks` |
| `--cost` | `small` · `medium` · `large` | rough shape of the fix, not an estimate |
| `--blocked-by` | | what has to happen first |
| `--what` · `--fix` · `--note` | | body sections, when one line is not enough |

## Paths are relative, by role

An entry says `--role fe` and a path inside that tree. Which folder `fe` means is a per-machine
answer that `starci-setup-workspace-fe` already owns, so an entry written on one machine still
resolves on the next. An absolute path is refused — it would be a second, competing, quietly wrong
copy of the workspace registry.

## Reading it back

```bash
node .claude/scripts/record-technical-debt.mjs list --role fe
node .claude/scripts/record-technical-debt.mjs list --all --json
node .claude/scripts/record-technical-debt.mjs show <id>
```

**Read this before working in an unfamiliar area.** The whole reason to write debt down is that
the reader in front of the odd-looking code is usually not the person who left it.

## Closing

```bash
node .claude/scripts/record-technical-debt.mjs close <id> --how "Narrowed the composite props too; the last 9 forwards now land on classNames."
```

Closed, not deleted. A paid debt is evidence that the shape was noticed, weighed and settled — which
is what stops the next person reintroducing it.

## `--check`

```bash
node .claude/scripts/record-technical-debt.mjs --check      # exit 2 if any recorded path is gone
```

Debt rots in both directions, and neither shows up by reading the entry:

- somebody paid it without closing the entry — the note is now lying about the codebase
- the code moved — the debt is still real but no longer findable

Only a person can say which. `--check` costs nothing and turns a confusing note later into a clear
one now.

## Common mistakes

- **Recording a wish.** "Should probably use a queue here" has no named file and no deferral. It is
  an idea; ideas belong somewhere else.
- **A `TODO:` in the source instead.** A TODO says what to do and never says why it was not done —
  it loses exactly the field this tool makes required.
- **Closing by deleting the file.** Then the next reader has no way to tell "settled" from "never
  looked at".
- **Writing an absolute path.** True on one machine.
- **Recording it and not telling the person you are working with.** The entry is a record, not a
  substitute for saying it out loud.

## Files

| Path | What it is |
|---|---|
| `.claude/scripts/record-technical-debt.mjs` | the whole tool |
| `.claude/debt/<id>.md` | one entry, gitignored, per machine |
| `README.md` | why this is shaped the way it is |
| `test.mjs` | run after any change: `node .claude/skills/starci-record-debt/test.mjs` |

Entries are gitignored because they name your trees and your unfinished work, and this skill set is
public. A private workspace can un-ignore `debt/` — that is a one-line change and the format is
already made for review.
