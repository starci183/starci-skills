---
id: fe-principles-size-audit
title: audit.md
slug: /gates/principles/size/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định và khả năng chống bịa của luật Kích thước.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `size`

Phản biện này kiểm xem luật có chọn được một class CSS thường từ **chủ sở hữu phép đo đã nêu**, và chỉ từ đó.

## Kết luận

Chấp nhận. Tám mã đóng và tổng quát trên **một trục**, không phụ thuộc tên sản phẩm hay thành phần
nào. Điều kiện để tập mã còn tổng quát là quy tắc "mỗi trục một mã" — nếu ai đó đọc luật này theo
kiểu "mỗi hộp một mã", tập mã lập tức thủng, vì phần lớn hộp thật có hai chủ sở hữu khác nhau.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `SIZE-0` so với `SIZE-1` | Loại trừ được bằng phép thử "bỏ nội dung ra thì chiều dài còn giữ không" |
| `SIZE-0` so với `SIZE-2` | Loại trừ được khi đã nêu nội dung là văn bản chạy hay nhãn ngắn |
| `SIZE-1` so với `SIZE-2` | Loại trừ được khi đã nêu có hay không một mức làm hộp hỏng việc |
| `SIZE-1` so với `SIZE-5` | Loại trừ được khi đã nêu tỉ lệ thành lời |
| `SIZE-1` so với `SIZE-6` | Loại trừ được khi đã nêu nội dung có sàn tự nhiên đang từ chối co |
| `SIZE-2` so với `SIZE-3` | Loại trừ được khi đã nêu nỗi lo là nở quá hay là sụp xuống |
| `SIZE-3` so với `SIZE-4` | Loại trừ được khi đã nêu nội dung có được phép làm hộp dài thêm không |
| `SIZE-3` so với `SIZE-6` | Loại trừ được khi đã nêu ta dựng sàn hay dỡ sàn của trình duyệt |
| `SIZE-4` so với `SIZE-5` | Loại trừ được khi đã nêu con số có co giãn theo cha không |
| `SIZE-4` so với `SIZE-7` | Loại trừ được khi đã nêu biết một trục hay biết cả hai |
| Nhiều mã cùng khớp một trục | Giải bằng thứ tự phân giải cố định ở `INDEX.md`, không bằng phán đoán |
| Thiếu trục trong yêu cầu | Lấy mặc định an toàn `SIZE-0` — để nội dung tự đo; chỉ hỏi một câu khi bên yêu cầu nói rõ họ cần một trần hoặc một sàn |

## Nhận định

- Câu hỏi gốc được đổi từ "bao nhiêu" sang "ai đo". Sau khi đổi, mọi tiêu chí thị giác — trông chật,
  trông trống, trông cân — bị loại khỏi tập tiêu chí phân loại, vì không tiêu chí nào trong đó trả
  lời được câu hỏi gốc.
- **Đơn vị không còn là tiêu chí.** `ch`, `%`, `vh`, `rem`, `px` từng bị dùng như dấu hiệu để đoán
  mã; luật nay tuyên bố thẳng rằng đơn vị chỉ nói con số đến từ đâu, không nói ai sở hữu trục. Nhờ
  vậy `min-h-screen` yên vị ở `SIZE-3` thay vì trôi sang một mã "khung nhìn" không tồn tại.
- **`SIZE-6` là mã dễ bị bỏ sót nhất và là mã tốn nhất khi thiếu.** Nó không phát ra một chiều dài
  nào; nó chỉ gỡ một mức chặn mà trình duyệt tự đặt. Hậu quả của việc thiếu nó không xuất hiện dưới
  dạng một hộp sai kích thước mà dưới dạng một trang có cuộn ngang hoặc một vùng cuộn không cuộn —
  tức là ở một chỗ khác với chỗ gây lỗi. Đây là lý do chính khiến mã này được tách khỏi `SIZE-3`.
- **`SIZE-0` và `SIZE-1` cùng có thể không phát ra class CSS**, vì mặc định của trình duyệt đã nói đúng
  một trong hai tuỳ ngữ cảnh. Đây là chỗ dễ đọc nhầm nhất của phiên bản này. Luật xử lý bằng cách nói
  rõ: mặc định của con khối trong luồng thường là `SIZE-1` trên trục ngang, mặc định của nội tuyến,
  nội tuyến-khối và phần tử thay thế là `SIZE-0`. Mã vẫn tồn tại kể cả khi class CSS vắng mặt.
- **`SIZE-2` gánh ba tình huống**: dòng đọc, khung trang, và trần của phần tử chồng lớp. Ba thứ này cùng một
  cấu trúc lập luận — hộp sẵn sàng nở, một lý do chức năng chặn lại — nên chúng ở chung một mã. Nếu
  thực tế cho thấy ba thứ đó cần tách, đó là một đề xuất thay đổi luật.
- Phần mơ hồ còn lại nằm ở những yêu cầu **bỏ sót trục**. Luật xử lý bằng cách bắt dừng và hỏi thay
  vì đoán, và bảng ánh xạ trong `example.md` có một dòng cố ý kết thúc bằng câu hỏi thay vì class CSS.

## Quyết định

- Giữ đúng tám mã: `SIZE-0` … `SIZE-7`.
- Coi kích thước là **quyền sở hữu phép đo trên một trục**, không phải một con số.
- Công bố **thứ tự phân giải cố định** thay cho quy tắc "chọn bậc nhỏ hơn" của các mô-đun dạng thang.
  Tập mã này không phải một thang, nên không có bậc nào nhỏ hơn bậc nào; thứ tự phân giải là thứ duy
  nhất khiến kết quả có tính lặp lại.
- Cấm suy mã từ đơn vị.
- Cấm `w-full` trên con khối trong luồng thường, và nêu rõ danh sách chỗ mặc định **khác** đi.
- Giữ mọi ví dụ ở dạng tổng quát, `className`-đầu tiên, không tên sản phẩm.
- Luật là **bắt buộc**: không có phần tử nào nhỏ tới mức được miễn khai mã trên cả hai trục.

## Rủi ro còn mở

- **Sai lệch so với tập mã hạt giống — đã ghi lại.** Tập hạt giống có sáu mã: nội dung tự đo, lấp đầy
  cha, trần, sàn, kích thước biểu tượng hình cố định, phần chia của cha. Mô-đun này giữ nguyên **chỉ số và
  nghĩa** của cả sáu, rồi thay đổi hai chỗ:
  - **Tách `min-w-0` / `min-h-0` khỏi mã sàn, thành `SIZE-6`.** Cùng họ class CSS nhưng ngược ý định:
    `SIZE-3` **dựng** một mức chặn, `SIZE-6` **dỡ** mức chặn mà trình duyệt tự dựng. Gộp chúng lại
    thì mã "sàn" đồng thời có nghĩa là "giữ chỗ" và "cho phép co xuống không", tức là một mã tự mâu
    thuẫn. Rủi ro của việc tách: người đọc thấy hai mã cùng dùng tiền tố `min-` và tưởng chúng là
    biến thể của nhau.
  - **Thêm `SIZE-7` cho trục suy ra từ tỉ lệ.** Với quy tắc "mỗi trục một mã", trục dọc của một
    ảnh thu nhỏ `aspect-video` không rơi vào mã nào trong sáu mã hạt giống: không phải nội dung, không
    phải cha, không phải trần, không phải sàn, không phải biến thiết kế, không phải phần chia. Không thêm mã
    này thì tập mã không còn **tổng**.
  - **Nới `SIZE-4` từ "kích thước biểu tượng hình cố định" thành "một biến thiết kế ấn định con số".** Chiều cao
    thành phần điều khiển, bề rộng thanh dọc và chiều cao phần đầu dính có cùng cấu trúc lập luận với biểu tượng — con số thuộc
    về hệ, không thuộc về chỗ dùng — và nếu giữ mã hẹp ở mức biểu tượng hình thì ba tình huống ấy không có
    nhà. Rủi ro: mã này rộng nhất trong tập và dễ trở thành sọt rác cho mọi con số ai đó thích.
- **Tám mã dùng chỉ số liên tục có thể bị đọc thành một thang.** `SIZE-7` không lớn hơn `SIZE-1`.
  `INDEX.md` nói thẳng điều này, nhưng đây vẫn là chỗ đọc nhầm có xác suất cao nhất, và là lý do
  mô-đun công bố thứ tự phân giải riêng thay vì để chỉ số ngụ ý thứ tự.
- **`SIZE-4` là mã dễ bị lạm dụng nhất.** Mọi con số lẻ đo trên ảnh chụp màn hình đều có thể được
  khai là "biến thiết kế". Hàng rào duy nhất hiện nay là câu "con số phải đến từ thang biến thiết kế", và hàng rào
  đó nằm ngoài mô-đun này.
- **Ngoại lệ "vừa sàn vừa trần trên một trục"** buộc phải chọn một mã để ghi và hạ mã còn lại xuống
  hàng rào. Đây là chỗ duy nhất trong mô-đun mà một trục thật sự có hai chủ và luật phải chọn một.

## Điều kiện phản biện lại

- Có đề xuất thêm một mã mới, hoặc gộp hai mã hiện có.
- Xuất hiện một hộp mà không trục nào của nó rơi vào tám mã.
- Một yêu cầu lặp lại mà thứ tự phân giải vẫn cho ra hai kết quả khác nhau ở hai người đọc.
- Có `min-h-0` đứng cạnh `min-h-*` dương, hoặc `aspect-*` đứng cạnh một chiều cao ấn định.
- Có trần khai hai lần trên cùng một mạch cha–con.
- Khung chờ và nội dung thật khai khác mã trên cùng một trục.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
