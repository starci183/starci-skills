---
title: Precedents
---

# Precedents

You are given a business request and the layout candidates already accepted for this source, and you
return, for each candidate you are about to generate, either a precedent it cites or a statement that
it deliberately departs from every precedent. A precedent is a decision that was accepted before, kept
with its reason. It is **cited, followed and overruled** — never obeyed. A law binds; a precedent
persuades. Confusing the two turns every new page into a copy of the last one.

## Law

A precedent records a decision **and what it beat**. The accepted candidate alone teaches what to
copy; only the rejected ones teach what to avoid, and avoiding is where a layout stops being noise.

A precedent is scoped to one source. Each frontend has its own contract, its own components and its
own history, so a precedent from another product is not evidence here — it is a stranger's decision
wearing the authority of this tree.

## Situation codes

| Code | Situation | What it emits |
|---|---|---|
| `PRECEDENT-0` | No accepted candidate covers this request | generate from laws and axes; record that no precedent applied |
| `PRECEDENT-1` | A precedent matches on business reason | cite it; reuse its axis values and cited entries |
| `PRECEDENT-2` | A precedent matches partly; one axis must differ | cite it, then name the axis that changes and why |
| `PRECEDENT-3` | A precedent cites a contract key that has since been renamed | migrate the citation, or mark the precedent stale |
| `PRECEDENT-4` | The candidate departs from every precedent on purpose | record the departure as the candidate's own reason |
| `PRECEDENT-5` | A precedent is wrong, not merely old | overrule it, in writing, and record what replaced it |

## Reading the precedent corpus

1. **Match on the business reason, not on the shape.** Two requests that produce the same regions for
   different reasons are not the same case. The reason is what a precedent is indexed by.
2. **Check the citations before trusting them.** A precedent naming a contract key is only usable if
   that key still exists under that name — `PRECEDENT-3`.
3. **Read what was rejected.** The rejected candidates in the nearest precedent are the fastest way to
   avoid re-proposing a shape this source already refused.
4. **Guarantee one departure.** Of the 3–4 candidates generated, at least one must not follow the
   nearest precedent — `PRECEDENT-4`. Precedent is how a corpus stays consistent; the departure is how
   it stays alive.
5. **Never let a precedent silence a law.** A precedent that violates a layout law is not a precedent
   to follow; it is a defect to record — `PRECEDENT-5`.

## `PRECEDENT-0` — nothing covers this request

**Situation.** The corpus holds no accepted candidate whose business reason matches this request.

**Recognition signs**

- No precedent shares the request's outcome or its subject.
- The nearest match resembles it only in region count.

**Ask yourself.** Am I about to cite a precedent because it fits, or because it is the closest thing
present?

**Boundary**

- `PRECEDENT-2`: a partial match still shares the reason. Sharing only a shape is no match at all.

**How it fails.** The nearest precedent gets cited for lack of a better one, and its axis values are
inherited by a page they were never chosen for.

## `PRECEDENT-1` — a precedent matches on business reason

**Situation.** An accepted candidate already answered this reason for this source, and nothing about
the request contradicts it.

**Recognition signs**

- The recorded reason can be read as the answer to this request.
- The cited contract keys all still exist.
- No axis value in the request conflicts with the precedent's.

**Ask yourself.** Can I state the shared reason in one sentence without mentioning the layout?

**Boundary**

- `PRECEDENT-4`: citing is not mandatory. A candidate may depart, but then it owes its own reason.

**How it fails.** The precedent is followed down to details the request never asked for, and the page
inherits decisions nobody made for it.

## `PRECEDENT-2` — a partial match, one axis differs

**Situation.** The reason matches, but the request forces a different value on one axis — the rail
becomes a route, the evidence moves under the subject.

**Recognition signs**

- One axis value is stated by the request and differs from the precedent's.
- Every other axis can stay as it was.

**Ask yourself.** Which single axis changed, and does the request state it or am I assuming it?

**Boundary**

- `PRECEDENT-1`: if no axis changes, this code is not reached.
- `PRECEDENT-0`: if more than one axis changes, the precedent is no longer the case being decided.

**How it fails.** The changed axis is applied without being named, so a reader cannot see which part
of the precedent was kept and which was overridden.

## `PRECEDENT-3` — a citation has gone stale

**Situation.** The precedent is sound but names a contract key that has since been generalised or
renamed.

**Recognition signs**

- A cited key does not appear in the current contract.
- A key with a wider name covers the same reason.

**Ask yourself.** Was the key renamed, or removed? Those have different repairs.

**Boundary**

- `PRECEDENT-5`: staleness is a citation problem. A precedent that was wrong on the day it was
  accepted is a different matter.

**How it fails.** The precedent is cited as written, so the generated candidate names a component that
no longer exists — the exact invention the corpus was supposed to prevent.

## `PRECEDENT-4` — a deliberate departure

**Situation.** The candidate does not follow the nearest precedent, and that is the point: it exists so
the batch offers a genuinely different structure.

**Recognition signs**

- Its axis values differ from the nearest precedent on at least one axis.
- Its reason is stated on its own terms, not as a correction of the precedent.

**Ask yourself.** Would this candidate be worth reading if the precedent did not exist?

**Boundary**

- `PRECEDENT-5`: departing is not overruling. Overruling says the precedent is wrong; departing says
  this request deserves something else.

**How it fails.** Every candidate cites the nearest precedent, the batch converges, and the owner is
shown one shape three times.

## `PRECEDENT-5` — the precedent is wrong

**Situation.** The precedent violates a layout law, or its reason turned out to be false about the
product.

**Recognition signs**

- Following it would produce a candidate a law rejects.
- Its recorded reason is contradicted by how the surface is actually used.

**Ask yourself.** Is this precedent merely old, or was it never right?

**Boundary**

- `PRECEDENT-3`: a stale citation is repaired. A wrong precedent is overruled and kept, so the record
  shows the reversal.

**How it fails.** The wrong precedent is quietly skipped instead of overruled, so the next run cites it
again and the same defect returns.

## Inputs

| Input | Evidence required | Read from |
|---|---|---|
| request | The business request, verbatim | the owner |
| corpus | Accepted candidates for THIS project — see the record shape below | beside the project's own repository |
| contract | Entry **key**, `why`, `host` and children **names** only — never the class arrays | `context.contract` of the resolved role |
| axes | The closed set of diversity axes, listed below | this module |
| laws | The layout laws, which outrank any precedent | this tree |

**"This project" is the project the workspace route declared** — the `project` and `role` in
`.workspace/<project>/<role>/config.json`, never a folder name, never the last session's. The contract
is read live from the checkout that route resolves, because each frontend has its own. Two consequences
follow, and both are the reason this column exists:

- **A stale route poisons every input here.** If the checkout moved or the contract path was renamed,
  every citation is checked against a contract that is not the product's, and the verdicts are
  confidently wrong. The route is verified before anything here is read; an unverified route stops the
  run rather than producing a precedent verdict.
- **The corpus is scoped to that project, not to this tree.** Precedents live beside the repository they
  were accepted for. A precedent from another product is a stranger's decision wearing this tree's
  authority — its names and reasons belong to a different contract.

A corpus record holds six fields, and the fourth is the one that earns the corpus its keep:

```text
prompt: <the business request that produced it>
axes: <the axis values of the accepted candidate>
chosen: <hash + JSON>
rejected: <the other 2-3 candidates, one sentence each on why it lost>
cited-entries: <the contract keys each region cited>
contract-at: <the contract state it was accepted against>
```

**The contract is read at 38%, and the class arrays are not read at all.** The full file is 192KB;
keys, `why`, `host` and children names are 74KB of it. The cut is not economy. A stage that cannot see
a class cannot carry one forward, so a precedent can never teach the next candidate a class — the rule
is enforced by what is not read, not by a reminder. Matching is done on `why` for the same reason: two
entries can share every class and answer different reasons, and it is the reason a precedent is
indexed by.

**Axes** are the closed set a candidate may differ on. A precedent records its values; `axis-delta`
names which of them a new candidate changes:

| Axis | Values |
|---|---|
| navigation owner | navbar owns it / a rail owns it / no chrome |
| evidence against subject | beside the subject / below the subject |
| secondary region | its own route / a panel inside the page / an overlay |
| chrome | sticky / scrolls with content |

Two candidates whose whole axis set matches are one candidate, whatever their precedents say.

## Rules

1. A precedent is scoped to one source. It is never carried across products.
2. A precedent records the rejected candidates and one sentence each on why they lost.
3. Precedents are indexed by business reason. Shape is not an index.
4. Every citation is checked against the current contract before it is used.
5. At least one candidate in a batch does not follow the nearest precedent.
6. A law outranks a precedent. A precedent that breaks a law is overruled, never followed.
7. Overruling is written down. A precedent is superseded, not deleted.
8. A precedent is not a candidate. It is evidence for one.

## Exceptions

- **The first case.** With an empty corpus, `PRECEDENT-0` is the whole answer and no departure is owed:
  every candidate is already a departure.
- **A one-off surface.** A surface the product will have exactly once may be recorded as a precedent
  marked non-general, so it is readable as history without inviting reuse.
- **A precedent for a route that no longer exists.** Kept, marked retired. Its rejections still teach
  even when its acceptance no longer applies.

## Output

One block per candidate in the batch:

```text
candidate: <id in this batch>
situation: <PRECEDENT-0 | PRECEDENT-1 | PRECEDENT-2 | PRECEDENT-3 | PRECEDENT-4 | PRECEDENT-5>
cites: <precedent id, or none>
shared-reason: <the business reason both answer, or why none applies>
axis-delta: <axis values that differ from the cited precedent>
citation-check: <keys verified against the current contract>
reason: <why this candidate is worth the owner's attention>
```

## Worked example

**Request.** "A results page for a coding drill: total score, time, tests passed, and a list of
criteria with their scores."

The corpus holds one accepted candidate for the flashcard result page: reason *"a persisted result
reads as comparable summary figures, then diagnostic rows"*, citing `flashcard-result-stat` and
`flashcard-result-fact-row`.

```text
candidate: A
situation: PRECEDENT-1
cites: course-flashcard-result-page/2026-08-12
shared-reason: a persisted result reads as comparable summary figures, then rows comparing a name with one stored value
axis-delta: none
citation-check: flashcard-result-stat and flashcard-result-fact-row exist; both are feature-prefixed and used in one file each
reason: the request asks the same question of the reader, so the accepted answer applies unchanged apart from the entry names
```

```text
candidate: B
situation: PRECEDENT-2
cites: course-flashcard-result-page/2026-08-12
shared-reason: the same, but this request names criteria the reader compares against each other rather than against a target
axis-delta: evidence moves from below the figures to beside them
citation-check: same keys, same result
reason: comparing criteria to each other rewards a side-by-side reading the accepted precedent never had to offer
```

```text
candidate: C
situation: PRECEDENT-4
cites: none
shared-reason: none — the figures are treated as one sentence about the attempt rather than four separate measurements
axis-delta: no measurement cards at all; the summary is one line, the criteria carry the page
citation-check: cites title-with-baseline-fact, which exists and is used in three files including a shared branch, so it is reused and not modified
reason: if the score only matters as context for the criteria, four cards spend the top of the page on the least useful fact
```

Candidate C is the departure the batch owes. Without it, A and B are one precedent read twice.

## Scope

This module decides how earlier accepted decisions are cited when generating candidates. It does not
decide what a layout may contain, which is the layout laws' business, and it does not store the corpus:
precedents belong to the source they were accepted for, beside that repository, not inside this shared
tree.
