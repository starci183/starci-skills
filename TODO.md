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

## 9. StarCi 2.2 — triển khai và kiểm chứng

Thầy đã giao triển khai toàn bộ R01–R13 bằng tối đa ba agent song song và push. Ba nhánh làm việc riêng đã được tích hợp: runtime/session, quy trình operator/helper, UI/knowledge/Grammar. Version đích là **2.2.0**.

[Specification gốc](tests/evidence/20260905-starci-2.2-approved-spec.md) giữ nguyên toàn bộ yêu cầu, ví dụ, bảng thao tác và phần phản biện trước khi triển khai. Bảng dưới ghi hành vi được đưa vào bản 2.2; [hồ sơ kiểm chứng](tests/evidence/20260905-starci-2.2-release.md) phân biệt regression tự động với những gì chưa được chạy trên sản phẩm thật. Một contract kiểm được không phải tuyên bố đã UAT mọi sản phẩm dùng StarCi.

| Mục | Hành vi của 2.2 | Nơi triển khai và kiểm |
| --- | --- | --- |
| R01 — prompt/session/goal | Bootstrap vào StarCi mỗi prompt; mở hoặc dùng lại session gắn host trước confirmation; trình bảng goal, scope, đầu ra, đạt khi, phạm vi kiểm và ví dụ. Chỉ kích hoạt đúng version được duyệt; quyền đã có không hỏi lại. Worker con không mở session người dùng mới. | [Entry](SKILL.md), [open/confirm](scripts/session-open.mjs), [runtime regression](scripts/v22-runtime.spec.mjs), [installer](bin/starci-skills.mjs) |
| R02 — đóng session | Chỉ khi session được đóng thành công và đủ proof: giữ compact, request/response, frozen inputs và evidence có hash trong done; kiểm lại trước khi xóa đúng active session. Giữ worktree, branch, central-runtime và session chưa hoàn tất. Import vẫn dùng được proof đã giữ. | [Cleanup](scripts/session-cleanup.mjs), [regression](scripts/session-cleanup.spec.mjs), [producer import](scripts/producer-import.spec.mjs) |
| R03 — expected/actual | Request đóng băng expected, environment và input trước thao tác; response ghi actual, evidence và verdict từng criterion. Gate kiểm đủ trước accept; niêm phong file inventory chống sửa proof sau accept. Mismatch/retry giữ receipt trước, không hạ expected để hợp thức hóa. | [Attempt gate](scripts/attempt-gate.mjs), [evidence manifest](scripts/evidence-manifest.mjs), [request gate](scripts/validate-request.mjs), [response gate](scripts/validate-response.mjs) |
| R04 — tối đa ba worker | Một hạn mức của host session gồm cả nested exchange, helper, repair và retry. Slot và lease cấp dưới khóa chung; realpath, junction/case và quan hệ cha/con không được dùng để né xung đột. Tài nguyên dùng chung chạy tuần tự. | [Worker slots](scripts/worker-slots.mjs), [resource locks](scripts/resource-locks.mjs), [runtime regression](scripts/v22-runtime.spec.mjs) |
| R05 — workflow động | Derive từ doneWhen và typed dependency; chỉ nhận output đã kiểm. Repair thêm owner/prerequisite trong cùng host session, giữ lịch sử và phần proof còn hiệu lực; đổi scope cần goal version đã được duyệt. | [Workflow](workflows/README.md), [planner](scripts/plan-chain.mjs), [planner regression](scripts/plan-chain.spec.mjs) |
| R06 — mọi op/helper có clear flow | Nâng cấp 25 operator có sẵn và helper generate-banks; thêm owner knowledge.repair thành 26 operator. Mỗi thủ tục EN/VI ghi kiểm đã có/chưa có/sai, reuse/create/repair/handoff, tool, output, expected và gate; không chỉ prompt chung. | [Operator inventory](operators/INDEX.md), [helper inventory](helpers/INDEX.md), [all-package self-tests](scripts/run-operator-self-tests.mjs) |
| R07 — UAT chuẩn bị rồi chạy | Inspect/reuse/update/create flow; kiểm login thật và role từng actor; uat.plan xuất case sheet, data.plan xuất fixture JSON/SQL khi phù hợp, data.seed là owner seed/cleanup. Freeze trước browser action; ghi actual/assertion và mọi acted run, kể cả fail/incomplete; retry bằng run mới. | [UAT plan](operators/uat-plan/operator.md), [UAT verify](operators/uat-verify/operator.md), [identity](operators/identity-provision/operator.md), [data plan](operators/data-plan/operator.md), [data seed](operators/data-seed/operator.md) |
| R08 — coverage visual đầy đủ | Inventory chính xác file/rule/Case, dependency, catalog, calibration và family; đọc đủ, hash trước chạy. Coverage file khác coverage rule; N/A cần lý do, thiếu evidence không pass. Một candidate vẫn render và được audit. | [Knowledge manifest](scripts/knowledge-manifest.mjs), [UI gates](scripts/ui-knowledge-gate.mjs), [visual audit](operators/interface-audit/operator.md) |
| R09 — sửa đúng owner rồi retry | Knowledge defect đi knowledge.repair với counterexample và before/after exact write set. Grammar defect đi library.update ở owner, publish/consume theo scope, pin/serve revision mới và audit lỗi cũ. Không sửa consumer để che lỗi, không sửa DNA sinh tự động bằng tay. | [Knowledge repair](operators/knowledge-repair/operator.md), [library update](operators/library-update/operator.md), [routing](routing.json) |
| R10 — profile rõ | Suy luận/plan/review: Sol/Fable; thực thi: Sol/Opus. Sol có hai profile và context/grant riêng. Profile cũ chỉ phục vụ receipt lịch sử, không được gán cho operator/helper mới. Receipt ghi profile thực tế. | [Assignment table](resources/INDEX.md), [OpenAI](resources/agents/profiles/openai.json), [Claude](resources/agents/profiles/claude.json), [resource gate](scripts/validate-resources.mjs) |
| R11 — không dừng vì tie | Chỉ so phương án đạt điều kiện bắt buộc; dùng thứ tự lựa chọn ổn định đã định, ghi lý do và tiếp tục trong scope. Hai phương án cùng fail phải sửa; thiếu quyền hoặc đổi goal phải ghi đúng nguyên nhân, không gọi là tie. | [Interaction policy](resources/interaction.md), [interface generation](operators/interface-generate/operator.md), [generation validator](operators/interface-generate/validate.mjs) |
| R12 — thẩm mỹ kết hợp | Knowledge của thầy là ràng buộc; model dùng tư duy UI để tổ chức nội dung, tỷ lệ, nhịp đọc, mật độ và trọng tâm. Chấm riêng compliance và chất lượng nhìn trên render. Hình làm nổi bật ý chính, giải thích hoặc tạo điểm nhấn có chủ đích; không dùng để lấp khoảng trống. Không áp ba cột cho mọi màn. | [UI generation](operators/interface-generate/operator.md), [audit](operators/interface-audit/operator.md), [Grammar playbook](knowledge/grammars/starci/playbook.md) |
| R13 — hiểu Grammar trước khi thêm | Bind đúng family/package; đọc index, DNA, idioms, playbook, family, gaps và dependency; viết family-understanding có source refs. Tìm owner tương đương: reuse → compose → mở rộng owner → chỉ thêm mới khi có gap chứng minh. Common sở hữu semantics/anatomy; family sở hữu style; product giữ business/effect. | [Family understanding contract](templates/kinds/family-understanding.schema.json), [UI knowledge gate](scripts/ui-knowledge-gate.mjs), [library update](operators/library-update/operator.md) |
| R14 — log The best outcome | Sau mỗi operator done đã match, hiện kết quả được chọn ngay trong chat. UI gen hiện ảnh render, code hiện source/diff, plan hiện sơ đồ/bảng/tài liệu, kiểm thử hiện kết quả và bằng chứng. Response chỉ rõ primary/secondary; renderer kiểm accepted proof trước khi hiển thị. Không chỉ báo tên file, không biến mismatch thành thành công. | [Interaction](resources/interaction.md), [presentation map](resources/outcomes.json), [renderer](scripts/render-outcome.mjs), [response contract](templates/step/response.schema.json) |

### R14 — yêu cầu bổ sung trước khi push

Thầy bổ sung: “các operator log The best out come; op gen ui => log hình”. Thầy xác nhận các cặp gen UI/ảnh, audit/screenshot và code/changes là ví dụ,
không phải danh sách đóng. Đã đọc đủ 26 operator và 1 helper để chọn kết quả theo contract và mode. Khối **The best outcome** xuất hiện sau kết quả đã qua gate:

| Loại đầu ra | Phần hiện ngay | Bằng chứng đi kèm |
| --- | --- | --- |
| UI generation | Ảnh render thật của phương án được chọn, đủ để xem bố cục và điểm nhấn | Link preview, source và lý do chọn; ảnh trang trí trong UI không thay cho ảnh render cả phương án |
| UI audit / UAT | Ảnh/sheet cần xem để đánh giá kết quả cùng verdict dễ hiểu | Case/claim, capture và nguồn proof |
| Code / repair | Source hoặc diff đáng xem của thay đổi | Đường dẫn source, commit/revision và gate kết quả |
| Plan / quyết định | Sơ đồ, bảng hoặc bản quyết định dễ đọc | Dependency, scope và lý do lựa chọn |
| Data / identity / runtime | Kết quả kiểm và thông tin vận hành phù hợp quyền người xem | Safe refs/receipt; không log secret, credential hoặc dump nhạy cảm |
| Nội dung | Bản bài viết được render, các phần học đáng xem | Source và asset của chính bản đã kiểm |

Best là kết quả có bằng chứng giúp đánh giá goal này, không có nghĩa chọn phần đẹp nhất hay chỉ hiện case pass. Operator audit/verify hoàn tất vẫn có thể báo finding fail hợp lệ; đối tượng được kiểm chưa đạt. Dry-run, reuse/no-op và rollback phải ghi đúng mode. Attempt blocked/mismatch hiện trạng thái, bằng chứng và bước sửa, không nhận nhãn thành công. Operator ghi metadata outcome trước acceptance; proof được niêm phong cùng response. Orchestrator render và nhúng media trong chat rồi mới ghi transition đã log; không sửa response đã niêm phong.

[Danh sách đầy đủ 26 operator và 1 helper, cùng phản biện](tests/evidence/20260905-starci-2.2-outcome-map.md).

### Những lựa chọn vận hành đã cụ thể hóa

| Điểm từng để mở | Cách vận hành của 2.2 |
| --- | --- |
| Root session | Alias @worktrees/sessions trỏ tới .worktrees/sessions; host binding lưu loại host, host ID, worktree và prompt ref. Follow-up tìm lại cùng binding. |
| Goal trong session | Một mission có version và danh sách doneWhen; mỗi attempt gắn đúng goal version. Replan trong scope không tạo thêm session hoặc hạn mức worker. |
| Confirmation | Draft tồn tại trước khi hỏi; lựa chọn phải khớp đúng decision/version. Approval hiện có chỉ dùng khi bao phủ scope hiện tại và lưu sourceRef. |
| Native goal | Goal của runtime là mission có version trong ledger, gắn native host/task qua hostBinding. Bản này không hứa tự gọi API tạo goal riêng của mọi host. |
| Session success | Operator done hoặc Git push không tự đóng session người dùng. close-success có lý do đóng, proof đầy đủ và không còn lease/worker. |
| Compact và evidence | Compact ngắn tại done/<id>.md; bundle có hash tại done/<id>/bundle. Local retention không hứa đã backup sang máy khác. |
| Helper | Run record liên kết host session; không có goal thực thi/agent session riêng. Giữ approval/status của bank cũ, dedup và ghi cả run rỗng/chưa đủ nguồn. |
| Sheet UAT | Typed case sheet JSON và bảng người dùng đọc trong receipt; SQL chỉ khi backend cần, không bắt lặp dữ liệu hay bắt buộc XLSX. |
| Knowledge authority | English là nguồn rule; VI mirror được inventory/hash/parity, không nhân đôi rule. MARGIN-AUTO được nhận như rule hợp lệ. |
| Kiến thức và hình | Review toàn bộ knowledge trong scope của surface; không suy ra đã kiểm cả sản phẩm. Hình có thể hỗ trợ nhận diện, cảm xúc và highlight nếu phù hợp nội dung và thứ tự chú ý. |

### Kiểm chứng và bàn giao

Trạng thái cuối, câu lệnh, kết quả test và giới hạn được ghi tại [release evidence](tests/evidence/20260905-starci-2.2-release.md). Source release qua Git; việc phát hành npm registry là một hành động riêng.
