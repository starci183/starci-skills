---
title: Exception-identity · Vietnamese
---

# Danh tính ngoại lệ

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-be` | `@starci/eslint-canon-be` | npm package | bộ máy backend đã phát hành mà bản ghi này viện dẫn |


## Bản ghi

Gate này nhận đoạn mã đã được viết ra rồi — một lớp, một tệp, một mảnh diff. Kết quả là một **phán quyết**:
nút đó có nằm trong phạm vi hay không, luật máy nào đã nổ, nó báo gì và báo lên nút nào, mã luật tương
ứng là mã nào, và cửa nào còn mở đủ để che đi đúng cái thất bại ấy. Mô-đun này không chọn cách đặt tên
nào cả. Nó chỉ từ chối một cách đặt tên, và nó phải chỉ ra được đúng ký tự mà nó từ chối.

## Luật

Một thất bại có **một** cái tên, viết bằng ba thứ chữ, và cả ba phải nói cùng một điều: tên lớp, mã
trên đường truyền, và tên kiểu của gói dữ liệu mà nơi ném phải thoả. Ba thứ chữ đó do ba phía đọc, và
không phía nào đọc được hai thứ còn lại — cổng đọc tên lớp, phía khách đọc mã, người gọi đọc kiểu dữ
liệu kèm theo.

Luật nêu năm mã, từ `IDENTITY-1` đến `IDENTITY-5`. **Ba trong số đó có luật máy.** Tài liệu này không
nhắc lại luật; nó ghi lại phần **máy giữ**: máy giữ điều nào, giữ bằng cơ chế gì, và — phần thường
không ai chép ra — máy hoàn toàn không nhìn thấy những cách viết nào của cùng một lỗi. Một điều luật
không có luật máy thì ai cũng biết là chưa được giữ. Một luật máy bị tin là kín trong khi nó hở thì
nguy hơn, vì nó đã lấy mất sự chú ý của người đọc mà không đổi lại được gì.

## Luật máy đã xuất bản

Ba luật máy ra đời cho điều luật này, nằm trong gói `@canon-be`, cả ba đều đặt ở mức
`error`.

| Luật máy | Mã luật | Nó báo cái gì |
|---|---|---|
| `exception-name-ends-in-exception` | `IDENTITY-1` | `suffix` — một lớp kế thừa lớp nền của nhà mà tên không kết thúc bằng `Exception` |
| `exception-code-matches-class-name` | `IDENTITY-2` | `mismatch` — chữ của mã khác chữ của tên lớp · `notLiteral` — mã không phải một chuỗi viết thẳng |
| `exception-metadata-type-named-for-class` | `IDENTITY-4` | `untyped` — tham số dữ liệu kèm theo được tách rời mà không khai kiểu · `named` — nó khai một tham chiếu kiểu không phải `<Class>Metadata` |

`IDENTITY-3` (điều về đổi tên) và `IDENTITY-5` (điều về trạng thái) **không có luật máy nào**. Một điều
trải qua hai lần sửa của cùng một tệp, một điều là phán đoán về ý định — không điều nào hiện ra trong
một lần đọc tệp. Chính luật đã nói rõ hai điều đó do người rà soát giữ. Chúng là chưa được giữ, chứ
không phải đã được phủ, và một lần chạy sạch không nói gì về chúng cả.

Hai điều nữa phải nói ngay cạnh bảng. Luật máy thứ ba **đề sai mã ngay trong nguồn của nó**: dòng phân
đoạn ghi `IDENTITY-3`, trong khi `IDENTITY-3` của luật là điều về đổi tên, còn điều về tên kiểu dữ liệu
kèm theo là `IDENTITY-4`. Bảng trên theo luật, không theo dòng phân đoạn. Và **không luật máy nào bắt
được hai lớp cùng một mã** — `IDENTITY-2` báo lệch chữ, chứ không báo trùng. Hai lớp cùng tên nằm ở hai
thư mục khác nhau sẽ cùng đi qua sạch và cùng phát ra một mã.

## Đọc một diff

1. **Quyết phạm vi trước mọi thứ khác, và ghi lại.** Phạm vi ở đây là một nút chứ không phải một đường
   dẫn: luật máy chỉ tồn tại bên trong một `ClassDeclaration` có lớp cha là định danh trần
   `AbstractException`. Nằm ngoài phạm vi không có nghĩa là khai báo ấy đã qua — nó có nghĩa là không
   luật nào coi đó là ngoại lệ của nhà.
2. **Kiểm các ngoại lệ, vốn đều mang tính cấu tạo.** Một lớp không có hàm dựng riêng nằm ngoài luật thứ
   hai và thứ ba do cấu tạo. Một dòng tắt luật ở mức tệp hoặc ngay trên lời gọi `super()` là lối ra duy
   nhất được cấp, và nó phải ghi rõ phía khách nào cùng ngày ngừng dùng, hoặc ai là tác giả của một khai
   báo do máy sinh.
3. **Đọc đúng những nút mà luật máy đọc, theo đúng thứ tự của chúng.** `id` và `superClass` của lớp;
   rồi `MethodDefinition` của hàm dựng; rồi **chỉ những câu lệnh ở tầng trên cùng** của hàm dựng để tìm
   lời gọi `super()`; rồi `params[0]`, gỡ qua `AssignmentPattern` nếu có.
4. **Xuất một khối cho mỗi phát hiện.** Ba luật máy có thể cùng nổ trên một lớp, và đó là ba phán quyết.
5. **Viết dòng `hatch` bất cứ khi nào một cửa còn mở đủ để che đi đúng cái thất bại ấy**, kể cả trên một
   phán quyết sạch mà sự im lặng đến từ một lệnh `return` sớm chứ không từ đoạn mã đúng.
6. **Không báo cái mà không luật máy nào canh.** Hai trong năm mã không có máy, và tính duy nhất giữa
   các lớp cũng vậy; một phán quyết nói khác đi là nói sai về mô-đun này.

## `exception-name-ends-in-exception` — IDENTITY-1

**Nó báo cái gì.** `suffix` — một báo cáo trên nút tên lớp, kèm cái tên lẽ ra phải đặt.

**Nó phát hiện bằng gì.** Vào nút `ClassDeclaration`. Đòi có `node.id`, đòi
`node.superClass.type === "Identifier"` và `node.superClass.name === "AbstractException"`, rồi thử biểu
thức chính quy `/Exception$/` lên `node.id.name`. Báo lên đúng nút `Identifier` của tên lớp.

**Điểm mù.** Một tầng kế thừa trung gian — `class DomainException extends AbstractException {}`
rồi `class OrderNotFound extends DomainException {}` — vì cổng là một phép so định danh nguyên văn với
đúng một chuỗi; dựng một lớp nền cho miền là cuộc tái cấu trúc thông thường nhất trên đời, và nó lặng lẽ
gỡ bỏ sự giữ gìn khỏi mọi khai báo nằm dưới nó. Đổi tên khi nhập, `import { AbstractException as Base }`
rồi `extends Base`, cũng là sự im lặng toàn phần đó, gọn trong một dòng. Một `export default class`
không tên có `node.id` là null nên bị bỏ qua trước khi bất cứ gì kịp chạy. Một biểu thức lớp,
`const OrderNotFoundException = class extends AbstractException { … }`, thì luật không hề vào nút đó. Và
`/Exception$/` chỉ thử **cái đuôi**, không thử ý nghĩa: `class Exception` và `class OrderErrorException`
đều lọt.

**Ranh giới.** Luật này xét một cái tên. Lớp ấy phát gì trên đường truyền là `IDENTITY-2`; gói dữ liệu
của nó khai kiểu ra sao là `IDENTITY-4`. Đây cũng là luật làm cho những luật kia trở nên có thật — các
luật ngoại lệ lân cận đều nhận diện bằng đuôi `Exception`, nên một lớp đặt tên `*Error` mà kế thừa đúng
lớp nền, nằm đúng thư mục, được ném ở nơi thật sẽ **không một luật máy nào kiểm**.

## `exception-code-matches-class-name` — IDENTITY-2

**Nó báo cái gì.** `mismatch` — chữ của mã khác chữ của tên lớp; đây là mã chép từ ngoại lệ viết ngay
bên trên, và là mã còn sót lại sau một lần đổi tên lớp. `notLiteral` — mã được lắp ở lúc chạy hoặc lấy
từ chỗ khác thay vì được viết thẳng ngay nơi người ta đọc nó.

**Nó phát hiện bằng gì.** Qua cùng cổng `ClassDeclaration`. Tìm `MethodDefinition` có
`kind === "constructor"` trong `node.body.body`, rồi quét **chỉ những câu lệnh ở tầng trên cùng** của
hàm dựng để tìm một `ExpressionStatement` mà `expression` là `CallExpression` với `callee` kiểu `Super`.
Lấy `arguments[1]`, đòi `type === "Literal"` mang giá trị `string`, rồi so hai vế sau khi bỏ hết `_` và
viết hoa cả hai. Báo lên nút đối số.

**Điểm mù.** Một lời gọi `super()` nằm trong một khối — `if (cause) { super(msg, "A", meta) } else { super(msg, "B", meta) }`
— không nằm trong danh sách câu lệnh phẳng, nên luật trả về và không báo
gì, mà đó lại đúng là hình dạng một mã có điều kiện sẽ mang. Không truyền mã, `super("Không tìm thấy")`,
thì `arguments.length < 2` trả về sớm. Hàm dựng thừa kế chứ không khai báo thì gặp `if (!ctor) return`.
Chữ hoa chữ thường là vô hình, vì hai vế đều được viết hoa: `"order_not_found_exception"` lọt, và
`"OrderNotFoundException"` dùng làm mã cũng lọt, dù luật viết là SCREAMING_SNAKE. Dấu ngăn cũng vô hình,
vì gạch dưới bị bỏ trước khi so: `"ORDERNOTFOUNDEXCEPTION"` không ai đọc nổi, và hợp lệ. Mọi cửa của
cổng lớp ở trên áp nguyên vào đây.

**Ranh giới.** Luật này so một mã với một tên lớp. Nó không bao giờ so hai mã với nhau, nên nó báo lệch
chữ chứ không bao giờ báo trùng.

## `exception-metadata-type-named-for-class` — IDENTITY-4

**Nó báo cái gì.** `untyped` — tham số đầu tiên của hàm dựng được tách rời mà không khai kiểu. `named` —
có khai kiểu, nhưng tên tham chiếu kiểu ấy không phải `<Class>Metadata`.

**Nó phát hiện bằng gì.** Qua cùng cổng lớp và cổng hàm dựng. Lấy `params[0]`, gỡ một
`AssignmentPattern` về `left` của nó. Đòi kiểu nút là `ObjectPattern`. Đọc
`param.typeAnnotation.typeAnnotation`: không có thì báo `untyped`. Có, mà là `TSTypeReference` với
`typeName` kiểu `Identifier`, thì so định danh đó với `` `${className}Metadata` ``. Mọi hình dạng khác
đều bị bỏ qua. Báo lên nút tham số hoặc nút khai kiểu.

**Điểm mù.** Một tham số dữ liệu kèm theo không tách rời —
`constructor(metadata: AbstractExceptionMetadata)` — là `Identifier` chứ không phải `ObjectPattern`, nên
luật trả về trước khi kịp đọc phần khai kiểu: đúng cái lỗi luật sinh ra để bắt, viết lệch đi một dấu
phẩy. Kiểu viết thẳng hoặc kiểu ghép, `{ id }: { id?: string }` hay
`{ id }: AbstractExceptionMetadata & { id?: string }`, là `TSTypeLiteral` hoặc `TSIntersectionType` chứ
không phải `TSTypeReference`, nên bị bỏ qua. Một tên kiểu có tiền tố không gian tên,
`{ id }: Errors.OrderNotFoundExceptionMetadata`, có `typeName` là `TSQualifiedName` nên bị bỏ qua, dù nó
có thể đang rất đúng. Và luật chỉ đọc cái tên chứ không bao giờ đọc cái kiểu:
`export type OrderNotFoundExceptionMetadata = Record<string, unknown>` lọt sạch, vì không alias nào được
giải và không chỗ nào kiểm rằng kiểu đó kế thừa kiểu nền dùng chung, vốn là một nửa những gì
`IDENTITY-4` đòi. Chỉ `params[0]` được đọc; một tham số dữ liệu kèm theo đứng ở vị trí thứ hai là vô
hình.

**Ranh giới.** Việc gỡ `AssignmentPattern` là một sửa lỗi có thật được nguồn ghi lại, không phải một chi
tiết làm đẹp: `{ … }: Metadata = {}` bị phân tích thành một mẫu gán bọc ngoài mẫu tách rời, và lần đo
đầu tiên chỉ đọc nút ngoài đã bỏ sót đúng những khai báo mà luật này sinh ra để bắt.

## Cách phát hiện

Mọi luật máy đều là một lần duyệt cây cú pháp thuần tuý. Không chỗ nào đọc tên tệp, giải một lệnh nhập,
đi theo một alias kiểu, hay hỏi bộ kiểm kiểu.

| Bộ phận | Cơ chế |
|---|---|
| cổng lớp | Một **phép so định danh nguyên văn**: có `node.id`, `node.superClass.type === "Identifier"`, `node.superClass.name === "AbstractException"`. Chỉ `ClassDeclaration` được vào |
| cổng hàm dựng | `MethodDefinition` có `kind === "constructor"` trong `node.body.body`; `if (!ctor) return` |
| quét lời gọi super | Một **danh sách câu lệnh phẳng** — các `ExpressionStatement` ở tầng trên cùng của hàm dựng mà `expression` là `CallExpression` với `callee` kiểu `Super` |
| so mã | `arguments[1]` phải là `Literal` mang giá trị `string`; hai vế đều bị bỏ `_` và viết hoa trước khi so |
| đọc tham số | `params[0]`, gỡ qua `AssignmentPattern` về `.left`, đòi là `ObjectPattern`, rồi `param.typeAnnotation.typeAnnotation` |
| ngoài tệp | **Không gì cả.** Không lệnh nhập nào được giải, không kiểu nào được giải, không tên tệp nào được đọc, không tuỳ chọn nào được khai |

Hai cơ chế gánh cả kệ luật này, và cả hai đều hẹp một cách cố ý: cổng lớp là một phép so định danh
nguyên văn với đúng một chuỗi, còn phép quét lời gọi super là một danh sách câu lệnh phẳng. Mọi dòng
trong bảng cửa còn mở dưới đây đều suy ra từ hai câu ấy.

## Lối thoát hợp lệ

**Đã đóng** — người đọc có thể tưởng những cách viết này lách được, nhưng không.

| Viết theo cách này | Vì sao nó vẫn nổ |
|---|---|
| Nâng mã lên thành hằng — `const CODE = "ORDER_NOT_FOUND_EXCEPTION"` rồi `super(msg, CODE)` | `arguments[1]` là `Identifier` chứ không phải `Literal`, nên `notLiteral` nổ. Cái hằng vốn rửa được một chuỗi qua mặt những luật so thuộc tính thì không rửa được qua luật này |
| Lấy mã từ một phần tử enum — `super(msg, Codes.OrderNotFound)` | `MemberExpression` không phải `Literal`. Vẫn báo như trên |
| Tham số tách rời có giá trị mặc định — `constructor({ id }: SomeMetadata = {})` | Giá trị mặc định bọc mẫu tách rời trong một `AssignmentPattern`; luật gỡ về `.left` trước khi đọc phần khai kiểu |
| Một lớp kế thừa đúng, nằm đúng chỗ, ném đúng nơi, nhưng đặt tên `*Error` | Đây chính là trường hợp mà luật thứ nhất sinh ra để bắt; các luật ngoại lệ lân cận đều nhận diện bằng đuôi và sẽ đều không báo gì |
| Mã ngăn bằng dấu gạch ngang — `"ORDER-NOT-FOUND-EXCEPTION"` | Chỉ `_` bị bỏ, nên dấu gạch ngang sống sót vào phép so và chữ hai vế khác nhau. `mismatch` nổ |
| Mã thiếu đuôi `_EXCEPTION` — `"ORDER_NOT_FOUND"` | Đuôi `Exception` của chính tên lớp nằm trong phần chữ được đem so. `mismatch` nổ |
| Dời tệp, đổi tên tệp, hay gọi nó là tệp dữ liệu mẫu | Không luật nào đọc `context.filename`, nên không thư mục nào, hậu tố nào, đường dẫn mẫu nào được miễn |
| Chính khai báo của lớp nền — `class AbstractException extends Error {}` | Lớp cha của nó là `Error`, nên không luật nào coi nó là ngoại lệ của nhà |
| Từ viết tắt tách khác đi — `GRAPHQL_DATA_…` so với `GraphQLData…` | Cố ý **không** báo. Chỗ đặt gạch dưới bên trong một từ viết tắt không có đáp án đúng duy nhất, và một luật đòi một cách tách sẽ nổ vào đoạn mã không sai gì cả |

**Còn mở** — đây là chỗ mù đã xuất xưởng. Một phán quyết không được nói rằng những chỗ này đã được xét.

| Phạm vi | Cái gì lọt |
|---|---|
| cả ba | **Một tầng kế thừa trung gian.** `class DomainException extends AbstractException {}` và mọi khai báo dưới nó thôi không còn là ngoại lệ của nhà |
| cả ba | **Đổi tên khi nhập.** `import { AbstractException as Base }` rồi `extends Base` — gọn một dòng trong khối nhập |
| cả ba | **`export default class` không tên.** `node.id` là null và cổng trả về trước |
| cả ba | **Biểu thức lớp.** Không luật nào trong ba luật vào nút `ClassExpression` |
| luật thứ hai và thứ ba | **Hàm dựng thừa kế chứ không khai báo.** `if (!ctor) return`; danh tính được quyết ở nơi luật không nhìn tới |
| `exception-name-ends-in-exception` | **Một cái tên kết thúc đúng mà chẳng gọi tên gì** — `class Exception`, `class OrderErrorException` |
| `exception-code-matches-class-name` | **`super()` nằm trong `if`, `try`, `switch` hay một khối lồng**, **không truyền mã**, **mọi kiểu chữ hoa chữ thường**, và **không có dấu ngăn nào cả** |
| `exception-metadata-type-named-for-class` | **Tham số không tách rời**, **kiểu viết thẳng hoặc kiểu ghép**, **tên kiểu có tiền tố không gian tên**, **một kiểu đặt tên đúng mà chẳng nghĩa gì**, và **tham số dữ liệu kèm theo đứng ở vị trí thứ hai** |
| không luật nào | **Hai lớp phát ra cùng một mã.** `IDENTITY-2` so một mã với chính tên lớp của nó, không bao giờ so với mã khác |
| không luật nào | **Toàn bộ những gì `IDENTITY-3` và `IDENTITY-5` nói** — điều về đổi tên và điều về trạng thái đều do người rà soát giữ |

Cái khuôn nằm sau phần lớn những dòng trên gói trong một câu: **các luật máy nhận ra đúng một hình dạng
rồi im lặng trước mọi hình dạng kề bên, thay vì báo cáo chúng.** Một lệnh `return` sớm, nhìn trong nhật
ký dựng, không phân biệt được với một tệp sạch.

## Đầu vào

| Đầu vào | Bằng chứng cần có |
|---|---|
| Cây cú pháp nguồn | `ClassDeclaration`, `superClass`, `id` của nó, `MethodDefinition` của hàm dựng, các câu lệnh tầng trên cùng của hàm dựng ấy và `params[0]` |
| Quyết định phạm vi | Cổng lớp nào đã khớp, hoặc là không cổng nào khớp |
| Đối số mã | `arguments[1]` của lời gọi `super()`: kiểu nút của nó, và giá trị của nó khi nó là `Literal` chuỗi |
| Tham số dữ liệu kèm theo | Kiểu nút của `params[0]` sau khi gỡ, và kiểu nút của phần khai kiểu |
| Tên tệp | **Không gì cả.** Không luật nào đọc `context.filename`, nên không thư mục nào, hậu tố nào, đường dẫn mẫu nào miễn được một tệp |
| Tuỳ chọn | **Không gì cả.** Cả ba đều khai `schema: []`; không có bề mặt cấu hình nào |
| Lệnh nhập | **Không gì cả.** Không mô-đun nào được giải; lớp cha được khớp bằng chính tả |
| Kiểu | **Không gì cả.** Không kiểu nào được giải; phần khai kiểu dữ liệu kèm theo được khớp bằng chính tả |

## Quy tắc

1. Một luật máy chỉ nổ bên trong một `ClassDeclaration` có lớp cha là định danh trần
   `AbstractException`.
2. Ba luật máy này giữ `IDENTITY-1`, `IDENTITY-2` và `IDENTITY-4`. `IDENTITY-3` và `IDENTITY-5` do người
   rà soát giữ, và không dòng nào ở đây được viết như thể chúng đã có máy.
3. Danh tính của một luật máy là cái tên đã xuất bản của nó. Chép nguyên văn, vì đó là chuỗi in ra trong
   nhật ký dựng và chuỗi viết trong một dòng tắt luật.
4. Không luật nào có bộ tự sửa. Mọi báo cáo đều là một thông điệp, và cái tên gợi ý trong thông điệp là
   chữ, không phải bản vá.
5. Không luật nào đọc tên tệp, nên không thể lách bằng cách dời hay đổi tên tệp — và cũng không thể nới
   riêng cho một tệp dữ liệu mẫu.
6. Không luật nào có tuỳ chọn, nên một kho không thể nới một luật mà không tắt hẳn nó, và tắt hẳn thì
   nhìn thấy được.
7. Chỗ đặt gạch dưới không bao giờ là một báo cáo; chữ mới là điều luật.
8. Cả ba đều đặt ở mức `error` trong cấu hình đã xuất xưởng, và cả ba đều từng ra đời ở mức `warn` sau
   một mục nợ nêu đích danh những chỗ vi phạm, chỉ được nâng lên khi mục nợ ấy đóng lại.
9. Cửa còn mở phải được ghi ra. Một cửa không ai biết nguy hơn một điều luật không có luật máy.

## Ngoại lệ

Ngoại lệ là **một phần của phần máy giữ**, không phải chỗ lách. Mỗi ngoại lệ nêu rõ nó bước qua luật máy
nào và vì lý do gì.

- **Một phía khách đã phát hành còn khớp mã cũ.** `IDENTITY-3` nói lớp giữ tên cũ cho tới khi phía khách
  đó ngừng dùng, tức là nó thả `exception-name-ends-in-exception` và `exception-code-matches-class-name`
  cho khai báo ấy. Nếu đã trót đổi tên rồi, hình thức trung thực là một dòng tắt luật ngay trên lời gọi
  `super()`, ghi rõ phía khách nào và ngày ngừng — chứ không phải bịa ra một cái tên thứ hai để cho luật
  máy im.
- **Khai báo do máy sinh hoặc do nơi khác viết.** Tắt ở mức tệp, thả cả ba luật, kèm một câu nói rõ ai là
  tác giả.
- **Cách tách từ viết tắt.** Không phải ngoại lệ: luật máy vốn không nổ, vì gạch dưới bị bỏ trước khi so.
  Ghi ở đây vì đây là báo cáo người đọc hay chờ nhất mà không bao giờ nhận được.
- **Lớp không có hàm dựng riêng** nằm ngoài `exception-code-matches-class-name` và
  `exception-metadata-type-named-for-class` do cấu tạo, không phải do được cho phép. Nếu nó thừa kế một
  danh tính thì danh tính ấy được rà soát ở nơi nó được viết ra.

## Đầu ra

Một khối cho mỗi phát hiện:

```text
file:     <path as written; no rule reads it>
scope:    <in — ClassDeclaration extending the bare identifier AbstractException | out — no rule considered this a house exception>
rule:     <exception-name-ends-in-exception | exception-code-matches-class-name | exception-metadata-type-named-for-class>
law code: <IDENTITY-1 | IDENTITY-2 | IDENTITY-4>
message:  <suffix | mismatch | notLiteral | untyped | named>
node:     <class name identifier | super() argument | constructor parameter | type annotation>
severity: error
hatch:    <the open hatch that would have hidden this failure, or none>
```

Một tệp sạch xuất một khối cho mỗi luật máy đã chạy, với `message: none` và `severity: none`, kèm một
dòng `hatch` bất cứ khi nào sự im lặng đến từ một lệnh `return` sớm chứ không từ đoạn mã đúng. Một tệp
nằm ngoài phạm vi xuất `scope: out`, `message: none` và lý do cổng lớp không khớp; nó chưa được xét, và
không bao giờ được viết như thể nó đã qua.

## Ví dụ đã giải

**Đầu vào.** Một khai báo mà mô-đun này từ chối:

```ts
export class OrderNotFoundError extends AbstractException {
  constructor({ orderId }) {
    super("Order not found", "ORDER_MISSING", { orderId })
  }
}
```

Cổng lớp khớp — có `node.id` và lớp cha là định danh trần `AbstractException` — nên cả ba luật máy đều
chạy, và cả ba đều nổ.

```text
file:     src/exceptions/order-not-found.exception.ts
scope:    in — ClassDeclaration extending the bare identifier AbstractException
rule:     exception-name-ends-in-exception
law code: IDENTITY-1
message:  suffix
node:     class name identifier
severity: error
hatch:    none
```

```text
file:     src/exceptions/order-not-found.exception.ts
scope:    in — ClassDeclaration extending the bare identifier AbstractException
rule:     exception-code-matches-class-name
law code: IDENTITY-2
message:  mismatch
node:     super() argument
severity: error
hatch:    none
```

```text
file:     src/exceptions/order-not-found.exception.ts
scope:    in — ClassDeclaration extending the bare identifier AbstractException
rule:     exception-metadata-type-named-for-class
law code: IDENTITY-4
message:  untyped
node:     constructor parameter
severity: error
hatch:    none
```

**Đã sửa.** Ba thứ chữ được nắn lại cho cùng nói một điều:

```ts
export type OrderNotFoundExceptionMetadata = Record<string, unknown>

export class OrderNotFoundException extends AbstractException {
  constructor({ orderId }: OrderNotFoundExceptionMetadata) {
    super("Order not found", "ORDER_NOT_FOUND_EXCEPTION", { orderId })
  }
}
```

Giờ cả ba luật máy đều qua. Một trong ba qua vì một lý do không phải là sự tuân thủ:

```text
file:     src/exceptions/order-not-found.exception.ts
scope:    in — ClassDeclaration extending the bare identifier AbstractException
rule:     exception-metadata-type-named-for-class
law code: IDENTITY-4
message:  none
node:     type annotation
severity: none
hatch:    the rule reads the identifier's spelling only; `OrderNotFoundExceptionMetadata = Record<string, unknown>` resolves no alias and is never checked against the shared metadata base, which is half of what IDENTITY-4 asks for
```

Và một cuộc tái cấu trúc hết sức thông thường gỡ cả ba luật máy khỏi khai báo này mà không đổi một ký tự
nào của danh tính nó:

```ts
export class DomainException extends AbstractException {}

export class OrderNotFoundException extends DomainException {
  constructor(metadata: AbstractExceptionMetadata) {
    super("Order not found", "SOMETHING_ELSE", metadata)
  }
}
```

```text
file:     src/exceptions/order-not-found.exception.ts
scope:    out — superClass identifier is `DomainException`, not `AbstractException`
rule:     exception-name-ends-in-exception | exception-code-matches-class-name | exception-metadata-type-named-for-class
law code: IDENTITY-1 | IDENTITY-2 | IDENTITY-4
message:  none
node:     none
severity: none
hatch:    an intermediate base; the class gate is a literal identifier comparison against one spelling, so every declaration beneath a domain base is invisible rather than compliant
```

## Phạm vi

Mô-đun này ghi lại ba luật máy đã xuất bản và không gì khác. Một luật đáng lẽ nên có nhưng không có
trong nguồn thì không được ghi ở đây; nó là một rủi ro còn mở. `IDENTITY-3` và `IDENTITY-5` do người rà
soát giữ và mô-đun này không tuyên bố gì về chúng. Tính duy nhất giữa các khai báo không thuộc luật máy
nào và không thuộc mô-đun nào ở đây. Tên luật máy được chép nguyên văn vì cái tên chính là danh tính —
đó là chuỗi nhật ký dựng in ra, chuỗi một dòng tắt luật mang theo, và chuỗi mọi cuộc trao đổi về thất
bại ấy đều dùng. Phần chữ và ví dụ không gọi tên sản phẩm nào.
