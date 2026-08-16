# đặt tên

## Định nghĩa

Tên là phần duy nhất của symbol đến được với người đọc trước khi họ mở symbol. Mọi thứ khác — signature, implementation và test — cần thêm một file để tham khảo; tên xuất hiện miễn phí ở mọi call site, import list và grep.

Vì vậy, một cái tên phải trả lời: **đối với người chưa biết, thứ này là gì?** Không phải nó được triển khai bằng gì, viết cho schema version nào, hay đang nằm trong folder nào. Những điều đó thay đổi; tên mã hóa một trong số chúng sẽ trở thành lời nói dối mà không có phép kiểm tra nào bắt được.

Phép thử quyết định là: **sau lần thay đổi hợp lý tiếp theo, tên có còn đúng không?** Nếu tên phải đổi khi schema version, folder hoặc caller thứ hai xuất hiện, nó không đang đặt tên cho sự vật mà đang mô tả một thời điểm.

Rule này được giữ bởi [`sources/be/naming.mjs`](../../../sources/be/naming.mjs).

## Quy tắc

**TÊN-1 · PATH mang role và scope; file đặt tên cho subject.**

`parsers/content.service.ts` khai báo `ContentParserService`. `path/content.service.ts` khai báo `ContentPathService`. Cùng file name nhưng khác path, và class name đọc cùng với path — đó là lý do file không được gọi `content-parser.service.ts`, và `mutations/ai/purchase-ai-subscription/` chứa `purchase-ai-subscription.module.ts` thay vì `purchase-ai-subscription-single-mutation.module.ts`.

Rule này từng được kiểm tra bằng dữ liệu thực. Phiên bản đầu yêu cầu file name viết đầy đủ class name và đo được 616 vi phạm trên 4430 file — đó không phải debt 14% của cả tree mà là convention. Rule phải phản ánh điều code thực sự làm.

Suffix vẫn phải khớp ROLE: `*.service.ts` khai báo `*Service`, `*.handler.ts` khai báo `*Handler`. File có suffix không khớp export đang khẳng định một role mà symbol không có.

**TÊN-2 · Tên nói sự vật LÀ gì, không nói nó được tạo cho version nào.**

`isV2`, `IsContentV2Params`, `parseV2Body` đều phải rename khi V3 xuất hiện. Khó hơn việc rename là trước thời điểm đó, người đọc không biết “V2” chỉ hình hiện tại hay hình cũ, nên ai cũng phải tra cứu.

Hãy đặt tên cho property. Marker cho biết content đã được editor kiểm tra là `hasVerifiedMarker`, và tên đó vẫn đúng ở version giới thiệu nó. Đây không phải giả thuyết: parser V1 trong codebase từng bị gọi qua `isV2`; khi V1 biến mất, cái tên còn lại mô tả một fork không còn tồn tại.

**TÊN-3 · Tên nói sự vật LÀ gì, không nói nó được dùng ở đâu.**

Helper đọc mounted content từng được gọi `VolumeService` vì lúc đó folder có tên `.volume`. Folder đã đổi tên hai lần; sau mỗi lần, helper vẫn mang tên của một path không còn tồn tại mà không có gì báo lỗi.

Hãy đặt tên cho subject, không đặt tên cho địa chỉ.

**TÊN-4 · Tên nói sự vật LÀ gì, không nói cơ chế hiện đang dùng.**

Tier table tên `HARNESS_TIER` và biến `currentTier` phải được đặt theo routing mechanism hơn là thứ được chọn. Khi cơ chế thay đổi, mọi tên xung quanh sẽ đồng loạt sai — vì chưa từng nói đến “model”.

**NAME-5 · Exported function là verb phrase có object.**

`generate` là bare verb: generate cái gì? `askModel` thì nói rõ. Trong import list, bare verb va vào bare verb của module khác và caller phải nhìn path để đoán — tức path đang làm phần việc đặt tên, trong khi NAME-3 giải thích vì sao đó là cách đặt tên không bền.

**TÊN-6 · Boolean là một câu hỏi về một property đang tồn tại.**

`isX`, `hasX`, `canX`. Không `checkX` (nghe như function thực hiện một action), không `xFlag`. Property được hỏi cũng tuân theo TÊN-2: `hasVerifiedMarker`, không `isV2`.

**TÊN-7 · Tên không được caller đầu tiên quyết định.**

`DashboardContentService` trở nên sai ngay khi surface thứ hai cần dùng nó, nhưng vẫn tiếp tục hoạt động và báo sai về capability. Hãy đặt tên cho capability.

## Bị cấm

| Không bao giờ | Tại sao nó bị từ chối | Thay vào đó |
|---|---|---|
| File suffix không khớp role của export | Suffix khẳng định một role mà symbol không có | Khớp `*.service.ts` với `*Service`, v.v. |
| Lặp lại role hoặc scope của folder trong file name | Path đã nói điều đó, nên tên dài hơn mà không thêm thông tin | Đặt tên cho subject; để path mang phần còn lại |
| Tên chứa version (`isV2`, `V2Params`) | Nó sẽ phải rename khi có V3, và trước đó không ai biết nó là current hay legacy | Đặt tên cho property mà version tình cờ giới thiệu |
| Tên lấy từ folder chứa nó | Folder di chuyển, rồi tên mô tả một địa chỉ không còn tồn tại | Đặt tên cho subject |
| Tên lấy từ mechanism đang dùng | Khi mechanism thay đổi, mọi tên xung quanh đều sai | Đặt tên cho thứ được chọn hoặc tạo ra |
| Bare verb export (`generate`, `parse`, `run`) | Nó va vào bare verb của module khác, khiến path phải làm việc đặt tên | Verb cộng với object |
| `checkX` cho boolean | Nghe như đang thực hiện một phép kiểm tra thay vì trả lời | `isX` / `hasX` / `canX` |
| Tên bị caller đầu tiên giới hạn | Caller thứ hai khiến tên sai nhưng code vẫn tiếp tục hoạt động | Đặt tên cho capability |

## Ví dụ

### Path mang role

```
parsers/content.service.ts  ->  export class ContentParserService
path/content.service.ts     ->  export class ContentPathService
```

```
parsers/content-parser.service.ts  ->  export class ContentParserService
```

Chúng khác nhau ở việc “parser” được nói một lần hay hai lần.

### Bẫy version

```ts
/** True when the content carries the marker saying an editor has checked it. */
async hasVerifiedMarker(params: ContentLookupParams): Promise<boolean>
```

```ts
// Wrong: the name is about a schema generation, so it says nothing about WHAT is being asked --
// and it needs renaming the day a third shape exists.
async isV2(params: IsContentV2Params): Promise<boolean>
```

Chúng khác nhau ở việc tên có còn đúng trong schema tiếp theo hay không.

### Bẫy địa chỉ

```ts
/** Reads a doc out of the mounted content repo. */
export const readGitMountDoc = (relDir: string): GitMountDoc => { /* ... */ }
```

```ts
// Wrong: named for `.volume`, which was renamed to `.mount`, which was renamed to `.gitmounts`.
// The helper kept the first name through both, and nothing ever failed to say so.
export const readVolumeDoc = (relDir: string): VolumeDoc => { /* ... */ }
```

Chúng khác nhau ở việc tên nói về content hay về path.

### Bẫy bare verb

```ts
import { askModel } from "@tests/helpers/models"
```

```ts
// Wrong: generate what? The import list gives a reader nothing, so they read the path instead --
// and the path is the thing that moves.
import { generate } from "@tests/helpers/models"
```

Chúng khác nhau ở việc call site có nói rõ điều gì sẽ xảy ra hay không.
