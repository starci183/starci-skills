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

## 6. Tầng hỗ trợ: helper và kho nhiệm vụ (2.1.3)

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
- [ ] Chưa có: harness chưa tự nhận nhiệm vụ kế tiếp từ kho. `bank.mjs#next|markRunning|markDone` đã
      có và đã được spec, nhưng chưa vòng nào của orchestrator gọi chúng, và chưa có `SKILL.md` bước
      nào nói ai ghi `queue.json` khi một phiên mở ra hay đóng lại. Làm điều đó rồi mới ghi bằng chứng.
- [ ] Chưa có: kho `nivo-agentos` mà một phiên Astra đã viết vẫn ở hình dạng cũ
      (`index.json`/`ORDER.md`/`workflows/<id>/workflow.json`/`BRIEF.md`). 17 nhiệm vụ của nó hợp lệ
      với `banked-mission.schema.json` sau khi đổi tên và dời trường, không phải sửa nội dung nào; việc
      chuyển thật thuộc về chủ kho ấy, không phải phiên này.
