---
id: fe-principles-radius-changelog
title: changelog.md
slug: /fe/principles/radius/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật Bán kính bo góc.
---

# changelog.md

> Phiên bản hiện tại: `2.00` · Mô-đun: `radius`

## Quy tắc phiên bản

Một thay đổi luật được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc mô-đun hoặc nhóm mà nó nằm trên.

## 2.00 — 2026-08-16

Mô-đun được **dựng mới** ở số chính `2.00`, để đứng cùng hình dạng và cùng phiên bản với các mô-đun
khác trên nhóm `principles/`. Không có `1.x` nào của nó: câu hỏi này trước đây không có nhà, và một
mô-đun ra đời với hình dạng của phiên bản hiện hành thì không nên giả vờ có quá khứ.

- **Nhận câu hỏi.** Mô-đun trả lời **tròn bao nhiêu**, và **một góc lồng bên trong thì quan hệ thế
  nào với góc bao quanh nó**. Trước đây câu hỏi thứ hai được truyền miệng dưới dạng một công thức lẻ
  và không có mã nào để trích dẫn, nên không ai có thể bị chỉ ra là đã làm sai.
- **Đứng trên nhóm `principles/`.** Cùng chỗ với các nguyên tắc dựng hình bắt buộc: mỗi tình huống
  hiển thị ra rơi vào đúng một mã, và mã đó phát ra một `className` thường. `senses/` giữ những gì người
  đọc cảm nhận, `governance/` giữ ngoại lệ và tính đồng nhất; không phần nào của luật này nằm ở hai chỗ đó.
- **Đặt sáu mã tình huống.** `RADIUS-0` … `RADIUS-5`. Chỉ số **liên tục, không thủng**, và đó là khác
  biệt cố ý so với các mô-đun dùng thang có lỗ. Ở đây chỉ số **không** phải một bậc đo được: nó không
  xếp từ nhỏ tới lớn, nên không có chỗ nào để "chia đôi" giữa hai mã. Thứ tự chỉ đi từ *không có góc*
  (`0`), qua hai bậc được chọn (`1`, `2`), tới hình vốn tròn (`3`), rồi tới hai mã trả lời câu hỏi
  khác hẳn: `4` tính bán kính từ cái bên ngoài, `5` nói góc nào tồn tại.
- **Đặt `RADIUS-4` làm mã chịu lực.** Nó không giữ giá trị nào; nó là luật rằng một góc nằm trong cung
  của góc khác thì được **tính**, không được chọn, và nó thắng mọi mã bậc khi áp dụng được. Con dấu
  dán — hộp trong giữ nguyên bán kính hộp ngoài — là lỗi mà cả mô-đun tồn tại để chặn.
- **Chốt một giá trị gốc.** `R` là bậc bề mặt; bậc thành phần điều khiển là `R / 2`; mọi giá trị khác là kết quả
  của `ngoài − khoảng cách`. Nhờ vậy `rounded-sm`, `rounded` và `rounded-lg` **chỉ tồn tại như kết
  quả**, không bao giờ như lựa chọn — một con số không với tới được bằng mắt thì không có chỗ cho giá
  trị tự chế ẩn nấp.
- **Đóng mép của ràng buộc đồng tâm.** Ràng buộc chỉ tác dụng khi khoảng cách **nhỏ hơn** bán kính
  ngoài; bằng hoặc lớn hơn thì góc trong đã ra khỏi cung ngoài và tự do. Bằng 0 thì không phải phép
  trừ mà là **cha cắt xén, con để trơn**, giữ nguyên tắc một góc chỉ khai ở một nơi.
- **Cho `RADIUS-0` hai phát ra.** Không có class CSS nghĩa là **không có ranh giới**; `rounded-none` nghĩa
  là **có ranh giới và nó từ chối bo**. Hai chuyện khác nhau nên không được viết giống nhau, và cái
  thứ hai phải viết ra để người đọc thấy quyết định đã được lấy chứ không phải bị quên.
- **Tách "góc nào" khỏi "tròn bao nhiêu".** `RADIUS-5` chỉ trả lời câu thứ nhất; độ lớn vẫn do mã bậc
  hoặc phép trừ quyết định. Trộn hai câu vào một là cách một hệ thống có hai bán kính bề mặt mà không
  ai nhớ vì sao.
- **Viết `example.md` theo từng mã, kèm số học.** Mỗi ví dụ `RADIUS-4` viết ra phép trừ đã dùng, vì
  phép trừ chính là bằng chứng; một ví dụ không nêu khoảng cách thì không kiểm được.
- **Để lại cho mô-đun bên cạnh, cố ý.** Khoảng cách mà phép trừ ăn vào là do mô-đun `padding` quyết
  định — mô-đun này chỉ **đo** con số đó, không bàn nó nên là bao nhiêu. Việc một bề mặt có được phép
  nằm trong một bề mặt khác hay không thuộc về `surface-in-surface`. Khoảng cách giữa các phần tử giữa các phần tử cùng cấp thuộc về
  `gap`. Viền, bóng và màu của ranh giới thuộc về các mô-đun của chúng. Ở đây chỉ có góc.
