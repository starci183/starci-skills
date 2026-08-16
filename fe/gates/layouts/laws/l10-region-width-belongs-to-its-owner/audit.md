---
id: fe-layouts-laws-l10-region-width-belongs-to-its-owner-audit
title: audit.md
slug: /gates/layouts/laws/l10-region-width-belongs-to-its-owner/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện luật L10: chỗ nó phân định được, chỗ repo sống đang lệch, và bốn khoản nợ đã đo được.
---

# audit.md

> Phiên bản: `1.00` · Mô-đun: `l10-region-width-belongs-to-its-owner`

Phản biện này kiểm xem luật có chọn được đúng một mã từ **quan hệ đã nêu**, và chỉ từ đó.

## Kết luận

Chấp nhận, với một vi phạm đang chạy trong repo sống, ba khoản nợ khác đã đo được, và một mâu thuẫn
chéo với [`l9-sticky-offset-is-page-local`](../l9-sticky-offset-is-page-local/INDEX.md) ghi ở mục
riêng bên dưới và ghi đối xứng bên ấy.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `L10-1` so với `L10-2` | Loại trừ được khi đã nêu mọi con trong hàng là bắt buộc hay có con optional, lặp, hoặc leaf |
| `L10-1` so với `L10-5` | Loại trừ được bằng việc chủ hàng có phát chiều rộng hay không; không phát thì vùng con là chủ |
| `L10-3` so với `L10-1` | Loại trừ được bằng loại số đo: `max-w-*` cho cả trang, `w-*` cho một vùng trong hàng |
| `L10-4` so với mọi mã | Loại trừ được bằng câu hỏi có đang sửa hay đang dựng; `L10-4` chỉ áp lúc sửa |
| `L10-6` so với `L10-1` | Loại trừ được bằng việc hai thứ cạnh nhau có được `LayoutPlan` gọi tên là region hay không |
| Chiều rộng của một điều khiển | KHÔNG thuộc L10. Thầy đã ra phán quyết cả hai chiều trên cùng một điều khiển, và tiêu chí nằm ở [`l4`](../l4-tab-switches-panel-route-switches-page/INDEX.md). Neo hai đầu: `.workflows\fidel\starci-academy\dashboard-contribution-primary-tabs.md:82` và `:291` |
| Chỗ vùng đó dừng lại khi ghim | KHÔNG thuộc L10. `top-*` và `max-h-*` là [`l9`](../l9-sticky-offset-is-page-local/INDEX.md), dù chúng nằm chung một mảng `classes` với chiều rộng |
| Khoảng cách và đường phân cách giữa hai cột | KHÔNG thuộc L10. `gap-*` và `border-r` thuộc `gates/principles` |
| Thiếu bằng chứng về chủ hàng | Rơi về `L10-4`, tức phải đi liệt kê chủ trước, chứ không rơi về "sửa cái grep thấy đầu tiên" |

Chỗ dễ trượt nhất là dòng thứ bảy. `content-reader-frame` gói `w-72`, `sticky`, `top-rail` và
`max-h-rail` vào cùng một chuỗi selector, nên đọc lướt sẽ tưởng đó là một quyết định. Đó là hai
quyết định của hai luật, và chúng có thể sai độc lập với nhau.

## Repo sống đang ở đâu

**Tuân phần lớn, và lệch ở đúng hai chỗ đo được.**

Bảy contract đang giữ một số đo rail cố định. Sáu trong số đó do chủ hàng phát:
`learn-shell-frame:335`, `personal-project-workspace-frame:388`, `dashboard-rail-then-main:1049`,
`content-reader-frame:1951` và `:1956`, `main-then-rail:2234`, `global-search-body:2858`. Một do vùng
con tự khai, `profile-identity-rail:813`, và đó là `L10-5` hợp lệ vì `profile-rail-then-main:805`
không phát gì.

Trong sáu chủ phát, hai chủ nhắm theo danh tính và bốn chủ nhắm theo vị trí. Trong bốn chủ nhắm theo
vị trí, hai chủ có mọi con bắt buộc nên hợp lệ, hai chủ còn lại thì không.

Vụ sửa nhầm chủ đã được hoàn nguyên và kết quả vẫn còn nguyên trong mã hôm nay: sibling
`content-reader-frame` giữ `w-72`, chỉ `main-then-rail` mang `w-80`.

## Nợ đã đo được

- **Vi phạm đang chạy.** `content-reader-frame:1956` viết `md:[&>*:last-child]:w-72` cùng `shrink-0`,
  `sticky`, `top-rail`, `max-h-rail` và `overflow-y-auto`, trong khi con cuối `outline` là optional
  tại `index.ts:1964` và trang bỏ hẳn slot đó khi bài học không có heading nào, tại
  `src/components/pages/CourseLearnContentPage/component.tsx:540`. Ở trạng thái đó cột đọc `main` vừa
  nhận `grow` từ `nth-child(2)` vừa nhận cả cụm rail từ `last-child`, tức cột nội dung chính bị khai
  thành một rail cố định, cao có trần và tự cuộn. Bản sửa đúng là chuyển sang
  `[data-node=content-outline-rail]` theo đúng cách `global-search-body` đã làm sau lần bị bác.
- **Vi phạm thứ hai, nhẹ hơn.** `personal-project-workspace-frame:388` viết
  `md:[&>*:first-child]:w-72` trong khi con đầu là `milestone` với `repeats: true` và
  `restingCount: 4` tại `index.ts:392`, nên chỉ một `NavLink` nhận cột chứ không phải cả cột mốc.
  Khoản này đã được ghi ở `## Live breaches` của [kệ layouts](../../INDEX.md) và L10 chỉ xác nhận lại
  bằng cơ chế: đây đúng là `L10-2` bị viết dưới dạng `L10-1`.
- **`why` cũ.** `nav-over-body-page:739` khẳng định số đo được đặt ở đó, còn `classes` tại
  `index.ts:734` không có `max-w` nào. Câu đúng nằm ngay dưới, ở `routed-page-main:749`. Không sửa mã
  trong lúc đo, nên nợ này được ghi chứ chưa được trả.
- **Nợ định tuyến của kệ.** Bảng `## Routing the eleven layout laws` trong [kệ layouts](../../INDEX.md)
  ghi chủ của L10 là `destination-column` với mã `SPINE-5`. Mô-đun này đang giữ L10, nên hoặc bảng đó
  cần cập nhật, hoặc `SPINE-5` cần trỏ về đây. Hai chỗ cùng nhận một luật là đúng cái hình mà chính
  luật này cấm.
- **Nợ gate.** `gate.schema.json` không có trường `code` trên `Region`, nên mã `L10-N` hôm nay chỉ
  được khẳng định trong prose của `reason.why` và không đem so máy với mô-đun được. Đây đã là một mục
  trong `## Owed` của kệ; L10 làm nó cụ thể hơn ở chỗ selector là thứ kiểm được bằng máy, vì
  `data-node` bằng đúng khoá contract tại `index.ts:2930`.

## Mâu thuẫn chéo

**`L10-2` và ngoại lệ "Two pinned siblings on one page" của `L9` cùng áp một tình huống và ra hai kết
quả.** Tình huống: con cuối đang được ghim của `content-reader-frame`.

| Mô-đun | Câu | Kết quả cho cùng tình huống ấy |
|---|---|---|
| `L10` | `L10-2` cấm `*:first-child` và `*:last-child` khi hàng có con `optional`; mục `Nợ` trên gọi `content-reader-frame:1956` là "vi phạm đang chạy". | Vi phạm. Đổi sang `[data-node=content-outline-rail]`. |
| `L9` | Ngoại lệ: "`content-reader-frame` pins its first and last children to the same `top-rail` with the same `max-h-rail`. One page, one chrome, one offset — two regions sharing it is **not a conflict**"; `audit.md` của `L9` đếm chỗ này vào "đang tuân ở cả chín chỗ đặt `sticky`". | Hợp lệ, `L9-3`, không có gì phải ghi. |

Đây không phải hai mô-đun nói về hai class khác nhau trong cùng một mảng. Cùng một selector
`md:[&>*:last-child]` mang cả `w-72` lẫn `sticky top-rail max-h-rail overflow-y-auto` tại
`index.ts:1956-1959`, nên khi đích của nó sai thì **cả hai luật cùng sai một lượt**: cột đọc `main`
vừa bị khai thành rail cố định, vừa bị ghim và đóng trần. Chính dòng thứ bảy của bảng `Kiểm phân
định` ở trên đã cảnh báo rằng bốn class ấy là hai quyết định của hai luật; điều chưa được nói là hai
luật ấy đang cho hai phán quyết ngược nhau về cùng một dòng mã.

`L9` là bên đếm nhầm, không phải bên phát biểu sai: giá trị offset của nó đúng, chỉ có vùng nhận
offset là không xác định. Bản sửa nằm ở phía `L9` — ngoại lệ ấy phải nêu điều kiện rằng cả hai đích
được nhắm theo danh tính — nên nó được ghi ở cả hai chỗ và không được sửa từ mô-đun này.

## Nhận định

- Luật này mạnh vì nó có một phép thử máy làm được: đọc `children` của một contract, nếu có bất kỳ
  `optional: true` hoặc `repeats: true` nào thì mọi selector `*:first-child` và `*:last-child` trong
  `classes` của contract đó là sai. Phép thử ấy tìm ra hai chỗ trong registry, và cả hai đều là lỗi
  thật.
- Điểm yếu là `L10-4`. Nó nói về hành vi lúc sửa chứ không về hình dạng mã, nên không gate nào bắt
  được. Cái duy nhất bắt được lần sửa nhầm trước đây là live proof, và live proof phụ thuộc vào việc
  người sửa có mở đúng trang thứ hai lên hay không.
- `L10-5` đang đứng trên đúng một ví dụ. Một ví dụ không đủ để gọi là quy ước thứ hai, nhưng cũng
  không được phép viết thành vi phạm, vì trong trường hợp ấy không có ai khác đang giữ số đo. Nếu
  xuất hiện ví dụ thứ hai thì phải hỏi lại vì sao hai quy ước cùng tồn tại, thay vì thêm mã mới.
- Câu về ngưỡng vẫn còn mỏng. Repo có đúng một chỗ dùng `@app-md` và phần còn lại dùng `md:`, nên
  luật buộc khai ngưỡng nhưng chưa có tiêu chí nào nói khi nào phải chọn container thay vì viewport.
  Ghi là nợ chứ không đoán.
- Chưa đo bằng ảnh chụp. Mọi câu về cột đọc bị biến thành rail, về copy bị dồn ở zoom 150% và về
  288px co còn 273px trong tài liệu này suy từ contract, từ bình luận trong registry và từ phán quyết
  cũ, không từ một lần render dưới cùng route, viewport, locale, theme và persona.
