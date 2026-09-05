# runtime.serve

## Job

Serve one product route's integration branch on its one fixed port: climb the named rung of the
runtime ladder for the bound route — bring the environment's infrastructure up, locate the routed
checkouts, start a role, merge this session's commit into the integration branch and serve it,
restart, reset or stop the one detached server — attest the entry from what answered, and hold the
lease that orders sessions.

## Done when

Done when the `platform-operation-receipt` binds the authority that covered the desired state and
the `checks` prove the named rung's whole proof set on the route's entry, none absent or failed,
with the `delta` recording each effect applied to that entry from an inventory rechecked before the
first change, the served head, what it contains, the detached server's record and the released
lease; a serve that merged the session's commit also records each conflict resolution, the passing
gates on the merged head and the merge as `changes`, and a serve that found the wanted commit already
served records the head as reused.

## The registry is one entry per project route

One machine runs the routes of several products at once, so the runtime registry holds one entry per
`<project>/<role>` and every reader takes the entry of its own route. A registry with a single
endpoint block can attest exactly one route, and every other bind reads it as not ready while the
service it needs is listening — a false negative indistinguishable from an outage. The previous
single-block shape is still read for one release, as the entry of the route it names, and a registry
that carries both must agree; the release after this one drops it.

## The runtime ladder, climbed one rung at a time

A machine that has just been switched on has no database, no identity provider, no checkout resolved
and nothing serving, and every one of those is a different missing thing with a different owner. The
operator therefore climbs a ladder in one order, each rung a closed operation the caller names and
each rung attested before the next is attempted, so a registry entry always says exactly how far up
it is instead of being either ready or mysteriously not.

| Rung | What it does | Proves |
| --- | --- | --- |
| `stack-up` | Brings up the environment's declared infrastructure with the tooling that environment declares, waits for its readiness probes, and confirms the declared origin rule admits the served origin | `infra-ports-open`, `cors-origin-admitted`, `generation-advanced` |
| `locate` | Resolves the project's roles to routed checkouts through the workspace routes, never by directory name, and records the head observed in each | `checkout-located`, `head-observed`, `generation-advanced` |
| `start-role` | Starts a role's server from its integration worktree, backend before frontend, under the dev command its declaration or its package scripts publish | `entry-declared`, `endpoints-served`, `head-observed`, `generation-advanced`, `integration-merged`, `server-pid-owned`, `lease-honoured` |
| `serve` | Merges one session's work into the integration branch, resolving any conflict by rule and gating the merged head, and has the server run the result, under the build-cache rule | the `start-role` set plus `gates-passed` |
| `restart` | Starts the same head again, same branch, same port, under the build-cache rule | the `start-role` set |
| `reset` | Stops, clears the build cache by name, starts again | the `start-role` set |
| `stop` | Stops the server: the recorded pid's process tree is stopped, the port is proved free, and the lease released | `entry-declared`, `generation-advanced`, `server-pid-owned`, `lease-honoured` |

A rung that cannot be climbed stops with the code that names the owner of the gap and no other: infra
that will not come up, or a backend whose declared origin rule does not admit the served origin, is
`PROVISIONING_UNAVAILABLE` naming what is missing and the declaration line to add; a route with no dev
command to run is `INVALID_INPUT` naming the field it lacks. A merge that conflicts is not one of
these: it belongs to `serve` itself, resolved at integration time rather than escalated to a person,
which is the whole reason the merge happens here. The `stop` rung is how a session that is finished —
published, or abandoned — hands its server back: the publishing operator asks for it by name and never
kills the pid itself, because the pid the entry recorded is this operator's to stop and no other's.

## A conflict is resolved by the integrator, not escalated to a person

`serve` resolves a merge conflict itself, under a closed rule set, rather than stopping and handing it
to a person: for a hunk only one side touched, that side's version wins; for a hunk both sides
touched, both behaviours are kept where they are additive — separate imports, sibling declarations,
separate table rows; for every other hunk both sides touched, the incoming session's version wins in a
file the session's write set owns, and the branch's version wins everywhere else. Every hunk resolved
this way is recorded on its merge, in `runtimeLadder.integration.merges[].resolutions`, naming the
file, the hunk's range and which of the four rules applied — the record is what lets a later reader
tell a clean merge from one that took a side.

Resolving a conflict is not the same as trusting the result. Before the server restarts on the merged
head, `serve` runs the delivery gates the product declares for it — patch coverage against the base
the integration merged included — reading them from the product's own declared scripts rather than a
list copied into this tree, and only a red gate stops the rung, with `INTEGRATION_FAILED` naming the
failing gate and the resolutions that were made. The audit and UAT that follow on the integration
branch are what catch a broken result the gates cannot see; the gate here only refuses to serve a head
that fails what it can see. `INTEGRATION_FAILED` is resumed by a person or the owning session
repairing the session branch and asking to serve again — never by rebasing, forcing or abandoning the
merge that produced the failing head.

## One branch, one server, one fixed port

The runtime serves a per-product integration branch, and the port that branch is served on never
moves. That is not a convenience: an identity client's redirect URIs, a backend's allowed origins and
every callback registered at any provider are declared against a port, so a runtime that moved the
port to make room for a second session would break the sign-in of the first, and would then have to
mutate a provider's allow-list at runtime to repair what it had just broken. Nothing here registers
an origin, because nothing here moves a port.

Two sessions on one product are therefore not two servers. Each asks for its own commit to be served,
and `serve` merges that session's branch into the integration branch — a merge commit, never a
rebase — and restarts the one server on the result. The served head then carries the work of both,
and the entry records `contains`: the commits that head is known to carry. A conflict surfaces here,
early, where the two changes actually meet, instead of at publication where it would block a finished
piece of work — and it is resolved here too, by rule and under a gate, rather than handed to a person
mid-merge. The integration branch is also merged from the mainline periodically, so it does not drift
into a state that nothing else shares.

## A consumer's own commit inside a shared head

Because one head carries several sessions' work, a consumer that demanded the served head equal the
commit it applied would fail every time a second session was present, and it would be failing on
arithmetic rather than on evidence. The test is ancestry: the applied commit must be an ancestor of
the served head. A surface that satisfies it carries the work under audit, whatever else it also
carries. Both commits are recorded — what was applied and what is served — because a reader who
cannot see the two cannot check the claim. Only a failed ancestry test is drift.

## A server that outlives the branch that started it

The server a rung starts is detached. It has to be: the branch that started it ends, and the audit or
the journey that needs it runs in another branch, sometimes in another session. A process nobody
recorded is then a process nobody can find, so the entry carries the whole of it — the exact command,
the pid, the log file under the session folder and the pid file beside it. The tree ships the helper
that does this (`scripts/serve-runtime.mjs`), and it is named here so that starting a server is one
recorded act rather than a shell line somebody improvised. The recorded pid is usually a wrapper
and the process answering on the port is its child, so the record names both when they differ, and a
stop stops the whole process tree of the recorded pid and no other tree, then proves by connecting
that the port no longer answers before the record is cleared; when something still answers, the
record stays and the result names the surviving listener by the pid the socket table gives, because
a cleared record over a held port is the fixed-port conflict the next start would refuse on.

A restart is not a rebuild. A framework's dev server compiles into a build cache under the worktree
and serves from it, and that cache is only as fresh as the install it was compiled against: when the
served head moves to one whose dependency manifests or lockfiles — the manifests the route declares,
and the lockfiles beside them — differ from those of the previously served record, a restart alone
keeps serving what the old dependencies compiled while the installed packages are already the new
ones, and what the audit then measures is a stylesheet or a chunk nobody ships any more. So every
rung that starts a server decides about the cache before it starts, and the helper makes that
decision rather than the operator remembering to: it digests the declared manifests and lockfiles,
compares the digest with the one the previous record carries, and clears the conventional build
directories of the worktree's packages when the digest differs, when no previous record is known,
or when `--clean` — which `reset` always passes — asks by name. The server record carries the
decision: whether the cache was cleared, for which of those reasons, which directories went and
which previous head it was compared against. A record that says the cache was kept while the
previous head is unknown, or that `reset` kept it, is refused, because a cache nobody can prove was
cleared is the same defect with a politer log line.

`serve` is idempotent by head. When the running server's head already contains the wanted commit and
its endpoint answers, the operation attests it and returns it: nothing is merged, nothing is
restarted, no new pid appears, and the receipt records that the head was reused. Restarting a healthy
server to be allowed to describe it destroys the state the next step was going to measure, which is
the same reason attestation never restarts anything. `restart` and `reset` exist for when a person
actually wants that, and they are asked for by name.

## The lease is the merge order

One session integrates at a time. The session that serves takes the lease while it merges and
restarts, and releases it when the server answers again; a session that asks while another holds it
is recorded in the queue, told its position and the holder, and waits. It is never given a second
server, because a second server is the contention the lease exists to remove. The wait is short by
construction: a lease is held for one merge and one restart, not for the length of an audit.

## A port in use is a coordination finding

A port already bound by another process is a fact about a shared machine, not permission to reclaim
it. The operation records `PORT_COORDINATION_REQUIRED` naming both the port and the process that
holds it, returns `PORT_CONFLICT`, and stops. It does not stop, kill, restart, or reconfigure the
holder, and no mutation may target a process observed holding a claimed port. Moving to another port
is not an answer either: the port is what every provider was configured against. Coordination is the
required next step and it belongs to the two owners, not to this invocation.

## Two sessions, one product

This is the one place the isolation law is written; the seeding, audit and journey operators cite it
and do not restate it. Two sessions may work on one product at the same time when all five of these
hold, and each is a gate rather than an intention.

- One product, one integration branch, one server, one port: heads are merged in turn under the
  lease, and the backend, the identity realm and the database are shared and scoped rather than
  duplicated.
- Each flow's actors are its own account aliases, provisioned for that flow and named in its record.
- Each session drives its own browser profile, recorded in the run's own snapshot, so one session's
  cookies are never the other's session.
- Seeds are attributable to the flow and touch no shared row: every seeded row is owned by the
  flow's provisioned account, or carries the flow's prefix in an identifier where the store has no
  owner column, and the rollback lists exactly those rows and nothing else. A store with neither an
  owner column nor a prefixable identifier is a recorded limitation of that seed, never a schema
  change made to satisfy this law.
- No operator writes another session's lease, account or run folder: the lease, the account's
  provisioning attribution and the run's snapshot all name the session that asked, and a write whose
  session differs is refused rather than merged.

## Attesting a runtime nobody restarted

A process that is already serving is evidence, not a problem. Every rung ends by probing the
endpoints the entry declares, recording the head it observes and the probe records behind it, and
setting the entry's status from what answered. Nothing is started, stopped or restarted to make that
possible: a person's own running service is registered exactly as it stands, because the alternative
— restarting a runtime in order to be allowed to describe it — destroys the state the next step was
going to verify. An entry whose endpoints do not answer is `SERVICE_UNAVAILABLE` against the endpoint
that failed, never a status this operator asserts on its own.

## Inventory before change

The route's entry is inventoried before it is changed. The inventory is bound by fingerprint, so the
receipt states exactly what the entry was when the decision was made, and a concurrent revision
becomes visible as `INVENTORY_DRIFT` rather than being silently overwritten. The recheck happens
before any mutation, so a differing revision stops the invocation while nothing has changed yet.
Anything mutated appears in the inventory echo, so a change to a resource nobody looked at first
cannot be reported as an operation at all. An entry that already serves the wanted head is a proved
no-op with no mutation, not a failure and not a rewrite, and a converged operation that reports no
mutation is refused because one of its two statements is false. Application touches only effects
inside the approved set, one resource at a time, recording the before and after revision of each; a
partial application is reported as `PARTIAL_MUTATION` with exact revisions and is never hidden behind
a generic blocker.

## Credentials are resolved, never recorded

A capability is a handle and its custody evidence. The credential behind it is resolved for use at
the moment of the call and is never logged, echoed into evidence, or persisted. The receipt refuses
the handle as well as the value, because a receipt is durable and a durable record of a capability is
a leaked credential with a delay; a string carrying credential material anywhere in the request or
the response is refused as malformed.

## The desired state is one approved declaration

`desiredState` is the whole of what the caller asks for: the approved plan hash, the service kind
(always `runtime` here), the resources to converge, the effects to apply, and the two scope sets that
say which resources may change and which may only be observed. Keeping it as one declaration is what
makes the approval mean something: `approval` covers that declaration, hash and all, so a field
edited afterwards no longer matches the hash the approval named.

Where the authority behind `approval` comes from is the environment's to say. Every environment of
the installation declares, per class of platform operation — the shared runtime's rungs and the
stack's bring-up among them — whether its own declaration is the approval (`declared`) or a person's
approval id is required (`person`). The declaration's shape, its place in the environment's folder,
the defaults an omitted class takes by whether the environment is production, and the one loosening a
production declaration is refused are all the environment schema's
(`readiness/initialization/stacks/environment.schema.json`), stated there once and read from there by
the gate. `approval` therefore accepts either an approval id or the declaration's reference — its
path and the hash of its content — and the receipt's Approval row records whichever was bound. The
validator derives the operation's class from its effects, reads the declaration the reference names,
and refuses the reference when the declaration is absent, hashes differently, belongs to another
environment, is refused by its schema, or marks that class `person`; a hash that moved between the
request and the run is `AUTHORITY_DRIFT`. `approval` still has no default: a runtime other sessions
and other people share is never changed on silence, and what the declaration changes is that the
environment's standing answer counts as the approval, not that the question stops being asked.
`portClaims` defaults to the empty list, because most rungs need no port at all and a claim nobody
made cannot collide with anybody.

## Boundary

Context is read-only apart from the approved delta. The operator applies only the approved effect
delta on the inventoried route entry, under an exclusive lease on
`@worktrees/sessions/central-runtime`, and writes only `response/` of its own branch:
`data/delta.json`, `data/checks.json`, `changes.md`, `response.md` and `response.json`. It also
writes the runtime entry of the route it attests, and nothing else outside `response/`. It is the one
owner of a served runtime's lifecycle: it merges into the integration branch and starts, restarts,
resets and stops the server of a route the registry records, under a named rung, and it stops only
the process tree of the pid the entry itself recorded. It does not deploy, migrate, provision an
account, seed data, or otherwise take ownership of a product's deployed service; does not restart or
reconfigure a running process in order to attest it, and never restarts a healthy server nobody asked
it to; does not act while another session holds the lease; does not rebase, force or abandon a merge
to make it apply; does not mutate a resource the bound inventory does not list; does not emit an
effect or a check the runtime ladder does not publish; does not move a served port, or free one by
stopping, killing, or reconfiguring the process that already holds it; does not edit a running
service's allowed origins in place of the declaration that should carry them; does not record a
credential value, capability handle, or secret-shaped token anywhere in the output; does not edit
knowledge, write an environment's declaration, or otherwise grant its own approval; and does not
claim an operated outcome while any required check is absent or failed, nor any product readiness,
release approval, or UAT proof.

## Context

| Alias | Bind | Required |
| --- | --- | --- |
| `@worktrees/sessions/central-runtime` | the shared runtime owner: the entry of the bound route with its server, lease and queue, bound by fingerprint and generation, written only under an exclusive lease | yes |
| `@workspaces/ports/<project>` | the port projection the route's server binds to | yes |
| `@workspaces/device-state` | capability handles by name and their custody; values never appear | yes |
| `@workspaces/projects/<project>/<role>` | the route's declaration: its dev command, integration branch and declared manifests | yes |

## Inputs

| Kind | From | Required |
| --- | --- | --- |
| `changes` | `backend.generate`, `interface.generate` or `library.update`; the session's committed work that `commit` names, read only to know which files the session's write set owns when a conflicting hunk is resolved | no |

## Requirements

| Field | Type | Default | Ask |
| --- | --- | --- | --- |
| `routeKey` | id | — | The `<project>/<role>` registry entry this rung climbs and attests |
| `operation` | choice | serve | The rung of the runtime ladder this invocation climbs: `stack-up`, `locate`, `start-role`, `serve`, `restart`, `reset` or `stop` |
| `commit` | id | null | The commit this session needs served, merged into the integration branch when the served head does not already contain it |
| `env` | id | dev | The stack the attested entry belongs to; the environment whose infrastructure `stack-up` brings up |
| `approval` | id | — | The authority that covers this desired state: an approval id, or the environment declaration's reference — its path and content hash — when that declaration marks this rung's class `declared` for `env`; no default, because silence is not consent |
| `desiredState` | `{planSha256, serviceKind, resourceRefs, effects, mutableResourceRefs, observationOnlyResourceRefs}` | — | The approved declaration: which plan, the `runtime` kind, the entry it touches, the effects the rung applies, and what may change against what may only be observed |
| `portClaims` | list of `{port, resourceRef}` | [] | Which ports the rung needs, and for which entry |
| `resume` | token | null | The blocked branch's token when re-entering after a stop |

## Steps

| # | Step | Params | Reads | Writes | Stops with |
| --- | --- | --- | --- | --- | --- |
| 1 | Validate the gate and the resume against the frozen generation | `resume` | `request/request.json`, @worktrees/sessions/central-runtime at the frozen generation | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Bind the authority — an approval id, or the environment's declaration re-read and re-hashed — and the registry-write capability by name | `approval`, `env` | @workspaces/device-state for the capability handle with its custody evidence, the environment's declaration when `approval` references it, @tools/secrets | — | `AUTHORITY_DRIFT`, `CAPABILITY_MISSING` |
| 3 | Recheck the route's entry once before anything changes, and refuse a fingerprint that moved | `routeKey` | @worktrees/sessions/central-runtime for the entry re-observed, @tools/git for the served head | — | `INVENTORY_DRIFT` |
| 4 | Resolve the port claims against the projection and record who holds each | `portClaims` | @workspaces/ports/<project> for the projected ports, @worktrees/sessions/central-runtime for their observed holders, @tools/shell for the socket table | — | `PORT_CONFLICT` |
| 5 | Write the delta between the observed entry and the desired state | `desiredState` | @worktrees/sessions/central-runtime for the observed entry, `request/request.json` for the desired state | `response/data/delta.json` | `EFFECT_UNAUTHORIZED` |
| 6 | Climb the named rung under the lease — bring the infra up, locate the checkouts, start the role, merge `commit` into the integration branch and serve, restart, reset or stop the one detached server through `scripts/serve-runtime.mjs` — or queue behind the session that holds the lease | `operation`, `commit` | @workspaces/projects/<project>/<role> for the dev command and the integration branch, input `changes` for the session's write set, @worktrees/sessions/central-runtime for the lease and queue, @tools/git, @tools/container, @tools/shell | @worktrees/sessions/central-runtime, `response/data/delta.json`, `changes` | `SERVICE_UNAVAILABLE`, `PROVISIONING_UNAVAILABLE`, `INTEGRATION_FAILED`, `INVALID_INPUT` |
| 7 | Attest the entry: probe every declared endpoint, record the served head, what it contains and the server record, and set the status from what answered | — | @worktrees/sessions/central-runtime for the entry's endpoints, @tools/http | @worktrees/sessions/central-runtime, `response/data/delta.json` | `SERVICE_UNAVAILABLE` |
| 8 | Prove the rung's whole check set against the attested entry | — | @worktrees/sessions/central-runtime re-read against the rung's proof set, @tools/http | `response/data/checks.json` | `PROOF_FAILED` |
| 9 | Write the receipt and emit | — | everything above | `response/response.md`, `response/response.json` | — |

A resume begins again at validation, reuses only unchanged fingerprinted observations, and consumes
the exact delta; a resume that adds no authority, inventory, desired-state or scope change is
`NO_PROGRESS`, and a re-observed inventory must arrive as a new fingerprint because the same
fingerprint cannot yield a different answer.

A completed serve merge emits `changes` for independent quality verification. Its Binding retains
Operator, Step, Checkout and Predecessor and adds Base (the merge first parent, or the observed
predecessor for a fast-forward), Head (the actual served merge) and Branch (the declared integration
branch). Files is the exact Git diff from Base to Head. The validator reads that worktree and refuses
a stale head, branch or file list; a queued, reused or failed serve emits no new integration changes.
Raw gate evidence stays bound to this merged head.

## Outputs

| Kind | File | Type | Required |
| --- | --- | --- | --- |
| `platform-operation-receipt` | `response/response.md` | md | yes |
| `delta` | `response/data/delta.json` | data | yes |
| `checks` | `response/data/checks.json` | data | yes |
| `changes` | `response/changes.md` | md | no |

## Stops

| Code | Disposition |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `SOURCE_DRIFT` | terminate |
| `NO_PROGRESS` | terminate |
| `AUTHORITY_DRIFT` | terminate |
| `CAPABILITY_MISSING` | terminate |
| `INVENTORY_DRIFT` | terminate |
| `PORT_CONFLICT` | terminate |
| `EFFECT_UNAUTHORIZED` | terminate |
| `SERVICE_UNAVAILABLE` | terminate |
| `PROVISIONING_UNAVAILABLE` | terminate |
| `INTEGRATION_FAILED` | terminate |
| `PROOF_FAILED` | terminate |

## Next

| When | Operator |
| --- | --- |
| the routed checkout or its head no longer matches the frozen binding | `workspace.bind` |
| the runtime a frontend surface must be audited against is now serving | `interface.audit` |
| the runtime is serving and the flow that will walk it has no account yet | `identity.provision` |
| the runtime is serving and the flow's seed must be placed before it is walked | `data.seed` |
| the runtime is serving and the journeys to walk on it must be named, one flow each, before one is walked per branch | `uat.plan` |
| a completed serve emits merged changes for independent delivery gates | `quality.verify` |
| the served runtime is attested and the run that waited on it may verify the flow | `uat.verify` |
| the served runtime is attested and the delivery's own end-to-end suite may now be run against it as a client | `api.verify` |
| the runtime is serving and a tunnel or an observability service the mission names must be brought up beside it | `service.operate` |
