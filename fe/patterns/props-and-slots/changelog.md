---
id: fe-patterns-props-and-slots-changelog
title: changelog.md
slug: /fe/patterns/props-and-slots/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật props-and-slots.
---

# changelog.md

> Current version: `2.00` · Module: `props-and-slots`

## Version Policy

Một thay đổi luật được chấp nhận thì tăng cả module thêm `0.01` và cập nhật **năm** record. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc module hoặc shelf mà nó nằm trên.

Mã `SLOTS-<n>` **không** đổi số theo phiên bản. Mã được trích dẫn từ ngoài module — từ luật khác, từ
skill, từ hồ sơ task đã đóng — nên đánh số lại một mã là làm hỏng một trích dẫn đã có người viết ra.
Mã bị rút thì để trống chỗ của nó.

## 2.00 — 2026-08-16

Đổi số chính vì hai thứ đổi cùng lúc: shelf và hình dạng module.

- **Chuyển shelf.** Một file luật phẳng ở `fe/canon/patterns/props-and-slots.md` trở thành module năm
  record ở `fe/patterns/props-and-slots/`. Luật gốc **không bị xoá và không bị sửa**; module này là
  bản diễn đạt đầy đủ hơn của cùng một luật, không phải một luật mới.
- **Giữ nguyên bảy mã.** `SLOTS-1` … `SLOTS-7`, nguyên số và nguyên nghĩa, kể cả những chỗ audit
  không đồng ý. Bản brief chuyển đổi nói có tám mã; canon, rule và twin test đều chỉ công bố bảy, và
  không mã nào được bịa thêm cho khớp con số. Ghi ở `audit.md`.
- **Thêm bảng `Tầng giữ`.** Mỗi mã ghi rõ thứ đang **thật sự** giữ nó: `unrepresentable` khi một
  union đóng hoặc một alias-là-toàn-bộ-hình-dạng làm giá trị sai không viết ra được, `enforced` khi
  một rule có tên trong `sources/fe/props-and-slots.mjs` báo lỗi, `documented` khi chỉ người đọc giữ.
  Kết quả: bốn mã do kiểu giữ, ba mã do lint giữ, một mã (`SLOTS-5`) không có gì cơ học giữ. Bảng có
  thêm cột "còn escape gì", vì một mã được giữ **một phần** mà ghi là được giữ thì sai hơn là ghi
  không được giữ.
- **Thêm bảng `Anchor`.** Mỗi mã trỏ vào code thật kiểm chứng được: `sources/fe/props.ts` cho các
  hàng rào kiểu, `sources/fe/props-and-slots.mjs` và twin test của nó cho ba rule. `SLOTS-5` chỉ neo
  được nửa "không nhận cờ"; nửa "không tự quyết cờ" ghi thẳng là `chưa neo được` và nằm trong "Rủi ro
  còn mở".
- **Viết lại `vi.md` theo từng mã.** Mỗi mã có tình huống nghiệp vụ, dấu hiệu nhận biết, câu tự hỏi,
  ranh giới với mã kề, và danh sách tình huống hay gặp.
- **Viết lại `example.md` cho đủ case.** Mỗi mã nhiều case, từng case đặt ĐÚNG cạnh SAI, kèm mục ngoại
  lệ và nhầm lẫn; cuối trang là ánh xạ yêu cầu, bảng phân định ranh giới và danh sách sai lầm lặp
  lại.
- **Tổng quát hoá mọi tên component riêng.** Ví dụ ở shelf này phải đọc được ở bất kỳ front end nào,
  nên component nội bộ được đổi thành tên mô tả. Chỗ này có giá: rule của `SLOTS-7` bind theo đúng
  một import path, nên luật phát biểu tổng quát trong khi enforcement thì hẹp — ghi ở `audit.md`.
- **Ghi lại độ lệch giữa luật và rule.** Bảng "Forbidden" của luật gốc miễn **ba** shell; rule đang
  chạy miễn **bốn**, thêm chỗ nối route. Module giữ chữ của luật gốc và ghi độ lệch vào Findings thay
  vì âm thầm sửa một trong hai bên.
- **Không có `prompt.md`.** Ánh xạ yêu cầu nằm cùng chỗ với ví dụ mà nó phân định. Module còn đúng
  năm record.

## Các phiên bản trước

`1.x` là file luật phẳng: định nghĩa, bảy quy tắc, bảng "Forbidden" và năm ví dụ đối chiếu. Nội dung
đó được bảo toàn quyết định và diễn đạt lại ở `2.00`; bản gốc vẫn nằm tại
`fe/canon/patterns/props-and-slots.md`.
