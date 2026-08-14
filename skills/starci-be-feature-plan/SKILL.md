---
name: starci-be-feature-plan
description: Name every file a StarCi/nivo backend capability will need, before any of them exists — reads the live schema and the sibling operation folder as evidence, mirrors the family rather than inventing a shape, and enumerates the test cases while the branches that would suggest them do not exist yet. Writes no product code. Use before adding a mutation, query, resolver, handler, module, entity or projection.
---

# StarCi BE Feature Plan

Read [`../../skill-shape.md`](../../skill-shape.md) first.

A folder architecture is arguable in a sentence. The same decisions embedded in thirty written files
are reviewable only by reading thirty files, and by then nobody argues with them — they merge them.
So this half produces the file list, before there are any files.

Not for changing a value or fixing a typo. That is a bounded repair and needs evidence, not a
procedure.

## CONTEXT

Present the phase table under the exact heading `### CONTEXT`.

Print the table, and name two rows that are invisible when wrong: **which app** (a monorepo builds
several from one tree — `nest-cli.json` names them, and two apps are two products with two auth
surfaces) and **which database** (an entity on the wrong connection compiles and writes to a table
nobody reads). `Touching` is the artifact directory; this half writes no product code.

## PROCESS

**Dump the schema unfiltered.** A grep with a regex is how a capability gets declared missing while
it sits there under another name.

```bash
curl -s -X POST <api>/graphql -H 'Content-Type: application/json' \
  -d '{"query":"query{__schema{mutationType{fields{name}}}}"}'
```

Read every name. A name that sounds right gets OPENED and ruled in or out by what it RETURNS, never
by what it is called — `myLearningFeedbacks` reads exactly like a course rating and is the platform's
feedback to a learner. When the API is down, enumerate every operation folder instead, the whole list.

**Read the sibling operations, then mirror them.** The folder next door is the strongest statement of
how this repository writes this kind of thing, and an operation that is the odd one out in its own
family costs every later reader more than any elegance gains them. Where two families disagree, say
which one you are following and record the divergence as a finding rather than settling it inside one
new feature.

Read the governing law completely, not the one that sounds relevant:
[`cqrs`](../../be/canon/patterns/cqrs.md) · [`module-layering`](../../be/canon/patterns/module-layering.md) ·
[`data-access`](../../be/canon/patterns/data-access.md) · [`exceptions`](../../be/canon/patterns/exceptions.md) ·
[`transport`](../../be/canon/patterns/transport.md) · [`testing`](../../be/canon/patterns/testing.md) ·
[`e2e-flow`](../../be/canon/patterns/e2e-flow.md) · [`naming`](../../be/canon/patterns/naming.md) ·
[`type-safety`](../../be/canon/patterns/type-safety.md). Add [`cdc`](../../be/canon/patterns/cdc.md)
for a projection — designed without it, a listener increments a delta and duplicate delivery doubles
a number nobody is checking.

**Name every file that will exist**, with one line each: what it holds, and what decides its shape —
the law, the sibling it mirrors, or the product decision behind it. Not "the usual CQRS files": the
actual paths, so a reader can count them and notice the missing one, which is usually the spec.

**Enumerate the test cases now**, while the branches that would suggest them do not exist: each guard
both ways, each boundary at and either side of it, the empty set, the already-done, the not-permitted,
the not-found, the concurrent second writer, every member of every enum the handler switches on. Then
the flow the e2e walks and the production transport it enters through. Written afterwards, the cases
a reader thinks of are the cases the code made visible — so the untested ones are exactly the ones
nobody considered, and the suite ends up green where the risk is.

## OUTPUT

Use exact headings `### OUTPUTS`, `### CHANGES`, `### NEED APPROVALS`, `### WARNINGS`, `### REJECTED` and `### OWED`.

Print `OUTPUTS`, `CHANGES`, `NEED APPROVALS`, `WARNINGS`, `REJECTED` and `OWED` in that order.

A confirm row for anything only the owner can settle — a product question the code surfaced (does a trial
count as an enrollment? is there an edit window?) with the default the evidence supports, a credential
or a running service you need, or another procedure that has to go first. Never bury one of these in
a handler default: a guess in a handler is a decision nobody made and nobody can find.

Print the six canonical tables. `OUTPUTS` names the capability brief and architecture concept;
`CHANGES` details the workflow path only. Put every product rule that can be wrong in
`NEED APPROVALS`, never in a handler default. Append `## plan` with the CONTEXT, proposed file tree,
test matrix, assumptions and exclusions. Then invite `$starci-be-feature-review`.
