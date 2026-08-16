---
id: fe-lints-translation-changelog
title: changelog.md
slug: /gates/lints/translation/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của hồ sơ thực thi luật chữ nghĩa.
---

# changelog.md

> Phiên bản hiện tại: `2.00`

Mô-đun: `translation`. Hai luật máy được ghi ở đây ship trong gói `@starci/eslint-canon-fe`, dưới
tiền tố `starci-fe/`.

## Quy ước phiên bản

Một thay đổi được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu:
`INDEX.md`, `vi.md`, `example.md`, `audit.md`, `changelog.md`. Đổi số chính (`x.00`) dành cho thay
đổi cấu trúc mô-đun hoặc nhóm mà nó nằm trên.

Ở kệ này, "thay đổi" gồm cả những thứ không đổi một dòng luật nào: phát hiện thêm một cửa còn mở, đóng
được một cửa cũ, hay sửa một câu mô tả cơ chế phát hiện cho đúng với tệp nguồn. Danh tính của một luật
máy là **tên đã công bố** của nó; đổi tên là một thay đổi phá vỡ, vì tên đó nằm trong log build và
trong mọi dòng tắt luật đã viết.

## 2.00 — 2026-08-16

Dựng mới. Mô-đun này ra đời để ghi **phần thực thi** của luật chữ nghĩa: không phải luật nói gì, mà
máy nhìn thấy được đến đâu — và, phần không ai chịu viết ra, máy **không** nhìn thấy gì.

- **Ghi hai luật máy**, đúng bằng số luật mà tệp nguồn công bố:
  - `no-copy-resolution-below-block`, giữ mã `COPY-1`;
  - `no-hardcoded-copy-in-vocabulary`, giữ mã `COPY-2`.
- **Danh tính là tên, không phải số.** Đề mục trong cả năm tài liệu là tên đã công bố, giữ nguyên
  từng ký tự, kể cả khi tên chứa một từ riêng của sản phẩm. Không mã số nào được bịa thêm.
- **Ghi cơ chế phát hiện thay vì mô tả ý định.** Cổng thư mục chạy trong `create` và chuẩn hoá dấu
  gạch ngược; luật thứ nhất khớp `callee.name` của `CallExpression`; luật thứ hai đọc `JSXAttribute`
  qua `attributeText` và `JSXText` sau khi trim, cả hai đi qua một phép thử "có dấu cách và mở đầu
  bằng chữ hoa ASCII".
- **Hai bảng cửa lách.** Bảng **Đã đóng** gồm bảy lối viết trông như lách được mà không lách được.
  Bảng **Còn mở** gồm **mười lăm** lối viết mà luật thật sự không bắt: ba cửa riêng của luật thứ
  nhất, mười cửa riêng của luật thứ hai, và hai cửa nằm ở cổng thư mục nên tính cho cả hai — tức năm
  cửa mở trên luật thứ nhất và mười hai trên luật thứ hai.
- **Ghi bốn mã luật chưa có luật máy** — `COPY-3`, `COPY-4`, `COPY-6` là luật chưa được giữ;
  `COPY-5` được thoả bằng cấu trúc thư mục chứ không bằng một phép kiểm. Không mã nào bị gán bừa cho
  một luật máy để bảng trông đầy.
- **Ghi hai chỗ tên luật rộng hơn hành vi thật.** "Below block" thực tế là bốn tên thư mục; và luật
  ấy còn bắt cả `useLocale` với `useFormatter`, vốn tra cách trình bày chứ không tra một câu.
- **Ghi hai lỗ đắt nhất** để lần sau không phải tìm lại: hình dạng túi prop
  `props={{ placeholder: "…" }}` không sinh báo cáo nào, và phép thử chữ hoa chỉ biết bảng chữ ASCII
  nên chữ đã dịch vẫn xanh.
- **`audit.md` nêu giá đóng cửa cho từng lỗ**, kèm kết luận đáng hay chưa đáng, để lần bàn sau bắt đầu
  từ một con số chứ không từ cảm tính.
- **Năm tài liệu, không có `prompt.md`.** Phần ánh xạ yêu cầu và bảng phân định ranh giới nằm trong
  `example.md`, cạnh chính những ví dụ mà chúng phân định.
