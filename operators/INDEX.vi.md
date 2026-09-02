# Các operator

Sinh bởi `scripts/generate-operators-index.mjs` từ mọi `operator.json`, bảng Trình tự của mọi `execute.md` và mọi `output.schema.json`; `--check` chạy trong `npm test`, nên bảng này không thể lệch với các gói. Ref tĩnh có trước phiên; ref động (`@dynamic/<file>`) do một bước trước đó trong cùng phiên sinh ra và biến mất cùng phiên. 14 operators.

## Mỗi operator cần gì và tạo ra gì

| Operator | Profile | Đọc (tĩnh) | Đọc (động, trong phiên) | Ghi | Số bước | Mã dừng |
| --- | --- | --- | --- | --- | --- | --- |
| `architecture.decide` | `sol-fresh` | `@knowledge/patterns`, `@workspaces/be`, `@worktrees/businesses/<featureId>` | `kind:architecture-decision` | `kind:alternatives`, `kind:architecture-decision`, `kind:current-state`, `kind:independent-critique`, `kind:stack-model` | 10 | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `EVIDENCE_MISSING`, `CURRENT_STATE_UNOBSERVED`, `BUSINESS_AUTHORITY_REQUIRED`, `CONSTRAINT_CONTRADICTION`, `NO_VIABLE_ALTERNATIVE`, `CHOICE_REQUIRED`, `COMPATIBILITY_UNVERIFIED`, `DATA_OWNERSHIP_UNASSIGNED`, `CRITIQUE_UNRESOLVED` |
| `backend.implement` | `opus` | `@knowledge/patterns/be`, `@worktrees/businesses/<featureId>` | `@dynamic/architecture-decision.json` | `@dynamic/backend-implementation.json`, `@dynamic/changes.md`, `@dynamic/conformance/<operationId>.<facet>.json`, `@dynamic/proofs/<operationId>.<kind>.json`, `@workspaces/be` | 8 | `INVALID_INPUT`, `SOURCE_DRIFT`, `CONTRACT_UNFROZEN`, `CONTRACT_WIDENED`, `BUSINESS_AUTHORITY_MISSING`, `OWNER_CONFLICT`, `PATTERN_UNBOUND`, `PROOF_UNAVAILABLE`, `NO_PROGRESS` |
| `business.decide` | `sol-fresh` | `@workspaces/be` | `@dynamic/architecture-decision.json` | `@dynamic/business-promise-authority.json`, `@dynamic/coverage-matrix.json`, `@worktrees/businesses/<featureId>` | 9 | `INVALID_INPUT`, `SOURCE_DRIFT`, `EVIDENCE_MISSING`, `CONTRADICTION_UNRESOLVED`, `COVERAGE_INCOMPLETE`, `CONSUMER_UNPROVEN`, `LIFECYCLE_TRANSITION_INVALID`, `AUTHORITY_CONFLICT`, `RECONCILIATION_DISCREPANCY`, `APPROVAL_REQUIRED`, `NO_PROGRESS` |
| `content.generate` | `luna` | `@remote/minio/<contentId>/<locale>`, `@worktrees/sessions/central-runtime` | — | `@dynamic/<briefTargetRef>`, `@dynamic/<imageTargetRef>`, `@dynamic/<language>.articleRef`, `@dynamic/<reviewTargetRef>`, `@dynamic/<track>.sourceRef`, `@dynamic/content-generation-receipt.json` | 9 | `INVALID_INPUT`, `SOURCE_DRIFT`, `BRIEF_UNBOUND`, `OUTCOME_UNCOVERED`, `CODE_BUILD_FAILED`, `E2E_FAILED`, `CONTRACT_WEAKENED`, `IMAGE_UNAVAILABLE`, `REVIEW_REVISION_REQUIRED`, `REVIEW_ROUNDS_EXHAUSTED`, `NO_PROGRESS` |
| `fe.direction.decide` | `sol-fresh` | `@grammar/core`, `@knowledge/grammars/starci`, `@knowledge/ui/composition`, `@workspaces/fe`, `@worktrees/uat/<flow>/<case>` | `@dynamic/architecture-decision.json`, `@dynamic/backend-implementation.json`, `@dynamic/business-promise-authority.json` | `@dynamic/<candidateId>.html`, `@dynamic/fe-direction-decision.json` | 11 | `INVALID_INPUT`, `ROUTE_UNVERIFIED`, `SOURCE_DRIFT`, `SCOPE_UNFROZEN`, `CHANGE_LEVEL_AMBIGUOUS`, `OWNER_CEILING_INVALID`, `BUSINESS_REQUIRED`, `BACKEND_REQUIRED`, `ARCHITECTURE_REQUIRED`, `GRAMMAR_REQUIRED`, `EVIDENCE_MISSING`, `REFERENCE_EVIDENCE_EXHAUSTED`, `NO_VIABLE_DIRECTION`, `DIRECTION_CHOICE_REQUIRED`, `NO_PROGRESS` |
| `fe.presentation.resolve` | `sonnet` | `@grammar/core`, `@knowledge/ui/presentation`, `@workspaces/fe` | `@dynamic/fe-direction-decision.json`, `@dynamic/fe-surface-audit.json` | `@dynamic/<target>.resolved.tsx`, `@dynamic/fe-presentation-resolution.json` | 9 | `INVALID_INPUT`, `SOURCE_DRIFT`, `OWNER_CONFLICT`, `KNOWLEDGE_UNBOUND`, `UNKNOWN_RULE`, `RULE_MISSING`, `GRAMMAR_UNPUBLISHED`, `NO_PROGRESS` |
| `fe.source.apply` | `opus` | — | `@dynamic/fe-direction-decision.json`, `@dynamic/fe-presentation-resolution.json` | `@dynamic/changes.md`, `@dynamic/fe-source-application.json`, `@workspaces/fe` | 9 | `INVALID_INPUT`, `SOURCE_DRIFT`, `OWNER_CONFLICT`, `RESOLUTION_STALE`, `WRITE_REJECTED`, `NO_PROGRESS` |
| `fe.surface.audit` | `sol-reviewer` | `@knowledge/grammars/starci`, `@knowledge/ui/proof`, `@workspaces/fe`, `@worktrees/sessions/central-runtime` | `@dynamic/fe-source-application.json` | `@dynamic/<matrixId>.capture.json`, `@dynamic/fe-surface-audit.json` | 8 | `INVALID_INPUT`, `SOURCE_DRIFT`, `RUNTIME_UNAVAILABLE`, `EVIDENCE_MISSING`, `UNKNOWN_RULE`, `NO_PROGRESS` |
| `git.publish` | `sonnet` | `@workspaces/<project>/<role>/husky`, `@workspaces/local/routes/<project>/<role>` | `@dynamic/workspace-route-binding.json` | `@dynamic/git-publication.json`, `@remote/git/<project>/<role>` | 8 | `INVALID_INPUT`, `ROUTE_UNVERIFIED`, `APPROVAL_MISSING`, `BRANCH_POLICY_VIOLATION`, `DIRTY_OUTSIDE_BOUNDARY`, `HOOK_BLOCKED`, `NON_FAST_FORWARD`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| `platform.operate` | `opus` | `@workspaces/device-state`, `@workspaces/ports/<project>`, `@workspaces/projects/<project>/<role>` | — | `@dynamic/platform-operation-receipt.json`, `@worktrees/sessions/central-runtime` | 8 | `INVALID_INPUT`, `SOURCE_DRIFT`, `AUTHORITY_DRIFT`, `INVENTORY_DRIFT`, `CAPABILITY_MISSING`, `PORT_CONFLICT`, `EFFECT_UNAUTHORIZED`, `SERVICE_UNAVAILABLE`, `PROOF_FAILED`, `NO_PROGRESS` |
| `quality.verify` | `sonnet` | `@workspaces/<project>/<role>/gates`, `@workspaces/be`, `@workspaces/fe`, `@worktrees/debts` | `@dynamic/<receiptType>.json` | `@dynamic/gates/<gate>.json`, `@dynamic/gates/unit-coverage.coverage.json`, `@dynamic/quality-verification.json` | 8 | `INVALID_INPUT`, `SOURCE_DRIFT`, `PREDECESSOR_MIXED`, `PREDECESSOR_STALE`, `GATE_UNAVAILABLE`, `DEBT_UNAPPROVED`, `NO_PROGRESS` |
| `release.deploy` | `opus` | `@remote/ghcr/<image>`, `@remote/github-actions/<runId>`, `@workspaces/device-state` | `@dynamic/quality-verification.json` | `@dynamic/release-deployment.json` | 10 | `INVALID_INPUT`, `AUTHORIZATION_MISSING`, `MANIFEST_INVALID`, `ARTIFACT_MISSING`, `CREDENTIAL_UNAVAILABLE`, `HOST_UNAVAILABLE`, `MIGRATION_BLOCKED`, `DOMAIN_UNRECONCILED`, `ROLLOUT_FAILED`, `STEADY_STATE_UNPROVEN`, `CONCURRENT_DRIFT`, `RECOVERY_EXHAUSTED`, `ROLLBACK_IDENTITY_MISSING`, `APPROVAL_REQUIRED`, `NO_PROGRESS` |
| `uat.verify` | `sol-reviewer` | `@workspaces/be`, `@worktrees/_templates`, `@worktrees/sessions/central-runtime` | — | `@dynamic/uat-flow-verification.json`, `@worktrees/uat/<flow>/<case>` | 10 | `INVALID_INPUT`, `SOURCE_DRIFT`, `ADMISSION_MISSING`, `PROVISIONING_UNAVAILABLE`, `LEASE_INVALID`, `RUNTIME_UNAVAILABLE`, `EVIDENCE_UNAVAILABLE`, `FIXTURE_VIOLATION`, `CANONICAL_WRITE_DENIED`, `NO_PROGRESS` |
| `workspace.bind` | `sonnet` | `@workspaces/device-state`, `@workspaces/local/routes/<project>/<role>`, `@workspaces/ports/<project>`, `@workspaces/projects/<project>/<role>`, `@worktrees/sessions/central-runtime` | — | `@dynamic/workspace-route-binding.json` | 8 | `INVALID_INPUT`, `ROUTE_UNDECLARED`, `ROUTE_UNHYDRATED`, `ROUTE_MISMATCH`, `IDENTITY_UNVERIFIED`, `BRANCH_POLICY_VIOLATION`, `CHECKOUT_DIRTY`, `SOURCE_DRIFT`, `ENDPOINT_AUTHORITY_STALE`, `RUNTIME_NOT_READY`, `NO_PROGRESS` |

## Bàn giao trong một phiên

Mọi file chỉ tồn tại trong phiên, ai ghi nó, ai đọc nó kế tiếp. File không có người tiêu thụ là receipt giữ cho audit; file không có người sinh là lỗi mà bước kiểm sẽ báo.

| File động | Do bước nào sinh | Bước nào tiêu thụ |
| --- | --- | --- |
| `@dynamic/<matrixId>.capture.json` | `fe.surface.audit` | — |
| `@dynamic/<receiptType>.json` | — | `quality.verify` |
| `@dynamic/alternatives.json` | `architecture.decide` | — |
| `@dynamic/architecture-decision.json` | `architecture.decide` | `backend.implement`, `business.decide`, `fe.direction.decide` |
| `@dynamic/backend-implementation.json` | `backend.implement` | `fe.direction.decide` |
| `@dynamic/business-promise-authority.json` | `business.decide` | `fe.direction.decide` |
| `@dynamic/conformance/<operationId>.<facet>.json` | `backend.implement` | — |
| `@dynamic/content-generation-receipt.json` | `content.generate` | — |
| `@dynamic/coverage-matrix.json` | `business.decide` | — |
| `@dynamic/current-state.json` | `architecture.decide` | — |
| `@dynamic/fe-direction-decision.json` | `fe.direction.decide` | `fe.presentation.resolve`, `fe.source.apply` |
| `@dynamic/fe-presentation-resolution.json` | `fe.presentation.resolve` | `fe.source.apply` |
| `@dynamic/fe-source-application.json` | `fe.source.apply` | `fe.surface.audit` |
| `@dynamic/fe-surface-audit.json` | `fe.surface.audit` | `fe.presentation.resolve` |
| `@dynamic/gates/<gate>.json` | `quality.verify` | — |
| `@dynamic/gates/unit-coverage.coverage.json` | `quality.verify` | — |
| `@dynamic/git-publication.json` | `git.publish` | — |
| `@dynamic/independent-critique.json` | `architecture.decide` | — |
| `@dynamic/platform-operation-receipt.json` | `platform.operate` | — |
| `@dynamic/proofs/<operationId>.<kind>.json` | `backend.implement` | — |
| `@dynamic/quality-verification.json` | `quality.verify` | `release.deploy` |
| `@dynamic/release-deployment.json` | `release.deploy` | — |
| `@dynamic/stack-model.json` | `architecture.decide` | — |
| `@dynamic/uat-flow-verification.json` | `uat.verify` | — |
| `@dynamic/workspace-route-binding.json` | `workspace.bind` | `git.publish` |

## Việc duy nhất

| Operator | Việc duy nhất |
| --- | --- |
| `architecture.decide` | Decide one architecture with its tech stack, system boundaries, and data ownership, and prove it against the observed current state, the rejected alternatives, verified compatibility, and an independent critique. |
| `backend.implement` | Implement one backend outcome inside a frozen mutation contract, following the observed sibling family, and return the measured conformance and proof receipt that shows the boundary was not widened. |
| `business.decide` | Decide and publish one evidence-backed business promise as durable backend-owned authority, frozen behind a complete promise-to-enforcement coverage matrix. |
| `content.generate` | Generate or refactor one educational content unit in one linear pass: a teacher brief that constrains everything after it, one written edition per declared language, images made to a stated claim, code and executable checks that actually run, and an independent critique that receives the artifact without the producer's rationale. |
| `fe.direction.decide` | Decide one evidence-backed, implementation-ready frontend direction for one authorized target. |
| `fe.presentation.resolve` | Resolve every application-owned presentation property on one already-composed tree to exactly one published rule, emit its class and verifiable contract claim, and stop at the smallest owning gap instead of inventing a value. |
| `fe.source.apply` | Write one already-resolved tree into product source inside a frozen owner ceiling and a declared file set, emitting only values the bound resolution receipt already contains. |
| `fe.surface.audit` | Observe one rendered surface across a declared viewport and state matrix, measure every presentation value it actually produces, compare each measurement against the contract claim on that node, and return findings drawn only from the bound rule inventory. |
| `git.publish` | Publish one approved Git boundary from exact mission-owned source heads with non-force, fast-forward-only semantics, and stop with a typed failure rather than reaching for a bypass. |
| `platform.operate` | Operate one bounded shared observability, Sonar, or tunnel service from exact evidence: inventory it, converge only the approved delta, prove every check the bound knowledge requires, and stop at the smallest owning gap instead of taking product deployment ownership. |
| `quality.verify` | Verify one bounded delivery by running its declared static gates against an unchanged upstream fingerprint and return the exact measured receipt, repairing nothing. |
| `release.deploy` | Deploy one immutable release to one declared target under its declared authorization and prove the steady state it reached, taking the recovery or rollback branch inside the same pass rather than assuming the rollout succeeded. |
| `uat.verify` | Verify one product-decision flow against inputs frozen before execution and publish its canonical backend-owned snapshot and result pair, or stop at the exact unavailability instead of manufacturing a verdict. |
| `workspace.bind` | Resolve one project and role into a verified checkout identity, its exact source head, and the closed runtime binding it may consume, and return that as one typed route receipt. |
