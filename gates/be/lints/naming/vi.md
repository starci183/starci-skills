---
title: Naming · Vietnamese
---

# Đặt tên

Đầu vào là mã đã viết xong — một tệp, một mảnh diff. Đầu ra là một **phán quyết**: quy tắc nào đã bắn,
nó phát ra thông điệp gì, tại nút nào, ứng với mã luật nào, và cửa nào còn mở đủ rộng để che đúng cái
sai đó. Mô-đun này không chọn tên. Nó từ chối một cái tên, và nó phải chỉ được vào đúng định danh mà nó
từ chối.

## Luật

Cái tên là phần duy nhất của một ký hiệu chạm tới người chưa mở tệp ra đọc. Mọi thứ còn lại — chữ ký,
thân hàm, kiểm thử — đều bắt người ta trả giá bằng một lần mở tệp. Nên một cái tên chỉ trả lời một câu
hỏi: đây là cái gì, với người chưa biết gì về nó? Không phải nó được hiện thực bằng gì, không phải nó
được viết cho thế hệ định dạng nào, cũng không phải nó nằm ở thư mục nào lúc mới sinh ra.

Luật có **bảy điều. Hai điều có quy tắc giữ.** Con số nhỏ đó mới là con số trung thực: nguồn lập luận
dài dòng và có kèm số đo rằng năm điều còn lại đòi biết **thứ đó thực sự là gì**, mà không bộ phân tích
cú pháp nào biết. Một điều luật không có quy tắc thì được biết là chưa được cưỡng chế, và người đọc tự
bù vào. Một quy tắc bị tin là đã đóng mà thực ra rò thì tệ hơn, vì nó mua sự chú ý của người đọc rồi
tiêu vào chỗ trống.

Cả hai quy tắc đều chạy ở mức **`warn`, không phải `error`**, trong chính cấu hình khuyến nghị của
nguồn — và đó là quyết định có lý do: luật đặt tên rơi xuống một cây mã đã trưởng thành và có nợ thật.
Một quy tắc đặt tên bật `error` ngay ngày đầu sẽ chặn mọi commit chạm vào tệp cũ, và điều đó dạy người
ta cách tắt quy tắc. Build vẫn xanh trong lúc cả hai đang bắn. "Cổng đã qua" và "quy tắc không thấy gì"
là hai câu khác nhau ở đây, và chỉ một trong hai câu là bằng chứng.

## Luật máy đã xuất bản

| Quy tắc | Mã | Nó báo cái gì |
|---|---|---|
| `no-version-in-name` | `NAME-2` | `versioned` — một hàm, lớp, interface, type alias hoặc phương thức **khai báo** có tên nướng sẵn một thế hệ lược đồ vào trong |
| `no-bare-verb-export` | `NAME-5` | `bareVerb` — một export có tên đúng bằng một trong mười tám động từ trơ đã liệt kê |

Con số đúng bằng hai. Bản `rules` mà nguồn xuất ra công bố `no-version-in-name` và
`no-bare-verb-export`, không có gì khác, và dòng đầu phần header của nó nói đúng như vậy.

`NAME-1`, `NAME-3`, `NAME-4`, `NAME-6` và `NAME-7` **không có quy tắc nào giữ**. Chúng do review giữ,
tức là chưa được cưỡng chế chứ không phải đã được phủ, và một lần chạy xanh không nói được gì về bất kỳ
điều nào trong số đó. Có hai chỗ vắng đáng gọi tên cho chính xác. `NAME-1` từng có hình hài một quy tắc,
đã được đo, và đã bị xoá: bản đầu tiên đòi tên tệp phải đánh vần ra lớp mà nó khai báo, rồi tìm thấy 616
chỗ vi phạm trên 4430 tệp — vì quy ước của cây mã ngược hẳn với giả định của nó, và mười bốn phần trăm
một cây mã là một quy ước, không phải nợ. Còn `NAME-6` trông như được giữ một nửa mà thật ra không: điều
luật về boolean cấm `checkX`, và vì động từ `check` nằm trong tập động từ trơ nên một hàm tên đúng bằng
`check` có bị báo — nhưng là do `no-bare-verb-export`, dưới mã `NAME-5`, và chỉ khi nó được export.
`checkVerified`, đúng cái hình dạng mà điều luật cấm, thì không có gì báo cả.

## Đọc một diff

1. **Quyết định phạm vi trước mọi thứ khác, và ghi lại.** Phạm vi ở đây khác thường: **không quy tắc nào
   đọc `context.filename`**, nên mọi tệp mà linter phân tích đều nằm trong phạm vi. Không có thư mục,
   hậu tố, đường dẫn fixture hay tệp sinh tự động nào nằm ngoài phạm vi — và cũng không có tên tệp nào
   được xét. Hãy ghi điều đó ra như một quyết định phạm vi, đừng mặc định nó.
2. **Kiểm tra các ngoại lệ.** Một dòng tắt cảnh báo có nêu tên hợp đồng đã công bố, nêu tên tiêu chuẩn,
   hoặc nêu tác giả của tệp sinh tự động/đi mượn là lối ra duy nhất; cả hai quy tắc đều không có tuỳ
   chọn, không có danh sách miễn trừ, không có cách tắt theo từng tệp.
3. **Đọc nút, đừng đọc chữ.** `no-version-in-name` nhìn năm loại khai báo cộng `MethodDefinition`;
   `no-bare-verb-export` nhìn `ExportNamedDeclaration.declaration` và không nhìn gì khác. Một cái tên
   không nằm đúng ở những vị trí đó thì chưa từng bị nhìn tới.
4. **Mỗi phát hiện là một khối**, đặt tại chính nút định danh mà quy tắc báo lên.
5. **Viết dòng `hatch` mỗi khi một cửa còn mở có thể che đúng cái sai đó**, kể cả khi tệp không sinh ra
   phát hiện nào.
6. **Đừng báo cái mà không quy tắc nào canh.** Năm trong bảy mã không có máy nào giữ; một phán quyết nói
   khác đi là nói sai về mô-đun này.

## `no-version-in-name` — NAME-2

**Nó báo cái gì.** `versioned`, một thông điệp duy nhất, đặt trên định danh được khai báo: một cái tên
nướng sẵn một thế hệ lược đồ vào trong — `isV2`, `IsContentV2Params`, `parseV2Body`,
`class V2ContentParser`. Cái tên loại này phải đổi đúng vào ngày thế hệ sau ra đời, nhưng đổi tên mới là
phần dễ; phần khó là từ giờ tới lúc đó, không ai nhìn tên mà biết `V2` đang có nghĩa là hình dạng hiện
tại hay một hình dạng cũ, nên mọi người đọc đều phải đi tra.

**Nó phát hiện bằng gì.** Thăm **đúng năm** loại nút: `FunctionDeclaration`, `ClassDeclaration`,
`TSInterfaceDeclaration`, `TSTypeAliasDeclaration` — cả bốn đều đòi có `node.id` — và `MethodDefinition`
với điều kiện `node.key.type === "Identifier"`. Lấy chuỗi `name` của định danh đem so với **một** biểu
thức chính quy, `/(?:^|[a-z])V[0-9]+(?:$|[A-Z_])|_V[0-9]+/`, rồi báo tại chính nút định danh. Nhánh một
đòi chữ `V` **hoa** đứng ở đầu tên hoặc ngay sau một chữ cái **thường**, rồi sau dãy số phải là hết tên,
một chữ **hoa**, hoặc một dấu gạch dưới. Nhánh hai đòi một dấu gạch dưới ngay trước chữ `V` hoa.

**Nó không thấy gì.** Nó **không thăm bất kỳ khai báo biến nào**, nên `export const parseV2Body = (body)
=> { … }` — kiểu viết phổ biến nhất cho một hàm phụ trợ — là vô hình; quy tắc anh em nằm cùng tệp có đi
bộ qua danh sách declarator để làm đúng việc đó, nên không thể nói tác giả không biết hình dạng này tồn
tại. `TSPropertySignature` không được thăm, nên `interface ContentParams { isV2: boolean }` sống yên
trong một cái tên đúng chuẩn, mà trường thì được đọc ở mọi chỗ gọi. `PropertyDefinition` không phải
`MethodDefinition`, nên `class ContentParser { readonly isV2 = true }` đi lọt, trong khi cùng cái tên đó
viết thành phương thức thì bị báo. Thành viên trừu tượng là `TSAbstractMethodDefinition` — đúng chỗ mà
một tên phương thức có phiên bản hay được khai báo cho người khác hiện thực thì lại không được thăm.
Phương thức trong object literal là `Property`. Không thăm `TSEnumDeclaration` lẫn `TSEnumMember`. Bên
trong biểu thức chính quy: một từ viết tắt đứng liền trước phiên bản, `class ContentAPIV2Parser`, vô
hiệu hoá nhánh một, còn nhánh hai thì đòi dấu gạch dưới; một chữ **thường** đứng sau dãy số,
`function parseV2body()`, cũng vô hiệu hoá nó — đúng một phím Shift. Nhánh `_V[0-9]+` được viết cho tên
kiểu hằng số viết hoa như `const SCHEMA_V2 = …`, mà **không visitor nào chạm tới một hằng số cả**, nên
nửa biểu thức đó gần như không bao giờ chạy được. Cả hai nhánh đều đòi `V` hoa, nên `function parse_v2()`
và `const isv2 = …` đều im. Và quy tắc chỉ biết **một** cách đánh vần chữ "phiên bản": `Schema2`, `Rev2`,
`Gen2`, `Legacy`, `Old`, `New` và `Next` đều đang đặt tên cho một khoảnh khắc, và không cái nào bị nhìn
thấy.

**Ranh giới.** Nó chỉ xét **tên khai báo** — không xét giá trị, không xét chuỗi ký tự, không xét trường,
không xét đường dẫn tệp. Một phiên bản nằm trong tên tệp như `content-v2.service.ts` thuộc về `NAME-1`,
mà `NAME-1` không có quy tắc nào giữ.

## `no-bare-verb-export` — NAME-5

**Nó báo cái gì.** `bareVerb`, một thông điệp duy nhất, đặt trên định danh được export: một export tên
đúng bằng một động từ trơ — `generate` — generate **cái gì**? Ở một danh sách import, `generate` đụng với
`generate` của mọi mô-đun khác, nên người đọc phải quay ra đọc **đường dẫn**, mà đường dẫn chính là thứ
hay di chuyển. Danh sách gồm mười tám chuỗi: `generate`, `parse`, `run`, `handle`, `process`, `build`,
`create`, `load`, `resolve`, `check`, `convert`, `transform`, `send`, `fetch`, `get`, `set`, `update`,
`apply`.

**Nó phát hiện bằng gì.** Chỉ thăm `ExportNamedDeclaration`, và thoát ngay khi `node.declaration` không
tồn tại. Nếu `declaration` là `FunctionDeclaration` có `id` thì lấy tên đó luôn; nếu là
`VariableDeclaration` thì duyệt từng declarator, đòi `init.type` là `ArrowFunctionExpression` hoặc
`FunctionExpression` và `id.type` là `Identifier`. Phép kiểm là **tra thành viên trong một `Set`** viết
tay, đúng chuỗi, phân biệt hoa thường. Báo tại chính nút định danh. **Không có cổng chặn theo tên tệp.**

**Nó không thấy gì.** Vì nó đọc `node.declaration` rồi thoát khi nút đó vắng mặt, một danh sách specifier
— `function generate() { … }` ở trên rồi `export { generate }` ở dưới, và mọi tệp barrel — làm quy tắc
biến mất hoàn toàn. `export { askModel as generate } from "./models"` tạo ra động từ trơ ở đúng cái nút
mà quy tắc từ chối đọc. `export * from "./content"` là `ExportAllDeclaration`;
`export default function generate() { … }` là `ExportDefaultDeclaration`; không nút nào được thăm.
`export const generate = memoize(buildContent)` có `init` là `CallExpression`, nên bọc một hàm bằng bộ
nhớ đệm, bộ ghi log, một factory hay một decorator là gỡ luôn quy tắc khỏi khai báo đó. Một **phương
thức** tên trơ — `export class ContentService { generate() { … } }` — không nằm trong tầm, và
`const { generate } = service` đưa người đọc về đúng cái va chạm mà điều luật đang mô tả. Một thuộc tính
của object chứa hàm, `export const contentApi = { generate: () => { … } }`, công bố động từ đó qua một
lớp gián tiếp. Danh sách là **viết tay và đóng ở mười tám mục**, nên `execute`, `emit`, `read`, `write`,
`sync`, `init`, `start`, `render`, `validate`, `find`, `save`, `list`, `format`, `merge` và `serialize`
đều hợp lệ — `execute` có lẽ là từ trơ nhất trong cả tiếng Anh và nó không có trong danh sách. Tra thành
viên là so chuỗi chính xác, nên `Generate`, `generate_` và `doGenerate` thoát bằng một chữ hoa, một dấu
gạch dưới, hoặc một từ đệm. Và `export declare function generate(): void` là `TSDeclareFunction`, nhánh
nào cũng trả về.

**Ranh giới.** Nó chỉ xét **một vị trí cú pháp duy nhất**: định danh của một khai báo mà chính khai báo
đó là chủ thể của từ khoá `export`. Mọi thứ được công bố bằng đường khác đều nằm ngoài quy tắc vì cấu
tạo, không phải vì được cho phép.

## Cách phát hiện

Cả hai quy tắc đều là những lượt đi bộ AST thuần trên tên khai báo. Không chỗ nào ở đây đọc tên tệp, giải
một import, đi theo một type alias, hay hỏi bộ kiểm kiểu.

| Phần | Cơ chế |
|---|---|
| bộ duyệt của `no-version-in-name` | Năm loại nút — `FunctionDeclaration`, `ClassDeclaration`, `TSInterfaceDeclaration`, `TSTypeAliasDeclaration` (đều đòi `node.id`) và `MethodDefinition` (đòi `node.key.type === "Identifier"`) |
| phép kiểm phiên bản | Một biểu thức chính quy trên chuỗi `name` của định danh: `/(?:^\|[a-z])V[0-9]+(?:$\|[A-Z_])\|_V[0-9]+/`. Báo cáo đặt tại nút định danh |
| bộ duyệt của `no-bare-verb-export` | Chỉ `ExportNamedDeclaration`; thoát khi `node.declaration` vắng mặt; lấy `FunctionDeclaration` có `id`, hoặc duyệt declarator của `VariableDeclaration` với `init` là `ArrowFunctionExpression`/`FunctionExpression` và `id` là `Identifier` |
| phép kiểm động từ | Tra thành viên trong một `Set` viết tay gồm mười tám chuỗi, đúng chuỗi, phân biệt hoa thường. Báo cáo đặt tại nút định danh |
| cổng đường dẫn | **Không có.** Không quy tắc nào đọc `context.filename` |
| với ra ngoài tệp | **Không có gì.** Không mô-đun nào được giải, không kiểu nào được giải, không quy tắc nào có fixer. Hàm phụ trợ `normalizePath` tồn tại trong nguồn cho các luật anh em và không quy tắc nào ở đây dùng tới |

Hai cơ chế gánh cả cái kệ này, và cả hai đều hẹp theo cùng một hướng: một bên là **biểu thức chính quy
trên một tên khai báo**, bên kia là **phép tra thành viên tại một vị trí cú pháp**. Mọi cửa còn mở bên
dưới đều suy ra từ hai câu đó.

## Lối thoát hợp lệ

**Đã đóng** — người đọc có thể tưởng những cách viết này đi lọt, nhưng không.

| Viết như thế này | Vì sao vẫn bị bắn |
|---|---|
| `class ContentV2Parser` / `interface IsContentV2Params` / `type V2Body` | Cả bốn loại khai báo đều được thăm, và một chữ hoa sau dãy số thoả điều kiện đuôi |
| Một phương thức — `async isV2(params) { … }` | `MethodDefinition` được thăm với key là `Identifier`; getter, setter và phương thức tĩnh đều là cùng loại nút |
| Phiên bản nằm ngay đầu — `class V2ContentParser` | Nhánh mở đầu `^` phủ được |
| Phiên bản nằm ở cuối — `function parseContentV2` | Nhánh kết thúc `$` phủ được |
| `export async function generate(…)` | Một hàm `async` vẫn là `FunctionDeclaration`; từ khoá đó không đổi gì |
| `export const generate = async () => { … }` | `init` là `ArrowFunctionExpression`, đúng thứ vòng lặp chấp nhận |
| `export const generate = function generate() { … }` | `FunctionExpression` được chấp nhận song song với dạng mũi tên |
| `export let generate = () => { … }`, nhiều declarator trên một dòng | Quy tắc đọc `VariableDeclaration` bất kể `kind`, và duyệt **mọi** declarator |
| `export const generate: ContentGenerator = () => { … }` | `id` của declarator vẫn là `Identifier`; chú thích kiểu treo bên cạnh và không được đọc |
| Di chuyển hoặc đổi tên tệp | Không quy tắc nào đọc tên tệp, nên không cú chuyển và không cú đổi tên nào thoát được |

**Còn mở** — đây là phần mù được xuất xưởng. Một phán quyết không được phép nói rằng những chỗ này đã
được xét.

| Phạm vi | Cái gì đi lọt |
|---|---|
| `no-version-in-name` | **Một khai báo biến** — `export const parseV2Body = (body) => { … }` không có visitor nào chạm tới |
| `no-version-in-name` | **Một trường** — `TSPropertySignature` và `PropertyDefinition` không được thăm, nên `isV2` sống yên trên trường của interface hoặc trường của lớp |
| `no-version-in-name` | **Thành viên trừu tượng** (`TSAbstractMethodDefinition`), **phương thức trong object literal** (`Property`), và **enum** (`TSEnumDeclaration`, `TSEnumMember`) |
| `no-version-in-name` | **Từ viết tắt đứng trước phiên bản** — `ContentAPIV2Parser` — và **một chữ thường sau dãy số** — `parseV2body` — mỗi cái đều vô hiệu hoá nhánh một |
| `no-version-in-name` | **Hằng số viết hoa** — `const SCHEMA_V2 = …`; nhánh `_V[0-9]+` gần như không bao giờ chạy được vì không visitor nào chạm tới một hằng số |
| `no-version-in-name` | **Chữ `v` thường** — `parse_v2`, `isv2` — và **mọi cách đánh vần khác của một khoảnh khắc**: `Schema2`, `Rev2`, `Gen2`, `Legacy`, `Old`, `New`, `Next` |
| `no-bare-verb-export` | **Danh sách specifier** — `export { generate }`, và mọi tệp barrel — cùng với **tái xuất có bí danh**, `export * from`, và `export default function generate` |
| `no-bare-verb-export` | **`init` bị bọc** — `memoize(buildContent)` — **phương thức trên một lớp được export**, **thuộc tính object chứa hàm**, và `export declare function` |
| `no-bare-verb-export` | **Mọi động từ ngoài mười tám từ** — `execute`, `emit`, `read`, `write`, `sync`, `init`, `start`, `render`, `validate`, `find`, `save`, `list`, `format`, `merge`, `serialize` — và mọi cách viết trượt một ly: `Generate`, `generate_`, `doGenerate` |
| cả hai | **Bất kỳ tên tệp nào** — `content-v2.service.ts`, `generate.ts`. Không quy tắc nào đọc `context.filename`, và `NAME-1`, tức điều luật về tên tệp, thì không có quy tắc |
| không quy tắc nào | **Toàn bộ những gì `NAME-1`, `NAME-3`, `NAME-4`, `NAME-6` và `NAME-7` cấm** — một cái tên lấy theo thư mục, theo cơ chế, theo người gọi đầu tiên, và hình dạng boolean `checkVerified` mà `NAME-6` thực sự cấm |

Cái khuôn nằm dưới phần lớn những dòng đó gói trong một câu: **mỗi quy tắc chỉ nhận ra đúng một vị trí cú
pháp và ở mọi chỗ khác thì im lặng chứ không báo.** Một lệnh `return` sớm, nhìn từ log build, không khác
gì một tệp sạch — và ở mức `warn` thì log xanh trong cả hai trường hợp.

## Đầu vào

| Đầu vào | Bằng chứng bắt buộc |
|---|---|
| AST của mã nguồn | Năm loại nút khai báo và `id` của chúng; `MethodDefinition.key` |
| Nút export | `ExportNamedDeclaration.declaration` và, qua đó, `id` của một `FunctionDeclaration` hoặc các `id` declarator của một `VariableDeclaration` |
| Tên tệp | **Không gì cả.** Không quy tắc nào đọc `context.filename`, nên không thư mục, hậu tố, đường dẫn fixture hay tệp sinh tự động nào được miễn — và không tên tệp nào bị xét |
| Tuỳ chọn | **Không gì cả.** Cả hai khai báo `schema: []`; không có bề mặt cấu hình, và không thể mở rộng danh sách động từ nếu không sửa chính quy tắc |
| Import | **Không gì cả.** Không mô-đun nào được giải; một cái tên tái xuất không bao giờ được lần về nơi khai báo |
| Kiểu | **Không gì cả.** Không kiểu nào được giải; một cái tên chỉ là một chuỗi |
| Mức nghiêm trọng | Cả hai công bố ở `warn` trong cấu hình khuyến nghị, kèm chỉ dẫn rõ ràng là phải đo trước khi nâng lên |

## Quy tắc

1. Danh tính của một quy tắc là **tên đã công bố** của nó. Mô-đun này không đặt mã số cho quy tắc; cái
   tên mới là chuỗi in ra trong log build và là chuỗi nằm trong dòng tắt cảnh báo.
2. Chỉ ghi lại quy tắc **có thật trong nguồn**. Một quy tắc đáng có mà chưa có thì là một rủi ro để ngỏ,
   không phải một dòng trong bảng.
3. Mỗi quy tắc giữ đúng một mã luật; không mã nào bị hai quy tắc cùng giữ.
4. Phiên bản chỉ được xét trên **tên khai báo**, không bao giờ trên một giá trị, một chuỗi ký tự, một
   trường hay một đường dẫn tệp.
5. Động từ trơ chỉ được xét ở **một vị trí cú pháp duy nhất**: định danh của một khai báo mà chính khai
   báo đó là chủ thể của từ khoá `export`.
6. Không quy tắc nào có fixer. Mọi báo cáo đều là một thông điệp, và cái tên thay thế mà thông điệp gợi
   ý là văn xuôi, không phải bản vá.
7. Không quy tắc nào đọc tên tệp, nên không thể thoát bằng cách di chuyển hay đổi tên tệp — và cũng
   không thể nới lỏng cho một fixture.
8. Không quy tắc nào nhận tuỳ chọn, nên một repository không thể làm yếu quy tắc mà không tắt hẳn nó, và
   không thể thêm một động từ vào danh sách mà không sửa quy tắc đã xuất xưởng.
9. Cách viết dấu gạch dưới hay từ viết tắt bên trong một cái tên tự nó không bao giờ là một báo cáo; chỉ
   khuôn phiên bản và chuỗi động từ chính xác mới là phán quyết.
10. Mọi cửa còn mở là khe hở của **quy tắc**, không bao giờ là quyền được viết như vậy của **luật**. Mã
    đi lọt vẫn là mã sai.
11. Cả hai quy tắc chạy ở `warn` vì chủ ý, không phải vì sót. "Cổng đã qua" không phải là "quy tắc không
    thấy gì".

## Ngoại lệ

Ngoại lệ là **một phần của cưỡng chế**, không phải chỗ để lách. Cả hai quy tắc đều không khai báo tuỳ
chọn, không có danh sách miễn trừ, không có cách tắt theo từng tệp, nên mỗi ngoại lệ dưới đây là một dòng
tắt cảnh báo có nêu rõ nó thả cái gì ra.

- **Phiên bản công bố ra ngoài.** Một route, một payload hay một hợp đồng thật sự đưa thế hệ thứ hai ra
  cho bên ngoài gọi thì phiên bản là một phần danh tính của nó. `no-version-in-name` không phân biệt được
  chuyện đó với một thế hệ lược đồ nội bộ, và sẽ báo. Cách viết trung thực là một dòng tắt cảnh báo có
  nêu tên hợp đồng đã công bố — không phải một lần đổi tên làm máy im mà làm cái tên tệ đi.
- **Tên chuẩn kỹ thuật có số sẵn.** Một cái tên mang số vì **tiêu chuẩn** mang số cũng bị cùng biểu thức
  chính quy báo. Xử lý y hệt: tắt cảnh báo và nêu tên tiêu chuẩn.
- **Tệp sinh tự động hoặc tệp đi mượn.** Tệp mà cây này không viết thì tắt ở mức tệp, kèm câu nói rõ ai
  là tác giả.
- **Làn kiểm thử không được miễn.** Không quy tắc nào chặn theo tên tệp, nên một hàm phụ trợ export từ
  cây kiểm thử bị xét như mọi export khác. Ví dụ mẫu của chính luật là một dòng import từ mô-đun trợ giúp
  kiểm thử, nên đây là chủ ý, không phải sót.
- **Phương thức trên một lớp đặt tên tốt** nằm ngoài `no-bare-verb-export` vì cấu tạo, không phải vì được
  cho phép. Nếu tên phương thức trơ thì nó được review ở chỗ nó được viết.

## Đầu ra

Mỗi phát hiện là một khối:

```text
file:     <path as written; no rule reads it>
scope:    <in — every parsed file; neither rule gates on filename>
rule:     <no-version-in-name | no-bare-verb-export>
law code: <NAME-2 | NAME-5>
message:  <versioned | bareVerb>
node:     <declaration name identifier | method key | export declarator id>
severity: warn
hatch:    <the open hatch that would have hidden this, or none>
```

Một tệp sạch sinh ra một khối với `message: none` và dòng `hatch` nêu tên bất kỳ cửa còn mở nào có thể đã
che một cái sai cùng loại — ở mức `warn`, im lặng không phải là tuân thủ. Mô-đun này không có khối "ngoài
phạm vi": không quy tắc nào chặn theo tên tệp, nên không tệp nào bị bỏ qua vì lý do phạm vi.

## Ví dụ đã giải

**Đầu vào.** Một tệp service, `content-v2.service.ts`:

```ts
export class ContentService {
  async isV2(params: ContentParams): Promise<boolean> {
    return params.schema === "v2"
  }
}

export const generate = async (body: string): Promise<Content> => {
  return build(body)
}

export const parseV2Body = (body: string): ContentBody => {
  return JSON.parse(body)
}
```

Hai phát hiện.

```text
file:     content-v2.service.ts
scope:    in — every parsed file; neither rule gates on filename
rule:     no-version-in-name
law code: NAME-2
message:  versioned
node:     method key isV2
severity: warn
hatch:    none
```

```text
file:     content-v2.service.ts
scope:    in — every parsed file; neither rule gates on filename
rule:     no-bare-verb-export
law code: NAME-5
message:  bareVerb
node:     export declarator id generate
severity: warn
hatch:    none
```

Bản thân tên tệp, `content-v2.service.ts`, không phải một phát hiện: không quy tắc nào đọc nó, và
`NAME-1` thì không có quy tắc. Cả hai báo cáo đều ở `warn`, nên build vẫn xanh trong lúc cả hai đang hiện
trên màn hình.

**Đã sửa.** Phương thức nói ra hình dạng đó là gì thay vì nói nó thuộc thế hệ nào, còn export nói ra nó
sinh ra cái gì:

```ts
export class ContentService {
  async usesLegacySchema(params: ContentParams): Promise<boolean> {
    return params.schema === "v2"
  }
}

export const generateCourseOutline = async (body: string): Promise<Content> => {
  return build(body)
}

export const parseV2Body = (body: string): ContentBody => {
  return JSON.parse(body)
}
```

Export thứ ba chưa bao giờ được sửa, và bây giờ tệp không báo gì cả:

```text
file:     content-v2.service.ts
scope:    in — every parsed file; neither rule gates on filename
rule:     no-version-in-name
law code: NAME-2
message:  none
node:     export declarator id parseV2Body
severity: warn
hatch:    the version rule visits no variable declarator at all, so a version baked into an
          arrow-function constant is invisible; the silence is blindness, not compliance
```

## Phạm vi

Mô-đun này ghi lại hai quy tắc đã công bố và không gì khác. Một quy tắc đáng có mà không nằm trong nguồn
thì không được ghi ở đây; nó là một rủi ro để ngỏ. Tên quy tắc được chép lại nguyên văn vì cái tên chính
là danh tính — nó là chuỗi in ra trong log build, chuỗi nằm trong dòng tắt cảnh báo, và chuỗi mà mọi cuộc
trao đổi về lỗi đều dùng. Chuyện một cái tên lấy nghĩa từ thư mục, từ cơ chế hay từ người gọi đầu tiên
thuộc về `NAME-1`, `NAME-3`, `NAME-4`, `NAME-6` và `NAME-7`, những điều do review giữ và không có máy nào
giữ. Văn xuôi và ví dụ không nêu tên sản phẩm nào.
