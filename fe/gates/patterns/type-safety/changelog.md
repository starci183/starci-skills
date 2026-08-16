---
id: fe-patterns-type-safety-changelog
title: changelog.md
slug: /gates/patterns/type-safety/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật type-safety.
---

# changelog.md

> Current version: `2.00` · Module: `type-safety`

## Version Policy

Một thay đổi luật được chấp nhận thì tăng cả module thêm `0.01` và cập nhật **năm** record. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc module hoặc shelf mà nó nằm trên.

Một mã đã phát hành thì **không bao giờ được đánh số lại**. Các mã `TYPE-SAFETY-<n>` được trích dẫn
từ những file luật khác và từ các task record đã đóng; đổi số một mã âm thầm làm hỏng một trích dẫn
đã có người viết ra. Mã sai thì bảo toàn và ghi vào "Rủi ro còn mở" của `audit.md`.

## 2.00 — 2026-08-16

Đổi số chính vì hình dạng của module đổi, không phải vì luật đổi. **Không một quyết định nào của bản
phẳng bị sửa**: mọi bất đồng đi vào `audit.md` thay vì đi vào một lần sửa im lặng.

- **Từ một file phẳng thành một module năm record.** `fe/canon/patterns/type-safety.md` được diễn đạt
  lại thành `gates/patterns/type-safety/` với `INDEX.md`, `vi.md`, `example.md`, `audit.md`,
  `changelog.md`. File phẳng vẫn còn nguyên tại chỗ cũ; bản này **tái diễn đạt** nó, không thay thế
  nó bằng một luật khác.
- **Giữ đủ năm mã, đúng số và đúng nghĩa.** `TYPE-SAFETY-1` cast xuyên `unknown`; `TYPE-SAFETY-2`
  `any` và bán kính lan của nó; `TYPE-SAFETY-3` một cách viết cho mảng; `TYPE-SAFETY-4` miễn trừ
  dạng đường dẫn cho test; `TYPE-SAFETY-5` cast sống sót mang lý do. Không mã mới, không mã bị gỡ.
- **Thêm `## Tầng giữ`.** Mỗi mã làm rõ ai đang giữ nó: `unrepresentable`, `enforced` hay
  `documented`. Kết quả trung thực là **1 `enforced`, 4 `documented`** — `no-double-cast` giữ
  `TYPE-SAFETY-1`, còn lại là người đọc. Bảng phân biệt hai loại `documented` khác hẳn nhau: bàn giao
  có chủ đích cho một rule ngoại (`TYPE-SAFETY-2` cho `@typescript-eslint/no-explicit-any`,
  `TYPE-SAFETY-3` cho `@typescript-eslint/array-type`), và không cơ chế nào giữ được
  (`TYPE-SAFETY-4`, `TYPE-SAFETY-5`).
- **Thêm `## Anchor`.** Mỗi mã trỏ vào code thật trong cây nguồn front end kèm điều cần tìm ở đó.
  `TYPE-SAFETY-1` được neo bằng một **sự vắng mặt** — không file sản phẩm nào chứa `as unknown as` —
  vì đó là dạng neo đúng cho một luật cấm.
- **Sửa một neo đã lệch.** Bản phẳng nêu `src/components/pages/ProfileSkillsPage/component.test.tsx`
  làm anchor; file ấy hiện không còn cast nào. Neo của `TYPE-SAFETY-4` chuyển sang
  `src/modules/api/graphql/clients/links/bearer.test.ts`, đúng chỗ ví dụ trong file luật phẳng vốn đang
  trích. Đây là sửa **neo**, không phải sửa **luật**, và được ghi ở `audit.md`.
- **Viết `vi.md` theo từng mã.** Mỗi mã có tình huống, dấu hiệu nhận biết, câu tự hỏi, ranh giới với
  mã kề, và danh sách tình huống nghiệp vụ hay gặp. Bảng tra nhanh ghi kèm tầng giữ, để người đọc
  biết ngay mã nào không có máy nào canh.
- **Viết `example.md` cho đủ case.** Mỗi mã nhiều case, từng case đặt ĐÚNG cạnh SAI, kèm mục "ngoại lệ
  và nhầm lẫn". Thêm ví dụ `any` đi qua ba file — trong đó file nổ **không viết chữ `any` nào** — vì
  đó là toàn bộ luận điểm của `TYPE-SAFETY-2` và là thứ một ví dụ một-file không nói được.
- **Rút mọi ví dụ về TS/TSX thuần.** Tên thư viện thật được thay bằng `@vendor/*`; component riêng
  được tổng quát hoá. Một luật ở shelf này phải đúng với bất kỳ front end nào; ví dụ cần tên riêng
  của một sản phẩm mới đọc được là ví dụ nằm sai chỗ.
- **Gộp phần ánh xạ yêu cầu vào `example.md`.** Bảng ánh xạ và bảng phân định ranh giới nằm cùng chỗ
  với ví dụ mà chúng phân định. Không có `prompt.md`; module đúng năm record.
- **Ghi hai khoảng hở thay vì che chúng.** `audit.md` nêu rõ: module không đọc được severity của hai
  rule ngoại, và `src/app/sitemap.ts` mang một cast không lý do mà không cơ chế nào báo cáo.
- **Ghi một bất đồng thay vì sửa luật.** `TYPE-SAFETY-3` là mã duy nhất không nói về việc tắt kiểm,
  nên có thể bị cho là đứng sai module. Mã **bảo toàn**; lập luận hai chiều nằm ở "Rủi ro còn mở".

## Các phiên bản trước

Bản phẳng `fe/canon/patterns/type-safety.md` dựng câu hỏi phân định ("trình biên dịch đang biết điều
gì mà dòng này bảo nó quên đi"), năm luật, bảng Forbidden và ba cặp ví dụ đối chiếu. Nó cũng ghi
quyết định **không** chép lại `no-explicit-any` và `array-type` vào rule file của canon — quyết định
ấy được bảo toàn ở `2.00` và nay được nêu rõ hậu quả trong `## Tầng giữ`.
