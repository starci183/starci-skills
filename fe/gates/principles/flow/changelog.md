---
id: fe-principles-flow-changelog
title: changelog.md
slug: /gates/principles/flow/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật Luồng.
---

# changelog.md

> Phiên bản hiện tại: `2.00` · Mô-đun: `flow`

## Quy tắc phiên bản

Một thay đổi luật được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc mô-đun hoặc nhóm mà nó nằm trên.

## 2.00 — 2026-08-16

Mô-đun mới, mở ở `2.00` để đứng cùng phiên bản với các mô-đun khác trên nhóm `gates/principles/`.

- **Nhận lấy một câu hỏi trước nay không có chủ.** Câu hỏi đó là: *các con trực tiếp của một
  vùng chứa chạy theo trục nào, và khi hết bề rộng thì cái gì nhường?* Trước bản này, câu hỏi được
  trả lời rải rác — một phần nằm trong ví dụ của mô-đun khoảng cách, một phần nằm trong phần thiết kế đáp ứng, một
  phần không nằm ở đâu cả. Hệ quả là những khai báo trục sai không vi phạm luật nào, vì không có luật
  nào nhận chúng.
- **Đứng trên nhóm `principles/`.** Nhóm này giữ các nguyên tắc dựng hình **bắt buộc**: thứ phải
  quyết trước khi có bất kỳ thứ gì để nhìn. Luồng đứng ở vị trí sớm nhất trong nhóm đó, vì `gap` chỉ
  tồn tại bên trong flex và lưới — chưa khai báo trục thì khoảng cách giữa các phần tử bắt buộc phải rơi xuống `margin` của
  con, tức là vi phạm mô-đun khoảng cách từ trước khi mô-đun khoảng cách được đọc tới.
- **Đặt chín mã tình huống, đánh số theo họ.** `FLOW-0` và `FLOW-1` **không phát ra class CSS nào**:
  một cái vì không có trục để khai báo, một cái vì trục đã thuộc về thuật toán ngắt dòng. `FLOW-2`
  đến `FLOW-5` là họ một trục — hàng một dòng, chồng dọc, và hai câu trả lời khác nhau cho việc hết
  bề rộng: gãy dòng hay đổi trục. `FLOW-6` đến `FLOW-8` là họ lưới, khác nhau **chỉ** ở chỗ ai quyết
  số cột: sản phẩm, bề rộng tối thiểu của phần tử, hay vai trò của từng rãnh.
- **Số mã nói lên họ, không nói lên độ lớn.** Đây là chỗ khác biệt so với mô-đun khoảng cách, nơi số mã là
  một bậc trên thang. Ở đây không có thang nào cả: một chồng không "lớn hơn" một hàng. Vì vậy đọc mã
  theo cụm — `0-1` im lặng, `2-5` một trục, `6-8` hai trục — là cách nhớ đúng.
- **Nâng luật thành bắt buộc.** Mọi vùng chứa hiển thị ra nhiều hơn một thứ đều rơi vào đúng một mã.
  Hai mã không phát ra class CSS vẫn là mã, vì một tình huống không có tên là tình huống không ai bị bắt
  lỗi được.
- **Đóng lại hai chỗ trước nay chỉ được truyền miệng.** Thứ nhất: `flex-row` chỉ có lý do tồn tại
  trong `FLOW-5`, nơi nó huỷ `flex-col` tại một điểm ngắt — mọi chỗ khác nó là khai báo trùng với
  mặc định. Thứ hai: rãnh nội dung của `FLOW-8` là `minmax(0,1fr)` chứ không phải `1fr`, vì sàn
  `min-content` của `1fr` làm cả `truncate` lẫn cuộn ngang hỏng ở nơi khác với nơi gây ra lỗi.
- **Viết `vi.md` theo từng mã.** Mỗi mã có tình huống nghiệp vụ, dấu hiệu nhận biết, một câu tự hỏi
  phân định, ranh giới với từng mã kề, và danh sách tình huống hay gặp.
- **Viết `example.md` cho đủ trường hợp.** Mỗi mã nhiều trường hợp, kèm mục ngoại lệ và mục "trông giống nhưng
  không phải mã này", trong đó có các ví dụ **mã lồng mã** — kể cả một khung trang đầy đủ dùng sáu mã
  cùng lúc — để nói rõ luật *một cha, một luồng*.

### Những gì mô-đun này cố ý để lại cho mô-đun khác

- **Kích thước khoảng cách giữa các phần tử giữa các con** thuộc về mô-đun `gap`. Luồng chỉ tạo ra điều kiện để `gap` tồn tại;
  nó không có ý kiến gì về việc khoảng cách giữa các phần tử đó nên là bao nhiêu.
- **Ai nhường bề rộng trong một hàng một dòng** thuộc về mô-đun `overflow`. `FLOW-2` chỉ tuyên bố
  rằng dòng đó không được gãy; hệ quả của lời hứa ấy — `min-w-0`, `shrink-0`, `truncate` — được quyết
  ở nơi khác. Đây là ranh giới cố ý và cũng là ranh giới dễ dừng lại giữa chừng nhất.
- **Canh lề trên trục chéo** — `items-*`, `justify-*`, `place-*` — không thuộc mô-đun này. Chúng xuất
  hiện dày đặc trong ví dụ vì mã đánh dấu thật có chúng, nhưng chúng không bao giờ là lý do chọn mã.
- **Chọn điểm ngắt nào** thuộc về mô-đun `responsive`. Luồng chỉ nói rằng điểm ngắt là **một phần
  của mã**, không phải một mã khác ở bề rộng khác, và rằng khai báo đi theo hướng hẹp trước.
- **Khoảng đệm trong, nền, viền và bóng của hộp** thuộc về các mô-đun bề mặt. Một vùng chứa có mặt chỉ để bo
  góc và tô nền vẫn là `FLOW-0`, và đó là cách hai mô-đun này không giẫm lên nhau.
