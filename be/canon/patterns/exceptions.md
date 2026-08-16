# ngoại lệ

## Định nghĩa

Mọi failure do backend này tạo ra đều là một subclass của `AbstractException`, được khai báo trong một folder và được throw bằng một metadata object. Ba quy tắc đó cùng nói lên một ý: **failure là một thứ có tên và có dữ liệu đi kèm, không phải một string.**

`new Error("course not found")` chỉ mang một câu. Không downstream nào có thể nhóm, so sánh, quyết định retry, dịch hay gắn course id mà không parse English. Nest builtin cũng không tốt hơn: nó mang HTTP status mà không mang identity, đưa concern của transport vào tên miền.

Câu hỏi quyết định là: **caller, log pipeline hoặc client có cần xử lý failure này khác với failure bên cạnh không?** Nếu có, nó cần class riêng — và gần như mọi failure đều như vậy.

Rule này được giữ bởi [`sources/be/exceptions.mjs`](../../../sources/be/exceptions.mjs).

## Quy tắc

** NGOẠI LỆ-1 · Throw subclass của `AbstractException`, không bao giờ `Error` và không bao giờ Nest builtin.**

`Error` không có stable code, nên downstream không thể chủ động group, match hoặc retry. Nest `BadRequestException` có status nhưng không có identity: client không phân biệt được hai lỗi không liên quan, và cách duy nhất còn lại là dựa vào message — đúng thứ không ổn định.

** NGOẠI LỆ-2 · Constructor nhận MỘT metadata object — `{}` khi không còn gì để nói.**

`new CourseNotFoundException({ id: courseId })`, không truyền positional argument và không gọi trần `new CourseNotFoundException()`. Positional shape không thể mở rộng: khi failure cần field thứ hai, mọi throw site phải sửa, còn những site sửa sai vẫn có thể biên dịch.

Object rỗng không phải nghi thức. Nó giữ một cách viết thống nhất cho mọi throw site, để người đọc không phải nhớ exception cụ thể nào nhận argument.

** NGOẠI LỆ-3 · Class tự nó mở rộng `AbstractException`, không mở rộng framework base.**

Chỉ bảo vệ throw site là chưa đủ. Class kế thừa Nest exception vẫn được throw bằng chính tên class, nên throw site trông đúng và rule không thấy gì sai — đó là cách một class như vậy tồn tại, được throw từ bốn call site, trong khi cổng vẫn xanh.

**EXCEPTION-4 · Mọi exception được khai báo trong exception folder.**

Một folder chứa toàn bộ exception để câu hỏi “application có thể tạo ra những lỗi gì?” có một nơi trả lời, và reviewer thấy failure mode mới xuất hiện ở đâu. Exception khai báo cạnh code throw nó sẽ vô hình cho tới khi production throw nó.

** NGOẠI LỆ-5 · Metadata chứa mọi thứ error reader cần.**

Id, trạng thái không hợp lệ, limit đã vượt quá — không phải một câu đã render. Message dành cho người đọc log; metadata dành cho mọi consumer khác: client quyết định nội dung hiển thị, retry policy và alert grouping theo code.

**EXCEPTION-6 · Assertion của test runner không phải domain error.**

Spec và test tree có thể `throw new Error` — ở đó nó có nghĩa “test không thể tiếp tục”, khác với failure mà product có thể tạo ra. Ngoại lệ này được phép ở đúng nơi áp dụng, không mở rộng sang nơi khác.

## Bị cấm

| Không bao giờ | Tại sao nó bị từ chối | Thay vào đó |
|---|---|---|
| `throw new Error(...)` trong product code | Không có stable code, nên không thể group, match hoặc retry mà không parse English | Throw subclass của `AbstractException` đặt tên cho lỗi |
| `throw new BadRequestException(...)` hoặc Nest builtin khác | Nó có HTTP status nhưng không có identity, nên client không phân biệt được hai lỗi không liên quan | Tương tự |
| `new XException()` không có argument | Hai cách viết cho cùng một ý, buộc reader phải nhớ exception nào nhận argument | `new XException({})` |
| Positional constructor argument | Shape không thể mở rộng; thêm field buộc sửa mọi throw site và site sửa sai vẫn biên dịch | Một metadata object |
| `*Exception` class mở rộng framework base | Throw site trông đúng và rule không nhìn thấy class sai | Mở rộng `AbstractException` |
| Exception khai báo ngoài exception folder | Tập hợp lỗi application có thể tạo ra không còn đọc được ở một nơi | Khai báo cùng các exception khác |
| Một rendered sentence làm payload duy nhất | Client, retry policy và alert phải parse prose | Đặt id và state trong metadata |

## Ví dụ

### Trường hợp thông thường — lỗi có tên và dữ liệu

```ts
if (!courseExists) {
    throw new CourseNotFoundException({
        id: courseId,
    })
}
```

```ts
// Wrong: a sentence. The client cannot tell this from six other 400s, the alert cannot group it,
// and the course id can only be recovered by parsing the message.
if (!courseExists) {
    throw new BadRequestException(`course ${courseId} not found`)
}
```

Chúng khác nhau ở việc downstream có thể hành động dựa trên failure hay không.

### Bẫy declaration — throw-site rule không thể nhìn thấy

```ts
/** The learner already owns this course. */
export class CourseAlreadyEnrolledException extends AbstractException { /* ... */ }
```

```ts
// Wrong: thrown as `new CourseAlreadyEnrolledException({...})`, which LOOKS correct at every call
// site - so a rule watching throws passes it, and the class is a Nest exception in disguise.
export class CourseAlreadyEnrolledException extends ConflictException { /* ... */ }
```

Chúng khác nhau ở việc throw site có nói đúng sự thật về thứ được throw hay không.

### Bẫy object rỗng

```ts
throw new UserNotFoundException({})
```

```ts
// Wrong: a second spelling. Now a reader has to know which exceptions take an argument.
throw new UserNotFoundException()
```

Chúng khác nhau ở việc mọi throw site trong codebase có đọc giống nhau hay không.

### Lối thoát được cho phép

```ts
// a spec: this is the runner giving up, not a failure the product can produce
if (!seeded) {
    throw new Error("fixture did not seed - the test cannot continue")
}
```

```ts
// Wrong in product code: the same line, where it now describes something a user can hit.
if (!seeded) {
    throw new Error("enrollment missing")
}
```

Chúng khác nhau ở việc một user có thể gặp failure đó hay không.
