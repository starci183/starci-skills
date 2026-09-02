# Context for `fe.direction.decide`

## Purpose

Context is the exact material already available to make the frontend direction decision. It answers
“what may this operator use?” before ideation begins. Context never expands mission scope and never
turns evidence into authority.

The operator reads only the references supplied in top-level `context`. Every reference is immutable for
the invocation and bound by a `sha256:` fingerprint. Source-backed observations additionally bind the
observed source head.

## Context classes

| Context | Role in the decision | Authority status |
| --- | --- | --- |
| Request | Objective, explicit comparison request, named target, inclusions, and exclusions. | Mission authority only for the requested outcome and boundary. |
| Business receipt | Actors, promise, permissions, entitlements, negative outcomes, recovery, and accepted product behavior. | Required business authority. |
| Backend receipt | Approved API, state, auth/session, persistence, and failure contracts consumed by the UI. | Conditional technical authority. |
| Architecture receipt | Approved system boundary, data ownership, stack, or topology that constrains the UI. | Conditional technical authority. |
| Published Grammar | Reusable components, compositions, tokens, states, responsive interfaces, and semantic roles. | Required reusable UI authority. |
| Knowledge | Product-neutral UX/UI laws, accessibility guidance, direction-generation guidance, and product Grammar knowledge. | Guidance and reusable law; never product behavior authority. |
| Frontend source | Current target, route-local layouts, directly nested owners, shared consumers, and relevant tests or stories. | Evidence of current implementation, never requested-direction authority. |
| Product-family source | Sibling surfaces and shared visual signatures such as hierarchy, shell rhythm, navigation, and semantic color roles. | Evidence of family coherence, never a template. |
| UAT | Prior behavior, UX, and UI observations, including failure and recovery paths. | Evidence and counterevidence; prior PASS is not current authority. |
| Owner audit | Adjacent `audit.md` history for page, layout, modal, or drawer owners. | Evidence and regression history. |
| Visual evidence | Existing screenshots, renders, benchmark rasters, or user-provided counterexamples. | Pixel evidence only. |
| Previous direction | A prior decision receipt and its artifacts. | Evidence unless the exact direction identity, fingerprint, and direction-specific approval are supplied. |
| External reference | Bounded research for an unfamiliar domain or interaction model. | Evidence only; never a layout, brand, or business template. |

## Required context

Every invocation requires:

1. at least one request reference;
2. one accepted business receipt matching the project and target scope;
3. one published Grammar binding;
4. at least one applicable knowledge reference;
5. exact frontend source context for the project, even when the target is new.

Backend and architecture receipts are required when the direction consumes or changes those owned
contracts. Their absence is a typed gap, not permission to create fixtures, fake controls, invented
states, or visual-only behavior.

## Selection rules

- Read the current target for `modify`, `audit-repair`, and `reconcile`. For `new`, verify that the
  target is absent and inspect only the authorized host and product-family context.
- Read only sibling surfaces that establish a relevant shared relationship. Do not copy a page.
- Use UAT and audits to discover states, regressions, and counterevidence. Do not inherit their verdict.
- Use external research only when business authority and product-family evidence do not explain how a
  user recognizes the offer, decides, understands risk, completes the task, or recovers.
- Stop research when material interaction patterns converge, or after one broadened retry yields only
  inaccessible, duplicate, irrelevant, or non-material evidence.
- A missing reusable component, token, state, or responsive interface is `GRAMMAR_REQUIRED`; it is not
  a local styling opportunity.

## Observation discipline

Observe direct artifacts before reading producer rationale. Record the smallest applicable fact and
its exact reference. Existing code, green tests, DOM structure, measurements, screenshots, and prior
PASS text may support or contradict a claim, but cannot authorize a business or direction decision by
incumbency.

Every material proposal receives add/change/remove dispositions. A direction is invalid while an
applicable business contradiction, owner leak, Grammar invention, responsive failure, accessibility
failure, unresolved adverse state, or materially stronger reversible alternative remains.

## Boundary

The operator may read only the declared context references. It may write only its receipt and
inspectable visual artifacts under `input.project.artifactRootRef`. Product source, business heads,
backend contracts, architecture decisions, Grammar packages, UAT, and audit history are read-only.

## Resources

This operator runs end to end on the `sol-fresh` profile (`gpt-5.6-sol`, runtime `codex`), declared under `resources` in `operator.json` and validated by `scripts/validate-resources.mjs`. Grants it requires: web search, browser. It may search the web, bounded by the exact gap it must close and recorded, is bound to published Grammar, and generates product artwork only when product authority names it. A grant absent from `requires` is unavailable even if the profile would permit it.
