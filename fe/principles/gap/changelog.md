---
id: fe-principles-gap-changelog
title: changelog.md
slug: /fe/principles/gap/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật Khoảng cách.
---

# changelog.md

> Phiên bản hiện tại: `2.00` · Mô-đun: `gap`

## Quy tắc phiên bản

Một thay đổi luật được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc mô-đun hoặc nhóm mà nó nằm trên.

## 2.00 — 2026-08-16

Đổi số chính vì hai thứ đổi cùng lúc: nhóm và hình dạng mô-đun.

- **Chuyển nhóm.** `fe/design/gap/` → `fe/principles/gap/`. Nhóm `design` bị tách làm ba:
  `principles/` giữ các nguyên tắc dựng hình bắt buộc, `senses/` giữ những gì người đọc cảm nhận,
  `governance/` giữ ngoại lệ và tính đồng nhất. Toàn bộ `id` và `slug` đổi theo.
- **Đặt mã tình huống.** Mỗi tình huống mang một mã `GAP-<rung>`: `GAP-0`, `GAP-1`, `GAP-2`, `GAP-3`,
  `GAP-4`, `GAP-6`, `GAP-8`. Mã đặt tên cho **tình huống**, class CSS đặt tên cho **khoảng cách**; hai
  thứ không phải một, và `GAP-0` không phát ra class CSS nào.
- **Nâng luật thành bắt buộc.** Bổ sung tuyên bố rằng mọi tập phần tử cùng cấp hiển thị ra đều rơi vào đúng một
  mã, và không có kích thước nào nhỏ tới mức được miễn.
- **Gộp `prompt.md` vào `example.md`.** Ánh xạ yêu cầu và bảng phân định ranh giới nay nằm cùng chỗ
  với ví dụ mà chúng phân định. Mô-đun còn năm tài liệu.
- **Viết lại `vi.md` theo từng mã.** Mỗi mã có tình huống nghiệp vụ, dấu hiệu nhận biết, câu tự hỏi,
  ranh giới với bậc kề, và danh sách tình huống hay gặp.
- **Viết lại `example.md` cho đủ trường hợp.** Mỗi mã nhiều trường hợp, kèm mục ngoại lệ và mục "trông giống
  nhưng không phải mã này". Thêm các ví dụ **mã lồng mã** để nói rõ luật *một phần tử cha một quan hệ*.
- **Rút mọi ví dụ về `className` thuần.** Bỏ hết bản xem trước trực tiếp hiển thị bằng thành phần của một sản phẩm
  cụ thể. Một luật ở nhóm này phải đúng với bất kỳ giao diện nào; ví dụ cần tên riêng của một sản
  phẩm mới đọc được là ví dụ đứng sai chỗ.

## 1.15 — 2026-08-16

- Làm bộ quy tắc tổng quát và `className`-đầu tiên.
- Bỏ tên kho đăng ký riêng và các diễn giải gắn với một phần triển khai.
- Rút luật về ba dữ kiện: immediate phần tử cha, trực tiếp các phần tử cùng cấp, một quan hệ đóng.
- Thay điểm dừng giả bằng một câu hỏi phân định cụ thể khi thiếu dữ kiện quyết định.
- Lấy bậc nhỏ hơn liền kề làm mặc định an toàn công khai.

## Các phiên bản trước

`1.01`–`1.14` dựng thang quan hệ, luật phân cấp, tính đồng nhất trạng thái và các phép thử ranh giới. Bằng
chứng gắn với một ứng dụng cụ thể đã được rút khỏi bộ quy tắc ở `1.15`.
