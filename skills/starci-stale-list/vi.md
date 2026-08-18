---
title: Stale project list · Vietnamese
---

# starci-stale-list

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@assurance-be` | `compilers/patterns/be/delivery-assurance` | module | định nghĩa trọn backend machine cho hook, CI, coverage, analysis, secret và deploy |
| `@export-state` | `scripts/export-console-state.mjs` | script | đo mọi stale fact chỉ-đọc và gate surface đã khai báo |
| `@skill-shape` | `skills/skill-shape` | module | hợp đồng báo cáo chung mà mọi skill đều đọc |

## NESTED SKILLS

Không có. Skill chỉ báo ownership; nó không tự gọi capability được nêu tên.

## Cách chạy

Đọc `@skill-shape` trước. Đây là lượt chỉ lập báo cáo: vừa sửa thứ đang đo thì kết quả không còn đáng tin.

## Tám thứ stale, nhưng danh sách không biến thành repair

Danh sách dùng đúng taxonomy của `starci-repair` để handoff không giấu việc:

| Thứ stale | Skill này đo được gì | Cleared by |
|---|---|---|
| **route** | checkout, contract, branch và recorded head so với filesystem/git | `starci-init` |
| **source** | gate entrypoint manifest khai báo; pass/fail luôn ghi rõ là chưa đo | `starci-repair`, sau approval |
| **index** | contract `why` đang tả shape thay vì nói need | `starci-repair`, pass `why` |
| **machine** | canon package đã cài theo package name, absent hay vendored | `starci-repair`, machine pass |
| **formatter** | package Prettier trực tiếp và config/script/hook/CI/editor integration first-party | `starci-repair`, strict-fix pass |
| **assurance** | mọi local `ASSURANCE-*` fact cho backend route; required GitHub check và secret value luôn ghi rõ là external | `starci-repair`, assurance pass |
| **structure** | tier `shells` dưới production component root được chấp nhận, kể cả directory rỗng | `starci-repair`, retired-structure pass |
| **remnant** | `.claude/` lồng trong routed checkout, kèm recursive/tracked counts | `starci-repair`, remnant pass; content tracked trả về owner |

Skill đo bảy loại và nói thẳng boundary của source: đọc gate declaration nhưng không chạy gate. Typecheck
và build ghi state; một báo cáo làm đổi machine nó đo không còn là measurement. Chỉ chạy lint cũng gây
hiểu lầm rằng các gate còn lại đã được đo.

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

Script đọc route config, kiểm tra filesystem/git, parse contract index, đọc lint wiring và đo backend
assurance theo `@assurance-be`; nó không chạy lint, typecheck, build hay test.

### 3 — Báo theo project, không theo role

Gom role của cùng project vào một hàng nhưng giữ verdict từng role. Route `stale` khi cấu trúc hợp lệ mà
sự thật đã đổi; `absent` khi role chưa có route; unparseable là `invalid`, không ép vào hai loại kia.

### 4 — Nêu source gate surface mà không tuyên bố kết quả

Đọc manifest của mỗi routed checkout và liệt kê primary entrypoint đã khai báo: format, lint, typecheck,
build, tests. `declared` không có nghĩa `green`. Repository không khai báo gate nào là finding của
`starci-repair`; thiếu riêng một command chỉ có nghĩa repository không có command đó, skill không tự tạo.

### 5 — Đặt contract index cạnh route

Báo số reason không thể tìm theo need và evidence cụ thể. Một count chỉ là tín hiệu; recorded miss từ
lookup thật có ưu tiên cao hơn.

### 6 — Báo lint machine vì nó quyết định count có nghĩa không

Mỗi role nhận `installed`, `absent` hoặc `vendored` cùng relative path. Khi machine không `installed`, mọi
lint count đều không phải evidence: absent nghĩa không kiểm gì, vendored nghĩa đo bằng bản sao riêng.

### 7 — Đo backend delivery assurance như một machine không thể cắt nhỏ

Với mỗi backend route, báo mọi `ASSURANCE-*` fact còn thiếu: Husky và pre-push check-only, active PR CI,
một unit run sinh LCOV, Codecov upload, SonarQube scan cộng quality gate, encrypted stack token record,
symbolic workflow secret reference và deploy dependency. Cài một phần vẫn là stale.

Chỉ đọc tên và wiring. Không decrypt stack record hay in provider value. Required GitHub check,
expected-app binding và GitHub secret value là external fact; nếu không có authorized API evidence thì
ghi `unmeasured external`.

### 8 — Đo trực tiếp formatter, retired structure và remnant

Formatter chỉ xét integration point first-party; nhắc đến Prettier trong prose hoặc transitive lockfile
không phải formatter ownership. Retired structure được inventory trực tiếp trong production component
root vì Git không thấy directory `shells/` rỗng; candidate/artifact tree không phải production root.

Với mỗi `.claude/` lồng, đếm file recursively và file tracked riêng. Content tracked không bao giờ được
mô tả là an toàn để xóa; `starci-repair` trả quyết định đó về owner.

### 9 — Tách warning không phải stale source

Mỗi warning vẫn phải có owner. Thiếu worktree root là setup có điều kiện, không phải source stale; route
invalid không bị ép thành `stale` hay `absent`.

### 10 — Dừng tại đó

Nói cái gì stale, vì sao và ai xử lý. Không refresh head, repoint path, declare contract hay sửa source;
nếu làm vậy báo cáo sẽ trở thành thứ thay đổi machine nó vừa đo.

## Điểm dừng

- `.workspace` không tồn tại → dừng; báo Source chưa có route rồi kết thúc lượt chạy.
- Route có nhưng parse lỗi → báo một hàng `invalid`; không gọi nó stale hay absent.
- Người đọc yêu cầu sửa → hoàn tất báo cáo. Việc sửa cần request và lượt chạy riêng của owner; skill này
  không tự khởi chạy nó.

## ĐẦU RA

Trả đủ từng stale category, evidence và owner bằng văn xuôi ngắn; ghi clean hoặc unmeasured ở nơi im lặng
sẽ khiến người đọc tưởng đã kiểm. Với assurance, chỉ trả secret name và encrypted-record presence, không
bao giờ trả value. Scan hết mọi category chỉ-đọc trước khi đóng. Chỉ hỏi boundary thẩm quyền thật dưới
`### NEED APPROVALS`. Không dùng status table.
