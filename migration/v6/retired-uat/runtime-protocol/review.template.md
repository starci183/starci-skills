---
schema_version: 2
feature: <feature-id>
flow: <flow-id>
review_ref: .worktrees/uat/reviews/<feature>/<flow>/review.md
source_revision: <git-commit>
authority_revision: <authority-hash>
status: DRAFT
---

# UAT Review — <feature>/<flow>

## 1. Review identity

| Field | Value |
| --- | --- |
| Objective | <observable user outcome> |
| Entry condition | <user-recognizable entry> |
| Success terminal | <business-visible terminal> |
| Safe non-success terminals | <none or exact authority> |
| Runtime | <FE/BE revisions, browser build, locale, theme> |
| Review owner | <one coordinator> |

## 2. Flow graph and coverage

Flow identity:

| Dimension | This flow | Why a sibling flow is or is not required |
| --- | --- | --- |
| Actor / recognizable entry | <actor + entry> | <identity decision> |
| Business outcome / terminal | <outcome + terminal> | <identity decision> |
| Semantic owner / side-effect boundary | <owner + boundary> | <identity decision> |
| Recovery topology | <recovery shape + irreversible/exclusive edges> | <identity decision> |

```text
<state> --<action/system event>--> <state>
```

| Transition / risk | Lower-level proof | UAT case | Reason selected or delegated |
| --- | --- | --- | --- |
| <transition> | <receipt or none> | <case-id> | <coverage reason> |

Coverage budget:

| Selected cases | Delegated permutations | Uncovered transitions | Target | Overflow reason |
| --- | --- | --- | --- | --- |
| <count> | <count> | 0 before ready | 1–5 representative cases | <none or distinct signature/risk per excess case> |

Coverage is complete when each product-level decision branch is executed by one representative UAT case or delegated to an exact lower-level proof. Component-local loading, empty, error, validation, route, viewport, copy, field, and data permutations stay inside the happy case or lower-level proof unless they change product outcome, auth/permission, durable state, integration, user recovery, or refresh/resume continuity.

## 3. Happy and unhappy case matrix

| Case ID | Class | Start | Semantic owner | Side effect | Recovery | Terminal | Fault scope | Resource class | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `<flow>.happy` | happy | <state> | product | <effect> | n/a | success | none | partitioned | planned |

The happy case is separate. For every merged unhappy row, list the covered examples and prove all six merge-signature fields are equal; otherwise split the case. Prefer one to five representative cases total. More than five requires a distinct signature or high-risk transition for every excess case; equivalent component permutations must merge or delegate.

## 4. Resource and fixture plan

| Order | Case ID | Run ID | Declaration receipt | Constraint preflight | Precondition | Expected outcome | Agent | Account provisioning | Account | Browser session / lease | Browser profiles | Origin | Fixture namespace | Locks | Cleanup selector |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | <case-id> | <run-id> | <published-before-execute ref> | <store-constraint receipt> | <initial state> | <observable terminal> | <agent-id> | fresh/none | <new case+run identity or none> | <session-ref + lease-ref> | <profile refs> | <host> | <namespace> | <safe/partitioned/exclusive refs> | `is_uat=true + <case-id> + <run-id>` |

Lifecycle: `constraint preflight → prepare → product execute → read-only verify → scoped cleanup`. Preparation may seed run-namespaced related records needed for a meaningful render, but it finishes before Browser execution and cannot create the outcome under test. Publish case/run, account or anonymous identity, fixture, precondition, expected outcome, Browser session and order first; then execute one case at a time on the visible Browser. A rerun provisions a new account and never reuses an earlier run identity. Record an explicit prohibition on post-journey UPSERT/finalization.

## 5. Case execution results

| Case ID | Run ID | Behavior | UX | UI principles | Grammar | UI aggregate | Recovery complete | Terminal proved | Result ref |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <case-id> | <run-id> | PASS/FAIL/REQUIRE_USER_ACTION/BLOCKED | PASS/FAIL/REQUIRE_USER_ACTION/BLOCKED | PASS/FAIL/SUSPENSE/BLOCKED | PASS/FAIL/SUSPENSE/BLOCKED | PASS/FAIL/SUSPENSE/REQUIRE_USER_ACTION/BLOCKED | yes/no/n-a | yes/no | `runs/<run-id>/result.json` |

## 6. Screenshot checkpoints

| Case ID | Checkpoint | Viewport | Scale mode / percent | State | Assertion proved | Full screenshot | Supporting runtime evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| <case-id> | entry/commit/feedback/recovery/terminal | <width>x<height> | native/browser-zoom/text-only/viewport + <%> | <state-id> | <one observable assertion> | `runs/<run-id>/screenshots/<file>.png` | <DOM/a11y/trace ref> |

Every checkpoint uses a full viewport. Optional crops live in `regions/` and never replace the full screenshot. Capture each materially different responsive branch, not every pixel width or keystroke.

## 7. Findings and root-cause index

| Finding ID | Lens | Severity | Case occurrences | Root-cause key | Owner | Repair boundary | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| <id> | Behavior/UX/UI | hard/soft | <case ids> | <authority+owner+mechanism+action+boundary> | <capability> | <exact boundary> | open/fixed/retested |

One writer owns each root cause. Do not deduplicate merely because screenshots or messages look alike.

## 8. User feedback

| Feedback ID | Command | Exact observation / decision | Finding or question | Authority promotion | Status |
| --- | --- | --- | --- | --- | --- |
| <id> | `USER APPROVE UAT ...` / `USER CORRECT UAT ...` / `USER ANSWER SUSPENSE ...` | <text> | <id> | <none or exact knowledge/Grammar ref> | open/resolved |

## 9. SUSPENSE register

| Question ID | Exact situation | Authorities checked | Finite render question | Owner | User decision | Fresh rerun |
| --- | --- | --- | --- | --- | --- | --- |
| <id> | <surface/state/viewport> | `fe.ui` + Common + <Grammar> | <A or B?> | <authority owner> | pending | pending |

Only UI may use `SUSPENSE`. Behavior/UX uncertainty is `BLOCKED` or a finding. Final acceptance requires zero open SUSPENSE.

## 10. REQUIRE_USER_ACTION register

| Action ID | Case / run | Why automation must pause | Control channel / ref | Exact user action | Completion evidence | Resume command | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| <id> | <case-id>/<run-id> | <bounded reason> | browser/device/external + <session/ref> | <exact action> | <observable return evidence> | `USER ACTION COMPLETE <action-id>` | pending/completed |

`REQUIRE_USER_ACTION` is not PASS, FAIL, BLOCKED, or SUSPENSE. A browser action temporarily hands the same leased session to the user and then resumes the same in-progress case-run; append evidence without rewriting earlier checkpoints. If that session cannot be resumed, abandon it and create a fresh run with a fresh account.

## 11. Retest and final acceptance

| Root cause / feedback | Discovering checkpoint | Recovery path | All occurrences | Happy smoke | Fresh run | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| <id> | <checkpoint> | <case path> | <refs> | <run> | <run-id> | PASS/FAIL |

Final gate:

- the flow remains distinct by actor/entry, outcome/terminal, semantic owner/side effect, or recovery topology rather than by presentation variants alone;
- all selected transitions have executed evidence or an exact lower-level delegation receipt;
- every recoverable unhappy case reaches success after recovery;
- Behavior, UX, and UI pass for every required case;
- no open hard finding, feedback correction, or SUSPENSE remains;
- no pending REQUIRE_USER_ACTION remains;
- result verification is read-only and fixtures were cleaned by exact case namespace;
- user records `USER APPROVE UAT <review-hash>` for this source and authority revision.
