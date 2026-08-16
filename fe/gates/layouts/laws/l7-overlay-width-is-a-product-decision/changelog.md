---
id: fe-layouts-laws-l7-overlay-width-is-a-product-decision-changelog
title: changelog.md
slug: /gates/layouts/laws/l7-overlay-width-is-a-product-decision/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật L7.
---

# changelog.md

> Phiên bản hiện tại: `1.00` · Mô-đun: `l7-overlay-width-is-a-product-decision`

## Quy tắc phiên bản

Một thay đổi luật được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Thêm
một mã tình huống là bump nhỏ. Đổi câu `Law` là bump lớn cho cả kệ, vì
[`l6-overlay-is-already-a-surface`](../l6-overlay-is-already-a-surface/INDEX.md) viện mô-đun này cho
chuyện chiều rộng và các mô-đun archetype đi qua nó ở hàng overlay của chúng. Đổi `enum` của trường
`width` là thay đổi GATE và phải làm ở [`gate.schema.json`](../../gate.schema.json) trước.

## Nghiệm thu — 2026-08-17

Đợt kiểm sau khi lập mô-đun. Không đổi câu `Law`, không thêm bớt mã tình huống, nên **không bump
phiên bản**.

- **Sửa một câu đã cũ ngay trong mục `Scope`.** Câu ấy viết rằng hình dạng của một điều khiển bên
  trong overlay "là `L11`, still owed on the shelf". `L11` đã có mô-đun, nên câu ấy nay là một link
  và nói rõ `L11-4` đóng ca gọn bằng cách trả mặt bounded về `L6`.
- **Hàng `L7` của bảng định tuyến kệ nay là một link**, Kind là `fixed`. Đó là thay đổi kệ và dòng
  phiên bản của kệ tăng lên `1.01`.
- **Kiểm lại toàn bộ neo.** Hai neo TỪ CHỐI khớp nguyên văn, và mọi neo CODE mở được — kể cả bốn neo
  đi vào `node_modules` của vendor và hai neo đi vào `gate.schema.json`.

## 1.00 — 2026-08-17

Mô-đun được lập lần đầu trên kệ `gates/layouts/`, biến `L7` từ một hàng **owed** trong bảng định tuyến
của kệ thành một mô-đun có chủ. Nguồn: hai dòng từ chối đứng liền nhau trong một hồ sơ, cộng một lần
đo hết bốn overlay modal, hai drawer và một dropdown đang chạy, cùng bảng class của vendor đứng sau
thang `size`.

- **Đặt bảy mã tình huống.** `L7-1` đến `L7-7`, trong đó `L7-5` phát ra một lời từ chối và `L7-7` phát
  ra một khoản nợ, mà cả hai vẫn là tình huống đã được phân loại chứ không phải chỗ trống.
- **Phát biểu luật ở tầng lý do chứ không ở tầng giá trị.** Hai dòng bác đều nhắm vào lý do: dòng
  `:259` bác một giả định, dòng `:260` bác hai direction bằng việc người đọc không làm được gì trong
  đó. Một bản viết theo giá trị sẽ hết hiệu lực ở overlay tiếp theo.
  Neo: `.workflows\designs\starci-academy\global-search-modal-20260815.md:259` và `:260`.
- **Đặt `narrowerBreak` thành một input bắt buộc.** Đây là thứ phân biệt một phép đo với một sở thích,
  và nó lấy hình mẫu từ chỗ duy nhất trong repo sống ghi lý do ngay cạnh giá trị.
  Neo: `D:\Repositories\starci-academy-fe\src\components\overlays\courses\CoursePriceOverlay\component.tsx:20-22`.
- **Sửa lại con số trong bằng chứng nhận được.** Bằng chứng giao cho mô-đun này nói "chỉ đo được một
  giá trị". Đo lại thì có ba giá trị đang chạy: `xs` ở `SignInOverlay:39`, `sm` ở
  `CoursePriceOverlay:41` và `CheckoutOverlay:121`, `cover` ở `GlobalSearchOverlay:193`. Vì vậy mô-đun
  không viết `Owed` cho một giá trị chưa đo mà viết `Owed` cho ba lý do chưa được ghi tại chỗ.
- **Quy thang `size` ra số đo thật.** `size` chọn một class modifier của vendor, bốn nấc đầu là
  `max-w-xs` tới `max-w-lg` tức `20rem` tới `32rem`, `cover` là `w-full h-full`, và repo không ghi đè
  bốn token ấy. Nhờ đó nấc của shell so trực tiếp được với `max-w-*` mà một contract bên trong tự
  khai, và câu "ai đang thắng" trả lời được bằng số.
  Neo: `node_modules\@heroui\styles\dist\components\modal.css:220-250`,
  `node_modules\@heroui\styles\dist\components\modal\modal.styles.js:33-53`,
  `node_modules\tailwindcss\theme.css:335-338`, `src\app\globals.css:35-38`.
- **Đặt `L7-6` để im lặng thôi là một chỗ trống.** Mặc định thật của mã là `md`, không phải chữ "hẹp",
  nên không khai gì vẫn là chọn, chỉ là chọn mà chưa phán.
  Neo: `D:\Repositories\starci-academy-fe\src\components\shells\ModalShell\index.tsx:36`.
- **Nói thẳng rằng chiều rộng drawer chưa biểu diễn được, thay vì bịa một thang drawer.**
  `DrawerShell` không có prop `size`; thứ duy nhất khai được là cạnh mở, `CartDrawer` không truyền cả
  cạnh, và `StarCiAiDrawer` chỉ suy cạnh từ viewport. `DropdownShell` cũng vậy.
  Neo: `…\shells\DrawerShell\index.tsx:33,40,62`, `…\overlays\commerce\CartDrawer\component.tsx:116-120`,
  `…\overlays\ai\StarCiAiDrawer\index.tsx:19`, `…\shells\DropdownShell\index.tsx:6`.
- **Đẩy ba thứ ra khỏi mô-đun và ghi tên chủ của chúng.** Ranh giới bên trong overlay là `L6`, chia
  phần bên trong là `L10`, và điều khiển chạy hết chiều ngang hay đứng gọn là `L11` còn đang nợ. Ba
  cột `w-72 / grow / w-72` của `global-search-body` bị nhắc tới trong mô-đun này chỉ để nói rằng
  chúng không thuộc về nó.
- **Ghi mâu thuẫn với gate vào [`audit.md`](./audit.md) thay vì tự sửa schema.**
  `gate.schema.json:382-385` khai `enum` là `["cover", "chua-do-duoc"]` và `$comment` ở `:384` khẳng
  định ngoài `cover` thì không có giá trị nào khác đo được. Câu ấy sai với nguồn, nên một plan cho
  `SignInOverlay` hôm nay buộc phải khai `chua-do-duoc` cho một giá trị đã đo. Sửa là thay đổi GATE và
  làm ở schema trước.
- **Sửa lời viện dẫn trong `L6`.** `l6-overlay-is-already-a-surface/INDEX.md` nhắc `L7` ba chỗ dưới
  dạng chữ trần; cả ba nay trỏ sang mô-đun này. Bốn record còn lại của `L6` và hai chỗ trong
  [`INDEX.md` của kệ](../../INDEX.md) vẫn còn chữ trần, và điều đó được ghi trong
  [`audit.md`](./audit.md) thay vì sửa ngoài ranh giới.
