# danh tính ngoại lệ

## Định nghĩa

Exception identity là từ dùng để phân biệt một lỗi với mọi lỗi khác mà backend có thể tạo ra. [`exceptions.md`](exceptions.md) quy định rằng lỗi là một thứ được đặt tên và mang theo dữ liệu. File này quy định cách đặt tên: **một từ, được viết qua ba alphabet, và cả ba phải nói cùng một điều.**

Class là `CourseReviewNotOwnedException`. Code là `COURSE_REVIEW_NOT_OWNED_EXCEPTION`. Payload type là `CourseReviewNotOwnedExceptionMetadata`. Không phần nào là trang trí: mỗi alphabet được một consumer khác đọc, và không consumer nào có thể đọc thay phần còn lại:

- **class name** là thứ các rule nhìn thấy. Mọi exception rule đều match tên kết thúc bằng `Exception`, nên một lỗi viết khác đi sẽ không được rule nào thực thi.
- **code** là thứ client nhìn thấy. Apollo `formatError` đóng dấu code vào mọi GraphQL error, còn REST filter đưa nó vào response body; UI match code thay vì status, vì một GraphQL response có thể chứa nhiều lỗi với mức độ khác nhau.
- **metadata type** là thứ call site nhìn thấy. Nó là contract mà caller phải đáp ứng và là nơi field thứ hai của failure sẽ được thêm vào.

Câu hỏi quyết định một declaration có identity hay không là: **nếu lỗi này và lỗi kia cùng được gửi tới client, client có phân biệt được chúng mà không cần đọc tiếng Anh không?** Nếu câu trả lời là message, lỗi đó không có identity — nó chỉ có một câu.

Rule này được giữ bởi [`sources/be/exception-identity.mjs`](../../../sources/be/exception-identity.mjs). Hai phán quyết của module được tổ chức ở đó; các vấn đề đổi tên và HTTP status được nêu ở đây và do review thực thi, vì cả hai đều không hiện rõ trong một file đơn lẻ.

## Quy tắc

**IDENTITY-1 · Class mở rộng `AbstractException` phải được đặt tên `*Exception`.**

Không `*Error`, không danh từ trần. Đây không phải sở thích về style — suffix là thứ duy nhất mà các exception rule khác có thể nhìn thấy. `require-exception-object-arg`, `exception-extends-abstract` và `exception-in-errors-folder` đều dựa vào suffix đó, còn `throw-abstract-exception` chỉ nhận diện `Error` và các framework name. Vì vậy, một `SomethingError` nằm trong errors folder, kế thừa framework base và được throw từ call site thật có thể không bị BẤT KỲ rule nào kiểm tra. Cổng không báo lỗi và điều đó bị tưởng là thỏa thuận.

Đây cũng là cái bẫy mà `EXCEPTION-3` mô tả từ đầu bên kia. Ở đó, class kế thừa framework base trông hợp lệ tại nơi throw; ở đây, class có tên sai trông hợp lệ trong folder. Cả hai đều lọt qua bằng cách vô hình trước các phép kiểm tra.

**IDENTITY-2 · Code là class name, viết theo SCREAMING_SNAKE.**

`CourseNotFoundException` báo cáo `COURSE_NOT_FOUND_EXCEPTION`, được viết dưới dạng literal trong lời gọi `super()`, không ghép khi chạy. Khi code được suy ra thay vì chọn thủ công, hai điều trở nên đúng.

Thứ nhất, không ai phải tra cứu code. Người đọc class name biết code; người đọc code có thể tìm class bằng search. Code chọn bằng tay trở thành tên thứ hai cho cùng một failure, rồi tên thứ hai xuất hiện trong client, alert rule và support ticket trong khi source chỉ có tên thứ nhất.

Thứ hai, uniqueness đến tự nhiên. Code sao chép từ exception phía trên là cách thường gặp khiến hai failure không liên quan có cùng identity — ví dụ challenge OTP và course challenge cùng báo một code, khiến client không biết thiếu course challenge hay thiếu login challenge. Đó chính là lỗi mà `EXCEPTION-1` từ chối khi framework exception lấy vocabulary của framework làm tên.

Vị trí underscore bên trong acronym không thuộc phán quyết này. `GRAPHQL_DATA_NOT_FOUND_EXCEPTION` và `GRAPH_QL_DATA_NOT_FOUND_EXCEPTION` vẫn cùng tên theo rule này; không có một cách tách chính xác duy nhất, và rule nhấn mạnh một bên sẽ kích hoạt đúng code đó.

**IDENTITY-3 · Đổi tên class sẽ đổi tên wire, nên rename phải có chủ đích.**

Vì code được suy ra từ class name, rename là thay đổi client có thể nhìn thấy chứ không chỉ là refactor. Đây là hệ quả cần chấp nhận và cũng là lý do phải giữ quy tắc: phương án ngược lại — giữ code cũ trong class đã đổi tên — tạo ra một class mà không người đọc nào có thể suy ra code từ tên.

Vì vậy, rename là quyết định migration, không phải dọn dẹp tiện tay. Nếu code cũ phải tiếp tục tương thích với client đã phát hành, hãy giữ class name cũ cho tới khi client đó được retire; điều bị cấm là đổi một nửa trong im lặng khiến class name và code bất đồng mãi mãi.

**IDENTITY-4 · Metadata type được đặt tên theo exception, kể cả khi không thêm field.**

`CourseNotFoundExceptionMetadata`, mở rộng `AbstractExceptionMetadata`, là type của constructor destructuring. Exception không có gì để nói vẫn khai báo `export type XExceptionMetadata = AbstractExceptionMetadata`, thay vì type trực tiếp là base.

Alias rỗng không phải nghi thức. Nó giữ chỗ cho field đầu tiên, cũng như object rỗng trong `EXCEPTION-2` giữ một cách viết thống nhất. Type base trực tiếp nói rằng lỗi này không mang gì thêm; điều đó sẽ sai ngay khi cần gắn id, và type base dùng chung không phải nơi để thêm field riêng. Đặt tên type theo exception cũng giúp người cầm error name tìm được payload mà không phải mở file.

**IDENTITY-5 · HTTP status không phải identity.**

`AbstractException` nhận một tùy chọn `httpStatus`; phần lớn exception bỏ qua và mặc định là 500. Đây là nhượng bộ cho transport trong những trường hợp status LÀ contract — guard trả 401, upload bị từ chối trả 413 — chứ không phải cách phân biệt lỗi, vì một status được hàng trăm lỗi dùng chung.

Đó là lý do exception có status vẫn cần mọi phần ở trên và reviewer vẫn hỏi “client match vào đâu?” Câu trả lời là code. Một declaration cố tình dùng status để phân biệt đã trả lời sai câu hỏi.

## Bị cấm

| Không bao giờ | Tại sao nó bị từ chối | Thay vào đó |
|---|---|---|
| Class failure tên `*Error` hoặc danh từ trần | Các exception rule dựa vào suffix `Exception`, nên class không bị kiểm tra dù cổng vẫn xanh | Đặt tên là `*Exception` |
| Code chọn thủ công thay vì suy ra từ class | Nó tạo tên thứ hai cho cùng failure, và client sẽ tiếp cận tên thứ hai trong khi source chỉ có tên thứ nhất | Viết class name theo SCREAMING_SNAKE |
| Code sao chép từ exception được khai báo phía trên | Hai lỗi không liên quan trở thành giống hệt nhau với client; đây là chính lỗi mà framework-vocabulary exception bị từ chối | Để code được suy ra từ declaration trong cùng file |
| Code được ghép khi chạy | Không thể tìm bằng search, trong khi mọi consumer đều dựa vào search | Truyền một literal |
| Đổi tên class nhưng giữ nguyên code | Hai tên không còn đồng nhất và không thể suy ra lẫn nhau | Đổi tên cả hai hoặc giữ class name cũ đến khi client retire |
| Constructor parameter được type là `AbstractExceptionMetadata` | Nó nói lỗi không mang thêm gì, và shared base không phải nơi thêm field riêng | `export type XExceptionMetadata = AbstractExceptionMetadata` |
| Dùng `httpStatus` để phân biệt lỗi | Status là category dùng chung cho hàng trăm failure, nên không tạo identity | Chỉ đặt status khi status là contract; code mang identity |

## Ví dụ

### Declaration thông thường — ba alphabet, một từ

```ts
/** Metadata when a caller reaches for a review that belongs to somebody else. */
export interface CourseReviewNotOwnedExceptionMetadata extends AbstractExceptionMetadata {
    id?: string
    userId?: string
}

/** Thrown when the caller is not the author of the review they are editing. */
export class CourseReviewNotOwnedException extends AbstractException {
    constructor({ id, userId, originalError }: CourseReviewNotOwnedExceptionMetadata) {
        super("Course review does not belong to this user", "COURSE_REVIEW_NOT_OWNED_EXCEPTION", {
            id, userId, originalError,
        })
    }
}
```

```ts
// Wrong: three names for one failure. A client matching `REVIEW_FORBIDDEN` cannot find the class,
// a reader holding the class cannot guess the code, and the payload type belongs to nobody.
export interface ReviewMetadata extends AbstractExceptionMetadata { id?: string }

export class CourseReviewNotOwnedException extends AbstractException {
    constructor({ id }: ReviewMetadata) {
        super("Forbidden", "REVIEW_FORBIDDEN", { id })
    }
}
```

Chúng khác nhau ở việc ba consumer có đọc cùng một từ hay không.

### Bẫy suffix — declaration mà rule không thể nhìn thấy

```ts
export class CourseAlreadyEnrolledException extends AbstractException { /* ... */ }
```

```ts
// Wrong: correctly based, correctly placed, correctly thrown - and matched by no exception rule in
// the plugin, because every one of them looks for a name ending in `Exception`.
export class CourseAlreadyEnrolledError extends AbstractException { /* ... */ }
```

Chúng khác nhau ở việc cổng có nhìn thấy class hay không.

### Code bị sao chép

```ts
export class ChallengeOtpNotFoundException extends AbstractException {
    constructor({ id }: ChallengeOtpNotFoundExceptionMetadata) {
        super("Challenge not found", "CHALLENGE_OTP_NOT_FOUND_EXCEPTION", { id })
    }
}
```

```ts
// Wrong: the line was left as it was found in the file this was written beside, so a missing OTP
// challenge and a missing course challenge now reach the client as the same failure.
export class ChallengeOtpNotFoundException extends AbstractException {
    constructor({ id }: ChallengeOtpNotFoundExceptionMetadata) {
        super("Challenge not found", "CHALLENGE_NOT_FOUND_EXCEPTION", { id })
    }
}
```

Chúng khác nhau ở việc code có có nguồn gốc hay chỉ được sao chép từ hàng xóm.

### Type metadata rỗng

```ts
/** Metadata for a request missing the `x-admin-api-key` header. */
export type AdminApiKeyRequiredExceptionMetadata = AbstractExceptionMetadata

export class AdminApiKeyRequiredException extends AbstractException {
    constructor({ originalError }: AdminApiKeyRequiredExceptionMetadata) {
        super("x-admin-api-key header is required.", "ADMIN_API_KEY_REQUIRED_EXCEPTION", {
            originalError,
        }, HttpStatus.UNAUTHORIZED)
    }
}
```

```ts
// Wrong: the parameter is typed as the base every exception shares, so the day this failure needs
// to say WHICH key was rejected there is nowhere to put it that does not belong to all of them.
export class AdminApiKeyRequiredException extends AbstractException {
    constructor({ originalError }: AbstractExceptionMetadata = {}) {
        super("x-admin-api-key header is required.", "ADMIN_API_KEY_REQUIRED_EXCEPTION", {
            originalError,
        }, HttpStatus.UNAUTHORIZED)
    }
}
```

Chúng khác nhau ở việc error có thuộc type mô tả chính nó hay không.

### Status không có tên

```ts
// Two refusals, distinguishable by code; the status says only how the transport should answer.
super("Playground is not part of this plan", "PLAYGROUND_NOT_ENTITLED_EXCEPTION", { userId },
    HttpStatus.FORBIDDEN)
super("Premium content requires an active plan", "PREMIUM_CONTENT_AI_ACCESS_DENIED_EXCEPTION",
    { userId }, HttpStatus.FORBIDDEN)
```

```ts
// Wrong: the status was chosen to make this failure "different" from the one beside it. It is not -
// hundreds of failures answer 403, and the client still has nothing to branch on.
super("Not allowed", "FORBIDDEN_EXCEPTION", { userId }, HttpStatus.FORBIDDEN)
```

Chúng khác nhau ở việc error được phân biệt bằng code hay chỉ bằng transport status.
