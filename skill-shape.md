# skill shape

Every skill here has three parts, in this order. Read this before running one.

## 1 · SCOPE — print this table before doing anything

| | |
|---|---|
| Doing | one sentence |
| App | `starci-academy`, `nivo` or `nivo-expert-academy` — the product, not the repository |
| Repo / branch | real path, from `git rev-parse` and `git branch --show-current` |
| Touching | the paths that may be written |
| Not touching | everything else |
| Produces | something you can open |

Three rows carry the whole old lock. The repo being changed is rarely the repo holding these rules,
and a backend monorepo builds several apps from one tree — name the app and the database connection
when either is in play. An entity written against the wrong connection compiles and writes to a
table nobody reads.

`App` is not a label on the work, it is where the task file is filed: `<backend-repo>/.workflows/<app>/`.
A phase that cannot name the app cannot write its record, which is the point — a product is usually
several repositories, so `Repo / branch` alone never says which product this belongs to, and the
frontend and backend halves of one feature would file themselves in two different places.

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

One task is one file, and it lives with the PRODUCT rather than with these rules:

```
<backend-repo>/.workflows/<app>/<id>.md
```

| app | file |
|---|---|
| `starci-academy` | `starci-academy-backend/.workflows/starci-academy/<id>.md` |
| `nivo` | `nivo-backend/.workflows/nivo/<id>.md` |
| `nivo-expert-academy` | `nivo-backend/.workflows/nivo-expert-academy/<id>.md` |

Every phase appends to it; none creates another.

**The backend repository is the home even for frontend work.** A product is several repositories —
a frontend, a backend, a legacy reference — and one feature crosses them: the cart is a page, a
drawer, a query and a pricing rule. Filed in the frontend it would be invisible to whoever changes
the schema underneath it; split across both it would be two records disagreeing by the second
commit. The backend is the one repository every part of a product has to pass through, so it holds
the record for all of them.

**Not in this tree, and that is the change.** These rules are shared and mirrored; the record is
neither. A task file here would travel to repositories the work never touched and would be missing
from the clone of the repository it did. It also outlives this tree's own reorganisations, which is
what a record is for.

**The app folder survives even inside one repository**, because `nivo-backend` builds both `nivo`
and `nivo-expert-academy` from `apps/core` and `apps/expert-academy-api`. Without the app level the
two products share one folder and collide on any obvious id — `cart` means one thing in a course
marketplace and another in an expert console, and the second one written would have to invent a
longer name to dodge the first.

It is not filed under `apps/<app>/` either. A task that changes two apps, or changes only the
frontend, would have nowhere to go — and the record would then be describing the repository's
current layout rather than the product, so a monorepo fold would move every record in it.

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
available: `starci-workflow-drift` reads every `<backend-repo>/.workflows/*/*.md` and asks the source whether it
still matches — each file under `WROTE` still there, nothing new inside `Touching` that `WROTE` never
named, each state under `STATES` still rendering what it rendered.

Drift is therefore FOUND rather than prevented, which is the honest trade: prevention cost a hash per
file and a phase that refused to finish, and detection costs one skill run over the whole history.
