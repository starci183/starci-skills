---
id: fe-layouts-archetypes-sticky-chrome-band-audit
title: audit.md
slug: /gates/layouts/archetypes/sticky-chrome-band/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định của luật băng chrome, và các vi phạm còn sống trong repo.
---

# audit.md

> Phiên bản: `1.00` · Mô-đun: `sticky-chrome-band`

Phản biện này kiểm xem luật có chọn được đúng một mã từ **hiệu ứng của điều khiển và cấu trúc tài
liệu**, và chỉ từ đó — không từ hình dáng, không từ tên vendor, không từ "lần trước làm thế".

## Kết luận

Chấp nhận, kèm ba vi phạm sống phải ghi vào sổ chứ không được sửa lặng lẽ trong lúc đo.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `CHROME-1` so với `CHROME-2` | Loại trừ được khi đã nêu trang có sở hữu một tập mục đóng của cùng một tài liệu hay không |
| `CHROME-3` so với `CHROME-4` | Loại trừ được bằng đúng một câu hỏi: sau khi bấm, vùng nội dung đổi hay một hình vẽ lại |
| `CHROME-5` tab so với route | Loại trừ được khi đã nêu có route thật cho từng mặt hay không |
| `CHROME-6` | Không cần phân định: hành vi đo được, và chỗ duy nhất phải cưỡng lại là suy ra một hamburger không tồn tại |
| `CHROME-7` | Loại trừ được khi đã nêu điều khiển mở nằm ở chrome hay ở trang |
| `CHROME-8` | Loại trừ được khi đã liệt kê hàng hai mang gì |
| Thiếu dữ kiện | Hỏi đúng **một** câu phân định rồi dừng; không đoán theo hình dáng |

## Nhận định

- Hình dáng đã bị loại khỏi tập tiêu chí. Cả `CHROME-3`/`CHROME-4` lẫn `CHROME-5` đều quyết bằng
  **hiệu ứng** chứ không bằng thứ nhìn thấy, đúng như hai vòng lật của founder yêu cầu.
- Tên vendor đã bị loại tường minh. Một record cả một vòng chỉ để tách "chữ `secondary` của HeroUI"
  khỏi phân cấp sản phẩm.
- L9 và L3 hoá ra là **một** luật nhìn từ hai phía: băng hai hàng cao hơn băng một hàng, nên cái dính
  dưới nó phải trừ nhiều hơn. Vì thế token offset nằm ngay trong mô tả của `CHROME-1`/`CHROME-2` chứ
  không thành mã riêng — tách ra là mời người ta chọn số cao thấp mà quên đếm hàng.
- `CHROME-6` là mã duy nhất **không** có neo từ chối. Nó chỉ có neo code. Đây là chỗ dễ trượt nhất
  của mô-đun: hành vi hiện tại rất giống một thiết kế chưa xong, và cám dỗ là viết luật cho cái nên
  có.

## Vi phạm còn sống

| Vi phạm | Bằng chứng | Vì sao vẫn xanh |
|---|---|---|
| Hàng primary vẫn lặp `Trang chủ / Khóa học / Liên hệ` trên trang chi tiết khoá học | `ShellNav\index.tsx:113-121` map thẳng cả ba `ROUTES`, không nhánh nào theo `/courses/:displayId` | Test connected mock trọn `_ShellNav` (`ShellNav\index.test.tsx:20-21`) và chỉ mock đúng một pathname `"/courses"` (`:15`), nên không assertion nào chạm được ca này |
| Record khai đã ship `routes: []` và đã thêm test | `courses-runtime-projection-i18n-20260815-01.md:508` | Nguồn sống không có cả hai. **Chưa đo được** đã revert hay chưa từng land: cần `git log -p` trên `ShellNav\index.tsx`, chưa chạy |
| `<main>` lồng `<main>` dưới toàn bộ `/courses` | `routed-page-main` khai `host: "main"` (`contracts\index.ts:744`) và `courses\layout.tsx:32-39` mở nó quanh mọi thứ; 23 contract page cũng khai `host: "main"` | Chưa biết có rule gate nào bắt hay không — `npm run gate:canon` chưa chạy. Nếu có rule mà repo vẫn xanh thì đó là finding thứ hai |

Bằng chứng của vi phạm thứ ba là **khai báo tĩnh cộng thứ tự lồng**, không phải ảnh chụp DOM. Đóng
đinh nó cần mở `/vi/courses/<id>/learn/content` và đếm
`document.querySelectorAll('main').length`. Chưa làm.

## Quyết định

- Giữ tám mã, không tách token offset thành mã thứ chín.
- `CHROME-3`/`CHROME-4` viết thành **tiêu chí**, giữ đủ cả bốn vòng phán quyết trong `INDEX.md`.
  Không vòng nào được rút gọn thành mặc định.
- `CHROME-6` khai thẳng là chỉ có neo code, và cấm suy ra hamburger.
- Vi phạm sống ghi vào sổ, không sửa trong lúc đo, và không được trích làm tiền lệ.

## Rủi ro còn mở

- **`CHROME-4` có thể bị đọc thành "điều khiển nhỏ thì để nhỏ".** Câu phân định phải hỏi về hiệu ứng.
  Một bộ lọc rất rộng vẫn là `CHROME-4` nếu danh sách sau khi lọc vẫn là danh sách đó.
- **`CHROME-2` chỉ có hai ca sống** — trang chi tiết khoá học và bảng điều khiển. Ca thứ ba có thể
  cho thấy "tập mục đóng của cùng một tài liệu" chưa đủ sắc.
- **Bề rộng overlay chỉ đo được đúng một giá trị.** Mọi lựa chọn khác phải khai `chua-do-duoc`, và
  nếu điều đó xảy ra ba lần liên tiếp thì đây là một luật đang thiếu vế.

## Điều kiện phản biện lại

- Xuất hiện một cụm route thứ bảy không dùng `nav-over-body-page`.
- Founder phán quyết lần thứ năm về full-width so với gọn.
- Có hamburger thật được chốt cho `CHROME-6`.
- `git log -p` cho biết `routes: []` đã từng land.
- Một gate bắt được `<main>` lồng nhau, hoặc chứng minh không gate nào bắt.
