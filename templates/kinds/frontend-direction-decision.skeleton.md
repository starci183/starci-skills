# frontend-direction-decision — direction-id

## Decision

| Field | Value |
| --- | --- |
| Direction id | `direction-id` |
| Target | `/route/or/target-id` |
| Intent | `modify` |
| Change level | `reconstruct` |
| Owner ceiling | `surface-and-nested-layouts` |
| Classification | `dominant` |
| Selection policy | `automatic` |
| Selected candidate | `candidate-id` |

## Observed

| Item | Evidence |
| --- | --- |
| what the target does today | `app/route/page.tsx:1-40@0f1e2d3` |

## UI contract

| Element | Kind | Responsibility |
| --- | --- | --- |
| `region-id` | region | what this region answers for the actor |
| choose a plan | action | what the actor does and how the surface answers |
| pending | state | what the surface says while the action settles |
| narrow | responsive | what the layout does below the breakpoint |

## Coverage

| Concern | Enumerated |
| --- | --- |
| Actions | every action with its pointer route, keyboard route and settled pending paths |
| Regions | every region with one idiom and one published composition |
| States | every meaning with its own carrier |
| Responsive | every branch with one owner |

## References

| Source | URL | Limitation |
| --- | --- | --- |
| what the reference showed | https://example.com/pattern | what it does not settle; no rows when the person supplied references or the change level is refine |

## Images

| Slot | Why | Claim | File |
| --- | --- | --- | --- |
| hero | the region reads empty without a subject | the one claim of the promise the image encodes | `response/artifacts/images/hero.png` |

## Falsification

| Attack | Candidate | Verdict | Evidence |
| --- | --- | --- | --- |
| content stress | `candidate-id` | holds | the widest plan name still fits the decision bar |

## Why not the others

| Candidate | Rejected because |
| --- | --- |
| `other-candidate-id` | which attack it failed; no rows when one candidate was formed |

## Fallbacks taken

| Code | Action |
| --- | --- |
| `CODE` | what the fallback did; no rows when none was taken |
