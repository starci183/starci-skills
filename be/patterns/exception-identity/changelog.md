---
id: be-patterns-exception-identity-changelog
title: changelog.md
slug: /be/patterns/exception-identity/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật exception identity.
---

# changelog.md

> Current version: `2.00` · Module: `exception-identity`

## Version Policy

Một thay đổi luật được chấp nhận thì tăng cả module thêm `0.01` và cập nhật **năm** record. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc module hoặc shelf mà nó nằm trên.

Mã tình huống **không bao giờ được đánh số lại**. Mã được trích dẫn từ các file luật khác và từ các
task record đã đóng; đánh số lại một mã sẽ phá im lặng một trích dẫn ai đó đã viết ra. Một mã bị cho
là sai vẫn được giữ, và chỗ để nói nó sai là mục "Rủi ro còn mở" của `audit.md`.

## 2.00 — 2026-08-16

Đổi số chính vì hình dạng của luật đổi, không phải vì nội dung luật đổi. **Không ruling nào bị sửa
nghĩa trong lần này.**

- **Từ một file phẳng thành module năm record.** `be/canon/patterns/exception-identity.md` được
  re-express thành `be/patterns/exception-identity/` với `INDEX.md`, `vi.md`, `example.md`,
  `audit.md`, `changelog.md`. File phẳng **không bị xoá và không bị sửa**; module này là cách diễn
  đạt đầy đủ hơn của cùng một luật, không phải một luật khác. Không có `prompt.md`: ánh xạ yêu cầu và
  bảng phân định ranh giới nằm cùng chỗ với ví dụ mà chúng phân định.

- **Giữ nguyên năm mã và nghĩa của chúng.** `IDENTITY-1` (tên class kết thúc bằng `Exception`),
  `IDENTITY-2` (code là tên class viết SCREAMING_SNAKE, dạng literal), `IDENTITY-3` (đổi tên class là
  đổi hợp đồng trên dây), `IDENTITY-4` (type metadata mang tên exception của nó, kể cả khi rỗng),
  `IDENTITY-5` (HTTP status không phải danh tính). Kể cả các carve-out cũng giữ nguyên: acronym không
  bị phán xử chỗ đặt gạch dưới, client đã phát hành được phục vụ bằng cách giữ **tên class cũ**, và
  status được set ở nơi status **là** hợp đồng.

- **Thêm bảng `Tầng giữ`.** Mỗi mã một dòng, nói tầng nào thật sự giữ nó: `unrepresentable`,
  `enforced` (kèm **tên rule**), hay `documented`. Kết quả đo được: ba `enforced`
  (`exception-name-ends-in-exception`, `exception-code-matches-class-name`,
  `exception-metadata-type-named-for-class`), hai `documented` (`IDENTITY-3`, `IDENTITY-5`), không mã
  nào `unrepresentable`. Khoảng trống đó là **mục đích** của bảng, không phải khiếm khuyết: hai mã
  review giữ đã được luật phẳng tuyên bố là review giữ ngay từ đầu, với lý do là không mã nào trong
  hai mã ấy nhìn thấy được trong một file.

- **Thêm bảng `Anchor`.** Mỗi mã một dòng chỉ vào code thật và nói ở đó phải đọc gì. **Cả năm mã đều
  neo được**, không mã nào ghi `chưa neo được`. Neo cho `IDENTITY-3` gồm ba file — nơi `code` được
  gắn vào GraphQL error, nơi `code` được đưa vào body của REST error, và các spec e2e ghim đúng chuỗi
  code — vì chỉ ba file đó cùng nhau mới chứng minh được rằng code là hợp đồng ra ngoài.

- **Viết lại `vi.md` theo từng mã.** Mỗi mã có tình huống nghiệp vụ, dấu hiệu nhận biết, câu tự hỏi,
  ranh giới với các mã kề (và với `EXCEPTION-1`, `EXCEPTION-2`, `EXCEPTION-3` khi chúng là mã kề
  thật), và danh sách tình huống hay gặp.

- **Viết lại `example.md` cho đủ case.** Mỗi mã nhiều case, mỗi case đặt ĐÚNG cạnh SAI, kèm mục ngoại
  lệ và nhầm lẫn. Thêm các case mà luật phẳng chỉ nhắc bằng lời: class expression ra ngoài tầm rule,
  hằng số thay literal, class không khai constructor, `= {}` bọc ngoài destructuring, và hai lỗi dùng
  chung một type metadata.

- **Rút mọi ví dụ về TypeScript tổng quát.** Bỏ hết tên sản phẩm và tên module riêng; các tên miền
  riêng trong luật phẳng được tổng quát hoá thành document, workspace, invoice, upload, webhook,
  order, job. Một luật ở shelf này phải đúng với bất kỳ back end nào; ví dụ cần tên riêng của một hệ
  thống cụ thể mới đọc được là ví dụ đứng sai chỗ. **Ngoại lệ đã tuyên bố:** bảng `Anchor` dùng đường
  dẫn thật tương đối repository, vì một luật không chỉ được vào code thật thì là một đề xuất.

- **Ghi ba bất đồng thay vì sửa im lặng.** (1) Brief dựng module nói 8 mã; luật gốc có 5, và module
  giữ 5. (2) Các comment `// -- IDENTITY-N --` trong file lint đánh số lệch: khối thứ ba của file giữ
  ruling `IDENTITY-4` của luật. (3) Luật phẳng viết "Two of its rulings are held there" trong khi file
  lint publish ba rule. Cả ba nằm ở `audit.md`, và không phía nào bị sửa trong lần này.

## Các phiên bản trước

Trước `2.00`, luật sống trong một file phẳng duy nhất tại `be/canon/patterns/exception-identity.md`,
với các mục Definition, Rules, Forbidden và Examples. File đó dựng đủ năm ruling, bảng Forbidden bảy
dòng, và các ví dụ đối chiếu "chúng khác nhau ở đúng một điều". Ba rule giữ nó trong
`sources/be/exception-identity.mjs` đều đã đi qua `warn` kèm entry ledger ghi tên offender và chỉ lật
sang `error` khi entry đó đóng — type metadata trước, vì đổi tên một type không tốn gì của caller,
rồi tới code và tên class, là hai thứ nhìn thấy được trên dây và đã được đo với mọi client trước khi
lật.
