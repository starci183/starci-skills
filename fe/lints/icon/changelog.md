---
id: fe-lints-icon-changelog
title: changelog.md
slug: /fe/lints/icon/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của hồ sơ thực thi luật biểu tượng.
---

# changelog.md

> Current version: `2.00` · Mô-đun: `icon`

## Version Policy

Một thay đổi được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Đổi số chính
(`x.00`) dành cho thay đổi cấu trúc mô-đun hoặc kệ mà nó nằm trên.

Với kệ thực thi này, những thứ sau đều là thay đổi phải ghi:

- Một luật được thêm, bớt hoặc **đổi tên** trong bảng `rules` xuất ra. Đổi tên là thay đổi danh tính,
  vì tên chính là chuỗi in ra trong log build và chuỗi viết trong dòng tắt luật.
- Một cửa còn mở được đóng lại, hoặc một cửa mới bị phát hiện. Bảng **Open** và bảng **Closed** trong
  `INDEX.md` phải đổi cùng nhau.
- Một miễn trừ được thêm, hoặc mất vế giá trị và chỉ còn vế tệp.
- Ánh xạ giữa một luật và một mã trong văn bản luật thay đổi.

## 2.00 — 2026-08-16

Lập mô-đun. Đây là hồ sơ **thực thi** đầu tiên của luật biểu tượng: nó không chép lại luật, mà ghi
lại máy nhìn thấy gì và không nhìn thấy gì. Các luật được ghi ở đây đóng gói trong
`@starci/eslint-canon-fe`.

- **Ghi năm luật, đúng bằng số mà mô-đun luật công bố.** Đếm từ bảng `rules` xuất ra:
  `no-vendor-icon-outside-icon-leaf`, `heroicons-is-the-glyph-vendor`, `no-off-scale-glyph-size`,
  `no-decorative-icon-in-metric-cell`, `rank-artwork-is-a-closed-set`.
- **Danh tính là tên công bố.** Không đặt số cho luật nào. Tiêu đề mỗi mục là tên luật, nguyên văn.
- **Ánh xạ mã: bốn trên năm.** `ICON-6`, `ICON-7`, `ICON-1` (chỉ nửa về cỡ) và `ICON-10` khớp được.
  `rank-artwork-is-a-closed-set` thì không: mô-đun luật đề `ICON-11` cho nó, còn `ICON-11` trong văn
  bản luật nói về cỡ hình trong ô hình. Ghi thành phát hiện thay vì bịa ra một ánh xạ.
- **Bảng Detection viết theo nút cú pháp thật**, không viết theo tên luật: nút được duyệt, thuộc tính
  được đọc, mẫu được thử, và cổng tệp quyết định luật có được lắp hay không.
- **Bảng Escape Hatches tách làm hai.** Bảng **Closed** ghi mười cách viết trông như sẽ lọt mà không
  lọt. Bảng **Open** ghi **hai mươi** cửa còn mở thật, trải trên cả năm luật — không luật nào
  được ghi "không có".
- **Ghi ba khiếm khuyết mà tên luật không nói ra.** `no-off-scale-glyph-size` không có ngữ cảnh hình
  và bỏ lọt mọi cỡ nguyên lệch thang; tập định danh phản ứng được xuất ra mà không luật nào đọc; và
  một câu nhập sai từ tệp thường bị hai luật báo cùng lúc.
- **`example.md` viết bằng mã thật**, mỗi luật nhiều cặp SAI/ĐÚNG, và mỗi luật có một mục mang mã đi
  lọt — có dán nhãn rõ đó là chỗ luật **không nhìn thấy**, không phải cách viết được phép.
- **Năm tài liệu, không có `prompt.md`.** Phần ánh xạ yêu cầu và bảng phân định ranh giới nằm cuối
  `example.md`, cạnh chính những ví dụ mà chúng phân định.
