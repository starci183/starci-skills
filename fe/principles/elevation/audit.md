---
id: fe-principles-elevation-audit
title: audit.md
slug: /fe/principles/elevation/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định và khả năng chống bịa của luật Độ nổi.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `elevation`

Phản biện này kiểm xem luật có chọn được một chuỗi class CSS thường từ **nền cục bộ và thứ bị che**, và chỉ
từ đó.

## Kết luận

Chấp nhận. Thang đóng, tổng quát, không phụ thuộc tên sản phẩm hay thành phần nào. Bảy mã phủ kín cả
hai nửa của câu hỏi — *cái gì nằm trên cái gì* và *bằng phương tiện nào* — và không mã nào phát ra
cùng một class CSS với mã khác.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `ELEVATION-0` so với `ELEVATION-1` | Loại trừ được khi đã nêu nền cục bộ là trang hay một bề mặt |
| `ELEVATION-1` so với `ELEVATION-2` | Loại trừ được khi đã nêu nguồn gốc: có sẵn hay được gọi ra |
| `ELEVATION-2` so với `ELEVATION-3` | Loại trừ được khi đã nêu bỏ qua nó có mất gì không |
| `ELEVATION-3` so với `ELEVATION-4` | Loại trừ được khi đã nêu có câu hỏi nào phải trả lời không |
| `ELEVATION-4` so với mọi mã có bóng | Loại trừ được khi đã nêu cần thứ tự hay cần độ cao |
| `ELEVATION-1` so với `ELEVATION-5` | Loại trừ được khi đã nêu bóng có đọc được trên nền đó không |
| `ELEVATION-0` so với `ELEVATION-5` | Loại trừ được khi đã nêu phần tử có nằm **trên** vật chủ không |
| `ELEVATION-0` so với `ELEVATION-6` | Loại trừ được khi đã nêu có gì chảy hoặc được đổ vào bên trong |
| Thiếu dữ kiện | Lấy bậc thấp hơn liền kề; chỉ một câu hỏi khi bên yêu cầu nói rõ cần tuyên bố lớn hơn |

## Nhận định

- **Độ đậm của bóng đã bị loại khỏi tập tiêu chí phân loại.** Không mã nào được chọn bằng cách so
  sánh hai cái bóng với nhau; mọi mã đều được chọn bằng nền và thứ bị che.
- **Tách độ cao khỏi thứ tự là quyết định quan trọng nhất của phiên bản này.** Khi hai thứ đó bị gộp,
  mọi tranh chấp `z` đều bị đọc thành "chưa đủ cao" và câu trả lời luôn là một con số to hơn. Sau khi
  tách, cùng một triệu chứng được đọc thành một câu hỏi khác: *tổ tiên nào đã đóng ngữ cảnh xếp chồng
  lại*, và câu đó có đáp án sửa được.
- **Số `z` to hơn không phải tuyên bố mạnh hơn.** Hai tiện ích cùng cơ chế xếp tầng lớp phân định bằng thứ tự
  nguồn. Đây là chỗ luật dễ bị hiểu ngược nhất, và nó được nói rõ ở cả `INDEX.md`, `vi.md` lẫn
  `example.md` vì hậu quả của việc hiểu ngược là một vòng leo số không có điểm dừng.
- **`ELEVATION-4` mang nhiều tình huống nhất** — bám dính sub-phần đầu, chrome cấp trang, nhãn trạng thái trong
  thành phần, decor phía sau, phủ kín lúc tải. Chúng thống nhất ở một điểm: chỉ tuyên bố thứ tự, không
  tuyên bố độ cao. Nếu thực tế cho thấy chúng cần tách, đó là một đề xuất đổi luật.
- **Chỉ có một mức bóng nghỉ.** Đây là ràng buộc chung với mô-đun bề mặt và là điều giữ cho thang
  không trôi thành một bảng màu bóng. Yêu cầu "nổi bật hơn" được trả lời bằng màu, viền hoặc kích
  thước, không bằng một bậc mới.
- **`ELEVATION-6` là mã duy nhất đi xuống.** Nó không phải một bậc âm của thang: một cái giếng không
  phải "cao âm một", nó là một loại tuyên bố khác. Vì vậy nó nằm ở nửa *phương tiện* của bộ mã, cùng
  `ELEVATION-4` và `ELEVATION-5`, chứ không nằm trước `ELEVATION-0`.
- **Ranh giới với mô-đun bề mặt đã được nêu rõ và không tự mâu thuẫn.** Hai mô-đun có thể phát ra
  cùng một class CSS cho cùng một phần tử vì hai lý do khác nhau — một bên vì quan hệ nhóm, một bên vì độ
  cao — nhưng chúng không bao giờ được nói ngược nhau về cùng một phần tử. Chỗ mơ hồ còn lại nằm ở
  những vùng chứa vừa là đối tượng độc lập vừa là thành viên của một tập, và đáp án là: quyết định
  quan hệ nhóm chạy trước, độ nổi đọc kết quả đó làm nền cục bộ.
- **Mô-đun không phát ra `relative`, `absolute`, `fixed`, `sticky`.** Mọi mã nâng đều phải bám vào một
  trong số đó, nhưng việc chọn cái nào là của mô-đun vị trí. Nếu một ngày mô-đun này bắt đầu tranh
  luận về `fixed` hay `sticky`, nó đã lấn sang nhóm khác.

## Quyết định

- Giữ đúng bảy mã: `ELEVATION-0` … `ELEVATION-6`.
- Coi độ nổi là tuyên bố về **thứ nằm trên thứ khác**, đo từ **nền cục bộ**.
- Chia bộ mã làm hai nửa: `0`–`3` là thang thật, `4`–`6` là phương tiện. Đây là cách duy nhất giữ cho
  bộ mã vừa đóng vừa tổng, vì "thứ tự", "viền thay bóng" và "khoét xuống" không phải độ cao và không
  thể xếp xen vào thang mà không nói dối.
- Ghim mọi `z` vào một thang bảy dòng đóng (`-z-10` và sáu bậc dương). Số ở giữa hai bậc hoặc trên bậc
  trên cùng là đề xuất đổi luật.
- `ELEVATION-2` và `ELEVATION-3` phát ra **hai** class CSS, vì một lớp nâng mà không có thứ tự là chưa
  xong việc.
- Giữ đúng **ba** tên bóng và **một** mức bóng nghỉ.
- Cấm độ nổi đổi theo con trỏ chuột; chỉ cho đổi khi tuyên bố **trở thành đúng** (cuộn, kéo).
- Giữ mọi ví dụ ở dạng tổng quát, `className`-đầu tiên, không tên sản phẩm.
- Luật là **bắt buộc**: không có kích thước phần tử nào được miễn khai báo mã.

## Rủi ro còn mở

- **Đã thêm một mã ngoài bộ hạt giống: `ELEVATION-6`.** Bộ hạt giống dừng ở `ELEVATION-5`. Bằng chứng
  từ vựng có `inset-shadow` với bốn mức sử dụng thật, và không mã nào trong bộ hạt giống nhận được
  chúng: một cái máng tiến độ không phải `ELEVATION-0` (nó **không** nằm trong mặt phẳng của nền), và
  chắc chắn không phải một bậc nâng nào. Nếu không đặt mã, những chỗ đó rơi vào vùng không tên, và bộ
  mã mất tính tổng. Đã thêm ở cuối để giữ nguyên số của năm mã hạt giống.
- **Không có mã nào bị bỏ, tách hay gộp.** Năm mã hạt giống giữ nguyên chỉ số và nguyên nghĩa. Phần
  mở rộng duy nhất về nội dung là ở `ELEVATION-4`: bộ hạt giống nói "declared stacking thứ tự", bản này
  làm rõ rằng mã đó sở hữu **cả thang** mà `ELEVATION-2` và `ELEVATION-3` trích bậc từ đó. Không có
  cách nào khác để hai mã kia phát ra một con số mà vẫn giữ được nguyên tắc thang đóng.
- **Bộ mã có thể bị đọc thành một thang liên tục bảy bậc.** Ai đó thấy `ELEVATION-0`…`ELEVATION-6` sẽ
  hỏi `ELEVATION-5` cao hơn `ELEVATION-3` bao nhiêu. Câu trả lời nằm ngay dưới bảng mã trong
  `INDEX.md`: từ `4` trở đi không còn là bậc nữa. Đây là chỗ dễ đọc nhầm nhất của phiên bản này.
- **`z-[60]` là bậc duy nhất viết bằng giá trị tuỳ ý.** Nó nằm ngoài thang mặc định của một khung phát triển
  tiện ích, nên nhìn như một ngoại lệ trong khi nó là một bậc chính thức. Nếu một ngày thang mặc định
  vươn tới đó, dòng này nên được viết lại — nhưng chỉ bằng một lần đổi luật, không bằng một lần chọn
  khác đi.
- **Ngoại lệ "nổi lên khi cuộn" và "nhấc lên khi kéo" là hai chỗ duy nhất độ nổi đổi theo thời
  gian.** Cả hai đều hợp lệ vì tuyên bố trở thành đúng, nhưng cả hai cũng là cửa mà mọi hiệu ứng
  rê chuột sẽ tìm cách đi qua. Ranh giới phải giữ chặt: con trỏ đi qua **không** làm phần tử che thêm
  bất cứ thứ gì.
- **Nền tối là điều kiện của môi trường, không phải của phần tử.** Một phần tử có thể là
  `ELEVATION-1` ở chủ đề sáng và `ELEVATION-5` ở chủ đề tối. Đây là chỗ duy nhất mã phụ thuộc chủ đề, và
  nó được chấp nhận vì bậc không đổi — chỉ phương tiện đổi.

## Điều kiện phản biện lại

- Có đề xuất thêm một mức bóng nghỉ thứ hai.
- Có đề xuất thêm một bậc `z` mới, hoặc xuất hiện một `z` không nằm trong thang.
- Xuất hiện một `z` được đặt để thắng một tranh chấp thay vì để mô tả một thứ tự.
- Có hai lớp cấp phần thân cùng tranh bậc trên cùng.
- Độ nổi đổi theo `hover` hoặc `focus` mà không có thứ gì bị che thêm.
- Một phần tử mang cả `shadow-*` lẫn `border` cho cùng một tuyên bố.
- Mô-đun này bắt đầu phát ra `relative`, `absolute`, `fixed` hoặc `sticky`.
- Mô-đun này và mô-đun bề mặt nói ngược nhau về cùng một phần tử.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
