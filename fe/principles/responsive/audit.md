---
id: fe-principles-responsive-audit
title: audit.md
slug: /fe/principles/responsive/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định và khả năng chống bịa của luật Thiết kế đáp ứng.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `responsive`

Phản biện này kiểm xem luật có chọn được một chuỗi class CSS thường từ **nội dung lỗi đã quan sát được**,
và chỉ từ đó — không từ tên thiết bị, không từ cảm giác chật, không từ một ảnh chụp màn hình.

## Kết luận

Chấp nhận. Tập phép biến đổi đóng, mọi ngưỡng đều đòi một phép đo, và mọi dữ kiện thiếu đều rơi về
một mặc định an toàn duy nhất thay vì rơi vào cảm tính.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| Yêu cầu bằng lời đã dựng | 18 |
| Đáp án className/mặc định duy nhất | 17 |
| Câu hỏi có bảo vệ | 1 |
| Điểm ngắt đoán theo tên thiết bị | 0 |
| Tác vụ bị giấu mà không có đường thay thế | 0 |
| `RESPONSIVE-1` so với mọi mã | Loại trừ được khi đã gọi tên được cái đang hỏng |
| `RESPONSIVE-2` so với `RESPONSIVE-3` | Loại trừ được khi đã nêu có "vế" hay không |
| `RESPONSIVE-2` so với `RESPONSIVE-4` | Loại trừ được khi đã nêu người đọc có cần so sánh theo cột |
| `RESPONSIVE-3` so với `RESPONSIVE-4` | Loại trừ được khi đã nêu phần tử khác vai trò hay lặp lại |
| `RESPONSIVE-4` so với `RESPONSIVE-5` | Loại trừ được khi đã nêu vị trí ngang có phải thông tin |
| `RESPONSIVE-3` so với `RESPONSIVE-6` | Loại trừ được khi đã nêu xếp dọc có dùng được không |
| Thiếu dữ kiện | Rơi về `RESPONSIVE-1`; chỉ một câu hỏi khi bên yêu cầu đòi phép biến đổi đắt hơn mà không nêu lỗi |

## Nhận định

| ID | Rủi ro | Luật trả lời |
|---|---|---|
| RSP-103-A | `sm`/`md`/`lg` biến thành bí danh của tên thiết bị | Đòi ngưỡng nội dung lỗi đã đo; tiền tố chỉ là chỗ điền |
| RSP-103-B | Đổi trục âm thầm chỉnh lại khoảng cách | Giữ nguyên khoảng cách giữa các phần tử do quan hệ sở hữu; đổi trục không đổi mã và không đổi khoảng cách giữa các phần tử |
| RSP-103-C | Cặp mã đánh dấu của `RESPONSIVE-6` làm vỡ trạng thái và tiêu điểm | Đòi một trạng thái chủ sở hữu duy nhất và một đường tiêu điểm xác định |
| RSP-103-D | Vùng cuộn của bảng rò ra cả trang, hoặc phụ thuộc một bề rộng cứng | Chủ sở hữu `max-w-full overflow-x-auto`, con `min-w-max`; cấm số cứng và biến riêng |
| RSP-103-E | Thứ tự thị giác lệch khỏi thứ tự DOM | Cấm `order-*` theo điểm ngắt; đổi thứ tự thật là thiết kế lại tác vụ |
| RSP-200-F | Ngưỡng lưới bị đo theo khung nhìn trong khi lưới nằm trong một cột hẹp hơn | Ghi rõ trong `example.md`: ngưỡng thuộc về vùng chứa, không thuộc về khung nhìn; ví dụ lồng `RESPONSIVE-6` + `RESPONSIVE-4` dùng `xl:` thay vì `lg:` |
| RSP-200-G | `RESPONSIVE-1` bị đọc thành "chỗ chưa làm" | Nâng thành mã tình huống phải bảo vệ được, kèm lệnh cấm điểm ngắt rỗng |

## Quyết định

- Giữ đúng sáu mã: `RESPONSIVE-1`, `RESPONSIVE-2`, `RESPONSIVE-3`, `RESPONSIVE-4`, `RESPONSIVE-5`,
  `RESPONSIVE-6`. Tập phép biến đổi vẫn đóng: không đổi gì, xuống dòng, đổi trục, lưới thiết kế đáp ứng, cuộn
  ngang có biên, cặp khả năng hiển thị.
- Đánh số theo **mức xâm lấn tăng dần**, cũng là thứ tự người đọc gặp: hỏi có hỏng không, rồi lấy phép
  sửa rẻ nhất và dừng ở phép đầu tiên chạy được.
- Hai mã liền kề cùng khớp thì lấy mã chỉ số nhỏ hơn.
- Điểm ngắt đến từ nội dung lỗi, không đến từ tên thiết bị.
- Cơ sở class CSS viết cho trạng thái hẹp nhất; chỉ có ghi đè min-chiều rộng. Không có tư duy max-chiều rộng.
- Một thứ tự DOM, một thứ tự đọc, một thứ tự tiêu điểm ở mọi bề rộng; `order-*` theo điểm ngắt bị cấm.
- Nội dung thiết yếu không bao giờ bị giấu; `RESPONSIVE-6` đòi đủ ba điều kiện đường thay thế, trạng thái
  dùng chung, đường tiêu điểm trả về.
- Nội dung ngang nội tại dùng `min-w-max`; không chấp nhận biến riêng hay bề rộng cứng.
- Thiếu dữ kiện thì rơi về `RESPONSIVE-1` — bố cục gốc, một cột, nội dung hiện ra, thứ tự DOM giữ
  nguyên. Chỉ đúng **một** câu hỏi tồn tại trong cả mô-đun.
- Tính đồng nhất trạng thái: đang tải, rỗng, lỗi, sẵn sàng dùng cùng chủ sở hữu, cùng rãnh, cùng điểm neo và cùng mã.
- Giữ mọi ví dụ ở dạng tổng quát, `className`-đầu tiên, không tên sản phẩm, không thư viện thành phần.
- **Bỏ toàn bộ bản xem trước trực tiếp và sáu ID hiển thị cũ.** Bằng chứng thị giác gắn với kho đăng ký của một sản
  phẩm cụ thể không đứng được trên nhóm này; ví dụ đọc được bằng mã đánh dấu thuần thay chỗ chúng.

## Rủi ro còn mở

- **`text-muted-foreground` không phải từ vựng tiện ích phổ quát.** Quyết định ở `1.03` bắt văn bản phụ
  dùng class CSS này được **giữ nguyên** ở `2.00` vì đây là một quyết định luật đã chốt, không phải chỗ để
  im lặng sửa. Nhưng nó là một biến thiết kế cần chủ đề khai báo, nên một ví dụ chép sang giao diện khác sẽ
  không ra màu. Mô-đun `gap` cùng nhóm đang dùng `text-neutral-500`. Đây là một xung đột từ vựng giữa
  hai mô-đun cùng nhóm và cần một quyết định chung ở lần tăng phiên bản sau, không phải một lần chọn
  khác đi trong lúc viết ví dụ.
- **Mã tình huống có thể bị đọc thành thang liên tục.** Ai đó thấy `RESPONSIVE-1`…`RESPONSIVE-6` sẽ
  tưởng đây là sáu bậc của một đại lượng. Không phải: đây là sáu tình huống đóng, chỉ **thứ tự** của
  chúng mang nghĩa (rẻ trước, đắt sau), còn khoảng cách giữa chúng thì không.
- **`RESPONSIVE-6` là mã duy nhất tạo ra hai biểu diễn cho một việc.** Nó vì thế là mã dễ hỏng nhất và
  là mã tốn nhất để kiểm. Nếu thực tế cho thấy nó bị lạm dụng, đề xuất đúng là siết điều kiện của nó,
  không phải bỏ nó.
- **"Đo được" chưa có định nghĩa hình thức trong luật.** Luật đòi một bề rộng tối thiểu đã đo nhưng
  không quy định đo bằng cách nào, ai chấp nhận con số, và con số đó sống ở đâu. Trong thực tế nó
  thường sống trong đầu người viết thành phần. Đây là chỗ luật vẫn có thể bị lách một cách lịch sự.
- **Vùng chứa query không nằm trong tập đóng.** Rủi ro RSP-200-F cho thấy vấn đề thật là ngưỡng thuộc
  về vùng chứa chứ không thuộc khung nhìn, mà công cụ duy nhất mô-đun cho phép lại là điểm ngắt theo
  khung nhìn. Ví dụ lồng ở `example.md` xử lý bằng cách chọn tiền tố muộn hơn — đúng nhưng thủ công.
  Thêm vùng chứa query là một đề xuất thay đổi luật, không phải một lần chọn khác đi.

## Điều kiện phản biện lại

- Có đề xuất thêm một phép biến đổi mới vào tập đóng.
- Có điểm ngắt chỉ được biện minh bằng tên thiết bị.
- Có tác vụ thiết yếu bị giấu mà không có đường thay thế.
- Thứ tự DOM, thứ tự đọc hoặc thứ tự tiêu điểm lệch nhau ở một bề rộng nào đó.
- Xuất hiện lớp bọc thiết kế đáp ứng riêng cho một trạng thái tải.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
- Xung đột từ vựng màu giữa các mô-đun cùng nhóm được đưa ra quyết định.
