---
name: starci-be-feature-apply
description: Write exactly the StarCi/nivo backend files an approved plan names, and prove them with the twin specs, the flow e2e and a live call. Use after starci-be-feature-plan records a file list in the task file. Never reopens a shape decision inside a handler.
---

# StarCi BE Feature Apply

Read [`../../skill-shape.md`](../../skill-shape.md) first.

The architecture is settled. This half writes THAT, and not something adjacent that occurred to the
author while typing. The failure it prevents arrives quietly: a second entity nobody reviewed, a rule
moved into the service because the handler was getting long, an operation that grew a fourth door.
Each is defensible alone and none was ever approved.

## SCOPE

Print the table — app and database included — then **confirm `Repo / branch` and `Touching` with the
owner before the first write.** A correct plan and a correct detection still do not say that now is
the moment to write into a repository somebody else may be working in.

Read `## plan` in the task file. No file list means `$starci-be-feature-plan` has not run; the list
IS the review, so building without one ships the shape unreviewed.

## PROCESS

One operation, one folder, every file named for it. The work goes in the handler; the service
dispatches; the resolver is a door. A failure is a domain exception that names itself — never `null`,
never `{ ok: false }`, because the caller then guesses with less information than the handler had.

**A file the plan does not name does not get written.** If the work turns out to need one, that is
the architecture being wrong and worth knowing: name the file, say why, and put it back to the owner
as a confirm row. Scope that to the one operation folder — the others are independent by construction, so
they are built and proved meanwhile.

When the sibling family does something canon's prose forbids, mirror the family the plan named
rather than making this one operation the exception. That divergence was already recorded; do not
re-decide it here, in one file, at the end of a long day. Check what the artifact under
[`../../sources/be/`](../../sources/be/) actually says before calling something a violation — the
rules are narrower than the prose.

**Prove it, and paste what the commands said.** A command named in a summary is a command nobody ran.

- **The handler's twin spec, exhaustively.** Enumerate every reachable case before writing the first
  `it`, then count the list against the file. Finished means nothing is left over, not that the happy
  path and one refusal are green. A branch nobody can reach is not an excuse to skip it: either it is
  reachable and needs a case, or it should not be in the handler. A spec whose every assertion is
  `toHaveBeenCalled*` restates the source — break the rule while keeping the call shape and it stays
  green.
- **The e2e for the flow, including the refusals.** An auth flow proving only success proved the half
  nobody doubted. It enters through the production boundary — GraphQL, HTTP, a real socket, a real
  broker message, the scheduler. Calling a handler or the bus starts after routing, guards,
  validation and serialization have already succeeded.
- **A live call against the running API.** A passing test and a reachable endpoint are two different
  claims, and the second is the one a client makes.

A projection is proved through the broker or it is not proved. Publishing a source row and polling
until it settles exercises serialization, the consumer group and delivery; calling `recomputeTarget`
exercises a method. That difference is the whole subject, and it is also why a seeded number looks
broken: writing the source table changes nothing visible until the listener has run.

## OUTPUT

The four tables. Append `## apply` to the task file: the SCOPE
table, **every file written**, the commands and their output, and what is still owed — the state
nothing covers, the migration not written, the assumption taken rather than answered.

That file list is the check: compare it against `## plan` directly above it. A summary that reads as
finished when it is not is the one artifact that makes the next session slower, because it spends the
next reader's time proving something is missing that the author already knew.
