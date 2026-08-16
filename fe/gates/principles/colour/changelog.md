---
id: fe-principles-colour-changelog
title: changelog.md
slug: /gates/principles/colour/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật Màu sắc.
---

# changelog.md

> Phiên bản hiện tại: `2.00` · Mô-đun: `colour`

## Quy tắc phiên bản

Một thay đổi luật được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc mô-đun hoặc nhóm mà nó nằm trên.

## 2.00 — 2026-08-16

Đổi số chính vì hai thứ đổi cùng lúc: nhóm và hình dạng mô-đun.

- **Chuyển nhóm.** `fe/design/colour/` → `gates/principles/colour/`. Nhóm `design` bị tách làm ba:
  `principles/` giữ các nguyên tắc dựng hình bắt buộc, `senses/` giữ những gì người đọc cảm nhận,
  `governance/` giữ ngoại lệ và tính đồng nhất. Toàn bộ `id` và `slug` của năm tài liệu đổi theo nhóm mới;
  không còn tiền tố hay đường dẫn của nhóm cũ sót lại ở bất kỳ tài liệu nào.
- **Đặt mã tình huống.** Mỗi tình huống mang một mã `COLOUR-<index>`, từ `COLOUR-1` tới `COLOUR-15`.
  Số là **thứ tự người đọc gặp**, không phải một thang: mô-đun này không có thang số nào, nên giữa
  hai mã không có gì để chia đôi. Mã đặt tên cho **tình huống**, class CSS đặt tên cho **cách vẽ**.
- **Nâng ba ngoại lệ thành mã đóng.** Biểu đồ, tác phẩm đồ hoạ thương hiệu và chữ trên ảnh trước đây trôi
  trong mục ngoại lệ không tên; nay là `COLOUR-13`, `COLOUR-14`, `COLOUR-15`. Đặt tên cho một ngoại
  lệ không nới nó ra — đó là điều kiện để nói được rằng một lần dùng nó là sai.
- **Nâng luật thành bắt buộc.** Bổ sung tuyên bố rằng mọi phần tử hiển thị ra đều rơi vào đúng một mã,
  và không có phần tử nào nhỏ tới mức được miễn.
- **Phát biểu luật một phần tử một vai trò.** Bề mặt phát ra cặp nền-và-chữ rồi dừng; trạng thái,
  tương tác và trạng thái chọn thuộc về phần tử con. Các mã lồng vào nhau chứ không gộp lên một nút DOM.
- **Gộp `prompt.md` vào `example.md`.** Ánh xạ từ yêu cầu bằng lời sang class CSS và bảng phân định ranh
  giới nay nằm cùng chỗ với ví dụ mà chúng phân định. Mô-đun còn năm tài liệu; `prompt.md` bị xoá.
- **Viết lại `vi.md` theo từng mã.** Mỗi mã có tình huống nghiệp vụ, dấu hiệu nhận biết, câu tự hỏi,
  ranh giới với từng mã kề, và danh sách tình huống hay gặp.
- **Viết lại `example.md` cho đủ trường hợp.** Mỗi mã nhiều trường hợp, kèm mục "ngoại lệ và nhầm lẫn" nói rõ thứ
  gì trông giống mã này nhưng không phải, và thứ gì bị cấm. Thêm mục **mã lồng mã** để nhìn thấy được
  luật một phần tử một vai trò.
- **Bỏ mọi bản xem trước trực tiếp gắn với một sản phẩm.** Các khối bản xem trước hiển thị bằng thành phần riêng của một
  ứng dụng đã được gỡ khỏi `example.md`. Một luật ở nhóm này phải đúng với bất kỳ giao diện nào; ví
  dụ cần tên riêng của một sản phẩm mới đọc được là ví dụ đứng sai chỗ.
- **Giữ nguyên toàn bộ quyết định của `1.04`.** Bảng quyết định, tám điều kiện bất biến, ba ngoại lệ, mặc định
  an toàn `text-foreground`, quy tắc một câu hỏi khi mơ hồ và từ vựng bề mặt dùng chung đều được giữ
  y nguyên. Hai chỗ bản cũ tự mâu thuẫn đã được ghi vào "rủi ro còn mở" của `audit.md` thay vì bị sửa
  âm thầm.

## 1.04 — 2026-08-16

- Chuyển sang `design-canon-v2`.
- Thay đầu ra là thành phần của ứng dụng bằng quyết định `className` ngữ nghĩa tổng quát.
- Bỏ giả-đầu ra kiểu điểm dừng an toàn và mục quy trình đánh giá.
- Thêm mặc định an toàn cùng cách xử lý mơ hồ bằng đúng một câu hỏi.
- Lấy `text-foreground` làm mặc định cho nội dung đọc mới chưa có trạng thái.
- Viết lại ví dụ và phản biện quanh các vai trò màu có tính di động.
- Chuẩn hoá biến thiết kế bề mặt dùng chung: `background`, `card`, `muted`, `border`, `ring`.
- Hoàn thiện các trường hợp tiêu điểm, chủ đề và hạng mục dữ liệu với ranh giới className chính xác.

## 1.03 — 2026-08-16

- Dựng cấu trúc mô-đun sáu tài liệu và các tự kiểm tra thuần nghiệp vụ.

## 1.02 — 2026-08-16

- Công bố bảy ví dụ giao diện/Mã cho trạng thái, kiểm tra hợp lệ, trạng thái chọn, chủ đề và hạng mục dữ liệu.

## 1.01 — 2026-08-16

- Tách nguồn phẳng thành từng tài liệu và dựng nền tảng về vai trò, độ tương phản và chủ đề.
