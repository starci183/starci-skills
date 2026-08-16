---
id: be-patterns-naming-example
title: example.md
slug: /be/patterns/naming/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi case và ngoại lệ của từng mã NAME-N, viết bằng TypeScript/NestJS thường.
---

# example.md

> Version: `2.00` · Module: `naming` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **TypeScript thường trong một ứng dụng hình dạng NestJS**. Không tên sản phẩm,
không tên repository, không tên khoá học. Một luật đặt tên chỉ đúng khi nó đúng ở bất kỳ back end
nào — nên nếu một ví dụ cần tên riêng của một sản phẩm mới đọc được, ví dụ đó đứng sai chỗ.

Mỗi mã có **nhiều case**, mỗi case đặt **ĐÚNG** và **SAI** cạnh nhau, rồi tới mục **ngoại lệ và nhầm
lẫn**. Hai bên của một case chỉ khác nhau **đúng một thứ**, và câu ngay dưới nói thứ đó là gì.

---

## `NAME-1` — path mang vai trò, file gọi tên chủ thể

### Case: hai folder, một tên file

```ts
// parsers/invoice.service.ts
@Injectable()
export class InvoiceParserService {}

// path/invoice.service.ts
@Injectable()
export class InvoicePathService {}
```

```ts
// SAI: parsers/invoice-parser.service.ts
// Chữ "parser" đã nằm trong path. Nói lần hai không thêm dữ kiện nào cho người đọc,
// chỉ thêm một chỗ nữa phải sửa khi thư mục đổi vai trò.
@Injectable()
export class InvoiceParserService {}
```

Hai bên khác nhau đúng một thứ: chữ "parser" được nói **một lần** hay **hai lần**.

### Case: thư mục operation

```ts
// mutations/billing/issue-invoice/issue-invoice.module.ts
@Module({})
export class IssueInvoiceSingleMutationModule extends ConfigurableModuleClass {}
```

```ts
// SAI: mutations/billing/issue-invoice/issue-invoice-single-mutation.module.ts
// Thư mục đã nói đây là một mutation đơn lẻ trong miền billing. Tên file chép lại
// vai trò đó, nên mọi lần dời operation sang miền khác là một lần sửa thừa.
@Module({})
export class IssueInvoiceSingleMutationModule extends ConfigurableModuleClass {}
```

### Case: hậu tố phải khớp vai trò của export

```ts
// queries/documents/document/document.handler.ts
@QueryHandler(DocumentQuery)
export class DocumentHandler implements IQueryHandler<DocumentQuery> {
    // ...
}
```

```ts
// SAI: queries/documents/document/document.service.ts
// Hậu tố hứa một `*Service`. Người đọc grep `*.handler.ts` để tìm mọi handler sẽ
// không thấy file này, và cái bị bỏ sót là một nhánh CQRS chứ không phải một helper.
@QueryHandler(DocumentQuery)
export class DocumentHandler implements IQueryHandler<DocumentQuery> {
    // ...
}
```

### Case: một integration, nhiều vai trò

```ts
// integrations/broker/producer.service.ts
@Injectable()
export class BrokerProducerService {}

// integrations/broker/consumer.service.ts
@Injectable()
export class BrokerConsumerService {}
```

```ts
// SAI: integrations/broker/broker-producer.service.ts
// Cùng một folder, cùng một class name, nhưng chữ "broker" bị nói hai lần.
// Chuyện này hay xảy ra khi file thứ hai được thêm vào sau, bởi người khác.
@Injectable()
export class BrokerProducerService {}
```

### Ngoại lệ và nhầm lẫn

- **File khai báo module của chính thư mục đó thì được trùng chữ.** Nó không còn tên nào khác:

  ```ts
  // integrations/broker/broker.module.ts
  @Module({})
  export class BrokerModule extends ConfigurableModuleClass {}
  ```

- **`NAME-1` không cấm path đóng góp vào tên — nó cấm nói hai lần.** Đây là chỗ hay bị đọc ngược
  thành "tên file phải đánh vần trọn tên class". Bản đầu của luật này đòi đúng như thế và đo được
  616 chỗ vi phạm trên 4430 file; ở tỉ lệ đó thì thứ sai là **luật**, không phải mã nguồn.

- **Một file export nhiều symbol thì lấy tên theo cái mà thư mục đang nói về:**

  ```ts
  // errors/cache/not-found.ts -- CacheNotFoundException cùng metadata type của nó
  export interface CacheNotFoundMetadata {
      key: string
  }

  export class CacheNotFoundException extends AbstractException<CacheNotFoundMetadata> {}
  ```

---

## `NAME-2` — tên nói vật, không nói đời schema

### Case: predicate trên một tài liệu

```ts
/** True khi tài liệu mang dấu đã được biên tập viên kiểm. */
async hasVerifiedMarker(params: DocumentLookupParams): Promise<boolean> {
    // ...
}
```

```ts
// SAI: tên nói về một đời schema, nên nó không nói gì về việc ĐANG HỎI cái gì --
// và nó phải đổi tên đúng ngày có shape thứ ba.
async isV2(params: IsDocumentV2Params): Promise<boolean> {
    // ...
}
```

Hai bên khác nhau đúng một thứ: cái tên có sống qua đời schema kế tiếp hay không.

### Case: biến cục bộ trong một step

```ts
const isTaskVerified = Boolean(task.verified)
```

```ts
// SAI: biểu thức ngay bên phải đã nói ra tính chất -- `verified`. Cái tên bỏ tính
// chất đó đi để lấy một con số đời, nên nó nói ít hơn chính dòng nó đứng.
const isV2Task = Boolean(task.verified)
```

Đây cũng là dạng mà lint **không** bắt: rule chỉ thăm declaration của function, class,
interface, type alias và method, không thăm biến.

### Case: input của một prompt

```ts
interface ProjectEvaluationRubricPromptInput extends ProjectEvaluationPromptBaseInput {
    rubricCriteria: Array<RubricCriterion>
}
```

```ts
// SAI: "V2" không nói được nó khác bản trước ở chỗ nào. Thứ thật sự khác là bản này
// nhận rubric, và đó mới là cái người đọc cần biết ở call site.
interface ProjectEvaluationV2PromptInput extends ProjectEvaluationPromptBaseInput {
    rubricCriteria: Array<RubricCriterion>
}
```

### Case: hai parser sống song song

```ts
export const parseFlatDocument = (raw: string): ParsedDocument => { /* ... */ }
export const parseSectionedDocument = (raw: string): ParsedDocument => { /* ... */ }
```

```ts
// SAI: hai cái tên chỉ khác nhau một con số, nên call site không nói được vì sao
// nó chọn cái này. Ngày bản cũ chết, `parseV2Body` mô tả một nhánh không còn tồn tại.
export const parseV1Body = (raw: string): ParsedDocument => { /* ... */ }
export const parseV2Body = (raw: string): ParsedDocument => { /* ... */ }
```

### Ngoại lệ và nhầm lẫn

- **Phiên bản là dữ liệu thì được mang số:**

  ```ts
  @Column({ name: "schema_version", type: "int" })
  schemaVersion: number
  ```

- **Đường dẫn public là hợp đồng, không phải tên nội bộ:**

  ```ts
  @Controller("v1/invoices")
  export class InvoiceController {}
  ```

- **Class migration mang số thứ tự là danh tính của nó**, không phải một nhánh được đặt tên theo đời
  schema.

---

## `NAME-3` — tên nói vật, không nói địa chỉ

### Case: helper đọc tài liệu từ một mount

```ts
/** Đọc một tài liệu nội dung thật từ mount SSOT và parse các trường của nó. */
export const readMountedDoc = (relDir: string, locale: Locale = "en"): MountedDoc => {
    // ...
}
```

```ts
// SAI: đặt theo `.volume`, thư mục sau đó đổi thành `.mount`, rồi đổi tiếp lần nữa.
// Helper giữ nguyên cái tên đầu qua CẢ HAI lần rename, và không có gì đỏ lên để nói.
export const readVolumeDoc = (relDir: string): VolumeDoc => {
    // ...
}
```

Hai bên khác nhau đúng một thứ: cái tên nói về **nội dung** hay về một **đường dẫn**.

### Case: hằng số path — chỗ duy nhất địa chỉ được phép xuất hiện

```ts
/** Gốc của mount nội dung SSOT mọi suite đều neo case thật vào. */
const MOUNT_DATA_ROOT = join(process.cwd(), ".gitmounts", "data")
```

Địa chỉ nằm trong **giá trị**, không nằm trong **tên**. Đó là toàn bộ mã này: đường dẫn là dữ liệu
có thể đổi; tên là hợp đồng với người đọc.

### Case: adapter object storage

```ts
@Injectable()
export class AttachmentStorageService {
    async readAttachment(key: string): Promise<Buffer> { /* ... */ }
}
```

```ts
// SAI: bucket hôm nay tên `uploads-prod`. Đổi bucket là cái tên sai ngay, và nó vẫn
// biên dịch, vẫn chạy, vẫn đọc lên rất hợp lý với người mới.
@Injectable()
export class UploadsProdService {
    async readUploadsProd(key: string): Promise<Buffer> { /* ... */ }
}
```

### Case: điều tệ nhất mã này gây ra — hỏng mà vẫn xanh

```ts
// SAI: gate kiểu này biến "thiếu nguyên liệu" thành "test đã pass".
const describeIfMounted = existsSync(MOUNT_DATA_ROOT) ? describe : describe.skip
```

```ts
// ĐÚNG: thiếu mount là một thất bại, không phải một lần bỏ qua.
beforeAll(() => {
    if (!existsSync(MOUNT_DATA_ROOT)) {
        throw new Error(`Mount root is missing: ${MOUNT_DATA_ROOT}`)
    }
})
```

Vì sao đoạn này nằm trong luật đặt tên: hằng số path là thứ **có thể sai mà không có gì đỏ lên**, và
một cái tên đặt theo path thừa hưởng đúng tính chất đó.

### Ngoại lệ và nhầm lẫn

- **Path phân loại thì được góp vào tên.** `parsers/`, `path/`, `handlers/` là **vai trò** — đó là
  `NAME-1`. `.volume/`, `.mount/`, `uploads-prod` là **địa chỉ** — đó là `NAME-3`.
- **Một service mà chủ thể của nó chính là chỗ lưu trữ** (ví dụ một client cho một hệ thống file từ
  xa) thì được mang tên hệ thống đó. Ranh giới là: nó **là** cái đó, hay nó chỉ **đang nằm ở** đó.

---

## `NAME-4` — tên nói vật, không nói cơ chế

### Case: bảng chọn model

```ts
export const computeModelWeight = (params: ComputeModelWeightParams): number => { /* ... */ }
export const estimateUsdPerCall = (params: EstimateUsdPerCallParams): number => { /* ... */ }
```

```ts
// SAI: cả hai cái tên đều nói về CƠ CHẾ định tuyến đang dùng để chọn. Ngày cơ chế đó
// bị thay, không cái tên nào còn đúng -- vì chưa cái nào từng nói ra chữ "model".
export const HARNESS_TIER: Record<string, string> = { /* ... */ }
let currentTier = "standard"
```

Hai bên khác nhau đúng một thứ: cái tên nói **vật được chọn** hay **cách chọn**.

### Case: chi phí một lần gọi

```ts
export const creditForTypicalCall = (params: CreditForTypicalCallParams): number => { /* ... */ }
```

```ts
// SAI: "ladder" là sắp xếp nội bộ của thuật toán hôm nay. Người gọi cần biết họ nhận
// về SỐ CREDIT, không cần biết nó được tra bằng thang hay bằng bảng.
export const ladderLookup = (params: LadderLookupParams): number => { /* ... */ }
```

### Case: cache đứng trước một phép tính

```ts
@Injectable()
export class ModelLatencyService {
    async readLatency(modelId: string): Promise<number> { /* ... */ }
}
```

```ts
// SAI: cache là cách hôm nay lấy được số đo. Bỏ cache đi thì mọi call site đọc sai,
// và mỗi call site là một chỗ phải sửa.
@Injectable()
export class ModelLatencyRedisService {
    async readFromRedis(modelId: string): Promise<number> { /* ... */ }
}
```

### Ngoại lệ và nhầm lẫn

- **Cơ chế chính là chủ thể thì được mang tên cơ chế:**

  ```ts
  // integrations/broker/broker.service.ts -- việc của nó ĐÚNG LÀ nói chuyện với broker
  @Injectable()
  export class BrokerService implements OnModuleDestroy {}
  ```

- **Một service cache mà công việc của nó là cache thì tên là cache.** Cái bị từ chối là đặt tên một
  **capability nghiệp vụ** theo hạ tầng nó đang cưỡi.

- **`NAME-4` hỏng theo cụm, khác `NAME-2` và `NAME-3`.** Hai mã kia hỏng từng cái một; mã này hỏng
  cả vùng cùng lúc, vì mọi tên quanh cơ chế đều mượn từ vựng của cơ chế.

---

## `NAME-5` — hàm export là động từ kèm tân ngữ

### Case: đọc ở import list

```ts
import { askModel } from "@tests/helpers/models"
```

```ts
// SAI: generate CÁI GÌ? Import list không nói được, nên người đọc quay sang đọc path --
// và path là thứ hay dời nhất trong file.
import { generate } from "@tests/helpers/models"
```

Hai bên khác nhau đúng một thứ: call site có tự nói ra chuyện gì đang xảy ra hay không.

### Case: hai module cùng export một động từ trần

```ts
import { parseInvoiceDocument } from "@modules/billing/utils/parse-invoice-document"
import { parseAttachmentDocument } from "@modules/documents/utils/parse-attachment-document"
```

```ts
// SAI: hai `parse` va nhau, nên file phải đặt alias -- và alias là tên thật của hàm
// được đặt lại ở nơi gọi, mỗi nơi một kiểu.
import { parse as parseInvoice } from "@modules/billing/utils/parse"
import { parse as parseAttachment } from "@modules/documents/utils/parse"
```

### Case: động từ có tân ngữ vẫn hợp lệ dù động từ nằm trong danh sách cấm

```ts
export const resolveGradingChain = (params: ResolveGradingChainParams): Array<ModelCategory> => {
    // ...
}
```

```ts
// SAI: cùng động từ, mất tân ngữ.
export const resolve = (params: ResolveGradingChainParams): Array<ModelCategory> => {
    // ...
}
```

Luật cấm **động từ trần**, không cấm động từ.

### Case: helper private thì được, export ra thì không

```ts
const parse = (raw: string): ParsedRow => { /* ... */ }

export const parseLedgerRows = (raw: string): Array<ParsedRow> => raw.split("\n").map(parse)
```

```ts
// SAI: đúng một từ khoá `export` biến một tên đọc-cạnh-thân-hàm thành một tên
// đọc-ở-import-list, và cái tên không đi theo.
export const parse = (raw: string): ParsedRow => { /* ... */ }
```

### Ngoại lệ và nhầm lẫn

- **Lint chỉ giữ một danh sách đóng.** Rule bắt mười tám động từ. Một động từ trần ngoài danh sách
  vẫn lọt:

  ```ts
  // Lint im lặng. Luật thì không.
  export const judge = async (params: JudgeParams): Promise<Verdict> => { /* ... */ }
  ```

- **Hàm trả boolean không lấy động từ + tân ngữ** mà lấy câu hỏi — xem `NAME-6`.

- **Method của class đọc kèm tên class**, nên `InvoiceService.issue()` không phải động từ trần theo
  nghĩa của mã này; tân ngữ do class cung cấp.

---

## `NAME-6` — boolean là một câu hỏi về tính chất bền

### Case: cờ bật/tắt của một scope

```ts
@Injectable()
export class SeedScopeService {
    isSeedersEnabled(): boolean { /* ... */ }
    isCatalogSeederEnabled(): boolean { /* ... */ }
}
```

```ts
// SAI: nghe như đi BẬT seeder, không phải trả lời seeder có bật hay không.
@Injectable()
export class SeedScopeService {
    checkSeeders(): boolean { /* ... */ }
    seedersFlag(): boolean { /* ... */ }
}
```

### Case: quyền của một người dùng trên một tài nguyên

```ts
async isEnrolled(userId: string, courseId: string): Promise<boolean> { /* ... */ }
```

```ts
// SAI: `check` đọc như một mệnh lệnh, nên call site `if (await checkEnrollment(...))`
// đọc thành "nếu đi kiểm tra ghi danh" thay vì "nếu đã ghi danh".
async checkEnrollment(userId: string, courseId: string): Promise<boolean> { /* ... */ }
```

### Case: có nội dung trong một snapshot chưa

```ts
private hasContent(snapshotRoot: string): boolean { /* ... */ }
```

```ts
// SAI: `contentFlag` không nói được nó cờ CÁI GÌ về nội dung -- có, rỗng, hợp lệ, đã đọc?
private contentFlag(snapshotRoot: string): boolean { /* ... */ }
```

### Case: câu hỏi đúng dạng nhưng hỏi về thứ tạm bợ

```ts
// ĐÚNG: hỏi về một tính chất của bản ghi.
const isRefundable = invoice.paidAt !== null && invoice.refundedAt === null
```

```ts
// SAI: "batch hiện tại" là chuyện của một lần chạy. Câu hỏi chết cùng lần chạy đó,
// và cái tên sống lâu hơn nó.
const isCurrentlyInBatch = batch.ids.includes(invoice.id)
```

### Ngoại lệ và nhầm lẫn

- **`check*` không trả về boolean thì không phải vi phạm.** Nó làm việc thật và trả kết quả thật:

  ```ts
  /** Trả về những hạng đã đạt được, không phải một câu trả lời có/không. */
  checkEligible(value: number, definition: BadgeDefinition): Array<BadgeTier> { /* ... */ }
  ```

- **Boolean hỏi về một đời schema là `NAME-2`, không phải mã này.** Dạng câu đúng, chủ đề sai:

  ```ts
  // SAI theo NAME-2
  async isV2(params: DocumentLookupParams): Promise<boolean> { /* ... */ }
  ```

- **`can*` là quyền, `has*` là sở hữu, `is*` là trạng thái.** Chọn sai tiền tố trong ba cái này không
  phải vi phạm mã này, nhưng đọc lên sẽ lệch: `hasPublishPermission` và `canPublish` không phải một
  câu hỏi.

---

## `NAME-7` — tên nói capability, không nói người gọi đầu tiên

### Case: service tổng hợp nội dung

```ts
@Injectable()
export class ContentSummaryService {
    async summarise(params: ContentSummaryParams): Promise<ContentSummary> { /* ... */ }
}
```

```ts
// SAI: chết đúng ngày bề mặt thứ hai cần nó -- và chết lặng lẽ. Nó vẫn chạy, vẫn
// trả đúng dữ liệu, và vẫn nói một điều sai với mọi người đọc sau đó.
@Injectable()
export class DashboardContentService {
    async summarise(params: ContentSummaryParams): Promise<ContentSummary> { /* ... */ }
}
```

Hai bên khác nhau đúng một thứ: cái tên nói **năng lực** hay nói **ai đặt hàng trước**.

### Case: helper định dạng ban đầu chỉ có một email dùng

```ts
export const formatCurrencyAmount = (amount: number, currency: string): string => { /* ... */ }
```

```ts
// SAI: hoá đơn qua email là nơi gọi đầu tiên, không phải việc mà hàm này làm.
export const formatInvoiceEmailAmount = (amount: number, currency: string): string => { /* ... */ }
```

### Case: thư mục operation theo bề mặt thì hợp lệ

```ts
// queries/dashboard/active-advertisement/active-advertisement.resolver.ts
@Resolver()
export class ActiveAdvertisementResolver {
    constructor(private readonly userService: UserService) {}
}
```

Thư mục nói bề mặt vì **operation này thuộc bề mặt đó** — đó là `NAME-1`. Thứ nó gọi vào lại là một
service đặt tên theo **năng lực**. Đúng sự bất đối xứng này là mã `NAME-7` được vẽ ra.

### Ngoại lệ và nhầm lẫn

- **Bề mặt là khái niệm nghiệp vụ thì được mang tên bề mặt.** Một read model dựng riêng cho một màn
  hình, có vòng đời và projection riêng, thì tên màn hình chính là chủ thể của nó:

  ```ts
  @Entity({ name: "dashboard_summary_projection" })
  export class DashboardSummaryProjection {}
  ```

- **`NAME-7` là mã khó thấy nhất.** Sáu mã kia sai vì một thứ **bị đổi**; mã này sai vì một thứ
  **được thêm vào**, và thêm vào thì không ai đi đọc lại tên cũ.

- **Đừng chữa bằng cách bỏ hết định ngữ.** `ContentService` chung chung tới mức vô nghĩa cũng không
  phải câu trả lời; câu trả lời là **năng lực**: `ContentSummaryService`.

---

## Ánh xạ yêu cầu sang một cái tên

Nêu chủ thể, vai trò, path và người gọi. Nếu thiếu **một** dữ kiện quyết định, hỏi **một** câu cụ thể
rồi dừng. Câu trả lời phải là một cái tên hoặc một câu hỏi — không bao giờ cả hai.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| Thêm service parse hoá đơn vào thư mục `parsers/` | Path đã nói vai trò | `NAME-1` | `parsers/invoice.service.ts` → `InvoiceParserService` |
| Thêm handler cho query tài liệu | Hậu tố phải khớp vai trò export | `NAME-1` | `document.handler.ts` → `DocumentHandler` |
| Cần cờ phân biệt tài liệu shape mới | Gọi tên tính chất, không gọi tên đời | `NAME-2` | `hasVerifiedMarker` |
| Helper đọc file trong thư mục mount | Gọi tên nội dung, không gọi tên đường dẫn | `NAME-3` | `readMountedDoc` |
| Hàm tính điểm chọn model | Gọi tên vật được tính, không gọi tên cách chọn | `NAME-4` | `computeModelWeight` |
| Export hàm dựng chuỗi fallback chấm điểm | Động từ phải có tân ngữ | `NAME-5` | `resolveGradingChain` |
| Hàm trả lời "người này ghi danh chưa" | Boolean là câu hỏi | `NAME-6` | `isEnrolled` |
| Service tổng hợp cho trang tổng quan, hiện chỉ trang đó dùng | Gọi tên năng lực, không gọi tên bề mặt | `NAME-7` | `ContentSummaryService` |
| Class client nói chuyện với message broker | Cơ chế chính là chủ thể | ngoại lệ `NAME-4` | `BrokerService` |

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `NAME-1` / `NAME-3` | Đoạn path này phân **loại** symbol, hay chỉ nói nó **đang nằm ở đâu**? |
| `NAME-1` / `NAME-7` | Thư mục theo bề mặt này là phạm vi của một **operation**, hay là định ngữ dán lên một **capability dùng chung**? |
| `NAME-2` / `NAME-6` | Cái tên hỏng ở **dạng câu** (thiếu `is/has/can`) hay ở **chủ đề** (hỏi về một đời schema)? |
| `NAME-3` / `NAME-4` | Từ mượn vào tên là **chỗ vật nằm**, hay **cách vật được sinh ra**? |
| `NAME-4` / ngoại lệ | Module này **là** cơ chế đó, hay chỉ đang **chạy trên** nó? |
| `NAME-5` / `NAME-6` | Hàm trả về `boolean`, hay trả về một kết quả? |
| `NAME-5` / phạm vi | Symbol này có được **export** ra khỏi file không? |
| `NAME-7` / ngoại lệ | Chữ trông giống tên người gọi có phải là **khái niệm nghiệp vụ** của chính vật này không? |

## Sai lầm lặp lại nhiều nhất

1. Nói lại trong tên file cái mà thư mục đã nói (`parsers/invoice-parser.service.ts`).
2. Đặt hậu tố không khớp vai trò export, khiến một grep theo vai trò bỏ sót cả một nhánh.
3. Lấy số đời schema làm tên trong khi biểu thức ngay bên cạnh đã nói ra tính chất.
4. Đặt tên theo thư mục lưu trữ, rồi đổi tên thư mục và không có gì đỏ lên.
5. Đặt tên theo cơ chế, rồi thay cơ chế và sai cả cụm cùng một lúc.
6. Export một động từ trần, để path phải đi làm việc của tên.
7. Dùng `checkX` cho một hàm trả về `boolean`.
8. Dán tên bề mặt đầu tiên lên một capability dùng chung, rồi để nó tiếp tục chạy đúng và nói sai.
9. Tin rằng lint đã giữ hết: rule phiên bản không thăm biến, rule động từ chỉ giữ mười tám từ.
