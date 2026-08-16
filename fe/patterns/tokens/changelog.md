---
id: fe-patterns-tokens-changelog
title: changelog.md
slug: /fe/patterns/tokens/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật Tokens.
---

# changelog.md

> Current version: `2.00` · Module: `tokens`

## Version Policy

Một thay đổi luật được chấp nhận thì tăng cả module thêm `0.01` và cập nhật **năm** record. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc module hoặc shelf mà nó nằm trên.

Số mã **không** đi theo phiên bản. Một mã `TOKEN-<n>` đã phát ra thì bảo toàn số và nguyên nghĩa
mãi mãi, vì các file luật khác và các task record cũ đã trỏ vào nó. Đổi số một mã là làm gãy một
citation người khác đã viết, và không phiên bản nào cho phép việc đó.

## 2.00 — 2026-08-16

Đổi số chính vì hình dạng của module đổi: từ **một file luật phẳng** thành **module năm record**.

- **Chuyển shelf và tách record.** `fe/canon/patterns/tokens.md` → `fe/patterns/tokens/`. Một file
  duy nhất trước đây gánh cả định nghĩa, thang, luật, bảng cấm và ví dụ; nay tách thành `INDEX.md`
  (máy đọc trước), `vi.md` (tình huống nghiệp vụ), `example.md` (case và ngoại lệ), `audit.md` (phản
  biện) và `changelog.md`. Toàn bộ `id` và `slug` đổi theo. **File luật phẳng gốc không bị xoá và
  không bị sửa**; bản này là một cách diễn đạt lại đầy đủ hơn, không phải một luật mới.

- **Giữ nguyên chín mã.** `TOKEN-1` … `TOKEN-9` bảo toàn số và nguyên nghĩa. Không mã nào bị đánh
  lại số, không mã nào bị thêm vào. Quy trình chuyển đổi đếm module này có **mười** mã; luật chỉ có
  **chín**, và luật là nguồn sự thật. Sai lệch được ghi ở `audit.md` § *Verdict* và § *Rủi ro còn
  mở* thay vì được sửa âm thầm bằng cách bịa thêm một mã.

- **Thêm bảng `## Tầng giữ`.** Mỗi mã nay làm rõ **cái gì thật sự giữ nó**, chứ không chỉ nói nó yêu
  cầu điều gì. Kết quả đo được: một mã `unrepresentable` (`TOKEN-1`, do union đóng), bốn mã
  `enforced` với tên rule gọi ra được (`TOKEN-3` → `no-fractional-step`, `TOKEN-4` →
  `no-arbitrary-value`, `TOKEN-5` → `no-hand-rolled-heading`, `TOKEN-9` →
  `no-unresolved-token-class`), và bốn mã `documented` (`TOKEN-2`, `TOKEN-6`, `TOKEN-7`, `TOKEN-8`).
  Khoảng hở bốn mã đó **là mục đích của bảng**, không phải một thất bại của nó: một mã chỉ được ghi
  `enforced` khi đã đọc được rule trong `tokens.mjs` và gọi được tên nó.

- **Thêm bảng `## Anchor`.** Mỗi mã trỏ vào code thật kèm thứ cần tìm ở đó — union `LayoutClassName`,
  các pattern và rule trong `tokens.mjs`, leaf sở hữu thứ bậc chữ, bảng tông màu ghép cặp, union hai
  giá trị của chiều cao control, các biến `--container-app-*` trong stylesheet. Không mã nào phải
  ghi `chưa neo được`. Một luật không trỏ được vào code thật là một đề xuất, không phải một luật.

- **Neo cả những quyết định không mang số.** Bảng anchor có thêm hai dòng cho các quyết định mà luật
  phẳng nêu bằng văn xuôi và không đánh số: cặp "mép 16px quanh seam 16px" cùng ngoại lệ cascade của
  joined list, và bộ class inset theo từng row. Chúng được neo để còn kiểm được, và **không** được
  nâng thành mã mới.

- **Viết lại `vi.md` theo từng mã.** Mỗi mã có tình huống nghiệp vụ, dấu hiệu nhận biết, câu tự hỏi,
  ranh giới với các mã kề, và danh sách tình huống hay gặp — thay cho một danh sách luật đọc từ trên
  xuống.

- **Viết lại `example.md` cho đủ case.** Mỗi mã nhiều case, từng case đặt ĐÚNG cạnh SAI, kèm mục ngoại
  lệ và nhầm lẫn. Thêm bảng ánh xạ yêu cầu, bảng phân định ranh giới và danh sách sai lầm lặp lại.
  Không có `prompt.md`; ánh xạ yêu cầu nằm cùng chỗ với ví dụ mà nó phân định. Module có đúng **năm**
  record.

- **Rút mọi ví dụ về TSX thuần.** Bỏ tên sản phẩm, tên repository và tên component library. Chỗ nào
  luật gốc gọi tên một component riêng thì bản này gọi theo vai trò của nó. Đường dẫn repository chỉ
  còn xuất hiện trong bảng anchor, và `## Scope` làm rõ chúng là **bằng chứng**, không phải từ vựng
  mà luật định nghĩa.

## Các phiên bản trước

Luật phẳng `fe/canon/patterns/tokens.md` dựng thang sáu bậc, phép thử hai dữ kiện của `gap-2`, việc
bỏ hẳn bậc số không, cặp inset–seam của surface, hai token chiều cao control, và chín luật
`TOKEN-1`…`TOKEN-9`. File đó vẫn còn nguyên tại chỗ cũ.
