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
- [ ] Goal cho từng nhánh: `request.json.goal` trỏ về đúng một dòng "xong khi" của mission hoặc khai
      `prerequisite` cho nhánh nào; `validate-request` từ chối nhánh không trỏ về đâu.
- [ ] Kiểm sau: `response.json.goalCheck { achieved, evidence[] }` — agent khai, validator đối chiếu
      evidence với Output có thật và `producedBy` đúng operator; chỉ cái đã đối chiếu mới vào
      `brief.proven`. Ba nhánh liền không thêm bằng chứng "xong khi" nào → dừng, hỏi người.
- [ ] Fail thì chạy lại đúng ô: lỗi nhỏ (dưới ba file, không đổi bố cục) → `*.fix`; lỗi lớn →
      `*.generate`; thước "nhỏ/lớn" ghi trong `resources/orchestrator.json`, không trong operator.

## 2. Audit từng operator theo chuẩn: tách theo tính năng, một operator một việc

Chuẩn: một operator làm đúng một việc, ứng với một tính năng của luồng (sinh trang, chấm trang, sửa
trang, cấp tài khoản, seed dữ liệu, serve runtime, đi thử, publish); một artifact chính, một câu Done
when không nối bằng "or" giữa hai việc, một quy trình tối đa 12 dòng lọt trong brief 2 KB, scope và
context khai đủ để agent mù chạy được, log đủ để người đọc ledger dựng lại được việc.

- [ ] Gate cho "một việc": `operator.json.primaryOutput` khai đúng một kind; Done when phải gọi tên kind
      đó; `validate-operator` từ chối operator có hai primaryOutput hoặc Done when nối hai việc bằng
      "or" ngoài mệnh đề chế độ (apply/dry, delta none).

- [ ] Cờ `mode: inline | dispatch | isolated` trên `operator.json` thay cho `dispatch`; `isolated`
      chỉ đọc alias trong Context và file trong `inputs`, request thiếu input bắt buộc bị từ chối
      trước khi spawn; tối đa một `dispatch` cùng lúc; profile ghi `forkTurns` theo mode.
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
- [ ] Scope rõ, context rõ: Context table và Inputs là toàn bộ thứ agent mù được thấy; brief in dòng
      "you see only what request.json names" khi mode là isolated.
- [ ] Workflow viết thành quy trình đọc được (`procedure` trong `workflows/*.json`), tối đa ba nhánh
      một bậc, chuỗi suy từ các dòng "xong khi" của mission; vẽ lại chuỗi là transition `replanned`.
- [ ] Log đủ ra session gốc: sau mỗi transition in đúng hai dòng vào chat — goal của nhánh, rồi
      done/blocked với số dòng "xong khi" đã có bằng chứng, đường dẫn artifact, lỗi và ô kế tiếp;
      output đầy đủ ở lại session folder; cuối lượt một khối báo cáo theo ba dạng của
      `resources/interaction.json`.
- [ ] `content.generate`: tách brief / sinh / review ở đợt sau, domain riêng.

## 2a. Full Sol

- [ ] Bỏ profile `luna`: mọi operator bind `sol-fresh` (producer, quyết định, execute) hoặc
      `sol-reviewer` (audit, critique, review); gỡ `luna` khỏi `resources/agents/profiles/openai.json`,
      khỏi `profileEquivalents` (cặp với `sonnet`), khỏi cột Profile của `resources/INDEX.md` và mọi
      `operator.json`; `validate-resources` từ chối profile không còn khai. Bằng chứng: 17 nhánh thoát
      không receipt trong S1/S4 đều là Luna.

## 2b. Dynamic flows và cặp plan/execute

- [ ] Xoá 11 workflow ví dụ khỏi runtime: cửa vào không đọc `when` nữa; chuỗi được `scripts/plan-chain.mjs`
      suy ngược từ các dòng "xong khi" của mission qua bảng Inputs/Next và `primaryOutput`; 11 ví dụ
      thành fixture cho spec của planner (planner phải suy ra được chúng từ goal tương ứng).
- [ ] `scripts/validate-chain.mjs`: luật cũ của validate-workflows (Next, input có producer, không chung
      alias ghi, tối đa ba nhánh, luật dòng dài khi có publish) áp lên `state.json.chain` mỗi lần vẽ;
      vẽ lại là transition `replanned`.
- [ ] Đơn vị của một agent mù là một trang, một modal, một luồng. Cặp plan/execute cho mọi operator có
      thể có N đơn vị: `X.plan` in danh sách đơn vị ra chat gốc (kind chung `units`: `{id, goal, inputs}`,
      validator từ chối đơn vị không có goal); `X.execute` mù, một đơn vị mỗi nhánh, phải trỏ về đúng
      `unit.id` của plan bậc trước; fan-out tối đa ba nhánh một bậc, mỗi nhánh một nhánh ghi riêng.
- [ ] Áp cặp này: `interface.plan` (bản đồ bề mặt: trang, modal, shell chung, contract dữ liệu, goal
      từng trang) + `interface.generate` một trang; `uat.plan` + `uat.verify` một luồng; `seed.plan` +
      `seed.run`; `backend.plan` + `backend.generate` khi contract có nhiều module.
- [ ] Gộp có thứ tự: `runtime.serve` merge N nhánh vào nhánh tích hợp, xung đột trả về đúng đơn vị.
- [ ] Audit hai tầng: `interface.audit` từng trang, cộng một lần audit chéo lấy bản đồ làm input (shell,
      tên, điều hướng); lỗi chéo về `interface.plan`.
- [ ] Budget theo đơn vị: `maxSteps = cơ bản + N × mỗi đơn vị`, N đọc từ số dòng "xong khi".
- [ ] `interface.audit` chấp nhận audit một trang đang chạy: input source-application và decision tuỳ
      chọn khi target là bề mặt có sẵn.

## 3. Chứng minh trên nhiệm vụ thật

- [ ] Chạy lại một nhiệm vụ đã hỏng (seed UAT của S2, hoặc refactor Setup) trên 2.0 với Sol 5.6 và
      đo lại: phút báo tường đầu tiên, số `RECEIPT_MISSING`, số bước, số lần cùng operator, số lần người
      phải nhắn "sao dừng". Ghi kết quả vào `tests/evidence/`.
- [ ] Đạt thì push `origin main` và publish `@starci/skills@2.0.0`; không đạt thì mục 2 chưa xong.
