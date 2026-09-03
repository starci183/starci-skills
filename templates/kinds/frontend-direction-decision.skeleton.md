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

## Surface class

| Class | Why |
| --- | --- |
| `console` | one name from the vocabulary `COVERAGE-1` Case 7 publishes, and what about this surface puts it in that class; the coverage carries the same name and every banded proof rule reads its threshold from it |

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

| Standard | Class | URL | What is borrowed | Limitation |
| --- | --- | --- | --- | --- |
| the standard this surface is aiming at, named | `console-grid` | https://example.com/pattern | the composition decision taken from it, never a brand, a palette or a component anatomy | what it does not settle; at least one row under new or reconstruct, none under refine |

## Images

| Slot | Why | Claim | File |
| --- | --- | --- | --- |
| hero | the region reads empty without a subject | the one claim of the promise the image encodes | `response/artifacts/images/hero.png` |

## Falsification

| Attack | Candidate | Verdict | Evidence |
| --- | --- | --- | --- |
| content stress | `candidate-id` | holds | the widest plan name still fits the decision bar |

## Scores

| Candidate | Viewport | Criterion | Score | Verdict |
| --- | --- | --- | --- | --- |
| `candidate-id` | wide | `TASTE-1` | 4 | pass |
| `other-candidate-id` | wide | `TASTE-1` | 3 | pass |

## Why not the others

| Candidate | Rejected because |
| --- | --- |
| `other-candidate-id` | which attack it failed, or the scores it lost on; no rows when one candidate was formed |

## Printed

| Artifact | Why |
| --- | --- |
| http://127.0.0.1:60000/candidate-id.html?viewport=wide | the candidate at the wide viewport, put in front of the person before the decision was written |
| http://127.0.0.1:60000/candidate-id.html?viewport=narrow | the same candidate at the narrow viewport; every candidate is printed at every viewport the coverage names |

## Fallbacks taken

| Code | Action |
| --- | --- |
| `CODE` | what the fallback did; no rows when none was taken |
