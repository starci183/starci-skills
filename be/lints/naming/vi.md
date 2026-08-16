---
id: be-lints-naming-vi
title: vi.md
slug: /be/lints/naming/vi
sidebar_label: vi.md
sidebar_position: 1
description: Hai quy tắc giữ luật đặt tên — bắt gì, nhìn bằng gì, và cửa nào còn mở.
---

# vi.md

> Version: `2.00` · Mô-đun: `naming`

# Hai quy tắc giữ luật đặt tên

Luật nói: **một cái tên trả lời câu hỏi "đây là cái gì" cho người chưa mở tệp ra đọc.** Tài liệu này
không nhắc lại luật. Nó ghi lại **phần cưỡng chế**: máy nhìn thấy gì trong một tệp, nhìn bằng cơ chế
nào, và — phần thường không ai viết ra — cách viết nào đi lọt qua máy mà không bị chạm tới.

Tên quy tắc chính là **danh tính** của nó. Không đặt mã số riêng cho quy tắc, vì tên đó mới là chuỗi
in ra trong log build, trong dòng tắt cảnh báo và trong mọi cuộc trao đổi về lỗi.

Luật có bảy điều. Chỉ **hai** điều có quy tắc giữ, và con số nhỏ đó là con số trung thực. Nguồn nói
thẳng lý do: năm điều còn lại đòi biết **thứ đó thực sự là gì** — một cái tên lấy theo thư mục, theo
cơ chế, hay theo người gọi đầu tiên chỉ sai khi ta biết thư mục từng đổi tên, cơ chế từng bị gỡ, người
gọi thứ hai đã xuất hiện. Không bộ phân tích cú pháp nào biết những chuyện đó. Viết thêm quy tắc để
bảng trông đầy đặn là làm hỏng cả bảng.

Cả hai quy tắc đều được nguồn công bố ở mức `warn`, **không phải** `error`, và đó là quyết định có lý
do: luật đặt tên rơi xuống một cây mã đã trưởng thành và có nợ thật. Một quy tắc đặt tên bật `error`
ngay ngày đầu sẽ chặn mọi commit chạm vào tệp cũ, và điều đó dạy người ta cách tắt quy tắc.

## Bảng tra nhanh

| Quy tắc | Mã luật | Bắt gì |
|---|---|---|
| `no-version-in-name` | `NAME-2` | Hàm, lớp, interface, type alias hoặc phương thức **khai báo** có tên chứa một thế hệ lược đồ (`isV2`, `ContentV2Parser`) |
| `no-bare-verb-export` | `NAME-5` | Một export có tên đúng bằng một trong **mười tám** động từ trơ trong danh sách (`generate`, `parse`, `run`…) |

`NAME-1`, `NAME-3`, `NAME-4`, `NAME-6` và `NAME-7` **không có quy tắc nào giữ**. `NAME-1` từng có
quy tắc, đã đo, và đã bị xoá — phần đó nằm trong `audit.md`, vì việc xoá mới là phần đáng đọc.

---

## `no-version-in-name`

**Bắt gì.** Một thông điệp duy nhất, `versioned`. Nó bắt cái tên nướng sẵn một thế hệ lược đồ vào
trong: `isV2`, `IsContentV2Params`, `parseV2Body`, `class V2ContentParser`. Cái tên loại này phải đổi
đúng vào ngày thế hệ sau ra đời — nhưng đổi tên mới là phần dễ. Phần khó là từ giờ tới lúc đó, không
ai nhìn tên mà biết được "V2" đang có nghĩa là **hình dạng hiện tại** hay **một hình dạng cũ**, nên
mọi người đọc đều phải đi tra. Chi phí đó trả bằng thời gian của người đọc, mỗi lần, mãi mãi.

**Giữ mã nào.** `NAME-2`.

**Cách phát hiện.** Thăm **đúng năm** loại nút: `FunctionDeclaration`, `ClassDeclaration`,
`TSInterfaceDeclaration`, `TSTypeAliasDeclaration` — cả bốn đều đòi có `node.id` — và
`MethodDefinition` với điều kiện `node.key.type === "Identifier"`. Lấy chuỗi tên đem so với **một**
biểu thức chính quy: `/(?:^|[a-z])V[0-9]+(?:$|[A-Z_])|_V[0-9]+/`. Báo tại chính nút định danh.

Biểu thức đó có hai nhánh, và phần lớn khe hở nằm bên trong nó. Nhánh một đòi chữ `V` **hoa** đứng ở
đầu tên hoặc ngay sau một chữ cái **thường**, rồi sau dãy số phải là hết tên, một chữ **hoa**, hoặc
một dấu gạch dưới. Nhánh hai đòi một dấu gạch dưới ngay trước chữ `V` hoa.

**Vì sao luật này đáng có máy giữ.** Vì đây là loại sai không ai nhìn thấy trong review. `isV2` đọc
lên hoàn toàn hợp lý vào ngày nó được viết — lúc đó đúng là chỉ có V1 và V2, và cái tên nói đủ. Nó
chỉ trở thành lời nói dối về sau, một cách lặng lẽ, khi V1 chết và cái tên còn ở lại mô tả một ngã rẽ
không còn tồn tại. Không có commit nào để chỉ vào, không có kiểm thử nào đỏ. Một cảnh báo ngay lúc gõ
là chỗ duy nhất bắt được nó.

**Cửa còn mở.**

- `export const parseV2Body = (body) => {}` — **quy tắc không thăm bất kỳ khai báo biến nào.** Phiên
  bản nướng vào một hằng số hàm mũi tên, tức là kiểu viết phổ biến nhất cho một hàm phụ trợ, là vô
  hình. Quy tắc anh em nằm cùng tệp có đi bộ qua danh sách declarator để làm đúng việc đó, nên không
  thể nói tác giả không biết hình dạng này tồn tại.
- `interface ContentParams { isV2: boolean }` — chỉ tên của interface được kiểm. `TSPropertySignature`
  không được thăm, nên phiên bản sống yên trong một **trường**, nằm bên trong một cái tên đúng chuẩn.
  Mà trường thì được đọc ở mọi chỗ gọi.
- `class ContentParser { readonly isV2 = true }` — trường của lớp là `PropertyDefinition`, không phải
  `MethodDefinition`. Cùng một cái tên, viết thành phương thức thì bị báo, viết thành trường thì không.
- `abstract parseV2Body(): void` — thành viên trừu tượng là `TSAbstractMethodDefinition`, một loại nút
  khác. Đúng chỗ mà một tên phương thức có phiên bản hay được **khai báo cho người khác hiện thực**
  thì lại không được thăm.
- `const api = { parseV2Body() {} }` — phương thức trong object literal là `Property`. Đọc lên giống
  hệt, nhìn bằng máy thì khác hẳn.
- `enum Shape { V2 = "v2" }` — không thăm `TSEnumDeclaration` lẫn `TSEnumMember`.
- `class ContentAPIV2Parser` — nhánh một đòi ký tự **ngay trước** `V` là chữ thường hoặc đầu tên. Một
  **từ viết tắt đứng liền trước phiên bản** (`API`, `HTTP`, `AI`, `URL`) vô hiệu hoá nhánh một, còn
  nhánh hai thì đòi dấu gạch dưới. Không có gì bắn ra.
- `function parseV2body()` — sau dãy số phải là hết tên, chữ hoa, hoặc gạch dưới. Một **chữ thường**
  đứng sau dãy số là đủ để thoát. Đúng một phím Shift.
- `const SCHEMA_V2 = …` — nhánh `_V[0-9]+` được viết cho tên kiểu hằng số viết hoa, mà **không visitor
  nào chạm tới một hằng số cả**. Nửa biểu thức đó gần như không bao giờ chạy được.
- `function parse_v2()`, `const isv2 = …` — cả hai nhánh đều đòi `V` hoa. Cùng một phiên bản, viết
  thường thì không bị báo.
- `class ContentSchema2`, `type LegacyBody`, `function parseBodyRev2` — quy tắc chỉ biết **một** cách
  đánh vần chữ "phiên bản": chữ `V` cộng dãy số. `Schema2`, `Rev2`, `Gen2`, `Legacy`, `Old`, `Next`
  đều đang đặt tên cho một khoảnh khắc, và không cái nào bị nhìn thấy.
- Tên tệp: `content-v2.service.ts` hoàn toàn vô hình. Quy tắc không đọc `context.filename`.

- **Cửa mở ngược.** `class ApiV2Controller` cho một hợp đồng **thật sự công bố ra ngoài** vẫn bị báo.
  Quy tắc không phân biệt được một thế hệ lược đồ nội bộ với một phiên bản mà bên ngoài đang gọi tên.
  Chỗ này xử lý bằng dòng tắt cảnh báo có nêu tên hợp đồng, không phải bằng cách đổi tên cho máy im.

---

## `no-bare-verb-export`

**Bắt gì.** Một thông điệp duy nhất, `bareVerb`. Nó bắt một export tên đúng bằng một động từ trơ:
`generate` — generate **cái gì**? Ở một danh sách import, `generate` đụng với `generate` của mọi
mô-đun khác, nên người đọc phải quay ra đọc **đường dẫn** để phân biệt — mà đường dẫn chính là thứ hay
di chuyển. Đó là đường dẫn đang làm công việc của cái tên, và luật đã nêu ở chỗ khác vì sao chuyện đó
hỏng.

Danh sách gồm mười tám từ: `generate`, `parse`, `run`, `handle`, `process`, `build`, `create`, `load`,
`resolve`, `check`, `convert`, `transform`, `send`, `fetch`, `get`, `set`, `update`, `apply`.

**Giữ mã nào.** `NAME-5`.

**Cách phát hiện.** Chỉ thăm `ExportNamedDeclaration`. Thoát ngay khi `node.declaration` không tồn
tại. Nếu `declaration` là `FunctionDeclaration` có `id` thì kiểm luôn tên đó rồi dừng. Nếu là
`VariableDeclaration` thì duyệt từng declarator, đòi `init.type` là `ArrowFunctionExpression` hoặc
`FunctionExpression` và `id.type` là `Identifier`, rồi kiểm tên. Kiểm ở đây là **tra thành viên trong
một `Set`**, đúng chuỗi, phân biệt hoa thường. **Không có cổng chặn theo tên tệp nào.**

**Vì sao luật này đáng có máy giữ.** Vì cái giá không rơi vào người viết. Người đặt tên `generate`
trong tệp của mình không mất gì cả — trong ngữ cảnh đó nó rõ ràng. Người mất là người sáu tháng sau mở
một tệp có mười hai dòng import và thấy ba cái `generate`, `parse`, `process` không dòng nào tự nói
mình làm gì. Đây cũng là loại quyết định không ai đưa ra review được: không ai đọc diff mà đếm được
"trong repo này có bao nhiêu export tên trơ". Một quy tắc thì đếm được, ở mọi commit, miễn phí.

**Cửa còn mở.**

- `function generate() {}` ở cuối tệp rồi `export { generate }` — **quy tắc đọc `node.declaration` và
  thoát khi nó vắng mặt.** Danh sách specifier, tức là kiểu "khai báo ở trên, export ở dưới", và mọi
  tệp barrel, đều làm quy tắc biến mất hoàn toàn.
- `export { askModel as generate } from "./models"` — chính cái bí danh **tạo ra** động từ trơ, và nó
  được tạo ra ở đúng cái nút mà quy tắc từ chối đọc.
- `export * from "./content"` — `ExportAllDeclaration`, tái xuất bản `generate` một cách trong suốt.
- `export default function generate() {}` — `ExportDefaultDeclaration` là loại nút khác, không ai thăm.
- `export const generate = memoize(buildContent)` — `init` là `CallExpression`, không phải biểu thức
  hàm. Bọc một hàm bằng bộ nhớ đệm, bộ ghi log, một factory hay một decorator là chuyện thường ngày,
  và nó gỡ quy tắc khỏi khai báo đó.
- `export class ContentService { generate() {} }` — quy tắc chỉ đọc tên của chính khai báo được export.
  Một **phương thức** tên trơ không nằm trong tầm; và `const { generate } = service` đưa người đọc về
  đúng cái va chạm mà luật đang mô tả.
- `export const contentApi = { generate: () => {} }` — thuộc tính của object không được đọc.
- `export const execute = () => {}` — danh sách mười tám từ là **viết tay và đóng**. `execute`, `emit`,
  `read`, `write`, `sync`, `init`, `start`, `render`, `validate`, `find`, `save`, `list`, `format`,
  `merge`, `serialize` đều là động từ trơ và đều hợp lệ. `execute` có lẽ là từ trơ nhất trong cả tiếng
  Anh và nó không có trong danh sách.
- `export const Generate = …`, `export const generate_ = …`, `export const doGenerate = …` — tra thành
  viên là so chuỗi chính xác. Một chữ hoa, một dấu gạch dưới, hoặc một từ đệm là thoát.
- `export declare function generate(): void` — `TSDeclareFunction` không phải `FunctionDeclaration`
  cũng không phải `VariableDeclaration`, nhánh nào cũng trả về.

- **Cửa mở ngược.** Quy tắc không nhìn tệp, nên một hàm phụ trợ export ra từ cây kiểm thử cũng bị xét
  y như mã sản xuất. Đây là **chủ ý**, không phải sót: ví dụ mẫu của chính luật là một dòng import từ
  mô-đun trợ giúp kiểm thử.

---

## Luật

1. Danh tính của một quy tắc là **tên đã công bố** của nó. Không đặt mã số cho quy tắc; một quy tắc
   hai tên là một quy tắc không thể truy nguyên.
2. Chỉ ghi lại quy tắc **có thật trong nguồn**. Một quy tắc đáng có mà chưa có thì thuộc về
   `audit.md`, không thuộc về bảng tra nhanh.
3. Mỗi quy tắc giữ đúng một mã luật; không mã nào bị hai quy tắc cùng giữ.
4. Quy tắc chỉ xét **tên khai báo**, không xét giá trị, không xét chuỗi ký tự, không xét đường dẫn tệp.
5. Mọi cửa còn mở là khe hở của **quy tắc**, không bao giờ là quyền được viết như vậy của **luật**.
   Mã đi lọt vẫn là mã sai.
6. Cả hai quy tắc ở mức `warn`. Nói "cổng xanh" và nói "quy tắc đã nhìn" là hai câu khác nhau, và ở
   mô-đun này thì chúng khác nhau nhiều hơn ở bất kỳ mô-đun nào khác.

## Ngoại lệ

Ngoại lệ là **một phần của cưỡng chế**, không phải chỗ để lách.

- **Phiên bản công bố ra ngoài.** Một route, một payload hay một hợp đồng thật sự đưa thế hệ thứ hai
  ra cho bên ngoài gọi thì phiên bản là một phần danh tính của nó. `no-version-in-name` không phân
  biệt được chuyện đó với một thế hệ lược đồ nội bộ. Cách viết trung thực là một dòng tắt cảnh báo có
  nêu tên hợp đồng đã công bố — không phải một lần đổi tên làm máy im mà làm cái tên tệ đi.
- **Tên chuẩn kỹ thuật có số sẵn.** Một cái tên mang số vì **tiêu chuẩn** mang số cũng bị cùng biểu
  thức chính quy báo. Xử lý y hệt: tắt cảnh báo và nêu tên tiêu chuẩn.
- **Tệp sinh tự động hoặc tệp đi mượn.** Tệp mà cây này không viết thì tắt ở mức tệp, kèm câu nói rõ
  ai là tác giả.
- **Làn kiểm thử không được miễn.** Không quy tắc nào chặn theo tên tệp, nên một hàm phụ trợ export từ
  cây kiểm thử bị xét như mọi export khác. Đây là chủ ý của luật, không phải sót của quy tắc.
- **Phương thức trên một lớp đặt tên tốt** nằm ngoài `no-bare-verb-export` vì cấu tạo, không phải vì
  được cho phép. Nếu tên phương thức trơ thì nó được review ở chỗ nó được viết.
