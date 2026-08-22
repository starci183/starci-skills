---
title: Diagnose skill · Vietnamese
---

# starci-diagnose

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/vi.md` | vi | hợp đồng báo cáo chung mà mọi skill đều đọc |

## NESTED SKILLS

Không có. Skill này không tự gọi skill khác.

## PIPELINE

Topology: `reconciliation`, chỉ đọc.

| Bước | Nhánh | Đầu vào | Cách thực hiện | Đầu ra bắt buộc | Điều kiện kiểm tra |
|---|---|---|---|---|---|
| ràng buộc | dùng chung | target skill, routed project và scenario được yêu cầu | khóa invocation mô phỏng và cấm target writes | diagnosis context | exact target skill và route resolve |
| kỳ vọng | declared | target skill pipeline và loaded authorities | liệt kê mỗi step sẽ đọc, transform, emit và gate gì | expected trace | trace theo target skill nhưng không execute nó |
| quan sát | observed | real machine, routes và files | inspect thứ thực sự tồn tại tại từng expected read | observed trace | observation chỉ đọc và có evidence |
| phân loại | hợp nhất | expected và observed traces | tìm first stopping point cùng owner | diagnosis report | tách environment-not-ready khỏi defective skill |

## Cách chạy

Đọc `@skill-shape` trước. Gọi bằng `/starci-diagnose <skill>` và có thể thêm scenario. Không có scenario
thì trace những gì mọi lượt chạy đều cần; có scenario thì trace đúng lượt chạy ấy.

## Luật skill này bảo vệ

**Trace không thực hiện bước đang trace.** Nó chỉ đọc, resolve, kiểm tra và đo; không ghi registry, không
mở review round, không commit baseline. Vừa ghi thứ target skill sẽ ghi là diagnosis đã biến thành một lượt
chạy chưa được duyệt.

**Một stop không phải defect.** `environment` nghĩa skill dừng đúng vì bằng chứng nó cần chưa có;
`defect` nghĩa bước hứa đọc thứ không tồn tại, không thể resolve hoặc không đủ để giữ lời hứa. Chỉ kết luận
defect khi đã nhìn sâu hơn điểm dừng một bước.

## QUY TRÌNH

### 1 — Lập context lock

`Phase` là `plan`, `Touching` là `None`. In target skill, scenario và machine đang được đo. Diagnosis ghi
ở nơi khác là đã phá luật read-only của chính nó.

### 2 — Đọc target skill và hiểu literal từng bước

Lập danh sách theo đúng thứ tự: bước đọc gì, ghi gì, từ chối khi nào và evidence nào cho phép đi tiếp.
Không sửa lại flow theo điều người trace nghĩ skill “đáng lẽ” phải làm.

### 3 — Resolve environment giống target skill

Đi theo đúng route, role, checkout, contract và write root mà skill sẽ dùng. Không chọn path thay thế chỉ
vì path đó tồn tại. Route thiếu field bắt buộc như `WORKSPACE-2` là evidence, không phải lời mời đoán.

### 4 — Đánh giá từng bước tới stop đầu tiên

Với mỗi bước, ghi `expects`, `actual`, `verdict` và bằng chứng. Dừng trace chính tại stop đầu tiên nhưng
không kết luận vội đó là defect.

### 5 — Nhìn sâu hơn stop đúng một bước

Kiểm tra thứ skill định đọc có thật không, route có thể resolve không và precondition có thể được đáp ứng
không. Bước này phân biệt environment chưa sẵn sàng với lời hứa không thể thực hiện của skill.

### 6 — Kiểm tra script và path được gọi tên

Mọi script phải tồn tại và chạy được theo cách skill mô tả; mọi path phải resolve từ đúng root. Không
repoint tên hỏng sang thứ có vẻ gần giống.

### 7 — Đóng phase

Tóm tắt first stop và mọi `cannot-tell` bằng văn xuôi thân thiện. Đánh giá hết mọi trace step còn đọc được
trước khi đóng; không biến diagnosis chưa làm thành danh sách nợ.

## Điểm dừng

- Không đọc được target skill → dừng; không có flow để trace.
- Scenario không xác định project/role mà flow cần → ghi assumption còn thiếu, không tự chọn.
- Một check sẽ ghi hoặc thực thi target → dừng check đó; diagnosis phải giữ read-only.
- Decision registry bị thiếu khiến design record gắn với hash không có chỗ ghi → nói rõ bằng văn xuôi và
  ghi step là chưa đánh giá được.

## Ví dụ đã làm

Invocation: `/starci-diagnose <skill>  render the settings page at second-app`.

### Trace đi từng bước thế nào

| Bước target | Nó đọc gì | Thực tế có gì | Verdict |
|---|---|---|---|
| 1 lập context lock | — | — | `pass` |
| 2 resolve + xác minh route `fe` | `.workspace/second-app/fe/config.json` | `.workspace/` chỉ có `example-app`; không có `second-app` | **`would-stop`** — `WORKSPACE-2` |
| 3 các root worktree | `.worktrees/second-app/{businesses,cache}` | không có, đúng như dự kiến khi chưa có route | `blocked` sau bước 2 |
| 4 mở hoặc tiếp review work | registry | không thể đi tới | `blocked` sau bước 3 |
| 5 đọc sáu input | contract tại `context.contract` | **checkout đó không có thư mục `components/contracts`** | `defect` trong *environment*, không phải skill |
| 6 verdict theo từng region | contract key theo `why` | không có contract để search, nên mọi region sẽ resolve thành `new` | `blocked` bởi bước 5 |
| 7–11 | — | chưa đi tới | `cannot-tell` |

### Findings được gắn nhãn

```text
finding: project không có workspace route
label: blocked
evidence: .workspace/ có example-app; không có second-app
first-stop: yes, tại target step 2
cleared-by: owner của route, với project do owner khai
```

```text
finding: project không có contract registry
label: blocked
evidence: checkout có trên disk, nhưng không có apps/app/src/components/contracts
after-the-obvious-fix: vẫn blocked — input 2 của step 5 là contract, và khi không có nó thì mọi
region resolve thành `new`, chính là lỗi invented-entry mà luật layout gọi tên
cleared-by: một quyết định kiến trúc của owner, không phải một bước setup
```

```text
finding: surface được yêu cầu không có source trong app đã search
label: cannot-tell
evidence: search apps/app/src cho *vocab* và *defense* không trả về gì
settled-by: owner gọi tên app hay package chứa nó, hoặc xác nhận nó chưa tồn tại
```

```text
finding: design task cố resume cache pack đã hết hiệu lực của task khác
label: blocked
evidence: không có session pack dưới <Source>/.worktrees/<project>/cache/design/
cleared-by: dựng lại candidate từ current business authority, grammar, contract và source trong invocation mới
```

### Trace không làm gì

Không tạo route, không mở review work, không ghi authority và không sinh một candidate nào — dù cách sửa bước 2
chỉ cách một skill, chính cám dỗ “tiện thể setup luôn” là thứ biến diagnosis thành một lượt chạy chưa được
duyệt.

### Owner học được gì

Lượt chạy sẽ dừng ở **bước 2**, và điểm dừng đó là cây đang hoạt động đúng, không phải thất bại. Nhưng dọn
nó vẫn chưa đủ: **blocker sâu hơn là project này không có contract**, và đó là một quyết định chứ không
phải lệnh setup. Trace chứng minh các blocker của environment; nó không bịa ra defect của trust tree khi
validator được gọi tên thực sự tồn tại.

## ĐẦU RA

Trả first stop, evidence và verdict bằng văn xuôi ngắn. Chỉ hỏi khi trace lộ ra quyết định thật của owner,
dưới `### NEED APPROVALS`; skill chỉ đọc này không tự ghi repair.
