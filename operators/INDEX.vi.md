# Các operator

Sinh bởi `scripts/generate-operators-index.mjs` từ mọi `operator.json`, bảng Trình tự của mọi `execute.md` và mọi `output.schema.json`; `--check` chạy trong `npm test`, nên bảng này không thể lệch với các gói. Ref tĩnh có trước phiên; ref động (`@dynamic/<file>`) do một bước trước đó trong cùng phiên sinh ra và biến mất cùng phiên. 14 operators.

## Mỗi operator cần gì và tạo ra gì

| Operator | Profile | Đọc (tĩnh) | Đọc (động, trong phiên) | Ghi | Số bước | Mã dừng |
| --- | --- | --- | --- | --- | --- | --- |
| `architecture.decide` | `sol-fresh` | `@knowledge/patterns`, `@workspaces/be`, `@worktrees/businesses/<featureId>` | `kind:architecture-decision` | `kind:alternatives`, `kind:architecture-decision`, `kind:current-state`, `kind:independent-critique`, `kind:stack-model` | 10 | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `EVIDENCE_MISSING`, `CURRENT_STATE_UNOBSERVED`, `BUSINESS_AUTHORITY_REQUIRED`, `CONSTRAINT_CONTRADICTION`, `NO_VIABLE_ALTERNATIVE`, `CHOICE_REQUIRED`, `COMPATIBILITY_UNVERIFIED`, `DATA_OWNERSHIP_UNASSIGNED`, `CRITIQUE_UNRESOLVED` |
| `backend.source.apply` | `opus` | `@knowledge/patterns/be`, `@workspaces/be`, `@worktrees/businesses/<featureId>` | `kind:architecture-decision`, `kind:backend-source-application` | `kind:backend-source-application`, `kind:changes`, `kind:conformance`, `kind:mutations`, `kind:proof` | 8 | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `CONTRACT_UNFROZEN`, `CONTRACT_WIDENED`, `BUSINESS_AUTHORITY_MISSING`, `OWNER_CONFLICT`, `PATTERN_UNBOUND`, `PROOF_UNAVAILABLE` |
| `business.decide` | `sol-fresh` | `@workspaces/be`, `@worktrees/businesses/<featureId>`, `@worktrees/businesses/<featureId>:` | `kind:architecture-decision`, `kind:backend-source-application` | `kind:business-promise-authority`, `kind:claims`, `kind:coverage-matrix`, `kind:model` | 9 | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `EVIDENCE_MISSING`, `CONTRADICTION_UNRESOLVED`, `LIFECYCLE_TRANSITION_INVALID`, `AUTHORITY_CONFLICT`, `APPROVAL_REQUIRED`, `COVERAGE_INCOMPLETE`, `CONSUMER_UNPROVEN`, `RECONCILIATION_DISCREPANCY` |
| `content.generate` | `luna` | `@remote/minio/<contentId>/<locale>`, `@worktrees/sessions/central-runtime` | `kind:content-generation-receipt` | `kind:article`, `kind:content-brief`, `kind:content-generation-receipt`, `kind:content-review`, `kind:e2e`, `kind:image`, `kind:image-prompt`, `kind:track` | 9 | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `BRIEF_UNBOUND`, `OUTCOME_UNCOVERED`, `IMAGE_UNAVAILABLE`, `CODE_BUILD_FAILED`, `E2E_FAILED`, `CONTRACT_WEAKENED`, `REVIEW_REVISION_REQUIRED`, `REVIEW_ROUNDS_EXHAUSTED` |
| `frontend.direction.decide` | `sol-fresh` | `@grammar/core`, `@knowledge/grammars/starci`, `@knowledge/ui/composition`, `@workspaces/fe`, `@worktrees/uat/<flow>/<case>` | `kind:architecture-decision`, `kind:backend-source-application`, `kind:business-promise-authority`, `kind:frontend-direction-decision` | `kind:candidates`, `kind:frontend-direction-decision`, `kind:ui-coverage` | 12 | `INVALID_INPUT`, `ROUTE_UNVERIFIED`, `SOURCE_DRIFT`, `SCOPE_UNFROZEN`, `CHANGE_LEVEL_AMBIGUOUS`, `OWNER_CEILING_INVALID`, `BUSINESS_REQUIRED`, `BACKEND_REQUIRED`, `ARCHITECTURE_REQUIRED`, `GRAMMAR_REQUIRED`, `EVIDENCE_MISSING`, `REFERENCE_EVIDENCE_EXHAUSTED`, `NO_VIABLE_DIRECTION`, `DIRECTION_CHOICE_REQUIRED`, `NO_PROGRESS` |
| `frontend.presentation.resolve` | `sonnet` | `@grammar/core`, `@knowledge/ui/presentation`, `@workspaces/fe` | `kind:frontend-direction-decision`, `kind:frontend-surface-audit` | `kind:frontend-presentation-resolution`, `kind:inventory`, `kind:resolved-tree` | 9 | `INVALID_INPUT`, `SOURCE_DRIFT`, `OWNER_CONFLICT`, `KNOWLEDGE_UNBOUND`, `UNKNOWN_RULE`, `RULE_MISSING`, `GRAMMAR_UNPUBLISHED`, `NO_PROGRESS` |
| `frontend.source.apply` | `opus` | `@workspaces/fe` | `kind:frontend-direction-decision`, `kind:frontend-presentation-resolution` | `kind:changes`, `kind:frontend-source-application`, `kind:writes` | 7 | `INVALID_INPUT`, `SOURCE_DRIFT`, `OWNER_CONFLICT`, `RESOLUTION_STALE`, `WRITE_REJECTED`, `NO_PROGRESS` |
| `frontend.surface.audit` | `sol-reviewer` | `@knowledge/grammars/starci`, `@knowledge/ui/proof`, `@workspaces/fe`, `@worktrees/sessions/central-runtime` | `kind:frontend-direction-decision`, `kind:frontend-presentation-resolution`, `kind:frontend-source-application` | `kind:capture`, `kind:frontend-surface-audit`, `kind:screenshot`, `kind:verdicts` | 6 | `INVALID_INPUT`, `SOURCE_DRIFT`, `RUNTIME_UNAVAILABLE`, `EVIDENCE_MISSING`, `UNKNOWN_RULE`, `NO_PROGRESS` |
| `git.publish` | `sonnet` | `@remote/git/<project>/<role>`, `@workspaces/<project>/<role>/husky:`, `@workspaces/local/routes/<project>/<role>` | `kind:changes`, `kind:quality-verification`, `kind:workspace-route-binding` | `kind:git-publication` | 9 | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `ROUTE_UNVERIFIED`, `APPROVAL_MISSING`, `BRANCH_POLICY_VIOLATION`, `DIRTY_OUTSIDE_BOUNDARY`, `HOOK_BLOCKED`, `NON_FAST_FORWARD` |
| `platform.operate` | `opus` | `@workspaces/device-state`, `@workspaces/ports/<project>`, `@workspaces/projects/<project>/<role>`, `@worktrees/sessions/central-runtime` | — | `kind:checks`, `kind:delta`, `kind:platform-operation-receipt` | 8 | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `AUTHORITY_DRIFT`, `CAPABILITY_MISSING`, `INVENTORY_DRIFT`, `PORT_CONFLICT`, `EFFECT_UNAUTHORIZED`, `SERVICE_UNAVAILABLE`, `PROOF_FAILED` |
| `quality.verify` | `sonnet` | `@workspaces/<project>/<role>/gates`, `@workspaces/be`, `@workspaces/fe`, `@worktrees/debts` | `kind:backend-source-application`, `kind:changes`, `kind:frontend-source-application` | `kind:coverage`, `kind:gate-result`, `kind:quality-verification` | 7 | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `PREDECESSOR_MIXED`, `PREDECESSOR_STALE`, `GATE_UNAVAILABLE`, `DEBT_UNAPPROVED` |
| `release.deploy` | `opus` | `@remote/ghcr/<image>`, `@remote/github-actions/<runId>`, `@workspaces/device-state` | `kind:quality-verification` | `kind:probes`, `kind:release-deployment` | 10 | `INVALID_INPUT`, `NO_PROGRESS`, `AUTHORIZATION_MISSING`, `MANIFEST_INVALID`, `APPROVAL_REQUIRED`, `CREDENTIAL_UNAVAILABLE`, `HOST_UNAVAILABLE`, `ARTIFACT_MISSING`, `MIGRATION_BLOCKED`, `DOMAIN_UNRECONCILED`, `ROLLOUT_FAILED`, `RECOVERY_EXHAUSTED`, `CONCURRENT_DRIFT`, `ROLLBACK_IDENTITY_MISSING`, `STEADY_STATE_UNPROVEN` |
| `uat.verify` | `sol-reviewer` | `@workspaces/be`, `@workspaces/device-state`, `@worktrees/_templates`, `@worktrees/sessions/central-runtime`, `@worktrees/uat/<flow>/<case>` | `kind:frontend-surface-audit`, `kind:quality-verification` | `kind:screenshot`, `kind:sheet`, `kind:uat-capture`, `kind:uat-flow-verification`, `kind:uat-snapshot`, `kind:uat-verdicts` | 10 | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `ADMISSION_MISSING`, `PROVISIONING_UNAVAILABLE`, `LEASE_INVALID`, `RUNTIME_UNAVAILABLE`, `EVIDENCE_UNAVAILABLE`, `FIXTURE_VIOLATION`, `CANONICAL_WRITE_DENIED` |
| `workspace.bind` | `sonnet` | `@workspaces/device-state`, `@workspaces/local/routes/<project>/<role>`, `@workspaces/ports/<project>`, `@workspaces/projects/<project>/<role>`, `@worktrees/sessions/central-runtime` | — | `kind:route`, `kind:workspace-route-binding` | 6 | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `IDENTITY_UNVERIFIED`, `ROUTE_UNDECLARED`, `ROUTE_UNHYDRATED`, `ROUTE_MISMATCH`, `BRANCH_POLICY_VIOLATION`, `CHECKOUT_DIRTY`, `ENDPOINT_AUTHORITY_STALE`, `RUNTIME_NOT_READY` |

## Bàn giao trong một phiên

Mọi file chỉ tồn tại trong phiên, ai ghi nó, ai đọc nó kế tiếp. File không có người tiêu thụ là receipt giữ cho audit; file không có người sinh là lỗi mà bước kiểm sẽ báo.

| File động | Do bước nào sinh | Bước nào tiêu thụ |
| --- | --- | --- |
| `@dynamic/alternatives.json` | `architecture.decide` | — |
| `@dynamic/architecture-decision.json` | `architecture.decide` | — |
| `@dynamic/article.json` | `content.generate` | — |
| `@dynamic/backend-source-application.json` | `backend.source.apply` | — |
| `@dynamic/business-promise-authority.json` | `business.decide` | — |
| `@dynamic/candidates.json` | `frontend.direction.decide` | — |
| `@dynamic/capture.json` | `frontend.surface.audit` | — |
| `@dynamic/changes.json` | `backend.source.apply`, `frontend.source.apply` | — |
| `@dynamic/checks.json` | `platform.operate` | — |
| `@dynamic/claims.json` | `business.decide` | — |
| `@dynamic/conformance.json` | `backend.source.apply` | — |
| `@dynamic/content-brief.json` | `content.generate` | — |
| `@dynamic/content-generation-receipt.json` | `content.generate` | — |
| `@dynamic/content-review.json` | `content.generate` | — |
| `@dynamic/coverage-matrix.json` | `business.decide` | — |
| `@dynamic/coverage.json` | `quality.verify` | — |
| `@dynamic/current-state.json` | `architecture.decide` | — |
| `@dynamic/delta.json` | `platform.operate` | — |
| `@dynamic/e2e.json` | `content.generate` | — |
| `@dynamic/frontend-direction-decision.json` | `frontend.direction.decide` | — |
| `@dynamic/frontend-presentation-resolution.json` | `frontend.presentation.resolve` | — |
| `@dynamic/frontend-source-application.json` | `frontend.source.apply` | — |
| `@dynamic/frontend-surface-audit.json` | `frontend.surface.audit` | — |
| `@dynamic/gate-result.json` | `quality.verify` | — |
| `@dynamic/git-publication.json` | `git.publish` | — |
| `@dynamic/image-prompt.json` | `content.generate` | — |
| `@dynamic/image.json` | `content.generate` | — |
| `@dynamic/independent-critique.json` | `architecture.decide` | — |
| `@dynamic/inventory.json` | `frontend.presentation.resolve` | — |
| `@dynamic/model.json` | `business.decide` | — |
| `@dynamic/mutations.json` | `backend.source.apply` | — |
| `@dynamic/platform-operation-receipt.json` | `platform.operate` | — |
| `@dynamic/probes.json` | `release.deploy` | — |
| `@dynamic/proof.json` | `backend.source.apply` | — |
| `@dynamic/quality-verification.json` | `quality.verify` | — |
| `@dynamic/release-deployment.json` | `release.deploy` | — |
| `@dynamic/resolved-tree.json` | `frontend.presentation.resolve` | — |
| `@dynamic/route.json` | `workspace.bind` | — |
| `@dynamic/screenshot.json` | `frontend.surface.audit`, `uat.verify` | — |
| `@dynamic/sheet.json` | `uat.verify` | — |
| `@dynamic/stack-model.json` | `architecture.decide` | — |
| `@dynamic/track.json` | `content.generate` | — |
| `@dynamic/uat-capture.json` | `uat.verify` | — |
| `@dynamic/uat-flow-verification.json` | `uat.verify` | — |
| `@dynamic/uat-snapshot.json` | `uat.verify` | — |
| `@dynamic/uat-verdicts.json` | `uat.verify` | — |
| `@dynamic/ui-coverage.json` | `frontend.direction.decide` | — |
| `@dynamic/verdicts.json` | `frontend.surface.audit` | — |
| `@dynamic/workspace-route-binding.json` | `workspace.bind` | — |
| `@dynamic/writes.json` | `frontend.source.apply` | — |
| `kind:architecture-decision` | `architecture.decide` | `backend.source.apply`, `business.decide`, `frontend.direction.decide` |
| `kind:backend-source-application` | `backend.source.apply` | `business.decide`, `frontend.direction.decide`, `quality.verify` |
| `kind:business-promise-authority` | `business.decide` | `frontend.direction.decide` |
| `kind:changes` | `backend.source.apply`, `frontend.source.apply` | `git.publish`, `quality.verify` |
| `kind:frontend-direction-decision` | `frontend.direction.decide` | `frontend.presentation.resolve`, `frontend.source.apply`, `frontend.surface.audit` |
| `kind:frontend-presentation-resolution` | `frontend.presentation.resolve` | `frontend.source.apply`, `frontend.surface.audit` |
| `kind:frontend-source-application` | `frontend.source.apply` | `frontend.surface.audit`, `quality.verify` |
| `kind:frontend-surface-audit` | `frontend.surface.audit` | `frontend.presentation.resolve`, `uat.verify` |
| `kind:quality-verification` | `quality.verify` | `git.publish`, `release.deploy`, `uat.verify` |
| `kind:workspace-route-binding` | `workspace.bind` | `git.publish` |

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
