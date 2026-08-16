---
id: fe-principles-grid-changelog
title: changelog.md
slug: /fe/principles/grid/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật Lưới.
---

# changelog.md

> Phiên bản hiện tại: `2.00` · Mô-đun: `grid`

## Quy tắc phiên bản

Một thay đổi luật được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc mô-đun hoặc nhóm mà nó nằm trên.

## 2.00 — 2026-08-16

Mô-đun được lập mới ở số chính `2.00` để đứng cùng thang phiên bản với các mô-đun khác trên nhóm
`fe/principles/`. Không có `1.x`: trước bản này câu hỏi mà nó nhận không thuộc về ai cả, và đó chính
là lý do nó được lập.

- **Nhận về câu hỏi nào.** Hệ cột: một trang cho phép nội dung tồn tại ở đâu, có bao nhiêu cột bên
  trong đó, và cái gì được phép đi ra ngoài. Trước đây câu hỏi này không có chủ: khảo sát cho 17 lượt
  khai báo `grid-cols-*` không quy chiếu về một trường nhập liệu chung nào. **Chính sự vắng mặt đó là phát
  hiện** — không phải 17 chỗ đặt sai, mà là chưa từng có một trường nhập liệu để mà đặt sai. Một con số không
  thể sai khi không có gì để so.
- **Đứng trên nhóm nào.** `fe/principles/grid/`. Nhóm `principles/` giữ các nguyên tắc dựng hình
  **bắt buộc** — thứ mà một bố cục hoặc tuân thủ hoặc vi phạm, không có vùng xám. Lưới thuộc về đây
  vì mép dọc dùng chung là một mệnh đề đo được, không phải một cảm nhận.
- **Đặt mã tình huống.** Tám mã `GRID-0`…`GRID-7`, chia hai trục. `GRID-0`…`GRID-4` nói về vùng chứa
  hoặc trường nhập liệu; `GRID-5`…`GRID-7` nói về một đứa con nằm trong rãnh. Đánh số theo trục chứ không theo
  thứ tự lịch sử, để người đọc trả lời "mình đang đặt tên cho cái gì" **trước**, rồi tập mã trả lời
  trong một bước.
- **Vì sao `GRID-4` là trường nhập liệu chứ không phải rãnh cột.** Nếu `GRID-4` mang nghĩa "rãnh cột và lề ngoài"
  thì nó không loại trừ được với `GRID-1`: một vùng chứa `grid-cols-3` cũng có rãnh cột, nên hai mã
  cùng đúng trên một phần tử và tập mã hết đóng. Giữ phần lề ngoài làm **trường nhập liệu**, giao phần rãnh cột
  cho mô-đun kề bên, thì mỗi phần tử về đúng một mã.
- **Vì sao có `GRID-5`.** Con chiếm đúng một cột là tình huống phổ biến nhất của cả mô-đun và là
  tình huống hay bị viết thừa class CSS nhất. Không đặt tên cho nó thì trục "con" không đóng, và một
  tình huống vô danh là tình huống không ai bị bắt lỗi được. `GRID-5` không phát ra class CSS nào — đúng
  như `GRID-0` — và đó chính là điểm của nó.
- **Vì sao `GRID-3` tách khỏi `GRID-1`.** `grid-cols-3` và `grid-cols-[16rem_minmax(0,1fr)]` cùng
  chốt một số cột, nhưng khác nhau ở một phép thử kiểm được: các con có đổi chỗ cho nhau được không.
  Gộp chúng làm mất câu hỏi phân định, và cùng với nó là lý do vì sao thêm một con thứ ba vào bố cục
  thanh dọc là **sai** chứ không phải "xuống hàng".
- **Chốt thang trường nhập liệu 4 / 8 / 12.** Lấy theo Chất liệu bố cục lưới, không lấy 4 / 8 / 16 của Carbon 2x
  lưới, vì 12 chia hết cho 2, 3, 4 và 6 còn 16 không chia hết cho 3 — một hàng ba-phần tử trong trường nhập liệu 16
  cột luôn lệch. Số cột vùng chứa khai phải chia hết trường nhập liệu ở điểm ngắt đó; số ngoài thang là luật
  thay đổi chứ không phải lựa chọn.
- **Năm tài liệu, không có `prompt.md`.** Ánh xạ yêu cầu bằng lời và bảng phân định ranh giới nằm cuối
  `example.md`, cùng chỗ với ví dụ mà chúng phân định.
- **Mọi ví dụ là `className` thuần.** Không thư viện thành phần, không khoá đăng ký, không tên sản
  phẩm. Một luật ở nhóm này phải đúng với bất kỳ giao diện nào; ví dụ cần tên riêng của một sản phẩm
  mới đọc được là ví dụ đứng sai chỗ.

### Cố ý để lại cho mô-đun kề bên

- **Giá trị rãnh cột.** Mô-đun khoảng cách giữa các phần tử sở hữu thang khoảng cách. Mô-đun này chỉ giữ luật **một trường nhập liệu một
  rãnh cột mỗi điểm ngắt**, rãnh cột là khoảng cách ngang duy nhất giữa các cột, và lề ngoài không nhỏ
  hơn rãnh cột. Nếu lưới cũng phát ra một giá trị khoảng cách thì hai mô-đun cùng sở hữu một quyết
  định, và bản sao thứ hai luôn là bản trôi đi.
- **Khoảng cách dọc giữa các phần nội dung.** Là quan hệ giữa phần tử cùng cấp, không phải hệ cột.
- **Chiều cao, căn chỉnh dọc và tỉ lệ ô.** `items-*`, `aspect-*` và chiều cao hàng nằm ngoài mô-đun
  này; lưới chỉ nói về trục ngang và về cái gì được phép ra khỏi lề.
- **Thứ tự đọc và `order-*`.** Sắp xếp lại thứ tự khi thiết kế đáp ứng là quyết định về nội dung và về
  trợ năng, không phải về cột.
- **Cột bên trong `<table>`.** Bảng chạy thuật toán riêng; với mô-đun này nó là một đứa con.
- **`overflow-x-clip` ở vỏ trang.** `GRID-7` dạng tràn lề khung nhìn phụ thuộc quyết định này, nhưng
  quyết định thuộc về mô-đun sở hữu vỏ trang, không thuộc về từng khối.
