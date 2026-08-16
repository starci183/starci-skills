---
id: fe-layouts-laws-l9-sticky-offset-is-page-local-audit
title: audit.md
slug: /fe/layouts/laws/l9-sticky-offset-is-page-local/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện luật L9: chỗ nó phân định được, chỗ repo sống đang tuân, và hai khoản nợ gate khiến hai mã chưa khai được vào LayoutPlan.
---

# audit.md

> Phiên bản: `1.00` · Mô-đun: `l9-sticky-offset-is-page-local`

Phản biện này kiểm xem luật có chọn được đúng một mã từ **chrome đã đếm được của trang**, và chỉ từ đó.

## Kết luận

Chấp nhận, với hai khoản nợ ở phía gate, một rủi ro cấu trúc chưa khép thuộc về luật hàng xóm, và một
mâu thuẫn chéo với
[`l10-region-width-belongs-to-its-owner`](../l10-region-width-belongs-to-its-owner/INDEX.md) ghi ở
mục riêng bên dưới và ghi đối xứng bên ấy.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `L9-3` so với `L9-4` | Loại trừ được bằng số hàng chrome **ghim** của trang, không bằng số băng ngang nhìn thấy |
| `L9-1` so với `L9-2` | Loại trừ được bằng việc hàng đó nằm trong container đã ghim hay tự ghim |
| `L9-5` so với "quên ghim" | Loại trừ được khi có `why` hoặc phán quyết đứng sau; không có thì là câu hỏi, không phải mã |
| `L9-6` so với `L9-5` | Loại trừ được bằng việc có ghim hay không, chứ không bằng việc có offset hay không |
| `L9-7` so với mọi mã | Loại trừ được bằng việc token đã tồn tại trong `@theme` hay chưa |
| Thiếu bằng chứng về chiều cao chrome | Rơi về `L9-7`, không rơi về "lấy tạm `top-rail`" |
| Có nên ghim hay không | **Không thuộc mô-đun này.** Đó là `L3` trong [`sticky-chrome-band`](../../archetypes/sticky-chrome-band/INDEX.md) |
| Vùng ghim rộng bao nhiêu, nhắm bằng gì | **Không thuộc mô-đun này.** Đó là `L10` |
| Cuộn bên trong vẽ bằng gì | **Không thuộc kệ này.** Vendor scroll surface là chuyện của `blocks` |

## Repo sống đang ở đâu

**Đang tuân, ở cả chín chỗ đặt `sticky` trong registry.** Đếm đủ: `double-navbar:1692` là `L9-1`;
`course-section-navigation:2228` là `L9-2`; `learn-shell-frame:338-341` và hai con của
`content-reader-frame:1952-1958` là `L9-3`; `main-then-rail:2235` là `L9-4`;
`learn-mobile-tab-bar:324` và `course-mobile-action-bar:2581` là `L9-6`. Hai layout rail còn lại,
`dashboard-rail-then-main:1049` và `profile-rail-then-main:804-811`, không mang class sticky nào và
là `L9-5`.

Không chỗ nào viết một giá trị offset thẳng tay. Cả hai cặp token định nghĩa đúng một lần trong
`globals.css:40-64`, kèm bình luận nói ra cơ chế.

Câu "đang tuân ở cả chín chỗ" ở trên **chỉ đúng cho giá trị offset và trần**, không đúng cho việc chỗ
ghim ấy rơi trúng vùng nào. Một trong chín chỗ đang rơi trúng nhầm vùng, và đó là mâu thuẫn ghi ngay
dưới đây.

## Mâu thuẫn chéo

**Ngoại lệ "Two pinned siblings on one page" của mô-đun này và `L10-2` cùng áp một tình huống và ra
hai kết quả.** Tình huống: con cuối đang được ghim của `content-reader-frame`.

| Mô-đun | Câu | Kết quả cho cùng tình huống ấy |
|---|---|---|
| `L9` | Ngoại lệ: "`content-reader-frame` pins its first and last children to the same `top-rail` with the same `max-h-rail`. One page, one chrome, one offset — two regions sharing it is **not a conflict**." | Hợp lệ, `L9-3`, không có gì phải ghi. |
| `L10` | `L10-2`: con nào của hàng là `optional`, `repeats` hay leaf thì chiều rộng phải nhắm theo danh tính, "**never `*:first-child` or `*:last-child`**"; `audit.md` của `L10` gọi thẳng `content-reader-frame:1956` là "vi phạm đang chạy". | Vi phạm. Phải đổi sang `[data-node=content-outline-rail]`. |

Bằng chứng đứng về phía `L10`, và nó đụng thẳng vào phần việc của `L9` chứ không chỉ vào chiều rộng.
`content-reader-frame` khai con cuối `outline` là `optional: true` tại
`D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:1964`, và
`src\components\pages\CourseLearnContentPage\component.tsx:540` bỏ hẳn slot ấy khi bài học không có
heading nào. Ở đúng trạng thái đó, `*:last-child` là cột đọc `main`, nên cột đọc nhận nguyên cụm
`sticky top-rail max-h-rail overflow-y-auto` tại `:1957-1959`. Nghĩa là nội dung chính của trang học
bị ghim và bị đóng trần — hỏng ở đúng cái mà `L9` phán, không phải ở chiều rộng.

Vì thế `L9` đang đếm nhầm: chỗ ghim thứ chín không phải "hai anh em cùng chia một offset" mà là "một
selector vị trí có hai đích tuỳ dữ liệu, một trong hai đích sai". Ngoại lệ ấy đúng khi outline có
mặt và sai khi outline vắng, tức nó là một ngoại lệ phụ thuộc trạng thái mà không nêu trạng thái.

Sửa được bằng hai việc, cả hai là thay đổi luật nên chỉ được ghi: ngoại lệ "Two pinned siblings" phải
nêu điều kiện rằng cả hai đích được nhắm theo danh tính, và `L9` phải nhận một invariant rằng đích
của một class ghim chịu đúng phép thử danh tính mà `L10-2` đặt ra — nếu không, `L9` đo giá trị đúng
trên một vùng sai.

## Nợ đã đo được

- **Nợ gate, `maxHeightToken`.** `gate.schema.json:310-314` cho enum đúng hai giá trị, `max-h-rail`
  và `khong-gioi-han`. Trần của rail giá không nằm trong đó, nên `L9-4` hôm nay **không khai được**
  vào `LayoutPlan`: một plan cho trang chi tiết khoá học buộc phải nói dối là vùng không có trần.
  Neo yêu cầu: `D:\Repositories\starci-academy-fe\src\app\globals.css:64`.
- **Nợ gate, `stickyOffsetToken`.** Cùng file, `:305-309`, enum ba giá trị và không giá trị nào diễn
  tả được ghim đáy. `L9-6` vì thế cũng không khai được, và hai thanh đáy đang sống sẽ bị một plan
  trung thực ghi thành `khong-sticky`, tức sai.
  Neo: `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:324`, `:2581`.
- **Nợ đọc, chủ của trần bị tách đôi.** `L9-4` là chỗ duy nhất ghim và trần nằm ở hai chủ khác nhau,
  khung viết ghim còn stylesheet viết trần theo `data-scroll-inside="pricing-rail"`. Luật xử lý bằng
  cách bắt khai `capOwner`, nhưng đó là kỷ luật đọc chứ không phải máy chặn.
  Neo: `D:\Repositories\starci-academy-fe\src\app\globals.css:363-377`.

## Nhận định

- Luật này bị bác năm lần trên hai hồ sơ, và cả năm lần đều rơi vào đúng một trang. Điều đó không có
  nghĩa nó dễ, mà có nghĩa trang chi tiết khoá học là trang duy nhất tính đến nay có chrome hai hàng
  ghim. Trang thứ hai như thế xuất hiện là luật này lập tức được thử lại từ đầu.
- Mã `L9-5` phát ra "không gì cả" và đó là một tình huống. Dashboard đã ghi lý do vào `why` của nó,
  còn trang hồ sơ thì chưa, nên một nửa bằng chứng của mã này là suy từ việc thiếu class sticky.
- `L9-7` chưa có ca sống nào làm đúng. Hai lần đã ghi đều là phát hiện sau khi con số đã được viết
  ra, nên mã này đang được giữ bằng hai phán quyết cũ chứ không bằng một quy trình đã chạy.
- Rủi ro cấu trúc còn mở, thuộc `L3` chứ không thuộc mã này: course detail có hai landmark `nav`
  chồng nhau trong khi Dashboard chỉ có một, và `why` tại `contracts/index.ts:2230` phải viện đến
  chuyện phủ lên nét kẻ đáy đúng một pixel để biện minh rằng kết quả giống Dashboard. Với `L9` cả
  hai trang đều hợp lệ vì cả hai trừ đúng chrome của mình, nhưng "giống nhau khi nhìn" ở đây không
  kéo theo "giống nhau về cấu trúc".
- Chưa đo bằng ảnh chụp. Mọi câu về một pixel chồng lấn, về đường kẻ đơn dưới khối hai hàng và về
  rail chui xuống dưới navbar trong tài liệu này suy từ contract, CSS và phán quyết cũ, không từ một
  lần render dưới cùng route, viewport, theme và persona. Giá trị px thật của `md:` trong repo này
  cũng chưa được đo.
