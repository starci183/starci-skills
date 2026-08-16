---
id: fe-principles-divider-changelog
title: changelog.md
slug: /gates/principles/divider/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật Đường phân cách.
---

# changelog.md

> Phiên bản hiện tại: `2.00` · Mô-đun: `divider`

## Quy tắc phiên bản

Một thay đổi luật được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc mô-đun hoặc nhóm mà nó nằm trên.

## 2.00 — 2026-08-16

Mô-đun được dựng mới, và mở thẳng ở `2.00` để đứng cùng số với các mô-đun khác trên cùng nhóm: nó
sinh ra đã mang hình dạng `principles-v2` và mang mã tình huống, nên không có lịch sử `1.x` để kể.

- **Nhận lấy một câu hỏi đang không có chủ.** Câu hỏi là: *khi nào một ranh giới được vẽ thành
  **đường kẻ** thay vì thành khoảng trống, ai sở hữu đường kẻ đó, và nó chạy theo trục nào.* Trước
  đó câu hỏi này chỉ tồn tại như một dòng điều kiện bất biến ở luật khoảng cách — "đường phân cách và khoảng cách không diễn đạt cùng
  một ranh giới hai lần" — tức là một mệnh lệnh **cấm**, không phải một cách **chọn**. Một điều cấm
  không nói cho ai biết phải làm gì khi khoảng trống không dùng được nữa.
- **Đứng trên nhóm `principles/`.** Cùng chỗ với khoảng cách, khoảng đệm trong, vị trí, màu sắc và
  bề mặt-in-bề mặt: đây là những nguyên tắc dựng hình bắt buộc, không phải cảm nhận và không phải
  ngoại lệ vận hành.
- **Đặt mã tình huống.** Bảy mã: `DIVIDER-0` … `DIVIDER-6`. Mã đặt tên cho **tình huống**, class CSS đặt
  tên cho **đường kẻ**; hai thứ không phải một, và hai trong bảy mã không phát class CSS nào.
- **Số mã là thứ tự gặp, không phải thang.** `0` là sự vắng mặt, và nó đứng đầu vì nó là câu trả lời
  của đa số các bố cục kết hợp. `1`–`3` xếp theo **số lần đường kẻ lặp lại**: nhiều đường bên trong một
  tập, một cạnh dưới một dải, một khoảng cách giữa các phần tử giữa hai vùng. `4` là ranh giới **không ngăn cách**. `5` là
  `1` đem sang trục thứ hai. `6` là đường kẻ không phải cạnh của ai. Không có gì nằm giữa hai mã để
  mà chia đôi, và không mã nào "lớn hơn" mã nào.
- **Đưa quyền sở hữu vào định nghĩa mã.** Mỗi mã nói rõ **phần tử nào** mang class CSS. Đây là điểm khác
  biệt chính so với cách viết một bộ quy tắc đường phân cách thông thường: hai lỗi hay gặp nhất — `border-b` trên
  từng thành viên, và hai vế cùng khai cạnh đối diện — đều hiển thị ra "gần đúng" và chỉ bị bắt khi chủ
  sở hữu là một phần của luật.
- **Loại trừ nhau với khoảng cách, không cộng thêm.** Luật mở đầu bằng việc khoảng trống và đường kẻ là hai
  cách vẽ **cùng một** ranh giới. Vì vậy mặc định khi thiếu dữ kiện là `DIVIDER-0`, và gánh nặng
  chứng minh nằm ở bên muốn thêm đường kẻ.
- **Cố ý để lại cho mô-đun bên cạnh.** Đường **bao quanh** một đối tượng được phân loại tại đây
  (`DIVIDER-4`) rồi chuyển sang luật quan hệ nhóm, vì nó phải được cân với hai lựa chọn mà mô-đun này
  không nhìn thấy: nâng thành một mặt riêng, hoặc để phẳng. Biến thiết kế màu của đường kẻ thuộc luật màu sắc.
  Khoảng cách từ nội dung tới đường kẻ thuộc luật khoảng đệm trong. Khoảng trống giữa các phần tử cùng cấp thuộc luật
  khoảng cách. Bo góc và việc cắt nội dung ở góc thuộc mặt chứa, mô-đun này chỉ nêu **hệ quả** rằng đường kẻ
  sẽ chạy quá góc nếu không cắt.
- **Không nhận những đường kẻ mang nghĩa khác.** Thanh tiến độ, gạch chân đánh dấu thẻ tab đang chọn,
  gạch ngang giá cũ, trục biểu đồ — chúng trông giống đường phân cách và không phải đường phân cách. Chúng được đặt
  tên bởi thứ mang cái nghĩa đó, và ngoại lệ này được viết ra để nó khỏi bị dùng làm cửa thoát.
- **Năm tài liệu, không có `prompt.md`.** Ánh xạ yêu cầu và bảng phân định ranh giới nằm cùng chỗ với
  ví dụ mà chúng phân định.
