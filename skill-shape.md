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

| state | output | what happens next |
|---|---|---|
| stuck | **A** | the user answers, and the run continues **inside the same skill** |
| finished, something follows | **B** | the next skill is named and invited |
| finished, nothing follows | **C** | what runs, and what is owed |

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

## 3 · OUTPUT — three shapes, and there is no fourth

**Every one of them is a TABLE, and that is not decoration.** These outputs were fixed-width blocks
aligned with spaces, which only line up inside a monospace box — so the moment a `RESOURCE` line
carried a real command it ran past the edge or broke mid-word, and the reader got a wall instead of
a list. A table wraps inside its cell, so the column that says what KIND of thing this is stays
readable however long the thing itself gets. Prose beside the table is welcome; the table is what
carries the asks.

**A — something needs the user:**

| | what | the ask |
|---|---|---|
| CHOOSE | the decision | a) the default in force · b) the other |
| RESOURCE | what is missing | run: `the exact command` — then it is read back and the run continues |
| SUB-RUN | `$skill-name` | what it produces, then RETURNS here |

Only the rows that apply. A sub-run is a detour: the skill that asked for it owns the result and
finishes, and it is never a handover.

**B — nothing is stuck, and something comes next:**

Done. What exists now, in one line.

| Next | `$skill-name` |
|---|---|
| does | one sentence |
| touches | the paths |
| will ask | the one question, or nothing |
| produces | something you can open |

Say the word.

**C — nothing is stuck and nothing comes next.** The last skill in a chain closes here.

Done. What runs now, in one line.

| Owed | Cleared by |
|---|---|
| the thing that is missing, named precisely | the exact command, the `$skill`, or the decision and who makes it |

**C is its own shape rather than "B without the invitation", and it is written out because the gap
was filled wrongly the first time.** Told only to close with "what is owed" and given no shape for
it, a run reached for A's keywords and printed `SUB-RUN` and `RESOURCE` inside a close — which reads
as a run that is stuck, in the one shape that exists to say it is not. An owed line and a blocking
ask are different claims: an owed line says the work stopped somewhere honest and names who can
carry it further, while an ask says nothing more can happen until somebody answers.

`Owed` names what is missing and what it blocks — one state, one route, one packet. A line saying
only "incomplete" is the same fact with the act removed, and it is what turns a finished run into a
case nobody can close.

No fourth shape. No "waiting on", no "needs clarification", no progress report.

## The task file

One task is one file, and it lives with the PRODUCT rather than with these rules:

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

Each phase appends a heading, the SCOPE table it printed, and its own tables. Nothing in a task file
is aligned with spaces — see [`HOW-TO-WRITE.md`](HOW-TO-WRITE.md): a padded block only lines up in a
monospace box, and a list of files under a `WROTE` label collapses into one paragraph everywhere
else.

```markdown
# refactor-authentication

## plan

<the SCOPE table>

**Chose** direction B — the user's reason, in their words where they gave one.

| Took | Because |
|---|---|
| each UX call | the one line that justifies it |

## review

<the SCOPE table>

| Owner | State | Rendered |
|---|---|---|
| the thing that can change | the situation it is in | yes, or what stopped it |

| Backend | Covered by |
|---|---|
| the field the screen needs | `$the-skill` that designs it |

**Approved** what the user approved, named.

## apply

<the SCOPE table>

| Wrote | Note |
|---|---|
| every file, one per row | what changed in it, when that is not obvious |

| Green | Result |
|---|---|
| the command | its outcome |

| Owed | Cleared by |
|---|---|
| what is missing | the command, the `$skill`, or the decision — or the whole table is absent |
```

A later phase reads this file instead of rediscovering anything.

**This is also what replaces the seal**, and it replaces it with something stronger. A seal guards one
run while that run is happening and knows nothing afterwards. This file stays, so the comparison stays
available: `starci-workflow-drift` reads every `<backend-repo>/.workflows/*/*.md` and asks the source whether it
still matches — each file under `WROTE` still there, nothing new inside `Touching` that `WROTE` never
named, each state under `STATES` still rendering what it rendered.

Drift is therefore FOUND rather than prevented, which is the honest trade: prevention cost a hash per
file and a phase that refused to finish, and detection costs one skill run over the whole history.
