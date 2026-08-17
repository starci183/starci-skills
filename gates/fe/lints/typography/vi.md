---
title: Typography · Vietnamese
---

# Chữ và thứ bậc

Đầu vào là mã đã viết xong — một tệp, một mảnh diff. Đầu ra là một **phán quyết**: tệp có nằm trong
phạm vi hay không, luật máy nào đã nổ, nó báo thông điệp nào và trên nút nào, thông điệp đó ứng với mã
luật nào, và cái lối thoát còn mở nào lẽ ra đã che đúng lỗi ấy. Mô-đun này không chọn thang chữ nào
cả. Nó từ chối một cách viết, và nó phải chỉ tay được vào đúng cái thẻ mà nó từ chối.

## Luật

Chữ mang **thứ bậc**, và một tiêu đề không phải một cỡ đứng cạnh một độ đậm — nó là một **bậc**, và
bậc đó quyết định cả cái thẻ mà trình đọc màn hình dựng dàn ý, lẫn cái cỡ mà người đọc nhìn thấy. Phần
lớn luật này là một **tập đóng** nằm trên hai thành phần chữ, và tập đóng thì không cần lint: hệ thống
kiểu đã từ chối bậc thứ năm, đã từ chối một độ đậm đẩy thêm lên tiêu đề.

Thứ mà không kiểu nào nhìn thấy là một **thẻ tiêu đề viết tay**. Một tệp không hề nhắc tới thành phần
tiêu đề, chỉ viết `<h2 className="text-2xl font-bold">`, thì kiểm kiểu xanh sạch — trong khi vừa thêm
một dòng vào dàn ý mà thang chữ chưa bao giờ cho phép.

Luật công bố **chín** mã. **Hai mã có luật máy, và một luật máy giữ cả hai.** Bảy mã còn lại được công
bố, được lập luận, nhưng không có máy nào giữ. Tài liệu này không chép lại luật; nó ghi **mức thực
thi**: với một luật máy đã xuất bản, đúng những cú pháp nó canh, và — phần chẳng ai chịu viết ra —
những cách viết cùng một lỗi mà nó hoàn toàn không canh.

## Luật máy đã xuất bản

| Luật | Mã | Bắt gì |
|---|---|---|
| `no-heading-tag-outside-heading-component` | `TYPESET-1` (thông điệp `tag`) và `TYPESET-2` (thông điệp `tooDeep`) | Một thẻ `h1`–`h6` viết thường, mở ra trong tệp nguồn không phải tệp kiểm thử và không phải chiếc lá tiêu đề. `h1`–`h4` báo `tag`; `h5`–`h6` báo `tooDeep`. |

Một luật, hai mã, hai thông điệp. Ánh xạ này không bịa ra ở đây: câu chữ của `tag` bảo người gọi hãy
dựng thành phần tiêu đề với một bậc, đúng nguyên văn `TYPESET-1`; còn `tooDeep` nói thang dừng ở bốn
và phần nội dung đã lồng quá sâu, đúng nguyên văn `TYPESET-2`. Chỗ rẽ nhánh nằm ngay trong một `create`
duy nhất, tại `Number(tag.slice(1)) > 4`.

Bảy trên chín mã luật **không có luật máy nào** trong mô-đun này. `TYPESET-3` (thứ bậc không bao giờ
lấy từ một cái hộp), `TYPESET-4` (làm dịu hàng xóm), `TYPESET-5` (dòng phụ xếp dưới tiêu đề của nó),
`TYPESET-6` (không đặt độ đậm lên tiêu đề), `TYPESET-7` (bậc nhỏ luôn phải nhạt), `TYPESET-8` (dấu mốc
thời gian là một phụ đề) và `TYPESET-9` (thứ bậc tiêu đề thân bài đi theo quyền sở hữu nội dung) là
**không được thực thi**, chứ không phải đã được phủ. Một phần trong đó do các tập đóng và cặp kiểu trên
hai thành phần chữ giữ; còn `TYPESET-3`, `TYPESET-4`, `TYPESET-5`, `TYPESET-8` và `TYPESET-9` đòi hiểu
một dòng chữ có nghĩa gì so với dòng bên cạnh, thứ mà lint không nhìn thấy. Một lần chạy xanh không nói
được gì về bảy mã ấy.

## Đọc một diff

1. **Quyết phạm vi trước mọi thứ khác, và ghi lại.** Ngoài phạm vi ở đây không có nghĩa là tệp đã sạch
   — nghĩa là cổng tệp trả về object rỗng và luật **không tồn tại** cho tệp đó.
2. **Chạy ba phép thử của cổng theo đúng thứ tự.** Đường dẫn đã chuẩn hoá phải chứa đoạn `/src/`;
   **không** được khớp `/\.(?:test|spec)\.(?:ts|tsx)$/`; và **không** được chứa
   `/src/components/leaves/Heading/`. Trượt một phép thử là tắt luật hoàn toàn.
3. **Đọc tên phần tử, đừng đọc thuộc tính.** Chỉ một `JSXIdentifier` có `name` bằng đúng dạng
   `toLowerCase()` của chính nó mới được coi là thẻ; mọi hình dạng phần tử khác trả `null` trước khi
   tập thẻ tiêu đề được hỏi tới.
4. **Mỗi phát hiện một khối**, nêu rõ nhánh đã chọn thông điệp nào — `tag` khi dưới hằng `4`,
   `tooDeep` khi trên.
5. **Viết dòng `hatch`** mỗi khi có một lối thoát còn mở lẽ ra đã che đúng lỗi ấy, kể cả trên một tệp
   chẳng báo gì.
6. **Đừng báo thứ không luật nào canh.** Bảy trên chín mã không có máy; một phán quyết nói khác đi là
   nói sai về mô-đun.

## `no-heading-tag-outside-heading-component` — TYPESET-1, TYPESET-2

**Nó báo cái gì.** Một thẻ tiêu đề nội tại — `h1`, `h2`, `h3`, `h4`, `h5`, `h6` — được mở ra bằng tay
ở một tệp nguồn bất kỳ, trừ tệp kiểm thử và trừ thư mục chiếc lá tiêu đề. `h1`–`h4` báo `tag`, kèm
theo thẻ và bậc, ứng với `TYPESET-1`. `h5`–`h6` báo `tooDeep`, kèm theo thẻ và bậc sâu nhất, ứng với
`TYPESET-2`: thang dừng ở bốn, nên bậc thứ năm không phải chuyện cỡ chữ mà là chuyện **cấu trúc**. Mỗi
phần tử vi phạm một lần báo.

**Nó phát hiện bằng gì.** Cổng tệp chạy **một lần** trong `create`: lấy `context.filename` (dự phòng
`context.getFilename()`), đổi hết dấu chéo ngược thành chéo xuôi, rồi ba phép thử nói trên. Qua được
cổng thì có đúng một visitor, `JSXOpeningElement`. Lấy tên thẻ đòi `node.name` phải tồn tại và có
`type === "JSXIdentifier"`; chuỗi `name` chỉ được trả về khi nó bằng đúng dạng `toLowerCase()` của
chính nó, còn lại trả `null` — đây là toàn bộ phép phân biệt "thẻ nội tại" với "thành phần". Tên lấy
được phải nằm trong tập `h1 h2 h3 h4 h5 h6`. Nhánh là `Number(tag.slice(1))` so với hằng `4`. Không
thuộc tính nào được đọc, không câu nhập nào được lần theo, không kiểu nào được hỏi.

**Nó không thấy gì.** Thẻ động — `const Tag = "h2"` rồi `<Tag>{title}</Tag>` — vì `"Tag"` không bằng
`"tag"` nên phép thử nội tại trả `null`; viết hoa là **cách duy nhất** để dùng một thẻ nội tại tính
được trong JSX, nên thành ngữ chuẩn để đổi bậc tiêu đề theo biến rơi đúng vào điểm mù. `createElement("h2", …)`
không sinh nút JSX nào, và mọi nhà máy hay bộ dựng nhận tên thẻ làm tham số cũng vậy. Một tiêu đề nằm
trong chuỗi — `dangerouslySetInnerHTML={{ __html: "<h2>…</h2>" }}` — chỉ là một `Literal`. Một đường
ống markdown hay MDX biến `## Tiêu đề` thành `h2` lúc build mà không tệp nào bị lint có thẻ tiêu đề nào.
`<Tags.h2>` là `JSXMemberExpression` nên bộ lấy tên trả `null`, và một object không gian tên chứa các
thẻ nội tại rửa sạch cả sáu thẻ một lượt. `<div role="heading" aria-level="2">` tạo ra đúng dòng dàn ý
mà luật đang nói tới, nhưng với luật lint thì đó chỉ là một cái hộp bình thường. Và cái tiêu đề dựng
tay ở mức to vừa phải — `<div className="text-lg font-semibold">` dùng làm tiêu đề phần nội dung —
không có thẻ để luật này bắt, cũng không đủ cỡ to cộng độ đậm nặng để luật sinh đôi ở mô-đun khác bắt,
nên nó đi qua cả hai.

**Ranh giới.** Luật này đòi một **thẻ**. Tiêu đề lắp từ một cỡ to cộng một độ đậm nặng là luật sinh
đôi nằm ở mô-đun luật khác, và được ghi ở kệ của mô-đun đó. Hai luật cộng lại phủ được "đúng thẻ, sai
dáng" và "đúng dáng, không thẻ"; khe giữa chúng là cái hộp to vừa phải, và khe đó chính là nơi cái lỗi
tiếp theo được viết ra.

## Cách phát hiện

| Bộ phận | Cơ chế |
|---|---|
| chuẩn hoá dấu phân cách | `context.filename` (dự phòng `context.getFilename()`), đổi hết dấu chéo ngược thành chéo xuôi, nên một đường dẫn Windows quyết định y hệt |
| đoạn phạm vi | đường dẫn phải chứa đoạn `/src/` |
| loại trừ tệp kiểm thử | đường dẫn **không** được khớp `/\.(?:test\|spec)\.(?:ts\|tsx)$/` |
| loại trừ chiếc lá | đường dẫn **không** được chứa `/src/components/leaves/Heading/` |
| ngoài phạm vi | trượt một trong ba phép thử là trả về object rỗng, tức là luật không hề được lắp cho tệp đó |
| bộ duyệt | đúng một visitor, `JSXOpeningElement`, trên mọi nút loại đó trong tệp bất kể nằm ở đâu trong cây |
| bộ đọc | `node.name` phải tồn tại với `type === "JSXIdentifier"`; `name` chỉ được trả về khi bằng đúng dạng `toLowerCase()` của chính nó, còn lại trả `null` |
| phép khớp | tên trả về phải nằm trong tập `h1 h2 h3 h4 h5 h6` |
| nhánh | `Number(tag.slice(1))` so với hằng `4`; lớn hơn thì báo `tooDeep` kèm thẻ và bậc sâu nhất, còn lại báo `tag` kèm thẻ và bậc |
| với ra ngoài tệp | không có. Không module nào được phân giải, không kiểu nào được hỏi, không mã nào chạy, và không thuộc tính nào của phần tử bị báo được đọc |

## Lối thoát hợp lệ

**Đã đóng** — người đọc có thể tưởng những cách viết này lọt được, nhưng không.

| Viết kiểu này | Vì sao vẫn nổ |
|---|---|
| Một đường dẫn dạng Windows đi vào cổng | Mọi tên tệp đều được chuẩn hoá về dấu chéo xuôi trước ba phép thử, nên cổng xử sự như nhau trên cả hai nền |
| `<h2 />`, hay một thẻ tiêu đề không thuộc tính nào | Luật chỉ đọc tên thẻ. Không có className nào để bỏ, không có thuộc tính nào để nấp sau, và một phần tử tự đóng thì vẫn là một phần tử được mở |
| `<h2 {...props}>` hay `<h2 className={cx(...)}>` | Thuộc tính không bao giờ được duyệt. Trải, tính hay xoá danh sách lớp chẳng đổi được thứ luật nhìn thấy |
| Một lớp bọc một dòng: `const H2 = (props) => <h2 {...props} />` | Cái thẻ vẫn còn đó, trong một tệp nguồn không phải kiểm thử cũng không phải chiếc lá, nên nó báo **ngay tại lớp bọc**. Các chỗ gọi thì im, lớp bọc thì không |
| Viết `<h5>` hay `<h6>` với hy vọng đầu sâu không ai canh | Mọi thẻ trong tập đều báo; hai thẻ sâu hơn chỉ mang một thông điệp khác. Không có độ sâu nào luật dừng lại |
| Một thẻ tiêu đề nằm trong toán tử ba ngôi, trong callback `.map`, trong fragment, hay trong một hàm render lồng cùng tệp | Mọi `JSXOpeningElement` trong tệp đều được thăm bất kể nằm ở đâu. Vị trí trong cây không phải một phần của phép thử |
| Đặt tên một tệp là `Heading.tsx` ở chỗ khác rồi mong được miễn trừ | Miễn trừ là một **đoạn đường dẫn**, `/src/components/leaves/Heading/`. Một tệp chỉ tình cờ tên Heading, hay một thư mục tên `Headings`, vẫn bị lint như mọi tệp khác |
| Một fixture trong tệp story, hay một thành phần nằm dưới `__tests__/` | Miễn trừ kiểm thử là phép so hậu tố `.test.` hoặc `.spec.` cộng `.ts`/`.tsx`. Không có gì khác được miễn chỉ vì đứng cạnh kiểm thử |
| Một host lint cũ chỉ có `getFilename()` | Cổng đọc `context.filename` với lời gọi đó làm dự phòng, nên phép thử tệp không âm thầm thành chuỗi rỗng rồi tự tắt chính nó |

**Còn mở** — chỗ mù đã xuất xưởng. Một phán quyết không được phép nói rằng những chỗ này đã bị xét.

| Phạm vi | Cái gì lọt |
|---|---|
| `no-heading-tag-outside-heading-component` | **Thẻ động.** `const Tag = "h2"` rồi `<Tag>{title}</Tag>`. Tên là `JSXIdentifier`, nhưng `"Tag" !== "tag"`, nên phép thử nội tại trả `null` và luật không hề thấy tiêu đề nào. Đây là lối thoát rộng nhất trên kệ này, và nó không phải phá hoại: viết hoa là **cách duy nhất** để dùng một thẻ nội tại tính được trong JSX, nên thành ngữ chuẩn để đổi bậc tiêu đề theo biến rơi đúng vào điểm mù |
| `no-heading-tag-outside-heading-component` | **`createElement("h2", …)`.** Không nút JSX nào tồn tại nên không visitor nào nổ. Mọi nhà máy, mọi bộ dựng nhận tên thẻ làm tham số, và mọi mã sinh tự động bỏ qua dạng JSX đều thế |
| `no-heading-tag-outside-heading-component` | **Một tiêu đề nằm trong chuỗi.** `dangerouslySetInnerHTML={{ __html: "<h2>…</h2>" }}`, một mảnh HTML lưu trong nội dung, hay markup trả về từ một tagged template. Đó là một `Literal`, không bao giờ là `JSXOpeningElement` |
| `no-heading-tag-outside-heading-component` | **Một đường ống markdown hay MDX.** `## Tiêu đề` biến thành `h2` lúc build và hiện lên trong dàn ý, mà không tệp nào bị lint có thẻ tiêu đề. Cả họ tài liệu nằm ngoài luật ngay từ cách dựng |
| `no-heading-tag-outside-heading-component` | **Mọi thứ ngoài đoạn đường dẫn `/src/`.** Một thư mục route, một app tài liệu, một thư mục package hay một workspace anh em đều không bị lint; một thẻ tiêu đề viết ở đó là hợp lệ và vẫn hiện trên cùng trang |
| `no-heading-tag-outside-heading-component` | **Miễn trừ kiểm thử chỉ là một cái tên, không ghép với gì cả.** Mọi tệp kết thúc bằng `.test.tsx` hay `.spec.tsx`, ở bất kỳ đâu trong cây, đều được viết thẻ tiêu đề tuỳ ý vì bất kỳ lý do gì. Trường hợp được lập luận là một bài kiểm thử sinh đôi khẳng định trên markup tiêu đề; trường hợp được cấp là mọi tệp kiểm thử trong kho |
| `no-heading-tag-outside-heading-component` | **Cổng chiếc lá là phép so chuỗi con, không phải danh tính tệp.** Mọi đường dẫn chứa `/src/components/leaves/Heading/` đều được miễn: mọi tệp phụ, mọi thư mục con, mọi tệp tương lai dưới thư mục đó, và một thư mục thứ hai cùng hình dạng ở bất kỳ đâu khác — kể cả trong một workspace khác tình cờ dùng chung cấu hình lint |
| `no-heading-tag-outside-heading-component` | **`<Tags.h2>` và mọi member expression.** `node.name.type` là `JSXMemberExpression`, nên bộ lấy tên trả `null` trước khi tập thẻ được hỏi tới. Một object không gian tên chứa các thẻ nội tại rửa sạch cả sáu thẻ một lượt |
| `no-heading-tag-outside-heading-component` | **`TYPESET-2` đối với chính thành phần tiêu đề.** Thông điệp độ sâu chỉ tồn tại cho thẻ viết tay. Một bậc bị đẩy quá bốn qua một biến bị nới kiểu hay một phép ép kiểu là chuyện của tập đóng, và một khi tập đóng đã bị vô hiệu thì không còn ai canh nữa |
| `no-heading-tag-outside-heading-component` | **Tiêu đề dựng tay ở mức to vừa phải.** Luật này đòi một cái thẻ; luật sinh đôi ở mô-đun khác đòi một cỡ to **cộng** một độ đậm nặng đi cùng nhau. Một `<div className="text-lg font-semibold">` dùng làm tiêu đề phần nội dung thì không có cái nào, nên đó là một tiêu đề không có dòng dàn ý mà cả hai luật đều cho qua. Đây là khe giữa hai luật, và khe đó chính là nơi cái lỗi tiếp theo được viết ra |
| `no-heading-tag-outside-heading-component` | **Một tiêu đề khai bằng ARIA.** `<div role="heading" aria-level="2">` tạo ra đúng dòng dàn ý mà luật đang nói tới, không chứa thẻ tiêu đề nào, và với luật lint thì chỉ là một cái hộp bình thường |
| `no-heading-tag-outside-heading-component` | **Một thành phần tiêu đề thứ hai.** Vì miễn trừ là một hình dạng đường dẫn chứ không phải một module có tên, một thư mục mới đặt đúng đường dẫn đó nhận trọn quyền tự do của chiếc lá, và tiền đề của luật — rằng **một** thành phần sở hữu cả thẻ lẫn cỡ — bị vô hiệu chỉ bằng cách tạo thư mục |
| không luật nào | **Tất cả những gì `TYPESET-3`, `TYPESET-4`, `TYPESET-5`, `TYPESET-6`, `TYPESET-7`, `TYPESET-8` và `TYPESET-9` cấm** — thứ bậc lấy từ một cái hộp, hàng xóm để nguyên to ngang tiêu đề, một dòng phụ xếp trên thứ mà nó thuộc về, một độ đậm đẩy lên tiêu đề, một bậc nhỏ không được làm nhạt, một dấu mốc thời gian bị đẩy khỏi vị trí phụ đề, một tiêu đề thân bài có thứ bậc không đi theo quyền sở hữu nội dung |

Dòng cuối cùng chính là bản tổng kết trung thực: trong chín mã, hai mã được giữ, và cả hai đều do một
luật thuần cú pháp giữ — thứ mà một biến viết hoa duy nhất là đủ vô hiệu.

## Đầu vào

| Đầu vào | Bằng chứng cần có |
|---|---|
| đường dẫn tệp | `context.filename`, hoặc `context.getFilename()`, chuẩn hoá về dấu chéo xuôi |
| đoạn phạm vi | chuỗi `/src/` xuất hiện ở bất kỳ đâu trong đường dẫn đó |
| đoạn miễn trừ | chuỗi `/src/components/leaves/Heading/` xuất hiện ở bất kỳ đâu trong đường dẫn đó |
| hậu tố kiểm thử | đường dẫn kết thúc bằng `.test.ts`, `.test.tsx`, `.spec.ts` hay `.spec.tsx` |
| tên phần tử | `name` của một `JSXIdentifier` trên một `JSXOpeningElement`, bằng đúng dạng viết thường của chính nó |
| bậc | `Number` của ký tự thứ hai trong tên thẻ, so với hằng `4` |

## Quy tắc

1. Danh tính của luật là **tên công bố**; ở đây không đặt số cho nó.
2. Phát hiện thuần cú pháp. Không module nào được phân giải, không kiểu nào được hỏi, không mã nào
   chạy, và không thuộc tính nào của phần tử bị báo được đọc.
3. Cổng tệp chạy một lần, trong `create`. Một tệp ngoài phạm vi không nhận được một luật im lặng — nó
   không nhận được luật nào cả.
4. Chỉ một `JSXIdentifier` **viết thường** mới được coi là thẻ. Mọi hình dạng phần tử khác trả `null`
   trước khi tập thẻ tiêu đề được hỏi tới.
5. Sáu thẻ tiêu đề chia làm hai nhánh tại hằng `4`, và hai nhánh nói hai chuyện khác nhau: một chuyện
   về quyền sở hữu, một chuyện về cấu trúc.
6. Một cổng đường dẫn là phép so chuỗi con, nên nó gọi tên một **hình dạng** đường dẫn chứ không phải
   một tệp duy nhất.
7. Các ngoại lệ đóng theo **tệp**, không theo giá trị: chiếc lá và các tệp kiểm thử được miễn trọn
   gói, và đó là dạng miễn trừ yếu hơn so với cặp tệp-cộng-giá-trị.
8. Bảng "Còn mở" là danh sách **chỗ mù**, không phải danh sách cách viết được phép.
9. Mức nghiêm trọng mà mô-đun tự đề nghị là `error`; cấu hình bên tiêu thụ vẫn là bên có thẩm quyền
   quyết định thứ thực sự được bật.

## Ngoại lệ

Mọi ngoại lệ ở đây đều đóng theo **tệp** chứ không theo cặp tệp-cộng-giá-trị. Đó là dạng yếu hơn, và
phải được đọc đúng như vậy.

- **Chiếc lá tiêu đề** được miễn vì đây là nơi duy nhất mà thẻ và cỡ được quyết cùng một lúc, nên nó
  phải được quyền viết thẻ. Miễn trừ cấp cho đoạn đường dẫn `/src/components/leaves/Heading/`, nên nó
  giải phóng mọi thứ nằm dưới đoạn đó.
- **Tệp kiểm thử** được miễn vì một bài kiểm thử sinh đôi có thể dựng markup tiêu đề bằng tay để khẳng
  định điều gì đó về nó. Miễn trừ cấp cho hậu tố tên tệp — `.test.ts`, `.test.tsx`, `.spec.ts`,
  `.spec.tsx` — nên nó giải phóng mọi tệp kiểm thử trong kho.
- **Mọi thứ ngoài `/src/`** hoàn toàn không được xét. Đây không phải một ân huệ mà là một quyết định
  phạm vi, và nó là cách rộng nhất để bỏ luật lại phía sau.
- **Không có ngoại lệ thứ ba.** Không thuộc tính nào, không prop nào, không dòng chú thích nào tắt
  được luật từ bên trong một tệp đã nằm trong phạm vi.

## Đầu ra

Mỗi phát hiện một khối:

```text
rule:    no-heading-tag-outside-heading-component
file:    <path as the gate saw it, forward slashes>
node:    JSXOpeningElement
tag:     <h1 | h2 | h3 | h4 | h5 | h6>
level:   <1 | 2 | 3 | 4>            # present on `tag` only
deepest: 4                          # present on `tooDeep` only
message: <tag | tooDeep>
```

Một tệp sạch nằm trong phạm vi phát ra một khối với `message: none` cùng dòng `hatch` nói rõ lối thoát
còn mở nào lẽ ra đã che được một lỗi, hoặc `hatch: none`. Một tệp ngoài phạm vi phát ra một khối với
`message: none` cùng phép thử cổng đã loại nó, bởi ngoài phạm vi là **chưa được xét**, không phải sạch.

## Ví dụ đã giải

**Đầu vào.** `src/components/blocks/order/OrderSummary/index.tsx`:

```tsx
export function OrderSummary({title, notes}) {
  return (
    <section>
      <h2 className="text-2xl font-bold">{title}</h2>
      <h5>{notes}</h5>
    </section>
  )
}
```

Đường dẫn chứa `/src/`, không phải tệp kiểm thử, không nằm dưới chiếc lá tiêu đề, nên cổng lắp luật.
Hai nút `JSXOpeningElement` mang một `JSXIdentifier` viết thường nằm trong tập thẻ tiêu đề.

```text
rule:    no-heading-tag-outside-heading-component
file:    src/components/blocks/order/OrderSummary/index.tsx
node:    JSXOpeningElement
tag:     h2
level:   2
message: tag
```

```text
rule:    no-heading-tag-outside-heading-component
file:    src/components/blocks/order/OrderSummary/index.tsx
node:    JSXOpeningElement
deepest: 4
tag:     h5
message: tooDeep
```

Cái `className` không hề được đọc; chính cái thẻ mới làm luật nổ. Phát hiện thứ hai không nói chuyện
cỡ chữ chút nào — thang dừng ở bốn, nên phần ghi chú phải được làm phẳng ra khỏi bậc thứ năm trước đã,
rồi mới nói tới chuyện đặt tiêu đề.

**Đã sửa.** Thành phần tiêu đề sở hữu cả thẻ lẫn bậc trong một prop duy nhất, còn phần ghi chú tụt
xuống thành một dòng thân bài trong một phần đã làm phẳng:

```tsx
import {Heading} from "@/components/leaves/Heading"

export function OrderSummary({title, notes}) {
  return (
    <section>
      <Heading level={2}>{title}</Heading>
      <p>{notes}</p>
    </section>
  )
}
```

Nhưng đúng lỗi ấy sống sót qua một lần tái cấu trúc bình thường. Một tệp anh em viết bậc thành biến:

```tsx
const Tag = depth > 1 ? "h3" : "h2"
return <Tag className="text-2xl font-bold">{title}</Tag>
```

```text
rule:    no-heading-tag-outside-heading-component
file:    src/components/blocks/order/OrderHeading/index.tsx
node:    JSXOpeningElement
tag:     Tag
message: none
hatch:   the dynamic tag — `"Tag" !== "tag"`, so the intrinsic test returns null and the rule never sees a heading; the outline entry is unjudged, not compliant
```

## Phạm vi

Mô-đun này ghi lại đúng một luật mà mô-đun luật của typography công bố, xuất xưởng trong
`@starci/eslint-canon-fe`. Nó không ghi luật nào "đáng lẽ nên có": một luật không chỉ tay được vào đâu
thì chỉ là một đề xuất, không phải mức thực thi. Luật sinh đôi bắt tiêu đề lắp từ các lớp chữ thuộc về
một mô-đun luật khác và được ghi ở kệ của mô-đun đó. Các tập đóng và cặp kiểu trên hai thành phần chữ
là chuyện của hệ thống kiểu, không phải của mô-đun này.
