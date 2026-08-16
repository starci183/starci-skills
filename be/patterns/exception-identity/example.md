---
id: be-patterns-exception-identity-example
title: example.md
slug: /be/patterns/exception-identity/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi case và ngoại lệ của từng mã IDENTITY-N, viết bằng TypeScript thường.
---

# example.md

> Version: `2.00` · Module: `exception-identity` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **TypeScript thường**, có dáng một ứng dụng Nest. Không dùng tên sản phẩm, tên
module riêng hay tên repository. Một luật chỉ đúng khi nó đúng ở bất kỳ back end nào — vì vậy nếu một
ví dụ cần tên riêng của một hệ thống cụ thể mới đọc được, ví dụ đó không phù hợp ở đây.

Hai import dùng chung cho tất cả các ví dụ, không lặp lại ở từng khối:

```ts
import type {
    AbstractExceptionMetadata,
} from "../abstract"
import {
    AbstractException,
} from "../abstract"
```

Mỗi mã có **nhiều case**, mỗi case đặt ĐÚNG cạnh SAI, rồi tới mục **ngoại lệ và nhầm lẫn**. Ba mục
cuối trang ánh xạ từ một yêu cầu bằng lời sang một mã, phân định các mã cạnh nhau, và liệt kê những
sai lầm quay lại nhiều nhất.

---

## `IDENTITY-1` — tên class kết thúc bằng `Exception`

### Case: khai báo thường — ba bảng chữ, một từ

```ts
// ĐÚNG
/** Metadata khi caller với tới một document không thuộc về mình. */
export interface DocumentNotOwnedExceptionMetadata extends AbstractExceptionMetadata {
    documentId?: string
    userId?: string
}

/** Thrown when the caller is not the owner of the document being edited. */
export class DocumentNotOwnedException extends AbstractException {
    constructor({ documentId, userId, originalError }: DocumentNotOwnedExceptionMetadata) {
        super(
            "Document does not belong to this user",
            "DOCUMENT_NOT_OWNED_EXCEPTION",
            { documentId, userId, originalError },
        )
    }
}
```

```ts
// SAI: ba cái tên cho một lỗi. Client khớp `DOC_FORBIDDEN` không tìm ra class, người đọc cầm class
// không đoán được code, và type payload thì chẳng thuộc về ai.
export interface DocMetadata extends AbstractExceptionMetadata {
    documentId?: string
}

export class DocumentNotOwnedError extends AbstractException {
    constructor({ documentId }: DocMetadata) {
        super("Forbidden", "DOC_FORBIDDEN", { documentId })
    }
}
```

Hai khối khác nhau ở đúng một điều: ba người đọc có đang đọc cùng một từ hay không. Và khối SAI hỏng
theo cách tệ nhất — vì tên class không kết thúc bằng `Exception`, mọi rule khác **bỏ qua** nó, nên cả
code sai lẫn type sai đều không được báo. Một lỗi, ba khuyết tật, gate xanh.

### Case: cái bẫy hậu tố — khai báo không rule nào nhìn thấy

```ts
// ĐÚNG
export class WorkspaceSeatLimitReachedException extends AbstractException {
    constructor({ workspaceId, originalError }: WorkspaceSeatLimitReachedExceptionMetadata) {
        super(
            "Workspace has no seats left",
            "WORKSPACE_SEAT_LIMIT_REACHED_EXCEPTION",
            { workspaceId, originalError },
        )
    }
}
```

```ts
// SAI: base đúng, thư mục đúng, throw ở call site thật đúng - và không một rule exception nào khớp,
// vì tất cả đều tìm tên kết thúc bằng `Exception`.
export class WorkspaceSeatLimitReachedError extends AbstractException {
    constructor({ workspaceId, originalError }: WorkspaceSeatLimitReachedErrorMetadata) {
        super(
            "Workspace has no seats left",
            "WORKSPACE_SEAT_LIMIT_REACHED_ERROR",
            { workspaceId, originalError },
        )
    }
}
```

Hai khối khác nhau ở đúng một điều: gate có nhìn thấy class hay không.

### Case: lỗi port từ thư viện ngoài — quán tính đặt tên

```ts
// ĐÚNG: tên upstream ở lại trong `originalError`, không leo lên thành tên class.
export interface ArchiveExtractFailedExceptionMetadata extends AbstractExceptionMetadata {
    archiveKey: string
}

export class ArchiveExtractFailedException extends AbstractException {
    constructor({ archiveKey, originalError }: ArchiveExtractFailedExceptionMetadata) {
        super(
            "Archive could not be extracted",
            "ARCHIVE_EXTRACT_FAILED_EXCEPTION",
            { archiveKey, originalError },
        )
    }
}
```

```ts
// SAI: tên giữ nguyên theo thư viện gốc vì "nó vốn tên thế". Quán tính của một thư viện không phải
// quy ước của ứng dụng này.
export class ZipExtractionError extends AbstractException {
    constructor({ archiveKey, originalError }: ZipExtractionErrorMetadata) {
        super("Archive could not be extracted", "ZIP_EXTRACTION_ERROR", { archiveKey, originalError })
    }
}
```

### Case: danh từ trần

```ts
// ĐÚNG
export class SlugAlreadyTakenException extends AbstractException {
    constructor({ slug, originalError }: SlugAlreadyTakenExceptionMetadata) {
        super("Slug is already taken", "SLUG_ALREADY_TAKEN_EXCEPTION", { slug, originalError })
    }
}
```

```ts
// SAI: ngắn hơn thật, và vô hình với mọi gate.
export class SlugTaken extends AbstractException {
    constructor({ slug, originalError }: SlugTakenMetadata) {
        super("Slug is already taken", "SLUG_TAKEN", { slug, originalError })
    }
}
```

### Ngoại lệ và nhầm lẫn

- **Không có miễn trừ cho lỗi "nội bộ".** Một lỗi chỉ chạy trong background job vẫn phải đặt đúng
  tên: nó là cái sẽ xuất hiện trong alert, và alert cũng khớp theo code.

- **Class expression không được rule nhìn thấy.** Rule duyệt `ClassDeclaration`. Viết theo lối dưới
  đây là ra ngoài tầm mắt của gate — không phải một ngoại lệ được cấp, mà là một lỗ đã biết:

  ```ts
  // SAI: đúng chữ nhưng ra khỏi tầm kiểm. Khai báo bằng `export class`.
  export const TokenExpiredException = class extends AbstractException {
      constructor({ originalError }: AbstractExceptionMetadata) {
          super("Token expired", "TOKEN_EXPIRED_EXCEPTION", { originalError })
      }
  }
  ```

- **Sửa `IDENTITY-1` trên một class đã phát hành là một lần đổi tên.** Đọc `IDENTITY-3` trước khi
  đổi, đừng coi nó là dọn dẹp.

---

## `IDENTITY-2` — code là tên class, viết SCREAMING_SNAKE

### Case: code suy ra từ tên class

```ts
// ĐÚNG: người có class biết code; người có code grep ra class.
export class InvoiceNotFoundException extends AbstractException {
    constructor({ invoiceId, originalError }: InvoiceNotFoundExceptionMetadata) {
        super("Invoice not found", "INVOICE_NOT_FOUND_EXCEPTION", { invoiceId, originalError })
    }
}
```

```ts
// SAI: code chọn tay. Đây là cái tên THỨ HAI của một lỗi - và cái tên thứ hai mới là cái nằm trong
// client, trong alert rule và trong ticket, còn cái thứ nhất chỉ có trong source.
export class InvoiceNotFoundException extends AbstractException {
    constructor({ invoiceId, originalError }: InvoiceNotFoundExceptionMetadata) {
        super("Invoice not found", "ERR_INVOICE_404", { invoiceId, originalError })
    }
}
```

### Case: code copy từ file bên cạnh

```ts
// ĐÚNG
export class WebhookDeliveryNotFoundException extends AbstractException {
    constructor({ deliveryId, originalError }: WebhookDeliveryNotFoundExceptionMetadata) {
        super(
            "Webhook delivery not found",
            "WEBHOOK_DELIVERY_NOT_FOUND_EXCEPTION",
            { deliveryId, originalError },
        )
    }
}
```

```ts
// SAI: dòng `super()` được để nguyên như trong file mà khai báo này được viết bên cạnh. Giờ một
// webhook thiếu và một subscription thiếu tới client y hệt nhau, và client không rẽ nhánh được.
export class WebhookDeliveryNotFoundException extends AbstractException {
    constructor({ deliveryId, originalError }: WebhookDeliveryNotFoundExceptionMetadata) {
        super(
            "Webhook delivery not found",
            "SUBSCRIPTION_NOT_FOUND_EXCEPTION",
            { deliveryId, originalError },
        )
    }
}
```

Hai khối khác nhau ở đúng một điều: code được **suy ra** hay được **thừa kế từ hàng xóm**.

### Case: code ghép lúc chạy

```ts
// ĐÚNG: literal, nên grep được.
export class ProviderRateLimitedException extends AbstractException {
    constructor({ provider, originalError }: ProviderRateLimitedExceptionMetadata) {
        super(
            "Upstream provider rate limited the request",
            "PROVIDER_RATE_LIMITED_EXCEPTION",
            { provider, originalError },
        )
    }
}
```

```ts
// SAI: không ai tìm được code này bằng cách grep - mà grep chính là việc DUY NHẤT mọi consumer của
// một code đều làm: client khớp nó, alert gom nhóm theo nó, người đọc hỏi lỗi này từ đâu ra.
export class ProviderRateLimitedException extends AbstractException {
    constructor({ provider, originalError }: ProviderRateLimitedExceptionMetadata) {
        super(
            "Upstream provider rate limited the request",
            `${provider.toUpperCase()}_RATE_LIMITED_EXCEPTION`,
            { provider, originalError },
        )
    }
}
```

Biến động nằm ở **metadata**, không nằm ở code. `provider` là dữ liệu của lần hỏng này; code là danh
tính của loại hỏng.

### Case: acronym — hai cách tách đều được nhận

```ts
// CẢ HAI ĐỀU ĐÚNG. Chỗ đặt gạch dưới bên trong acronym không thuộc luật này; chữ cái mới thuộc.
export class GraphQLDataNotFoundException extends AbstractException {
    constructor({ query, originalError }: GraphQLDataNotFoundExceptionMetadata) {
        super("GraphQL data not found", "GRAPHQL_DATA_NOT_FOUND_EXCEPTION", { query, originalError })
    }
}

export class GraphQLDataNotFoundException2 extends AbstractException {
    constructor({ query, originalError }: GraphQLDataNotFoundException2Metadata) {
        super("GraphQL data not found", "GRAPH_QL_DATA_NOT_FOUND_EXCEPTION", { query, originalError })
    }
}
```

Một rule ép một cách tách sẽ bắn vào code đang đúng. Đó là lý do phép so sánh bỏ hết gạch dưới rồi mới
đối chiếu chữ cái.

### Case: code là tên của một status

```ts
// ĐÚNG: code nói lỗi NÀO; status nói transport đáp thế nào.
export class ApiKeyRevokedException extends AbstractException {
    constructor({ keyId, originalError }: ApiKeyRevokedExceptionMetadata) {
        super(
            "API key has been revoked",
            "API_KEY_REVOKED_EXCEPTION",
            { keyId, originalError },
            HttpStatus.UNAUTHORIZED,
        )
    }
}
```

```ts
// SAI: code lấy tên của status. Hàng trăm lỗi cùng trả 401, nên code này không phân biệt được gì -
// và nó cũng không khớp tên class, nên gate bắt.
export class ApiKeyRevokedException extends AbstractException {
    constructor({ keyId, originalError }: ApiKeyRevokedExceptionMetadata) {
        super("Unauthorized", "UNAUTHORIZED_EXCEPTION", { keyId, originalError }, HttpStatus.UNAUTHORIZED)
    }
}
```

### Ngoại lệ và nhầm lẫn

- **Code không được rút gọn cho vừa dòng.** Nếu dòng dài, xuống dòng — đừng cắt chữ:

  ```ts
  // SAI
  super("Upload rejected", "UPLOAD_REJECTED_EXC", { uploadId })
  // ĐÚNG
  super(
      "Upload rejected",
      "UPLOAD_REJECTED_EXCEPTION",
      { uploadId },
  )
  ```

- **Hằng số cũng không phải literal ở chỗ này.** Rule đọc đối số thứ hai của `super()`; một hằng số
  import từ file khác làm code không còn tìm được từ chính khai báo:

  ```ts
  // SAI
  super("Upload rejected", ERROR_CODES.UPLOAD_REJECTED, { uploadId })
  ```

- **Không có constructor thì không có gì để kiểm.** Một class không khai constructor sẽ không bị rule
  này chạm tới; nó cũng không có code riêng, nên nó thừa kế danh tính của cha — điều mà cả module này
  từ chối:

  ```ts
  // SAI: không có `super()` của riêng mình, nên lỗi này không có danh tính của riêng mình.
  export class ReportGenerationFailedException extends AbstractException {}
  ```

---

## `IDENTITY-3` — đổi tên class là đổi hợp đồng trên dây

### Case: đổi tên đúng cách — cả hai bảng chữ cùng đi

```ts
// TRƯỚC
export class FolderNotFoundException extends AbstractException {
    constructor({ folderId, originalError }: FolderNotFoundExceptionMetadata) {
        super("Folder not found", "FOLDER_NOT_FOUND_EXCEPTION", { folderId, originalError })
    }
}
```

```ts
// SAU - ĐÚNG: class, code và type cùng đổi, và spec nào đang ghim code cũ cũng nằm trong cùng diff.
export interface PathNotFoundExceptionMetadata extends AbstractExceptionMetadata {
    path?: string
}

export class PathNotFoundException extends AbstractException {
    constructor({ path, originalError }: PathNotFoundExceptionMetadata) {
        super("Path not found", "PATH_NOT_FOUND_EXCEPTION", { path, originalError })
    }
}
```

### Case: nửa đổi tên — hai cái tên bất đồng mãi mãi

```ts
// SAI: class đã là "path", code vẫn còn là "folder". Người đọc một trong hai cái tên không đoán
// được cái kia, và cả hai đều là tên thật của cùng một lỗi ở hai hệ thống khác nhau.
export class PathNotFoundException extends AbstractException {
    constructor({ path, originalError }: PathNotFoundExceptionMetadata) {
        super("Path not found", "FOLDER_NOT_FOUND_EXCEPTION", { path, originalError })
    }
}
```

Đây chính là thứ bị từ chối — không phải việc giữ code cũ, mà việc giữ nó **im lặng**.

### Case: client đã phát hành còn ghim code cũ

```ts
// ĐÚNG: giữ nguyên TÊN CLASS cũ cho tới khi client kia được gỡ. Hai bảng chữ vẫn khớp nhau, và
// comment nói rõ khi nào lần đổi tên được phép xảy ra.
/**
 * Kept under the old name until the released client pinned to
 * `FOLDER_NOT_FOUND_EXCEPTION` is retired. Rename class and code together at that point.
 */
export class FolderNotFoundException extends AbstractException {
    constructor({ path, originalError }: FolderNotFoundExceptionMetadata) {
        super("Path not found", "FOLDER_NOT_FOUND_EXCEPTION", { path, originalError })
    }
}
```

```ts
// SAI: giữ code cũ bằng cách để class mới mang nó. Nhìn thì cũng "tương thích ngược", nhưng nó tạo
// ra đúng cái bất đồng vĩnh viễn mà cách trên tránh được.
export class PathNotFoundException extends AbstractException {
    constructor({ path, originalError }: PathNotFoundExceptionMetadata) {
        super("Path not found", "FOLDER_NOT_FOUND_EXCEPTION", { path, originalError })
    }
}
```

### Case: cái mà một lần đổi tên làm vỡ

```ts
// Spec e2e ghim đúng chuỗi code. Đây là nhân chứng cơ học duy nhất cho `IDENTITY-3`: đổi code thì
// spec đỏ; đổi tên class mà giữ code thì KHÔNG có gì đỏ cả - và đó mới là trường hợp nguy hiểm.
expect(body.error).toBe("FOLDER_NOT_FOUND_EXCEPTION")
```

```ts
// Cùng một code, đọc ở hai biên khác nhau. Cả hai đều là hợp đồng ra ngoài.
// GraphQL: formatError gắn code vào extensions
extensions: { code: original.code, http: { status: original.httpStatus ?? 500 } }
// REST: filter đưa code vào body
response.status(status).json({ statusCode: status, code: exception.code, message: exception.message })
```

### Ngoại lệ và nhầm lẫn

- **Rename hàng loạt bằng IDE là chỗ mã này bị vi phạm nhiều nhất.** Refactor "Rename Symbol" đổi tên
  class ở mọi nơi và **không** chạm vào chuỗi trong `super()`. Sau một lần refactor lớn, kiểm lại
  từng file trong thư mục errors.
- **Sửa lỗi chính tả cũng là đổi tên.** `RecieptNotFoundException` → `ReceiptNotFoundException` đổi
  code trên dây, không phải một cú sửa chữ.
- **Đo trước khi tin.** Trước khi kết luận "đổi code là phải phát hành đồng bộ", hãy grep code đó
  trong mọi client. Lần đo thật cho kết quả: năm code được khớp trên ba front end, và không code nào
  thuộc về một khai báo đã trôi.

---

## `IDENTITY-4` — type metadata mang tên chính exception của nó

### Case: lỗi có payload

```ts
// ĐÚNG
export interface UploadTooLargeExceptionMetadata extends AbstractExceptionMetadata {
    uploadId: string
    byteSize: number
}

export class UploadTooLargeException extends AbstractException {
    constructor({ uploadId, byteSize, originalError }: UploadTooLargeExceptionMetadata) {
        super(
            "Upload exceeds the maximum allowed size",
            "UPLOAD_TOO_LARGE_EXCEPTION",
            { uploadId, byteSize, originalError },
        )
    }
}
```

```ts
// SAI: type đặt tên theo entity. Người đọc cầm tên lỗi không tìm ra payload, và ngày mai một lỗi
// upload khác cũng sẽ "mượn" đúng type này rồi hai lỗi dùng chung một hợp đồng.
export interface UploadMetadata extends AbstractExceptionMetadata {
    uploadId: string
    byteSize: number
}

export class UploadTooLargeException extends AbstractException {
    constructor({ uploadId, byteSize, originalError }: UploadMetadata) {
        super(
            "Upload exceeds the maximum allowed size",
            "UPLOAD_TOO_LARGE_EXCEPTION",
            { uploadId, byteSize, originalError },
        )
    }
}
```

### Case: lỗi không mang gì — alias rỗng vẫn phải khai

```ts
// ĐÚNG
/** Metadata for a request missing the required admin header. */
export type AdminHeaderRequiredExceptionMetadata = AbstractExceptionMetadata

export class AdminHeaderRequiredException extends AbstractException {
    constructor({ originalError }: AdminHeaderRequiredExceptionMetadata) {
        super(
            "Admin header is required.",
            "ADMIN_HEADER_REQUIRED_EXCEPTION",
            { originalError },
            HttpStatus.UNAUTHORIZED,
        )
    }
}
```

```ts
// SAI: tham số gõ thẳng base mà MỌI exception dùng chung. Ngày lỗi này cần nói HEADER NÀO bị từ
// chối, không có chỗ nào để thêm trường mà không thêm cho tất cả - và khai báo phải bị nắn lại
// trước khi mở rộng được.
export class AdminHeaderRequiredException extends AbstractException {
    constructor({ originalError }: AbstractExceptionMetadata) {
        super(
            "Admin header is required.",
            "ADMIN_HEADER_REQUIRED_EXCEPTION",
            { originalError },
            HttpStatus.UNAUTHORIZED,
        )
    }
}
```

Hai khối khác nhau ở đúng một điều: lỗi có sở hữu cái type mô tả nó hay không.

### Case: tham số không có annotation

```ts
// ĐÚNG
export interface JobAlreadyRunningExceptionMetadata extends AbstractExceptionMetadata {
    jobId: string
}

export class JobAlreadyRunningException extends AbstractException {
    constructor({ jobId, originalError }: JobAlreadyRunningExceptionMetadata) {
        super("Job is already running", "JOB_ALREADY_RUNNING_EXCEPTION", { jobId, originalError })
    }
}
```

```ts
// SAI: destructure trần. Tham số là TOÀN BỘ hợp đồng mà throw site phải thoả, và một tham số không
// gõ kiểu thì nhận mọi object - kể cả object thiếu đúng cái id mà lỗi này sinh ra để mang.
export class JobAlreadyRunningException extends AbstractException {
    constructor({ jobId, originalError }) {
        super("Job is already running", "JOB_ALREADY_RUNNING_EXCEPTION", { jobId, originalError })
    }
}
```

### Case: giá trị mặc định `= {}` bọc ngoài destructuring

```ts
// ĐÚNG: mặc định vẫn được, miễn là annotation nằm đúng chỗ và mang đúng tên.
export type ConfigMissingExceptionMetadata = AbstractExceptionMetadata

export class ConfigMissingException extends AbstractException {
    constructor({ originalError }: ConfigMissingExceptionMetadata = {}) {
        super(
            "Required configuration is missing.",
            "CONFIG_MISSING_EXCEPTION",
            { originalError },
            HttpStatus.INTERNAL_SERVER_ERROR,
        )
    }
}
```

```ts
// SAI: đúng cái dáng từng lọt lưới. `{ ... }: Metadata = {}` parse thành AssignmentPattern bọc
// ngoài ObjectPattern, nên một rule chỉ đọc node ngoài sẽ bỏ qua CHÍNH những khai báo đã từ bỏ
// type có tên - tức là những khai báo mà rule này tồn tại để bắt.
export class ConfigMissingException extends AbstractException {
    constructor({ originalError }: AbstractExceptionMetadata = {}) {
        super(
            "Required configuration is missing.",
            "CONFIG_MISSING_EXCEPTION",
            { originalError },
            HttpStatus.INTERNAL_SERVER_ERROR,
        )
    }
}
```

### Case: hai lỗi dùng chung một type

```ts
// ĐÚNG: mỗi lỗi một type, kể cả khi hai type có cùng trường. Trùng hình dạng hôm nay không phải lý
// do để chia chung hợp đồng ngày mai.
export interface MemberNotFoundExceptionMetadata extends AbstractExceptionMetadata {
    memberId: string
}

export interface MemberAlreadyInvitedExceptionMetadata extends AbstractExceptionMetadata {
    memberId: string
}
```

```ts
// SAI: một type cho hai lỗi. Ngày một trong hai cần thêm trường, cái kia cũng nhận trường đó, và
// call site của nó bắt đầu được phép truyền một thứ vô nghĩa.
export interface MemberExceptionMetadata extends AbstractExceptionMetadata {
    memberId: string
}
```

### Ngoại lệ và nhầm lẫn

- **`type` hay `interface` đều được.** Alias rỗng thì `type` là cách duy nhất viết được; có trường
  thêm thì `interface ... extends` đọc rõ hơn. Luật nói về **tên**, không nói về từ khoá.

- **Annotation không phải một tên đơn thì rule im lặng.** Union hay intersection đi qua được gate,
  nhưng vẫn sai luật:

  ```ts
  // SAI: qua được rule, không qua được luật.
  constructor({ jobId }: JobAlreadyRunningExceptionMetadata | AbstractExceptionMetadata) {
  ```

- **Đừng đặt trường mới vào base.** Đó chính là hệ quả mà mã này ngăn:

  ```ts
  // SAI: thêm `documentId` vào type mà mọi exception dùng chung.
  export interface AbstractExceptionMetadata {
      originalError?: Error
      documentId?: string
  }
  ```

---

## `IDENTITY-5` — HTTP status không phải danh tính

### Case: status là hợp đồng

```ts
// ĐÚNG: hai từ chối, phân biệt bằng CODE; status chỉ nói transport nên đáp thế nào.
super(
    "Feature is not part of this plan",
    "FEATURE_NOT_ENTITLED_EXCEPTION",
    { userId },
    HttpStatus.FORBIDDEN,
)

super(
    "Document is restricted to plan members",
    "DOCUMENT_PLAN_RESTRICTED_EXCEPTION",
    { userId },
    HttpStatus.FORBIDDEN,
)
```

```ts
// SAI: status được chọn để lỗi này "khác" lỗi bên cạnh. Nó không khác - hàng trăm lỗi cùng đáp 403,
// và client vẫn không có gì để rẽ nhánh.
super("Not allowed", "FORBIDDEN_EXCEPTION", { userId }, HttpStatus.FORBIDDEN)
```

### Case: lỗi domain thường — không set gì cả

```ts
// ĐÚNG: bỏ qua status, rơi về mặc định ở biên. Đây là trạng thái đúng của phần lớn khai báo.
export class OrderAlreadySettledException extends AbstractException {
    constructor({ orderId, originalError }: OrderAlreadySettledExceptionMetadata) {
        super(
            "Order has already been settled",
            "ORDER_ALREADY_SETTLED_EXCEPTION",
            { orderId, originalError },
        )
    }
}
```

```ts
// SAI: set 409 chỉ vì "nghe hợp lý hơn 500". Không caller nào cam kết với 409 ở đây, nên đây là một
// quyết định transport không ai yêu cầu - và ngày một caller thật cần một status khác, không ai
// biết status hiện tại đến từ đâu.
export class OrderAlreadySettledException extends AbstractException {
    constructor({ orderId, originalError }: OrderAlreadySettledExceptionMetadata) {
        super(
            "Order has already been settled",
            "ORDER_ALREADY_SETTLED_EXCEPTION",
            { orderId, originalError },
            HttpStatus.CONFLICT,
        )
    }
}
```

### Case: cấu hình sai thật sự là 500

```ts
// ĐÚNG: đây không phải lỗi của caller, và 500 là câu trả lời trung thực - không phải một cách để
// lỗi này trông khác lỗi 401 bên cạnh.
export type SigningSecretNotConfiguredExceptionMetadata = AbstractExceptionMetadata

export class SigningSecretNotConfiguredException extends AbstractException {
    constructor({ originalError }: SigningSecretNotConfiguredExceptionMetadata) {
        super(
            "Signing secret is not configured.",
            "SIGNING_SECRET_NOT_CONFIGURED_EXCEPTION",
            { originalError },
            HttpStatus.INTERNAL_SERVER_ERROR,
        )
    }
}
```

```ts
// SAI: đổi thành 401 cho "giống họ hàng" của nó trong cùng guard. Caller bị nói dối: đây là lỗi
// server, không phải thiếu thông tin xác thực, và client sẽ đi làm đúng một việc vô ích là đăng
// nhập lại.
super(
    "Signing secret is not configured.",
    "SIGNING_SECRET_NOT_CONFIGURED_EXCEPTION",
    { originalError },
    HttpStatus.UNAUTHORIZED,
)
```

### Ngoại lệ và nhầm lẫn

- **Set status trên lỗi chỉ chạy trong background job là vô nghĩa.** Không transport nào đọc nó ở đó.
  Nếu cùng một lỗi cũng đi qua HTTP, thì status thuộc về đường HTTP đó — và lúc ấy phải nói được
  endpoint nào cam kết.
- **Đừng quay lại dùng exception của framework chỉ vì nó "mang sẵn status".** Đó là `EXCEPTION-1`, và
  cái giá là mất danh tính.
- **Có set status thì vẫn phải thoả mọi mã ở trên.** Status không mua được miễn trừ nào.

---

## Ánh xạ yêu cầu sang một mã định danh

Nêu class, code, type metadata và status. Nếu thiếu **một** dữ kiện quyết định, hỏi **một** câu cụ thể
rồi dừng.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| "Thêm một lỗi cho document không thuộc về người gọi" | Khai báo mới, ba bảng chữ cùng viết một lượt | `IDENTITY-1`, `IDENTITY-2`, `IDENTITY-4` | `DocumentNotOwnedException` + `"DOCUMENT_NOT_OWNED_EXCEPTION"` + `DocumentNotOwnedExceptionMetadata` |
| "Đặt tên nó là `DocumentForbiddenError` cho ngắn" | Hậu tố là thứ duy nhất mọi rule nhìn thấy | `IDENTITY-1` | Đổi thành `*Exception`, từ chối tên rút gọn |
| "Client đang chờ code `DOC_403`, cứ để code đó" | Code chọn tay là tên thứ hai của một lỗi | `IDENTITY-2` | Suy code từ tên class; nếu client thật sự đã ghim, giữ **tên class** cũ |
| "Đổi `Folder` thành `Path` cho đúng domain" | Đổi tên class là đổi hợp đồng trên dây | `IDENTITY-3` | Đổi cả class lẫn code trong một diff, kèm mọi spec đang ghim |
| "Lỗi này chẳng mang dữ liệu gì, bỏ type đi" | Alias rỗng là chỗ trường đầu tiên rơi vào | `IDENTITY-4` | `export type XExceptionMetadata = AbstractExceptionMetadata` |
| "Cho lỗi này 409 để nó khác lỗi kia" | Status là hạng mục hàng trăm lỗi cùng thuộc về | `IDENTITY-5` | Bỏ status; phân biệt bằng code |
| "Guard này phải trả 401 theo hợp đồng đăng nhập" | Status **là** hợp đồng | `IDENTITY-5` | Set `HttpStatus.UNAUTHORIZED`, code vẫn phải đủ riêng |
| "Ghép code theo tên provider cho gọn" | Code ghép lúc chạy thì không grep được | `IDENTITY-2` | Literal ở code, biến động để trong metadata |

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `IDENTITY-1` / `EXCEPTION-3` | Class sai ở **tên**, hay sai ở **base** nó extends? |
| `IDENTITY-1` / `IDENTITY-2` | Gate có nhìn thấy class không, hay gate thấy rồi nhưng code không khớp tên? |
| `IDENTITY-2` / `IDENTITY-3` | Đây là khai báo **mới**, hay là khai báo **đã có client**? |
| `IDENTITY-2` / `IDENTITY-5` | Hai lỗi đang được phân biệt bằng code, hay đang được phân biệt bằng status? |
| `IDENTITY-4` / `EXCEPTION-2` | Constructor sai ở chỗ **không nhận một object**, hay object đó **không có tên riêng**? |
| `IDENTITY-4` / base chung | Trường mới sắp được thêm vào type của lỗi này, hay vào type mọi lỗi dùng chung? |
| `IDENTITY-5` / mặc định | Có caller nào **đã cam kết** với status này chưa? |

## Sai lầm lặp lại nhiều nhất

1. Copy file lỗi bên cạnh, sửa tên class, quên sửa code trong `super()`.
2. Đặt tên `*Error` rồi tưởng gate xanh nghĩa là đúng — trong khi gate không nhìn thấy class.
3. Gõ tham số constructor thẳng bằng `AbstractExceptionMetadata` vì "lỗi này chẳng mang gì".
4. Đổi tên class bằng IDE refactor mà không đụng tới chuỗi code.
5. Chọn status để hai lỗi trông khác nhau, thay vì viết hai code khác nhau.
6. Ghép code bằng template string theo tenant, provider hay môi trường.
7. Dùng chung một type metadata cho cả một họ lỗi vì hôm nay chúng cùng trường.
8. Set status trên một lỗi không đi qua transport nào.
