---
id: fe-lints-served-locale-vi
title: vi.md
slug: /fe/lints/served-locale/vi
sidebar_label: vi.md
sidebar_position: 1
description: Hai rule của luật ngôn ngữ được phục vụ - bắt gì, phát hiện thế nào, và cửa nào còn mở.
---

# vi.md

> Version: `2.00` · Mô-đun: `served-locale`

Có những dữ liệu được dịch ở phía máy chủ. Một tài liệu, một phần nội dung, một tên danh mục — máy
chủ lưu mỗi ngôn ngữ một bản và trả về đúng bản mà lời gọi **hỏi xin**. Lời gọi không nói gì thì
nhận bản mặc định, mãi mãi, ở mọi ngôn ngữ.

Trang này nói về **máy giữ luật**, không nói về luật. Luật nằm ở
[`patterns/served-locale.md`](../../canon/patterns/served-locale.md) với năm mã `LOCALE-1` …
`LOCALE-5`. Máy chỉ có **hai** rule, và điều đáng nhớ nhất không phải hai rule đó bắt gì, mà là
những gì chúng **không thể nhìn thấy**.

## Bảng tra nhanh

| Rule | Mã luật | Bắt gì |
|---|---|---|
| `api-client-attaches-the-locale` | `LOCALE-1` | Một tệp dựng đường truyền cuối cùng ra mạng nhưng trong tệp đó không có lời gọi nào tạo mắt xích ngôn ngữ |
| `locale-header-belongs-to-the-link` | `LOCALE-5` | Một thuộc tính đối tượng mang khoá `x-locale` nằm ngoài tệp mắt xích ngôn ngữ |

Ba mã `LOCALE-2`, `LOCALE-3`, `LOCALE-4` **không có rule nào giữ**. Cả ba đều nói về *giá trị* mà
mắt xích tính ra, mà hai rule này chỉ nhìn thấy **tên gọi**. Đây là chỗ dễ hiểu nhầm nhất: build
xanh không phải bằng chứng cho ba mã đó.

---

## `api-client-attaches-the-locale`

**Bắt gì.** Trong một tệp, nếu có lời gọi dựng mắt xích cuối cùng — mắt xích thật sự đi ra mạng — mà
không có lời gọi nào dựng mắt xích ngôn ngữ, rule nổ tại chính lời gọi mắt xích cuối cùng đầu tiên
nó thấy.

**Giữ mã nào.** `LOCALE-1` — chuỗi truyền tải phải gắn ngôn ngữ, và mọi chuỗi đều phải gắn.

**Cách phát hiện.**

1. Hai cổng miễn trừ đọc `context.filename` (thiếu thì `context.getFilename()`), sau khi đã đổi mọi
   dấu `\` thành `/`: tệp nằm **trực tiếp** trong một thư mục tên `links`, và tệp có đuôi
   `.test.` hoặc `.spec.`.
2. Một hàm thăm duy nhất gắn vào cả `CallExpression` lẫn `NewExpression`.
3. Tên bên bị gọi được rút ra: `Identifier` cho `.name`, `MemberExpression` có thuộc tính là
   `Identifier` cho `.property.name`, còn lại là `null`.
4. Tên đó so với hai tập chuỗi cứng. Tập cuối cùng: `createHttpLink`, `HttpLink`, `createUploadLink`,
   `BatchHttpLink`. Tập ngôn ngữ: `createAttachLocaleLink`, `createLocaleLink`.
5. Tới `Program:exit` mới kết luận, nên thứ tự trong tệp không quan trọng.

**Vì sao luật này đáng có máy giữ.** Sự cố sinh ra nó không giống một lỗi truyền tải. Phần khung của
giao diện lấy chữ từ từ điển nên hiển thị đúng ngôn ngữ; phần nội dung lấy từ máy chủ nên hiển thị
ngôn ngữ mặc định. Người đọc thấy một trang **song ngữ ở khung, đơn ngữ ở ruột**, và ai cũng đi tìm
trong từ điển — nơi hoàn toàn không có gì sai. Không cổng nào nói được một câu về một header chưa ai
viết. Rule này biến "quên" thành "đỏ".

**Cửa còn mở.**

- **Đổi tên khi nhập khẩu.** `import { createHttpLink as createTransport }` rồi gọi
  `createTransport(...)`: tập chuỗi so theo cách viết, còn rule thì không truy vết nhập khẩu.
- **Chuỗi lắp từ hằng có sẵn.** `from([localeLink, authLink, httpLink])` không có lời gọi nào, nên
  không tên cuối cùng nào được thấy — kể cả khi chính mắt xích ngôn ngữ là thứ bị bỏ quên.
- **Có tên mà không có trong chuỗi.** Gọi `createLocaleLink()` rồi gán vào một hằng chẳng ai dùng
  vẫn làm rule im. Rule ghi nhận **một cái tên đã được gọi ở đâu đó trong tệp**, không kiểm nó có
  nằm trong mảng chuỗi, cũng không kiểm thứ tự.
- **Gắn có điều kiện.** `...(isLoggedIn ? [createAttachLocaleLink()] : [])` vẫn xanh, trong khi
  `LOCALE-1` nói thẳng là **vô điều kiện** — khách vãng lai cũng đọc bằng một ngôn ngữ.
- **Miễn trừ theo thư mục, không theo tệp.** Một chuỗi hoàn chỉnh đặt trong tệp nằm trực tiếp dưới
  `links/` được miễn hoàn toàn, cùng miễn với đúng tệp mà miễn trừ nhắm tới.
- **Không nhìn giá trị.** Một mắt xích ngôn ngữ gán cứng một thứ tiếng thoả mãn rule này trọn vẹn.

---

## `locale-header-belongs-to-the-link`

**Bắt gì.** Bất kỳ thuộc tính đối tượng nào có khoá đúng bằng `x-locale`, ở bất kỳ tệp nào không
phải tệp mắt xích ngôn ngữ. Mỗi thuộc tính vi phạm là một báo lỗi riêng.

**Giữ mã nào.** `LOCALE-5` — một chỗ viết header, nên một chỗ kiểm được.

**Cách phát hiện.**

1. Một cổng miễn trừ trên đường dẫn đã chuẩn hoá: đường dẫn kết thúc bằng `links/locale` cộng phần
   đuôi thuộc nhóm `[cm]?tsx?`.
2. Một hàm thăm `Property`.
3. Khoá được đọc thành chuỗi theo đúng hai cách: khoá `Identifier` **không** phải khoá tính toán cho
   `.name`; khoá `Literal` có giá trị chuỗi cho `.value`, dù có tính toán hay không.
4. So bằng nhau tuyệt đối với chuỗi `x-locale`.

**Vì sao luật này đáng có máy giữ.** Hai chỗ cùng trả lời câu hỏi "lời gọi này thuộc ngôn ngữ nào"
thì hai chỗ đó phân kỳ ngay lần đầu một trong hai được sửa. Kết cục quen thuộc: đúng một hook đúng,
phần còn lại của màn hình chạy theo mặc định của máy chủ. Cái sai này không kêu — lời gọi vẫn thành
công, chỉ trả về sai thứ tiếng.

**Cửa còn mở.**

- **Gán chứ không khai báo.** `headers["x-locale"] = locale` là một phép gán vào biểu thức thành
  viên, không phải nút `Property`. Rule chỉ đi trong đối tượng khai báo thẳng.
- **Header là đối số.** `headers.set("x-locale", locale)`: ở đây tên header là **đối số**, và rule
  không đọc đối số của lời gọi nào cả.
- **Hằng rửa sạch chuỗi.** `const HEADER = "x-locale"` rồi `{ [HEADER]: locale }`: khoá tính toán
  dạng `Identifier` trả về `null`, vì nhánh đó đòi khoá **không** tính toán. Trớ trêu là chính tệp
  nguồn của rule cũng xuất một hằng như vậy.
- **Đổi chữ hoa chữ thường.** `{ "X-Locale": locale }` đặt đúng cái header đó trên đường truyền,
  nhưng phép so là so bằng tuyệt đối nên không có báo lỗi nào.
- **Trải một đối tượng dựng nơi khác.** `{ ...localeHeader }` không có `Property` nào để thấy, còn
  đối tượng kia nằm trong tệp rule không mở ra.
- **Miễn trừ neo vào tên tệp.** Đổi tên thành `links/attach-locale.ts`, hay viết bằng JavaScript
  thành `links/locale.js`, là mất miễn trừ — nhóm đuôi `[cm]?tsx?` chỉ khớp `.ts`, `.tsx`, `.mts`,
  `.cts`. Ngược lại, một tệp bất kỳ khác trùng đường dẫn kết thúc `links/locale.ts` cũng được miễn.
- **Không có miễn trừ cho tệp kiểm thử.** Một câu khẳng định trong spec có nhắc tên header vẫn bị
  báo, vì cổng nhận diện spec chỉ được rule thứ nhất dùng.
- **Không kiểm chiều ngược lại.** Rule cấm viết header ở nơi khác, nhưng không đòi mắt xích ngôn ngữ
  **có** viết nó. Xoá hẳn header khỏi mắt xích thì cả hai rule vẫn xanh.

---

## Luật

1. Danh tính của một rule là **tên đã xuất bản** của nó. Không đặt thêm mã số cho rule; một rule hai
   tên là một rule không ai truy được thông báo đến từ đâu.
2. Chỉ tài liệu hoá rule **có thật trong tệp nguồn**. Một rule đáng ra nên tồn tại thì thuộc phần
   rủi ro của `audit.md`, không thuộc phần rule.
3. Mỗi rule phải có ít nhất một cửa còn mở được viết ra, hoặc một lập luận vì sao nó kín. Viết
   "không có" cho gọn là điều bị cấm ở đây: một cửa mở không ai biết nguy hiểm hơn một luật không có
   rule nào, vì luật không có rule thì ai cũng biết là không được giữ, còn rule rò rỉ thì ai cũng
   tin là đã kín.
4. Cả hai rule đều ở mức `error`, `schema: []`, không có lựa chọn cấu hình và không có bản vá tự
   động.
5. Xanh cả hai rule là một phát biểu về **tên gọi và vị trí**, không bao giờ là phát biểu về giá trị
   mà một lời gọi mang theo.

## Ngoại lệ

Ba miễn trừ nằm trong nguồn, mỗi miễn trừ chỉ thuộc về **một** rule.

- **Tệp cài đặt của một mắt xích** được miễn khỏi rule chuỗi. Tệp nằm trực tiếp trong `links/` định
  nghĩa **một** mắt xích; dựng mắt xích cuối cùng chính là việc của nó, và gắn mắt xích ngôn ngữ vào
  trong đó là một chuỗi trốn bên trong một mắt xích. Miễn trừ này được tìm ra bằng cách **chạy thật**
  chứ không phải bằng cách nghĩ: bản đầu tiên báo lỗi một tệp đã làm đúng mọi thứ, và một rule không
  có cách nào thoả mãn đúng là một phát hiện về chính rule đó.
- **Tệp spec hoặc test** được miễn khỏi rule chuỗi, vì nó khẳng định *về* một chuỗi chứ không *là*
  một chuỗi.
- **Tệp mắt xích ngôn ngữ** được miễn khỏi rule header, nhận diện bằng đường dẫn chứ không bằng nội
  dung, vì điều rule đó muốn giữ chính là "chỉ một chỗ có tên được viết header".
