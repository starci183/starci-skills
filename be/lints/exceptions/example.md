---
id: be-lints-exceptions-example
title: example.md
slug: /be/lints/exceptions/example
sidebar_label: example.md
sidebar_position: 2
description: Mã thật cho từng quy tắc — chỗ nó bắn, chỗ nó im, và chỗ nó bị đi lọt.
---

# example.md

> Version: `2.00` · Mô-đun: `exceptions` · Cưỡng chế: [`INDEX.md`](./INDEX.md) · Diễn giải: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mỗi quy tắc có nhiều cặp **SAI** (quy tắc bắn) và **ĐÚNG** (quy tắc im), rồi tới mục **Cửa lách và
nhầm lẫn**. Mã trong mục cửa lách **không phải mã được phép viết** — nó là mã mà quy tắc **không
thấy**. Đọc nhầm hai thứ đó là cách nhanh nhất để biến một tài liệu cưỡng chế thành một danh sách
mẹo lách.

---

## `throw-abstract-exception`

### Trường hợp: một câu chữ thay cho một thất bại có tên

```ts
// SAI — bareError. Câu này không mang mã ổn định: không gom nhóm được, không khớp mẫu được,
// và id khoá học chỉ lấy lại được bằng cách phân tích tiếng Anh.
if (!course) {
    throw new Error(`course ${courseId} not found`)
}
```

```ts
// ĐÚNG — thất bại có tên, dữ liệu đi kèm.
if (!course) {
    throw new CourseNotFoundException({
        id: courseId,
    })
}
```

### Trường hợp: một ngoại lệ vận chuyển thay cho một ngoại lệ nghiệp vụ

```ts
// SAI — framework. `BadRequestException` mang một mã trạng thái và không mang danh tính:
// sáu lỗi 400 khác nhau tới client giống hệt nhau.
if (seatsLeft <= 0) {
    throw new BadRequestException("no seat left")
}
```

```ts
// ĐÚNG.
if (seatsLeft <= 0) {
    throw new CourseSeatsExhaustedException({
        id: courseId,
        capacity,
    })
}
```

### Trường hợp: làn kiểm thử — cùng một dòng, khác ý nghĩa

```ts
// enrollment.spec.ts
// ĐÚNG — cổng làn kiểm thử tắt hẳn quy tắc trong tệp này. Ở đây câu đó nghĩa là
// "bộ chạy không đi tiếp được", không phải một thất bại sản phẩm có thể sinh ra.
if (!seeded) {
    throw new Error("fixture did not seed")
}
```

```ts
// enrollment.service.ts
// SAI — bareError. Cùng một dòng, nhưng ở đây nó mô tả thứ một người dùng có thể gặp.
if (!seeded) {
    throw new Error("enrollment missing")
}
```

### Trường hợp: probe — mã trạng thái là toàn bộ hợp đồng

```ts
// health.controller.ts
// ĐÚNG — cổng probe tắt nhánh framework. Phía đọc probe chỉ đọc mã trạng thái và
// không bao giờ đọc thân phản hồi, nên ở đây trạng thái CHÍNH LÀ danh tính.
if (!reachable) {
    throw new ServiceUnavailableException()
}
```

```ts
// health.controller.ts
// SAI — bareError vẫn bắn ngay cả trong probe. Trạng thái của probe là hợp đồng;
// một cú sập không tên thì không.
if (!reachable) {
    throw new Error("db down")
}
```

### Cửa lách và nhầm lẫn

```ts
// ĐI LỌT — không phải thứ được phép viết. Quy tắc khớp một `NewExpression` ĐẶT TẠI
// `ThrowStatement`; ở đây nút tại chỗ ném là một `Identifier`, nên nó thoát ngay dòng đầu.
const failure = new Error("no seat left")
throw failure
```

```ts
// ĐI LỌT — không có `ThrowStatement` nào cả. Cùng một thất bại tới cùng một phía gọi,
// và không quy tắc nào từng chạy.
return Promise.reject(new Error("no seat left"))
```

```ts
// ĐI LỌT — tên được so với chuỗi "Error" rồi so với một `Set` đóng.
// Mọi built-in khác đều không thuộc cả hai.
throw new TypeError("seatsLeft must be a number")
```

```ts
// ĐI LỌT — danh sách framework là mười bảy chuỗi viết tay. Tên ngoài danh sách là vô hình,
// và framework có thể thêm lớp mới ở bất kỳ phiên bản nào.
throw new PreconditionFailedException("stale version")
```

```ts
// ĐI LỌT — quy tắc so ĐỊNH DANH CỤC BỘ, không bao giờ so ràng buộc import.
// Một dòng import đã tắt cả danh sách chặn cho tệp này.
import { BadRequestException as BadRequest } from "…"

throw new BadRequest("no seat left")
```

```ts
// ĐI LỌT — `callee.type` là `MemberExpression`, quy tắc thoát trước khi đọc tên.
throw new errors.CourseNotFoundException({ id: courseId })
```

---

## `require-exception-object-arg`

### Trường hợp: không tham số

```ts
// SAI — zero. Hai cách viết cho một ý, và người đọc phải tra xem ngoại lệ nào nhận tham số.
throw new UserNotFoundException()
```

```ts
// ĐÚNG — object rỗng không phải nghi thức thừa; nó giữ MỘT cách viết cho mọi chỗ ném.
throw new UserNotFoundException({})
```

### Trường hợp: tham số theo vị trí

```ts
// SAI — notObject. Hình dạng theo vị trí không lớn lên được: ngày thất bại này cần thêm
// một trường, mọi chỗ ném phải sửa, và chỗ sửa sai vẫn biên dịch trót lọt.
throw new CourseNotFoundException(courseId)
```

```ts
// ĐÚNG.
throw new CourseNotFoundException({
    id: courseId,
})
```

### Trường hợp: nhiều tham số

```ts
// SAI — extra. Với chỗ ném này quy tắc báo HAI lần: `extra` cho số lượng,
// rồi `notObject` cho tham số đầu, vì sau khi báo `extra` nó không dừng lại.
throw new CourseSeatsExhaustedException(courseId, capacity)
```

```ts
// ĐÚNG — một object, mọi dữ kiện nằm trong đó.
throw new CourseSeatsExhaustedException({
    id: courseId,
    capacity,
})
```

### Trường hợp: hàm khởi tạo của framework không phải việc của quy tắc này

```ts
// ĐÚNG với quy tắc NÀY — `ServiceUnavailableException` nằm trong `Set` framework nên bị bỏ qua:
// hình dạng đó do framework công bố, sửa nó là đổi thứ được gửi đi.
// Việc có được ném nó hay không là câu hỏi của `throw-abstract-exception`, và quy tắc đó trả lời.
throw new ServiceUnavailableException({ retryAfter: 30 })
```

### Cửa lách và nhầm lẫn

```ts
// BÁO NHẦM — đây là hình dạng ĐÚNG mà quy tắc vẫn bắn `notObject`, vì nó kiểm
// `arguments[0].type` tại chỗ gọi chứ không kiểm giá trị. Hằng số làm lẫn literal
// theo cả hai chiều: chiều này nó tạo ra một phát hiện sai.
const meta = { id: courseId }
throw new CourseNotFoundException(meta)
```

```ts
// BÁO NHẦM — nút là `TSAsExpression`, không phải `ObjectExpression`.
throw new CourseNotFoundException({ id: courseId } as CourseNotFoundMeta)
```

```ts
// ĐI LỌT — không phải thứ được phép viết. Lại thoát ở yêu cầu `NewExpression` tại chỗ ném.
const failure = new UserNotFoundException()
throw failure
```

```ts
// ĐI LỌT — không khớp `/Exception$/`. Đổi hậu tố tên là ra khỏi tầm nhìn của quy tắc,
// trong khi chỗ ném vẫn sai y như cũ.
throw new CourseNotFoundError()
```

```ts
// LƯU Ý — trong một tệp `.spec.ts`, `throw-abstract-exception` bị tắt nhưng quy tắc NÀY
// thì không: nó không có cổng theo tên tệp nào. Dòng dưới vẫn báo `zero`.
throw new UserNotFoundException()
```

---

## `exception-extends-abstract`

### Trường hợp: lớp nền của framework đội lốt hàng nhà

```ts
// SAI — base. Lớp này được ném bằng `new CourseAlreadyEnrolledException({ id })`,
// nên MỌI chỗ gọi đọc lên đều bình thường và quy tắc canh chỗ ném không thấy gì.
// Một lớp như vậy từng sống và được ném từ bốn chỗ trong khi cổng vẫn xanh.
export class CourseAlreadyEnrolledException extends ConflictException {}
```

```ts
// ĐÚNG.
export class CourseAlreadyEnrolledException extends AbstractException {}
```

### Trường hợp: tệp của lớp nền

```ts
// exceptions/errors/abstract.ts
// ĐÚNG — cổng theo tên tệp miễn cho đúng tệp này. Đây là lớp duy nhất được phép
// kế thừa thứ khác.
export abstract class AbstractException extends Error {}
```

```ts
// exceptions/errors/http-base.ts
// SAI — base. Một lớp nền thứ hai tự phong, đặt ở tệp khác, không được miễn.
export abstract class HttpBaseException extends Error {}
```

### Cửa lách và nhầm lẫn

```ts
// ĐI LỌT — không phải thứ được phép viết. Cả hai quy tắc khai báo đều thăm
// `ClassDeclaration`; `ClassExpression` là nút khác và không bao giờ được thăm.
export const CourseAlreadyEnrolled = class CourseAlreadyEnrolledException extends ConflictException {}
```

```ts
// ĐI LỌT — lớp cha là `CallExpression`, không phải `Identifier`. Quy tắc im lặng,
// và im lặng không phải là cho qua.
export class CourseAlreadyEnrolledException extends withHttpStatus(ConflictException) {}
```

```ts
// ĐI LỌT — lớp cha là `MemberExpression`.
export class CourseAlreadyEnrolledException extends http.ConflictException {}
```

```ts
// ĐI LỌT — đổi hậu tố tên là ra khỏi tầm nhìn của MỌI quy tắc khai báo,
// trong khi lớp vẫn là một ngoại lệ và vẫn được ném.
export class CourseAlreadyEnrolledError extends ConflictException {}
```

```ts
// BÁO NHẦM — quy tắc đòi kế thừa TRỰC TIẾP. Cặp dưới đây xét bắc cầu thì đúng luật,
// nhưng lớp thứ hai vẫn bị báo `base`.
export class DomainRuleException extends AbstractException {}
export class CourseAlreadyEnrolledException extends DomainRuleException {}
```

---

## `exception-in-errors-folder`

### Trường hợp: khai báo cạnh chỗ ném

```ts
// modules/enrollment/enrollment.service.ts
// SAI — place. Một dạng thất bại mới ra đời mà không ai nhìn thấy nó tới trong diff.
export class EnrollmentClosedException extends AbstractException {}
```

```ts
// exceptions/errors/enrollment-closed.ts
// ĐÚNG — cổng thư mục trả về bộ thăm rỗng cho tệp này.
export class EnrollmentClosedException extends AbstractException {}
```

### Trường hợp: một hình dạng dữ liệu không phải một ngoại lệ

```ts
// modules/enrollment/dto.ts
// ĐÚNG — không có lớp cha, nên quy tắc coi đây là một hình dạng dữ liệu, không phải ngoại lệ.
export class EnrollmentClosedException {
    public readonly id!: string
}
```

```ts
// modules/enrollment/dto.ts
// SAI — có lớp cha, nên nó là một khai báo ngoại lệ đứng sai chỗ.
export class EnrollmentClosedException extends AbstractException {
    public readonly id!: string
}
```

### Cửa lách và nhầm lẫn

```ts
// ĐI LỌT — không phải thứ được phép viết. Cổng khớp CẶP THƯ MỤC THEO TÊN, ở bất kỳ đâu
// trong đường dẫn. Repo có thể mọc hai mươi thư mục như thế này và vẫn xanh; thứ được
// cưỡng chế là "một thư mục viết đúng chữ", không phải "một chỗ để tra".
// modules/enrollment/exceptions/errors/enrollment-closed.ts
export class EnrollmentClosedException extends AbstractException {}
```

```ts
// ĐI LỌT — `ClassExpression` không được thăm.
export const EnrollmentClosed = class EnrollmentClosedException extends AbstractException {}
```

```ts
// ĐI LỌT — không phải `ClassDeclaration`.
export type EnrollmentClosedException = {
    id: string
}
```

```ts
// BÁO NHẦM — thư mục viết `exception/` thiếu chữ `s`. Ý định đúng, cổng không khớp,
// quy tắc báo `place`. Cùng một khe hở nhìn từ chiều ngược lại.
// modules/enrollment/exception/errors/enrollment-closed.ts
export class EnrollmentClosedException extends AbstractException {}
```

---

## Ánh xạ yêu cầu sang một quy tắc

Nêu **nút** đang xét và **tên tệp**. Nếu thiếu một trong hai, không kết luận được — cổng theo tên tệp
quyết định quy tắc nào còn sống trong tệp đó.

| Yêu cầu bằng lời | Lập luận | Quy tắc | Kết quả |
|---|---|---|---|
| "Chặn mọi `throw new Error` trong mã sản phẩm" | Nút tại chỗ ném là `NewExpression` tên `Error` | `throw-abstract-exception` | `bareError` |
| "Chặn ném ngoại lệ vận chuyển" | Tên nằm trong `Set` mười bảy chuỗi | `throw-abstract-exception` | `framework`, trừ tệp probe |
| "Bắt `new XException()` trống" | `arguments.length === 0` | `require-exception-object-arg` | `zero` |
| "Bắt tham số theo vị trí" | `arguments[0].type !== "ObjectExpression"` | `require-exception-object-arg` | `notObject` |
| "Bắt lớp ngoại lệ kế thừa lớp nền framework" | `superClass` là `Identifier` khác `AbstractException` | `exception-extends-abstract` | `base` |
| "Bắt ngoại lệ khai báo lung tung" | Tệp không khớp `/\/exceptions\/errors\//` và lớp có `superClass` | `exception-in-errors-folder` | `place` |
| "Bắt ngoại lệ khai báo trong hai thư mục ngoại lệ khác nhau" | Không quy tắc nào đếm thư mục | *không có* | Cửa còn mở, xem `audit.md` |
| "Bắt object metadata rỗng nghĩa" (`{}` ở chỗ đáng lẽ có id) | Không quy tắc nào đọc nội dung metadata | *không có* | `EXCEPTION-5` không được giữ |

## Bảng phân định ranh giới

| Ranh giới | Câu hỏi phân định |
|---|---|
| `throw-abstract-exception` / `require-exception-object-arg` | Vấn đề là **ném cái gì**, hay là **hình dạng tham số** của thứ được ném? |
| `throw-abstract-exception` / `exception-extends-abstract` | Chỗ ném đọc lên có sai không? Nếu chỗ ném đọc bình thường mà lớp vẫn sai, đó là quy tắc khai báo |
| `exception-extends-abstract` / `exception-in-errors-folder` | Sai ở **lớp cha**, hay sai ở **chỗ đặt tệp**? Một lớp có thể sai cả hai và bị báo hai lần |
| Quy tắc bắn / quy tắc im | Nút tại chỗ ném có đúng là `NewExpression` với `callee` là `Identifier` không? Nếu không, mọi quy tắc chỗ ném đều im |
| Quy tắc im / mã được phép | Im lặng của quy tắc **không bao giờ** là lời cho phép của luật |

## Sai lầm lặp lại nhiều nhất

1. Đọc "cổng xanh" thành "mã đúng". Ba trong bốn quy tắc im lặng ngay khi hình dạng cú pháp lệch một
   chút.
2. Gán thất bại vào một biến rồi mới ném — không quy tắc chỗ ném nào còn nhìn thấy.
3. Trả một thất bại qua `Promise.reject` thay vì `throw`, và tưởng là đã được kiểm.
4. Đặt tên lớp kết thúc bằng `Error` thay vì `Exception`, rồi tưởng nó nằm ngoài luật thay vì chỉ nằm
   ngoài quy tắc.
5. Đưa metadata vào một biến rồi ngạc nhiên vì bị báo — và sửa **ngược** bằng cách nội tuyến hoá lại,
   thay vì ghi nhận đây là một phát hiện sai của quy tắc.
6. Tạo thêm một thư mục `exceptions/errors/` trong từng module và tin rằng "một chỗ để tra" vẫn đúng.
7. Đặt tệp sản xuất tên `*-spec.ts` hoặc để nó dưới một thư mục tên `health`, rồi mất cả một quy tắc
   mà không hay biết.
