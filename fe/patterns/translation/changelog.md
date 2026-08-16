---
id: fe-patterns-translation-changelog
title: changelog.md
slug: /fe/patterns/translation/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật Translation.
---

# changelog.md

> Current version: `2.00` · Module: `translation`

## Version Policy

Một thay đổi luật được chấp nhận thì tăng cả module thêm `0.01` và cập nhật **năm** record. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc module hoặc shelf mà nó nằm trên.

## 2.00 — 2026-08-16

Đổi số chính vì hình dạng của luật đổi, không phải vì nội dung luật đổi. Sáu mã `COPY-1`…`COPY-6` giữ
nguyên số và nguyên nghĩa; mọi quyết định của bản phẳng được mang sang nguyên vẹn, và chỗ nào audit
không đồng ý thì nói ra ở `Rủi ro còn mở` chứ không sửa lặng lẽ.

- **Từ một file phẳng thành module năm record.** `fe/canon/patterns/translation.md` được **tái diễn
  đạt** thành `fe/patterns/translation/` với `INDEX.md`, `vi.md`, `example.md`, `audit.md`,
  `changelog.md`. File cũ không bị xoá và không bị sửa; module này là một cách nói đầy đủ hơn về cùng
  một luật. Không có `prompt.md`: phần ánh xạ yêu cầu nằm cùng chỗ với ví dụ mà nó phân định.
- **Thêm bảng `Tầng giữ`.** Mỗi mã khai báo tầng thật sự giữ nó: `unrepresentable`, `enforced`, hay
  `documented`. Kết quả là **2 `enforced` / 4 `documented`** — `COPY-1` giữ bởi
  `starci-fe/no-copy-resolution-below-block`, `COPY-2` giữ bởi
  `starci-fe/no-hardcoded-copy-in-vocabulary`, bốn mã còn lại chỉ có người đọc giữ. Khoảng hở đó là
  **mục đích** của bảng, không phải khuyết điểm của nó: trước bảng này, hai rule có thật khiến cả sáu
  mã trông như đã được giữ.
- **Không đếm rule của luật hàng xóm vào tầng của module.** `starci-fe/no-second-language-in-source`
  (từ `comments.mjs`) có chạm `COPY-5` và `COPY-6` nhưng bắn theo **ngôn ngữ**, nên nó được ghi làm
  chú thích chứ không được tô thành `enforced`.
- **Thêm bảng `Anchor`.** Mỗi mã chỉ vào code thật kiểm chứng được: cặp `index.tsx` / `component.tsx`
  của block, các tier dưới block, kiểu prop của nửa vẽ, `component.test.tsx`, thư mục locale cùng
  danh sách `CONTENT_PATHS`. `COPY-6` ghi `chưa neo được` và có mặt ở `Rủi ro còn mở`, vì trong code
  thật không tìm được dòng nào vừa mang dấu `vn-ok:` vừa đúng là giá trị chương trình so khớp.
- **Viết lại `vi.md` theo từng mã.** Mỗi mã có tình huống, dấu hiệu nhận biết, câu tự hỏi, ranh giới
  với mã kề, và danh sách tình huống nghiệp vụ hay gặp.
- **Viết lại `example.md` cho đủ case.** Mỗi mã nhiều case, mỗi case đặt ĐÚNG cạnh SAI, kèm mục ngoại
  lệ và mục "trông giống nhưng không phải mã đó"; cuối trang là ánh xạ yêu cầu, bảng phân định ranh
  giới và danh sách sai lầm lặp lại.
- **Rút mọi ví dụ về TSX thường.** Ví dụ trong bản phẳng gọi tên component riêng của một sản phẩm;
  bản này gọi tên theo vai trò. Một luật ở shelf này phải đúng với bất kỳ front end nào, nên ví dụ
  cần tên riêng của một sản phẩm mới đọc được là ví dụ đứng sai chỗ.
- **Nêu rõ luật là bắt buộc.** Bổ sung tuyên bố rằng mọi chuỗi người đọc thấy hoặc nghe đều rơi vào
  đúng một mã, kể cả một chữ `alt` duy nhất.
- **Nói rõ `COPY-5` và `COPY-6` không phải miễn trừ khỏi luật mà là một phần của luật.** Đặt tên cho
  hai tình huống này chính là thứ giữ cho bốn mã kia hẹp đủ để tuyệt đối.

## Các phiên bản trước

`1.x` sống dưới dạng một file phẳng ở `fe/canon/patterns/translation.md`: định nghĩa, sáu rule, bảng
`Forbidden`, và ba ví dụ. Bản đó cũng là nơi sáu mã `COPY-n` được đặt ra và là nguồn của mọi quyết
định mà `2.00` mang sang.
