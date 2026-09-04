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
- [ ] Fail thì chạy lại đúng ô: lỗi nhỏ (dưới ba file, không đổi bố cục) → `*.fix`; lỗi lớn →
      `*.generate`; thước "nhỏ/lớn" ghi trong `resources/orchestrator.json`, không trong operator.

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
- [ ] Áp cặp này: `interface.plan` (bản đồ bề mặt: trang, modal, shell chung, contract dữ liệu, goal
      từng trang) + `interface.generate` một trang; `uat.plan` + `uat.verify` một luồng; `seed.plan` +
      `seed.run`; `backend.plan` + `backend.generate` khi contract có nhiều module.
      (xong nửa plan: `operators/interface-plan`, `operators/uat-plan`, kind `surface-map`, `uat-plan`;
      còn `seed.plan`, `backend.plan`, và bảng Inputs `units` của `interface.generate`, `uat.verify`)
- [ ] Gộp có thứ tự: `runtime.serve` merge N nhánh vào nhánh tích hợp, xung đột trả về đúng đơn vị.
- [ ] Audit hai tầng: `interface.audit` từng trang, cộng một lần audit chéo lấy bản đồ làm input (shell,
      tên, điều hướng); lỗi chéo về `interface.plan`.
- [x] Budget theo đơn vị: `maxSteps = cơ bản + N × mỗi đơn vị`, N đọc từ số dòng "xong khi".
      (`orchestrator.json#budget.perUnit` và câu nâng trần trong `budget.note`; validate-request từ chối
      nhánh không `unit` khi mission có hơn một dòng "xong khi" cho operator execute có `X.plan`)
- [ ] `interface.audit` chấp nhận audit một trang đang chạy: input source-application và decision tuỳ
      chọn khi target là bề mặt có sẵn.

## 2c. Bốn chỗ yếu của harness, mỗi chỗ một gate

- [ ] Planner: `validate-operator` bắt mọi Input có producer và mọi primaryOutput có consumer hoặc là
      điểm kết; chuỗi planner dựng qua exchange `critique` mù (goal + chuỗi vào, bậc thừa ra) rồi in ra
      chat trước khi chạy.
- [ ] Gu auditor: lane đo được mù từng trang; lane taste và UX một auditor cho cả tính năng, chấm
      tương đối trên đủ sheet; gate hiệu chuẩn ba ảnh mốc trong `knowledge/ui/proof`, lệch quá một
      điểm thì receipt bị từ chối.
- [ ] Học: `knowledge/findings/<family>.jsonl` ghi mọi finding của audit và UAT; `interface.generate`
      nhận finding gần nhất của family làm input âm; `scripts/promote-findings.mjs` gom finding "chưa
      có rule" từ hai lần và soạn sẵn rule cùng evidence note cho người gật.
- [ ] Thước nhỏ/lớn theo loại thay đổi đọc từ prefix rule của finding (trình bày, copy, state → fix;
      composition, shell, node, contract → generate); leo thang sang generate sau một lần fix không
      sạch cùng finding.

## 3. Chứng minh trên nhiệm vụ thật

- [ ] Chạy lại một nhiệm vụ đã hỏng (seed UAT của S2, hoặc refactor Setup) trên 2.0 với Sol 5.6 và
      đo lại: phút báo tường đầu tiên, số `RECEIPT_MISSING`, số bước, số lần cùng operator, số lần người
      phải nhắn "sao dừng". Ghi kết quả vào `tests/evidence/`.
- [ ] Đạt thì push `origin main` và publish `@starci/skills@2.0.0`; không đạt thì mục 2 chưa xong.
