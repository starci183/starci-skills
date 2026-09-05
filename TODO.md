# TODO — 2.0 chạy tốt với agent mù

Danh sách việc của chủ cây, đọc cùng `INDEX.md` dòng lineage 2.0.0 và bằng chứng
`tests/evidence/20260904-codex-five-tasks-retrospective.md`. Mỗi mục là một gate chứ không phải lời
khuyên: xong nghĩa là có validator từ chối được vi phạm, và có bằng chứng trên một session thật.

## 1. Goal cho từng operator

- [x] Mỗi operator có `## Done when`: một câu, gọi tên Output chứng minh; `validate-operator` bắt buộc;
      `brief.md` in ngay dưới Job. (commit `02e97451`)
- [x] Goal của nhiệm vụ được người xác nhận trước bước 1: `state.json.mission` (goal, gồm, không gồm,
      xong khi với `producedBy`), lựa chọn `goal:<session>:v<n>`, transition `replanned` có ghi chú.
      (commit `02e97451`)
- [x] Goal cho từng nhánh: `request.json.goal` trỏ về đúng một dòng "xong khi" của mission hoặc khai
      `prerequisite` cho nhánh nào; `validate-request` từ chối nhánh không trỏ về đâu.
      (`validate-request.mjs#branchGoalErrors`, `mission-gate.spec.mjs`)
- [x] Kiểm sau: `response.json.goalCheck { achieved, evidence[] }` — agent khai, validator đối chiếu
      evidence với Output có thật và `producedBy` đúng operator; chỉ cái đã đối chiếu mới vào
      `brief.proven`. Ba nhánh liền không thêm bằng chứng "xong khi" nào → dừng, hỏi người.
      (`validate-response.mjs#goalCheckErrors`, `validate-session.mjs#provenErrors`,
      `#threeBranchStopErrors`, `validate-session.spec.mjs`)
- [x] Fail thì chạy lại đúng ô: lỗi nhỏ (dưới ba file, không đổi bố cục) → `*.fix`; lỗi lớn →
      `*.generate`; thước "nhỏ/lớn" ghi trong `resources/orchestrator.json`, không trong operator.
      (`orchestrator.json#fixSize`: maxFiles, generateTopics, generatePrefixes, escalateAfter;
      `interface-fix/validate.mjs#fixSizeErrors`, `validate-request.mjs#fixKindErrors`, `fix-kind.spec.mjs`)

## 2. Audit từng operator theo chuẩn: tách theo tính năng, một operator một việc

Chuẩn: một operator làm đúng một việc, ứng với một tính năng của luồng (sinh trang, chấm trang, sửa
trang, cấp tài khoản, seed dữ liệu, serve runtime, đi thử, publish); một artifact chính, một câu Done
when không nối bằng "or" giữa hai việc, một quy trình tối đa 12 dòng lọt trong brief 2 KB, scope và
context khai đủ để agent mù chạy được, log đủ để người đọc ledger dựng lại được việc.

- [x] Gate cho "một việc": `operator.json.primaryOutput` khai đúng một kind; Done when phải gọi tên kind
      đó; `validate-operator` từ chối operator có hai primaryOutput hoặc Done when nối hai việc bằng
      "or" ngoài mệnh đề chế độ (apply/dry, delta none).
      (`validate-operator.mjs#checkPrimaryOutput`, `#checkDoneWhenAlternatives`, `validate-operator.spec.mjs`)

- [x] Cờ `mode: inline | dispatch | isolated` trên `operator.json` thay cho `dispatch`; `isolated`
      chỉ đọc alias trong Context và file trong `inputs`, request thiếu input bắt buộc bị từ chối
      trước khi spawn; tối đa một `dispatch` cùng lúc; profile ghi `forkTurns` theo mode.
      (`orchestrator.json#modes`, `#concurrency.maxDispatch`, `validate-resources.mjs`,
      `validate-request.mjs#isolatedContextErrors`; cột `Dispatch` của `resources/INDEX.md` còn phải
      đổi tên thành `Mode`)
- [ ] Tách `platform.operate` → `identity.provision`, `data.seed`, `runtime.serve` (Done when hiện
      dài 975 byte, ba nhánh trong một câu; S2 bị chặn 7/10 lượt).
- [ ] Tách `release.deploy` → `release.deploy` (image) và `migration.release`.
- [ ] Tách `business.decide` → `business.decide` (model) và `business.reconcile`.
- [ ] Gộp `frontend.direction.decide` + `frontend.presentation.resolve` + `frontend.source.apply` →
      `interface.generate` (mù); đổi tên `frontend.surface.audit` → `interface.audit` (mù); thêm
      `interface.fix` (root, không mù).
- [ ] Gộp `library.source.apply` + `dependency.update` → `library.update` (bump +1, publish, consume).
- [ ] Đổi tên `backend.source.apply` → `backend.generate`; fix là chế độ của nó.
- [ ] Bỏ nửa runtime khỏi `workspace.bind`; bỏ việc dừng server khỏi `git.publish`.
- [ ] Luồng rõ: bảng Steps của mọi operator viết lại thành quy trình cụ thể — mỗi dòng mở bằng động từ,
      gọi tên tool hoặc file sinh ra, tối đa 12 dòng; `validate-operator` bắt buộc.
- [x] Scope rõ, context rõ: Context table và Inputs là toàn bộ thứ agent mù được thấy; brief in dòng
      "you see only what request.json names" khi mode là isolated.
      (`generate-operator-briefs.mjs`, `validate-request.mjs#isolatedContextErrors`)
- [ ] Workflow viết thành quy trình đọc được (`procedure` trong `workflows/*.json`), tối đa ba nhánh
      một bậc, chuỗi suy từ các dòng "xong khi" của mission; vẽ lại chuỗi là transition `replanned`.
- [x] Log đủ ra session gốc: sau mỗi transition in đúng hai dòng vào chat — goal của nhánh, rồi
      done/blocked với số dòng "xong khi" đã có bằng chứng, đường dẫn artifact, lỗi và ô kế tiếp;
      output đầy đủ ở lại session folder; cuối lượt một khối báo cáo theo ba dạng của
      `resources/interaction.json`.
      (`interaction.json#transitionLog`, `state.json.transitions[].logged`,
      `validate-session.mjs#loggedErrors`, `validate-interaction.mjs#transitionLogErrors`)
- [ ] `content.generate`: tách brief / sinh / review ở đợt sau, domain riêng.

## 2a. Full Sol

- [ ] Bỏ profile `luna`: mọi operator bind `sol-fresh` (producer, quyết định, execute) hoặc
      `sol-reviewer` (audit, critique, review); gỡ `luna` khỏi `resources/agents/profiles/openai.json`,
      khỏi `profileEquivalents` (cặp với `sonnet`), khỏi cột Profile của `resources/INDEX.md` và mọi
      `operator.json`; `validate-resources` từ chối profile không còn khai. Bằng chứng: 17 nhánh thoát
      không receipt trong S1/S4 đều là Luna.

## 2b. Dynamic flows và cặp plan/execute

- [x] Xoá 11 workflow ví dụ khỏi runtime: cửa vào không đọc `when` nữa; chuỗi được `scripts/plan-chain.mjs`
      suy ngược từ các dòng "xong khi" của mission qua bảng Inputs/Next và `primaryOutput`; 11 ví dụ
      thành fixture cho spec của planner (planner phải suy ra được chúng từ goal tương ứng).
      (`plan-chain.mjs#planChain`, `tests/chains/*.json`, `plan-chain.spec.mjs`)
- [x] `scripts/validate-chain.mjs`: luật cũ của validate-workflows (Next, input có producer, không chung
      alias ghi, tối đa ba nhánh, luật dòng dài khi có publish) áp lên `state.json.chain` mỗi lần vẽ;
      vẽ lại là transition `replanned`.
      (`validate-chain.mjs#validateChain`, nối vào `validate-session.mjs`; `validate-chain.spec.mjs`)
- [x] Đơn vị của một agent mù là một trang, một modal, một luồng. Cặp plan/execute cho mọi operator có
      thể có N đơn vị: `X.plan` in danh sách đơn vị ra chat gốc (kind chung `units`: `{id, goal, inputs}`,
      validator từ chối đơn vị không có goal); `X.execute` mù, một đơn vị mỗi nhánh, phải trỏ về đúng
      `unit.id` của plan bậc trước; fan-out tối đa ba nhánh một bậc, mỗi nhánh một nhánh ghi riêng.
      (`templates/kinds/units.schema.json`, `request.schema.json#unit`,
      `validate-request.mjs#unitGateErrors`, `orchestrator.json#concurrency.maxParallel`,
      `unit-gate.spec.mjs`; operator execute phải khai Input `units` để bind `inputs.units`)
- [x] Áp cặp này: `interface.plan` (bản đồ bề mặt: trang, modal, shell chung, contract dữ liệu, goal
      từng trang) + `interface.generate` một trang; `uat.plan` + `uat.verify` một luồng; `data.plan` +
      `data.seed` một seed; `backend.plan` + `backend.generate` một module khi contract có nhiều module
      (planner toả ra qua domain của operator execute, nên id là `data.plan`, không phải `seed.plan`).
      (`operators/interface-plan`, `uat-plan`, `data-plan`, `backend-plan`; kind `surface-map`, `uat-plan`,
      `seed-plan`, `backend-plan`; bảng Inputs `units` của `interface.generate`, `uat.verify`, `data.seed`,
      `backend.generate`; fixture `tests/chains/seed-fanout.json`, `backend-fanout.json`; còn thiếu dòng Next
      dẫn tới `<domain>.plan` ở `workspace.bind`/`architecture.decide`, không có nó planner không tới được
      bậc plan nào — kể cả `uat.plan`, `interface.plan`)
- [ ] Gộp có thứ tự: `runtime.serve` merge N nhánh vào nhánh tích hợp, xung đột trả về đúng đơn vị.
- [ ] Audit hai tầng: `interface.audit` từng trang, cộng một lần audit chéo lấy bản đồ làm input (shell,
      tên, điều hướng); lỗi chéo về `interface.plan`.
- [x] Budget theo đơn vị: `maxSteps = cơ bản + N × mỗi đơn vị`, N đọc từ số dòng "xong khi".
      (`orchestrator.json#budget.perUnit` và câu nâng trần trong `budget.note`; validate-request từ chối
      nhánh không `unit` khi mission có hơn một dòng "xong khi" cho operator execute có `X.plan`)
- [ ] `interface.audit` chấp nhận audit một trang đang chạy: input source-application và decision tuỳ
      chọn khi target là bề mặt có sẵn.

## 2d. Cửa đóng và tường thật mà hai lần chạy Nivo trên 2.0.0 lộ ra (2026-09-05)

- [x] `library.update` không tiêu thụ được qua hai repo: owner ở `starci-academy-fe`, consumer ở `nivo-fe`
      là hai route, hai session, mà operator đòi cả `plan` lẫn `consumer` trong một checkout. Sửa: chế độ
      `publish` (consumer none, dừng ở bản phát hành đã đóng gói; publish lên registry là thẩm quyền của
      người) và chế độ `consume` bind ở route consumer, nhận `library-release` của session anh em qua
      route `chain`.
      (yêu cầu `mode` `full|publish|consume`; kind `library-release` là bản ghi dữ liệu và
      `library-archive` là tarball; `validate.mjs#modeSectionErrors`, `#loadReleaseInput`,
      `#bindRelease` — preflight chỉ giải đường dẫn package nơi có nửa package chạy; self-test bind
      từng chế độ, từ chối mọi tiết mục và đầu vào chéo chế độ, và có fixture nhánh blocked D7)
- [x] Reachability: mọi operator phải tới được từ `environment.preflight` qua các bảng Next (D1, D6, D7
      của session recovery). (`validate-operator.mjs#checkReachability`, dòng Next
      `workspace.bind → architecture.decide|interface.plan|data.plan`, `architecture.decide → backend.plan`,
      `runtime.serve|quality.verify → uat.plan`)
- [x] Import là producer: slot import được chấp nhận thì kind của nó tính là đã sinh cho planner và cho
      `validate-chain` (D2); cổng origin của `producer-import` kiểm output và byte, không kiểm `next` (D5);
      chuỗi hợp lệ trước khi request của nhánh bind tồn tại, kế hoạch mang `role` (D3); `gitPolicy` đúng
      kiểu route khai (D4).
- [x] Preflight chỉ kiểm họ runtime cho vai mà chuỗi phục vụ, quan sát hay đi thử: `runtimeRoles` do planner đặt sẵn
      (mọi vai đã bind khi chuỗi có `runtime.serve`/`interface.audit`/`uat.verify`, không vai nào khi không có);
      sửa package thư viện không còn thừa hưởng tường của server nó không chạm (`environment-preflight/validate.mjs`,
      `plan-chain.mjs#RUNTIME_OPERATORS`).
- [x] Hai tường của lần chạy Setup trên 2.0.3: id operator đã đổi tên trong bundle 1.x (`operators/retired.json`,
      `scripts/retired-operators.mjs`, đọc bởi validate-response chế độ origin, producer-import, validate-chain); chuỗi
      fix → consume → serve → audit có dòng Next (`interface.fix → runtime.serve|library.update`,
      `library.update → runtime.serve|interface.audit`); chỉ operator khai Inputs `units` mới toả qua `<domain>.plan`
      (`validate-request#planOperatorOf`, `interface.audit` khai `units`); fixture `tests/chains/setup-refine-consume.json`.
- [x] Ba cửa hẹp lộ ra khi chứng minh kịch bản recovery trên 2.0.2 (tests/evidence/20260905-nivo-recovery-replan-on-2.0.2.md):
      D8 kế hoạch mang cả input import (`state.json.planned[N/M].inputs`, `validate-chain#readImportedInputs` đọc kế
      hoạch khi chưa có request, `validate-request#plannedRequirementErrors` giữ nguyên khi dispatch); D9 producer
      import được chấm theo luật của chính operator ở chế độ origin, không theo gate phiên và catalogue hôm nay
      (`validate-step.mjs#origin`, `migration-contract.mjs`); D10 thứ tự tạo phiên: state tạm → import → plan → ghi lại
      (`orchestrator.json#session.lifecycle` create).
- [x] `library.update` chấm nhánh blocked theo mã dừng của nó, không nạp checkout trước khi đọc trạng thái
      (D7 của session Setup: `operators/library-update/validate.mjs#validateLibraryUpdateStep`; fixture nhánh
      blocked — plan gọi tên package checkout không có — nằm trong `operators/library-update/self-test.mjs`).
- [x] Self-test không phụ thuộc vị trí checkout: `data.seed`, `uat.verify` dùng host giả của chính chúng
      cho tra cứu `.stacks/<env>`.

## 2e. Nợ 2.0.4 lộ ra trong hai lần chạy trên 2.0.3

- [x] Gate cho lệnh git bị cấm: `changes.md` ghi `Reflog before`/`Reflog after` (`HEAD <entries> <sha>; stash <entries>`),
      và validator của cả bốn operator ghi source đọc reflog sống của checkout: cửa sổ từ base tới commit đã ghi chỉ
      được chứa commit của chính nhánh, nên stash (entry reset sống lâu hơn cả lệnh drop), reset, force, clean,
      checkout nhánh khác, rebase và am đều bị từ chối đích danh; hai entry `git worktree add` sinh ra không tính.
      (`scripts/workspace-checkout.mjs#reflogErrors`, `#sourceWriteErrors`, `workspace-checkout.spec.mjs`,
      self-test của backend.generate, interface.generate, interface.fix, library.update)
- [x] Junction và xoá tay: binding của `workspace.bind` ghi hàng `Installed tree` (`own directory`, `absent`,
      `junction to <target>`) trong `## Checkout`, validator đọc lại chính liên kết ấy, và một junction trỏ ra ngoài
      checkout chỉ được ràng khi request khai `sharedInstall`; Ranh giới của cả bốn operator ghi source nói worktree tạm
      gỡ bằng `git worktree remove --force` và không xoá tay dưới checkout có junction.
      (`scripts/workspace-checkout.mjs#junctionErrors`, `#installedTreeOf`, `workspace-checkout.spec.mjs`,
      `operators/workspace-bind/self-test.mjs`)
- [x] `validate-step` chưa từng gọi `operators/<id>/validate.mjs`: mọi "step valid" của ba lần chạy chỉ chứng minh
      contract chung (session recovery phát hiện bằng cách chèn lỗi cố ý). Sửa: CLI và `validateStep(..., {operator:true})`
      dispatch validator của operator sau luật chung, CLI không dùng top-level await vì validator import ngược lại
      (`scripts/validate-step.mjs#operatorValidator`, `validate-step.spec.mjs`).
- [x] Receipt của `workspace.bind` chấm theo head đã ghi: head ấy phải bằng head hiện tại của checkout hoặc là tổ tiên
      của nó trên cùng nhánh (chuỗi đi tiếp một cách hợp lệ); checkout dời sang commit lạ hay nhánh khác vẫn bị từ chối.
      Mọi field khác vẫn phải trùng khít. (`scripts/workspace-checkout.mjs#validateWorkspaceCheckoutBinding`,
      `workspace-checkout.spec.mjs`)
- [x] Sửa nóng làm gãy phiên đang chạy (`b21fd9ab`): dải slot import bị áp cả trên đường đọc nên slot cũ (8/1, 9/1) mất
      tín nhiệm, 3/1 và 6/1 của recovery đỏ trong 20 phút. Sửa ở `541142a6`: dải chỉ áp khi ghi import mới. Luật cho
      người sửa harness: bản vá chạm đường đọc phải được probe trên ledger sống trước khi ff runtime.
- [x] D16: head đã `implemented` không reconcile lại được sau khi bản giao dời đi → transition `implemented->implemented`
      (rebinding, không sai lệch) ở `business.reconcile`; head publish trích đúng commit gate đã pass.
- [x] Preflight trước lần ghi đầu: dòng Steps 1 của cả bốn operator ghi source nói preflight chạy trước lần ghi đầu ra
      ngoài thư mục phiên, `## Binding` của `changes.md` mang `Preflight` (`<passed|failed> at <ISO 8601 instant>`),
      và validator từ chối receipt done không có nó, có verdict không phải `passed`, hay có commit đầu sớm hơn thời điểm
      ấy. (`scripts/workspace-checkout.mjs#sourceWriteErrors`, self-test của bốn operator)
- [x] Head publish mà chỉ mục không biết: `business.reconcile` ghi thư mục feature nói `implemented` trong khi
      `business-registry-v1.json` vẫn gọi tên head cũ, và `previousHeadRef` trỏ vào một file session vì chưa object nào
      được lưu trữ — cả hai đều đúng luật của một tập ghi chỉ có thư mục feature, và cả hai để lại cho người. Sửa:
      publish head là việc của operator, một tập ghi gồm thư mục feature, object theo địa chỉ nội dung và mục chỉ mục;
      một nhà duy nhất cho phép ghi ấy để `business.decide` dùng lại (`scripts/business-registry.mjs` + spec,
      `business-reconcile/validate.mjs`, `self-test.mjs`, hai hàng `## Lineage` mới của
      `business-reconciliation`).
- [x] Bản sửa owner dừng ở "đã đóng gói, chờ người phát hành" nên consumer vẫn giữ bản cũ: mode `publish` của
      `library.update` giờ tự đẩy chính archive đã digest lên registry mà manifest gọi tên khi proof package đã xanh
      (`@tools/registry: publish`, credential giải theo tên qua `@tools/secrets`), đọc ngược version cùng integrity rồi
      ghi `publication { registry, version, state, integrity, at }`; `pending` chỉ hợp lệ khi request đặt sẵn
      `publish: false`, và registry từ chối là `LIBRARY_PUBLISH_REJECTED` mang chính câu trả lời của registry
      (`operators/library-update/validate.mjs#publicationErrors`, `#publishStopErrors`, `self-test.mjs`).

- [x] Hàng "observability, dịch vụ Sonar, tunnel" mà catalogue 2.0.0 bỏ đi không có nhà nào: một nhiệm vụ cần chúng
      không gọi tên được operator nào và không nói được chúng có chạy hay không. Sửa: môi trường khai chúng
      (`services` trong `environment.schema.json`, mỗi cái có kind, trạng thái mong muốn, lệnh đã khai, probe và
      `holder`), `environment.preflight` thêm họ `service` với hai phép kiểm mỗi dịch vụ và tường thuộc `service`,
      và `service.operate` dời đúng một dịch vụ mỗi nhánh, chứng minh trạng thái chỉ từ probe (`SERVICE_UNPROVEN`),
      dừng trước khi dời với một dịch vụ môi trường giữ với người (`SERVICE_APPROVAL_REQUIRED`); enumeration là của
      bản khai báo nên không có `service.plan` (`tests/chains/service-fanout.json`).

- [x] Một nhiệm vụ chỉ-backend không có lượt đi nào: bộ kiểm tích hợp chạy như gate bên trong checkout và không gì
      từng vận hành API theo cách một client vận hành, nên biên nhận xanh trên một sản phẩm chưa ai gọi
      (`tests/evidence/20260905-nivo-recovery-on-2.0.3.md`). Sửa: `api.verify` — UAT của backend — chạy chính bộ kiểm
      end-to-end mà gate plan của route khai báo, như một client đối với entry mà `platform-operation-receipt` chứng
      thực chứ không phải một server nó tự khởi động, trên namespace mà `seed-receipt` gọi tên và bằng tài khoản mà
      `uat-account` gọi tên; các case là của runner (một định danh không đứng trong đầu ra của runner bị từ chối chứ
      không được xét, vì một case nhánh viết ra là một lần ghi mã nguồn thuộc `backend.generate`), ba làn contract,
      data và lifecycle được xét riêng, và hồ sơ chỉ-thêm nằm dưới `@worktrees/e2e/<flow>/runs/<runId>/` bên cạnh
      lịch sử trình duyệt chứ không nằm trong nó. Gate `e2e` của `quality.verify` giữ nguyên luật cũ — không chạy trừ
      khi có người hỏi — vì gate chứng minh mã còn lượt đi chứng minh sản phẩm (`operators/api-verify/**`,
      `templates/kinds/api-*`, `tests/chains/backend-feature.json`, `tests/chains/backend-e2e.json`).

## 2c. Bốn chỗ yếu của harness, mỗi chỗ một gate

- [x] Planner: `validate-operator` bắt mọi Input có producer và mọi primaryOutput có consumer hoặc là
      điểm kết; bậc thừa bị chặn bởi gate goal của từng nhánh (một nhánh không trỏ về dòng "xong khi"
      hay nhánh sau thì không chạy), và kế hoạch in ra chat hai dòng mỗi nhánh trước khi chạy.
      (`validate-operator.mjs#checkGraphClosure`, `validate-chain.mjs` goal rule, `plan-chain.mjs#previewChain`)
- [x] Gu auditor: lane đo được mù từng trang; lane taste và UX một auditor cho cả tính năng, chấm
      tương đối trên đủ sheet; gate hiệu chuẩn ba ảnh mốc trong `knowledge/ui/proof`, lệch quá một
      điểm thì receipt bị từ chối.
      (`knowledge/ui/proof/calibration/`, `TASTE-13` Case 9, `interface-audit/validate.mjs#calibrationErrors`,
      `CALIBRATION_OFF`, `## Calibration` và `## Ranked against` của `frontend-surface-audit`, `interface-audit/self-test.mjs`)
- [x] Học: `knowledge/findings/<family>.jsonl` ghi mọi finding của audit và UAT; `interface.generate`
      nhận finding gần nhất của family làm input âm; `scripts/promote-findings.mjs` gom finding "chưa
      có rule" từ hai lần và soạn sẵn rule cùng evidence note cho người gật.
      (`knowledge/findings/INDEX.md`, kind `findings`, `record-findings.mjs` + spec, `validate-session.mjs#findingsLedgerErrors`,
      `interface-generate/validate.mjs#findingsAnsweredErrors` với `## Findings answered`, `promote-findings.mjs` + spec)
- [x] Thước nhỏ/lớn theo loại thay đổi đọc từ prefix rule của finding (trình bày, copy, state → fix;
      composition, shell, node, contract → generate); leo thang sang generate sau một lần fix không
      sạch cùng finding.
      (`orchestrator.json#fixSize.generateTopics|generatePrefixes|escalateAfter`, `validate-request.mjs#fixKindErrors`)

## 4. Playwright là một chế độ của browsercontrol: lượt đi thử khai báo, agent không viết mã trình duyệt

- [x] `@tools/browsercontrol` có chế độ `playwright`: một Playwright + Chromium cài một lần ở máy chủ,
      ngoài cây (`resources/tools.json#browsercontrol.install`), mỗi nhánh một ngữ cảnh trình duyệt
      riêng; kind `uat-walk` là lượt đi agent VIẾT và runner `scripts/browser-walk.mjs` CHẠY — target
      chỉ là role + name, không selector, không URL ngoài `entry.route` ở bước 1, không script; ô bí
      mật điền `{ credential: <name> }` do runner phân giải từ tham chiếu niêm phong, không bao giờ in
      ra; `scripts/validate-walk.mjs` + sweep từ chối selector, goto giữa luồng, bí mật viết chữ, URL
      lạ, `page.evaluate`/`page.request`/`locator(`; `uat.verify` và `interface.audit` có dòng viết
      lượt đi và dòng chạy nó, validator đòi control của capture bằng target của bước, kết cục là của
      runner, và `walk-result` cạnh lượt đi; `environment.preflight` báo tường `host.playwright` và
      validator đọc lại bản cài từ máy chủ.
      (`templates/kinds/uat-walk.schema.json`, `walk-result.schema.json`, `scripts/browser-walk.mjs`,
      `validate-walk.mjs`, `browser-walk.spec.mjs` — runner chạy thật trên một trang tĩnh qua
      `host-artifacts.mjs`, bỏ qua có nêu lý do khi máy chủ chưa cài; self-test của ba operator)
- [x] Một bức chụp không phải một phép đo (lượt đi sản phẩm đầu tiên, D4): runner ghi kind
      `capture-measurements` cạnh mỗi ảnh chụp — một lần `page.evaluate` của hàm tự chứa, hộp, style
      đã tính, nền hiệu dụng, tương phản WCAG, `ref` theo role + name hay đường CSS ổn định, giới hạn
      nằm trong schema; `walk-result` nêu tên nó, `validate-walk` kiểm hình dạng, sweep vẫn không đọc
      `scripts/*.mjs`; validator `interface.audit` đòi mọi kết quả presentation/contrast/accessibility/
      responsive của bức chụp runner lái trích dẫn `ref` + giá trị (`verdicts.results[].measurement`);
      sổ từng bước gắn control chính bước ấy nêu, null cho bước không target, entry cho goto.
      (`templates/kinds/capture-measurements.schema.json`, `browser-walk.mjs#measurePage`,
      `validate-walk.mjs#stepOwnControl|citedMeasurement`, `interface-audit/validate.mjs#MEASURED_TOPICS`)

## 3. Chứng minh trên nhiệm vụ thật

- [ ] Chạy lại một nhiệm vụ đã hỏng (seed UAT của S2, hoặc refactor Setup) trên 2.0 với Sol 5.6 và
      đo lại: phút báo tường đầu tiên, số `RECEIPT_MISSING`, số bước, số lần cùng operator, số lần người
      phải nhắn "sao dừng". Ghi kết quả vào `tests/evidence/`.
- [ ] Đạt thì push `origin main` và publish `@starci/skills@2.0.0`; không đạt thì mục 2 chưa xong.

## 4. Playwright cho đi thử và audit (2.0.x, sau khi 2.0.2 chốt)

- [ ] `resources/tools.json`: `browsercontrol` thêm mode `playwright` — một Playwright + Chromium cài chung ở host
      (`PLAYWRIGHT_BROWSERS_PATH`), mỗi agent mù một browser context riêng (storage, viewport, DPR,
      `prefers-reduced-motion`, dark mode), ba nhánh song song không giành trình duyệt của người; CUA giữ
      làm fallback khi người muốn nhìn trực tiếp.
- [ ] Agent không viết code trình duyệt: nó ghi một walk khai báo (kind `uat-walk`, mở rộng `uat-capture`:
      goto, click theo role/name, fill, expect), `scripts/browser-walk.mjs` thực thi và chụp; gate quét
      cấm `page.request`, `page.evaluate` và điều hướng thẳng vào URL sâu, vì một lượt đi bằng API đọc y
      hệt một lượt đi thật.
- [ ] Đăng nhập thật qua form của provider; giá trị niêm phong giải vào env của process runner, agent không
      thấy, không in.
- [ ] `uat.verify` và `interface.audit` thêm dòng Steps dùng runner; trace/video và accessibility tree vào
      `response/artifacts/`; ảnh chụp deterministic là đầu vào của làn taste và của bộ hiệu chuẩn.

## 5. Sổ chưa kiểm: cái gì cố ý không đo thì phải ghi ra (2.1.1)

Chuẩn: kiểm chứng của một nhiệm vụ chỉ phủ những bề mặt mà hành trình "xong khi" của nó đi qua; mọi
thứ còn lại không được kiểm và phải được ghi là chưa kiểm, để không có gì bị bỏ qua trong im lặng và
không lần chạy nào render mọi màn hình "cho chắc".

- [x] `templates/kinds/units.schema.json`: mỗi unit có `tier: journey | secondary` (vắng đọc là
      `journey`) và `deferral.reason` cho unit `secondary`; `interface.plan` và `uat.plan` xếp tier từ
      các dòng "xong khi", và cột `Tier` của biên nhận nói đúng điều dữ liệu nói.
      (`validate-request.mjs#unitsErrors`, `unchecked.mjs#tierErrors`, hai self-test)
- [x] Fan-out và ngân sách đi theo hành trình: làn kiểm chứng (`unchecked.mjs#VERIFY_LANES`) chỉ được
      dispatch trên unit `journey`, và `budget.units` đếm đúng số đó; `interface.generate` vẫn dựng
      hết những gì plan liệt kê, vì phạm vi sinh là mục tiêu của người chứ không phải một phép chứng minh.
      (`validate-request.mjs#unitGateErrors|budgetUnitsOf`, `validate-session.mjs#unitBudgetErrors`)
- [x] Sổ: `@worktrees/unchecked/<product>/<featureId>.jsonl`, một dòng JSON một mục
      (`templates/kinds/unchecked.schema.json`), chỉ ghi thêm — kiểm nốt là một dòng thứ hai cùng id.
      (`scripts/unchecked.mjs`, `scripts/record-unchecked.mjs`, `validate-session.mjs#uncheckedLedgerErrors`)
- [x] Cửa hoãn: hoãn một state của unit thuộc hành trình là `UNCHECKED_UNLAWFUL`, trả về đúng plan đã xếp
      tier cho nó; mọi state được hoãn phải mang lý do để sổ chép lại.
      (`audit-scope.schema.json#journeyStates|deferrals`, `interface-audit/validate.mjs`)
- [x] Phần chưa kiểm được tiêu: plan phải kiểm nốt hoặc gia hạn mục đang mở, không được lặng lẽ bỏ nó
      khỏi danh sách; `business.reconcile` liệt kê mục đang mở trong `## Unchecked` và giữ head ở
      `in-progress` khi còn mục `journey`; `release.deploy` từ chối deploy production trên một mục
      `journey` (`UNCHECKED_OPEN`).
- [ ] Chứng minh trên một nhiệm vụ thật: một feature có bề mặt ngoài hành trình, chạy hết một vòng
      plan → generate → audit → walk → reconcile, và đọc lại sổ ở nhiệm vụ sau để thấy plan kế tiếp
      phải kiểm nốt hoặc gia hạn. Ghi vào `tests/evidence/`.
- [ ] `uat.verify` và `api.verify` chưa có chỗ nào hoãn được một case bên trong một flow đã đi: hôm
      nay một flow bị bỏ là một unit `secondary`, và cửa fan-out đã từ chối nó trước khi dispatch. Khi
      nào một lượt đi cần hoãn một case của flow nó *đang* đi thì mới mở `deferrals` cho hai operator
      ấy — thêm bây giờ là một mã dừng không đường nào chạm tới.

## 6. Bảy khiếm khuyết runtime của phiên reachability trên 2.1.0 (2.1.2)

Một nhiệm vụ thật leo hết thang trên 2.1.0 — hai checkout, hai bản sửa, một lần serve, hai lần audit
dưới runner, các gate và một lượt đi Playwright tới được bề mặt mà lần chạy 2.0.3 không tới nổi — và
gặp bảy khiếm khuyết của chính cây, ghi trong `tests/evidence/20260905-nivo-reachability-fix.md`. Mỗi
mục dưới đây đóng một cái, bằng một gate kèm spec, không bằng lời khuyên.

- [x] Sweep origin của lượt đi đọc chính bản ghi trang của runner: mọi bức chụp một trang có icon
      hay có link dev của framework đều bị chặn. Sửa: câu hỏi origin chỉ hỏi thứ agent tự viết —
      `scripts/validate-walk.mjs#PAGE_RECORD` để bản ghi DOM, ảnh cây accessibility, bản đo và biên
      nhận host ra ngoài đúng phép kiểm ấy, còn sweep bí mật và sweep mã trình duyệt vẫn đọc mọi byte
      (`scripts/browser-walk.spec.mjs`, `operators/interface-audit/self-test.mjs`).
- [x] Sổ finding không ghi được chừng nào 1 còn đứng: `record-findings.mjs` chỉ ghi biên nhận mà
      validator của operator chấp nhận. Đóng cùng 1, và self-test của `interface.audit` chạy một biên
      nhận playwright có `dom.json` qua đúng đường ấy tới ledger.
- [x] `--stop <pid>` của `@tools/host` gửi `SIGTERM`, mà Node trên Windows làm nó thành kết liễu cứng,
      nên `host.json` không bao giờ có `stoppedAt`. Sửa: dừng là một marker mà chính server đang chạy
      dò và tuân theo (đặt tên theo pid trong thư mục temp — địa chỉ duy nhất mà bên dừng chỉ cầm pid
      tính ra được), tín hiệu chỉ còn là phương án cuối cho server không trả lời
      (`scripts/host-artifacts.mjs#requestStop`, `host-artifacts.spec.mjs`).
- [x] `brief.proven` chỉ nhận dòng "xong khi", nên một nhánh mở đường (`goal.prerequisite`) không có
      chỗ nào để được ghi là đã chứng minh. Sửa: `templates/step/state.schema.json#/$defs/provenEntry`
      công bố cả hai cách viết và `validate-session.mjs#provenErrors` đọc chính pattern ấy, giải
      `prerequisite:<N/M>` qua đúng cái sổ goal như một dòng "xong khi" (`validate-session.spec.mjs`).
- [x] `next` mà một audit taste `fix-first` bắt buộc phải gọi tên thì chuỗi không đi theo được, khi
      chính bản giao ấy không bố cục gì. Sửa: delta trình bày `none` thì ống kính là của lần audit
      trước, trích dẫn dưới `## Calibration` là `inherited` kèm nhánh đã chấm, không nợ mốc nào, và
      `next` được phép gọi tên `quality.verify`; `fix-first` trên bố cục mà bản giao có chạm thì giữ
      luật cũ (`operators/interface-audit/{operator.md,validate.mjs,self-test.mjs}`, hợp đồng
      `frontend-surface-audit`).
- [x] `TASTE-12` Case 1 bác bỏ mọi bản tinh chỉnh: bảng `## References` rỗng làm hỏng một tiêu chí
      chặn cửa trước khi chấm bất kỳ ảnh nào. Sửa: `TASTE-12` Case 5 — delta trình bày `none` thì tiêu
      chí không áp dụng, hàng đọc `n/a`, không điểm, ngoài trung bình lẫn tập chặn cửa; validator ràng
      dấu ấy vào đúng tiêu chí tham chiếu và đúng delta ấy.
- [x] Luật đóng gói: một nhiệm vụ hai route không kết thúc hợp lệ trong một chuỗi vì `quality.verify`
      không phải Kế tiếp của `uat.verify`, nên lần publish của route thứ hai bị bỏ lại. Sửa: dòng Kế
      tiếp mới của `uat.verify`; planner xếp một ranh giới khi mọi nhánh còn lại đều là ranh giới; và
      thứ tự các dòng "xong khi" phân xử consumer đọc nhánh nào của một operator lặp lại
      (`tests/chains/two-route-publish.json`, `plan-chain.spec.mjs` đọc mỗi ví dụ như một dãy con).
- [ ] Chứng minh trên một nhiệm vụ thật: chạy lại chính nhiệm vụ hai route ấy trên 2.1.2 và publish cả
      hai route trong một chuỗi, rồi ghi vào `tests/evidence/`.

## 7. Tầng hỗ trợ: helper và kho nhiệm vụ (2.1.3)

- [x] `helpers/` bên cạnh `operators/`: `helper.md` (+vi) với Việc, Xong khi, Đọc, Ghi, Yêu cầu, Các
      bước, Đầu ra, Dừng; `helper.json` (profile, mode, tools, writes, primaryOutput); `errors.json`;
      `validate.mjs`; `self-test.mjs`; `brief.md` sinh tự động; `helpers/INDEX.md` (+vi) sinh tự động.
      (`scripts/helper-md.mjs`, `scripts/generate-helpers-index.mjs`, `scripts/generate-helper-briefs.mjs`)
- [x] Cửa: `scripts/validate-helper.mjs` trong `npm test` — profile phải có thật, tool phải nằm trong
      bộ chế độ `resources/orchestrator.json#helpers.tools` cho phép, mode là inline hoặc isolated, và
      mọi alias trong bảng Ghi phải được `alias/alias.json` đánh dấu `helperWritable`; luật của tầng hỗ
      trợ có một nhà duy nhất là đoạn `helpers` của orchestrator.json.
- [x] Gọi: route kind `helper` trong `routing.json`, một đoạn trong Entry của `SKILL.md`, và một bản
      ghi lần chạy duy nhất ở `@worktrees/helpers/<id>/runs/<runId>/run.json`
      (`templates/kinds/helper-run.schema.json`); helper không mở phiên và không hỏi gì
      (`resources/interaction.json#asks`).
- [x] Kho: `@worktrees/banked/<product>/` với `queue.json`, `<missionId>/mission.json` + `mission.md`
      và `approvals.json`; mọi nhiệm vụ phải có ít nhất một `evidenceRefs` (`BANK_UNGROUNDED`).
      (`scripts/bank.mjs` + spec, `templates/kinds/{bank-queue,banked-mission,bank-approvals}.schema.json`)
- [x] Chạy kho: một phê duyệt `bank:<product>:v<n>` tính là goal-confirm của mọi nhiệm vụ hàng đợi liệt
      kê, hash phủ thành phần và nội dung chứ không phủ tiến độ, mỗi sản phẩm một nhiệm vụ một lúc,
      `dependsOn` được chờ; `state.json.mission.bankRef` bị từ chối khi phê duyệt hết hiệu lực
      (`scripts/validate-session.mjs#bankRefErrors`).
- [x] Helper đầu tiên `generate-banks` chạy trên profile đọc (`astra`) và self-test của nó.
- [x] Chạy thật: route `bank` (`routing.json#kinds.bank`, một đoạn trong Entry của `SKILL.md` + gương)
      nói orchestrator lấy `bank.mjs#next`, đánh dấu `running:<sessionId>`, mở phiên với
      `mission.bankRef`, và chỉ đánh dấu `done:<sessionId>` khi phiên kết thúc done;
      `validate-session.mjs#bankRefErrors` từ chối một mục đọc ngược lại trạng thái của phiên, nên một
      nhiệm vụ dừng vì người ở lại `running` và tạm dừng cả kho. Spec: một kho ba nhiệm vụ chạy hết
      trình tự và dừng ở nhiệm vụ blocked (`scripts/bank.spec.mjs`).
- [ ] Chưa có: kho `nivo-agentos` mà một phiên Astra đã viết vẫn ở hình dạng cũ
      (`index.json`/`ORDER.md`/`workflows/<id>/workflow.json`/`BRIEF.md`). 17 nhiệm vụ của nó hợp lệ
      với `banked-mission.schema.json` sau khi đổi tên và dời trường, không phải sửa nội dung nào; việc
      chuyển thật thuộc về chủ kho ấy, không phải phiên này.

## 8. Bảy khoản nợ của ba phiên nivo trên 2.1.2 và 2.1.3 (2.1.4)

Ba phiên chạy thật (`tests/evidence/20260905-nivo-setup-uat-on-2.1.2.md`,
`20260905-nivo-recovery-e2e-on-2.1.2.md`, `20260905-nivo-recovery-operations-fix-on-2.1.3.md`) để lại
bảy khiếm khuyết của cây chứ không phải của công việc. Mỗi khoản đóng bằng một cửa và một spec, mỗi
khái niệm một nhà.

- [x] `library.update` tiêu thụ được nửa-trước từ một audit: một bản phát hành có thể khai `family`
      (`library-release.schema.json`) và một bản khai họ là bản phát hành trình bày; `regression` của
      `dependency-plan` thành hai hình dạng, và hình dạng `audit` gọi tên hai nhánh `interface.audit`
      của cùng phiên cùng các lời khai. Cửa: `operators/library-update/validate.mjs#auditProofErrors`
      kiểm cả hai ref giải được, cùng lời khai theo định danh, version mỗi nửa quan sát, và audit sau
      đo tại commit mà nhánh này commit; hợp lệ chỉ khi bản phát hành khai họ. Luật ở operator.md +
      gương, self-test theo hình dạng 3/2 của phiên `20260905-130417`.
- [x] `identity.provision` cấp phát trọn dàn diễn viên trong một nhánh: `identity-plan.schema.json`
      đổi `account` thành `accounts` (mỗi mục mang `alias`), `scripts/identity-provision.mjs#provisionAccounts`
      chạy hết theo thứ tự và dừng ở tài khoản đầu tiên hỏng, luật plan-sha giữ nguyên. Cửa:
      `operators/identity-provision/validate.mjs#planCastErrors` — kế hoạch liệt kê N thì hồ sơ công bố
      N, đúng username, không thừa alias nào.
- [x] `browser-walk` che giá trị ô mật khẩu trong bản ghi DOM và bản chụp accessibility trước khi ghi
      (`maskPasswordInputs`, `maskPasswordValues`, `PASSWORD_FIELD`), nên trạng thái đăng nhập bị từ
      chối chụp được thay vì bị `OUTPUT_SECRET_DETECTED`; sweep bí mật vẫn đọc mọi byte. Spec trên một
      DOM mẫu (`scripts/browser-walk.spec.mjs`).
- [x] `mission.scope` đếm mọi kế hoạch phiên đã cho tới nơi chứ không riêng kế hoạch mới nhất, nên một
      kế hoạch toàn journey không xoá được phần hoãn của kế hoạch trước khỏi dòng người đã đọc. Cửa:
      `scripts/validate-session.mjs#missionScopeErrors` (tách khỏi `unitBudgetErrors`, vốn bỏ qua kiểm
      tra khi `budget.units` vắng); luật ở `state.schema.json#mission.scope`, `interaction.json#rule`,
      `orchestrator.json#session`, `SKILL.md` bước 1 + gương.
- [x] `git.publish` giải xung đột chỉ-định-dạng bằng luật: cùng bộ bốn luật đóng mà `runtime.serve`
      dùng, dùng chung một module `scripts/merge-resolution.mjs` (tên luật đọc từ
      `delta.schema.json`) chứ không chép. Cửa: mục `## Resolutions` của `git-publication`, các finding
      `MERGE_RESOLVED` + `MERGE_GATED`, và `operators/git-publish/validate.mjs` kiểm luật, dải hunk,
      trùng lặp và quyền sở hữu file theo tập ghi của phiên; một hunk ngoài bộ luật vẫn là
      `NON_FAST_FORWARD` cho người.
- [x] Kho được chạy thật — xem mục 7.
- [x] Bản sửa nóng đang nằm trong cây (`interface.audit` khai `feature`; audit thừa kế lens mang
      `calibration` rỗng) có luật, hợp đồng, self-test và tài liệu khớp nhau và có gương: `feature` là
      trường bắt buộc nên cổng request từ chối một audit không gọi tên sổ nào
      (`operators/interface-audit/self-test.mjs`), và `record-unchecked.mjs` không còn in ra một file
      nó chưa từng mở khi nhánh không gọi tên feature.

## 9. StarCi 2.2 — đang thu thập specification

**Chỉ ghi nhận yêu cầu ở giai đoạn này. Chờ thầy specify hết rồi mới chốt phạm vi triển khai và lên 2.2.** Không coi việc ghi TODO là đã sửa runtime, chạy gate hoặc phát hành phiên bản.

### R01. User prompt → StarCi → session người dùng → xác nhận goal

- [ ] Mỗi user prompt phải vào skill StarCi ngay để xác định mục tiêu và cách xử lý yêu cầu trong session hiện tại.
- [ ] Tạo ngay hồ sơ `sessions/{session-id}` khi bắt đầu session; hồ sơ draft tồn tại trước bước hỏi xác nhận và trước công việc thực thi goal.
- [ ] Làm rõ với người dùng goals sẽ thực hiện trong session; trình cấu trúc và scope bằng bảng, có ví dụ minh họa khi cần.
- [ ] Hỏi người dùng xác nhận hay không. Chỉ chuyển đúng draft đã được xác nhận thành goal thực thi; sửa/từ chối/chưa trả lời không được coi là đồng ý.
- [ ] **Một session là phiên Codex worktree / Claude session của người dùng**, không phải một agent chạy ngầm. Operator, agent, retry và nhánh song song phải được liên kết về session và goal tương ứng.

#### Bảng scope cần trình

| Mục | Nội dung |
| --- | --- |
| Goal | Kết quả người dùng muốn đạt trong session |
| Target | Sản phẩm, source hoặc artifact được tác động |
| Trong scope | Những phần thực hiện, số lượng khi đã xác định |
| Ngoài scope | Những phần dễ bị hiểu là có làm nhưng chưa được giao |
| Đầu ra | Artifact/kết quả cụ thể sẽ bàn giao |
| Đạt khi | Điều kiện quan sát được để xác nhận hoàn thành |
| Phạm vi kiểm | Bằng chứng sẽ có và giới hạn kết luận |
| Ví dụ | Một tình huống giúp người dùng kiểm cách StarCi hiểu yêu cầu |

Ví dụ minh họa: người dùng nói “làm màn học CQRS theo ảnh”. StarCi trình rõ đang đề xuất brainstorm hình hay implement giao diện, các vùng UI trong scope, đầu ra và điều kiện đạt; hỏi “Đây có đúng goal thầy muốn làm trong session này không?”. Nếu người dùng sửa thành “chỉ brainstorm hình”, cập nhật draft tương ứng trước khi xác nhận và tạo goal. Ví dụ này không phải nhiệm vụ đã được giao triển khai.

#### Những điểm thiết kế còn mở — chưa tự chốt thay thầy

| Điểm | Cần đặc tả tiếp |
| --- | --- |
| Root và cấu trúc session | Alias vật lý của `sessions/`; file nào lưu binding, scope, quyết định, goal và các lần chạy; tận dụng ledger hiện có |
| Binding host | Native session/task ID và worktree; trường hợp Codex projectless hoặc nhiều task dùng chung checkout |
| Prompt tiếp theo | Cách phân biệt tiếp tục/bổ sung/đổi scope; đề xuất tái vào entry nhưng không tạo session mới hay hỏi lại cùng goal cho mỗi lượt |
| Nhiều goal | Một session có thể chứa bao nhiêu goal; quan hệ goal nối tiếp/song song |
| Xác nhận | Binding với goal version và message người dùng; cách xử lý read-only, xác nhận có sẵn và bank đã duyệt |
| Goal native | Cách liên kết với cơ chế goal của Codex/Claude nếu host hỗ trợ |

#### Bằng chứng cần có khi triển khai sau khi chốt spec

- [ ] Prompt đầu đi qua entry thật, tạo đúng session người dùng trước confirmation; không chỉ thêm một lời nhắc trong Markdown.
- [ ] Goal chưa xác nhận hoặc approval không khớp version bị chặn thực thi; có case đồng ý, sửa, từ chối và chưa trả lời.
- [ ] Follow-up/resume giữ đúng session binding; agent con không tạo thêm session người dùng.
- [ ] Hai session khác nhau không dùng lẫn scope, quyết định hoặc quyền.

**Trạng thái R01:** yêu cầu đã được ghi nhận; chi tiết thiết kế còn đang specify; chưa implement hoặc đánh dấu đạt.


### R02. Kết thúc session thành công → compact vào `.worktrees/done` → dọn hồ sơ tạm

**Đề xuất của thầy, đang phản biện; chưa chốt cơ chế và chưa triển khai:** khi session kết thúc thành công, xóa hồ sơ session đang chạy và chỉ giữ một bản compact nhỏ trong `.worktrees/done`.

#### Hướng đề xuất

- [ ] Ghi bản chốt vào `.worktrees/done/{session-id}.md` trước, đọc lại kiểm tra lưu thành công rồi mới xóa đúng `sessions/{session-id}`. Đây là đường dẫn đề xuất, cần đưa vào alias khi chốt spec.
- [ ] Phân biệt `goal đạt`, `operator hoàn thành`, `git.publish thành công` với `session người dùng kết thúc`. Theo R01, một agent hoàn thành không được tự kết thúc session người dùng.
- [ ] Chỉ dọn dữ liệu tạm thuộc session đã đóng thành công; không xóa toàn bộ `sessions/`, session khác hoặc registry dùng chung. Session đang blocked, failed hoặc chờ người dùng giữ dữ liệu để tiếp tục.
- [ ] Tách việc dọn hồ sơ runtime khỏi việc xóa worktree/branch của người dùng. Một kết quả thành công không tự cấp quyền xóa workspace đang được người dùng sử dụng.
- [ ] Đưa đầu ra cần bàn giao và bằng chứng còn được tham chiếu ra nơi giữ lâu dài trước khi dọn. Bản compact không được trỏ vào file sắp bị xóa.
- [ ] Cleanup có thể chạy lại an toàn: nếu ghi compact, giữ artifact hoặc kiểm tham chiếu chưa thành công thì giữ session; lần chạy lại không ghi đè kết quả của session khác.

#### Compact nhỏ nhưng đủ kiểm lại

Đề xuất một bản chốt khoảng 10–20 dòng; không giữ toàn bộ hội thoại hay log vào đây.

| Phần | Nội dung tối thiểu |
| --- | --- |
| Nhận diện | Session ID, host/task/worktree binding và thời điểm đóng |
| Goal và scope | Goal đã được xác nhận, version và phạm vi đã hoàn thành |
| Kết quả | Thay đổi hoặc đầu ra cụ thể; commit/PR/artifact ở địa chỉ còn tồn tại |
| Kiểm chứng | Kiểm gì, kết quả gì, giới hạn hoặc phần chưa kiểm; ref bằng chứng khi cần |
| Bàn giao | Quyết định cần nhớ và việc còn lại đã được tách khỏi scope; không gọi success nếu còn tiêu chí bắt buộc chưa đạt |

#### Điểm phải sửa hoặc làm rõ so với 2.1.4

| Điểm hiện tại | Ảnh hưởng tới đề xuất 2.2 |
| --- | --- |
| `resources/orchestrator.json#cleanup` gắn dọn session, worktree và branch với publish thành công; `alias/alias.json#@dynamic` cũng mô tả xóa session sau `git.publish` | Cần đổi cùng một chính sách vòng đời, phù hợp session người dùng của R01; không chỉ thêm một đoạn nhắc cleanup |
| Registry dùng chung ở `.worktrees/sessions/central-runtime/` | Tuyệt đối không dùng cách xóa cả thư mục `sessions/` |
| `SKILL.md` dùng `producer-import.mjs` để chuyển bằng chứng giữa các session, giữ request/response và digest | Một đoạn tóm tắt không thay được bundle mà validator/consumer còn cần; phải quyết định giữ bundle tối thiểu hoặc điều chỉnh hợp đồng import trước khi xóa nguồn |

#### Cần thầy specify tiếp

| Quyết định | Đề xuất để bàn |
| --- | --- |
| Tín hiệu kết thúc session | Chốt một sự kiện đóng session rõ ràng; không suy ra chỉ từ một lượt trả lời xong hoặc một goal đạt |
| Lưu bằng chứng | Compact ở `done/`; artifact và bundle cần tái sử dụng có nơi giữ riêng, phần tạm còn lại được dọn |
| Session mở lại | Cách tiếp tục cùng host session sau khi đã compact: tạo lượt chạy mới có liên kết với bản chốt, không làm mất lịch sử đã đóng |
| Độ bền của `done/` | Chốt có cần lưu qua máy khác/xóa workspace hay chỉ giữ tại local; đường dẫn `.worktrees/done` tự nó chưa bảo đảm backup hoặc được Git theo dõi |

**Trạng thái R02:** đã ghi đề xuất và phản biện để thầy tiếp tục specify. Chưa sửa runtime, chưa xóa session/worktree/branch và chưa nâng version.


### R03. Mỗi operator: expected trước → thực thi → actual → đối chiếu → sửa/retry

**Yêu cầu của thầy:** trước khi làm, từng operator phải ghi expected; sau khi làm phải kiểm actual có đáp ứng expected không. Không đạt thì retry hoặc sửa, rồi kiểm lại.

- [ ] Mọi lần chạy operator, kể cả bước chuẩn bị và lần retry, có expected được ghi trước khi bắt đầu thực thi; chỉ rõ nó phục vụ goal nào hoặc cung cấp đầu vào cho bước nào.
- [ ] Expected mô tả kết quả quan sát được, điều kiện đạt và cách kiểm. Actual ghi kết quả thực tế cùng bằng chứng của chính lần chạy đó.
- [ ] Đối chiếu theo từng tiêu chí; chỉ chuyển kết quả sang bước phụ thuộc khi các tiêu chí bắt buộc đã đạt và kiểm chứng hợp lệ. Có file đầu ra hoặc agent báo “done” chưa đủ chứng minh đạt.
- [ ] Khi không đạt, ghi rõ phần lệch, thực hiện sửa/retry phù hợp rồi kiểm lại. Giữ dấu vết lần trước và thay đổi của lần sau; không ghi đè một lần thất bại thành thành công.

#### Bảng mỗi lần chạy cần thể hiện — đề xuất hình thức, chưa chốt schema

| Tiêu chí | Expected — ghi trước | Actual — ghi sau | Bằng chứng | Kết luận / bước tiếp |
| --- | --- | --- | --- | --- |
| Một kết quả cần đạt | Hành vi/đầu ra và điều kiện đạt cụ thể | Điều đã quan sát hoặc chưa kiểm được | Artifact, phép kiểm, kết quả chạy tại đúng revision/environment | Đạt, chưa đạt hoặc chưa đủ bằng chứng; sửa gì/kiểm gì tiếp |

“Match” là đáp ứng tiêu chí, không buộc nội dung sinh ra giống từng chữ. Expected không chỉ là danh sách thao tác đã làm.

#### Đề xuất để vòng lặp có ý nghĩa

- Giữ expected đã chốt theo lần chạy/version; không hạ tiêu chí sau khi thấy actual để hợp thức hóa kết quả. Nếu hiểu sai expected hoặc goal thay đổi, ghi lý do, tạo phiên bản kế tiếp và giữ lịch sử; đổi goal/scope cần xác nhận theo R01.
- Orchestrator đối chiếu receipt đã qua validator/cơ chế kiểm phù hợp. Tác vụ định tính dùng rubric và dẫn chứng rõ; không mặc định lời tự chấm của operator là bằng chứng đủ.
- Orchestrator điều phối retry hoặc chuyển operator sở hữu phần lỗi để sửa; không mở rộng quyền của operator chỉ để vượt lỗi. Lỗi tạm thời có thể retry, lỗi sản phẩm cần sửa, lỗi điều kiện bên ngoài giữ blocked đến khi điều kiện đổi.
- Không lặp vô hạn cùng lỗi và cùng cách làm. Chính sách retry/budget cần specify tiếp; **con số 3 thầy nêu là giới hạn parallel, không phải số lần retry**.

**Đối chiếu nền 2.1.4:** đã có `request.json.goal`, `response.json.goalCheck`, kiểm request/response và validator riêng của operator. R03 cần kiểm mức bao phủ cho mọi lần chạy và đối chiếu expected/actual cụ thể; không coi việc thêm một bảng vào Markdown là đã thực thi được yêu cầu.

### R04. Tối đa 3 nhánh song song, môi trường isolated rõ ràng

**Yêu cầu của thầy:** luôn tối đa 3 nhánh chạy song song; từng nhánh có môi trường tách biệt, được xác định rõ.

- [ ] Scheduler thực thi giới hạn concurrency; nhánh vượt giới hạn phải chờ. Tối đa không có nghĩa là bắt buộc luôn chạy đủ số nhánh.
- [ ] Chỉ chạy song song những nhánh đủ đầu vào và không xung đột tài nguyên. Nhánh phụ thuộc kết quả chưa kiểm xong phải đợi.
- [ ] Trước dispatch, mỗi nhánh có binding môi trường và phạm vi tác động; làm rõ source/worktree, revision đầu vào, tài nguyên được đọc/ghi và nơi lưu đầu ra.
- [ ] Cô lập các tài nguyên mà nhánh thực sự sử dụng: thư mục/branch ghi source, process/port, container/volume, database/schema/namespace dữ liệu, browser context và artifact/log. Mục không dùng ghi không áp dụng; không bắt mọi operator dựng một stack đầy đủ.
- [ ] Khi tài nguyên dùng chung không thể cô lập, phải điều phối quyền sử dụng và chạy tuần tự phần có xung đột; không gọi môi trường đó là riêng chỉ vì tên folder khác nhau.

#### Cách tính và vòng đời — đề xuất cần chốt

- Một bộ đếm chung cho công việc đang thực thi thuộc session người dùng, tính cả nhánh sửa lỗi và trao đổi lồng nhau; không cho mỗi agent con tự mở thêm một hạn mức riêng. Cần chốt cách tính operator inline/orchestrator và phạm vi giữa nhiều session người dùng.
- Nhánh đang chờ không được giữ slot theo cách khiến công việc cần để gỡ chờ không thể chạy. Trạng thái task và quyền chiếm tài nguyên phải được quản lý riêng.
- Nhánh/agent/môi trường con thuộc session của R01; không trở thành một session người dùng mới. Đầu ra được chuyển qua artifact/ref rõ ràng; nếu có bước tích hợp thì kiểm lại kết quả tích hợp trước khi kết luận goal đạt.

**Đối chiếu nền 2.1.4:** `resources/orchestrator.json#maxConcurrentAgents` và `workflows/README.md` đã nêu parallel cap, cấm hai writer cùng alias trong một step. Cần rà soát enforcement thực tế và isolation ngoài source; tái sử dụng/chỉnh cơ chế hiện có khi triển khai, không tạo một giới hạn trùng lặp khác.

### R05. Workflow dựng động từ goal đã được xác nhận

**Yêu cầu của thầy:** workflow phải được xây dựng dynamic dựa vào goal.

- [ ] Từ goal, scope và điều kiện đạt đã xác nhận, xác định đầu ra cần chứng minh; chọn operator sở hữu từng đầu ra rồi nối các bước cung cấp đầu vào cần thiết.
- [ ] Trình workflow cụ thể của session: bước nào, operator nào, expected gì, phụ thuộc ai, môi trường nào; chỉ ra nhánh có thể chạy song song theo R04.
- [ ] Chỉ đưa vào workflow các bước có lý do phục vụ goal hoặc dependency bắt buộc. Không áp một chuỗi cố định cho mọi prompt hoặc dùng ví dụ workflow làm mặc định.
- [ ] Khi actual cho thấy cần sửa, thêm prerequisite hoặc đổi cách thực hiện, cập nhật workflow theo kết quả đã kiểm; ghi lý do và version, giữ phần đã chứng minh còn hiệu lực, kiểm lại phần bị thay đổi ảnh hưởng.
- [ ] Workflow kết thúc dựa trên điều kiện đạt của goal, không chỉ vì đã chạy hết danh sách operator ban đầu.

**Đề xuất cách tương tác:** replan trong goal/scope đã duyệt được tiếp tục tự động; không hỏi xác nhận từng operator. Khi cần đổi goal/scope hoặc vượt quyền đã được cấp thì đưa phần thay đổi ra cho người dùng quyết định.

**Đối chiếu nền 2.1.4:** `workflows/README.md`, `scripts/plan-chain.mjs` và `scripts/validate-chain.mjs` đã quy định derive/replan từ mission. Khi triển khai cần nối chúng với session/goal mới và expected/actual của R03, đồng thời kiểm chúng thực sự điều khiển dispatch.

#### Luồng tổng hợp để tiếp tục specify

`User prompt → StarCi → mở/khôi phục session người dùng → trình goal/scope → xác nhận goal → dựng workflow động → ghi expected + binding môi trường → thực thi theo giới hạn parallel → thu actual + bằng chứng → đối chiếu → đạt thì chuyển bước / chưa đạt thì sửa hoặc retry và kiểm lại → kiểm toàn bộ goal → khi session đóng thành công, compact và cleanup theo R02 (còn đang đề xuất).`

#### Bằng chứng cần có khi triển khai R03–R05

- [ ] Không có expected trước thực thi thì không dispatch; actual thiếu bằng chứng hoặc trượt tiêu chí bắt buộc thì không được advance như đã đạt.
- [ ] Case mismatch dẫn tới sửa/retry có lưu lịch sử và kiểm lại; sửa expected sau khi chạy không làm receipt cũ tự đạt.
- [ ] Scheduler giữ đúng cap cả khi có nhánh lồng nhau; tài nguyên xung đột được chờ/cô lập, dữ liệu của nhánh này không làm sai kết quả nhánh kia.
- [ ] Những goal khác nhau tạo workflow phù hợp khác nhau; dependency chưa đạt không được tiêu thụ; replan giữ goal/scope và lịch sử, hoặc yêu cầu xác nhận khi goal thay đổi.

**Trạng thái R03–R05:** yêu cầu đã ghi nhận; các phần đánh dấu đề xuất còn để thầy specify. Chưa implement, chạy nghiệm thu hoặc nâng version 2.2.


### R06. Đọc toàn bộ operator/helper hiện tại, nâng cấp thành clear flow thống nhất

**Yêu cầu của thầy, đã làm rõ qua follow-up:** đọc tất cả operator và helper hiện tại, rồi nâng cấp từng mục thành clear flow: thao tác chuẩn, rõ từng bước và từng trường hợp, không phải prompt chung chung. Đây là phạm vi triển khai 2.2; tiếp tục ghi spec theo chỉ dẫn trước đó của thầy, không coi bản TODO là runtime đã được nâng cấp.

- [ ] Kiểm kê mọi `operators/*/operator.json` và `helpers/*/helper.json`; đọc đầy đủ file thủ tục và metadata của từng mục, ghi file list/fingerprint để đối chiếu. Lần kiểm kê hiện tại có 25 operator và 1 helper (`generate-banks`); mỗi mục có một hàng theo dõi nâng cấp, không chỉ sửa UAT/audit làm đại diện. Khi triển khai lấy danh sách thật từ registry và phát hiện mục mới, không đóng cứng số này thành luật.
- [ ] Chuẩn hóa một cấu trúc thủ tục chung, nhưng viết hành động cụ thể theo trách nhiệm của từng operator. Workflow được dựng động theo R05; thủ tục và hợp đồng bên trong mỗi operator phải rõ, thống nhất và kiểm được.
- [ ] Mỗi bước ghi: thứ tự, điều kiện đầu vào, dữ liệu cần đọc, hành động, expected, output/bằng chứng cần có, cách kiểm actual và nhánh tiếp theo khi đạt/không đạt.
- [ ] Ghi rõ trường hợp dữ liệu đã có, chưa có, đã có nhưng sai/hết hiệu lực; khi nào tái sử dụng, cập nhật, tạo mới hoặc chuyển operator sửa. Một chữ “preflight”, “verify”, “ensure” không thay được thủ tục.
- [ ] Expected/actual, retry history, environment binding và coverage phải có hợp đồng và validator; không chỉ xuất hiện trong lời nhắc hoặc một đoạn Markdown. Áp dụng cho helper theo đúng phạm vi công việc hỗ trợ, không trao cho helper quyền thao tác sản phẩm của operator.
- [ ] Khi triển khai, cập nhật đồng bộ operator.md, mirror, schema/kind, route/stop, validator, self-test và file được sinh ra có liên quan. Tiêu chí hoàn thành là hành vi chạy đúng, không chỉ đủ file.

#### Danh sách đối chiếu toàn bộ operator — hướng thủ tục cần đặc tả khi triển khai

Các chuỗi dưới đây là đề xuất khung kiểm kê cho 2.2, không khẳng định operator hiện tại đã làm đủ hoặc chuyển quyền cho operator khác.

| Operator hiện có | Thủ tục cần làm rõ và bằng chứng kết thúc |
| --- | --- |
| `environment.preflight` | Đọc goal/route/environment → kiểm từng điều kiện cần dùng → phân loại ready/thiếu/sai → báo đủ điều kiện chưa đạt và operator xử lý; chỉ ready khi các kiểm tra bắt buộc có kết quả thực |
| `workspace.bind` | Xác định route khai báo → kiểm checkout/head/quyền ghi → gắn đúng môi trường → xác minh binding; đường dẫn gần giống không được nhận nhầm |
| `business.decide` | Đọc yêu cầu và quyết định đã có → đối chiếu còn hiệu lực → làm rõ actor/quy tắc/kết quả mong đợi → kiểm tình huống và ghi quyết định trong goal đã duyệt |
| `architecture.decide` | Đọc ràng buộc/quyết định hiện có → so phương án theo tiêu chí → chọn theo R11 → ghi ranh giới dữ liệu, dependency và cách chứng minh |
| `backend.plan` | Kiểm contract/module đã có → xác định phần giữ/sửa/thêm → chia đơn vị công việc và dependency → kiểm từng đơn vị gắn với goal |
| `backend.generate` | Đọc contract và source đúng revision → viết expected → sửa đúng phạm vi → chạy kiểm hành vi → xuất thay đổi cùng kết quả và phần chưa đạt |
| `interface.plan` | Kiểm route/page/modal/state hiện có → lập inventory từ goal → gắn nội dung/dữ liệu/trạng thái → chia đơn vị và ma trận kiểm; không để màn cần cho goal biến mất |
| `interface.generate` | Đọc đủ knowledge/Grammar cần dùng → lập và render phương án → đánh giá/chọn theo R11 → áp dụng trong owner đúng → bàn giao source, ảnh và claims để audit |
| `interface.fix` | Đọc finding cùng bằng chứng → xác định nằm trong phạm vi fix hay cần generate/owner khác → sửa → kiểm lại đúng lỗi và phần bị ảnh hưởng |
| `interface.audit` | Thực hiện đầy đủ inventory/read/coverage/capture/measure/rubric/route-repair theo R08–R09; không sửa ngay đối tượng mình đang chấm |
| `data.plan` | Kiểm schema và fixture có sẵn → xác định dữ liệu đầu vào từng case → lập JSON/SQL phù hợp, namespace và cách thu hồi → kiểm plan không tạo sẵn kết quả đang cần test |
| `data.seed` | Kiểm fixture/namespace đã có → reuse hoặc upsert phần cần thiết → kiểm dữ liệu đã ghi → xuất receipt và danh sách thuộc quyền cleanup |
| `identity.provision` | Kiểm tài khoản đúng environment/alias đã có và còn dùng được → reuse hoặc tạo/sửa phần thiếu → kiểm role, membership và đăng nhập sản phẩm → xuất account refs |
| `runtime.serve` | Kiểm runtime đang phục vụ gì → reuse nếu đúng điều kiện, cập nhật nếu head/config đổi → kiểm health và revision → xuất endpoint, identity runtime và quyền sử dụng tài nguyên |
| `service.operate` | Kiểm service khai báo đã chạy/chưa/sai cấu hình → thao tác phần cần thiết → kiểm health và chức năng mà goal cần → xuất endpoint và trạng thái thực |
| `quality.verify` | Đọc các gate dự án yêu cầu → xác định revision và baseline → chạy đúng gate → đối chiếu expected/actual → route lỗi về owner; gate chưa chạy không được tính pass |
| `uat.plan` | Kiểm flow/case đã tồn tại → reuse/update/create theo goal → lập actor, precondition, sheet case, expected và dependency tài khoản/dữ liệu |
| `uat.verify` | Thực hiện quy trình phân nhánh ở R07 trên revision/environment đã bind; xuất actual, capture và verdict từng case; lỗi đưa về owner rồi chạy lại |
| `api.verify` | Kiểm suite/case, endpoint, identity và seed đúng namespace → gọi API theo case → đối chiếu response/hành vi thực → lưu run và route lỗi về owner |
| `library.update` | Kiểm library owner, version và lỗi tái hiện → sửa package chủ sở hữu → kiểm/release theo scope → cập nhật consumer đúng version → kiểm lại hành vi tại consumer |
| `migration.release` | Kiểm migration đã áp dụng/chưa và target → xác nhận tập cần chạy → thực thi đúng phạm vi → đối chiếu schema/trạng thái thực; đã áp dụng không chạy lặp mù |
| `release.deploy` | Kiểm artifact, môi trường và release hiện tại → thực thi release được giao → kiểm revision/health/hành vi sau deploy → xử lý phục hồi theo hợp đồng của release |
| `business.reconcile` | Đối chiếu từng lời hứa/điều kiện đạt với delivery và bằng chứng → ghi đạt/chưa đạt/chưa kiểm → không công bố implemented khi phần bắt buộc chưa được chứng minh |
| `content.generate` | Kiểm nội dung, schema và nguồn đã có → xác định giữ/sửa/thêm → viết theo mẫu được giao → kiểm cấu trúc, tính đúng, dẫn dắt và hoạt động học → xuất bài cùng evidence |
| `git.publish` | Kiểm thay đổi/receipt/gate và target → tích hợp theo chính sách Git → kiểm kết quả tích hợp → publish trong scope → đọc lại commit/ref kết quả; không tự đóng session chỉ vì publish xong |
| helper `generate-banks` | Đọc route/head, unchecked/findings/UAT/API/business/notes → kiểm bank đã có, mission trùng và approval/status đang dùng → gộp/cập nhật/tạo draft theo evidence → xếp dependency/priority → kiểm queue và ghi helper-run; không ghi đè approval hoặc tiến độ đang chạy như một draft mới |

**Điểm helper cần specify thêm:** `generate-banks` hiện thuộc support layer “không mở session”, trong khi R01 định nghĩa mọi prompt đi qua session người dùng. Cần liên kết helper run với host session mà không biến helper thành operator hay tạo session người dùng mới. Thủ tục cũng cần nói rõ nhánh không có mission (`BANK_EMPTY`) vẫn báo điều đã đọc/không tìm thấy, phần nào được ghi run record, và cách tái chạy không làm mất queue/approval/status đã tồn tại.

### R07. UAT: kiểm đã tồn tại → identity → dữ liệu/sheet → chạy luồng → sửa và kiểm lại

**Yêu cầu của thầy:** UAT phải có quy trình cụ thể từ kiểm UAT đã tồn tại hay chưa, xử lý account, tạo JSON/SQL/sheet rồi đi vào luồng; không nhảy thẳng vào browser hoặc dừng ở yêu cầu người dùng tự chuẩn bị phần hệ thống có thể làm.

| Bước | Kiểm và nhánh xử lý | Expected / bằng chứng cần có |
| --- | --- | --- |
| 1. Bind | Gắn goal, feature/flow, environment, revision FE/BE, endpoint và namespace của lần chạy | Biết chính xác đang kiểm sản phẩm nào, bản nào, dữ liệu thuộc lần chạy nào |
| 2. Kiểm hồ sơ UAT | Có flow/case: đọc định nghĩa, account refs, seed, baseline, latest/history; đối chiếu với goal hiện tại. Còn đúng thì reuse; lệch thì lập revision mới. Chưa có: `uat.plan` tạo từ template. History cũ giữ nguyên | Flow/case đầy đủ và còn hiệu lực; không tạo bản trùng chỉ vì có run mới, không lấy pass cũ thay lần kiểm hiện tại |
| 3. Chuẩn bị identity | Với từng actor: kiểm account có ở đúng environment, role/membership đúng, credential ref dùng được và login thật. Đã hợp lệ thì reuse; thiếu/sai thì `identity.provision` tạo/sửa rồi verify. Tái sử dụng account vẫn phải đáp ứng isolation R04 | Account theo alias đã đăng nhập được với quyền cần cho case; hồ sơ lưu refs, không chép giá trị secret vào sheet |
| 4. Lập dữ liệu và sheet | `data.plan` đối chiếu precondition với dữ liệu hiện có; viết fixture JSON hoặc SQL phù hợp backend. Sheet liệt kê case/actor/precondition/input/thao tác/expected/cách kiểm/cleanup; JSON và SQL không phải hai bản nguồn bắt buộc phải lặp cùng thông tin | Dữ liệu chỉ chuẩn bị đầu vào; sheet có expected trước khi chạy và liên kết tới fixture tương ứng |
| 5. Seed và kiểm readiness | `data.seed` áp dụng idempotent trong namespace riêng, kiểm kết quả. Runtime/endpoint/revision hoặc gate chưa đạt thì route operator phụ trách xử lý rồi quay lại | Seed receipt, identity và runtime đủ điều kiện; không dùng database rỗng để giả lập một luồng cần dữ liệu |
| 6. Freeze và vào luồng | Chốt snapshot các case, expected, revisions, account refs và seed fingerprint; mở browser context riêng, đăng nhập và thao tác qua UI theo bước | Hành động thực đi qua sản phẩm; không gọi thẳng API/SQL thay bước UI đang cần chứng minh |
| 7. Ghi actual | Thu actual, screenshot/trace và kết luận từng assertion; cập nhật sheet Expected/Actual/Evidence/Verdict | Case chưa tới hoặc thiếu evidence ghi chưa kiểm/chưa đủ bằng chứng; không tính là pass |
| 8. Sửa và retry | Phân loại lỗi sản phẩm, identity, data, runtime, knowledge hay Grammar → orchestrator gọi đúng owner sửa theo R09 → rebind → chạy lại case lỗi và những case bị ảnh hưởng trong run mới | Kết quả trước/sau kiểm được; expected và history của run cũ không bị viết lại |
| 9. Bàn giao và thu hồi fixture | Tổng hợp đủ case bắt buộc, cập nhật latest/history, xuất sheet cho người dùng; thu hồi đúng dữ liệu của run theo quy trình UAT | Có report thực, case coverage đầy đủ và cleanup được kiểm; không xóa history hoặc account chỉ vì đã tái sử dụng nó |

**Đối chiếu nền 2.1.4:** `uat.verify` đã có flow folder, account handoff, snapshot trước thực thi và lịch sử append-only; phải làm rõ nhánh reuse/update/create và liên kết các operator trong workflow thật. Chốt tên/định dạng “sheet” khi triển khai: cần bản dữ liệu đọc được bằng máy và bản bảng người dùng đọc được, chưa mặc định phải là XLSX.

### R08. Visual audit phải kiểm đủ knowledge và chất lượng bố cục thực tế

**Yêu cầu của thầy:** kiểm kỹ từng file knowledge, tuyệt đối không sót; giao diện phải đạt chất lượng thị giác theo ảnh tham chiếu, bố cục đẹp, không có khoảng trống vô ích.

- [ ] Lập inventory toàn bộ knowledge cần xét cho visual audit và dependency của chúng: composition, presentation, proof, Grammar/family, references/calibration và nguồn mà rule dẫn tới. Inventory được phát hiện từ source; không chỉ chọn vài file agent nhớ tên.
- [ ] Mỗi file có path, fingerprint/version, reader/owner và trạng thái xử lý; mọi file thuộc phạm vi phải được đọc. Mỗi rule có một hàng coverage nối tới expected, surface/state/viewport, actual, evidence và verdict.
- [ ] Coverage được đối chiếu với manifest sinh từ cây knowledge gồm file, rule và từng case, không chỉ với danh sách rule agent tự chọn. Bao gồm tài liệu chỉ dẫn, dependency và calibration assets thuộc phạm vi. Thiếu/stale mục thì chưa hoàn tất; một candidate cũng phải được chấm đủ tiêu chí áp dụng.
- [ ] Bao phủ file và bao phủ rule được kiểm riêng: đọc đủ file chưa chứng minh đã áp dụng đủ rule. Rule ngoài phạm vi phải ghi rõ lý do không áp dụng và nơi chịu trách nhiệm; không dùng một câu “n/a toàn bộ” để bỏ qua topic. Rule chưa kiểm hoặc thiếu evidence giữ trạng thái chưa hoàn tất, không tự pass.
- [ ] Kiểm toàn bộ knowledge trong phạm vi không đồng nghĩa tự mở rộng goal sang mọi sản phẩm/màn hình. Mọi surface/state cần cho goal phải có bằng chứng; phần ngoài scope vẫn được trình bày đúng mức bao phủ, không nhận là đã audit toàn bộ ứng dụng.
- [ ] Chụp giao diện thật trên các trạng thái/viewport cần kiểm, có dữ liệu đại diện; đo layout và giá trị liên quan, xem cả toàn trang lẫn từng vùng. Screenshot đẹp của một viewport không thay được kiểm responsive hoặc tương tác.
- [ ] Chấm riêng tính đúng theo rule và chất lượng thị giác: hierarchy, tỷ lệ cột, mật độ nội dung, nhịp đọc, alignment, typography, màu/accent, consistency, overflow và cách các vùng hỗ trợ tác vụ. “Build pass” hoặc “đúng token” không đủ để gọi đẹp.
- [ ] Khoảng cách phục vụ đọc và phân nhóm được giữ; vùng rỗng vô ích, card quá cao, sidebar rỗng hoặc chiều rộng không tương xứng với nội dung phải có finding. Không nhồi thêm chữ hoặc hình trang trí chỉ để lấp chỗ trống.
- [ ] Verdict phải đi kèm coverage theo file/rule, ảnh/sheet và finding cụ thể để người dùng xem; thiếu mục trong inventory khiến audit chưa hoàn tất.

**Ảnh tham chiếu của thầy:** StarCi Academy v2, nền trung tính và accent tím; ba vùng mục lục–bài học–thực hành; vùng bài học đủ rộng, lý thuyết nối tiếp sơ đồ và code, bài tập nằm cạnh nội dung, tiến độ và nút tiếp tục rõ. Tham chiếu dùng để đối chiếu cách tổ chức nội dung và chất lượng bố cục; không áp ba cột cho mọi loại màn hình. Bản ảnh bàn giao đi kèm hồ sơ spec tên `starci-2.2-visual-reference.png`. Đây là reference thiết kế, không phải bằng chứng HTML hiện tại đã đạt.

### R09. Knowledge/Grammar sai → operator sửa đúng nguồn → retry

**Yêu cầu của thầy:** phát hiện knowledge sai thì chạy operator sửa knowledge rồi retry; Grammar sai thì chạy operator sửa Grammar rồi retry. Luồng phải tự điều phối việc sửa trong goal đã được giao.

| Loại lỗi đã xác định | Đường xử lý cần có |
| --- | --- |
| Application không tuân rule/Grammar đúng | `interface.fix` hoặc `interface.generate` theo phạm vi lỗi → kiểm thay đổi → serve/bind revision mới → audit/UAT lại |
| Rule/knowledge sai, mâu thuẫn hoặc thiếu | Ghi counterexample và rule/file bị ảnh hưởng → operator sở hữu cập nhật knowledge → kiểm consistency/citation/contract cùng các tình huống bị ảnh hưởng → xuất revision mới → các consumer đọc lại → audit/retry |
| Grammar/library triển khai sai contract đúng | Bind checkout chủ sở hữu → `library.update` sửa ở package → kiểm và phát hành/tiêu thụ theo scope → pin consumer vào bản đúng → serve lại → audit cả lỗi ban đầu và vùng bị ảnh hưởng |
| Dữ liệu/runtime/identity sai | `data.plan`/`data.seed`, `runtime.serve`/`service.operate` hoặc `identity.provision` xử lý đúng loại → kiểm readiness → retry bước tiêu thụ |

- [ ] Knowledge repair phải là một route tới operator có trách nhiệm, quyền ghi và receipt rõ. Chưa chốt ID/package cho owner này; không gọi một operator giả định như thể hiện đã có trong registry.
- [ ] Auditor ghi bằng chứng lỗi, không tự sửa rule rồi tự chấm lại trên cùng receipt. Operator sửa không được hạ chuẩn chỉ để làm kết quả trước đó pass.
- [ ] Mỗi lần sửa ghi source/version trước-sau, lý do, evidence và phần consumer bị ảnh hưởng. Khi knowledge hoặc Grammar đổi, expected của lần tiếp theo có phiên bản mới theo R03; giữ nguyên đánh giá cũ, kiểm lại các kết luận bị thay đổi làm mất hiệu lực.
- [ ] Không vá đè ở consumer để che lỗi thuộc Grammar, không bỏ một rule khỏi inventory để né lỗi knowledge. Retry phải thực sự đọc nguồn đã sửa và đo lại kết quả đã cập nhật.

### R10. Phân agent theo loại công việc và profile rõ ràng

**Ghi đúng lựa chọn thầy nêu; chưa tự thay tên model:**

| Nhóm công việc | Model thầy yêu cầu | Trách nhiệm điển hình |
| --- | --- | --- |
| Cần nhiều suy luận, phân tích và đánh giá | Fable / Sol | Lập plan, quyết định phương án, audit, đối chiếu expected/actual, phân tích nguyên nhân và tính đúng của knowledge |
| Thực thi công việc | Sol / Opus | Viết/sửa source, nội dung, fixture, cấu hình, sửa knowledge/Grammar theo nhiệm vụ đã xác định, chạy thao tác được giao |

- [ ] Map từng operator/nhóm nhiệm vụ sang profile cụ thể trong runtime; không chỉ nói chung “agent mạnh/agent thường”. Operator có nhiều vai trò cần tách rõ phần quyết định và phần thực thi khi thiết kế, thay vì trộn quyền đọc/chấm/sửa vào một agent.
- [ ] Sol có thể thuộc cả hai nhóm; hai vai trò vẫn có context, quyền và receipt riêng. Người đánh giá nhận output/evidence cần kiểm, không mặc định tin lời giải thích của người tạo.
- [ ] Profile thực tế đã chạy phải được ghi lại; model không khả dụng cần policy fallback được xác định, không im lặng đổi model. Mọi nhóm cùng tuân giới hạn và isolation R04.

**Điểm cần đồng bộ khi triển khai:** hiện `resources/agents/profiles` và `orchestrator.json#profileEquivalents` map Fable ↔ Astra cho đọc/chấm, Opus ↔ Sol cho thực thi. Lời thầy ở yêu cầu này là Fable/Sol cho nhóm suy luận; ghi nguyên văn, không tự sửa thành Fable/Astra. Chốt model ID/provider, reasoning và mapping cụ thể khi hoàn thiện spec; không đổi cấu hình trong lượt này.

### R11. Tuyệt đối không dừng chỉ vì các phương án tied

**Yêu cầu của thầy:** nếu phương án ngang điểm, luồng phải tự chọn và tiếp tục; không dừng để yêu cầu người dùng xử lý tie.

- [ ] Có policy chọn tự động được ghi trước khi so phương án, dùng nhất quán trong mọi operator có xếp hạng/chọn phương án; lưu scores, tiêu chí quyết định và phương án được chọn.
- [ ] Khi nhiều phương án hợp lệ ngang điểm, áp dụng thứ tự ưu tiên đã định. Đề xuất: đáp ứng goal và tiêu chí quan trọng hơn → khớp hướng/reference/Grammar đã được chọn → ít phức tạp và chi phí thực thi/bảo trì hơn → thứ tự ổn định nếu vẫn tương đương. Thứ tự cụ thể còn để thầy specify.
- [ ] Không sinh câu hỏi “thầy chọn A hay B?” hoặc route user chỉ vì tie; không kéo dài việc đo/chạy ứng viên mãi để tránh tự quyết. Cần thêm bằng chứng thật sự thì thu đúng bằng chứng cần phân biệt rồi chọn theo policy.
- [ ] Hai phương án cùng trượt tiêu chí bắt buộc không trở thành hợp lệ vì ngang điểm: sửa/tạo phương án đạt rồi kiểm lại theo R03. Tự chọn không có nghĩa tự ghi pass.
- [ ] Goal/scope và quyết định người dùng đã chốt vẫn là đầu vào. Policy tie không đổi scope hoặc ghi đè lựa chọn đã có; vướng quyền hay thiếu dữ kiện bắt buộc phải được ghi đúng nguyên nhân, không gắn nhãn tie để né tự quyết.

**Đối chiếu nền 2.1.4:** `interface.generate` đã có fallback khi `selectionPolicy=automatic`, nhưng còn nhánh `approval-required` / `DIRECTION_CHOICE_REQUIRED` cho lựa chọn direction. Phải rà soát đường chạy và mọi operator có tie để policy không dừng được thực thi trong scope đã giao; không chỉ thêm câu “never stop if tied” vào entry.

#### Bằng chứng cần có khi triển khai R06–R11

- [ ] Registry đối chiếu được mọi operator với thủ tục, schema/gate và các case đã có/chưa có/sai/repair-retry; không còn operator bị bỏ quên.
- [ ] UAT chứng minh reuse flow/account hợp lệ, sửa/create phần thiếu, prepare fixture và sheet trước action, chạy luồng thật, ghi actual và retry lỗi trong run mới.
- [ ] Audit cố tình thiếu một file/rule/capture không được pass; layout trống vô ích vẫn có finding dù build/token pass.
- [ ] Một knowledge defect và một Grammar defect đi qua đúng owner, consumer nhận revision đã sửa, audit lại lỗi gốc; không tự nới tiêu chí hoặc vá che lỗi.
- [ ] Profile được dispatch và ghi receipt đúng nhóm; parallel và isolation không bị phá bởi nhánh repair.
- [ ] Case tied giữa các phương án hợp lệ tự chọn, ghi lý do và tiếp tục; case tất cả ứng viên không đạt được sửa tiếp, không hỏi chỉ vì tied.

### R12. Thẩm mỹ = ràng buộc knowledge của thầy + tư duy UI của model

**Yêu cầu thầy chốt cách hiểu:** ảnh StarCi Academy v2 là mốc chất lượng đẹp. Thẩm mỹ phải kết hợp ràng buộc knowledge của thầy với năng lực đánh giá và thiết kế UI model được huấn luyện; không chỉ máy móc làm đủ rule. Khi knowledge của thầy có vấn đề so với lập luận UI, phải đọc lại, chỉ ra vấn đề và đưa qua đường sửa knowledge.

- [ ] Khi tạo giao diện, dùng knowledge/Grammar làm ràng buộc và nền tảng nhất quán; dùng tư duy UI để tổ chức thông tin, cân tỷ lệ, tạo trọng tâm, chọn nhịp đọc và mật độ phục vụ tác vụ. Không buộc mọi màn hình giống hệt ảnh tham chiếu.
- [ ] Khi đánh giá, có hai kết luận riêng: tuân thủ ràng buộc và chất lượng thị giác/trải nghiệm. Kết quả phải đạt cả hai ở các tiêu chí bắt buộc; điểm đẹp không bù cho sai hành vi, không đọc được hoặc bỏ qua accessibility.
- [ ] “Đúng knowledge nhưng vẫn xấu” là kết quả chưa đạt: chỉ ra vùng cụ thể và nguyên nhân, render phương án cải thiện, đối chiếu trước/sau. Không kết thúc ở câu “theo rule là đúng”.
- [ ] “Model thấy đẹp hơn nhưng lệch knowledge” phải được phân tích: sai cách áp dụng, rule ngoài phạm vi, heuristic quá cứng, rule mâu thuẫn/sai hoặc thiếu khả năng trong Grammar. Không mặc định model đúng, cũng không bỏ ý tưởng chỉ vì knowledge chưa có câu mô tả nó.
- [ ] Nếu knowledge cần sửa, lập counterexample, giải thích ảnh hưởng tới tác vụ và đề xuất rule có phạm vi rõ; owner sửa theo R09 rồi kiểm lại cả kết quả mới lẫn những trường hợp mà rule cũ đang bảo vệ. Không âm thầm bỏ rule hoặc đổi chuẩn sau khi chấm.
- [ ] Phân biệt ràng buộc sản phẩm/brand đã được thầy chốt với heuristic thiết kế có thể cải thiện. Trong một phương án có nhiều lựa chọn cùng hợp lệ, model tự quyết theo goal/reference/rubric và R11, không yêu cầu thầy chọn hộ chỉ vì tied.
- [ ] Phần nhận định UI cần dựa trên đối tượng đã render và tác vụ người dùng: bố cục, nội dung thật, thứ tự đọc, trạng thái và viewport. Nhận xét định tính ghi là nhận định kèm dẫn chứng; không biến sở thích của model thành số đo hoặc tuyên bố đã được người dùng kiểm nghiệm.

**Quy trình đánh giá tổng hợp đề xuất:** đọc đủ knowledge → hiểu tác vụ/nội dung/reference → lập phương án bằng tư duy UI trong ràng buộc → render → kiểm rule + chấm chất lượng thật → phân loại lỗi application/knowledge/Grammar → sửa đúng owner → render/audit lại → chọn và tiếp tục.

### R13. Hiểu mindset từng Grammar trước khi sửa hoặc bổ sung knowledge/Grammar

**Yêu cầu của thầy:** trước khi thêm knowledge hoặc Grammar, phải phân tích knowledge/Grammar hiện tại để hiểu mindset của từng loại/family; không thêm bừa theo một màn hình hay sở thích tức thời.

- [ ] Resolve đúng family từ route/package thực tế; đọc đầy đủ index, DNA, idioms, playbook, family definition, gaps và dependency mà chúng dẫn tới. Phân biệt tài liệu mô tả source hiện có với nhận định/công thức thiết kế; kiểm version/fingerprint trước khi dùng để hứa khả năng.
- [ ] Viết một bản phân tích ngắn trước thay đổi: family phục vụ kiểu tác vụ nào, ngôn ngữ thị giác và cách composition, hierarchy/density/spacing, states/motion/accessibility, owner Common/family/app, những điều cố ý không làm và những gap đã được ghi nhận. Mỗi kết luận dẫn về nguồn hoặc ví dụ đã đọc.
- [ ] So các family trên cùng tiêu chí khi có nhiều family; không mặc định family này là cha của family kia, không trộn token/anatomy/idiom chỉ vì nhìn hợp mắt. Nếu kho chỉ mô tả một family thì nói đúng mức biết, không suy diễn DNA family khác từ tên được nhắc tới.
- [ ] Trước khi thêm, tìm toàn bộ khái niệm tương đương và owner trong knowledge/package: dùng lại khả năng đã có → compose bằng API hiện có → sửa/mở rộng đúng rule/owner → chỉ tạo khái niệm mới khi những cách trên không đáp ứng nhu cầu đã chứng minh.
- [ ] Mỗi đề xuất thêm/sửa có gap cụ thể, bằng chứng, lý do fit với mindset family, owner đúng và tác động tới consumer/family khác. Không biến tên trang hoặc feature thành renderer/rule chung; không tạo một scale, rule hay component song song cho thứ đã có owner.
- [ ] Sửa ở nguồn chủ sở hữu rồi sinh lại tài liệu dẫn xuất; DNA được sinh từ package không bị sửa tay để mô tả một capability package chưa có. Sau đó render và kiểm kết quả với R08/R12, không chỉ kiểm shape của file.
- [ ] Nếu mindset/rule hiện tại quá cứng, mâu thuẫn hoặc gây kết quả xấu, lập phản biện và thử phương án theo R09/R12; không máy móc giữ lỗi, cũng không âm thầm thay bản sắc family. Phân biệt sáng tạo trong ràng buộc với thay đổi chính ràng buộc.

#### Mindset StarCi Core đọc được từ knowledge hiện tại — ghi nhận source, chưa xác minh package live

| Tầng/khía cạnh | Ý nghĩa hiện tại và cách mở rộng đúng chỗ |
| --- | --- |
| UI knowledge | Nguyên tắc UI dùng chung; một concept có một nơi định nghĩa, family trỏ về rule thay vì chép lại |
| Common | Sở hữu public renderer/props, semantic DOM, accessibility, cấu trúc state, geometry/responsive composition và spacing dùng chung |
| Core family | Một implementation của Common, sở hữu giá trị/theme/CSS theo family; không là cha của Common hoặc family khác |
| Product adapter | Sở hữu domain, copy, route, permission, persistence và effect; không đưa danh tính sản phẩm thành khái niệm Grammar |
| Cách composition lặp lại | Một surface chứa các band liền mạch; separator chia nội dung; summary trung tính; title và lời giải thích đi cùng; một trọng tâm hành động; pending giữ cấu trúc để tránh nhảy bố cục |
| DNA / idioms / playbook | DNA mô tả khả năng package và được sinh từ source; idioms mô tả cách dùng lặp lại; playbook nối business shape với cách composition. Ba vai trò khác nhau, không thêm cùng một luật vào cả ba |

**Nguồn đã đọc:** `knowledge/grammars/starci/INDEX.md`, `DNA.md`, `idioms.md`, `playbook.md`, `family.md`. DNA ghi snapshot `@starci/grammar@0.4.12`, không tự coi snapshot là version package live mới nhất.

**Điểm cần phản biện trong vòng nâng cấp:** playbook hiện chuyển shape chưa liệt kê, composition mới chỉ thấy một lần hoặc reference lệch idiom về owner để chọn; cần phân biệt việc chưa đủ căn cứ để gọi là house style với quyền tạo phương án mới trong goal đã duyệt. Một ý tưởng mới có thể được thử và chấm bằng R12/R11 trước khi đủ điều kiện nâng thành knowledge dùng chung. Không để catalog hữu hạn biến thành lệnh dừng mọi thiết kế mới.

#### Kết quả đọc để chuẩn bị nâng cấp

Đã rà toàn bộ file thủ tục English và metadata của 25 operator, 1 helper, cùng 40 file UI/Grammar knowledge/calibration trong inventory hiện tại. Hồ sơ đọc có file list và snapshot fingerprint; review authored procedure không đồng nghĩa đã audit hoặc chạy toàn bộ script/validator, mirror hay package Grammar live.

| Quan sát từ source | Việc cần xử lý khi triển khai |
| --- | --- |
| `data.plan` xuất seed-plan, `data.seed` chưa nhận trực tiếp kind đó; `uat.verify` vẫn có bước tự seed | Chốt một owner cho hiệu ứng seed và typed handoff xuyên plan → seed → UAT |
| Reuse runtime/seed đã cụ thể hơn reuse flow/account; helper chưa mô tả rõ cách cập nhật bank đang có approval/status | Bổ sung nhánh hiện có/chưa có/sai, tiêu chí reuse, thao tác sửa và bằng chứng giữ đúng trạng thái |
| Knowledge xuất bản `MARGIN-AUTO`, nhưng pattern `inventory.ruleIds` chỉ nhận ID kết thúc bằng số | Sửa hợp đồng biểu diễn/extract rule cho nhất quán; không bỏ một rule khỏi audit để làm inventory hợp lệ |
| Measure trong presentation dùng 65ch, DNA Core có reading measure 72ch | Kiểm owner, scope và source/render trước khi kết luận xung đột; không tùy chọn một số theo sở thích |
| `TASTE-2` đã cho phép khoảng cách có chức năng phân nhóm hoặc nghỉ đọc | Không đọc nhầm threshold thành lệnh cấm mọi khoảng trắng; nếu kết quả xấu, kiểm cách áp dụng/đo trước khi sửa rule |
| Workflow động, parallel cap và route là cơ chế chung; một số operator chỉ có quyền đọc/chấm | Clear flow phải dẫn về owner đúng; không sao chép cap vào từng op, không cho verifier tự sửa nguồn hay tự đổi goal |

**Trạng thái R06–R13:** yêu cầu đã được ghi nhận; các bảng thủ tục và policy đánh dấu đề xuất là cơ sở để thầy tiếp tục specify. Đọc và review source không đồng nghĩa đã kiểm nghiệm hành vi runtime. Chưa nâng cấp operator/helper/runtime hoặc công bố 2.2.
