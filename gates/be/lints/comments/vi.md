---
title: Comments · Vietnamese
---

# Chú thích

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-be` | `@starci/eslint-canon-be` | npm package | bộ máy backend đã phát hành mà bản ghi này viện dẫn |


## Bản ghi

Gate này nhận mã đã viết xong — một tệp, một mảng diff. Kết quả là một **phán quyết**: tệp rơi vào làn nào,
quy tắc đã xuất bản nào nổ, nổ trên nút cú pháp hay dòng thô nào, ứng với mã luật nào, và cửa còn mở nào
lẽ ra đã che đi đúng lỗi ấy. Mô-đun này không chọn giúp một dòng chú thích nào và cũng không viết hộ. Nó
chỉ từ chối, và khi từ chối thì phải chỉ được vào đúng ký tự mà nó từ chối.

## Luật

Chú thích trả lời câu hỏi duy nhất mà mã nguồn không trả lời được: **vì sao**. Luật nói điều đó nằm ở
`canon/patterns/comments.md` và mang năm mã, từ `COMMENT-1` đến `COMMENT-5`.

Luật có năm mã. **Bộ quy tắc chỉ có ba.** Khoảng chênh đó không phải thiếu sót cần lấp cho tròn — một mã
không chương trình nào kiểm được, và một quy tắc chỉ giữ được nửa cái mã mà nó mang tên. Cả hai sự thật
đều được ghi thẳng ra thay vì làm tròn, vì **một quy tắc hở mà người ta tưởng đã kín thì nguy hiểm hơn
một luật ai cũng biết là chưa có máy giữ.** Một luật là câu mà người đọc tuân theo; một quy tắc là khuôn
mà chương trình khớp. Hai thứ không bao giờ bằng nhau, và toàn bộ nội dung ở đây chính là khoảng chênh
ấy.

## Luật máy đã xuất bản

Ba quy tắc được xuất bản, từ bản `rules` của mô-đun, ở mức `error` trong bản `recommended`. Chúng đi kèm
gói `@canon-be` dưới tiền tố trình cắm `starci-be/`.

| Quy tắc | Mã luật | Bắt gì |
|---|---|---|
| `require-export-jsdoc` | `COMMENT-1` | Một lớp, giao diện, bí danh kiểu, enum, hàm khai báo, hoặc `const` gán thẳng vào một biểu thức hàm, được xuất ra mà không có khối `/** … */` đứng trước |
| `require-enum-member-jsdoc` | `COMMENT-2`, chỉ nửa "có tồn tại" | Một thành viên của enum được xuất ra mà không có khối `/** … */` đứng trước |
| `no-non-ascii-source` | `COMMENT-4`, mang theo `COMMENT-5` làm dấu miễn | Một dòng mã nguồn mang chữ cái tiếng Việt có dấu, biểu tượng cảm xúc, hoặc một trong mười hai ký hiệu trang trí được liệt kê |

**`COMMENT-3` không có quy tắc nào giữ.** "Chú thích nói *vì sao*, mã nguồn nói *cái gì*" hiện không ai
kiểm. Đây không phải một quy tắc còn thiếu chờ viết: muốn biết một câu có đang chép lại dòng lệnh ngay
dưới nó hay không thì phải hiểu cả hai. Nó **chưa có máy giữ**, chứ không phải đã được phủ, và không ai
được đọc một bản dựng xanh thành bằng chứng rằng `COMMENT-3` đã được tuân thủ.

**`COMMENT-5` cũng không phải quy tắc; nó là cửa miễn của `no-non-ascii-source`.** Chuỗi mà chương trình
**so khớp** hoặc **phát ra** thì được giữ nguyên, kèm dấu `vn-ok`. Chính dấu đó làm quy tắc thứ ba sống
nổi, và cũng chính nó là cánh cửa rộng nhất còn mở của quy tắc ấy.

**`COMMENT-2` chỉ được giữ ở nửa sức, và thông điệp lỗi tự nói ra điều đó.** Mã luật đòi thành viên nói
ra HỆ QUẢ của việc chọn nó. Một quy tắc chỉ thấy được khối tài liệu có tồn tại, không bao giờ thấy nó nói
gì. `/** The pending state. */` — đúng câu mà luật in ra làm ví dụ phản diện — vẫn qua.

## Đọc một diff

1. **Quyết định phạm vi trước hết, và ghi lại.** Ngoài phạm vi ở đây không có nghĩa là tệp đã sạch — với
   `no-non-ascii-source`, một đường dẫn nội dung hiển thị làm quy tắc trả về bộ thăm rỗng, tức là quy tắc
   không hề tồn tại đối với tệp đó.
2. **Xếp tệp vào một làn.** Đường dẫn khớp `/(?:messages|locales|i18n)/` được miễn `no-non-ascii-source`
   trọn vẹn, kể cả chú thích. Đường dẫn khớp `\.spec\.ts$`, `-spec\.ts$` hoặc `/src/tests/` là làn dữ
   liệu thử, ở đó chỉ dòng chú thích bị soi. Còn lại là mã nguồn thường. Hai quy tắc JSDoc không đọc tên
   tệp và không có làn nào.
3. **Kiểm cửa miễn trên dòng trước khi đọc nút.** Dòng khớp `\bvn-ok\b` bị bỏ qua trọn vẹn; lần xuất hiện
   đầu tiên của chuỗi `Tiếng Việt` bị cắt trước khi thử lớp chữ cái.
4. **Đọc các nút.** Với hai quy tắc JSDoc, đó là `node.declaration`, init của `declarations[0]`, loại khai
   báo, và những gì `sourceCode.getCommentsBefore` trả về. Với `no-non-ascii-source` thì không có nút nào
   cả — nó duyệt `sourceCode.getLines()`.
5. **Mỗi phát hiện một khối phán quyết**, nêu đúng cơ chế đã quyết định.
6. **Viết dòng `hatch`** mỗi khi có một cửa còn mở lẽ ra đã che đi đúng lỗi ấy.
7. **Không báo cáo thứ không quy tắc nào canh.** `COMMENT-3` không có máy nào giữ, và nửa còn lại của
   `COMMENT-2` cũng vậy; một phán quyết nói khác đi là hiểu sai mô-đun này.

## `require-export-jsdoc` — COMMENT-1

**Nó báo cái gì.** Một thứ rời khỏi tệp mà không mở đầu bằng khối tài liệu: `class`, `interface`, `type`,
`enum`, hàm khai báo, và `const` được gán **trực tiếp** bằng một hàm mũi tên hoặc một biểu thức hàm. Cả
dạng `export` có tên lẫn `export default` đều bị soi. Nó giữ `COMMENT-1` đúng tới giới hạn mà máy nhìn
thấy: khối tài liệu **có tồn tại** hay không, chứ không phải nội dung bên trong.

**Nó phát hiện bằng gì.** Thăm `ExportNamedDeclaration` và `ExportDefaultDeclaration`. Đọc
`node.declaration`; không có thì thoát ngay. Nếu là `VariableDeclaration` thì chỉ xét
`declarations[0].init`, và **chỉ** đi tiếp khi init đó là `ArrowFunctionExpression` hoặc
`FunctionExpression`. Ngoài ra phải là một trong năm loại: `TSInterfaceDeclaration`,
`TSTypeAliasDeclaration`, `TSEnumDeclaration`, `ClassDeclaration`, `FunctionDeclaration`. Cuối cùng gọi
`sourceCode.getCommentsBefore(node)` và cho qua nếu **bất kỳ** chú thích trả về nào có `type === "Block"`
và `value` bắt đầu bằng `*`.

**Điểm mù.** Xuất lại thì tàng hình: `export { Thing }` và `export { Thing } from "./thing"`
không có `declaration` nên quy tắc thoát tức thì, còn `export * from "./thing"` thậm chí không có nút nào
được thăm — một tệp gom đầu mối có thể công bố cả một bề mặt mà không một dòng tài liệu nào. Gói hàm vào
một lời gọi là thoát: `export const run = make(1)`, `= memo(() => {})`, `= other.bind(null)`,
`= class {}` — init là `CallExpression` hoặc `ClassExpression`, nên một thứ gọi được hay dựng được bị coi
là hằng số dữ liệu. `export default () => {}` và `export default { … }` không bị báo, trong khi đúng cái
hàm mũi tên đó viết thành `export const f = () => {}` thì bị bắt — miễn trừ phụ thuộc vào HÌNH THỨC xuất,
không phụ thuộc vào thứ được xuất. Chỉ `declarations[0]` được xét, nên `export const MAX = 3, run = () =>
{}` để `run` lọt sạch, đảo thứ tự lại thì bắt. `/** */` rỗng vẫn hợp lệ, vì `value` của nó là `* `. Bất
kỳ khối tài liệu nào đứng trước cũng tính, nên một dòng tiêu đề tệp hay một khối tài liệu mồ côi còn sót
sau khi xoá khai báo cũ đều đủ làm tài liệu cho thứ ngay dưới. Chữ ký nạp chồng là `TSDeclareFunction`,
không nằm trong năm loại — tài liệu bị đòi ở phần cài đặt, đúng cái chữ ký mà người gọi không bao giờ
đọc, và một tệp toàn chữ ký thì im lặng hoàn toàn. Một phương thức công khai trên một lớp đã có tài liệu
nằm ngoài tầm, dù tệp khác dựa vào nó y hệt. `export declare const CONFIG: Shape` không có init nên bị bỏ
qua. Và nội dung khối tài liệu không bao giờ được đọc: một câu chép lại cái tên vẫn xanh.

**Ranh giới.** Quy tắc này dừng ở khai báo mức đỉnh. Thành viên bên trong một enum được xuất ra là việc
của `require-enum-member-jsdoc`; còn câu chữ nói gì thì không ai xét.

## `require-enum-member-jsdoc` — COMMENT-2

**Nó báo cái gì.** Một thành viên của enum **được xuất ra** mà không có khối tài liệu riêng. Nó chỉ giữ
**nửa đầu** của `COMMENT-2`. Luật đòi thành viên nói ra hệ quả của việc chọn nó; quy tắc chỉ thấy được có
hay không có một khối tài liệu. Thông điệp lỗi tự nói ra giới hạn này thay vì giả vờ.

**Nó phát hiện bằng gì.** Thăm `TSEnumDeclaration`, thoát nếu `node.parent.type` không phải
`ExportNamedDeclaration`. Với mỗi phần tử trong `node.members`, áp đúng phép thử `getCommentsBefore` /
`Block` / mở đầu bằng `*` như quy tắc trên.

**Điểm mù.** Đúng cái nửa quan trọng hơn: `/** The pending state. */` — câu mà luật in ra làm ví
dụ phản diện — vẫn qua, vì máy đếm được khối tài liệu chứ không đọc được nó. `/** */` rỗng cũng qua. Tách
từ khoá `export` ra là tắt hẳn quy tắc: viết `enum State { … }` rồi `export { State }` ở dòng sau thì
`parent` là thân chương trình chứ không còn là nút xuất, và mọi yêu cầu với thành viên biến mất.
`export const State = { Pending: "pending" } as const` im lặng dưới **cả hai** quy tắc JSDoc — hằng số dữ
liệu với quy tắc thứ nhất, không phải `TSEnumDeclaration` với quy tắc thứ hai — mà đó lại đúng là cấu
trúc hay được dùng thay enum nhất. `export type State = "pending" | "settled"` chỉ cần một khối tài liệu
cho bí danh và không cần gì cho từng lựa chọn, nên quan hệ mà `COMMENT-2` sinh ra để bảo vệ biến mất
sạch, và bản dựng vẫn xanh.

**Ranh giới.** Khối tài liệu của chính enum là việc của `require-export-jsdoc`:
`getCommentsBefore` được gọi trên từng nút thành viên, còn tài liệu của khai báo nằm trước nút xuất, nên
nó không bao giờ được trả về cho một thành viên.

## `no-non-ascii-source` — COMMENT-4

**Nó báo cái gì.** Một **dòng** mã nguồn mang một trong ba thứ: chữ cái tiếng Việt có dấu, biểu tượng cảm
xúc, hoặc một ký hiệu trang trí nằm trong danh sách mười hai ký tự. Nó mang `COMMENT-5` không phải như
một điều kiện bắt, mà như cửa miễn: dấu `vn-ok` trên dòng nào thì dòng đó được bỏ qua.

**Nó phát hiện bằng gì.** Đọc `context.filename`, đổi dấu gạch ngược thành gạch chéo, và trả về bộ thăm
rỗng nếu đường dẫn khớp `/(?:messages|locales|i18n)/`. Tính làn dữ liệu thử từ `\.spec\.ts$`,
`-spec\.ts$` hoặc `/src/tests/`; trong làn đó nó dựng một tập số dòng từ khoảng trải của
`sourceCode.getAllComments()`. Đến `Program:exit` thì duyệt `sourceCode.getLines()` — **văn bản thô,
không phải cây cú pháp** — bỏ qua dòng khớp `\bvn-ok\b`, bỏ qua dòng không phải chú thích khi đang trong
làn, cắt lần xuất hiện đầu tiên của chuỗi `Tiếng Việt`, rồi thử ba lớp ký tự theo thứ tự: chữ cái tiếng
Việt, dải biểu tượng cảm xúc (`1F300–1FAFF`, `1F000–1F0FF`, `2600–27BF`, `FE0F`, `1F1E6–1F1FF`), và một
danh sách mười hai ký tự trang trí.

**Điểm mù.** Văn xuôi không dấu ở ngôn ngữ thứ hai: lớp ký tự khớp **dấu phụ**, nên một câu viết
không dấu không mang điểm mã nào khớp cả — quy tắc nhận diện một lối viết, không nhận diện một ngôn ngữ.
Tiếng Nga, Trung, Nhật, Hàn, Thái, Hy Lạp đều không thuộc ba lớp; luật từ chối một kho mã có hai ngôn ngữ
trong nó, còn quy tắc từ chối đúng một bảng chữ cái. Danh sách trang trí là mười hai ký tự viết tay: `⭐`
(`U+2B50`) có trong danh sách, `⭕` (`U+2B55`) thì không; mũi tên dạng biểu tượng `➡` rơi vào dải
`2600–27BF` nên bị bắt, còn `→` (`U+2192`) — cái mũi tên người ta thật sự gõ — thì không, và `⇒`, `●`,
`⬛` cùng các đoạn ký tự vẽ khung cũng nằm ngoài. Chuỗi thoát hoá thì tàng hình: `"Đặt hàng"` là
ASCII thuần trên dòng trong khi chương trình vẫn phát ra đúng văn bản đó lúc chạy, và một trình định dạng
tự thoát ký tự ngoài ASCII sinh ra cảnh này mà không ai chủ ý. Cấm theo thư mục không phải cấm theo tệp:
cùng nội dung ấy đặt ở `payment/messages.ts` thì bị soi đủ, còn dời một tệp vào thư mục `i18n/` là miễn
vĩnh viễn từng dòng của nó, chú thích cũng miễn. Làn dữ liệu thử buộc vào tên tệp, nên `foo.spec.ts` được
miễn phần chuỗi còn đúng tệp đó đổi tên thành `foo.test.ts` thì không, `__tests__/helper.ts` cũng không —
tách dữ liệu thử ra một mô-đun riêng cho gọn là biến dữ liệu vốn hợp lệ thành một bức tường lỗi. Biểu
thức của dấu miễn là `\bvn-ok\b`, không hơn: thông điệp đòi `vn-ok: <reason>` mà quy tắc không bao giờ
kiểm có lý do hay không, dấu đó miễn CẢ DÒNG nên một chuỗi nhà cung cấp hợp lệ nằm cạnh một câu lý lẽ
chưa dịch thì qua trọn vẹn, và không gì phân biệt dữ liệu với văn xuôi ngoài lời tự khai của người viết.

**Ranh giới.** Vì quy tắc này không chạm vào cây cú pháp, nó miễn nhiễm với kiểu tẩy rửa vẫn hạ gục phần
lớn quy tắc khớp chữ — gom một chuỗi vào một hằng, một mảng hay một đối tượng đều không giấu được, vì các
ký tự vẫn nằm trên một dòng nào đó, và cắt một chuỗi ra nối lại chỉ là trải nó lên nhiều dòng mà dòng nào
cũng bị quét. Cái giá của sự miễn nhiễm đó là nó không phân biệt nổi một chú thích với một định danh với
một dòng dữ liệu mồi.

## Cách phát hiện

Mọi cơ chế dưới đây đều được xác nhận bằng cách chạy quy tắc trên nguồn dựng sẵn, không suy ra từ tên
của chúng.

| Bộ phận | Cơ chế |
|---|---|
| cổng đường dẫn | Chỉ `no-non-ascii-source` đọc `context.filename`. Nó đổi gạch ngược thành gạch chéo rồi trả về bộ thăm rỗng nếu đường dẫn khớp `/(?:messages\|locales\|i18n)/` |
| tính làn | Làn dữ liệu thử là `\.spec\.ts$`, `-spec\.ts$` hoặc `/src/tests/`; trong làn, một tập số dòng được dựng từ khoảng trải của `sourceCode.getAllComments()` và dòng không phải chú thích bị bỏ qua |
| bộ duyệt | `require-export-jsdoc` thăm `ExportNamedDeclaration` và `ExportDefaultDeclaration`; `require-enum-member-jsdoc` thăm `TSEnumDeclaration` rồi duyệt `node.members`; `no-non-ascii-source` chỉ cài `Program:exit` |
| bộ đọc | Cả hai quy tắc JSDoc gọi `sourceCode.getCommentsBefore(node)` và cho qua với **bất kỳ** chú thích nào có `type === "Block"` và `value` bắt đầu bằng `*`. `no-non-ascii-source` đọc `sourceCode.getLines()` — văn bản thô, không phải cây cú pháp |
| với tay ra ngoài tệp | Không quy tắc nào làm. Không cái nào mở một mô-đun khác, phân giải một import hay tra một cấu hình; hai quy tắc JSDoc thậm chí không đọc tên tệp, nên không có cái tên nào để đổi mà lách |

## Lối thoát hợp lệ

**Đã đóng** — người đọc có thể tưởng những cách viết này lọt, nhưng không.

| Viết như thế này | Vì sao vẫn bị bắt |
|---|---|
| `// what this is for` đứng trên một thứ được xuất | `require-export-jsdoc` đòi `type === "Block"`; chú thích một dòng là `Line` và không bao giờ thoả |
| `/* what this is for */` đứng trên một thứ được xuất | `value` của khối phải bắt đầu bằng `*`; khối thường thì không |
| Đổi tên tệp để né `require-export-jsdoc` | Cả hai quy tắc JSDoc không hề đọc `context.filename`, nên không có cái tên nào để đổi |
| `export default class` / `export default function` | `ExportDefaultDeclaration` do chính bộ xử lý của dạng có tên thăm |
| Một khối tài liệu trên enum đứng thay cho các thành viên | `getCommentsBefore` được gọi trên từng nút thành viên; tài liệu của khai báo nằm trước nút xuất và không bao giờ được trả về cho một thành viên |
| Gom một chuỗi tiếng Việt vào một hằng, một mảng hay một đối tượng | `no-non-ascii-source` quét dòng thô, nên không phép biến đổi cú pháp nào dời được các ký tự ra khỏi tầm nhìn của nó |
| Cắt một chuỗi phạm luật ra rồi nối lại | Mỗi mảnh vẫn chiếm một dòng, và mỗi dòng bị quét độc lập |
| Một dòng mang `Tiếng Việt` hai lần | Phép cắt không toàn cục; chỉ lần đầu bị bỏ, lần thứ hai vẫn bị báo |

**Còn mở** — đây là chỗ mù đã xuất xưởng. Một phán quyết không được nói rằng những chỗ này đã được xét.
Không dòng nào là giả định, và không dòng nào đòi hỏi ác ý — phần lớn chính là dáng vẻ của việc dọn dẹp
cho gọn.

| Phạm vi | Cái gì lọt |
|---|---|
| `require-export-jsdoc` | `export { Thing }`, `export { Thing } from "./thing"` — không có `declaration`, thoát tức thì; `export * from "./thing"` không có nút nào được thăm |
| `require-export-jsdoc` | `export const run = make(1)`, `= memo(() => {})`, `= other.bind(null)`, `= class {}` — init là `CallExpression` hoặc `ClassExpression`, nên một bề mặt gọi được bị coi là dữ liệu |
| `require-export-jsdoc` | `export default () => {}` và `export default { … }` — miễn trừ phụ thuộc vào HÌNH THỨC xuất, không phụ thuộc vào thứ được xuất |
| `require-export-jsdoc` | `export const MAX = 3, run = () => {}` — chỉ `declarations[0]` được xét; đảo thứ tự thì bắt |
| `require-export-jsdoc` | Một dòng tiêu đề tệp, hay một khối tài liệu mồ côi, đứng làm tài liệu cho thứ được xuất ngay dưới |
| `require-export-jsdoc` | Chữ ký nạp chồng là `TSDeclareFunction`; một tệp toàn chữ ký thì im lặng hoàn toàn |
| `require-export-jsdoc` | Một phương thức công khai trên một lớp đã có tài liệu, và `export declare const CONFIG: Shape` |
| `require-enum-member-jsdoc` | `enum State { … }` rồi `export { State }` ở dòng sau — `parent` là thân chương trình và mọi yêu cầu với thành viên biến mất |
| cả hai quy tắc JSDoc | `/** */` — `value` là `* `, nên một khối tài liệu rỗng thoả cả hai |
| cả hai quy tắc JSDoc | `export const State = { Pending: "pending" } as const`, và `export type State = "pending" \| "settled"` — cấu trúc hay được dùng thay enum nhất lại đúng là cấu trúc không quy tắc nào phủ |
| cả hai quy tắc JSDoc | Một khối tài liệu chỉ chép lại cái tên. Đó là `COMMENT-3` và nửa của `COMMENT-2`, và không quy tắc nào giữ được cái nào |
| `no-non-ascii-source` | Văn xuôi không dấu ở một ngôn ngữ khác — lớp ký tự khớp dấu phụ, nên quy tắc nhận diện một lối viết, không nhận diện một ngôn ngữ |
| `no-non-ascii-source` | Văn xuôi tiếng Nga, Trung, Nhật, Hàn, Thái hay Hy Lạp — không chữ nào thuộc ba lớp |
| `no-non-ascii-source` | `→` (`U+2192`), `⇒`, `●`, `⬛`, `⭕` (`U+2B55`), các đoạn ký tự vẽ khung — danh sách trang trí là mười hai ký tự viết tay |
| `no-non-ascii-source` | `"Đặt hàng"` — dòng là ASCII thuần mà chương trình vẫn phát ra đúng văn bản đó lúc chạy |
| `no-non-ascii-source` | Bất kỳ tệp nào nằm trong thư mục tên `messages`, `locales` hay `i18n` — bộ thăm rỗng miễn cả chú thích lẫn nội dung hiển thị, vĩnh viễn |
| `no-non-ascii-source` | Đổi tên một tệp thử, và tách dữ liệu thử ra một mô-đun phụ — làn buộc vào tên tệp chứ không buộc vào mục đích |
| `no-non-ascii-source` | `// vn-ok` không kèm lý do ở bất kỳ đâu trên dòng, một dòng đã đánh dấu mà vẫn mang văn xuôi chưa dịch, và bản thân cái dấu — ranh giới của `COMMENT-5` nằm hoàn toàn ở chỗ tin nhau |
| không quy tắc nào | Mọi thứ `COMMENT-3` cấm, và nửa "hệ quả" của `COMMENT-2` |

## Đầu vào

| Đầu vào | Bằng chứng phải có |
|---|---|
| rule | Tên đã công bố, nguyên văn, đúng như bản dựng in ra |
| code | Mã `COMMENT-<n>` mà nó giữ, hoặc ghi rõ `none` |
| file | Đường dẫn đúng như `context.filename` thấy, gạch chéo xuôi |
| construct | Nút cú pháp hoặc dòng thô mà cơ chế thật sự khớp |
| lane | Đường dẫn rơi vào thư mục nội dung hiển thị, làn dữ liệu thử, hay mã nguồn thường |

## Quy tắc

1. Danh tính của một quy tắc là TÊN nó công bố. Không đặt thêm mã số cho nó.
2. Tên quy tắc chép nguyên văn, kể cả khi bên trong có tên riêng, vì đó là chuỗi mà bản dựng in ra và là
   chuỗi phải gõ đúng trong một chú thích tắt quy tắc.
3. Mọi quy tắc ghi ở đây đều đang tồn tại trong bản `rules` đã công bố. Một quy tắc đáng có mà chưa có là
   một đề xuất, không phải một quy tắc.
4. Mỗi quy tắc phải có ít nhất một cửa còn mở được nêu thật, hoặc một lập luận vì sao nó kín.
5. Một mã luật không có quy tắc thì ghi là chưa có máy giữ, không gán tạm cho quy tắc gần nhất.
6. Không bao giờ báo cáo một phép kiểm "có tồn tại" như thể nó là phép kiểm nội dung.

## Ngoại lệ

Ngoại lệ ở đây là thuộc tính của quy tắc, không phải chỗ để lách luật.

- **Chuỗi đã đánh dấu.** Dòng khớp `\bvn-ok\b` bị `no-non-ascii-source` bỏ qua hoàn toàn. Đó là
  `COMMENT-5` đang hoạt động đúng ý đồ, và nó theo từng dòng, không được kiểm chứng, và miễn trọn vẹn: nó
  tha cả dòng, kể cả phần văn xuôi trên đó.
- **Thư mục nội dung hiển thị.** Đường dẫn chứa `messages/`, `locales/` hay `i18n/` tắt hẳn quy tắc thứ
  ba, tha `COMMENT-4` trên từng dòng của tệp. Soi nội dung hiển thị là soi chính sản phẩm.
- **Làn dữ liệu thử.** Trong `*.spec.ts`, `*-spec.ts` và `tests/`, chỉ dòng chú thích bị soi. Nó tha
  `COMMENT-4` trên các dòng dữ liệu mà thôi: một câu mà người dùng thật sẽ gõ là dữ liệu đang được nạp vào
  hệ thống, còn chú thích trong tệp thử vẫn là văn xuôi, và vẫn bị từ chối.
- **Hằng số dữ liệu.** `export const MAX_ATTEMPTS = 3` được miễn `require-export-jsdoc` một cách cố ý,
  tha `COMMENT-1` cho dữ liệu, vì ép viết một câu bên cạnh chỉ đẻ ra những câu chép lại tên — đúng thứ mà
  `COMMENT-3` cấm và không quy tắc nào bắt được.
- **Tên gọi của chính ngôn ngữ.** Chuỗi `Tiếng Việt` bị cắt một lần trên mỗi dòng trước khi thử lớp chữ
  cái, vì nó là một nhãn chứ không phải văn xuôi. Phép cắt không toàn cục, nên một dòng mang nó hai lần
  vẫn bị báo.

## Đầu ra

Mỗi phát hiện một khối:

```text
rule: <require-export-jsdoc | require-enum-member-jsdoc | no-non-ascii-source>
code: <COMMENT-1 | COMMENT-2 | COMMENT-4 | none>
file: <path>:<line>
construct: <AST node or raw line the mechanism matched>
verdict: <fires | silent>
reason: <the fact that decides it, naming the mechanism>
hatch: <the open hatch that would have hidden this, or none>
```

Một tệp sạch thì các quy tắc đã chạy không phát ra khối nào, nhưng làn mà nó được xét vẫn phải ghi lại.
Một tệp bị cổng đường dẫn chặn thì phát ra một khối `verdict: silent` với `reason` nêu bộ thăm rỗng — nó
chưa được xét, chứ không phải đã qua.

## Ví dụ đã giải

**Đầu vào.** `payment/state.ts`, mã nguồn thường, không rơi vào làn miễn nào:

```ts
export enum PaymentState {
  Pending = "pending",
  /** Đã thanh toán xong. */
  Settled = "settled",
}

export const refund = async (id: string) => charge.reverse(id)
```

```text
rule: require-enum-member-jsdoc
code: COMMENT-2
file: src/payment/state.ts:2
construct: TSEnumMember Pending
verdict: fires
reason: getCommentsBefore returned no Block comment whose value begins with "*"
hatch: none
```

```text
rule: no-non-ascii-source
code: COMMENT-4
file: src/payment/state.ts:3
construct: raw line "  /** Đã thanh toán xong. */"
verdict: fires
reason: Program:exit walked getLines(); the line carries Vietnamese diacritics, matches no \bvn-ok\b marker, and the path matched neither the locale gate nor the fixture lane
hatch: none
```

```text
rule: require-export-jsdoc
code: COMMENT-1
file: src/payment/state.ts:7
construct: ExportNamedDeclaration, VariableDeclaration, declarations[0].init ArrowFunctionExpression
verdict: fires
reason: the init is a literal function expression, so the declaration is checked, and no leading Block comment begins with "*"
hatch: none
```

**Đã sửa.**

```ts
/** Where a payment sits in its lifecycle. */
export enum PaymentState {
  /** Money has not moved; the order may still be cancelled for free. */
  Pending = "pending",
  /** Money has moved and access is granted; reversing costs a refund fee. */
  Settled = "settled",
}

/** Reverses a settled charge and reopens the order. */
export const refund = async (id: string) => charge.reverse(id)
```

Mọi quy tắc đã chạy đều im lặng. Sự im lặng đó không đồng nghĩa với tuân thủ, và chỉ một thao tác dọn dẹp
là đủ chứng minh:

```ts
enum PaymentState {
  /** The pending state. */
  Pending = "pending",
}
export { PaymentState }
export const refund = memo(async (id: string) => charge.reverse(id))
```

```text
rule: require-enum-member-jsdoc
code: COMMENT-2
file: src/payment/state.ts:1
construct: TSEnumDeclaration PaymentState
verdict: silent
reason: node.parent.type is the program body, not ExportNamedDeclaration, so the rule returns before reaching node.members
hatch: detaching the export keyword disarms the rule entirely; and even inside an export, "/** The pending state. */" — the law's own counter-example — passes, because the rule sees existence and never content
```

```text
rule: require-export-jsdoc
code: none
file: src/payment/state.ts:5
construct: ExportNamedDeclaration with no declaration; VariableDeclaration with a CallExpression init
verdict: silent
reason: export { PaymentState } has no node.declaration and the rule returns at once; memo(...) is a CallExpression, not a literal function expression, so refund is treated as a data constant
hatch: re-export is invisible and wrapping a function in a call escapes — both surfaces ship undocumented with a green build
```

## Phạm vi

Mô-đun này ghi lại việc thi hành một luật về chú thích trong mã nguồn. Nó không xét một chú thích có nói
*vì sao* thay vì *cái gì* hay không — `COMMENT-3` không có ai giữ trong mã và thuộc về người đọc. Nó cũng
không xét một thành viên enum có nói ra hệ quả hay không — nửa đó của `COMMENT-2` không thuộc về ai. Nó
không gọi tên sản phẩm nào, thư viện giao diện nào hay kho mã nào. Những từ mang tên riêng duy nhất trên
trang này nằm bên trong các định danh có thật khi xuất xưởng — một tên quy tắc, một tiền tố trình cắm,
một tên gói — và chúng được chép nguyên xi, vì một định danh bị đổi tên là một định danh khác.
