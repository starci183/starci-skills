---
id: fe-principles-optical-audit
title: audit.md
slug: /fe/principles/optical/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định và khả năng chống bịa của luật Thị giác.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `optical`

Phản biện này kiểm một thứ khó hơn các mô-đun khác trên cùng nhóm: luật ở đây **cho phép sai lệch khỏi
một con số đã đo**, nên câu hỏi không phải "luật có chọn được một class CSS không" mà là "luật có ngăn
được người ta bịa ra lý do để nhúc nhích không".

## Kết luận

Chấp nhận. Tập mã đóng và tổng quát, và quan trọng hơn: mặc định của mô-đun là **từ chối**. Mọi ghi đè
phải trả bằng một phép đo mà người thứ ba chạy lại được, và `OPTICAL-0` là phán quyết hợp lệ, có tên,
có chỗ trong bảng.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `OPTICAL-0` so với mọi mã | Loại trừ được: mã kia đòi một chênh lệch đo được, `OPTICAL-0` là khi chênh lệch không tồn tại hoặc chưa ai đo |
| `OPTICAL-1` so với `OPTICAL-2` | Loại trừ được bằng thuộc tính: vị trí so với kích thước |
| `OPTICAL-1` so với `OPTICAL-3` | Loại trừ được bằng nguồn của hộp: hình dáng tự vẽ so với số liệu đo do phông chữ phát ra |
| `OPTICAL-1` so với `OPTICAL-6` | Loại trừ được bằng phạm vi cạnh: một dấu trong một hộp so với một cạnh nhiều dòng cùng giữ |
| `OPTICAL-2` so với `OPTICAL-3` | Loại trừ được bằng trục: sai cỡ so với sai chiều dọc |
| `OPTICAL-3` so với `OPTICAL-4` | Loại trừ được bằng trục của chữ: dọc so với ngang |
| `OPTICAL-4` so với `OPTICAL-6` | Loại trừ được bằng nghĩa vụ cột: chuỗi đang giữ cột thì cấm `tracking` |
| `OPTICAL-5` so với `OPTICAL-0` | Loại trừ được bằng so sánh khoảng đệm trong với bán kính ngoài |
| Thiếu phép đo | Mặc định `OPTICAL-0`; không nhúc nhích thử, không hỏi lấy lệ |

## Nhận định

- Tiêu chí phân loại đã bị rút về **thuộc tính bị sửa**, không phải cảm giác về kết quả. Nhờ vậy hai mã
  không bao giờ tranh nhau một trường hợp: nếu hai thuộc tính cùng sai thì đó là hai mã, và điều này đã
  được viết thành điều kiện bất biến chứ không để người đọc tự suy.
- Đơn vị xét được đổi từ "một phần tử" sang **"một dấu hiệu trên một thuộc tính"**. Không đổi đơn vị này
  thì mọi ví dụ lồng mã trong `example.md` đều vi phạm câu "mỗi trường hợp đúng một mã".
- Mỗi mã có một **phép đo** riêng, và các phép đo không trùng nhau: sáng hai bên, diện tích mực, dải
  cap so với tâm hộp, tỉ lệ khoảng cách trên cap, vành ở cạnh so với vành ở góc chéo, vị trí mực đầu
  dòng. Đây là chỗ mô-đun tự bảo vệ mình khỏi bị dùng như một giấy phép nhúc nhích.
- `OPTICAL-0` được nâng thành **mã phán quyết mặc định**, không phải mã còn thừa. Đây là điểm dễ đọc
  nhầm nhất của mô-đun: người đọc quen nhóm này sẽ đi tìm "mã nào áp cho trường hợp của tôi" và bỏ qua khả
  năng câu trả lời đúng là "không mã nào, và đó là một câu trả lời".
- Đã đóng hai lối thoát hay bị dùng: ghi đè bằng `margin` trên phần tử cùng cấp (lấn sang luật khoảng cách) và
  ghi đè vượt quá độ lớn của dấu hiệu (đổi bố cục núp bóng quang học).
- Ngoại lệ chữ hoa có dấu là ngoại lệ duy nhất gắn với ngôn ngữ, và nó thật: dấu tiếng Việt đội cao
  hơn cap-chiều cao, nên một ghi đè `OPTICAL-3` đo trên chuỗi không dấu sẽ hỏng khi gặp nội dung thật.
- Ràng buộc RTL cho `OPTICAL-1` là ràng buộc duy nhất mà một phép đo tĩnh không phát hiện được, vì nó
  chỉ sai ở một hướng viết. Nó được ghi thành điều kiện bất biến chứ không thành lời khuyên.

## Quyết định

- Giữ đúng bảy mã: `OPTICAL-0`, `OPTICAL-1`, `OPTICAL-2`, `OPTICAL-3`, `OPTICAL-4`, `OPTICAL-5`,
  `OPTICAL-6`.
- Đánh số **liên tục**, không thủng. Ở mô-đun khoảng cách, thang thủng để chặn việc chia đôi giữa hai
  bậc; ở đây không có bậc nào để chia đôi, vì các mã không phải mức độ của cùng một đại lượng.
- Sắp thứ tự theo **tầm với của ghi đè**: `1`–`2` sửa một dấu so với hộp của chính nó, `3`–`4` sửa một
  đoạn chữ so với số liệu đo của chính nó, `5`–`6` sửa một thứ so với cái nằm ngoài nó.
- Mặc định là `OPTICAL-0`. Không có phép đo thì không có ghi đè.
- Ghi đè sửa một thuộc tính, trên một phần tử, bằng bước nhỏ nhất xoá được chênh lệch.
- Ghi đè quang học không đụng khoảng cách giữa các phần tử giữa phần tử cùng cấp, không đụng cỡ chữ đã chọn, không đụng màu.
- Giữ mọi ví dụ ở dạng tổng quát, `className`-đầu tiên, không tên sản phẩm.
- Luật là **bắt buộc**: không có cú nhúc nhích nào nhỏ tới mức được miễn khai mã.

## Rủi ro còn mở

- **Lệch khỏi tập mã gốc.** Tập mã ban đầu có bốn mã ngoài `OPTICAL-0`. Bản này thay đổi năm chỗ, ghi
  lại đầy đủ ở đây để lần sau còn phản biện được:
  1. **Thêm `OPTICAL-2` (khối lượng).** Mã tâm chỉ sở hữu **vị trí**. "Hình tròn nhìn bé hơn hình
     vuông" là sai **kích thước**, và nếu nhét chung một mã thì mã đó phát ra hai ghi đè mâu thuẫn:
     dịch hay phóng. Tách ra để mỗi mã còn đúng một thuộc tính.
  2. **Mở rộng mã chữ hoa/chữ thường thành `OPTICAL-3` (hộp chữ so với mực chữ).** Giữ nguyên phạm vi
     "hoa và thường trên một dòng" thì một dòng chữ hoa **đơn độc** canh giữa trong nhãn bo tròn không có mã
     nào nhận, mà đó lại là trường hợp xuất hiện nhiều nhất. Cùng một dấu hiệu, cùng một họ ghi đè, nên gộp.
  3. **Tách `OPTICAL-4` (khoảng cách chữ theo cỡ).** Chuẩn được viện dẫn có phần này, và không mã nào
     khác gọi tên nó. Không có nó thì `tracking-tight` trên một tiêu đề lớn là một cú nhúc nhích không
     tên — đúng thứ mô-đun này tồn tại để cấm.
  4. **Mở rộng `OPTICAL-1` từ "hình dạng ký tự" sang "bất kỳ thứ gì có tâm tính được".** Một hộp thoại canh giữa
     trong màn hình cao có đúng dấu hiệu ấy và đúng phép đo ấy. Giữ chữ "hình dạng ký tự" thì trường hợp này rơi ra
     ngoài tập mã, và tập mã hết tổng quát.
  5. **Đánh số lại.** Góc lồng góc và cạnh chung lùi từ `3`, `4` xuống `5`, `6`. Lý do là thứ tự theo
     tầm với, chứ không theo thứ tự nghĩ ra — một tập mã đóng thì thứ tự phải giải thích được.
- **Phép đo vẫn cần một con người cầm thước.** Không có điều kiện tự động nào bắt được "chưa đo". Rủi ro
  thật là ai đó viết `OPTICAL-1` vào commit message rồi nhúc nhích theo cảm giác. Chống lại điều đó
  chỉ có một cách: đánh giá đòi con số, và `example.md` đã đặt sẵn con số cho mọi trường hợp để không ai phải
  bịa ra.
- **`OPTICAL-2` phụ thuộc bộ biểu tượng.** Con số 78,5% cho tròn/vuông là hình học nên luôn đúng, nhưng
  "mực chiếm bao nhiêu trong viewBox" là thuộc tính của từng bộ biểu tượng. Nếu đổi bộ biểu tượng thì mọi ghi đè
  `OPTICAL-2` phải đo lại — đây là re-phản biện điều kiện, không phải một lần chọn khác đi.
- **`OPTICAL-3` gánh nhiều tình huống nhất** — nhãn trạng thái, nhãn bo tròn, biểu tượng cạnh đoạn văn, số cạnh đơn vị, khoảng
  trống ma của tiêu đề. Nếu thực tế cho thấy "canh một dấu theo dòng đầu" cần tách khỏi "canh chữ
  trong hộp của nó", đó là một đề xuất thay đổi luật, không phải một lần chọn khác đi.
- **Ranh giới với luật khoảng cách sẽ còn bị thử.** Khoảng trống ma phía trên tiêu đề sửa bằng
  `leading`, và cám dỗ sửa bằng khoảng cách giữa các phần tử sẽ quay lại mỗi lần có người gặp nó lần đầu.

## Điều kiện phản biện lại

- Có đề xuất thêm một mã mới, hoặc gộp hai mã đang có.
- Đổi bộ biểu tượng, đổi bộ chữ, hoặc đổi thang bán kính — mọi ghi đè `OPTICAL-2`, `OPTICAL-3`, `OPTICAL-5`
  phải đo lại.
- Xuất hiện một ghi đè không nêu được phép đo, hoặc nêu phép đo mà người khác chạy lại ra số khác.
- Một ghi đè quang học được thực hiện bằng `margin` giữa hai phần tử cùng cấp.
- Một ghi đè lớn hơn dấu hiệu mà nó viện dẫn.
- Một ghi đè ngang phụ thuộc hướng không có bản lật cho RTL.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
