---
id: fe-principles-density-audit
title: audit.md
slug: /gates/principles/density/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định và khả năng chống bịa của luật Mật độ.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `density`

Phản biện này kiểm xem luật có chọn được một mã duy nhất từ **công việc của người đọc trong vùng**, và
chỉ từ đó — chứ không từ hình dáng của thành phần, không từ ảnh chụp màn hình, không từ chỗ trống còn
thừa.

## Kết luận

Chấp nhận. Tập mã đóng và tổng quát; khai báo nằm ở ngữ cảnh nên không sinh thuộc tính truyền vào; phạm vi được cắt
sạch khỏi ba mô-đun láng giềng.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `DENSITY-0` so với `DENSITY-2` | Loại trừ được khi đã nêu vùng này **thừa hưởng** hay **đặt lại** |
| `DENSITY-1` so với `DENSITY-2` | Loại trừ được khi đã nêu người đọc **đọc** hay **thao tác** |
| `DENSITY-2` so với `DENSITY-3` | Loại trừ được khi đã nêu người đọc **đọc lần lượt** hay **so sánh giữa các dòng** |
| `DENSITY-1` so với `DENSITY-3` | Không bao giờ kề nhau; nếu ai đó phân vân, dữ kiện thiếu là công việc của người đọc |
| `DENSITY-3` so với sàn cảm ứng | Loại trừ được khi đã nêu loại con trỏ |
| `DENSITY-0` ở gốc | Bị chặn bằng điều kiện bất biến: không có gì để thừa hưởng |
| Thiếu dữ kiện | Lấy `DENSITY-2`; chỉ một câu hỏi khi bên yêu cầu nói rõ khối lượng đọc hoặc ý đồ thuyết phục |

Một phép thử phụ đã được thêm vì nó phân định nhanh hơn cả ba phép trên: **số thành phần cùng hình
dạng do dữ liệu quyết định hay do thiết kế quyết định?** Do dữ liệu ⇒ `DENSITY-3`. Do thiết kế và
hữu hạn ⇒ `DENSITY-2` hoặc `DENSITY-1`.

## Nhận định

- **Thuộc tính truyền vào kích thước bị loại khỏi tập công cụ, không phải bị khuyên tránh.** Đây là điểm cả mô-đun xoay
  quanh. Một thuộc tính truyền vào `size` trên thành phần là bằng chứng trực tiếp rằng câu hỏi mật độ đã bị trả lời sai
  chỗ, và nó luôn mọc thêm giá trị vì mỗi nơi sử dụng là một ngữ cảnh mới.
- **Khai báo cố ý không vẽ ra gì.** Nếu `[--density:n]` tự vẽ khoảng đệm trong hay cỡ chữ, nó sẽ phủ quyết luật
  khoảng cách giữa các phần tử, luật ranh giới và luật sở hữu dòng từ xa. Cho nên nó chỉ khai báo, và bảng nhịp trong `INDEX.md`
  là thứ duy nhất nó ấn định.
- **Phạm vi được cắt bằng chữ "lặp lại".** Mật độ chỉ động vào thứ xuất hiện nhiều lần cùng hình
  dạng: thành phần điều khiển, biểu tượng trong thành phần điều khiển, nội dung đa phương tiện biến thiết kế trong hàng, khoảng đệm bên trong của hàng và ô bảng. Thứ xuất hiện một
  lần thì không phải việc của nó.
- **`DENSITY-0` là mã đông dân nhất.** Gần như mọi thành phần đều thuộc mã này, và đó là dấu hiệu mô-đun
  đang đúng: nếu số thành phần tự khai báo tăng lên, luật đang bị rò.
- **`DENSITY-0` và `DENSITY-2` là cặp dễ nhầm nhất của phiên bản này.** Cả hai đều "trông như mặc
  định". Chúng ngược nhau: một bên nói *tiếp tục theo bên trên*, một bên nói *đặt lại bất kể bên trên*.
  Đã nói rõ ở cả ba tài liệu, kèm ví dụ biểu mẫu nằm trong bảng.
- **Sàn cảm ứng là ràng buộc cứng, không phải lời khuyên.** Nó cắt `DENSITY-3` ở một chỗ mà lập luận
  về công việc của người đọc không cắt được, vì ngón tay không nhỏ đi theo mật độ.

## Quyết định

- Giữ đúng bốn mã: `DENSITY-0`, `DENSITY-1`, `DENSITY-2`, `DENSITY-3`.
- Ngữ cảnh khai báo, thành phần không bao giờ tự xin. Không có thuộc tính truyền vào kích thước.
- Khai báo là một class CSS thuần khai báo, di truyền xuống cây con, viết một lần ở chỗ vùng bắt đầu.
- Cây con ngoài cùng bắt buộc khai báo; `DENSITY-0` ở gốc là lỗi.
- Mặc định khi phân vân là `DENSITY-2`, không phải bậc nhỏ hơn và cũng không phải bậc chặt hơn.
- Mật độ không đổi **lượng** thông tin; bỏ bớt trường thuộc về luật hé lộ.
- Giữ mọi ví dụ ở dạng tổng quát, `className`-đầu tiên, không tên sản phẩm.
- Luật là **bắt buộc**: không có thành phần nào nhỏ tới mức được miễn khai báo mã.

## Rủi ro còn mở

- **Không lệch khỏi tập hạt giống.** Bốn mã được giữ nguyên như đề xuất ban đầu: `DENSITY-0` thừa
  hưởng, `DENSITY-1` thoáng, `DENSITY-2` mặc định, `DENSITY-3` chặt. Những gì được thêm là **ngữ
  nghĩa**, không phải mã: bảng nhịp, sàn cảm ứng, quy tắc phần tử chồng lớp, và tuyên bố rằng `DENSITY-2` cũng
  chính là hành vi "đặt lại thành lời".
- **Đã cân nhắc và bác `DENSITY-4` (siêu chặt).** Lý do bác: mọi lập luận đưa ra cho nó đều quy về
  "nhét thêm dòng lên màn hình", tức là một ý muốn về bố cục chứ không phải một loại công việc mới của
  người đọc. Nếu sau này xuất hiện một vùng mà người đọc **quét bằng máy chứ không bằng mắt** — ví dụ
  một khung log chảy liên tục không ai đọc từng dòng — đó mới là lý lẽ hợp lệ cho mã thứ năm, và nó
  phải được đề xuất như một thay đổi luật.
- **Đã cân nhắc và bác việc tách `DENSITY-2` thành hai mã** (thừa hưởng-mặc-định và đặt-lại-mặc-định).
  Bác vì tập mã sẽ mất tính tổng: hai mã phát ra cùng một class CSS thì không ai chứng minh được một chỗ
  đã chọn sai. Sự phân biệt đó đã nằm sẵn ở ranh giới giữa `DENSITY-0` và `DENSITY-2`.
- **Thang `0`–`3` liền mạch có thể bị đọc thành thang đo.** Ai đó sẽ hỏi vì sao không có `1.5`. Câu
  trả lời nằm ở `INDEX.md`: đây là bốn **loại ngữ cảnh**, không phải bốn lượng khoảng trắng, và giữa
  "thuyết phục một người" với "làm một việc" không có gì để chia đôi.
- **Bảng nhịp là chỗ dễ trôi nhất.** Năm dòng của nó là những con số duy nhất trong mô-đun. Nếu một
  vùng cần một giá trị ngoài bảng, đó là đề xuất sửa bảng, không phải một lần chọn khác đi.
- **Ranh giới với luật hé lộ chưa được vẽ trong mô-đun này.** Câu "chặt không phải là bớt thông tin"
  đã đóng phía mật độ, nhưng phía kia — khi nào được phép bớt — thuộc về mô-đun khác.

## Điều kiện phản biện lại

- Xuất hiện một thành phần nhận thuộc tính truyền vào `size`, `dense`, `compact` hoặc tương đương.
- Có đề xuất thêm một bậc mật độ mới.
- Một giá trị nhịp được viết ngoài bảng trong `INDEX.md`.
- Một vùng đổi mật độ theo điểm ngắt mà công việc của vùng không đổi.
- Số thành phần tự khai báo mật độ tăng lên; đáng lẽ gần như tất cả phải là `DENSITY-0`.
- Một vùng chặt bị phát hiện đã bỏ bớt trường và gọi việc đó là mật độ.
- Yêu cầu lặp lại mà một câu hỏi phân định vẫn không giải quyết được.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
