---
name: starci-be-plan
description: Name every file a backend capability will need before any of them exists — reading the live schema and the sibling operation folder as evidence, mirroring the existing family rather than inventing a shape, and enumerating the test cases while the branches that would suggest them do not exist yet. Writes no product code. Use before adding a mutation, query, resolver, handler, module, entity or projection.
---

# starci-be-plan

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/context.md` | context | the shared reporting contract every skill reads |

## NESTED SKILLS

None. Planning ends with a brief; it never starts setup or approval.

## Run

Read `@skill-shape` first. This phase produces a brief and nothing else.
It ends with an approval-ready boundary; it never writes backend source.

## PROCESS

### 1 — Establish the context lock

`Phase` is `plan`. `Touching` is `None`. A plan that writes product code has already
skipped its own approval.

### 2 — Resolve and verify the backend route

Read `.workspace/<project>/<role>/config.json` for the `be` role and verify the checkout before reading
anything from it (`WORKSPACE-5`). A stale route means the schema and the sibling folder you are about to
mirror belong to a different state of the product.

### 3 — Read the live schema, not the remembered one

The schema is evidence, and it is read from the checkout: entities, relations, enums, projections, and
whatever the transport already exposes. A field you remember is a field that may have been renamed. What
the capability will re-key against — enrolment, user, course — is read, never assumed.

### 4 — Read the sibling operation folder

Find the nearest existing operation of the same kind and read it whole: how the module is layered, what
the handler receives, how the exception is raised and identified, how the projection is fed, how the test
is written. **Mirror the family; do not invent a shape.** A capability that looks unlike its siblings
costs every future reader a comparison.

If the family disagrees with itself, count the members and follow the majority, not the nearest example.

### 5 — Name every file before any exists

The brief lists each path the capability will need, with what it holds and why it is a separate file.
Nothing is deferred to "wherever it ends up": a plan that cannot name its files cannot have its boundary
approved, and an unapproved boundary is how unrelated code arrives in the diff.

### 6 — Enumerate the test cases now

Write the cases while the branches that would suggest them do not exist yet — that is the point of doing
it here. Name the failing paths: rejected input, absent row, forbidden viewer, concurrent write,
duplicate delivery, empty projection. Every exception the capability can raise derives from the abstract
exception; a bare throw is not a case, it is a defect.

### 7 — State boundaries, alternatives and acceptance evidence

The brief closes with: what this capability will not do, which alternatives were considered and why they
lost, and exactly what evidence will prove it works — which test, which query, which runtime call.

### 8 — Close the phase

State the brief and exact boundary in friendly prose. Do not end while any planning work remains under
`own`; the exact brief and boundary are the only `NEED APPROVALS` item.

## Stops

- Route absent or stale → report the failed route evidence and end this run.
- The schema cannot be read → stop; a plan written against a remembered schema is fiction.
- No sibling of this kind exists → say so explicitly and propose the shape as a **new family**, with the
  reason, so approval knows it is setting a precedent rather than following one.

## OUTPUT

Return the approval-ready brief and exact file boundary in concise prose. No status tables.

| Output | Owner |
|---|---|
| approval-ready brief and exact file boundary | `starci-be-approve` |

The owner may use that brief in a separately requested approval run. This skill does not start it.
