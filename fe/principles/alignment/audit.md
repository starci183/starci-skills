---
id: fe-principles-alignment-audit
title: audit.md
slug: /fe/principles/alignment/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định và khả năng chống bịa của luật Căn chỉnh.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `alignment`

Phản biện này kiểm xem luật có chọn được một class CSS thường từ **bản chất của các con** và **cấu hình của
vùng chứa**, và chỉ từ đó.

## Kết luận

Chấp nhận. Hai trục được tách thành hai câu hỏi độc lập, mỗi trục có tập giá trị đóng và phủ hết
tập giá trị CSS tương ứng; không mã nào cần tên sản phẩm hay thành phần nào để đọc được.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `ALIGN-0` so với `ALIGN-2` | Loại trừ được khi đã nêu con nào sở hữu nền, viền hoặc bóng đổ |
| `ALIGN-0` so với `ALIGN-1` | Loại trừ được khi đã nêu con nào là hình hoặc hộp có kích thước riêng |
| `ALIGN-1` so với `ALIGN-2` | Loại trừ được khi đã nêu **khả năng** xuống dòng, không phải dữ liệu hiện tại |
| `ALIGN-1` so với `ALIGN-4` | Loại trừ được khi đã nêu có hay không một con là hình |
| `ALIGN-2` so với `ALIGN-3` | Loại trừ được khi đã nêu mép nào mang nghĩa so sánh |
| `ALIGN-3` so với `ALIGN-4` | Loại trừ được khi đã nêu các con là chữ hay hình |
| bất kỳ so với `ALIGN-5` | Loại trừ được bằng phép đếm: đúng một con đi chệch |
| `ALIGN-6` so với `ALIGN-8` | Loại trừ được khi đã nêu nội dung tiếp nối luồng đọc hay nói về cả vùng |
| `ALIGN-6` so với `ALIGN-9` | Loại trừ được bằng phép thử con thứ ba |
| `ALIGN-7` so với `ALIGN-9` | Loại trừ được bằng phép thử con thêm vào: đứng cạnh hay tách mép |
| `ALIGN-7` so với luật lề ngoài | Loại trừ được khi đã nêu cả cụm hay một con di chuyển |
| `ALIGN-8` so với luật lề ngoài | Loại trừ được bằng một dữ kiện kiểm tra được: cha có `flex`/`grid` không |
| trục chéo so với `ALIGN-10` | Loại trừ được khi đã nêu vùng chứa có xuống dòng và có sở hữu chiều đo trục chéo |
| Thiếu dữ kiện | Hỏi đúng một câu trong bảng phân định của `example.md`, rồi dừng |

## Nhận định

- **Hai trục là hai câu hỏi, không phải hai lựa chọn.** Điểm này khác hẳn các mô-đun cùng nhóm, nơi
  một nút DOM mang đúng một mã. Ở đây một nút DOM mang tối đa một mã trục chéo, một mã trục chính, và trong
  trường hợp xuống dòng thì thêm một mã dòng. Nếu không nói rõ, người đọc sẽ tưởng `items-center` và
  `justify-between` xung khắc và chỉ được viết một cái.
- **Vi phạm của mô-đun này vô hình.** Hai con cao bằng nhau thì `ALIGN-0`, `ALIGN-1`, `ALIGN-2`,
  `ALIGN-3` hiển thị giống hệt nhau. Vì vậy mọi tiêu chí phân định trong luật đều dựa vào **bản chất
  của con** và **khả năng thay đổi của dữ liệu**, không dựa vào ảnh chụp màn hình. Đây là lý do luật
  cấm dùng hiển thị hiện tại làm bằng chứng.
- **Cùng một class CSS đổi nghĩa khi hướng chảy đổi.** `items-center` trong `flex-row` nói về chiều cao;
  trong `flex-col` nói về chiều ngang. Ranh giới này đã được nêu ở cả ba tài liệu vì nó là nguồn lỗi
  chính khi một hàng chuyển thành cột ở màn hình hẹp.
- **`justify-between` là chỗ luật bị vượt nhiều nhất.** Nó được dùng như một cách đẩy một con, trong
  khi nó phát biểu rằng **mọi** con có tuyên bố lên chỗ trống. Phép thử con thứ ba biến phát biểu ấy
  thành một câu hỏi trả lời được, và nối sang luật lề ngoài cho trường hợp còn lại.
- **Căn chỉnh bị dùng thay cho ba thứ khác.** Thay cho `gap` khi cần khoảng cách; thay cho căn chữ
  khi cần hình dạng ký tự vào giữa hộp; thay cho quyết định kích thước khi cần con rộng bằng anh em. Cả ba đã
  bị loại khỏi tập tiêu chí bằng điều kiện bất biến, và mỗi thứ có một dòng trong bảng ánh xạ trỏ sang chỗ
  đúng của nó.
- **Class CSS chết là một dạng vi phạm riêng.** `items-*` trên phần tử không phải flex hay lưới hiển thị y
  hệt như không viết gì, nên nó tồn tại lâu mà không ai phát hiện — cùng loại với một lớp bọc mang
  `relative` mà không có con nào được định vị.

## Quyết định

- Giữ mười một mã: `ALIGN-0` … `ALIGN-4` cho trục chéo, `ALIGN-5` cho con đi chệch, `ALIGN-6` …
  `ALIGN-9` cho trục chính, `ALIGN-10` cho các dòng khi vùng chứa xuống dòng.
- Một nút DOM trả lời **mỗi trục một lần**; hai câu trả lời độc lập và được phép cùng có mặt.
- Chọn mã theo bản chất của con và khả năng thay đổi của dữ liệu, không theo hiển thị hiện tại.
- `start` và `end` là lô-gic; không luật nào nhắc tới trái phải.
- Một con tự đẩy mình về mép cuối trên trục chính thuộc luật lề ngoài, và **không** đổi mã trục chính
  của vùng chứa.
- Giữ mọi ví dụ ở dạng tổng quát, `className`-đầu tiên, không tên sản phẩm.
- Luật là **bắt buộc**: không có vùng chứa nào nhỏ tới mức được miễn trả lời cả hai câu hỏi.

## Rủi ro còn mở

- **Sai lệch so với tập mã gợi ý ban đầu.** Tập gợi ý có sáu mã: `ALIGN-0` stretch, `ALIGN-1` centre,
  `ALIGN-2` start, `ALIGN-3` end, `ALIGN-4` đường chân chữ, `ALIGN-5` phân phối trên trục chính. Bản này
  giữ nguyên `ALIGN-0` … `ALIGN-4` cả về nghĩa lẫn số, và đổi ba chỗ:
  - **Tách mã phân phối thành bốn.** Mã gợi ý gộp cả trục chính vào một mã dành cho
    `between`/`around`/`evenly`. Làm vậy thì `justify-end` và `justify-center` **không có mã nào**,
    trong khi nhóm nút ở chân hộp thoại và trạng thái rỗng căn giữa là hai tình huống phổ biến nhất
    của trục chính. Một tập không phủ hết thì không đóng, nên trục chính được tách thành `ALIGN-6`
    (mặc định, không phát ra gì), `ALIGN-7`, `ALIGN-8`, `ALIGN-9` — đúng bằng tập giá trị của
    `justify-content`.
  - **Thêm `ALIGN-5` cho con đi chệch.** `self-*` là quyết định của **con**, không phải của vùng chứa,
    nên nó không rơi vào bất kỳ mã vùng chứa nào. Không đặt tên cho nó thì việc rắc `self-*` khắp nơi
    để vá một luật cha sai sẽ không bao giờ bị bắt. Số `5` được giữ liền ngay sau tập trục chéo vì nó
    là ngoại lệ **của tập ấy**.
  - **Thêm `ALIGN-10` cho `content-*`.** Vùng chứa xuống dòng có chiều đo trục chéo lớn hơn các dòng là một
    tình huống thật và không thuộc mã nào khác. Đây là mã yếu nhất của mô-đun: nó hiếm, và câu trả
    lời đúng thường là **bỏ chiều cao áp đặt đi**. Nếu qua thời gian nó không xuất hiện trong công
    việc thật, đề nghị hạ nó xuống một ngoại lệ của `ALIGN-0` chứ không im lặng bỏ.
- **Số mã tăng lên mười một.** Trục chéo vẫn là xương sống với sáu mã, nhưng người đọc lướt bảng có
  thể tưởng đây là một thang liên tục từ `0` tới `10`. Ba tiêu đề bảng trong `INDEX.md` là thứ duy
  nhất chặn cách đọc đó; nếu thực tế cho thấy vẫn bị đọc nhầm, tách bảng thành hai mô-đun con là một
  đề xuất thay đổi luật, không phải một lần chọn khác đi.
- **`ALIGN-1` gánh nhiều tình huống nhất** — biểu tượng, ảnh đại diện, nhãn trạng thái nền, thành phần điều khiển cố định, ô vuông một
  con. Bốn thứ đó cùng chung một lý do (chúng là hộp có kích thước riêng), nên hiện chưa cần tách.
- **Ranh giới với luật lề ngoài phải giữ hai chiều.** Mô-đun này nói "một con tự đẩy mình không phải
  việc của tôi"; luật lề ngoài phải tiếp tục nói "cụm cả khối dạt mép không phải việc của tôi". Nếu một
  trong hai bên đổi lời, ranh giới hở ra và tình huống đẩy một con sẽ không còn mã nào.

## Điều kiện phản biện lại

- Có đề xuất thêm một giá trị căn chỉnh mới, hoặc gộp hai trục thành một câu hỏi.
- Xuất hiện `items-*`, `justify-*` hoặc `content-*` trên phần tử không khai báo `flex`,
  `inline-flex` hay `grid`.
- Xuất hiện `items-stretch` hoặc `justify-start` được viết ra như một tuyên bố.
- Một vùng chứa mang `justify-between` với số con thay đổi theo điều kiện hiển thị.
- Có con dùng `mt-*` để bù cho một mã trục chéo chưa được nêu.
- Mã thiết kế đáp ứng đổi `items-*` khi hướng chảy đổi mà không nêu lại lý do.
- Từ hai `self-*` trở lên trong cùng một vùng chứa.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
