---
id: be-lints-exception-identity-audit
title: audit.md
slug: /be/lints/exception-identity/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện phần máy giữ danh tính ngoại lệ — đếm lại luật, soi từng cửa còn mở.
---

# audit.md

> Version: `2.00` · Mô-đun: `exception-identity`

Phản biện này hỏi một câu duy nhất: **cái cổng này đang giữ được đúng bao nhiêu, và người đọc có
đang tin nó giữ nhiều hơn thế không?**

## Verdict

Chấp nhận, kèm ba nhận định và mười bốn cửa còn mở phải được ghi vào tài liệu chứ không được làm gọn
đi.

Ba luật máy đều đúng việc chúng nhận, đều có bộ kiểm song sinh, đều ở mức `error`, và đều đi qua một
giai đoạn `warn` có sổ nợ nêu tên từng chỗ vi phạm trước khi được nâng — đúng thứ tự nên làm, vì một
luật bật lên ở mức `error` trên một đống vi phạm sẵn có sẽ dạy người đọc lướt qua nó, và ai đã học
được cách lướt qua một luật thì không đọc luật nào nữa.

Điều **không** chấp nhận được là đọc ba luật này thành "danh tính ngoại lệ đã có máy giữ". Chúng giữ
ba trong năm điều, và giữ ba điều ấy trên **đúng một hình dạng mã** duy nhất.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| Nguồn công bố mấy luật? | Đúng **ba**, khớp với con số dự kiến. Đếm ở `rules` và ở `recommended`, hai chỗ khớp nhau. |
| Mỗi luật có gắn được vào một mã của luật không? | Ba trên ba: `IDENTITY-1`, `IDENTITY-2`, `IDENTITY-4`. Không luật nào phải bịa ánh xạ. |
| Mã nào của luật không có luật máy? | `IDENTITY-3` và `IDENTITY-5`. Chính luật đã nói rõ hai điều đó do người rà soát giữ. |
| Tên luật máy có bị viết lại trong tài liệu không? | Không. Cả ba tên được chép nguyên văn ở cả năm tài liệu, kể cả trong bản tiếng Việt. |
| Có luật nào đọc tên tệp không? | Không luật nào. Không có `context.filename` ở bất kỳ đâu trong tệp nguồn. |
| Có luật nào có tuỳ chọn không? | Không. Cả ba khai `schema: []`, nên nới lỏng chỉ còn cách tắt hẳn — mà tắt hẳn thì nhìn thấy được. |
| Có luật nào có bộ tự sửa không? | Không. Tên gợi ý trong thông điệp là chữ, không phải bản vá. |
| Hằng số có làm sạch được một chuỗi vi phạm không? | **Không**, ở luật thứ hai: hằng số và phần tử bảng liệt kê đều bị báo `notLiteral`. Cửa "gom vào hằng số" — cửa quen thuộc nhất của loại luật khớp chuỗi — đóng ở đây. |
| Một hình dạng cú pháp khác có làm sạch được không? | **Có**, ở cả ba. Đây là toàn bộ nội dung mục "Rủi ro còn mở". |

## Findings

**F-1 · Luật máy thứ ba đề sai mã ngay trong nguồn của nó.** Dòng phân đoạn trong tệp nguồn ghi
`-- IDENTITY-3 --` cho `exception-metadata-type-named-for-class`, nhưng `IDENTITY-3` của luật là điều
về đổi tên lớp kéo theo đổi mã trên đường truyền. Điều về tên kiểu dữ liệu kèm theo là `IDENTITY-4`.
Đây là lỗi ghi chú, không phải lỗi hành vi — luật máy làm đúng việc `IDENTITY-4` mô tả. Tài liệu này
ánh xạ theo luật, không theo dòng phân đoạn.

**F-2 · Câu đếm trong văn bản luật thấp hơn thực tế.** Trang luật viết rằng "hai trong các điều của
nó được giữ ở đó". Nguồn công bố ba luật máy, giữ ba điều. Con số hai đúng vào một thời điểm nào đó
và đã lạc hậu.

**F-3 · Không luật nào bắt được hai lớp cùng một mã.** `IDENTITY-2` được viết ra phần lớn vì một mã
bị chép, nhưng luật máy so mã với **tên lớp của chính nó**, chứ không so mã này với mã kia. Bản chép
bị bắt chỉ vì nó lệch với tên lớp mới. Hai lớp **trùng tên** ở hai thư mục khác nhau sẽ cùng qua và
cùng phát ra một mã — đúng cái lỗi mà điều luật này sinh ra để chặn.

**F-4 · Ba luật cùng dùng chung một cổng, nên chúng cùng sống cùng chết.** `isHouseException` là một
phép so chuỗi duy nhất. Không có ba lớp phòng thủ ở đây; có một lớp, dùng ba lần.

**F-5 · Luật thứ hai báo `notLiteral` cho cả chuỗi mẫu không có phần thay thế.** `` `ORDER_NOT_FOUND_EXCEPTION` ``
viết bằng dấu nháy ngược là một hằng chuỗi tìm được bằng cách tìm chuỗi, nhưng nút của nó là
`TemplateLiteral` chứ không phải `Literal`, nên bị báo với thông điệp nói rằng mã "được lắp" — câu đó
không đúng với trường hợp này. Đây là báo thừa, không phải báo sót, nên rẻ; sửa bằng cách chấp nhận
`TemplateLiteral` không có `expressions`.

## Decisions

- Giữ đúng ba luật máy đang có, không tài liệu hoá luật nào chưa tồn tại. Một luật chưa chỉ tay vào
  được là một đề xuất, không phải một luật.
- Ánh xạ `exception-metadata-type-named-for-class` vào `IDENTITY-4` theo văn bản luật, và ghi dòng
  phân đoạn sai thành **F-1** thay vì lặng lẽ sửa tài liệu cho khớp nguồn.
- Ghi `IDENTITY-3` và `IDENTITY-5` là **không có luật máy** ở cả bảng ánh xạ trong `example.md`, chứ
  không suy chúng vào một luật gần giống.
- Chép nguyên văn tên luật máy ở mọi tài liệu. Tên là danh tính; một cái tên thứ hai sẽ tạo ra hai
  cách gọi một luật và không cách nào biết thông điệp đến từ đâu.
- Coi bảng **Cửa còn mở** là phần bắt buộc của mô-đun này. Không viết "không có" cho gọn.
- Không đề xuất nới bất kỳ luật nào. Mọi rủi ro dưới đây là **báo sót**, và cách chữa báo sót là mở
  rộng cái luật nhìn thấy, không phải hạ mức nghiêm.

## Rủi ro còn mở

Mỗi mục nêu cửa, rồi nêu **luật máy phải soi thêm cái gì** mới đóng được nó — hoặc vì sao đóng đắt
hơn để mở.

**R-1 · Lớp nền trung gian tắt cả ba luật.** Cổng so đúng chuỗi `"AbstractException"` ở chỗ `extends`,
nên `class X extends DomainException` là vô hình dù `DomainException` kế thừa lớp nền. **Đóng bằng
cách nào:** luật phải dựng được cây kế thừa trong phạm vi dự án, tức là phải giải lệnh nhập và đọc
tệp khác — một luật một-tệp không làm được. Cách rẻ hơn và đóng được ngay: nhận thêm một danh sách
tên lớp nền đóng, hoặc coi **mọi** lớp có tên kết thúc bằng `Exception` là ngoại lệ của nhà đối với
luật thứ hai và thứ ba. Rủi ro này là **nặng nhất trong mô-đun** vì nó tắt cả ba luật cùng lúc bằng
một thao tác dọn dẹp bình thường.

**R-2 · Đổi tên khi nhập.** `import { AbstractException as Base }` rồi `extends Base`. **Đóng bằng
cách nào:** đọc các nút `ImportSpecifier` trong cùng tệp và thu thập mọi tên địa phương trỏ về lớp
nền — việc này **nằm gọn trong một tệp**, nên rẻ, và nên làm. Đây là cửa dễ đóng nhất trong danh
sách.

**R-3 · Lớp xuất mặc định không tên và biểu thức lớp.** `node.id` rỗng, hoặc nút là `ClassExpression`.
**Đóng bằng cách nào:** thêm `ClassExpression` vào bộ nút thăm và lấy tên từ khai báo biến bao ngoài
khi có. Với lớp xuất mặc định không tên thì không có tên để kiểm — chỗ đúng để chặn là một luật cấm
xuất mặc định một ngoại lệ, tức một luật khác chứ không phải luật này.

**R-4 · `super()` nằm trong khối.** Bộ quét chỉ đọc câu lệnh tầng trên cùng của hàm dựng. **Đóng bằng
cách nào:** đi đệ quy xuống thân các khối, hoặc thăm thẳng nút `CallExpression` có `callee` kiểu
`Super` và tự hỏi ngược lên xem nó nằm trong hàm dựng nào. Cách thứ hai rẻ và bắt được mọi vị trí.
Đáng làm, vì nhiều lời gọi `super()` với mã khác nhau chính là cách một lớp mang **hai** danh tính,
đúng thứ điều luật này chặn.

**R-5 · Không truyền mã.** `super("Không tìm thấy")` đi qua vì `arguments.length < 2`. **Đóng bằng
cách nào:** báo ngay tại chỗ khi có lời gọi `super()` với ít hơn hai đối số bên trong một ngoại lệ
của nhà. Việc trả về sớm hiện tại là để tránh nổ vào lời gọi chuyển tiếp `super(...args)`; phân biệt
hai trường hợp đó là đọc thêm một nút `SpreadElement`, không đắt.

**R-6 · Không kiểm chữ hoa chữ thường.** Cả hai vế được viết hoa trước khi so, nên
`"order_not_found_exception"` qua. **Đóng bằng cách nào:** thêm một phép thử độc lập rằng chuỗi mã
bằng chính nó khi viết hoa. Rẻ, và nên làm — phía khách khớp chuỗi thì phân biệt hoa thường, nên đây
là một khác biệt **nhìn thấy được trên đường truyền** mà cổng đang bỏ qua.

**R-7 · Không kiểm dấu gạch dưới.** `"ORDERNOTFOUNDEXCEPTION"` qua, vì gạch dưới bị bỏ trước khi so.
**Đóng bằng cách nào:** không nên đóng chặt. Chính việc bỏ gạch dưới là thứ cho phép luật im lặng
trước những cách tách từ viết tắt khác nhau, mà không có cách tách nào đúng duy nhất. Một phép thử
chỉ đòi "có ít nhất một gạch dưới khi tên lớp có nhiều hơn một từ" sẽ bắt được trường hợp thoái hoá
này mà không đụng vào từ viết tắt. Đây là mục duy nhất trong danh sách mà **giá của việc đóng chặt
cao hơn giá trị**.

**R-8 · Hàm dựng thừa kế.** Không có hàm dựng riêng thì luật thứ hai và thứ ba không có gì để đọc.
**Đóng bằng cách nào:** phải đi ngược cây kế thừa, tức là cùng chi phí với **R-1**. Cùng một cách
chữa cho cả hai.

**R-9 · Tham số dữ liệu kèm theo không tách rời.** `constructor(metadata: SomeType)` bị bỏ qua vì
không phải `ObjectPattern`. **Đóng bằng cách nào:** đọc phần khai kiểu của `params[0]` **bất kể**
kiểu nút của nó là gì. Cửa này là một dòng mã, và nó đang để lọt đúng cái lỗi mà luật sinh ra để bắt.
Nên đóng trước tiên.

**R-10 · Kiểu viết thẳng và kiểu ghép.** `{ id }: { id?: string }` và
`{ id }: A & { id?: string }` đều bị bỏ qua vì không phải `TSTypeReference`. **Đóng bằng cách nào:**
báo `named` cho mọi phần khai kiểu **không** phải một tham chiếu kiểu tên đơn khớp mẫu, thay vì trả
về im lặng. Việc trả về hiện nay là "không biết thì không nói", mà ở một cổng thì "không biết" nên
đọc thành "chưa đạt", không phải "đạt".

**R-11 · Tên kiểu có tiền tố không gian tên.** `Errors.XMetadata` có `typeName` là `TSQualifiedName`.
**Đóng bằng cách nào:** lấy phần bên phải cùng của tên phân cấp rồi so. Rẻ. Hiện tại cửa này bỏ sót
cả khai báo đúng lẫn khai báo sai, nên nó vừa mở vừa gây hiểu nhầm rằng khai báo đúng đã được duyệt.

**R-12 · Luật đọc tên kiểu, không đọc kiểu.** `type XMetadata = Record<string, unknown>` qua sạch.
**Đóng bằng cách nào:** cần thông tin kiểu, tức là cần dịch vụ kiểm kiểu — một chi phí khác hẳn về
bậc. Cách rẻ trong tầm một tệp: thêm một luật riêng đòi mọi khai báo kiểu tên `*ExceptionMetadata`
phải kế thừa hoặc bằng kiểu nền dùng chung. Nửa còn lại của `IDENTITY-4` hiện **không có ai giữ**.

**R-13 · Chỉ đọc `params[0]`.** Tham số dữ liệu kèm theo đứng thứ hai là vô hình. **Đóng bằng cách
nào:** quét mọi tham số tìm cái có phần khai kiểu khớp mẫu `*Metadata`, hoặc thêm một luật đòi hàm
dựng của một ngoại lệ nhận đúng một tham số. Rủi ro thấp, vì hình dạng này hiếm.

**R-14 · Đuôi đúng không có nghĩa là tên đúng.** `/Exception$/` thử cái đuôi. `class Exception` và
`class OrderErrorException` đều qua. **Đóng bằng cách nào:** không nên đóng bằng luật máy. "Tên này
có gọi ra được thất bại không" là một phán đoán, và một luật máy đoán chuyện đó sẽ nổ vào tên đúng
nhiều hơn nổ vào tên sai. Đây là việc của người rà soát, và nên được nói ra như vậy thay vì để người
đọc tưởng cổng đang lo.

## Re-audit Triggers

- Tệp nguồn công bố thêm, bớt hoặc đổi tên một luật.
- Một lớp nền trung gian xuất hiện trong mã sản phẩm — **R-1** chuyển từ rủi ro thành lỗ hổng đang
  chảy.
- Một điều luật mới được thêm vào trang luật, hoặc `IDENTITY-3`/`IDENTITY-5` được đề nghị đưa cho
  máy giữ.
- Một trong ba luật bị hạ khỏi mức `error` ở bất kỳ nơi nào dùng.
- Một dòng tắt luật xuất hiện mà không kèm lý do và ngày.
- Có báo cáo về một mã trùng giữa hai thất bại — **F-3** khi ấy không còn là nhận định mà là một
  luật máy còn thiếu.
- Bộ kiểm song sinh không còn chạy cùng nguồn, hoặc một cửa trong bảng "Cửa còn mở" được đóng mà
  bảng không đổi.
