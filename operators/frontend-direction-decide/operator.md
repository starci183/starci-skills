# frontend.direction.decide

## Job

Decide one evidence-backed, implementation-ready frontend direction for one authorized target, and
prove it against the business promise, the published Grammar, the observed implementation and a
falsification pass that no candidate survives by taste.

## The change level decides what must be bound

The change level is the request's own authority and current source never proves it: an audit that
asks for a passing surface is `reconstruct`, not `refine`. `new` requires the business promise, and
it closes the state set and the exits before anything is drawn. `reconstruct` requires the promise
only when the state set changes, and it preserves the business facts, the behaviour authority and
the API semantics it inherits. `refine` requires no input authority at all, because it changes
nothing a promise could contradict. A backend implementation is required when a data contract
changes, an architecture decision when a boundary changes; neither is required otherwise, and
neither is ever invented. `create` occurs with `new` and only with it.

## Evidence contradicts, it does not authorize

The current implementation, a green test, a rendered DOM and a prior UAT pass are all evidence, and
each observation is recorded as a path at the head it was read at. Evidence must be observed before
any proposal is written: the target's direct artifacts without the producer's rationale, or, for a
new target, proof that the target is absent and only the authorized host and product-family context.
None of it authorizes a direction by incumbency. A page that exists is not a reason to build that
page again.

## Bounded research, and only where it is owed

External references are resolved only when the person supplied none and the change level is `new` or
`reconstruct`. A `refine` works from the family idioms alone. Every reference that survives is
recorded with its URL and with the exact limitation it carries; nothing copies a page, a brand, a
palette or a component anatomy. When bounded research cannot close the business or interaction
question the decision rests on, the run stops with the owning gap.

## A reference is named by class, not by adjective

`## References` is where the direction states which standard the surface is aiming at, and it names
it the way a reader would sort it: a class such as `console-grid` or `plan-comparison`, never an
adjective such as modern, clean or premium, because an adjective cannot be compared with a capture.
Each row also records what is borrowed — a composition decision, an ordering, a density — which is
what keeps the borrowing honest, since nothing copies a brand, a palette or a component anatomy. A
`new` or `reconstruct` direction carries at least one such row; a `refine` carries none, because the
structure it moves elements inside was already approved. This is what the later audit reads: the
taste lens sorts the capture beside the named standards, and a direction that named none falsifies
that lens before a single pixel is measured. A run that reaches the decision with no reference row is
not the caller's defect and never becomes `INVALID_INPUT`: it is this operator's own, so it stops
with `REFERENCE_MISSING`, which routes to `self` and is answered by naming the standards and running
the same direction again.

## The Grammar filter refuses invention, not ownership

A candidate that invents a missing shared interface, bypasses the owner ceiling, imitates unpublished
Grammar locally or contradicts a published composition is rejected. `GRAMMAR_REQUIRED` is only for a
missing family component, and it goes to a person who publishes it; the operator never composes a
substitute out of parts. A node the application legitimately owns, a canvas for instance, is not a
Grammar gap and never raises one.

## Candidates are falsified before they are chosen

Falsification attacks business and backend conformance, hierarchy, content density, action feedback,
recovery, responsive reflow, content stress, keyboard and focus behaviour, accessibility, family
coherence, reversibility and owner leakage, and every attack lands in the receipt with its verdict.
A direction is invalid while an applicable business contradiction, owner leak, Grammar invention,
responsive failure, accessibility failure, unresolved adverse state or materially stronger reversible
alternative remains. Under `refine` the candidates are element-level moves inside the approved
structure, never a new structure. When the only candidate fails an attack the run stops with
`NO_VIABLE_DIRECTION`, and when several survive, `DIRECTION_CHOICE_REQUIRED` selects the one that
survived the most attacks unless the person kept the choice.

## Boundary

Context is read-only. The operator writes only `response/` of its own branch: the decision receipt,
the coverage enumeration, the rendered candidate pages and `response.json`. It does not modify
product or authority source, invent business, backend, architecture, authentication, persistence or
data behaviour, publish shared UI Grammar, start or reconfigure runtime services, or claim that an
implementation, a visual quality gate or a UAT run has passed.

## Images are judged, not requested

An image is a composition decision like any other: when a candidate leaves a region that reads empty
(a hero without a subject, an empty state with only a sentence, a card row whose copy cannot carry the
width), the operator adds an image made to one stated claim of the direction (`@tools/imagegen`) and
records why, in the `## Images` table. It does not wait for a person to ask, and it does not decorate: a region that the
copy and the Grammar objects already carry gets no image, and an image never encodes a claim the
business promise did not make. The asset and its prompt land under `response/artifacts/images/`;
`frontend.source.apply` writes them with the declared write set.

## Context

| Alias | Bind | Required |
| --- | --- | --- |
| `@grammar/core` | the published Grammar as the bound app resolves it; the compositions a direction may bind | yes |
| `@knowledge/ui/composition` | the assertions the emitted receipt has to satisfy, `COVERAGE-1` being the assertion about the receipt as a whole | yes |
| `@workspaces/fe` | the routed frontend checkout read at the frozen head; the current implementation as evidence, never as the requested direction | yes |
| `@knowledge/grammars/<family>` | how the family the bound route names (`context.grammarId`) is meant to realize Common; law about the Grammar, never the Grammar itself | no |
| `@worktrees/uat/<flow>/<case>` | prior behaviour, UX and UI observations with their captures; evidence and counterevidence, and a prior pass is not current authority | no |

## Inputs

| Kind | From | Required |
| --- | --- | --- |
| `business-promise-authority` | `business.decide`; required by `new`, and by `reconstruct` when the state set changes | no |
| `backend-source-application` | `backend.source.apply`; required when a data contract changes | no |
| `architecture-decision` | `architecture.decide`; required when a boundary changes | no |
| `frontend-direction-decision` | a prior run of `frontend.direction.decide` on the same target, read when resuming | no |

## Requirements

| Field | Type | Default | Ask |
| --- | --- | --- | --- |
| `target` | id | — | The one route, page, layout, modal, drawer, flow, block or component this direction is for |
| `intent` | choice | modify | create, modify, audit-repair or reconcile; `create` occurs with change level `new` and only with it |
| `changeLevel` | choice | — | new, reconstruct or refine; an audit that must end in a passing surface is reconstruct |
| `ownerCeiling` | choice | surface-and-nested-layouts | surface-only, surface-and-nested-layouts or ancestor-layouts-authorized |
| `candidates` | number 1–3 | 1 | How many directions to form; more than one only when a comparison is wanted |
| `preview` | choice | no | yes renders the single candidate as an inspectable page |
| `references` | list | [] | External references the person supplies; bounded research runs only when this is empty |
| `selectionPolicy` | choice | automatic | `automatic`: the operator selects and records why; `approval-required`: the person selects |
| `approval` | id | null | The approved candidate id; required only under `approval-required`, supplied on resume after `DIRECTION_CHOICE_REQUIRED` |
| `resume` | token | null | The blocked branch's token when re-entering after a stop |

## Steps

| # | Step | Params | Reads | Writes | Stops with |
| --- | --- | --- | --- | --- | --- |
| 1 | Validate the gate and resume | `resume`, `approval` | `request/request.json`, input `frontend-direction-decision` when resuming, @workspaces/fe at the frozen head | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Check the request: route, scope, change level, owner ceiling | `target`, `intent`, `changeLevel`, `ownerCeiling` | @workspaces/fe at the frozen head, @tools/git | — | `ROUTE_UNVERIFIED`, `SCOPE_UNFROZEN`, `CHANGE_LEVEL_AMBIGUOUS`, `OWNER_CEILING_INVALID` |
| 3 | Bind the inputs the change level requires | `changeLevel` | inputs `business-promise-authority`, `backend-source-application` and `architecture-decision` | — | `BUSINESS_REQUIRED`, `BACKEND_REQUIRED`, `ARCHITECTURE_REQUIRED` |
| 4 | Observe the existing context | — | @workspaces/fe (the target's direct artifacts, or the authorized host and product family when the target is absent), @worktrees/uat/<flow>/<case> when present | — | `EVIDENCE_MISSING` |
| 5 | Compile one UI contract and its coverage, and declare the surface class | — | @knowledge/ui/composition (`COVERAGE-1` Case 7 publishes the class vocabulary), input `business-promise-authority` when present, the observed context | `response/data/coverage.json` | `SCOPE_UNFROZEN` |
| 6 | Resolve the reference standards by class, bounded | `references`, `changeLevel` | @knowledge/ui/composition (the gap the research must close), @tools/websearch | — | `REFERENCE_EVIDENCE_EXHAUSTED`, `REFERENCE_MISSING` |
| 7 | Form the candidates | `candidates` | the compiled UI contract | — | `NO_VIABLE_DIRECTION` |
| 8 | Apply the Grammar filter | `ownerCeiling` | @grammar/core (what a component owns and which props exist), @knowledge/grammars/<family> | — | `GRAMMAR_REQUIRED` |
| 9 | Render the decision evidence and the judged images, serve them for a person and print them | `candidates`, `preview` | the surviving candidates, @knowledge/grammars/<family> | `candidates`, `direction-image`, `host` | — |
| 10 | Falsify | — | the candidates, inputs `business-promise-authority` and `backend-source-application`, `response/data/coverage.json` | — | `NO_VIABLE_DIRECTION` |
| 11 | Decide | `selectionPolicy`, `approval` | the falsification table | — | `DIRECTION_CHOICE_REQUIRED` |
| 12 | Emit | — | everything above | `response/response.md`, `response/response.json` | — |

Step 5 also settles which kind of surface this is. `COVERAGE-1` Case 7 publishes the vocabulary, the
coverage carries the name in `surfaceClass`, and the receipt says the same name under
`## Surface class` with what puts the surface in that class. The two must agree, because the name
is what every banded proof rule later reads its threshold from: the audit takes the class from this
decision and never chooses one of its own, so a direction that names none leaves the audit with no
band and stops it. Every change level declares one; a refine inherits nothing and states it again.

Step 6 leaves the receipt with the standards this surface is aiming at, each named by class, each
carrying what is borrowed and what it does not settle. Under `new` and `reconstruct` that table has
at least one row and step 6 stops with `REFERENCE_MISSING` when it cannot produce one; under
`refine` it stays empty. Step 9 renders before step 11 writes the decision, because a structure nobody has seen cannot be
approved and a candidate described in prose is not a candidate anybody can judge. Under `new` and
`reconstruct` every candidate the run forms is rendered as its own page, whatever `preview` says and
however many there are: that is `@tools/visualize`, needs no grant, and every runtime does it.

The candidate pages are not files a person is asked to find. Step 9 serves the artifacts folder over
`@tools/host` (the tool the registry ships, never a server written for the occasion) on the loopback interface, at the first free port of the registry's range, and records
the URL, the port, the folder and the pid in `response/artifacts/host.json`; the server stops when the
branch ends or is resumed. Each candidate is served once per viewport of the coverage — one page per
viewport, or one page taking the viewport as a query string — so the person sees the wide and the
narrow render before deciding, which is the first of the two places responsiveness is looked at.

Serving is not telling. Before step 11 writes the decision, step 9 prints over `@tools/print` every
candidate's URL and one capture per viewport into the conversation the person is reading, and the
receipt lists each printed artifact under `## Printed` with why it was printed. A candidate served at
a port nobody was told about is a candidate nobody saw, and a decision taken over one is taken alone.

The same table is the whole hand-off when the choice is the person's. `DIRECTION_CHOICE_REQUIRED`
under `approval-required` stops with the receipt, and its `## Printed` table is the choice: one served
candidate per option, each with a capture per viewport, and at least three of them, because a
composition is chosen by eye — when fewer survived, the run renders the third from its own rejected
or element-level alternatives so the person compares renders rather than sentences. The stop's
`reason` names the sheet URL and asks one question and nothing more: two options written out in
prose are not a choice, they are advice, and the validator refuses a `user` route whose table holds
fewer rendered candidates than the choice has options, or none. `GRAMMAR_REQUIRED` and the caller
stops are operational — a person publishes, corrects or supplies something — so their `reason` says
so and carries no candidate.

Under
`refine` the page stays optional — the structure was approved before this run began — and is rendered
only when more than one candidate was formed or `preview` is yes; a single refine candidate under the
defaults produces no page and rests on step 10. Under `automatic`,
`DIRECTION_CHOICE_REQUIRED` selects the candidate that survived the most attacks and records the
table; under `approval-required` it stops and the person returns with `approval`. The receipt
authorizes the next domain to resolve and implement inside the frozen owner ceiling and proves
nothing about how the result renders.

## Outputs

| Kind | File | Type | Required |
| --- | --- | --- | --- |
| `frontend-direction-decision` | `response/response.md` | md | yes |
| `ui-coverage` | `response/data/coverage.json` | data | yes |
| `candidates` | `response/artifacts/<candidateId>.html` | artifact | no |
| `direction-image` | `response/artifacts/images/<slot>.png` | artifact | no |
| `host` | `response/artifacts/host.json` | artifact | no |

## Stops

| Code | Disposition |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `ROUTE_UNVERIFIED` | terminate |
| `SOURCE_DRIFT` | terminate |
| `SCOPE_UNFROZEN` | terminate |
| `CHANGE_LEVEL_AMBIGUOUS` | terminate |
| `OWNER_CEILING_INVALID` | terminate |
| `BUSINESS_REQUIRED` | terminate |
| `BACKEND_REQUIRED` | terminate |
| `ARCHITECTURE_REQUIRED` | terminate |
| `GRAMMAR_REQUIRED` | terminate |
| `EVIDENCE_MISSING` | terminate |
| `REFERENCE_EVIDENCE_EXHAUSTED` | terminate |
| `REFERENCE_MISSING` | terminate |
| `NO_VIABLE_DIRECTION` | terminate |
| `DIRECTION_CHOICE_REQUIRED` | fallback |
| `NO_PROGRESS` | terminate |

## Next

| When | Operator |
| --- | --- |
| the direction is decided; every direction resolves its presentation values before any source is written | `frontend.presentation.resolve` |
| a family component the direction needs is unpublished, so a person publishes it and the same direction runs again | `frontend.direction.decide` |
