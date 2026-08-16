---
id: fe-principles-contrast-audit
title: audit.md
slug: /fe/principles/contrast/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định và khả năng chống bịa của luật Độ tương phản.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `contrast`

Phản biện này kiểm xem luật có chọn được **một nghĩa vụ duy nhất cho một cặp đã nêu**, và chỉ từ đó — chứ
không từ cảm giác "trông vẫn đọc được".

## Kết luận

Chấp nhận. Tập mã đóng và tổng quát: mọi cặp hiển thị ra đều rơi vào đúng một mã, kể cả những cặp không
mang tỉ lệ nào. Không mã nào cần tên sản phẩm, thư viện thành phần hay khoá đăng ký để đọc.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `CONTRAST-0` so với `CONTRAST-3` | Loại trừ được bằng phép thử **gỡ ra**: có dữ kiện nào không còn cách nào khác để biết không |
| `CONTRAST-0` so với `CONTRAST-7` | Loại trừ được khi đã nêu miễn theo **bản chất** hay theo **trạng thái** |
| `CONTRAST-1` so với `CONTRAST-2` | Loại trừ được khi đã nêu cỡ và độ đậm **tính ra px ở điểm ngắt nhỏ nhất** |
| `CONTRAST-1` so với `CONTRAST-3` | Loại trừ được khi đã tách chữ-trên-thành phần điều khiển khỏi hình-của-thành phần điều khiển |
| `CONTRAST-1` so với `CONTRAST-6` | Loại trừ được khi đã nêu nền là màu khai báo hay dữ liệu lúc chạy |
| `CONTRAST-3` so với `CONTRAST-4` | Loại trừ được khi đã nêu dấu hiệu mô tả thành phần điều khiển hay mô tả vị trí bàn phím |
| `CONTRAST-3` so với `CONTRAST-5` | Loại trừ được khi đã nêu yêu cầu là "thấy so với nền" hay "phân biệt với nhau" |
| `CONTRAST-7` so với mọi mã | Loại trừ được khi đã nêu thành phần điều khiển **thật sự** không nhận thao tác |
| Thiếu nền khai báo | Không lấy mặc định. Cặp chưa tồn tại, và câu hỏi là nền nào, không phải màu nào |
| Hai mã cùng khớp | Lấy mã **chặt hơn**; hướng an toàn của mô-đun này đi lên |

## Nhận định

- **Chỗ trống mà mô-đun này lấp là có thật và đo được.** Một luật màu chọn biến thiết kế cho từng nút DOM; nó
  không bao giờ nhìn hai nút DOM cùng lúc. Cặp `text-muted-foreground` trên `bg-muted` được sinh ra từ
  hai quyết định **đều đúng** theo luật màu, và không có mã nào ở luật đó bắt được nó. Đây là lý do
  mô-đun này tồn tại như một trục riêng chứ không phải một điều kiện bất biến thêm vào luật màu.
- **Đơn vị được kiểm là cặp, không phải nút DOM.** Hệ quả kéo theo: một nút DOM có nền và có chữ sinh ra hai
  mã, và một thẻ thường sinh ra bốn. Việc này chống được lối đọc "thành phần này đã đạt chuẩn rồi".
- **Nền phải là nền đã khai báo.** Đây là điều khoản có sức nặng thi hành cao nhất trong mô-đun: nó
  biến "chưa đo" từ một phán đoán chủ quan thành một sự thật kiểm được bằng cách đọc chuỗi cha.
- **Độ trong suốt bị đóng lại.** `text-foreground/60` và `bg-success/15` là những màu mới; nếu không nói rõ,
  đây là ngõ mà mọi kết quả đo bị vô hiệu hoá trong im lặng.
- **Cỡ chữ nâng nghĩa vụ nhưng không đổi vai trò.** Điều khoản này chặn đúng cách lách phổ biến nhất
  của `CONTRAST-2`: phóng to chữ để rơi từ 4.5:1 xuống 3:1.
- **`CONTRAST-5` không phải một tỉ lệ.** Đặt nó cùng bảng với các mã tỉ lệ là cố ý: nó là nghĩa vụ
  song song, và tách nó ra một trang riêng sẽ khiến nó bị coi là tuỳ chọn.
- **`CONTRAST-6` là bước đứng trước, không phải mã thay thế.** Sau khi dựng nền, mã thật vẫn là
  `CONTRAST-1` hoặc `CONTRAST-2`. Đây là mã duy nhất trong mô-đun có tính **thủ tục**, và đã được nói
  rõ ở cả ba tài liệu để không ai dùng nó làm điểm dừng.
- **Miễn trừ được viết thành mã, không viết thành ngoại lệ trôi nổi.** `CONTRAST-0` và `CONTRAST-7`
  không phát ra tỉ lệ nào, nhưng vẫn là mã — vì một tình huống không có tên là tình huống không ai
  chứng minh được là đã làm sai.
- Phần mơ hồ còn lại chỉ nằm ở những yêu cầu **bỏ sót nền** hoặc **bỏ sót trạng thái**.

## Quyết định

- Giữ đúng tám mã: `CONTRAST-0` … `CONTRAST-7`.
- Coi độ tương phản là thuộc tính của **cặp**; mọi mã đều đặt trên cặp, không đặt trên nút DOM.
- Nền = tổ tiên gần nhất **có khai báo** màu nền. Không có khai báo thì không có phép đo.
- Cả hai chủ đề phải đạt; đạt một chủ đề là chưa đạt.
- Hai mã cùng khớp thì lấy mã chặt hơn — ngược chiều mặc định của một mô-đun chọn bậc, vì ở đây hướng
  an toàn đi lên chứ không đi xuống.
- Nêu sàn AA. Mọi đòi hỏi cao hơn là một thay đổi luật, ghi vào `changelog.md`.
- Giữ mọi ví dụ ở dạng tổng quát, `className`-đầu tiên, không tên sản phẩm.
- Luật là **bắt buộc**: không có cặp nào nhỏ tới mức được miễn khai báo mã.

## Rủi ro còn mở

- **Sai khác so với tập mã gợi ý ban đầu.** Tập gợi ý có sáu mã, `CONTRAST-0` … `CONTRAST-5`. Bản này
  giữ nguyên cả sáu, không đổi số của mã nào, và **thêm hai**:
  - `CONTRAST-6` (nền không xác định). Lý do thêm: một cặp chỉ tồn tại khi cả hai nửa xác định. Chữ
    trên ảnh, video, dải chuyển màu hay nội dung người dùng tải lên **không có** nửa thứ hai, nên nó không
    thể là `CONTRAST-1` — mà bỏ nó vào `CONTRAST-1` thì mọi lần "đo" đều là đo với một bức ảnh may
    mắn trong bản thiết kế. Nếu không đặt tên, tình huống này rơi vào khoảng trống giữa `CONTRAST-0`
    (ảnh là trang trí) và `CONTRAST-1` (chữ phải đọc), và tập mã mất tính **tổng**.
  - `CONTRAST-7` (thành phần điều khiển thật sự vô hiệu). Lý do thêm: chuẩn có treo tỉ lệ cho thành phần không hoạt
    động, nên tình huống này **phải** có chỗ. Nhưng gộp nó vào `CONTRAST-0` sẽ mất đúng dữ kiện quan
    trọng nhất: `CONTRAST-0` miễn vĩnh viễn theo bản chất, còn miễn trừ này **hết hiệu lực ngay khi
    thành phần điều khiển sống lại**. Gộp lại là đánh mất tính đảo chiều đó, và đó là chỗ hay bị lạm dụng nhất — làm
    mờ một thành phần điều khiển vẫn bấm được rồi mượn miễn trừ.
  - Không mã nào bị **tách, gộp hay bỏ**. Số của sáu mã gợi ý giữ nguyên để mọi trích dẫn cũ vẫn đúng.
- **Tám mã có thể bị đọc thành một thang.** Ai đó sẽ tưởng `CONTRAST-7` "nặng" hơn `CONTRAST-3`. Câu
  trả lời nằm ở `INDEX.md`: chỉ số là **thứ tự nghĩa vụ**, không phải thang; không có `CONTRAST-2.5`.
- **`CONTRAST-1` gánh nhiều tình huống nhất** — nội dung, chữ phụ, văn bản gợi ý, hỗ trợ, chú thích, chữ
  trên thành phần điều khiển. Nếu thực tế cho thấy chúng cần tách, đó là một đề xuất thay đổi luật, không phải một lần
  chọn khác đi.
- **Mô-đun không tự đo được.** Nó nói cặp nào phải đạt bao nhiêu; giá trị thật của biến thiết kế nằm ở chủ đề.
  Rủi ro còn lại: một chủ đề đổi giá trị biến thiết kế mà không ai chạy lại phép đo cho các cặp đã chứng nhận.
  Đây là lý do "đổi giá trị biến thiết kế" nằm trong danh sách re-phản biện dưới đây.
- **Ranh giới `CONTRAST-0` / `CONTRAST-3` phụ thuộc vào một phán đoán.** Phép thử "gỡ ra" đã thu hẹp
  nó tối đa, nhưng vẫn còn chỗ cho một người trung thực trả lời khác một người khác. Bản này chọn cách
  đóng bằng nguyên tắc: nếu phải tranh luận xem nó có mang thông tin không, thì nó mang.

## Điều kiện phản biện lại

- Có đề xuất thêm hoặc bỏ một mã.
- Giá trị của bất kỳ biến thiết kế nền hoặc biến thiết kế chữ nào đổi ở bất kỳ chủ đề nào.
- Xuất hiện một chủ đề mới, hoặc một chế độ forced-màu sắc.
- Có cặp được tuyên bố đạt mà không nêu được nền đã khai báo.
- Có độ trong suốt mới được pha lên một biến thiết kế đã chứng nhận.
- Có nơi dùng `outline-none` mà không dựng lại chỉ báo tiêu điểm.
- Có yêu cầu nâng sàn lên mức cao hơn AA.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
