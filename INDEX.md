# StarCi v7 runtime

This Source owns one composable StarCi runtime. Resolve the requested project routes, select one
mission-owning Skill, and let that Skill call peer Skills and atomic operators until the requested
outcome is proven or a genuine authority decision is unavailable.

## Load order

1. Read `.claude/config.yaml` and apply its runtime visibility settings.
2. Read `.claude/analyze-input.md` and `.claude/request-vocabulary.md` against only the active request.
3. Resolve the exact project and role through `<Source>/.workspaces/`; never guess a nearby checkout.
4. Select one mission owner from `.claude/skills/catalog.json` and read only that Skill's `SKILL.md`,
   input/output contracts, machine, and references required by its active intent.
5. Validate the normalized Skill input, enter its declared start state, and execute only the operator
   named by the current state.
6. Validate every operator output before the Skill machine chooses the next transition.
7. When the mission crosses a durable capability boundary, emit a typed Skill `CALL`; consume the
   exact typed `RETURN`, emit `RESUME`, and continue from the recorded state instead of restarting.
8. Finish only at a validated terminal whose output contains the required source heads and evidence.

Do not preload the entire runtime. Default repository/file search reads canonical routed source and
Markdown directly. Qdrant, a generated source index, and `.worktrees/coding-context/` are not part of
v7.

## Source routing

`<Source>` is the host repository that owns `.claude`, `AGENTS.md`, and `.workspaces`. A routed
repository or Git worktree follows this runtime; it does not become a second Source and does not need
another `.claude/INDEX.md`.

The routing invariant is:

```text
project + role
  -> portable route in <Source>/.workspaces/projects/<project>/<role>.json
  -> hydrated local route
  -> verified checkout identity and source head
```

Similar names, sibling directories, the current working directory, and a browser URL are hints, not
route authority. Source mutation starts only after route verification freezes the exact checkout and
allowed boundary.

## Backend-owned worktrees

Each project's verified backend Source owns one flat container:

```text
<project-backend>/.worktrees/
  _templates/
  businesses/
  uat/
    <feature>/
      <flow>/
        snapshot.json
        result.json
  sessions/
    <session-id>/
      session.json
      calls.ndjson
      receipts/
  debts/
```

There is no `.worktrees/<project>/` layer. Frontend and other routed sources provide implementation
and runtime evidence but do not own business, UAT, session, or debt authority.

`businesses/` publishes approved business heads. `uat/` contains only the canonical frozen input and
result pair for one feature flow. `sessions/` contains resumable execution state and normalized call
receipts, never hidden reasoning. `debts/` contains explicitly declared quality debt. Runtime schemas
and copyable templates live under `.claude/templates/`; the backend `_templates/` directory is their
version-bound project instance.

## Skills and composition

Public Skill identity is authoritative only in `.claude/skills/catalog.json`. A Skill name follows
`starci-<owned-object>-<action>` and owns one durable authority, mutation, proof, or risk boundary.
Broad verbs such as audit, create, repair, redesign, debug, reconcile, recover, and rollback are input
intents when they share that boundary; they are not reasons to create phase Skills.

Exactly one Skill owns the active mission. A child Skill may freely make reversible source changes
inside the inherited, verified mission boundary. It must return a typed result to its caller and may
not replace the parent objective, widen scope, or self-certify work owned by another boundary.

Every Skill call records:

```text
mission context + exact input + expected output
  -> CALL child
  -> validated output + evidence + source heads
  -> RETURN
  -> RESUME exact parent state
```

Cycles such as frontend -> backend -> frontend are valid only when the normalized progress
fingerprint changes. Repeated fingerprints or repeated material findings terminate the loop and route
to a better direction, declared debt, blocker, or genuine user authority choice.

## Operator law

An operator performs one job:

```text
(context + input) -> typed output
```

It does not call another operator or Skill, own state-machine branching, hide alternative workflows,
or return free-form control instructions. Its closed schema, validator, executable guidance, side
effects, and two-color StarCi `icon.svg` define the contract. The parent Skill alone maps validated
output fields to transitions.

## Critical agency and user interaction

Preserve the user's outcome, not a weak literal method. Challenge source precedent and the requested
approach against business value, authority, evidence, reversibility, and stronger alternatives. Make
the best reversible decision and continue when one action materially dominates.

Wait for the user only when no valid next action dominates, product authority is genuinely missing,
or a destructive/external mutation needs new authorization. When a product or visual direction must
be selected, visibly render three or four materially different choices, explain their tradeoffs,
recommend one, and resume the same mission after selection. Do not ask for approval between routine
analysis, implementation, repair, rendering, quality, and proof states already inside mission scope.

## Runtime trace

`.claude/config.yaml` is the single runtime configuration authority. With `debug: true`, render every
normalized Skill/operator `CALL`, `RETURN`, `TRANSITION`, `WAIT`, `RESUME`, `SKIP`, and `ERROR` with
parent/child identity, context, exact input, expected and actual output, evidence, source heads,
transition rule, resume state, and progress fingerprint.

Debug changes visibility only. Receipts remain available when debug is false. Always redact secrets,
credentials, authorization values, sensitive URL parameters, and hidden reasoning. Never persist or
display chain-of-thought.

## Proof and authority

| Authority | Canonical owner |
| --- | --- |
| Runtime configuration | `<Source>/.claude/config.yaml` |
| Public Skill discovery | `<Source>/.claude/skills/catalog.json` |
| Workspace routing | `<Source>/.workspaces/` |
| Operator contracts | `<Source>/.claude/operators/` |
| Business heads | `<project-backend>/.worktrees/businesses/` |
| UAT snapshot/result | `<project-backend>/.worktrees/uat/<feature>/<flow>/` |
| Session trace | `<project-backend>/.worktrees/sessions/<session-id>/` |
| Declared quality debt | `<project-backend>/.worktrees/debts/` |
| UI principles and reusable Grammar | `<Source>/.claude/knowledge/` |

Tests, lint, screenshots, and prior PASS text are evidence, not business authority. UAT freezes its
inputs before execution, evaluates independent Behavior, UX, and UI evidence, and publishes a result
only after proof. Post-journey mutation cannot manufacture a passing result.

## Mutation boundaries

The active task authorizes reversible mutations required to complete its bounded outcome. External
publication, deployment, destructive replacement, secret rotation, and force Git operations require
their exact declared authority. A child Skill inherits only the parent's verified mutation boundary.
Read-only diagnosis never receives write roots or external mutation authority.

Before changing a shared product runtime, inventory its listener, command, working directory, and
session owner. Reuse a healthy verified runtime. `EADDRINUSE` is a coordination finding, not permission
to kill another process.

## Validation

Focused Skill/operator tests must pass before integration. The Source-wide release then validates the
12-skill catalog, v7 machines, operator contracts, nested call/resume traces, flat worktree topology,
UAT templates, default-search boundary, site materialization, and realistic forward tests including:

```text
audit Profile -> business/backend dependency -> resume frontend -> independent review -> quality -> UAT
create page X -> direction decision only when necessary -> implementation -> proof
```
