---
id: fe-principles-target-size-audit
title: audit.md
slug: /gates/principles/target-size/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định và khả năng chống bịa của luật Kích thước mục tiêu.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `target-size`

Phản biện này kiểm xem luật có chọn được một class CSS thường từ **số đo và hành vi đã nêu**, và chỉ từ đó.

## Kết luận

Chấp nhận. Sàn là con số công bố được, tập mã đóng, và cả ba đường thoát đều có điều kiện chứng minh
được chứ không phải chứng minh bằng lời.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `TARGET-0` so với mọi mã | Loại trừ được khi đã nêu phần tử có nhận activation hay không |
| `TARGET-1` so với `TARGET-2` | Loại trừ được khi đã nêu ràng buộc nào cấm hình vẽ chạm 44 |
| `TARGET-1` so với `TARGET-4` | Loại trừ được khi đã nêu mục tiêu có nằm trong dòng chảy của câu hay không |
| `TARGET-2` so với `TARGET-5` | Loại trừ được khi đã nêu khoảng cách tới vùng chạm gần nhất |
| `TARGET-2` so với `TARGET-3` | Loại trừ được vì hai mã ở hai trục; cả hai luôn phải được trả lời |
| `TARGET-5` so với `TARGET-1` chưa sửa | Loại trừ được khi đã nêu thành phần điều khiển tương đương có tồn tại hay không |
| `TARGET-3` so với ngoại lệ mặt liền | Loại trừ được khi đã đo cả hai bên theo đúng trục kề nhau |
| Thiếu số đo | Không suy đoán. Hỏi đúng một câu về số đo còn thiếu rồi dừng |

## Nhận định

- Sàn được neo vào bốn nguồn công bố, nên tranh luận về con số là tranh luận với nguồn chứ không phải
  với người đánh giá. Đây là điểm khác biệt lớn nhất giữa mô-đun này và các mô-đun cùng nhóm.
- Tách **hình vẽ** khỏi **vùng chạm** giải phóng thiết kế khỏi cái nghĩa vụ mà nó vẫn tưởng là của
  mình. Phần lớn phản đối "44 to quá" thật ra là phản đối một điều luật không hề nói.
- Hai con số 44 và 24 được xếp thành **hai mức nghiêm trọng**, không thành hai lựa chọn. Nếu để chúng
  cùng cấp thì mọi đánh giá sẽ hạ về 24 trong vòng một quý.
- `TARGET-3` nằm trên trục khác `TARGET-0..2, 4, 5`. Đây là chỗ khó đọc nhất của mô-đun và đã được nói
  rõ ở cả ba tài liệu: một mã kích thước không bao giờ trả lời hộ câu hỏi khoảng cách.
- Số học khoảng cách giữa các phần tử khi có `TARGET-2` (`2 × inset + 8`) là phần dễ sai nhất trong thực tế, vì `gap` đo trên
  hình vẽ còn luật đo trên vùng chạm. Nó đã được đưa vào cả `vi.md` lẫn `example.md` bằng con số cụ
  thể chứ không bằng mô tả.
- Cấm `-m-* p-*` không phải một sở thích cú pháp. Lề ngoài âm trừ vào `gap`, nên nó sửa `TARGET-1` bằng
  cách phá `TARGET-3` một cách im lặng.

## Quyết định

- Giữ đúng sáu mã: `TARGET-0`, `TARGET-1`, `TARGET-2`, `TARGET-3`, `TARGET-4`, `TARGET-5`.
- Sàn của mô-đun là **44 × 44 CSS px** đo trên vùng chạm; **24** là mức chặn tuân thủ và phải được
  gọi đúng tên khi báo cáo.
- Chỉ một kỹ thuật nới được chấp nhận: giả-phần tử phủ ra ngoài, không tham gia bố cục.
- `TARGET-5` chỉ có hiệu lực khi thành phần điều khiển tương đương thật sự nằm trên cùng màn hình.
- Ngoại lệ người dùng tác nhân mất hiệu lực ngay khi tác giả chạm vào kích thước của thành phần điều khiển.
- Khi hai mã cùng khớp, chọn mã **phát ra class CSS**; ngoại lệ không bao giờ là phần dư của một điều kiện
  chưa chứng minh.
- Giữ mọi ví dụ ở dạng tổng quát, `className`-đầu tiên, không tên sản phẩm.
- Luật là **bắt buộc**: không có thành phần điều khiển nào nhỏ tới mức được miễn khai báo mã.

## Rủi ro còn mở

- **Lệch khỏi tập mã gợi ý ban đầu.** Tập gợi ý có năm mã, dừng ở "ngoại lệ nội tuyến". Mô-đun này thêm
  `TARGET-5` vì mật độ do dữ liệu áp đặt — ghim bản đồ, sơ đồ ghế, điểm trên biểu đồ, tay kéo trên
  vùng vẽ — không rơi vào bất kỳ mã nào trong bốn mã còn lại. Không có `TARGET-5`, những trường hợp đó
  bị nhét vào `TARGET-2`, và hậu quả là một lớp vùng chạm chồng chéo vô hình mà không ai nhìn thấy để
  tránh. Đó là một lỗi tệ hơn cái lỗi vừa đi sửa.
- **Gộp "essential" và "equivalent" thành một mã.** Hai nguồn tách chúng thành hai ngoại lệ. Ở đây
  chúng bị buộc vào nhau: mật độ bắt buộc **mà không có** thành phần điều khiển tương đương không được cấp mã nào
  cả, nó là một lỗi `TARGET-1` chưa sửa. Đây là một điều khoản chặt hơn nguồn, và đó là chủ ý — tách
  ra thì "essential" trở thành một câu nói, còn buộc vào thì nó trở thành một thứ phải dựng ra được.
- **`TARGET-3` có thể bị đòi tách thành mô-đun riêng.** Câu trả lời nằm ở `INDEX.md`: 2.5.8 đổi kích
  thước lấy khoảng cách trong cùng một điều khoản, nên tách ra là trích dẫn nửa nguồn của chính mình.
- **`TARGET-2` gánh nhiều tình huống nhất** — góc phần tử chồng lớp, hàng dày, nhãn nhỏ, thành phần điều khiển lồng trong ô nhập.
  Nếu thực tế cho thấy chúng cần tách, đó là một đề xuất thay đổi luật, không phải một lần chọn khác đi.
- **`gap` xuất hiện ở hai mô-đun.** Bố cục chọn khoảng cách giữa các phần tử theo quan hệ nội dung; mô-đun này chọn khoảng cách giữa các phần tử theo
  số đo vùng chạm. Khi hai giá trị khác nhau, luật lấy giá trị lớn hơn. Đây là chỗ duy nhất một mô-đun
  khác có thể bị mô-đun này ghi đè, và nó cần được nhắc lại ở mỗi lần đánh giá có `TARGET-2` kề nhau.
- **Vùng chạm không kiểm được bằng đọc mã.** `overflow-hidden` ở tổ tiên, `z-index` của phần tử phủ,
  và một `after:inset-0` của hàng cha đều có thể xén hoặc cướp mất phần vừa nới. Chỉ có đo trên DOM
  đang chạy mới kết luận được.

## Điều kiện phản biện lại

- Có đề xuất hạ sàn xuống 40, 36 hoặc "cho riêng máy tính".
- Có đề xuất coi 24 là một lựa chọn thay vì một mức chặn.
- Xuất hiện `-m-` đi kèm `p-` trên một thành phần điều khiển.
- Xuất hiện `after:-inset-*` mà thiếu `relative` hoặc thiếu `after:content-['']`.
- Hai vùng chạm đã nới có khoảng cách giữa các phần tử nhỏ hơn `2 × inset + 8`.
- Có nơi dùng `TARGET-5` mà không chỉ ra được thành phần điều khiển tương đương.
- Có thành phần điều khiển gốc bị sửa kích thước nhưng vẫn viện ngoại lệ người dùng tác nhân.
- Có mã thiết kế đáp ứng hạ sàn ở điểm ngắt hẹp.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
