---
schema_version: 2
feature: <feature-id>
feature_ref: .worktrees/uat/reviews/<feature>/INDEX.md
source_revision: <git-commit>
authority_revision: <authority-hash>
status: DRAFT
---

# UAT Feature Index — <feature>

## 1. Feature identity and outcome

| Field | Value |
| --- | --- |
| Objective | <business-visible feature outcome> |
| Actors and entries | <closed actor/entry set> |
| Source / authority revisions | <immutable refs> |
| Coordinator | <one aggregation owner> |

## 2. Minimal-sufficient flow inventory

| Flow | Why it is distinct | Happy | Unhappy representatives | Delegated permutations | Open findings | SUSPENSE | User actions | Latest runs | User feedback status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `<flow-id>` | <changed actor/entry, outcome/terminal, semantic owner/side effect, or recovery topology> | `<case-id>` | <count> | <count + proof refs> | <refs/none> | <refs/none> | <refs/none> | <refs> | pending/approved |

Do not create a flow for a route, viewport, copy variant, field, validation message, or data permutation alone. Each listed flow must differ on at least one declared identity dimension. Every omitted transition or permutation must have an exact lower-level proof receipt.

## 3. Shared fixtures, resources, and sequential order

| Ref | Kind | Namespace / lock | Consumers | Sequential rule |
| --- | --- | --- | --- | --- |
| <ref> | fixture/resource | <exact scope> | <flow/case ids> | safe/partitioned/exclusive |

Shared definitions may be referenced by flows, but each executed case still owns its predeclared account or anonymous identity, browser context, origin, mutable fixture namespace, artifact directory, and declared locks. Cases execute one at a time on the visible Browser.

## 4. Feature coverage rollup

| Measure | Count | Evidence |
| --- | --- | --- |
| Distinct flows | <count> | <flow refs> |
| Selected representative cases | <count> | <case refs> |
| Delegated permutations | <count> | <lower-level receipts> |
| Uncovered transitions | 0 | <coverage audit refs> |

## 5. Root-cause, feedback, and SUSPENSE rollup

| ID | Type | Affected flows/cases | One owner | Status | Evidence / decision |
| --- | --- | --- | --- | --- | --- |
| <id> | root cause/user correction/UI SUSPENSE | <refs> | <owner> | open/resolved | <refs> |

## 6. Feature acceptance

- every flow is distinct by the four-dimension identity rule;
- every transition/risk is executed or exactly delegated and uncovered count is zero;
- every required case has Behavior, UX, and UI verdicts plus recovery/terminal proof;
- no open hard finding, correction, or SUSPENSE remains;
- no pending REQUIRE_USER_ACTION remains;
- all flow reviews bind the same source and authority revisions;
- user records `USER APPROVE UAT <feature-review-hash>`.
