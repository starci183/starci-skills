---
id: fe-lints-comments-changelog
title: changelog.md
slug: /fe/lints/comments/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của mô-đun thực thi luật comments.
---

# changelog.md

> Current version: `2.00` · Mô-đun: `comments`

## Version Policy

Một thay đổi được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Đổi số chính
(`x.00`) dành cho thay đổi cấu trúc mô-đun hoặc nhóm mà nó nằm trên.

Ba việc dưới đây đều là thay đổi phải tăng số, không phải sửa chữ:

- Tệp nguồn thêm, bỏ hoặc đổi tên một rule.
- Một cửa mở mới được tìm ra, hoặc một cửa đang mở được đóng lại.
- Ánh xạ giữa một rule và mã luật của nó thay đổi.

Tìm ra một cửa mở mới là **thay đổi nội dung**, vì nó đổi điều người đọc được phép tin về mức bảo vệ
hiện có — dù không một dòng mã nào của rule động tới.

## 2.00 — 2026-08-16

Dựng mô-đun. Đây là mô-đun đầu tiên trên nhánh `lints`, và nó tồn tại để tách bạch hai thứ vẫn hay bị
đọc lẫn: **luật** là tiêu chuẩn người đọc bị soi vào, **rule** là một phép so khớp chuỗi cộng một loại
nút cú pháp cộng một biểu thức đường dẫn. Hai thứ ấy không bao giờ bằng nhau, và khoảng cách giữa chúng
mới là nội dung của mô-đun này.

- **Ghi nhận ba rule**, đúng bằng số rule mà tệp nguồn publish:
  `require-export-jsdoc`, `no-second-language-in-source`, `no-emoji-in-source`. Chúng ship trong gói
  `@starci/eslint-canon-fe`, dưới tiền tố `starci-fe/`, và gói tự khai cả ba ở mức `error`.
- **Danh tính rule là tên đã publish.** Mô-đun không đặt thêm bất kỳ mã số nào. Cái tên đã là thứ hiện
  trong log build, trong dòng tắt rule và trong mọi cuộc trao đổi về một lỗi; đặt thêm mã số nghĩa là
  một rule có hai tên và không ai truy được thông báo lỗi đến từ tên nào.
- **Ánh xạ bốn mã luật, và bỏ trống hai.** `COMMENTS-1`, `COMMENTS-2`, `COMMENTS-3` (phần ngoại lệ) và
  `COMMENTS-4` có rule giữ. `COMMENTS-5` và `COMMENTS-6` **không có rule nào** và được ghi thẳng như
  vậy thay vì được gán bừa cho một rule gần đúng.
- **Bảng cơ chế phát hiện.** Mỗi rule được mô tả bằng nút cú pháp thật, tên trường thật và mẫu đường dẫn
  thật, để phần cửa mở phía sau có chỗ đứng.
- **Bảng cửa mở, 18 dòng.** Bốn cửa cho rule doc, chín cho rule ngôn ngữ, bốn cho rule emoji, cộng một
  dòng chung cho dòng tắt rule và phạm vi lint. Không rule nào được ghi là kín.
- **Bảng cửa đã đóng, 8 dòng**, cho những cách viết mà người đọc dễ tưởng là lọt: chuỗi thoát, chuỗi gom
  vào mảng hay object, câu văn dời xuống thành tên biến, mảnh template, chữ trong JSX, đường dẫn kiểu
  Windows, dấu miễn trừ đặt xa hai dòng, và tên file ngôn ngữ có mã vùng.
- **Mọi khẳng định về hành vi đều lấy bằng cách chạy thật.** Ba rule được nạp vào trình lint và thử trên
  các đoạn mã dựng riêng. Cách này lật lại được ít nhất hai điều mà đọc mã suy ra sẽ nói sai: tên file
  ngôn ngữ có mã vùng **vẫn** được miễn (mẫu đường dẫn không phân biệt hoa thường), còn chữ ở dạng tổ
  hợp thì **không** bị bắt.
- **Ghi nhận ba điểm lệch giữa tên rule và hành vi thật**, chi tiết ở `audit.md`: rule ngôn ngữ bắt dấu
  chứ không bắt ngôn ngữ; rule emoji bắt một thuộc tính Unicode nên vừa lọt chuỗi kiểu phím số vừa báo
  nhầm dấu bản quyền; rule doc chỉ đếm sự tồn tại của khối chú thích chứ không bao giờ đọc nó.
- **Ghi nhận một mâu thuẫn giữa luật và rule.** `COMMENTS-4` cấm ký tự tượng hình cả trong dữ liệu ngôn
  ngữ, trong khi cổng đường dẫn lại miễn đúng dữ liệu ngôn ngữ. Ghi vào `audit.md` như một việc phải xử
  ở tầng luật, không tự sửa ở tầng tài liệu.
- **Năm tài liệu, không có `prompt.md`.** Phần ánh xạ yêu cầu và bảng phân định ranh giới nằm cuối
  `example.md`, cạnh chính những ví dụ mà chúng phân định.
