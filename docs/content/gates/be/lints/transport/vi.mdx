---
title: Transport · Vietnamese
---

# Cửa vào

## LOADS

None.


## Bản ghi

Gate này nhận mã đã viết xong — một tệp, một mảnh diff. Kết quả là một **phán quyết**: tệp có thuộc phạm
vi hay không, luật máy nào đã bắn, bắn tại node decorator nào, route nào và bằng chứng nào quyết định
điều đó, ánh xạ sang mã luật nào, và cửa còn mở nào lẽ ra đã che đúng cái sai ấy. Mô-đun này không
chọn giao thức nào cả. Nó từ chối một giao thức, và nó phải chỉ được đúng cái decorator mà nó từ chối.

## Luật

Luật mà mô-đun này cưỡng chế giải quyết một câu hỏi về cửa vào: **khi nào một cửa được phép không
phải là GraphQL**, và câu trả lời đó nằm ở đâu trên đĩa. Một route REST chỉ được phép ở chỗ GraphQL
không phục vụ được, chính tệp đó phải cho thấy nó thuộc trường hợp nào, và một cửa nằm cạnh những cửa
khác bất kể nó nói giao thức gì.

Tài liệu này không nhắc lại luật. Nó ghi lại **phần cưỡng chế**: máy giữ được câu nào trong số đó,
giữ bằng cơ chế nào, và — phần thường không ai viết ra — cách viết nào đi lọt qua máy mà không bị
chạm tới.

Luật transport nay có thêm `TRANSPORT-6`. **Ba quy tắc đã được xuất bản.** Hai quy tắc giữ REST door;
`no-capability-imports-features` giữ chiều phụ thuộc giữa capability và door. Phán đoán cửa mặc định ở
`TRANSPORT-1` vẫn do người giữ.

Điểm thiết kế đáng nói: **không quy tắc nào tra một danh sách.** Lý do một cửa REST được phép được đọc
thẳng từ chuỗi route, từ đường dẫn tệp và từ chính văn bản của tệp — đúng thứ bằng chứng mà một người
đọc sẽ dùng. Lựa chọn đó đúng, và nó cũng là gốc của gần như mọi cửa còn mở bên dưới: bằng chứng đọc
dưới dạng văn bản thô thì không phân biệt được **dùng** với **nhắc tới**, nên một dòng chú thích biện
minh cho một cửa hệt như một interceptor thật.

## Luật máy đã xuất bản

| Quy tắc | Mã luật | Nó báo cái gì |
|---|---|---|
| `rest-door-needs-a-reason` | `TRANSPORT-2` | `unjustified` trên mọi decorator `@Controller` trong một tệp không cho thấy dấu hiệu nào của năm lý do được chấp nhận — probe, hệ thống ngoài, byte, máy, danh tính vận hành |
| `door-lives-in-features` | `TRANSPORT-3` | `wrongTree` trên mọi decorator `@Controller` trong một tệp có đường dẫn chuẩn hoá chứa `/src/modules/` |
| `no-capability-imports-features` | `TRANSPORT-6` | Một import trong `modules/` đi ngược vào `features/`, làm capability biết transport door gọi nó. |

`TRANSPORT-1` — cửa mặc định là GraphQL — **không có quy tắc nào giữ**. Không có gì báo động khi một
thao tác lẽ ra là một query lại được viết thành một route; `rest-door-needs-a-reason` chỉ đòi một cửa
đã tồn tại phải cho thấy lý do, và nó nhận đúng một decorator. Một socket gateway hay một consumer
hàng đợi — vốn cũng là cửa theo đúng định nghĩa của luật — hoàn toàn vô hình với hai quy tắc door.
`TRANSPORT-1` là **không được cưỡng chế**, không phải là được phủ, và một lần chạy sạch không nói gì
về nó cả.

## Đọc một diff

1. **Quyết định phạm vi trước mọi thứ khác, và ghi lại.** Ngoài phạm vi ở đây không có nghĩa là tệp
   đã qua — với `door-lives-in-features`, cổng chặn trả về một **visitor rỗng**, nên quy tắc không hề
   tồn tại với tệp đó chứ không phải đã tha nó.
2. **`door-lives-in-features` đòi `/src/modules/` trong `context.filename` đã chuẩn hoá dấu gạch**, có
   một dấu gạch đứng trước `src`. Cây thư mục khác đi là quy tắc tắt hẳn.
3. **`rest-door-needs-a-reason` không có cổng đường dẫn nào.** Nó chạy trên mọi tệp được đưa cho, kể
   cả spec và fixture, và đọc toàn bộ văn bản tệp một lần trong `create`.
4. **Kiểm miễn trừ tiếp theo.** Với `TRANSPORT-2`, miễn trừ chính là năm lý do — probe, hệ thống
   ngoài, byte, máy, danh tính vận hành — thử theo thứ tự, phép đầu tiên khớp thì dừng. Với
   `TRANSPORT-3` thì bên trong quy tắc không có miễn trừ nào cả.
5. **Đọc các node decorator.** Cả hai quy tắc đòi tên decorator là định danh `Controller`, đứng trần
   hoặc làm `callee` của một `CallExpression`. Mọi hình dạng khác làm cả hai im, nên một namespace hay
   một lần đổi tên đủ vô hiệu hoá cả hai.
6. **Xuất một khối cho mỗi phát hiện**, và ghi rõ bằng chứng nào quyết định — route, đường dẫn hay văn
   bản tệp.
7. **Viết dòng cửa còn mở mỗi khi một cửa mở lẽ ra đã che đúng cái sai ấy**, và không bao giờ để một
   sự im lặng được đọc thành tuân thủ.
8. **Không báo thứ không quy tắc nào canh.** `TRANSPORT-1` không có máy nào giữ, và mọi cửa không mang
   `@Controller` cũng vậy.

## `rest-door-needs-a-reason` — TRANSPORT-2

**Nó báo cái gì.** Một thông điệp duy nhất, `unjustified`, bắn tại chính node decorator, cho mọi
`@Controller` trong một tệp không cho thấy dấu hiệu nào trong năm lý do được chấp nhận:

| Lý do | Bằng chứng quy tắc đòi |
|---|---|
| probe | route khớp `/^healthz?$/`, **hoặc** đường dẫn khớp `/\/health(z)?[./]/` |
| hệ thống ngoài | route **hoặc** đường dẫn khớp `/webhook/i` |
| byte | **văn bản tệp** khớp `/FileInterceptor\|FilesInterceptor\|AnyFilesInterceptor\|StreamableFile\|@Res\s*\(\|createReadStream/` |
| máy | route khớp `/^(pods\|internal\|agents)\//` |
| danh tính vận hành | route khớp `/^api\/ops(\/\|$)/`, **hoặc** văn bản tệp khớp `/Operator[A-Za-z]*Guard\|ServiceToken\|OPS_TOKEN/` |

Năm phép thử chạy **theo thứ tự và dừng ở phép đầu tiên khớp**, nên thông điệp không bao giờ nói lý do
nào đã cứu cửa đó — nó chỉ im.

**Nó phát hiện bằng gì.** Đọc `context.filename` và **toàn bộ văn bản tệp** qua `sourceCode.getText()`
một lần trong `create`. Thăm nút `Decorator`; đòi tên decorator là định danh `Controller`, đứng trần
hoặc làm `callee` của một `CallExpression` khi callee là `Identifier`. Chuỗi route chỉ được lấy khi
`arguments[0]` là một `Literal` có `value` kiểu chuỗi, mọi hình dạng khác thành `""`. Sau đó chạy năm
phép thử ở trên; không phép nào khớp thì báo lỗi tại node decorator.

**Điểm mù.** Phép thử byte và phép thử vận hành chạy trên **văn bản thô của tệp**, thứ không
phân biệt nổi dùng với nhắc tới: một dòng chú thích `// TODO: switch the export to StreamableFile
later`, một `import { FileInterceptor } from "…"` bỏ quên sau lần dọn dẹp, hay một `const AUDIT_KEYS =
["OPS_TOKEN"]` nằm trong bảng cấu hình — mỗi thứ đó đều biện minh cho **mọi** `@Controller` trong tệp,
vĩnh viễn và không ai thấy. Lý do tính theo tệp, nên hai controller trong một tệp — cái đầu stream
byte, cái sau đọc JSON thuần — dùng chung một lý do và cửa thứ hai không bao giờ có thông điệp riêng.
Đường dẫn cũng là bằng chứng: một thư mục tổ tiên tên `webhooks/`, hay bất kỳ thư mục nào tên `health/`
hoặc `healthz/`, mang carve-out xuống mọi controller nằm dưới nó, sâu bao nhiêu cũng được. Lý do máy
và lý do vận hành được cấp bằng **tiền tố chuỗi** đơn thuần: `@Controller("internal/reports")` cho một
truy vấn người dùng đã xác thực bình thường, hay `@Controller("api/ops/anything")` cho một cửa mà
người xem thường vẫn tới được, không hề bị kiểm rằng có phiên người dùng nào được mang theo, và guard
không được hỏi tới một khi tiền tố đã khớp. `@Controller("healthz")` trả về dữ liệu nghiệp vụ vẫn đi
lọt, vì không ai nhìn handler trả về gì. `@Nest.Controller("api/theme")` là một `MemberExpression`;
`import { Controller as Route }` rồi `@Route("api/theme")`, và `const Door = Controller` rồi
`@Door("api/theme")`, so ra là những cái tên khác — cả ba đều làm quy tắc im hoàn toàn. Một handler
đăng ký tay ngoài lớp — `app.use(…)`, `server.get("/api/theme", …)` trong tệp khởi động — không có
decorator nào để thăm. Và `routeOf` là cạnh sắc nhất trong nguồn: template literal, hằng số, phép nối
chuỗi hay dạng object `{ path: "…" }` đều thành `""`, mà `""` không khớp lý do nào trong ba lý do dựa
trên route, nên một cửa **đúng luật** bị báo sai và cách sửa nhanh nhất người ta sẽ chọn là tắt cảnh
báo. Route ở cấp phương thức thì không bao giờ được đọc.

**Ranh giới.** Quy tắc này chỉ hỏi một cửa đã tồn tại có cho thấy lý do hay không. Cửa ấy đậu ở đâu
trên đĩa là chuyện của `TRANSPORT-3`, và một lý do hoàn hảo không miễn được gì ở đó.

## `door-lives-in-features` — TRANSPORT-3

**Nó báo cái gì.** Một thông điệp duy nhất, `wrongTree`, bắn tại chính node decorator, cho **mọi**
`@Controller` nằm trong một tệp có đường dẫn chứa `/src/modules/`. Không có ngoại lệ nào bên trong:
route là gì, tệp tên gì, lớp tên gì, có lý do `TRANSPORT-2` hợp lệ hay không — không thứ nào được hỏi
tới.

**Nó phát hiện bằng gì.** Cổng chặn ở cấp tệp chạy trước: `/\/src\/modules\//` so với
`context.filename` đã chuẩn hoá dấu gạch. Không khớp thì trả về **visitor rỗng**, nên tệp đó không
được kiểm một phần nào cả — nó không được kiểm gì hết. Khớp thì thăm `Decorator`, đòi cùng định danh
`Controller`, rồi báo lỗi vô điều kiện.

**Điểm mù.** Đổi tên thư mục `modules/` thành `services/`, `domains/` hay
`capabilities/` thì tầng vẫn còn nguyên, cửa vẫn đậu sai chỗ, mà quy tắc biến mất: cấm một **thư
mục** không phải cấm một **tầng**. Chỉ `@Controller` được nhận ra, nên `@WebSocketGateway()`,
`@MessagePattern(…)`, `@EventPattern(…)` và `@Resolver` nằm dưới `modules/` đều đi qua sạch sẽ —
luật định nghĩa cửa là mọi thứ thế giới bên ngoài chạm tới được và gọi tên socket lẫn consumer hàng
đợi một cách tường minh, nên cái tên quy tắc hứa nhiều hơn thứ nó kiểm. Cùng ba cách viết decorator đã
làm quy tắc kia im — `MemberExpression`, đổi tên khi import, gán qua biến — cũng làm quy tắc này im.
Cổng đòi một **dấu gạch đứng trước** `src`, nên một trình chạy đưa vào tên tệp tương đối như
`modules/x.controller.ts` sẽ tắt nó; đường dẫn tuyệt đối luôn có dấu gạch ấy, nên khe này hẹp
nhưng có thật — nó là phụ thuộc vào **cách trình chạy đặt tên tệp**, không phải vào vị trí thật của
tệp.

**Ranh giới.** Quy tắc còn chạy **rộng hơn luật** ở đúng một chỗ: luật chỉ ràng buộc `modules/**`
của ứng dụng chính và miễn cho một ứng dụng riêng tự giữ thư mục `modules/` của nó, còn cổng chặn
thì khớp mọi đường dẫn có chứa `/src/modules/`. Chỗ lệch đó là một phát hiện đã được ghi lại, không
phải một sự cho phép.

## Cách phát hiện

| Bộ phận | Cơ chế |
|---|---|
| chuẩn hoá dấu gạch | Cả hai quy tắc đổi `\` thành `/` trước mọi phép thử đường dẫn, nên một đường dẫn Windows so sánh như mọi đường dẫn khác |
| cổng tệp | `door-lives-in-features` chặn bằng `/\/src\/modules\//`; không khớp thì trả về **visitor rỗng**. `rest-door-needs-a-reason` không có cổng nào và chạy ở khắp nơi |
| danh tính decorator | `node.expression`; `type` của nó; với một `CallExpression` thì `callee.type` và `callee.name`. Chỉ một `Identifier` tên `Controller` được nhận; một `MemberExpression` trả về `null` |
| bộ đọc route | `routeOf` chỉ nhận `arguments[0]` là một `Literal` chuỗi. Template literal, hằng số, phép nối chuỗi và `{ path: "…" }` đều thành `""`, mà `""` không khớp lý do nào trong ba lý do dựa trên route. Route cấp phương thức không bao giờ được đọc |
| văn bản toàn tệp | `sourceCode.getText()` đọc một lần trong `create`, cho phép thử byte và vận hành. Đây là bằng chứng yếu nhất mô-đun này tạo ra được |
| chạm ra ngoài tệp | Không có. Cả hai đều đơn tệp: không quy tắc nào phân giải một import, đọc một kiểu, hay biết tệp khác khai báo gì. Cả hai khai `schema: []` và không nhận tuỳ chọn |

## Lối thoát hợp lệ

**Đã đóng** — người đọc có thể tưởng những cách viết này lọt được, nhưng không.

| Viết theo cách này | Vì sao vẫn bắn |
|---|---|
| Một dòng chú thích trên lớp ghi `// this is a webhook receiver` | `webhook` chỉ được so với **route** và **đường dẫn**, không bao giờ so với văn bản tệp. Một lời khai bằng văn xuôi không mua được gì |
| Đặt tên lớp là `WebhookController` trong khi route là `api/reports` và tệp là `reports.controller.ts` | Không quy tắc nào đọc tên lớp. Danh tính đến từ chuỗi route và đường dẫn |
| Chuyển một controller không có lý do vào `features/` | `rest-door-needs-a-reason` không có cổng đường dẫn cho phần biện minh. Đứng đúng cây là một câu khác của luật, do một quy tắc khác giữ |
| Một controller webhook để lại dưới `modules/` | Hai quy tắc độc lập nhau. Một lý do `TRANSPORT-2` hoàn hảo không miễn được gì ở `TRANSPORT-3` |
| Đào sâu thêm: `modules/billing/http/controllers/x.controller.ts` | Cổng khớp **cặp** `/src/modules/` ở bất kỳ đâu trên đường dẫn, nên thêm bao nhiêu tầng cũng không đổi |
| Một `@Controller` khai bên trong một spec hay một fixture | Không quy tắc nào có làn kiểm thử. Một cửa dựng tạm trong tệp test bị báo như mọi cửa khác |
| `@Controller("ops/tenants")` với ý định làm màn vận hành | Phép thử route vận hành neo vào `api/ops`. `ops/…` trần không phải nó, và cửa vẫn bị báo trừ khi tệp còn mang một định danh guard hoặc service-token |
| `@Controller("internal")` không có đoạn thứ hai | Phép thử máy đòi một dấu gạch phía sau. Một tiền tố trần không thoả |

**Còn mở** — chỗ mù đã xuất xưởng. Một phán quyết không được nói rằng những chỗ này đã bị xét.

| Phạm vi | Cái gì đi lọt |
|---|---|
| `rest-door-needs-a-reason` | `// TODO: switch the export to StreamableFile later` trong một tệp mà cửa duy nhất chỉ đọc JSON thuần. Phép thử byte chạy trên **văn bản thô của tệp** và không phân biệt được dùng với nhắc tới |
| `rest-door-needs-a-reason` | Một `import { FileInterceptor } from "…"` không dùng, bỏ quên sau lần dọn dẹp. Dòng import là văn bản; cửa được biện minh bởi một thứ còn sót |
| `rest-door-needs-a-reason` | `const AUDIT_KEYS = ["OPS_TOKEN"]` nằm cùng tệp. Một chuỗi trong bảng cấu hình, một khoá log hay một tên test đều mở được lý do vận hành |
| `rest-door-needs-a-reason` | Hai controller trong một tệp, một cái stream byte và một cái đọc JSON. Bằng chứng tính theo tệp, nên cửa thứ hai đi nhờ lý do của cửa thứ nhất và không bao giờ có thông điệp nào cho riêng nó |
| `rest-door-needs-a-reason` | Một bản checkout, một thư mục gói hay một thư mục tổ tiên tên đúng là `webhooks/`. Phép thử hệ thống ngoài so `/webhook/i` với **toàn bộ đường dẫn đã chuẩn hoá**, sâu bao nhiêu cũng được |
| `rest-door-needs-a-reason` | Bất kỳ tệp nào nằm dưới một thư mục tên `health/` hoặc `healthz/`. Một service, một mapper và một controller CRUD đầy đủ đều thừa hưởng carve-out kiểm tra sống |
| `rest-door-needs-a-reason` | `@Controller("internal/reports")` cho một truy vấn đã xác thực bình thường. Lý do máy là một tiền tố chuỗi, và tiền tố là thứ rẻ nhất trong một route để đổi |
| `rest-door-needs-a-reason` | `@Controller("api/ops/anything")` cho một cửa người xem thường vẫn tới được. Tiền tố là toàn bộ bằng chứng, và guard không được kiểm một khi tiền tố đã khớp |
| `rest-door-needs-a-reason` | `@Controller("healthz")` trả về dữ liệu nghiệp vụ. Phép thử probe so đúng chuỗi route và không bao giờ nhìn handler trả về gì |
| `rest-door-needs-a-reason` | Một route không phải `Literal` chuỗi — cửa mở này chạy theo chiều ngược: một cửa **đúng luật** bị báo sai, và cách sửa nhanh nhất là tắt cảnh báo. Route cấp phương thức không bao giờ được đọc, nên `@Controller()` rỗng cộng `@Post("webhook/settlement")` là một webhook thật mà vẫn bị báo |
| `door-lives-in-features` | Đổi tên `modules/` thành `services/`, `domains/` hay `capabilities/`. Cấm thư mục không phải cấm tầng; tầng sống sót qua lần đổi tên với quy tắc đã tắt |
| `door-lives-in-features` | `@WebSocketGateway()`, `@MessagePattern(…)`, `@EventPattern(…)` nằm dưới `modules/`. Quy tắc nhận `@Controller` và không nhận gì khác, nên cái tên nó hứa nhiều hơn thứ nó kiểm |
| `door-lives-in-features` | Một tên tệp tương đối như `modules/x.controller.ts`. Cổng đòi một dấu gạch đứng trước `src` — một phụ thuộc vào cách trình chạy đặt tên tệp |
| cả hai | `@Nest.Controller("api/theme")`, hoặc `import { Controller as Route }` rồi `@Route("api/theme")`, hoặc `const Door = Controller` rồi `@Door("api/theme")`. Một `MemberExpression` trả về `null`, và một binding đổi tên so ra là một cái tên khác |
| cả hai | Một handler đăng ký tay ngoài lớp — `app.use(…)`, `server.get("/api/theme", …)` trong tệp khởi động. Không có decorator nào để thăm, mà một cửa REST lắp bằng tay vẫn là một cửa luật ràng buộc |
| cả hai | `// eslint-disable-next-line`. Không quy tắc nào ở đây là không tắt được, nên mọi cửa mở phía trên còn với tới được bằng một dòng, bởi một người đang vội |
| không quy tắc nào | **Toàn bộ những gì `TRANSPORT-1` phát biểu** — một cửa lẽ ra phải là một query thì không có gì báo cả |

Mọi cửa còn mở phía trên là cửa mở trong *quy tắc*, không bao giờ là sự cho phép trong *luật*. Mã đi
lọt vẫn là mã sai.

## Đầu vào

| Đầu vào | Bằng chứng phải có |
|---|---|
| `context.filename` | Đường dẫn đúng như quy tắc thấy, đã chuẩn hoá dấu gạch ngược, rồi so với các mẫu probe, hệ thống ngoài và `/src/modules/` |
| `sourceCode.getText()` | Toàn bộ văn bản tệp, dưới dạng một chuỗi duy nhất, cho phép thử byte và vận hành |
| `Decorator` | `node.expression`; `type` của nó; với một `CallExpression` thì `callee.type`, `callee.name` và `arguments[0]` |
| Đối số route | Chỉ `arguments[0]` khi nó là một `Literal` có `value` kiểu chuỗi. Mọi hình dạng khác thành `""` |

Không đọc gì khác. Không thông tin kiểu, không đồ thị import, không tệp thứ hai, không cấu hình, không
một danh sách route được duyệt sẵn.

## Quy tắc

1. Danh tính của một quy tắc là **tên đã xuất bản** của nó. Không có mã số riêng cho quy tắc; cái tên
   đó mới là chuỗi build in ra, chuỗi mà một dòng tắt cảnh báo mang theo, và chuỗi dùng trong mọi cuộc
   trao đổi về một lỗi.
2. Mỗi quy tắc ánh xạ sang đúng một mã trong luật, và không mã nào bị hai quy tắc cùng giữ.
3. Cả hai quy tắc đều là `meta.type: "problem"` và đều là `error` trong `recommended`.
4. Lý do được tính **theo tệp**, không bao giờ theo decorator, trong `rest-door-needs-a-reason`.
5. Một cổng đường dẫn trả về **visitor rỗng**, nên một tệp bị chặn không được kiểm một phần — nó không
   được kiểm gì cả.
6. Cả hai quy tắc khai `schema: []` và do đó không nhận tuỳ chọn. Mức nghiêm trọng là núm vặn duy nhất
   một kho mã có.
7. Mọi cửa còn mở là cửa mở trong *quy tắc*, không bao giờ là sự cho phép trong *luật*. Mã đi lọt vẫn
   là mã sai.

## Ngoại lệ

Mọi ngoại lệ ở đây được viết **bên trong** quy tắc, không phải được cấp bên cạnh nó.

- **Năm lý do chính là miễn trừ.** `rest-door-needs-a-reason` chỉ báo thứ không cho thấy dấu hiệu nào
  của probe, hệ thống ngoài, byte, máy hay danh tính vận hành. Thông điệp đã xuất bản kể tên **bốn**;
  cái thứ năm, probe, được chấp nhận trong im lặng, nên người đọc thông báo lỗi sẽ không học được rằng
  một route kiểm tra sống cũng hợp lệ. Nó giải phóng decorator khỏi `TRANSPORT-2` và khỏi không gì
  khác.
- **Phép thử đầu tiên khớp thì dừng.** Năm phép thử chạy theo thứ tự và trả về ngay ở lần trúng đầu
  tiên. Một cửa có route webhook không bao giờ được xét tới phần byte, nên không thông điệp nào nói
  được lý do *nào* đã cứu nó.
- **Mọi thứ ngoài `/src/modules/` được miễn `door-lives-in-features`** — kể cả một ứng dụng riêng có
  thư mục `modules/` của chính nó, thứ mà luật miễn còn cổng chặn thì không. Miễn trừ này chỉ giải
  phóng tệp khỏi `TRANSPORT-3`; `TRANSPORT-2` vẫn chạy trên nó.
- **Không có làn kiểm thử.** Không quy tắc nào cắt riêng spec hay fixture.

## Đầu ra

Một khối cho mỗi phát hiện:

```text
rule:     <rest-door-needs-a-reason | door-lives-in-features>
code:     <TRANSPORT-2 | TRANSPORT-3>
file:     <path as the rule normalized it>
route:    <literal string | "" when the argument is not a string Literal>
reason:   <probe | external | bytes | machine | operator | none>
evidence: <route | path | file text>
message:  <unjustified | wrongTree>
verdict:  <fires | silent: hatch <name from the Open table>>
```

Dòng `evidence` không phải để trang trí. Một lý do tìm thấy trong **văn bản tệp** là kết quả yếu nhất
mô-đun này tạo ra được, và ghi nó ngang hàng với một lý do tìm thấy trong route chính là cách một
import bỏ quên biến thành một quyết định kiến trúc.

Dòng `verdict` chính là dòng cửa còn mở. `silent: hatch <name>` nói rằng quy tắc không tạo ra thông
điệp nào và rằng sự im lặng ấy không phải là tuân thủ; chỉ `silent` không kèm cửa mở nào mới nghĩa là
tệp thật sự sạch. Một tệp ngoài `/src/modules/` xuất `verdict: silent — out of scope, empty visitor`
cho `door-lives-in-features`, và vẫn bị `rest-door-needs-a-reason` xét như thường.

## Ví dụ đã giải

**Đầu vào.** Một cửa nằm giữa cây năng lực, `modules/billing/billing.controller.ts`:

```ts
@Controller("api/billing/callback")
export class BillingCallbackController {
    @Post()
    public async receive(@Body() payload: unknown): Promise<void> {
        await this.payments.settle(payload)
    }
}
```

Đây LÀ một cửa cho hệ thống ngoài, nhưng cả route lẫn đường dẫn đều không nói ra điều đó, nên bằng
chứng duy nhất quy tắc biết đọc thì không tồn tại. Và đường dẫn thì chứa `/src/modules/`.

```text
rule:     rest-door-needs-a-reason
code:     TRANSPORT-2
file:     src/modules/billing/billing.controller.ts
route:    "api/billing/callback"
reason:   none
evidence: route
message:  unjustified
verdict:  fires
```

```text
rule:     door-lives-in-features
code:     TRANSPORT-3
file:     src/modules/billing/billing.controller.ts
route:    "api/billing/callback"
reason:   none
evidence: path
message:  wrongTree
verdict:  fires
```

Hai quy tắc, hai phát hiện. Một lý do hợp lệ cũng không cứu được cái thứ hai.

**Đã sửa.** Cửa chuyển sang tầng cửa và nói ngay trong route rằng nó là gì,
`features/billing/billing-webhook.controller.ts`:

```ts
@Controller("api/billing/webhook")
export class BillingWebhookController {
    @Post()
    public async receive(@Body() payload: unknown): Promise<void> {
        await this.payments.settle(payload)
    }
}
```

Cả hai quy tắc im, và ở đây sự im lặng là thật. Nhưng chỉ một lần sửa sau đó nó thôi là thật — một cửa
thứ hai được thêm vào cùng tệp:

```ts
@Controller("api/billing/settings")
export class BillingSettingsController {
    @Get()
    public async settings(): Promise<BillingSettingsDto> {
        return this.billing.settings()
    }
}
```

```text
rule:     rest-door-needs-a-reason
code:     TRANSPORT-2
file:     src/features/billing/billing-webhook.controller.ts
route:    "api/billing/settings"
reason:   external
evidence: path
message:  none
verdict:  silent: hatch two controllers in one file — evidence is file-wide, so the second door rides on the first door's reason and no message is ever produced for it
```

Một truy vấn JSON thuần, đúng thứ mà lược đồ đã có sẵn chỗ cho, và quy tắc sẽ không bao giờ nói một
câu nào về nó.

## Phạm vi

Mô-đun này ghi lại hai quy tắc của một luật back-end, và nó không xét những gì hai quy tắc ấy không
canh: một thao tác lẽ ra phải là một query là chuyện của `TRANSPORT-1`, thứ không quy tắc nào ở đây
giữ; một socket gateway, một consumer hàng đợi hay một handler đăng ký tay là cửa mà luật sở hữu còn
mô-đun này không thấy. Nó không gọi tên sản phẩm, công ty hay kho mã nào. Tên quy tắc, định danh thông
điệp, tên decorator cùng các định danh interceptor và guard mà quy tắc so khớp là **những định danh
xuất xưởng cùng bản build** và được chép lại nguyên văn; miễn trừ đó không phủ thêm thứ gì khác.
