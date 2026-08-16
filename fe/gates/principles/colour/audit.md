---
id: fe-principles-colour-audit
title: audit.md
slug: /gates/principles/colour/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định và khả năng chống bịa của luật Màu sắc.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `colour`

Phản biện này kiểm xem luật có chọn được một class CSS thường từ **vai trò đã nêu**, và chỉ từ đó.

## Kết luận

Chấp nhận. Tập mã đóng, tổng quát, không phụ thuộc tên sản phẩm hay thành phần nào. Mọi quyết định của
`1.04` được giữ nguyên; phần thêm vào là mã tình huống, ranh giới và độ sâu ví dụ.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `COLOUR-1` so với `COLOUR-2` | Loại trừ được khi đã nêu dòng nào mang thông tin bắt buộc để hành động |
| `COLOUR-1` so với `COLOUR-3` | Loại trừ được khi đã nêu phần tử có bấm được / có `aria-current` hay không |
| `COLOUR-2` so với `COLOUR-8` | Loại trừ được **chỉ khi** đã nêu có `disabled` thật; xem rủi ro còn mở |
| `COLOUR-3` so với `COLOUR-4` | Loại trừ được khi đã nêu đây là hành động hay kết quả |
| `COLOUR-3` so với `COLOUR-7` | Loại trừ được khi đã nêu trạng thái có tồn tại sau khi tiêu điểm rời đi không |
| `COLOUR-4` so với `COLOUR-1` | Loại trừ được khi đã nêu có trường nhập liệu trạng thái trong dữ liệu |
| `COLOUR-5` so với `COLOUR-6` | Loại trừ được bằng thì của động từ: sắp hỏng so với đã hỏng |
| `COLOUR-6` so với `COLOUR-12` | Loại trừ được khi đã nêu đã kiểm tra tính hợp lệ hay chưa |
| `COLOUR-6` so với `COLOUR-8` | Loại trừ được khi đã nêu có thất bại hay chỉ là điều kiện chưa thoả |
| `COLOUR-9` so với `COLOUR-10` | Loại trừ được khi đã nêu bên dưới còn bề mặt nào không |
| `COLOUR-10` so với `COLOUR-11` | Loại trừ được khi đã nêu khối có tự đứng được ngoài bề mặt cha không |
| `COLOUR-11` so với `COLOUR-12` | Loại trừ được khi đã nêu mục đích là gom hay tách |
| `COLOUR-13` so với `COLOUR-4/5/6` | Loại trừ được khi đã nêu các chuỗi dữ liệu có ngang hàng hay không |
| `COLOUR-14` so với mọi mã | Loại trừ được ở mép của tác phẩm đồ hoạ |
| `COLOUR-15` so với `COLOUR-10` | Loại trừ được khi đã nêu nền có do chủ đề kiểm soát không |
| Thiếu vai trò | Giữ nguyên class CSS hiện tại; nội dung đọc mới lấy `COLOUR-1` |
| Yêu cầu trang trí | Chỉ một câu hỏi về ý nghĩa, không trả về giả-đầu ra |

## Nhận định

- Vai trò ngữ nghĩa có tính di động: nó không phụ thuộc vào một phần triển khai biến thiết kế nào cụ thể.
- Mô hình cũ lấy thành phần làm gốc đã trộn luật thiết kế với API của một ứng dụng; bản này không còn
  chỗ nào cần một tên riêng để đọc được.
- Yêu cầu trang trí **theo định nghĩa** là mơ hồ; đúng một câu hỏi về ý nghĩa là đủ để giải.
- Biểu đồ và tác phẩm đồ hoạ thương hiệu cần bảng màu riêng có kiểm soát, và bản này nâng chúng thành mã đóng
  `COLOUR-13`, `COLOUR-14` thay vì để trôi trong mục ngoại lệ không tên.
- Độ tương phản vẫn phải kiểm bằng công cụ trên **giá trị đã resolve** của chủ đề; luật không thay thế được
  phép đo.
- Ranh giới bị vi phạm nhiều nhất trong thực tế là `COLOUR-1` / `COLOUR-3`: tô chính cho chữ tĩnh.
  Nó đã được nêu ở cả ba tài liệu đọc được.

## Quyết định

- Giữ đúng mười lăm mã, `COLOUR-1` … `COLOUR-15`, đánh số theo **thứ tự người đọc gặp**, không phải
  theo mức độ.
- Bộ quy tắc công khai trả về ngữ nghĩa class CSS, không trả về tên thành phần.
- Mơ hồ thì sinh ra đúng một câu hỏi cụ thể, không sinh ra giả-đầu ra.
- Trạng thái luôn kèm một dấu hiệu ngoài màu.
- Không xác lập được ý nghĩa thì giữ class CSS hiện tại; nội dung đọc mới mặc định `text-foreground`.
- Từ vựng bề mặt dùng chung là `bg-background`, `bg-card`, `bg-muted`, `border-border`, `ring-ring`;
  không mô-đun nào đặt tên biến thiết kế bề mặt song song.
- Kiểu chữ sở hữu cấp bậc đọc; màu không bao giờ được mượn để làm tiêu đề.
- Một phần tử một vai trò: bề mặt không mang thêm màu trạng thái, phải lồng phần tử con.
- Luật là **bắt buộc**: không có phần tử nào nhỏ tới mức được miễn khai báo mã.

## Rủi ro còn mở

- **`COLOUR-2` và `COLOUR-8` dùng chung biến thiết kế.** Đây là điểm yếu thật của luật hiện tại: hai vai trò
  khác hẳn nhau cùng bắt đầu từ `text-muted-foreground`, và chỉ có `opacity-50` cộng trạng thái
  `disabled` tách chúng ra. Một người đọc vội sẽ thêm `opacity-50` cho chữ mô tả. Luật cũ đã chọn như
  vậy và bản này **giữ nguyên**; nếu thực tế cho thấy cần một biến thiết kế riêng cho bị vô hiệu hoá, đó là một đề
  xuất thay đổi luật, không phải một lần chọn khác đi.
- **Ví dụ biểu đồ của bản cũ dùng biến thiết kế trạng thái làm hạng mục.** `1.04` minh hoạ ba hạng mục dữ liệu
  bằng `bg-primary`, `bg-success`, `bg-warning`. Điều đó mâu thuẫn với chính điều kiện bất biến "chỉ dùng
  thành công/cảnh báo khi dữ liệu mang trạng thái". Luật thì đúng — nó cho phép "ordered categorical
  bảng màu". Bản này giữ nguyên **luật** và chỉ đổi **ví dụ** sang một bảng màu phân loại trung tính,
  đồng thời ghi nhận đây là chỗ duy nhất ví dụ cũ bị thay vì tự mâu thuẫn.
- **Bảng chỉ mục ví dụ của bản cũ nhắc tới tên bề mặt `content1`/`content2`.** Quyết định 7 của
  `1.04` đã chuẩn hoá sang `background`/`card`/`muted`; bản này theo quyết định 7 và coi hai tên kia
  là di tích chưa được dọn.
- **Số thứ tự có thể bị đọc thành thang.** Có người sẽ hỏi vì sao `COLOUR-8` "nhẹ hơn" `COLOUR-6`.
  Câu trả lời nằm ở `INDEX.md`: đây là thứ tự gặp, mô-đun này không có thang số nào.
- **Mười lăm mã là nhiều để nhớ.** Đổi lại, mỗi mã đóng và gọi tên được; gộp lại sẽ tạo ra những mã
  phủ một dải khẩu vị, đúng thứ mà luật này tồn tại để ngăn.
- **Độ tương phản không được luật này bảo đảm.** Chọn đúng vai trò vẫn có thể ra một cặp không đạt ngưỡng
  nếu giá trị biến thiết kế bị đặt sai. Phép đo nằm ngoài mô-đun.

## Điều kiện phản biện lại

- Tên biến thiết kế ngữ nghĩa thay đổi.
- Có đề xuất thêm một vai trò trạng thái mới, hoặc tách `COLOUR-2` khỏi `COLOUR-8`.
- Ngưỡng độ tương phản thay đổi.
- Ví dụ bắt đầu dùng giá trị bảng màu thô ngoài `COLOUR-15`.
- Có thành phần tô chính cho chữ tĩnh, hoặc tô nguy hiểm cho thành phần điều khiển chỉ đang bị vô hiệu hoá.
- Có nơi truyền đạt trạng thái chỉ bằng màu, không kèm dấu hiệu.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
