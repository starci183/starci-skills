---
id: fe-principles-radius-audit
title: audit.md
slug: /gates/principles/radius/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định và khả năng chống bịa của luật Bán kính bo góc.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `radius`

Phản biện này kiểm xem luật có chọn được một class CSS thường từ **ranh giới đã nêu và khoảng cách đo được**,
và chỉ từ đó.

## Kết luận

Chấp nhận. Tập mã đóng và tổng quát; chỉ ba giá trị được chọn, phần còn lại là kết quả của một phép
trừ kiểm tra lại được. Không phụ thuộc tên sản phẩm hay thành phần nào.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `RADIUS-0` so với mọi mã | Loại trừ được khi đã nêu có hay không một ranh giới vẽ ra |
| *không class CSS* so với `rounded-none` | Loại trừ được khi đã nêu ranh giới có tồn tại và có đang từ chối bo |
| `RADIUS-1` so với `RADIUS-2` | Loại trừ được khi đã nêu phần tử là một thao tác hay chứa một vùng |
| `RADIUS-1` so với `RADIUS-3` | Loại trừ được khi đã nêu hình là chữ nhật bo hay viên nhộng |
| `RADIUS-2` so với `RADIUS-4` | Loại trừ được khi đã đo khoảng cách và so với bán kính ngoài |
| `RADIUS-4` so với `RADIUS-0` | Loại trừ được khi khoảng cách bằng 0: cha cắt xén |
| `RADIUS-4` so với `RADIUS-3` | Loại trừ được vì viên nhộng không có góc để trừ |
| `RADIUS-5` so với mã bậc | Loại trừ được khi đã nêu cạnh nào bị cắt hoặc bị ghép |
| Thiếu khoảng cách | Không đoán. Hỏi đúng một câu: khoảng đệm trong và đường viền của ranh giới ngoài |

## Nhận định

- Tiêu chí "trông tròn vừa mắt" đã bị loại hoàn toàn khỏi tập tiêu chí phân loại. Đầu vào duy nhất là
  loại ranh giới và một khoảng cách đo được.
- Cơ chế chống trôi nằm ở chỗ **giá trị nào được phép chọn**. `rounded-sm`, `rounded`, `rounded-lg`
  chỉ tồn tại như kết quả. Một giá trị không thể với tới bằng mắt thì không có chỗ cho con số tự chế
  ẩn nấp: thấy `rounded-lg` trong bản so sánh thay đổi là thấy một lời khẳng định rằng phép trừ đã chạy, và khoảng
  cách là bằng chứng.
- Bậc thành phần điều khiển là `R / 2` chứ không phải một giá trị độc lập. Nhờ vậy thang chỉ có **một** núm chỉnh;
  không có chỗ để cãi nhau giữa hai con số "cùng đúng".
- Ràng buộc đồng tâm có **mép rõ**: nó chỉ tác dụng khi khoảng cách nhỏ hơn bán kính ngoài. Đây là
  sự thật hình học chứ không phải một nhân nhượng — khi vượt mép, góc trong đã ra khỏi cung ngoài và
  hai đường cong không còn quan hệ gì với nhau.
- Quy tắc **làm tròn xuống** biến sai số thành một phía duy nhất. Sai lên tạo ra con dấu dán; sai
  xuống chỉ tạo ra một góc hơi vuông hơn cần thiết, mức mà không ai đọc ra được.
- Khoảng cách bằng 0 không được giải bằng "bán kính bằng nhau" mà bằng cắt xén. Điều này giữ nguyên tắc
  **một góc, một nơi khai**, thứ mà quy tắc bán kính bằng nhau phá vỡ ngay lần đổi khoảng đệm trong đầu tiên.
- `RADIUS-0` được nâng thành **mã tình huống** với hai phát ra khác nhau. Đây là chỗ dễ đọc nhầm nhất
  của mô-đun, và đã được nói rõ ở cả ba tài liệu: không có class CSS là **sự vắng mặt của ranh giới**,
  `rounded-none` là **một ranh giới đang từ chối**.
- `RADIUS-4` và `RADIUS-5` **chồng nhau được** và điều đó không phá tính đóng của tập mã, vì chúng trả
  lời hai câu hỏi khác nhau: `RADIUS-4` trả lời *tròn bao nhiêu*, `RADIUS-5` trả lời *góc nào tồn
  tại*. Class CSS của `RADIUS-5` luôn ở dạng theo cạnh hoặc theo góc, nên không gian class CSS vẫn phân hoạch
  sạch.

## Quyết định

- Giữ đúng sáu mã: `RADIUS-0`, `RADIUS-1`, `RADIUS-2`, `RADIUS-3`, `RADIUS-4`, `RADIUS-5`.
- Một giá trị gốc `R` duy nhất. Chỉ `R / 2`, `R` và viên nhộng được chọn; mọi giá trị khác là kết quả.
- Suy ra thắng chọn tay: mã nào tính được thì phải tính.
- Khoảng cách là khoảng đệm trong cộng đường viền của ranh giới ngoài, đo từ class CSS thật, không ước lượng từ ảnh.
- Kết quả rơi giữa hai bậc thì lấy bậc dưới.
- Khoảng cách bằng 0 giải bằng `overflow-hidden` ở cha, con giữ `RADIUS-0`.
- Viên nhộng miễn trừ mọi phép trừ, cả chiều nhận lẫn chiều cấp.
- Bán kính không phản ứng với khung nhìn, rê chuột, tiêu điểm hay trạng thái tải; chỉ đổi khi ranh giới đổi.
- Giữ mọi ví dụ ở dạng tổng quát, `className`-đầu tiên, không tên sản phẩm.
- Luật là **bắt buộc**: không có kích thước phần tử nào được miễn khai mã.

## Rủi ro còn mở

- **Sai khác so với bộ mã hạt giống, đã ghi nhận.** Bộ hạt giống mô tả `RADIUS-4` như "lồng nhau" nói
  chung. Bản này **thu hẹp** nó lại thành một điều kiện đo được — *khoảng cách nhỏ hơn bán kính
  ngoài* — vì đọc rộng sẽ bắt một cái nút nằm giữa một thẻ `p-6` phải suy ra một bán kính từ một cung
  mà nó ở cách rất xa, và kết quả sẽ là một con số vô nghĩa. Phần "khoảng cách ≥ bán kính ngoài ⇒ hết
  ràng buộc" là phần thêm vào so với hạt giống, cùng với quy tắc **làm tròn xuống** và quy tắc **đường viền
  tính vào khoảng cách**. Ngoài ra `RADIUS-0` được cho **hai phát ra** thay vì một, để tách "không có
  ranh giới" khỏi "ranh giới từ chối bo". Không mã nào bị thêm, tách, gộp hay bỏ; sáu mã của hạt giống
  giữ nguyên cả chỉ số lẫn thứ tự.
- **Hai mã có thể in ra cùng một chuỗi.** `rounded-md` là bậc thành phần điều khiển, cũng là kết quả của `12 − 6`.
  Đã xử lý bằng cách tuyên bố rằng mã đặt tên cho **cách lấy được giá trị**, không phải cho giá trị.
  Rủi ro còn lại là ai đó đọc bản so sánh thay đổi và kết luận sai mã; bằng chứng phân biệt luôn nằm ở khoảng đệm trong của
  cha, và đó là lý do mọi ví dụ `RADIUS-4` đều viết kèm phép trừ.
- **`R` là điểm chịu lực duy nhất.** Đổi `R` là đổi cả mô-đun, kể cả bảng suy ra. Điều đó là cố ý —
  một núm chỉnh thì đổi được, ba núm thì trôi — nhưng nó đồng nghĩa rằng một đề nghị "chỉ thẻ này
  tròn hơn thôi" là một đề nghị **đổi luật**, không phải một lần chọn khác đi.
- **Thang class CSS của một khung phát triển có thể không khớp phép trừ.** Bộ mã này viết theo một thang mà
  `R / 2` và các hiệu số đều rơi đúng vào một bậc có sẵn. Ở một thang khác, một số hiệu sẽ rơi vào
  giữa; quy tắc làm tròn xuống che được chuyện đó, nhưng nếu phải làm tròn thường xuyên thì đó là dấu
  hiệu `R` chọn sai, chứ không phải luật sai.
- **`RADIUS-2` gánh nhiều vai trò nhất** — thẻ, hộp thoại, cửa sổ nổi, khối nhấn mạnh, khối mã, trạng thái rỗng.
  Nếu thực tế cho thấy mặt phẳng toàn màn hình cần tách khỏi tấm nổi trong trang, đó là một đề nghị
  đổi luật kèm một `R` thứ hai có tên, không phải một lần bo tay khác đi.

## Điều kiện phản biện lại

- Có đề nghị thêm một giá trị bán kính mới, hoặc đổi `R`.
- Xuất hiện `rounded-[…]` hoặc một biến thiết kế bán kính một-lần-dùng.
- Có phần tử vừa khai bán kính vừa nằm trong một cha đang cắt xén cùng góc đó.
- Có `rounded-none` trên một phần tử không vẽ ranh giới nào.
- Mã thiết kế đáp ứng đổi bán kính mà ranh giới không đổi.
- Một `RADIUS-4` xuất hiện trong bản so sánh thay đổi mà không nêu được khoảng cách đã dùng để trừ.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
