# Context for `uat.verify`

## Purpose

Context is the exact material already available to verify one product-decision flow. It answers "what
may this operator read, and what already admitted it?" before the first product action. Context never
widens the flow under test and never turns evidence into authority.

Every reference is immutable for the invocation and bound by a `sha256:` fingerprint. Source-backed
observations additionally bind the observed source head.

## Context classes

| Context | Role in the decision | Authority status |
| --- | --- | --- |
| Backend Source | The routed checkout that owns canonical UAT authority at `.worktrees/uat/`. | Required. The only place the canonical pair may be written. |
| UAT protocol | Evidence law, fixture lifecycle, sequential execution, and finality. | Required reusable law. Never edited here. |
| Template authority | The canonical snapshot and result schemas the written files must satisfy. | Required. Consumed, never modified. |
| Admission | The final blind visual PASS and the final quality PASS that let product UAT begin. | Required. Their absence is a stop, not a warning. |
| Runtime owner | The ready owner artifact, its generation, and its exact FE, API, and identity origins. | Required evidence of a runtime that can be observed. |
| Evidence references | Prior receipts, captures, and runtime observations. | Evidence only. Never a verdict. |

## Required context

Every invocation requires:

1. the routed backend Source whose head equals `input.sourceHead`;
2. the protocol and template bindings with their fingerprints;
3. both admission receipts with the times they passed;
4. one ready runtime owner whose frontend origin equals the lease origin.

A missing admission receipt is `ADMISSION_MISSING`. A runtime owner that is not ready is
`RUNTIME_UNAVAILABLE`. Neither is repaired here: UAT observes a product, it does not build one.

## Refs

| Alias | Resolves to | Bind | Required |
| --- | --- | --- | --- |
| `@uat/<flow>/<case>` | `<Source>/.worktrees/uat/<flow>/<case>/` | fingerprint of snapshot.json and result.json | Required: The canonical snapshot and result pair for the flow. |
| `@templates` | `<Source>/.worktrees/_templates/{businesses,debts,sessions,uat}/` | fingerprint per file | Required: UAT protocol and template authority; consumed, never modified. |
| `@runtime` | `<Source>/.worktrees/sessions/central-runtime/owner.json` | fingerprint + generation | Required: A runtime that can be observed; readiness is proved, not assumed. |
| `@source/starci-academy/be` | `<checkout:project/role>` | fingerprint + sourceHead (git rev-parse HEAD of the checkout) | Required: The checkout whose behaviour the flow verifies. |
| `@artifacts` | `input.project.artifactRootRef; convention <Source>/.worktrees/sessions/<invocationId>/artifacts/` | fingerprint per artifact; every artifact an operator writes is registered in output.artifactRefs | Required: Where captures and the verification receipt are written. |

## Identity is provisioned, never requested

An authenticated flow consumes one run-scoped identity the control plane created in both Keycloak and
the application database and then authenticated in a brokered Browser context. The operator receives
only opaque references: `account://fresh/...`, `keycloak-user://...`, `database-user://...`, and
`browser-lease://...`.

Asking the user to sign in, lend an account, or paste a credential is forbidden in every branch. When
provisioning authority, the local provisioner, or broker authentication is unavailable, the exact
outcome is `BLOCKED`.

An anonymous flow records no account at all. It declares `anonymous://explicit/...` and holds no
authenticated lease, so an inherited signed-in browser can never pass as anonymous entry.

## The account record holds no secret

The record frozen into the snapshot is a closed set of fields: the account reference, the Keycloak and
database record references, the principal fingerprint, the fixture namespace, the provisioning owner
and mode, the credential custody mode, and the authenticated state.

Every one of those fields is a constant, a fingerprint, or a scheme-bound opaque reference. There is
no free-form field, so a password, cookie, token, or OTP has no place to live even by accident. This
is a shape, not a rule anyone has to remember.

## Boundary

Context is read-only. The operator writes the canonical snapshot and result under the routed backend
Source, its receipt under `input.project.artifactRootRef`, and deletes only fixture records carrying
both `is_uat=true` and the exact frozen namespace. It does not edit the protocol, publish templates,
repair product source, or promote UI evidence over Behavior or UX evidence.

## Resources

This operator runs end to end on the `sol-reviewer` profile (`gpt-5.6-sol`, runtime `openai`), declared under `resources` in `operator.json` and validated by `scripts/validate-resources.mjs`. Grants it requires: browser. It never searches the web, is not bound to Grammar, and generates no image. A grant absent from `requires` is unavailable even if the profile would permit it.
