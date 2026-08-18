---
title: Stale project list · Vietnamese
---

# starci-stale-list

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@export-state` | `scripts/export-console-state.mjs` | script | đo workspace, contract và trạng thái lint machine |
| `@skill-shape` | `skills/skill-shape` | module | hợp đồng báo cáo chung mà mọi skill đều đọc |

## NESTED SKILLS

Không có. Skill chỉ báo ownership; nó không tự gọi capability được nêu tên.

## Cách chạy

Đọc `@skill-shape` trước. Đây là lượt chỉ lập báo cáo: vừa sửa thứ đang đo thì kết quả không còn đáng tin.

## Bốn tầng, và chi phí khiến chúng không thể nhập làm một

| Tầng | Cách đo | Chi phí | Cleared by |
|---|---|---|---|
| **route** | filesystem và git: checkout, head, contract còn đúng không | tức thời | `starci-init` |
| **contract index** | parse entry table: `why` nói need hay chỉ tả shape | tức thời | `starci-repair`, pass `why` |
| **lint machine** | đọc manifest và ESLint config: package đã cài hay bị vendored | tức thời | `starci-repair`, machine pass |
| **gates** | lint, typecheck, build, tests của repository | nhiều phút và có ghi output | `starci-repair` |

Skill chỉ chạy ba tầng đầu và từ chối tầng bốn. Typecheck và build ghi state; một báo cáo làm đổi mọi
machine nó đo không còn là measurement. Chỉ chạy lint cũng gây hiểu lầm rằng các gate còn lại đã được đo.

## Luật skill này bảo vệ

Danh sách phải đọc được theo project, chỉ ra lý do và owner, nhưng không thực thi project. `stale`,
`absent`, `invalid` và warning phải tách biệt vì chúng cần hành động khác nhau.

## QUY TRÌNH

### 1 — Lập context lock

`Phase` là `plan`, `Touching` là `None`. Ghi Source và thời điểm đo. Skill không ghi file nào, kể
cả record riêng; chỉ khi người đọc yêu cầu giữ lại danh sách thì nơi lưu mới được khai rõ.

### 2 — Scan bằng script của tree

```bash
node @export-state --stale
```

Script đọc route config, kiểm tra filesystem/git, parse contract index và đọc lint wiring; nó không chạy
lint, typecheck, build hay test.

### 3 — Báo theo project, không theo role

Gom role của cùng project vào một hàng nhưng giữ verdict từng role. Route `stale` khi cấu trúc hợp lệ mà
sự thật đã đổi; `absent` khi role chưa có route; unparseable là `invalid`, không ép vào hai loại kia.

### 4 — Đặt contract index cạnh route

Báo số reason không thể tìm theo need và evidence cụ thể. Một count chỉ là tín hiệu; recorded miss từ
lookup thật có ưu tiên cao hơn.

### 5 — Báo lint machine vì nó quyết định count có nghĩa không

Mỗi role nhận `installed`, `absent` hoặc `vendored` cùng relative path. Khi machine không `installed`, mọi
lint count đều không phải evidence: absent nghĩa không kiểm gì, vendored nghĩa đo bằng bản sao riêng.

### 6 — Tách warning không phải route

Contract miss và lint-machine drift không biến route thành stale. Báo riêng để owner đúng nhận đúng việc.

Checkout còn `.claude/` từ một tree cũ cũng nằm trong nhóm warning này: không gate nào của repository báo
nó, nó không phải lỗi route, và điều nó phá là niềm tin của người đọc sau rằng project sở hữu một bộ luật
riêng. Không được sửa nó bằng cách refresh route.

### 7 — Dừng tại đó

Nói cái gì stale, vì sao và ai xử lý. Không refresh head, repoint path, declare contract hay sửa source;
nếu làm vậy báo cáo sẽ trở thành thứ thay đổi machine nó vừa đo.

## Điểm dừng

- `.workspace` không tồn tại → dừng; báo Source chưa có route rồi kết thúc lượt chạy.
- Route có nhưng parse lỗi → báo một hàng `invalid`; không gọi nó stale hay absent.
- Người đọc yêu cầu sửa → hoàn tất báo cáo. Việc sửa cần request và lượt chạy riêng của owner; skill này
  không tự khởi chạy nó.

## ĐẦU RA

Trả project rollup, stale role, evidence và owner bằng văn xuôi ngắn. Scan hết mọi layer thuộc `own`
trước khi đóng. Nếu yêu cầu đã gồm repair thì handoff và tiếp tục; chỉ hỏi boundary thẩm quyền thật dưới
`### NEED APPROVALS`.
