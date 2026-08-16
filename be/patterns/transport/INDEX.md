---
id: be-patterns-transport-index
title: INDEX.md
slug: /be/patterns/transport
sidebar_label: transport
sidebar_position: 0
description: Binding rules for when a door may not be GraphQL, and where every door lives on disk.
template: patterns-v2
---

# INDEX.md

Version: `2.00` · Module: `transport`

## Law

A **door** is any file the outside world can reach: a resolver, a controller, a socket gateway, a
broker consumer. This module settles one question about doors and one only — **when is a door
allowed not to be GraphQL** — and where the answer lands on disk.

The question matters because the answer is nearly always "it isn't". The product surface is a
code-first GraphQL schema, and a client that talks to it already holds a GraphQL client, a schema,
generated types and one endpoint. Every REST route added beside that is a second protocol for the
same client to learn, a second place to put authentication, and a shape no generated type covers.
That cost is worth paying exactly when GraphQL **cannot** do the job, and never because a route was
quicker to write.

The failure this prevents is not one bad controller. It is what a codebase looks like after twenty
case-by-case decisions nobody wrote down: two door layers, no stated line between them, and a reader
who cannot tell whether a given route is REST for a reason or by accident. Measured when the flat
law was written, fifteen of eighteen doors had a reason visible in the file and three did not — so
the design was mostly coherent and looked like a mess, which is the worst of both.

**This is binding, not advisory.** Every door carries exactly one situation code below, and there is
no door small enough to be exempt. "It is one endpoint" is the most common place this rule gets
skipped, and twenty of those is the mess the rule exists to prevent.

## Situation Codes

Every situation this module governs carries a code, `TRANSPORT-<n>`. The numbers are fixed and are
cited from other law files and from task records; a code keeps its number and its meaning for as
long as it exists.

| Code | Requires | Forbids |
|---|---|---|
| `TRANSPORT-1` | An operation that takes fields and answers with fields is declared as a mutation or a query | A second protocol chosen for convenience; arguing a door out of the schema without one of the exits in `TRANSPORT-2` |
| `TRANSPORT-2` | A `@Controller` whose file itself shows which of four exits it takes: an external system posting to a URL you gave it, bytes rather than fields, a machine with no user session, or an identity that is not a user session | A controller showing none of them; a justification that lives in a registry, an allow-list or a document instead of in the file |
| `TRANSPORT-3` | Every door under `features/`, whatever its transport | A `@Controller` under `src/modules/**`, where it reads as a capability and gets imported like one |

`TRANSPORT-1` AND `TRANSPORT-2` ARE ONE DECISION READ FROM TWO SIDES, NOT TWO DECISIONS.
`TRANSPORT-1` states the default and `TRANSPORT-2` states the complete list of exits from it. They
are two codes because they fail differently: `TRANSPORT-1` fails when nobody asked the question, and
`TRANSPORT-2` fails when somebody asked it and left the answer out of the file.

The four exits in `TRANSPORT-2` are a **closed** list. A door that fits none of them does not get to
argue about it — it goes in the schema. A liveness probe (`health`, `healthz`) is the one thing
outside the four, because it has to answer while the application is degraded, possibly before the
feature layer is up at all.

## Tầng giữ

Which tier actually holds each code. `unrepresentable` means the wrong value cannot be written;
`enforced` means a named rule from
[`sources/be/transport.mjs`](../../../sources/be/transport.mjs) reports it; `documented` means
nothing mechanical holds it and only a reader does.

| Code | Tier | Held by |
|---|---|---|
| `TRANSPORT-1` | `documented` | Nothing counts the operations that should exist. A rule can report a door that took an exit it cannot show, which is `TRANSPORT-2`; no rule can see an operation somebody decided not to put in the schema, because the absence of a resolver is not a token. |
| `TRANSPORT-2` | `enforced` | `rest-door-needs-a-reason` — reports any `@Controller` whose route, filename or file text shows none of the four exits and is not a probe. The evidence is read off the file, deliberately, because that is the same evidence a reader would use. |
| `TRANSPORT-3` | `enforced` | `door-lives-in-features` — reports any `@Controller` whose path contains `/src/modules/`. Path-shaped, so it needs no cross-file knowledge and cannot be argued with. |

One row reads `documented`, and that is the honest state rather than a gap to be papered over.
`TRANSPORT-1` is the one code here whose violation is an **absence** — an operation that was never
written into the schema because a route was written instead. A parser sees tokens that exist; it
cannot see a mutation somebody chose not to declare. What holds `TRANSPORT-1` in practice is
`TRANSPORT-2`'s rule attacking the same decision from the other end: the route that replaced the
mutation still has to justify itself, and most cannot.

## Anchor

A law that cannot be pointed at in real code is a proposal. Each code below names a path in the
reference repository and what to look for there.

| Code | Anchor | What to look for |
|---|---|---|
| `TRANSPORT-1` | `src/features/api/core/graphql/` beside `src/features/api/core/http/` | The ratio is the law made visible: hundreds of files carrying `@Resolver` against nineteen carrying `@Controller`. The default is not a preference somebody stated; it is what the tree already is. |
| `TRANSPORT-2` | `src/features/api/core/http/*/webhook/webhook.controller.ts` and `src/features/api/core/http/mount/foundations/mount-foundations.controller.ts` | Five payment and storage gateways whose exit is spelled in the folder and the filename, and one file whose exit is the `@Res(` in its signature. In each, the reason is readable without leaving the file. |
| `TRANSPORT-3` | `src/modules/**` | Grep `@Controller` across the whole capability tree and get nothing back. The anchor for this code is an **absence that holds** — every door in the repository sits under `src/features/`, and the tree proves it without a document being consulted. |

Every code is anchored. Anchors are paths in the reference repository and exist for verification
only; the examples in `example.md` name no product and no repository.

## Inputs

| Input | Evidence required |
|---|---|
| door | Which kind: resolver, controller, gateway, consumer |
| payload | Whether the operation carries fields or bytes |
| caller | Who reaches this door: a client holding the schema, an external system, a machine, an operator |
| identity | Which subject the request carries, and which guard establishes it |
| exit | Which of the four cases applies, if any, and the token in the file that shows it |
| address | The `features/` path the file will live at |

## Invariants

- The default door is GraphQL, and the burden of proof is on the door that is not.
- The list of exits is closed at four, plus the liveness probe.
- The exit is shown by the file itself: its route, its filename, or a token in its text.
- No registry, allow-list or design document may justify a door.
- Being a door decides the address; transport does not.
- A capability stays under `modules/` and is called by a door, never reached directly.
- Every door resolves to exactly one code per situation. No door is out of scope.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and names the code it applies
to.

- **The liveness probe.** Under `TRANSPORT-2`, a route matching `health` or `healthz` is an exit
  outside the four. It exists because the probe must answer while the application is degraded, and a
  probe that needs the feature layer up cannot report that the feature layer is down.
- **A separate application assembles its own doors.** Under `TRANSPORT-3`, the `src/modules/**`
  binding is the whole of the rule. An application under `apps/*` composes its own root and its own
  doors and is not subject to this split, because it is not choosing between two door layers in one
  tree — it has one.
- **A REST door with a reason is not second-class.** Under `TRANSPORT-1`, four of the exits are
  permanent: webhooks will not start speaking GraphQL, and files will not stop being bytes. Nothing
  here asks anyone to remove a door that has a reason, or to wrap one in a resolver to satisfy a
  count.
- **Adoption debt.** A rule from this module ships at `warn` with its offender count beside it while
  debt is above zero, is burned down, and flips to `error` at zero. Shipping at `error` with debt
  outstanding blocks every commit that touches an offender, which is how a correct rule gets
  removed.

## Output

```text
door: <resolver | controller | gateway | consumer>
operation: <what it does>
situation: <TRANSPORT-1 | TRANSPORT-2 | TRANSPORT-3>
exit: <none | external | bytes | machine | operator | probe>
evidence: <the route, filename or token in the file that shows the exit>
address: features/<path>
reason: <why GraphQL cannot carry this, or "GraphQL can" for TRANSPORT-1>
```

## Load Policy

Read this file first. Read `vi.md` for the business situation behind each code, `example.md` for the
cases, exceptions and request mapping of every code, `audit.md` only while reviewing the canon, and
`changelog.md` when a version marker disagrees with what you are reading.

## Scope

This module states a rule true of any backend whose product surface is one schema. Its examples are
ordinary TypeScript in a Nest-shaped application and name no product, no company and no repository.
The Anchor table is the only place carrying repository paths, and it carries them as verification,
not as illustration.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`. A
major bump (`x.00`) is for a change to the module's shape or the shelf it sits on. Situation codes
are never renumbered: a code that is retired is recorded as retired and its number is not reused.
