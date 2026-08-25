---
title: Backend approve · Vietnamese
---

# starci-be-approve

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/vi.md` | vi | hợp đồng báo cáo chung mà mọi skill đều đọc |
| `@workspaces` | `knowledge/contexts/workspaces/vi.md` | vi | reverify checkout, branch và source revision trước approval |
| `@business` | `knowledge/contexts/business/vi.md` | vi | bind approval và implementation vào product authority |
| `@be-patterns` | `runtime/standards/backend/patterns/vi.md` | vi | challenge situation-to-file binding với source hiện tại |
| `@rule-bindings` | `runtime/standards/backend/rule-bindings/vi.md` | vi | từ chối drift giữa situation enforced, gate và machine |
| `@rule-binding-check` | `runtime/machines/rule-bindings/check.mjs` | script | chạy parity backend gate-to-canon |
| `@plan-schema` | `runtime/kernel/approvals/backend-plan.schema.json` | file | validate compiler boundary đầy đủ đang được duyệt |
| `@validate-artifact` | `scripts/validate-artifact.mjs` | script | từ chối brief malformed trước approval loop |
| `@plan-check` | `runtime/machines/backend-plan/check.mjs` | script | từ chối stale identity, situation giả và file chưa bind |
| `@business-boundary` | `scripts/business-write-boundary.mjs` | script | chặn write thiếu business-impact binding chính xác |

## NESTED SKILLS

Không có. Skill này không tự gọi skill khác.

## PIPELINE

Topology: `reconciliation`.

| Bước | Nhánh | Đầu vào | Cách thực hiện | Đầu ra bắt buộc | Điều kiện kiểm tra |
|---|---|---|---|---|---|
| ràng buộc | dùng chung | backend brief đã duyệt, route, business head | khóa revision và exact proposed boundary | approval context | brief, revision và authority khớp nhau |
| phản biện | đối chiếu | approval context, live schema và sibling source | đối chiếu từng file, branch và test dự kiến với owner thật | discrepancy report và exact revision | không còn mismatch về schema, ownership hoặc boundary |
| phê duyệt | hợp nhất | revision đã nhận và phản hồi owner | bind một `OK` rõ ràng vào revision đang hiển thị | approval receipt | chưa có receipt thì không ghi production source |
| triển khai-chứng minh | thực thi | approval receipt | chỉ ghi trong boundary và chạy backend gates đã khai | source receipt và proof | implementation đúng revision đã duyệt và mọi gate xanh |

## Cách chạy

Đọc `@skill-shape`, `@be-patterns` và `@rule-bindings` theo thứ tự đó. Skill này giữ cả vòng phê duyệt lẫn phần triển khai, ngăn cách bằng một hard
stop. Trước ranh giới ấy mọi thứ còn đảo ngược được; sau nó, thay đổi đã đi vào sản phẩm.

## QUY TRÌNH

### 1 — Lập context lock

`Phase` là `approve`. Trước khi được duyệt, `Touching` là `None`; sau đó nó chỉ gồm đúng các path backend
trong ranh giới đã duyệt.

### 2 — Đối chiếu kế hoạch với thực tế

Đọc lại từng claim trên checkout thay vì tin phần tóm tắt của kế hoạch:

- thư mục cha của từng file có thật không, và family có đúng shape đã mô tả không;
- mọi field được dùng có thật trong schema dưới đúng tên đó không;
- đường exception có kế thừa abstract exception giống sibling không;
- các test case liệt kê có đúng là những đường capability này thực sự có thể hỏng không;
- mọi file có fixed pattern situations, exact paths và live evidence không;
- `@rule-binding-check --be` có chứng minh gate-to-canon parity không.

Hiếm khi kế hoạch đi qua bước này mà không đổi. Phải nói rõ đổi gì và vì sao.

### 3 — Lặp tới khi owner duyệt rõ một revision

```text
brief -> feedback -> revision -> brief
```

Gom mọi câu hỏi đã biết vào một lượt, không hỏi nhỏ giọt. Ghi mỗi phương án bị bác cùng phương án thay thế
và lý do nguyên văn của owner. Vòng lặp kết thúc khi owner chọn revision cùng boundary, hoặc trả lời `OK`
cho recommended revision và boundary chính xác đang hiển thị. Im lặng hay approval cho revision cũ không tính.

In `Approved revision: <identity>`. Không có dòng này thì không bước nào bên dưới được chạy.

### 4 — Hard stop, rồi lấy baseline

Xác nhận repository, branch và `Touching` với owner. Plan `businessImpact: affects` phải chuyển đúng feature
head `pending` sang `in-progress` trước khi chạy `@business-boundary`. Plan `businessImpact: none` phải bind
đúng feature head `implemented` đang có và không được mở lại head đó. Sau đó commit trạng thái hiện tại của
target và ghi `Baseline commit: <sha>` trước thay đổi đầu tiên, để `git diff <baseline>` là bản kê trung thực.

### 5 — Triển khai đúng revision đã duyệt

Chỉ chạm các file đã duyệt. Nếu cần path ngoài ranh giới, quay lại owner; không tự nới diff. Bám theo
family mà kế hoạch đã viện dẫn về layering, transport, data access, exception identity và naming. Mọi
exception đều kế thừa abstract exception.

Giữ nguyên công việc không liên quan. Suppression, gate bị làm yếu và test bị bỏ qua không phải lựa chọn
triển khai hợp lệ.

### 6 — Chứng minh bằng đúng evidence đã duyệt

Chạy `@rule-binding-check --be`, rồi các case đã liệt kê, không thay bằng phép thử rẻ hơn. Sau đó chạy gate thật của
mỗi routed role theo thứ tự: format, lint, typecheck, build, unit coverage, E2E, Sonar. Lint phải 0 error/0 warning;
unit S/L/F ≥80%, branches ≥75%, patch/new metric ≥90%; E2E phải dùng entrypoint đã khai báo và tồn tại, test thật,
mọi test pass; Sonar là gate cuối. `skip`, `todo`, `passWithNoTests`, zero-test và check substitute bị reject.
Chạy cả runtime proof đã nêu như live query hoặc boot probe. Gate fail thì sửa.
Gate không chạy được phải thử hết fallback an toàn; nếu cần quyền owner thì dùng `### NEED APPROVALS`,
nếu không thì nói external blocker và không được báo pass.

Không được bỏ E2E hoặc Sonar: đây là phần bắt buộc của backend delivery fence.

### 7 — Đóng phase

Với `businessImpact: affects`, reconcile đúng feature đang `in-progress` sang `implemented`; với
`businessImpact: none`, giữ nguyên authority `implemented`. Chạy business registry check ở cả hai đường.
Ghi `Applied revision: <same identity>`, business impact, business head/status, baseline commit và tracked diff. Diff phải liệt kê đủ các
production path và khớp tuyệt đối với ranh giới đã duyệt.

## Điểm dừng

- Chưa có `Approved revision` → không bắt đầu triển khai.
- Business-impact route đã duyệt không khớp authority head (`affects` thiếu exact `in-progress`, hoặc `none`
  thiếu exact `implemented`) → product source vẫn read-only.
- Approval gắn với revision cũ, hoặc không có default nên `OK` không nhận diện được phương án → hỏi một
  lần; `OK` cho default đang hiển thị không mơ hồ.
- Tree đã dirty bởi công việc không liên quan → dừng; baseline trộn nhiều việc không chứng minh được gì.
- Cần path ngoài ranh giới → quay lại owner, không tự mở rộng.
- Gate chỉ pass nếu bị làm yếu → dừng; luật không uốn theo code.

## ĐẦU RA

Theo contract văn xuôi thân thiện của skill shape. Chỉ đóng khi mọi mục `own` đã triển khai và chứng minh
xong. Chỉ hỏi dưới `### NEED APPROVALS`; có `OK` thì apply, không lặp lại câu hỏi.
