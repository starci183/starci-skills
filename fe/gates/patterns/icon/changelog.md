---
id: fe-patterns-icon-changelog
title: changelog.md
slug: /gates/patterns/icon/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật Icon.
---

# changelog.md

> Current version: `2.01` · Module: `icon`

## Version Policy

Một thay đổi luật được chấp nhận thì tăng cả module thêm `0.01` và cập nhật **năm** record. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc module hoặc shelf mà nó nằm trên.

Mã tình huống **không bao giờ được đánh số lại và không bao giờ bị xoá**. Mã được trích dẫn từ những
file luật khác và từ các bản ghi công việc cũ; đổi số một mã là bẻ gãy im lặng một trích dẫn đã có.
Một mã bị cho là sai thì vẫn bảo toàn và được tranh luận trong [`audit.md`](./audit.md).

## 2.01 — 2026-08-21

- Đóng cửa import upstream trong source: chỉ `@starci/heroicons/24/outline` và
  `@starci/heroicons/16/solid` được phép vào icon leaf.
- Ghi quy trình mở rộng khi upstream thiếu đúng nghĩa: nghĩa ổn định, đủ hai cut, `currentColor`,
  hình học Heroicons, ánh xạ semantic một lần tại icon leaf.
- Neo luật vào package thật `packages/heroicons` và grammar case `product-glyph-extension`.

## 2.00 — 2026-08-16

Đổi số chính vì hình dạng của luật đổi: từ **một file phẳng** thành **một module năm record**.

- **Chuyển hình dạng.** `fe/canon/patterns/icon.md` (một file, 13 luật viết liền) → `gates/patterns/icon/`
  với `INDEX.md`, `vi.md`, `example.md`, `audit.md`, `changelog.md`. File luật phẳng **không bị xoá và
  không bị sửa**; nó vẫn giữ bảng vận hành 42 dòng ý nghĩa → hình.
- **Giữ nguyên 13 mã.** `ICON-1` … `ICON-13`, đúng số hiệu và đúng nghĩa của file luật phẳng. Không thêm mã
  mới, không gộp, không tách. Mọi quyết định thật của luật cũ được mang sang: ba vai trò, hai family,
  một vendor, `currentColor`, `shrink-0`, bảng nguồn sở hữu việc chọn hình, và hai ngoại lệ artwork
  (reaction, giải thưởng).
- **Thêm bảng `Tầng giữ`.** Mỗi mã ghi rõ nó đang được **cái gì** giữ: `unrepresentable` (union đóng
  hoặc prop shape làm giá trị sai không viết ra được), `enforced` (có rule trong `sources/fe/icon.mjs`,
  **gọi đúng tên rule**), hay `documented` (chỉ có người đọc giữ). Kết quả đo được: **1 unrepresentable,
  3 enforced, 9 documented**. Khoảng hở đó là nội dung của bảng, không phải một thất bại của bảng.
- **Thêm bảng `Anchor`.** Mỗi mã trỏ vào một đường dẫn code thật và làm rõ **nhìn cái gì ở đó** —
  union vai trò, map role → class, hai block import tách riêng, file brand giữ màu gốc, leaf plate
  truyền `leading`, composite metric không có glyph, thư mục artwork reaction kèm attribution. Luật
  không trỏ được vào code thật thì chỉ là một đề xuất.
- **Ghi lại hai khoảng trống của tầng giữ.** Rule `no-off-scale-glyph-size` giữ **phần dư** của
  `ICON-1` chứ không giữ trọn một mã; rule `rank-artwork-is-a-closed-set` giữ một ngoại lệ có tên của
  `ICON-7` và **không mang mã nào** trong luật này. Comment trong file rule chú thích nó là `ICON-11`,
  vốn là mã của glyph trên plate — va chạm số hiệu được **ghi lại** trong `audit.md`, không được sửa
  bằng cách đánh số lại.
- **Viết lại `vi.md` theo từng mã.** Mỗi mã có tình huống nghiệp vụ, dấu hiệu nhận biết, câu tự hỏi,
  ranh giới với các mã kề, và danh sách tình huống hay gặp.
- **Viết lại `example.md` cho đủ case.** Mỗi mã nhiều case, từng case đặt **ĐÚNG** cạnh **SAI**, kèm
  mục ngoại lệ và mục "trông giống nhưng không phải mã này"; cuối trang là ánh xạ yêu cầu → quyết
  định, bảng phân định ranh giới và danh sách sai lầm lặp lại.
- **Rút mọi ví dụ về TSX thường.** Bỏ tên sản phẩm, tên repository và tên component library. Vendor
  glyph vẫn được gọi tên, vì lựa chọn vendor đóng **chính là** nội dung của `ICON-7`.
- **Không chép bảng ý nghĩa 42 dòng.** `ICON-9` trỏ về bảng nguồn trong source thay vì mang thêm bản
  sao thứ ba: một bảng vận hành bị nhân đôi sẽ trôi, và bảng đó gọi tên tính năng của một sản phẩm cụ
  thể nên đứng sai shelf. Mất mát so với file luật phẳng được nhận trong `audit.md`.
- **Không có `prompt.md`.** Ánh xạ yêu cầu và bảng phân định nằm trong `example.md`, cùng chỗ với ví
  dụ mà chúng phân định. Module có đúng năm record.

## Các phiên bản trước

Bản phẳng dựng 13 luật, bảng vận hành ý nghĩa → hình, bảng cấm và bốn cặp ví dụ. Toàn bộ nội dung đó
được mang sang bản `2.00` này trừ bảng 42 dòng, và file gốc vẫn còn nguyên tại chỗ cũ.
