# canon/be — two lanes, by whether a machine can check it

Back-end canon is split by the same question as the front end: **can a script decide whether the
code obeys this?**

If yes, the rule lives in `enforce/`. It is convergent — a filename case eslint holds, a thrown
literal `tsc` catches, a boundary a folder-shape check can assert. You are *held to* it.

If no — if the rule is a judgement about the shape of a system, weighed against a trade-off rather
than checked by a linter — it lives in `explore/`. You *reason with* it.

Every rule in both lanes names the real `src/` file it was read from, or the public source it is
anchored to instead; if a rule and the source disagree, the source wins and the rule is stale — fix
it the way [`../HOW-TO-WRITE.md`](../HOW-TO-WRITE.md) describes.

## explore/system-design/ — the decisions taken before a line is spelled

Ten files about the shape of a backend rather than the text of its files: where a module boundary is
cut, what the API promises, what happens when a dependency stops answering, and what you can still
find out at three in the morning. Nothing here is gated — the anchors are public sources (Nygard,
Fowler, Evans, Hohpe and Woolf, the Google SRE book, the AWS Builders' Library, OWASP, the RFCs), not
files in this tree, so there is nothing in them to re-count and no path in them to go stale.

The full table, one row per file, is
[`explore/system-design/INDEX.md`](explore/system-design/INDEX.md):
`module-layering.md`, `api-design.md`, `data-access.md`, `auth-and-authz.md`, `caching.md`,
`messaging-and-events.md`, `background-jobs.md`, `cqrs-and-projections.md`, `resilience.md`,
`observability.md`.

## enforce/authoring/ — how a line of back-end code is spelled

Seven files about the text of the code rather than the design behind it: where a thing lives and what
it is called, what to do with a caught error, when a comment earns its place, how config and env are
read, how imports are ordered and formatted, what may not be typed loosely, and how input is
validated at the boundary. Most are grounded in this codebase's own `src/`, with a count and a date
that `scripts/verify.mjs` re-checks; a few are grounded in named public sources (Parnas, Evans,
Richardson, the RFCs) because the constraint comes from the platform rather than a house habit.

The full table, one row per file, is
[`enforce/authoring/INDEX.md`](enforce/authoring/INDEX.md):
`naming-and-structure.md`, `error-handling.md`, `comments.md`, `config-and-env.md`,
`imports-and-format.md`, `type-safety.md`, `validation.md`.

## techstack.md — the one place a concrete name is said out loud

Both shelves above are written portable on purpose — "the message broker," "the read model," "a
durable queue" — so a rule survives an infrastructure swap. [`techstack.md`](techstack.md) is the one
exception: it says, once, what this backend actually runs those portable words on today — NestJS,
TypeORM, PostgreSQL, GraphQL, NATS, Kafka, Debezium, BullMQ, Keycloak, MinIO, Elasticsearch — and
which `system-design/` or `authoring/` file each one grounds.

## Reading order

Open the shelf the task touches, not the set. A new feature typically crosses both: `system-design/`
for the shape it is being built out of, `authoring/` for how the resulting lines are spelled. Neither
lane is a curriculum, and a rule read out of context is a rule applied where it does not belong.

The old four-shelf split — `concepts/`, `modules/`, `contracts/`, `conventions/` — is retired. Every
rule that lived there moved into `explore/system-design/` or `enforce/authoring/`; nothing was
dropped silently, and a citation to the old paths is a citation that has gone stale.
