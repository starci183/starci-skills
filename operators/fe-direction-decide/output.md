# Output of `fe.direction.decide`

The operator returns one closed envelope with `outcome` equal to `decided` or `blocked`. It never emits
a handoff or free-form routing instruction.

## Decided receipt

A decided receipt contains:

- exact project, source, target, intent, change level, owner-ceiling, business, backend, architecture,
  Grammar, context, input, and progress bindings;
- one direction classification: `locked-refine`, `approved-reuse`, `dominant`, or
  `selected-alternative`;
- an implementation-ready UI contract covering purpose, actors, regions, actions, states, responsive
  transformation, accessibility, content, media, Grammar, preservation, changes, and implementation
  constraints;
- inspectable visual artifacts when generation or comparison applies;
- add/change/remove and contradiction findings;
- exact evidence and artifact references.

The receipt authorizes downstream implementation to apply the direction inside the frozen owner
ceiling. It does not prove that implementation exists or passes visual, quality, or UAT gates.

## Blocked receipt

A blocked receipt has no decision. It contains one typed failure, the exact missing or contradictory
references, the owning domain, retryability, and—only when retryable—a single-use resume token with the
required material delta.

`DIRECTION_CHOICE_REQUIRED` additionally contains exactly three or four rendered alternatives. It is a
completed operator result, not an internal wait. The caller obtains one exact product-authority choice
and invokes this same operator with the correlated resume payload.

## Failure codes

| Code | Owning issue | Valid material delta |
| --- | --- | --- |
| `INVALID_INPUT` | Closed input contract failed. | Corrected input. |
| `ROUTE_UNVERIFIED` | Project or checkout identity is not verified. | Verified route binding. |
| `SOURCE_DRIFT` | Observed source no longer matches the frozen head. | Refreshed source evidence and scope check. |
| `SCOPE_UNFROZEN` | Target, inclusion, exclusion, or boundary is incomplete. | Frozen scope. |
| `CHANGE_LEVEL_AMBIGUOUS` | `new`, `reconstruct`, and `refine` authority is unresolved. | Exact change-level authority. |
| `OWNER_CEILING_INVALID` | Owner sets overlap or required owner is excluded. | Corrected owner authority. |
| `BUSINESS_REQUIRED` | Actor, promise, permission, adverse outcome, or recovery truth is unresolved. | Accepted business receipt. |
| `BACKEND_REQUIRED` | UI depends on unapproved API, state, auth, persistence, or failure behavior. | Accepted backend receipt. |
| `ARCHITECTURE_REQUIRED` | UI depends on an unresolved system or data boundary. | Accepted architecture receipt. |
| `GRAMMAR_REQUIRED` | A required reusable interface is unpublished. | Published exact Grammar package. |
| `EVIDENCE_MISSING` | A material claim cannot be observed or falsified. | Exact new evidence. |
| `REFERENCE_EVIDENCE_EXHAUSTED` | Bounded research cannot support the decision. | Owning authority or materially new evidence. |
| `NO_VIABLE_DIRECTION` | Every candidate contradicts authority or fails a mandatory attack. | Changed authority/constraints, not cosmetic variants. |
| `DIRECTION_CHOICE_REQUIRED` | Three/four valid material directions remain without a dominant choice. | One exact candidate selection with product authority. |
| `NO_PROGRESS` | Resume adds no effective delta. | Materially new authority, evidence, source, Grammar, or selection. |

## Cross-field invariants

- `outcome="decided"` requires `receipt.status="decided"`, non-null `decision`, null `failure`, null
  `resume`, no error finding, and at least one evidence reference.
- `outcome="blocked"` requires `receipt.status="blocked"`, null `decision`, and non-null `failure`.
- Retryable failures require non-null `resume`; non-retryable failures require null `resume`.
- `DIRECTION_CHOICE_REQUIRED` requires exactly three/four alternatives; each has unique identity,
  fingerprint, visual references, material difference, and trade-offs. Resume candidate IDs equal the
  alternative IDs.
- `locked-refine` binds `changeLevel="refine"` and preserves the locked structural invariants.
- `approved-reuse` binds the exact approved direction triple from input.
- `dominant` has generated decision artifacts and no alternatives.
- `selected-alternative` retains all alternatives and selects one of their IDs without regenerating.
- Every decision visual reference is registered in `output.artifactRefs`; every receipt evidence
  reference is registered in `output.evidenceRefs`.
- `handoff` is always `null`.

## Practical outcomes

Create page A: `intent=create`, `changeLevel=new`, and default `dominant` mode produce one realistic,
reversible direction receipt if business, backend, and Grammar authority are complete.

Modify page B: `intent=modify`, `changeLevel=reconstruct`, and authorized `compare` mode produce a
blocked choice receipt with three/four rendered alternatives; a correlated selection resume produces
`selected-alternative` without source mutation.

