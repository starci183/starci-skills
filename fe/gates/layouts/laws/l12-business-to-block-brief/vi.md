---
id: fe-layouts-l12-vi
title: L12 — Diễn giải tiếng Việt
description: Cách đọc luật business-to-block mà không lấn sang Gate 2.
---

# L12 — Diễn giải tiếng Việt

Version: `1.00`

Input “tạo trang Shop Quà” chưa cho phép kết luận có `GiftCard`, `ProductGrid` hay drawer nào đang
tồn tại. Gate phải tách nhu cầu thành các khối kinh doanh như khám phá quà, xem số dư, chọn quà và
xác nhận đổi; sau đó đối chiếu từng khối với contract registry.

Nếu dùng contract cũ, ghi đúng key và class đang có. Nếu chỉ gần giống, ghi `extend`; nếu chưa có gì
đúng, ghi `new-required`. Dù chưa dùng trong candidate, khối vẫn phải nói vì sao bị loại hoặc khi nào
nó xuất hiện. Nhờ vậy Gate 2 nhận được ý định đủ rõ nhưng vẫn còn quyền thiết kế component thật.

