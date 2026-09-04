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

## 2. Audit từng operator theo chuẩn

Chuẩn: một artifact, một câu Done when, một quy trình tối đa 12 dòng lọt trong brief 2 KB, scope và
context khai đủ để agent mù chạy được, log đủ để người đọc ledger dựng lại được việc.

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

## 3. Chứng minh trên nhiệm vụ thật

- [ ] Chạy lại một nhiệm vụ đã hỏng (seed UAT của S2, hoặc refactor Setup) trên 2.0 với Sol 5.6 và
      đo lại: phút báo tường đầu tiên, số `RECEIPT_MISSING`, số bước, số lần cùng operator, số lần người
      phải nhắn "sao dừng". Ghi kết quả vào `tests/evidence/`.
- [ ] Đạt thì push `origin main` và publish `@starci/skills@2.0.0`; không đạt thì mục 2 chưa xong.
