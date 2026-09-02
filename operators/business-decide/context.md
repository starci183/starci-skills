# Context for `business.decide`

## Purpose

Context is the exact material already available to decide one business promise. It answers "what may
this operator read?" before any modelling begins. Context never expands the objective and never turns
an example into product truth.

Every reference is immutable for the invocation and bound by a `sha256:` fingerprint. Source-backed
observations additionally bind the observed source head.

## Context classes

| Context | Role in the decision | Authority status |
| --- | --- | --- |
| Evidence index | The normalized claim set for this objective and the fingerprint that freezes it. | Required. The only place a claim may come from. |
| Claim | One separated observation: fact, intent, example, unknown, or contradiction, cited by role, path, line range, and head. | Required. Only a fact may carry enforcement. |
| Business authority root | The flat `.worktrees/businesses/` root and every published feature head with its state. | Required. Decides which lifecycle transition is legal. |
| Backend source | The routed checkout and its head. | Evidence that every claim and consumer belongs to the frozen source. |
| Architecture reference | Approved boundary and ownership decisions the promise must respect. | Evidence. Never a source of business behaviour. |

## Required context

Every invocation requires:

1. the evidence index plus at least one claim;
2. the business authority root and its published heads;
3. the routed backend source reference whose head equals `input.project.sourceHead`.

A claim that cites a source nobody bound is invalid input rather than a warning, because an unbound
citation is indistinguishable from an invented one.

## Claim separation

Business modelling begins by separating fact, intent, example, unknown, and contradiction. That
separation is carried in `context.evidence.claims[].kind` and survives into the published decision.

The separation exists to make one substitution impossible. An example, a screenshot, or an owner's
intent illustrates a promise; only an observed fact in routed source proves that the promise is
enforced. A coverage row that asserts enforcement must therefore cite at least one `fact` claim, and
every `fact` claim must bind the observed source head.

## Authority boundary

Business heads are published under the project backend's flat `.worktrees/businesses/` root. One
feature owns exactly one head, named `<businessesRootRef>/<featureId>`.

The root is flat on purpose. A project segment inserted below it starts a second authority tree that
later readers never find, so the operator rejects any head that is not exactly one segment deep. The
runtime Source keeps its own `<Source>/.workspaces/`; that path is never a business authority root.

## Boundary

Context is read-only. The operator writes only the feature head and its coverage matrix under the
businesses root, plus its own typed receipt. It does not edit architecture authority, frontend
authority, or backend implementation, and it never claims that an implementation, a quality gate, or
a UAT run has passed.
