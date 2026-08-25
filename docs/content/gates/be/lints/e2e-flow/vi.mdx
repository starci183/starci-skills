---
title: E2e-flow · Vietnamese
---

# Luồng e2e

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-be` | `@starci/eslint-canon-be` | npm package | bộ máy backend đã phát hành mà bản ghi này viện dẫn |


## Bản ghi

Gate này nhận mã đã viết xong — một tệp luồng, một khúc diff. Kết quả là một **phán quyết**: tệp có vào
phạm vi hay không, luật máy nào đã nổ, nó báo cái gì và tại nút nào, điều đó ứng với mã luật nào, và
cửa mở nào lẽ ra đã che đúng lỗi ấy. Mô-đun này không chọn cách viết một luồng. Nó từ chối, và nó phải
chỉ được vào đúng câu nhập, đúng lời gọi hay đúng nhánh mà nó từ chối.

## Luật

Một tệp luồng biến **một câu nghiệp vụ** thành một bài kiểm thử chỉ đỏ khi nghiệp vụ hỏng, và không đỏ
vào lúc nào khác. Luật nói điều đó mang **mười hai** mã dưới tiền tố `E2E-`. Tám mã trong số ấy phụ
thuộc vào ý nghĩa — một cái tên nói gì, cái gì đang được khẳng định, ai đang hành động — mà một luật nổ
vào phán đoán là luật người viết học cách tắt đi, và lúc đó luật còn tệ hơn khi chẳng có gì giữ cả.

**Bảy mã có lát cắt máy giữ**: `E2E-1`, `E2E-3`, `E2E-4`, `E2E-7`, `E2E-8`, `E2E-11`, `E2E-12`.
Mô-đun công bố bảy quy tắc tập trung. Danh tính của một luật
máy là **tên công bố** của nó: chuỗi in ra trong log build và chuỗi viết trong dòng tắt luật. Ở đây
không đặt thêm số cho luật nào cả.

Tài liệu này không chép lại luật. Nó ghi **mức thực thi**: mỗi luật máy nhìn vào cú pháp nào, và — phần
không ai chịu viết ra — viết kiểu gì thì cùng một lỗi ấy hoàn toàn không bị nhìn thấy.

## Luật máy đã xuất bản

| Luật máy | Mã luật | Nó báo cái gì |
|---|---|---|
| `e2e-uses-production-transport` | `E2E-11` (chỉ nửa "gọi thẳng diễn viên nội bộ") | Ba chuyện khác nhau dưới một cái tên: một tên bộ điều phối được nhập từ gói CQRS; **bất kỳ** lời gọi thành viên không dùng ngoặc vuông nào có phương thức tên `execute` hoặc `process`; và một lời gọi thành viên có bên nhận là định danh kết thúc bằng `Worker` hay `Handler`. |
| `e2e-asserts-persisted-state` | `E2E-4` (chỉ nửa "đọc lại trạng thái đã lưu") | Một tệp luồng mà không có lấy một trong sáu tên định danh lưu trữ xuất hiện ở bất kỳ đâu trong mã nguồn. Đúng một báo cáo cho mỗi tệp, neo ở `Program`. |
| `no-model-call-in-e2e` | `E2E-12` (chỉ nửa "nhập gói nhà cung cấp") | Một câu `import` có chuỗi nguồn khớp một trong sáu mẫu gói nhà cung cấp mô hình. |
| `no-sleep-in-flow` | `E2E-3` (chỉ nửa "đừng ngủ") | Một lời gọi tới một trong năm định danh ngủ trần, hoặc một `new Promise` mà văn bản nguồn thô có chứa `setTimeout`. |
| `no-branch-in-flow-step` | `E2E-7` | `if`, toán tử ba ngôi, `switch`, hoặc toán tử logic đứng thành nguyên một câu lệnh, nằm về mặt văn bản trong thân một lời gọi `it` hay `test`. |
| `no-api-shaped-e2e-filename` | `E2E-1` và `TESTING-1` | Tên tệp kết thúc bằng danh từ API đóng thay vì gọi tên business flow mà nó chứng minh. |
| `no-wiring-in-flow-spec` | `E2E-8` | Spec gọi `Test.createTestingModule(...)` thay vì boot qua shared world helper. |

Cả bảy đều ánh xạ được vào một mã mà luật thật sự công bố, nên ở đây không có luật máy nào thực thi một
quyết định chưa được viết ra.

**Năm mã còn lại** dưới tiền tố `E2E-` chưa có luật máy đầy đủ. Nguồn của mô-đun này không gọi tên
chúng, nên ở đây cũng không thể gọi tên — nhưng chúng là **không được thực thi** chứ không phải đã được
phủ, và một lần chạy xanh không nói gì về bất kỳ mã nào trong số đó. Các nửa mã cũng vậy: nửa "bài kiểm
thử có **đi vào bằng cổng sản xuất** hay không" của `E2E-11`, nửa "hệ quả được khẳng định có đúng là hệ
quả nghiệp vụ không" của `E2E-4`, nửa "chính sách nội bộ phải giữ nguyên, chỉ kết quả bên ngoài mới
được kịch bản hoá" của `E2E-12`, và nửa "hãy hỏi vòng **có hạn chót**" của `E2E-3` đều không có máy nào
giữ. Mỗi luật máy ở đây giữ nhiều nhất **một nửa** mã của nó.

## Đọc một diff

1. **Quyết định phạm vi trước mọi thứ khác, và ghi lại.** Ngoài phạm vi ở đây không có nghĩa là tệp đã
   qua — nghĩa là không có bộ duyệt nào được cài và cả bảy luật đều không tồn tại với tệp đó.
2. **Phạm vi là đúng một cái đuôi tên tệp.** `isE2eSpec` thử đường dẫn đã chuẩn hoá với
   `/\.e2e-spec\.ts$/`. `*.spec.ts`, `*.e2e.spec.ts` và `*.e2e-spec.mts` không nhận luật nào.
3. **Không có miễn trừ nào để kiểm** — không allow-list, không thư mục được tha, không lối tắt theo
   tệp. Ba miễn trừ duy nhất nằm bên trong từng luật và được liệt ở mục Ngoại lệ.
4. **Đọc hình dạng của callee trước khi đọc tên.** Luật vận chuyển cần một `MemberExpression` không
   dùng ngoặc vuông; luật ngủ cần một `Identifier` trần. Sai hình dạng là kết thúc phép kiểm trước khi
   bất kỳ cái tên nào được thử.
5. **Xuất một khối cho mỗi phát hiện**, và viết dòng `hatch` mỗi khi có một cửa mở lẽ ra đã che đúng
   lỗi ấy.
6. **Đừng báo thứ không luật nào canh.** Bảy trong mười hai mã không có máy, và bốn trong năm mã được
   thực thi thì chỉ được giữ một nửa. Một phán quyết nói khác đi là nói sai về mô-đun.

## `e2e-uses-production-transport` — E2E-11

**Nó báo cái gì.** Ba thông điệp dưới một cái tên: `busImport` tại một `ImportSpecifier`, `direct` tại
một `CallExpression`, `actor` tại một `CallExpression`.

**Nó phát hiện bằng gì.** Ở `ImportDeclaration`: chỉ hành động khi `node.source.value` **đúng bằng**
`@nestjs/cqrs`, rồi với mỗi `ImportSpecifier` đọc `specifier.imported.name ||
specifier.imported.value` và báo `busImport` khi tên đó là `CommandBus`, `QueryBus` hay `EventBus`. Ở
`CallExpression`: bắt buộc `callee.type === "MemberExpression"` và `callee.computed === false`; báo
`direct` khi `callee.property.name` là `execute` hoặc `process`, rồi thoát. Nếu không, bóc
`callee.object` qua `TSAsExpression`, `TSTypeAssertion` và `ChainExpression`, và báo `actor` khi thứ
còn lại là một `Identifier` khớp `/(?:Worker|Handler)$/`.

**Điểm mù.** Một bên nhận không phải định danh trần: `app.get(OrderWorker).handle()`,
`workers.order.handle()` và `this.orderWorker.handle()` đưa ra một `CallExpression`,
`MemberExpression` hay `ThisExpression`, mà chỉ `Identifier` mới được thử. Một bên nhận đặt tên khác —
phép thử là phép so **đuôi** có phân biệt hoa thường, nên `const worker`, `const consumer`,
`const projector` giữ đúng cái đối tượng luật cấm gọi mà vẫn qua. Mọi phương thức nội bộ ngoài hai tên
cứng: luật nêu đích danh `finalize`, mà `finalize`, `handle`, `run`, `consume`, `perform`, `flush` và
`onModuleInit` **chỉ** bị bắt qua nhánh tên bên nhận. Một lời gọi bằng ngoặc vuông — `worker["process"]()`
thoát ngay ở cổng `callee.computed` trước cả hai nhánh, nên hai dấu ngoặc xoá được vi phạm ồn ào nhất
trong lane. Và mọi bộ điều phối lấy về không qua một phép nhập có tên: `import * as cqrs from
"@nestjs/cqrs"`, nhập mặc định, `require("@nestjs/cqrs")`, `export { CommandBus } from "@nestjs/cqrs"`,
một đường dẫn con như `@nestjs/cqrs/dist/index`, một tệp trung chuyển cục bộ xuất lại đúng những tên
ấy, hay một lần tra container bằng chuỗi token.

**Ranh giới.** Nhánh `execute`/`process` không hề nhìn bên nhận. Nó báo `client.execute()`,
`builder.execute()`, `stream.process()` và mọi lời gọi thành viên khác viết như vậy, đối tượng là gì
cũng thế. Mà phép đọc lưu trữ thông thường lại là `createQueryBuilder(…).…execute()`, nên viết đúng
phép đọc trạng thái mà `e2e-asserts-persisted-state` đòi, theo đúng hình dạng thư viện lưu trữ đưa ra,
là chạm phải luật này. Hai luật kéo ngược nhau trên cùng một dòng, và một báo cáo ở chỗ chẳng có gì bị
đi tắt chính là thứ dạy người ta viết dòng tắt luật — dòng tắt luật đó tắt luôn hai nhánh kia.

## `e2e-asserts-persisted-state` — E2E-4

**Nó báo cái gì.** `state`, đúng một lần cho mỗi tệp, tại nút `Program`.

**Nó phát hiện bằng gì.** Duyệt **mọi** `Identifier` và thử `node.name` với
`/^(?:entityManager|dataSource|EntityManager|DataSource|getRepository|queryRunner)$/`, bật một cờ
phạm vi tệp. Tới `"Program:exit"`, nếu cờ vẫn tắt thì báo `state` tại nút `Program`.

**Điểm mù.** Luật này kiểm **sự xuất hiện của một cái tên**, không kiểm một phép khẳng định.
Cờ được bật bởi bất kỳ `Identifier` nào mang một trong sáu tên, ở bất kỳ đâu: một câu nhập không dùng
tới, một chú kiểu, một tham số, một biến khai rồi không đọc. Một dòng gọi tên `DataSource` ở đầu một
tệp mà về sau chỉ khẳng định vào phong bì phản hồi — đúng cái khiếm khuyết `E2E-4` sinh ra để chặn —
làm luật im vĩnh viễn; và người dọn dẹp phần nhập, khi xoá nó đi, sẽ làm một tệp đang xanh hoá đỏ mà
không đụng vào bài kiểm thử nào. Nó cũng không thấy đường dựng cảnh: cái tên thoả mãn luật thường lại
là cái tên đã **ghi** dữ liệu mẫu trong `beforeAll`, tức một lần đọc chẳng có gì, vì luật không hề nhìn
xem định danh đó nằm ở đâu.

**Ranh giới.** Theo chiều ngược lại nó báo thừa. Mọi lần đọc trạng thái **qua bộ khung dùng chung** —
`world.db.isEnrolled(…)`, `repo.findOne(…)`, `prisma.order.findFirst(…)`,
`mongo.collection(…).findOne(…)` — đều là phép đọc dữ liệu đã lưu thật, viết đúng hình dạng luật
khuyên, mà vẫn bị báo trừ khi một định danh viết thẳng trong danh sách sáu tên cũng xuất hiện đâu đó
trong tệp. Mọi kho không phải kho quan hệ đều không có tên trong danh sách, nên một luồng đọc đúng một
kho tài liệu, một cache, một kho đối tượng hay trạng thái của chính broker thì bị báo, còn một luồng
không đọc gì mà có thêm chữ `queryRunner` thì không.

## `no-model-call-in-e2e` — E2E-12

**Nó báo cái gì.** `provider`, tại một `ImportDeclaration`.

**Nó phát hiện bằng gì.** Duyệt `ImportDeclaration`; bắt buộc `node.source.value` là chuỗi, rồi thử với
`/^(?:@anthropic-ai\/|openai$|openai\/|ollama$|@google\/generative-ai|@mistralai\/|cohere-ai)/`. Ba
nhánh là tiền tố neo đầu có dấu chéo, hai nhánh so bằng đúng (`openai`, `ollama`), và hai nhánh —
`@google/generative-ai`, `cohere-ai` — là tiền tố mở.

**Điểm mù.** Nó phát hiện một phép nhập, không phải một lời gọi. Mọi phép nhập không phải
`ImportDeclaration` — `require("openai")`, `await import("openai")`, `export * from "openai"` — đều
lọt. Mọi nhà cung cấp ngoài sáu mẫu: các biến thể chạy trên nền tảng đám mây, các cổng tổng hợp, các
bản chạy tại chỗ, tên gói kế nhiệm mà chính nhà cung cấp công bố sau một lần đổi tên, và những cái tên
suýt trúng như `openai-edge` — cái này trượt cả nhánh so bằng lẫn nhánh có dấu chéo. Danh sách là thứ
phải được nuôi. Hai lỗ lớn nhất thì không dính gì tới danh sách. **Chạm tới nhà cung cấp mà không qua
SDK**: `fetch(<provider-completion-endpoint>, …)`, hay chính lời gọi ấy qua HTTP client của
kho, không nhập thứ gì luật nhìn tới trong khi làm đúng cái việc luật mang tên để cấm. Và **để nguyên
khách hàng thật**: bài kiểm thử không kịch bản hoá gì, chính sách của ứng dụng tự phân giải nhà cung
cấp đã cấu hình, và một lời gọi trả tiền thật, không tất định, xảy ra bên trong một lần chạy xanh.

**Ranh giới.** `import type { … } from "openai"` vẫn bị báo dù chẳng có gì được đóng gói ra. Báo thừa
là cái giá của một phép thử thuần cú pháp, và nó rơi trúng người đang làm đúng — người đang khai kiểu
cho một kết quả đã kịch bản hoá.

## `no-sleep-in-flow` — E2E-3

**Nó báo cái gì.** `sleep`, tại một `CallExpression`; `timer`, tại một `NewExpression`.

**Nó phát hiện bằng gì.** Ở `CallExpression`: bắt buộc `callee.type === "Identifier"` và `callee.name`
nằm trong tập `{sleep, delay, wait, pause, setTimeout}`. Sau đó đi ngược chuỗi `node.parent`; nếu gặp
một `NewExpression` có `callee.name` là `Promise` thì thoát không báo, nhường ca đó cho nhánh promise.
Nếu không thì báo `sleep`. Ở `NewExpression`: bắt buộc `node.callee.name === "Promise"`, rồi lấy **văn
bản nguồn thô** của nút bằng `context.sourceCode.getText(node)` và báo `timer` khi văn bản đó khớp
`/setTimeout/`.

**Điểm mù.** Ngủ qua thành viên: `timers.setTimeout(500)`, `world.sleep(500)` và
`clock.wait(500)` không phải định danh trần — mà bộ hẹn giờ dạng promise hiện đại lại thường được viết
đúng như vậy, nên cách viết mới nhất của thói quen bị cấm chính là cách đi lọt. Đổi tên:
`import { sleep as settle } from "./util"`, hay `const nap = sleep`, đưa callee ra ngoài tập năm tên.
Mọi cách đốt thời gian khác: `setImmediate`, `process.nextTick`, `promisify(setTimeout)(500)` — nơi
callee là một lời gọi hàm còn định danh hẹn giờ chỉ là đối số — một vòng `while` trên `Date.now()`, hay
một vòng thử lại đếm lần mà không chờ gì cả. Và trên hết là **hỏi vòng không hạn chót**: nửa sau của mã
mà luật này giữ không được thực thi, nên chính cái thay thế luật khuyên, viết dở — lặp cho tới khi
trạng thái tới, mãi mãi — thì qua sạch, rồi hỏng thành một cái timeout của bộ chạy không gọi tên trạng
thái nào.

**Ranh giới.** Nhánh promise so bằng văn bản thô, nên một `new Promise(…)` mà thân chỉ *nhắc tới*
`setTimeout` trong một dòng chú thích, hoặc đặt tên biến là `setTimeoutMs`, vẫn bị báo dù không hề ngủ.

## `no-branch-in-flow-step` — E2E-7

**Nó báo cái gì.** `branch`, tại một `IfStatement`, `ConditionalExpression`, `SwitchStatement` hay
`LogicalExpression`.

**Nó phát hiện bằng gì.** Duyệt `IfStatement`, `ConditionalExpression`, `SwitchStatement`, và
`LogicalExpression` — nút cuối chỉ khi `node.parent.type === "ExpressionStatement"`. Mỗi ứng viên đi
qua `insideStep`: đi ngược chuỗi `node.parent` và trả về đúng ở `CallExpression` đầu tiên mà
`callee.name` — hoặc, nếu không có, `callee.object.name` — là `it` hay `test`.

**Điểm mù.** Một nhánh nằm trong hàm phụ trợ: `insideStep` là phép đi ngược **theo văn bản**,
nên một điều kiện nằm trong một hàm mà bước gọi ra thì ở ngoài mọi luật ở đây, kể cả khi hàm đó khai
báo ngay trong cùng tệp. Một nhánh trong `beforeAll`, `beforeEach`, `afterEach` hay trong thân
`describe` — bài kiểm thử đi kèm luật tuyên bố ca này là hợp lệ có chủ ý, vì ngoài một bước thì điều
kiện đọc như dựng cảnh, nhưng dựng cảnh có điều kiện cũng chính là cách một luồng hay rơi vào chỗ khẳng
định khác nhau giữa các lần chạy. Những cách rẽ không nằm trong bốn loại nút: `try`/`catch`,
`.catch(() => …)`, `Promise.allSettled`, chuỗi truy cập có dấu hỏi trên chính giá trị đang được khẳng
định, và `??` dùng để khởi tạo — toán tử vô hiệu tuy là `LogicalExpression` nhưng chỉ vị trí câu lệnh
mới bị báo, nên `const found = a ?? b` đi qua. Toán tử logic ở vị trí biểu thức:
`expect(a || b).toBe(true)` là một bài kiểm thử chuẩn bị sẵn cho cả hai kết quả, và luật cố ý đứng yên
ở đó. Một phép khẳng định đủ lỏng để đúng trên cả hai đường mà không cần toán tử nào — khớp một tập
con, khớp một giá trị bất kỳ, khẳng định vào `length` thay vì vào nội dung. Và một bước khai dưới cái
tên mà phép đi ngược không biết, chẳng hạn bí danh `specify`.

**Ranh giới.** "Bước" là khái niệm theo văn bản và chỉ trong chính tệp này. Chuyển đúng cái `if` ấy vào
một hàm phụ trợ khai báo cách đó mười dòng là xoá luật mà không cần một dòng diff nào vào luật.

## Cách phát hiện

| Bộ phận | Cơ chế |
|---|---|
| cổng tên tệp, cả bảy luật | `isE2eSpec(context.filename \|\| context.getFilename())`: tên tệp được ép bằng `String(… \|\| "")`, dấu chéo ngược đổi thành chéo xuôi, rồi thử với `/\.e2e-spec\.ts$/`. Tệp trượt phép thử này không bao giờ được cài bộ duyệt — đối tượng luật trả về `{}`. |
| chuẩn hoá dấu phân cách | Dấu chéo ngược thành chéo xuôi trước phép thử đuôi. Cái đuôi không mang dấu chéo nào, nên ở đây phép chuẩn hoá là trơ chứ không gánh việc gì. |
| phép thử nguồn nhập | `node.source.value` — so bằng **đúng chuỗi** cho luật vận chuyển, một regex tiền tố cho luật nhà cung cấp. |
| tên được nhập | `specifier.imported.name \|\| specifier.imported.value`, nên dạng nhập bằng chuỗi ký tự cũng được phủ, còn tên cục bộ thì không bao giờ được đọc. |
| bóc bên nhận | `callee.object` được bóc qua `TSAsExpression`, `TSTypeAssertion` và `ChainExpression` trước phép thử `/(?:Worker\|Handler)$/`. |
| quét định danh | Mọi `Identifier` trong tệp được thử với `/^(?:entityManager\|dataSource\|EntityManager\|DataSource\|getRepository\|queryRunner)$/`, bật một cờ phạm vi tệp và cờ đó được đọc ở `"Program:exit"`. |
| văn bản nguồn thô | `context.sourceCode.getText(node)` trên `new Promise`, khớp với `/setTimeout/` — là văn bản, không phải một nút gọi hàm. |
| tổ tiên theo văn bản | Chuỗi `parent`, dùng hai chỗ: `insideStep` để xác định bước chứa, và phép đứng yên của giấc ngủ bọc trong promise. |
| thứ vươn ra ngoài tệp | Không có gì. Phát hiện thuần cú pháp: không phân giải mô-đun, không hỏi kiểu, không chạy bài kiểm thử nào. |

## Lối thoát hợp lệ

**Đã đóng** — người đọc có thể tưởng những cách viết này lọt, nhưng không.

| Viết kiểu này | Vì sao vẫn nổ |
|---|---|
| `import { CommandBus as Bus } from "@nestjs/cqrs"` | Tên **được nhập** mới là thứ được đọc, không phải tên cục bộ, nên đổi tên ngay chỗ nhập chẳng thay đổi gì. |
| `import { "QueryBus" as Bus } from "@nestjs/cqrs"` | Dạng nhập bằng chuỗi ký tự được phủ bởi nhánh dự phòng `imported.value`. |
| `(orderWorker as OrderWorker).run()` | Bên nhận được bóc qua `TSAsExpression` và `TSTypeAssertion` trước phép thử tên, nên một phép ép kiểu không giấu được nó. |
| `orderWorker?.run()` | `ChainExpression` cũng được bóc, vì đúng lý do ấy. |
| `await new Promise((resolve) => setTimeout(resolve, 500))` | Bị báo một lần, dưới tên `timer`. Nhánh gọi hàm đi ngược chuỗi tổ tiên rồi đứng yên, có chủ ý, để một giấc ngủ không sinh ra hai phát hiện. |
| `new Promise((resolve) => globalThis.setTimeout(resolve, 500))` | Nhánh promise so bằng **văn bản** nguồn thô chứ không so nút gọi hàm, nên gắn thêm tiền tố cho bộ hẹn giờ không giấu được nó. |
| `it.each([…])("step", …)` có nhánh bên trong | `insideStep` lùi về `callee.object.name`, nên `it.each`, `it.only`, `it.skip`, `test.each` và `it.concurrent` đều vẫn là bước. |
| `import Chat from "openai/resources/chat"` | Phép thử nhà cung cấp là tiền tố, mà `openai/` là một trong các nhánh của nó. |
| `import { Anthropic } from "@anthropic-ai/sdk"` và mọi đường dẫn con khác của một nhà cung cấp có scope | Ba trong sáu nhánh nhà cung cấp là tiền tố scope kết thúc bằng dấu chéo, nên mọi gói nằm dưới các scope ấy đều khớp. |
| Một đường dẫn viết bằng dấu chéo ngược | Tên tệp được chuẩn hoá về chéo xuôi trước phép thử đuôi. |
| Một thân `describe` chứa các khối `it` có nhánh | `insideStep` dừng ở tổ tiên khớp **đầu tiên** và không đòi bước phải là cha trực tiếp, nên độ sâu lồng bên trong thân hàm không quan trọng. |

**Còn mở** — mù đã xuất xưởng. Một phán quyết không được nói rằng những chỗ này đã được xét.

| Phạm vi | Cái gì lọt |
|---|---|
| cả bảy luật | **Tên tệp.** Toàn bộ chỗ này chỉ tồn tại cho các tệp kết thúc bằng `.e2e-spec.ts`; đặt suffix khác làm cả bảy rule không được cài visitor. |
| cả bảy luật | **Một tệp phụ trợ.** Chuyển bus call, sleep, branch hay provider import sang helper làm rule per-spec tương ứng thôi thấy code đó; riêng shared-world wiring vẫn do `no-wiring-in-flow-spec` canh trong spec. |
| `e2e-uses-production-transport` | **Một bên nhận không phải định danh trần**, **một bên nhận đặt tên khác**, **mọi phương thức nội bộ ngoài `execute` và `process`**, **một lời gọi bằng ngoặc vuông**, và **mọi bộ điều phối lấy về không qua phép nhập có tên**. |
| `e2e-uses-production-transport` | Khiếm khuyết ngược: `builder.execute()` trên một trình dựng truy vấn, `stream.process()` trên một bộ phân tích, và mọi phương thức không liên quan mà tình cờ viết là `execute` hay `process` đều bị báo dù chẳng có gì bị đi tắt. |
| `e2e-asserts-persisted-state` | **Một câu nhập không dùng tới rửa sạch cả tệp**, **một lần đọc trạng thái qua bộ khung dùng chung**, **mọi kho không phải kho quan hệ**, và **đường dựng cảnh**, thứ mà luật không phân biệt được với một phép khẳng định vì nó không hề nhìn xem định danh nằm ở đâu. |
| `no-model-call-in-e2e` | **Mọi phép nhập không phải `ImportDeclaration`**, **mọi nhà cung cấp ngoài sáu mẫu**, **chạm tới nhà cung cấp mà không qua SDK**, và **để nguyên khách hàng thật** — dạng đắt nhất của lỗi này hoàn toàn không phải một phép nhập. `import type` thì bị báo dù chẳng có gì được đóng gói ra. |
| `no-sleep-in-flow` | **Ngủ qua thành viên**, **đổi tên**, **mọi cách đốt thời gian khác**, và **hỏi vòng không hạn chót**. Phép so văn bản của nhánh promise báo cả một `new Promise` chỉ nhắc tới `setTimeout`. |
| `no-branch-in-flow-step` | **Một nhánh trong hàm phụ trợ**, **một nhánh trong `beforeAll`/`beforeEach`/`afterEach`/`describe`**, **cách rẽ không nằm trong bốn loại nút**, **toán tử logic ở vị trí biểu thức**, **một phép khẳng định đủ lỏng để đúng trên cả hai đường**, và **một bước khai dưới bí danh như `specify`**. |
| không luật nào | **Mọi thứ mà bảy mã `E2E-` không có máy giữ cấm**, cộng với nửa không được giữ của bốn mã chỉ giữ được một nửa: đi vào không bằng cổng sản xuất, khẳng định một hệ quả không phải hệ quả nghiệp vụ, thay chính sách nội bộ thay vì chỉ kịch bản hoá kết quả bên ngoài, và hỏi vòng không hạn chót. |

Dòng cuối cùng đó là bản tóm tắt trung thực: trong mười hai mã, năm mã được giữ, bốn trong năm mã ấy
chỉ giữ được một nửa, và toàn bộ kệ này được khoanh phạm vi bằng một cái đuôi tên tệp mà ai cũng đổi
được.

## Đầu vào

| Đầu vào | Bằng chứng cần có |
|---|---|
| đường dẫn tệp | `context.filename`, lùi về `context.getFilename()`, chuẩn hoá về dấu chéo xuôi |
| nguồn nhập | giá trị chuỗi trên một `ImportDeclaration` |
| tên được nhập | `imported.name`, lùi về `imported.value`, trên một `ImportSpecifier` |
| lời gọi thành viên | `callee.property.name` cộng với `callee.object` đã bóc |
| văn bản định danh | `node.name` trên bất kỳ `Identifier` nào trong tệp |
| văn bản nguồn thô | `sourceCode.getText(node)` cho nhánh `new Promise` |
| tổ tiên theo văn bản | chuỗi `parent`, cho việc xác định bước chứa và cho phép đứng yên của giấc ngủ bọc trong promise |

## Quy tắc

1. Danh tính của một luật là **tên công bố** của nó; ở đây không gán số cho luật nào.
2. Phát hiện thuần cú pháp: không phân giải mô-đun, không hỏi kiểu, không chạy bài kiểm thử nào.
3. Một tệp chỉ vào phạm vi khi tên tệp kết thúc bằng `.e2e-spec.ts`. Không có cổng thứ hai, không có
   tuỳ chọn cấu hình: phạm vi của kệ này là một cái đuôi tên tệp.
4. Mỗi luật giữ nhiều nhất **một nửa** mã của nó, và mô-đun tự nói điều đó ở đầu tệp thay vì trình bày
   như đã phủ kín.
5. Hai luật ở đây có thể mâu thuẫn nhau trên cùng một dòng, và đó là mâu thuẫn thật chứ không phải lỗi
   cấu hình.
6. Mức nghiêm do package định nghĩa cho cả bảy; cấu hình của kho tiêu thụ mới là nơi quyết
   định thật sự bật cái gì.

## Ngoại lệ

Mô-đun này **không có** danh sách miễn trừ theo tệp, không có allow-list, không có thư mục được tha.
Điều đó đáng nói rõ, vì nó có nghĩa là mọi lối thoát đều là chuyện **hình dạng** chứ không phải chuyện
được phép — mà hình dạng là thứ người viết đổi mà không nhận ra mình vừa đổi.

Ba miễn trừ duy nhất nằm bên trong từng luật, và mỗi cái được nói rõ nó tha cái gì:

- **Giấc ngủ bọc trong `new Promise` được nhánh gọi hàm bỏ qua**, tha thông điệp `sleep` trên lời gọi
  đó để cả dòng chỉ bị báo một lần dưới tên `timer`. Hai phát hiện trên cùng một dòng không dạy được ai
  nên sửa cái nào.
- **Toán tử logic chỉ bị báo ở vị trí câu lệnh**, tha mọi toán tử logic nằm trong một biểu thức. Mua
  được sự yên tĩnh, trả bằng phép khẳng định `expect(a || b)`.
- **Lời gọi thành viên bằng ngoặc vuông bị loại trước cả hai nhánh vận chuyển**, tha cả `direct` lẫn
  `actor` trên `worker["process"]()`. Chỗ này không được lập luận ở đâu và đọc như một sơ suất, không
  phải một quyết định.

## Đầu ra

Một khối cho mỗi phát hiện:

```text
rule:    <published rule name>
file:    <path as the gate saw it, forward slashes>
node:    <ImportDeclaration | ImportSpecifier | CallExpression | NewExpression | Identifier |
          IfStatement | ConditionalExpression | SwitchStatement | LogicalExpression | Program>
message: <busImport | direct | actor | state | provider | sleep | timer | branch>
```

Một tệp sạch và nằm trong phạm vi xuất một khối với `message: none` cùng cổng tên tệp đã nhận nó. Một
tệp ngoài phạm vi xuất một khối với `message: none` và ghi chú rằng `isE2eSpec` trượt, nên không bộ
duyệt nào được cài — đó không phải là một lần qua.

## Ví dụ đã giải

**Đầu vào.** `test/order-checkout.e2e-spec.ts`:

```ts
import { CommandBus } from "@nestjs/cqrs"
import OpenAI from "openai"

describe("checkout", () => {
  it("charges the order", async () => {
    await commandBus.execute(new PlaceOrder(orderId))
    await new Promise((resolve) => setTimeout(resolve, 500))
    if (response.body.paid) {
      expect(response.status).toBe(201)
    }
  })
})
```

Tên tệp kết thúc bằng `.e2e-spec.ts`, nên cả bảy luật đều có bộ duyệt. Sáu phát hiện của ví dụ:

```text
rule:    e2e-uses-production-transport
file:    test/order-checkout.e2e-spec.ts
node:    ImportSpecifier
message: busImport
```

```text
rule:    e2e-uses-production-transport
file:    test/order-checkout.e2e-spec.ts
node:    CallExpression
message: direct
```

```text
rule:    no-model-call-in-e2e
file:    test/order-checkout.e2e-spec.ts
node:    ImportDeclaration
message: provider
```

```text
rule:    no-sleep-in-flow
file:    test/order-checkout.e2e-spec.ts
node:    NewExpression
message: timer
```

Lời gọi `setTimeout` bên trong promise không bị báo lần thứ hai: nhánh gọi hàm đi ngược chuỗi tổ tiên,
gặp `NewExpression` của `Promise` và đứng yên.

```text
rule:    no-branch-in-flow-step
file:    test/order-checkout.e2e-spec.ts
node:    IfStatement
message: branch
```

```text
rule:    e2e-asserts-persisted-state
file:    test/order-checkout.e2e-spec.ts
node:    Program
message: state
```

**Đã sửa.** Luồng đi vào bằng HTTP, chờ theo một điều kiện thay vì theo đồng hồ, khẳng định đúng một
đường, và gọi tên kiểu lưu trữ:

```ts
import type { DataSource } from "typeorm"
import request from "supertest"

describe("checkout", () => {
  it("charges the order", async () => {
    const response = await request(app.getHttpServer()).post("/orders").send(payload)
    await world.waitFor(() => world.db.isPaid(response.body.id))
    expect(response.status).toBe(201)
  })
})
```

Cả năm luật giờ đều im, và hai sự im lặng trong đó không phải là tuân thủ:

```text
rule:    e2e-asserts-persisted-state
file:    test/order-checkout.e2e-spec.ts
node:    Program
message: none
hatch:   phép nhắc DataSource chỉ ở mức kiểu và không dùng tới đã bật cờ phạm vi tệp vĩnh viễn; phép
         đọc trạng thái thật, world.db.isPaid(…), không khớp tên nào trong sáu tên và lẽ ra đã không
         bật được cờ đó
```

```text
rule:    no-sleep-in-flow
file:    test/order-checkout.e2e-spec.ts
node:    CallExpression
message: none
hatch:   world.waitFor là một lời gọi thành viên chứ không phải định danh trần, và vòng hỏi của nó
         không mang hạn chót — nửa "hỏi vòng có hạn chót" của E2E-3 không có luật nào giữ, còn thứ
         tệp phụ trợ làm bên trong thì vốn đã nằm ngoài tầm vì mọi cổng đều theo từng tệp
```

Và bản sửa đọc trạng thái theo đúng hình dạng thư viện lưu trữ đưa ra thì đi ngược lại: viết
`await dataSource.createQueryBuilder(…).…execute()` bên trong bước làm thoả `e2e-asserts-persisted-state`
và lập tức chạm phải luật vận chuyển.

```text
rule:    e2e-uses-production-transport
file:    test/order-checkout.e2e-spec.ts
node:    CallExpression
message: direct
```

Trên dòng đó chẳng có gì bị đi tắt. Hai luật mâu thuẫn nhau, và mâu thuẫn ấy là thật.

## Phạm vi

Mô-đun này ghi lại năm luật máy do mô-đun luật của luật luồng công bố, xuất xưởng trong
`@canon-be`. Nó không ghi luật nào *đáng lẽ* phải có: một luật không chỉ được vào đâu thì
là một đề xuất, mà ở đây ghi phán quyết chứ không ghi đề xuất.

Nó không xét mười hai mã của luật — luật sở hữu chúng, và bảy mã trong đó không có máy nào ở bất kỳ
đâu. Nó không xét bộ khung dùng chung làm gì, vì bộ khung sống trong một tệp khác còn mọi cổng ở đây
đều theo từng tệp. Nó cũng không xét kho chạy ở mức nghiêm nào: package định nghĩa mức cho cả bảy,
còn cấu hình của kho tiêu thụ mới quyết định thật sự bật cái gì.
