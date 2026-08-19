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
| `@design-registry-schema` | `contexts/worktrees/design-registry.schema.json` | file | kiểm tra identity-centric head và immutable object ref |
| `@design-registry-migrate` | `scripts/migrate-design-registry.mjs` | script | yêu cầu registry v2 projections current trước source execution |
| `@session` | `skills/skill-shape/session.schema.json` | file | hình dạng audit history tùy chọn; không phải lookup authority |
| `@skill-shape` | `skills/skill-shape/vi.md` | vi | hợp đồng báo cáo chung mà mọi skill đều đọc |
| `@validate-artifact` | `scripts/validate-artifact.mjs` | script | validate session graph trước production write |
| `@workspaces` | `contexts/workspaces/vi.md` | vi | resolve và kiểm tra checkout frontend |
| `@worktrees` | `contexts/worktrees/vi.md` | vi | resolve và kiểm tra registry worktree |

## NESTED SKILLS

Không có. Skill này không tự gọi skill khác.

## Cách chạy

Đọc `@skill-shape` trước. Đây là skill frontend duy nhất ghi product source, vì vậy điều kiện bắt đầu của
nó phải chặt nhất.
Caller cung cấp `layoutId` ổn định; design registry là lookup authority duy nhất cho implementation.

## QUY TRÌNH

### 1 — Lập context lock

`Phase` là `execute`. `Touching` gọi đúng tên các path frontend lượt chạy được phép ghi và phải được owner
xác nhận trước write đầu tiên. Phát hiện một path không đồng nghĩa được phép sửa nó.

### 2 — Từ chối nếu layout head hoặc mọi current region block head chưa accepted

Chạy `@design-registry-migrate --check`. Đọc `@design-registry-schema`, validate
`registries/design-registry-v2.json`, rồi resolve `layoutId` caller cung cấp qua
`layoutHeads[layoutId].head`, rồi resolve layout object immutable qua `objects.byHash`. Head là layout
accepted; không đọc session/review để chọn hash khác. Liệt kê mọi blockId trong
`layoutHeads[layoutId].regions`, resolve `blockHeads[layoutId/blockId]` và yêu cầu
`layoutHash` bằng layout hash hiện tại, `head` object tồn tại. Đây là toàn bộ implementation input; review
lịch sử chỉ là audit history tùy chọn, không phải authority.

Layout head hoặc bất kỳ region block head nào thiếu, malformed, proposed hay chưa accepted thì **dừng và
gọi tên identity/hash**. Bắt đầu một phần sẽ sinh code chưa ai duyệt ở nơi khó hoàn tác nhất.

### 3 — Kiểm tra route, rồi lấy baseline

Đọc `@workspaces`, kiểm tra route `fe` (`WORKSPACE-5`), rồi chạy `@inventory-visual-language`. Digest phải
bằng `direction.vocabularyAt` của mọi layout hiện tại. Sau đó mới commit target state và ghi
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

Ghi applied revision, baseline commit và tracked diff. Diff liệt kê mọi production path và phải khớp
ranh giới đã duyệt; path ngoài `Touching` phải quay lại owner.

## Điểm dừng

- Layout hoặc current region block head thiếu, proposed hay chưa accepted → dừng và gọi tên identity/hash.
- Direction tham chiếu token mất hoặc digest stale → dừng.
- Accepted layout xung đột semantic role → trả product decision.
- Class cần dùng nằm ngoài closed union → contract change, trả owner.
- Principle không resolve được nếu thiếu preference → ghi gap và dừng node đó.
- Lint finding không sửa được trong `Touching` → trả lại ranh giới, không suppression.
- Không thể tạo baseline vì tree đã dirty bởi việc khác → dừng; baseline trộn state không chứng minh gì.

## ĐẦU RA

Nói `layoutId`, applied revision, path chính và proof bằng văn xuôi ngắn. Proof chạy được là `own` và phải chạy trước
khi hết lượt; chỉ quyết định thẩm quyền thật mới nằm dưới `### NEED APPROVALS`.
