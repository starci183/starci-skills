# skill shape

Every skill here has three parts, in this order. Read this before running one.

## 1 · SCOPE — print this table before doing anything

| | |
|---|---|
| Doing | one sentence |
| Repo / branch | real path, from `git rev-parse` and `git branch --show-current` |
| Touching | the paths that may be written |
| Not touching | everything else |
| Produces | something you can open |

Two rows carry the whole old lock: the repo being changed is rarely the repo holding these rules, and
a backend monorepo builds several apps from one tree — name the app and the database connection when
either is in play. An entity written against the wrong connection compiles and writes to a table
nobody reads.

Before the first write into production source, confirm `Repo / branch` and `Touching` with the user.
Once. Detection is not permission.

## 2 · PROCESS — run until genuinely stuck, then return

```
work ──► stuck? ──yes──► OUTPUT A ──user confirms──┐
         │                                          │
         └──no──► finished ──► OUTPUT B             │
                                                    │
         ◄──────────── keep working ◄───────────────┘
```

Stuck means no further progress is possible, not that something is unclear. Anything that does not
block gets decided, written down in one line, and passed. A tool that refuses — a browser that will
not screenshot — is work, not a stop: take the other path first.

Two conditions on every A round:

- Batch everything currently known into one ask. Knowing three things and asking three times is the
  failure this shape exists to end.
- After the answer, keep going **inside the same skill**. Do not make the user invoke it again.

A rounds may repeat. Not knowing every obstacle up front is normal; asking them one at a time is not.

**UX and UI choices inside an approved direction are yours.** A label's wording, words versus a glyph,
one ordering over another — take it, record one line with the reason, let the review overturn it. Only
what can be WRONG goes to A: a fact you derived rather than read, a promise, a permission, a price.
Being overruled later does not undo one of those once it ships.

## 3 · OUTPUT — two shapes, and there is no third

**A — something needs the user:**

```
CHOOSE    <what> — a) <the default in force>  b) <the other>
RESOURCE  <what is missing> — run: <the exact command>   → I read it back and continue
SUB-RUN   <skill name> — it produces <what>, then RETURNS here
```

A sub-run is a detour. The skill that asked for it owns the result and finishes; it is never a
handover.

**B — nothing is stuck:**

```
Done. <what exists now>.

Next — <skill name>:
  does        <one sentence>
  touches     <paths>
  will ask    <the one question, or "nothing">
  produces    <something you can open>

Say the word.
```

The last skill in a chain closes with B minus the invitation: what runs, and what is still owed.

No third shape. No "waiting on", no "needs clarification", no progress report.

## The task file

One task is one file: `.claude/workflows/<id>.md`. Every phase appends to it; none creates another.

```markdown
# refactor-authentication

## plan
SCOPE   <the table>
CHOSE   direction B — <the user's reason>
TOOK    <each UX call, one line each>

## review
SCOPE   <the table>
STATES  <owner → state → rendered?>
BACKEND <missing field → which skill covers it>
APPROVED <what the user approved>

## apply
SCOPE   <the table>
WROTE   <every file>
GREEN   tsc / lint / build
OWED    <or "nothing">
```

A later phase reads this file instead of rediscovering anything.

**This is also what replaces the seal**, and it replaces it with something stronger. A seal guards one
run while that run is happening and knows nothing afterwards. This file stays, so the comparison stays
available: `starci-workflow-drift` reads every `.claude/workflows/*.md` and asks the source whether it
still matches — each file under `WROTE` still there, nothing new inside `Touching` that `WROTE` never
named, each state under `STATES` still rendering what it rendered.

Drift is therefore FOUND rather than prevented, which is the honest trade: prevention cost a hash per
file and a phase that refused to finish, and detection costs one skill run over the whole history.
