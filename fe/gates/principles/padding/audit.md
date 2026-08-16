---
id: fe-principles-padding-audit
title: audit.md
slug: /gates/principles/padding/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định và khả năng chống bịa của luật Khoảng đệm trong.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `padding`

Phản biện này kiểm xem luật có chọn được một class CSS thường từ **quyền sở hữu ranh giới đã nêu**, và chỉ từ
đó.

## Kết luận

Chấp nhận, kèm đúng một giới hạn giữ nguyên từ bản trước: **cạnh phần tử chồng lớp** vẫn cần biết vị trí và
hình học bố cục trước khi chọn được khoảng đệm bên trong. Thang đóng, tổng quát, không phụ thuộc tên sản phẩm hay thành phần
nào.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| không class CSS so với `p-0` | Loại trừ được khi đã nêu **có hay không có ranh giới thật** |
| `PADDING-2` so với `PADDING-3` | Loại trừ được khi đã nêu một dữ kiện hay một nhóm dữ kiện |
| `PADDING-3` so với `PADDING-4` | Loại trừ được khi đã nêu ô thuộc bộ đồng dạng hay bề mặt tự đứng được |
| `PADDING-4` so với `PADDING-6` | Loại trừ được khi đã nêu vai trò trên tuyến trang, không phải kích thước |
| Ranh giới lồng nhau | Mỗi ranh giới thật một khoảng đệm bên trong; lớp bọc trong suốt không có |
| Tính đồng nhất trạng thái | Đang tải, rỗng, lỗi, sẵn sàng dùng chung một khoảng đệm trong cây |
| Khoảng đệm trong so với khoảng cách | Loại trừ được khi đã nêu cần nới **bên trong** hay cần đẩy **phần tử cùng cấp** |
| Thiếu quyền sở hữu | Không phát khoảng đệm trong từ bên sử dụng; chỉ một câu hỏi khi bên yêu cầu nói rõ cần khác mặc định |

## Nhận định

- Tên sản phẩm, tên thư viện thành phần và các công thức gắn với một nơi sử dụng đã bị rút khỏi luật chung.
  Mọi ví dụ nay là `className` thuần trên mã đánh dấu thường.
- "To", "thoáng", "chật" và ảnh chụp màn hình vẫn là những thứ **không** chọn được class CSS. Chúng bị
  loại khỏi tập tiêu chí phân loại một cách tường minh, vì đây là đường vào quen thuộc nhất của thẩm
  mỹ.
- Bề mặt-in-bề mặt chỉ hợp lệ khi **cả hai** phần tử tạo ra ranh giới thật; nếu không, lớp trong là
  lớp bọc và không nhận khoảng đệm bên trong.
- `p-0` phải phân biệt được với việc **không** khai báo class CSS. Bản này giữ nguyên phân biệt đó và
  nâng nó thành phần lộ ra ngay trong bảng mã, thay vì nằm ở mục ngoại lệ.
- Khoảng đệm trong bị hiểu nhầm thành công cụ tạo khoảng cách giữa phần tử cùng cấp nhiều hơn mọi lỗi khác. Luật nay nói
  thẳng ở `INDEX.md` rằng khoảng cách phần tử cùng cấp thuộc về `gap` của phần tử cha.
- Cạnh participant không giải được an toàn nếu không có vị trí hình học bố cục; kết luận này giữ nguyên và
  chuyển thành một câu hỏi phân định thay vì một con số bịa ra.
- Phần mơ hồ còn lại chỉ nằm ở những yêu cầu bỏ sót chủ sở hữu ranh giới hoặc bỏ sót vai trò tuyến trang.

## Quyết định

- Giữ đúng thang đóng: không class CSS, `p-0`, `p-2`, `p-3`, `p-4`, `p-6`.
- Đặt **quyền sở hữu ranh giới** làm bộ phân loại đầu tiên, trước mọi câu hỏi về nội dung.
- Giữ lớp bọc trong suốt hoàn toàn không có khoảng đệm trong.
- Giữ khoảng đệm bên trong qua mọi trạng thái tải và mọi khung nhìn, trừ khi vai trò ranh giới thật sự đổi.
- Hỏi đúng một câu về vai trò hoặc về vị trí thay vì bịa ra một khoảng đệm bên trong ở mép.
- Mặc định công khai khi chưa rõ quyền sở hữu: **không** phát khoảng đệm trong từ phía bên sử dụng.
- Gộp `PADDING-0` thành **một mã với hai thể phát ra** — không class CSS khi không có ranh giới, `p-0` khi
  một ranh giới thật uỷ quyền — vì cả hai cùng nói khoảng đệm bên trong bằng không, và tách thành hai mã sẽ ngụ ý
  thang có hai bậc số không.
- Luật là **bắt buộc**: không có phần tử nào nhỏ tới mức được miễn khai báo mã, kể cả lớp bọc.

## Rủi ro còn mở

- **`PADDING-0` là mã duy nhất có hai thể phát ra.** Đây là chỗ dễ đọc nhầm nhất của phiên bản này.
  Đã cân nhắc tách thành hai mã riêng nhưng bị bác: cả hai thể cùng một giá trị khoảng đệm bên trong, và một thang
  có hai bậc số không là một thang sai. Nếu thực tế cho thấy người đọc vẫn chọn nhầm thể, việc tách
  mã là một đề xuất **đổi luật**, không phải một lần chọn khác đi.
- **Mã tình huống có thể bị đọc thành thang liên tục.** Ai đó thấy `PADDING-0`…`PADDING-6` sẽ hỏi
  `PADDING-1` và `PADDING-5` đâu. Câu trả lời nằm ở `INDEX.md`: thang thủng là cố ý, vì thang liền
  mời người ta chia đôi khoảng cách.
- **Khoảng đệm bên trong bất đối xứng theo trục chưa bao giờ được mô-đun này quyết.** Luật chỉ nói "một ranh giới,
  một quyết định khoảng đệm bên trong", và bản `2.00` **không** thêm bậc cho `px-*` khác `py-*`. Mọi nhu cầu thật về
  khoảng đệm bên trong lệch trục phải đi qua đường đổi luật; đây là khoảng trống đã biết, không phải chỗ tự do.
- **Ranh giới `PADDING-3` / `PADDING-4` phụ thuộc câu hỏi "tự đứng được không".** Câu hỏi này phân
  định tốt trong mọi trường hợp đã viết, nhưng nó là một phán đoán về **khả năng tái sử dụng**, và khả năng
  tái sử dụng có thể đổi theo thời gian mà mã đánh dấu thì không đổi theo. Nếu một bộ hàng bắt đầu được
  dùng lại ở nơi khác, đó là lúc phải xét lại mã, không phải lúc giữ mã cũ cho tiện.
- **`PADDING-6` chỉ có một bằng chứng: vai trò trên tuyến trang.** Nếu một tuyến trang thật sự có hai mặt phẳng
  ngang nhau, luật hiện tại buộc một trong hai xuống `PADDING-4`. Đây là một ràng buộc có chủ đích và
  cũng là chỗ dễ bị phản đối nhất khi gặp bố cục hai cột.

## Điều kiện phản biện lại

- Có đề xuất thêm một giá trị khoảng đệm bên trong mới, hoặc một bậc lệch trục.
- Lớp bọc lồng nhau cộng dồn khoảng đệm trong mà không thêm ranh giới nào.
- Một bên sử dụng vá `px-*`/`py-*` lên khoảng đệm bên trong nội tại của một thành phần điều khiển.
- Nội dung dịch chuyển so với cùng một ranh giới khi đổi trạng thái tải.
- Yêu cầu cạnh-phần tử chồng lớp lặp lại, cho thấy đang thiếu một luật vị trí tổng quát.
- Có người dùng khoảng đệm trong để tạo khoảng cách giữa hai phần tử cùng cấp.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
