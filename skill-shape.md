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

`App` is not a label on the work, it is where the task file is filed: `<backend-repo>/.workflows/<kind>/<app>/`.
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

## 3 · OUTPUT — four tables, and they are the same four every time

**Context goes at the START, the middle is nobody's business, and the end is four tables.** That is
the whole rhythm: SCOPE says what this run is allowed to touch before it touches anything, the work
itself is not narrated, and the close answers four questions a reader always has — what exists
now, what needs me, what grew, and what is still missing.

**They are TABLES rather than aligned blocks, and that is not decoration.** These outputs were
fixed-width text aligned with spaces, which only lines up inside a monospace box — so the moment a
line carried a real command it ran past the edge or broke mid-word, and the reader got a wall
instead of a list. A table wraps inside its cell, so the column saying what KIND of thing this is
stays readable however long the thing itself gets.

Print all four, in this order, at the end of every run. A table with nothing in it still prints,
carrying one row that says so — an absent table and an empty one are different claims, and only one
of them says the question was asked.

**1 · Đã làm — what exists now**

| Thing | Where |
|---|---|
| what was produced, one row each | the path, the port, the state id |

Files, entries, states, gates. Not steps: nobody needs the order they happened in, and a run that
lists its own middle is a progress report wearing a table.

**2 · Cần xác nhận — what cannot move without the user**

| Question | Options |
|---|---|
| the decision, stated so one word answers it | a) the default in force · b) the other |
| what is missing | run: `the exact command` — then it is read back and the run continues |

Only what can be WRONG belongs here: a fact derived rather than read, a promise, a permission, a
price, a write boundary. **UX and UI choices inside an approved direction are yours** — a label's
wording, words versus a glyph, one ordering over another. Take them, put one line in the first table
with the reason, and let the review overturn it. Being overruled later does not undo a permission
once it shipped.

Nothing to ask is the good case: one row saying so, and the run reads as finished rather than
stalled.

**3 · Mở rộng — what grew beyond what was asked**

| Found | What it means |
|---|---|
| the thing nobody named at the start | the decision it forces, or the work it adds, and who owns it |

This is the table that keeps a widened run honest. A run almost never ends inside the sentence that
started it: a rule turns out to be wrong, a component the review named does not exist, the data is
markdown when the design assumed sections, a target moved under the work. Each of those changes what
the user is agreeing to, and each used to arrive buried in prose — or not at all, which is how a
five-file task quietly becomes an eighteen-file one.


**4 · Nợ — what is not done, and who clears it**

| Owed | Cleared by |
|---|---|
| the state nobody rendered, the owner that belongs to another leaf, the screenshot the tool refused | the exact command, the skill to run, or the decision and who makes it |

OWED IS NOT THE SAME CLAIM AS EXTENDS, and folding them was the first draft's mistake. Extends says
the work grew and names what that cost; owed says a piece of it did NOT happen. A run can extend
enormously and owe nothing, and it can owe three things without having grown at all. Kept in one
table the reader cannot tell which rows still need somebody.

It is also not the confirm table. An owed line says the run stopped somewhere honest and names who
can carry it; an ask says nothing more can happen until somebody answers. A run that prints its debts
as questions reads as stuck in the one shape that exists to say it is not.

A line saying only "incomplete" is the same fact with the act removed, and it is what turns a
finished run into a case nobody can close.

After the tables, one sentence may invite the next skill — what it does, what it touches, what it
will ask. One sentence, not a fifth table.

## The task file

One task is one file, and it lives with the PRODUCT rather than with these rules. The kind of work
comes first, then the app, then the task:

| kind | what goes there | example |
|---|---|---|
| `designs` | a screen, a flow, an overlay — anything Plan → Preview → Apply | `.workflows/designs/starci-academy/learn-content-page.md` |
| `feature` | a backend capability — Plan → Apply | `.workflows/feature/starci-academy/course-reviews.md` |
| `fidel` | a bounded repair against binding evidence — Plan → Apply | `.workflows/fidel/starci-academy/spine-locked-glyph.md` |

The repository is the product's backend: `starci-academy-backend/.workflows/...` for
`starci-academy`, `nivo-backend/.workflows/...` for both `nivo` and `nivo-expert-academy`.

Every phase appends to it; none creates another.

**The kind is a folder rather than a field**, because the three are read by different questions. "What
did we decide about this screen" reaches for one design record; "what has been repaired lately" wants
every fidelity record and none of the designs; and `$starci-fe-upgrade-plan` reads across all of them
for one thing only — where the founder said no. A field would make each of those a search; a folder
makes them a listing.

**The task keeps its own file inside the app**, and one file per app was considered and refused. Four
tasks were open in `starci-academy` at once during the week this was written, two of them by different
sessions in parallel, and a shared file is a shared place to collide. It also breaks drift: a task
whose files all moved should go red on its own, not take three healthy records with it.

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

## What the founder rejected

Every phase records what was REFUSED, not only what was agreed, in a table of its own:

| Rejected | Instead | Why |
|---|---|---|
| what was put in front of them, in one line | what they asked for instead | their reason, in their words where possible |

**This is the row the whole upgrade loop runs on.** A record holding only approvals says a run went
well; the same run's refusals say what the rules let it get wrong in the first place. Revision 1.1 of
one reader was refused with "read the legacy exactly, stop inventing" — and the rule that would have
prevented it did not exist until that sentence was written down. Nobody can improve a skill from a
list of things that worked.

Record the refusal at the phase it happened in, however small: a direction rejected, a label sent
back, a shape called wrong, a gate the founder said not to bend. `$starci-fe-upgrade-plan` reads
exactly these rows across every task and proposes what the rules should have said.

Approvals go in the same table's absence — a phase whose refusal table says "nothing refused" is a
phase that went in clean, and that is worth as much as the refusals when a pattern is being counted.

Each phase appends a heading, the SCOPE table it printed, and its own tables. Nothing in a task file
is aligned with spaces — see [`HOW-TO-WRITE.md`](HOW-TO-WRITE.md): a padded block only lines up in a
monospace box, and a list of files under a `WROTE` label collapses into one paragraph everywhere
else.

```markdown
# learn-content-page

One line: what this task is, and what it is not.

## plan

<the SCOPE table>

**Chose** direction B — the user's reason, in their words where they gave one.

| Evidence | What it settled |
|---|---|
| the file read at a named commit | the fact it decided, so the next phase does not re-read it |

| Took | Because |
|---|---|
| each UX call made alone | the one line that justifies it |

| Rejected | Instead | Why |
|---|---|---|
| what was put in front of them | what they asked for | their words |

## review

<the SCOPE table>

| Owner | State | Rendered |
|---|---|---|
| the thing that can change | the situation it is in | yes, at <url> — or what stopped it |

| Backend | Covered by |
|---|---|
| the field the screen needs | the skill that designs it — or the table says nothing |

| Rejected | Instead | Why |
|---|---|---|
| the revision sent back | what replaced it | their words |

**Approved** what the user approved, named, and how they said it.

## apply

<the SCOPE table>

| Wrote | Note |
|---|---|
| every file, one per row | what changed in it, when that is not obvious |

| Green | Result |
|---|---|
| the command | its outcome |

| Extended | What it means |
|---|---|
| what grew beyond the ask | the decision it forced, and who owns it |

| Rejected | Instead | Why |
|---|---|---|
| what was refused during the write | what replaced it | their words |

| Owed | Cleared by |
|---|---|
| what is missing | the command, the skill, or the decision — or the table is absent |
```

A later phase reads this file instead of rediscovering anything.

**This is also what replaces the seal**, and it replaces it with something stronger. A seal guards one
run while that run is happening and knows nothing afterwards. This file stays, so the comparison stays
available: `starci-workflow-drift` reads every `<backend-repo>/.workflows/*/*/*.md` and asks the source whether it
still matches — each file under `WROTE` still there, nothing new inside `Touching` that `WROTE` never
named, each state under `STATES` still rendering what it rendered.

Drift is therefore FOUND rather than prevented, which is the honest trade: prevention cost a hash per
file and a phase that refused to finish, and detection costs one skill run over the whole history.
