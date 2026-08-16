---
id: fe-layouts-laws-l4-tab-switches-panel-route-switches-page-audit
title: audit.md
slug: /gates/layouts/laws/l4-tab-switches-panel-route-switches-page/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện luật L4: chỗ nó phân định được, chỗ repo sống đang tuân, bốn khoản nợ đã đo và những gì chưa đo được.
---

# audit.md

> Phiên bản: `1.00` · Mô-đun: `l4-tab-switches-panel-route-switches-page`

Phản biện này kiểm xem luật có chọn được đúng một mã từ **quan hệ đã nêu**, và chỉ từ đó.

## Kết luận

Chấp nhận, với bốn khoản nợ đã đo được ở phía repo sống và một mã chưa có bằng chứng sống.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `L4-1` so với `L4-2` | Loại trừ được khi đã nêu người đọc sang chủ trang khác hay ở lại cùng chủ |
| `L4-2` so với `L4-3` | Loại trừ được **chỉ khi** đã nêu khả năng gửi link; chưa nêu thì rơi về `L4-7`, không rơi về mặc định |
| `L4-2` so với `L4-5` | Loại trừ được bằng handler, không bằng chỗ đặt và không bằng leaf |
| `L4-4` so với `L4-2` | Loại trừ được khi đã nêu cái bị đổi là một khối hay là vùng nội dung của trang |
| `L4-4` so với `L4-5` | Loại trừ được bằng việc có cuộn hay không; cả hai đều không đụng URL nên chỉ hành vi phân biệt |
| `L4-6` so với `L4-1` | Loại trừ được bằng số điều khiển: một nút hai vai trò luôn là `L4-6` viết sai |
| Thiếu bằng chứng về khả năng gửi | Rơi về `L4-7`, không rơi về "cứ dùng query cho chắc" |
| Chỗ đặt, bề rộng, seam, offset | Không thuộc mô-đun này; thuộc [`sticky-chrome-band`](../../archetypes/sticky-chrome-band/INDEX.md) |
| Đích của một route không có nội dung | Không thuộc mô-đun này; thuộc [`SPINE-6`](../../archetypes/destination-column/INDEX.md) |

Chỗ dễ lấn sang kệ khác nhất là `L4-4`, vì kết luận của nó nói tới bề rộng. Mô-đun này chỉ được nói
rằng một tham số **không** chiếm cả measure, và nói vậy vì lý do đọc hiểu chứ không vì lý do nhịp
điệu. Con số cụ thể, khoảng đệm và seam vẫn do kệ khác quyết.

## Repo sống đang ở đâu

**Đang tuân**, và bảy mã phủ hết những điều khiển đã đo. Bốn dải tab dùng chung một họ leaf mà làm
bốn việc khác nhau, và mỗi cái đều nằm đúng mã của nó.

| Chỗ | Mã | Bằng chứng |
|---|---|---|
| Destination trên navbar | `L4-1` | `ShellNav\index.tsx:137` |
| Bốn tab dashboard | `L4-2` | `ShellNav\index.tsx:132`, đọc lại ở `DashboardPage\index.tsx:30-31` |
| Dải tab mobile của trang học | `L4-3` | `LearnShellLayout\index.tsx:192-195` |
| Chọn năm, đổi phạm vi, đổi lưới/danh sách | `L4-4` | `contracts\index.ts:1244-1251`, `:1504-1510`, `:2092-2098` |
| Bốn nút section trang chi tiết khoá | `L4-5` | `CourseDetailPage\index.tsx:133-140` |
| Chọn và mở trong Global Search | `L4-6` | `GlobalSearchOverlay\index.tsx:184-185`, `:144-149` |

Không tìm thấy chỗ nào một điều khiển vừa đẩy route vừa đổi panel, và không tìm thấy `push` nào
dùng cho một panel switch.

## Nợ đã đo được

- **Từ vựng panel của một trang nằm trong navbar.** Bốn key `overview`, `explore`, `courses`,
  `community` được khai ở `ShellNav\index.tsx:36-41`, và đường `/dashboard` viết cứng ở `:132`. Trang
  đọc lại key ở `DashboardPage\index.tsx:30-31` nên nửa "trang tự quyết" của `L4-2` vẫn đúng, nhưng
  nửa ghi thì thuộc về chrome. Hệ quả trực tiếp: một trang thứ hai muốn panel gửi được sẽ phải sửa
  navbar, và đó là lý do `INDEX.md` ghi dashboard là `L4-2` duy nhất chứ không ghi nó là khuôn mẫu.
  Neo: `D:\Repositories\starci-academy-fe\src\components\layouts\ShellNav\index.tsx:36-41`.
- **`L4-5` gọi đích theo thứ tự, không theo danh tính.** `sections.item(2)`, `.item(3)`, `.item(4)`
  tại `CourseDetailPage\index.tsx:137-139` chọn đích bằng vị trí trong kết quả `querySelectorAll`.
  Chèn hoặc đổi chỗ một section là ba nút cuối trỏ sai mà không có lỗi nào nổi lên. Đây đúng kiểu
  hỏng mà [`SPINE-4`](../../archetypes/destination-column/INDEX.md) đã ghi cho chiều rộng, lặp lại ở một chỗ
  khác. Riêng `overview` thì gọi đúng theo danh tính bằng `[data-node="course-hero-heading"]`, nên
  trong cùng một hàm có cả cách đúng lẫn cách sai.
  Neo: `D:\Repositories\starci-academy-fe\src\components\pages\CourseDetailPage\index.tsx:135-139`.
- **Một bộ tab `L4-3` không route nào chạm tới.** `TODAY_TABS` khai ba view ở
  `LearnShellLayout\index.tsx:95-99` và chỉ được chọn khi `isToday`, mà `isToday` là
  `pathname === ${base}/learn` ở `:128`. Route đó `redirect()` sang `/learn/content`, nên `isToday`
  không bao giờ đúng và `:158` không bao giờ chọn `TODAY_TABS`. Phần page owner mồ côi của cùng khoản
  nợ này thuộc `L5`; phần thuộc `L4` là một từ vựng tab sống trong mã mà không điều khiển nào phát ra
  được.
  Neo: `D:\Repositories\starci-academy-fe\src\components\layouts\LearnShellLayout\index.tsx:128`,
  `:95-99`, `:158`.
- **Không có dấu hiệu máy đọc được để tách `L4-2` khỏi `L4-5`.** Dashboard dùng
  `underlined-tab-strip` với leaf `extended-tabs` (`contracts\index.ts:1739-1745`), còn trang chi
  tiết khoá dùng `course-section-navigation` với leaf `choice-tabs` (`:2226-2231`). Leaf khác nhau
  nhưng không giúp gì, vì `choice-tabs` cũng chính là leaf của cả ba chỗ `L4-4`. Thứ duy nhất phân
  biệt được là văn xuôi trong `why`, và văn xuôi thì gate không đọc.
  Neo: `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:1742`, `:2229`.

## Nhận định

- Luật này viết ra từ một lần thầy tự lật, và bản cũ bị lật vì nó trộn hai câu hỏi vào một chữ. Chữ
  `primary` vừa được hiểu là cách vẽ vừa được hiểu là vai trò, nên "đây là điều khiển chính" bị đọc
  thành "đây là điều hướng vùng". Bản `1.00` tách hai câu hỏi ra và tiêu chí phân định là *cái nút
  này đổi cái gì*, kiểm được từ handler chứ không từ tính từ.
- `L4-7` phát ra "không gì cả" và đó là một tình huống, không phải một chỗ trống. Nó cũng là mã duy
  nhất chưa có ví dụ sống, vì mọi tab đang chạy đều đã có phán quyết. Một mã không có bằng chứng vẫn
  đứng được ở đây bởi nó nói về lúc bằng chứng vắng mặt, nhưng cần ghi rõ là chưa có chứ không nên để
  người đọc tưởng nó đã được thử.
- Điểm yếu còn lại nằm ở `shareability`. Nó là input mà nguồn duy nhất hợp lệ là lời của thầy, nên
  gate chỉ bắt được phần hình thức là có khai hay không. Chưa có cách nào chặn một chữ
  `must-survive-reload` điền cho đủ thủ tục.
- Chưa đo bằng trình duyệt. Câu "panel switch không sinh bước lịch sử" suy từ ngữ nghĩa của
  `router.replace` chứ không từ một lần bấm Back thật, và câu "key lạ rơi về panel nghỉ" suy từ
  `DashboardPage\index.tsx:31` chứ không từ một lần gõ tay `?tab=xyz`. Cả hai đều là *suy luận từ
  neo code*, chưa phải proof runtime.
- Chưa đo bằng ảnh chụp. Mọi câu về "một dải rộng hết cột được đọc như điều hướng vùng" trong tài
  liệu này suy từ contract, từ bình luận trong mã và từ phán quyết cũ, không từ một lần render dưới
  cùng route, viewport, theme và persona.
