---
id: fe-principles-focus-order-audit
title: audit.md
slug: /gates/principles/focus-order/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định và khả năng chống bịa của luật Thứ tự lấy tiêu điểm.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `focus-order`

Phản biện này kiểm xem luật có chọn được **một** quyết định từ **dữ kiện đã nêu**, và chỉ từ đó — trong
một chủ đề mà phần lớn câu trả lời không nằm ở `className`, nên không soi ra được bằng cách đọc class CSS
danh sách.

## Kết luận

Chấp nhận. Tập mã đóng, tổng quát, không phụ thuộc tên sản phẩm hay thành phần nào, và mọi mã đều quy
được về một chuẩn đã trích dẫn.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `FOCUS-0` so với `FOCUS-1` | Loại trừ được khi đã nêu nút DOM có hành động riêng hay không |
| `FOCUS-0` so với `FOCUS-6` | Loại trừ được khi đã nêu nút DOM có tới được bằng phím mũi tên hay không |
| `FOCUS-1` so với `FOCUS-2` | Loại trừ được: một bên trả lời *ở đâu*, một bên trả lời *có thấy không* |
| `FOCUS-1` so với `FOCUS-6` | Loại trừ được khi đã nêu các thành phần điều khiển là phần tử ngang hàng chọn-một hay là các việc khác nhau |
| `FOCUS-3` so với `FOCUS-7` | Loại trừ được khi đã nêu phần nền còn dùng được hay không |
| `FOCUS-3` so với bẫy bàn phím | Loại trừ được khi đã nêu có `Escape` và nút đóng nhìn thấy được |
| `FOCUS-4` so với `FOCUS-7` | Loại trừ được khi đã nêu tiêu điểm đi lùi về chỗ mở hay đi tới nội dung mới |
| `FOCUS-5` so với `FOCUS-1` | Loại trừ được khi đã nêu khối chắn có lặp ở mọi trang không |
| `FOCUS-7` so với không làm gì | Loại trừ được khi đã nêu nội dung mới có do người dùng yêu cầu không |
| Thiếu dữ kiện chuyển tiếp | Không có mặc định an toàn: phải hỏi **một** câu về quyền sở hữu màn hình rồi dừng |

## Nhận định

- **Hình dạng thị giác đã bị loại khỏi tập tiêu chí.** Dưới bảng trượt, ngăn trượt, hộp thoại giữa màn hình đều
  rơi vào cùng một mã nếu chúng cùng chiếm quyền màn hình; ngược lại một phần tử chồng lớp to đùng nhưng nền
  vẫn dùng được thì không phải `FOCUS-3`.
- **Sáu trên tám mã không phát ra class CSS.** Đây là kết quả đúng, không phải thiếu sót: nó chứng minh
  luật nằm ở DOM. Cũng chính vì thế mô-đun này **không** kiểm được bằng cách đọc `className`, và
  bằng chứng phải là đếm điểm dừng thật.
- **`FOCUS-2` là mã đi kèm bắt buộc**, không phải mã cạnh tranh. Nó phát sinh chính xác trên các nút DOM
  `FOCUS-1`, thành viên `FOCUS-6`, và mọi đích hạ cánh của `FOCUS-3`/`FOCUS-4`/`FOCUS-7`; và không
  bao giờ phát sinh trên `FOCUS-0`.
- **2.1.2 (Không mắc kẹt bàn phím) không thành mã riêng.** Nó được cài vào `FOCUS-3` như **điều kiện hợp
  lệ**: giam mà không thoát được thì không phải `FOCUS-3` sai — nó không phải `FOCUS-3` nữa. Đặt bẫy
  thành một mã riêng sẽ tạo ra một mã mà không ai chọn có chủ ý, tức là một mã chết.
- **`FOCUS-4` và `FOCUS-7` là hai mã gần nhau nhất.** Ranh giới lùi-tới đủ sắc để phân định, nhưng
  một hành động có thể sinh ra **cả hai** quyết định (đóng hộp thoại tạo mới rồi nhảy tới bản ghi). Luật
  buộc phải chốt một, và cấm để nó thành hệ quả của thứ tự re-hiển thị.
- **Phần mơ hồ còn lại chỉ nằm ở những yêu cầu bỏ sót chuyển tiếp** — mô tả màn hình tĩnh mà không
  nói cái gì mở ra, cái gì đóng lại.

## Quyết định

- Giữ đúng tám mã: `FOCUS-0` … `FOCUS-7`.
- Coi đơn vị phân loại là **một quyết định tiêu điểm**, không phải một phần tử. Một phần tử có thể làm
  phát sinh hai quyết định trên hai câu hỏi khác nhau; mỗi quyết định vẫn rơi vào đúng một mã. Đây là
  cùng một cách đọc mà nhóm này đã dùng cho quan hệ giữa phần tử cùng cấp: mã áp cho một quan hệ, không áp
  cho cả cây.
- Đặt đường đi bàn phím **bằng** thứ tự DOM, và cấm mọi cách sửa nó bằng CSS hoặc bằng `tabindex`
  dương.
- Không có mặc định an toàn cho chuyển tiếp. Với khoảng cách, chọn bậc nhỏ hơn là an toàn; ở đây "đoán bừa"
  sinh ra một màn hình mất dấu tiêu điểm, nên thiếu dữ kiện thì hỏi.
- Giữ mọi ví dụ ở dạng tổng quát, mã đánh dấu thuần, không tên sản phẩm.
- Luật là **bắt buộc**: không có phần tử nào nhỏ tới mức được miễn khai báo mã.

## Rủi ro còn mở

- **Lệch so với tập mã gợi ý ban đầu — đã thêm hai mã.** Tập gợi ý có sáu mã `FOCUS-0` … `FOCUS-5`.
  Đã **thêm** `FOCUS-6` (một thành phần tiện ích hợp thành là một điểm dừng) và `FOCUS-7` (đưa tiêu điểm tới nội dung
  vừa xuất hiện), vì nếu không có chúng thì tập mã **không đóng**: một danh sách thẻ tab năm thẻ tab và một cú đổi
  tuyến trang trong ứng dụng một trang là hai tình huống có thật, xảy ra hằng ngày, mà không mã nào trong
  sáu mã đầu nhận. Nhét danh sách thẻ tab vào `FOCUS-1` sẽ hợp thức hoá việc một thành phần tiện ích nuốt hai chục điểm
  dừng; nhét đổi tuyến trang vào `FOCUS-4` sẽ đảo ngược nghĩa của "trả về chỗ đã mở".
- **Không mã nào bị bỏ, bị tách hay bị gộp.** Số của sáu mã gốc giữ nguyên, và hai mã mới được
  **nối vào cuối** chứ không chèn vào giữa, để một trích dẫn viết theo bản trước vẫn giữ nguyên
  nghĩa. Đó cũng là lý do thang này liền mạch `0`–`7` chứ không thủng như thang quan hệ ở nhóm này.
- **Đơn vị phân loại là quyết định, không phải phần tử.** Người đọc quen với "mỗi nút DOM một mã" sẽ hỏi
  vì sao một cái nút vừa là `FOCUS-1` vừa là `FOCUS-2`. Câu trả lời nằm ở `INDEX.md` và ở mục
  Các quyết định phía trên; đây là chỗ dễ đọc nhầm nhất của phiên bản này.
- **`FOCUS-6` gánh nhiều tình huống nhất** — thẻ tab, thanh công cụ, nút chọn, trình đơn, hộp danh sách, lưới, cây. Nếu thực
  tế cho thấy lưới hai chiều cần luật riêng với lưới một chiều, đó là một đề xuất thay đổi luật, không
  phải một lần chọn khác đi.
- **Mô-đun này không tự chứng minh được bằng điều kiện tĩnh.** Đọc `className` không phát hiện được vi
  phạm `FOCUS-1`, `FOCUS-4` hay `FOCUS-7`. Bằng chứng duy nhất được chấp nhận là **đếm điểm dừng
  bằng bàn phím thật** trên đúng một tuyến trang, một khung nhìn, một trạng thái.
- **`FOCUS-2` trên đích hạ cánh dùng `focus:` chứ không `focus-visible:`.** Chọn như vậy vì cú dời là
  do chương trình gây ra, nên phải luôn hiện; cái giá là người dùng chuột cũng thấy chỉ báo sau khi
  đổi tuyến trang. Đây là đánh đổi đã cân nhắc, không phải sơ suất.

## Điều kiện phản biện lại

- Có đề xuất thêm một mã mới, hoặc chèn một mã vào giữa thang.
- Xuất hiện `tabindex` dương ở bất kỳ đâu trong sản phẩm.
- Có `focus:outline-none` hoặc `focus-visible:outline-none` mà không có chỉ báo thay thế trên cùng
  nút DOM.
- Có lớp phủ giam đường đi mà không xử lý `Escape`.
- Có `order-*`, `*-reverse` hoặc lưới cách đặt được dùng để đổi thứ tự thao tác.
- Một lần xoá hoặc một lần đóng lớp làm tiêu điểm rơi xuống `<body>`.
- Yêu cầu lặp lại mà một câu hỏi phân định vẫn không giải quyết được.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
