# Workspaces

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@config-schema` | `contexts/workspaces/config.schema.json` | file | validate Source-wide defaults shared by every project and role |
| `@schema` | `contexts/workspaces/schema.json` | file | validate the record's JSON shape |

## Record

You are given a plain start request — "start example-app fe be" — and you return, for every role
it names, one resolved route and one verdict: read from this checkout, or stop and return to setup.
This module decides **where the truth is read from**. Nothing downstream is correct if this is wrong,
and a wrong answer here does not announce itself: the agent reads a real repository, just not the
one the request meant.

## Law

A Source-wide default is resolved first from `.workspace/config.json`, valid against `@config-schema`.
`defaultLang` sets the language of user-facing replies for every project and role unless the current
request explicitly selects another language. It is read once, not copied into every role route.

A route is resolved from a declared file, never inferred. `project` and `role` are the whole lookup
identity; a sibling checkout name, a directory that happens to be open, and what a previous session
used are not evidence.

A route is a claim about a machine, so it is **verified before it is read**. A recorded path that no
longer holds what it says it holds is a stale route, and a stale route is worse than a missing one:
missing forces a question, stale invites a confident wrong answer.

## Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `WORKSPACE-1` | Start names a project and roles | resolve one route file per role |
| `WORKSPACE-2` | A named route file is absent | stop; return to workspace setup |
| `WORKSPACE-3` | Route resolves; the checkout is where reads and writes go | read `repository.diskPath` directly |
| `WORKSPACE-4` | A role needs its domain contract | read `context.contract`, with `contractSource` as its provenance |
| `WORKSPACE-5` | The route records a path or head that no longer holds | stop; the route is stale, not approximate |
| `WORKSPACE-6` | The route carries local paths, secrets or credentials | route stays machine-local; never copied into the trust tree |
| `WORKSPACE-7` | The Source-wide workspace config resolves | apply `defaultLang` to every user-facing reply |

## Reading a start request

1. **Resolve shared defaults.** Read `.workspace/config.json`, validate it against `@config-schema`,
   and retain `defaultLang` for every user-facing reply — `WORKSPACE-7`.
2. **Take the request literally.** `start <project> <roles...>` names exactly the roles to load. Do
   not add a role because the repository looks like it has one, and do not drop a role because the
   last session did not use it.
3. **Resolve one file per role**: `.workspace/<project>/<role>/config.json`. Every named file must
   exist — `WORKSPACE-1`.
4. **Verify before reading.** For each route, the checkout directory must exist and must still hold
   the evidence the route claims: the contract path for a frontend role, the manifests it names.
   A failure here is `WORKSPACE-5` and it stops the run.
5. **Read the checkout, not a copy.** The configuration is routing only — `WORKSPACE-3`.
6. **Never widen the route.** A missing or stale route returns to setup — `WORKSPACE-2`,
   `WORKSPACE-5` — and setup refreshes configuration only; it never clones, links, copies or edits a
   target repository.

## `WORKSPACE-1` — a start request names project and roles

**Situation.** The request states an identity and one or more roles, and each role has its own route
file. Two roles are two routes, not one route with two readings.

**Recognition signs**

- The request names a project.
- Each role is a word the route path can be built from.
- Nothing in the request describes a directory.

**Ask yourself.** Can every named role be turned into an existing file path without guessing?

**A project names a family of checkouts, not necessarily a product.** Tooling gets a project like anything
else — same shape, same verification, no privileges. Every project name must be **distinguishable from
every other on this machine**: one that is a prefix or substring of another leaves a rollup line, a warning
and a glob each able to mean two projects, and nothing downstream can recover which was meant.

**Boundary**

- `WORKSPACE-2`: if a named file is absent, this code is not reached. Resolution is all-or-stop, not
  partial.

**How it fails.** A role is inferred from a sibling checkout that happens to be on disk, so the agent
loads a repository nobody asked for and reports on it as if asked.

## `WORKSPACE-2` — a named route file is absent

**Situation.** The request names a role for which no route file exists on this machine.

**Recognition signs**

- The path built from project and role does not exist.
- Another role of the same project resolves fine.

**Ask yourself.** Is the missing thing the route, or the repository the route points to?

**Boundary**

- `WORKSPACE-5`: a route that exists but no longer describes the checkout is stale, not absent, and
  it is a different verdict with a different fix.

**How it fails.** The absent role is silently replaced by the closest one that resolves, and every
later statement is about the wrong role.

## `WORKSPACE-3` — the checkout is the place reads and writes go

**Situation.** The route resolved, and work now happens in the real repository at
`repository.diskPath`.

**Recognition signs**

- The route carries a disk path, a git root, a branch and a head.
- The configuration holds no source file of its own.

**Ask yourself.** Am I about to read a copy of the repository instead of the repository?

**Boundary**

- `WORKSPACE-4`: reading the contract is a narrower act with its own provenance requirement.

**How it fails.** A mirror, mount, link or cached copy is read instead of the checkout, so the answer
describes a snapshot while the repository has moved on.

## `WORKSPACE-4` — a role needs its domain contract

**Situation.** A frontend role must know what components and slots exist before it can answer
anything about composition, and the contract path is the only authority for that.

**Recognition signs**

- The route names a contract path.
- The route also records how that path was chosen — declared, or discovered.

**Ask yourself.** Do I know whether this contract path was declared by a human or discovered by a
scan?

**Boundary**

- `WORKSPACE-5`: a contract path that no longer exists is a stale route, not a contract question.

**How it fails.** The contract is assumed from a folder convention rather than read, so components
that were renamed or removed are still proposed.

**A frontend role can genuinely have no registry.** A landing page or marketing site may install the
lint machine without ever adopting the contract vocabulary. `contract: null` still reports as a finding
by default — most of the time it means nobody has searched, and a monorepo hides the registry from a
one-app convention. `contractSource: "discovered:none"` is how a completed search that found nothing
differs from a search that never ran: it names the absence as verified, not skipped.

## `WORKSPACE-5` — the route is stale

**Situation.** The route file is valid and complete, and a value in it no longer describes the machine:
a recorded path is not on disk, or the checkout can no longer reach the recorded head, or it is on a
different branch.

**Recognition signs**

- Every field is present and well formed.
- A recorded path does not resolve, a recorded head is unreachable from the checkout, or the branch differs.

**Ask yourself.** Did I verify the route, or only parse it?

**Boundary**

- `WORKSPACE-2`: absence is a missing file; staleness is a present file that lies.

**How it fails.** Nothing raises an error. The run proceeds against whatever is at the old path and
produces work that looks finished and applies to nothing.

## `WORKSPACE-6` — the route carries machine-local facts

**Situation.** The route holds disk paths and public git metadata. It is local configuration, not
shared knowledge.

**Recognition signs**

- The values differ from machine to machine.
- The trust tree would be wrong on another machine if it contained them.

**Ask yourself.** Would committing this value make the tree wrong for somebody else?

**Boundary**

- `WORKSPACE-3`: reading the checkout is allowed; publishing where the checkout lives is not.

**How it fails.** A path or a token is copied into a rule, and the rule silently becomes true on one
machine only. Runtime secrets, environment values and tokens are never workspace context at all.

## `WORKSPACE-7` — shared defaults apply to every reply

**Situation.** `.workspace/config.json` is valid and its `defaultLang` applies to every project and role
in this Source.

**Recognition signs**

- The config sits directly under `.workspace`, outside every project directory.
- The value is a BCP 47-style language tag such as `vi` or `en-US`.

**Ask yourself.** Did the run resolve the shared default before producing user-facing prose?

**Boundary**

- An explicit language instruction in the current request overrides the default for that run only; it
  does not rewrite the config.

**How it fails.** Each skill chooses its own reporting language, so one run replies in Vietnamese and
the next silently returns to English even though both use the same Source.

## Inputs

| Input | Evidence required |
|---|---|
| request | The literal project and role list |
| workspace config | `.workspace/config.json`, valid against `@config-schema` beside this record |
| route | `.workspace/<project>/<role>/config.json`, valid against `@schema` beside this record |
| checkout | The directory at `repository.diskPath`, present on disk |
| contract | The file at `context.contract`, and `context.contractSource` for its provenance |
| freshness | Recorded head and branch still describing that checkout |

## Rules

1. Resolution is all-or-stop. A partially resolved request is not a resolved request.
2. Identity comes from `project` and `role`. A directory name is not identity.
3. Verify before reading. Parsing a route is not verifying it.
4. The route describes; it never mirrors. Configuration holds no copy of a target repository.
5. Setup refreshes routes only. It never clones, links, copies or edits a target repository.
6. Route values stay machine-local. They are never committed into the trust tree, and secrets are
   never route values in the first place.
7. Every start request resolves to exactly one verdict per role: read, or stop.
8. `defaultLang` is resolved once from `.workspace/config.json` and applies across every project and role.

## Exceptions

- **A role that is legacy.** A legacy role is a route, not a second rule set. It is read to interpret
  parity and migration evidence and never overrides the active contract.
- **A discovered contract.** `contractSource` may record discovery rather than declaration. The path
  is still authoritative for the run, but the discovery is what a reviewer is owed when the path
  turns out wrong.
- **A role with no contract.** A backend role may carry no contract path. `WORKSPACE-4` is then not
  reached, and its absence is not a stale route.

## Output

One block per role, in the order the request names them:

```text
project: <project>
role: <role>
route: .workspace/<project>/<role>/config.json
repository: <diskPath>
verified: <what was checked against disk or git>
situation: <WORKSPACE-1 | WORKSPACE-2 | WORKSPACE-3 | WORKSPACE-4 | WORKSPACE-5 | WORKSPACE-6>
verdict: <read | stop>
reason: <the fact that decided it>
```
