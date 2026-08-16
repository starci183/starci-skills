---
id: be-patterns-cqrs-changelog
title: changelog.md
slug: /be/patterns/cqrs/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật CQRS.
---

# changelog.md

> Current version: `2.00` · Module: `cqrs`

## Version Policy

Một thay đổi luật được chấp nhận thì tăng cả module thêm `0.01` và cập nhật **năm** record. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc module hoặc shelf mà nó nằm trên.

Mã tình huống **không bao giờ được đánh số lại**. Mã được trích dẫn từ các file luật khác và từ task
record đã đóng; đổi số một mã là làm hỏng trong im lặng một trích dẫn đã có người viết ra. Mã bị bỏ
thì ghi là bị bỏ, và số của nó không được dùng lại.

## 2.00 — 2026-08-16

Đổi số chính vì hai thứ đổi cùng lúc: shelf và hình dạng module.

- **Chuyển shelf.** `be/canon/patterns/cqrs.md` (một file phẳng) → `be/patterns/cqrs/` (module năm
  record). `id` và `slug` đổi theo: `be-patterns-cqrs-<record>` và `/be/patterns/cqrs`.
- **Giữ nguyên bảy mã.** `CQRS-1` … `CQRS-7` giữ nguyên số và nguyên nghĩa của bản phẳng. Không thêm
  mã, không bỏ mã, không đánh số lại. Module vào với bảy mã và ra với bảy mã.
- **Thêm bảng `Tầng giữ`.** Mỗi mã nói rõ nó đang được giữ ở tầng nào: `unrepresentable` khi giá trị
  sai không viết được, `enforced` khi có một rule **gọi tên được** trong `sources/be/cqrs.mjs` bắt
  nó, `documented` khi không có gì cơ học giữ và chỉ người đọc giữ. Kết quả: `CQRS-2`, `CQRS-3`,
  `CQRS-7` là `enforced`; `CQRS-1`, `CQRS-4`, `CQRS-5`, `CQRS-6` là `documented`. Bốn dòng
  `documented` được viết ra đúng như hiện trạng — khoảng trống ấy chính là **mục đích** của bảng,
  không phải một thất bại của nó.
- **Thêm bảng `Anchor`.** Mỗi mã trỏ vào một file thật và nói rõ phải nhìn cái gì ở đó. Luật không
  chỉ được vào code thật là đề xuất, không phải luật. Cả bảy mã đều neo được; không mã nào phải ghi
  `chưa neo được`.
- **Tách ngoại lệ thành một tập đóng.** Handler trừu tượng trung gian (`CQRS-3`), `.command.ts` có
  decorator là cửa CLI chứ không phải message (`CQRS-2`), thư mục con chứa type transport
  (`CQRS-1`), chính sách nợ khi mới bật rule, và luật chỉ đếm report của chính rule đang đo. Bốn thứ
  đầu vốn nằm rải trong comment của file lint; nay chúng là một phần của luật, ở chỗ người đọc luật
  nhìn thấy.
- **Viết `vi.md` theo từng mã.** Mỗi mã có tình huống nghiệp vụ, dấu hiệu nhận biết, câu tự hỏi, ranh
  giới với các mã kề, và danh sách tình huống hay gặp.
- **Viết lại `example.md` cho đủ case.** Mỗi mã nhiều case, mỗi case đặt ĐÚNG cạnh SAI, kèm mục ngoại
  lệ và mục "trông giống nhưng không phải mã này". Thêm bảng ánh xạ yêu cầu sang vị trí file, bảng
  phân định ranh giới, và danh sách sai lầm lặp lại nhiều nhất.
- **Rút mọi ví dụ về TypeScript trung tính.** Bỏ hết tên miền riêng của một sản phẩm cụ thể; ví dụ
  dùng giỏ hàng, đơn hàng, hoá đơn, gói thuê bao — những hình dáng bất kỳ backend nào cũng có. Path
  repository chỉ còn xuất hiện trong bảng Anchor, nơi chúng là bằng chứng chứ không phải minh hoạ.
- **Ghi mâu thuẫn thay vì sửa lén.** Cách đọc chặt của `CQRS-1` (mọi file trong thư mục mang tên thao
  tác) không khớp với thư mục con chứa type transport trong source tham chiếu. Luật giữ nguyên, mâu
  thuẫn nằm ở `audit.md` mục "Rủi ro còn mở".
- **Năm record, không có `prompt.md`.** Ánh xạ yêu cầu nay nằm cùng chỗ với ví dụ mà nó phân định.

## Các phiên bản trước

`1.xx` là file phẳng `be/canon/patterns/cqrs.md`: định nghĩa, bảy rule, bảng Forbidden và bốn ví dụ
"cái bẫy" (template, service béo, thất bại, event). Toàn bộ quyết định của bản phẳng được giữ lại
trong `2.00`; những gì thay đổi là **cách trình bày và mức chứng minh**, không phải nội dung luật.
