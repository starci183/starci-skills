---
id: fe-principles-distribution-audit
title: audit.md
slug: /gates/principles/distribution/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định và khả năng chống bịa của luật Phân bố.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `distribution`

Phản biện này kiểm xem luật có chọn được một class CSS thường từ **hành vi đã nêu khi thừa và khi thiếu chỗ**,
và chỉ từ đó.

## Kết luận

Chấp nhận. Tập mã đóng, tổng, phân định được bằng một tiêu chí duy nhất (phần thiếu quyết định), và
không phụ thuộc tên sản phẩm hay thành phần nào.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `DIST-0` so với `DIST-3` | Loại trừ được khi đã nêu hàng có nội dung động hay không |
| `DIST-1` so với `DIST-2` | Loại trừ được khi đã nêu có **một** hay **nhiều** người nhận phần dư |
| `DIST-1` so với `DIST-4` | Loại trừ được khi đã nêu hành vi lúc hàng **rộng** |
| `DIST-1` so với `DIST-6` | Loại trừ được khi đã nêu thứ phải to ra là phần tử con hay khoảng cách |
| `DIST-2` so với `DIST-5` | Loại trừ được khi đã nêu có cột nào chốt số đo trước |
| `DIST-3` so với `DIST-4` | Loại trừ được khi đã nêu mất một phần thì hiểu **sai** hay đọc **ít hơn** |
| `DIST-3` so với `DIST-5` | Loại trừ được khi đã nêu số đo đến từ nội dung hay từ bố cục |
| Phần tử con vừa giãn vừa cấm cắt | Loại trừ được bằng luật "phần thiếu quyết định": `DIST-3` mang `grow` |
| Thiếu hành vi | Lấy mã **khai báo ít hơn**; chỉ một câu hỏi khi bên yêu cầu nói rõ cần vai trò lớn hơn |

## Nhận định

- Mật độ thị giác và trục (ngang/dọc) đã bị loại khỏi tập tiêu chí phân loại. Trục chỉ đổi **cách
  viết** (`min-w-0` hoặc `min-h-0`), không đổi mã.
- Hai chiều hành vi — lúc thừa và lúc thiếu — có thể mâu thuẫn trong cùng một phần tử con. Luật "phần thiếu
  quyết định" là thứ giữ cho tập mã còn loại trừ lẫn nhau; bỏ nó ra thì `DIST-1` và `DIST-3` chồng
  lên nhau ngay ở trường hợp nút vừa giãn vừa cấm cắt.
- `min-w-0` được nâng thành **một mã riêng** (`DIST-4`) chứ không để làm phần phụ của `DIST-1`. Đây
  là quyết định trung tâm của mô-đun: thiếu `min-w-0` không tạo ra lỗi nào để đọc, nên nó phải có tên
  để có thể bị trích dẫn và bị bắt lỗi.
- Quyền được co **không di truyền**. Một `min-w-0` ở mắt xích ngoài không mở khoá cho mắt xích trong.
  Đây là chỗ một khai báo đúng vẫn cho ra kết quả sai, và nó đã được nói rõ ở cả ba tài liệu.
- `DIST-6` cần một mở rộng về định nghĩa "người tham gia": khoảng cách giữa các phần tử cũng là người tham gia. Không có mở
  rộng đó, câu hỏi "phần dư đi đâu khi không phần tử con nào lấy" không có mã nào trả lời, và người viết sẽ
  mượn `flex-1` để làm việc của `ml-auto`.
- Ranh giới với mô-đun `overflow` đã được đặt ở đúng một chỗ: mô-đun này quyết định **có được nhường
  hay không**; `overflow` quyết định **nội dung bên trong trông thế nào sau khi đã nhường**.
- Ranh giới với mô-đun `gap` đã được đặt: `gap` sở hữu khoảng cách lúc nghỉ; `DIST-6` sở hữu phần dư.
  Một khoảng cách giữa các phần tử nở ra vì `DIST-6` là khoảng cách **bị giãn**, không phải khoảng cách được chọn to hơn.

## Quyết định

- Giữ đúng bảy mã: `DIST-0`, `DIST-1`, `DIST-2`, `DIST-3`, `DIST-4`, `DIST-5`, `DIST-6`.
- Miền của mã là **một người tham gia, trên một trục, của một phần tử cha** — không phải một hàng và không
  phải một cây.
- Người tham gia gồm cả phần tử con lẫn khoảng cách giữa các phần tử.
- Phần thiếu quyết định mã; phần dư là tiêu chí phụ.
- Số đo khai báo luôn đi kèm lời từ chối co; `minmax(0,1fr)` là cách viết của lưới.
- Giữ mọi ví dụ ở dạng tổng quát, `className`-đầu tiên, không tên sản phẩm.
- Luật là **bắt buộc**: không có hàng nào nhỏ tới mức được miễn khai báo mã.

## Rủi ro còn mở

### Chỗ lệch so với tập mã gợi ý ban đầu

- **`DIST-5` được viết lại từ phía phần tử con.** Bản gợi ý mô tả nó như một **hình dạng hàng** ("thanh dọc cố
  định cạnh vùng lỏng"), trong khi sáu mã còn lại mô tả **vai trò của một người tham gia**. Trộn hai
  cấp độ vào một tập thì tập không còn loại trừ lẫn nhau: cái thanh dọc trong hình dạng đó vẫn cần một mã
  riêng, và vùng lỏng bên cạnh nó chính là `DIST-1`. Nay `DIST-5` là vai trò "giữ số đo do bố cục
  quyết định"; hình dạng hàng cũ trở thành **tổ hợp** `DIST-5` + `DIST-1`, và tổ hợp đó có ví dụ
  riêng trong `example.md`. className không đổi.
- **Thêm `DIST-6`.** Tập gợi ý không có mã nào trả lời câu hỏi "phần dư đi đâu khi **không** phần tử con
  nào nên lấy". Thiếu mã đó, mọi yêu cầu dạng "đẩy cái này sang phải" đều bị viết bằng `flex-1`, kéo
  theo hai hậu quả: phần tử con bị biến thành người gánh phần thiếu, và vùng bấm của nó kéo dài qua khoảng
  trống. Đây là một tình huống thật, dày, và trước đó **không có tên** — đúng loại tình huống mà
  không ai bị bắt lỗi được.
- **`DIST-0` được phát biểu lại thành "một hành vi", không phải "không có gì".** Bản gợi ý đọc là
  "mọi phần tử con lấy kích thước tự nhiên"; điều đó đúng nhưng bỏ sót phần nguy hiểm: mặc định của flex là
  **có co, nhưng chỉ tới sàn nội dung**. Nói "kích thước tự nhiên" khiến người đọc tưởng `DIST-0` là
  trung tính, trong khi nó chính là trạng thái sinh ra mọi lỗi mà `DIST-4` phải sửa.

### Rủi ro chưa đóng

- **`DIST-2` gánh hai cách chia.** Chia đều **cột** (`flex-1`) và chia đều **phần thêm** (`grow`) là
  hai kết quả hiển thị khác nhau dưới cùng một mã. Câu hỏi phân định đã có, nhưng nếu thực tế cho thấy
  hai thứ này bị chọn nhầm lặp lại, việc tách `DIST-2` làm hai là một **đề xuất thay đổi luật**, không
  phải một lần chọn khác đi.
- **`DIST-6` có hai cách phát ra: `ml-auto` và `justify-between`.** Cả hai nói cùng một quyết định.
  Luật cấm dùng chung trong một phần tử cha, nhưng chưa có phép thử tự động nào bắt được vi phạm này.
- **Ranh giới với `overflow` phụ thuộc vào việc đọc đúng hai mô-đun.** `min-w-0` xuất hiện ở cả hai
  nơi vì cùng một class CSS phục vụ hai câu hỏi khác nhau. Ai chỉ đọc một trong hai mô-đun vẫn có thể
  viết đúng, nhưng sẽ giải thích sai lý do — và giải thích sai là thứ được sao chép sang chỗ tiếp
  theo.
- **Số mã có thể bị đọc thành thang liên tục.** `DIST-0`…`DIST-6` không phải một thang từ nhỏ tới
  lớn; đó là bảy vai trò rời nhau. Số chỉ để trích dẫn.

## Điều kiện phản biện lại

- Có đề xuất thêm một vai trò phân phối mới, hoặc tách `DIST-2`.
- Xuất hiện một hàng mà mọi người tham gia đều `DIST-3` hoặc `DIST-5` — hàng đã tuyên bố sẽ tràn.
- Có `flex-1` được dùng để đẩy một phần tử con sang mép thay vì `ml-auto`.
- Có `w-*` trên phần tử con flex mà không kèm lời từ chối co.
- Có phần tử rỗng được dùng làm miếng đệm.
- Một `truncate`, `line-clamp` hoặc vùng cuộn không chạy, và nguyên nhân là một mắt xích thiếu
  `min-w-0` hoặc `min-h-0`.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
