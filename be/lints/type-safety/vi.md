---
id: be-lints-type-safety-vi
title: vi.md
slug: /be/lints/type-safety/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng luật lint an toàn kiểu — bắt gì, giữ mã nào, phát hiện bằng gì, và cửa nào còn mở.
---

# vi.md

> Version: `2.00` · Mô-đun: `type-safety`

# Máy giữ luật an toàn kiểu

Luật nói một câu: **đừng tắt trình kiểm kiểu**. Mọi cách tắt nó đều trông hợp lý ngay tại chỗ — một
phép ép kiểu làm bản build xanh lại, một kiểu object viết ngay chỗ dùng, một enum viết theo lối rẻ
tiền — và mọi cách đều tàng hình kể từ hôm sau.

Tài liệu này không chép lại luật. Nó ghi **mức thực thi**: mỗi luật lint nhìn vào nút cú pháp nào, và
quan trọng hơn, viết kiểu gì thì nó **không** nhìn thấy.

Mô-đun luật công bố **ba** luật, đúng bằng con số dự kiến, và ở đây ghi đúng ba. Tên của một luật
chính là danh tính của nó — đó là chuỗi in ra trong log build và chuỗi viết trong dòng tắt luật — nên
ở đây không đặt thêm số cho luật nào cả.

Có hai mục nữa nằm trong khối mức nghiêm đề nghị nhưng **không** do mô-đun này công bố: chúng thuộc
plugin TypeScript, được **gọi tên** chứ không được viết lại. Chúng nằm ở phần "Ngoại lệ" và được phản
biện trong `audit.md`, và không có mục riêng ở đây — vì một luật mô-đun này không sở hữu là một luật
mô-đun này không thể tả ruột gan.

## Bảng tra nhanh

| Luật | Mã luật | Bắt gì |
|---|---|---|
| `no-double-cast` | `TYPE-2` (và nửa phần kiểm thử của `TYPE-6`) | Một phép ép kiểu mà toán hạng của nó cũng là một phép ép kiểu về `unknown` — đúng lối viết `x as unknown as T` — trong mọi tệp không thuộc họ spec và cây kiểm thử |
| `no-inline-param-type` | `TYPE-3` | Một tham số **được rã cấu trúc** mang chú thích kiểu là một object type literal trần, trên hàm khai báo, hàm biểu thức hoặc arrow |
| `no-const-enum` | `TYPE-4` | Một khai báo enum mang từ khoá `const`, ở bất kỳ đâu, kèm tên enum chèn vào thông điệp |

Cả ba đều ánh xạ được vào một mã mà văn bản luật thật sự có. Phát hiện trên kệ này không phải là ánh
xạ thiếu, mà là **bốn mã xung quanh** chúng: `TYPE-1` do một luật đi mượn giữ, `TYPE-5` cố ý không có
luật, `TYPE-6` được cài đặt trái với chính câu chữ cho phép nó, và một quyết định đang được thực thi
mà văn bản luật chưa hề công bố.

---

## `no-double-cast`

**Bắt gì.** Đúng một lối viết: `x as unknown as T`. Đây là trình biên dịch nói rằng hai kiểu này
không giao nhau, rồi bị bác bỏ hai lần. Nó tệ hơn `any` ở đúng một điểm — kết quả **tự nhận** mình là
kiểu đích, nên mọi thứ phía sau tin nó tuyệt đối, và chỗ vỡ sẽ hiện ra rất xa dòng đã gây ra nó.

**Giữ mã nào.** `TYPE-2`, và nửa phần kiểm thử của `TYPE-6` — lối ra dành cho spec nằm ngay trong
luật này.

**Cách phát hiện.** Duyệt nút `TSAsExpression`. Báo khi `node.expression.type === "TSAsExpression"`
**và** chú thích kiểu của phép ép bên trong là `TSUnknownKeyword`. Nút được báo là phép ép **bên
ngoài**. Cổng tệp được tính **một lần** trong `create` và trả về một bộ duyệt **rỗng** cho cả tệp:
lấy `context.filename` (dự phòng `context.getFilename()`), đổi hết dấu chéo ngược thành chéo xuôi,
rồi thử với `/\.(?:spec|test|e2e-spec|int-spec|harness-spec)\.ts$/` hoặc kiểm xem đường dẫn có chứa
đoạn `/src/tests/` không.

**Vì sao luật này đáng có máy giữ.** Vì một phép ép kép không bao giờ tự nhận mình là một quyết định.
Nó xuất hiện lúc bốn giờ chiều, khi một kiểu trả về không khớp và bản build đang đỏ, và nó **hiệu quả
ngay lập tức** — đó mới là vấn đề. Người review sau đọc `as unknown as` không thấy một luật bị phá, mà
thấy một chỗ ai đó đã phải xử lý một trường hợp khó, nên không hỏi lại. Trình kiểm kiểu là người
review duy nhất đọc hết mọi dòng và không bao giờ mệt; dòng này là dòng duy nhất nó bị bịt miệng mà
vẫn ký tên.

**Cửa còn mở.** Nhiều, và cửa rộng nhất rẻ đến mức không ai coi là lách. **Tách làm hai câu lệnh** —
`const loose: unknown = row` rồi `return loose as Enrollment` — giặt sạch y hệt, chỉ khác là toán
hạng giờ là một định danh; đây là việc người ta làm khi dòng code dài quá. **Đổi cầu nối**: chỉ mỗi
`TSUnknownKeyword` được thử, nên `x as any as T`, `x as never as T`, `x as {} as T` đều lọt — và
`as never as` đáng được nói riêng, vì `never` gán được vào mọi kiểu, giặt mạnh y hệt, mà lại **không**
có luật thứ hai nào đứng chờ phía sau như trường hợp `any`. **Lối ngoặc nhọn** `<T><unknown>value` là
nút `TSTypeAssertion`, một nút khác hẳn. **Một hàm ép kiểu tổng quát** — `<T,>(value: unknown): T =>
value as T` — chỉ chứa một phép ép, hợp lệ ở mọi nơi, và từ đó mọi chỗ gọi giặt sạch mà không còn
phép ép nào. **Một type guard không kiểm gì** — `(row: unknown): row is Enrollment => true` — tạo ra
đúng niềm tin đó với không một phép ép nào trong tệp; chính phương thuốc mà luật kê ra là thứ một
luật cú pháp không kiểm chứng nổi. Và cuối cùng là **tên tệp**: cổng là lối ra cho cả tệp theo hậu
tố, nên đổi tên một mô-đun sản phẩm thành `.spec.ts` là tắt luật cho toàn bộ nội dung của nó; còn
đoạn `/src/tests/` miễn cho **mọi** tệp nằm dưới nó, mãi mãi, kể cả một factory mà mã sản phẩm đang
import.

---

## `no-inline-param-type`

**Bắt gì.** Một tham số được rã cấu trúc mang kiểu viết thẳng tại chỗ:
`({ userId, courseId }: { userId: string; courseId: string })`. Kiểu đó không tham chiếu được, không
import được, không mở rộng được — nên người gọi thứ hai gõ lại nó, và khi trường thứ ba xuất hiện thì
chỉ một trong hai bản chép nhận được.

**Giữ mã nào.** `TYPE-3`.

**Cách phát hiện.** Duyệt `FunctionDeclaration`, `FunctionExpression` và `ArrowFunctionExpression`,
rồi đi qua `node.params`. Mỗi tham số được bóc **một lần**: nếu kiểu nút là `TSParameterProperty` thì
đọc `.parameter` thay thế. Báo khi nút thu được có kiểu đúng bằng `ObjectPattern`, có `typeAnnotation`,
và chú thích bên trong có kiểu đúng bằng `TSTypeLiteral`. Nút được báo là **chú thích kiểu**, không
phải cái pattern. Không có cổng tệp nào.

**Vì sao luật này đáng có máy giữ.** Vì viết kiểu ngay tại chỗ là hành động **tiết kiệm** chứ không
phải hành động ẩu: người viết đang giữ mọi thứ liên quan đứng cạnh nhau, và ở thời điểm đó điều đó
đúng. Nó chỉ hỏng ở lần gọi thứ hai, và lần gọi thứ hai thường do người khác viết, ở tệp khác, vài
tuần sau — nghĩa là người phải trả giá không phải người đã quyết. Đó chính là loại quyết định không
ai review bắt được, vì tại thời điểm review nó đúng.

**Cửa còn mở.** Cửa rộng nhất là **không rã cấu trúc**: `(params: { userId: string })` là một tham số
`Identifier`, nên luật không hề nhìn tới chú thích của nó — trong khi hình dạng vẫn không tham chiếu
được, vẫn không import được, và vẫn sẽ bị gõ lại y hệt. Đó lại là lối viết phổ biến hơn.
**Cho tham số một giá trị mặc định** biến nút thành `AssignmentPattern`, mà phép bóc chỉ xử lý được
vỏ `TSParameterProperty`, nên thêm `= {}` là xoá luật. **Bọc cái literal lại** cũng vậy: chú thích
phải đúng bằng `TSTypeLiteral`, nên giao (`&`), hợp (`| undefined`) hay `Readonly<…>` đều đi qua,
trong khi hình dạng vẫn bị chôn trong chữ ký. **Bốn loại nút hàm khác không được duyệt**:
`TSFunctionType` trong một type alias, `TSMethodSignature` trong interface, `TSDeclareFunction` cho
chữ ký nạp chồng, và thân rỗng của một phương thức abstract. Và tinh vi nhất: **một alias cục bộ
không export** thoả mãn luật hoàn toàn, trong khi vẫn không import được — luật giữ được chữ "có tên",
còn văn bản luật đòi một kiểu có tên **trong thư mục types của mô-đun**, và khoảng cách giữa hai điều
đó thì một cây cú pháp không nhìn thấy.

---

## `no-const-enum`

**Bắt gì.** Một khai báo `const enum`. Nó được nội tuyến lúc biên dịch và **không có object lúc chạy**:
không duyệt được, không ánh xạ ngược được, và không qua nổi ranh giới isolated-modules. Nó tiết kiệm
vài byte và làm hỏng cả một họ những việc đơn giản là không chạy.

**Giữ mã nào.** `TYPE-4`.

**Cách phát hiện.** Duyệt `TSEnumDeclaration`; thoát ra nếu cờ boolean `node.const` không bật; còn
lại thì báo trên chính khai báo đó và chèn `node.id.name` vào thông điệp. Không cổng tệp, không miễn
trừ, không lối ra cho kiểm thử.

**Vì sao luật này đáng có máy giữ.** Vì đây là luật duy nhất trên kệ mà **hậu quả nằm ở nơi khác hoàn
toàn với nguyên nhân**. Khai báo biên dịch sạch. Chỗ vỡ nằm ở dòng `Object.values(Status)` viết sáu
tháng sau, ở một tệp khác, bởi một người không biết cái enum đó được khai báo thế nào — và thông báo
lỗi lúc đó không hề nhắc tới từ khoá `const`. Máy giữ luật này bắt được vấn đề tại **một** dòng thay
vì tại tất cả những chỗ nó phát tác.

**Cửa còn mở.** Cửa thẳng nhất là **`declare enum`**: một enum ambient không có từ khoá `const` cũng
không sinh object lúc chạy, cũng không duyệt được, cũng không ánh xạ ngược được — đúng thất bại mà
thông điệp mô tả, đạt tới bằng một từ khoá luật không đọc. `node.const` bằng false, nên im lặng.
Cửa thứ hai là **tệp khai báo**: const enum ambient sống ở `.d.ts`, và cấu hình thông thường không
trỏ linter vào đó. Cửa thứ ba là **const enum của người khác**: luật canh khai báo chứ không canh chỗ
dùng, nên một const enum nhập từ một gói phụ thuộc mang đủ mọi thất bại kể trên, tại mọi chỗ dùng, mà
được khai báo ở một tệp mô-đun này không bao giờ thấy. Và vì luật **không có cổng tệp nào của riêng
nó**, tầm với của nó đúng bằng tập glob mà kho tiêu thụ đưa cho — thư mục sinh mã và thư mục công cụ
thường nằm ngoài, mà một bộ sinh mã phun ra `const enum` mới là trường hợp không ai review.

## Luật

1. Danh tính của một luật là **tên công bố** của nó. Không đặt thêm số.
2. Phát hiện thuần cú pháp: không phân giải mô-đun, không hỏi kiểu, không đọc tuỳ chọn biên dịch,
   không chạy mã.
3. **Hai trong ba luật không có cổng tệp nào.** Phạm vi của chúng đúng bằng thứ mà cấu hình của kho
   tiêu thụ trỏ vào, không hẹp hơn.
4. Mô-đun công bố ba luật; khối mức nghiêm đề nghị nêu năm mục, hai mục thuộc plugin khác và là một
   phụ thuộc cứng vào việc plugin đó có được đăng ký hay không.
5. Miễn trừ duy nhất trên kệ là lối ra **cho cả tệp**, không phải một cặp tệp-cộng-giá-trị.
6. Mức nghiêm mà mô-đun tự đề nghị là `error` cho cả năm mục; cấu hình của kho tiêu thụ mới là nơi
   quyết định thật sự bật cái gì.

## Ngoại lệ

- **Họ spec và cây kiểm thử** được miễn `no-double-cast`, và không được miễn gì khác. Dựng một giá
  trị sai có chủ đích chính là cách một bài spec chứng minh rằng một API đóng từ chối nó. Lối ra này
  là **cho cả tệp**: bên trong một tệp được miễn, luật không tồn tại, chứ không phải luật cho phép
  một cấu trúc.
- **Năm hậu tố được nhận** là `.spec.ts`, `.test.ts`, `.e2e-spec.ts`, `.int-spec.ts`,
  `.harness-spec.ts`, cộng với mọi đường dẫn có đoạn `/src/tests/`. Danh sách hậu tố đóng và có neo
  đuôi; đoạn thư mục thì không.
- **Hai luật còn lại không có miễn trừ nào.** Một `const enum` trong tệp spec vẫn bị báo; một kiểu
  viết thẳng trong tệp kiểm thử vẫn bị báo.
- **`TYPE-5` không có luật nào giữ**, theo một quyết định có lập luận ghi ngay ở đầu mô-đun luật:
  muốn biết một tập boolean đang tả **một** tình huống hay nhiều tình huống độc lập thì phải hiểu mã
  đang nói gì, và một luật đoán mò sẽ nổ trên mọi bản ghi có hai lá cờ.
- **`TYPE-1` do `@typescript-eslint/no-explicit-any` giữ**, còn lối viết kiểu mảng do
  `@typescript-eslint/array-type` giữ. Cả hai được gọi tên trong khối đề nghị, không cái nào do mô-đun
  này công bố, và kệ này không tả ruột gan cái nào cả.
