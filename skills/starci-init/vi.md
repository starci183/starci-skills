---
title: Initialize Source · Vietnamese
---

# starci-init

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape` | module | hợp đồng báo cáo chung mà mọi skill đều đọc |

## HANDS OFF TO — named, never loaded

None.

## Cách chạy

Đọc `@skill-shape` trước. Skill này có thể chạy nhiều lần: bootstrap thường chỉ làm một lần, còn workspace
route và worktree state phải cập nhật khi project, role hoặc checkout thay đổi.

Ba root độc lập: bootstrap quyết định agent đi vào tree nào; `.workspace/<project>/` quyết định source
được **đọc** ở đâu; `.worktrees/<project>/` quyết định state được **ghi** ở đâu. Mỗi root có boundary và
approval riêng. Một approval chung cho “setup” không bao phủ cả ba.

## QUY TRÌNH

### 1 — In CONTEXT

In Source, project, role và ba boundary. `Touching` chỉ chứa boundary đang được đề nghị, không gom cả ba.

### 2 — Bootstrap: chứng minh tree entry tồn tại

Resolve trust tree mà Source phải route tới và kiểm tra entry thật. Link hoặc path nhớ lại không phải bằng
chứng; entry chết sẽ khiến agent tự bịa load order.

### 3 — Bootstrap: đọc trạng thái hiện có

Đọc `AGENTS.md` và `CLAUDE.md` nếu có. Phân biệt file vắng, file đúng, file stale và file có nội dung thật
của owner. Không overwrite nội dung thật bằng bootstrap chuẩn nếu chưa được duyệt riêng.

### 4 — Workspace: đo mọi role đã khai

Với từng `.workspace/<project>/<role>/config.json`, kiểm tra checkout, branch/head và contract path theo
schema route. Role chưa khai là `absent`; route từng đúng nhưng không còn đúng là `stale`. Không biến hai
trạng thái này thành một.

### 5 — Worktrees: đo project root

Kiểm tra registry và cache root, Git ownership, lock và path policy. Write root bị rejected không được
“sửa” bằng cách chọn thư mục gần nhất.

### 6 — Review từng boundary riêng

Trình bootstrap, workspace và worktree thành ba quyết định độc lập. Mỗi quyết định nêu diff chính xác,
điều sẽ không chạm và cách verify. Owner có thể duyệt bất kỳ tập con nào.

### 7 — Apply: bootstrap

Chỉ sau approval của boundary bootstrap, ghi entry tối thiểu để route vào tree. Không copy luật, compiler
hay gate vào Source; copied rule sẽ có hai home.

### 8 — Apply: workspace routes

Chỉ ghi role đã duyệt. Route phải dùng path thật trên machine này và contract thật; ghi recorded head theo
schema. Không chỉnh target repository.

### 9 — Apply: worktree state

Tạo hoặc sửa đúng project root đã duyệt, giữ registry durable và cache disposable. Không ghi dưới
`.claude`, không nhận Git owner khác.

### 10 — Verify, chỉ đọc

Đọc lại ba root, parse config và resolve mọi path. Verify không được tạo file phụ. Nếu schema yêu cầu
`WORKSPACE-6`, kiểm tra đúng evidence đó thay vì suy diễn từ path tồn tại.

### 11 — Đóng phase

In sáu bảng; `CHANGES` tách rõ bootstrap, workspace và worktree. Boundary không được duyệt phải xuất hiện
trong `REJECTED` hoặc `OWED`, không được lặng lẽ áp dụng.

## Điểm dừng

- Không xác định được Source → dừng; không đoán write root.
- Target path không tồn tại hoặc thuộc repository khác với khai báo → dừng và báo field sai.
- Boundary chưa được owner duyệt → không ghi boundary đó.
- Bootstrap hiện có chứa nội dung thật ngoài entry tối thiểu → dừng overwrite và đưa diff cho owner.
- Yêu cầu sửa target repository → từ chối; skill này chỉ sửa state của Source.

## ĐẦU RA

Sáu bảng của skill shape, đúng thứ tự, với từng boundary được báo cáo riêng.
