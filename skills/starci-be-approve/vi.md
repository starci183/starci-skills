---
title: Backend approve · Vietnamese
---

# starci-be-approve

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/vi.md` | vi | hợp đồng báo cáo chung mà mọi skill đều đọc |

## NESTED SKILLS

Không có. Skill này không tự gọi skill khác.

## Cách chạy

Đọc `@skill-shape` trước. Skill này giữ cả vòng phê duyệt lẫn phần triển khai, ngăn cách bằng một hard
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
- các test case liệt kê có đúng là những đường capability này thực sự có thể hỏng không.

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

Xác nhận repository, branch và `Touching` với owner. Sau đó commit trạng thái hiện tại của target và ghi
`Baseline commit: <sha>` trước thay đổi đầu tiên, để `git diff <baseline>` là bản kê trung thực.

### 5 — Triển khai đúng revision đã duyệt

Chỉ chạm các file đã duyệt. Nếu cần path ngoài ranh giới, quay lại owner; không tự nới diff. Bám theo
family mà kế hoạch đã viện dẫn về layering, transport, data access, exception identity và naming. Mọi
exception đều kế thừa abstract exception.

Giữ nguyên công việc không liên quan. Suppression, gate bị làm yếu và test bị bỏ qua không phải lựa chọn
triển khai hợp lệ.

### 6 — Chứng minh bằng đúng evidence đã duyệt

Chạy các case đã liệt kê, không thay bằng phép thử rẻ hơn. Sau đó chạy gate thật của repository — lint,
typecheck, build, tests — cùng runtime proof đã nêu như live query hoặc boot probe. Gate fail thì sửa.
Gate không chạy được phải thử hết fallback an toàn; nếu cần quyền owner thì dùng `### NEED APPROVALS`,
nếu không thì nói external blocker và không được báo pass.

Không chạy end-to-end suite nếu approval không yêu cầu.

### 7 — Đóng phase

Ghi `Applied revision: <same identity>`, baseline commit và tracked diff. Diff phải liệt kê đủ các
production path và khớp tuyệt đối với ranh giới đã duyệt.

## Điểm dừng

- Chưa có `Approved revision` → không bắt đầu triển khai.
- Approval gắn với revision cũ, hoặc không có default nên `OK` không nhận diện được phương án → hỏi một
  lần; `OK` cho default đang hiển thị không mơ hồ.
- Tree đã dirty bởi công việc không liên quan → dừng; baseline trộn nhiều việc không chứng minh được gì.
- Cần path ngoài ranh giới → quay lại owner, không tự mở rộng.
- Gate chỉ pass nếu bị làm yếu → dừng; luật không uốn theo code.

## ĐẦU RA

Theo contract văn xuôi thân thiện của skill shape. Chỉ đóng khi mọi mục `own` đã triển khai và chứng minh
xong. Chỉ hỏi dưới `### NEED APPROVALS`; có `OK` thì apply, không lặp lại câu hỏi.
