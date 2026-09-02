# Context for `architecture.decide`

## Purpose

Context is the exact material already available to decide one architecture. It answers "what may this
operator read?" before any target is proposed. Context never expands the objective, and it never lets
something that merely exists become something that is right.

Every reference is immutable for the invocation and bound by a `sha256:` fingerprint. Source-backed
observations additionally bind the observed source head.

## Context classes

| Context | Role in the decision | Authority status |
| --- | --- | --- |
| Business authority | The promise the architecture must keep. | Required. Architecture analysis depends on it and never replaces it. |
| Routed source | The verified checkout and its head. | Required. Every observation of the current state comes from here. |
| Observed inventory | The runtimes, frameworks, persistence, communication, build, deployment, and operational ownership evidenced by manifests, configuration, and deployment files. | Required evidence. Never a target and never a justification. |
| Architecture pattern | A reusable pattern the scope may bind. | Evidence. It suggests a shape; it does not select one. |
| Prior decision | An earlier decision on the same or an adjacent boundary. | Evidence and lineage. It may be contradicted, but not ignored. |

## Required context

Every invocation requires:

1. at least one business authority reference;
2. the routed source reference whose head equals `input.project.sourceHead`;
3. the observed inventory, with every component naming the file that evidences it.

Reading routed source is evidence discovery. It is never permission to mutate that source.

## Refs

| Alias | Resolves to | Bind | Required |
| --- | --- | --- | --- |
| `@business/<featureId>` | `<Source>/.worktrees/businesses/features/<featureId>/model.json` | content address from &lt;Source&gt;/.worktrees/businesses/business-registry-v1.json (featureHeads.&lt;featureId&gt;.head) with its authorityStatus | Required: The promise the architecture must keep. |
| `@be` | `<checkout:input.project.id/be>  (the backend checkout of the project this invocation binds)` | fingerprint + sourceHead (git rev-parse HEAD of the checkout) | Required: The routed checkout observed at the frozen head; the inventory comes from its manifests and deployment files. |
| `@knowledge/patterns` | `<Source>/.claude/knowledge/<group>/  (every canonical .md inside; a single file may be named as <group>/<topic>.md)` | fingerprint per file; the rule inventory is the set of `## PREFIX-n` headings across the folder's canonical files | Optional: Reusable patterns the scope may bind; a shape, not a selection. |
| `@receipt/architecture-decision/<invocationId>` | `<@artifacts of invocation <invocationId>>/<receiptType>.json (the receipt file that invocation registered in output.artifactRefs)` | fingerprint + the sourceHead the receipt binds | Optional: A prior decision on the same or an adjacent boundary; lineage. |
| `@artifacts` | `input.project.artifactRootRef; convention <Source>/.worktrees/sessions/<invocationId>/artifacts/` | fingerprint per artifact; every artifact an operator writes is registered in output.artifactRefs | Required: Where current state, alternatives, stack model, critique, and receipt are written. |

## Incumbency is not authority

The inventory says what the system runs today. That is the most useful and the most dangerous context
this operator receives.

An existing framework, datastore, broker, or deployment shape enters the decision in exactly two
roles: as a measurable constraint the target must satisfy, or as observed evidence about behaviour
that is already proved. It never enters as a reason by itself. A component justified because it is
already there is rejected outright, because "we already run it" answers a question nobody asked about
correctness, ownership, or failure.

## Warrant

Architecture analysis is warranted only for a meaningful cross-boundary trade-off: correctness,
ownership, consistency, security, failure, recovery, capacity, cost, latency, migration, or
operability. The objective names at least one such axis, and every alternative is then assessed on all
of the named axes. Comparing two options on different criteria produces a preference, not a decision.

## Constraint separation

Constraints arrive separated into fixed intent, measurable constraints, preferences, assumptions, and
unknowns. At least one fixed intent and at least one measurable constraint are required. Without a
measurable constraint, nothing distinguishes an alternative from a taste, and the comparison cannot be
falsified by anyone later.

## Boundary

Context is read-only. The operator writes only its receipt, the observed current state, the rendered
alternative comparison, the stack model, and the critique, all under `input.project.artifactRootRef`.
It does not mutate routed source, publish business authority, start or reconfigure runtime services,
or claim that an implementation, a quality gate, or a UAT run has passed.

## Resources

This operator runs end to end on the `sol-fresh` profile (`gpt-5.6-sol`, runtime `openai`), declared under `resources` in `operator.json` and validated by `scripts/validate-resources.mjs`. Grants it requires: web search. It may search the web, bounded by the exact gap it must close and recorded, is not bound to Grammar, and generates no image. A grant absent from `requires` is unavailable even if the profile would permit it.
