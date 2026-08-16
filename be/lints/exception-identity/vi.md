---
id: be-lints-exception-identity-vi
title: vi.md
slug: /be/lints/exception-identity/vi
sidebar_label: vi.md
sidebar_position: 1
description: Ba luật máy giữ danh tính ngoại lệ — bắt gì, phát hiện bằng gì, và cửa nào còn mở.
---

# vi.md

> Version: `2.00` · Mô-đun: `exception-identity`

# Danh tính ngoại lệ — phần máy giữ được

Một thất bại có **một** cái tên, viết bằng ba thứ chữ: tên lớp, mã trên đường truyền, và tên kiểu của
gói dữ liệu đi kèm. Ba thứ chữ đó do ba phía đọc, và không phía nào đọc được hai thứ còn lại.

Tài liệu này **không** nhắc lại luật. Nó ghi lại phần **máy giữ**: máy nhìn thấy gì, nhìn bằng cách
nào, và — phần thường không ai chép ra — máy **không** nhìn thấy gì. Một điều luật không có luật máy
thì ai cũng biết là chưa được giữ. Một luật máy bị tin là kín trong khi nó hở thì nguy hơn, vì nó đã
lấy mất sự chú ý của người đọc mà không đổi lại được gì.

Cả ba luật đều nằm trong gói `@starci/eslint-canon-be` và đều đặt ở mức `error`.

## Bảng tra nhanh

| Tên luật máy | Mã luật | Bắt gì |
|---|---|---|
| `exception-name-ends-in-exception` | `IDENTITY-1` | Lớp kế thừa lớp nền của nhà mà tên không kết thúc bằng `Exception` |
| `exception-code-matches-class-name` | `IDENTITY-2` | Mã truyền vào `super()` có chữ khác chữ của tên lớp, hoặc mã không phải một chuỗi viết thẳng |
| `exception-metadata-type-named-for-class` | `IDENTITY-4` | Tham số dữ liệu kèm theo không khai kiểu, hoặc khai một kiểu không mang tên lớp |

Ba nhận định phải nói ngay ở bảng này, và được lập luận đầy đủ trong [`audit.md`](./audit.md):

- Luật máy thứ ba **đề sai mã ngay trong nguồn của nó**: dòng phân đoạn ghi `IDENTITY-3`, trong khi
  `IDENTITY-3` của luật là điều về đổi tên. Điều về tên kiểu dữ liệu kèm theo là `IDENTITY-4`.
- `IDENTITY-3` và `IDENTITY-5` **không có luật máy nào**. Một điều trải qua hai lần sửa của cùng một
  tệp, một điều là phán đoán về ý định — không điều nào hiện ra trong một lần đọc tệp. Chính luật đã
  nói rõ hai điều đó do người rà soát giữ.
- **Không luật máy nào bắt được hai lớp cùng một mã.** Luật thứ hai so mã với tên lớp của chính nó,
  chứ không so mã này với mã kia.

---

## `exception-name-ends-in-exception`

**Bắt gì.** Một lớp kế thừa `AbstractException` nhưng tên không kết thúc bằng `Exception`. Thông điệp
`suffix`, kèm tên nên đổi thành.

**Giữ mã nào.** `IDENTITY-1`.

**Cách phát hiện.** Vào nút `ClassDeclaration`. Đòi có `node.id`, đòi `node.superClass.type` là
`Identifier` và `node.superClass.name` đúng chuỗi `"AbstractException"`. Sau đó thử biểu thức chính
quy `/Exception$/` lên `node.id.name`. Báo lên đúng nút tên lớp. Không đọc tên tệp, không giải một
lệnh nhập nào, không có tuỳ chọn.

**Vì sao luật này đáng có máy giữ.** Vì đây là luật máy làm cho những luật máy khác trở nên có thật.
Luật về lớp nền, luật về thư mục và luật về đối tượng dữ liệu kèm theo đều nhận diện ngoại lệ bằng
đuôi `Exception`; luật về nơi ném thì chỉ biết `Error` và mấy cái tên của khung nền. Cho nên một thất
bại đặt tên `SomethingError` sẽ nằm đúng thư mục, kế thừa đúng lớp nền, được ném ở những nơi thật —
và **không một luật máy nào kiểm nó**. Cổng im lặng, và im lặng thì đọc y như đồng ý. Đây là loại lỗi
đắt nhất: không phải lỗi bị bỏ qua, mà lỗi được báo cáo là sạch.

**Cửa còn mở.**

- Chỉ cần **một tầng kế thừa trung gian** là luật này biến mất: `class DomainException extends
  AbstractException {}` rồi `class OrderNotFound extends DomainException {}` — lớp thứ hai không được
  coi là ngoại lệ của nhà, vì cổng so **đúng một chuỗi** ở chỗ `extends`.
- Đổi tên khi nhập — `import { AbstractException as Base }` rồi `extends Base` — cũng tắt luật, bằng
  một dòng.
- `export default class extends AbstractException {}` không có `node.id`, nên bị bỏ qua.
- `const X = class extends AbstractException {}` là `ClassExpression`, luật không hề vào nút đó.
- `/Exception$/` chỉ thử **cái đuôi**, không thử ý nghĩa. `class Exception`, hay
  `class OrderErrorException`, đều lọt.

---

## `exception-code-matches-class-name`

**Bắt gì.** Hai việc, hai thông điệp riêng:

- `mismatch` — mã báo ra có chữ khác chữ của tên lớp. Đây là mã chép từ ngoại lệ viết ngay bên trên,
  và là mã còn sót lại sau một lần đổi tên lớp.
- `notLiteral` — mã không phải một chuỗi viết thẳng, mà được lắp ở lúc chạy hoặc lấy từ chỗ khác.

**Giữ mã nào.** `IDENTITY-2`.

**Cách phát hiện.** Qua cùng cổng lớp như trên. Tìm `MethodDefinition` có `kind` là `constructor`
trong `node.body.body`. Rồi quét **chỉ những câu lệnh ở tầng trên cùng** của hàm dựng, tìm
`ExpressionStatement` mà biểu thức là `CallExpression` với `callee` kiểu `Super`. Lấy `arguments[1]`.
Nếu không phải `Literal` mang giá trị chuỗi thì báo `notLiteral`. Nếu là chuỗi thì bỏ hết dấu gạch
dưới, viết hoa cả hai vế rồi so; khác nhau thì báo `mismatch`.

Phần bỏ gạch dưới là cố ý và đúng: `GRAPHQL_DATA...` với `GRAPH_QL_DATA...` gọi tên cùng một lớp, một
từ viết tắt không có cách tách đúng duy nhất, và một luật máy đòi một cách tách sẽ nổ vào đoạn mã
không sai gì cả.

**Vì sao luật này đáng có máy giữ.** Vì mã là thứ **phía khách** khớp vào. Nó được đóng lên mọi lỗi
trả về, và phía giao diện phân nhánh theo nó chứ không theo mã trạng thái, bởi một phản hồi có thể
mang nhiều lỗi khác mức nặng nhẹ. Suy ra mã từ tên lớp cho hai thứ cùng lúc. Thứ nhất: không ai phải
tra cứu — cầm tên lớp là biết mã, cầm mã là tìm ra lớp bằng cách tìm chuỗi. Thứ hai: **tính duy nhất
không tốn công gì**. Mã chép từ ngoại lệ bên trên là cách thông thường nhất để hai thất bại không
liên quan đến nhau đến tay phía khách y hệt nhau — và chuyện đó đã xảy ra: một thử thách đăng nhập và
một thử thách bài học báo cùng một mã, nên không ai phân biệt được. Còn mã lắp ở lúc chạy thì phá
đúng cái việc mà mọi người dùng mã đều làm: **tìm nó**.

**Cửa còn mở.**

- **`super()` nằm trong một khối** thì không tìm thấy. Đặt nó vào `if`, `try` hay `switch` là luật
  trả về mà không báo gì — mà đó lại đúng là hình dạng một mã có điều kiện sẽ mang.
- **Không truyền mã** thì không bị bắt: `arguments.length < 2` trả về sớm, nên `super("Không tìm
  thấy")` đi qua sạch sẽ.
- **Không kiểm chữ hoa chữ thường.** Hai vế đều được viết hoa trước khi so, nên
  `"order_not_found_exception"` lọt, dù luật viết là SCREAMING_SNAKE.
- **Không kiểm có dấu gạch dưới hay không**, vì gạch dưới bị bỏ trước khi so. `"ORDERNOTFOUNDEXCEPTION"`
  lọt: không ai đọc nổi, và hợp lệ.
- **Hàm dựng thừa kế** thì không có gì để đọc; `if (!ctor) return`.
- Mọi cửa của cổng lớp ở luật thứ nhất áp nguyên vào đây.

---

## `exception-metadata-type-named-for-class`

**Bắt gì.** Hai việc:

- `untyped` — tham số đầu tiên của hàm dựng được tách rời mà **không khai kiểu**.
- `named` — có khai kiểu, nhưng tên kiểu không phải `<TênLớp>Metadata`.

**Giữ mã nào.** `IDENTITY-4`.

**Cách phát hiện.** Qua cùng cổng lớp và cổng hàm dựng. Lấy `params[0]`; nếu là `AssignmentPattern`
thì lấy `.left` của nó. Đòi kiểu nút là `ObjectPattern`. Đọc
`param.typeAnnotation.typeAnnotation`: không có thì báo `untyped`. Có, mà là `TSTypeReference` với
`typeName` kiểu `Identifier`, thì so tên đó với `` `${tênLớp}Metadata` ``. Mọi hình dạng kiểu khác bị
**bỏ qua không báo**.

Việc gỡ `AssignmentPattern` là một sửa lỗi có thật và nguồn ghi lại: `{ … }: Metadata = {}` bị phân
tích thành một mẫu gán bọc ngoài mẫu tách rời, và lần đo đầu tiên chỉ đọc nút ngoài đã **bỏ sót đúng
những khai báo mà luật này sinh ra để bắt**.

**Vì sao luật này đáng có máy giữ.** Vì tham số đó là **toàn bộ hợp đồng** mà nơi ném phải thoả. Một
tham số không kiểu nhận mọi đối tượng, kể cả cái thiếu đúng cái mã định danh mà thất bại này sinh ra
để mang theo. Còn một tham số khai bằng kiểu nền dùng chung thì nói rằng "thất bại này không mang gì
cả" — câu đó hết đúng ngay khi có người cần đính một mã định danh vào, và đúng lúc ấy kiểu nền đang
được **mọi** ngoại lệ khác dùng chung, nên chỗ để thêm trường không tồn tại và khai báo phải bị nắn
lại trước khi được mở rộng. Đặt tên kiểu theo tên ngoại lệ còn cho người cầm tên thất bại tìm ra gói
dữ liệu của nó mà không cần mở tệp.

**Cửa còn mở.**

- **Tham số không tách rời** — `constructor(metadata: AbstractExceptionMetadata)` — là `Identifier`
  chứ không phải `ObjectPattern`, nên luật trả về trước khi kịp đọc kiểu. Đúng cái lỗi luật sinh ra
  để bắt, viết lệch đi một dấu ngoặc.
- **Kiểu viết thẳng hoặc kiểu ghép** — `{ id }: { id?: string }`, hay
  `{ id }: AbstractExceptionMetadata & { id?: string }` — không phải `TSTypeReference`, bị bỏ qua.
- **Tên kiểu có tiền tố không gian tên** — `{ id }: Errors.OrderNotFoundExceptionMetadata` — có
  `typeName` là `TSQualifiedName`, bị bỏ qua, dù nó có thể đang rất đúng.
- **Luật chỉ đọc cái tên, không bao giờ đọc cái kiểu.** `export type OrderNotFoundExceptionMetadata =
  Record<string, unknown>` lọt sạch: không alias nào được giải, và không có chỗ nào kiểm rằng kiểu đó
  kế thừa kiểu nền dùng chung như `IDENTITY-4` đòi.
- **Chỉ đọc `params[0]`.** Tham số dữ liệu kèm theo đứng ở vị trí thứ hai là vô hình.

---

## Luật

1. Ba luật máy trên giữ `IDENTITY-1`, `IDENTITY-2` và `IDENTITY-4`. `IDENTITY-3` và `IDENTITY-5` do
   người rà soát giữ, và tài liệu này không được viết như thể chúng đã có máy.
2. Tên luật máy là **danh tính** của nó. Chép nguyên văn, kể cả trong tài liệu tiếng Việt, vì đó là
   chuỗi in ra trong nhật ký dựng và chuỗi viết trong một dòng tắt luật.
3. Không luật nào đọc tên tệp, nên không thư mục nào, không hậu tố nào, không tệp dữ liệu mẫu nào
   được miễn.
4. Không luật nào có tuỳ chọn. Muốn nới thì chỉ còn cách tắt hẳn, và tắt hẳn thì nhìn thấy được.
5. Không luật nào có bộ tự sửa. Tên gợi ý trong thông điệp là chữ, không phải bản vá.
6. Cửa còn mở phải được ghi ra. Một cửa không ai biết nguy hơn một điều luật không có luật máy.

## Ngoại lệ

Ngoại lệ là **một phần của phần máy giữ**, không phải chỗ lách. Mỗi ngoại lệ nêu rõ nó bước qua luật
máy nào và vì lý do gì.

- **Một phía khách đã phát hành còn khớp mã cũ.** `IDENTITY-3` nói lớp giữ tên cũ cho tới khi phía
  khách đó ngừng dùng. Nếu đã trót đổi tên rồi, hình thức trung thực là một dòng tắt luật ngay trên
  lời gọi `super()`, ghi rõ phía khách nào và ngày ngừng — chứ không phải bịa ra một cái tên thứ hai
  để cho luật máy im.
- **Khai báo do máy sinh hoặc do nơi khác viết.** Tắt ở mức tệp, kèm một câu nói rõ ai là tác giả.
- **Cách tách từ viết tắt** không phải ngoại lệ: luật máy vốn không nổ. Ghi ở đây vì đây là báo cáo
  người đọc hay chờ nhất mà không bao giờ nhận được.
- **Lớp không có hàm dựng riêng** nằm ngoài luật thứ hai và thứ ba do cấu tạo, không phải do được
  cho phép. Nếu nó thừa kế một danh tính thì danh tính ấy được rà soát ở nơi nó được viết ra.
