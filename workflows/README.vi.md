# Workflow

Một workflow là một chuỗi operator ghép sẵn: danh sách **bậc** theo thứ tự, mỗi bậc là danh sách
**nhánh** chạy song song (tối đa ba), kèm **vòng lặp** quay về một bậc trước và **preset** cho Yêu cầu
của từng nhánh. Các file ở đây là ví dụ, không phải những chuỗi duy nhất được phép.

Cửa vào dùng chúng như sau:

1. Đọc `when` của mọi ví dụ. Request khớp ví dụ nào thì chạy chuỗi đó; preset điền vào
   `request.json`, người chỉ bị hỏi những field không có mặc định.
2. Không khớp cái nào thì tự ghép chuỗi từ bảng `## Next` của các operator và `routing.json`, theo
   đúng luật mà `scripts/validate-workflows.mjs` ép lên các file này:
   - mỗi nhánh gọi tên một operator có thật và chỉ preset field mà operator đó khai;
   - mọi Input bắt buộc của một nhánh phải do một bậc trước sinh ra;
   - các nhánh cùng bậc không chung alias ghi (hai operator không được cùng ghi một checkout hay một
     root; `frontend.surface.audit` toả theo entry của matrix vì nó không ghi gì);
   - vòng lặp quay về bậc trước và mang `maxRounds`;
   - chuỗi kết thúc ở `git.publish`, `release.deploy` hoặc `user`.
3. Chuỗi tự ghép mà còn dùng lại được thì thành một file mới ở đây, kèm `when`.

Mọi nhánh ghi source đều commit trên `session/<sessionId>`; `git.publish` merge nó. Nhánh bị chặn vào
lại thành bậc mới; vòng lặp tính vào `maxRounds` của chính operator.

| Workflow | Khi | Các bậc | Song song | Kết thúc |
| --- | --- | --- | --- | --- |
| `frontend-new-surface` | bề mặt chưa tồn tại (`new`) | bind ×2 → business → direction → resolve → apply → audit → quality → publish | audit theo matrix | `git.publish` |
| `frontend-reconstruct` | dựng lại bề mặt đã có, giữ fact nghiệp vụ | bind → direction → resolve → apply → audit → quality → publish | audit theo matrix | `git.publish` |
| `frontend-refine` | sửa bên trong cấu trúc đã duyệt | bind → direction → resolve → apply → audit → quality → publish | audit theo matrix | `git.publish` |
| `backend-feature` | một contract backend cho một feature | bind → business (model) → architecture → backend apply → quality → business (reconcile) → publish | — | `git.publish` |
| `full-feature` | backend và bề mặt frontend mới cùng lúc | bind ×2 → business → architecture → [backend apply ∥ direction] → [quality ∥ resolve] → apply → audit → quality → business (reconcile) → publish | hai bậc hai nhánh, audit theo matrix | `git.publish` |
| `frontend-with-uat` | thay đổi frontend mà người yêu cầu đi thử | bind ×2 → … audit → quality → uat → publish | audit theo matrix | `git.publish` |
| `release` | head đã publish phải lên production | bind → quality → release | — | `release.deploy` |
| `content-unit` | một đơn vị giáo trình từ đầu tới cuối | content.generate (có exchange review bên trong) | — | `user` |

Hình dạng file (`schemaVersion` 9): `id` bằng tên file; `when` có `en` và `vi`; `chain` là mảng bậc,
mỗi bậc là mảng `{ operator, requirements?, fanout?: "matrix", maxParallel?: 1..3 }`; `loops` là mảng
`{ from, to, when, maxRounds }`; `ends` là `user` hoặc một operator của bậc cuối.
