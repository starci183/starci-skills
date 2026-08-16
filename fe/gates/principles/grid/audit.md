---
id: fe-principles-grid-audit
title: audit.md
slug: /gates/principles/grid/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định và khả năng chống bịa của luật Lưới.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `grid`

Phản biện này kiểm xem luật có chọn được một hệ cột thường từ **dữ kiện đã nêu**, và chỉ từ đó.

## Kết luận

Chấp nhận. Tập mã đóng và tổng, chia theo hai trục kiểm được (vùng chứa/trường nhập liệu và con), không phụ
thuộc tên sản phẩm hay thành phần nào.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `GRID-0` so với `GRID-1` | Loại trừ được khi đã nêu có cần mép dọc dùng chung hay không |
| `GRID-1` so với `GRID-2` | Loại trừ được khi đã nêu số phần tử là authored hay đến từ dữ liệu |
| `GRID-1` so với `GRID-3` | Loại trừ được khi đã nêu các con có thay thế nhau được không |
| `GRID-2` so với `GRID-3` | Loại trừ được khi đã nêu rãnh đồng dạng hay có vai trò riêng |
| `GRID-4` so với mọi vùng chứa | Loại trừ được khi đã nêu phần tử quyết định độ dài dòng hay quyết định rãnh |
| `GRID-5` so với `GRID-6` | Loại trừ được khi đã nêu con có đòi thêm cột hay không |
| `GRID-6` so với `GRID-7` | Loại trừ được khi đã nêu khối dừng ở mép cột hay ra khỏi lề |
| `GRID-7` so với `GRID-4` | Loại trừ được khi đã nêu phạm vi: một khối hay cả trang |
| Thiếu dữ kiện | Lấy mã đòi ít hơn; chỉ một câu hỏi khi bên yêu cầu nói rõ cần mép dọc dùng chung |
| Trục sai | Một phần tử không bao giờ mang đồng thời một mã vùng chứa và một mã con |

## Nhận định

- **Bằng chứng khởi phát: không có hệ cột nào cả.** Khảo sát phạm vi cho 17 lượt khai báo `grid-cols-*`
  không quy chiếu về một trường nhập liệu chung: các con số không nằm trên một thang, không chia hết một tổng
  nào, và không lặp lại giữa các màn. Phát hiện ở đây **không** phải "17 chỗ đặt sai"; phát hiện là
  **sự vắng mặt** — chưa từng có một trường nhập liệu để mà đặt sai. Đó là lý do mô-đun này bắt đầu ở `GRID-4`
  (trường nhập liệu) chứ không ở `grid-cols-*`.
- Sự vắng mặt đó cũng giải thích vì sao trước đây không ai bị bắt lỗi: một con số không thể sai khi
  không có gì để so. Thang 4 / 8 / 12 tồn tại để biến một sở thích thành một mệnh đề kiểm được.
- Tách trường nhập liệu khỏi vùng chứa là quyết định có hệ quả kỹ thuật, không chỉ hệ quả khái niệm: nút DOM gộp
  `mx-auto max-w-* px-* grid grid-cols-*` làm `GRID-7` không biểu đạt được, vì tràn lề phải triệt
  tiêu khoảng đệm trong của chính cha nó ở mọi điểm ngắt.
- Mật độ thị giác, "trông cho thoáng" và bề rộng màn hình của người viết mã đã bị loại khỏi tập
  tiêu chí phân loại.
- `GRID-0` và `GRID-5` được nâng thành **mã tình huống** trong khi vẫn cấm `grid-cols-1` cho dòng
  chảy và `col-span-1` cho ô mặc định. Đây là chỗ dễ đọc nhầm nhất của phiên bản này và đã được nói
  rõ ở cả ba tài liệu.
- Hai ngoại lệ `grid-cols-1` và `col-span-1` **được phép** khi chúng là bậc cơ sở của một thang có
  điểm ngắt. Ranh giới: một mình thì cấm, có bậc sau thì hợp lệ.
- Rãnh cột được giao lại cho mô-đun khoảng cách giữa các phần tử thay vì định nghĩa lại ở đây. Nếu mô-đun này cũng phát ra một
  giá trị khoảng cách thì hai mô-đun sẽ cùng sở hữu một quyết định, và bản sao thứ hai luôn là bản
  trôi đi.

## Quyết định

- Giữ đúng tám mã: `GRID-0`…`GRID-7`, chia hai trục — `GRID-0`…`GRID-4` cho vùng chứa và trường nhập liệu,
  `GRID-5`…`GRID-7` cho con.
- Trường nhập liệu và vùng chứa là **hai** phần tử. Đây là điều kiện bất biến mạnh nhất của mô-đun.
- Thang trường nhập liệu 4 / 8 / 12 theo Chất liệu bố cục lưới, không theo 4 / 8 / 16 của Carbon 2x lưới, vì 12
  chia hết cho 3 còn 16 thì không.
- Số cột khai báo phải chia hết số cột trường nhập liệu ở điểm ngắt đó; số ngoài thang là thay đổi luật.
- Rãnh cột thuộc mô-đun khoảng cách giữa các phần tử; mô-đun này chỉ giữ luật một trường nhập liệu một rãnh cột mỗi điểm ngắt và lề ngoài
  không nhỏ hơn rãnh cột.
- Bảng là một con, không phải một vùng chứa tạo cột.
- Mặc định lấy mã đòi ít hơn; chỉ hỏi một câu khi bên yêu cầu nói rõ cần quan hệ mạnh hơn.
- Giữ mọi ví dụ ở dạng tổng quát, `className`-đầu tiên, không tên sản phẩm.
- Luật là **bắt buộc**: không có kích thước bố cục nào được miễn khai báo mã.

## Rủi ro còn mở

- **Lệch khỏi bộ nguồn đã cho, và lệch có chủ ý.** Bộ nguồn sáu mã là `GRID-0` không lưới · `GRID-1` số cột
  cố định · `GRID-2` cột suy ra từ min chiều rộng · `GRID-3` con trải nhiều cột · `GRID-4` rãnh cột và lề
  ngoài · `GRID-5` tràn lề toàn chiều rộng. Bản này thay đổi bốn chỗ:
  - **Tách `GRID-3` mới (rãnh có vai trò cố định) ra khỏi `GRID-1`.** `grid-cols-3` và
    `grid-cols-[16rem_minmax(0,1fr)]` cùng là "số cột cố định" nhưng khác nhau ở chỗ kiểm được: con
    có thay thế nhau được hay không. Gộp chúng làm câu hỏi phân định biến mất, và cùng với nó là lý
    do vì sao thêm một con thứ ba vào bố cục thanh dọc là **sai** chứ không phải "xuống hàng".
  - **Thêm `GRID-5` (con chiếm đúng một cột).** Bộ nguồn không đặt tên cho tình huống **phổ biến nhất**
    của toàn mô-đun. Không có nó, trục "con" không đóng: `GRID-6` và `GRID-7` phủ con đòi thêm, còn
    con không đòi gì thì vô danh — mà một tình huống vô danh là tình huống không ai bị bắt lỗi được.
  - **Đổi `GRID-4` từ "rãnh cột và lề ngoài" thành "trường nhập liệu".** Ở dạng bộ nguồn, `GRID-4` không loại trừ
    được với `GRID-1`: một vùng chứa `grid-cols-3` **cũng** có rãnh cột, nên hai mã cùng đúng trên một
    phần tử và tập mã hết đóng. Giữ lại phần "lề ngoài" làm trường nhập liệu, giao phần "rãnh cột" cho mô-đun
    khoảng cách giữa các phần tử, thì mỗi phần tử về đúng một mã.
  - **Đánh số lại theo trục** thay vì theo thứ tự bộ nguồn. Độ trải cột và tràn lề lùi về `GRID-6`, `GRID-7`
    để `GRID-0`…`GRID-4` là vùng chứa/trường nhập liệu và `GRID-5`…`GRID-7` là con. Cái giá: ai quen bản bộ nguồn
    sẽ đọc nhầm `GRID-3` và `GRID-5`. Cái được: đọc trục trước thì tập mã trả lời trong một bước.
- **Thang 4 / 8 / 12 là một lựa chọn, không phải một định lý.** Nó loại `grid-cols-5` và
  `grid-cols-7` một cách cứng rắn. Nếu thực tế xuất hiện một bố cục mà năm cột là yêu cầu nghiệp vụ
  thật, đó là một đề xuất đổi thang — không phải một lần chọn khác đi.
- **Ranh giới `GRID-1` / `GRID-2` vẫn là chỗ chọn sai nhiều nhất**, vì `grid-cols-3` luôn trông đúng
  trên màn hình của người viết ra nó. Câu hỏi "ngày mai dữ liệu trả về mười bảy phần tử thì có ai phải
  sửa class CSS không" là phép thử rẻ nhất hiện có, nhưng nó phụ thuộc vào việc người trả lời **biết**
  dữ liệu đến từ đâu.
- **`GRID-7` phụ thuộc một quyết định ngoài mô-đun.** Tràn lề khung nhìn chỉ an toàn khi tổ tiên nhận
  `overflow-x-clip`. Mô-đun này nêu điều kiện nhưng không sở hữu nó; nếu vỏ trang không nhận, mọi
  `GRID-7` dạng `w-screen` đều là nợ.

## Điều kiện phản biện lại

- Có đề xuất thêm một số cột nằm ngoài thang 4 / 8 / 12.
- Xuất hiện một nút DOM vừa giữ `max-w-*` vừa khai `grid-cols-*`.
- Một trang có nhiều hơn một `max-w` ở cấp trường nhập liệu, ngoài độ dài dòng đọc.
- Có con dùng `width` hoặc `basis` để tạo độ trải cột.
- Mã thiết kế đáp ứng đổi mã dù vai trò bố cục không đổi.
- Lưới rỗng hoặc khung chờ dùng số cột khác lưới có dữ liệu.
- Một `-mx-*` xuất hiện trên phần tử không phải con trực tiếp của trường nhập liệu.
- Mô-đun khoảng cách giữa các phần tử đổi thang rãnh cột, khiến luật "lề ngoài không nhỏ hơn rãnh cột" cần đo lại.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
