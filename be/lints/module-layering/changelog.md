---
id: be-lints-module-layering-changelog
title: changelog.md
slug: /be/lints/module-layering/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của shelf cưỡng chế luật phân tầng mô-đun.
---

# changelog.md

> Current version: `2.00` · Mô-đun: `module-layering`

## Version Policy

Một thay đổi được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Đổi số chính
(`x.00`) dành cho thay đổi cấu trúc mô-đun hoặc nhóm mà nó nằm trên.

Ba việc bắt buộc phải tăng phiên bản: nguồn thêm một quy tắc, nguồn bỏ một quy tắc, hoặc tìm ra một
**cửa còn mở** chưa được ghi. Việc thứ ba là việc dễ bỏ qua nhất và là việc quan trọng nhất — một khe
hở tìm ra mà không viết xuống thì lần sau vẫn có người tin rằng cổng đã đóng.

Số phiên bản của shelf này đi theo **những gì được khẳng định về phần cưỡng chế**, không đi theo số
phiên bản của gói. Sửa một quy tắc mà không đổi điều gì được khẳng định thì vẫn phải tăng, vì "quy
tắc này nhìn bằng cơ chế nào" chính là nội dung của shelf.

## 2.00 — 2026-08-16

Mở mô-đun. Số chính là `2` để đi cùng hình dạng `lints-v2` của shelf, không phải vì có một phiên bản
`1.x` nào trước đó.

- **Lý do tồn tại.** `principles` và `patterns` ghi lại **luật**. Shelf này ghi lại **phần cưỡng
  chế**: máy thật sự nhìn thấy gì, và — phần thường không ai viết ra — máy không nhìn thấy gì. Một
  luật không có quy tắc thì ai cũng biết là không được giữ; một quy tắc thủng thì người ta tin là đã
  đóng, và đó mới là thứ nguy hiểm.
- **Phạm vi.** Hai quy tắc, cả hai ship trong gói `@starci/eslint-canon-be`:
  - `must-deep-module-import`, giữ `LAYERING-1`. Thông điệp `barrel`.
  - `no-self-module-alias`, giữ `LAYERING-2`. Thông điệp `self`.
  Nguồn công bố đúng hai quy tắc trong `rules` và đúng hai trong `recommended`; hai danh sách khớp
  nhau và cả hai đều xin mức `error`.
- **Danh tính quy tắc là tên đã công bố.** Không đặt mã số riêng. Tên đó là chuỗi in ra trong log
  build, nằm trong dòng tắt cảnh báo và xuất hiện trong mọi cuộc trao đổi về lỗi; đặt thêm một định
  danh thứ hai là tạo ra một quy tắc hai tên mà không cách nào biết một thông điệp đến từ tên nào.
- **Ghi rõ ba mã không có quy tắc nào giữ.** `LAYERING-3` (bị bỏ ra **có chủ ý**, nguồn nói rõ: phân
  biệt năng lực anh em với con lồng cần đồ thị mô-đun), `LAYERING-4`, và **nửa khai báo** của
  `LAYERING-5`. Cả ba nằm ở `audit.md`, không nằm trong bảng `## Rules`.
- **Nói thẳng chỗ tên quy tắc hứa nhiều hơn phần nó đo.** `must-deep-module-import` đo **số đoạn**
  của specifier, không đo xem đoạn cuối có phải một tệp hay không. Điều này được lặp lại ở cả ba tài
  liệu `INDEX.md`, `vi.md` và `example.md` vì nó là chỗ dễ đọc quá tay nhất của mô-đun.
- **Bảng cửa mở là bắt buộc.** Lần mở này ghi **mười sáu** cửa còn mở, mỗi cửa kèm việc quy tắc phải
  soi thêm cái gì thì mới đóng được — hoặc vì sao đóng lại đắt hơn để mở. Đáng chú ý nhất: đếm đoạn
  không phân biệt thư mục với tệp; đoạn rỗng và đoạn `"."` đi lọt cả hai quy tắc; mọi dạng import
  động không được thăm; đường tương đối vượt ranh giới hoàn toàn vô hình; và
  `no-self-module-alias` tắt **im lặng** khi cây năng lực không nằm dưới đúng cặp đoạn `/src/<lớp>/`.
- **Một cửa mở ngược.** Khoá tự thân dạng ngắn dưới thư mục nhóm không mang tên nhóm, nên một năng
  lực khác trùng tên ngắn bị báo `self` dù nó vượt một ranh giới có thật. Ghi lại như một báo nhầm,
  vì quy tắc bắn vào mã đúng dạy đúng thói quen xấu nhất: cuộn qua báo lỗi.
- **Đề xuất mạnh nhất của lần rà, để trong `audit.md` chứ không tự ý làm.** Một quy tắc cấm chính
  **sự tồn tại** của tệp barrel sẽ đóng luôn gốc của khe hở đếm-đoạn: không có tệp barrel thì
  `@modules/ai/index` không còn gì để trỏ tới. Cho tới khi quy tắc đó có thật trong nguồn, nó là một
  đề xuất, không phải một quy tắc.
- **Năm tài liệu, không có `prompt.md`.** `INDEX.md` (tiếng Anh) giữ luật, bảng quy tắc, bảng cơ chế
  phát hiện và hai bảng cửa lách; `vi.md` giữ từng quy tắc theo tiếng Việt; `example.md` giữ mã thật
  cho từng trường hợp bắn, không bắn và đi lọt; `audit.md` giữ phản biện và rủi ro; tài liệu này giữ
  lịch sử.
- **Không tên sản phẩm trong lời văn và ví dụ.** Tên quy tắc, tên thông điệp, tiền tố alias và tên
  thư mục mà quy tắc so khớp là **định danh có thật trong sản phẩm biên dịch** nên được chép nguyên
  văn; miễn trừ đó không mở rộng ra chỗ nào khác.
