---
title: Transport
---

# Transport

The input to this pattern is a shape somebody already accepted — a capability, a contract, an
operation the product agreed to expose. The decision that it should exist is closed and this pattern
does not reopen it. The output is source architecture: which transport the door speaks, which file
holds it, which directory that file lives under, and what token inside the file proves the choice.

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

## Situation codes

Every situation this module governs carries a code, `TRANSPORT-<n>`. The numbers are fixed and are
cited from other law files and from task records; a code keeps its number and its meaning for as
long as it exists.

| Code | Situation | What the source must look like |
|---|---|---|
| `TRANSPORT-1` | An operation that takes fields and answers with fields | It is declared as a mutation or a query. No second protocol chosen for convenience; no door argued out of the schema without one of the exits in `TRANSPORT-2` |
| `TRANSPORT-2` | A door that **cannot** be GraphQL | A `@Controller` whose file itself shows which of four exits it takes: an external system posting to a URL you gave it, bytes rather than fields, a machine with no user session, or an identity that is not a user session. A controller showing none of them is forbidden, and so is a justification that lives in a registry, an allow-list or a document instead of in the file |
| `TRANSPORT-3` | A door, whatever its transport | It lives under `features/`. No `@Controller` under `modules/**`, where it reads as a capability and gets imported like one |

`TRANSPORT-1` AND `TRANSPORT-2` ARE ONE DECISION READ FROM TWO SIDES, NOT TWO DECISIONS.
`TRANSPORT-1` states the default and `TRANSPORT-2` states the complete list of exits from it. They
are two codes because they fail differently: `TRANSPORT-1` fails when nobody asked the question, and
`TRANSPORT-2` fails when somebody asked it and left the answer out of the file.

The four exits in `TRANSPORT-2` are a **closed** list. A door that fits none of them does not get to
argue about it — it goes in the schema. A liveness probe (`health`, `healthz`) is the one thing
outside the four, because it has to answer while the application is degraded, possibly before the
feature layer is up at all.

## Reading an accepted shape

1. Read what the shape states. It states an operation, its payload, its caller and the identity the
   request carries — enough to name the door and what it does.
2. Note what the shape does not state, and therefore does not resolve. An accepted shape does not
   pick a transport, does not pick a directory, and does not supply the token in the file that will
   prove the choice. Those are this pattern's output, not the shape's.
3. Resolve outermost first: address before transport. `TRANSPORT-3` is settled by being a door at
   all, so it holds before you know whether the door is REST; then `TRANSPORT-1` and `TRANSPORT-2`
   settle the protocol.
4. Ask each code's question. `TRANSPORT-3`: can anything outside this process reach this file? If
   so it is a door and it lives under `features/`. `TRANSPORT-2`: does one of the four exits apply,
   and is the evidence readable inside the file itself? `TRANSPORT-1`: if no exit can be pointed at,
   the default wins and the operation goes in the schema.
5. When two codes both match, they are not in conflict — they answer different questions and a file
   must satisfy both. `TRANSPORT-3` decides the address and `TRANSPORT-1`/`TRANSPORT-2` decide the
   protocol; a webhook that is entirely legitimate under `TRANSPORT-2` still fails `TRANSPORT-3` if
   it sits in `modules/`. Between `TRANSPORT-1` and `TRANSPORT-2` there is never a tie: they are one
   decision read from two sides, and if no exit can be shown, `TRANSPORT-1` wins.

## `TRANSPORT-1` — the default door is GraphQL

**Situation.** An operation takes fields in and answers with fields. It is a mutation or a query.
There is no second question to ask.

**What it emits in source.** A `@Resolver` under `features/`, declaring a mutation or a query in the
code-first schema. No controller, no second endpoint, no parallel route.

**Recognition signs.** The incoming payload is structured JSON and the outgoing payload is
structured JSON. The caller is the product client — the thing already holding the schema and the
generated types. The identity on the request is an ordinary user session. There are no bytes, no
machine, and nobody posting to a URL you published.

**Boundary.** This is not `TRANSPORT-2`: it is the same decision read from the other side.
`TRANSPORT-1` states the default and `TRANSPORT-2` states the list of exits from it; if no exit can
be pointed at, there is no exit. It is not `TRANSPORT-3` either — `TRANSPORT-1` picks the
**protocol** and `TRANSPORT-3` picks the **address**, and answering one does not excuse the other.
The reasons that do not count as reasons: "REST is faster to test with curl" is convenience for the
author, not a limit of GraphQL; "the integrator prefers REST" fails when that integrator is the
product client, which already has the schema; "it is only one small endpoint" is true twenty times
and then it is two door layers; "we are in a hurry, we will refactor tomorrow" ignores that a route
outlives the deadline that produced it.

**Common business situations.** Reading a profile, updating settings, listing orders with
pagination, creating a draft, cancelling a subscription, changing a password through the current
session, search with filters, counting summary figures.

## `TRANSPORT-2` — a REST door only where GraphQL cannot reach

**Situation.** GraphQL **cannot** do the job, and the file has to say which case it is. Four cases,
and there is no fifth.

**What it emits in source.** A `@Controller` under `features/` carrying, in the file itself, the
token that shows its exit:

| Case | What is visible in the file | Why GraphQL cannot reach it |
|---|---|---|
| **an external system posts to a URL you gave it** | a route or filename containing `webhook` | a payment gateway posts to a fixed URL. It will never send a GraphQL document, and you have no standing to ask it to |
| **bytes, not fields** | `FileInterceptor`, `StreamableFile`, `@Res(`, `createReadStream` | multipart upload and streamed download. GraphQL carries JSON |
| **a machine registering itself** | a route beginning `pods/`, `internal/`, `agents/` | a pod calling home at startup carries no user session at all |
| **an identity that is not a user session** | a route beginning `api/ops`, or a file using an operator guard or a service token | a platform operator or a service token is a **different subject** from a product user; hanging it on the same guard is how one tenant's administrator ends up operating the whole platform |

**Recognition signs.** The evidence reads **inside the file**, not in some other document. Delete
that line of evidence and nobody can any longer tell why this door is not GraphQL. Ask it directly:
if the next reader opens only this file, do they see the reason? If they must ask someone else, the
reason is not in the file, and the law treats it as no reason at all. Evidence is read from the
file and never from a registry — an approved-route list rots the first time somebody adds a route
and forgets to update it, and it lets a door be justified by **a document** instead of by **what it
does**. A registry also creates a state worse than having none: a wrong route sitting in the
registry looks exactly like a right one.

**Boundary.** This is not `TRANSPORT-1`: see above — if no case can be named, the default wins. It
is not `TRANSPORT-3` either: a REST door that is entirely correct under `TRANSPORT-2` can still be
in the wrong place. The two codes check different things, and one file can pass one and fail the
other. The one thing standing outside the four cases is the liveness probe: a `health` or `healthz`
route must answer **while the application is broken**, possibly before the feature layer is up at
all, and a probe that needs the feature layer alive can never report that the feature layer is dead.

**Common business situations.** Payment gateway webhook, storage bucket notification webhook,
avatar upload, invoice PDF download, ranged video streaming, a pod registering at boot, an agent
fetching configuration, an internal operations console, a load balancer probe.

## `TRANSPORT-3` — every door lives under `features/`

**Situation.** `modules/` holds **capabilities** — the things a door calls into. `features/` holds
**doors**. Protocol has never decided the address; **being a door** decides it.

**What it emits in source.** The file lands under `features/`, whatever it carries: `@Controller`,
`@Resolver`, `@WebSocketGateway` or a broker message handler. No door is written under
`modules/**`.

**Recognition signs.** The file carries `@Controller`, `@Resolver`, `@WebSocketGateway` or a handler
receiving messages from a broker. It is where a request **begins**, not somewhere another file calls
into. Ask it directly: can anything outside this process reach this file? If yes it is a door, and
doors live under `features/`. A door misplaced in `modules/` is expensive because it **reads like a
capability** and then **gets imported like one**: another module pulls it in to borrow the service
inside, and from then on deleting that route breaks something with no relation to HTTP. Worse still
is two door layers in two different trees with the reason written down nowhere — exactly the "looks
like a mess" state `TRANSPORT-1` describes.

**Boundary.** This is not `TRANSPORT-2`: `TRANSPORT-2` asks *may this door be REST*, `TRANSPORT-3`
asks *where does this file live*. A perfectly legitimate webhook sitting in `modules/` still fails
`TRANSPORT-3`. It is also not a rule about capabilities: services, repositories, adapters and
third-party clients **stay** in `modules/`. This law moves nothing but **doors**.

**Common business situations.** A mutation resolver, a query resolver, a webhook controller, a
socket gateway, a topic consumer, a controller serving static files, an operations controller.

## Layer held

Which tier actually holds each code. `unrepresentable` means the wrong value cannot be written;
`enforced` means a named rule from `@starci/eslint-canon-be` reports it; `documented` means nothing
mechanical holds it and only a reader does.

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

The layer that owns this concern is the door layer under `features/`; every layer under `modules/` —
services, repositories, adapters, third-party clients — must stay ignorant of transport entirely,
because a capability that knows which protocol reached it has become a door.

## Anchor

A law that cannot be pointed at in real code is a proposal. Each code names a path in the reference
repository and what to look for there.

| Code | Anchor | What to look for |
|---|---|---|
| `TRANSPORT-1` | `features/api/core/graphql/` beside `features/api/core/http/` | The ratio is the law made visible: hundreds of files carrying `@Resolver` against nineteen carrying `@Controller`. The default is not a preference somebody stated; it is what the tree already is. |
| `TRANSPORT-2` | `features/api/core/http/*/webhook/webhook.controller.ts` and `features/api/core/http/mount/foundations/mount-foundations.controller.ts` | Five payment and storage gateways whose exit is spelled in the folder and the filename, and one file whose exit is the `@Res(` in its signature. In each, the reason is readable without leaving the file. |
| `TRANSPORT-3` | `modules/**` | Grep `@Controller` across the whole capability tree and get nothing back. The anchor for this code is an **absence that holds** — every door in the repository sits under `features/`, and the tree proves it without a document being consulted. |

Every code is anchored. Anchors are paths in the reference repository and exist for verification
only.

## Inputs

| Input | Evidence required |
|---|---|
| door | Which kind: resolver, controller, gateway, consumer |
| payload | Whether the operation carries fields or bytes |
| caller | Who reaches this door: a client holding the schema, an external system, a machine, an operator |
| identity | Which subject the request carries, and which guard establishes it |
| exit | Which of the four cases applies, if any, and the token in the file that shows it |
| address | The `features/` path the file will live at |

## Rules

1. An operation that takes fields and returns fields goes in the schema. There is no second question.
2. A `@Controller` exists only in one of the four cases, plus the liveness probe. The list is
   **closed**.
3. The evidence for that case must be readable **in the file itself** — from the route, from the
   filename, or from a token in its text.
4. No registry, allow-list or design document may justify a door.
5. Every door lives under `features/`, whatever its transport.
6. A capability stays under `modules/` and is called by a door, never reached directly.
7. If no exit can be shown, the default wins: it goes in the schema.
8. Being a door decides the address; transport does not.
9. Every door resolves to exactly one code per situation. No door is out of scope.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and names the code it applies
to.

- **The liveness probe.** Under `TRANSPORT-2`, a route matching `health` or `healthz` is an exit
  outside the four. It exists because the probe must answer while the application is degraded, and a
  probe that needs the feature layer up cannot report that the feature layer is down.
- **A separate application assembles its own doors.** Under `TRANSPORT-3`, the `modules/**`
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

One block per file the accepted shape produces.

```text
door: <resolver | controller | gateway | consumer>
operation: <what it does>
situation: <TRANSPORT-1 | TRANSPORT-2 | TRANSPORT-3>
exit: <none | external | bytes | machine | operator | probe>
evidence: <the route, filename or token in the file that shows the exit>
address: features/<path>
reason: <why GraphQL cannot carry this, or "GraphQL can" for TRANSPORT-1>
```

## Worked example

The accepted shape: a payment gateway confirms a settled charge by posting a signed callback to a
URL the product publishes, and the product client then reads the resulting payment status for the
order it is showing.

The shape states the operations, their payloads, their callers and the identities involved. It does
not state which transport either door speaks, which directory holds it, or what token inside the
file will prove the choice — those are not resolved by the shape and are resolved here.

```text
door: controller
operation: receive the gateway's settlement callback
situation: TRANSPORT-2
exit: external
evidence: filename webhook.controller.ts, route segment webhook
address: features/api/core/http/payment/webhook/webhook.controller.ts
reason: the gateway posts to a fixed URL we published and will never send a GraphQL document
```

`reason` excludes `TRANSPORT-1` on one fact: the caller is not the product client holding the schema
— it is an external system posting to a URL we gave it, which is the first of the four exits.

```text
door: resolver
operation: read the payment status of an order
situation: TRANSPORT-1
exit: none
evidence: no exit token in the file; structured JSON in, structured JSON out
address: features/api/core/graphql/payment/payment.resolver.ts
reason: GraphQL can
```

`reason` excludes `TRANSPORT-2` on one fact: no token in this file shows any of the four exits — no
`webhook` route, no bytes, no machine route prefix, no operator guard — so the default wins.

Both files also carry `TRANSPORT-3`, and that is not a conflict: `TRANSPORT-3` decides the address
for each of them and both addresses begin with `features/`, while the capability each calls into
stays under `modules/`.

## Scope

This rule holds for any door of this kind in this stack — any backend whose product surface is one
schema. It names no single feature, no product, no company and no repository. The Anchor table is
the only place carrying repository paths, and it carries them as verification, not as illustration.
