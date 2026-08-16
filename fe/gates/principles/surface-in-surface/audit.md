---
id: fe-principles-surface-in-surface-audit
title: audit.md
slug: /gates/principles/surface-in-surface/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định và khả năng chống bịa của luật Bề mặt in bề mặt.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `surface-in-surface`

Phản biện này kiểm xem luật có chọn được **một** chuỗi class CSS ranh giới từ **quyền sở hữu quan hệ nhóm đã
nêu**, và chỉ từ đó — không từ mật độ thị giác, không từ mong muốn "cho nó nổi", không từ độ sâu của
DOM.

## Kết luận

Chấp nhận, với một ranh giới quan hệ nhóm được nêu tường minh. Bộ mã đóng, tổng quát, không phụ thuộc
tên sản phẩm hay thành phần nào. Độ nổi và dàn ý loại trừ lẫn nhau; quan hệ nhóm trùng hoặc không
gọi được tên luôn quy về phẳng.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `1` so với `2` | Loại trừ được khi đã nêu tính so sánh được của hàng |
| `1` so với `3` | Loại trừ được khi đã nêu con có sẵn ranh giới hay chưa |
| `1` so với `5` | Loại trừ được khi đã nêu bề mặt chứa là nền trang hay một bề mặt |
| `2` so với `3` | Loại trừ được khi đã nêu từng hàng có tự là thẻ hay không |
| `3` so với `4` | Loại trừ được khi đã nêu vùng chứa đứng trên nền trang hay trong bề mặt |
| `4` so với `5` | Loại trừ được khi nêu được tên, thành viên, trạng thái và kết quả của nhóm |
| `4` so với `6` | Loại trừ được khi đã nêu đây là nhóm hay một thành phần điều khiển đơn lẻ |
| `6` so với nâng cấp | Không loại trừ được ở đây; cần bằng chứng từ cảm nhận về hành động |
| Thiếu quan hệ nhóm | Về `SURFACE-IN-SURFACE-4`; chỉ một câu hỏi khi bên yêu cầu vẫn đòi ranh giới |
| Hai đối tượng chạm nhau | Giữ hai ranh giới; chỉ tính so sánh được của hàng mới gộp |

## Nhận định

- Mật độ thị giác, kích thước và độ sâu DOM đã bị loại khỏi tập tiêu chí phân loại. Không tiêu chí
  nào trong số đó xuất hiện ở bất kỳ mã nào.
- Độ nổi lồng độ nổi bị từ chối tuyệt đối: bên trong một bề mặt, chỉ có dàn ý.
- Quan hệ nhóm trùng và quan hệ nhóm không gọi được tên cho **cùng một** kết quả. Đây là chỗ dễ đọc nhầm
  nhất của phiên bản này: hai đường dẫn khác nhau về nghiệp vụ nhưng một kết quả về ranh giới, và
  điều đó là cố ý — cả hai đều không có nhóm để tuyên bố.
- `SURFACE-IN-SURFACE-4` được nâng thành **mã tình huống** chứ không phải "không làm gì". Viết
  `bg-transparent shadow-none` là bằng chứng vùng chứa đã được phân loại và được xác định là không sở
  hữu gì; im lặng không phải bằng chứng đó.
- `SURFACE-IN-SURFACE-3` và `SURFACE-IN-SURFACE-4` cùng "không vẽ ranh giới" nhưng khác nền
  (`bg-background` với `bg-transparent`) và khác chỗ đứng (cấp trang với trong bề mặt). Dùng nhầm
  nền tạo ra một mảng đục lạ bên trong một thẻ.
- `SURFACE-IN-SURFACE-2` bắt buộc có `overflow-hidden`. Thiếu nó là một lỗi chỉ lộ ra ở trạng thái
  rê chuột hoặc ở hàng đầu/cuối, nên đánh giá tĩnh sẽ bỏ sót.
- Phần mơ hồ còn lại chỉ nằm ở những yêu cầu bỏ sót bề mặt chứa hoặc bỏ sót quan hệ nhóm.

## Quyết định

- Giữ đúng sáu mã: `SURFACE-IN-SURFACE-1` … `SURFACE-IN-SURFACE-6`.
- Trang bề mặt = nền thẻ + độ nổi, **không** đường viền.
- Lồng nhau bề mặt hợp lệ = **một** đường viền + không bóng + nền trong suốt.
- Quan hệ nhóm trùng bề mặt chứa = phẳng.
- Quan hệ nhóm không gọi được tên = phẳng; bảng công khai không bao giờ lộ ra một điểm dừng giả.
- Phần nội dung chứa phần tử ngang hàng đã có ranh giới dùng nền trang, không dựng thẻ ngoài.
- Phần tử chồng lớp đã sở hữu ranh giới tác vụ; nội dung thường bên trong phẳng.
- Một thành phần điều khiển không phải một bề mặt và không được bọc.
- Hành động thường trong bề mặt mặc định thứ cấp; ưu tiên là quyết định của mô-đun khác.
- Chỉ **quan hệ nhóm liền mạch** được nhận làm lồng ranh giới trong bộ từ vựng hiện tại.
- Biến thiết kế chuẩn: `bg-background`, `bg-card`, `border-border`, `text-foreground`, `shadow-surface`.
- `gap`, `padding`, `margin` nằm **ngoài** mô-đun này, cả ở ô nhập liệu lẫn đầu ra.
- Luật là **bắt buộc**: không có vùng chứa nào nhỏ tới mức được miễn khai báo mã.

## Rủi ro còn mở

- **Chưa có mã cho nhóm lồng không đồng dạng.** Một nhóm bên trong bề mặt gồm những phần không so
  sánh được với nhau hiện phải chịu `SURFACE-IN-SURFACE-4`, kể cả khi nó gọi được tên. Quyết định này
  được **giữ nguyên** từ phiên bản trước và ghi lại ở đây như một phản đối chưa giải quyết: nó có thể
  làm phẳng một nhóm có thật. Chỉ thêm mã mới khi có đủ ca thật lặp lại, không thêm vì một màn hình.
- **`shadow-surface` là biến thiết kế duy nhất không nằm trong thang mặc định của một khung phát triển tiện ích.**
  Giao diện nào áp dụng mô-đun này cũng phải tự định nghĩa **một** mức độ nổi cho nó. Nếu một nơi
  định nghĩa hai mức, luật "độ nổi là một" bị phá từ tầng biến thiết kế chứ không từ tầng mã đánh dấu.
- **Mã tình huống có thể bị đọc thành thang độ sâu.** Ai đó thấy `1`…`6` sẽ tưởng số càng lớn thì
  càng "nổi". Không phải. Số chỉ là **thứ tự người đọc gặp**, đi từ nền trang vào trong; mã `6` là mã
  nhẹ nhất về thị giác.
- **`SURFACE-IN-SURFACE-4` gánh nhiều tình huống nhất** — trùng, thường, không gọi được tên. Nếu thực
  tế cho thấy ba thứ đó cần tách để phản biện được, đó là một đề xuất thay đổi luật, không phải một lần
  chọn khác đi.
- **Ranh giới `6` phụ thuộc mô-đun khác.** Mô-đun này không tự chứng minh được ưu tiên. Nếu hành động
  cảm nhận đổi định nghĩa chính, mã `6` phải được đọc lại.
- **Khung chờ tính đồng nhất chưa có phép kiểm tự động.** Luật nói khung chờ vẽ đúng số đối tượng mà nội dung thật
  vẽ, nhưng việc kiểm vẫn là đọc bằng mắt hai hiển thị.

## Điều kiện phản biện lại

- Có đề xuất thêm một loại lồng ranh giới mới.
- Biến thiết kế của trang bề mặt hoặc của dàn ý lồng nhau thay đổi.
- Cách thể hiện mặc định của thành phần điều khiển cục bộ thay đổi.
- Một ca thật không quyết được split/merge từ tên, thành viên, trạng thái và kết quả.
- Hiển thị đang tải, lỗi hoặc thiết bị di động cho ra một mô hình ranh giới khác hiển thị đã settle.
- Có luật bề mặt nào bắt đầu chọn `gap` hoặc khoảng đệm bên trong.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
- Xuất hiện một nơi định nghĩa nhiều hơn một mức `shadow-surface`.
