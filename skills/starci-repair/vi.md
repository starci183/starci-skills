---
title: Repair source · Vietnamese
---

# starci-repair

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape` | module | hợp đồng báo cáo chung mà mọi skill đều đọc |

## NESTED SKILLS

Không có. Skill báo route stale rồi kết thúc; nó không tự chạy setup.

## Cách chạy

Đọc `@skill-shape` trước.

Năm thứ khác nhau đều thường bị gọi là stale:

| Thứ bị stale | Triệu chứng | Owner |
|---|---|---|
| **route** | checkout, contract hoặc head đã ghi không còn đúng | `starci-init` |
| **source** | build/lint fail hoặc format drift | skill này |
| **index** | gate xanh nhưng không tìm được contract `why` theo need | skill này, pass cuối |
| **machine** | lint package chưa cài hoặc checkout dùng bản vendored | skill này, trước khi đo |
| **remnant** | target checkout còn `.claude/` từ tree cũ | skill này, sau index |

Phải resolve route trước và dừng nếu route mới là thứ stale. Sửa source qua route sai là sửa repository
không ai yêu cầu.

## Luật skill này bảo vệ

**Màu xanh phải được làm ra, không được mua bằng im lặng.** Finding phải được sửa hoặc trả lại; không dùng
`eslint-disable`, hạ severity, gỡ rule, skip test hay thêm `any` chỉ để gate xanh.

Formatting không phải repair. Behavioural fix bị chôn trong hàng nghìn dòng format sẽ không review được,
vì vậy đo, phân loại và sửa theo pass tách biệt. Approval khóa chính xác role, repository và boundary;
detection không cấp quyền ghi.

## QUY TRÌNH

### 1 — In CONTEXT

`Phase` là `repair`. `Touching` ban đầu là boundary được đề nghị; chưa approval thì không ghi product source.

### 2 — Resolve và kiểm tra route; route hỏng thì dừng

Đọc `.workspace/<project>/<role>/config.json`, kiểm tra checkout, contract và recorded head trước khi đọc
source. Mỗi lượt chỉ sửa một role của một project. Route stale kết thúc lượt chạy và owner row nêu hành
động tiếp theo.

### 3 — Đọc manifest trước khi chạy gì

Tìm package manager, scripts thật, Node/runtime requirement và gate repository công bố. Không tự bịa lệnh
chuẩn từ framework; chính manifest định nghĩa cách project đo mình.

### 4 — Kiểm tra machine trước khi tin count

Đọc manifest và lint config. Published lint packages phải được cài và config phải import chúng; folder
plugin hand-maintained hoặc mirror vendored nghĩa count đang đo bằng luật riêng. Sửa wiring trong pass
riêng, rồi mới lấy baseline.

### 5 — Đo và ghi lại con số

Chạy format-check, lint, typecheck, build và test đúng như repository khai. Ghi command, exit code và số
finding. Gate không chạy được là `OWED`, không phải zero.

### 6 — Phân loại từng finding

Mỗi finding thuộc một nhóm: machine, format, mechanical, defect, index hoặc remnant. Một dòng có thể cần
nhiều pass nhưng phải có một nguyên nhân gốc; không gom mọi thứ thành “lint debt”.

### 7 — Review count, classification và boundary

Đưa baseline, nhóm finding, file dự kiến chạm và thứ tự pass cho owner. Chỉ approval rõ mới mở production
write. Nếu boundary phải rộng hơn, quay lại review trước khi sửa.

### 8 — Lấy baseline rồi sửa theo các pass tách biệt

Commit state trước thay đổi. Sửa machine trước; tiếp theo format-only; rồi mechanical fix; cuối cùng defect.
Mỗi pass phải có diff đọc được và gate liên quan chạy lại. Không trộn formatting với behaviour.

### 9 — Fan out chỉ defect pass

Chỉ chia defect pass khi các file độc lập và boundary không overlap. Machine, format và index cần một sự
thật chung nên không fan out. Mỗi nhánh nhận file chính xác, finding chính xác và evidence phải trả về.

### 10 — Pass `why`: làm index tìm lại được

`why` là câu trả lời cho “khi nào cần entry này”, không phải mô tả business hay shape. Ưu tiên recorded
miss từ lookup thật hơn count. Sửa reason bị miss trước, rồi xử lý count; không đổi key hoặc class để làm
query khớp.

### 11 — Remnant pass: một Source không mang hai trust tree

Kiểm tra `.claude/` trong target checkout. Nếu chỉ là remnant rỗng hoặc generated đã được owner duyệt thì
loại khỏi target; nếu có tracked file hay nội dung thật, dừng pass và đưa inventory cho owner. Không xóa
một trust tree đang sống vì tên thư mục trông cũ.

### 12 — Chứng minh bằng đúng command ban đầu

Chạy lại chính các command baseline, cùng working directory và options. Báo before/after từng gate. Một
command khác rẻ hơn không chứng minh finding cũ đã hết.

### 13 — Đóng phase

Ghi applied revision, baseline commit, tracked diff và before/after. `CHANGES` phải bằng đúng production
tree trong `git diff <baseline>`; mọi proof chưa chạy nằm trong `OWED` cùng command hoàn tất.

## Điểm dừng

- Route stale → gọi tên field sai rồi kết thúc lượt chạy.
- Gate chỉ pass khi suppression → dừng; đây là điều skill tồn tại để từ chối.
- Lint rule mâu thuẫn canon → dừng; đó là thay đổi trust tree, không phải product repair.
- Tree dirty bởi việc không liên quan → dừng; mixed baseline không chứng minh gì.
- `.claude/` trong target có tracked file hoặc nội dung thật → dừng remnant pass và trả inventory.
- Boundary cần mở rộng → quay lại owner, không tự thêm path.

## ĐẦU RA

Sáu bảng của skill shape, đúng thứ tự. `OUTPUTS` giữ before/after; `CHANGES` là tracked diff;
`REJECTED` giữ suppression và boundary bị bác; `OWED` giữ gate chưa chạy.
