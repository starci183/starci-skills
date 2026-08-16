---
id: fe-lints-lint-escape-hatch-changelog
title: changelog.md
slug: /fe/lints/lint-escape-hatch/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của hồ sơ thi hành luật cấm tự tắt lint.
---

# changelog.md

> Phiên bản hiện tại: `2.00` · Mô-đun: `lint-escape-hatch`

## Quy ước phiên bản

Một thay đổi được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Đổi số chính
(`x.00`) dành cho thay đổi cấu trúc mô-đun hoặc nhóm mà nó nằm trên.

Ba loại thay đổi bắt buộc phải tăng phiên bản, vì cả ba đều đổi câu trả lời cho câu hỏi "cái máy giữ
được tới đâu":

- Bộ rule công bố thêm, bớt hoặc đổi tên một rule.
- Cách phát hiện đổi — mẫu, cổng đường dẫn, điểm móc, nguồn dữ liệu.
- Một cửa đổi phân loại: từ **còn mở** sang **đã khép**, hoặc ngược lại.

Tên rule **không bao giờ được viết lại** trong tài liệu, kể cả khi nó chứa một từ thuộc về sản phẩm.
Tên đã công bố là chuỗi hiện ra trong bản dựng và trong mọi cuộc trao đổi về lần đỏ ấy; đổi cách viết
ở đây là tạo ra một rule hai tên.

## 2.00 — 2026-08-16

Lập mô-đun. Đây là tài liệu đầu tiên ghi lại **phần thi hành** của luật cấm tự tắt lint, tách hẳn khỏi
tài liệu ghi **nội dung luật**. Nhóm `principles` và `patterns` nói luật là gì; nhóm này nói cái máy
nhìn thấy gì của luật đó, và — phần gần như không ai chịu viết ra — nó không nhìn thấy gì.

- **Phủ đúng một rule:** `no-inline-lint-config`. Bộ rule công bố đúng một rule, khớp con số dự kiến.
  Các export còn lại không phải rule và không được đếm: một bí danh của chính rule ấy, một bảng mức độ
  và một mẩu cấu hình phẳng.
- **Ánh xạ sang mã luật.** Một rule ánh xạ trọn vào `LINT-ESCAPE-1`. `LINT-ESCAPE-2` chỉ được giữ một
  nửa — rule báo cáo, `linterOptions.noInlineConfig` mới vô hiệu hoá — nên nửa còn lại là cấu hình chứ
  không phải rule. `LINT-ESCAPE-3` **không có rule nào**; điều đó được ghi thẳng thành phát hiện, thay
  vì bịa ra một ánh xạ cho đủ bảng.
- **Ghi 9 cửa đã khép và 9 cửa còn mở.** Những chỗ còn lọt lớn nhất: chú thích cấu hình trần dạng
  `/* eslint some-rule: "off" */` không hề bị bắt, dù tên rule hứa nhiều hơn thế; và một miễn trừ viết
  trong cấu hình phẳng đạt đúng thứ `LINT-ESCAPE-3` cấm mà không có gì đi soi.
- **Ghi nhận một chênh lệch tên–hành vi.** Tên rule rộng hơn phần rule thật sự bắt. Ghi ở
  `audit.md` mục `Findings`, kèm cách khép và giá phải trả.
- **Ghi nhận một lần bắt hụt có chủ ý.** Mẫu neo ở đầu thân chú thích, nên một câu văn nhắc tới
  directive thì không bị báo. Đây là đường biên đúng của thứ đang được thi hành, không phải lỗ hổng —
  và là lựa chọn đã trả giá một lần bằng việc câu giải thích bị báo là vi phạm.
- **Đặt danh tính rule là tên đã công bố.** Không gán mã số riêng cho rule.
- **Năm tài liệu, không có `prompt.md`.** Phần ánh xạ yêu cầu và bảng phân định ranh giới nằm cùng chỗ
  với ví dụ mà chúng phân định.

Bộ rule được ghi ở đây xuất xưởng trong gói `@starci/eslint-canon-fe`.
