---
title: Diagnose skill · Vietnamese
---

# starci-diagnose

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape` | module | hợp đồng báo cáo chung mà mọi skill đều đọc |

## HANDS OFF TO — named, never loaded

None.

## Cách chạy

Đọc `@skill-shape` trước. Gọi bằng `/starci-diagnose <skill>` và có thể thêm scenario. Không có scenario
thì trace những gì mọi lượt chạy đều cần; có scenario thì trace đúng lượt chạy ấy.

## Luật skill này bảo vệ

**Trace không thực hiện bước đang trace.** Nó chỉ đọc, resolve, kiểm tra và đo; không ghi registry, không
mở session, không commit baseline. Vừa ghi thứ target skill sẽ ghi là diagnosis đã biến thành một lượt
chạy chưa được duyệt.

**Một stop không phải defect.** `environment` nghĩa skill dừng đúng vì bằng chứng nó cần chưa có;
`defect` nghĩa bước hứa đọc thứ không tồn tại, không thể resolve hoặc không đủ để giữ lời hứa. Chỉ kết luận
defect khi đã nhìn sâu hơn điểm dừng một bước.

## QUY TRÌNH

### 1 — In CONTEXT

`Phase` là `diagnose`, `Touching` là `None`. In target skill, scenario và machine đang được đo.

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

In sáu bảng. `OUTPUTS` là trace theo bước; `WARNINGS` giữ assumption; `OWED` chỉ giữ evidence chưa thể đọc,
không biến evidence thiếu thành pass.

## Điểm dừng

- Không đọc được target skill → dừng; không có flow để trace.
- Scenario không xác định project/role mà flow cần → ghi assumption còn thiếu, không tự chọn.
- Một check sẽ ghi hoặc thực thi target → dừng check đó; diagnosis phải giữ read-only.

## Ví dụ đã làm

Invocation: `/starci-diagnose <skill> render the settings page at second-app`.

### Trace đi từng bước thế nào

Đọc target, resolve route `fe`, kiểm tra checkout và contract, rồi mô phỏng từng precondition bằng phép
đọc. Không mở session và không render page.

### Findings được gắn nhãn

Route trỏ tới checkout không tồn tại là `environment`. Script mà target bắt buộc gọi nhưng tree không có
là `defect`. Contract không chứa need đang hỏi có thể là stop hợp lệ nếu skill đã phát biểu refusal đó.

### Trace không làm gì

Không refresh head, không tạo route, không viết candidate, không chạy target skill và không sửa defect.

### Owner học được gì

Owner biết chính xác lượt chạy sẽ dừng ở đâu, evidence nào thiếu, và cần sửa machine hay sửa skill; không
chỉ nhận một kết luận chung chung rằng “không chạy được”.

## ĐẦU RA

Sáu bảng của skill shape, đúng thứ tự. Không có production path trong `CHANGES`.
