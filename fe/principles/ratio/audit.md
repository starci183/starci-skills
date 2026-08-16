---
id: fe-principles-ratio-audit
title: audit.md
slug: /fe/principles/ratio/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định và khả năng chống bịa của luật Tỷ lệ.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `ratio`

Phản biện này kiểm xem luật có chọn được một **cặp khung-và-cách khớp** thường từ **dữ kiện đã nêu**, và chỉ từ
đó — không cần nhìn tấm ảnh mẫu, không cần biết tên thành phần nào.

## Kết luận

Chấp nhận. Tập mã đóng và tổng quát: mọi khung nội dung đa phương tiện hiển thị ra đều rơi vào đúng một mã, và mã nào cấp
phép cắt thì nói rõ vì sao nó được cấp.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `RATIO-0` so với mọi mã | Loại trừ được khi đã nêu kích thước thật có mặt trong mã đánh dấu hay không |
| `RATIO-0` so với `RATIO-4` | Loại trừ được khi đã nêu con số nằm trong mã hay về cùng dữ liệu |
| `RATIO-1` so với `RATIO-3` | Loại trừ được khi đã nêu hình dạng do hàng xóm hay do chủ thể quyết định |
| `RATIO-2` so với `RATIO-3` | Loại trừ được khi đã nêu khung thay mặt cho nội dung động hay cho ảnh |
| `RATIO-2` so với `RATIO-4` | Loại trừ được khi đã nêu lý do rộng: nội dung động, hay quyết định bố cục |
| `RATIO-4` so với mã có tên | Loại trừ được bằng phép so số: trùng 1:1, 16:9, 4:3 thì dùng mã có tên |
| `RATIO-5` so với `RATIO-1`…`RATIO-4` | Loại trừ được khi đã nêu một cú cắt sẽ lấy đi cái gì |
| Thiếu dữ kiện mất mát | Lấy mã **cắt ít hơn**; chỉ một câu hỏi khi bên yêu cầu nói rõ cần hình dạng cắt nhiều hơn |

## Nhận định

- Tiêu chí phân loại đã bị rút hết khỏi **ngoại hình của một tấm ảnh cụ thể**. Không mã nào chọn được
  bằng cách nhìn tệp mẫu; tất cả đều chọn từ vai trò của khung và từ mất mát của cú cắt.
- **`fit` được nâng thành nửa bắt buộc của lời khai.** Đây là chỗ luật cũ hở nhiều nhất: khung đúng
  tỉ lệ mà thiếu `object-*` thì ảnh méo, và cái méo đó không bao giờ bị đọc là lỗi tỉ lệ.
- **Quyền cắt được gắn vào lý do sở hữu hình dạng.** `RATIO-1`…`RATIO-4` được cắt vì bố cục sở hữu
  hình dạng; `RATIO-5` không được cắt vì hình dạng thuộc về nguồn. Nhờ vậy "crop hay contain" không
  còn là một lựa chọn thẩm mỹ độc lập nữa — nó là hệ quả của mã.
- **`RATIO-0` được siết thành một khẳng định có bằng chứng.** Bỏ trống vì chưa nghĩ ra thì không phải
  `RATIO-0`. Nếu không siết, mã này sẽ trở thành cái sọt đựng mọi khung chưa ai quyết định, tức là
  đúng cái tình trạng mà mô-đun này sinh ra để chấm dứt.
- Tính đồng nhất trạng thái được đưa vào điều kiện bất biến chứ không để ở phần ví dụ: khung chờ lệch khung là một
  nguồn nhảy bố cục độc lập, xảy ra **ngay cả khi** trạng thái đã tải khai đúng.
- Phần mơ hồ còn lại chỉ nằm ở những yêu cầu bỏ sót một trong ba dữ kiện: khung nào giữ chỗ, kích
  thước nguồn có biết không, và cắt thì mất gì.

## Quyết định

- Giữ đúng sáu mã: `RATIO-0`, `RATIO-1`, `RATIO-2`, `RATIO-3`, `RATIO-4`, `RATIO-5`.
- Coi tỷ lệ là **cam kết chỗ trước khi dữ liệu về**, không phải cách trình bày một tấm ảnh.
- Đầu ra là một **cặp** (khung + cách khớp). Cặp mới là thứ duy nhất cho mỗi mã, không phải riêng class CSS
  khung.
- Một khung, một chủ sở hữu hình dạng. Không đặt tỉ lệ lên cả khung lẫn nội dung đa phương tiện, không đặt tỉ lệ cạnh
  chiều cao cố định.
- Mặc định lấy mã **cắt ít hơn**; chỉ hỏi một câu khi bên yêu cầu nói rõ họ cần hình dạng cắt nhiều
  hơn.
- Giữ mọi ví dụ ở dạng tổng quát, `className`-đầu tiên, không tên sản phẩm.
- Luật là **bắt buộc**: không có khung nội dung đa phương tiện nào nhỏ tới mức được miễn khai mã.

## Rủi ro còn mở

Bốn điểm dưới đây là **chỗ bản này lệch khỏi tập mã hạt giống**, ghi lại nguyên văn lý do để lần sau
không ai đảo ngược bằng trí nhớ.

- **`RATIO-5` bị định nghĩa lại.** Hạt giống viết `RATIO-5` là "luật lệch tỉ lệ: cắt, thêm dải trống, hay
  từ chối". Giữ nguyên như vậy thì tập mã **vỡ tính loại trừ**: một ảnh 16:9 đặt trong ô vuông vừa là
  `RATIO-1` vừa là `RATIO-5`, tức là một trường hợp rơi vào hai mã. Bản này phân phối **cắt** xuống
  `RATIO-1`…`RATIO-4` — nơi quyền cắt được cấp bởi việc bố cục sở hữu hình dạng — và giữ lại
  **thêm dải trống** cùng **từ chối** làm nội dung của `RATIO-5`, tình huống hình dạng thuộc về nguồn. Ba
  nhánh của luật lệch tỉ lệ vẫn còn đủ; chỉ có chỗ đứng của chúng là đổi.
- **`RATIO-0` bị siết.** Hạt giống viết "nội dung decides". Bản này thêm điều kiện hợp lệ: khung phải
  **không thể** nhảy, tức kích thước thật đã có mặt trong mã đánh dấu hoặc thứ đang hiển thị không phải nội dung đa phương tiện
  về muộn. Không siết thì `RATIO-0` mâu thuẫn với chính câu mở đầu của mô-đun.
- **`RATIO-4` được mở rộng.** Ngoài một hằng số do sản phẩm đặt, mã này nhận thêm tỉ lệ **tính theo
  bản ghi** từ `width`/`height` mà dữ liệu mang theo. Cách khác là thêm mã thứ bảy, nhưng mã đó sẽ
  chồng lấn với `RATIO-5` ở mọi ảnh do người dùng tải lên. Điểm chung giữ hai trường hợp trong cùng
  một mã là: **cả hai đều khai xong trước khi vẽ**.
- **Đầu ra là một cặp, không phải một class CSS.** Nếu chỉ tính class CSS khung thì `RATIO-3` và một
  `RATIO-5` dùng khung 4:3 sẽ trùng đầu ra, vi phạm điều kiện bất biến "không cặp nào phục vụ hai mã". Đưa
  `fit` vào đầu ra vừa giải quyết trùng lặp, vừa phản ánh đúng sự thật: khai hình dạng mà không khai
  cách lấp là chưa quyết định xong.

Ngoài bốn điểm trên, hai rủi ro còn để ngỏ:

- **`RATIO-4` gánh nhiều tình huống nhất** — hằng số của sản phẩm và con số của từng bản ghi. Nếu
  thực tế cho thấy hai thứ đó cần tách, đó là một đề xuất thay đổi luật, không phải một lần chọn khác
  đi.
- **Ranh giới `RATIO-2` / `RATIO-3` phụ thuộc vào một dữ kiện dễ bị bỏ sót**: cú bấm dẫn tới đâu. Yêu
  cầu nào không nói rõ điều đó sẽ rơi về `RATIO-3` theo luật cắt-ít-hơn, và đó là lựa chọn an toàn
  nhưng không phải lúc nào cũng là lựa chọn đúng.

## Điều kiện phản biện lại

- Có đề xuất thêm một tỉ lệ có tên mới, hoặc thêm một mã thứ bảy.
- Có khung khai tỉ lệ mà không khai `fit`, hoặc khai `fit` mà không có chặn.
- Có khung đặt tỉ lệ cạnh chiều cao cố định, hoặc đặt tỉ lệ lên cả khung lẫn nội dung đa phương tiện.
- Có khung chờ hoặc trạng thái lỗi dùng khung khác trạng thái đã tải.
- Có `object-cover` áp lên nguồn mà bốn cạnh đều mang nghĩa.
- Mã thiết kế đáp ứng đổi tỉ lệ mà vai trò bố cục không đổi.
- Yêu cầu lặp lại mà một câu hỏi phân định vẫn không giải quyết được.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
