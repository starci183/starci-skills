---
id: fe-principles-overflow-audit
title: audit.md
slug: /gates/principles/overflow/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định và khả năng chống bịa của luật Tràn nội dung.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `overflow`

Phản biện này kiểm xem luật có chọn được một khai báo thường từ **bản chất của nội dung** — độ dài lớn
nhất, mất mát chấp nhận được, ai sở hữu trần — và chỉ từ đó, chứ không từ việc nhìn một màn hình đang
vỡ.

## Kết luận

Chấp nhận. Tập mã đóng và tổng: mọi hộp nhận nội dung đều rơi vào đúng một mã, kể cả hộp không khai
báo gì. Không mã nào cần tên sản phẩm, tên thành phần hay tên kho đăng ký để đọc.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `OVERFLOW-0` so với `OVERFLOW-1` | Loại trừ được khi đã nêu nguồn giá trị và tập ngôn ngữ phát hành |
| `OVERFLOW-0` so với `OVERFLOW-7` | Loại trừ được khi đã nêu tràn là *không thể* hay *được phép* |
| `OVERFLOW-1` so với `OVERFLOW-2` | Loại trừ được khi đã nêu người đọc đang quét hay đang đọc |
| `OVERFLOW-1` so với `OVERFLOW-3` | Loại trừ được khi đã nêu cắt gây *thiếu* hay gây *sai* |
| `OVERFLOW-2` so với `OVERFLOW-4` | Loại trừ được khi đã nêu phần thừa có đáng giữ tại chỗ không |
| `OVERFLOW-2` so với `OVERFLOW-7` | Loại trừ được khi đã nêu mục đích của màn: so sánh hay đọc |
| `OVERFLOW-3` so với `OVERFLOW-5` | Loại trừ được khi đã nêu đối tượng là chuỗi hay khối có cấu trúc cột |
| `OVERFLOW-4` so với `OVERFLOW-7` | Loại trừ được khi đã nêu có anh em nào phải luôn hiển thị |
| `OVERFLOW-5` so với `OVERFLOW-6` | Loại trừ được khi đã nêu có phần tử nào trong hàng co được |
| `OVERFLOW-6` so với mã của ô chữ | Loại trừ được khi đã nêu đang quyết định cho hàng hay cho ô |
| Thiếu dữ kiện | Không có mã mặc định. Hỏi **một** câu về mất mát chấp nhận được rồi dừng |

Khác với mô-đun thang bậc, ở đây **không** có quy tắc "lấy bậc nhỏ hơn". Các mã không nằm trên một
thang: `OVERFLOW-3` không "lớn hơn" `OVERFLOW-1`, nó là một kết luận khác về cùng một câu hỏi. Đoán
bừa giữa hai mã kề nhau ở đây tạo ra dữ liệu sai chứ không tạo ra khoảng cách sai.

## Nhận định

- Cả bốn cách xử lý — cắt, xuống dòng, cuộn, nở — đều là **quyết định**, và hai trong số đó không phát
  ra class CSS nào. Đây là chỗ dễ đọc nhầm nhất của mô-đun và đã được nói rõ ở cả ba tài liệu.
- `OVERFLOW-0` và `OVERFLOW-7` bắt buộc phải là hai mã. Gộp chúng lại thì mất khả năng nói "hộp này
  không có trần **vì** trần thuộc về tổ tiên" — đúng câu cần nói khi đánh giá phát hiện hai thanh cuộn.
- `min-w-0` và `min-h-0` được nâng lên mức luật thay vì mẹo. Đây là hai chỗ duy nhất trong mô-đun mà
  một khai báo **đúng về ý định** vẫn không có tác dụng gì; hỏng im lặng nguy hiểm hơn hỏng ồn ào vì nó
  qua được đánh giá.
- Ranh giới `OVERFLOW-1` / `OVERFLOW-3` là ranh giới bị vượt nhiều nhất trong thực tế và cũng là ranh
  giới duy nhất mà chọn sai tạo ra **thông tin sai** chứ không phải thông tin thiếu. Nó được nhắc lại ở
  cả bốn tài liệu vì lý do đó.
- Điều kiện "cắt phải kèm đường lấy lại" biến `OVERFLOW-1` từ một lựa chọn hiển thị thành một hợp đồng:
  không có chú giải, không có liên kết, không có trang chi tiết thì không được cắt.
- Trục ngang và trục dọc dùng chung cơ chế nhưng khác mã (`OVERFLOW-5` / `OVERFLOW-4`), vì tiêu chí
  quyết định khác nhau: trục dọc hỏi "ai phải luôn thấy", trục ngang hỏi "rút bớt có mất dữ liệu không".
- Khung nhìn bị loại khỏi tập tiêu chí phân loại. Màn hẹp làm tràn **dễ xảy ra hơn**, không làm nó thành
  một tình huống khác.

## Quyết định

- Giữ đúng tám mã: `OVERFLOW-0` … `OVERFLOW-7`, đánh số liên tục và không thủng.
- Coi tràn nội dung là một quyết định về **ai nhường**, ra trước khi có dữ liệu, không phải một lần vá sau
  khi thấy vỡ.
- Hộp cuộn là hộp riêng: bề mặt giữ khoảng đệm trong, bo góc, đổ bóng và phần tử phải-luôn-thấy.
- Một trục, một trần, trên một chuỗi tổ tiên.
- Số, mã và định danh không bao giờ cắt, kể cả khi ô cạnh nó được cắt.
- Không có mã mặc định khi thiếu dữ kiện; hỏi một câu về mất mát chấp nhận được.
- Giữ mọi ví dụ ở dạng tổng quát, `className`-đầu tiên, không tên sản phẩm.
- Luật là **bắt buộc**: không có hộp nào nhỏ tới mức được miễn khai mã.

## Rủi ro còn mở

Phần này ghi những chỗ tài liệu này **làm rõ thêm hoặc đi lệch** so với tập mã hạt giống, và lý do.

- **Không thêm mã cho `overflow-hidden` dùng để bo góc.** Một bề mặt cắt góc của con nó là một quyết
  định về **vẽ**, không phải về **độ dài nội dung**; nó không thuộc câu hỏi mà mô-đun này nhận. Rủi ro
  là người đọc thấy `overflow-hidden` trong mã rồi tưởng hộp đó đã khai xong tràn nội dung. Đã chặn bằng
  một mục trong "Sai lầm lặp lại nhiều nhất" và một chú thích tại trường hợp gợi ý tìm kiếm, nhưng đây vẫn là
  chỗ dễ hiểu nhầm nhất còn lại.
- **`overscroll-contain` được gộp vào `OVERFLOW-4` thay vì tách mã.** Nó không trả lời câu hỏi "ai
  nhường"; nó chỉ nói phạm vi của một hộp đã cuộn. Tách ra sẽ phá tính tổng của tập mã. Nếu thực tế cho
  thấy việc lan cuộn cần được phân xử riêng cho từng loại lớp phủ, đó là một đề xuất thay đổi luật.
- **`OVERFLOW-3` gánh ba class CSS họ hàng** — `break-words`, `break-all`, `whitespace-nowrap` — trong khi
  bảng mã chỉ nêu `break-words`. Ba class CSS này cùng một kết luận ("không được cắt") nhưng khác cách thực
  hiện: gãy ở khoảng trắng, gãy giữa từ, hoặc không gãy và buộc bên cạnh nhường. Nếu ba thứ này cần
  phân định riêng thì đó là một lần tách mã, không phải một lần chọn khác đi.
- **`OVERFLOW-6` chấp nhận `flex-wrap` như một cách khai hợp lệ thứ ba**, bên cạnh "ai nhường / ai
  giữ". Xuống hàng cũng là một câu trả lời cho tranh chấp bề rộng, và cấm nó sẽ buộc những dải nhãn
  không có thứ tự đọc phải chọn một mã sai. Điều kiện đã nêu: các phần tử không có thứ tự đọc theo cột,
  và số dòng thêm ra không phá bố cục xung quanh.
- **Ví dụ dùng `shrink-0` ở vế giữ, trong khi bảng mã nêu `flex-none`.** Hai class CSS khác nhau ở chỗ
  `flex-none` khoá luôn khả năng nở. Vế giữ trong hầu hết hàng thật chỉ cần **không bị bóp**, còn việc
  nở hay không do bố cục hàng quyết định; khoá cả hai chiều ở mọi ví dụ sẽ dạy một thói quen chặt hơn
  mức luật đòi. Khi vế giữ phải bất động hoàn toàn thì `flex-none` là lựa chọn đúng.
- **Phần tử dính trong hộp cuộn được làm rõ thành hai trường hợp** thay vì một lệnh cấm chung: dính vào
  **nội dung đang cuộn** (hàng tiêu đề của bảng dài) là hợp lệ; dính vào **bề mặt** (phần cuối hành động,
  thanh tìm kiếm của khung) thì phải nằm ngoài hộp cuộn. Lệnh cấm chung sẽ loại bỏ một hình đúng và
  thường gặp, còn cách đọc này giữ nguyên điều luật muốn ngăn: khung của bề mặt không được cuộn mất.
- **Số dòng của `line-clamp` vẫn là một con số do người viết chọn.** Luật buộc nó là một quyết định
  nghiệp vụ ("chừng này đủ để chọn") và cấm chỉnh theo khung nhìn, nhưng không có phép thử máy nào chứng
  minh được `3` đúng hơn `4`. Đây là chỗ chủ quan còn lại nhiều nhất của mô-đun.
- **"Đường lấy lại" chưa có định nghĩa đóng.** Chú giải, liên kết, trang chi tiết và nút mở rộng đều được
  chấp nhận; một danh sách đóng có thể quá chặt với những màn chưa từng gặp. Rủi ro là ai đó coi việc
  rê chuột ra chú giải trên thiết bị cảm ứng là đã đủ.

## Điều kiện phản biện lại

- Có đề xuất thêm một cách xử lý thứ năm ngoài cắt, xuống dòng, cuộn, nở.
- Xuất hiện một hộp mà không mã nào trong tám mã mô tả đúng.
- Có hai thanh cuộn cùng trục trên một chuỗi tổ tiên xuất hiện trong đánh giá.
- Có một khai báo `truncate` hoặc `overflow-y-auto` không có tác dụng vì thiếu `min-w-0` / `min-h-0`.
- Phần thân cuộn ngang ở bất kỳ khung nhìn nào.
- Có yêu cầu đổi mã theo khung nhìn mà bản chất nội dung không đổi.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
