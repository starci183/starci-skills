---
id: fe-patterns-comments-changelog
title: changelog.md
slug: /gates/patterns/comments/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật Comments.
---

# changelog.md

> Current version: `2.00` · Module: `comments`

## Version Policy

Một thay đổi luật được chấp nhận thì tăng cả module thêm `0.01` và cập nhật **năm** record. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc module hoặc shelf mà nó nằm trên.

Sáu mã `COMMENTS-1` … `COMMENTS-6` được trích dẫn từ các file luật khác và từ các bản ghi task đã
đóng. Một số hiệu, khi đã phát ra, **không bao giờ** được đánh lại số hay dùng lại cho nghĩa khác:
đổi một mã là làm gãy một trích dẫn ai đó đã viết và không còn ở đây để sửa.

## 2.00 — 2026-08-16

Đổi số chính vì hai thứ đổi cùng lúc: shelf và hình dạng module.

- **Chuyển từ một file luật phẳng sang module năm record.** `fe/canon/patterns/comments.md` →
  `gates/patterns/comments/`. File phẳng cũ **không bị xoá và không bị sửa**; nó vẫn là nguồn nội dung mà
  bản này diễn đạt lại đầy đủ hơn. Không luật mới nào được phát minh ở đây.
- **Giữ nguyên sáu mã.** `COMMENTS-1` … `COMMENTS-6`, nguyên số, nguyên nghĩa, nguyên cả phạm vi
  "exports only" của `COMMENTS-1` và "đúng ba ngoại lệ" của `COMMENTS-3`. Module có sáu mã và kết thúc
  với sáu mã.
- **Thêm bảng `Tầng giữ`.** Mỗi mã ghi rõ thứ **thật sự** giữ nó: `unrepresentable`, `enforced` kèm
  **tên rule**, hay `documented`. Bốn mã có rule gọi được tên
  (`starci-fe/require-export-jsdoc`, `starci-fe/no-second-language-in-source`,
  `starci-fe/no-emoji-in-source`), hai mã không có gì ngoài người đọc. Ba trong bốn mã `enforced` chỉ
  được giữ **một phần**, và phần không với tới được ghi ngay trong bảng chứ không làm tròn lên.
- **Thêm bảng `Anchor`.** Mỗi mã trỏ vào code thật kèm thứ cần tìm ở đó: `sources/fe/comments.mjs` và
  twin test của nó. Cả sáu mã đều neo được, không mã nào phải ghi `chưa neo được`. Giới hạn của tập
  anchor này — toàn bộ nằm trong lint source, không có anchor TSX sản phẩm nào kiểm được từ repository
  này — nằm ở [`audit.md`](./audit.md).
- **Viết lại `vi.md` theo từng mã.** Mỗi mã có tình huống, dấu hiệu nhận biết, câu tự hỏi, ranh giới
  với mã kề, và danh sách tình huống nghiệp vụ hay gặp.
- **Viết lại `example.md` cho đủ case.** Mỗi mã nhiều case, từng case đặt SAI và ĐÚNG cạnh nhau, kèm
  mục ngoại lệ và nhầm lẫn. Thêm phần ánh xạ yêu cầu, bảng phân định ranh giới và danh sách sai lầm
  lặp lại.
- **Không có `prompt.md`.** Ánh xạ yêu cầu nằm cùng chỗ với ví dụ mà nó phân định. Module có đúng năm
  record.
- **Rút mọi ví dụ về TSX thường.** Bản phẳng neo vào một component riêng và một plugin của một
  repository cụ thể. Ở đây, chỗ nào luật chạm tới một component riêng thì gọi **vai trò** của nó —
  *leaf reaction*, *bộ từ vựng icon* — vì một luật ở shelf này phải đúng với bất kỳ front end nào.
- **Ghi lại bốn chênh lệch giữa luật và rule, không sửa cái nào.** Emoji trong locale data (luật cấm,
  rule miễn), endonym `Tiếng Việt` (rule cho qua, luật chỉ nêu ba ngoại lệ), `vn-ok:` rỗng (rule chấp
  nhận), và các dạng khai báo `COMMENTS-1` không với tới. Cả bốn nằm ở "Rủi ro còn mở" — bất đồng
  không bao giờ đi vào một lần sửa âm thầm.

## Các phiên bản trước

Bản phẳng `fe/canon/patterns/comments.md` dựng định nghĩa "comment là thứ code không tự nói được",
hai câu hỏi quyết định, sáu mã, bảng Forbidden và bốn cặp ví dụ. Toàn bộ nội dung đó được giữ lại
trong module này; phần thêm vào là tầng giữ, anchor, phân định theo từng mã và audit.
