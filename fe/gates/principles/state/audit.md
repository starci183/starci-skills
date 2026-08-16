---
id: fe-principles-state-audit
title: audit.md
slug: /gates/principles/state/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định và khả năng chống bỏ sót của luật Trạng thái.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `state`

Phản biện này kiểm hai thứ. Một: luật có chọn được **tập lớp trạng thái** từ **năng lực đã nêu** của
phần tử, và chỉ từ đó. Hai — quan trọng hơn — luật có phát hiện được **cái thiếu**, khi cái thiếu
không xuất hiện trong bất kỳ tấm ảnh nào.

## Kết luận

Chấp nhận. Tập mã đóng và tổng quát. Điều kiện bắt buộc suy ra được từ năng lực, nên bỏ sót một lớp
là một **phép trừ đếm được**, không còn là một nhận xét thẩm mỹ.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `STATE-0` so với `STATE-1` | Loại trừ được khi đã nêu có hay không một tác nhân làm đổi hình dạng |
| `STATE-1` so với `STATE-2` | Loại trừ được khi đã nêu đâu là hình dạng phần tử quay về |
| `STATE-2` so với `STATE-3` | Loại trừ được bằng thiết bị điều khiển: con trỏ hay bàn phím. Không thay thế nhau |
| `STATE-2` so với `STATE-6` | Loại trừ được bằng độ bền: rời con trỏ, tải lại trang, còn hay mất |
| `STATE-4` so với `STATE-7` | Loại trừ được bằng thời lượng: bằng cú nhấn hay bằng công việc |
| `STATE-5` so với `STATE-7` | Loại trừ được bằng nguồn của điều kiện: bên ngoài hay việc của chính phần tử |
| `STATE-5` so với `STATE-8` | Loại trừ được bằng nhu cầu sửa: cần sửa thì không được tắt |
| `STATE-5` so với `STATE-9` | Loại trừ được bằng nhu cầu đọc và sao chép |
| `STATE-7` so với nội dung đang tải | Loại trừ được bằng quyền sở hữu công việc: phần tử hay vùng |
| Thiếu năng lực | Trả sàn bốn lớp; chỉ một câu hỏi khi yêu cầu chưa nói rõ một năng lực khai báo |

## Nhận định

- **Phép đếm là thứ duy nhất bắt được lỗi của mô-đun này.** Mọi mã khai báo đều suy ra được từ một
  câu hỏi năng lực có/không, nên "có bao nhiêu lớp" là một con số, không phải một ý kiến. Đây là lý
  do `INDEX.md` mở đầu bằng *đếm hai lần* chứ không bằng danh sách mã.
- **`STATE-3` là mã bị bỏ sót nhiều nhất và là mã duy nhất bắt buộc vô điều kiện.** Ba con đường dẫn
  tới chỗ mất nó đã được ghi tên trong `example.md`: `outline-none` trần, dùng `focus:` rồi thấy xấu
  và xoá, và niềm tin rằng đã có `hover:` là đủ.
- **Ảnh chụp màn hình không phải bằng chứng cho mô-đun này.** Một ảnh chụp chứng minh được `STATE-1`
  và may ra `STATE-6`. Nó không chứng minh được bất cứ mã nào còn lại, và **không bao giờ** chứng
  minh được sự vắng mặt. Phép thử đúng là: rút chuột ra, đi hết luồng bằng Thẻ tab.
- **Luật cấm đổi hình học đã loại được một họ lỗi mà mắt thường bỏ qua.** `hover:border`,
  `active:font-bold`, thẻ tab chỉ có viền khi được chọn, biểu tượng đang tải thay chữ trên nút — bốn thứ trông khác
  nhau nhưng cùng một sai: một lớp trạng thái đi tính lại bố cục.
- **Mã khai báo đè mã tạm thời đã được phát biểu thành thứ tự, không chỉ thành lời khuyên.** Chỉ số
  của mã cũng là thứ tự khai báo an toàn trong class CSS danh sách, nên một quy tắc về độ đặc hiệu CSS trở
  thành một quy tắc đọc được bằng mắt.
- **Ranh giới với mô-đun màu đã được cắt sạch.** Mô-đun này quyết **lớp nào tồn tại**; mô-đun màu
  quyết **màu nào được dùng**. Cùng một tình huống tiêu điểm xuất hiện ở cả hai nơi mà không mâu thuẫn,
  vì hai mô-đun trả lời hai câu hỏi khác nhau về nó.
- **Phần mơ hồ còn lại nằm ở những yêu cầu bỏ sót năng lực**, không nằm ở ranh giới giữa các mã.

## Quyết định

- Giữ đúng mười mã: `STATE-0`…`STATE-9`.
- Sàn bắt buộc của mọi phần tử thao tác được là `STATE-1` + `STATE-2` + `STATE-3` + `STATE-4`. Mỗi mã
  khai báo bắt buộc theo đúng một câu hỏi năng lực.
- `STATE-3` bắt buộc vô điều kiện với mọi phần tử tiêu điểm được, kể cả khi nó không phát ra class CSS mới.
- Coi số lớp trạng thái là đại lượng **suy ra**, không phải đại lượng **chọn**.
- Cấm mọi lớp trạng thái đổi hình học; cấm mã hoá trạng thái bằng riêng màu.
- Bắt trạng thái phải có mặt trong DOM (`disabled`, `readOnly`, `aria-*`), không chỉ trong CSS.
- Giữ mọi ví dụ ở dạng tổng quát, `className`-đầu tiên, không tên sản phẩm.
- Luật là **bắt buộc**: không có phần tử nào nhỏ tới mức được miễn khai đủ tập mã.

## Rủi ro còn mở

Phần này ghi cả những chỗ tập mã **đã lệch khỏi bộ hạt giống**, và vì sao.

- **Thêm `STATE-9` (chỉ đọc), không có trong bộ hạt giống.** Không thêm thì mọi giá trị "trưng ra
  nhưng không sửa ở đây" bị dồn vào `STATE-5`, và cái giá là ba tổn thất cùng lúc: giá trị mờ đi,
  không văn bản được, không đến được bằng phím Thẻ tab — để diễn đạt một điều mà `readOnly` diễn đạt đúng. Đây là mã
  mới nhất và là mã ít bằng chứng thực địa nhất của mô-đun.
- **`STATE-6` được nới rộng thay vì tách nhỏ.** Bộ hạt giống viết "được chọn / current"; bản này gộp
  luôn checked, đã nhấn và expanded vào cùng một mã, vì cả năm đều là **một điều kiện bền do dữ liệu
  quyết**, phân biệt với `STATE-2` bằng cùng một phép thử. Rủi ro: `STATE-6` đang gánh nhiều tình
  huống nhất trong mô-đun. Nếu thực địa cho thấy "đang mở" cần luật riêng với "đang được chọn", đó là
  một đề xuất thay đổi luật, không phải một lần chọn khác đi.
- **Trạng thái drop mục tiêu được gộp vào `STATE-2`.** Nó tạm thời và do vị trí con trỏ quyết, giống
  hệt rê chuột; chỉ khác ở sự kiện phát ra nó. Gộp để giữ tập mã đóng. Rủi ro: kéo-thả bằng bàn phím
  không có lớp riêng nào trong mô-đun này, và hiện phải mượn `STATE-3` — đây là chỗ mỏng nhất của
  quyết định gộp.
- **`STATE-7` bị thu hẹp về công việc của chính phần tử**, và nội dung vùng đang tải lần đầu bị đẩy
  sang mô-đun hàng xóm. Ranh giới này rõ về mặt định nghĩa nhưng dễ bị đọc nhầm, vì trên màn hình cả
  hai cùng là "đang chờ". Ngoại lệ *bận ở cấp vùng* tồn tại đúng để chặn chỗ đọc nhầm đó.
- **`STATE-0` và `STATE-1` cùng không phát ra biến thể nào.** Đây là chỗ dễ đọc nhầm nhất của phiên
  bản này, và đã được nói rõ ở cả ba tài liệu: một cái nói **không có** trục trạng thái, cái kia nói
  trục **có** và đây là gốc của nó. Chúng hỏng theo hai kiểu khác nhau nên không được gộp.
- **Tập mã có thể bị đọc thành một danh sách để vạch chia.** Ai đó sẽ dán đủ mười lớp lên mọi phần tử.
  Luật đọc theo chiều ngược lại: mỗi mã khai báo chỉ được thêm khi có một năng lực **thật sự tồn
  tại** đòi nó. Thừa một lớp cũng là sai — nó hứa một điều phần tử không làm được.
- **Ngoại lệ `aria-disabled` đòi kỷ luật ở tầng hàm xử lý.** CSS không tự chặn hành động; nếu hàm xử lý
  quên chặn, phần tử trông như bị khoá mà vẫn bấm được. Đây là ngoại lệ duy nhất trong mô-đun mà
  mã đánh dấu không tự bảo vệ được chính nó.

## Điều kiện phản biện lại

- Có đề xuất thêm một mã trạng thái mới, hoặc tách `STATE-6`.
- Có phần tử vẽ `hover:` mà không vẽ `focus-visible:`.
- Có `outline-none` xuất hiện mà không có lớp thay thế trong cùng class CSS danh sách.
- Có lớp trạng thái đổi kích thước, cân nặng chữ, bề dày viền hoặc vị trí.
- Có `disabled` được dùng cho một giá trị mà người dùng cần đọc hoặc văn bản.
- Có trạng thái chỉ tồn tại trong CSS mà không có `aria-*`, `disabled` hay `readOnly` tương ứng.
- Có ai kết luận một màn hình "đã xong" chỉ dựa trên ảnh chụp.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
