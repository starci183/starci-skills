# Các operator

Sinh bởi `scripts/generate-operators-index.mjs` từ mọi `operator.md`; `--check` chạy trong `npm test`, nên bảng này không thể lệch với các gói. Alias trong Context có trước phiên; kind được sinh trong một nhánh (`step-N/parallel-M/response/`) và bàn giao cho nhánh sau bằng đường dẫn tường minh trong `request.json` của nhánh đó. 14 operator.

## Mỗi operator cần gì và tạo ra gì

| Operator | Profile | Context | Đầu vào (kind) | Đầu ra (kind) | Số bước | Mã dừng |
| --- | --- | --- | --- | --- | --- | --- |
| `architecture.decide` | `sol-fresh` | `@knowledge/patterns`, `@workspaces/be`, `@worktrees/businesses/<featureId>` | `architecture-decision` | `architecture-decision`, `current-state`, `stack-model`, `alternatives`, `independent-critique` | 10 | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `EVIDENCE_MISSING`, `CURRENT_STATE_UNOBSERVED`, `BUSINESS_AUTHORITY_REQUIRED`, `CONSTRAINT_CONTRADICTION`, `NO_VIABLE_ALTERNATIVE`, `CHOICE_REQUIRED`, `COMPATIBILITY_UNVERIFIED`, `DATA_OWNERSHIP_UNASSIGNED`, `CRITIQUE_UNRESOLVED` |
| `backend.source.apply` | `opus` | `@knowledge/patterns/be`, `@workspaces/be`, `@worktrees/businesses/<featureId>` | `architecture-decision`, `backend-source-application` | `backend-source-application`, `changes`, `mutations`, `conformance`, `proof` | 8 | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `CONTRACT_UNFROZEN`, `CONTRACT_WIDENED`, `BUSINESS_AUTHORITY_MISSING`, `OWNER_CONFLICT`, `PATTERN_UNBOUND`, `PROOF_UNAVAILABLE` |
| `business.decide` | `sol-fresh` | `@workspaces/be`, `@worktrees/businesses/<featureId>` | `architecture-decision`, `backend-source-application` | `business-promise-authority`, `claims`, `coverage-matrix`, `model` | 9 | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `EVIDENCE_MISSING`, `CONTRADICTION_UNRESOLVED`, `LIFECYCLE_TRANSITION_INVALID`, `AUTHORITY_CONFLICT`, `APPROVAL_REQUIRED`, `COVERAGE_INCOMPLETE`, `CONSUMER_UNPROVEN`, `RECONCILIATION_DISCREPANCY` |
| `content.generate` | `luna` | `@remote/minio/<contentId>/<locale>`, `@worktrees/sessions/central-runtime` | `content-generation-receipt` | `content-generation-receipt`, `content-brief`, `e2e`, `content-review`, `article`, `image`, `image-prompt`, `track` | 9 | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `BRIEF_UNBOUND`, `OUTCOME_UNCOVERED`, `IMAGE_UNAVAILABLE`, `CODE_BUILD_FAILED`, `E2E_FAILED`, `CONTRACT_WEAKENED`, `REVIEW_REVISION_REQUIRED`, `REVIEW_ROUNDS_EXHAUSTED` |
| `frontend.direction.decide` | `sol-fresh` | `@grammar/core`, `@knowledge/grammars/starci`, `@knowledge/ui/composition`, `@workspaces/fe`, `@worktrees/uat/<flow>/<case>` | `business-promise-authority`, `backend-source-application`, `architecture-decision`, `frontend-direction-decision` | `frontend-direction-decision`, `ui-coverage`, `candidates` | 12 | `INVALID_INPUT`, `ROUTE_UNVERIFIED`, `SOURCE_DRIFT`, `SCOPE_UNFROZEN`, `CHANGE_LEVEL_AMBIGUOUS`, `OWNER_CEILING_INVALID`, `BUSINESS_REQUIRED`, `BACKEND_REQUIRED`, `ARCHITECTURE_REQUIRED`, `GRAMMAR_REQUIRED`, `EVIDENCE_MISSING`, `REFERENCE_EVIDENCE_EXHAUSTED`, `NO_VIABLE_DIRECTION`, `DIRECTION_CHOICE_REQUIRED`, `NO_PROGRESS` |
| `frontend.presentation.resolve` | `sonnet` | `@grammar/core`, `@knowledge/ui/presentation`, `@workspaces/fe` | `frontend-direction-decision`, `frontend-surface-audit` | `frontend-presentation-resolution`, `inventory`, `resolved-tree` | 9 | `INVALID_INPUT`, `SOURCE_DRIFT`, `OWNER_CONFLICT`, `KNOWLEDGE_UNBOUND`, `UNKNOWN_RULE`, `RULE_MISSING`, `GRAMMAR_UNPUBLISHED`, `NO_PROGRESS` |
| `frontend.source.apply` | `opus` | `@workspaces/fe` | `frontend-presentation-resolution`, `frontend-direction-decision` | `frontend-source-application`, `changes`, `writes` | 7 | `INVALID_INPUT`, `SOURCE_DRIFT`, `OWNER_CONFLICT`, `RESOLUTION_STALE`, `WRITE_REJECTED`, `NO_PROGRESS` |
| `frontend.surface.audit` | `sol-reviewer` | `@knowledge/grammars/starci`, `@knowledge/ui/proof`, `@workspaces/fe`, `@worktrees/sessions/central-runtime` | `frontend-source-application`, `frontend-presentation-resolution`, `frontend-direction-decision` | `frontend-surface-audit`, `capture`, `screenshot`, `verdicts` | 6 | `INVALID_INPUT`, `SOURCE_DRIFT`, `RUNTIME_UNAVAILABLE`, `EVIDENCE_MISSING`, `UNKNOWN_RULE`, `NO_PROGRESS` |
| `git.publish` | `sonnet` | `@remote/git/<project>/<role>`, `@workspaces/<project>/<role>/husky`, `@workspaces/local/routes/<project>/<role>` | `workspace-route-binding`, `changes`, `quality-verification` | `git-publication` | 9 | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `ROUTE_UNVERIFIED`, `APPROVAL_MISSING`, `BRANCH_POLICY_VIOLATION`, `DIRTY_OUTSIDE_BOUNDARY`, `HOOK_BLOCKED`, `NON_FAST_FORWARD` |
| `platform.operate` | `opus` | `@workspaces/device-state`, `@workspaces/ports/<project>`, `@workspaces/projects/<project>/<role>`, `@worktrees/sessions/central-runtime` | — | `platform-operation-receipt`, `delta`, `checks` | 8 | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `AUTHORITY_DRIFT`, `CAPABILITY_MISSING`, `INVENTORY_DRIFT`, `PORT_CONFLICT`, `EFFECT_UNAUTHORIZED`, `SERVICE_UNAVAILABLE`, `PROOF_FAILED` |
| `quality.verify` | `sonnet` | `@workspaces/<project>/<role>/gates`, `@workspaces/be`, `@workspaces/fe`, `@worktrees/debts` | `backend-source-application`, `frontend-source-application`, `changes` | `quality-verification`, `gate-result`, `coverage` | 7 | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `PREDECESSOR_MIXED`, `PREDECESSOR_STALE`, `GATE_UNAVAILABLE`, `DEBT_UNAPPROVED` |
| `release.deploy` | `opus` | `@remote/ghcr/<image>`, `@remote/github-actions/<runId>`, `@workspaces/device-state` | `quality-verification` | `release-deployment`, `probes` | 10 | `INVALID_INPUT`, `NO_PROGRESS`, `AUTHORIZATION_MISSING`, `MANIFEST_INVALID`, `APPROVAL_REQUIRED`, `CREDENTIAL_UNAVAILABLE`, `HOST_UNAVAILABLE`, `ARTIFACT_MISSING`, `MIGRATION_BLOCKED`, `DOMAIN_UNRECONCILED`, `ROLLOUT_FAILED`, `RECOVERY_EXHAUSTED`, `CONCURRENT_DRIFT`, `ROLLBACK_IDENTITY_MISSING`, `STEADY_STATE_UNPROVEN` |
| `uat.verify` | `sol-reviewer` | `@workspaces/be`, `@workspaces/device-state`, `@worktrees/_templates`, `@worktrees/sessions/central-runtime`, `@worktrees/uat/<flow>/<case>` | `frontend-surface-audit`, `quality-verification` | `uat-flow-verification`, `uat-snapshot`, `uat-capture`, `uat-verdicts`, `screenshot`, `sheet` | 10 | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `ADMISSION_MISSING`, `PROVISIONING_UNAVAILABLE`, `LEASE_INVALID`, `RUNTIME_UNAVAILABLE`, `EVIDENCE_UNAVAILABLE`, `FIXTURE_VIOLATION`, `CANONICAL_WRITE_DENIED` |
| `workspace.bind` | `sonnet` | `@workspaces/device-state`, `@workspaces/local/routes/<project>/<role>`, `@workspaces/ports/<project>`, `@workspaces/projects/<project>/<role>`, `@worktrees/sessions/central-runtime` | — | `workspace-route-binding`, `route` | 6 | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `IDENTITY_UNVERIFIED`, `ROUTE_UNDECLARED`, `ROUTE_UNHYDRATED`, `ROUTE_MISMATCH`, `BRANCH_POLICY_VIOLATION`, `CHECKOUT_DIRTY`, `ENDPOINT_AUTHORITY_STALE`, `RUNTIME_NOT_READY` |

## Bàn giao giữa các nhánh

Mọi kind đi qua giữa các operator, ai ghi nó, ai đọc nó. Kind không có người tiêu thụ là giữ cho audit hoặc cho người; kind không có người sinh là lỗi mà bước kiểm sẽ báo.

| Kind | Do ai sinh | Ai tiêu thụ |
| --- | --- | --- |
| `alternatives` | `architecture.decide` | — |
| `architecture-decision` | `architecture.decide` | `architecture.decide (optional)`, `backend.source.apply`, `business.decide (optional)`, `frontend.direction.decide (optional)` |
| `article` | `content.generate` | — |
| `backend-source-application` | `backend.source.apply` | `backend.source.apply (optional)`, `business.decide (optional)`, `frontend.direction.decide (optional)`, `quality.verify (optional)` |
| `business-promise-authority` | `business.decide` | `frontend.direction.decide (optional)` |
| `candidates` | `frontend.direction.decide` | — |
| `capture` | `frontend.surface.audit` | — |
| `changes` | `backend.source.apply`, `frontend.source.apply` | `git.publish`, `quality.verify (optional)` |
| `checks` | `platform.operate` | — |
| `claims` | `business.decide` | — |
| `conformance` | `backend.source.apply` | — |
| `content-brief` | `content.generate` | — |
| `content-generation-receipt` | `content.generate` | `content.generate (optional)` |
| `content-review` | `content.generate` | — |
| `coverage` | `quality.verify` | — |
| `coverage-matrix` | `business.decide` | — |
| `current-state` | `architecture.decide` | — |
| `delta` | `platform.operate` | — |
| `e2e` | `content.generate` | — |
| `frontend-direction-decision` | `frontend.direction.decide` | `frontend.direction.decide (optional)`, `frontend.presentation.resolve`, `frontend.source.apply`, `frontend.surface.audit` |
| `frontend-presentation-resolution` | `frontend.presentation.resolve` | `frontend.source.apply`, `frontend.surface.audit` |
| `frontend-source-application` | `frontend.source.apply` | `frontend.surface.audit`, `quality.verify (optional)` |
| `frontend-surface-audit` | `frontend.surface.audit` | `frontend.presentation.resolve (optional)`, `uat.verify` |
| `gate-result` | `quality.verify` | — |
| `git-publication` | `git.publish` | — |
| `image` | `content.generate` | — |
| `image-prompt` | `content.generate` | — |
| `independent-critique` | `architecture.decide` | — |
| `inventory` | `frontend.presentation.resolve` | — |
| `model` | `business.decide` | — |
| `mutations` | `backend.source.apply` | — |
| `platform-operation-receipt` | `platform.operate` | — |
| `probes` | `release.deploy` | — |
| `proof` | `backend.source.apply` | — |
| `quality-verification` | `quality.verify` | `git.publish`, `release.deploy`, `uat.verify` |
| `release-deployment` | `release.deploy` | — |
| `resolved-tree` | `frontend.presentation.resolve` | — |
| `route` | `workspace.bind` | — |
| `screenshot` | `frontend.surface.audit`, `uat.verify` | — |
| `sheet` | `uat.verify` | — |
| `stack-model` | `architecture.decide` | — |
| `track` | `content.generate` | — |
| `uat-capture` | `uat.verify` | — |
| `uat-flow-verification` | `uat.verify` | — |
| `uat-snapshot` | `uat.verify` | — |
| `uat-verdicts` | `uat.verify` | — |
| `ui-coverage` | `frontend.direction.decide` | — |
| `verdicts` | `frontend.surface.audit` | — |
| `workspace-route-binding` | `workspace.bind` | `git.publish` |
| `writes` | `frontend.source.apply` | — |

## Việc duy nhất

| Operator | Việc duy nhất |
| --- | --- |
| `architecture.decide` | Decide one architecture with its tech stack, system boundaries, and data ownership, and prove it against the observed current state, the rejected alternatives, verified compatibility, and an independent critique. |
| `backend.source.apply` | Implement one backend outcome inside a frozen mutation contract, following the observed sibling family, and return the measured conformance and proof receipt that shows the boundary was not widened. |
| `business.decide` | Decide and publish one evidence-backed business promise as durable backend-owned authority, frozen behind a complete promise-to-enforcement coverage matrix, or reconcile that published head against the source that was actually delivered. |
| `content.generate` | Generate or refactor one educational content unit in one linear pass: a teacher brief that constrains everything after it, one written edition per declared language, images made to a stated claim, code and executable checks that actually run, and an independent review that receives the artifacts without the producer's rationale. |
| `frontend.direction.decide` | Decide one evidence-backed, implementation-ready frontend direction for one authorized target, and prove it against the business promise, the published Grammar, the observed implementation and a falsification pass that no candidate survives by taste. |
| `frontend.presentation.resolve` | Resolve every application-owned presentation property on one already-composed tree to exactly one published rule, emit its class and its verifiable contract claim, and stop at the smallest owning gap instead of inventing a value. |
| `frontend.source.apply` | Write one already-resolved tree into product source on the session branch, inside a frozen owner ceiling and a declared file set, emitting only values the bound resolution already contains, and account for every byte that entered the repository in one commit. |
| `frontend.surface.audit` | Observe the committed surface at the served route across the matrix the direction's coverage implies, measure every node that carries a claim, and judge each measurement against the published proof rules by the owner of the node it stands on. |
| `git.publish` | Publish one approved Git boundary from the exact commit quality verified, with non-force, fast-forward-only semantics, and stop with a typed failure rather than reaching for a bypass. |
| `platform.operate` | Operate one bounded shared observability, Sonar, or tunnel service from exact evidence: inventory it, converge only the approved delta, prove every check the bound knowledge requires, and stop at the smallest owning gap instead of taking product deployment ownership. |
| `quality.verify` | Verify one bounded delivery by running its declared gates against an unchanged predecessor receipt at one frozen head, and return the exact measured verdict, repairing nothing. |
| `release.deploy` | Deploy one immutable release to one declared target under its declared authorization and prove the steady state it reached, taking the recovery or rollback branch inside the same pass rather than assuming the rollout succeeded. |
| `uat.verify` | Verify one product flow end to end on the running product at the pinned commit, and publish one append-only run record with three independently judged lanes, or stop at the exact unavailability instead of manufacturing a verdict. |
| `workspace.bind` | Resolve one project and role into a verified checkout identity, its exact source head, and the closed runtime binding it may consume, and return that as one typed route receipt. |
