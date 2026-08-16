---
id: fe-lints-naming-audit
title: audit.md
slug: /fe/lints/naming/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện xem ba quy tắc đặt tên có giữ được đúng phần luật mà người ta tin là chúng giữ.
---

# audit.md

> Version: `2.00` · Module: `naming`

Phản biện này không hỏi luật có đúng không — luật nằm ở tài liệu khác. Nó hỏi một câu duy nhất: **cái
mà mọi người tin là máy đang giữ có bằng cái máy thật sự giữ không?**

## Verdict

Chấp nhận, kèm điều kiện: mô-đun chỉ được đọc **cùng với** bảng cửa còn mở. Ba quy tắc đều chính xác
trong phạm vi của mình và không quy tắc nào bắt bừa ngoài phạm vi đó, nhưng phạm vi hẹp hơn hẳn cái
tên của chúng gợi ra. Đọc riêng `INDEX.md` mục `## Rules` sẽ dẫn tới kết luận sai rằng ba mã luật đã
được giữ kín.

**Đếm quy tắc.** Tệp nguồn công bố **đúng ba** quy tắc trong đối tượng `rules`: `prefer-arrow-export`,
`handler-on-prefix`, `no-second-language-in-path`. Con số này khớp với con số dự kiến. Nhưng khối chú
thích ở đầu tệp vẫn viết như thể chỉ có **hai**: nó nói "Neither rule" và "Both rules here", và mô tả
đúng hai mã `NAMING-1`, `NAMING-2`. Tin theo **tệp**, không tin theo chú thích: ba quy tắc.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| Mỗi quy tắc có ánh xạ được vào đúng một mã luật không | Được — ba quy tắc, ba mã, một-một, không quy tắc nào không có mã |
| Mỗi mã luật có quy tắc giữ không | Có, nhưng **không kín**: mỗi mã chỉ được giữ ở một lát cắt của nó |
| Danh tính quy tắc có mơ hồ không | Không — danh tính là **tên công bố**, không mã số nào được đặt thêm |
| Hai quy tắc có cùng bắt một lỗi không | Không — hình dạng khai báo và cái tên là hai trục rời nhau |
| Thông báo có nêu cách viết thay thế không | Có ở cả ba; cả ba đều viết sẵn chuỗi thay thế chứ không chỉ nêu lỗi |
| Có quy tắc nào cần thông tin kiểu không | Không — cả ba chạy được trên cây cú pháp thuần |
| Có quy tắc nào bắt nhầm không | Có hai: danh từ nghiệp vụ `handle`, và đường dẫn tuyệt đối nằm ngoài kho mã |
| `recommended` có khớp `meta.type` không | Không khớp về phân loại: hai quy tắc khai `suggestion`, một khai `problem`, nhưng `recommended` đặt cả ba ở mức `error` |

## Findings

1. **Chú thích đầu tệp đã lạc hậu.** Nó mô tả một tệp hai quy tắc, trong khi tệp công bố ba. Một
   người đọc chú thích trước khi đọc mã sẽ không biết `NAMING-3` tồn tại. Đây là dạng sai lệch tệ
   nhất trong một tệp luật: nó **đúng vào lúc viết** nên không ai nghi ngờ.
2. **Chú thích mô tả đối tượng `rules` bị mồ côi.** Nó đứng ngay
   **trên** dải phân cách `NAMING-3` chứ không đứng trên đối tượng `rules` mà nó mô tả — dấu vết của
   lần chèn quy tắc thứ ba, và là bằng chứng vật lý cho phát hiện thứ nhất.
3. **`prefer-arrow-export` hẹp hơn tên của nó.** Nó cấm **dạng khai báo**, nó không đòi **arrow**.
   `const X = function () {}` thoả quy tắc và không thoả luật. Lập luận về hoisting thì vẫn được giữ
   trọn vẹn; chỉ có phần "một hình bóng cho mọi khai báo" là hở.
4. **Hai nghĩa vụ của luật không có quy tắc nào giữ.** Luật đòi dạng arrow một cách cụ thể, và bảng
   Forbidden còn cấm "một cái tên nói nó được dùng ở đâu". Không quy tắc nào chạm tới hai điều đó.
   Chúng nằm ở mục rủi ro dưới đây, **không** được ánh xạ thành quy tắc ở `INDEX.md`: một quy tắc
   không chỉ tay vào được là một đề xuất, không phải một quy tắc.
5. **`handler-on-prefix` chỉ phủ ba loại nút trong khi cái tên đi qua ít nhất bảy chỗ.** Tham số,
   props phá cấu trúc, thuộc tính đối tượng, phương thức lớp, trường kiểu dạng phương thức, khoá dạng
   chuỗi — tất cả đều lọt. Cửa nặng nhất là props phá cấu trúc, vì đó là **đường đi phổ biến nhất**
   của một tên hàm phản hồi.
6. **Cách viết hậu tố hoàn toàn vô hình.** `submitHandler` tạo ra đúng cái hai-từ-vựng mà `NAMING-2`
   muốn xoá, và regex neo vào tiền tố nên không thấy gì. Người nào muốn né quy tắc chỉ cần đảo thứ tự
   hai từ.
7. **`no-second-language-in-path` với tay ra ngoài kho mã.** Nó quét toàn bộ `context.filename`, kể
   cả các đoạn thư mục phía trên gốc kho. Một bản làm việc đặt dưới một thư mục có dấu làm **mọi tệp**
   báo lỗi ở một đoạn không ai trong kho sửa được. Đây là dạng bắt nhầm khiến người ta tắt quy tắc, và
   khi tắt thì mất luôn phần quy tắc làm đúng.
8. **Danh sách phiên âm hai mươi phần tử là một lựa chọn có lý và được ghi rõ lý do trong nguồn.**
   Đây **không** phải một khiếm khuyết: đoán theo hình dạng sẽ từ chối `capacity` và `dangerous`, và
   một quy tắc bắt nhầm từ của ngôn ngữ chung là quy tắc bị tắt. Nhưng nó cần được đọc như **một
   danh sách chặn**, không phải một phép kiểm ngôn ngữ.
9. **Không quy tắc nào khai `fixable`.** Cả `NAMING-1` lẫn `NAMING-2` đều sửa máy được. Nguồn nói rõ
   đây là chủ ý: sửa tay mất vài giây, và một kho đang nợ nên trả dần thay vì sống ở mức `warn`. Ghi
   lại như một quyết định, không phải một thiếu sót.
10. **`meta.type` không đồng nhất.** Hai quy tắc khai `suggestion`, một khai `problem`, trong khi
    `recommended` đặt cả ba ở `error`. Không gây hậu quả vận hành vì cấu hình của kho tiêu thụ mới là
    quyền quyết định thật, nhưng nó làm phân loại mất nghĩa.

## Decisions

- Tài liệu hoá **đúng ba** quy tắc có thật trong tệp nguồn. Không quy tắc nào được bịa thêm cho đẹp
  bảng ánh xạ.
- Lấy **tên công bố** làm danh tính. Không đặt mã số cho quy tắc; đặt thêm là tạo ra một quy tắc hai
  tên và không ai biết thông báo đến từ tên nào.
- Giữ nguyên chính tả của mọi định danh, kể cả khi nó chứa một từ gắn với sản phẩm, vì đó là chuỗi mà
  bản build in ra. Lệnh cấm tên sản phẩm áp cho **văn xuôi và ví dụ**, không áp cho định danh.
- Coi bảng **Open** ở `INDEX.md` là phần bắt buộc của mô-đun. Không dòng nào được ghi "không có" cho
  gọn bảng.
- Không đề xuất quy tắc mới ở đây. Mọi khoảng trống nằm ở mục rủi ro dưới đây, kèm cái mà một quy tắc
  sẽ phải soi để đóng được nó.

## Rủi ro còn mở

Mỗi dòng: cửa còn mở, rồi **cái mà quy tắc phải soi để đóng nó** — hoặc lý do đóng đắt hơn để mở.

**`prefer-arrow-export`**

- **Khai báo lồng trong một khối.** Đóng được: bỏ hẳn bộ lọc theo loại cha, bắt mọi
  `FunctionDeclaration` ở mọi độ sâu. Rẻ về kỹ thuật, đắt về nợ: một kho đang chạy sẽ đỏ hàng loạt ở
  các callback test và các hàm phụ trợ trong hook. Đây là một quyết định phạm vi, không phải một lỗi.
- **`const X = function () {}` không phải arrow.** Đóng được: thêm một visitor
  `VariableDeclarator` kiểm `init.type === "FunctionExpression"`. Rẻ, và nó khép đúng phần luật mà tên
  quy tắc đang hứa. Đây là khoảng trống đáng đóng nhất của mô-đun.
- **`export default` một arrow không tên.** Đóng được: một visitor `ExportDefaultDeclaration` kiểm
  `declaration.type === "ArrowFunctionExpression"`. Mối lo "không có tên để grep" nằm trong luật và
  hiện không ai giữ.
- **`declare function` và chữ ký nạp chồng.** Không nên đóng: chúng là khai báo kiểu, không sinh mã,
  và không có dạng arrow tương đương. Ở đây im lặng là đúng.
- **Luật đòi arrow, quy tắc chỉ cấm khai báo.** Xem hai gạch đầu dòng trên; đóng cả hai thì tên quy
  tắc mới đúng với hành vi.

**`handler-on-prefix`**

- **Props phá cấu trúc.** Đóng được: duyệt `ObjectPattern` trong `id` của declarator và trong tham số
  hàm, kiểm từng `Property.value` hoặc `Property.key`. Phải cẩn thận với đổi tên
  (`{ handleClick: onClick }`) — bên nào là tên **được dùng trong thân hàm** mới là bên đáng bắt.
- **Tham số hàm.** Đóng cùng lúc với gạch trên, bằng cách thêm visitor cho tham số của
  `FunctionDeclaration`, `FunctionExpression` và `ArrowFunctionExpression`.
- **`function handleSubmit() {}`.** Đóng được và rẻ: thêm `FunctionDeclaration` vào tập visitor và
  kiểm `node.id.name`. Hiện đây là điểm mù chung của **cả hai** quy tắc trong mô-đun.
- **Thuộc tính đối tượng và phương thức lớp.** Đóng được: thêm `Property` và `MethodDefinition`, chỉ
  khi khoá là `Identifier` và không phải khoá tính toán.
- **`TSMethodSignature` và khoá dạng chuỗi.** Đóng được và gần như bắt buộc, vì đây là **cùng một ý
  nghĩa** với trường hợp đang bị bắt, chỉ khác một loại nút. Để hở nghĩa là quy tắc thưởng cho người
  đổi cách viết.
- **Cách viết hậu tố `…Handler`.** Đóng được bằng một regex thứ hai `/Handler$/`. Chi phí thật nằm ở
  chỗ khác: một kho có thể đang dùng hậu tố đó cho một khái niệm khác hẳn — một đối tượng đăng ký,
  một lớp điều phối — nên cần khảo sát trước, không thêm mù quáng.
- **Trải thuộc tính JSX.** Không đóng được bằng cây cú pháp thuần: phải truy vết giá trị được trải về
  nơi khai báo, tức là cần thông tin kiểu. Đắt hơn nhiều so với phần nó cứu được, vì tên đó gần như
  luôn còn một chỗ khai báo khác mà quy tắc **có** thể bắt.
- **Bắt nhầm danh từ `handle`.** Không đóng được: máy không phân biệt được động từ với danh từ. Cách
  sống chung đã ghi ở `INDEX.md` mục `## Exceptions` — đổi tên biến, đừng tắt quy tắc cho cả tệp.

**`no-second-language-in-path`**

- **Từ phiên âm ngoài danh sách.** Đóng được bằng cách nối thêm phần tử, và **chỉ** bằng cách đó. Mỗi
  lần một đoạn mới lọt qua là một dòng mới cho danh sách. Không đóng bằng suy đoán hình dạng: chi phí
  là bắt nhầm từ của ngôn ngữ chung, và quy tắc bắt nhầm là quy tắc bị tắt — mất trắng.
- **Tiền tố, hậu tố, dấu phân cách khác.** Đóng được: so bằng ranh giới từ trên đoạn đã tách theo
  `-`, `_` và ranh giới chữ hoa, thay vì so bằng nguyên đoạn. Chi phí rõ ràng: `dang` tách rời sẽ va
  vào `dangerous`, nên phải so **cụm nhiều từ** chứ không so từng từ. Đáng làm, nhưng là một thay đổi
  quy tắc, không phải một lần chỉnh nhỏ.
- **`[...x]` và `@x`.** Đóng được ngay: thêm `.`, `@` và `%` vào tập ký tự bị bóc.
- **Thư mục không chứa tệp được kiểm.** Không đóng được từ bên trong một quy tắc lint: quy tắc chỉ
  chạy khi có tệp để chạy. Muốn đóng thì phải là một phép kiểm ở tầng khác, quét cây thư mục — đúng
  chỗ hơn, và ngoài phạm vi mô-đun này.
- **Địa chỉ khai báo bằng chuỗi.** Đóng được một phần: một quy tắc đọc chuỗi bắt đầu bằng `/` và so
  từng đoạn với cùng danh sách. Phần khó là chặn nhiễu — một chuỗi có gạch chéo chưa chắc là một
  tuyến — nên nó xứng đáng là một quy tắc **riêng**, không phải một nhánh nhét thêm vào quy tắc này.
- **Bảng chữ của ngôn ngữ khác.** Không đóng: mở rộng ra mọi ký tự ngoài ASCII sẽ bắt cả tên riêng
  hợp lệ. Phạm vi hiện tại là **một** ngôn ngữ thứ hai, và tài liệu phải nói đúng như vậy thay vì để
  cái tên quy tắc hứa rộng hơn.
- **Chỉ báo đoạn đầu tiên.** Đóng được: đổi `.find` thành `.filter` rồi báo mỗi đoạn một lần. Chi phí
  là mỗi tệp phát nhiều thông báo cho cùng một việc phải làm; giữ nguyên cũng chấp nhận được, miễn là
  người sửa biết rằng sửa một đoạn có thể chưa hết.
- **Quét cả đường dẫn tuyệt đối ngoài kho.** Đóng được và **nên** đóng: cắt đường dẫn theo gốc kho
  trước khi tách đoạn. Đây là rủi ro duy nhất ở đây có thể khiến người ta tắt luôn quy tắc, mà tắt thì
  mất cả phần đang làm đúng.

**Nghĩa vụ của luật chưa có quy tắc nào**

- **"Một cái tên nói nó được dùng ở đâu".** Không đóng được bằng máy: phân biệt một cái tên gọi tên
  **bản thân sự vật** với một cái tên gọi tên **người gọi đầu tiên** là một phán đoán ngữ nghĩa. Đây
  là luật do người đọc lại giữ, và điều đúng đắn duy nhất cần làm là **nói ra** rằng nó chưa được giữ.

## Re-audit Triggers

- Tệp nguồn công bố thêm hoặc bớt một quy tắc, hoặc đổi một tên công bố.
- Một mã `NAMING-<n>` mới xuất hiện trong luật, hoặc một mã hiện có đổi phạm vi.
- Một dòng trong bảng **Open** được đóng lại trong nguồn — dòng đó phải chuyển sang bảng **Closed**
  cùng lúc, không để trễ một phiên bản.
- Có người tắt một quy tắc ở mức tệp hoặc mức thư mục: đó là bằng chứng bắt nhầm, và bắt nhầm là lý do
  quy tắc chết.
- Danh sách phiên âm được nối thêm phần tử.
- Xuất hiện một cách viết né quy tắc mà bảng **Open** chưa có dòng nào cho nó.
- Chú thích đầu tệp nguồn được sửa lại cho khớp số quy tắc — kiểm lại xem nó còn mô tả sai gì nữa.
