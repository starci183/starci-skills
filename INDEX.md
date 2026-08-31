# StarCi v7.5-alpha runtime

This Source owns one composable StarCi runtime. Resolve the requested project routes, select one
mission-owning Skill, and let that Skill call peer Skills and atomic operators until the requested
outcome is proven or a genuine authority decision is unavailable.

## Load order

1. Read `.claude/config.yaml` and apply its runtime visibility settings.
2. Read `.claude/scope.yaml`, `.claude/analyze-input.md`, and `.claude/request-vocabulary.md` against
   only the active request; freeze one multidimensional mission scope or ask before source inspection.
3. Resolve the exact project and role through `<Source>/.workspaces/`; never guess a nearby checkout.
4. Select one mission owner from `.claude/skills/catalog.json` and read only that Skill's `SKILL.md`,
   input/output contracts, machine, and references required by its active intent.
5. Validate the normalized Skill input, enter its declared start state, and execute only the operator
   named by the current state.
6. Validate every operator output and bind it to the exact machine, state, operator, execution, and invocation before the Skill machine chooses the next transition. Raw prose, trace fallback, or a narrated outcome cannot route.
7. When the mission crosses a durable capability boundary, emit a typed Skill `CALL`; consume the
   exact typed `RETURN`, emit `RESUME`, and continue from the recorded state instead of restarting.
8. Finish only at a validated terminal whose output contains the required source heads and evidence.

Do not preload the entire runtime. Default repository/file search reads canonical routed source and
Markdown directly. Qdrant, a generated source index, and `.worktrees/coding-context/` are not part of
v7.

Every material AI brainstorm or review is completed end to end by exactly one fresh `gpt-5.6-sol` execution with no inherited turns. The parent Skill owns the call and transition; operators remain atomic. No second AI role or aggregation stage exists in this lifecycle. When `debug=true`, terminal output includes normalized AI CALL/RETURN/TRANSITION contracts and every concrete per-raster lens/challenge finding, including passed observations, while secrets and hidden reasoning remain excluded.

Every Skill analysis must record an evidence-backed disposition for adding, changing, and removing
capability before routing. This is neutral falsification, not a quota: each direction may be adopted,
rejected, or marked not applicable, but none may be silently skipped. Terminal quality PASS repeats
the same structured three-direction proof.

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

Validation is fail-closed. Prose never overrides a structured contradiction, skipped state, missing
evidence cell, incomplete preservation decision, or failed cross-field invariant. A transition may
consume only the validated product of its declared current operator; manually narrating a later state
does not advance the machine.

Every Skill inherits `knowledge/adversarial-review.md`. Before accepting a material claim, observe the
direct artifact without producer rationale, try to falsify it, consult authority only after recording
the observation, classify the smallest owning defect, repair that owner, and reproduce the evidence.
Existing code, infrastructure, framework choices, tests, measurements, and prior PASS text are
evidence or constraints, never truth by incumbency. A terminal transition is invalid while an
applicable attack, alternative causal hypothesis, confirmed contradiction, or defect owner is missing.

## Critical agency and user interaction

Preserve the user's outcome, not a weak literal method. Challenge source precedent and the requested
approach against business value, authority, evidence, reversibility, and stronger alternatives. Make
the best reversible decision and continue when one action materially dominates.

Neutrality applies to the runtime itself: do not defend current UI composition, backend topology,
infrastructure, Grammar, or StarCi knowledge because it is already present. Direct counterevidence may
prove implementation wrong, but it may also prove the reusable rule or incumbent architecture wrong.
Repair the smallest demonstrated owner and rerun the same claim from fresh evidence.

Before selecting any Skill, compile a scope that conforms to `.claude/scope.yaml` and freeze its unit,
targets, inclusions, exclusions, write roots, external effects, completion proof, and every material
domain-specific dimension. Scope is mission input, not a static description of a Skill. When two
plausible interpretations would change any material dimension, stop and ask one focused question that
names the competing boundaries and the exact missing authority; source inspection must not be used to
guess the user's intended scope. For frontend UX/UI work, one conditional dimension is
`frontend.ux-ui.change-level` from `knowledge/ux-ui-change-levels.md`.

Wait for the user only when no valid next action dominates, scope or product authority is genuinely missing,
or a destructive/external mutation needs new authorization. For every redesign without an already
approved direction, follow `knowledge/direction-visualization.md`: render one dominant direction
through `visualize` and continue inside the frozen boundary. Render three or four materially different
choices and wait for selection only when the user explicitly asks to compare alternatives.
Architecture choices render architecture boundaries and flows; UX/UI choices render
realistic representative pages or substantial surfaces and responsive/material states. Prose,
Mermaid, ASCII, tables, or implementation plans alone never satisfy this choice proof. Resume the
same mission after selection. Do not ask for approval between routine analysis, implementation,
repair, rendering, quality, and proof states already inside mission scope.

### Post-completion counterevidence

User feedback received after a mission was reported complete is counterevidence, not a cosmetic
follow-up. Invalidate the affected terminal verdict immediately, emit `ERROR` with the contradicted
claim, `RESUME` the same mission from its last proof state, and reproduce the report before defending
or repairing anything. Critique both the prior verdict and the user's proposed remedy against direct
evidence; the user can be right about the failure and wrong about its cause or fix.

When confirmed counterevidence exposes a systematic gap in how StarCi observes, attacks, or proves a
result, update the smallest owning `.claude` review mechanism and its meaningful regression proof
before closing again. Do not turn a page-specific arrangement, one screenshot preference, or the
user's proposed patch into a general law. Product defects are repaired in product source; `.claude`
changes only when the failure demonstrates a reusable process or authority gap. A reopened mission
returns to complete only after a causal failure record, canonical same-mission and same-Skill
`ERROR -> RESUME`, and one fresh ordered `CALL -> RETURN -> TRANSITION` lifecycle descended from that
`RESUME`. The proof lifecycle belongs to the same owning Skill and must name every affected evidence
reference on the latest source; proof from a peer Skill cannot close the reopened verdict.

Before reporting a repair for confirmed counterevidence, explain the failed prior decision in a
compact causal record: the exact earlier claim, the evidence or assumption that made it appear valid,
the newly observed contradiction, and the missing authority/proof check that allowed the false
terminal. This is an accountability trace, not hidden reasoning. Do not replace it with apology,
"fixed now", or a list of changed files. Challenge the user's proposed cause separately; accepting
the observed failure does not require accepting an incorrect diagnosis or remedy.

## Runtime trace

`.claude/config.yaml` is the single runtime configuration authority. With `debug: true`, render every
normalized Skill/operator `CALL`, `RETURN`, `TRANSITION`, `WAIT`, `RESUME`, `SKIP`, and `ERROR` with
parent/child identity, context, exact input, expected and actual output, evidence, source heads,
transition rule, resume state, and progress fingerprint.

WAIT may resume only through a runtime-issued immutable `RESUME` wrapped by the canonical wait
validator. It binds owning Skill, mission, wait state, parent invocation, and the exact resolved input,
and is consumed once. Plain objects, clones, retargeting, or replay do not route.

For visual AI, every supplied raster must additionally print one `[AI REVIEW][image: ...]` block,
concrete `[FINDING][lens][PASSED|PROBLEM] ...` observations, and a `[VERDICT]`. An omitted inspection
record prints `[FINDING][inspection][MISSING]` and `[VERDICT] BLOCKED`; silence can never mean PASS.

Debug changes visibility only. Receipts remain available when debug is false. Always redact secrets,
credentials, authorization values, sensitive URL parameters, and hidden reasoning. Never persist or
display chain-of-thought.

## Proof and authority

| Authority | Canonical owner |
| --- | --- |
| Runtime configuration | `<Source>/.claude/config.yaml` |
| Central local runtime registry | `<project-backend>/.worktrees/sessions/central-runtime/owner.json` |
| Mission scope protocol | `<Source>/.claude/scope.yaml` |
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

For local StarCi product work, the Control Panel delegates exactly one centralized runtime task to own
FE `localhost:3000`, API `localhost:3001`, and identity `localhost:8080`. Feature, audit, quality, and
UAT tasks are consumers: they communicate runtime needs to that owner and must not start, stop,
restart, replace, or claim any shared listener. UAT identity is isolated by account and Browser
session, never by rebinding server environment or launching a per-feature API. Only the Control Panel
may create or replace the runtime-owner task. A verified service failure is reported to that task;
feature work pauses without mutating shared processes.

## Validation

Focused Skill/operator tests must pass before integration. The Source-wide release then validates the
13-skill catalog, v7 machines, operator contracts, nested call/resume traces, flat worktree topology,
UAT templates, default-search boundary, site materialization, and realistic forward tests including:

```text
audit Profile -> business/backend dependency -> resume frontend -> one blind Sol visual review -> quality -> UAT
create page X -> direction decision only when necessary -> implementation -> proof
```
