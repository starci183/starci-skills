---
id: be-lints-exception-identity-example
title: example.md
slug: /be/lints/exception-identity/example
sidebar_label: example.md
sidebar_position: 2
description: Mã nổ luật, mã không nổ luật, và mã lọt qua luật — từng trường hợp một.
---

# example.md

> Version: `2.00` · Mô-đun: `exception-identity` · Luật máy: [`INDEX.md`](./INDEX.md) · Diễn giải: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là khai báo thất bại thường, trên một lớp nền tên `AbstractException` và một kiểu
nền tên `AbstractExceptionMetadata`. Không tên sản phẩm, không tên kho mã, không tên thư viện.

Mỗi luật máy có **nhiều cặp** **SAI** (luật nổ) và **ĐÚNG** (luật im), rồi tới mục **Cửa lách và nhầm
lẫn**. Xin đọc kỹ mục cuối đó: mã trong mục ấy là mã luật máy **không bắt được**, chứ **không** phải
mã được cho phép. Nó vẫn sai theo luật; chỉ là cổng không nhìn thấy nó.

---

## `exception-name-ends-in-exception`

### Trường hợp: đuôi `Error` trên một lớp của nhà

```ts
// SAI — thông điệp `suffix`
export class OrderAlreadyPaidError extends AbstractException {
    constructor({ id }: OrderAlreadyPaidErrorMetadata) {
        super("Order is already paid", "ORDER_ALREADY_PAID_EXCEPTION", { id })
    }
}
```

```ts
// ĐÚNG
export class OrderAlreadyPaidException extends AbstractException {
    constructor({ id }: OrderAlreadyPaidExceptionMetadata) {
        super("Order is already paid", "ORDER_ALREADY_PAID_EXCEPTION", { id })
    }
}
```

Lớp SAI ở trên nằm đúng thư mục, kế thừa đúng lớp nền, được ném ở những nơi thật — và **không luật
máy nào khác trong gói kiểm nó**, vì luật nào cũng nhận diện ngoại lệ bằng cái đuôi. Đó là lý do luật
này tồn tại.

### Trường hợp: không có đuôi nào cả

```ts
// SAI — thông điệp `suffix`, gợi ý `MemberNotFoundException`
export class MemberNotFound extends AbstractException {
    constructor({ id }: MemberNotFoundMetadata) {
        super("Member not found", "MEMBER_NOT_FOUND_EXCEPTION", { id })
    }
}
```

```ts
// ĐÚNG
export class MemberNotFoundException extends AbstractException {
    constructor({ id }: MemberNotFoundExceptionMetadata) {
        super("Member not found", "MEMBER_NOT_FOUND_EXCEPTION", { id })
    }
}
```

### Trường hợp: một đuôi khác nghe cũng hợp lý

```ts
// SAI — `Failure` không phải đuôi mà các luật máy khác nhìn thấy
export class InvoiceRejectedFailure extends AbstractException {}
```

```ts
// ĐÚNG
export class InvoiceRejectedException extends AbstractException {}
```

### Cửa lách và nhầm lẫn

**Một tầng kế thừa trung gian tắt cả ba luật máy.** Đây là cửa lớn nhất của cả mô-đun.

```ts
// LỌT — luật máy không thấy gì. Không phải vì đoạn này đúng, mà vì cổng so đúng một chuỗi
// "AbstractException" ở chỗ `extends`, nên lớp thứ hai không được coi là ngoại lệ của nhà.
export class DomainException extends AbstractException {}

export class OrderAlreadyPaidError extends DomainException {
    constructor({ id }: WhateverMetadata) {
        super("Order is already paid", "SOMETHING_ELSE", { id })
    }
}
```

Đọc kỹ: lớp thứ hai sai **cả ba** điều — sai đuôi, sai mã, sai tên kiểu — và cổng im hoàn toàn. Tách
ra một lớp nền theo miền nghiệp vụ là việc dọn dẹp bình thường nhất trên đời, và nó vô hiệu hoá mọi
khai báo nằm dưới.

**Đổi tên khi nhập cũng tắt luật, bằng một dòng.**

```ts
// LỌT — `extends Base` không khớp chuỗi mà cổng đang so
import { AbstractException as Base } from "./abstract.exception"

export class TicketClosedError extends Base {}
```

**Không có tên lớp thì không có gì để kiểm.**

```ts
// LỌT — `node.id` là null, cổng trả về trước mọi thứ khác
export default class extends AbstractException {}

// LỌT — đây là `ClassExpression`, luật máy chỉ vào `ClassDeclaration`
const TicketClosedError = class extends AbstractException {}
```

**Đuôi đúng không có nghĩa là tên đúng.**

```ts
// LỌT — `/Exception$/` thử cái đuôi, không thử ý nghĩa. Cả hai dòng này đều hợp lệ với luật máy
// và đều vô danh tính với người đọc.
export class Exception extends AbstractException {}
export class OrderErrorException extends AbstractException {}
```

---

## `exception-code-matches-class-name`

### Trường hợp: mã chép từ ngoại lệ viết ngay bên trên

```ts
// SAI — thông điệp `mismatch`. Đây là lỗi có thật: dòng đặt tên bị để nguyên như lúc chép sang,
// nên hai thất bại không liên quan đến nhau đến tay phía khách y hệt nhau.
export class ChallengeOtpNotFoundException extends AbstractException {
    constructor({ id }: ChallengeOtpNotFoundExceptionMetadata) {
        super("Challenge not found", "CHALLENGE_NOT_FOUND_EXCEPTION", { id })
    }
}
```

```ts
// ĐÚNG
export class ChallengeOtpNotFoundException extends AbstractException {
    constructor({ id }: ChallengeOtpNotFoundExceptionMetadata) {
        super("Challenge not found", "CHALLENGE_OTP_NOT_FOUND_EXCEPTION", { id })
    }
}
```

### Trường hợp: lớp đã đổi tên, mã ở lại

```ts
// SAI — thông điệp `mismatch`. Lớp nay nói về đường dẫn, mã vẫn nói về thư mục; không ai cầm tên
// này mà đoán ra tên kia.
export class OrderPathNameNotFoundException extends AbstractException {
    constructor({ id }: OrderPathNameNotFoundExceptionMetadata) {
        super("Not found", "ORDER_DIR_NAME_NOT_FOUND_EXCEPTION", { id })
    }
}
```

```ts
// ĐÚNG — đổi tên là một quyết định có di trú, không phải một lần dọn dẹp tiện tay
export class OrderPathNameNotFoundException extends AbstractException {
    constructor({ id }: OrderPathNameNotFoundExceptionMetadata) {
        super("Not found", "ORDER_PATH_NAME_NOT_FOUND_EXCEPTION", { id })
    }
}
```

### Trường hợp: mã được lắp ở lúc chạy

```ts
// SAI — thông điệp `notLiteral`. Không ai tìm ra được nó bằng cách tìm chuỗi, mà tìm chuỗi là việc
// duy nhất mọi người dùng mã đều làm.
export class OrderNotFoundException extends AbstractException {
    constructor({ id, scope }: OrderNotFoundExceptionMetadata) {
        super("Order not found", `ORDER_${scope}_NOT_FOUND`, { id })
    }
}
```

```ts
// ĐÚNG — mã là một chuỗi viết thẳng; muốn phân biệt theo phạm vi thì đó là một thất bại khác,
// khai báo riêng, với tên riêng.
export class OrderNotFoundException extends AbstractException {
    constructor({ id }: OrderNotFoundExceptionMetadata) {
        super("Order not found", "ORDER_NOT_FOUND_EXCEPTION", { id })
    }
}
```

### Trường hợp: mã cất vào hằng số hoặc bảng liệt kê

```ts
// SAI — thông điệp `notLiteral`. Đây là cách gom dọn thường gặp nhất, và nó vẫn bị bắt: đối số
// thứ hai là một `Identifier` hoặc một `MemberExpression`, không phải `Literal`.
const ORDER_NOT_FOUND = "ORDER_NOT_FOUND_EXCEPTION"

export class OrderNotFoundException extends AbstractException {
    constructor({ id }: OrderNotFoundExceptionMetadata) {
        super("Order not found", ORDER_NOT_FOUND, { id })
    }
}

export class InvoiceVoidedException extends AbstractException {
    constructor({ id }: InvoiceVoidedExceptionMetadata) {
        super("Invoice voided", ExceptionCodes.InvoiceVoided, { id })
    }
}
```

```ts
// ĐÚNG
export class OrderNotFoundException extends AbstractException {
    constructor({ id }: OrderNotFoundExceptionMetadata) {
        super("Order not found", "ORDER_NOT_FOUND_EXCEPTION", { id })
    }
}
```

### Trường hợp: từ viết tắt — luật máy cố ý không nổ

```ts
// ĐÚNG — và cách tách kia cũng ĐÚNG. Dấu gạch dưới bị bỏ trước khi so, vì một từ viết tắt không có
// cách tách đúng duy nhất, và một luật đòi một cách tách sẽ nổ vào đoạn mã không sai gì cả.
export class GraphQLDataNotFoundException extends AbstractException {
    constructor({ id }: GraphQLDataNotFoundExceptionMetadata) {
        super("Not found", "GRAPHQL_DATA_NOT_FOUND_EXCEPTION", { id })
    }
}
```

### Cửa lách và nhầm lẫn

**`super()` nằm trong một khối thì không ai tìm thấy nó.**

```ts
// LỌT — luật chỉ quét những câu lệnh ở tầng trên cùng của hàm dựng. Đặt lời gọi vào `if`, `try`
// hay `switch` là luật trả về không báo gì. Đây đúng là hình dạng mà một mã có điều kiện sẽ mang,
// nghĩa là cửa này mở đúng vào chỗ nguy nhất.
export class PaymentRefusedException extends AbstractException {
    constructor({ id, gateway }: PaymentRefusedExceptionMetadata) {
        if (gateway) {
            super("Payment refused", "GATEWAY_REFUSED", { id })
        } else {
            super("Payment refused", "PAYMENT_REFUSED_EXCEPTION", { id })
        }
    }
}
```

**Không truyền mã thì không có mã để so.**

```ts
// LỌT — `arguments.length < 2` nên luật trả về sớm. Một thất bại không mang danh tính nào trên
// đường truyền đi qua sạch sẽ. Đây là lỗ hổng nặng hơn một mã sai, vì mã sai còn tìm được.
export class PaymentRefusedException extends AbstractException {
    constructor({ id }: PaymentRefusedExceptionMetadata) {
        super("Payment refused")
    }
}
```

**Chữ hoa chữ thường không được kiểm.**

```ts
// LỌT — hai vế đều được viết hoa trước khi so, nên cả hai dòng này đều qua, dù luật viết ra là
// SCREAMING_SNAKE và phía khách khớp chuỗi thì phân biệt hoa thường.
super("Order not found", "order_not_found_exception", { id })
super("Order not found", "OrderNotFoundException", { id })
```

**Dấu gạch dưới không được kiểm là có hay không.**

```ts
// LỌT — gạch dưới bị bỏ trước khi so, nên sự vắng mặt của chúng không thể phát hiện được.
// Không đọc nổi, và hợp lệ với luật máy.
super("Order not found", "ORDERNOTFOUNDEXCEPTION", { id })
```

**Hàm dựng thừa kế thì không có gì để đọc.**

```ts
// LỌT — `if (!ctor) return`. Mã và kiểu dữ liệu kèm theo của lớp này được quyết ở một chỗ mà
// luật máy không nhìn tới.
export class OrderNotFoundException extends AbstractException {}
```

---

## `exception-metadata-type-named-for-class`

### Trường hợp: khai bằng kiểu nền dùng chung

```ts
// SAI — thông điệp `named`. Câu này nói "thất bại này không mang gì cả", và câu ấy hết đúng ngay
// khi có người cần đính một mã định danh vào — lúc đó kiểu nền đang được mọi ngoại lệ khác dùng
// chung, nên không có chỗ nào để thêm trường.
export class RewardNotEligibleException extends AbstractException {
    constructor({ originalError }: AbstractExceptionMetadata) {
        super("Not eligible", "REWARD_NOT_ELIGIBLE_EXCEPTION", { originalError })
    }
}
```

```ts
// ĐÚNG
export type RewardNotEligibleExceptionMetadata = AbstractExceptionMetadata

export class RewardNotEligibleException extends AbstractException {
    constructor({ originalError }: RewardNotEligibleExceptionMetadata) {
        super("Not eligible", "REWARD_NOT_ELIGIBLE_EXCEPTION", { originalError })
    }
}
```

### Trường hợp: giá trị mặc định bọc ngoài — vẫn bị bắt

```ts
// SAI — thông điệp `named`. Giá trị mặc định biến tham số thành một mẫu gán bọc ngoài mẫu tách
// rời; luật gỡ lớp bọc ấy ra trước khi đọc. Lần đo đầu tiên không gỡ đã bỏ sót đúng những khai
// báo kiểu này.
export class QuestionInvalidException extends AbstractException {
    constructor({ originalError }: AbstractExceptionMetadata = {}) {
        super("Empty question", "QUESTION_INVALID_EXCEPTION", { originalError })
    }
}
```

```ts
// ĐÚNG — giữ nguyên giá trị mặc định cũng được, miễn kiểu mang tên của chính thất bại
export type QuestionInvalidExceptionMetadata = AbstractExceptionMetadata

export class QuestionInvalidException extends AbstractException {
    constructor({ originalError }: QuestionInvalidExceptionMetadata = {}) {
        super("Empty question", "QUESTION_INVALID_EXCEPTION", { originalError })
    }
}
```

### Trường hợp: không khai kiểu gì cả

```ts
// SAI — thông điệp `untyped`. Tham số này là toàn bộ hợp đồng mà nơi ném phải thoả, và một tham số
// không kiểu nhận mọi đối tượng — kể cả cái thiếu đúng cái mã định danh mà thất bại này sinh ra
// để mang theo.
export class DocumentLockedException extends AbstractException {
    constructor({ id }) {
        super("Document is locked", "DOCUMENT_LOCKED_EXCEPTION", { id })
    }
}
```

```ts
// ĐÚNG
export interface DocumentLockedExceptionMetadata extends AbstractExceptionMetadata {
    id?: string
    lockedBy?: string
}

export class DocumentLockedException extends AbstractException {
    constructor({ id, lockedBy }: DocumentLockedExceptionMetadata) {
        super("Document is locked", "DOCUMENT_LOCKED_EXCEPTION", { id, lockedBy })
    }
}
```

### Cửa lách và nhầm lẫn

**Tham số không tách rời thì luật không vào tới.**

```ts
// LỌT — `params[0]` là một `Identifier` chứ không phải `ObjectPattern`, nên luật trả về trước khi
// đọc kiểu. Đây đúng là lỗi mà luật sinh ra để bắt, viết lệch đi một dấu ngoặc.
export class DocumentLockedException extends AbstractException {
    constructor(metadata: AbstractExceptionMetadata) {
        super("Document is locked", "DOCUMENT_LOCKED_EXCEPTION", metadata)
    }
}
```

**Kiểu viết thẳng và kiểu ghép đều bị bỏ qua.**

```ts
// LỌT — `TSTypeLiteral` và `TSIntersectionType` đều không phải `TSTypeReference`, nên luật trả về
// mà không báo. Cả hai khai báo này đều vi phạm luật, và cổng im.
export class DocumentLockedException extends AbstractException {
    constructor({ id }: { id?: string }) {
        super("Document is locked", "DOCUMENT_LOCKED_EXCEPTION", { id })
    }
}

export class DocumentExpiredException extends AbstractException {
    constructor({ id }: AbstractExceptionMetadata & { id?: string }) {
        super("Document expired", "DOCUMENT_EXPIRED_EXCEPTION", { id })
    }
}
```

**Tên kiểu có tiền tố không gian tên bị bỏ qua — kể cả khi nó đang đúng.**

```ts
// LỌT — `typeName` là `TSQualifiedName`, không phải `Identifier`. Luật không so được, nên không
// nói gì. Dòng dưới đây có thể rất đúng, và dòng sai tương ứng cũng sẽ lọt y như vậy.
export class DocumentLockedException extends AbstractException {
    constructor({ id }: Errors.DocumentLockedExceptionMetadata) {
        super("Document is locked", "DOCUMENT_LOCKED_EXCEPTION", { id })
    }
}
```

**Luật đọc cái tên, không bao giờ đọc cái kiểu.**

```ts
// LỌT — tên kiểu khớp đúng mẫu, nên luật im. Nhưng nó không kế thừa kiểu nền dùng chung, tức là
// nửa còn lại của `IDENTITY-4` không được ai giữ. Tên đúng, nội dung rỗng nghĩa.
export type DocumentLockedExceptionMetadata = Record<string, unknown>

export class DocumentLockedException extends AbstractException {
    constructor({ id }: DocumentLockedExceptionMetadata) {
        super("Document is locked", "DOCUMENT_LOCKED_EXCEPTION", { id })
    }
}
```

---

## Ánh xạ yêu cầu sang một luật máy

Nêu khai báo, nêu chỗ nghi ngờ. Nếu chỗ nghi ngờ không rơi vào một trong ba luật dưới đây thì câu trả
lời là **không có luật máy nào giữ**, chứ không phải suy ra một luật gần giống.

| Yêu cầu bằng lời | Lập luận | Luật máy | Mã luật |
|---|---|---|---|
| "Lớp này đặt tên `*Error` có sao không" | Mọi luật máy khác nhận diện ngoại lệ bằng đuôi `Exception` | `exception-name-ends-in-exception` | `IDENTITY-1` |
| "Hai thất bại này ra cùng một mã ở phía khách" | Mã phải suy ra từ tên lớp, nên bản chép hiện ra ngay trong tệp | `exception-code-matches-class-name` | `IDENTITY-2` |
| "Mã này ghép chuỗi cho gọn" | Ghép ở lúc chạy thì không ai tìm ra nó | `exception-code-matches-class-name` | `IDENTITY-2` |
| "Tham số cứ để kiểu nền cho nhanh" | Kiểu nền dùng chung không phải chỗ để thêm trường đầu tiên | `exception-metadata-type-named-for-class` | `IDENTITY-4` |
| "Đổi tên lớp rồi, mã có phải đổi không" | Có, và đó là thay đổi nhìn thấy được từ phía khách | *không có luật máy* — `IDENTITY-3` do người rà soát giữ | `IDENTITY-3` |
| "Đặt mã trạng thái khác cho hai lỗi phân biệt được" | Mã trạng thái là một hạng chung của hàng trăm thất bại | *không có luật máy* — `IDENTITY-5` do người rà soát giữ | `IDENTITY-5` |
| "Hai lớp trùng tên ở hai thư mục" | Cả hai đều tự khớp với chính mình | *không luật nào so mã này với mã kia* | — |

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `suffix` / không phải việc của luật | Lớp này có kế thừa đúng chuỗi `AbstractException` ở chỗ `extends` không? Nếu kế thừa qua một lớp trung gian thì **không luật nào** đang giữ nó. |
| `mismatch` / `notLiteral` | Đối số thứ hai có phải một chuỗi viết thẳng không? Nếu không, báo cáo là `notLiteral` bất kể nội dung. |
| `mismatch` / không nổ | Bỏ hết gạch dưới và viết hoa hai vế, chữ có bằng nhau không? Khác cách tách từ viết tắt thì **không** nổ. |
| `untyped` / `named` | Tham số tách rời có phần khai kiểu không? Không có là `untyped`; có mà tên khác là `named`. |
| `named` / không nổ | Phần khai kiểu có phải một tham chiếu kiểu tên đơn không? Kiểu viết thẳng, kiểu ghép, tên có tiền tố đều bị bỏ qua. |
| Luật máy / người rà soát | Điều luật này có nhìn thấy được trong **một** lần đọc **một** tệp không? Không thì nó thuộc về người rà soát. |

## Sai lầm lặp lại nhiều nhất

1. Tin rằng cổng im nghĩa là mã sạch. Mười một trong mười bốn cửa còn mở đều là một lệnh `return`
   sớm, và trong nhật ký dựng thì `return` sớm với tệp sạch trông giống hệt nhau.
2. Tách một lớp nền theo miền nghiệp vụ để dọn dẹp, rồi vô hiệu hoá cả ba luật máy cho mọi khai báo
   nằm dưới nó.
3. Chép một khai báo ngoại lệ sang chỗ mới và để nguyên dòng đặt tên mã.
4. Gom mã vào hằng số hay bảng liệt kê "cho gọn" — luật này bắt được, nhưng người viết thường ngạc
   nhiên, rồi đi tìm cách vòng qua thay vì viết thẳng chuỗi ra.
5. Khai tham số dữ liệu kèm theo bằng kiểu nền dùng chung, rồi khi cần thêm một trường thì thêm vào
   kiểu nền — chỗ mà mọi ngoại lệ khác đang dùng chung.
6. Viết `constructor(metadata: …)` thay vì tách rời, và tưởng rằng luật đã duyệt.
7. Đổi tên lớp như một lần dọn dẹp tiện tay, để lại một mã không ai đoán ra được từ tên mới.
8. Chờ một báo cáo về cách tách từ viết tắt, không thấy, rồi kết luận rằng luật máy không chạy.
