---
id: be-patterns-exceptions-changelog
title: changelog.md
slug: /be/patterns/exceptions/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật Exceptions.
---

# changelog.md

> Current version: `2.00` · Module: `exceptions`

## Version Policy

Một thay đổi luật được chấp nhận thì tăng cả module thêm `0.01` và cập nhật **năm** record. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc module hoặc shelf mà nó nằm trên.

Mã tình huống **không bao giờ được đánh số lại**. Chúng được trích dẫn từ file luật khác và từ task
record cũ; đổi số một mã là làm gãy lặng lẽ một trích dẫn người khác đã viết. Một mã bị cho là sai thì
vẫn giữ nguyên, và điều đó được nói ra ở `audit.md` mục "Rủi ro còn mở".

## 2.00 — 2026-08-16

Đổi số chính vì hình dạng module đổi: từ **một file luật phẳng** thành **module năm record**. Không có
luật nào bị đổi nghĩa trong lần này — đây là một lần diễn đạt lại đầy đủ hơn, không phải một luật mới.

- **Chuyển shelf và chia record.** `be/canon/patterns/exceptions.md` → `be/patterns/exceptions/` với
  năm record: `INDEX.md` (máy đọc, tiếng Anh), `vi.md` (tình huống nghiệp vụ), `example.md` (case và
  ngoại lệ), `audit.md` (phản biện), `changelog.md` (lịch sử). Toàn bộ `id` và `slug` đặt theo shelf
  mới.
- **Giữ nguyên sáu mã.** `EXCEPTION-1` … `EXCEPTION-6` giữ nguyên số và nguyên nghĩa từ bản phẳng.
  Module này có sáu mã và kết thúc với sáu mã: không mã nào bị đánh số lại, không mã nào được bịa
  thêm.
- **Thêm bảng `Tầng giữ`.** Mỗi mã ghi rõ ai **thật sự** giữ nó: `unrepresentable` (kiểu làm cho giá
  trị sai không viết được), `enforced` (một rule bắt được — và rule đó phải gọi được tên), hay
  `documented` (chỉ người đọc giữ). Kết quả: bốn `enforced`, hai `documented`, không mã nào
  `unrepresentable`.

  Khoảng trống đó **là mục đích của bảng**, không phải khuyết điểm của nó. Trước lần này, một luật chỉ
  có prose giữ và một luật có rule giữ trông giống hệt nhau khi đọc — và cái giống nhau đó là cách một
  luật `documented` bị tin là đã enforce.

- **Thêm bảng `Anchor`.** Mỗi mã chỉ vào source thật: một đường dẫn, và thứ cần đọc ở đó. Luật cao
  nhất của canon là một luật không chỉ được vào code thật thì chỉ là một đề xuất. Cả sáu mã đều neo
  được; không mã nào ghi `chưa neo được`.

  Có hai neo là **sự vắng mặt được đo**: không có `throw new Error` nào trong product code, và không
  có class `*Exception` nào khai báo ngoài cây exceptions. Sự vắng mặt đó chính là thứ rule mua được,
  nên nó được ghi vào bảng như một neo chứ không bị bỏ qua vì "không có gì để chỉ".

- **Nêu rõ `EXCEPTION-2` gần chạm `unrepresentable` mà chưa tới.** Mọi khai báo hiện tại đều gõ kiểu
  cho tham số và không đặt giá trị mặc định, nên cả ba thông điệp của rule đều đã là lỗi biên dịch tại
  call site. Nhưng đó là tính chất kiếm được ở từng khai báo, không phải bảo đảm của base class, nên
  tầng giữ ghi là `enforced`.
- **Nêu rõ ranh giới với module `exception-identity`.** Module này quyết định *có một class hay
  không*; module bên cạnh quyết định *class đó tên gì, code gì, metadata type tên gì*. Trước đây hai
  câu hỏi nằm gần nhau đủ để bị đọc lẫn.
- **Viết `vi.md` theo từng mã.** Mỗi mã có tình huống, dấu hiệu nhận biết, câu tự hỏi, ranh giới với
  các mã kề, và danh sách tình huống nghiệp vụ hay gặp. Bản phẳng nêu luật rồi nêu lý do; bản này nêu
  thêm **cách nhận ra mình đang ở trong tình huống nào** — phần mà người đọc thiếu nhất khi đứng trước
  một dòng `throw` cụ thể.
- **Viết `example.md` cho đủ case.** Mỗi mã nhiều case, ĐÚNG và SAI đặt cạnh nhau, kèm mục ngoại lệ và
  nhầm lẫn. Bản phẳng có bốn ví dụ cho sáu luật; bản này có ví dụ cho từng mã, kèm ánh xạ từ yêu cầu
  bằng lời và bảng phân định ranh giới.
- **Rút mọi ví dụ về TypeScript trung tính.** Bỏ tên sản phẩm và tên module riêng trong ví dụ. Một
  luật ở shelf này phải đúng với bất kỳ back end nào; ví dụ cần tên riêng của một hệ thống mới đọc
  được là ví dụ đứng sai chỗ. Bảng `Anchor` là **chỗ duy nhất** trích đường dẫn của repository, và nó
  trích vì đó chính là việc của nó.
- **Ghi lại bất đồng thay vì sửa lặng lẽ.** `EXCEPTION-5` nói metadata mang thứ client cần, trong khi
  filter HTTP hiện tại không gửi metadata ra client. Luật giữ nguyên; khác biệt giữa luật và source
  được ghi ở `audit.md` mục "Rủi ro còn mở" và nhắc lại ở `Anchor`.
- **Không có `prompt.md`.** Module gồm đúng năm record.

## Các phiên bản trước

`1.x` là file luật phẳng `be/canon/patterns/exceptions.md`: phần `Definition`, sáu luật
`EXCEPTION-1`…`EXCEPTION-6`, một bảng `Forbidden` và bốn ví dụ. Mọi quyết định của nó được giữ nguyên
trong `2.00`.

Những quyết định đáng ghi lại từ giai đoạn đó, vì chúng được rút ra từ đo đạc chứ không từ suy luận:

- Cặp rule chỗ-throw và rule chỗ-khai-báo được giữ **cùng nhau**, sau khi một class extends base
  framework sống trong cây code và được throw từ bốn call site trong khi gate vẫn xanh.
- `EXCEPTION-4` được nới từ một đường dẫn literal thành "một thư mục exceptions cho mỗi ứng dụng",
  sau khi đường dẫn hẹp báo 83 finding ở một back end thứ hai mà phần lớn là code đã đúng.
- Carve-out cho lane test được đưa vào rule, sau khi prose cấp phép còn artifact thì không — và một
  repository nhận rule về thừa hưởng 69 finding mà canon của nó đã tha.
- Ngoại lệ health probe được cấp từ chính lý do của luật, và cố ý hẹp tới mức chỉ health controller
  mới dùng được.
