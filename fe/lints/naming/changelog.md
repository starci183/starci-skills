---
id: fe-lints-naming-changelog
title: changelog.md
slug: /fe/lints/naming/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của kệ enforcement cho luật đặt tên.
---

# changelog.md

> Current version: `2.00` · Module: `naming`

## Version Policy

Một thay đổi được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Đổi số chính
(`x.00`) dành cho việc tạo mô-đun hoặc thay đổi hình dạng của nó.

Ở kệ này, "một thay đổi" gồm cả ba loại sau, và loại thứ ba dễ bị bỏ quên nhất:

1. Tệp nguồn thêm, bớt hoặc đổi tên một quy tắc.
2. Một quy tắc đổi cái nó nhìn — thêm một loại nút, đổi một biểu thức chính quy, nối thêm một phần tử
   vào danh sách chặn.
3. **Một cửa còn mở được phát hiện hoặc được đóng lại.** Bảng cửa còn mở là nội dung chính của kệ này,
   không phải phần chú thích, nên nó đổi thì phiên bản đổi.

Số phiên bản của kệ enforcement **không** buộc phải bằng số phiên bản của tài liệu luật mà nó giữ.
Luật đứng yên trong khi quy tắc siết chặt là chuyện bình thường, và ngược lại cũng vậy.

## 2.00 — 2026-08-16

Tạo mô-đun. Kệ `principles` và `patterns` ghi **luật**; kệ này ghi **việc thi hành**: máy nhìn thấy
được đến đâu, và — phần không ai chịu viết ra — máy **không** nhìn thấy chỗ nào.

- **Phủ đúng ba quy tắc đang được công bố** trong gói `@starci/eslint-canon-fe`:
  `prefer-arrow-export` giữ `NAMING-1`, `handler-on-prefix` giữ `NAMING-2`,
  `no-second-language-in-path` giữ `NAMING-3`. Ba quy tắc, ba mã, ánh xạ một-một, không quy tắc nào
  không có mã và không mã nào không có quy tắc.
- **Lấy tên công bố làm danh tính.** Không đặt mã số cho quy tắc. Cái tên đã là chuỗi hiện trong log
  build, trong dòng chú thích tắt quy tắc và trong mọi cuộc trao đổi về lỗi; đặt thêm một mã số nữa là
  tạo ra một quy tắc có hai tên và không ai biết thông báo đến từ tên nào. Tiêu đề mỗi mục là tên quy
  tắc, chép nguyên văn.
- **Ghi bảng `Detection` theo nút thật.** Mỗi quy tắc được ghi bằng đúng loại nút nó thăm, đúng điều
  kiện nó lọc và đúng chỗ nó báo — chứ không bằng ý định của nó. Đây là mục làm cho bảng kế tiếp có
  thể viết được.
- **Ghi hai bảng cửa: `Closed` và `Open`.** Bảng `Closed` liệt kê những cách viết trông như sẽ lọt mà
  không lọt. Bảng `Open` liệt kê **mười chín** cách viết thật sự lọt: bốn ở `prefer-arrow-export`, tám
  ở `handler-on-prefix`, bảy ở `no-second-language-in-path`. Không dòng nào ghi "không có" cho gọn
  bảng.
- **Nói thẳng chỗ hành vi hẹp hơn cái tên.** `prefer-arrow-export` cấm **dạng khai báo**, nó không đòi
  **arrow**: `const X = function () {}` thoả quy tắc và không thoả luật.
- **Ghi hai chỗ bắt nhầm** thay vì giả vờ không có: danh từ nghiệp vụ `handle`, và việc quét cả đường
  dẫn tuyệt đối nằm ngoài kho mã.
- **Ghi hai nghĩa vụ của luật chưa có quy tắc nào giữ** — dạng arrow một cách cụ thể, và lệnh cấm một
  cái tên nói nó được dùng ở đâu — vào `audit.md` mục rủi ro, **không** ánh xạ chúng thành quy tắc.
  Một quy tắc không chỉ tay vào được là một đề xuất, không phải một quy tắc.
- **Ghi nhận chú thích đầu tệp nguồn đã lạc hậu**: nó mô tả một tệp hai quy tắc trong khi tệp công bố
  ba. Kệ này tin theo tệp.
- **Năm tài liệu, không có `prompt.md`.** Phần ánh xạ yêu cầu và bảng phân định ranh giới nằm cùng chỗ
  với ví dụ mà chúng phân định.
