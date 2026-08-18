---
title: Frontend design execute · Vietnamese
---

# starci-fe-design-execute

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@lints-fe` | `gates/fe/lints` | module | chứng minh source frontend bằng gate thật của nó |
| `@inventory-visual-language` | `scripts/inventory-visual-language.mjs` | script | tái tạo digest token được duyệt trong layout |
| `@patterns-fe` | `compilers/patterns/fe` | module | resolve file, export và ranh giới import |
| `@session` | `skills/skill-shape/session.schema.json` | file | hình dạng mà một design session được ghi ra |
| `@skill-shape` | `skills/skill-shape` | module | hợp đồng báo cáo chung mà mọi skill đều đọc |
| `@validate-artifact` | `scripts/validate-artifact.mjs` | script | validate session graph trước production write |
| `@workspaces` | `contexts/workspaces` | module | resolve và kiểm tra checkout frontend |

## NESTED SKILLS

Không có. Skill này không tự gọi skill khác.

## Cách chạy

Đọc `@skill-shape` trước. Đây là skill frontend duy nhất ghi product source, vì vậy điều kiện bắt đầu của
nó phải chặt nhất.

## QUY TRÌNH

### 1 — In CONTEXT

`Phase` là `execute`. `Touching` gọi đúng tên các path frontend lượt chạy được phép ghi và phải được owner
xác nhận trước write đầu tiên. Phát hiện một path không đồng nghĩa được phép sửa nó.

### 2 — Từ chối nếu còn hash reachable chưa accepted

Validate session bằng `@validate-artifact` và `@session`. Reachable là layout queue entry duy nhất hiện
`accepted`, cộng block entry có cùng `layoutHash`. Entry `rejected` và `superseded` là lịch sử, không phải
implementation input. Mỗi region có đúng một current block; entry còn `queued` phải từ chối.

Nếu còn hash chưa accepted, **dừng và gọi tên nó**. Không có orchestrator nào đã kiểm tra hộ, và không có
thứ gì khác trong tree biến proposed hash thành accepted. Bắt đầu một phần sẽ sinh ra code chưa ai duyệt
ở đúng nơi khó hoàn tác nhất.

### 3 — Kiểm tra route, rồi lấy baseline

Đọc `@workspaces`, kiểm tra route `fe` (`WORKSPACE-5`), rồi chạy `@inventory-visual-language`. Digest phải
bằng mọi `direction.vocabularyAt` reachable. Sau đó mới commit target state và ghi
`Baseline commit: <sha>` **trước** production write đầu tiên.

### 4 — Áp dụng direction nằm trong layout

Đọc exact direction từ accepted layout. Token `reuse` phải còn resolve; token `new` chỉ áp dụng name và
value đã bind, không chép preview CSS. Hai accepted layout trong cùng scope gán một semantic role xung đột
thì dừng; không có direction hash thứ hai để chọn.

### 5 — Resolve mọi class qua principles

JSON đã accepted không chứa class. Bây giờ resolve class của từng node theo cách tất định:

- mỗi node có một situation code cho mỗi principle và đúng một className từ code đó;
- class ngoài closed union của contract là **unrepresentable**; nếu cần nó thì đây là contract change
  phải trả owner, không được xấp xỉ;
- khi hai code kề nhau cùng khớp, chọn rung nhỏ hơn chứ không chọn theo sở thích.

Nếu phải dùng gu thẩm mỹ mới resolve được, principle đang thiếu. Ghi lại và không tự quyết tại đây.

### 6 — Đặt file theo patterns

Vị trí file, export, import được phép và tên gọi đều do `@patterns-fe` quyết định. Pattern là compiler,
không phải gate, nên phải đọc **trước** dòng code đầu tiên. Node của entry phải được **render**, không được
bắt chước: chép class sang vendor element sẽ làm mất `host` mà element đó không mang nổi, khiến source
tưởng như theo contract trong khi accessibility tree lại sai.

Thực hiện đúng mọi verdict `reuse`, `generalize`, `new` trong JSON accepted. `generalize` phải cập nhật
mọi call site đã đo; rename còn sót một chỗ chưa hoàn tất.

### 7 — Chứng minh bằng gates

Chạy frontend lints từ `@lints-fe`. Finding phải được sửa, không suppression, disable hay khoét ngoại lệ
để pass. Sau đó chứng minh surface render bằng đúng evidence approval yêu cầu, không dùng bản thay thế dễ
làm hơn.

### 8 — Đóng phase

Ghi applied revision, baseline commit và tracked diff. `CHANGES` liệt kê mọi production path trong diff
và phải khớp ranh giới đã duyệt; path ngoài `Touching` phải quay lại owner.

## Điểm dừng

- Có hash reachable chưa accepted → dừng và gọi tên hash.
- Direction tham chiếu token mất hoặc digest stale → dừng.
- Accepted layout xung đột semantic role → trả product decision.
- Class cần dùng nằm ngoài closed union → contract change, trả owner.
- Principle không resolve được nếu thiếu preference → ghi gap và dừng node đó.
- Lint finding không sửa được trong `Touching` → trả lại ranh giới, không suppression.
- Không thể tạo baseline vì tree đã dirty bởi việc khác → dừng; baseline trộn state không chứng minh gì.

## ĐẦU RA

Sáu bảng của skill shape, đúng thứ tự. `CHANGES` là toàn bộ production tree từ
`git diff <baseline>`; `WARNINGS` giữ bằng chứng yếu hơn đường approval đã nêu; `OWED` giữ proof chưa chạy.
