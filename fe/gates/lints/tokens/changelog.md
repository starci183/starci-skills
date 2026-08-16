---
id: fe-lints-tokens-changelog
title: changelog.md
slug: /gates/lints/tokens/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của tài liệu bốn luật máy giữ token.
---

# changelog.md

> Phiên bản hiện tại: `2.00` · Mô-đun: `tokens`

## Quy ước phiên bản

Một thay đổi được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc mô-đun hoặc nhóm mà nó nằm trên.

Mô-đun này tài liệu hoá **cơ chế cưỡng chế**, không phải luật. Vì vậy nó có thêm một điều kiện tăng
phiên bản mà các nhóm khác không có: **tệp luật đổi thì tài liệu này phải đổi theo, kể cả khi luật
văn bản không đổi một chữ nào.** Thêm một tên họ vào một biểu thức chính quy là một thay đổi có
phiên bản, vì nó đóng một cửa mà tài liệu này đang khai là mở.

Đổi tên một luật là thay đổi lớn nhất có thể xảy ra ở đây: tên là **định danh** — chuỗi xuất hiện
trong nhật ký bản dựng, trong chú thích tắt luật và trong mọi cuộc trao đổi về một lần báo lỗi. Đổi
tên là làm hỏng cả ba chỗ cùng lúc.

## 2.00 — 2026-08-16

Tạo mới. Mô-đun này ra đời để tài liệu hoá **cưỡng chế**: một máy thật sự nhìn thấy gì, và — phần
không ai chịu viết xuống — nó **không** nhìn thấy gì.

- **Nguồn.** Tệp luật `sources/fe/tokens.mjs`, phát hành trong gói `@starci/eslint-canon-fe`. Luật
  văn bản mà nó giữ là `patterns/tokens.md`, mã mang tiền tố `TOKEN-`.
- **Bốn luật được tài liệu hoá**, đúng bằng số tệp nguồn công bố:
  - `no-fractional-step` → `TOKEN-3`
  - `no-arbitrary-value` → `TOKEN-4`
  - `no-hand-rolled-heading` → `TOKEN-5`
  - `no-unresolved-token-class` → `TOKEN-9`
- **Định danh là tên đã công bố.** Không sinh mã số riêng cho luật. Mã `TOKEN-n` là **ánh xạ sang
  luật văn bản**, không phải tên thứ hai của luật máy.
- **Ghi nhận cơ chế dùng chung.** Ba thị giác (`JSXAttribute`, `VariableDeclarator`, `Property` khoá
  `classes`), một bộ đọc chuỗi tĩnh, một cổng đường dẫn `/src/`. Ba trong bốn luật dùng chung toàn
  bộ cơ chế này; luật thứ tư dùng chung bộ duyệt nhưng lấy bằng chứng từ hệ tệp.
- **Hai bảng cửa lách.** Bảng **đóng** liệt kê 11 cách viết mà người đọc dễ tưởng là lọt được nhưng
  không lọt — dẫn đầu là nhấc giá trị ra hằng số, chính là ca đã sinh ra bộ luật này. Bảng **mở**
  liệt kê **20 cửa còn mở**, mỗi luật ít nhất một cửa, và bảy cửa áp cho cả bốn luật cùng lúc.
- **Mười sáu rủi ro còn mở** trong `audit.md`, mỗi rủi ro kèm câu trả lời cho "luật phải soi thêm cái
  gì mới đóng được" — hoặc lý do đóng đắt hơn để mở. Bốn khoản được xếp là rẻ và nên làm sớm; hai
  khoản được xếp là **không nên đóng** vì chi phí vượt giá trị.
- **Hai mã luật không có luật máy** được ghi nhận thay vì bỏ qua: `TOKEN-7` kiểm được bằng máy và
  chưa có luật; `TOKEN-8` cần một dữ kiện về quan hệ nên vẫn phải do người giữ. Chúng **không** xuất
  hiện trong bảng `## Rules`, vì luật không chỉ tay vào được là một đề xuất.
- **Hai phát hiện về chính tệp nguồn.** Luật thứ tư không có biển ngăn cách ghi mã luật như ba luật
  đầu; và chú thích ở cuối tệp nói "cả ba" trong khi có bốn luật — đoạn mã thì đúng, vì nó suy danh
  sách từ khoá của bảng luật.
- **`example.md` có 42 khối mã**, mỗi luật nhiều cặp **SAI**/**ĐÚNG**, và mỗi luật một mục **Cửa
  lách và nhầm lẫn** viết ra đúng đoạn mã lọt qua — có nhãn rõ rằng đó là thứ luật **không thấy**,
  không phải thứ luật **cho phép**.
- **Không có `prompt.md`.** Mô-đun có đúng năm tài liệu.
