---
id: fe-principles-gap-audit
title: audit.md
slug: /fe/principles/gap/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định và khả năng chống bịa của luật Khoảng cách.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `gap`

Phản biện này kiểm xem luật có chọn được một class CSS thường từ **quan hệ đã nêu**, và chỉ từ đó.

## Kết luận

Chấp nhận. Thang đóng, tổng quát, không phụ thuộc tên sản phẩm hay thành phần nào.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `GAP-1` so với `GAP-2` | Loại trừ được khi đã nêu hành vi bổ nghĩa |
| `GAP-2` so với `GAP-3` | Loại trừ được khi đã nêu ranh giới dùng chung |
| `GAP-3` so với `GAP-4` | Loại trừ được khi đã nêu bên nào chi phối bên nào |
| `GAP-4` so với `GAP-6` | Loại trừ được khi đã nêu mục đích và trạng thái ở cấp trang |
| `GAP-6` so với `GAP-8` | Loại trừ được khi đã nêu quyền sở hữu hình học |
| `GAP-0` so với mọi mã | Loại trừ được khi đã nêu hàng khoảng đệm trong và đường phân cách |
| Thiếu hành vi | Lấy bậc nhỏ hơn liền kề; chỉ một câu hỏi khi bên yêu cầu nói rõ cần bậc lớn hơn |

## Nhận định

- Trục và mật độ thị giác đã bị loại khỏi tập tiêu chí phân loại.
- Phần tử cha phẳng trộn nhiều quan hệ bắt buộc phải lồng, không được lấy giá trị trung bình.
- Đường phân cách cộng hàng khoảng đệm trong triệt tiêu khoảng cách trùng lặp trong liền mạch danh sách.
- Phần mơ hồ còn lại chỉ nằm ở những yêu cầu bỏ sót phần tử cha hoặc bỏ sót hành vi.
- `GAP-0` được nâng thành **mã tình huống** trong khi vẫn cấm class CSS `gap-0`. Đây là chỗ dễ đọc nhầm
  nhất của phiên bản này và đã được nói rõ ở cả ba tài liệu: mã đặt tên cho một tình huống, class CSS đặt
  tên cho một khoảng cách, và tình huống này không có khoảng cách nào.

## Quyết định

- Giữ đúng bảy mã: `GAP-0`, `GAP-1`, `GAP-2`, `GAP-3`, `GAP-4`, `GAP-6`, `GAP-8`.
- Coi khoảng cách là khoảng cách giữa các phần tử do phần tử cha sở hữu giữa các phần tử cùng cấp.
- Mặc định lấy bậc nhỏ hơn liền kề; chỉ hỏi một câu khi bên yêu cầu nói rõ cần vai trò lớn hơn.
- Giữ mọi ví dụ ở dạng tổng quát, `className`-đầu tiên, không tên sản phẩm.
- Luật là **bắt buộc**: không có kích thước cách kết hợp nào được miễn khai báo mã.

## Rủi ro còn mở

- **Mã tình huống có thể bị đọc thành thang liên tục.** Ai đó thấy `GAP-0`…`GAP-8` sẽ hỏi `GAP-5`
  đâu. Câu trả lời nằm ở `INDEX.md`: thang thủng là cố ý, vì thang liền mời người ta chia đôi.
- **`GAP-2` gánh nhiều tình huống nhất** — hành động, tài liệu, câu, chuỗi có thứ tự. Nếu thực tế cho thấy
  bốn thứ đó cần tách, đó là một đề xuất thay đổi luật, không phải một lần chọn khác đi.

## Điều kiện phản biện lại

- Có đề xuất thêm một giá trị khoảng cách mới.
- Có con dùng `margin` để tạo khoảng cách giữa các phần tử giữa các phần tử cùng cấp.
- Mã thiết kế đáp ứng đổi khoảng cách mà quan hệ không đổi.
- Yêu cầu lặp lại mà một câu hỏi phân định vẫn không giải quyết được.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
