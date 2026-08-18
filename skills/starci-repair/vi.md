---
title: Repair source · Vietnamese
---

# starci-repair

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@file-layout` | `compilers/patterns/fe/file-layout` | module | cung cấp vocabulary tier frontend đã được chấp nhận để repair structure |
| `@skill-shape` | `skills/skill-shape` | module | hợp đồng báo cáo chung mà mọi skill đều đọc |

## NESTED SKILLS

Không có. Skill báo route stale rồi kết thúc; nó không tự chạy setup.

## Cách chạy

Đọc `@skill-shape` trước.

Sáu thứ khác nhau đều thường bị gọi là stale:

| Thứ bị stale | Triệu chứng | Owner |
|---|---|---|
| **route** | checkout, contract hoặc head đã ghi không còn đúng | `starci-init` |
| **source** | build/lint fail hoặc format drift | skill này |
| **index** | gate xanh nhưng không tìm được contract `why` theo need | skill này, pass cuối |
| **machine** | lint package chưa cài hoặc checkout dùng bản vendored | skill này, trước khi đo |
| **structure** | vocabulary đã bỏ một tier nhưng path vẫn còn, kể cả path rỗng mà gate theo file không thấy | skill này, pass retired-structure |
| **remnant** | target checkout còn `.claude/` từ tree cũ | skill này, sau index |

Phải resolve route trước và dừng nếu route mới là thứ stale. Sửa source qua route sai là sửa repository
không ai yêu cầu.

## Luật skill này bảo vệ

**Màu xanh phải được làm ra, không được mua bằng im lặng.** Finding phải được sửa hoặc trả lại; không dùng
`eslint-disable`, hạ severity, gỡ rule, skip test hay thêm `any` chỉ để gate xanh.

Formatting không phải repair. Behavioural fix bị chôn trong hàng nghìn dòng format sẽ không review được,
vì vậy đo, phân loại và sửa theo pass tách biệt. Approval khóa chính xác role, repository và boundary;
detection không cấp quyền ghi.

Gate xanh không chứng minh directory tree sạch. ESLint nhìn file và Git track file; directory cấm nhưng
rỗng thì cả hai đều không thấy. Repair phải inventory directory trực tiếp. `components/shells` vi phạm
`FILE-8` dù chứa bốn file hay không chứa file nào.

## QUY TRÌNH

### 1 — Lập context lock

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
finding. Gate không chạy được phải thử hết fallback an toàn; không được coi là zero.

Với frontend, đọc `@file-layout`, inventory mọi component root kể cả directory rỗng, rồi ghi path retired
tier, file count, tracked-file count và mọi import/export đi qua nó. Rule `no-shell-tier` giữ trường hợp có
file; inventory directory giữ trường hợp rỗng.

### 6 — Phân loại từng finding

Mỗi finding thuộc một nhóm: machine, format, mechanical, defect, index, retired-structure hoặc remnant. Một dòng có thể cần
nhiều pass nhưng phải có một nguyên nhân gốc; không gom mọi thứ thành “lint debt”.

### 7 — Review count, classification và boundary

Đưa baseline, nhóm finding, file dự kiến chạm và thứ tự pass cho owner. `OK` duyệt mọi default cùng
boundary chính xác đã hiển thị; sau đó lấy baseline và bắt đầu Apply ngay. Nếu boundary phải rộng hơn,
quay lại review trước khi sửa.

### 8 — Lấy baseline rồi sửa theo các pass tách biệt

Commit state trước thay đổi. Sửa machine trước; tiếp theo format-only, mechanical, defect,
retired-structure, `why`, rồi remnant. Mỗi pass có diff đọc được và gate liên quan chạy lại. Directory rỗng
không có Git diff vẫn phải ghi path cùng before/after count trong kết quả.

### 9 — Fan out chỉ defect pass

Chỉ chia defect pass khi các file độc lập và boundary không overlap. Machine, format, retired-structure và index cần một sự
thật chung nên không fan out. Mỗi nhánh nhận file chính xác, finding chính xác và evidence phải trả về.

### 10 — Pass `why`: làm index tìm lại được

`why` là câu trả lời cho “khi nào cần entry này”, không phải mô tả business hay shape. Ưu tiên recorded
miss từ lookup thật hơn count. Sửa reason bị miss trước, rồi xử lý count; không đổi key hoặc class để làm
query khớp.

### 11 — Pass retired-structure: bỏ tier `shells`

Với mỗi `components/shells` trong boundary, đếm file recursively và hỏi Git file nào tracked. Directory
rỗng thì xóa và ghi before/after dù Git diff rỗng. Có file thật thì giữ behavior, đọc export, mechanic và
call site để chuyển sang tier `@file-layout` yêu cầu; fixed vendor mechanic trở thành named branch. Đổi
folder/export, import, barrel, test và contract reference cùng một lượt.

Không xóa component thật chỉ để path biến mất. Identity hoặc semantic name chưa đủ bằng chứng thì trả đúng
component đó thành `decision`, tiếp tục phần đã giải được và đưa phần chưa giải vào `NEED APPROVALS`.
Machine pass
phải chạy trước; consumer dùng mirror thì cài canon package và bỏ mirror, không sửa private rule copy.

Proof gồm search không còn `components/shells`, search không còn import `/shells/`, gate `no-shell-tier`
từ package đã cài và toàn bộ gate ban đầu.

### 12 — Remnant pass: một Source không mang hai trust tree

Kiểm tra `.claude/` trong target checkout. Nếu chỉ là remnant rỗng hoặc generated đã được owner duyệt thì
loại khỏi target; nếu có tracked file hay nội dung thật, dừng pass và đưa inventory cho owner. Không xóa
một trust tree đang sống vì tên thư mục trông cũ.

### 13 — Chứng minh bằng đúng command ban đầu

Chạy lại chính các command baseline, cùng working directory và options. Báo before/after từng gate. Một
command khác rẻ hơn không chứng minh finding cũ đã hết.

### 14 — Đóng phase

Ghi applied revision, baseline commit, tracked diff và before/after bằng văn xuôi. Diff phải bằng đúng
production tree trong `git diff <baseline>`; proof chạy được là `own` và phải hoàn tất trong lượt.

## Điểm dừng

- Route stale → gọi tên field sai rồi kết thúc lượt chạy.
- Gate chỉ pass khi suppression → dừng; đây là điều skill tồn tại để từ chối.
- Lint rule mâu thuẫn canon đã chấp nhận rõ → machine stale và được repair adoption; chỉ dừng khi chính
  canon chưa xác định behavior.
- Tree dirty bởi việc không liên quan → dừng; mixed baseline không chứng minh gì.
- `.claude/` trong target có tracked file hoặc nội dung thật → dừng remnant pass và trả inventory.
- Boundary cần mở rộng → quay lại owner, không tự thêm path.

## ĐẦU RA

Nói before/after, path chính theo pass và proof bằng văn xuôi ngắn. Trước batch kế tiếp, kể finding còn
nợ rồi sửa trong cùng lượt. Chỉ kết thúc khi `own = 0` hoặc đang chờ quyết định hay boundary expansion
thật dưới `### NEED APPROVALS`.
