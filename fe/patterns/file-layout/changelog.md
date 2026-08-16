---
id: fe-patterns-file-layout-changelog
title: changelog.md
slug: /fe/patterns/file-layout/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật file layout.
---

# changelog.md

> Current version: `2.00` · Module: `file-layout`

## Version Policy

Một thay đổi luật được chấp nhận thì tăng cả module thêm `0.01` và cập nhật **năm** record. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc module hoặc shelf mà nó nằm trên.

Các mã `LAYOUT-<n>` **không** theo chính sách này: chúng là địa chỉ mà file luật khác và task record
cũ đã trích dẫn, nên một mã bảo toàn số và nguyên nghĩa qua mọi phiên bản. Một mã bị cho là sai thì
được **giữ lại và tranh luận** ở `audit.md`, không được đánh số lại và không được xoá.

## 2.00 — 2026-08-16

Đổi số chính vì hai thứ đổi cùng lúc: hình dạng module và shelf mà nó nằm trên.

- **Từ một file luật phẳng thành module năm record.** `fe/canon/patterns/file-layout.md` → thư mục
  `fe/patterns/file-layout/` với `INDEX.md`, `vi.md`, `example.md`, `audit.md`, `changelog.md`. File
  luật phẳng **không bị xoá và không bị sửa** trong lần chuyển này; module mới là bản diễn đạt lại
  đầy đủ hơn của cùng một luật, không phải một luật khác. Toàn bộ `id` và `slug` đổi theo.
- **Giữ nguyên sáu mã.** `FILE-1` … `FILE-6` giữ đúng số, đúng nghĩa và đúng thứ tự của luật gốc.
  Không mã nào được thêm, không mã nào được gộp, không mã nào được đánh số lại.
- **Thêm bảng `## Tầng giữ`.** Mỗi mã khai rõ tầng thật sự giữ nó — `unrepresentable`, `enforced` hay
  `documented` — và tên rule trong `sources/fe/file-layout.mjs`. Cả sáu mã đều `enforced`, nên không
  dòng nào `documented`. Vì thế bảng được bổ sung **một cột thứ tư**: *rule không nhìn thấy cái gì*.
  Không có cột đó, chữ `enforced` sẽ nói dối bốn lần: bốn rule đọc **đường dẫn** trong khi luật nói về
  **nội dung**.
- **Thêm bảng `## Anchor`.** Mỗi mã trỏ vào code thật kiểm chứng được: neo chính là case mang đúng tên
  mã trong `sources/fe/file-layout.test.mjs`, neo phụ là glob của cây nơi luật thật sự được sống.
  `FILE-5` ghi `chưa neo được` trong code sản xuất — workspace hiện chỉ có một app, nên rule của nó
  trơ theo thiết kế — và được đưa vào "Rủi ro còn mở" thay vì bị hạ tầng cho gọn bảng.
- **Ghi lại lệch giữa văn bản và cài đặt của `FILE-1`.** Luật gốc nói rule chặn được "hành khách
  không cùng họ"; cài đặt thực tế duyệt thư mục ngay khi có **một** export thuộc họ. Bất đồng này vào
  `audit.md` như một đề xuất rule change, **không** thành một lần sửa lén ở hai đầu.
- **Ghi lại những khẳng định không mang mã.** "Category dưới `leaves/`/`branches/`" và "`blocks/<Name>/`
  phẳng không có category" là luật thật trong bảng Forbidden gốc nhưng không thuộc `FILE-1..6`.
  Chúng được bảo toàn trong `## Law` và được nêu ở "Rủi ro còn mở", vì module này có sáu mã và kết
  thúc với sáu mã.
- **Viết `vi.md` theo từng mã.** Mỗi mã có tình huống nghiệp vụ, dấu hiệu nhận biết, câu tự hỏi, ranh
  giới với các mã kề, và danh sách tình huống hay gặp.
- **Viết `example.md` cho đủ case.** Mỗi mã nhiều case, từng case đặt ĐÚNG cạnh SAI, kèm mục "ngoại lệ
  và nhầm lẫn". Bổ sung các ví dụ **rule xanh mà luật vẫn sai**, vì đó là chỗ người đọc tin nhầm nhiều
  nhất. Thêm bảng ánh xạ yêu cầu, bảng phân định ranh giới và danh sách sai lầm lặp lại.
- **Gộp `prompt.md`.** Ánh xạ yêu cầu và bảng phân định ranh giới nằm cùng chỗ với ví dụ mà chúng phân
  định. Module còn năm record.
- **Rút mọi tên riêng ra khỏi ví dụ.** Bỏ tên repository và tên component riêng mà luật phẳng dùng làm
  implementation anchor; mọi ví dụ viết lại bằng tên tổng quát. Một luật ở shelf này phải đúng với bất
  kỳ front end nào có cây component và cây route theo file; ví dụ cần tên riêng của một sản phẩm mới
  đọc được là ví dụ nằm sai chỗ.
- **Giữ nguyên mọi quyết định thật của luật phẳng.** Cây thư mục, luật category-hay-phẳng, đường ranh
  feature trong workspace nhiều app, danh sách slot của cây route, hai thứ được nhận (`providers`,
  `globals.css`), miễn trừ cho `app/api/**`, `_folder` và file test, quy tắc tạo thư mục đích ở lần
  dùng đầu tiên, và thứ tự áp dụng `warn` trước cho `export-matches-folder` — tất cả được mang sang
  nguyên vẹn.

## Các phiên bản trước

Luật này trước `2.00` sống dưới dạng **một file phẳng** ở `fe/canon/patterns/file-layout.md` và không
mang số phiên bản riêng. Lịch sử của nó là lịch sử của file đó cùng với
`sources/fe/file-layout.mjs`: sáu mã lần lượt ra đời, và `FILE-6` là mã cuối cùng được viết ra sau
khi một page owner đi qua build, lint, typecheck, bốn ảnh chụp niêm phong và một lần phê duyệt với
mọi cổng đều xanh — vì mọi cổng đều đang đọc rule, còn câu đó thì chỉ là văn xuôi.
