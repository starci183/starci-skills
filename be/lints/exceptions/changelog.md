---
id: be-lints-exceptions-changelog
title: changelog.md
slug: /be/lints/exceptions/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của tài liệu cưỡng chế luật ngoại lệ.
---

# changelog.md

> Current version: `2.00` · Mô-đun: `exceptions`

## Version Policy

Một thay đổi được chấp nhận thì tăng mô-đun thêm `0.01` và cập nhật **cả năm** tài liệu cùng lúc. Số
chính (`x.00`) dành cho việc dựng mới mô-đun hoặc đổi hình dạng của kệ tài liệu.

Ba việc bắt buộc phải tăng phiên bản:

1. Nguồn thêm, bớt hoặc đổi tên một quy tắc.
2. Hành vi thật của một quy tắc khác đi so với điều đã ghi ở đây.
3. **Phát hiện thêm một cửa còn mở** — kể cả khi không sửa gì trong quy tắc. Một khe hở đã biết mà
   không ghi ra là đúng thứ mà kệ tài liệu này tồn tại để ngăn: một luật không có quy tắc thì ai cũng
   biết là chưa được giữ, còn một quy tắc thủng thì mọi người tin là đã kín.

## 2.00 — 2026-08-16

Dựng mới. Mô-đun này ra đời để ghi lại **phần cưỡng chế** của luật ngoại lệ — thứ mà hai kệ
`principles` và `patterns` không ghi, vì chúng ghi luật chứ không ghi những gì một cái máy nhìn thấy
được.

**Bốn quy tắc được ghi lại**, đúng bằng số quy tắc nguồn công bố trong `rules` và trong `recommended`:

| Quy tắc | Mã luật |
|---|---|
| `throw-abstract-exception` | `EXCEPTION-1` |
| `require-exception-object-arg` | `EXCEPTION-2` |
| `exception-extends-abstract` | `EXCEPTION-3` |
| `exception-in-errors-folder` | `EXCEPTION-4` |

Bốn quy tắc này xuất xưởng trong gói `@starci/eslint-canon-be`, cả bốn ở mức `error` theo
`recommended`, cả bốn khai báo `schema: []` nên không nhận tuỳ chọn nào.

**Luật có sáu mã, phần cưỡng chế có bốn.** `EXCEPTION-5` (metadata mang thứ người đọc thất bại sẽ
cần) và `EXCEPTION-6` (một assertion của bộ chạy kiểm thử không phải một thất bại nghiệp vụ) không có
quy tắc nào giữ; `EXCEPTION-6` chỉ tồn tại dưới dạng một miễn trừ bên trong `EXCEPTION-1`. Cả hai
được ghi ở `audit.md` chứ không được bịa ra một ánh xạ cho đủ bảng.

**Mười lăm cửa còn mở** được liệt kê trong bảng **Open** của `INDEX.md`, và mỗi quy tắc có ít nhất
một dòng — không quy tắc nào được ghi là kín. Các nhóm lớn:

- Hình dạng cú pháp tại chỗ ném: ném một biến, ném qua `Promise.reject`, `callee` là member
  expression.
- Nhận diện bằng chuỗi: danh sách mười bảy tên framework, đổi tên khi import, hậu tố `/Exception$/`.
- Nhận diện bằng tên tệp: làn kiểm thử theo hậu tố, cổng probe theo đoạn thư mục, cổng thư mục ngoại
  lệ theo cách đánh vần.
- Nút không được thăm: `ClassExpression`, lớp cha là lời gọi hoặc member expression.

**Năm phát hiện** được ghi ở `audit.md`, trong đó ba phát hiện nói rằng hành vi thật lệch khỏi điều
tên quy tắc gợi ra: `throw-abstract-exception` là một danh sách chặn chứ không phải một phép kiểm
kế thừa; `require-exception-object-arg` đòi một object **literal** tại chỗ gọi nên báo nhầm khi
metadata nằm trong một biến; `exception-in-errors-folder` cưỡng chế cách đánh vần thư mục chứ không
cưỡng chế "một chỗ để tra".

**Quy ước ghi.** Danh tính của một quy tắc là **tên đã công bố**; không đặt mã số riêng, vì tên đó
mới là chuỗi in ra trong log build và trong dòng tắt cảnh báo. Lời văn và ví dụ không nêu tên sản
phẩm, công ty hay kho mã nào; định danh xuất xưởng — tên quy tắc, `messageId`, tên lớp trong danh
sách chặn — giữ nguyên chính tả.

**Năm tài liệu, không có `prompt.md`.** Phần ánh xạ yêu cầu và bảng phân định ranh giới nằm trong
`example.md`, cạnh chính những ví dụ mà chúng phân định.
