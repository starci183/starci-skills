---
id: fe-patterns-the-split-changelog
title: changelog.md
slug: /gates/patterns/the-split/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật The split.
---

# changelog.md

> Current version: `2.00` · Module: `the-split`

## Version Policy

Một thay đổi luật được chấp nhận thì tăng cả module thêm `0.01` và cập nhật **năm** record. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc module hoặc shelf mà nó nằm trên.

Sáu mã `SPLIT-<n>` là **cố định**. Mã đã phát hành thì bảo toàn số và nguyên nghĩa, vì nó đang được
trích dẫn ở những file luật khác và ở các bản ghi công việc cũ; đánh số lại một mã là làm hỏng một
trích dẫn mà ai đó đã viết ra. Thêm mã mới là thay đổi luật, không phải một lần dọn dẹp.

## 2.00 — 2026-08-16

Đổi số chính vì hình dạng của luật đổi, không phải vì nội dung luật đổi.

- **Từ một file phẳng thành module năm record.** `fe/canon/patterns/the-split.md` được diễn đạt lại
  thành `gates/patterns/the-split/` với `INDEX.md`, `vi.md`, `example.md`, `audit.md`, `changelog.md`.
  File luật phẳng vẫn nằm nguyên chỗ cũ và **không** bị sửa; module này là bản diễn đạt đầy đủ hơn
  của cùng một luật, không phải một luật mới. Toàn bộ `id` và `slug` theo shelf mới.
- **Giữ nguyên sáu mã.** `SPLIT-1` … `SPLIT-6` giữ đúng số và đúng nghĩa của file luật phẳng: nửa vẽ không
  hỏi gì, nửa connected chốt tình huống chứ không chốt hình thức, tình huống băng qua dưới dạng một
  cái tên, chữ được dịch trước khi băng qua, nửa connected không tự vẽ gì, và không có request thì
  không tách. Không mã nào được thêm, bỏ hay đánh số lại.
- **Thêm bảng `Tầng giữ`.** Mỗi mã làm rõ nó đang được giữ ở tầng nào: `SPLIT-1` bởi
  `presentational-purity`, `SPLIT-5` bởi `connected-block-has-presentational-twin`, bốn mã còn lại
  chỉ ở tầng `documented`. Bảng này tồn tại để khoảng cách giữa "luật viết ra" và "luật giữ được"
  đứng ngay trong record, chứ không nằm trong trí nhớ của người review.
- **Thêm bảng `Anchor`.** Mỗi mã chỉ vào code thật kiểm được: đường dẫn, và **tìm gì ở đó**. Hai neo
  là kết quả rỗng — không `component.tsx` nào gọi họ hook đọc thế giới, không file connected nào chứa
  `className` — và điều đó được nêu rõ là neo âm.
- **Viết lại `vi.md` theo từng mã.** Mỗi mã có tình huống nghiệp vụ, dấu hiệu nhận biết, câu tự hỏi,
  ranh giới với mã kề, và danh sách tình huống hay gặp.
- **Viết lại `example.md` cho đủ case.** Mỗi mã nhiều case, từng case đặt ĐÚNG cạnh SAI, kèm mục ngoại
  lệ và mục "trông giống nhưng không phải mã này". Phần cuối ánh xạ yêu cầu bằng lời sang hai nửa và
  bảng phân định ranh giới.
- **Rút mọi ví dụ về TSX thuần.** Bản phẳng neo vào hai file có thật của một ứng dụng cụ thể và gọi
  tên các component riêng của nó. Ở shelf này, một luật phải đúng với bất kỳ front end nào, nên các
  tên riêng được tổng quát hoá; bằng chứng gắn với một ứng dụng chuyển vào bảng `Anchor` dưới dạng
  **hình dạng đường dẫn**, không phải tên sản phẩm.
- **Ghi ra hai chỗ luật rộng hơn rule.** `presentational-purity` gác theo tên file, nên một request
  chuyển sang file khác cùng folder rồi import vào vẫn lọt; và
  `connected-block-has-presentational-twin` chỉ nhận ra tier block, trong khi luật nói "mọi surface
  có request". Cả hai nằm ở `audit.md` phần *Rủi ro còn mở*, không được sửa âm thầm ở đây.
- **Không có `prompt.md`.** Module đúng năm record.

## Các phiên bản trước

`1.x` là file luật phẳng `fe/canon/patterns/the-split.md`: định nghĩa đường ranh, sáu quy tắc, bảng
`Forbidden` và bốn cặp ví dụ. Mọi quyết định của nó được bảo toàn ở `2.00`; chỗ nào bản này không
đồng ý thì nói ra ở `audit.md` chứ không sửa đi.
