# Các operator

Sinh bởi `scripts/generate-operators-index.mjs` từ mọi `operator.md`; `--check` chạy trong `npm test`, nên bảng này không thể lệch với các gói. Alias trong Context có trước phiên; kind được sinh trong một nhánh (`step-N/parallel-M/response/`) và bàn giao cho nhánh sau bằng đường dẫn tường minh trong `request.json` của nhánh đó. 16 operator.

## Mỗi operator cần gì và tạo ra gì

| Operator | Profile | Context | Đầu vào (kind) | Đầu ra (kind) | Số bước | Mã dừng |
| --- | --- | --- | --- | --- | --- | --- |
| `architecture.decide` | `sol-fresh` | `@knowledge/patterns`, `@workspaces/be`, `@worktrees/businesses/<featureId>` | `architecture-decision`, `model` | `architecture-decision`, `current-state`, `stack-model`, `alternatives`, `independent-critique` | 10 | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `EVIDENCE_MISSING`, `CURRENT_STATE_UNOBSERVED`, `BUSINESS_AUTHORITY_REQUIRED`, `CONSTRAINT_CONTRADICTION`, `NO_VIABLE_ALTERNATIVE`, `CHOICE_REQUIRED`, `COMPATIBILITY_UNVERIFIED`, `DATA_OWNERSHIP_UNASSIGNED`, `CRITIQUE_UNRESOLVED` |
| `backend.source.apply` | `luna` | `@knowledge/patterns/be`, `@workspaces/be`, `@worktrees/businesses/<featureId>` | `architecture-decision`, `model`, `backend-source-application` | `backend-source-application`, `changes`, `mutations`, `conformance`, `proof` | 8 | `INVALID_INPUT`, `SESSION_MISSING`, `SOURCE_DRIFT`, `NO_PROGRESS`, `CONTRACT_UNFROZEN`, `CONTRACT_WIDENED`, `BUSINESS_AUTHORITY_MISSING`, `OWNER_CONFLICT`, `PATTERN_UNBOUND`, `PROOF_UNAVAILABLE` |
| `business.decide` | `sol-fresh` | `@workspaces/be`, `@worktrees/businesses/<featureId>` | `architecture-decision`, `backend-source-application` | `business-promise-authority`, `claims`, `coverage-matrix`, `model` | 9 | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `EVIDENCE_MISSING`, `CONTRADICTION_UNRESOLVED`, `LIFECYCLE_TRANSITION_INVALID`, `AUTHORITY_CONFLICT`, `APPROVAL_REQUIRED`, `COVERAGE_INCOMPLETE`, `CONSUMER_UNPROVEN`, `RECONCILIATION_DISCREPANCY` |
| `content.generate` | `luna` | `@remote/minio/<contentId>/<locale>`, `@worktrees/sessions/central-runtime` | `content-generation-receipt` | `content-generation-receipt`, `content-brief`, `e2e`, `content-review`, `article`, `image`, `image-prompt`, `track` | 9 | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `BRIEF_UNBOUND`, `OUTCOME_UNCOVERED`, `IMAGE_UNAVAILABLE`, `CODE_BUILD_FAILED`, `E2E_FAILED`, `CONTRACT_WEAKENED`, `REVIEW_REVISION_REQUIRED`, `REVIEW_ROUNDS_EXHAUSTED` |
| `dependency.update` | `luna` | `@workspaces/fe` | `route` | `dependency-update`, `dependency-proof`, `dependency-log`, `changes` | 5 | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `DEPENDENCY_BOUNDARY_REJECTED`, `DEPENDENCY_PROOF_FAILED` |
| `frontend.direction.decide` | `sol-fresh` | `@grammar/core`, `@knowledge/grammars/<family>`, `@knowledge/ui/composition`, `@knowledge/ui/proof`, `@workspaces/fe`, `@worktrees/uat/<flow>/<case>` | `business-promise-authority`, `backend-source-application`, `architecture-decision`, `frontend-direction-decision` | `frontend-direction-decision`, `ui-coverage`, `candidates`, `direction-image`, `host` | 12 | `INVALID_INPUT`, `ROUTE_UNVERIFIED`, `SOURCE_DRIFT`, `SCOPE_UNFROZEN`, `CHANGE_LEVEL_AMBIGUOUS`, `OWNER_CEILING_INVALID`, `BUSINESS_REQUIRED`, `BACKEND_REQUIRED`, `ARCHITECTURE_REQUIRED`, `GRAMMAR_REQUIRED`, `EVIDENCE_MISSING`, `REFERENCE_EVIDENCE_EXHAUSTED`, `REFERENCE_MISSING`, `NO_VIABLE_DIRECTION`, `DIRECTION_CHOICE_REQUIRED`, `NO_PROGRESS` |
| `frontend.presentation.resolve` | `luna` | `@grammar/core`, `@knowledge/ui/presentation`, `@workspaces/fe` | `frontend-direction-decision`, `frontend-surface-audit` | `frontend-presentation-resolution`, `inventory`, `resolved-tree` | 9 | `INVALID_INPUT`, `SOURCE_DRIFT`, `OWNER_CONFLICT`, `KNOWLEDGE_UNBOUND`, `UNKNOWN_RULE`, `RULE_MISSING`, `GRAMMAR_UNPUBLISHED`, `NO_PROGRESS` |
| `frontend.source.apply` | `luna` | `@workspaces/fe` | `frontend-presentation-resolution`, `frontend-direction-decision` | `frontend-source-application`, `changes`, `writes` | 7 | `INVALID_INPUT`, `SESSION_MISSING`, `SOURCE_DRIFT`, `OWNER_CONFLICT`, `RESOLUTION_STALE`, `WRITE_REJECTED`, `NO_PROGRESS` |
| `frontend.surface.audit` | `sol-reviewer` | `@knowledge/grammars/<family>`, `@knowledge/ui/proof`, `@workspaces/fe`, `@worktrees/sessions/central-runtime` | `frontend-source-application`, `frontend-presentation-resolution`, `frontend-direction-decision`, `route`, `uat-account` | `frontend-surface-audit`, `capture`, `screenshot`, `verdicts`, `host` | 6 | `INVALID_INPUT`, `SOURCE_DRIFT`, `RUNTIME_UNAVAILABLE`, `IDENTITY_MISSING`, `EVIDENCE_MISSING`, `UNKNOWN_RULE`, `SURFACE_CLASS_MISSING`, `NO_PROGRESS` |
| `git.publish` | `luna` | `@remote/git/<project>/<role>`, `@workspaces/<project>/<role>/husky`, `@workspaces/local/routes/<project>/<role>` | `workspace-route-binding`, `changes`, `quality-verification` | `git-publication` | 9 | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `ROUTE_UNVERIFIED`, `SESSION_MISSING`, `APPROVAL_MISSING`, `BRANCH_POLICY_VIOLATION`, `DIRTY_OUTSIDE_BOUNDARY`, `HOOK_BLOCKED`, `NON_FAST_FORWARD` |
| `library.source.apply` | `luna` | `@workspaces/fe` | `route` | `library-source-application`, `library-proof`, `changes` | 5 | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `LIBRARY_BOUNDARY_REJECTED`, `LIBRARY_PROOF_FAILED` |
| `platform.operate` | `luna` | `@workspaces/device-state`, `@workspaces/ports/<project>`, `@workspaces/projects/<project>/<role>`, `@worktrees/_templates`, `@worktrees/sessions/central-runtime`, `@worktrees/uat/<flow>` | — | `platform-operation-receipt`, `delta`, `checks`, `uat-account`, `changes` | 10 | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `AUTHORITY_DRIFT`, `CAPABILITY_MISSING`, `INVENTORY_DRIFT`, `PORT_CONFLICT`, `EFFECT_UNAUTHORIZED`, `SERVICE_UNAVAILABLE`, `PROVISIONING_UNAVAILABLE`, `INTEGRATION_FAILED`, `PROOF_FAILED` |
| `quality.verify` | `luna` | `@workspaces/<project>/<role>/gates`, `@workspaces/be`, `@workspaces/fe`, `@worktrees/debts` | `backend-source-application`, `frontend-source-application`, `changes`, `frontend-surface-audit`, `uat-flow-verification` | `quality-verification`, `gate-result`, `coverage`, `audit-scope` | 8 | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `PREDECESSOR_MIXED`, `PREDECESSOR_STALE`, `GATE_UNAVAILABLE`, `DEBT_UNAPPROVED` |
| `release.deploy` | `luna` | `@remote/ghcr/<image>`, `@remote/github-actions/<runId>`, `@workspaces/device-state` | `quality-verification` | `release-deployment`, `probes` | 10 | `INVALID_INPUT`, `NO_PROGRESS`, `AUTHORIZATION_MISSING`, `MANIFEST_INVALID`, `APPROVAL_REQUIRED`, `CREDENTIAL_UNAVAILABLE`, `HOST_UNAVAILABLE`, `ARTIFACT_MISSING`, `MIGRATION_BLOCKED`, `DOMAIN_UNRECONCILED`, `ROLLOUT_FAILED`, `RECOVERY_EXHAUSTED`, `CONCURRENT_DRIFT`, `ROLLBACK_IDENTITY_MISSING`, `STEADY_STATE_UNPROVEN` |
| `uat.verify` | `sol-fresh` | `@knowledge/ui/proof`, `@workspaces/be`, `@workspaces/device-state`, `@workspaces/fe`, `@worktrees/_templates`, `@worktrees/sessions/central-runtime`, `@worktrees/uat/<flow>/<case>` | `frontend-surface-audit`, `quality-verification`, `route`, `uat-account` | `uat-flow-verification`, `uat-snapshot`, `uat-capture`, `uat-verdicts`, `audit-scope`, `screenshot`, `sheet` | 10 | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `AUTHORITY_DRIFT`, `ADMISSION_MISSING`, `PROVISIONING_UNAVAILABLE`, `IDENTITY_MISSING`, `LEASE_INVALID`, `RUNTIME_UNAVAILABLE`, `EVIDENCE_UNAVAILABLE`, `FIXTURE_VIOLATION`, `CANONICAL_WRITE_DENIED` |
| `workspace.bind` | `luna` | `@workspaces/device-state`, `@workspaces/local/routes/<project>/<role>`, `@workspaces/ports/<project>`, `@workspaces/projects/<project>/<role>`, `@worktrees/sessions/central-runtime` | — | `workspace-route-binding`, `route` | 6 | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `IDENTITY_UNVERIFIED`, `ROUTE_UNDECLARED`, `ROUTE_UNHYDRATED`, `ROUTE_MISMATCH`, `BRANCH_POLICY_VIOLATION`, `CHECKOUT_DIRTY`, `ENDPOINT_AUTHORITY_STALE`, `RUNTIME_NOT_READY`, `RUNTIME_BUSY` |

## Bàn giao giữa các nhánh

Mọi kind đi qua giữa các operator, ai ghi nó, ai đọc nó. Kind không có người tiêu thụ là giữ cho audit hoặc cho người; kind không có người sinh là lỗi mà bước kiểm sẽ báo.

| Kind | Do ai sinh | Ai tiêu thụ |
| --- | --- | --- |
| `alternatives` | `architecture.decide` | — |
| `architecture-decision` | `architecture.decide` | `architecture.decide (optional)`, `backend.source.apply`, `business.decide (optional)`, `frontend.direction.decide (optional)` |
| `article` | `content.generate` | — |
| `audit-scope` | `quality.verify`, `uat.verify` | — |
| `backend-source-application` | `backend.source.apply` | `backend.source.apply (optional)`, `business.decide (optional)`, `frontend.direction.decide (optional)`, `quality.verify (optional)` |
| `business-promise-authority` | `business.decide` | `frontend.direction.decide (optional)` |
| `candidates` | `frontend.direction.decide` | — |
| `capture` | `frontend.surface.audit` | — |
| `changes` | `backend.source.apply`, `dependency.update`, `frontend.source.apply`, `library.source.apply`, `platform.operate` | `git.publish`, `quality.verify (optional)` |
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
| `dependency-log` | `dependency.update` | — |
| `dependency-proof` | `dependency.update` | — |
| `dependency-update` | `dependency.update` | — |
| `direction-image` | `frontend.direction.decide` | — |
| `e2e` | `content.generate` | — |
| `frontend-direction-decision` | `frontend.direction.decide` | `frontend.direction.decide (optional)`, `frontend.presentation.resolve`, `frontend.source.apply`, `frontend.surface.audit` |
| `frontend-presentation-resolution` | `frontend.presentation.resolve` | `frontend.source.apply`, `frontend.surface.audit` |
| `frontend-source-application` | `frontend.source.apply` | `frontend.surface.audit`, `quality.verify (optional)` |
| `frontend-surface-audit` | `frontend.surface.audit` | `frontend.presentation.resolve (optional)`, `quality.verify (optional)`, `uat.verify` |
| `gate-result` | `quality.verify` | — |
| `git-publication` | `git.publish` | — |
| `host` | `frontend.direction.decide`, `frontend.surface.audit` | — |
| `image` | `content.generate` | — |
| `image-prompt` | `content.generate` | — |
| `independent-critique` | `architecture.decide` | — |
| `inventory` | `frontend.presentation.resolve` | — |
| `library-proof` | `library.source.apply` | — |
| `library-source-application` | `library.source.apply` | — |
| `model` | `business.decide` | `architecture.decide (optional)`, `backend.source.apply (optional)` |
| `mutations` | `backend.source.apply` | — |
| `platform-operation-receipt` | `platform.operate` | — |
| `probes` | `release.deploy` | — |
| `proof` | `backend.source.apply` | — |
| `quality-verification` | `quality.verify` | `git.publish`, `release.deploy`, `uat.verify` |
| `release-deployment` | `release.deploy` | — |
| `resolved-tree` | `frontend.presentation.resolve` | — |
| `route` | `workspace.bind` | `dependency.update`, `frontend.surface.audit`, `library.source.apply`, `uat.verify` |
| `screenshot` | `frontend.surface.audit`, `uat.verify` | — |
| `sheet` | `uat.verify` | — |
| `stack-model` | `architecture.decide` | — |
| `track` | `content.generate` | — |
| `uat-account` | `platform.operate` | `frontend.surface.audit (optional)`, `uat.verify (optional)` |
| `uat-capture` | `uat.verify` | — |
| `uat-flow-verification` | `uat.verify` | `quality.verify (optional)` |
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
| `dependency.update` | Consume one verified package release by changing only its exact dependency metadata, then prove the unchanged consumer regression and complete declared delivery gates before one session commit. |
| `frontend.direction.decide` | Decide one evidence-backed, implementation-ready frontend direction for one authorized target, and prove it against the business promise, the published Grammar, the observed implementation and a falsification pass that no candidate survives by taste. |
| `frontend.presentation.resolve` | Resolve every application-owned presentation property on one already-composed tree to exactly one published rule, emit its class and its verifiable contract claim, and stop at the smallest owning gap instead of inventing a value. |
| `frontend.source.apply` | Write one already-resolved tree into product source on the session branch, inside a frozen owner ceiling and a declared file set, emitting only values the bound resolution already contains, and account for every byte that entered the repository in one commit. |
| `frontend.surface.audit` | Observe the selected primary surfaces at the served route across their frozen audit matrix, measure every node that carries a claim, and judge each measurement against the published proof rules by the owner of the node it stands on. |
| `git.publish` | Publish one approved Git boundary from the exact commit quality verified, with non-force, fast-forward-only semantics, and stop with a typed failure rather than reaching for a bypass. |
| `library.source.apply` | Repair existing behavior inside one explicitly authorized owner package, prove its regression and package gates, and commit exactly one next-patch delivery on the bound session branch. |
| `platform.operate` | Operate one bounded shared service from exact evidence — observability, Sonar, tunnel, the runtime registry, or the identity a bound route authenticates against: inventory it, converge only the approved delta, prove every check the bound knowledge requires, and stop at the smallest owning gap instead of taking product deployment ownership. |
| `quality.verify` | Verify one bounded delivery by running its declared gates against an unchanged predecessor receipt at one frozen head, and return the exact measured verdict, repairing nothing. |
| `release.deploy` | Deploy one immutable release to one declared target under its declared authorization and prove the steady state it reached, taking the recovery or rollback branch inside the same pass rather than assuming the rollout succeeded. |
| `uat.verify` | Verify one product flow end to end on the running product at the pinned commit, and publish one append-only run record with three independently judged lanes, or stop at the exact unavailability instead of manufacturing a verdict. |
| `workspace.bind` | Resolve one project and role into a verified checkout identity, its exact source head, and the closed runtime binding it may consume, and return that as one typed route receipt. |

## Mã dừng

Mọi mã một operator có thể dừng với, gộp từ `operators/errors.json` (mã nhiều operator dùng chung, có danh sách scope) và từng `operators/<id>/errors.json`. Một mã có đúng một cách xử lý: **terminate** kết thúc nhánh ở trạng thái blocked; **fallback** làm đúng hành động đã ghi, ghi lại dưới `## Fallbacks taken` trong `response.md`, rồi chạy tiếp. `unless` gọi tên đúng một tham số Yêu cầu mà giá trị của nó đảo cách xử lý. `domain` là vùng trong `routing.json` mà mã dừng bàn giao tới; `self` là vùng của chính operator phát mã, tức chạy lại. Runtime gặp mã không có trong sổ thì dừng với `UNKNOWN_STOP`.

| Mã | Phạm vi | Vùng | Xử lý | Nghĩa | Fallback | Trừ khi | Chạy lại |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `EVIDENCE_MISSING` | `*` | `self` | terminate | Một khẳng định về hệ thống không có file, dòng hay head nào đứng sau. | — | — | Bổ sung bằng chứng. |
| `INVALID_INPUT` | `*` | `caller` | terminate | request.json không qua gate hoặc bảng Yêu cầu của operator. | — | — | Sửa request.json. |
| `NO_PROGRESS` | `*` | `caller` | terminate | Lần chạy lại không thêm bằng chứng, ràng buộc, inventory hay phê duyệt nào. | — | — | Mang một delta thật. |
| `SOURCE_DRIFT` | `*` | `workspace` | terminate | Head quan sát được của checkout khác head mà request.json đã đóng băng. | — | — | Orchestrator đóng băng head lại. |
| `UNKNOWN_STOP` | `*` | `caller` | terminate | Runtime gặp một mã mà sổ gộp không có. | — | — | Đăng ký mã hoặc sửa operator. |
| `BUSINESS_AUTHORITY_REQUIRED` | `architecture.decide` | `business` | terminate | Head nghiệp vụ đã publish mà kiến trúc phải giữ đang thiếu hoặc cũ. | — | — | Chạy business.decide trước. |
| `CHOICE_REQUIRED` | `architecture.decide` | `caller` | fallback | Nhiều phương án còn material sau khi chấm. | Chọn phương án điểm cao nhất theo tradeoffAxes; hòa thì chọn phương án đổi ít component stack nhất; ghi bảng điểm dưới ## Decision. | `selectionPolicy` = `approval-required` → terminate | Người nhập approval. |
| `COMPATIBILITY_UNVERIFIED` | `architecture.decide` | `self` | fallback | Một component stack giữ lại không có bằng chứng tương thích ở ít nhất một trục. | Đánh dấu component là replaced-candidate trong stack delta và liệt kê các trục chưa kiểm vào Handoff dạng unknown. | — | Bổ sung bằng chứng tương thích. |
| `CONSTRAINT_CONTRADICTION` | `architecture.decide` | `caller` | terminate | Hai ràng buộc fixed-intent không thể cùng đúng. | — | — | Người sửa ràng buộc. |
| `CRITIQUE_UNRESOLVED` | `architecture.decide` | `self` | terminate | Một đòn tấn công vào phương án đã chọn không có lời giải. | — | — | Giải quyết đòn tấn công hoặc chọn khác. |
| `CURRENT_STATE_UNOBSERVED` | `architecture.decide` | `workspace` | terminate | Không đọc được hiện trạng hệ thống ở head đã đóng băng. | — | — | Sửa route hoặc checkout. |
| `DATA_OWNERSHIP_UNASSIGNED` | `architecture.decide` | `self` | terminate | Một store vật lý không có boundary sở hữu. | — | — | Gán chủ sở hữu. |
| `NO_VIABLE_ALTERNATIVE` | `architecture.decide` | `caller` | terminate | Không phương án nào qua được ràng buộc, hoặc phương án duy nhất chết dưới một đòn tấn công. | — | — | Nới ràng buộc hoặc dừng. |
| `BUSINESS_AUTHORITY_MISSING` | `backend.source.apply` | `business` | terminate | Một câu hỏi nghiệp vụ còn mở và không quyết định đã duyệt nào giải nó. | — | — | Publish quyết định và ràng lại fingerprint thẩm quyền. |
| `CONTRACT_UNFROZEN` | `backend.source.apply` | `contract` | terminate | Contract mutation chưa đóng băng, hoặc fingerprint của nó đã cũ. | — | — | Mang contract đã đóng băng tới. |
| `CONTRACT_WIDENED` | `backend.source.apply` | `contract` | terminate | Không đạt được kết quả nếu không có một ranh giới mà contract không mang. | — | — | Chủ contract mở lại và đóng băng lại contract, rồi cài đặt lại cùng kết quả đó. |
| `PATTERN_UNBOUND` | `backend.source.apply` | `backend` | terminate | Một khía cạnh bị chạm không có họ anh em nào được ràng cho nó. | — | — | Ràng pattern còn thiếu; đoán họ từ trí nhớ bị từ chối. |
| `PROOF_UNAVAILABLE` | `backend.source.apply` | `platform` | terminate | Một proof đã khai không chạy được trong môi trường này. | — | — | Cung cấp môi trường chạy proof; một proof không chạy được không bao giờ thành pass. |
| `OWNER_CONFLICT` | `backend.source.apply`, `frontend.presentation.resolve`, `frontend.source.apply` | `caller` | terminate | Một node cần sửa nằm ngoài trần owner được sửa, hoặc hai tập owner chồng nhau. | — | — | Sửa thẩm quyền owner. |
| `SESSION_MISSING` | `backend.source.apply`, `frontend.source.apply`, `git.publish` | `caller` | terminate | Nguồn được thiết kế, ghi hay công bố bên ngoài một phiên: nhánh không nằm trong step-N/parallel-M dưới thư mục phiên có state.json và request.json đã hợp lệ, hoặc nhánh phiên đem công bố không có response source-application nào ở trạng thái done mà commits chứa head của nó, hoặc một chuỗi frontend có bước audit lại không có response frontend-surface-audit kèm ảnh chụp. | — | — | Tạo phiên trước — state.json và step-1/parallel-1/request/request.json, xanh dưới validate-request — rồi chạy các operator còn nợ biên nhận; một phiên không thể dựng lại sau khi việc đã xong. |
| `AUTHORITY_CONFLICT` | `business.decide` | `workspace` | terminate | Head hoặc gốc businesses mâu thuẫn với thẩm quyền đã publish. | — | — | Sửa binding thẩm quyền. |
| `CONSUMER_UNPROVEN` | `business.decide` | `business` | terminate | Một consumer thực thi đã phát hiện không có disposition hoặc không có bằng chứng. | — | — | Xử lý consumer đó kèm positive và negative proof, rồi publish lại lời hứa. |
| `CONTRADICTION_UNRESOLVED` | `business.decide` | `caller` | terminate | Hai claim về cùng một hành vi mâu thuẫn và không có gì giải quyết chúng. | — | — | Người chủ giải quyết mâu thuẫn. |
| `COVERAGE_INCOMPLETE` | `business.decide` | `business` | terminate | Một chiều phủ đã khai không mang disposition nào. | — | — | Bổ sung disposition còn thiếu. |
| `LIFECYCLE_TRANSITION_INVALID` | `business.decide` | `caller` | terminate | Trạng thái đích được yêu cầu không tới được từ head đã quan sát. | — | — | Yêu cầu một chuyển trạng thái hợp lệ, hoặc publish trạng thái trung gian trước. |
| `RECONCILIATION_DISCREPANCY` | `business.decide` | `backend` | terminate | Source đã giao khác với ma trận phủ đã đóng băng. | — | — | Sửa source, hoặc sửa lại ma trận. |
| `APPROVAL_REQUIRED` | `business.decide`, `release.deploy` | `caller` | terminate | Chuyển trạng thái hoặc release cần một phê duyệt mà request chưa ràng. | — | — | Người cấp phê duyệt. |
| `BRIEF_UNBOUND` | `content.generate` | `curriculum` | terminate | Không đóng băng được brief người dạy từ chương trình học và bằng chứng nguồn đã ràng. | — | — | Bổ sung chương trình học hoặc bằng chứng nguồn còn thiếu. |
| `CODE_BUILD_FAILED` | `content.generate` | `content` | terminate | Một track cài đặt đã khai không build được. | — | — | Sửa track đó, rồi build lại. |
| `CONTRACT_WEAKENED` | `content.generate` | `content` | terminate | Contract chạy được bị dời trong vòng lặp sửa, nên bằng chứng không đo được gì. | — | — | Khôi phục contract và chạy lại mà không đụng vào nó. |
| `E2E_FAILED` | `content.generate` | `content` | terminate | Một phép kiểm chạy được đã khai vẫn hỏng khi đã tiêu hết maxE2eIterations. | — | — | Sửa phần cài đặt, hoặc duyệt thêm số vòng. |
| `IMAGE_UNAVAILABLE` | `content.generate` | `engineering` | terminate | Không sinh được hình ảnh bắt buộc theo các tuyên bố của brief. | — | — | Cấp một bộ sinh chạy được, hoặc tắt giai đoạn hình ảnh. |
| `OUTCOME_UNCOVERED` | `content.generate` | `content` | terminate | Một bản viết đã khai bỏ trống một kết quả học tập đã công bố. | — | — | Viết lại bản đó, hoặc thu hẹp brief. |
| `REVIEW_REVISION_REQUIRED` | `content.generate` | `content` | fallback | Phản biện độc lập trả về yêu cầu sửa. | Sửa đúng những artifact mà các finding của phản biện nêu tên, theo giai đoạn chủ, ghi vòng đó dưới ## Fallbacks taken, rồi mở lại cuộc trao đổi phản biện cho vòng kế. | — | Không hỏi ai cả; nhánh tự sửa và phản biện lại cho tới khi hết maxReviewRounds. |
| `REVIEW_ROUNDS_EXHAUSTED` | `content.generate` | `caller` | terminate | Đã tiêu hết maxReviewRounds mà phản biện vẫn trả về yêu cầu sửa. | — | — | Duyệt thêm vòng, hoặc thu hẹp đơn vị. |
| `DEPENDENCY_BOUNDARY_REJECTED` | `dependency.update` | `caller` | terminate | Không chứng minh được bản phát hành, danh tính package hoặc ranh giới metadata chính xác. | — | — | Cung cấp artifact đã kiểm chứng và plan metadata đã sửa; thay đổi source vẫn thuộc owner source. |
| `DEPENDENCY_PROOF_FAILED` | `dependency.update` | `self` | terminate | Regression consumer không đổi hoặc gate bàn giao bắt buộc thiếu bằng chứng hợp lệ tại phiên bản dependency đã cài. | — | — | Sửa bản phát hành owner hoặc phần cài đặt rồi chạy lại nguyên proof consumer. |
| `ARCHITECTURE_REQUIRED` | `frontend.direction.decide` | `architecture` | terminate | Hướng làm đổi một ranh giới hệ thống hay dữ liệu chưa ai quyết. | — | — | Chạy architecture.decide trước. |
| `BACKEND_REQUIRED` | `frontend.direction.decide` | `backend` | terminate | Hướng làm đổi một contract dữ liệu chưa ai giao. | — | — | Chạy backend.source.apply trước. |
| `BUSINESS_REQUIRED` | `frontend.direction.decide` | `business` | terminate | Một actor, lời hứa, quyền, kết cục bất lợi hay đường phục hồi mà change level đòi vẫn chưa được giải quyết. | — | — | Chạy business.decide trước. |
| `CHANGE_LEVEL_AMBIGUOUS` | `frontend.direction.decide` | `caller` | terminate | Thẩm quyền cho new, reconstruct hay refine chưa rõ hoặc chỏi với intent. | — | — | Nêu đúng change level. |
| `DIRECTION_CHOICE_REQUIRED` | `frontend.direction.decide` | `caller` | fallback | Dưới automatic, nhiều phương án sống sót và bảng điểm không cho thấy phương án trội. Dưới approval-required, các tier hoặc hướng khác nhau về bản chất chờ người dùng chọn; điểm hỗ trợ đề xuất, không thay lựa chọn. | Trong các phương án hoà điểm dẫn đầu, chọn phương án thêm ít node mới nhất; bảng điểm giữ dưới ## Scores và lựa chọn ghi dưới ## Decision. | `selectionPolicy` = `approval-required` → terminate | Người nhập approval gọi tên một phương án. |
| `GRAMMAR_REQUIRED` | `frontend.direction.decide` | `grammar` | terminate | Một component của họ mà hướng cần chưa được publish; không bao giờ được ghép tạm một cái thay thế. | — | — | Người publish component đó, rồi chính hướng ấy chạy lại. |
| `NO_VIABLE_DIRECTION` | `frontend.direction.decide` | `caller` | terminate | Mọi phương án đều chỏi thẩm quyền hoặc chết dưới một đòn tấn công bắt buộc. | — | — | Đổi thẩm quyền hoặc ràng buộc; biến thể bề ngoài không phải delta. |
| `OWNER_CEILING_INVALID` | `frontend.direction.decide` | `caller` | terminate | Hướng cần một owner mà trần đã khai không uỷ quyền. | — | — | Sửa trần owner. |
| `REFERENCE_EVIDENCE_EXHAUSTED` | `frontend.direction.decide` | `caller` | terminate | Nghiên cứu có giới hạn không lấp được câu hỏi nghiệp vụ hay tương tác mà quyết định dựa vào. | — | — | Cấp thẩm quyền có chủ hoặc một tham chiếu mới về bản chất. |
| `REFERENCE_MISSING` | `frontend.direction.decide` | `self` | terminate | Một hướng new hay reconstruct không nêu chuẩn tham chiếu nào, nên lớp mà bề mặt nhắm tới bị bỏ trống và lens thẩm mỹ không phán được nó có tới đó không. | — | — | Nêu ít nhất một chuẩn theo lớp, kèm thứ được mượn từ nó, rồi chạy lại chính hướng ấy. |
| `SCOPE_UNFROZEN` | `frontend.direction.decide` | `caller` | terminate | Target hay ranh giới của bề mặt còn thiếu, nên không đóng được UI contract. | — | — | Đóng băng scope. |
| `ROUTE_UNVERIFIED` | `frontend.direction.decide`, `git.publish` | `workspace` | terminate | Danh tính project hoặc checkout frontend được route chưa được xác minh. | — | — | Bind lại route. |
| `GRAMMAR_UNPUBLISHED` | `frontend.presentation.resolve` | `grammar` | terminate | Gói Grammar chưa publish hoặc fingerprint đã bind là cũ. | — | — | Người publish đúng gói Grammar. |
| `KNOWLEDGE_UNBOUND` | `frontend.presentation.resolve` | `knowledge` | terminate | Một thuộc tính trình bày có trong cây mà không topic kiến thức nào được bind cho nó. | — | — | Bind topic còn thiếu. |
| `RULE_MISSING` | `frontend.presentation.resolve` | `knowledge` | terminate | Không case nào đã publish khớp điều kiện quan sát được trên một node. | — | — | Chủ knowledge publish case, rồi cây được resolve lại. |
| `UNKNOWN_RULE` | `frontend.presentation.resolve`, `frontend.surface.audit` | `self` | terminate | Một identifier ngoài kho luật đã bind bị với tới. | — | — | Bind topic publish nó, hoặc sửa lại identifier. |
| `RESOLUTION_STALE` | `frontend.source.apply` | `resolution` | terminate | Resolution thực sự đọc được khác resolution mà request đã bind. | — | — | Bind resolution hiện tại, hoặc resolve lại cây. |
| `WRITE_REJECTED` | `frontend.source.apply` | `caller` | terminate | Một file hay một giá trị lần ghi sẽ tạo ra nằm ngoài phần đã được uỷ quyền, hoặc cây đã commit không phải cây đã resolve. | — | — | Khai lại write set cho đúng, hoặc publish một resolution có mang giá trị đó. |
| `SURFACE_CLASS_MISSING` | `frontend.surface.audit` | `direction` | terminate | Quyết định direction không khai lớp bề mặt nào, hoặc khai một tên ngoài bộ từ vựng mà COVERAGE-1 Case 7 publish, nên mọi rule proof có dải đều không có ngưỡng và không topic nào phán quyết được. | — | — | Quyết lại direction kèm một lớp bề mặt đã khai, rồi audit lại ở đúng commit ấy. |
| `IDENTITY_MISSING` | `frontend.surface.audit`, `uat.verify` | `platform` | terminate | Route đòi một danh tính mới tới được bề mặt, mà luồng này chưa có hồ sơ tài khoản nào. Đây là một lần bàn giao, không phải một phán quyết: operator sở hữu danh tính sẽ cấp tài khoản, rồi nhánh này được vào lại cùng nó. | — | — | Operator danh tính cấp tài khoản của luồng theo entry trong registry, rồi nhánh này chạy lại cùng tài khoản đó. |
| `RUNTIME_UNAVAILABLE` | `frontend.surface.audit`, `uat.verify` | `platform` | terminate | Endpoint không phục vụ route đã bind, hoặc bề mặt không bao giờ sẵn sàng. | — | — | Người vận hành dịch vụ cho route đã bind chạy; operator này không bao giờ tự khởi động. |
| `APPROVAL_MISSING` | `git.publish` | `caller` | terminate | Không phê duyệt nào phủ đúng đơn vị ranh giới này; bằng chứng hoàn thành không phải phê duyệt. | — | — | Cấp một phê duyệt cấp cho đúng đơn vị này. |
| `DIRTY_OUTSIDE_BOUNDARY` | `git.publish` | `source` | terminate | Có thứ bẩn nằm ngoài các write root đã khai, nên lần publish sẽ mang theo công việc ranh giới này không sở hữu. | — | — | Dọn sạch cây làm việc, hoặc sửa lại các write root. |
| `HOOK_BLOCKED` | `git.publish` | `source` | terminate | Một Git hook từ chối lần publish, và không có đường vòng nào biểu diễn được. | — | — | Sửa ranh giới và mang một head mới. |
| `NON_FAST_FORWARD` | `git.publish` | `remote` | terminate | Remote mang những commit mà ref cục bộ không có, nên cú push không phải fast-forward. | — | — | Người sở hữu nhánh hoà giải phần phân kỳ và một head mới tới. |
| `BRANCH_POLICY_VIOLATION` | `git.publish`, `workspace.bind` | `workspace` | terminate | Checkout đang ở nhánh mà chính sách Git của route cấm với thao tác này. | — | — | Chuyển sang nhánh được phép hoặc đổi chính sách của route. |
| `LIBRARY_BOUNDARY_REJECTED` | `library.source.apply` | `caller` | terminate | Không chứng minh được danh tính package, tập file chính xác, ranh giới chỉ sửa hành vi hoặc binding session. | — | — | Cung cấp thẩm quyền owner hoặc kế hoạch có giới hạn đã sửa; presentation sản phẩm vẫn theo pipeline frontend. |
| `LIBRARY_PROOF_FAILED` | `library.source.apply` | `self` | terminate | Regression chưa thất bại trước và đạt sau sửa, hoặc gate package bắt buộc chưa đạt trên cây bàn giao. | — | — | Sửa hành vi đã khai và chạy lại toàn bộ bằng chứng trên cây thay đổi. |
| `CAPABILITY_MISSING` | `platform.operate` | `caller` | terminate | Capability mà service kind đòi hỏi đang thiếu, hoặc không nêu bằng chứng custody nào. | — | — | Cấp handle capability còn thiếu cùng custody của nó. |
| `EFFECT_UNAUTHORIZED` | `platform.operate` | `caller` | terminate | Một effect cần thiết nằm ngoài tập effect đã duyệt hoặc ngoài nhánh. | — | — | Duyệt effect đó, hoặc mang một kế hoạch hẹp hơn. |
| `INTEGRATION_FAILED` | `platform.operate` | `product` | terminate | serve đã tự giải xung đột merge rồi chấm gate trên head đã gộp, và một gate bắt buộc trả về đỏ: head đã gộp không qua được các gate phát hành. Biên nhận nêu tên gate hỏng và những chỗ đã được giải xung đột. | — | — | Một người hoặc chính phiên sở hữu sửa nhánh phiên rồi xin serve lại; lần merge đã sinh ra head hỏng không bao giờ bị rebase, force hay bỏ qua để cho nó áp được. |
| `INVENTORY_DRIFT` | `platform.operate` | `platform` | terminate | Một tài nguyên đã khai đã đổi kể từ khi inventory được ràng, nên kế hoạch mô tả một dịch vụ không còn tồn tại. | — | — | Quan sát lại inventory; nó phải tới với một fingerprint mới. |
| `PORT_CONFLICT` | `platform.operate` | `product` | terminate | Một cổng được claim đang bị một tiến trình đã khai khác giữ, và việc nó bị giữ không phải giấy phép giành lại. | — | — | Thoả thuận một cổng khác, hoặc chủ của kẻ đang giữ nhả nó ra. |
| `PROOF_FAILED` | `platform.operate` | `platform` | terminate | Một phép kiểm bắt buộc thiếu, không đọc được, hoặc hỏng sau khi áp, và một lần vận hành chưa chứng minh được thì chưa phải đã vận hành. | — | — | Sửa dịch vụ, rồi gọi lại. |
| `SERVICE_UNAVAILABLE` | `platform.operate` | `provider` | terminate | Dịch vụ dùng chung hoặc provider của nó không tới được. | — | — | Khôi phục provider. |
| `AUTHORITY_DRIFT` | `platform.operate`, `uat.verify` | `caller` | terminate | Phê duyệt — một id phê duyệt, hay bản khai báo môi trường mà nó tham chiếu với hash nội dung đã đổi — không còn khớp với điều thao tác đã yêu cầu. | — | — | Mang một phê duyệt mới cho đúng thao tác này: một id mới, hoặc tham chiếu hiện hành của bản khai báo. |
| `PROVISIONING_UNAVAILABLE` | `platform.operate`, `uat.verify` | `control-panel` | terminate | Không tới được nhà cung cấp danh tính, bí mật niêm phong hay kho dữ liệu mà một danh tính UAT cần, nên tài khoản không tạo được mà cũng không dùng được. Hồ sơ chỉ đơn giản là chưa có thì được tạo ra; mã này dành cho một phụ thuộc hoàn toàn không tồn tại. | — | — | Khôi phục provider, file niêm phong hay kho dữ liệu; không bao giờ nhờ người đăng nhập hay dán thông tin đăng nhập. |
| `DEBT_UNAPPROVED` | `quality.verify` | `caller` | terminate | Một khoản nợ đã khai không có phê duyệt còn sống của chủ, hoặc phủ lên một cổng đã pass hay một lỗi boundary-drift. | — | — | Cấp phê duyệt của chủ còn hạn, hoặc bỏ khoản nợ. |
| `GATE_UNAVAILABLE` | `quality.verify` | `platform` | terminate | Một cổng bắt buộc hoàn toàn không chạy được ở môi trường này, và cổng không đo được không phải cổng đã qua. | — | — | Cấp một môi trường chạy cổng hoạt động được. |
| `PREDECESSOR_MIXED` | `quality.verify` | `caller` | terminate | Hai biên bản tiền nhiệm mô tả hai source head khác nhau, nên hợp của chúng là một delivery chẳng ai xây. | — | — | Cấp một bộ tiền nhiệm nhất quán trên cùng một head. |
| `PREDECESSOR_STALE` | `quality.verify` | `caller` | terminate | Fingerprint của một tiền nhiệm không còn khớp source đã đóng băng. | — | — | Mang biên bản thượng nguồn đã làm mới. |
| `ARTIFACT_MISSING` | `release.deploy` | `provider` | terminate | Digest bất biến không phân giải được, và không được build một cái thay thế rồi gọi nó là cùng release. | — | — | Publish artifact ở đúng digest đó. |
| `AUTHORIZATION_MISSING` | `release.deploy` | `approval` | terminate | Không grant nào đã khai phủ project, môi trường, target hay hành động deploy này, hoặc nó đã hết hạn lúc target được quan sát. | — | — | Cấp thẩm quyền đã khai và còn hiệu lực. |
| `CONCURRENT_DRIFT` | `release.deploy` | `deployment` | terminate | Một release không phải release này và cũng không phải release trước nó đã trở nên active giữa lượt chạy. | — | — | Lập kế hoạch lại theo trạng thái quan sát mới. |
| `CREDENTIAL_UNAVAILABLE` | `release.deploy` | `platform` | terminate | Một handle đã khai không phân giải được qua custody đang có. | — | — | Khôi phục custody; không bao giờ nhập giá trị trực tiếp. |
| `DOMAIN_UNRECONCILED` | `release.deploy` | `provider` | terminate | Trạng thái domain hay TLS không đưa về đúng khai báo được. | — | — | Sửa trạng thái phía provider, hoặc thẩm quyền với provider. |
| `HOST_UNAVAILABLE` | `release.deploy` | `provider` | terminate | Host đã khai không chuẩn bị được. | — | — | Cấp một host tới được và đã chuẩn bị. |
| `MANIFEST_INVALID` | `release.deploy` | `caller` | terminate | Manifest đã kiểm được ghim vào một release khác, và phép thay thế đó chính là cách một image chưa duyệt tới được target đã duyệt. | — | — | Mang một manifest đã kiểm đúng với release này. |
| `MIGRATION_BLOCKED` | `release.deploy` | `backend` | terminate | Migration đã khai không thể áp một cách an toàn. | — | — | Duyệt một ranh giới migration mà chủ backend áp được. |
| `RECOVERY_EXHAUSTED` | `release.deploy` | `approval` | fallback | Các hành động đảo ngược được đã duyệt đã cạn. | Đi nhánh rollback: khôi phục rollbackIdentity theo đúng digest của nó, không bao giờ theo tag, và ghi release đã khôi phục dưới ## Fallbacks taken. | — | Cấp thẩm quyền rollback, hoặc duyệt một hành động không an toàn. |
| `ROLLBACK_IDENTITY_MISSING` | `release.deploy` | `provider` | terminate | Cần rollback nhưng đúng release an toàn của nó không còn tồn tại. | — | — | Khôi phục release an toàn ở đúng digest của nó. |
| `ROLLOUT_FAILED` | `release.deploy` | `deployment` | fallback | Rollout không đặt được release lên target. | Đi nhánh phục hồi: chỉ áp những hành động đảo ngược được đã duyệt trên cùng release identity, từng cái một, và ghi mỗi lần thử cùng kết quả dưới ## Fallbacks taken. | — | Sửa target hoặc plan rồi roll out lại. |
| `STEADY_STATE_UNPROVEN` | `release.deploy` | `deployment` | terminate | Cửa sổ ổn định không khép lại trước deadline có chặn trên, và một rollout được giả định không phải một lần deploy. | — | — | Quan sát một chuỗi mới sau khi target hồi phục. |
| `ADMISSION_MISSING` | `uat.verify` | `quality` | terminate | Lượt soi bề mặt hoặc lượt kiểm chất lượng cho phép UAT sản phẩm đang thiếu, hoặc một trong hai được lấy ở commit khác commit đã ghim. | — | — | Chạy lại admission còn thiếu tại đúng commit đã ghim. |
| `CANONICAL_WRITE_DENIED` | `uat.verify` | `backend` | terminate | Không ghi rồi đọc lại được thư mục luồng dưới lease độc quyền, hoặc lần ghi sẽ đè lên một hồ sơ lượt chạy đã có. | — | — | Khôi phục quyền ghi trên thư mục luồng, hoặc phát hành dưới một runId mới. |
| `EVIDENCE_UNAVAILABLE` | `uat.verify` | `runtime` | terminate | Một case không sinh ra capture, không sinh ra ảnh chụp, hoặc không ảnh nào che được ô mật khẩu, nên một làn không có gì để xét. | — | — | Khôi phục phụ thuộc rồi chạy lại case đã đóng băng dưới một runId mới. |
| `FIXTURE_VIOLATION` | `uat.verify` | `caller` | terminate | Seed, namespace lượt chạy hay phạm vi dọn dẹp không thoả được: seed sẽ tạo ra chính kết quả cần kiểm, hoặc dọn dẹp sẽ với ra ngoài namespace. | — | — | Sửa ranh giới fixture trong seed/records.json. |
| `LEASE_INVALID` | `uat.verify` | `control-panel` | terminate | Lease độc quyền trên thư mục luồng đã hết hạn, thuộc chỗ khác, hoặc gắn vào lượt chạy, generation hay origin khác. | — | — | Orchestrator cấp lại lease cho đúng lượt chạy này. |
| `CHECKOUT_DIRTY` | `workspace.bind` | `source` | terminate | Có thứ đang bẩn ngoài các write root đã khai báo, hoặc checkout mang bất kỳ vết bẩn nào trong khi đang ở nhánh mutation thay vì nhánh session/<sessionId>: nhánh mutation không có trạng thái dở dang của riêng nó, nên vết bẩn thấy ở đó là source được ghi mà không có phiên nào chịu trách nhiệm, dù chính sách có là session-only hay không. | — | — | Dọn sạch ranh giới, hoặc khai báo write root bao được nó khi checkout đã ở nhánh session/<sessionId>; trên nhánh mutation, cách sửa là mở phiên và chuyển thay đổi sang nhánh của phiên đó, không phải khai báo write root đè lên nó — operator này không bao giờ stash. |
| `ENDPOINT_AUTHORITY_STALE` | `workspace.bind` | `runtime` | terminate | Ràng buộc endpoint không phải phép chiếu port đóng, hoặc fingerprint của nó đã cũ. | — | — | Tính lại fingerprint thẩm quyền ở phía chủ của nó. |
| `IDENTITY_UNVERIFIED` | `workspace.bind` | `identity` | terminate | Định danh máy hoặc roster credential đã mã hoá của nó thiếu hoặc cũ. | — | — | Xác minh định danh máy và niêm phong roster của nó. |
| `ROUTE_MISMATCH` | `workspace.bind` | `workspace` | terminate | Route đã hydrate mâu thuẫn với route portable đóng, hoặc thuộc về một Source khác. | — | — | Sửa lại phần hydrate. |
| `ROUTE_UNDECLARED` | `workspace.bind` | `workspace` | terminate | Không khai báo portable nào gọi tên project và role này. | — | — | Khai báo route; operator này không bao giờ tự sửa. |
| `ROUTE_UNHYDRATED` | `workspace.bind` | `workspace` | terminate | Khai báo có tồn tại nhưng không route local nào chiếu nó xuống máy này. | — | — | Hydrate route trên máy này. |
| `RUNTIME_BUSY` | `workspace.bind` | `runtime` | terminate | Nhánh tích hợp của route này đang bị một phiên khác giữ lease trong lúc merge và khởi động lại, nên head mà lần bind này cần chưa được phục vụ. | — | — | Chờ bên đang giữ nhả lease, rồi bind lại: chính endpoint đó sẽ phục vụ head đã merge kế tiếp. Phần reason nêu tên phiên đang giữ, thao tác nó đang chạy và vị trí xếp hàng. |
| `RUNTIME_NOT_READY` | `workspace.bind` | `runtime` | terminate | Registry chủ runtime thiếu, cũ hoặc chưa sẵn sàng trong khi người gọi phải tiêu thụ nó. | — | — | Nêu một yêu cầu phối hợp tới chủ đã đăng ký và chờ một generation sẵn sàng. |
