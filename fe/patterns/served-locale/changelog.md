---
id: fe-patterns-served-locale-changelog
title: changelog.md
slug: /fe/patterns/served-locale/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật Served locale.
---

# changelog.md

> Current version: `2.00` · Module: `served-locale`

## Version Policy

Một thay đổi luật được chấp nhận thì tăng cả module thêm `0.01` và cập nhật **năm** record. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc module hoặc shelf mà nó nằm trên.

## 2.00 — 2026-08-16

Đổi số chính vì hình dạng của luật đổi, không phải vì nội dung luật đổi. Năm mã `LOCALE-1`…`LOCALE-5`
bảo toàn số và nguyên nghĩa; mọi quyết định của file luật phẳng được mang sang nguyên vẹn, và chỗ nào
audit không đồng ý thì nói ra ở `Rủi ro còn mở` chứ không sửa âm thầm.

- **Từ một file phẳng thành module năm record.** `fe/canon/patterns/served-locale.md` được **tái diễn
  đạt** thành `fe/patterns/served-locale/` với `INDEX.md`, `vi.md`, `example.md`, `audit.md`,
  `changelog.md`. File cũ không bị xoá và không bị sửa; module này là một cách nói đầy đủ hơn về cùng
  một luật. Không có `prompt.md`: phần ánh xạ yêu cầu nằm cùng chỗ với ví dụ mà nó phân định.

- **Thêm bảng `Tầng giữ`.** Mỗi mã khai báo tầng thật sự giữ nó: `unrepresentable`, `enforced`, hay
  `documented`. Kết quả là **2 `enforced` / 3 `documented`** — `LOCALE-1` giữ bởi
  `starci-fe/api-client-attaches-the-locale`, `LOCALE-5` giữ bởi
  `starci-fe/locale-header-belongs-to-the-link`, ba mã còn lại chỉ có người đọc giữ. Khoảng hở đó là
  **mục đích** của bảng, không phải khuyết điểm của nó: trước bảng này, hai rule có thật khiến cả năm
  mã trông như đã được giữ.

- **Nói rõ hình dạng của khoảng hở, thay vì chỉ đếm nó.** Cả hai rule đều là dữ kiện ở mức **một
  file**, nên không rule nào thấy được **giá trị** mà link tính ra. Một link tên đúng, gắn một hằng số
  cứng, thoả cả hai rule. Đó là `LOCALE-2`, và nó là câu hỏi review **theo cấu trúc**, không phải do
  bỏ sót. `LOCALE-3` là dữ kiện của môi trường triển khai, `LOCALE-4` là dữ kiện của một câu trả lời;
  cả hai đều không có mặt trong bất kỳ file source nào.

- **Thêm bảng `Anchor`.** Cả năm mã đều neo được vào code thật: chain lắp link locale, file link
  locale và resolver của nó, link terminal cùng lựa chọn `credentials`, kiểu trả về đóng của resolver,
  và một phép tìm chuỗi header ra đúng một file production. Neo của `LOCALE-4` được ghi thẳng là
  **neo yếu**: nó chứng minh client luôn khai báo một cái gì đó, không chứng minh thứ được khai báo
  đến từ người đọc.

- **Ghi ngoại lệ `links/` vào luật.** Bản phẳng không có nó; nó chỉ sống trong comment của file rule,
  nơi nó được **đo** ra: bản đầu của rule báo lỗi đúng file định nghĩa link terminal và spec của file
  đó, trên một repository đã làm mọi thứ đúng. Một ngoại lệ đã được đo mà người đọc luật không biết
  mình được hưởng là một ngoại lệ nằm sai chỗ.

- **Ghi thêm ngoại lệ seam cho test và ngoại lệ render không có địa chỉ.** Cả hai đều có trong source
  thật, cả hai đều đóng, và cả hai đều nêu rõ ranh giới: seam hết hợp lệ ngay khi một call site
  production truyền vào nó; nhánh không có địa chỉ chỉ áp cho đúng nhánh đó, và giá phải trả của nó
  được tranh luận ở `audit.md`.

- **Viết lại `vi.md` theo từng mã.** Mỗi mã có tình huống, dấu hiệu nhận biết, câu tự hỏi, ranh giới
  với mã kề, và danh sách tình huống nghiệp vụ hay gặp.

- **Viết lại `example.md` cho đủ case.** Mỗi mã nhiều case, từng case đặt ĐÚNG cạnh SAI, kèm mục ngoại
  lệ và mục "trông giống nhưng không phải mã đó"; cuối trang là ánh xạ yêu cầu, bảng phân định ranh
  giới và danh sách sai lầm lặp lại. Ba ví dụ của file luật phẳng được bảo toàn tinh thần và mở rộng
  thành các case riêng.

- **Rút mọi ví dụ về TS/TSX thường.** Bản phẳng gọi tên hook và component riêng của một sản phẩm; bản
  này gọi tên theo vai trò. Một luật ở shelf này phải đúng với bất kỳ front end nào, nên ví dụ cần tên
  riêng của một dự án mới đọc được là ví dụ nằm sai chỗ. Đường dẫn trong bảng `Anchor` là đường dẫn
  tương đối trong cây source — hình dạng của cây là thứ kiểm được, không phải tên của repository.

- **Nêu rõ luật là bắt buộc, và nêu rõ nó không phải luật `translation`.** Một màn hình tuân thủ luật
  kia hoàn hảo vẫn có thể phục vụ sai ngôn ngữ, và vì hỏng theo kiểu này **trông giống** một lỗ hổng
  bản dịch nên nó bị đi tìm trong từ điển, nơi không có gì sai cả.

## Các phiên bản trước

`1.x` sống dưới dạng một file phẳng ở `fe/canon/patterns/served-locale.md`: định nghĩa, năm rule,
bảng `Forbidden`, và ba ví dụ. Bản đó cũng là nơi năm mã `LOCALE-n` được đặt ra và là nguồn của mọi
quyết định mà `2.00` mang sang.
