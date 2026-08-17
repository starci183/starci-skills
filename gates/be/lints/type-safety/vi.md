---
title: Type-safety · Vietnamese
---

# Máy giữ luật an toàn kiểu

Đầu vào là mã đã viết xong — một tệp, một mảnh diff. Đầu ra là một **phán quyết**: tệp có nằm trong
phạm vi hay không, luật máy nào đã nổ, nó báo gì và trên nút nào, mã luật tương ứng là gì, và cửa nào
còn mở đủ rộng để che đúng thất bại đó. Mô-đun này không chọn thiết kế nào cả. Nó từ chối, và nó phải
chỉ được vào đúng ký tự mà nó từ chối.

## Luật

Trình kiểm kiểu là người review rẻ nhất mà một kho mã có, và luật nó giữ chỉ một câu: **đừng tắt nó
đi**. Mọi cách tắt nó đều trông hợp lý ngay tại chỗ — một phép ép kiểu làm bản build xanh lại, một
kiểu object viết ngay chỗ dùng, một enum viết theo lối rẻ tiền — và mọi cách đều tàng hình kể từ hôm
sau.

Văn bản luật chạy từ `TYPE-1` tới `TYPE-6`: **sáu mã**. Mô-đun luật công bố **ba** luật, đúng bằng con
số dự kiến, và ba mã thật sự được giữ bằng một luật của chính mô-đun này. Danh tính của một luật chính
là **tên công bố** của nó — chuỗi in ra trong log build và chuỗi viết trong dòng tắt luật — nên ở đây
không đặt thêm số cho luật nào cả.

Có hai mục nữa nằm trong khối mức nghiêm đề nghị nhưng **không** do mô-đun này công bố: chúng thuộc
plugin TypeScript, được **gọi tên** chứ không được viết lại. Chúng không có mục riêng ở đây, vì một
luật mô-đun này không sở hữu là một luật mô-đun này không thể tả ruột gan.

## Luật máy đã xuất bản

| Luật | Mã luật | Nó báo cái gì |
|---|---|---|
| `no-double-cast` | `TYPE-2` (và nửa phần kiểm thử của `TYPE-6`) | Một phép ép kiểu mà toán hạng của nó cũng là một phép ép kiểu về `unknown` — đúng lối viết `x as unknown as T` — trong mọi tệp không thuộc họ spec và cây kiểm thử |
| `no-inline-param-type` | `TYPE-3` | Một tham số **được rã cấu trúc** mang chú thích kiểu là một object type literal trần, trên hàm khai báo, hàm biểu thức hoặc arrow |
| `no-const-enum` | `TYPE-4` | Một khai báo enum mang từ khoá `const`, ở bất kỳ đâu, kèm tên enum chèn vào thông điệp |

Cả ba đều ánh xạ được vào một mã mà văn bản luật thật sự có. Phát hiện nằm ở những mã xung quanh chúng.

`TYPE-1` — không dùng `any` — **không có luật nào công bố ở đây**. Nó do
`@typescript-eslint/no-explicit-any` giữ, được gọi tên trong khối đề nghị. Viết lại một luật mà ai
cũng đã có sẵn chỉ tốn chi phí bảo trì mà không được gì, nên quyết định là đúng; hệ quả là mã ồn ào
nhất trong luật lại do một luật mà mô-đun này không tả được, không đánh phiên bản được và không bảo
đảm được là có đăng ký hay không. Nếu plugin TypeScript vắng mặt trong cấu hình của kho tiêu thụ thì
mục đó không im lặng không làm gì — cấu hình sẽ không phân giải nổi nó.

`TYPE-5` — một union có nhãn phân biệt hơn hẳn một mớ boolean — **hoàn toàn không có luật nào**, theo
một quyết định có lập luận ghi ngay ở đầu mô-đun luật: muốn biết một tập boolean đang tả **một** tình
huống hay nhiều tình huống độc lập thật sự thì phải hiểu mã đang nói gì, và một luật đoán mò sẽ nổ
trên mọi bản ghi có hai lá cờ. Nó không được thực thi, chứ không phải được phủ, và một lần chạy xanh
không nói gì về nó cả.

`TYPE-6` chỉ được giữ một nửa. Lối ra dành cho kiểm thử của nó nằm bên trong `no-double-cast`; phần
còn lại của nó không có luật nào.

Còn một thứ đang được thực thi mà chẳng có mã nào: khối đề nghị bật
`@typescript-eslint/array-type` với `default: "generic"` và `readonly: "generic"`, tức là ép một lối
viết kiểu mảng thay vì lối kia. Văn bản luật không mang mã nào cho quyết định đó. Vậy nên một bản build
sẽ báo vi phạm một luật mà lý lẽ của nó chỉ tồn tại trong phần chú thích của mô-đun luật. Ghi lại chứ
không sửa, vì bịa ra ánh xạ chính là bịa ra luật.

## Đọc một diff

1. **Quyết phạm vi trước mọi thứ khác, và ghi lại.** Nằm ngoài phạm vi không có nghĩa là tệp đã đạt —
   nghĩa là không có bộ duyệt nào được cài và luật đó không tồn tại đối với tệp đó.
2. **Kiểm miễn trừ, và chỉ cho đúng luật có miễn trừ.** `no-double-cast` là luật duy nhất có cổng tệp.
   `no-inline-param-type` và `no-const-enum` không có cổng nào cả: phạm vi của chúng đúng bằng thứ mà
   cấu hình của kho tiêu thụ trỏ vào, không hẹp hơn.
3. **Đọc nút, đừng đọc ý nghĩa.** Mọi quyết định đều lấy từ hình dạng cây cú pháp. Không phân giải
   mô-đun, không hỏi kiểu, không đọc `tsconfig.json`, không chạy mã.
4. **Xuất một khối cho mỗi phát hiện**, gọi tên đúng nút mang khuyết tật: phép ép bên ngoài, chú thích
   kiểu, hoặc khai báo enum.
5. **Viết dòng `hatch`** mỗi khi có một cửa còn mở đủ để che đúng thất bại đó.
6. **Đừng báo thứ không luật nào canh.** `TYPE-1` là luật của người khác, `TYPE-5` không có luật nào,
   và một phán quyết nói rằng đã xét một trong hai là nói sai về mô-đun này.

## `no-double-cast` — TYPE-2

**Nó báo cái gì.** Báo `doubleCast` trên phép ép **bên ngoài** — một báo cáo cho mỗi chuỗi khớp. Đúng
một lối viết: `x as unknown as T`. Đây là trình biên dịch nói rằng hai kiểu này không giao nhau, rồi
bị bác bỏ hai lần. Nó tệ hơn `any` ở đúng một điểm — kết quả **tự nhận** mình là kiểu đích, nên mọi
thứ phía sau tin nó tuyệt đối, và chỗ vỡ sẽ hiện ra rất xa dòng đã gây ra nó.

**Nó phát hiện bằng gì.** Duyệt nút `TSAsExpression`. Báo khi
`node.expression.type === "TSAsExpression"` **và** chú thích kiểu của phép ép bên trong có
`typeAnnotation.type === "TSUnknownKeyword"`. Cổng tệp được tính **một lần** trong `create` và trả về
một bộ duyệt **rỗng** cho cả tệp: lấy `context.filename` (dự phòng `context.getFilename()`), đổi hết
dấu chéo ngược thành chéo xuôi, rồi thử với
`/\.(?:spec|test|e2e-spec|int-spec|harness-spec)\.ts$/` hoặc kiểm xem đường dẫn có chứa đoạn
`/src/tests/` không.

**Nó không thấy gì.** Tách làm hai câu lệnh: `const loose: unknown = row` rồi
`return loose as Enrollment` giặt sạch y hệt, chỉ khác là toán hạng giờ là một định danh — và đây là
việc người ta làm khi dòng code dài quá, không phải phá hoại. Đổi cầu nối: chỉ mỗi `TSUnknownKeyword`
được thử, nên `x as any as T`, `x as never as T`, `x as {} as T` và `x as object as T` đều lọt; riêng
`as never as` đáng được nói thành một dòng, vì `never` gán được vào mọi kiểu, giặt mạnh y hệt, mà lại
**không** có luật thứ hai nào đứng chờ phía sau như trường hợp `any`. Lối ngoặc nhọn
`<T><unknown>value` là nút `TSTypeAssertion`, không phải `TSAsExpression`. Một hàm ép kiểu tổng quát —
`const coerce = <T,>(value: unknown): T => value as T` — chỉ chứa một phép ép, từ `unknown`, hợp lệ ở
mọi nơi, và từ đó mọi chỗ gọi giặt sạch mà không còn phép ép nào. Một type guard không kiểm gì —
`const isEnrollment = (row: unknown): row is Enrollment => true` — tạo ra đúng niềm tin đó với không
một phép ép nào trong tệp, và chính phương thuốc mà luật kê ra là thứ một luật cú pháp không kiểm
chứng nổi. Một phép ép đơn trên kết quả của một lời gọi trả `any`, `JSON.parse(raw) as Payload`, vẫn
có cây cầu, chỉ là không viết ra. Và cuối cùng là tên tệp: đổi tên một mô-đun sản phẩm thành `.spec.ts`
là tắt luật cho toàn bộ nội dung của nó.

**Ranh giới.** Luật này chỉ xét phép ép kiểu. Hình dạng viết thẳng trong chữ ký mà nó giặt vào là việc
của `no-inline-param-type`; lối viết enum là việc của `no-const-enum`.

## `no-inline-param-type` — TYPE-3

**Nó báo cái gì.** Báo `inline` trên **chú thích kiểu**, không phải trên cái pattern — một tham số
được rã cấu trúc mang kiểu viết thẳng tại chỗ:
`({ userId, courseId }: { userId: string; courseId: string })`. Kiểu đó không tham chiếu được, không
import được, không mở rộng được — nên người gọi thứ hai gõ lại nó, và khi trường thứ ba xuất hiện thì
chỉ một trong hai bản chép nhận được.

**Nó phát hiện bằng gì.** Duyệt `FunctionDeclaration`, `FunctionExpression` và
`ArrowFunctionExpression`, rồi đi qua `node.params`. Mỗi tham số được bóc **một lần**: nếu kiểu nút là
`TSParameterProperty` thì đọc `.parameter` thay thế. Báo khi nút thu được có kiểu đúng bằng
`ObjectPattern`, có `typeAnnotation`, và chú thích bên trong có `typeAnnotation.type` đúng bằng
`TSTypeLiteral`. Không có cổng tệp nào — mọi tệp mà cấu hình trỏ vào đều bị quét.

**Nó không thấy gì.** Không rã cấu trúc: `(params: { userId: string; courseId: string })` là một tham
số `Identifier`, nên luật không hề nhìn tới chú thích của nó — trong khi hình dạng vẫn không tham
chiếu được, vẫn không import được, và vẫn sẽ bị người gọi thứ hai gõ lại y hệt; mà đó lại là lối viết
phổ biến hơn. Cho tham số một giá trị mặc định: `({ userId }: { userId: string } = { userId: "" })`
biến nút thành `AssignmentPattern`, trong đó `left` mới giữ pattern và chú thích, mà phép bóc chỉ xử
lý được vỏ `TSParameterProperty` chứ không gì khác, nên làm tham số thành tuỳ chọn là xoá luật. Bọc
cái literal lại: chú thích phải **đúng bằng** `TSTypeLiteral`, nên `{ a: string } & Base` là giao,
`{ a: string } | undefined` là hợp, còn `Readonly<{ a: string }>` hay `Partial<{ a: string }>` là một
tham chiếu kiểu — cả ba vẫn chôn một hình dạng không tham chiếu được vào chữ ký. Một loại nút hàm nằm
ngoài ba loại được duyệt: `TSFunctionType` trong `type Handler = ({ id }: { id: string }) => void`,
`TSMethodSignature` cho một thành viên interface, `TSDeclareFunction` cho chữ ký nạp chồng,
`TSEmptyBodyFunctionExpression` cho phương thức abstract — không cái nào được duyệt, nên hình dạng có
thể được chốt trong một hợp đồng rồi chỉ việc tuân theo ở phần cài đặt. Một alias cục bộ:
`type Params = { userId: string }` khai báo ngay trong tệp và không export thoả mãn luật hoàn toàn,
trong khi vẫn không import được y như cái literal mà nó thay thế — luật giữ được chữ "có tên", còn
văn bản luật đòi một kiểu có tên **trong thư mục types của mô-đun**, và khoảng cách giữa hai điều đó
thì một cây cú pháp không nhìn thấy. Một array pattern: `([id, count]: [string, number])` chôn một
tuple viết thẳng, mà phép thử hình dạng chỉ nhận `ObjectPattern`.

**Ranh giới.** Luật này đọc chú thích của một tham số. Nó không có lối ra cho kiểm thử và không có
miễn trừ nào — một kiểu viết thẳng được rã cấu trúc trong tệp kiểm thử vẫn bị báo.

## `no-const-enum` — TYPE-4

**Nó báo cái gì.** Báo `constEnum` trên chính khai báo, kèm `node.id.name` chèn vào thông điệp. Một
`const enum` được nội tuyến lúc biên dịch và **không có object lúc chạy**: không duyệt được, không ánh
xạ ngược được, và không qua nổi ranh giới isolated-modules. Nó tiết kiệm vài byte và làm hỏng cả một
họ những việc đơn giản.

**Nó phát hiện bằng gì.** Duyệt `TSEnumDeclaration`; thoát ra nếu cờ boolean `node.const` không bật;
còn lại thì báo trên chính khai báo đó. Không cổng tệp, không miễn trừ, không lối ra cho kiểm thử.

**Nó không thấy gì.** `declare enum`: một enum ambient không có từ khoá `const` cũng không sinh object
lúc chạy, cũng không duyệt được, cũng không ánh xạ ngược được, và cũng hỏng lúc chạy theo đúng mọi
kiểu mà thông điệp mô tả. `node.const` bằng false, nên im lặng — đúng thất bại mà luật gọi tên, đạt
tới bằng một từ khoá mà luật máy không đọc. Tệp khai báo: const enum ambient sống ở `.d.ts`, và cấu
hình thông thường không trỏ linter vào đó. Const enum của người khác: luật canh khai báo chứ không
canh chỗ dùng, nên một const enum nhập từ một gói phụ thuộc mang đủ mọi thất bại kể trên, tại mọi chỗ
dùng, mà được khai báo ở một tệp mô-đun này không bao giờ thấy — đóng cửa đó cần phân giải mô-đun và
thông tin kiểu, hai thứ mô-đun này không dùng. Và mọi thứ nằm ngoài tập glob đã cấu hình: vì luật
không có cổng tệp nào của riêng nó, tầm với của nó đúng bằng thứ mà kho tiêu thụ đưa cho — thư mục
sinh mã, thư mục công cụ và thư mục scripts thường nằm ngoài, mà một bộ sinh mã phun ra `const enum`
mới là trường hợp không ai review.

**Ranh giới.** Luật này canh từ khoá `const` trên một khai báo enum và không canh gì khác. Từ khoá
`declare` là một từ khoá khác và không được xét.

## Cách phát hiện

| Bộ phận | Cơ chế |
|---|---|
| cổng tệp — chỉ `no-double-cast` | Tính một lần trong `create`, và `create` trả về một **bộ duyệt rỗng** cho cả tệp: `context.filename` (dự phòng `context.getFilename()`), đổi dấu chéo ngược thành chéo xuôi, thử với `/\.(?:spec|test|e2e-spec|int-spec|harness-spec)\.ts$/` hoặc chứa đoạn `/src/tests/` |
| bộ duyệt phép ép | `TSAsExpression`, báo khi `node.expression.type === "TSAsExpression"` và chú thích của phép ép bên trong có `typeAnnotation.type === "TSUnknownKeyword"`; nút được báo là phép ép bên ngoài |
| bộ duyệt tham số | `FunctionDeclaration`, `FunctionExpression`, `ArrowFunctionExpression`, đi qua `node.params`, bóc một lần vỏ `TSParameterProperty` sang `.parameter`, rồi đòi đúng `ObjectPattern` có `typeAnnotation` mà chú thích bên trong đúng bằng `TSTypeLiteral`; nút được báo là chú thích kiểu |
| bộ duyệt enum | `TSEnumDeclaration`, chặn theo cờ boolean `node.const`, chèn `node.id.name` vào thông điệp |
| với ra ngoài tệp | Không có. Không phân giải mô-đun, không hỏi kiểu, không đọc `tsconfig.json`, không chạy mã |

Mọi quyết định đều lấy từ hình dạng cây cú pháp, và đó là lý do các luật này chạy nhanh, cũng là lý do
mọi cửa còn mở bên dưới đều chỉ là một cách viết khác của cùng một ý nghĩa.

## Lối thoát hợp lệ

**Đã đóng** — người đọc có thể tưởng những lối viết này lọt, nhưng không.

| Viết kiểu này | Vì sao vẫn nổ |
|---|---|
| `(x as unknown) as T` | Dấu ngoặc không phải là nút trong cây này. Lối có ngoặc và lối trần cùng một hình dạng, cả hai đều bị báo |
| `x as unknown as A as B` | Phép ép ngoài cùng không khớp — chú thích của toán hạng là `A` chứ không phải `unknown` — nhưng nút ở giữa lại chính là một `TSAsExpression` trên một phép ép về `unknown`, nên cả chuỗi bị báo đúng một lần chứ không thoát |
| Một phép ép kép chôn trong đối số lời gọi, trong biểu thức return, trong giá trị mặc định hay trong một thuộc tính object | Không có cổng theo vị trí. Bộ duyệt nổ trên nút đó ở bất kỳ chỗ nào nó xuất hiện |
| Một tệp tên `spec-helpers.ts` hay `test-data.ts` | Mẫu miễn trừ có neo đuôi: `\.spec\.ts$`, `\.test\.ts$` và ba dạng hậu tố còn lại. Một tên tệp chỉ *chứa* chữ đó thì vẫn bị lint |
| Một đường dẫn kiểu Windows đi vào cổng kiểm thử | Tên tệp được chuẩn hoá sang chéo xuôi trước cả hai phép thử, nên cổng xử sự như nhau trên cả hai nền tảng |
| Kiểu viết thẳng được rã cấu trúc trên phương thức lớp, trên constructor, hay trên phương thức của object literal | Thân một phương thức là `FunctionExpression`, một trong ba nút được duyệt. Chỉ dạng khai báo là khác, còn luật thì không quan tâm |
| `constructor(private readonly deps: Deps)` | Vỏ parameter property được bóc trước phép thử hình dạng, nên cái vỏ không giấu nổi một pattern khỏi luật |
| Một phép rã lồng nhau — `({ user: { id } }: { user: { id: string } })` | Tham số ngoài vẫn là `ObjectPattern` mang một `TSTypeLiteral` trần, nên thêm một tầng cũng chẳng đổi gì |
| `export const enum X` và một `const enum` trong khối `declare module` | Cả hai vẫn là nút `TSEnumDeclaration` có cờ `const` bật. Các từ khoá bao quanh không được đọc |
| Một `const enum` viết trong tệp spec | Luật này không có lối ra cho kiểm thử. Miễn trừ thuộc về một luật, không thuộc về cả mô-đun |

**Còn mở** — chỗ mù đã xuất xưởng. Một phán quyết không được phép nói rằng những thứ này đã được xét.

| Luật | Thứ đi lọt |
|---|---|
| `no-double-cast` | **Tách làm hai câu lệnh.** `const loose: unknown = row` rồi `return loose as Enrollment` giặt sạch y hệt, qua một phép ép mà toán hạng là một định danh |
| `no-double-cast` | **Đổi cầu nối.** Chỉ mỗi `TSUnknownKeyword` được thử, nên `x as any as T`, `x as never as T`, `x as {} as T` và `x as object as T` đều lọt — và `as never as` giặt mạnh y hệt mà không có luật thứ hai nào đứng chờ phía sau |
| `no-double-cast` | **Lối ngoặc nhọn.** `<T><unknown>value` là `TSTypeAssertion`, không phải `TSAsExpression` |
| `no-double-cast` | **Một hàm ép kiểu tổng quát.** `const coerce = <T,>(value: unknown): T => value as T` chỉ chứa một phép ép hợp lệ, và từ đó mọi chỗ gọi giặt sạch mà không còn phép ép nào |
| `no-double-cast` | **Một type guard không kiểm gì.** `const isEnrollment = (row: unknown): row is Enrollment => true` tạo ra đúng niềm tin đó với không một phép ép nào trong tệp |
| `no-double-cast` | **Một phép ép đơn trên lời gọi trả `any`.** `JSON.parse(raw) as Payload` — cây cầu vẫn có, chỉ là không viết ra |
| `no-double-cast` | **Tên tệp**, một lối ra cho cả tệp theo hậu tố, và **thư mục**: đoạn `/src/tests/` miễn cho mọi tệp nằm dưới, mãi mãi, kể cả một factory mà mã sản phẩm đang import |
| `no-inline-param-type` | **Không rã cấu trúc.** `(params: { userId: string; courseId: string })` là một tham số `Identifier`, và đó lại là lối viết phổ biến hơn |
| `no-inline-param-type` | **Một giá trị mặc định.** `= { userId: "" }` biến tham số thành `AssignmentPattern`, thứ mà phép bóc một lần không xử lý |
| `no-inline-param-type` | **Bọc cái literal lại.** Một phép giao, một phép hợp, hay `Readonly<…>` / `Partial<…>` đều không đúng bằng `TSTypeLiteral` |
| `no-inline-param-type` | **Một loại nút hàm ngoài ba loại được duyệt.** `TSFunctionType`, `TSMethodSignature`, `TSDeclareFunction`, `TSEmptyBodyFunctionExpression` |
| `no-inline-param-type` | **Một alias cục bộ.** Khai báo ngay trong tệp và không export, nó thoả mãn luật mà vẫn không import được y như cái literal |
| `no-inline-param-type` | **Một array pattern.** `([id, count]: [string, number])` chôn một tuple viết thẳng |
| `no-const-enum` | **`declare enum`**, **một tệp khai báo `.d.ts`**, **const enum của người khác nhập từ một gói phụ thuộc**, và **mọi thứ nằm ngoài tập glob đã cấu hình** |
| không luật nào | **Mọi thứ `TYPE-5` cấm** — một mớ boolean đứng chỗ của một union có nhãn phân biệt. Và **`TYPE-1`** do `@typescript-eslint/no-explicit-any` giữ, một luật mà mô-đun này không tả được, không đánh phiên bản được và không bảo đảm được là có đăng ký |

Dòng cuối cùng chính là bản tóm tắt trung thực: trong sáu mã, ba mã được giữ bởi những luật tả ở đây,
một mã đi mượn, một mã cố ý không thực thi, và một mã chỉ được giữ ở nửa phần kiểm thử.

## Đầu vào

| Đầu vào | Bằng chứng bắt buộc |
|---|---|
| đường dẫn tệp | `context.filename`, dự phòng `context.getFilename()`, dấu chéo ngược đã chuẩn hoá — chỉ một luật đọc |
| hình dạng phép ép | kiểu nút của toán hạng một phép ép, và kiểu nút của chú thích kiểu ở phép ép bên trong |
| hình dạng tham số | kiểu nút của một tham số sau một lần bóc, và kiểu nút của chú thích bên trong nó |
| từ khoá enum | cờ boolean `const` trên một khai báo enum |
| tên enum | `node.id.name`, chèn vào thông điệp |

## Quy tắc

1. Danh tính của một luật là **tên công bố** của nó; ở đây không đặt thêm số cho luật nào.
2. Phát hiện thuần cú pháp: không phân giải mô-đun, không hỏi kiểu, không đọc tuỳ chọn biên dịch,
   không chạy mã.
3. **Hai trong ba luật không có cổng tệp nào.** Phạm vi của chúng đúng bằng thứ mà cấu hình của kho
   tiêu thụ trỏ vào, không hẹp hơn.
4. Mô-đun công bố ba luật; khối mức nghiêm đề nghị nêu năm mục, hai mục thuộc plugin khác và là một
   phụ thuộc cứng vào việc plugin đó có được đăng ký hay không.
5. Miễn trừ duy nhất trên kệ là lối ra **cho cả tệp**, không phải một cặp tệp-cộng-giá-trị.
6. Mọi luật đều báo trên đúng nút mang khuyết tật: phép ép bên ngoài, chú thích kiểu, khai báo enum.
   Chỉ luật enum mang dữ liệu trong thông điệp.
7. Mức nghiêm mà mô-đun tự đề nghị là `error` cho cả năm mục; cấu hình của kho tiêu thụ mới là nơi
   quyết định thật sự bật cái gì.

## Ngoại lệ

- **Họ spec và cây kiểm thử** được miễn `no-double-cast`, và không được miễn gì khác. Dựng một giá trị
  sai có chủ đích chính là cách một bài spec chứng minh rằng một API đóng từ chối nó. Lối ra này là
  **cho cả tệp**: bên trong một tệp được miễn, luật không tồn tại, chứ không phải luật cho phép một
  cấu trúc. Nó thả `TYPE-2` cho toàn bộ tệp đó.
- **Năm hậu tố được nhận** là `.spec.ts`, `.test.ts`, `.e2e-spec.ts`, `.int-spec.ts`,
  `.harness-spec.ts`, cộng với mọi đường dẫn có đoạn `/src/tests/`. Danh sách hậu tố đóng và có neo
  đuôi; đoạn thư mục thì không.
- **Hai luật còn lại không có miễn trừ nào.** Một `const enum` trong tệp spec vẫn bị báo; một kiểu
  viết thẳng được rã cấu trúc trong tệp kiểm thử vẫn bị báo.
- `TYPE-6` nói rằng lối ra hợp thức cho kiểm thử phải "được viết vào cấu hình chứ không rắc thành
  những dòng tắt luật lẻ tẻ". `no-double-cast` lại đặt lối ra đó bên trong chính luật, và có lập luận:
  dựng một giá trị sai có chủ đích là thuộc tính của làn kiểm thử chứ không phải của cách bố trí tệp
  ở một kho nào. Lập luận thì tốt, còn chỗ đặt thì trái với chính câu chữ cho phép nó. Một trong hai
  phải dời.
- **`TYPE-5` không có luật nào giữ**, theo một quyết định có lập luận ghi ngay ở đầu mô-đun luật.
- **`TYPE-1` do `@typescript-eslint/no-explicit-any` giữ**, còn lối viết kiểu mảng do
  `@typescript-eslint/array-type` giữ. Cả hai được gọi tên trong khối đề nghị, không cái nào do mô-đun
  này công bố, và ở đây không tả ruột gan cái nào cả.

## Đầu ra

Một khối cho mỗi phát hiện:

```text
rule:    <no-double-cast | no-inline-param-type | no-const-enum>
file:    <path as the gate saw it, forward slashes>
scope:   <in | out — the gate that decided it, or "no gate">
node:    <TSAsExpression | TSTypeAnnotation on an ObjectPattern | TSEnumDeclaration>
message: <doubleCast | inline | constEnum>
data:    <enum name — constEnum only>
hatch:   <the open hatch that would have hidden this, or none>
```

Một tệp sạch xuất một khối cho mỗi luật với `message: none` và `node: none`. Một tệp nằm ngoài phạm vi
xuất `scope: out`, `message: none` và `node: none` — không có bộ duyệt nào được cài, nên luật đó không
tồn tại đối với tệp đó, và khối này ghi lại đúng điều ấy chứ không ghi là đã đạt.

## Ví dụ đã giải

**Đầu vào.** `modules/enrollment/enrollment.service.ts` — một đường dẫn sản phẩm, nên cổng của
`no-double-cast` không miễn cho nó:

```ts
export const enum EnrollmentStatus {
  Active = "active",
  Ended = "ended",
}

export function buildKey({ userId, courseId }: { userId: string; courseId: string }) {
  return `${userId}:${courseId}`
}

export function readRow(row: Record<string, unknown>) {
  return row as unknown as Enrollment
}
```

```text
rule:    no-const-enum
file:    src/modules/enrollment/enrollment.service.ts
scope:   in — no gate
node:    TSEnumDeclaration
message: constEnum
data:    EnrollmentStatus
hatch:   none
```

```text
rule:    no-inline-param-type
file:    src/modules/enrollment/enrollment.service.ts
scope:   in — no gate
node:    TSTypeAnnotation on an ObjectPattern
message: inline
data:    none
hatch:   none
```

```text
rule:    no-double-cast
file:    src/modules/enrollment/enrollment.service.ts
scope:   in — not a spec suffix, not under /src/tests/
node:    TSAsExpression
message: doubleCast
data:    none
hatch:   none
```

**Đã sửa.** Enum bỏ `const`, hình dạng tham số thành một kiểu có tên trong thư mục types của mô-đun,
và hàng dữ liệu được thu hẹp bằng type guard thay vì bị bác bỏ:

```ts
import type { BuildKeyParams } from "./types/build-key-params"

export enum EnrollmentStatus {
  Active = "active",
  Ended = "ended",
}

export function buildKey({ userId, courseId }: BuildKeyParams) {
  return `${userId}:${courseId}`
}

export function readRow(row: Record<string, unknown>) {
  if (!isEnrollment(row)) throw new InvalidEnrollmentRowException()
  return row
}
```

Nhưng có hai cửa còn mở sống sót qua đúng lần sửa đó, và một lần chạy im lặng không chứng minh được
cửa nào. Viết theo lối dưới đây thì không có gì bị báo cả:

```ts
export function readRow(row: Record<string, unknown>) {
  const loose: unknown = row
  return loose as Enrollment
}

export function buildKey(params: { userId: string; courseId: string }) {
  return `${params.userId}:${params.courseId}`
}
```

```text
rule:    no-double-cast
file:    src/modules/enrollment/enrollment.service.ts
scope:   in — not a spec suffix, not under /src/tests/
node:    none
message: none
data:    none
hatch:   two statements instead of one — the operand of the remaining cast is an identifier, so the chain never forms and the launder is invisible rather than compliant
```

```text
rule:    no-inline-param-type
file:    src/modules/enrollment/enrollment.service.ts
scope:   in — no gate
node:    none
message: none
data:    none
hatch:   not destructuring it — an Identifier parameter is never looked at, so the shape stays as unreferenceable as before and the silence means nothing
```

## Phạm vi

Mô-đun này ghi lại ba luật do mô-đun luật của luật an toàn kiểu công bố, xuất xưởng trong
`@starci/eslint-canon-be`. Nó không ghi bất kỳ luật nào "đáng lẽ nên có": một luật không chỉ tay vào
được thì là một đề xuất, không phải mức thực thi. Nó không xét `any` — đó là
`@typescript-eslint/no-explicit-any` — không xét lối viết kiểu mảng, vốn là
`@typescript-eslint/array-type`, và không xét một mớ boolean đứng chỗ của một union có nhãn phân biệt,
thứ mà không luật nào xét.
