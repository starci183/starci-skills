---
id: be-patterns-comments-changelog
title: changelog.md
slug: /be/patterns/comments/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật Comments.
---

# changelog.md

> Current version: `2.00` · Module: `comments`

## Version Policy

Một thay đổi luật được chấp nhận thì tăng cả module thêm `0.01` và cập nhật **năm** record. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc module hoặc shelf mà nó nằm trên.

Thêm, bỏ hoặc đánh số lại một mã `COMMENT-<n>` là **thay đổi lớn**, không phải một lần tăng. Số của
mã được trích dẫn ở các luật anh em và ở các bản ghi task cũ, nên đánh số lại một mã sẽ **âm thầm làm
hỏng một trích dẫn ai đó đã viết ra rồi**.

## 2.00 — 2026-08-16

Đổi số chính vì hình dạng của module đổi: từ **một file luật phẳng** thành **module năm record**.

- **Chuyển shelf và đổi hình dạng.** `be/canon/patterns/comments.md` → `be/patterns/comments/`. Một
  file `Definition · Rules · Forbidden · Examples` trở thành năm record: `INDEX.md` (máy đọc trước,
  tiếng Anh), `vi.md` (tình huống theo từng mã), `example.md` (case và ngoại lệ), `audit.md` (phản
  biện), `changelog.md` (bản ghi này). Không có `prompt.md`; module dừng ở năm record.
- **Giữ nguyên năm mã.** `COMMENT-1` … `COMMENT-5` giữ đúng số và đúng nghĩa cũ. Đây là bản **diễn
  đạt lại đầy đủ hơn**, không phải luật mới: không mã nào được thêm, bỏ, gộp hay đánh số lại.
- **Thêm bảng `Tầng giữ`.** Mỗi mã khai ra tầng thật sự giữ nó: `COMMENT-1`, `COMMENT-2` và
  `COMMENT-4` là `enforced` và **có tên rule đi kèm** (`require-export-jsdoc`,
  `require-enum-member-jsdoc`, `no-non-ascii-source`); `COMMENT-3` và `COMMENT-5` là `documented`.
  Cột `unrepresentable` trống, và cái trống đó có cấu trúc: comment không phải giá trị, nên không
  union đóng hay branded type nào làm được cho một câu văn sai trở thành không viết được.
- **Khai ra hai lỗ hổng bên trong hai mã `enforced`.** `require-export-jsdoc` thấy **sự vắng mặt** của
  doc block chứ không đọc doc; `require-enum-member-jsdoc` thấy doc **tồn tại** chứ không thấy doc có
  nói hậu quả hay không. Cả hai được nói lại ở `audit.md` kèm hình dạng ví dụ chứng minh. Bảng tầng
  không làm tròn "một nửa" thành `enforced` mà không nói.
- **Thêm bảng `Anchor`.** Mỗi mã trỏ vào code thật và nói rõ **cần nhìn gì ở đó**: một decorator một
  dòng có doc ba dòng cho `COMMENT-1`, một enum phân loại lỗi cho `COMMENT-2`, khối insert-và-race
  của một cron cho `COMMENT-3`, chỗ wiring rule cộng một file harness cho `COMMENT-4`, một regex khớp
  heading và cả mặt phát-ra của locale message cho `COMMENT-5`. **Năm trên năm mã có anchor**; không
  mã nào phải ghi `chưa neo được`.
- **Ghi lại vết sẹo của `COMMENT-4` vào chính luật.** Mã này **không** phải "chỉ ASCII". Nó từ chối ba
  lớp ký tự vì ba lý do khác nhau — chữ cái tiếng Việt, emoji, ký hiệu trang trí đứng thay một từ —
  còn dấu câu kiểu chữ thì ở lại. Bản rule đầu tiên cấm mọi codepoint ngoài ASCII và báo 857 chỗ trên
  một back end thật, toàn bộ là em dash, khung kẻ banner và middle dot. Trước đây chuyện này chỉ nằm
  trong comment của file rule; giờ nó nằm trong `INDEX.md`, `vi.md`, `example.md` và `audit.md`, vì
  đây là chỗ luật bị đọc nhầm nhiều nhất.
- **Nâng ngoại lệ lên thành một phần đóng của luật.** Sáu ngoại lệ được viết ra và mỗi ngoại lệ nêu rõ
  mã nó áp vào: hằng số dữ liệu, re-export, dấu câu kiểu chữ, endonym, file locale, lane fixture. Ngoại
  lệ lane fixture giữ nguyên phạm vi cũ — **chỉ chuỗi**, comment thì không — kèm số đo đã có từ trước
  khi nó được viết: 92 finding thì 89 là fixture, 3 là comment.
- **Nâng luật thành bắt buộc.** Bổ sung tuyên bố rằng mọi export, mọi member enum, mọi comment và mọi
  ký tự non-ASCII đều rơi vào đúng một mã, và không có khai báo nào nhỏ tới mức được miễn.
- **Viết lại `vi.md` theo từng mã.** Mỗi mã có tình huống nghiệp vụ, dấu hiệu nhận biết, câu tự hỏi,
  ranh giới với các mã kề, và danh sách tình huống hay gặp.
- **Viết lại `example.md` cho đủ case.** Mỗi mã nhiều case, mỗi case đặt **ĐÚNG** cạnh **SAI**, kèm
  mục "ngoại lệ và nhầm lẫn". Thêm bảng ánh xạ yêu cầu bằng lời sang một quyết định, bảng câu hỏi phân
  định ranh giới, và danh sách sai lầm lặp lại nhiều nhất.
- **Rút mọi ví dụ về TypeScript tổng quát.** Bỏ tên module riêng và tên miền nghiệp vụ riêng khỏi ví
  dụ; chỗ luật cũ gọi tên một module private thì nay gọi bằng vai trò. Đường dẫn thật chỉ còn xuất
  hiện ở bảng `Anchor`, vì một anchor bắt buộc phải là đường dẫn thật.
- **Ghi nhận một drift đo được.** Config đang chạy của repo tham chiếu vẫn bật ba rule cũ
  (`no-vietnamese`, `no-emoji`, `no-ai-symbol`) trong khi canon đã gộp thành `no-non-ascii-source`.
  Cả hai phía đều ở `error` nên không luật nào đang bị bỏ; cái lệch là **danh tính rule**. Ghi ở
  `audit.md` như một finding cần sync, **không** sửa lén ở đây.

## Các phiên bản trước

`comments.md` phẳng dựng năm mã `COMMENT-1` … `COMMENT-5`, bảng `Forbidden` sáu dòng, và bốn ví dụ
đối chiếu: doc nói được thứ code không nói, bẫy enum, bẫy chép lại code, và bẫy dữ liệu mặc áo văn
xuôi. Mọi quyết định của bản đó được giữ nguyên ở `2.00`; phần thêm vào là tầng giữ, anchor, ngoại lệ
đóng, và các số đo vốn chỉ nằm trong comment của file rule.
