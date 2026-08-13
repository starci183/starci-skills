# transport

## Definition

A **door** is any file the outside world can reach: a resolver, a controller, a socket gateway, a
broker consumer. This law settles one question about doors and one only — **when is a door allowed
not to be GraphQL** — and where the answer lands on disk.

The question matters because the answer is nearly always "it isn't". This repository's product
surface is a code-first GraphQL schema; a client that talks to it already holds a GraphQL client, a
schema, generated types and one endpoint. Every REST route added beside that is a second protocol
for the same client to learn, a second place to put authentication, and a shape no generated type
covers. That cost is worth paying exactly when GraphQL **cannot** do the job — and never because a
route was quicker to write.

The failure this prevents is not one bad controller. It is what a codebase looks like after twenty
case-by-case decisions nobody wrote down: two door layers, no stated line between them, and a
reader who cannot tell whether `api/theme` is REST for a reason or by accident. Measured at the time
this law was written, fifteen of eighteen doors had a reason visible in the file and three did not —
so the design was mostly coherent and looked like a mess, which is the worst of both.

What holds this law is [`sources/be/transport.mjs`](../../../sources/be/transport.mjs).

## Rules

**TRANSPORT-1 · The default door is GraphQL.**

An operation that takes fields and answers with fields is a mutation or a query. There is no second
question to ask. The rules below are the complete list of exits, and a door that fits none of them
does not get to argue about it — it goes in the schema.

**TRANSPORT-2 · A `@Controller` is permitted only where GraphQL cannot serve, and the file must show
which case it is.**

Four cases, and no others:

| case | what it looks like in the file | why GraphQL cannot |
|---|---|---|
| **an external system posts to a URL you gave it** | the route or the filename says `webhook` | a payment gateway posts to a fixed URL. It will never send a GraphQL document, and you do not get to ask it to |
| **bytes, not fields** | `FileInterceptor`, `StreamableFile`, `@Res(`, `createReadStream` | multipart upload and streamed download. GraphQL carries JSON |
| **a machine registering itself** | the route starts `pods/`, `internal/`, `agents/` | a pod calling home at boot has no user session to carry |
| **an identity that is not a user session** | the route starts `api/ops`, or an operator/service-token guard is used | a platform operator or a service token is a different subject from the product's viewer, and hanging it off the same guard would let one academy's admin operate the platform |

A liveness probe (`health`, `healthz`) is the one thing outside this table: it has to answer while
the application is degraded, possibly before the feature layer is up at all.

**The evidence is read off the file, not off a registry.** A list of blessed routes rots the first
time somebody adds one and forgets, and it lets a door be justified by a document rather than by
what it does.

**TRANSPORT-3 · A door lives under `features/`, whatever its transport.**

`modules/` holds capabilities — the things a door calls. A door parked among them reads as a
capability and gets imported like one, and the two door layers end up in two different trees with
no reason stated anywhere. Transport was never what decided the address; being a door is.

This binds `src/modules/**` only. A separate application under `apps/*` assembles its own doors and
is not subject to this split.

## What this law does not say

It does not say a REST door is second-class, and it does not ask anyone to remove one that has a
reason. Four of the cases above are permanent: webhooks will not start speaking GraphQL, and files
will not stop being bytes. It says only that the reason must be **in the file**, so the next reader
settles the question by looking rather than by guessing.
