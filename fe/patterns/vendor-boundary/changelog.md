---
id: fe-patterns-vendor-boundary-changelog
title: changelog.md
slug: /fe/patterns/vendor-boundary/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật vendor boundary.
---

# changelog.md

> Current version: `2.00` · Module: `vendor-boundary`

## Version Policy

Một thay đổi luật được chấp nhận thì tăng cả module thêm `0.01` và cập nhật **năm** record. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc module hoặc shelf mà nó nằm trên.

Thêm một mã, bỏ một mã, hoặc đổi danh sách chủ sở hữu đóng đều là thay đổi luật. **Đánh số lại một mã
đã có thì không bao giờ được phép**: các mã `VENDOR-<n>` được trích dẫn từ file luật khác và từ record
công việc cũ, nên một lần đánh số lại lặng lẽ sẽ làm hỏng một trích dẫn ai đó đã viết.

## 2.00 — 2026-08-16

Đổi số chính vì hình dạng module đổi: từ **một file luật phẳng** thành **module năm record**.

- **Chuyển shelf và tách record.** `fe/canon/patterns/vendor-boundary.md` → `fe/patterns/vendor-boundary/`
  với `INDEX.md`, `vi.md`, `example.md`, `audit.md`, `changelog.md`. File luật phẳng cũ được giữ
  nguyên tại chỗ; module này **tái diễn đạt** nó đầy đủ hơn, không thay nó bằng một luật mới.
- **Giữ nguyên mười bốn mã.** `VENDOR-1` … `VENDOR-14`, nguyên số và nguyên nghĩa. Không thêm mã,
  không bớt mã, không đánh số lại. Mọi bất đồng được ghi vào `audit.md` thay vì sửa âm thầm.
- **Thêm bảng `Tầng giữ`.** Mỗi mã khai báo tầng thật đang giữ nó: `unrepresentable`, `enforced` (kèm
  **tên rule** trong `sources/fe/vendor-boundary.mjs`), hay `documented`. Kết quả: **mười** mã
  `enforced`, **bốn** mã `documented`. Bảng này tồn tại để khoảng hở có vị trí công khai — một luật
  không làm rõ ai giữ nó thì dễ bị hiểu như thể máy đang giữ.
- **Hạ hai mã xuống `documented` một cách có chủ ý.** `VENDOR-7` và `VENDOR-9` **có** rule, nhưng cả
  hai scope vào `src/components/leaves/Field/index.tsx`, một đường dẫn cây không có; chúng return sớm
  cho mọi file và không bao giờ chạy. Một rule không bao giờ chạy không giữ gì cả. Gọi chúng là
  `enforced` sẽ là dòng sai duy nhất đủ sức làm cả bảng vô dụng.
- **Thêm bảng `Anchor`.** Mỗi mã trỏ vào code thật kiểm được: một đường dẫn, và thứ phải tìm ở đó.
  Mười hai mã neo thẳng; hai mã (`VENDOR-7`, `VENDOR-9`) được đánh dấu **neo lệch** — luật neo được
  vào code thật, nhưng rule đang canh chỗ khác. Không mã nào bị bỏ trống neo.
- **Carry con số bốn shell, kèm khai báo bất đồng.** Văn bản luật cũ nói `shells/` đóng ở **ba**;
  rule đang chạy và cây thật đều có **bốn** (`RouteShell`, framework shell, không import vendor).
  Module carry bốn vì tuyên bố ba sẽ khiến luật sai ngay lần đọc đầu tiên, và ghi chênh lệch này
  thành một finding đang mở trong `audit.md`.
- **Ghi ba tên đã trôi khỏi cây.** `SurfaceAccordionCard`, `leaves/Field` (nay là `composites/Field`)
  và `QuickActionRow` (cây có `QuickActionsList`) vẫn nằm trong luật và trong regex của rule nhưng
  không tồn tại trong cây thật. Tên được bảo toàn; drift được ghi thành finding, không sửa ở đây.
- **Viết `vi.md` theo từng mã.** Mỗi mã có tình huống nghiệp vụ, dấu hiệu nhận biết, một câu tự hỏi,
  ranh giới với các mã kề, và danh sách tình huống hay gặp. Phần `Luật` và `Ngoại lệ` đặt ở cuối, và
  mỗi ngoại lệ đều đóng, đều nêu rõ mã nó áp vào.
- **Viết `example.md` cho đủ case.** Mỗi mã nhiều case, từng case có ĐÚNG và SAI đặt cạnh nhau, cộng
  một mục **Ngoại lệ và nhầm lẫn**. Đóng trang bằng ánh xạ yêu-cầu-sang-phán-quyết, bảng phân định
  ranh giới, và danh sách sai lầm lặp lại.
- **Gộp `prompt.md` vào `example.md`.** Ánh xạ yêu cầu và bảng phân định nay nằm cùng chỗ với ví dụ
  mà chúng phân định. Module còn **năm** record.
- **Rút mọi tên riêng ra khỏi ví dụ.** Ví dụ dùng vendor thay thế `@vendor/ui` và `@vendor/glyphs`;
  không tên sản phẩm, không tên thư viện thật, không tên repository. Đường dẫn thật chỉ còn xuất hiện
  ở bảng `Anchor`, vì một pattern module nợ người đọc một chỗ để kiểm.

## Các phiên bản trước

Trước `2.00`, luật sống trong một file phẳng ở `fe/canon/patterns/`: một mục `Definition`, mười bốn
dòng `Rules` và hai khối `Examples`. File ấy đã quyết đúng mọi thứ mà module này carry — danh sách
chủ sở hữu đóng, ranh giới soi hai chiều, và mười bốn mã. Thứ nó không có là chỗ để nói **ai đang giữ
mã nào** và **kiểm mã ấy ở đâu**; hai bảng đó là lý do tồn tại của lần đổi số chính này.
