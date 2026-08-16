---
id: be-lints-naming-example
title: example.md
slug: /be/lints/naming/example
sidebar_label: example.md
sidebar_position: 2
description: Mã bắn ra cảnh báo, mã không bắn, và mã đi lọt — cho từng quy tắc đặt tên.
---

# example.md

> Version: `2.00` · Mô-đun: `naming` · Cưỡng chế: [`INDEX.md`](./INDEX.md) · Diễn giải: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mỗi mục dưới đây là một quy tắc. Trong mỗi mục có nhiều cặp **SAI** (quy tắc bắn) và **ĐÚNG** (quy
tắc im), rồi tới **Cửa lách và nhầm lẫn** — phần mã **đi lọt qua quy tắc**.

Đọc phần cửa lách cho đúng: mã trong đó **vẫn sai luật**. Nó chỉ không bị máy nhìn thấy. Không đoạn
nào trong mục đó là mã được phép viết; chúng là danh sách những chỗ mà một cảnh báo xanh **không**
chứng minh được điều gì.

---

## `no-version-in-name`

### Cặp 1 — tên lớp

```ts
// SAI — báo `versioned`. Cái tên nói về một thế hệ lược đồ, nên nó không nói gì về việc lớp này
// LÀM gì, và nó phải đổi vào ngày thế hệ thứ ba ra đời.
export class ContentV2Parser {
  parse(raw: string): ParsedContent {
    return JSON.parse(raw) as ParsedContent
  }
}
```

```ts
// ĐÚNG — tên nói về thứ mà thế hệ đó đã mang vào: nội dung có dấu đã kiểm duyệt.
export class VerifiedContentParser {
  parse(raw: string): ParsedContent {
    return JSON.parse(raw) as ParsedContent
  }
}
```

Hai đoạn khác nhau đúng một chuyện: cái tên còn đúng sau thế hệ tiếp theo hay không.

### Cặp 2 — tên phương thức

```ts
// SAI — báo `versioned` tại khoá của phương thức. `MethodDefinition` được thăm, kể cả khi lớp
// bao ngoài có tên hoàn hảo.
export class ContentService {
  async isV2(params: ContentLookupParams): Promise<boolean> {
    return this.repository.hasMarker(params.id)
  }
}
```

```ts
// ĐÚNG — câu hỏi được đặt về một thuộc tính sống lâu, không về một số hiệu lược đồ.
export class ContentService {
  async hasVerifiedMarker(params: ContentLookupParams): Promise<boolean> {
    return this.repository.hasMarker(params.id)
  }
}
```

### Cặp 3 — tên interface

```ts
// SAI — báo `versioned`. Đây là tên của một hình dạng tham số, và người đọc vẫn phải đi tra xem
// "V2" là hình dạng đang chạy hay hình dạng đã chết.
export interface IsContentV2Params {
  readonly id: string
}
```

```ts
// ĐÚNG.
export interface ContentLookupParams {
  readonly id: string
}
```

### Cặp 4 — type alias

```ts
// SAI — báo `versioned`. Chữ V hoa đứng ngay đầu tên khớp nhánh `^` của biểu thức chính quy.
export type V2Body = {
  readonly marker: string
}
```

```ts
// ĐÚNG.
export type MarkedBody = {
  readonly marker: string
}
```

### Cặp 5 — tên hàm khai báo

```ts
// SAI — báo `versioned`. `FunctionDeclaration` có `id` nên được thăm.
export function parseV2Body(raw: string): MarkedBody {
  return JSON.parse(raw) as MarkedBody
}
```

```ts
// ĐÚNG.
export function parseMarkedBody(raw: string): MarkedBody {
  return JSON.parse(raw) as MarkedBody
}
```

### Cửa lách và nhầm lẫn

Mọi đoạn dưới đây **vi phạm `NAME-2`** và **không bị quy tắc báo**.

```ts
// ĐI LỌT — quy tắc không thăm khai báo biến nào cả. Đây là kiểu viết phổ biến nhất cho một hàm
// phụ trợ, và ở kiểu viết này quy tắc coi như không tồn tại.
export const parseV2Body = (raw: string): MarkedBody => JSON.parse(raw) as MarkedBody
```

```ts
// ĐI LỌT — chỉ tên interface được kiểm. Trường bên trong không được thăm, nên phiên bản sống yên
// trong một hình dạng có tên hoàn toàn đúng chuẩn — và trường thì được đọc ở mọi chỗ gọi.
export interface ContentParams {
  readonly id: string
  readonly isV2: boolean
}
```

```ts
// ĐI LỌT — thành viên trừu tượng là `TSAbstractMethodDefinition`, không phải `MethodDefinition`.
// Đúng chỗ mà một tên có phiên bản được khai báo cho người khác hiện thực thì lại không ai nhìn.
export abstract class AbstractContentParser {
  abstract parseV2Body(raw: string): MarkedBody
}
```

```ts
// ĐI LỌT — trước chữ `V` là chữ `I` viết hoa, nên nhánh một của biểu thức chính quy không khớp;
// nhánh hai thì đòi dấu gạch dưới. Một từ viết tắt đứng liền trước phiên bản là đủ để tắt quy tắc.
export class ContentAPIV2Parser {}
```

```ts
// ĐI LỌT — sau dãy số là chữ thường `b`, nên nhánh một hỏng. Đúng một phím Shift.
export function parseV2body(raw: string): MarkedBody {
  return JSON.parse(raw) as MarkedBody
}
```

```ts
// ĐI LỌT — quy tắc chỉ biết một cách đánh vần chữ "phiên bản": chữ V hoa cộng dãy số. Cả ba cái
// tên dưới đây đều đang đặt tên cho một khoảnh khắc, và không cái nào bị nhìn thấy.
export class ContentSchema2 {}
export type LegacyBody = MarkedBody
export function parseBodyRev2(raw: string): MarkedBody {
  return JSON.parse(raw) as MarkedBody
}
```

```ts
// ĐI LỌT — nhánh `_V[0-9]+` được viết cho tên kiểu hằng số viết hoa, mà không visitor nào chạm tới
// một hằng số. Nửa biểu thức đó gần như không bao giờ chạy được.
export const SCHEMA_V2 = "content.v2"
```

```ts
// ĐI LỌT — tên tệp không được đọc. Đặt tệp là `content-v2.service.ts` cũng không có gì bắn ra.
// `NAME-1` nói về tên tệp, và `NAME-1` không có quy tắc nào giữ.
export class ContentService {}
```

```ts
// CỬA MỞ NGƯỢC — đoạn này bị báo `versioned` dù cái tên có thể đúng: một hợp đồng thật sự công bố
// thế hệ thứ hai ra ngoài thì phiên bản là một phần danh tính của nó. Quy tắc không phân biệt được.
// Cách xử lý là một dòng tắt cảnh báo nêu tên hợp đồng, không phải đổi tên cho máy im.
export class ApiV2Controller {}
```

---

## `no-bare-verb-export`

### Cặp 1 — hàm khai báo được export

```ts
// SAI — báo `bareVerb`. generate CÁI GÌ? Ở danh sách import, cái tên này đụng với `generate` của
// mọi mô-đun khác, nên người đọc phải quay ra đọc đường dẫn — mà đường dẫn là thứ hay di chuyển.
export function generate(prompt: string): Promise<string> {
  return client.complete(prompt)
}
```

```ts
// ĐÚNG — động từ cộng tân ngữ. Chỗ gọi tự nói ra chuyện gì đang xảy ra.
export function askModel(prompt: string): Promise<string> {
  return client.complete(prompt)
}
```

Nhìn ở chỗ nhập:

```ts
// SAI — ba dòng import, không dòng nào tự nói mình làm gì.
import { generate } from "../models"
import { parse } from "../invoices"
import { process } from "../queue"
```

```ts
// ĐÚNG.
import { askModel } from "../models"
import { parseInvoiceRow } from "../invoices"
import { drainPendingJobs } from "../queue"
```

### Cặp 2 — hằng số hàm mũi tên

```ts
// SAI — báo `bareVerb`. `ArrowFunctionExpression` nằm trong danh sách hình dạng mà quy tắc chấp
// nhận, nên kiểu viết này KHÔNG rửa được cái tên.
export const parse = (row: string): InvoiceRow => splitRow(row)
```

```ts
// ĐÚNG.
export const parseInvoiceRow = (row: string): InvoiceRow => splitRow(row)
```

### Cặp 3 — `async`, `let`, nhiều declarator

```ts
// SAI — cả ba đều bị báo. `async` không đổi loại nút; `let` không đổi cách đọc; vòng lặp duyệt
// MỌI declarator chứ không chỉ cái đầu tiên.
export async function load(id: string): Promise<Order> {
  return repository.findOne(id)
}
export let send = (to: string) => mailer.deliver(to)
export const build = () => ({}), transform = (x: number) => x + 1
```

```ts
// ĐÚNG.
export async function loadOrder(id: string): Promise<Order> {
  return repository.findOne(id)
}
export let sendReceiptEmail = (to: string) => mailer.deliver(to)
export const buildOrderSummary = () => ({}), toMinorUnits = (x: number) => x + 1
```

### Cặp 4 — biểu thức hàm có tên

```ts
// SAI — `FunctionExpression` cũng nằm trong danh sách chấp nhận. Đặt tên cho biểu thức hàm không
// làm quy tắc bỏ qua khai báo.
export const check = function check(value: string): boolean {
  return value.length > 0
}
```

```ts
// ĐÚNG.
export const isNonEmptyMarker = function isNonEmptyMarker(value: string): boolean {
  return value.length > 0
}
```

### Cặp 5 — chú thích kiểu không giấu được tên

```ts
// SAI — declarator vẫn có `id` là `Identifier`; chú thích kiểu treo bên cạnh và không được đọc.
export const resolve: MarkerResolver = (id: string) => registry.get(id)
```

```ts
// ĐÚNG.
export const resolveMarkerOwner: MarkerResolver = (id: string) => registry.get(id)
```

### Cửa lách và nhầm lẫn

Mọi đoạn dưới đây **vi phạm `NAME-5`** và **không bị quy tắc báo**.

```ts
// ĐI LỌT — quy tắc đọc `node.declaration` và thoát khi nó vắng mặt. Kiểu "khai báo ở trên, export
// ở dưới" làm quy tắc biến mất hoàn toàn, và mọi tệp barrel đều viết như vậy.
function generate(prompt: string): Promise<string> {
  return client.complete(prompt)
}

export { generate }
```

```ts
// ĐI LỌT — chính cái bí danh TẠO RA động từ trơ, và nó được tạo ở đúng cái nút quy tắc từ chối đọc.
export { askModel as generate } from "./models"
```

```ts
// ĐI LỌT — `ExportAllDeclaration`. Tái xuất bản mọi cái tên trơ ở tầng dưới một cách trong suốt.
export * from "./models"
```

```ts
// ĐI LỌT — `ExportDefaultDeclaration` là loại nút khác, không quy tắc nào ở đây thăm nó.
export default function generate(prompt: string): Promise<string> {
  return client.complete(prompt)
}
```

```ts
// ĐI LỌT — `init` là `CallExpression`, không phải biểu thức hàm. Bọc một hàm bằng bộ nhớ đệm, bộ
// ghi log hay một factory là chuyện thường ngày, và nó gỡ quy tắc khỏi khai báo đó.
export const generate = memoize(askModelUncached)
```

```ts
// ĐI LỌT — quy tắc chỉ đọc tên của chính khai báo được export. Một phương thức tên trơ nằm ngoài
// tầm nhìn — và dòng cuối đưa người đọc về đúng cái va chạm mà luật đang mô tả.
export class ContentService {
  generate(prompt: string): Promise<string> {
    return this.client.complete(prompt)
  }
}

const { generate } = new ContentService()
```

```ts
// ĐI LỌT — thuộc tính của object literal không được đọc. Động từ trơ vẫn được công bố, chỉ lùi
// xuống một tầng gián tiếp.
export const contentApi = {
  generate: (prompt: string) => client.complete(prompt),
  parse: (raw: string) => JSON.parse(raw),
}
```

```ts
// ĐI LỌT — danh sách mười tám từ là viết tay và đóng. Không từ nào dưới đây có trong danh sách,
// và `execute` có lẽ là động từ trơ nhất trong cả tiếng Anh.
export const execute = (job: Job) => job.start()
export const emit = (event: DomainEvent) => bus.publish(event)
export const validate = (row: InvoiceRow) => schema.check(row)
export const render = (doc: Document) => doc.toHtml()
```

```ts
// ĐI LỌT — tra thành viên là so chuỗi chính xác, phân biệt hoa thường. Một chữ hoa, một dấu gạch
// dưới, hoặc một từ đệm vô nghĩa là thoát — trong khi cái tên không hề khá hơn.
export const Generate = (prompt: string) => client.complete(prompt)
export const generate_ = (prompt: string) => client.complete(prompt)
export const doGenerate = (prompt: string) => client.complete(prompt)
```

```ts
// ĐI LỌT — `TSDeclareFunction` không phải `FunctionDeclaration` cũng không phải `VariableDeclaration`,
// nên cả hai nhánh đều trả về.
export declare function generate(prompt: string): Promise<string>
```

```ts
// NHẦM LẪN HAY GẶP — `NAME-6` cấm đặt tên biến luận lý là `checkX`. Từ `check` CÓ trong danh sách
// động từ trơ, nên dòng đầu bị báo — nhưng bị báo dưới mã `NAME-5`, vì lý do khác hẳn. Dòng thứ
// hai, tức là đúng hình dạng mà `NAME-6` cấm, không bị gì cả.
export const check = (id: string) => registry.has(id)          // báo `bareVerb`
export const checkVerified = (id: string) => registry.has(id)  // không báo gì
```

---

## Ánh xạ yêu cầu sang quy tắc

| Yêu cầu bằng lời | Quy tắc trả lời | Mã luật | Kết quả |
|---|---|---|---|
| "Đừng để tên nào mang số hiệu lược đồ" | `no-version-in-name` | `NAME-2` | Giữ được, nhưng chỉ trên **tên khai báo** của năm loại nút |
| "Export ra ngoài thì phải có tân ngữ" | `no-bare-verb-export` | `NAME-5` | Giữ được, nhưng chỉ khi export **đi liền** với khai báo và tên nằm trong mười tám từ |
| "Tên tệp phải khớp vai trò của thứ nó export" | *không quy tắc nào* | `NAME-1` | Người review giữ; xem `audit.md` |
| "Đừng đặt tên theo thư mục nó đang nằm" | *không quy tắc nào* | `NAME-3` | Đòi biết thư mục từng đổi tên — máy không biết |
| "Đừng đặt tên theo cơ chế đang dùng" | *không quy tắc nào* | `NAME-4` | Đòi biết cơ chế nào rồi sẽ bị gỡ — máy không biết |
| "Biến luận lý phải là câu hỏi, không phải `checkX`" | *không quy tắc nào* | `NAME-6` | `check` trơ bị bắt tình cờ dưới `NAME-5`; `checkX` không bị gì |
| "Đừng gắn tên người gọi đầu tiên vào tên" | *không quy tắc nào* | `NAME-7` | Chỉ sai khi người gọi thứ hai xuất hiện — máy không thấy tương lai |
| "Cho tôi cổng chặn commit" | *không quy tắc nào* | — | Cả hai quy tắc ở mức `warn`; build vẫn xanh khi chúng bắn |

## Bảng phân định ranh giới

| Trông giống nhau | Thực ra khác ở đâu |
|---|---|
| `class ContentV2Parser` so với `class ContentAPIV2Parser` | Ký tự ngay trước chữ `V`. Chữ thường thì báo; chữ hoa thì im. Cùng một lỗi, một cái bị bắt một cái không. |
| `parseV2Body` so với `parseV2body` | Ký tự ngay sau dãy số. Chữ hoa thì báo; chữ thường thì im. |
| `class ContentParser { isV2() {} }` so với `class ContentParser { readonly isV2 = true }` | Phương thức là `MethodDefinition` và bị báo; trường là `PropertyDefinition` và không. |
| `export function generate()` so với `function generate(); export { generate }` | Có `node.declaration` hay không. Cùng một cái tên được công bố ra cùng một chỗ. |
| `export const generate = () => {}` so với `export const generate = memoize(fn)` | Loại nút của `init`. Biểu thức hàm thì báo; lời gọi hàm thì im. |
| `export const check = …` so với `export const checkVerified = …` | Tra thành viên chính xác. Cái thứ nhất bị bắt vì trùng một chuỗi trong danh sách, không phải vì nó là biến luận lý. |
| `no-version-in-name` so với `no-bare-verb-export` | Một cái xét **mọi khai báo** nhưng chỉ năm loại nút; một cái xét **mọi loại tên** nhưng chỉ tại một vị trí cú pháp. Hai hình chiếu vuông góc nhau, và chỗ giao nhau nhỏ hơn người ta tưởng. |

## Sai lầm lặp lại nhiều nhất

1. **Đọc "lint xanh" thành "tên đã đúng".** Cả hai quy tắc ở mức `warn`, và cả hai đều `return` sớm
   ở phần lớn hình dạng mã. Trong log build, một lần thoát sớm và một tệp sạch trông y hệt nhau.
2. **Tưởng quy tắc phiên bản đọc tệp.** Nó không đọc. `content-v2.service.ts` là chuyện của `NAME-1`,
   mà `NAME-1` không có quy tắc.
3. **Đổi `export function` thành `export const` rồi nghĩ là đã tránh được quy tắc.** Với
   `no-bare-verb-export` thì không: hằng số hàm mũi tên vẫn bị bắt. Với `no-version-in-name` thì có —
   và đó là khe hở, không phải giấy phép.
4. **Gom export xuống cuối tệp cho gọn.** Đây là thao tác dọn dẹp vô hại nhất có thể tưởng tượng, và
   nó tắt `no-bare-verb-export` cho toàn bộ tệp.
5. **Thêm một từ đệm để làm máy im.** `doGenerate`, `generate_`, `Generate` đều thoát khỏi danh sách
   mà không hề trả lời được câu hỏi "generate cái gì". Đó là đổi tên cho quy tắc, không phải cho
   người đọc.
6. **Đặt tên `parseSchema2` vì tin rằng chỉ chữ `V` mới bị cấm.** Luật cấm đặt tên theo một khoảnh
   khắc. Quy tắc chỉ biết một cách đánh vần khoảnh khắc đó.
