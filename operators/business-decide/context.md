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
| Business authority root | The `.worktrees/businesses/` root: `features/<featureId>/` heads, the `business-registry-v1.json` head index, and the `objects/sha256/` content store. | Required. Decides which lifecycle transition is legal. |
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

Business heads are published under the project backend's `.worktrees/businesses/` root, which is
its own git worktree. One feature owns exactly one head directory, `<businessesRootRef>/features/<featureId>`,
whose `model.json` is the head. `business-registry-v1.json` at the root indexes every feature head by
content address with its `authorityStatus`, `baseHead`, `previousHead`, and bound source heads;
`objects/sha256/<hash>.json` keeps each published version; `history/by-id.json` keeps lineage. A head's
fingerprint is its content address, so authority binds even before the worktree commit lands.

`features/` is the only segment between the root and a feature. A project segment inserted below the
root starts a second authority tree that later readers never find, so the operator rejects any head
that is not exactly `features/<featureId>`. The runtime Source keeps its own `<Source>/.workspaces/`;
that path is never a business authority root.

## Boundary

Context is read-only. The operator writes only the feature head and its coverage matrix under the
businesses root, plus its own typed receipt. It does not edit architecture authority, frontend
authority, or backend implementation, and it never claims that an implementation, a quality gate, or
a UAT run has passed.

## Resources

This operator runs end to end on the `sol-fresh` profile (`gpt-5.6-sol`, runtime `codex`), declared under `resources` in `operator.json` and validated by `scripts/validate-resources.mjs`. Grants it requires: web search. It may search the web, bounded by the exact gap it must close and recorded, is not bound to Grammar, and generates no image. A grant absent from `requires` is unavailable even if the profile would permit it.
